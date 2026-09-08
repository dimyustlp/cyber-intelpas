/**
 * ============================================================================
 * LEMBAR KANWIL — Trans-Siber PAS
 * ============================================================================
 *
 * Satu berkas ini menjadikan spreadsheet kosong sebagai simpul wilayah: ia
 * membangun formatnya sendiri, menjaring berita wilayahnya sampai lapisan
 * terbawah, lalu menyerahkannya ke pusat lewat jalan yang sudah ada.
 *
 * ----------------------------------------------------------------------------
 * KEDUDUKANNYA — DAN APA YANG SENGAJA TIDAK DIKERJAKANNYA
 * ----------------------------------------------------------------------------
 *
 * Lembar ini KAKI, bukan otak. Ia menjaring dan menyetor; ia tidak menilai.
 *
 *   dikerjakan di sini            TIDAK dikerjakan, dan alasannya
 *   ----------------------------  -------------------------------------------
 *   mencari berita                —
 *   menguraikan alamat            —
 *   menyaring yang bukan PAS      —
 *   membuang kembar (dua lapis)   lapis yang menolak ada di basis data
 *   —                             sentimen, kategori, urgensi: mesin
 *                                 `klasifikasi` v4.5 di pusat. Menyalinnya ke
 *                                 sini berarti 38 salinan yang menyimpang satu
 *                                 per satu, tanpa ada yang tahu kapan.
 *   —                             kirim Telegram: lewat `telegram-kirim` di
 *                                 pusat. Kalau tiap kanwil mengirim sendiri,
 *                                 satu berita nasional yang menyebut sepuluh
 *                                 unit membangunkan pimpinan sepuluh kali.
 *   —                             tetapkan tier: daftar induk `media_tier` di
 *                                 pusat. Kolom Tier di sini hanya perkiraan
 *                                 untuk mata petugas, dan diberi nama begitu.
 *
 * Jalan setoran: lembar ini dibaca `sheet-sync` sebagai satu baris
 * `sumber_sheet`. Judul kolomnya karena itu TIDAK BOLEH dikarang bebas — ia
 * harus bentuk yang dikenali `ALIAS_BAWAAN` di sana. Yang wajib hanya dua:
 * judul dan tautan. Sisanya menambah ketelitian.
 *
 * ----------------------------------------------------------------------------
 * EMPAT KAKI, DAN KENAPA EMPAT
 * ----------------------------------------------------------------------------
 *
 * Diukur 6 September 2026: 343 dari 531 unit tidak pernah sekali pun muncul di
 * arsip. Penyapuan kata kunci umum selalu menemukan yang paling ramai, dan yang
 * paling ramai selalu unit besar. Empat kaki menutup kebutaan yang berbeda:
 *
 *   1. jaringUnit()   dari NAMA UNIT. "Apa yang terjadi di tempat yang tidak
 *                     pernah kita lihat?"
 *
 *   2. jaringKota()   dari NAMA KABUPATEN/KOTA. Wartawan lokal menulis
 *                     "penjara Kediri", bukan "Lapas Kelas IIA Kediri". Kaki 1
 *                     tidak akan pernah menemukan judul itu; kaki ini ada
 *                     justru untuk itu.
 *
 *   3. jaringIsu()    dari DAFTAR ISU berat. Menemukan peristiwa besar di unit
 *                     yang sudah sering diberitakan — unit begitu tidak pernah
 *                     masuk daftar sasaran kaki 1.
 *
 *   4. jaringPortal() membaca RSS PORTAL WILAYAH LANGSUNG, tanpa lewat Google.
 *                     -------------------------------------------------------
 *                     INI KAKI YANG MENEMBUS TIER 4, dan ia satu-satunya.
 *                     Portal hiperlokal sering tidak terindeks Google News sama
 *                     sekali; tiga kaki di atas mustahil menemukannya karena
 *                     ketiganya bertanya kepada Google. Kaki ini membaca
 *                     terbitan portalnya sendiri, seluruhnya, lalu menyaring
 *                     dengan jangkar kata.
 *
 * ----------------------------------------------------------------------------
 * JANGKAR KATA HARUS BERBATAS KATA
 * ----------------------------------------------------------------------------
 *
 * Pelajaran yang sudah dibayar di tempat lain pada sistem ini: pencocokan tanpa
 * batas kata mencocokkan 'tahanan' pada "perTAHANAN", dan uji kering pertama
 * meloloskan One Piece serta hasil Man City ke arsip intelijen pemasyarakatan.
 * Seluruh pencocokan jangkar di berkas ini memakai batas kata.
 *
 * ----------------------------------------------------------------------------
 * ALAMAT GOOGLE NEWS: DUA LANGKAH, DAN TIDAK ADA JALAN PINTASNYA
 * ----------------------------------------------------------------------------
 *
 * RSS Google News memberi alamat pengalihan miliknya sendiri. Sejak pengenal
 * bentuk baru (`AU_yqL...`), alamat aslinya TIDAK ADA di dalam pengenal itu —
 * base64-nya hanya protobuf. Membaca `<link rel=canonical>` dari halamannya,
 * yang dulu berhasil, kini selalu gagal.
 *
 * Terukur pada jalan pertama Kanwil Jawa Timur, 8 September 2026: 115 berita
 * lolos seluruh saringan lalu **seluruh 115-nya** gagal diuraikan. Nol baris
 * masuk, tanpa satu pun galat — jurnalnya hijau dan kolom "Baris Baru" nol,
 * bentuk kegagalan yang persis sama dengan "memang tidak ada beritanya".
 *
 * Jalannya dua langkah, sama dengan yang dipakai Edge Function `penjaring`:
 *
 *   1. Unduh halaman artikelnya, ambil `data-n-a-sg` (tanda tangan) dan
 *      `data-n-a-ts` (cap waktu)
 *   2. POST keduanya ke `batchexecute`, yang membalas alamat aslinya
 *
 * Tanda tangannya terikat pada artikelnya: dicoba dengan tanda tangan artikel
 * lain atau dikosongkan, Google membalas kosong.
 *
 * Karena satu berita berharga DUA permintaan, hasilnya — termasuk
 * kegagalannya — disimpan di CacheService selama enam jam.
 *
 * ----------------------------------------------------------------------------
 * CARA MEMASANG (sekali saja, sekitar tiga menit)
 * ----------------------------------------------------------------------------
 *
 *   1. Buat spreadsheet baru, beri nama sesuai kanwilnya
 *   2. Ekstensi -> Apps Script, hapus isi Code.gs, tempel SELURUH berkas ini
 *   3. Simpan, lalu jalankan fungsi `siapkanLembar` sekali
 *      (Apps Script akan meminta izin; itu wajar)
 *   4. Jalankan `pasangPemicu` sekali
 *   5. Kembali ke spreadsheet -> Bagikan -> "Siapa saja yang memiliki link"
 *      sebagai **Pelihat**
 *   6. Kirim ID spreadsheet ini ke admin pusat untuk didaftarkan
 *
 * Langkah 5 WAJIB. Penyalin pusat membacanya tanpa akun Google; tanpa itu
 * halaman Sinkronisasi Sumber menampilkannya Gagal — dan itu benar, bukan
 * kekeliruan yang perlu diperbaiki.
 */

