/**
 * ============================================================================
 * PENJARING CELAH v2.0 — Trans-Siber PAS, sumber ketiga
 * ============================================================================
 *
 * Ditempelkan ke Apps Script milik spreadsheet
 *   "Trans-Siber PAS — Penjaring Celah (Sumber 3)"
 *   1I_8aDhMxAKZQ-uBHoJaS-RYHj45FOmPXSKj9GXXe5GU
 *
 * ----------------------------------------------------------------------------
 * KENAPA SUMBER KETIGA INI ADA
 * ----------------------------------------------------------------------------
 *
 * Diukur 6 September 2026: dari 531 unit pelaksana teknis yang aktif,
 * **343 belum pernah muncul satu kali pun** dalam 858 publikasi terkumpul.
 * Enam puluh empat persen. Kanwil Maluku Utara nol dari sepuluh unit;
 * Sulawesi Utara satu dari empat belas.
 *
 * Itu bukan berarti tidak ada beritanya. Dua sumber yang sudah ada bekerja
 * sama-sama pasif: keduanya menyapu kata kunci umum ("lapas", "rutan") lalu
 * memungut apa pun yang lewat. Penyapuan semacam itu selalu menemukan yang
 * paling ramai, dan yang paling ramai selalu unit besar di pulau yang sama.
 * Unit kecil di Halmahera tidak pernah kalah beritanya — ia tidak pernah
 * dicari.
 *
 * ----------------------------------------------------------------------------
 * DUA CARA MENJARING, DAN KENAPA DUA
 * ----------------------------------------------------------------------------
 *
 *   jaringCelah()  berangkat dari DAFTAR UNIT. Tiap unit sunyi dicari namanya
 *                  sendiri. Menjawab: "apa yang terjadi di tempat yang tidak
 *                  pernah kita lihat?"
 *
 *   jaringIsu()    berangkat dari DAFTAR ISU, mengikuti taksonomi negatif
 *                  sistem — pelarian, kerusuhan, pungli, kematian tidak wajar,
 *                  penyelundupan. Menjawab: "apa yang berat, di mana pun ia
 *                  terjadi?"
 *
 * Keduanya perlu, dan keduanya menutupi kelemahan yang berbeda. Penjaringan
 * per unit tidak akan pernah menemukan peristiwa berat di unit yang SUDAH
 * sering diberitakan — ia tidak ada di daftar sasaran. Penjaringan per isu
 * tidak akan pernah menemukan kegiatan biasa di unit yang sunyi — kegiatan
 * biasa tidak memakai kata kunci berat.
 *
 * ----------------------------------------------------------------------------
 * BERITA KEMBAR
 * ----------------------------------------------------------------------------
 *
 * Penjaring ini SENGAJA mencari di wilayah yang bertumpang tindih dengan dua
 * sumber lain. Berita kembar karena itu kepastian, bukan kemungkinan.
 *
 *   1. Di sini      — alamat yang sudah ada di lembar ini tidak ditulis lagi
 *   2. Penyalin     — baris yang tautannya sudah ada di basis data dilewati
 *   3. Basis data   — pemicu + indeks unik pada link_normalized
 *
 * Dua lapis pertama menghemat pekerjaan. **Hanya lapis ketiga yang menolak.**
 * Aturan yang berwenang ada di `public.normalkan_tautan()`; salinan di berkas
 * ini boleh meleset tanpa menimbulkan berita kembar.
 *
 * ----------------------------------------------------------------------------
 * ALAMAT GOOGLE NEWS HARUS DIURAIKAN
 * ----------------------------------------------------------------------------
 *
 * RSS Google News memberi alamat pengalihan miliknya sendiri
 * (`news.google.com/rss/articles/CBMi...`), bukan alamat artikelnya. Kalau itu
 * yang ditulis, SELURUH penyaringan kembar lolos: satu artikel tersimpan dua
 * kali karena keduanya memang alamat yang berbeda.
 *
 * Setiap alamat karena itu diuraikan lebih dulu, dan yang gagal diuraikan
 * DIBUANG. Lebih baik kehilangan satu berita daripada menanam satu kembaran
 * yang tidak bisa dikenali lapis mana pun sesudahnya.
 *
 * ----------------------------------------------------------------------------
 * YANG DITAMBAHKAN DI v2.0
 * ----------------------------------------------------------------------------
 *
 *   Ragam nama.   "Lapas Kelas IIB Tobello" hampir tidak pernah ditulis
 *                 lengkap oleh wartawan. Yang ditulis "Lapas Tobello", atau
 *                 nama kabupatennya. v1.0 hanya mencari bentuk resminya dan
 *                 karena itu melewatkan sebagian besar beritanya.
 *
 *   Saringan relevansi. Kueri "Lapas Kelas IIB Ende" mengembalikan berita
 *                 tentang KOTA Ende. v1.0 menulisnya apa adanya, dan hasilnya
 *                 mengotori arsip dengan berita yang bukan urusan
 *                 Pemasyarakatan.
 *
 *   Jurnal.       Setiap jalan mencatat: berapa diperiksa, berapa diterima,
 *                 berapa ditolak dan KARENA APA. Tanpa itu, penjaring yang
 *                 berhenti bekerja terlihat persis sama dengan penjaring yang
 *                 memang tidak menemukan apa-apa — pelajaran yang baru saja
 *                 dibayar mahal di tempat lain pada sistem ini.
 *
 *   Penjaga kuota. UrlFetchApp dibatasi per hari. Tanpa penghitung, satu
 *                 daftar sasaran yang membengkak akan menghabiskannya diam-diam
 *                 dan yang berhenti bukan hanya penjaring ini.
 *
 *   Urut menurut kesunyian. Sasaran dipilih dari yang PALING LAMA tidak
 *                 diperiksa, bukan urutan tetap. Daftar yang disunting di
 *                 tengah jalan tidak lagi membuat sebagian unit terlewat
 *                 selamanya.
 *
 * ----------------------------------------------------------------------------
 * CARA MEMASANG
 * ----------------------------------------------------------------------------
 *
 *   1. Buka spreadsheetnya → menu Ekstensi → Apps Script
 *   2. Hapus isi Code.gs, tempel SELURUH berkas ini, simpan
 *   3. Jalankan fungsi `pasangPemicu` sekali (Apps Script akan meminta izin)
 *   4. Kembali ke spreadsheet → Bagikan → "Siapa saja yang memiliki link"
 *      sebagai **Pelihat**
 *
 * Langkah 4 wajib: penyalin membacanya tanpa akun Google. Tanpa itu halaman
 * Sinkronisasi Sumber menampilkannya berstatus Gagal — dan itu benar, bukan
 * kekeliruan yang perlu diperbaiki.
 *
 * Sesudah langkah 4 tidak ada lagi yang perlu ditekan.
 */

