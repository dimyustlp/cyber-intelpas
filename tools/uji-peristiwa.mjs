import { readFileSync } from 'node:fs'
import { klasifikasikan } from '../web/js/lib/klasifikasi.js'
import { bangunIndeks, cocokkanUpt } from '../web/js/lib/pencocokan-upt.js'
import { kelompokkanPeristiwa, validasiBanyak, rekapMutu } from '../web/js/lib/peristiwa.js'

function csv(t){const b=[];let s=[],v='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){v+='"';i++}else q=false}else v+=c;continue}if(c==='"')q=true;else if(c===','){s.push(v);v=''}else if(c==='\n'){s.push(v.replace(/\r$/,''));b.push(s);s=[];v=''}else v+=c}
if(v||s.length){s.push(v.replace(/\r$/,''));b.push(s)}return b.filter(x=>x.some(y=>String(y).trim()!==''))}
const raw = csv(readFileSync('/home/claude/sumber-lama/cyberintelpas-main/data/master_upt_coordinates.csv','utf8').replace(/^﻿/,''))
const head = raw[0].map(h=>h.trim())
const idx = bangunIndeks(raw.slice(1).map(b=>{const o=Object.fromEntries(head.map((h,i)=>[h,b[i]??''])); return {...o, aktif:true, location_hint:o.kabupaten_kota}}))

const data = JSON.parse(readFileSync('/home/claude/data-uji/berita.json','utf8'))
const dinilai = data.map(b => {
  const k = klasifikasikan(b)
  const u = k.dalam_lingkup === false ? {otomatis:false,nama:null}
    : cocokkanUpt([b.judul,b.ringkasan,b.media].filter(Boolean).join(' . '), idx)
  return { ...b, ...k, nama_upt: u.otomatis ? u.nama : 'Belum Teridentifikasi' }
})

const negatif = dinilai.filter(b => b.sentimen === 'Negatif' && b.kategori !== 'Di Luar Lingkup')
const peristiwa = kelompokkanPeristiwa(negatif)
console.log(`Publikasi negatif: ${negatif.length} -> Peristiwa: ${peristiwa.length}\n`)
for (const p of peristiwa.slice(0, 12)) {
  console.log(`${String(p.jumlah_publikasi).padStart(2)} pub / ${p.jumlah_media} media / ${p.rentang_hari}h | ${p.urgensi.padEnd(7)} | ${(p.nama_upt||'-').slice(0,34).padEnd(34)} | ${p.subkategori.slice(0,28).padEnd(28)} | ${(p.judul||'').slice(0,58)}`)
}
const mutu = rekapMutu(validasiBanyak(dinilai))
console.log('\nMUTU:', JSON.stringify(mutu))
