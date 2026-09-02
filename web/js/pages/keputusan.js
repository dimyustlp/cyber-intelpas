/**
 * Keputusan Pimpinan.
 *
 * Ruang tersempit di seluruh sistem, dan itu disengaja. Yang dikerjakan di
 * sini hanya satu: membaca analisis beserta rekomendasinya, lalu memutuskan.
 * Tidak ada penyuntingan, tidak ada penambahan rekomendasi, tidak ada
 * penggantian angka. Pimpinan yang bisa menyunting analisis yang sedang
 * diputuskannya membuat jejak putusan kehilangan artinya — tidak ada lagi
 * cara mengetahui apa yang sebenarnya dibaca sebelum tanda tangan.
 *
 * Tiga keputusan yang menentukan isi berkas ini:
 *
 *   Rekomendasi diputuskan satu per satu, bukan seluruhnya sekaligus.
 *   Menyetujui dua dari empat adalah putusan yang sah dan sering terjadi.
 *   Kotak centang di tiap rekomendasi karena itu bukan kemewahan — tanpa itu,
 *   pimpinan yang hanya menyetujui sebagian harus menolak semuanya lalu
 *   meminta analis menulis ulang.
 *
 *   Putusan tidak bisa dicabut dari layar ini. Basis data tidak memberi jalan
 *   UPDATE pada case_decisions sama sekali — hanya INSERT — dan itu memang
 *   yang dimaksudkan: putusan yang bisa disunting kemudian bukan putusan,
 *   melainkan catatan. Yang keliru dikoreksi dengan putusan baru, dan
 *   keduanya tetap terbaca.
 *
 *   Catatan wajib pada putusan yang bukan persetujuan penuh. Pengembalian
 *   tanpa alasan memaksa analis menebak apa yang kurang, dan tebakan itu
 *   rata-rata memakan satu putaran tambahan.
 */

import { kartu, keping, tombol, roti, konfirmasi } from '../ui/komponen.js'
import { amankan, angka, ringkas, jarakWaktu, tanggalJam } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { pesanRamah } from '../lib/api.js'
import { punyaIzin } from '../lib/peran.js'
import {
  PUTUSAN, nadaPutusan, putusanMenyetujui, statusSesudahPutusan,
  nadaRekomendasi, nadaPrioritas, bobotDampak, statusKasus,
} from '../lib/siklus.js'
import { bacaSiklus, tulisSiklus, ubahSiklus, siapkanDemo, penulis } from '../lib/siklus-data.js'
import { barisAntrean, belumDipilih, kepingTenggat } from '../ui/siklus-ui.js'

const keadaanKeputusan = {
  dimuat: false,
  sibuk: false,
  galat: null,
  kasus: [],
  analisis: [],
  rekomendasi: [],
  putusan: [],
  laporan: [],
  dipilih: null,
  /** Rekomendasi yang dicentang pada borang putusan. */
  terpilih: new Set(),
  putusanDipilih: 'Disetujui',
  catatan: '',
  tampilkanRiwayat: false,
}

/* ------------------------------------------------------------------- muat */

async function muat(keadaan) {
  if (keadaan.demo) siapkanDemo(keadaan.berita || [])

  const [kasus, analisis, rekomendasi, putusan, laporan] = await Promise.all([
    bacaSiklus('kasus', { urut: 'created_at.desc' }),
    bacaSiklus('analisis'),
    bacaSiklus('rekomendasi', { urut: 'created_at.asc' }),
    bacaSiklus('putusan', { urut: 'decided_at.desc' }),
    bacaSiklus('laporanLapangan'),
  ])

  Object.assign(keadaanKeputusan, { kasus, analisis, rekomendasi, putusan, laporan, dimuat: true })
}

const analisisDari = (id) => keadaanKeputusan.analisis
  .filter((a) => a.case_id === id)
  .sort((a, b) => (b.analysis_version || 0) - (a.analysis_version || 0))[0]

const rekomendasiDari = (id) => keadaanKeputusan.rekomendasi.filter((r) => r.case_id === id)
const putusanDari = (id) => keadaanKeputusan.putusan.filter((p) => p.case_id === id)

/* ------------------------------------------------------------------ antrean */

