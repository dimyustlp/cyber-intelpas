/**
 * Manajemen Pengguna.
 *
 * Halaman ini menerbitkan akun, dan pekerjaan itu tidak dikerjakan di peramban.
 * Membuat akun berarti menulis ke tabel identitas, dan itu menuntut kunci
 * layanan — kunci yang tidak pernah boleh dikirim ke peramban, sebab siapa pun
 * yang membuka tab jaringan akan memegang seluruh basis data. Yang dikirim dari
 * sini hanyalah permintaan; yang memutuskan boleh atau tidaknya adalah Edge
 * Function `kelola-pengguna`.
 *
 * Wewenangnya bertingkat, sesuai cara kerja organisasinya:
 *
 *   Administrator Sistem Intelijen  →  menerbitkan peran apa pun.
 *   Administrator Kantor Wilayah    →  hanya Penelaah Berita UPT, dan hanya
 *                                      untuk unit di wilayahnya sendiri.
 *
 * Formulir di bawah menyembunyikan pilihan yang tidak berhak dipakai, tetapi
 * itu bukan pengamanannya. Pengamanannya ada di peladen, dan tetap menolak
 * sekalipun seseorang menyusun permintaannya sendiri di luar halaman ini.
 *
 * Satu aturan yang mudah terlihat sewenang-wenang dan sebenarnya tidak:
 * **akun kantor wilayah wajib memakai alamat surel sebagai username.** Petugas
 * wilayah berganti-ganti orang, dan alamat surat dinas adalah satu-satunya
 * penanda yang masih bisa ditelusuri ketika sebuah akun perlu
 * dipertanggungjawabkan setahun kemudian. Akun internal diterbitkan untuk
 * jabatan, bukan untuk kotak surat, jadi ia tetap memakai username polos.
 */

import { kartu, keping, kosong, pesanSistem, tombol, roti, konfirmasi } from '../ui/komponen.js'
import { amankan, angka, jarakWaktu, tanggalJam } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, perbarui, panggilEdge, pesanRamah, RANAH_USERNAME, tampakSurel } from '../lib/api.js'
import { PERAN, labelPeran, adalahEksternal, adalahUnit, peranBaku, punyaIzin } from '../lib/peran.js'
import { penggunaDemo, KANWIL_DEMO } from '../lib/demo.js'

/** Sama persis dengan pola di Edge Function. Yang menolak tetap peladen. */
const POLA_USERNAME = /^[a-z0-9][a-z0-9._-]{2,31}$/

const keadaanPengguna = {
  dimuat: false,
  daftar: [],
  kanwil: [],
  galat: null,
  /** Baris yang sedang disunting, satu per satu — bukan tabel yang bisa diedit serentak. */
  sunting: null,
  sibuk: false,
  /** Formulir penerbitan akun sedang terbuka. */
  tambah: false,
  /** Peran yang sedang dipilih pada formulir, supaya keterangannya ikut berubah. */
  peranBaru: '',
  /** Unit yang sedang diketik pada formulir penerbitan akun petugas unit. */
  uptBaru: '',
  /** Nama unit di wilayah penerbit, untuk daftar bantu pada kolom unit. */
  upt: [],
  /** Hasil penerbitan terakhir — ditampilkan sekali, lalu hilang. */
  terbit: null,
}

/**
 * Peran yang boleh diterbitkan Administrator Kantor Wilayah.
 *
 * Tinggal satu: Penelaah Berita UPT, untuk unit-unit di wilayahnya. Peran itu
 * sendiri tidak bisa menerbitkan akun apa pun. Batasnya ditegakkan Edge
 * Function — daftar ini hanya menentukan isi kotak pilihan.
 */
export const PERAN_TERBIT_KANWIL = ['upt_penelaah']

