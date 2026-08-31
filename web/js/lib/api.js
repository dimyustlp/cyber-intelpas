/**
 * Lapisan akses data.
 *
 * Tidak memakai SDK Supabase dari CDN. Seluruh panggilan dilakukan langsung ke
 * PostgREST dan GoTrue dengan fetch biasa. Alasannya tiga:
 *   - sistem intelijen sebaiknya tidak menarik kode dari peladen pihak ketiga
 *     setiap kali halaman dibuka;
 *   - tidak ada proses bangun, jadi tidak ada bundel yang perlu diperbarui;
 *   - berkas ini bisa diuji di Node tanpa peramban.
 *
 * Kunci yang dipakai adalah publishable key. Kunci itu memang dirancang untuk
 * ditempel di sisi klien; yang menjaga data tetap policy RLS di basis data.
 */

import { KONFIG } from './konfig.js'

const SIMPAN_SESI = 'cyberintelpas.sesi'

let sesi = null
let profil = null

// ------------------------------------------------------------------- galat

export class GalatApi extends Error {
  constructor(pesan, status, rinci) {
    super(pesan)
    this.name = 'GalatApi'
    this.status = status
    this.rinci = rinci
  }
}

/** Menerjemahkan galat PostgREST menjadi kalimat yang bisa dibaca petugas. */
export function pesanRamah(galat) {
  if (!(galat instanceof GalatApi)) return galat?.message || 'Terjadi kesalahan yang tidak dikenali.'
  if (galat.status === 401) return 'Sesi Anda sudah berakhir. Silakan masuk kembali.'
  // GoTrue menjawab penolakan kredensial dengan 400 dan kalimat berbahasa
  // Inggris. Petugas yang salah ketik username berhak membaca sebabnya dalam
  // bahasa yang ia pakai bekerja.
  if (galat.status === 400 && /invalid login credentials/i.test(galat.rinci?.error_description || galat.rinci?.message || '')) {
    return 'Username atau kata sandi tidak cocok. Periksa kembali, atau hubungi administrator bila lupa sandi.'
  }
  if (galat.status === 403 || galat.rinci?.code === '42501') {
    return 'Peran Anda tidak memiliki hak untuk tindakan ini.'
  }
  if (galat.rinci?.code === '23505') return 'Data dengan penanda yang sama sudah tersimpan.'
  if (galat.rinci?.code === '23503') return 'Data yang dirujuk tidak ditemukan.'
  if (galat.status === 0) return 'Tidak dapat menghubungi peladen. Periksa sambungan jaringan.'
  return galat.rinci?.message || galat.message || 'Terjadi kesalahan pada peladen.'
}

// -------------------------------------------------------------------- sesi

export function muatSesi() {
  try {
    const mentah = localStorage.getItem(SIMPAN_SESI)
    if (!mentah) return null
    const isi = JSON.parse(mentah)
    if (!isi?.access_token) return null
    if (isi.expires_at && isi.expires_at * 1000 < Date.now() + 30_000) return null
    sesi = isi
    profil = isi.profil || null
    return isi
  } catch {
    return null
  }
}

function simpanSesi(isi) {
  sesi = isi
  try {
    if (isi) localStorage.setItem(SIMPAN_SESI, JSON.stringify(isi))
    else localStorage.removeItem(SIMPAN_SESI)
  } catch {
    /* Mode penyamaran peramban dapat menolak penyimpanan. Sesi tetap jalan di memori. */
  }
}

export function sesiSekarang() { return sesi }
export function profilSekarang() { return profil }

// --------------------------------------------------------------- pemanggil

async function panggil(jalur, opsi = {}) {
  if (KONFIG.mode === 'demo') throw new GalatApi('Mode demo tidak terhubung ke peladen.', 0)

  const kepala = {
    apikey: KONFIG.kunciPublik,
    'Content-Type': 'application/json',
    ...opsi.headers,
  }
  if (sesi?.access_token) kepala.Authorization = `Bearer ${sesi.access_token}`

  let jawab
  try {
    jawab = await fetch(`${KONFIG.url}${jalur}`, { ...opsi, headers: kepala })
  } catch (e) {
    throw new GalatApi(e.message, 0)
  }

  if (jawab.status === 204) return null

  const teks = await jawab.text()
  let isi = null
  if (teks) { try { isi = JSON.parse(teks) } catch { isi = teks } }

  if (!jawab.ok) {
    throw new GalatApi(isi?.message || isi?.error_description || jawab.statusText, jawab.status, isi)
  }
  return isi
}

