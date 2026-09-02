/**
 * Penyusun pesan Telegram.
 *
 * Telegram bukan tempat membaca laporan lengkap. Ia tempat orang tahu, dalam
 * sepuluh detik, apakah ada sesuatu yang menuntut perhatiannya malam ini. Maka
 * yang disusun di sini sengaja pendek: keadaan, angka pokok, tiga peristiwa
 * teratas, dan satu kalimat tentang apa yang harus dilakukan. Laporan utuhnya
 * ikut sebagai lampiran, untuk yang memang mau membacanya.
 *
 * Sistem lama mengirimkan sesuatu yang lain: ketika penarikan data gagal, ia
 * membuat dua baris berita fiktif — lengkap dengan nama unit dan ringkasan
 * kejadian yang tidak pernah terjadi — lalu mengirimkannya sebagai laporan
 * resmi ke grup pimpinan, "agar workflow sukses berjalan". Modul ini tidak
 * memiliki jalur semacam itu. Bila datanya kosong, yang terkirim adalah
 * kalimat yang menyatakan datanya kosong.
 *
 * Ragam HTML yang diterima Telegram sangat terbatas: b, i, u, s, a, code, pre.
 * Tidak ada div, tidak ada br, tidak ada daftar. Pindah baris adalah pindah
 * baris sungguhan. Batas satu pesan 4096 karakter, dan pesan yang melewatinya
 * ditolak seluruhnya, bukan dipotong.
 */

import { angka, tanggal, tanggalPanjang } from './format.js'
import { nilaiKeadaan, susunRekomendasi } from './laporan.js'

/** Batas aman satu pesan. Telegram menolak di 4096; sisanya untuk jaga-jaga. */
export const BATAS_PESAN = 3900

/**
 * Telegram hanya mengenal empat entitas yang harus dilepas. Melepas lebih dari
 * itu — tanda kutip, misalnya — justru membuat tanda kutip muncul sebagai
 * &quot; di layar penerima.
 */
