/**
 * Penyusun model laporan infografis harian dan mingguan.
 *
 * KENAPA BERKAS INI ADA, DAN KENAPA IA BUKAN BAGIAN DARI laporan.js
 *
 * lib/laporan.js menyusun laporan intelijen: keadaan, peristiwa yang menuntut
 * respons, rekomendasi tindakan. Pembacanya analis dan pimpinan yang memang
 * sedang menangani sesuatu.
 *
 * Berkas ini menyusun sesuatu yang lain: satu lembar yang menjawab "sepekan
 * ini Pemasyarakatan ramai soal apa" kepada orang yang tidak sedang menangani
 * apa pun — dan yang, kalau lembarnya menuntut lebih dari satu menit, tidak
 * akan membacanya sama sekali. Bentuknya karena itu bukan uraian melainkan
 * angka besar, peta berwarna, dan tujuh batang tema.
 *
 * Keduanya tidak boleh berselisih angka. Maka berkas ini TIDAK MENGHITUNG
 * APA PUN SENDIRI: himpunan dasarnya dari lib/hitung.js, embernya dari
 * lib/sentimen.js, temanya dari lib/taksonomi.js, dan peristiwanya dari
 * lib/peristiwa.js. Yang dikerjakan di sini hanyalah menyusun ulang angka yang
 * sudah ada menjadi bentuk yang bisa digambar. Menuliskan satu penyaring baru
 * di sini akan menghidupkan kembali persis kelas kekeliruan yang dihapus
 * lib/hitung.js — dan kekeliruan itu baru ketahuan ketika seseorang kebetulan
 * membandingkan lembar ini dengan dasbor.
 *
 * KENAPA MODELNYA DIPISAH DARI PENGGAMBARNYA
 *
 * Lembar yang sama digambar tiga kali: sebagai HTML di layar, sebagai PNG
 * lewat canvas, dan sebagai PDF di dalam Edge Function yang tidak punya DOM
 * sama sekali. Bila angkanya dihitung di dalam penggambar, ketiganya akan
 * perlahan berbeda — dan yang paling jarang dilihat, yang PDF, yang paling
 * lama salah tanpa ketahuan. Modul ini mengembalikan objek biasa: tidak ada
 * DOM, tidak ada warna piksel, tidak ada satuan gambar.
 *
 * Modul ES murni tanpa impor luar, supaya bisa dipakai di peramban maupun di
 * dalam Edge Function Deno.
 */

import { dasar, ringkasan } from './hitung.js'
import { ember } from './sentimen.js'
import { TEMA_LAPORAN, temaLaporan } from './taksonomi.js'
import { kelompokkanPeristiwa, rapikanJudul, sumberAsli } from './peristiwa.js'
import { namaPenerbitTampil } from './penerbit.js'
import { bersihkanTeks } from './teks.js'
import { belumTerpetakan } from './unit-terpetakan.js'

/**
 * Judul dan ringkasan yang tercetak di lembar.
 *
 * Separuh lebih arsip menyimpan templat crawler di kolom ringkasan — "TOPIK:
 * Isu Potensial (Rule-Based) SKOR ANCAMAN: 2/5 …" — dan tanpa pembersihan itu,
 * garis waktu isu sorotan mengulang kalimat yang sama tiga kali dan tidak
 * memberi tahu apa pun tentang isunya. Pembersihnya sudah ada di lib/teks.js
 * dan dipakai mesin klasifikasi; ia hanya belum pernah dipakai di jalur
 * laporan.
 */
function teksBersih(nilai, cadangan = '') {
  const bersih = bersihkanTeks(nilai)
  return bersih || bersihkanTeks(cadangan)
}

