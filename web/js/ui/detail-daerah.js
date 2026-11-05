/**
 * Detail berita untuk ruang daerah — sembul, bukan halaman.
 *
 * Halaman `berita-detail` sengaja hanya dibuka peran pusat: ia menampilkan
 * `review_note` dan `verified_by` milik analis pusat, dan melepasnya ke wilayah
 * adalah keputusan yang belum diambil siapa pun (lihat SYARAT_TAMBAHAN di
 * lib/peran.js). Tetapi daftar berita di ruang wilayah tetap harus bisa dibuka —
 * petugas daerah yang melihat sebuah judul berhak membaca isinya dan membuka
 * sumbernya tanpa harus menebak.
 *
 * Maka sembul ini: ia hanya menampilkan ruas yang MEMANG sudah terlihat daerah
 * di tabelnya sendiri — judul, media, sumber, ringkasan, penilaian mesin,
 * putusan telaah wilayah, dan tanggapan unit — ditambah tombol membuka laman
 * aslinya. Tidak satu pun ruas pusat. Dengan begitu daftarnya bisa diklik tanpa
 * menggeser batas hak akses satu baris pun.
 */

import { amankan, ringkas, tanggalJam, jarakWaktu, nadaUrgensi, nadaSentimen, asalTautan } from '../lib/format.js'
import { keping } from './komponen.js'
import { ikon } from '../lib/ikon.js'

/** Satu baris definisi, hanya digambar bila nilainya ada. */
function baris(dt, dd) {
  if (!dd && dd !== 0) return ''
  return `<div><dt>${amankan(dt)}</dt><dd>${dd}</dd></div>`
}

/**
 * Membuka sembul detail untuk satu berita daerah.
 *
 * Jerat Tab dan pengembalian fokus mengikuti pola `konfirmasi()`: tanpa jerat,
 * Tab berpindah ke tombol di halaman di belakang tirai; tanpa pengembalian
 * fokus, penekan papan tik tersesat ke <body> begitu sembulnya tertutup.
 */
export function bukaDetailDaerah(b) {
  if (!b) return
  const asal = document.activeElement
  const tirai = document.createElement('div')
  tirai.className = 'tirai'

  const metaBaris = [
    b.media ? amankan(b.media) : (b.link ? amankan(asalTautan(b.link)) : ''),
    b.tanggal_publikasi ? amankan(tanggalJam(b.tanggal_publikasi)) : (b.created_at ? amankan(jarakWaktu(b.created_at)) : ''),
    (b.nama_upt && !/belum|tidak|^-?$/i.test(String(b.nama_upt))) ? amankan(b.nama_upt) : '',
  ].filter(Boolean).join(' <span class="pemisah">·</span> ')

  const putusan = b.telaah_wilayah_status && b.telaah_wilayah_status !== 'Belum Ditelaah'
    ? b.telaah_wilayah_status : null

  const blokTelaah = (putusan || b.telaah_wilayah_catatan) ? `
    <div class="tanggapan-tersimpan">
      <div class="baris gap-6">
        <span class="label-mono">Telaah wilayah</span>
        ${putusan ? keping(putusan, 'aksen', true) : ''}
        <span class="mini-teks samar-teks">
          ${amankan(b.telaah_wilayah_oleh || '')}${b.telaah_wilayah_pada ? ` · ${amankan(jarakWaktu(b.telaah_wilayah_pada))}` : ''}
        </span>
      </div>
      ${b.telaah_wilayah_catatan ? `<p class="mini-teks">${amankan(b.telaah_wilayah_catatan)}</p>` : ''}
    </div>` : ''

  const blokTanggapan = (b.tanggapan_sikap || b.tanggapan_upt) ? `
    <div class="tanggapan-tersimpan">
      <div class="baris gap-6">
        <span class="label-mono">Tanggapan unit</span>
        ${b.tanggapan_sikap ? keping(b.tanggapan_sikap, 'netral', true) : ''}
        <span class="mini-teks samar-teks">
          ${amankan(b.tanggapan_oleh || '')}${b.tanggapan_pada ? ` · ${amankan(jarakWaktu(b.tanggapan_pada))}` : ''}
        </span>
      </div>
      ${b.tanggapan_upt ? `<p class="mini-teks">${amankan(b.tanggapan_upt)}</p>` : ''}
    </div>` : ''

  tirai.innerHTML = `
    <div class="sembul sembul-lebar" role="dialog" aria-modal="true" aria-labelledby="detail-daerah-judul">
      <header class="sembul-kop">
        <div class="baris gap-6" style="flex-wrap:wrap">
          ${keping(b.sentimen || 'Belum dinilai', nadaSentimen(b.sentimen), true)}
          ${keping(b.urgensi || '—', nadaUrgensi(b.urgensi), true)}
        </div>
        <h2 id="detail-daerah-judul">${amankan(b.judul || '(tanpa judul)')}</h2>
        ${metaBaris ? `<div class="telaah-meta">${metaBaris}</div>` : ''}
      </header>
      <div class="sembul-isi">
        ${b.ringkasan ? `<p>${amankan(ringkas(b.ringkasan, 900))}</p>`
          : `<p class="samar-teks">Ringkasan berita belum tersedia. Buka laman sumbernya untuk membaca selengkapnya.</p>`}
        <dl class="kop-wilayah-angka" style="margin-top:12px">
          ${baris('Kategori', amankan(b.kategori || '—'))}
          ${baris('Subkategori', amankan(b.subkategori || '—'))}
          ${baris('Unit', amankan((b.nama_upt && !/belum|tidak/i.test(String(b.nama_upt))) ? b.nama_upt : 'Belum terpetakan'))}
        </dl>
        ${blokTelaah}
        ${blokTanggapan}
      </div>
      <footer class="sembul-kaki">
        <button class="tbl" data-hasil="tutup">Tutup</button>
        ${b.link ? `<a class="tbl utama" href="${amankan(b.link)}" target="_blank" rel="noopener noreferrer">
          ${ikon('tautan')}Buka sumber berita</a>` : ''}
      </footer>
    </div>`

  const tutup = () => {
    tirai.remove()
    document.removeEventListener('keydown', kunci, true)
    if (asal?.isConnected) asal.focus({ preventScroll: true })
  }

  const kunci = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); tutup(); return }
    if (e.key !== 'Tab') return
    const fokusable = [...tirai.querySelectorAll('button, a[href]')]
    if (!fokusable.length) return
    const awal = fokusable[0]
    const akhir = fokusable[fokusable.length - 1]
    if (e.shiftKey && document.activeElement === awal) { e.preventDefault(); akhir.focus() }
    else if (!e.shiftKey && document.activeElement === akhir) { e.preventDefault(); awal.focus() }
    else if (!tirai.contains(document.activeElement)) { e.preventDefault(); awal.focus() }
  }

  tirai.addEventListener('click', (e) => {
    if (e.target === tirai || e.target.closest('[data-hasil="tutup"]')) tutup()
  })

  document.addEventListener('keydown', kunci, true)
  document.body.appendChild(tirai)
  tirai.querySelector('[data-hasil="tutup"]').focus()
}
