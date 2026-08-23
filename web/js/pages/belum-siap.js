/**
 * Penampung sementara untuk halaman yang belum dibangun.
 *
 * Sengaja menyebutkan apa yang akan ada di sana dan apa yang masih ditunggu,
 * bukan sekadar "segera hadir". Petugas yang membukanya berhak tahu ia sedang
 * menunggu apa, dan pimpinan yang memeriksa kemajuan pekerjaan berhak melihat
 * yang mana sudah jadi dan yang mana belum.
 */

import { kartu, tombol } from '../ui/komponen.js'
import { amankan } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'

const RENCANA = {
  peta: {
    judul: 'Peta Sebaran',
    isi: 'Peta 492 unit dengan penanda berwarna menurut tingkat kerawanan, dapat disaring per kantor wilayah.',
    tunggu: 'Menunggu verifikasi koordinat: 491 dari 492 unit masih memakai titik pusat kota atau provinsi, sehingga penanda akan meleset dari lokasi gedung yang sebenarnya.',
  },
  tren: {
    judul: 'Tren Pemberitaan',
    isi: 'Perbandingan antarperiode, isu yang menanjak, dan unit yang paling sering muncul dalam sorotan.',
    tunggu: 'Membutuhkan arsip terklasifikasi minimal delapan minggu agar perbandingan antarperiode bermakna.',
  },
  pemetaan: {
    judul: 'Pemetaan UPT',
    isi: 'Antrean berita yang belum terhubung ke unit mana pun, lengkap dengan saran dari mesin pencocokan dan alasannya.',
    tunggu: 'Mesin pencocokan sudah selesai dan teruji — 431 dari 652 publikasi terpetakan otomatis, 15 menunggu putusan analis. Tinggal antarmuka pemutusnya.',
  },
  sinkronisasi: {
    judul: 'Sinkronisasi Sumber',
    isi: 'Riwayat penarikan data dari Spreadsheet, jumlah baris yang masuk dan yang dilewati, serta tombol tarik manual.',
    tunggu: 'Token sinkronisasi sudah ada di Supabase Vault dan pg_cron sudah menariknya setiap lima menit. Tinggal layar riwayatnya.',
  },
  kasus: {
    judul: 'Kasus Intelijen',
    isi: 'Penggabungan beberapa berita menjadi satu kasus, lengkap dengan riwayat perkembangan dan penghitung otomatis.',
    tunggu: 'Skema basis datanya sudah ada dan masih kosong. Antarmukanya menyusul setelah modul telaah selesai.',
  },
  lapangan: {
    judul: 'Verifikasi Lapangan',
    isi: 'Surat tugas verifikasi, formulir laporan lapangan, dan unggahan bukti foto atau dokumen.',
    tunggu: 'Menunggu modul kasus, karena setiap penugasan selalu terikat pada satu kasus.',
  },
  evaluasi: {
    judul: 'Evaluasi dan Rekomendasi',
    isi: 'Penyandingan narasi media dengan fakta lapangan, akar masalah, dan usulan tindakan untuk pimpinan.',
    tunggu: 'Menunggu modul verifikasi lapangan.',
  },
  keputusan: {
    judul: 'Keputusan Pimpinan',
    isi: 'Ruang pimpinan untuk menyetujui, mengembalikan, atau menutup rekomendasi, dengan catatan yang tidak bisa disunting kemudian.',
    tunggu: 'Menunggu modul evaluasi.',
  },
  tindak: {
    judul: 'Tindak Lanjut',
    isi: 'Daftar butir tindakan beserta penanggung jawab, tenggat, dan kemajuannya.',
    tunggu: 'Menunggu modul keputusan.',
  },
  laporan: {
    judul: 'Laporan Berkala',
    isi: 'Penyusun laporan harian dan mingguan, ekspor PDF dan DOCX, serta alur pengesahan berjenjang.',
    tunggu: 'Menunggu contoh kop surat resmi dan logo resolusi tinggi.',
  },
  pengguna: {
    judul: 'Manajemen Pengguna',
    isi: 'Penerbitan akun, penetapan peran, dan pembatasan wilayah penugasan.',
    tunggu: 'Menunggu daftar pengguna sungguhan beserta alamat surel dinas masing-masing.',
  },
  koordinat: {
    judul: 'Koordinat UPT',
    isi: 'Alat verifikasi titik koordinat 492 unit, satu per satu, dengan pratinjau peta.',
    tunggu: 'Siap dibangun kapan saja.',
  },
  audit: {
    judul: 'Jejak Audit',
    isi: 'Riwayat seluruh tindakan pengguna, tidak dapat disunting maupun dihapus.',
    tunggu: 'Siap dibangun kapan saja.',
  },
  kesehatan: {
    judul: 'Kesehatan Sistem',
    isi: 'Keadaan penjadwal, sinkronisasi, dan Edge Function, beserta riwayat gangguan.',
    tunggu: 'Siap dibangun kapan saja.',
  },
  'kanwil-kirim': {
    judul: 'Sampaikan Laporan',
    isi: 'Formulir ringkas bagi petugas kantor wilayah untuk menyampaikan laporan intelijen, tanpa akses ke ruang kerja internal.',
    tunggu: 'Migrasi RLS sudah diterapkan di basis data. Tinggal formulirnya.',
  },
  'kanwil-riwayat': {
    judul: 'Riwayat Kiriman',
    isi: 'Daftar laporan yang pernah dikirim petugas kantor wilayah beserta status tindak lanjutnya.',
    tunggu: 'Menunggu formulir penyampaian laporan.',
  },
}

export function halamanBelumSiap({ keadaan, isi }) {
  const r = RENCANA[keadaan.halaman] || {
    judul: 'Halaman tidak dikenali',
    isi: 'Alamat yang Anda buka tidak terdaftar dalam susunan menu.',
    tunggu: 'Kembali ke dasbor melalui menu di sebelah kiri.',
  }

  isi.innerHTML = kartu({
    isi: `
      <div style="max-width:56ch;display:flex;flex-direction:column;gap:14px;padding:18px 4px">
        <span class="keping" data-nada="sedang">Belum dibangun</span>

        <h2 style="font-size:1.25rem">${amankan(r.judul)}</h2>

        <p style="color:var(--ink-2)">${amankan(r.isi)}</p>

        <div class="pesan" data-nada="netral">
          ${ikon('jam')}
          <div><b>Yang ditunggu.</b> ${amankan(r.tunggu)}</div>
        </div>

        <div class="baris gap-6">
          ${tombol({ label: 'Kembali ke dasbor', ikon: 'dasbor', gaya: 'utama', aksi: 'ke-dasbor' })}
        </div>
      </div>`,
  })

  isi.querySelector('[data-aksi="ke-dasbor"]')?.addEventListener('click', () => {
    location.hash = '#dasbor'
  })

  return { judul: r.judul, sub: 'Modul ini belum tersedia' }
}