/* ========================================================== setelan */

var PENJARING_VERSI = 'penjaring-celah-v2.0';

var NAMA_LEMBAR = 'Sheet1';
var LEMBAR_TARGET = 'Target';
var LEMBAR_JURNAL = 'Jurnal';

/**
 * Berapa unit dicari sekali jalan.
 *
 * Sepuluh, bukan seluruhnya. Apps Script membatasi satu jalan pada enam menit;
 * 343 unit sekali jalan pasti terpotong di tengah, dan yang terpotong selalu
 * unit yang sama — yang di ujung daftar tidak akan pernah tersentuh.
 */
var UNIT_PER_JALAN = 10;

/** Berapa berita teratas diambil per unit. Lebih dari ini hampir selalu berulang. */
var BERITA_PER_UNIT = 5;

/** Berita lebih tua dari ini dilewati; arsip lama bukan tugas penjaring. */
var UMUR_MAKS_HARI = 45;

/**
 * Batas panggilan jaringan sekali jalan.
 *
 * UrlFetchApp dibatasi 20.000 panggilan sehari untuk akun biasa. Angka ini
 * jauh di bawahnya dengan sengaja: yang dijaga bukan batas hariannya melainkan
 * batas WAKTU jalannya (enam menit), dan pengurai alamat bisa memakan beberapa
 * detik per berita ketika portalnya lambat.
 */
var BATAS_AMBIL = 120;

/** Jeda antar-permintaan, milidetik. Menjaga agar tidak dianggap serangan. */
var JEDA_MS = 220;

/* ========================================================== menu & pemicu */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Penjaring Celah')
    .addItem('Jaring per unit (sekarang)', 'jaringCelah')
    .addItem('Jaring per isu (sekarang)', 'jaringIsu')
    .addSeparator()
    .addItem('Pasang / perbarui pemicu harian', 'pasangPemicu')
    .addItem('Siapkan ulang lembar Target', 'siapkanUlangTarget')
    .addToUi();
}

/**
 * Dijalankan SEKALI dengan tangan.
 *
 * Dua pemicu pada jam yang berbeda, bukan satu yang mengerjakan keduanya.
 * Alasannya batas waktu: satu jalan Apps Script dipotong pada enam menit, dan
 * jalan yang dipotong di tengah meninggalkan penunjuknya pada keadaan yang
 * tidak jelas sudah maju atau belum.
 */
function pasangPemicu() {
  ScriptApp.getProjectTriggers().forEach(function (p) {
    var f = p.getHandlerFunction();
    if (f === 'jaringCelah' || f === 'jaringIsu') ScriptApp.deleteTrigger(p);
  });

  ScriptApp.newTrigger('jaringCelah').timeBased().atHour(3).everyDays(1).create();
  ScriptApp.newTrigger('jaringIsu').timeBased().atHour(5).everyDays(1).create();

  siapkanLembarTarget();
  siapkanLembarJurnal();

  SpreadsheetApp.getActive().toast(
    'Pemicu terpasang: per unit 03.00, per isu 05.00. Lembar Target dan Jurnal siap.',
    PENJARING_VERSI, 10);
}

/* ========================================================== jaring per unit */

function jaringCelah() {
  var mulai = new Date();
  var kuota = { ambil: 0 };
  var tolak = petaTolak();

  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(NAMA_LEMBAR) || berkas.getSheets()[0];
  var target = bacaTarget();

  if (!target.baris.length) {
    catatJurnal('unit', 0, 0, tolak, kuota, mulai, 'Lembar Target kosong. Jalankan pasangPemicu().');
    return;
  }

  var sudahAda = alamatYangSudahAda(lembar);
  var barisBaru = [];
  var dipilih = pilihSasaran(target, UNIT_PER_JALAN);

  for (var i = 0; i < dipilih.length; i++) {
    if (kuota.ambil >= BATAS_AMBIL) { tolak.kuota++; break; }

    var unit = dipilih[i].nama;
    var temuan = cariRss(kueriUnit(unit), kuota);

    for (var j = 0; j < temuan.length && j < BERITA_PER_UNIT; j++) {
      var t = temuan[j];

      if (!relevanUntukUnit(t, unit)) { tolak.takRelevan++; continue; }

      var url = uraikanAlamat(t, kuota);
      if (!url) { tolak.alamat++; continue; }

      var kunci = normalkanTautan(url);
      if (!kunci) { tolak.alamat++; continue; }
      if (sudahAda[kunci]) { tolak.kembar++; continue; }
      sudahAda[kunci] = true;

      barisBaru.push(susunBaris(t, kunci, unit, 'unit'));
    }

    tandaiDiperiksa(target, dipilih[i].baris);
  }

  tulisBaris(lembar, barisBaru);
  catatJurnal('unit', dipilih.length, barisBaru.length, tolak, kuota, mulai, '');
}

/* =========================================================== jaring per isu */

/**
 * Isu yang dicari, mengikuti taksonomi negatif sistem.
 *
 * Setiap kueri sengaja MENGIKAT kata isunya pada kata Pemasyarakatan. Tanpa
 * ikatan itu, "pungli" mengembalikan seluruh pungli di republik ini, dan yang
 * masuk ke arsip intelijen pemasyarakatan adalah berita dinas perhubungan.
 *
 * Urutannya menurut berat akibatnya bila terlewat, bukan menurut seberapa
 * sering ia muncul — pada jalan yang terpotong kuota, yang di atas tetap
 * terperiksa.
 */
var ISU = [
  { kode: '4.1', kueri: '("lapas" OR "rutan") ("tewas" OR "meninggal di sel" OR "gantung diri")' },
  { kode: '1.1', kueri: '("lapas" OR "rutan") ("napi kabur" OR "melarikan diri" OR "pelarian")' },
  { kode: '1.2', kueri: '("lapas" OR "rutan") ("kerusuhan" OR "ricuh" OR "pemberontakan")' },
  { kode: '3.3', kueri: '("sipir" OR "petugas lapas") ("menganiaya" OR "memukuli" OR "penganiayaan")' },
  { kode: '3.5', kueri: '("kalapas" OR "karutan" OR "kepala lapas") ("korupsi" OR "tersangka" OR "OTT")' },
  { kode: '4.3', kueri: '("lapas" OR "rutan") ("kebakaran" OR "terbakar" OR "banjir" OR "dievakuasi")' },
  { kode: '2.1', kueri: '("lapas" OR "rutan") ("narkoba" OR "sabu") ("dikendalikan" OR "peredaran")' },
  { kode: '6.1', kueri: '("lapas" OR "rutan") ("penyelundupan" OR "diselundupkan" OR "gagalkan")' },
  { kode: '3.1', kueri: '("lapas" OR "rutan") ("pungli" OR "pungutan liar" OR "dimintai uang")' },
  { kode: '5.1', kueri: '("napiter" OR "narapidana terorisme" OR "pembaiatan") ("lapas" OR "rutan")' },
  { kode: '4.2', kueri: '("lapas" OR "rutan") ("overkapasitas" OR "melebihi kapasitas" OR "kelebihan penghuni")' },
  { kode: '6.2', kueri: '("lapas" OR "rutan") ("unjuk rasa" OR "demo" OR "penyerangan")' },
  { kode: '3.6', kueri: '("oknum petugas lapas" OR "kepala lapas") ("asusila" OR "digerebek" OR "pelecehan")' },
  { kode: '7.2', kueri: '("residivis" OR "baru bebas") ("kembali ditangkap" OR "berulah")' },
];

