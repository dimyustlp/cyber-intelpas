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
  ['8.3', 'YouTube [Lembaga Pemasyarakatan Kelas III Suliki]', 'Pembagian Vitamin WBP Lapas Suliki, Senin (10/08).', ''],
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
  ['8.2', 'YouTube [Lapas Kelas I Surabaya]', 'Karya Dari Balik Lapas', ''],
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
  ['8.2', 'YouTube [Lapas Satu Bandar Lampung]', 'Daily Kegiatan Kerja, Peregangan Sebelum Membuat Sabun', ''],
  ['8.*', 'YouTube [Lapas Satu Bandar Lampung]', 'Di sini ada Tempat Cukur Rambut?', ''],
  ['8.*', 'YouTube [Lapas Satu Bandar Lampung]', 'Jurnal Sepekan 17 Agustus s.d. 22 Agustus', ''],
  ['8.3', 'YouTube [Lapas Satu Bandar Lampung]', 'Klinik Passai: Etika Batuk Yang Benar', ''],
  ['8.4', 'YouTube [Lapas Satu Bandar Lampung]', 'Pelepasan dan Perpisahan 3 Pejabat Struktural', ''],
  ['8.3', 'YouTube [Humaslapadalangkat]', 'VIDEO PENGOBATAN GRATIS DAN PEMBAGIAN BANSOS', ''],
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

console.log('\n' + '─'.repeat(96))
process.exit(gagal.length ? 1 : 0)
