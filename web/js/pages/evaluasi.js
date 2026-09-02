/**
 * Evaluasi dan Rekomendasi.
 *
 * Tempat dua sumber yang saling bertentangan dipertemukan: apa yang ditulis
 * media, dan apa yang ditemukan petugas di lokasi. Keduanya ditaruh
 * berdampingan di layar — bukan diringkas menjadi satu paragraf — sebab yang
 * bernilai justru selisihnya. Sebuah unit yang diberitakan kehilangan sepuluh
 * warga binaan dan ternyata kehilangan tiga tidak sedang menghadapi kabar
 * bohong; ia menghadapi kabar yang benar dengan angka yang salah, dan dua
 * keadaan itu ditangani dengan cara yang sama sekali berbeda.
 *
 * Tiga keputusan yang menentukan isi berkas ini:
 *
 *   Matriks penyandingan disimpan sebagai baris, bukan sebagai paragraf.
 *   Setiap aspek punya barisnya sendiri — apa kata media, apa kata lapangan,
 *   dan cocok atau tidak. Paragraf bisa ditulis sedemikian rupa sehingga
 *   selisihnya menghilang; tabel tidak bisa.
 *
 *   Analisis yang sudah diverifikasi tidak bisa disunting lagi. Itu bukan
 *   kekakuan yang dibuat-buat: policy `case_analyses_update` di basis data
 *   menolaknya, dan halaman ini menyembunyikan tombolnya supaya penolakan itu
 *   tidak muncul sebagai galat merah setelah seseorang mengetik sepuluh menit.
 *   Yang perlu diubah sesudah verifikasi dibuat sebagai versi baru.
 *
 *   Rekomendasi berdiri sebagai baris tersendiri, bukan sebagai daftar di
 *   dalam analisis. Pimpinan memutuskan per rekomendasi — menyetujui dua dari
 *   empat adalah putusan yang sah dan sering terjadi — dan itu mustahil bila
 *   keempatnya tersimpan sebagai satu blok teks.
 */

import { kartu, keping, kosong, tombol, roti } from '../ui/komponen.js'
import { amankan, angka, ringkas, jarakWaktu, tanggalJam } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { pesanRamah } from '../lib/api.js'
import { punyaIzin } from '../lib/peran.js'
import {
  VALIDITAS, DAMPAK_REPUTASI, DAMPAK_OPERASIONAL, DAMPAK_KEPATUHAN, RISIKO_ESKALASI,
  JENIS_REKOMENDASI, PRIORITAS, STATUS_ANALISIS, statusKasus, nadaRekomendasi,
  nadaTemuan, nadaPrioritas, bobotDampak,
} from '../lib/siklus.js'
import {
  bacaSiklus, tulisSiklus, ubahSiklus, siapkanDemo, penulis,
} from '../lib/siklus-data.js'
import {
  barisAntrean, belumDipilih, bidangTeks, bidangPilih, bidangSatuBaris,
  daftarBaris, bacaDaftarBaris, pasangDaftarBaris, bacaBorang, kepingTenggat,
} from '../ui/siklus-ui.js'

const keadaanEvaluasi = {
  dimuat: false,
  sibuk: false,
  galat: null,
  kasus: [],
  laporan: [],
  analisis: [],
  rekomendasi: [],
  dipilih: null,
  /** 'analisis' | 'rekomendasi' | null */
  borang: null,
  hanyaSiap: true,
}

/* ------------------------------------------------------------------- muat */

async function muat(keadaan) {
  if (keadaan.demo) siapkanDemo(keadaan.berita || [])

  const [kasus, laporan, analisis, rekomendasi] = await Promise.all([
    bacaSiklus('kasus', { urut: 'created_at.desc' }),
    bacaSiklus('laporanLapangan'),
    bacaSiklus('analisis', { urut: 'created_at.desc' }),
    bacaSiklus('rekomendasi', { urut: 'created_at.asc' }),
  ])

  Object.assign(keadaanEvaluasi, { kasus, laporan, analisis, rekomendasi, dimuat: true })
}

