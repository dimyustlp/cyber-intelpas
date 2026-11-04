/**
 * Analisis Berita — kasus per kasus.
 *
 * Satu berita negatif dipilih, dianalisis (fakta 5W1H, penilaian, prakiraan,
 * rekomendasi, evaluasi SIP), lalu diterbitkan ke Tindak Lanjut dengan tujuan
 * yang tertulis jelas:
 *
 *   1. Klarifikasi UPT — kanwil meneruskan, UPT mengunggah hasilnya.
 *   2. Tindak lanjut disposisi pimpinan.
 *
 * Dipakai peran pusat (dari Ruang Analis) dan admin kanwil (ruang wilayah).
 * Cakupannya tidak diatur halaman ini: berita yang tampil adalah yang
 * dikirim peladen, dan peladen hanya mengirim berita wilayah kepada kanwil.
 * Bagi pusat daftarnya dikelompokkan per kanwil — permintaan user 3 November
 * 2026 — dengan kanwil ditentukan dari kanwil asal lembar, atau kanwil UPT-nya
 * di data induk bila berita itu masuk lewat jalur pusat.
 *
 * Penempatan UPT (permintaan user 4 November 2026): Klarifikasi UPT menuntut
 * berita yang sudah terpetakan ke satu unit, dan sampai hari itu satu-satunya
 * jalan memetakannya adalah meninggalkan analisis dan membuka halaman Pemetaan
 * UPT. Panel analisis kini memuat kandidat dari mesin pencocokan yang sama dan
 * pencarian bebas ke data induk. Yang ditulis hanya `berita.nama_upt` — kolom
 * yang sama yang ditulis Pemetaan UPT — dan `terapkan_klasifikasi` hanya
 * mengisi kolom itu bila masih kosong, sehingga penetapan manusia tidak
 * ditimpa mesin pada penilaian ulang.
 */

import { kartu, keping, kosong, tombol, pesanSistem, roti } from '../ui/komponen.js'
import { amankan, angka, tanggalJam, ringkas, nadaUrgensi } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, perbarui, pesanRamah } from '../lib/api.js'
import { KONFIG } from '../lib/konfig.js'
import { punyaIzin, adalahEksternal } from '../lib/peran.js'
import { dasar } from '../lib/hitung.js'
import { ember } from '../lib/sentimen.js'
import { belumTerpetakan } from '../lib/unit-terpetakan.js'
import { bangunIndeks, cocokkanUpt, normalkanUpt } from '../lib/pencocokan-upt.js'
import {
  evaluasiBerita, prioritasBerita, prioritas, labelSumber, labelInformasi,
  EVALUASI_SUMBER, EVALUASI_INFORMASI,
} from '../lib/sip.js'
import { sarankanTindak } from '../lib/tindak-lanjut.js'
import {
  muatPenanganan, penangananSaatIni, buatPenanganan, infoStatus, namaKanwilPendek, TUJUAN,
} from '../lib/penanganan.js'

const pilih = {
  id: null, cari: '', kanwil: 'semua', hanyaBaru: false, sibuk: false, buka: new Set(),
  // Penempatan UPT: berita yang pemilihnya terbuka, dan isi borang yang
  // sedang diketik — supaya menetapkan UPT tidak menghapus analisis yang
  // belum disimpan saat panel digambar ulang.
  uptBuka: null, cariUpt: '', simpanUpt: false, draf: null,
}
let indukUpt = null
let indeksUpt = null

async function muatInduk() {
  if (indukUpt) return indukUpt
  try {
    // Mode peragaan tidak punya peladen; potret data induk yang dipakai Peta
    // Sebaran cukup untuk memperagakan penempatan UPT, dan dimuat dinamis
    // supaya peramban petugas tidak pernah mengunduhnya.
    const baris = KONFIG.mode === 'demo'
      ? (await import('../lib/peta-upt-contoh.js')).UNIT_CONTOH
        .map(([nama_upt, jenis_upt, kanwil, provinsi, kabupaten_kota]) => ({ nama_upt, jenis_upt, kanwil, provinsi, kabupaten_kota }))
      : await ambil('upt', {
        select: 'nama_upt,jenis_upt,kelas_upt,subjenis_upt,provinsi,kanwil,kabupaten_kota,location_hint',
        aktif: 'eq.true',
        limit: 1000,
      }) || []
    indukUpt = new Map(baris.map((u) => [u.nama_upt, u.kanwil]))
    indeksUpt = bangunIndeks(baris)
  } catch { indukUpt = new Map() }
  return indukUpt
}

