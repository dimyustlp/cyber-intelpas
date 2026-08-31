/**
 * Sinkronisasi Sumber.
 *
 * Sejak kantor wilayah punya spreadsheet sendiri, "sinkronisasi berjalan" tidak
 * lagi berarti satu hal. Satu sumber bisa berhasil sementara sumber lain
 * ditolak Google karena aksesnya belum dibuka — dan tanpa layar ini, keadaan
 * itu hanya terbaca oleh orang yang bisa membuka basis data.
 *
 * Yang sengaja tidak ada di sini: tombol "tarik sekarang". Menariknya menuntut
 * token sinkronisasi, dan token itu tidak boleh pernah berada di peramban.
 * Penjadwal di dalam basis data sudah memanggil penyalin setiap lima menit;
 * yang dibutuhkan layar ini hanyalah menjelaskan hasilnya.
 */

import { kartu, keping, kosong, pesanSistem } from '../ui/komponen.js'
import { amankan, angka, jarakWaktu, tanggalJam } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, pesanRamah } from '../lib/api.js'

const keadaanSinkron = {
  dimuat: false,
  sumber: [],
  riwayat: [],
  galat: null,
}

/** Nada warna untuk status penyalinan. */
function nadaStatusSinkron(status) {
  return {
    Berhasil: 'positif',
    Sebagian: 'sedang',
    Berjalan: 'aksen',
    Gagal: 'kritis',
  }[status] || 'rendah'
}

/** Benar bila pesan galat berbicara tentang akses berkas, bukan tentang isinya. */
function soalAkses(pesan) {
  const t = String(pesan || '').toLowerCase()
  return t.includes('tidak dapat dibaca') || t.includes('401') || t.includes('html')
}

function kartuSumber(s) {
  const status = s.terakhir_status || 'Belum pernah'
  const gagal = status === 'Gagal'

  return `
    <article class="kartu" style="border-left:3px solid var(--${nadaStatusSinkron(status)})">
      <div class="kartu-isi" style="display:flex;flex-direction:column;gap:9px">
        <div class="baris gap-6">
          ${keping(s.lingkup === 'pusat' ? 'Pusat' : 'Kantor wilayah',
            s.lingkup === 'pusat' ? 'aksen' : 'netral', true)}
          ${keping(status, nadaStatusSinkron(status))}
          ${s.aktif ? '' : keping('Nonaktif', 'rendah', true)}
          <span class="mini-teks samar-teks dorong"
            title="${amankan(s.terakhir_sinkron_at ? tanggalJam(s.terakhir_sinkron_at) : '')}">
            ${s.terakhir_sinkron_at ? amankan(jarakWaktu(s.terakhir_sinkron_at)) : 'belum pernah ditarik'}
          </span>
        </div>

        <h3 style="font-size:13.5px;line-height:1.4;font-family:var(--sans);font-weight:600">
          ${amankan(s.nama)}
        </h3>

        <dl style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px">
          <dt class="samar-teks">Kode</dt>
          <dd style="margin:0"><code>${amankan(s.kode)}</code></dd>
          <dt class="samar-teks">Wilayah</dt>
          <dd style="margin:0">${amankan(s.kanwil || (s.lingkup === 'pusat' ? 'Nasional' : 'belum ditetapkan'))}</dd>
          <dt class="samar-teks">Baris terbaca</dt>
          <dd style="margin:0">${s.baris_terakhir == null ? '—' : angka(s.baris_terakhir)}</dd>
        </dl>

        ${s.terakhir_pesan ? `<p class="kecil-teks samar-teks" style="line-height:1.5">
          ${amankan(s.terakhir_pesan.slice(0, 240))}</p>` : ''}

        ${gagal && soalAkses(s.terakhir_pesan) ? `
          <div class="pesan" data-nada="sedang" style="align-items:flex-start">
            ${ikon('gembok')}
            <div class="kecil-teks">
              <b>Spreadsheet ini belum bisa dibaca tanpa akun Google.</b>
              Buka berkasnya, tekan <b>Bagikan</b>, lalu setel aksesnya menjadi
              “Siapa saja yang memiliki link” sebagai <b>Pelihat</b>.
              Penyalin mencoba lagi setiap lima menit — tidak ada yang perlu ditekan di sini
              setelah aksesnya dibuka.
            </div>
          </div>` : ''}

        ${s.csv_url ? `<a class="tbl kecil" href="${amankan(s.csv_url)}"
          target="_blank" rel="noopener noreferrer">${ikon('tautan')} Buka spreadsheet</a>` : ''}
      </div>
    </article>`
}

