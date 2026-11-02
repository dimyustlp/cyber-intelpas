/**
 * ============================================================================
 * LEMBAR KANWIL v3 — Trans-Siber PAS
 * ============================================================================
 *
 * Satu berkas untuk dua peran. Ditempel SEKALI ke satu spreadsheet — lembar
 * induk — lalu lembar induk itulah yang melahirkan 32 lembar kanwil, beserta
 * salinan skrip ini di masing-masing.
 *
 * ----------------------------------------------------------------------------
 * KENAPA BERUBAH DARI v2.1 (LEMBAR JAWA TIMUR)
 * ----------------------------------------------------------------------------
 *
 * v2.1 dirancang untuk satu kanwil, dan bekerja baik untuk satu kanwil. Tiga
 * hal berhenti benar begitu ia digandakan menjadi 33:
 *
 *   1. KUOTA DIHITUNG PER AKUN, BUKAN PER SKRIP. Google memberi akun pribadi
 *      90 menit waktu pemicu per hari untuk SELURUH skripnya. 33 skrip yang
 *      masing-masing menjaring dua kali sehari menghabiskannya sebelum sore,
 *      dan yang berhenti tidak memberi tahu apa pun: pemicu gagal diam-diam,
 *      Jurnal berhenti bertambah, lembar terlihat seperti "sepi berita".
 *      v3 menjaring dari SATU tempat — lembar induk — bergiliran, dengan batas
 *      menit harian yang dihitung sendiri (BATAS_MENIT_HARIAN).
 *
 *   2. NAMA UPT KOSONG MEMBUAT BERITA HILANG DARI RUANG KANWIL. `kanwil_asal`
 *      di pusat diturunkan dari kolom Nama UPT, bukan dari kolom Kanwil. v2.1
 *      membiarkan kolom itu kosong pada setiap baris portal, sehingga berita
 *      yang dijaring lembar kanwil justru tidak tampak di halaman kanwilnya
 *      sendiri — tanpa galat. v3 mengisinya bila judul menyebut TEPAT SATU unit
 *      (ragam nama yang dikurasi daerah ikut dihitung). Bila dua unit sama-sama
 *      disebut, kolom dibiarkan kosong: tebakan yang salah lebih mahal daripada
 *      kosong, sebab kosong masih masuk antrean Pemetaan UPT di pusat.
 *
 *   3. 33 BERKAS SUNTIKAN MENYIMPANG SATU PER SATU. v2.1 menyuntik daftar unit
 *      ke dalam kode, sehingga tiap kanwil memegang berkas yang berbeda. v3
 *      memakai kode yang SAMA PERSIS di semua lembar; yang membedakan hanya
 *      lembar tersembunyi `_Konfigurasi` yang ditulis lembar induk.
 *
 * Yang dipertahankan utuh dari v2.1: hanya kaki portal (Google News dicabut
 * di v2.0 — dari Apps Script penguraiannya gagal 115 dari 115), jangkar kata
 * berbatas kata, jangkar wilayah, dan judul kolom Berita yang menjadi kontrak
 * dengan `sheet-sync`.
 *
 * Yang ditambahkan:
 *   - lembar Ringkasan (angka tier, unit sunyi, baris yang belum terpetakan)
 *   - judul kolom Berita dikunci (peringatan), sebab judul yang diganti membuat
 *     kolomnya hilang dari penyalin pusat tanpa satu pun galat
 *   - pilihan baku untuk Tingkat Risiko, Status Tindak Lanjut, dan Nama UPT
 *   - portal yang gagal 5 kali berturut-turut dinonaktifkan sendiri, dengan
 *     catatan sebabnya — daripada menghabiskan kuota setiap jalan
 *   - ragam nama yang berupa nama daerah sendirian langsung ditandai merah
 *     saat diketik (lihat onEdit)
 *
 * ----------------------------------------------------------------------------
 * CARA MEMASANG (sekali, sekitar lima menit)
 * ----------------------------------------------------------------------------
 *
 *   1. Buka spreadsheet "Trans-Siber PAS — Lembar Induk Kanwil"
 *   2. Ekstensi -> Apps Script, hapus isi Code.gs, tempel SELURUH berkas ini
 *   3. Simpan, pilih fungsi `pasangSemua`, tekan Jalankan, beri izin
 *   4. Tunggu. Lembar Daftar Lembar terisi sendiri, beberapa menit sekali,
 *      sampai seluruh kanwil berstatus Siap
 *
 * Tidak ada langkah berbagi dan tidak ada pemicu yang dipasang per kanwil:
 * lembar induk mengerjakan keduanya.
 */

/* ═════════════════════════════════════════════════ data seluruh kanwil ══ */
/*  Bagian ini DISUNTIK oleh tools/susun-induk-kanwil.mjs dari data induk.   */
/*  Jangan menyuntingnya dengan tangan: jalankan ulang pabriknya.            */

/*__SUNTIK_DATA__*/

/* ═══════════════════════════════════════════════════════════ setelan ══ */

var VERSI = 'lembar-kanwil-v3.0';

var L_BERITA = 'Berita';
var L_RINGKAS = 'Ringkasan';
var L_UNIT = 'Target Unit';
var L_PORTAL = 'Portal Wilayah';
var L_TIER = 'Tier Media';
var L_JURNAL = 'Jurnal';
var L_INFO = 'Petunjuk';
var L_KONFIG = '_Konfigurasi';

var L_DAFTAR = 'Daftar Lembar';
var L_JURNAL_INDUK = 'Jurnal Induk';
var L_INFO_INDUK = 'Petunjuk Induk';

/** Lembar yang hanya milik induk. Dihapus dari setiap salinan kanwil. */
var LEMBAR_INDUK_SAJA = [L_DAFTAR, L_JURNAL_INDUK, L_INFO_INDUK];

var NAMA_FOLDER = 'Trans-Siber PAS — Lembar Kanwil';
var AWALAN_JUDUL = 'Trans-Siber PAS — Kanwil ';

/**
 * Batas satu jalan. Apps Script memotong pada enam menit; satu setengah menit
 * cadangan dipakai untuk menulis Daftar dan Jurnal. Jalan yang terpotong di
 * tengah menulis tidak meninggalkan catatan apa pun tentang apa yang sudah
 * dikerjakannya.
 */
var BATAS_JALAN_MS = 4.5 * 60 * 1000;

/**
 * Batas menit harian lembar induk. Akun Google pribadi punya 90 menit waktu
 * pemicu per hari untuk SEMUA skripnya; 30 menit disisakan untuk lembar Jawa
 * Timur (yang menjaring dengan pemicunya sendiri) dan untuk jalan manual.
 */
var BATAS_MENIT_HARIAN = 60;

/** Portal per kanwil sekali giliran. Yang paling lama tidak diperiksa lebih dulu. */
var PORTAL_PER_KANWIL = 8;

/** Gagal berturut-turut sebelum portal dinonaktifkan sendiri. */
var GAGAL_NONAKTIF = 5;

/** Berita lebih tua dari ini dilewati; arsip lama bukan tugas penjaring. */
var UMUR_MAKS_HARI = 30;

/** Jeda antar-permintaan, milidetik. Menjaga agar tidak dianggap serangan. */
var JEDA_MS = 200;

/**
 * Jangkar kata: sebuah berita dianggap urusan Pemasyarakatan bila memuat
 * salah satunya. Sengaja pendek — 'hukum' atau 'tahanan' akan meloloskan
 * seluruh berita kriminal provinsi.
 */
var JANGKAR = [
  'lapas', 'rutan', 'bapas', 'rupbasan', 'lpka', 'lpp',
  'pemasyarakatan', 'napi', 'narapidana', 'sipir', 'kalapas', 'karutan',
  'ditjenpas', 'kemenimipas', 'penjara', 'bui', 'wbp', 'remisi', 'asimilasi'
];

var JANGKAR_FRASA = [
  'warga binaan', 'balai pemasyarakatan', 'lembaga pemasyarakatan', 'rumah tahanan'
];

/**
 * Rutan milik Polres BUKAN unit kita. 'bhabinkamtibmas' sengaja tidak masuk:
 * Bhabinkamtibmas yang hadir di kegiatan Lapas adalah berita yang sah.
 */
var LEMBAGA_LAIN = [
  'rutan polres', 'rutan mapolres', 'rutan mapolresta', 'rutan polda',
  'rutan mapolda', 'rutan kejaksaan', 'rutan kejari', 'rutan militer',
  'spkt', 'pamapta', 'sipropam', 'provos'
];

/** Nilai yang dikenali `normalizeRisk()` di sheet-sync. Di luar ini jatuh ke Rendah. */
var PILIHAN_RISIKO = ['Rendah', 'Sedang', 'Tinggi', 'Kritis'];

var PILIHAN_TINDAK = ['Belum Ditindaklanjuti', 'Sedang Ditangani', 'Hak Jawab Disiapkan',
  'Klarifikasi Terbit', 'Selesai', 'Tidak Perlu Tindak Lanjut'];

/**
 * Judul kolom lembar Berita.
 *
 * URUTAN BOLEH BERUBAH, NAMANYA TIDAK. `sheet-sync` mencocokkan berdasarkan
 * nama lewat ALIAS_BAWAAN; nama di luar daftarnya membuat seluruh kolom itu
 * hilang tanpa galat. Yang wajib hanya 'Judul Berita' dan 'URL / Link Artikel'.
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

/* Nomor kolom (1-based) yang dipakai kode. Diturunkan dari KOLOM supaya
   menyusun ulang urutan judul tidak diam-diam menulis ke kolom yang salah. */
