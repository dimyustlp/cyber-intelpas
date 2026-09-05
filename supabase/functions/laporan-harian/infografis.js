import { dasar, ringkasan } from './hitung.js'
import { ember } from './sentimen.js'
import { TEMA_LAPORAN, temaLaporan } from './taksonomi.js'
import { kelompokkanPeristiwa, rapikanJudul, sumberAsli } from './peristiwa.js'
import { namaPenerbitTampil } from './penerbit.js'
import { bersihkanTeks } from './teks.js'
import { belumTerpetakan } from './unit-terpetakan.js'
function teksBersih(nilai, cadangan = '') {
const bersih = bersihkanTeks(nilai)
return bersih || bersihkanTeks(cadangan)
}
export const MUAT = {
media: 5,
provinsi: 5,
contoh: 6,
sorotan: 4,
garisWaktu: 3,
}
const BULAN = [
'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
function pecah(iso) {
const [t, b, h] = String(iso || '').slice(0, 10).split('-').map(Number)
return { tahun: t, bulan: b, hari: h }
}
export function hariIso(b) {
const nilai = b?.tanggal_publikasi || b?.created_at || b?.detected_at
if (!nilai) return ''
const d = new Date(nilai)
if (Number.isNaN(d.getTime())) return String(nilai).slice(0, 10)
return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}
export function labelPeriode(mulai, selesai) {
const a = pecah(mulai)
const b = pecah(selesai)
if (!a.tahun || !b.tahun) return ''
if (mulai === selesai) return `${a.hari} ${BULAN[a.bulan - 1]} ${a.tahun}`
if (a.tahun !== b.tahun) {
return `${a.hari} ${BULAN[a.bulan - 1]} ${a.tahun} – ${b.hari} ${BULAN[b.bulan - 1]} ${b.tahun}`
}
if (a.bulan !== b.bulan) {
return `${a.hari} ${BULAN[a.bulan - 1]} – ${b.hari} ${BULAN[b.bulan - 1]} ${b.tahun}`
}
return `${a.hari} – ${b.hari} ${BULAN[b.bulan - 1]} ${b.tahun}`
}
export function tanggalPendek(iso) {
const { bulan, hari } = pecah(iso)
if (!bulan) return ''
return `${hari} ${BULAN_SINGKAT[bulan - 1]}`
}
export function indeksUnit(daftarUnit = []) {
const peta = new Map()
for (const u of daftarUnit) {
const nama = String(u?.nama_upt ?? u?.nama ?? '').trim()
if (!nama) continue
peta.set(nama.toLowerCase(), {
nama,
jenis: String(u.jenis_upt ?? u.jenis ?? '').trim(),
provinsi: String(u.provinsi ?? '').trim(),
kanwil: String(u.kanwil ?? '').trim(),
})
}
return peta
}
export function jenisUnit(berita, indeks) {
const nama = String(berita?.nama_upt ?? '').trim()
if (!nama || belumTerpetakan(nama)) return ''
const induk = indeks?.get(nama.toLowerCase())
if (induk?.jenis) {
const j = induk.jenis.toLowerCase()
if (j.includes('lpka')) return 'LPKA'
if (j.includes('bapas')) return 'Bapas'
if (j.includes('rutan')) return 'Rutan'
if (j.includes('lapas') || j.includes('lpp')) return 'Lapas'
}
const n = nama.toLowerCase()
if (n.includes('lpka')) return 'LPKA'
if (n.includes('bapas')) return 'Bapas'
if (n.includes('rutan') || n.includes('rumah tahanan')) return 'Rutan'
if (n.includes('lapas') || n.includes('lembaga pemasyarakatan') || n.includes('lpp')) return 'Lapas'
return ''
}
export function provinsiBerita(berita, indeks) {
const langsung = String(berita?.provinsi ?? '').trim()
if (langsung) return langsung
const nama = String(berita?.nama_upt ?? '').trim()
if (!nama || belumTerpetakan(nama)) return ''
return indeks?.get(nama.toLowerCase())?.provinsi || ''
}
export function emberDominan(daftar = []) {
const hitung = { negatif: 0, netral: 0, positif: 0, belum: 0 }
for (const b of daftar) hitung[ember(b)] += 1
if (!daftar.length) return 'belum'
let menang = 'belum'
let terbanyak = -1
for (const kode of ['negatif', 'netral', 'positif', 'belum']) {
if (hitung[kode] > terbanyak) { terbanyak = hitung[kode]; menang = kode }
}
return menang
}
function persenBulat(bagian, total) {
if (!total) return 0
return Math.round((bagian / total) * 1000) / 10
}
function ringkasTema(tema, daftar) {
const per = new Map()
for (const b of daftar) {
const nama = String(b.subkategori || '').trim()
if (!nama) continue
per.set(nama, (per.get(nama) || 0) + 1)
}
const urut = [...per.entries()].sort((a, b) => b[1] - a[1]).map(([nama]) => nama)
if (!urut.length) return tema.ringkasBaku.slice()
if (urut.length === 1) return [urut[0], tema.ringkasBaku[1]]
return urut.slice(0, 2)
}
export function rekapTema(inti) {
const per = new Map()
let takBertema = 0
for (const b of inti) {
const t = temaLaporan(b)
if (!t) { takBertema += 1; continue }
if (!per.has(t.kode)) per.set(t.kode, [])
per.get(t.kode).push(b)
}
const hasil = []
for (const tema of TEMA_LAPORAN) {
const daftar = per.get(tema.kode)
if (!daftar?.length) continue
hasil.push({
kode: tema.kode,
nama: tema.nama,
warna: tema.warna,
ikon: tema.ikon,
jumlah: daftar.length,
persen: persenBulat(daftar.length, inti.length),
ringkas: ringkasTema(tema, daftar),
berita: daftar,
})
}
hasil.sort((a, b) => b.jumlah - a.jumlah)
return { tema: hasil, takBertema }
}
export function rekapMedia(inti) {
const per = new Map()
for (const b of inti) {
const nama = namaPenerbitTampil(b, sumberAsli(b))
per.set(nama, (per.get(nama) || 0) + 1)
}
const urut = [...per.entries()]
.map(([nama, jumlah]) => ({ nama, jumlah }))
.sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, 'id'))
const teratas = urut.slice(0, MUAT.media)
const sisa = urut.slice(MUAT.media)
const lainnya = sisa.reduce((n, m) => n + m.jumlah, 0)
return { teratas, lainnya, jumlahPenerbit: urut.length }
}
export function rekapWilayah(inti, indeks, indukProvinsi = {}) {
const per = new Map()
let tanpaProvinsi = 0
for (const b of inti) {
const prov = provinsiBerita(b, indeks)
if (!prov) { tanpaProvinsi += 1; continue }
if (!per.has(prov)) per.set(prov, [])
per.get(prov).push(b)
}
const provinsi = [...per.entries()]
.map(([nama, daftar]) => ({
nama,
jumlah: daftar.length,
dominan: emberDominan(daftar),
negatif: daftar.filter((b) => ember(b) === 'negatif').length,
}))
.sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama, 'id'))
const perBentuk = new Map()
for (const [nama, daftar] of per) {
const bentuk = indukProvinsi[nama] || nama
if (!perBentuk.has(bentuk)) perBentuk.set(bentuk, [])
perBentuk.get(bentuk).push(...daftar)
}
const bentuk = new Map()
for (const [nama, daftar] of perBentuk) {
bentuk.set(nama, { jumlah: daftar.length, dominan: emberDominan(daftar) })
}
const perEmber = { negatif: 0, netral: 0, positif: 0, belum: 0 }
for (const p of provinsi) perEmber[p.dominan] += 1
return {
provinsi,
teratas: provinsi.slice(0, MUAT.provinsi),
perBentuk: bentuk,
perEmber,
tanpaProvinsi,
jumlahProvinsi: provinsi.length,
}
}
export function contohBerita(rekap, maks = MUAT.contoh, indeks = null) {
const kartu = []
for (const t of rekap) {
const terbaru = t.berita
.slice()
.sort((a, b) => String(hariIso(b)).localeCompare(String(hariIso(a))))[0]
if (!terbaru) continue
kartu.push({
judul: rapikanJudul(teksBersih(terbaru.judul)) || '(tanpa judul)',
upt: terbaru.nama_upt || '',
provinsi: provinsiBerita(terbaru, indeks) || '',
tanggal: hariIso(terbaru),
tema: t.kode,
warna: t.warna,
ikon: t.ikon,
ember: ember(terbaru),
})
if (kartu.length >= maks) break
}
return kartu.sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))
}
export function butirSorotan(rekap, peristiwaNegatif, maks = MUAT.sorotan) {
const butir = []
for (const t of rekap.slice(0, maks - 1)) {
butir.push({
nada: 'baik',
teks: `${t.ringkas[0]} — ${t.jumlah} berita (${t.persen}%) pada tema ${t.nama}.`,
})
}
const teratas = peristiwaNegatif[0]
if (teratas) {
const unit = teratas.nama_upt && !belumTerpetakan(teratas.nama_upt) ? ` di ${teratas.nama_upt}` : ''
butir.push({
nada: 'awas',
teks: `${teratas.subkategori}${unit} menjadi sorotan: `
+ `${teratas.jumlah_publikasi} publikasi dari ${teratas.jumlah_media} media.`,
})
}
return butir.slice(0, maks)
}
export function isuSorotan(peristiwaNegatif) {
const utama = peristiwaNegatif[0]
if (!utama) return null
const garisWaktu = utama.publikasi
.slice()
.sort((a, b) => String(hariIso(a)).localeCompare(String(hariIso(b))))
.map((b) => ({
tanggal: hariIso(b),
teks: teksBersih(b.ringkasan, b.judul) || rapikanJudul(String(b.judul || '')),
sumber: namaPenerbitTampil(b, sumberAsli(b)),
}))
const perHari = new Map()
for (const g of garisWaktu) if (!perHari.has(g.tanggal)) perHari.set(g.tanggal, g)
return {
judul: utama.subkategori || 'Isu sorotan',
unit: utama.nama_upt && !belumTerpetakan(utama.nama_upt) ? utama.nama_upt : '',
jumlahPublikasi: utama.jumlah_publikasi,
jumlahMedia: utama.jumlah_media,
garisWaktu: [...perHari.values()].slice(-MUAT.garisWaktu),
}
}
export function kalimatKesimpulan({ sentimen, tema, sorotan }) {
const kalimat = []
const temaTeratas = tema.slice(0, 3).map((t) => t.nama.split(/[,&]/)[0].trim().toLowerCase())
if (sentimen.positif >= sentimen.negatif + sentimen.netral) {
kalimat.push({
nada: 'baik',
teks: `Pemberitaan didominasi sentimen positif (${sentimen.persen.positif}%), `
+ `dengan fokus pada ${temaTeratas.join(', ')}.`,
})
} else if (sentimen.negatif > sentimen.positif) {
kalimat.push({
nada: 'awas',
teks: `Pemberitaan condong negatif (${sentimen.persen.negatif}%), `
+ `terutama pada ${temaTeratas.slice(0, 2).join(' dan ')}.`,
})
} else {
kalimat.push({
nada: 'netral',
teks: `Pemberitaan berimbang: ${sentimen.persen.positif}% positif, `
+ `${sentimen.persen.negatif}% negatif, dengan fokus pada ${temaTeratas.join(', ')}.`,
})
}
if (sorotan) {
const dampak = sentimen.negatif <= 3 ? 'jumlahnya kecil' : 'jumlahnya tidak kecil'
kalimat.push({
nada: 'awas',
teks: `Meski ${dampak}, isu ${sorotan.judul.toLowerCase()}`
+ `${sorotan.unit ? ` di ${sorotan.unit}` : ''} berdampak reputasi tinggi `
+ 'dan perlu perhatian serta komunikasi publik yang transparan.',
})
} else {
kalimat.push({
nada: 'baik',
teks: 'Tidak ada isu negatif yang menonjol pada periode ini; '
+ 'pengawasan rutin dilanjutkan tanpa penanganan khusus.',
})
}
return kalimat
}
export function susunInfografis({
berita = [],
unit = [],
mulai,
selesai,
jenis = 'harian',
indukProvinsi = {},
} = {}) {
const indeks = indeksUnit(unit)
const angka = ringkasan(berita)
const inti = dasar(berita)
const sentimen = {
negatif: angka.negatif.length,
netral: angka.netral.length,
positif: angka.positif.length,
belum: angka.belumDinilai.length,
total: inti.length,
persen: {
negatif: persenBulat(angka.negatif.length, inti.length),
netral: persenBulat(angka.netral.length, inti.length),
positif: persenBulat(angka.positif.length, inti.length),
belum: persenBulat(angka.belumDinilai.length, inti.length),
},
}
const perJenis = { Lapas: 0, Rutan: 0, LPKA: 0, Bapas: 0, '': 0 }
for (const b of inti) perJenis[jenisUnit(b, indeks)] += 1
const wilayah = rekapWilayah(inti, indeks, indukProvinsi)
const media = rekapMedia(inti)
const { tema, takBertema } = rekapTema(inti)
const peristiwaNegatif = kelompokkanPeristiwa(inti.filter((b) => ember(b) === 'negatif'))
.sort((a, b) => b.jumlah_media - a.jumlah_media || b.jumlah_publikasi - a.jumlah_publikasi)
const sorotan = isuSorotan(peristiwaNegatif)
return {
jenis,
periode: { mulai, selesai, label: labelPeriode(mulai, selesai) },
ikhtisar: {
total: inti.length,
lapas: perJenis.Lapas,
rutan: perJenis.Rutan,
lpka: perJenis.LPKA,
bapas: perJenis.Bapas,
tanpaUnit: perJenis[''],
persenLapas: persenBulat(perJenis.Lapas, inti.length),
persenRutan: persenBulat(perJenis.Rutan, inti.length),
provinsi: wilayah.jumlahProvinsi,
media: media.jumlahPenerbit,
},
sentimen,
media,
wilayah,
tema,
takBertema,
sorotanButir: butirSorotan(tema, peristiwaNegatif),
isuKhusus: sorotan,
contoh: contohBerita(tema, MUAT.contoh, indeks),
kesimpulan: kalimatKesimpulan({ sentimen, tema, sorotan }),
dikecualikan: {
luarLingkup: angka.luarLingkup,
tidakValid: angka.dikecualikan,
seluruhBaris: angka.seluruhBaris,
},
}
}
export const META_INFOGRAFIS = { versi: 'infografis-v1.0' }
