/**
 * Katalog penjelasan fitur — apa isi tiap layar, dan untuk apa ia ada.
 *
 * ## Kenapa berkas ini terpisah dari halamannya
 *
 * Isinya bukan tampilan, melainkan keterangan yang harus bisa diperiksa. Tiap
 * butir menu di lib/peran.js wajib punya pasangannya di sini, dan sebaliknya
 * tiap butir di sini wajib menunjuk halaman yang benar-benar ada. Keduanya
 * dijaga tools/uji-panduan.mjs, yang gagal ketika sebuah fitur baru ditambahkan
 * ke menu tanpa penjelasannya.
 *
 * Penjagaan itu bukan kerewelan. Panduan yang tidak lengkap tidak terlihat
 * rusak dari mana pun: halamannya tetap terbuka, seluruh fitur yang sudah
 * dijelaskan tetap terbaca, dan yang tidak dijelaskan hanya tidak ada — persis
 * seperti fitur yang memang belum dibuat. Petugas yang mencarinya menyimpulkan
 * fiturnya tidak ada, bukan panduannya yang tertinggal.
 *
 * ## Bentuk tiap butir
 *
 *   isi     Apa yang benar-benar tergambar di layar itu.
 *   guna    Pertanyaan apa yang dijawabnya, dan kapan layar itu dibuka.
 *   catatan Batas yang mudah disalahpahami. Ditulis hanya bila ada.
 *
 * Seluruh nilainya teks polos, tanpa satu pun tanda HTML: halaman yang
 * menggambarnya melewatkannya ke `amankan()`, dan tanda yang ditulis di sini
 * akan tampil sebagai tanda, bukan sebagai penebalan. Penekanan diberikan oleh
 * susunannya — bukan oleh huruf tebal di tengah kalimat.
 *
 * Gaya teks pengguna: baku, lugas, dan ringkas. Kalimatnya pernyataan langsung,
 * tanpa kiasan, tanpa konstruksi "bukan X melainkan Y", dan tanpa huruf kapital
 * untuk penekanan. Aturan ini hanya untuk nilai teks di bawah; komentar kode di
 * berkas ini tidak ditampilkan kepada pengguna.
 *
 * ## Tiga ruang, bukan satu daftar disaring
 *
 * Disusun mengikuti lib/peran.js: tiga menu yang berdiri sendiri, bukan satu
 * menu yang dipangkas. Halaman `input` muncul di ruang pusat dan di ruang
 * wilayah dengan nama berbeda — "Input Berita" dan "Kirim Berita" — dan dengan
 * akibat yang berbeda pula. Satu penjelasan untuk keduanya akan benar separuh.
 */

/* --------------------------------------------------------------- ruang pusat */

