/**
 * Pencocokan nama UPT dari teks berita.
 *
 * Masalah yang diperbaiki: pada 22 Agustus 2026, 410 dari 646 berita masuk
 * dengan nama UPT "Belum Teridentifikasi". Penyebabnya dua algoritma berbeda
 * yang sama-sama lemah — crawler memakai pencocokan substring utuh, sedangkan
 * aplikasi memakai SequenceMatcher yang membandingkan nama UPT pendek dengan
 * badan artikel panjang, sehingga komponen kemiripannya nyaris selalu nol.
 *
 * Pendekatan di sini berbeda:
 *   1. Cari dulu penanda jenis UPT dalam teks — "lapas", "rutan", "lembaga
 *      pemasyarakatan", dan seterusnya. Tanpa penanda ini, penyebutan nama kota
 *      saja tidak pernah dianggap menunjuk sebuah UPT. Inilah yang menghentikan
 *      salah cocok "artikel menyebut Semarang" menjadi "Lapas Kelas I Semarang".
 *   2. Dari setiap penanda, ambil jendela teks di sekitarnya dan cari nama
 *      pembeda UPT di dalamnya. Kedekatan posisi jauh lebih menentukan daripada
 *      kemiripan karakter.
 *   3. Jenis UPT pada teks harus cocok dengan jenis UPT kandidat. "Rutan Pondok
 *      Bambu" tidak akan pernah dipetakan ke sebuah Lapas.
 *   4. Nama yang dipakai oleh lebih dari satu UPT ditandai sebagai bersaing,
 *      dan dikembalikan sebagai butir yang perlu diputuskan analis, bukan
 *      ditebak diam-diam.
 *
 * Modul ES murni tanpa impor.
 */

/**
 * Kata yang tidak membedakan satu UPT dari UPT lain.
 *
 * Perhatikan bahwa "narkotika", "perempuan", "anak", dan "terbuka" TIDAK ada di
 * sini. Keempatnya adalah subjenis yang benar-benar membedakan: "Lapas
 * Narkotika Kelas IIA Jakarta" dan "Lapas Kelas IIA Jakarta" adalah dua unit
 * berbeda, dan versi lama menganggap keduanya bernama sama.
 */
const KATA_UMUM = new Set([
  'lapas', 'rutan', 'lpka', 'lpp', 'bapas', 'lembaga', 'pemasyarakatan', 'rumah',
  'tahanan', 'negara', 'balai', 'pembinaan', 'khusus', 'kelas', 'i', 'ii', 'iia',
  'iib', 'iii', 'ia', 'ib', 'umum', 'cabang', 'cab', 'kota', 'kabupaten', 'kab',
  'penempatan', 'sementara', 'daerah', 'wilayah', 'kantor', 'ditjenpas', 'pas',
])

/** Penanda jenis UPT di dalam teks berita, dipetakan ke jenis kanonis. */
const PENANDA_JENIS = [
  ['lembaga pembinaan khusus anak', 'LPKA'],
  // Nama lama LPKA, dan satu-satunya nama yang masih dipakai sebagian besar
  // media. "LPKA Kelas I Kutoarjo" hampir selalu ditulis "Lapas Anak Kutoarjo"
  // — kedua bentuk itu menunjuk gedung yang sama, dan hanya bentuk pertama yang
  // pernah dikenali. Penanda ini tidak menutup penanda "lapas" pada posisi yang
  // sama; lihat ambilJendela().
  ['lembaga pemasyarakatan anak', 'LPKA'],
  ['lapas anak', 'LPKA'],
  // Data induk menamai lapas perempuan sebagai jenis "Lapas" dengan subjenis
  // "Perempuan", bukan jenis tersendiri. Penanda ini mengikuti data induk.
  ['lembaga pemasyarakatan perempuan', 'Lapas'],
  ['lapas perempuan', 'Lapas'],
  ['lembaga pemasyarakatan', 'Lapas'],
  ['rumah tahanan negara', 'Rutan'],
  ['rumah tahanan', 'Rutan'],
  ['balai pemasyarakatan', 'Bapas'],
  ['kalapas', 'Lapas'],
  ['karutan', 'Rutan'],
  ['lapas', 'Lapas'],
  ['rutan', 'Rutan'],
  ['lpka', 'LPKA'],
  ['lpp', 'Lapas'],
  ['bapas', 'Bapas'],
]

/**
 * Sebutan populer yang tidak pernah muncul dalam nama resmi. Wartawan menulis
 * "Rutan Salemba", bukan "Rutan Kelas I Jakarta Pusat"; menulis "Lapas Tanjung
 * Gusta", bukan "Lapas Kelas I Medan". Tanpa tabel ini, berita paling penting
 * justru yang paling sering gagal dipetakan.
 */
