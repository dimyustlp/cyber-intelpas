import { readFileSync } from 'node:fs'
import { klasifikasikan } from '../web/js/lib/klasifikasi.js'
import { bangunIndeks, cocokkanUpt } from '../web/js/lib/pencocokan-upt.js'

function csv(t){const b=[];let s=[],v='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){v+='"';i++}else q=false}else v+=c;continue}if(c==='"')q=true;else if(c===','){s.push(v);v=''}else if(c==='\n'){s.push(v.replace(/\r$/,''));b.push(s);s=[];v=''}else v+=c}
if(v||s.length){s.push(v.replace(/\r$/,''));b.push(s)}return b.filter(x=>x.some(y=>String(y).trim()!==''))}
const raw = csv(readFileSync('/home/claude/sumber-lama/cyberintelpas-main/data/master_upt_coordinates.csv','utf8').replace(/^﻿/,''))
const head = raw[0].map(h=>h.trim())
const upt = raw.slice(1).map(b=>Object.fromEntries(head.map((h,i)=>[h,b[i]??''])))
const idx = bangunIndeks(upt.map(u=>({...u, aktif:true, location_hint:u.kabupaten_kota})))
console.log('indeks:', idx.jumlah, 'bersaing:', idx.jumlahBersaing, 'sebutan:', idx.sebutanTerpasang, 'alias tak dikenal:', idx.sebutanTakDikenal)

const data = JSON.parse(readFileSync('/home/claude/data-uji/berita.json','utf8'))
let otomatis=0, saran=0, kosong=0, luar=0
const contoh=[], tanpa=[]
for (const b of data) {
  const k = klasifikasikan(b)
  if (k.kategori === 'Di Luar Lingkup') { luar++; continue }
  const teks=[b.judul,b.ringkasan,b.caption_manual,b.media].filter(Boolean).join(' . ')
  const r = cocokkanUpt(teks, idx)
  if (r.otomatis){otomatis++; if(contoh.length<25) contoh.push(`${String(Math.round(r.skor*100)).padStart(3)}% ${r.metode.padEnd(18)} ${r.nama.padEnd(42)} << ${b.judul.slice(0,62)}`)}
  else if (r.saran.length){saran++; if(tanpa.length<12) tanpa.push(`SARAN ${r.saran.slice(0,2).map(s=>s.nama).join(' / ')} << ${b.judul.slice(0,60)}`)}
  else {kosong++; if(tanpa.length<12) tanpa.push(`KOSONG ${r.alasan.slice(0,40)} << ${b.judul.slice(0,60)}`)}
}
console.log(`\nDalam lingkup: ${data.length-luar} | otomatis ${otomatis} (${Math.round(otomatis/(data.length-luar)*100)}%) | perlu putusan ${saran} | tidak dikenali ${kosong}`)
console.log('\n--- CONTOH PEMETAAN OTOMATIS ---'); console.log(contoh.join('\n'))
console.log('\n--- BELUM TERPETAKAN ---'); console.log(tanpa.join('\n'))