const analisisDari = (kasusId) => keadaanEvaluasi.analisis
  .filter((a) => a.case_id === kasusId)
  .sort((a, b) => (b.analysis_version || 0) - (a.analysis_version || 0))[0]

const rekomendasiDari = (kasusId) => keadaanEvaluasi.rekomendasi.filter((r) => r.case_id === kasusId)
const laporanDari = (kasusId) => keadaanEvaluasi.laporan.filter((l) => l.case_id === kasusId)

/* ------------------------------------------------------------------ antrean */

/**
 * Kasus yang layak dievaluasi.
 *
 * Bawaannya hanya yang sudah punya laporan lapangan diterima — evaluasi tanpa
 * fakta lapangan adalah pembacaan ulang berita, dan pembacaan ulang berita
 * sudah dikerjakan mesin klasifikasi. Saringnya bisa dimatikan, sebab ada
 * perkara yang memang tidak menuntut kunjungan: pemberitaan yang seluruhnya
 * salah alamat, misalnya.
 */
function daftarKasus() {
  return keadaanEvaluasi.kasus
    .filter((k) => {
      if (!keadaanEvaluasi.hanyaSiap) return true
      return laporanDari(k.id).some((l) => l.status === 'Diterima')
        || ['Evaluasi', 'Menunggu Keputusan'].includes(k.status)
    })
    .sort((a, b) => {
      // Yang paling berat dampaknya lebih dulu, memakai bobot yang sama dengan
      // yang dipakai antrean Keputusan Pimpinan.
      const bA = bobotDampak(analisisDari(a.id) || {})
      const bB = bobotDampak(analisisDari(b.id) || {})
      if (bA !== bB) return bB - bA
      return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    })
}

function antrean() {
  const daftar = daftarKasus()
  if (!daftar.length) {
    return `<li><p class="ket" style="padding:16px 10px">
      Belum ada kasus yang laporan lapangannya diterima. Matikan saringan di atas untuk
      melihat seluruh kasus.</p></li>`
  }

  return daftar.map((k) => {
    const a = analisisDari(k.id)
    const rek = rekomendasiDari(k.id)
    const s = statusKasus(k.status)
    return barisAntrean({
      id: k.id,
      nomor: k.case_number,
      judul: k.title,
      ket: `${k.primary_upt || '—'} · ${a ? `analisis v${a.analysis_version} ${a.status.toLowerCase()}` : 'belum dianalisis'}`,
      nada: a ? (a.status === 'Terverifikasi' ? 'positif' : 'sedang') : s.nada,
      label: a ? `Analisis ${a.status}` : s.nama,
      angka: rek.length,
      satuan: 'rekomendasi',
      terpilih: k.id === keadaanEvaluasi.dipilih,
    })
  }).join('')
}

/* ------------------------------------------------------------------ rincian */

