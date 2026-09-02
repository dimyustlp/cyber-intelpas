/**
 * Penghitungan angka — satu himpunan dasar untuk seluruh layar.
 *
 * Keluhan yang melahirkan berkas ini: jumlah berita di kepala dasbor tidak
 * cocok dengan jumlah di kanal negatif dan positif di bawahnya. Setelah
 * ditelusuri, tidak ada satu pun angka yang salah hitung — yang berbeda adalah
 * pertanyaannya. Dasbor menghitung seluruh arsip termasuk berita yang sudah
 * dinyatakan tidak valid, lencana menu membuangnya, kanal memakai definisi
 * negatif yang lain lagi, dan semuanya bekerja pada 400 baris terbaru sementara
 * basis data menyimpan jauh lebih banyak.
 *
 * Maka aturannya dinyatakan sekali di sini:
 *
 *   1. Berita di luar lingkup Pemasyarakatan tidak pernah menjadi angka.
 *      Perkara Rutan KPK bukan beban unit mana pun.
 *   2. Berita yang sudah dinyatakan "Tidak Valid" atau "Diarsipkan" oleh analis
 *      tidak menaikkan angka apa pun. Kalau ia tetap dihitung, telaah yang
 *      menyatakannya tidak valid menjadi pekerjaan tanpa akibat.
 *   3. Yang tersisa itulah himpunan dasar. Seluruh angka di layar adalah
 *      pecahan darinya, dan karena itu selalu bisa dijumlahkan kembali.
 *
 * Aturan ketiga yang membuat kekeliruan berikutnya terlihat sendiri: dasbor
 * menampilkan penjumlahannya di layar, sehingga selisih apa pun terbaca oleh
 * pembacanya, bukan ditemukan berbulan-bulan kemudian.
 */

import { ember, hitungEmber } from './sentimen.js'
import { tanggalIso } from './format.js'
import { belumTerpetakan } from './pencocokan-upt.js'

/** Status yang menyatakan sebuah berita sudah tidak dipakai sebagai angka. */
export const STATUS_DIKECUALIKAN = ['Tidak Valid', 'Diarsipkan']

/** Status yang masih menunggu keputusan analis di Antrean Telaah. */
export const STATUS_ANTREAN = ['Belum Ditelaah', 'Perlu Koreksi']

/**
 * Putusan telaah wilayah dan unit.
 *
 * Berdiri sendiri dari `status_verifikasi`, dan sengaja demikian. Yang
 * menentukan sebuah berita ikut dihitung tetap analis pusat; yang dinyatakan
 * kantor wilayah atau unit adalah apakah kabar itu benar menyangkut mereka dan
 * apakah penilaian mesin sudah tepat. Menyatukan keduanya berarti sebuah unit
 * dapat menghapus berita tentang dirinya sendiri dari angka nasional.
 */
export const TELAAH_WILAYAH = [
  { kode: 'Sesuai', nada: 'positif', ket: 'Penilaian mesin sudah tepat menurut unit yang bersangkutan.' },
  { kode: 'Direvisi', nada: 'sedang', ket: 'Penilaian mesin diperbaiki. Alasannya wajib ditulis.' },
  { kode: 'Bukan Unit Kami', nada: 'rendah', ket: 'Kabar ini tidak menyangkut unit atau wilayah ini.' },
  { kode: 'Perlu Perhatian', nada: 'kritis', ket: 'Benar, dan menuntut tindakan di luar telaah.' },
]

/** Sikap resmi unit atas berita yang menyangkutnya. */
export const SIKAP_TANGGAPAN = [
  { kode: 'Dibenarkan', nada: 'sedang', ket: 'Isi berita sesuai dengan keadaan di unit.' },
  { kode: 'Sebagian Benar', nada: 'sedang', ket: 'Ada bagian yang benar dan ada yang keliru; sebutkan yang mana.' },
  { kode: 'Tidak Benar', nada: 'kritis', ket: 'Isi berita tidak sesuai keadaan di unit.' },
  { kode: 'Sudah Ditangani', nada: 'positif', ket: 'Benar, dan tindakannya sudah diambil unit.' },
]

/**
 * Menunggu telaah wilayah atau unit.
 *
 * Berita di luar lingkup tetap dikeluarkan — tidak ada gunanya meminta sebuah
 * lapas menelaah unggahan berbahasa asing yang kebetulan memuat kata "lapas".
 * Yang TIDAK dikeluarkan adalah berita yang sudah diverifikasi pusat: putusan
 * pusat menentukan angka, bukan menutup mulut daerah.
 */
