/**
 * Verifikasi Lapangan.
 *
 * Satu halaman, dua pekerjaan yang berlawanan arah: analis menerbitkan surat
 * tugas, petugas lapangan mengisi laporannya. Keduanya memandang benda yang
 * sama — satu penugasan — dari dua sisi, dan itulah alasan keduanya tidak
 * dipisah menjadi dua halaman. Dua halaman berarti dua daftar penugasan yang
 * harus dijaga tetap sama, dan keduanya akan berpisah.
 *
 * Yang membedakan tampilannya bukan menu melainkan izin: `tugaskan_lapangan`
 * memunculkan tombol penerbit surat tugas, `kirim_laporan_lapangan`
 * memunculkan borang laporannya. Petugas lapangan hanya melihat penugasannya
 * sendiri — dan itu ditegakkan policy RLS, bukan oleh penyaring di sini.
 *
 * Satu aturan yang tidak boleh dilanggar perubahan berikutnya: laporan
 * lapangan tidak pernah mengubah status berita. Sebuah unit yang diberitakan
 * lalu menyatakan beritanya keliru tidak boleh membuat berita itu hilang dari
 * angka nasional — yang berhak menyatakan sebuah berita tidak valid adalah
 * analis pusat, di halaman telaah. Temuan lapangan disimpan pada kolomnya
 * sendiri dan menjadi bahan evaluasi, bukan putusan.
 */

import { kartu, keping, kosong, tombol, roti } from '../ui/komponen.js'
import { amankan, angka, ringkas, jarakWaktu, tanggalJam, ukuranBerkas } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { pesanRamah, unggahBerkas, tautanBerkas } from '../lib/api.js'
import { punyaIzin } from '../lib/peran.js'
import {
  NAMA_STATUS_PENUGASAN, PRIORITAS, PERTANYAAN_BAKU, NAMA_TEMUAN, JENIS_BUKTI,
  nadaPenugasan, nadaTemuan, nadaPrioritas, kalimatTenggat,
} from '../lib/siklus.js'
import {
  bacaSiklus, tulisSiklus, ubahSiklus, siapkanDemo, penulis,
} from '../lib/siklus-data.js'
import {
  barisAntrean, belumDipilih, bidangTeks, bidangPilih, bidangSatuBaris,
  daftarBaris, bacaDaftarBaris, pasangDaftarBaris, bacaBorang, kepingTenggat,
} from '../ui/siklus-ui.js'

const keadaanLapangan = {
  dimuat: false,
  sibuk: false,
  galat: null,
  kasus: [],
  penugasan: [],
  laporan: [],
  bukti: [],
  dipilih: null,
  saringStatus: 'Semua status',
  /** 'tugas-baru' | 'laporan' | null */
  borang: null,
}

/* ------------------------------------------------------------------- muat */

async function muat(keadaan) {
  if (keadaan.demo) siapkanDemo(keadaan.berita || [])

  const [kasus, penugasan, laporan, bukti] = await Promise.all([
    bacaSiklus('kasus', { urut: 'created_at.desc' }),
    bacaSiklus('penugasan', { urut: 'assigned_at.desc' }),
    bacaSiklus('laporanLapangan', { urut: 'submitted_at.desc' }),
    bacaSiklus('bukti'),
  ])

  Object.assign(keadaanLapangan, { kasus, penugasan, laporan, bukti, dimuat: true })
}

const kasusDari = (id) => keadaanLapangan.kasus.find((k) => k.id === id)
const laporanDari = (tugasId) => keadaanLapangan.laporan.find((l) => l.assignment_id === tugasId)

/* ------------------------------------------------------------------ antrean */

