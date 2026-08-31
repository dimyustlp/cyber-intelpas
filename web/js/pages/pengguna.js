/**
 * Manajemen Pengguna.
 *
 * Batas yang harus jelas sejak awal, sebab ia menentukan seluruh bentuk halaman
 * ini: **menerbitkan akun baru tidak dilakukan dari sini.** Membuat akun berarti
 * menulis ke `auth.users`, dan itu hanya bisa dilakukan pemegang service role
 * key — kunci yang tidak pernah boleh berada di peramban. Menaruhnya di sini
 * demi kenyamanan berarti menyerahkan seluruh basis data kepada siapa pun yang
 * membuka tab jaringan di peramban.
 *
 * Yang bisa dikerjakan dari sini adalah yang memang milik lapisan aplikasi:
 * menetapkan peran, wilayah, unit, dan keaktifan sebuah profil. Justru inilah
 * yang paling sering dibutuhkan — akun kantor wilayah yang belum ditetapkan
 * wilayahnya tidak bisa mengirim apa pun, dan sebelum halaman ini ada, satu-
 * satunya cara memperbaikinya adalah membuka panel Supabase.
 *
 * Penerbitan akun tetap dijelaskan di layar, lengkap dengan pola alamatnya,
 * supaya tidak menjadi pengetahuan lisan yang hilang bersama orangnya.
 */

import { kartu, keping, kosong, pesanSistem, tombol, roti, konfirmasi } from '../ui/komponen.js'
import { amankan, angka, jarakWaktu, tanggalJam } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, perbarui, pesanRamah, RANAH_USERNAME } from '../lib/api.js'
import { PERAN, labelPeran, adalahEksternal } from '../lib/peran.js'
import { penggunaDemo, KANWIL_DEMO } from '../lib/demo.js'

const keadaanPengguna = {
  dimuat: false,
  daftar: [],
  kanwil: [],
  galat: null,
  /** Baris yang sedang disunting, satu per satu — bukan tabel yang bisa diedit serentak. */
  sunting: null,
  sibuk: false,
}

/** Peran yang boleh ditetapkan, berurut dari pusat ke wilayah. */
function pilihanPeran() {
  return Object.entries(PERAN).map(([kode, p]) => ({ kode, nama: p.nama, eksternal: adalahEksternal(kode) }))
}

/* ------------------------------------------------------------------ baris */

