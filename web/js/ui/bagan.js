/**
 * Bagan. Digambar sebagai SVG langsung, tanpa pustaka apa pun.
 *
 * Aturan warna yang dipakai di sini:
 *
 *   Urgensi bersifat berurut (Rendah → Kritis), jadi diberi satu rona yang
 *   menua dari terang ke gelap. Empat rona berbeda untuk sesuatu yang berurut
 *   akan menyesatkan mata: pembaca akan mengira keempatnya setara.
 *
 *   Sentimen bersifat kutub (Positif ↔ Negatif), jadi diberi skala menyebar:
 *   dua rona berlawanan dengan abu-abu netral di tengah.
 *
 *   Jumlah per kategori bersifat besaran, jadi diberi satu rona bertingkat.
 *
 * Palet menyebar untuk mode gelap sudah diuji dengan validator: pemisahan CVD
 * ΔE 12,0 dan pemisahan penglihatan normal ΔE 17,5, keduanya lulus, dan seluruh
 * langkah mencapai kontras minimal 3:1 terhadap permukaan gelap. Dua peringatan
 * yang tersisa dari validator — pita terang dan lantai kroma — memang tidak
 * berlaku di sini, karena keduanya menguji palet kategoris, sedangkan abu-abu
 * di tengah skala menyebar justru wajib terbaca sebagai abu-abu.
 */

const NS = 'http://www.w3.org/2000/svg'

/** Membaca token warna dari CSS supaya bagan ikut berganti saat tema berganti. */
function token(nama, cadangan) {
  const nilai = getComputedStyle(document.documentElement).getPropertyValue(nama).trim()
  return nilai || cadangan
}