/* ═════════════════════════════════════════════ konfigurasi wilayah ══════ */
/*  Bagian ini DISUNTIK oleh tools/susun-lembar-kanwil.mjs.                  */
/*  Jangan menyuntingnya dengan tangan: jalankan ulang pabriknya supaya       */
/*  seluruh kanwil tetap sama bentuknya.                                     */

/*__SUNTIK_KONFIG__*/

/* ═══════════════════════════════════════════════════════════ setelan ══ */

var VERSI = 'lembar-kanwil-v1.1';

var L_BERITA = 'Berita';
var L_UNIT   = 'Target Unit';
var L_PORTAL = 'Portal Wilayah';
var L_TIER   = 'Tier Media';
var L_JURNAL = 'Jurnal';
var L_INFO   = 'Petunjuk';

/**
 * Berapa sasaran dikerjakan sekali jalan.
 *
 * Apps Script memotong satu jalan pada enam menit. Angka-angka ini dipilih agar
 * jalan terberat pun selesai sebelum dipotong — jalan yang terpotong
 * meninggalkan penunjuk sasaran pada keadaan yang tidak jelas sudah maju atau
 * belum, dan yang terlewat selalu sasaran yang sama.
 */
var UNIT_PER_JALAN   = 12;
var KOTA_PER_JALAN   = 8;
var PORTAL_PER_JALAN = 10;

var BERITA_PER_SASARAN = 6;
var UMUR_MAKS_HARI     = 30;

/**
 * Berapa butir teratas diperiksa per sasaran.
 *
 * Penjaga ini ada karena gelanggangnya asimetris: selama ADA yang diterima,
 * `BERITA_PER_SASARAN` menghentikan pemeriksaan lebih awal. Begitu TIDAK ADA
 * yang diterima — persis keadaan saat penjaringnya rusak — tidak ada yang
 * menghentikannya, dan ia memeriksa seluruh hasil pencarian. Jalan pertama
 * Kanwil Jawa Timur memeriksa 1.200 butir untuk menerima nol.
 *
 * Jadi batas ini menjaga justru pada saat yang paling dibutuhkan: ketika ada
 * yang salah.
 */
var SCAN_MAKS = 30;

/** Batas panggilan jaringan sekali jalan. Yang dijaga batas WAKTU, bukan kuota harian. */
var BATAS_AMBIL = 130;

/** Jeda antar-permintaan, milidetik. Menjaga agar tidak dianggap serangan. */
var JEDA_MS = 200;

/**
 * Jangkar kata: sebuah berita dianggap urusan Pemasyarakatan bila memuat
 * salah satunya. Dipakai kaki portal, yang membaca SELURUH terbitan portalnya.
 *
 * Daftar ini sengaja pendek. Menambahkan kata umum seperti 'hukum' atau
 * 'tahanan' meloloskan seluruh berita kriminal provinsi itu, dan yang
 * membanjir bukan lembar ini saja melainkan antrean telaah di pusat.
 */
var JANGKAR = [
  'lapas', 'rutan', 'bapas', 'rupbasan', 'lpka', 'lpp',
  'pemasyarakatan', 'napi', 'narapidana', 'sipir', 'kalapas', 'karutan',
  'ditjenpas', 'kemenimipas', 'penjara', 'bui', 'wbp', 'remisi', 'asimilasi'
];

/** Frasa jangkar. Diperiksa terpisah sebab batas katanya mengapit dua kata. */
var JANGKAR_FRASA = [
  'warga binaan', 'balai pemasyarakatan', 'lembaga pemasyarakatan', 'rumah tahanan'
];

/**
 * Penanda lembaga lain.
 *
 * Rutan milik Polres BUKAN unit kita. Penyaring lama meleset pada
 * "Rutan Mapolresta Palangka Raya" karena hanya mencocokkan nama tempat; di
 * sini jabatan dan satuannya ikut menjadi penanda.
 *
 * 'bhabinkamtibmas' SENGAJA TIDAK masuk: Bhabinkamtibmas yang hadir di
 * kegiatan Lapas adalah berita Pemasyarakatan yang sah.
 */
var LEMBAGA_LAIN = [
  'rutan polres', 'rutan mapolres', 'rutan mapolresta', 'rutan polda',
  'rutan mapolda', 'rutan kejaksaan', 'rutan kejari', 'rutan militer',
  'spkt', 'pamapta', 'sipropam', 'provos'
];

/**
 * Isu berat, mengikuti taksonomi negatif sistem pusat.
 *
 * Tiap kueri MENGIKAT kata isunya pada kata Pemasyarakatan. Tanpa ikatan itu,
 * "pungli" mengembalikan seluruh pungli di republik ini, dan yang masuk ke
 * arsip intelijen pemasyarakatan adalah berita dinas perhubungan.
 *
 * Urutannya menurut berat akibatnya bila terlewat, bukan menurut seberapa
 * sering ia muncul — pada jalan yang terpotong kuota, yang di atas tetap
 * terperiksa.
 */
var ISU = [
  { kode: '4.1', kueri: '("lapas" OR "rutan") ("tewas" OR "meninggal di sel" OR "gantung diri")' },
  { kode: '1.1', kueri: '("lapas" OR "rutan") ("napi kabur" OR "melarikan diri" OR "pelarian")' },
  { kode: '1.2', kueri: '("lapas" OR "rutan") ("kerusuhan" OR "ricuh" OR "pemberontakan")' },
  { kode: '3.3', kueri: '("sipir" OR "petugas lapas") ("menganiaya" OR "penganiayaan")' },
  { kode: '3.5', kueri: '("kalapas" OR "karutan") ("korupsi" OR "tersangka" OR "OTT")' },
  { kode: '3.1', kueri: '("lapas" OR "rutan") ("pungli" OR "pungutan liar" OR "setoran")' },
  { kode: '2.1', kueri: '("lapas" OR "rutan") ("narkoba" OR "sabu" OR "peredaran narkotika")' },
  { kode: '2.2', kueri: '("lapas" OR "rutan") ("penyelundupan" OR "selundup" OR "handphone")' },
  { kode: '3.4', kueri: '("lapas" OR "rutan") ("sel mewah" OR "kamar mewah" OR "fasilitas mewah")' }
];

/* ═══════════════════════════════════════════════════════ menu & pemicu ══ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Trans-Siber PAS')
    .addItem('Jaring per unit', 'jaringUnit')
    .addItem('Jaring per kota/kabupaten', 'jaringKota')
    .addItem('Jaring per isu', 'jaringIsu')
    .addItem('Jaring portal wilayah (Tier 4)', 'jaringPortal')
    .addSeparator()
    .addItem('Jaring SEMUA sekarang', 'jaringSemua')
    .addSeparator()
    .addItem('Siapkan / perbaiki format lembar', 'siapkanLembar')
    .addItem('Pasang / perbarui pemicu', 'pasangPemicu')
    .addToUi();
}

/**
 * Dijalankan SEKALI dengan tangan.
 *
 * Empat pemicu pada jam berbeda, bukan satu yang mengerjakan semuanya.
 * Alasannya batas waktu: satu jalan dipotong pada enam menit, dan jalan yang
 * terpotong di tengah meninggalkan penunjuk sasaran pada keadaan yang tidak
 * jelas sudah maju atau belum.
 *
 * Jamnya direnggangkan supaya dua jalan tidak pernah berebut kuota UrlFetchApp
 * yang sama.
 */