export function menungguTelaahWilayah(b) {
  if (!b || diLuarLingkup(b) || dikecualikan(b)) return false
  const s = b.telaah_wilayah_status
  return !s || s === 'Belum Ditelaah'
}

/** Berita yang sudah dinyatakan sikapnya oleh unit yang bersangkutan. */
export function sudahDitanggapi(b) {
  return Boolean(b?.tanggapan_sikap || String(b?.tanggapan_upt || '').trim())
}

export const URGENSI_MENDESAK = ['Tinggi', 'Kritis']

export function diLuarLingkup(b) {
  return b?.kategori === 'Di Luar Lingkup'
}

export function dikecualikan(b) {
  return STATUS_DIKECUALIKAN.includes(b?.status_verifikasi)
}

/**
 * Menunggu telaah.
 *
 * Status kosong ikut dihitung karena baris lama dari Streamlit tidak selalu
 * mengisinya, dan berita tanpa status tetap berita yang belum pernah dibaca
 * manusia. Lencana menu dan isi antrean memakai fungsi yang sama persis,
 * supaya angka pada lencana tidak pernah lagi berbeda dari panjang daftarnya.
 */
export function menungguTelaah(b) {
  if (!b || diLuarLingkup(b) || dikecualikan(b)) return false
  const s = b.status_verifikasi
  return !s || STATUS_ANTREAN.includes(s)
}

/**
 * Tingkat kerawanan sebuah unit — lima derajat, berurut.
 *
 * Peta Sebaran mewarnai 531 titik menurut daftar ini, dan warna pada peta
 * adalah pernyataan: siapa pun yang melihat titik merah akan menyimpulkan ada
 * sesuatu yang gawat di sana. Maka aturannya dinyatakan sekali di sini, bukan
 * di dalam halaman petanya, dan ditulis dengan angka yang bisa diperiksa —
 * bukan "banyak" atau "sedikit".
 *
 * Urutannya dari yang paling gawat, supaya legenda dan pencarian derajat
 * pertama yang cocok memakai daftar yang sama.
 */
export const KERAWANAN = [
  {
    kode: 'kritis',
    label: 'Kritis',
    nada: 'kritis',
    ket: 'Ada berita berurgensi kritis, atau enam berita negatif atau lebih.',
  },
  {
    kode: 'rawan',
    label: 'Rawan',
    nada: 'sedang',
    ket: 'Ada berita berurgensi tinggi, atau tiga berita negatif atau lebih.',
  },
  {
    kode: 'waspada',
    label: 'Waspada',
    nada: 'rendah',
    ket: 'Ada berita negatif, tetapi belum ada yang mendesak.',
  },
  {
    kode: 'aman',
    label: 'Terkendali',
    nada: 'positif',
    ket: 'Ada pemberitaan, dan tidak satu pun bersentimen negatif.',
  },
  {
    kode: 'sepi',
    label: 'Tanpa pemberitaan',
    nada: 'netral',
    ket: 'Belum ada satu pun berita yang terpetakan ke unit ini.',
  },
]

/**
 * Menilai kerawanan satu unit dari berita yang terpetakan kepadanya.
 *
 * Yang dihitung hanya himpunan dasar: berita di luar lingkup dan yang sudah
 * dinyatakan tidak valid tidak boleh mewarnai satu titik pun menjadi merah.
 * Sebuah unit yang berita tentangnya sudah ditolak analis tetapi tetap
 * berwarna merah di peta adalah cara termahal membuat pimpinan tidak lagi
 * mempercayai petanya.
 */
export function tingkatKerawanan(daftar = []) {
  const inti = dasar(daftar)
  if (!inti.length) return KERAWANAN.find((k) => k.kode === 'sepi')

  const negatif = inti.filter((b) => ember(b) === 'negatif').length
  const kritis = inti.some((b) => b.urgensi === 'Kritis')
  const tinggi = inti.some((b) => b.urgensi === 'Tinggi')

  const kode = (kritis || negatif >= 6) ? 'kritis'
    : (tinggi || negatif >= 3) ? 'rawan'
      : negatif >= 1 ? 'waspada'
        : 'aman'

  return KERAWANAN.find((k) => k.kode === kode)
}

/** Himpunan dasar: dalam lingkup, belum dikecualikan. */
export function dasar(daftar = []) {
  return daftar.filter((b) => !diLuarLingkup(b) && !dikecualikan(b))
}

