/**
 * Narasi Berjalan.
 *
 * Halaman Tren menjawab "berapa banyak, dan naik atau turun". Halaman ini
 * menjawab pertanyaan yang tidak bisa dijawab garis: **cerita apa yang sedang
 * berjalan tentang kami, dan apakah ada suara lain di sebelahnya.**
 *
 * Yang ditampilkan bukan berita dan bukan peristiwa, melainkan lapis di
 * atasnya — kumpulan peristiwa yang membentuk satu cerita. Karena itu satu
 * kartu di sini bisa memuat tiga kejadian di tiga unit yang berbeda, dan
 * memang begitulah ia dibaca publik.
 *
 * ## Empat hal yang selalu ada di tiap kartu
 *
 * Bentuk (menanjak, berulang, bertahan, mereda), sebaran (berapa unit, berapa
 * media, berapa platform), pemantik (terbitan paling awal yang tercatat), dan
 * **ada tidaknya suara lain**. Yang terakhir yang paling sering menentukan
 * langkah berikutnya: cerita negatif yang berjalan sepuluh hari tanpa satu
 * pun penyeimbang adalah cerita yang akan diingat dalam bentuk itu.
 *
 * Pemantik disebut apa adanya — "terbitan paling awal yang tercatat" — bukan
 * "sumber narasi". Arsip ini hanya memuat yang berhasil ditangkap sistem;
 * menyebut yang pertama tertangkap sebagai yang pertama menerbitkan adalah
 * tuduhan yang tidak bisa dibuktikan berkas mana pun di sini.
 */

import { kartu, keping, kosong, tombol, ubin, pesanSistem } from '../ui/komponen.js'
import { amankan, angka, persen, tanggal, jarakWaktu, ringkas } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { belumTerpetakan } from '../lib/unit-terpetakan.js'
import { sebagaiKueri } from '../lib/kueri.js'
import {
  susunNarasi, rekapNarasi, bentukDari, BENTUK, ATUR,
} from '../lib/narasi.js'

const saring = { bentuk: 'Semua bentuk', lingkup: 'Semua lingkup' }