function jaringIsu() {
  var mulai = new Date();
  var kuota = { ambil: 0 };
  var tolak = petaTolak();

  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(NAMA_LEMBAR) || berkas.getSheets()[0];
  var sudahAda = alamatYangSudahAda(lembar);
  var barisBaru = [];
  var diperiksa = 0;

  for (var i = 0; i < ISU.length; i++) {
    if (kuota.ambil >= BATAS_AMBIL) { tolak.kuota++; break; }
    diperiksa++;

    var temuan = cariRss(ISU[i].kueri, kuota);

    for (var j = 0; j < temuan.length && j < BERITA_PER_UNIT; j++) {
      var t = temuan[j];

      if (!berjangkarPemasyarakatan(t)) { tolak.takRelevan++; continue; }

      var url = uraikanAlamat(t, kuota);
      if (!url) { tolak.alamat++; continue; }

      var kunci = normalkanTautan(url);
      if (!kunci) { tolak.alamat++; continue; }
      if (sudahAda[kunci]) { tolak.kembar++; continue; }
      sudahAda[kunci] = true;

      // Nama UPT dibiarkan KOSONG dengan sengaja. Mesin pencocokan UPT di
      // sistem jauh lebih baik menebaknya daripada kueri ini — ia membaca
      // seluruh teks, mengenal 531 nama beserta sebutan sehari-harinya, dan
      // tahu kapan harus menyerah. Menebak di sini berarti menanam tebakan
      // buruk yang tidak bisa dibedakan dari keterangan yang sungguhan.
      barisBaru.push(susunBaris(t, kunci, '', 'isu:' + ISU[i].kode));
    }
  }

  tulisBaris(lembar, barisBaru);
  catatJurnal('isu', diperiksa, barisBaru.length, tolak, kuota, mulai, '');
}

/* ========================================================== penyusun kueri */

/**
 * Membangun kueri untuk satu unit, dengan ragam namanya.
 *
 * "Lapas Kelas IIB Tobello" hampir tidak pernah ditulis lengkap oleh wartawan.
 * Yang ditulis "Lapas Tobello", kadang "Lapas Tobelo". v1.0 hanya mencari
 * bentuk resminya dan karena itu melewatkan sebagian besar beritanya — bentuk
 * resmi hanya dipakai oleh siaran pers unit itu sendiri, yang justru sudah
 * tertangkap sumber lain.
 *
 * Nama dikutip penuh. Tanpa kutip, "Lapas Kelas IIB Tobello" cocok pada berita
 * lapas mana pun yang kebetulan memuat kata "kelas".
 */
