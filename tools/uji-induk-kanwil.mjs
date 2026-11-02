#!/usr/bin/env node
/**
 * Uji lembar induk kanwil v3 — menjalankan berkas Apps Script SUNGGUHAN di
 * atas tiruan layanan Google.
 *
 * Kenapa tiruan, bukan sekadar `new Function`: berkas ini ditempel sekali lalu
 * berjalan sendiri membangun 32 lembar. Galat yang baru muncul saat berjalan —
 * jumlah kolom setValues yang tidak cocok, nama fungsi yang salah ketik,
 * variabel global yang bocor dari satu kanwil ke kanwil berikutnya — akan
 * muncul pertama kali di akun user, di tengah pembangunan, dan meninggalkan
 * separuh lembar. Di sini ia muncul lebih dulu.
 *
 * Tiruannya SETIA pada dua hal yang paling sering menipu:
 *   - setValues menolak dimensi yang tidak cocok, persis seperti Apps Script;
 *   - insertCheckboxes mengosongkan nilai menjadi false (lihat jadikanKotakCentang).
 *
 * Jalankan: node tools/uji-induk-kanwil.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { susunBerkas } from './susun-induk-kanwil.mjs';

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..');

let lulus = 0;
let gagal = 0;
function periksa(nama, syarat, ket) {
  if (syarat) { lulus++; return; }
  gagal++;
  console.log(`  GAGAL  ${nama}`);
  if (ket) console.log(`         ${ket}`);
}

/* ─────────────────────────────────────────────── tiruan layanan Google ── */

// Metode format yang tidak mengubah nilai: cukup mengembalikan dirinya.
const rantai = (sasaran) => new Proxy(sasaran, {
  get(t, k) {
    if (k in t) return t[k];
    if (typeof k === 'symbol') return undefined;
    return () => rantai(t);
  },
});

let nomorId = 0;
const semuaBerkas = new Map();

class Lembar {
  constructor(ss, nama) {
    this.ss = ss; this.nama = nama; this.sel = []; this.latar = {}; this.catatan = {};
    this.validasi = {}; this.tersembunyi = false;
  }
  getName() { return this.nama; }
  getMaxRows() { return 1000; }
  getLastRow() {
    for (let r = this.sel.length - 1; r >= 0; r--) {
      if ((this.sel[r] || []).some((v) => v !== '' && v !== null && v !== undefined)) return r + 1;
    }
    return 0;
  }
  getLastColumn() { return Math.max(0, ...this.sel.map((r) => (r || []).length)); }
  getRange(a, b, c, d) {
    if (typeof a === 'string') return rantai(new Rentang(this, 2, 1, 999, 1));
    return rantai(new Rentang(this, a, b, c || 1, d || 1));
  }
  baca(r, c) { return (this.sel[r - 1] || [])[c - 1] ?? ''; }
  tulis(r, c, v) { (this.sel[r - 1] ||= [])[c - 1] = v; }
  appendRow(nilai) { const r = this.getLastRow() + 1; nilai.forEach((v, i) => this.tulis(r, i + 1, v)); }
  clear() { this.sel = []; this.latar = {}; this.catatan = {}; }
  hideSheet() { this.tersembunyi = true; }
  getProtections() { return []; }
  setFrozenRows() {} setFrozenColumns() {} setColumnWidth() {} setTabColor() {}
  setConditionalFormatRules(a) { this.aturan = a; }
}

class Rentang {
  constructor(l, r, c, nr, nc) { Object.assign(this, { l, r, c, nr, nc }); }
  getSheet() { return this.l; }
  getRow() { return this.r; } getColumn() { return this.c; }
  getNumRows() { return this.nr; } getNumColumns() { return this.nc; }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const b = [];
      for (let j = 0; j < this.nc; j++) b.push(this.l.baca(this.r + i, this.c + j));
      out.push(b);
    }
    return out;
  }
  getValue() { return this.l.baca(this.r, this.c); }
  setValues(v) {
    if (v.length !== this.nr || v.some((b) => b.length !== this.nc)) {
      throw new Error(`setValues: data ${v.length}x${v[0]?.length} tidak cocok dengan rentang ${this.nr}x${this.nc}`);
    }
    v.forEach((b, i) => b.forEach((x, j) => this.l.tulis(this.r + i, this.c + j, x)));
    return rantai(this);
  }
  setFormulas(v) { return this.setValues(v); }
  setValue(x) { this.l.tulis(this.r, this.c, x); return rantai(this); }
  clearContent() {
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.l.tulis(this.r + i, this.c + j, '');
    return rantai(this);
  }
  insertCheckboxes() {
    for (let i = 0; i < this.nr; i++) this.l.tulis(this.r + i, this.c, false);
    return rantai(this);
  }
  setDataValidation(v) { this.l.validasi[`${this.r},${this.c}`] = v; return rantai(this); }
  setBackground(w) { this.l.latar[`${this.r},${this.c}`] = w; return rantai(this); }
  setNote(n) { this.l.catatan[`${this.r},${this.c}`] = n; return rantai(this); }
  protect() { return rantai({}); }
}