/**
 * Unit yang boleh dipilih pemegang peran ini. Admin kanwil hanya unit di
 * wilayahnya: policy `berita_update_telaah_kanwil` menolak baris yang sesudah
 * diubah jatuh ke luar wilayahnya, dan pilihan yang pasti ditolak tidak perlu
 * ditawarkan.
 */
function entriBoleh(keadaan) {
  if (!indeksUpt) return []
  const kanwil = adalahEksternal(keadaan.profil?.role) ? keadaan.profil?.assigned_kanwil : null
  return kanwil ? indeksUpt.entri.filter((e) => e.kanwil === kanwil) : indeksUpt.entri
}

function calonUpt(keadaan, b) {
  const boleh = entriBoleh(keadaan)
  const namaBoleh = new Set(boleh.map((e) => e.nama))
  const teks = [b.judul, b.ringkasan, b.raw_analysis, b.caption_manual, b.media].filter(Boolean).join(' . ')
  const saran = indeksUpt
    ? cocokkanUpt(teks, indeksUpt, { maksSaran: 6 }).saran.filter((s) => namaBoleh.has(s.nama) && s.nama !== b.nama_upt)
    : []
  // Setiap kata yang diketik harus ada di nama, kabupaten/kota, atau kanwil —
  // "rumbai narkotika" menemukan "Lapas Narkotika Kelas IIB Rumbai", yang
  // tidak ditemukan pencarian satu untai utuh.
  const kata = normalkanUpt(pilih.cariUpt).split(' ').filter(Boolean)
  const cari = kata.length && pilih.cariUpt.trim().length >= 2
    ? boleh.filter((e) => {
      const ladang = `${e.namaNormal} ${e.kabkota} ${normalkanUpt(e.kanwil)} ${normalkanUpt(e.provinsi)}`
      return kata.every((k) => ladang.includes(k))
    }).slice(0, 8)
    : []
  return { saran, cari }
}

function barisCalon(nama, ket, skor = null) {
  return `
    <button class="kandidat-baris" data-tetapkan-upt="${amankan(nama)}">
      ${skor === null ? '' : `<span class="kandidat-skor" data-kuat="${skor >= 0.72}">${Math.round(skor * 100)}%</span>`}
      <span class="kandidat-teks">
        <span class="kandidat-nama">${amankan(nama)}</span>
        <span class="kandidat-ket">${amankan(ket)}</span>
      </span>
      <span class="kandidat-panah">${ikon('panahKanan')}</span>
    </button>`
}

function hasilCariUpt(keadaan, b) {
  const { cari } = calonUpt(keadaan, b)
  if (pilih.cariUpt.trim().length < 2) return ''
  if (!cari.length) return '<p class="mini-teks samar-teks" style="margin:6px 0 0">Tidak ada unit yang cocok.</p>'
  return `<div class="kandidat-daftar" style="margin-top:8px">${cari.map((e) =>
    barisCalon(e.nama, [e.kabkota && e.kabkota.replace(/\b\w/g, (h) => h.toUpperCase()), namaKanwilPendek(e.kanwil)].filter(Boolean).join(' · '))).join('')}</div>`
}