function rincian(kasus, bolehAnalisis, bolehRekomendasi) {
  const a = analisisDari(kasus.id)
  const laporan = laporanDari(kasus.id)
  const rek = rekomendasiDari(kasus.id)
  const terkunci = Boolean(a?.verified_at)

  return `
    <div class="kasus-kepala">
      <div class="kasus-kepala-teks">
        <span class="label-mono">${amankan(kasus.case_number)}</span>
        <h3>${amankan(kasus.title)}</h3>
        <p class="mini-teks samar-teks" style="margin-top:5px">
          ${amankan(kasus.primary_upt || '—')} · ${amankan(kasus.issue_type || '')}
        </p>
      </div>
      <div class="baris gap-6">
        ${bolehAnalisis && !terkunci ? tombol({
          label: a ? 'Sunting analisis' : 'Susun analisis',
          ikon: a ? 'pengaturan' : 'tambah', gaya: 'utama', kecil: true, aksi: 'buka-analisis',
        }) : ''}
        ${bolehAnalisis && terkunci ? tombol({
          label: 'Versi baru', ikon: 'tambah', kecil: true, aksi: 'analisis-baru',
        }) : ''}
      </div>
    </div>

    ${laporan.length ? '' : `
      <div class="pesan" data-nada="sedang" style="margin-bottom:14px">
        ${ikon('peringatan')}
        <div>
          <b>Belum ada laporan lapangan pada kasus ini.</b> Kolom fakta lapangan akan kosong,
          dan penyandingannya menjadi pembacaan ulang berita — bukan evaluasi.
        </div>
      </div>`}

    ${a ? bagianAnalisis(a, laporan, terkunci, bolehAnalisis) : `
      <div class="siklus-bagian">
        ${kosong('Belum ada analisis',
          'Susun analisis untuk menyandingkan narasi media dengan fakta lapangan, menilai dampaknya, '
          + 'dan menuliskan akar masalahnya.')}
      </div>`}

    <div class="siklus-bagian">
      <div class="siklus-bagian-kop">
        <span class="label-mono">Rekomendasi</span>
        <span class="mini-teks samar-teks">${angka(rek.length)} butir</span>
        ${bolehRekomendasi ? `
          <button class="tbl kecil dorong" data-aksi="buka-rekomendasi">
            ${ikon('tambah')}Tambah rekomendasi</button>` : ''}
      </div>

      ${rek.length ? `
        <ul class="siklus-daftar">
          ${rek.map((r) => `
            <li class="siklus-butir">
              <div class="siklus-butir-kop">
                ${keping(r.recommendation_type, 'aksen', true)}
                ${keping(r.status, nadaRekomendasi(r.status))}
                ${keping(r.priority || 'Sedang', nadaPrioritas(r.priority), true)}
                ${r.due_at ? kepingTenggat(r.due_at, r.status === 'Selesai') : ''}
              </div>
              <p>${amankan(r.recommendation)}</p>
              <span class="mini-teks samar-teks">
                Penanggung jawab: ${amankan(r.responsible_party || 'belum ditetapkan')}
                · diusulkan ${amankan(jarakWaktu(r.created_at))} oleh ${amankan(r.created_by || '—')}
                ${r.decided_at ? ` · diputus ${amankan(jarakWaktu(r.decided_at))} oleh ${amankan(r.decided_by || '—')}` : ''}
              </span>
              ${r.decision_note ? `
                <span class="mini-teks" style="color:var(--ink-2)">
                  <b>Catatan pimpinan:</b> ${amankan(r.decision_note)}
                </span>` : ''}
            </li>`).join('')}
        </ul>`
        : `<p class="ket">Belum ada rekomendasi. Analisis tanpa rekomendasi tidak pernah sampai
           ke meja pimpinan — yang diputuskan pimpinan adalah rekomendasinya, bukan analisisnya.</p>`}

      ${rek.some((r) => r.status === 'Diusulkan') && a?.verified_at ? `
        <div class="baris gap-6" style="margin-top:13px">
          ${tombol({
            label: 'Ajukan ke pimpinan', ikon: 'kirim', gaya: 'utama', kecil: true,
            aksi: 'ajukan-keputusan',
          })}
          <span class="mini-teks samar-teks">
            Kasus berpindah ke status "Menunggu Keputusan" dan muncul di antrean Keputusan Pimpinan.
          </span>
        </div>` : ''}
    </div>`
}

