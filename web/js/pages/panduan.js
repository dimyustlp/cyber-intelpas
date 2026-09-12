/**
 * Panduan Penggunaan.
 *
 * ## Kenapa halaman ini ada
 *
 * Sistem ini punya tiga ruang, tiga puluh satu layar, dan sembilan peran yang
 * masing-masing hanya melihat sebagian. Sampai halaman ini ada, satu-satunya
 * cara mengetahui sebuah layar untuk apa adalah membukanya lalu menebak dari
 * isinya — dan menebak dari isi berjalan buruk justru pada layar yang paling
 * perlu dijelaskan. "Ringkasan Wilayah" yang kebetulan sedang sepi terbaca
 * seperti layar yang rusak; "Telaah Wilayah" terbaca seperti Antrean Telaah
 * pusat padahal putusannya sengaja tidak menyentuh kolom yang sama.
 *
 * ## Tiga keputusan yang menentukan isi berkas ini
 *
 *   **Ruang lain ikut ditampilkan, tidak disembunyikan.** Petugas kantor
 *   wilayah berhak tahu apa yang dilihat pusat atas kiriman mereka, dan analis
 *   pusat perlu tahu persis apa yang bisa dan tidak bisa dikerjakan daerah
 *   sebelum menjawab pertanyaan lewat telepon. Yang ditampilkan keterangan
 *   tentang fiturnya, bukan satu baris data pun — dan hak atas datanya tetap
 *   ditegakkan basis data seperti biasa.
 *
 *   **Isinya tinggal di lib/panduan.js, bukan di sini.** Berkas ini hanya
 *   menggambar. Pemisahan itu yang memungkinkan tools/uji-panduan.mjs
 *   menyatakan sebuah fitur baru belum punya penjelasan — pemeriksaan yang
 *   mustahil dilakukan atas HTML yang ditulis menyatu dengan keterangannya.
 *
 *   **Nama tiap fitur dipinjam dari menu, tidak diketik ulang.** Label di
 *   lib/peran.js adalah yang dibaca petugas di layar; panduan yang menyebut
 *   nama lain adalah panduan yang menyuruh orang mencari butir menu yang
 *   tidak ada.
 */

import { kartu, tombol, pesanSistem, bidangCari } from '../ui/komponen.js'
import { amankan } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import {
  MENU, MENU_KANWIL, MENU_UPT, adalahEksternal, adalahUnit, bolehBuka, labelPeran, PERAN, peranBaku,
} from '../lib/peran.js'
import {
  RUANG, TANPA_MENU, MANUAL_KIRIM, JENDELA_LAPORAN, ruangPeran,
} from '../lib/panduan.js'

/** Susunan menu tiap ruang, dipakai mengambil label dan ikon tiap fitur. */
const MENU_RUANG = { pusat: MENU, wilayah: MENU_KANWIL, unit: MENU_UPT }

/** Saringan bertahan selama sesi, seperti pada halaman lain yang punya kotak cari. */
const keadaanPanduan = { cari: '' }

/**
 * Fitur sebuah ruang sebagai daftar rata, berurut seperti di menu.
 *
 * Butir menu yang belum punya penjelasan tetap ikut — dengan keterangannya
 * kosong — bukannya dibuang diam-diam. Pembaca yang menemukan butir tanpa
 * keterangan tahu ada yang tertinggal; pembaca yang menemukan butirnya hilang
 * menyimpulkan fiturnya memang tidak ada.
 */
function fiturRuang(nama) {
  const katalog = RUANG[nama].butir
  const hasil = []
  for (const grup of MENU_RUANG[nama]) {
    for (const b of grup.butir) {
      // Panduan tidak menjelaskan dirinya sendiri di dalam daftar fitur; ia
      // punya paragrafnya sendiri di bagian halaman tanpa menu.
      if (b.id === 'panduan') continue
      hasil.push({ ...b, grup: grup.grup, ...(katalog[b.id] || {}) })
    }
  }
  return hasil
}

/** Benar bila teks pencarian cocok dengan salah satu bagian sebuah fitur. */
function cocok(f, cari) {
  if (!cari) return true
  const gabung = `${f.label} ${f.grup} ${f.isi || ''} ${f.guna || ''} ${f.catatan || ''}`
  return gabung.toLowerCase().includes(cari)
}

/* ------------------------------------------------------------------ bagian */

/**
 * Satu fitur sebagai baris.
 *
 * Tombol "Buka" hanya digambar bila peran pembacanya memang berhak membukanya.
 * Tombol yang menjanjikan halaman yang akan ditolak adalah bentuk kebohongan
 * yang paling mudah dibuat di halaman ini — separuh isinya memang menjelaskan
 * layar yang tidak boleh dibuka pembacanya.
 */
