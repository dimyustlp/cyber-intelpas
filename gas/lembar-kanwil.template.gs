/**
 * ============================================================================
 * LEMBAR KANWIL — Trans-Siber PAS
 * ============================================================================
 *
 * Satu berkas ini menjadikan spreadsheet kosong sebagai ruang kerja wilayah:
 * ia membangun formatnya sendiri, menjaring portal hiperlokal wilayahnya, dan
 * menyediakan dua daftar yang hanya orang daerah bisa mengisinya.
 *
 * ----------------------------------------------------------------------------
 * KENAPA HANYA SATU KAKI, PADAHAL DULU EMPAT
 * ----------------------------------------------------------------------------
 *
 * Versi 1.0 dan 1.1 punya empat kaki: per unit, per kota, per isu, dan portal.
 * Tiga yang pertama bertanya kepada Google News. Ketiganya dibuang di v2.0, dan
 * sebabnya terukur, bukan selera.
 *
 * RSS Google News tidak memberi alamat artikel — ia memberi alamat pengalihan
 * miliknya sendiri, yang harus ditukar lewat dua langkah ke titik
 * `batchexecute`. Diukur 8 September 2026, pada menit yang sama:
 *
 *     dari basis data (Edge Function `penjaring`)  ->  100% berhasil, tiap jam
 *     dari Apps Script (berkas ini)                ->  0% berhasil, 115 dari 115
 *
 * Jadi tiga kaki itu bukan kurang disetel — dari sini mereka MUSTAHIL berhasil.
 * Jurnalnya tetap hijau, "Baris Baru" tetap nol, dan tidak ada satu pun galat:
 * bentuk kegagalan yang paling mahal, sebab ia terlihat persis seperti "memang
 * tidak ada beritanya".
 *
 * Ini bayangan cermin dari temuan 6 September, ketika Google menolak Edge
 * Function tetapi menerima basis data. Pelajarannya sama: yang menentukan bukan
 * kodenya, melainkan dari mana permintaannya berangkat.
 *
 * Pencarian per unit kini dikerjakan pusat lewat mode `ragam` — dan justru
 * memakai sebutan yang Anda kurasi di lembar ini.
 *
 * ----------------------------------------------------------------------------
 * PEMBAGIAN KERJA YANG SEKARANG
 * ----------------------------------------------------------------------------
 *
 *   di lembar ini (daerah)          di pusat
 *   ------------------------------  ------------------------------------------
 *   kurasi Ragam Nama unit          pencarian per unit (mode `ragam`)
 *   kurasi Portal Wilayah           pencarian kata kunci & isu
 *   jaring RSS portal hiperlokal    penguraian alamat Google News
 *   —                               sentimen, kategori, urgensi (v4.5)
 *   —                               tier media, dedup, Telegram
 *
 * Kaki portal tetap di sini karena ia satu-satunya yang TIDAK bertanya kepada
 * Google: portal hiperlokal memberi alamat aslinya langsung di RSS-nya. Terukur
 * pada jalan pertama: nol gagal alamat, dan ia satu-satunya kaki yang berhasil
 * memasukkan berita.
 *
 * ----------------------------------------------------------------------------
 * DUA DAFTAR YANG HANYA ANDA BISA MENGISINYA
 * ----------------------------------------------------------------------------
 *
 * Inilah nilai sesungguhnya lembar ini, dan tidak ada di tempat lain:
 *
 *   Ragam Nama      "Medaeng" untuk Rutan Kelas I Surabaya tidak ada pada data
 *                   induk mana pun. Mesin bisa menurunkan "Rutan Surabaya" dan
 *                   "Rumah Tahanan Surabaya"; nama panggilan setempat hanya
 *                   diketahui orang yang bekerja di sana.
 *
 *   Portal Wilayah  Portal kabupaten yang tidak terindeks Google News sama
 *                   sekali. Selama ia tidak ada di daftar ini, ia tidak ada.
 *
 * Diukur 6 September 2026: 343 dari 531 unit tidak pernah sekali pun muncul di
 * arsip. Bukan karena tidak ada beritanya — karena tidak pernah dicari dengan
 * nama yang sungguh dipakai orang.
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
 * v2.1 — JANGKAR WILAYAH
 * ----------------------------------------------------------------------------
 *
 * Jangkar kata Pemasyarakatan menjawab "apakah ini urusan kita", bukan "apakah
 * ini wilayah kita". Diukur 9 September 2026 di lembar Jawa Timur: satu portal
 * jaringan memasukkan belasan berita Lapas Kalimantan Selatan dan Timur —
 * semuanya lolos, sebab semuanya benar berita Pemasyarakatan.
 *
 * Kaki portal kini menolak butir yang tidak menyebut satu pun unit,
 * kabupaten/kota, atau provinsi kanwil ini (`diWilayah`). Daftarnya diturunkan
 * dari `UNIT` dan `PROVINSI`, jadi ragam nama yang dikurasi daerah ikut
 * memperluasnya. Penolakannya tercatat di Jurnal kolom "Tolak: Luar Wilayah" —
 * bila besar untuk satu portal, portal itu bukan hiperlokal wilayah ini.
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

var VERSI = 'lembar-kanwil-v2.1';

var L_BERITA = 'Berita';
var L_UNIT   = 'Target Unit';
var L_PORTAL = 'Portal Wilayah';
var L_TIER   = 'Tier Media';
var L_JURNAL = 'Jurnal';
var L_INFO   = 'Petunjuk';

/**
 * Berapa portal dikerjakan sekali jalan.
 *
 * Apps Script memotong satu jalan pada enam menit, dan satu umpan portal bisa
 * memakan beberapa detik ketika portalnya lambat. Jalan yang terpotong
 * meninggalkan penunjuk sasaran pada keadaan yang tidak jelas sudah maju atau
 * belum, dan yang terlewat selalu portal yang sama.
 */
