/**
 * Penggambar lembar infografis, sebagai SVG.
 *
 * KENAPA SVG, DAN KENAPA SATU BERKAS UNTUK TIGA KELUARAN
 *
 * Lembar ini harus muncul di tiga tempat: di layar, sebagai PNG yang
 * dibagikan di grup, dan tercetak. HTML biasa tidak bisa menjadi PNG tanpa
 * pustaka luar; canvas bisa, tetapi tulisannya menjadi piksel dan tidak bisa
 * dipilih maupun dicetak tajam. SVG memenuhi ketiganya sekaligus: ia HTML yang
 * sah di layar, ia bisa dirasterkan ke canvas oleh peramban sendiri tanpa satu
 * baris pun kode pihak ketiga, dan ia tetap vektor ketika dicetak.
 *
 * Satuannya piksel di dalam viewBox tetap 1600 × 1131 — perbandingan A4
 * lanskap. Dengan begitu lembar yang sama, tanpa penyesuaian apa pun, memenuhi
 * kertas ketika dicetak dan memenuhi layar ketika dilihat.
 *
 * YANG SENGAJA TIDAK ADA DI SINI
 *
 * Tidak ada satu pun angka yang dihitung di berkas ini. Seluruhnya datang dari
 * model yang disusun lib/infografis.js. Kalau sebuah panel butuh angka yang
 * belum ada di model, yang benar adalah menambahkannya di sana — bukan
 * menghitungnya di tengah penggambaran, tempat tidak ada satu pun uji yang
 * bisa menangkapnya bila salah.
 *
 * Tidak ada pula ketergantungan pada DOM: fungsi di sini mengembalikan teks.
 * Itu yang membuatnya bisa diuji di Node tanpa peramban, dan itu yang membuat
 * tata letaknya bisa dipinjam penyusun PDF di Edge Function.
 */

import { TATA, WARNA, IKON_TEMA, LAMBANG } from './infografis-tata.js'

/* --------------------------------------------------------------- pembantu */

