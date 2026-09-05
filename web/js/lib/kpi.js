/**
 * KPI — seberapa cepat dan seberapa lengkap sistem ini bekerja.
 *
 * Seluruh layar lain menjawab pertanyaan tentang PEMBERITAAN. Berkas ini
 * menjawab pertanyaan tentang SISTEMNYA sendiri, dan pertanyaan itu tidak
 * pernah ditanyakan sampai seseorang menanyakannya di forum yang salah:
 *
 *   Berapa lama sebuah berita berada di luar sana sebelum kami tahu?
 *   Berapa lama ia menunggu sebelum seorang analis membacanya?
 *   Berapa banyak unit yang tidak pernah sekali pun muncul di layar kami —
 *   karena memang tenang, atau karena tidak pernah tertangkap?
 *
 * ## Median, bukan rata-rata
 *
 * Setiap ukuran waktu di sini memakai median dan persentil ke-90, dan tidak
 * satu pun memakai rata-rata. Alasannya bukan selera statistik: satu berita
 * lama yang baru masuk hari ini menghasilkan selisih empat puluh hari, dan
 * satu angka semacam itu di antara tiga ratus baris menggeser rata-rata jauh
 * dari apa pun yang benar-benar terjadi pada hari biasa. Median menyebutkan
 * hari biasa; persentil ke-90 menyebutkan hari terburuk yang masih pantas
 * disebut biasa. Keduanya perlu, dan keduanya ditampilkan berdampingan.
 *
 * ## Yang TIDAK diukur di sini
 *
 * Ketepatan mesin klasifikasi tidak diukur sebagai "false positive rate".
 * Yang bisa dihitung dari data yang ada hanyalah berapa bagian yang ditelaah
 * analis berakhir dinyatakan Tidak Valid — dan itu bukan hal yang sama.
 * Sebuah berita bisa dinyatakan tidak valid karena mesinnya keliru, karena
 * medianya menarik beritanya, atau karena unitnya sudah mengklarifikasi.
 * Angkanya disebut apa adanya: `bagianTidakValid`, dengan kalimat yang
 * mengatakan bahwa ia proksi, bukan ukuran ketepatan.
 */

import { dasar, dikecualikan, menungguTelaah, diLuarLingkup } from './hitung.js'
import { belumTerpetakan } from './unit-terpetakan.js'
import { INDUK_UPT } from './konfig.js'

const JAM = 3_600_000

/* ---------------------------------------------------------------- sebaran */

/**
 * Median, persentil ke-90, dan ekornya.
 *
 * Persentil dihitung dengan metode kedudukan terdekat — sederhana, tanpa
 * interpolasi, dan itu disengaja: angka hasil interpolasi tidak pernah sama
 * dengan satu baris pun di dalam datanya, sehingga tidak bisa ditunjuk ketika
 * seseorang bertanya "yang mana".
 */
export function sebaran(nilai = []) {
  const bersih = nilai.filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b)
  if (!bersih.length) return { n: 0, median: null, p90: null, min: null, maks: null }

  const ambil = (bagian) => bersih[Math.min(bersih.length - 1, Math.floor(bagian * bersih.length))]
  const tengah = bersih.length % 2
    ? bersih[(bersih.length - 1) / 2]
    : (bersih[bersih.length / 2 - 1] + bersih[bersih.length / 2]) / 2

  return {
    n: bersih.length,
    median: tengah,
    p90: ambil(0.9),
    min: bersih[0],
    maks: bersih[bersih.length - 1],
  }
}

function selisihJam(dari, ke) {
  const a = new Date(dari).getTime()
  const b = new Date(ke).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  const jam = (b - a) / JAM
  /*
     Selisih negatif dibuang, tidak dijepit ke nol.

     Tanggal terbit yang lebih baru daripada waktu masuk berarti salah satu
     dari keduanya keliru — dan menjepitnya ke nol akan melaporkan sistem ini
     menangkap berita pada detik yang sama ia terbit. Angka yang terlalu bagus
     untuk benar tidak pernah dipertanyakan siapa pun.
  */
  return jam < 0 ? null : jam
}