/**
 * Seluruh angka dasbor sekaligus, dihitung dari satu himpunan dasar.
 *
 * Dikembalikan sebagai satu objek — bukan tujuh fungsi terpisah — supaya
 * mustahil ada halaman yang memakai lima di antaranya lalu menghitung sendiri
 * yang keenam.
 */
export function ringkasan(daftar = [], sekarang = new Date()) {
  const semua = daftar || []
  const inti = dasar(semua)

  const hariIniIso = tanggalIso(sekarang)
  const kemarinIso = tanggalIso(new Date(sekarang.getTime() - 86_400_000))

  const perEmber = hitungEmber(inti)
  const daftarMendesak = inti.filter((b) => URGENSI_MENDESAK.includes(b.urgensi))

  return {
    /** Himpunan yang dipakai seluruh angka di bawah. */
    inti,

    total: inti.length,
    negatif: inti.filter((b) => ember(b) === 'negatif'),
    netral: inti.filter((b) => ember(b) === 'netral'),
    positif: inti.filter((b) => ember(b) === 'positif'),
    belumDinilai: inti.filter((b) => ember(b) === 'belum'),
    perEmber,

    mendesak: daftarMendesak,
    kritis: daftarMendesak.filter((b) => b.urgensi === 'Kritis'),

    antrean: inti.filter(menungguTelaah),
    takTerpetakan: inti.filter((b) => belumTerpetakan(b.nama_upt)),

    /* Antrean ruang wilayah dan ruang unit. Dihitung dari himpunan dasar yang
       sama seperti antrean pusat, supaya kedua angka selalu bisa dibandingkan
       tanpa seorang pun perlu menerka definisinya. */
    antreanWilayah: inti.filter(menungguTelaahWilayah),
    ditanggapi: inti.filter(sudahDitanggapi),

    hariIni: inti.filter((b) => tanggalIso(b.created_at) === hariIniIso),
    kemarin: inti.filter((b) => tanggalIso(b.created_at) === kemarinIso),

    /** Yang sengaja tidak dihitung — ditampilkan supaya selisihnya bisa dijelaskan. */
    luarLingkup: semua.filter(diLuarLingkup).length,
    dikecualikan: semua.filter((b) => !diLuarLingkup(b) && dikecualikan(b)).length,
    seluruhBaris: semua.length,
  }
}

/**
 * Angka untuk lencana menu samping.
 *
 * Dipisahkan dari `ringkasan` hanya karena ia dipanggil di tempat lain
 * (kerangka layar, bukan halaman), tetapi aturannya dipinjam utuh dari sana —
 * tidak ada satu pun penyaring yang ditulis ulang di berkas main.js.
 */
export function lencana(daftar = []) {
  const r = ringkasan(daftar)
  return {
    peringatan: r.mendesak.length,
    telaah: r.antrean.length,
    negatif: r.negatif.length,
    pemetaan: r.takTerpetakan.length,
    telaahWilayah: r.antreanWilayah.length,
  }
}

/* --------------------------------------------- unit yang naik ke permukaan */

/** Tanggal sebuah berita sebagai ISO hari, memakai tanggal terbit bila ada. */
export function hariBerita(b) {
  return String(b?.tanggal_publikasi || b?.tanggal || b?.created_at || '').slice(0, 10)
}

/**
 * Unit yang paling banyak diberitakan pada sebuah rentang, beserta
 * pembandingnya pada rentang sepanjang itu tepat sebelumnya.
 *
 * Dipakai tiga tempat sekaligus: halaman Tren Pemberitaan, kartu di Laporan
 * Berkala, dan bagan batang di dalam berkas laporan serta pesan Telegram.
 * Ketiganya menjawab pertanyaan yang sama — "unit apa yang minggu ini naik ke
 * permukaan, dan berapa beritanya" — dan pertanyaan yang sama harus dijawab
 * satu hitungan, bukan tiga.
 *
 * Pembandingnya bukan hiasan. Dua belas berita di unit yang pekan lalu juga
 * dua belas adalah keadaan tenang; dua belas di unit yang pekan lalu nol
 * adalah keadaan yang harus dibaca malam ini juga. Tanpa pembanding, keduanya
 * tercetak sebagai baris yang sama persis.
 *
 * @param {object[]} daftar berita mentah; himpunan dasarnya dihitung di sini
 * @param {{mulai:string, selesai:string, maks?:number}} rentang ISO, inklusif
 */
