/**
 * Kanal Negatif dan Kanal Positif.
 *
 * Dua halaman, satu berkas, karena keduanya menjawab pertanyaan yang berbentuk
 * sama dari dua arah berlawanan: apa yang sedang merugikan institusi, dan apa
 * yang sedang menguatkannya.
 *
 * Alasan keduanya dipisahkan dari Pusat Data Berita: dalam daftar gabungan,
 * berita negatif selalu kalah jumlah. Publikasi humas UPT masuk puluhan setiap
 * hari, sedangkan insiden yang benar-benar perlu ditangani mungkin hanya dua.
 * Menaruh keduanya dalam satu tabel membuat yang dua itu tenggelam — dan yang
 * dua itulah alasan direktorat ini ada.
 *
 * Kanal negatif disusun per PERISTIWA, bukan per publikasi. Delapan berita
 * tentang satu narapidana yang kabur adalah satu kejadian dengan eksposur
 * besar, bukan delapan kejadian. Angka publikasinya tetap ditampilkan, karena
 * ia ukuran tekanan opini — tetapi ia tidak lagi menyamar sebagai jumlah
 * insiden.
 */

import { kartu, keping, kosong, tombol, pesanSistem } from '../ui/komponen.js'
import { amankan, angka, jarakWaktu, tanggalPanjang, ringkas, nadaUrgensi } from '../lib/format.js'
import { belumTerpetakan } from '../lib/pencocokan-upt.js'
import { kelompokkanPeristiwa, validasi, sumberAsli, rapikanJudul } from '../lib/peristiwa.js'
import { ember } from '../lib/sentimen.js'
import { dasar } from '../lib/hitung.js'
import { ikon } from '../lib/ikon.js'

/** Keadaan tapis per kanal, disimpan supaya pilihan tidak hilang saat digambar ulang. */
const keadaanTapis = {
  negatif: { urutan: 'eksposur', tingkat: 'semua' },
  positif: { urutan: 'jumlah', tingkat: 'semua' },
}

/* --------------------------------------------------------------- pembantu */

/*
   Isi kanal ditentukan ember di lib/sentimen.js, bukan daftar nilai yang
   ditulis di berkas ini.

   Sebelumnya kanal negatif memuat "Negatif" beserta "Campuran", sementara
   dasbor menghitung "Negatif" saja. Dua angka untuk satu kanal, dan yang
   menekan tombol "Buka kanal" dari dasbor mendapati jumlahnya berubah di
   halaman berikutnya. Sekarang keduanya membaca aturan yang sama: Campuran
   satu ember dengan Netral, sebab berita yang memuat kedua sisi sekaligus
   bukan berita yang merugikan institusi.
*/
function beritaKanal(keadaan, sisi) {
  const semua = dasar(keadaan.dalamLingkup || keadaan.berita || [])
  return semua.filter((b) => ember(b) === sisi)
}

function urlSumber(b) {
  return b.link || b.url || null
}

function barisSumber(b) {
  const tautan = urlSumber(b)
  const media = amankan(sumberAsli(b))
  const judul = amankan(ringkas(rapikanJudul(b.judul), 96))
  const waktu = amankan(jarakWaktu(b.created_at || b.tanggal_publikasi))
  const nama = tautan
    ? `<a href="${amankan(tautan)}" target="_blank" rel="noopener noreferrer">${judul}</a>`
    : judul
  return `<li style="padding:6px 0;border-bottom:1px solid var(--line-3)">
    <div style="font-size:12.5px;line-height:1.45">${nama}</div>
    <div class="mini-teks samar-teks">${media} · ${waktu}</div>
  </li>`
}

/* ---------------------------------------------------------- kartu peristiwa */

