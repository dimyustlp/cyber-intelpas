export const NILAI_TAK_TERPETAKAN = new Set([
'', 'belum teridentifikasi', 'tidak diketahui', 'null', 'none', 'nan', '-', 'undefined',
])
export function belumTerpetakan(nama) {
return NILAI_TAK_TERPETAKAN.has(String(nama ?? '').trim().toLowerCase())
}
