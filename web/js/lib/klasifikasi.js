/**
 * Mesin klasifikasi berita Trans-Siber PAS.
 *
 * ---------------------------------------------------------------------------
 * Versi 4 — mesin mulai membaca penerbit, bukan hanya teks
 * ---------------------------------------------------------------------------
 *
 * Pemeriksaan atas arsip menemukan bahwa 159 dari 653 publikasi — hampir satu
 * dari empat — tidak menghasilkan keterangan apa pun. Tujuh puluh empat jatuh
 * ke "Lainnya" dengan keyakinan 0,20, dan delapan puluh lima dibuang sebagai
 * di luar lingkup. Ketika dibaca satu per satu, ternyata sebagian besarnya
 * adalah publikasi kehumasan unit pelaksana teknis sendiri.
 *
 * Empat sebab, dan keempatnya diperbaiki di versi ini:
 *
 *   1. Pola tekstual tidak pernah dijalankan. Seluruh blok pola berada di balik
 *      penjagaan "hanya bila sudah ada kata kunci yang cocok", sehingga pola
 *      hanya berlaku pada berita yang justru paling tidak membutuhkannya.
 *      "Kapasitas 71 Orang, Rutan Negara Kini Dihuni 213 Warga Binaan" punya
 *      polanya sendiri, cocok sempurna, dan tetap berskor nol.
 *
 *   2. Penerbit tidak pernah dibaca. Sebuah unggahan dari kanal "Rutan
 *      Boyolali" atau "Humas Lapas Pasir Pangarayan" adalah publikasi kehumasan
 *      unit itu — pertanyaannya tinggal kegiatan apa, bukan termasuk apa.
 *      Mesin lama hanya membaca judulnya, dan judul unggahan kehumasan memang
 *      tidak ditulis dengan kata kunci.
 *
 *   3. Gerbang relevansi membuang terbitan resmi. Judul "Sehat Bersama, Peduli
 *      Bersama" tidak menyebut nama unit mana pun, karena nama unitnya sudah
 *      tertulis pada kanal yang menerbitkannya. Mesin lama membuangnya sebagai
 *      konten tidak relevan.
 *
 *   4. Bantahan yang menggeser kandidat lain ikut terbuang bersamanya. Pelarian
 *      menang dengan 4,23 dan lolos ambang; bantahan naik ke puncak dengan
 *      2,43 dan tidak lolos; keduanya sama-sama hilang.
 *
 * Yang tetap dijaga: tidak ada penyedia AI luar yang dipanggil, tidak ada
 * kunci yang dikirim ke mana pun, dan seluruh keputusan tetap bisa dijelaskan
 * kalimat per kalimat kepada analis yang menelaahnya.
 *
 * ---------------------------------------------------------------------------
 * Warisan versi 3 yang tetap berlaku
 * ---------------------------------------------------------------------------
 *
 *   Pencocokan kata kini menghormati batas kata dan bentuk imbuhan. Dulu kata
 *   kunci "sabu" ikut cocok pada "pembuatan sabun", sementara "penganiayaan"
 *   tidak pernah cocok pada "dianiaya". Dua-duanya sudah tidak terjadi lagi;
 *   dasarnya ada di teks.js.
 *
 *   Ada gerbang relevansi di depan. Rutan KPK dan Rutan Bareskrim bukan unit
 *   Pemasyarakatan, dan unggahan berbahasa Hindi yang memuat kata "bapas" bukan
 *   berita. Keduanya kini punya kategorinya sendiri dan tidak lagi ikut dihitung
 *   sebagai publikasi terpantau.
 *
 *   Konteks kehumasan dikenali. Sebagian besar publikasi harian adalah unggahan
 *   resmi UPT. Ketika mesin melihat ciri unggahan semacam itu dan tidak
 *   menemukan satu pun indikasi negatif, ambang untuk kategori positif
 *   diturunkan — sebab kegiatan seremonial memang jarang memakai kata kunci yang
 *   tegas.
 *
 *   Bantahan dipisahkan dari peristiwanya. "Bukan kabur, Rutan Muntok sebut yang
 *   bersangkutan sedang menjalani asimilasi" bukan berita pelarian, melainkan
 *   berita klarifikasi. Dulu mesin membacanya sebagai pelarian dan menaikkan
 *   angka insiden tanpa ada insiden.
 *
 * Warisan yang tetap dipertahankan dari versi sebelumnya: seluruh subkategori
 * diberi skor lalu yang tertinggi menang, pelaku dideteksi terpisah supaya
 * perbuatan petugas tidak tertukar dengan perbuatan warga binaan, frasa pembalik
 * dikenali, dan keyakinan dihitung dari selisih skor juara terhadap pesaing
 * terdekatnya sehingga angkanya berarti sesuatu bagi analis.
 *
 * Modul ES murni. Dipakai di peramban dan di Edge Function tanpa perubahan.
 */

import {
  KATEGORI,
  KATEGORI_LAINNYA,
  KATEGORI_LUAR_LINGKUP,
  SEMUA_SUBKATEGORI,
  PENANDA_AKTOR,
  PENANDA_LEMBAGA_LAIN,
  PENANDA_KEHUMASAN,
  JANGKAR_PEMASYARAKATAN,
  JANGKAR_KUAT,
  KATA_FUNGSI_INDONESIA,
  FRASA_PEMBALIK,
  FRASA_BANTAHAN,
  FRASA_KEGIATAN,
  FRASA_TEMUAN,
  OBJEK_TEMUAN,
  KEGIATAN_KE_SUBKATEGORI,
  POLA_YURISDIKSI_ASING,
  PENANDA_ASING_TEGAS,
  JANGKAR_INDONESIA,
  SAMARAN_FRASA,
  PEMICU_KRITIS,
  PERINGKAT_URGENSI,
} from './taksonomi.js'

import { bersihkanTeks, normalkan, siapkanKonteks, hitungFrasa, yangMuncul, letakTerawal, letakFrasa } from './teks.js'
import { kenaliPenerbit } from './penerbit.js'