/* -------------------------------------------------------------- definisi */

/**
 * Sasaran waktu.
 *
 * Angkanya keputusan kelembagaan, bukan temuan pengukuran, dan karena itu
 * tinggal di satu tempat yang mengubahnya menuntut commit — sama seperti bobot
 * skor risiko. Sasaran yang bisa diubah lewat layar akan diubah menjadi angka
 * yang sudah tercapai.
 */
export const SASARAN = {
  deteksiJam: 6,
  telaahJam: 24,
  tanggapanJam: 48,
  telaahDaerahJam: 24,
  antreanTertua: 72,
  kesegaranJam: 12,
  liputanUnit: 0.35,
}

export const ARAH = { kecil: 'kecil lebih baik', besar: 'besar lebih baik' }

/* ---------------------------------------------------------------- hitung */

function nadaWaktu(nilai, sasaran) {
  if (nilai === null) return 'rendah'
  if (nilai <= sasaran) return 'positif'
  if (nilai <= sasaran * 2) return 'sedang'
  return 'kritis'
}

/**
 * Menghitung seluruh KPI dari arsip yang termuat.
 *
 * `berita` diberikan APA ADANYA, bukan hasil `dasar()`. Beberapa ukuran di
 * sini justru menuntut baris yang dikecualikan — bagian yang dinyatakan tidak
 * valid tidak bisa dihitung dari himpunan yang sudah membuangnya. Pembagiannya
 * dilakukan di dalam sini, sekali, supaya pemanggilnya tidak perlu tahu
 * himpunan mana untuk ukuran mana.
 */