/** Berapa banyak yang muat pada tiap panel. Angkanya dari tata letak, bukan selera. */
export const MUAT = {
  media: 5,
  provinsi: 5,
  contoh: 6,
  sorotan: 4,
  garisWaktu: 3,
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

/** YYYY-MM-DD menjadi bagian-bagiannya, tanpa melewati zona waktu peramban. */
function pecah(iso) {
  const [t, b, h] = String(iso || '').slice(0, 10).split('-').map(Number)
  return { tahun: t, bulan: b, hari: h }
}

/** Tanggal sebuah berita sebagai YYYY-MM-DD menurut WIB. */
export function hariIso(b) {
  const nilai = b?.tanggal_publikasi || b?.created_at || b?.detected_at
  if (!nilai) return ''
  const d = new Date(nilai)
  if (Number.isNaN(d.getTime())) return String(nilai).slice(0, 10)
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

/**
 * Label periode sebagaimana tercetak pada kepala lembar.
 *
 * Satu hari ditulis utuh ("3 September 2026"); rentang ditulis seringkas
 * mungkin tanpa kehilangan kejelasan — bulan yang sama tidak diulang, tahun
 * yang sama tidak diulang. "27 Agustus – 3 September 2026", bukan
 * "27 Agustus 2026 – 3 September 2026", yang tiga kata lebih panjang tanpa
 * memberi tahu apa pun.
 */
export function labelPeriode(mulai, selesai) {
  const a = pecah(mulai)
  const b = pecah(selesai)
  if (!a.tahun || !b.tahun) return ''
  if (mulai === selesai) return `${a.hari} ${BULAN[a.bulan - 1]} ${a.tahun}`
  if (a.tahun !== b.tahun) {
    return `${a.hari} ${BULAN[a.bulan - 1]} ${a.tahun} – ${b.hari} ${BULAN[b.bulan - 1]} ${b.tahun}`
  }
  if (a.bulan !== b.bulan) {
    return `${a.hari} ${BULAN[a.bulan - 1]} – ${b.hari} ${BULAN[b.bulan - 1]} ${b.tahun}`
  }
  return `${a.hari} – ${b.hari} ${BULAN[b.bulan - 1]} ${b.tahun}`
}

/** "27 Agu" — bentuk pendek untuk kartu contoh berita dan garis waktu. */
export function tanggalPendek(iso) {
  const { bulan, hari } = pecah(iso)
  if (!bulan) return ''
  return `${hari} ${BULAN_SINGKAT[bulan - 1]}`
}

/**
 * Indeks unit: nama UPT menjadi jenis, provinsi, dan kanwilnya.
 *
 * Dibangun sekali lalu dioper, bukan dicari ulang per berita. Sebuah laporan
 * mingguan memanggilnya ratusan kali, dan pencarian linier pada 531 unit
 * terasa pada berkas sebesar itu.
 */
export function indeksUnit(daftarUnit = []) {
  const peta = new Map()
  for (const u of daftarUnit) {
    const nama = String(u?.nama_upt ?? u?.nama ?? '').trim()
    if (!nama) continue
    peta.set(nama.toLowerCase(), {
      nama,
      jenis: String(u.jenis_upt ?? u.jenis ?? '').trim(),
      provinsi: String(u.provinsi ?? '').trim(),
      kanwil: String(u.kanwil ?? '').trim(),
    })
  }
  return peta
}

/**
 * Jenis unit sebuah berita: Lapas, Rutan, LPKA, Bapas, atau kosong.
 *
 * Data induk dipercaya lebih dulu. Namanya baru dibaca ketika unitnya tidak
 * ada di sana — dan itu sering: berita yang menyebut "Lapas Kelas IIA Kota X"
 * dengan ejaan yang tidak persis sama tidak pernah cocok dengan data induk,
 * tetapi kata pertamanya tetap memberi tahu jenisnya. Membuang berita semacam
 * itu dari hitungan Lapas/Rutan membuat kedua angka selalu lebih kecil
 * daripada totalnya, dan selisih yang tidak bisa dijelaskan adalah selisih
 * yang akan ditanyakan.
 */
export function jenisUnit(berita, indeks) {
  const nama = String(berita?.nama_upt ?? '').trim()
  if (!nama || belumTerpetakan(nama)) return ''
  const induk = indeks?.get(nama.toLowerCase())
  if (induk?.jenis) {
    const j = induk.jenis.toLowerCase()
    if (j.includes('lpka')) return 'LPKA'
    if (j.includes('bapas')) return 'Bapas'
    if (j.includes('rutan')) return 'Rutan'
    if (j.includes('lapas') || j.includes('lpp')) return 'Lapas'
  }
  const n = nama.toLowerCase()
  if (n.includes('lpka')) return 'LPKA'
  if (n.includes('bapas')) return 'Bapas'
  if (n.includes('rutan') || n.includes('rumah tahanan')) return 'Rutan'
  if (n.includes('lapas') || n.includes('lembaga pemasyarakatan') || n.includes('lpp')) return 'Lapas'
  return ''
}

/** Provinsi sebuah berita, dari data induk unit. Kosong bila unitnya tak dikenali. */
export function provinsiBerita(berita, indeks) {
  const langsung = String(berita?.provinsi ?? '').trim()
  if (langsung) return langsung
  const nama = String(berita?.nama_upt ?? '').trim()
  if (!nama || belumTerpetakan(nama)) return ''
  return indeks?.get(nama.toLowerCase())?.provinsi || ''
}

/**
 * Ember yang mewakili sekumpulan berita — dipakai mewarnai provinsi di peta.
 *
 * TERBANYAK, bukan terburuk, dan pilihan itu pernah dibuat terbalik.
 *
 * Versi pertama memakai aturan "ada satu negatif berarti negatif", dengan
 * alasan yang terdengar benar: provinsi dengan satu pelarian tidak sepantasnya
 * hijau. Yang terjadi ketika dijalankan atas sepekan data sungguhan adalah
 * seluruh dua belas provinsi berwarna merah dan legenda berbunyi "Positif (0
 * provinsi)" — sebab pada rentang sepekan, hampir setiap provinsi yang punya
 * berita punya setidaknya satu berita negatif. Peta yang seluruhnya merah tidak
 * membedakan apa pun, dan peta yang tidak membedakan apa pun tidak dibaca.
 *
 * Legendanya berbunyi "berdasarkan sentimen DOMINAN", dan itulah yang
 * dikerjakan sekarang: ember dengan berita terbanyak. Seri dimenangkan yang
 * lebih merugikan — negatif di atas netral, netral di atas positif — sehingga
 * provinsi yang benar-benar berimbang tetap tidak tampil menenangkan.
 *
 * Yang hilang karena perubahan ini — provinsi dengan satu isu berat di antara
 * banyak kabar baik — tidak dibiarkan hilang: jumlah negatif per provinsi tetap
 * dibawa pada `rekapWilayah()`, dan panel Isu Sorotan Khusus menyebut
 * peristiwanya dengan nama unitnya.
 */
export function emberDominan(daftar = []) {
  const hitung = { negatif: 0, netral: 0, positif: 0, belum: 0 }
  for (const b of daftar) hitung[ember(b)] += 1
  if (!daftar.length) return 'belum'
  // Urutan pemeriksaan menentukan pemenang seri: yang lebih merugikan lebih
  // dulu, sehingga `>` sudah cukup dan tidak perlu aturan seri terpisah.
  let menang = 'belum'
  let terbanyak = -1
  for (const kode of ['negatif', 'netral', 'positif', 'belum']) {
    if (hitung[kode] > terbanyak) { terbanyak = hitung[kode]; menang = kode }
  }
  return menang
}

function persenBulat(bagian, total) {
  if (!total) return 0
  return Math.round((bagian / total) * 1000) / 10
}

/**
 * Dua baris keterangan di bawah nama tema, seperti pada lembar contoh.
 *
 * Diambil dari subkategori yang benar-benar muncul pekan itu, bukan dari
 * kalimat tetap. Kalimat tetap terbaca meyakinkan justru ketika ia salah:
 * "Panen sayur, budidaya hortikultura" tercetak pada pekan yang tidak punya
 * satu pun berita panen tetap terlihat sah, dan tidak ada yang memeriksanya.
 * Kalimat baku hanya dipakai ketika temanya kosong — dan tema kosong memang
 * tidak digambar.
 */
function ringkasTema(tema, daftar) {
  const per = new Map()
  for (const b of daftar) {
    const nama = String(b.subkategori || '').trim()
    if (!nama) continue
    per.set(nama, (per.get(nama) || 0) + 1)
  }
  const urut = [...per.entries()].sort((a, b) => b[1] - a[1]).map(([nama]) => nama)
  if (!urut.length) return tema.ringkasBaku.slice()
  if (urut.length === 1) return [urut[0], tema.ringkasBaku[1]]
  return urut.slice(0, 2)
}

/**
 * Rekap tema isu.
 *
 * Tema yang tidak punya satu pun berita tidak dikembalikan. Sebuah batang
 * bernilai nol pada lembar sepekan bukan informasi — ia hanya memakan tinggi
 * yang dibutuhkan tema yang memang ramai, dan pada lembar setinggi satu
 * halaman itu selisih yang menentukan terbaca atau tidaknya sisanya.
 */
export function rekapTema(inti) {
  const per = new Map()
  let takBertema = 0
  for (const b of inti) {
    const t = temaLaporan(b)
    if (!t) { takBertema += 1; continue }
    if (!per.has(t.kode)) per.set(t.kode, [])
    per.get(t.kode).push(b)
  }

  const hasil = []
  for (const tema of TEMA_LAPORAN) {
    const daftar = per.get(tema.kode)
    if (!daftar?.length) continue
    hasil.push({
      kode: tema.kode,
      nama: tema.nama,
      warna: tema.warna,
      ikon: tema.ikon,
      jumlah: daftar.length,
      persen: persenBulat(daftar.length, inti.length),
      ringkas: ringkasTema(tema, daftar),
      berita: daftar,
    })
  }

  hasil.sort((a, b) => b.jumlah - a.jumlah)
  return { tema: hasil, takBertema }
}

/** Lima penerbit teratas, sisanya dijumlahkan menjadi satu baris "Lainnya". */
export function rekapMedia(inti) {
  const per = new Map()
  for (const b of inti) {
    const nama = namaPenerbitTampil(b, sumberAsli(b))
    per.set(nama, (per.get(nama) || 0) + 1)
  }
  const urut = [...per.entries()]
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, 'id'))

  const teratas = urut.slice(0, MUAT.media)
  const sisa = urut.slice(MUAT.media)
  const lainnya = sisa.reduce((n, m) => n + m.jumlah, 0)
  return { teratas, lainnya, jumlahPenerbit: urut.length }
}