var PORTAL_PER_JALAN = 12;

/** Berita lebih tua dari ini dilewati; arsip lama bukan tugas penjaring. */
var UMUR_MAKS_HARI = 30;

/** Batas panggilan jaringan sekali jalan. Yang dijaga batas WAKTU, bukan kuota harian. */
var BATAS_AMBIL = 130;

/** Jeda antar-permintaan, milidetik. Menjaga agar tidak dianggap serangan. */
var JEDA_MS = 200;

/**
 * Jangkar kata: sebuah berita dianggap urusan Pemasyarakatan bila memuat
 * salah satunya.
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
 * Jangkar WILAYAH: sebuah berita portal baru diterima bila ia menyebut unit,
 * kabupaten/kota, atau provinsi kanwil INI.
 *
 * ----------------------------------------------------------------------------
 * KENAPA PERLU, PADAHAL PORTALNYA SUDAH HIPERLOKAL
 * ----------------------------------------------------------------------------
 *
 * Sebagian portal di lembar Portal Wilayah ternyata bukan hiperlokal satu
 * kabupaten — ia jaringan yang menerbitkan berita Pemasyarakatan dari banyak
 * provinsi sekaligus. Diukur 9 September 2026 di lembar Jawa Timur: satu portal
 * memasukkan belasan berita Lapas Kotabaru, Karang Intan, Amuntai, dan Bontang
 * — seluruhnya Kalimantan. Jangkar kata Pemasyarakatan meloloskannya karena
 * memang benar berita Pemasyarakatan; yang tidak benar adalah WILAYAHNYA.
 *
 * Daftar ini diturunkan dari `UNIT` dan `PROVINSI` yang sudah disuntik pabrik,
 * jadi ia ikut tumbuh setiap kali petugas daerah menambah ragam nama di lembar
 * Target Unit. Pencocokannya berbatas kata, sama seperti JANGKAR.
 *
 * Fail-open: bila daftarnya kosong (konfig belum tersuntik), `diWilayah`
 * mengembalikan true supaya tidak menolak segalanya tanpa sebab yang terlihat.
 */
var _wilayahJangkar = null;