const PUSAT = {
  dasbor: {
    isi: 'Ringkasan pemberitaan hari ini dalam satu layar: jumlah publikasi beserta '
      + 'selisihnya terhadap hari sebelumnya, sebaran sentimen, kejadian yang memerlukan '
      + 'perhatian, unit yang paling banyak disorot, peta sebaran seluruh Lapas, Rutan, '
      + 'dan LPKA, serta indikator kesehatan aliran data di puncak halaman.',
    guna: 'Layar pertama yang dibuka setiap pagi. Setiap angka pada ubin dapat ditekan '
      + 'untuk membuka daftar yang menghasilkannya, sehingga asal-usul tiap angka dapat '
      + 'ditelusuri langsung.',
    catatan: 'Indikator kesehatan membedakan dua hal yang mudah tertukar: penyalinan '
      + 'yang berhasil dan baris baru yang benar-benar datang. Penyalinan dapat berhasil '
      + 'setiap lima menit tanpa ada berita baru yang masuk.',
  },
  briefing: {
    isi: 'Ringkasan situasi nasional dalam bentuk kalimat: satu pernyataan tingkat risiko '
      + 'di puncak, angka-angka utama yang masing-masing disertai pembanding periode '
      + 'sebelumnya, dan daftar singkat hal yang memerlukan keputusan. Pada bagian '
      + 'Penilaian risiko, tingkat risiko tiap pola dapat ditekan untuk membuka kartu '
      + 'beritanya: judul, sumber asli, tombol telaah, dan tombol jadikan kasus.',
    guna: 'Bahan bacaan ringkas bagi pimpinan sebelum rapat.',
    catatan: 'Seluruh angka pada halaman ini tidak dihitung ulang di sini, melainkan '
      + 'diambil dari perhitungan yang sama dengan dasbor, sehingga keduanya selalu '
      + 'selaras.',
  },
  'deteksi-lonjakan': {
    isi: 'Dua daftar yang dihitung di peladen setiap jam: unit yang mendadak diberitakan '
      + 'buruk berkali-kali dalam sehari, dan isu yang diangkat banyak media sekaligus. '
      + 'Ambang penandaannya tercantum di layar.',
    guna: 'Peringatan Dini menilai berita satu per satu; halaman ini menilai pola. Sebuah '
      + 'unit yang diberitakan lima kali dengan urgensi sedang dapat lolos dari penilaian '
      + 'per berita, padahal lima kali dalam satu hari perlu segera ditindaklanjuti.',
    catatan: 'Halaman ini hanya menampilkan hasil perhitungan peladen. Versi layar '
      + 'dindingnya, Situation Room, dibuka dari tombol di dalam halaman ini.',
  },
  negatif: {
    isi: 'Seluruh pemberitaan yang merugikan institusi, disusun menurut peristiwa, bukan '
      + 'menurut publikasi. Delapan berita tentang satu narapidana yang kabur tampil '
      + 'sebagai satu kejadian dengan eksposur delapan.',
    guna: 'Menjawab apa yang sedang merugikan institusi hari ini dan seberapa besar '
      + 'tekanan opininya. Ditempatkan tersendiri di menu agar isu yang merugikan dapat '
      + 'langsung dilihat tanpa perlu dicari di dalam daftar gabungan.',
    catatan: 'Jumlah peristiwa dan jumlah publikasi adalah dua angka berbeda, dan keduanya '
      + 'ditampilkan. Jumlah peristiwa menentukan banyaknya kasus yang harus ditangani, '
      + 'jumlah publikasi menentukan besarnya gaung pemberitaan.',
  },
  positif: {
    isi: 'Pemberitaan yang menguatkan institusi, disusun dengan bentuk yang sama seperti '
      + 'kanal negatif.',
    guna: 'Bahan kehumasan, sekaligus penyeimbang ketika sebuah isu negatif perlu dijawab '
      + 'dengan capaian yang sudah diberitakan pada unit yang sama.',
  },
  analisis: {
    isi: 'Empat cara membaca arsip yang sama, masing-masing satu tab: Tren (perubahan '
      + 'dibanding periode sebelumnya), Narasi (cerita yang sedang berjalan), Kaitan '
      + '(unit, media, dan tema yang saling bertemu), dan Pusat Komando (layar besar '
      + 'untuk ruang piket).',
    guna: 'Menjawab pertanyaan lanjutan setelah dasbor: ke mana arah pemberitaan, apa '
      + 'ceritanya, dan siapa yang terlibat. Tab yang terakhir dibuka diingat selama sesi.',
    catatan: 'Tab yang tidak menjadi kewenangan peran Anda tidak ditampilkan. Operator '
      + 'Puldata dan Petugas Verifikasi Lapangan hanya melihat Pusat Komando.',
  },
  ruang: {
    isi: 'Empat bagian: pekerjaan yang menuntut hari ini, pantauan milik analis sendiri, '
      + 'temuan aturan peringatan, dan riwayat singkat putusan yang baru dibuat.',
    guna: 'Menjawab pekerjaan apa yang menjadi bagian analis hari ini. Halaman lain '
      + 'menjawab pertanyaan tentang arsip; halaman ini tentang pekerjaan.',
    catatan: 'Pantauan tersimpan di peramban yang sedang dipakai, bukan di basis data. Ia '
      + 'tidak berpindah ke komputer lain dan tidak terbagi ke rekan setim.',
  },
  cari: {
    isi: 'Satu kotak kueri dengan bahasa saringan tersendiri. Setiap saringan yang '
      + 'dipasang lewat tombol ikut tertulis ke dalam kotak itu.',
    guna: 'Menjawab pertanyaan yang belum pernah ditanyakan sebelumnya. Karena seluruh '
      + 'saringan tertulis sebagai teks, kuerinya dapat disalin ke rekan lewat pesan, '
      + 'disimpan sebagai pantauan, dan dibaca ulang kemudian.',
    catatan: 'Pengubahan status telaah tidak dilakukan di sini. Halaman ini dapat memilih '
      + 'dua ratus baris sekaligus, sehingga putusan telaah justru dibuat di Antrean '
      + 'Telaah, satu per satu, lengkap dengan catatan penelaahnya.',
  },
  berita: {
    isi: 'Tabel seluruh berita dengan enam saringan tetap, kotak cari, dan tombol unduh '
      + 'CSV. Tiap baris dapat dibuka menjadi halaman detailnya sendiri.',
    guna: 'Arsip induk. Digunakan ketika bentuk yang dicari sudah diketahui: satu unit, '
      + 'satu rentang tanggal, atau satu status telaah.',
  },
  input: {
    isi: 'Borang satu halaman dengan panel penilaian mesin di sebelah kanan yang berjalan '
      + 'sambil diketik.',
    guna: 'Memasukkan isu viral yang belum tertangkap perayap. Tanpa halaman ini, berita '
      + 'hanya dapat masuk lewat penyalinan spreadsheet, padahal isu yang paling cepat '
      + 'berkembang sering kali luput dari perayap.',
    catatan: 'Hasilnya tetap berstatus Belum Ditelaah dan tidak langsung menjadi angka. '
      + 'Masukan manual tidak otomatis lebih tepercaya daripada hasil mesin.',
  },
  lapangan: {
    isi: 'Satu daftar penugasan dipandang dari dua sisi: analis menerbitkan surat tugas, '
      + 'petugas lapangan mengisi laporan dan mengunggah bukti.',
    guna: 'Menyandingkan isi pemberitaan media dengan fakta di lokasi.',
    catatan: 'Laporan lapangan tidak mengubah status berita. Unit yang menyatakan berita '
      + 'tentang dirinya keliru tidak dapat menghapus berita itu dari angka nasional; '
      + 'kewenangan menyatakan sebuah berita tidak valid ada pada analis pusat.',
  },
  evaluasi: {
    isi: 'Matriks penyandingan dalam bentuk baris (isi pemberitaan media, fakta lapangan, '
      + 'dan kesesuaiannya), diikuti rekomendasi sebagai butir-butir tersendiri.',
    guna: 'Mempertemukan dua sumber yang saling bertentangan. Selisih keduanya penting: '
      + 'unit yang diberitakan kehilangan sepuluh warga binaan tetapi sebenarnya '
      + 'kehilangan tiga adalah kabar benar dengan angka yang keliru, dan penanganannya '
      + 'berbeda dari kabar bohong.',
    catatan: 'Analisis yang sudah diverifikasi tidak dapat disunting lagi. Perubahan '
      + 'dibuat sebagai versi baru, dan keduanya tetap terbaca.',
  },
  keputusan: {
    isi: 'Analisis beserta rekomendasinya, dengan kotak centang pada tiap rekomendasi. '
      + 'Tidak ada penyuntingan pada layar ini.',
    guna: 'Ruang kerja paling ringkas, sesuai peruntukannya: pimpinan membaca lalu '
      + 'memutuskan. Menyetujui dua dari empat rekomendasi adalah putusan yang sah.',
    catatan: 'Putusan tidak dapat dicabut. Putusan yang keliru dikoreksi dengan putusan '
      + 'baru, dan keduanya tetap terbaca berdampingan.',
  },
  'analisis-berita': {
    isi: 'Analisis kasus per kasus. Pilih satu berita negatif (daftarnya dikelompokkan per '
      + 'kanwil), lalu lengkapi fakta 5W1H, analisis, prakiraan, rekomendasi, dan evaluasi '
      + 'SIP. Tentukan tujuannya: Klarifikasi UPT, Tindak lanjut disposisi pimpinan, atau '
      + 'keduanya.',
    guna: 'Hasilnya langsung masuk Tindak Lanjut, dan grup Telegram kanwil diberi tahu '
      + 'otomatis. Klarifikasi dari pusat menunggu kanwil meneruskannya ke UPT.',
    catatan: 'Klarifikasi hanya dapat diminta untuk berita yang sudah terpetakan ke UPT. '
      + 'Menganalisis ulang berita yang sama memperbarui analisisnya, tanpa membuat '
      + 'permintaan kedua.',
  },
  'tindak-lanjut': {
    isi: 'Tiga tab. Klarifikasi UPT: permintaan klarifikasi per kanwil, status input tiap '
      + 'UPT, berkasnya, dan penilaiannya. Disposisi Pimpinan: disposisi yang dicatat, '
      + 'dikerjakan, dan dilaporkan hasilnya. Tindak Lanjut Kasus: butir turunan putusan '
      + 'pimpinan atas kasus intelijen, lengkap dengan pelaksana dan tenggat.',
    guna: 'Menjawab apakah UPT sudah menanggapi pemberitaan tentang dirinya, dan apakah '
      + 'keputusan pimpinan sudah dikerjakan, tanpa perlu menelepon.',
    catatan: 'Klarifikasi UPT mengikuti Format Laporan Klarifikasi Berita (Laporan '
      + 'Insidental, Berita Acara Verifikasi Isu, Draft Tanggapan): dibaca langsung di '
      + 'tiap butir dan dapat diunduh sebagai .docx; format kosongnya diunduh dari kartu '
      + 'di atas daftar. Klarifikasi wajib menyebut nama serta jabatan pengirimnya. '
      + 'Pengingat untuk UPT yang belum menginput dikirim ke grup Telegram kanwil pukul '
      + '08.00 dan 14.00 WIB.',
  },
  laporan: {
    isi: 'Dua keluaran untuk periode yang sama. Pertama, laporan intelijen berkala: pilih '
      + 'periodenya, tekan satu tombol, dan berkasnya tersusun lengkap dengan diagram '
      + 'serta daftar sumbernya, siap dicetak atau disimpan sebagai PDF lewat menu cetak '
      + 'peramban. Kedua, ekspor daftar berita: buku kerja Excel berisi berita pada '
      + 'periode itu, seluruhnya atau hanya yang negatif, diurutkan dengan berita negatif '
      + 'dan prioritas lebih dulu. Keduanya ditandai menurut Standar Intelijen '
      + 'Pemasyarakatan 2023: klasifikasi (SR, R, YB, YPM), prioritas (Mendesak, Segera, '
      + 'Rutin), kode penyebarluasan (A-E), serta evaluasi sumber (A-E) dan informasi '
      + '(1-5) per berita.',
    guna: 'Ekspor mandiri harian, mingguan, dan bulanan, tanpa menunggu proses di belakang '
      + 'layar. Laporan memuat pemberitaan negatif, yaitu daftar hal yang menuntut '
      + 'tindakan; buku kerja Excel memuat daftar lengkapnya beserta peringatan dini dan '
      + 'usulan pemecahan masalah tiap berita negatif.',
    catatan: 'Satu hari laporan berarti pukul 00.00 sampai 23.59 WIB, sama dengan jendela '
      + 'laporan harian Telegram. Klasifikasi paling rendah dihitung dari isi berkas dan '
      + 'tidak dapat diturunkan; kode penyebarluasan B, C, dan D menghasilkan versi edaran '
      + 'yang identitas petugasnya dikaburkan. Setiap unduhan tercatat di Jejak Audit.',
  },
  infografis: {
    isi: 'Satu lembar gambar untuk laporan harian atau mingguan, memuat sisi baik dan sisi '
      + 'buruk sekaligus. Gambar yang tampil di layar, yang diunduh sebagai PNG, dan yang '
      + 'tercetak adalah gambar yang sama.',
    guna: 'Untuk pembaca yang tidak sedang menangani kasus, seperti pimpinan, kehumasan, '
      + 'dan kantor wilayah, dan harus dapat dibaca dalam satu menit. Lembar yang hanya '
      + 'memuat kabar buruk cenderung berhenti dibaca.',
    catatan: 'Seluruhnya digambar di dalam peramban. Tidak ada nama unit atau judul berita '
      + 'yang dikirim ke peladen mana pun untuk dirender.',
  },
  distribusi: {
    isi: 'Pratinjau pesan dan lampiran yang akan dikirim, daftar grup yang akan menerima, '
      + 'tombol kirim, dan riwayat seluruh pengiriman beserta sebab kegagalannya.',
    guna: 'Tempat laporan dan peringatan dikirim ke grup Telegram.',
    catatan: 'Pengiriman selalu melalui pratinjau, menyebutkan tujuannya, dan tercatat. '
      + 'Ketiga syarat ini menutup cacat sistem lama yang pernah mengirim dua berita yang '
      + 'tidak pernah terjadi.',
  },
  'siklus-kasus': {
    isi: 'Dua tab berurutan: Antrean Telaah, tempat penilaian mesin atas tiap berita '
      + 'disetujui atau dikoreksi, dan Kasus Intelijen, tempat berita yang perlu '
      + 'ditindaklanjuti dibentuk menjadi kasus beserta Analisa Awal, nilai informasi, dan '
      + 'PIC-nya.',
    guna: 'Satu pintu untuk dua langkah berurutan: menelaah lalu membentuk kasus. Analisa '
      + 'Awal yang ditulis pada borang Bentuk Kasus tampil di rincian kasus itu.',
    catatan: 'Pimpinan dan Analis Evaluasi tidak menelaah berita; bagi mereka menu ini '
      + 'langsung membuka daftar kasus. Angka pada menu adalah jumlah berita yang menunggu '
      + 'telaah.',
  },
  'pemantauan-sistem': {
    isi: 'Dua tab: Aturan Peringatan (bila suatu keadaan terjadi, siapa yang dikabari) dan '
      + 'Kesehatan Sistem (apakah aliran data, penjadwal, dan sambungan keluar berjalan).',
    guna: 'Menjawab apakah sistem akan memberi tahu pada waktunya, dari sisi aturan yang '
      + 'dinyalakan dan dari sisi aliran data yang membawa beritanya.',
    catatan: 'Analis hanya melihat tab Aturan Peringatan; Kesehatan Sistem khusus '
      + 'Superadmin.',
  },
  'pengguna-data': {
    isi: 'Empat tab pekerjaan Superadmin: Pengguna, Koordinat UPT, Integrasi dan Kunci, '
      + 'serta Jejak Audit.',
    guna: 'Menerbitkan dan mengatur akun, membetulkan data induk unit, mengatur sambungan '
      + 'keluar, lalu memeriksa riwayat perubahan.',
    catatan: 'Administrator Kantor Wilayah tetap membuka halaman Pengguna Wilayah miliknya '
      + 'sendiri, tanpa tab lain dan tanpa nama menu pusat ini.',
  },
}

