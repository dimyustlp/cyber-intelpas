/**
 * Menggambar lembar infografis ke dalam PDF, dari SVG yang sama persis dengan
 * yang tampil di layar.
 *
 * KENAPA PENERJEMAH, BUKAN PENGGAMBAR KEDUA
 *
 * Pilihan yang jelas adalah menulis ulang tiap panel dengan perintah pdf-lib:
 * satu fungsi untuk kepala, satu untuk donat, satu untuk peta, dan seterusnya.
 * Itu berarti DUA penggambar untuk satu lembar — dan dua penggambar untuk satu
 * lembar berarti, cepat atau lambat, dua lembar. Yang di layar diperbaiki
 * ketika ada yang mengeluh; yang di PDF tidak, sebab tidak ada yang melihatnya
 * kecuali sebagai lampiran yang sudah telanjur terkirim.
 *
 * Yang dikerjakan berkas ini karena itu bukan menggambar lembar, melainkan
 * menerjemahkan gambar yang sudah jadi. Untungnya penggambarnya —
 * ui/infografis-svg.js — hanya memakai LIMA bentuk: rect, text, path, circle,
 * dan g dengan transform translate/scale. Penerjemah untuk lima bentuk yang
 * kita tulis sendiri jauh lebih kecil daripada penggambar kedua, dan ia tidak
 * bisa "lupa" mengikuti perubahan tata letak: perubahan apa pun di layar
 * langsung ikut tercetak.
 *
 * INI BUKAN PENERJEMAH SVG UMUM. Ia hanya mengerti keluaran penggambar kita
 * sendiri. Menambahkan bentuk baru di sana menuntut penanganannya ditambahkan
 * di sini — dan bentuk yang tidak dikenal SENGAJA melempar galat, bukan
 * dilewati diam-diam. Bentuk yang hilang tanpa suara menghasilkan lembar yang
 * terlihat hampir benar, dan hampir benar adalah bentuk kesalahan yang paling
 * lama bertahan.
 */

import {
  rgb,
  type PDFFont,
  type PDFPage,
  type RGB,
} from 'https://esm.sh/pdf-lib@1.17.1'

/** Warna heksadesimal menjadi warna pdf-lib. */
function warna(nilai: string | undefined): RGB | null {
  if (!nilai || nilai === 'none' || nilai === 'transparent') return null
  const n = nilai.trim().replace('#', '')
  if (n.length === 3) {
    const [r, g, b] = n.split('')
    return rgb(parseInt(r + r, 16) / 255, parseInt(g + g, 16) / 255, parseInt(b + b, 16) / 255)
  }
  if (n.length !== 6) return null
  return rgb(
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  )
}

/** Membaca seluruh atribut sebuah tag menjadi objek biasa. */
function atribut(tag: string): Record<string, string> {
  const hasil: Record<string, string> = {}
  const pola = /([a-zA-Z-]+)="([^"]*)"/g
  let cocok: RegExpExecArray | null
  while ((cocok = pola.exec(tag)) !== null) hasil[cocok[1]] = cocok[2]
  return hasil
}

function angka(nilai: string | undefined, bawaan = 0): number {
  const n = Number(nilai)
  return Number.isFinite(n) ? n : bawaan
}

