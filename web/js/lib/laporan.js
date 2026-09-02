/**
 * Penyusun laporan intelijen pemberitaan.
 *
 * Laporan ini hanya memuat pemberitaan negatif. Itu keputusan yang disengaja
 * dan perlu dijelaskan: laporan berkala Direktorat Pengamanan dan Intelijen
 * bukan rapor kehumasan. Yang dibaca pimpinan di sini adalah daftar hal yang
 * menuntut tindakan. Publikasi positif tetap dihitung — angkanya muncul satu
 * baris sebagai penyeimbang — tetapi ia tidak berhak memakai ruang yang
 * seharusnya dipakai isu yang belum selesai.
 *
 * Satuan laporan ini adalah PERISTIWA, bukan publikasi. Delapan berita tentang
 * satu narapidana yang kabur adalah satu kejadian dengan eksposur besar. Dua
 * angka itu dipisahkan di sepanjang laporan, karena keduanya menuntut respons
 * yang berbeda: jumlah peristiwa menentukan berapa banyak yang harus
 * ditangani, jumlah publikasi menentukan seberapa keras tekanan opininya.
 *
 * Seluruh gambar di dalamnya adalah SVG yang dihitung dari data, bukan gambar
 * tempelan. Laporan bisa dicetak, disimpan sebagai PDF, dan dibuka di komputer
 * mana pun tanpa perlu sambungan internet.
 *
 * Modul ES murni, tanpa pustaka luar.
 */

import { kelompokkanPeristiwa, validasi, sumberAsli, rapikanJudul } from './peristiwa.js'
import { belumTerpetakan } from './pencocokan-upt.js'

/* ------------------------------------------------------------------ dasar */

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

const WARNA = {
  kritis: '#9E1710',
  tinggi: '#A2500F',
  sedang: '#7A5C10',
  rendah: '#46536B',
  positif: '#0E6A4E',
  netral: '#55637C',
  aksen: '#0F2C55',
  aksen2: '#1D4E8F',
  brass: '#A9791C',
  garis: '#D9E1EE',
  garis2: '#EDF2F8',
  tinta: '#0F1A2B',
  tinta2: '#32405A',
  tinta3: '#5B6B87',
  tinta4: '#8593AC',
}

/** Rona kategori — satu warna per kelompok isu, dipakai konsisten di semua bagan. */
const RONA_KATEGORI = {
  'Gangguan Keamanan dan Ketertiban': '#9E1710',
  'Peredaran Barang Terlarang': '#B4451C',
  'Pelanggaran Integritas Petugas': '#8A3A6B',
  'Isu Manajemen, HAM, dan Krisis': '#A2500F',
  'Isu Intelijen Khusus': '#6B2D8A',
  'Ancaman Eksternal dan Modus Baru': '#1D4E8F',
  'Disinformasi dan Kegagalan Integrasi': '#7A5C10',
  Lainnya: '#55637C',
}