/** Pemilih UPT di panel analisis. */
function panelUpt(keadaan, b, ada) {
  const unitAda = !belumTerpetakan(b.nama_upt)
  const klarifikasi = ada.find((p) => p.tujuan === 'klarifikasi_upt')
  // Klarifikasi yang sudah diterbitkan ditujukan ke satu unit, dan unit itu
  // sudah diberi tahu. Memindahkan beritanya diam-diam akan membuat unit lama
  // mengklarifikasi berita yang bukan lagi miliknya.
  if (unitAda && klarifikasi) {
    return `<div class="mini-teks samar-teks" style="margin-top:6px">UPT terkunci: klarifikasi sudah ditujukan ke ${amankan(klarifikasi.nama_upt || b.nama_upt)}.</div>`
  }
  const buka = !unitAda || pilih.uptBuka === b.id
  if (!buka) {
    return `<div style="margin-top:6px">${tombol({ label: 'Ganti UPT', ikon: 'peta', kecil: true, aksi: 'buka-upt' })}</div>`
  }
  if (!indeksUpt) {
    return '<div class="mini-teks samar-teks" style="margin-top:8px">Memuat data induk UPT…</div>'
  }
  const { saran } = calonUpt(keadaan, b)
  return `
    <div class="analisis-upt" data-peran="panel-upt">
      <div class="baris gap-6" style="justify-content:space-between;align-items:center">
        <span class="label-mono">${unitAda ? 'Ganti UPT berita ini' : 'Tetapkan UPT berita ini'}</span>
        ${unitAda ? tombol({ label: 'Batal', kecil: true, aksi: 'tutup-upt' }) : ''}
      </div>
      <span class="mini-teks samar-teks">${unitAda
        ? 'Pilih unit yang benar bila mesin keliru memetakannya.'
        : 'Klarifikasi UPT baru bisa diterbitkan setelah beritanya ditempatkan ke satu unit.'}</span>
      ${saran.length ? `
        <span class="mini-teks" style="margin-top:6px">Kandidat dari teks berita</span>
        <div class="kandidat-daftar">${saran.map((s) =>
          barisCalon(s.nama, [s.provinsi, namaKanwilPendek(s.kanwil)].filter(Boolean).join(' · '), s.skor)).join('')}</div>` : ''}
      <label class="cari" style="margin-top:8px">
        ${ikon('cari')}
        <input class="masukan" type="search" data-peran="cari-upt" value="${amankan(pilih.cariUpt)}"
               placeholder="Cari unit: nama, kota, atau kanwil" autocomplete="off" aria-label="Cari UPT">
      </label>
      <div data-peran="hasil-upt">${hasilCariUpt(keadaan, b)}</div>
      ${pilih.simpanUpt ? '<div class="mini-teks samar-teks">Menyimpan…</div>' : ''}
    </div>`
}

/** Mengambil isi borang yang sedang diketik, sebelum panel digambar ulang. */
function rekamDraf(borang, id) {
  if (!borang) return
  const nilai = {}
  borang.querySelectorAll('[data-bidang]').forEach((el) => {
    nilai[el.dataset.bidang] = el.type === 'checkbox' ? el.checked : el.value
  })
  pilih.draf = { id, nilai }
}

function pulihkanDraf(borang, id) {
  if (!borang || pilih.draf?.id !== id) return
  for (const [nama, v] of Object.entries(pilih.draf.nilai)) {
    // Centang Klarifikasi UPT mengikuti keadaan unit yang baru, bukan yang lama:
    // sebelum UPT ditetapkan ia mati dan tidak tercentang.
    if (nama === 'klarifikasi') continue
    const el = borang.querySelector(`[data-bidang="${nama}"]`)
    if (!el) continue
    if (el.type === 'checkbox') el.checked = Boolean(v); else el.value = v
  }
}

function kanwilDari(b) {
  return b.kanwil_asal || indukUpt?.get(b.nama_upt) || null
}

function gambarUlang() { document.dispatchEvent(new CustomEvent('gambar-ulang')) }

function besokLusa(hari = 2) {
  const t = new Date(Date.now() + hari * 86400000)
  return t.toISOString().slice(0, 10)
}

/** Draf awal fakta: unsur 5W1H yang sudah diketahui dari baris berita. */
function barisSiapa(b) {
  // `belumTerpetakan`, bukan `b.nama_upt ||`: penjaring menulis "Belum
  // Teridentifikasi", dan teks itu dulu masuk ke fakta seolah nama unit.
  const kanwil = b.kanwil_asal || indukUpt?.get(b.nama_upt)
  return `Siapa/di mana: ${belumTerpetakan(b.nama_upt) ? 'UPT belum terpetakan' : b.nama_upt}${kanwil ? `, ${namaKanwilPendek(kanwil)}` : ''}`
}

function drafFakta(b) {
  const bagian = [
    `Apa: ${b.judul || '-'}`,
    barisSiapa(b),
    `Kapan: terbit ${tanggalJam(b.tanggal_publikasi || b.created_at)}`,
    `Sumber: ${b.media || '-'}${b.link ? ` (${b.link})` : ''}`,
    'Mengapa: ',
    'Bagaimana: ',
  ]
  return bagian.join('\n')
}