/** Melepas kembali kelima entitas yang dipasang penggambar. */
function lepasEntitas(teks: string): string {
  return teks
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

/**
 * Persegi bersudut tumpul sebagai jalur.
 *
 * pdf-lib tidak punya persegi bersudut tumpul, dan `drawRectangle` bersudut
 * tajam pada lembar yang seluruh kartunya tumpul terbaca seperti lembar yang
 * gagal dimuat. Lengkungnya didekati kurva Bézier — bukan busur — sebab busur
 * ('A') tidak selalu ada pada setiap versi penafsir jalur pdf-lib, sedangkan
 * kurva kubik selalu ada.
 */
function jalurKotakTumpul(x: number, y: number, l: number, t: number, r: number): string {
  const j = Math.max(0, Math.min(r, l / 2, t / 2))
  if (!j) return `M${x} ${y}L${x + l} ${y}L${x + l} ${y + t}L${x} ${y + t}Z`
  // 0,5523 — pendekatan seperempat lingkaran dengan satu kurva kubik.
  const k = j * 0.5523
  return `M${x + j} ${y}`
    + `L${x + l - j} ${y}C${x + l - j + k} ${y} ${x + l} ${y + j - k} ${x + l} ${y + j}`
    + `L${x + l} ${y + t - j}C${x + l} ${y + t - j + k} ${x + l - j + k} ${y + t} ${x + l - j} ${y + t}`
    + `L${x + j} ${y + t}C${x + j - k} ${y + t} ${x} ${y + t - j + k} ${x} ${y + t - j}`
    + `L${x} ${y + j}C${x} ${y + j - k} ${x + j - k} ${y} ${x + j} ${y}Z`
}

interface Keadaan {
  geserX: number
  geserY: number
  skala: number
  isi?: string
  garis?: string
  tebalGaris?: number
  buram?: number
}

export interface HurufLembar {
  biasa: PDFFont
  tebal: PDFFont
}

/**
 * Menggambar satu SVG ke satu halaman PDF.
 *
 * @param halaman  halaman tujuan, ukurannya sudah ditetapkan pemanggil
 * @param svg      keluaran svgInfografis()
 * @param huruf    dua huruf baku; berat >= 600 memakai yang tebal
 * @param amankan  penukar aksara di luar WinAnsi (pdf-lib melempar galat, bukan mengabaikan)
 */
export function gambarSvg(
  halaman: PDFPage,
  svg: string,
  huruf: HurufLembar,
  amankan: (nilai: unknown) => string,
): void {
  const kotakPandang = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  if (!kotakPandang) throw new Error('SVG tanpa viewBox; penerjemah tidak tahu skalanya.')
  const lebarRancang = Number(kotakPandang[1])
  const tinggiRancang = Number(kotakPandang[2])

  const { width: lebarHalaman, height: tinggiHalaman } = halaman.getSize()
  // Skala tunggal, bukan dua. Skala berbeda untuk lebar dan tinggi membuat
  // lingkaran menjadi lonjong dan peta melar — dan keduanya tidak terlihat
  // salah sampai seseorang membandingkannya dengan layar.
  const skala = Math.min(lebarHalaman / lebarRancang, tinggiHalaman / tinggiRancang)

  const tumpukan: Keadaan[] = [{ geserX: 0, geserY: 0, skala: 1 }]
  const kini = () => tumpukan[tumpukan.length - 1]

  /* Titik rancangan menjadi titik halaman. Sumbu Y dibalik: SVG menghitung ke
     bawah dari tepi atas, PDF ke atas dari tepi bawah. */
  const keX = (x: number) => (kini().geserX + x * kini().skala) * skala
  const keY = (y: number) => tinggiHalaman - (kini().geserY + y * kini().skala) * skala
  const keUkuran = (n: number) => n * kini().skala * skala

  const pola = /<(rect|text|circle|path|g|\/g|svg|\/svg)\b([^>]*?)(\/?)>([^<]*)/g
  let cocok: RegExpExecArray | null

  while ((cocok = pola.exec(svg)) !== null) {
    const [, nama, isiTag, tutupSendiri, teksIsi] = cocok
    const a = atribut(isiTag)

    if (nama === 'svg' || nama === '/svg') continue

    if (nama === 'g') {
      const t = a.transform || ''
      const geser = t.match(/translate\(([-\d.]+)[ ,]+([-\d.]+)\)/)
      const kali = t.match(/scale\(([-\d.]+)\)/)
      const induk = kini()
      const s = kali ? Number(kali[1]) : 1
      tumpukan.push({
        geserX: induk.geserX + (geser ? Number(geser[1]) * induk.skala : 0),
        geserY: induk.geserY + (geser ? Number(geser[2]) * induk.skala : 0),
        skala: induk.skala * s,
        isi: a.fill ?? induk.isi,
        garis: a.stroke ?? induk.garis,
        tebalGaris: a['stroke-width'] != null ? Number(a['stroke-width']) : induk.tebalGaris,
        buram: a.opacity != null ? Number(a.opacity) : induk.buram,
      })
      continue
    }

    if (nama === '/g') {
      if (tumpukan.length > 1) tumpukan.pop()
      continue
    }

    const warisan = kini()
    const buram = a.opacity != null ? Number(a.opacity) : warisan.buram
    const isiWarna = warna(a.fill ?? warisan.isi ?? '#000000')
    const garisWarna = warna(a.stroke ?? warisan.garis)
    const tebalGaris = a['stroke-width'] != null
      ? Number(a['stroke-width'])
      : (warisan.tebalGaris ?? 1)

    if (nama === 'rect') {
      const x = angka(a.x)
      const y = angka(a.y)
      const l = angka(a.width)
      const t = angka(a.height)
      const r = angka(a.rx)
      if (l <= 0 || t <= 0) continue
      if (r > 0) {
        halaman.drawSvgPath(jalurKotakTumpul(x, y, l, t, r), {
          x: keX(0),
          y: keY(0),
          scale: kini().skala * skala,
          color: isiWarna ?? undefined,
          borderColor: garisWarna ?? undefined,
          borderWidth: garisWarna ? keUkuran(tebalGaris) : undefined,
          opacity: buram,
          borderOpacity: buram,
        })
      } else {
        halaman.drawRectangle({
          x: keX(x),
          y: keY(y + t),
          width: keUkuran(l),
          height: keUkuran(t),
          color: isiWarna ?? undefined,
          borderColor: garisWarna ?? undefined,
          borderWidth: garisWarna ? keUkuran(tebalGaris) : undefined,
          opacity: buram,
          borderOpacity: buram,
        })
      }
      continue
    }

    if (nama === 'circle') {
      const jari = keUkuran(angka(a.r))
      if (jari <= 0) continue
      halaman.drawCircle({
        x: keX(angka(a.cx)),
        y: keY(angka(a.cy)),
        size: jari,
        color: isiWarna ?? undefined,
        borderColor: garisWarna ?? undefined,
        borderWidth: garisWarna ? keUkuran(tebalGaris) : undefined,
        opacity: buram,
        borderOpacity: buram,
      })
      continue
    }

    if (nama === 'path') {
      if (!a.d) continue
      halaman.drawSvgPath(a.d, {
        x: keX(0),
        y: keY(0),
        scale: kini().skala * skala,
        color: isiWarna ?? undefined,
        borderColor: garisWarna ?? undefined,
        borderWidth: garisWarna ? keUkuran(tebalGaris) : undefined,
        opacity: buram,
        borderOpacity: buram,
      })
      continue
    }

    if (nama === 'text') {
      if (tutupSendiri) continue
      const isi = amankan(lepasEntitas(teksIsi))
      if (!isi.trim()) continue
      const berat = Number(a['font-weight'] || 400)
      const font = berat >= 600 ? huruf.tebal : huruf.biasa
      const ukuran = keUkuran(angka(a['font-size'], 12))
      if (ukuran <= 0) continue

      let x = keX(angka(a.x))
      const rata = a['text-anchor']
      if (rata === 'middle' || rata === 'end') {
        const lebar = font.widthOfTextAtSize(isi, ukuran)
        x -= rata === 'middle' ? lebar / 2 : lebar
      }

      halaman.drawText(isi, {
        x,
        y: keY(angka(a.y)),
        size: ukuran,
        font,
        color: isiWarna ?? rgb(0, 0, 0),
        opacity: buram,
      })
      continue
    }

    throw new Error(`Bentuk SVG "${nama}" belum ditangani penerjemah PDF.`)
  }
}