function wilayahJangkar() {
  if (_wilayahJangkar) return _wilayahJangkar;

  var set = {};
  var tambah = function (nilai) {
    var v = String(nilai || '').toLowerCase()
      .replace(/^(kota administrasi|kota|kabupaten|kab\.?)\s+/i, '')
      .trim();
    if (v.length >= 4) set[v] = true;
  };

  if (typeof PROVINSI === 'string') tambah(PROVINSI);

  if (typeof UNIT !== 'undefined' && UNIT && UNIT.length) {
    for (var i = 0; i < UNIT.length; i++) {
      var u = UNIT[i];
      tambah(u.nama);
      tambah(u.kota);
      var alias = u.alias || [];
      for (var j = 0; j < alias.length; j++) tambah(alias[j]);
    }
  }

  _wilayahJangkar = Object.keys(set);
  return _wilayahJangkar;
}

function diWilayah(teks) {
  var daftar = wilayahJangkar();
  if (!daftar.length) return true;
  var t = String(teks || '').toLowerCase();
  for (var i = 0; i < daftar.length; i++) {
    if (berbatasKata(t, daftar[i])) return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════ menu & pemicu ══ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Trans-Siber PAS')
    .addItem('Jaring portal wilayah (sekarang)', 'jaringPortal')
    .addSeparator()
    .addItem('Siapkan / perbaiki format lembar', 'siapkanLembar')
    .addItem('Pasang / perbarui pemicu', 'pasangPemicu')
    .addToUi();
}

/**
 * Dijalankan SEKALI dengan tangan.
 *
 * Dua kali sehari, bukan sekali: portal hiperlokal menerbitkan sepanjang hari
 * dan umpannya pendek — yang terbit pagi sudah tergeser keluar umpan menjelang
 * malam.
 */
function pasangPemicu() {
  ScriptApp.getProjectTriggers().forEach(function (p) {
    if (p.getHandlerFunction() === 'jaringPortal') ScriptApp.deleteTrigger(p);
  });

  ScriptApp.newTrigger('jaringPortal').timeBased().atHour(6).everyDays(1).create();
  ScriptApp.newTrigger('jaringPortal').timeBased().atHour(18).everyDays(1).create();

  SpreadsheetApp.getActive().toast('Pemicu terpasang: portal 06.00 dan 18.00.', VERSI, 10);
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
    .setWrap(true)
    .setHorizontalAlignment('center');

  l.setFrozenRows(1);
  l.setFrozenColumns(3);

  var lebar = [150, 110, 420, 300, 160, 170, 110, 240, 200, 110, 320, 150, 140, 130, 140, 110];
  for (var i = 0; i < lebar.length; i++) l.setColumnWidth(i + 1, lebar[i]);

  if (l.getMaxRows() > 1) {
    l.getRange(2, 1, l.getMaxRows() - 1, KOLOM.length).setVerticalAlignment('top').setFontSize(10);
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

  l.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=' + G + '=1').setBackground('#fce4e4').setRanges([jangkauan]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=' + G + '=2').setBackground('#fdead1').setRanges([jangkauan]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=' + G + '=3').setBackground('#fff8e1').setRanges([jangkauan]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=' + G + '=4').setBackground('#eef7ee').setRanges([jangkauan]).build()
  ]);
}

