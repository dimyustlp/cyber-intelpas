/**
 * Edge Function: laporan-harian
 *
 * Menyusun laporan harian sebagai PDF, lalu mengirimkannya ke grup Telegram
 * pimpinan bersama pesan ringkasnya.
 *
 * Yang diperbaiki. Sampai 1 September 2026 grup pimpinan hanya menerima pesan
 * teks: "Publikasi: 104, Negatif: 62". Angka itu benar, tetapi tidak ada satu
 * pun cara mengetahui 62 itu tentang apa tanpa membuka dasbor — dan dalam
 * praktik, tidak ada yang membukanya sampai seseorang bertanya. Laporan yang
 * menuntut pekerjaan tambahan untuk bisa dibaca adalah laporan yang tidak
 * dibaca.
 *
 * KENAPA FUNGSI TERSENDIRI, BUKAN DITAMBAHKAN KE telegram-kirim
 *
 * telegram-kirim sudah berjalan, sudah mengirim pesan harian setiap pagi, dan
 * sudah menangani kredensial serta pencatatan pengiriman. Ia juga sudah bisa
 * mengirim berkas: aksi `kirim` menerima `dokumen`. Yang belum ada hanyalah
 * yang membuat berkasnya.
 *
 * Penyusun PDF menarik pustaka luar. Bila ia dipasang di dalam telegram-kirim
 * dan pustaka itu gagal dimuat, yang ikut mati adalah seluruh jalur pengiriman
 * Telegram — termasuk pesan harian yang selama ini bekerja. Dipisah begini,
 * kegagalan penyusun PDF paling jauh membuat lampiran tidak terkirim; pesannya
 * tetap sampai.
 *
 * Cara memanggil:
 *   POST /functions/v1/laporan-harian
 *   header: x-sync-token: <SHEET_SYNC_TOKEN>
 *   body  : { "tanggal": "2026-08-31", "kirim": true, "kering": false }
 *
 *     tanggal  hari yang dilaporkan (bawaan: kemarin menurut WIB)
 *     kirim    false = susun saja, jangan kirim ke Telegram
 *     kering   true  = susun PDF tetapi jangan kirim dan jangan catat apa pun
 *     sertakan_base64  true = kembalikan berkasnya apa adanya, untuk diperiksa
 */

import { susunPdf, amankanTeks } from './pdf.ts'

// Modul yang sama persis dengan yang dipakai layar, disalin oleh
// tools/ringkas-fungsi.mjs. Lembar yang dikirim pukul setengah enam pagi
// karena itu menyebut angka yang sama dengan yang dilihat analis siang harinya.
// @ts-ignore modul JavaScript murni tanpa tipe
import { susunInfografis } from './infografis.js'
// @ts-ignore modul JavaScript murni tanpa tipe
import { svgInfografis } from './infografis-svg.js'
// @ts-ignore modul JavaScript murni tanpa tipe
import { BATAS, DARATAN, TETANGGA } from './peta-indonesia.js'
// @ts-ignore modul JavaScript murni tanpa tipe
import { PROVINSI, PROVINSI_INDUK } from './peta-provinsi.js'

const KEPALA = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function env(nama: string): string {
  return Deno.env.get(nama)?.trim() || ''
}

function jawab(isi: unknown, status = 200): Response {
  return new Response(JSON.stringify(isi, null, 2), { status, headers: KEPALA })
}

/** Tanggal hari ini menurut WIB, sebagai YYYY-MM-DD. */
function hariIniWib(): string {
  const w = new Date(Date.now() + 7 * 3600 * 1000)
  return w.toISOString().slice(0, 10)
}

function kemarinWib(): string {
  const w = new Date(Date.now() + 7 * 3600 * 1000 - 24 * 3600 * 1000)
  return w.toISOString().slice(0, 10)
}

/** "Senin, 31 Agustus 2026" — bentuk yang dipakai laporan di layar. */
function tanggalPanjang(iso: string): string {
  const [t, b, h] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(t, b - 1, h))
  return `${HARI[d.getUTCDay()]}, ${h} ${BULAN[b - 1]} ${t}`
}

