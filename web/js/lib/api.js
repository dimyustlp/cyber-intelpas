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

const SIMPAN_SESI = 'transsiberpas.sesi'

/*
   Penanda lama, dari masa sistem ini bernama Cyber-Intelpas.

   Mengganti nama penanda tanpa memindahkan isinya berarti setiap petugas yang
   sedang masuk tiba-tiba terlempar ke halaman masuk pada penggelaran berikutnya
   — tanpa satu pun pesan yang menjelaskan mengapa. Isinya dipindahkan sekali,
   lalu penanda lamanya dihapus.
*/
const SIMPAN_SESI_LAMA = 'cyberintelpas.sesi'

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

/** Memindahkan sesi yang tersimpan di bawah nama lama, sekali, lalu melupakannya. */
function pindahkanSesiLama() {
  try {
    const lama = localStorage.getItem(SIMPAN_SESI_LAMA)
    if (!lama) return null
    localStorage.setItem(SIMPAN_SESI, lama)
    localStorage.removeItem(SIMPAN_SESI_LAMA)
    return lama
  } catch {
    return null
  }
}

export function muatSesi() {
  try {
    const mentah = localStorage.getItem(SIMPAN_SESI) || pindahkanSesiLama()
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

/**
 * Menarik baris dari sebuah tabel.
 *
 * Pernah ada opsi ketiga di sini, `hitung`, yang memasang header
 * `Prefer: count=…` supaya PostgREST mengembalikan jumlah baris seluruhnya.
 * Opsi itu tidak pernah bisa bekerja: `panggil()` hanya mengembalikan badan
 * jawaban dan membuang seluruh headernya, sehingga hitungan yang diminta tidak
 * punya jalan untuk sampai ke pemanggil. Ia dibuang bersama `hitungBaris()`
 * yang bersaudara dengannya — keduanya tampak berfungsi, dan itulah yang
 * membuat keduanya berbahaya untuk ditinggalkan.
 *
 * Bila kelak sebuah halaman benar-benar butuh jumlah baris tanpa menariknya,
 * yang harus diubah lebih dulu adalah `panggil()`, supaya ia meneruskan
 * header jawaban. Menambahkan kembali opsinya saja hanya mengulang keadaan ini.
 */
export async function ambil(tabel, params = {}, opsi = {}) {
  const kepala = {}
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
/*
   Ranah ini TIDAK ikut berganti ketika sistem berganti nama menjadi
   Trans-Siber PAS, dan tidak boleh diganti kelak.

   Alamat bayangan tiap akun sudah tersimpan di GoTrue dalam bentuk
   `<username>@pengguna.cyber-intelpas.id`. Mengganti ranahnya berarti setiap
   percobaan masuk mencari alamat yang tidak ada — seluruh petugas terkunci
   sekaligus, dan tidak ada pesan galat yang menyebutkan sebabnya. Nama sistem
   adalah tulisan di layar; ranah ini adalah pengenal yang sudah dipakai.
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

// ----------------------------------------------------------------- hitungan

/**
 * Angka dasbor tidak dihitung di sini.
 *
 * Pernah ada `ringkasanDasbor()` di berkas ini yang memanggil RPC
 * `ringkasan_dasbor` — fungsi basis data yang tidak pernah dibuat, dan tidak
 * pernah dipanggil oleh satu halaman pun. Ia tidak dihidupkan kembali karena
 * seluruh angka di layar berasal dari satu himpunan dasar yang dibentuk
 * `ringkasan()` di lib/hitung.js, di atas arsip yang memang sudah ditarik utuh
 * oleh main.js untuk keperluan halaman lain. Menambahkan penghitung kedua di
 * sisi basis data berarti menambahkan tafsir kedua tentang berita mana yang
 * dihitung — persis keadaan yang dulu membuat angka dasbor dan angka lencana
 * berbeda.
 *
 * Alasan yang sama menghapus `hitungBaris()` yang dulu berdiri tepat di bawah
 * paragraf ini. Ia menghitung baris mentah lewat header `content-range`, tanpa
 * saringan `deleted_at` maupun kategori yang dipakai `ringkasan()`, sehingga
 * angka apa pun yang ia hasilkan pasti berbeda dari angka di layar — tafsir
 * kedua yang sama persis dengan yang dijelaskan di atas. Tidak ada satu
 * halaman pun yang pernah memanggilnya. Bila kelak ada halaman yang benar-benar
 * butuh jumlah baris tanpa menarik datanya, ia ditulis ulang bersama saringan
 * yang sama dengan yang dipakai layar, bukan dihidupkan kembali apa adanya.
 */

export const KONFIG_AKTIF = KONFIG

// -------------------------------------------------------------- penyimpanan

/**
 * Mengunggah satu berkas ke bucket privat.
 *
 * Tidak lewat `panggil()` karena badan permintaannya bukan JSON dan kepala
 * Content-Type-nya harus jenis berkasnya sendiri — memaksanya lewat pemanggil
 * bersama berarti pemanggil bersama itu harus tahu dua bentuk badan, dan yang
 * kedua hanya dipakai di satu tempat.
 *
 * Jalurnya mengikuti konvensi migrasi keempat:
 * `<tahun>/<bulan>/<id-entitas>/<nama-berkas>`. Nama berkasnya diberi awalan
 * waktu supaya dua petugas yang mengunggah "foto.jpg" pada kasus yang sama
 * tidak saling menimpa — bucket ini tidak mengaktifkan `upsert`, tetapi
 * peladen menolak dengan 409 alih-alih menyimpan keduanya, dan penolakan itu
 * baru terlihat setelah petugasnya pulang dari lapangan.
 */
export async function unggahBerkas(bucket, entitasId, berkas) {
  if (KONFIG.mode === 'demo') {
    return { jalur: `peragaan/${entitasId}/${berkas.name}`, ukuran: berkas.size }
  }

  const kini = new Date()
  const bersih = String(berkas.name).replace(/[^\w.\-]+/g, '-').slice(-80)
  const jalur = [
    kini.getFullYear(),
    String(kini.getMonth() + 1).padStart(2, '0'),
    entitasId,
    `${kini.getTime()}-${bersih}`,
  ].join('/')

  const kepala = {
    apikey: KONFIG.kunciPublik,
    'Content-Type': berkas.type || 'application/octet-stream',
  }
  if (sesi?.access_token) kepala.Authorization = `Bearer ${sesi.access_token}`

  let jawab
  try {
    jawab = await fetch(`${KONFIG.url}/storage/v1/object/${bucket}/${jalur}`, {
      method: 'POST', headers: kepala, body: berkas,
    })
  } catch (e) {
    throw new GalatApi(e.message, 0)
  }

  if (!jawab.ok) {
    const isi = await jawab.json().catch(() => null)
    throw new GalatApi(isi?.message || jawab.statusText, jawab.status, isi)
  }
  return { jalur, ukuran: berkas.size }
}

/**
 * Alamat sementara untuk membuka satu berkas privat.
 *
 * Bucket-nya privat, jadi tidak ada alamat tetap yang bisa ditempel di
 * halaman. Alamat yang dikembalikan berlaku satu jam — cukup untuk dibuka,
 * dan terlalu pendek untuk berguna bila tautannya bocor keluar.
 */
export async function tautanBerkas(bucket, jalur, detik = 3600) {
  if (KONFIG.mode === 'demo') return null
  const jawaban = await panggil(`/storage/v1/object/sign/${bucket}/${jalur}`, {
    method: 'POST',
    body: JSON.stringify({ expiresIn: detik }),
  })
  return jawaban?.signedURL ? `${KONFIG.url}/storage/v1${jawaban.signedURL}` : null
}