function kartuDaftar(keadaan, negatif, peta) {
  const pusat = !adalahEksternal(keadaan.profil?.role)
  const kata = pilih.cari.trim().toLowerCase()
  let daftar = negatif.filter((b) => !kata
    || `${b.judul} ${b.nama_upt} ${b.media} ${kanwilDari(b) || ''}`.toLowerCase().includes(kata))
  if (pilih.kanwil !== 'semua') daftar = daftar.filter((b) => (kanwilDari(b) || 'Tanpa kanwil') === pilih.kanwil)
  if (pilih.hanyaBaru) daftar = daftar.filter((b) => !peta.has(b.id))

  const kelompok = new Map()
  for (const b of daftar) {
    const k = pusat ? (kanwilDari(b) || 'Tanpa kanwil') : (kanwilDari(b) || keadaan.profil?.assigned_kanwil || 'Wilayah ini')
    if (!kelompok.has(k)) kelompok.set(k, [])
    kelompok.get(k).push(b)
  }
  const urut = [...kelompok.entries()].sort((a, b) => b[1].length - a[1].length)
  const semuaKanwil = [...new Set(negatif.map((b) => kanwilDari(b) || 'Tanpa kanwil'))].sort()

  const baris = (b) => {
    const ada = peta.get(b.id) || []
    const aktif = b.id === pilih.id
    return `
      <button class="analisis-baris${aktif ? ' aktif' : ''}" data-pilih-berita="${amankan(b.id)}">
        <span class="analisis-judul">${amankan(ringkas(b.judul, 120))}</span>
        <span class="baris gap-6" style="flex-wrap:wrap">
          ${keping(b.urgensi || 'Rendah', nadaUrgensi(b.urgensi), true)}
          <span class="mini-teks samar-teks">${amankan(belumTerpetakan(b.nama_upt) ? 'UPT belum terpetakan' : b.nama_upt)}</span>
          <span class="mini-teks samar-teks">· ${amankan(tanggalJam(b.created_at))}</span>
          ${ada.map((p) => keping(`${TUJUAN[p.tujuan].label}: ${infoStatus(p.status).pendek}`, infoStatus(p.status).nada, true)).join('')}
        </span>
      </button>`
  }

  return kartu({
    judul: pusat ? 'Berita negatif per kanwil' : 'Berita negatif di wilayah Anda',
    ket: pusat
      ? 'Seluruh berita negatif, dikelompokkan menurut kanwil UPT-nya. Pilih satu untuk dianalisis.'
      : 'Berita negatif yang menyangkut UPT di wilayah Anda. Pilih satu untuk dianalisis.',
    isi: `
      <div class="bilah-alat" style="flex-wrap:wrap;gap:8px">
        <input class="masukan" type="search" data-peran="cari-analisis" value="${amankan(pilih.cari)}"
               placeholder="Cari judul, UPT, media, atau kanwil" style="flex:1;min-width:220px"
               aria-label="Cari berita negatif">
        ${pusat ? `<select class="pilihan" data-peran="kanwil-analisis" style="width:auto;min-width:200px" aria-label="Saring kanwil">
          <option value="semua">Semua kanwil (${angka(negatif.length)})</option>
          ${semuaKanwil.map((k) => `<option value="${amankan(k)}"${k === pilih.kanwil ? ' selected' : ''}>${amankan(namaKanwilPendek(k))}</option>`).join('')}
        </select>` : ''}
        <button class="tbl kecil${pilih.hanyaBaru ? ' utama' : ''}" data-aksi="hanya-baru" aria-pressed="${pilih.hanyaBaru}">
          ${ikon('saring')}Belum dianalisis
        </button>
      </div>
      <div class="mini-teks samar-teks" style="margin:8px 0">${angka(daftar.length)} berita tampil · ${angka(urut.length)} kelompok</div>
      ${daftar.length ? urut.map(([k, isi]) => {
        const terbuka = !pusat || urut.length === 1 || pilih.buka.has(k) || isi.some((b) => b.id === pilih.id) || Boolean(kata)
        const dianalisis = isi.filter((b) => peta.has(b.id)).length
        return `
          <details class="analisis-kelompok" data-kanwil="${amankan(k)}"${terbuka ? ' open' : ''}>
            <summary>
              <b>${amankan(namaKanwilPendek(k))}</b>
              <span class="mini-teks samar-teks">${angka(isi.length)} berita negatif · ${angka(dianalisis)} sudah dianalisis</span>
            </summary>
            <div class="analisis-daftar">${isi.slice(0, 60).map(baris).join('')}
              ${isi.length > 60 ? `<div class="mini-teks samar-teks">${angka(isi.length - 60)} lainnya — persempit dengan kotak cari.</div>` : ''}
            </div>
          </details>`
      }).join('') : kosong('Tidak ada berita negatif', 'Tidak ada yang cocok dengan saringan ini.')}`,
  })
}