/**
 * Nomor laporan, bentuknya sama dengan yang dipakai laporan di layar.
 * Urutannya adalah hari keberapa dalam bulan itu — bukan penghitung yang
 * disimpan, sebab penghitung menuntut satu tabel lagi yang harus dijaga tetap
 * benar, dan dua laporan untuk hari yang sama justru sebaiknya bernomor sama.
 */
function nomorLaporan(iso: string): string {
  const [t, b, h] = iso.split('-').map(Number)
  return `LAP-H/${String(h).padStart(4, '0')}/${ROMAWI[b - 1]}/${t}`
}

/**
 * Nomor laporan mingguan. Bentuknya dibedakan dari harian dengan sengaja:
 * dua laporan yang bernomor sama tetapi memuat rentang berbeda adalah dua
 * berkas yang tidak bisa dibedakan dalam arsip.
 */
function nomorMingguan(mulai: string, selesai: string): string {
  const [t, b] = selesai.split('-').map(Number)
  const [, , h] = mulai.split('-').map(Number)
  return `LAP-M/${String(h).padStart(4, '0')}/${ROMAWI[b - 1]}/${t}`
}

/** Menggeser sebuah tanggal ISO sekian hari, tanpa melewati zona waktu peladen. */
function geserHari(iso: string, hari: number): string {
  const [t, b, h] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(t, b - 1, h + hari))
  return d.toISOString().slice(0, 10)
}

/**
 * Membaca baris tabel lewat PostgREST.
 *
 * Dipakai untuk berita dan data induk unit — dua hal yang tidak bisa didapat
 * dari RPC ikhtisar mana pun, sebab lembar infografis menghitung ulang
 * sebarannya sendiri dari baris aslinya.
 */
async function baris(tabel: string, kueri: Record<string, string>) {
  const alamat = new URL(`${env('SUPABASE_URL')}/rest/v1/${tabel}`)
  for (const [k, v] of Object.entries(kueri)) alamat.searchParams.set(k, v)
  const jawaban = await fetch(alamat, {
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
  })
  const teks = await jawaban.text()
  if (!jawaban.ok) throw new Error(`Baca ${tabel} gagal (${jawaban.status}): ${teks.slice(0, 300)}`)
  return JSON.parse(teks)
}

/** Memanggil satu fungsi basis data lewat PostgREST. */
async function rpc(nama: string, isi: Record<string, unknown>) {
  const jawaban = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${nama}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(isi),
  })
  const teks = await jawaban.text()
  if (!jawaban.ok) throw new Error(`RPC ${nama} gagal (${jawaban.status}): ${teks.slice(0, 300)}`)
  try { return JSON.parse(teks) } catch { return teks }
}

