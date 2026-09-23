/**
 * Analisis Pemberitaan — Tren, Narasi, Kaitan, dan Pusat Komando dalam satu fitur.
 *
 * ---------------------------------------------------------------------------
 * Kenapa digabung, dan kenapa keempat halamannya tidak ditulis ulang
 * ---------------------------------------------------------------------------
 *
 * Sampai 23 September 2026 keempatnya berdiri sebagai empat butir menu, dengan
 * alasan tertulis di lib/peran.js bahwa halaman bertab membuat dua di antaranya
 * tidak pernah dibuka. User memutuskan sebaliknya: empat butir yang membaca
 * arsip yang sama dari sudut berbeda membuat menu Ruang Pimpinan terlalu
 * panjang untuk dipindai, dan yang dicari pimpinan adalah satu pintu "analisis".
 *
 * Isinya sengaja TIDAK disalin ke berkas ini. Berkas ini hanya bingkai: bilah
 * tab di atas, lalu salah satu dari empat pembangun halaman lama digambar ke
 * wadah di bawahnya. Pembangun itu menerima `{ keadaan, isi }` seperti biasa
 * dan tidak tahu ia sedang dibingkai — salinan kedua dari empat halaman akan
 * berpisah dari yang pertama pada perubahan berikutnya.
 *
 * ---------------------------------------------------------------------------
 * Tab adalah tautan, bukan sakelar
 * ---------------------------------------------------------------------------
 *
 * Tiap tab membawa `data-halaman` ke nama halaman lamanya — `tren`, `narasi`,
 * `jaringan`, `komando` — dan main.js menggambar berkas ini untuk keempat nama
 * itu. Akibatnya tiga hal yang sudah benar tetap benar tanpa satu baris baru:
 *
 *   Alamat tersimpan dan tombol di halaman lain ("Ke Tren", "Buka narasi")
 *   tetap mendarat di tab yang tepat.
 *
 *   Tab yang tidak berhak dibuka sebuah peran disapu penyaring tombol di
 *   main.js, sama seperti tombol lain. Operator Puldata memegang
 *   `lihat_dasbor` tetapi tidak `lihat_tren`; baginya fitur ini hanya berisi
 *   Pusat Komando, dan itu memang yang dulu ia lihat di menunya.
 *
 *   Penjaga rute menolak `#tren` bagi yang tidak berhak, sebelum berkas ini
 *   sempat diunduh.
 */

import { halamanTren } from './tren.js'
import { halamanNarasi } from './narasi.js'
import { halamanJaringan } from './jaringan.js'
import { halamanKomando } from './komando.js'
import { bolehBuka } from '../lib/peran.js'
import { amankan } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'

export const NAMA_ANALISIS = 'Analisis Pemberitaan'

/** Urutannya urutan baca: apa yang berubah, cerita apa, siapa bertemu apa, lalu layar dinding. */
export const TAB_ANALISIS = [
  { id: 'tren', label: 'Tren', ikon: 'tren', bangun: halamanTren },
  { id: 'narasi', label: 'Narasi', ikon: 'laporan', bangun: halamanNarasi },
  { id: 'jaringan', label: 'Kaitan', ikon: 'kasus', bangun: halamanJaringan },
  { id: 'komando', label: 'Pusat Komando', ikon: 'dasbor', bangun: halamanKomando },
]

/*
   Tab terakhir yang dibuka, supaya butir menu membawa orang kembali ke tempat
   ia berhenti — bukan selalu ke Tren. Bertahan selama sesi, seperti pilihan
   periode di halaman lain.
*/
const ingatan = { tab: null }

/**
 * Tab yang harus digambar untuk sebuah alamat.
 *
 * `#tren` dan kawan-kawannya menunjuk tabnya sendiri. `#analisis` — alamat butir
 * menu — menunjuk tab terakhir, atau tab pertama yang berhak dibuka. Pilihan
 * itu memakai `bolehBuka` yang sama dengan penjaga rute: tab yang tidak akan
 * ditampilkan di bilah tidak boleh menjadi isi layarnya.
 */
function tabUntuk(halaman, peran) {
  const langsung = TAB_ANALISIS.find((t) => t.id === halaman)
  if (langsung) return langsung
  const boleh = TAB_ANALISIS.filter((t) => bolehBuka(peran, t.id))
  return boleh.find((t) => t.id === ingatan.tab) || boleh[0] || null
}

export function halamanAnalisis({ keadaan, isi }) {
  const tab = tabUntuk(keadaan.halaman, keadaan.profil?.role)

  if (!tab) {
    isi.innerHTML = ''
    return { judul: NAMA_ANALISIS, sub: 'Tidak ada analisis yang bisa dibuka peran ini' }
  }

  ingatan.tab = tab.id

  isi.innerHTML = `
    <div class="tumpuk">
      <nav class="analisis-tab segmen" aria-label="Bagian ${amankan(NAMA_ANALISIS)}">
        ${TAB_ANALISIS.map((t) => `
          <button data-halaman="${t.id}"${t.id === tab.id ? ' aria-current="page"' : ''}>
            ${ikon(t.ikon)}<span>${amankan(t.label)}</span>
          </button>`).join('')}
      </nav>
      <div id="analisis-isi"></div>
    </div>`

  const hasil = tab.bangun({ keadaan, isi: isi.querySelector('#analisis-isi') })

  return {
    judul: NAMA_ANALISIS,
    sub: hasil?.sub ? `${tab.label} · ${hasil.sub}` : tab.label,
  }
}