/*
   Versi mesin, dan ia BUKAN sekadar catatan.

   Nilainya ikut tersimpan pada tiap baris sebagai ai_provider, sehingga analis
   yang membuka sebuah berita bisa tahu mesin keberapa yang menilainya. Tanpa
   angka yang berubah, arsip yang dinilai sebelum dan sesudah perbaikan terbaca
   sebagai satu himpunan yang seragam, dan penilaian yang sudah diperbaiki
   tidak bisa dibedakan dari yang belum.

   v4.1 (6 September 2026) — bantahan diputuskan menurut URUTAN kata, bukan
   perbandingan skor; pola kata kerja ditambahkan pada 3.3, 3.4, 4.3, dan 6.2;
   4.2 mengenali "berkapasitas"; 8.1 menolak remisi yang diperjualbelikan.

   v4.2 (6 September 2026, malam) — kegiatan tentang sebuah isu tidak lagi
   tercatat sebagai isunya. Kaidahnya sama dengan bantahan: urutan kata.
   Ditambah dua penutup jembatan imbuhan di teks.js ('pelari'/'pelar'/'larian'
   dan 'sehat').

   v4.2 lahir dari pemberitahuan yang SUNGGUH-SUNGGUH TERKIRIM ke grup
   pimpinan pada jam pertama perayap baru menyala. Lima pesan berlabel "BERITA
   NEGATIF MASUK", dan empat di antaranya kegiatan positif: simulasi mitigasi
   gempa, dukungan kanwil atas penanganan gempa, senam pagi, dan sebuah grup
   band binaan yang menghibur PELARI lomba lari — yang terakhir tercatat
   sebagai 1.1 Pelarian WBP dengan urgensi Tinggi.

   Pelajarannya melampaui kedua kaidah itu: cacat yang tidak pernah terlihat
   selama sebulan langsung terlihat pada hari sumber beritanya diperluas.
   Mesin yang benar atas seratus berita sehari belum tentu benar atas seribu.

   v4.3 (7 September 2026) — mesin berhenti menilai tulisan perayap sebagai
   tulisan berita, dan berhenti melaporkan penjara negara lain.

   v4.3 lahir dari lima pemberitahuan "BERITA NEGATIF MASUK" yang lagi-lagi
   sungguh-sungguh terkirim, sehari sesudah v4.2 digelar. Semuanya kegiatan
   positif: peninjauan Dirjenpas ke rutan terdampak gempa, penyaluran bantuan
   Rp1,8 miliar untuk korban gempa NTT, pemeriksaan APAR, sosialisasi
   penanggulangan kebakaran, dan aksi berbagi camilan. Satu lagi berita
   penjara di Gaza.

   Yang penting dari v4.3 bukan daftar kata yang bertambah, melainkan SEBAB
   yang ditemukan di baliknya, dan sebab itu tidak pernah terlihat dari
   membaca judulnya:

     Setiap baris hasil perayap membawa catatan asal-usulnya sendiri di kolom
     raw_analysis — "Ditemukan penjaring-v1.0 (isu:isu-bencana)." — dan mesin
     menilainya sebagai bagian dari beritanya. Kata "Ditemukan" menyalakan
     kaidah temuan pada SELURUH 718 baris perayap, yang tugasnya justru
     mengubah juara positif menjadi negatif. Label "(isu:isu-bencana)" lalu
     menyumbang kata "bencana" pada berita yang judulnya tidak menyebutnya,
     sehingga mesin membenarkan tebakan perayap memakai bukti yang berasal
     dari tebakan itu sendiri.

     Kaidah kegiatan dan kaidah urutan kata v4.2 tidak pernah salah. Yang
     dinilai mesin memang bukan lagi beritanya.

   Pelajaran yang pantas diingat lebih lama daripada tambalannya: SETIAP kolom
   yang ikut dinilai mesin harus dipastikan berisi tulisan manusia. Kolom yang
   diisi mesin lain akan membentuk lingkaran yang tidak bisa dipatahkan kata
   kunci mana pun, dan lingkaran itu tidak meninggalkan galat.

   Empat perubahan lain di v4.3, semuanya menutup lubang yang sudah ada
   sebelum v4.2 dan hanya kebetulan tidak pernah terlihat:

     - Gerbang yurisdiksi asing. Nama negara yang berdiri langsung sesudah
       kata lembaga penahanan ("sipir Israel") menutup berita dari hitungan,
       kecuali ada jangkar Indonesia yang tegas.
     - Kaidah temuan menuntut BARANGNYA, bukan hanya kata kerjanya.
     - Kaidah kegiatan punya jalan keluar ketika tidak ada satu pun kandidat
       8.x untuk dipromosikan — jenis kegiatannya yang menentukan.
     - Frasa yang menyamar sebagai peristiwa disamarkan lebih dulu: nama unit
       ("Lapas NARKOTIKA Karang Intan") dan sarana keselamatan ("JALUR
       evakuasi").

   v4.4 (7 September 2026, sore) — lima kekeliruan yang TIDAK dilaporkan
   siapa pun, ditemukan dengan membaca satu contoh dari tiap subkategori pada
   arsip yang baru saja dinilai ulang v4.3. Lima keliru dari dua puluh enam
   yang diperiksa, dan tak satu pun pernah dikeluhkan:

     - "BERIKAN Informasi Hukum" tercatat 8.6 Ketahanan Pangan, kata kunci
       penentu "perikanan". Jembatan imbuhannya sama bentuknya dengan
       'pelari': ber+IKAN bertemu per+IKAN+an di akar 'ikan'. Kata "berikan"
       muncul di ratusan judul kehumasan, dan semuanya menyumbang nilai kepada
       subkategori perikanan.
     - "Rutan Ruteng RUSAK Diguncang Gempa" tercatat 1.2 KERUSUHAN, lewat
       kekerabatan 'rusak' dengan 'pengrusakan'.
     - "Dapatkan Makan Bergizi, Higienis dan LAYAK" tercatat 4.2 keluhan
       kelayakan hidup, sentimen Negatif — kunci [makanan, layak] tidak peduli
       bahwa layak adalah keadaan yang diinginkan.
     - "Warga Terdampak Gempa Terima Bantuan Pemasyarakatan" tercatat 4.3
       Bencana; lembaga yang membantu terbaca sebagai lembaga yang tertimpa.
     - "Dua Napiter Ikrar Setia NKRI" tercatat 5.2 PENOLAKAN program
       deradikalisasi — kunci yang persis terbalik dari nama subkategorinya.

   Cara menemukannya patut ditiru sesudah tiap penggelaran, dan lebih berharga
   daripada kelima tambalannya: baca SATU baris dari setiap subkategori. Yang
   mengeluh hanya menemukan kekeliruan yang mengganggu; yang paling mahal pada
   sistem ini justru yang diam.

   Perlu diketahui saat menggelar: Edge Function dengan hanya_belum: true
   menyaring baris yang ai_classified_at-nya masih kosong, BUKAN yang versi
   mesinnya lama. Arsip yang sudah dinilai v4.3 tidak akan ikut diperbaiki
   sampai fungsinya dipanggil sekali dengan hanya_belum: false.
*/
/*
   v4.5 — 8 September 2026. Cakupan, bukan ketepatan.

   Keempat versi sebelumnya menyetel kaidah yang SUDAH ADA supaya lebih tepat.
   Yang ini menambah kaidah untuk hal yang sama sekali belum punya kaidahnya,
   dan sumbernya bukan keluhan melainkan hitungan: 220 dari 1.805 baris arsip
   produksi (12,2%) berakhir di "Belum Dikelompokkan", lalu 120 di antaranya
   dibaca satu per satu. Yang muncul bukan dua ratus kasus berbeda, melainkan
   delapan pola yang berulang — dan yang terbesar cuma satu kalimat: unit
   mengikuti pengarahan Dirjenpas lewat Zoom, lalu memberitakannya.

   Yang bertambah: arahan pimpinan pusat, kepegawaian, arahan integritas ke
   jajaran (8.4); kesehatan pencegahan (8.7); perguruan tinggi masuk UPT dan
   pendidikan dai (8.2); hasil olahan serta upah kerja warga binaan (8.6);
   layanan kunjungan keluarga (8.3); hak integrasi (8.1); kematian warga
   binaan yang ditulis tanpa kata "tewas" (4.1); dan satuan kerja internal
   kepolisian sebagai penanda di luar lingkup.

   Yang paling menentukan di antaranya 4.1. Tiga berita tentang satu kematian
   di Lapas Karangasem tersangkut sebagai "Belum Dikelompokkan" berurgensi
   Sedang — sebab daftar lama mengenal ['meninggal','warga binaan'] tetapi
   tidak ['meninggal','napi']. Kematian orang di dalam tahanan adalah
   peristiwa yang paling menuntut kecepatan di seluruh sistem ini, dan ia
   lewat tanpa menyalakan apa pun.

   Diukur `tools/uji-cakupan.mjs` terhadap 47 judul sungguhan dari arsip:
   4,3% dikenali sebelum, 100% sesudah, tanpa satu pun salah kelompok dan
   tanpa satu pun uji perilaku yang mundur.
*/
const VERSI_MESIN = 'aturan-v4.5'

/** Ambang skor minimum sebelum sebuah berita boleh keluar dari "Lainnya". */
const AMBANG_SKOR = 3.0

/**
 * Ambang khusus kategori positif ketika teks jelas berupa unggahan humas UPT.
 * Kegiatan seremonial memang jarang memakai kata yang tegas; menuntut skor
 * setinggi berita insiden akan membuang ratusan publikasi positif setiap bulan.
 */
const AMBANG_HUMAS = 2.0

/** Panjang minimum teks yang masih layak dinilai. */
const PANJANG_MINIMUM = 8

export { bersihkanTeks, normalkan }

