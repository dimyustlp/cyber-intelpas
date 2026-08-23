/**
 * Titik masuk aplikasi.
 *
 * Bertanggung jawab atas tiga hal saja: sesi, kerangka layar, dan penunjuk
 * halaman. Isi tiap halaman hidup di berkas masing-masing di bawah js/pages/.
 */

import { KONFIG } from './lib/konfig.js'
import { muatSesi, profilSekarang, keluar, muatProfil, pesanRamah } from './lib/api.js'
import { menuUntuk, halamanAwal, labelPeran, adalahEksternal, PERAN } from './lib/peran.js'
import { ikon } from './lib/ikon.js'
import { amankan, tanggalPanjang, inisial } from './lib/format.js'
import { roti, tombolIkon } from './ui/komponen.js'
import { hidupkan, denganPeralihan, lupakanNilai } from './lib/gerak.js'
import { bukaPalet, paletTerbuka } from './ui/palet.js'
import { profilDemo, buatBerita } from './lib/demo.js'

import { halamanMasuk } from './pages/masuk.js'
import { halamanDasbor } from './pages/dasbor.js'
import { halamanBerita } from './pages/berita.js'
import { halamanPeringatan } from './pages/peringatan.js'
import { halamanKanalNegatif, halamanKanalPositif } from './pages/kanal.js'
import { halamanLaporan } from './pages/laporan.js'
import { halamanIntegrasi } from './pages/integrasi.js'
import { halamanDistribusi } from './pages/distribusi.js'
import { halamanTelaah } from './pages/telaah.js'
import { halamanBelumSiap } from './pages/belum-siap.js'

const akar = document.getElementById('akar')

/** Keadaan aplikasi. Sengaja satu objek, bukan tersebar di banyak modul. */
export const keadaan = {
  profil: null,
  halaman: null,
  demo: KONFIG.mode === 'demo',
  berita: [],
  dalamLingkup: [],
  luarLingkup: 0,
  hitungan: { peringatan: 0, telaah: 0, pemetaan: 0, negatif: 0 },
}

const HALAMAN = {
  dasbor: halamanDasbor,
  berita: halamanBerita,
  peringatan: halamanPeringatan,
  negatif: halamanKanalNegatif,
  positif: halamanKanalPositif,
  laporan: halamanLaporan,
  integrasi: halamanIntegrasi,
  distribusi: halamanDistribusi,
  telaah: halamanTelaah,
}

/* ------------------------------------------------------------------- tema */

const KUNCI_TEMA = 'cyberintelpas.tema'

function temaTersimpan() {
  // Parameter alamat menang atas pilihan tersimpan. Berguna untuk menyematkan
  // tautan bertema tetap, dan untuk memeriksa kedua tampilan saat pengembangan.
  const dariAlamat = new URLSearchParams(location.search).get('tema')
  if (dariAlamat === 'gelap' || dariAlamat === 'terang') return dariAlamat
  try { return localStorage.getItem(KUNCI_TEMA) || '' } catch { return '' }
}

function pasangTema(nilai) {
  document.documentElement.dataset.tema = nilai
  try { localStorage.setItem(KUNCI_TEMA, nilai) } catch { /* penyimpanan bisa ditolak */ }
}

function putarTema() {
  const sekarang = document.documentElement.dataset.tema
  // Tiga keadaan: ikut sistem → terang → gelap → ikut sistem.
  const berikut = sekarang === '' ? 'terang' : sekarang === 'terang' ? 'gelap' : ''
  pasangTema(berikut)
  roti(
    berikut === '' ? 'Tampilan mengikuti pengaturan perangkat.'
      : berikut === 'terang' ? 'Tampilan terang.' : 'Tampilan gelap.',
    'aksen', 2200,
  )
  gambar()
}

/* --------------------------------------------------------------- kerangka */