/** Membangun kueri PostgREST dari objek biasa. */
export function kueri(params = {}) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    u.append(k, v)
  }
  const s = u.toString()
  return s ? `?${s}` : ''
}

export async function ambil(tabel, params = {}, opsi = {}) {
  const kepala = {}
  if (opsi.hitung) kepala.Prefer = `count=${opsi.hitung}`
  if (opsi.jangkauan) kepala.Range = opsi.jangkauan
  return panggil(`/rest/v1/${tabel}${kueri(params)}`, { method: 'GET', headers: kepala })
}

export async function sisip(tabel, isi, opsi = {}) {
  return panggil(`/rest/v1/${tabel}${kueri({ select: opsi.pilih || '*' })}`, {
    method: 'POST',
    headers: { Prefer: `return=${opsi.kembalikan || 'representation'}` },
    body: JSON.stringify(isi),
  })
}

export async function perbarui(tabel, saring, isi, opsi = {}) {
  return panggil(`/rest/v1/${tabel}${kueri({ ...saring, select: opsi.pilih || '*' })}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(isi),
  })
}

export async function panggilFungsi(nama, isi = {}) {
  return panggil(`/rest/v1/rpc/${nama}`, { method: 'POST', body: JSON.stringify(isi) })
}

export async function panggilEdge(nama, isi = {}) {
  return panggil(`/functions/v1/${nama}`, { method: 'POST', body: JSON.stringify(isi) })
}

// ------------------------------------------------------------- otentikasi

/**
 * Ranah surel bayangan.
 *
 * Supabase Auth menuntut sebuah alamat surel sebagai identitas, sedangkan
 * sistem ini menerbitkan akun berdasarkan username — dan empat dari enam profil
 * yang ada bahkan tidak punya alamat surel sama sekali, sehingga tidak seorang
 * pun di antaranya bisa masuk. Ranah di bawah tidak pernah menerima surat: ia
 * hanya bentuk alamat yang sah untuk menampung username.
 *
 * Akibat yang harus disepakati, bukan disembunyikan: pemulihan sandi lewat
 * surel tidak berlaku bagi akun semacam ini. Yang lupa sandi menghubungi
 * administrator.
 */
export const RANAH_USERNAME = 'pengguna.cyber-intelpas.id'

/** Benar bila yang diketik memang berbentuk alamat surel, bukan username. */
export function tampakSurel(nilai) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(nilai || '').trim())
}

export function surelUntukUsername(username) {
  return `${String(username || '').trim().toLowerCase()}@${RANAH_USERNAME}`
}

/**
 * Masuk dengan username, dan tetap menerima surel.
 *
 * Dua akun lama tertaut ke alamat surel dinas sungguhan. Menolak surel berarti
 * mengunci keduanya demi keseragaman yang tidak menolong siapa pun; karena itu
 * yang berbentuk surel dicoba apa adanya, dan yang bukan diterjemahkan menjadi
 * surel bayangan. Bila keduanya mungkin, keduanya dicoba — sebab menebak salah
 * satu lalu menyalahkan penggunanya adalah cara paling murah membuat orang
 * berhenti memakai sistem.
 */
export async function masuk(pengenal, kataSandi) {
  const teks = String(pengenal || '').trim()
  const percobaan = tampakSurel(teks)
    ? [teks]
    : [surelUntukUsername(teks), `${teks}@${RANAH_USERNAME}`.toLowerCase()]

  let galatTerakhir = null
  for (const surel of [...new Set(percobaan)]) {
    try {
      const hasil = await panggil('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: JSON.stringify({ email: surel, password: kataSandi }),
      })
      simpanSesi(hasil)
      await muatProfil()
      simpanSesi({ ...hasil, profil })
      return profil
    } catch (galat) {
      galatTerakhir = galat
      // Hanya penolakan kredensial yang layak dicoba dengan bentuk lain.
      // Gangguan jaringan atau peladen tidak akan berubah hasilnya.
      if (!(galat instanceof GalatApi) || galat.status !== 400) throw galat
    }
  }

  throw galatTerakhir || new GalatApi('Username atau kata sandi tidak dikenali.', 400)
}

export async function keluar() {
  try { await panggil('/auth/v1/logout', { method: 'POST' }) } catch { /* sesi lokal tetap dibersihkan */ }
  profil = null
  simpanSesi(null)
}

/**
 * Sebelum ini kueri di bawah tidak menyaring baris sama sekali — hanya
 * `limit: 1` — dan bergantung penuh pada RLS untuk membatasi hasilnya ke
 * baris milik sendiri. Itu benar untuk peran biasa, sebab policy-nya memang
 * `auth_user_id = auth.uid()`. Tetapi policy yang sama juga berbunyi
 * `OR is_super_admin()`, dan bagi super admin klausa itu membuat seluruh baris
 * tabel terlihat. Tanpa WHERE atau ORDER BY, PostgREST bebas mengembalikan
 * baris siapa pun yang kebetulan ia temui lebih dulu — bagi seorang super
 * admin, profil yang termuat bisa jadi milik orang lain sepenuhnya, dan tidak
 * ada apa pun di layar yang akan terlihat salah sampai nama itu terbaca satu
 * per satu.
 *
 * Sekarang kueri menyaring eksplisit ke auth_user_id milik sesi yang sedang
 * berjalan — didapat dari token yang baru diterbitkan GoTrue, bukan
 * ditebak dari isi tabelnya.
 */
export async function muatProfil() {
  const uid = sesi?.user?.id
  const baris = await ambil('app_users', {
    // `auth_user_id` dipakai halaman pengguna untuk mengenali baris milik
    // sendiri, dan `must_change_password` untuk mengetahui kapan penanda sandi
    // awal boleh dihapus. Keduanya milik profil sendiri, bukan milik orang lain.
    select: 'id,username,full_name,role,jabatan,assigned_kanwil,assigned_upt,aktif,email,'
      + 'last_login,auth_user_id,must_change_password',
    ...(uid ? { auth_user_id: `eq.${uid}` } : {}),
    limit: 1,
  })
  profil = Array.isArray(baris) ? baris[0] || null : null
  return profil
}

/** Menyunting profil milik sendiri. RLS menegakkan batasnya sendiri. */
export async function perbaruiProfilSendiri(perubahan) {
  const hasil = await perbarui('app_users', { auth_user_id: `eq.${sesi?.user?.id}` }, perubahan)
  const baru = Array.isArray(hasil) ? hasil[0] : hasil
  if (baru) {
    profil = { ...profil, ...baru }
    if (sesi) simpanSesi({ ...sesi, profil })
  }
  return baru
}

/**
 * Mengganti kata sandi akun yang sedang masuk. Tidak menuntut kata sandi lama
 * — sesi yang sedang aktif sudah membuktikan siapa yang meminta, sama seperti
 * cara GoTrue sendiri memperlakukan permintaan ini.
 */
export async function gantiSandiSendiri(sandiBaru) {
  return panggil('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password: sandiBaru }) })
}

// ---------------------------------------------------------------- ringkasan

/**
 * Angka-angka dasbor. Dihitung dengan beberapa kueri hitung yang murah,
 * bukan dengan menarik seluruh tabel ke peramban.
 */
export async function ringkasanDasbor({ dariIso = null, sampaiIso = null } = {}) {
  // Satu panggilan RPC yang menghitung di sisi basis data. Alternatifnya —
  // menarik ribuan baris ke peramban lalu menjumlahkannya di sana — akan makin
  // lambat setiap minggu seiring arsip bertambah.
  return panggilFungsi('ringkasan_dasbor', { p_dari: dariIso, p_sampai: sampaiIso })
}

/** Menghitung jumlah baris tanpa menariknya. */
export async function hitungBaris(tabel, params = {}) {
  const jalur = `/rest/v1/${tabel}${kueri({ ...params, select: 'id', limit: 1 })}`
  const kepala = { apikey: KONFIG.kunciPublik, Prefer: 'count=exact', Range: '0-0' }
  if (sesi?.access_token) kepala.Authorization = `Bearer ${sesi.access_token}`

  const jawab = await fetch(`${KONFIG.url}${jalur}`, { headers: kepala })
  if (!jawab.ok) throw new GalatApi(jawab.statusText, jawab.status)

  const rentangIsi = jawab.headers.get('content-range') || ''
  const total = Number(rentangIsi.split('/')[1])
  return Number.isFinite(total) ? total : 0
}

export const KONFIG_AKTIF = KONFIG
