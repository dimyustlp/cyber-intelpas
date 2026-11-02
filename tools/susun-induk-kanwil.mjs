#!/usr/bin/env node
/**
 * Pabrik lembar induk kanwil v3.
 *
 * Menyuntik data SELURUH 33 kanwil ke `gas/lembar-kanwil-v3.template.gs` dan
 * menuliskan satu berkas: `gas/induk-lembar-kanwil.gs`. Berkas itu ditempel
 * sekali ke lembar induk; lembar induklah yang menyalin dirinya menjadi 32
 * lembar kanwil, sehingga setiap lembar memegang kode yang sama persis.
 *
 * KENAPA SATU BERKAS, BUKAN 33 SEPERTI v2.1
 *
 * v2.1 menulis satu berkas per kanwil dan meminta tiap berkas ditempel dengan
 * tangan. Perbaikan pada templat baru sampai ke lembar setelah 33 kali
 * menempel ulang — dan yang terlewat tidak pernah ketahuan. Di v3 perbedaan
 * antar-kanwil hanya ada di lembar `_Konfigurasi`, dan kodenya satu.
 *
 * CARA PAKAI
 *
 *   node tools/susun-induk-kanwil.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { muatUpt, ragamNama } from './susun-lembar-kanwil.mjs';

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..');

const JALUR = {
  kanwil: join(AKAR, 'data', 'kanwil-33.json'),
  portal: join(AKAR, 'data', 'portal-wilayah.json'),
  tier: join(AKAR, 'data', 'media-tier-bawaan.json'),
  templat: join(AKAR, 'gas', 'lembar-kanwil-v3.template.gs'),
  keluar: join(AKAR, 'gas', 'induk-lembar-kanwil.gs'),
};

/**
 * Lembar yang sudah hidup dan TIDAK dibuat ulang oleh induk.
 *
 * Jawa Timur menjaring dengan skrip v2.1 dan pemicunya sendiri sejak
 * 8 September 2026. Membuatkannya lembar kedua berarti dua sumber yang
 * menyetor berita yang sama dari portal yang sama.
 */
const LEMBAR_SUDAH_ADA = {
  'Kantor Wilayah Ditjenpas Jawa Timur': '1M0I31p5zpat9qI3NgG15-65Hi96GVv6_38-t0M0FZVI',
};

/**
 * Kanwil yang dulu berdiri sendiri di data induk (diturunkan dari 38
 * provinsi) dan kini diampu kanwil induknya. Portal benih yang tercatat atas
 * nama lama ikut pindah, supaya tidak ada portal yang hilang diam-diam.
 */
const DIGABUNG = {
  'Kantor Wilayah Ditjenpas Kalimantan Utara': 'Kantor Wilayah Ditjenpas Kalimantan Timur',
  'Kantor Wilayah Ditjenpas Papua Pegunungan': 'Kantor Wilayah Ditjenpas Papua',
  'Kantor Wilayah Ditjenpas Papua Selatan': 'Kantor Wilayah Ditjenpas Papua',
  'Kantor Wilayah Ditjenpas Papua Tengah': 'Kantor Wilayah Ditjenpas Papua',
  'Kantor Wilayah Ditjenpas Papua Barat Daya': 'Kantor Wilayah Ditjenpas Papua Barat',
};

export function susunData() {
  const daftar = JSON.parse(readFileSync(JALUR.kanwil, 'utf8')).kanwil;
  const portalMentah = JSON.parse(readFileSync(JALUR.portal, 'utf8'));
  const tier = JSON.parse(readFileSync(JALUR.tier, 'utf8'));
  const upt = muatUpt();

  const portal = {};
  for (const [k, isi] of Object.entries(portalMentah)) {
    if (!k.startsWith('Kantor Wilayah') || !Array.isArray(isi)) continue;
    const tujuan = DIGABUNG[k] || k;
    (portal[tujuan] ||= []).push(...isi);
  }

  const terdaftar = new Set(daftar.map((k) => k.nama));
  const yatim = [...new Set(upt.map((u) => u.kanwil))].filter((k) => !terdaftar.has(k));
  if (yatim.length) {
    throw new Error(`Kanwil di master-upt.csv yang tidak ada di kanwil-33.json: ${yatim.join(', ')}`);
  }

  const data = daftar
    .sort((a, b) => a.urutan - b.urutan)
    .map((k) => ({
      nama: k.nama,
      wilayah: k.wilayah,
      tipe: k.tipe,
      provinsi: k.provinsi,
      unit: upt.filter((u) => u.kanwil === k.nama)
        .map((u) => ({ nama: u.nama, jenis: u.jenis, kota: u.kota, alias: ragamNama(u) })),
      // Portal Tier 1 dibuang: pencarian pusat sudah menjangkaunya, dan umpan
      // portal nasional memboroskan waktu yang seharusnya untuk portal kabupaten.
      portal: (portal[k.nama] || []).filter((p) => Number(p.tier) > 1),
    }));

  const kosong = data.filter((d) => !d.unit.length).map((d) => d.wilayah);
  if (kosong.length) throw new Error(`Kanwil tanpa unit aktif: ${kosong.join(', ')}`);

  return { data, tier };
}