function tabelRiwayat(daftar) {
  return `
  <div class="tabel-bungkus">
    <table class="tabel">
      <thead>
        <tr>
          <th style="width:96px">Status</th>
          <th>Sumber</th>
          <th style="width:70px" class="rata-kanan">Terbaca</th>
          <th style="width:70px" class="rata-kanan">Masuk</th>
          <th style="width:80px" class="rata-kanan">Dilewati</th>
          <th style="width:70px" class="rata-kanan">Gagal</th>
          <th style="width:96px">Waktu</th>
        </tr>
      </thead>
      <tbody>
        ${daftar.map((r) => {
          const nama = r.metadata?.sumber_nama || r.sheet_name || r.spreadsheet_id || '—'
          return `
          <tr>
            <td>${keping(r.status, nadaStatusSinkron(r.status), true)}</td>
            <td>
              <span class="judul-sel">${amankan(nama)}</span>
              <span class="mini-teks samar-teks">${amankan(r.message || '')}</span>
            </td>
            <td class="angka rata-kanan">${angka(r.rows_seen || 0)}</td>
            <td class="angka rata-kanan">${r.rows_inserted ? angka(r.rows_inserted) : '—'}</td>
            <td class="angka rata-kanan">${r.rows_skipped ? angka(r.rows_skipped) : '—'}</td>
            <td class="angka rata-kanan">${r.rows_failed
              ? `<span style="color:var(--kritis)">${angka(r.rows_failed)}</span>` : '—'}</td>
            <td class="kecil" title="${amankan(tanggalJam(r.started_at))}">${amankan(jarakWaktu(r.started_at))}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
  </div>`
}

export function halamanSinkronisasi({ keadaan, isi }) {
  function gambar() {
    if (!keadaanSinkron.dimuat) {
      isi.innerHTML = kartu({ judul: 'Sumber data', isi: '<p class="samar-teks">Memuat daftar sumber…</p>' })
      return
    }

    const sumber = keadaanSinkron.sumber
    const gagal = sumber.filter((s) => s.terakhir_status === 'Gagal')
    const belumPernah = sumber.filter((s) => !s.terakhir_status)

    isi.innerHTML = `
      <div class="tumpuk">
        ${keadaanSinkron.galat
          ? pesanSistem(`<b>Sebagian data tidak dapat dibaca.</b> ${amankan(keadaanSinkron.galat)}`, 'sedang', 'info')
          : ''}

        ${!sumber.length ? '' : gagal.length
          ? pesanSistem(
              `<b>${angka(gagal.length)} dari ${angka(sumber.length)} sumber gagal ditarik.</b>
               Sumber lain tetap berjalan seperti biasa — kegagalan satu spreadsheet
               tidak menghentikan yang lain.`, 'kritis', 'peringatan')
          : pesanSistem(
              `Seluruh ${angka(sumber.length)} sumber tertarik tanpa kegagalan.
               Penjadwal memanggil penyalin setiap lima menit.`, 'positif', 'centang')}

        ${kartu({
          judul: 'Sumber spreadsheet',
          ket: `${angka(sumber.length)} sumber terdaftar${belumPernah.length
            ? ` · ${angka(belumPernah.length)} belum pernah ditarik` : ''}`,
          rapat: true,
          isi: `<div style="padding:14px">
            ${sumber.length
              ? `<div class="kisi kisi-kartu">${sumber.map(kartuSumber).join('')}</div>`
              : kosong('Belum ada sumber terdaftar',
                  'Penyalin akan memakai alamat bawaan sampai ada baris pada tabel sumber.')}
          </div>`,
        })}

        ${kartu({
          judul: 'Riwayat penarikan',
          ket: 'Dua puluh penarikan terakhir, satu baris untuk tiap sumber pada tiap jalannya',
          rapat: true,
          isi: keadaanSinkron.riwayat.length
            ? tabelRiwayat(keadaanSinkron.riwayat)
            : kosong('Belum ada riwayat',
                'Belum ada penarikan yang tercatat, atau peran Anda tidak berhak membacanya.'),
        })}

        ${pesanSistem(
          '<b>Menambah kantor wilayah tidak menuntut penggelaran ulang.</b> '
          + 'Administrator menambahkan satu baris pada daftar sumber, dan penyalin '
          + 'membacanya pada jalan berikutnya.', 'netral', 'info')}
      </div>`
  }

  async function muat() {
    if (keadaan.demo) {
      keadaanSinkron.dimuat = true
      keadaanSinkron.sumber = []
      keadaanSinkron.galat = 'Mode peragaan tidak terhubung ke peladen.'
      gambar()
      return
    }

    // Dua permintaan terpisah, dan kegagalan salah satunya tidak menghapus yang
    // lain: riwayat penarikan hanya boleh dibaca sebagian peran, sedangkan
    // daftar sumbernya lebih terbuka.
    try {
      keadaanSinkron.sumber = await ambil('sumber_sheet', {
        select: 'id,kode,nama,lingkup,kanwil,csv_url,aktif,urutan,terakhir_sinkron_at,'
          + 'terakhir_status,terakhir_pesan,baris_terakhir',
        order: 'urutan.asc',
      }) || []
    } catch (galat) {
      keadaanSinkron.galat = pesanRamah(galat)
    }

    try {
      keadaanSinkron.riwayat = await ambil('sheet_sync_log', {
        select: 'id,started_at,finished_at,status,sheet_name,spreadsheet_id,message,'
          + 'rows_seen,rows_inserted,rows_updated,rows_skipped,rows_failed,metadata',
        order: 'started_at.desc',
        limit: 20,
      }) || []
    } catch {
      keadaanSinkron.riwayat = []
    }

    keadaanSinkron.dimuat = true
    gambar()
  }

  gambar()
  muat()

  return {
    judul: 'Sinkronisasi Sumber',
    sub: 'Spreadsheet pusat dan kantor wilayah, beserta hasil penarikan terakhirnya',
  }
}