function kartuBorang(keadaan, b, peta) {
  const kanwil = kanwilDari(b)
  const unitAda = !belumTerpetakan(b.nama_upt)
  const ev = evaluasiBerita(b)
  const prio = prioritas(prioritasBerita(b))
  const saran = sarankanTindak(b)
  const ada = peta.get(b.id) || []
  const kanwilPembuat = adalahEksternal(keadaan.profil?.role)
  const sebelumnya = ada[0]?.analisis || {}

  return kartu({
    judul: 'Analisis berita',
    ket: 'Isi fakta dan penilaian, lalu pilih tujuan tindak lanjutnya. Hasilnya langsung masuk Tindak Lanjut.',
    aksi: tombol({ label: 'Tutup', ikon: 'tutup', kecil: true, aksi: 'tutup-analisis' }),
    isi: `
      <div class="analisis-ringkas">
        <a href="${amankan(b.link || '#')}" target="_blank" rel="noopener noreferrer"><b>${amankan(b.judul)}</b></a>
        <div class="baris gap-6" style="flex-wrap:wrap;margin-top:6px">
          ${keping(b.urgensi || 'Rendah', nadaUrgensi(b.urgensi), true)}
          ${keping(b.sentimen || '-', 'kritis', true)}
          <span class="mini-teks">${amankan(b.media || '-')} · ${amankan(tanggalJam(b.tanggal_publikasi || b.created_at))}</span>
        </div>
        <div class="mini-teks" style="margin-top:6px">
          UPT: <b>${amankan(unitAda ? b.nama_upt : 'belum terpetakan')}</b> · Kanwil: <b>${amankan(namaKanwilPendek(kanwil))}</b>
        </div>
        ${panelUpt(keadaan, b, ada)}
        <div class="mini-teks samar-teks" style="margin-top:4px">
          Penilaian SIP: nilai <b>${amankan(ev.nilai)}</b> (sumber ${amankan(labelSumber(ev.sumber).toLowerCase())},
          informasi ${amankan(labelInformasi(ev.informasi).toLowerCase())}) · prioritas <b>${amankan(prio.label)}</b>
          ${saran ? ` · saran mesin: <b>${amankan(saran.pendek)}</b>` : ''}
        </div>
        ${ada.length ? `<div style="margin-top:8px">${pesanSistem(
          `Berita ini sudah dianalisis: ${ada.map((p) => `${amankan(TUJUAN[p.tujuan].label)} — ${amankan(infoStatus(p.status).label)}`).join('; ')}. `
          + 'Menyimpan lagi memperbarui analisisnya, bukan membuat permintaan kedua.', 'aksen', 'info')}</div>` : ''}
      </div>

      <div class="analisis-borang" data-peran="borang-analisis">
        <label class="bidang"><span class="label-mono">Fakta-fakta (5W1H)</span>
          <textarea class="masukan area" data-bidang="fakta" rows="6">${amankan(sebelumnya.fakta || drafFakta(b))}</textarea>
          <span class="mini-teks samar-teks">Pastikan memuat siapa, apa, di mana, kapan, mengapa, dan bagaimana. Pisahkan fakta dari pendapat.</span>
        </label>
        <label class="bidang"><span class="label-mono">Analisis / pembahasan</span>
          <textarea class="masukan area" data-bidang="analisis" rows="3" placeholder="Benang merah dengan fakta lain, kebenaran dan keakuratan informasi">${amankan(sebelumnya.analisis || '')}</textarea>
        </label>
        <label class="bidang"><span class="label-mono">Prakiraan (forecasting)</span>
          <textarea class="masukan area" data-bidang="prakiraan" rows="2" placeholder="Apa yang mungkin terjadi bila tidak ditangani">${amankan(sebelumnya.prakiraan || '')}</textarea>
        </label>
        <label class="bidang"><span class="label-mono">Rekomendasi</span>
          <textarea class="masukan area" data-bidang="rekomendasi" rows="3" placeholder="Peringatan dini (early warning) dan usulan pemecahan masalah (problem solving)">${amankan(sebelumnya.rekomendasi || (saran ? `${saran.label}. ${saran.alasan.join(' ')}` : ''))}</textarea>
        </label>
        <div class="sip-kisi">
          <label><span class="label-mono">Evaluasi sumber</span>
            <select class="pilihan" data-bidang="nilai_sumber">
              ${EVALUASI_SUMBER.map((e) => `<option value="${e.kode}"${(sebelumnya.nilai_sumber || ev.sumber) === e.kode ? ' selected' : ''}>${e.kode} — ${amankan(e.label)}</option>`).join('')}
            </select></label>
          <label><span class="label-mono">Evaluasi informasi</span>
            <select class="pilihan" data-bidang="nilai_informasi">
              ${EVALUASI_INFORMASI.map((e) => `<option value="${e.kode}"${String(sebelumnya.nilai_informasi || ev.informasi) === e.kode ? ' selected' : ''}>${e.kode} — ${amankan(e.label)}</option>`).join('')}
            </select></label>
        </div>

        <div class="label-mono" style="margin-top:14px">Tujuan tindak lanjut</div>
        <div class="analisis-tujuan">
          <label class="tujuan-pilih${unitAda ? '' : ' mati'}">
            <input type="checkbox" data-bidang="klarifikasi" ${unitAda ? 'checked' : 'disabled'}>
            <span><b>1. Klarifikasi UPT</b><br>
              <span class="mini-teks samar-teks">${unitAda
                ? (kanwilPembuat
                  ? `Langsung diteruskan ke ${amankan(b.nama_upt)}. UPT mengunggah hasil klarifikasi (PDF/DOCX) dan nama pengirimnya.`
                  : `Masuk ke ${amankan(namaKanwilPendek(kanwil))} untuk diteruskan ke ${amankan(b.nama_upt)}.`)
                : 'Tidak bisa: berita ini belum terpetakan ke UPT mana pun.'}</span></span>
          </label>
          <div class="analisis-sub" data-sub="klarifikasi">
            <label class="bidang"><span class="label-mono">Instruksi untuk UPT</span>
              <textarea class="masukan area" data-bidang="instruksi" rows="2" placeholder="Hal yang perlu diklarifikasi">${amankan(ada.find((p) => p.tujuan === 'klarifikasi_upt')?.instruksi || 'Mohon klarifikasi tertulis atas pemberitaan ini disertai kronologi dan bukti pendukung.')}</textarea></label>
            <label class="bidang"><span class="label-mono">Batas waktu klarifikasi</span>
              <input class="masukan" type="date" data-bidang="batas_klarifikasi" value="${besokLusa(2)}"></label>
          </div>
          <label class="tujuan-pilih">
            <input type="checkbox" data-bidang="disposisi">
            <span><b>2. Tindak lanjut disposisi pimpinan</b><br>
              <span class="mini-teks samar-teks">Untuk berita yang menuntut putusan pimpinan. Disposisinya boleh dicatat sekarang atau nanti di Tindak Lanjut.</span></span>
          </label>
          <div class="analisis-sub" data-sub="disposisi" hidden>
            <label class="bidang"><span class="label-mono">Pimpinan pemberi disposisi</span>
              <input class="masukan" data-bidang="pimpinan" placeholder="${kanwilPembuat ? 'mis. Kepala Kantor Wilayah' : 'mis. Direktur Kamtib'}"></label>
            <label class="bidang"><span class="label-mono">Isi disposisi (boleh menyusul)</span>
              <textarea class="masukan area" data-bidang="isi_disposisi" rows="2"></textarea></label>
            <label class="bidang"><span class="label-mono">Batas waktu</span>
              <input class="masukan" type="date" data-bidang="batas_disposisi" value="${besokLusa(7)}"></label>
          </div>
        </div>

        <div class="baris gap-6" style="margin-top:14px">
          ${tombol({ label: pilih.sibuk ? 'Menyimpan…' : 'Simpan analisis & teruskan', ikon: 'kirim', gaya: 'utama', aksi: 'simpan-analisis', nonaktif: pilih.sibuk })}
          ${KONFIG.mode === 'demo' ? '<span class="mini-teks samar-teks">Mode peragaan: tersimpan sampai halaman dimuat ulang.</span>' : ''}
        </div>
      </div>`,
  })
}