function kueriUnit(namaLengkap) {
  var ragam = {};
  ragam[namaLengkap] = true;

  var pendek = namaLengkap
    .replace(/\s+Kelas\s+(I{1,3}|IV)[AB]?\b/i, '')
    .replace(/\s+Kelas\s+\d+[AB]?\b/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (pendek && pendek !== namaLengkap) ragam[pendek] = true;

  // Bentuk paling ringkas yang masih dipakai media daerah: kata jenisnya saja
  // ditambah nama tempatnya, tanpa keterangan Perempuan/Narkotika/Terbuka.
  //
  // TIDAK dipakai untuk unit berketerangan. "Lapas Perempuan Kelas IIA
  // Semarang" yang diringkas menjadi "Lapas Semarang" akan menarik berita
  // Lapas Kelas I Semarang — unit yang berbeda, di kota yang sama. Ringkasan
  // yang menabrak unit lain lebih buruk daripada tidak meringkas sama sekali.
  var cocok = namaLengkap.match(/^(Lapas|Rutan|Bapas|LPKA)\s+Kelas\s+\S+\s+(.+)$/);
  if (cocok) {
    var ringkas = cocok[1] + ' ' + cocok[2];
    if (ringkas.length > 6) ragam[ringkas] = true;
  }

  var bagian = [];
  for (var k in ragam) {
    if (!ragam.hasOwnProperty(k)) continue;
    /*
       Sisa penanda kelas dibuang.

       Ditemukan uji tools/uji-penjaring.mjs pada 6 September 2026: penyusun
       ragam sempat menghasilkan "Lapas IIB Tobello" — bentuk yang tidak pernah
       ditulis satu wartawan pun, dan yang memakan satu dari tiga slot kueri
       yang tersedia. Kerugiannya bukan hasil yang salah melainkan hasil yang
       HILANG: slot yang terpakai bentuk mati adalah slot yang tidak dipakai
       bentuk yang hidup.
    */
    if (/\b(I{1,3}|IV)[AB]?\b/.test(k.replace(namaLengkap, ''))) continue;
    bagian.push('"' + k + '"');
  }

  // Google News membatasi panjang kueri; tiga ragam sudah cukup dan lebih dari
  // itu mulai mengembalikan hasil yang sama berulang-ulang.
  return bagian.slice(0, 3).join(' OR ');
}

/* ========================================================== pengambil RSS */

function cariRss(kueri, kuota) {
  if (!kueri) return [];
  if (kuota.ambil >= BATAS_AMBIL) return [];

  var alamat = 'https://news.google.com/rss/search?q=' + encodeURIComponent(kueri)
    + '&hl=id&gl=ID&ceid=ID:id';

  var xml;
  try {
    kuota.ambil++;
    var jawaban = UrlFetchApp.fetch(alamat, { muteHttpExceptions: true, followRedirects: true });
    if (jawaban.getResponseCode() !== 200) return [];
    xml = XmlService.parse(jawaban.getContentText());
  } catch (e) {
    Logger.log('RSS gagal (' + kueri.slice(0, 60) + '): ' + e);
    return [];
  }
  Utilities.sleep(JEDA_MS);

  var butir;
  try {
    butir = xml.getRootElement().getChild('channel').getChildren('item');
  } catch (e) {
    return [];
  }

  var batasWaktu = new Date().getTime() - UMUR_MAKS_HARI * 24 * 60 * 60 * 1000;
  var hasil = [];

  for (var i = 0; i < butir.length; i++) {
    var b = butir[i];
    var judulPenuh = teksAnak(b, 'title');
    var tautanRss = teksAnak(b, 'link');
    var tanggalTeks = teksAnak(b, 'pubDate');
    var keterangan = teksAnak(b, 'description');

    if (!judulPenuh || !tautanRss) continue;

    var tanggal = new Date(tanggalTeks);
    if (isNaN(tanggal.getTime()) || tanggal.getTime() < batasWaktu) continue;

    // Judul Google News selalu berbentuk "Judul berita - Nama Portal".
    var portal = '';
    var judul = judulPenuh;
    var pisah = judulPenuh.lastIndexOf(' - ');
    if (pisah > 20) {
      judul = judulPenuh.substring(0, pisah).trim();
      portal = judulPenuh.substring(pisah + 3).trim();
    }
    if (!portal) portal = teksAnak(b, 'source') || 'Google News';

    hasil.push({
      judul: judul,
      portal: portal,
      tautanRss: tautanRss,
      keterangan: keterangan,
      tanggal: tanggal,
    });
  }

  return hasil;
}

/* ========================================================= saringan relevansi */

var JANGKAR = [
  'lapas', 'rutan', 'lembaga pemasyarakatan', 'rumah tahanan', 'bapas', 'lpka',
  'pemasyarakatan', 'warga binaan', 'narapidana', 'napi', 'tahanan', 'sipir',
  'ditjenpas', 'kemenimipas', 'imigrasi dan pemasyarakatan',
];

/** Benar bila teksnya benar-benar berbicara tentang Pemasyarakatan. */
function berjangkarPemasyarakatan(t) {
  var teks = (t.judul + ' ' + (t.keterangan || '')).toLowerCase();
  for (var i = 0; i < JANGKAR.length; i++) {
    if (teks.indexOf(JANGKAR[i]) !== -1) return true;
  }
  return false;
}

/**
 * Benar bila berita itu memang tentang unit yang sedang dicari.
 *
 * Dua syarat, dan keduanya perlu. Kueri "Lapas Kelas IIB Ende" mengembalikan
 * berita tentang KOTA Ende yang tidak ada urusannya dengan Pemasyarakatan —
 * itu ditolak syarat pertama. Kueri yang sama juga mengembalikan berita lapas
 * lain yang kebetulan memuat kata "kelas" dan "ende" di kalimat berbeda —
 * itu ditolak syarat kedua, yang menuntut penanda tempat unitnya muncul.
 *
 * v1.0 tidak punya keduanya, dan menulis apa pun yang dikembalikan Google.
 */
function relevanUntukUnit(t, namaUnit) {
  if (!berjangkarPemasyarakatan(t)) return false;

  var teks = (t.judul + ' ' + (t.keterangan || '')).toLowerCase();

  // Penanda tempat: kata terakhir nama unit yang bukan kata jenis atau kelas.
  var kata = namaUnit.split(/\s+/);
  var penanda = [];
  for (var i = kata.length - 1; i >= 0 && penanda.length < 2; i--) {
    var k = kata[i].toLowerCase();
    if (/^(lapas|rutan|bapas|lpka|kelas|perempuan|narkotika|terbuka|khusus|pemuda|i{1,3}|iv|ia|ib|iia|iib|iiia|iiib)$/.test(k)) continue;
    if (k.length < 4) continue;
    penanda.push(k);
  }

  if (!penanda.length) return true;   // nama tanpa penanda tempat; serahkan ke mesin

  for (var j = 0; j < penanda.length; j++) {
    if (teks.indexOf(penanda[j]) !== -1) return true;
  }
  return false;
}

/* ====================================================== pengurai alamat */

/**
 * Mengubah alamat pengalihan Google News menjadi alamat artikel sebenarnya.
 *
 * Tiga cara berurutan dari yang termurah. Yang ketiga membuka alamatnya
 * sungguhan dan karena itu dihitung terhadap kuota.
 *
 * Mengembalikan '' bila ketiganya gagal, dan pemanggilnya membuang butir itu.
 * Itu memang yang dikehendaki: alamat pengalihan yang tersimpan adalah
 * kembaran yang tidak bisa dikenali lapis penyaringan mana pun.
 */
function uraikanAlamat(t, kuota) {
  var tautan = t.tautanRss;

  // Cara 1 — jangkar di dalam <description>. Tanpa permintaan jaringan.
  if (t.keterangan) {
    var cocok = t.keterangan.match(/href="(https?:\/\/[^"]+)"/i);
    if (cocok && cocok[1].indexOf('news.google.com') === -1) return cocok[1];
  }

  // Cara 2 — alamatnya memang sudah bukan Google News.
  if (tautan.indexOf('news.google.com') === -1) return tautan;

  // Simpanan: alamat yang sama muncul di beberapa kueri sekaligus, dan
  // menguraikannya dua kali membayar kuota dua kali untuk jawaban yang sama.
  var simpanan = CacheService.getScriptCache();
  var kunciSimpan = 'u' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, tautan));
  var tersimpan = simpanan.get(kunciSimpan);
  if (tersimpan) return tersimpan === '-' ? '' : tersimpan;

  if (kuota.ambil >= BATAS_AMBIL) return '';

  // Cara 3 — buka alamatnya, baca alamat kanoniknya.
  var hasil = '';
  try {
    kuota.ambil++;
    var jawaban = UrlFetchApp.fetch(tautan, {
      muteHttpExceptions: true,
      followRedirects: true,
    });
    Utilities.sleep(JEDA_MS);

    if (jawaban.getResponseCode() === 200) {
      var isi = jawaban.getContentText();

      var kanonik = isi.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
        || isi.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
      if (kanonik && kanonik[1].indexOf('news.google.com') === -1) hasil = kanonik[1];

      if (!hasil) {
        var nAu = isi.match(/data-n-au=["']([^"']+)["']/i);
        if (nAu && nAu[1].indexOf('news.google.com') === -1) hasil = nAu[1];
      }
      if (!hasil) {
        var og = isi.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
        if (og && og[1].indexOf('news.google.com') === -1) hasil = og[1];
      }
    }
  } catch (e) {
    Logger.log('Gagal menguraikan alamat: ' + e);
  }

  // Kegagalan ikut disimpan, dengan umur yang sama. Alamat yang tidak bisa
  // diuraikan hari ini hampir selalu tetap begitu satu jam kemudian, dan
  // mencobanya lagi hanya membayar kuota untuk jawaban yang sudah diketahui.
  try { simpanan.put(kunciSimpan, hasil || '-', 21600); } catch (e) { /* penuh */ }
  return hasil;
}