function antrean() {
  const daftar = keadaanLapangan.penugasan
    .filter((p) => keadaanLapangan.saringStatus.startsWith('Semua')
      || p.status === keadaanLapangan.saringStatus)
    .sort((a, b) => {
      // Yang masih menuntut kunjungan selalu di atas yang sudah selesai.
      const aktifA = ['Ditugaskan', 'Diterima', 'Berjalan'].includes(a.status) ? 1 : 0
      const aktifB = ['Ditugaskan', 'Diterima', 'Berjalan'].includes(b.status) ? 1 : 0
      if (aktifA !== aktifB) return aktifB - aktifA
      // Lalu yang tenggatnya paling dekat. Penugasan tanpa tenggat jatuh ke
      // belakang, bukan ke depan: tanpa tenggat berarti belum mendesak.
      const tA = a.due_at ? new Date(a.due_at).getTime() : Infinity
      const tB = b.due_at ? new Date(b.due_at).getTime() : Infinity
      return tA - tB
    })

  if (!daftar.length) {
    return `<li><p class="ket" style="padding:16px 10px">
      Tidak ada penugasan yang cocok dengan saringan ini.</p></li>`
  }

  return daftar.map((p) => {
    const kasus = kasusDari(p.case_id)
    const selesai = ['Selesai', 'Dibatalkan'].includes(p.status)
    const tenggat = kalimatTenggat(p.due_at, selesai)
    return barisAntrean({
      id: p.id,
      nomor: p.assignment_number,
      judul: kasus?.title || 'Kasus tidak lagi ada di daftar yang dimuat',
      ket: `${kasus?.primary_upt || '—'} · ${p.assigned_to || 'belum ditugaskan'}`,
      nada: nadaPenugasan(p.status),
      label: p.status,
      terpilih: p.id === keadaanLapangan.dipilih,
      tanda: tenggat.nada === 'kritis' || tenggat.nada === 'tinggi'
        ? `<span class="keping" data-nada="${tenggat.nada}">${amankan(tenggat.teks)}</span>` : '',
    })
  }).join('')
}

/* ------------------------------------------------------------------ rincian */

function rincianPenugasan(p, { bolehTugas, bolehLapor, saya }) {
  const kasus = kasusDari(p.case_id)
  const laporan = laporanDari(p.id)
  const selesai = ['Selesai', 'Dibatalkan'].includes(p.status)
  const pertanyaan = Array.isArray(p.verification_questions) ? p.verification_questions : []

  // Petugas yang ditugaskan boleh mengisi laporan; analis boleh menilainya.
  // Keduanya dibedakan di sini supaya tombolnya tidak muncul bagi yang
  // menekannya hanya akan ditolak peladen.
  const punyaSaya = p.assigned_to === saya
  const bolehIsi = bolehLapor && punyaSaya && !laporan

  return `
    <div class="kasus-kepala">
      <div class="kasus-kepala-teks">
        <span class="label-mono">${amankan(p.assignment_number || 'Tanpa nomor')}</span>
        <h3>${amankan(kasus?.title || 'Kasus tidak dikenali')}</h3>
        <div class="baris gap-6" style="margin-top:6px">
          ${keping(p.status, nadaPenugasan(p.status))}
          ${keping(p.priority || 'Sedang', nadaPrioritas(p.priority), true)}
          ${kepingTenggat(p.due_at, selesai)}
        </div>
        <p class="mini-teks samar-teks" style="margin-top:6px">
          ${amankan(kasus?.primary_upt || 'Unit belum teridentifikasi')} ·
          ditugaskan ${amankan(jarakWaktu(p.assigned_at))} oleh ${amankan(p.assigned_by || '—')}
        </p>
      </div>
      <div class="baris gap-6">
        ${bolehIsi ? tombol({ label: 'Isi laporan', ikon: 'laporan', gaya: 'utama', kecil: true, aksi: 'buka-laporan' }) : ''}
        ${punyaSaya && p.status === 'Ditugaskan' ? tombol({ label: 'Terima tugas', ikon: 'centang', kecil: true, aksi: 'terima-tugas' }) : ''}
        ${punyaSaya && p.status === 'Diterima' ? tombol({ label: 'Mulai kunjungan', ikon: 'panahKanan', kecil: true, aksi: 'mulai-tugas' }) : ''}
      </div>
    </div>

    <div class="siklus-bagian">
      <div class="siklus-bagian-kop"><span class="label-mono">Instruksi</span></div>
      <p class="kecil-teks" style="line-height:1.6;color:var(--ink-2)">
        ${amankan(p.instruction || 'Tidak ada instruksi khusus.')}
      </p>
      <p class="mini-teks samar-teks" style="margin-top:8px">
        Tim: ${amankan(p.assigned_team || '—')} · Petugas: ${amankan(p.assigned_to || '—')}
      </p>
    </div>

    ${pertanyaan.length ? `
      <div class="siklus-bagian">
        <div class="siklus-bagian-kop">
          <span class="label-mono">Pertanyaan verifikasi</span>
          <span class="mini-teks samar-teks">${angka(pertanyaan.length)} butir</span>
        </div>
        <ol class="tanya-daftar">
          ${pertanyaan.map((t) => `<li>${amankan(t)}</li>`).join('')}
        </ol>
      </div>` : ''}

    ${laporan ? bagianLaporan(laporan, bolehTugas, bolehTugas || punyaSaya) : `
      <div class="siklus-bagian">
        <div class="pesan" data-nada="sedang">
          ${ikon('jam')}
          <div>
            <b>Belum ada laporan lapangan.</b>
            ${bolehIsi
              ? 'Isi laporannya lewat tombol di atas begitu kunjungan selesai.'
              : 'Penugasan ini masih menunggu laporan dari petugas yang ditugaskan.'}
          </div>
        </div>
      </div>`}`
}