/* ------------------------------------------------------------ deteksi pelaku */

/**
 * Mendeteksi pelaku yang disebut dalam teks.
 * @returns {{petugas:number, wbp:number, eksternal:number, dominan:string|null}}
 */
export function deteksiAktor(konteks) {
  const skor = { petugas: 0, wbp: 0, eksternal: 0 }

  for (const [aktor, penanda] of Object.entries(PENANDA_AKTOR)) {
    for (const kata of penanda) {
      const n = hitungFrasa(konteks, kata)
      if (!n) continue
      // Frasa "oknum ..." adalah penanda paling tegas dalam bahasa pemberitaan
      // Indonesia; nyaris selalu merujuk aparat yang diduga melanggar.
      const bobot = kata.startsWith('oknum') ? 3 : kata.length > 10 ? 2 : 1
      skor[aktor] += n * bobot
    }
  }

  const urut = Object.entries(skor).sort((a, b) => b[1] - a[1])
  const dominan = urut[0][1] > 0 && urut[0][1] > urut[1][1] ? urut[0][0] : null
  return { ...skor, dominan }
}

/** Benar bila teks memuat frasa yang menempatkan petugas sebagai penindak. */
export function adaFrasaPembalik(konteks) {
  for (const f of FRASA_PEMBALIK) if (hitungFrasa(konteks, f, 1)) return true
  return false
}

/** Benar bila teks berisi bantahan atau klarifikasi atas sebuah isu. */
export function adaBantahan(konteks) {
  for (const f of FRASA_BANTAHAN) if (hitungFrasa(konteks, f, 1)) return true
  return false
}

/**
 * Benar bila teks memuat penanda kegiatan kelembagaan.
 *
 * Sengaja dipisah dari pemakaiannya, sama seperti adaBantahan(), supaya
 * pemeriksaannya bisa diuji sendiri tanpa menjalankan seluruh mesin.
 */
export function adaKegiatan(konteks) {
  for (const f of FRASA_KEGIATAN) if (hitungFrasa(konteks, f, 1)) return true
  return false
}

/**
 * Benar bila teks menyebut sesuatu yang sudah ditemukan atau disita.
 *
 * Menuntut DUA hal sekaligus: kata kerjanya dan barangnya. Kata kerjanya saja
 * tidak pernah cukup — 'ditemukan', 'diamankan', dan 'disita' terlalu lazim
 * untuk berdiri sendiri, dan selama sebulan kaidah ini menyala pada seluruh
 * baris perayap gara-gara catatan asal-usul yang berbunyi "Ditemukan
 * penjaring-v1.0 (unit)." Razia yang berhasil selalu menyebut apa yang
 * ditemukannya; tanpa barangnya, tidak ada temuan.
 */
export function adaTemuan(konteks) {
  let adaKerja = false
  for (const f of FRASA_TEMUAN) {
    if (hitungFrasa(konteks, f, 1)) { adaKerja = true; break }
  }
  if (!adaKerja) return false

  for (const b of OBJEK_TEMUAN) if (hitungFrasa(konteks, b, 1)) return true
  return false
}

/**
 * Kegiatan mana yang disebut paling awal, beserta letaknya.
 *
 * Berbeda dari letakTerawal() yang hanya mengembalikan angka: di sini yang
 * dibutuhkan juga FRASA-nya, sebab jenis kegiatan itulah yang menentukan ke
 * subkategori positif mana beritanya dibawa ketika tidak ada satu pun kandidat
 * 8.x yang bisa dipromosikan.
 */
export function kegiatanTerawal(konteks) {
  let letak = Infinity
  let frasa = null
  for (const f of FRASA_KEGIATAN) {
    const i = letakFrasa(konteks, f)
    if (i < letak) { letak = i; frasa = f }
  }
  return { letak, frasa }
}

/** Subkategori positif yang paling masuk akal untuk sebuah frasa kegiatan. */
export function subkategoriKegiatan(frasa) {
  for (const kelompok of KEGIATAN_KE_SUBKATEGORI) {
    if (kelompok.frasa.includes(frasa)) return kelompok.kode
  }
  // 8.4 adalah jawaban terakhir, sama seperti untuk unggahan humas tanpa kata
  // kunci: kegiatan kelembagaan yang jenisnya belum dirinci.
  return '8.4'
}

/**
 * Menyamarkan frasa yang menyamar sebagai peristiwa.
 *
 * Dijalankan atas teks yang SUDAH dinormalkan, sebelum konteks disiapkan,
 * sehingga seluruh mesin — kata kunci, pola tekstual, letak kata, pemicu
 * urgensi — melihat teks yang sama. Menyamarkannya di satu tempat saja akan
 * membuat dua bagian mesin membaca dua berita yang berbeda.
 */
export function samarkanFrasa(teks) {
  let hasil = teks
  for (const [pola, ganti] of SAMARAN_FRASA) hasil = hasil.replace(pola, ganti)
  return hasil
}

/** Benar bila teks berciri unggahan resmi humas unit pelaksana teknis. */
export function adaKonteksHumas(konteks) {
  let nilai = 0
  for (const p of PENANDA_KEHUMASAN) {
    if (hitungFrasa(konteks, p, 1)) nilai += 1
    if (nilai >= 2) return true
  }
  return false
}

/* ------------------------------------------------------- gerbang relevansi */

/**
 * Memutuskan apakah sebuah berita memang urusan Pemasyarakatan.
 *
 * Tiga kemungkinan jawaban:
 *   { lolos: true }                       lanjutkan penilaian
 *   { lolos: false, kode: '9.1', ... }    unit milik lembaga lain
 *   { lolos: false, kode: '9.2', ... }    bukan berita, atau bukan bahasa kita
 */
export function periksaRelevansi(konteks, penerbit = null) {
  const lembagaLain = yangMuncul(konteks, PENANDA_LEMBAGA_LAIN)
  if (lembagaLain.length) {
    return {
      lolos: false,
      kode: '9.1',
      alasan: `Teks menyebut ${lembagaLain[0]}, yaitu fasilitas penahanan milik lembaga di luar Ditjen Pemasyarakatan.`,
    }
  }

  /*
     Lembaga penahanan milik negara lain.

     Diperiksa sesudah PENANDA_LEMBAGA_LAIN dan sebelum jangkar, sebab
     jangkarnya justru akan lolos: berita penjara Israel ditulis wartawan
     Indonesia dengan kata "sipir", "napi", dan "penjara" yang semuanya ada di
     JANGKAR_PEMASYARAKATAN. "Dr Abu Safiya: Sipir Israel Terus Menganiaya dan
     Mengancam Saya agar Bungkam" karena itu lolos gerbang, menang telak di 3.3
     Kekerasan oleh Petugas dengan keyakinan 0,97, dan berangkat ke grup
     pimpinan sebagai peringatan urgensi Tinggi.

     Jangkar Indonesia diperiksa lebih dulu dan menang, sebab kerja sama
     internasional memang ada: "Kemenimipas Terima Kunjungan Delegasi
     Pemasyarakatan Malaysia" adalah berita kita, dan satu-satunya pembedanya
     dari berita penjara Malaysia adalah penyebutan lembaga kita sendiri.
  */
  if (!yangMuncul(konteks, JANGKAR_INDONESIA).length) {
    const asing = yangMuncul(konteks, PENANDA_ASING_TEGAS)
    const yurisdiksi = POLA_YURISDIKSI_ASING.some((p) => p.test(konteks.teks))
    if (asing.length || yurisdiksi) {
      return {
        lolos: false,
        kode: '9.1',
        alasan: asing.length
          ? `Teks menyebut ${asing[0]} tanpa satu pun penyebutan lembaga Pemasyarakatan Indonesia, `
            + 'sehingga yang diberitakan adalah penahanan di luar yurisdiksi Ditjen Pemasyarakatan.'
          : 'Nama negara asing berdiri langsung sesudah kata lembaga penahanan, dan tidak ada satu pun '
            + 'penyebutan Ditjenpas, Kemenimipas, kanwil, atau nama unit Pemasyarakatan Indonesia.',
      }
    }
  }

  const jangkar = yangMuncul(konteks, JANGKAR_PEMASYARAKATAN)
  if (jangkar.length) return { lolos: true, jangkar }

  // Penerbit adalah jangkar, dan sebelum ini ia tidak pernah dibaca.
  //
  // Akibatnya terlihat pada 56 publikasi yang dibuang sebagai "konten tidak
  // relevan": separuhnya adalah unggahan kanal resmi UPT sendiri yang judulnya
  // memang tidak menyebut nama unit — "Sehat Bersama, Peduli Bersama",
  // "PASTI BANGKIT", "Daily Inspection, Minggu 16 Agustus". Judul semacam itu
  // tidak perlu menyebut unitnya, sebab nama unitnya sudah tertulis di kanal
  // yang menerbitkannya. Membuangnya berarti membuang justru publikasi yang
  // paling pasti asalnya.
  if (penerbit?.resmi) {
    return { lolos: true, jangkar: [penerbit.akun], dariPenerbit: true }
  }

  return {
    lolos: false,
    kode: '9.2',
    alasan: 'Tidak ada satu pun penyebutan Lapas, Rutan, Bapas, warga binaan, atau Pemasyarakatan, '
      + 'dan penerbitnya bukan akun resmi unit Pemasyarakatan.',
  }
}

