/**
 * Penyusun PDF laporan harian.
 *
 * Kenapa berkas ini ada, dan kenapa ia bukan HTML yang dicetak.
 *
 * Laporan di layar sudah rapi dan memang bisa disimpan sebagai PDF lewat menu
 * cetak peramban. Tetapi grup Telegram pimpinan tidak punya peramban: yang bisa
 * dikirim ke sana hanya berkas jadi. Selama ini yang terkirim hanya pesan teks
 * berisi angka, dan angka tanpa uraian menuntut penerimanya membuka dasbor
 * untuk tahu 62 berita negatif itu tentang apa — yang berarti, dalam praktik,
 * tidak ada yang membacanya sampai ada yang bertanya.
 *
 * KENAPA MEMAKAI PUSTAKA LUAR
 *
 * Aturan repositori ini menolak kode pihak ketiga, dan itu aturan yang benar —
 * untuk PERAMBAN. Kalimatnya di README berbunyi "tidak ada kode pihak ketiga
 * yang ditarik saat halaman dibuka", dan alasannya keamanan pengguna. Edge
 * Function berjalan di peladen, sudah menarik @supabase/supabase-js dari
 * esm.sh, dan tidak menyentuh peramban siapa pun.
 *
 * Menulis sendiri berkas PDF sebenarnya bisa: bentuknya sederhana. Yang tidak
 * sederhana adalah tabel lebar huruf Helvetica — 224 angka yang menentukan di
 * mana sebuah baris harus dipatahkan. Menuliskannya dari ingatan menghasilkan
 * laporan yang teksnya melewati batas kertas, dan cacat semacam itu baru
 * ketahuan setelah terkirim ke grup pimpinan. pdf-lib membawa tabel itu apa
 * adanya, dan versinya dipaku supaya tidak berubah sendiri.
 *
 * HURUF DI LUAR WINANSI
 *
 * Huruf baku PDF hanya mengenal WinAnsi. Judul berita media sosial penuh emoji,
 * tanda kutip melengkung, dan panah — dan pdf-lib MELEMPAR GALAT, bukan
 * mengabaikan, ketika menemukannya. Satu emoji pada satu judul akan
 * menggagalkan seluruh laporan hari itu. Karena itu setiap teks dilewatkan
 * `amankanTeks()` lebih dulu.
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'https://esm.sh/pdf-lib@1.17.1'

// Salinan modul aplikasi, dibuat ulang oleh tools/ringkas-fungsi.mjs. Fungsi
// yang sama persis dipakai dasbor dan halaman Kanal Negatif, supaya angka
// "peristiwa" pada lampiran ini tidak pernah berselisih dengan angka di layar.
// @ts-ignore modul JavaScript murni tanpa tipe
import { kelompokkanPeristiwa, sumberAsli } from './peristiwa.js'
// @ts-ignore modul JavaScript murni tanpa tipe
import { bersihkanTeks } from './teks.js'

// ------------------------------------------------------------------- ukuran

const A4 = { lebar: 595.28, tinggi: 841.89 }
const TEPI = 46
const LEBAR_ISI = A4.lebar - TEPI * 2

const WARNA = {
  tinta: rgb(0.09, 0.11, 0.16),
  redup: rgb(0.42, 0.45, 0.52),
  garis: rgb(0.82, 0.84, 0.88),
  biru: rgb(0.11, 0.25, 0.51),
  merah: rgb(0.70, 0.13, 0.13),
  jingga: rgb(0.72, 0.40, 0.05),
  latarLembut: rgb(0.96, 0.97, 0.98),
}

/** Nada warna menurut urgensi, sama seperti yang dipakai layar. */
function nadaUrgensi(u: string) {
  if (u === 'Kritis') return WARNA.merah
  if (u === 'Tinggi') return WARNA.jingga
  return WARNA.redup
}

// -------------------------------------------------------------------- teks

/**
 * Menukar huruf di luar WinAnsi menjadi padanan terdekat, dan membuang sisanya.
 *
 * Yang ditukar bukan pilihan gaya. Tanda kutip melengkung, tanda pisah panjang,
 * dan elipsis muncul di hampir setiap judul media daring; membuangnya begitu
 * saja membuat kalimat terbaca ganjil. Emoji tidak punya padanan dan memang
 * dibuang — tetapi dibuang di sini, satu per satu, bukan dengan menggagalkan
 * seluruh laporan.
 */
