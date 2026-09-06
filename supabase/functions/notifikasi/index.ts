/**
 * Edge Function: notifikasi
 *
 * Menguras antrean `notifikasi_berita` dan mengirimkannya ke Telegram.
 *
 * ---------------------------------------------------------------------------
 * SATU ATURAN YANG MENENTUKAN SEGALANYA: NEGATIF DULU, SATU PER SATU
 * ---------------------------------------------------------------------------
 *
 * Berita negatif dikirim sebagai pesan tersendiri, lengkap dengan unit, kanwil,
 * urgensi, dan tautannya — sesuatu yang harus bisa dibaca dan ditindaklanjuti
 * tanpa membuka aplikasi apa pun. Selebihnya dikumpulkan menjadi satu ringkasan
 * berkala.
 *
 * Pembagian itu bukan selera. Grup yang menerima tiga puluh pesan sehari akan
 * dibisukan dalam dua hari, dan grup yang dibisukan tidak menerima apa-apa —
 * termasuk pemberitahuan yang benar-benar penting. Membatasi jumlah pesan
 * satuan adalah cara menjaga agar yang penting tetap terbaca, bukan cara
 * menghemat.
 *
 * ---------------------------------------------------------------------------
 * KENAPA MENUNGGU MESIN KLASIFIKASI
 * ---------------------------------------------------------------------------
 *
 * Berita masuk dengan `sentimen = 'Tidak diketahui'`; yang menilainya
 * `klasifikasi`, yang berjalan sepuluh menit sekali. Mengirim pada detik
 * penyisipan berarti tidak akan pernah tahu mana yang negatif — dan seluruh
 * aturan di atas kehilangan artinya.
 *
 * Karena itu baris yang belum dinilai DITAHAN, tetapi hanya sampai batas
 * `tunggu_klasifikasi_menit`. Sesudah itu ia dikirim apa adanya. Menahan
 * selamanya berarti satu mesin klasifikasi yang berhenti membungkam seluruh
 * pemberitahuan tanpa satu pun tanda.
 *
 * ---------------------------------------------------------------------------
 * KENAPA MEMANGGIL telegram-kirim, BUKAN API TELEGRAM LANGSUNG
 * ---------------------------------------------------------------------------
 *
 * Supaya kunci botnya tetap tinggal di satu tempat. Fungsi ini tidak pernah
 * memegang TELEGRAM_BOT_TOKEN, tidak bisa membocorkannya lewat pesan galat,
 * dan seluruh pengirimannya tercatat di `telegram_deliveries` dengan cara yang
 * persis sama dengan laporan harian.
 *
 * ---------------------------------------------------------------------------
 * CARA MEMANGGIL
 * ---------------------------------------------------------------------------
 *
 *   POST /functions/v1/notifikasi
 *   header: x-sync-token: <SHEET_SYNC_TOKEN>
 *   body:
 *     { "aksi": "kirim" }                  jalan biasa; dipanggil penjadwal
 *     { "aksi": "kirim", "kering": true }  menyusun pesannya, TIDAK mengirim
 *     { "aksi": "keadaan" }                isi antrean dan setelan, tanpa efek
 *
 * `kering` mengembalikan teks pesan yang persis akan dikirim. Itulah cara
 * memeriksa bentuk pemberitahuan tanpa mengganggu satu orang pun di grup.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERSI = 'notifikasi-v1.0'

const KEPALA = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function env(nama: string): string {
  return Deno.env.get(nama)?.trim() || ''
}

function jawab(isi: unknown, status = 200): Response {
  return new Response(JSON.stringify(isi, null, 2), { status, headers: KEPALA })
}

/** Telegram menolak seluruh pesan bila satu tanda `<` di dalamnya tak berpasangan. */
function amanHtml(nilai: unknown): string {
  return String(nilai ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function potong(teks: string, panjang: number): string {
  const bersih = String(teks ?? '').replace(/\s+/g, ' ').trim()
  return bersih.length > panjang ? `${bersih.slice(0, panjang - 1)}…` : bersih
}

const WIB = 'Asia/Jakarta'

function waktuWib(nilai: unknown): string {
  if (!nilai) return '—'
  const t = new Date(String(nilai))
  if (isNaN(t.getTime())) return '—'
  return t.toLocaleString('id-ID', {
    timeZone: WIB, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).replace('.', ':')
}

/* ============================================================ bentuk pesan */

interface Antre {
  berita_id: string
  antre_at: string
  judul: string | null
  link: string | null
  media: string | null
  nama_upt: string | null
  kanwil_asal: string | null
  kategori: string | null
  subkategori: string | null
  subkategori_kode: string | null
  sentimen: string | null
  urgensi: string | null
  ringkasan: string | null
  source_type: string | null
  ai_classified_at: string | null
  tanggal_publikasi: string | null
  prioritas: number
  negatif: boolean
}

const LENCANA: Record<string, string> = {
  KRITIS: '🚨', TINGGI: '🔴', SEDANG: '🟠', RENDAH: '🟡',
}

/**
 * Pesan untuk satu berita negatif.
 *
 * Barisnya disusun menurut urutan yang dibutuhkan pembacanya di lapangan:
 * apa yang terjadi, di unit mana, seberapa mendesak, lalu barulah dari mana
 * kabarnya. Tautan ditaruh paling bawah supaya bisa ditekan tanpa menggeser.
 */
function pesanSatuan(b: Antre): string {
  const lencana = LENCANA[String(b.urgensi || '').toUpperCase()] || '🔴'
  const golongan = [b.subkategori_kode, b.subkategori].filter(Boolean).join(' ')
  const unit = b.nama_upt && b.nama_upt !== 'Belum Teridentifikasi'
    ? amanHtml(b.nama_upt)
    : '<i>belum dipetakan analis</i>'

  /*
    Umur beritanya disebutkan bila ia bukan berita hari ini.

    Perayap menjangkau arsip sampai 45 hari ke belakang, jadi sebuah berita
    yang BARU MASUK sistem bisa saja terbit sebulan lalu. Judul pesan yang
    berbunyi "BARU" tanpa keterangan itu membuat pembacanya menyangka ada
    peristiwa baru — dan pada berita penembakan atau kematian, salah sangka
    semacam itu berujung pada tindakan yang tidak perlu.
  */
  const umurHari = b.tanggal_publikasi
    ? Math.floor((Date.now() - new Date(b.tanggal_publikasi).getTime()) / 86_400_000)
    : 0
  const penanda = umurHari >= 3 ? ` <i>(arsip — terbit ${umurHari} hari lalu)</i>` : ''

  const baris = [
    `${lencana} <b>BERITA NEGATIF MASUK</b>${penanda}`,
    '',
    `<b>${amanHtml(potong(b.judul || 'Tanpa judul', 220))}</b>`,
    '',
    `🏛 Unit    : ${unit}`,
  ]
  if (b.kanwil_asal) baris.push(`🗺 Kanwil  : ${amanHtml(b.kanwil_asal)}`)
  if (golongan) baris.push(`🏷 Golongan: ${amanHtml(golongan)}`)
  baris.push(`⚠️ Urgensi : ${amanHtml(b.urgensi || 'SEDANG')}`)
  baris.push(`📰 Media   : ${amanHtml(b.media || '—')}`)
  baris.push(`🕘 Terbit  : ${waktuWib(b.tanggal_publikasi)} WIB`)

  const ringkas = potong(b.ringkasan || '', 320)
  if (ringkas && ringkas !== potong(b.judul || '', 320)) {
    baris.push('', amanHtml(ringkas))
  }
  if (b.link) baris.push('', `🔗 ${amanHtml(b.link)}`)

  return baris.join('\n')
}

/** Satu pesan untuk berita yang tidak negatif, supaya grup tidak dibanjiri. */
function pesanRingkasan(daftar: Antre[], sejak: string | null): string {
  const hitung = { negatif: 0, netral: 0, positif: 0, belum: 0 }
  for (const b of daftar) {
    if (b.sentimen === 'Negatif') hitung.negatif++
    else if (b.sentimen === 'Positif') hitung.positif++
    else if (!b.sentimen || b.sentimen === 'Tidak diketahui') hitung.belum++
    else hitung.netral++
  }

  const baris = [
    '📥 <b>Berita masuk — ringkasan</b>',
    sejak ? `<i>Sejak ${waktuWib(sejak)} WIB</i>` : '',
    '',
    `Total <b>${daftar.length}</b> berita baru.`,
    `Negatif ${hitung.negatif} · Netral/Campuran ${hitung.netral} · `
      + `Positif ${hitung.positif} · Belum dinilai ${hitung.belum}`,
    '',
  ].filter((x) => x !== '')

  // Sepuluh, bukan seluruhnya. Telegram memotong pesan pada 4096 aksara, dan
  // pesan yang terpotong di tengah daftar kehilangan justru bagian penutupnya.
  const tampil = daftar.slice(0, 10)
  baris.push('<b>Beberapa di antaranya:</b>')
  tampil.forEach((b, i) => {
    const tanda = b.sentimen === 'Negatif' ? '🔴' : b.sentimen === 'Positif' ? '🟢' : '⚪️'
    baris.push(`${i + 1}. ${tanda} ${amanHtml(potong(b.judul || 'Tanpa judul', 110))}`
      + `\n     <i>${amanHtml(potong(b.media || '—', 40))}</i>`)
  })
  if (daftar.length > tampil.length) {
    baris.push('', `<i>dan ${daftar.length - tampil.length} berita lainnya di Pusat Data Berita.</i>`)
  }

  return baris.join('\n')
}

/* ================================================================== pelayan */

Deno.serve(async (permintaan: Request) => {
  if (permintaan.method === 'OPTIONS') return new Response('ok', { headers: KEPALA })
  if (permintaan.method !== 'POST') return jawab({ ok: false, pesan: 'Hanya menerima POST.' }, 405)

  const mulai = Date.now()

  const token = env('SHEET_SYNC_TOKEN')
  if (!token) {
    return jawab({ ok: false, pesan: 'Secret SHEET_SYNC_TOKEN belum dipasang pada Edge Function.' }, 500)
  }
  const dikirim = permintaan.headers.get('x-sync-token')
    || new URL(permintaan.url).searchParams.get('token') || ''
  if (dikirim !== token) return jawab({ ok: false, pesan: 'Token tidak valid.' }, 401)

  let opsi: Record<string, unknown> = {}
  try { opsi = await permintaan.json() } catch { /* badan kosong diperbolehkan */ }

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const { data: setelanBaris, error: galatSetelan } = await db
      .from('notifikasi_setelan').select('*').eq('id', 1).maybeSingle()
    if (galatSetelan) throw new Error(`Gagal membaca setelan: ${galatSetelan.message}`)
    const setelan = setelanBaris || {
      aktif: false, batas_satuan_per_jalan: 8, ringkasan_aktif: true,
      jeda_ringkasan_menit: 180, terakhir_ringkasan_at: null,
      tunggu_klasifikasi_menit: 25, umur_maks_menit: 360,
    }

    const aksi = String(opsi.aksi ?? 'kirim')
    const kering = opsi.kering === true

    /* ------------------------------------------------------------- keadaan */

    if (aksi === 'keadaan') {
      const { data: antrean } = await db
        .from('notifikasi_antrean_siap').select('berita_id,prioritas,sentimen,ai_classified_at')
      const { data: rekap } = await db
        .from('notifikasi_berita').select('status')
      const perStatus: Record<string, number> = {}
      for (const r of rekap || []) perStatus[String(r.status)] = (perStatus[String(r.status)] || 0) + 1

      return jawab({
        ok: true, versi: VERSI, setelan,
        antrean_siap: (antrean || []).length,
        antrean_negatif: (antrean || []).filter((a) => a.prioritas <= 2).length,
        antrean_belum_dinilai: (antrean || []).filter((a) => !a.ai_classified_at).length,
        rekap_status: perStatus,
        durasi_ms: Date.now() - mulai,
      })
    }

    if (aksi !== 'kirim') {
      return jawab({ ok: false, pesan: `Aksi "${aksi}" tidak dikenal.`, aksi_tersedia: ['kirim', 'keadaan'] }, 400)
    }

    /* --------------------------------------------------------------- kirim */

    if (!setelan.aktif && !kering) {
      return jawab({
        ok: true, versi: VERSI, terkirim: 0,
        pesan: 'Sakelar notifikasi masih mati. Nyalakan lewat notifikasi_setelan.aktif.',
      })
    }

    const { data: antreanMentah, error: galatAntre } = await db
      .from('notifikasi_antrean_siap')
      .select('*')
      .order('prioritas', { ascending: true })
      .order('antre_at', { ascending: true })
      .limit(400)
    if (galatAntre) throw new Error(`Gagal membaca antrean: ${galatAntre.message}`)

    const antrean = (antreanMentah || []) as unknown as Antre[]
    const sekarang = Date.now()
    const batasTunggu = Number(setelan.tunggu_klasifikasi_menit) * 60_000
    const batasUmur = Number(setelan.umur_maks_menit) * 60_000

    const kedaluwarsa: Antre[] = []
    const ditahan: Antre[] = []
    const siap: Antre[] = []

    for (const b of antrean) {
      const umur = sekarang - new Date(b.antre_at).getTime()
      if (umur > batasUmur) { kedaluwarsa.push(b); continue }
      // Belum dinilai mesin dan masih dalam masa tunggu: biarkan mengantre.
      if (!b.ai_classified_at && umur < batasTunggu) { ditahan.push(b); continue }
      siap.push(b)
    }

    const negatif = siap.filter((b) => b.negatif)
    const lainnya = siap.filter((b) => !b.negatif)

    const batasSatuan = Math.max(0, Number(setelan.batas_satuan_per_jalan) || 0)
    const kirimSatuan = negatif.slice(0, batasSatuan)
    /* Negatif yang melebihi jatah TIDAK diturunkan ke ringkasan — ia tetap
       mengantre dan berangkat sebagai pesan utuh pada giliran berikutnya, lima
       menit lagi. Menurunkannya berarti berita terberat hari itu muncul sebagai
       satu baris di dalam daftar. */
    const negatifTertunda = negatif.slice(batasSatuan)

    const jedaRingkasan = Number(setelan.jeda_ringkasan_menit) * 60_000
    const sejakRingkasan = setelan.terakhir_ringkasan_at
      ? new Date(String(setelan.terakhir_ringkasan_at)).getTime()
      : 0
    const bolehRingkas = setelan.ringkasan_aktif
      && lainnya.length > 0
      && (sekarang - sejakRingkasan) >= jedaRingkasan

    const hasil = {
      satuan_terkirim: 0, satuan_gagal: 0,
      ringkasan_terkirim: 0, dalam_ringkasan: 0,
      ditahan: ditahan.length, kedaluwarsa: kedaluwarsa.length,
      negatif_tertunda: negatifTertunda.length,
    }
    const pratinjau: string[] = []

    /* ------------------------------------------------------- pesan satuan */

    for (const b of kirimSatuan) {
      const teks = pesanSatuan(b)
      if (kering) { pratinjau.push(teks); hasil.satuan_terkirim++; continue }

      const kirim = await kirimTelegram(token, {
        aksi: 'kirim', jenis: 'peringatan', pemicu: 'scheduled', teks,
      })
      if (kirim.ok) {
        hasil.satuan_terkirim++
        await tandai(db, b.berita_id, 'terkirim', 'satuan', kirim.message_id)
      } else {
        hasil.satuan_gagal++
        await tandaiGagal(db, b.berita_id, kirim.sebab)
      }
    }

    /* ---------------------------------------------------------- ringkasan */

    if (bolehRingkas) {
      const teks = pesanRingkasan(lainnya, setelan.terakhir_ringkasan_at)
      hasil.dalam_ringkasan = lainnya.length

      if (kering) {
        pratinjau.push(teks)
        hasil.ringkasan_terkirim = 1
      } else {
        const kirim = await kirimTelegram(token, {
          aksi: 'kirim', jenis: 'laporan', pemicu: 'scheduled', teks,
        })
        if (kirim.ok) {
          hasil.ringkasan_terkirim = 1
          for (const b of lainnya) await tandai(db, b.berita_id, 'terkirim', 'ringkasan', kirim.message_id)
          await db.from('notifikasi_setelan')
            .update({ terakhir_ringkasan_at: new Date().toISOString() }).eq('id', 1)
        } else {
          // Ringkasan yang gagal TIDAK ditandai gagal per baris: seluruh isinya
          // tetap mengantre dan ikut ringkasan berikutnya. Yang gagal satu
          // pesan, bukan lima puluh berita.
          hasil.satuan_gagal++
        }
      }
    }

    /* -------------------------------------------------------- kedaluwarsa */

    if (!kering) {
      for (const b of kedaluwarsa) {
        await tandai(db, b.berita_id, 'kedaluwarsa', null, null, null,
          'Melewati batas umur antrean; pemberitahuan yang terlambat menutupi yang sedang berjalan.')
      }
    }

    return jawab({
      ok: true,
      versi: VERSI,
      kering,
      aktif: setelan.aktif === true,
      antrean_dibaca: antrean.length,
      ...hasil,
      ringkasan_ditunda: !bolehRingkas && lainnya.length > 0,
      pratinjau: kering ? pratinjau : undefined,
      durasi_ms: Date.now() - mulai,
    })
  } catch (galat) {
    const pesan = galat instanceof Error ? (galat.stack || galat.message) : String(galat)
    console.error(pesan)
    return jawab({ ok: false, versi: VERSI, pesan, durasi_ms: Date.now() - mulai }, 500)
  }
})

/* ================================================================ pembantu */

async function kirimTelegram(
  token: string,
  badan: Record<string, unknown>,
): Promise<{ ok: boolean; message_id: string | null; sebab: string | null }> {
  try {
    const jawaban = await fetch(`${env('SUPABASE_URL')}/functions/v1/telegram-kirim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-token': token },
      body: JSON.stringify(badan),
    })
    const isi = await jawaban.json().catch(() => ({}))

    if (!jawaban.ok || Number(isi?.terkirim ?? 0) < 1) {
      const sebab = isi?.rincian?.[0]?.sebab || isi?.galat || `HTTP ${jawaban.status}`
      return { ok: false, message_id: null, sebab: String(sebab).slice(0, 500) }
    }
    return { ok: true, message_id: isi?.rincian?.[0]?.message_id ?? null, sebab: null }
  } catch (galat) {
    return { ok: false, message_id: null, sebab: String(galat).slice(0, 500) }
  }
}

async function tandai(
  db: ReturnType<typeof createClient>,
  beritaId: string,
  status: string,
  jalur: string | null,
  messageId: string | null = null,
  galat: string | null = null,
  alasan: string | null = null,
): Promise<void> {
  const { error } = await db.from('notifikasi_berita').update({
    status,
    jalur,
    message_id: messageId,
    galat,
    alasan,
    terkirim_at: status === 'terkirim' ? new Date().toISOString() : null,
  }).eq('berita_id', beritaId)

  /* Antrean yang gagal ditandai akan dikirim ulang pada giliran berikutnya —
     lebih baik satu pesan kembar daripada satu berita negatif yang hilang. */
  if (error) console.error(`Gagal menandai ${beritaId}: ${error.message}`)
}

/**
 * Berapa kali sebuah berita dicoba dikirim sebelum menyerah.
 *
 * Tiga, dan yang dijaga bukan kesopanan terhadap Telegram melainkan sesuatu
 * yang lebih mahal: kegagalan yang paling sering terjadi bersifat sementara —
 * grup sedang sibuk, jaringan tersendat, kunci sedang diganti. Menandainya
 * 'gagal' pada percobaan pertama berarti berita negatif itu TIDAK akan pernah
 * dikirim lagi, dan tidak ada yang akan tahu, sebab statusnya terlihat sudah
 * ditangani.
 */
const PERCOBAAN_MAKS = 3

async function tandaiGagal(
  db: ReturnType<typeof createClient>,
  beritaId: string,
  sebab: string | null,
): Promise<void> {
  const { data } = await db
    .from('notifikasi_berita').select('percobaan').eq('berita_id', beritaId).maybeSingle()
  const percobaan = Number(data?.percobaan ?? 0) + 1

  const { error } = await db.from('notifikasi_berita').update({
    percobaan,
    galat: sebab,
    // Masih di bawah batas: dibiarkan 'antre' supaya giliran berikutnya
    // mencobanya lagi.
    status: percobaan >= PERCOBAAN_MAKS ? 'gagal' : 'antre',
    alasan: percobaan >= PERCOBAAN_MAKS
      ? `Menyerah setelah ${PERCOBAAN_MAKS} percobaan.` : null,
  }).eq('berita_id', beritaId)

  if (error) console.error(`Gagal menandai kegagalan ${beritaId}: ${error.message}`)
}
