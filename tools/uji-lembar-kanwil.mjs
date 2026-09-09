#!/usr/bin/env node
/**
 * Uji pabrik lembar kanwil.
 *
 * Yang dijaga di sini bukan "apakah kodenya jalan" melainkan empat kelas cacat
 * yang TIDAK meninggalkan galat apa pun bila lolos:
 *
 *   1. Berkas yang dihasilkan tidak sah sebagai JavaScript. Apps Script baru
 *      mengeluhkannya saat ditempel, dan yang menempel adalah petugas daerah
 *      yang tidak punya cara memperbaikinya.
 *
 *   2. Ragam nama memuat nama daerah SENDIRIAN. Pusat mencari dengan daftar
 *      ini, jadi satu entri "Kediri" akan menarik seluruh berita kota Kediri —
 *      termasuk jadwal pertandingan Persik — ke arsip intelijen. Arsipnya
 *      tetap terisi, jurnalnya tetap hijau, dan tidak ada yang tahu sampai ada
 *      yang membaca isinya.
 *
 *   3. Nama kanwil menyimpang dari data induk. `daftarkan_lembar_kanwil()` di
 *      basis data menolaknya, tetapi hanya kalau pendaftarannya lewat sana.
 *
 *   4. **Kaki Google kembali diam-diam.** Diukur 8 September 2026: penguraian
 *      alamat Google News berhasil 100% dari basis data dan 0% dari Apps
 *      Script. Kaki yang bertanya kepada Google karena itu dicabut di v2.0.
 *      Menghidupkannya lagi menghasilkan jurnal hijau dengan "Baris Baru" nol —
 *      kegagalan yang terlihat persis seperti "memang tidak ada beritanya".
 *
 * Jalankan: node tools/uji-lembar-kanwil.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV = join(AKAR, 'data', 'master-upt.csv');
const TEMPLAT = join(AKAR, 'gas', 'lembar-kanwil.template.gs');

let lulus = 0;
let gagal = 0;

function periksa(nama, syarat, keterangan) {
  if (syarat) { lulus++; return; }
  gagal++;
  console.log(`  GAGAL  ${nama}`);
  if (keterangan) console.log(`         ${keterangan}`);
}

/* ── 1. templat ────────────────────────────────────────────────────────── */

console.log('\nTemplat');
periksa('templat ada', existsSync(TEMPLAT));

const templat = existsSync(TEMPLAT) ? readFileSync(TEMPLAT, 'utf8') : '';
periksa('penanda /*__SUNTIK_KONFIG__*/ masih ada',
  templat.includes('/*__SUNTIK_KONFIG__*/'),
  'Tanpa penanda ini pabrik menghasilkan berkas tanpa konfigurasi wilayah.');

/**
 * Judul kolom adalah kontrak dengan `sheet-sync`, bukan selera.
 *
 * Yang wajib hanya dua. Menghapus salah satunya membuat penyalin menolak
 * SELURUH lembar — itu memang yang seharusnya terjadi. Tetapi kalau NAMANYA
 * yang berubah (bukan hilang), penyalin diam-diam membaca kolom lain.
 */
for (const kolom of ['Judul Berita', 'URL / Link Artikel', 'Nama UPT', 'Kanwil']) {
  periksa(`kolom wajib "${kolom}" ada di templat`, templat.includes(`'${kolom}'`),
    'Nama kolom harus bentuk yang dikenali ALIAS_BAWAAN di sheet-sync.');
}

/* ── 2. kaki Google tidak boleh kembali ────────────────────────────────── */

console.log('\nKaki Google sudah dicabut');

/*
 * Yang dilarang KODENYA, bukan penjelasannya.
 *
 * Kepala berkas menerangkan panjang lebar kenapa `batchexecute` dicabut — dan
 * penjelasan itu justru harus tetap ada, supaya orang berikutnya tidak
 * menghidupkannya lagi karena mengira tidak ada yang pernah mencoba. Karena itu
 * yang dicari di sini penanda yang hanya muncul bila kodenya sungguh dipakai.
 */
