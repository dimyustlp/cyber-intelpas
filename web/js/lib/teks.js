/**
 * Pengolah teks bahasa Indonesia untuk Trans-Siber PAS.
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

/**
 * Sisa templat penilaian crawler. Isinya sama untuk hampir semua baris.
 *
 * Bentuk kedua — yang diawali "TOPIK:" atau "SKOR ANCAMAN:" — menutupi 447 dari
 * 779 baris arsip, lebih dari separuhnya, dan selama ini lolos seluruhnya.
 * Akibatnya dua tempat sekaligus: mesin klasifikasi menimbang kata "institusi",
 * "masalah", dan "ancaman" yang berasal dari templat, bukan dari beritanya; dan
 * lampiran laporan harian mengulang kalimat yang sama di bawah setiap butir,
 * yang membuat pembacanya berhenti membaca.
 *
 * Wujudnya selalu runtun "LABEL: nilai" yang ditutup "REKOMENDASI: ...", dengan
 * label yang berbeda-beda antar-versi crawler. Karena itu yang dikenali adalah
 * pembuka dan penutupnya, bukan daftar labelnya — daftar label akan usang pada
 * versi crawler berikutnya tanpa ada yang tahu.
 *
 * Pola itu satu-satunya di daftar ini yang PEKA HURUF BESAR-KECIL, dan itu
 * disengaja. Versi pertamanya tidak, dan ia memakan kalimat manusia biasa:
 * "Kepala Lapas memberi arahan tentang topik: integritas petugas dan
 * rekomendasi: perbaikan layanan kunjungan" tinggal menjadi "Kepala Lapas
 * memberi arahan tentang". Crawler selalu menulis labelnya dengan huruf besar;
 * orang yang menulis kalimat tidak. Itu pembeda yang cukup, dan lebih murah
 * daripada kehilangan separuh kalimat pada berita yang justru penting.
 */