function bagianLaporan(l, bolehNilai, bolehUnggah) {
  const bukti = keadaanLapangan.bukti.filter((b) => b.report_id === l.id)
  const petugas = Array.isArray(l.officers) ? l.officers : []
  const ditemui = Array.isArray(l.parties_met) ? l.parties_met : []
  const dokumen = Array.isArray(l.documents_checked) ? l.documents_checked : []

  return `
    <div class="siklus-bagian">
      <div class="siklus-bagian-kop">
        <span class="label-mono">Laporan lapangan</span>
        ${keping(l.finding_classification, nadaTemuan(l.finding_classification))}
        <span class="mini-teks samar-teks dorong">
          dikirim ${amankan(jarakWaktu(l.submitted_at))} oleh ${amankan(l.submitted_by || '—')}
        </span>
      </div>

      <div class="sanding" style="margin-bottom:12px">
        <div class="sanding-kolom">
          <h4>Fakta yang ditemukan</h4>
          <p>${amankan(l.facts_found || 'Tidak diisi.')}</p>
        </div>
        <div class="sanding-kolom">
          <h4>Keterangan unit</h4>
          <p>${amankan(l.upt_explanation || 'Tidak diisi.')}</p>
        </div>
      </div>

      <dl class="riwayat-ringkas">
        <div><dt>Kunjungan</dt><dd>${amankan(l.visit_started_at ? tanggalJam(l.visit_started_at) : '—')}</dd></div>
        <div><dt>Petugas</dt><dd>${petugas.length ? amankan(petugas.join(', ')) : '—'}</dd></div>
        <div><dt>Pihak ditemui</dt><dd>${ditemui.length ? amankan(ditemui.join(', ')) : '—'}</dd></div>
        <div><dt>Dokumen diperiksa</dt><dd>${dokumen.length ? amankan(dokumen.join(', ')) : '—'}</dd></div>
      </dl>

      ${l.immediate_actions ? bagianTeks('Tindakan segera oleh unit', l.immediate_actions) : ''}
      ${l.upt_commitments ? bagianTeks('Komitmen unit', l.upt_commitments
        + (l.commitment_due_at ? ` (tenggat ${l.commitment_due_at})` : '')) : ''}
      ${l.obstacles ? bagianTeks('Kendala di lapangan', l.obstacles) : ''}
      ${l.initial_conclusion ? bagianTeks('Kesimpulan awal petugas', l.initial_conclusion) : ''}

      <div class="siklus-bagian-kop" style="margin-top:14px">
        <span class="label-mono">Bukti</span>
        <span class="mini-teks samar-teks">${angka(bukti.length)} berkas</span>
        ${bolehUnggah ? `
          <label class="tbl kecil dorong" style="cursor:pointer">
            ${ikon('unduh')}Unggah bukti
            <input type="file" data-peran="bukti" multiple hidden>
          </label>` : ''}
      </div>
      ${bukti.length ? `
        <ul class="bukti-daftar">
          ${bukti.map((b) => `
            <li>
              ${ikon('arsip')}
              <span class="bukti-nama">
                <b>${amankan(b.file_name)}</b>
                <span class="mini-teks samar-teks">
                  ${amankan(b.evidence_type || 'Dokumen Pendukung')} ·
                  ${amankan(ukuranBerkas(b.size_bytes || 0))} ·
                  ${amankan(jarakWaktu(b.created_at))}
                </span>
              </span>
              <button class="tbl kecil samar dorong" data-buka-bukti="${amankan(b.id)}">Buka</button>
            </li>`).join('')}
        </ul>`
        : '<p class="ket">Belum ada bukti yang diunggah untuk laporan ini.</p>'}

      ${bolehNilai && l.status === 'Dikirim' ? `
        <div class="baris gap-6" style="margin-top:14px">
          ${tombol({ label: 'Terima laporan', ikon: 'centang', gaya: 'utama', kecil: true, aksi: 'terima-laporan' })}
          ${tombol({ label: 'Kembalikan', ikon: 'segar', kecil: true, aksi: 'kembalikan-laporan' })}
        </div>` : ''}
      ${l.reviewed_at ? `
        <p class="mini-teks samar-teks" style="margin-top:10px">
          Dinilai ${amankan(jarakWaktu(l.reviewed_at))} oleh ${amankan(l.reviewed_by || '—')}
          ${l.review_note ? ` — ${amankan(l.review_note)}` : ''}
        </p>` : ''}
    </div>`
}

