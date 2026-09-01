const KATA_UMUM = new Set([
'lapas', 'rutan', 'lpka', 'lpp', 'bapas', 'lembaga', 'pemasyarakatan', 'rumah',
'tahanan', 'balai', 'pembinaan', 'khusus', 'kelas', 'i', 'ii', 'iia',
'iib', 'iii', 'ia', 'ib', 'umum', 'cabang', 'cab', 'kota', 'kabupaten', 'kab',
'penempatan', 'sementara', 'daerah', 'wilayah', 'kantor', 'ditjenpas', 'pas',
])
const KATA_DALAM_PENANDA = new Set(['negara'])
const PENANDA_JENIS = [
['lembaga pembinaan khusus anak', 'LPKA'],
['lembaga pemasyarakatan anak', 'LPKA'],
['lapas anak', 'LPKA'],
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
['ujung pandang', 'Lapas Kelas I Makassar'],
['ujung pandang', 'Rutan Kelas I Makassar'],
['tanjung pati', 'Lapas Kelas IIB Payakumbuh'],
['nusakambangan', null],
['pekanbaru', null],
]
const LINTAS_JENIS = new Set(['Lapas', 'Rutan'])
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
const KATA_WILAYAH = new Set(['kota', 'kabupaten', 'kab'])
function tempatRapatDari(nama, token) {
const tempat = normalkanUpt(nama)
.split(' ')
.filter((t) => t.length > 1 && (!KATA_UMUM.has(t) || KATA_WILAYAH.has(t)))
.join('')
if (tempat.length < 8 || tempat === token.join('')) return ''
return tempat
}
export function bangunIndeks(daftarUpt) {
const entri = []
const hitungNama = new Map()
const hitungLintasJenis = new Map()
const hitungKabkota = new Map()
const hitungTokenJenis = new Map()
const KATA_PROVINSI = new Set()
for (const upt of daftarUpt) {
for (const kata of normalkanUpt(upt.provinsi || '').split(' ')) {
if (kata.length > 1) KATA_PROVINSI.add(kata)
}
}
let dariWilayah = 0
for (const upt of daftarUpt) {
const nama = upt.nama_upt
if (!nama) continue
let token = tokenPembeda(nama)
if (!token.length) {
token = normalkanUpt(upt.kabupaten_kota || upt.location_hint || '')
.split(' ')
.filter((t) => t.length > 1 && !KATA_UMUM.has(t))
if (!token.length) continue
dariWilayah += 1
}
const jenis = upt.jenis_upt || tebakJenis(nama)
const kunci = token.join(' ')
const kunciJenis = `${jenis}::${kunci}`
hitungNama.set(kunciJenis, (hitungNama.get(kunciJenis) || 0) + 1)
if (LINTAS_JENIS.has(jenis)) {
hitungLintasJenis.set(kunci, (hitungLintasJenis.get(kunci) || 0) + 1)
}
const petunjuk = normalkanUpt(upt.location_hint || '')
const kabkota = normalkanUpt(upt.kabupaten_kota || '').replace(/^(kota|kabupaten) /, '')
if (kabkota) hitungKabkota.set(kabkota, (hitungKabkota.get(kabkota) || 0) + 1)
for (const t of new Set(token)) {
const kunciToken = `${jenis}::${t}`
hitungTokenJenis.set(kunciToken, (hitungTokenJenis.get(kunciToken) || 0) + 1)
}
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
tempatRapat: tempatRapatDari(nama, token),
petunjuk: petunjuk && petunjuk !== kunci ? petunjuk : '',
sebutan: [],
})
}
for (const e of entri) {
e.bersaing = (hitungNama.get(e.kunciJenis) || 0) > 1
e.unikNasional = LINTAS_JENIS.has(e.jenis) && (hitungLintasJenis.get(e.kunci) || 0) === 1
e.kabkotaUnik = Boolean(e.kabkota) && (hitungKabkota.get(e.kabkota) || 0) === 1
e.tokenUnik = new Set(
e.token.filter((t) => (
t.length >= 6
&& !KATA_PROVINSI.has(t)
&& (hitungTokenJenis.get(`${e.jenis}::${t}`) || 0) === 1
)),
)
}
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
jumlahMasukan: daftarUpt.length,
tidakTerindeks: daftarUpt.length - entri.length,
dariWilayah,
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
const terpakai = new Map()
for (const [penanda, jenis] of PENANDA_JENIS) {
if (!terpakai.has(jenis)) terpakai.set(jenis, [])
const rentang = terpakai.get(jenis)
let dari = 0
for (;;) {
const posisi = teksNormal.indexOf(penanda, dari)
if (posisi === -1) break
dari = posisi + penanda.length
const sebelum = posisi === 0 ? ' ' : teksNormal[posisi - 1]
if (/[a-z0-9]/.test(sebelum)) continue
if (rentang.some(([a, b]) => posisi >= a && posisi < b)) continue
rentang.push([posisi, posisi + penanda.length])
const dekat = teksNormal.slice(posisi + penanda.length, posisi + penanda.length + JENDELA_LEMBAGA)
if (PENANDA_BUKAN_PAS.some((l) => cocokKata(dekat, l))) continue
const jendela = teksNormal.slice(posisi, posisi + penanda.length + JENDELA)
hasil.push({
jenis,
posisi,
panjangPenanda: penanda.length,
jendela,
rapat: runtunRapat(jendela),
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
const jenisSama = entri.jenis === w.jenis
const lintasJenisDiizinkan =
!jenisSama &&
entri.unikNasional &&
LINTAS_JENIS.has(entri.jenis) &&
LINTAS_JENIS.has(w.jenis)
if (!jenisSama && !lintasJenisDiizinkan) continue
const sebutanCocok = entri.sebutan.find((s) => cocokKata(w.jendela, s))
if (sebutanCocok) {
catat(entri, 0.94, 'sebutan-populer')
continue
}
if (entri.tempatRapat
&& (cocokKata(w.jendela, entri.tempatRapat) || w.rapat.has(entri.tempatRapat))) {
catat(entri, jenisSama ? 0.9 : 0.8, 'nama-tempat-rapat')
continue
}
const cocok = tokenYangCocok(w.jendela, entri.token, w.panjangPenanda, w.rapat)
if (!cocok.length) continue
if (cocok.every((t) => TOKEN_SUBJENIS.has(t))) continue
const rasio = cocok.length / entri.token.length
if (rasio === 1) {
const jarak = posisiTerawal(w.jendela, entri.token)
const kedekatan = Math.max(0, 1 - jarak / JENDELA)
const kekhususan = Math.min(1, (entri.token.length - 1) / 2)
const penuh = Math.min(0.99, 0.76 + 0.14 * kedekatan + 0.09 * kekhususan)
if (jenisSama) {
catat(entri, penuh, 'nama-lengkap')
} else {
catat(entri, Math.min(0.82, penuh - 0.1), 'nama-lintas-jenis')
}
continue
}
if (!jenisSama) continue
const tokenPanjangCocok = cocok.some((t) => t.length >= 5)
if (rasio < 0.5 || !tokenPanjangCocok) continue
let skor = 0.4 + 0.32 * rasio
if (entri.petunjuk && cocokKata(w.jendela, entri.petunjuk)) skor += 0.12
if (entri.kabkota && cocokKata(teksNormal, entri.kabkota)) skor += 0.08
if (entri.kelas && w.jendela.includes(`kelas ${entri.kelas}`)) skor += 0.1
if (entri.subjenis !== 'Umum' && cocokKata(w.jendela, normalkanUpt(entri.subjenis))) skor += 0.1
const adaTokenUnik = cocok.some((t) => entri.tokenUnik.has(t))
if (adaTokenUnik) skor += 0.16
catat(entri, Math.min(0.9, skor), adaTokenUnik ? 'nama-token-unik' : 'nama-sebagian')
}
}
const adaYangKuat = [...nilai.values()].some((v) => v.skor >= AMBANG_OTOMATIS)
if (!adaYangKuat) {
for (const w of jendela) {
for (const entri of indeks.entri) {
if (entri.jenis !== w.jenis) continue
if (!entri.kabkotaUnik) continue
if (entri.token.some((t) => cocokKata(w.jendela, t))) continue
if (!cocokKata(w.jendela, entri.kabkota)) continue
catat(entri, 0.78, 'wilayah-kabkota')
}
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
function tokenYangCocok(jendela, token, batasAwal = 0, rapatJendela = null) {
const terpakai = new Array(token.length).fill(false)
const rapat = rapatJendela || runtunRapat(jendela)
const adaDiJendela = (kata) => cocokKataLonggar(jendela, kata, batasAwal) || rapat.has(kata)
for (let panjang = token.length; panjang >= 2; panjang -= 1) {
for (let mulai = 0; mulai + panjang <= token.length; mulai += 1) {
let adaYangKosong = false
for (let i = mulai; i < mulai + panjang; i += 1) if (!terpakai[i]) adaYangKosong = true
if (!adaYangKosong) continue
const rapat = token.slice(mulai, mulai + panjang).join('')
if (!adaDiJendela(rapat)) continue
for (let i = mulai; i < mulai + panjang; i += 1) terpakai[i] = true
}
}
for (let i = 0; i < token.length; i += 1) {
if (terpakai[i]) continue
const t = token[i]
if (KATA_DALAM_PENANDA.has(t)) {
const p = posisiKata(jendela, t)
if (p >= batasAwal) terpakai[i] = true
continue
}
if (t.length >= 7 ? adaDiJendela(t) : cocokKata(jendela, t)) terpakai[i] = true
}
return token.filter((_, i) => terpakai[i])
}
function runtunRapat(jendela) {
const kata = jendela.split(' ').filter(Boolean)
const hasil = new Set()
for (let i = 0; i < kata.length; i += 1) {
let gabung = ''
for (let n = 0; n < 4 && i + n < kata.length; n += 1) {
gabung += kata[i + n]
if (n >= 1 && gabung.length >= 7) hasil.add(gabung)
}
}
return hasil
}
function posisiKata(haystack, kata) {
if (!kata) return -1
let dari = 0
for (;;) {
const p = haystack.indexOf(kata, dari)
if (p === -1) return -1
const sebelum = p === 0 ? ' ' : haystack[p - 1]
const sesudah = haystack[p + kata.length] ?? ' '
if (!/[a-z0-9]/.test(sebelum) && !/[a-z0-9]/.test(sesudah)) return p
dari = p + 1
}
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
function cocokKataLonggar(haystack, kata, batasAwal = 0) {
if (cocokKata(haystack, kata)) return true
if (kata.length < 7) return false
let posisi = 0
for (const potong of haystack.split(' ')) {
if (posisi >= batasAwal && miripSatuHuruf(potong, kata)) return true
posisi += potong.length + 1
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
if (otomatis && juara.metode === 'nama-lintas-jenis') {
return `${juara.entri.nama} dikenali dari nama tempatnya. Teks menyebut jenis unit yang `
+ `berbeda, tetapi nama itu hanya dipakai satu unit di seluruh Indonesia.`
}
if (otomatis && juara.metode === 'wilayah-kabkota') {
return `${juara.entri.nama} dikenali dari nama kabupaten/kota yang disebut; `
+ `unit ini satu-satunya di wilayah tersebut.`
}
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
export const META_PENCOCOK = { versi: 'kedekatan-v2.2', ambangOtomatis: AMBANG_OTOMATIS, ambangSaran: AMBANG_SARAN }
