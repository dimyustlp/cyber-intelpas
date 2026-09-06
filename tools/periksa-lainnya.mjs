/**
 * Pemeriksa kasus yang jatuh ke "Lainnya".
 *
 * Dijalankan atas contoh sungguhan yang diambil dari arsip, bukan atas kalimat
 * yang dikarang untuk lulus. Kolom `media` ikut disertakan apa adanya, sebab
 * sejak mesin versi 4 penerbit adalah salah satu keterangan yang dibaca — dan
 * menguji tanpa penerbit berarti menguji mesin yang berbeda dari yang berjalan.
 *
 * Untuk tiap kasus yang meleset dicetak: kategori yang keluar, skor juara, dan
 * tiga pesaing teratas beserta skornya. Yang perlu diketahui bukan sekadar
 * "kenapa salah", melainkan "seberapa jauh dari benar".
 *
 * node tools/periksa-lainnya.mjs
 */

import { klasifikasikan } from '../web/js/lib/klasifikasi.js'
import { KATEGORI } from '../web/js/lib/taksonomi.js'

const MEDSOS = 'Radar Medsos (Social Dorking)'

/**
 * [kode yang diharapkan, media, judul, ringkasan]
 *
 * Tanda bintang pada kode berarti kategori induknya sudah cukup — untuk
 * unggahan kehumasan, membedakan 8.2 dari 8.4 bukan perbedaan yang mengubah
 * satu keputusan pun.
 */