/* ------------------------------------------------------------- ruang wilayah */

const WILAYAH = {
  dasbor: {
    isi: 'Dasbor Eksekutif yang sama dengan pusat, berisi berita UPT di wilayah Anda saja: '
      + 'angka sebulan, isu teratas, unit yang diberitakan negatif, dan kotak Cari UPT.',
    guna: 'Layar pertama setelah masuk. Berita dihitung sebagai milik wilayah Anda bila '
      + 'datang dari lembar kanwil Anda, atau bila UPT-nya tercatat di bawah kanwil Anda di '
      + 'data induk.',
    catatan: 'Pembatasannya dilakukan peladen, bukan halaman: berita wilayah lain tidak '
      + 'sampai ke peramban Anda.',
  },
  'analisis-berita': {
    isi: 'Analisis kasus per kasus atas berita negatif di wilayah Anda. Pilih satu berita, '
      + 'lengkapi fakta 5W1H dan penilaiannya, lalu teruskan sebagai Klarifikasi UPT '
      + 'dan/atau Tindak lanjut disposisi pimpinan.',
    guna: 'Klarifikasi yang Anda buat langsung diteruskan ke UPT-nya; UPT melihatnya di '
      + 'menu Klarifikasi UPT, dan grup Telegram kanwil diberi tahu.',
    catatan: 'UPT hanya dapat menjawab bila sudah punya akun penelaah unit. Terbitkan '
      + 'akunnya di Pengguna Wilayah.',
  },
  'tindak-lanjut': {
    isi: 'Klarifikasi UPT dan Disposisi Pimpinan untuk wilayah Anda. Teruskan permintaan '
      + 'dari pusat ke UPT, nilai berkas klarifikasi yang masuk (terima atau kembalikan), '
      + 'dan catat disposisi pimpinan beserta hasilnya.',
    guna: 'Satu tempat untuk memantau UPT mana yang belum dan sudah menginput klarifikasi.',
    catatan: 'Administrator Kantor Wilayah dapat mengunggah klarifikasi atas nama UPT bila '
      + 'perlu; namanya tetap tercatat sebagai pengunggah.',
  },
  'kanwil-dasbor': {
    isi: 'Empat ubin di puncak (berita wilayah, yang perlu respons segera, yang menunggu '
      + 'telaah Anda, dan yang menunggu telaah pusat), lalu grafik empat belas hari '
      + 'terakhir, keseimbangan pemberitaan, unit yang paling banyak disorot, dan sebaran '
      + 'urgensi. Di bawahnya: berita negatif yang belum ditanggapi unit, yang mendesak, '
      + 'dan kiriman Anda sendiri.',
    guna: 'Layar pertama Administrator Kantor Wilayah. Menjawab keadaan pemberitaan seluruh '
      + 'unit di wilayah ini hari ini, dan apa yang menunggu dikerjakan.',
    catatan: 'Seluruh angkanya hanya mencakup wilayah ini. Batas itu ditegakkan basis '
      + 'data, bukan saringan di layar: baris unit wilayah lain tidak sampai ke peramban. '
      + 'Tidak ada angka nasional di ruang ini.',
  },
  input: {
    isi: 'Borang satu halaman dengan panel penilaian mesin di sebelah kanan yang berjalan '
      + 'sambil diketik, dan kop yang menyebutkan wilayah yang akan tercatat pada kiriman '
      + 'ini.',
    guna: 'Pintu masuk berita dari daerah. Digunakan untuk berita tentang unit di wilayah '
      + 'ini yang belum tertangkap perayap maupun spreadsheet.',
    catatan: 'Hanya Administrator Kantor Wilayah yang memasukkan berita, agar setiap '
      + 'kiriman memiliki satu penanggung jawab yang dapat dikonfirmasi bila terjadi '
      + 'kekeliruan.',
  },
  'wilayah-telaah': {
    isi: 'Antrean berita wilayah satu per satu, lengkap dengan alasan mesin, dan kolom '
      + 'untuk menyetujui atau merevisi kategori, sentimen, serta urgensinya beserta alasan '
      + 'revisinya.',
    guna: 'Kantor wilayah dan unitnya paling memahami apakah sebuah kabar benar menyangkut '
      + 'unit itu. Revisinya tercatat lengkap dengan nama penelaahnya.',
    catatan: 'Putusan di sini tidak mengubah status verifikasi pusat. Kolom status '
      + 'verifikasi menjadi kewenangan analis pusat dan menentukan sebuah berita ikut '
      + 'dihitung atau tidak; bila daerah dapat mengisinya, sebuah unit dapat menyatakan '
      + 'berita tentang dirinya tidak valid sehingga berita itu hilang dari angka nasional '
      + 'tanpa ditelaah analis.',
  },
  'wilayah-berita': {
    isi: 'Tabel seluruh berita yang menyangkut unit di wilayah ini, dengan saringan dan '
      + 'kotak cari yang sama seperti Pusat Data Berita.',
    guna: 'Arsip wilayah. Digunakan untuk menelusuri riwayat pemberitaan satu unit, satu '
      + 'rentang tanggal, atau satu status telaah.',
    catatan: 'Putusan telaah daerah dan status verifikasi pusat terbaca berdampingan di '
      + 'sini, sehingga keduanya tidak tertukar.',
  },
  'wilayah-unit': {
    isi: 'Seluruh unit yang dibawahi wilayah ini, diambil dari data induk, bukan hanya '
      + 'sepuluh teratas atau yang pernah diberitakan.',
    guna: 'Kantor wilayah bertanggung jawab atas setiap unitnya, termasuk yang belum '
      + 'pernah muncul di daftar mana pun. Unit yang tidak pernah diberitakan tetap unit '
      + 'yang harus dipantau.',
  },
  pengguna: {
    isi: 'Penerbitan akun Penelaah Berita UPT untuk unit di wilayah ini, dan daftar akun '
      + 'yang sudah diterbitkan.',
    guna: 'Memberi tiap unit satu akun untuk menelaah dan menanggapi berita tentang '
      + 'dirinya sendiri.',
    catatan: 'Hanya peran Penelaah Berita UPT yang dapat diterbitkan dari sini, dan hanya '
      + 'untuk unit di wilayah sendiri. Batas itu ditegakkan peladen, bukan dengan '
      + 'menyembunyikan pilihan pada borang.',
  },
}