function kerangka() {
  const peran = keadaan.profil.role
  const menu = menuUntuk(peran)
  const eksternal = adalahEksternal(peran)

  const daftarMenu = menu.map((g) => `
    <div class="nav-grup">
      <div class="nav-judul">${amankan(g.grup)}</div>
      ${g.butir.map((b) => {
        const jumlah = b.lencana ? keadaan.hitungan[b.lencana] : 0
        return `<button class="nav-butir" data-halaman="${b.id}"
          ${b.id === keadaan.halaman ? 'aria-current="page"' : ''}>
          ${ikon(b.ikon)}<span>${amankan(b.label)}</span>
          ${jumlah > 0 ? `<span class="lencana">${jumlah > 99 ? '99+' : jumlah}</span>` : ''}
        </button>`
      }).join('')}
    </div>`).join('')

  const info = PERAN[peran] || {}

  return `
  <a class="lompat" href="#isi">Lompat ke isi halaman</a>
  <div class="cangkang">
    <div class="tirai-menu" data-aksi="tutup-menu" aria-hidden="true"></div>
    <aside class="samping" id="samping">
      <div class="merek">
        <div class="merek-lambang">CI</div>
        <div class="merek-teks">
          <div class="merek-nama">Cyber-Intelpas</div>
          <div class="merek-sub">${amankan(eksternal ? 'Portal Kantor Wilayah' : 'Dirpamintel · Ditjen PAS')}</div>
        </div>
      </div>

      <nav class="nav" aria-label="Navigasi utama">${daftarMenu}</nav>

      <div class="kaki-samping">
        <div class="avatar">${amankan(inisial(keadaan.profil.full_name))}</div>
        <div style="min-width:0;flex:1">
          <div class="kaki-nama potong">${amankan(keadaan.profil.full_name)}</div>
          <div class="kaki-peran potong">${amankan(info.ringkas || labelPeran(peran))}</div>
        </div>
        ${tombolIkon({ ikon: 'keluar', aksi: 'keluar', judul: 'Keluar dari sesi', kecil: true })}
      </div>
    </aside>

    <div class="kolom-utama">
      <header class="bilah">
        <button class="tbl ikon samar hanya-sempit" data-aksi="menu"
          aria-label="Buka menu navigasi" aria-expanded="false"
          aria-controls="samping">${ikon('menu')}</button>
        <div>
          <div class="bilah-judul" id="bilah-judul"></div>
          <div class="bilah-sub" id="bilah-sub"></div>
        </div>
        <div class="bilah-kanan">
          ${keadaan.demo ? '<span class="keping" data-nada="sedang">Mode peragaan</span>' : ''}
          <button class="cari-pemicu" data-aksi="cari" aria-label="Cari halaman, unit, atau berita">
            ${ikon('cari')}<span>Cari…</span><kbd>Ctrl K</kbd>
          </button>
          ${tombolIkon({ ikon: 'segar', aksi: 'muat-ulang', judul: 'Muat ulang data' })}
          ${tombolIkon({ ikon: document.documentElement.dataset.tema === 'gelap' ? 'terang' : 'gelap', aksi: 'tema', judul: 'Ganti tampilan terang atau gelap' })}
        </div>
      </header>

      <main class="isi" id="isi" tabindex="-1"></main>
    </div>
  </div>`
}

/* ---------------------------------------------------------------- gambar */

export function gambar() {
  if (!keadaan.profil) {
    akar.innerHTML = ''
    akar.appendChild(halamanMasuk({ onMasuk: mulaiSesi }))
    return
  }

  akar.innerHTML = kerangka()
  const isi = document.getElementById('isi')
  const bangun = HALAMAN[keadaan.halaman] || halamanBelumSiap

  try {
    const hasil = bangun({ keadaan, isi })
    document.getElementById('bilah-judul').textContent = hasil?.judul || 'Cyber-Intelpas'
    document.getElementById('bilah-sub').textContent = hasil?.sub || tanggalPanjang(new Date())
    // Gerak dipasang setelah isinya jadi, bukan sebelumnya. Kalau dipasang di
    // dalam tiap halaman, cepat atau lambat ada halaman yang lupa memasangnya.
    hidupkan(isi, { ruang: keadaan.halaman || 'umum' })
  } catch (galat) {
    isi.innerHTML = `<div class="pesan" data-nada="kritis">${ikon('peringatan')}
      <div><b>Halaman gagal ditampilkan.</b><br>${amankan(galat.message)}</div></div>`
    console.error(galat)
  }
}