function barisFitur(f, peran, ruangSendiri) {
  const boleh = ruangSendiri && bolehBuka(peran, f.id)
  return `
    <article class="panduan-fitur" data-fitur="${amankan(f.id)}">
      <div class="panduan-fitur-kop">
        <span class="panduan-ikon">${ikon(f.ikon || 'info')}</span>
        <div style="min-width:0;flex:1">
          <h3>${amankan(f.label)}</h3>
          <div class="ket">${amankan(f.grup)}</div>
        </div>
        ${boleh
          ? tombol({ label: 'Buka', ikon: 'panahKanan', kecil: true, gaya: 'samar', halaman: f.id })
          : ''}
      </div>

      ${f.isi
        ? `<dl class="panduan-isi">
             <div><dt>Isinya</dt><dd>${amankan(f.isi)}</dd></div>
             <div><dt>Untuk apa</dt><dd>${amankan(f.guna)}</dd></div>
             ${f.catatan
               ? `<div class="panduan-catat"><dt>Yang mudah keliru</dt>
                    <dd>${amankan(f.catatan)}</dd></div>`
               : ''}
           </dl>`
        : `<p class="ket" style="margin:8px 0 0">
             Penjelasan fitur ini belum ditulis. Laporkan ke administrator sistem.
           </p>`}
    </article>`
}

function panelRuang(nama, peran, { sendiri = false, cari = '' } = {}) {
  const r = RUANG[nama]
  const daftar = fiturRuang(nama).filter((f) => cocok(f, cari))

  const isi = daftar.length
    ? `<div class="panduan-daftar">${daftar.map((f) => barisFitur(f, peran, sendiri)).join('')}</div>`
    : `<p class="ket" style="margin:0">Tidak ada fitur di ruang ini yang cocok dengan pencarian.</p>`

  return kartu({
    judul: `${r.label}${sendiri ? ' — ruang Anda' : ''}`,
    ket: `${r.ket} ${daftar.length} fitur${cari ? ' yang cocok' : ''}.`,
    isi,
  })
}

/** Manual mengirim berita, sebagai langkah berurutan. */
function panelManual(peran) {
  const unit = adalahUnit(peran)
  return kartu({
    judul: 'Manual: mengirim berita',
    ket: `${MANUAL_KIRIM.length} langkah, berurutan. Borangnya satu dan sama untuk pusat maupun daerah.`,
    isi: `
      ${unit
        ? pesanSistem(
            'Peran Anda tidak memasukkan berita. Sejak penataan 1 September 2026, pemasukan '
            + 'berita dari daerah menjadi wewenang Administrator Kantor Wilayah seorang diri, '
            + 'supaya setiap kiriman punya satu penanggung jawab yang jelas. Manual di bawah '
            + 'tetap ditampilkan supaya Anda tahu apa yang sudah dikerjakan sebelum sebuah '
            + 'berita sampai ke antrean telaah Anda.', 'netral', 'info')
        : pesanSistem(
            'Berita yang dikirim lewat borang ini tidak langsung menjadi angka. Ia melewati '
            + 'antrean telaah seperti seluruh berita lain, sebab masukan manual tidak lebih '
            + 'tepercaya daripada hasil mesin hanya karena diketik manusia.', 'netral', 'info')}

      <ol class="langkah" style="margin-top:12px">
        ${MANUAL_KIRIM.map((l, i) => `
          <li class="langkah-butir">
            <span class="langkah-nomor">${i + 1}</span>
            <div>
              <b>${amankan(l.judul)}</b>
              <p>${amankan(l.isi)}</p>
            </div>
          </li>`).join('')}
      </ol>`,
  })
}

/** Jendela pelaporan harian — satu aturan, dan contohnya. */
function panelJendela() {
  const j = JENDELA_LAPORAN
  return kartu({
    judul: 'Jendela pelaporan harian',
    ket: 'Berlaku sama untuk laporan Telegram dan untuk ekspor mandiri lewat situs.',
    isi: `
      <div class="panduan-jendela">
        <div><span class="label-mono">Awal periode</span><b>${amankan(j.mulai)}</b></div>
        <div><span class="label-mono">Akhir periode</span><b>${amankan(j.selesai)}</b></div>
        <div><span class="label-mono">Dikirim</span><b>${amankan(j.kirim)} hari berikutnya</b></div>
      </div>

      ${pesanSistem(amankan(j.contoh), 'aksen', 'jam')}

      <ol class="langkah" style="margin-top:12px">
        ${j.butir.map((b, i) => `
          <li class="langkah-butir">
            <span class="langkah-nomor">${i + 1}</span>
            <div>
              <b>${amankan(b.judul)}</b>
              <p>${amankan(b.isi)}</p>
            </div>
          </li>`).join('')}
      </ol>`,
  })
}

/** Nama layar yang tidak punya butir menu, sehingga labelnya tidak bisa dipinjam. */
const LABEL_TANPA_MENU = {
  'berita-detail': 'Detail Berita',
  profil: 'Profil Saya',
  panduan: 'Panduan Penggunaan',
}

