/**
 * Edge Function: klasifikasi
 *
 * Menjalankan mesin aturan Trans-Siber PAS terhadap tabel `berita`, lalu
 * menuliskan kembali kategori, subkategori, sentimen, urgensi, tingkat
 * perhatian, kata kunci, dan nama UPT hasil pencocokan.
 *
 * Alasan fungsi ini ada: crawler menulis setiap berita dengan sentimen
 * "Tidak diketahui", kategori "Lainnya", dan urgensi "Sedang". Tidak ada satu
 * pun proses yang pernah menggantinya. Akibatnya laporan mingguan melaporkan
 * nol publikasi negatif pada pekan yang jelas-jelas memuat berita negatif —
 * bukan karena beritanya tidak ada, melainkan karena tidak pernah ada yang
 * menilainya.
 *
 * Mesin yang dipakai sama persis dengan yang berjalan di peramban. Berkas
 * taksonomi.js, klasifikasi.js, dan pencocokan-upt.js di sebelah berkas ini
 * adalah salinan yang sama dengan yang ada di web/js/lib/. Satu sumber aturan,
 * dua tempat menjalankan.
 *
 * Cara memanggil:
 *   POST /functions/v1/klasifikasi
 *   header: x-sync-token: <SHEET_SYNC_TOKEN>
 *   body  : { "hanya_belum": true, "batas": 1000, "kering": false }
 *
 *     hanya_belum  true  = hanya berita yang belum pernah dinilai mesin
 *                  false = seluruh arsip dinilai ulang
 *     batas        jumlah baris maksimum yang diproses sekali jalan
 *     kering       true  = hanya menghitung, tidak menulis apa pun
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { klasifikasikan, META_MESIN } from './klasifikasi.js'
import { bangunIndeks, cocokkanUpt, META_PENCOCOK } from './pencocokan-upt.js'

const KEPALA = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Sekali kirim ke basis data. Ditahan di angka ini supaya tidak melebihi batas ukuran permintaan. */
const UKURAN_KIRIM = 150

function env(nama: string): string {
  return Deno.env.get(nama)?.trim() || ''
}

function jawab(isi: unknown, status = 200): Response {
  return new Response(JSON.stringify(isi, null, 2), { status, headers: KEPALA })
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

    // ------------------------------------------------------- data induk UPT

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

    const indeks = bangunIndeks(daftarUpt)

    // ----------------------------------------------------------- ambil berita

    let kueri = supabase
      .from('berita')
      .select('id,judul,ringkasan,raw_analysis,caption_manual,media,nama_upt,urgensi,catatan,status_verifikasi')
      .is('deleted_at', null)
      .neq('status_verifikasi', 'Terverifikasi')
      .order('created_at', { ascending: false })
      .limit(batas)

    if (hanyaBelum) kueri = kueri.is('ai_classified_at', null)

    const { data: berita, error: galatBerita } = await kueri
    if (galatBerita) throw new Error(`Gagal membaca berita: ${galatBerita.message}`)

    const daftarBerita = berita || []

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

      // Berita di luar lingkup tidak dicocokkan ke unit mana pun. Memetakan
      // perkara Rutan KPK ke salah satu UPT berarti membebankan angka negatif
      // kepada unit yang tidak ada hubungannya dengan perkara itu.
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
