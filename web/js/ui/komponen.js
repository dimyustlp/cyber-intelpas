/**
 * Potongan antarmuka yang dipakai berulang.
 * Semuanya mengembalikan string HTML, kecuali yang perlu memasang penyimak.
 */

import { amankan, angka, inisial } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'

/**
 * Ubin angka.
 *
 * Sebutkan `halaman` dan ubinnya menjadi tombol yang membuka daftar di balik
 * angkanya. Sebuah angka di dasbor yang tidak bisa ditekan memaksa pembacanya
 * mencari sendiri daftar yang menghasilkannya — dan begitu ia mencari sendiri,
 * saringannya hampir pasti berbeda, sehingga daftar yang ia temukan tidak akan
 * berjumlah sama dengan angka yang barusan ia baca.
 *
 * `saring` diteruskan apa adanya ke halaman tujuan lewat `keadaan.saringMasuk`.
 * Halaman yang tidak mengenali kuncinya mengabaikannya; yang mengenali memakai
 * saringan itu, sehingga panjang daftarnya sama persis dengan angka pada ubin.
 *
 * Dibuat sebagai `<button>`, bukan `<div>` berpenyimak klik. Bedanya bukan
 * gaya: tombol bisa dicapai papan tik, diumumkan pembaca layar sebagai tombol,
 * dan menanggapi Enter maupun spasi tanpa satu baris kode tambahan.
 */
export function ubin({ label, nilai, kaki, nada = 'netral', delta, halaman, saring }) {
  const bagianDelta = delta
    ? `<span class="delta ${delta.arah}">${amankan(delta.teks)}</span>`
    : ''
  const isi = `
      <span class="ubin-label">${amankan(label)}</span>
      <span class="ubin-nilai">${typeof nilai === 'number' ? angka(nilai) : amankan(nilai)}</span>
      <span class="ubin-kaki">${bagianDelta}${kaki ? amankan(kaki) : ''}${halaman ? ikon('panahKanan') : ''}</span>`

  if (!halaman) return `<div class="ubin" data-nada="${nada}">${isi}</div>`

  return `
    <button class="ubin ubin-tekan" data-nada="${nada}"
      data-halaman="${amankan(halaman)}"
      ${saring ? `data-saring="${amankan(JSON.stringify(saring))}"` : ''}
      title="Buka daftar di balik angka ini">${isi}</button>`
}

export function keping(teks, nada = 'rendah', polos = false) {
  return `<span class="keping${polos ? ' polos' : ''}" data-nada="${nada}">${amankan(teks)}</span>`
}

export function kartu({ judul, ket, aksi = '', isi, rapat = false }) {
  return `
    <section class="kartu">
      ${judul ? `<header class="kartu-kop">
        <div>
          <h2>${amankan(judul)}</h2>
          ${ket ? `<div class="ket">${amankan(ket)}</div>` : ''}
        </div>
        ${aksi ? `<div class="dorong baris gap-6">${aksi}</div>` : ''}
      </header>` : ''}
      <div class="kartu-isi${rapat ? ' rapat' : ''}">${isi}</div>
    </section>`
}

export function kosong(judul, pesan, aksi = '') {
  return `
    <div class="kosong">
      ${ikon('kosong')}
      <h3>${amankan(judul)}</h3>
      <p>${amankan(pesan)}</p>
      ${aksi ? `<div style="margin-top:14px">${aksi}</div>` : ''}
    </div>`
}

export function pesanSistem(teks, nada = 'netral', ikonNama = 'info') {
  return `<div class="pesan" data-nada="${nada}">${ikon(ikonNama)}<div>${teks}</div></div>`
}

export function tombol({
  label, ikon: ikonNama, gaya = '', aksi = '', kecil = false,
  nonaktif = false, judul = '', halaman = '',
}) {
  const kelas = ['tbl', gaya, kecil ? 'kecil' : ''].filter(Boolean).join(' ')
  // `halaman` memakai jalur navigasi yang sama dengan menu samping, sehingga
  // tombol "buka" di dalam kartu tidak perlu penanganan sendiri.
  return `<button class="${kelas}" ${aksi ? `data-aksi="${amankan(aksi)}"` : ''}
    ${halaman ? `data-halaman="${amankan(halaman)}"` : ''}
    ${nonaktif ? 'disabled' : ''} ${judul ? `title="${amankan(judul)}"` : ''}>
    ${ikonNama ? ikon(ikonNama) : ''}${label ? amankan(label) : ''}</button>`
}

export function tombolIkon({ ikon: ikonNama, aksi, judul, gaya = 'samar', kecil = false }) {
  return `<button class="tbl ikon ${gaya}${kecil ? ' kecil' : ''}" data-aksi="${amankan(aksi)}"
    title="${amankan(judul)}" aria-label="${amankan(judul)}">${ikon(ikonNama)}</button>`
}

export function bidangCari(nilai = '', placeholder = 'Cari judul, UPT, atau media') {
  return `
    <label class="cari">
      ${ikon('cari')}
      <input class="masukan" type="search" data-peran="cari" value="${amankan(nilai)}"
             placeholder="${amankan(placeholder)}" aria-label="${amankan(placeholder)}">
    </label>`
}

