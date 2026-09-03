/**
 * Penilaian mesin, ditampilkan apa adanya beserta dasarnya.
 *
 * Berkas ini lahir dari pemindahan, bukan penulisan baru: panel ini dulu
 * tinggal di dalam pages/telaah.js seorang diri. Ketika halaman detail berita
 * dibuat pada 3 September 2026, ia membutuhkan panel yang persis sama — dan
 * dua salinan panel yang menampilkan dasar keputusan mesin adalah dua salinan
 * yang cepat atau lambat akan menampilkan dasar yang berbeda untuk berita yang
 * sama. Maka ia dipindahkan ke sini, dan kedua halaman mengimpornya.
 *
 * Yang tidak boleh hilang dari panel ini, di halaman mana pun ia muncul:
 * alasan mesin. Analis yang menyetujui tanpa tahu atas dasar apa mesin
 * memutuskan bukan sedang menelaah, ia sedang menandatangani. Maka kata kunci
 * penentu, skor, dan pesaing terdekatnya ditampilkan apa adanya — termasuk
 * ketika mesin salah, sebab dari situlah kesalahan mesin bisa dilaporkan dan
 * diperbaiki.
 */

import { keping, pesanSistem } from './komponen.js'
import { amankan, persen, nadaSentimen, nadaUrgensi } from '../lib/format.js'
import { KONFIG } from '../lib/konfig.js'

/**
 * @param {object} b baris berita
 * @param {object} [opsi]
 * @param {boolean} [opsi.pesaing] tampilkan subkategori pesaing terdekat
 */
export function panelMesin(b, opsi = {}) {
  const yakin = Number(b.ai_confidence) || 0
  const cukup = yakin >= KONFIG.ambangKeyakinan
  const kunci = Array.isArray(b.kata_kunci) ? b.kata_kunci : []
  const pesaing = Array.isArray(b.pesaing) ? b.pesaing : []

  return `
    <div class="mesin-panel">
      <div class="mesin-kop">
        <span class="label-mono">Penilaian mesin</span>
        <span class="mesin-yakin" data-cukup="${cukup}">
          ${(yakin * 100).toFixed(0)}% yakin
        </span>
      </div>

      <div class="mesin-nilai">
        <div>
          <dt>Kategori</dt>
          <dd>${amankan(b.kategori || '—')}</dd>
        </div>
        <div>
          <dt>Subkategori</dt>
          <dd>${amankan(b.subkategori || '—')}</dd>
        </div>
        <div>
          <dt>Sentimen</dt>
          <dd>${keping(b.sentimen || '—', nadaSentimen(b.sentimen))}</dd>
        </div>
        <div>
          <dt>Urgensi</dt>
          <dd>${keping(b.urgensi || '—', nadaUrgensi(b.urgensi))}</dd>
        </div>
      </div>

      ${kunci.length ? `
        <div class="mesin-kunci">
          <span class="label-mono">Kata kunci penentu</span>
          <div>${kunci.map((k) => `<span class="kunci-keping">${amankan(k)}</span>`).join('')}</div>
        </div>` : ''}

      ${b.ai_alasan ? `<p class="mesin-alasan">${amankan(b.ai_alasan)}</p>` : ''}

      ${/*
           Pesaing terdekat hanya ditampilkan bila diminta. Di Antrean Telaah ia
           mengganggu — analis di sana sedang memutuskan satu hal, dan daftar
           kemungkinan lain memperlambatnya. Di halaman detail ia justru yang
           dicari: orang yang membuka halaman itu sedang bertanya "kenapa
           mesin memilih ini", dan jawabannya ada pada apa yang tidak dipilih.
        */''}
      ${opsi.pesaing && pesaing.length ? `
        <div class="mesin-kunci">
          <span class="label-mono">Subkategori yang kalah bersaing</span>
          <div class="mesin-pesaing">
            ${pesaing.slice(0, 3).map((p) => `
              <div>
                <span>${amankan(p.kode)} · ${amankan(p.nama)}</span>
                <b>${Number(p.skor).toFixed(2)}</b>
              </div>`).join('')}
            ${b.skor_tertinggi ? `
              <div class="mesin-pesaing-juara">
                <span>Yang dipilih</span>
                <b>${Number(b.skor_tertinggi).toFixed(2)}</b>
              </div>` : ''}
          </div>
        </div>` : ''}

      ${!cukup ? pesanSistem(
        `<b>Di bawah ambang ${persen(KONFIG.ambangKeyakinan, 1, 0)}.</b>
         Mesin sendiri menandai hasil ini sebagai perlu diperiksa sebelum dipakai.`,
        'sedang', 'info',
      ) : ''}
    </div>`
}
