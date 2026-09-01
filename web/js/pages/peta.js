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
 * Tiga keputusan yang menentukan isi berkas ini:
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
 */

import { kartu, keping, pesanSistem, tombol, roti } from '../ui/komponen.js'
import { amankan, angka, ringkas, jarakWaktu, nadaUrgensi } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, pesanRamah } from '../lib/api.js'
import { KERAWANAN, tingkatKerawanan, dasar } from '../lib/hitung.js'
import { ember } from '../lib/sentimen.js'
import { belumTerpetakan } from '../lib/pencocokan-upt.js'
import { BATAS, DARATAN, TETANGGA } from '../lib/peta-indonesia.js'

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
  /** Unit yang sedang dibuka pada panel samping. */
  dipilih: null,
  /** Kotak pandang SVG: [x, y, lebar, tinggi] dalam derajat. */
  pandang: null,
}

const PANDANG_AWAL = () => [
  BATAS.minLon - 0.6,
  -BATAS.maxLat - 0.6,
  (BATAS.maxLon - BATAS.minLon) + 1.2,
  (BATAS.maxLat - BATAS.minLat) + 1.2,
]

/* --------------------------------------------------------------- gambar */

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
  const skala = l / (BATAS.maxLon - BATAS.minLon)

  // Titik ikut mengecil saat diperbesar, tetapi tidak sebanding penuh: pada
  // perbesaran penuh, titik yang benar-benar sebanding akan lebih kecil
  // daripada kursor yang mengarahkannya.
  const jari = Math.max(0.055, 0.14 * Math.sqrt(skala))

  return `
    <svg class="peta-svg" viewBox="${x} ${y} ${l} ${t}" role="img"
         aria-label="Peta sebaran ${angka(titik.length)} unit pemasyarakatan di Indonesia"
         preserveAspectRatio="xMidYMid meet">
      <g class="peta-tetangga">
        ${TETANGGA.map((d) => `<path d="${balik(d)}"/>`).join('')}
      </g>
      <g class="peta-daratan">
        ${DARATAN.map((d) => `<path d="${balik(d)}"/>`).join('')}
      </g>
      <g class="peta-titik">
        ${titik.map((u) => `
          <circle cx="${u.lon}" cy="${-u.lat}" r="${jari}"
                  fill="${warna(u.tingkat.kode)}"
                  fill-opacity="${u.tingkat.kode === 'sepi' ? 0.42 : 0.92}"
                  stroke-width="${jari * 0.28}"
                  data-unit="${amankan(u.nama)}"
                  tabindex="0" role="button"
                  aria-label="${amankan(u.nama)} — ${amankan(u.tingkat.label)}, ${angka(u.berita.length)} berita">
            <title>${amankan(u.nama)} — ${amankan(u.tingkat.label)} · ${angka(u.berita.length)} berita</title>
          </circle>`).join('')}
      </g>
    </svg>`
}

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
    .filter((u) => !keadaanPeta.hanyaBermasalah
      || ['kritis', 'rawan', 'waspada'].includes(u.tingkat.kode))
}

/* --------------------------------------------------------------- bagian */

function legenda(titik) {
  return `
    <div class="peta-legenda">
      ${KERAWANAN.map((k) => {
        const jumlah = titik.filter((u) => u.tingkat.kode === k.kode).length
        return `
          <span class="peta-legenda-butir" title="${amankan(k.ket)}">
            <i style="background:${warna(k.kode)};opacity:${k.kode === 'sepi' ? 0.45 : 1}"></i>
            ${amankan(k.label)}
            <b class="angka">${angka(jumlah)}</b>
          </span>`
      }).join('')}
    </div>`
}

/** Panel samping: unit yang sedang dipilih, atau daftar yang paling gawat. */
function panelSamping(titik) {
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
      ${gawat.length ? `
        <ul class="peta-daftar">
          ${gawat.map((u) => `
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
        : `<p class="ket" style="padding:12px 2px">Tidak ada unit berkategori rawan atau kritis
           pada saringan ini. Itu keadaan yang baik — dan patut diperiksa ulang bila saringannya
           terlalu sempit.</p>`}
    </div>`
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

      <p class="ket" style="margin-top:14px">
        Koordinat: ${u.lat.toFixed(4)}, ${u.lon.toFixed(4)}
      </p>
    </div>`
}