function siapkanTargetUnit(berkas) {
  var l = berkas.getSheetByName(L_UNIT);
  var baru = !l;
  if (!l) l = berkas.insertSheet(L_UNIT);

  var judul = ['Nama UPT (resmi)', 'Jenis', 'Kabupaten/Kota', 'Ragam Nama (dipisah ;)',
               'Sudah Dikirim ke Pusat', 'Catatan'];
  l.getRange(1, 1, 1, judul.length).setValues([judul])
    .setFontWeight('bold').setBackground('#e8eaf6');
  l.setFrozenRows(1);

  // Isi hanya saat pertama dibuat. Kalau tidak, ragam nama yang disunting
  // petugas — yang justru paling berharga — akan tertimpa tiap kali format
  // lembar diperbaiki.
  if (baru && UNIT.length) {
    var baris = UNIT.map(function (u) {
      return [u.nama, u.jenis, u.kota, u.alias.join('; '), false, ''];
    });
    l.getRange(2, 1, baris.length, judul.length).setValues(baris);
  }

  l.setColumnWidth(1, 300); l.setColumnWidth(3, 180); l.setColumnWidth(4, 440);
  l.setTabColor('#3949ab');

  if (baru) {
    l.getRange(1, 4).setNote(
      'INILAH SUNTINGAN YANG PALING BERPENGARUH DI SELURUH LEMBAR INI.\n\n'
      + 'Mesin sudah menurunkan bentuk yang bisa ditebak: "Lapas Kediri", '
      + '"Penjara Kediri", "LP Kediri".\n\n'
      + 'Yang TIDAK bisa ditebak mesin adalah nama panggilan setempat — '
      + '"Medaeng" untuk Rutan Kelas I Surabaya tidak ada pada data induk mana '
      + 'pun. Satu nama panggilan yang benar sering membuka berita yang '
      + 'bertahun-tahun tidak pernah tertangkap.\n\n'
      + 'JANGAN PERNAH menulis nama daerah sendirian ("Kediri"). Itu akan '
      + 'meloloskan seluruh berita kota itu — termasuk jadwal pertandingan '
      + 'sepak bola — ke arsip intelijen.\n\n'
      + 'Pisahkan dengan titik-koma. Kirimkan perubahannya ke admin pusat '
      + 'untuk dimasukkan ke kolom alias pada penjaring_sasaran.');
  }
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
      + 'akan mencoba /feed, /rss, /feed/, dan ?feed=rss2 satu per satu.\n\n'
      + 'DI SINILAH lapisan terbawah ditambahkan. Portal hiperlokal kabupaten '
      + 'yang tidak terindeks Google News hanya bisa masuk lewat daftar ini — '
      + 'pencarian pusat pun tidak akan pernah menemukannya.\n\n'
      + 'Kalau alamatnya keliru, tidak ada yang rusak: kolom "Butir Terlihat" '
      + 'tetap 0 dan Anda tahu harus menggantinya.');
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

  var judul = ['Waktu', 'Kaki', 'Portal Diperiksa', 'Baris Baru', 'Tolak: Tak Relevan',
               'Tolak: Kembar', 'Tolak: Alamat', 'Tolak: Lembaga Lain', 'Tolak: Luar Wilayah',
               'Tolak: Terlalu Lama',
               'Panggilan Jaringan', 'Lama (detik)', 'Pesan'];
  l.getRange(1, 1, 1, judul.length).setValues([judul])
    .setFontWeight('bold').setBackground('#eceff1');
  l.setFrozenRows(1);
  l.getRange(2, 1, Math.max(l.getMaxRows() - 1, 1), 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  l.setColumnWidth(judul.length, 460);
  l.setTabColor('#607d8b');

  l.getRange(1, 5).setNote(
    'Angka ini BESAR menandakan SEHAT. Umpan portal memuat seluruh terbitan '
    + 'portalnya — olahraga, pilkada, kuliner — dan yang menyaring hanya jangkar '
    + 'kata Pemasyarakatan.\n\n'
    + 'Yang menandakan rusak justru sebaliknya: "Portal Diperiksa" terisi tapi '
    + '"Panggilan Jaringan" nol.');

  l.getRange(1, 9).setNote(
    'Berita Pemasyarakatan dari provinsi lain yang ditolak. Bila angka ini '
    + 'BESAR untuk satu portal, portal itu bukan hiperlokal wilayah ini — '
    + 'pertimbangkan menonaktifkannya di lembar Portal Wilayah.\n\n'
    + 'Penyaringnya memakai nama unit, kabupaten/kota, dan provinsi kanwil ini. '
    + 'Kalau berita wilayah sendiri ikut tertolak, tambahkan ragam namanya di '
    + 'lembar Target Unit.');
}

