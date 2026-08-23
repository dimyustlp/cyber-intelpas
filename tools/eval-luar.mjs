import { klasifikasikan } from '../web/js/lib/klasifikasi.js'
import { readFileSync } from 'node:fs'
const data = JSON.parse(readFileSync('/home/claude/data-uji/berita.json', 'utf8'))
const sub = {}
for (const b of data) {
  const k = klasifikasikan(b)
  if (k.kategori === 'Di Luar Lingkup') console.log(k.subkategori_kode, '|', b.judul.slice(0,85))
  sub[k.subkategori] = (sub[k.subkategori]||0)+1
}
console.log('\n--- SUBKATEGORI ---')
for (const [n,c] of Object.entries(sub).sort((a,b)=>b[1]-a[1])) console.log(String(c).padStart(4), n)
