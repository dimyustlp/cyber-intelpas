/**
 * Ruang Kantor Wilayah — dua halaman, satu berkas.
 *
 * Petugas wilayah membuka aplikasi yang sama dengan petugas pusat, tetapi tidak
 * boleh melihat satu pun angka nasional. Yang menahannya bukan berkas ini,
 * melainkan policy `can_access_berita` di basis data: baris yang bukan wilayah
 * mereka tidak pernah sampai ke peramban sejak awal. Guna berkas ini hanya dua
 * — menyusun apa yang memang boleh mereka lihat, dan menyatakan batasnya di
 * layar supaya tidak ada yang mengira sedang membaca angka nasional.
 *
 * Karena datanya sudah tersaring di peladen, kedua halaman ini bekerja pada
 * `keadaan.berita` yang sama seperti halaman lain. Tidak ada kueri tambahan,
 * dan tidak ada penyaring wilayah yang ditulis ulang di sisi peramban — sebab
 * penyaring di peramban selalu bisa dilewati, dan yang menulisnya cepat atau
 * lambat akan mengira ia yang menjaga data.
 */

import { ubin, kartu, keping, kosong, pesanSistem, tombol } from '../ui/komponen.js'
import {
  amankan, angka, jarakWaktu, tanggalJam, tanggalPanjang, ringkas,
  nadaUrgensi, nadaSentimen, nadaStatus, asalTautan,
} from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ringkasan } from '../lib/hitung.js'
import { ember, EMBER } from '../lib/sentimen.js'
import { belumTerpetakan } from '../lib/pencocokan-upt.js'
import { punyaIzin } from '../lib/peran.js'

/** Nama wilayah yang sedang dibuka, apa adanya dari profil. */
function wilayah(keadaan) {
  return keadaan.profil?.assigned_kanwil || null
}

/**
 * Peringatan yang muncul ketika profil belum ditetapkan wilayahnya.
 *
 * Tanpa `assigned_kanwil`, policy basis data menolak setiap kiriman dan tidak
 * mengembalikan satu baris pun — layarnya kosong, dan tidak ada apa pun yang
 * menjelaskan mengapa. Kalimat ini yang menjelaskannya.
 */
function periksaWilayah(keadaan) {
  if (wilayah(keadaan)) return ''
  return pesanSistem(
    '<b>Akun Anda belum ditetapkan kantor wilayahnya.</b> Selama itu belum diisi '
    + 'administrator, kiriman berita akan ditolak dan daftar di bawah akan tetap kosong. '
    + 'Hubungi administrator sistem untuk menetapkan wilayah pada profil Anda.',
    'kritis', 'peringatan',
  )
}

/* ------------------------------------------------------------ ringkasan */

export function halamanKanwilDasbor({ keadaan, isi }) {
  const nama = wilayah(keadaan)
  const r = ringkasan(keadaan.berita || [])

  const terverifikasi = r.inti.filter((b) => b.status_verifikasi === 'Terverifikasi')
  const milikSendiri = r.inti.filter((b) => b.created_by === keadaan.profil?.username)

  isi.innerHTML = `
    <div class="tumpuk">
      ${periksaWilayah(keadaan)}

      ${pesanSistem(
        `<b>Ruang ini hanya memuat berita wilayah Anda.</b> Angka di bawah bukan angka nasional, `
        + `dan tidak memuat berita kantor wilayah lain.`, 'netral', 'info')}

      <div class="kisi kisi-4">
        ${ubin({
          label: 'Berita wilayah',
          nilai: r.total,
          nada: 'aksen',
          kaki: `${angka(r.hariIni.length)} masuk hari ini`,
        })}
        ${ubin({
          label: 'Perlu respons segera',
          nilai: r.mendesak.length,
          nada: r.mendesak.length ? 'kritis' : 'netral',
          kaki: 'berurgensi tinggi atau kritis',
        })}
        ${ubin({
          label: 'Menunggu telaah pusat',
          nilai: r.antrean.length,
          nada: r.antrean.length ? 'sedang' : 'netral',
          kaki: `${angka(terverifikasi.length)} sudah ditelaah`,
        })}
        ${ubin({
          label: 'Kiriman Anda sendiri',
          nilai: milikSendiri.length,
          nada: 'netral',
          kaki: 'dari seluruh berita wilayah ini',
        })}
      </div>

      ${kartu({
        judul: 'Keseimbangan pemberitaan wilayah',
        ket: 'Dihitung dengan aturan yang sama seperti dasbor pusat',
        isi: `
          <div class="rekon-baris">
            <span class="rekon-hitung">
              <b class="angka">${angka(r.total)}</b> berita dihitung
              <span class="rekon-sama">=</span>
              ${EMBER.map((e) => `<b class="angka">${angka(r.perEmber[e.kode])}</b> ${amankan(e.label.toLowerCase())}`)
                .join(' <span class="rekon-tambah">+</span> ')}
              ${r.perEmber.belum ? ` <span class="rekon-tambah">+</span> <b class="angka">${angka(r.perEmber.belum)}</b> belum dinilai` : ''}
            </span>
          </div>
          <div class="imbang" style="margin-top:10px" role="img"
            aria-label="Negatif ${angka(r.negatif.length)}, netral ${angka(r.netral.length)}, positif ${angka(r.positif.length)}">
            <span class="neg" style="flex:${r.negatif.length}"></span>
            <span class="net" style="flex:${r.netral.length + r.belumDinilai.length}"></span>
            <span class="pos" style="flex:${r.positif.length}"></span>
          </div>`,
      })}

      ${kartu({
        judul: 'Unit yang paling banyak disorot',
        ket: 'Unit pelaksana teknis di wilayah Anda',
        rapat: true,
        isi: tabelUnit(r.inti),
      })}

      ${kartu({
        judul: 'Yang mendesak',
        ket: `${angka(r.mendesak.length)} berita berurgensi tinggi atau kritis`,
        aksi: tombol({ label: 'Riwayat kiriman', ikon: 'panahKanan', kecil: true, halaman: 'kanwil-riwayat' }),
        rapat: true,
        isi: r.mendesak.length
          ? daftarRingkas(r.mendesak.slice(0, 8))
          : kosong('Tidak ada yang mendesak',
              'Tidak ada berita berurgensi tinggi atau kritis di wilayah Anda saat ini.'),
      })}
    </div>`

  return {
    judul: 'Ringkasan Wilayah',
    sub: nama ? `${nama} · ${tanggalPanjang(new Date())}` : tanggalPanjang(new Date()),
  }
}

