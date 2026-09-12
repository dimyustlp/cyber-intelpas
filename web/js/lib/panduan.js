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
    isi: 'Keadaan pemberitaan hari ini dalam satu layar: jumlah publikasi beserta '
      + 'selisihnya terhadap kemarin, sebaran sentimen, kejadian yang menuntut '
      + 'perhatian, unit yang paling banyak disorot, dan bilah kesehatan aliran data '
      + 'di puncak halaman.',
    guna: 'Layar pertama yang dibuka setiap pagi. Setiap angka pada ubin bisa ditekan '
      + 'dan membuka daftar yang menghasilkannya, sehingga tidak ada angka yang harus '
      + 'dicari sendiri asal-usulnya.',
    catatan: 'Bilah kesehatan memisahkan dua hal yang mudah tertukar: penyalinan yang '
      + 'berhasil dan baris baru yang benar-benar datang. Penyalin bisa berhasil setiap '
      + 'lima menit tanpa satu pun berita baru masuk.',
  },
  briefing: {
    isi: 'Situasi nasional sebagai kalimat, bukan tabel: satu pernyataan tingkat risiko '
      + 'di puncak, angka-angka besar yang masing-masing membawa pembanding periode '
      + 'sebelumnya, dan daftar pendek hal yang menuntut keputusan.',
    guna: 'Untuk pimpinan yang punya enam puluh detik, bukan analis yang punya sore hari. '
      + 'Dipakai sebagai bahan bacaan sebelum rapat pimpinan.',
    catatan: 'Tidak ada satu pun angka yang dihitung di halaman ini sendiri; seluruhnya '
      + 'dipinjam dari perhitungan yang sama dengan dasbor, sehingga keduanya tidak '
      + 'pernah berselisih.',
  },
  negatif: {
    isi: 'Seluruh pemberitaan yang merugikan institusi, disusun per PERISTIWA, bukan per '
      + 'publikasi. Delapan berita tentang satu narapidana yang kabur tampil sebagai satu '
      + 'kejadian dengan eksposur delapan.',
    guna: 'Menjawab apa yang sedang merugikan institusi hari ini, dan seberapa keras '
      + 'tekanan opininya. Berdiri sendiri di menu supaya isu merugikan tidak perlu '
      + 'dicari dulu di dalam daftar gabungan.',
    catatan: 'Jumlah peristiwa dan jumlah publikasi adalah dua angka yang berbeda dan '
      + 'keduanya ditampilkan. Yang pertama menentukan berapa banyak yang harus ditangani, '
      + 'yang kedua menentukan seberapa besar gaungnya.',
  },
  positif: {
    isi: 'Pemberitaan yang menguatkan institusi, disusun dengan bentuk yang sama seperti '
      + 'kanal negatif.',
    guna: 'Bahan kehumasan, dan penyeimbang ketika sebuah isu negatif perlu dijawab '
      + 'dengan capaian yang sudah terberitakan di unit yang sama.',
  },
  peringatan: {
    isi: 'Kejadian berurgensi tinggi dan kritis sebagai kartu satu per satu, dengan pita '
      + 'kerawanan di tepi kiri — bukan sebagai tabel.',
    guna: 'Dibaca ketika sesuatu sedang berlangsung. Bentuk kartu dipilih supaya yang '
      + 'terbaca adalah kejadiannya, bukan kolom-kolomnya.',
    catatan: 'Label AWAL berarti belum ditelaah analis; label RESMI berarti sudah '
      + 'diverifikasi. Hanya yang kedua yang boleh menjadi dasar keputusan.',
  },
  peta: {
    isi: 'Seluruh Lapas, Rutan, dan LPKA di Indonesia sebagai titik pada satu peta, '
      + 'diwarnai menurut keadaan pemberitaan masing-masing.',
    guna: 'Menjawab pertanyaan yang tidak bisa dijawab tabel: di mana persoalannya '
      + 'menumpuk. Sepuluh unit rawan yang tersebar dari Aceh sampai Papua dan sepuluh '
      + 'unit rawan di satu provinsi terbaca sama di dalam tabel dan berbeda artinya.',
    catatan: 'Sebagian besar koordinat masih berupa titik pusat kota, bukan alamat '
      + 'gedungnya. Itu dinyatakan di layar dan diperbaiki lewat halaman Koordinat UPT.',
  },
  tren: {
    isi: 'Perbandingan periode berjalan terhadap periode sebelumnya yang panjangnya '
      + 'persis sama: ubin bertumbuh atau menyusut, batang per kategori, dan tabel '
      + 'subkategori yang naik paling tajam.',
    guna: 'Dasbor menjawab keadaan hari ini; halaman ini menjawab apa yang BERUBAH. '
      + 'Dipakai menyusun laporan mingguan dan bulanan.',
    catatan: 'Tidak ada ramalan di sini, dan itu disengaja. Sistem ini mencatat '
      + 'pemberitaan yang sudah terbit.',
  },
  narasi: {
    isi: 'Kumpulan peristiwa yang membentuk satu cerita, tiap cerita satu kartu: '
      + 'bentuknya (menanjak, berulang, bertahan, mereda), sebarannya, pemantiknya, dan '
      + 'ada tidaknya suara penyeimbang.',
    guna: 'Menjawab cerita apa yang sedang berjalan tentang institusi — satu lapis di '
      + 'atas peristiwa. Satu kartu bisa memuat tiga kejadian di tiga unit berbeda, dan '
      + 'memang begitulah publik membacanya.',
    catatan: 'Pemantik disebut sebagai terbitan paling awal yang tercatat, bukan sebagai '
      + 'sumber narasi. Arsip ini hanya memuat yang berhasil ditangkap.',
  },
  jaringan: {
    isi: 'Gambar kaitan antara unit, media, wilayah, tema, dan platform. Tebal garis '
      + 'berarti berapa kali dua hal muncul di publikasi yang sama; besar simpul berarti '
      + 'berapa publikasi menyebutnya.',
    guna: 'Menjawab tiga pertanyaan yang tidak bisa dijawab tabel: media mana yang '
      + 'mengangkat unit ini dan apa lagi yang mereka angkat, tema apa yang muncul di '
      + 'banyak unit sekaligus, dan siapa yang menjembatani dua kelompok.',
    catatan: 'Tidak ada simpul orang di sini, dan tidak akan ada sampai kewenangan '
      + 'pengumpulan data akun perorangan dinyatakan tertulis.',
  },
  komando: {
    isi: 'Enam angka nasional berukuran besar dan daftar peringatan terberat yang diam, '
      + 'beserta waktu penyegaran terakhir.',
    guna: 'Untuk dinding ruang piket — dibaca dari jarak tiga meter oleh orang yang '
      + 'sedang berdiri sambil menerima telepon. Isinya sama dengan dasbor; bentuknya '
      + 'yang berbeda.',
  },
  ruang: {
    isi: 'Empat bagian: yang menuntut hari ini, pantauan milik analis sendiri, temuan '
      + 'aturan peringatan, dan riwayat pendek putusan yang baru saja dibuat.',
    guna: 'Satu-satunya halaman yang menjawab apa yang jadi bagian saya hari ini. '
      + 'Halaman lain menjawab pertanyaan tentang arsip; halaman ini tentang pekerjaan.',
    catatan: 'Pantauan tersimpan di peramban yang sedang dipakai, bukan di basis data. '
      + 'Ia tidak ikut berpindah ke komputer lain dan tidak terbagi ke rekan setim.',
  },
  cari: {
    isi: 'Satu kotak kueri dengan bahasa saringan sendiri. Setiap saringan yang dipasang '
      + 'lewat tombol ikut tertulis ke dalam kotak itu.',
    guna: 'Menjawab pertanyaan yang belum pernah ditanyakan sebelumnya. Karena seluruh '
      + 'saringan tertulis sebagai teks, kuerinya bisa disalin ke rekan lewat pesan, '
      + 'disimpan sebagai pantauan, dan dibaca ulang tiga bulan kemudian.',
    catatan: 'Tidak ada pengubahan status telaah massal di sini. Halaman ini bisa memilih '
      + 'dua ratus baris sekaligus, dan justru karena itu putusannya dibuat di Antrean '
      + 'Telaah, satu per satu, lengkap dengan catatan penelaahnya.',
  },
  aturan: {
    isi: 'Daftar aturan peringatan: bila apa terjadi, kabari siapa. Setiap kali syaratnya '
      + 'diubah, jangkauannya dihitung ulang terhadap arsip yang termuat — sebelum tombol '
      + 'Simpan ditekan.',
    guna: 'Menuliskan pertanyaan tetap sebuah kantor supaya tidak perlu ditanyakan ulang '
      + 'setiap hari.',
    catatan: 'Lima aturan bawaan bisa dimatikan dan ambangnya bisa disunting, tetapi tidak '
      + 'bisa dihapus. Tombolnya karena itu berbunyi Pulihkan, bukan Hapus.',
  },
  berita: {
    isi: 'Tabel seluruh berita dengan enam saringan tetap, kotak cari, dan tombol unduh '
      + 'CSV. Tiap baris bisa dibuka menjadi halaman detailnya sendiri.',
    guna: 'Arsip induk. Dipakai ketika yang dicari sudah diketahui bentuknya — satu unit, '
      + 'satu rentang tanggal, satu status telaah.',
  },
  input: {
    isi: 'Borang satu halaman dengan panel penilaian mesin di sebelah kanan yang berjalan '
      + 'sambil diketik.',
    guna: 'Memasukkan isu viral yang belum tertangkap perayap. Sampai halaman ini ada, '
      + 'berita hanya bisa masuk lewat penyalinan spreadsheet — dan isu yang paling cepat '
      + 'berkembang justru yang paling sering luput dari perayap.',
    catatan: 'Hasilnya tetap berstatus Belum Ditelaah dan tidak langsung menjadi angka. '
      + 'Masukan manual tidak lebih tepercaya daripada hasil mesin hanya karena diketik '
      + 'manusia.',
  },
  telaah: {
    isi: 'Antrean satu berita per layar, lengkap dengan alasan mesin: kata kunci penentu, '
      + 'skor keyakinan, dan pesaing terdekatnya. Analis menyetujui atau mengoreksi, lalu '
      + 'lanjut ke berita berikutnya.',
    guna: 'Tempat penilaian mesin menjadi penilaian resmi. Tanpa halaman ini, hasil '
      + 'berkeyakinan 0,20 dan 0,95 sama-sama masuk laporan tanpa pernah dibaca manusia.',
    catatan: 'Bentuk antrean dipilih, bukan tabel. Tabel dua puluh baris mengundang orang '
      + 'mencentang semuanya sekaligus; satu berita yang memenuhi layar menuntut ia dibaca '
      + 'lebih dulu.',
  },
  pemetaan: {
    isi: 'Berita yang unitnya belum dikenali, beserta kandidat unit sebagai tombol — hasil '
      + 'mesin pencocokan yang dijalankan ulang di peramban. Ada pula pencarian bebas ke '
      + 'seluruh unit pada data induk.',
    guna: 'Memutuskan unit mana yang dimaksud sebuah berita ketika skor mesin di bawah '
      + 'ambang otomatis. Berita yang tidak terpetakan tidak pernah muncul di peta, di '
      + 'daftar unit, maupun di lembar wilayah.',
  },
  sinkronisasi: {
    isi: 'Keadaan tiap sumber data: kapan terakhir ditarik, berapa baris yang datang, dan '
      + 'sebab kegagalan bila ada. Sumber pusat dan sumber tiap kantor wilayah dilaporkan '
      + 'terpisah.',
    guna: 'Menjawab kenapa hari ini sepi. Kosongnya data lebih sering berarti penarikan '
      + 'terhenti daripada berarti tidak ada berita.',
    catatan: 'Tidak ada tombol tarik sekarang di halaman ini, dan itu disengaja: '
      + 'menariknya menuntut token yang tidak boleh berada di peramban. Penjadwal di '
      + 'basis data sudah menariknya sendiri.',
  },
  kasus: {
    isi: 'Perkara intelijen: beberapa publikasi dan peristiwa yang diikat menjadi satu '
      + 'berkas dengan riwayat penanganannya.',
    guna: 'Tempat pemberitaan berhenti menjadi daftar dan mulai menjadi perkara. '
      + 'Menjawab sudah sampai mana penanganan sebuah perkara — pertanyaan yang tidak '
      + 'punya tempat untuk dijawab di dalam tabel berita.',
  },
  lapangan: {
    isi: 'Satu daftar penugasan dipandang dari dua sisi: analis menerbitkan surat tugas, '
      + 'petugas lapangan mengisi laporan dan mengunggah bukti.',
    guna: 'Menyandingkan apa yang ditulis media dengan apa yang benar-benar ada di lokasi.',
    catatan: 'Laporan lapangan tidak pernah mengubah status berita. Unit yang menyatakan '
      + 'berita tentang dirinya keliru tidak bisa membuat berita itu hilang dari angka '
      + 'nasional; yang berhak menyatakan sebuah berita tidak valid adalah analis pusat.',
  },
  evaluasi: {
    isi: 'Matriks penyandingan sebagai baris — apa kata media, apa kata lapangan, cocok '
      + 'atau tidak — lalu rekomendasi sebagai butir-butir tersendiri.',
    guna: 'Mempertemukan dua sumber yang saling bertentangan. Yang bernilai justru '
      + 'selisihnya: unit yang diberitakan kehilangan sepuluh warga binaan dan ternyata '
      + 'kehilangan tiga menghadapi kabar yang benar dengan angka yang salah, dan itu '
      + 'ditangani dengan cara yang sama sekali berbeda dari kabar bohong.',
    catatan: 'Analisis yang sudah diverifikasi tidak bisa disunting lagi. Yang perlu '
      + 'diubah dibuat sebagai versi baru, dan keduanya tetap terbaca.',
  },
  keputusan: {
    isi: 'Analisis beserta rekomendasinya, dan kotak centang pada tiap rekomendasi. Tidak '
      + 'ada penyuntingan apa pun di layar ini.',
    guna: 'Ruang tersempit di seluruh sistem, dan itu disengaja: pimpinan membaca lalu '
      + 'memutuskan. Menyetujui dua dari empat rekomendasi adalah putusan yang sah dan '
      + 'sering terjadi.',
    catatan: 'Putusan tidak bisa dicabut. Yang keliru dikoreksi dengan putusan baru, dan '
      + 'keduanya tetap terbaca berdampingan.',
  },
  tindak: {
    isi: 'Butir pekerjaan turunan putusan pimpinan, beserta pelaksana, tenggat, dan '
      + 'kemajuannya. Yang lewat tenggat diangkat ke kelompoknya sendiri di puncak halaman.',
    guna: 'Menjawab apa yang diputuskan tiga minggu lalu sudah dikerjakan atau belum — '
      + 'pertanyaan yang sebelumnya hanya bisa dijawab dengan menelepon.',
    catatan: 'Kemajuan diisi pelaksananya, bukan dihitung sistem.',
  },
  laporan: {
    isi: 'Penyusun laporan intelijen berkala. Pilih periodenya, tekan satu tombol, dan '
      + 'berkasnya jadi lengkap dengan diagram serta daftar sumbernya — siap dicetak atau '
      + 'disimpan sebagai PDF lewat menu cetak peramban.',
    guna: 'Ekspor mandiri, tanpa menunggu siapa pun menjalankan perintah di belakang layar. '
      + 'Isinya pemberitaan negatif: daftar hal yang menuntut tindakan.',
    catatan: 'Satu hari laporan berarti pukul 00.00 sampai 23.59 WIB, sama persis dengan '
      + 'jendela yang dipakai laporan harian Telegram.',
  },
  infografis: {
    isi: 'Satu lembar gambar untuk laporan harian atau mingguan, memuat sisi baik dan sisi '
      + 'buruk sekaligus. Yang tampil di layar, yang diunduh sebagai PNG, dan yang tercetak '
      + 'adalah gambar yang sama persis.',
    guna: 'Untuk pembaca yang tidak sedang menangani apa pun — pimpinan, kehumasan, kantor '
      + 'wilayah — dan harus bisa dibaca dalam satu menit. Lembar yang hanya memuat kabar '
      + 'buruk berhenti dibaca setelah pekan ketiga.',
    catatan: 'Seluruhnya digambar di dalam peramban. Tidak ada satu bita pun nama unit atau '
      + 'judul berita yang dikirim ke peladen mana pun untuk dirender.',
  },
  distribusi: {
    isi: 'Pratinjau pesan dan lampiran yang akan dikirim, daftar grup yang akan menerima, '
      + 'tombol kirim, dan riwayat seluruh pengiriman beserta sebab kegagalannya.',
    guna: 'Tempat laporan dan peringatan benar-benar berangkat ke grup Telegram.',
    catatan: 'Tidak ada pengiriman tanpa pratinjau, tanpa tujuan yang disebutkan, dan tanpa '
      + 'catatan. Ketiganya adalah jawaban atas cacat sistem lama yang pernah mengirim dua '
      + 'berita yang tidak pernah terjadi.',
  },
  pengguna: {
    isi: 'Penerbitan akun beserta perannya, dan daftar akun yang sudah ada.',
    guna: 'Menerbitkan akun untuk petugas baru. Superadmin menerbitkan peran apa pun; '
      + 'Administrator Kantor Wilayah hanya Penelaah Berita UPT di wilayahnya sendiri.',
    catatan: 'Akun kantor wilayah wajib memakai alamat surel sebagai nama pengguna. Petugas '
      + 'wilayah berganti orang, dan alamat surat dinas adalah satu-satunya penanda yang '
      + 'masih bisa ditelusuri kemudian.',
  },
  koordinat: {
    isi: 'Satu unit pada satu waktu, dengan pratinjau titiknya di atas peta yang sama '
      + 'dengan Peta Sebaran, dan kolom untuk membetulkan atau membenarkan koordinatnya.',
    guna: 'Memperbaiki titik yang masih berupa pusat kota. Pratinjaunya cukup untuk '
      + 'menangkap kelas kesalahan yang paling sering: bujur dan lintang tertukar, atau '
      + 'tanda minus hilang.',
  },
  integrasi: {
    isi: 'Pemeriksaan sambungan Telegram: empat langkah penyiapan dengan tanda sudah atau '
      + 'belum, dan kalimat yang menyebutkan persis apa yang salah pada kunci tersimpan.',
    guna: 'Menyelesaikan penyiapan bot Telegram tanpa perlu membuka baris perintah. '
      + 'Sebelumnya penyiapan bisa macet berhari-hari tanpa satu pun layar yang bisa '
      + 'menjelaskan sebabnya.',
    catatan: 'Tidak ada kolom isian kunci di halaman ini, dan tidak boleh pernah ada. '
      + 'Kunci bot tidak pernah melewati peramban; yang terlihat di sini hanya hasil '
      + 'pemeriksaannya.',
  },
  audit: {
    isi: 'Riwayat tindakan pengguna, hanya bisa dibaca. Yang mengubah keadaan tampil lebih '
      + 'dulu; pembacaan halaman disembunyikan di balik sakelar.',
    guna: 'Menelusuri siapa melakukan apa dan kapan.',
    catatan: 'Tidak ada tombol sunting dan tidak ada tombol hapus, sebab basis data memang '
      + 'tidak menyediakan jalannya. Jejak yang bisa dihapus oleh yang meninggalkannya '
      + 'bukan jejak.',
  },
  kesehatan: {
    isi: 'Keadaan tiap komponen yang bekerja di belakang layar: penyalin sumber, perayap, '
      + 'penjadwal laporan, dan pengiriman Telegram — masing-masing dinilai dari WAKTU '
      + 'kegiatan terakhirnya, dengan ambang diamnya tertulis di layar.',
    guna: 'Menjawab apakah sistemnya masih bekerja. Ketiganya bisa berhenti tanpa satu pun '
      + 'galat muncul di layar siapa pun, dan itulah kelas kegagalan yang paling lama tidak '
      + 'ketahuan.',
  },
}

