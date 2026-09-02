/**
 * Peta Sebaran Kerawanan.
 *
 * Menggambar seluruh Lapas, Rutan, dan LPKA di Indonesia pada satu layar,
 * diwarnai menurut keadaan pemberitaan masing-masing. Pertanyaan yang
 * dijawabnya tidak bisa dijawab tabel: di mana persoalannya menumpuk. Sepuluh
 * unit rawan yang tersebar dari Aceh sampai Papua dan sepuluh unit rawan yang
 * seluruhnya berada di satu provinsi terbaca sama persis di dalam tabel, dan
 * sama sekali berbeda artinya.
 *
 * Lima keputusan yang menentukan isi berkas ini:
 *
 *   Petanya digambar sendiri sebagai SVG, tanpa satu pun pustaka luar dan tanpa
 *   ubin dari peladen mana pun. Aturan proyek melarangnya, dan larangan itu ada
 *   sebabnya: peta yang bergantung pada peladen luar akan kosong justru di
 *   jaringan kantor yang memblokirnya. Garis pantainya tersimpan di dalam repo
 *   sebagai lib/peta-indonesia.js.
 *
 *   Warna titik ditentukan lib/hitung.js, bukan berkas ini. Warna pada peta
 *   adalah pernyataan — siapa pun yang melihat titik merah menyimpulkan ada
 *   yang gawat — dan pernyataan itu harus memakai aturan yang sama dengan
 *   seluruh angka lain di sistem ini.
 *
 *   Ketidakpastian koordinatnya dinyatakan di layar, bukan disembunyikan.
 *   Sebagian besar unit masih memakai titik pusat kota, bukan alamat gedung.
 *   Peta yang tidak mengatakannya mengundang pembacanya menyimpulkan jarak
 *   antarunit dari sesuatu yang tidak pernah dimaksudkan untuk itu.
 *
 *   Menggeser dan memperbesar tidak menggambar ulang halaman. Kotak pandang
 *   diubah langsung pada simpul SVG-nya, satu atribut per bingkai gambar.
 *   Menggambar ulang seluruh halaman untuk setiap putaran roda tetikus berarti
 *   531 lingkaran dibuang dan dibuat lagi enam puluh kali sedetik — dan setiap
 *   animasi yang sedang berjalan mati di tengah jalan setiap kali itu terjadi.
 *
 *   Geraknya menjawab pertanyaan, bukan menghias. Titik mekar dari barat ke
 *   timur sekali saja saat data induk sampai, sehingga mata tahu petanya baru
 *   selesai dimuat, bukan sisa tampilan tadi. Denyut hanya diberikan kepada
 *   unit berkategori kritis — kalau semuanya berdenyut, tidak ada yang
 *   berdenyut. Perpindahan kotak pandang diberi peralihan supaya pembacanya
 *   tidak kehilangan letak: peta yang melompat memaksa orang mencari lagi di
 *   mana tadi ia berada. Semuanya padam ketika perangkat meminta gerak
 *   dikurangi.
 */

import { kartu, keping, pesanSistem, roti } from '../ui/komponen.js'
import { amankan, angka, ringkas, jarakWaktu, nadaUrgensi } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, pesanRamah } from '../lib/api.js'
import { KERAWANAN, tingkatKerawanan, dasar } from '../lib/hitung.js'
import { ember } from '../lib/sentimen.js'
import { belumTerpetakan } from '../lib/pencocokan-upt.js'
import { BATAS, DARATAN, TETANGGA } from '../lib/peta-indonesia.js'
import { kurangiGerak } from '../lib/gerak.js'

/** Jenis unit yang digambar. Bapas dan rumah sakit tidak termasuk data induk. */
const JENIS = ['Lapas', 'Rutan', 'LPKA']

/**
 * Warna tiap tingkat kerawanan.
 *
 * Bukan empat rona setara, melainkan satu deret yang menua dari hijau ke merah,
 * sebab kerawanan bersifat berurut. Unit tanpa pemberitaan diberi abu-abu
 * berlubang — ia bukan derajat paling ringan, melainkan keadaan yang berbeda
 * jenisnya: kita tidak tahu apa-apa tentangnya.
 */
const WARNA = {
  terang: { kritis: '#A81E0E', rawan: '#C0754A', waspada: '#C9A227', aman: '#1F6B50', sepi: '#9AA4B2' },
  gelap: { kritis: '#FF7B62', rawan: '#E39A63', waspada: '#E2C15C', aman: '#3FC79B', sepi: '#5E6A7A' },
}

/** Lebar kepulauan dalam derajat; dipakai sebagai acuan perbesaran 1×. */
const BENTANG = BATAS.maxLon - BATAS.minLon

/**
 * Kotak pandang tersempit yang diizinkan, dalam derajat bujur.
 *
 * Dua derajat kira-kira 220 km. Lebih sempit dari itu tidak menambah apa pun:
 * koordinat sebagian besar unit masih titik pusat kota, jadi memperbesar sampai
 * seukuran kecamatan hanya memperbesar kesalahannya.
 */
const ZUM_MAKS = 2

const DURASI_PINDAH = 560

/** Panjang batang skala yang dianggap "bulat" oleh mata. */
const PANJANG_SKALA = [10, 25, 50, 100, 250, 500, 1000, 2000, 4000]

