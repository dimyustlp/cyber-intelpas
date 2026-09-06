/**
 * ============================================================================
 * PENJARING CELAH — Trans-Siber PAS, sumber ketiga
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
 * Diukur pada 6 September 2026: dari 531 unit pelaksana teknis yang aktif,
 * **343 belum pernah muncul satu kali pun** dalam 858 publikasi yang terkumpul.
 * Enam puluh empat persen. Kantor Wilayah Maluku Utara nol dari sepuluh unit;
 * Sulawesi Utara satu dari empat belas.
 *
 * Itu bukan berarti tidak ada beritanya. Dua sumber yang sudah ada bekerja
 * dengan cara yang sama-sama pasif: keduanya menyapu kata kunci umum
 * ("lapas", "rutan", "pemasyarakatan") dan memungut apa pun yang lewat.
 * Penyapuan semacam itu selalu menemukan yang paling ramai, dan yang paling
 * ramai selalu unit besar di pulau yang sama. Unit kecil di Halmahera tidak
 * pernah kalah beritanya — ia tidak pernah dicari.
 *
 * Penjaring ini bekerja terbalik: ia berangkat dari DAFTAR UNIT, bukan dari
 * kata kunci. Setiap unit yang sunyi dicari namanya satu per satu. Yang
 * ditemukan mungkin sedikit, dan memang seharusnya sedikit — tetapi yang
 * sedikit itu berasal dari tempat yang selama ini tidak terlihat sama sekali.
 *
 * ----------------------------------------------------------------------------
 * BERITA KEMBAR
 * ----------------------------------------------------------------------------
 *
 * Penjaring ini SENGAJA mencari di wilayah yang bertumpang tindih dengan dua
 * sumber lain. Karena itu berita kembar bukan kemungkinan, melainkan kepastian.
 *
 * Ada tiga lapis yang menahannya, dan hanya lapis pertama ada di berkas ini:
 *
 *   1. Di sini      — alamat yang sudah ada di lembar ini tidak ditulis lagi
 *   2. Penyalin     — baris yang tautannya sudah ada di basis data dilewati
 *   3. Basis data   — pemicu + indeks unik pada link_normalized; tidak bisa
 *                     ditembus siapa pun, termasuk oleh berkas ini
 *
 * Aturan penyeragaman di bawah (normalkanTautan) adalah salinan keempat dari
 * aturan yang sama. Ia boleh meleset tanpa menimbulkan berita kembar — yang
 * terjadi hanya pekerjaan sia-sia, sebab lapis ketiga tetap menolak. Aturan
 * yang berwenang ada di `public.normalkan_tautan()`.
 *
 * ----------------------------------------------------------------------------
 * ALAMAT GOOGLE NEWS, DAN KENAPA IA HARUS DIURAIKAN
 * ----------------------------------------------------------------------------
 *
 * RSS Google News tidak memberikan alamat artikelnya, melainkan alamat
 * pengalihan miliknya sendiri:
 *
 *   https://news.google.com/rss/articles/CBMiK2h0dHBzOi8vd3d3...
 *
 * Kalau alamat itu yang ditulis, seluruh penyaringan kembar akan LOLOS: satu
 * artikel yang sama akan tersimpan dua kali — sekali sebagai alamat portalnya
 * dari sumber lain, sekali sebagai alamat pengalihan dari sini. Ketiga lapis
 * di atas tidak akan menangkapnya, sebab keduanya memang alamat yang berbeda.
 *
 * Karena itu setiap alamat diuraikan lebih dulu, dengan tiga cara berurutan
 * dari yang termurah: dari isi <description>, dari <source url>, lalu — kalau
 * keduanya gagal — dengan benar-benar membuka alamatnya dan membaca alamat
 * kanoniknya. Yang tidak berhasil diuraikan TIDAK DITULIS sama sekali. Lebih
 * baik kehilangan satu berita daripada menanam satu kembaran yang tidak bisa
 * dikenali siapa pun sesudahnya.
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
 * Langkah 4 wajib: penyalin membacanya tanpa akun Google, persis seperti dua
 * sumber lainnya. Tanpa itu halaman Sinkronisasi Sumber akan menampilkannya
 * berstatus Gagal — dan itu benar, bukan kekeliruan yang perlu diperbaiki.
 *
 * Sesudah langkah 4 tidak ada lagi yang perlu ditekan. pg_cron memanggil
 * penyalin tiap lima menit.
 */

/* ========================================================== setelan */

const PENJARING_VERSI = 'penjaring-celah-v1.0';

