#!/usr/bin/env node
/**
 * Pabrik lembar kanwil.
 *
 * Menyuntik konfigurasi wilayah ke `gas/lembar-kanwil.template.gs`, lalu
 * menuliskan satu berkas Apps Script siap tempel per kanwil.
 *
 * KENAPA DIBUAT, DAN BUKAN DISALIN TANGAN
 *
 * Tiga puluh delapan kanwil berarti tiga puluh delapan berkas yang harus sama
 * persis kecuali daftar unitnya. Menyalinnya dengan tangan berarti perbaikan
 * pada satu berkas tidak pernah sampai ke tiga puluh tujuh lainnya, dan yang
 * tertinggal tidak akan ketahuan sampai ada yang mengeluh berita wilayahnya
 * tidak masuk. Di sini yang disunting hanya templatnya; sisanya diturunkan.
 *
 * CARA PAKAI
 *
 *   node tools/susun-lembar-kanwil.mjs --kanwil "Jawa Timur"
 *   node tools/susun-lembar-kanwil.mjs --semua
 *   node tools/susun-lembar-kanwil.mjs --daftar
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..');

const JALUR = {
  upt: join(AKAR, 'data', 'master-upt.csv'),
  portal: join(AKAR, 'data', 'portal-wilayah.json'),
  tier: join(AKAR, 'data', 'media-tier-bawaan.json'),
  templat: join(AKAR, 'gas', 'lembar-kanwil.template.gs'),
  keluar: join(AKAR, 'gas'),
};

/* ─────────────────────────────────────────────────────────── pembaca CSV ── */

/**
 * Pembaca CSV yang menghormati tanda kutip.
 *
 * `split(',')` tidak cukup: kolom `catatan_verifikasi` memuat koma di dalam
 * kutip, dan memecahnya di situ menggeser SELURUH kolom sesudahnya. Pergeseran
 * itu tidak menimbulkan galat — ia hanya membuat kanwil terbaca dari kolom
 * koordinat, dan hasilnya lembar yang kosong tanpa sebab yang terlihat.
 */
function bacaCsv(teks) {
  const baris = [];
  let sel = '';
  let baris1 = [];
  let dalamKutip = false;

  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];

    if (dalamKutip) {
      if (c === '"') {
        if (teks[i + 1] === '"') { sel += '"'; i++; }
        else dalamKutip = false;
      } else sel += c;
      continue;
    }

    if (c === '"') dalamKutip = true;
    else if (c === ',') { baris1.push(sel); sel = ''; }
    else if (c === '\n') { baris1.push(sel); baris.push(baris1); baris1 = []; sel = ''; }
    else if (c !== '\r') sel += c;
  }

  if (sel !== '' || baris1.length) { baris1.push(sel); baris.push(baris1); }
  return baris;
}

function muatUpt() {
  const baris = bacaCsv(readFileSync(JALUR.upt, 'utf8'));
  const judul = baris[0].map((h) => h.trim());
  const idx = (n) => {
    const i = judul.indexOf(n);
    if (i < 0) throw new Error(`Kolom "${n}" tidak ada di master-upt.csv`);
    return i;
  };

  const k = {
    nama: idx('nama_upt'), jenis: idx('jenis_upt'), provinsi: idx('provinsi'),
    kanwil: idx('kanwil'), kota: idx('kabupaten_kota'), aktif: idx('aktif'),
  };

  return baris.slice(1)
    .filter((r) => r.length > k.aktif && r[k.nama].trim())
    .map((r) => ({
      nama: r[k.nama].trim(),
      jenis: r[k.jenis].trim(),
      provinsi: r[k.provinsi].trim(),
      kanwil: r[k.kanwil].trim(),
      kota: r[k.kota].trim(),
      aktif: /^true$/i.test(r[k.aktif].trim()),
    }))
    .filter((u) => u.aktif && u.kanwil);
}

/* ──────────────────────────────────────────────────────────── ragam nama ── */

const rapi = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * Menyusun sebutan yang mungkin dipakai wartawan.
 *
 * "Lapas Kelas IIB Tobelo" hampir tidak pernah ditulis lengkap; yang ditulis
 * "Lapas Tobelo", atau "penjara Tobelo". Mencari bentuk resminya saja
 * melewatkan sebagian besar beritanya — dan itulah sebab 343 unit tidak pernah
 * sekali pun muncul di arsip.
 *
 * Nama daerah SENDIRIAN tidak pernah dimasukkan. "Kediri" akan mencocokkan
 * seluruh berita kota itu, dan penyaring relevansi di lembar memakai daftar ini
 * sebagai syarat lolos.
 */