/**
 * Pemeriksaan lanjutan yang hanya dijalankan setelah mesin gagal menemukan
 * apa pun.
 *
 * Urutan ini penting dan pernah salah. Ketika pemeriksaan bahasa dijalankan di
 * depan, judul "LAPAS SEMARANG GAGALKAN PENYELUNDUPAN NARKOBA LEWAT LEMPARAN
 * TEMBOK" ikut terbuang — kata penghubungnya kebetulan tidak ada di daftar,
 * padahal isinya justru laporan pengamanan yang berhasil. Sekarang berita yang
 * kata kuncinya berbicara tidak pernah lagi ditanya soal bahasa.
 */
/**
 * Nama unit yang lengkap dengan penanda kelasnya.
 *
 * "Rutan Kelas 1 Jakarta Pusat" dan "Lapas Perempuan Bandung" adalah nama
 * lembaga Indonesia, dan tidak ada bahasa lain yang kebetulan menyusun kata
 * dalam urutan itu. Satu kecocokan sudah cukup membuktikan teksnya berbahasa
 * Indonesia dan berbicara tentang sebuah unit — tanpa perlu menunggu ada kata
 * penghubung yang kebetulan ada di dalam daftar.
 */
const POLA_NAMA_UNIT =
  /\b(lapas|rutan|bapas|lpka|lpp)\s+(kelas|perempuan|narkotika|pemuda|terbuka|khusus|anak)\b/

export function periksaKebisingan(konteks) {
  // Kata "lapas" dan "bapas" muncul juga pada unggahan berbahasa Hindi dan
  // Spanyol. Bila hanya itu jangkarnya, tidak ada satu pun kata penghubung
  // bahasa Indonesia, dan mesin tidak menemukan kata kunci apa pun, teksnya
  // hampir pasti bukan berita Indonesia.
  if (yangMuncul(konteks, JANGKAR_KUAT).length) return null
  if (POLA_NAMA_UNIT.test(konteks.teks)) return null
  if (yangMuncul(konteks, KATA_FUNGSI_INDONESIA).length) return null

  return {
    kode: '9.2',
    alasan:
      'Kata "lapas" atau "bapas" muncul tanpa satu pun kata bahasa Indonesia lain dan tanpa kata kunci isu apa pun.',
  }
}

/* --------------------------------------------------------------- penilaian */

/**
 * Pengali kecocokan pelaku. Subkategori yang menuntut pelaku tertentu
 * dinaikkan ketika pelakunya memang disebut, dan diturunkan ketika teks justru
 * menyebut pelaku yang berlawanan.
 */
function pengaliAktor(sub, aktor) {
  if (!sub.aktor || sub.aktor === 'campuran' || sub.aktor === 'sistem') return 1

  if (sub.aktor === 'petugas') {
    if (aktor.petugas > 0 && aktor.petugas >= aktor.wbp) return 1.6
    if (aktor.petugas > 0) return 1.15
    // Pelaku tidak disebut sama sekali bukan alasan membuang kandidat; yang
    // layak dihukum berat hanyalah teks yang justru menunjuk pelaku lain.
    return aktor.wbp > 0 ? 0.45 : 0.85
  }

  if (sub.aktor === 'wbp') {
    if (aktor.wbp > 0 && aktor.wbp >= aktor.petugas) return 1.4
    if (aktor.wbp > 0) return 1.1
    return aktor.petugas > 0 ? 0.65 : 0.9
  }

  if (sub.aktor === 'eksternal') {
    if (aktor.eksternal > 0) return 1.5
    return 0.9
  }

  return 1
}

/**
 * Di kata keberapa peristiwa milik sebuah subkategori pertama kali disebut.
 *
 * Frasa MAJEMUK ditangani berbeda dari frasa tunggal, dan perbedaannya
 * menentukan. Kunci ['kabur', 'lapas'] baru berarti "pelarian" ketika KEDUA
 * katanya sudah muncul; kedudukannya karena itu adalah kata terakhir yang
 * melengkapinya, bukan kata pertama yang kebetulan lebih dulu ada.
 *
 * Meratakan majemuk menjadi anggota-anggotanya — yang dicoba lebih dulu pada
 * 6 September 2026 — memberi jawaban yang salah dengan cara yang halus: kata
 * "lapas" pada ['kabur','lapas'] berdiri di kata ke-0 pada judul "Lapas
 * Kuningan Bantah Kabar Napi Kabur", sehingga peristiwanya seolah disebut
 * SEBELUM bantahannya, dan bantahan yang jelas-jelas mendahului tetap kalah.
 * Kata umum seperti "lapas", "napi", dan "rutan" muncul di hampir setiap
 * judul; kedudukannya tidak menerangkan apa pun.
 *
 * Frasa berbobot negatif ditinggalkan dengan sengaja: ia justru penanda bahwa
 * subkategori ini BUKAN yang dimaksud.
 */
/**
 * Kedudukan sebuah kecocokan regex, dihitung dalam nomor kata.
 *
 * Diperlukan karena pola tekstual bekerja atas aksara sedangkan seluruh kaidah
 * urutan bekerja atas kata. Teks sudah dinormalkan menjadi satu spasi tunggal
 * antar kata, jadi menghitung spasi sudah cukup dan tidak perlu menokenkan
 * ulang.
 */
function letakAksara(konteks, indeksAksara) {
  if (!(indeksAksara >= 0)) return Infinity
  let kata = 0
  for (let i = 0; i < indeksAksara; i += 1) if (konteks.teks[i] === ' ') kata += 1
  return kata
}