export function pilihan({ nama, nilai, opsi, label }) {
  return `
    <select class="pilihan" data-saring="${amankan(nama)}" aria-label="${amankan(label || nama)}"
            style="width:auto;min-width:120px">
      ${opsi.map((o) => {
        const v = typeof o === 'string' ? o : o.nilai
        const t = typeof o === 'string' ? o : o.teks
        return `<option value="${amankan(v)}"${v === nilai ? ' selected' : ''}>${amankan(t)}</option>`
      }).join('')}
    </select>`
}

export function avatar(nama) {
  return `<div class="avatar" aria-hidden="true">${amankan(inisial(nama))}</div>`
}

export function rangkaTabel(baris = 6, kolom = 5) {
  const sel = () => '<td><div class="rangka"></div></td>'
  return `<table class="tabel"><tbody>${
    Array.from({ length: baris }, () => `<tr>${Array.from({ length: kolom }, sel).join('')}</tr>`).join('')
  }</tbody></table>`
}

/** Roti panggang — pemberitahuan singkat di sudut layar. */
export function roti(teks, nada = 'aksen', durasi = 4200) {
  const wadah = document.getElementById('roti-wadah')
  if (!wadah) return
  const el = document.createElement('div')
  el.className = 'roti'
  el.setAttribute('role', nada === 'kritis' ? 'alert' : 'status')
  el.style.setProperty('--nada', `var(--${nada === 'netral' ? 'accent' : nada})`)
  el.textContent = teks
  wadah.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transition = 'opacity 200ms'
    setTimeout(() => el.remove(), 220)
  }, durasi)
}

/**
 * Sembul konfirmasi. Mengembalikan Promise<boolean>.
 *
 * Tiga hal yang membuatnya berperilaku seperti dialog sungguhan, dan ketiganya
 * pernah tidak ada di sini:
 *
 *   Tab tidak bisa keluar. Tanpa jerat, penekan Tab berpindah ke tombol-tombol
 *   di halaman DI BELAKANG tirai — tombol yang tidak terlihat, tetap bisa
 *   ditekan, dan sebagian di antaranya menghapus sesuatu.
 *
 *   Fokus dikembalikan ke tempat asalnya. Sesudah dialog tertutup, fokus yang
 *   jatuh ke <body> memaksa pemakai papan tik menelusuri seluruh halaman dari
 *   awal hanya untuk kembali ke tombol yang barusan ia tekan.
 *
 *   Dialog berbahaya membuka dengan fokus pada "Batal", bukan pada tombol
 *   tegasnya. Menekan spasi atau Enter karena refleks adalah cara paling umum
 *   sebuah penghapusan terjadi tanpa dimaksudkan.
 */
export function konfirmasi({ judul, pesan, tegas = 'Lanjutkan', batal = 'Batal', bahaya = false }) {
  return new Promise((selesai) => {
    const asal = document.activeElement
    const tirai = document.createElement('div')
    tirai.className = 'tirai'
    tirai.innerHTML = `
      <div class="sembul" role="dialog" aria-modal="true" aria-labelledby="sembul-judul"
           aria-describedby="sembul-pesan">
        <header class="sembul-kop"><h2 id="sembul-judul">${amankan(judul)}</h2></header>
        <div class="sembul-isi"><p id="sembul-pesan">${amankan(pesan)}</p></div>
        <footer class="sembul-kaki">
          <button class="tbl" data-hasil="batal">${amankan(batal)}</button>
          <button class="tbl ${bahaya ? 'bahaya' : 'utama'}" data-hasil="ya">${amankan(tegas)}</button>
        </footer>
      </div>`

    const tutup = (hasil) => {
      tirai.remove()
      document.removeEventListener('keydown', kunci, true)
      // Dikembalikan hanya bila simpul asalnya masih ada di halaman. Sesudah
      // sebuah penghapusan, tombol yang membuka dialog ini sering kali ikut
      // hilang bersama barisnya.
      if (asal?.isConnected) asal.focus({ preventScroll: true })
      selesai(hasil)
    }

    const kunci = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); tutup(false); return }
      if (e.key !== 'Tab') return

      const dapatDicapai = [...tirai.querySelectorAll('button')]
      if (!dapatDicapai.length) return
      const awal = dapatDicapai[0]
      const akhir = dapatDicapai[dapatDicapai.length - 1]

      if (e.shiftKey && document.activeElement === awal) { e.preventDefault(); akhir.focus() }
      else if (!e.shiftKey && document.activeElement === akhir) { e.preventDefault(); awal.focus() }
      else if (!tirai.contains(document.activeElement)) { e.preventDefault(); awal.focus() }
    }

    tirai.addEventListener('click', (e) => {
      if (e.target === tirai) return tutup(false)
      const t = e.target.closest('[data-hasil]')
      if (t) tutup(t.dataset.hasil === 'ya')
    })

    // Disimak pada tahap tangkap supaya jeratnya tetap bekerja sekalipun
    // fokusnya sedang berada di luar tirai.
    document.addEventListener('keydown', kunci, true)
    document.body.appendChild(tirai)
    tirai.querySelector(bahaya ? '[data-hasil="batal"]' : '[data-hasil="ya"]').focus()
  })
}
