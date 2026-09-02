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

/*
   Yang tersisa.

   Daftar ini pernah memuat sebelas butir. Sepuluh di antaranya sudah dibangun
   dan dihapus dari sini pada 2 September 2026 — tren, kasus, lapangan,
   evaluasi, keputusan, tindak, koordinat, audit, kesehatan, dan pemetaan.
   Membiarkan namanya tetap di sini akan membuat halaman yang sudah jadi
   terbaca sebagai halaman yang belum ada, oleh siapa pun yang kebetulan
   membuka alamatnya lewat tautan lama.

   Kosongnya daftar ini bukan pertanda berkas ini boleh dihapus: ia tetap
   menjadi tempat mendarat bagi alamat yang tidak dikenali, dan itulah cabang
   terakhir di bawah.
*/
const RENCANA = {}

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
