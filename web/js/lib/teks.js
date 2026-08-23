/**
 * Pengolah teks bahasa Indonesia untuk Cyber-Intelpas.
 *
 * Berkas ini lahir dari satu temuan: mesin lama mencocokkan kata kunci dengan
 * `indexOf` biasa. Akibatnya dua kesalahan terjadi bersamaan setiap hari.
 *
 *   Terlalu longgar — kata kunci "sabu" ikut cocok di dalam "pembuatan sabun",
 *   sehingga kegiatan kemandirian warga binaan tercatat sebagai peredaran
 *   narkotika.
 *
 *   Terlalu ketat — kata kunci "penganiayaan" tidak pernah cocok pada judul
 *   yang menulis "dianiaya" atau "menganiaya", padahal ketiganya satu peristiwa.
 *   Bahasa Indonesia membentuk kata dengan imbuhan, dan pencocokan huruf per
 *   huruf buta terhadap hal itu.
 *
 * Tiga hal yang dikerjakan di sini:
 *
 *   1. Normalisasi. Termasuk memulihkan angka yang dipakai menggantikan huruf
 *      untuk menghindari saringan media sosial — "kem4tian" menjadi "kematian".
 *      Penggantian hanya dilakukan bila angka itu terjepit di antara dua huruf,
 *      supaya "HUT ke-81" tidak ikut rusak.
 *
 *   2. Pencarian akar kata. Bukan pemenggal penuh Nazief-Adriani, melainkan
 *      pembangkit kemungkinan: satu kata menghasilkan beberapa calon akar, dan
 *      dua kata dianggap sekerabat bila himpunan calonnya beririsan. Cara ini
 *      lebih tahan salah daripada memaksakan satu akar tunggal.
 *
 *   3. Pencocokan frasa berbasis kedudukan kata, bukan potongan huruf. Kata
 *      kunci "napi kabur" cocok pada "napi itu kabur"? Tidak — dan memang tidak
 *      boleh, karena urutan kata membawa makna. Yang cocok adalah "napi kabur"
 *      dan "napi kaburnya", karena kekerabatan diuji per kedudukan kata.
 *
 * Modul ES murni tanpa impor. Dipakai di peramban dan di Edge Function Deno.
 */

/* -------------------------------------------------------------- normalisasi */

/** Sisa templat penilaian crawler. Isinya sama untuk hampir semua baris. */
const POLA_BOILERPLATE = [
  /risiko\s*:\s*(rendah|sedang|tinggi|kritis)\s*analisis\s*:[\s\S]*?rekomendasi\s*:[^.]*\.?/gi,
  /risiko\s*:\s*(rendah|sedang|tinggi|kritis)/gi,
  /analisis\s*:\s*berita(\/konten)?\s*bersifat informatif umum[^.]*\./gi,
  /analisis\s*:\s*isu memerlukan perhatian[^.]*\./gi,
  /rekomendasi\s*:\s*arsip[^.]*\./gi,
  /rekomendasi\s*:\s*lakukan pemantauan berkala[^.]*\./gi,
  /generated automatically[^.]*\./gi,
]

/** Ekor nama platform yang menempel pada judul hasil crawl. */
const POLA_EKOR_JUDUL =
  /\s*[-–—]\s*(instagram\.com|facebook\.com|tiktok\.com|x\.com|twitter\.com|youtube\.com|youtube|tiktok|instagram|facebook)\s*$/i

/** Angka yang lazim dipakai menggantikan huruf pada unggahan media sosial. */
const PETA_ANGKA = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 6: 'g', 7: 't', 8: 'b', 9: 'g' }