/* ---------------------------------------------------------------- ruang unit */

const UNIT = {
  klarifikasi: {
    isi: 'Pemberitaan negatif tentang unit Anda yang diminta klarifikasinya oleh kanwil, '
      + 'beserta instruksi dan batas waktunya.',
    guna: 'Buka "Isi laporan klarifikasi" dan isi menurut format resmi: Berita Acara '
      + 'Verifikasi Isu (hasil konfirmasi, fakta sebenarnya, dan tingkat isu wajib diisi), '
      + 'Laporan Insidental, dan Draft Tanggapan. Tombol "Unduh laporan (.docx)" menyusun '
      + 'berkasnya untuk dicetak dan ditandatangani; hasil pindaian bertanda tangan dapat '
      + 'dilampirkan (PDF/DOCX, opsional). Isi nama dan jabatan pengirim, lalu kirim. '
      + 'Kanwil dan pusat langsung diberi tahu. Format kosong (termasuk Buku Kontrol, '
      + 'Rekapitulasi, dan Laporan Mingguan) diunduh dari kartu di puncak halaman.',
    catatan: 'Klarifikasi yang dikembalikan kanwil muncul kembali beserta catatan '
      + 'perbaikannya.',
  },
  'upt-dasbor': {
    isi: 'Empat ubin di puncak (berita unit ini, yang perlu respons segera, yang menunggu '
      + 'telaah Anda, dan yang belum ditanggapi), lalu grafik empat belas hari terakhir dan '
      + 'keseimbangan pemberitaan. Di bawahnya: sikap unit yang sudah dinyatakan, dan yang '
      + 'menunggu tanggapan Anda.',
    guna: 'Layar pertama Penelaah Berita UPT. Menjawab apa yang sedang diberitakan tentang '
      + 'unit ini, dan apa yang belum dijawab.',
    catatan: 'Cakupannya satu unit. Berita unit lain tidak sampai ke layar ini, dan daftar '
      + 'unit lain bukan kewenangan peran ini.',
  },
  'wilayah-telaah': {
    isi: 'Antrean berita unit ini satu per satu, lengkap dengan alasan mesin, kolom revisi '
      + 'penilaian, dan kolom tanggapan resmi unit.',
    guna: 'Dua pekerjaan sekaligus: menilai apakah penilaian mesin sudah tepat, dan '
      + 'menuliskan sikap resmi unit atas berita itu.',
    catatan: 'Tanggapan unit adalah pernyataan, bukan putusan. Ia tidak menghapus berita '
      + 'dari angka nasional dan tidak mengubah status verifikasi pusat; ia tersimpan pada '
      + 'kolomnya sendiri dan terbaca berdampingan dengan penilaian pusat.',
  },
  'wilayah-berita': {
    isi: 'Tabel seluruh berita yang menyangkut unit ini, dengan saringan dan kotak cari '
      + 'yang sama seperti di ruang lain.',
    guna: 'Arsip unit. Digunakan untuk menelusuri riwayat pemberitaan unit ini dan melihat '
      + 'mana yang sudah ditanggapi.',
  },
}

/* ------------------------------------------------------- halaman tanpa menu */

/**
 * Halaman yang tidak punya butir menu, tetapi tetap dibuka petugas setiap hari.
 *
 * Dipisah dari ketiga ruang di atas supaya penjaga cakupan bisa membedakan
 * "belum dijelaskan" dari "memang tidak ada di menu".
 */