/**
 * Rekap per provinsi.
 *
 * `perBentuk` ada karena Natural Earth belum mengenal lima provinsi termuda
 * Indonesia; lihat peringatan di peta-provinsi.js. Yang MENGGAMBAR memakai
 * `perBentuk`, yang MENYUSUN DAFTAR memakai `provinsi`. Menyamakan keduanya
 * berarti Kalimantan Utara dan empat provinsi Papua hilang dari daftar
 * "provinsi dengan berita terbanyak" tanpa satu pun tanda.
 */
export function rekapWilayah(inti, indeks, indukProvinsi = {}) {
  const per = new Map()
  let tanpaProvinsi = 0

  for (const b of inti) {
    const prov = provinsiBerita(b, indeks)
    if (!prov) { tanpaProvinsi += 1; continue }
    if (!per.has(prov)) per.set(prov, [])
    per.get(prov).push(b)
  }

  const provinsi = [...per.entries()]
    .map(([nama, daftar]) => ({
      nama,
      jumlah: daftar.length,
      dominan: emberDominan(daftar),
      negatif: daftar.filter((b) => ember(b) === 'negatif').length,
    }))
    .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, 'id'))

  // Bentuk yang digambar. Provinsi tanpa bentuknya sendiri menyumbangkan
  // beritanya ke induknya, dan sentimen dominannya dinilai ulang atas gabungan
  // itu — bukan diambil dari salah satunya.
  const perBentuk = new Map()
  for (const [nama, daftar] of per) {
    const bentuk = indukProvinsi[nama] || nama
    if (!perBentuk.has(bentuk)) perBentuk.set(bentuk, [])
    perBentuk.get(bentuk).push(...daftar)
  }
  const bentuk = new Map()
  for (const [nama, daftar] of perBentuk) {
    bentuk.set(nama, { jumlah: daftar.length, dominan: emberDominan(daftar) })
  }

  const perEmber = { negatif: 0, netral: 0, positif: 0, belum: 0 }
  for (const p of provinsi) perEmber[p.dominan] += 1

  return {
    provinsi,
    teratas: provinsi.slice(0, MUAT.provinsi),
    perBentuk: bentuk,
    perEmber,
    tanpaProvinsi,
    jumlahProvinsi: provinsi.length,
  }
}

