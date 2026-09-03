/**
 * Profil Saya — menyunting identitas dan kata sandi milik sendiri.
 *
 * Halaman ini ada karena satu insiden nyata: seorang super admin membuka
 * sistem dan melihat namanya tertukar dengan orang lain, sebab pengambil
 * profil dulu tidak menyaring baris sama sekali — hanya mengandalkan RLS,
 * yang untuk super admin memang membuka seluruh tabel. Kesalahan itu sudah
 * diperbaiki di lib/api.js. Halaman ini menutup separuh lainnya: sebelum ini
 * tidak ada satu pun tempat bagi siapa pun mengoreksi identitasnya sendiri
 * tanpa masuk ke database langsung.
 *
 * Sengaja tidak dibatasi izin peran tertentu. Nama, nama pengguna, dan kata
 * sandi adalah milik pemakainya — setiap peran berhak menyuntingnya sendiri,
 * terlepas dari kewenangan apa pun yang ia punya atas data lain.
 */

import { kartu, tombol, pesanSistem, roti } from '../ui/komponen.js'
import { amankan } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { perbaruiProfilSendiri, gantiSandiSendiri, pesanRamah } from '../lib/api.js'
import { labelPeran } from '../lib/peran.js'

const keadaanForm = { sibukIdentitas: false, sibukSandi: false }