const POLA_BOILERPLATE = [
  /risiko\s*:\s*(rendah|sedang|tinggi|kritis)\s*analisis\s*:[\s\S]*?rekomendasi\s*:[^.]*\.?/gi,
  /(?:TOPIK|SKOR ANCAMAN|FREKUENSI ISU)\s*:[\s\S]*?REKOMENDASI\s*:[^.]*\.?/g,
  /risiko\s*:\s*(rendah|sedang|tinggi|kritis)/gi,
  /analisis\s*:\s*berita(\/konten)?\s*bersifat informatif umum[^.]*\./gi,
  /analisis\s*:\s*isu memerlukan perhatian[^.]*\./gi,
  /rekomendasi\s*:\s*arsip[^.]*\./gi,
  /rekomendasi\s*:\s*lakukan pemantauan berkala[^.]*\./gi,
  /generated automatically[^.]*\./gi,

  /*
     Catatan asal-usul yang ditulis perayap sendiri ke dalam `raw_analysis`.

     Bentuknya "Ditemukan penjaring-v1.0 (isu:isu-bencana)." dan ia menempel
     pada SELURUH 718 baris hasil perayap — bukan sebagian. Selama sebulan ia
     merusak klasifikasi lewat dua jalan sekaligus, dan keduanya sunyi:

       1. Kata "Ditemukan" adalah anggota FRASA_TEMUAN. Kaidah temuan mengambil
          juara 8.x yang positif dan menggantinya dengan kandidat negatif
          terbaik — jadi setiap kegiatan humas yang punya pesaing negatif sekecil
          apa pun berubah menjadi berita negatif. "Tingkatkan Kepedulian
          Humanis, Lapas Narkotika Karang Intan Gelar Aksi Berbagi Camilan"
          tercatat 6.2 Penyerangan Fisik Eksternal, urgensi Tinggi.

       2. Tebakan perayap sendiri ikut dinilai sebagai kata beritanya. Label
          "(isu:isu-bencana)" menyumbang dua kali kata "bencana" pada teks yang
          judulnya tidak pernah menyebutnya. Mesin lalu membenarkan tebakan
          perayap dengan bukti yang berasal dari tebakan itu juga — lingkaran
          yang tidak bisa dipatahkan oleh kata kunci mana pun.

     Inilah sebab sesungguhnya di balik lima pemberitahuan salah pada 7
     September 2026. Kaidah kegiatan dan kaidah urutan kata v4.2 sudah benar;
     yang dinilai mesin memang bukan lagi beritanya.
  */
  /\bditemukan\s+(?:penjaring|perayap|sheet-sync|crawler)[\w.-]*\s*(?:\([^)]*\))?\s*\.?/gi,
  /konten terdeteksi otomatis oleh sistem patroli siber\.?/gi,
  /\bfallback data\b\.?/gi,

  /*
     Kesepakatan untuk seterusnya: catatan yang ditulis mesin ke dalam kolom
     yang ikut dinilai mesin HARUS diawali "[sistem]".

     Tiga pola di atas mengenali tiga templat yang kebetulan sudah ada, dan
     daftar semacam itu selalu ketinggalan satu versi di belakang perayapnya.
     Penanda yang disepakati di muka tidak perlu dikenali — ia mengumumkan
     dirinya sendiri, dan perayap berikutnya cukup memakainya.
  */
  /\[sistem\][^.]*\.?/gi,
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
    /* Tanda diakritik ditulis sebagai lolosan \u, bukan sebagai aksaranya
       sendiri. Aksara penggabung tidak terlihat di dalam kurung siku pada
       penyunting mana pun — ia tampak seperti kurung kosong — sehingga setiap
       penyalinan berkas ini (ke Edge Function, ke papan klip, lewat alat yang
       menormalkan Unicode) bisa menghapusnya tanpa meninggalkan jejak, dan
       normalisasi diam-diam berhenti membuang aksen. */
    .replace(/[\u0300-\u036f]/g, '')
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

  /*
     Dua bentuk yang lolos justru KARENA daftar ini bekerja setingkat terlalu
     dalam, ditemukan 6 September 2026 dari pemberitahuan Telegram yang
     sungguh-sungguh terkirim ke grup pimpinan.

     "pelari" — 'lari' sudah ada di atas, dan tetap saja "Grub Band Binaan Rutan
     Tanah Grogot Hibur PELARI Kideco Run 2026" tercatat sebagai 1.1 Pelarian
     WBP dengan urgensi Tinggi. Sebabnya tabrakannya tidak terjadi di 'lari'
     melainkan satu tingkat di atasnya: "pelarian" dikupas akhiran -an menjadi
     "pelari", dan "pelari" adalah kata yang sudah berdiri sendiri dengan arti
     yang sama sekali lain. Penjagaan pada akarnya tidak menolong bila
     tabrakannya di bentuk antaranya.

     "sehat" — "kesehatan warga binaan" (kata kunci 4.2 Overkapasitas dan
     Kelayakan Hidup) cocok pada "Sabtu SEHAT, WARGA BINAAN dan Petugas Lapas
     Kotabaru Lakukan Olahraga". Tiga kata berurutan, dan kegiatan senam pagi
     tercatat sebagai persoalan kelayakan hidup. "Kesehatan" adalah keadaan
     yang dibicarakan; "sehat" adalah sifat. Keduanya tidak boleh dipertemukan
     lewat akar.

     Jembatannya ternyata ada DUA tingkat, dan itu pelajaran tersendiri:
     memblokir 'pelari' saja tidak cukup, sebab "pelarian" dan "pelari"
     bertemu lagi di 'pelar' — potongan yang bukan kata apa pun dalam bahasa
     Indonesia. Potongan tak bermakna sepanjang lima huruf semacam itu adalah
     jembatan yang paling berbahaya justru karena ia tidak terbaca sebagai
     kata oleh siapa pun yang memeriksanya.
  */
  'pelari', 'pelar', 'larian', 'sehat',

  /*
     "ikan" — ditemukan 7 September 2026 dari arsip yang sudah dinilai v4.3.

     "BERIKAN Informasi Hukum, Bapas Saumlaki Layani Masyarakat" tercatat 8.6
     Ketahanan Pangan dan Pemberdayaan Ekonomi, dengan kata kunci penentu
     "perikanan". Jembatannya persis sama bentuknya dengan 'pelari': "berikan"
     dikupas awalan ber- menjadi "ikan", "perikanan" dikupas per- dan -an
     menjadi "ikan" juga, dan keduanya bertemu di sana.

     Bahayanya bukan pada satu berita itu. "Berikan" adalah kata kerja yang
     muncul di ratusan judul kehumasan — memberikan bantuan, memberikan
     pelatihan, memberikan penyuluhan — dan semuanya selama ini menyumbang
     nilai kepada subkategori perikanan.

     Bentuk permukaannya tetap dicocokkan: 'kolam ikan' dan 'perikanan' pada
     berita budidaya sungguhan tidak terpengaruh.
  */
  'ikan',

  /*
     "gawai" — ditemukan 9 September 2026 dari pemberitahuan Telegram yang
     sungguh-sungguh terkirim: "Bapas Jogja Sematkan Satyalancana Karya Satya
     bagi PEGAWAI Berdedikasi" tercatat 2.2 Kejahatan Siber dan HP Ilegal
     dengan kata kunci penentu "gawai", keyakinan 74 persen. Jembatannya sama
     bentuknya dengan 'ikan': "pegawai" dikupas awalan pe- menjadi "gawai",
     dan "gawai" adalah kata kunci 2.2 untuk telepon genggam ilegal.

     "Pegawai" muncul di ribuan judul kehumasan — pelantikan pegawai, pegawai
     teladan, kesejahteraan pegawai — dan tak satu pun berurusan dengan HP
     terlarang di dalam sel. Bentuk permukaannya tetap dicocokkan: judul yang
     benar-benar menulis "gawai" tetap berakar "gawai".
  */
  'gawai',
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
/**
 * Kedudukan kemunculan paling awal sebuah frasa, dihitung dalam nomor kata.
 *
 * Mengembalikan Infinity bila frasanya tidak muncul sama sekali, supaya
 * hasilnya bisa langsung dibandingkan dengan < tanpa penjagaan tambahan.
 *
 * Kenapa ini perlu padahal sudah ada hitungFrasa: sebagian aturan tidak cukup
 * dijawab dengan "muncul atau tidak", melainkan menuntut "mana yang lebih
 * dahulu". Bantahan adalah contohnya — "Lapas Bantah Kabar Napi Kabur" dan
 * "Napi Kabur, Lapas Membantah" memuat kata yang persis sama dan artinya
 * berlawanan. Yang membedakan hanya urutan.
 *
 * Pencocokannya sadar imbuhan, sama seperti hitungFrasa, dan itu wajib:
 * mencari 'membantah' dengan indexOf pada teks yang berbunyi "bantah" akan
 * mengembalikan "tidak ditemukan", lalu aturan di atasnya menyimpulkan hal
 * yang berlawanan dengan kenyataan.
 */
export function letakFrasa(konteks, frasa) {
  const kunci = siapkanKunci(frasa)
  if (!kunci.panjang || !konteks.jumlahToken) return Infinity

  const awal = []
  for (const calon of kunci.akar[0]) {
    const daftar = konteks.indeks.get(calon)
    if (daftar) awal.push(...daftar)
  }
  if (!awal.length) return Infinity

  awal.sort((a, b) => a - b)
  if (kunci.panjang === 1) return awal[0]

  for (const mulai of awal) {
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
    if (cocok) return mulai
  }

  return Infinity
}

/** Kedudukan terawal di antara sekumpulan frasa. Infinity bila tak satu pun muncul. */
export function letakTerawal(konteks, daftarFrasa) {
  let awal = Infinity
  for (const f of daftarFrasa) {
    const i = letakFrasa(konteks, f)
    if (i < awal) awal = i
  }
  return awal
}

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
