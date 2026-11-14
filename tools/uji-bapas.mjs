#!/usr/bin/env node
/**
 * Uji Bapas pada data induk: setiap Bapas harus dikenali lewat tiga bentuk
 * sebutan ("Bapas X", "Balai Pemasyarakatan Kelas II X", nama resminya), dan
 * penyebutan "Lapas X" untuk kota yang sama tidak boleh bocor menjadi Bapas.
 *
 * Jalankan: node tools/uji-bapas.mjs
 */
import { readFileSync } from 'node:fs'
import { bangunIndeks, cocokkanUpt } from '../web/js/lib/pencocokan-upt.js'
function csv(t){const b=[];let s=[],v='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){v+='"';i++}else q=false}else v+=c;continue}if(c==='"')q=true;else if(c===','){s.push(v);v=''}else if(c==='\n'){s.push(v.replace(/\r$/,''));b.push(s);s=[];v=''}else v+=c}
if(v||s.length){s.push(v.replace(/\r$/,''));b.push(s)}return b.filter(x=>x.some(y=>String(y).trim()!==''))}
const raw=csv(readFileSync(new URL('../data/master-upt.csv', import.meta.url),'utf8').replace(/^﻿/,''));const h=raw[0]
const upt=raw.slice(1).map(b=>({...Object.fromEntries(h.map((k,i)=>[k,b[i]])),aktif:true,location_hint:b[h.indexOf('location_hint')]}))
const idx=bangunIndeks(upt)
const bap=upt.filter(u=>u.jenis_upt==='Bapas')
let gagal=0
for(const u of bap){
  const tempat=u.nama_upt.replace(/^Bapas Kelas I{1,3}\s+/,'')
  for(const [teks,harap] of [
    [`Bapas ${tempat} gelar layanan bimbingan klien pemasyarakatan`,u.nama_upt],
    [`Balai Pemasyarakatan Kelas II ${tempat} dampingi anak berhadapan dengan hukum`,u.nama_upt],
    [u.nama_upt+' laksanakan sidang TPP',u.nama_upt],
  ]){
    const r=cocokkanUpt(teks,idx)
    const got=r.otomatis?r.nama:null
    if(got!==harap){gagal++;console.log('GAGAL',teks.slice(0,70),'=>',got,'['+(r.metode||'')+']')}
  }
  // Lapas dengan tempat yang sama tidak boleh menjadi Bapas
  const r=cocokkanUpt(`Lapas ${tempat} gelar penggeledahan rutin`,idx)
  if(r.otomatis&&r.nama.startsWith('Bapas')){gagal++;console.log('BOCOR Lapas->Bapas',tempat,'=>',r.nama)}
}
console.log(`${bap.length} Bapas diuji, ${gagal} gagal`)
if(bap.length<80) {console.log('Data induk memuat kurang dari 80 Bapas');process.exit(1)}
process.exit(gagal?1:0)
