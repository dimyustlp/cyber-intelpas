/**
 * telegram-kirim — jembatan Trans-Siber PAS ke Telegram.
 *
 * Satu fungsi, lima pekerjaan, karena kelimanya memakai kunci yang sama dan
 * tidak ada gunanya menyebar kunci itu ke lima tempat berbeda:
 *
 *   diagnosa    memastikan kuncinya hidup, lalu menyebutkan grup mana saja
 *               yang sudah bisa dijangkau bot ini
 *   daftarkan   menyimpan sebuah grup sebagai tujuan pengiriman
 *   hapus       menonaktifkan sebuah grup tujuan
 *   uji         mengirim satu pesan percobaan ke satu grup
 *   kirim       mengirim pesan, dengan atau tanpa berkas lampiran
 *
 * Kunci botnya dibaca dari TELEGRAM_BOT_TOKEN dan tidak pernah dikembalikan
 * dalam jawaban apa pun — termasuk pada pesan galat. Nilai yang bocor lewat
 * pesan galat sama saja dengan nilai yang ditulis terbuka.
 *
 * ---------------------------------------------------------------------------
 * Dua jalan masuk, karena ada dua jenis pemanggil
 * ---------------------------------------------------------------------------
 *
 *   x-sync-token   dipakai penjadwal di dalam basis data (pg_cron lewat pg_net)
 *                  dan alur GitHub. Tidak ada pengguna di belakangnya.
 *
 *   Authorization  dipakai petugas yang sedang membuka halaman Integrasi di
 *                  peramban. Perannya diperiksa terhadap tabel app_users, bukan
 *                  dipercaya dari klaim di dalam token.
 *
 * Sebelum ini hanya jalur pertama yang ada, dan akibatnya seluruh penyiapan
 * Telegram — termasuk memeriksa kenapa kunci bot ditolak — hanya bisa dikerjakan
 * oleh orang yang memegang kunci peladen, lewat baris perintah. Itu sebabnya
 * penyiapannya tidak pernah selesai: yang tahu nilai kuncinya bukan yang bisa
 * menjalankan pemeriksaannya.
 */

const TELEGRAM = 'https://api.telegram.org'

const kepalaCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jawab(isi: unknown, status = 200): Response {
  return new Response(JSON.stringify(isi, null, 2), {
    status,
    headers: { ...kepalaCors, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

/**
 * Perbandingan yang tidak membocorkan panjang kecocokan lewat lama waktunya.
 * Berlebihan untuk kunci internal, tetapi murah dan menutup satu kelas
 * kesalahan yang tidak perlu dipikirkan lagi setelah ini.
 */
function samaAman(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let beda = 0
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return beda === 0
}

/** Membuang apa pun yang menyerupai kunci bot dari sebuah teks. */
function sensor(teks: string, kunci: string): string {
  if (!kunci) return teks
  return teks.split(kunci).join('«kunci disembunyikan»')
}

async function telegram(kunci: string, metode: string, muatan?: unknown) {
  const alamat = `${TELEGRAM}/bot${kunci}/${metode}`
  const pilihan: RequestInit = muatan
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(muatan),
      }
    : { method: 'GET' }

  const jawaban = await fetch(alamat, pilihan)
  const isi = await jawaban.json().catch(() => ({}))

  if (!jawaban.ok || isi?.ok === false) {
    const sebab = String(isi?.description || jawaban.statusText || 'tidak diketahui')
    throw new Error(`Telegram menolak ${metode}: ${sensor(sebab, kunci)}${artiGalat(jawaban.status, sebab)}`)
  }
  return isi.result
}

/**
 * Menerjemahkan penolakan Telegram menjadi kalimat yang menyebutkan apa yang
 * harus diperbaiki.
 *
 * Ini bukan hiasan. Antara 31 Agustus dan 2 September 2026, empat pengiriman
 * berturut-turut gagal dan yang tercatat di `telegram_deliveries` — satu-satunya
 * hal yang dibaca petugas — hanya berbunyi "Telegram menolak sendMessage: Not
 * Found". Kalimat itu benar dan tidak menolong siapa pun: ia tidak menyebut
 * bahwa yang salah kuncinya, bukan grupnya, sehingga penyiapannya berhari-hari
 * dicoba dari sisi yang keliru.
 *
 * Pembedaan yang paling menentukan, dan yang paling sering tertukar:
 *
 *   404 Not Found        — alamatnya yang tidak ada, artinya KUNCI botnya salah.
 *                          Telegram tidak pernah menjawab 404 karena grup.
 *   400 chat not found   — kuncinya benar, GRUP-nya yang tidak terjangkau.
 *   403 Forbidden        — kunci dan grup benar, botnya yang dikeluarkan atau
 *                          belum pernah dimasukkan ke grup itu.
 */
function artiGalat(status: number, sebab: string): string {
  const s = sebab.toLowerCase()

  if (status === 404 || s.includes('not found') && !s.includes('chat')) {
    return '. Galat 404 berarti alamat botnya sendiri tidak ditemukan — yang salah '
      + 'adalah secret TELEGRAM_BOT_TOKEN, bukan chat_id grupnya. Telegram tidak '
      + 'pernah menjawab 404 karena grup. Perbarui secret itu di Supabase, lalu '
      + 'tekan "Periksa sambungan" di halaman Integrasi.'
  }
  if (s.includes('chat not found')) {
    return '. Kuncinya sudah benar; yang tidak terjangkau grupnya. Untuk supergrup, '
      + 'chat_id berawalan -100 dan lebih panjang daripada id yang terlihat di '
      + 'sebagian aplikasi — periksa apakah awalan itu ikut tersalin.'
  }
  if (status === 403 || s.includes('forbidden') || s.includes('kicked') || s.includes('not a member')) {
    return '. Kunci dan grupnya benar, tetapi botnya tidak berada di dalam grup itu '
      + 'atau sudah dikeluarkan. Masukkan kembali botnya sebagai anggota.'
  }
  if (status === 429 || s.includes('too many requests')) {
    return '. Terlalu banyak permintaan dalam waktu singkat; Telegram membatasi '
      + 'sementara. Coba lagi beberapa menit kemudian.'
  }
  return ''
}

/** Mengirim satu berkas. Dipisah karena bentuk badannya bukan JSON. */
async function kirimBerkas(
  kunci: string,
  chatId: string,
  nama: string,
  isiBase64: string,
  keterangan?: string,
  utasan?: string | null,
) {
  const mentah = Uint8Array.from(atob(isiBase64), (c) => c.charCodeAt(0))
  const borang = new FormData()
  borang.append('chat_id', chatId)
  if (utasan) borang.append('message_thread_id', utasan)
  if (keterangan) {
    borang.append('caption', keterangan.slice(0, 1024))
    borang.append('parse_mode', 'HTML')
  }
  borang.append('document', new Blob([mentah]), nama)

  const jawaban = await fetch(`${TELEGRAM}/bot${kunci}/sendDocument`, {
    method: 'POST',
    body: borang,
  })
  const isi = await jawaban.json().catch(() => ({}))
  if (!jawaban.ok || isi?.ok === false) {
    throw new Error(`Telegram menolak berkas ${nama}: ${sensor(String(isi?.description || ''), kunci)}`)
  }
  return isi.result
}

/**
 * Memeriksa bentuk kunci bot tanpa membocorkan isinya.
 *
 * Ketika Telegram menjawab "Not Found", yang salah hampir selalu bukan
 * botnya melainkan apa yang tertempel: ada spasi ikut tersalin, potongannya
 * kurang, atau yang tertempel ternyata bukan kunci sama sekali. Ketiganya
 * tidak bisa dibedakan dari pesan galat Telegram, dan menebak-nebak lewat
 * percakapan hanya membuang waktu orang.
 *
 * Kunci bot berbentuk dua bagian dipisah titik dua: nomor bot, lalu bagian
 * rahasianya. Nomor bot bukan rahasia — ia muncul juga pada jawaban getMe —
 * jadi aman ditampilkan. Bagian setelah titik dua tidak pernah ditampilkan,
 * hanya dihitung panjangnya.
 */
function periksaBentukKunci(kunci: string) {
  const adaSpasiTepi = kunci !== kunci.trim()
  const bersih = kunci.trim()
  const adaKutip = /^["'].*["']$/.test(bersih)
  const adaBarisBaru = /[\r\n]/.test(kunci)
  const bagian = bersih.split(':')

  const temuan: string[] = []
  if (adaSpasiTepi) temuan.push('Ada spasi atau baris kosong ikut tersalin di awal/akhir.')
  if (adaBarisBaru) temuan.push('Ada pindah baris di dalam nilainya.')
  if (adaKutip) temuan.push('Nilainya diapit tanda kutip — tanda kutipnya tidak perlu ikut ditempel.')
  if (bersih.startsWith('bot')) temuan.push('Nilainya diawali kata "bot"; yang ditempel cukup kuncinya saja.')
  if (bersih.startsWith('@')) temuan.push('Yang tertempel sepertinya nama pengguna bot, bukan kuncinya.')
  if (bagian.length !== 2) {
    temuan.push(`Kunci bot seharusnya berbentuk «nomor»:«rahasia» — ditemukan ${bagian.length - 1} tanda titik dua.`)
  } else {
    if (!/^\d{6,12}$/.test(bagian[0])) temuan.push('Bagian sebelum titik dua bukan nomor bot yang wajar.')
    if (bagian[1].length < 30) temuan.push(`Bagian sesudah titik dua terlalu pendek (${bagian[1].length} karakter, biasanya 35).`)
    if (!/^[A-Za-z0-9_-]+$/.test(bagian[1])) temuan.push('Bagian sesudah titik dua memuat karakter yang tidak lazim.')
  }

  // Kalau yang tertempel jelas-jelas bukan kunci bot, sering kali ia sesuatu
  // yang lain yang kebetulan ada di papan salin. Awalan format berikut bukan
  // rahasia — ia penanda jenis, bukan isi — dan menyebutkannya menghemat satu
  // putaran tanya-jawab.
  let dugaan: string | null = null
  if (/^eyJ/.test(bersih)) dugaan = 'Ini tampaknya JWT (kunci lama Supabase), bukan kunci bot Telegram.'
  else if (/^sb_/.test(bersih)) dugaan = 'Ini tampaknya kunci Supabase, bukan kunci bot Telegram.'
  else if (/^https?:\/\//.test(bersih)) dugaan = 'Ini tampaknya sebuah alamat web, bukan kunci bot.'
  else if (/^AA[A-Za-z0-9_-]{30,}$/.test(bersih)) {
    dugaan = 'Ini tampaknya HANYA bagian rahasia kunci bot — bagian nomor bot dan titik duanya '
      + 'tertinggal saat menyalin. Salin ulang dari awal baris.'
  } else if (/^\d+$/.test(bersih)) dugaan = 'Ini hanya deretan angka; sepertinya nomor bot saja tanpa bagian rahasianya.'

  const huruf = (bersih.match(/[A-Za-z]/g) || []).length
  const angka = (bersih.match(/\d/g) || []).length

  /**
   * Kalau nilainya sama sekali tidak memuat huruf maupun angka, ia sudah pasti
   * bukan kunci bot — dan pada keadaan itu saja, jenis karakternya boleh
   * disebutkan. Penjagaan ini penting: pada nilai yang benar-benar kunci,
   * bagian ini tidak pernah dijalankan, sehingga tidak ada satu karakter pun
   * dari kunci asli yang bisa bocor lewat jalur ini.
   */
  let karakter: Record<string, unknown> | null = null
  let bertitik = false
  if (huruf === 0 && angka === 0 && bersih.length > 0) {
    const unik = [...new Set([...bersih])]
    bertitik = unik.every((c) => '•·*●∙.�▪․'.includes(c))
    karakter = {
      seragam: unik.length === 1,
      jenis_berbeda: unik.length,
      titik_kode: unik.slice(0, 6).map((c) => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')),
      terlihat_seperti_penyamaran: bertitik,
    }
  }

  /**
   * Satu kalimat yang bisa langsung dibaca petugas, tanpa perlu menafsirkan
   * daftar temuan di atasnya. Halaman Integrasi menampilkan kalimat ini apa
   * adanya, jadi ia harus berdiri sendiri.
   */
  let ringkas = 'Bentuk kunci tampak wajar.'
  if (huruf === 0 && angka === 0 && bersih.length > 0) {
    ringkas = 'Yang tersimpan bukan kuncinya, melainkan tampilan bertitik yang menyamarkan kunci. '
      + 'Titik-titik itu memang yang terlihat di layar, tetapi bukan yang tersalin ketika kunci '
      + 'disalin dengan benar. Ambil kuncinya dari pesan BotFather, bukan dari kolom yang sudah '
      + 'disamarkan.'
  } else if (dugaan) ringkas = dugaan
  else if (temuan.length) ringkas = temuan[0]

  return {
    panjang_total: kunci.length,
    nomor_bot: bagian.length === 2 && /^\d+$/.test(bagian[0]) ? bagian[0] : null,
    panjang_bagian_rahasia: bagian.length === 2 ? bagian[1].length : null,
    karakter,
    // Susunan karakter, bukan isinya. Cukup untuk mengenali jenis nilai yang
    // tertempel tanpa menampilkan satu pun karakternya.
    susunan: {
      huruf,
      angka,
      titik_dua: (bersih.match(/:/g) || []).length,
      lainnya: (bersih.match(/[^A-Za-z0-9:]/g) || []).length,
    },
    dugaan,
    ringkas,
    bentuk_wajar: temuan.length === 0,
    temuan,
  }
}

/* ------------------------------------------------------------- basis data */

const URL_DB = Deno.env.get('SUPABASE_URL') ?? ''
const KUNCI_DB = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

async function keDb(jalur: string, pilihan: RequestInit = {}) {
  const jawaban = await fetch(`${URL_DB}/rest/v1/${jalur}`, {
    ...pilihan,
    headers: {
      apikey: KUNCI_DB,
      Authorization: `Bearer ${KUNCI_DB}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(pilihan.headers || {}),
    },
  })
  const teks = await jawaban.text()
  if (!jawaban.ok) throw new Error(`Basis data menolak: ${teks.slice(0, 300)}`)
  return teks ? JSON.parse(teks) : null
}

/**
 * Nilai status dan jenis mengikuti batasan CHECK pada tabelnya.
 *
 * Sebelum ini fungsi menuliskan "Berhasil" dan "Gagal" dalam bahasa Indonesia,
 * yang ditolak oleh telegram_deliveries_status_check pada setiap baris — dan
 * karena kegagalan mencatat sengaja ditelan agar tidak menjatuhkan pengiriman
 * yang sudah berhasil, tabel jejaknya diam-diam tetap kosong. Bukti pengiriman
 * yang seharusnya tersimpan di sana tidak pernah ada satu baris pun.
 */
const STATUS_DB = { berhasil: 'sent', gagal: 'failed' } as const
const JENIS_DB: Record<string, string> = {
  uji: 'test',
  laporan: 'report',
  peringatan: 'urgent_alert',
  kasus: 'case_update',
}

/**
 * Mencari baris integrasi Telegram, membuatnya bila belum ada.
 *
 * `telegram_targets.integration_id` berstatus NOT NULL dan menunjuk ke
 * `integration_settings`. Sebelum ini aksi daftarkan tidak pernah mengisinya,
 * sehingga setiap pendaftaran grup ditolak basis data — dan karena penolakan
 * itu muncul sebagai galat umum "Basis data menolak", yang terbaca petugas
 * hanyalah bahwa penyimpanan gagal, bukan bahwa ada kolom wajib yang tidak
 * pernah diisi. Itu sebabnya tabel tujuannya tetap kosong meskipun kunci bot
 * sudah benar dan grupnya sudah terdeteksi.
 *
 * Nilai kunci bot tidak ikut disimpan di sini. Yang disimpan hanya NAMA
 * secret-nya, sebagai penunjuk ke tempat kunci itu sebenarnya hidup.
 */
async function integrasiTelegram(): Promise<string> {
  const ada = await keDb('integration_settings?provider=eq.telegram&select=id&limit=1')
  if (ada?.length) return String(ada[0].id)

  const baru = await keDb('integration_settings', {
    method: 'POST',
    body: JSON.stringify({
      provider: 'telegram',
      label: 'Bot Telegram Trans-Siber PAS',
      is_active: true,
      secret_vault_name: 'TELEGRAM_BOT_TOKEN',
    }),
  })
  return String(baru?.[0]?.id ?? '')
}

async function catat(baris: Record<string, unknown>) {
  try {
    await keDb('telegram_deliveries', { method: 'POST', body: JSON.stringify(baris) })
  } catch (galat) {
    // Kegagalan mencatat tidak boleh menjatuhkan pengiriman yang sudah berhasil.
    console.error('Gagal mencatat pengiriman:', String(galat))
  }
}

/* ------------------------------------------------------------ pembuktian */

/** Peran yang boleh menyentuh pengaturan integrasi. */
const PERAN_ADMIN = new Set(['super_admin'])
/** Peran yang boleh menekan tombol kirim, tetapi tidak mengubah pengaturan. */
const PERAN_KIRIM = new Set(['super_admin', 'media_intelligence_analyst'])

type Pemanggil = { jenis: 'peladen' } | { jenis: 'petugas'; surel: string; peran: string; nama: string }

/**
 * Menentukan siapa yang memanggil.
 *
 * Peran tidak pernah diambil dari klaim di dalam token. Token hanya dipakai
 * untuk memastikan siapa orangnya; perannya dibaca ulang dari app_users setiap
 * kali. Klaim di dalam token adalah salinan yang bisa basi — kalau seseorang
 * diturunkan perannya pagi ini, token yang ia pegang sejak kemarin tidak ikut
 * berubah dengan sendirinya.
 */
async function kenali(permintaan: Request, kunciBersama: string): Promise<Pemanggil | null> {
  const sync = permintaan.headers.get('x-sync-token') ?? ''
  if (sync && kunciBersama && samaAman(sync, kunciBersama)) return { jenis: 'peladen' }

  const tajuk = permintaan.headers.get('Authorization') ?? ''
  const token = tajuk.startsWith('Bearer ') ? tajuk.slice(7).trim() : ''
  if (!token) return null

  // Kunci publishable ikut terkirim sebagai Bearer oleh sebagian pustaka.
  // Nilai itu bukan sesi siapa pun dan tidak boleh diperlakukan sebagai sesi.
  if (token.startsWith('sb_')) return null

  const jawaban = await fetch(`${URL_DB}/auth/v1/user`, {
    headers: { apikey: KUNCI_DB, Authorization: `Bearer ${token}` },
  })
  if (!jawaban.ok) return null

  const pengguna = await jawaban.json().catch(() => null)
  const surel = String(pengguna?.email ?? '').toLowerCase()
  if (!surel) return null

  const baris = await keDb(
    `app_users?select=role,full_name,aktif&email=eq.${encodeURIComponent(surel)}&limit=1`,
  )
  const profil = baris?.[0]
  if (!profil || profil.aktif === false) return null

  return { jenis: 'petugas', surel, peran: String(profil.role ?? ''), nama: String(profil.full_name ?? surel) }
}

function bolehAksi(pemanggil: Pemanggil, aksi: string): boolean {
  if (pemanggil.jenis === 'peladen') return true
  if (aksi === 'uji' || aksi === 'kirim') return PERAN_KIRIM.has(pemanggil.peran)
  return PERAN_ADMIN.has(pemanggil.peran)
}

/* ------------------------------------------------------------------ pintu */

Deno.serve(async (permintaan) => {
  if (permintaan.method === 'OPTIONS') return new Response('ok', { headers: kepalaCors })
  if (permintaan.method !== 'POST') return jawab({ galat: 'Hanya menerima POST.' }, 405)

  const kunciBersama = Deno.env.get('SHEET_SYNC_TOKEN') ?? ''

  let badan: Record<string, unknown> = {}
  try { badan = await permintaan.json() } catch { /* badan kosong dianggap diagnosa */ }
  const aksi = String(badan.aksi ?? 'diagnosa')

  const pemanggil = await kenali(permintaan, kunciBersama).catch(() => null)
  if (!pemanggil) {
    return jawab({
      galat: 'Permintaan tidak dapat dibuktikan.',
      petunjuk: 'Masuk sebagai administrator sistem, atau sertakan tajuk x-sync-token yang sah.',
    }, 401)
  }
  if (!bolehAksi(pemanggil, aksi)) {
    return jawab({ galat: `Peran Anda tidak berhak menjalankan aksi "${aksi}".` }, 403)
  }

  const kunciBot = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''
  if (!kunciBot) {
    return jawab({
      galat: 'TELEGRAM_BOT_TOKEN belum diisi.',
      terpasang: false,
      tersambung: false,
      petunjuk:
        'Tempelkan kunci bot pada Supabase → Project Settings → Edge Functions → Secrets '
        + 'dengan nama TELEGRAM_BOT_TOKEN, lalu ulangi permintaan ini.',
    }, 503)
  }

  const oleh = pemanggil.jenis === 'petugas' ? pemanggil.nama : String(badan.oleh ?? 'penjadwal')

  try {
    /* ------------------------------------------------------------ diagnosa */
    if (aksi === 'diagnosa') {
      const bentuk = periksaBentukKunci(kunciBot)

      // Kalau bentuknya sudah jelas keliru, tidak ada gunanya bertanya ke
      // Telegram — jawabannya pasti "Not Found" dan tidak menjelaskan apa pun.
      if (!bentuk.bentuk_wajar) {
        return jawab({
          galat: 'Kunci bot yang tertempel bentuknya tidak wajar, jadi belum dicoba ke Telegram.',
          terpasang: true,
          tersambung: false,
          pemeriksaan_kunci: bentuk,
          petunjuk:
            'Buka BotFather → /mybots → pilih bot → API Token, salin ulang kuncinya utuh '
            + '(termasuk angka sebelum titik dua), lalu tempel ulang sebagai TELEGRAM_BOT_TOKEN '
            + 'tanpa spasi dan tanpa tanda kutip.',
        }, 400)
      }

      let bot: Record<string, unknown>
      try {
        bot = await telegram(kunciBot, 'getMe')
      } catch (galat) {
        return jawab({
          galat: sensor(String((galat as Error).message ?? galat), kunciBot),
          terpasang: true,
          tersambung: false,
          pemeriksaan_kunci: bentuk,
          petunjuk:
            'Bentuk kuncinya wajar, tetapi Telegram tidak mengenalinya. Biasanya karena kunci '
            + 'ini sudah dicabut lewat Revoke dan yang tertempel masih yang lama. Ambil kunci '
            + 'terbaru dari BotFather → /mybots → pilih bot → API Token, lalu tempel ulang.',
        }, 400)
      }
      const kabar = await telegram(kunciBot, 'getUpdates?limit=100&allowed_updates=%5B%22message%22%5D')

      // Satu grup bisa muncul berkali-kali di riwayat; yang dibutuhkan hanya
      // daftar uniknya.
      const grup = new Map<string, Record<string, unknown>>()
      for (const k of (kabar ?? []) as Array<Record<string, any>>) {
        const pesan = k.message ?? k.channel_post ?? k.my_chat_member
        const obrolan = pesan?.chat
        if (!obrolan?.id) continue
        grup.set(String(obrolan.id), {
          chat_id: String(obrolan.id),
          nama: obrolan.title ?? obrolan.username ?? obrolan.first_name ?? '(tanpa nama)',
          jenis: obrolan.type,
          utasan: pesan?.message_thread_id ? String(pesan.message_thread_id) : null,
        })
      }

      const tersimpan = await keDb(
        'telegram_targets?select=id,chat_id,label,is_active,message_thread_id,report_types,send_urgent_alert,min_classification&order=created_at',
      )

      /*
         Tiap grup tersimpan diperiksa sendiri lewat getChat.

         Daftar di atasnya tidak cukup untuk menjawab "apakah laporan akan
         sampai", dan ketidakcukupan itu tidak kelihatan: getUpdates hanya
         menyimpan kabar 24 jam terakhir DAN mengosongkan kabar yang sudah
         terbaca, sehingga diagnosa kedua pada hari yang sama selalu
         mengembalikan daftar kosong meskipun botnya betul-betul ada di dalam
         grup. Yang terbaca petugas adalah "belum ada grup terdeteksi" —
         kalimat yang menyuruhnya mengulangi langkah yang sudah benar.

         getChat menjawab pertanyaan yang sebenarnya, sekali untuk tiap grup
         yang sudah didaftarkan, dan tidak mengirim apa pun ke grup mana pun.
         Kegagalan satu grup tidak menjatuhkan diagnosa: alasannya dicatat di
         barisnya sendiri, sebab justru grup yang gagal itulah yang sedang
         dicari.
      */
      const diperiksa = await Promise.all(
        ((tersimpan ?? []) as Array<Record<string, any>>).map(async (t) => {
          try {
            const obrolan = await telegram(
              kunciBot,
              `getChat?chat_id=${encodeURIComponent(String(t.chat_id))}`,
            ) as Record<string, any>
            return {
              ...t,
              terjangkau: true,
              nama_di_telegram: obrolan?.title ?? obrolan?.username ?? obrolan?.first_name ?? null,
              jenis: obrolan?.type ?? null,
            }
          } catch (galat) {
            return {
              ...t,
              terjangkau: false,
              sebab: sensor(String((galat as Error).message ?? galat), kunciBot),
            }
          }
        }),
      )

      const tidakTerjangkau = diperiksa.filter((t) => !t.terjangkau)

      return jawab({
        terpasang: true,
        tersambung: true,
        bot: { nama: bot?.first_name, pengguna: bot?.username, id: bot?.id },
        pemeriksaan_kunci: bentuk,
        grup_terdeteksi: [...grup.values()],
        grup_tersimpan: diperiksa,
        /*
           Satu kalimat yang menyebut keadaan yang paling menentukan lebih
           dahulu. Grup tersimpan yang tidak terjangkau adalah kegagalan yang
           sedang berlangsung — laporan hariannya gagal terkirim setiap pagi —
           sedangkan daftar deteksi yang kosong belum tentu apa-apa.
        */
        catatan: tidakTerjangkau.length
          ? `${tidakTerjangkau.length} dari ${diperiksa.length} grup tersimpan tidak bisa dijangkau bot ini. `
            + 'Lihat sebabnya pada tiap barisnya. Yang paling sering: botnya belum dimasukkan ke '
            + 'grup itu, sudah dikeluarkan, atau chat_id-nya keliru — grup yang sudah menjadi '
            + 'supergrup berganti nomor, dari bentuk -123456789 menjadi -100123456789.'
          : diperiksa.length
            ? 'Seluruh grup tersimpan bisa dijangkau bot ini.'
            : grup.size === 0
              ? 'Belum ada grup terdeteksi dan belum ada grup tersimpan. Masukkan bot ke grup, '
                + 'kirim satu pesan apa saja di grup itu, lalu ulangi diagnosa.'
              : 'Grup di atas sudah bisa dijangkau bot ini.',
      })
    }

    /* ---------------------------------------------------------- daftarkan */
    if (aksi === 'daftarkan') {
      const chatId = String(badan.chat_id ?? '')
      if (!chatId) return jawab({ galat: 'chat_id wajib diisi.' }, 400)

      const sudah = await keDb(`telegram_targets?chat_id=eq.${encodeURIComponent(chatId)}&select=id`)
      const isi: Record<string, unknown> = {
        label: String(badan.label ?? 'Grup Telegram'),
        chat_id: chatId,
        message_thread_id: badan.message_thread_id ?? null,
        min_classification: String(badan.klasifikasi ?? 'Internal'),
        report_types: badan.jenis_laporan ?? ['harian', 'mingguan'],
        send_urgent_alert: badan.kirim_mendesak ?? true,
        is_active: badan.aktif ?? true,
        updated_at: new Date().toISOString(),
      }

      // Kolom wajib ini hanya diperlukan saat baris baru dibuat. Pada
      // pembaruan, baris lamanya sudah menunjuk ke integrasi yang benar.
      const hasil = sudah?.length
        ? await keDb(`telegram_targets?id=eq.${sudah[0].id}`, { method: 'PATCH', body: JSON.stringify(isi) })
        : await keDb('telegram_targets', {
            method: 'POST',
            body: JSON.stringify({ ...isi, integration_id: await integrasiTelegram() }),
          })

      return jawab({ tersimpan: hasil?.[0] ?? isi, diperbarui: Boolean(sudah?.length), oleh })
    }

    /* --------------------------------------------------------------- hapus */
    if (aksi === 'hapus') {
      const id = String(badan.id ?? '')
      if (!id) return jawab({ galat: 'id wajib diisi.' }, 400)
      // Tujuan tidak benar-benar dihapus. Jejak pengiriman menunjuk ke baris
      // ini, dan riwayat yang kehilangan tujuannya berhenti bisa dijelaskan.
      const hasil = await keDb(`telegram_targets?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }),
      })
      return jawab({ dinonaktifkan: hasil?.[0] ?? null, oleh })
    }

    /* ----------------------------------------------------------- uji/kirim */
    if (aksi === 'uji' || aksi === 'kirim') {
      let tujuan: Array<Record<string, any>>
      if (badan.chat_id) {
        tujuan = [{ chat_id: String(badan.chat_id), message_thread_id: badan.message_thread_id ?? null, label: 'manual' }]
      } else {
        tujuan = (await keDb('telegram_targets?is_active=eq.true&select=id,chat_id,message_thread_id,label')) ?? []
      }
      if (!tujuan.length) {
        return jawab({ galat: 'Belum ada grup tujuan yang aktif. Jalankan aksi daftarkan lebih dulu.' }, 400)
      }

      const teks = aksi === 'uji'
        ? String(badan.teks
          ?? '<b>Trans-Siber PAS tersambung.</b>\nPesan ini pesan percobaan. '
             + 'Bila Anda membacanya, jalur pengiriman laporan sudah siap dipakai.')
        : String(badan.teks ?? '')
      const dokumen = Array.isArray(badan.dokumen) ? badan.dokumen : []

      const jenisMinta = aksi === 'uji' ? 'uji' : String(badan.jenis ?? 'laporan')
      const jenisDb = JENIS_DB[jenisMinta] ?? 'report'

      const hasil: Array<Record<string, unknown>> = []
      for (const t of tujuan) {
        const dasar: Record<string, unknown> = {
          target_id: t.id ?? null,
          delivery_type: jenisDb,
          trigger_type: String(badan.pemicu ?? (pemanggil.jenis === 'peladen' ? 'scheduled' : 'manual')),
          chat_id: t.chat_id,
          caption: teks.slice(0, 500),
          documents: dokumen.map((d: any) => ({ nama: d.nama })),
          requested_by: oleh,
        }

        try {
          let idPesan: string | null = null
          if (teks) {
            const pesan = await telegram(kunciBot, 'sendMessage', {
              chat_id: t.chat_id,
              message_thread_id: t.message_thread_id ?? undefined,
              text: teks,
              parse_mode: 'HTML',
              disable_web_page_preview: true,
            })
            idPesan = String(pesan?.message_id ?? '')
          }

          for (const d of dokumen) {
            await kirimBerkas(kunciBot, t.chat_id, String(d.nama), String(d.isi_base64),
              d.keterangan ? String(d.keterangan) : undefined, t.message_thread_id)
          }

          await catat({ ...dasar, status: STATUS_DB.berhasil, attempt: 1, message_id: idPesan,
            delivered_at: new Date().toISOString() })
          hasil.push({ chat_id: t.chat_id, label: t.label, status: 'Berhasil', message_id: idPesan })
        } catch (galat) {
          const sebab = sensor(String((galat as Error).message ?? galat), kunciBot)
          await catat({ ...dasar, status: STATUS_DB.gagal, attempt: 1, error_detail: sebab })
          hasil.push({ chat_id: t.chat_id, label: t.label, status: 'Gagal', sebab })
        }
      }

      const gagal = hasil.filter((h) => h.status === 'Gagal').length
      return jawab({ terkirim: hasil.length - gagal, gagal, rincian: hasil }, gagal && !(hasil.length - gagal) ? 502 : 200)
    }

    return jawab({
      galat: `Aksi "${aksi}" tidak dikenal.`,
      aksi_tersedia: ['diagnosa', 'daftarkan', 'hapus', 'uji', 'kirim'],
    }, 400)
  } catch (galat) {
    return jawab({ galat: sensor(String((galat as Error).message ?? galat), kunciBot) }, 500)
  }
})
