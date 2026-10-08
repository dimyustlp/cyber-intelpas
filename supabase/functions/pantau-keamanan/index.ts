/**
 * Edge Function: pantau-keamanan
 *
 * Pelengkap pantau-masuk. Dua pekerjaan:
 *
 *   lapor_gagal  Dipanggil halaman login (tanpa sesi, karena penggunanya belum
 *                masuk) setiap kali sebuah percobaan login ditolak. Dicatat ke
 *                `login_gagal`; bila satu akun gagal 5 kali atau satu alamat
 *                jaringan gagal 10 kali dalam 15 menit, tercatat sebuah
 *                peringatan dan Telegram pemilik berbunyi.
 *
 *   kabar        Dipanggil basis data (x-sync-token) untuk meneruskan sebuah
 *                baris `peringatan_keamanan` ke Telegram pemilik.
 *
 * Batas yang perlu diketahui: yang terlihat hanya percobaan yang lewat halaman
 * login aplikasi. Penyerang yang memanggil layanan autentikasi langsung tidak
 * melewati halaman itu dan tidak tercatat di sini.
 *
 * Jalan `lapor_gagal` terbuka untuk siapa saja, jadi ia dijaga: panjang isian
 * dibatasi, pencatatan per alamat jaringan dibatasi 60 per jam, dan satu
 * peringatan yang sama tidak diulang dalam satu jam.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const KEPALA = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const AMBANG_AKUN = 5
const AMBANG_IP = 10
const JENDELA_MENIT = 15
const BATAS_CATAT_PER_JAM = 60

function env(nama: string): string {
  return Deno.env.get(nama)?.trim() || ''
}

function jawab(isi: unknown, status = 200): Response {
  return new Response(JSON.stringify(isi), { status, headers: KEPALA })
}

function html(t: unknown): string {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function samaAman(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false
  let beda = 0
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return beda === 0
}

function ipDariTajuk(req: Request): string {
  const calon = [
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    (req.headers.get('x-forwarded-for') || '').split(',')[0],
  ]
  for (const c of calon) {
    const t = String(c || '').trim()
    if (t) return t.slice(0, 64)
  }
  return ''
}

function waktuWib(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso)) + ' WIB'
}

// deno-lint-ignore no-explicit-any
async function kirimTelegram(admin: any, teks: string): Promise<boolean> {
  const kunci = env('TELEGRAM_BOT_TOKEN')
  if (!kunci) return false
  const { data } = await admin.from('app_users').select('telegram_chat_pribadi')
    .eq('pemilik_sistem', true).eq('aktif', true).not('telegram_chat_pribadi', 'is', null)
  let terkirim = false
  for (const o of (data || []) as { telegram_chat_pribadi: string }[]) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${kunci}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: o.telegram_chat_pribadi, text: teks, parse_mode: 'HTML', disable_web_page_preview: true }),
      })
      const isi = await r.json().catch(() => ({}))
      if (r.ok && isi?.ok) terkirim = true
      else console.warn('Telegram menolak:', isi?.description)
    } catch (e) {
      console.warn('Pesan ke pemilik gagal:', (e as Error).message)
    }
  }
  return terkirim
}

const NAMA_TABEL: Record<string, string> = {
  telegram_targets: 'tujuan Telegram',
  notifikasi_setelan: 'setelan notifikasi',
  notifikasi_rute: 'rute notifikasi',
  integration_settings: 'integrasi',
  report_schedules: 'jadwal laporan',
}

function susunPesan(p: Record<string, any>): string {
  const r = (p.rincian || {}) as Record<string, any>
  const lencana = p.tingkat === 'bahaya' ? '🚨' : '⚠️'
  const baris: (string | null)[] = [`${lencana} <b>${html(p.judul)}</b>`, '']

  if (p.jenis === 'login_gagal_akun') {
    baris.push(`Akun <b>${html(r.username)}</b>${r.akun_dikenal ? '' : ' (nama ini tidak terdaftar)'}`,
      `${html(r.jumlah)} percobaan ditolak dalam ${JENDELA_MENIT} menit`,
      r.jumlah_ip ? `Dari ${html(r.jumlah_ip)} alamat jaringan berbeda` : null)
  } else if (p.jenis === 'login_gagal_ip') {
    baris.push(`Alamat jaringan <b>${html(r.ip)}</b>`,
      `${html(r.jumlah)} percobaan ditolak dalam ${JENDELA_MENIT} menit`,
      r.jumlah_akun ? `Mencoba ${html(r.jumlah_akun)} nama akun berbeda` : null)
  } else if (p.jenis === 'ubah_pengaturan') {
    const kolom = Array.isArray(r.kolom) && r.kolom.length ? r.kolom.join(', ') : null
    baris.push(`Bagian: ${html(NAMA_TABEL[r.tabel] || r.tabel)}`,
      kolom ? `Isian yang berubah: ${html(kolom)}` : null,
      '<i>Nilai isiannya tidak dikirim lewat Telegram.</i>')
  } else if (p.jenis === 'hapus_berita') {
    baris.push(`${html(r.jumlah)} berita dihapus dalam waktu singkat`)
  } else if (p.jenis === 'bekukan_akses') {
    baris.push('Semua sesi selain Pemilik Sistem diakhiri dan login baru ditolak.',
      r.alasan ? `Alasan: ${html(r.alasan)}` : null)
  }
  if (p.pelaku) baris.push('', `Oleh: ${html(p.pelaku)}`)
  baris.push(`🕒 ${html(waktuWib(p.waktu || new Date().toISOString()))}`)
  return baris.filter((b) => b !== null).join('\n')
}

// deno-lint-ignore no-explicit-any
async function laporGagal(admin: any, req: Request, badan: Record<string, any>) {
  const username = String(badan?.username || '').trim().toLowerCase().slice(0, 80)
  const ip = ipDariTajuk(req)
  const agen = (req.headers.get('user-agent') || '').slice(0, 300)
  if (!username) return { ok: false, pesan: 'Nama pengguna kosong.' }

  const sejakJam = new Date(Date.now() - 3_600_000).toISOString()
  if (ip) {
    const { count } = await admin.from('login_gagal')
      .select('id', { count: 'exact', head: true }).eq('ip', ip).gte('waktu', sejakJam)
    if ((count ?? 0) >= BATAS_CATAT_PER_JAM) return { ok: true, dibatasi: true }
  }

  await admin.from('login_gagal').insert({ username_dicoba: username, ip: ip || null, agen_pengguna: agen || null })

  const sejak = new Date(Date.now() - JENDELA_MENIT * 60_000).toISOString()
  const sejakPeringatan = new Date(Date.now() - 3_600_000).toISOString()
  const dibuat: string[] = []

  async function peringatkan(jenis: string, kunci: string, tingkat: string, judul: string, rincian: Record<string, unknown>) {
    const { data: ada } = await admin.from('peringatan_keamanan').select('id')
      .eq('jenis', jenis).eq('rincian->>kunci', kunci).gte('waktu', sejakPeringatan).limit(1)
    if (ada?.length) return
    const { data: baru, error } = await admin.from('peringatan_keamanan')
      .insert({ jenis, tingkat, judul, rincian: { ...rincian, kunci }, pelaku: null })
      .select('id,waktu,jenis,tingkat,judul,rincian,pelaku').single()
    if (error || !baru) return
    const terkirim = await kirimTelegram(admin, susunPesan(baru))
    if (terkirim) await admin.from('peringatan_keamanan').update({ telegram_terkirim: true }).eq('id', baru.id)
    dibuat.push(jenis)
  }

  const { data: perAkun } = await admin.from('login_gagal').select('ip')
    .eq('username_dicoba', username).gte('waktu', sejak).limit(500)
  const jumlahAkun = perAkun?.length ?? 0
  if (jumlahAkun >= AMBANG_AKUN) {
    const { data: dikenal } = await admin.from('app_users').select('id').ilike('username', username).limit(1)
    const ipBeda = new Set((perAkun || []).map((b: any) => b.ip).filter(Boolean)).size
    await peringatkan('login_gagal_akun', username, jumlahAkun >= AMBANG_AKUN * 3 ? 'bahaya' : 'perhatian',
      'Percobaan login berulang pada satu akun',
      { username, jumlah: jumlahAkun, jumlah_ip: ipBeda, akun_dikenal: !!dikenal?.length })
  }

  if (ip) {
    const { data: perIp } = await admin.from('login_gagal').select('username_dicoba')
      .eq('ip', ip).gte('waktu', sejak).limit(500)
    const jumlahIp = perIp?.length ?? 0
    if (jumlahIp >= AMBANG_IP) {
      const akunBeda = new Set((perIp || []).map((b: any) => b.username_dicoba).filter(Boolean)).size
      await peringatkan('login_gagal_ip', ip, jumlahIp >= AMBANG_IP * 3 ? 'bahaya' : 'perhatian',
        'Percobaan login berulang dari satu alamat jaringan',
        { ip, jumlah: jumlahIp, jumlah_akun: akunBeda })
    }
  }
  return { ok: true, peringatan: dibuat }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: KEPALA })
  if (req.method !== 'POST') return jawab({ ok: false, pesan: 'Hanya menerima POST.' }, 405)

  try {
    const url = env('SUPABASE_URL')
    const kunciLayanan = env('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !kunciLayanan) return jawab({ ok: false, pesan: 'Fungsi belum dikonfigurasi di peladen.' }, 500)
    const admin = createClient(url, kunciLayanan, { auth: { persistSession: false, autoRefreshToken: false } })
    const badan = await req.json().catch(() => ({}))
    const aksi = String(badan?.aksi || '')

    if (aksi === 'lapor_gagal') return jawab(await laporGagal(admin, req, badan))

    const token = req.headers.get('x-sync-token') || ''
    if (!samaAman(token, env('SHEET_SYNC_TOKEN'))) return jawab({ ok: false, pesan: 'Token sinkron ditolak.' }, 401)

    if (aksi === 'kabar') {
      const id = Number(badan.id)
      if (!Number.isFinite(id)) return jawab({ ok: false, pesan: 'id tidak sah.' }, 400)
      const { data: p } = await admin.from('peringatan_keamanan').select('*').eq('id', id).maybeSingle()
      if (!p) return jawab({ ok: false, pesan: 'Peringatan tidak ditemukan.' }, 404)
      const terkirim = await kirimTelegram(admin, susunPesan(p))
      if (terkirim) await admin.from('peringatan_keamanan').update({ telegram_terkirim: true }).eq('id', id)
      return jawab({ ok: true, telegram: terkirim })
    }
    return jawab({ ok: false, pesan: `Aksi "${aksi}" tidak dikenali.` }, 400)
  } catch (e) {
    console.error(e)
    return jawab({ ok: false, pesan: (e as Error)?.message || 'Terjadi kesalahan pada peladen.' }, 500)
  }
})