function letakPeristiwa(konteks, sub) {
  let awal = Infinity

  /*
     Pola tekstual ikut dihitung letaknya, dan itu bukan kelengkapan belaka.

     Sampai 7 September 2026 letak peristiwa hanya dibaca dari kata kuncinya.
     Akibatnya peristiwa yang HANYA tertangkap pola menempati letak Infinity —
     dan Infinity kalah oleh apa pun, sehingga kata kegiatan mana pun yang
     kebetulan ada di dalam teks langsung memenangkan kaidah kegiatan.

     Terukur pada "Kebakaran Hebat Melanda Blok Hunian Lapas Kelas IIA Kupang,
     APAR Tak Berfungsi dan Warga Binaan Dievakuasi": kata "kebakaran" berdiri
     di kata ke-0 tetapi hanya dikenali pola /(kebakaran)[^.]{0,35}(lapas)/,
     sehingga letak peristiwanya terbaca dari 'dievakuasi' di kata ke-14. Kata
     'apar' di kata ke-9 lebih dulu, dan kebakaran sungguhan dengan alat
     pemadam yang tidak berfungsi tercatat sebagai pemeriksaan APAR rutin,
     sentimen POSITIF.

     Arah kekeliruannya sunyi — persis sama dengan kaidah temuan, dan sama
     mahalnya.
  */
  for (const [pola, bobot] of sub.pola) {
    if (!bobot || bobot < 0) continue
    const cocok = pola.exec(konteks.teks)
    if (!cocok) continue
    const letak = letakAksara(konteks, cocok.index)
    if (letak < awal) awal = letak
  }

  for (const [kata, bobot] of sub.kunci) {
    if (!bobot || bobot < 0) continue

    let letak
    if (Array.isArray(kata)) {
      letak = 0
      for (const bagian of kata) {
        const l = letakFrasa(konteks, bagian)
        if (l > letak) letak = l
      }
    } else {
      letak = letakFrasa(konteks, kata)
    }

    if (letak < awal) awal = letak
  }

  return awal
}

function labelKunci(kunci) {
  return Array.isArray(kunci) ? kunci.join(' + ') : kunci
}

/** Menilai satu butir kunci: frasa tunggal, atau larik istilah yang semuanya harus ada. */
function nilaiKunci(konteks, kunci) {
  if (Array.isArray(kunci)) {
    let terkecil = Infinity
    for (const istilah of kunci) {
      const n = hitungFrasa(konteks, istilah)
      if (!n) return 0
      terkecil = Math.min(terkecil, n)
    }
    return terkecil === Infinity ? 0 : terkecil
  }
  return hitungFrasa(konteks, kunci)
}

/**
 * Memberi skor pada seluruh subkategori.
 * @returns {Array<{sub:object, skor:number, cocok:string[]}>} urut menurun
 */
export function skorSubkategori(konteks, aktor, konteksHumas) {
  const hasil = []

  for (const sub of SEMUA_SUBKATEGORI) {
    let skor = 0
    const cocok = []

    let adaPositif = false
    for (const [kata, bobot] of sub.kunci) {
      if (!bobot) continue
      const n = nilaiKunci(konteks, kata)
      if (!n) continue
      // Kemunculan kedua dan ketiga bernilai lebih kecil, supaya satu kata yang
      // diulang-ulang tidak mengalahkan tiga kata kunci berbeda.
      skor += bobot * (1 + (n - 1) * 0.35)
      // Frasa berbobot negatif membatalkan, jadi ia bukan "kata kunci penentu"
      // dan tidak layak ditampilkan sebagai alasan.
      if (bobot > 0) { cocok.push(labelKunci(kata)); adaPositif = true }
    }

    // Pola tekstual dinilai tanpa menunggu ada kata kunci yang cocok lebih dulu.
    //
    // Sebelum ini seluruh blok pola berada di balik `if (!adaPositif) continue`,
    // sehingga pola hanya pernah dijalankan pada berita yang sudah tertangkap
    // kata kunci — yaitu justru berita yang paling tidak membutuhkannya. Pola
    // ditulis untuk menangkap yang tidak bisa ditangkap kata kunci, dan
    // menggantungkannya pada kata kunci membuat seluruhnya tidak berguna.
    //
    // Akibatnya nyata: "Kapasitas 71 Orang, Rutan Negara Kini Dihuni 213 Warga
    // Binaan" memiliki polanya sendiri di 4.2, cocok sempurna, dan tetap jatuh
    // ke "Lainnya" dengan skor nol — karena tidak ada satu pun kata kunci
    // overkapasitas yang muncul secara harfiah di judul itu.
    for (const [pola, bobot] of sub.pola) {
      if (!pola.test(konteks.teks)) continue
      skor += bobot
      cocok.push('pola tekstual')
      if (bobot > 0) adaPositif = true
    }

    if (!adaPositif) continue
    if (skor <= 0) continue

    skor *= pengaliAktor(sub, aktor)

    // Unggahan humas yang jelas memberi sedikit dorongan pada kategori positif.
    // Nilainya kecil dengan sengaja: yang menentukan tetap kata kuncinya.
    if (konteksHumas && sub.sifat === 'positif') skor *= 1.2

    hasil.push({ sub, skor: Number(skor.toFixed(3)), cocok })
  }

  return hasil.sort((a, b) => b.skor - a.skor)
}

/* ------------------------------------------------------- sentimen & urgensi */

const PENANDA_POSITIF = [
  'berhasil', 'prestasi', 'penghargaan', 'inovasi', 'apresiasi', 'meraih',
  'sukses', 'lancar', 'kondusif', 'meningkat', 'terbaik', 'juara',
  'digagalkan', 'menggagalkan', 'terkendali', 'nihil', 'meriah', 'khidmat',
  'semangat', 'kebersamaan', 'gratis', 'peduli', 'sinergi', 'komitmen',
  'selamat', 'bangga', 'harmonis', 'produktif', 'mandiri',
]

const PENANDA_NEGATIF = [
  'kabur', 'tewas', 'meninggal', 'kerusuhan', 'kebakaran', 'pungli',
  'kekerasan', 'pelanggaran', 'korupsi', 'pemerasan', 'suap', 'dianiaya',
  'diselundupkan', 'ilegal', 'dikeluhkan', 'protes', 'menuntut', 'disorot',
  'lemah', 'lalai', 'kelalaian', 'buron', 'overkapasitas', 'penyiksaan',
  'penembakan', 'pembiaran', 'memprihatinkan', 'dicopot', 'tersangka',
]

/**
 * Menurunkan sentimen. Sifat kategori menjadi dasar, lalu disesuaikan oleh
 * penanda eksplisit dalam teks.
 */
export function tentukanSentimen(konteks, sub, adaPembalik) {
  const positif = yangMuncul(konteks, PENANDA_POSITIF).length
  const negatif = yangMuncul(konteks, PENANDA_NEGATIF).length

  if (!sub) {
    if (negatif > positif) return 'Negatif'
    if (positif > negatif) return 'Positif'
    return 'Netral'
  }

  if (sub.sifat === 'positif') return negatif > positif + 1 ? 'Campuran' : 'Positif'

  // Ancaman eksternal yang digagalkan petugas bukan sentimen negatif murni:
  // kejadiannya buruk, penanganannya baik. Berlaku juga untuk penyelundupan
  // yang berhasil dicegah, yang justru menunjukkan pengamanan bekerja.
  if (adaPembalik && (sub.kategoriKode === '6' || sub.kode === '8.5')) return 'Campuran'

  // Bantahan dan klarifikasi adalah tindakan pengelolaan isu, bukan insiden.
  if (sub.kode === '7.1') return negatif > positif + 1 ? 'Negatif' : 'Netral'

  if (sub.sifat === 'negatif') return positif > negatif + 2 ? 'Campuran' : 'Negatif'
  return 'Netral'
}

/**
 * Menurunkan urgensi. Nilai dasar berasal dari subkategori, lalu dinaikkan
 * bila ada pemicu kritis, dan diturunkan bila kejadiannya sudah digagalkan.
 */