function siapkanPetunjuk(berkas) {
  var l = berkas.getSheetByName(L_INFO);
  if (l) return;
  l = berkas.insertSheet(L_INFO);

  var isi = [
    ['LEMBAR KANWIL — ' + KANWIL],
    [''],
    ['Lembar ini mengerjakan dua hal, dan keduanya tidak bisa dikerjakan pusat.'],
    [''],
    ['1. MENJARING PORTAL HIPERLOKAL'],
    ['   Portal kabupaten yang tidak terindeks Google News tidak akan pernah'],
    ['   ditemukan pencarian pusat. Hanya daftar Portal Wilayah di lembar ini'],
    ['   yang bisa memasukkannya.'],
    [''],
    ['2. MENGURASI RAGAM NAMA UNIT'],
    ['   "Medaeng" untuk Rutan Kelas I Surabaya tidak ada pada data induk mana'],
    ['   pun. Pusat mencari dengan nama yang Anda tuliskan di sini.'],
    [''],
    ['Penilaian sentimen, kategori, urgensi, tier media, dan pengiriman'],
    ['Telegram dikerjakan di pusat — tidak ada satu pun di lembar ini.'],
    [''],
    ['YANG BOLEH DISUNTING PETUGAS'],
    ['  Target Unit    — kolom "Ragam Nama". Sunting paling berpengaruh.'],
    ['  Portal Wilayah — tambahkan portal hiperlokal kabupaten.'],
    ['  Berita         — Nama UPT, Tingkat Risiko, Hasil Analisis,'],
    ['                   Status Tindak Lanjut, Petugas Respon, Nama Petugas.'],
    [''],
    ['YANG JANGAN DISENTUH'],
    ['  Judul kolom pada lembar Berita. Penyalin pusat mencocokkan nama kolom;'],
    ['  judul yang diubah membuat kolom itu hilang tanpa satu pun galat.'],
    ['  Kolom Domain dan Tier diisi mesin dan akan ditimpa.'],
    [''],
    ['KALAU BERITA TIDAK BERTAMBAH'],
    ['  Buka lembar Jurnal. Kalau "Panggilan Jaringan" nol, penjaringnya tidak'],
    ['  berjalan — periksa pemicu. Kalau "Tolak: Tak Relevan" besar, itu SEHAT:'],
    ['  umpan portal memang sebagian besar bukan urusan Pemasyarakatan.'],
    [''],
    ['Versi: ' + VERSI]
  ];

  l.getRange(1, 1, isi.length, 1).setValues(isi);
  l.getRange(1, 1).setFontSize(14).setFontWeight('bold');
  l.getRange(5, 1).setFontWeight('bold');
  l.getRange(10, 1).setFontWeight('bold');
  l.getRange(17, 1).setFontWeight('bold');
  l.getRange(23, 1).setFontWeight('bold');
  l.getRange(28, 1).setFontWeight('bold');
  l.setColumnWidth(1, 720);
  l.setTabColor('#9e9e9e');
  l.setFrozenRows(1);
}

/* ═══════════════════════════════════ penjaring portal wilayah ══ */

/**
 * Membaca RSS portal langsung, tanpa lewat Google sama sekali.
 *
 * Inilah satu-satunya kaki yang tersisa, dan satu-satunya yang pernah berhasil
 * dari Apps Script. Portal memberi alamat aslinya langsung di RSS-nya, jadi
 * tidak ada yang perlu diuraikan — dan di situlah tiga kaki Google gagal.
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
      var hasil = olahTemuan(butir[j], sudahAda, tolak);
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

/**
 * Satu butir temuan menjadi satu baris — atau ditolak, dengan sebabnya dicatat.
 *
 * Jangkar diperiksa PALING DULU, sebelum apa pun yang lain. Umpan portal
 * isinya sebagian besar bukan urusan kita, dan memeriksa yang lain lebih dulu
 * berarti bekerja untuk berita kuliner.
 */