export function halamanProfil({ keadaan, isi }) {
  const p = keadaan.profil
  const demo = keadaan.demo

  isi.innerHTML = `
    <div class="tumpuk" style="max-width:640px">
      ${demo ? pesanSistem(
        '<b>Mode peragaan.</b> Perubahan pada halaman ini tidak benar-benar tersimpan.',
        'sedang', 'info',
      ) : ''}

      ${kartu({
        judul: 'Identitas',
        ket: 'Nama dan nama pengguna yang tampil di seluruh sistem',
        isi: `
          <form id="borang-identitas" class="tumpuk" style="gap:13px">
            <div class="isian">
              <label for="nama-lengkap">Nama lengkap</label>
              <input class="masukan" id="nama-lengkap" value="${amankan(p.full_name || '')}" required>
            </div>
            <div class="isian">
              <label for="nama-pengguna">Nama pengguna</label>
              <input class="masukan" id="nama-pengguna" value="${amankan(p.username || '')}" required
                     pattern="[a-zA-Z0-9_.]+" title="Huruf, angka, titik, dan garis bawah saja">
              <div class="ket">Dipakai orang lain untuk mengenali Anda di jejak audit dan penugasan — bukan untuk masuk. Masuk tetap memakai surel.</div>
            </div>
            <div class="isian">
              <label for="profil-surel">Surel</label>
              <input class="masukan" id="profil-surel" value="${amankan(p.email || '—')}" disabled>
              <div class="ket">Belum bisa diubah dari halaman ini. Hubungi administrator bila surel perlu diganti.</div>
            </div>
            <div class="isian">
              <label for="profil-peran">Peran</label>
              <input class="masukan" id="profil-peran" value="${amankan(labelPeran(p.role))}" disabled>
            </div>
            <div id="galat-identitas" aria-live="assertive"></div>
            <div class="baris">
              <button class="tbl utama" type="submit">${ikon('centang')} Simpan identitas</button>
            </div>
          </form>`,
      })}

      ${kartu({
        judul: 'Kata sandi',
        ket: 'Berlaku langsung setelah disimpan — sesi ini tidak perlu masuk ulang',
        isi: `
          <form id="borang-sandi" class="tumpuk" style="gap:13px">
            <div class="isian">
              <label for="sandi-baru">Kata sandi baru</label>
              <input class="masukan" id="sandi-baru" type="password" autocomplete="new-password"
                     minlength="8" required placeholder="Minimal 8 karakter">
            </div>
            <div class="isian">
              <label for="sandi-ulang">Ulangi kata sandi baru</label>
              <input class="masukan" id="sandi-ulang" type="password" autocomplete="new-password"
                     minlength="8" required>
            </div>
            <div id="galat-sandi" aria-live="assertive"></div>
            <div class="baris">
              <button class="tbl utama" type="submit">${ikon('gembok')} Ganti kata sandi</button>
            </div>
          </form>`,
      })}
    </div>`

  const borangIdentitas = isi.querySelector('#borang-identitas')
  const galatIdentitas = isi.querySelector('#galat-identitas')

  borangIdentitas.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    galatIdentitas.innerHTML = ''
    if (keadaanForm.sibukIdentitas) return

    const namaBaru = isi.querySelector('#nama-lengkap').value.trim()
    const penggunaBaru = isi.querySelector('#nama-pengguna').value.trim()
    if (!namaBaru || !penggunaBaru) {
      galatIdentitas.innerHTML = pesanGalat('Nama lengkap dan nama pengguna wajib diisi.')
      return
    }

    keadaanForm.sibukIdentitas = true
    const tombolSimpan = borangIdentitas.querySelector('button[type="submit"]')
    tombolSimpan.disabled = true

    if (demo) {
      roti('Identitas diperbarui (mode peragaan, tidak disimpan).', 'sedang')
      keadaanForm.sibukIdentitas = false
      tombolSimpan.disabled = false
      return
    }

    try {
      await perbaruiProfilSendiri({ full_name: namaBaru, username: penggunaBaru })
      roti('Identitas tersimpan.', 'positif')
      document.dispatchEvent(new CustomEvent('gambar-ulang'))
    } catch (galat) {
      galatIdentitas.innerHTML = pesanGalat(pesanRamah(galat))
    } finally {
      keadaanForm.sibukIdentitas = false
      tombolSimpan.disabled = false
    }
  })

  const borangSandi = isi.querySelector('#borang-sandi')
  const galatSandi = isi.querySelector('#galat-sandi')

  borangSandi.addEventListener('submit', async (ev) => {
    ev.preventDefault()
    galatSandi.innerHTML = ''
    if (keadaanForm.sibukSandi) return

    const baru = isi.querySelector('#sandi-baru').value
    const ulang = isi.querySelector('#sandi-ulang').value

    if (baru.length < 8) {
      galatSandi.innerHTML = pesanGalat('Kata sandi minimal 8 karakter.')
      return
    }
    if (baru !== ulang) {
      galatSandi.innerHTML = pesanGalat('Kedua isian kata sandi tidak sama.')
      return
    }

    keadaanForm.sibukSandi = true
    const tombolSimpan = borangSandi.querySelector('button[type="submit"]')
    tombolSimpan.disabled = true

    if (demo) {
      roti('Kata sandi diperbarui (mode peragaan, tidak disimpan).', 'sedang')
      borangSandi.reset()
      keadaanForm.sibukSandi = false
      tombolSimpan.disabled = false
      return
    }

    try {
      await gantiSandiSendiri(baru)

      /*
         Akun yang baru diterbitkan ditandai masih memakai sandi awal, dan
         penandanya muncul di layar Manajemen Pengguna. Menggantinya di sini
         adalah satu-satunya saat penanda itu benar-benar tidak berlaku lagi —
         kalau tidak dihapus di sini, ia akan menempel selamanya dan berhenti
         berarti apa-apa.
      */
      if (p.must_change_password) {
        try {
          await perbaruiProfilSendiri({ must_change_password: false })
          p.must_change_password = false
        } catch { /* sandinya sudah berganti; penanda menyusul pada suntingan berikutnya */ }
      }

      roti('Kata sandi baru sudah berlaku.', 'positif')
      borangSandi.reset()
    } catch (galat) {
      galatSandi.innerHTML = pesanGalat(pesanRamah(galat))
    } finally {
      keadaanForm.sibukSandi = false
      tombolSimpan.disabled = false
    }
  })

  return { judul: 'Profil Saya', sub: 'Identitas dan kata sandi akun Anda sendiri' }
}

function pesanGalat(teks) {
  return `<div class="pesan" data-nada="kritis">${ikon('peringatan')}<div>${amankan(teks)}</div></div>`
}