export function tentukanUrgensi(konteks, sub, adaPembalik, risikoCrawler) {
  let urgensi = sub ? sub.urgensi : 'Rendah'

  // Panduan Ditpamintel hanya mengenal tiga tingkat: Tinggi, Sedang, Rendah.
  // Basis data memiliki satu tingkat lagi di atasnya, dan tingkat itu sengaja
  // dijaga tetap langka. "Kritis" berarti kejadian sedang berlangsung dan
  // menyangkut banyak nyawa sekaligus — kerusuhan massal, kebakaran dengan
  // evakuasi, penyanderaan, pelarian berkelompok, penyerangan dari luar.
  // Kalau nilai ini diobral, ia berhenti berarti apa-apa bagi pimpinan.
  const SUB_BOLEH_KRITIS = new Set(['1.1', '1.2', '3.3', '4.1', '4.3', '5.1', '6.2'])
  const pemicu = yangMuncul(konteks, PEMICU_KRITIS)

  if (sub && SUB_BOLEH_KRITIS.has(sub.kode)) {
    const massal =
      /(massal|berjamaah|serentak|puluhan|ratusan|napiter|terorisme|penyanderaan|sandera|evakuasi|dievakuasi)/.test(
        konteks.teks,
      ) ||
      /\b([3-9]|\d{2,})\s*(orang|napi|narapidana|tahanan|warga binaan)\b[^.]{0,40}\bkabur\b/.test(konteks.teks)

    if (massal && pemicu.length >= 1) urgensi = 'Kritis'
    else if (pemicu.length >= 3) urgensi = 'Kritis'
  }

  if (adaPembalik && PERINGKAT_URGENSI[urgensi] > 2) {
    // Sudah tertangani. Tetap dilaporkan, tetapi bukan lagi respons segera.
    urgensi = 'Sedang'
  }

  // Penilaian crawler dipakai sebagai lantai, bukan sebagai penentu. Kalau
  // mesin sendiri menilai lebih tinggi, penilaian mesin yang dipakai.
  const lantai = { RENDAH: 'Rendah', SEDANG: 'Sedang', TINGGI: 'Tinggi', KRITIS: 'Kritis' }[
    String(risikoCrawler ?? '').trim().toUpperCase()
  ]
  if (lantai && PERINGKAT_URGENSI[lantai] > PERINGKAT_URGENSI[urgensi]) {
    // Hanya untuk berita yang mesin sendiri tidak yakin. Kalau mesin sudah
    // menemukan kategori kuat, penilaian crawler yang generik tidak menang.
    if (!sub || sub.kategoriKode === '0') urgensi = lantai
  }

  return urgensi
}

/** Tingkat perhatian untuk penanda peta dan antrean telaah. */
export function tentukanPerhatian(urgensi, sentimen) {
  if (PERINGKAT_URGENSI[urgensi] >= 3) return 'Tinggi'
  if (urgensi === 'Sedang' || sentimen === 'Negatif') return 'Sedang'
  return 'Rendah'
}

/* ------------------------------------------------------------- pintu utama */

/**
 * Mengklasifikasi satu berita.
 *
 * @param {object} berita
 * @param {string} [berita.judul]
 * @param {string} [berita.ringkasan]
 * @param {string} [berita.caption_manual]
 * @param {string} [berita.raw_analysis]
 * @param {string} [berita.media]
 * @param {string} [berita.urgensi] penilaian risiko dari crawler
 * @returns {object} hasil klasifikasi lengkap dengan jejak alasannya
 */