function olahTemuan(t, sudahAda, tolak) {
  var teks = t.judul + ' ' + (t.keterangan || '');

  if (!berjangkar(teks)) { tolak.takRelevan++; return null; }
  if (adaLembagaLain(teks)) { tolak.lembagaLain++; return null; }

  // Berita Pemasyarakatan dari provinsi lain: portal jaringan memasukkannya
  // sama derasnya dengan berita wilayah sendiri. Lihat wilayahJangkar().
  if (!diWilayah(teks)) { tolak.luarWilayah++; return null; }

  if (t.tanggal && UMUR_MAKS_HARI > 0) {
    var umur = (new Date().getTime() - t.tanggal.getTime()) / 86400000;
    if (umur > UMUR_MAKS_HARI) { tolak.terlaluLama++; return null; }
  }

  // Portal memberi alamat aslinya langsung. Kalau yang datang justru alamat
  // Google News, butirnya DIBUANG — menanamnya berarti menanam kembaran yang
  // tidak bisa dikenali lapis penyaringan mana pun sesudahnya.
  var url = t.tautan;
  if (!url || url.indexOf('news.google.com') !== -1) { tolak.alamat++; return null; }

  var kunci = normalkanTautan(url);
  if (!kunci) { tolak.alamat++; return null; }
  if (sudahAda[kunci]) { tolak.kembar++; return null; }
  sudahAda[kunci] = true;

  var domain = domainDari(kunci);

  return [
    new Date(), t.tanggal || '', t.judul, kunci, t.sumber || domain, domain,
    perkiraanTier(domain), '', KANWIL, '', '', '', '', '', '', 'portal'
  ];
}

/* ══════════════════════════════════════════════════════ penguraian umpan ══ */

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
        if (tl && tl.getAttribute('href')) tautan = tl.getAttribute('href').getValue();
      }

      var ket = teksAnak(b, 'description', atom) || teksAnak(b, 'summary', atom)
        || teksAnak(b, 'content', atom);
      var tgl = teksAnak(b, 'pubDate', atom) || teksAnak(b, 'published', atom)
        || teksAnak(b, 'updated', atom);

      if (judul && tautan) {
        hasil.push({
          judul: bersihkan(judul),
          tautan: String(tautan).trim(),
          keterangan: ket || '',
          tanggal: uraikanTanggal(tgl),
          sumber: ''
        });
      }
    }

    if (hasil.length) return hasil;
  } catch (e) {
    Logger.log('XML cacat, memakai cadangan: ' + e);
  }

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
        tautan: bersihkan(l[1]),
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

function adaLembagaLain(teks) {
  var t = String(teks || '').toLowerCase();
  for (var i = 0; i < LEMBAGA_LAIN.length; i++) {
    if (t.indexOf(LEMBAGA_LAIN[i]) !== -1) return true;
  }
  return false;
}

/* ══════════════════════════════════════════════════ sasaran & penulisan ══ */

function petaTolak() {
  return {
    takRelevan: 0, kembar: 0, alamat: 0, lembagaLain: 0, luarWilayah: 0,
    terlaluLama: 0, kuota: 0
  };
}

function bacaSasaran(namaLembar, kolomWaktu, kolomAktif) {
  var l = SpreadsheetApp.getActive().getSheetByName(namaLembar);
  var kosong = { lembar: null, baris: [] };
  if (!l || l.getLastRow() < 2) return kosong;

  var nilai = l.getRange(2, 1, l.getLastRow() - 1, l.getLastColumn()).getValues();
  var baris = [];

  for (var i = 0; i < nilai.length; i++) {
    if (!String(nilai[i][0] || '').trim()) continue;
    if (nilai[i][kolomAktif - 1] === false) continue;

    baris.push({
      baris: i + 2,
      nilai: nilai[i],
      terakhir: nilai[i][kolomWaktu - 1] instanceof Date ? nilai[i][kolomWaktu - 1].getTime() : 0
    });
  }

  return { lembar: l, baris: baris };
}

/**
 * Yang PALING LAMA tidak diperiksa dikerjakan lebih dulu.
 *
 * Bukan urutan tetap: daftar yang disunting di tengah jalan akan membuat
 * sebagian portal terlewat selamanya kalau penunjuknya bergeser.
 */
function pilihSasaran(target, berapa) {
  return target.baris.slice()
    .sort(function (a, b) { return a.terakhir - b.terakhir; })
    .slice(0, berapa);
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
    tolak.takRelevan, tolak.kembar, tolak.alamat, tolak.lembagaLain, tolak.luarWilayah,
    tolak.terlaluLama,
    kuota.ambil,
    Math.round((new Date().getTime() - mulai.getTime()) / 1000),
    pesan || ''
  ]);
}
