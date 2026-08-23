const POLA_BOILERPLATE = [
/risiko\s*:\s*(rendah|sedang|tinggi|kritis)\s*analisis\s*:[\s\S]*?rekomendasi\s*:[^.]*\.?/gi,
/risiko\s*:\s*(rendah|sedang|tinggi|kritis)/gi,
/analisis\s*:\s*berita(\/konten)?\s*bersifat informatif umum[^.]*\./gi,
/analisis\s*:\s*isu memerlukan perhatian[^.]*\./gi,
/rekomendasi\s*:\s*arsip[^.]*\./gi,
/rekomendasi\s*:\s*lakukan pemantauan berkala[^.]*\./gi,
/generated automatically[^.]*\./gi,
]
const POLA_EKOR_JUDUL =
/\s*[-–—]\s*(instagram\.com|facebook\.com|tiktok\.com|x\.com|twitter\.com|youtube\.com|youtube|tiktok|instagram|facebook)\s*$/i
const PETA_ANGKA = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g' }
export function bersihkanTeks(nilai) {
let teks = String(nilai ?? '')
for (const pola of POLA_BOILERPLATE) teks = teks.replace(pola, ' ')
return teks
.replace(/https?:\/\/\S+/g, ' ')
.replace(/\\[nrt]/g, ' ')
.replace(POLA_EKOR_JUDUL, ' ')
.replace(/&amp;/g, ' dan ')
.replace(/&\w+;/g, ' ')
.replace(/\s+/g, ' ')
.trim()
}
export function pulihkanSamaran(teks) {
return teks.replace(/(?<=[a-z])([013456789])(?=[a-z])/g, (m) => PETA_ANGKA[m] || m)
}
export function normalkan(nilai) {
const dasar = bersihkanTeks(nilai)
.toLowerCase()
.normalize('NFD')
.replace(/[̀-ͯ]/g, '')
.replace(/[^a-z0-9\s]/g, ' ')
.replace(/\s+/g, ' ')
.trim()
return pulihkanSamaran(dasar)
}
const AWALAN = [
['memper', ['']], ['mempe', ['']], ['diper', ['']], ['keter', ['']], ['keber', ['']],
['berke', ['']], ['perse', ['']],
['meng', ['', 'k']], ['meny', ['s']], ['peng', ['', 'k']], ['peny', ['s']],
['mem', ['', 'p']], ['men', ['', 't']], ['pem', ['', 'p']], ['pen', ['', 't']],
['ber', ['']], ['bel', ['']], ['ter', ['']], ['per', ['']],
['me', ['']], ['pe', ['']], ['be', ['']], ['te', ['']],
['di', ['']], ['ke', ['']], ['se', ['']],
]
const AKHIRAN = ['nya', 'lah', 'kah', 'tah', 'pun', 'ku', 'mu', 'kan', 'an', 'i']
const PANJANG_AKAR_MINIMUM = 4
const AKAR_TERLARANG = new Set([
'lari', 'tangkap', 'jalan', 'main', 'bawa', 'buka', 'tutup', 'naik', 'turun',
'ambil', 'beri', 'buat', 'dapat', 'pakai', 'kerja', 'tempat', 'laku', 'hasil',
'kata', 'ikut', 'bagi', 'tinggal', 'lihat', 'datang', 'kena', 'isi', 'ada',
'guna', 'tuju', 'satu', 'baik', 'besar', 'jadi', 'kali', 'lalu', 'oleh',
'patah', 'jaya', 'putra', 'putri', 'agung', 'mulia', 'indah', 'terang',
])
const simpananAkar = new Map()
export function akarKata(kata) {
const tersimpan = simpananAkar.get(kata)
if (tersimpan) return tersimpan
const hasil = new Set([kata])
let lapis = [kata]
for (let putaran = 0; putaran < 2 && lapis.length; putaran += 1) {
const berikut = []
for (const bentuk of lapis) {
for (const akhiran of AKHIRAN) {
if (!bentuk.endsWith(akhiran)) continue
const sisa = bentuk.slice(0, -akhiran.length)
if (sisa.length < PANJANG_AKAR_MINIMUM || hasil.has(sisa)) continue
hasil.add(sisa)
berikut.push(sisa)
}
}
lapis = berikut
}
for (const bentuk of [...hasil]) {
for (const [awalan, penggantiDepan] of AWALAN) {
if (!bentuk.startsWith(awalan)) continue
const sisa = bentuk.slice(awalan.length)
if (sisa.length < 3) continue
for (const depan of penggantiDepan) {
const calon = depan + sisa
if (calon.length >= PANJANG_AKAR_MINIMUM) hasil.add(calon)
}
break
}
}
const bersih = new Set([kata])
for (const calon of hasil) {
if (calon.length >= PANJANG_AKAR_MINIMUM && !AKAR_TERLARANG.has(calon)) bersih.add(calon)
}
simpananAkar.set(kata, bersih)
return bersih
}
export function sekerabat(kataA, kataB) {
if (kataA === kataB) return true
const a = akarKata(kataA)
if (a.has(kataB)) return true
for (const calon of akarKata(kataB)) if (a.has(calon)) return true
return false
}
export function siapkanKonteks(teksNormal) {
const token = teksNormal ? teksNormal.split(' ').filter(Boolean) : []
const akar = token.map((t) => akarKata(t))
const indeks = new Map()
token.forEach((t, i) => {
for (const calon of akar[i]) {
const daftar = indeks.get(calon)
if (daftar) daftar.push(i)
else indeks.set(calon, [i])
}
})
return { teks: teksNormal, token, akar, indeks, jumlahToken: token.length }
}
const simpananKunci = new Map()
export function siapkanKunci(frasa) {
const tersimpan = simpananKunci.get(frasa)
if (tersimpan) return tersimpan
const kata = String(frasa).split(' ').filter(Boolean)
const siap = { asli: frasa, kata, akar: kata.map((k) => akarKata(k)), panjang: kata.length }
simpananKunci.set(frasa, siap)
return siap
}
export function hitungFrasa(konteks, frasa, maksimum = 3) {
const kunci = siapkanKunci(frasa)
if (!kunci.panjang || !konteks.jumlahToken) return 0
const awal = new Set()
for (const calon of kunci.akar[0]) {
const daftar = konteks.indeks.get(calon)
if (daftar) for (const p of daftar) awal.add(p)
}
if (!awal.size) return 0
if (kunci.panjang === 1) return Math.min(maksimum, awal.size)
let jumlah = 0
const urut = [...awal].sort((a, b) => a - b)
let batasBawah = -1
for (const mulai of urut) {
if (mulai <= batasBawah) continue
if (mulai + kunci.panjang > konteks.jumlahToken) break
let cocok = true
for (let j = 1; j < kunci.panjang; j += 1) {
const akarToken = konteks.akar[mulai + j]
let ketemu = false
for (const calon of kunci.akar[j]) {
if (akarToken.has(calon)) { ketemu = true; break }
}
if (!ketemu) { cocok = false; break }
}
if (cocok) {
jumlah += 1
batasBawah = mulai + kunci.panjang - 1
if (jumlah >= maksimum) break
}
}
return jumlah
}
export function adaSalahSatu(konteks, daftarFrasa) {
for (const frasa of daftarFrasa) if (hitungFrasa(konteks, frasa, 1)) return true
return false
}
export function yangMuncul(konteks, daftarFrasa) {
const hasil = []
for (const frasa of daftarFrasa) if (hitungFrasa(konteks, frasa, 1)) hasil.push(frasa)
return hasil
}
export const META_TEKS = { versi: 'teks-v1.0', panjangAkarMinimum: PANJANG_AKAR_MINIMUM }
