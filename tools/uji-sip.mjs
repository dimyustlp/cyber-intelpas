/**
 * Uji penandaan SIP 2023, daftar berita, dan penulis .xlsx.
 *
 *   node tools/uji-sip.mjs
 *
 * Yang dijaga di sini adalah aturan yang bila terbalik tidak meninggalkan
 * galat: klasifikasi yang bisa diturunkan di bawah isinya, mesin yang
 * memberi nilai A atau prioritas Mendesak sendiri, kode penyebarluasan yang
 * membawa SR ke luar, dan buku kerja yang rusak di Excel tanpa satu pesan
 * pun di peramban.
 */

import { inflateRawSync } from 'node:zlib'
import {
  tandaiProduk, klasifikasiDariTingkat, pilihanKlasifikasi, prioritasBerita, prioritasKumpulan,
  sumberMesin, informasiMesin, evaluasiBerita, kodeSebarBoleh, urgensiBaku, kaburkanTeks,
  jenisProdukBerkala, KLASIFIKASI,
} from '../web/js/lib/sip.js'
import { susunDaftarSip } from '../web/js/lib/daftar-sip.js'
import { susunKeterangan, keCsv, keXlsx, lembarXlsx } from '../web/js/lib/ekspor.js'
import { susunXlsx, susunXlsxPadat, crc32, namaKolom, xmlAman } from '../web/js/lib/xlsx.js'
import { susunLaporan } from '../web/js/lib/laporan.js'

let lulus = 0
let gagal = 0
function periksa(nama, syarat) {
  if (syarat) { lulus += 1 } else { gagal += 1; console.log(`  GAGAL  ${nama}`) }
}
function sama(nama, a, b) {
  periksa(`${nama} (dapat ${JSON.stringify(a)}, harap ${JSON.stringify(b)})`, JSON.stringify(a) === JSON.stringify(b))
}

const neg = (lain = {}) => ({
  id: lain.id || 'n1', judul: 'Napi kabur dari Lapas', sentimen: 'Negatif', urgensi: 'Tinggi',
  kategori: 'Gangguan Keamanan dan Ketertiban', subkategori_kode: '1.1', nama_upt: 'Lapas Kelas IIA Cilegon',
  status_verifikasi: 'Belum Ditelaah', tier_media: 4, media: 'Medsos Radar', platform: 'Instagram',
  created_at: '2026-11-03T03:00:00Z', tanggal_publikasi: '2026-11-03T02:00:00Z', link: 'https://contoh.id/a',
  ...lain,
})
const pos = (lain = {}) => ({
  id: lain.id || 'p1', judul: 'Lapas panen kangkung', sentimen: 'Positif', urgensi: 'Rendah',
  kategori: 'Narasi Positif dan Kehumasan', subkategori_kode: '9.1', nama_upt: 'LPKA Kelas II Palu',
  status_verifikasi: 'Belum Ditelaah', tier_media: 2, media: 'RRI.co.id', platform: 'Portal Berita',
  created_at: '2026-11-03T04:00:00Z', tanggal_publikasi: '2026-11-03T03:30:00Z', link: 'https://contoh.id/b',
  ...lain,
})

