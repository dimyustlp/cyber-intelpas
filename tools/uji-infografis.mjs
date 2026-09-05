/**
 * Memeriksa penyusun model laporan infografis.
 *
 * Dua bagian. Yang pertama uji sifat: himpunan buatan dengan jawaban yang
 * sudah diketahui, dijalankan tanpa basis data sama sekali — inilah yang
 * dijalankan setiap kali aturan tema atau sentimen disentuh.
 *
 * Yang kedua, bila diberi berkas JSON berisi berita sungguhan lewat argumen,
 * mencetak lembar itu sebagai teks. Bukan uji: pemeriksaan mata. Angka yang
 * lulus seluruh uji sifat masih bisa menghasilkan lembar yang tidak masuk akal
 * — provinsi kosong, tema yang seluruhnya satu, judul yang terpotong di tengah
 * kata — dan satu-satunya cara menemukannya adalah melihatnya.
 *
 * Jalankan:
 *   node tools/uji-infografis.mjs
 *   node tools/uji-infografis.mjs <berkas-berita.json>
 */

import { readFileSync } from 'node:fs'
import {
  susunInfografis, labelPeriode, emberDominan, jenisUnit, indeksUnit, rekapTema,
} from '../web/js/lib/infografis.js'

let lulus = 0
let gagal = 0

function uji(nama, benar, keterangan = '') {
  if (benar) { lulus += 1; return }
  gagal += 1
  console.log(`  GAGAL  ${nama}${keterangan ? `\n         ${keterangan}` : ''}`)
}

function sama(nama, didapat, diharapkan) {
  const a = JSON.stringify(didapat)
  const b = JSON.stringify(diharapkan)
  uji(nama, a === b, a === b ? '' : `diharapkan ${b} · didapat ${a}`)
}

/* ------------------------------------------------------------ label periode */

console.log('\nLabel periode')
sama('satu hari', labelPeriode('2026-09-03', '2026-09-03'), '3 September 2026')
sama('lintas bulan', labelPeriode('2026-08-27', '2026-09-03'), '27 Agustus – 3 September 2026')
sama('dalam satu bulan', labelPeriode('2026-09-01', '2026-09-07'), '1 – 7 September 2026')
sama('lintas tahun', labelPeriode('2025-12-30', '2026-01-02'), '30 Desember 2025 – 2 Januari 2026')

/* ----------------------------------------------------------- ember dominan */

console.log('Ember dominan')
uji(
  'sembilan positif mengalahkan satu negatif',
  emberDominan([...Array(9).fill({ sentimen: 'Positif' }), { sentimen: 'Negatif' }]) === 'positif',
  'Aturan "ada satu negatif berarti negatif" membuat SELURUH provinsi merah '
  + 'pada data sepekan yang sungguhan, dan peta yang seluruhnya merah tidak '
  + 'membedakan apa pun.',
)
uji(
  'seri dimenangkan yang lebih merugikan',
  emberDominan([{ sentimen: 'Negatif' }, { sentimen: 'Positif' }]) === 'negatif',
  'Provinsi yang benar-benar berimbang tidak boleh tampil menenangkan.',
)
uji('netral menang atas positif saat seri', emberDominan([{ sentimen: 'Netral' }, { sentimen: 'Positif' }]) === 'netral')
uji('positif saja', emberDominan([{ sentimen: 'Positif' }]) === 'positif')
uji('negatif terbanyak', emberDominan([
  { sentimen: 'Negatif' }, { sentimen: 'Negatif' }, { sentimen: 'Positif' },
]) === 'negatif')
uji('kosong', emberDominan([]) === 'belum')
uji('campuran masuk netral', emberDominan([{ sentimen: 'Campuran' }]) === 'netral')

/* -------------------------------------------------------------- jenis unit */

console.log('Jenis unit')
const indeks = indeksUnit([
  { nama_upt: 'Lapas Kelas IIA Bekasi', jenis_upt: 'Lapas', provinsi: 'Jawa Barat' },
  { nama_upt: 'Rutan Kelas I Pondok Bambu', jenis_upt: 'Rutan', provinsi: 'DKI Jakarta' },
  { nama_upt: 'LPKA Kelas I Kutoarjo', jenis_upt: 'LPKA', provinsi: 'Jawa Tengah' },
])
sama('dari data induk', jenisUnit({ nama_upt: 'Lapas Kelas IIA Bekasi' }, indeks), 'Lapas')
sama('rutan dari data induk', jenisUnit({ nama_upt: 'Rutan Kelas I Pondok Bambu' }, indeks), 'Rutan')
sama('lpka tidak terbaca lapas', jenisUnit({ nama_upt: 'LPKA Kelas I Kutoarjo' }, indeks), 'LPKA')
sama('dari nama saat tak ada di induk', jenisUnit({ nama_upt: 'Rutan Kelas IIB Entah' }, indeks), 'Rutan')
sama('unit tak terpetakan', jenisUnit({ nama_upt: 'Tidak Terpetakan' }, indeks), '')
sama('tanpa unit', jenisUnit({}, indeks), '')