/**
 * Kata yang, bila menempel tepat di belakang penanda jenis, menandakan rumah
 * tahanan milik lembaga lain. "Rutan KPK", "Rutan Bareskrim", dan "Rutan Cabang
 * Gedung Merah Putih" bukan unit Pemasyarakatan; memetakannya ke salah satu UPT
 * berarti membebankan perkara lembaga lain ke unit yang tidak bersalah.
 */
const PENANDA_BUKAN_PAS = [
  'kpk', 'komisi pemberantasan', 'bareskrim', 'mabes', 'polri', 'polda',
  'polres', 'polresta', 'polsek', 'brimob', 'militer', 'pomdam', 'puspom',
  'kejaksaan', 'kejagung', 'kejati', 'kejari', 'merah putih', 'guntur',
  'imigrasi', 'salemba cabang kejaksaan',
]

/** Panjang potongan setelah penanda jenis yang diperiksa untuk lembaga lain. */
const JENDELA_LEMBAGA = 26

export const SEBUTAN_POPULER = [
  ['salemba', 'Rutan Kelas I Jakarta Pusat'],
  ['tanjung gusta', 'Lapas Kelas I Medan'],
  ['sukamiskin', 'Lapas Kelas I Sukamiskin'],
  ['kerobokan', 'Lapas Kelas IIA Kerobokan'],
  ['kedungpane', 'Lapas Kelas I Semarang'],
  ['kedungpani', 'Lapas Kelas I Semarang'],
  ['wirogunan', 'Lapas Kelas IIA Yogyakarta'],
  ['kalisosok', 'Rutan Kelas I Surabaya'],
  ['porong', 'Lapas Kelas I Surabaya'],
  ['cebongan', 'Lapas Kelas IIB Sleman'],
  // Nama lama yang masih dipakai daftar resmi Ditjenpas sendiri, dan karena itu
  // ikut dipakai media daerah. Dipasang pada Lapas maupun Rutan: keduanya
  // dibedakan oleh penanda jenis pada teks, bukan oleh alias ini.
  ['ujung pandang', 'Lapas Kelas I Makassar'],
  ['ujung pandang', 'Rutan Kelas I Makassar'],
  // Tanjung Pati adalah nama tempat gedungnya, di Kabupaten Lima Puluh Kota,
  // sementara unitnya bernama Payakumbuh. Kedua nama itu dipakai bergantian
  // dalam berita yang sama.
  ['tanjung pati', 'Lapas Kelas IIB Payakumbuh'],
  ['nusakambangan', null],
  ['pekanbaru', null],
]

/**
 * Dua jenis yang boleh saling menggantikan ketika nama tempatnya tunggal.
 * Sengaja hanya berisi Lapas dan Rutan: keduanya sama-sama tempat penahanan
 * dan dipertukarkan bebas dalam bahasa pemberitaan. Bapas dan LPKA tidak ikut,
 * karena keduanya lembaga dengan tugas yang sama sekali berbeda.
 */
const LINTAS_JENIS = new Set(['Lapas', 'Rutan'])

/** Panjang jendela teks setelah penanda jenis yang ikut diperiksa. */
const JENDELA = 70

/** Skor minimum sebelum sebuah kandidat boleh diterima otomatis. */
const AMBANG_OTOMATIS = 0.72

/** Skor minimum sebelum sebuah kandidat layak disodorkan ke analis. */
const AMBANG_SARAN = 0.45

/**
 * Kata yang menempel di depan nama unit pada tagar media sosial. Unggahan resmi
 * UPT hampir selalu memakai bentuk rapat seperti "#lapaskelas1bandarlampung"
 * atau "#lapasperempuanpadang", dan di banyak unggahan itulah satu-satunya
 * penyebutan nama unitnya. Tanpa dipisahkan, seluruh unggahan semacam ini
 * berakhir sebagai "Belum Teridentifikasi".
 */
const KEPINGAN_TAGAR = [
  'lembagapemasyarakatan', 'rumahtahanannegara', 'balaipemasyarakatan',
  'pemasyarakatan', 'kemenimipas', 'ditjenpas', 'kanwil', 'humas',
  'lapas', 'rutan', 'lpka', 'lpp', 'bapas',
  'perempuan', 'narkotika', 'pemuda', 'terbuka', 'anak', 'kelas',
]