function gelap() {
  const stempel = document.documentElement.dataset.tema
  if (stempel === 'gelap') return true
  if (stempel === 'terang') return false
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function warna(kode) {
  return (gelap() ? WARNA.gelap : WARNA.terang)[kode] || WARNA.terang.sepi
}

/** Keadaan halaman, bertahan selama sesi supaya saringan tidak hilang. */
const keadaanPeta = {
  dimuat: false,
  galat: null,
  unit: [],
  kanwil: 'Seluruh Indonesia',
  jenis: 'Semua jenis',
  hanyaBermasalah: false,
  /** Tingkat kerawanan yang dipadamkan lewat legenda. */
  sembunyi: new Set(),
  /** Kata pencarian; meredupkan titik yang tidak cocok, bukan membuangnya. */
  cari: '',
  /** Unit yang sedang dibuka pada panel samping. */
  dipilih: null,
  /** Kotak pandang SVG: [x, y, lebar, tinggi] dalam derajat. */
  pandang: null,
  /** Mekar barat-ke-timur hanya sekali, pada tampilan pertama sesudah data sampai. */
  sudahMekar: false,
}

const PANDANG_AWAL = () => [
  BATAS.minLon - 0.6,
  -BATAS.maxLat - 0.6,
  (BATAS.maxLon - BATAS.minLon) + 1.2,
  (BATAS.maxLat - BATAS.minLat) + 1.2,
]

const ASPEK = () => PANDANG_AWAL()[3] / PANDANG_AWAL()[2]

/**
 * Jari-jari titik untuk sebuah lebar kotak pandang.
 *
 * Titik ikut mengecil saat diperbesar, tetapi tidak sebanding penuh: pada
 * perbesaran penuh, titik yang benar-benar sebanding akan lebih kecil daripada
 * kursor yang mengarahkannya.
 */
function jariUntuk(lebar) {
  return Math.max(0.042, 0.14 * Math.sqrt(lebar / BENTANG))
}

/** Mengembalikan kotak pandang ke dalam batas peta, dengan nisbah sisi tetap. */
function dalamBatas([x, y, l]) {
  const penuh = PANDANG_AWAL()
  const lebar = Math.min(penuh[2], Math.max(ZUM_MAKS, l))
  const tinggi = lebar * ASPEK()
  return [
    Math.min(Math.max(x, penuh[0]), penuh[0] + penuh[2] - lebar),
    Math.min(Math.max(y, penuh[1]), penuh[1] + penuh[3] - tinggi),
    lebar,
    tinggi,
  ]
}

/** Kotak pandang yang memuat seluruh unit yang diberikan, dengan tepi. */
function pandangMemuat(daftar, tepi = 1.2) {
  if (!daftar.length) return PANDANG_AWAL()
  const lonMin = Math.min(...daftar.map((u) => u.lon)) - tepi
  const lonMaks = Math.max(...daftar.map((u) => u.lon)) + tepi
  const yMin = Math.min(...daftar.map((u) => -u.lat)) - tepi
  const yMaks = Math.max(...daftar.map((u) => -u.lat)) + tepi
  // Kotak yang terlalu sempit membuat satu wilayah berisi satu unit diperbesar
  // sampai daratannya hilang sama sekali dari layar.
  const lebar = Math.max(lonMaks - lonMin, (yMaks - yMin) / ASPEK(), 2.6)
  return dalamBatas([
    (lonMin + lonMaks) / 2 - lebar / 2,
    (yMin + yMaks) / 2 - (lebar * ASPEK()) / 2,
    lebar,
  ])
}

function pandangDiTitik(x, y, lebar) {
  return dalamBatas([x - lebar / 2, y - (lebar * ASPEK()) / 2, lebar])
}

/* --------------------------------------------------------------- gambar */

/**
 * Membalik tanda lintang pada sebuah jalur.
 *
 * Bujur naik ke kanan seperti X pada SVG, tetapi lintang naik ke atas
 * sedangkan Y turun ke bawah. Tanpa pembalikan ini Indonesia tergambar
 * terbalik — dan terbaliknya tidak kentara, sebab kepulauan ini nyaris
 * setangkup terhadap khatulistiwa.
 */
const jalurBalik = new Map()
function balik(d) {
  const tersimpan = jalurBalik.get(d)
  if (tersimpan) return tersimpan
  const hasil = d.replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g, (_, huruf, lon, lat) =>
    `${huruf}${lon} ${-Number(lat)}`)
  jalurBalik.set(d, hasil)
  return hasil
}

/**
 * Jaring bujur-lintang setiap lima derajat, dengan khatulistiwa dipertegas.
 *
 * Bukan hiasan: begitu peta bisa diperbesar sampai satu kabupaten, seluruh
 * acuan letak hilang — daratan yang tersisa di layar bisa saja bagian mana pun
 * dari Sumatera. Jaringnya memberi kerangka yang tetap terbaca pada perbesaran
 * berapa pun.
 */
function jaring() {
  const [x, y, l, t] = PANDANG_AWAL()
  const garis = []
  for (let lon = 95; lon <= 145; lon += 5) {
    garis.push(`<line x1="${lon}" y1="${y.toFixed(2)}" x2="${lon}" y2="${(y + t).toFixed(2)}"/>`)
  }
  for (let lat = -10; lat <= 5; lat += 5) {
    garis.push(`<line class="${lat === 0 ? 'khatulistiwa' : ''}"
      x1="${x.toFixed(2)}" y1="${-lat}" x2="${(x + l).toFixed(2)}" y2="${-lat}"/>`)
  }
  return garis.join('')
}

/** Cincin sorot pada unit terpilih. Jari-jarinya diurus CSS, mengikuti --jari. */
function cincin(u) {
  if (!u) return ''
  return `
    <circle class="cincin-luar" cx="${u.lon}" cy="${-u.lat}"/>
    <circle class="cincin-dalam" cx="${u.lon}" cy="${-u.lat}"/>`
}

/**
 * Membangun SVG petanya.
 *
 * Lintang dibalik tandanya, bukan dibalik lewat transformasi kelompok. Kalau
 * memakai transformasi, seluruh teks dan lingkaran di dalamnya ikut terbalik
 * dan harus dibalik lagi satu per satu — dan yang lupa dibalik akan terbaca
 * sebagai tulisan cermin.
 */
function svgPeta(titik) {
  const [x, y, l, t] = keadaanPeta.pandang
  const jari = jariUntuk(l)
  const mekar = !keadaanPeta.sudahMekar && !kurangiGerak()
  const dipilih = keadaanPeta.dipilih
    ? titik.find((u) => u.nama === keadaanPeta.dipilih)
    : null

  // Denyut hanya untuk yang kritis, dan waktunya digeser-geser. Denyut serentak
  // terbaca sebagai satu kedipan layar, bukan sebagai lima tempat yang berbeda.
  const berdenyut = titik.filter((u) => u.tingkat.kode === 'kritis')

  return `
    <svg class="peta-svg" viewBox="${x} ${y} ${l} ${t}" role="img"
         style="--jari:${jari.toFixed(4)}"
         aria-label="Peta sebaran ${angka(titik.length)} unit pemasyarakatan di Indonesia"
         preserveAspectRatio="xMidYMid meet">
      <g class="peta-jaring" aria-hidden="true">${jaring()}</g>
      <g class="peta-tetangga">
        ${TETANGGA.map((d) => `<path d="${balik(d)}"/>`).join('')}
      </g>
      <g class="peta-halo" aria-hidden="true">
        ${DARATAN.map((d) => `<path d="${balik(d)}"/>`).join('')}
      </g>
      <g class="peta-daratan">
        ${DARATAN.map((d) => `<path d="${balik(d)}"/>`).join('')}
      </g>
      <g class="peta-denyut" aria-hidden="true">
        ${berdenyut.map((u, i) => `
          <circle cx="${u.lon}" cy="${-u.lat}" r="${jari.toFixed(4)}"
                  style="animation-delay:${(i % 6) * 430}ms"/>`).join('')}
      </g>
      <g class="peta-titik${mekar ? ' mekar' : ''}">
        ${titik.map((u) => `
          <circle class="t-${u.tingkat.kode}" cx="${u.lon}" cy="${-u.lat}" r="${jari.toFixed(4)}"
                  fill="${warna(u.tingkat.kode)}"
                  style="--tunda:${Math.round(((u.lon - BATAS.minLon) / BENTANG) * 560)}ms"
                  data-unit="${amankan(u.nama)}"
                  tabindex="0" role="button"
                  aria-label="${amankan(u.nama)} — ${amankan(u.tingkat.label)}, ${angka(u.berita.length)} berita"/>`).join('')}
      </g>
      <g class="peta-pilih" aria-hidden="true">${cincin(dipilih)}</g>
    </svg>`
}