class Berkas {
  constructor(judul) {
    this.id = `id-${++nomorId}`; this.judul = judul; this.lembar = [];
    this.dibagikan = 'PRIVATE'; this.sampah = false;
    semuaBerkas.set(this.id, this);
  }
  getId() { return this.id; }
  getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}/edit`; }
  getSheetByName(n) { return this.lembar.find((l) => l.nama === n) || null; }
  getSheets() { return this.lembar.slice(); }
  insertSheet(n, i) {
    if (this.getSheetByName(n)) throw new Error(`Lembar "${n}" sudah ada`);
    const l = new Lembar(this, n);
    if (i === undefined) this.lembar.push(l); else this.lembar.splice(i, 0, l);
    return l;
  }
  deleteSheet(l) {
    if (this.lembar.length === 1) throw new Error('Tidak boleh menghapus lembar terakhir');
    this.lembar = this.lembar.filter((x) => x !== l);
  }
  setActiveSheet(l) { this.aktif = l; return l; }
  moveActiveSheet(i) { this.lembar = this.lembar.filter((x) => x !== this.aktif); this.lembar.splice(i - 1, 0, this.aktif); }
  toast() {}
  salin(judul) {
    const b = new Berkas(judul);
    b.lembar = this.lembar.map((l) => {
      const n = new Lembar(b, l.nama);
      n.sel = JSON.parse(JSON.stringify(l.sel)); n.tersembunyi = l.tersembunyi;
      return n;
    });
    return b;
  }
}

function buatLingkungan(umpan, JamTiruan = Date) {
  let aktif = null;
  const pemicu = [];
  const props = {};
  const ambil = [];

  const SpreadsheetApp = {
    getActive: () => aktif,
    openById: (id) => { const b = semuaBerkas.get(id); if (!b) throw new Error(`Tidak ada ${id}`); return b; },
    flush() {},
    getUi: () => rantai({}),
    newDataValidation: () => rantai({ build: () => ({}) }),
    newConditionalFormatRule: () => rantai({ build: () => ({}) }),
    ProtectionType: { RANGE: 'RANGE' },
  };

  const DriveApp = {
    Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
    Permission: { VIEW: 'VIEW' },
    getFileById: (id) => {
      const b = semuaBerkas.get(id);
      return {
        makeCopy: (judul) => ({ getId: () => b.salin(judul).id }),
        setSharing: (a) => { b.dibagikan = a; },
        getSharingAccess: () => b.dibagikan,
        isTrashed: () => b.sampah,
      };
    },
    getFoldersByName: () => ({ hasNext: () => false }),
    createFolder: () => ({}),
  };

  const ScriptApp = {
    getProjectTriggers: () => pemicu.slice(),
    deleteTrigger: (p) => pemicu.splice(pemicu.indexOf(p), 1),
    newTrigger: (fn) => {
      const p = { fn, getHandlerFunction: () => fn };
      const pembangun = rantai({ create: () => { pemicu.push(p); return p; } });
      return pembangun;
    },
  };

  const konteks = vm.createContext({
    SpreadsheetApp, DriveApp, ScriptApp,
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; },
      }),
    },
    UrlFetchApp: {
      fetch: (url) => {
        ambil.push(url);
        const isi = umpan(url);
        return { getResponseCode: () => (isi ? 200 : 404), getContentText: () => isi || '' };
      },
    },
    Utilities: {
      sleep() {},
      formatDate: (d, z, f) => (f === 'yyyy-MM-dd' ? d.toISOString().slice(0, 10)
        : d.toISOString().slice(0, 16).replace('T', ' ')),
    },
    XmlService: { parse: () => { throw new Error('tiruan: pakai jalur cadangan'); } },
    Logger: { log() {} },
    Date: JamTiruan, Math, JSON, Object, String, Number, RegExp, Error, Array,
  });

  return {
    konteks, pemicu, props, ambil,
    aktifkan: (b) => { aktif = b; },
  };
}

/* ───────────────────────────────────────────────────────────── jalankan ── */

const { isi: kode, data } = susunBerkas();
const dataPer = Object.fromEntries(data.map((d) => [d.nama, d]));

// Umpan tiruan: satu butir per unit SELURUH Indonesia, ditambah satu butir
// tak relevan dan satu butir alamat Google News. Setiap kanwil harus memungut
// HANYA butir unitnya sendiri.
const butirUmpan = data.flatMap((d) => d.unit.map((u, i) => ({
  judul: `Kalapas ${u.nama} gelar razia kamar hunian warga binaan`,
  tautan: `https://portal-uji.id/${encodeURIComponent(u.nama)}-${i}`,
  unit: u.nama, kanwil: d.nama,
})));
const rss = `<?xml version="1.0"?><rss><channel>${butirUmpan.map((b) =>
  `<item><title>${b.judul}</title><link>${b.tautan}</link><pubDate>${new Date().toUTCString()}</pubDate></item>`).join('')}
  <item><title>Jadwal pertandingan Persik pekan ini</title><link>https://portal-uji.id/bola</link></item>
  <item><title>Napi Lapas kabur</title><link>https://news.google.com/rss/articles/abc</link></item>
  </channel></rss>`;

