/**
 * Laporan klarifikasi berita — format resmi yang diisi di layar.
 *
 * Sumbernya "Format Laporan Klarifikasi Berita.docx" (4 November 2026),
 * disajikan apa adanya di web/format/ untuk diunduh. Dari tujuh halaman
 * format itu, tiga lembar menyangkut SATU isu dan diisi di sini:
 *
 *   Laporan Insidental           surat pengantar dari UPT, berkop Ditjenpas
 *   Berita Acara Verifikasi Isu  hasil konfirmasi fakta (lampiran)
 *   Draft Tanggapan              naskah klarifikasi publik (lampiran)
 *
 * Buku Kontrol, Rekapitulasi, dan Laporan Mingguan adalah catatan patroli
 * berkala, bukan jawaban atas satu permintaan; ketiganya tetap tersedia di
 * format kosong yang diunduh.
 *
 * Satu daftar BIDANG dipakai tiga tempat — formulir UPT, tampilan baca kanwil
 * dan pusat, dan berkas .docx — supaya lembar yang dibaca penilai sama
 * persis dengan yang diisi UPT. Peladen (penanganan_kirim_klarifikasi) hanya
 * menjaga tiga butir yang menentukan arti klarifikasi: hasil konfirmasi,
 * fakta sebenarnya, dan tingkat isu. `periksaLaporan` menjaga hal yang sama
 * di sini supaya penolakan datang sebelum mengirim, bukan sesudahnya.
 */

import { susunZip, xmlAman } from './xlsx.js'

export const FORMAT_KOSONG = '/format/format-laporan-klarifikasi-berita.docx'
export const LOGO_KOP = '/format/logo-kop.png'
export const JENIS_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export const HASIL = { benar: 'Benar', sebagian_benar: 'Sebagian benar', tidak_benar: 'Tidak benar' }
export const TINGKAT = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi', kritis: 'Kritis' }
export const PIHAK = ['Kalapas', 'Karutan', 'Kabapas', 'Ka. LPKA', 'KPLP', 'Kasi Binadik', 'Lainnya']
export const SIFAT = ['Segera', 'Rahasia', 'Segera / Rahasia', 'Biasa']
export const ZONA_WAKTU = ['WIB', 'WITA', 'WIT']

/**
 * Bidang isian, dikelompokkan per lembar. `jenis`: teks · area · pilih ·
 * waktu. `wajib` di sini sama dengan yang ditolak peladen, tidak lebih.
 */