/** Halaman yang tidak punya butir menu, tetapi tetap dibuka setiap hari. */
function panelTanpaMenu(peran, cari) {
  const daftar = Object.entries(TANPA_MENU)
    .map(([id, d]) => ({ id, label: LABEL_TANPA_MENU[id] || id, grup: 'Tanpa butir menu', ...d }))
    .filter((f) => cocok(f, cari))

  if (!daftar.length) return ''

  return kartu({
    judul: 'Layar tanpa butir menu',
    ket: 'Dibuka dari halaman lain, dari palet perintah, atau dari kaki menu samping.',
    isi: `<div class="panduan-daftar">${
      daftar.map((f) => barisFitur(f, peran, true)).join('')
    }</div>`,
  })
}

/* ----------------------------------------------------------------- halaman */

export function halamanPanduan({ keadaan, isi }) {
  const peran = keadaan.profil?.role
  const unit = adalahUnit(peran)
  const eksternal = adalahEksternal(peran)
  const ruangSaya = ruangPeran(unit, eksternal)
  const info = PERAN[peranBaku(peran)] || {}

  function gambar() {
    const cari = keadaanPanduan.cari.trim().toLowerCase()
    const lain = Object.keys(RUANG).filter((r) => r !== ruangSaya)

    isi.innerHTML = `
      <div class="tumpuk">
        ${pesanSistem(
          `Anda masuk sebagai <b>${amankan(labelPeran(peran))}</b>. `
          + `${amankan(info.tugas || '')} Ruang Anda adalah `
          + `<b>${amankan(RUANG[ruangSaya].label)}</b>, dan fiturnya dijelaskan lebih dulu `
          + 'di bawah. Ruang lain ikut ditampilkan sebagai keterangan — bukan sebagai '
          + 'pintu; datanya tetap tertutup seperti biasa.', 'aksen', 'info')}

        <div class="panduan-alat">
          ${bidangCari(keadaanPanduan.cari, 'Cari fitur, mis. ringkasan wilayah')}
          <span class="dorong"></span>
          ${tombol({ label: 'Cetak panduan', ikon: 'laporan', aksi: 'cetak', kecil: true })}
        </div>

        ${panelRuang(ruangSaya, peran, { sendiri: true, cari })}

        ${cari ? '' : panelManual(peran)}
        ${cari ? '' : panelJendela()}

        ${panelTanpaMenu(peran, cari)}

        ${lain.map((r) => `
          <details class="panduan-lain"${cari ? ' open' : ''}>
            <summary>
              ${ikon('panahKanan')}
              <span>${amankan(RUANG[r].label)}</span>
              <span class="ket">${amankan(RUANG[r].ket)}</span>
            </summary>
            <div class="panduan-lain-isi">${panelRuang(r, peran, { cari })}</div>
          </details>`).join('')}
      </div>`
  }

  /* ---------------------------------------------------------- penyimak */

  let jeda = null
  isi.addEventListener('input', (ev) => {
    if (!ev.target.matches('[data-peran="cari"]')) return
    keadaanPanduan.cari = ev.target.value

    /*
       Digambar ulang lewat acara `gambar-ulang`, bukan dengan memanggil
       gambar() di sini.

       Keduanya menghasilkan layar yang sama, dan hanya yang pertama
       mengembalikan fokus. gambar() membuang seluruh isi halaman termasuk
       kotak carinya sendiri, dan kotak yang baru tidak mewarisi apa pun dari
       yang lama: fokusnya jatuh ke <body>, huruf berikutnya tidak sampai ke
       mana-mana, dan yang mengetik menyimpulkan pencariannya rusak. Kerangka
       aplikasi mengingat bidang bertanda `data-peran="cari"` beserta letak
       kursornya, lalu mengembalikannya sesudah menggambar.

       Jeda pendek supaya mengetik cepat tidak memicu gambar ulang tiap huruf.
    */
    clearTimeout(jeda)
    jeda = setTimeout(() => {
      isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))
    }, 180)
  })

  isi.addEventListener('click', (ev) => {
    if (!ev.target.closest('[data-aksi="cetak"]')) return

    /*
       Ruang yang terlipat dibuka lebih dulu, di sini dan bukan lewat CSS cetak.

       Peramban menyembunyikan isi <details> yang tertutup lewat mekanismenya
       sendiri, dan aturan @media print yang mencoba menimpanya bekerja di
       sebagian peramban saja. Yang gagal tidak terlihat sebagai galat: panduan
       tercetak lengkap, hanya kehilangan dua dari tiga ruangnya, dan yang
       memegang cetakannya tidak punya cara tahu ada yang hilang.
    */
    const tertutup = [...isi.querySelectorAll('details:not([open])')]
    for (const d of tertutup) d.open = true
    window.print()
    // Dikembalikan supaya halaman di layar tidak berubah bentuk sesudah dicetak.
    for (const d of tertutup) d.open = false
  })

  gambar()

  return {
    judul: 'Panduan Penggunaan',
    sub: 'Apa isi tiap fitur, untuk apa ia ada, dan siapa yang memakainya',
  }
}
