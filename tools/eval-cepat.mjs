import { klasifikasikan } from '../web/js/lib/klasifikasi.js'
import { readFileSync } from 'node:fs'

const data = JSON.parse(readFileSync('/home/claude/data-uji/berita.json', 'utf8'))
const rekapKat = {}, rekapSen = {}, rekapSub = {}
const lainnya = []
for (const b of data) {
  const k = klasifikasikan(b)
  rekapKat[k.kategori] = (rekapKat[k.kategori] || 0) + 1
  rekapSen[k.sentimen] = (rekapSen[k.sentimen] || 0) + 1
  rekapSub[k.subkategori] = (rekapSub[k.subkategori] || 0) + 1
  if (k.kategori === 'Lainnya') lainnya.push(b.judul.slice(0, 95))
}
console.log('TOTAL', data.length)
console.log('KATEGORI', JSON.stringify(rekapKat, null, 1))
console.log('SENTIMEN', JSON.stringify(rekapSen, null, 1))
console.log('\nMASIH LAINNYA:', lainnya.length)
console.log(lainnya.slice(0, 60).join('\n'))