/**
 * Antrean putusan.
 *
 * Bawaannya hanya kasus yang benar-benar menunggu: berstatus "Menunggu
 * Keputusan", atau punya rekomendasi yang masih berstatus "Diusulkan". Yang
 * sudah diputus tetap bisa dibuka lewat sakelar riwayat — pimpinan rutin
 * perlu membaca ulang apa yang diputuskannya bulan lalu sebelum memutuskan
 * perkara serupa.
 */
function daftarKasus() {
  const menunggu = keadaanKeputusan.kasus.filter((k) => k.status === 'Menunggu Keputusan'
    || rekomendasiDari(k.id).some((r) => r.status === 'Diusulkan'))

  const daftar = keadaanKeputusan.tampilkanRiwayat
    ? keadaanKeputusan.kasus.filter((k) => menunggu.includes(k) || putusanDari(k.id).length)
    : menunggu

  return daftar.sort((a, b) => {
    // Yang masih menunggu selalu di atas yang sudah diputus.
    const tungguA = menunggu.includes(a) ? 1 : 0
    const tungguB = menunggu.includes(b) ? 1 : 0
    if (tungguA !== tungguB) return tungguB - tungguA
    // Lalu yang dampaknya paling berat, memakai bobot yang sama dengan yang
    // dipakai antrean Evaluasi — dua antrean yang mengurutkan hal yang sama
    // dengan dua aturan berbeda membuat kasus melompat tempat saat berpindah
    // halaman.
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
      Tidak ada kasus yang menunggu putusan. Itu keadaan yang baik.</p></li>`
  }

  return daftar.map((k) => {
    const rek = rekomendasiDari(k.id)
    const menunggu = rek.filter((r) => r.status === 'Diusulkan').length
    const sudah = putusanDari(k.id)[0]
    return barisAntrean({
      id: k.id,
      nomor: k.case_number,
      judul: k.title,
      ket: `${k.primary_upt || '—'} · ${sudah ? `diputus ${jarakWaktu(sudah.decided_at)}` : `${menunggu} rekomendasi menunggu`}`,
      nada: sudah ? nadaPutusan(sudah.decision) : 'kritis',
      label: sudah ? sudah.decision : 'Menunggu putusan',
      angka: rek.length,
      satuan: 'rekomendasi',
      terpilih: k.id === keadaanKeputusan.dipilih,
    })
  }).join('')
}

/* ------------------------------------------------------------------ rincian */

function rincian(kasus, bolehPutus) {
  const a = analisisDari(kasus.id)
  const rek = rekomendasiDari(kasus.id)
  const riwayat = putusanDari(kasus.id)
  const menunggu = rek.filter((r) => r.status === 'Diusulkan')
  const laporan = keadaanKeputusan.laporan.filter((l) => l.case_id === kasus.id)
  const s = statusKasus(kasus.status)

  return `
    <div class="kasus-kepala">
      <div class="kasus-kepala-teks">
        <span class="label-mono">${amankan(kasus.case_number)}</span>
        <h3>${amankan(kasus.title)}</h3>
        <div class="baris gap-6" style="margin-top:6px">
          ${keping(s.nama, s.nada)}
          ${keping(kasus.priority || 'Sedang', nadaPrioritas(kasus.priority), true)}
        </div>
        <p class="mini-teks samar-teks" style="margin-top:6px">
          ${amankan(kasus.primary_upt || '—')} · ${amankan(kasus.issue_type || '')}
        </p>
      </div>
    </div>

    ${a ? `
      <div class="siklus-bagian">
        <div class="siklus-bagian-kop">
          <span class="label-mono">Bahan putusan</span>
          ${keping(`Analisis v${angka(a.analysis_version || 1)} ${a.status}`,
            a.verified_at ? 'positif' : 'sedang', true)}
          <span class="mini-teks samar-teks dorong">
            ${angka(laporan.length)} laporan lapangan · disusun ${amankan(a.created_by || '—')}
          </span>
        </div>

        ${a.verified_at ? '' : `
          <div class="pesan" data-nada="sedang" style="margin-bottom:12px">
            ${ikon('peringatan')}
            <div>
              <b>Analisis ini belum diverifikasi analis evaluasi.</b> Isinya masih dapat berubah.
              Memutuskan sekarang tetap bisa, tetapi yang diputuskan belum tentu yang akhirnya
              tercatat sebagai analisis final.
            </div>
          </div>`}

        <div class="sanding" style="margin-bottom:12px">
          <div class="sanding-kolom">
            <h4>Narasi media</h4>
            <p>${amankan(a.media_narrative || 'Tidak diisi.')}</p>
          </div>
          <div class="sanding-kolom">
            <h4>Fakta lapangan</h4>
            <p>${amankan(a.field_facts
              || laporan.map((l) => l.facts_found).filter(Boolean).join(' ')
              || 'Tidak ada fakta lapangan yang tercatat.')}</p>
          </div>
        </div>

        <dl class="riwayat-ringkas">
          <div><dt>Validitas</dt><dd>${amankan(a.information_validity || '—')}</dd></div>
          <div><dt>Dampak reputasi</dt><dd>${amankan(a.reputation_impact || '—')}</dd></div>
          <div><dt>Dampak operasional</dt><dd>${amankan(a.operational_impact || '—')}</dd></div>
          <div><dt>Risiko eskalasi</dt><dd>${amankan(a.media_escalation_risk || '—')}</dd></div>
        </dl>

        ${a.final_analysis ? `
          <div style="margin-top:12px">
            <div class="label-mono" style="color:var(--ink-4);margin-bottom:4px">Kesimpulan analis</div>
            <p class="kecil-teks" style="line-height:1.6;color:var(--ink-2)">${amankan(a.final_analysis)}</p>
          </div>` : ''}
      </div>`
      : `<div class="siklus-bagian">
          <div class="pesan" data-nada="kritis">
            ${ikon('peringatan')}
            <div>
              <b>Kasus ini belum punya analisis.</b> Yang diputuskan pimpinan adalah rekomendasi
              yang berdiri di atas analisis; tanpa analisis, tidak ada yang bisa dibaca sebelum
              memutuskan. Kembalikan kasus ini ke tahap evaluasi.
            </div>
          </div>
        </div>`}

    <div class="siklus-bagian">
      <div class="siklus-bagian-kop">
        <span class="label-mono">Rekomendasi</span>
        <span class="mini-teks samar-teks">
          ${angka(menunggu.length)} menunggu putusan dari ${angka(rek.length)} butir
        </span>
      </div>

      ${rek.length ? `
        <ul class="siklus-daftar">
          ${rek.map((r) => {
            const bisaDicentang = bolehPutus && r.status === 'Diusulkan'
            return `
            <li class="siklus-butir${bisaDicentang ? ' dapat-dipilih' : ''}">
              <div class="siklus-butir-kop">
                ${bisaDicentang ? `
                  <label class="centang">
                    <input type="checkbox" data-rekomendasi="${amankan(r.id)}"
                           ${keadaanKeputusan.terpilih.has(r.id) ? 'checked' : ''}>
                    <span class="mini-teks">Ikut diputuskan</span>
                  </label>` : ''}
                ${keping(r.recommendation_type, 'aksen', true)}
                ${keping(r.status, nadaRekomendasi(r.status))}
                ${keping(r.priority || 'Sedang', nadaPrioritas(r.priority), true)}
                ${r.due_at ? kepingTenggat(r.due_at, r.status === 'Selesai') : ''}
              </div>
              <p>${amankan(r.recommendation)}</p>
              <span class="mini-teks samar-teks">
                Penanggung jawab: ${amankan(r.responsible_party || 'belum ditetapkan')}
                ${r.decided_at ? ` · diputus ${amankan(jarakWaktu(r.decided_at))} oleh ${amankan(r.decided_by || '—')}` : ''}
              </span>
              ${r.decision_note ? `
                <span class="mini-teks" style="color:var(--ink-2)">
                  <b>Catatan:</b> ${amankan(r.decision_note)}
                </span>` : ''}
            </li>`
          }).join('')}
        </ul>`
        : '<p class="ket">Belum ada rekomendasi pada kasus ini.</p>'}
    </div>

    ${bolehPutus && menunggu.length ? borangPutusan(menunggu) : ''}

    ${riwayat.length ? `
      <div class="siklus-bagian">
        <div class="siklus-bagian-kop">
          <span class="label-mono">Riwayat putusan</span>
          <span class="mini-teks samar-teks">${angka(riwayat.length)} putusan</span>
        </div>
        <ul class="siklus-daftar">
          ${riwayat.map((p) => `
            <li class="siklus-butir">
              <div class="siklus-butir-kop">
                ${keping(p.decision, nadaPutusan(p.decision))}
                <span class="mini-teks samar-teks dorong">
                  ${amankan(tanggalJam(p.decided_at))} oleh ${amankan(p.decided_by || '—')}
                </span>
              </div>
              ${p.decision_note ? `<p>${amankan(p.decision_note)}</p>` : ''}
              <span class="mini-teks samar-teks">
                ${angka((p.recommendation_ids || []).length)} rekomendasi tercakup
              </span>
            </li>`).join('')}
        </ul>
        <p class="mini-teks samar-teks" style="margin-top:9px">
          Putusan tidak dapat disunting maupun dihapus. Yang keliru dikoreksi dengan putusan
          baru, dan keduanya tetap terbaca di sini.
        </p>
      </div>` : ''}`
}

function borangPutusan(menunggu) {
  const pilihan = keadaanKeputusan.putusanDipilih
  const butuhCatatan = pilihan !== 'Disetujui'
  const jumlah = keadaanKeputusan.terpilih.size

  return `
    <div class="siklus-bagian putusan-borang">
      <div class="siklus-bagian-kop">
        <span class="label-mono">Terbitkan putusan</span>
        <span class="mini-teks samar-teks dorong">
          ${jumlah ? `${angka(jumlah)} rekomendasi dicentang` : `seluruh ${angka(menunggu.length)} rekomendasi yang menunggu`}
        </span>
      </div>

      <div class="putusan-pilihan">
        ${PUTUSAN.map((p) => `
          <label class="putusan-kartu${p.nama === pilihan ? ' terpilih' : ''}" data-nada="${p.nada}">
            <input type="radio" name="putusan" value="${amankan(p.nama)}"
                   ${p.nama === pilihan ? 'checked' : ''} data-peran="putusan">
            <b>${amankan(p.nama)}</b>
            <span>${amankan(p.ket)}</span>
          </label>`).join('')}
      </div>

      <label class="bidang" style="margin-top:12px">
        <span class="label-mono">
          Catatan pimpinan${butuhCatatan ? ' (wajib)' : ' (boleh kosong)'}
        </span>
        <textarea class="masukan area" rows="3" data-peran="catatan"
          placeholder="${butuhCatatan
            ? 'Apa yang kurang, atau penyesuaian apa yang diminta.'
            : 'Arahan tambahan, bila ada.'}">${amankan(keadaanKeputusan.catatan)}</textarea>
      </label>

      <div class="baris gap-6" style="margin-top:13px">
        ${tombol({
          label: 'Terbitkan putusan', ikon: 'keputusan', gaya: 'utama',
          aksi: 'terbitkan', nonaktif: keadaanKeputusan.sibuk,
        })}
        <span class="mini-teks samar-teks">
          Putusan tercatat permanen beserta nama dan waktunya.
          ${putusanMenyetujui(pilihan)
            ? 'Rekomendasi yang disetujui langsung menjadi butir tindak lanjut.' : ''}
        </span>
      </div>
    </div>`
}

/* ------------------------------------------------------------------ halaman */

export function halamanKeputusan({ keadaan, isi }) {
  const bolehPutus = punyaIzin(keadaan.profil?.role, 'putuskan_kasus')

  function gambar() {
    if (keadaanKeputusan.galat) {
      isi.innerHTML = kartu({
        isi: `<div class="pesan" data-nada="kritis">${ikon('peringatan')}
          <div><b>Antrean putusan gagal dimuat.</b> ${amankan(keadaanKeputusan.galat)}</div></div>`,
      })
      return
    }
    if (!keadaanKeputusan.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:420px"></div>' })
      return
    }

    const kasus = keadaanKeputusan.kasus.find((k) => k.id === keadaanKeputusan.dipilih)
    const menunggu = keadaanKeputusan.kasus.filter(
      (k) => k.status === 'Menunggu Keputusan').length

    isi.innerHTML = `
      <div class="tumpuk">
        <div class="bilah-alat">
          <button class="tbl kecil${keadaanKeputusan.tampilkanRiwayat ? ' utama' : ''}"
                  data-aksi="riwayat" aria-pressed="${keadaanKeputusan.tampilkanRiwayat}">
            ${ikon('arsip')}Tampilkan yang sudah diputus
          </button>
          <div class="dorong baris gap-6">
            <span class="mini-teks samar-teks">
              ${angka(menunggu)} kasus menunggu putusan
            </span>
          </div>
        </div>

        ${!bolehPutus ? `
          <div class="pesan" data-nada="aksen">
            ${ikon('info')}
            <div>
              <b>Anda membaca ruang ini tanpa hak memutuskan.</b>
              Analisis dan rekomendasi terbuka untuk dibaca; yang menerbitkan putusan hanya
              peran Pimpinan Pengambil Keputusan.
            </div>
          </div>` : ''}

        <div class="siklus-tata">
          <div class="siklus-antrean">
            <div class="siklus-antrean-kop"><span class="label-mono">Antrean putusan</span></div>
            <ul>${antrean()}</ul>
          </div>
          <div class="siklus-rinci">
            ${kasus ? rincian(kasus, bolehPutus) : belumDipilih(
              'Pilih satu kasus di sebelah kiri',
              'Analisis, fakta lapangan, dan seluruh rekomendasinya muncul di sini — beserta '
              + 'tempat menerbitkan putusan.',
            )}
          </div>
        </div>
      </div>`
  }

  /* --------------------------------------------------------------- tindakan */

  async function terbitkan(kasus) {
    const rek = rekomendasiDari(kasus.id)
    const menunggu = rek.filter((r) => r.status === 'Diusulkan')

    // Tanpa satu pun centang, putusan berlaku untuk seluruh rekomendasi yang
    // menunggu. Itu jalan yang paling sering dipakai, dan memaksa pimpinan
    // mencentang empat kotak untuk menyetujui empat-empatnya hanya menambah
    // langkah tanpa menambah ketelitian.
    const dipilih = keadaanKeputusan.terpilih.size
      ? menunggu.filter((r) => keadaanKeputusan.terpilih.has(r.id))
      : menunggu

    if (!dipilih.length) {
      roti('Tidak ada rekomendasi yang dapat diputuskan.', 'sedang')
      return
    }

    const putusan = keadaanKeputusan.putusanDipilih
    const catatan = keadaanKeputusan.catatan.trim()

    if (putusan !== 'Disetujui' && !catatan) {
      roti('Putusan selain persetujuan penuh menuntut catatan. Tanpa alasan, '
        + 'analis hanya bisa menebak apa yang kurang.', 'sedang', 6000)
      return
    }

    const ya = await konfirmasi({
      judul: `Terbitkan putusan "${putusan}"?`,
      pesan: `${dipilih.length} rekomendasi akan diputuskan. Putusan tidak dapat disunting `
        + 'maupun dihapus sesudah terbit — yang keliru dikoreksi dengan putusan baru.',
      tegas: 'Terbitkan',
    })
    if (!ya) return

    keadaanKeputusan.sibuk = true
    gambar()
    try {
      const baris = await tulisSiklus('putusan', {
        case_id: kasus.id,
        decision: putusan,
        decision_note: catatan || null,
        recommendation_ids: dipilih.map((r) => r.id),
        decided_by: penulis(),
        decided_at: new Date().toISOString(),
      })
      keadaanKeputusan.putusan.unshift(Array.isArray(baris) ? baris[0] : baris)

      const statusRekomendasi = putusanMenyetujui(putusan) ? 'Disetujui'
        : putusan === 'Dikembalikan' ? 'Dikembalikan' : 'Ditolak'

      for (const r of dipilih) {
        const perubahan = {
          status: statusRekomendasi,
          decided_by: penulis(),
          decided_at: new Date().toISOString(),
          decision_note: catatan || null,
        }
        await ubahSiklus('rekomendasi', r.id, perubahan)
        Object.assign(r, perubahan)

        // Rekomendasi yang disetujui langsung menjadi butir tindak lanjut.
        // Dibuat di sini, bukan diminta dibuat ulang di halaman Tindak Lanjut:
        // butir yang harus dibuat manual sesudah putusan adalah butir yang
        // rutin lupa dibuat, dan putusan yang tidak berbuntut apa-apa adalah
        // kegagalan yang paling mahal di seluruh siklus ini.
        if (putusanMenyetujui(putusan)) {
          await tulisSiklus('tindak', {
            case_id: kasus.id,
            recommendation_id: r.id,
            title: ringkas(r.recommendation, 90),
            description: r.recommendation,
            assigned_to: null,
            assigned_role: null,
            priority: r.priority || 'Sedang',
            status: 'Belum Dimulai',
            due_at: r.due_at ? new Date(`${r.due_at}T17:00:00`).toISOString() : null,
            progress_percent: 0,
            created_by: penulis(),
          })
        }
      }

      const statusBaru = statusSesudahPutusan(putusan)
      await ubahSiklus('kasus', kasus.id, {
        status: statusBaru,
        closed_at: statusBaru === 'Ditutup' ? new Date().toISOString() : null,
      })
      kasus.status = statusBaru

      keadaanKeputusan.terpilih.clear()
      keadaanKeputusan.catatan = ''
      roti(putusanMenyetujui(putusan)
        ? `Putusan terbit. ${dipilih.length} butir tindak lanjut dibuat otomatis.`
        : 'Putusan terbit.', 'positif', 5000)
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      console.error(galat)
    } finally {
      keadaanKeputusan.sibuk = false
      gambar()
    }
  }

  /* ---------------------------------------------------------------- penyimak */

  isi.addEventListener('click', (ev) => {
    const pilih = ev.target.closest('[data-pilih]')?.dataset.pilih
    if (pilih) {
      keadaanKeputusan.dipilih = pilih
      keadaanKeputusan.terpilih.clear()
      keadaanKeputusan.catatan = ''
      gambar()
      return
    }

    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (aksi === 'riwayat') {
      keadaanKeputusan.tampilkanRiwayat = !keadaanKeputusan.tampilkanRiwayat
      gambar()
    } else if (aksi === 'terbitkan') {
      const kasus = keadaanKeputusan.kasus.find((k) => k.id === keadaanKeputusan.dipilih)
      if (kasus) terbitkan(kasus)
    }
  })

  isi.addEventListener('change', (ev) => {
    const rekomendasi = ev.target.dataset.rekomendasi
    if (rekomendasi) {
      if (ev.target.checked) keadaanKeputusan.terpilih.add(rekomendasi)
      else keadaanKeputusan.terpilih.delete(rekomendasi)
      // Hanya keterangan jumlah di kepala borang yang berubah; menggambar
      // ulang seluruh panel akan menutup kotak centang yang barusan ditekan.
      const kepala = isi.querySelector('.putusan-borang .siklus-bagian-kop .dorong')
      if (kepala) {
        const jumlah = keadaanKeputusan.terpilih.size
        kepala.textContent = jumlah
          ? `${angka(jumlah)} rekomendasi dicentang`
          : 'seluruh rekomendasi yang menunggu'
      }
      return
    }

    if (ev.target.dataset.peran === 'putusan') {
      keadaanKeputusan.putusanDipilih = ev.target.value
      gambar()
    }
  })

  isi.addEventListener('input', (ev) => {
    if (ev.target.dataset.peran === 'catatan') keadaanKeputusan.catatan = ev.target.value
  })

  /* ------------------------------------------------------------------- muat */

  gambar()
  muat(keadaan)
    .then(() => {
      if (!keadaanKeputusan.dipilih) keadaanKeputusan.dipilih = daftarKasus()[0]?.id || null
      gambar()
    })
    .catch((galat) => {
      keadaanKeputusan.galat = pesanRamah(galat)
      gambar()
    })

  return {
    judul: 'Keputusan Pimpinan',
    sub: 'Membaca analisis, memutuskan rekomendasi, dan menerbitkan tindak lanjutnya',
  }
}
