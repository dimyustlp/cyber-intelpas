import {
KATEGORI,
KATEGORI_LAINNYA,
KATEGORI_LUAR_LINGKUP,
SEMUA_SUBKATEGORI,
PENANDA_AKTOR,
PENANDA_LEMBAGA_LAIN,
PENANDA_KEHUMASAN,
JANGKAR_PEMASYARAKATAN,
JANGKAR_KUAT,
KATA_FUNGSI_INDONESIA,
FRASA_PEMBALIK,
FRASA_BANTAHAN,
PEMICU_KRITIS,
PERINGKAT_URGENSI,
} from './taksonomi.js'
import { bersihkanTeks, normalkan, siapkanKonteks, hitungFrasa, yangMuncul } from './teks.js'
import { kenaliPenerbit } from './penerbit.js'
const VERSI_MESIN = 'aturan-v4.0'
const AMBANG_SKOR = 3.0
const AMBANG_HUMAS = 2.0
const PANJANG_MINIMUM = 8
export { bersihkanTeks, normalkan }
export function deteksiAktor(konteks) {
const skor = { petugas: 0, wbp: 0, eksternal: 0 }
for (const [aktor, penanda] of Object.entries(PENANDA_AKTOR)) {
for (const kata of penanda) {
const n = hitungFrasa(konteks, kata)
if (!n) continue
const bobot = kata.startsWith('oknum') ? 3 : kata.length > 10 ? 2 : 1
skor[aktor] += n * bobot
}
}
const urut = Object.entries(skor).sort((a, b) => b[1] - a[1])
const dominan = urut[0][1] > 0 && urut[0][1] > urut[1][1] ? urut[0][0] : null
return { ...skor, dominan }
}
export function adaFrasaPembalik(konteks) {
for (const f of FRASA_PEMBALIK) if (hitungFrasa(konteks, f, 1)) return true
return false
}
export function adaBantahan(konteks) {
for (const f of FRASA_BANTAHAN) if (hitungFrasa(konteks, f, 1)) return true
return false
}
export function adaKonteksHumas(konteks) {
let nilai = 0
for (const p of PENANDA_KEHUMASAN) {
if (hitungFrasa(konteks, p, 1)) nilai += 1
if (nilai >= 2) return true
}
return false
}
export function periksaRelevansi(konteks, penerbit = null) {
const lembagaLain = yangMuncul(konteks, PENANDA_LEMBAGA_LAIN)
if (lembagaLain.length) {
return {
lolos: false,
kode: '9.1',
alasan: `Teks menyebut ${lembagaLain[0]}, yaitu fasilitas penahanan milik lembaga di luar Ditjen Pemasyarakatan.`,
}
}
const jangkar = yangMuncul(konteks, JANGKAR_PEMASYARAKATAN)
if (jangkar.length) return { lolos: true, jangkar }
if (penerbit?.resmi) {
return { lolos: true, jangkar: [penerbit.akun], dariPenerbit: true }
}
return {
lolos: false,
kode: '9.2',
alasan: 'Tidak ada satu pun penyebutan Lapas, Rutan, Bapas, warga binaan, atau Pemasyarakatan, '
+ 'dan penerbitnya bukan akun resmi unit Pemasyarakatan.',
}
}
const POLA_NAMA_UNIT =
/\b(lapas|rutan|bapas|lpka|lpp)\s+(kelas|perempuan|narkotika|pemuda|terbuka|khusus|anak)\b/
export function periksaKebisingan(konteks) {
if (yangMuncul(konteks, JANGKAR_KUAT).length) return null
if (POLA_NAMA_UNIT.test(konteks.teks)) return null
if (yangMuncul(konteks, KATA_FUNGSI_INDONESIA).length) return null
return {
kode: '9.2',
alasan:
'Kata "lapas" atau "bapas" muncul tanpa satu pun kata bahasa Indonesia lain dan tanpa kata kunci isu apa pun.',
}
}
function pengaliAktor(sub, aktor) {
if (!sub.aktor || sub.aktor === 'campuran' || sub.aktor === 'sistem') return 1
if (sub.aktor === 'petugas') {
if (aktor.petugas > 0 && aktor.petugas >= aktor.wbp) return 1.6
if (aktor.petugas > 0) return 1.15
return aktor.wbp > 0 ? 0.45 : 0.85
}
if (sub.aktor === 'wbp') {
if (aktor.wbp > 0 && aktor.wbp >= aktor.petugas) return 1.4
if (aktor.wbp > 0) return 1.1
return aktor.petugas > 0 ? 0.65 : 0.9
}
if (sub.aktor === 'eksternal') {
if (aktor.eksternal > 0) return 1.5
return 0.9
}
return 1
}
function labelKunci(kunci) {
return Array.isArray(kunci) ? kunci.join(' + ') : kunci
}
function nilaiKunci(konteks, kunci) {
if (Array.isArray(kunci)) {
let terkecil = Infinity
for (const istilah of kunci) {
const n = hitungFrasa(konteks, istilah)
if (!n) return 0
terkecil = Math.min(terkecil, n)
}
return terkecil === Infinity ? 0 : terkecil
}
return hitungFrasa(konteks, kunci)
}
export function skorSubkategori(konteks, aktor, konteksHumas) {
const hasil = []
for (const sub of SEMUA_SUBKATEGORI) {
let skor = 0
const cocok = []
let adaPositif = false
for (const [kata, bobot] of sub.kunci) {
if (!bobot) continue
const n = nilaiKunci(konteks, kata)
if (!n) continue
skor += bobot * (1 + (n - 1) * 0.35)
if (bobot > 0) { cocok.push(labelKunci(kata)); adaPositif = true }
}
for (const [pola, bobot] of sub.pola) {
if (!pola.test(konteks.teks)) continue
skor += bobot
cocok.push('pola tekstual')
if (bobot > 0) adaPositif = true
}
if (!adaPositif) continue
if (skor <= 0) continue
skor *= pengaliAktor(sub, aktor)
if (konteksHumas && sub.sifat === 'positif') skor *= 1.2
hasil.push({ sub, skor: Number(skor.toFixed(3)), cocok })
}
return hasil.sort((a, b) => b.skor - a.skor)
}
const PENANDA_POSITIF = [
'berhasil', 'prestasi', 'penghargaan', 'inovasi', 'apresiasi', 'meraih',
'sukses', 'lancar', 'kondusif', 'meningkat', 'terbaik', 'juara',
'digagalkan', 'menggagalkan', 'terkendali', 'nihil', 'meriah', 'khidmat',
'semangat', 'kebersamaan', 'gratis', 'peduli', 'sinergi', 'komitmen',
'selamat', 'bangga', 'harmonis', 'produktif', 'mandiri',
]
const PENANDA_NEGATIF = [
'kabur', 'tewas', 'meninggal', 'kerusuhan', 'kebakaran', 'pungli',
'kekerasan', 'pelanggaran', 'korupsi', 'pemerasan', 'suap', 'dianiaya',
'diselundupkan', 'ilegal', 'dikeluhkan', 'protes', 'menuntut', 'disorot',
'lemah', 'lalai', 'kelalaian', 'buron', 'overkapasitas', 'penyiksaan',
'penembakan', 'pembiaran', 'memprihatinkan', 'dicopot', 'tersangka',
]
export function tentukanSentimen(konteks, sub, adaPembalik) {
const positif = yangMuncul(konteks, PENANDA_POSITIF).length
const negatif = yangMuncul(konteks, PENANDA_NEGATIF).length
if (!sub) {
if (negatif > positif) return 'Negatif'
if (positif > negatif) return 'Positif'
return 'Netral'
}
if (sub.sifat === 'positif') return negatif > positif + 1 ? 'Campuran' : 'Positif'
if (adaPembalik && (sub.kategoriKode === '6' || sub.kode === '8.5')) return 'Campuran'
if (sub.kode === '7.1') return negatif > positif + 1 ? 'Negatif' : 'Netral'
if (sub.sifat === 'negatif') return positif > negatif + 2 ? 'Campuran' : 'Negatif'
return 'Netral'
}
export function tentukanUrgensi(konteks, sub, adaPembalik, risikoCrawler) {
let urgensi = sub ? sub.urgensi : 'Rendah'
const SUB_BOLEH_KRITIS = new Set(['1.1', '1.2', '3.3', '4.1', '4.3', '5.1', '6.2'])
const pemicu = yangMuncul(konteks, PEMICU_KRITIS)
if (sub && SUB_BOLEH_KRITIS.has(sub.kode)) {
const massal =
/(massal|berjamaah|serentak|puluhan|ratusan|napiter|terorisme|penyanderaan|sandera|evakuasi|dievakuasi)/.test(
konteks.teks,
) ||
/\b([3-9]|\d{2,})\s*(orang|napi|narapidana|tahanan|warga binaan)\b[^.]{0,40}\bkabur\b/.test(konteks.teks)
if (massal && pemicu.length >= 1) urgensi = 'Kritis'
else if (pemicu.length >= 3) urgensi = 'Kritis'
}
if (adaPembalik && PERINGKAT_URGENSI[urgensi] > 2) {
urgensi = 'Sedang'
}
const lantai = { RENDAH: 'Rendah', SEDANG: 'Sedang', TINGGI: 'Tinggi', KRITIS: 'Kritis' }[
String(risikoCrawler ?? '').trim().toUpperCase()
]
if (lantai && PERINGKAT_URGENSI[lantai] > PERINGKAT_URGENSI[urgensi]) {
if (!sub || sub.kategoriKode === '0') urgensi = lantai
}
return urgensi
}
export function tentukanPerhatian(urgensi, sentimen) {
if (PERINGKAT_URGENSI[urgensi] >= 3) return 'Tinggi'
if (urgensi === 'Sedang' || sentimen === 'Negatif') return 'Sedang'
return 'Rendah'
}
export function klasifikasikan(berita = {}) {
const judul = bersihkanTeks(berita.judul)
const ringkasan = bersihkanTeks(berita.ringkasan)
const tambahan = bersihkanTeks(berita.caption_manual || berita.raw_analysis)
const gabungan = [judul, judul, ringkasan, tambahan].filter(Boolean).join(' . ')
const teksNormal = normalkan(gabungan)
if (!teksNormal || teksNormal.length < PANJANG_MINIMUM) {
return hasilKosong('Teks terlalu pendek untuk dinilai')
}
const konteks = siapkanKonteks(teksNormal)
const penerbit = kenaliPenerbit(berita, teksNormal)
const relevansi = periksaRelevansi(konteks, penerbit)
if (!relevansi.lolos) return hasilLuarLingkup(relevansi.kode, relevansi.alasan)
const aktor = deteksiAktor(konteks)
const pembalik = adaFrasaPembalik(konteks)
const bantahan = adaBantahan(konteks)
const konteksHumas = adaKonteksHumas(konteks)
let peringkat = skorSubkategori(konteks, aktor, konteksHumas || penerbit.resmi)
let skorTergeser = 0
if (bantahan) {
const hoaks = peringkat.find((p) => p.sub.kode === '7.1')
if (hoaks && peringkat[0] && peringkat[0].sub.kode !== '7.1') {
const juaraLain = peringkat[0].skor
if (hoaks.skor >= juaraLain * 0.5) {
skorTergeser = juaraLain
peringkat = [hoaks, ...peringkat.filter((p) => p !== hoaks)]
}
}
}
const juara = peringkat[0]
const humasKuat = konteksHumas || penerbit.resmi
let ambang = juara && juara.sub.sifat === 'positif' && humasKuat ? AMBANG_HUMAS : AMBANG_SKOR
if (skorTergeser >= AMBANG_SKOR && juara?.sub.kode === '7.1') ambang = 0
if (!juara || juara.skor < ambang) {
if (!penerbit.resmi) {
const bising = periksaKebisingan(konteks)
if (bising) return hasilLuarLingkup(bising.kode, bising.alasan)
}
if (penerbit.resmi) {
const sub = SEMUA_SUBKATEGORI.find((s) => s.kode === '8.4')
return {
kategori: sub.kategoriNama,
kategori_kode: '8',
subkategori: sub.nama,
subkategori_kode: '8.4',
sentimen: 'Positif',
urgensi: 'Rendah',
tingkat_perhatian: 'Rendah',
kata_kunci: [],
aktor_terdeteksi: aktor.dominan,
ada_frasa_pembalik: pembalik,
ada_bantahan: bantahan,
konteks_humas: true,
penerbit: penerbit.jenis,
dalam_lingkup: true,
ai_confidence: 0.55,
ai_provider: VERSI_MESIN,
skor_tertinggi: juara?.skor ?? 0,
pesaing: peringkat.slice(0, 3).map(ringkasPesaing),
alasan: `${penerbit.alasan} Tidak ada kata kunci isu yang menonjol, `
+ 'sehingga dicatat sebagai publikasi kehumasan yang jenis kegiatannya belum dirinci.',
}
}
const sentimen = tentukanSentimen(konteks, null, pembalik)
const urgensi = tentukanUrgensi(konteks, null, pembalik, berita.urgensi)
return {
...hasilKosong('Tidak ada subkategori yang melewati ambang skor'),
sentimen,
urgensi,
tingkat_perhatian: tentukanPerhatian(urgensi, sentimen),
penerbit: penerbit.jenis,
skor_tertinggi: juara?.skor ?? 0,
pesaing: peringkat.slice(0, 3).map(ringkasPesaing),
}
}
const runnerUp = peringkat[1]
const sub = juara.sub
const selisih = runnerUp ? (juara.skor - runnerUp.skor) / juara.skor : 1
const kekuatan = Math.min(1, juara.skor / 12)
const keyakinan = Number(Math.max(0.3, Math.min(0.97, 0.35 * kekuatan + 0.45 * selisih + 0.2)).toFixed(3))
const sentimen = tentukanSentimen(konteks, sub, pembalik)
const urgensi = tentukanUrgensi(konteks, sub, pembalik, berita.urgensi)
return {
kategori: sub.kategoriNama,
kategori_kode: sub.kategoriKode,
subkategori: sub.nama,
subkategori_kode: sub.kode,
sentimen,
urgensi,
tingkat_perhatian: tentukanPerhatian(urgensi, sentimen),
kata_kunci: [...new Set(juara.cocok)].slice(0, 8),
aktor_terdeteksi: aktor.dominan,
ada_frasa_pembalik: pembalik,
ada_bantahan: bantahan,
konteks_humas: konteksHumas,
penerbit: penerbit.jenis,
dalam_lingkup: true,
ai_confidence: keyakinan,
ai_provider: VERSI_MESIN,
skor_tertinggi: juara.skor,
pesaing: peringkat.slice(1, 4).map(ringkasPesaing),
alasan: susunAlasan(sub, juara.cocok, aktor, pembalik, bantahan),
}
}
function ringkasPesaing(p) {
return { kode: p.sub.kode, nama: p.sub.nama, skor: p.skor }
}
function hasilKosong(alasan) {
return {
kategori: KATEGORI_LAINNYA.nama,
kategori_kode: '0',
subkategori: 'Belum Dikelompokkan',
subkategori_kode: '0.1',
sentimen: 'Netral',
urgensi: 'Rendah',
tingkat_perhatian: 'Rendah',
kata_kunci: [],
aktor_terdeteksi: null,
ada_frasa_pembalik: false,
ada_bantahan: false,
konteks_humas: false,
dalam_lingkup: true,
ai_confidence: 0.2,
ai_provider: VERSI_MESIN,
skor_tertinggi: 0,
pesaing: [],
alasan,
}
}
function hasilLuarLingkup(kode, alasan) {
const sub = KATEGORI_LUAR_LINGKUP.subkategori.find((s) => s.kode === kode)
return {
kategori: KATEGORI_LUAR_LINGKUP.nama,
kategori_kode: '9',
subkategori: sub ? sub.nama : 'Konten Tidak Relevan',
subkategori_kode: kode,
sentimen: 'Netral',
urgensi: 'Rendah',
tingkat_perhatian: 'Rendah',
kata_kunci: [],
aktor_terdeteksi: null,
ada_frasa_pembalik: false,
ada_bantahan: false,
konteks_humas: false,
dalam_lingkup: false,
ai_confidence: 0.9,
ai_provider: VERSI_MESIN,
skor_tertinggi: 0,
pesaing: [],
alasan,
}
}
function susunAlasan(sub, cocok, aktor, pembalik, bantahan) {
const bagian = [`Kata kunci penentu: ${cocok.slice(0, 4).join(', ')}`]
if (aktor.dominan) {
const label = { petugas: 'petugas', wbp: 'warga binaan', eksternal: 'pihak luar' }[aktor.dominan]
bagian.push(`pelaku yang disebut mengarah ke ${label}`)
}
if (pembalik) bagian.push('terdapat frasa yang menunjukkan kejadian berhasil dicegah atau digagalkan')
if (bantahan) bagian.push('teks berisi bantahan atau klarifikasi, bukan laporan peristiwa')
bagian.push(`sehingga masuk ${sub.kode} ${sub.nama}`)
return bagian.join('; ') + '.'
}
export function klasifikasikanBanyak(daftar) {
return daftar.map((b) => ({ id: b.id, ...klasifikasikan(b) }))
}
export const META_MESIN = {
versi: VERSI_MESIN,
ambang: AMBANG_SKOR,
ambangHumas: AMBANG_HUMAS,
jumlahSubkategori: SEMUA_SUBKATEGORI.length,
}
export { KATEGORI }