const KASUS = [
  // ---------------------------------------------------- unggahan humas UPT
  ['8.*', MEDSOS, 'Tennis Meja bersama Kalapas #lapaskelas1bandarlampung', ''],
  ['8.*', 'YouTube [Lapas Narkotika Pekanbaru]', 'Kunjungan lapas narkoba sie sosial gereja katolik st.Paulus labuhbaru Pekanbaru 14 Agustus 2026', ''],
  ['8.*', MEDSOS, 'POV: Masa iya Warga Binaan Lapas Kelas I Bandar Lampung hanya Rebahan Aja? #lapaskelas1bandarlampung #kemenimipas', ''],
  ['8.*', 'YouTube [Humas Lapas Pasir Pangarayan]', '81 Tahun Indonesia Berdiri Tegak: Pengabdian dari Lapas Pasir Pangarayan', ''],
  ['8.*', MEDSOS, 'PEMASYARAKATAN UNTUK INDONESIA!!! #ditjenpas', ''],
  ['8.*', MEDSOS, '1 HARI 1 FAKTA PEMASYARAKATAN Tahukah SobatN SOE? Setiap hari ada banyak hal menarik tentang Pemasyarakatan yang mungkin belum kita ketahui', ''],
  ['8.*', MEDSOS, 'A little walk around Lapas Perempuan Bandung. Ada yang baru dibuat, ada tempat untuk bergerak, ada ruang untuk belajar, dan ada karya yang dibuat dengan tangan warga binaan', ''],
  ['8.*', MEDSOS, 'SEPEKAN KANWIL DITJENPAS RIAU 3-9 Agustus 2026 Satu pekan, beragam kegiatan, satu semangat: memberikan pengabdian terbaik untuk Pemasyarakatan', ''],
  ['8.7', 'YouTube [Lembaga Pemasyarakatan Kelas III Suliki]', 'Pembagian Vitamin WBP Lapas Suliki, Senin (10/08).', ''],
  ['8.*', MEDSOS, 'KONTROL MALAM RUTAN BANJARNEGARA Dalam rangka memastikan keamanan dan ketertiban tetap terjaga, Kepala Rutan Banjarnegara melaksanakan kontrol malam', ''],
  ['8.2', MEDSOS, 'Warga Binaan Kristiani Lapas Banjarmasin Ikuti Ibadah Rutin Online Bersama Sungai Kehidupan Ministry', ''],
  ['8.2', MEDSOS, 'Ibadah Minggu pagi di Lapas Kelas IIB Serui bersama Jemaat Gereja Imanuel Serui Kota, diikuti WBP dan keluarga WBP', ''],
  ['8.*', MEDSOS, 'Siaga sebelum bahaya datang! Rutan Kelas I Pekanbaru mengikuti sosialisasi dan praktik penggunaan APAR bersama Damkar Kota', ''],
  ['8.*', 'Google News', 'Rumah Tahanan Negara Rutan Kelas IIB Gresik menggelar Sidang Tim Pengamat Pemasyarakatan TPP', ''],
  ['8.4', MEDSOS, 'Keluarga Besar Rutan Kelas I Pekanbaru Mengucapkan Selamat Hari Jadi Provinsi Riau ke-69th', ''],
  ['8.*', MEDSOS, 'Lapas Kelas IIB Serui mendukung Pendataan Sensus Ekonomi 2026 bagi warga binaan', ''],
  ['8.*', 'Google News', 'Dorong Warga Binaan Lebih Produktif, Kakanwil Ditjenpas Jateng Dampingi Dirjenpas Tinjau Program Unggulan Lapas Purwokerto', ''],
  ['8.3', 'Google News', 'Pemerintah Kabupaten Batang Hari terus menunjukkan komitmennya dalam memperhatikan kesejahteraan seluruh lapisan masyarakat, termasuk keluarga warga binaan', ''],
  ['8.*', MEDSOS, 'Hari ini pre karantina Miss Grand Indonesia day 3 berkunjung ke lapas perempuan kelas II Cipinang Jakarta Timur', ''],
  ['8.6', 'YouTube [Lapas Kelas I Surabaya]', 'Karya Dari Balik Lapas', ''],
  ['8.*', MEDSOS, 'Klik, Follow, dan Dukung Media Sosial Lapas Sungailiat #lapassungailiat #humaslapsuli', ''],
  ['8.*', MEDSOS, 'Sahabat Pemasyarakatan, Direktur Jenderal Pemasyarakatan, Mashudi, baru-baru ini mengunjungi Lapas Kelas IIA Purwokerto dan Bapas Kelas II Purwokerto', ''],
  ['8.*', MEDSOS, 'Tak semua penantian berakhir hari ini. Setiap pertemuan adalah pengingat, bahwa selalu ada yang setia menunggu hingga waktu mengizinkan pulang #lapas #pemasyarakatan', ''],
  ['8.5', MEDSOS, 'Rutan Kelas I Pekanbaru menggelar apel siaga dan pengecekan blok hunian bersama seluruh regu pengamanan', ''],

  // ------------------------------------------------- isu yang belum tertangkap
  ['4.2', 'Google News', 'Kapasitas 71 Orang, Rutan Negara Kini Dihuni 213 Warga Binaan', ''],
  ['4.2', 'YouTube [Kompas TV]', 'Napi di Lapas Rawan Hipertensi dan Gula Darah', ''],
  ['2.1', 'tvrikalimantantimur (instagram)', 'BNNP KALTIM UNGKAP PEREDARAN SABU 1 KILOGRAM DARI DALAM LAPAS', ''],
  ['8.5', 'Google News', 'Kepala Rutan Kelas I Salemba Jakarta Pusat, Wahyu Trah Utomo, mengatakan dari hasil penggeledahan petugas menemukan satu bungkus plastik hitam', ''],
  ['3.*', 'Google News', 'Tembak Pencuri Durian, Pegawai Lapas Lubuklinggau Diperiksa', 'Pegawai Lapas Lubuklinggau menembak pria yang kepergok mencuri durian. Meski sudah berdamai, ia tetap diperiksa'],
  ['4.2', 'Google News', 'Pengacara Bripka YML meluapkan kemarahannya di Lapas Kelas III Kotapinang', 'Ia memprotes lambannya proses pembebasan kliennya'],
  ['7.1', 'Google News', 'Kantor Wilayah Direktorat Jenderal Pemasyarakatan DKI Jakarta memberikan penjelasan mengenai tudingan adanya intimidasi terhadap keluarga warga binaan', ''],
  ['8.*', 'Google News', 'Progres pembangunan Rutan Solo di Karanganyar telah mencapai sekitar 95 persen. Bangunan utama, menara pengawas, pagar pengaman sudah tampak berdiri', ''],
  ['8.5', 'Google News', 'Kejari Kota Cirebon Eksekusi Dua Terpidana Korupsi Aset PD Pembangunan ke Rutan Bandung', ''],
  ['4.2', 'Tribunjogja.com', 'Ini Proses Penganggaran Makanan Warga Binaan di Lapas atau Rutan', ''],

  // -------------------------------------------------------- memang di luar
  ['9.2', 'YouTube [Free Fire Janta Party]', 'Garina Hamara Purana Pick Bapas karo shorts gaming freefire trending viralshorts freefireindia', ''],
  ['9.2', 'YouTube [Minzi Khan]', 'Lapas waterfall Barot Valley', ''],
  ['9.1', 'Google News', 'Alasan Didik Putra Kuncoro Ditahan di Brimob, Bukan Rutan: Pertimbangan Keamanan', ''],

  // ----- dibuang sebagai "konten tidak relevan" padahal terbitan resmi UPT
  // Judul-judul ini tidak menyebut nama unit sama sekali. Yang menyebutnya
  // adalah kanal yang menerbitkannya, dan itu sudah cukup.
  ['8.*', 'YouTube [lapaskendal]', 'Sehat Bersama, Peduli Bersama', ''],
  ['8.*', 'YouTube [Lapas Wonogiri]', 'PASTI BANGKIT', ''],
  ['8.*', 'YouTube [lapaskendal]', 'Semangat kemerdekaan, semangat berbagi', ''],
  ['8.5', 'YouTube [Lapas Satu Bandar Lampung]', 'Daily Inspection, Minggu 16 Agustus 2026', ''],
  ['8.5', 'YouTube [Lapas Satu Bandar Lampung]', 'Daily Pengamanan, Monitoring Papan Kontrol Blok Hunian', ''],
  ['8.6', 'YouTube [Lapas Satu Bandar Lampung]', 'Daily Kegiatan Kerja, Peregangan Sebelum Membuat Sabun', ''],
  ['8.*', 'YouTube [Lapas Satu Bandar Lampung]', 'Di sini ada Tempat Cukur Rambut?', ''],
  ['8.*', 'YouTube [Lapas Satu Bandar Lampung]', 'Jurnal Sepekan 17 Agustus s.d. 22 Agustus', ''],
  ['8.7', 'YouTube [Lapas Satu Bandar Lampung]', 'Klinik Passai: Etika Batuk Yang Benar', ''],
  ['8.4', 'YouTube [Lapas Satu Bandar Lampung]', 'Pelepasan dan Perpisahan 3 Pejabat Struktural', ''],
  ['8.7', 'YouTube [Humaslapadalangkat]', 'VIDEO PENGOBATAN GRATIS DAN PEMBAGIAN BANSOS', ''],
  ['8.4', 'YouTube [LAPAS KELAS IIB MARABAHAN]', 'Semarak HUT ke-81 Kemerdekaan Republik Indonesia', ''],
  ['8.5', 'Radar Medsos (Social Dorking)', 'Bergerak Sigap, Jaga Stabilitas: Deteksi Dini di Blok Bravo! Sebagai upaya pencegahan dan deteksi dini #rutanbanjarnegara', ''],
  ['8.*', 'Medsos Radar', 'Reel by Lapas Kelas I Surabaya (@lapassurabaya) August 10, 2026', ''],
  ['8.*', 'Radar Medsos (Social Dorking)', 'Photos by Rutan Kelas 1 Jakarta Pusat (@rutan_salemba) August 7, 2026', ''],

  // ----- yang memang harus tetap dibuang
  ['9.2', 'YouTube [SONY FAN Sisters]', 'Baalveer rutan moment of vivan Fany moment injoy da video to please subscribe to my channel', ''],
  ['9.2', 'YouTube [Tanishksaini04]', 'Nattu Kaka Bapas Aa Rhe Hai shorts tmkoc viral aaryankelvin', ''],
  ['9.2', 'YouTube [Sofi Castillo]', 'Las Lapas alla a lo lejos', ''],
  ['9.2', 'YouTube [Chintu Meena]', 'rwa me bapas aayi madam jiii arushi madam sscwithchintu rwa rojgarwithankit', ''],

  // ------------------------------- penjagaan: yang sudah benar harus tetap benar
  ['1.1', 'Radar Sukabumi', 'Tiga Narapidana Kabur dari Lapas Kelas IIB Warungkiara Saat Program Asimilasi', ''],
  ['1.2', 'Banten Pos', 'Kerusuhan Pecah di Lapas Kelas IIA Cilegon, Puluhan Warga Binaan Dievakuasi', ''],
  ['3.2', 'Waspada Online', 'Oknum Sipir Rutan Kelas I Medan Ditangkap BNN Kedapatan Bawa Sabu 1,2 Kilogram', ''],
  ['5.2', 'Suara Merdeka', 'Napiter di Lapas Kelas I Semarang Tolak Ikuti Upacara dan Ikrar Setia NKRI', ''],
  ['7.1', 'Fakta Berita', 'Bukan Kabur, Rutan Muntok Sebut Yudi Widyansa Sedang Jalani Program Asimilasi', ''],
  ['8.1', 'Pikiran Rakyat', 'Sebanyak 20.500 Warga Binaan di Jawa Barat Terima Remisi HUT ke-81 RI', ''],

  /* ==========================================================================
     Cakupan subkategori — ditambahkan 6 September 2026
     ==========================================================================
     Sampai hari ini berkas ini menguji 14 dari 28 subkategori, dan enam belas
     sisanya tidak punya satu pun kasus. Yang tidak diuji bukan yang jarang
     terjadi, melainkan justru yang paling berat akibatnya bila salah dinilai:
     kematian tidak wajar, kekerasan oleh petugas, pungli, korupsi, dan
     penyelundupan. Angka "benar 57 dari 62" yang tercetak di layar selama ini
     diukur atas kurang dari separuh taksonomi, dan tidak ada satu baris pun
     yang mengatakannya.
     ========================================================================== */

  // --------------------------------------------- 1.3 Kekerasan Antar WBP
  ['1.3', 'Radar Bali', 'Dua Warga Binaan Lapas Kelas IIA Kerobokan Terlibat Perkelahian di Blok Hunian', ''],
  ['1.3', 'Riau Pos', 'Seorang Napi Rutan Kelas IIB Bangkinang Ditusuk Sesama Penghuni', ''],

  // ------------------------------------- 2.2 Kejahatan Siber dan HP Ilegal
  ['2.2', 'Detik', 'Polisi Ungkap Sindikat Love Scamming yang Dikendalikan Napi dari Dalam Lapas Kelas I Makassar', ''],
  ['2.2', 'Tribun Jateng', 'Napi Lapas Kelas IIA Kedungpane Kedapatan Main HP di Dalam Sel', ''],

  // ----------------------------------------------- 2.3 Fasilitas Mewah
  ['2.3', 'Tempo', 'Terpidana Korupsi Diduga Tempati Sel Mewah Ber-AC di Lapas Kelas I Sukamiskin', ''],
  ['2.3', 'Kompas', 'Ombudsman Temukan Praktik Jual Beli Kamar di Rutan Kelas I Cipinang', ''],

  // ---------------------------------------------------------- 3.1 Pungli
  ['3.1', 'Detik', 'Keluarga Warga Binaan Mengaku Dimintai Uang Rp200 Ribu Tiap Kunjungan di Rutan Kelas IIB Kabanjahe', ''],
  ['3.1', 'Antara', 'Inspektorat Periksa Dugaan Pungli Pindah Kamar di Lapas Kelas IIA Pontianak', ''],

  // ------------------------------------------- 3.3 Kekerasan oleh Petugas
  ['3.3', 'Kompas', 'Seorang Tahanan Rutan Kelas IIB Tebing Tinggi Diduga Dianiaya Petugas hingga Penuh Lebam', ''],
  ['3.3', 'Suara', 'Video Oknum Sipir Lapas Kelas IIB Lahat Memukuli Warga Binaan Viral di Media Sosial', ''],

  // --------------------------------------- 3.4 Jual-Beli Hak Warga Binaan
  ['3.4', 'Tempo', 'Dugaan Jual Beli Remisi di Lapas Kelas I Cipinang Diselidiki Inspektorat Jenderal', ''],
  ['3.4', 'Detik', 'Napi Lapas Kelas IIA Bekasi Diduga Bisa Keluar Lapas Tanpa Izin dengan Membayar Oknum Petugas', ''],

  // ------------------------------------------------------- 3.5 Korupsi
  ['3.5', 'Kompas', 'KPK Tetapkan Kepala Rutan Kelas I Tangerang sebagai Tersangka Dugaan Korupsi Pengadaan Bahan Makanan', ''],
  ['3.5', 'CNN Indonesia', 'Kejaksaan Sita Aset Milik Mantan Kalapas Kelas IIA Palembang dalam Kasus Penyalahgunaan Wewenang', ''],

  // ------------------------------------------------ 3.6 Etik dan Asusila
  ['3.6', 'Tribun', 'Rumah Dinas Kepala Lapas Kelas IIB Muara Enim Digerebek Warga', ''],
  ['3.6', 'Suara', 'Oknum Petugas Lapas Perempuan Kelas IIA Malang Dilaporkan atas Dugaan Pelecehan Seksual', ''],

  // ------------------------------------------ 4.1 Kematian Tidak Wajar
  ['4.1', 'Kompas', 'Seorang Tahanan Ditemukan Meninggal di Sel Rutan Kelas IIB Sampit', ''],
  ['4.1', 'Detik', 'Napi Lapas Kelas IIA Bengkulu Tewas Diduga Gantung Diri di Kamar Mandi Blok C', ''],

  // ------------------------------------------------------- 4.3 Bencana
  ['4.3', 'Antara', 'Kebakaran Melanda Aula Lapas Kelas IIB Praya, 180 Warga Binaan Dievakuasi', ''],
  ['4.3', 'Kompas', 'Banjir Rendam Rutan Kelas IIB Sinjai, Warga Binaan Dipindahkan Sementara', ''],

  // ---------------------------------------- 5.1 Penyebaran Paham Radikal
  ['5.1', 'Republika', 'Densus 88 Dalami Dugaan Pembaiatan di Dalam Lapas Kelas I Surabaya', ''],
  ['5.1', 'Media Indonesia', 'BNPT Soroti Penyebaran Paham Radikal di Kalangan Napiter Lapas Kelas IIA Bogor', ''],

  // -------------------------------------------------- 6.1 Penyelundupan
  ['6.1', 'Tribun', 'Petugas Gagalkan Penyelundupan Sabu yang Dilempar dari Luar Tembok Lapas Kelas IIA Banjarmasin', ''],
  ['6.1', 'Detik', 'Modus Baru, Narkoba Dikirim ke Lapas Kelas IIB Sungguminasa Menggunakan Drone', ''],

  // --------------------------------------- 6.2 Penyerangan Fisik Eksternal
  ['6.2', 'Kompas', 'Puluhan Massa Berunjuk Rasa di Depan Gerbang Lapas Kelas IIA Jayapura', ''],
  ['6.2', 'Antara', 'Sekelompok Orang Tak Dikenal Menyerang Pos Jaga Rutan Kelas IIB Nabire', ''],

  // ---------------------------------- 7.2 Kegagalan Program Integrasi
  ['7.2', 'Jawa Pos', 'Residivis yang Baru Bebas Asimilasi Kembali Ditangkap Polisi dalam Kasus Pencurian di Kudus', ''],
  ['7.2', 'Radar Lampung', 'Baru Sepekan Keluar Lapas, Mantan Narapidana Curanmor Kembali Berulah', ''],

  // ------------------------- 8.6 Ketahanan Pangan dan Pemberdayaan Ekonomi
  ['8.6', MEDSOS, 'Panen Raya Jagung di Lahan Produktif Lapas Kelas IIB Tolitoli bersama Dinas Pertanian', ''],
  ['8.6', 'YouTube [Lapas Kelas IIA Yogyakarta]', 'Warga Binaan Panen 320 Kg Sayur Pakcoy dari Kebun Hidroponik Lapas', ''],

  // ---------------------------------- 8.7 Kesehatan dan Layanan Medis
  ['8.7', MEDSOS, 'Skrining TBC bagi Warga Binaan Rutan Kelas IIB Ende bersama Puskesmas Kecamatan', ''],
  ['8.7', 'YouTube [Humas Lapas Kelas IIA Ambon]', 'Donor Darah Petugas dan Warga Binaan Lapas Ambon bersama PMI Kota', ''],

  /* ------------------------------------------- pasangan yang mudah tertukar
     Enam kasus di bawah bukan menambah cakupan, melainkan menjaga batas.
     Masing-masing berdiri persis di perbatasan dua subkategori, dan pada
     perbatasan itulah kata kunci yang baru ditambahkan paling sering merusak
     penilaian yang sudah benar — tanpa satu pun kasus lain ikut gagal, sehingga
     kerusakannya tidak terlihat sampai ada yang membaca laporannya.
  */
  // Kematian yang diduga akibat perbuatan petugas tetap 4.1. Yang harus tercatat
  // lebih dulu adalah ada orang meninggal di dalam tahanan negara; siapa yang
  // menyebabkannya adalah pertanyaan berikutnya, dan itu pekerjaan penyidik.
  ['4.1', 'Kompas', 'Warga Binaan Rutan Kelas IIB Pandeglang Meninggal, Keluarga Duga Ada Kelalaian Medis', ''],
  // Razia yang berhasil dan diberitakan unitnya sendiri adalah operasional
  // rutin, bukan temuan negatif. Bandingkan dengan 6.1 di atas, yang menyebut
  // modus penyelundupannya dan karena itu memang temuan.
  ['8.5', 'YouTube [Rutan Kelas IIB Sidoarjo]', 'Razia Blok Hunian Rutan Sidoarjo Berjalan Tertib bersama Polres', ''],
  /*
     Bantahan: EMPAT kasus, dan keempatnya harus ada.

     Sejak 6 September 2026 yang memutuskan bukan lagi perbandingan skor
     melainkan URUTAN — apakah kata kerja bantahan berdiri sebelum atau sesudah
     peristiwanya. Kaidah semacam itu punya dua arah gagal yang berlawanan, dan
     kasus yang hanya menguji satu arah akan tetap hijau sementara arah lainnya
     rusak total.

     Arah pertama : bantahan yang mendahului harus MENANG (jangan sampai
                    klarifikasi tercatat sebagai peristiwa).
     Arah kedua   : bantahan yang menyusul harus KALAH (jangan sampai peristiwa
                    sungguhan hilang hanya karena ada yang membantah sesuatu
                    tentangnya di kalimat berikutnya).

     Arah kedua itulah yang paling mahal bila rusak, dan paling sunyi: pelarian
     dan kerusuhan akan lenyap dari hitungan negatif tanpa satu pun galat.
  */
  ['7.1', 'Radar Cirebon', 'Lapas Kuningan Bantah Kabar Napi Kabur, Yang Bersangkutan Sedang Berobat', ''],
  ['1.1', 'Radar Cirebon', 'Napi Kabur dari Lapas Kelas IIB Kuningan, Pihak Lapas Membantah Ada Kelalaian Petugas', ''],
  ['7.1', 'Ambon Ekspres', 'Lapas Ambon Bantah Kabar Kerusuhan, Sebut Hanya Cekcok Dua Warga Binaan', ''],
  ['1.2', 'Ambon Ekspres', 'Kerusuhan Pecah di Lapas Kelas IIA Ambon, Petugas Membantah Ada Korban Jiwa', ''],
  // Remisi tetap 8.1 meski penerbitnya media umum dan angkanya besar.
  ['8.1', 'Antara', 'Sebanyak 1.240 Warga Binaan Lapas Kelas I Medan Terima Remisi Natal', ''],
  // Overkapasitas tetap 4.2 meski kalimatnya tenang dan tanpa satu pun kata
  // bernada negatif — angkanyalah yang menjadi beritanya.
  ['4.2', 'Kompas', 'Dihuni 1.900 Orang, Lapas Kelas IIA Kupang Berkapasitas 600 Orang', ''],
  // Kegiatan keagamaan tetap 8.2, tidak tertarik ke 8.6 oleh kosakata dapur
  // yang lazim muncul pada berita peringatan hari besar.
  ['8.2', MEDSOS, 'Peringatan Maulid Nabi di Masjid Lapas Kelas IIA Metro Diikuti Ratusan Warga Binaan', ''],

  /* ==========================================================================
     Dari arsip produksi — 6 September 2026
     ==========================================================================
     Empat baris di bawah BUKAN kalimat karangan. Keempatnya disalin apa adanya
     dari tabel berita, termasuk tagar dan ekor " - instagram.com" yang ikut
     ditulis crawler, dan keempatnya jatuh ke "Belum Dikelompokkan" pada mesin
     v4.0 di produksi.

     Kalimat yang dikarang untuk menguji cenderung memakai kata kunci yang sudah
     ada di daftar — itu sifat menulisnya, bukan kelalaian penulisnya. Yang
     hanya bisa ditemukan dari arsip adalah kebiasaan bahasa yang tidak
     terpikirkan: berita penangkapan kembali menyebut "DPO" dan tidak pernah
     menyebut "kabur"; unggahan resmi menulis "MUTASI WARGA BINAAN" dan tidak
     pernah "pemindahan"; kabar pergantian pejabat menulis "digantikan" tanpa
     satu pun kata seremoni.
  */
  ['1.1', 'YouTube [HopsID ]', 'Sembunyi di Lintas Negara, DPO Narkoba Lapas Sukadana Akhirnya Dipulangkan ke Tanah Air', ''],
  ['8.5', 'Medsos Radar', 'MUTASI WARGA BINAAN RUTAN KELAS I CIPINANG Sebagai bagian dari upaya menjaga keamanan dan ketertiban, Rutan Kelas I Cipinang melaksanakan mutasi warga binaan secara terukur dan sesuai prosedur - instagram.com', ''],
  ['2.1', 'YouTube [Virgo Girl]', 'Amar Zoni di duga jual narkoba di lapas #shorts #artist', ''],
  ['8.4', 'Medsos Radar', 'Fajar Teguh Wibowo mengakhiri hampir dua tahun kepemimpinannya sebagai Kepala Rutan Kelas IIA Batam. Ia mendapat tugas baru sebagai Kepala KPLP Lapas Kelas I Cipinang, dan posisinya digantikan Bambang Febriansyah - instagram.com', ''],
]