for (const jejak of ['jaringUnit', 'jaringKota', 'jaringIsu', 'cariGoogleNews',
                     'DotsSplashUi', 'data-n-a-sg', 'garturlreq',
                     'news.google.com/rss/search']) {
  periksa(`templat tidak memuat kode "${jejak}"`, !templat.includes(jejak),
    'Dari Apps Script, penguraian alamat Google News berhasil 0 dari 115. '
    + 'Pencarian per unit dikerjakan pusat lewat mode `ragam`.');
}

periksa('kaki portal masih ada', templat.includes('function jaringPortal'),
  'Ia satu-satunya kaki yang pernah berhasil dari sini, dan satu-satunya jalan '
  + 'ke portal hiperlokal yang tidak terindeks Google.');

/* ── 3. seluruh 38 kanwil menghasilkan berkas yang sah ─────────────────── */

console.log('\nPabrik');

const daftar = execFileSync(process.execPath,
  [join(AKAR, 'tools', 'susun-lembar-kanwil.mjs'), '--daftar'], { encoding: 'utf8' });

const jumlahKanwil = Number((daftar.match(/^(\d+) kanwil/m) || [])[1] || 0);
periksa('38 kanwil terbaca dari data induk', jumlahKanwil === 38,
  `Terbaca ${jumlahKanwil}. Kalau data induk memang berubah, perbarui angka di uji ini.`);

execFileSync(process.execPath,
  [join(AKAR, 'tools', 'susun-lembar-kanwil.mjs'), '--semua'], { encoding: 'utf8' });

const kanwilCsv = [...new Set(
  readFileSync(CSV, 'utf8').split('\n').slice(1)
    .map((b) => b.split(',')[5])
    .filter((k) => k && k.startsWith('Kantor Wilayah'))
)];