function pasangPemicu() {
  var milik = ['jaringUnit', 'jaringKota', 'jaringIsu', 'jaringPortal'];

  ScriptApp.getProjectTriggers().forEach(function (p) {
    if (milik.indexOf(p.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(p);
  });

  ScriptApp.newTrigger('jaringPortal').timeBased().atHour(2).everyDays(1).create();
  ScriptApp.newTrigger('jaringUnit').timeBased().atHour(4).everyDays(1).create();
  ScriptApp.newTrigger('jaringKota').timeBased().atHour(6).everyDays(1).create();
  ScriptApp.newTrigger('jaringIsu').timeBased().atHour(8).everyDays(1).create();

  SpreadsheetApp.getActive().toast(
    'Pemicu terpasang: portal 02.00, unit 04.00, kota 06.00, isu 08.00.', VERSI, 10);
}

/** Untuk uji tangan. Berisiko terpotong enam menit; itu wajar dan tidak merusak. */
function jaringSemua() {
  jaringPortal();
  jaringUnit();
  jaringKota();
  jaringIsu();
}

/* ═════════════════════════════════════════════════ pabrik format lembar ══ */

/**
 * Membangun seluruh lembar beserta formatnya. Aman dijalankan berkali-kali:
 * yang sudah ada tidak ditimpa isinya, hanya formatnya yang diluruskan.
 */
function siapkanLembar() {
  var berkas = SpreadsheetApp.getActive();

  siapkanBerita(berkas);
  siapkanTargetUnit(berkas);
  siapkanPortal(berkas);
  siapkanTier(berkas);
  siapkanJurnal(berkas);
  siapkanPetunjuk(berkas);

  // Lembar bawaan 'Sheet1' yang kosong hanya membingungkan petugas.
  var bawaan = berkas.getSheetByName('Sheet1');
  if (bawaan && bawaan.getLastRow() === 0 && berkas.getSheets().length > 1) {
    berkas.deleteSheet(bawaan);
  }

  berkas.setActiveSheet(berkas.getSheetByName(L_BERITA));
  berkas.toast('Format lembar siap untuk ' + KANWIL + '.', VERSI, 10);
}

/**
 * Judul kolom lembar Berita.
 *
 * URUTAN BOLEH BERUBAH, NAMANYA TIDAK. `sheet-sync` mencocokkan berdasarkan
 * nama, bukan kedudukan — tetapi nama yang di luar daftar aliasnya membuat
 * seluruh kolom itu hilang tanpa galat. Yang wajib ada hanya 'Judul Berita'
 * dan 'URL / Link Artikel'; menghapus salah satunya membuat penyalin menolak
 * seluruh lembar, dan itu memang yang seharusnya terjadi.
 */
var KOLOM = [
  'Waktu Terdeteksi',
  'Tanggal Berita',
  'Judul Berita',
  'URL / Link Artikel',
  'Sumber / Portal',
  'Domain',
  'Tier (perkiraan)',
  'Nama UPT',
  'Kanwil',
  'Tingkat Risiko',
  'Hasil Analisis & Rekomendasi',
  'Status Tindak Lanjut',
  'Petugas Respon',
  'Waktu Respon',
  'Nama Petugas',
  'Cara Dapat'
];

function siapkanBerita(berkas) {
  var l = berkas.getSheetByName(L_BERITA);
  if (!l) l = berkas.insertSheet(L_BERITA, 0);

  l.getRange(1, 1, 1, KOLOM.length).setValues([KOLOM])
    .setFontWeight('bold')
    .setBackground('#1f3864')
    .setFontColor('#ffffff')
    .setVerticalAlignment('middle')
    .setWrap(true);

  l.setFrozenRows(1);
  l.setFrozenColumns(3);
  l.getRange(1, 1, 1, KOLOM.length).setHorizontalAlignment('center');

  var lebar = [150, 110, 420, 300, 160, 170, 110, 240, 200, 110, 320, 150, 140, 130, 140, 110];
  for (var i = 0; i < lebar.length; i++) l.setColumnWidth(i + 1, lebar[i]);

  if (l.getMaxRows() > 1) {
    var isi = l.getRange(2, 1, l.getMaxRows() - 1, KOLOM.length);
    isi.setVerticalAlignment('top').setFontSize(10);
    l.getRange(2, 1, l.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd hh:mm');
    l.getRange(2, 2, l.getMaxRows() - 1, 1).setNumberFormat('yyyy-mm-dd');
  }

  warnaiTier(l);
  l.setTabColor('#1f3864');
}

/**
 * Pewarnaan tier.
 *
 * Warnanya mengikuti matriks SOP, bukan selera: merah krisis nasional, jingga
 * siaga kanwil, kuning waspada unit, hijau pantau. Petugas yang membuka lembar
 * ini harus bisa membaca tingkat ancaman tanpa membaca satu angka pun.
 */
function warnaiTier(l) {
  if (l.getMaxRows() < 2) return;
  var jangkauan = l.getRange(2, 1, l.getMaxRows() - 1, KOLOM.length);
  var G = '$G2';

  var aturan = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=' + G + '=1').setBackground('#fce4e4').setRanges([jangkauan]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=' + G + '=2').setBackground('#fdead1').setRanges([jangkauan]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=' + G + '=3').setBackground('#fff8e1').setRanges([jangkauan]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=' + G + '=4').setBackground('#eef7ee').setRanges([jangkauan]).build()
  ];

  l.setConditionalFormatRules(aturan);
}

function siapkanTargetUnit(berkas) {
  var l = berkas.getSheetByName(L_UNIT);
  var baru = !l;
  if (!l) l = berkas.insertSheet(L_UNIT);

  var judul = ['Nama UPT (resmi)', 'Jenis', 'Kabupaten/Kota', 'Ragam Nama (dipisah ;)',
               'Terakhir Diperiksa', 'Berita Ditemukan', 'Aktif'];
  l.getRange(1, 1, 1, judul.length).setValues([judul])
    .setFontWeight('bold').setBackground('#e8eaf6');
  l.setFrozenRows(1);

  // Isi hanya saat pertama dibuat. Kalau tidak, ragam nama yang disunting
  // petugas — yang justru paling berharga — akan tertimpa tiap kali format
  // lembar diperbaiki.
  if (baru && UNIT.length) {
    var baris = UNIT.map(function (u) {
      return [u.nama, u.jenis, u.kota, u.alias.join('; '), '', 0, true];
    });
    l.getRange(2, 1, baris.length, judul.length).setValues(baris);
  }

  l.setColumnWidth(1, 300); l.setColumnWidth(3, 180); l.setColumnWidth(4, 420);
  l.getRange(2, 5, Math.max(l.getMaxRows() - 1, 1), 1).setNumberFormat('yyyy-mm-dd hh:mm');
  l.setTabColor('#3949ab');
}

function siapkanPortal(berkas) {
  var l = berkas.getSheetByName(L_PORTAL);
  var baru = !l;
  if (!l) l = berkas.insertSheet(L_PORTAL);

  var judul = ['Nama Portal', 'Alamat RSS / Beranda', 'Tier (dugaan)',
               'Terakhir Diperiksa', 'Butir Terlihat', 'Diterima', 'Aktif', 'Catatan'];
  l.getRange(1, 1, 1, judul.length).setValues([judul])
    .setFontWeight('bold').setBackground('#e0f2f1');
  l.setFrozenRows(1);

  if (baru && PORTAL.length) {
    var baris = PORTAL.map(function (p) {
      return [p.nama, p.alamat, p.tier, '', 0, 0, true, p.catatan || ''];
    });
    l.getRange(2, 1, baris.length, judul.length).setValues(baris);
  }

  l.setColumnWidth(1, 220); l.setColumnWidth(2, 400); l.setColumnWidth(8, 340);
  l.getRange(2, 4, Math.max(l.getMaxRows() - 1, 1), 1).setNumberFormat('yyyy-mm-dd hh:mm');
  l.setTabColor('#00897b');

  if (baru) {
    l.getRange(1, 2).setNote(
      'Boleh diisi alamat RSS langsung, atau beranda portalnya saja — penjaring '
      + 'akan mencoba /feed, /rss, /feed/atom, dan ?feed=rss2 satu per satu.\n\n'
      + 'DI SINILAH Tier 4 ditambahkan. Portal hiperlokal kabupaten yang tidak '
      + 'terindeks Google News hanya bisa masuk lewat daftar ini.');
  }
}

function siapkanTier(berkas) {
  var l = berkas.getSheetByName(L_TIER);
  var baru = !l;
  if (!l) l = berkas.insertSheet(L_TIER);

  var judul = ['Domain', 'Nama Media', 'Tier', 'Turunkan Subdomain'];
  l.getRange(1, 1, 1, judul.length).setValues([judul])
    .setFontWeight('bold').setBackground('#f3e5f5');
  l.setFrozenRows(1);

  if (baru && TIER_BAWAAN.length) {
    l.getRange(2, 1, TIER_BAWAAN.length, 4).setValues(TIER_BAWAAN);
  }

  l.setColumnWidth(1, 260); l.setColumnWidth(2, 220);
  l.setTabColor('#8e24aa');

  if (baru) {
    l.getRange(1, 3).setNote(
      'Salinan daftar induk `media_tier` di pusat, untuk perkiraan di layar saja.\n\n'
      + 'Yang berwenang tetap pusat: berita yang sama bisa saja bertier lain di '
      + 'sana, dan yang benar adalah yang di sana. Jangan memutuskan eskalasi '
      + 'dari kolom ini.');
  }
}

function siapkanJurnal(berkas) {
  var l = berkas.getSheetByName(L_JURNAL);
  if (!l) l = berkas.insertSheet(L_JURNAL);

  var judul = ['Waktu', 'Kaki', 'Sasaran Diperiksa', 'Baris Baru', 'Tolak: Tak Relevan',
               'Tolak: Kembar', 'Tolak: Alamat', 'Tolak: Lembaga Lain', 'Tolak: Terlalu Lama',
               'Panggilan Jaringan', 'Lama (detik)', 'Pesan'];
  l.getRange(1, 1, 1, judul.length).setValues([judul])
    .setFontWeight('bold').setBackground('#eceff1');
  l.setFrozenRows(1);
  l.getRange(2, 1, Math.max(l.getMaxRows() - 1, 1), 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  l.setColumnWidth(12, 460);
  l.setTabColor('#607d8b');

  l.getRange(1, 5).setNote(
    'Angka tolak yang BESAR pada kaki portal menandakan SEHAT: umpan portal '
    + 'memuat seluruh berita portalnya, dan yang menyaring hanya jangkar kata.\n\n'
    + 'Yang menandakan rusak justru sebaliknya: "Sasaran Diperiksa" terisi tapi '
    + '"Panggilan Jaringan" nol.');
}

function siapkanPetunjuk(berkas) {
  var l = berkas.getSheetByName(L_INFO);
  if (l) return;
  l = berkas.insertSheet(L_INFO);

  var isi = [
    ['LEMBAR KANWIL — ' + KANWIL],
    [''],
    ['Lembar ini menjaring berita Pemasyarakatan di wilayah ' + PROVINSI + ','],
    ['lalu menyerahkannya ke pusat. Penilaian sentimen, kategori, dan urgensi'],
    ['dikerjakan mesin di pusat, bukan di sini.'],
    [''],
    ['YANG BOLEH DISUNTING PETUGAS'],
    ['  Target Unit  — kolom "Ragam Nama". Tambahkan sebutan yang dipakai'],
    ['                 wartawan setempat. Inilah sunting yang paling berharga:'],
    ['                 satu nama panggilan yang benar sering membuka berita'],
    ['                 yang bertahun-tahun tidak pernah tertangkap.'],
    ['  Portal Wilayah — tambahkan portal hiperlokal kabupaten. DI SINILAH'],
    ['                 Tier 4 bertambah; tanpa daftar ini portal kecil'],
    ['                 mustahil tertangkap karena Google pun tidak mengindeksnya.'],
    ['  Berita       — kolom Nama UPT, Tingkat Risiko, Hasil Analisis,'],
    ['                 Status Tindak Lanjut, Petugas Respon, Nama Petugas.'],
    [''],
    ['YANG JANGAN DISENTUH'],
    ['  Judul kolom pada lembar Berita. Penyalin pusat mencocokkan nama kolom;'],
    ['  judul yang diubah membuat kolom itu hilang tanpa satu pun galat.'],
    ['  Kolom Domain dan Tier diisi mesin dan akan ditimpa.'],
    [''],
    ['KALAU BERITA TIDAK BERTAMBAH'],
    ['  Buka lembar Jurnal. Kalau "Panggilan Jaringan" nol, penjaringnya tidak'],
    ['  berjalan — periksa pemicu. Kalau besar tapi "Baris Baru" nol, berarti'],
    ['  memang tidak ada yang baru, atau semuanya sudah pernah masuk.'],
    [''],
    ['Versi: ' + VERSI]
  ];

  l.getRange(1, 1, isi.length, 1).setValues(isi);
  l.getRange(1, 1).setFontSize(14).setFontWeight('bold');
  l.getRange(7, 1).setFontWeight('bold');
  l.getRange(18, 1).setFontWeight('bold');
  l.getRange(23, 1).setFontWeight('bold');
  l.setColumnWidth(1, 720);
  l.setTabColor('#9e9e9e');
  l.setFrozenRows(1);
}

/* ═══════════════════════════════════════════════════ kaki 1 — per unit ══ */

function jaringUnit() {
  var mulai = new Date();
  var kuota = { ambil: 0 };
  var tolak = petaTolak();
  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(L_BERITA);
  if (!lembar) { return; }

  var target = bacaSasaran(L_UNIT, 5, 7);
  if (!target.baris.length) {
    catatJurnal('unit', 0, 0, tolak, kuota, mulai, 'Lembar Target Unit kosong. Jalankan siapkanLembar().');
    return;
  }

  var sudahAda = alamatYangSudahAda(lembar);
  var baru = [];
  var dipilih = pilihSasaran(target, UNIT_PER_JALAN);

  for (var i = 0; i < dipilih.length; i++) {
    if (kuota.ambil >= BATAS_AMBIL) { tolak.kuota++; break; }

    var nama = dipilih[i].nilai[0];
    var ragam = String(dipilih[i].nilai[3] || '').split(';')
      .map(function (s) { return s.trim(); }).filter(Boolean);
    if (!ragam.length) ragam = [nama];

    // Kueri disusun dari ragam nama, bukan nama resminya saja.
    // "Lapas Kelas IIB Tobelo" hampir tidak pernah ditulis lengkap; yang
    // ditulis "Lapas Tobelo". Mencari bentuk resminya saja melewatkan
    // sebagian besar beritanya.
    var kueri = ragam.slice(0, 4).map(function (r) { return '"' + r + '"'; }).join(' OR ');

    var temuan = cariGoogleNews(kueri, kuota);
    var diterima = 0;

    for (var j = 0; j < temuan.length && j < SCAN_MAKS && diterima < BERITA_PER_SASARAN; j++) {
      var hasil = olahTemuan(temuan[j], sudahAda, tolak, kuota, ragam, nama, 'unit');
      if (hasil) { baru.push(hasil); diterima++; }
    }

    tandaiDiperiksa(L_UNIT, dipilih[i].baris, 5, 6, diterima);
  }

  tulisBaris(lembar, baru);
  catatJurnal('unit', dipilih.length, baru.length, tolak, kuota, mulai, '');
}

/* ═══════════════════════════════════════════ kaki 2 — per kota/kabupaten ══ */

/**
 * Berangkat dari nama daerah, bukan nama unit.
 *
 * Judul yang paling sering dipakai wartawan setempat berbunyi "penjara
 * Kediri", "rutan Medaeng", "lapas Tulungagung" — nama daerah plus kata umum.
 * Kaki per-unit tidak akan pernah menemukannya karena ia mencari nama resmi.
 *
 * Kata daerah SELALU diikat pada kata Pemasyarakatan. Tanpa ikatan itu kueri
 * "Kediri" mengembalikan seluruh berita kota Kediri, dan yang masuk arsip
 * adalah jadwal pertandingan Persik.
 */
function jaringKota() {
  var mulai = new Date();
  var kuota = { ambil: 0 };
  var tolak = petaTolak();
  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(L_BERITA);
  if (!lembar || !KOTA.length) return;

  var sudahAda = alamatYangSudahAda(lembar);
  var baru = [];

  var penunjuk = Number(PropertiesService.getDocumentProperties().getProperty('penunjuk_kota') || 0);
  var dipakai = 0;

  for (var n = 0; n < KOTA.length && dipakai < KOTA_PER_JALAN; n++) {
    if (kuota.ambil >= BATAS_AMBIL) { tolak.kuota++; break; }

    var kota = KOTA[(penunjuk + n) % KOTA.length];
    dipakai++;

    var kueri = '("lapas" OR "rutan" OR "penjara" OR "bapas" OR "warga binaan") "' + kota + '"';
    var temuan = cariGoogleNews(kueri, kuota);
    var diterima = 0;

    for (var j = 0; j < temuan.length && j < SCAN_MAKS && diterima < BERITA_PER_SASARAN; j++) {
      var hasil = olahTemuan(temuan[j], sudahAda, tolak, kuota, null, '', 'kota');
      if (hasil) { baru.push(hasil); diterima++; }
    }
  }

  PropertiesService.getDocumentProperties()
    .setProperty('penunjuk_kota', String((penunjuk + dipakai) % KOTA.length));

  tulisBaris(lembar, baru);
  catatJurnal('kota', dipakai, baru.length, tolak, kuota, mulai, '');
}

/* ══════════════════════════════════════════════════════ kaki 3 — per isu ══ */

function jaringIsu() {
  var mulai = new Date();
  var kuota = { ambil: 0 };
  var tolak = petaTolak();
  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(L_BERITA);
  if (!lembar) return;

  var sudahAda = alamatYangSudahAda(lembar);
  var baru = [];

  for (var i = 0; i < ISU.length; i++) {
    if (kuota.ambil >= BATAS_AMBIL) { tolak.kuota++; break; }

    // Isu diikat pada provinsinya. Tanpa itu lembar Kanwil Jawa Timur akan
    // penuh berita Sumatera, dan pusat menerima baris yang sama dari tiga
    // puluh delapan lembar sekaligus.
    var kueri = ISU[i].kueri + ' ' + IKATAN_WILAYAH;
    var temuan = cariGoogleNews(kueri, kuota);
    var diterima = 0;

    for (var j = 0; j < temuan.length && j < SCAN_MAKS && diterima < BERITA_PER_SASARAN; j++) {
      var hasil = olahTemuan(temuan[j], sudahAda, tolak, kuota, null, '', 'isu:' + ISU[i].kode);
      if (hasil) { baru.push(hasil); diterima++; }
    }
  }

  tulisBaris(lembar, baru);
  catatJurnal('isu', ISU.length, baru.length, tolak, kuota, mulai, '');
}

/* ═════════════════════════════════ kaki 4 — portal wilayah (Tier 4) ══ */

/**
 * Membaca RSS portal langsung, tanpa lewat Google sama sekali.
 *
 * Inilah satu-satunya kaki yang benar-benar menembus lapisan terbawah. Portal
 * hiperlokal kabupaten sering tidak terindeks Google News; selama pertanyaan
 * diajukan kepada Google, portal itu tidak ada. Di sini yang ditanya
 * portalnya sendiri.
 *
 * Konsekuensinya: umpan memuat SELURUH terbitan portal itu — olahraga,
 * pilkada, kuliner. Yang menyaring hanya jangkar kata, dan karena itu angka
 * "Tolak: Tak Relevan" pada kaki ini memang besar. Besar itu sehat.
 */
function jaringPortal() {
  var mulai = new Date();
  var kuota = { ambil: 0 };
  var tolak = petaTolak();
  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(L_BERITA);
  if (!lembar) return;

  var target = bacaSasaran(L_PORTAL, 4, 7);
  if (!target.baris.length) {
    catatJurnal('portal', 0, 0, tolak, kuota, mulai, 'Lembar Portal Wilayah kosong.');
    return;
  }

  var sudahAda = alamatYangSudahAda(lembar);
  var baru = [];
  var dipilih = pilihSasaran(target, PORTAL_PER_JALAN);

  for (var i = 0; i < dipilih.length; i++) {
    if (kuota.ambil >= BATAS_AMBIL) { tolak.kuota++; break; }

    var namaPortal = dipilih[i].nilai[0];
    var alamat = String(dipilih[i].nilai[1] || '').trim();
    if (!alamat) continue;

    var butir = ambilUmpan(alamat, kuota);
    var diterima = 0;

    for (var j = 0; j < butir.length; j++) {
      var t = butir[j];

      // Jangkar diperiksa DULU, sebelum apa pun yang memakai jaringan.
      // Umpan portal isinya sebagian besar bukan urusan kita, dan menguraikan
      // alamat lebih dulu berarti membayar kuota untuk berita kuliner.
      if (!berjangkar(t.judul + ' ' + t.keterangan)) { tolak.takRelevan++; continue; }

      var hasil = olahTemuan(t, sudahAda, tolak, kuota, null, '', 'portal');
      if (hasil) {
        if (!hasil[4]) hasil[4] = namaPortal;
        baru.push(hasil);
        diterima++;
      }
    }

    tandaiPortal(dipilih[i].baris, butir.length, diterima);
  }

  tulisBaris(lembar, baru);
  catatJurnal('portal', dipilih.length, baru.length, tolak, kuota, mulai, '');
}

/**
 * Mengambil umpan RSS. Kalau yang diberi beranda, bentuk umpan yang lazim
 * dicoba satu per satu.
 *
 * Urutannya bukan acak: '/feed' dipakai WordPress, yang menopang sebagian
 * besar portal daerah di Indonesia. Yang paling sering berhasil dicoba lebih
 * dulu supaya kuota tidak habis pada percobaan yang hampir selalu gagal.
 */
function ambilUmpan(alamat, kuota) {
  var calon = [];

  if (/\/(feed|rss|atom)/i.test(alamat) || /[?&]feed=/i.test(alamat) || /\.xml$/i.test(alamat)) {
    calon.push(alamat);
  } else {
    var pokok = alamat.replace(/\/+$/, '');
    calon = [pokok + '/feed', pokok + '/rss', pokok + '/feed/', pokok + '/?feed=rss2', pokok + '/rss.xml'];
  }

  for (var i = 0; i < calon.length; i++) {
    if (kuota.ambil >= BATAS_AMBIL) return [];

    try {
      kuota.ambil++;
      var jawab = UrlFetchApp.fetch(calon[i], { muteHttpExceptions: true, followRedirects: true });
      Utilities.sleep(JEDA_MS);

      if (jawab.getResponseCode() !== 200) continue;

      var isi = jawab.getContentText();
      if (isi.indexOf('<item') === -1 && isi.indexOf('<entry') === -1) continue;

      return uraikanUmpan(isi);
    } catch (e) {
      Logger.log('Umpan gagal ' + calon[i] + ': ' + e);
    }
  }

  return [];
}

/* ════════════════════════════════════════════════════ pengolah bersama ══ */

/**
 * Satu butir temuan menjadi satu baris — atau ditolak, dengan sebabnya dicatat.
 *
 * Dikumpulkan di satu tempat supaya empat kaki menolak dengan aturan yang sama
 * persis. Aturan penolakan yang berbeda antar-kaki menghasilkan arsip yang
 * isinya bergantung pada kaki mana yang kebetulan menemukan lebih dulu.
 */
function olahTemuan(t, sudahAda, tolak, kuota, ragam, namaUnit, cara) {
  var teks = (t.judul + ' ' + (t.keterangan || ''));

  if (adaLembagaLain(teks)) { tolak.lembagaLain++; return null; }

  if (t.tanggal && UMUR_MAKS_HARI > 0) {
    var umur = (new Date().getTime() - t.tanggal.getTime()) / 86400000;
    if (umur > UMUR_MAKS_HARI) { tolak.terlaluLama++; return null; }
  }

  // Kaki per-unit menuntut namanya benar-benar disebut. Kueri "Lapas Kelas IIB
  // Ende" mengembalikan berita tentang KOTA Ende, dan menulisnya apa adanya
  // mengotori arsip dengan berita yang bukan urusan Pemasyarakatan.
  if (ragam && !menyebutSalahSatu(teks, ragam)) { tolak.takRelevan++; return null; }

  if (!ragam && !berjangkar(teks)) { tolak.takRelevan++; return null; }

  var url = uraikanAlamat(t, kuota);
  if (!url) { tolak.alamat++; return null; }

  var kunci = normalkanTautan(url);
  if (!kunci) { tolak.alamat++; return null; }
  if (sudahAda[kunci]) { tolak.kembar++; return null; }
  sudahAda[kunci] = true;

  var domain = domainDari(kunci);
  var tier = perkiraanTier(domain);

  return [
    new Date(),                    // Waktu Terdeteksi
    t.tanggal || '',               // Tanggal Berita
    t.judul,                       // Judul Berita
    kunci,                         // URL / Link Artikel
    t.sumber || domain,            // Sumber / Portal
    domain,                        // Domain
    tier,                          // Tier (perkiraan)
    namaUnit || '',                // Nama UPT
    KANWIL,                        // Kanwil
    '',                            // Tingkat Risiko  (diisi pusat/petugas)
    '',                            // Hasil Analisis  (diisi pusat/petugas)
    '',                            // Status Tindak Lanjut
    '',                            // Petugas Respon
    '',                            // Waktu Respon
    '',                            // Nama Petugas
    cara                           // Cara Dapat
  ];
}

/* ══════════════════════════════════════════════════ pencarian & umpan ══ */

/**
 * Batas umur DITITIPKAN KE KUERI, bukan disaring sesudah diunduh.
 *
 * Diukur pada jalan pertama Kanwil Jawa Timur, 8 September 2026: dari 1.200
 * butir yang diperiksa kaki unit, **1.075 ditolak karena terlalu lama** — dan
 * seluruhnya sudah terlanjur diunduh, diurai, dan dibandingkan lebih dulu.
 *
 * Sebabnya: pencarian Google News mengurutkan menurut RELEVANSI, bukan tanggal.
 * Kueri "Lapas Kediri" mengembalikan berita bertahun-tahun lalu di halaman
 * pertama. Operator `when:` menyaringnya di sisi Google, sehingga yang tiba
 * memang sudah yang dicari.
 */
function cariGoogleNews(kueri, kuota) {
  if (kuota.ambil >= BATAS_AMBIL) return [];

  var alamat = 'https://news.google.com/rss/search?q='
    + encodeURIComponent(kueri + ' when:' + UMUR_MAKS_HARI + 'd')
    + '&hl=id&gl=ID&ceid=ID:id';

  try {
    kuota.ambil++;
    var jawab = UrlFetchApp.fetch(alamat, { muteHttpExceptions: true });
    Utilities.sleep(JEDA_MS);

    if (jawab.getResponseCode() !== 200) return [];
    return uraikanUmpan(jawab.getContentText());
  } catch (e) {
    Logger.log('Gagal mencari: ' + e);
    return [];
  }
}

/**
 * Menguraikan RSS dan Atom sekaligus.
 *
 * XmlService dipakai lebih dulu karena ia benar; regex hanya cadangan untuk
 * umpan portal daerah yang XML-nya cacat — dan itu sering. Umpan yang cacat
 * bukan alasan melewatkan portalnya: justru portal begitu yang paling jarang
 * terindeks di tempat lain.
 */
function uraikanUmpan(isi) {
  var hasil = [];

  try {
    var akar = XmlService.parse(isi).getRootElement();
    var atom = XmlService.getNamespace('http://www.w3.org/2005/Atom');

    var butir = [];
    var saluran = akar.getChild('channel');
    if (saluran) butir = saluran.getChildren('item');
    if (!butir.length) butir = akar.getChildren('entry', atom);
    if (!butir.length) butir = akar.getChildren('item');

    for (var i = 0; i < butir.length; i++) {
      var b = butir[i];
      var judul = teksAnak(b, 'title', atom);
      var tautan = teksAnak(b, 'link', atom);

      if (!tautan) {
        var tl = b.getChild('link', atom);
        if (tl) tautan = tl.getAttribute('href') ? tl.getAttribute('href').getValue() : '';
      }

      var ket = teksAnak(b, 'description', atom) || teksAnak(b, 'summary', atom)
        || teksAnak(b, 'content', atom);
      var tgl = teksAnak(b, 'pubDate', atom) || teksAnak(b, 'published', atom)
        || teksAnak(b, 'updated', atom);

      var sumber = '';
      var s = b.getChild('source');
      if (s) sumber = s.getText();

      if (judul && tautan) {
        hasil.push({
          judul: bersihkan(judul),
          tautanRss: tautan.trim(),
          keterangan: ket || '',
          tanggal: uraikanTanggal(tgl),
          sumber: sumber
        });
      }
    }

    if (hasil.length) return hasil;
  } catch (e) {
    Logger.log('XML cacat, memakai cadangan: ' + e);
  }

  // Cadangan regex.
  var potongan = isi.split(/<item[\s>]|<entry[\s>]/i).slice(1);
  for (var k = 0; k < potongan.length; k++) {
    var p = potongan[k];
    var j = p.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    var l = p.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || p.match(/<link[^>]*href=["']([^"']+)["']/i);
    var d = p.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)
      || p.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
    var e2 = p.match(/<description[^>]*>([\s\S]*?)<\/description>/i);

    if (j && l) {
      hasil.push({
        judul: bersihkan(j[1]),
        tautanRss: bersihkan(l[1]),
        keterangan: e2 ? e2[1] : '',
        tanggal: d ? uraikanTanggal(bersihkan(d[1])) : null,
        sumber: ''
      });
    }
  }

  return hasil;
}

function teksAnak(induk, nama, ns) {
  var a = induk.getChild(nama);
  if (!a && ns) a = induk.getChild(nama, ns);
  return a ? a.getText() : '';
}

function bersihkan(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uraikanTanggal(s) {
  if (!s) return null;
  var t = new Date(s);
  return isNaN(t.getTime()) ? null : t;
}

/* ═══════════════════════════════════════════════════ penguraian alamat ══ */

/**
 * Alamat Google News harus diuraikan, dan yang gagal DIBUANG.
 *
 * RSS Google News memberi alamat pengalihan miliknya sendiri. Kalau itu yang
 * ditulis, SELURUH penyaringan kembar lolos: satu artikel tersimpan dua kali
 * karena keduanya memang alamat yang berbeda. Lebih baik kehilangan satu
 * berita daripada menanam satu kembaran yang tidak bisa dikenali lapis mana
 * pun sesudahnya.
 */
function uraikanAlamat(t, kuota) {
  var tautan = t.tautanRss;

  // Cara 1 — jangkar di dalam <description>. Tanpa permintaan jaringan.
  if (t.keterangan) {
    var cocok = String(t.keterangan).match(/href="(https?:\/\/[^"]+)"/i);
    if (cocok && cocok[1].indexOf('news.google.com') === -1) return cocok[1];
  }

  // Cara 2 — alamatnya memang sudah bukan Google News.
  if (tautan.indexOf('news.google.com') === -1) return tautan;

  var id = (tautan.match(/news\.google\.com\/(?:rss\/)?(?:articles|read)\/([^?#\/]+)/i) || [])[1];
  if (!id) return '';

  // Simpanan: alamat yang sama muncul di beberapa kueri sekaligus, dan
  // menguraikannya dua kali membayar kuota dua kali untuk jawaban yang sama.
  var simpanan = CacheService.getScriptCache();
  var kunciSimpan = 'g' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, id));
  var tersimpan = simpanan.get(kunciSimpan);
  if (tersimpan) return tersimpan === '-' ? '' : tersimpan;

  // Dua permintaan, bukan satu. Jangan mulai kalau jatahnya tidak cukup untuk
  // keduanya — langkah pertama tanpa langkah kedua hanya membuang kuota.
  if (kuota.ambil + 2 > BATAS_AMBIL) return '';

  var hasil = '';
  try {
    /* Langkah 1 — unduh halaman artikelnya, ambil tanda tangannya. */
    kuota.ambil++;
    var hal = UrlFetchApp.fetch(
      'https://news.google.com/rss/articles/' + id + '?hl=id&gl=ID&ceid=ID:id',
      { muteHttpExceptions: true, followRedirects: true });
    Utilities.sleep(JEDA_MS);

    if (hal.getResponseCode() === 200) {
      var isi = hal.getContentText();
      var sg = (isi.match(/data-n-a-sg="([^"]+)"/) || [])[1];
      var ts = (isi.match(/data-n-a-ts="([^"]+)"/) || [])[1];
      var aid = (isi.match(/data-n-a-id="([^"]+)"/) || [])[1] || id;

      /* Langkah 2 — tukar tanda tangan itu dengan alamat aslinya. */
      if (sg && ts) {
        var dalam = JSON.stringify([
          'garturlreq',
          [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
            'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
          aid, Number(ts), sg
        ]);
        var freq = JSON.stringify([[['Fbv4je', dalam, null, 'generic']]]);

        kuota.ambil++;
        var jwb = UrlFetchApp.fetch(
          'https://news.google.com/_/DotsSplashUi/data/batchexecute'
            + '?rpcids=Fbv4je&f.req=' + encodeURIComponent(freq),
          {
            method: 'post',
            payload: '',
            contentType: 'application/x-www-form-urlencoded',
            muteHttpExceptions: true
          });
        Utilities.sleep(JEDA_MS);

        if (jwb.getResponseCode() === 200) {
          // Jawabannya diawali ")]}'" yang sengaja membuat JSON.parse gagal bila
          // seseorang memuatnya sebagai skrip. Dibuang dulu, lalu diurai.
          var luar = JSON.parse(jwb.getContentText().replace(/^\)\]\}'\s*/, ''));

          for (var i = 0; i < luar.length; i++) {
            var baris = luar[i];
            if (!baris || typeof baris[2] !== 'string') continue;
            if (baris[2].indexOf('garturlres') === -1) continue;

            var jadi = JSON.parse(baris[2]);
            var url = String(jadi[1] || '');
            if (url && url.indexOf('news.google.com') === -1) { hasil = url; break; }
          }
        }
      }
    }
  } catch (e) {
    Logger.log('Gagal menguraikan alamat: ' + e);
  }

  // Kegagalan ikut disimpan. Alamat yang tidak bisa diuraikan hari ini hampir
  // selalu tetap begitu satu jam kemudian, dan mencobanya lagi hanya membayar
  // dua permintaan untuk jawaban yang sudah diketahui.
  try { simpanan.put(kunciSimpan, hasil || '-', 21600); } catch (e) { /* penuh */ }
  return hasil;
}

/**
 * Menyamakan bentuk alamat.
 *
 * Aturan yang BERWENANG ada di `public.normalkan_tautan()` di basis data.
 * Salinan di sini boleh meleset tanpa menimbulkan berita kembar — ia hanya
 * menghemat pekerjaan, sedangkan yang menolak tetap indeks unik di sana.
 */
function normalkanTautan(url) {
  if (!url) return '';
  var u = String(url).trim();
  if (!/^https?:\/\//i.test(u)) return '';

  u = u.split('#')[0];
  u = u.replace(/([?&])(utm_[^=]*|fbclid|gclid|igshid|ref|source)=[^&]*/gi, '$1');
  u = u.replace(/[?&]+$/, '').replace(/\?&/, '?');
  u = u.replace(/\/+$/, '');
  return u;
}

function domainDari(url) {
  var m = String(url || '').match(/^https?:\/\/([^\/:?]+)/i);
  if (!m) return '';
  return m[1].toLowerCase().replace(/^(www|m|amp)\./, '');
}

/**
 * Perkiraan tier untuk mata petugas.
 *
 * Menirukan `public.cari_tier_media()` di pusat: coba domain utuh dulu, lalu
 * induknya. Yang BERWENANG tetap di sana — kolom ini hanya supaya petugas bisa
 * membaca tingkat ancaman tanpa menunggu sinkronisasi.
 */
function perkiraanTier(domain) {
  if (!domain) return 4;

  var daftar = daftarTier();
  if (daftar[domain]) return daftar[domain].tier;

  var bagian = domain.split('.');
  var majemuk = ['co.id', 'go.id', 'or.id', 'ac.id', 'net.id', 'web.id', 'sch.id', 'my.id'];
  var minLabel = 2;
  if (bagian.length >= 3 && majemuk.indexOf(bagian.slice(-2).join('.')) !== -1) minLabel = 3;

  for (var i = 1; i <= bagian.length - minLabel; i++) {
    var induk = bagian.slice(i).join('.');
    if (daftar[induk]) {
      // Jaringan Radar selalu tingkat kabupaten, di jaringan mana pun.
      if (/^radar/.test(bagian[0])) return 3;
      if (daftar[induk].turun) return Math.min(daftar[induk].tier + 1, 4);
      return daftar[induk].tier;
    }
  }

  return 4;
}

var _daftarTier = null;
function daftarTier() {
  if (_daftarTier) return _daftarTier;
  _daftarTier = {};

  var l = SpreadsheetApp.getActive().getSheetByName(L_TIER);
  if (!l || l.getLastRow() < 2) return _daftarTier;

  var nilai = l.getRange(2, 1, l.getLastRow() - 1, 4).getValues();
  for (var i = 0; i < nilai.length; i++) {
    var d = String(nilai[i][0] || '').trim().toLowerCase();
    if (!d) continue;
    _daftarTier[d] = { tier: Number(nilai[i][2]) || 4, turun: nilai[i][3] === true };
  }
  return _daftarTier;
}

/* ══════════════════════════════════════════════════════ penyaring teks ══ */

/** Batas kata, bukan `indexOf`. Lihat catatan One Piece di kepala berkas. */
function berbatasKata(teks, kata) {
  var pola = new RegExp('(^|[^a-z0-9])' + kata.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    + '([^a-z0-9]|$)', 'i');
  return pola.test(teks);
}

function berjangkar(teks) {
  var t = String(teks || '').toLowerCase();
  for (var i = 0; i < JANGKAR_FRASA.length; i++) {
    if (t.indexOf(JANGKAR_FRASA[i]) !== -1) return true;
  }
  for (var j = 0; j < JANGKAR.length; j++) {
    if (berbatasKata(t, JANGKAR[j])) return true;
  }
  return false;
}

function menyebutSalahSatu(teks, daftar) {
  var t = String(teks || '').toLowerCase();
  for (var i = 0; i < daftar.length; i++) {
    var d = String(daftar[i] || '').trim().toLowerCase();
    if (d && t.indexOf(d) !== -1) return true;
  }
  return false;
}

function adaLembagaLain(teks) {
  var t = String(teks || '').toLowerCase();
  for (var i = 0; i < LEMBAGA_LAIN.length; i++) {
    if (t.indexOf(LEMBAGA_LAIN[i]) !== -1) return true;
  }
  return false;
}

/* ══════════════════════════════════════════════════ sasaran & penulisan ══ */

function petaTolak() {
  return { takRelevan: 0, kembar: 0, alamat: 0, lembagaLain: 0, terlaluLama: 0, kuota: 0 };
}

/**
 * Membaca lembar sasaran beserta kolom "terakhir diperiksa" dan "aktif".
 */
function bacaSasaran(namaLembar, kolomWaktu, kolomAktif) {
  var l = SpreadsheetApp.getActive().getSheetByName(namaLembar);
  var kosong = { lembar: null, baris: [] };
  if (!l || l.getLastRow() < 2) return kosong;

  var lebar = l.getLastColumn();
  var nilai = l.getRange(2, 1, l.getLastRow() - 1, lebar).getValues();
  var baris = [];

  for (var i = 0; i < nilai.length; i++) {
    if (!String(nilai[i][0] || '').trim()) continue;
    if (nilai[i][kolomAktif - 1] === false) continue;

    baris.push({
      baris: i + 2,
      nilai: nilai[i],
      terakhir: nilai[i][kolomWaktu - 1] instanceof Date
        ? nilai[i][kolomWaktu - 1].getTime()
        : 0
    });
  }

  return { lembar: l, baris: baris };
}

/**
 * Yang PALING LAMA tidak diperiksa dikerjakan lebih dulu.
 *
 * Bukan urutan tetap: daftar yang disunting di tengah jalan akan membuat
 * sebagian sasaran terlewat selamanya kalau penunjuknya bergeser.
 */
function pilihSasaran(target, berapa) {
  var urut = target.baris.slice().sort(function (a, b) { return a.terakhir - b.terakhir; });
  return urut.slice(0, berapa);
}

function tandaiDiperiksa(namaLembar, nomorBaris, kolomWaktu, kolomJumlah, ditemukan) {
  var l = SpreadsheetApp.getActive().getSheetByName(namaLembar);
  if (!l) return;
  l.getRange(nomorBaris, kolomWaktu).setValue(new Date());
  if (kolomJumlah) {
    var lama = Number(l.getRange(nomorBaris, kolomJumlah).getValue()) || 0;
    l.getRange(nomorBaris, kolomJumlah).setValue(lama + (ditemukan || 0));
  }
}

function tandaiPortal(nomorBaris, terlihat, diterima) {
  var l = SpreadsheetApp.getActive().getSheetByName(L_PORTAL);
  if (!l) return;
  l.getRange(nomorBaris, 4).setValue(new Date());
  l.getRange(nomorBaris, 5).setValue(terlihat || 0);
  var lama = Number(l.getRange(nomorBaris, 6).getValue()) || 0;
  l.getRange(nomorBaris, 6).setValue(lama + (diterima || 0));
}

/**
 * Alamat yang sudah ada di lembar ini.
 *
 * Ini lapis pertama dari tiga. Lapis kedua ada di penyalin pusat, lapis ketiga
 * indeks unik `link_normalized` di basis data. Hanya lapis ketiga yang MENOLAK;
 * dua lapis pertama menghemat pekerjaan.
 */
function alamatYangSudahAda(lembar) {
  var peta = {};
  if (lembar.getLastRow() < 2) return peta;

  var nilai = lembar.getRange(2, 4, lembar.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < nilai.length; i++) {
    var k = normalkanTautan(nilai[i][0]);
    if (k) peta[k] = true;
  }
  return peta;
}

function tulisBaris(lembar, baris) {
  if (!baris.length) return;
  lembar.getRange(lembar.getLastRow() + 1, 1, baris.length, KOLOM.length).setValues(baris);
}

function catatJurnal(kaki, sasaran, baru, tolak, kuota, mulai, pesan) {
  var l = SpreadsheetApp.getActive().getSheetByName(L_JURNAL);
  if (!l) return;

  l.appendRow([
    new Date(), kaki, sasaran, baru,
    tolak.takRelevan, tolak.kembar, tolak.alamat, tolak.lembagaLain, tolak.terlaluLama,
    kuota.ambil,
    Math.round((new Date().getTime() - mulai.getTime()) / 1000),
    pesan || ''
  ]);
}