function gelap() {
  const stempel = document.documentElement.dataset.tema
  if (stempel === 'gelap') return true
  if (stempel === 'terang') return false
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

/**
 * Warna per ember sentimen, bukan per nilai basis data.
 *
 * Dulu "Campuran" punya warnanya sendiri di donat ini, sehingga pembaca melihat
 * empat golongan sementara keputusan analis hanya mengenal tiga. Kuncinya
 * sekarang kode ember dari lib/sentimen.js.
 */
export function paletSentimen() {
  return gelap()
    ? { positif: '#2FBF97', netral: '#79859A', belum: '#5C6674', negatif: '#FA7C6A' }
    : { positif: '#1F6B50', netral: '#7C8798', belum: '#A8B0BC', negatif: '#8E1B14' }
}

export function paletUrgensi() {
  return gelap()
    ? { Rendah: '#8C4A2E', Sedang: '#B36A42', Tinggi: '#D18F63', Kritis: '#F0A894' }
    : { Rendah: '#D9A183', Sedang: '#C0754A', Tinggi: '#9E4E22', Kritis: '#762012' }
}

function el(nama, sifat = {}, isi = []) {
  const n = document.createElementNS(NS, nama)
  for (const [k, v] of Object.entries(sifat)) {
    if (v === undefined || v === null) continue
    n.setAttribute(k, String(v))
  }
  for (const anak of [].concat(isi)) {
    n.appendChild(typeof anak === 'string' ? document.createTextNode(anak) : anak)
  }
  return n
}

function jalurHalus(titik) {
  if (titik.length < 2) return ''
  let d = `M ${titik[0][0]} ${titik[0][1]}`
  for (let i = 1; i < titik.length; i++) {
    const [x0, y0] = titik[i - 1]
    const [x1, y1] = titik[i]
    const dx = (x1 - x0) * 0.4
    d += ` C ${x0 + dx} ${y0}, ${x1 - dx} ${y1}, ${x1} ${y1}`
  }
  return d
}

/* ------------------------------------------------------- petunjuk melayang */

function pasangPetunjuk(wadah) {
  let kotak = wadah.querySelector('.petunjuk')
  if (!kotak) {
    kotak = document.createElement('div')
    kotak.className = 'petunjuk'
    kotak.style.cssText = `
      position:absolute; pointer-events:none; opacity:0; z-index:6;
      background:var(--surface-2); border:1px solid var(--line);
      border-radius:var(--r-2); box-shadow:var(--bayang-2);
      padding:7px 9px; font-size:12px; min-width:120px;
      transition:opacity 90ms linear;`
    wadah.appendChild(kotak)
  }
  return kotak
}

function tampilkanPetunjuk(wadah, kotak, x, y, html) {
  kotak.innerHTML = html
  kotak.style.opacity = '1'
  const lebar = kotak.offsetWidth
  const batas = wadah.clientWidth
  kotak.style.left = `${Math.min(Math.max(6, x - lebar / 2), batas - lebar - 6)}px`
  kotak.style.top = `${Math.max(6, y - kotak.offsetHeight - 12)}px`
}

/* ------------------------------------------------------- 1. Tren dua deret */

/**
 * Deret waktu dua garis: total berita dan berita bersentimen negatif.
 * Bukan dua sumbu — keduanya menghitung hal yang sama, yaitu jumlah berita,
 * jadi satu sumbu sudah benar dan perbandingannya jujur.
 */
export function baganTren(wadah, deret, opsi = {}) {
  wadah.innerHTML = ''
  wadah.style.position = 'relative'

  const L = 520, T = 170
  const kiri = 34, kanan = 10, atas = 14, bawah = 24
  const lebar = L - kiri - kanan
  const tinggi = T - atas - bawah

  const maks = Math.max(4, ...deret.map((d) => d.total)) * 1.15
  const x = (i) => kiri + (deret.length === 1 ? lebar / 2 : (i / (deret.length - 1)) * lebar)
  const y = (v) => atas + tinggi - (v / maks) * tinggi

  const warnaTotal = token('--accent', '#1D3E6E')
  const warnaNegatif = gelap() ? '#FA7C6A' : '#8E1B14'

  const svg = el('svg', {
    class: 'bagan', viewBox: `0 0 ${L} ${T}`,
    role: 'img', 'aria-label': opsi.label || 'Tren jumlah berita empat belas hari terakhir',
  })

  // Kisi mendatar — sengaja samar, tugasnya menuntun mata, bukan menarik mata.
  for (let i = 0; i <= 3; i++) {
    const gy = atas + (tinggi / 3) * i
    svg.appendChild(el('line', { class: 'kisi-garis', x1: kiri, x2: L - kanan, y1: gy, y2: gy }))
    svg.appendChild(el('text', { class: 'label', x: kiri - 6, y: gy + 3, 'text-anchor': 'end' },
      String(Math.round(maks - (maks / 3) * i))))
  }

  const titikTotal = deret.map((d, i) => [x(i), y(d.total)])
  const titikNegatif = deret.map((d, i) => [x(i), y(d.negatif)])

  svg.appendChild(el('path', {
    class: 'isi-area', fill: warnaTotal,
    d: `${jalurHalus(titikTotal)} L ${x(deret.length - 1)} ${atas + tinggi} L ${x(0)} ${atas + tinggi} Z`,
  }))
  svg.appendChild(el('path', { class: 'garis', stroke: warnaTotal, d: jalurHalus(titikTotal) }))
  svg.appendChild(el('path', {
    class: 'garis', stroke: warnaNegatif, 'stroke-dasharray': '4 3', d: jalurHalus(titikNegatif),
  }))

  // Titik akhir ditebalkan: nilai terkini adalah yang paling sering dicari.
  const akhir = deret.length - 1
  svg.appendChild(el('circle', { class: 'titik-akhir', cx: x(akhir), cy: y(deret[akhir].total), r: 4, fill: warnaTotal }))
  svg.appendChild(el('circle', { class: 'titik-akhir', cx: x(akhir), cy: y(deret[akhir].negatif), r: 4, fill: warnaNegatif }))

  // Label sumbu waktu hanya di ujung dan tengah, supaya tidak bertumpuk.
  for (const i of [0, Math.floor(akhir / 2), akhir]) {
    const t = deret[i].tanggal.slice(8) + '/' + deret[i].tanggal.slice(5, 7)
    svg.appendChild(el('text', {
      class: 'label', x: x(i), y: T - 6,
      'text-anchor': i === 0 ? 'start' : i === akhir ? 'end' : 'middle',
    }, t))
  }

  const bidik = el('line', {
    x1: 0, x2: 0, y1: atas, y2: atas + tinggi,
    stroke: token('--ink-4', '#8A94A3'), 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0,
  })
  svg.appendChild(bidik)
  svg.appendChild(el('rect', { x: kiri, y: atas, width: lebar, height: tinggi, fill: 'transparent', class: 'bidang-bidik' }))

  wadah.appendChild(svg)
  const kotak = pasangPetunjuk(wadah)

  svg.addEventListener('mousemove', (ev) => {
    const kotakSvg = svg.getBoundingClientRect()
    const rel = ((ev.clientX - kotakSvg.left) / kotakSvg.width) * L
    if (rel < kiri - 6 || rel > L - kanan + 6) return
    const i = Math.round(((rel - kiri) / lebar) * (deret.length - 1))
    const d = deret[Math.min(Math.max(i, 0), deret.length - 1)]
    bidik.setAttribute('x1', x(i)); bidik.setAttribute('x2', x(i)); bidik.setAttribute('opacity', '1')
    tampilkanPetunjuk(
      wadah, kotak,
      (x(i) / L) * kotakSvg.width, (y(d.total) / T) * kotakSvg.height,
      `<div style="font-weight:600;margin-bottom:3px">${d.tanggal.split('-').reverse().join('/')}</div>
       <div style="display:flex;gap:6px;align-items:center"><i style="width:8px;height:8px;border-radius:2px;background:${warnaTotal};display:inline-block"></i> Total <b style="margin-left:auto">${d.total}</b></div>
       <div style="display:flex;gap:6px;align-items:center"><i style="width:8px;height:8px;border-radius:2px;background:${warnaNegatif};display:inline-block"></i> Negatif <b style="margin-left:auto">${d.negatif}</b></div>`,
    )
  })
  svg.addEventListener('mouseleave', () => {
    bidik.setAttribute('opacity', '0')
    kotak.style.opacity = '0'
  })

  return { warnaTotal, warnaNegatif }
}

/* ------------------------------------------------- 2. Donat sentimen kutub */

export function baganSentimen(wadah, data) {
  wadah.innerHTML = ''
  wadah.style.position = 'relative'

  const palet = paletSentimen()
  // Data datang sudah berbentuk ember: { kode, label, jumlah }.
  const butir = (data || []).filter((b) => b.jumlah > 0)

  const total = butir.reduce((a, b) => a + b.jumlah, 0)
  if (!total) { wadah.innerHTML = '<p class="samar-teks kecil-teks">Belum ada data sentimen.</p>'; return }

  const S = 168, r = 66, tebal = 17, pusat = S / 2
  const svg = el('svg', { class: 'bagan', viewBox: `0 0 ${S} ${S}`, style: 'max-width:190px', role: 'img', 'aria-label': 'Sebaran sentimen pemberitaan' })

  let sudut = -Math.PI / 2
  const celah = 0.028 // pemisah 2px antar potongan, dalam radian

  for (const b of butir) {
    const lebarSudut = (b.jumlah / total) * Math.PI * 2
    const a0 = sudut + celah / 2
    const a1 = sudut + lebarSudut - celah / 2
    sudut += lebarSudut
    if (a1 <= a0) continue

    const besar = a1 - a0 > Math.PI ? 1 : 0
    const d = [
      `M ${pusat + r * Math.cos(a0)} ${pusat + r * Math.sin(a0)}`,
      `A ${r} ${r} 0 ${besar} 1 ${pusat + r * Math.cos(a1)} ${pusat + r * Math.sin(a1)}`,
    ].join(' ')

    const busur = el('path', {
      class: 'busur',
      d, fill: 'none', stroke: palet[b.kode], 'stroke-width': tebal, 'stroke-linecap': 'butt',
      style: 'transition:stroke-width 120ms',
    })
    busur.addEventListener('mouseenter', () => busur.setAttribute('stroke-width', tebal + 4))
    busur.addEventListener('mouseleave', () => busur.setAttribute('stroke-width', tebal))
    busur.appendChild(el('title', {}, `${b.label}: ${b.jumlah} berita (${((b.jumlah / total) * 100).toFixed(1)}%)`))
    svg.appendChild(busur)
  }

  svg.appendChild(el('text', {
    x: pusat, y: pusat - 2, 'text-anchor': 'middle',
    style: `font-family:var(--disp);font-weight:700;font-size:26px;fill:${token('--ink', '#151A21')};letter-spacing:-0.03em`,
  }, String(total)))
  svg.appendChild(el('text', {
    x: pusat, y: pusat + 14, 'text-anchor': 'middle',
    style: `font-family:var(--mono);font-size:9px;letter-spacing:0.1em;fill:${token('--ink-4', '#8A94A3')}`,
  }, 'BERITA'))

  const bungkus = document.createElement('div')
  bungkus.style.cssText = 'display:flex;align-items:center;gap:18px;flex-wrap:wrap'
  bungkus.appendChild(svg)

  // Legenda merangkap label langsung: identitas tidak pernah bergantung warna saja.
  const legenda = document.createElement('dl')
  legenda.style.cssText = 'margin:0;display:flex;flex-direction:column;gap:6px;flex:1;min-width:130px'
  for (const b of butir) {
    const baris = document.createElement('div')
    baris.style.cssText = 'display:flex;align-items:center;gap:7px;font-size:12.5px'
    baris.innerHTML = `
      <i style="width:9px;height:9px;border-radius:2px;background:${palet[b.kode]};flex:none"></i>
      <span>${b.label}</span>
      <b class="angka" style="margin-left:auto">${b.jumlah}</b>
      <span class="mini-teks samar-teks" style="width:44px;text-align:right">${((b.jumlah / total) * 100).toFixed(1).replace('.', ',')}%</span>`
    legenda.appendChild(baris)
  }
  bungkus.appendChild(legenda)
  wadah.appendChild(bungkus)
}

/* ------------------------------------------ 3. Batang besaran per kategori */

export function baganBatang(wadah, data, opsi = {}) {
  wadah.innerHTML = ''
  const butir = data.slice(0, opsi.maks || 8)
  if (!butir.length) { wadah.innerHTML = '<p class="samar-teks kecil-teks">Belum ada data.</p>'; return }

  const maks = Math.max(...butir.map((b) => b.jumlah))
  const dasar = token('--accent', '#1D3E6E')

  const daftar = document.createElement('div')
  daftar.style.cssText = 'display:flex;flex-direction:column;gap:9px'

  butir.forEach((b, i) => {
    // Satu rona, menua sesuai peringkat. Besaran adalah skala bertingkat,
    // bukan sekumpulan identitas yang setara.
    const kepekatan = 1 - (i / Math.max(butir.length, 1)) * 0.55
    const baris = document.createElement('div')
    baris.innerHTML = `
      <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:3px">
        <span style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${b.label}</span>
        <b class="angka" style="margin-left:auto;font-size:12.5px">${b.jumlah}</b>
      </div>
      <div class="bar-lacak" style="height:7px;border-radius:3px;background:var(--line-3);overflow:hidden">
        <div class="bar-isi" style="height:100%;--lebar:${((b.jumlah / maks) * 100).toFixed(2)}%;background:${dasar};opacity:${kepekatan.toFixed(2)};border-radius:3px"></div>
      </div>`
    baris.title = `${b.label}: ${b.jumlah} berita`
    daftar.appendChild(baris)
  })

  wadah.appendChild(daftar)
}

/* ---------------------------------------------- 4. Pita urgensi bertingkat */

export function baganUrgensi(wadah, data) {
  wadah.innerHTML = ''
  const palet = paletUrgensi()
  const urutan = ['Kritis', 'Tinggi', 'Sedang', 'Rendah']
  const butir = urutan
    .map((k) => ({ label: k, jumlah: data.find((d) => d.label === k)?.jumlah || 0 }))
    .filter((b) => b.jumlah > 0)
  const total = butir.reduce((a, b) => a + b.jumlah, 0)
  if (!total) { wadah.innerHTML = '<p class="samar-teks kecil-teks">Belum ada data urgensi.</p>'; return }

  /*
     Bentuknya diubah dari empat angka berjajar menjadi empat baris bertingkat.
     Alasannya bukan selera. Empat tingkat urgensi memakai empat warna yang
     berdekatan — merah, jingga, kuning tua, kelabu — dan pada pita setebal dua
     belas piksel keempatnya nyaris tidak terbedakan. Angkanya pun berdiri
     terpisah dari pitanya, sehingga membandingkan "berapa yang kritis" menuntut
     mata melompat bolak-balik antara warna dan angka.
     Sebagai baris, panjang batang menjawabnya tanpa warna sama sekali —
     dan warna kembali menjadi penegas, bukan satu-satunya pembawa arti.
  */

  const pita = document.createElement('div')
  pita.className = 'urgensi-pita'
  pita.setAttribute('role', 'img')
  pita.setAttribute('aria-label',
    `Bauran urgensi: ${butir.map((b) => `${b.label} ${b.jumlah}`).join(', ')}.`)
  for (const b of butir) {
    const potong = document.createElement('div')
    potong.className = 'pita-potong'
    potong.style.cssText = `flex:${b.jumlah};background:${palet[b.kode]}`
    potong.title = `${b.label}: ${b.jumlah} berita (${((b.jumlah / total) * 100).toFixed(1)}%)`
    pita.appendChild(potong)
  }
  wadah.appendChild(pita)

  const tertinggi = Math.max(...butir.map((b) => b.jumlah))

  const daftar = document.createElement('div')
  daftar.className = 'urgensi-daftar'
  for (const b of butir) {
    const persen = ((b.jumlah / total) * 100).toFixed(1).replace('.', ',')
    const sel = document.createElement('div')
    sel.className = 'urgensi-baris'
    sel.innerHTML = `
      <span class="urgensi-nama">
        <i style="background:${palet[b.kode]}"></i>${b.label}
      </span>
      <span class="urgensi-batang">
        <i style="width:${((b.jumlah / tertinggi) * 100).toFixed(1)}%;background:${palet[b.kode]}"></i>
      </span>
      <span class="urgensi-angka angka">${b.jumlah}<small>${persen}%</small></span>`
    daftar.appendChild(sel)
  }
  wadah.appendChild(daftar)
}

/* ------------------------------------------------------- 5. Garis kilat UPT */

/** Deret mini tanpa sumbu, untuk disisipkan di dalam baris tabel. */
export function garisKilat(nilai, opsi = {}) {
  const L = 74, T = 20
  const maks = Math.max(1, ...nilai)
  const titik = nilai.map((v, i) => [
    (i / Math.max(nilai.length - 1, 1)) * L,
    T - 2 - (v / maks) * (T - 4),
  ])
  const warna = opsi.warna || token('--accent', '#1D3E6E')
  return `<svg viewBox="0 0 ${L} ${T}" style="width:${L}px;height:${T}px;display:block" aria-hidden="true">
    <path d="${jalurHalus(titik)}" fill="none" stroke="${warna}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="${titik[titik.length - 1][0]}" cy="${titik[titik.length - 1][1]}" r="2.2" fill="${warna}"/>
  </svg>`
}