const slug = (s) => s.replace(/^Kantor Wilayah Ditjenpas\s+/i, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let diperiksa = 0;
const namaDaerahSendirian = [];
const ragamTerlaluPendek = [];

for (const kanwil of kanwilCsv) {
  const berkas = join(AKAR, 'gas', `kanwil-${slug(kanwil)}.gs`);
  if (!existsSync(berkas)) { periksa(`berkas ${slug(kanwil)} dibuat`, false); continue; }

  const isi = readFileSync(berkas, 'utf8');
  diperiksa++;

  // Sah sebagai JavaScript? `new Function` memaksa mesin JS menguraikannya
  // sepenuhnya tanpa menjalankan apa pun di dalamnya.
  try {
    new Function(isi);
  } catch (e) {
    periksa(`${slug(kanwil)}: sah sebagai JavaScript`, false, String(e.message).slice(0, 120));
    continue;
  }

  periksa(`${slug(kanwil)}: nama kanwil persis data induk`,
    isi.includes(`var KANWIL = ${JSON.stringify(kanwil)};`),
    'Nama yang menyimpang membuat seluruh berita lembar itu tidak terpetakan.');

  const cocokUnit = isi.match(/var UNIT = (\[[\s\S]*?\n\]);/);
  if (!cocokUnit) continue;

  const unit = JSON.parse(cocokUnit[1]);

  // Nama daerah diturunkan dari unitnya sendiri, bukan dari daftar terpisah.
  const daerah = new Set(unit.map((u) =>
    String(u.kota || '').replace(/^(Kota Administrasi|Kota|Kabupaten|Kab\.?)\s+/i, '')
      .trim().toLowerCase()).filter(Boolean));

  for (const u of unit) {
    for (const a of u.alias) {
      const n = String(a).trim().toLowerCase();
      if (daerah.has(n)) namaDaerahSendirian.push(`${kanwil} / ${u.nama}: "${a}"`);
      if (String(a).length <= 5) ragamTerlaluPendek.push(`${u.nama}: "${a}"`);
    }
  }
}

periksa('seluruh kanwil menghasilkan berkas', diperiksa === kanwilCsv.length,
  `${diperiksa} dari ${kanwilCsv.length}`);

periksa('tidak ada ragam nama berupa nama daerah sendirian',
  namaDaerahSendirian.length === 0, namaDaerahSendirian.slice(0, 5).join('\n         '));

periksa('tidak ada ragam nama yang terlalu pendek',
  ragamTerlaluPendek.length === 0, ragamTerlaluPendek.slice(0, 5).join('\n         '));

/* ── 4. studi kasus Jawa Timur ─────────────────────────────────────────── */

console.log('\nStudi kasus Jawa Timur');

const jatim = join(AKAR, 'gas', 'kanwil-jawa-timur.gs');
if (existsSync(jatim)) {
  const isi = readFileSync(jatim, 'utf8');
  const unit = JSON.parse((isi.match(/var UNIT = (\[[\s\S]*?\n\]);/) || [])[1] || '[]');
  const kediri = unit.find((u) => u.nama === 'Lapas Kelas IIA Kediri');

  periksa('Lapas Kelas IIA Kediri ada', !!kediri);

  if (kediri) {
    // Bab III Buku Panduan: wartawan lokal menulis "Penjara Kediri", mesin
    // pusat mencari "Lapas Kelas IIA Kediri". Ragam nama inilah jembatannya,
    // dan kini ia yang dipakai pusat lewat mode `ragam`.
    for (const bentuk of ['Lapas Kediri', 'Penjara Kediri']) {
      periksa(`ragam nama memuat "${bentuk}"`, kediri.alias.includes(bentuk),
        'Tanpa bentuk ini, pencarian per unit melewatkan sebagian besar beritanya.');
    }
  }

  periksa('portal hiperlokal ikut disemai',
    isi.includes('blokbojonegoro.com') || isi.includes('kabarpas.com'),
    'Kaki portal adalah satu-satunya jalan ke portal yang tidak terindeks Google.');

  periksa('portal Tier 1 TIDAK disemai sebagai umpan',
    !/"alamat":\s*"https:\/\/detik\.com"/.test(isi),
    'Umpan portal nasional besar sekali dan hanya memboroskan kuota.');

  // v2.1: jangkar wilayah. Fungsi diWilayah/wilayahJangkar/berbatasKata murni —
  // bisa dijalankan tanpa satu pun layanan Apps Script.
  let diWilayah = null;
  try {
    diWilayah = new Function(`${isi}\nreturn diWilayah;`)();
  } catch (e) {
    periksa('diWilayah bisa dijalankan', false, String(e.message).slice(0, 120));
  }

  if (typeof diWilayah === 'function') {
    periksa('berita unit Jawa Timur diterima jangkar wilayah',
      diWilayah('Petugas Rutan Kelas I Surabaya Gagalkan Penyelundupan Sabu Lewat Makanan'),
      'Nama unit wilayah sendiri harus lolos.');

    periksa('nama provinsi saja sudah cukup',
      diWilayah('Kakanwil Ditjenpas Jawa Timur Tinjau Kesiapan Pengamanan'),
      'Provinsi termasuk jangkar wilayah.');

    // Baris sungguhan dari lembar Jawa Timur 9 September 2026 — semuanya unit
    // Kalimantan yang lolos jangkar kata Pemasyarakatan.
    for (const luar of [
      'Lapas Kotabaru Dorong Penerapan Pola Hidup Sehat Bagi Seluruh Warga Binaan',
      'Kalapas Bontang Terima Kunjungan Kepala BNNK Bontang untuk Perkuat Sinergi',
      'Pegawai Lapas Narkotika Karang Intan Olahraga Tenis Bersama untuk Jaga Kebugaran',
      'Sumpah Jabatan PNS, Enam Pegawai Lapas Amuntai Resmi Masuki Babak Baru',
    ]) {
      periksa(`berita luar wilayah ditolak: "${luar.slice(0, 45)}…"`,
        diWilayah(luar) === false,
        'Berita Pemasyarakatan provinsi lain tidak boleh masuk lembar ini.');
    }
  }
} else {
  periksa('berkas Jawa Timur ada', false);
}

/* ── ringkas ───────────────────────────────────────────────────────────── */

console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal ? 1 : 0);
