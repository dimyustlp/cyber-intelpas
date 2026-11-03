/**
 * Penulis buku kerja Excel (.xlsx) tanpa pustaka luar.
 *
 * ## Mengapa bukan CSV saja
 *
 * CSV tidak membawa pemisah kolomnya sendiri; Excel memakai pemisah daftar
 * dari setelan wilayah Windows. Pada komputer berbahasa Indonesia pemisah itu
 * titik koma, sehingga CSV berpemisah koma terbuka sebagai SATU kolom panjang
 * berisi seluruh baris — berkas yang dikeluhkan "berantakan" pada 3 November
 * 2026. Menukar ke titik koma hanya memindahkan masalahnya ke komputer
 * berbahasa Inggris. Berkas .xlsx membawa kolomnya sendiri, jadi tampil sama
 * di mana pun, dan sekaligus bisa membawa lebar kolom, baris judul yang
 * dibekukan, saringan, dan lembar keterangan terpisah.
 *
 * ## Bentuknya
 *
 * Arsip ZIP tanpa pemampatan (metode "stored") berisi XML SpreadsheetML
 * paling sederhana: teks sebagai inline string, tanpa tabel string bersama.
 * Excel, LibreOffice, dan Google Sheets sama-sama membukanya. Ukurannya kira-
 * kira dua kali CSV yang sama, dan itu harga yang wajar untuk tidak menarik
 * pustaka 400 KiB ke aplikasi tanpa langkah build.
 *
 * Gaya sel yang tersedia (indeks `s`):
 *   0 biasa · 1 judul kolom · 2 teks membungkus · 3 tebal · 4 judul lembar
 *   5 sorotan merah (negatif/mendesak) · 6 sorotan kuning · 7 samar
 */

/* --------------------------------------------------------------- CRC-32 */