export function uptNaik(daftar = [], { mulai, selesai, maks = 10 } = {}) {
  const inti = dasar(daftar)
  if (!mulai || !selesai) return []

  const satuHari = 86_400_000
  const awal = new Date(`${mulai}T00:00:00Z`)
  const akhir = new Date(`${selesai}T00:00:00Z`)
  const panjang = Math.max(1, Math.round((akhir - awal) / satuHari) + 1)

  const mulaiSebelum = new Date(awal.getTime() - panjang * satuHari).toISOString().slice(0, 10)
  const selesaiSebelum = new Date(awal.getTime() - satuHari).toISOString().slice(0, 10)

  const dalam = (b, a, z) => {
    const h = hariBerita(b)
    return h >= a && h <= z
  }

  const kini = new Map()
  const lalu = new Map()

  for (const b of inti) {
    // Berita yang unitnya belum terpetakan tidak dilekatkan ke unit mana pun.
    // Aturan yang sama dipakai peta sebaran dan laporan berkala.
    if (belumTerpetakan(b.nama_upt)) continue
    if (dalam(b, mulai, selesai)) {
      const baris = kini.get(b.nama_upt) || { nama: b.nama_upt, jumlah: 0, negatif: 0 }
      baris.jumlah += 1
      if (ember(b) === 'negatif') baris.negatif += 1
      kini.set(b.nama_upt, baris)
    } else if (dalam(b, mulaiSebelum, selesaiSebelum)) {
      lalu.set(b.nama_upt, (lalu.get(b.nama_upt) || 0) + 1)
    }
  }

  return [...kini.values()]
    .map((u) => {
      const sebelum = lalu.get(u.nama) || 0
      return { ...u, sebelum, delta: u.jumlah - sebelum }
    })
    /*
       Diurutkan menurut jumlah, bukan menurut kenaikan.

       Kenaikan terbesar hampir selalu dimiliki unit yang pekan lalu nol dan
       pekan ini dua — dan daftar yang dipimpin unit berberita dua tidak
       menjawab pertanyaan siapa pun. Kenaikannya tetap ditampilkan pada tiap
       baris, sehingga yang melonjak tetap terbaca tanpa harus memimpin daftar.
    */
    .sort((a, b) => b.jumlah - a.jumlah || b.delta - a.delta || a.nama.localeCompare(b.nama))
    .slice(0, maks)
}

/** Rentang periode sebelumnya, sepanjang periode yang diberikan. */
export function periodeSebelum(mulai, selesai) {
  const satuHari = 86_400_000
  const awal = new Date(`${mulai}T00:00:00Z`)
  const akhir = new Date(`${selesai}T00:00:00Z`)
  const panjang = Math.max(1, Math.round((akhir - awal) / satuHari) + 1)
  return {
    mulai: new Date(awal.getTime() - panjang * satuHari).toISOString().slice(0, 10),
    selesai: new Date(awal.getTime() - satuHari).toISOString().slice(0, 10),
  }
}

/**
 * Deret harian sepanjang rentang mana pun, termasuk hari yang kosong.
 *
 * Berbeda dari deret harian yang dulu tinggal di lib/demo.js pada dua hal,
 * dan keduanya disengaja. Panjangnya bebas, bukan tetap empat belas hari. Dan
 * harinya diambil dari tanggal terbit bila ada — sebuah berita yang tertarik penyalin
 * tiga hari sesudah terbit adalah berita hari terbitnya, bukan berita hari
 * penarikannya, dan pada halaman tren selisih tiga hari itu memindahkan
 * puncak grafik ke tempat yang salah.
 *
 * Hari sepi tetap ditulis dengan nol. Menghilangkannya membuat garis tren
 * menyambung dua hari yang berjauhan seolah keduanya berurutan.
 */
export function deretTren(daftar = [], { mulai, selesai } = {}) {
  const inti = dasar(daftar)
  const ember2 = new Map()

  const satuHari = 86_400_000
  const awal = new Date(`${mulai}T00:00:00Z`)
  const akhir = new Date(`${selesai}T00:00:00Z`)
  for (let t = awal.getTime(); t <= akhir.getTime(); t += satuHari) {
    const iso = new Date(t).toISOString().slice(0, 10)
    ember2.set(iso, { tanggal: iso, total: 0, negatif: 0, mendesak: 0 })
  }

  for (const b of inti) {
    const e = ember2.get(hariBerita(b))
    if (!e) continue
    e.total += 1
    if (ember(b) === 'negatif') e.negatif += 1
    if (URGENSI_MENDESAK.includes(b.urgensi)) e.mendesak += 1
  }

  return [...ember2.values()]
}