export const TANPA_MENU = {
  /* Bagian-bagian menu gabungan 23 September 2026, dan dua halaman yang
     kehilangan butir menunya. Penjelasannya tetap per bagian, sebab tiap
     bagian menjawab pertanyaan yang berbeda dan punya batasnya sendiri. */
  telaah: {
    isi: 'Antrean satu berita per layar, lengkap dengan alasan mesin: kata kunci penentu, '
      + 'skor keyakinan, dan pesaing terdekatnya. Analis menyetujui atau mengoreksi, lalu '
      + 'lanjut ke berita berikutnya.',
    guna: 'Tempat penilaian mesin menjadi penilaian resmi. Tanpa halaman ini, hasil '
      + 'berkeyakinan 0,20 dan 0,95 sama-sama masuk laporan tanpa ditelaah manusia.',
    catatan: 'Disusun sebagai antrean, bukan tabel. Tabel dua puluh baris mendorong orang '
      + 'mencentang semuanya sekaligus; satu berita yang memenuhi layar menuntut dibaca '
      + 'lebih dulu.',
  },
  kasus: {
    isi: 'Perkara intelijen: beberapa publikasi dan peristiwa yang diikat menjadi satu '
      + 'berkas dengan riwayat penanganannya.',
    guna: 'Tempat pemberitaan diangkat dari daftar menjadi perkara. Menjawab sejauh mana '
      + 'penanganan sebuah perkara, pertanyaan yang tidak dapat dijawab di dalam tabel '
      + 'berita.',
  },
  aturan: {
    isi: 'Daftar aturan peringatan: bila suatu keadaan terjadi, siapa yang dikabari. '
      + 'Setiap kali syaratnya diubah, jangkauannya dihitung ulang terhadap arsip yang '
      + 'termuat, sebelum tombol Simpan ditekan.',
    guna: 'Menuliskan pertanyaan tetap sebuah kantor agar tidak perlu ditanyakan ulang '
      + 'setiap hari.',
    catatan: 'Lima aturan bawaan dapat dimatikan dan ambangnya dapat disunting, tetapi '
      + 'tidak dapat dihapus. Karena itu tombolnya berbunyi Pulihkan, bukan Hapus.',
  },
  kesehatan: {
    isi: 'Keadaan tiap komponen yang bekerja di belakang layar: penyalin sumber, perayap, '
      + 'penjadwal laporan, dan pengiriman Telegram, masing-masing dinilai dari waktu '
      + 'kegiatan terakhirnya, dengan ambang diamnya tercantum di layar.',
    guna: 'Menjawab apakah sistem masih bekerja. Ketiganya dapat berhenti tanpa galat yang '
      + 'tampak di layar, dan kelas kegagalan itu paling lama tidak diketahui.',
  },
  pengguna: {
    isi: 'Penerbitan akun beserta perannya, dan daftar akun yang sudah ada.',
    guna: 'Menerbitkan akun untuk petugas baru. Superadmin menerbitkan peran apa pun; '
      + 'Administrator Kantor Wilayah hanya Penelaah Berita UPT di wilayahnya sendiri.',
    catatan: 'Kolom identitas dapat diisi alamat surel (misalnya Gmail kanwil) atau '
      + 'username pendek, untuk peran apa pun. Petugas masuk dengan apa yang ditulis di '
      + 'kolom itu.',
  },
  koordinat: {
    isi: 'Satu unit pada satu waktu, dengan pratinjau titiknya di atas peta yang sama '
      + 'dengan Peta Sebaran, dan kolom untuk membetulkan atau membenarkan koordinatnya.',
    guna: 'Memperbaiki titik yang masih berupa pusat kota. Pratinjaunya memadai untuk '
      + 'menangkap kesalahan yang paling sering terjadi: bujur dan lintang tertukar, atau '
      + 'tanda minus hilang.',
  },
  integrasi: {
    isi: 'Pemeriksaan sambungan Telegram: empat langkah penyiapan dengan tanda sudah atau '
      + 'belum, dan keterangan yang menyebutkan secara tepat apa yang salah pada kunci '
      + 'tersimpan.',
    guna: 'Menyelesaikan penyiapan bot Telegram tanpa membuka baris perintah. Sebelumnya '
      + 'penyiapan dapat terhambat berhari-hari tanpa layar yang menjelaskan sebabnya.',
    catatan: 'Tidak ada kolom isian kunci di halaman ini, dan tidak boleh ada. Kunci bot '
      + 'tidak melewati peramban; yang terlihat di sini hanya hasil pemeriksaannya.',
  },
  audit: {
    isi: 'Riwayat tindakan pengguna, hanya dapat dibaca. Tindakan yang mengubah keadaan '
      + 'tampil lebih dulu; pembacaan halaman disembunyikan di balik sakelar.',
    guna: 'Menelusuri siapa melakukan apa dan kapan.',
    catatan: 'Tidak ada tombol sunting dan tidak ada tombol hapus, sebab basis data tidak '
      + 'menyediakan jalannya. Jejak yang dapat dihapus oleh pelakunya tidak memenuhi '
      + 'fungsi jejak.',
  },
  pemetaan: {
    isi: 'Berita yang unitnya belum dikenali, beserta kandidat unit sebagai tombol, hasil '
      + 'mesin pencocokan yang dijalankan ulang di peramban. Tersedia pula pencarian bebas '
      + 'ke seluruh unit pada data induk.',
    guna: 'Memutuskan unit yang dimaksud sebuah berita ketika skor mesin di bawah ambang '
      + 'otomatis. Berita yang tidak terpetakan tidak muncul di peta, di daftar unit, '
      + 'maupun di lembar wilayah.',
  },
  sinkronisasi: {
    isi: 'Keadaan tiap sumber data: kapan terakhir ditarik, berapa baris yang datang, dan '
      + 'sebab kegagalan bila ada. Sumber pusat dan sumber tiap kantor wilayah dilaporkan '
      + 'terpisah.',
    guna: 'Menjawab mengapa pemberitaan hari ini sepi. Data yang kosong lebih sering '
      + 'berarti penarikan terhenti daripada berarti tidak ada berita.',
    catatan: 'Tidak ada tombol tarik sekarang di halaman ini, dan itu disengaja: penarikan '
      + 'menuntut token yang tidak boleh berada di peramban. Penjadwal di basis data sudah '
      + 'menariknya secara otomatis.',
  },
  /* Empat tab Analisis Pemberitaan. Penjelasannya tetap dipisah per tab, sebab
     tiap tab menjawab pertanyaan yang berbeda dan punya batasnya sendiri. */
  tren: {
    isi: 'Perbandingan periode berjalan terhadap periode sebelumnya yang panjangnya sama: '
      + 'ubin yang bertumbuh atau menyusut, batang per kategori, dan tabel subkategori yang '
      + 'naik paling tajam.',
    guna: 'Dasbor menjawab keadaan hari ini; halaman ini menjawab apa yang berubah. '
      + 'Digunakan untuk menyusun laporan mingguan dan bulanan.',
    catatan: 'Tidak ada ramalan di sini, dan itu disengaja. Sistem ini mencatat '
      + 'pemberitaan yang sudah terbit.',
  },
  narasi: {
    isi: 'Kumpulan peristiwa yang membentuk satu cerita, tiap cerita satu kartu: bentuknya '
      + '(menanjak, berulang, bertahan, mereda), sebarannya, pemantiknya, dan ada tidaknya '
      + 'suara penyeimbang.',
    guna: 'Menjawab cerita apa yang sedang berjalan tentang institusi, satu lapis di atas '
      + 'peristiwa. Satu kartu dapat memuat tiga kejadian di tiga unit berbeda, sesuai cara '
      + 'publik membacanya.',
    catatan: 'Pemantik disebut sebagai terbitan paling awal yang tercatat, bukan sebagai '
      + 'sumber narasi. Arsip ini hanya memuat yang berhasil ditangkap.',
  },
  jaringan: {
    isi: 'Gambar kaitan antara unit, media, wilayah, tema, dan platform. Tebal garis '
      + 'menunjukkan berapa kali dua hal muncul di publikasi yang sama; besar simpul '
      + 'menunjukkan berapa publikasi menyebutnya.',
    guna: 'Menjawab tiga pertanyaan yang tidak dapat dijawab tabel: media mana yang '
      + 'mengangkat unit ini dan apa lagi yang mereka angkat, tema apa yang muncul di '
      + 'banyak unit sekaligus, dan siapa yang menjembatani dua kelompok.',
    catatan: 'Tidak ada simpul orang di sini, dan tidak akan ada sampai kewenangan '
      + 'pengumpulan data akun perorangan dinyatakan tertulis.',
  },
  komando: {
    isi: 'Enam angka nasional berukuran besar dan daftar peringatan terberat, beserta waktu '
      + 'penyegaran terakhir.',
    guna: 'Untuk layar dinding ruang piket, dapat dibaca dari jarak jauh. Isinya sama '
      + 'dengan dasbor; hanya bentuknya yang berbeda.',
  },
  peringatan: {
    isi: 'Kejadian berurgensi tinggi dan kritis dalam bentuk kartu satu per satu, dengan '
      + 'pita kerawanan di tepi kiri.',
    guna: 'Dibaca ketika sebuah kejadian sedang berlangsung. Kartunya muncul juga sebagai '
      + 'jendela ketika kata risiko di halaman Peringatan Dini ditekan; halaman penuhnya '
      + 'dibuka dari tombol Lihat semua di dasbor.',
    catatan: 'Label AWAL berarti belum ditelaah analis; label RESMI berarti sudah '
      + 'diverifikasi. Hanya yang sudah diverifikasi yang dapat menjadi dasar keputusan.',
  },
  peta: {
    isi: 'Seluruh Lapas, Rutan, dan LPKA di Indonesia sebagai titik pada satu peta, '
      + 'diwarnai menurut keadaan pemberitaan masing-masing.',
    guna: 'Tergambar di Dasbor Eksekutif. Menunjukkan di mana persoalan menumpuk, hal yang '
      + 'tidak terlihat dari tabel. Sepuluh unit rawan yang tersebar dari Aceh sampai Papua '
      + 'dan sepuluh unit rawan di satu provinsi terbaca sama di dalam tabel tetapi berbeda '
      + 'maknanya.',
    catatan: 'Sebagian besar koordinat masih berupa titik pusat kota, bukan alamat '
      + 'gedungnya. Hal itu dinyatakan di layar dan diperbaiki lewat halaman Koordinat UPT.',
  },
  'berita-detail': {
    isi: 'Satu berita utuh beserta dasar penilaiannya: kata kunci penentu, skor mesin, '
      + 'catatan telaah analis, dan tanggapan unit bila sudah ada. Berita negatif mendapat '
      + 'kartu Rekomendasi tindak lanjut (sidak, klarifikasi, verifikasi, atau pantau) '
      + 'beserta penilaian SIP 2023: evaluasi sumber A-E, evaluasi informasi 1-5, dan '
      + 'prioritas. Analis berwenang dapat menetapkan keputusan dan penilaiannya sendiri; '
      + 'keputusan analis mengungguli saran mesin.',
    guna: 'Menjawab pertanyaan yang paling sering diajukan: mengapa berita ini dinilai '
      + 'demikian. Dibuka dari Pusat Data Berita dan dari palet perintah.',
    catatan: 'Halaman ini hanya untuk peran pusat, sebab menampilkan catatan analis pusat. '
      + 'Membukanya bagi daerah berarti melepas catatan itu ke wilayah.',
  },
  profil: {
    isi: 'Nama, nama pengguna, dan kata sandi milik sendiri.',
    guna: 'Setiap peran berhak menyunting identitasnya sendiri, terlepas dari kewenangannya '
      + 'atas data lain.',
  },
  panduan: {
    isi: 'Halaman yang sedang Anda baca: penjelasan tiap fitur menurut ruangnya, panduan '
      + 'mengirim berita, dan aturan jendela pelaporan harian.',
    guna: 'Dibuka petugas baru pada hari pertama, dan dibuka siapa pun yang lupa fungsi '
      + 'sebuah layar. Tersedia bagi seluruh peran.',
  },
}