function esc(nilai) {
  return String(nilai ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function angka(n) {
  return new Intl.NumberFormat('id-ID').format(Number(n) || 0)
}

function persen(bagian, total, desimal = 1) {
  if (!total) return '0%'
  return `${((bagian / total) * 100).toFixed(desimal).replace('.', ',')}%`
}

function tanggalPanjang(iso) {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '-'
  return `${t.getDate()} ${BULAN[t.getMonth()]} ${t.getFullYear()}`
}

function tanggalPendek(iso) {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '-'
  return `${t.getDate()} ${BULAN[t.getMonth()].slice(0, 3)}`
}

function namaHari(iso) {
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? '' : HARI[t.getDay()]
}

function isoHari(nilai) {
  const t = new Date(nilai)
  return Number.isNaN(t.getTime()) ? '' : t.toISOString().slice(0, 10)
}

function nadaUrgensi(u) {
  return { Kritis: 'kritis', Tinggi: 'tinggi', Sedang: 'sedang', Rendah: 'rendah' }[u] || 'rendah'
}

export function nomorLaporan(jenis, urutan, iso) {
  const t = new Date(iso)
  const bulan = Number.isNaN(t.getTime()) ? 1 : t.getMonth() + 1
  const tahun = Number.isNaN(t.getTime()) ? new Date().getFullYear() : t.getFullYear()
  const kode = jenis === 'harian' ? 'H' : jenis === 'bulanan' ? 'B' : 'M'
  return `LAP-${kode}/${String(urutan).padStart(4, '0')}/${ROMAWI[bulan - 1]}/${tahun}`
}

/* ------------------------------------------------------------- perhitungan */

/**
 * Mengubah publikasi mentah menjadi seluruh angka yang dipakai laporan.
 * Satu tempat, supaya tidak ada dua bagian laporan yang menghitung sendiri
 * dan diam-diam berbeda.
 */
export function olahLaporan(snapshot) {
  const publikasi = (snapshot.publikasi || []).map((b) => ({
    ...b,
    created_at: b.tanggal || b.created_at,
  }))

  const peristiwa = kelompokkanPeristiwa(publikasi)
  const konteks = snapshot.konteks || {}
  const periode = snapshot.periode || {}

  const unit = new Map()
  for (const p of peristiwa) {
    if (belumTerpetakan(p.nama_upt)) continue
    const kunci = p.nama_upt
    const lama = unit.get(kunci) || {
      nama: kunci,
      provinsi: p.publikasi[0]?.provinsi || '-',
      kanwil: p.publikasi[0]?.kanwil || '-',
      peristiwa: 0, publikasi: 0, media: new Set(), isu: new Set(),
      urgensi: 'Rendah', sorotan: p.judul,
    }
    lama.peristiwa += 1
    lama.publikasi += p.jumlah_publikasi
    for (const b of p.publikasi) lama.media.add(sumberAsli(b))
    lama.isu.add(p.subkategori)
    const rank = { Rendah: 1, Sedang: 2, Tinggi: 3, Kritis: 4 }
    if ((rank[p.urgensi] || 0) > (rank[lama.urgensi] || 0)) {
      lama.urgensi = p.urgensi
      lama.sorotan = p.judul
    }
    unit.set(kunci, lama)
  }

  const daftarUnit = [...unit.values()]
    .map((u) => ({ ...u, media: u.media.size, isu: [...u.isu] }))
    .sort((a, b) => b.publikasi - a.publikasi || b.peristiwa - a.peristiwa)

  /*
     Unit yang naik ke permukaan, beserta pembandingnya.

     `unit_lalu` datang dari snapshot_negatif: jumlah publikasi negatif per
     unit pada periode sepanjang periode ini, tepat sebelumnya. Tanpanya, angka
     "delapan publikasi" tidak bisa dibaca siapa pun — delapan di unit yang
     pekan lalu juga delapan adalah keadaan tenang, delapan di unit yang pekan
     lalu nol adalah keadaan yang harus dibaca malam ini juga.

     Snapshot lama tidak memuat kunci itu. Yang terjadi kemudian hanyalah
     seluruh pembandingnya nol — bukan galat, dan bukan angka yang salah;
     laporan lamanya tetap tersusun, hanya tanpa panah kenaikan.
  */
  const unitLalu = snapshot.unit_lalu || {}
  const uptNaik = daftarUnit
    .map((u) => {
      const sebelum = Number(unitLalu[u.nama] || 0)
      return { ...u, sebelum, delta: u.publikasi - sebelum }
    })
    .sort((a, b) => b.publikasi - a.publikasi || b.delta - a.delta)

  // Rekap per hari sepanjang periode, termasuk hari yang kosong. Hari sepi
  // adalah informasi; menghilangkannya membuat garis tren berbohong.
  const perHari = []
  const mulai = new Date(periode.mulai)
  const selesai = new Date(periode.selesai)
  for (let t = new Date(mulai); t <= selesai; t.setDate(t.getDate() + 1)) {
    const iso = t.toISOString().slice(0, 10)
    const hariIni = publikasi.filter((b) => isoHari(b.tanggal) === iso)
    const peristiwaHari = peristiwa.filter((p) => isoHari(p.tanggal_pertama) === iso)
    perHari.push({
      tanggal: iso,
      publikasi: hariIni.length,
      peristiwa: peristiwaHari.length,
      tinggi: hariIni.filter((b) => ['Tinggi', 'Kritis'].includes(b.urgensi)).length,
      isu_utama: peristiwaHari[0]?.subkategori || (hariIni[0]?.subkategori ?? null),
      sorotan: peristiwaHari[0]?.judul || hariIni[0]?.judul || null,
    })
  }

  const perKategori = Object.entries(
    peristiwa.reduce((a, p) => {
      a[p.kategori] = a[p.kategori] || { peristiwa: 0, publikasi: 0 }
      a[p.kategori].peristiwa += 1
      a[p.kategori].publikasi += p.jumlah_publikasi
      return a
    }, {}),
  ).map(([nama, v]) => ({ nama, ...v })).sort((a, b) => b.publikasi - a.publikasi)

  const perSubkategori = Object.entries(
    peristiwa.reduce((a, p) => {
      const k = p.subkategori
      a[k] = a[k] || { peristiwa: 0, publikasi: 0, urgensi: p.urgensi, kode: p.subkategori_kode }
      a[k].peristiwa += 1
      a[k].publikasi += p.jumlah_publikasi
      return a
    }, {}),
  ).map(([nama, v]) => ({ nama, ...v })).sort((a, b) => b.publikasi - a.publikasi)

  const perProvinsi = Object.entries(
    peristiwa.reduce((a, p) => {
      const prov = p.publikasi[0]?.provinsi
      if (!prov) return a
      a[prov] = a[prov] || { peristiwa: 0, publikasi: 0 }
      a[prov].peristiwa += 1
      a[prov].publikasi += p.jumlah_publikasi
      return a
    }, {}),
  ).map(([nama, v]) => ({ nama, ...v })).sort((a, b) => b.publikasi - a.publikasi)

  const mendesak = peristiwa.filter((p) => ['Tinggi', 'Kritis'].includes(p.urgensi))
  const perluTelaah = publikasi.filter((b) => validasi(b).mutu === 'perlu-telaah')

  return {
    periode,
    konteks,
    publikasi,
    peristiwa,
    mendesak,
    perluTelaah,
    daftarUnit,
    uptNaik,
    perHari,
    perKategori,
    perSubkategori,
    perProvinsi,
    ikhtisar: {
      peristiwa: peristiwa.length,
      publikasi: publikasi.length,
      media: new Set(publikasi.map(sumberAsli).filter(Boolean)).size,
      unit: daftarUnit.length,
      tanpaUnit: peristiwa.filter((p) => belumTerpetakan(p.nama_upt)).length,
      mendesak: mendesak.length,
      kritis: peristiwa.filter((p) => p.urgensi === 'Kritis').length,
      eksposurTertinggi: peristiwa[0]?.eksposur || 0,
    },
    dibuat_pada: snapshot.dibuat_pada || new Date().toISOString(),
  }
}

/* -------------------------------------------------------------- penilaian */

export function nilaiKeadaan(d) {
  const { ikhtisar, konteks } = d
  if (ikhtisar.kritis > 0) {
    return { label: 'SIAGA', nada: 'kritis', kalimat: 'Terdapat peristiwa berstatus kritis yang menuntut penanganan segera.' }
  }
  if (ikhtisar.mendesak >= 3) {
    return { label: 'PERLU PERHATIAN', nada: 'tinggi', kalimat: `Ada ${angka(ikhtisar.mendesak)} peristiwa berurgensi tinggi pada periode ini.` }
  }
  const porsi = konteks.total ? ikhtisar.publikasi / konteks.total : 0
  if (porsi > 0.4) {
    return { label: 'PERLU PERHATIAN', nada: 'tinggi', kalimat: 'Porsi pemberitaan negatif cukup besar terhadap keseluruhan publikasi.' }
  }
  if (ikhtisar.peristiwa === 0) {
    return { label: 'TERKENDALI', nada: 'positif', kalimat: 'Tidak ada peristiwa negatif yang terpantau pada periode ini.' }
  }
  return { label: 'TERPANTAU', nada: 'sedang', kalimat: 'Peristiwa negatif terpantau dalam jumlah wajar dan sudah teridentifikasi unitnya.' }
}

export function susunRekomendasi(d) {
  const r = []
  const { ikhtisar, daftarUnit, perSubkategori, peristiwa, konteks, perluTelaah } = d

  const teratas = daftarUnit[0]
  if (teratas) {
    r.push(`Dahulukan klarifikasi dan verifikasi lapangan pada <b>${esc(teratas.nama)}</b>
      (${esc(teratas.provinsi)}), unit paling disorot dengan ${angka(teratas.publikasi)} publikasi
      negatif dari ${angka(teratas.media)} media pada periode ini.`)
  }

  const isu = perSubkategori[0]
  if (isu) {
    r.push(`Isu <b>${esc(isu.nama)}</b> menjadi pembentuk sentimen negatif terbesar
      — ${angka(isu.peristiwa)} peristiwa, ${angka(isu.publikasi)} publikasi. Perkuat pengendalian
      pada titik ini sebelum periode berikutnya.`)
  }

  const paling = peristiwa[0]
  if (paling && paling.jumlah_media > 2) {
    r.push(`Satu peristiwa diangkat oleh ${angka(paling.jumlah_media)} media berbeda selama
      ${angka(paling.rentang_hari)} hari. Siapkan satu pintu keterangan resmi agar versi yang
      beredar tidak lagi berasal dari sumber yang tidak terverifikasi.`)
  }

  if (ikhtisar.tanpaUnit) {
    r.push(`Selesaikan pemetaan ${angka(ikhtisar.tanpaUnit)} peristiwa yang belum terhubung ke unit
      mana pun, agar rekap per wilayah tidak kehilangan angka.`)
  }

  if (perluTelaah.length) {
    r.push(`${angka(perluTelaah.length)} publikasi ditandai mesin sebagai perlu telaah analis.
      Selesaikan telaahnya sebelum angka pada laporan ini dipakai sebagai dasar keputusan.`)
  }

  if (konteks.positif) {
    r.push(`Manfaatkan ${angka(konteks.positif)} publikasi positif pada periode yang sama sebagai
      bahan penyeimbang, terutama pada wilayah yang sedang disorot.`)
  }

  r.push('Pastikan setiap angka pada laporan ini dapat ditelusuri kembali ke daftar sumber di bagian akhir.')
  return r
}

/* ------------------------------------------------------------------ bagan */

/** Donat komposisi. Setiap potongan membawa judulnya sendiri untuk tooltip. */
function donat(bagian, ukuran = 168, tebal = 26) {
  const total = bagian.reduce((a, b) => a + b.nilai, 0)
  if (!total) return ''
  const r = (ukuran - tebal) / 2
  const pusat = ukuran / 2
  const keliling = 2 * Math.PI * r
  let jalan = 0

  const potongan = bagian.map((b) => {
    const panjang = (b.nilai / total) * keliling
    const el = `<circle cx="${pusat}" cy="${pusat}" r="${r}" fill="none"
      stroke="${b.warna}" stroke-width="${tebal}"
      stroke-dasharray="${panjang.toFixed(2)} ${(keliling - panjang).toFixed(2)}"
      stroke-dashoffset="${(-jalan).toFixed(2)}"
      transform="rotate(-90 ${pusat} ${pusat})"><title>${esc(b.label)}: ${angka(b.nilai)}</title></circle>`
    jalan += panjang
    return el
  }).join('')

  return `<svg viewBox="0 0 ${ukuran} ${ukuran}" width="${ukuran}" height="${ukuran}" role="img"
    aria-label="Komposisi ${bagian.map((b) => `${b.label} ${b.nilai}`).join(', ')}">
    <circle cx="${pusat}" cy="${pusat}" r="${r}" fill="none" stroke="${WARNA.garis2}" stroke-width="${tebal}"/>
    ${potongan}
    <text x="${pusat}" y="${pusat - 1}" text-anchor="middle"
      style="font-size:30px;font-weight:800;fill:${WARNA.tinta};letter-spacing:-0.04em">${angka(total)}</text>
    <text x="${pusat}" y="${pusat + 16}" text-anchor="middle"
      style="font-size:9px;letter-spacing:0.14em;fill:${WARNA.tinta4};font-family:monospace">PUBLIKASI</text>
  </svg>`
}

function legenda(bagian, total) {
  return `<dl class="legenda">${bagian.map((b) => `
    <div><i style="background:${b.warna}"></i><span>${esc(b.label)}</span>
      <b>${angka(b.nilai)}</b><em>${persen(b.nilai, total)}</em></div>`).join('')}</dl>`
}

/**
 * Batang harian: publikasi negatif per hari, dengan porsi berurgensi tinggi
 * ditandai lebih pekat, dan jumlah peristiwa sebagai titik di atasnya.
 */
function baganHarian(perHari) {
  if (!perHari.length) return '<p class="samar">Tidak ada data harian.</p>'
  const maks = Math.max(...perHari.map((h) => h.publikasi), 1)
  const L = 720
  const T = 168
  const kiri = 30
  const bawah = 30
  const lebarBidang = L - kiri - 12
  const tinggiBidang = T - bawah - 16
  const lebarBatang = Math.min(46, (lebarBidang / perHari.length) - 8)

  const x = (i) => kiri + (lebarBidang / perHari.length) * i + (lebarBidang / perHari.length - lebarBatang) / 2
  const tinggi = (n) => (n / maks) * tinggiBidang

  const kisi = [0, 0.5, 1].map((f) => {
    const y = 16 + tinggiBidang - f * tinggiBidang
    return `<line x1="${kiri}" x2="${L - 12}" y1="${y}" y2="${y}" stroke="${WARNA.garis2}" stroke-width="1"/>
      <text x="${kiri - 6}" y="${y + 3}" text-anchor="end"
        style="font-size:8.5px;fill:${WARNA.tinta4};font-family:monospace">${Math.round(f * maks)}</text>`
  }).join('')

  const batang = perHari.map((h, i) => {
    const tp = tinggi(h.publikasi)
    const tt = tinggi(h.tinggi)
    const y = 16 + tinggiBidang - tp
    return `<g><title>${esc(tanggalPendek(h.tanggal))}: ${h.publikasi} publikasi, ${h.peristiwa} peristiwa, ${h.tinggi} berurgensi tinggi</title>
      <rect x="${x(i)}" y="${y}" width="${lebarBatang}" height="${Math.max(tp, h.publikasi ? 2 : 0)}"
        rx="3" fill="${WARNA.kritis}" opacity="0.28"/>
      ${tt ? `<rect x="${x(i)}" y="${16 + tinggiBidang - tt}" width="${lebarBatang}" height="${Math.max(tt, 2)}"
        rx="3" fill="${WARNA.kritis}"/>` : ''}
      ${h.publikasi ? `<text x="${x(i) + lebarBatang / 2}" y="${y - 5}" text-anchor="middle"
        style="font-size:10px;font-weight:700;fill:${WARNA.tinta}">${h.publikasi}</text>` : ''}
      <text x="${x(i) + lebarBatang / 2}" y="${T - 12}" text-anchor="middle"
        style="font-size:8.5px;fill:${WARNA.tinta3}">${esc(tanggalPendek(h.tanggal))}</text>
      <text x="${x(i) + lebarBatang / 2}" y="${T - 2}" text-anchor="middle"
        style="font-size:7.5px;fill:${WARNA.tinta4};font-family:monospace">${esc(namaHari(h.tanggal).slice(0, 3))}</text>
    </g>`
  }).join('')

  return `<svg viewBox="0 0 ${L} ${T}" role="img" class="bagan-lebar"
    aria-label="Publikasi negatif per hari">${kisi}${batang}</svg>
  <div class="legenda-baris">
    <span><i style="background:${WARNA.kritis};opacity:0.28"></i>Seluruh publikasi negatif</span>
    <span><i style="background:${WARNA.kritis}"></i>Berurgensi tinggi atau kritis</span>
  </div>`
}

/** Peringkat eksposur: batang mendatar, satu baris per peristiwa. */
function baganEksposur(peristiwa, maks = 8) {
  const butir = peristiwa.slice(0, maks)
  if (!butir.length) return ''
  const tertinggi = Math.max(...butir.map((p) => p.eksposur), 1)
  return `<div class="peringkat">${butir.map((p, i) => `
    <div class="peringkat-baris">
      <span class="peringkat-no">${i + 1}</span>
      <div class="peringkat-isi">
        <div class="peringkat-judul">${esc(potong(p.judul, 78))}</div>
        <div class="peringkat-lacak">
          <i style="width:${Math.max(4, (p.eksposur / tertinggi) * 100)}%;background:${WARNA[nadaUrgensi(p.urgensi)]}"></i>
        </div>
      </div>
      <div class="peringkat-angka">
        <b>${angka(p.jumlah_publikasi)}</b><span>publikasi</span>
      </div>
      <div class="peringkat-angka">
        <b>${angka(p.jumlah_media)}</b><span>media</span>
      </div>
    </div>`).join('')}</div>`
}

/**
 * UPT yang naik ke permukaan: batang mendatar dengan bayangan periode lalu.
 *
 * Digambar sebagai div berlatar, bukan sebagai SVG. Alasannya cetak: laporan
 * ini rutin dicetak menjadi PDF lewat menu cetak peramban, dan batang yang
 * dibuat dari latar belakang tetap tercetak pada pengaturan bawaan — sedangkan
 * SVG berisi ratusan simpul memperlambat pratinjau cetaknya tanpa menambah
 * satu pun keterangan.
 */
function baganUptNaik(daftar, periode = {}, maks = 10) {
  const butir = (daftar || []).filter((u) => u.publikasi > 0).slice(0, maks)
  if (!butir.length) return '<p class="samar">Tidak ada unit terpetakan pada periode ini.</p>'

  // Skalanya memuat periode sebelumnya juga; kalau tidak, unit yang justru
  // mereda tergambar dengan bayangan melewati tepi kotaknya.
  const tertinggi = Math.max(1, ...butir.map((u) => Math.max(u.publikasi, u.sebelum || 0)))

  return `<div class="naik">${butir.map((u, i) => {
    const arah = u.sebelum === 0 ? 'baru' : u.delta > 0 ? 'naik' : u.delta < 0 ? 'turun' : 'tetap'
    const label = u.sebelum === 0 ? 'baru muncul'
      : u.delta === 0 ? 'tetap'
        : `${u.delta > 0 ? '+' : '−'}${Math.abs(u.delta)}`
    return `
    <div class="naik-baris">
      <span class="naik-no">${i + 1}</span>
      <span class="naik-nama">${esc(potong(u.nama, 44))}</span>
      <span class="naik-lacak">
        ${u.sebelum ? `<i class="naik-lalu" style="width:${((u.sebelum / tertinggi) * 100).toFixed(1)}%"></i>` : ''}
        <i class="naik-kini" style="width:${((u.publikasi / tertinggi) * 100).toFixed(1)}%"></i>
      </span>
      <b class="naik-angka">${angka(u.publikasi)}</b>
      <span class="naik-delta naik-${arah}">${esc(label)}</span>
    </div>`
  }).join('')}</div>
  <p class="ket">Batang gelap periode ini, batang bergaris di belakangnya periode sebelumnya${
    periode.pembanding_mulai
      ? ` (${esc(tanggalPendek(periode.pembanding_mulai))} – ${esc(tanggalPendek(periode.pembanding_selesai))})`
      : ''}. Diurutkan menurut jumlah publikasi, bukan menurut kenaikan — kenaikan terbesar
     hampir selalu dimiliki unit yang sebelumnya nol dan sekarang dua.</p>`
}

/** Sebaran wilayah sebagai pita bertingkat, bukan peta — cetak tetap terbaca. */
function baganProvinsi(perProvinsi) {
  if (!perProvinsi.length) return '<p class="samar">Belum ada peristiwa yang terhubung ke provinsi.</p>'
  const maks = Math.max(...perProvinsi.map((p) => p.publikasi), 1)
  return `<div class="wilayah">${perProvinsi.slice(0, 10).map((p) => `
    <div class="wilayah-baris">
      <span class="wilayah-nama">${esc(p.nama)}</span>
      <div class="wilayah-lacak">
        <i style="width:${(p.publikasi / maks) * 100}%"></i>
      </div>
      <b class="wilayah-angka">${angka(p.publikasi)}</b>
      <span class="wilayah-sub">${angka(p.peristiwa)} peristiwa</span>
    </div>`).join('')}</div>`
}

function potong(teks, n) {
  const t = String(teks ?? '').trim()
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`
}

/* ---------------------------------------------------------------- bagian */

function bagianKop(d, opsi) {
  const keadaan = nilaiKeadaan(d)
  const jenis = (opsi.jenis || 'mingguan').toUpperCase()
  const periode = d.periode.mulai === d.periode.selesai
    ? `${namaHari(d.periode.mulai)}, ${tanggalPanjang(d.periode.mulai)}`
    : `${tanggalPanjang(d.periode.mulai)} — ${tanggalPanjang(d.periode.selesai)}`

  return `
  <header class="kop">
    <div class="kop-lambang">CI</div>
    <div class="kop-teks">
      <div class="kop-lembaga">Kementerian Imigrasi dan Pemasyarakatan<br>Direktorat Jenderal Pemasyarakatan</div>
      <h1>Laporan Intelijen Pemberitaan Negatif</h1>
      <div class="kop-sub">Laporan ${esc(jenis)} · Direktorat Pengamanan dan Intelijen</div>
    </div>
    <div class="kop-kanan">
      <div class="kop-nomor">${esc(opsi.nomor || nomorLaporan(opsi.jenis, opsi.urutan || 1, d.periode.selesai))}</div>
      <div class="kop-periode">${esc(periode)}</div>
      <span class="pil pil-${keadaan.nada}">${esc(keadaan.label)}</span>
    </div>
  </header>`
}

function ubin(label, nilai, kaki, nada) {
  return `<div class="ubin ubin-${nada}">
    <span class="ubin-label">${esc(label)}</span>
    <span class="ubin-nilai">${angka(nilai)}</span>
    <span class="ubin-kaki">${kaki}</span>
  </div>`
}

function bagianIkhtisar(d) {
  const { ikhtisar, konteks } = d
  const keadaan = nilaiKeadaan(d)

  const komposisi = d.perKategori.map((k) => ({
    label: k.nama, nilai: k.publikasi, warna: RONA_KATEGORI[k.nama] || WARNA.netral,
  }))

  const selisih = konteks.lalu_negatif
    ? ((ikhtisar.publikasi - konteks.lalu_negatif) / konteks.lalu_negatif) * 100
    : null

  return `
  <section class="bagian">
    <h2>Ikhtisar Pemberitaan Negatif</h2>

    <div class="ikhtisar">
      <div class="ikhtisar-donat">
        ${donat(komposisi)}
        ${legenda(komposisi, ikhtisar.publikasi)}
      </div>

      <div class="ikhtisar-ubin">
        ${ubin('Peristiwa negatif', ikhtisar.peristiwa, `dari ${angka(ikhtisar.publikasi)} publikasi`, 'kritis')}
        ${ubin('Perlu respons segera', ikhtisar.mendesak, ikhtisar.kritis ? `${angka(ikhtisar.kritis)} berstatus kritis` : 'berurgensi tinggi', 'tinggi')}
        ${ubin('UPT terdampak', ikhtisar.unit, `${angka(ikhtisar.tanpaUnit)} peristiwa belum terpetakan`, 'aksen')}
        ${ubin('Media pemberitaan', ikhtisar.media, `eksposur tertinggi ${angka(ikhtisar.eksposurTertinggi)}`, 'netral')}
      </div>
    </div>

    <div class="kesimpulan kesimpulan-${keadaan.nada}">
      <div class="kesimpulan-label">Kesimpulan Umum</div>
      <div class="kesimpulan-nilai">${esc(keadaan.label)}</div>
      <p>${esc(keadaan.kalimat)}</p>
      <p class="kesimpulan-banding">
        Pada periode ini terpantau <b>${angka(ikhtisar.publikasi)}</b> publikasi negatif dari total
        <b>${angka(konteks.total || 0)}</b> publikasi dalam lingkup Pemasyarakatan
        (${persen(ikhtisar.publikasi, konteks.total || 0)}).
        ${selisih === null ? ''
          : `Dibanding periode ${esc(tanggalPendek(d.periode.pembanding_mulai))}–${esc(tanggalPendek(d.periode.pembanding_selesai))},
             pemberitaan negatif <b>${selisih >= 0 ? 'naik' : 'turun'} ${Math.abs(selisih).toFixed(1).replace('.', ',')} persen</b>.`}
        Sebagai penyeimbang, tercatat <b>${angka(konteks.positif || 0)}</b> publikasi positif pada periode yang sama;
        rinciannya berada di luar cakupan laporan ini.
      </p>
    </div>
  </section>`
}

function bagianPrioritas(d) {
  const utama = d.peristiwa[0]
  if (!utama) return ''
  const nada = nadaUrgensi(utama.urgensi)
  const unit = belumTerpetakan(utama.nama_upt) ? null : utama.nama_upt

  return `
  <section class="bagian">
    <h2>Isu Negatif Prioritas</h2>
    <div class="prioritas prioritas-${nada}">
      <div class="prioritas-label">Peristiwa dengan eksposur tertinggi</div>
      <h3>${esc(utama.judul)}</h3>
      <div class="prioritas-meta">
        ${unit ? `<span><b>${esc(unit)}</b></span>` : '<span><b>UPT belum teridentifikasi</b></span>'}
        <span>${esc(utama.subkategori)}</span>
        <span>${esc(tanggalPendek(utama.tanggal_pertama))} — ${esc(tanggalPendek(utama.tanggal_terakhir))}</span>
      </div>
      <div class="prioritas-angka">
        <div><b>${angka(utama.jumlah_publikasi)}</b><span>Publikasi</span></div>
        <div><b>${angka(utama.jumlah_media)}</b><span>Media berbeda</span></div>
        <div><b>${angka(utama.rentang_hari)}</b><span>Hari beredar</span></div>
        <div><b class="nada">${esc(utama.urgensi)}</b><span>Urgensi</span></div>
      </div>
      <p class="prioritas-catatan">
        Satu peristiwa ini menyumbang ${persen(utama.jumlah_publikasi, d.ikhtisar.publikasi)}
        dari seluruh publikasi negatif pada periode ini.
      </p>
    </div>
  </section>`
}

function bagianPeringkat(d) {
  if (!d.peristiwa.length) return ''
  return `
  <section class="bagian">
    <h2>Peringkat Eksposur Peristiwa</h2>
    <p class="ket">Panjang batang menunjukkan tekanan opini: media yang berbeda dihitung
      lebih berat daripada satu media yang mengulang berkali-kali.</p>
    ${baganEksposur(d.peristiwa)}
  </section>`
}

function bagianTabelPeristiwa(d) {
  if (!d.peristiwa.length) return ''
  return `
  <section class="bagian">
    <h2>Daftar Peristiwa Negatif</h2>
    <table class="tabel">
      <thead><tr>
        <th style="width:26px">No</th><th>Peristiwa</th><th>UPT</th>
        <th class="ka">Pub</th><th class="ka">Media</th><th>Urgensi</th>
      </tr></thead>
      <tbody>
        ${d.peristiwa.map((p, i) => `
        <tr>
          <td class="mono">${i + 1}</td>
          <td>
            <div class="tebal">${esc(potong(p.judul, 96))}</div>
            <div class="kecil samar">${esc(p.subkategori)} · ${esc(tanggalPendek(p.tanggal_pertama))}</div>
          </td>
          <td class="kecil">${esc(belumTerpetakan(p.nama_upt) ? '—' : potong(p.nama_upt, 30))}</td>
          <td class="ka mono">${angka(p.jumlah_publikasi)}</td>
          <td class="ka mono">${angka(p.jumlah_media)}</td>
          <td><span class="pil-kecil pil-${nadaUrgensi(p.urgensi)}">${esc(p.urgensi)}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>`
}

function bagianUnit(d) {
  if (!d.daftarUnit.length) {
    return `<section class="bagian"><h2>UPT Paling Disorot</h2>
      <p class="samar">Tidak ada peristiwa negatif yang terhubung ke unit mana pun pada periode ini.
      Angka per unit tidak dapat disusun.</p></section>`
  }
  return `
  <section class="bagian">
    <h2>UPT Paling Disorot</h2>
    <p class="ket">Unit mana yang naik ke permukaan pada periode ini, dan berapa publikasinya.</p>
    ${baganUptNaik(d.uptNaik || d.daftarUnit, d.periode)}
    <table class="tabel">
      <thead><tr>
        <th style="width:26px">No</th><th>UPT</th><th>Provinsi</th>
        <th>Isu Utama</th><th class="ka">Peristiwa</th><th class="ka">Publikasi</th><th>Risiko</th>
      </tr></thead>
      <tbody>
        ${d.daftarUnit.slice(0, 10).map((u, i) => `
        <tr>
          <td class="mono">${i + 1}</td>
          <td><div class="tebal">${esc(u.nama)}</div>
              <div class="kecil samar">${esc(potong(u.sorotan, 74))}</div></td>
          <td class="kecil">${esc(u.provinsi || '—')}</td>
          <td class="kecil">${esc(u.isu.slice(0, 2).join(', '))}</td>
          <td class="ka mono">${angka(u.peristiwa)}</td>
          <td class="ka mono">${angka(u.publikasi)}</td>
          <td><span class="pil-kecil pil-${nadaUrgensi(u.urgensi)}">${esc(u.urgensi)}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>`
}

function bagianHarian(d) {
  return `
  <section class="bagian">
    <h2>Rekap Harian</h2>
    ${baganHarian(d.perHari)}
    <table class="tabel rapat">
      <thead><tr><th>Tanggal</th><th class="ka">Publikasi</th><th class="ka">Peristiwa</th>
        <th class="ka">Urgensi tinggi</th><th>Isu utama</th><th>Sorotan</th></tr></thead>
      <tbody>
        ${d.perHari.map((h) => `
        <tr${h.publikasi ? '' : ' class="sepi"'}>
          <td class="kecil">${esc(namaHari(h.tanggal))}, ${esc(tanggalPendek(h.tanggal))}</td>
          <td class="ka mono">${h.publikasi || '—'}</td>
          <td class="ka mono">${h.peristiwa || '—'}</td>
          <td class="ka mono ${h.tinggi ? 'merah' : ''}">${h.tinggi || '—'}</td>
          <td class="kecil">${esc(h.isu_utama || '—')}</td>
          <td class="kecil samar">${esc(potong(h.sorotan || '—', 58))}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </section>`
}

function bagianWilayah(d) {
  return `
  <section class="bagian">
    <h2>Sebaran Wilayah</h2>
    <p class="ket">Hanya peristiwa yang unitnya sudah terpetakan yang muncul di sini.</p>
    ${baganProvinsi(d.perProvinsi)}
  </section>`
}

function bagianRekomendasi(d) {
  const r = susunRekomendasi(d)
  return `
  <section class="bagian">
    <h2>Rekomendasi Tindak Lanjut</h2>
    <ol class="rekomendasi">${r.map((x) => `<li>${x}</li>`).join('')}</ol>
  </section>`
}

/**
 * Daftar sumber. Bagian ini yang membuat laporan bisa dipertanggungjawabkan:
 * setiap angka di atas dapat ditelusuri ke publikasi yang menjadi dasarnya,
 * lengkap dengan media, tanggal, dan tautannya.
 */
function bagianSumber(d) {
  if (!d.peristiwa.length) return ''

  return `
  <section class="bagian pecah">
    <h2>Daftar Sumber Pemberitaan</h2>
    <p class="ket">Seluruh ${angka(d.publikasi.length)} publikasi yang menjadi dasar laporan ini,
      dikelompokkan menurut peristiwanya.</p>

    ${d.peristiwa.map((p, i) => `
    <div class="sumber-kelompok">
      <div class="sumber-kop">
        <span class="sumber-no">${i + 1}</span>
        <div>
          <div class="sumber-judul">${esc(potong(p.judul, 110))}</div>
          <div class="kecil samar">${esc(p.subkategori)} ·
            ${esc(belumTerpetakan(p.nama_upt) ? 'unit belum terpetakan' : p.nama_upt)} ·
            ${angka(p.jumlah_publikasi)} publikasi</div>
        </div>
        <span class="pil-kecil pil-${nadaUrgensi(p.urgensi)}">${esc(p.urgensi)}</span>
      </div>
      <ol class="sumber-daftar">
        ${p.publikasi
          .slice()
          .sort((a, b) => String(a.tanggal || '').localeCompare(String(b.tanggal || '')))
          .map((b) => `
          <li>
            <span class="sumber-tanggal">${esc(tanggalPendek(b.tanggal))}</span>
            <span class="sumber-media">${esc(sumberAsli(b))}</span>
            <span class="sumber-teks">${b.link
              ? `<a href="${esc(b.link)}" target="_blank" rel="noopener noreferrer">${esc(potong(b.judul, 92))}</a>`
              : esc(potong(b.judul, 92))}</span>
            <span class="sumber-platform">${esc(b.platform || '—')}</span>
          </li>`).join('')}
      </ol>
    </div>`).join('')}
  </section>`
}

function bagianCatatan(d, opsi) {
  const { ikhtisar, publikasi, perluTelaah } = d
  const terverifikasi = publikasi.filter((b) => b.status_verifikasi === 'Terverifikasi').length

  return `
  <section class="bagian catatan">
    <h2>Catatan Batasan</h2>
    <ul>
      <li>Laporan ini <b>hanya memuat pemberitaan bersentimen negatif dan campuran</b>.
        Publikasi positif dan netral dihitung sebagai konteks, tidak dirinci.</li>
      <li>Satuan analisis adalah <b>peristiwa</b>. Beberapa publikasi yang menunjuk kejadian yang
        sama digabungkan; jumlah publikasi tetap ditampilkan sebagai ukuran eksposur, bukan
        sebagai jumlah kejadian.</li>
      <li>Klasifikasi dikerjakan mesin aturan Trans-Siber PAS dan
        <b>tetap memerlukan validasi Analis Intelijen Media</b> sebelum dijadikan dasar keputusan.
        Pada periode ini ${angka(terverifikasi)} dari ${angka(publikasi.length)} publikasi sudah
        diverifikasi analis${perluTelaah.length ? `, dan ${angka(perluTelaah.length)} ditandai perlu telaah` : ''}.</li>
      <li>${angka(ikhtisar.tanpaUnit)} peristiwa belum terhubung ke unit mana pun. Angka pada rekap
        per unit dan per wilayah hanya menghitung peristiwa yang sudah terpetakan.</li>
      <li>Pemantauan bersumber dari kanal publik terindeks. Publikasi yang tidak terindeks pada
        periode ini tidak tercakup.</li>
    </ul>
  </section>`
}

function waktuSusun(iso) {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return '-'
  const wib = new Date(t.getTime() + 7 * 3600000)
  const jam = String(wib.getUTCHours()).padStart(2, '0')
  const menit = String(wib.getUTCMinutes()).padStart(2, '0')
  return `${tanggalPanjang(wib.toISOString())} pukul ${jam}.${menit} WIB`
}

/* ------------------------------------------------------------------- gaya */

const GAYA = `
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0; background: #E7ECF4; color: ${WARNA.tinta};
  font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13px; line-height: 1.55; -webkit-font-smoothing: antialiased;
}
.lembar { max-width: 940px; margin: 0 auto; background: #fff; box-shadow: 0 4px 28px rgba(15,30,60,.14); }
.mono, .ka.mono { font-family: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
.ka { text-align: right; }
.kecil { font-size: 11.5px; }
.samar { color: ${WARNA.tinta3}; }
.tebal { font-weight: 650; }
.merah { color: ${WARNA.kritis}; font-weight: 700; }

/* Kop */
.kop {
  display: flex; gap: 16px; align-items: flex-start;
  background: linear-gradient(135deg, #12335F 0%, #1D4E8F 55%, #2A5FA8 100%);
  color: #fff; padding: 22px 26px;
}
.kop-lambang {
  width: 44px; height: 44px; border-radius: 10px; flex: none;
  background: linear-gradient(140deg, #C89A34, #A9791C); color: #1A1206;
  display: grid; place-items: center; font-weight: 800; font-size: 16px;
}
.kop-teks { flex: 1; min-width: 0; }
.kop-lembaga { font-family: "IBM Plex Mono", monospace; font-size: 9px; letter-spacing: .1em; opacity: .78; line-height: 1.5; text-transform: uppercase; }
.kop h1 { margin: 5px 0 2px; font-size: 21px; font-weight: 800; letter-spacing: -.03em; }
.kop-sub { font-size: 11.5px; opacity: .82; }
.kop-kanan { text-align: right; flex: none; }
.kop-nomor { font-family: "IBM Plex Mono", monospace; font-size: 10px; letter-spacing: .06em; opacity: .85; }
.kop-periode { font-size: 12.5px; font-weight: 600; margin: 3px 0 8px; }
.pil { display: inline-block; padding: 4px 11px; border-radius: 999px; font-size: 10px; font-weight: 800; letter-spacing: .08em; }
.pil-kritis { background: #FCE3E0; color: #7E120C; }
.pil-tinggi { background: #FBEBD9; color: #7C3B0A; }
.pil-sedang { background: #F8F0D6; color: #5E470B; }
.pil-positif { background: #D9EFE4; color: #0B5540; }
.pil-rendah { background: #E6EBF3; color: #35415A; }

/* Bagian */
.bagian { padding: 22px 26px; border-bottom: 1px solid ${WARNA.garis2}; }
.bagian:last-child { border-bottom: none; }
.bagian h2 {
  margin: 0 0 12px; font-size: 14.5px; font-weight: 800; letter-spacing: -.02em;
  padding-bottom: 6px; border-bottom: 2px solid ${WARNA.aksen}; display: inline-block;
}
.ket { margin: -6px 0 12px; font-size: 11.5px; color: ${WARNA.tinta3}; }

/* Ikhtisar */
.ikhtisar { display: grid; grid-template-columns: minmax(240px, 320px) 1fr; gap: 22px; align-items: start; }
.ikhtisar-donat { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
.legenda { margin: 0; display: flex; flex-direction: column; gap: 5px; min-width: 140px; }
.legenda div { display: flex; align-items: center; gap: 7px; font-size: 11.5px; }
.legenda i { width: 9px; height: 9px; border-radius: 2px; flex: none; }
.legenda span { flex: 1; min-width: 0; }
.legenda b { font-family: "IBM Plex Mono", monospace; font-variant-numeric: tabular-nums; }
.legenda em { font-style: normal; color: ${WARNA.tinta4}; font-size: 10.5px; width: 42px; text-align: right; }

.ikhtisar-ubin { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.ubin { border: 1px solid ${WARNA.garis}; border-left: 3px solid ${WARNA.netral}; border-radius: 9px; padding: 11px 13px; }
.ubin-label { display: block; font-family: "IBM Plex Mono", monospace; font-size: 8.5px; letter-spacing: .11em; text-transform: uppercase; color: ${WARNA.tinta4}; }
.ubin-nilai { display: block; font-size: 27px; font-weight: 800; letter-spacing: -.045em; line-height: 1.15; }
.ubin-kaki { display: block; font-size: 10.5px; color: ${WARNA.tinta3}; }
.ubin-kritis { border-left-color: ${WARNA.kritis}; } .ubin-kritis .ubin-nilai { color: ${WARNA.kritis}; }
.ubin-tinggi { border-left-color: ${WARNA.tinggi}; } .ubin-tinggi .ubin-nilai { color: ${WARNA.tinggi}; }
.ubin-aksen  { border-left-color: ${WARNA.aksen2}; } .ubin-aksen .ubin-nilai { color: ${WARNA.aksen}; }
.ubin-netral { border-left-color: ${WARNA.netral}; }

.kesimpulan { margin-top: 16px; border: 1px solid ${WARNA.garis}; border-left: 4px solid ${WARNA.netral}; border-radius: 9px; padding: 13px 15px; background: #FAFCFF; }
.kesimpulan-kritis { border-left-color: ${WARNA.kritis}; background: #FEF7F6; }
.kesimpulan-tinggi { border-left-color: ${WARNA.tinggi}; background: #FFFBF5; }
.kesimpulan-positif { border-left-color: ${WARNA.positif}; background: #F6FCF9; }
.kesimpulan-label { font-family: "IBM Plex Mono", monospace; font-size: 8.5px; letter-spacing: .11em; text-transform: uppercase; color: ${WARNA.tinta4}; }
.kesimpulan-nilai { font-size: 17px; font-weight: 800; letter-spacing: -.02em; margin: 1px 0 4px; }
.kesimpulan p { margin: 0 0 6px; font-size: 12px; }
.kesimpulan-banding { color: ${WARNA.tinta2}; border-top: 1px solid ${WARNA.garis2}; padding-top: 7px; margin-bottom: 0 !important; }

/* Prioritas */
.prioritas { border: 1px solid ${WARNA.garis}; border-top: 4px solid ${WARNA.kritis}; border-radius: 10px; padding: 15px 17px; background: #FEF8F7; }
.prioritas-tinggi { border-top-color: ${WARNA.tinggi}; background: #FFFBF5; }
.prioritas-sedang { border-top-color: ${WARNA.sedang}; background: #FFFDF6; }
.prioritas-rendah { border-top-color: ${WARNA.rendah}; background: #FAFBFD; }
.prioritas-label { font-family: "IBM Plex Mono", monospace; font-size: 8.5px; letter-spacing: .11em; text-transform: uppercase; color: ${WARNA.kritis}; font-weight: 600; }
.prioritas h3 { margin: 4px 0 7px; font-size: 15.5px; font-weight: 750; letter-spacing: -.02em; line-height: 1.35; }
.prioritas-meta { display: flex; gap: 14px; flex-wrap: wrap; font-size: 11.5px; color: ${WARNA.tinta3}; margin-bottom: 11px; }
.prioritas-meta b { color: ${WARNA.tinta}; }
.prioritas-angka { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; border-top: 1px solid ${WARNA.garis}; padding-top: 11px; }
.prioritas-angka b { display: block; font-size: 21px; font-weight: 800; letter-spacing: -.04em; }
.prioritas-angka b.nada { color: ${WARNA.kritis}; font-size: 15px; }
.prioritas-angka span { font-family: "IBM Plex Mono", monospace; font-size: 8.5px; letter-spacing: .09em; text-transform: uppercase; color: ${WARNA.tinta4}; }
.prioritas-catatan { margin: 10px 0 0; font-size: 11.5px; color: ${WARNA.tinta2}; }

/* Peringkat eksposur */
.peringkat { display: flex; flex-direction: column; gap: 9px; }
.peringkat-baris { display: flex; align-items: center; gap: 11px; }
.peringkat-no { width: 19px; height: 19px; border-radius: 5px; background: ${WARNA.aksen}; color: #fff; font-size: 10px; font-weight: 700; display: grid; place-items: center; flex: none; }
.peringkat-isi { flex: 1; min-width: 0; }
.peringkat-judul { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.peringkat-lacak { height: 7px; border-radius: 999px; background: ${WARNA.garis2}; overflow: hidden; }
.peringkat-lacak i { display: block; height: 100%; border-radius: 999px; }
.peringkat-angka { text-align: right; flex: none; width: 52px; }
.peringkat-angka b { display: block; font-family: "IBM Plex Mono", monospace; font-size: 13px; font-weight: 700; }
.peringkat-angka span { font-size: 8.5px; color: ${WARNA.tinta4}; letter-spacing: .06em; text-transform: uppercase; }

/* Bagan */
.bagan-lebar { width: 100%; height: auto; display: block; }
.legenda-baris { display: flex; gap: 16px; font-size: 11px; color: ${WARNA.tinta3}; margin: 6px 0 12px; }
.legenda-baris i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; }

/* Wilayah */
.wilayah { display: flex; flex-direction: column; gap: 7px; }
.wilayah-baris { display: grid; grid-template-columns: 150px 1fr 34px 78px; gap: 10px; align-items: center; font-size: 11.5px; }
.wilayah-nama { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wilayah-lacak { height: 8px; border-radius: 999px; background: ${WARNA.garis2}; overflow: hidden; }
.wilayah-lacak i { display: block; height: 100%; background: linear-gradient(90deg, ${WARNA.kritis}, #C2564C); border-radius: 999px; }
.wilayah-angka { font-family: "IBM Plex Mono", monospace; text-align: right; font-weight: 700; }
.wilayah-sub { color: ${WARNA.tinta4}; font-size: 10.5px; }

/* Tabel */
table.tabel { width: 100%; border-collapse: collapse; margin-top: 10px; }
table.tabel th {
  text-align: left; font-family: "IBM Plex Mono", monospace; font-size: 8.5px;
  letter-spacing: .1em; text-transform: uppercase; color: ${WARNA.tinta4};
  font-weight: 500; padding: 7px 8px; background: #F3F6FB; border-bottom: 1px solid ${WARNA.garis};
}
table.tabel td { padding: 8px; border-bottom: 1px solid ${WARNA.garis2}; vertical-align: top; font-size: 12px; }
table.tabel tr.sepi td { color: ${WARNA.tinta4}; background: #FBFCFE; }
table.tabel.rapat td { padding: 6px 8px; }
.pil-kecil { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 9.5px; font-weight: 700; letter-spacing: .03em; white-space: nowrap; }

/* Rekomendasi */
.rekomendasi { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }
.rekomendasi li { font-size: 12.5px; }

/* Sumber */
.sumber-kelompok { border: 1px solid ${WARNA.garis2}; border-radius: 9px; margin-bottom: 11px; overflow: hidden; break-inside: avoid; }
.sumber-kop { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: #F5F8FC; border-bottom: 1px solid ${WARNA.garis2}; }
.sumber-no { width: 20px; height: 20px; border-radius: 5px; background: ${WARNA.aksen}; color: #fff; font-size: 10px; font-weight: 700; display: grid; place-items: center; flex: none; }
.sumber-kop > div { flex: 1; min-width: 0; }
.sumber-judul { font-size: 12.5px; font-weight: 650; }
.sumber-daftar { margin: 0; padding: 6px 12px 9px 32px; }
.sumber-daftar li { font-size: 11.5px; padding: 4px 0; border-bottom: 1px dotted ${WARNA.garis2}; display: grid; grid-template-columns: 52px 118px 1fr 70px; gap: 9px; align-items: baseline; }
.sumber-daftar li:last-child { border-bottom: none; }
.sumber-tanggal { font-family: "IBM Plex Mono", monospace; font-size: 10px; color: ${WARNA.tinta4}; }
.sumber-media { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sumber-teks a { color: ${WARNA.aksen2}; text-decoration: none; }
.sumber-teks a:hover { text-decoration: underline; }
.sumber-platform { font-size: 10px; color: ${WARNA.tinta4}; text-align: right; }

/* Catatan */
.catatan { background: #F7F9FC; }
.catatan ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; }
.catatan li { font-size: 11.5px; color: ${WARNA.tinta2}; }

/* Kaki */
.kaki { padding: 15px 26px; background: ${WARNA.aksen}; color: rgba(255,255,255,.78); font-size: 10.5px; }
.kaki b { color: #fff; }

@media print {
  body { background: #fff; }
  .lembar { box-shadow: none; max-width: none; }
  .bagian { break-inside: avoid; }
  .pecah { break-before: page; }
  a { color: ${WARNA.aksen2} !important; }
}
@media (max-width: 720px) {
  .ikhtisar { grid-template-columns: 1fr; }
  .ikhtisar-ubin { grid-template-columns: 1fr 1fr; }
  .prioritas-angka { grid-template-columns: 1fr 1fr; }
  .wilayah-baris { grid-template-columns: 100px 1fr 30px; }
  .wilayah-sub { display: none; }
  .sumber-daftar li { grid-template-columns: 46px 1fr; }
  .sumber-platform { display: none; }
  .kop { flex-wrap: wrap; }
  .kop-kanan { text-align: left; }
}
`

/*
   Gaya bagan "UPT naik ke permukaan".

   Ditulis sebagai deret sambungan, bukan sebagai templat berlubang, supaya
   warnanya diambil dari WARNA yang sama dengan seluruh bagan lain di berkas
   ini — satu palet, bukan dua yang kebetulan mirip.
*/
const GAYA_NAIK = `
.naik { display: flex; flex-direction: column; gap: 6px; margin: 10px 0 6px; }

.naik-baris {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) minmax(80px, 1.4fr) 34px 62px;
  align-items: center;
  gap: 8px;
  font-size: 10pt;
}

.naik-no { color: ${WARNA.tinta4}; text-align: right; font-size: 8.5pt; }
.naik-nama { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.naik-lacak {
  position: relative;
  height: 9px;
  border-radius: 4px;
  background: ${WARNA.garis2};
  overflow: hidden;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.naik-lacak i {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-radius: 4px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* Periode sebelumnya digambar bergaris, bukan pudar. Pada cetakan hitam-putih
   dua abu-abu yang berdekatan menjadi satu warna; arsiran tetap terbedakan. */
.naik-lalu {
  background: repeating-linear-gradient(135deg, ${WARNA.tinta4} 0 2px, transparent 2px 5px);
}

.naik-kini { background: ${WARNA.aksen2}; }

.naik-angka { text-align: right; font-variant-numeric: tabular-nums; }

.naik-delta {
  font-size: 8.5pt;
  font-weight: 600;
  text-align: right;
  color: ${WARNA.tinta4};
}

.naik-baru, .naik-naik { color: ${WARNA.kritis}; }
.naik-turun { color: ${WARNA.positif}; }
`

/* ------------------------------------------------------------ pintu utama */

/**
 * Menyusun satu berkas HTML laporan yang berdiri sendiri.
 *
 * @param {object} snapshot hasil public.snapshot_negatif()
 * @param {object} [opsi]
 * @param {'harian'|'mingguan'|'bulanan'} [opsi.jenis]
 * @param {number} [opsi.urutan] nomor urut laporan
 * @param {string} [opsi.nomor] nomor lengkap, bila ingin ditentukan sendiri
 */
export function susunLaporan(snapshot, opsi = {}) {
  const d = olahLaporan(snapshot)
  const jenis = opsi.jenis || 'mingguan'
  const nomor = opsi.nomor || nomorLaporan(jenis, opsi.urutan || 1, d.periode.selesai)
  const judul = `Laporan Intelijen Pemberitaan Negatif ${jenis === 'harian' ? 'Harian' : 'Mingguan'} — ${tanggalPanjang(d.periode.selesai)}`

  const kosong = !d.peristiwa.length

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(judul)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>${GAYA}${GAYA_NAIK}</style>
</head>
<body>
<div class="lembar">
  ${bagianKop(d, { ...opsi, jenis, nomor })}
  ${bagianIkhtisar(d)}
  ${kosong ? `<section class="bagian"><h2>Tidak Ada Peristiwa Negatif</h2>
      <p>Pada periode ini tidak terpantau publikasi bersentimen negatif dalam lingkup
      Pemasyarakatan. Periode sepi adalah keadaan yang sah; pastikan saja sinkronisasi
      sumber memang berjalan pada rentang tanggal tersebut.</p></section>` : `
  ${bagianPrioritas(d)}
  ${bagianPeringkat(d)}
  ${bagianTabelPeristiwa(d)}
  ${bagianUnit(d)}
  ${bagianHarian(d)}
  ${bagianWilayah(d)}
  ${bagianRekomendasi(d)}
  ${bagianSumber(d)}`}
  ${bagianCatatan(d, opsi)}
  <footer class="kaki">
    <b>Direktorat Pengamanan dan Intelijen</b> · Direktorat Jenderal Pemasyarakatan ·
    ${esc(nomor)}<br>
    Disusun otomatis oleh Trans-Siber PAS pada ${esc(waktuSusun(d.dibuat_pada))}.
    Mesin klasifikasi aturan, tanpa penyedia AI luar.
  </footer>
</div>
</body>
</html>`
}

export const META_LAPORAN = { versi: 'laporan-v2.0', lingkup: 'negatif' }