export const LEMBAR = [
  {
    id: 'ba', judul: 'Berita Acara Verifikasi Isu',
    ket: 'Konfirmasi fakta atas isu yang diberitakan.',
    bidang: [
      { k: 'waktu_konfirmasi', label: 'Waktu konfirmasi', jenis: 'waktu' },
      { k: 'ringkasan_isu', label: 'Judul / ringkasan isu', jenis: 'area', baris: 2 },
      { k: 'sumber', label: 'Sumber dan tautan', jenis: 'area', baris: 2 },
      { k: 'waktu_ditemukan', label: 'Waktu pertama kali ditemukan', jenis: 'teks' },
      { k: 'pihak', label: 'Pihak yang dikonfirmasi', jenis: 'pilih', pilihan: PIHAK },
      { k: 'pihak_nama', label: 'Nama pihak yang dikonfirmasi', jenis: 'teks' },
      { k: 'pihak_jabatan', label: 'Jabatan pihak yang dikonfirmasi', jenis: 'teks' },
      { k: 'hasil_konfirmasi', label: 'Hasil konfirmasi', jenis: 'pilih', pilihan: HASIL, wajib: true },
      { k: 'fakta', label: 'Fakta sebenarnya', jenis: 'area', baris: 4, wajib: true },
      { k: 'dampak', label: 'Analisis dampak (reputasi, keamanan, publik)', jenis: 'area', baris: 3 },
      { k: 'tingkat', label: 'Tingkat isu', jenis: 'pilih', pilihan: TINGKAT, wajib: true },
      { k: 'rekomendasi', label: 'Rekomendasi tindak lanjut', jenis: 'area', baris: 2 },
      { k: 'petugas_nama', label: 'Nama petugas patroli siber / IT', jenis: 'teks' },
    ],
  },
  {
    id: 'li', judul: 'Laporan Insidental',
    ket: 'Surat pengantar dari UPT. Ringkasan isu, sumber, hasil verifikasi, dan dampak diambil dari Berita Acara.',
    bidang: [
      { k: 'nomor', label: 'Nomor surat', jenis: 'teks' },
      { k: 'sifat', label: 'Sifat', jenis: 'pilih', pilihan: SIFAT },
      { k: 'sebaran', label: 'Sebaran (jumlah tayangan / komentar / bagikan)', jenis: 'area', baris: 2 },
      { k: 'tindakan', label: 'Tindakan yang telah dilakukan', jenis: 'area', baris: 3 },
      { k: 'arahan', label: 'Rekomendasi / permohonan arahan', jenis: 'area', baris: 2 },
      { k: 'kepala_upt', label: 'Nama Kepala UPT', jenis: 'teks' },
    ],
  },
  {
    id: 'dt', judul: 'Draft Tanggapan',
    ket: 'Naskah tanggapan atau klarifikasi untuk publik.',
    bidang: [
      { k: 'draf_tanggapan', label: 'Draf tanggapan', jenis: 'area', baris: 6 },
    ],
  },
]

export const BIDANG = LEMBAR.flatMap((l) => l.bidang)

const BATAS_PANJANG = 4000

/** Nilai siap baca; pilihan berupa objek (kode → label) diganti labelnya. */
export function labelPilihan(bidang, nilai) {
  if (!nilai) return ''
  const p = bidang?.pilihan
  return p && !Array.isArray(p) ? (p[nilai] || nilai) : nilai
}

/** Zona waktu peramban menurut selisih jamnya; di luar Indonesia: WIB. */
export function zonaPeramban(w = new Date()) {
  const jam = -w.getTimezoneOffset() / 60
  return jam === 8 ? 'WITA' : jam === 9 ? 'WIT' : 'WIB'
}