/* ----------------------------------------------------------------- manual */

/**
 * Manual mengirim berita, sebagai langkah berurutan.
 *
 * Ditulis satu kali untuk dua ruang. Borangnya memang satu dan sama — ruang
 * pusat menyebutnya "Input Berita", ruang wilayah menyebutnya "Kirim Berita" —
 * dan menulis dua manual untuk satu borang berarti salah satunya akan basi
 * tanpa ada yang tahu yang mana.
 */
export const MANUAL_KIRIM = [
  {
    judul: 'Buka menu Kirim Berita',
    isi: 'Di ruang wilayah namanya Kirim Berita; di ruang pusat namanya Input Berita. '
      + 'Borangnya sama, dan mesin yang menilainya juga sama.',
  },
  {
    judul: 'Periksa kop wilayah sebelum mengetik',
    isi: 'Di puncak borang tertulis wilayah yang akan tercatat pada kiriman ini. Bila yang '
      + 'tertulis "Wilayah pada akun Anda belum ditetapkan", berhenti di sini dan hubungi '
      + 'administrator: basis data akan menolak kiriman tanpa asal wilayah, dan penolakan '
      + 'itu baru muncul setelah seluruh borang terisi.',
  },
  {
    judul: 'Tempelkan tautan beritanya',
    isi: 'Kolom wajib. Tempelkan alamat lengkapnya; penanda iklan di ekor alamat dibuang '
      + 'otomatis sebelum disimpan. Di bawah kolom tertulis sumber yang berhasil dibaca '
      + 'dari alamat itu. Periksa sekilas, sebab alamat yang terpotong saat disalin '
      + 'biasanya terlihat pada baris ini.',
  },
  {
    judul: 'Salin judul beritanya apa adanya',
    isi: 'Kolom wajib. Tulis judul sebagaimana tertulis di sumbernya, tanpa diringkas dan '
      + 'tanpa diperbaiki ejaannya. Judul adalah keterangan pertama yang dibaca mesin, dan '
      + 'judul yang sudah disunting menggeser penilaiannya.',
  },
  {
    judul: 'Isi media dan tanggal terbit',
    isi: 'Keduanya tidak wajib. Media yang dikosongkan diisi dari nama situsnya. Tanggal '
      + 'terbit yang dikosongkan membuat berita ini tercatat tanpa tanggal terbit; berita '
      + 'tetap masuk laporan, sebab hari laporan ditentukan oleh waktu berita ditangkap, '
      + 'bukan tanggal terbitnya.',
  },
  {
    judul: 'Tentukan unitnya',
    isi: 'Ketik nama unit, dan daftar unit akan membantu melengkapinya. Mesin pencocokan '
      + 'juga membaca judul serta ringkasan dan menawarkan saran beserta tingkat '
      + 'keyakinannya; tekan "Pakai saran ini" bila benar. Kosongkan bila unitnya belum '
      + 'jelas, dan jangan menebak. Berita tanpa unit dapat dipetakan kemudian, sedangkan '
      + 'berita yang salah unit akan terbaca sebagai persoalan unit yang tidak melakukan '
      + 'apa pun.',
  },
  {
    judul: 'Tulis ringkasan isinya',
    isi: 'Apa yang terjadi, di mana, dan siapa yang terlibat. Kolom ini paling menentukan '
      + 'ketepatan mesin: makin lengkap ringkasannya, makin tepat kategori, sentimen, dan '
      + 'urgensi yang diusulkannya. Satu kalimat cukup untuk disimpan, tetapi belum tentu '
      + 'cukup untuk dinilai dengan benar.',
  },
  {
    judul: 'Tambahkan catatan petugas bila perlu',
    isi: 'Konteks yang tidak ada di dalam beritanya sendiri, misalnya bahwa ini unggahan '
      + 'pertama yang memicu isu, atau bahwa akun penyebarnya bukan media. Catatan ini '
      + 'tidak dibaca mesin; ia dibaca penelaah.',
  },
  {
    judul: 'Baca panel penilaian mesin di sebelah kanan',
    isi: 'Panel ini muncul sekitar setengah detik setelah Anda berhenti mengetik. Isinya '
      + 'kategori, subkategori, sentimen, urgensi, persen keyakinan, kata kunci penentu, '
      + 'dan alasan ringkas. Keyakinan di bawah ambang ditandai peringatan kuning; itu '
      + 'bukan larangan menyimpan, melainkan permintaan untuk memeriksa.',
  },
  {
    judul: 'Betulkan penilaian yang keliru sekarang juga',
    isi: 'Subkategori, sentimen, dan urgensi di bawah panel masih dapat diubah. '
      + 'Membetulkannya di sini lebih mudah daripada membiarkannya lalu memperbaikinya di '
      + 'antrean telaah. Bila mesin menilai berita ini "Di Luar Lingkup", berita tetap '
      + 'dapat disimpan, tetapi tidak ikut menjadi angka di dasbor mana pun.',
  },
  {
    judul: 'Tekan Simpan berita',
    isi: 'Sebelum menyimpan, sistem memeriksa apakah tautan itu sudah pernah masuk. Bila '
      + 'sudah, yang muncul adalah judul kiriman yang lebih dulu ada, dan tidak ada baris '
      + 'baru yang dibuat. Itu bukan kegagalan, melainkan tanda beritanya sudah tercatat.',
  },
  {
    judul: 'Ikuti kirimannya sampai ke antrean telaah',
    isi: 'Berita tersimpan dengan status Belum Ditelaah dan belum menjadi angka di laporan '
      + 'mana pun. Tombol "Buka antrean telaah" membawa Anda langsung ke barisnya. Berita '
      + 'ikut dihitung setelah penelaah menyetujui penilaiannya.',
  },
]