export function lepas(teks) {
  return String(teks ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Mengambil kalimat rekomendasi dari mesin laporan.
 *
 * Kalimat itu sudah berbentuk HTML. Seluruh tandanya dibuang di sini, bukan
 * disaring, karena kalimatnya masih harus dipotong agar muat — dan pemotongan
 * yang jatuh di tengah sebuah tanda membuat Telegram menolak seluruh pesan,
 * bukan hanya baris itu. Penebalan pada satu nama unit tidak sepadan dengan
 * risiko laporan malam yang tidak terkirim sama sekali.
 *
 * Spasi ikut dirapatkan: kalimatnya ditulis menjadi beberapa baris di dalam
 * kode, dan pindah baris di Telegram adalah pindah baris sungguhan.
 */
function dariHtmlLaporan(html) {
  const teks = String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
  return lepas(pendek(teks, 220))
}

/** Memotong pada batas kata dan menambahkan elipsis bila perlu. */
function pendek(teks, maks) {
  const t = String(teks ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= maks) return t
  const potong = t.slice(0, maks)
  const spasi = potong.lastIndexOf(' ')
  return `${potong.slice(0, spasi > maks * 0.6 ? spasi : maks)}…`
}

const LAMBANG_KEADAAN = {
  SIAGA: '🔴',
  'PERLU PERHATIAN': '🟠',
  TERPANTAU: '🟡',
  TERKENDALI: '🟢',
}

const LAMBANG_URGENSI = { Kritis: '🔴', Tinggi: '🟠', Sedang: '🟡', Rendah: '⚪' }

/**
 * Ringkasan berkala untuk grup pimpinan.
 *
 * @param {object} olahan hasil olahLaporan()
 * @param {object} [opsi]
 * @param {'harian'|'mingguan'|'bulanan'} [opsi.jenis]
 * @param {string} [opsi.nomor] nomor laporan
 * @param {string} [opsi.klasifikasi] tingkat klasifikasi yang tercetak di kaki
 * @returns {string} HTML sesuai ragam Telegram
 */
export function pesanLaporan(olahan, opsi = {}) {
  const jenis = opsi.jenis || 'mingguan'
  const { ikhtisar, periode, konteks, peristiwa, daftarUnit } = olahan
  const keadaan = nilaiKeadaan(olahan)

  const namaJenis = { harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan' }[jenis] || 'Berkala'
  const rentang = periode.mulai === periode.selesai
    ? tanggalPanjang(periode.selesai)
    : `${tanggal(periode.mulai)} – ${tanggal(periode.selesai)}`

  const baris = []

  baris.push(`${LAMBANG_KEADAAN[keadaan.label] || '🔵'} <b>LAPORAN INTELIJEN PEMBERITAAN ${namaJenis.toUpperCase()}</b>`)
  baris.push(`<i>${lepas(rentang)}</i>`)
  if (opsi.nomor) baris.push(`<code>${lepas(opsi.nomor)}</code>`)
  baris.push('')

  baris.push(`<b>Keadaan: ${lepas(keadaan.label)}</b>`)
  baris.push(lepas(keadaan.kalimat))
  baris.push('')

  // Angka pokok. Empat, tidak lebih — daftar angka yang panjang di layar
  // telepon berhenti terbaca sebagai angka dan mulai terbaca sebagai blok.
  baris.push('<b>Angka pokok</b>')
  baris.push(`• Peristiwa negatif: <b>${angka(ikhtisar.peristiwa)}</b> dari ${angka(ikhtisar.publikasi)} publikasi`)
  baris.push(`• Menuntut respons: <b>${angka(ikhtisar.mendesak)}</b>${ikhtisar.kritis ? ` (${angka(ikhtisar.kritis)} kritis)` : ''}`)
  baris.push(`• UPT terdampak: <b>${angka(ikhtisar.unit)}</b>`)
  if (konteks.total) {
    const porsi = ((ikhtisar.publikasi / konteks.total) * 100).toFixed(1).replace('.', ',')
    baris.push(`• Porsi terhadap seluruh pemberitaan: <b>${porsi}%</b>`)
  }
  baris.push('')

  if (!peristiwa.length) {
    baris.push('<i>Tidak ada peristiwa negatif terpantau pada periode ini. '
      + 'Periode sepi adalah keadaan yang sah — pastikan saja sinkronisasi sumber '
      + 'memang berjalan pada rentang tanggal tersebut.</i>')
  } else {
    baris.push('<b>Peristiwa teratas</b>')
    for (const p of peristiwa.slice(0, 3)) {
      const lambang = LAMBANG_URGENSI[p.urgensi] || '⚪'
      baris.push(`${lambang} <b>${lepas(pendek(p.judul, 110))}</b>`)
      const rinci = [p.subkategori, p.nama_upt, `${angka(p.jumlah_publikasi)} publikasi`]
        .filter(Boolean).join(' · ')
      baris.push(`   <i>${lepas(rinci)}</i>`)
    }
    baris.push('')

    const naik = olahan.uptNaik || daftarUnit
    if (naik.length) {
      baris.push(...baganBatangTeks(naik, jenis))
      baris.push('')
    }
  }

  const saran = susunRekomendasi(olahan)
  if (saran.length) {
    baris.push('<b>Rekomendasi</b>')
    for (const r of saran.slice(0, 3)) {
      const teks = dariHtmlLaporan(r)
      if (teks) baris.push(`• ${teks}`)
    }
    baris.push('')
  }

  baris.push(`<i>Klasifikasi: ${lepas(opsi.klasifikasi || 'Internal')}. `
    + 'Disusun otomatis oleh Trans-Siber PAS dari data terklasifikasi mesin. '
    + 'Laporan utuh terlampir.</i>')

  return rapikan(baris)
}

/**
 * Diagram batang "UPT naik ke permukaan", digambar dari karakter blok.
 *
 * Telegram tidak menggambarkan apa pun di dalam pesan, dan lampiran PDF baru
 * terbuka setelah seseorang menekannya. Yang harus terbaca dalam sepuluh detik
 * karena itu harus muat sebagai teks — dan batang dari karakter blok di dalam
 * <code> adalah satu-satunya bentuk yang tetap sejajar di layar telepon,
 * sebab hanya <code> yang dirender dengan huruf berlebar tetap.
 *
 * Nama unit dan batangnya sengaja dipisah dua baris. Digabung satu baris,
 * "Lapas Perempuan Kelas IIA Martapura" mendorong batangnya keluar layar pada
 * telepon mana pun, dan yang tersisa terbaca hanya namanya.
 *
 * Pembandingnya ikut dicetak. Delapan publikasi di unit yang pekan lalu juga
 * delapan adalah keadaan tenang; delapan di unit yang pekan lalu nol adalah
 * keadaan yang harus dibaca malam ini juga.
 */
function baganBatangTeks(daftar, jenis, maks = 5) {
  const butir = (daftar || []).filter((u) => u.publikasi > 0).slice(0, maks)
  if (!butir.length) return []

  const rentang = { harian: 'hari ini', mingguan: 'pekan ini', bulanan: 'bulan ini' }[jenis] || 'periode ini'
  const tertinggi = Math.max(1, ...butir.map((u) => u.publikasi))

  const baris = [`<b>UPT naik ke permukaan — ${lepas(rentang)}</b>`]
  for (const u of butir) {
    const panjang = Math.max(1, Math.round((u.publikasi / tertinggi) * 12))
    const sebelum = u.sebelum ?? null
    const delta = sebelum === null ? null : u.publikasi - sebelum
    const catatan = sebelum === null ? ''
      : sebelum === 0 ? ' — <b>baru muncul</b>'
        : delta > 0 ? ` — naik ${delta}`
          : delta < 0 ? ` — turun ${Math.abs(delta)}`
            : ' — tetap'

    baris.push(`• ${lepas(pendek(u.nama, 60))}`)
    baris.push(`   <code>${'█'.repeat(panjang)}</code> ${angka(u.publikasi)}${catatan}`)
  }
  return baris
}

/**
 * Peringatan dini untuk satu peristiwa yang menuntut respons segera.
 *
 * Dipisahkan dari laporan berkala karena keduanya dibaca dengan cara berbeda:
 * laporan dibaca ketika sempat, peringatan harus terbaca sekarang. Maka
 * bentuknya pendek, dan tidak memuat satu pun angka rekapitulasi.
 */
export function pesanPeringatan(berita, opsi = {}) {
  const urgensi = berita.urgensi || 'Tinggi'
  const lambang = LAMBANG_URGENSI[urgensi] || '🟠'

  const baris = []
  baris.push(`${lambang} <b>PERINGATAN DINI — ${lepas(urgensi.toUpperCase())}</b>`)
  baris.push('')
  baris.push(`<b>${lepas(pendek(berita.judul, 200))}</b>`)
  baris.push('')

  const rinci = []
  if (berita.nama_upt) rinci.push(['UPT', berita.nama_upt])
  if (berita.subkategori) rinci.push(['Isu', berita.subkategori])
  if (berita.media) rinci.push(['Sumber', berita.media])
  if (berita.tanggal_publikasi || berita.created_at) {
    rinci.push(['Terbit', tanggal(berita.tanggal_publikasi || berita.created_at)])
  }
  for (const [k, v] of rinci) baris.push(`<b>${lepas(k)}:</b> ${lepas(v)}`)

  if (berita.ringkasan) {
    baris.push('')
    baris.push(lepas(pendek(berita.ringkasan, 600)))
  }

  if (berita.link) {
    baris.push('')
    baris.push(`<a href="${lepas(berita.link)}">Buka tautan berita</a>`)
  }

  baris.push('')
  // Status telaah ikut disebutkan dengan sengaja. Peringatan yang dikirim
  // sebelum ditelaah analis tetap layak dikirim — kecepatan memang gunanya —
  // tetapi penerimanya berhak tahu bahwa isinya belum diperiksa manusia.
  const status = berita.status_verifikasi || 'Belum Ditelaah'
  baris.push(status === 'Terverifikasi'
    ? '<i>Sudah diverifikasi analis.</i>'
    : `<i>Status: ${lepas(status)}. Isi peringatan ini belum diperiksa analis dan dapat berubah.</i>`)

  if (opsi.oleh) baris.push(`<i>Dikirim oleh ${lepas(opsi.oleh)}.</i>`)

  return rapikan(baris)
}

/**
 * Menggabungkan baris menjadi satu pesan, membuang baris kosong beruntun, dan
 * memastikan hasilnya tidak melewati batas Telegram.
 *
 * Pemotongan dilakukan pada batas baris, bukan pada batas karakter. Pesan yang
 * terpotong di tengah tanda HTML akan ditolak seluruhnya oleh Telegram, dan
 * penolakan itu baru terlihat ketika laporan sudah waktunya terkirim.
 */
function rapikan(baris) {
  const bersih = []
  for (const b of baris) {
    if (b === '' && bersih[bersih.length - 1] === '') continue
    bersih.push(b)
  }
  while (bersih[bersih.length - 1] === '') bersih.pop()

  let hasil = bersih.join('\n')
  if (hasil.length <= BATAS_PESAN) return hasil

  const dipakai = []
  let panjang = 0
  for (const b of bersih) {
    if (panjang + b.length + 1 > BATAS_PESAN - 60) break
    dipakai.push(b)
    panjang += b.length + 1
  }
  dipakai.push('')
  dipakai.push('<i>Sebagian isi dipotong agar muat dalam satu pesan. Rincian lengkapnya ada pada lampiran.</i>')
  hasil = dipakai.join('\n')
  return hasil
}

export const META_PESAN = { versi: 'pesan-telegram-v1.0', batas: BATAS_PESAN }