/* ------------------------------------------------------------------- tema */

console.log('Rekap tema')
{
  const inti = [
    { subkategori_kode: '8.2', subkategori: 'Pembinaan, Pendidikan, dan Keagamaan', sentimen: 'Positif' },
    { subkategori_kode: '8.2', subkategori: 'Pembinaan, Pendidikan, dan Keagamaan', sentimen: 'Positif' },
    { subkategori_kode: '8.6', subkategori: 'Ketahanan Pangan dan Pemberdayaan Ekonomi', sentimen: 'Positif' },
    { subkategori_kode: '1.1', subkategori: 'Pelarian WBP', sentimen: 'Negatif' },
  ]
  const { tema, takBertema } = rekapTema(inti)
  sama('tema kosong tidak muncul', tema.length, 3)
  sama('urut menurun', tema.map((t) => t.jumlah), [2, 1, 1])
  sama('tema teratas', tema[0].kode, 'pembinaan')
  sama('persen dijumlahkan', tema.reduce((n, t) => n + t.persen, 0), 100)
  sama('semua bertema', takBertema, 0)
  uji(
    'pangan terpisah dari pembinaan',
    tema.some((t) => t.kode === 'pangan') && tema.some((t) => t.kode === 'pembinaan'),
    'Pemisahan 8.6 dari 8.2 adalah alasan seluruh panel rincian isu ada.',
  )
}

console.log('Berita tanpa tema')
{
  const { tema, takBertema } = rekapTema([
    { subkategori_kode: '0.1', subkategori: 'Belum Dikelompokkan', sentimen: 'Netral' },
  ])
  sama('yang belum dikelompokkan tidak dipaksa bertema', tema.length, 0)
  sama('dihitung terpisah', takBertema, 1)
}

/* -------------------------------------------------------- lembar utuh kecil */

console.log('Lembar utuh')
{
  const unit = [
    { nama_upt: 'Lapas Kelas IIA Bekasi', jenis_upt: 'Lapas', provinsi: 'Jawa Barat' },
    { nama_upt: 'Rutan Kelas I Pondok Bambu', jenis_upt: 'Rutan', provinsi: 'DKI Jakarta' },
  ]
  const berita = [
    {
      judul: 'Panen pakcoy di Lapas Bekasi', nama_upt: 'Lapas Kelas IIA Bekasi',
      subkategori_kode: '8.6', subkategori: 'Ketahanan Pangan dan Pemberdayaan Ekonomi',
      sentimen: 'Positif', media: 'RRI.co.id', tanggal_publikasi: '2026-09-01T02:00:00Z',
    },
    {
      judul: 'Dugaan pungli di Rutan Pondok Bambu', nama_upt: 'Rutan Kelas I Pondok Bambu',
      subkategori_kode: '3.1', subkategori: 'Pungli dan Pemerasan oleh Petugas',
      sentimen: 'Negatif', urgensi: 'Tinggi', media: 'ANTARA News',
      tanggal_publikasi: '2026-09-02T02:00:00Z',
    },
    {
      judul: 'Berita di luar lingkup', nama_upt: 'Rutan KPK', kategori: 'Di Luar Lingkup',
      subkategori_kode: '9.1', sentimen: 'Netral', media: 'Detik',
      tanggal_publikasi: '2026-09-02T02:00:00Z',
    },
  ]
  const m = susunInfografis({
    berita, unit, mulai: '2026-09-01', selesai: '2026-09-03', jenis: 'mingguan',
    indukProvinsi: { 'Kalimantan Utara': 'Kalimantan Timur' },
  })

  sama('luar lingkup tidak dihitung', m.ikhtisar.total, 2)
  sama('luar lingkup tetap dilaporkan', m.dikecualikan.luarLingkup, 1)
  sama('lapas', m.ikhtisar.lapas, 1)
  sama('rutan', m.ikhtisar.rutan, 1)
  sama('provinsi', m.ikhtisar.provinsi, 2)
  sama('penerbit', m.ikhtisar.media, 2)
  sama('ember dijumlahkan menjadi total',
    m.sentimen.negatif + m.sentimen.netral + m.sentimen.positif + m.sentimen.belum,
    m.ikhtisar.total)
  sama('jakarta dominan negatif',
    m.wilayah.provinsi.find((p) => p.nama === 'DKI Jakarta')?.dominan, 'negatif')
  uji('isu sorotan terisi', Boolean(m.isuKhusus), 'Ada satu berita negatif; panelnya harus muncul.')
  sama('kesimpulan dua kalimat', m.kesimpulan.length, 2)
  uji('contoh berita ada', m.contoh.length > 0)
}