/** Lima aksara yang harus dilepas agar SVG tetap sah. */
export function lepas(nilai) {
  return String(nilai ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Lebar teks, diterka dari jumlah aksaranya.
 *
 * SVG tidak bisa mengukur teks sebelum digambar, dan lembar ini disusun juga
 * di Edge Function yang tidak punya peramban sama sekali. Yang dipakai karena
 * itu tabel lebar rata-rata per aksara — bukan pengukuran sebenarnya.
 *
 * Angkanya sengaja dilebihkan sedikit. Terkaan yang terlalu kecil membuat
 * judul menabrak panel sebelahnya; terkaan yang terlalu besar hanya membuat
 * judul dipotong satu kata lebih awal. Yang pertama merusak lembar, yang kedua
 * tidak.
 */
export function lebarTeks(teks, ukuran, tebal = false) {
  const s = String(teks ?? '')
  let satuan = 0
  for (const ch of s) {
    if (/[ilj.,:;'|!\[\]()]/.test(ch)) satuan += 0.30
    else if (/[A-Z0-9]/.test(ch)) satuan += 0.62
    else if (/[mwMW]/.test(ch)) satuan += 0.88
    else if (ch === ' ') satuan += 0.28
    else satuan += 0.53
  }
  return satuan * ukuran * (tebal ? 1.06 : 1)
}

/** Memotong pada batas kata, dengan elipsis bila perlu. */
export function potong(teks, lebarMaks, ukuran, tebal = false) {
  const s = String(teks ?? '').replace(/\s+/g, ' ').trim()
  if (!s || lebarTeks(s, ukuran, tebal) <= lebarMaks) return s
  const kata = s.split(' ')
  let hasil = ''
  for (const k of kata) {
    const coba = hasil ? `${hasil} ${k}` : k
    if (lebarTeks(`${coba}…`, ukuran, tebal) > lebarMaks) break
    hasil = coba
  }
  if (!hasil) {
    // Satu kata pun tidak muat. Dipotong per aksara supaya panel tidak kosong.
    let potongan = ''
    for (const ch of s) {
      if (lebarTeks(`${potongan}${ch}…`, ukuran, tebal) > lebarMaks) break
      potongan += ch
    }
    return potongan ? `${potongan}…` : ''
  }
  return `${hasil}…`
}

/** Membagi teks menjadi beberapa baris yang muat, paling banyak `maksBaris`. */
export function baris(teks, lebarMaks, ukuran, maksBaris = 2, tebal = false) {
  const s = String(teks ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return []
  const kata = s.split(' ')
  const hasil = []
  let kini = ''
  for (const k of kata) {
    const coba = kini ? `${kini} ${k}` : k
    if (lebarTeks(coba, ukuran, tebal) <= lebarMaks) { kini = coba; continue }
    if (kini) hasil.push(kini)
    kini = k
    if (hasil.length === maksBaris - 1) break
  }
  if (hasil.length < maksBaris && kini) {
    const sisa = kata.slice(hasil.join(' ').split(' ').filter(Boolean).length).join(' ')
    hasil.push(hasil.length === maksBaris - 1 ? potong(sisa || kini, lebarMaks, ukuran, tebal) : kini)
  }
  return hasil.slice(0, maksBaris)
}

/** Persegi bersudut tumpul. */
export function kotak(x, y, l, t, r, isi, opsi = {}) {
  const garis = opsi.garis ? ` stroke="${opsi.garis}" stroke-width="${opsi.tebalGaris ?? 1}"` : ''
  const buram = opsi.buram != null ? ` opacity="${opsi.buram}"` : ''
  return `<rect x="${bulat(x)}" y="${bulat(y)}" width="${bulat(l)}" height="${bulat(t)}" rx="${r}" fill="${isi}"${garis}${buram}/>`
}

/** Satu baris teks. */
export function teks(x, y, isi, opsi = {}) {
  const {
    ukuran = 14, warna = WARNA.tinta, tebal = 400, rata = 'start',
    huruf = TATA.huruf.badan, spasi = 0, buram = null,
  } = opsi
  const a = rata === 'middle' ? 'middle' : rata === 'end' ? 'end' : 'start'
  const ls = spasi ? ` letter-spacing="${spasi}"` : ''
  const op = buram != null ? ` opacity="${buram}"` : ''
  return `<text x="${bulat(x)}" y="${bulat(y)}" font-family="${huruf}" font-size="${ukuran}"`
    + ` font-weight="${tebal}" fill="${warna}" text-anchor="${a}"${ls}${op}>${lepas(isi)}</text>`
}

function bulat(n) {
  return Number(Number(n || 0).toFixed(2))
}

/** Kepala panel bergaya lembar contoh: bilah gelap dengan judul putih di tengah. */
function kepalaPanel(x, y, l, judul, opsi = {}) {
  const t = opsi.tinggi ?? TATA.kepalaPanel
  return kotak(x, y, l, t, opsi.radius ?? 6, opsi.warna || WARNA.navy)
    + teks(x + l / 2, y + t / 2 + 5, judul, {
      ukuran: opsi.ukuran ?? 15, warna: '#ffffff', tebal: 700, rata: 'middle', spasi: 0.6,
    })
}

/* ------------------------------------------------------------------ donat */

/**
 * Satu potong cincin.
 *
 * Ditulis sendiri, bukan diambil dari pustaka bagan, karena yang dibutuhkan
 * hanya ini — dan karena penggambar ini juga harus berjalan di Edge Function,
 * tempat ui/bagan.js tidak ikut disalin.
 */
function potongCincin(cx, cy, jariLuar, jariDalam, mulai, selesai, isi) {
  // Satu potong yang mengisi seluruh lingkaran tidak bisa digambar dengan satu
  // busur: titik awal dan titik akhirnya berimpit, dan jalurnya menjadi kosong.
  if (selesai - mulai >= Math.PI * 2 - 0.0001) {
    return `<path d="M${bulat(cx - jariLuar)} ${bulat(cy)}`
      + `A${jariLuar} ${jariLuar} 0 1 1 ${bulat(cx + jariLuar)} ${bulat(cy)}`
      + `A${jariLuar} ${jariLuar} 0 1 1 ${bulat(cx - jariLuar)} ${bulat(cy)}Z`
      + `M${bulat(cx - jariDalam)} ${bulat(cy)}`
      + `A${jariDalam} ${jariDalam} 0 1 0 ${bulat(cx + jariDalam)} ${bulat(cy)}`
      + `A${jariDalam} ${jariDalam} 0 1 0 ${bulat(cx - jariDalam)} ${bulat(cy)}Z"`
      + ` fill="${isi}" fill-rule="evenodd"/>`
  }
  const x1 = cx + jariLuar * Math.cos(mulai)
  const y1 = cy + jariLuar * Math.sin(mulai)
  const x2 = cx + jariLuar * Math.cos(selesai)
  const y2 = cy + jariLuar * Math.sin(selesai)
  const x3 = cx + jariDalam * Math.cos(selesai)
  const y3 = cy + jariDalam * Math.sin(selesai)
  const x4 = cx + jariDalam * Math.cos(mulai)
  const y4 = cy + jariDalam * Math.sin(mulai)
  const besar = selesai - mulai > Math.PI ? 1 : 0
  return `<path d="M${bulat(x1)} ${bulat(y1)}A${jariLuar} ${jariLuar} 0 ${besar} 1 ${bulat(x2)} ${bulat(y2)}`
    + `L${bulat(x3)} ${bulat(y3)}A${jariDalam} ${jariDalam} 0 ${besar} 0 ${bulat(x4)} ${bulat(y4)}Z"`
    + ` fill="${isi}"/>`
}

/* ------------------------------------------------------------------- peta */

/**
 * Proyeksi silindris sederhana, sama seperti yang dipakai halaman Peta
 * Sebaran: bujur menjadi X, lintang menjadi Y yang dibalik. Untuk kepulauan
 * yang membentang di khatulistiwa, kesalahannya di bawah setengah persen.
 */
function penProyeksi(batas, x, y, l, t) {
  const lebarDerajat = batas.maxLon - batas.minLon
  const tinggiDerajat = batas.maxLat - batas.minLat
  const skala = Math.min(l / lebarDerajat, t / tinggiDerajat)
  const geserX = x + (l - lebarDerajat * skala) / 2
  const geserY = y + (t - tinggiDerajat * skala) / 2
  return {
    skala,
    titik: (lon, lat) => [
      geserX + (lon - batas.minLon) * skala,
      geserY + (batas.maxLat - lat) * skala,
    ],
  }
}

/** Jalur derajat menjadi jalur piksel. */
function jalurKePiksel(d, proyeksi) {
  return String(d).replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g, (_, huruf, lon, lat) => {
    const [px, py] = proyeksi.titik(Number(lon), Number(lat))
    return `${huruf}${bulat(px)} ${bulat(py)}`
  })
}

/* ----------------------------------------------------------------- panel */

function panelKepala(m, x, y, l, t) {
  const bagian = []
  bagian.push(kotak(x, y, l, t, 8, WARNA.kartu, { garis: WARNA.garis }))

  // Lambang. Digambar, bukan ditempel — lembar ini juga disusun di peladen,
  // tempat tidak ada berkas gambar yang bisa dibaca.
  const lx = x + 26
  const ly = y + t / 2
  bagian.push(LAMBANG(lx, ly - 30, 60))

  const tx = lx + 78
  bagian.push(teks(tx, y + 40, 'MONITORING BERITA LAPAS & RUTAN', {
    ukuran: 30, tebal: 800, warna: WARNA.navy, huruf: TATA.huruf.judul, spasi: -0.3,
  }))
  bagian.push(teks(tx, y + 66, `PERIODE ${String(m.periode.label).toUpperCase()}`, {
    ukuran: 15, tebal: 700, warna: WARNA.biru, spasi: 0.8,
  }))

  const penjelas = m.jenis === 'harian'
    ? 'Ringkasan pemberitaan seputar Lembaga Pemasyarakatan (Lapas) dan Rumah Tahanan (Rutan)'
    : 'Ringkasan pemberitaan seputar Lembaga Pemasyarakatan (Lapas) dan Rumah Tahanan (Rutan)'
  const penjelas2 = m.jenis === 'harian'
    ? 'di seluruh Indonesia selama satu hari terakhir.'
    : 'di seluruh Indonesia selama satu pekan terakhir.'
  bagian.push(teks(tx, y + 90, penjelas, { ukuran: 12.5, warna: WARNA.redup }))
  bagian.push(teks(tx, y + 107, penjelas2, { ukuran: 12.5, warna: WARNA.redup }))

  return bagian.join('')
}

function panelSentimen(m, x, y, l, t) {
  const bagian = [kotak(x, y, l, t, 8, WARNA.kartu, { garis: WARNA.garis })]
  bagian.push(teks(x + l / 2, y + 26, 'DISTRIBUSI SENTIMEN', {
    ukuran: 14, tebal: 700, warna: WARNA.navy, rata: 'middle', spasi: 0.8,
  }))

  const s = m.sentimen
  const total = s.total || 1
  const potongan = [
    { nilai: s.positif, warna: WARNA.positif, label: 'Positif', persen: s.persen.positif },
    { nilai: s.netral, warna: WARNA.netral, label: 'Netral', persen: s.persen.netral },
    { nilai: s.negatif, warna: WARNA.negatif, label: 'Negatif', persen: s.persen.negatif },
    { nilai: s.belum, warna: WARNA.abu, label: 'Belum dinilai', persen: s.persen.belum },
  ].filter((p) => p.nilai > 0)

  const cx = x + l * 0.62
  const cy = y + t / 2 + 12
  const jariLuar = Math.min(t * 0.30, 62)
  const jariDalam = jariLuar * 0.58

  let sudut = -Math.PI / 2
  for (const p of potongan) {
    const lebar = (p.nilai / total) * Math.PI * 2
    bagian.push(potongCincin(cx, cy, jariLuar, jariDalam, sudut, sudut + lebar, p.warna))
    sudut += lebar
  }
  if (!potongan.length) {
    bagian.push(potongCincin(cx, cy, jariLuar, jariDalam, 0, Math.PI * 2, WARNA.abu))
  }

  // Angka terbesar ditulis besar di sebelah kiri cincin, persis seperti lembar
  // contoh: satu angka yang terbaca dari jauh, sisanya sebagai keterangan.
  const utama = potongan.slice().sort((a, b) => b.nilai - a.nilai)[0]
  if (utama) {
    bagian.push(teks(x + 18, cy - 4, `${utama.persen}%`, {
      ukuran: 30, tebal: 800, warna: utama.warna, huruf: TATA.huruf.judul,
    }))
    bagian.push(teks(x + 18, cy + 16, `${utama.nilai} berita`, { ukuran: 12.5, warna: WARNA.tinta }))
    bagian.push(teks(x + 18, cy + 33, utama.label, { ukuran: 12.5, tebal: 700, warna: utama.warna }))
  }

  // Sisanya sebagai daftar berpeluru di kanan cincin.
  const sisa = potongan.filter((p) => p !== utama)
  const dx = cx + jariLuar + 16
  let dy = cy - (sisa.length - 1) * 15 - 4
  for (const p of sisa) {
    bagian.push(`<circle cx="${bulat(dx)}" cy="${bulat(dy - 4)}" r="3.5" fill="${p.warna}"/>`)
    bagian.push(teks(dx + 10, dy, `${p.persen}%`, { ukuran: 13, tebal: 700, warna: p.warna }))
    bagian.push(teks(dx + 10, dy + 15, `${p.nilai} ${p.label}`, { ukuran: 11, warna: WARNA.redup }))
    dy += 34
  }
  return bagian.join('')
}

function panelMedia(m, x, y, l, t) {
  const bagian = [kotak(x, y, l, t, 8, WARNA.kartu, { garis: WARNA.garis })]
  bagian.push(teks(x + l / 2, y + 26, `TOP ${m.media.teratas.length} MEDIA`, {
    ukuran: 14, tebal: 700, warna: WARNA.navy, rata: 'middle', spasi: 0.8,
  }))

  const daftar = m.media.teratas.slice()
  if (m.media.lainnya) daftar.push({ nama: 'Lainnya', jumlah: m.media.lainnya, lain: true })

  const atas = y + 40
  const tinggiBaris = Math.min(26, (t - 48) / Math.max(daftar.length, 1))
  daftar.forEach((med, i) => {
    const by = atas + i * tinggiBaris + tinggiBaris / 2 + 4
    if (i % 2 === 0) {
      bagian.push(kotak(x + 8, atas + i * tinggiBaris, l - 16, tinggiBaris, 4, WARNA.latarLembut))
    }
    // Petak inisial menggantikan logo media. Logo menuntut berkas gambar per
    // media, dan berkas yang harus dijaga tetap lengkap adalah berkas yang
    // suatu hari tidak lengkap.
    const kode = med.lain ? '···' : inisialMedia(med.nama)
    bagian.push(kotak(x + 14, atas + i * tinggiBaris + (tinggiBaris - 18) / 2, 30, 18, 3,
      med.lain ? WARNA.abu : WARNA.biru, { buram: med.lain ? 0.45 : 1 }))
    bagian.push(teks(x + 29, by - 1, kode, {
      ukuran: 9.5, tebal: 700, warna: '#ffffff', rata: 'middle',
    }))
    bagian.push(teks(x + 52, by, potong(med.nama, l - 52 - 46, 12.5), {
      ukuran: 12.5, warna: med.lain ? WARNA.redup : WARNA.tinta,
    }))
    bagian.push(teks(x + l - 16, by, String(med.jumlah), {
      ukuran: 13.5, tebal: 700, warna: WARNA.navy, rata: 'end',
    }))
  })
  return bagian.join('')
}

/** Dua atau tiga huruf yang mewakili sebuah media pada petak kecil. */
function inisialMedia(nama) {
  const bersih = String(nama || '').replace(/\.(com|co\.id|id|go\.id|net|org|tv)$/i, '')
  const kata = bersih.split(/[\s.\-_]+/).filter(Boolean)
  if (kata.length >= 2) return (kata[0][0] + kata[1][0]).toUpperCase()
  return bersih.slice(0, 3).toUpperCase()
}

function panelAngka(m, x, y, l, t) {
  const ubin = [
    { label: 'TOTAL BERITA', nilai: m.ikhtisar.total, satuan: 'berita', warna: WARNA.biru, ikon: 'berita' },
    { label: 'LAPAS', nilai: m.ikhtisar.lapas, satuan: `berita (${m.ikhtisar.persenLapas}%)`, warna: WARNA.positif, ikon: 'lapas' },
    { label: 'RUTAN', nilai: m.ikhtisar.rutan, satuan: `berita (${m.ikhtisar.persenRutan}%)`, warna: WARNA.jingga, ikon: 'rutan' },
    { label: 'TOTAL PROVINSI', nilai: m.ikhtisar.provinsi, satuan: 'provinsi', warna: WARNA.biru, ikon: 'peta' },
    { label: 'MEDIA', nilai: m.ikhtisar.media, satuan: 'media online', warna: WARNA.ungu, ikon: 'media' },
  ]
  const jarak = 12
  const lebarUbin = (l - jarak * (ubin.length - 1)) / ubin.length
  const bagian = []
  ubin.forEach((u, i) => {
    const ux = x + i * (lebarUbin + jarak)
    bagian.push(kotak(ux, y, lebarUbin, t, 8, WARNA.kartu, { garis: WARNA.garis }))
    bagian.push(IKON_TEMA[u.ikon] ? IKON_TEMA[u.ikon](ux + 16, y + 16, 26, u.warna) : '')
    bagian.push(teks(ux + 52, y + 24, u.label, {
      ukuran: 10.5, tebal: 700, warna: WARNA.redup, spasi: 0.6,
    }))
    bagian.push(teks(ux + 52, y + 54, String(u.nilai), {
      ukuran: 28, tebal: 800, warna: WARNA.navy, huruf: TATA.huruf.judul,
    }))
    bagian.push(teks(ux + 52 + lebarTeks(String(u.nilai), 28, true) + 8, y + 54, u.satuan, {
      ukuran: 11, warna: WARNA.redup,
    }))
  })
  return bagian.join('')
}

function panelPeta(m, x, y, l, t, geo) {
  const bagian = [kotak(x, y, l, t, 8, WARNA.kartu, { garis: WARNA.garis })]
  bagian.push(kepalaPanel(x, y, l, 'PETA SEBARAN BERITA & STATUS PROVINSI'))

  const isiY = y + TATA.kepalaPanel
  bagian.push(teks(x + 16, isiY + 24, 'STATUS PROVINSI', { ukuran: 11.5, tebal: 700, warna: WARNA.navy }))
  bagian.push(teks(x + 16, isiY + 39, 'BERDASARKAN SENTIMEN DOMINAN', { ukuran: 9.5, warna: WARNA.redup, spasi: 0.4 }))

  /* Legenda menghitung BERITA, bukan provinsi.
     Warna sebuah provinsi menyatakan ember mana yang terbanyak di sana; jumlah
     provinsi per warna karena itu tidak menjumlah menjadi apa pun yang berguna
     — "10 provinsi negatif" tidak bisa dibandingkan dengan angka mana pun di
     lembar ini. Jumlah berita bisa: ketiganya menjumlah tepat menjadi Total
     Berita pada ubin di atas, dan pembaca yang menjumlahkannya akan menemukan
     angka yang sama. */
  const legenda = [
    { warna: WARNA.positif, label: 'Positif', jumlah: m.sentimen.positif },
    { warna: WARNA.netral, label: 'Netral', jumlah: m.sentimen.netral },
    { warna: WARNA.negatif, label: 'Negatif', jumlah: m.sentimen.negatif },
    { warna: WARNA.abu, label: 'Tidak ada berita', jumlah: null },
  ]
  let ly = isiY + 62
  for (const g of legenda) {
    bagian.push(`<circle cx="${bulat(x + 24)}" cy="${bulat(ly - 4)}" r="6" fill="${g.warna}"/>`)
    bagian.push(teks(x + 38, ly, g.label, { ukuran: 11.5, tebal: 600, warna: WARNA.tinta }))
    if (g.jumlah != null) {
      bagian.push(teks(x + 38, ly + 14, `(${g.jumlah} berita)`, { ukuran: 10, warna: WARNA.redup }))
    }
    ly += 32
  }

  /* Peta. Kotaknya menempati sisi kanan panel; daftar provinsi di bawah kiri,
     persis seperti lembar contoh. */
  const petaX = x + 150
  const petaY = isiY + 6
  const petaL = l - 160
  const petaT = t - TATA.kepalaPanel - 130
  const proyeksi = penProyeksi(geo.batas, petaX, petaY, petaL, petaT)

  // Tetangga digambar lebih dulu dan sangat samar: tanpa mereka Kalimantan dan
  // Papua terpotong lurus dan terbaca sebagai kesalahan gambar.
  for (const d of geo.tetangga) {
    bagian.push(`<path d="${jalurKePiksel(d, proyeksi)}" fill="${WARNA.abuSamar}" opacity="0.5"/>`)
  }

  for (const prov of geo.provinsi) {
    const catatan = m.wilayah.perBentuk.get(prov.nama)
    const isi = catatan ? WARNA[catatan.dominan === 'belum' ? 'abu' : catatan.dominan] : WARNA.abu
    for (const d of prov.jalur) {
      bagian.push(`<path d="${jalurKePiksel(d, proyeksi)}" fill="${isi}"`
        + ` stroke="#ffffff" stroke-width="0.7" stroke-linejoin="round"/>`)
    }
  }

  // Daftar provinsi terbanyak.
  const daftarY = y + t - 118
  bagian.push(kotak(x + 12, daftarY, l * 0.42, 108, 6, WARNA.latarLembut))
  bagian.push(teks(x + 12 + (l * 0.42) / 2, daftarY + 20, 'PROVINSI DENGAN BERITA TERBANYAK', {
    ukuran: 10, tebal: 700, warna: WARNA.navy, rata: 'middle',
  }))
  m.wilayah.teratas.forEach((p, i) => {
    const py = daftarY + 40 + i * 15
    bagian.push(teks(x + 24, py, `${i + 1}.`, { ukuran: 11, tebal: 700, warna: WARNA.redup }))
    bagian.push(teks(x + 40, py, potong(p.nama, l * 0.42 - 100, 11), { ukuran: 11, warna: WARNA.tinta }))
    bagian.push(teks(x + 12 + l * 0.42 - 14, py, `${p.jumlah} berita`, {
      ukuran: 11, tebal: 700, warna: WARNA.navy, rata: 'end',
    }))
  })

  // Keterangan status, sebagaimana lembar contoh.
  const ketX = x + 24 + l * 0.42
  const ketL = l - (ketX - x) - 12
  bagian.push(kotak(ketX, daftarY, ketL, 108, 6, WARNA.latarLembut))
  bagian.push(teks(ketX + ketL / 2, daftarY + 20, 'KETERANGAN STATUS', {
    ukuran: 10, tebal: 700, warna: WARNA.navy, rata: 'middle',
  }))
  const keterangan = [
    { warna: WARNA.positif, nama: 'Positif', teks: 'Mayoritas berita menampilkan kegiatan pembinaan, peningkatan layanan & pengamanan yang baik.' },
    { warna: WARNA.netral, nama: 'Netral', teks: 'Berita bersifat informatif tanpa konotasi positif atau negatif.' },
    { warna: WARNA.negatif, nama: 'Negatif', teks: 'Terdapat berita pelanggaran, masalah layanan, over kapasitas, atau pelarian.' },
  ]
  let ky = daftarY + 38
  for (const k of keterangan) {
    bagian.push(`<circle cx="${bulat(ketX + 16)}" cy="${bulat(ky - 4)}" r="5" fill="${k.warna}"/>`)
    bagian.push(teks(ketX + 28, ky, `${k.nama} :`, { ukuran: 9.5, tebal: 700, warna: WARNA.tinta }))
    const isiBaris = baris(k.teks, ketL - 90, 9, 2)
    isiBaris.forEach((b, i) => {
      bagian.push(teks(ketX + 28 + lebarTeks(`${k.nama} : `, 9.5, true), ky + i * 11, b, {
        ukuran: 9, warna: WARNA.redup,
      }))
    })
    ky += 24
  }

  return bagian.join('')
}

function panelTema(m, x, y, l, t) {
  const bagian = [kotak(x, y, l, t, 8, WARNA.kartu, { garis: WARNA.garis })]
  bagian.push(kepalaPanel(x, y, l, 'RINCIAN ISU'))

  const atas = y + TATA.kepalaPanel + 8
  const tersedia = t - TATA.kepalaPanel - 16
  const daftar = m.tema.slice(0, 8)
  const tinggiBaris = Math.min(58, tersedia / Math.max(daftar.length, 1))

  daftar.forEach((tema, i) => {
    const by = atas + i * tinggiBaris
    const tinggiIsi = tinggiBaris - 5
    bagian.push(kotak(x + 10, by, l - 20, tinggiIsi, 5, warnaLembut(tema.warna)))
    bagian.push(kotak(x + 10, by, 4, tinggiIsi, 2, tema.warna))

    const gambarIkon = IKON_TEMA[tema.ikon]
    if (gambarIkon) bagian.push(gambarIkon(x + 22, by + tinggiIsi / 2 - 11, 22, tema.warna))

    bagian.push(teks(x + 52, by + 18, potong(tema.nama.toUpperCase(), l - 52 - 78, 11.5, true), {
      ukuran: 11.5, tebal: 700, warna: tema.warna, spasi: 0.3,
    }))
    tema.ringkas.slice(0, 2).forEach((r, j) => {
      bagian.push(teks(x + 56, by + 33 + j * 12, `• ${potong(r, l - 56 - 80, 9.5)}`, {
        ukuran: 9.5, warna: WARNA.redup,
      }))
    })

    bagian.push(kotak(x + l - 72, by + 6, 58, tinggiIsi - 12, 4, '#ffffff', { garis: warnaLembut(tema.warna) }))
    bagian.push(teks(x + l - 43, by + tinggiIsi / 2 - 1, String(tema.jumlah), {
      ukuran: 19, tebal: 800, warna: tema.warna, rata: 'middle', huruf: TATA.huruf.judul,
    }))
    bagian.push(teks(x + l - 43, by + tinggiIsi / 2 + 14, `(${tema.persen}%)`, {
      ukuran: 9.5, warna: WARNA.redup, rata: 'middle',
    }))
  })
  return bagian.join('')
}

/** Warna latar lembut dari warna tema. Cukup samar untuk tetap terbaca. */
function warnaLembut(hex) {
  const n = String(hex).replace('#', '')
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  const campur = (c) => Math.round(c + (255 - c) * 0.88)
  return `#${[campur(r), campur(g), campur(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

function panelSorotan(m, x, y, l, t) {
  const bagian = [kotak(x, y, l, t, 8, WARNA.kartu, { garis: WARNA.garis })]
  bagian.push(kepalaPanel(x, y, l, 'HIGHLIGHT BERITA'))

  let by = y + TATA.kepalaPanel + 22
  for (const s of m.sorotanButir) {
    const warna = s.nada === 'awas' ? WARNA.jingga : WARNA.positif
    bagian.push(`<circle cx="${bulat(x + 22)}" cy="${bulat(by - 4)}" r="7.5" fill="${warna}"/>`)
    bagian.push(teks(x + 22, by - 0.5, s.nada === 'awas' ? '!' : '✓', {
      ukuran: 9.5, tebal: 700, warna: '#ffffff', rata: 'middle',
    }))
    const isi = baris(s.teks, l - 46, 11, 3)
    isi.forEach((b, i) => bagian.push(teks(x + 38, by + i * 13, b, { ukuran: 11, warna: WARNA.tinta })))
    by += isi.length * 13 + 12
  }
  return bagian.join('')
}

function panelIsuKhusus(m, x, y, l, t) {
  if (!m.isuKhusus) return ''
  const bagian = [kotak(x, y, l, t, 8, WARNA.kartu, { garis: WARNA.garis })]
  bagian.push(kepalaPanel(x, y, l, 'ISU SOROTAN KHUSUS', { warna: WARNA.merahTua }))

  const judul = `${m.isuKhusus.judul}${m.isuKhusus.unit ? ` — ${m.isuKhusus.unit}` : ''}`
  bagian.push(teks(x + 16, y + TATA.kepalaPanel + 20, potong(judul, l - 32, 11.5, true), {
    ukuran: 11.5, tebal: 700, warna: WARNA.merahTua,
  }))

  let by = y + TATA.kepalaPanel + 42
  for (const g of m.isuKhusus.garisWaktu) {
    bagian.push(kotak(x + 14, by - 11, 46, 16, 3, WARNA.merahTua, { buram: 0.12 }))
    bagian.push(teks(x + 37, by, tanggalKecil(g.tanggal), {
      ukuran: 9.5, tebal: 700, warna: WARNA.merahTua, rata: 'middle',
    }))
    const isi = baris(g.teks, l - 82, 9.5, 2)
    isi.forEach((b, i) => bagian.push(teks(x + 68, by + i * 11, b, { ukuran: 9.5, warna: WARNA.tinta })))
    if (g.sumber) {
      bagian.push(teks(x + 68, by + isi.length * 11, `(${potong(g.sumber, l - 90, 9)})`, {
        ukuran: 9, warna: WARNA.redup,
      }))
    }
    by += isi.length * 11 + 22
  }
  return bagian.join('')
}

const BULAN_KECIL = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
function tanggalKecil(iso) {
  const [, b, h] = String(iso || '').slice(0, 10).split('-').map(Number)
  if (!b) return ''
  return `${h} ${BULAN_KECIL[b - 1]}`
}

function panelContoh(m, x, y, l, t) {
  const bagian = [kotak(x, y, l, t, 8, WARNA.kartu, { garis: WARNA.garis })]
  bagian.push(kepalaPanel(x, y, l, `CONTOH BERITA TERKINI (${m.periode.label.toUpperCase()})`))

  const kartuAda = m.contoh.length || 1
  const jarak = 10
  const lebarKartu = (l - 24 - jarak * (kartuAda - 1)) / kartuAda
  const atas = y + TATA.kepalaPanel + 10
  const tinggiKartu = t - TATA.kepalaPanel - 20

  m.contoh.forEach((c, i) => {
    const kx = x + 12 + i * (lebarKartu + jarak)
    bagian.push(kotak(kx, atas, lebarKartu, tinggiKartu, 6, WARNA.latarLembut))
    const gambarIkon = IKON_TEMA[c.ikon]
    if (gambarIkon) bagian.push(gambarIkon(kx + 10, atas + 10, 20, c.warna))

    const isi = baris(c.judul, lebarKartu - 20, 10.5, 3, true)
    isi.forEach((b, j) => bagian.push(teks(kx + 10, atas + 46 + j * 12, b, {
      ukuran: 10.5, tebal: 700, warna: WARNA.tinta,
    })))

    const kaki = atas + tinggiKartu - 30
    bagian.push(teks(kx + 10, kaki, potong(c.upt || '—', lebarKartu - 20, 9), {
      ukuran: 9, warna: WARNA.redup,
    }))
    bagian.push(teks(kx + 10, kaki + 11, potong(c.provinsi || '', lebarKartu - 20, 9), {
      ukuran: 9, warna: WARNA.redup,
    }))
    bagian.push(kotak(kx + lebarKartu - 44, kaki - 12, 36, 20, 4, c.warna))
    bagian.push(teks(kx + lebarKartu - 26, kaki + 2, tanggalKecil(c.tanggal), {
      ukuran: 9, tebal: 700, warna: '#ffffff', rata: 'middle',
    }))
  })
  return bagian.join('')
}

function panelKesimpulan(m, x, y, l, t) {
  const bagian = [kotak(x, y, l, t, 8, WARNA.kartu, { garis: WARNA.garis })]
  bagian.push(kepalaPanel(x, y, l, 'KESIMPULAN'))

  let by = y + TATA.kepalaPanel + 22
  for (const k of m.kesimpulan) {
    const warna = k.nada === 'awas' ? WARNA.jingga : WARNA.positif
    bagian.push(kotak(x + 14, by - 13, 20, 20, 4, warna, { buram: 0.16 }))
    bagian.push(teks(x + 24, by, k.nada === 'awas' ? '!' : '▲', {
      ukuran: 11, tebal: 700, warna, rata: 'middle',
    }))
    const isi = baris(k.teks, l - 56, 11, 4)
    isi.forEach((b, i) => bagian.push(teks(x + 42, by + i * 13, b, { ukuran: 11, warna: WARNA.tinta })))
    by += isi.length * 13 + 16
  }
  return bagian.join('')
}

/* ------------------------------------------------------------------ utama */

/**
 * Menggambar seluruh lembar.
 *
 * @param {object} model hasil susunInfografis()
 * @param {object} geo   { batas, daratan, tetangga, provinsi } dari modul peta
 * @param {object} [opsi]
 * @param {string} [opsi.sumber] baris kaki kiri
 * @param {string} [opsi.catatan] baris kaki kanan
 * @returns {string} SVG utuh
 */
export function svgInfografis(model, geo, opsi = {}) {
  const { lebar, tinggi, tepi } = TATA
  const bagian = []

  bagian.push(kotak(0, 0, lebar, tinggi, 0, WARNA.latar))

  const isiL = lebar - tepi * 2
  let y = tepi

  // Baris 1: kepala, sentimen, media.
  const lebarKepala = isiL * 0.505
  const lebarSentimen = isiL * 0.275
  const lebarMedia = isiL - lebarKepala - lebarSentimen - 24
  bagian.push(panelKepala(model, tepi, y, lebarKepala, TATA.tinggiKepala))
  bagian.push(panelSentimen(model, tepi + lebarKepala + 12, y, lebarSentimen, TATA.tinggiKepala))
  bagian.push(panelMedia(model, tepi + lebarKepala + lebarSentimen + 24, y, lebarMedia, TATA.tinggiKepala))
  y += TATA.tinggiKepala + 12

  // Baris 2: lima ubin angka, selebar kolom kepala + sentimen.
  bagian.push(panelAngka(model, tepi, y, lebarKepala + lebarSentimen + 12, TATA.tinggiAngka))
  y += TATA.tinggiAngka + 12

  // Baris 3: peta, rincian isu, sorotan + isu khusus.
  const tinggiTengah = TATA.tinggiTengah
  const lebarPeta = isiL * 0.455
  const lebarRincian = isiL * 0.275
  const lebarKanan = isiL - lebarPeta - lebarRincian - 24
  bagian.push(panelPeta(model, tepi, y, lebarPeta, tinggiTengah, geo))
  bagian.push(panelTema(model, tepi + lebarPeta + 12, y, lebarRincian, tinggiTengah))

  const xKanan = tepi + lebarPeta + lebarRincian + 24
  if (model.isuKhusus) {
    const tinggiSorotan = tinggiTengah * 0.52
    bagian.push(panelSorotan(model, xKanan, y, lebarKanan, tinggiSorotan))
    bagian.push(panelIsuKhusus(model, xKanan, y + tinggiSorotan + 12,
      lebarKanan, tinggiTengah - tinggiSorotan - 12))
  } else {
    bagian.push(panelSorotan(model, xKanan, y, lebarKanan, tinggiTengah))
  }
  y += tinggiTengah + 12

  // Baris 4: contoh berita dan kesimpulan.
  const lebarContoh = isiL * 0.665
  bagian.push(panelContoh(model, tepi, y, lebarContoh, TATA.tinggiBawah))
  bagian.push(panelKesimpulan(model, tepi + lebarContoh + 12, y,
    isiL - lebarContoh - 12, TATA.tinggiBawah))
  y += TATA.tinggiBawah + 10

  // Kaki.
  const sumber = opsi.sumber || `Sumber: Monitoring Media Online (${model.periode.label})`
  bagian.push(teks(tepi, y + 12, sumber, { ukuran: 9.5, warna: WARNA.redup }))
  bagian.push(teks(lebar - tepi, y + 12,
    opsi.catatan || 'Catatan: Data dapat berubah sesuai pembaruan berita.',
    { ukuran: 9.5, warna: WARNA.redup, rata: 'end' }))

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lebar} ${tinggi}"`
    + ` width="${lebar}" height="${tinggi}" font-family="${TATA.huruf.badan}">`
    + bagian.join('')
    + '</svg>'
}