function kartuPeristiwa(p, eksposurMaks) {
  const nada = nadaUrgensi(p.urgensi)
  const lebar = eksposurMaks ? Math.max(6, Math.round((p.eksposur / eksposurMaks) * 100)) : 0
  const unit = belumTerpetakan(p.nama_upt) ? null : p.nama_upt

  const sumber = p.publikasi
    .slice()
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 6)
    .map(barisSumber)
    .join('')

  const sisa = p.jumlah_publikasi - Math.min(6, p.jumlah_publikasi)

  return `
  <article class="peristiwa" style="--nada:var(--${nada})">
    <div class="peristiwa-kop">
      ${keping(p.urgensi, nada)}
      ${keping(p.subkategori, 'netral', true)}
      ${p.kembar ? keping(`${p.kembar} salinan`, 'netral', true) : ''}
      <span class="mini-teks samar-teks" style="margin-left:auto">${amankan(jarakWaktu(p.tanggal_terakhir))}</span>
    </div>

    <div class="peristiwa-judul">${amankan(ringkas(p.judul || '', 150))}</div>

    <div class="peristiwa-kaki">
      <span>UPT <b>${amankan(unit || 'belum terpetakan')}</b></span>
      <span>Publikasi <b>${angka(p.jumlah_publikasi)}</b></span>
      <span>Media <b>${angka(p.jumlah_media)}</b></span>
      <span>Rentang <b>${angka(p.rentang_hari)}</b> hari</span>
    </div>

    <div class="eksposur" title="Eksposur ${p.eksposur}"><i style="width:${lebar}%"></i></div>

    <details style="margin-top:2px">
      <summary style="cursor:pointer;font-size:11.5px;color:var(--ink-3)">
        Sumber pemberitaan (${angka(p.jumlah_publikasi)})
      </summary>
      <ul style="list-style:none;margin:6px 0 0;padding:0">${sumber}</ul>
      ${sisa > 0 ? `<div class="mini-teks samar-teks" style="padding-top:6px">dan ${angka(sisa)} publikasi lain</div>` : ''}
    </details>
  </article>`
}

/* ------------------------------------------------------------ pintu halaman */

export function halamanKanalNegatif(ctx) { return gambarKanal(ctx, 'negatif') }
export function halamanKanalPositif(ctx) { return gambarKanal(ctx, 'positif') }