const PORTAL_MATI = 'https://www.harianjogja.com/rss';
const lingk = buatLingkungan((url) => (url === PORTAL_MATI ? null : rss));
const jalan = (kodeJs) => vm.runInContext(kodeJs, lingk.konteks);

console.log('\nBerkas');
periksa('sah sebagai JavaScript', (() => { try { new Function(kode); return true; } catch { return false; } })());
vm.runInContext(kode, lingk.konteks, { filename: 'induk-lembar-kanwil.gs' });
periksa('33 kanwil tersuntik', jalan('DATA_KANWIL.length') === 33);
periksa('tidak ada kode Google News', !/batchexecute|DotsSplashUi|news\.google\.com\/rss\/search/.test(kode),
  'Dari Apps Script penguraian Google News gagal 115 dari 115 (v2.0).');
for (const kolom of ['Judul Berita', 'URL / Link Artikel', 'Nama UPT', 'Kanwil']) {
  periksa(`kolom kontrak "${kolom}" ada`, jalan('KOLOM').includes(kolom));
}

console.log('\nLembar induk: pasangSemua');
const induk = new Berkas('Trans-Siber PAS — Lembar Induk Kanwil');
induk.insertSheet('Sheet1');
lingk.aktifkan(induk);

try { jalan('pasangSemua()'); periksa('pasangSemua berjalan tanpa galat', true); }
catch (e) { periksa('pasangSemua berjalan tanpa galat', false, e.stack.split('\n').slice(0, 3).join(' | ')); }

const daftar = induk.getSheetByName('Daftar Lembar');
const barisDaftar = daftar.getRange(2, 1, daftar.getLastRow() - 1, 16).getValues();
periksa('Daftar memuat 33 baris', barisDaftar.length === 33, `ada ${barisDaftar.length}`);

const siap = barisDaftar.filter((r) => r[6] === 'Siap');
periksa('32 lembar berstatus Siap', siap.length === 32,
  `status: ${[...new Set(barisDaftar.map((r) => r[6] + ' / ' + r[14]))].join(' ; ')}`);

const jatim = barisDaftar.find((r) => r[1] === 'Jawa Timur');
periksa('Jawa Timur tidak disalin ulang', jatim && jatim[4] === '1M0I31p5zpat9qI3NgG15-65Hi96GVv6_38-t0M0FZVI' && jatim[13] === false);
periksa('pemicu jaringBergilir terpasang', lingk.pemicu.some((p) => p.fn === 'jaringBergilir'));
periksa('tidak ada pemicu bangun yang tertinggal', !lingk.pemicu.some((p) => p.fn === 'bangunSemuaLembar'));

