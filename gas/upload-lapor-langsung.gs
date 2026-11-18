/**
 * Apps Script Web App — penerima unggahan berkas Lapor Langsung dari halaman
 * Trans-Siber PAS, lalu menyimpan ke Google Drive milik pengelola sistem.
 *
 * Cara pasang (sekali saja):
 *   1. Buat folder di Google Drive milik Bapak, misalnya
 *      "Trans-Siber PAS — Lapor Langsung". Buka folder itu, lihat alamat di
 *      peramban, salin bagian setelah ".../folders/": itulah FOLDER_ID.
 *   2. Buka https://script.google.com, klik Project baru.
 *   3. Tempel seluruh isi berkas ini ke editor. Ganti nilai FOLDER_ID di
 *      bawah dengan yang barusan disalin. Simpan.
 *   4. Deploy ▸ New deployment ▸ Type: Web app.
 *      Execute as: Me (akun Bapak).
 *      Who has access: Anyone.
 *      Klik Deploy. Google minta konfirmasi dua kali — izinkan.
 *   5. Salin "Web app URL" yang muncul (alamatnya berakhir /exec).
 *   6. Tempelkan alamat itu di web/js/lib/konfig.js baris `driveUpload: ''`,
 *      atau beritahu saya alamatnya — saya yang tempel.
 *
 * Alur kerja:
 *   - Halaman Lapor Langsung mengirim JSON berisi berkas (base64) + metadata.
 *   - Skrip ini membuat subfolder per laporan di FOLDER_ID (nama subfolder =
 *     id laporan), lalu menulis tiap berkas di dalamnya. Nama berkas diberi
 *     awalan waktu supaya tidak saling menimpa bila nama aslinya sama.
 *   - Mengembalikan daftar {jalur, driveId, driveUrl} untuk disimpan di tabel
 *     `lapor_langsung`. `jalur` mengikuti konvensi bucket Supabase supaya satu
 *     halaman tidak perlu membedakan dari mana berkasnya dibaca kembali.
 *
 * Catatan CORS:
 *   Apps Script Web App tidak bisa mengatur header CORS. Permintaan POST dari
 *   peramban dibuat memakai Content-Type `text/plain` supaya tidak memicu
 *   preflight; isinya tetap JSON, hanya label jenisnya saja yang diubah.
 */

const FOLDER_ID = 'GANTI_DENGAN_ID_FOLDER_DRIVE_ANDA';

/** Batas aman per permintaan Apps Script: 50 MB termasuk base64. */
const BATAS_BITA_TOTAL = 45 * 1024 * 1024;

function doPost(e) {
  try {
    const muatan = JSON.parse(e.postData.contents);
    if (!muatan || !muatan.laporanId || !Array.isArray(muatan.berkas)) {
      return keluaran({ ok: false, pesan: 'Permintaan tidak lengkap.' });
    }

    const induk = DriveApp.getFolderById(FOLDER_ID);
    const anak = cariAtauBuatSubfolder(induk, String(muatan.laporanId));

    const hasil = [];
    let total = 0;
    for (const b of muatan.berkas) {
      if (!b || !b.nama || !b.mime || !b.data) continue;
      const bita = Utilities.base64Decode(b.data);
      total += bita.length;
      if (total > BATAS_BITA_TOTAL) {
        return keluaran({
          ok: false,
          pesan: 'Total ukuran berkas melebihi batas Apps Script (45 MB per unggah).',
        });
      }
      const blob = Utilities.newBlob(bita, b.mime, namaAman(b.nama));
      const berkas = anak.createFile(blob);
      hasil.push({
        jalur: ['lapor-langsung', muatan.laporanId, berkas.getName()].join('/'),
        nama: b.nama,
        mime: b.mime,
        ukuran: bita.length,
        driveId: berkas.getId(),
        driveUrl: berkas.getUrl(),
      });
    }

    return keluaran({
      ok: true,
      folderUrl: anak.getUrl(),
      berkas: hasil,
    });
  } catch (galat) {
    return keluaran({ ok: false, pesan: String(galat && galat.message || galat) });
  }
}

function doGet() {
  return keluaran({
    ok: true,
    pesan: 'Trans-Siber PAS — Lapor Langsung uploader. POST JSON ke alamat ini.',
  });
}

function cariAtauBuatSubfolder(induk, nama) {
  const it = induk.getFoldersByName(nama);
  if (it.hasNext()) return it.next();
  return induk.createFolder(nama);
}

function namaAman(nama) {
  const bersih = String(nama).replace(/[\\/:*?"<>|]+/g, '-').slice(-80);
  const kini = new Date();
  return kini.getTime() + '-' + bersih;
}

function keluaran(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