/**
 * Contoh berita terkini — satu kartu per tema, bukan enam berita terbaru.
 *
 * Enam berita terbaru pada hari yang ramai seluruhnya berasal dari satu tema,
 * dan barisnya lalu mengulang apa yang sudah dikatakan panel rincian isu.
 * Satu per tema membuat baris ini menjawab pertanyaan yang lain: "kelihatannya
 * seperti apa" — dan itu yang membuat angka di atasnya bisa dipercaya.
 */
export function contohBerita(rekap, maks = MUAT.contoh, indeks = null) {
  const kartu = []
  for (const t of rekap) {
    const terbaru = t.berita
      .slice()
      .sort((a, b) => String(hariIso(b)).localeCompare(String(hariIso(a))))[0]
    if (!terbaru) continue
    kartu.push({
      judul: rapikanJudul(teksBersih(terbaru.judul)) || '(tanpa judul)',
      upt: terbaru.nama_upt || '',
      provinsi: provinsiBerita(terbaru, indeks) || '',
      tanggal: hariIso(terbaru),
      tema: t.kode,
      warna: t.warna,
      ikon: t.ikon,
      ember: ember(terbaru),
    })
    if (kartu.length >= maks) break
  }
  return kartu.sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))
}

/**
 * Butir sorotan: kalimat pendek tentang apa yang menonjol.
 *
 * Disusun dari angka yang sudah dihitung, bukan ditulis lepas. Tiga butir
 * pertama menyebut tema teratas; butir terakhir menyebut isu negatif bila ada.
 * Bila tidak ada isu negatif sama sekali, butir itu tidak diganti kalimat
 * penenang — ia memang tidak muncul. Lembar yang selalu punya baris peringatan
 * mengajari pembacanya mengabaikan baris peringatan.
 */
