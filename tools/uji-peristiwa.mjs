/**
 * Uji pengelompokan peristiwa.
 *
 * Menjalankan mesin klasifikasi dan pencocokan unit atas sekumpulan berita,
 * lalu mengelompokkan yang bersentimen negatif menjadi peristiwa — delapan
 * publikasi tentang satu narapidana yang kabur harus menjadi satu kejadian,
 * bukan delapan.
 *
 * Kedua sumber datanya bisa ditunjuk lewat peubah lingkungan, dan keduanya
 * punya cadangan. Sebelum ini keduanya berupa jalur mutlak milik satu mesin
 * (`/home/claude/...`), sehingga berkas ini berhenti bisa dijalankan begitu
 * berpindah komputer — uji yang tidak bisa dijalankan sama saja dengan uji yang
 * tidak ada.
 *
 *   JALUR_UPT     berkas master koordinat UPT
 *                 (bawaan: ./sumber-lama/cyberintelpas-main/data/master_upt_coordinates.csv)
 *   JALUR_BERITA  berkas JSON berisi larik berita
 *                 (bila kosong: memakai data peragaan bawaan aplikasi)
 */

import { readFileSync, existsSync } from 'node:fs'
import { klasifikasikan } from '../web/js/lib/klasifikasi.js'
import { bangunIndeks, cocokkanUpt } from '../web/js/lib/pencocokan-upt.js'
import { kelompokkanPeristiwa, validasiBanyak, rekapMutu } from '../web/js/lib/peristiwa.js'
import { buatBerita } from '../web/js/lib/demo.js'

const JALUR_UPT = process.env.JALUR_UPT
  || './sumber-lama/cyberintelpas-main/data/master_upt_coordinates.csv'
const JALUR_BERITA = process.env.JALUR_BERITA || ''

function csv(t){const b=[];let s=[],v='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){v+='"';i++}else q=false}else v+=c;continue}if(c==='"')q=true;else if(c===','){s.push(v);v=''}else if(c==='\n'){s.push(v.replace(/\r$/,''));b.push(s);s=[];v=''}else v+=c}
if(v||s.length){s.push(v.replace(/\r$/,''));b.push(s)}return b.filter(x=>x.some(y=>String(y).trim()!==''))}
if (!existsSync(JALUR_UPT)) {
  console.error(`Berkas master UPT tidak ditemukan: ${JALUR_UPT}`)
  console.error('Tunjuk berkasnya lewat JALUR_UPT, atau letakkan sumber-lama/ di tempatnya.')
  process.exit(1)
}

const teksUpt = readFileSync(JALUR_UPT, 'utf8')
const raw = csv(teksUpt.charCodeAt(0) === 0xFEFF ? teksUpt.slice(1) : teksUpt)
const head = raw[0].map(h=>h.trim())
const idx = bangunIndeks(raw.slice(1).map(b=>{const o=Object.fromEntries(head.map((h,i)=>[h,b[i]??''])); return {...o, aktif:true, location_hint:o.kabupaten_kota}}))

/*
   Tanpa berkas berita sungguhan, uji ini memakai data peragaan. Angkanya tentu
   bukan angka produksi — yang diuji memang bukan angkanya, melainkan apakah
   publikasi yang menceritakan satu kejadian benar-benar menyatu menjadi satu
   peristiwa.
*/
const data = JALUR_BERITA
  ? JSON.parse(readFileSync(JALUR_BERITA, 'utf8'))
  : buatBerita()

console.log(`Sumber berita: ${JALUR_BERITA || 'data peragaan bawaan'} — ${data.length} publikasi
`)
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
