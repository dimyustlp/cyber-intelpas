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
 * Kanwil terduga (4 November 2026): berita yang UPT-nya tidak dikenali dan
 * belum berkanwil diberi kanwil hasil dugaan wilayah-berita.js — modul yang
 * sama dengan yang dipakai layar Analisis Berita — lewat RPC
 * terapkan_dugaan_kanwil. Hanya kanwil_asal yang kosong yang diisi.
 *
 * Cara memanggil:
 *   POST /functions/v1/klasifikasi
 *   header: x-sync-token: <SHEET_SYNC_TOKEN>
 *   body  : { "hanya_belum": true, "batas": 1000, "kering": false }
 *
 * Mode pengisian arsip (sekali jalan, tidak menilai ulang klasifikasi apa pun):
 *   body  : { "mode": "wilayah", "batas": 20000, "kering": false }
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
 * Menulis dugaan kanwil. Lintas wilayah dan tanpa lokasi tidak pernah sampai
 * ke sini: menebak salah satu dari dua kanwil lebih buruk daripada diam.
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

    if (opsi.mode === 'wilayah') {
      const batasArsip = Math.min(Number(opsi.batas) || 20000, 50000)
      const tanpaKanwil: Record<string, unknown>[] = []
      for (let dari = 0; dari < batasArsip; dari += 1000) {
        const { data, error } = await supabase
          .from('berita')
          .select('id,judul,ringkasan,nama_upt,kanwil_asal')
          .is('deleted_at', null)
          .is('kanwil_asal', null)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(dari, dari + 999)
        if (error) throw new Error(`Gagal membaca berita tanpa kanwil: ${error.message}`)
        const kumpulan = data || []
        tanpaKanwil.push(...kumpulan)
        if (kumpulan.length < 1000) break
      }

      const peta = bangunPetaWilayah(await muatUpt(supabase))
      const dugaan: Dugaan[] = []
      const rekapDasar: Record<string, number> = {}
      for (const b of tanpaKanwil) {
        const w = wilayahBerita(b, peta)
        rekapDasar[w.dasar] = (rekapDasar[w.dasar] || 0) + 1
        if (w.kanwil && !w.pasti) dugaan.push({ id: String(b.id), kanwil: w.kanwil, dasar: w.dasar })
      }
      const tulis = kering ? { ditulis: 0, ditolak: 0 } : await tulisDugaan(supabase, dugaan, false)
      return jawab({
        ok: true, kering, mode: 'wilayah',
        dibaca: tanpaKanwil.length, terduga: dugaan.length, ...tulis,
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
    const peta = bangunPetaWilayah(daftarUpt)
    const dugaanKanwil: Dugaan[] = []

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

      /* Berita dalam lingkup yang UPT-nya tidak dikenali dan belum berkanwil
         diberi dugaan kanwil. Yang UPT-nya dikenali tidak perlu: pemicu
         basis data mengisi kanwilnya dari data induk begitu nama_upt ditulis. */
      if (k.dalam_lingkup !== false && !upt.otomatis && !b.kanwil_asal) {
        const w = wilayahBerita(b, peta)
        if (w.kanwil && !w.pasti) dugaanKanwil.push({ id: String(b.id), kanwil: w.kanwil, dasar: w.dasar })
      }

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
    let kanwilTerduga = { ditulis: 0, ditolak: 0 }

    if (!kering) {
      for (let i = 0; i < hasil.length; i += UKURAN_KIRIM) {
        const potongan = hasil.slice(i, i + UKURAN_KIRIM)
        const { data, error } = await supabase.rpc('terapkan_klasifikasi', { p_hasil: potongan })
        if (error) throw new Error(`Gagal menulis hasil: ${error.message}`)
        const baris = Array.isArray(data) ? data[0] : data
        diperbarui += Number(baris?.diperbarui || 0)
        uptDitulis += Number(baris?.upt_dipetakan || 0)
      }
      // Sesudah klasifikasi, bukan sebelumnya: kanwil dari UPT yang baru
      // ditulis harus menang, dan RPC dugaan hanya mengisi yang masih kosong.
      if (dugaanKanwil.length) kanwilTerduga = await tulisDugaan(supabase, dugaanKanwil, true)
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
      kanwil_terduga: { diduga: dugaanKanwil.length, ...kanwilTerduga },
      rekap: { kategori: rekapKategori, sentimen: rekapSentimen, urgensi: rekapUrgensi, penerbit: rekapPenerbit },
      durasi_ms: Date.now() - mulai,
    })
  } catch (galat) {
    const pesan = galat instanceof Error ? (galat.stack || galat.message) : String(galat)
    console.error(pesan)
    return jawab({ ok: false, pesan, durasi_ms: Date.now() - mulai }, 500)
  }
})