export function hitungKpi(berita = [], { sekarang = new Date(), indukUnit = INDUK_UPT.jumlah } = {}) {
  const semua = berita || []
  const dalamLingkup = dasar(semua)

  const deteksi = sebaran(semua
    .filter((b) => !diLuarLingkup(b))
    .map((b) => selisihJam(b.tanggal_publikasi, b.created_at))
    .filter((n) => n !== null))

  const telaah = sebaran(semua
    .filter((b) => b.verified_at && b.created_at)
    .map((b) => selisihJam(b.created_at, b.verified_at))
    .filter((n) => n !== null))

  const telaahDaerah = sebaran(semua
    .filter((b) => b.telaah_wilayah_pada && b.created_at)
    .map((b) => selisihJam(b.created_at, b.telaah_wilayah_pada))
    .filter((n) => n !== null))

  const tanggapan = sebaran(semua
    .filter((b) => b.tanggapan_pada && b.created_at)
    .map((b) => selisihJam(b.created_at, b.tanggapan_pada))
    .filter((n) => n !== null))

  const antrean = dalamLingkup.filter(menungguTelaah)
  const usiaAntrean = sebaran(antrean
    .map((b) => selisihJam(b.created_at, sekarang.toISOString()))
    .filter((n) => n !== null))

  const ditelaah = semua.filter((b) => !diLuarLingkup(b)
    && ['Terverifikasi', 'Tidak Valid', 'Diarsipkan'].includes(b.status_verifikasi))
  const tidakValid = ditelaah.filter((b) => b.status_verifikasi === 'Tidak Valid')

  const terbaru = semua
    .map((b) => new Date(b.created_at || 0).getTime())
    .filter((t) => Number.isFinite(t) && t > 0)
    .sort((a, b) => b - a)[0]
  const kesegaran = terbaru ? Math.max(0, (sekarang.getTime() - terbaru) / JAM) : null

  const unitTersentuh = new Set(dalamLingkup
    .map((b) => b.nama_upt)
    .filter((u) => !belumTerpetakan(u)))
  const belumDipetakan = dalamLingkup.filter((b) => belumTerpetakan(b.nama_upt)).length

  return [
    {
      kode: 'deteksi',
      label: 'Waktu deteksi',
      ringkas: 'Terbit → masuk sistem',
      satuan: 'jam',
      arah: ARAH.kecil,
      sasaran: SASARAN.deteksiJam,
      nilai: deteksi.median,
      ekor: deteksi.p90,
      dasar: deteksi.n,
      nada: nadaWaktu(deteksi.median, SASARAN.deteksiJam),
      ket: 'Selisih antara tanggal terbit dan waktu baris ini masuk. Diukur pada '
        + 'seluruh baris dalam lingkup, termasuk yang kemudian dinyatakan tidak valid — '
        + 'sistem tetap harus cepat menangkapnya untuk bisa membantahnya.',
    },
    {
      kode: 'telaah',
      label: 'Waktu telaah pusat',
      ringkas: 'Masuk → diputus analis',
      satuan: 'jam',
      arah: ARAH.kecil,
      sasaran: SASARAN.telaahJam,
      nilai: telaah.median,
      ekor: telaah.p90,
      dasar: telaah.n,
      nada: nadaWaktu(telaah.median, SASARAN.telaahJam),
      ket: 'Hanya baris yang sudah punya waktu telaah. Baris yang masih menunggu '
        + 'tidak dihitung di sini — ia dihitung pada Usia antrean, dan memang dua hal '
        + 'yang berbeda: yang satu seberapa cepat kami memutuskan, yang lain seberapa '
        + 'lama yang belum diputuskan sudah menunggu.',
    },
    {
      kode: 'telaah_daerah',
      label: 'Waktu telaah daerah',
      ringkas: 'Masuk → diputus unit atau wilayah',
      satuan: 'jam',
      arah: ARAH.kecil,
      sasaran: SASARAN.telaahDaerahJam,
      nilai: telaahDaerah.median,
      ekor: telaahDaerah.p90,
      dasar: telaahDaerah.n,
      nada: nadaWaktu(telaahDaerah.median, SASARAN.telaahDaerahJam),
      ket: 'Putusan telaah daerah tidak menyentuh status verifikasi pusat; keduanya '
        + 'berjalan berdampingan dan diukur terpisah.',
    },
    {
      kode: 'tanggapan',
      label: 'Waktu sikap resmi',
      ringkas: 'Masuk → unit bersikap',
      satuan: 'jam',
      arah: ARAH.kecil,
      sasaran: SASARAN.tanggapanJam,
      nilai: tanggapan.median,
      ekor: tanggapan.p90,
      dasar: tanggapan.n,
      nada: nadaWaktu(tanggapan.median, SASARAN.tanggapanJam),
      ket: 'Diukur hanya pada baris yang sudah pernah ditanggapi. Berapa banyak yang '
        + 'tidak pernah ditanggapi sama sekali adalah pertanyaan lain, dan dijawab '
        + 'aturan "Membesar tanpa sikap resmi" di Peringatan Dini.',
    },
    {
      kode: 'antrean',
      label: 'Usia antrean telaah',
      ringkas: 'Yang paling lama menunggu',
      satuan: 'jam',
      arah: ARAH.kecil,
      sasaran: SASARAN.antreanTertua,
      nilai: usiaAntrean.median,
      ekor: usiaAntrean.maks,
      dasar: antrean.length,
      nada: nadaWaktu(usiaAntrean.maks, SASARAN.antreanTertua),
      ket: 'Nada ubin ini mengikuti baris TERTUA, bukan mediannya. Antrean yang '
        + 'sehat pada umumnya tetap tidak sehat bila ada satu baris yang tertinggal '
        + 'sepekan di dalamnya.',
    },
    {
      kode: 'kesegaran',
      label: 'Kesegaran data',
      ringkas: 'Sejak baris terakhir masuk',
      satuan: 'jam',
      arah: ARAH.kecil,
      sasaran: SASARAN.kesegaranJam,
      nilai: kesegaran,
      ekor: null,
      dasar: semua.length,
      nada: nadaWaktu(kesegaran, SASARAN.kesegaranJam),
      ket: 'Bila angka ini membesar tanpa sebab, yang rusak hampir selalu sinkronisasi '
        + 'sumber — bukan pemberitaan yang tiba-tiba berhenti.',
    },
    {
      kode: 'liputan_unit',
      label: 'Liputan unit',
      ringkas: 'Unit yang pernah muncul',
      satuan: 'bagian',
      arah: ARAH.besar,
      sasaran: SASARAN.liputanUnit,
      nilai: indukUnit ? unitTersentuh.size / indukUnit : null,
      ekor: null,
      dasar: unitTersentuh.size,
      pembagi: indukUnit,
      nada: indukUnit && unitTersentuh.size / indukUnit >= SASARAN.liputanUnit ? 'positif' : 'sedang',
      ket: 'Berapa bagian dari seluruh unit yang pernah muncul di arsip yang termuat. '
        + 'Angka rendah tidak selalu buruk — banyak unit memang tidak diberitakan — '
        + 'tetapi angka yang tidak pernah naik menandakan sumber yang tidak menjangkau.',
    },
    {
      kode: 'belum_dipetakan',
      label: 'Belum terpetakan',
      ringkas: 'Baris tanpa unit yang pasti',
      satuan: 'bagian',
      arah: ARAH.kecil,
      sasaran: 0.1,
      nilai: dalamLingkup.length ? belumDipetakan / dalamLingkup.length : null,
      ekor: null,
      dasar: belumDipetakan,
      pembagi: dalamLingkup.length,
      nada: !dalamLingkup.length || belumDipetakan / dalamLingkup.length <= 0.1 ? 'positif' : 'sedang',
      ket: 'Baris yang unitnya belum bisa disimpulkan mesin. Setiap baris di sini '
        + 'adalah baris yang tidak muncul di peta, tidak muncul di dasbor unit mana pun, '
        + 'dan tetap terhitung pada angka nasional.',
    },
    {
      kode: 'tidak_valid',
      label: 'Bagian tidak valid',
      ringkas: 'Dari yang sudah ditelaah',
      satuan: 'bagian',
      arah: ARAH.kecil,
      sasaran: 0.15,
      nilai: ditelaah.length ? tidakValid.length / ditelaah.length : null,
      ekor: null,
      dasar: tidakValid.length,
      pembagi: ditelaah.length,
      nada: !ditelaah.length || tidakValid.length / ditelaah.length <= 0.15 ? 'positif' : 'sedang',
      ket: 'BUKAN ukuran ketepatan mesin. Sebuah baris dinyatakan tidak valid karena '
        + 'mesinnya keliru, karena medianya menarik beritanya, atau karena unitnya sudah '
        + 'mengklarifikasi — ketiganya terhitung sama di sini.',
    },
  ]
}

