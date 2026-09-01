/**
 * Pusat Data Berita — tabel utama dengan penyaringan.
 *
 * Penyaringan dilakukan di sisi peramban terhadap kumpulan yang sudah ditarik,
 * sehingga mengetik di kotak cari terasa seketika. Untuk arsip yang lebih besar
 * dari beberapa ratus baris, penyaringan berpindah ke sisi basis data — itulah
 * gunanya indeks GIN pada kolom search_vector yang dipasang migrasi keempat.
 */

import { kartu, keping, kosong, bidangCari, pilihan, tombol, tombolIkon, roti } from '../ui/komponen.js'
import { KONFIG } from '../lib/konfig.js'
import { daftarNamaKategori } from '../lib/taksonomi.js'
import {
  amankan, angka, jarakWaktu, tanggalJam, asalTautan,
  nadaUrgensi, nadaSentimen, nadaStatus, ringkas,
} from '../lib/format.js'
import { belumTerpetakan } from '../lib/pencocokan-upt.js'
import { ikon } from '../lib/ikon.js'

const saring = {
  cari: '',
  kategori: 'Semua kategori',
  urgensi: 'Semua urgensi',
  status: 'Semua status',
  sentimen: 'Semua sentimen',
}

let batasTampil = 40

export function halamanBerita({ keadaan, isi }) {
  const semua = keadaan.berita
  const hasil = terapkan(semua)

  isi.innerHTML = kartu({
    rapat: true,
    isi: `
      <div class="bilah-alat">
        ${bidangCari(saring.cari)}
        ${pilihan({ nama: 'kategori', nilai: saring.kategori, label: 'Saring kategori',
          opsi: ['Semua kategori', ...daftarNamaKategori()] })}
        ${pilihan({ nama: 'urgensi', nilai: saring.urgensi, label: 'Saring urgensi',
          opsi: ['Semua urgensi', 'Kritis', 'Tinggi', 'Sedang', 'Rendah'] })}
        ${pilihan({ nama: 'sentimen', nilai: saring.sentimen, label: 'Saring sentimen',
          opsi: ['Semua sentimen', 'Negatif', 'Campuran', 'Netral', 'Positif'] })}
        ${pilihan({ nama: 'status', nilai: saring.status, label: 'Saring status telaah',
          opsi: ['Semua status', 'Belum Ditelaah', 'Perlu Koreksi', 'Terverifikasi', 'Tidak Valid', 'Diarsipkan'] })}
        <div class="dorong baris gap-6">
          <span class="mini-teks samar-teks">${angka(hasil.length)} dari ${angka(semua.length)}</span>
          ${adaSaringan() ? tombol({ label: 'Bersihkan', ikon: 'tutup', kecil: true, aksi: 'bersihkan-saring' }) : ''}
          ${tombolIkon({ ikon: 'unduh', aksi: 'unduh-csv', judul: 'Unduh hasil saringan sebagai CSV' })}
        </div>
      </div>

      ${hasil.length ? tabel(hasil.slice(0, batasTampil)) : kosong(
        'Tidak ada berita yang cocok',
        'Longgarkan saringan, atau bersihkan seluruhnya untuk melihat kembali seluruh arsip.',
        tombol({ label: 'Bersihkan saringan', ikon: 'tutup', aksi: 'bersihkan-saring' }),
      )}

      ${hasil.length > batasTampil ? `
        <div style="padding:14px;text-align:center;border-top:1px solid var(--line-3)">
          ${tombol({ label: `Tampilkan ${Math.min(40, hasil.length - batasTampil)} berita lagi`, aksi: 'tampil-lagi' })}
        </div>` : ''}
    `,
  })

  pasangPenyimak(isi, semua, hasil)

  return {
    judul: 'Pusat Data Berita',
    sub: `${angka(hasil.length)} berita ditampilkan${adaSaringan() ? ' setelah disaring' : ''}`,
  }
}

/* ------------------------------------------------------------- penyaringan */

function adaSaringan() {
  return saring.cari
    || !saring.kategori.startsWith('Semua')
    || !saring.urgensi.startsWith('Semua')
    || !saring.status.startsWith('Semua')
    || !saring.sentimen.startsWith('Semua')
}

function terapkan(daftar) {
  const kata = saring.cari.trim().toLowerCase()
  return daftar.filter((b) => {
    if (!saring.kategori.startsWith('Semua') && b.kategori !== saring.kategori) return false
    if (!saring.urgensi.startsWith('Semua') && b.urgensi !== saring.urgensi) return false
    if (!saring.status.startsWith('Semua') && b.status_verifikasi !== saring.status) return false
    if (!saring.sentimen.startsWith('Semua') && b.sentimen !== saring.sentimen) return false
    if (!kata) return true
    return [b.judul, b.nama_upt, b.media, b.subkategori, b.ringkasan]
      .filter(Boolean).join(' ').toLowerCase().includes(kata)
  })
}

/* ------------------------------------------------------------------ tabel */