/** Memecah satu kata rapat menjadi kepingan yang dikenali, bila memang bisa. */
function pecahTagar(kata) {
  if (kata.length < 9) return kata
  const bagian = []
  let sisa = kata
  let aman = 0

  for (;;) {
    if (aman++ > 8) break
    let ketemu = false
    for (const keping of KEPINGAN_TAGAR) {
      if (sisa.startsWith(keping) && sisa.length > keping.length) {
        bagian.push(keping)
        sisa = sisa.slice(keping.length)
        ketemu = true
        break
      }
    }
    if (!ketemu) break
  }

  if (!bagian.length) return kata
  return [...bagian, sisa].join(' ')
}

export function normalkanUpt(nilai) {
  const dasar = String(nilai ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    // Angka di dalam kata rapat memisahkan dua bagian nama: "kelas1bandarlampung".
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()

  if (/[a-z]{9,}/.test(dasar)) {
    return dasar.split(' ').map(pecahTagar).join(' ').replace(/\s+/g, ' ').trim()
  }
  return dasar
}

function tokenPembeda(nama) {
  return normalkanUpt(nama)
    .split(' ')
    .filter((t) => t.length > 1 && !KATA_UMUM.has(t))
}

/**
 * Menyiapkan indeks pencarian dari daftar master UPT. Cukup dipanggil sekali,
 * hasilnya dipakai untuk seluruh berita.
 *
 * @param {Array<object>} daftarUpt baris master dengan nama_upt, jenis_upt, dll
 */
export function bangunIndeks(daftarUpt) {
  const entri = []
  const hitungNama = new Map()
  // Hitungan kedua, tanpa memandang jenis. Dipakai untuk memutuskan apakah
  // sebuah nama tempat menunjuk satu unit saja di seluruh Indonesia.
  const hitungLintasJenis = new Map()
  const hitungKabkota = new Map()

  let dariWilayah = 0

  for (const upt of daftarUpt) {
    const nama = upt.nama_upt
    if (!nama) continue

    let token = tokenPembeda(nama)

    // Unit yang seluruh namanya kata umum.
    //
    // Satu unit di Indonesia bernama "Rutan Kelas IIB Negara" — Negara adalah
    // ibu kota Kabupaten Jembrana. Kata "negara" ada di daftar kata umum karena
    // ia bagian dari "rumah tahanan negara", sehingga unit ini tidak punya satu
    // pun token pembeda dan selama ini dibuang diam-diam dari indeks: satu dari
    // 531 unit yang tidak pernah bisa dikenali, tanpa jejak apa pun.
    //
    // Namanya tidak bisa dipakai — token "negara" akan cocok dengan frasa
    // "rumah tahanan negara" pada hampir setiap berita rutan di Indonesia, dan
    // memetakan semuanya ke Jembrana. Yang dipakai adalah nama kabupatennya,
    // yang justru memang ditulis wartawan: "Rutan Jembrana".
    if (!token.length) {
      token = normalkanUpt(upt.kabupaten_kota || upt.location_hint || '')
        .split(' ')
        .filter((t) => t.length > 1 && !KATA_UMUM.has(t))
      if (!token.length) continue
      dariWilayah += 1
    }

    const jenis = upt.jenis_upt || tebakJenis(nama)
    const kunci = token.join(' ')

    // Persaingan nama dihitung PER JENIS. "Lapas Kelas I Cipinang" dan "Rutan
    // Kelas I Cipinang" bukan nama kembar — keduanya bisa dibedakan dari kata
    // Lapas atau Rutan yang selalu ikut disebut wartawan.
    const kunciJenis = `${jenis}::${kunci}`
    hitungNama.set(kunciJenis, (hitungNama.get(kunciJenis) || 0) + 1)

    // Hitungan lintas jenis hanya mencakup Lapas dan Rutan.
    //
    // Angka ini dipakai satu-satunya untuk memutuskan apakah kelonggaran
    // Lapas↔Rutan boleh dipakai, dan pertanyaannya selalu sama: apakah nama
    // tempat ini menunjuk lebih dari satu tempat penahanan. LPKA dan Bapas
    // bukan tempat penahanan dan tidak pernah menjadi calon dalam kelonggaran
    // itu, sehingga kehadiran mereka tidak boleh menutupnya.
    //
    // Bukan soal teori: menambahkan 32 LPKA ke data induk mencabut keunikan
    // lima unit Lapas/Rutan sekaligus — di antaranya Karangasem dan Tomohon —
    // hanya karena sebuah LPKA berdiri di kota yang sama. Berita "kabur dari
    // Lapas Karangasem" tentang Rutan Karangasem akan berhenti terpetakan,
    // padahal tidak ada satu pun yang berubah pada unit itu.
    if (LINTAS_JENIS.has(jenis)) {
      hitungLintasJenis.set(kunci, (hitungLintasJenis.get(kunci) || 0) + 1)
    }

    const petunjuk = normalkanUpt(upt.location_hint || '')
    const kabkota = normalkanUpt(upt.kabupaten_kota || '').replace(/^(kota|kabupaten) /, '')
    if (kabkota) hitungKabkota.set(kabkota, (hitungKabkota.get(kabkota) || 0) + 1)

    entri.push({
      nama,
      jenis,
      kelas: String(upt.kelas_upt || '').toLowerCase(),
      subjenis: upt.subjenis_upt || 'Umum',
      provinsi: upt.provinsi || '',
      kanwil: upt.kanwil || '',
      kabkota,
      token,
      // Varian tanpa spasi menangani "Lhok Seumawe" pada data induk yang di
      // media ditulis "Lhokseumawe", dan sebaliknya.
      tokenRapat: token.map((t) => t.replace(/\s+/g, '')),
      kunci,
      kunciJenis,
      namaNormal: normalkanUpt(nama),
      namaRapat: normalkanUpt(nama).replace(/\s+/g, ''),
      petunjuk: petunjuk && petunjuk !== kunci ? petunjuk : '',
      sebutan: [],
    })
  }

  for (const e of entri) {
    e.bersaing = (hitungNama.get(e.kunciJenis) || 0) > 1
    // Nama tempatnya hanya dipakai satu tempat penahanan di seluruh Indonesia,
    // sehingga penyebutan jenis yang keliru pun masih menunjuk unit yang sama.
    e.unikNasional = LINTAS_JENIS.has(e.jenis) && (hitungLintasJenis.get(e.kunci) || 0) === 1
    e.kabkotaUnik = Boolean(e.kabkota) && (hitungKabkota.get(e.kabkota) || 0) === 1
  }

  // Pasang sebutan populer, dan buang yang namanya tidak ada di data induk
  // supaya tabel alias tidak diam-diam menjadi usang.
  const perNama = new Map(entri.map((e) => [e.nama, e]))
  let sebutanTerpasang = 0
  const sebutanTakDikenal = []
  for (const [alias, namaResmi] of SEBUTAN_POPULER) {
    if (!namaResmi) continue
    const target = perNama.get(namaResmi)
    if (!target) { sebutanTakDikenal.push(namaResmi); continue }
    target.sebutan.push(normalkanUpt(alias))
    sebutanTerpasang += 1
  }

  // Nama panjang diperiksa lebih dulu supaya "Lapas Kelas IIA Besi
  // Nusakambangan" menang atas UPT lain yang hanya bertoken "nusakambangan".
  entri.sort((a, b) => b.kunci.length - a.kunci.length)

  return {
    entri,
    jumlah: entri.length,
    // Berapa unit dari daftar induk yang tidak masuk indeks sama sekali. Angka
    // ini dilaporkan supaya sebuah unit yang hilang punya tempat untuk terlihat,
    // bukan menguap tanpa jejak seperti Rutan Negara selama ini.
    jumlahMasukan: daftarUpt.length,
    tidakTerindeks: daftarUpt.length - entri.length,
    dariWilayah,
    sebutanTerpasang,
    sebutanTakDikenal,
    jumlahBersaing: entri.filter((e) => e.bersaing).length,
  }
}

function tebakJenis(nama) {
  const n = normalkanUpt(nama)
  if (n.startsWith('rutan') || n.includes('rumah tahanan')) return 'Rutan'
  if (n.startsWith('lpka') || n.includes('pembinaan khusus anak')) return 'LPKA'
  if (n.startsWith('bapas') || n.includes('balai pemasyarakatan')) return 'Bapas'
  return 'Lapas'
}

/**
 * Mengumpulkan jendela teks di sekitar setiap penanda jenis UPT.
 * @returns {Array<{jenis:string, jendela:string, posisi:number}>}
 */
export function ambilJendela(teksNormal) {
  const hasil = []
  // Penanda yang sudah terpakai, dikelompokkan MENURUT JENIS.
  //
  // Penutupan ini ada supaya "rumah tahanan negara" tidak sekaligus
  // menghasilkan jendela "rumah tahanan" dan "rutan" — tiga jendela untuk satu
  // penyebutan. Seluruh penutupan semacam itu terjadi di dalam satu jenis.
  //
  // Antar-jenis justru sebaliknya: "Lapas Anak Kutoarjo" harus menghasilkan
  // jendela LPKA sekaligus jendela Lapas. Penutupan menyeluruh membuat kalimat
  // seperti "Di lapas, anak binaan mengikuti kelas" kehilangan jendela Lapas-nya
  // hanya karena dua kata itu kebetulan bersebelahan, dan berita tentang sebuah
  // Lapas biasa berakhir tidak terpetakan. Yang menang tetap ditentukan skor
  // pada tahap berikutnya, bukan oleh urutan tabel penanda.
  const terpakai = new Map()

  for (const [penanda, jenis] of PENANDA_JENIS) {
    if (!terpakai.has(jenis)) terpakai.set(jenis, [])
    const rentang = terpakai.get(jenis)
    let dari = 0
    for (;;) {
      const posisi = teksNormal.indexOf(penanda, dari)
      if (posisi === -1) break
      dari = posisi + penanda.length

      // Harus berdiri sebagai kata utuh, bukan potongan kata lain.
      const sebelum = posisi === 0 ? ' ' : teksNormal[posisi - 1]
      if (/[a-z0-9]/.test(sebelum)) continue

      // Lewati bila jendela ini sudah tercakup penanda sejenis yang lebih panjang.
      if (rentang.some(([a, b]) => posisi >= a && posisi < b)) continue
      rentang.push([posisi, posisi + penanda.length])

      // Jendela sengaja mencakup penanda jenisnya sendiri. Tanpa itu, kata
      // "perempuan" pada "Lembaga Pemasyarakatan Perempuan Kelas IIA Jakarta"
      // ikut termakan penanda, dan unit itu tidak pernah bisa dibedakan dari
      // "Lapas Kelas IIA Jakarta" yang berada di kota yang sama.
      // Sebutan lembaga lain diperiksa pada potongan pendek tepat setelah
      // penanda jenis. Lebih jauh dari itu, kata "polri" atau "kejaksaan" bisa
      // saja milik kalimat lain yang tidak ada hubungannya dengan unitnya.
      const dekat = teksNormal.slice(posisi + penanda.length, posisi + penanda.length + JENDELA_LEMBAGA)
      if (PENANDA_BUKAN_PAS.some((l) => cocokKata(dekat, l))) continue

      hasil.push({
        jenis,
        posisi,
        jendela: teksNormal.slice(posisi, posisi + penanda.length + JENDELA),
      })
    }
  }

  return hasil.sort((a, b) => a.posisi - b.posisi)
}

/**
 * Mencocokkan satu teks berita ke master UPT.
 *
 * @param {string} teks gabungan judul, ringkasan, dan catatan
 * @param {object} indeks hasil bangunIndeks()
 * @param {object} [opsi]
 * @param {number} [opsi.maksSaran=5]
 * @returns {{
 *   nama: string|null,
 *   skor: number,
 *   metode: string,
 *   otomatis: boolean,
 *   bersaing: boolean,
 *   alasan: string,
 *   saran: Array<{nama:string, skor:number, alasan:string}>
 * }}
 */
export function cocokkanUpt(teks, indeks, opsi = {}) {
  const maksSaran = opsi.maksSaran ?? 5
  const teksNormal = normalkanUpt(teks)

  if (!teksNormal) return kosong('Teks kosong')

  const jendela = ambilJendela(teksNormal)
  if (!jendela.length) {
    return kosong('Tidak ada penyebutan Lapas, Rutan, LPKA, atau Bapas dalam teks')
  }

  const nilai = new Map()

  const catat = (entri, skor, metode) => {
    const lama = nilai.get(entri.nama)
    if (!lama || skor > lama.skor) nilai.set(entri.nama, { entri, skor, metode })
  }

  for (const w of jendela) {
    for (const entri of indeks.entri) {
      // Jenis pada teks harus sejalan dengan jenis kandidat — kecuali pada satu
      // keadaan yang sudah terbukti mahal bila diabaikan.
      //
      // Wartawan memakai kata "Lapas" untuk segala tempat penahanan. Berita
      // penangkapan buronan Rutan Sukadana ditulis "kabur dari Lapas Sukadana"
      // oleh hampir seluruh media nasional, dan aturan jenis yang kaku membuang
      // semuanya — peristiwa paling penting bulan itu tidak pernah sampai ke
      // unit yang bersangkutan.
      //
      // Kelonggaran ini dibatasi tiga syarat sekaligus, supaya tidak berubah
      // menjadi sumber salah cocok:
      //   1. hanya antara Lapas dan Rutan, dua jenis yang memang dipertukarkan
      //      dalam bahasa sehari-hari. Bapas dan LPKA adalah lembaga dengan
      //      tugas berbeda — "Bapas Balikpapan" tidak boleh menjadi "Lapas
      //      Balikpapan" hanya karena nama kotanya sama;
      //   2. nama tempatnya hanya dipakai satu unit di seluruh Indonesia. Untuk
      //      Kota Agung, yang punya Lapas sekaligus Rutan, syarat ini gagal dan
      //      penyebutannya tetap diserahkan ke analis;
      //   3. skornya ditekan di bawah pencocokan sejenis, sehingga kandidat
      //      yang jenisnya benar selalu menang bila keduanya muncul.
      const jenisSama = entri.jenis === w.jenis
      const lintasJenisDiizinkan =
        !jenisSama &&
        entri.unikNasional &&
        LINTAS_JENIS.has(entri.jenis) &&
        LINTAS_JENIS.has(w.jenis)
      if (!jenisSama && !lintasJenisDiizinkan) continue

      // Sebutan populer diperiksa lebih dulu; bila wartawan menulis "Rutan
      // Salemba", itu penunjukan yang jauh lebih tegas daripada tebakan token.
      const sebutanCocok = entri.sebutan.find((s) => cocokKata(w.jendela, s))
      if (sebutanCocok) {
        catat(entri, 0.94, 'sebutan-populer')
        continue
      }

      // Bentuk rapat hanya diuji sebagai satu kata utuh, bukan sebagai
      // potongan di tengah kata lain. Tanpa penjagaan ini, "Kejagung" akan
      // ditarik menjadi "Rutan Kelas IIB Kota Agung".
      const cocok = tokenYangCocok(w.jendela, entri.token)
      if (!cocok.length) continue

      // Kata subjenis tidak pernah cukup berdiri sendiri. Judul "Rumah Dinas
      // Kepala Lapas Digerebek, Perempuan 19 Tahun" pernah tertarik ke Lapas
      // Perempuan Pangkalpinang hanya karena kata "perempuan" muncul di
      // kalimat berikutnya.
      if (cocok.every((t) => TOKEN_SUBJENIS.has(t))) continue

      const rasio = cocok.length / entri.token.length

      if (rasio === 1) {
        // Makin dekat nama dengan penanda jenisnya, makin kuat. Makin banyak
        // token pembeda yang cocok, makin spesifik penunjukannya.
        const jarak = posisiTerawal(w.jendela, entri.token)
        const kedekatan = Math.max(0, 1 - jarak / JENDELA)
        const kekhususan = Math.min(1, (entri.token.length - 1) / 2)
        const penuh = Math.min(0.99, 0.76 + 0.14 * kedekatan + 0.09 * kekhususan)
        if (jenisSama) {
          catat(entri, penuh, 'nama-lengkap')
        } else {
          // Cukup untuk diterima otomatis, tetapi selalu kalah oleh kandidat
          // yang jenisnya memang cocok.
          catat(entri, Math.min(0.82, penuh - 0.1), 'nama-lintas-jenis')
        }
        continue
      }

      // Pencocokan sebagian sudah lemah dengan sendirinya; menambah ketidak-
      // cocokan jenis di atasnya menghasilkan tebakan, bukan penunjukan.
      if (!jenisSama) continue

      // Sebagian token cocok — misalnya teks menulis "Lapas Banceuy" untuk
      // "Lapas Kelas IIA Banceuy Bandung".
      const tokenPanjangCocok = cocok.some((t) => t.length >= 5)
      if (rasio < 0.5 || !tokenPanjangCocok) continue

      let skor = 0.4 + 0.32 * rasio
      if (entri.petunjuk && cocokKata(w.jendela, entri.petunjuk)) skor += 0.12
      if (entri.kabkota && cocokKata(teksNormal, entri.kabkota)) skor += 0.08
      if (entri.kelas && w.jendela.includes(`kelas ${entri.kelas}`)) skor += 0.1
      if (entri.subjenis !== 'Umum' && cocokKata(w.jendela, normalkanUpt(entri.subjenis))) skor += 0.1

      catat(entri, Math.min(0.9, skor), 'nama-sebagian')
    }
  }

  // Penyebutan lewat nama kabupaten/kota, bukan nama unitnya.
  //
  // "Napi kabur dari Rutan Lampung Timur" tidak memuat kata "Sukadana" sama
  // sekali, padahal Rutan Kelas IIB Sukadana adalah satu-satunya rutan di
  // kabupaten itu. Lapisan ini hanya dijalankan ketika tidak ada satu pun
  // kandidat dari nama unit, dan hanya menerima kabupaten/kota yang menaungi
  // tepat satu UPT — nama provinsi sengaja tidak dipakai, sebab "Lapas Lampung"
  // bisa berarti belasan unit dan menebak salah satunya lebih buruk daripada
  // mengaku tidak tahu.
  //
  // Syaratnya bukan "belum ada kandidat sama sekali", melainkan "belum ada
  // kandidat yang cukup kuat". Judul yang menyebut Rutan Lampung Timur selalu
  // lebih dulu menghasilkan kandidat lemah dari kata "Lampung" pada nama unit
  // lain; bila kehadiran kandidat lemah itu menutup lapisan ini, wilayahnya
  // tidak pernah sempat diperiksa dan beritanya tetap tidak terpetakan.
  const adaYangKuat = [...nilai.values()].some((v) => v.skor >= AMBANG_OTOMATIS)
  if (!adaYangKuat) {
    for (const w of jendela) {
      for (const entri of indeks.entri) {
        if (entri.jenis !== w.jenis) continue
        if (!entri.kabkotaUnik) continue
        if (entri.token.some((t) => cocokKata(w.jendela, t))) continue
        if (!cocokKata(w.jendela, entri.kabkota)) continue
        catat(entri, 0.78, 'wilayah-kabkota')
      }
    }
  }

  // Sebutan populer yang muncul tanpa penanda jenis sama sekali — misalnya
  // judul yang hanya menulis "Tanjung Gusta" — tetap ditangkap, dengan skor
  // lebih rendah karena penunjukannya kurang tegas.
  if (!nilai.size) {
    for (const entri of indeks.entri) {
      const sebutanCocok = entri.sebutan.find((s) => cocokKata(teksNormal, s))
      if (sebutanCocok) catat(entri, 0.74, 'sebutan-tanpa-jenis')
    }
  }

  if (!nilai.size) {
    return kosong('Penanda jenis UPT ditemukan, tetapi nama unitnya tidak dikenali')
  }

  const urut = [...nilai.values()].sort((a, b) => b.skor - a.skor)
  const juara = urut[0]
  const kembar = urut.filter((u) => Math.abs(u.skor - juara.skor) < 0.02)

  const bersaing = juara.entri.bersaing || kembar.length > 1
  const otomatis = juara.skor >= AMBANG_OTOMATIS && !bersaing

  return {
    nama: otomatis ? juara.entri.nama : null,
    skor: Number(juara.skor.toFixed(3)),
    metode: juara.metode,
    otomatis,
    bersaing,
    alasan: susunAlasan(juara, bersaing, otomatis),
    saran: urut
      .filter((u) => u.skor >= AMBANG_SARAN)
      .slice(0, maksSaran)
      .map((u) => ({
        nama: u.entri.nama,
        skor: Number(u.skor.toFixed(3)),
        provinsi: u.entri.provinsi,
        kanwil: u.entri.kanwil,
        alasan: u.metode === 'nama-lengkap' ? 'Nama unit tersebut utuh setelah penanda jenis' : 'Sebagian nama unit cocok',
      })),
  }
}

/**
 * Kata subjenis. Membedakan unit, tetapi tidak pernah menunjuk satu unit
 * sendirian — ada puluhan Lapas Perempuan dan puluhan Lapas Narkotika.
 */
const TOKEN_SUBJENIS = new Set(['perempuan', 'narkotika', 'anak', 'terbuka', 'pemuda', 'wanita'])

/**
 * Mencari token nama unit di dalam jendela, termasuk ketika media menulisnya
 * rapat tanpa spasi.
 *
 * Persoalannya nyata: data induk menulis "Lapas Narkotika Kelas IIA Tanjung
 * Pinang", sedangkan berita menulis "Lapas Narkotika Kelas IIA Tanjungpinang".
 * Menguji token satu per satu gagal pada "tanjung" dan "pinang"; menguji
 * seluruh nama dirapatkan gagal karena "narkotika" tetap terpisah. Yang
 * berhasil adalah menguji setiap runtun token yang berurutan — dan runtun
 * "tanjung pinang" dirapatkan menjadi "tanjungpinang" memang ada di sana.
 *
 * @returns {string[]} token yang berhasil dicocokkan, tanpa pengulangan
 */
function tokenYangCocok(jendela, token) {
  const terpakai = new Array(token.length).fill(false)

  // Runtun terpanjang diuji lebih dulu supaya "tanjungpinang" menang atas
  // kemungkinan "tanjung" yang kebetulan berdiri sendiri di tempat lain.
  for (let panjang = token.length; panjang >= 2; panjang -= 1) {
    for (let mulai = 0; mulai + panjang <= token.length; mulai += 1) {
      let adaYangKosong = false
      for (let i = mulai; i < mulai + panjang; i += 1) if (!terpakai[i]) adaYangKosong = true
      if (!adaYangKosong) continue

      const rapat = token.slice(mulai, mulai + panjang).join('')
      if (!cocokKataLonggar(jendela, rapat)) continue
      for (let i = mulai; i < mulai + panjang; i += 1) terpakai[i] = true
    }
  }

  for (let i = 0; i < token.length; i += 1) {
    if (terpakai[i]) continue
    const t = token[i]
    if (t.length >= 7 ? cocokKataLonggar(jendela, t) : cocokKata(jendela, t)) terpakai[i] = true
  }

  return token.filter((_, i) => terpakai[i])
}

function cocokKata(haystack, kata) {
  if (!kata) return false
  let dari = 0
  for (;;) {
    const p = haystack.indexOf(kata, dari)
    if (p === -1) return false
    const sebelum = p === 0 ? ' ' : haystack[p - 1]
    const sesudah = haystack[p + kata.length] ?? ' '
    if (!/[a-z0-9]/.test(sebelum) && !/[a-z0-9]/.test(sesudah)) return true
    dari = p + 1
  }
}

/**
 * Benar bila dua kata sama, atau berbeda paling banyak satu huruf.
 *
 * Ejaan nama daerah pada data induk dan pada media kerap berselisih satu huruf:
 * "Padang Sidempuan" di data induk, "Padangsidimpuan" di berita; "Bireun" dan
 * "Bireuen"; "Tobello" dan "Tobelo". Selisih sekecil itu tidak boleh membuat
 * sebuah unit hilang dari laporan.
 */
function miripSatuHuruf(a, b) {
  if (a === b) return true
  const selisih = a.length - b.length
  if (selisih > 1 || selisih < -1) return false
  if (a.length < 7 && b.length < 7) return false

  if (selisih === 0) {
    let beda = 0
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i] && ++beda > 1) return false
    }
    return beda === 1
  }

  const panjang = selisih === 1 ? a : b
  const pendek = selisih === 1 ? b : a
  let i = 0
  let j = 0
  let lewat = 0
  while (i < panjang.length && j < pendek.length) {
    if (panjang[i] === pendek[j]) { i += 1; j += 1; continue }
    if (++lewat > 1) return false
    i += 1
  }
  return true
}