function bagianTeks(judul, teks) {
  return `
    <div style="margin-top:11px">
      <div class="label-mono" style="color:var(--ink-4);margin-bottom:4px">${amankan(judul)}</div>
      <p class="kecil-teks" style="line-height:1.6;color:var(--ink-2)">${amankan(teks)}</p>
    </div>`
}

/* ------------------------------------------------------------------- borang */

function borangTugas() {
  const terbuka = keadaanLapangan.kasus.filter((k) => !['Selesai', 'Ditutup'].includes(k.status))
  return `
    <div class="siklus-rinci">
      <div class="kasus-kepala">
        <div class="kasus-kepala-teks">
          <span class="label-mono">Surat tugas baru</span>
          <h3>Terbitkan penugasan verifikasi lapangan</h3>
        </div>
        <button class="tbl kecil samar" data-aksi="batal-borang">${ikon('tutup')}Batal</button>
      </div>

      ${terbuka.length ? `
        <form class="borang-kisi" data-peran="borang-tugas">
          ${bidangPilih({
            nama: 'case_id', label: 'Kasus', nilai: '',
            opsi: terbuka.map((k) => ({
              nilai: k.id,
              teks: `${k.case_number} — ${ringkas(k.title, 60)}`,
            })),
            ket: 'Setiap penugasan selalu terikat pada satu kasus.',
          }).replace('<label class="bidang"', '<label class="bidang penuh"')}

          ${bidangSatuBaris({
            nama: 'assigned_to', label: 'Petugas', petunjuk: 'username petugas verifikasi',
            ket: 'Hanya yang tertulis di sini yang akan melihat penugasannya.',
          })}

          ${bidangSatuBaris({
            nama: 'assigned_team', label: 'Tim', nilai: 'Tim Verifikasi Lapangan',
          })}

          ${bidangPilih({ nama: 'priority', label: 'Prioritas', nilai: 'Sedang', opsi: PRIORITAS })}

          ${bidangSatuBaris({
            nama: 'due_at', label: 'Tenggat', jenis: 'date',
            ket: 'Penugasan tanpa tenggat tidak pernah muncul sebagai terlambat.',
          })}

          ${bidangTeks({
            nama: 'instruction', label: 'Instruksi', baris: 4,
            petunjuk: 'Apa yang harus diperiksa, siapa yang harus ditemui, dan apa yang harus dibawa pulang.',
          }).replace('<label class="bidang"', '<label class="bidang penuh"')}

          <div class="penuh">
            ${daftarBaris({
              nama: 'verification_questions',
              label: 'Pertanyaan verifikasi',
              nilai: PERTANYAAN_BAKU,
              ket: 'Lima pertanyaan bawaan sudah terisi. Sunting, tambah, atau kurangi sesuai perkaranya.',
            })}
          </div>
        </form>

        <div class="baris gap-6" style="margin-top:16px">
          ${tombol({
            label: 'Terbitkan surat tugas', ikon: 'kirim', gaya: 'utama',
            aksi: 'simpan-tugas', nonaktif: keadaanLapangan.sibuk,
          })}
        </div>`
        : kosong(
          'Belum ada kasus terbuka',
          'Penugasan verifikasi selalu terikat pada satu kasus. Bentuk kasusnya lebih dulu '
          + 'di halaman Kasus Intelijen.',
        )}
    </div>`
}

