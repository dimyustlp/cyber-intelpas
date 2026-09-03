/**
 * Titik masuk aplikasi.
 *
 * Bertanggung jawab atas tiga hal saja: sesi, kerangka layar, dan penunjuk
 * halaman. Isi tiap halaman hidup di berkas masing-masing di bawah js/pages/.
 */

import { KONFIG } from './lib/konfig.js'
import { muatSesi, profilSekarang, keluar, muatProfil, pesanRamah } from './lib/api.js'
import { menuUntuk, halamanAwal, labelPeran, adalahEksternal, adalahUnit, peranBaku, PERAN } from './lib/peran.js'
import { lencana } from './lib/hitung.js'
import { ikon } from './lib/ikon.js'
import { amankan, tanggalPanjang, inisial } from './lib/format.js'
import { roti, tombolIkon } from './ui/komponen.js'
import { hidupkan, denganPeralihan, lupakanNilai } from './lib/gerak.js'
import { bukaPalet, paletTerbuka } from './ui/palet.js'
import { profilDemo, buatBerita } from './lib/demo.js'

import { halamanMasuk } from './pages/masuk.js'
import { halamanDasbor } from './pages/dasbor.js'
import { halamanBerita } from './pages/berita.js'
import { halamanBeritaDetail } from './pages/berita-detail.js'
import { halamanBriefing } from './pages/briefing.js'
import { halamanPeringatan } from './pages/peringatan.js'
import { halamanKanalNegatif, halamanKanalPositif } from './pages/kanal.js'
import { halamanLaporan } from './pages/laporan.js'
import { halamanIntegrasi } from './pages/integrasi.js'
import { halamanDistribusi } from './pages/distribusi.js'
import { halamanTelaah } from './pages/telaah.js'
import { halamanPemetaan } from './pages/pemetaan.js'
import { halamanPeta } from './pages/peta.js'
import { halamanProfil } from './pages/profil.js'
import { halamanInput } from './pages/input.js'
import { halamanSinkronisasi } from './pages/sinkronisasi.js'
import { halamanKanwilDasbor, halamanUptDasbor, halamanWilayahBerita } from './pages/kanwil.js'
import { halamanWilayahTelaah } from './pages/wilayah-telaah.js'
import { halamanWilayahUnit } from './pages/wilayah-unit.js'

/* Siklus intelijen dan administrasi. Urutan impornya mengikuti urutan menu,
   bukan urutan penulisannya, supaya yang mencari satu halaman menemukannya di
   tempat yang sama dengan tempatnya di layar. */
import { halamanTren } from './pages/tren.js'
import { halamanKasus } from './pages/kasus.js'
import { halamanLapangan } from './pages/lapangan.js'
import { halamanEvaluasi } from './pages/evaluasi.js'
import { halamanKeputusan } from './pages/keputusan.js'
import { halamanTindak } from './pages/tindak.js'
import { halamanKoordinat } from './pages/koordinat.js'
import { halamanAudit } from './pages/audit.js'
import { halamanKesehatan } from './pages/kesehatan.js'
import { halamanPengguna } from './pages/pengguna.js'
import { halamanBelumSiap } from './pages/belum-siap.js'

const akar = document.getElementById('akar')

/** Keadaan aplikasi. Sengaja satu objek, bukan tersebar di banyak modul. */
export const keadaan = {
  profil: null,
  halaman: null,
  /** Berita yang dituju dari halaman lain, mis. tombol Telaah di Peringatan Dini. */
  fokus: null,
  /** Saringan titipan dari ubin dasbor. Diambil sekali oleh halaman tujuan. */
  saringMasuk: null,
  demo: KONFIG.mode === 'demo',
  berita: [],
  dalamLingkup: [],
  luarLingkup: 0,
  /** Benar bila arsip melewati batas pengaman penarikan dan tidak seluruhnya termuat. */
  terpotong: false,
  hitungan: { peringatan: 0, telaah: 0, pemetaan: 0, negatif: 0, telaahWilayah: 0 },
}