var K_WAKTU = KOLOM.indexOf('Waktu Terdeteksi') + 1;
var K_TANGGAL = KOLOM.indexOf('Tanggal Berita') + 1;
var K_JUDUL = KOLOM.indexOf('Judul Berita') + 1;
var K_URL = KOLOM.indexOf('URL / Link Artikel') + 1;
var K_TIER = KOLOM.indexOf('Tier (perkiraan)') + 1;
var K_UPT = KOLOM.indexOf('Nama UPT') + 1;
var K_RISIKO = KOLOM.indexOf('Tingkat Risiko') + 1;
var K_TINDAK = KOLOM.indexOf('Status Tindak Lanjut') + 1;

var KOLOM_PORTAL = ['Nama Portal', 'Alamat RSS / Beranda', 'Tier (dugaan)',
  'Terakhir Diperiksa', 'Butir Terlihat', 'Diterima (total)', 'Aktif',
  'Gagal Beruntun', 'Catatan'];
var P_WAKTU = 4, P_TERLIHAT = 5, P_DITERIMA = 6, P_AKTIF = 7, P_GAGAL = 8, P_CATATAN = 9;

var KOLOM_DAFTAR = ['No', 'Wilayah', 'Tipe', 'Kanwil (data induk)', 'ID Spreadsheet',
  'Tautan', 'Status', 'Unit', 'Portal Aktif', 'Dibangun', 'Terakhir Dijaring',
  'Baris Baru (terakhir)', 'Total Berita', 'Dikelola Induk', 'Pesan', 'Perintah Pendaftaran'];
var D_WILAYAH = 2, D_TIPE = 3, D_KANWIL = 4, D_ID = 5, D_TAUTAN = 6, D_STATUS = 7,
  D_UNIT = 8, D_PORTAL = 9, D_DIBANGUN = 10, D_DIJARING = 11, D_BARU = 12,
  D_TOTAL = 13, D_DIKELOLA = 14, D_PESAN = 15, D_SQL = 16;

/* ═══════════════════════════════════════════════════════ konfigurasi ══ */

/**
 * Peran lembar dibaca dari lembar tersembunyi `_Konfigurasi`, bukan dari kode.
 * Itulah yang memungkinkan 33 lembar memakai kode yang sama persis.
 */
function bacaKonfig(ss) {
  var l = ss.getSheetByName(L_KONFIG);
  var k = {};
  if (!l || l.getLastRow() < 1) return k;
  var nilai = l.getRange(1, 1, l.getLastRow(), 2).getValues();
  for (var i = 0; i < nilai.length; i++) {
    var kunci = String(nilai[i][0] || '').trim();
    if (kunci) k[kunci] = nilai[i][1];
  }
  return k;
}

function tulisKonfig(ss, isi) {
  var l = ss.getSheetByName(L_KONFIG);
  if (!l) l = ss.insertSheet(L_KONFIG);
  l.clear();
  var baris = Object.keys(isi).map(function (k) { return [k, isi[k]]; });
  l.getRange(1, 1, baris.length, 2).setValues(baris);
  l.getRange(1, 3).setValue('Jangan disunting. Lembar ini menentukan peran spreadsheet ini.');
  l.hideSheet();
}

function dataKanwil(nama) {
  for (var i = 0; i < DATA_KANWIL.length; i++) {
    if (DATA_KANWIL[i].nama === nama) return DATA_KANWIL[i];
  }
  return null;
}

/* ═══════════════════════════════════════════════════════ menu & sunting ══ */

function onOpen() {
  var k = bacaKonfig(SpreadsheetApp.getActive());
  var m = SpreadsheetApp.getUi().createMenu('Trans-Siber PAS');

  if (k.peran === 'kanwil') {
    m.addItem('Jaring portal wilayah (sekarang)', 'jaringSekarang')
      .addItem('Perbarui ringkasan', 'perbaruiRingkasanAktif')
      .addSeparator()
      .addItem('Perbaiki format lembar', 'perbaikiFormatAktif');
  } else if (k.peran === 'induk') {
    m.addItem('Pasang semua (bangun + penjaring)', 'pasangSemua')
      .addSeparator()
      .addItem('Lanjutkan membangun lembar kanwil', 'bangunSemuaLembar')
      .addItem('Jaring bergilir (sekarang)', 'jaringBergilir')
      .addItem('Periksa kesehatan semua lembar', 'periksaSemuaLembar')
      .addItem('Pasang ulang pemicu penjaring', 'pasangPemicuInduk');
  } else {
    m.addItem('Pasang semua (jadikan lembar induk)', 'pasangSemua');
  }
  m.addToUi();
}

/**
 * Pemicu sederhana: berjalan tanpa izin apa pun, jadi petugas yang hanya
 * menyunting ragam nama tidak pernah melihat layar izin Google.
 *
 * Ragam nama yang berupa NAMA DAERAH SENDIRIAN langsung ditandai merah. Kolom
 * ini dipakai sebagai syarat lolos penyaringan wilayah dan sebagai kunci
 * pengisian Nama UPT; satu entri "Kediri" akan meloloskan jadwal pertandingan
 * Persik ke arsip intelijen — jurnal tetap hijau, tidak ada yang tahu.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var l = e.range.getSheet();
  if (l.getName() !== L_UNIT || e.range.getRow() < 2) return;
  var kolomAwal = e.range.getColumn();
  var kolomAkhir = kolomAwal + e.range.getNumColumns() - 1;
  if (kolomAwal > 4 || kolomAkhir < 4) return;

  var k = bacaKonfig(e.source);
  var d = dataKanwil(k.kanwil) || { provinsi: [] };
  var awal = e.range.getRow();
  var n = e.range.getNumRows();
  var nilai = l.getRange(awal, 1, n, 4).getValues();

  for (var i = 0; i < n; i++) {
    var sel = l.getRange(awal + i, 4);
    var salah = ragamBermasalah(String(nilai[i][3] || ''), nilai[i][2], d.provinsi);
    if (salah.length) {
      sel.setBackground('#f8d7da').setNote(
        'DITOLAK SAAT DIJARING: "' + salah.join('", "') + '" adalah nama daerah '
        + 'sendirian. Tulis bersama jenis unitnya, misalnya "Lapas ' + salah[0] + '".');
    } else {
      sel.setBackground(null).setNote('');
    }
    l.getRange(awal + i, 5).setValue(false);
  }
}

/**
 * Ragam nama yang tidak boleh dipakai: nama kabupaten/kota atau provinsi
 * sendirian, dan apa pun yang lebih pendek dari enam huruf.
 */
function ragamBermasalah(teks, kota, provinsi) {
  var dilarang = {};
  var polos = function (s) {
    return String(s || '').toLowerCase()
      .replace(/^(kota administrasi|kota|kabupaten|kab\.?)\s+/i, '').trim();
  };
  if (kota) dilarang[polos(kota)] = true;
  (provinsi || []).forEach(function (p) { dilarang[polos(p)] = true; });

  return teks.split(';').map(function (s) { return s.trim(); })
    .filter(function (s) { return s && (dilarang[polos(s)] || s.length < 6); });
}

/* ═════════════════════════════════════════════════════ lembar induk ══ */

/**
 * SATU-SATUNYA fungsi yang perlu dijalankan dengan tangan.
 *
 * Urutannya disengaja: pemicu penjaring dipasang SEBELUM membangun, supaya
 * kalau pembangunan berhenti di tengah (batas enam menit, atau izin dicabut)
 * kanwil yang sudah jadi tetap mulai dijaring tanpa menunggu yang lain.
 */
function pasangSemua() {
  siapkanInduk();
  pasangPemicuInduk();
  bangunSemuaLembar();
}

function siapkanInduk() {
  var ss = SpreadsheetApp.getActive();
  var k = bacaKonfig(ss);
  if (k.peran === 'kanwil') {
    throw new Error('Spreadsheet ini lembar kanwil ' + k.wilayah
      + ', bukan lembar induk. Jalankan pasangSemua dari lembar induk.');
  }

  tulisKonfig(ss, { peran: 'induk', versi: VERSI, disiapkan: new Date() });
  siapkanDaftar(ss);
  siapkanJurnalInduk(ss);
  siapkanPetunjukInduk(ss);
  hapusLembarBawaan(ss);

  // Pusat membaca lembar Daftar Lembar tiap 10 menit lewat gviz CSV, tanpa
  // akun Google, lalu mendaftarkan sendiri setiap lembar kanwil yang Siap
  // (public.tarik_daftar_induk). Lembar induk yang tertutup membuat seluruh
  // kanwil tidak pernah terdaftar — tanpa galat di sisi mana pun.
  bagikanPelihat(ss.getId());
  ss.setActiveSheet(ss.getSheetByName(L_DAFTAR));
}

function pastikanInduk(ss) {
  if (bacaKonfig(ss).peran !== 'induk') {
    throw new Error('Fungsi ini hanya untuk lembar induk. Jalankan pasangSemua lebih dulu.');
  }
}