/**
 * Berapa unit dicari sekali jalan.
 *
 * Dua belas, bukan seluruhnya. Apps Script membatasi satu jalan pada enam menit
 * dan UrlFetchApp pada 20.000 panggilan sehari; 343 unit sekali jalan pasti
 * terpotong di tengah, dan yang terpotong di tengah selalu unit yang sama —
 * yang di ujung daftar tidak akan pernah tersentuh. Dengan penunjuk berputar,
 * seluruh 343 unit selesai dalam sekitar 29 hari lalu mengulang dari awal.
 */
const PER_JALAN = 12;

/** Berapa berita teratas diambil per unit. Lebih dari ini hampir selalu berulang. */
const PER_UNIT = 4;

/** Berita yang lebih tua dari ini dilewati; arsip lama bukan tugas penjaring. */
const UMUR_MAKS_HARI = 45;

const NAMA_LEMBAR = 'Sheet1';
const NAMA_LEMBAR_TARGET = 'Target';

/* ========================================================== pemicu */

/** Dijalankan SEKALI dengan tangan. Memasang jadwal harian pukul 03.00 WIB. */
function pasangPemicu() {
  ScriptApp.getProjectTriggers().forEach(function (p) {
    if (p.getHandlerFunction() === 'jaringCelah') ScriptApp.deleteTrigger(p);
  });

  ScriptApp.newTrigger('jaringCelah').timeBased().atHour(3).everyDays(1).create();

  siapkanLembarTarget();
  SpreadsheetApp.getActive().toast('Pemicu harian terpasang (03.00). Lembar Target disiapkan.');
}

/* ========================================================== inti */

function jaringCelah() {
  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(NAMA_LEMBAR) || berkas.getSheets()[0];
  var target = bacaTarget();

  if (!target.length) {
    Logger.log('Lembar Target kosong. Jalankan pasangPemicu() lebih dulu.');
    return;
  }

  var simpanan = PropertiesService.getScriptProperties();
  var mulai = Number(simpanan.getProperty('penunjuk') || 0) % target.length;

  var sudahAda = alamatYangSudahAda(lembar);
  var barisBaru = [];
  var diperiksa = 0;

  for (var i = 0; i < PER_JALAN; i++) {
    var unit = target[(mulai + i) % target.length];
    if (!unit) continue;
    diperiksa++;

    var temuan = cariBerita(unit);
    for (var j = 0; j < temuan.length; j++) {
      var t = temuan[j];
      var kunci = normalkanTautan(t.url);
      if (!kunci) continue;

      // Lapis pertama: jangan tulis dua kali di lembar ini sendiri. Termasuk
      // terhadap baris yang baru saja ditambahkan pada jalan yang sama — dua
      // unit yang bertetangga sering muncul dalam satu berita.
      if (sudahAda[kunci]) continue;
      sudahAda[kunci] = true;

      barisBaru.push([
        t.tanggal,          // Waktu Terdeteksi
        t.judul,            // Judul Berita
        t.portal,           // Sumber / Portal
        kunci,              // URL / Link Artikel — sudah seragam
        unit,               // Nama UPT
        '',                 // Kanwil — dibiarkan kosong, mesin yang memetakan
        '',                 // Tingkat Risiko — dibiarkan kosong, mesin yang menilai
        'Ditemukan penjaring celah ' + PENJARING_VERSI
          + ' saat mencari unit yang belum pernah diberitakan.',
      ]);
    }
  }

  if (barisBaru.length) {
    lembar.getRange(lembar.getLastRow() + 1, 1, barisBaru.length, barisBaru[0].length)
      .setValues(barisBaru);
  }

  simpanan.setProperty('penunjuk', String((mulai + PER_JALAN) % target.length));
  simpanan.setProperty('terakhir', new Date().toISOString());

  Logger.log('Penjaring celah: ' + diperiksa + ' unit diperiksa, '
    + barisBaru.length + ' berita baru ditulis. Penunjuk berikutnya: '
    + ((mulai + PER_JALAN) % target.length));
}

/* ========================================================== pencarian */

/**
 * Mencari berita untuk satu unit lewat RSS Google News.
 *
 * Nama unitnya dikutip penuh. Tanpa kutip, "Lapas Kelas IIB Tobello" akan
 * cocok pada berita lapas mana pun yang kebetulan memuat kata "kelas" —
 * dan yang kembali adalah kebisingan dari unit yang justru sudah terliput.
 */