export function klasifikasikan(berita = {}) {
  const judul = bersihkanTeks(berita.judul)
  const ringkasan = bersihkanTeks(berita.ringkasan)
  const tambahan = bersihkanTeks(berita.caption_manual || berita.raw_analysis)

  /*
     Judul diberi bobot ganda karena di sanalah inti peristiwa berada, sedangkan
     ringkasan hasil crawl sering berisi kalimat generik yang sama untuk semua.

     Tiap bagian dinormalkan SENDIRI, lalu disambung dengan titik yang sengaja
     dipertahankan. Sebelumnya seluruhnya disambung dulu baru dinormalkan, dan
     normalkan() membuang titiknya — sehingga penjaga [^.]{0,35} di dalam pola
     taksonomi tidak punya apa pun untuk berhenti, dan polanya bisa menyeberang
     dari akhir salinan judul ke awal salinan berikutnya.

     Terukur: "Dirjenpas Tinjau Kondisi Rutan Ruteng yang Terdampak Gempa
     Flores" mencocoki pola 4.3 /(gempa)[^.]{0,35}(rutan)/ dengan cara
     membaca "GEMPA Flores . Dirjenpas Tinjau Kondisi RUTAN Ruteng" — yaitu
     gempa dari salinan pertama dan rutan dari salinan kedua, sebuah kalimat
     yang tidak pernah ditulis siapa pun.
  */
  const bagian = [judul, judul, ringkasan, tambahan]
    .filter(Boolean)
    .map((t) => normalkan(t))
    .filter(Boolean)
  const teksNormal = samarkanFrasa(bagian.join(' . '))

  if (!teksNormal || teksNormal.length < PANJANG_MINIMUM) {
    return hasilKosong('Teks terlalu pendek untuk dinilai')
  }

  const konteks = siapkanKonteks(teksNormal)

  // Penerbit dikenali lebih dulu, sebab gerbang relevansi membutuhkannya.
  const penerbit = kenaliPenerbit(berita, teksNormal)

  const relevansi = periksaRelevansi(konteks, penerbit)
  if (!relevansi.lolos) return hasilLuarLingkup(relevansi.kode, relevansi.alasan)

  const aktor = deteksiAktor(konteks)
  const pembalik = adaFrasaPembalik(konteks)
  const bantahan = adaBantahan(konteks)
  const konteksHumas = adaKonteksHumas(konteks)

  let peringkat = skorSubkategori(konteks, aktor, konteksHumas || penerbit.resmi)

  // Bantahan mengalahkan peristiwa yang dibantahnya. Berita "Bukan kabur, Rutan
  // Muntok sebut yang bersangkutan menjalani asimilasi" tidak boleh menambah
  // satu angka pun pada hitungan pelarian.
  //
  // Skor yang digeser ikut dicatat. Tanpa itu, penggeseran ini justru membuang
  // beritanya: pelarian menang dengan 4,23 dan lolos ambang, bantahan naik ke
  // puncak dengan 2,43 dan tidak lolos, lalu keduanya sama-sama hilang ke
  // "Lainnya". Padahal yang berubah hanyalah nama peristiwanya — bahwa ini
  // berita bermuatan tetap sudah terbukti oleh skor yang digeser tadi.
  let skorTergeser = 0
  if (bantahan) {
    const hoaks = peringkat.find((p) => p.sub.kode === '7.1')
    if (hoaks && peringkat[0] && peringkat[0].sub.kode !== '7.1') {
      const juaraLain = peringkat[0].skor

      /*
         Yang menentukan adalah URUTAN, bukan perbandingan skor.

         Sampai 6 September 2026 syaratnya hanya "skor bantahan minimal separuh
         skor juara". Syarat itu bekerja terbalik dari maksudnya, dan sebabnya
         ada pada sifat bantahan itu sendiri: untuk membantah sebuah peristiwa,
         teksnya HARUS menyebut peristiwa itu. Semakin tegas bantahannya,
         semakin lengkap kosakata peristiwa yang ia muat, semakin tinggi skor
         peristiwanya, dan semakin kecil peluang bantahannya menang. Syaratnya
         justru paling sering gagal pada bantahan yang paling jelas.

         Terukur: "Lapas Kuningan Bantah Kabar Napi Kabur, Yang Bersangkutan
         Sedang Berobat" memberi 17,92 pada 1.1 Pelarian dan 3,65 pada 7.1.
         Separuh dari 17,92 adalah 8,96, jadi bantahannya kalah — dan sebuah
         berita klarifikasi tercatat sebagai satu peristiwa pelarian, persis
         angka yang paling sering ditanyakan pimpinan.

         Yang dipakai sekarang: letak. Dalam kalimat berita berbahasa
         Indonesia, kata kerja bantahan MENGUASAI apa yang ditulis sesudahnya.

           "Lapas Bantah Kabar Napi Kabur"   bantahan (2) < peristiwa (4) -> klarifikasi
           "Napi Kabur, Lapas Membantah"     peristiwa (0) < bantahan (3) -> peristiwa

         Kalimat kedua itulah yang harus tetap tercatat sebagai pelarian: yang
         dibantah di sana bukan kejadiannya, melainkan sesuatu tentangnya.

         Ujian perbandingan skor yang lama DIBUANG seluruhnya, bukan disimpan
         sebagai jalan kedua. Alasannya bukan kerapian: ia salah, dan ia salah
         pada kasus yang paling merugikan. "Kerusuhan Pecah di Lapas Ambon,
         Petugas Membantah Ada Korban Jiwa" memberi 6,08 pada 1.2 dan 3,65 pada
         7.1; separuh dari 6,08 adalah 3,04, jadi ujian lama meloloskannya dan
         sebuah kerusuhan yang benar-benar terjadi tercatat sebagai hoaks.

         Yang dibantah di kalimat itu memang ada — korban jiwanya — dan bukan
         kerusuhannya. Ujian urutan membacanya dengan benar tanpa tambahan
         aturan apa pun.

         Ujian urutan juga sudah mencakup satu-satunya perkara yang dulu
         menjadi alasan ujian rasio ada, yaitu bantahan yang tidak menyebut
         peristiwanya sama sekali: pada teks semacam itu letak peristiwanya
         Infinity, dan apa pun lebih kecil daripada Infinity.
      */
      const letakBantahan = letakTerawal(konteks, FRASA_BANTAHAN)
      const letakKejadian = letakPeristiwa(konteks, peringkat[0].sub)

      if (letakBantahan < letakKejadian) {
        skorTergeser = juaraLain
        peringkat = [hoaks, ...peringkat.filter((p) => p !== hoaks)]
      }
    }
  }

  /*
     Kegiatan tentang sebuah isu mengalahkan isunya, dengan syarat yang sama
     dengan bantahan: LETAK, bukan skor.

     Bentuk kekeliruannya identik. Untuk membicarakan mitigasi gempa, teksnya
     harus menyebut gempa; makin lengkap uraian kegiatannya, makin tinggi skor
     peristiwa yang tidak pernah terjadi itu. Terukur 6 September 2026, dari
     pemberitahuan yang sungguh-sungguh terkirim ke grup pimpinan: "Upaya
     Peningkatan Kesiapsiagaan Mitigasi Bencana Gempa Bumi bagi Warga Binaan di
     Lapas Kelas IIA Cilegon" tercatat 4.3 Bencana, Negatif, urgensi Tinggi.

     Yang dipromosikan adalah kandidat 8.x TERBAIK yang sudah ada di peringkat,
     bukan satu kode tetap. Mesin sudah menimbang kegiatan apa itu — senam,
     kerja sama, layanan kesehatan — dan menimpanya dengan tebakan tetap akan
     membuang penilaian yang lebih baik daripada tebakan itu.

     Dua penjagaan, dan keduanya perlu:

       1. Hanya berlaku bila juaranya NEGATIF. Kegiatan yang mengalahkan
          kegiatan lain tidak menerangkan apa pun.
       2. Kejadian yang letaknya di depan tetap menang. "Gempa Guncang Lapas,
          Napi Dievakuasi, Kanwil Kirim Bantuan" adalah kabar bencana yang
          diikuti kegiatan — bukan kegiatan yang kebetulan menyebut bencana.
  */
  if (peringkat[0] && peringkat[0].sub.sifat !== 'positif') {
    const kegiatan = kegiatanTerawal(konteks)
    const letakKejadian = letakPeristiwa(konteks, peringkat[0].sub)

    if (kegiatan.letak < letakKejadian) {
      let positif = peringkat.find((p) => p.sub.kategoriKode === '8')

      /*
         Kalau tidak ada satu pun kandidat 8.x, JENIS kegiatannya yang menjadi
         jawaban — bukan diamnya kaidah ini.

         Sampai v4.2 kaidah berhenti di sini tanpa suara, dan diamnya itu yang
         paling mahal: berita yang paling jelas kegiatannya justru yang paling
         mungkin tidak punya kandidat positif, sebab kosakata kegiatannya habis
         terpakai menerangkan musibah yang ditanganinya. "Kemenimipas Salurkan
         Bantuan Rp1,8 Miliar untuk Korban Gempa NTT" tidak punya satu pun kata
         bernilai di kategori 8 mana pun pada waktu itu, sehingga satu-satunya
         kandidat yang ada adalah 4.3 Bencana — dan bantuan kemanusiaan
         terbesar tahun itu dilaporkan kepada pimpinan sebagai musibah.

         Skornya diwarisi dari juara yang digeser, sama seperti skorTergeser di
         bawah: pertanyaan "apakah teks ini bermuatan" sudah dijawab oleh
         kandidat yang digeser, dan menuntut penggantinya menjawabnya lagi
         sendiri akan membuang beritanya ke "Lainnya".
      */
      if (!positif) {
        const kode = subkategoriKegiatan(kegiatan.frasa)
        const sub = SEMUA_SUBKATEGORI.find((s) => s.kode === kode)
        if (sub) positif = { sub, skor: peringkat[0].skor, cocok: [kegiatan.frasa] }
      }

      if (positif) {
        skorTergeser = Math.max(skorTergeser, peringkat[0].skor)
        peringkat = [positif, ...peringkat.filter((p) => p !== positif)]
      }
    }
  }

  /*
     Kegiatan pengamanan yang MENEMUKAN sesuatu bukan kegiatan rutin.

     Ini kebalikan arah dari kaidah di atas, dan justru yang paling penting.
     Kaidah kegiatan memindahkan berita dari negatif ke positif — kekeliruannya
     berisik dan cepat ketahuan. Kaidah ini memindahkannya kembali ke negatif,
     dan kekeliruan yang diperbaikinya SUNYI: temuan sungguhan yang tercatat
     sebagai catatan kegiatan, yakni berita negatif yang hilang dari hitungan
     tanpa seorang pun tahu ia pernah ada.

     Tiga baris nyata di arsip 6 September 2026, semuanya 8.5 dan POSITIF:

       "Geledah Kamar Hunian, Temukan Barang Terlarang di Lapas Probolinggo"
       "Sidak Malam Lapas Ciamis: ... Puluhan Benda Berbahaya Disita"
       "Sajam dan Sejumlah Barang Terlarang Ditemukan Saat Razia Lapas"

     Senjata tajam di dalam blok hunian adalah temuan intelijen. Bahwa petugas
     yang menemukannya memang patut dicatat, dan itu sudah dikerjakan
     FRASA_PEMBALIK yang menurunkan urgensinya — tetapi peristiwanya tetap
     masuknya barang terlarang.

     TIDAK dipakai urutan kata di sini, berbeda dengan dua kaidah sebelumnya.
     Sebabnya letak temuan tidak menerangkan apa pun: "Razia Digelar, Sajam
     Ditemukan" dan "Sajam Ditemukan Saat Razia" adalah berita yang sama.
  */
  if (peringkat[0] && peringkat[0].sub.kategoriKode === '8' && adaTemuan(konteks)) {
    const temuan = peringkat.find((p) => p.sub.sifat !== 'positif')
    if (temuan) {
      peringkat = [temuan, ...peringkat.filter((p) => p !== temuan)]
    }
  }

  const juara = peringkat[0]

  // Ambang turun ketika penerbitnya sudah pasti institusi, bukan hanya ketika
  // teksnya berciri kehumasan. Keduanya tidak sama kuat: ciri teks adalah
  // dugaan, sedangkan penerbit adalah keterangan.
  const humasKuat = konteksHumas || penerbit.resmi
  let ambang = juara && juara.sub.sifat === 'positif' && humasKuat ? AMBANG_HUMAS : AMBANG_SKOR

  // Bantahan yang menggeser kandidat yang sudah lolos ambang mewarisi kelolosan
  // itu. Yang diperiksa ambang adalah "apakah teks ini bermuatan", dan
  // pertanyaan itu sudah dijawab oleh kandidat yang digeser.
  /* Berlaku untuk kedua penggeseran — bantahan maupun kegiatan. Keduanya
     menggantikan kandidat yang sudah membuktikan teksnya bermuatan; menuntut
     penggantinya membuktikannya lagi sendiri akan membuang beritanya ke
     "Lainnya", yaitu akibat yang justru dihindari kedua aturan itu. */
  if (skorTergeser >= AMBANG_SKOR
    && (juara?.sub.kode === '7.1' || juara?.sub.kategoriKode === '8')) ambang = 0

  if (!juara || juara.skor < ambang) {
    // Pemeriksaan kebisingan hanya berlaku untuk publikasi yang penerbitnya
    // tidak diketahui. Menanyakan "apakah ini benar berbahasa Indonesia" pada
    // unggahan kanal Lapas Wonogiri yang berjudul "PASTI BANGKIT" adalah
    // pertanyaan yang jawabannya sudah diketahui sebelum ditanyakan — dan
    // menjawabnya dengan menebak dari dua patah kata judul selalu salah.
    if (!penerbit.resmi) {
      const bising = periksaKebisingan(konteks)
      if (bising) return hasilLuarLingkup(bising.kode, bising.alasan)
    }

    // Unggahan yang diterbitkan akun resmi sebuah unit sudah pasti publikasi
    // kehumasan unit itu, dan tidak perlu menunggu kata kunci untuk diakui
    // demikian. Yang belum pasti hanyalah kegiatan apa yang diunggah — dan
    // untuk itu 8.4 adalah jawaban paling jujur: kegiatan kelembagaan, jenis
    // belum dirinci.
    //
    // Keyakinannya sengaja ditahan di 0,55: cukup untuk menyingkirkan publikasi
    // ini dari antrean "tidak dikenali", tetapi tetap di bawah ambang telaah
    // 0,75 sehingga analis tetap melihatnya sebelum angkanya dipakai.
    if (penerbit.resmi) {
      const sub = SEMUA_SUBKATEGORI.find((s) => s.kode === '8.4')
      return {
        kategori: sub.kategoriNama,
        kategori_kode: '8',
        subkategori: sub.nama,
        subkategori_kode: '8.4',
        sentimen: 'Positif',
        urgensi: 'Rendah',
        tingkat_perhatian: 'Rendah',
        kata_kunci: [],
        aktor_terdeteksi: aktor.dominan,
        ada_frasa_pembalik: pembalik,
        ada_bantahan: bantahan,
        konteks_humas: true,
        penerbit: penerbit.jenis,
        dalam_lingkup: true,
        ai_confidence: 0.55,
        ai_provider: VERSI_MESIN,
        skor_tertinggi: juara?.skor ?? 0,
        pesaing: peringkat.slice(0, 3).map(ringkasPesaing),
        alasan: `${penerbit.alasan} Tidak ada kata kunci isu yang menonjol, `
          + 'sehingga dicatat sebagai publikasi kehumasan yang jenis kegiatannya belum dirinci.',
      }
    }

    const sentimen = tentukanSentimen(konteks, null, pembalik)
    const urgensi = tentukanUrgensi(konteks, null, pembalik, berita.urgensi)
    return {
      ...hasilKosong('Tidak ada subkategori yang melewati ambang skor'),
      sentimen,
      urgensi,
      tingkat_perhatian: tentukanPerhatian(urgensi, sentimen),
      penerbit: penerbit.jenis,
      skor_tertinggi: juara?.skor ?? 0,
      pesaing: peringkat.slice(0, 3).map(ringkasPesaing),
    }
  }

  const runnerUp = peringkat[1]
  const sub = juara.sub

  // Keyakinan: seberapa jauh juara meninggalkan pesaing terdekatnya, digabung
  // dengan seberapa kuat skor absolutnya. Dua-duanya harus baik.
  const selisih = runnerUp ? (juara.skor - runnerUp.skor) / juara.skor : 1
  const kekuatan = Math.min(1, juara.skor / 12)
  const keyakinan = Number(Math.max(0.3, Math.min(0.97, 0.35 * kekuatan + 0.45 * selisih + 0.2)).toFixed(3))

  const sentimen = tentukanSentimen(konteks, sub, pembalik)
  const urgensi = tentukanUrgensi(konteks, sub, pembalik, berita.urgensi)

  return {
    kategori: sub.kategoriNama,
    kategori_kode: sub.kategoriKode,
    subkategori: sub.nama,
    subkategori_kode: sub.kode,
    sentimen,
    urgensi,
    tingkat_perhatian: tentukanPerhatian(urgensi, sentimen),
    kata_kunci: [...new Set(juara.cocok)].slice(0, 8),
    aktor_terdeteksi: aktor.dominan,
    ada_frasa_pembalik: pembalik,
    ada_bantahan: bantahan,
    konteks_humas: konteksHumas,
    penerbit: penerbit.jenis,
    dalam_lingkup: true,
    ai_confidence: keyakinan,
    ai_provider: VERSI_MESIN,
    skor_tertinggi: juara.skor,
    pesaing: peringkat.slice(1, 4).map(ringkasPesaing),
    alasan: susunAlasan(sub, juara.cocok, aktor, pembalik, bantahan),
  }
}

