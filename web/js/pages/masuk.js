/**
 * Halaman masuk.
 *
 * Sisi kiri memuat identitas kelembagaan dan tiga angka yang menjelaskan
 * cakupan sistem. Sisi kanan hanya formulir — tidak ada tautan pendaftaran,
 * tidak ada masuk lewat penyedia lain, karena akun sistem ini hanya diterbitkan
 * oleh administrator.
 */

import { KONFIG } from '../lib/konfig.js'
import { masuk, pesanRamah } from '../lib/api.js'
import { amankan } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { pasangKoridor } from '../ui/koridor.js'

/**
 * Kartu koridor mengikuti urutan siklus intelijen sungguhan, dari deteksi
 * sampai keputusan — bukan susunan acak. Orang yang belum pernah membuka
 * sistem ini sudah membaca alurnya sebelum sempat login.
 */
const KARTU_KORIDOR = [
  { ikon: 'berita', label: 'Deteksi Media' },
  { ikon: 'peringatan', label: 'Peringatan Dini' },
  { ikon: 'centang', label: 'Telaah Analis' },
  { ikon: 'lapangan', label: 'Verifikasi Lapangan' },
  { ikon: 'kasus', label: 'Kasus Intelijen' },
  { ikon: 'tindak', label: 'Evaluasi' },
  { ikon: 'keputusan', label: 'Keputusan' },
  { ikon: 'laporan', label: 'Laporan Berkala' },
  { ikon: 'kirim', label: 'Distribusi Telegram' },
  { ikon: 'peta', label: 'Peta Sebaran' },
]

export function halamanMasuk({ onMasuk }) {
  const wadah = document.createElement('div')
  wadah.className = 'masuk-latar'
  wadah.innerHTML = `
    <section class="masuk-kiri">
      <div class="masuk-kiri-isi">
        <div>
          <p class="masuk-eyebrow">${amankan(KONFIG.kementerian)}</p>
          <p class="masuk-eyebrow" style="margin-top:2px">${amankan(KONFIG.induk)}</p>
        </div>

        <div class="masuk-judul-plate">
          <h1>Cyber-Intelpas</h1>
          <p class="sub">Sistem manajemen intelijen pemberitaan pemasyarakatan —
          dari deteksi media, telaah analis, verifikasi lapangan, sampai keputusan pimpinan.</p>
        </div>

        <dl class="masuk-statistik">
          <div><dt>UPT terpantau</dt><dd>492</dd></div>
          <div><dt>Kantor wilayah</dt><dd>38</dd></div>
          <div><dt>Pemeriksaan sumber</dt><dd>5 menit</dd></div>
        </dl>
      </div>
    </section>

    <section class="masuk-kanan">
      <div>
        <h2 style="font-size:1.3rem">Masuk ke sistem</h2>
        <p class="samar-teks kecil-teks" style="margin-top:5px">
          Gunakan username yang diterbitkan administrator.
        </p>
      </div>

      <form id="borang-masuk" class="tumpuk" style="gap:13px" novalidate>
        ${/*
          Kolom ini menerima username maupun surel.

          Akun sistem diterbitkan berdasarkan username — itulah yang tertulis di
          seluruh policy basis data — sedangkan dua akun lama tertaut ke alamat
          surel dinas. Menolak salah satunya berarti mengunci sebagian petugas
          demi keseragaman yang tidak menolong siapa pun.
        */''}
        <div class="isian">
          <label for="surel">Username</label>
          <input class="masukan" id="surel" name="surel" type="text" autocomplete="username"
                 autocapitalize="none" spellcheck="false"
                 required placeholder="nama.petugas" autofocus>
          <div class="ket">Alamat surel dinas juga diterima bagi akun lama.</div>
        </div>

        <div class="isian">
          <label for="sandi">Kata sandi</label>
          <input class="masukan" id="sandi" name="sandi" type="password"
                 autocomplete="current-password" required placeholder="••••••••••">
        </div>

        <div id="galat-masuk" aria-live="assertive"></div>

        <button class="tbl utama penuh" type="submit" style="height:38px">
          ${ikon('gembok')} Masuk
        </button>
      </form>

      <p class="mini-teks samar-teks" style="line-height:1.6">
        Seluruh aktivitas di dalam sistem tercatat dalam jejak audit. Akses yang
        tidak sesuai kewenangan dapat dikenai sanksi kepegawaian.
      </p>

      <p class="mini-teks samar-teks" style="margin-top:-6px">
        Versi ${amankan(KONFIG.versi)} · ${amankan(KONFIG.instansi)}
      </p>
    </section>`

  pasangKoridor(wadah.querySelector('.masuk-kiri'), { ikon, kartu: KARTU_KORIDOR })

  const borang = wadah.querySelector('#borang-masuk')
  const kotakGalat = wadah.querySelector('#galat-masuk')
  const tombol = borang.querySelector('button[type="submit"]')

  borang.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    kotakGalat.innerHTML = ''

    const surel = borang.surel.value.trim()
    const sandi = borang.sandi.value

    if (!surel || !sandi) {
      kotakGalat.innerHTML = galat('Username dan kata sandi wajib diisi.')
      return
    }

    tombol.disabled = true
    tombol.innerHTML = 'Memeriksa…'

    try {
      const profil = await masuk(surel, sandi)
      if (!profil) throw new Error('Akun ini belum memiliki profil di sistem. Hubungi administrator.')
      if (profil.aktif === false) throw new Error('Akun ini sedang dinonaktifkan.')
      await onMasuk(profil)
    } catch (e) {
      kotakGalat.innerHTML = galat(pesanRamah(e))
      tombol.disabled = false
      tombol.innerHTML = `${ikon('gembok')} Masuk`
      borang.sandi.focus()
      borang.sandi.select()
    }
  })

  return wadah
}

function galat(pesan) {
  return `<div class="pesan" data-nada="kritis">${ikon('peringatan')}<div>${amankan(pesan)}</div></div>`
}
