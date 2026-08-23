/**
 * Peringatan Dini.
 *
 * Halaman ini sengaja tidak berbentuk tabel. Yang dibaca pimpinan di sini bukan
 * kolom-kolom, melainkan satu per satu kejadian: apa yang terjadi, di mana, dan
 * apakah sudah dipastikan benar. Karena itu tiap berita ditampilkan sebagai
 * kartu dengan pita kerawanan di tepi kiri.
 *
 * Pembedaan penting: peringatan yang belum ditelaah analis diberi label AWAL,
 * yang sudah diverifikasi diberi label RESMI. Keduanya tidak boleh terlihat
 * sama, karena hanya yang kedua yang boleh menjadi dasar keputusan.
 */

import { kartu, keping, kosong, pilihan, tombol, pesanSistem } from '../ui/komponen.js'
import { amankan, angka, jarakWaktu, tanggalJam, ringkas, nadaUrgensi } from '../lib/format.js'
import { belumTerpetakan } from '../lib/pencocokan-upt.js'
import { ikon } from '../lib/ikon.js'

const saring = { tingkat: 'Semua tingkat', keadaan: 'Semua keadaan' }

export function halamanPeringatan({ keadaan, isi }) {
  const semua = (keadaan.dalamLingkup || keadaan.berita).filter(
    (b) => ['Tinggi', 'Kritis'].includes(b.urgensi)
      && !['Tidak Valid', 'Diarsipkan'].includes(b.status_verifikasi),
  )

  const daftar = semua.filter((b) => {
    if (!saring.tingkat.startsWith('Semua') && b.urgensi !== saring.tingkat) return false
    if (saring.keadaan === 'Peringatan awal' && b.status_verifikasi === 'Terverifikasi') return false
    if (saring.keadaan === 'Sudah diverifikasi' && b.status_verifikasi !== 'Terverifikasi') return false
    return true
  }).sort((a, b) => {
    const bobot = { Kritis: 2, Tinggi: 1 }
    return (bobot[b.urgensi] || 0) - (bobot[a.urgensi] || 0)
      || String(b.created_at).localeCompare(String(a.created_at))
  })

  const kritis = semua.filter((b) => b.urgensi === 'Kritis').length
  const awal = semua.filter((b) => b.status_verifikasi !== 'Terverifikasi').length

  isi.innerHTML = `
    <div class="tumpuk">
      ${kritis
        ? pesanSistem(
            `<b>${kritis} kejadian berstatus kritis.</b> Menurut panduan Dirpamintel,
             tingkat ini berarti ancaman terhadap nyawa atau stabilitas yang menuntut respons segera,
             bukan pemantauan berkala.`, 'kritis', 'peringatan')
        : pesanSistem(
            `Tidak ada kejadian berstatus kritis. ${awal} peringatan masih berstatus awal dan menunggu telaah analis.`,
            'positif', 'centang')}

      ${kartu({
        rapat: true,
        isi: `
          <div class="bilah-alat">
            ${pilihan({ nama: 'tingkat', nilai: saring.tingkat, label: 'Saring tingkat kerawanan',
              opsi: ['Semua tingkat', 'Kritis', 'Tinggi'] })}
            ${pilihan({ nama: 'keadaan', nilai: saring.keadaan, label: 'Saring keadaan verifikasi',
              opsi: ['Semua keadaan', 'Peringatan awal', 'Sudah diverifikasi'] })}
            <div class="dorong baris gap-6">
              <span class="mini-teks samar-teks">${angka(daftar.length)} dari ${angka(semua.length)}</span>
              ${tombol({ label: 'Kirim ke Telegram', ikon: 'kirim', kecil: true, gaya: 'utama', aksi: 'kirim-telegram', nonaktif: !daftar.length })}
            </div>
          </div>

          <div style="padding:14px">
            ${daftar.length
              ? `<div class="kisi kisi-kartu">
                   ${daftar.slice(0, 24).map(kartuPeringatan).join('')}
                 </div>`
              : kosong('Tidak ada peringatan pada saringan ini',
                  'Ubah saringan tingkat atau keadaan verifikasi untuk melihat kejadian lain.')}
          </div>`,
      })}
    </div>`

  for (const s of isi.querySelectorAll('[data-saring]')) {
    s.addEventListener('change', (ev) => {
      saring[ev.target.dataset.saring] = ev.target.value
      isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))
    })
  }

  return { judul: 'Peringatan Dini', sub: `${angka(semua.length)} kejadian dipantau · ${angka(awal)} masih berstatus awal` }
}

function kartuPeringatan(b) {
  const resmi = b.status_verifikasi === 'Terverifikasi'
  const nada = nadaUrgensi(b.urgensi)

  return `
    <article class="kartu" style="border-left:3px solid var(--${nada})">
      <div class="kartu-isi" style="display:flex;flex-direction:column;gap:9px">
        <div class="baris gap-6">
          ${keping(b.urgensi, nada)}
          ${resmi
            ? `<span class="keping polos" data-nada="positif">Resmi</span>`
            : `<span class="keping polos" data-nada="sedang">Awal</span>`}
          <span class="mini-teks samar-teks dorong" title="${amankan(tanggalJam(b.created_at))}">
            ${amankan(jarakWaktu(b.created_at))}</span>
        </div>

        <h3 style="font-size:13.5px;line-height:1.4;font-family:var(--sans);font-weight:600">
          ${amankan(b.judul || 'Tanpa judul')}
        </h3>

        <p class="kecil-teks samar-teks" style="line-height:1.5">
          ${amankan(ringkas(b.ringkasan || b.rekomendasi || 'Belum ada ringkasan.', 180))}
        </p>

        <dl style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px">
          <dt class="samar-teks">UPT</dt>
          <dd style="margin:0">${belumTerpetakan(b.nama_upt)
            ? '<span style="color:var(--sedang)">Belum terpetakan</span>'
            : amankan(b.nama_upt)}</dd>
          <dt class="samar-teks">Isu</dt>
          <dd style="margin:0">${amankan(b.subkategori || b.kategori || 'Belum dikelompokkan')}</dd>
          <dt class="samar-teks">Sumber</dt>
          <dd style="margin:0">${amankan(b.media || '—')}</dd>
        </dl>

        <div class="baris gap-6" style="margin-top:2px">
          ${b.link ? `<a class="tbl kecil" href="${amankan(b.link)}" target="_blank" rel="noopener noreferrer">
            ${ikon('tautan')} Sumber asli</a>` : ''}
          ${!resmi ? `<button class="tbl kecil utama" data-aksi="telaah" data-id="${amankan(b.id)}">
            ${ikon('centang')} Telaah</button>` : ''}
        </div>
      </div>
    </article>`
}