function waktuLokal(w = new Date()) {
  const d = new Date(w.getTime() - w.getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

function tanggalPanjangWib(nilai) {
  if (!nilai) return ''
  const w = new Date(nilai)
  if (Number.isNaN(w.getTime())) return String(nilai)
  return `${new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(w)} pukul ${new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(w).replace(':', '.')} WIB`
}

/** Isian awal dari berita yang diminta klarifikasinya. */
export function laporanBawaan(p, w = new Date()) {
  const b = p?.berita || {}
  return {
    waktu_konfirmasi: waktuLokal(w),
    zona: zonaPeramban(w),
    ringkasan_isu: b.judul || '',
    sumber: [b.media, b.link].filter(Boolean).join(' — '),
    waktu_ditemukan: tanggalPanjangWib(b.created_at || b.tanggal_publikasi),
    pihak: '', pihak_nama: '', pihak_jabatan: '',
    hasil_konfirmasi: '', fakta: '', dampak: '', tingkat: '', rekomendasi: '', petugas_nama: '',
    nomor: '', sifat: 'Segera', sebaran: '', tindakan: '', arahan: '', kepala_upt: '',
    draf_tanggapan: '',
  }
}

/** Membersihkan isian sebelum dikirim: hanya kunci yang dikenal, dipangkas. */
export function bersihkanLaporan(isian) {
  const hasil = { format: 'format-klarifikasi-v1' }
  for (const k of [...BIDANG.map((b) => b.k), 'zona']) {
    const v = String(isian?.[k] ?? '').trim().slice(0, BATAS_PANJANG)
    if (v) hasil[k] = v
  }
  return hasil
}

/** Pesan galat pertama, atau '' bila laporan boleh dikirim. */
export function periksaLaporan(l) {
  if (!HASIL[l?.hasil_konfirmasi]) return 'Pilih hasil konfirmasi: benar, sebagian benar, atau tidak benar.'
  if (String(l?.fakta || '').trim().length < 10) return 'Tuliskan fakta sebenarnya (paling sedikit 10 huruf).'
  if (!TINGKAT[l?.tingkat]) return 'Pilih tingkat isu: rendah, sedang, tinggi, atau kritis.'
  return ''
}

/** "Rabu, 4 November 2026 pukul 10.30 WIB" dari isian datetime-local. */
export function kalimatWaktuKonfirmasi(l) {
  const m = String(l?.waktu_konfirmasi || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return { hari: '................', tanggal: '................', pukul: '........', zona: l?.zona || 'WIB' }
  const tgl = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12))
  const f = (o) => new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', ...o }).format(tgl)
  return {
    hari: f({ weekday: 'long' }),
    tanggal: f({ day: 'numeric', month: 'long', year: 'numeric' }),
    pukul: `${m[4]}.${m[5]}`,
    zona: l?.zona || 'WIB',
  }
}

/* ======================================================= dokumen .docx */

const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
  + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
  + 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
  + 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
  + 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'

const TITIK = '................................................'

/** Satu run; ganti baris menjadi <w:br/>. */
function run(teks, { tebal = false, miring = false, ukuran = 0, garis = false } = {}) {
  const rpr = [tebal && '<w:b/>', miring && '<w:i/>', garis && '<w:u w:val="single"/>',
    ukuran && `<w:sz w:val="${ukuran}"/><w:szCs w:val="${ukuran}"/>`].filter(Boolean).join('')
  return String(teks ?? '').split('\n').map((baris, i) =>
    `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}${i ? '<w:br/>' : ''}<w:t xml:space="preserve">${xmlAman(baris)}</w:t></w:r>`).join('')
}

function para(isi, { rata = '', sesudah = 120, sebelum = 0, putus = false, inden = 0, gantung = 0, garisBawah = false, tetap = false } = {}) {
  const ppr = [
    putus && '<w:pageBreakBefore/>',
    tetap && '<w:keepNext/>',
    garisBawah && '<w:pBdr><w:bottom w:val="thickThinSmallGap" w:sz="18" w:space="1" w:color="000000"/></w:pBdr>',
    `<w:spacing w:before="${sebelum}" w:after="${sesudah}" w:line="276" w:lineRule="auto"/>`,
    (inden || gantung) && `<w:ind w:left="${inden}"${gantung ? ` w:hanging="${gantung}"` : ''}/>`,
    rata && `<w:jc w:val="${rata}"/>`,
  ].filter(Boolean).join('')
  return `<w:p><w:pPr>${ppr}</w:pPr>${isi}</w:p>`
}

const teksAtau = (v, ganti = TITIK) => (String(v ?? '').trim() ? String(v).trim() : ganti)

function sel(isi, lebar, { latar = '', tanpaGaris = false, rentang = 0 } = {}) {
  const tcpr = [`<w:tcW w:w="${lebar}" w:type="dxa"/>`,
    rentang && `<w:gridSpan w:val="${rentang}"/>`,
    tanpaGaris && '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>',
    latar && `<w:shd w:val="clear" w:color="auto" w:fill="${latar}"/>`,
    '<w:vAlign w:val="top"/>'].filter(Boolean).join('')
  return `<w:tc><w:tcPr>${tcpr}</w:tcPr>${isi || para('')}</w:tc>`
}

function tabel(baris, lebar, { garis = true } = {}) {
  const tepi = garis
    ? '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="000000"/><w:left w:val="single" w:sz="4" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:color="000000"/><w:right w:val="single" w:sz="4" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:color="000000"/></w:tblBorders>'
    : '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
  const total = lebar.reduce((a, b) => a + b, 0)
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${tepi}<w:tblLayout w:type="fixed"/>`
    + '<w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>'
    + `<w:tblGrid>${lebar.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
    + baris.map((b) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${b}</w:tr>`).join('')
    + '</w:tbl>'
}

const LEBAR = 9638 // A4 dengan margin 2 cm kiri-kanan, dalam twip

function gambarLogo(emu) {
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${emu}" cy="${emu}"/>`
    + '<wp:docPr id="1" name="Logo kop"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>'
    + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
    + '<pic:nvPicPr><pic:cNvPr id="0" name="logo-kop.png"/><pic:cNvPicPr/></pic:nvPicPr>'
    + '<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu}" cy="${emu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
    + '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
}

function kop(adaLogo) {
  const teks = [
    para(run('KEMENTERIAN IMIGRASI DAN PEMASYARAKATAN REPUBLIK INDONESIA', { tebal: true, ukuran: 21 }), { rata: 'center', sesudah: 0 }),
    para(run('DIREKTORAT JENDERAL PEMASYARAKATAN', { tebal: true, ukuran: 24 }), { rata: 'center', sesudah: 0 }),
    para(run('Jalan Veteran Nomor 11 Jakarta', { ukuran: 18 }), { rata: 'center', sesudah: 0 }),
    para(run('Telepon : (021) 35289898 / (021) 35289006', { ukuran: 18 }), { rata: 'center', sesudah: 0 }),
    para(run('Laman: www.ditjenpas.go.id, Pos-el: direktoratkamtib@gmail.com', { ukuran: 18 }), { rata: 'center', sesudah: 0 }),
  ].join('')
  return tabel([
    sel(para(adaLogo ? gambarLogo(900000) : '', { rata: 'center', sesudah: 0 }), 1600, { tanpaGaris: true })
    + sel(teks, LEBAR - 1600, { tanpaGaris: true }),
  ], [1600, LEBAR - 1600], { garis: false })
    + para('', { garisBawah: true, sesudah: 240 })
}

function judul(teks, { putus = false, kecil = '' } = {}) {
  return para(run(teks, { tebal: true, ukuran: 28 }), { rata: 'center', sesudah: kecil ? 0 : 240, putus, tetap: true })
    + (kecil ? para(run(kecil, { ukuran: 22 }), { rata: 'center', sesudah: 240 }) : '')
}

function butirLabel(label, isi) {
  return para(run(`${label}: `, { tebal: true }) + run(isi), { sesudah: 100 })
}

function tandaTangan(kiri, kanan, { atasKiri = '', atasKanan = '' } = {}) {
  const kolom = (atas, peran, nama, ket) => [
    para(run(atas, { tebal: true }), { rata: 'center', sesudah: 0 }),
    para(run(peran), { rata: 'center', sesudah: 900 }),
    para(run(teksAtau(nama, '(..............................)'), { tebal: Boolean(nama), garis: Boolean(nama) }), { rata: 'center', sesudah: 0 }),
    ket ? para(run(ket, { ukuran: 18 }), { rata: 'center', sesudah: 0 }) : '',
  ].join('')
  const w = LEBAR / 2
  return para('', { sesudah: 120 }) + tabel([
    sel(kolom(atasKiri, kiri.peran, kiri.nama, kiri.ket), w, { tanpaGaris: true })
    + sel(kolom(atasKanan, kanan.peran, kanan.nama, kanan.ket), w, { tanpaGaris: true }),
  ], [w, w], { garis: false })
}

function nilaiBidang(l, k) {
  const b = BIDANG.find((x) => x.k === k)
  return b?.jenis === 'pilih' ? labelPilihan(b, l[k]) : (l[k] || '')
}

function lembarInsidental(l, { p, adaLogo, waktuLaporan }) {
  const hasil = nilaiBidang(l, 'hasil_konfirmasi')
  return [
    kop(adaLogo),
    judul('LAPORAN INSIDENTAL'),
    butirLabel('Nomor', teksAtau(l.nomor, '................')),
    butirLabel('Tanggal/Jam', tanggalPanjangWib(waktuLaporan)),
    butirLabel('Sifat', teksAtau(l.sifat, 'Segera / Rahasia')),
    butirLabel('Dari', teksAtau(p?.nama_upt, '................')),
    butirLabel('Dasar', 'SOP Patroli Siber Berita Pemasyarakatan.'),
    para('', { sesudah: 60 }),
    butirLabel('Ringkasan isu', teksAtau(l.ringkasan_isu)),
    butirLabel('Sumber dan tautan', `${teksAtau(l.sumber)} (tangkapan layar terlampir)`),
    butirLabel('Waktu ditemukan dan sebaran', `${teksAtau(l.waktu_ditemukan, '................')}${l.sebaran ? `; ${l.sebaran}` : ''}`),
    butirLabel('Hasil verifikasi fakta', `${hasil ? `${hasil}. ` : ''}${teksAtau(l.fakta)} (Berita Acara terlampir)`),
    butirLabel('Analisis dampak', teksAtau(l.dampak)),
    butirLabel('Tindakan yang telah dilakukan', teksAtau(l.tindakan)),
    butirLabel('Rekomendasi / permohonan arahan', teksAtau(l.arahan || l.rekomendasi)),
    para(run('Lampiran:', { tebal: true }), { sesudah: 40 }),
    ...['tangkapan layar', 'Berita Acara Verifikasi', 'draf klarifikasi.'].map((t, i) =>
      para(`${run(`${i + 1}.`)}<w:r><w:tab/></w:r>${run(t)}`, { inden: 720, gantung: 360, sesudah: 0 })),
    tandaTangan(
      { peran: 'Petugas Patroli Siber / IT', nama: l.petugas_nama },
      { peran: `Kepala ${p?.nama_upt || 'UPT'}`, nama: l.kepala_upt },
      { atasKiri: 'Pembuat', atasKanan: 'Mengetahui / Menyetujui' },
    ),
  ].join('')
}

function lembarBeritaAcara(l) {
  const w = kalimatWaktuKonfirmasi(l)
  const orang = [l.pihak_nama, l.pihak_jabatan].filter(Boolean).join(', ')
  const pihak = [l.pihak, orang].filter(Boolean).join(': ')
  const butir = [
    ['Judul / ringkasan isu', l.ringkasan_isu],
    ['Sumber dan tautan', l.sumber],
    ['Waktu pertama kali ditemukan', l.waktu_ditemukan],
    ['Pihak yang dikonfirmasi (Kalapas / KPLP / Binadik / lainnya)', pihak],
    ['Hasil konfirmasi (benar / sebagian benar / tidak benar)', nilaiBidang(l, 'hasil_konfirmasi')],
    ['Fakta sebenarnya', l.fakta],
    ['Analisis dampak (reputasi, keamanan, publik)', l.dampak],
    ['Tingkat isu (Rendah / Sedang / Tinggi / Kritis)', nilaiBidang(l, 'tingkat')],
    ['Rekomendasi tindak lanjut', l.rekomendasi],
  ]
  const kiri = 3400
  return [
    judul('BERITA ACARA', { putus: true, kecil: 'VERIFIKASI ISU' }),
    para(run(`Pada hari ini ${w.hari} tanggal ${w.tanggal} pukul ${w.pukul} ${w.zona}, telah dilakukan konfirmasi fakta atas isu berikut.`), { rata: 'both', sesudah: 160 }),
    tabel([
      sel(para(run('Butir', { tebal: true }), { rata: 'center', sesudah: 0 }), kiri, { latar: 'D9D9D9' })
      + sel(para(run('Uraian', { tebal: true }), { rata: 'center', sesudah: 0 }), LEBAR - kiri, { latar: 'D9D9D9' }),
      ...butir.map(([label, isi]) =>
        sel(para(run(label), { sesudah: 60 }), kiri)
        + sel(para(run(teksAtau(isi, '')), { sesudah: 60 }), LEBAR - kiri)),
    ], [kiri, LEBAR - kiri]),
    tandaTangan(
      { peran: 'Petugas Patroli Siber / IT', nama: l.petugas_nama, ket: '(nama dan tanda tangan)' },
      { peran: 'Pihak yang Dikonfirmasi', nama: l.pihak_nama, ket: l.pihak_jabatan ? `${l.pihak_jabatan} (tanda tangan)` : '(nama, jabatan, tanda tangan)' },
    ),
  ].join('')
}

function lembarTanggapan(l) {
  const isi = String(l.draf_tanggapan || '').trim()
  return judul('DRAFT TANGGAPAN', { putus: true })
    + (isi
      // Satu alinea per baris: ganti baris di dalam alinea rata kanan-kiri
      // meregangkan baris sebelumnya selebar halaman.
      ? isi.split(/\n+/).filter((a) => a.trim()).map((alinea) => para(run(alinea.trim()), { rata: 'both', sesudah: 160 })).join('')
      : para(run(TITIK + TITIK)) + para(run(TITIK + TITIK)))
}

function dokumenXml(l, opsi) {
  const tubuh = lembarInsidental(l, opsi) + lembarBeritaAcara(l) + lembarTanggapan(l)
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${tubuh}`
    + '<w:sectPr><w:pgSz w:w="11906" w:h="16838" w:code="9"/>'
    + '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>'
    + '</w:body></w:document>'
}

const GAYA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
  + '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>'
  + '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault>'
  + '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
  + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
  + '</w:styles>'

/**
 * Menyusun .docx tiga lembar dari satu laporan.
 * @param {object} laporan   isian (lihat BIDANG)
 * @param {object} opsi      { p: baris penanganan, logo: Uint8Array PNG atau null, waktuLaporan }
 * @returns {Uint8Array}
 */
export function susunDocxKlarifikasi(laporan, { p = null, logo = null, waktuLaporan = new Date() } = {}) {
  const l = laporan || {}
  const adaLogo = logo instanceof Uint8Array && logo.length > 0
  const berkas = [
    {
      nama: '[Content_Types].xml',
      isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        + '</Types>',
    },
    {
      nama: '_rels/.rels',
      isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        + '</Relationships>',
    },
    {
      nama: 'docProps/core.xml',
      isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
        + 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        + `<dc:title>${xmlAman(`Laporan Klarifikasi Berita — ${p?.nama_upt || 'UPT'}`)}</dc:title><dc:creator>Trans-Siber PAS</dc:creator>`
        + `<dcterms:created xsi:type="dcterms:W3CDTF">${new Date(waktuLaporan).toISOString().replace(/\.\d+Z$/, 'Z')}</dcterms:created>`
        + '</cp:coreProperties>',
    },
    {
      nama: 'word/_rels/document.xml.rels',
      isi: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rIdGaya" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + (adaLogo ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo-kop.png"/>' : '')
        + '</Relationships>',
    },
    { nama: 'word/document.xml', isi: dokumenXml(l, { p, adaLogo, waktuLaporan }) },
    { nama: 'word/styles.xml', isi: GAYA },
  ]
  if (adaLogo) berkas.push({ nama: 'word/media/logo-kop.png', isi: logo })
  return susunZip(berkas)
}

export function namaBerkasLaporan(p, w = new Date()) {
  const unit = String(p?.nama_upt || 'upt').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
  return `laporan-klarifikasi-${unit}-${w.toISOString().slice(0, 10)}.docx`
}

export const META_LAPORAN_KLARIFIKASI = { versi: 'format-klarifikasi-v1', bidang: BIDANG.length, lembar: LEMBAR.length }