/* ------------------------------------------------------- jendela pelaporan */

/**
 * Aturan jendela pelaporan harian, ditulis sebagai data supaya halaman panduan
 * dan uji regresi membaca kalimat yang sama.
 */
export const JENDELA_LAPORAN = {
  mulai: '00.00 WIB',
  selesai: '23.59 WIB',
  kirim: '05.30 WIB',
  contoh: 'Seluruh berita yang ditangkap pada 11 September 2026 pukul 00.00 WIB sampai '
    + '23.59 WIB dilaporkan pada 12 September 2026 pukul 05.30 WIB.',
  butir: [
    {
      judul: 'Satu hari laporan adalah satu hari kalender Jakarta',
      isi: 'Batasnya pukul 00.00 sampai 23.59 WIB, bukan pukul 07.00 sampai 07.00 dan bukan '
        + 'hari menurut UTC. Aturan ini berlaku sama untuk laporan Telegram dan untuk '
        + 'ekspor mandiri lewat halaman Laporan Berkala serta Lembar Infografis.',
    },
    {
      judul: 'Hari ditentukan oleh waktu tangkap, bukan tanggal terbit',
      isi: 'Sebuah berita yang terbit pekan lalu dan baru tertangkap tadi malam tetap kabar '
        + 'baru bagi pembaca laporan pagi ini. Memotongnya menurut tanggal terbit membuatnya '
        + 'tidak muncul di laporan mana pun. Tanggal terbitnya tidak hilang: ia tetap '
        + 'tercetak pada tiap baris laporan.',
    },
    {
      judul: 'Laporan harian terkirim pukul 05.30 WIB keesokan harinya',
      isi: 'Berkas PDF beserta pesan ringkasnya dikirim ke grup Telegram pimpinan. Yang '
        + 'dilaporkan adalah hari sebelumnya secara utuh, sehingga laporan yang terbit pagi '
        + 'ini tidak memuat berita pagi ini.',
    },
    {
      judul: 'Laporan mingguan terkirim tiap Minggu pukul 05.30 WIB',
      isi: 'Bentuk berkasnya sama; yang berbeda hanya rentang dan penomorannya.',
    },
    {
      judul: 'Berita yang masuk setelah 23.59 WIB masuk laporan hari berikutnya',
      isi: 'Tidak ada berita yang hilang karenanya, dan tidak ada yang dihitung dua kali. '
        + 'Perayap dan penyalin sumber tetap berjalan sepanjang malam.',
    },
  ],
}

/* ------------------------------------------------------------ alur kerja */

/**
 * Alur kerja lintas halaman, sebagai langkah berurutan per ruang.
 *
 * Katalog di atas menjawab "layar ini untuk apa". Alur menjawab pertanyaan
 * yang tidak bisa dijawab satu layar pun: "sesudah ini, saya ke mana". Analisis
 * Berita menerbitkan permintaan yang dikerjakan kanwil di Tindak Lanjut, lalu
 * oleh UPT di Klarifikasi UPT, lalu kembali dinilai di Tindak Lanjut — empat
 * layar, tiga ruang, dan tidak satu pun dari layar itu memperlihatkan
 * keseluruhannya.
 *
 * Dibaca dua tempat: halaman Panduan (seluruh alur, seluruh ruang) dan pita
 * pengingat di puncak tiap halaman yang menjadi salah satu langkahnya
 * (ui/pengingat-alur.js, hanya ruang si pembaca). Ditulis satu kali di sini
 * supaya keduanya tidak pernah bercerita berbeda.
 *
 *   halaman  nama halaman tempat langkah itu dikerjakan; satu langkah boleh
 *            menunjuk beberapa nama bila layarnya satu dengan beberapa alamat
 *   judul    perintahnya, dalam kata kerja
 *   isi      apa yang ditekan dan apa yang perlu diperiksa — teks polos
 *
 * tools/uji-panduan.mjs memeriksa bahwa setiap `halaman` di sini benar-benar
 * ada, sehingga pengingat tidak menunjuk layar yang sudah dihapus.
 */
