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
 * Penjadwal di dalam basis data sudah menariknya setiap lima menit;
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
  penjaring: [],
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
  /*
     Sumber yang sudah tidak dipakai lagi ditandai SEKALI, bukan dua kali.

     Sampai 8 September 2026 kartu ini menuliskan dua lencana yang berbunyi
     sama persis — satu dari `terakhir_status` yang memang berisi "Nonaktif",
     satu lagi dari `s.aktif`. Yang terbaca di layar: "NONAKTIF NONAKTIF".

     Yang lebih menyesatkan daripada pengulangannya: keduanya memakai kosakata
     kegagalan untuk sesuatu yang sama sekali bukan kegagalan. Baris penjaring
     memang sengaja dimatikan pada 6 September 2026 karena tugasnya diambil
     alih Edge Function — perayapannya justru berjalan setiap lima menit. Kartu
     yang berbunyi "nonaktif" membuat operator menyimpulkan penjaringnya mati,
     lalu mencari sebab yang tidak ada.
  */
  const nonaktif = !s.aktif
  const status = s.terakhir_status || 'Belum pernah'
  const gagal = status === 'Gagal' && !nonaktif
  const nada = nonaktif ? 'rendah' : nadaStatusSinkron(status)

  return `
    <article class="kartu" style="border-left:3px solid var(--${nada})${nonaktif ? ';opacity:.72' : ''}">
      <div class="kartu-isi" style="display:flex;flex-direction:column;gap:9px">
        <div class="baris gap-6">
          ${keping(s.lingkup === 'pusat' ? 'Pusat' : 'Kantor wilayah',
            s.lingkup === 'pusat' ? 'aksen' : 'netral', true)}
          ${nonaktif
            ? keping('Tidak dipakai lagi', 'rendah', true)
            : keping(status, nadaStatusSinkron(status))}
          <span class="mini-teks samar-teks dorong"
            title="${amankan(s.terakhir_sinkron_at ? tanggalJam(s.terakhir_sinkron_at) : '')}">
            ${nonaktif ? 'dihentikan' : ''}
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
              Sistem mencoba lagi setiap lima menit — tidak ada yang perlu ditekan di sini
              setelah aksesnya dibuka.
            </div>
          </div>` : ''}

        ${s.csv_url ? `<a class="tbl kecil" href="${amankan(s.csv_url)}"
          target="_blank" rel="noopener noreferrer">${ikon('tautan')} Buka spreadsheet</a>` : ''}
      </div>
    </article>`
}

/**
 * Keadaan penjaring berita.
 *
 * KENAPA KARTU TERSENDIRI, DAN KENAPA BUKAN SEBAGAI SUMBER SPREADSHEET
 *
 * Sampai 6 September 2026 penjaring memang sebuah spreadsheet: sebuah skrip
 * Google menuliskan temuannya ke sana, dan penyalin membacanya seperti sumber
 * lain. Sejak tugasnya diambil alih Edge Function, barisnya di daftar sumber
 * tinggal peninggalan — dan peninggalan itu menampilkan dirinya sebagai sumber
 * yang mati, tepat di halaman tempat orang datang untuk memastikan asupan
 * datanya hidup.
 *
 * Yang membingungkan bukan hanya kata "nonaktif"-nya. Sesudah pindah, TIDAK
 * ADA satu layar pun yang memperlihatkan bahwa penjaringnya berjalan —
 * satu-satunya cara mengetahuinya adalah membuka tabel `penjaring_log` lewat
 * basis data. Sebuah pengumpul berita yang berjalan setiap lima menit dan
 * tidak bisa dilihat siapa pun adalah pengumpul yang kegagalannya baru
 * ketahuan berhari-hari kemudian, ketika ada yang menyadari arsipnya sepi.
 *
 * Empat angka yang ditampilkan sengaja bukan angka keberhasilan. Penjaring
 * yang sehat memang MENOLAK hampir semua yang dilihatnya — itu memang
 * tugasnya. Yang menandakan kerusakan adalah "terlihat" yang jatuh ke nol,
 * bukan "diterima" yang kecil.
 */
function kartuPenjaring(log) {
  if (!log || !log.length) return ''

  const terakhir = log[0]
  const segar = terakhir.mulai_at
    && (Date.now() - new Date(terakhir.mulai_at).getTime()) < 45 * 60 * 1000

  const jumlah = (bidang) => log.reduce((n, r) => n + (r[bidang] || 0), 0)
  const terlihat = jumlah('butir_terlihat')
  const diterima = jumlah('diterima')
  const gagal = log.filter((r) => r.status === 'Gagal').length

  const nada = gagal ? 'kritis' : segar ? 'positif' : 'sedang'
  const keadaan = gagal
    ? `${angka(gagal)} dari ${angka(log.length)} jalan terakhir gagal.`
    : segar
      ? 'Berjalan normal.'
      : 'Belum ada jalan baru dalam 45 menit terakhir.'

  const mode = [...new Set(log.map((r) => r.mode).filter(Boolean))].join(', ')

  return kartu({
    judul: 'Penjaring berita',
    ket: 'Pencarian berita langsung dari sistem, tanpa spreadsheet',
    isi: `
      <div class="baris gap-6" style="margin-bottom:10px;flex-wrap:wrap">
        ${keping(keadaan, nada)}
        <span class="mini-teks samar-teks dorong"
          title="${amankan(terakhir.mulai_at ? tanggalJam(terakhir.mulai_at) : '')}">
          jalan terakhir ${amankan(terakhir.mulai_at ? jarakWaktu(terakhir.mulai_at) : '—')}
        </span>
      </div>

      <dl class="kisi kisi-4" style="margin:0;gap:10px">
        <div><dt class="mini-teks samar-teks">Berita dilihat</dt>
          <dd class="angka" style="margin:0;font-size:19px;font-weight:700">${angka(terlihat)}</dd></div>
        <div><dt class="mini-teks samar-teks">Masuk arsip</dt>
          <dd class="angka" style="margin:0;font-size:19px;font-weight:700">${angka(diterima)}</dd></div>
        <div><dt class="mini-teks samar-teks">Jalan tercatat</dt>
          <dd class="angka" style="margin:0;font-size:19px;font-weight:700">${angka(log.length)}</dd></div>
        <div><dt class="mini-teks samar-teks">Cara mencari</dt>
          <dd style="margin:0;font-size:12px;line-height:1.5">${amankan(mode || '—')}</dd></div>
      </dl>

      <p class="kecil-teks samar-teks" style="margin:10px 0 0;line-height:1.55">
        Angka di atas dari ${angka(log.length)} jalan terakhir. Penjaring memang menolak
        hampir semua yang dilihatnya — sebagian besar hasil pencarian bukan berita
        pemasyarakatan, atau sudah lebih dulu ada di arsip. Yang perlu dicurigai
        adalah <b>berita dilihat</b> yang jatuh ke nol, bukan <b>masuk arsip</b> yang kecil.
      </p>`,
  })
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
    /* Hanya sumber yang masih dipakai yang boleh ikut dihitung. Sumber yang
       sudah dihentikan tidak pernah ditarik lagi, jadi memasukkannya ke dalam
       "seluruh 3 sumber tertarik tanpa kegagalan" membuat kalimat itu
       menjanjikan sesuatu yang tidak pernah terjadi. */
    const dipakai = sumber.filter((s) => s.aktif)
    const gagal = dipakai.filter((s) => s.terakhir_status === 'Gagal')
    const belumPernah = dipakai.filter((s) => !s.terakhir_status)

    isi.innerHTML = `
      <div class="tumpuk">
        ${keadaanSinkron.galat
          ? pesanSistem(`<b>Sebagian data tidak dapat dibaca.</b> ${amankan(keadaanSinkron.galat)}`, 'sedang', 'info')
          : ''}

        ${!dipakai.length ? '' : gagal.length
          ? pesanSistem(
              `<b>${angka(gagal.length)} dari ${angka(dipakai.length)} sumber gagal ditarik.</b>
               Sumber lain tetap berjalan seperti biasa — kegagalan satu spreadsheet
               tidak menghentikan yang lain.`, 'kritis', 'peringatan')
          : pesanSistem(
              `Seluruh ${angka(dipakai.length)} sumber yang aktif tertarik tanpa kegagalan.
               Penjadwal menariknya setiap lima menit.`, 'positif', 'centang')}

        ${kartuPenjaring(keadaanSinkron.penjaring)}

        ${kartu({
          judul: 'Sumber spreadsheet',
          ket: `${angka(dipakai.length)} sumber aktif${sumber.length - dipakai.length
            ? ` · ${angka(sumber.length - dipakai.length)} sudah dihentikan` : ''}${belumPernah.length
            ? ` · ${angka(belumPernah.length)} belum pernah ditarik` : ''}`,
          rapat: true,
          isi: `<div style="padding:14px">
            ${sumber.length
              ? `<div class="kisi kisi-kartu">${sumber.map(kartuSumber).join('')}</div>`
              : kosong('Belum ada sumber terdaftar',
                  'Sistem memakai alamat bawaan sampai ada baris pada daftar sumber.')}
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
          + 'Administrator menambahkan satu baris pada daftar sumber, dan sistem '
          + 'membacanya pada penarikan berikutnya.', 'netral', 'info')}
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

    /* Jalan penjaring yang terakhir. Dua puluh empat cukup untuk menutup dua
       jam pada jadwal lima menit — cukup panjang untuk memperlihatkan pola,
       cukup pendek untuk tidak menjadikan angkanya rata-rata sepanjang hari
       yang menyembunyikan berhentinya sejak setengah jam lalu. */
    try {
      keadaanSinkron.penjaring = await ambil('penjaring_log', {
        select: 'id,mulai_at,mode,status,butir_terlihat,diterima,pesan,galat',
        order: 'mulai_at.desc',
        limit: 24,
      }) || []
    } catch {
      keadaanSinkron.penjaring = []
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
