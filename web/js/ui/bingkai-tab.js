/**
 * Bingkai tab — beberapa halaman lama di bawah satu butir menu.
 *
 * Dipakai sejak 23 September 2026, ketika menu dipangkas dengan menggabungkan
 * halaman yang sering dibuka berurutan: Analisis Pemberitaan, Kasus Intelijen
 * (bersama Antrean Telaah), Pemantauan Sistem, dan Pengguna & Data Induk.
 *
 * ---------------------------------------------------------------------------
 * Bingkai, bukan salinan
 * ---------------------------------------------------------------------------
 *
 * Bingkai ini hanya menggambar bilah tab, lalu menyerahkan wadah di bawahnya
 * kepada pembangun halaman lama. Pembangun itu menerima `{ keadaan, isi }`
 * seperti biasa dan tidak tahu ia sedang dibingkai. Salinan kedua dari sebuah
 * halaman akan berpisah dari yang pertama pada perubahan berikutnya.
 *
 * ---------------------------------------------------------------------------
 * Tab adalah tautan, bukan sakelar
 * ---------------------------------------------------------------------------
 *
 * Tiap tab membawa `data-halaman` ke nama halaman lamanya, dan main.js
 * menggambar bingkai yang sama untuk setiap nama itu. Tiga hal yang sudah
 * benar tetap benar tanpa satu baris baru:
 *
 *   Alamat tersimpan dan tombol di halaman lain mendarat di tab yang tepat.
 *
 *   Tab yang tidak berhak dibuka sebuah peran disapu penyaring tombol di
 *   main.js, sama seperti tombol lain — bingkai ini tidak menyaring sendiri.
 *
 *   Penjaga rute menolak alamat tab bagi yang tidak berhak, sebelum modulnya
 *   sempat diunduh.
 *
 * ---------------------------------------------------------------------------
 * Satu tab bukan pilihan
 * ---------------------------------------------------------------------------
 *
 * Bila peran yang masuk hanya berhak atas satu tab, bilahnya tidak digambar
 * dan judulnya judul halaman itu sendiri. Bilah berisi satu tombol tidak
 * menawarkan apa pun, dan pada ruang wilayah ia akan menempelkan nama fitur
 * pusat — "Pengguna & Data Induk" — di atas halaman Pengguna Wilayah milik
 * admin kanwil.
 */

import { bolehBuka } from '../lib/peran.js'
import { amankan } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'

/**
 * @param {{nama:string, tab:{id:string, label:string, ikon:string, bangun:Function}[]}} opsi
 * @returns {Function} pembangun halaman `({ keadaan, isi }) => { judul, sub }`
 */
export function bingkaiTab({ nama, tab: daftarTab }) {
  // Tab terakhir yang dibuka, supaya butir menu membawa orang kembali ke
  // tempat ia berhenti. Satu ingatan per bingkai, bertahan selama sesi.
  const ingatan = { tab: null }

  /*
     Alamat sebuah tab menunjuk tabnya sendiri. Alamat butir menu menunjuk tab
     terakhir, atau tab pertama yang berhak dibuka — memakai `bolehBuka` yang
     sama dengan penjaga rute, supaya tab yang tidak akan tampil di bilah
     tidak pernah menjadi isi layarnya.
  */
  function tabUntuk(halaman, boleh) {
    return boleh.find((t) => t.id === halaman)
      || boleh.find((t) => t.id === ingatan.tab)
      || boleh[0]
      || null
  }

  return function halamanBingkai({ keadaan, isi }) {
    const peran = keadaan.profil?.role
    const boleh = daftarTab.filter((t) => bolehBuka(peran, t.id))
    const tab = tabUntuk(keadaan.halaman, boleh)

    if (!tab) {
      isi.innerHTML = ''
      return { judul: nama, sub: 'Tidak ada bagian yang bisa dibuka peran ini' }
    }

    ingatan.tab = tab.id

    if (boleh.length === 1) return tab.bangun({ keadaan, isi })

    isi.innerHTML = `
      <div class="tumpuk">
        <nav class="bingkai-tab segmen" aria-label="Bagian ${amankan(nama)}">
          ${daftarTab.map((t) => `
            <button data-halaman="${t.id}"${t.id === tab.id ? ' aria-current="page"' : ''}>
              ${ikon(t.ikon)}<span>${amankan(t.label)}</span>
            </button>`).join('')}
        </nav>
        <div class="bingkai-isi"></div>
      </div>`

    const hasil = tab.bangun({ keadaan, isi: isi.querySelector('.bingkai-isi') })

    return {
      judul: nama,
      sub: hasil?.sub ? `${tab.label} · ${hasil.sub}` : tab.label,
    }
  }
}