function ringkasPesaing(p) {
  return { kode: p.sub.kode, nama: p.sub.nama, skor: p.skor }
}

function hasilKosong(alasan) {
  return {
    kategori: KATEGORI_LAINNYA.nama,
    kategori_kode: '0',
    subkategori: 'Belum Dikelompokkan',
    subkategori_kode: '0.1',
    sentimen: 'Netral',
    urgensi: 'Rendah',
    tingkat_perhatian: 'Rendah',
    kata_kunci: [],
    aktor_terdeteksi: null,
    ada_frasa_pembalik: false,
    ada_bantahan: false,
    konteks_humas: false,
    dalam_lingkup: true,
    ai_confidence: 0.2,
    ai_provider: VERSI_MESIN,
    skor_tertinggi: 0,
    pesaing: [],
    alasan,
  }
}

function hasilLuarLingkup(kode, alasan) {
  const sub = KATEGORI_LUAR_LINGKUP.subkategori.find((s) => s.kode === kode)
  return {
    kategori: KATEGORI_LUAR_LINGKUP.nama,
    kategori_kode: '9',
    subkategori: sub ? sub.nama : 'Konten Tidak Relevan',
    subkategori_kode: kode,
    sentimen: 'Netral',
    urgensi: 'Rendah',
    tingkat_perhatian: 'Rendah',
    kata_kunci: [],
    aktor_terdeteksi: null,
    ada_frasa_pembalik: false,
    ada_bantahan: false,
    konteks_humas: false,
    dalam_lingkup: false,
    ai_confidence: 0.9,
    ai_provider: VERSI_MESIN,
    skor_tertinggi: 0,
    pesaing: [],
    alasan,
  }
}

function susunAlasan(sub, cocok, aktor, pembalik, bantahan) {
  const bagian = [`Kata kunci penentu: ${cocok.slice(0, 4).join(', ')}`]
  if (aktor.dominan) {
    const label = { petugas: 'petugas', wbp: 'warga binaan', eksternal: 'pihak luar' }[aktor.dominan]
    bagian.push(`pelaku yang disebut mengarah ke ${label}`)
  }
  if (pembalik) bagian.push('terdapat frasa yang menunjukkan kejadian berhasil dicegah atau digagalkan')
  if (bantahan) bagian.push('teks berisi bantahan atau klarifikasi, bukan laporan peristiwa')
  bagian.push(`sehingga masuk ${sub.kode} ${sub.nama}`)
  return bagian.join('; ') + '.'
}

/** Versi massal untuk penyeliaan ulang seluruh arsip. */
export function klasifikasikanBanyak(daftar) {
  return daftar.map((b) => ({ id: b.id, ...klasifikasikan(b) }))
}

export const META_MESIN = {
  versi: VERSI_MESIN,
  ambang: AMBANG_SKOR,
  ambangHumas: AMBANG_HUMAS,
  jumlahSubkategori: SEMUA_SUBKATEGORI.length,
}

export { KATEGORI }