function borangLaporan(p) {
  const kasus = kasusDari(p.case_id)
  return `
    <div class="siklus-rinci">
      <div class="kasus-kepala">
        <div class="kasus-kepala-teks">
          <span class="label-mono">${amankan(p.assignment_number)}</span>
          <h3>Laporan verifikasi lapangan</h3>
          <p class="mini-teks samar-teks" style="margin-top:4px">
            ${amankan(kasus?.primary_upt || '')} — ${amankan(ringkas(kasus?.title || '', 80))}
          </p>
        </div>
        <button class="tbl kecil samar" data-aksi="batal-borang">${ikon('tutup')}Batal</button>
      </div>

      <div class="pesan" data-nada="aksen" style="margin-bottom:14px">
        ${ikon('info')}
        <div>
          <b>Laporan ini tidak mengubah status berita.</b> Temuan lapangan menjadi bahan
          evaluasi, bukan putusan atas benar-tidaknya sebuah pemberitaan. Yang berhak
          menyatakan berita tidak valid tetap analis pusat di Antrean Telaah.
        </div>
      </div>

      <form class="borang-kisi" data-peran="borang-laporan">
        ${bidangSatuBaris({ nama: 'visit_started_at', label: 'Kunjungan dimulai', jenis: 'datetime-local' })}
        ${bidangSatuBaris({ nama: 'visit_finished_at', label: 'Kunjungan selesai', jenis: 'datetime-local' })}

        ${bidangPilih({
          nama: 'finding_classification', label: 'Klasifikasi temuan',
          nilai: 'Belum dapat disimpulkan', opsi: NAMA_TEMUAN,
          ket: 'Sejauh mana fakta lapangan membenarkan pemberitaannya.',
        })}

        <div class="penuh">
          ${daftarBaris({ nama: 'officers', label: 'Petugas yang bertugas', petunjuk: 'nama dan jabatan' })}
        </div>
        <div class="penuh">
          ${daftarBaris({ nama: 'parties_met', label: 'Pihak yang ditemui', petunjuk: 'jabatan, bukan nama pribadi' })}
        </div>

        ${bidangTeks({
          nama: 'activity_summary', label: 'Ringkasan kegiatan', baris: 3,
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}

        ${bidangTeks({
          nama: 'facts_found', label: 'Fakta yang ditemukan', baris: 4,
          ket: 'Apa yang benar-benar dilihat dan dibaca di lokasi, bukan kesimpulannya.',
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}

        ${bidangTeks({
          nama: 'upt_explanation', label: 'Keterangan unit', baris: 3,
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}

        <div class="penuh">
          ${daftarBaris({ nama: 'documents_checked', label: 'Dokumen yang diperiksa' })}
        </div>

        ${bidangTeks({ nama: 'immediate_actions', label: 'Tindakan segera oleh unit', baris: 2 })}
        ${bidangTeks({ nama: 'obstacles', label: 'Kendala di lapangan', baris: 2 })}

        ${bidangTeks({
          nama: 'upt_commitments', label: 'Komitmen unit', baris: 2,
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}

        ${bidangSatuBaris({ nama: 'commitment_due_at', label: 'Tenggat komitmen', jenis: 'date' })}

        ${bidangTeks({
          nama: 'initial_conclusion', label: 'Kesimpulan awal', baris: 3,
          ket: 'Penilaian petugas atas apa yang ditemukannya. Boleh berbeda dari kesimpulan analis.',
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}
      </form>

      <div class="baris gap-6" style="margin-top:16px">
        ${tombol({
          label: 'Kirim laporan', ikon: 'kirim', gaya: 'utama',
          aksi: 'simpan-laporan', nonaktif: keadaanLapangan.sibuk,
        })}
        <span class="mini-teks samar-teks">
          Bukti foto dan dokumen diunggah setelah laporan terkirim.
        </span>
      </div>
    </div>`
}