function barisPengguna(u, sedangDisunting, kanwil) {
  const tertaut = Boolean(u.auth_user_id)
  const eksternal = adalahEksternal(u.role)
  const perluWilayah = eksternal && !u.assigned_kanwil

  if (!sedangDisunting) {
    return `
    <tr>
      <td>
        <span class="judul-sel">${amankan(u.full_name || u.username)}</span>
        <span class="mini-teks samar-teks">
          <code>${amankan(u.username)}</code>${u.jabatan ? ` · ${amankan(u.jabatan)}` : ''}
        </span>
      </td>
      <td class="kecil">${amankan(labelPeran(u.role))}</td>
      <td class="kecil">${amankan(u.assigned_kanwil || (eksternal ? '—' : 'Nasional'))}</td>
      <td>
        ${u.aktif === false ? keping('Nonaktif', 'rendah', true) : keping('Aktif', 'positif', true)}
        ${tertaut ? '' : keping('Belum bisa masuk', 'kritis', true)}
        ${perluWilayah ? keping('Wilayah kosong', 'sedang', true) : ''}
      </td>
      <td class="kecil" title="${amankan(u.last_login ? tanggalJam(u.last_login) : '')}">
        ${u.last_login ? amankan(jarakWaktu(u.last_login)) : '—'}
      </td>
      <td class="rata-kanan">
        ${tombol({ label: 'Sunting', ikon: 'saring', kecil: true, aksi: 'sunting', judul: `Sunting ${u.username}` })
          .replace('<button', `<button data-id="${amankan(u.id)}"`)}
      </td>
    </tr>`
  }

  return `
    <tr class="baris-sunting">
      <td colspan="6">
        <div class="sunting-pengguna" data-id="${amankan(u.id)}">
          <div class="baris gap-6" style="margin-bottom:10px">
            <b>${amankan(u.full_name || u.username)}</b>
            <code>${amankan(u.username)}</code>
            ${tertaut ? '' : keping('Belum punya akun masuk', 'kritis', true)}
          </div>

          <div class="kisi kisi-2" style="gap:12px">
            <div class="isian">
              <label for="p-peran">Peran</label>
              <select class="pilihan penuh" id="p-peran">
                ${pilihanPeran().map((p) => `
                  <option value="${amankan(p.kode)}"${p.kode === u.role ? ' selected' : ''}>
                    ${amankan(p.nama)}${p.eksternal ? ' — wilayah' : ''}
                  </option>`).join('')}
              </select>
              <div class="ket" id="p-ket-peran">${amankan(PERAN[u.role]?.tugas || '')}</div>
            </div>

            <div class="isian">
              <label for="p-kanwil">Kantor wilayah</label>
              <input class="masukan" id="p-kanwil" list="daftar-kanwil"
                     value="${amankan(u.assigned_kanwil || '')}"
                     placeholder="Kosongkan untuk cakupan nasional">
              <datalist id="daftar-kanwil">
                ${kanwil.map((k) => `<option value="${amankan(k)}"></option>`).join('')}
              </datalist>
              <div class="ket">
                Peran wilayah <b>wajib</b> diisi — tanpa ini, kirimannya ditolak basis data.
                Peran pusat yang diisi wilayah akan dibatasi hanya ke wilayah itu.
              </div>
            </div>
          </div>

          <div class="kisi kisi-2" style="gap:12px;margin-top:12px">
            <div class="isian">
              <label for="p-upt">Unit pelaksana teknis</label>
              <input class="masukan" id="p-upt" value="${amankan(u.assigned_upt || '')}"
                     placeholder="Kosongkan bila tidak dibatasi ke satu unit">
              <div class="ket">Bila diisi, pengguna ini hanya melihat berita unit tersebut.</div>
            </div>

            <div class="isian">
              <label for="p-aktif">Keadaan akun</label>
              <select class="pilihan penuh" id="p-aktif">
                <option value="aktif"${u.aktif !== false ? ' selected' : ''}>Aktif</option>
                <option value="nonaktif"${u.aktif === false ? ' selected' : ''}>Nonaktif</option>
              </select>
              <div class="ket">Akun nonaktif ditolak sejak pemeriksaan profil, sebelum satu kueri pun jalan.</div>
            </div>
          </div>

          <div class="baris gap-6" style="margin-top:14px">
            ${tombol({ label: 'Simpan perubahan', ikon: 'centang', gaya: 'utama', aksi: 'simpan-pengguna',
              nonaktif: keadaanPengguna.sibuk })}
            ${tombol({ label: 'Batal', aksi: 'batal-sunting' })}
          </div>
        </div>
      </td>
    </tr>`
}

/* ---------------------------------------------------------------- halaman */

