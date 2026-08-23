const KATA_UMUM = new Set([
'lapas', 'rutan', 'lpka', 'lpp', 'bapas', 'lembaga', 'pemasyarakatan', 'rumah',
'tahanan', 'negara', 'balai', 'pembinaan', 'khusus', 'kelas', 'i', 'ii', 'iia',
'iib', 'iii', 'ia', 'ib', 'umum', 'cabang', 'cab', 'kota', 'kabupaten', 'kab',
'penempatan', 'sementara', 'daerah', 'wilayah', 'kantor', 'ditjenpas', 'pas',
])
const PENANDA_JENIS = [
['lembaga pembinaan khusus anak', 'LPKA'],
['lembaga pemasyarakatan perempuan', 'Lapas'],
['lapas perempuan', 'Lapas'],
['lembaga pemasyarakatan', 'Lapas'],
['rumah tahanan negara', 'Rutan'],
['rumah tahanan', 'Rutan'],
['balai pemasyarakatan', 'Bapas'],
['kalapas', 'Lapas'],
['karutan', 'Rutan'],
['lapas', 'Lapas'],
['rutan', 'Rutan'],
['lpka', 'LPKA'],
['lpp', 'Lapas'],
['bapas', 'Bapas'],
]
const PENANDA_BUKAN_PAS = [
'kpk', 'komisi pemberantasan', 'bareskrim', 'mabes', 'polri', 'polda',
'polres', 'polresta', 'polsek', 'brimob', 'militer', 'pomdam', 'puspom',
'kejaksaan', 'kejagung', 'kejati', 'kejari', 'merah putih', 'guntur',
'imigrasi', 'salemba cabang kejaksaan',
]
const JENDELA_LEMBAGA = 26
export const SEBUTAN_POPULER = [
['salemba', 'Rutan Kelas I Jakarta Pusat'],
['tanjung gusta', 'Lapas Kelas I Medan'],
['sukamiskin', 'Lapas Kelas I Sukamiskin'],
['kerobokan', 'Lapas Kelas IIA Kerobokan'],
['kedungpane', 'Lapas Kelas I Semarang'],
['kedungpani', 'Lapas Kelas I Semarang'],
['wirogunan', 'Lapas Kelas IIA Yogyakarta'],
['kalisosok', 'Rutan Kelas I Surabaya'],
['porong', 'Lapas Kelas I Surabaya'],
['cebongan', 'Lapas Kelas IIB Sleman'],
['nusakambangan', null],
['pekanbaru', null],
]
const JENDELA = 70
const AMBANG_OTOMATIS = 0.72
const AMBANG_SARAN = 0.45
const KEPINGAN_TAGAR = [
'lembagapemasyarakatan', 'rumahtahanannegara', 'balaipemasyarakatan',
'pemasyarakatan', 'kemenimipas', 'ditjenpas', 'kanwil', 'humas',
'lapas', 'rutan', 'lpka', 'lpp', 'bapas',
'perempuan', 'narkotika', 'pemuda', 'terbuka', 'anak', 'kelas',
]
function pecahTagar(kata) {
if (kata.length < 9) return kata
const bagian = []
let sisa = kata
let aman = 0
for (;;) {
if (aman++ > 8) break
let ketemu = false
for (const keping of KEPINGAN_TAGAR) {
if (sisa.startsWith(keping) && sisa.length > keping.length) {
bagian.push(keping)
sisa = sisa.slice(keping.length)
ketemu = true
break
}
}
if (!ketemu) break
}
if (!bagian.length) return kata
return [...bagian, sisa].join(' ')
}
export function normalkanUpt(nilai) {
const dasar = String(nilai ?? '')
.toLowerCase()
.normalize('NFD')
.replace(/[̀-ͯ]/g, '')
.replace(/[^a-z0-9\s]/g, ' ')
.replace(/([a-z])(\d)/g, '$1 $2')
.replace(/(\d)([a-z])/g, '$1 $2')
.replace(/\s+/g, ' ')
.trim()
if (/[a-z]{9,}/.test(dasar)) {
return dasar.split(' ').map(pecahTagar).join(' ').replace(/\s+/g, ' ').trim()
}
return dasar
}
function tokenPembeda(nama) {
return normalkanUpt(nama)
.split(' ')
.filter((t) => t.length > 1 && !KATA_UMUM.has(t))
}
export function bangunIndeks(daftarUpt) {
const entri = []
const hitungNama = new Map()
for (const upt of daftarUpt) {
const nama = upt.nama_upt
if (!nama) continue
const token = tokenPembeda(nama)
if (!token.length) continue
const jenis = upt.jenis_upt || tebakJenis(nama)
const kunci = token.join(' ')
const kunciJenis = `${jenis}::${kunci}`
hitungNama.set(kunciJenis, (hitungNama.get(kunciJenis) || 0) + 1)
const petunjuk = normalkanUpt(upt.location_hint || '')
const kabkota = normalkanUpt(upt.kabupaten_kota || '').replace(/^(kota|kabupaten) /, '')
entri.push({
nama,
jenis,
kelas: String(upt.kelas_upt || '').toLowerCase(),
subjenis: upt.subjenis_upt || 'Umum',
provinsi: upt.provinsi || '',
kanwil: upt.kanwil || '',
kabkota,
token,
tokenRapat: token.map((t) => t.replace(/\s+/g, '')),
kunci,
kunciJenis,
namaNormal: normalkanUpt(nama),
namaRapat: normalkanUpt(nama).replace(/\s+/g, ''),
petunjuk: petunjuk && petunjuk !== kunci ? petunjuk : '',
sebutan: [],
})
}
for (const e of entri) e.bersaing = (hitungNama.get(e.kunciJenis) || 0) > 1
const perNama = new Map(entri.map((e) => [e.nama, e]))
let sebutanTerpasang = 0
const sebutanTakDikenal = []
for (const [alias, namaResmi] of SEBUTAN_POPULER) {
if (!namaResmi) continue
const target = perNama.get(namaResmi)
if (!target) { sebutanTakDikenal.push(namaResmi); continue }
target.sebutan.push(normalkanUpt(alias))
sebutanTerpasang += 1
}
entri.sort((a, b) => b.kunci.length - a.kunci.length)
return {
entri,
jumlah: entri.length,
sebutanTerpasang,
sebutanTakDikenal,
jumlahBersaing: entri.filter((e) => e.bersaing).length,
}
}
function tebakJenis(nama) {
const n = normalkanUpt(nama)
if (n.startsWith('rutan') || n.includes('rumah tahanan')) return 'Rutan'
if (n.startsWith('lpka') || n.includes('pembinaan khusus anak')) return 'LPKA'
if (n.startsWith('bapas') || n.includes('balai pemasyarakatan')) return 'Bapas'
return 'Lapas'
}
export function ambilJendela(teksNormal) {
const hasil = []
const terpakai = []
for (const [penanda, jenis] of PENANDA_JENIS) {
let dari = 0
for (;;) {
const posisi = teksNormal.indexOf(penanda, dari)
if (posisi === -1) break
dari = posisi + penanda.length
const sebelum = posisi === 0 ? ' ' : teksNormal[posisi - 1]
if (/[a-z0-9]/.test(sebelum)) continue
if (terpakai.some(([a, b]) => posisi >= a && posisi < b)) continue
terpakai.push([posisi, posisi + penanda.length])
const dekat = teksNormal.slice(posisi + penanda.length, posisi + penanda.length + JENDELA_LEMBAGA)
if (PENANDA_BUKAN_PAS.some((l) => cocokKata(dekat, l))) continue
hasil.push({
jenis,
posisi,
jendela: teksNormal.slice(posisi, posisi + penanda.length + JENDELA),
})
}
}
return hasil.sort((a, b) => a.posisi - b.posisi)
}
export function cocokkanUpt(teks, indeks, opsi = {}) {
const maksSaran = opsi.maksSaran ?? 5
const teksNormal = normalkanUpt(teks)
if (!teksNormal) return kosong('Teks kosong')
const jendela = ambilJendela(teksNormal)
if (!jendela.length) {
return kosong('Tidak ada penyebutan Lapas, Rutan, LPKA, atau Bapas dalam teks')
}
const nilai = new Map()
const catat = (entri, skor, metode) => {
const lama = nilai.get(entri.nama)
if (!lama || skor > lama.skor) nilai.set(entri.nama, { entri, skor, metode })
}
for (const w of jendela) {
for (const entri of indeks.entri) {
if (entri.jenis !== w.jenis) continue
const sebutanCocok = entri.sebutan.find((s) => cocokKata(w.jendela, s))
if (sebutanCocok) {
catat(entri, 0.94, 'sebutan-populer')
continue
}
const cocok = tokenYangCocok(w.jendela, entri.token)
if (!cocok.length) continue
if (cocok.every((t) => TOKEN_SUBJENIS.has(t))) continue
const rasio = cocok.length / entri.token.length
if (rasio === 1) {
const jarak = posisiTerawal(w.jendela, entri.token)
const kedekatan = Math.max(0, 1 - jarak / JENDELA)
const kekhususan = Math.min(1, (entri.token.length - 1) / 2)
catat(entri, Math.min(0.99, 0.76 + 0.14 * kedekatan + 0.09 * kekhususan), 'nama-lengkap')
continue
}
const tokenPanjangCocok = cocok.some((t) => t.length >= 5)
if (rasio < 0.5 || !tokenPanjangCocok) continue
let skor = 0.4 + 0.32 * rasio
if (entri.petunjuk && cocokKata(w.jendela, entri.petunjuk)) skor += 0.12
if (entri.kabkota && cocokKata(teksNormal, entri.kabkota)) skor += 0.08
if (entri.kelas && w.jendela.includes(`kelas ${entri.kelas}`)) skor += 0.1
if (entri.subjenis !== 'Umum' && cocokKata(w.jendela, normalkanUpt(entri.subjenis))) skor += 0.1
catat(entri, Math.min(0.9, skor), 'nama-sebagian')
}
}
if (!nilai.size) {
for (const entri of indeks.entri) {
const sebutanCocok = entri.sebutan.find((s) => cocokKata(teksNormal, s))
if (sebutanCocok) catat(entri, 0.74, 'sebutan-tanpa-jenis')
}
}
if (!nilai.size) {
return kosong('Penanda jenis UPT ditemukan, tetapi nama unitnya tidak dikenali')
}
const urut = [...nilai.values()].sort((a, b) => b.skor - a.skor)
const juara = urut[0]
const kembar = urut.filter((u) => Math.abs(u.skor - juara.skor) < 0.02)
const bersaing = juara.entri.bersaing || kembar.length > 1
const otomatis = juara.skor >= AMBANG_OTOMATIS && !bersaing
return {
nama: otomatis ? juara.entri.nama : null,
skor: Number(juara.skor.toFixed(3)),
metode: juara.metode,
otomatis,
bersaing,
alasan: susunAlasan(juara, bersaing, otomatis),
saran: urut
.filter((u) => u.skor >= AMBANG_SARAN)
.slice(0, maksSaran)
.map((u) => ({
nama: u.entri.nama,
skor: Number(u.skor.toFixed(3)),
provinsi: u.entri.provinsi,
kanwil: u.entri.kanwil,
alasan: u.metode === 'nama-lengkap' ? 'Nama unit tersebut utuh setelah penanda jenis' : 'Sebagian nama unit cocok',
})),
}
}
const TOKEN_SUBJENIS = new Set(['perempuan', 'narkotika', 'anak', 'terbuka', 'pemuda', 'wanita'])
function tokenYangCocok(jendela, token) {
const terpakai = new Array(token.length).fill(false)
for (let panjang = token.length; panjang >= 2; panjang -= 1) {
for (let mulai = 0; mulai + panjang <= token.length; mulai += 1) {
let adaYangKosong = false
for (let i = mulai; i < mulai + panjang; i += 1) if (!terpakai[i]) adaYangKosong = true
if (!adaYangKosong) continue
const rapat = token.slice(mulai, mulai + panjang).join('')
if (!cocokKataLonggar(jendela, rapat)) continue
for (let i = mulai; i < mulai + panjang; i += 1) terpakai[i] = true
}
}
for (let i = 0; i < token.length; i += 1) {
if (terpakai[i]) continue
const t = token[i]
if (t.length >= 7 ? cocokKataLonggar(jendela, t) : cocokKata(jendela, t)) terpakai[i] = true
}
return token.filter((_, i) => terpakai[i])
}
function cocokKata(haystack, kata) {
if (!kata) return false
let dari = 0
for (;;) {
const p = haystack.indexOf(kata, dari)
if (p === -1) return false
const sebelum = p === 0 ? ' ' : haystack[p - 1]
const sesudah = haystack[p + kata.length] ?? ' '
if (!/[a-z0-9]/.test(sebelum) && !/[a-z0-9]/.test(sesudah)) return true
dari = p + 1
}
}
function miripSatuHuruf(a, b) {
if (a === b) return true
const selisih = a.length - b.length
if (selisih > 1 || selisih < -1) return false
if (a.length < 7 && b.length < 7) return false
if (selisih === 0) {
let beda = 0
for (let i = 0; i < a.length; i += 1) {
if (a[i] !== b[i] && ++beda > 1) return false
}
return beda === 1
}
const panjang = selisih === 1 ? a : b
const pendek = selisih === 1 ? b : a
let i = 0
let j = 0
let lewat = 0
while (i < panjang.length && j < pendek.length) {
if (panjang[i] === pendek[j]) { i += 1; j += 1; continue }
if (++lewat > 1) return false
i += 1
}
return true
}
function cocokKataLonggar(haystack, kata) {
if (cocokKata(haystack, kata)) return true
if (kata.length < 7) return false
for (const potong of haystack.split(' ')) {
if (miripSatuHuruf(potong, kata)) return true
}
return false
}
function posisiTerawal(haystack, token) {
let min = Infinity
for (const t of token) {
const p = haystack.indexOf(t)
if (p !== -1 && p < min) min = p
}
return min === Infinity ? JENDELA : min
}
function kosong(alasan) {
return { nama: null, skor: 0, metode: 'tidak-ada', otomatis: false, bersaing: false, alasan, saran: [] }
}
function susunAlasan(juara, bersaing, otomatis) {
if (otomatis) {
return `${juara.entri.nama} dikenali dari teks dengan keyakinan ${Math.round(juara.skor * 100)} persen.`
}
if (bersaing) {
return `Nama unit yang disebut dipakai oleh lebih dari satu UPT. Perlu dipastikan analis.`
}
return `Kandidat terkuat ${juara.entri.nama} baru mencapai ${Math.round(juara.skor * 100)} persen, di bawah ambang penerimaan otomatis.`
}
export const NILAI_TAK_TERPETAKAN = new Set([
'', 'belum teridentifikasi', 'tidak diketahui', 'null', 'none', 'nan', '-', 'undefined',
])
export function belumTerpetakan(nama) {
return NILAI_TAK_TERPETAKAN.has(String(nama ?? '').trim().toLowerCase())
}
export const META_PENCOCOK = { versi: 'kedekatan-v2.0', ambangOtomatis: AMBANG_OTOMATIS, ambangSaran: AMBANG_SARAN }
