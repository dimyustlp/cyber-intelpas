/**
 * Edge Function: klasifikasi
 *
 * Menjalankan mesin aturan Trans-Siber PAS terhadap tabel `berita`, lalu
 * menuliskan kembali kategori, subkategori, sentimen, urgensi, tingkat
 * perhatian, kata kunci, dan nama UPT hasil pencocokan.
 *
 * Hemat egress (20 September 2026): berita yang perlu dinilai dibaca LEBIH
 * DULU. Bila tidak ada, fungsi langsung pulang tanpa menarik data induk UPT
 * (±100 KB). Penjadwal memanggil fungsi ini berkali-kali sehari dan sebagian
 * besar panggilan tidak menemukan berita baru.
 *
 * Mesin yang dipakai sama persis dengan yang berjalan di peramban. Berkas
 * taksonomi.js, klasifikasi.js, dan pencocokan-upt.js di sebelah berkas ini
 * adalah salinan yang sama dengan yang ada di web/js/lib/.
 *
 * Kanwil terduga (4 November 2026): mode "wilayah" memberi berita yang UPT-nya
 * tidak dikenali dan belum berkanwil kanwil hasil dugaan wilayah-berita.js —
 * modul yang sama dengan yang dipakai layar Analisis Berita — lewat RPC
 * terapkan_dugaan_kanwil. Hanya kanwil_asal yang kosong yang diisi. Mode ini
 * dipanggil penjadwal duga-kanwil, tidak pernah dari klasifikasi rutin.
 *
 * Cara memanggil:
 *   POST /functions/v1/klasifikasi
 *   header: x-sync-token: <SHEET_SYNC_TOKEN>
 *   body  : { "hanya_belum": true, "batas": 1000, "kering": false }
 *
 * Mode penduga kanwil (tidak menilai ulang klasifikasi apa pun):
 *   body  : { "mode": "wilayah", "batas": 200, "kering": false }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { klasifikasikan, META_MESIN } from './klasifikasi.js'
import { bangunIndeks, cocokkanUpt, META_PENCOCOK } from './pencocokan-upt.js'
import { bangunPetaWilayah, wilayahBerita } from './wilayah-berita.js'

const KEPALA = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const UKURAN_KIRIM = 150

function env(nama: string): string {
  return Deno.env.get(nama)?.trim() || ''
}

function jawab(isi: unknown, status = 200): Response {
  return new Response(JSON.stringify(isi), { status, headers: KEPALA })
}

// deno-lint-ignore no-explicit-any
type Klien = any
type Dugaan = { id: string, kanwil: string, dasar: string }

/** Data induk UPT aktif, lengkap dengan kolom tempat yang dibaca penduga wilayah. */
async function muatUpt(supabase: Klien): Promise<Record<string, unknown>[]> {
  const daftarUpt: Record<string, unknown>[] = []
  for (let dari = 0; ; dari += 1000) {
    const { data, error } = await supabase
      .from('upt')
      .select('nama_upt,jenis_upt,kelas_upt,subjenis_upt,provinsi,kanwil,kabupaten_kota,location_hint')
      .eq('aktif', true)
      .range(dari, dari + 999)
    if (error) throw new Error(`Gagal membaca data induk UPT: ${error.message}`)
    const kumpulan = data || []
    daftarUpt.push(...kumpulan)
    if (kumpulan.length < 1000) break
  }
  return daftarUpt
}

/**
 * Menulis hasil penduga. Lintas wilayah dan tanpa lokasi dikirim dengan kanwil
 * kosong: RPC hanya mencatat dasarnya supaya tidak dicoba ulang, tanpa
 * menebak salah satu kanwil — menebak di situ lebih buruk daripada diam.
 */
async function tulisDugaan(supabase: Klien, dugaan: Dugaan[], sentuh: boolean) {
  let ditulis = 0
  let ditolak = 0
  for (let i = 0; i < dugaan.length; i += 500) {
    const { data, error } = await supabase.rpc('terapkan_dugaan_kanwil', {
      p_hasil: dugaan.slice(i, i + 500), p_sentuh: sentuh,
    })
    if (error) throw new Error(`Gagal menulis dugaan kanwil: ${error.message}`)
    const baris = Array.isArray(data) ? data[0] : data
    ditulis += Number(baris?.ditulis || 0)
    ditolak += Number(baris?.ditolak || 0)
  }
  return { ditulis, ditolak }
}

