export const EMBER = [
{
kode: 'negatif',
label: 'Negatif',
simpan: 'Negatif',
nada: 'kritis',
nilai: ['Negatif'],
ringkas: 'Merugikan institusi',
keterangan: 'Pemberitaan yang menurunkan kepercayaan publik atau menyudutkan '
+ 'institusi dan petugas: insiden di dalam lapas, dugaan pelanggaran, keluhan '
+ 'keluarga warga binaan, dan kritik kebijakan.',
petunjuk: 'Termasuk berita yang bahasanya datar tetapi akibatnya merugikan bila menyebar.',
},
{
kode: 'netral',
label: 'Netral / Campuran',
simpan: 'Netral',
nada: 'netral',
nilai: ['Netral', 'Campuran'],
ringkas: 'Tidak condong ke salah satu sisi',
keterangan: 'Kabar faktual tanpa arah untung-rugi yang jelas — agenda, kunjungan, '
+ 'angka statistik — atau yang memuat kedua sisi sekaligus, misalnya insiden yang '
+ 'langsung diikuti penindakan tegas.',
petunjuk: 'Bila ragu antara ember ini dan Negatif, pilih Negatif. '
+ 'Melewatkan isu negatif lebih mahal daripada menelaah ulang satu berita netral.',
},
{
kode: 'positif',
label: 'Positif',
simpan: 'Positif',
nada: 'positif',
nilai: ['Positif'],
ringkas: 'Menguatkan institusi',
keterangan: 'Capaian, layanan, program pembinaan, dan apresiasi dari pihak luar. '
+ 'Inilah bahan penyeimbang yang dipakai laporan berkala ketika isu negatif '
+ 'sedang ramai.',
petunjuk: 'Publikasi humas UPT hampir selalu masuk ke sini.',
},
]
export const BELUM = {
kode: 'belum',
label: 'Belum dinilai',
simpan: 'Tidak diketahui',
nada: 'rendah',
nilai: ['Tidak diketahui'],
ringkas: 'Menunggu mesin atau analis',
keterangan: 'Berita baru masuk dan belum pernah dinilai mesin klasifikasi maupun analis.',
petunjuk: '',
}
export const NILAI_TERSIMPAN = ['Positif', 'Netral', 'Campuran', 'Negatif', 'Tidak diketahui']
const PETA_NILAI = new Map()
for (const e of EMBER) for (const n of e.nilai) PETA_NILAI.set(n.toLowerCase(), e.kode)
for (const n of BELUM.nilai) PETA_NILAI.set(n.toLowerCase(), BELUM.kode)
export function ember(sumber) {
const nilai = typeof sumber === 'string' ? sumber : sumber?.sentimen
if (!nilai) return BELUM.kode
return PETA_NILAI.get(String(nilai).trim().toLowerCase()) || BELUM.kode
}
export function emberDari(kode) {
return EMBER.find((e) => e.kode === kode) || BELUM
}
export function labelEmber(kode) { return emberDari(kode).label }
export function nadaEmber(kode) { return emberDari(kode).nada }
export function beremberkan(berita, kode) {
return ember(berita) === kode
}
export function nilaiSimpan(kode, nilaiSekarang) {
const e = emberDari(kode)
if (nilaiSekarang && ember(nilaiSekarang) === kode && e.nilai.includes(nilaiSekarang)) {
return nilaiSekarang
}
return e.simpan
}
export function hitungEmber(daftar = []) {
const hasil = { negatif: 0, netral: 0, positif: 0, belum: 0, total: 0 }
for (const b of daftar) {
hasil[ember(b)] += 1
hasil.total += 1
}
return hasil
}