console.log('1. Klasifikasi dan prioritas')
sama('tingkat internal menjadi YPM', klasifikasiDariTingkat('internal'), 'YPM')
sama('tingkat rahasia internal menjadi YB, bukan R', klasifikasiDariTingkat('rahasia'), 'YB')
sama('pilihan tidak memuat yang di bawah minimum', pilihanKlasifikasi('YB').map((k) => k.kode), ['YB', 'R', 'SR'])
{
  const t = tandaiProduk({ minimum: 'YB', pilihan: { klasifikasi: 'YPM' } })
  sama('klasifikasi tidak bisa diturunkan di bawah isinya', t.klasifikasi, 'YB')
  periksa('dan penurunannya dijelaskan', t.koreksi.length === 1)
}
{
  const t = tandaiProduk({ minimum: 'YPM', pilihan: { klasifikasi: 'SR', kodeSebar: 'D' } })
  sama('SR tidak boleh disebarkan ke samping dan ke luar', t.kodeSebar, 'E')
  sama('SR tidak memaksa prioritas Mendesak', t.prioritas, 'Rt')
}
{
  const t = tandaiProduk({ minimum: 'YPM', pilihan: { prioritas: 'M', kodeSebar: 'B' } })
  sama('Mendesak menarik klasifikasi ke SR', t.klasifikasi, 'SR')
  sama('dan kodenya ikut dibatasi', t.kodeSebar, 'E')
  sama('Segera menarik klasifikasi ke YB',
    tandaiProduk({ pilihan: { prioritas: 'S' } }).klasifikasi, 'YB')
  sama('berkas YB tidak dipaksa Segera', tandaiProduk({ minimum: 'YB' }).prioritas, 'Rt')
  sama('prioritas tidak bisa diturunkan di bawah isinya',
    tandaiProduk({ prioritasMesin: 'S', pilihan: { prioritas: 'Rt' } }).prioritas, 'S')
}
sama('R hanya ke A, B, atau E', kodeSebarBoleh('R'), ['A', 'B', 'E'])
sama('tanpa pilihan, kode sebar E', tandaiProduk({}).kodeSebar, 'E')
periksa('kode B/C/D menjadi versi edaran', tandaiProduk({ pilihan: { kodeSebar: 'D' } }).edaran
  && !tandaiProduk({ pilihan: { kodeSebar: 'A' } }).edaran)
sama('urgensi huruf besar dibakukan', urgensiBaku('SEDANG'), 'Sedang')
sama('negatif Tinggi menjadi Segera', prioritasBerita(neg()), 'S')
sama('negatif Kritis tetap Segera, bukan Mendesak', prioritasBerita(neg({ urgensi: 'Kritis' })), 'S')
sama('positif berurgensi tinggi tetap Rutin', prioritasBerita(pos({ urgensi: 'Tinggi' })), 'Rt')
sama('kumpulan mengambil prioritas tertinggi', prioritasKumpulan([pos(), neg()]), 'S')
periksa('mesin tidak pernah memilih Mendesak',
  ['Kritis', 'Tinggi', 'Sedang', 'Rendah'].every((u) => prioritasBerita(neg({ urgensi: u })) !== 'M'))
sama('harian adalah Laporan Harian', jenisProdukBerkala('harian'), 'Laporan Harian')
sama('mingguan adalah Laporan Perkiraan Intelijen', jenisProdukBerkala('mingguan'), 'Laporan Perkiraan Intelijen')
periksa('setiap klasifikasi menyebut aksesnya', KLASIFIKASI.every((k) => k.akses.length > 10))

console.log('2. Evaluasi sumber dan informasi')
periksa('mesin tidak pernah memberi A', [1, 2, 3, 4, null].every((t) => sumberMesin({ tier_media: t }) !== 'A'))
sama('tier 4 adalah sumber belum diuji, bukan tidak andal', sumberMesin({ tier_media: 4 }), 'E')
sama('tier 1 hampir selalu andal', sumberMesin({ tier_media: 1 }), 'B')
sama('dibantah unit: tidak dapat dipercaya', informasiMesin(neg({ tanggapan_sikap: 'Tidak Benar' })), '5')
sama('dibenarkan unit: sangat dipercaya', informasiMesin(neg({ tanggapan_sikap: 'Dibenarkan' })), '1')
sama('hasil verifikasi analis menang atas sikap unit',
  informasiMesin(neg({ tanggapan_sikap: 'Dibenarkan' }), { keputusan: { hasil_verifikasi: 'Tidak Sesuai' } }), '5')
sama('dua media atau lebih: biasanya dapat dipercaya', informasiMesin(neg(), { media: 3 }), '2')
sama('satu sumber belum diuji: diragukan', informasiMesin(neg()), '4')
{
  const e = evaluasiBerita(neg(), { keputusan: { evaluasi_sumber: 'B', evaluasi_informasi: null } })
  sama('penilaian analis menang', e.sumber, 'B')
  sama('dan asalnya disebut', e.dasar, 'analis')
  sama('nilai gabungan', e.nilai, 'B4')
}