let semuaBenar = true;
const masalah = [];
for (const r of siap) {
  const b = semuaBerkas.get(r[4]);
  const d = dataPer[r[3]];
  const nama = b.lembar.map((l) => l.nama);
  const k = Object.fromEntries(b.getSheetByName('_Konfigurasi').getRange(1, 1, 9, 2).getValues());
  const unit = b.getSheetByName('Target Unit').getLastRow() - 1;
  const portal = b.getSheetByName('Portal Wilayah').getRange(2, 7, d.portal.length, 1).getValues();
  const judul = b.getSheetByName('Berita').getRange(1, 1, 1, 16).getValues()[0];

  const salah = [];
  if (nama.some((n) => ['Daftar Lembar', 'Jurnal Induk', 'Petunjuk Induk', 'Sheet1'].includes(n))) salah.push('lembar induk tertinggal');
  if (nama[0] !== 'Berita' || nama[1] !== 'Ringkasan') salah.push(`urutan ${nama.slice(0, 2)}`);
  if (k.peran !== 'kanwil' || k.kanwil !== d.nama) salah.push('konfigurasi');
  if (unit !== d.unit.length) salah.push(`unit ${unit}/${d.unit.length}`);
  if (portal.some((p) => p[0] !== true)) salah.push('portal benih tidak aktif');
  if (judul.join('|') !== jalan('KOLOM').join('|')) salah.push('judul kolom');
  if (b.dibagikan !== 'ANYONE_WITH_LINK') salah.push('tidak dibagikan');
  if (!b.getSheetByName('_Konfigurasi').tersembunyi) salah.push('_Konfigurasi tampak');
  if (salah.length) { semuaBenar = false; masalah.push(`${d.wilayah}: ${salah.join(', ')}`); }
}
periksa('setiap lembar kanwil utuh, dibagikan, dan berkonfigurasi benar', semuaBenar, masalah.slice(0, 4).join(' ; '));

console.log('\nMenjalankan ulang tidak merusak');
jalan('siapkanInduk()');
const dikelolaUlang = daftar.getRange(2, 14, 33, 1).getValues().filter((r) => r[0] === true).length;
periksa('centang Dikelola Induk bertahan setelah siapkanInduk diulang', dikelolaUlang === 32, `tercentang ${dikelolaUlang}`);
periksa('Daftar tidak bertambah baris', daftar.getLastRow() - 1 === 33);
const jumlahBerkas = semuaBerkas.size;
jalan('bangunSemuaLembar()');
periksa('bangun diulang tidak menyalin apa pun', semuaBerkas.size === jumlahBerkas);

console.log('\nPenjaring bergilir');
for (let i = 0; i < 6; i++) {
  try { jalan('jaringBergilir()'); } catch (e) {
    periksa(`jaringBergilir ke-${i + 1} tanpa galat`, false, e.stack.split('\n').slice(0, 3).join(' | '));
    break;
  }
}

let bocor = 0;
const contohBocor = [];
let terpetakan = 0;
let total = 0;
let salahUnit = [];
for (const r of siap) {
  const b = semuaBerkas.get(r[4]);
  const d = dataPer[r[3]];
  const lb = b.getSheetByName('Berita');
  const baris = lb.getLastRow() > 1 ? lb.getRange(2, 1, lb.getLastRow() - 1, 16).getValues() : [];
  const milik = new Set(d.unit.map((u) => u.nama));
  for (const x of baris) {
    total++;
    const asal = butirUmpan.find((u) => u.tautan === x[3]);
    if (!asal || asal.kanwil !== d.nama) { bocor++; contohBocor.push(`${d.wilayah} <- ${asal?.unit}`); }
    if (x[7]) {
      terpetakan++;
      if (!milik.has(x[7]) || x[7] !== asal?.unit) salahUnit.push(`${d.wilayah}: ${x[7]}`);
    }
    if (x[8] !== d.nama) bocor++;
  }
}
periksa('penjaring memungut berita', total > 0, `total ${total}`);
periksa('tidak ada berita kanwil lain yang masuk (jangkar wilayah per kanwil)', bocor === 0, `${bocor} baris bocor: ${contohBocor.slice(0, 6).join(" ; ")}`);
periksa('Nama UPT terisi dan benar', salahUnit.length === 0 && terpetakan > total * 0.8,
  `terpetakan ${terpetakan}/${total}; salah: ${salahUnit.slice(0, 3).join(' ; ')}`);
periksa('alamat Google News dibuang', !lingk.ambil.some((u) => u.includes('news.google.com')));

const jurnal = induk.getSheetByName('Jurnal Induk');
periksa('Jurnal Induk mencatat setiap jalan', jurnal.getLastRow() - 1 >= 6);
periksa('penunjuk giliran tersimpan', lingk.props.penunjuk !== undefined);