function tabel(daftar) {
  return `
  <div class="tabel-bungkus">
    <table class="tabel">
      <thead>
        <tr>
          <th style="width:74px">Urgensi</th>
          <th>Berita</th>
          <th style="width:186px">UPT</th>
          <th style="width:150px">Kategori</th>
          <th style="width:88px">Sentimen</th>
          <th style="width:118px">Status telaah</th>
          <th style="width:92px">Masuk</th>
          <th style="width:36px"></th>
        </tr>
      </thead>
      <tbody>
        ${daftar.map((b) => `
          <tr data-id="${amankan(b.id)}">
            <td>${keping(b.urgensi || 'Rendah', nadaUrgensi(b.urgensi))}</td>
            <td>
              <span class="judul-sel">${amankan(b.judul || 'Tanpa judul')}</span>
              <span class="mini-teks samar-teks">${amankan(b.media || asalTautan(b.link))}
                ${b.platform ? ` · ${amankan(b.platform)}` : ''}
                ${b.ai_confidence ? ` · yakin ${(Number(b.ai_confidence) * 100).toFixed(0)}%` : ''}</span>
            </td>
            <td class="kecil">${belumTerpetakan(b.nama_upt)
              ? `<span class="keping polos" data-nada="sedang">Belum terpetakan</span>`
              : amankan(b.nama_upt)}</td>
            <td class="kecil">
              ${amankan(b.subkategori || b.kategori || '—')}
              ${b.subkategori_kode ? `<span class="mini-teks samar-teks mono"> ${amankan(b.subkategori_kode)}</span>` : ''}
            </td>
            <td>${keping(b.sentimen || '—', nadaSentimen(b.sentimen), true)}</td>
            <td>${keping(b.status_verifikasi || '—', nadaStatus(b.status_verifikasi), true)}</td>
            <td class="angka kecil" title="${amankan(tanggalJam(b.created_at))}">${amankan(jarakWaktu(b.created_at))}</td>
            <td>${b.link ? `<a class="tbl ikon samar kecil" href="${amankan(b.link)}" target="_blank"
                 rel="noopener noreferrer" title="Buka sumber asli" aria-label="Buka sumber asli">${ikon('tautan')}</a>` : ''}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

/* -------------------------------------------------------------- penyimak */

function pasangPenyimak(isi, semua, hasil) {
  const gambarUlang = () => {
    const acara = new CustomEvent('gambar-ulang', { bubbles: true })
    isi.dispatchEvent(acara)
  }

  const kotak = isi.querySelector('[data-peran="cari"]')
  if (kotak) {
    let jeda
    kotak.addEventListener('input', (ev) => {
      clearTimeout(jeda)
      const nilai = ev.target.value
      // Diberi jeda supaya mengetik cepat tidak memicu gambar ulang tiap huruf.
      jeda = setTimeout(() => {
        saring.cari = nilai
        batasTampil = 40
        gambarUlang()
      }, 160)
    })
  }

  for (const s of isi.querySelectorAll('[data-saring]')) {
    s.addEventListener('change', (ev) => {
      saring[ev.target.dataset.saring] = ev.target.value
      batasTampil = 40
      gambarUlang()
    })
  }

  isi.addEventListener('click', (ev) => {
    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (aksi === 'bersihkan-saring') {
      Object.assign(saring, {
        cari: '', kategori: 'Semua kategori', urgensi: 'Semua urgensi',
        status: 'Semua status', sentimen: 'Semua sentimen',
      })
      batasTampil = 40
      gambarUlang()
    } else if (aksi === 'tampil-lagi') {
      batasTampil += 40
      gambarUlang()
    } else if (aksi === 'unduh-csv') {
      unduhCsv(hasil)
    }
  })

  void semua
}

function unduhCsv(daftar) {
  // Pratinjau peragaan berjalan di dalam bingkai yang tidak mengizinkan berkas
  // diunduh. Lebih baik mengatakannya terus terang daripada membiarkan tombol
  // ditekan tanpa terjadi apa-apa.
  if (KONFIG.mode === 'demo') {
    roti('Pengunduhan hanya berfungsi pada aplikasi yang sudah digelar, bukan di pratinjau peragaan.', 'sedang', 5200)
    return
  }

  const kepala = ['Judul', 'UPT', 'Media', 'Platform', 'Kategori', 'Subkategori',
    'Sentimen', 'Urgensi', 'Status', 'Waktu masuk', 'Tautan']
  const sel = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const baris = daftar.map((b) => [
    b.judul, b.nama_upt, b.media, b.platform, b.kategori, b.subkategori,
    b.sentimen, b.urgensi, b.status_verifikasi, tanggalJam(b.created_at), b.link,
  ].map(sel).join(','))

  const isi = '﻿' + [kepala.map(sel).join(','), ...baris].join('\r\n')
  const berkas = new Blob([isi], { type: 'text/csv;charset=utf-8' })
  const tautan = document.createElement('a')
  tautan.href = URL.createObjectURL(berkas)
  tautan.download = `trans-siber-pas-berita-${new Date().toISOString().slice(0, 10)}.csv`
  tautan.click()
  setTimeout(() => URL.revokeObjectURL(tautan.href), 1000)
}