export function halamanPengguna({ keadaan, isi }) {
  function gambar() {
    if (!keadaanPengguna.dimuat) {
      isi.innerHTML = kartu({ judul: 'Pengguna', isi: '<p class="samar-teks">Memuat daftar pengguna…</p>' })
      return
    }

    const daftar = keadaanPengguna.daftar
    const tanpaAkun = daftar.filter((u) => !u.auth_user_id)
    const wilayahKosong = daftar.filter((u) => adalahEksternal(u.role) && !u.assigned_kanwil)

    isi.innerHTML = `
      <div class="tumpuk">
        ${keadaanPengguna.galat ? pesanSistem(
          `<b>Daftar pengguna tidak dapat dibaca.</b> ${amankan(keadaanPengguna.galat)}`, 'kritis', 'peringatan') : ''}

        ${tanpaAkun.length ? pesanSistem(
          `<b>${angka(tanpaAkun.length)} profil belum punya akun masuk.</b> Profilnya ada dan
           perannya sudah ditetapkan, tetapi belum tertaut ke satu pun identitas — sehingga
           belum bisa masuk sama sekali. Cara menerbitkannya ada di bagian bawah halaman ini.`,
          'sedang', 'info') : ''}

        ${wilayahKosong.length ? pesanSistem(
          `<b>${angka(wilayahKosong.length)} akun wilayah belum ditetapkan kantor wilayahnya.</b>
           Selama kosong, kiriman berita mereka akan ditolak basis data dan layarnya tampak kosong
           tanpa penjelasan.`, 'kritis', 'peringatan') : ''}

        ${kartu({
          judul: 'Daftar pengguna',
          ket: `${angka(daftar.length)} profil terdaftar`,
          rapat: true,
          isi: daftar.length ? `
            <div class="tabel-bungkus">
              <table class="tabel">
                <thead><tr>
                  <th>Nama</th>
                  <th style="width:210px">Peran</th>
                  <th style="width:170px">Wilayah</th>
                  <th style="width:190px">Keadaan</th>
                  <th style="width:96px">Masuk terakhir</th>
                  <th style="width:90px"></th>
                </tr></thead>
                <tbody>
                  ${daftar.map((u) => barisPengguna(u, keadaanPengguna.sunting === u.id, keadaanPengguna.kanwil)).join('')}
                </tbody>
              </table>
            </div>` : kosong('Belum ada profil', 'Tidak ada satu pun profil yang dapat Anda baca.'),
        })}

        ${kartu({
          judul: 'Menerbitkan akun baru',
          ket: 'Dikerjakan dari panel Supabase — dan memang tidak dari sini',
          isi: `
            <div class="tumpuk" style="gap:12px">
              <p class="kecil-teks" style="margin:0;color:var(--ink-2)">
                Membuat akun berarti menulis ke tabel identitas, dan itu hanya bisa dilakukan
                dengan kunci layanan. Kunci itu tidak pernah boleh berada di peramban — karena itu
                langkahnya dijelaskan di sini, bukan disediakan sebagai tombol.
              </p>

              <ol class="kecil-teks" style="margin:0;padding-left:20px;line-height:1.7;color:var(--ink-2)">
                <li>Buka Supabase → <b>Authentication</b> → <b>Add user</b> → <i>Create new user</i>.</li>
                <li>Isi <b>Email</b> dengan pola
                  <code>&lt;username&gt;@${amankan(RANAH_USERNAME)}</code> —
                  ranah ini tidak pernah menerima surat; ia hanya wadah bagi username.</li>
                <li>Isi <b>Password</b> dengan sandi awal, lalu centang <i>Auto Confirm User</i>.</li>
                <li>Pada <b>User metadata</b>, isi <code>username</code>, <code>full_name</code>,
                  dan <code>role</code>.</li>
                <li>Profil aplikasinya terbentuk sendiri. Kembali ke halaman ini untuk menetapkan
                  wilayah bila perannya peran wilayah.</li>
              </ol>

              ${pesanSistem(
                'Petugas cukup mengetik <b>username</b>-nya di halaman masuk — bukan alamat surel '
                + 'panjang di atas. Pemulihan sandi lewat surel tidak berlaku bagi akun semacam ini; '
                + 'yang lupa sandi meminta administrator mengatur ulang dari panel yang sama.',
                'netral', 'info')}
            </div>`,
        })}
      </div>`
  }

  /* ----------------------------------------------------------- simpanan */

  async function simpan(id) {
    if (keadaanPengguna.sibuk) return
    const u = keadaanPengguna.daftar.find((x) => x.id === id)
    if (!u) return

    const peranBaru = isi.querySelector('#p-peran')?.value || u.role
    const kanwilBaru = isi.querySelector('#p-kanwil')?.value.trim() || null
    const uptBaru = isi.querySelector('#p-upt')?.value.trim() || null
    const aktifBaru = isi.querySelector('#p-aktif')?.value !== 'nonaktif'

    if (adalahEksternal(peranBaru) && !kanwilBaru) {
      roti('Peran wilayah wajib punya kantor wilayah. Kiriman tanpa wilayah ditolak basis data.', 'sedang', 6000)
      isi.querySelector('#p-kanwil')?.focus()
      return
    }

    // Menonaktifkan diri sendiri mengunci orang dari sistemnya sendiri, dan
    // pemulihannya menuntut panel Supabase. Ditanyakan dulu, bukan dicegah —
    // kadang memang itu yang dimaksud.
    if (u.auth_user_id && u.auth_user_id === keadaan.profil?.auth_user_id && !aktifBaru) {
      const ya = await konfirmasi({
        judul: 'Nonaktifkan akun Anda sendiri?',
        pesan: 'Anda akan langsung kehilangan akses, dan hanya administrator lain atau panel '
          + 'Supabase yang bisa mengaktifkannya kembali.',
        tegas: 'Nonaktifkan', bahaya: true,
      })
      if (!ya) return
    }

    const perubahan = {
      role: peranBaru,
      assigned_kanwil: kanwilBaru,
      assigned_upt: uptBaru,
      aktif: aktifBaru,
    }

    keadaanPengguna.sibuk = true
    gambar()

    if (keadaan.demo) {
      roti('Mode peragaan: perubahan tidak disimpan.', 'sedang', 5000)
      keadaanPengguna.sibuk = false
      keadaanPengguna.sunting = null
      gambar()
      return
    }

    try {
      const hasil = await perbarui('app_users', { id: `eq.${id}` }, perubahan)
      const baru = Array.isArray(hasil) ? hasil[0] : hasil
      Object.assign(u, baru || perubahan)
      keadaanPengguna.sunting = null
      roti(`Profil ${u.username} diperbarui.`, 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 7000)
    } finally {
      keadaanPengguna.sibuk = false
      gambar()
    }
  }

  /* ---------------------------------------------------------- penyimak */

  isi.addEventListener('change', (ev) => {
    if (ev.target.id !== 'p-peran') return
    const ket = isi.querySelector('#p-ket-peran')
    if (ket) ket.textContent = PERAN[ev.target.value]?.tugas || ''
  })

  isi.addEventListener('click', (ev) => {
    const tombolAksi = ev.target.closest('[data-aksi]')
    if (!tombolAksi) return
    const aksi = tombolAksi.dataset.aksi

    if (aksi === 'sunting') {
      keadaanPengguna.sunting = tombolAksi.dataset.id
      gambar()
      isi.querySelector('#p-peran')?.focus()
    } else if (aksi === 'batal-sunting') {
      keadaanPengguna.sunting = null
      gambar()
    } else if (aksi === 'simpan-pengguna') {
      const wadah = tombolAksi.closest('.sunting-pengguna')
      if (wadah) simpan(wadah.dataset.id)
    }
  })

  /* -------------------------------------------------------------- muat */

  async function muat() {
    if (keadaan.demo) {
      keadaanPengguna.daftar = penggunaDemo()
      keadaanPengguna.kanwil = [KANWIL_DEMO, 'Kanwil Jawa Tengah', 'Kanwil Jawa Timur']
      keadaanPengguna.dimuat = true
      gambar()
      return
    }

    try {
      keadaanPengguna.daftar = await ambil('app_users', {
        select: 'id,username,full_name,role,jabatan,assigned_kanwil,assigned_upt,aktif,'
          + 'auth_user_id,last_login,email',
        deleted_at: 'is.null',
        order: 'role.asc,username.asc',
      }) || []
    } catch (galat) {
      keadaanPengguna.galat = pesanRamah(galat)
    }

    // Daftar kanwil diambil dari master unit, bukan diketik tangan — 38 nama
    // yang diketik tangan akan berbeda ejaannya dari yang ada di master, dan
    // pembatasan wilayah dicocokkan persis huruf demi huruf.
    try {
      const unit = await ambil('upt', { select: 'kanwil', aktif: 'eq.true', limit: 1000 }) || []
      keadaanPengguna.kanwil = [...new Set(unit.map((u) => u.kanwil).filter(Boolean))].sort()
    } catch {
      keadaanPengguna.kanwil = []
    }

    keadaanPengguna.dimuat = true
    gambar()
  }

  gambar()
  muat()

  return {
    judul: 'Manajemen Pengguna',
    sub: 'Peran, wilayah penugasan, dan keaktifan akun',
  }
}
