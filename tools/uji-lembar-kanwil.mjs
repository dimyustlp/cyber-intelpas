#!/usr/bin/env node
/**
 * Uji pabrik lembar kanwil.
 *
 * Yang dijaga di sini bukan "apakah kodenya jalan" melainkan tiga kelas cacat
 * yang TIDAK meninggalkan galat apa pun bila lolos:
 *
 *   1. Berkas yang dihasilkan tidak sah sebagai JavaScript. Apps Script baru
 *      mengeluhkannya saat ditempel, dan yang menempel adalah petugas daerah
 *      yang tidak punya cara memperbaikinya.
 *
 *   2. Ragam nama memuat nama daerah SENDIRIAN. Penyaring relevansi di lembar
 *      memakai daftar itu sebagai syarat lolos, jadi satu entri "Kediri" akan
 *      meloloskan seluruh berita kota Kediri ke arsip intelijen — termasuk
 *      jadwal pertandingan Persik. Arsipnya tetap terisi, jurnalnya tetap
 *      hijau, dan tidak ada yang tahu sampai ada yang membaca isinya.
 *
 *   3. Nama kanwil menyimpang dari data induk. `daftarkan_lembar_kanwil()` di
 *      basis data menolaknya, tetapi hanya kalau pendaftarannya lewat sana.
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

/* ── 1. templat masih punya penanda suntikan ───────────────────────────── */

console.log('\nTemplat');
periksa('templat ada', existsSync(TEMPLAT));

const templat = existsSync(TEMPLAT) ? readFileSync(TEMPLAT, 'utf8') : '';
periksa('penanda /*__SUNTIK_KONFIG__*/ masih ada',
  templat.includes('/*__SUNTIK_KONFIG__*/'),
  'Tanpa penanda ini pabrik akan menghasilkan berkas tanpa konfigurasi wilayah.');

/**
 * Judul kolom adalah kontrak dengan `sheet-sync`, bukan selera.
 *
 * Yang wajib hanya dua. Menghapus salah satunya membuat penyalin menolak
 * SELURUH lembar — itu memang yang seharusnya terjadi, tetapi kalau namanya
 * yang berubah (bukan hilang), penyalin diam-diam membaca kolom lain.
 */
for (const kolom of ['Judul Berita', 'URL / Link Artikel', 'Nama UPT', 'Kanwil']) {
  periksa(`kolom wajib "${kolom}" ada di templat`, templat.includes(`'${kolom}'`),
    'Nama kolom harus salah satu bentuk yang dikenali ALIAS_BAWAAN di sheet-sync.');
}

/* ── 2. seluruh 38 kanwil menghasilkan berkas yang sah ─────────────────── */

console.log('\nPabrik');

const daftar = execFileSync(process.execPath,
  [join(AKAR, 'tools', 'susun-lembar-kanwil.mjs'), '--daftar'],
  { encoding: 'utf8' });

const jumlahKanwil = Number((daftar.match(/^(\d+) kanwil/m) || [])[1] || 0);
periksa('38 kanwil terbaca dari data induk', jumlahKanwil === 38,
  `Terbaca ${jumlahKanwil}. Kalau data induk memang berubah, perbarui angka di uji ini.`);

execFileSync(process.execPath,
  [join(AKAR, 'tools', 'susun-lembar-kanwil.mjs'), '--semua'],
  { encoding: 'utf8' });

const kanwilCsv = [...new Set(
  readFileSync(CSV, 'utf8').split('\n').slice(1)
    .map((b) => b.split(',')[5])
    .filter((k) => k && k.startsWith('Kantor Wilayah'))
)];

const slug = (s) => s.replace(/^Kantor Wilayah Ditjenpas\s+/i, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

let diperiksa = 0;
const bareCity = [];

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

  // Ragam nama tidak boleh memuat nama daerah sendirian.
  const cocokUnit = isi.match(/var UNIT = (\[[\s\S]*?\n\]);/);
  const cocokKota = isi.match(/var KOTA = (\[[^\]]*\]);/);
  if (cocokUnit && cocokKota) {
    const unit = JSON.parse(cocokUnit[1]);
    const kota = new Set(JSON.parse(cocokKota[1]).map((k) => k.toLowerCase()));

    for (const u of unit) {
      for (const a of u.alias) {
        if (kota.has(String(a).toLowerCase())) bareCity.push(`${kanwil} / ${u.nama}: "${a}"`);
      }
      if (!a_cukupPanjang(u.alias)) {
        periksa(`${u.nama}: ragam nama tidak terlalu pendek`, false,
          'Ragam sependek itu akan mencocokkan kata lain.');
      }
    }
  }
}

function a_cukupPanjang(alias) {
  return alias.every((a) => String(a).length > 5);
}

periksa('seluruh kanwil menghasilkan berkas', diperiksa === kanwilCsv.length,
  `${diperiksa} dari ${kanwilCsv.length}`);

periksa('tidak ada ragam nama berupa nama daerah sendirian', bareCity.length === 0,
  bareCity.slice(0, 5).join('\n         '));

/* ── 3. berkas Jawa Timur memenuhi studi kasus Buku Panduan ────────────── */

console.log('\nStudi kasus Jawa Timur');

const jatim = join(AKAR, 'gas', 'kanwil-jawa-timur.gs');
if (existsSync(jatim)) {
  const isi = readFileSync(jatim, 'utf8');
  const unit = JSON.parse((isi.match(/var UNIT = (\[[\s\S]*?\n\]);/) || [])[1] || '[]');
  const kediri = unit.find((u) => u.nama === 'Lapas Kelas IIA Kediri');

  periksa('Lapas Kelas IIA Kediri ada', !!kediri);

  if (kediri) {
    // Bab III Buku Panduan: wartawan lokal menulis "Penjara Kediri", mesin
    // pusat mencari "Lapas Kelas IIA Kediri". Ragam nama inilah jembatannya.
    for (const bentuk of ['Lapas Kediri', 'Penjara Kediri']) {
      periksa(`ragam nama memuat "${bentuk}"`, kediri.alias.includes(bentuk),
        'Tanpa bentuk ini, kaki per-unit melewatkan sebagian besar berita Lapas Kediri.');
    }
  }

  periksa('ikatan wilayah memuat singkatan "Jatim"',
    isi.includes('Jatim'),
    'Tanpa singkatan, kueri isu melewatkan judul yang menulis "Jatim".');

  periksa('portal hiperlokal Tier 4 ikut disemai',
    isi.includes('blokbojonegoro.com') || isi.includes('kabarpas.com'),
    'Kaki portal adalah satu-satunya yang menembus Tier 4.');

  periksa('portal Tier 1 TIDAK disemai sebagai umpan',
    !/"alamat":\s*"https:\/\/detik\.com"/.test(isi),
    'Umpan portal nasional besar sekali dan hanya memboroskan kuota.');
} else {
  periksa('berkas Jawa Timur ada', false);
}

/* ── ringkas ───────────────────────────────────────────────────────────── */

console.log(`\n${lulus} lulus, ${gagal} gagal\n`);
process.exit(gagal ? 1 : 0);