function ragamNama(u) {
  const set = new Set();
  const nama = rapi(u.nama);
  set.add(nama);

  const tanpaKelas = rapi(nama.replace(/\bKelas\s+[IVX]+\s*[ABC]?\b/gi, ''));
  if (tanpaKelas.length > 6) set.add(tanpaKelas);

  const kota = rapi(String(u.kota).replace(/^(Kota Administrasi|Kota|Kabupaten|Kab\.?)\s+/i, ''));
  const j = u.jenis.toLowerCase();

  if (kota) {
    set.add(rapi(`${u.jenis} ${kota}`));
    if (j === 'lapas') { set.add(`Penjara ${kota}`); set.add(`LP ${kota}`); }
    if (j === 'rutan') set.add(`Rumah Tahanan ${kota}`);
    if (j === 'bapas') set.add(`Balai Pemasyarakatan ${kota}`);
    if (j === 'lpka') set.add(`Lapas Anak ${kota}`);
    if (j === 'lpp') set.add(`Lapas Perempuan ${kota}`);
    if (j === 'rupbasan') set.add(`Rupbasan ${kota}`);
  }

  return [...set].filter((s) => s && s.length > 5);
}

/* ─────────────────────────────────────────────────────────── ikatan kata ── */

/** Singkatan provinsi yang lazim dipakai judul berita. */
const SINGKATAN = {
  'Jawa Timur': 'Jatim', 'Jawa Tengah': 'Jateng', 'Jawa Barat': 'Jabar',
  'Sumatera Utara': 'Sumut', 'Sumatera Barat': 'Sumbar', 'Sumatera Selatan': 'Sumsel',
  'Kalimantan Timur': 'Kaltim', 'Kalimantan Barat': 'Kalbar',
  'Kalimantan Selatan': 'Kalsel', 'Kalimantan Tengah': 'Kalteng',
  'Kalimantan Utara': 'Kaltara', 'Sulawesi Selatan': 'Sulsel',
  'Sulawesi Utara': 'Sulut', 'Sulawesi Tengah': 'Sulteng',
  'Sulawesi Tenggara': 'Sultra', 'Sulawesi Barat': 'Sulbar',
  'Nusa Tenggara Barat': 'NTB', 'Nusa Tenggara Timur': 'NTT',
  'D.I. Yogyakarta': 'Yogyakarta', 'DKI Jakarta': 'Jakarta',
  'Kepulauan Riau': 'Kepri', 'Kepulauan Bangka Belitung': 'Babel',
  'Maluku Utara': 'Malut', 'Papua Barat': 'Papua Barat',
};

function ikatanWilayah(provinsi) {
  const bagian = [provinsi];
  if (SINGKATAN[provinsi] && SINGKATAN[provinsi] !== provinsi) bagian.push(SINGKATAN[provinsi]);
  return `(${bagian.map((b) => `"${b}"`).join(' OR ')})`;
}

/* ────────────────────────────────────────────────────────────── penyusun ── */