/* ------------------------------------------------------------------ halaman */

export function halamanLapangan({ keadaan, isi }) {
  const peran = keadaan.profil?.role
  const saya = keadaan.profil?.username || ''
  const bolehTugas = punyaIzin(peran, 'tugaskan_lapangan')
  const bolehLapor = punyaIzin(peran, 'kirim_laporan_lapangan')

  function gambar() {
    if (keadaanLapangan.galat) {
      isi.innerHTML = kartu({
        isi: `<div class="pesan" data-nada="kritis">${ikon('peringatan')}
          <div><b>Daftar penugasan gagal dimuat.</b> ${amankan(keadaanLapangan.galat)}</div></div>`,
      })
      return
    }
    if (!keadaanLapangan.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:420px"></div>' })
      return
    }

    const dipilih = keadaanLapangan.penugasan.find((p) => p.id === keadaanLapangan.dipilih)
    const aktif = keadaanLapangan.penugasan.filter(
      (p) => ['Ditugaskan', 'Diterima', 'Berjalan'].includes(p.status)).length

    const kanan = keadaanLapangan.borang === 'tugas-baru' ? borangTugas()
      : keadaanLapangan.borang === 'laporan' && dipilih ? borangLaporan(dipilih)
        : `<div class="siklus-rinci">${dipilih
          ? rincianPenugasan(dipilih, { bolehTugas, bolehLapor, saya })
          : belumDipilih(
            'Pilih satu penugasan di sebelah kiri',
            'Instruksi, pertanyaan verifikasi, laporan lapangan, dan buktinya muncul di sini.',
          )}</div>`

    isi.innerHTML = `
      <div class="tumpuk">
        <div class="bilah-alat">
          <select class="pilihan" data-saring="saringStatus" aria-label="Saring status penugasan"
                  style="width:auto;min-width:170px">
            ${['Semua status', ...NAMA_STATUS_PENUGASAN].map((s) =>
              `<option${s === keadaanLapangan.saringStatus ? ' selected' : ''}>${amankan(s)}</option>`).join('')}
          </select>
          <div class="dorong baris gap-6">
            <span class="mini-teks samar-teks">
              ${angka(aktif)} berjalan dari ${angka(keadaanLapangan.penugasan.length)} penugasan
            </span>
            ${bolehTugas ? tombol({
              label: 'Surat tugas baru', ikon: 'tambah', gaya: 'utama', kecil: true, aksi: 'tugas-baru',
            }) : ''}
          </div>
        </div>

        <div class="siklus-tata">
          <div class="siklus-antrean">
            <div class="siklus-antrean-kop">
              <span class="label-mono">Penugasan</span>
              ${bolehLapor && !bolehTugas ? '<span class="mini-teks samar-teks dorong">milik Anda</span>' : ''}
            </div>
            <ul>${antrean()}</ul>
          </div>
          ${kanan}
        </div>
      </div>`

    pasangDaftarBaris(isi)
  }

  /* --------------------------------------------------------------- tindakan */

  async function simpanTugas() {
    const borang = isi.querySelector('[data-peran="borang-tugas"]')
    if (!borang) return
    const nilai = bacaBorang(borang)

    if (!nilai.assigned_to?.trim()) { roti('Petugas harus diisi.', 'sedang'); return }

    keadaanLapangan.sibuk = true
    gambar()
    try {
      const baris = await tulisSiklus('penugasan', {
        case_id: nilai.case_id,
        assigned_to: nilai.assigned_to.trim(),
        assigned_team: nilai.assigned_team?.trim() || 'Tim Verifikasi Lapangan',
        instruction: nilai.instruction?.trim() || null,
        verification_questions: bacaDaftarBaris(borang, 'verification_questions'),
        priority: nilai.priority,
        due_at: nilai.due_at ? new Date(`${nilai.due_at}T17:00:00`).toISOString() : null,
        status: 'Ditugaskan',
        assigned_by: penulis(),
        ...(keadaan.demo ? { assignment_number: `ST-${Date.now().toString().slice(-6)}` } : {}),
      })
      const tugas = Array.isArray(baris) ? baris[0] : baris
      keadaanLapangan.penugasan.unshift(tugas)
      keadaanLapangan.dipilih = tugas.id
      keadaanLapangan.borang = null

      // Kasus ikut naik ke tahap verifikasi. Ini satu-satunya kenaikan tahap
      // yang otomatis di seluruh siklus, dan sah karena tidak menilai apa pun:
      // yang dinyatakan hanyalah "sudah ada yang turun ke lapangan", dan itu
      // memang baru saja terjadi.
      const kasus = kasusDari(tugas.case_id)
      if (kasus && kasus.status === 'Terdeteksi') {
        await ubahSiklus('kasus', kasus.id, { status: 'Verifikasi Lapangan' })
        kasus.status = 'Verifikasi Lapangan'
      }

      roti(`Surat tugas ${tugas.assignment_number || ''} terbit.`, 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      console.error(galat)
    } finally {
      keadaanLapangan.sibuk = false
      gambar()
    }
  }

  async function simpanLaporan(p) {
    const borang = isi.querySelector('[data-peran="borang-laporan"]')
    if (!borang) return
    const nilai = bacaBorang(borang)

    if (!nilai.facts_found?.trim()) {
      roti('Fakta yang ditemukan tidak boleh kosong — itulah inti laporan ini.', 'sedang', 5000)
      return
    }

    keadaanLapangan.sibuk = true
    gambar()
    try {
      const baris = await tulisSiklus('laporanLapangan', {
        assignment_id: p.id,
        case_id: p.case_id,
        report_type: 'Laporan Lengkap',
        visit_started_at: nilai.visit_started_at ? new Date(nilai.visit_started_at).toISOString() : null,
        visit_finished_at: nilai.visit_finished_at ? new Date(nilai.visit_finished_at).toISOString() : null,
        officers: bacaDaftarBaris(borang, 'officers'),
        parties_met: bacaDaftarBaris(borang, 'parties_met'),
        documents_checked: bacaDaftarBaris(borang, 'documents_checked'),
        activity_summary: nilai.activity_summary?.trim() || null,
        facts_found: nilai.facts_found.trim(),
        upt_explanation: nilai.upt_explanation?.trim() || null,
        obstacles: nilai.obstacles?.trim() || null,
        immediate_actions: nilai.immediate_actions?.trim() || null,
        upt_commitments: nilai.upt_commitments?.trim() || null,
        commitment_due_at: nilai.commitment_due_at || null,
        finding_classification: nilai.finding_classification,
        initial_conclusion: nilai.initial_conclusion?.trim() || null,
        status: 'Dikirim',
        submitted_by: penulis(),
        submitted_at: new Date().toISOString(),
      })
      keadaanLapangan.laporan.unshift(Array.isArray(baris) ? baris[0] : baris)

      await ubahSiklus('penugasan', p.id, {
        status: 'Selesai', completed_at: new Date().toISOString(),
      })
      Object.assign(p, { status: 'Selesai', completed_at: new Date().toISOString() })

      keadaanLapangan.borang = null
      roti('Laporan lapangan terkirim.', 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      console.error(galat)
    } finally {
      keadaanLapangan.sibuk = false
      gambar()
    }
  }

  async function ubahStatusTugas(p, status) {
    try {
      const perubahan = { status }
      if (status === 'Diterima') perubahan.accepted_at = new Date().toISOString()
      await ubahSiklus('penugasan', p.id, perubahan)
      Object.assign(p, perubahan)
      roti(`Penugasan ditandai "${status}".`, 'positif')
      gambar()
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    }
  }

  async function nilaiLaporan(l, terima) {
    try {
      const perubahan = {
        status: terima ? 'Diterima' : 'Dikembalikan',
        reviewed_by: penulis(),
        reviewed_at: new Date().toISOString(),
      }
      await ubahSiklus('laporanLapangan', l.id, perubahan)
      Object.assign(l, perubahan)

      if (terima) {
        const kasus = kasusDari(l.case_id)
        if (kasus && ['Terdeteksi', 'Verifikasi Lapangan'].includes(kasus.status)) {
          await ubahSiklus('kasus', kasus.id, { status: 'Evaluasi' })
          kasus.status = 'Evaluasi'
        }
      }
      roti(terima ? 'Laporan diterima. Kasus masuk tahap evaluasi.' : 'Laporan dikembalikan.', 'positif')
      gambar()
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    }
  }

  async function unggah(berkasDaftar, l) {
    keadaanLapangan.sibuk = true
    try {
      for (const berkas of berkasDaftar) {
        const { jalur, ukuran } = await unggahBerkas('field-evidence', l.case_id, berkas)
        const baris = await tulisSiklus('bukti', {
          report_id: l.id,
          case_id: l.case_id,
          file_name: berkas.name,
          storage_path: jalur,
          mime_type: berkas.type || 'application/octet-stream',
          size_bytes: ukuran,
          evidence_type: JENIS_BUKTI[0],
          verification_status: 'Belum Diverifikasi',
          uploaded_by: penulis(),
        })
        keadaanLapangan.bukti.push(Array.isArray(baris) ? baris[0] : baris)
      }
      roti(`${angka(berkasDaftar.length)} berkas bukti tersimpan.`, 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      console.error(galat)
    } finally {
      keadaanLapangan.sibuk = false
      gambar()
    }
  }

  /* ---------------------------------------------------------------- penyimak */

  isi.addEventListener('click', async (ev) => {
    const pilih = ev.target.closest('[data-pilih]')?.dataset.pilih
    if (pilih) {
      keadaanLapangan.dipilih = pilih
      keadaanLapangan.borang = null
      gambar()
      return
    }

    const bukaBukti = ev.target.closest('[data-buka-bukti]')?.dataset.bukaBukti
    if (bukaBukti) {
      const b = keadaanLapangan.bukti.find((x) => x.id === bukaBukti)
      if (!b) return
      if (keadaan.demo) { roti('Mode peragaan tidak menyimpan berkas sungguhan.', 'sedang'); return }
      try {
        const url = await tautanBerkas('field-evidence', b.storage_path)
        if (url) window.open(url, '_blank', 'noopener')
        else roti('Peladen tidak mengembalikan alamat berkas.', 'kritis')
      } catch (galat) { roti(pesanRamah(galat), 'kritis', 5000) }
      return
    }

    const p = keadaanLapangan.penugasan.find((x) => x.id === keadaanLapangan.dipilih)
    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (aksi === 'tugas-baru') { keadaanLapangan.borang = 'tugas-baru'; gambar() }
    else if (aksi === 'batal-borang') { keadaanLapangan.borang = null; gambar() }
    else if (aksi === 'buka-laporan') { keadaanLapangan.borang = 'laporan'; gambar() }
    else if (aksi === 'simpan-tugas') simpanTugas()
    else if (aksi === 'simpan-laporan' && p) simpanLaporan(p)
    else if (aksi === 'terima-tugas' && p) ubahStatusTugas(p, 'Diterima')
    else if (aksi === 'mulai-tugas' && p) ubahStatusTugas(p, 'Berjalan')
    else if ((aksi === 'terima-laporan' || aksi === 'kembalikan-laporan') && p) {
      const l = laporanDari(p.id)
      if (l) nilaiLaporan(l, aksi === 'terima-laporan')
    }
  })

  isi.addEventListener('change', (ev) => {
    if (ev.target.dataset.peran === 'bukti') {
      const p = keadaanLapangan.penugasan.find((x) => x.id === keadaanLapangan.dipilih)
      const l = p && laporanDari(p.id)
      if (l && ev.target.files?.length) unggah([...ev.target.files], l)
      return
    }
    const bidangSaring = ev.target.dataset.saring
    if (!bidangSaring) return
    keadaanLapangan[bidangSaring] = ev.target.value
    gambar()
  })

  /* ------------------------------------------------------------------- muat */

  gambar()
  muat(keadaan)
    .then(() => {
      if (!keadaanLapangan.dipilih) keadaanLapangan.dipilih = keadaanLapangan.penugasan[0]?.id || null
      gambar()
    })
    .catch((galat) => {
      keadaanLapangan.galat = pesanRamah(galat)
      gambar()
    })

  return {
    judul: 'Verifikasi Lapangan',
    sub: bolehTugas
      ? 'Surat tugas verifikasi dan laporan yang masuk dari lapangan'
      : 'Penugasan verifikasi yang menjadi tanggung jawab Anda',
  }
}