function bagianAnalisis(a, laporan, terkunci, bolehAnalisis) {
  const matriks = Array.isArray(a.comparison_matrix) ? a.comparison_matrix : []
  const akar = Array.isArray(a.root_causes) ? a.root_causes : []
  const faktaLapangan = a.field_facts
    || laporan.map((l) => l.facts_found).filter(Boolean).join('\n\n')
    || 'Belum ada fakta lapangan yang tercatat.'

  return `
    <div class="siklus-bagian">
      <div class="siklus-bagian-kop">
        <span class="label-mono">Analisis versi ${angka(a.analysis_version || 1)}</span>
        ${keping(a.status, a.status === 'Terverifikasi' ? 'positif' : 'sedang')}
        <span class="mini-teks samar-teks dorong">
          ${amankan(jarakWaktu(a.created_at))} oleh ${amankan(a.created_by || '—')}
          ${a.verified_at ? ` · diverifikasi ${amankan(tanggalJam(a.verified_at))}` : ''}
        </span>
      </div>

      <div class="sanding" style="margin-bottom:13px">
        <div class="sanding-kolom">
          <h4>Narasi media</h4>
          <p>${amankan(a.media_narrative || 'Belum diisi.')}</p>
        </div>
        <div class="sanding-kolom">
          <h4>Fakta lapangan</h4>
          <p>${amankan(faktaLapangan)}</p>
        </div>
      </div>

      ${matriks.length ? `
        <div class="tabel-bungkus" style="margin-bottom:13px">
          <table class="tabel">
            <thead><tr><th>Aspek</th><th>Kata media</th><th>Kata lapangan</th><th>Sesuai</th></tr></thead>
            <tbody>
              ${matriks.map((m) => `
                <tr>
                  <td class="kecil">${amankan(m.aspek || '—')}</td>
                  <td class="kecil">${amankan(m.media || '—')}</td>
                  <td class="kecil">${amankan(m.lapangan || '—')}</td>
                  <td>${keping(m.sesuai || '—',
                    /^ya$/i.test(m.sesuai || '') ? 'positif' : /^tidak$/i.test(m.sesuai || '') ? 'kritis' : 'netral',
                    true)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

      <div class="kisi kisi-4" style="gap:10px;margin-bottom:13px">
        ${ubinNilai('Validitas informasi', a.information_validity, nadaTemuan(
          a.information_validity === 'Terverifikasi Benar' ? 'Terbukti'
            : a.information_validity === 'Terbantahkan' ? 'Tidak Terbukti' : 'Terbukti Sebagian'))}
        ${ubinNilai('Dampak reputasi', a.reputation_impact,
          ['Berat', 'Sangat Berat'].includes(a.reputation_impact) ? 'kritis' : 'sedang')}
        ${ubinNilai('Dampak operasional', a.operational_impact,
          a.operational_impact === 'Tidak Ada' ? 'positif' : 'sedang')}
        ${ubinNilai('Risiko eskalasi', a.media_escalation_risk,
          ['Menanjak', 'Viral'].includes(a.media_escalation_risk) ? 'kritis' : 'rendah')}
      </div>

      ${akar.length ? `
        <div style="margin-bottom:11px">
          <div class="label-mono" style="color:var(--ink-4);margin-bottom:5px">Akar masalah</div>
          <ul class="tanya-daftar" style="list-style:disc">
            ${akar.map((t) => `<li>${amankan(t)}</li>`).join('')}
          </ul>
        </div>` : ''}

      ${a.final_analysis ? `
        <div>
          <div class="label-mono" style="color:var(--ink-4);margin-bottom:4px">Kesimpulan analis</div>
          <p class="kecil-teks" style="line-height:1.6;color:var(--ink-2)">${amankan(a.final_analysis)}</p>
        </div>` : ''}

      ${bolehAnalisis && !terkunci ? `
        <div class="baris gap-6" style="margin-top:13px">
          ${tombol({ label: 'Verifikasi analisis', ikon: 'centang', kecil: true, aksi: 'verifikasi-analisis' })}
          <span class="mini-teks samar-teks">
            Sesudah diverifikasi, analisis ini tidak dapat disunting lagi — perubahan berikutnya
            menjadi versi baru.
          </span>
        </div>` : ''}
    </div>`
}

function ubinNilai(label, nilai, nada) {
  return `
    <div class="ubin" data-nada="${amankan(nada || 'netral')}">
      <div class="ubin-label">${amankan(label)}</div>
      <div style="font-size:13px;font-weight:600;margin:3px 0 2px">${amankan(nilai || '—')}</div>
    </div>`
}

/* ------------------------------------------------------------------- borang */

function borangAnalisis(kasus, a, laporan) {
  const matriks = Array.isArray(a?.comparison_matrix) ? a.comparison_matrix : []
  const faktaBawaan = a?.field_facts
    || laporan.map((l) => l.facts_found).filter(Boolean).join('\n\n')

  return `
    <div class="siklus-rinci">
      <div class="kasus-kepala">
        <div class="kasus-kepala-teks">
          <span class="label-mono">${amankan(kasus.case_number)}</span>
          <h3>${a?.id ? 'Sunting analisis' : 'Susun analisis'}</h3>
        </div>
        <button class="tbl kecil samar" data-aksi="batal-borang">${ikon('tutup')}Batal</button>
      </div>

      <form class="borang-kisi" data-peran="borang-analisis">
        ${bidangTeks({
          nama: 'media_narrative', label: 'Narasi media', baris: 4,
          nilai: a?.media_narrative || '',
          ket: 'Bagaimana media membingkai perkara ini — bukan ringkasan beritanya.',
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}

        ${bidangTeks({
          nama: 'field_facts', label: 'Fakta lapangan', baris: 4,
          nilai: faktaBawaan || '',
          ket: laporan.length
            ? 'Terisi otomatis dari laporan lapangan yang sudah masuk. Boleh disunting.'
            : 'Belum ada laporan lapangan; isi manual bila faktanya diperoleh lewat jalur lain.',
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}

        ${bidangPilih({
          nama: 'information_validity', label: 'Validitas informasi',
          nilai: a?.information_validity || 'Belum terverifikasi', opsi: VALIDITAS,
        })}
        ${bidangPilih({
          nama: 'reputation_impact', label: 'Dampak reputasi',
          nilai: a?.reputation_impact || 'Sedang', opsi: DAMPAK_REPUTASI,
        })}
        ${bidangPilih({
          nama: 'operational_impact', label: 'Dampak operasional',
          nilai: a?.operational_impact || 'Terbatas', opsi: DAMPAK_OPERASIONAL,
        })}
        ${bidangPilih({
          nama: 'compliance_impact', label: 'Dampak kepatuhan',
          nilai: a?.compliance_impact || 'Perlu pemeriksaan', opsi: DAMPAK_KEPATUHAN,
        })}
        ${bidangPilih({
          nama: 'media_escalation_risk', label: 'Risiko eskalasi media',
          nilai: a?.media_escalation_risk || 'Stabil', opsi: RISIKO_ESKALASI,
        })}
        ${bidangPilih({
          nama: 'status', label: 'Status analisis',
          nilai: a?.status || 'Draf', opsi: STATUS_ANALISIS,
        })}

        <div class="penuh">
          ${daftarBaris({
            nama: 'root_causes', label: 'Akar masalah',
            nilai: Array.isArray(a?.root_causes) ? a.root_causes : [],
            petunjuk: 'Sebab, bukan gejala',
            ket: 'Yang ditulis di sini menjadi dasar rekomendasi. Gejala menghasilkan rekomendasi yang tidak menyelesaikan apa pun.',
          })}
        </div>

        ${bidangTeks({
          nama: 'final_analysis', label: 'Kesimpulan analis', baris: 4,
          nilai: a?.final_analysis || '',
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}
      </form>

      <div class="siklus-bagian">
        <div class="siklus-bagian-kop">
          <span class="label-mono">Matriks penyandingan</span>
          <button class="tbl kecil samar dorong" data-aksi="tambah-matriks">
            ${ikon('tambah')}Tambah aspek</button>
        </div>
        <div data-peran="matriks">
          ${(matriks.length ? matriks : [{}]).map((m, i) => barisMatriks(m, i)).join('')}
        </div>
        <p class="mini-teks samar-teks" style="margin-top:8px">
          Satu baris per aspek yang dibandingkan. Aspek yang kosong tidak disimpan.
        </p>
      </div>

      <div class="baris gap-6" style="margin-top:16px">
        ${tombol({
          label: 'Simpan analisis', ikon: 'centang', gaya: 'utama',
          aksi: 'simpan-analisis', nonaktif: keadaanEvaluasi.sibuk,
        })}
      </div>
    </div>`
}

function barisMatriks(m = {}, i = 0) {
  return `
    <div class="matriks-baris" data-baris="${i}">
      <input class="masukan" data-kolom="aspek" placeholder="Aspek" value="${amankan(m.aspek || '')}">
      <input class="masukan" data-kolom="media" placeholder="Kata media" value="${amankan(m.media || '')}">
      <input class="masukan" data-kolom="lapangan" placeholder="Kata lapangan" value="${amankan(m.lapangan || '')}">
      <select class="pilihan" data-kolom="sesuai">
        ${['Ya', 'Tidak', 'Tidak disebutkan media'].map((o) =>
          `<option${o === m.sesuai ? ' selected' : ''}>${amankan(o)}</option>`).join('')}
      </select>
    </div>`
}

function borangRekomendasi(kasus) {
  return `
    <div class="siklus-rinci">
      <div class="kasus-kepala">
        <div class="kasus-kepala-teks">
          <span class="label-mono">${amankan(kasus.case_number)}</span>
          <h3>Rekomendasi baru</h3>
        </div>
        <button class="tbl kecil samar" data-aksi="batal-borang">${ikon('tutup')}Batal</button>
      </div>

      <form class="borang-kisi" data-peran="borang-rekomendasi">
        ${bidangPilih({
          nama: 'recommendation_type', label: 'Jenis tindakan',
          nilai: JENIS_REKOMENDASI[0], opsi: JENIS_REKOMENDASI,
        })}
        ${bidangPilih({ nama: 'priority', label: 'Prioritas', nilai: 'Sedang', opsi: PRIORITAS })}
        ${bidangSatuBaris({
          nama: 'responsible_party', label: 'Penanggung jawab',
          petunjuk: 'Unit, kantor wilayah, atau direktorat',
        })}
        ${bidangSatuBaris({ nama: 'due_at', label: 'Tenggat', jenis: 'date' })}
        ${bidangTeks({
          nama: 'recommendation', label: 'Rumusan rekomendasi', baris: 4,
          ket: 'Satu tindakan yang bisa dikerjakan dan bisa dinyatakan selesai. '
            + 'Rekomendasi yang tidak bisa dinyatakan selesai tidak pernah selesai.',
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}
      </form>

      <div class="baris gap-6" style="margin-top:16px">
        ${tombol({
          label: 'Simpan rekomendasi', ikon: 'centang', gaya: 'utama',
          aksi: 'simpan-rekomendasi', nonaktif: keadaanEvaluasi.sibuk,
        })}
      </div>
    </div>`
}

/* ------------------------------------------------------------------ halaman */

export function halamanEvaluasi({ keadaan, isi }) {
  const peran = keadaan.profil?.role
  const bolehAnalisis = punyaIzin(peran, 'analisis_kasus')
  const bolehRekomendasi = punyaIzin(peran, 'kelola_rekomendasi')

  function gambar() {
    if (keadaanEvaluasi.galat) {
      isi.innerHTML = kartu({
        isi: `<div class="pesan" data-nada="kritis">${ikon('peringatan')}
          <div><b>Data evaluasi gagal dimuat.</b> ${amankan(keadaanEvaluasi.galat)}</div></div>`,
      })
      return
    }
    if (!keadaanEvaluasi.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:420px"></div>' })
      return
    }

    const kasus = keadaanEvaluasi.kasus.find((k) => k.id === keadaanEvaluasi.dipilih)
    const menunggu = keadaanEvaluasi.kasus.filter((k) => k.status === 'Evaluasi').length

    const kanan = keadaanEvaluasi.borang === 'analisis' && kasus
      ? borangAnalisis(kasus, analisisDari(kasus.id), laporanDari(kasus.id))
      : keadaanEvaluasi.borang === 'analisis-baru' && kasus
        ? borangAnalisis(kasus, null, laporanDari(kasus.id))
        : keadaanEvaluasi.borang === 'rekomendasi' && kasus
          ? borangRekomendasi(kasus)
          : `<div class="siklus-rinci">${kasus
            ? rincian(kasus, bolehAnalisis, bolehRekomendasi)
            : belumDipilih(
              'Pilih satu kasus di sebelah kiri',
              'Penyandingan narasi media dengan fakta lapangan, penilaian dampak, akar masalah, '
              + 'dan rekomendasinya muncul di sini.',
            )}</div>`

    isi.innerHTML = `
      <div class="tumpuk">
        <div class="bilah-alat">
          <button class="tbl kecil${keadaanEvaluasi.hanyaSiap ? ' utama' : ''}"
                  data-aksi="saring-siap" aria-pressed="${keadaanEvaluasi.hanyaSiap}">
            ${ikon('saring')}Hanya yang siap dievaluasi
          </button>
          <div class="dorong baris gap-6">
            <span class="mini-teks samar-teks">
              ${angka(menunggu)} kasus di tahap evaluasi
            </span>
          </div>
        </div>

        <div class="siklus-tata">
          <div class="siklus-antrean">
            <div class="siklus-antrean-kop"><span class="label-mono">Kasus</span></div>
            <ul>${antrean()}</ul>
          </div>
          ${kanan}
        </div>
      </div>`

    pasangDaftarBaris(isi)
  }

  /* --------------------------------------------------------------- tindakan */

  function bacaMatriks() {
    const wadah = isi.querySelector('[data-peran="matriks"]')
    if (!wadah) return []
    return [...wadah.querySelectorAll('.matriks-baris')]
      .map((b) => {
        const nilai = {}
        for (const k of b.querySelectorAll('[data-kolom]')) nilai[k.dataset.kolom] = k.value.trim()
        return nilai
      })
      .filter((m) => m.aspek)
  }

  async function simpanAnalisis(kasus) {
    const borang = isi.querySelector('[data-peran="borang-analisis"]')
    if (!borang) return
    const nilai = bacaBorang(borang)

    keadaanEvaluasi.sibuk = true
    gambar()
    try {
      const lama = keadaanEvaluasi.borang === 'analisis' ? analisisDari(kasus.id) : null
      const isian = {
        media_narrative: nilai.media_narrative?.trim() || null,
        field_facts: nilai.field_facts?.trim() || null,
        comparison_matrix: bacaMatriks(),
        information_validity: nilai.information_validity,
        reputation_impact: nilai.reputation_impact,
        operational_impact: nilai.operational_impact,
        compliance_impact: nilai.compliance_impact,
        media_escalation_risk: nilai.media_escalation_risk,
        root_causes: bacaDaftarBaris(borang, 'root_causes'),
        final_analysis: nilai.final_analysis?.trim() || null,
        status: nilai.status,
      }

      if (lama?.id) {
        await ubahSiklus('analisis', lama.id, isian)
        Object.assign(lama, isian)
        roti('Analisis diperbarui.', 'positif')
      } else {
        // Versi baru selalu satu lebih tinggi daripada versi tertinggi yang
        // ada, bukan jumlah barisnya: sebuah versi yang dihapus akan membuat
        // penomoran menurut jumlah baris menabrak nomor yang sudah dipakai.
        const versiTertinggi = Math.max(0,
          ...keadaanEvaluasi.analisis.filter((x) => x.case_id === kasus.id)
            .map((x) => x.analysis_version || 0))
        const baris = await tulisSiklus('analisis', {
          ...isian,
          case_id: kasus.id,
          analysis_version: versiTertinggi + 1,
          follow_up_assessment: 'Belum Dapat Dinilai',
          created_by: penulis(),
        })
        keadaanEvaluasi.analisis.unshift(Array.isArray(baris) ? baris[0] : baris)
        roti(`Analisis versi ${versiTertinggi + 1} tersimpan.`, 'positif')
      }

      if (['Terdeteksi', 'Verifikasi Lapangan'].includes(kasus.status)) {
        await ubahSiklus('kasus', kasus.id, { status: 'Evaluasi' })
        kasus.status = 'Evaluasi'
      }
      keadaanEvaluasi.borang = null
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      console.error(galat)
    } finally {
      keadaanEvaluasi.sibuk = false
      gambar()
    }
  }

  async function verifikasiAnalisis(kasus) {
    const a = analisisDari(kasus.id)
    if (!a) return
    try {
      const perubahan = {
        status: 'Terverifikasi',
        verified_by: penulis(),
        verified_at: new Date().toISOString(),
      }
      await ubahSiklus('analisis', a.id, perubahan)
      Object.assign(a, perubahan)
      roti('Analisis diverifikasi dan dikunci.', 'positif')
      gambar()
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    }
  }

  async function simpanRekomendasi(kasus) {
    const borang = isi.querySelector('[data-peran="borang-rekomendasi"]')
    if (!borang) return
    const nilai = bacaBorang(borang)
    if (!nilai.recommendation?.trim()) {
      roti('Rumusan rekomendasi tidak boleh kosong.', 'sedang')
      return
    }

    keadaanEvaluasi.sibuk = true
    gambar()
    try {
      const baris = await tulisSiklus('rekomendasi', {
        case_id: kasus.id,
        analysis_id: analisisDari(kasus.id)?.id || null,
        recommendation_type: nilai.recommendation_type,
        recommendation: nilai.recommendation.trim(),
        responsible_party: nilai.responsible_party?.trim() || null,
        priority: nilai.priority,
        due_at: nilai.due_at || null,
        status: 'Diusulkan',
        progress_percent: 0,
        created_by: penulis(),
      })
      keadaanEvaluasi.rekomendasi.push(Array.isArray(baris) ? baris[0] : baris)
      keadaanEvaluasi.borang = null
      roti('Rekomendasi tersimpan.', 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      console.error(galat)
    } finally {
      keadaanEvaluasi.sibuk = false
      gambar()
    }
  }

  async function ajukan(kasus) {
    try {
      await ubahSiklus('kasus', kasus.id, { status: 'Menunggu Keputusan' })
      kasus.status = 'Menunggu Keputusan'
      roti('Kasus diajukan ke pimpinan.', 'positif')
      gambar()
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    }
  }

  /* ---------------------------------------------------------------- penyimak */

  isi.addEventListener('click', (ev) => {
    const pilih = ev.target.closest('[data-pilih]')?.dataset.pilih
    if (pilih) {
      keadaanEvaluasi.dipilih = pilih
      keadaanEvaluasi.borang = null
      gambar()
      return
    }

    const kasus = keadaanEvaluasi.kasus.find((k) => k.id === keadaanEvaluasi.dipilih)
    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (aksi === 'saring-siap') {
      keadaanEvaluasi.hanyaSiap = !keadaanEvaluasi.hanyaSiap
      gambar()
    } else if (aksi === 'buka-analisis') { keadaanEvaluasi.borang = 'analisis'; gambar() }
    else if (aksi === 'analisis-baru') { keadaanEvaluasi.borang = 'analisis-baru'; gambar() }
    else if (aksi === 'buka-rekomendasi') { keadaanEvaluasi.borang = 'rekomendasi'; gambar() }
    else if (aksi === 'batal-borang') { keadaanEvaluasi.borang = null; gambar() }
    else if (aksi === 'tambah-matriks') {
      const wadah = isi.querySelector('[data-peran="matriks"]')
      if (!wadah) return
      wadah.insertAdjacentHTML('beforeend', barisMatriks({}, wadah.children.length))
    } else if (aksi === 'simpan-analisis' && kasus) simpanAnalisis(kasus)
    else if (aksi === 'verifikasi-analisis' && kasus) verifikasiAnalisis(kasus)
    else if (aksi === 'simpan-rekomendasi' && kasus) simpanRekomendasi(kasus)
    else if (aksi === 'ajukan-keputusan' && kasus) ajukan(kasus)
  })

  /* ------------------------------------------------------------------- muat */

  gambar()
  muat(keadaan)
    .then(() => {
      if (!keadaanEvaluasi.dipilih) keadaanEvaluasi.dipilih = daftarKasus()[0]?.id || null
      gambar()
    })
    .catch((galat) => {
      keadaanEvaluasi.galat = pesanRamah(galat)
      gambar()
    })

  return {
    judul: 'Evaluasi dan Rekomendasi',
    sub: 'Narasi media disandingkan dengan fakta lapangan, lalu dirumuskan menjadi tindakan',
  }
}