function tabelUnit(berita) {
  const peta = new Map()
  for (const b of berita) {
    if (belumTerpetakan(b.nama_upt)) continue
    const p = peta.get(b.nama_upt) || { nama: b.nama_upt, total: 0, negatif: 0, mendesak: 0 }
    p.total += 1
    if (ember(b) === 'negatif') p.negatif += 1
    if (['Tinggi', 'Kritis'].includes(b.urgensi)) p.mendesak += 1
    peta.set(b.nama_upt, p)
  }

  const daftar = [...peta.values()]
    .sort((a, b) => b.mendesak - a.mendesak || b.negatif - a.negatif || b.total - a.total)
    .slice(0, 8)

  if (!daftar.length) {
    return kosong('Belum ada unit terpetakan',
      'Berita di wilayah Anda belum terhubung ke unit mana pun, atau belum ada berita sama sekali.')
  }

  return `
  <div class="tabel-bungkus">
    <table class="tabel">
      <thead><tr>
        <th>Unit</th>
        <th style="width:62px" class="rata-kanan">Total</th>
        <th style="width:72px" class="rata-kanan">Negatif</th>
        <th style="width:76px" class="rata-kanan">Mendesak</th>
      </tr></thead>
      <tbody>
        ${daftar.map((u) => `
          <tr>
            <td style="font-weight:550">${amankan(u.nama)}</td>
            <td class="angka rata-kanan">${angka(u.total)}</td>
            <td class="angka rata-kanan">${u.negatif ? `<span style="color:var(--kritis)">${angka(u.negatif)}</span>` : '—'}</td>
            <td class="angka rata-kanan">${u.mendesak ? `<span style="color:var(--tinggi);font-weight:650">${angka(u.mendesak)}</span>` : '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

function daftarRingkas(daftar) {
  return `
  <div class="tabel-bungkus">
    <table class="tabel">
      <thead><tr>
        <th style="width:78px">Urgensi</th>
        <th>Berita</th>
        <th style="width:170px">Unit</th>
        <th style="width:96px">Masuk</th>
      </tr></thead>
      <tbody>
        ${daftar.map((b) => `
          <tr>
            <td>${keping(b.urgensi || '—', nadaUrgensi(b.urgensi))}</td>
            <td>
              <span class="judul-sel">${amankan(b.judul || 'Tanpa judul')}</span>
              <span class="mini-teks samar-teks">${amankan(b.subkategori || b.kategori || 'Belum dikelompokkan')}</span>
            </td>
            <td class="kecil">${amankan(belumTerpetakan(b.nama_upt) ? 'Belum terpetakan' : b.nama_upt)}</td>
            <td class="angka kecil">${amankan(jarakWaktu(b.created_at))}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

/* -------------------------------------------------------------- riwayat */

const saringRiwayat = { lingkup: 'semua', status: 'Semua status' }

export function halamanKanwilRiwayat({ keadaan, isi }) {
  const nama = wilayah(keadaan)
  const username = keadaan.profil?.username
  const bolehLihatSemua = punyaIzin(keadaan.profil?.role, 'lihat_kiriman_wilayah')

  const semua = (keadaan.berita || []).filter((b) => !b.deleted_at)

  // Penginput hanya melihat kirimannya sendiri; admin wilayah boleh memilih.
  const dasar = bolehLihatSemua && saringRiwayat.lingkup === 'semua'
    ? semua
    : semua.filter((b) => b.created_by === username)

  const daftar = dasar
    .filter((b) => saringRiwayat.status.startsWith('Semua') || b.status_verifikasi === saringRiwayat.status)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))

  const menunggu = dasar.filter((b) => !b.status_verifikasi || ['Belum Ditelaah', 'Perlu Koreksi'].includes(b.status_verifikasi))
  const diterima = dasar.filter((b) => b.status_verifikasi === 'Terverifikasi')
  const ditolak = dasar.filter((b) => b.status_verifikasi === 'Tidak Valid')

  isi.innerHTML = `
    <div class="tumpuk">
      ${periksaWilayah(keadaan)}

      <div class="kisi kisi-4">
        ${ubin({ label: 'Seluruh kiriman', nilai: dasar.length, nada: 'aksen',
          kaki: bolehLihatSemua && saringRiwayat.lingkup === 'semua' ? 'seluruh wilayah Anda' : 'kiriman Anda sendiri' })}
        ${ubin({ label: 'Menunggu telaah pusat', nilai: menunggu.length,
          nada: menunggu.length ? 'sedang' : 'netral', kaki: 'belum diputuskan analis' })}
        ${ubin({ label: 'Sudah diverifikasi', nilai: diterima.length, nada: 'positif',
          kaki: 'dipakai sebagai angka resmi' })}
        ${ubin({ label: 'Dinyatakan tidak valid', nilai: ditolak.length,
          nada: ditolak.length ? 'kritis' : 'netral', kaki: 'tidak ikut dihitung' })}
      </div>

      ${kartu({
        rapat: true,
        isi: `
          <div class="bilah-alat">
            ${bolehLihatSemua ? `
              <div class="segmen" data-peran="lingkup">
                <button data-lingkup="semua" aria-pressed="${saringRiwayat.lingkup === 'semua'}">Seluruh wilayah</button>
                <button data-lingkup="sendiri" aria-pressed="${saringRiwayat.lingkup === 'sendiri'}">Kiriman saya</button>
              </div>` : ''}
            <select class="pilihan" data-saring="status" aria-label="Saring status telaah" style="width:auto;min-width:150px">
              ${['Semua status', 'Belum Ditelaah', 'Perlu Koreksi', 'Terverifikasi', 'Tidak Valid']
                .map((s) => `<option${s === saringRiwayat.status ? ' selected' : ''}>${s}</option>`).join('')}
            </select>
            <div class="dorong baris gap-6">
              <span class="mini-teks samar-teks">${angka(daftar.length)} dari ${angka(dasar.length)}</span>
              ${tombol({ label: 'Kirim berita', ikon: 'tambah', kecil: true, gaya: 'utama', halaman: 'input' })}
            </div>
          </div>

          ${daftar.length ? tabelRiwayat(daftar.slice(0, 60)) : kosong(
            'Belum ada kiriman',
            nama
              ? 'Belum ada berita yang tercatat dengan saringan ini. Mulailah dari halaman Kirim Berita.'
              : 'Wilayah pada profil Anda belum ditetapkan, sehingga belum ada kiriman yang bisa ditampilkan.',
            tombol({ label: 'Kirim berita', ikon: 'tambah', gaya: 'utama', halaman: 'input' }),
          )}`,
      })}
    </div>`

  for (const s of isi.querySelectorAll('[data-saring="status"]')) {
    s.addEventListener('change', (ev) => {
      saringRiwayat.status = ev.target.value
      document.dispatchEvent(new CustomEvent('gambar-ulang'))
    })
  }

  for (const b of isi.querySelectorAll('[data-lingkup]')) {
    b.addEventListener('click', () => {
      saringRiwayat.lingkup = b.dataset.lingkup
      document.dispatchEvent(new CustomEvent('gambar-ulang'))
    })
  }

  return {
    judul: 'Riwayat Kiriman',
    sub: nama ? `${nama} · ${angka(dasar.length)} kiriman tercatat` : 'Wilayah belum ditetapkan',
  }
}

function tabelRiwayat(daftar) {
  return `
  <div class="tabel-bungkus">
    <table class="tabel">
      <thead><tr>
        <th>Berita</th>
        <th style="width:150px">Unit</th>
        <th style="width:104px">Sentimen</th>
        <th style="width:120px">Status</th>
        <th style="width:96px">Dikirim</th>
      </tr></thead>
      <tbody>
        ${daftar.map((b) => `
          <tr>
            <td>
              <span class="judul-sel">${amankan(ringkas(b.judul || 'Tanpa judul', 110))}</span>
              <span class="mini-teks samar-teks">
                ${amankan(b.media || asalTautan(b.link || '') || 'Tidak tercatat')}
                ${b.link ? ` · <a href="${amankan(b.link)}" target="_blank" rel="noopener noreferrer">sumber</a>` : ''}
              </span>
            </td>
            <td class="kecil">${amankan(belumTerpetakan(b.nama_upt) ? 'Belum terpetakan' : b.nama_upt)}</td>
            <td>${keping(b.sentimen || 'Belum dinilai', nadaSentimen(b.sentimen), true)}</td>
            <td>${keping(b.status_verifikasi || 'Belum Ditelaah', nadaStatus(b.status_verifikasi), true)}</td>
            <td class="angka kecil" title="${amankan(tanggalJam(b.created_at))}">${amankan(jarakWaktu(b.created_at))}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}