/** Mencari satu kata dalam jendela dengan toleransi selisih satu huruf. */
function cocokKataLonggar(haystack, kata) {
  if (cocokKata(haystack, kata)) return true
  if (kata.length < 7) return false
  for (const potong of haystack.split(' ')) {
    if (miripSatuHuruf(potong, kata)) return true
  }
  return false
}

function posisiTerawal(haystack, token) {
  let min = Infinity
  for (const t of token) {
    const p = haystack.indexOf(t)
    if (p !== -1 && p < min) min = p
  }
  return min === Infinity ? JENDELA : min
}

function kosong(alasan) {
  return { nama: null, skor: 0, metode: 'tidak-ada', otomatis: false, bersaing: false, alasan, saran: [] }
}

function susunAlasan(juara, bersaing, otomatis) {
  if (otomatis && juara.metode === 'nama-lintas-jenis') {
    return `${juara.entri.nama} dikenali dari nama tempatnya. Teks menyebut jenis unit yang `
      + `berbeda, tetapi nama itu hanya dipakai satu unit di seluruh Indonesia.`
  }
  if (otomatis && juara.metode === 'wilayah-kabkota') {
    return `${juara.entri.nama} dikenali dari nama kabupaten/kota yang disebut; `
      + `unit ini satu-satunya di wilayah tersebut.`
  }
  if (otomatis) {
    return `${juara.entri.nama} dikenali dari teks dengan keyakinan ${Math.round(juara.skor * 100)} persen.`
  }
  if (bersaing) {
    return `Nama unit yang disebut dipakai oleh lebih dari satu UPT. Perlu dipastikan analis.`
  }
  return `Kandidat terkuat ${juara.entri.nama} baru mencapai ${Math.round(juara.skor * 100)} persen, di bawah ambang penerimaan otomatis.`
}

export const NILAI_TAK_TERPETAKAN = new Set([
  '', 'belum teridentifikasi', 'tidak diketahui', 'null', 'none', 'nan', '-', 'undefined',
])

/** Satu-satunya pemeriksaan "apakah UPT ini sudah terpetakan" di seluruh sistem. */
export function belumTerpetakan(nama) {
  return NILAI_TAK_TERPETAKAN.has(String(nama ?? '').trim().toLowerCase())
}

export const META_PENCOCOK = { versi: 'kedekatan-v2.1', ambangOtomatis: AMBANG_OTOMATIS, ambangSaran: AMBANG_SARAN }