console.log('3. Pengaburan')
{
  const t = kaburkanTeks('Urgensinya Tinggi. Catatan analis: hubungi Budi 081234567890 NIP 198701012010011001')
  periksa('catatan analis dibuang utuh', !t.includes('Budi') && t.includes('[dikaburkan]'))
  periksa('nomor telepon dikaburkan di luar catatan',
    !kaburkanTeks('kontak 081234567890 malam ini').includes('081234567890'))
  periksa('NIP dikaburkan', !kaburkanTeks('NIP 198701012010011001').includes('198701012010011001'))
}

console.log('4. Daftar berita SIP')
{
  const baris = [
    pos({ id: 'a' }),
    neg({ id: 'b', urgensi: 'SEDANG' }),
    neg({ id: 'c', urgensi: 'Kritis', tanggal_publikasi: '2026-11-03T09:00:00Z' }),
    pos({ id: 'd', judul: 'Lapas panen kangkung - RRI.co.id', media: 'Google News', platform: 'Google News' }),
  ]
  const d = susunDaftarSip(baris, {
    upt: [{ nama_upt: 'Lapas Kelas IIA Cilegon', kanwil: 'Kanwil Banten', provinsi: 'Banten' }],
  })
  sama('negatif berprioritas Segera paling atas', d.baris[0].id, 'c')
  sama('lalu negatif Rutin', d.baris[1].id, 'b')
  const kol = (k) => d.kolom.find((x) => x.kunci === k)
  sama('provinsi diambil dari data induk', kol('provinsi').ambil(d.baris[0]), 'Banten')
  sama('urgensi dibakukan di kolomnya', kol('urgensi').ambil(d.baris[1]), 'Sedang')
  periksa('terbit sesudah tangkap ditandai', kol('catatan_data').ambil(d.baris[0]).includes('zona waktu'))
  const g = d.baris.find((b) => b.id === 'd')
  sama('media Google News diganti penerbit aslinya', kol('media').ambil(g), 'RRI.co.id')
  sama('ekor nama media dibuang dari judul', kol('judul').ambil(g), 'Lapas panen kangkung')
  periksa('judul kembar ditandai', kol('catatan_data').ambil(g).includes('Judul sama'))
  sama('minimum dari isi: YB', d.minimum, 'YB')
  periksa('rekomendasi dipecah dua kolom SIP', Boolean(kol('peringatan_dini') && kol('pemecahan_masalah')))
  periksa('berita positif tanpa rekomendasi', kol('pemecahan_masalah').ambil(d.baris.find((b) => b.id === 'a')) === '')
  const tanpa = susunDaftarSip(baris, { denganSaran: false })
  periksa('tanpa izin saran, kolom rekomendasi tidak ada', !tanpa.kolom.some((k) => k.kunci === 'peringatan_dini'))

  const sip = tandaiProduk({ minimum: d.minimum, prioritasMesin: d.prioritasMesin, pilihan: { kodeSebar: 'D' } })
  const ket = susunKeterangan({ judul: 'Uji', profil: { full_name: 'Dimas', role: 'super_admin' }, jumlah: 4, sip })
  const csv = keCsv({ kolom: d.kolom, baris: d.baris, keterangan: ket })
  periksa('edaran: nama pengunduh dikaburkan', !csv.includes('Dimas') && csv.includes('identitas dikaburkan'))
  periksa('edaran: nomor berkas diganti garis', csv.includes('"# Nomor berkas","-"'))

  console.log('5. Buku kerja .xlsx')
  const xl = keXlsx({ kolom: d.kolom, baris: d.baris, keterangan: ket })
  periksa('berkas diawali tanda tangan ZIP', xl[0] === 0x50 && xl[1] === 0x4b && xl[2] === 3 && xl[3] === 4)
  const isiZip = bacaZip(xl)
  periksa('memuat lembar Daftar dan Keterangan',
    isiZip.has('xl/worksheets/sheet1.xml') && isiZip.has('xl/worksheets/sheet2.xml'))
  periksa('CRC setiap butir cocok', [...isiZip.values()].every((b) => b.crcCocok))
  const lembar1 = isiZip.get('xl/worksheets/sheet1.xml').teks
  periksa('baris judul dibekukan', lembar1.includes('state="frozen"'))
  periksa('saringan terpasang dari baris judul', lembar1.includes('<autoFilter ref="A3:'))
  const wb = isiZip.get('xl/workbook.xml').teks
  periksa('nama lembar Daftar', wb.includes('name="Daftar"'))

  const padat = await susunXlsxPadat(lembarXlsx({ kolom: d.kolom, baris: d.baris, keterangan: ket }), {})
  const isiPadat = bacaZip(padat)
  periksa('versi termampatkan bisa dibuka kembali dengan isi yang sama',
    isiPadat.get('xl/worksheets/sheet1.xml')?.teks === lembar1)
}
sama('nama kolom Excel', [namaKolom(0), namaKolom(25), namaKolom(26), namaKolom(701)], ['A', 'Z', 'AA', 'ZZ'])
periksa('karakter kendali dibuang dari XML', !xmlAman('a\u0001b').includes('\u0001'))
sama('CRC-32 baku', crc32(new TextEncoder().encode('123456789')).toString(16), 'cbf43926')
periksa('lembar tanpa baris tetap sah', susunXlsx([{ nama: 'Kosong', baris: [] }]).length > 100)