/* -------------------------------------------------------------- navigasi */

export function keHalaman(id) {
  keadaan.halaman = id
  history.replaceState(null, '', `#${id}`)
  // Peralihan membuat perpindahan halaman terbaca sebagai satu gerakan, bukan
  // sebagai layar yang berkedip. Pada peramban yang belum mendukungnya,
  // halaman berganti seperti biasa.
  denganPeralihan(() => gambar())
  document.getElementById('isi')?.focus({ preventScroll: true })
  window.scrollTo({ top: 0 })
}

/* ---------------------------------------------------------- menu sempit */
/*
   Di layar sempit, tepi kiri berubah menjadi laci yang menutupi isi halaman.
   Laci semacam itu menuntut tiga hal yang mudah terlupa, dan ketiganya pernah
   tidak ada di sini: tombol pembukanya harus benar-benar terlihat, ia harus
   bisa ditutup tanpa menekan tombol yang sama, dan tombol Esc harus bekerja
   — sebab laci yang menutupi seluruh layar tanpa jalan keluar yang jelas
   adalah jebakan, bukan navigasi.
*/

function menuTerbuka() {
  return document.getElementById('samping')?.classList.contains('buka') || false
}

function bukaMenu() {
  const samping = document.getElementById('samping')
  if (!samping) return
  samping.classList.add('buka')
  document.querySelector('[data-aksi="menu"]')?.setAttribute('aria-expanded', 'true')
  document.body.classList.add('menu-terbuka')
  // Fokus dipindahkan ke dalam laci supaya papan tik tidak tertinggal di
  // belakang tirai, menekan tombol yang tidak terlihat siapa pun.
  samping.querySelector('.nav-butir')?.focus({ preventScroll: true })
}

function tutupMenu() {
  const samping = document.getElementById('samping')
  if (!samping?.classList.contains('buka')) return
  samping.classList.remove('buka')
  document.body.classList.remove('menu-terbuka')
  const tombol = document.querySelector('[data-aksi="menu"]')
  tombol?.setAttribute('aria-expanded', 'false')
  tombol?.focus({ preventScroll: true })
}

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && menuTerbuka()) tutupMenu()

  // Ctrl+K, atau Cmd+K pada Mac. Dicegat sebelum peramban memakainya untuk
  // kotak alamatnya sendiri — di dalam aplikasi ini, pencarian yang dimaksud
  // orang ketika menekan Ctrl+K adalah pencarian isi, bukan pencarian web.
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k' && !paletTerbuka()) {
    if (!keadaan.profil) return
    ev.preventDefault()
    bukaPalet(keadaan, keHalaman)
  }
})

document.addEventListener('click', async (ev) => {
  const nav = ev.target.closest('[data-halaman]')
  if (nav) {
    // Memilih halaman menutup lacinya. Membiarkannya terbuka berarti halaman
    // yang baru dipilih tertutup oleh menu yang memilihnya.
    if (menuTerbuka()) tutupMenu()
    keHalaman(nav.dataset.halaman)
    return
  }

  const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
  if (!aksi) return

  if (aksi === 'tema') putarTema()
  else if (aksi === 'menu') bukaMenu()
  else if (aksi === 'tutup-menu') tutupMenu()
  else if (aksi === 'cari') bukaPalet(keadaan, keHalaman)
  else if (aksi === 'muat-ulang') { await segarkan(); roti('Data dimuat ulang.', 'positif') }
  else if (aksi === 'keluar') {
    await keluar()
    keadaan.profil = null
    keadaan.halaman = null
    lupakanNilai()
    gambar()
  }
})

window.addEventListener('hashchange', () => {
  const id = location.hash.slice(1)
  if (id && id !== keadaan.halaman) keHalaman(id)
})

