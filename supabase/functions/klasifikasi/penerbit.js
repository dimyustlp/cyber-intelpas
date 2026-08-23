const POLA_AKUN = [
/\[([^\]]+)\]/,
/^([^(]+)\s*\((?:instagram|facebook|tiktok|x|twitter|youtube)\)/i,
/\(@([^)]+)\)/,
]
const PENYISIRAN = [
'radar medsos', 'medsos radar', 'social dorking', 'dorking',
'tiktok radar', 'radar sosmed', 'sosmed radar',
]
const PENANDA_INSTITUSI = [
'lapas', 'rutan', 'bapas', 'lpka', 'lpp', 'ditjenpas', 'ditjen pas',
'kemenimipas', 'pemasyarakatan', 'humas lapas', 'humas rutan',
'kanwil', 'lembaga pemasyarakatan', 'rumah tahanan', 'balai pemasyarakatan',
'imipas',
]
const PENANDA_TEKS_RESMI = [
'kemenimipas', 'ditjenpas', 'ditjen pas', 'guardandguide', 'guard and guide',
'infoimipas', 'imipasprima', 'sobat pas', 'sobatpas', 'tim humas',
'humas lapas', 'humas rutan', 'humas bapas', 'kitamulaicarabaru',
'pemasyarakatan', 'wbbm', 'wbk', 'zona integritas',
]
const POLA_TANDA_AKUN =
/\b(lapas|rutan|bapas|lpka|lpp|kanwil|humas|ditjenpas|kemenimipas|pemasyarakatan)[a-z0-9]{4,}\b/
const POLA_ATRIBUSI =
/\b(photos?|reels?|videos?|posts?|story|stories)\s+(by|from|with)\s+(lapas|rutan|bapas|lpka|lpp|kanwil|ditjen)/
const INSTANSI_LAIN = [
'polres', 'polda', 'polsek', 'polri', 'mabes', 'bareskrim', 'brimob',
'kejari', 'kejati', 'kejagung', 'kejaksaan', 'bnn', 'bnnp', 'bnnk',
'damkar', 'samsat', 'dishub', 'bpbd', 'satpol', 'kodim', 'korem', 'pomdam',
'imigrasi', 'bea cukai', 'beacukai', 'pemkab', 'pemkot', 'pemprov',
]
const POLA_MEDIA_MASSA =
/(\.com|\.co\.id|\.id|\.net|\.org|kompas|detik|tribun|antara|liputan|republika|tempo|okezone|sindo|jpnn|suara|merdeka|inews|viva|kumparan|radar\s+\w+|pos\b|harian|berita|news)/i
function normal(nilai) {
return String(nilai ?? '')
.toLowerCase()
.normalize('NFD')
.replace(/[̀-ͯ]/g, '')
.replace(/[^a-z0-9\s]/g, ' ')
.replace(/\s+/g, ' ')
.trim()
}
export function namaAkun(media) {
const teks = String(media ?? '').trim()
if (!teks) return ''
for (const pola of POLA_AKUN) {
const cocok = teks.match(pola)
if (cocok) return cocok[1].trim()
}
return teks
}
function memuatPenanda(teks, daftar) {
for (const p of daftar) if (teks.includes(p)) return p
return null
}
export function kenaliPenerbit(berita = {}, teksNormal = '') {
const mediaAsli = String(berita.media ?? '')
const media = normal(mediaAsli)
const akun = namaAkun(mediaAsli)
const akunNormal = normal(akun)
const instansiLain = memuatPenanda(akunNormal, INSTANSI_LAIN)
if (!instansiLain && !memuatPenanda(media, PENYISIRAN)) {
const penandaAkun = memuatPenanda(akunNormal, PENANDA_INSTITUSI)
if (penandaAkun) {
return {
jenis: 'institusi',
akun,
resmi: true,
alasan: `Diterbitkan akun "${akun}", yang menyebut dirinya unit Pemasyarakatan.`,
}
}
const tandaAkun = akunNormal.replace(/\s+/g, '').match(POLA_TANDA_AKUN)
if (tandaAkun) {
return {
jenis: 'institusi',
akun,
resmi: true,
alasan: `Diterbitkan akun "${akun}", yang bentuk namanya adalah nama akun unit Pemasyarakatan.`,
}
}
}
if (memuatPenanda(media, PENYISIRAN)) {
const penandaTeks = memuatPenanda(teksNormal, PENANDA_TEKS_RESMI)
if (penandaTeks) {
return {
jenis: 'institusi',
akun: akun || 'akun media sosial',
resmi: true,
alasan: `Hasil penyisiran media sosial yang memuat penanda kampanye resmi "${penandaTeks}".`,
}
}
const tandaAkun = teksNormal.match(POLA_TANDA_AKUN)
if (tandaAkun) {
return {
jenis: 'institusi',
akun: tandaAkun[0],
resmi: true,
alasan: `Hasil penyisiran media sosial yang membubuhkan nama akun unit "${tandaAkun[0]}".`,
}
}
if (POLA_ATRIBUSI.test(teksNormal)) {
return {
jenis: 'institusi',
akun: akun || 'akun unit',
resmi: true,
alasan: 'Hasil penyisiran media sosial yang menyalin unggahan dari akun sebuah unit.',
}
}
return {
jenis: 'penyisiran',
akun: akun || 'akun media sosial',
resmi: false,
alasan: 'Hasil penyisiran media sosial tanpa penanda penerbit resmi.',
}
}
if (POLA_MEDIA_MASSA.test(mediaAsli)) {
return { jenis: 'media_massa', akun, resmi: false, alasan: `Diterbitkan media "${akun}".` }
}
return { jenis: 'tidak_dikenal', akun, resmi: false, alasan: 'Penerbit tidak dikenali.' }
}
export const META_PENERBIT = { versi: 'penerbit-v1.0' }
