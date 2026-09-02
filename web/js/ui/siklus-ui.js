/**
 * Potongan tampilan yang dipakai bersama kelima halaman siklus intelijen.
 *
 * Yang masuk ke sini hanya yang benar-benar muncul di lebih dari satu halaman:
 * rel tahap, kepala kasus, baris antrean, dan bidang borang. Sisanya tetap di
 * halamannya masing-masing — memindahkan setiap potongan ke tempat bersama
 * hanya menukar satu jenis kesulitan dengan jenis yang lain, dan yang kedua
 * lebih sulit dilacak.
 */

import { amankan, angka, jarakWaktu } from '../lib/format.js'
import { keping } from './komponen.js'
import { ikon } from '../lib/ikon.js'
import {
  TAHAP, kemajuanKasus, statusKasus, nadaPrioritas, nadaKeaktualan, kalimatTenggat,
} from '../lib/siklus.js'

/* --------------------------------------------------------------- rel tahap */

/**
 * Rel enam tahap dengan penanda posisi kasus.
 *
 * Bentuknya rel, bukan bilah persentase. Bilah persentase menjawab "berapa
 * persen selesai", dan itu pertanyaan yang tidak punya jawaban jujur di sini.
 * Rel menjawab pertanyaan yang memang punya jawaban: sudah sampai mana, dan
 * apa langkah sesudahnya.
 */
export function relTahap(kasus, isi = {}, { ringkas = false } = {}) {
  const maju = kemajuanKasus(kasus, isi)
  const kini = TAHAP.findIndex((t) => t.kode === maju.tahap.kode)

  return `
    <ol class="rel-tahap${ringkas ? ' ringkas' : ''}" aria-label="Tahap kasus: ${amankan(maju.tahap.label)}, langkah ${maju.langkah} dari ${maju.dari}">
      ${TAHAP.map((t, i) => `
        <li class="${i < kini ? 'lewat' : i === kini ? 'kini' : 'nanti'}"
            title="${amankan(t.label)} — ${amankan(t.ket)}">
          <i></i>
          ${ringkas ? '' : `<span>${amankan(t.label)}</span>`}
        </li>`).join('')}
    </ol>`
}

/* -------------------------------------------------------------- kepala kasus */

/** Nomor, judul, dan keping keadaan. Dipakai di puncak tiap panel rincian. */
export function kepalaKasus(kasus, { aksi = '' } = {}) {
  const s = statusKasus(kasus.status)
  return `
    <div class="kasus-kepala">
      <div class="kasus-kepala-teks">
        <span class="label-mono">${amankan(kasus.case_number || 'Tanpa nomor')}</span>
        <h3>${amankan(kasus.title || 'Tanpa judul')}</h3>
        <div class="baris gap-6" style="margin-top:6px">
          ${keping(s.nama, s.nada)}
          ${keping(kasus.priority || 'Sedang', nadaPrioritas(kasus.priority), true)}
          ${kasus.actuality_status ? keping(kasus.actuality_status, nadaKeaktualan(kasus.actuality_status), true) : ''}
        </div>
        <p class="mini-teks samar-teks" style="margin-top:6px">
          ${amankan(kasus.primary_upt || 'Unit belum teridentifikasi')}
          ${kasus.issue_type ? ` · ${amankan(kasus.issue_type)}` : ''}
          · terdeteksi ${amankan(jarakWaktu(kasus.first_detected_at || kasus.created_at))}
        </p>
      </div>
      ${aksi ? `<div class="baris gap-6">${aksi}</div>` : ''}
    </div>`
}

/* ------------------------------------------------------------- baris antrean */

/**
 * Satu baris pada daftar kiri. Sengaja seragam di kelima halaman: petugas yang
 * pindah dari Verifikasi Lapangan ke Evaluasi tidak perlu belajar membaca
 * daftar yang lain.
 */
export function barisAntrean({
  id, nomor, judul, ket, nada, label, angka: nilai, satuan = '', terpilih = false, tanda = '',
}) {
  return `
    <li>
      <button class="antrean-baris${terpilih ? ' terpilih' : ''}" data-pilih="${amankan(id)}">
        <span class="antrean-tanda" data-nada="${amankan(nada || 'rendah')}"></span>
        <span class="antrean-isi">
          <span class="antrean-kop">
            <span class="label-mono">${amankan(nomor || '')}</span>
            ${label ? keping(label, nada || 'rendah', true) : ''}
            ${tanda}
          </span>
          <span class="antrean-judul">${amankan(judul || 'Tanpa judul')}</span>
          <span class="mini-teks samar-teks">${amankan(ket || '')}</span>
        </span>
        ${nilai != null ? `<span class="antrean-angka angka">${angka(nilai)}<small>${amankan(satuan)}</small></span>` : ''}
      </button>
    </li>`
}

/* ----------------------------------------------------------------- borang */

export function bidang({ label, ket = '', isi, lebar = '' }) {
  return `
    <label class="bidang" ${lebar ? `style="grid-column:span ${lebar}"` : ''}>
      <span class="label-mono">${amankan(label)}</span>
      ${isi}
      ${ket ? `<span class="mini-teks samar-teks">${amankan(ket)}</span>` : ''}
    </label>`
}

export function bidangTeks({ nama, nilai = '', label, ket = '', baris = 3, wajib = false, petunjuk = '' }) {
  return bidang({
    label,
    ket,
    isi: `<textarea class="masukan area" data-bidang="${amankan(nama)}" rows="${baris}"
            ${wajib ? 'required' : ''} placeholder="${amankan(petunjuk)}">${amankan(nilai)}</textarea>`,
  })
}