console.log('6. Laporan HTML')
{
  const html = susunLaporan({
    periode: { mulai: '2026-11-03', selesai: '2026-11-03', hari: 1 },
    konteks: { total: 3, negatif: 2 },
    publikasi: [neg({ id: 'x', tanggal: '2026-11-03T03:00:00Z' }), neg({ id: 'y', tanggal: '2026-11-03T03:00:00Z', tier_media: 1 })],
  }, { jenis: 'harian', nomor: 'UJI/1', sip: tandaiProduk({ minimum: 'YB', pilihan: { kodeSebar: 'A', ditujukan: 'Direktur Kamtib' } }) })
  periksa('laporan memuat blok produk intelijen', html.includes('PRODUK INTELIJEN PEMASYARAKATAN'))
  periksa('jenis harian dicentang', html.includes('■ Laporan Harian'))
  periksa('klasifikasi YB dicentang', html.includes('■ YB'))
  periksa('tujuan surat tercetak', html.includes('Direktur Kamtib'))
  periksa('kalimat pembatas tercetak', html.includes('tujuan pembuktian atau peradilan'))
  const tanpaSip = susunLaporan({ periode: { mulai: '2026-11-03', selesai: '2026-11-03' }, konteks: {}, publikasi: [] }, { jenis: 'bulanan' })
  periksa('laporan tanpa penandaan tetap tersusun', tanpaSip.includes('PRODUK INTELIJEN PEMASYARAKATAN'))
  periksa('judul bulanan tidak lagi tertulis Mingguan', tanpaSip.includes('Negatif Bulanan'))
}

/** Pembaca ZIP sederhana: hanya untuk memeriksa berkas buatan sendiri. */
function bacaZip(bait) {
  const dv = new DataView(bait.buffer, bait.byteOffset, bait.byteLength)
  const hasil = new Map()
  let i = 0
  while (i + 30 <= bait.length && dv.getUint32(i, true) === 0x04034b50) {
    const metode = dv.getUint16(i + 8, true)
    const crc = dv.getUint32(i + 14, true)
    const ukPadat = dv.getUint32(i + 18, true)
    const pjNama = dv.getUint16(i + 26, true)
    const pjEkstra = dv.getUint16(i + 28, true)
    const nama = new TextDecoder().decode(bait.subarray(i + 30, i + 30 + pjNama))
    const awal = i + 30 + pjNama + pjEkstra
    const data = bait.subarray(awal, awal + ukPadat)
    const isi = metode === 8 ? new Uint8Array(inflateRawSync(data)) : data
    hasil.set(nama, { teks: new TextDecoder().decode(isi), crcCocok: crc32(isi) === crc })
    i = awal + ukPadat
  }
  return hasil
}

console.log(`\n  ${lulus} lulus, ${gagal} gagal`)
process.exit(gagal ? 1 : 0)
