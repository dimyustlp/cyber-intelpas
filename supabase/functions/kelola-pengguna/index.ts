/**
 * Edge Function: kelola-pengguna
 *
 * Menerbitkan akun baru — satu-satunya pekerjaan aplikasi ini yang mustahil
 * dilakukan dari peramban. Membuat akun berarti menulis ke tabel identitas, dan
 * itu menuntut kunci layanan; kunci itu tidak pernah boleh dikirim ke peramban,
 * sebab siapa pun yang membuka tab jaringan akan memegang seluruh basis data.
 *
 * Maka pekerjaannya dipindahkan ke sini, dan bersamanya seluruh aturan tentang
 * siapa boleh menerbitkan siapa:
 *
 *   Administrator Sistem Intelijen  →  boleh menerbitkan peran apa pun.
 *   Administrator Kantor Wilayah    →  hanya Penginput Berita, hanya di
 *                                      wilayahnya sendiri.
 *   Peran lain                      →  tidak boleh sama sekali.
 *
 * Aturan itu ditegakkan di berkas ini, bukan di menu. Menu yang menyembunyikan
 * tombol hanya menghindarkan salah tekan; yang menahan penyalahgunaan adalah
 * pemeriksaan di bawah, yang tidak bisa dilewati dengan mengetik alamat lain.
 *
 * Wilayah pemohon tidak pernah dibaca dari badan permintaan. Ia diambil dari
 * profil pemohon di basis data — kalau tidak, seorang admin kanwil cukup
 * mengganti satu baris di permintaannya untuk menerbitkan akun di wilayah orang
 * lain.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const KEPALA = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Ranah surel bayangan untuk akun internal. Sama persis dengan lib/api.js. */
const RANAH_USERNAME = 'pengguna.cyber-intelpas.id'

const PERAN_INTERNAL = [
  'super_admin',
  'media_intelligence_analyst',
  'news_data_operator',
  'field_verification_officer',
  'evaluation_recommendation_analyst',
  'executive_decision_maker',
]

const PERAN_WILAYAH = ['kanwil_admin', 'kanwil_penginput']

const POLA_SUREL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const POLA_USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/

function env(nama: string): string {
  return Deno.env.get(nama)?.trim() || ''
}

function jawab(isi: unknown, status = 200): Response {
  return new Response(JSON.stringify(isi), { status, headers: KEPALA })
}

function bersih(nilai: unknown): string {
  return String(nilai ?? '').replace(/\s+/g, ' ').trim()
}