/**
 * Ringkasan satu rentang beserta rentang sepanjang itu tepat sebelumnya.
 *
 * Dipakai ubin pembanding di halaman Tren Pemberitaan. Angka tanpa
 * pembanding hanya bisa dibaca oleh orang yang kebetulan hafal angka pekan
 * lalu, dan tidak ada yang hafal angka pekan lalu.
 */
export function bandingPeriode(daftar = [], { mulai, selesai } = {}) {
  const inti = dasar(daftar)
  const lalu = periodeSebelum(mulai, selesai)

  const potong = (a, z) => inti.filter((b) => {
    const h = hariBerita(b)
    return h >= a && h <= z
  })

  const hitung = (kumpulan) => ({
    publikasi: kumpulan.length,
    negatif: kumpulan.filter((b) => ember(b) === 'negatif').length,
    mendesak: kumpulan.filter((b) => URGENSI_MENDESAK.includes(b.urgensi)).length,
    unit: new Set(kumpulan.filter((b) => !belumTerpetakan(b.nama_upt)).map((b) => b.nama_upt)).size,
    media: new Set(kumpulan.map((b) => b.media).filter(Boolean)).size,
  })

  return {
    periode: { mulai, selesai },
    sebelum: { ...lalu },
    kini: hitung(potong(mulai, selesai)),
    lalu: hitung(potong(lalu.mulai, lalu.selesai)),
    daftarKini: potong(mulai, selesai),
    daftarLalu: potong(lalu.mulai, lalu.selesai),
  }
}

/**
 * Perubahan besaran sebuah bidang antar dua periode.
 *
 * Menjawab "isu apa yang menanjak" dan "media mana yang tiba-tiba ramai"
 * dengan satu fungsi, sebab keduanya pertanyaan yang sama atas kolom yang
 * berbeda. Yang muncul dari nol ikut dihitung — justru itulah yang paling
 * perlu terbaca.
 */
export function pergeseran(kini = [], lalu = [], bidang = 'subkategori', maks = 8) {
  const hitung = (kumpulan) => {
    const peta = new Map()
    for (const b of kumpulan) {
      const k = b[bidang]
      if (!k) continue
      peta.set(k, (peta.get(k) || 0) + 1)
    }
    return peta
  }

  const a = hitung(kini)
  const z = hitung(lalu)
  const nama = new Set([...a.keys(), ...z.keys()])

  return [...nama]
    .map((n) => {
      const jumlah = a.get(n) || 0
      const sebelum = z.get(n) || 0
      return { nama: n, jumlah, sebelum, delta: jumlah - sebelum }
    })
    .filter((b) => b.jumlah > 0 || b.sebelum > 0)
    .sort((x, y) => y.delta - x.delta || y.jumlah - x.jumlah)
    .slice(0, maks)
}

/**
 * Deret empat belas hari terakhir, siap dipakai bagan tren mana pun.
 *
 * Menggantikan `deretHarian` di lib/demo.js yang selama ini dipakai dasbor
 * pusat dan dasbor wilayah. Dua hal berbeda, dan keduanya penting.
 *
 * Harinya kini diambil dari TANGGAL TERBIT bila ada, bukan dari waktu barisnya
 * masuk. Pada arsip 2 September 2026, 346 dari 815 baris terbit pada hari yang
 * berbeda dari hari penarikannya — rata-rata selisihnya empat setengah hari,
 * yang terjauh delapan tahun. Selama bagan dasbor memakai waktu penarikan
 * sementara laporan berkala memakai tanggal terbit, keduanya menggambar dunia
 * yang berbeda dari data yang sama, dan yang membandingkannya tidak punya cara
 * mengetahui mana yang benar.
 *
 * Himpunan dasarnya juga sudah disaring aturan lib/hitung.js — berita di luar
 * lingkup dan yang sudah dinyatakan tidak valid tidak lagi menaikkan garisnya.
 *
 * Ubin "Berita masuk hari ini" di dasbor SENGAJA tidak ikut berubah: ia memang
 * menghitung yang masuk hari ini, dan namanya sudah menyatakan itu.
 */
export function deretEmpatBelasHari(daftar = [], hari = 14, acuan = new Date()) {
  const satuHari = 86_400_000
  const selesai = new Date(acuan)
  const mulai = new Date(acuan.getTime() - (hari - 1) * satuHari)
  return deretTren(daftar, {
    mulai: mulai.toISOString().slice(0, 10),
    selesai: selesai.toISOString().slice(0, 10),
  })
}