export function bidangSatuBaris({ nama, nilai = '', label, ket = '', jenis = 'text', petunjuk = '' }) {
  return bidang({
    label,
    ket,
    isi: `<input class="masukan" type="${amankan(jenis)}" data-bidang="${amankan(nama)}"
           value="${amankan(nilai)}" placeholder="${amankan(petunjuk)}">`,
  })
}

export function bidangPilih({ nama, nilai, opsi, label, ket = '' }) {
  return bidang({
    label,
    ket,
    isi: `<select class="pilihan" data-bidang="${amankan(nama)}">
        ${opsi.map((o) => {
          const v = typeof o === 'string' ? o : o.nilai
          const t = typeof o === 'string' ? o : o.teks
          return `<option value="${amankan(v)}"${v === nilai ? ' selected' : ''}>${amankan(t)}</option>`
        }).join('')}
      </select>`,
  })
}

/**
 * Daftar baris teks yang bisa ditambah dan dikurangi.
 *
 * Dipakai untuk pertanyaan verifikasi, akar masalah, pejabat yang ditemui, dan
 * dokumen yang diperiksa — empat tempat yang semuanya menyimpan jsonb berisi
 * larik teks. Satu bentuk untuk keempatnya, supaya tidak ada satu pun yang
 * diam-diam menyimpan bentuk yang berbeda.
 */
export function daftarBaris({ nama, nilai = [], label, ket = '', petunjuk = '' }) {
  const isi = nilai.length ? nilai : ['']
  return `
    <div class="bidang" data-daftar="${amankan(nama)}">
      <span class="label-mono">${amankan(label)}</span>
      <div class="daftar-baris">
        ${isi.map((b, i) => `
          <div class="daftar-butir">
            <input class="masukan" type="text" value="${amankan(b)}"
                   data-indeks="${i}" placeholder="${amankan(petunjuk)}">
            <button type="button" class="tbl ikon samar kecil" data-buang="${i}"
                    title="Hapus baris" aria-label="Hapus baris">${ikon('tutup')}</button>
          </div>`).join('')}
      </div>
      <button type="button" class="tbl kecil samar" data-tambah-baris>${ikon('tambah')}Tambah baris</button>
      ${ket ? `<span class="mini-teks samar-teks">${amankan(ket)}</span>` : ''}
    </div>`
}

/** Membaca kembali isi sebuah daftarBaris dari DOM. */
export function bacaDaftarBaris(akar, nama) {
  const wadah = akar.querySelector(`[data-daftar="${CSS.escape(nama)}"]`)
  if (!wadah) return []
  return [...wadah.querySelectorAll('input')]
    .map((i) => i.value.trim())
    .filter(Boolean)
}

/** Memasang penambah dan penghapus baris pada seluruh daftarBaris di dalam akar. */
export function pasangDaftarBaris(akar) {
  for (const wadah of akar.querySelectorAll('[data-daftar]')) {
    wadah.addEventListener('click', (ev) => {
      const tambah = ev.target.closest('[data-tambah-baris]')
      if (tambah) {
        const daftar = wadah.querySelector('.daftar-baris')
        const butir = document.createElement('div')
        butir.className = 'daftar-butir'
        butir.innerHTML = `
          <input class="masukan" type="text" value="">
          <button type="button" class="tbl ikon samar kecil" data-buang
                  title="Hapus baris" aria-label="Hapus baris">${ikon('tutup')}</button>`
        daftar.appendChild(butir)
        butir.querySelector('input').focus()
        return
      }
      const buang = ev.target.closest('[data-buang]')
      if (buang) {
        const daftar = wadah.querySelector('.daftar-baris')
        // Baris terakhir dikosongkan, bukan dihapus. Daftar yang bisa habis
        // sama sekali menyisakan tombol "tambah" tanpa satu pun bidang, dan
        // yang melihatnya menyangka bidangnya hilang.
        if (daftar.children.length > 1) buang.closest('.daftar-butir').remove()
        else daftar.querySelector('input').value = ''
      }
    })
  }
}

/** Membaca seluruh [data-bidang] di dalam sebuah akar menjadi satu objek. */
export function bacaBorang(akar) {
  const isi = {}
  for (const b of akar.querySelectorAll('[data-bidang]')) {
    isi[b.dataset.bidang] = b.type === 'checkbox' ? b.checked : b.value
  }
  return isi
}

/* ------------------------------------------------------------------ tenggat */

/** Keping tenggat yang sudah memuat penilaiannya. */
export function kepingTenggat(tenggat, selesai = false) {
  const t = kalimatTenggat(tenggat, selesai)
  return keping(t.teks, t.nada, true)
}

/* -------------------------------------------------------------- bilah maju */

/** Bilah kemajuan sederhana untuk butir tindak lanjut. */
export function bilahMaju(persen, nada = 'aksen') {
  const nilai = Math.max(0, Math.min(100, Number(persen) || 0))
  return `
    <span class="maju-lacak" role="img" aria-label="Kemajuan ${nilai} persen">
      <i data-nada="${amankan(nada)}" style="--lebar:${nilai}%"></i>
    </span>`
}

/* ---------------------------------------------------------------- kekosongan */

/** Panel kanan ketika belum ada yang dipilih. */
export function belumDipilih(judul, pesan) {
  return `
    <div class="siklus-kosong">
      ${ikon('panahKanan')}
      <h3>${amankan(judul)}</h3>
      <p>${amankan(pesan)}</p>
    </div>`
}