/* ========================================================== penulis baris */

function susunBaris(t, url, namaUpt, asal) {
  return [
    Utilities.formatDate(t.tanggal, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm'),
    t.judul,
    t.portal,
    url,
    namaUpt,
    '',   // Kanwil — mesin yang memetakan
    '',   // Tingkat Risiko — mesin yang menilai
    'Ditemukan ' + PENJARING_VERSI + ' (' + asal + ').',
  ];
}

function tulisBaris(lembar, baris) {
  if (!baris.length) return;
  lembar.getRange(lembar.getLastRow() + 1, 1, baris.length, baris[0].length).setValues(baris);
}

/**
 * Alamat yang sudah tertulis di lembar ini, dalam bentuk seragam.
 *
 * Dibaca sekali di awal, bukan diperiksa baris per baris ke lembar. Lembar
 * berisi ribuan baris akan membuat cara kedua memakan seluruh jatah waktu.
 */
function alamatYangSudahAda(lembar) {
  var jumlah = lembar.getLastRow();
  var peta = {};
  if (jumlah < 2) return peta;

  var nilai = lembar.getRange(2, 4, jumlah - 1, 1).getValues();
  for (var i = 0; i < nilai.length; i++) {
    var kunci = normalkanTautan(nilai[i][0]);
    if (kunci) peta[kunci] = true;
  }
  return peta;
}

/* ========================================================== jurnal */

function petaTolak() {
  return { takRelevan: 0, alamat: 0, kembar: 0, kuota: 0 };
}

/**
 * Mencatat setiap jalan.
 *
 * Ini bukan kerapian. Penjaring yang berhenti bekerja — kuota habis, Google
 * mengubah bentuk RSS-nya, pemicunya terhapus — menghasilkan NOL BARIS BARU,
 * dan nol baris baru terlihat persis sama dengan "memang tidak ada berita baru
 * hari ini". Tanpa jurnal, kerusakan itu bisa berbulan-bulan tidak terlihat.
 *
 * Yang dicatat karena itu bukan hanya berapa yang ditemukan, melainkan berapa
 * yang DIPERIKSA dan berapa yang ditolak beserta sebabnya. Baris yang berbunyi
 * "60 diperiksa, 0 diterima, 60 ditolak: tak relevan" menerangkan keadaan yang
 * sama sekali berbeda dari "0 diperiksa".
 */
function catatJurnal(mode, diperiksa, diterima, tolak, kuota, mulai, catatan) {
  var lembar = siapkanLembarJurnal();
  var durasi = Math.round((new Date().getTime() - mulai.getTime()) / 1000);

  lembar.insertRowAfter(1);
  lembar.getRange(2, 1, 1, 9).setValues([[
    Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss'),
    mode,
    diperiksa,
    diterima,
    tolak.takRelevan,
    tolak.alamat,
    tolak.kembar,
    kuota.ambil,
    (durasi + ' dtk') + (tolak.kuota ? ' — TERPOTONG KUOTA' : '') + (catatan ? ' — ' + catatan : ''),
  ]]);

  // Jurnal dipangkas supaya tidak tumbuh selamanya. Enam puluh baris cukup
  // untuk satu bulan dua pemicu — cukup jauh untuk melihat pola, cukup pendek
  // untuk dibaca sekali pandang.
  var akhir = lembar.getLastRow();
  if (akhir > 61) lembar.deleteRows(62, akhir - 61);
}

function siapkanLembarJurnal() {
  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(LEMBAR_JURNAL);
  if (lembar) return lembar;

  lembar = berkas.insertSheet(LEMBAR_JURNAL);
  lembar.getRange(1, 1, 1, 9).setValues([[
    'Waktu', 'Mode', 'Diperiksa', 'Diterima',
    'Tolak: tak relevan', 'Tolak: alamat', 'Tolak: kembar',
    'Panggilan jaringan', 'Keterangan',
  ]]);
  lembar.getRange(1, 1, 1, 9).setFontWeight('bold');
  lembar.setFrozenRows(1);
  lembar.setColumnWidth(1, 150);
  lembar.setColumnWidth(9, 260);
  return lembar;
}

/* ========================================================== daftar sasaran */

/**
 * Membaca sasaran beserta kapan terakhir diperiksa.
 *
 * Kolom kedua ("terakhir diperiksa") membuat pemilihan sasaran tidak lagi
 * bergantung pada penunjuk yang disimpan terpisah. Penunjuk semacam itu
 * menjadi salah begitu daftarnya disunting — menghapus satu baris di tengah
 * menggeser seluruh sisanya, dan sebagian unit terlewat selamanya tanpa ada
 * yang menyadarinya.
 */
function bacaTarget() {
  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(LEMBAR_TARGET) || siapkanLembarTarget();

  var jumlah = lembar.getLastRow();
  if (jumlah < 2) return { lembar: lembar, baris: [] };

  var nilai = lembar.getRange(2, 1, jumlah - 1, 2).getValues();
  var baris = [];
  for (var i = 0; i < nilai.length; i++) {
    var nama = String(nilai[i][0] || '').trim();
    if (!nama) continue;
    var waktu = nilai[i][1] instanceof Date ? nilai[i][1].getTime() : 0;
    baris.push({ nama: nama, waktu: waktu, baris: i + 2 });
  }
  return { lembar: lembar, baris: baris };
}

/** Yang PALING LAMA tidak diperiksa didahulukan. */
function pilihSasaran(target, berapa) {
  var urut = target.baris.slice().sort(function (a, b) { return a.waktu - b.waktu; });
  return urut.slice(0, berapa);
}

function tandaiDiperiksa(target, nomorBaris) {
  target.lembar.getRange(nomorBaris, 2).setValue(new Date());
}

function siapkanUlangTarget() {
  var berkas = SpreadsheetApp.getActive();
  var lama = berkas.getSheetByName(LEMBAR_TARGET);
  if (lama) berkas.deleteSheet(lama);
  siapkanLembarTarget();
  SpreadsheetApp.getActive().toast('Lembar Target disusun ulang dari daftar bawaan.', PENJARING_VERSI, 8);
}

/**
 * Menulis daftar sasaran ke lembar tersendiri.
 *
 * Ditaruh di lembar, bukan hanya di dalam skrip, supaya bisa disunting tanpa
 * menyentuh kode: unit yang sudah ramai diberitakan bisa dicoret, unit baru
 * bisa ditambahkan. Skrip hanya membacanya.
 */
function siapkanLembarTarget() {
  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(LEMBAR_TARGET);
  if (lembar) return lembar;

  lembar = berkas.insertSheet(LEMBAR_TARGET);
  lembar.getRange(1, 1, 1, 2).setValues([['Nama UPT (belum pernah diberitakan per 6 Sep 2026)', 'Terakhir diperiksa']]);
  lembar.getRange(1, 1, 1, 2).setFontWeight('bold');

  var baris = TARGET_AWAL.map(function (n) { return [n, '']; });
  lembar.getRange(2, 1, baris.length, 2).setValues(baris);
  lembar.setColumnWidth(1, 380);
  lembar.setColumnWidth(2, 150);
  lembar.setFrozenRows(1);
  return lembar;
}

/* ========================================================== pembantu */

function teksAnak(elemen, nama) {
  try {
    var anak = elemen.getChild(nama);
    return anak ? String(anak.getText() || '').trim() : '';
  } catch (e) {
    return '';
  }
}

/**
 * Penyeragaman tautan — salinan keempat, dan yang paling tidak berwenang.
 *
 * Ditulis ulang di sini karena Apps Script tidak bisa mengimpor apa pun dari
 * repositori. Aturannya disamakan dengan `public.normalkan_tautan()` di basis
 * data; kalau suatu saat berbeda, akibatnya hanya pekerjaan sia-sia — bukan
 * berita kembar. Yang menolak kembaran adalah basis data.
 */
function normalkanTautan(nilai) {
  var t = String(nilai == null ? '' : nilai).replace(/\s+/g, ' ').trim();
  if (!t) return '';

  t = t.replace(/#.*$/, '');
  if (!/^https?:\/\//i.test(t)) t = 'https://' + t;

  var pecah = t.match(/^https?:\/\/([^\/?#]+)([\s\S]*)$/i);
  if (!pecah) return t.replace(/\/+$/, '');

  var inang = pecah[1].toLowerCase().replace(/^www\./, '');
  t = 'https://' + inang + (pecah[2] || '');

  t = t.replace(
    /([?&])(utm_[^=&]*|fbclid|gclid|dclid|msclkid|igsh|igshid|mibextid|ref|ref_src|refsrc|source|src|spm|scm|mc_cid|mc_eid|_ga|_gl|ncid|cmpid|campaign_id|at_medium|at_campaign|share_id|si)=[^&]*/gi,
    '$1');

  t = t.replace(/\?&+/, '?').replace(/&&+/g, '&').replace(/[?&]+$/, '');
  t = t.replace(/\/amp\/?$/i, '').replace(/\?outputType=amp$/i, '');
  return t.replace(/\/+$/, '');
}

/* ========================================================== daftar bawaan */

/**
 * 343 unit yang belum pernah muncul sekali pun dalam 858 publikasi terkumpul,
 * dihitung 6 September 2026 dari tabel `upt` dan `berita`.
 *
 * Dipakai SEKALI, saat lembar Target dibuat. Kueri untuk menyusunnya ulang ada
 * di `docs/penjaring-celah.md`.
 */
var TARGET_AWAL = [
  'Lapas Kelas I Batu High Risk Narkotika Nusakambangan', 'Lapas Kelas IIA Besi Nusakambangan',
  'Lapas Kelas IIA Gladakan Nusakambangan', 'Lapas Kelas IIA Kembang Kuning Nusakambangan',
  'Lapas Kelas IIA Kumbang Nusakambangan', 'Lapas Kelas IIA Pasir Putih Nusakambangan',
  'Lapas Kelas IIA Pekalongan', 'Lapas Kelas IIA Permisan Nusakambangan',
  'Lapas Kelas IIA Sragen', 'Lapas Kelas IIB Batang', 'Lapas Kelas IIB Brebes',
  'Lapas Kelas IIB Klaten', 'Lapas Kelas IIB Nirbaya Nusakambangan',
  'Lapas Kelas IIB Slawi', 'Lapas Kelas IIB Tegal', 'Lapas Narkotika Kelas IIA Nusakambangan',
  'Lapas Pemuda Kelas IIB Plantungan', 'Lapas Perempuan Kelas IIA Semarang',
  'Lapas Terbuka Kelas IIB Kendal', 'LPKA Kelas I Kutoarjo', 'Rutan Kelas I Semarang',
  'Rutan Kelas IIA Pekalongan', 'Rutan Kelas IIB Kebumen', 'Rutan Kelas IIB Kudus',
  'Rutan Kelas IIB Purbalingga', 'Rutan Kelas IIB Purworejo', 'Rutan Kelas IIB Rembang',
  'Rutan Kelas IIB Salatiga', 'Rutan Kelas IIB Temanggung', 'Rutan Kelas IIB Wonosobo',
  'Lapas Kelas IIA Binjai', 'Lapas Kelas IIA Labuhan Ruku', 'Lapas Kelas IIA Pematang Siantar',
  'Lapas Kelas IIB Gunung Sitoli', 'Lapas Kelas IIB Lubuk Pakam', 'Lapas Kelas IIB Panyabungan',
  'Lapas Kelas IIB Siborong-Borong', 'Lapas Kelas IIB Tebing Tinggi Deli', 'Lapas Kelas III Barus',
  'Lapas Kelas III Gunung Tua', 'Lapas Kelas III Kotanopan', 'Lapas Kelas III Pangururan',
  'Lapas Kelas III Teluk Dalam', 'Lapas Narkotika Kelas IIA Langkat',
  'Lapas Perempuan Kelas IIA Medan', 'LPKA Kelas I Medan', 'Rutan Kelas I Labuhan Deli',
  'Rutan Kelas IIB Humbang Hasundutan', 'Rutan Kelas IIB Natal',
  'Rutan Kelas IIB Pangkalan Brandan', 'Rutan Kelas IIB Sibuhuan', 'Rutan Kelas IIB Sipirok',
  'Rutan Kelas IIB Tanjung Pura', 'Rutan Perempuan Kelas IIA Medan',
  'Lapas Kelas IIB Bireun', 'Lapas Kelas IIB Blangkejeren', 'Lapas Kelas IIB Blangpidie',
  'Lapas Kelas IIB Idi', 'Lapas Kelas IIB Kota Bakti', 'Lapas Kelas IIB Kuala Simpang',
  'Lapas Kelas IIB Langsa', 'Lapas Kelas IIB Lhoksukon', 'Lapas Kelas IIB Meulaboh',
  'Lapas Kelas III Calang', 'Lapas Kelas III Lhok Nga', 'Lapas Narkotika Kelas IIB Langsa',
  'Lapas Perempuan Kelas IIB Sigli', 'LPKA Kelas II Banda Aceh', 'Rutan Kelas IIB Jantho',
  'Rutan Kelas IIB Sabang', 'Rutan Kelas IIB Sigli', 'Rutan Kelas IIB Tapaktuan',
  'Lapas Kelas IIA Bukittinggi', 'Lapas Kelas IIB Lubuk Basung', 'Lapas Kelas IIB Muara Sijunjung',
  'Lapas Kelas IIB Pariaman', 'Lapas Kelas IIB Payakumbuh', 'Lapas Kelas IIB Solok',
  'Lapas Kelas III Alahan Panjang', 'Lapas Kelas III Dharmasraya', 'Lapas Kelas III Talu',
  'Lapas Narkotika Kelas III Sawahlunto', 'Lapas Terbuka Kelas IIB Pasaman',
  'LPKA Kelas II Payakumbuh', 'Rutan Kelas IIB Lubuk Sikaping', 'Rutan Kelas IIB Maninjau',
  'Rutan Kelas IIB Muara Labuh', 'Rutan Kelas IIB Padang Panjang', 'Rutan Kelas IIB Painan',
  'Rutan Kelas IIB Sawahlunto',
  'Lapas Kelas IIA Bojonegoro', 'Lapas Kelas IIA Kediri', 'Lapas Kelas IIA Pamekasan',
  'Lapas Kelas IIB Bondowoso', 'Lapas Kelas IIB Lamongan', 'Lapas Kelas IIB Ngawi',
  'Lapas Kelas IIB Pasuruan', 'Lapas Kelas IIB Tulungagung', 'Lapas Kelas III Arjasa',
  'LPKA Kelas I Blitar', 'Rutan Kelas IIB Bangil', 'Rutan Kelas IIB Kraksaan',
  'Rutan Kelas IIB Magetan', 'Rutan Kelas IIB Nganjuk', 'Rutan Kelas IIB Pacitan',
  'Rutan Kelas IIB Sampang', 'Rutan Kelas IIB Situbondo',
  'Lapas Kelas IIA Bulukumba', 'Lapas Kelas IIA Pare-Pare', 'Lapas Kelas IIB Takalar',
  'Lapas Narkotika Kelas IIA Sungguminasa', 'Lapas Perempuan Kelas IIA Sungguminasa',
  'LPKA Kelas II Maros', 'Rutan Kelas IIB Bantaeng', 'Rutan Kelas IIB Barru',
  'Rutan Kelas IIB Enrekang', 'Rutan Kelas IIB Jeneponto', 'Rutan Kelas IIB Malino',
  'Rutan Kelas IIB Masamba', 'Rutan Kelas IIB Pangkajene', 'Rutan Kelas IIB Pinrang',
  'Rutan Kelas IIB Sidenreng Rapang', 'Rutan Kelas IIB Sinjai', 'Rutan Kelas IIB Watansoppeng',
  'Lapas Kelas IIB Atambua', 'Lapas Kelas IIB Ende', 'Lapas Kelas IIB Kalabahi',
  'Lapas Kelas IIB Waikabubak', 'Lapas Kelas III Baa', 'Lapas Perempuan Kelas IIB Kupang',
  'Lapas Terbuka Kelas IIB Waikabubak', 'LPKA Kelas I Kupang', 'Rutan Kelas IIB Bajawa',
  'Rutan Kelas IIB Kefamenanu', 'Rutan Kelas IIB Kupang', 'Rutan Kelas IIB Larantuka',
  'Rutan Kelas IIB Maumere',
  'Lapas Kelas IIA Manado', 'Lapas Kelas IIB Bitung', 'Lapas Kelas IIB Tahuna',
  'Lapas Kelas IIB Tondano', 'Lapas Kelas IIB Ulu Siau', 'Lapas Kelas III Enemawira',
  'Lapas Kelas III Lirung', 'Lapas Kelas III Tagulandang', 'Lapas Kelas III Tamako',
  'Lapas Perempuan Kelas IIB Manado', 'LPKA Kelas II Tomohon', 'Rutan Kelas IIA Manado',
  'Rutan Kelas IIB Kotamobagu',
  'Lapas Kelas IIA Banyuasin', 'Lapas Kelas IIA Lahat', 'Lapas Kelas IIB Empat Lawang',
  'Lapas Kelas IIB Muara Dua', 'Lapas Kelas IIB Muara Enim', 'Lapas Kelas IIB Sekayu',
  'Lapas Kelas III Pagar Alam', 'Lapas Kelas III Sarolangun Rawas',
  'Lapas Narkotika Kelas IIB Banyuasin', 'Lapas Perempuan Kelas IIA Palembang',
  'LPKA Kelas I Palembang', 'Rutan Kelas IIB Baturaja', 'Rutan Kelas IIB Prabumulih',
  'Lapas Kelas IIA Bagan Siapi-Api', 'Lapas Kelas IIA Bangkinang', 'Lapas Kelas IIA Bengkalis',
  'Lapas Kelas IIA Tembilahan', 'Lapas Kelas IIB Selat Panjang', 'Lapas Kelas IIB Teluk Kuantan',
  'Lapas Narkotika Kelas IIB Rumbai', 'Lapas Terbuka Kelas III Rumbai',
  'LPKA Kelas II Pekanbaru', 'Rutan Kelas IIB Dumai', 'Rutan Kelas IIB Rengat',
  'Rutan Kelas IIB Siak Sri Indrapura',
  'Lapas Kelas IIA Bekasi', 'Lapas Kelas IIA Bogor', 'Lapas Kelas IIA Cikarang',
  'Lapas Kelas IIA Kuningan', 'Lapas Kelas IIB Cianjur', 'Lapas Khusus Kelas IIA Gunung Sindur',
  'Lapas Khusus Kelas IIB Sentul', 'Lapas Narkotika Kelas IIA Bandung', 'LPKA Kelas II Bandung',
  'Rutan Kelas I Depok',
  'Lapas Kelas IIA Palangkaraya', 'Lapas Kelas IIB Muara Teweh', 'Lapas Kelas IIB Pangkalan Bun',
  'Lapas Kelas IIB Sampit', 'Lapas Kelas III Sukamara', 'Lapas Narkotika Kelas IIA Kasongan',
  'LPKA Kelas II Palangkaraya', 'Rutan Kelas IIB Buntok', 'Rutan Kelas IIB Kuala Kapuas',
  'Rutan Kelas IIB Tamiang Layang',
  'Lapas Kelas III Dobo', 'Lapas Kelas III Geser', 'Lapas Kelas III Namlea',
  'Lapas Kelas III Saparua', 'Lapas Kelas III Saumlaki', 'Lapas Kelas III Wonreli',
  'Lapas Perempuan Kelas III Ambon', 'LPKA Kelas II Ambon', 'Rutan Kelas IIA Ambon',
  'Rutan Kelas IIB Masohi',
  'Lapas Kelas IIA Ternate', 'Lapas Kelas IIB Jailolo', 'Lapas Kelas IIB Sanana',
  'Lapas Kelas IIB Tobello', 'Lapas Kelas III Labuha', 'Lapas Perempuan Kelas III Ternate',
  'LPKA Kelas II Ternate', 'Rutan Kelas IIB Soa Siu', 'Rutan Kelas IIB Ternate',
  'Rutan Kelas IIB Weda',
  'Lapas Kelas IIA Pontianak', 'Lapas Kelas IIB Singkawang', 'Lapas Perempuan Kelas IIA Pontianak',
  'LPKA Kelas II Sungai Raya', 'Rutan Kelas IIA Pontianak', 'Rutan Kelas IIB Mempawah',
  'Rutan Kelas IIB Putussibau', 'Rutan Kelas IIB Sambas', 'Rutan Kelas IIB Sanggau',
  'Lapas Kelas IIA Kalianda', 'Lapas Kelas IIA Kotabumi', 'Lapas Kelas IIA Metro',
  'Lapas Kelas IIB Kota Agung', 'Lapas Kelas IIB Waykanan', 'LPKA Kelas II Bandar Lampung',
  'Rutan Kelas IIB Kota Agung', 'Rutan Kelas IIB Krui', 'Rutan Kelas IIB Menggala',
  'Lapas Kelas IIA Mataram', 'Lapas Kelas IIA Sumbawa Besar', 'Lapas Kelas IIB Dompu',
  'Lapas Kelas IIB Selong', 'Lapas Perempuan Kelas III Mataram',
  'Lapas Terbuka Kelas IIB Lombok Tengah', 'LPKA Kelas II Lombok Tengah',
  'Rutan Kelas IIB Praya', 'Rutan Kelas IIB Raba Bima',
  'Lapas Kelas IIB Ampana', 'Lapas Kelas IIB Luwuk', 'Lapas Kelas IIB Toli-Toli',
  'Lapas Kelas III Kolonedale', 'Lapas Kelas III Parigi', 'Lapas Perempuan Kelas III Palu',
  'LPKA Kelas II Palu', 'Rutan Kelas IIB Donggala', 'Rutan Kelas IIB Poso',
  'Lapas Kelas IIA Yogyakarta', 'Lapas Kelas IIB Wonosari', 'Lapas Narkotika Kelas IIA Yogyakarta',
  'Lapas Perempuan Kelas IIB Yogyakarta', 'LPKA Kelas II Yogyakarta', 'Rutan Kelas IIA Yogyakarta',
  'Rutan Kelas IIB Bantul', 'Rutan Kelas IIB Wates',
  'Lapas Kelas IIB Bangko', 'Lapas Kelas IIB Kuala Tungkal', 'Lapas Kelas IIB Muara Bungo',
  'Lapas Kelas IIB Sarolangun', 'Lapas Narkotika Kelas IIB Muara Sabak',
  'Lapas Perempuan Kelas IIB Jambi', 'LPKA Kelas II Muara Bulia', 'Rutan Kelas IIB Sungai Penuh',
  'Lapas Kelas IIB Amuntai', 'Lapas Kelas IIB Banjar Baru', 'Lapas Narkotika Kelas IIA Karang Intan',
  'Lapas Perempuan Kelas IIA Martapura', 'LPKA Kelas I Martapura', 'Rutan Kelas IIB Barabai',
  'Rutan Kelas IIB Pelaihari', 'Rutan Kelas IIB Rantau',
  'Lapas Kelas IIB Karangasem', 'Lapas Kelas IIB Singaraja', 'Lapas Narkotika Kelas IIA Bangli',
  'Lapas Perempuan Kelas IIA Denpasar', 'LPKA Kelas II Karangasem', 'Rutan Kelas IIB Bangli',
  'Rutan Kelas IIB Klungkung',
  'Lapas Kelas I Tangerang', 'Lapas Kelas IIA Serang', 'Lapas Kelas III Rangkasbitung',
  'Lapas Perempuan Kelas IIA Tangerang', 'LPKA Kelas I Tangerang', 'Rutan Kelas I Tangerang',
  'Rutan Kelas IIB Pandeglang',
  'Lapas Kelas IIB Polewali', 'Lapas Kelas III Mamasa', 'Lapas Perempuan Kelas III Mamuju',
  'LPKA Kelas II Mamuju', 'Rutan Kelas IIB Majene', 'Rutan Kelas IIB Mamuju',
  'Rutan Kelas IIB Pasangkayu',
  'Lapas Kelas IIA Batam', 'Lapas Kelas III Dabo Singkep', 'Lapas Perempuan Kelas IIB Batam',
  'LPKA Kelas II Batam', 'Rutan Kelas I Tanjung Pinang', 'Rutan Kelas IIB Tanjung Balai Karimun',
  'Lapas Kelas IIA Kendari', 'Lapas Perempuan Kelas III Kendari', 'LPKA Kelas II Kendari',
  'Rutan Kelas IIB Kolaka', 'Rutan Kelas IIB Raha', 'Rutan Kelas IIB Unaaha',
  'Lapas Kelas IIA Bengkulu', 'Lapas Perempuan Kelas IIB Bengkulu', 'LPKA Kelas II Bengkulu',
  'Rutan Kelas IIB Bengkulu', 'Rutan Kelas IIB Manna',
  'Lapas Kelas IIA Samarinda', 'Lapas Narkotika Kelas IIA Samarinda',
  'Lapas Perempuan Kelas IIA Samarinda', 'LPKA Kelas II Tenggarong', 'Rutan Kelas IIB Tanjung Redeb',
  'Lapas Kelas IIA Abepura', 'Lapas Kelas IIB Biak', 'Lapas Narkotika Kelas IIA Jayapura',
  'Lapas Perempuan Kelas III Jayapura', 'LPKA Kelas II Jayapura',
  'Lapas Kelas IIB Fakfak', 'Lapas Kelas IIB Manokwari', 'Lapas Kelas III Kaimana',
  'Lapas Perempuan Kelas III Manokwari', 'Rutan Kelas IIB Bintuni',
  'Lapas Kelas IIA Gorontalo', 'Lapas Kelas IIB Pahuwato', 'Lapas Perempuan Kelas III Gorontalo',
  'LPKA Kelas II Gorontalo',
  'Lapas Kelas IIB Tanjung Pandan', 'Lapas Narkotika Kelas IIA Pangkal Pinang',
  'LPKA Kelas II Pangkal Pinang',
  'Lapas Kelas IIA Tarakan', 'Lapas Kelas IIB Nunukan',
  'Lapas Kelas IIB Merauke', 'Lapas Kelas III Tanah Merah',
  'LPKA Kelas II Jakarta', 'Lapas Kelas III Teminabuhan',
  'Lapas Kelas IIB Wamena', 'Lapas Kelas IIB Nabire',
];