function cariBerita(namaUnit) {
  var kueri = '"' + namaUnit + '"';
  var alamat = 'https://news.google.com/rss/search?q=' + encodeURIComponent(kueri)
    + '&hl=id&gl=ID&ceid=ID:id';

  var xml;
  try {
    var jawaban = UrlFetchApp.fetch(alamat, { muteHttpExceptions: true, followRedirects: true });
    if (jawaban.getResponseCode() !== 200) return [];
    xml = XmlService.parse(jawaban.getContentText());
  } catch (e) {
    Logger.log('Gagal mengambil RSS untuk ' + namaUnit + ': ' + e);
    return [];
  }

  var butir;
  try {
    butir = xml.getRootElement().getChild('channel').getChildren('item');
  } catch (e) {
    return [];
  }

  var batasWaktu = new Date().getTime() - UMUR_MAKS_HARI * 24 * 60 * 60 * 1000;
  var hasil = [];

  for (var i = 0; i < butir.length && hasil.length < PER_UNIT; i++) {
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
    var pisah = judulPenuh.lastIndexOf(' - ');
    var judul = judulPenuh;
    if (pisah > 20) {
      judul = judulPenuh.substring(0, pisah).trim();
      portal = judulPenuh.substring(pisah + 3).trim();
    }
    if (!portal) portal = teksAnak(b, 'source') || 'Google News';

    var urlAsli = uraikanAlamat(tautanRss, keterangan, b);
    if (!urlAsli) continue;   // lihat catatan di kepala berkas: lebih baik hilang

    hasil.push({
      judul: judul,
      portal: portal,
      url: urlAsli,
      tanggal: Utilities.formatDate(tanggal, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm'),
    });
  }

  return hasil;
}

/**
 * Mengubah alamat pengalihan Google News menjadi alamat artikel yang sebenarnya.
 *
 * Tiga cara, dicoba berurutan dari yang termurah. Yang ketiga membuka
 * alamatnya sungguhan dan karena itu dibatasi — ia satu-satunya yang memakan
 * kuota UrlFetchApp dan waktu jalan.
 *
 * Mengembalikan '' bila ketiganya gagal. Pemanggilnya membuang butir itu, dan
 * itu memang yang dikehendaki: alamat pengalihan yang tersimpan adalah
 * kembaran yang tidak bisa dikenali oleh lapis penyaringan mana pun.
 */
function uraikanAlamat(tautanRss, keterangan, butir) {
  // Cara 1 — jangkar di dalam <description>. Tanpa permintaan jaringan.
  if (keterangan) {
    var cocok = keterangan.match(/href="(https?:\/\/[^"]+)"/i);
    if (cocok && cocok[1].indexOf('news.google.com') === -1) return cocok[1];
  }

  // Cara 2 — alamat portal pada <source>. Hanya berguna bila artikelnya
  // kebetulan di akar; jarang, tetapi gratis.
  try {
    var sumber = butir.getChild('source');
    if (sumber) {
      var alamatSumber = sumber.getAttribute('url');
      if (alamatSumber) {
        var nilai = alamatSumber.getValue();
        // Hanya dipakai bila alamat RSS-nya sendiri sudah menunjuk portal itu.
        if (tautanRss.indexOf('news.google.com') === -1) return tautanRss;
        // Alamat akar portal bukan alamat artikel; jangan dipakai sendirian.
        void nilai;
      }
    }
  } catch (e) { /* tidak apa-apa, lanjut ke cara ketiga */ }

  // Alamat yang memang sudah bukan Google News.
  if (tautanRss.indexOf('news.google.com') === -1) return tautanRss;

  // Cara 3 — buka alamatnya, baca alamat kanoniknya.
  try {
    var jawaban = UrlFetchApp.fetch(tautanRss, {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: true,
    });
    if (jawaban.getResponseCode() !== 200) return '';

    var isi = jawaban.getContentText();

    var kanonik = isi.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
      || isi.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    if (kanonik && kanonik[1].indexOf('news.google.com') === -1) return kanonik[1];

    // Halaman antara milik Google News menaruh alamat tujuannya di sini.
    var nAu = isi.match(/data-n-au=["']([^"']+)["']/i);
    if (nAu && nAu[1].indexOf('news.google.com') === -1) return nAu[1];

    var ogUrl = isi.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
    if (ogUrl && ogUrl[1].indexOf('news.google.com') === -1) return ogUrl[1];
  } catch (e) {
    Logger.log('Gagal menguraikan alamat: ' + e);
  }

  return '';
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
 * Alamat yang sudah tertulis di lembar ini, dalam bentuk seragam.
 *
 * Dibaca sekali di awal, bukan diperiksa baris per baris ke lembar. Lembar
 * yang sudah berisi ribuan baris akan membuat cara kedua memakan seluruh
 * jatah waktu jalan.
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

/**
 * Penyeragaman tautan — salinan keempat, dan yang paling tidak berwenang.
 *
 * Ditulis ulang di sini karena Apps Script tidak bisa mengimpor apa pun dari
 * repositori. Aturannya disamakan dengan `public.normalkan_tautan()` di basis
 * data; kalau suatu saat berbeda, akibatnya hanya pekerjaan sia-sia — bukan
 * berita kembar. Yang menolak kembaran adalah basis data, bukan berkas ini.
 */
function normalkanTautan(nilai) {
  var t = String(nilai == null ? '' : nilai).replace(/\s+/g, ' ').trim();
  if (!t) return '';

  t = t.replace(/#.*$/, '');
  if (!/^https?:\/\//i.test(t)) t = 'https://' + t;

  var pecah = t.match(/^https?:\/\/([^\/?#]+)([\s\S]*)$/i);
  if (!pecah) return t.replace(/\/+$/, '');

  var inang = pecah[1].toLowerCase().replace(/^www\./, '');
  var sisa = pecah[2] || '';

  t = 'https://' + inang + sisa;

  t = t.replace(
    /([?&])(utm_[^=&]*|fbclid|gclid|dclid|msclkid|igsh|igshid|mibextid|ref|ref_src|refsrc|source|src|spm|scm|mc_cid|mc_eid|_ga|_gl|ncid|cmpid|campaign_id|at_medium|at_campaign|share_id|si)=[^&]*/gi,
    '$1');

  t = t.replace(/\?&+/, '?').replace(/&&+/g, '&').replace(/[?&]+$/, '');
  t = t.replace(/\/amp\/?$/i, '').replace(/\?outputType=amp$/i, '');
  return t.replace(/\/+$/, '');
}

/* ========================================================== daftar sasaran */

/** Membaca sasaran dari lembar Target; menyiapkannya bila belum ada. */
function bacaTarget() {
  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(NAMA_LEMBAR_TARGET);
  if (!lembar) lembar = siapkanLembarTarget();

  var jumlah = lembar.getLastRow();
  if (jumlah < 2) return [];

  var nilai = lembar.getRange(2, 1, jumlah - 1, 1).getValues();
  var keluar = [];
  for (var i = 0; i < nilai.length; i++) {
    var nama = String(nilai[i][0] || '').trim();
    if (nama) keluar.push(nama);
  }
  return keluar;
}

/**
 * Menulis daftar sasaran ke lembar tersendiri.
 *
 * Ditaruh di lembar, bukan disimpan di dalam skrip saja, supaya bisa disunting
 * tanpa menyentuh kode: unit yang sudah ramai diberitakan bisa dicoret, unit
 * baru bisa ditambahkan, dan urutannya bisa diubah sesuai perhatian pimpinan
 * pekan itu. Skrip hanya membacanya.
 *
 * Urutannya BUKAN abjad melainkan menurut beratnya celah — kantor wilayah
 * dengan unit sunyi terbanyak lebih dulu. Dengan penunjuk berputar, urutan itu
 * menentukan siapa yang tersentuh pada hari-hari pertama.
 */
function siapkanLembarTarget() {
  var berkas = SpreadsheetApp.getActive();
  var lembar = berkas.getSheetByName(NAMA_LEMBAR_TARGET);
  if (lembar) return lembar;

  lembar = berkas.insertSheet(NAMA_LEMBAR_TARGET);
  lembar.getRange(1, 1).setValue('Nama UPT yang belum pernah diberitakan (per 6 September 2026)');
  lembar.getRange(1, 1).setFontWeight('bold');

  var baris = TARGET_AWAL.map(function (n) { return [n]; });
  lembar.getRange(2, 1, baris.length, 1).setValues(baris);
  lembar.setColumnWidth(1, 380);
  lembar.setFrozenRows(1);
  return lembar;
}

/**
 * 343 unit yang belum pernah muncul sekali pun dalam 858 publikasi terkumpul,
 * dihitung 6 September 2026 dari tabel `upt` dan `berita`.
 *
 * Daftar ini hanya dipakai SEKALI, saat lembar Target dibuat. Sesudah itu yang
 * dibaca adalah lembarnya. Untuk menyusun ulang daftar ini kelak, jalankan
 * kueri yang tertulis di `docs/penjaring-celah.md`.
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