/**
 * Isian penugasan yang dianggap kosong.
 *
 * Kotak yang benar-benar kosong sudah lama menjadi `null`. Yang belum tertangkap
 * sampai 3 September 2026 adalah kata "NULL" yang DIKETIK — dan itulah persis
 * yang ditampilkan editor tabel Supabase untuk sel kosong, sehingga siapa pun
 * yang menyalin nilai dari sana menyalin empat huruf, bukan ketiadaan nilai.
 *
 * Akibatnya sungguh terjadi pada akun `dimyust`: `assigned_upt` berisi teks
 * "NULL", dan policy RLS `can_access_upt` — yang hanya mengosongkan string
 * kosong, bukan kata "NULL" — memperlakukannya sebagai petugas yang ditugaskan
 * pada sebuah unit bernama "NULL". Ia superadmin, dan tidak satu pun dari 822
 * berita cocok dengan nama unit itu. Dasbornya kosong, tanpa satu pun galat.
 *
 * Yang sengaja TIDAK dilakukan: melonggarkan policy RLS supaya ikut menerima
 * kata "NULL" sebagai ketiadaan. Policy yang gagal menutup lebih berbahaya
 * daripada policy yang gagal membuka — yang pertama membocorkan data, yang
 * kedua hanya menghasilkan layar kosong yang segera dilaporkan orang. Maka yang
 * diperketat adalah penulisnya, bukan pembacanya.
 */
export function kosongkan(nilai) {
  const t = String(nilai ?? '').trim()
  if (!t) return null
  if (['null', 'nil', 'none', '-', '—'].includes(t.toLowerCase())) return null
  return t
}

function pilihanPeran(hanyaDaerah) {
  const daftar = Object.entries(PERAN).map(([kode, p]) => ({
    kode, nama: p.nama, eksternal: adalahEksternal(kode),
  }))
  return hanyaDaerah ? daftar.filter((p) => PERAN_TERBIT_KANWIL.includes(p.kode)) : daftar
}

/* ------------------------------------------------------------------ baris */