function siapkanDaftar(ss) {
  var l = ss.getSheetByName(L_DAFTAR);
  if (!l) l = ss.insertSheet(L_DAFTAR, 0);

  l.getRange(1, 1, 1, KOLOM_DAFTAR.length).setValues([KOLOM_DAFTAR])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff').setWrap(true);
  l.setFrozenRows(1);

  // Baris yang sudah ada tidak ditimpa: ID di sana adalah satu-satunya ingatan
  // tentang lembar mana yang sudah dibuat. Menimpanya membuat bangunSemuaLembar
  // menyalin ulang dan meninggalkan lembar yatim di Drive.
  var ada = {};
  if (l.getLastRow() > 1) {
    l.getRange(2, D_KANWIL, l.getLastRow() - 1, 1).getValues()
      .forEach(function (r) { ada[r[0]] = true; });
  }

  var baru = [];
  DATA_KANWIL.forEach(function (d) {
    if (ada[d.nama]) return;
    var idLama = LEMBAR_SUDAH_ADA[d.nama] || '';
    baru.push([
      0, d.wilayah, d.tipe, d.nama, idLama,
      idLama ? 'https://docs.google.com/spreadsheets/d/' + idLama + '/edit' : '',
      idLama ? 'Sudah ada (v2.1, menjaring dengan pemicunya sendiri)' : 'Belum dibuat',
      d.unit.length, d.portal.length, '', '', '', '', !idLama, '',
      idLama ? perintahDaftar(d.nama, idLama) : ''
    ]);
  });

  if (baru.length) l.getRange(l.getLastRow() + 1, 1, baru.length, KOLOM_DAFTAR.length).setValues(baru);

  var n = l.getLastRow() - 1;
  if (n > 0) {
    var nomor = [];
    for (var i = 1; i <= n; i++) nomor.push([i]);
    l.getRange(2, 1, n, 1).setValues(nomor);
    jadikanKotakCentang(l.getRange(2, D_DIKELOLA, n, 1));
    l.getRange(2, D_DIBANGUN, n, 2).setNumberFormat('yyyy-mm-dd hh:mm');
  }

  var lebar = [40, 190, 50, 300, 200, 120, 260, 50, 70, 120, 120, 90, 90, 90, 300, 420];
  for (var j = 0; j < lebar.length; j++) l.setColumnWidth(j + 1, lebar[j]);
  l.setTabColor('#1f3864');

  l.getRange(1, D_DIKELOLA).setNote(
    'Dicentang = dijaring bergilir oleh lembar induk.\n\n'
    + 'Jawa Timur sengaja TIDAK dicentang: lembarnya v2.1 dan sudah menjaring '
    + 'dengan pemicunya sendiri. Mencentangnya membuat portal Jatim dijaring '
    + 'dua kali dan memakan kuota yang sama dua kali.');
}

/**
 * Kotak centang lewat validasi, BUKAN `insertCheckboxes()`.
 *
 * `insertCheckboxes()` mengosongkan setiap sel menjadi false. Dipanggil ulang
 * saat format diluruskan, ia diam-diam mencabut centang "Dikelola Induk" di
 * seluruh kanwil dan menonaktifkan seluruh portal — penjaring lalu berhenti
 * tanpa satu pun galat.
 */
function jadikanKotakCentang(jangkauan) {
  jangkauan.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
}

function perintahDaftar(nama, id) {
  return "select public.daftarkan_lembar_kanwil('" + nama + "', '" + id + "');";
}

function bacaDaftar(l) {
  if (!l || l.getLastRow() < 2) return [];
  return l.getRange(2, 1, l.getLastRow() - 1, KOLOM_DAFTAR.length).getValues()
    .map(function (r, i) {
      return {
        baris: i + 2, wilayah: r[D_WILAYAH - 1], kanwil: r[D_KANWIL - 1],
        id: String(r[D_ID - 1] || '').trim(), status: String(r[D_STATUS - 1] || ''),
        dikelola: r[D_DIKELOLA - 1] === true
      };
    });
}

function tulisDaftar(l, baris, kolom, nilai) {
  l.getRange(baris, kolom).setValue(nilai);
}

/**
 * Membangun lembar kanwil yang belum ada, sebanyak yang muat dalam satu jalan.
 *
 * Tiga puluh dua salinan tidak muat dalam enam menit. Sisanya dikerjakan jalan
 * berikutnya lewat pemicu sekali-pakai satu menit kemudian — dan pemicu itu
 * dihapus di awal setiap jalan, supaya tidak pernah ada dua pembangun yang
 * berjalan bersamaan dan menyalin kanwil yang sama dua kali.
 */
function bangunSemuaLembar() {
  var kunci = LockService.getScriptLock();
  if (!kunci.tryLock(5000)) return;

  try {
    var mulai = Date.now();
    var ss = SpreadsheetApp.getActive();
    pastikanInduk(ss);
    hapusPemicu('bangunSemuaLembar');

    var l = ss.getSheetByName(L_DAFTAR);
    var semua = bacaDaftar(l);
    var folder = null;
    var dibuat = 0;
    var sisa = 0;
    var gagal = [];

    for (var i = 0; i < semua.length; i++) {
      var b = semua[i];
      if (!b.dikelola || b.status === 'Siap') continue;
      if (Date.now() - mulai > BATAS_JALAN_MS - 60000) { sisa++; continue; }

      var d = dataKanwil(b.kanwil);
      if (!d) {
        tulisDaftar(l, b.baris, D_STATUS, 'Gagal: kanwil tidak ada di data induk skrip');
        continue;
      }

      try {
        // ID ditulis SEGERA setelah salinan lahir, sebelum apa pun yang bisa
        // gagal. Kalau pembangunan gagal sesudahnya, jalan berikutnya
        // membangun ulang salinan yang sama alih-alih membuat salinan baru.
        var id = b.id;
        if (!id) {
          if (!folder) folder = folderKanwil();
          id = DriveApp.getFileById(ss.getId()).makeCopy(AWALAN_JUDUL + d.wilayah, folder).getId();
          tulisDaftar(l, b.baris, D_ID, id);
          tulisDaftar(l, b.baris, D_STATUS, 'Disalin, sedang dibangun');
          SpreadsheetApp.flush();
        }

        var ssK = SpreadsheetApp.openById(id);
        bangunLembarKanwil(ssK, d, ss.getId());
        var dibagikan = bagikanPelihat(id);

        l.getRange(b.baris, D_TAUTAN, 1, 5).setValues([[
          ssK.getUrl(), dibagikan ? 'Siap' : 'Dibangun, BELUM dibagikan',
          d.unit.length, d.portal.length, new Date()
        ]]);
        tulisDaftar(l, b.baris, D_SQL, perintahDaftar(d.nama, id));
        tulisDaftar(l, b.baris, D_PESAN, dibagikan ? ''
          : 'Bagikan manual: Bagikan -> Siapa saja yang memiliki link -> Pelihat.');
        dibuat++;
      } catch (e) {
        tulisDaftar(l, b.baris, D_STATUS, 'Gagal');
        tulisDaftar(l, b.baris, D_PESAN, String(e && e.message || e).slice(0, 300));
        gagal.push(d.wilayah);
      }
      SpreadsheetApp.flush();
    }

    if (sisa) ScriptApp.newTrigger('bangunSemuaLembar').timeBased().after(60 * 1000).create();

    var pesan = dibuat + ' lembar dibangun'
      + (sisa ? ', ' + sisa + ' menunggu jalan berikutnya (otomatis, semenit lagi)' : '')
      + (gagal.length ? '. Gagal: ' + gagal.join(', ') : '');
    catatJurnalInduk('bangun', dibuat, 0, mulai, pesan);
    ss.toast(pesan, VERSI, 15);
  } finally {
    kunci.releaseLock();
  }
}

function folderKanwil() {
  var cari = DriveApp.getFoldersByName(NAMA_FOLDER);
  return cari.hasNext() ? cari.next() : DriveApp.createFolder(NAMA_FOLDER);
}

/**
 * Pelihat untuk siapa saja yang memegang tautan.
 *
 * WAJIB: penyalin pusat membaca lembar lewat gviz CSV TANPA akun Google.
 * Lembar yang tertutup membalas 401 dan halaman Sinkronisasi Sumber
 * menampilkannya Gagal — keadaan yang benar, bukan kekeliruan.
 */
function bagikanPelihat(id) {
  try {
    DriveApp.getFileById(id).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return true;
  } catch (e) {
    Logger.log('Gagal membagikan ' + id + ': ' + e);
    return false;
  }
}

/**
 * Mengubah salinan lembar induk menjadi lembar kanwil.
 *
 * Aman dijalankan berkali-kali: isi yang disunting petugas (ragam nama,
 * portal tambahan, kolom telaah di Berita) tidak pernah ditimpa — hanya
 * format, pilihan baku, dan kunci judul yang diluruskan.
 */
function bangunLembarKanwil(ss, d, idInduk) {
  tulisKonfig(ss, {
    peran: 'kanwil', kanwil: d.nama, wilayah: d.wilayah, tipe: d.tipe,
    provinsi: d.provinsi.join('; '), induk: idInduk || '', versi: VERSI,
    dibangun: new Date()
  });

  // Target Unit lebih dulu: pilihan Nama UPT di lembar Berita merujuk ke sana,
  // dan tanpa lembarnya validasi itu tidak terpasang pada pembangunan pertama.
  siapkanTargetUnit(ss, d);
  siapkanBerita(ss);
  siapkanRingkasan(ss, d);
  siapkanPortal(ss, d);
  siapkanTier(ss);
  siapkanJurnal(ss);
  siapkanPetunjuk(ss, d);

  LEMBAR_INDUK_SAJA.forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s) ss.deleteSheet(s);
  });
  hapusLembarBawaan(ss);

  ss.setActiveSheet(ss.getSheetByName(L_BERITA));
  ss.moveActiveSheet(1);
  ss.setActiveSheet(ss.getSheetByName(L_RINGKAS));
  ss.moveActiveSheet(2);
  ss.setActiveSheet(ss.getSheetByName(L_BERITA));
}

function hapusLembarBawaan(ss) {
  ['Sheet1', 'Lembar1', 'Sheet 1'].forEach(function (n) {
    var s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });
}

/* ═════════════════════════════════════════════════ penjaring bergilir ══ */