/* ---------------------------------------------------------------- jalankan */

function cocok(harap, dapat) {
  if (harap.endsWith('*')) return String(dapat).startsWith(harap.slice(0, -1))
  return harap === dapat
}

let benar = 0
const gagal = []

for (const [harap, media, judul, ringkasan] of KASUS) {
  const h = klasifikasikan({ judul, ringkasan, media })
  const ok = cocok(harap, h.subkategori_kode)
  if (ok) benar += 1
  else gagal.push({ harap, judul, media, h })
}

console.log(`\nBenar ${benar}/${KASUS.length} (${((benar / KASUS.length) * 100).toFixed(1)}%)\n`)
console.log('─'.repeat(96))

for (const g of gagal) {
  console.log(`\nHARAP ${g.harap}  →  DAPAT ${g.h.subkategori_kode} ${g.h.subkategori}  (skor ${g.h.skor_tertinggi}, penerbit ${g.h.penerbit || '-'})`)
  console.log(`  ${g.judul.slice(0, 92)}`)
  const pesaing = (g.h.pesaing || []).slice(0, 3)
    .map((p) => `${p.kode} ${p.nama.slice(0, 24)} ${p.skor}`)
    .join('  |  ')
  if (pesaing) console.log(`  pesaing: ${pesaing}`)
  if (g.h.alasan) console.log(`  alasan : ${g.h.alasan.slice(0, 140)}`)
}