export function halamanNarasi({ keadaan, isi }) {
  const sekarang = new Date()
  const semua = susunNarasi(keadaan.berita || [], { sekarang })
  const rekap = rekapNarasi(semua)

  const daftar = semua.filter((n) => {
    if (!saring.bentuk.startsWith('Semua') && bentukDari(n.bentuk).label !== saring.bentuk) return false
    if (saring.lingkup === 'Unit' && n.lingkup !== 'unit') return false
    if (saring.lingkup === 'Nasional' && n.lingkup !== 'nasional') return false
    return true
  })

  isi.innerHTML = `
    <div class="tumpuk">
      <div class="kisi kisi-4">
        ${ubin({ label: 'Narasi berjalan', nilai: rekap.jumlah, nada: 'aksen',
          kaki: `${ATUR.jendelaHari} hari terakhir` })}
        ${ubin({ label: 'Menanjak', nilai: rekap.menanjak, nada: rekap.menanjak ? 'kritis' : 'netral',
          kaki: 'Separuh terakhir lebih ramai' })}
        ${ubin({ label: 'Berulang', nilai: rekap.berulang, nada: rekap.berulang ? 'tinggi' : 'netral',
          kaki: 'Padam lalu menyala lagi' })}
        ${ubin({ label: 'Berjalan sendirian', nilai: rekap.sendirian,
          nada: rekap.sendirian ? 'tinggi' : 'positif',
          kaki: 'Negatif tanpa suara lain' })}
      </div>

      ${rekap.dominan ? pesanSistem(
        `<b>Narasi dominan:</b> ${amankan(rekap.dominan.tema)}${rekap.dominan.nama_upt
          ? ` di ${amankan(rekap.dominan.nama_upt)}` : ' (nasional)'} — `
        + `${persen(rekap.dominan.jumlah_publikasi, Math.round(rekap.dominan.jumlah_publikasi / rekap.dominan.pangsa))} `
        + 'dari seluruh pemberitaan pada jendela ini. Satu cerita sebesar itu menentukan '
        + 'bagaimana keseluruhan lembaga dibaca, bukan hanya unit yang disebutnya.',
        'tinggi', 'peringatan') : ''}

      ${kartu({
        rapat: true,
        isi: `
          <div class="bilah-alat">
            <select class="pilihan" data-saring="bentuk" aria-label="Saring bentuk narasi">
              ${['Semua bentuk', ...BENTUK.map((b) => b.label)].map((o) => `
                <option${o === saring.bentuk ? ' selected' : ''}>${amankan(o)}</option>`).join('')}
            </select>
            <select class="pilihan" data-saring="lingkup" aria-label="Saring lingkup narasi">
              ${['Semua lingkup', 'Unit', 'Nasional'].map((o) => `
                <option${o === saring.lingkup ? ' selected' : ''}>${amankan(o)}</option>`).join('')}
            </select>
            <span class="dorong mini-teks samar-teks">${angka(daftar.length)} dari ${angka(semua.length)}</span>
          </div>

          <div style="padding:14px">
            ${daftar.length
              ? `<div class="narasi-daftar">${daftar.slice(0, 24).map(kartuNarasi).join('')}</div>`
              : kosong('Tidak ada narasi pada saringan ini',
                  'Longgarkan saringan bentuk atau lingkupnya.')}
          </div>`,
      })}

      ${kartu({
        judul: 'Cara bentuk ditentukan',
        ket: 'Bukan dari jumlahnya, melainkan dari deret harinya.',
        isi: `<ul class="narasi-kamus">
          ${BENTUK.map((b) => `
            <li>${keping(b.label, b.nada)}<span>${amankan(b.keterangan)}</span></li>`).join('')}
        </ul>
        <div class="mini-teks samar-teks" style="margin-top:10px">
          Berulang diperiksa lebih dulu daripada menanjak dan mereda. Dua letupan yang
          dipisahkan ${ATUR.jedaSunyi} hari sunyi tampak seperti dua kejadian yang sudah selesai,
          padahal itu satu cerita yang belum padam — dan itulah bentuk yang paling sulit dilihat
          dengan membaca daftar.
        </div>`,
      })}
    </div>`

  for (const s of isi.querySelectorAll('[data-saring]')) {
    s.addEventListener('change', (ev) => {
      saring[ev.target.dataset.saring] = ev.target.value
      isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))
    })
  }

  isi.addEventListener('click', (ev) => {
    const simpul = ev.target.closest('[data-aksi]')
    const aksi = simpul?.dataset.aksi
    if (!aksi) return

    if (aksi === 'buka-kueri') {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'cari', saring: { kueri: simpul.dataset.kueri } },
      }))
    } else if (aksi === 'buka-berita') {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'berita-detail', fokus: simpul.dataset.id },
      }))
    }
  })

  return {
    judul: 'Narasi Berjalan',
    sub: `${angka(rekap.jumlah)} narasi · ${angka(rekap.menanjak)} menanjak · `
      + `${angka(rekap.sendirian)} tanpa suara lain`,
  }
}

/* ------------------------------------------------------------------- kartu */