/* ------------------------------------------------------------- penyusun */

/**
 * Menggabungkan data induk unit dengan berita yang terpetakan kepadanya.
 *
 * Pencocokannya lewat `nama_upt` persis, sama seperti yang dipakai policy basis
 * data. Berita yang unitnya belum terpetakan tidak jatuh ke unit mana pun, dan
 * jumlahnya disebutkan tersendiri di layar — bukan dibagi rata atau diam-diam
 * dilekatkan ke unit terdekat.
 */
function susunTitik(unitInduk, berita) {
  const perUnit = new Map()
  for (const b of berita) {
    if (belumTerpetakan(b.nama_upt)) continue
    const kumpulan = perUnit.get(b.nama_upt) || []
    kumpulan.push(b)
    perUnit.set(b.nama_upt, kumpulan)
  }

  return unitInduk.map((u) => {
    const miliknya = perUnit.get(u.nama) || []
    return { ...u, berita: miliknya, tingkat: tingkatKerawanan(miliknya) }
  })
}

function saringTitik(titik) {
  return titik
    .filter((u) => keadaanPeta.kanwil.startsWith('Seluruh') || u.kanwil === keadaanPeta.kanwil)
    .filter((u) => keadaanPeta.jenis.startsWith('Semua') || u.jenis === keadaanPeta.jenis)
    .filter((u) => !keadaanPeta.sembunyi.has(u.tingkat.kode))
    .filter((u) => !keadaanPeta.hanyaBermasalah
      || ['kritis', 'rawan', 'waspada'].includes(u.tingkat.kode))
}

/**
 * Pencarian meredupkan, bukan membuang.
 *
 * Titik yang tidak cocok tetap digambar dengan warna pudar, sehingga hasil
 * pencarian terbaca sebagai letak di dalam kepulauan — bukan sebagai peta baru
 * berisi tiga titik yang mengambang tanpa acuan.
 */
function cocokCari(u) {
  const kata = keadaanPeta.cari.trim().toLowerCase()
  if (!kata) return true
  return [u.nama, u.kanwil, u.provinsi, u.jenis]
    .filter(Boolean).join(' ').toLowerCase().includes(kata)
}

/* --------------------------------------------------------------- bagian */

function legenda(titik) {
  return `
    <div class="peta-legenda">
      ${KERAWANAN.map((k) => {
        const jumlah = titik.filter((u) => u.tingkat.kode === k.kode).length
        const padam = keadaanPeta.sembunyi.has(k.kode)
        return `
          <button class="peta-legenda-butir${padam ? ' padam' : ''}"
                  data-tingkat="${k.kode}" aria-pressed="${!padam}"
                  title="${amankan(k.ket)} — tekan untuk menyembunyikannya dari peta.">
            <i style="background:${warna(k.kode)}"></i>
            ${amankan(k.label)}
            <b class="angka">${angka(jumlah)}</b>
          </button>`
      }).join('')}
    </div>`
}

/** Panel samping: hasil pencarian, unit terpilih, atau daftar yang paling gawat. */
function panelSamping(titik) {
  const kata = keadaanPeta.cari.trim()
  if (kata) return panelCari(titik, kata)

  const dipilih = keadaanPeta.dipilih
    ? titik.find((u) => u.nama === keadaanPeta.dipilih)
    : null
  if (dipilih) return panelUnit(dipilih)

  const gawat = titik
    .filter((u) => ['kritis', 'rawan'].includes(u.tingkat.kode))
    .sort((a, b) => {
      const urut = { kritis: 2, rawan: 1 }
      return (urut[b.tingkat.kode] - urut[a.tingkat.kode]) || (b.berita.length - a.berita.length)
    })
    .slice(0, 14)

  return `
    <div class="peta-panel">
      <div class="peta-panel-kop">
        <span class="label-mono">Unit paling disorot</span>
        <span class="mini-teks samar-teks">${angka(gawat.length)} teratas</span>
      </div>
      ${gawat.length ? daftarUnit(gawat)
        : `<p class="ket" style="padding:12px 2px">Tidak ada unit berkategori rawan atau kritis
           pada saringan ini. Itu keadaan yang baik — dan patut diperiksa ulang bila saringannya
           terlalu sempit.</p>`}
    </div>`
}

function panelCari(titik, kata) {
  const cocok = titik.filter(cocokCari).slice(0, 30)
  return `
    <div class="peta-panel">
      <div class="peta-panel-kop">
        <span class="label-mono">Hasil pencarian</span>
        <span class="mini-teks samar-teks">${angka(cocok.length)} unit</span>
      </div>
      ${cocok.length ? daftarUnit(cocok)
        : `<p class="ket" style="padding:12px 2px">Tidak ada unit yang memuat
           &ldquo;${amankan(ringkas(kata, 40))}&rdquo; pada saringan ini.</p>`}
    </div>`
}

function daftarUnit(daftar) {
  return `
    <ul class="peta-daftar">
      ${daftar.map((u) => `
        <li>
          <button data-unit="${amankan(u.nama)}">
            <i style="background:${warna(u.tingkat.kode)}"></i>
            <span>
              <span class="peta-daftar-nama">${amankan(u.nama)}</span>
              <span class="mini-teks samar-teks">${amankan(u.kanwil || u.provinsi || '')}</span>
            </span>
            <b class="angka">${angka(u.berita.length)}</b>
          </button>
        </li>`).join('')}
    </ul>`
}