Deno.serve(async (permintaan: Request) => {
  if (permintaan.method === 'OPTIONS') return new Response('ok', { headers: KEPALA })
  if (permintaan.method !== 'POST') {
    return jawab({ ok: false, pesan: 'Hanya menerima POST.' }, 405)
  }

  try {
    const urlSupabase = env('SUPABASE_URL')
    const kunciLayanan = env('SUPABASE_SERVICE_ROLE_KEY')
    if (!urlSupabase || !kunciLayanan) {
      return jawab({ ok: false, pesan: 'Fungsi belum dikonfigurasi di peladen.' }, 500)
    }

    const admin = createClient(urlSupabase, kunciLayanan, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    /* ------------------------------------------------------ siapa pemohon */

    const tajuk = permintaan.headers.get('Authorization') || ''
    const token = tajuk.startsWith('Bearer ') ? tajuk.slice(7) : ''
    if (!token) return jawab({ ok: false, pesan: 'Sesi tidak terbaca. Masuk kembali.' }, 401)

    const { data: sesi, error: galatSesi } = await admin.auth.getUser(token)
    if (galatSesi || !sesi?.user) {
      return jawab({ ok: false, pesan: 'Sesi Anda sudah berakhir. Masuk kembali.' }, 401)
    }

    const { data: pemohon, error: galatPemohon } = await admin
      .from('app_users')
      .select('id,username,full_name,role,assigned_kanwil,aktif,deleted_at')
      .eq('auth_user_id', sesi.user.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (galatPemohon) {
      return jawab({ ok: false, pesan: `Profil pemohon gagal dibaca: ${galatPemohon.message}` }, 500)
    }
    if (!pemohon || pemohon.aktif === false) {
      return jawab({ ok: false, pesan: 'Profil Anda tidak aktif di sistem ini.' }, 403)
    }

    const peranPemohon = String(pemohon.role)
    const bolehSemua = peranPemohon === 'super_admin'
    const bolehWilayah = peranPemohon === 'kanwil_admin'

    if (!bolehSemua && !bolehWilayah) {
      return jawab({
        ok: false,
        pesan: 'Peran Anda tidak berhak menerbitkan akun.',
      }, 403)
    }

    /* --------------------------------------------------------- permintaan */

    let badan: Record<string, unknown> = {}
    try { badan = await permintaan.json() } catch { /* ditangani di bawah */ }

    const aksi = bersih(badan.aksi) || 'buat'
    if (aksi !== 'buat') {
      return jawab({ ok: false, pesan: `Aksi "${aksi}" tidak dikenali.` }, 400)
    }

    const peran = bersih(badan.role)
    const namaLengkap = bersih(badan.full_name)
    const jabatan = bersih(badan.jabatan)
    const sandi = String(badan.password ?? '')
    const username = bersih(badan.username).toLowerCase()

    /* ------------------------------------------------------------ aturan */

    if (!PERAN_INTERNAL.includes(peran) && !PERAN_WILAYAH.includes(peran)) {
      return jawab({ ok: false, pesan: 'Peran yang diminta tidak dikenali.' }, 400)
    }

    // Inilah pembatasan yang menjadi alasan fungsi ini ada.
    if (bolehWilayah && peran !== 'kanwil_penginput') {
      return jawab({
        ok: false,
        pesan: 'Administrator Kantor Wilayah hanya boleh menerbitkan akun '
          + 'Penginput Berita Kantor Wilayah.',
      }, 403)
    }

    if (!namaLengkap || namaLengkap.length < 2) {
      return jawab({ ok: false, pesan: 'Nama lengkap wajib diisi.' }, 400)
    }

    if (sandi.length < 8) {
      return jawab({ ok: false, pesan: 'Kata sandi awal minimal 8 karakter.' }, 400)
    }

    const peranWilayah = PERAN_WILAYAH.includes(peran)

    /*
       Akun wilayah memakai alamat surel sungguhan sebagai identitasnya, atas
       permintaan pengguna sistem: petugas wilayah berganti-ganti orang, dan
       alamat surat resmi adalah satu-satunya penanda yang bisa ditelusuri
       kembali ketika akun perlu dipertanggungjawabkan.

       Akun internal tetap memakai username polos beserta surel bayangan, sebab
       akun-akun itu diterbitkan untuk jabatan, bukan untuk kotak surat.
    */
    let surel: string
    if (peranWilayah) {
      if (!POLA_SUREL.test(username)) {
        return jawab({
          ok: false,
          pesan: 'Akun kantor wilayah wajib memakai alamat surel yang sah sebagai username, '
            + 'misalnya nama.petugas@kemenimipas.go.id.',
        }, 400)
      }
      surel = username
    } else {
      if (POLA_SUREL.test(username)) {
        return jawab({
          ok: false,
          pesan: 'Akun internal memakai username polos, bukan alamat surel. '
            + 'Contoh: budi.santoso.',
        }, 400)
      }
      if (!POLA_USERNAME.test(username)) {
        return jawab({
          ok: false,
          pesan: 'Username hanya boleh berisi huruf kecil, angka, titik, garis bawah, '
            + 'atau tanda hubung, sepanjang 3 sampai 32 karakter.',
        }, 400)
      }
      surel = `${username}@${RANAH_USERNAME}`
    }

    // Wilayah tidak pernah diambil dari permintaan bagi admin kanwil.
    let kanwil: string | null = null
    if (peranWilayah) {
      kanwil = bolehWilayah
        ? (pemohon.assigned_kanwil ? String(pemohon.assigned_kanwil) : null)
        : (bersih(badan.assigned_kanwil) || null)

      if (!kanwil) {
        return jawab({
          ok: false,
          pesan: bolehWilayah
            ? 'Wilayah pada akun Anda sendiri belum ditetapkan, sehingga akun baru '
              + 'tidak bisa diikatkan ke wilayah mana pun. Hubungi administrator sistem.'
            : 'Akun kantor wilayah wajib menyebutkan kantor wilayahnya.',
        }, 400)
      }
    }

    /* ----------------------------------------------- tolak yang sudah ada */

    /*
       Username dan surel keduanya unik di `app_users`. Diperiksa lebih dulu di
       sini supaya penolakannya berbunyi seperti kalimat, bukan seperti galat
       basis data — sebab bila dibiarkan sampai ke pemicu, yang muncul hanyalah
       "Database error creating new user", dan tidak seorang pun bisa menebak
       bahwa yang bentrok adalah alamat surelnya.
    */
    const { data: bentrok } = await admin
      .from('app_users')
      .select('id,username,email')
      .or(`username.eq.${username},email.eq.${surel}`)
      .limit(1)
      .maybeSingle()

    if (bentrok) {
      return jawab({
        ok: false,
        pesan: bentrok.username === username
          ? `Username "${username}" sudah dipakai akun lain.`
          : `Alamat "${surel}" sudah terdaftar pada akun "${bentrok.username}".`,
      }, 409)
    }

    /* ------------------------------------------------------- terbitkan */

    const { data: dibuat, error: galatBuat } = await admin.auth.admin.createUser({
      email: surel,
      password: sandi,
      email_confirm: true,
      user_metadata: { username, full_name: namaLengkap, role: peran },
    })

    if (galatBuat || !dibuat?.user) {
      const pesan = String(galatBuat?.message || 'Akun gagal diterbitkan.')
      const sudahAda = /already|registered|exists/i.test(pesan)
      return jawab({
        ok: false,
        pesan: sudahAda
          ? `Alamat "${surel}" sudah terdaftar sebagai identitas akun lain.`
          : pesan,
      }, sudahAda ? 409 : 500)
    }

    /*
       Pemicu on_auth_user_created sudah membuatkan baris profilnya beserta peran
       dari metadata. Yang belum ia tahu hanyalah hal-hal yang memang tidak ada
       di dalam identitas: wilayah, jabatan, dan penanda sandi awal.
    */
    const { data: profilBaru, error: galatProfil } = await admin
      .from('app_users')
      .update({
        role: peran,
        full_name: namaLengkap,
        jabatan: jabatan || null,
        assigned_kanwil: kanwil,
        aktif: true,
        must_change_password: true,
        // Kolom `email` sengaja tidak disentuh: pemicu sudah mengisinya dengan
        // alamat identitas, dan bagi akun wilayah alamat itu memang alamat
        // suratnya yang sungguhan.
        updated_at: new Date().toISOString(),
      })
      .eq('auth_user_id', dibuat.user.id)
      .select('id,username,full_name,role,jabatan,assigned_kanwil,assigned_upt,aktif,'
        + 'auth_user_id,last_login,must_change_password')
      .maybeSingle()

    if (galatProfil) {
      /*
         Identitasnya sudah terbit tetapi profilnya belum lengkap. Dibiarkan
         setengah jadi akan membingungkan: akun bisa masuk tetapi tanpa wilayah.
         Identitas itu ditarik kembali supaya keadaannya kembali seperti semula.
      */
      await admin.auth.admin.deleteUser(dibuat.user.id).catch(() => {})
      return jawab({
        ok: false,
        pesan: `Profil gagal dilengkapi, akun dibatalkan: ${galatProfil.message}`,
      }, 500)
    }

    /* Jejak audit. Penerbitan akun adalah tindakan yang harus bisa ditelusuri. */
    try {
      await admin.from('audit_log').insert({
        actor_username: pemohon.username,
        actor_role: peranPemohon,
        action: 'terbitkan_akun',
        entity: 'app_users',
        entity_id: String(profilBaru?.id ?? dibuat.user.id),
        metadata: {
          username,
          role: peran,
          assigned_kanwil: kanwil,
          diterbitkan_oleh: pemohon.username,
        },
      })
    } catch (galatJejak) {
      // Gagal mencatat jejak tidak boleh membatalkan akun yang sudah sah terbit.
      console.error('Jejak audit gagal ditulis:', galatJejak)
    }

    return jawab({
      ok: true,
      pesan: `Akun ${username} diterbitkan.`,
      pengguna: profilBaru,
      masuk_dengan: peranWilayah ? surel : username,
    }, 201)
  } catch (galat) {
    console.error(galat)
    return jawab({
      ok: false,
      pesan: galat instanceof Error ? galat.message : 'Kesalahan tidak dikenali.',
    }, 500)
  }
})