/** Dua jam sekali: dua belas jalan x paling lama 4,5 menit = di bawah 60 menit sehari. */
function pasangPemicuInduk() {
  pastikanInduk(SpreadsheetApp.getActive());
  hapusPemicu('jaringBergilir');
  ScriptApp.newTrigger('jaringBergilir').timeBased().everyHours(2).create();
  SpreadsheetApp.getActive().toast('Penjaring bergilir terpasang: tiap dua jam.', VERSI, 10);
}

function hapusPemicu(namaFungsi) {
  ScriptApp.getProjectTriggers().forEach(function (p) {
    if (p.getHandlerFunction() === namaFungsi) ScriptApp.deleteTrigger(p);
  });
}

/**
 * Menjaring kanwil satu per satu, melanjutkan dari kanwil terakhir jalan
 * sebelumnya.
 *
 * Bergiliran, bukan dari atas setiap kali: dengan urutan tetap, kanwil di
 * bawah daftar (Maluku, Papua) tidak pernah kebagian waktu begitu kanwil di
 * atas punya banyak portal — dan yang tertinggal justru wilayah yang paling
 * jarang diliput media nasional.
 */
function jaringBergilir() {
  var kunci = LockService.getScriptLock();
  if (!kunci.tryLock(5000)) return;

  try {
    var mulai = Date.now();
    var ss = SpreadsheetApp.getActive();
    pastikanInduk(ss);

    var menit = menitHariIni();
    if (menit >= BATAS_MENIT_HARIAN) {
      catatJurnalInduk('jaring', 0, 0, mulai,
        'Dilewati: batas ' + BATAS_MENIT_HARIAN + ' menit hari ini sudah terpakai (' + menit + ').');
      return;
    }

    var l = ss.getSheetByName(L_DAFTAR);
    var antre = bacaDaftar(l).filter(function (b) {
      // Lembar yang belum dibagikan tetap dijaring: menjaring tidak butuh
      // berbagi, hanya penyalin pusat yang butuh.
      return b.id && b.dikelola
        && (b.status.indexOf('Siap') === 0 || b.status.indexOf('Dibangun') === 0);
    });
    if (!antre.length) {
      catatJurnalInduk('jaring', 0, 0, mulai, 'Belum ada lembar kanwil berstatus Siap.');
      return;
    }

    var props = PropertiesService.getScriptProperties();
    var p = (Number(props.getProperty('penunjuk')) || 0) % antre.length;
    var tenggat = mulai + BATAS_JALAN_MS;
    var disentuh = 0;
    var baruTotal = 0;
    var galat = [];

    for (var n = 0; n < antre.length; n++) {
      if (Date.now() > tenggat - 20000) break;
      var b = antre[(p + n) % antre.length];

      try {
        var ssK = SpreadsheetApp.openById(b.id);
        var h = jaringPortalUntuk(ssK, 'induk', tenggat);
        var total = perbaruiRingkasan(ssK);
        l.getRange(b.baris, D_DIJARING).setValue(new Date());
        l.getRange(b.baris, D_BARU).setValue(h.baru);
        l.getRange(b.baris, D_TOTAL).setValue(total);
        l.getRange(b.baris, D_PORTAL).setValue(h.portalAktif);
        baruTotal += h.baru;
      } catch (e) {
        l.getRange(b.baris, D_PESAN).setValue(String(e && e.message || e).slice(0, 300));
        galat.push(b.wilayah);
      }

      disentuh++;
      props.setProperty('penunjuk', String((p + n + 1) % antre.length));
    }

    tambahMenit(Date.now() - mulai);
    catatJurnalInduk('jaring', disentuh, baruTotal, mulai,
      galat.length ? 'Galat: ' + galat.join(', ') : '');
  } finally {
    kunci.releaseLock();
  }
}

function kunciHari() {
  return 'menit-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
}

function menitHariIni() {
  var props = PropertiesService.getScriptProperties();
  return Math.round((Number(props.getProperty(kunciHari())) || 0) / 60000);
}

function tambahMenit(ms) {
  var props = PropertiesService.getScriptProperties();
  var k = kunciHari();
  props.setProperty(k, String((Number(props.getProperty(k)) || 0) + ms));
}

/**
 * Memeriksa setiap lembar: masih ada, masih dibagikan, judul kolom Berita
 * masih utuh. Yang tidak dibagikan dibagikan ulang.
 *
 * Tiga keadaan itu yang memutus aliran ke pusat, dan ketiganya tidak
 * menimbulkan galat di lembar mana pun — hanya berita yang berhenti datang.
 */
function periksaSemuaLembar() {
  var ss = SpreadsheetApp.getActive();
  pastikanInduk(ss);
  var l = ss.getSheetByName(L_DAFTAR);
  var hasil = { sehat: 0, masalah: 0 };

  bacaDaftar(l).forEach(function (b) {
    if (!b.id) return;
    var masalah = [];
    try {
      var berkas = DriveApp.getFileById(b.id);
      if (berkas.isTrashed()) masalah.push('ada di tempat sampah');
      if (berkas.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
        masalah.push(bagikanPelihat(b.id) ? 'dibagikan ulang' : 'TIDAK dibagikan');
      }
      var lb = SpreadsheetApp.openById(b.id).getSheetByName(L_BERITA);
      if (!lb) {
        masalah.push('lembar Berita hilang');
      } else {
        var judul = lb.getRange(1, 1, 1, KOLOM.length).getValues()[0];
        var beda = KOLOM.filter(function (k, i) { return judul[i] !== k; });
        if (beda.length) masalah.push('judul kolom berubah: ' + beda.join(', '));
      }
    } catch (e) {
      masalah.push('tidak bisa dibuka: ' + (e && e.message || e));
    }
    l.getRange(b.baris, D_PESAN).setValue(masalah.length ? masalah.join('; ') : 'Sehat ' + tanggalPendek());
    if (masalah.length) hasil.masalah++; else hasil.sehat++;
  });

  ss.toast(hasil.sehat + ' sehat, ' + hasil.masalah + ' perlu perhatian.', VERSI, 15);
}

function tanggalPendek() {
  return Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm');
}

/* ═══════════════════════════════════════════ menu pada lembar kanwil ══ */

function jaringSekarang() {
  var ss = SpreadsheetApp.getActive();
  var h = jaringPortalUntuk(ss, 'manual', Date.now() + BATAS_JALAN_MS);
  perbaruiRingkasan(ss);
  ss.toast(h.baru + ' baris baru dari ' + h.portal + ' portal.', VERSI, 10);
}

function perbaruiRingkasanAktif() {
  perbaruiRingkasan(SpreadsheetApp.getActive());
}

function perbaikiFormatAktif() {
  var ss = SpreadsheetApp.getActive();
  var k = bacaKonfig(ss);
  var d = dataKanwil(k.kanwil);
  if (!d) throw new Error('Lembar ini belum punya konfigurasi kanwil.');
  bangunLembarKanwil(ss, d, k.induk);
  ss.toast('Format diluruskan. Isi yang Anda sunting tidak berubah.', VERSI, 10);
}

/* ═════════════════════════════════════════════════ pabrik format lembar ══ */

function siapkanBerita(ss) {
  var l = ss.getSheetByName(L_BERITA);
  if (!l) l = ss.insertSheet(L_BERITA, 0);

  var kepala = l.getRange(1, 1, 1, KOLOM.length);
  kepala.setValues([KOLOM])
    .setFontWeight('bold').setBackground('#1f3864').setFontColor('#ffffff')
    .setVerticalAlignment('middle').setWrap(true).setHorizontalAlignment('center');

  // Kunci peringatan, bukan larangan: petugas tetap BISA mengubah judul
  // kolom, tetapi harus menekan "OK" pada peringatan lebih dulu. Judul yang
  // terganti tanpa sengaja membuat kolom itu lenyap dari penyalin pusat tanpa
  // satu pun galat.
  l.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) {
    if (p.getDescription() === 'Judul kolom Berita') p.remove();
  });
  kepala.protect().setDescription('Judul kolom Berita').setWarningOnly(true);

  l.setFrozenRows(1);
  l.setFrozenColumns(3);

  var lebar = [140, 100, 420, 280, 150, 160, 80, 240, 200, 100, 320, 170, 140, 120, 140, 90];
  for (var i = 0; i < lebar.length; i++) l.setColumnWidth(i + 1, lebar[i]);

  var n = Math.max(l.getMaxRows() - 1, 1);
  l.getRange(2, 1, n, KOLOM.length).setVerticalAlignment('top').setFontSize(10);
  l.getRange(2, K_WAKTU, n, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  l.getRange(2, K_TANGGAL, n, 1).setNumberFormat('yyyy-mm-dd');

  l.getRange(2, K_RISIKO, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(PILIHAN_RISIKO, true)
      .setAllowInvalid(false).build());

  // Status tindak lanjut tidak dibakukan di pusat; daftar ini hanya
  // memudahkan, jadi nilai lain tetap diterima.
  l.getRange(2, K_TINDAK, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(PILIHAN_TINDAK, true)
      .setAllowInvalid(true).build());

  var unit = ss.getSheetByName(L_UNIT);
  if (unit) {
    l.getRange(2, K_UPT, n, 1).setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInRange(unit.getRange('A2:A'), true)
        .setAllowInvalid(true)
        .setHelpText('Pilih dari Target Unit. Nama di luar data induk tetap diterima, '
          + 'tetapi beritanya masuk antrean Pemetaan UPT di pusat.')
        .build());
  }

  warnaiTier(l);
  l.setTabColor('#1f3864');
}

/**
 * Warna mengikuti matriks SOP: merah krisis nasional, jingga siaga kanwil,
 * kuning waspada unit, hijau pantau.
 */