console.log('Lembar tanpa berita negatif')
{
  const m = susunInfografis({
    berita: [{
      judul: 'Ibadah bersama', nama_upt: 'Lapas Kelas IIA Bekasi', subkategori_kode: '8.2',
      subkategori: 'Pembinaan, Pendidikan, dan Keagamaan', sentimen: 'Positif',
      media: 'Kemenimipas.go.id', tanggal_publikasi: '2026-09-01T02:00:00Z',
    }],
    unit: [{ nama_upt: 'Lapas Kelas IIA Bekasi', jenis_upt: 'Lapas', provinsi: 'Jawa Barat' }],
    mulai: '2026-09-01', selesai: '2026-09-01', jenis: 'harian',
  })
  sama('panel sorotan tidak dipaksa muncul', m.isuKhusus, null)
  uji('kesimpulan tidak menakut-nakuti', m.kesimpulan[1].nada === 'baik')
}

console.log(`\n${lulus} lulus, ${gagal} gagal`)

/* ------------------------------------------------- pemeriksaan mata, opsional */

const berkas = process.argv[2]
if (berkas) {
  const mentah = JSON.parse(readFileSync(berkas, 'utf8'))
  const berita = Array.isArray(mentah) ? mentah : mentah.berita || []
  const unit = Array.isArray(mentah) ? [] : mentah.unit || []

  const hari = berita.map((b) => String(b.tanggal_publikasi || b.created_at || '').slice(0, 10))
    .filter(Boolean).sort()

  const m = susunInfografis({
    berita, unit, mulai: hari[0], selesai: hari[hari.length - 1], jenis: 'mingguan',
  })

  const g = '─'.repeat(74)
  console.log(`\n${g}\nMONITORING BERITA LAPAS & RUTAN — ${m.periode.label}\n${g}`)
  console.log(`Total ${m.ikhtisar.total} berita · Lapas ${m.ikhtisar.lapas} (${m.ikhtisar.persenLapas}%)`
    + ` · Rutan ${m.ikhtisar.rutan} (${m.ikhtisar.persenRutan}%)`
    + ` · ${m.ikhtisar.provinsi} provinsi · ${m.ikhtisar.media} media`)
  console.log(`Sentimen  positif ${m.sentimen.persen.positif}% (${m.sentimen.positif})`
    + ` · netral ${m.sentimen.persen.netral}% (${m.sentimen.netral})`
    + ` · negatif ${m.sentimen.persen.negatif}% (${m.sentimen.negatif})`
    + (m.sentimen.belum ? ` · belum dinilai ${m.sentimen.belum}` : ''))

  console.log(`\nRINCIAN ISU`)
  for (const t of m.tema) {
    console.log(`  ${String(t.jumlah).padStart(3)} (${String(t.persen).padStart(4)}%)  ${t.nama}`)
    for (const r of t.ringkas) console.log(`                 · ${r}`)
  }
  if (m.takBertema) console.log(`  ${String(m.takBertema).padStart(3)}          (belum dikelompokkan, di luar tema)`)

  console.log(`\nTOP MEDIA`)
  for (const x of m.media.teratas) console.log(`  ${String(x.jumlah).padStart(3)}  ${x.nama}`)
  if (m.media.lainnya) console.log(`  ${String(m.media.lainnya).padStart(3)}  Lainnya`)

  console.log(`\nPROVINSI TERBANYAK`)
  for (const p of m.wilayah.teratas) {
    console.log(`  ${String(p.jumlah).padStart(3)}  ${p.nama.padEnd(28)} ${p.dominan}`)
  }
  console.log(`  status provinsi: positif ${m.wilayah.perEmber.positif}`
    + ` · netral ${m.wilayah.perEmber.netral} · negatif ${m.wilayah.perEmber.negatif}`
    + ` · tanpa provinsi ${m.wilayah.tanpaProvinsi} berita`)

  console.log(`\nSOROTAN`)
  for (const s of m.sorotanButir) console.log(`  ${s.nada === 'awas' ? '!' : '+'} ${s.teks}`)

  if (m.isuKhusus) {
    console.log(`\nISU SOROTAN KHUSUS — ${m.isuKhusus.judul}`
      + `${m.isuKhusus.unit ? ` (${m.isuKhusus.unit})` : ''}`)
    for (const g2 of m.isuKhusus.garisWaktu) {
      console.log(`  ${g2.tanggal}  ${String(g2.teks).slice(0, 80)} — ${g2.sumber}`)
    }
  }

  console.log(`\nCONTOH BERITA`)
  for (const c of m.contoh) {
    console.log(`  ${c.tanggal}  ${String(c.judul).slice(0, 62)}`)
    console.log(`              ${c.upt}${c.provinsi ? ` · ${c.provinsi}` : ''}`)
  }

  console.log(`\nKESIMPULAN`)
  for (const k of m.kesimpulan) console.log(`  ${k.nada === 'awas' ? '!' : '+'} ${k.teks}`)

  console.log(`\nTidak dihitung: ${m.dikecualikan.luarLingkup} di luar lingkup, `
    + `${m.dikecualikan.tidakValid} tidak valid, dari ${m.dikecualikan.seluruhBaris} baris.`)
}

process.exit(gagal ? 1 : 0)