export function butirSorotan(rekap, peristiwaNegatif, maks = MUAT.sorotan) {
  const butir = []
  for (const t of rekap.slice(0, maks - 1)) {
    butir.push({
      nada: 'baik',
      teks: `${t.ringkas[0]} — ${t.jumlah} berita (${t.persen}%) pada tema ${t.nama}.`,
    })
  }
  const teratas = peristiwaNegatif[0]
  if (teratas) {
    const unit = teratas.nama_upt && !belumTerpetakan(teratas.nama_upt) ? ` di ${teratas.nama_upt}` : ''
    butir.push({
      nada: 'awas',
      teks: `${teratas.subkategori}${unit} menjadi sorotan: `
        + `${teratas.jumlah_publikasi} publikasi dari ${teratas.jumlah_media} media.`,
    })
  }
  return butir.slice(0, maks)
}

/**
 * Isu sorotan khusus: satu peristiwa negatif yang paling banyak diberitakan,
 * beserta garis waktunya.
 *
 * Dikembalikan null ketika tidak ada peristiwa negatif. Panelnya lalu tidak
 * digambar sama sekali — bukan digambar kosong dengan tulisan "nihil", yang
 * memakan seperempat lembar untuk mengatakan bahwa tidak ada yang perlu
 * dikatakan.
 */
