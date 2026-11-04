/**
 * Pengingat alur — pita di puncak halaman yang menjadi salah satu langkah
 * sebuah alur kerja (lib/panduan.js, ALUR).
 *
 * Diminta user 4 November 2026: setiap alur perlu tutorial yang terlihat di
 * tempat pekerjaannya dikerjakan, bukan hanya di halaman Panduan yang harus
 * dicari dulu. Dipasang satu kali di main.js, sesudah halaman mana pun
 * digambar, bukan di dalam tiap halaman: pengingat yang harus dipasang sendiri
 * oleh setiap halaman akan terlupa di halaman berikutnya — dan halaman tanpa
 * pengingat tidak terlihat rusak dari mana pun.
 *
 * Isinya hanya langkah ruang si pembaca. Langkah di halaman ini ditandai
 * "di sini"; langkah sesudahnya diberi tombol ke halamannya, dan tombol itu
 * disapu penyaring tombol main.js bila perannya tidak berhak membuka.
 *
 * Pita yang sudah dilipat tetap terlipat di peramban itu (localStorage), dan
 * hanya itu yang disimpan. Peramban yang menolak penyimpanan tetap bisa
 * melipat; lipatannya saja yang tidak diingat sesudah dimuat ulang.
 */

import { alurUntuk } from '../lib/panduan.js'
import { amankan } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { keping } from './komponen.js'

const KUNCI = 'transsiberpas.alur'
let memori = null

function baca() {
  if (memori) return memori
  try { memori = JSON.parse(localStorage.getItem(KUNCI) || '{}') || {} } catch { memori = {} }
  return memori
}

function tulis(id, terlipat) {
  const isi = { ...baca(), [id]: terlipat }
  memori = isi
  try { localStorage.setItem(KUNCI, JSON.stringify(isi)) } catch { /* lipatan hanya diingat sampai dimuat ulang */ }
}

function pita(alur, halaman) {
  const di = alur.langkah.map((l) => l.halaman.includes(halaman))
  const terakhirDiSini = di.lastIndexOf(true)
  const berikut = alur.langkah.slice(terakhirDiSini + 1).find((l) => !l.halaman.includes(halaman))
  const nomorDiSini = di.map((ya, i) => (ya ? i + 1 : null)).filter(Boolean)
  const rentang = nomorDiSini.length > 1 ? `${nomorDiSini[0]}–${nomorDiSini.at(-1)}` : String(nomorDiSini[0])
  const terlipat = baca()[alur.id] === true

  return `
    <details class="pengingat-alur" data-alur="${amankan(alur.id)}"${terlipat ? '' : ' open'}>
      <summary>
        ${ikon('info')}
        <span><b>Alur: ${amankan(alur.judul)}</b>
          <span class="mini-teks samar-teks"> · langkah ${rentang} dari ${alur.langkah.length} ada di halaman ini</span></span>
        <span class="pengingat-lipat mini-teks">${terlipat ? 'Tampilkan' : 'Sembunyikan'}</span>
      </summary>
      <ol class="pengingat-langkah">
        ${alur.langkah.map((l, i) => `
          <li${di[i] ? ' data-di-sini' : ''}>
            <span class="pengingat-nomor">${i + 1}</span>
            <span><b>${amankan(l.judul)}</b>${di[i] ? ` ${keping('di sini', 'aksen', true)}` : ''}<br>
              <span class="mini-teks">${amankan(l.isi)}</span></span>
          </li>`).join('')}
      </ol>
      <div class="baris gap-6 pengingat-kaki">
        ${berikut ? `<button class="tbl kecil" data-halaman="${amankan(berikut.halaman[0])}">${ikon('panahKanan')}Berikutnya: ${amankan(berikut.judul)}</button>` : ''}
        <button class="tbl kecil" data-halaman="panduan">${ikon('laporan')}Seluruh alur di Panduan</button>
      </div>
    </details>`
}

/**
 * Menyisipkan pita di puncak isi halaman, bila halaman ini bagian dari alur.
 * @param {HTMLElement} isi wadah halaman
 * @param {string} halaman id halaman yang sedang tergambar
 * @param {'pusat'|'wilayah'|'unit'} ruang
 */
export function pasangPengingatAlur(isi, halaman, ruang) {
  const daftar = alurUntuk(halaman, ruang)
  if (!daftar.length) return
  const wadah = document.createElement('div')
  wadah.className = 'pengingat-wadah'
  wadah.innerHTML = daftar.map((a) => pita(a, halaman)).join('')
  isi.prepend(wadah)
  wadah.querySelectorAll('details.pengingat-alur').forEach((d) => d.addEventListener('toggle', () => {
    tulis(d.dataset.alur, !d.open)
    const label = d.querySelector('.pengingat-lipat')
    if (label) label.textContent = d.open ? 'Sembunyikan' : 'Tampilkan'
  }))
}