/* ------------------------------------------------------------- ruang wilayah */

const WILAYAH = {
  'kanwil-dasbor': {
    isi: 'Empat ubin di puncak — berita wilayah, yang perlu respons segera, yang menunggu '
      + 'telaah Anda, dan yang menunggu telaah pusat — lalu empat belas hari terakhir '
      + 'sebagai grafik, keseimbangan pemberitaan, unit yang paling banyak disorot, dan '
      + 'sebaran urgensi. Di bawahnya: berita negatif yang belum ditanggapi unit, yang '
      + 'mendesak, dan kiriman Anda sendiri.',
    guna: 'Layar pertama Administrator Kantor Wilayah. Menjawab keadaan pemberitaan '
      + 'seluruh unit di wilayah ini hari ini, dan apa yang menunggu dikerjakan.',
    catatan: 'Seluruh angkanya hanya mencakup wilayah ini. Batas itu ditegakkan basis data, '
      + 'bukan oleh saringan di layar: baris unit wilayah lain tidak pernah sampai ke '
      + 'peramban sejak awal. Tidak ada satu pun angka nasional di ruang ini.',
  },
  input: {
    isi: 'Borang satu halaman dengan panel penilaian mesin di sebelah kanan yang berjalan '
      + 'sambil diketik, dan kop yang menyebutkan wilayah mana yang akan tercatat pada '
      + 'kiriman ini.',
    guna: 'Satu-satunya pintu masuk berita dari daerah. Dipakai untuk berita tentang unit '
      + 'di wilayah ini yang belum tertangkap perayap maupun spreadsheet.',
    catatan: 'Hanya Administrator Kantor Wilayah yang memasukkan berita — bukan karena '
      + 'penelaah tidak dipercaya, melainkan supaya setiap kiriman punya satu orang yang '
      + 'bisa ditanya ketika ia keliru.',
  },
  'wilayah-telaah': {
    isi: 'Antrean berita wilayah satu per satu, lengkap dengan alasan mesin, dan kolom '
      + 'untuk menyetujui atau merevisi kategori, sentimen, serta urgensinya beserta '
      + 'alasan revisinya.',
    guna: 'Justru kantor wilayah dan unitnya yang paling tahu apakah sebuah kabar benar '
      + 'menyangkut unit itu. Revisinya tercatat lengkap dengan nama penelaahnya.',
    catatan: 'Putusan di sini TIDAK menyentuh status verifikasi pusat. Kolom itu milik '
      + 'analis pusat dan menentukan sebuah berita ikut dihitung atau tidak; bila daerah '
      + 'boleh mengisinya, sebuah unit dapat menyatakan berita tentang dirinya sendiri '
      + 'tidak valid dan berita itu lenyap dari angka nasional tanpa pernah dibaca analis.',
  },
  'wilayah-berita': {
    isi: 'Tabel seluruh berita yang menyangkut unit di wilayah ini, dengan saringan dan '
      + 'kotak cari yang sama seperti Pusat Data Berita.',
    guna: 'Arsip wilayah. Dipakai menelusuri riwayat pemberitaan satu unit, satu rentang '
      + 'tanggal, atau satu status telaah.',
    catatan: 'Putusan telaah daerah dan status verifikasi pusat terbaca berdampingan di '
      + 'sini, sehingga keduanya tidak pernah tertukar.',
  },
  'wilayah-unit': {
    isi: 'SELURUH unit yang dibawahi wilayah ini, diambil dari data induk — bukan sepuluh '
      + 'teratas, dan bukan hanya yang pernah diberitakan.',
    guna: 'Kantor wilayah bertanggung jawab atas setiap unitnya, termasuk dan terutama yang '
      + 'tidak pernah muncul di daftar mana pun. Unit yang tidak pernah diberitakan bukan '
      + 'unit yang tidak ada.',
  },
  pengguna: {
    isi: 'Penerbitan akun Penelaah Berita UPT untuk unit di wilayah ini, dan daftar akun '
      + 'yang sudah diterbitkan.',
    guna: 'Memberi tiap unit satu akun untuk menelaah dan menanggapi berita tentang '
      + 'dirinya sendiri.',
    catatan: 'Hanya peran Penelaah Berita UPT yang bisa diterbitkan dari sini, dan hanya '
      + 'untuk unit di wilayah sendiri. Batas itu ditegakkan peladen, bukan oleh pilihan '
      + 'yang disembunyikan di borang.',
  },
}