/** Ringkasan satu baris: berapa ukuran yang sudah memenuhi sasarannya. */
export function rekapKpi(daftar = []) {
  const terukur = daftar.filter((k) => k.nilai !== null)
  return {
    jumlah: daftar.length,
    terukur: terukur.length,
    tercapai: terukur.filter((k) => k.nada === 'positif').length,
    meleset: terukur.filter((k) => k.nada === 'kritis').length,
    /* Ukuran yang belum bisa dihitung sama sekali. Bukan nol, dan tidak boleh
       ditampilkan sebagai nol: nol berarti "diukur dan hasilnya nol". */
    belumTerukur: daftar.length - terukur.length,
  }
}

/** Nilai KPI sebagai teks siap tampil, lengkap dengan satuannya. */
export function nilaiTampil(kpi) {
  if (kpi.nilai === null) return 'belum terukur'
  if (kpi.satuan === 'bagian') return `${(kpi.nilai * 100).toFixed(1).replace('.', ',')}%`
  if (kpi.nilai < 1) return `${Math.round(kpi.nilai * 60)} menit`
  if (kpi.nilai >= 48) return `${(kpi.nilai / 24).toFixed(1).replace('.', ',')} hari`
  return `${kpi.nilai.toFixed(1).replace('.', ',')} jam`
}

export const META_KPI = { versi: 'kpi-v1.0', sasaran: SASARAN }