/* -------------------------------------------------------------- halaman */

export function halamanPeta({ keadaan, isi }) {
  if (!keadaanPeta.pandang) keadaanPeta.pandang = PANDANG_AWAL()

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
    const titik = saringTitik(semua)
    const kanwilAda = [...new Set(semua.map((u) => u.kanwil).filter(Boolean))].sort()
    const takTerpetakan = (keadaan.berita || []).filter((b) => belumTerpetakan(b.nama_upt)).length

    isi.innerHTML = `
      <div class="tumpuk">
        <div class="bilah-alat">
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
              ${angka(titik.length)} dari ${angka(semua.length)} unit
            </span>
            ${tombol({ label: 'Perbesar', ikon: 'tambah', kecil: true, aksi: 'perbesar', judul: 'Perbesar peta' })}
            ${tombol({ label: 'Perkecil', ikon: 'kurang', kecil: true, aksi: 'perkecil', judul: 'Perkecil peta' })}
            ${tombol({ label: 'Seluruh Indonesia', ikon: 'peta', kecil: true, aksi: 'pandang-awal' })}
          </div>
        </div>

        <div class="peta-tata">
          ${kartu({
            rapat: true,
            isi: `
              <div class="peta-wadah" id="peta-wadah">
                ${svgPeta(titik)}
              </div>
              ${legenda(titik)}
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
          ${panelSamping(titik)}
        </div>
      </div>`

    pasangGeser()
  }

  /* ----------------------------------------------------------- pandang */

  /** Memperbesar atau memperkecil dari titik tengah kotak pandang. */
  function ubahPandang(faktor) {
    const [x, y, l, t] = keadaanPeta.pandang
    const penuh = PANDANG_AWAL()
    const lebarBaru = Math.min(penuh[2], Math.max(2, l * faktor))
    const tinggiBaru = lebarBaru * (t / l)

    // Titik tengah dipertahankan, lalu dikembalikan ke dalam batas peta —
    // memperkecil dari tepi tidak boleh menggeser Indonesia keluar layar.
    const tengahX = x + l / 2
    const tengahY = y + t / 2
    const batasX = Math.min(Math.max(tengahX - lebarBaru / 2, penuh[0]), penuh[0] + penuh[2] - lebarBaru)
    const batasY = Math.min(Math.max(tengahY - tinggiBaru / 2, penuh[1]), penuh[1] + penuh[3] - tinggiBaru)

    keadaanPeta.pandang = [batasX, batasY, lebarBaru, tinggiBaru]
    gambar()
  }

  /**
   * Menggeser peta dengan seretan tetikus.
   *
   * Tanpa ini, memperbesar hanya berguna untuk daerah yang kebetulan berada di
   * tengah — dan seluruh Indonesia timur tidak pernah bisa dilihat dari dekat.
   */
  function pasangGeser() {
    const svg = isi.querySelector('.peta-svg')
    if (!svg) return

    let seret = null

    svg.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('[data-unit]')) return
      seret = { x: ev.clientX, y: ev.clientY, pandang: [...keadaanPeta.pandang] }
      svg.setPointerCapture(ev.pointerId)
      svg.classList.add('menyeret')
    })

    svg.addEventListener('pointermove', (ev) => {
      if (!seret) return
      const kotak = svg.getBoundingClientRect()
      const [, , l, t] = seret.pandang
      const geserX = ((ev.clientX - seret.x) / kotak.width) * l
      const geserY = ((ev.clientY - seret.y) / kotak.height) * t
      const penuh = PANDANG_AWAL()
      keadaanPeta.pandang = [
        Math.min(Math.max(seret.pandang[0] - geserX, penuh[0]), penuh[0] + penuh[2] - l),
        Math.min(Math.max(seret.pandang[1] - geserY, penuh[1]), penuh[1] + penuh[3] - t),
        l, t,
      ]
      svg.setAttribute('viewBox', keadaanPeta.pandang.join(' '))
    })

    const lepas = (ev) => {
      if (!seret) return
      seret = null
      svg.classList.remove('menyeret')
      try { svg.releasePointerCapture(ev.pointerId) } catch { /* penunjuk sudah dilepas */ }
    }
    svg.addEventListener('pointerup', lepas)
    svg.addEventListener('pointercancel', lepas)
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
       dengan sebagian besar titiknya lenyap — yang terbaca sebagai peta yang
       rusak, bukan sebagai peta yang disaring.
    */
    if (bidang === 'kanwil') keadaanPeta.pandang = pandangUntukKanwil(ev.target.value)
    gambar()
  })

  /** Kotak pandang yang memuat seluruh unit sebuah kantor wilayah, dengan tepi. */
  function pandangUntukKanwil(kanwil) {
    if (kanwil.startsWith('Seluruh')) return PANDANG_AWAL()

    const milik = keadaanPeta.unit.filter((u) => u.kanwil === kanwil)
    if (!milik.length) return PANDANG_AWAL()

    const lon = milik.map((u) => u.lon)
    const lat = milik.map((u) => -u.lat)
    const tepi = 1.2
    const x = Math.min(...lon) - tepi
    const y = Math.min(...lat) - tepi
    // Kotak yang terlalu sempit membuat satu wilayah berisi satu unit
    // diperbesar sampai daratannya hilang sama sekali dari layar.
    const l = Math.max(3, Math.max(...lon) - Math.min(...lon) + tepi * 2)
    const t = Math.max(2.4, Math.max(...lat) - Math.min(...lat) + tepi * 2)
    return [x, y, l, t]
  }

  isi.addEventListener('click', (ev) => {
    const titikUnit = ev.target.closest('[data-unit]')
    if (titikUnit) {
      keadaanPeta.dipilih = titikUnit.dataset.unit
      gambar()
      return
    }

    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (aksi === 'perbesar') ubahPandang(0.6)
    else if (aksi === 'perkecil') ubahPandang(1 / 0.6)
    else if (aksi === 'pandang-awal') {
      keadaanPeta.pandang = PANDANG_AWAL()
      keadaanPeta.kanwil = 'Seluruh Indonesia'
      gambar()
    } else if (aksi === 'tutup-unit') {
      keadaanPeta.dipilih = null
      gambar()
    } else if (aksi === 'hanya-bermasalah') {
      keadaanPeta.hanyaBermasalah = !keadaanPeta.hanyaBermasalah
      gambar()
    }
  })

  // Titik dapat dicapai papan tik, jadi ia juga harus bisa dibuka dengannya.
  isi.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return
    const titikUnit = ev.target.closest('[data-unit]')
    if (!titikUnit) return
    ev.preventDefault()
    keadaanPeta.dipilih = titikUnit.dataset.unit
    gambar()
  })

  /* -------------------------------------------------------------- muat */

  async function muat() {
    if (keadaanPeta.dimuat) { gambar(); return }

    if (keadaan.demo) {
      /*
         Potret koordinat dimuat hanya di mode peragaan, dan dimuat secara
         dinamis supaya peramban petugas tidak pernah mengunduhnya pada
         penggelaran sungguhan.
      */
      const { UNIT_CONTOH } = await import('../lib/peta-upt-contoh.js')
      keadaanPeta.unit = UNIT_CONTOH.map(([nama, jenis, kanwil, provinsi, lat, lon]) =>
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
   * dibangun — dan pada saat itu data induk belum sampai. Tanpa pembaruan ini,
   * bilahnya akan terus berbunyi "Memuat data induk unit…" sekalipun 531 titik
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
      : 'Memuat data induk unit…'
  }

  gambar()
  muat()

  return { judul: 'Peta Sebaran', sub: subjudul() }
}