const TABEL_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bait) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < bait.length; i++) c = TABEL_CRC[(c ^ bait[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

/* ------------------------------------------------------------------ ZIP */

const enkode = new TextEncoder()

/** Tanggal dan jam format DOS, seperti yang diminta kepala berkas ZIP. */
function waktuDos(w = new Date()) {
  const jam = (w.getHours() << 11) | (w.getMinutes() << 5) | Math.floor(w.getSeconds() / 2)
  const tgl = ((w.getFullYear() - 1980) << 9) | ((w.getMonth() + 1) << 5) | w.getDate()
  return { jam, tgl }
}

/**
 * Menyusun arsip ZIP.
 *
 * Butir yang membawa `padat` (hasil deflate mentah dari isinya) disimpan
 * termampatkan (metode 8); selebihnya disimpan apa adanya (metode 0). CRC
 * selalu dihitung dari isi ASLI, sebagaimana diminta format ZIP.
 *
 * @param {Array<{nama:string, isi:string|Uint8Array, padat?:Uint8Array}>} berkas
 */
export function susunZip(berkas, waktu = new Date()) {
  const { jam, tgl } = waktuDos(waktu)
  const lokal = []
  const pusat = []
  let posisi = 0

  for (const b of berkas) {
    const nama = enkode.encode(b.nama)
    const isi = typeof b.isi === 'string' ? enkode.encode(b.isi) : b.isi
    const crc = crc32(isi)
    const data = b.padat || isi
    const metode = b.padat ? 8 : 0

    const kepala = new DataView(new ArrayBuffer(30))
    kepala.setUint32(0, 0x04034b50, true)
    kepala.setUint16(4, 20, true)
    kepala.setUint16(6, 0x0800, true) // nama berkas UTF-8
    kepala.setUint16(8, metode, true)
    kepala.setUint16(10, jam, true)
    kepala.setUint16(12, tgl, true)
    kepala.setUint32(14, crc, true)
    kepala.setUint32(18, data.length, true)
    kepala.setUint32(22, isi.length, true)
    kepala.setUint16(26, nama.length, true)
    kepala.setUint16(28, 0, true)
    lokal.push(new Uint8Array(kepala.buffer), nama, data)

    const pk = new DataView(new ArrayBuffer(46))
    pk.setUint32(0, 0x02014b50, true)
    pk.setUint16(4, 20, true)
    pk.setUint16(6, 20, true)
    pk.setUint16(8, 0x0800, true)
    pk.setUint16(10, metode, true)
    pk.setUint16(12, jam, true)
    pk.setUint16(14, tgl, true)
    pk.setUint32(16, crc, true)
    pk.setUint32(20, data.length, true)
    pk.setUint32(24, isi.length, true)
    pk.setUint16(28, nama.length, true)
    pk.setUint32(42, posisi, true)
    pusat.push(new Uint8Array(pk.buffer), nama)

    posisi += 30 + nama.length + data.length
  }

  const ukuranPusat = pusat.reduce((n, x) => n + x.length, 0)
  const akhir = new DataView(new ArrayBuffer(22))
  akhir.setUint32(0, 0x06054b50, true)
  akhir.setUint16(8, berkas.length, true)
  akhir.setUint16(10, berkas.length, true)
  akhir.setUint32(12, ukuranPusat, true)
  akhir.setUint32(16, posisi, true)

  const bagian = [...lokal, ...pusat, new Uint8Array(akhir.buffer)]
  const total = bagian.reduce((n, x) => n + x.length, 0)
  const hasil = new Uint8Array(total)
  let i = 0
  for (const x of bagian) { hasil.set(x, i); i += x.length }
  return hasil
}

/* ------------------------------------------------------------- SpreadsheetML */

/**
 * Teks yang aman di dalam XML. Karakter kendali selain tab dan ganti baris
 * tidak sah di XML 1.0 dan membuat Excel menolak seluruh berkas dengan pesan
 * "ditemukan masalah pada konten" — satu judul berita berisi karakter
 * kendali dari salin-tempel cukup untuk itu.
 */
export function xmlAman(teks) {
  return String(teks ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .slice(0, 32767)
}

/** Nama kolom Excel untuk indeks berbasis nol: 0 → A, 26 → AA. */
export function namaKolom(i) {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function xmlSel(nilai, kol, bar) {
  const ref = `${namaKolom(kol)}${bar}`
  const obj = nilai !== null && typeof nilai === 'object' ? nilai : { v: nilai }
  const s = obj.s ? ` s="${obj.s}"` : ''
  const v = obj.v
  if (v === null || v === undefined || v === '') return obj.s ? `<c r="${ref}"${s}/>` : ''
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlAman(v)}</t></is></c>`
}

function xmlLembar(l) {
  const lebar = (l.lebar || []).map((w, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')
  const beku = l.beku
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${l.beku}" topLeftCell="A${l.beku + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
  const baris = l.baris.map((r, i) => {
    const sel = r.map((v, k) => xmlSel(v, k, i + 1)).join('')
    return `<row r="${i + 1}">${sel}</row>`
  }).join('')
  const saring = l.autoSaring
    ? `<autoFilter ref="A${l.autoSaring.baris}:${namaKolom(l.autoSaring.kolom - 1)}${l.baris.length}"/>`
    : ''
  const gabung = l.gabung?.length
    ? `<mergeCells count="${l.gabung.length}">${l.gabung.map((g) => `<mergeCell ref="${g}"/>`).join('')}</mergeCells>`
    : ''
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `${beku}<sheetFormatPr defaultRowHeight="15"/>${lebar ? `<cols>${lebar}</cols>` : ''}`
    + `<sheetData>${baris}</sheetData>${saring}${gabung}</worksheet>`
}

const GAYA_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  + '<fonts count="5">'
  + '<font><sz val="10"/><name val="Calibri"/></font>'
  + '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
  + '<font><b/><sz val="10"/><name val="Calibri"/></font>'
  + '<font><b/><sz val="13"/><color rgb="FF0B2545"/><name val="Calibri"/></font>'
  + '<font><sz val="9"/><color rgb="FF6B7280"/><name val="Calibri"/></font>'
  + '</fonts>'
  + '<fills count="5">'
  + '<fill><patternFill patternType="none"/></fill>'
  + '<fill><patternFill patternType="gray125"/></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FF0B2545"/></patternFill></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FFFDE2E1"/></patternFill></fill>'
  + '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF4CE"/></patternFill></fill>'
  + '</fills>'
  + '<borders count="2"><border/><border><left style="thin"><color rgb="FFD0D7E2"/></left>'
  + '<right style="thin"><color rgb="FFD0D7E2"/></right><top style="thin"><color rgb="FFD0D7E2"/></top>'
  + '<bottom style="thin"><color rgb="FFD0D7E2"/></bottom></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="8">'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  + '</cellXfs></styleSheet>'

/** Nama lembar Excel: paling panjang 31 huruf, tanpa []:*?/\ */
function namaLembar(n, i) {
  const s = String(n || `Lembar ${i + 1}`).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31)
  return s || `Lembar ${i + 1}`
}

/**
 * Buku kerja lengkap.
 *
 * @param {Array<{nama:string, baris:Array<Array<any>>, lebar?:number[],
 *   beku?:number, autoSaring?:{baris:number, kolom:number}, gabung?:string[]}>} lembar
 * @param {{judul?:string, pembuat?:string}} [properti]
 * @returns {Uint8Array}
 */
export function susunXlsx(lembar, properti = {}, waktu = new Date()) {
  return susunZip(isiBukuKerja(lembar, properti, waktu), waktu)
}

/**
 * Buku kerja yang sama, dimampatkan.
 *
 * XML lembar berulang-ulang sekali (nama tag yang sama di setiap sel), jadi
 * deflate memangkasnya sampai sepersepuluh: daftar sepekan 2.500 baris turun
 * dari 5,7 MB menjadi kira-kira 0,6 MB. Dipakai `CompressionStream` bawaan
 * peramban; peramban yang belum memilikinya mendapat berkas tanpa pemampatan,
 * yang tetap sah, hanya lebih besar.
 */
export async function susunXlsxPadat(lembar, properti = {}, waktu = new Date()) {
  const berkas = isiBukuKerja(lembar, properti, waktu)
  if (typeof CompressionStream === 'undefined') return susunZip(berkas, waktu)
  try {
    const padat = await Promise.all(berkas.map(async (b) => {
      const isi = enkode.encode(b.isi)
      const arus = new Blob([isi]).stream().pipeThrough(new CompressionStream('deflate-raw'))
      const hasil = new Uint8Array(await new Response(arus).arrayBuffer())
      return { nama: b.nama, isi, padat: hasil.length < isi.length ? hasil : undefined }
    }))
    return susunZip(padat, waktu)
  } catch {
    // 'deflate-raw' belum dikenal (peramban lama): simpan tanpa pemampatan.
    return susunZip(berkas, waktu)
  }
}

function isiBukuKerja(lembar, properti, waktu) {
  const nama = lembar.map((l, i) => namaLembar(l.nama, i))
  return [
    {
      nama: '[Content_Types].xml',
      isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        + lembar.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
        + '</Types>',
    },
    {
      nama: '_rels/.rels',
      isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        + '</Relationships>',
    },
    {
      nama: 'docProps/core.xml',
      isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        + 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
        + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        + `<dc:title>${xmlAman(properti.judul || '')}</dc:title>`
        + `<dc:creator>${xmlAman(properti.pembuat || '')}</dc:creator>`
        + `<dcterms:created xsi:type="dcterms:W3CDTF">${waktu.toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created>`
        + '</cp:coreProperties>',
    },
    {
      nama: 'xl/workbook.xml',
      isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
        + nama.map((n, i) => `<sheet name="${xmlAman(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
        + '</sheets>'
        + (lembar.some((l) => l.autoSaring)
          ? `<definedNames>${lembar.map((l, i) => (l.autoSaring
            ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xmlAman(nama[i]).replace(/'/g, "''")}'!$A$${l.autoSaring.baris}:$${namaKolom(l.autoSaring.kolom - 1)}$${l.baris.length}</definedName>`
            : '')).join('')}</definedNames>`
          : '')
        + '</workbook>',
    },
    {
      nama: 'xl/_rels/workbook.xml.rels',
      isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + lembar.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
        + `<Relationship Id="rId${lembar.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
        + '</Relationships>',
    },
    { nama: 'xl/styles.xml', isi: GAYA_XML },
    ...lembar.map((l, i) => ({ nama: `xl/worksheets/sheet${i + 1}.xml`, isi: xmlLembar(l) })),
  ]
}

export const JENIS_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export const META_XLSX = { versi: 'xlsx-v1.0', gaya: 8 }