/**
 * Kata lanjutan yang terlarang untuk setiap sebutan, dihitung atas SELURUH
 * Indonesia: "tanjung" -> pandan, redeb, pura, balai, ...
 *
 * Harus nasional, bukan per kanwil. Lembar Kalimantan Selatan tidak memuat
 * nama Tanjung Pandan sama sekali — justru karena itu ia tidak bisa tahu
 * bahwa "Lapas Tanjung Pandan" bukan unitnya. Lihat polaKata() di templat.
 */
export function susunLanjutan(data) {
  const polos = (s) => String(s || '').toLowerCase()
    .replace(/^(kota administrasi|kota|kabupaten|kab\.?)\s+/i, '').trim();
  const istilah = new Set();
  for (const d of data) {
    d.provinsi.forEach((p) => istilah.add(polos(p)));
    for (const u of d.unit) {
      istilah.add(polos(u.kota));
      u.alias.forEach((a) => istilah.add(a.toLowerCase()));
    }
  }

  // Di posisi mana pun, bukan hanya awalan: "tanjung balai" (Sumatera Utara)
  // ada di TENGAH "rutan kelas iib tanjung balai karimun" (Kepulauan Riau).
  const daftar = [...istilah].filter((s) => s.length >= 4);
  const peta = {};
  for (const x of daftar) {
    for (const y of daftar) {
      if (y.length <= x.length + 1) continue;
      let i = y.indexOf(x);
      while (i !== -1) {
        const sebelum = i === 0 || y[i - 1] === ' ';
        if (sebelum && y[i + x.length] === ' ') {
          (peta[x] ||= new Set()).add(y.slice(i + x.length + 1).split(' ')[0]);
        }
        i = y.indexOf(x, i + 1);
      }
    }
  }
  return Object.fromEntries(Object.entries(peta).map(([k, v]) => [k, [...v].sort()]));
}

export function susunBerkas() {
  const { data, tier } = susunData();
  const lanjutan = susunLanjutan(data);
  const templat = readFileSync(JALUR.templat, 'utf8');

  const konfig = [
    `/** ${data.length} kanwil, urut Tipe A lalu Tipe B. Nama PERSIS seperti data induk`,
    ' *  `upt.kanwil` di pusat — nama yang menyimpang membuat seluruh berita lembar',
    ' *  itu tidak terpetakan, tanpa galat. */',
    `var DATA_KANWIL = ${JSON.stringify(data)};`,
    '',
    '/** Salinan daftar induk `media_tier`. Untuk perkiraan di layar saja. */',
    `var TIER_BAWAAN = ${JSON.stringify(tier)};`,
    '',
    '/** Lembar yang sudah hidup sebelum induk ada. Tidak disalin ulang. */',
    `var LEMBAR_SUDAH_ADA = ${JSON.stringify(LEMBAR_SUDAH_ADA, null, 1)};`,
    '',
    `/** ${Object.keys(lanjutan).length} sebutan yang menjadi awalan nama tempat lain. Lihat polaKata(). */`,
    `var LANJUTAN_TERLARANG = ${JSON.stringify(lanjutan)};`,
  ].join('\n');

  const isi = templat.replace('/*__SUNTIK_DATA__*/', konfig);
  if (isi === templat) throw new Error('Penanda /*__SUNTIK_DATA__*/ tidak ditemukan di templat.');
  return { isi, data };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { isi, data } = susunBerkas();
  writeFileSync(JALUR.keluar, isi, 'utf8');

  const dibuat = data.filter((d) => !LEMBAR_SUDAH_ADA[d.nama]);
  console.log(`${data.length} kanwil · ${dibuat.length} lembar akan dibuat induk`
    + ` · ${data.reduce((n, d) => n + d.unit.length, 0)} unit`
    + ` · ${data.reduce((n, d) => n + d.portal.length, 0)} portal benih`);
  console.log(`Tanpa portal benih: ${data.filter((d) => !d.portal.length).map((d) => d.wilayah).join(', ') || '-'}`);
  console.log(`-> gas/induk-lembar-kanwil.gs (${Math.round(isi.length / 1024)} KB)`);
}
