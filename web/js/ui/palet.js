/**
 * Palet perintah — satu kotak untuk menuju ke mana pun.
 *
 * Aplikasi ini punya dua puluh dua halaman dan ratusan publikasi, dan satu-satunya
 * cara mencapainya selama ini adalah membaca menu samping dari atas ke bawah lalu
 * menyaring tabel setelah sampai. Untuk petugas piket yang menerima satu nama unit
 * lewat telepon, itu tiga langkah terlalu banyak.
 *
 * Yang dicari di sini bukan hanya halaman. Nama unit, judul berita, dan nama
 * kategori dicari dalam satu kotak yang sama — sebab orang yang mengetik
 * "cilegon" tidak sedang memilih antara "halaman" dan "berita", ia sedang mencari
 * Cilegon.
 *
 * Tiga hal yang dijaga:
 *
 *   Papan tik cukup untuk seluruh alurnya. Ctrl+K membuka, panah memilih, Enter
 *   membuka, Esc menutup. Tidak ada satu langkah pun yang menuntut tetikus.
 *
 *   Ada tombolnya di bilah atas. Pintasan papan tik yang tidak punya tombol
 *   adalah pintasan yang hanya diketahui pembuatnya.
 *
 *   Fokus dikembalikan ke tempat asalnya saat ditutup, supaya orang yang memakai
 *   papan tik tidak terlempar ke awal halaman setiap kali membatalkan pencarian.
 */

import { amankan, ringkas, nadaUrgensi } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { menuUntuk } from '../lib/peran.js'

const BATAS_PER_GOLONGAN = 5

let terbuka = null

/** Pencocokan longgar: setiap kata harus muncul, urutannya tidak penting. */
function cocok(teks, kueri) {
  const t = String(teks || '').toLowerCase()
  return kueri.every((k) => t.includes(k))
}

/**
 * Menyusun daftar sasaran dari keadaan aplikasi.
 *
 * Disusun ulang setiap kali palet dibuka, bukan sekali di awal, karena berita
 * dan hitungan lencana berubah setiap kali data disegarkan.
 */
function kumpulkanSasaran(keadaan) {
  const sasaran = []

  for (const grup of menuUntuk(keadaan.profil?.role)) {
    for (const b of grup.butir) {
      sasaran.push({
        golongan: 'Halaman',
        ikon: b.ikon,
        judul: b.label,
        ket: grup.grup,
        cari: `${b.label} ${grup.grup}`,
        halaman: b.id,
      })
    }
  }

  const unit = new Map()
  for (const b of keadaan.dalamLingkup || []) {
    if (!b.nama_upt || ['Belum Teridentifikasi', 'Tidak diketahui'].includes(b.nama_upt)) continue
    const u = unit.get(b.nama_upt) || { nama: b.nama_upt, total: 0, mendesak: 0 }
    u.total += 1
    if (['Tinggi', 'Kritis'].includes(b.urgensi)) u.mendesak += 1
    unit.set(b.nama_upt, u)
  }
  for (const u of unit.values()) {
    sasaran.push({
      golongan: 'UPT',
      ikon: 'peta',
      judul: u.nama,
      ket: `${u.total} publikasi${u.mendesak ? ` · ${u.mendesak} mendesak` : ''}`,
      cari: u.nama,
      halaman: 'berita',
      /*
         Saringan ini dulu dikirim sebagai acara `saring-berita` yang tidak
         pernah didengarkan siapa pun. Akibatnya memilih sebuah unit di palet
         membuka Pusat Data Berita tanpa saringan apa pun — tombolnya bekerja,
         dan hasilnya salah, dan tidak ada satu kalimat pun di layar yang
         mengatakannya. Sekarang ia memakai jalur `saringMasuk` yang sama
         dengan ubin dasbor.
      */
      saring: { cari: u.nama },
    })
  }

  for (const b of (keadaan.dalamLingkup || []).slice(0, 400)) {
    sasaran.push({
      golongan: 'Berita',
      ikon: 'berita',
      judul: b.judul,
      ket: [b.subkategori, b.nama_upt, b.media].filter(Boolean).join(' · '),
      nada: nadaUrgensi(b.urgensi),
      lencana: ['Tinggi', 'Kritis'].includes(b.urgensi) ? b.urgensi : '',
      cari: `${b.judul} ${b.subkategori || ''} ${b.nama_upt || ''} ${b.media || ''}`,
      /*
         Menuju catatan institusinya, bukan ke situs medianya.

         Sampai 3 September 2026 butir ini membuka `b.link` di tab baru, sebab
         memang belum ada halaman lain yang bisa dituju. Sekarang ada — dan
         perbedaannya besar: petugas piket yang mengetik "Cilegon" sedang
         mencari apa yang diketahui sistem ini tentang Cilegon, bukan sedang
         mencari situs Banten Pos. Tautan aslinya tetap satu tekan jauhnya,
         di kepala halaman detailnya.
      */
      halaman: 'berita-detail',
      fokus: b.id,
    })
  }

  return sasaran
}

/** Sasaran yang ditawarkan sebelum satu huruf pun diketik. */
function saranAwal(sasaran, keadaan) {
  const mendesak = sasaran.filter((s) => s.lencana).slice(0, 3)
  const halaman = sasaran.filter((s) => s.golongan === 'Halaman').slice(0, 5)
  return [...mendesak, ...halaman]
}