function barisPengguna(u, sedangDisunting, kanwil, bolehSunting) {
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
        ${u.must_change_password ? keping('Sandi awal', 'sedang', true) : ''}
      </td>
      <td class="kecil" title="${amankan(u.last_login ? tanggalJam(u.last_login) : '')}">
        ${u.last_login ? amankan(jarakWaktu(u.last_login)) : '—'}
      </td>
      <td class="rata-kanan">
        ${bolehSunting
          ? tombol({ label: 'Sunting', ikon: 'saring', kecil: true, aksi: 'sunting', judul: `Sunting ${u.username}` })
            .replace('<button', `<button data-id="${amankan(u.id)}"`)
          : ''}
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
                ${pilihanPeran(false).map((p) => `
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

/* -------------------------------------------------------- formulir terbit */

function formulirTerbit({ hanyaDaerah, wilayahTetap, daftarKanwil }) {
  const peran = keadaanPengguna.peranBaru || (hanyaDaerah ? 'upt_penelaah' : 'news_data_operator')
  const wilayah = adalahEksternal(peran)
  const unit = adalahUnit(peran)

  return `
    <form class="terbit-akun" id="borang-terbit" novalidate>
      <div class="kisi kisi-2" style="gap:12px">
        <div class="isian">
          <label for="t-nama">Nama lengkap <span class="wajib">wajib</span></label>
          <input class="masukan" id="t-nama" type="text" autocomplete="off"
                 placeholder="Nama sebagaimana tertulis pada SK">
        </div>

        <div class="isian">
          <label for="t-peran">Peran <span class="wajib">wajib</span></label>
          ${/*
            Admin kanwil kini memilih di antara dua peran, bukan menerima satu
            yang sudah ditetapkan. Kotak pilihannya tetap kotak pilihan yang
            sama supaya penyimaknya satu, bukan dua jalur yang berpisah pelan-
            pelan setiap kali salah satunya disunting.
          */''}
          <select class="pilihan penuh" id="t-peran">
            ${pilihanPeran(hanyaDaerah).map((p) => `
              <option value="${amankan(p.kode)}"${p.kode === peran ? ' selected' : ''}>
                ${amankan(p.nama)}${!hanyaDaerah && p.eksternal ? ' — daerah' : ''}
              </option>`).join('')}
          </select>
          <div class="ket" id="t-ket-peran">${amankan(PERAN[peran]?.tugas || '')}</div>
        </div>
      </div>

      ${/*
        Satu kolom yang berganti arti menurut peran, bukan dua kolom berbeda.
        Dua kolom akan menuntut penerbit memahami lebih dulu mana yang berlaku
        bagi peran yang ia pilih — padahal itu justru yang perlu dijelaskan
        sistem kepadanya.
      */''}
      <div class="isian" style="margin-top:12px">
        <label for="t-username">
          ${wilayah ? 'Alamat surel dinas' : 'Username'} <span class="wajib">wajib</span>
        </label>
        <input class="masukan" id="t-username" type="${wilayah ? 'email' : 'text'}"
               autocapitalize="none" spellcheck="false" autocomplete="off"
               placeholder="${wilayah ? 'nama.petugas@kemenimipas.go.id' : 'budi.santoso'}">
        <div class="ket" id="t-ket-username">
          ${wilayah
            ? 'Akun kantor wilayah <b>wajib</b> memakai alamat surel. Alamat inilah yang '
              + 'diketik petugas saat masuk, dan yang menjadi penanggung jawab akun ini.'
            : `Huruf kecil, angka, titik, garis bawah, atau tanda hubung. Sistem menambahkan
               <code>@${amankan(RANAH_USERNAME)}</code> sendiri sebagai identitas —
               petugas cukup mengetik username-nya.`}
        </div>
      </div>

      <div class="kisi kisi-2" style="gap:12px;margin-top:12px">
        <div class="isian">
          <label for="t-kanwil">Kantor wilayah${wilayah ? ' <span class="wajib">wajib</span>' : ''}</label>
          ${wilayahTetap
            ? `<input class="masukan" id="t-kanwil-tampil" value="${amankan(wilayahTetap)}" readonly>
               <input type="hidden" id="t-kanwil" value="${amankan(wilayahTetap)}">
               <div class="ket">Akun yang Anda terbitkan selalu terikat pada wilayah Anda sendiri.</div>`
            : `<input class="masukan" id="t-kanwil" list="daftar-kanwil-terbit"
                      placeholder="${wilayah ? 'Wajib untuk peran wilayah' : 'Kosongkan untuk cakupan nasional'}"
                      ${wilayah ? '' : 'disabled'}>
               <datalist id="daftar-kanwil-terbit">
                 ${daftarKanwil.map((k) => `<option value="${amankan(k)}"></option>`).join('')}
               </datalist>
               <div class="ket" id="t-ket-kanwil">
                 ${wilayah ? 'Menentukan berita mana yang boleh ia lihat dan atas nama siapa ia mengirim.'
                   : 'Peran pusat tidak dibatasi wilayah.'}
               </div>`}
        </div>

        ${/*
          Kolom unit hanya muncul untuk peran yang cakupannya memang satu unit.
          Menampilkannya bagi semua peran akan mengundang penerbit mengisinya
          "sekalian" — dan sebuah akun kantor wilayah yang kolom unitnya terisi
          diam-diam menyusut menjadi akun satu unit, tanpa satu pun pesan yang
          menyebutkannya.
        */''}
        ${unit ? `
        <div class="isian">
          <label for="t-upt">Unit pelaksana teknis <span class="wajib">wajib</span></label>
          <input class="masukan" id="t-upt" list="daftar-upt-terbit" autocomplete="off"
                 value="${amankan(keadaanPengguna.uptBaru || '')}"
                 placeholder="mis. Lapas Kelas IIA Kediri">
          <datalist id="daftar-upt-terbit">
            ${(keadaanPengguna.upt || []).map((u) => `<option value="${amankan(u)}"></option>`).join('')}
          </datalist>
          <div class="ket">
            Ditulis <b>persis</b> seperti pada data induk UPT. Petugas ini hanya melihat berita
            unit ini — salah satu huruf saja berarti layarnya kosong selamanya.
          </div>
        </div>` : `
        <div class="isian">
          <label for="t-jabatan">Jabatan</label>
          <input class="masukan" id="t-jabatan" type="text" autocomplete="off"
                 placeholder="mis. Kasubsi Intelijen">
          <div class="ket">Hanya keterangan pada profil. Tidak memengaruhi hak akses.</div>
        </div>`}
      </div>

      ${unit ? `
      <div class="isian" style="margin-top:12px">
        <label for="t-jabatan">Jabatan</label>
        <input class="masukan" id="t-jabatan" type="text" autocomplete="off"
               placeholder="mis. Kasubsi Pengamanan">
        <div class="ket">Hanya keterangan pada profil. Tidak memengaruhi hak akses.</div>
      </div>` : ''}

      <div class="kisi kisi-2" style="gap:12px;margin-top:12px">
        <div class="isian">
          <label for="t-sandi">Kata sandi awal <span class="wajib">wajib</span></label>
          <input class="masukan" id="t-sandi" type="password" autocomplete="new-password"
                 placeholder="Minimal 8 karakter">
        </div>
        <div class="isian">
          <label for="t-sandi2">Ulangi kata sandi <span class="wajib">wajib</span></label>
          <input class="masukan" id="t-sandi2" type="password" autocomplete="new-password"
                 placeholder="Ketik ulang">
          <div class="ket">
            Sandi ini Anda sampaikan sendiri kepada yang bersangkutan. Sistem tidak mengirim surel.
          </div>
        </div>
      </div>

      <div class="baris gap-6" style="margin-top:16px">
        ${tombol({ label: 'Terbitkan akun', ikon: 'centang', gaya: 'utama', aksi: 'terbitkan',
          nonaktif: keadaanPengguna.sibuk })}
        ${tombol({ label: 'Batal', aksi: 'batal-terbit' })}
      </div>
    </form>`
}

/* ---------------------------------------------------------------- halaman */

export function halamanPengguna({ keadaan, isi }) {
  const peranSaya = keadaan.profil?.role
  const bolehSemua = punyaIzin(peranSaya, 'kelola_pengguna')
  const bolehWilayah = !bolehSemua && punyaIzin(peranSaya, 'kelola_pengguna_wilayah')
  const bolehTerbit = bolehSemua || bolehWilayah
  const wilayahSaya = keadaan.profil?.assigned_kanwil || null

  function gambar() {
    if (!keadaanPengguna.dimuat) {
      isi.innerHTML = kartu({ judul: 'Pengguna', isi: '<p class="samar-teks">Memuat daftar pengguna…</p>' })
      return
    }

    const daftar = keadaanPengguna.daftar
    const tanpaAkun = daftar.filter((u) => !u.auth_user_id)
    const wilayahKosong = daftar.filter((u) => adalahEksternal(u.role) && !u.assigned_kanwil)
    const t = keadaanPengguna.terbit

    isi.innerHTML = `
      <div class="tumpuk">
        ${keadaanPengguna.galat ? pesanSistem(
          `<b>Daftar pengguna tidak dapat dibaca.</b> ${amankan(keadaanPengguna.galat)}`, 'kritis', 'peringatan') : ''}

        ${t ? pesanSistem(
          `<b>Akun ${amankan(t.nama)} diterbitkan.</b> Ia masuk dengan
           <code>${amankan(t.masuk)}</code> dan kata sandi awal yang Anda tetapkan.
           Sampaikan keduanya langsung kepada yang bersangkutan — sistem tidak mengirim surel.`,
          'positif', 'centang') : ''}

        ${bolehWilayah && !wilayahSaya ? pesanSistem(
          '<b>Wilayah pada akun Anda sendiri belum ditetapkan.</b> Selama itu kosong, '
          + 'Anda belum bisa menerbitkan akun penginput. Hubungi Administrator Sistem Intelijen.',
          'kritis', 'peringatan') : ''}

        ${tanpaAkun.length ? pesanSistem(
          `<b>${angka(tanpaAkun.length)} profil belum punya akun masuk.</b> Profilnya ada dan
           perannya sudah ditetapkan, tetapi belum tertaut ke satu pun identitas — sehingga
           belum bisa masuk sama sekali. Terbitkan ulang akunnya, atau hubungi administrator sistem.`,
          'sedang', 'info') : ''}

        ${wilayahKosong.length ? pesanSistem(
          `<b>${angka(wilayahKosong.length)} akun wilayah belum ditetapkan kantor wilayahnya.</b>
           Selama kosong, kiriman berita mereka akan ditolak basis data dan layarnya tampak kosong
           tanpa penjelasan.`, 'kritis', 'peringatan') : ''}

        ${keadaanPengguna.tambah && bolehTerbit ? kartu({
          judul: 'Terbitkan akun baru',
          ket: bolehWilayah
            ? `Penelaah Berita UPT untuk salah satu unit di ${amankan(wilayahSaya || 'wilayah Anda')}`
            : 'Peran pusat, peran kantor wilayah, maupun peran unit',
          isi: formulirTerbit({
            hanyaDaerah: bolehWilayah,
            wilayahTetap: bolehWilayah ? wilayahSaya : null,
            daftarKanwil: keadaanPengguna.kanwil,
          }),
        }) : ''}

        ${kartu({
          judul: bolehWilayah ? 'Pengguna di wilayah Anda' : 'Daftar pengguna',
          ket: `${angka(daftar.length)} profil terdaftar`,
          aksi: bolehTerbit && !keadaanPengguna.tambah
            ? tombol({ label: 'Tambah pengguna', ikon: 'tambah', gaya: 'utama', kecil: true, aksi: 'buka-terbit' })
            : '',
          rapat: true,
          isi: daftar.length ? `
            <div class="tabel-bungkus">
              <table class="tabel">
                <thead><tr>
                  <th>Nama</th>
                  <th style="width:210px">Peran</th>
                  <th style="width:170px">Wilayah</th>
                  <th style="width:220px">Keadaan</th>
                  <th style="width:96px">Masuk terakhir</th>
                  <th style="width:90px"></th>
                </tr></thead>
                <tbody>
                  ${daftar.map((u) => barisPengguna(
                    u,
                    keadaanPengguna.sunting === u.id,
                    keadaanPengguna.kanwil,
                    bolehSemua || (bolehWilayah && PERAN_TERBIT_KANWIL.includes(peranBaku(u.role))),
                  )).join('')}
                </tbody>
              </table>
            </div>` : kosong(
              'Belum ada profil',
              bolehWilayah
                ? 'Belum ada pengguna di wilayah Anda. Mulailah dengan menerbitkan akun penginput.'
                : 'Tidak ada satu pun profil yang dapat Anda baca.',
              bolehTerbit ? tombol({ label: 'Tambah pengguna', ikon: 'tambah', gaya: 'utama', aksi: 'buka-terbit' }) : '',
            ),
        })}

        ${kartu({
          judul: 'Yang tetap dikerjakan dari panel Supabase',
          ket: 'Dua hal yang sengaja tidak ada tombolnya di sini',
          isi: `
            <ul class="kecil-teks" style="margin:0;padding-left:20px;line-height:1.7;color:var(--ink-2)">
              <li><b>Mengatur ulang kata sandi orang lain.</b> Supabase → Authentication →
                pilih penggunanya → <i>Reset password</i>. Pengguna yang masih ingat sandinya
                dapat menggantinya sendiri di halaman Profil Saya.</li>
              <li><b>Menghapus akun secara permanen.</b> Di sini akun cukup dinonaktifkan —
                jejak siapa memasukkan berita apa tidak boleh ikut hilang bersama akunnya.</li>
            </ul>`,
        })}
      </div>`
  }

  /* ----------------------------------------------------------- penerbitan */

  async function terbitkan() {
    if (keadaanPengguna.sibuk) return

    const nilai = (id) => isi.querySelector(id)?.value ?? ''
    const nama = nilai('#t-nama').trim()
    const peran = nilai('#t-peran')
    const username = nilai('#t-username').trim().toLowerCase()
    // Sama seperti pada formulir suntingan: kata "NULL" yang diketik adalah
    // ketiadaan nilai, bukan nama kantor wilayah. Lihat `kosongkan()`.
    const kanwil = kosongkan(nilai('#t-kanwil')) || ''
    const upt = kosongkan(nilai('#t-upt')) || ''
    const jabatan = nilai('#t-jabatan').trim()
    const sandi = nilai('#t-sandi')
    const sandi2 = nilai('#t-sandi2')

    const wilayah = adalahEksternal(peran)
    const unit = adalahUnit(peran)
    const fokus = (id) => isi.querySelector(id)?.focus()

    /*
       Pemeriksaan di bawah hanya untuk menghemat perjalanan ke peladen dan
       memberi kalimat yang lebih dekat ke kolomnya. Peladen memeriksa semuanya
       lagi dari nol, dan jawabannya yang menentukan.
    */
    if (!nama || nama.length < 2) { roti('Nama lengkap wajib diisi.', 'sedang'); fokus('#t-nama'); return }

    if (!username) { roti('Username wajib diisi.', 'sedang'); fokus('#t-username'); return }

    if (wilayah && !tampakSurel(username)) {
      roti('Akun kantor wilayah wajib memakai alamat surel sebagai username.', 'sedang', 6000)
      fokus('#t-username'); return
    }

    if (!wilayah && tampakSurel(username)) {
      roti('Akun internal memakai username polos, bukan alamat surel.', 'sedang', 6000)
      fokus('#t-username'); return
    }

    if (!wilayah && !POLA_USERNAME.test(username)) {
      roti('Username hanya boleh huruf kecil, angka, titik, garis bawah, atau tanda hubung (3–32 karakter).',
        'sedang', 7000)
      fokus('#t-username'); return
    }

    if (wilayah && !kanwil) {
      roti('Akun kantor wilayah wajib menyebutkan kantor wilayahnya.', 'sedang')
      fokus('#t-kanwil'); return
    }

    /*
       Akun petugas unit tanpa nama unit adalah akun yang tidak pernah melihat
       satu baris pun: policy basis data menolak setiap barisnya, dan layarnya
       kosong tanpa sebab yang terbaca. Ditahan di sini supaya penerbitnya tahu
       sekarang, bukan sesudah petugasnya melapor.
    */
    if (unit && !upt) {
      roti('Akun petugas unit wajib menyebutkan unitnya.', 'sedang')
      fokus('#t-upt'); return
    }

    if (unit && keadaanPengguna.upt.length && !keadaanPengguna.upt.includes(upt)) {
      roti('Nama unit tidak ada pada data induk. Pilihlah dari daftar yang muncul saat mengetik.',
        'sedang', 7000)
      fokus('#t-upt'); return
    }

    if (sandi.length < 8) { roti('Kata sandi awal minimal 8 karakter.', 'sedang'); fokus('#t-sandi'); return }
    if (sandi !== sandi2) { roti('Kedua kata sandi belum sama.', 'sedang'); fokus('#t-sandi2'); return }

    const ya = await konfirmasi({
      judul: 'Terbitkan akun ini?',
      pesan: `${nama} akan dapat masuk sebagai ${PERAN[peran]?.nama || peran}`
        + `${wilayah && kanwil ? ` di ${kanwil}` : ''}, memakai `
        + `${wilayah ? username : `username ${username}`} dan sandi yang Anda tetapkan.`,
      tegas: 'Terbitkan',
    })
    if (!ya) return

    keadaanPengguna.sibuk = true
    gambar()

    if (keadaan.demo) {
      roti('Mode peragaan: akun tidak benar-benar diterbitkan.', 'sedang', 5000)
      keadaanPengguna.sibuk = false
      gambar()
      return
    }

    try {
      const hasil = await panggilEdge('kelola-pengguna', {
        aksi: 'buat',
        full_name: nama,
        username,
        role: peran,
        jabatan,
        assigned_kanwil: wilayah ? kanwil : null,
        assigned_upt: unit ? upt : null,
        password: sandi,
      })

      if (!hasil?.ok) throw new Error(hasil?.pesan || 'Akun gagal diterbitkan.')

      if (hasil.pengguna) keadaanPengguna.daftar.unshift(hasil.pengguna)
      keadaanPengguna.terbit = { nama, masuk: hasil.masuk_dengan || username }
      keadaanPengguna.tambah = false
      keadaanPengguna.peranBaru = ''
      keadaanPengguna.uptBaru = ''
      roti(hasil.pesan || 'Akun diterbitkan.', 'positif', 6000)
    } catch (galat) {
      // Pesan dari Edge Function sudah berbahasa Indonesia dan menyebut sebabnya;
      // yang perlu diterjemahkan hanya galat jaringan dan penolakan sesi.
      roti(galat?.rinci?.pesan || galat?.message || pesanRamah(galat), 'kritis', 8000)
    } finally {
      keadaanPengguna.sibuk = false
      gambar()
    }
  }

  /* ----------------------------------------------------------- suntingan */

  async function simpan(id) {
    if (keadaanPengguna.sibuk) return
    const u = keadaanPengguna.daftar.find((x) => x.id === id)
    if (!u) return

    const peranBaru = isi.querySelector('#p-peran')?.value || u.role
    const kanwilBaru = kosongkan(isi.querySelector('#p-kanwil')?.value)
    const uptBaru = kosongkan(isi.querySelector('#p-upt')?.value)
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
    if (ev.target.id === 'p-peran') {
      const ket = isi.querySelector('#p-ket-peran')
      if (ket) ket.textContent = PERAN[ev.target.value]?.tugas || ''
      return
    }

    // Mengganti peran pada formulir penerbitan mengubah arti kolom username,
    // jadi formulirnya digambar ulang — dengan isian yang sudah diketik tetap
    // dipertahankan, sebab kehilangan ketikan karena mengganti satu pilihan
    // adalah cara tercepat membuat orang berhenti memakai sebuah borang.
    if (ev.target.id === 't-peran') {
      const simpanan = {
        nama: isi.querySelector('#t-nama')?.value || '',
        username: isi.querySelector('#t-username')?.value || '',
        jabatan: isi.querySelector('#t-jabatan')?.value || '',
        kanwil: isi.querySelector('#t-kanwil')?.value || '',
      }
      keadaanPengguna.uptBaru = isi.querySelector('#t-upt')?.value || keadaanPengguna.uptBaru
      keadaanPengguna.peranBaru = ev.target.value
      gambar()
      const pasang = (id, nilai) => { const el = isi.querySelector(id); if (el && nilai) el.value = nilai }
      pasang('#t-nama', simpanan.nama)
      pasang('#t-username', simpanan.username)
      pasang('#t-jabatan', simpanan.jabatan)
      pasang('#t-kanwil', simpanan.kanwil)
    }
  })

  isi.addEventListener('input', (ev) => {
    if (ev.target.id === 't-upt') keadaanPengguna.uptBaru = ev.target.value
  })

  isi.addEventListener('submit', (ev) => { ev.preventDefault(); terbitkan() })

  isi.addEventListener('click', (ev) => {
    const tombolAksi = ev.target.closest('[data-aksi]')
    if (!tombolAksi) return
    const aksi = tombolAksi.dataset.aksi

    if (aksi === 'buka-terbit') {
      keadaanPengguna.tambah = true
      keadaanPengguna.terbit = null
      keadaanPengguna.peranBaru = bolehWilayah ? 'upt_penelaah' : ''
      gambar()
      isi.querySelector('#t-nama')?.focus()
    } else if (aksi === 'batal-terbit') {
      keadaanPengguna.tambah = false
      keadaanPengguna.peranBaru = ''
      gambar()
    } else if (aksi === 'terbitkan') {
      ev.preventDefault()
      terbitkan()
    } else if (aksi === 'sunting') {
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
      keadaanPengguna.daftar = bolehWilayah
        ? penggunaDemo().filter((u) => u.assigned_kanwil === (wilayahSaya || KANWIL_DEMO))
        : penggunaDemo()
      keadaanPengguna.kanwil = [KANWIL_DEMO, 'Kanwil Jawa Tengah', 'Kanwil Jawa Timur']
      keadaanPengguna.upt = ['Lapas Kelas IIA Kediri', 'Lapas Kelas IIB Blitar', 'LPKA Kelas I Blitar']
      keadaanPengguna.dimuat = true
      gambar()
      return
    }

    try {
      keadaanPengguna.daftar = await ambil('app_users', {
        select: 'id,username,full_name,role,jabatan,assigned_kanwil,assigned_upt,aktif,'
          + 'auth_user_id,last_login,email,must_change_password',
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
      const unit = await ambil('upt', { select: 'nama_upt,kanwil', aktif: 'eq.true', limit: 1000 }) || []
      keadaanPengguna.kanwil = [...new Set(unit.map((u) => u.kanwil).filter(Boolean))].sort()

      /* Admin kanwil hanya boleh menerbitkan petugas untuk unit di wilayahnya
         sendiri. Daftar bantunya dipotong di sini juga — bukan sebagai
         penjagaan, melainkan supaya ia tidak perlu mencari namanya di antara
         lima ratus unit yang sebagian besar bukan urusannya. */
      const relevan = bolehWilayah && wilayahSaya
        ? unit.filter((u) => u.kanwil === wilayahSaya)
        : unit
      keadaanPengguna.upt = [...new Set(relevan.map((u) => u.nama_upt).filter(Boolean))].sort()
    } catch {
      keadaanPengguna.kanwil = []
      keadaanPengguna.upt = []
    }

    keadaanPengguna.dimuat = true
    gambar()
  }

  gambar()
  muat()

  return {
    judul: bolehWilayah ? 'Pengguna Wilayah' : 'Manajemen Pengguna',
    sub: bolehWilayah
      ? `Menerbitkan penelaah berita unit${wilayahSaya ? ` di ${wilayahSaya}` : ''}`
      : 'Penerbitan akun, peran, wilayah penugasan, dan keaktifan',
  }
}
