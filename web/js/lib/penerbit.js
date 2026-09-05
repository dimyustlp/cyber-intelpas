/**
 * Pengenal penerbit.
 *
 * Mesin klasifikasi selama ini hanya membaca teks berita dan mengabaikan satu
 * keterangan yang justru paling menentukan: siapa yang menerbitkannya.
 *
 * Akibatnya terlihat jelas di arsip. Dari 74 publikasi yang jatuh ke "Lainnya",
 * lima puluh lebih adalah unggahan akun resmi unit pelaksana teknis sendiri —
 * kanal YouTube "Rutan Boyolali", "Humas Lapas Pasir Pangarayan", "Lembaga
 * Pemasyarakatan Kelas III Suliki", dan hasil penyisiran media sosial yang
 * seluruhnya berasal dari akun humas UPT. Isinya kegiatan olahraga, ucapan hari
 * jadi, ibadah rutin, pembagian vitamin. Tidak satu pun memakai kata kunci yang
 * tegas, karena unggahan kehumasan memang tidak ditulis dengan kata kunci.
 *
 * Padahal jenisnya sudah pasti sejak awal: sebuah unggahan yang diterbitkan
 * akun resmi sebuah unit adalah publikasi kehumasan unit itu. Yang belum pasti
 * hanya kegiatan apa yang diunggah — dan itu pertanyaan yang jauh lebih kecil
 * daripada "ini termasuk apa".
 *
 * Modul ini menjawab satu pertanyaan saja: penerbitnya siapa. Empat kemungkinan:
 *
 *   institusi    akun resmi UPT, kanwil, atau Ditjen PAS
 *   penyisiran   hasil penyisiran media sosial; penulisnya belum tentu institusi
 *   media_massa  media berita, baik nasional maupun daerah
 *   tidak_dikenal
 *
 * Modul ES murni tanpa impor, supaya bisa dipakai di peramban dan di Edge
 * Function tanpa perubahan.
 */

/**
 * Pola nama akun pada kolom `media`.
 *
 * Crawler menuliskan penerbit dalam beberapa bentuk berbeda, dan nama akunnya
 * ada di dalam kurung, kurung siku, atau berdiri sendiri:
 *
 *   YouTube [Rutan Boyolali]
 *   tvrikalimantantimur (instagram)
 *   Reel by Rutan Kelas II B Sukadana (@rutansukadana)
 */
const POLA_AKUN = [
  /\[([^\]]+)\]/,
  /^([^(]+)\s*\((?:instagram|facebook|tiktok|x|twitter|youtube)\)/i,
  /\(@([^)]+)\)/,
]

/** Nama sumber yang berarti "hasil penyisiran media sosial", bukan nama penerbit. */
const PENYISIRAN = [
  'radar medsos', 'medsos radar', 'social dorking', 'dorking',
  'tiktok radar', 'radar sosmed', 'sosmed radar',
]

/**
 * Kata yang, bila muncul pada nama akun, menandakan akun itu milik unit
 * Pemasyarakatan.
 *
 * Sengaja tidak memuat "penjara" dan "tahanan". Keduanya lazim dipakai kanal
 * hiburan yang membahas kehidupan di dalam penjara, dan kanal semacam itu bukan
 * penerbit institusi.
 */
const PENANDA_INSTITUSI = [
  'lapas', 'rutan', 'bapas', 'lpka', 'lpp', 'ditjenpas', 'ditjen pas',
  'kemenimipas', 'pemasyarakatan', 'humas lapas', 'humas rutan',
  'kanwil', 'lembaga pemasyarakatan', 'rumah tahanan', 'balai pemasyarakatan',
  'imipas',
]

/**
 * Penanda kehumasan di dalam teks itu sendiri.
 *
 * Tanda pagar dan sebutan di bawah ini praktis hanya dipakai akun resmi dan
 * akun yang membagikan ulang unggahan resmi. Satu saja sudah cukup kuat, sebab
 * tidak ada alasan bagi akun kritikus untuk membubuhkan tanda pagar kampanye
 * kementeriannya sendiri.
 */
const PENANDA_TEKS_RESMI = [
  'kemenimipas', 'ditjenpas', 'ditjen pas', 'guardandguide', 'guard and guide',
  'infoimipas', 'imipasprima', 'sobat pas', 'sobatpas', 'tim humas',
  'humas lapas', 'humas rutan', 'humas bapas', 'kitamulaicarabaru',
  'pemasyarakatan', 'wbbm', 'wbk', 'zona integritas',
]

