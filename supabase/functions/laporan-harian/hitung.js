import { ember, hitungEmber } from './sentimen.js'
import { tanggalIso } from './format.js'
import { belumTerpetakan } from './unit-terpetakan.js'
export const STATUS_DIKECUALIKAN = ['Tidak Valid', 'Diarsipkan']
export const STATUS_ANTREAN = ['Belum Ditelaah', 'Perlu Koreksi']
export const TELAAH_WILAYAH = [
{ kode: 'Sesuai', nada: 'positif', ket: 'Penilaian mesin sudah tepat menurut unit yang bersangkutan.' },
{ kode: 'Direvisi', nada: 'sedang', ket: 'Penilaian mesin diperbaiki. Alasannya wajib ditulis.' },
{ kode: 'Bukan Unit Kami', nada: 'rendah', ket: 'Kabar ini tidak menyangkut unit atau wilayah ini.' },
{ kode: 'Perlu Perhatian', nada: 'kritis', ket: 'Benar, dan menuntut tindakan di luar telaah.' },
]
export const SIKAP_TANGGAPAN = [
{ kode: 'Dibenarkan', nada: 'sedang', ket: 'Isi berita sesuai dengan keadaan di unit.' },
{ kode: 'Sebagian Benar', nada: 'sedang', ket: 'Ada bagian yang benar dan ada yang keliru; sebutkan yang mana.' },
{ kode: 'Tidak Benar', nada: 'kritis', ket: 'Isi berita tidak sesuai keadaan di unit.' },
{ kode: 'Sudah Ditangani', nada: 'positif', ket: 'Benar, dan tindakannya sudah diambil unit.' },
]
export function menungguTelaahWilayah(b) {
if (!b || diLuarLingkup(b) || dikecualikan(b)) return false
const s = b.telaah_wilayah_status
return !s || s === 'Belum Ditelaah'
}
export function sudahDitanggapi(b) {
return Boolean(b?.tanggapan_sikap || String(b?.tanggapan_upt || '').trim())
}
export const URGENSI_MENDESAK = ['Tinggi', 'Kritis']
export function diLuarLingkup(b) {
return b?.kategori === 'Di Luar Lingkup'
}
export function dikecualikan(b) {
return STATUS_DIKECUALIKAN.includes(b?.status_verifikasi)
}
export function menungguTelaah(b) {
if (!b || diLuarLingkup(b) || dikecualikan(b)) return false
const s = b.status_verifikasi
return !s || STATUS_ANTREAN.includes(s)
}
export const KERAWANAN = [
{
kode: 'kritis',
label: 'Kritis',
nada: 'kritis',
ket: 'Ada berita berurgensi kritis, atau enam berita negatif atau lebih.',
},
{
kode: 'rawan',
label: 'Rawan',
nada: 'sedang',
ket: 'Ada berita berurgensi tinggi, atau tiga berita negatif atau lebih.',
},
{
kode: 'waspada',
label: 'Waspada',
nada: 'rendah',
ket: 'Ada berita negatif, tetapi belum ada yang mendesak.',
},
{
kode: 'aman',
label: 'Terkendali',
nada: 'positif',
ket: 'Ada pemberitaan, dan tidak satu pun bersentimen negatif.',
},
{
kode: 'sepi',
label: 'Tanpa pemberitaan',
nada: 'netral',
ket: 'Belum ada satu pun berita yang terpetakan ke unit ini.',
},
]
export function tingkatKerawanan(daftar = []) {
const inti = dasar(daftar)
if (!inti.length) return KERAWANAN.find((k) => k.kode === 'sepi')
const negatif = inti.filter((b) => ember(b) === 'negatif').length
const kritis = inti.some((b) => b.urgensi === 'Kritis')
const tinggi = inti.some((b) => b.urgensi === 'Tinggi')
const kode = (kritis || negatif >= 6) ? 'kritis'
: (tinggi || negatif >= 3) ? 'rawan'
: negatif >= 1 ? 'waspada'
: 'aman'
return KERAWANAN.find((k) => k.kode === kode)
}
export function dasar(daftar = []) {
return daftar.filter((b) => !diLuarLingkup(b) && !dikecualikan(b))
}
export function ringkasan(daftar = [], sekarang = new Date()) {
const semua = daftar || []
const inti = dasar(semua)
const hariIniIso = tanggalIso(sekarang)
const kemarinIso = tanggalIso(new Date(sekarang.getTime() - 86_400_000))
const perEmber = hitungEmber(inti)
const daftarMendesak = inti.filter((b) => URGENSI_MENDESAK.includes(b.urgensi))
return {
inti,
total: inti.length,
negatif: inti.filter((b) => ember(b) === 'negatif'),
netral: inti.filter((b) => ember(b) === 'netral'),
positif: inti.filter((b) => ember(b) === 'positif'),
belumDinilai: inti.filter((b) => ember(b) === 'belum'),
perEmber,
mendesak: daftarMendesak,
kritis: daftarMendesak.filter((b) => b.urgensi === 'Kritis'),
antrean: inti.filter(menungguTelaah),
takTerpetakan: inti.filter((b) => belumTerpetakan(b.nama_upt)),
antreanWilayah: inti.filter(menungguTelaahWilayah),
ditanggapi: inti.filter(sudahDitanggapi),
hariIni: inti.filter((b) => tanggalIso(b.created_at) === hariIniIso),
kemarin: inti.filter((b) => tanggalIso(b.created_at) === kemarinIso),
luarLingkup: semua.filter(diLuarLingkup).length,
dikecualikan: semua.filter((b) => !diLuarLingkup(b) && dikecualikan(b)).length,
seluruhBaris: semua.length,
}
}
export function lencana(daftar = []) {
const r = ringkasan(daftar)
return {
peringatan: r.mendesak.length,
telaah: r.antrean.length,
negatif: r.negatif.length,
pemetaan: r.takTerpetakan.length,
telaahWilayah: r.antreanWilayah.length,
}
}
export function hariBerita(b) {
return String(b?.tanggal_publikasi || b?.tanggal || b?.created_at || '').slice(0, 10)
}
export function uptNaik(daftar = [], { mulai, selesai, maks = 10 } = {}) {
const inti = dasar(daftar)
if (!mulai || !selesai) return []
const satuHari = 86_400_000
const awal = new Date(`${mulai}T00:00:00Z`)
const akhir = new Date(`${selesai}T00:00:00Z`)
const panjang = Math.max(1, Math.round((akhir - awal) / satuHari) + 1)
const mulaiSebelum = new Date(awal.getTime() - panjang * satuHari).toISOString().slice(0, 10)
const selesaiSebelum = new Date(awal.getTime() - satuHari).toISOString().slice(0, 10)
const dalam = (b, a, z) => {
const h = hariBerita(b)
return h >= a && h <= z
}
const kini = new Map()
const lalu = new Map()
for (const b of inti) {
if (belumTerpetakan(b.nama_upt)) continue
if (dalam(b, mulai, selesai)) {
const baris = kini.get(b.nama_upt) || { nama: b.nama_upt, jumlah: 0, negatif: 0 }
baris.jumlah += 1
if (ember(b) === 'negatif') baris.negatif += 1
kini.set(b.nama_upt, baris)
} else if (dalam(b, mulaiSebelum, selesaiSebelum)) {
lalu.set(b.nama_upt, (lalu.get(b.nama_upt) || 0) + 1)
}
}
return [...kini.values()]
.map((u) => {
const sebelum = lalu.get(u.nama) || 0
return { ...u, sebelum, delta: u.jumlah - sebelum }
})
.sort((a, b) => b.jumlah - a.jumlah || b.delta - a.delta || a.nama.localeCompare(b.nama))
.slice(0, maks)
}
export function periodeSebelum(mulai, selesai) {
const satuHari = 86_400_000
const awal = new Date(`${mulai}T00:00:00Z`)
const akhir = new Date(`${selesai}T00:00:00Z`)
const panjang = Math.max(1, Math.round((akhir - awal) / satuHari) + 1)
return {
mulai: new Date(awal.getTime() - panjang * satuHari).toISOString().slice(0, 10),
selesai: new Date(awal.getTime() - satuHari).toISOString().slice(0, 10),
}
}
export function deretTren(daftar = [], { mulai, selesai } = {}) {
const inti = dasar(daftar)
const ember2 = new Map()
const satuHari = 86_400_000
const awal = new Date(`${mulai}T00:00:00Z`)
const akhir = new Date(`${selesai}T00:00:00Z`)
for (let t = awal.getTime(); t <= akhir.getTime(); t += satuHari) {
const iso = new Date(t).toISOString().slice(0, 10)
ember2.set(iso, { tanggal: iso, total: 0, negatif: 0, mendesak: 0 })
}
for (const b of inti) {
const e = ember2.get(hariBerita(b))
if (!e) continue
e.total += 1
if (ember(b) === 'negatif') e.negatif += 1
if (URGENSI_MENDESAK.includes(b.urgensi)) e.mendesak += 1
}
return [...ember2.values()]
}
export function bandingPeriode(daftar = [], { mulai, selesai } = {}) {
const inti = dasar(daftar)
const lalu = periodeSebelum(mulai, selesai)
const potong = (a, z) => inti.filter((b) => {
const h = hariBerita(b)
return h >= a && h <= z
})
const hitung = (kumpulan) => ({
publikasi: kumpulan.length,
negatif: kumpulan.filter((b) => ember(b) === 'negatif').length,
mendesak: kumpulan.filter((b) => URGENSI_MENDESAK.includes(b.urgensi)).length,
unit: new Set(kumpulan.filter((b) => !belumTerpetakan(b.nama_upt)).map((b) => b.nama_upt)).size,
media: new Set(kumpulan.map((b) => b.media).filter(Boolean)).size,
})
return {
periode: { mulai, selesai },
sebelum: { ...lalu },
kini: hitung(potong(mulai, selesai)),
lalu: hitung(potong(lalu.mulai, lalu.selesai)),
daftarKini: potong(mulai, selesai),
daftarLalu: potong(lalu.mulai, lalu.selesai),
}
}
export function pergeseran(kini = [], lalu = [], bidang = 'subkategori', maks = 8) {
const hitung = (kumpulan) => {
const peta = new Map()
for (const b of kumpulan) {
const k = b[bidang]
if (!k) continue
peta.set(k, (peta.get(k) || 0) + 1)
}
return peta
}
const a = hitung(kini)
const z = hitung(lalu)
const nama = new Set([...a.keys(), ...z.keys()])
return [...nama]
.map((n) => {
const jumlah = a.get(n) || 0
const sebelum = z.get(n) || 0
return { nama: n, jumlah, sebelum, delta: jumlah - sebelum }
})
.filter((b) => b.jumlah > 0 || b.sebelum > 0)
.sort((x, y) => y.delta - x.delta || y.jumlah - x.jumlah)
.slice(0, maks)
}
export function deretEmpatBelasHari(daftar = [], hari = 14, acuan = new Date()) {
const satuHari = 86_400_000
const selesai = new Date(acuan)
const mulai = new Date(acuan.getTime() - (hari - 1) * satuHari)
return deretTren(daftar, {
mulai: mulai.toISOString().slice(0, 10),
selesai: selesai.toISOString().slice(0, 10),
})
}