export function isuSorotan(peristiwaNegatif) {
  const utama = peristiwaNegatif[0]
  if (!utama) return null

  const garisWaktu = utama.publikasi
    .slice()
    .sort((a, b) => String(hariIso(a)).localeCompare(String(hariIso(b))))
    .map((b) => ({
      tanggal: hariIso(b),
      teks: teksBersih(b.ringkasan, b.judul) || rapikanJudul(String(b.judul || '')),
      sumber: namaPenerbitTampil(b, sumberAsli(b)),
    }))

  // Satu baris per hari. Lima media yang memberitakan hal yang sama pada hari
  // yang sama adalah satu perkembangan, bukan lima.
  const perHari = new Map()
  for (const g of garisWaktu) if (!perHari.has(g.tanggal)) perHari.set(g.tanggal, g)

  return {
    judul: utama.subkategori || 'Isu sorotan',
    unit: utama.nama_upt && !belumTerpetakan(utama.nama_upt) ? utama.nama_upt : '',
    jumlahPublikasi: utama.jumlah_publikasi,
    jumlahMedia: utama.jumlah_media,
    garisWaktu: [...perHari.values()].slice(-MUAT.garisWaktu),
  }
}

/**
 * Kalimat kesimpulan.
 *
 * Dua kalimat, dan keduanya diturunkan dari angka: yang pertama menyebut nada
 * pemberitaan dan tema yang mendominasi, yang kedua menyebut isu negatif bila
 * ada. Tidak ada penilaian yang tidak bisa ditelusuri ke sebuah angka di
 * lembar yang sama — sebuah kesimpulan yang tidak bisa diperiksa terhadap
 * lembarnya sendiri adalah pendapat, dan lembar ini bukan tempat pendapat.
 */
export function kalimatKesimpulan({ sentimen, tema, sorotan }) {
  const kalimat = []
  const temaTeratas = tema.slice(0, 3).map((t) => t.nama.split(/[,&]/)[0].trim().toLowerCase())

  if (sentimen.positif >= sentimen.negatif + sentimen.netral) {
    kalimat.push({
      nada: 'baik',
      teks: `Pemberitaan didominasi sentimen positif (${sentimen.persen.positif}%), `
        + `dengan fokus pada ${temaTeratas.join(', ')}.`,
    })
  } else if (sentimen.negatif > sentimen.positif) {
    kalimat.push({
      nada: 'awas',
      teks: `Pemberitaan condong negatif (${sentimen.persen.negatif}%), `
        + `terutama pada ${temaTeratas.slice(0, 2).join(' dan ')}.`,
    })
  } else {
    kalimat.push({
      nada: 'netral',
      teks: `Pemberitaan berimbang: ${sentimen.persen.positif}% positif, `
        + `${sentimen.persen.negatif}% negatif, dengan fokus pada ${temaTeratas.join(', ')}.`,
    })
  }

  if (sorotan) {
    const dampak = sentimen.negatif <= 3 ? 'jumlahnya kecil' : 'jumlahnya tidak kecil'
    kalimat.push({
      nada: 'awas',
      teks: `Meski ${dampak}, isu ${sorotan.judul.toLowerCase()}`
        + `${sorotan.unit ? ` di ${sorotan.unit}` : ''} berdampak reputasi tinggi `
        + 'dan perlu perhatian serta komunikasi publik yang transparan.',
    })
  } else {
    kalimat.push({
      nada: 'baik',
      teks: 'Tidak ada isu negatif yang menonjol pada periode ini; '
        + 'pengawasan rutin dilanjutkan tanpa penanganan khusus.',
    })
  }

  return kalimat
}

