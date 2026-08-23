/**
 * Mengiris snapshot negatif mingguan menjadi snapshot satu hari.
 * Dipakai supaya laporan harian dan mingguan selalu berasal dari data yang
 * sama persis — tidak mungkin lagi keduanya menyebut angka berbeda.
 *
 *   node tools/iris-harian.mjs <mingguan.json> <tanggal> <keluaran.json>
 */
import { readFileSync, writeFileSync } from 'node:fs'
const [, , masuk, tanggal, keluar] = process.argv
const s = JSON.parse(readFileSync(masuk, 'utf8'))
const pub = s.publikasi.filter((b) => String(b.tanggal).slice(0, 10) === tanggal)
writeFileSync(keluar, JSON.stringify({
  ...s,
  periode: { hari: 1, mulai: tanggal, selesai: tanggal, pembanding_mulai: tanggal, pembanding_selesai: tanggal },
  konteks: { ...s.konteks, negatif: pub.length },
  publikasi: pub,
}, null, 1))
console.log(`Irisan ${tanggal}: ${pub.length} publikasi -> ${keluar}`)