export function bersihkanTeks(nilai) {
  let teks = String(nilai ?? '')
  for (const pola of POLA_BOILERPLATE) teks = teks.replace(pola, ' ')
  return teks
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\\[nrt]/g, ' ')
    .replace(POLA_EKOR_JUDUL, ' ')
    .replace(/&amp;/g, ' dan ')
    .replace(/&\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Memulihkan huruf yang disamarkan menjadi angka. Hanya berlaku bila angkanya
 * berada di antara dua huruf, sehingga "kem4tian" pulih menjadi "kematian"
 * sedangkan "HUT ke-81" dan "Kelas IIA" tetap utuh.
 */
export function pulihkanSamaran(teks) {
  return teks.replace(/(?<=[a-z])([013456789])(?=[a-z])/g, (m) => PETA_ANGKA[m] || m)
}

export function normalkan(nilai) {
  const dasar = bersihkanTeks(nilai)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return pulihkanSamaran(dasar)
}

/* ------------------------------------------------------------- akar kata */

/**
 * Awalan beserta huruf yang luluh. "meny-" menelan huruf s pada "selundup",
 * "meng-" menelan huruf k pada "kendali". Tanpa pemulihan ini, "menyelundupkan"
 * dan "penyelundupan" tidak akan pernah bertemu dengan "selundup".
 *
 * Urutan berpengaruh: yang lebih panjang harus diuji lebih dulu.
 */
const AWALAN = [
  ['memper', ['']], ['mempe', ['']], ['diper', ['']], ['keter', ['']], ['keber', ['']],
  ['berke', ['']], ['perse', ['']],
  ['meng', ['', 'k']], ['meny', ['s']], ['peng', ['', 'k']], ['peny', ['s']],
  ['mem', ['', 'p']], ['men', ['', 't']], ['pem', ['', 'p']], ['pen', ['', 't']],
  ['ber', ['']], ['bel', ['']], ['ter', ['']], ['per', ['']],
  ['me', ['']], ['pe', ['']], ['be', ['']], ['te', ['']],
  ['di', ['']], ['ke', ['']], ['se', ['']],
]

const AKHIRAN = ['nya', 'lah', 'kah', 'tah', 'pun', 'ku', 'mu', 'kan', 'an', 'i']

/** Panjang minimum sebuah calon akar sebelum ia boleh dipakai mencocokkan. */
const PANJANG_AKAR_MINIMUM = 4

/**
 * Akar yang terlalu umum untuk dipakai menyeberangi bentuk kata.
 *
 * Contoh persoalannya: "pelarian" berakar "lari", dan begitu pula "lomba lari"
 * pada berita peringatan kemerdekaan. Bila keduanya dipertemukan lewat akar,
 * kegiatan olahraga akan tercatat sebagai pelarian warga binaan. Untuk akar
 * dalam daftar ini, pencocokan kembali ke bentuk permukaan apa adanya.
 */
const AKAR_TERLARANG = new Set([
  'lari', 'tangkap', 'jalan', 'main', 'bawa', 'buka', 'tutup', 'naik', 'turun',
  'ambil', 'beri', 'buat', 'dapat', 'pakai', 'kerja', 'tempat', 'laku', 'hasil',
  'kata', 'ikut', 'bagi', 'tinggal', 'lihat', 'datang', 'kena', 'isi', 'ada',
  'guna', 'tuju', 'satu', 'baik', 'besar', 'jadi', 'kali', 'lalu', 'oleh',
  // "Patah" adalah nama orang. Seorang narapidana bernama Patah kabur dari
  // Lapas Warungkiara, dan karena "terpatahkan" berakar "patah", setiap berita
  // tentang pelariannya dibaca mesin sebagai berita bantahan. Nama diri memang
  // tidak boleh ikut dipenggal imbuhannya.
  'patah', 'jaya', 'putra', 'putri', 'agung', 'mulia', 'indah', 'terang',
])

const simpananAkar = new Map()

/**
 * Menghasilkan himpunan calon akar sebuah kata, termasuk bentuk aslinya.
 * Bentuk asli selalu ikut, sehingga kata yang akarnya terlarang tetap bisa
 * dicocokkan secara harfiah.
 */
export function akarKata(kata) {
  const tersimpan = simpananAkar.get(kata)
  if (tersimpan) return tersimpan

  const hasil = new Set([kata])

  // Tahap satu: kupas akhiran, paling banyak dua lapis ("-kan" lalu "-nya").
  let lapis = [kata]
  for (let putaran = 0; putaran < 2 && lapis.length; putaran += 1) {
    const berikut = []
    for (const bentuk of lapis) {
      for (const akhiran of AKHIRAN) {
        if (!bentuk.endsWith(akhiran)) continue
        const sisa = bentuk.slice(0, -akhiran.length)
        if (sisa.length < PANJANG_AKAR_MINIMUM || hasil.has(sisa)) continue
        hasil.add(sisa)
        berikut.push(sisa)
      }
    }
    lapis = berikut
  }

  // Tahap dua: kupas awalan dari setiap bentuk yang sudah terkumpul.
  for (const bentuk of [...hasil]) {
    for (const [awalan, penggantiDepan] of AWALAN) {
      if (!bentuk.startsWith(awalan)) continue
      const sisa = bentuk.slice(awalan.length)
      if (sisa.length < 3) continue
      for (const depan of penggantiDepan) {
        const calon = depan + sisa
        if (calon.length >= PANJANG_AKAR_MINIMUM) hasil.add(calon)
      }
      break // hanya awalan terpanjang yang cocok, supaya tidak beranak pinak
    }
  }

  const bersih = new Set([kata])
  for (const calon of hasil) {
    if (calon.length >= PANJANG_AKAR_MINIMUM && !AKAR_TERLARANG.has(calon)) bersih.add(calon)
  }

  simpananAkar.set(kata, bersih)
  return bersih
}

/** Benar bila dua kata boleh dianggap satu keluarga bentuk. */
export function sekerabat(kataA, kataB) {
  if (kataA === kataB) return true
  const a = akarKata(kataA)
  if (a.has(kataB)) return true
  for (const calon of akarKata(kataB)) if (a.has(calon)) return true
  return false
}

/* ---------------------------------------------------------- konteks & kunci */

/**
 * Menyiapkan teks yang sudah dinormalkan menjadi bentuk yang siap dicari.
 * Indeks kedudukan dibangun sekali supaya pencarian ratusan kata kunci tidak
 * perlu menyapu seluruh teks berulang kali.
 */
export function siapkanKonteks(teksNormal) {
  const token = teksNormal ? teksNormal.split(' ').filter(Boolean) : []
  const akar = token.map((t) => akarKata(t))
  const indeks = new Map()

  token.forEach((t, i) => {
    for (const calon of akar[i]) {
      const daftar = indeks.get(calon)
      if (daftar) daftar.push(i)
      else indeks.set(calon, [i])
    }
  })

  return { teks: teksNormal, token, akar, indeks, jumlahToken: token.length }
}

const simpananKunci = new Map()

/** Memecah sebuah frasa kunci menjadi daftar himpunan akar per kedudukan. */
export function siapkanKunci(frasa) {
  const tersimpan = simpananKunci.get(frasa)
  if (tersimpan) return tersimpan

  const kata = String(frasa).split(' ').filter(Boolean)
  const siap = { asli: frasa, kata, akar: kata.map((k) => akarKata(k)), panjang: kata.length }
  simpananKunci.set(frasa, siap)
  return siap
}

/**
 * Menghitung berapa kali sebuah frasa kunci muncul dalam konteks.
 * Dibatasi tiga supaya satu kata yang diulang-ulang tidak menenggelamkan
 * kata kunci lain yang lebih beragam.
 */
export function hitungFrasa(konteks, frasa, maksimum = 3) {
  const kunci = siapkanKunci(frasa)
  if (!kunci.panjang || !konteks.jumlahToken) return 0

  // Kedudukan awal dicari lewat indeks akar kata pertama, bukan dengan menyapu
  // seluruh teks. Untuk enam ratus kata kunci, selisihnya besar.
  const awal = new Set()
  for (const calon of kunci.akar[0]) {
    const daftar = konteks.indeks.get(calon)
    if (daftar) for (const p of daftar) awal.add(p)
  }
  if (!awal.size) return 0
  if (kunci.panjang === 1) return Math.min(maksimum, awal.size)

  let jumlah = 0
  const urut = [...awal].sort((a, b) => a - b)
  let batasBawah = -1

  for (const mulai of urut) {
    if (mulai <= batasBawah) continue
    if (mulai + kunci.panjang > konteks.jumlahToken) break

    let cocok = true
    for (let j = 1; j < kunci.panjang; j += 1) {
      const akarToken = konteks.akar[mulai + j]
      let ketemu = false
      for (const calon of kunci.akar[j]) {
        if (akarToken.has(calon)) { ketemu = true; break }
      }
      if (!ketemu) { cocok = false; break }
    }

    if (cocok) {
      jumlah += 1
      batasBawah = mulai + kunci.panjang - 1
      if (jumlah >= maksimum) break
    }
  }

  return jumlah
}

/** Benar bila salah satu frasa dalam daftar muncul di konteks. */
export function adaSalahSatu(konteks, daftarFrasa) {
  for (const frasa of daftarFrasa) if (hitungFrasa(konteks, frasa, 1)) return true
  return false
}

/** Mengembalikan frasa mana saja dari daftar yang muncul di konteks. */
export function yangMuncul(konteks, daftarFrasa) {
  const hasil = []
  for (const frasa of daftarFrasa) if (hitungFrasa(konteks, frasa, 1)) hasil.push(frasa)
  return hasil
}

export const META_TEKS = { versi: 'teks-v1.0', panjangAkarMinimum: PANJANG_AKAR_MINIMUM }
