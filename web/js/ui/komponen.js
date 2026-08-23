/**
 * Potongan antarmuka yang dipakai berulang.
 * Semuanya mengembalikan string HTML, kecuali yang perlu memasang penyimak.
 */

import { amankan, angka, inisial } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'

export function ubin({ label, nilai, kaki, nada = 'netral', delta }) {
  const bagianDelta = delta
    ? `<span class="delta ${delta.arah}">${amankan(delta.teks)}</span>`
    : ''
  return `
    <div class="ubin" data-nada="${nada}">
      <span class="ubin-label">${amankan(label)}</span>
      <span class="ubin-nilai">${typeof nilai === 'number' ? angka(nilai) : amankan(nilai)}</span>
      <span class="ubin-kaki">${bagianDelta}${kaki ? amankan(kaki) : ''}</span>
    </div>`
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

/** Sembul konfirmasi. Mengembalikan Promise<boolean>. */
export function konfirmasi({ judul, pesan, tegas = 'Lanjutkan', batal = 'Batal', bahaya = false }) {
  return new Promise((selesai) => {
    const tirai = document.createElement('div')
    tirai.className = 'tirai'
    tirai.innerHTML = `
      <div class="sembul" role="dialog" aria-modal="true" aria-labelledby="sembul-judul">
        <header class="sembul-kop"><h2 id="sembul-judul">${amankan(judul)}</h2></header>
        <div class="sembul-isi"><p>${amankan(pesan)}</p></div>
        <footer class="sembul-kaki">
          <button class="tbl" data-hasil="batal">${amankan(batal)}</button>
          <button class="tbl ${bahaya ? 'bahaya' : 'utama'}" data-hasil="ya">${amankan(tegas)}</button>
        </footer>
      </div>`

    const tutup = (hasil) => { tirai.remove(); document.removeEventListener('keydown', kunci); selesai(hasil) }
    const kunci = (e) => { if (e.key === 'Escape') tutup(false) }

    tirai.addEventListener('click', (e) => {
      if (e.target === tirai) return tutup(false)
      const t = e.target.closest('[data-hasil]')
      if (t) tutup(t.dataset.hasil === 'ya')
    })
    document.addEventListener('keydown', kunci)
    document.body.appendChild(tirai)
    tirai.querySelector('[data-hasil="ya"]').focus()
  })
}