/* ----------------------------------------------------------------- cakupan */
/*
   Berapa bagian taksonomi yang sebenarnya diuji.

   Ditambahkan 6 September 2026, sesudah sebuah pemeriksaan menemukan bahwa
   berkas ini menguji 14 dari 28 subkategori — dan tidak ada satu baris pun di
   layar yang mengatakannya. Angka "benar 57 dari 62" terbaca sebagai nilai
   mesin, padahal ia nilai mesin ATAS SEPARUH TAKSONOMI, dan separuh yang tidak
   diuji justru memuat yang paling berat akibatnya bila salah: kematian tidak
   wajar, kekerasan oleh petugas, korupsi, penyelundupan.

   Kegagalan yang dicegahnya bukan mesin yang salah, melainkan MESIN YANG TIDAK
   PERNAH DITANYA. Subkategori tanpa satu pun kasus tidak akan pernah membuat
   berkas ini merah, berapa pun rusaknya aturan di baliknya.

   Karena itu lubang cakupan diperlakukan sebagai KEGAGALAN, bukan peringatan.
   Menambahkan subkategori ke taksonomi tanpa menambahkan kasusnya di sini akan
   membuat perintah ini gagal pada hari itu juga — dan bukan berbulan-bulan
   kemudian, ketika seseorang kebetulan membaca laporan yang salah.

   Kasus berkode induk (`8.*`) sengaja TIDAK dihitung sebagai cakupan. Ia
   menyatakan "kategori induknya sudah cukup", jadi ia justru bukti bahwa
   subkategorinya belum pernah diuji secara khusus.
*/

const diuji = new Set(KASUS.map(([k]) => k).filter((k) => !k.endsWith('*')))
const semuaSub = KATEGORI.flatMap((k) => (k.subkategori || []).map((s) => ({ ...s, induk: k.nama })))
const belumDiuji = semuaSub.filter((s) => !diuji.has(s.kode))

console.log('\n' + '─'.repeat(96))
console.log(`\nCakupan taksonomi: ${semuaSub.length - belumDiuji.length}/${semuaSub.length} subkategori punya kasus ujinya sendiri\n`)

if (belumDiuji.length) {
  console.log('TANPA SATU PUN KASUS UJI — mesin tidak pernah ditanya tentang ini:')
  for (const s of belumDiuji) console.log(`  ${s.kode.padEnd(5)} ${s.nama}`)
  console.log('\nTambahkan minimal satu kasus untuk tiap baris di atas.')
}

console.log('\n' + '─'.repeat(96))
process.exit(gagal.length || belumDiuji.length ? 1 : 0)