const HALAMAN = {
  dasbor: halamanDasbor,
  briefing: halamanBriefing,
  berita: halamanBerita,
  'berita-detail': halamanBeritaDetail,
  peringatan: halamanPeringatan,
  negatif: halamanKanalNegatif,
  positif: halamanKanalPositif,
  laporan: halamanLaporan,
  integrasi: halamanIntegrasi,
  distribusi: halamanDistribusi,
  telaah: halamanTelaah,
  pemetaan: halamanPemetaan,
  peta: halamanPeta,
  tren: halamanTren,
  kasus: halamanKasus,
  lapangan: halamanLapangan,
  evaluasi: halamanEvaluasi,
  keputusan: halamanKeputusan,
  tindak: halamanTindak,
  koordinat: halamanKoordinat,
  audit: halamanAudit,
  kesehatan: halamanKesehatan,
  profil: halamanProfil,
  input: halamanInput,
  sinkronisasi: halamanSinkronisasi,
  pengguna: halamanPengguna,
  'kanwil-dasbor': halamanKanwilDasbor,
  'upt-dasbor': halamanUptDasbor,
  'wilayah-telaah': halamanWilayahTelaah,
  'wilayah-berita': halamanWilayahBerita,
  'wilayah-unit': halamanWilayahUnit,
  /* Nama lama halaman berita daerah. Petugas yang menyimpan tautannya di
     peramban tidak perlu tahu halamannya berganti nama. */
  'kanwil-riwayat': halamanWilayahBerita,
}

/**
 * Halaman yang menampilkan satu objek, sehingga pengenalnya ikut di alamat.
 *
 * Bentuk alamatnya `#halaman/pengenal`. Daftar ini yang menentukan halaman
 * mana yang memakai bentuk itu — bukan tebakan atas ada tidaknya garis miring,
 * yang akan salah pada hari pertama sebuah pengenal memuat garis miring.
 */
const HALAMAN_BEROBJEK = new Set(['berita-detail'])

/**
 * Memisahkan alamat menjadi halaman dan pengenal.
 *
 * `decodeURIComponent` dibungkus try: alamat yang diketik tangan bisa memuat
 * persen yang bukan penyandian, dan galat di sini akan menggagalkan seluruh
 * pemuatan halaman — bukan hanya pengenalnya.
 */