export const ALUR = {
  penanganan: {
    judul: 'Penanganan berita negatif',
    ket: 'Dari analisis kasus per kasus sampai klarifikasi UPT dan disposisi pimpinan selesai.',
    langkah: {
      pusat: [
        {
          halaman: ['analisis-berita'],
          judul: 'Pilih satu berita negatif',
          isi: 'Daftar dikelompokkan per kanwil. Kanwil yang ditandai "terduga" dibaca dari '
            + 'nama tempat di judul dan belum ditetapkan siapa pun. Kelompok "Nasional / '
            + 'tanpa lokasi" berisi berita yang tidak menyebut daerah; umumnya cukup '
            + 'dijadikan disposisi pimpinan.',
        },
        {
          halaman: ['analisis-berita'],
          judul: 'Pastikan UPT-nya',
          isi: 'Klarifikasi UPT hanya dapat diterbitkan untuk berita yang sudah ditempatkan '
            + 'ke satu unit. Bila tertulis "UPT belum terpetakan", tetapkan unitnya lebih '
            + 'dulu dari kandidat yang ditawarkan atau lewat pencarian. Kosongkan bila belum '
            + 'jelas, dan jangan menebak.',
        },
        {
          halaman: ['analisis-berita'],
          judul: 'Lengkapi analisisnya',
          isi: 'Fakta 5W1H sudah terisi sebagian dari baris berita; lengkapi mengapa dan '
            + 'bagaimana. Lalu isi analisis, prakiraan, rekomendasi, serta evaluasi sumber '
            + 'dan informasi. Pisahkan fakta dari pendapat.',
        },
        {
          halaman: ['analisis-berita'],
          judul: 'Pilih tujuan, lalu simpan',
          isi: 'Klarifikasi UPT, Disposisi Pimpinan, atau keduanya, beserta batas waktunya. '
            + 'Tekan "Simpan analisis & teruskan". Permintaan klarifikasi masuk ke kanwil '
            + 'untuk diteruskan, dan grup Telegram kanwil diberi tahu otomatis.',
        },
        {
          halaman: ['klarifikasi', 'tindak-lanjut'],
          judul: 'Pantau dan nilai klarifikasi',
          isi: 'Di Tindak Lanjut, tab Klarifikasi UPT: status per kanwil (Belum diteruskan, '
            + 'Belum menginput, Sudah menginput, Selesai). Klarifikasi yang sudah masuk '
            + 'dinilai dengan "Terima klarifikasi" atau "Kembalikan untuk diperbaiki".',
        },
        {
          halaman: ['disposisi'],
          judul: 'Catat dan tuntaskan disposisi',
          isi: 'Di tab Disposisi Pimpinan: "Catat disposisi" begitu pimpinan memberi arahan, '
            + '"Simpan kemajuan" selama dikerjakan, dan "Tandai selesai" bila tuntas.',
        },
      ],
      wilayah: [
        {
          halaman: ['klarifikasi', 'tindak-lanjut'],
          judul: 'Teruskan permintaan dari pusat',
          isi: 'Permintaan klarifikasi dari pusat berstatus "Belum diteruskan". Periksa '
            + 'unitnya, lalu tekan "Teruskan ke UPT". Bila unitnya keliru, kabari pusat '
            + 'sebelum meneruskan.',
        },
        {
          halaman: ['analisis-berita'],
          judul: 'Analisis berita wilayah sendiri',
          isi: 'Kanwil juga dapat menganalisis berita negatif di wilayahnya. Permintaan yang '
            + 'diterbitkan kanwil langsung sampai ke UPT tanpa perlu diteruskan lagi.',
        },
        {
          halaman: ['klarifikasi', 'tindak-lanjut'],
          judul: 'Tagih UPT yang belum menginput',
          isi: 'Status "Belum menginput" yang melewati batas waktu ditandai. Pengingat '
            + 'Telegram terkirim otomatis pukul 08.00 dan 14.00 WIB; hubungi unitnya bila '
            + 'tetap belum menanggapi.',
        },
        {
          halaman: ['klarifikasi', 'tindak-lanjut'],
          judul: 'Nilai klarifikasi yang masuk',
          isi: 'Baca berkasnya, lalu "Terima klarifikasi" atau "Kembalikan untuk diperbaiki" '
            + 'dengan catatan apa yang kurang.',
        },
        {
          halaman: ['disposisi'],
          judul: 'Kerjakan disposisi kanwil',
          isi: 'Disposisi Kepala Kantor Wilayah dicatat, dikerjakan, dan ditandai selesai di '
            + 'tab Disposisi Pimpinan.',
        },
      ],
      unit: [
        {
          halaman: ['klarifikasi', 'tindak-lanjut'],
          judul: 'Buka permintaan klarifikasi',
          isi: 'Permintaan berstatus "Belum menginput" menunggu unit Anda. Baca beritanya '
            + 'dan instruksi dari kanwil atau pusat, serta batas waktunya.',
        },
        {
          halaman: ['klarifikasi', 'tindak-lanjut'],
          judul: 'Unggah berkas klarifikasi',
          isi: 'Berkas PDF atau DOCX berisi klarifikasi tertulis, kronologi, dan bukti '
            + 'pendukung. Nama dan jabatan pengirim wajib diisi. Tekan "Kirim klarifikasi"; '
            + 'kanwil dan pusat diberi tahu otomatis.',
        },
        {
          halaman: ['klarifikasi', 'tindak-lanjut'],
          judul: 'Perbaiki bila dikembalikan',
          isi: 'Klarifikasi yang dikembalikan berstatus "Perlu perbaikan" beserta catatannya. '
            + 'Unggah berkas yang sudah diperbaiki dengan cara yang sama.',
        },
      ],
    },
  },
}

/** Alur beserta langkahnya yang menyangkut sebuah halaman, untuk satu ruang. */
export function alurUntuk(halaman, ruang) {
  const hasil = []
  for (const [id, alur] of Object.entries(ALUR)) {
    const langkah = alur.langkah[ruang] || []
    if (langkah.some((l) => l.halaman.includes(halaman))) hasil.push({ id, ...alur, langkah })
  }
  return hasil
}

/** Ketiga ruang, dengan nama dan keterangannya. */
export const RUANG = {
  pusat: {
    label: 'Ruang Pusat',
    ket: 'Ditpamintel: seluruh peran internal, dari Operator Puldata sampai Pimpinan.',
    butir: PUSAT,
  },
  wilayah: {
    label: 'Ruang Kantor Wilayah',
    ket: 'Administrator Kantor Wilayah: seluruh unit yang dibawahi satu kantor wilayah.',
    butir: WILAYAH,
  },
  unit: {
    label: 'Ruang Unit',
    ket: 'Penelaah Berita UPT: satu unit pelaksana teknis, tanpa unit tetangga.',
    butir: UNIT,
  },
}

/** Nama ruang yang sedang ditempati sebuah peran. */
export function ruangPeran(unit, eksternal) {
  if (unit) return 'unit'
  return eksternal ? 'wilayah' : 'pusat'
}
