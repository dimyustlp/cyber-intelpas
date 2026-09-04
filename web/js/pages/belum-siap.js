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
import { halamanAwal, labelPeran } from '../lib/peran.js'

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
          ${/* Tujuannya diambil dari peran yang sedang masuk, bukan ditulis
                "#dasbor". Halaman dasbor adalah milik ruang pusat: penelaah
                unit yang menekan tombol ini akan mendarat di layar yang bukan
                haknya — yaitu persis keadaan yang membuatnya berada di sini.
                Yang membuat tombol darurat sendiri membutuhkan tombol darurat
                adalah bug, bukan ketidaknyamanan. */''}
          ${tombol({
            label: 'Kembali ke halaman awal',
            ikon: 'dasbor',
            gaya: 'utama',
            halaman: halamanAwal(keadaan.profil?.role),
          })}
        </div>
      </div>`,
  })

  return { judul: r.judul, sub: 'Modul ini belum tersedia' }
}

/**
 * Layar bagi halaman yang ada, terdaftar, dan bukan hak pembukanya.
 *
 * Dipisahkan dari "halaman tidak dikenali" di atas karena keduanya menjawab
 * pertanyaan yang berbeda. Yang satu berkata "alamat ini tidak ada"; yang ini
 * berkata "alamat ini ada, dan bukan untuk peran Anda". Menyatukan keduanya
 * akan membuat petugas yang salah menyalin tautan dari rekannya menyimpulkan
 * halamannya sudah dihapus, lalu melaporkan kerusakan yang tidak pernah ada.
 *
 * Perlu ditegaskan apa yang BUKAN tugas layar ini: ia bukan pengaman. Yang
 * menahan data tetap policy RLS di basis data, dan penolakannya berlaku
 * sekalipun seseorang membongkar berkas ini. Guna layar ini hanya satu —
 * menjelaskan, dengan kalimat yang bisa dibaca, mengapa sebuah tautan yang
 * sah bagi pengirimnya tidak terbuka bagi penerimanya.
 */
export function halamanTanpaHak({ keadaan, isi }) {
  const peran = keadaan.profil?.role
  const awal = halamanAwal(peran)

  isi.innerHTML = kartu({
    isi: `
      <div style="max-width:56ch;display:flex;flex-direction:column;gap:14px;padding:18px 4px">
        <span class="keping" data-nada="sedang">Di luar hak akses</span>

        <h2 style="font-size:1.25rem">Halaman ini bukan bagian dari peran Anda</h2>

        <p style="color:var(--ink-2)">
          Alamat yang Anda buka terdaftar dan berfungsi, tetapi tidak termasuk
          dalam kewenangan
          <b>${amankan(labelPeran(peran))}</b>.
          Kemungkinan besar tautannya berasal dari rekan yang perannya berbeda.
        </p>

        <div class="pesan" data-nada="netral">
          ${ikon('gembok')}
          <div>
            <b>Tidak ada yang rusak.</b> Menu di sebelah kiri sudah memuat
            seluruh halaman yang menjadi hak Anda.
          </div>
        </div>

        <div class="baris gap-6">
          ${tombol({ label: 'Kembali ke halaman awal', ikon: 'dasbor', gaya: 'utama', halaman: awal })}
        </div>
      </div>`,
  })

  return { judul: 'Di luar hak akses', sub: 'Halaman ini bukan kewenangan peran Anda' }
}