/* ---------------------------------------------------------------- ruang unit */

const UNIT = {
  'upt-dasbor': {
    isi: 'Empat ubin di puncak — berita unit ini, yang perlu respons segera, yang menunggu '
      + 'telaah Anda, dan yang belum ditanggapi — lalu empat belas hari terakhir sebagai '
      + 'grafik dan keseimbangan pemberitaan. Di bawahnya: sikap unit yang sudah dinyatakan, '
      + 'dan yang menunggu tanggapan Anda.',
    guna: 'Layar pertama Penelaah Berita UPT. Menjawab apa yang sedang diberitakan tentang '
      + 'unit ini, dan apa yang belum dijawab.',
    catatan: 'Cakupannya satu unit. Berita unit tetangga tidak pernah sampai ke layar ini, '
      + 'dan daftar unit lain memang bukan urusan peran ini.',
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
    guna: 'Arsip unit. Dipakai menelusuri riwayat pemberitaan unit ini dan melihat mana '
      + 'yang sudah ditanggapi.',
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
  'berita-detail': {
    isi: 'Satu berita utuh beserta dasar penilaiannya: kata kunci penentu, skor mesin, '
      + 'catatan telaah analis, dan tanggapan unit bila sudah ada.',
    guna: 'Menjawab pertanyaan yang paling sering ditanyakan dan paling sulit dijawab: '
      + 'kenapa berita ini dinilai begitu. Dibuka dari Pusat Data Berita dan dari palet '
      + 'perintah.',
    catatan: 'Halaman ini hanya untuk peran pusat, sebab ia menampilkan catatan analis '
      + 'pusat. Membukanya bagi daerah berarti melepas catatan itu ke wilayah.',
  },
  profil: {
    isi: 'Nama, nama pengguna, dan kata sandi milik sendiri.',
    guna: 'Setiap peran berhak menyunting identitasnya sendiri, terlepas dari kewenangan '
      + 'apa pun yang ia punya atas data lain.',
  },
  panduan: {
    isi: 'Halaman yang sedang Anda baca: penjelasan tiap fitur menurut ruangnya, manual '
      + 'mengirim berita, dan aturan jendela pelaporan harian.',
    guna: 'Dibuka petugas baru pada hari pertama, dan dibuka siapa pun yang lupa sebuah '
      + 'layar untuk apa. Tersedia bagi seluruh peran.',
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
      + 'Borangnya sama persis, dan mesin yang menilainya juga sama.',
  },
  {
    judul: 'Periksa kop wilayah sebelum mengetik apa pun',
    isi: 'Di puncak borang tertulis wilayah mana yang akan tercatat pada kiriman ini. '
      + 'Bila yang tertulis justru "Wilayah pada akun Anda belum ditetapkan", berhenti di '
      + 'sini dan hubungi administrator: basis data akan menolak kiriman tanpa asal '
      + 'wilayah, dan penolakan itu baru muncul setelah seluruh borang terisi.',
  },
  {
    judul: 'Tempelkan tautan beritanya',
    isi: 'Kolom wajib. Tempelkan alamat lengkapnya; penanda iklan di ekor alamat dibuang '
      + 'otomatis sebelum disimpan. Di bawah kolom tertulis sumber yang berhasil dibaca '
      + 'dari alamat itu — periksa sekilas, sebab alamat yang terpotong saat disalin '
      + 'biasanya ketahuan di baris ini.',
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
      + 'terbit yang dikosongkan membuat berita ini tercatat tanpa tanggal terbit — ia '
      + 'tetap masuk laporan, sebab yang menentukan hari laporan adalah waktu berita ini '
      + 'DITANGKAP, bukan tanggal terbitnya.',
  },
  {
    judul: 'Tentukan unitnya',
    isi: 'Ketik nama unit dan daftar unit akan membantu melengkapinya. Mesin pencocokan '
      + 'juga membaca judul serta ringkasan dan menawarkan saran beserta tingkat '
      + 'keyakinannya — tekan "Pakai saran ini" bila benar. Kosongkan bila unitnya memang '
      + 'belum jelas; jangan menebak. Berita tanpa unit bisa dipetakan kemudian, sedangkan '
      + 'berita yang salah unit akan terbaca sebagai persoalan unit yang tidak melakukan '
      + 'apa pun.',
  },
  {
    judul: 'Tulis ringkasan isinya',
    isi: 'Apa yang terjadi, di mana, dan siapa yang terlibat. Inilah kolom yang paling '
      + 'menentukan ketepatan mesin: makin lengkap ringkasannya, makin tepat kategori, '
      + 'sentimen, dan urgensi yang diusulkannya. Satu kalimat sudah cukup untuk disimpan, '
      + 'tetapi belum tentu cukup untuk dinilai dengan benar.',
  },
  {
    judul: 'Tambahkan catatan petugas bila perlu',
    isi: 'Konteks yang tidak ada di dalam beritanya sendiri — misalnya bahwa ini unggahan '
      + 'pertama yang memicu isu, atau bahwa akun penyebarnya bukan media. Catatan ini '
      + 'tidak dibaca mesin; ia dibaca penelaah.',
  },
  {
    judul: 'Baca panel penilaian mesin di sebelah kanan',
    isi: 'Panel ini muncul sendiri sekitar setengah detik setelah Anda berhenti mengetik. '
      + 'Isinya kategori, subkategori, sentimen, urgensi, persen keyakinan, kata kunci '
      + 'penentu, dan alasan ringkas. Keyakinan di bawah ambang ditandai dengan peringatan '
      + 'kuning — itu bukan larangan menyimpan, melainkan permintaan untuk memeriksa.',
  },
  {
    judul: 'Betulkan penilaian yang keliru, sekarang juga',
    isi: 'Subkategori, sentimen, dan urgensi di bawah panel masih bisa diubah. Membetulkan '
      + 'di sini jauh lebih murah daripada membiarkannya lalu memperbaikinya di antrean '
      + 'telaah. Bila mesin menilai berita ini "Di Luar Lingkup", ia tetap bisa disimpan — '
      + 'tetapi tidak akan ikut menjadi angka di dasbor mana pun.',
  },
  {
    judul: 'Tekan Simpan berita',
    isi: 'Sebelum menyimpan, sistem memeriksa apakah tautan itu sudah pernah masuk. Bila '
      + 'sudah, yang muncul adalah judul kiriman yang lebih dulu ada, dan tidak ada baris '
      + 'baru yang dibuat. Itu bukan kegagalan; itu berarti beritanya sudah tercatat.',
  },
  {
    judul: 'Ikuti kirimannya sampai ke antrean telaah',
    isi: 'Berita tersimpan dengan status Belum Ditelaah dan belum menjadi angka di laporan '
      + 'mana pun. Tombol "Buka antrean telaah" membawa Anda langsung ke barisnya. Ia ikut '
      + 'dihitung setelah penelaah menyetujui penilaiannya.',
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
      isi: 'Batasnya pukul 00.00 sampai 23.59 WIB, bukan pukul 07.00 sampai 07.00 dan '
        + 'bukan hari menurut UTC. Aturan ini berlaku sama untuk laporan Telegram dan '
        + 'untuk ekspor mandiri lewat halaman Laporan Berkala serta Lembar Infografis.',
    },
    {
      judul: 'Yang menentukan hari adalah waktu TANGKAP, bukan tanggal terbit',
      isi: 'Sebuah berita yang terbit pekan lalu dan baru tertangkap tadi malam tetap '
        + 'kabar baru bagi yang membaca laporan pagi ini. Memotongnya menurut tanggal '
        + 'terbit membuatnya tidak pernah muncul di laporan mana pun. Tanggal terbitnya '
        + 'tidak hilang — ia tetap tercetak pada tiap baris laporan.',
    },
    {
      judul: 'Laporan harian terkirim pukul 05.30 WIB keesokan harinya',
      isi: 'Berkas PDF beserta pesan ringkasnya dikirim ke grup Telegram pimpinan. Yang '
        + 'dilaporkan adalah hari sebelumnya secara utuh, sehingga laporan yang terbit '
        + 'pagi ini tidak pernah memuat berita pagi ini.',
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

/** Ketiga ruang, dengan nama dan keterangannya. */
export const RUANG = {
  pusat: {
    label: 'Ruang Pusat',
    ket: 'Ditpamintel — seluruh peran internal, dari Operator Puldata sampai Pimpinan.',
    butir: PUSAT,
  },
  wilayah: {
    label: 'Ruang Kantor Wilayah',
    ket: 'Administrator Kantor Wilayah — seluruh unit yang dibawahi satu kantor wilayah.',
    butir: WILAYAH,
  },
  unit: {
    label: 'Ruang Unit',
    ket: 'Penelaah Berita UPT — satu unit pelaksana teknis, tanpa unit tetangga.',
    butir: UNIT,
  },
}

/** Nama ruang yang sedang ditempati sebuah peran. */
export function ruangPeran(unit, eksternal) {
  if (unit) return 'unit'
  return eksternal ? 'wilayah' : 'pusat'
}