function warnaiTier(l) {
  var jangkauan = l.getRange(2, 1, Math.max(l.getMaxRows() - 1, 1), KOLOM.length);
  var huruf = String.fromCharCode(64 + K_TIER);
  var G = '$' + huruf + '2';
  var aturan = [['#fce4e4', 1], ['#fdead1', 2], ['#fff8e1', 3], ['#eef7ee', 4]];

  l.setConditionalFormatRules(aturan.map(function (a) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=' + G + '=' + a[1]).setBackground(a[0])
      .setRanges([jangkauan]).build();
  }));
}

/** Baris tempat tabel unit di lembar Ringkasan dimulai. */
var R_TABEL = 16;

function siapkanRingkasan(ss, d) {
  var l = ss.getSheetByName(L_RINGKAS);
  if (!l) l = ss.insertSheet(L_RINGKAS, 1);

  var B = "'" + L_BERITA + "'!";
  var kol = function (k) { var h = String.fromCharCode(64 + k); return B + h + '2:' + h; };

  l.getRange(1, 1).setValue('RINGKASAN — KANWIL ' + d.wilayah.toUpperCase())
    .setFontSize(14).setFontWeight('bold');
  l.getRange(2, 1).setValue('Tipe ' + d.tipe + ' · ' + d.unit.length + ' unit · provinsi: '
    + d.provinsi.join(', ')).setFontColor('#555555');

  var angka = [
    ['Total berita terjaring', '=COUNTA(' + kol(K_JUDUL) + ')'],
    ['7 hari terakhir', '=COUNTIF(' + kol(K_WAKTU) + ',">="&(TODAY()-7))'],
    ['Tier 1 — krisis (nasional)', '=COUNTIF(' + kol(K_TIER) + ',1)'],
    ['Tier 2 — siaga (provinsi)', '=COUNTIF(' + kol(K_TIER) + ',2)'],
    ['Tier 3 — waspada (kabupaten/kota)', '=COUNTIF(' + kol(K_TIER) + ',3)'],
    ['Tier 4 — pantau (hiperlokal & sosmed)', '=COUNTIF(' + kol(K_TIER) + ',4)'],
    ['Belum ada status tindak lanjut', '=COUNTIFS(' + kol(K_JUDUL) + ',"<>",' + kol(K_TINDAK) + ',"")'],
    ['Belum terpetakan ke unit', '=COUNTIFS(' + kol(K_JUDUL) + ',"<>",' + kol(K_UPT) + ',"")'],
    ['Unit sunyi 30 hari', '=COUNTIF(E' + (R_TABEL + 1) + ':E,"Sunyi")']
  ];
  l.getRange(4, 1, angka.length, 1).setValues(angka.map(function (a) { return [a[0]]; }));
  l.getRange(4, 2, angka.length, 1).setFormulas(angka.map(function (a) { return [a[1]]; }));
  l.getRange(4, 2, angka.length, 1).setFontWeight('bold').setHorizontalAlignment('right');

  l.getRange(4 + angka.length - 2, 1).setNote(
    'Berita tanpa Nama UPT tetap masuk ke pusat, tetapi tidak tampil di ruang '
    + 'kanwil di website sampai analis memetakannya. Mengisi kolom Nama UPT di '
    + 'lembar Berita mempercepatnya.');

  l.getRange(R_TABEL, 1, 1, 5).setValues([['Unit', 'Jenis', 'Berita 30 hari',
    'Terakhir Muncul', 'Keadaan']])
    .setFontWeight('bold').setBackground('#e8eaf6');
  l.getRange(R_TABEL - 1, 1).setValue('UNIT — diperbarui setiap kali penjaring berjalan')
    .setFontWeight('bold');

  l.setColumnWidth(1, 320); l.setColumnWidth(2, 90); l.setColumnWidth(3, 110);
  l.setColumnWidth(4, 130); l.setColumnWidth(5, 110);
  l.setFrozenRows(2);
  l.setTabColor('#c62828');
}

/**
 * Menghitung ulang tabel unit di lembar Ringkasan. Mengembalikan jumlah baris
 * berita, dipakai lembar induk untuk kolom Total Berita.
 *
 * Unit tanpa berita ditandai "Sunyi" — bukan "Aman". Diukur 6 September 2026:
 * 343 dari 531 unit tidak pernah muncul di arsip, dan sebabnya hampir selalu
 * karena tidak pernah dicari dengan nama yang sungguh dipakai orang.
 */
function perbaruiRingkasan(ss) {
  var lr = ss.getSheetByName(L_RINGKAS);
  var lb = ss.getSheetByName(L_BERITA);
  var lu = ss.getSheetByName(L_UNIT);
  if (!lr || !lb || !lu) return 0;

  var berita = lb.getLastRow() > 1
    ? lb.getRange(2, 1, lb.getLastRow() - 1, KOLOM.length).getValues() : [];
  var batas = Date.now() - 30 * 86400000;
  var hitung = {};

  berita.forEach(function (r) {
    var unit = String(r[K_UPT - 1] || '').trim();
    if (!unit) return;
    var w = r[K_TANGGAL - 1] instanceof Date ? r[K_TANGGAL - 1]
      : (r[K_WAKTU - 1] instanceof Date ? r[K_WAKTU - 1] : null);
    var h = hitung[unit] || (hitung[unit] = { n: 0, akhir: null });
    if (w && w.getTime() >= batas) h.n++;
    if (w && (!h.akhir || w > h.akhir)) h.akhir = w;
  });

  var unit = lu.getLastRow() > 1 ? lu.getRange(2, 1, lu.getLastRow() - 1, 2).getValues() : [];
  var tabel = unit.filter(function (u) { return String(u[0] || '').trim(); })
    .map(function (u) {
      var h = hitung[String(u[0]).trim()] || { n: 0, akhir: null };
      return [u[0], u[1], h.n, h.akhir || '', h.n ? 'Diberitakan' : 'Sunyi'];
    })
    .sort(function (a, b) { return a[2] - b[2]; });

  var lama = lr.getLastRow() - R_TABEL;
  if (lama > 0) lr.getRange(R_TABEL + 1, 1, lama, 5).clearContent();
  if (tabel.length) {
    lr.getRange(R_TABEL + 1, 1, tabel.length, 5).setValues(tabel);
    lr.getRange(R_TABEL + 1, 4, tabel.length, 1).setNumberFormat('yyyy-mm-dd');
  }
  return berita.filter(function (r) { return String(r[K_JUDUL - 1] || '').trim(); }).length;
}

function siapkanTargetUnit(ss, d) {
  var l = ss.getSheetByName(L_UNIT);
  var baru = !l;
  if (!l) l = ss.insertSheet(L_UNIT);

  var judul = ['Nama UPT (resmi)', 'Jenis', 'Kabupaten/Kota', 'Ragam Nama (dipisah ;)',
    'Sudah Dikirim ke Pusat', 'Catatan'];
  l.getRange(1, 1, 1, judul.length).setValues([judul])
    .setFontWeight('bold').setBackground('#e8eaf6');
  l.setFrozenRows(1);

  // Diisi hanya saat pertama dibuat. Ragam nama yang disunting petugas —
  // yang justru paling berharga — tidak boleh tertimpa ketika format
  // diperbaiki.
  if (baru && d.unit.length) {
    var baris = d.unit.map(function (u) {
      return [u.nama, u.jenis, u.kota, u.alias.join('; '), false, ''];
    });
    l.getRange(2, 1, baris.length, judul.length).setValues(baris);
    jadikanKotakCentang(l.getRange(2, 5, baris.length, 1));
  }

  l.setColumnWidth(1, 300); l.setColumnWidth(3, 180); l.setColumnWidth(4, 460);
  l.setColumnWidth(6, 260);
  l.setTabColor('#3949ab');

  l.getRange(1, 4).setNote(
    'INILAH SUNTINGAN YANG PALING BERPENGARUH DI SELURUH LEMBAR INI.\n\n'
    + 'Mesin sudah menurunkan bentuk yang bisa ditebak ("Lapas Kediri", '
    + '"Penjara Kediri"). Yang tidak bisa ditebak adalah nama panggilan '
    + 'setempat — "Medaeng" untuk Rutan Kelas I Surabaya.\n\n'
    + 'Daftar ini dipakai tiga kali: menyaring berita portal ke wilayah ini, '
    + 'mengisi kolom Nama UPT di lembar Berita, dan (lewat admin pusat) '
    + 'mencari berita di Google News.\n\n'
    + 'JANGAN menulis nama daerah sendirian ("Kediri"). Sel akan memerah.');
}

function siapkanPortal(ss, d) {
  var l = ss.getSheetByName(L_PORTAL);
  var baru = !l;
  if (!l) l = ss.insertSheet(L_PORTAL);

  l.getRange(1, 1, 1, KOLOM_PORTAL.length).setValues([KOLOM_PORTAL])
    .setFontWeight('bold').setBackground('#e0f2f1');
  l.setFrozenRows(1);

  if (baru && d.portal.length) {
    var baris = d.portal.map(function (p) {
      return [p.nama, p.alamat, p.tier, '', 0, 0, true, 0, p.catatan || ''];
    });
    l.getRange(2, 1, baris.length, KOLOM_PORTAL.length).setValues(baris);
    jadikanKotakCentang(l.getRange(2, P_AKTIF, baris.length, 1));
  }

  l.setColumnWidth(1, 220); l.setColumnWidth(2, 380); l.setColumnWidth(P_CATATAN, 360);
  l.getRange(2, P_WAKTU, Math.max(l.getMaxRows() - 1, 1), 1).setNumberFormat('yyyy-mm-dd hh:mm');
  l.setTabColor('#00897b');

  l.getRange(1, 2).setNote(
    'Boleh alamat RSS langsung, atau beranda portalnya saja — penjaring mencoba '
    + '/feed, /rss, /feed/, ?feed=rss2, dan /rss.xml satu per satu.\n\n'
    + 'DI SINILAH lapisan terbawah ditambahkan. Portal kabupaten yang tidak '
    + 'terindeks Google News hanya bisa masuk lewat daftar ini.\n\n'
    + 'Untuk portal baru, centang kolom Aktif.');
  l.getRange(1, P_GAGAL).setNote(
    'Bertambah setiap kali umpan portal tidak bisa dibaca. Pada ' + GAGAL_NONAKTIF
    + ' kali berturut-turut portal dinonaktifkan sendiri supaya tidak menghabiskan '
    + 'kuota setiap jalan. Perbaiki alamatnya, nolkan kolom ini, centang Aktif lagi.');

  if (baru && !d.portal.length) {
    l.getRange(2, 1).setValue('(Belum ada portal benih untuk wilayah ini — tambahkan portal '
      + 'berita kabupaten/kota di baris-baris berikutnya.)').setFontColor('#9e9e9e');
  }
}