Deno.serve(async (permintaan: Request) => {
  if (permintaan.method === 'OPTIONS') return new Response('ok', { headers: KEPALA })
  if (permintaan.method !== 'POST') return jawab({ ok: false, pesan: 'Hanya menerima POST.' }, 405)

  const mulai = Date.now()

  try {
    const tokenDiharapkan = env('SHEET_SYNC_TOKEN')
    if (!tokenDiharapkan) {
      return jawab({ ok: false, pesan: 'Secret SHEET_SYNC_TOKEN belum dipasang pada Edge Function.' }, 500)
    }
    const tokenDikirim = permintaan.headers.get('x-sync-token')
      || new URL(permintaan.url).searchParams.get('token') || ''
    if (tokenDikirim !== tokenDiharapkan) {
      return jawab({ ok: false, pesan: 'Token tidak valid.' }, 401)
    }

    let opsi: Record<string, unknown> = {}
    try { opsi = await permintaan.json() } catch { /* badan kosong diperbolehkan */ }

    const hari = /^\d{4}-\d{2}-\d{2}$/.test(String(opsi.tanggal ?? ''))
      ? String(opsi.tanggal)
      : kemarinWib()

    /*
       Laporan mingguan memakai fungsi yang sama, hanya rentangnya berbeda.

       Dipisah menjadi fungsi tersendiri, dulu, akan berarti dua tempat yang
       harus dijaga tetap sama — dan yang jarang dijalankan, yang mingguan,
       yang lebih dulu usang. Rentangnya tujuh hari yang BERAKHIR pada hari
       yang dilaporkan, sehingga laporan Senin pagi memuat Senin sampai Minggu
       yang baru lewat, bukan potongan pekan berjalan.
    */
    const jenis = opsi.jenis === 'mingguan' ? 'mingguan' : 'harian'
    const akhirPeriode = hari
    const awalPeriode = jenis === 'mingguan' ? geserHari(hari, -6) : hari

    const kering = opsi.kering === true
    const kirim = opsi.kirim !== false && !kering

    // -------------------------------------------------------------- bahan

    const [snapshot, rincian, pesan, beritaPeriode, unitInduk] = await Promise.all([
      rpc('snapshot_laporan', { p_mulai: awalPeriode, p_selesai: akhirPeriode }),
      rpc('rincian_negatif_laporan', { p_mulai: awalPeriode, p_selesai: akhirPeriode }),
      rpc('pesan_harian_telegram', { p_tanggal: hari }),
      /* Baris berita apa adanya. Lembar infografis menghitung sebaran
         provinsi, jenis unit, dan penerbitnya sendiri dari sini — tidak satu
         pun di antaranya tersedia pada RPC ikhtisar. Batasnya longgar; pekan
         teramai sejauh ini 131 baris. */
      baris('berita', {
        select: 'id,judul,ringkasan,media,platform,link,nama_upt,kategori,subkategori,'
          + 'subkategori_kode,sentimen,urgensi,status_verifikasi,tanggal_publikasi,created_at',
        deleted_at: 'is.null',
        tanggal_publikasi: `gte.${awalPeriode}T00:00:00+07:00`,
        and: `(tanggal_publikasi.lte.${akhirPeriode}T23:59:59+07:00)`,
        limit: '2000',
      }),
      baris('upt', { select: 'nama_upt,jenis_upt,kanwil,provinsi', aktif: 'eq.true', limit: '1000' }),
    ])

    const ikhtisar = snapshot?.ikhtisar ?? {}
    const pembanding = snapshot?.pembanding ?? {}
    const total = Number(ikhtisar.total ?? 0)
    const negatif = Number(ikhtisar.negatif ?? 0)

    // Hari tanpa publikasi tidak menghasilkan lampiran. Sebuah PDF berisi
    // "tidak ada data" setiap pagi mengajari penerimanya mengabaikan lampiran,
    // dan pada hari lampiran itu berisi sesuatu ia tetap diabaikan.
    if (total === 0) {
      const hasilKosong = { ok: true, hari, alasan: 'tidak ada publikasi pada tanggal ini', lampiran: false }
      if (!kirim) return jawab({ ...hasilKosong, kering })
      const kirimTeks = await panggilTelegram(String(pesan ?? ''), [], String(opsi.oleh ?? 'Penjadwal Harian'))
      return jawab({ ...hasilKosong, telegram: kirimTeks, durasi_ms: Date.now() - mulai })
    }

    // ---------------------------------------------------------------- pdf

    /*
       Lembar infografis. Kegagalannya TIDAK menggagalkan laporan.

       Alasannya sama dengan alasan penyusun PDF dipisah dari telegram-kirim:
       bagian yang paling baru dan paling rumit tidak boleh bisa mematikan
       jalur yang selama ini bekerja. Bila penggambar lembar melempar galat —
       satu bentuk SVG yang belum ditangani, satu provinsi tanpa bentuk —
       yang hilang hanya halaman pertamanya; uraian negatifnya tetap terkirim,
       dan sebabnya ikut dilaporkan pada jawaban supaya tidak diam-diam hilang
       berminggu-minggu.
    */
    let svgLembar = ''
    let galatLembar: string | null = null
    try {
      const model = susunInfografis({
        berita: beritaPeriode,
        unit: unitInduk,
        mulai: awalPeriode,
        selesai: akhirPeriode,
        jenis,
        indukProvinsi: PROVINSI_INDUK,
      })
      svgLembar = svgInfografis(model, {
        batas: BATAS, daratan: DARATAN, tetangga: TETANGGA, provinsi: PROVINSI,
      })
    } catch (galat) {
      galatLembar = galat instanceof Error ? galat.message : String(galat)
      console.error('Lembar infografis gagal disusun:', galatLembar)
    }

    const namaJenis = jenis === 'mingguan' ? 'Mingguan' : 'Harian'
    const nomor = jenis === 'mingguan' ? nomorMingguan(awalPeriode, akhirPeriode) : nomorLaporan(hari)
    const judulPeriode = jenis === 'mingguan'
      ? `${tanggalPanjang(awalPeriode)} - ${tanggalPanjang(akhirPeriode)}`
      : tanggalPanjang(hari)

    const pdf = await susunPdf({
      hari: judulPeriode,
      nomor,
      dibuat: `${tanggalPanjang(hariIniWib())} ${new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16)}`,
      ikhtisar,
      pembanding,
      rincian,
      svgLembar,
    })

    const namaBerkas = jenis === 'mingguan'
      ? `Laporan-Mingguan-Trans-Siber-PAS-${awalPeriode}_sd_${akhirPeriode}.pdf`
      : `Laporan-Harian-Trans-Siber-PAS-${hari}.pdf`
    const keterangan = amankanTeks(
      `Laporan ${namaJenis} ${judulPeriode} - ${negatif} dari ${total} publikasi bersentimen negatif, `
      + `diuraikan menurut kelompok isu.`,
    )

    const ringkas = {
      ok: true,
      hari,
      nomor,
      jenis,
      periode: { mulai: awalPeriode, selesai: akhirPeriode },
      angka: {
        total,
        negatif,
        diambil: Number(rincian?.diambil ?? 0),
        peristiwa: pdf.peristiwa,
      },
      lampiran: { nama: namaBerkas, halaman: pdf.halaman, bita: pdf.bita, lembar: pdf.lembar },
      ...(galatLembar ? { galat_lembar: galatLembar } : {}),
      durasi_ms: Date.now() - mulai,
    }

    // Berkasnya bisa diminta apa adanya. Sebuah laporan yang hanya bisa
    // diperiksa dengan mengirimkannya lebih dulu ke grup pimpinan bukan laporan
    // yang bisa diperiksa. Jalur ini dijaga token yang sama dengan sisanya.
    if (!kirim) {
      return jawab({
        ...ringkas,
        kering,
        terkirim: false,
        ...(opsi.sertakan_base64 === true ? { pdf_base64: pdf.base64 } : {}),
      })
    }

    const hasilKirim = await panggilTelegram(
      String(pesan ?? ''),
      [{ nama: namaBerkas, isi_base64: pdf.base64, keterangan }],
      String(opsi.oleh ?? 'Penjadwal Harian'),
    )

    return jawab({ ...ringkas, telegram: hasilKirim, durasi_ms: Date.now() - mulai })
  } catch (galat) {
    const pesan = galat instanceof Error ? (galat.stack || galat.message) : String(galat)
    console.error(pesan)
    return jawab({ ok: false, pesan, durasi_ms: Date.now() - mulai }, 500)
  }
})

/**
 * Menyerahkan pengiriman kepada telegram-kirim.
 *
 * Kredensial bot, daftar grup tujuan, pencatatan berhasil-gagal, dan penyensoran
 * kunci pada pesan galat seluruhnya sudah ada di sana. Menyalinnya ke sini
 * berarti dua tempat yang harus dijaga tetap sama, dan yang pertama kali usang
 * biasanya yang jarang dibaca.
 */
async function panggilTelegram(teks: string, dokumen: unknown[], oleh: string) {
  const jawaban = await fetch(`${env('SUPABASE_URL')}/functions/v1/telegram-kirim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sync-token': env('SHEET_SYNC_TOKEN'),
    },
    body: JSON.stringify({
      aksi: 'kirim',
      jenis: 'laporan',
      pemicu: 'scheduled',
      oleh,
      teks,
      dokumen,
    }),
  })
  const isi = await jawaban.json().catch(() => ({}))
  return { status: jawaban.status, ...isi }
}