// Halaman yang menyaring datanya sendiri meminta gambar ulang lewat acara ini,
// supaya tidak perlu mengimpor balik main.js dan membuat lingkaran impor.
document.addEventListener('gambar-ulang', () => gambar())

/* ------------------------------------------------------------------ data */

async function segarkan() {
  if (keadaan.demo) {
    keadaan.berita = buatBerita()
    keadaan.kesehatan = {
      status: 'sehat', masuk_sehari: 6, masuk_sepekan: 41, masuk_pekan_lalu: 38,
      perubahan_persen: 8, sinkron_jeda_menit: 3, baris_jeda_jam: 2, sinkron_gagal_sehari: 0,
    }
  } else {
    try {
      const { ambil } = await import('./lib/api.js')
      keadaan.berita = await ambil('berita', {
        select: 'id,judul,nama_upt,media,platform,link,created_at,tanggal_publikasi,kategori,subkategori,sentimen,urgensi,tingkat_perhatian,status_verifikasi,source_type,ringkasan,rekomendasi,ai_confidence',
        deleted_at: 'is.null',
        order: 'created_at.desc',
        limit: 400,
      }) || []
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      keadaan.berita = []
    }

    // Kesehatan aliran data ditanyakan terpisah, dan kegagalannya tidak boleh
    // menjatuhkan seluruh layar. Kalau pemeriksaan ini tidak bisa dijalankan,
    // yang hilang hanyalah satu bilah peringatan — bukan dasbornya.
    try {
      const { panggilFungsi } = await import('./lib/api.js')
      keadaan.kesehatan = await panggilFungsi('kesehatan_asupan')
    } catch {
      keadaan.kesehatan = null
    }
  }

  // Berita di luar lingkup tetap tersimpan dan tetap bisa ditelaah di Pusat
  // Data Berita, tetapi tidak ikut menjadi angka. Perkara Rutan KPK bukan
  // beban unit Pemasyarakatan mana pun, dan unggahan berbahasa asing yang
  // kebetulan memuat kata "lapas" bukan pemberitaan sama sekali.
  keadaan.dalamLingkup = keadaan.berita.filter((b) => b.kategori !== 'Di Luar Lingkup')
  keadaan.luarLingkup = keadaan.berita.length - keadaan.dalamLingkup.length

  keadaan.hitungan = {
    peringatan: keadaan.dalamLingkup.filter((b) => ['Tinggi', 'Kritis'].includes(b.urgensi)
      && !['Tidak Valid', 'Diarsipkan'].includes(b.status_verifikasi)).length,
    telaah: keadaan.dalamLingkup.filter((b) => b.status_verifikasi === 'Belum Ditelaah').length,
    negatif: keadaan.dalamLingkup.filter((b) => b.sentimen === 'Negatif'
      && !['Tidak Valid', 'Diarsipkan'].includes(b.status_verifikasi)).length,
    pemetaan: keadaan.dalamLingkup.filter((b) => !b.nama_upt
      || ['Belum Teridentifikasi', 'Tidak diketahui'].includes(b.nama_upt)).length,
  }
  gambar()
}

async function mulaiSesi(profil) {
  keadaan.profil = profil
  keadaan.halaman = location.hash.slice(1) || halamanAwal(profil.role)
  await segarkan()
}

/* ------------------------------------------------------------------ mulai */

async function mulai() {
  pasangTema(temaTersimpan())

  if (keadaan.demo) {
    const peran = new URLSearchParams(location.search).get('peran') || 'media_intelligence_analyst'
    await mulaiSesi(profilDemo(PERAN[peran] ? peran : 'media_intelligence_analyst'))
    return
  }

  const sesi = muatSesi()
  if (!sesi) { gambar(); return }

  try {
    const profil = profilSekarang() || await muatProfil()
    if (!profil) throw new Error('Profil pengguna tidak ditemukan.')
    await mulaiSesi(profil)
  } catch (galat) {
    console.warn('Sesi tersimpan tidak dapat dipulihkan:', galat)
    keadaan.profil = null
    gambar()
  }
}

mulai()