export function halamanAnalisisBerita({ keadaan, isi }) {
  const peran = keadaan.profil?.role
  if (keadaan.fokus && keadaan.halaman === 'analisis-berita') pilih.id = keadaan.fokus

  if (!pilih.dimuat) {
    pilih.dimuat = true
    Promise.all([muatInduk(), muatPenanganan()]).then(() => gambarUlang())
  }

  const negatif = dasar(keadaan.dalamLingkup || keadaan.berita || [])
    .filter((b) => ember(b) === 'negatif')
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

  const peta = new Map()
  for (const p of penangananSaatIni()) {
    if (!peta.has(p.berita_id)) peta.set(p.berita_id, [])
    peta.get(p.berita_id).push(p)
  }

  const terpilih = pilih.id ? negatif.find((b) => b.id === pilih.id) || (keadaan.berita || []).find((b) => b.id === pilih.id) : null

  isi.innerHTML = `
    <div class="tumpuk">
      ${pesanSistem(
        '<b>Analisis kasus per kasus.</b> Pilih satu berita negatif, lengkapi fakta 5W1H dan penilaiannya, '
        + 'lalu tentukan tujuannya: <b>Klarifikasi UPT</b> dan/atau <b>Tindak lanjut disposisi pimpinan</b>. '
        + 'Hasilnya langsung tampil di menu Tindak Lanjut, dan grup Telegram kanwil diberi tahu otomatis.',
        'aksen', 'info')}
      <div class="analisis-tata">
        <div>${kartuDaftar(keadaan, negatif, peta)}</div>
        <div data-peran="panel-analisis">${terpilih
          ? kartuBorang(keadaan, terpilih, peta)
          : kartu({ judul: 'Analisis berita', isi: kosong('Belum ada berita dipilih', 'Pilih satu berita negatif di daftar untuk mulai menganalisis.') })}</div>
      </div>
    </div>`

  isi.querySelector('[data-peran="cari-analisis"]')?.addEventListener('input', (ev) => {
    pilih.cari = ev.target.value
    clearTimeout(pilih.tunda)
    pilih.tunda = setTimeout(() => {
      gambarUlang()
      requestAnimationFrame(() => {
        const kotak = document.querySelector('[data-peran="cari-analisis"]')
        if (kotak) { kotak.focus(); kotak.setSelectionRange(kotak.value.length, kotak.value.length) }
      })
    }, 300)
  })
  isi.querySelector('[data-peran="kanwil-analisis"]')?.addEventListener('change', (ev) => { pilih.kanwil = ev.target.value; gambarUlang() })
  isi.querySelector('[data-aksi="hanya-baru"]')?.addEventListener('click', () => { pilih.hanyaBaru = !pilih.hanyaBaru; gambarUlang() })
  isi.querySelectorAll('details.analisis-kelompok').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) pilih.buka.add(d.dataset.kanwil); else pilih.buka.delete(d.dataset.kanwil)
  }))
  isi.querySelectorAll('[data-pilih-berita]').forEach((el) => el.addEventListener('click', () => {
    pilih.id = el.dataset.pilihBerita
    gambarUlang()
    requestAnimationFrame(() => document.querySelector('[data-peran="panel-analisis"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }))
  isi.querySelector('[data-aksi="tutup-analisis"]')?.addEventListener('click', () => { pilih.id = null; pilih.uptBuka = null; pilih.cariUpt = ''; pilih.draf = null; gambarUlang() })

  const borang = isi.querySelector('[data-peran="borang-analisis"]')
  const segarPanel = () => { rekamDraf(borang, terpilih?.id); gambarUlang() }

  isi.querySelector('[data-aksi="buka-upt"]')?.addEventListener('click', () => { pilih.uptBuka = terpilih.id; segarPanel() })
  isi.querySelector('[data-aksi="tutup-upt"]')?.addEventListener('click', () => { pilih.uptBuka = null; pilih.cariUpt = ''; segarPanel() })
  // Hasil cari digambar di tempat, bukan lewat gambar ulang seluruh halaman:
  // fokus kotak dan isi borang tetap utuh selama orang mengetik.
  isi.querySelector('[data-peran="cari-upt"]')?.addEventListener('input', (ev) => {
    pilih.cariUpt = ev.target.value
    const wadah = isi.querySelector('[data-peran="hasil-upt"]')
    if (wadah) wadah.innerHTML = hasilCariUpt(keadaan, terpilih)
  })
  isi.querySelector('[data-peran="panel-upt"]')?.addEventListener('click', async (ev) => {
    const nama = ev.target.closest('[data-tetapkan-upt]')?.dataset.tetapkanUpt
    if (!nama || pilih.simpanUpt || !terpilih) return
    const lama = terpilih.nama_upt
    const id = terpilih.id
    let ganti = false
    rekamDraf(borang, id)
    pilih.simpanUpt = true
    gambarUlang()
    try {
      if (KONFIG.mode !== 'demo') {
        const hasil = await perbarui('berita', { id: `eq.${terpilih.id}` }, { nama_upt: nama }, { pilih: 'id,nama_upt' })
        // PATCH yang ditolak RLS tidak melempar galat: jawabannya 200 dengan
        // daftar kosong. Tanpa pemeriksaan ini layar mengumumkan berhasil
        // sementara basis data tidak berubah.
        if (!Array.isArray(hasil) || !hasil.length) {
          throw new Error('Penempatan UPT ditolak: peran Anda tidak berhak mengubah berita ini, atau unitnya di luar wilayah Anda.')
        }
      }
      for (const daftar of [keadaan.berita, keadaan.dalamLingkup]) {
        for (const b of daftar || []) if (b.id === id) b.nama_upt = nama
      }
      terpilih.nama_upt = nama
      ganti = true
      pilih.uptBuka = null
      pilih.cariUpt = ''
      roti(belumTerpetakan(lama) ? `Berita ditempatkan ke ${nama}.` : `UPT diganti: ${lama} → ${nama}.`, 'positif', 4500)
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 7000)
    } finally {
      // Direkam ulang dari borang yang sedang tampil: yang diketik selama
      // menyimpan ikut terbawa ke gambar berikutnya.
      rekamDraf(document.querySelector('[data-peran="borang-analisis"]'), id)
      // Baris "Siapa/di mana" pada draf fakta ikut diperbarui; baris lain yang
      // sudah disunting analis dibiarkan.
      if (ganti && pilih.draf?.nilai?.fakta) {
        pilih.draf.nilai.fakta = pilih.draf.nilai.fakta.replace(/^Siapa\/di mana:.*$/m, barisSiapa(terpilih))
      }
      pilih.simpanUpt = false
      gambarUlang()
    }
  })

  if (borang) {
    pulihkanDraf(borang, terpilih?.id)
    const segarSub = () => {
      for (const nama of ['klarifikasi', 'disposisi']) {
        const centang = borang.querySelector(`[data-bidang="${nama}"]`)
        const sub = borang.querySelector(`[data-sub="${nama}"]`)
        if (sub) sub.hidden = !centang?.checked
      }
    }
    borang.addEventListener('change', segarSub)
    segarSub()

    borang.querySelector('[data-aksi="simpan-analisis"]')?.addEventListener('click', async () => {
      const nilai = (n) => borang.querySelector(`[data-bidang="${n}"]`)
      const ambilNilai = (n) => String(nilai(n)?.value || '').trim()
      const klarifikasi = Boolean(nilai('klarifikasi')?.checked)
      const disposisi = Boolean(nilai('disposisi')?.checked)
      if (!klarifikasi && !disposisi) { roti('Pilih paling sedikit satu tujuan tindak lanjut.', 'sedang'); return }
      if (ambilNilai('fakta').length < 20) { roti('Lengkapi fakta 5W1H lebih dulu.', 'sedang'); return }
      const keIso = (tgl) => (tgl ? new Date(`${tgl}T16:59:00Z`).toISOString() : null) // 23.59 WIB
      pilih.sibuk = true
      gambarUlang()
      try {
        await buatPenanganan({
          berita: terpilih,
          klarifikasi,
          disposisi,
          kanwilPembuat: adalahEksternal(peran),
          analisis: {
            fakta: ambilNilai('fakta'), analisis: ambilNilai('analisis'), prakiraan: ambilNilai('prakiraan'),
            rekomendasi: ambilNilai('rekomendasi'), nilai_sumber: ambilNilai('nilai_sumber'),
            nilai_informasi: ambilNilai('nilai_informasi'), prioritas: prioritasBerita(terpilih),
          },
          instruksi: ambilNilai('instruksi'),
          batas: keIso(ambilNilai(klarifikasi ? 'batas_klarifikasi' : 'batas_disposisi')),
          pimpinan: ambilNilai('pimpinan'),
          isiDisposisi: ambilNilai('isi_disposisi'),
        })
        roti('Analisis tersimpan dan sudah masuk Tindak Lanjut.', 'positif', 4500)
        pilih.id = null
        pilih.draf = null
        pilih.sibuk = false
        document.dispatchEvent(new CustomEvent('buka-halaman', { detail: { halaman: klarifikasi ? 'klarifikasi' : 'disposisi' } }))
      } catch (galat) {
        pilih.sibuk = false
        roti(pesanRamah(galat), 'kritis', 7000)
        gambarUlang()
      }
    })
  }

  return {
    judul: 'Analisis Berita',
    sub: punyaIzin(peran, 'lihat_dasbor')
      ? 'Analisis kasus per kasus, dikelompokkan per kanwil'
      : 'Analisis kasus per kasus untuk berita di wilayah Anda',
  }
}