Deno.serve(async (permintaan: Request) => {
  if (permintaan.method === 'OPTIONS') return new Response('ok', { headers: KEPALA })
  if (permintaan.method !== 'POST') {
    return jawab({ ok: false, pesan: 'Hanya menerima POST.' }, 405)
  }

  const mulai = Date.now()

  try {
    const tokenDiharapkan = env('SHEET_SYNC_TOKEN')
    if (!tokenDiharapkan) {
      return jawab({ ok: false, pesan: 'Secret SHEET_SYNC_TOKEN belum dipasang pada Edge Function.' }, 500)
    }

    const tokenDikirim = permintaan.headers.get('x-sync-token')
      || new URL(permintaan.url).searchParams.get('token')
      || ''

    if (tokenDikirim !== tokenDiharapkan) {
      return jawab({ ok: false, pesan: 'Token tidak valid.' }, 401)
    }

    let opsi: Record<string, unknown> = {}
    try { opsi = await permintaan.json() } catch { /* badan kosong diperbolehkan */ }

    const hanyaBelum = opsi.hanya_belum !== false
    const batas = Math.min(Number(opsi.batas) || 1000, 5000)
    const kering = opsi.kering === true

    const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ------------------------------------------- mode pengisian arsip wilayah

    /*
       Penduga kanwil berjalan di mode tersendiri, BUKAN di dalam klasifikasi
       rutin. Satu panggilan untuk 5.646 berita habis jatah komputasi Edge
       Function (WORKER_RESOURCE_LIMIT, 4 November 2026): penduga membaca
       ribuan nama tempat untuk setiap berita. Di dalam klasifikasi rutin,
       satu lonjakan berita akan ikut menjatuhkan penilaian sentimennya.

       Penjadwal duga-kanwil memanggil mode ini berpotongan kecil. Setiap
       baris yang sudah dicoba diberi kanwil_dasar — termasuk 'lintas' dan
       'tanpa-lokasi' yang kanwilnya tetap kosong — sehingga saringan
       `kanwil_dasar is null` tidak membaca baris yang sama dua kali.
       `setelah` (id) hanya untuk uji kering, yang tidak menulis tanda apa pun.
    */
    if (opsi.mode === 'wilayah') {
      const batasArsip = Math.min(Number(opsi.batas) || 200, 1000)
      let q = supabase
        .from('berita')
        .select('id,judul,ringkasan,nama_upt,kanwil_asal')
        .is('deleted_at', null)
        .is('kanwil_asal', null)
        .is('kanwil_dasar', null)
        .order('id', { ascending: true })
        .limit(batasArsip)
      if (opsi.setelah) q = q.gt('id', String(opsi.setelah))
      const { data, error } = await q
      if (error) throw new Error(`Gagal membaca berita tanpa kanwil: ${error.message}`)
      const tanpaKanwil: Record<string, unknown>[] = data || []
      const berikut = tanpaKanwil.length === batasArsip ? String(tanpaKanwil[tanpaKanwil.length - 1].id) : null
      if (!tanpaKanwil.length) {
        return jawab({ ok: true, kering, mode: 'wilayah', dibaca: 0, pesan: 'Tidak ada berita yang perlu diduga.', durasi_ms: Date.now() - mulai })
      }

      const peta = bangunPetaWilayah(await muatUpt(supabase))
      const hasilDuga: Dugaan[] = []
      const rekapDasar: Record<string, number> = {}
      let terduga = 0
      for (const b of tanpaKanwil) {
        const w = wilayahBerita(b, peta)
        rekapDasar[w.dasar] = (rekapDasar[w.dasar] || 0) + 1
        // Yang 'pasti' di sini mustahil (kanwil_asal kosong); dijaga juga.
        if (w.pasti) continue
        if (w.kanwil) terduga += 1
        hasilDuga.push({ id: String(b.id), kanwil: w.kanwil || '', dasar: w.dasar })
      }
      const tulis = kering ? { ditulis: 0, ditolak: 0 } : await tulisDugaan(supabase, hasilDuga, true)
      return jawab({
        ok: true, kering, mode: 'wilayah',
        dibaca: tanpaKanwil.length, terduga, ...tulis, berikut,
        rekap_dasar: rekapDasar, durasi_ms: Date.now() - mulai,
      })
    }

    // ----------------------------------------------------------- ambil berita

    let kueri = supabase
      .from('berita')
      .select('id,judul,ringkasan,raw_analysis,caption_manual,media,nama_upt,kanwil_asal,urgensi,catatan,status_verifikasi')
      .is('deleted_at', null)
      .neq('status_verifikasi', 'Terverifikasi')
      // Yang paling lama dinilai didahulukan; yang belum pernah dinilai bernilai NULL.
      .order('ai_classified_at', { ascending: true, nullsFirst: true })
      .limit(batas)

    if (hanyaBelum) kueri = kueri.is('ai_classified_at', null)

    const { data: berita, error: galatBerita } = await kueri
    if (galatBerita) throw new Error(`Gagal membaca berita: ${galatBerita.message}`)

    const daftarBerita = berita || []

    if (!daftarBerita.length) {
      return jawab({ ok: true, kering, diproses: 0, diperbarui: 0, pesan: 'Tidak ada berita yang perlu dinilai.', durasi_ms: Date.now() - mulai })
    }

    // ------------------------------------------------------- data induk UPT

    const daftarUpt = await muatUpt(supabase)

    const indeks = bangunIndeks(daftarUpt)

    // -------------------------------------------------------------- proses

    const hasil: Record<string, unknown>[] = []
    const rekapKategori: Record<string, number> = {}
    const rekapSentimen: Record<string, number> = {}
    const rekapUrgensi: Record<string, number> = {}
    const rekapPenerbit: Record<string, number> = {}
    let uptTerpetakan = 0
    let uptPerluPutusan = 0
    let luarLingkup = 0

    for (const b of daftarBerita) {
      const k = klasifikasikan(b)

      // Berita di luar lingkup tidak dicocokkan ke unit mana pun.
      const upt = k.dalam_lingkup === false
        ? { otomatis: false, nama: null, saran: [] }
        : cocokkanUpt(
            [b.judul, b.ringkasan, b.raw_analysis, b.caption_manual, b.media].filter(Boolean).join(' . '),
            indeks,
          )

      if (k.dalam_lingkup === false) luarLingkup += 1
      if (upt.otomatis) uptTerpetakan += 1
      else if (upt.saran.length) uptPerluPutusan += 1

      rekapKategori[k.kategori] = (rekapKategori[k.kategori] || 0) + 1
      rekapSentimen[k.sentimen] = (rekapSentimen[k.sentimen] || 0) + 1
      rekapUrgensi[k.urgensi] = (rekapUrgensi[k.urgensi] || 0) + 1
      const asal = k.penerbit || 'tidak_dinilai'
      rekapPenerbit[asal] = (rekapPenerbit[asal] || 0) + 1

      hasil.push({
        id: b.id,
        kategori: k.kategori,
        subkategori: k.subkategori,
        subkategori_kode: k.subkategori_kode,
        sentimen: k.sentimen,
        urgensi: k.urgensi,
        tingkat_perhatian: k.tingkat_perhatian,
        kata_kunci: k.kata_kunci,
        ai_provider: k.ai_provider,
        ai_confidence: k.ai_confidence,
        skor_tertinggi: k.skor_tertinggi,
        alasan: k.alasan,
        nama_upt: upt.otomatis ? upt.nama : null,
      })
    }

    // -------------------------------------------------------------- tulis

    let diperbarui = 0
    let uptDitulis = 0

    if (!kering) {
      for (let i = 0; i < hasil.length; i += UKURAN_KIRIM) {
        const potongan = hasil.slice(i, i + UKURAN_KIRIM)
        const { data, error } = await supabase.rpc('terapkan_klasifikasi', { p_hasil: potongan })
        if (error) throw new Error(`Gagal menulis hasil: ${error.message}`)
        const baris = Array.isArray(data) ? data[0] : data
        diperbarui += Number(baris?.diperbarui || 0)
        uptDitulis += Number(baris?.upt_dipetakan || 0)
      }
    }

    return jawab({
      ok: true,
      kering,
      mesin: { klasifikasi: META_MESIN.versi, pencocok: META_PENCOCOK.versi },
      induk_upt: { jumlah: indeks.jumlah, bersaing: indeks.jumlahBersaing, sebutan: indeks.sebutanTerpasang },
      diproses: daftarBerita.length,
      luar_lingkup: luarLingkup,
      diperbarui,
      upt: { dipetakan_otomatis: uptTerpetakan, ditulis: uptDitulis, perlu_putusan_analis: uptPerluPutusan },
      rekap: { kategori: rekapKategori, sentimen: rekapSentimen, urgensi: rekapUrgensi, penerbit: rekapPenerbit },
      durasi_ms: Date.now() - mulai,
    })
  } catch (galat) {
    const pesan = galat instanceof Error ? (galat.stack || galat.message) : String(galat)
    console.error(pesan)
    return jawab({ ok: false, pesan, durasi_ms: Date.now() - mulai }, 500)
  }
})