const slug = (s) => s.replace(/^Kantor Wilayah Ditjenpas\s+/i, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function susun(kanwil, semuaUpt, portal, tier, templat) {
  const unit = semuaUpt.filter((u) => u.kanwil === kanwil);
  if (!unit.length) throw new Error(`Tidak ada unit aktif untuk "${kanwil}"`);

  const provinsi = unit[0].provinsi;

  const daftarUnit = unit.map((u) => ({
    nama: u.nama, jenis: u.jenis, kota: u.kota, alias: ragamNama(u),
  }));

  const kota = [...new Set(unit.map((u) =>
    rapi(String(u.kota).replace(/^(Kota Administrasi|Kota|Kabupaten|Kab\.?)\s+/i, ''))
  ))].filter(Boolean).sort();

  // Portal Tier 1 dibuang: tiga kaki lain yang bertanya kepada Google sudah
  // menjangkaunya, dan umpan portal nasional besar sekali sehingga hanya
  // memboroskan kuota yang seharusnya dipakai portal kabupaten.
  const daftarPortal = (portal[kanwil] || []).filter((p) => Number(p.tier) > 1);

  const konfig = [
    '/** Nama kanwil, PERSIS seperti pada data induk `upt.kanwil` di pusat.',
    ' *  Nilai ini ditulis ke kolom Kanwil tiap baris dan dipakai penyalin untuk',
    ' *  memastikan berita jatuh ke wilayah yang benar. Mengubahnya sedikit saja',
    ' *  membuat seluruh baris lembar ini tidak terpetakan. */',
    `var KANWIL = ${JSON.stringify(kanwil)};`,
    '',
    `var PROVINSI = ${JSON.stringify(provinsi)};`,
    '',
    '/** Pengikat kueri isu supaya tidak menyapu seluruh Indonesia. */',
    `var IKATAN_WILAYAH = ${JSON.stringify(ikatanWilayah(provinsi))};`,
    '',
    `/** ${daftarUnit.length} unit aktif. Ragam nama boleh disunting di lembar Target Unit. */`,
    `var UNIT = ${JSON.stringify(daftarUnit, null, 1)};`,
    '',
    `/** ${kota.length} kabupaten/kota. Dipakai kaki kedua, selalu diikat kata Pemasyarakatan. */`,
    `var KOTA = ${JSON.stringify(kota)};`,
    '',
    `/** ${daftarPortal.length} portal benih. Petugas daerah menambah sendiri di lembar Portal Wilayah. */`,
    `var PORTAL = ${JSON.stringify(daftarPortal, null, 1)};`,
    '',
    '/** Salinan daftar induk `media_tier`. Untuk perkiraan di layar saja. */',
    `var TIER_BAWAAN = ${JSON.stringify(tier)};`,
  ].join('\n');

  const isi = templat.replace('/*__SUNTIK_KONFIG__*/', konfig);
  if (isi === templat) throw new Error('Penanda /*__SUNTIK_KONFIG__*/ tidak ditemukan di templat.');

  return {
    isi,
    berkas: join(JALUR.keluar, `kanwil-${slug(kanwil)}.gs`),
    ringkas: { kanwil, provinsi, unit: daftarUnit.length, kota: kota.length, portal: daftarPortal.length },
  };
}

/* ───────────────────────────────────────────────────────────────── utama ── */

const arg = process.argv.slice(2);
const ambil = (n) => { const i = arg.indexOf(n); return i >= 0 ? arg[i + 1] : null; };

const semuaUpt = muatUpt();
const daftarKanwil = [...new Set(semuaUpt.map((u) => u.kanwil))].sort();

if (arg.includes('--daftar') || !arg.length) {
  console.log(`${daftarKanwil.length} kanwil, ${semuaUpt.length} unit aktif:\n`);
  for (const k of daftarKanwil) {
    console.log(`  ${String(semuaUpt.filter((u) => u.kanwil === k).length).padStart(3)}  ${k}`);
  }
  console.log('\nPakai: node tools/susun-lembar-kanwil.mjs --kanwil "Jawa Timur"');
  console.log('       node tools/susun-lembar-kanwil.mjs --semua');
  process.exit(0);
}

for (const j of [JALUR.portal, JALUR.tier, JALUR.templat]) {
  if (!existsSync(j)) { console.error(`Berkas tidak ada: ${j}`); process.exit(1); }
}

const portal = JSON.parse(readFileSync(JALUR.portal, 'utf8'));
const tier = JSON.parse(readFileSync(JALUR.tier, 'utf8'));
const templat = readFileSync(JALUR.templat, 'utf8');

let sasaran;
if (arg.includes('--semua')) {
  sasaran = daftarKanwil;
} else {
  const diminta = ambil('--kanwil');
  if (!diminta) { console.error('Sebutkan --kanwil "<nama>" atau --semua'); process.exit(1); }

  sasaran = daftarKanwil.filter((k) =>
    k === diminta || k.toLowerCase().includes(String(diminta).toLowerCase()));

  if (!sasaran.length) {
    console.error(`Kanwil "${diminta}" tidak ditemukan. Jalankan --daftar untuk melihat pilihannya.`);
    process.exit(1);
  }
  if (sasaran.length > 1) {
    console.error(`"${diminta}" cocok pada lebih dari satu kanwil:\n  ${sasaran.join('\n  ')}`);
    process.exit(1);
  }
}

mkdirSync(JALUR.keluar, { recursive: true });

for (const k of sasaran) {
  const h = susun(k, semuaUpt, portal, tier, templat);
  writeFileSync(h.berkas, h.isi, 'utf8');
  const r = h.ringkas;
  console.log(`${r.kanwil}\n  ${r.unit} unit · ${r.kota} kab/kota · ${r.portal} portal benih`);
  console.log(`  -> ${h.berkas.replace(AKAR + '\\', '').replace(AKAR + '/', '')}\n`);
}

console.log(`Selesai: ${sasaran.length} berkas.`);