function saring(sasaran, teks) {
  const kueri = teks.toLowerCase().split(/\s+/).filter(Boolean)
  if (!kueri.length) return null

  const hasil = []
  for (const golongan of ['Halaman', 'UPT', 'Berita']) {
    const sebagian = sasaran.filter((s) => s.golongan === golongan && cocok(s.cari, kueri))
    hasil.push(...sebagian.slice(0, BATAS_PER_GOLONGAN))
  }
  return hasil
}

/* ------------------------------------------------------------------ buka */

export function bukaPalet(keadaan, keHalaman) {
  if (terbuka) return
  const asal = document.activeElement

  const sasaran = kumpulkanSasaran(keadaan)
  let daftar = saranAwal(sasaran, keadaan)
  let pilih = 0

  const tirai = document.createElement('div')
  tirai.className = 'palet-tirai'
  tirai.innerHTML = `
    <div class="palet" role="dialog" aria-modal="true" aria-label="Cari halaman, unit, atau berita">
      <label class="palet-kotak">
        ${ikon('cari')}
        <input type="text" id="palet-masukan" autocomplete="off" spellcheck="false"
               placeholder="Cari halaman, unit, atau judul berita…"
               aria-label="Kata kunci pencarian"
               aria-controls="palet-hasil" aria-expanded="true" role="combobox">
        <kbd>Esc</kbd>
      </label>
      <div class="palet-hasil" id="palet-hasil" role="listbox" aria-label="Hasil pencarian"></div>
      <div class="palet-kaki">
        <span><kbd>↑</kbd><kbd>↓</kbd> pilih</span>
        <span><kbd>Enter</kbd> buka</span>
        <span><kbd>Esc</kbd> tutup</span>
      </div>
    </div>`

  const masukan = tirai.querySelector('#palet-masukan')
  const wadahHasil = tirai.querySelector('#palet-hasil')

  function gambarHasil() {
    if (!daftar.length) {
      wadahHasil.innerHTML = `<div class="palet-kosong">
        Tidak ada yang cocok. Coba nama UPT, nama media, atau sebagian judul berita.
      </div>`
      masukan.removeAttribute('aria-activedescendant')
      return
    }

    let golonganTerakhir = ''
    wadahHasil.innerHTML = daftar.map((s, i) => {
      const kepala = s.golongan !== golonganTerakhir
        ? `<div class="palet-golongan">${amankan(s.golongan)}</div>` : ''
      golonganTerakhir = s.golongan
      return `${kepala}
        <div class="palet-butir${i === pilih ? ' terpilih' : ''}" role="option" id="palet-butir-${i}"
             aria-selected="${i === pilih}" data-nomor="${i}">
          <span class="palet-ikon">${ikon(s.ikon)}</span>
          <span class="palet-teks">
            <span class="palet-judul">${amankan(ringkas(s.judul, 92))}</span>
            ${s.ket ? `<span class="palet-ket">${amankan(ringkas(s.ket, 96))}</span>` : ''}
          </span>
          ${s.lencana ? `<span class="keping" data-nada="${s.nada}">${amankan(s.lencana)}</span>` : ''}
        </div>`
    }).join('')

    masukan.setAttribute('aria-activedescendant', `palet-butir-${pilih}`)
    wadahHasil.querySelector('.terpilih')?.scrollIntoView({ block: 'nearest' })
  }

  function pindah(langkah) {
    if (!daftar.length) return
    pilih = (pilih + langkah + daftar.length) % daftar.length
    gambarHasil()
  }

  function jalankan() {
    const s = daftar[pilih]
    if (!s) return
    tutup()
    keHalaman(s.halaman, { fokus: s.fokus || null, saring: s.saring || null })
  }

  function tutup() {
    if (!terbuka) return
    terbuka = null
    document.removeEventListener('keydown', kunci, true)
    tirai.remove()
    asal?.focus?.({ preventScroll: true })
  }

  function kunci(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); tutup() }
    else if (ev.key === 'ArrowDown') { ev.preventDefault(); pindah(1) }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); pindah(-1) }
    else if (ev.key === 'Enter') { ev.preventDefault(); jalankan() }
    else if (ev.key === 'Tab') {
      // Fokus tidak boleh keluar dari palet selagi ia terbuka; satu-satunya
      // yang bisa menerima fokus di dalamnya memang hanya kotak isiannya.
      ev.preventDefault()
      masukan.focus()
    }
  }

  masukan.addEventListener('input', () => {
    const hasil = saring(sasaran, masukan.value.trim())
    daftar = hasil === null ? saranAwal(sasaran, keadaan) : hasil
    pilih = 0
    gambarHasil()
  })

  tirai.addEventListener('click', (ev) => {
    if (ev.target === tirai) { tutup(); return }
    const butir = ev.target.closest('[data-nomor]')
    if (butir) { pilih = Number(butir.dataset.nomor); jalankan() }
  })

  tirai.addEventListener('mousemove', (ev) => {
    const butir = ev.target.closest('[data-nomor]')
    const n = butir ? Number(butir.dataset.nomor) : -1
    if (n >= 0 && n !== pilih) { pilih = n; gambarHasil() }
  })

  document.addEventListener('keydown', kunci, true)
  document.body.appendChild(tirai)
  terbuka = { tutup }
  gambarHasil()
  masukan.focus()
}

export function paletTerbuka() { return Boolean(terbuka) }
export function tutupPalet() { terbuka?.tutup() }