export function amankanTeks(nilai: unknown): string {
  const teks = String(nilai ?? '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—―]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•●▪]/g, '-')
    .replace(/[←-⇿]/g, '->')
    .replace(/ /g, ' ')
    .replace(/[\r\n\t]+/g, ' ')

  let hasil = ''
  for (const huruf of teks) {
    const kode = huruf.codePointAt(0) ?? 0
    // WinAnsi mencakup ASCII tercetak dan Latin-1 huruf beraksen. Rentang
    // 0x80–0x9F pada WinAnsi berisi tanda baca khusus yang penanganannya
    // berbeda antar-penyusun; ia dilewati supaya tidak ada kejutan.
    if (kode === 32 || (kode >= 33 && kode <= 126)) hasil += huruf
    else if (kode >= 0xa1 && kode <= 0xff) hasil += huruf
    else hasil += ' '
  }
  return hasil.replace(/ {2,}/g, ' ').trim()
}

/** Memenggal teks menjadi baris yang muat pada lebar tertentu. */
function bungkus(teks: string, font: PDFFont, ukuran: number, lebar: number): string[] {
  const kata = teks.split(' ').filter(Boolean)
  if (!kata.length) return []
  const baris: string[] = []
  let kini = ''

  for (const k of kata) {
    const calon = kini ? `${kini} ${k}` : k
    if (font.widthOfTextAtSize(calon, ukuran) <= lebar) { kini = calon; continue }
    if (kini) baris.push(kini)
    // Satu kata yang lebih panjang dari lebar kertas — tautan panjang, misalnya
    // — dipotong per huruf, bukan dibiarkan melewati tepi.
    if (font.widthOfTextAtSize(k, ukuran) > lebar) {
      let sisa = k
      while (font.widthOfTextAtSize(sisa, ukuran) > lebar) {
        let n = sisa.length
        while (n > 1 && font.widthOfTextAtSize(sisa.slice(0, n), ukuran) > lebar) n -= 1
        baris.push(sisa.slice(0, n))
        sisa = sisa.slice(n)
      }
      kini = sisa
    } else {
      kini = k
    }
  }
  if (kini) baris.push(kini)
  return baris
}

// ------------------------------------------------------------------ kanvas

/**
 * Kanvas yang tahu kapan harus berganti halaman.
 *
 * Tanpa ini, setiap bagian laporan harus menghitung sendiri sisa ruang di
 * bawahnya, dan satu bagian yang lupa menghitung akan menulis di luar kertas —
 * teksnya hilang tanpa satu pun tanda bahwa ia pernah ada.
 */
class Kanvas {
  doc: PDFDocument
  reguler: PDFFont
  tebal: PDFFont
  halaman: PDFPage[] = []
  kini!: PDFPage
  y = 0

  constructor(doc: PDFDocument, reguler: PDFFont, tebal: PDFFont) {
    this.doc = doc
    this.reguler = reguler
    this.tebal = tebal
    this.halamanBaru()
  }

  halamanBaru() {
    this.kini = this.doc.addPage([A4.lebar, A4.tinggi])
    this.halaman.push(this.kini)
    this.y = A4.tinggi - TEPI
  }

  /** Memastikan masih ada ruang setinggi `butuh`; bila tidak, ganti halaman. */
  ruang(butuh: number) {
    if (this.y - butuh < TEPI + 26) this.halamanBaru()
  }

  turun(n: number) { this.y -= n }

  teks(isi: string, opsi: {
    ukuran?: number, tebal?: boolean, warna?: ReturnType<typeof rgb>,
    x?: number, lebar?: number, jarak?: number,
  } = {}) {
    const ukuran = opsi.ukuran ?? 9.5
    const font = opsi.tebal ? this.tebal : this.reguler
    const x = opsi.x ?? TEPI
    const lebar = opsi.lebar ?? (LEBAR_ISI - (x - TEPI))
    const jarak = opsi.jarak ?? ukuran * 1.35
    const baris = bungkus(amankanTeks(isi), font, ukuran, lebar)

    for (const b of baris) {
      this.ruang(jarak)
      this.kini.drawText(b, { x, y: this.y - ukuran, size: ukuran, font, color: opsi.warna ?? WARNA.tinta })
      this.y -= jarak
    }
    return baris.length
  }

  garis(warna = WARNA.garis, tebal = 0.7) {
    this.ruang(6)
    this.kini.drawLine({
      start: { x: TEPI, y: this.y }, end: { x: A4.lebar - TEPI, y: this.y },
      thickness: tebal, color: warna,
    })
    this.y -= 6
  }

  kotak(tinggi: number, warna = WARNA.latarLembut) {
    this.ruang(tinggi)
    this.kini.drawRectangle({
      x: TEPI, y: this.y - tinggi, width: LEBAR_ISI, height: tinggi, color: warna,
    })
  }
}

// ------------------------------------------------------------------ bagian

type Ikhtisar = Record<string, number>

function bagianKop(k: Kanvas, hari: string, nomor: string, keadaan: { label: string, warna: ReturnType<typeof rgb> }) {
  k.teks('KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN', { ukuran: 7.5, warna: WARNA.redup, jarak: 10 })
  k.teks('DIREKTORAT JENDERAL PEMASYARAKATAN  |  DIREKTORAT PENGAMANAN DAN INTELIJEN',
    { ukuran: 7.5, warna: WARNA.redup, jarak: 14 })

  k.teks('Laporan Harian Pemberitaan Negatif', { ukuran: 17, tebal: true, warna: WARNA.biru, jarak: 22 })
  k.teks(`${nomor}   ·   ${hari}`, { ukuran: 9, warna: WARNA.redup, jarak: 16 })

  k.teks(keadaan.label, { ukuran: 10.5, tebal: true, warna: keadaan.warna, jarak: 16 })
  k.garis(WARNA.biru, 1.2)
  k.turun(6)
}

function bagianIkhtisar(k: Kanvas, ikh: Ikhtisar, bnd: Ikhtisar) {
  k.teks('IKHTISAR', { ukuran: 8, tebal: true, warna: WARNA.redup, jarak: 14 })

  const total = ikh.total ?? 0
  const negatif = ikh.negatif ?? 0
  const lalu = bnd.total ?? 0
  const selisih = total - lalu
  const arah = lalu === 0 ? 'tidak ada pembanding periode sebelumnya'
    : selisih > 0 ? `naik ${selisih} dari periode sebelumnya`
    : selisih < 0 ? `turun ${Math.abs(selisih)} dari periode sebelumnya`
    : 'sama dengan periode sebelumnya'

  const bagian = total ? Math.round((negatif / total) * 100) : 0

  k.teks(`${negatif} publikasi negatif`, { ukuran: 20, tebal: true, warna: WARNA.merah, jarak: 24 })
  k.teks(`dari ${total} publikasi yang tercatat (${bagian} persen) - ${arah}`,
    { ukuran: 9, warna: WARNA.redup, jarak: 18 })

  const rinci = [
    `Negatif ${negatif}`,
    `Netral/Campuran ${ikh.netral ?? 0}`,
    `Positif ${ikh.positif ?? 0}`,
  ].join('   |   ')
  const urgensi = [
    `Kritis ${ikh.kritis ?? 0}`,
    `Tinggi ${ikh.tinggi ?? 0}`,
    `Sedang ${ikh.sedang ?? 0}`,
    `Rendah ${ikh.rendah ?? 0}`,
  ].join('   |   ')

  k.teks(`Sentimen   ${rinci}`, { ukuran: 9, jarak: 14 })
  k.teks(`Urgensi    ${urgensi}`, { ukuran: 9, jarak: 14 })
  k.teks(`Jangkauan  ${ikh.upt_tersorot ?? 0} UPT tersorot   |   ${ikh.media_unik ?? 0} media   |   `
    + `${ikh.belum_terpetakan ?? 0} publikasi belum terpetakan ke unit`,
    { ukuran: 9, jarak: 18 })

  k.garis()
  k.turun(4)
}

/**
 * Keterangan singkat sebuah peristiwa, bila ada yang layak ditulis.
 *
 * Ringkasan yang datang dari crawler hampir seluruhnya templat: "TOPIK: Isu
 * Potensial (Rule-Based) SKOR ANCAMAN: 2/5 ... REKOMENDASI: Verifikasi
 * lapangan", kalimat yang sama untuk hampir setiap baris. `bersihkanTeks()`
 * sudah tahu bentuknya dan membuangnya — modul yang sama dipakai mesin
 * klasifikasi. Sisanya kerap hanya mengulang judul; pengulangan itu ikut
 * dibuang, sebab satu kalimat yang sama dua kali berturut-turut membuat
 * pembacanya berhenti membaca yang berikutnya.
 */
function keteranganPeristiwa(p: any): string {
  const judul = amankanTeks(p.judul)
  for (const pub of (p.publikasi ?? [])) {
    const bersih = amankanTeks(bersihkanTeks(pub.ringkasan ?? ''))
    if (bersih.length < 40) continue
    const awalSama = bersih.slice(0, 40).toLowerCase() === judul.slice(0, 40).toLowerCase()
    if (awalSama) continue
    return bersih.slice(0, 300)
  }
  return ''
}

function bagianUraian(k: Kanvas, rincian: any): number {
  const publikasi: any[] = rincian?.publikasi ?? []
  const jumlah = Number(rincian?.jumlah ?? 0)
  const diambil = Number(rincian?.diambil ?? publikasi.length)

  if (!jumlah) {
    k.teks('URAIAN MENURUT KELOMPOK ISU', { ukuran: 8, tebal: true, warna: WARNA.redup, jarak: 16 })
    k.teks('Tidak ada publikasi negatif pada periode ini.', { ukuran: 9.5, warna: WARNA.redup, jarak: 16 })
    return 0
  }

  // Publikasi disatukan menjadi peristiwa dengan mesin yang sama seperti layar.
  const peristiwa: any[] = kelompokkanPeristiwa(publikasi)

  // Peristiwa dikelompokkan menurut kategori lalu subkategori — susunan
  // taksonomi yang sama dengan yang dipakai halaman Kanal Negatif.
  const perKategori = new Map<string, Map<string, any[]>>()
  for (const p of peristiwa) {
    const kat = p.kategori || 'Lainnya'
    const sub = p.subkategori || 'Belum Dikelompokkan'
    if (!perKategori.has(kat)) perKategori.set(kat, new Map())
    const peta = perKategori.get(kat)!
    if (!peta.has(sub)) peta.set(sub, [])
    peta.get(sub)!.push(p)
  }

  const bobot = (u: string) => (u === 'Kritis' ? 1 : u === 'Tinggi' ? 2 : u === 'Sedang' ? 3 : 4)
  const kategoriUrut = [...perKategori.entries()].sort((a, b) => {
    const pa = Math.min(...[...a[1].values()].flat().map((p: any) => bobot(p.urgensi)))
    const pb = Math.min(...[...b[1].values()].flat().map((p: any) => bobot(p.urgensi)))
    if (pa !== pb) return pa - pb
    const na = [...a[1].values()].flat().length
    const nb = [...b[1].values()].flat().length
    return nb - na
  })

  k.teks('URAIAN MENURUT KELOMPOK ISU', { ukuran: 8, tebal: true, warna: WARNA.redup, jarak: 14 })
  k.teks(`${peristiwa.length} peristiwa dari ${jumlah} publikasi negatif. `
    + `Publikasi yang memberitakan kejadian yang sama disatukan, seperti pada dasbor.`,
    { ukuran: 8.5, warna: WARNA.redup, jarak: 16 })

  // Pemotongan dikatakan di muka, bukan disembunyikan di kaki halaman.
  if (diambil < jumlah) {
    k.teks(`Hanya ${diambil} publikasi teratas yang diuraikan; sisanya dapat dibaca pada dasbor.`,
      { ukuran: 8.5, warna: WARNA.jingga, jarak: 16 })
  }

  let nomor = 0
  for (const [kategori, subPeta] of kategoriUrut) {
    const nPeristiwa = [...subPeta.values()].flat().length
    const nPublikasi = [...subPeta.values()].flat()
      .reduce((j: number, p: any) => j + (p.jumlah_publikasi ?? 1), 0)

    k.ruang(52)
    k.turun(4)
    k.teks(`${amankanTeks(kategori)}  (${nPeristiwa} peristiwa, ${nPublikasi} publikasi)`,
      { ukuran: 11, tebal: true, warna: WARNA.biru, jarak: 17 })

    for (const [subkategori, daftar] of subPeta) {
      k.ruang(40)
      k.teks(`${amankanTeks(subkategori)} - ${daftar.length} peristiwa`,
        { ukuran: 9, tebal: true, warna: WARNA.tinta, jarak: 15 })

      for (const p of daftar.sort((a: any, b: any) => bobot(a.urgensi) - bobot(b.urgensi))) {
        nomor += 1
        // Judul dan keterangannya diusahakan tidak terpisah halaman. Angka 44
        // adalah tinggi paling pendek yang mungkin: satu baris judul, satu
        // baris keterangan, plus jarak.
        k.ruang(44)
        k.teks(`${nomor}. ${amankanTeks(p.judul)}`, { ukuran: 9.5, x: TEPI + 10, jarak: 13 })

        const media = (p.daftar_media ?? []).map((m: unknown) => amankanTeks(m)).filter(Boolean)
        const sebutMedia = p.jumlah_publikasi > 1
          ? `${p.jumlah_publikasi} publikasi di ${p.jumlah_media} media`
          : (media[0] || amankanTeks(sumberAsli(p.publikasi?.[0] ?? {})) || 'media tidak diketahui')

        const tgl = String(p.tanggal_terakhir ?? p.tanggal_pertama ?? '').slice(0, 10)
        const meta = [
          p.nama_upt && String(p.nama_upt).trim() ? p.nama_upt : 'Belum terpetakan',
          p.urgensi,
          sebutMedia,
          tgl.split('-').reverse().join('-'),
        ].map((x: unknown) => amankanTeks(x)).filter(Boolean).join('   ·   ')

        k.teks(meta, { ukuran: 8, x: TEPI + 20, warna: nadaUrgensi(String(p.urgensi ?? '')), jarak: 12 })

        const ket = keteranganPeristiwa(p)
        if (ket) k.teks(ket, { ukuran: 8, x: TEPI + 20, warna: WARNA.redup, jarak: 11 })

        // Media yang memberitakan disebut namanya bila lebih dari satu. Ini
        // yang membedakan satu kejadian yang ramai dari satu kejadian yang
        // hanya diberitakan sekali.
        if (p.jumlah_publikasi > 1 && media.length) {
          k.teks(`Diberitakan: ${media.slice(0, 6).join(', ')}${media.length > 6 ? ', dan lainnya' : ''}`,
            { ukuran: 7.5, x: TEPI + 20, warna: WARNA.redup, jarak: 11 })
        }
        k.turun(4)
      }
      k.turun(2)
    }
  }

  return peristiwa.length
}

function bagianKaki(k: Kanvas, dibuat: string) {
  const jumlah = k.halaman.length
  k.halaman.forEach((hal, i) => {
    const teks = amankanTeks(
      `Trans-Siber PAS - disusun otomatis ${dibuat} WIB - halaman ${i + 1} dari ${jumlah}`,
    )
    hal.drawLine({
      start: { x: TEPI, y: TEPI + 16 }, end: { x: A4.lebar - TEPI, y: TEPI + 16 },
      thickness: 0.5, color: WARNA.garis,
    })
    hal.drawText(teks, { x: TEPI, y: TEPI + 5, size: 7.5, font: k.reguler, color: WARNA.redup })
  })
}

// ------------------------------------------------------------------- utama

export type BahanLaporan = {
  hari: string
  nomor: string
  dibuat: string
  ikhtisar: Ikhtisar
  pembanding: Ikhtisar
  rincian: unknown
}

/** Menyusun seluruh laporan dan mengembalikannya sebagai base64. */
export async function susunPdf(bahan: BahanLaporan): Promise<{ base64: string, halaman: number, bita: number, peristiwa: number }> {
  const doc = await PDFDocument.create()
  doc.setTitle(`Laporan Harian Pemberitaan Negatif ${bahan.hari}`)
  doc.setAuthor('Trans-Siber PAS - Direktorat Pengamanan dan Intelijen')
  doc.setSubject('Laporan intelijen pemberitaan pemasyarakatan')
  doc.setProducer('Trans-Siber PAS')

  const reguler = await doc.embedFont(StandardFonts.Helvetica)
  const tebal = await doc.embedFont(StandardFonts.HelveticaBold)
  const k = new Kanvas(doc, reguler, tebal)

  const ikh = bahan.ikhtisar ?? {}
  const keadaan = (ikh.kritis ?? 0) > 0
    ? { label: 'PERLU PERHATIAN SEGERA', warna: WARNA.merah }
    : ((ikh.tinggi ?? 0) > 0 || (ikh.total ? (ikh.negatif ?? 0) / ikh.total >= 0.35 : false))
      ? { label: 'PERLU DICERMATI', warna: WARNA.jingga }
      : { label: 'TERKENDALI', warna: WARNA.biru }

  bagianKop(k, bahan.hari, bahan.nomor, keadaan)
  bagianIkhtisar(k, ikh, bahan.pembanding ?? {})
  const nPeristiwa = bagianUraian(k, bahan.rincian)
  bagianKaki(k, bahan.dibuat)

  const bita = await doc.save()
  let biner = ''
  for (const b of bita) biner += String.fromCharCode(b)
  return { base64: btoa(biner), halaman: k.halaman.length, bita: bita.length, peristiwa: nPeristiwa }
}
