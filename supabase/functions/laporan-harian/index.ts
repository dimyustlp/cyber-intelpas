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
    const kering = opsi.kering === true
    const kirim = opsi.kirim !== false && !kering

    // -------------------------------------------------------------- bahan

    const [snapshot, rincian, pesan] = await Promise.all([
      rpc('snapshot_laporan', { p_mulai: hari, p_selesai: hari }),
      rpc('rincian_negatif_laporan', { p_mulai: hari, p_selesai: hari }),
      rpc('pesan_harian_telegram', { p_tanggal: hari }),
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

    const pdf = await susunPdf({
      hari: tanggalPanjang(hari),
      nomor: nomorLaporan(hari),
      dibuat: `${tanggalPanjang(hariIniWib())} ${new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(11, 16)}`,
      ikhtisar,
      pembanding,
      rincian,
    })

    const namaBerkas = `Laporan-Harian-Trans-Siber-PAS-${hari}.pdf`
    const keterangan = amankanTeks(
      `Laporan Harian ${tanggalPanjang(hari)} - ${negatif} dari ${total} publikasi bersentimen negatif, `
      + `diuraikan menurut kelompok isu.`,
    )

    const ringkas = {
      ok: true,
      hari,
      nomor: nomorLaporan(hari),
      angka: {
        total,
        negatif,
        diambil: Number(rincian?.diambil ?? 0),
        peristiwa: pdf.peristiwa,
      },
      lampiran: { nama: namaBerkas, halaman: pdf.halaman, bita: pdf.bita },
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