function siapkanTier(ss) {
  var l = ss.getSheetByName(L_TIER);
  var baru = !l;
  if (!l) l = ss.insertSheet(L_TIER);

  l.getRange(1, 1, 1, 4).setValues([['Domain', 'Nama Media', 'Tier', 'Turunkan Subdomain']])
    .setFontWeight('bold').setBackground('#f3e5f5');
  l.setFrozenRows(1);

  if (baru && TIER_BAWAAN.length) {
    l.getRange(2, 1, TIER_BAWAAN.length, 4).setValues(TIER_BAWAAN);
  }

  l.setColumnWidth(1, 260); l.setColumnWidth(2, 220);
  l.setTabColor('#8e24aa');
  l.getRange(1, 3).setNote(
    'Salinan daftar induk media_tier di pusat, untuk perkiraan di layar saja. '
    + 'Yang berwenang tetap pusat; jangan memutuskan eskalasi dari kolom ini.');
}

var KOLOM_JURNAL = ['Waktu', 'Dijalankan', 'Portal Diperiksa', 'Baris Baru',
  'Terpetakan ke Unit', 'Tolak: Tak Relevan', 'Tolak: Kembar', 'Tolak: Alamat',
  'Tolak: Lembaga Lain', 'Tolak: Luar Wilayah', 'Tolak: Terlalu Lama',
  'Portal Gagal', 'Panggilan Jaringan', 'Lama (detik)', 'Pesan'];