/**
 * Nama akun yang tertulis menyatu, misalnya #lapaskelas1bandarlampung,
 * #rutanbanjarnegara, #humaslapsuli, #pemasyarakatansumsel.
 *
 * Bentuk menyatu inilah yang membedakannya dari penyebutan biasa. Seorang
 * kritikus menulis "lapas" sebagai kata; hanya akun unit itu sendiri dan yang
 * membagikan ulang unggahannya yang menulis nama unit sebagai satu kata tanpa
 * spasi — sebab bentuk itu bukan kata, melainkan alamat.
 *
 * Ambang tiga huruf tambahan menjaga agar "lapas", "rutan", dan bentuk berimbuhan
 * sehari-hari tidak ikut terjaring.
 */
const POLA_TANDA_AKUN =
  /\b(lapas|rutan|bapas|lpka|lpp|kanwil|humas|ditjenpas|kemenimipas|pemasyarakatan)[a-z0-9]{4,}\b/

/**
 * Baris atribusi yang ditulis crawler ketika ia menyalin unggahan dari sebuah
 * akun: "Photos by Rutan Kelas 1 Jakarta Pusat (@rutan_salemba)", "Reel by
 * Lapas Kelas I Surabaya (@lapassurabaya)". Baris itu bukan bagian dari isi
 * unggahan — ia adalah nama pemiliknya.
 */
const POLA_ATRIBUSI =
  /\b(photos?|reels?|videos?|posts?|story|stories)\s+(by|from|with)\s+(lapas|rutan|bapas|lpka|lpp|kanwil|ditjen)/

/**
 * Instansi lain yang juga memakai awalan "humas" pada nama akunnya.
 *
 * Tanpa penjagaan ini, aturan "nama akun menyatu berawalan humas" akan menyeret
 * akun humas kepolisian, kejaksaan, dan pemadam kebakaran ke dalam lingkup
 * Pemasyarakatan — dan unggahan mereka memang banyak menyebut lapas.
 */
const INSTANSI_LAIN = [
  'polres', 'polda', 'polsek', 'polri', 'mabes', 'bareskrim', 'brimob',
  'kejari', 'kejati', 'kejagung', 'kejaksaan', 'bnn', 'bnnp', 'bnnk',
  'damkar', 'samsat', 'dishub', 'bpbd', 'satpol', 'kodim', 'korem', 'pomdam',
  'imigrasi', 'bea cukai', 'beacukai', 'pemkab', 'pemkot', 'pemprov',
]

/** Media berita yang jelas bukan akun institusi. */
const POLA_MEDIA_MASSA =
  /(\.com|\.co\.id|\.id|\.net|\.org|kompas|detik|tribun|antara|liputan|republika|tempo|okezone|sindo|jpnn|suara|merdeka|inews|viva|kumparan|radar\s+\w+|pos\b|harian|berita|news)/i