const diy = semuaBerkas.get(siap.find((r) => r[1] === 'D.I. Yogyakarta')[4]);
const pDiy = diy.getSheetByName('Portal Wilayah').getRange(2, 1, 1, 9).getValues()[0];
periksa('portal mati dinonaktifkan sendiri setelah 5 kali gagal', pDiy[6] === false && pDiy[7] >= 5,
  `aktif=${pDiy[6]} gagal=${pDiy[7]}`);

const ringkas = diy.getSheetByName('Ringkasan');
periksa('Ringkasan memuat tabel unit', ringkas.getLastRow() >= 16 + dataPer['Kantor Wilayah Ditjenpas D.I. Yogyakarta'].unit.length);

console.log('\nSuntingan petugas');
const aceh = semuaBerkas.get(siap.find((r) => r[1] === 'Aceh')[4]);
const lu = aceh.getSheetByName('Target Unit');
const kota = lu.getRange(2, 3).getValue();
const polos = String(kota).replace(/^(Kota|Kabupaten)\s+/i, '');
lu.getRange(2, 4).setValue(`${lu.getRange(2, 1).getValue()}; ${polos}`);
lingk.aktifkan(aceh);
jalan(`onEdit({ range: SpreadsheetApp.getActive().getSheetByName('Target Unit').getRange(2, 4), source: SpreadsheetApp.getActive() })`);
periksa(`nama daerah sendirian ("${polos}") ditandai merah`, lu.latar['2,4'] === '#f8d7da');

const ragamDisunting = lu.getRange(3, 4).getValue() + '; Rutan Uji Panggilan';
lu.getRange(3, 4).setValue(ragamDisunting);
jalan('perbaikiFormatAktif()');
periksa('perbaiki format tidak menimpa ragam nama yang disunting', lu.getRange(3, 4).getValue() === ragamDisunting);

const ctx = jalan('konteksKanwil(SpreadsheetApp.getActive())');
const unitPolos = ctx.unit[0];
periksa('ragam nama daerah sendirian tidak dipakai sebagai jangkar unit',
  !unitPolos.pola.some((p) => p.test(` ${polos.toLowerCase()} `)));

console.log('\nPembangunan terpotong batas waktu');

/*
 * Di akun sungguhan 32 salinan tidak muat dalam satu jalan enam menit. Jam
 * tiruan ini maju 20 detik setiap kali dibaca, sehingga pembangunan pasti
 * terpotong dan harus dilanjutkan pemicu sekali-pakai — jalur yang paling
 * mungkin meninggalkan salinan kembar bila ID tidak ditulis sebelum membangun.
 */
let detik = Date.now();
class JamCepat extends Date {
  constructor(...a) { super(...(a.length ? a : [detik])); }
  static now() { detik += 20000; return detik; }
}
const lingk2 = buatLingkungan(() => rss, JamCepat);
vm.runInContext(kode, lingk2.konteks);
const induk2 = new Berkas('Lembar Induk kedua');
induk2.insertSheet('Sheet1');
lingk2.aktifkan(induk2);
const sebelum = semuaBerkas.size;

vm.runInContext('pasangSemua()', lingk2.konteks);
const terpotong = lingk2.pemicu.some((p) => p.fn === 'bangunSemuaLembar');
periksa('jalan pertama terpotong dan memasang pemicu lanjutan', terpotong);

let putaran = 0;
while (lingk2.pemicu.some((p) => p.fn === 'bangunSemuaLembar') && putaran < 40) {
  putaran++;
  vm.runInContext('bangunSemuaLembar()', lingk2.konteks);
}
const d2 = induk2.getSheetByName('Daftar Lembar');
const st2 = d2.getRange(2, 7, 33, 1).getValues().map((r) => r[0]);
periksa('seluruh 32 lembar akhirnya Siap lewat pemicu lanjutan',
  st2.filter((s) => s === 'Siap').length === 32, `${putaran} putaran; ${[...new Set(st2)].join(', ')}`);
periksa('tidak ada salinan kembar', semuaBerkas.size - sebelum === 32, `${semuaBerkas.size - sebelum} salinan`);
periksa('pemicu lanjutan terhapus setelah selesai', !lingk2.pemicu.some((p) => p.fn === 'bangunSemuaLembar'));

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exit(gagal ? 1 : 0);