function kartuNarasi(n) {
  const b = bentukDari(n.bentuk)
  const kueri = n.lingkup === 'unit' && n.nama_upt
    ? `${sebagaiKueri('upt', n.nama_upt)} ${sebagaiKueri('subkategori', n.tema)}`
    : sebagaiKueri('subkategori', n.tema)

  return `
    <article class="narasi-kartu" data-nada="${b.nada}">
      <div class="narasi-kop">
        ${keping(b.label, b.nada)}
        ${keping(n.lingkup === 'unit' ? 'Satu unit' : n.lingkup === 'nasional' ? 'Lintas unit' : 'Tunggal', 'rendah', true)}
        ${n.tandingan.sendirian ? keping('Tanpa suara lain', 'tinggi') : ''}
        ${n.lintas_platform ? keping('Lintas platform', 'sedang', true) : ''}
        <span class="dorong mini-teks samar-teks">${amankan(persen(n.pangsa * 1000, 1000, 1))} pangsa</span>
      </div>

      <h3 class="narasi-judul">${amankan(ringkas(n.judul, 130))}</h3>

      <div class="narasi-tema">
        ${amankan(n.tema)}
        ${n.nama_upt ? ` · ${amankan(n.nama_upt)}` : n.unit.length ? ` · ${angka(n.unit.length)} unit` : ''}
      </div>

      ${percikan(n.deret)}

      <dl class="narasi-angka">
        <div><dt>Peristiwa</dt><dd>${angka(n.jumlah_peristiwa)}</dd></div>
        <div><dt>Terbitan</dt><dd>${angka(n.jumlah_publikasi)}</dd></div>
        <div><dt>Media</dt><dd>${angka(n.jumlah_media)}</dd></div>
        <div><dt>Rentang</dt><dd>${angka(n.rentang_hari)} hari</dd></div>
      </dl>

      <div class="narasi-rinci kecil-teks">
        ${n.pemantik ? `
          <div>
            <span class="samar-teks">Terbitan paling awal yang tercatat:</span>
            ${amankan(n.pemantik.media || 'tidak diketahui')} · ${amankan(tanggal(n.pemantik.tanggal))}
          </div>` : ''}
        <div>
          <span class="samar-teks">Suara lain:</span>
          ${n.tandingan.ada
            ? `${n.tandingan.publikasi ? `${angka(n.tandingan.publikasi)} terbitan penyeimbang` : ''}`
              + `${n.tandingan.publikasi && n.tandingan.tanggapan ? ', ' : ''}`
              + `${n.tandingan.tanggapan ? `${angka(n.tandingan.tanggapan)} sikap resmi` : ''}`
            : '<b class="kritis-teks">belum ada</b>'}
        </div>
        <div>
          <span class="samar-teks">Terakhir bergerak:</span> ${amankan(jarakWaktu(n.akhir))}
        </div>
      </div>

      <div class="baris gap-6">
        <button class="tbl kecil" data-aksi="buka-kueri" data-kueri="${amankan(kueri)}"
                title="Buka seluruh terbitan narasi ini di Pencarian Lanjutan">
          ${ikon('cari')} Lihat terbitannya
        </button>
        ${n.publikasi.length ? `
          <button class="tbl kecil samar" data-aksi="buka-berita" data-id="${amankan(n.publikasi[0].id)}">
            ${ikon('berita')} Buka satu contoh
          </button>` : ''}
      </div>
    </article>`
}

/**
 * Percikan — bagan garis sekecil satu baris teks.
 *
 * Tanpa sumbu dan tanpa angka, dan itu disengaja: yang perlu terbaca dari
 * bentuk ini hanya satu hal, yaitu apakah ceritanya sedang naik, turun, atau
 * berdenyut. Angkanya ada di daftar tepat di bawahnya.
 */
function percikan(deret) {
  if (!deret || deret.length < 2) return ''
  const lebar = 240
  const tinggi = 34
  const maks = Math.max(...deret.map((d) => d.jumlah), 1)
  const langkah = lebar / (deret.length - 1)

  const titik = deret.map((d, i) => {
    const x = i * langkah
    const y = tinggi - 3 - (d.jumlah / maks) * (tinggi - 8)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return `
    <svg class="narasi-percikan" viewBox="0 0 ${lebar} ${tinggi}" role="img"
         aria-label="Deret harian narasi ini, puncak ${maks} terbitan dalam sehari">
      <polyline points="${titik.join(' ')}" fill="none" stroke="currentColor"
                stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${(deret.length - 1) * langkah}" r="2.4"
              cy="${(tinggi - 3 - (deret[deret.length - 1].jumlah / maks) * (tinggi - 8)).toFixed(1)}"
              fill="currentColor"/>
    </svg>`
}