function siapkanJurnal(ss) {
  var l = ss.getSheetByName(L_JURNAL);
  if (!l) l = ss.insertSheet(L_JURNAL);

  l.getRange(1, 1, 1, KOLOM_JURNAL.length).setValues([KOLOM_JURNAL])
    .setFontWeight('bold').setBackground('#eceff1');
  l.setFrozenRows(1);
  l.getRange(2, 1, Math.max(l.getMaxRows() - 1, 1), 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  l.setColumnWidth(KOLOM_JURNAL.length, 460);
  l.setTabColor('#607d8b');

  l.getRange(1, 6).setNote(
    'Angka ini BESAR menandakan SEHAT. Umpan portal memuat seluruh terbitan '
    + 'portalnya — olahraga, pilkada, kuliner.\n\n'
    + 'Yang menandakan rusak: "Portal Diperiksa" terisi tapi "Panggilan Jaringan" nol.');
  l.getRange(1, 10).setNote(
    'Berita Pemasyarakatan dari provinsi lain. Bila besar untuk satu portal, '
    + 'portal itu bukan hiperlokal wilayah ini. Bila berita wilayah sendiri ikut '
    + 'tertolak, tambahkan ragam namanya di lembar Target Unit.');
}

function siapkanPetunjuk(ss, d) {
  var l = ss.getSheetByName(L_INFO);
  if (!l) l = ss.insertSheet(L_INFO);
  l.clear();

  var isi = [
    ['LEMBAR KANWIL — ' + d.wilayah.toUpperCase() + ' (Tipe ' + d.tipe + ')'],
    ['Provinsi yang diampu: ' + d.provinsi.join(', ')],
    [''],
    ['Lembar ini dijaring otomatis oleh lembar induk Trans-Siber PAS, bergiliran'],
    ['dengan kanwil lain. Tidak ada yang perlu dipasang di sini.'],
    [''],
    ['DUA HAL YANG HANYA BISA DIKERJAKAN PETUGAS DAERAH'],
    ['  Target Unit, kolom Ragam Nama — nama panggilan setempat ("Medaeng").'],
    ['  Portal Wilayah — portal berita kabupaten yang tidak terindeks Google.'],
    [''],
    ['YANG BOLEH DISUNTING DI LEMBAR BERITA'],
    ['  Nama UPT, Tingkat Risiko, Hasil Analisis, Status Tindak Lanjut,'],
    ['  Petugas Respon, Waktu Respon, Nama Petugas.'],
    ['  Mengisi Nama UPT membuat berita tampil di ruang kanwil di website.'],
    [''],
    ['YANG JANGAN DISENTUH'],
    ['  Judul kolom lembar Berita (dikunci dengan peringatan). Penyalin pusat'],
    ['  mencocokkan nama kolom; judul yang diubah membuat kolom itu hilang.'],
    ['  Lembar tersembunyi _Konfigurasi.'],
    [''],
    ['ALUR KE WEBSITE'],
    ['  Lembar ini -> sinkronisasi pusat tiap 30 menit -> trans-siberpas.vercel.app'],
    ['  Penilaian sentimen, tier, dan Telegram dikerjakan di pusat.'],
    [''],
    ['KALAU BERITA TIDAK BERTAMBAH'],
    ['  Buka Jurnal. "Tolak: Tak Relevan" besar itu SEHAT. Yang rusak:'],
    ['  "Portal Diperiksa" terisi tetapi "Panggilan Jaringan" nol.'],
    ['  Portal dengan "Gagal Beruntun" tinggi perlu dibetulkan alamatnya.'],
    [''],
    ['Versi: ' + VERSI]
  ];

  l.getRange(1, 1, isi.length, 1).setValues(isi);
  l.getRange(1, 1).setFontSize(14).setFontWeight('bold');
  [7, 11, 16, 21, 25].forEach(function (r) { l.getRange(r, 1).setFontWeight('bold'); });
  l.setColumnWidth(1, 720);
  l.setTabColor('#9e9e9e');
}

function siapkanJurnalInduk(ss) {
  var l = ss.getSheetByName(L_JURNAL_INDUK);
  if (!l) l = ss.insertSheet(L_JURNAL_INDUK);
  var judul = ['Waktu', 'Kegiatan', 'Kanwil Disentuh', 'Baris Baru', 'Lama (detik)',
    'Menit Terpakai Hari Ini', 'Pesan'];
  l.getRange(1, 1, 1, judul.length).setValues([judul]).setFontWeight('bold').setBackground('#eceff1');
  l.setFrozenRows(1);
  l.getRange(2, 1, Math.max(l.getMaxRows() - 1, 1), 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  l.setColumnWidth(7, 520);
  l.setTabColor('#607d8b');
}

function catatJurnalInduk(kegiatan, disentuh, baru, mulai, pesan) {
  var l = SpreadsheetApp.getActive().getSheetByName(L_JURNAL_INDUK);
  if (!l) return;
  l.appendRow([new Date(), kegiatan, disentuh, baru,
    Math.round((Date.now() - mulai) / 1000), menitHariIni(), pesan || '']);
}

function siapkanPetunjukInduk(ss) {
  var l = ss.getSheetByName(L_INFO_INDUK);
  if (!l) l = ss.insertSheet(L_INFO_INDUK);
  l.clear();
  var isi = [
    ['LEMBAR INDUK — Trans-Siber PAS'],
    [''],
    ['Lembar ini melahirkan dan menjaring seluruh lembar kanwil.'],
    ['Lembar kanwil ada di folder Drive "' + NAMA_FOLDER + '".'],
    [''],
    ['JADWAL'],
    ['  Penjaring bergilir tiap dua jam, paling lama 4,5 menit sekali jalan.'],
    ['  Batas ' + BATAS_MENIT_HARIAN + ' menit sehari; sisa kuota Google (90 menit)'],
    ['  untuk lembar Jawa Timur dan jalan manual.'],
    [''],
    ['KE WEBSITE'],
    ['  Pusat membaca lembar Daftar Lembar ini tiap 10 menit dan mendaftarkan'],
    ['  sendiri setiap lembar yang Siap. Kolom "Perintah Pendaftaran" hanya cadangan.'],
    [''],
    ['JANGAN'],
    ['  Menghapus baris di Daftar Lembar — ID-nya satu-satunya ingatan tentang'],
    ['  lembar yang sudah dibuat. Untuk berhenti menjaring, hapus centang'],
    ['  "Dikelola Induk".'],
    ['  Mencentang Jawa Timur — lembarnya menjaring dengan pemicunya sendiri.'],
    [''],
    ['Versi: ' + VERSI]
  ];
  l.getRange(1, 1, isi.length, 1).setValues(isi);
  l.getRange(1, 1).setFontSize(14).setFontWeight('bold');
  [6, 11, 15].forEach(function (r) { l.getRange(r, 1).setFontWeight('bold'); });
  l.setColumnWidth(1, 720);
  l.setTabColor('#9e9e9e');
}

/* ═══════════════════════════════════════════════ penjaring portal ══ */

/**
 * Konteks satu kanwil, dibaca dari LEMBARNYA, bukan dari data suntikan.
 *
 * Dibangun ulang untuk setiap kanwil di setiap jalan. v2.1 menyimpan daftar
 * jangkar dan tier di variabel global; di lembar induk yang menjaring 32
 * kanwil dalam satu jalan, variabel global berarti kanwil kedua memakai
 * jangkar wilayah kanwil pertama — dan menolak seluruh beritanya sendiri
 * sebagai "luar wilayah".
 */
function konteksKanwil(ss) {
  var k = bacaKonfig(ss);
  var d = dataKanwil(k.kanwil) || { provinsi: [] };
  var ctx = { kanwil: k.kanwil || '', wilayah: k.wilayah || '', unit: [], jangkar: [], tier: {} };

  var polos = function (s) {
    return String(s || '').toLowerCase()
      .replace(/^(kota administrasi|kota|kabupaten|kab\.?)\s+/i, '').trim();
  };
  var jangkar = {};
  var tambah = function (s) { var v = polos(s); if (v.length >= 4) jangkar[v] = true; };
  d.provinsi.forEach(tambah);

  var lu = ss.getSheetByName(L_UNIT);
  var unitMentah = [];
  if (lu && lu.getLastRow() > 1) {
    lu.getRange(2, 1, lu.getLastRow() - 1, 4).getValues().forEach(function (r) {
      var nama = String(r[0] || '').trim();
      if (!nama) return;
      tambah(r[2]);
      var buruk = {};
      ragamBermasalah(String(r[3] || ''), r[2], d.provinsi)
        .forEach(function (s) { buruk[s.toLowerCase()] = true; });
      var alias = [nama].concat(String(r[3] || '').split(';'))
        .map(function (s) { return s.trim().toLowerCase(); })
        .filter(function (s) { return s.length >= 6 && !buruk[s]; });
      unitMentah.push({ nama: nama, alias: alias });
      alias.forEach(tambah);
    });
  }

  var istilah = Object.keys(jangkar);
  unitMentah.forEach(function (u) { istilah = istilah.concat(u.alias); });
  var lokal = lanjutanLokal(istilah);

  ctx.unit = unitMentah.map(function (u) {
    return { nama: u.nama, pola: u.alias.map(function (a) { return polaKata(a, lokal[a]); }) };
  });
  ctx.jangkar = Object.keys(jangkar).map(function (a) { return polaKata(a, lokal[a]); });

  // Unit kanwil LAIN. Nama tempat bisa kembar antarprovinsi — Kota Banjar
  // (Jawa Barat) dan Kabupaten Banjar (Kalimantan Selatan) — sehingga jangkar
  // wilayah saja meloloskan berita "Lapas Kelas IIB Banjar" ke lembar Kalsel.
  // Nama unit tidak pernah kembar; ia penentu yang lebih kuat.
  ctx.asing = [];
  DATA_KANWIL.forEach(function (lain) {
    if (lain.nama === ctx.kanwil) return;
    lain.unit.forEach(function (u) {
      u.alias.forEach(function (a) { ctx.asing.push(polaKata(a)); });
    });
  });

  var lt = ss.getSheetByName(L_TIER);
  if (lt && lt.getLastRow() > 1) {
    lt.getRange(2, 1, lt.getLastRow() - 1, 4).getValues().forEach(function (r) {
      var dm = String(r[0] || '').trim().toLowerCase();
      if (dm) ctx.tier[dm] = { tier: Number(r[2]) || 4, turun: r[3] === true };
    });
  }
  return ctx;
}

/**
 * Menjaring portal satu lembar kanwil, sampai `tenggat` (milidetik epoch).
 *
 * Membaca RSS portal langsung, tanpa lewat Google — satu-satunya kaki yang
 * pernah berhasil dari Apps Script.
 */
function jaringPortalUntuk(ss, oleh, tenggat) {
  var mulai = new Date();
  var kuota = { ambil: 0 };
  var tolak = petaTolak();
  var hasil = { baru: 0, portal: 0, portalAktif: 0 };

  var lembar = ss.getSheetByName(L_BERITA);
  var lp = ss.getSheetByName(L_PORTAL);
  if (!lembar || !lp) return hasil;

  var ctx = konteksKanwil(ss);
  var target = bacaPortal(lp);
  hasil.portalAktif = target.length;

  if (!target.length) {
    catatJurnal(ss, oleh, 0, 0, 0, tolak, kuota, mulai,
      'Belum ada portal aktif. Tambahkan portal berita kabupaten/kota di lembar Portal Wilayah.');
    return hasil;
  }

  var sudahAda = alamatYangSudahAda(lembar);
  var baru = [];
  var terpetakan = 0;
  var dipilih = target.sort(function (a, b) { return a.terakhir - b.terakhir; })
    .slice(0, PORTAL_PER_KANWIL);

  for (var i = 0; i < dipilih.length; i++) {
    if (Date.now() > tenggat) { tolak.waktu++; break; }

    var umpan = ambilUmpan(dipilih[i].alamat, kuota);
    var diterima = 0;

    for (var j = 0; j < umpan.butir.length; j++) {
      var baris = olahTemuan(umpan.butir[j], sudahAda, tolak, ctx);
      if (baris) {
        if (!baris[4]) baris[4] = dipilih[i].nama;
        if (baris[K_UPT - 1]) terpetakan++;
        baru.push(baris);
        diterima++;
      }
    }

    if (!umpan.ok) tolak.portalGagal++;
    tandaiPortal(lp, dipilih[i], umpan, diterima);
    hasil.portal++;
  }

  tulisBaris(lembar, baru);
  hasil.baru = baru.length;
  catatJurnal(ss, oleh, hasil.portal, baru.length, terpetakan, tolak, kuota, mulai,
    tolak.waktu ? 'Berhenti karena batas waktu; sisa portal dikerjakan giliran berikutnya.' : '');
  return hasil;
}

function bacaPortal(lp) {
  if (lp.getLastRow() < 2) return [];
  return lp.getRange(2, 1, lp.getLastRow() - 1, KOLOM_PORTAL.length).getValues()
    .map(function (r, i) {
      return {
        baris: i + 2, nama: String(r[0] || '').trim(), alamat: String(r[1] || '').trim(),
        terakhir: r[P_WAKTU - 1] instanceof Date ? r[P_WAKTU - 1].getTime() : 0,
        aktif: r[P_AKTIF - 1] === true, gagal: Number(r[P_GAGAL - 1]) || 0,
        catatan: String(r[P_CATATAN - 1] || '')
      };
    })
    .filter(function (p) { return p.aktif && /^https?:\/\//i.test(p.alamat); });
}

/**
 * Portal yang terus gagal dinonaktifkan sendiri.
 *
 * Satu portal mati memakan sampai lima permintaan setiap jalan (semua bentuk
 * umpan dicoba), tiap dua jam, selamanya — dan di Jurnal ia tampak sebagai
 * "Butir Terlihat 0", persis seperti portal sehat yang hari itu tidak terbit.
 */
function tandaiPortal(lp, p, umpan, diterima) {
  var gagal = umpan.ok ? 0 : p.gagal + 1;
  var lama = Number(lp.getRange(p.baris, P_DITERIMA).getValue()) || 0;
  lp.getRange(p.baris, P_WAKTU, 1, 3).setValues([[new Date(), umpan.butir.length, lama + diterima]]);
  lp.getRange(p.baris, P_GAGAL).setValue(gagal);

  if (gagal >= GAGAL_NONAKTIF) {
    lp.getRange(p.baris, P_AKTIF).setValue(false);
    lp.getRange(p.baris, P_CATATAN).setValue('Dinonaktifkan otomatis ' + tanggalPendek()
      + ': umpan tidak terbaca ' + gagal + ' kali berturut-turut. ' + p.catatan);
  }
}

/**
 * Mengambil umpan RSS. Bila yang diberi beranda, bentuk umpan yang lazim
 * dicoba satu per satu — '/feed' lebih dulu karena WordPress menopang
 * sebagian besar portal daerah.
 */
function ambilUmpan(alamat, kuota) {
  var calon;
  if (/\/(feed|rss|atom)/i.test(alamat) || /[?&]feed=/i.test(alamat) || /\.xml$/i.test(alamat)) {
    calon = [alamat];
  } else {
    var pokok = alamat.replace(/\/+$/, '');
    calon = [pokok + '/feed', pokok + '/rss', pokok + '/feed/', pokok + '/?feed=rss2', pokok + '/rss.xml'];
  }

  for (var i = 0; i < calon.length; i++) {
    try {
      kuota.ambil++;
      var jawab = UrlFetchApp.fetch(calon[i], {
        muteHttpExceptions: true, followRedirects: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (Trans-Siber PAS; pemantauan berita publik)' }
      });
      Utilities.sleep(JEDA_MS);
      if (jawab.getResponseCode() !== 200) continue;

      var isi = jawab.getContentText();
      if (isi.indexOf('<item') === -1 && isi.indexOf('<entry') === -1) continue;
      return { ok: true, butir: uraikanUmpan(isi) };
    } catch (e) {
      Logger.log('Umpan gagal ' + calon[i] + ': ' + e);
    }
  }
  return { ok: false, butir: [] };
}

/**
 * Satu butir temuan menjadi satu baris — atau ditolak, dengan sebabnya dicatat.
 *
 * Jangkar diperiksa PALING DULU: umpan portal sebagian besar bukan urusan
 * kita, dan memeriksa yang lain lebih dulu berarti bekerja untuk berita kuliner.
 */
function olahTemuan(t, sudahAda, tolak, ctx) {
  var teks = t.judul + ' ' + (t.keterangan || '');

  if (!berjangkar(teks)) { tolak.takRelevan++; return null; }
  if (adaLembagaLain(teks)) { tolak.lembagaLain++; return null; }

  // Unit yang disebut sekaligus menjadi bukti wilayah: nama unit sudah pasti
  // milik kanwil ini, sedangkan nama kota bisa saja kota lain bernama sama.
  // Berita yang menyebut unit kanwil lain dan TIDAK menyebut unit sendiri
  // adalah berita kanwil lain, sekalipun nama kotanya kebetulan sama.
  var unit = cocokkanUnit(teks, ctx);
  if (!unit && (sebutUnitAsing(teks, ctx) || !diWilayah(teks, ctx))) {
    tolak.luarWilayah++;
    return null;
  }

  if (t.tanggal && UMUR_MAKS_HARI > 0) {
    var umur = (Date.now() - t.tanggal.getTime()) / 86400000;
    if (umur > UMUR_MAKS_HARI) { tolak.terlaluLama++; return null; }
  }

  // Alamat Google News DIBUANG: menanamnya berarti menanam kembaran yang
  // tidak bisa dikenali lapis penyaringan mana pun sesudahnya.
  var url = t.tautan;
  if (!url || url.indexOf('news.google.com') !== -1) { tolak.alamat++; return null; }

  var kunci = normalkanTautan(url);
  if (!kunci) { tolak.alamat++; return null; }
  if (sudahAda[kunci]) { tolak.kembar++; return null; }
  sudahAda[kunci] = true;

  var domain = domainDari(kunci);
  var baris = [];
  for (var i = 0; i < KOLOM.length; i++) baris.push('');
  baris[K_WAKTU - 1] = new Date();
  baris[K_TANGGAL - 1] = t.tanggal || '';
  baris[K_JUDUL - 1] = t.judul;
  baris[K_URL - 1] = kunci;
  baris[4] = t.sumber || '';
  baris[5] = domain;
  baris[K_TIER - 1] = perkiraanTier(domain, ctx.tier);
  baris[K_UPT - 1] = unit || '';
  baris[8] = ctx.kanwil;
  baris[KOLOM.length - 1] = 'portal';
  return baris;
}

/**
 * Unit yang disebut berita, bila TEPAT SATU.
 *
 * Dua unit disebut ("Kalapas Kediri dan Karutan Kediri") berarti kosong, bukan
 * yang pertama: kolom kosong masuk antrean Pemetaan UPT di pusat dan dibaca
 * analis, sedangkan tebakan yang salah tampak "sudah terpetakan" dan tidak
 * pernah diperiksa siapa pun.
 */
function cocokkanUnit(teks, ctx) {
  var t = String(teks || '').toLowerCase();
  var kena = [];
  for (var i = 0; i < ctx.unit.length; i++) {
    var u = ctx.unit[i];
    for (var j = 0; j < u.pola.length; j++) {
      if (u.pola[j].test(t)) { kena.push(u.nama); break; }
    }
  }
  return kena.length === 1 ? kena[0] : '';
}

function sebutUnitAsing(teks, ctx) {
  var t = String(teks || '').toLowerCase();
  var asing = ctx.asing || [];
  for (var i = 0; i < asing.length; i++) {
    if (asing[i].test(t)) return true;
  }
  return false;
}

function diWilayah(teks, ctx) {
  if (!ctx.jangkar.length) return true;
  var t = String(teks || '').toLowerCase();
  for (var i = 0; i < ctx.jangkar.length; i++) {
    if (ctx.jangkar[i].test(t)) return true;
  }
  return false;
}

/* ══════════════════════════════════════════════════════ penguraian umpan ══ */

/**
 * RSS dan Atom sekaligus. XmlService lebih dulu karena ia benar; regex hanya
 * cadangan untuk umpan portal daerah yang XML-nya cacat — dan itu sering.
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
        hasil.push({ judul: bersihkan(judul), tautan: String(tautan).trim(),
          keterangan: bersihkan(ket || ''), tanggal: uraikanTanggal(tgl), sumber: '' });
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
      hasil.push({ judul: bersihkan(j[1]), tautan: bersihkan(l[1]),
        keterangan: e2 ? bersihkan(e2[1]) : '',
        tanggal: d ? uraikanTanggal(bersihkan(d[1])) : null, sumber: '' });
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
 * Aturan yang BERWENANG ada di `public.normalkan_tautan()`. Salinan ini boleh
 * meleset tanpa menimbulkan kembar — ia menghemat pekerjaan, sedangkan yang
 * menolak tetap indeks unik di sana.
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

/** Menirukan `public.cari_tier_media()`. Yang berwenang tetap pusat. */
function perkiraanTier(domain, daftar) {
  if (!domain) return 4;
  if (daftar[domain]) return daftar[domain].tier;

  var bagian = domain.split('.');
  var majemuk = ['co.id', 'go.id', 'or.id', 'ac.id', 'net.id', 'web.id', 'sch.id', 'my.id'];
  var minLabel = 2;
  if (bagian.length >= 3 && majemuk.indexOf(bagian.slice(-2).join('.')) !== -1) minLabel = 3;

  for (var i = 1; i <= bagian.length - minLabel; i++) {
    var induk = bagian.slice(i).join('.');
    if (daftar[induk]) {
      if (/^radar/.test(bagian[0])) return 3;
      if (daftar[induk].turun) return Math.min(daftar[induk].tier + 1, 4);
      return daftar[induk].tier;
    }
  }
  return 4;
}

/* ══════════════════════════════════════════════════════ penyaring teks ══ */

/**
 * Batas kata, bukan `indexOf`: tanpa itu 'tahanan' cocok pada "perTAHANAN"
 * dan uji kering pertama sistem ini meloloskan One Piece ke arsip intelijen.
 *
 * Batas kata saja belum cukup untuk nama tempat. "Lapas Kelas IIB Tanjung"
 * (Kalimantan Selatan) berbatas kata di dalam "Lapas Kelas IIB Tanjung
 * Pandan" (Bangka Belitung), dan "Lapas Banjar" (Jawa Barat) di dalam "Lapas
 * Banjar Baru" (Kalimantan Selatan). Akibatnya berita Babel tercatat sebagai
 * berita Lapas Tanjung di lembar Kalsel — dengan Nama UPT terisi, jadi tampak
 * "sudah terpetakan" dan tidak pernah diperiksa siapa pun.
 *
 * Karena itu setiap sebutan membawa daftar KATA LANJUTAN yang terlarang:
 * kata yang, bila menyusul sebutan itu, membentuk nama tempat lain. Daftar
 * nasionalnya dihitung pabrik dari seluruh data induk (LANJUTAN_TERLARANG);
 * ragam nama yang ditambah petugas daerah dihitung ulang di konteksKanwil.
 */
function polaKata(kata, lanjutan) {
  var esc = function (s) { return String(s).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  var k = String(kata).toLowerCase();
  var larang = (lanjutan || []).concat(LANJUTAN_TERLARANG[k] || []);
  var tolak = larang.length
    ? '(?!\\s+(?:' + larang.map(esc).join('|') + ')([^a-z0-9]|$))' : '';
  return new RegExp('(^|[^a-z0-9])' + esc(k) + tolak + '([^a-z0-9]|$)');
}

/**
 * Kata lanjutan yang terlarang di antara sebutan-sebutan SATU kanwil:
 * "rutan kelas iib padang" -> ['panjang'], sebab Padang Panjang unit lain di
 * kanwil yang sama.
 */
function lanjutanLokal(daftar) {
  var peta = {};
  for (var i = 0; i < daftar.length; i++) {
    var x = daftar[i];
    for (var j = 0; j < daftar.length; j++) {
      var y = daftar[j];
      if (y.length <= x.length + 1) continue;
      var p = y.indexOf(x);
      while (p !== -1) {
        if ((p === 0 || y.charAt(p - 1) === ' ') && y.charAt(p + x.length) === ' ') {
          (peta[x] || (peta[x] = [])).push(y.slice(p + x.length + 1).split(' ')[0]);
        }
        p = y.indexOf(x, p + 1);
      }
    }
  }
  return peta;
}

var _polaJangkar = null;
function berjangkar(teks) {
  var t = String(teks || '').toLowerCase();
  for (var i = 0; i < JANGKAR_FRASA.length; i++) {
    if (t.indexOf(JANGKAR_FRASA[i]) !== -1) return true;
  }
  if (!_polaJangkar) _polaJangkar = JANGKAR.map(function (k) { return polaKata(k); });
  for (var j = 0; j < _polaJangkar.length; j++) {
    if (_polaJangkar[j].test(t)) return true;
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
  return { takRelevan: 0, kembar: 0, alamat: 0, lembagaLain: 0, luarWilayah: 0,
    terlaluLama: 0, portalGagal: 0, waktu: 0 };
}

/**
 * Alamat yang sudah ada di lembar ini — lapis pertama dari tiga. Yang MENOLAK
 * hanya lapis ketiga, indeks unik `link_normalized` di pusat.
 */
function alamatYangSudahAda(lembar) {
  var peta = {};
  if (lembar.getLastRow() < 2) return peta;
  lembar.getRange(2, K_URL, lembar.getLastRow() - 1, 1).getValues().forEach(function (r) {
    var k = normalkanTautan(r[0]);
    if (k) peta[k] = true;
  });
  return peta;
}

function tulisBaris(lembar, baris) {
  if (!baris.length) return;
  lembar.getRange(lembar.getLastRow() + 1, 1, baris.length, KOLOM.length).setValues(baris);
}

function catatJurnal(ss, oleh, portal, baru, terpetakan, tolak, kuota, mulai, pesan) {
  var l = ss.getSheetByName(L_JURNAL);
  if (!l) return;
  l.appendRow([
    new Date(), oleh, portal, baru, terpetakan,
    tolak.takRelevan, tolak.kembar, tolak.alamat, tolak.lembagaLain, tolak.luarWilayah,
    tolak.terlaluLama, tolak.portalGagal, kuota.ambil,
    Math.round((Date.now() - mulai.getTime()) / 1000), pesan || ''
  ]);
}