function gambarKanal({ keadaan, isi }, sisi) {
  const negatif = sisi === 'negatif'
  const daftar = beritaKanal(keadaan, sisi)
  const tapis = keadaanTapis[sisi]

  const judul = negatif ? 'Kanal Negatif' : 'Kanal Positif'
  const sub = negatif
    ? 'Isu yang merugikan institusi, dikelompokkan per peristiwa'
    : 'Narasi yang menguatkan institusi, bahan penyeimbang laporan'

  if (!daftar.length) {
    isi.innerHTML = kartu({
      judul,
      isi: kosong(
        negatif ? 'Tidak ada publikasi negatif' : 'Belum ada publikasi positif',
        negatif
          ? 'Pada arsip yang tersedia bagi Anda, tidak ada berita bersentimen negatif. Periode sepi adalah keadaan yang sah — pastikan saja sinkronisasi sumber memang berjalan.'
          : 'Belum ada publikasi bersentimen positif yang tercatat pada arsip yang tersedia bagi Anda.',
      ),
    })
    return { judul, sub }
  }

  const peristiwa = kelompokkanPeristiwa(daftar)
  const tersaring = tapis.tingkat === 'semua'
    ? peristiwa
    : peristiwa.filter((p) => p.urgensi === tapis.tingkat)

  const urut = [...tersaring].sort((a, b) => {
    if (tapis.urutan === 'terbaru') {
      return String(b.tanggal_terakhir || '').localeCompare(String(a.tanggal_terakhir || ''))
    }
    if (tapis.urutan === 'jumlah') return b.jumlah_publikasi - a.jumlah_publikasi
    return b.eksposur - a.eksposur
  })

  const eksposurMaks = Math.max(...peristiwa.map((p) => p.eksposur), 1)
  const mendesak = peristiwa.filter((p) => ['Tinggi', 'Kritis'].includes(p.urgensi))
  const tanpaUnit = peristiwa.filter((p) => belumTerpetakan(p.nama_upt))
  const unitUnik = new Set(peristiwa.filter((p) => !belumTerpetakan(p.nama_upt)).map((p) => p.nama_upt))
  const mediaUnik = new Set(daftar.map(sumberAsli).filter(Boolean))
  const perluTelaah = daftar.filter((b) => validasi(b).mutu === 'perlu-telaah')

  const ubinKanal = [
    { label: 'Peristiwa', nilai: peristiwa.length, kaki: `dari ${angka(daftar.length)} publikasi`, nada: negatif ? 'kritis' : 'positif' },
    { label: negatif ? 'Perlu respons segera' : 'Menonjol', nilai: negatif ? mendesak.length : peristiwa.filter((p) => p.jumlah_media > 1).length, kaki: negatif ? 'berurgensi tinggi atau kritis' : 'diangkat lebih dari satu media', nada: negatif ? 'tinggi' : 'aksen' },
    { label: 'UPT terdampak', nilai: unitUnik.size, kaki: `${angka(tanpaUnit.length)} peristiwa belum terpetakan`, nada: 'aksen' },
    { label: 'Media', nilai: mediaUnik.size, kaki: `${angka(perluTelaah.length)} publikasi perlu telaah`, nada: 'netral' },
  ]

  const tombolTapis = ['semua', 'Kritis', 'Tinggi', 'Sedang', 'Rendah']
    .filter((t) => t === 'semua' || peristiwa.some((p) => p.urgensi === t))
    .map((t) => `<button data-tapis-tingkat="${t}" aria-pressed="${tapis.tingkat === t}">
      ${t === 'semua' ? 'Semua tingkat' : amankan(t)}</button>`)
    .join('')

  const tombolUrut = [
    ['eksposur', 'Eksposur'],
    ['jumlah', 'Publikasi'],
    ['terbaru', 'Terbaru'],
  ].map(([k, l]) => `<button data-tapis-urutan="${k}" aria-pressed="${tapis.urutan === k}">${l}</button>`).join('')

  isi.innerHTML = `
    <div class="tumpuk">
      ${negatif && mendesak.length
        ? pesanSistem(
            `<b>${angka(mendesak.length)} peristiwa menunggu respons segera.</b>
             Seluruhnya berurgensi tinggi atau kritis, dan menyangkut
             ${angka(new Set(mendesak.filter((p) => !belumTerpetakan(p.nama_upt)).map((p) => p.nama_upt)).size)} unit.`,
            'kritis', 'peringatan')
        : ''}

      <div class="kisi kisi-4">
        ${ubinKanal.map((u) => `
          <div class="ubin" data-nada="${u.nada}">
            <span class="ubin-label">${amankan(u.label)}</span>
            <span class="ubin-nilai">${angka(u.nilai)}</span>
            <span class="ubin-kaki">${amankan(u.kaki)}</span>
          </div>`).join('')}
      </div>

      ${kartu({
        judul: negatif ? 'Peristiwa negatif' : 'Narasi positif',
        ket: negatif
          ? 'Satu kartu adalah satu kejadian. Batang di bawahnya menunjukkan seberapa besar tekanan opininya.'
          : 'Bahan counter-narrative untuk laporan berkala.',
        aksi: `<div class="segmen" data-peran="urutan">${tombolUrut}</div>`,
        isi: `
          <div class="segmen" data-peran="tingkat" style="margin-bottom:12px">${tombolTapis}</div>
          <div style="display:grid;gap:10px">
            ${urut.length
              ? urut.map((p) => kartuPeristiwa(p, eksposurMaks)).join('')
              : '<p class="samar-teks kecil-teks">Tidak ada peristiwa pada tingkat urgensi itu.</p>'}
          </div>`,
      })}
    </div>`

  // Tapis dipasang setelah HTML terpasang; halaman meminta gambar ulang lewat
  // acara, bukan dengan mengimpor balik main.js.
  isi.querySelectorAll('[data-tapis-tingkat]').forEach((b) => {
    b.addEventListener('click', () => {
      tapis.tingkat = b.dataset.tapisTingkat
      document.dispatchEvent(new CustomEvent('gambar-ulang'))
    })
  })
  isi.querySelectorAll('[data-tapis-urutan]').forEach((b) => {
    b.addEventListener('click', () => {
      tapis.urutan = b.dataset.tapisUrutan
      document.dispatchEvent(new CustomEvent('gambar-ulang'))
    })
  })

  return { judul, sub: `${sub} · ${angka(peristiwa.length)} peristiwa, ${angka(daftar.length)} publikasi` }
}