/**
 * Menyusun seluruh model lembar infografis.
 *
 * @param {object} opsi
 * @param {object[]} opsi.berita  seluruh berita pada periode, apa adanya
 * @param {object[]} [opsi.unit]  data induk UPT, untuk provinsi dan jenis unit
 * @param {string} opsi.mulai     YYYY-MM-DD
 * @param {string} opsi.selesai   YYYY-MM-DD
 * @param {'harian'|'mingguan'|'bulanan'} [opsi.jenis]
 * @param {object} [opsi.indukProvinsi] peta provinsi baru ke induknya, untuk peta
 */
export function susunInfografis({
  berita = [],
  unit = [],
  mulai,
  selesai,
  jenis = 'harian',
  indukProvinsi = {},
} = {}) {
  const indeks = indeksUnit(unit)

  // Himpunan dasarnya milik lib/hitung.js. Yang di luar lingkup dan yang
  // dikecualikan tidak pernah masuk lembar ini — sama seperti tidak pernah
  // masuk dasbor.
  const angka = ringkasan(berita)
  const inti = dasar(berita)

  const sentimen = {
    negatif: angka.negatif.length,
    netral: angka.netral.length,
    positif: angka.positif.length,
    belum: angka.belumDinilai.length,
    total: inti.length,
    persen: {
      negatif: persenBulat(angka.negatif.length, inti.length),
      netral: persenBulat(angka.netral.length, inti.length),
      positif: persenBulat(angka.positif.length, inti.length),
      belum: persenBulat(angka.belumDinilai.length, inti.length),
    },
  }

  const perJenis = { Lapas: 0, Rutan: 0, LPKA: 0, Bapas: 0, '': 0 }
  for (const b of inti) perJenis[jenisUnit(b, indeks)] += 1

  const wilayah = rekapWilayah(inti, indeks, indukProvinsi)
  const media = rekapMedia(inti)
  const { tema, takBertema } = rekapTema(inti)

  // Peristiwa dihitung dari berita negatif saja: panel sorotan menjawab "apa
  // yang menuntut perhatian", dan pengelompokan atas seluruh berita akan
  // dimenangkan unggahan humas yang serentak di puluhan unit.
  const peristiwaNegatif = kelompokkanPeristiwa(inti.filter((b) => ember(b) === 'negatif'))
    .sort((a, b) => b.jumlah_media - a.jumlah_media || b.jumlah_publikasi - a.jumlah_publikasi)

  const sorotan = isuSorotan(peristiwaNegatif)

  return {
    jenis,
    periode: { mulai, selesai, label: labelPeriode(mulai, selesai) },

    ikhtisar: {
      total: inti.length,
      lapas: perJenis.Lapas,
      rutan: perJenis.Rutan,
      lpka: perJenis.LPKA,
      bapas: perJenis.Bapas,
      tanpaUnit: perJenis[''],
      persenLapas: persenBulat(perJenis.Lapas, inti.length),
      persenRutan: persenBulat(perJenis.Rutan, inti.length),
      provinsi: wilayah.jumlahProvinsi,
      media: media.jumlahPenerbit,
    },

    sentimen,
    media,
    wilayah,
    tema,
    takBertema,

    sorotanButir: butirSorotan(tema, peristiwaNegatif),
    isuKhusus: sorotan,
    contoh: contohBerita(tema, MUAT.contoh, indeks),
    kesimpulan: kalimatKesimpulan({ sentimen, tema, sorotan }),

    /* Yang sengaja tidak dihitung, ditampilkan supaya selisihnya bisa
       dijelaskan tanpa membuka basis data. Sama seperti pada lib/hitung.js. */
    dikecualikan: {
      luarLingkup: angka.luarLingkup,
      tidakValid: angka.dikecualikan,
      seluruhBaris: angka.seluruhBaris,
    },
  }
}

export const META_INFOGRAFIS = { versi: 'infografis-v1.0' }