function panelUnit(u) {
  const inti = dasar(u.berita)
  const negatif = inti.filter((b) => ember(b) === 'negatif')
  const mendesak = inti.filter((b) => ['Tinggi', 'Kritis'].includes(b.urgensi))
  const terbaru = [...inti]
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .slice(0, 6)

  return `
    <div class="peta-panel">
      <div class="peta-panel-kop">
        <span class="label-mono">Unit terpilih</span>
        <button class="tbl kecil samar" data-aksi="tutup-unit">${ikon('tutup')}Tutup</button>
      </div>

      <h3 class="peta-panel-judul">${amankan(u.nama)}</h3>
      <p class="mini-teks samar-teks">
        ${amankan(u.jenis || '')}${u.provinsi ? ` · ${amankan(u.provinsi)}` : ''}<br>
        ${amankan(u.kanwil || '')}
      </p>

      <div class="baris gap-6" style="margin:10px 0 12px">
        ${keping(u.tingkat.label, u.tingkat.nada)}
        <span class="mini-teks samar-teks">${amankan(u.tingkat.ket)}</span>
      </div>

      <dl class="peta-angka">
        <div><dt>Berita</dt><dd class="angka">${angka(inti.length)}</dd></div>
        <div><dt>Negatif</dt><dd class="angka">${angka(negatif.length)}</dd></div>
        <div><dt>Mendesak</dt><dd class="angka">${angka(mendesak.length)}</dd></div>
      </dl>

      ${terbaru.length ? `
        <div class="peta-panel-kop" style="margin-top:14px">
          <span class="label-mono">Pemberitaan terakhir</span>
        </div>
        <ul class="peta-berita">
          ${terbaru.map((b) => `
            <li>
              <span class="peta-berita-judul">${amankan(ringkas(b.judul || 'Tanpa judul', 92))}</span>
              <span class="mini-teks samar-teks">
                ${keping(b.urgensi || '—', nadaUrgensi(b.urgensi), true)}
                ${amankan(b.media || '')} · ${amankan(jarakWaktu(b.created_at))}
              </span>
            </li>`).join('')}
        </ul>`
        : `<p class="ket" style="margin-top:12px">Belum ada berita yang terpetakan ke unit ini.
           Titiknya tetap digambar — sebuah unit yang tidak pernah diberitakan bukan unit yang
           tidak ada.</p>`}

      <div class="baris gap-6" style="margin-top:14px">
        <button class="tbl kecil" data-aksi="zum-unit">${ikon('lapangan')}Perbesar ke unit ini</button>
      </div>

      <p class="ket" style="margin-top:10px">
        Koordinat: ${u.lat.toFixed(4)}, ${u.lon.toFixed(4)}
      </p>
    </div>`
}

/* -------------------------------------------------------------- halaman */