function normal(nilai) {
  return String(nilai ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mengambil nama akun dari kolom `media`, bila ada. */
export function namaAkun(media) {
  const teks = String(media ?? '').trim()
  if (!teks) return ''
  for (const pola of POLA_AKUN) {
    const cocok = teks.match(pola)
    if (cocok) return cocok[1].trim()
  }
  return teks
}

function memuatPenanda(teks, daftar) {
  for (const p of daftar) if (teks.includes(p)) return p
  return null
}

/**
 * Menentukan siapa penerbit sebuah publikasi.
 *
 * @param {object} berita
 * @param {string} [berita.media]     nama sumber sebagaimana ditulis crawler
 * @param {string} [berita.platform]  Google News, YouTube, Instagram, ...
 * @param {string} [teksNormal]       teks berita yang sudah dinormalkan
 * @returns {{jenis:string, akun:string, alasan:string, resmi:boolean}}
 */
export function kenaliPenerbit(berita = {}, teksNormal = '') {
  const mediaAsli = String(berita.media ?? '')
  const media = normal(mediaAsli)
  const akun = namaAkun(mediaAsli)
  const akunNormal = normal(akun)

  // 1. Akun institusi. Diuji lebih dulu karena ia yang paling menentukan, dan
  //    karena nama unit kerap memuat kata yang juga dipakai media massa
  //    ("Radar" pada "Radar Sukabumi", misalnya).
  const instansiLain = memuatPenanda(akunNormal, INSTANSI_LAIN)

  if (!instansiLain && !memuatPenanda(media, PENYISIRAN)) {
    const penandaAkun = memuatPenanda(akunNormal, PENANDA_INSTITUSI)
    if (penandaAkun) {
      return {
        jenis: 'institusi',
        akun,
        resmi: true,
        alasan: `Diterbitkan akun "${akun}", yang menyebut dirinya unit Pemasyarakatan.`,
      }
    }

    // Nama akun yang ditulis menyatu tidak selalu mengeja nama unitnya dengan
    // benar — kanal "Humaslapadalangkat" adalah humas Lapas Langkat, dan kata
    // "lapas" tidak pernah muncul utuh di dalamnya. Yang tetap terbaca adalah
    // bentuknya: awalan kelembagaan yang menyatu dengan nama tempat.
    const tandaAkun = akunNormal.replace(/\s+/g, '').match(POLA_TANDA_AKUN)
    if (tandaAkun) {
      return {
        jenis: 'institusi',
        akun,
        resmi: true,
        alasan: `Diterbitkan akun "${akun}", yang bentuk namanya adalah nama akun unit Pemasyarakatan.`,
      }
    }
  }

  // 2. Hasil penyisiran media sosial. Penulisnya tidak disebutkan, jadi
  //    keresmiannya harus dibuktikan dari isi teksnya sendiri.
  if (memuatPenanda(media, PENYISIRAN)) {
    const penandaTeks = memuatPenanda(teksNormal, PENANDA_TEKS_RESMI)
    if (penandaTeks) {
      return {
        jenis: 'institusi',
        akun: akun || 'akun media sosial',
        resmi: true,
        alasan: `Hasil penyisiran media sosial yang memuat penanda kampanye resmi "${penandaTeks}".`,
      }
    }

    const tandaAkun = teksNormal.match(POLA_TANDA_AKUN)
    if (tandaAkun) {
      return {
        jenis: 'institusi',
        akun: tandaAkun[0],
        resmi: true,
        alasan: `Hasil penyisiran media sosial yang membubuhkan nama akun unit "${tandaAkun[0]}".`,
      }
    }

    if (POLA_ATRIBUSI.test(teksNormal)) {
      return {
        jenis: 'institusi',
        akun: akun || 'akun unit',
        resmi: true,
        alasan: 'Hasil penyisiran media sosial yang menyalin unggahan dari akun sebuah unit.',
      }
    }

    return {
      jenis: 'penyisiran',
      akun: akun || 'akun media sosial',
      resmi: false,
      alasan: 'Hasil penyisiran media sosial tanpa penanda penerbit resmi.',
    }
  }

  // 3. Media massa.
  if (POLA_MEDIA_MASSA.test(mediaAsli)) {
    return { jenis: 'media_massa', akun, resmi: false, alasan: `Diterbitkan media "${akun}".` }
  }

  // 4. Sisanya. Kanal perorangan di YouTube, akun hiburan, dan sumber yang
  //    namanya tidak memberi petunjuk apa pun.
  return { jenis: 'tidak_dikenal', akun, resmi: false, alasan: 'Penerbit tidak dikenali.' }
}

/**
 * Nama inang yang punya nama terbitan resmi.
 *
 * Panel "Top 5 Media" pada laporan berkala menuliskan apa yang ada di sini apa
 * adanya, dan lembar itu dibaca di luar aplikasi. "rri.co.id" tercetak pada
 * lembar resmi terbaca seperti kekeliruan penyusunnya, bukan seperti nama
 * sebuah lembaga penyiaran negara.
 *
 * Daftarnya sengaja pendek dan hanya memuat yang benar-benar sering muncul.
 * Inang yang tidak ada di sini dirapikan seadanya oleh `rapikanInang()` —
 * lebih baik "kompas.com" daripada tidak ada nama sama sekali.
 */
const PADANAN_INANG = {
  'rri.co.id': 'RRI.co.id',
  'antaranews.com': 'ANTARA News',
  'kemenimipas.go.id': 'Kemenimipas.go.id',
  'ditjenpas.go.id': 'Ditjenpas.go.id',
  'infopublik.id': 'InfoPublik',
  'kompas.com': 'Kompas.com',
  'detik.com': 'detikcom',
  'news.detik.com': 'detikcom',
  'tribunnews.com': 'Tribunnews',
  'liputan6.com': 'Liputan6',
  'kumparan.com': 'kumparan',
  'cnnindonesia.com': 'CNN Indonesia',
  'tempo.co': 'Tempo',
  'republika.co.id': 'Republika',
  'okezone.com': 'Okezone',
  'sindonews.com': 'SINDOnews',
  'viva.co.id': 'VIVA',
  'jpnn.com': 'JPNN',
  'suara.com': 'Suara.com',
  'merdeka.com': 'Merdeka.com',
  'metrotvnews.com': 'MetroTV',
  'medcom.id': 'Medcom.id',
  'beritasatu.com': 'BeritaSatu',
  'inews.id': 'iNews',
  'instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'tiktok.com': 'TikTok',
  'x.com': 'X',
  'twitter.com': 'X',
  'youtube.com': 'YouTube',
  'youtu.be': 'YouTube',
}

/** "www.radarlampung.co.id" menjadi "radarlampung.co.id". */
function rapikanInang(inang) {
  return String(inang || '').replace(/^www\./i, '').toLowerCase()
}

/** Inang tautan sebuah berita, atau kosong bila tautannya tidak sah. */
function inangTautan(berita) {
  try {
    return rapikanInang(new URL(berita?.link || berita?.url).hostname)
  } catch {
    return ''
  }
}

/**
 * Nama penerbit sebagaimana ditulis pada laporan.
 *
 * Berbeda dari `sumberAsli()` di lib/peristiwa.js, dan sengaja demikian.
 * `sumberAsli()` menjawab "siapa yang menerbitkannya" untuk keperluan
 * menghitung berapa media yang memberitakan satu peristiwa — di sana
 * "instagram.com" adalah jawaban yang benar dan berguna. Fungsi ini menjawab
 * pertanyaan yang lain: "apa yang harus tercetak di lembar laporan".
 *
 * Tiga hal yang diperbaiki di sini, dan ketiganya pernah tercetak salah:
 *
 *   Nama alat penyisiran. "Medsos Radar" dan "TikTok Radar" adalah nama alat
 *   pengumpul, bukan nama penerbit. Keduanya sempat menempati peringkat satu
 *   dan lima pada panel Top 5 Media — daftar media yang isinya bukan media.
 *
 *   Inang telanjang. Berita hasil penyisiran tidak menyimpan nama akunnya,
 *   sehingga yang tersisa hanya "instagram.com". Yang benar tercetak di lembar
 *   resmi adalah nama platformnya.
 *
 *   Nama terbitan. "rri.co.id" menjadi "RRI.co.id".
 *
 * @param {object} berita
 * @param {string} [petunjuk] hasil `sumberAsli()` dari lib/peristiwa.js, bila
 *   pemanggilnya sudah menghitungnya. Di sanalah nama penerbit digali kembali
 *   dari ekor judul Google News — "Judul berita - Nama Media" — dan itu
 *   satu-satunya tempat nama itu masih tersisa untuk 70 dari 130 baris sepekan.
 *   Logikanya tidak disalin ke sini: satu-satunya hal yang lebih buruk
 *   daripada penggalian yang rumit adalah dua penggalian rumit yang perlahan
 *   berbeda hasilnya.
 */
export function namaPenerbitTampil(berita = {}, petunjuk = '') {
  const mediaAsli = String(berita.media ?? '').trim()

  // Nama kanal di dalam kurung siku selalu menang: ia satu-satunya nama
  // penerbit yang benar-benar tercatat, bukan diterka.
  const kanal = mediaAsli.match(/\[([^\]]+)\]/)
  if (kanal) return kanal[1].trim()

  const akun = namaAkun(mediaAsli)
  const akunNormal = normal(akun)
  const penyisiran = memuatPenanda(akunNormal, PENYISIRAN)
    || /^(google news|medsos|rss|feed|crawler|scraper)/i.test(akun)

  if (!penyisiran && akun) return akun

  // Namanya bukan nama penerbit. Yang tersisa, berurut menurut kepercayaan:
  // nama yang digali dari judul, inang tautannya, lalu platformnya.
  const dariJudul = String(petunjuk || '').trim()
  if (dariJudul && !/^(https?:)?\/\//.test(dariJudul)) {
    const inangPetunjuk = rapikanInang(dariJudul)
    if (PADANAN_INANG[inangPetunjuk]) return PADANAN_INANG[inangPetunjuk]
    // Petunjuk yang ternyata hanya mengulang nama pengumpulnya tidak dipakai.
    if (!/^(google news|medsos|rss|feed|crawler|scraper)/i.test(dariJudul)
      && !memuatPenanda(normal(dariJudul), PENYISIRAN)
      && !/^news\.google\.com$/i.test(dariJudul)
      && dariJudul !== 'Sumber tidak tercatat') {
      return dariJudul
    }
  }

  const inang = inangTautan(berita)
  if (inang && !/^news\.google\.com$/i.test(inang)) return PADANAN_INANG[inang] || inang

  const platform = String(berita.platform ?? '').trim()
  if (platform && !/^google news$/i.test(platform)) return platform

  return 'Tidak tercatat'
}

export const META_PENERBIT = { versi: 'penerbit-v1.1' }