function bacaAlamat(hash) {
  const bersih = String(hash || '').replace(/^#/, '')
  const pisah = bersih.indexOf('/')
  if (pisah < 0) return { halaman: bersih, fokus: null }

  const halaman = bersih.slice(0, pisah)
  const sisa = bersih.slice(pisah + 1)
  let fokus = sisa
  try { fokus = decodeURIComponent(sisa) } catch { /* pakai apa adanya */ }
  return { halaman, fokus: fokus || null }
}

/* ------------------------------------------------------------------- tema */

const KUNCI_TEMA = 'transsiberpas.tema'

/** Nama penanda dari masa sistem ini bernama Cyber-Intelpas. */
const KUNCI_TEMA_LAMA = 'cyberintelpas.tema'

function temaTersimpan() {
  // Parameter alamat menang atas pilihan tersimpan. Berguna untuk menyematkan
  // tautan bertema tetap, dan untuk memeriksa kedua tampilan saat pengembangan.
  const dariAlamat = new URLSearchParams(location.search).get('tema')
  if (dariAlamat === 'gelap' || dariAlamat === 'terang') return dariAlamat
  try {
    // Pilihan yang tersimpan di bawah nama lama dipindahkan sekali. Tanpa ini,
    // setiap petugas yang memilih tampilan terang kembali ke tampilan gelap
    // pada penggelaran nama baru, tanpa pernah menyentuh tombolnya.
    const lama = localStorage.getItem(KUNCI_TEMA_LAMA)
    if (lama !== null && localStorage.getItem(KUNCI_TEMA) === null) {
      localStorage.setItem(KUNCI_TEMA, lama)
      localStorage.removeItem(KUNCI_TEMA_LAMA)
    }
    return localStorage.getItem(KUNCI_TEMA) || ''
  } catch { return '' }
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

/**
 * Isi menu samping.
 *
 * Dipisahkan dari kerangka supaya lencana bisa digambar ulang sendirian.
 * Sesudah analis memutuskan satu berita di Antrean Telaah, angka pada lencana
 * sudah tidak benar lagi; menggambar ulang seluruh layar untuk memperbaiki satu
 * angka akan membuang formulir yang sedang diisi.
 */
/**
 * Butir menu yang harus tetap tersorot ketika halaman anaknya terbuka.
 *
 * Halaman detail berita tidak punya butir menunya sendiri — dan memang tidak
 * boleh punya. Tetapi tanpa pemetaan ini, membuka satu berita membuat SELURUH
 * menu kehilangan penanda halaman aktif, dan pembacanya kehilangan tahu ia
 * sedang berada di cabang yang mana.
 */
const INDUK_HALAMAN = { 'berita-detail': 'berita' }

function daftarMenu(peran) {
  const aktif = INDUK_HALAMAN[keadaan.halaman] || keadaan.halaman
  return menuUntuk(peran).map((g) => `
    <div class="nav-grup">
      <div class="nav-judul">${amankan(g.grup)}</div>
      ${g.butir.map((b) => {
        const jumlah = b.lencana ? keadaan.hitungan[b.lencana] : 0
        return `<button class="nav-butir" data-halaman="${b.id}"
          ${b.id === aktif ? 'aria-current="page"' : ''}>
          ${ikon(b.ikon)}<span>${amankan(b.label)}</span>
          ${jumlah > 0 ? `<span class="lencana">${jumlah > 99 ? '99+' : jumlah}</span>` : ''}
        </button>`
      }).join('')}
    </div>`).join('')
}

function kerangka() {
  const peran = keadaan.profil.role
  const eksternal = adalahEksternal(peran)
  const unit = adalahUnit(peran)
  const info = PERAN[peranBaku(peran)] || {}

  return `
  <a class="lompat" href="#isi">Lompat ke isi halaman</a>
  <!--
     Ruang wilayah diberi penanda pada kerangkanya, bukan hanya menu yang
     berbeda. Warna aksen dan kop yang berlainan membuat siapa pun tahu sedang
     berada di ruang yang mana tanpa perlu membaca satu kata pun — dan petugas
     pusat yang tidak sengaja masuk dengan akun wilayah langsung menyadarinya.
  -->
  <div class="cangkang"${unit ? ' data-ruang="unit"' : eksternal ? ' data-ruang="wilayah"' : ''}>
    <div class="tirai-menu" data-aksi="tutup-menu" aria-hidden="true"></div>
    <aside class="samping" id="samping">
      <div class="merek">
        <div class="merek-lambang">${amankan(KONFIG.lambang)}</div>
        <div class="merek-teks">
          <div class="merek-nama">${amankan(KONFIG.nama)}</div>
          ${/* Disingkat, bukan diperpanjang. Keterangan yang terpotong di
                tengah kata menyampaikan lebih sedikit daripada singkatan yang
                utuh — dan "UPT" memang sebutan sehari-hari pemakainya. */''}
          <div class="merek-sub">${amankan(unit ? 'Portal UPT'
            : eksternal ? 'Portal Kantor Wilayah' : 'Dirpamintel · Ditjen PAS')}</div>
        </div>
      </div>

      <nav class="nav" aria-label="Navigasi utama">${daftarMenu(peran)}</nav>

      <div class="kaki-samping">
        <button class="kaki-profil" data-halaman="profil" title="Profil dan kata sandi saya">
          <span class="avatar">${amankan(inisial(keadaan.profil.full_name))}</span>
          <span style="min-width:0;flex:1;text-align:left">
            <span class="kaki-nama potong">${amankan(keadaan.profil.full_name)}</span>
            <span class="kaki-peran potong">${amankan(info.ringkas || labelPeran(peran))}</span>
          </span>
        </button>
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

/* ------------------------------------------------------- fokus yang bertahan */

/**
 * Mengingat bidang yang sedang diisi, lalu mengembalikannya sesudah layar
 * digambar ulang.
 *
 * Keluhan yang melahirkan bagian ini: mengetik di kotak cari Pusat Data Berita
 * hanya bisa sejauh satu kata. Kotak carinya memanggil `gambar-ulang` sesudah
 * jeda 160 milidetik, `gambar()` membuang seluruh isi layar dan membuatnya
 * lagi — termasuk kotak carinya sendiri — dan kotak yang baru tidak mewarisi
 * apa pun dari yang lama. Fokusnya jatuh ke <body>, huruf berikutnya tidak
 * sampai ke mana-mana, dan yang mengalaminya menyimpulkan papan tiknya rusak.
 *
 * Diperbaiki di sini, bukan di tiap halaman, karena tiga alasan: halamannya
 * ada delapan dan bertambah; perbaikan per halaman menuntut tiap halaman baru
 * mengingatnya; dan yang menyebabkannya memang `gambar()`, bukan halamannya.
 *
 * Yang diingat bukan simpulnya melainkan penandanya — `data-peran`,
 * `data-bidang`, `data-saring`, atau `id`. Simpul lamanya sudah dibuang saat
 * pengembalian dilakukan, jadi menyimpan rujukannya tidak berguna.
 */
function ingatFokus() {
  const el = document.activeElement
  if (!el || el === document.body) return null
  if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return null

  const penanda = el.dataset.peran ? `[data-peran="${el.dataset.peran}"]`
    : el.dataset.bidang ? `[data-bidang="${el.dataset.bidang}"]`
      : el.dataset.saring ? `[data-saring="${el.dataset.saring}"]`
        : el.id ? `#${el.id}`
          : null
  if (!penanda) return null

  // Letak kursor hanya ada pada bidang teks. Menanyakannya pada <select> atau
  // pada input bertipe date melempar galat di sebagian peramban.
  let awal = null
  let akhir = null
  try {
    awal = el.selectionStart
    akhir = el.selectionEnd
  } catch { /* jenis bidang ini tidak punya letak kursor */ }

  return { penanda, awal, akhir }
}

function kembalikanFokus(ingatan) {
  if (!ingatan) return
  const el = document.querySelector(ingatan.penanda)
  if (!el) return
  el.focus({ preventScroll: true })
  if (ingatan.awal == null) return
  try {
    el.setSelectionRange(ingatan.awal, ingatan.akhir)
  } catch { /* jenis bidang ini tidak menerima letak kursor */ }
}

/* ---------------------------------------------------------------- gambar */

export function gambar() {
  if (!keadaan.profil) {
    akar.innerHTML = ''
    akar.appendChild(halamanMasuk({ onMasuk: mulaiSesi }))
    return
  }

  const ingatan = ingatFokus()

  akar.innerHTML = kerangka()
  const isi = document.getElementById('isi')
  const bangun = HALAMAN[keadaan.halaman] || halamanBelumSiap

  try {
    const hasil = bangun({ keadaan, isi })
    document.getElementById('bilah-judul').textContent = hasil?.judul || KONFIG.nama
    document.getElementById('bilah-sub').textContent = hasil?.sub || tanggalPanjang(new Date())
    // Gerak dipasang setelah isinya jadi, bukan sebelumnya. Kalau dipasang di
    // dalam tiap halaman, cepat atau lambat ada halaman yang lupa memasangnya.
    hidupkan(isi, { ruang: keadaan.halaman || 'umum' })
    kembalikanFokus(ingatan)
  } catch (galat) {
    isi.innerHTML = `<div class="pesan" data-nada="kritis">${ikon('peringatan')}
      <div><b>Halaman gagal ditampilkan.</b><br>${amankan(galat.message)}</div></div>`
    console.error(galat)
  }
}

/* -------------------------------------------------------------- navigasi */

/**
 * Berpindah halaman, dengan atau tanpa berita yang dituju.
 *
 * Penanda `fokus` dipakai tombol "Telaah" di Peringatan Dini. Tanpa itu,
 * antrean telaah selalu menyusun urutannya sendiri dan berita yang barusan
 * dibaca pimpinan akan tenggelam entah di nomor berapa — tombolnya secara
 * teknis bekerja, tetapi tidak membawa siapa pun ke tempat yang dimaksud.
 */
export function keHalaman(id, opsi = {}) {
  keadaan.halaman = id
  keadaan.fokus = opsi.fokus || null
  /*
     Saringan titipan. Halaman tujuan mengambilnya sekali lalu mengosongkannya
     sendiri — kalau dibiarkan, saringan itu akan dipasang ulang setiap kali
     halaman digambar ulang, dan petugas yang membersihkan saringannya akan
     melihatnya kembali dengan sendirinya.
  */
  keadaan.saringMasuk = opsi.saring || null

  /*
     Halaman yang menampilkan satu objek menaruh pengenalnya di alamat.

     Tanpa itu, `keadaan.fokus` hanya hidup di memori: memuat ulang halaman
     detail berita akan mendarat di layar "berita tidak ditemukan", dan tautan
     yang disalin ke petugas lain akan membuka halaman kosong baginya. Kedua
     hal itu justru paling sering terjadi pada halaman yang paling layak
     dibagikan.
  */
  history.replaceState(null, '', `#${HALAMAN_BEROBJEK.has(id) && keadaan.fokus
    ? `${id}/${encodeURIComponent(keadaan.fokus)}` : id}`)
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

    /*
       Saringan yang dibawa serta, bila ada. Dipakai ubin dasbor supaya daftar
       yang terbuka berjumlah sama persis dengan angka yang barusan ditekan.
       Bentuknya JSON di dalam atribut; kalau isinya rusak, yang hilang hanya
       saringannya — halamannya tetap terbuka.
    */
    let saring = null
    if (nav.dataset.saring) {
      try { saring = JSON.parse(nav.dataset.saring) } catch { saring = null }
    }

    keHalaman(nav.dataset.halaman, { saring })
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
  const { halaman, fokus } = bacaAlamat(location.hash)
  if (!halaman) return
  // Fokus ikut dibandingkan: berpindah dari satu berita ke berita lain tidak
  // mengubah nama halamannya, dan tanpa perbandingan ini layarnya tidak
  // berganti ketika tombol maju-mundur peramban ditekan.
  if (halaman !== keadaan.halaman || fokus !== keadaan.fokus) keHalaman(halaman, { fokus })
})

// Halaman yang menyaring datanya sendiri meminta gambar ulang lewat acara ini,
// supaya tidak perlu mengimpor balik main.js dan membuat lingkaran impor.
document.addEventListener('gambar-ulang', () => gambar())

// Perpindahan halaman yang membawa berita tertentu. Lewat acara, dengan alasan
// yang sama seperti di atas: halaman tidak boleh mengimpor balik berkas ini.
document.addEventListener('buka-halaman', (ev) => {
  const { halaman, fokus } = ev.detail || {}
  if (halaman) keHalaman(halaman, { fokus })
})

/*
   Sesudah sebuah berita berubah di peramban — disetujui, dikoreksi, ditandai
   tidak valid, atau baru dimasukkan — angka pada lencana menu dan dasbor sudah
   tidak benar lagi. Sebelumnya angka itu baru diperbaiki pada pemuatan ulang
   berikutnya, sehingga analis yang mengosongkan antrean tetap melihat lencana
   berisi puluhan. Yang digambar ulang hanya menunya, bukan seluruh layar.
*/
document.addEventListener('hitung-ulang', () => {
  hitungUlang()
  const nav = document.querySelector('.nav')
  if (nav && keadaan.profil) nav.innerHTML = daftarMenu(keadaan.profil.role)
})

/* ------------------------------------------------------------------ data */

/** Kolom yang ditarik. Sengaja disebut satu per satu, bukan `*`. */
const KOLOM_BERITA = 'id,judul,nama_upt,kanwil_asal,media,platform,link,created_at,'
  + 'tanggal_publikasi,kategori,subkategori,sentimen,urgensi,tingkat_perhatian,'
  + 'status_verifikasi,source_type,ringkasan,rekomendasi,ai_confidence'

/** Sekali tarik. Nilai ini di bawah batas baris bawaan PostgREST. */
const UKURAN_TARIK = 500

/** Batas pengaman. Arsip yang lebih panjang dari ini menuntut penyaringan di peladen. */
const BATAS_TARIK = 4000

/**
 * Menarik arsip berita, berhalaman sampai habis.
 *
 * Sebelumnya berkas ini menarik 400 baris terbaru dan berhenti, sementara basis
 * data menyimpan lebih dari tujuh ratus. Seluruh angka di layar sebenarnya
 * berbunyi "dari 400 terbaru", dan tidak ada satu kalimat pun yang mengatakannya
 * — pembacanya menyimpulkan sistem salah hitung, dan ia tidak keliru menduga
 * begitu.
 */
async function muatBerita() {
  const { ambil } = await import('./lib/api.js')
  const kumpulan = []
  keadaan.terpotong = false

  for (let dari = 0; dari < BATAS_TARIK; dari += UKURAN_TARIK) {
    const halaman = await ambil('berita', {
      select: KOLOM_BERITA,
      deleted_at: 'is.null',
      order: 'created_at.desc',
    }, { jangkauan: `${dari}-${dari + UKURAN_TARIK - 1}` }) || []

    kumpulan.push(...halaman)
    if (halaman.length < UKURAN_TARIK) return kumpulan
  }

  // Sampai di sini berarti arsip melewati batas pengaman. Ditandai supaya
  // dasbor menyebutkannya, bukan diam-diam menampilkan sebagian.
  keadaan.terpotong = true
  return kumpulan
}

/**
 * Menghitung ulang turunan dari `keadaan.berita`.
 *
 * Seluruh aturannya dipinjam dari lib/hitung.js. Tidak ada satu pun penyaring
 * yang ditulis ulang di berkas ini — di situlah dulu angka lencana dan angka
 * dasbor mulai berbeda.
 */
export function hitungUlang() {
  keadaan.dalamLingkup = keadaan.berita.filter((b) => b.kategori !== 'Di Luar Lingkup')
  keadaan.luarLingkup = keadaan.berita.length - keadaan.dalamLingkup.length
  keadaan.hitungan = lencana(keadaan.berita)
}

async function segarkan() {
  if (keadaan.demo) {
    keadaan.berita = buatBerita()

    /*
       Pada peladen sungguhan, petugas wilayah tidak pernah menerima baris di
       luar wilayahnya — policy RLS yang memotongnya, jauh sebelum data sampai
       ke peramban. Mode peragaan tidak punya peladen, jadi pemotongan itu
       ditiru di sini. Tanpa tiruan ini, layar peragaan ruang wilayah akan
       menampilkan angka nasional dan menyesatkan siapa pun yang memakainya
       untuk menilai bentuk halamannya.
    */
    if (adalahEksternal(keadaan.profil?.role)) {
      const wilayah = keadaan.profil?.assigned_kanwil
      const unit = keadaan.profil?.assigned_upt

      // Ruang unit jauh lebih sempit daripada ruang wilayah, dan perbedaan itu
      // harus terlihat pada peragaannya juga. Ruang unit yang menampilkan
      // sebanyak ruang wilayah akan membuat siapa pun yang menilai bentuknya
      // mengira pembatasan unitnya belum bekerja.
      keadaan.berita = keadaan.berita
        .filter((_, i) => (unit ? i % 17 === 0 : i % 4 === 0))
        .map((b) => ({
          ...b,
          kanwil_asal: wilayah,
          ...(unit ? { nama_upt: unit } : {}),
        }))
    }
    keadaan.kesehatan = {
      status: 'sehat', masuk_sehari: 6, masuk_sepekan: 41, masuk_pekan_lalu: 38,
      perubahan_persen: 8, sinkron_jeda_menit: 3, baris_jeda_jam: 2, sinkron_gagal_sehari: 0,
    }
  } else {
    try {
      keadaan.berita = await muatBerita()
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
  hitungUlang()
  gambar()
}

async function mulaiSesi(profil) {
  keadaan.profil = profil
  const { halaman, fokus } = bacaAlamat(location.hash)
  keadaan.halaman = halaman || halamanAwal(profil.role)
  keadaan.fokus = fokus
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