export function halamanPeta({ keadaan, isi }) {
  if (!keadaanPeta.pandang) keadaanPeta.pandang = PANDANG_AWAL()

  // Mekarnya diulang setiap kali halaman ini dibuka, tetapi tidak pada
  // penggambaran ulang di dalamnya. Membuka halaman berarti petanya memang baru
  // digambar; mengubah saringan tidak, dan sapuan yang berulang tiap kali
  // saringan disentuh berubah dari penanda menjadi gangguan.
  keadaanPeta.sudahMekar = false
  let pengamatUkuran = null

  /** Titik yang sedang tergambar, supaya penyimak tidak perlu menyusunnya ulang. */
  let tampil = []
  let animasi = null

  const svgnya = () => isi.querySelector('.peta-svg')

  function gambar() {
    if (keadaanPeta.galat) {
      isi.innerHTML = kartu({
        isi: pesanSistem(`<b>Data induk unit gagal dimuat.</b> ${amankan(keadaanPeta.galat)}`,
          'kritis', 'peringatan'),
      })
      return
    }

    if (!keadaanPeta.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:420px"></div>' })
      return
    }

    const semua = susunTitik(keadaanPeta.unit, keadaan.berita || [])
    tampil = saringTitik(semua)
    const kanwilAda = [...new Set(semua.map((u) => u.kanwil).filter(Boolean))].sort()
    const takTerpetakan = (keadaan.berita || []).filter((b) => belumTerpetakan(b.nama_upt)).length

    isi.innerHTML = `
      <div class="tumpuk">
        <div class="bilah-alat">
          <label class="cari" style="max-width:250px">
            ${ikon('cari')}
            <input class="masukan" type="search" data-peran="cari-peta"
                   value="${amankan(keadaanPeta.cari)}"
                   placeholder="Cari unit, provinsi, kanwil"
                   aria-label="Cari unit pada peta">
          </label>

          <select class="pilihan" data-saring="kanwil" aria-label="Saring kantor wilayah"
                  style="width:auto;min-width:230px">
            ${['Seluruh Indonesia', ...kanwilAda].map((k) =>
              `<option${k === keadaanPeta.kanwil ? ' selected' : ''}>${amankan(k)}</option>`).join('')}
          </select>

          <select class="pilihan" data-saring="jenis" aria-label="Saring jenis unit"
                  style="width:auto;min-width:130px">
            ${['Semua jenis', ...JENIS].map((j) =>
              `<option${j === keadaanPeta.jenis ? ' selected' : ''}>${amankan(j)}</option>`).join('')}
          </select>

          <button class="tbl kecil${keadaanPeta.hanyaBermasalah ? ' utama' : ''}"
                  data-aksi="hanya-bermasalah"
                  aria-pressed="${keadaanPeta.hanyaBermasalah}">
            ${ikon('saring')}Hanya yang bermasalah
          </button>

          <div class="dorong baris gap-6">
            <span class="mini-teks samar-teks">
              ${angka(tampil.length)} dari ${angka(semua.length)} unit
            </span>
          </div>
        </div>

        <div class="peta-tata">
          ${kartu({
            rapat: true,
            isi: `
              <div class="peta-wadah" id="peta-wadah" tabindex="0"
                   aria-label="Peta yang dapat digeser dan diperbesar. Tombol panah menggeser, tambah dan kurang memperbesar, angka nol mengembalikan pandangan ke seluruh Indonesia.">
                ${svgPeta(tampil)}

                <div class="peta-kendali">
                  <button class="tbl ikon kecil" data-aksi="perbesar"
                          title="Perbesar" aria-label="Perbesar">${ikon('tambah')}</button>
                  <button class="tbl ikon kecil" data-aksi="perkecil"
                          title="Perkecil" aria-label="Perkecil">${ikon('kurang')}</button>
                  <button class="tbl ikon kecil" data-aksi="pandang-awal"
                          title="Kembali ke seluruh Indonesia"
                          aria-label="Kembali ke seluruh Indonesia">${ikon('peta')}</button>
                </div>

                <div class="peta-hud" aria-hidden="true">
                  <div class="peta-skala">
                    <span class="peta-skala-batang"></span>
                    <b class="peta-skala-teks">&mdash;</b>
                  </div>
                  <div class="peta-zum"><b>1,0&times;</b></div>
                </div>

                <div class="peta-tip" hidden></div>

                <p class="peta-petunjuk" aria-hidden="true">
                  Tahan <kbd>Ctrl</kbd> sambil memutar roda untuk memperbesar peta
                </p>
              </div>
              ${legenda(tampil)}
              <p class="ket peta-catatan">
                ${ikon('info')}
                <span>
                  Titik menunjukkan letak wilayah unit, <b>bukan alamat gedungnya</b>: koordinat
                  sebagian besar unit masih berupa titik pusat kota atau kabupaten dan menunggu
                  verifikasi. Jarak antartitik karena itu tidak dapat dipakai sebagai jarak
                  sebenarnya.
                  ${takTerpetakan ? `<br>${angka(takTerpetakan)} berita belum terpetakan ke unit mana pun,
                    sehingga tidak mewarnai satu titik pun.` : ''}
                </span>
              </p>`,
          })}
          <div id="peta-samping">${panelSamping(tampil)}</div>
        </div>
      </div>`

    keadaanPeta.sudahMekar = true
    pasangPeta()
    terapkanCari()
    perbaruiHud()
  }

  /** Menggambar ulang panel samping saja; peta di sebelahnya tidak disentuh. */
  function gambarPanel() {
    const wadah = isi.querySelector('#peta-samping')
    if (!wadah) return
    wadah.innerHTML = panelSamping(tampil)
    // Kelas ini memicu peralihan masuk, lalu dilepas supaya isian panel
    // berikutnya bisa memicunya lagi.
    const panel = wadah.firstElementChild
    if (panel && !kurangiGerak()) {
      panel.classList.add('masuk')
      panel.addEventListener('animationend', () => panel.classList.remove('masuk'), { once: true })
    }
  }

  /* ----------------------------------------------------------- pandang */

  /**
   * Memasang kotak pandang pada simpul SVG-nya.
   *
   * Hanya tiga hal yang diubah: atribut viewBox, satu peubah CSS untuk jari-jari
   * titik, dan angka pada penunjuk skala. Semua sisanya, termasuk 531 lingkaran,
   * tetap di tempatnya.
   */
  function terapkanPandang(pandang) {
    keadaanPeta.pandang = pandang
    const svg = svgnya()
    if (!svg) return
    svg.setAttribute('viewBox', pandang.map((n) => n.toFixed(4)).join(' '))
    svg.style.setProperty('--jari', jariUntuk(pandang[2]).toFixed(4))
    perbaruiHud()
  }

  /**
   * Menyalin jari-jari ke atribut r setiap lingkaran.
   *
   * Peramban yang sudah mengenal properti CSS r mengurus ini sendiri lewat
   * peubah --jari, dan itulah yang membuat perbesaran mulus. Yang belum
   * mengenalnya jatuh ke atribut, jadi atributnya dibetulkan sekali di ujung
   * peralihan, bukan enam puluh kali sedetik.
   */
  function setelJariAtribut() {
    const svg = svgnya()
    if (!svg) return
    const jari = jariUntuk(keadaanPeta.pandang[2]).toFixed(4)
    for (const c of svg.querySelectorAll('.peta-titik circle, .peta-denyut circle')) {
      c.setAttribute('r', jari)
    }
  }

  /**
   * Berpindah kotak pandang dengan peralihan.
   *
   * Lebarnya ditapis secara geometris, bukan linear. Perbesaran yang ditapis
   * linear terasa melesat di awal lalu merayap di akhir, sebab yang ditangkap
   * mata adalah nisbah perbesaran, bukan selisihnya.
   */
  function pindahPandang(tujuan, durasi = DURASI_PINDAH) {
    if (animasi) cancelAnimationFrame(animasi)
    animasi = null

    if (kurangiGerak() || !svgnya()) {
      terapkanPandang(tujuan)
      setelJariAtribut()
      return
    }

    const awal = [...keadaanPeta.pandang]
    const tengahAwal = [awal[0] + awal[2] / 2, awal[1] + awal[3] / 2]
    const tengahTujuan = [tujuan[0] + tujuan[2] / 2, tujuan[1] + tujuan[3] / 2]
    const mulai = performance.now()

    const langkah = (waktu) => {
      const p = Math.min(1, (waktu - mulai) / durasi)
      const e = p < 0.5 ? 4 * p * p * p : 1 - ((-2 * p + 2) ** 3) / 2
      const lebar = awal[2] * ((tujuan[2] / awal[2]) ** e)
      const tinggi = lebar * ASPEK()
      const cx = tengahAwal[0] + (tengahTujuan[0] - tengahAwal[0]) * e
      const cy = tengahAwal[1] + (tengahTujuan[1] - tengahAwal[1]) * e
      terapkanPandang([cx - lebar / 2, cy - tinggi / 2, lebar, tinggi])

      if (p < 1) { animasi = requestAnimationFrame(langkah); return }
      animasi = null
      terapkanPandang(tujuan)
      setelJariAtribut()
    }
    animasi = requestAnimationFrame(langkah)
  }

  /** Memperbesar atau memperkecil, menahan satu titik tetap di bawah kursor. */
  function zumDi(faktor, jangkar) {
    const [x, y, l, t] = keadaanPeta.pandang
    const lebar = Math.min(PANDANG_AWAL()[2], Math.max(ZUM_MAKS, l * faktor))
    const tinggi = lebar * ASPEK()
    const titik = jangkar || [x + l / 2, y + t / 2]
    return dalamBatas([
      titik[0] - (titik[0] - x) * (lebar / l),
      titik[1] - (titik[1] - y) * (tinggi / t),
      lebar,
    ])
  }

  /** Membawa satu unit ke dalam layar, tetapi hanya bila ia memang di luar. */
  function pastikanTerlihat(u) {
    const [x, y, l, t] = keadaanPeta.pandang
    const px = u.lon
    const py = -u.lat
    const tepi = 0.1
    const di = px > x + l * tepi && px < x + l * (1 - tepi)
      && py > y + t * tepi && py < y + t * (1 - tepi)
    if (di) return
    pindahPandang(dalamBatas([px - l / 2, py - t / 2, l]), 420)
  }

  /* --------------------------------------------------------------- hud */

  /**
   * Batang skala dan angka perbesaran.
   *
   * Peta tanpa skala mengundang pembacanya menebak jarak dari lebar layar, dan
   * tebakan itu berubah setiap kali jendelanya berubah ukuran. Panjangnya
   * dipilih dari deret angka bulat supaya yang terbaca "250 km", bukan "237 km".
   */
  function perbaruiHud() {
    const svg = svgnya()
    const wadah = isi.querySelector('.peta-hud')
    if (!svg || !wadah) return

    const [, y, l, t] = keadaanPeta.pandang
    const ctm = svg.getScreenCTM()
    const pxPerDerajat = ctm && ctm.a ? ctm.a : svg.getBoundingClientRect().width / l
    if (!pxPerDerajat) return

    const latTengah = -(y + t / 2)
    const kmPerPx = (111.32 * Math.cos((latTengah * Math.PI) / 180)) / pxPerDerajat
    const incar = kmPerPx * 130
    const km = PANJANG_SKALA.reduce((a, b) => (Math.abs(b - incar) < Math.abs(a - incar) ? b : a))

    wadah.querySelector('.peta-skala-batang').style.width = `${(km / kmPerPx).toFixed(1)}px`
    wadah.querySelector('.peta-skala-teks').textContent = `${angka(km)} km`
    wadah.querySelector('.peta-zum b').textContent =
      `${(BENTANG / l).toFixed(1).replace('.', ',')}\u00d7`
  }

  /* ------------------------------------------------------------- sorot */

  function titikNode(nama) {
    const svg = svgnya()
    if (!svg || !nama) return null
    return svg.querySelector(`.peta-titik circle[data-unit="${CSS.escape(nama)}"]`)
  }

  /** Memindahkan cincin sorot tanpa menggambar ulang satu titik pun. */
  function perbaruiCincin() {
    const svg = svgnya()
    if (!svg) return
    const u = tampil.find((x) => x.nama === keadaanPeta.dipilih)
    svg.querySelector('.peta-pilih').innerHTML = cincin(u)
    for (const c of svg.querySelectorAll('.peta-titik circle.terpilih')) c.classList.remove('terpilih')
    titikNode(keadaanPeta.dipilih)?.classList.add('terpilih')
  }

  /** Meredupkan titik yang tidak cocok dengan kata pencarian. */
  function terapkanCari() {
    const svg = svgnya()
    if (!svg) return
    const mencari = keadaanPeta.cari.trim().length > 0
    svg.classList.toggle('mencari', mencari)
    if (!mencari) {
      for (const c of svg.querySelectorAll('.peta-titik circle.redup')) c.classList.remove('redup')
      return
    }
    const cocok = new Set(tampil.filter(cocokCari).map((u) => u.nama))
    for (const c of svg.querySelectorAll('.peta-titik circle')) {
      c.classList.toggle('redup', !cocok.has(c.dataset.unit))
    }
  }

  function pilih(nama, { dekati = true } = {}) {
    keadaanPeta.dipilih = nama
    perbaruiCincin()
    gambarPanel()
    const u = tampil.find((x) => x.nama === nama)
    if (u && dekati) pastikanTerlihat(u)
  }

  /* -------------------------------------------------------------- tip */

  function tampilkanTip(node, ev) {
    const wadah = isi.querySelector('.peta-wadah')
    const tip = isi.querySelector('.peta-tip')
    if (!wadah || !tip) return
    const u = tampil.find((x) => x.nama === node.dataset.unit)
    if (!u) return

    tip.innerHTML = `
      <b>${amankan(u.nama)}</b>
      <span><i style="background:${warna(u.tingkat.kode)}"></i>${amankan(u.tingkat.label)}
        &middot; ${angka(u.berita.length)} berita</span>
      <span class="samar-teks">${amankan(u.kanwil || u.provinsi || '')}</span>`
    tip.hidden = false

    const kotak = wadah.getBoundingClientRect()
    const lebar = tip.offsetWidth
    const tinggi = tip.offsetHeight
    // Dijaga tetap di dalam kotak peta: tip yang menggantung keluar dipotong
    // oleh overflow:hidden, dan yang terpotong justru namanya sendiri.
    const kiri = Math.min(Math.max(ev.clientX - kotak.left + 14, 6), Math.max(6, kotak.width - lebar - 6))
    const atas = Math.min(Math.max(ev.clientY - kotak.top - tinggi - 12, 6), Math.max(6, kotak.height - tinggi - 6))
    tip.style.transform = `translate(${kiri.toFixed(0)}px, ${atas.toFixed(0)}px)`
  }

  function sembunyikanTip() {
    const tip = isi.querySelector('.peta-tip')
    if (tip) tip.hidden = true
  }

  /* ------------------------------------------------------ geser & zum */

  /**
   * Memasang seretan, roda, cubitan, dan papan tik pada peta.
   *
   * Perpindahan layar ke derajat memakai matriks SVG-nya sendiri, bukan
   * perbandingan lebar kotak. Petanya dipasang dengan preserveAspectRatio,
   * jadi kotak pandangnya hampir selalu lebih sempit daripada kotak elemennya,
   * dan hitungan berdasarkan lebar elemen akan meleset sejauh pita kosong di
   * kiri-kanannya.
   */
  function pasangPeta() {
    const svg = svgnya()
    const wadah = isi.querySelector('.peta-wadah')
    if (!svg || !wadah) return

    const keDerajat = (clientX, clientY) => {
      const ctm = svg.getScreenCTM()
      if (!ctm) return null
      const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
      return [p.x, p.y]
    }

    const jari = new Map()
    let seret = null
    let cubit = null

    svg.addEventListener('pointerdown', (ev) => {
      jari.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })

      if (jari.size === 2) {
        // Cubitan dua jari. Seretan dibatalkan supaya peta tidak melompat
        // mengikuti jari yang kebetulan turun lebih dulu.
        seret = null
        const [a, b] = [...jari.values()]
        cubit = {
          jarak: Math.hypot(a.x - b.x, a.y - b.y),
          pandang: [...keadaanPeta.pandang],
          jangkar: keDerajat((a.x + b.x) / 2, (a.y + b.y) / 2),
        }
        return
      }

      if (jari.size > 2) return
      if (ev.target.closest('[data-unit]')) return
      const ctm = svg.getScreenCTM()
      if (!ctm || !ctm.a) return
      seret = { x: ev.clientX, y: ev.clientY, pandang: [...keadaanPeta.pandang], perPx: 1 / ctm.a }
      svg.setPointerCapture(ev.pointerId)
      svg.classList.add('menyeret')
    })

    svg.addEventListener('pointermove', (ev) => {
      if (jari.has(ev.pointerId)) jari.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })

      if (cubit && jari.size === 2) {
        const [a, b] = [...jari.values()]
        const jarak = Math.hypot(a.x - b.x, a.y - b.y)
        if (!jarak || !cubit.jarak) return
        const l = cubit.pandang[2]
        const lebar = Math.min(PANDANG_AWAL()[2], Math.max(ZUM_MAKS, l * (cubit.jarak / jarak)))
        const j = cubit.jangkar || [cubit.pandang[0] + l / 2, cubit.pandang[1] + cubit.pandang[3] / 2]
        terapkanPandang(dalamBatas([
          j[0] - (j[0] - cubit.pandang[0]) * (lebar / l),
          j[1] - (j[1] - cubit.pandang[1]) * (lebar / l),
          lebar,
        ]))
        return
      }

      if (!seret) return
      terapkanPandang(dalamBatas([
        seret.pandang[0] - (ev.clientX - seret.x) * seret.perPx,
        seret.pandang[1] - (ev.clientY - seret.y) * seret.perPx,
        seret.pandang[2],
      ]))
    })

    const lepas = (ev) => {
      jari.delete(ev.pointerId)
      if (jari.size < 2 && cubit) { cubit = null; setelJariAtribut() }
      if (!seret) return
      seret = null
      svg.classList.remove('menyeret')
      setelJariAtribut()
      try { svg.releasePointerCapture(ev.pointerId) } catch { /* penunjuk sudah dilepas */ }
    }
    svg.addEventListener('pointerup', lepas)
    svg.addEventListener('pointercancel', lepas)

    let jedaRoda = null
    let jedaPetunjuk = null

    /*
       Roda tanpa penekan tidak memperbesar, melainkan menggulir halaman.

       Pada layar selebar 1024 piksel tata letaknya menumpuk dan halamannya
       menjadi lebih tinggi daripada layar. Peta yang menelan setiap putaran
       roda membuat halaman itu tidak bisa dilewati: kursor yang kebetulan
       berhenti di atas peta memperbesar peta alih-alih menurunkan halaman, dan
       pembacanya tidak pernah sampai ke keterangan di bawahnya. Penekan Ctrl
       memisahkan kedua maksud itu, dan petunjuk sekejap mengajarkannya kepada
       orang yang belum tahu.
    */
    svg.addEventListener('wheel', (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) {
        const petunjuk = wadah.querySelector('.peta-petunjuk')
        if (petunjuk) {
          petunjuk.classList.add('tampak')
          clearTimeout(jedaPetunjuk)
          jedaPetunjuk = setTimeout(() => petunjuk.classList.remove('tampak'), 1600)
        }
        return
      }
      ev.preventDefault()
      if (animasi) { cancelAnimationFrame(animasi); animasi = null }
      // Satuan gulir berbeda antar peramban dan antar tetikus; yang dipakai
      // hanya arahnya, dengan langkah tetap, supaya satu klik roda selalu
      // berarti perubahan yang sama.
      terapkanPandang(zumDi(ev.deltaY > 0 ? 1.18 : 1 / 1.18, keDerajat(ev.clientX, ev.clientY)))
      clearTimeout(jedaRoda)
      jedaRoda = setTimeout(setelJariAtribut, 160)
    }, { passive: false })

    // Ketukan ganda mendekat, ketukan ganda sambil menahan Shift menjauh —
    // kebiasaan yang sama dengan peta mana pun.
    svg.addEventListener('dblclick', (ev) => {
      pindahPandang(zumDi(ev.shiftKey ? 1 / 0.45 : 0.45, keDerajat(ev.clientX, ev.clientY)), 420)
    })

    svg.addEventListener('pointermove', (ev) => {
      if (seret || cubit) { sembunyikanTip(); return }
      const node = ev.target.closest('[data-unit]')
      if (node) tampilkanTip(node, ev)
      else sembunyikanTip()
    })
    svg.addEventListener('pointerleave', sembunyikanTip)

    wadah.addEventListener('keydown', (ev) => {
      if (ev.target !== wadah) return
      const [x, y, l, t] = keadaanPeta.pandang
      const arah = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      }[ev.key]
      if (arah) {
        ev.preventDefault()
        pindahPandang(dalamBatas([x + arah[0] * l * 0.16, y + arah[1] * t * 0.16, l]), 260)
        return
      }
      if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); pindahPandang(zumDi(0.6), 320) }
      else if (ev.key === '-' || ev.key === '_') { ev.preventDefault(); pindahPandang(zumDi(1 / 0.6), 320) }
      else if (ev.key === '0') { ev.preventDefault(); pindahPandang(PANDANG_AWAL()) }
    })

    // Batang skala dihitung dari lebar sebenarnya di layar, jadi ia harus
    // dihitung ulang setiap kali kotaknya berubah ukuran, termasuk saat laci
    // menu samping dibuka, yang tidak pernah menyentuh ukuran jendela.
    if (globalThis.ResizeObserver) {
      pengamatUkuran?.disconnect()
      pengamatUkuran = new ResizeObserver(() => perbaruiHud())
      pengamatUkuran.observe(wadah)
    }
  }

  /* ---------------------------------------------------------- penyimak */

  isi.addEventListener('change', (ev) => {
    const bidang = ev.target.dataset.saring
    if (!bidang) return
    keadaanPeta[bidang] = ev.target.value
    keadaanPeta.dipilih = null

    /*
       Memilih satu kantor wilayah memperbesar peta ke wilayah itu.

       Menyaring tanpa memperbesar berarti pembacanya melihat seluruh Indonesia
       dengan sebagian besar titiknya lenyap: yang terbaca sebagai peta yang
       rusak, bukan sebagai peta yang disaring.
    */
    const tujuan = bidang === 'kanwil'
      ? pandangMemuat(keadaanPeta.unit.filter((u) => u.kanwil === ev.target.value))
      : null

    gambar()
    if (tujuan) pindahPandang(tujuan)
  })

  /*
     Mengetik tidak menggambar ulang halaman.

     Kalau kotak carinya ikut dibuang dan dibuat lagi setiap huruf, fokus dan
     letak kursor teksnya hilang bersamanya, dan mengetik kata kedua menjadi
     mustahil. Yang berubah hanya kelas pada titik dan isi panel samping.
  */
  let jedaCari = null
  isi.addEventListener('input', (ev) => {
    if (ev.target.dataset.peran !== 'cari-peta') return
    const nilai = ev.target.value
    clearTimeout(jedaCari)
    jedaCari = setTimeout(() => {
      keadaanPeta.cari = nilai
      keadaanPeta.dipilih = null
      terapkanCari()
      perbaruiCincin()
      gambarPanel()

      // Pencarian yang menyisakan sedikit unit membawa petanya ke sana. Yang
      // menyisakan banyak dibiarkan: memperbesar ke kotak yang memuat Aceh dan
      // Papua sekaligus sama saja dengan tidak memperbesar.
      const cocok = tampil.filter(cocokCari)
      if (nilai.trim() && cocok.length && cocok.length <= 12) pindahPandang(pandangMemuat(cocok, 1.6))
      else if (!nilai.trim()) pindahPandang(PANDANG_AWAL())
    }, 200)
  })

  isi.addEventListener('click', (ev) => {
    const titikUnit = ev.target.closest('[data-unit]')
    if (titikUnit) { pilih(titikUnit.dataset.unit); return }

    const tingkat = ev.target.closest('[data-tingkat]')?.dataset.tingkat
    if (tingkat) {
      if (keadaanPeta.sembunyi.has(tingkat)) keadaanPeta.sembunyi.delete(tingkat)
      else keadaanPeta.sembunyi.add(tingkat)
      gambar()
      return
    }

    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (aksi === 'perbesar') pindahPandang(zumDi(0.6), 380)
    else if (aksi === 'perkecil') pindahPandang(zumDi(1 / 0.6), 380)
    else if (aksi === 'pandang-awal') {
      keadaanPeta.kanwil = 'Seluruh Indonesia'
      gambar()
      pindahPandang(PANDANG_AWAL())
    } else if (aksi === 'tutup-unit') {
      keadaanPeta.dipilih = null
      perbaruiCincin()
      gambarPanel()
    } else if (aksi === 'zum-unit') {
      const u = tampil.find((x) => x.nama === keadaanPeta.dipilih)
      if (u) pindahPandang(pandangDiTitik(u.lon, -u.lat, 2.6))
    } else if (aksi === 'hanya-bermasalah') {
      keadaanPeta.hanyaBermasalah = !keadaanPeta.hanyaBermasalah
      gambar()
    }
  })

  // Menunjuk satu baris pada panel menyalakan titiknya di peta. Tanpa itu,
  // daftar unit paling disorot tidak pernah terhubung dengan letaknya.
  isi.addEventListener('pointerover', (ev) => {
    const barisDaftar = ev.target.closest('.peta-daftar button[data-unit]')
    if (!barisDaftar) return
    const svg = svgnya()
    if (!svg) return
    for (const c of svg.querySelectorAll('.peta-titik circle.tunjuk')) c.classList.remove('tunjuk')
    titikNode(barisDaftar.dataset.unit)?.classList.add('tunjuk')
  })

  isi.addEventListener('pointerout', (ev) => {
    if (!ev.target.closest('.peta-daftar button[data-unit]')) return
    for (const c of svgnya()?.querySelectorAll('.peta-titik circle.tunjuk') || []) {
      c.classList.remove('tunjuk')
    }
  })

  // Titik dapat dicapai papan tik, jadi ia juga harus bisa dibuka dengannya.
  isi.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && keadaanPeta.dipilih) {
      keadaanPeta.dipilih = null
      perbaruiCincin()
      gambarPanel()
      return
    }
    if (ev.key !== 'Enter' && ev.key !== ' ') return
    const titikUnit = ev.target.closest('[data-unit]')
    if (!titikUnit) return
    ev.preventDefault()
    pilih(titikUnit.dataset.unit)
  })

  /* -------------------------------------------------------------- muat */

  async function muat() {
    // Data induk sudah ada dari kunjungan sebelumnya, dan gambar() di bawah
    // sudah menampilkannya. Menggambar sekali lagi di sini hanya membuang
    // sapuan mekar yang baru saja dimulai oleh gambar() itu.
    if (keadaanPeta.dimuat) return

    if (keadaan.demo) {
      /*
         Potret koordinat dimuat hanya di mode peragaan, dan dimuat secara
         dinamis supaya peramban petugas tidak pernah mengunduhnya pada
         penggelaran sungguhan.
      */
      const { UNIT_CONTOH } = await import('../lib/peta-upt-contoh.js')
      keadaanPeta.unit = UNIT_CONTOH.map(([nama, jenis, kanwil, provinsi, , lat, lon]) =>
        ({ nama, jenis, kanwil, provinsi, lat, lon }))
      keadaanPeta.dimuat = true
      gambar()
      perbaruiSubjudul()
      return
    }

    try {
      const baris = await ambil('upt', {
        select: 'nama_upt,jenis_upt,kanwil,provinsi,latitude,longitude',
        aktif: 'eq.true',
        limit: 1000,
      }) || []

      keadaanPeta.unit = baris
        .filter((u) => u.latitude != null && u.longitude != null)
        .map((u) => ({
          nama: u.nama_upt,
          jenis: u.jenis_upt,
          kanwil: u.kanwil,
          provinsi: u.provinsi,
          lat: Number(u.latitude),
          lon: Number(u.longitude),
        }))

      if (!keadaanPeta.unit.length) {
        roti('Data induk unit terbaca kosong. Peta digambar tanpa titik.', 'sedang', 6000)
      }
    } catch (galat) {
      keadaanPeta.galat = pesanRamah(galat)
    }

    keadaanPeta.dimuat = true
    gambar()
    perbaruiSubjudul()
  }

  /**
   * Memperbarui keterangan di bilah kepala sesudah data induk termuat.
   *
   * Kerangka layar menanyakan judul dan keterangannya sekali, pada saat halaman
   * dibangun, dan pada saat itu data induk belum sampai. Tanpa pembaruan ini,
   * bilahnya akan terus berbunyi "Memuat data induk unit..." sekalipun 531 titik
   * sudah tergambar di bawahnya.
   */
  function perbaruiSubjudul() {
    const bilah = document.getElementById('bilah-sub')
    if (bilah) bilah.textContent = subjudul()
  }

  function subjudul() {
    const jumlah = keadaanPeta.unit.length
    return jumlah
      ? `${angka(jumlah)} Lapas, Rutan, dan LPKA di seluruh Indonesia`
      : 'Memuat data induk unit\u2026'
  }

  gambar()
  muat()

  return { judul: 'Peta Sebaran', sub: subjudul() }
}
