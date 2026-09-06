/**
 * Edge Function: penjaring
 *
 * Perayap berita Trans-Siber PAS. Membaca RSS Google News sendiri dan menulis
 * langsung ke tabel `berita` — tanpa spreadsheet, tanpa Apps Script, tanpa
 * kuota UrlFetchApp.
 *
 * ---------------------------------------------------------------------------
 * KENAPA FUNGSI INI ADA
 * ---------------------------------------------------------------------------
 *
 * Diukur 6 September 2026. Seluruh rantai penyalin sehat — `sheet-sync`
 * berjalan tiap lima menit tanpa galat, `klasifikasi` tidak meninggalkan satu
 * baris pun tanpa nilai — namun yang masuk hari itu hanya delapan berita.
 *
 * Sebabnya di hulu, di tempat yang tidak bisa dilihat sistem ini: skrip Apps
 * Script milik spreadsheet. Yang dikerjakan `sheet-sync` adalah menyalin apa
 * yang sudah tertulis di lembar. Lembarnya bertambah empat baris sehari;
 * empat baris itulah seluruh yang bisa disalin. Satu kueri RSS Google News atas
 * kata "napi kabur" mengembalikan 100 butir.
 *
 * Beritanya ada. Ia tidak pernah dijaring.
 *
 * ---------------------------------------------------------------------------
 * DUA PEKERJAAN
 * ---------------------------------------------------------------------------
 *
 *   aksi "jaring"    menjalankan kueri dan menanam berita baru
 *   aksi "perbaiki"  menguraikan alamat Google News yang TERLANJUR tersimpan
 *
 * Yang kedua bukan kerapian. Diukur pada hari yang sama: 605 dari 861 baris
 * arsip menyimpan alamat pengalihan `news.google.com/rss/articles/...` sebagai
 * tautannya, bukan alamat portalnya. Akibatnya tiga, dan ketiganya diam:
 * analis yang menekan tautan dilempar lewat pengalihan Google yang bisa
 * kedaluwarsa; kolom platform seluruhnya berbunyi "Google News" sehingga
 * sebaran media tidak bisa dibaca; dan penyaring kembar kehilangan seluruh
 * dayanya — artikel yang sama dari sumber lain tersimpan sebagai berita kedua,
 * sebab alamatnya memang berbeda.
 *
 * ---------------------------------------------------------------------------
 * MENGURAIKAN ALAMAT GOOGLE NEWS
 * ---------------------------------------------------------------------------
 *
 * RSS Google News tidak pernah memberi alamat artikel. Yang diberikan alamat
 * pengalihan miliknya sendiri, dan sejak pengenal bentuk baru (`AU_yqL...`)
 * alamat aslinya TIDAK lagi tersimpan di dalam pengenal itu — memecahkan
 * base64-nya hanya menghasilkan protobuf tanpa satu pun alamat. Halaman
 * pengalihannya pun tidak memuatnya; alamatnya baru diberikan setelah
 * halamannya menjalankan JavaScript.
 *
 * Jalannya karena itu dua langkah:
 *
 *   1. Unduh halaman artikelnya, ambil `data-n-a-sg` (tanda tangan) dan
 *      `data-n-a-ts` (cap waktu) dari dalamnya.
 *   2. POST ke titik `batchexecute` Google dengan keduanya.
 *
 * Tanda tangannya terikat pada artikel itu sendiri: dicoba dengan tanda tangan
 * artikel lain, atau dikosongkan, Google membalas hasil kosong. Diuji langsung
 * 6 September 2026 — tidak ada jalan memotongnya.
 *
 * Yang bisa dipotong pengulangannya, dan itulah gunanya `penjaring_alamat`.
 * Satu artikel bertahan berminggu-minggu di dalam umpan dan muncul di beberapa
 * kueri sekaligus; tanpa simpanan, tiap jalan membayar ulang biaya penuh untuk
 * jawaban yang sudah diketahui. Kegagalan ikut disimpan, karena alamat yang
 * tidak bisa diuraikan hari ini hampir selalu tetap begitu besok.
 *
 * Butir yang gagal diuraikan DIBUANG, tidak ditanam apa adanya. Lebih baik
 * kehilangan satu berita daripada menanam satu kembaran yang tidak bisa
 * dikenali lapis penyaringan mana pun sesudahnya.
 *
 * ---------------------------------------------------------------------------
 * CARA MEMANGGIL
 * ---------------------------------------------------------------------------
 *
 *   POST /functions/v1/penjaring
 *   header: x-sync-token: <SHEET_SYNC_TOKEN>
 *   body:
 *     { "aksi": "jaring", "mode": "umpan", "batas_umpan": 12 }
 *     { "aksi": "jaring", "mode": "umum" | "isu" | "unit",
 *       "batas_kueri": 8, "batas_uraikan": 40, "kering": false }
 *     { "aksi": "perbaiki", "batas": 40 }
 *     { "aksi": "diagnosa" }
 *
 * EMPAT MODE, DAN SATU DI ANTARANYA TIDAK BERGANTUNG PADA GOOGLE
 *
 *   umpan   membaca RSS milik portalnya sendiri — ANTARA pusat dan 34 kantor
 *           daerahnya, CNN, Medcom, VIVA, iNews, RRI, Tempo, SINDO, Republika.
 *           Alamatnya sudah alamat artikel; tidak ada yang perlu diuraikan.
 *           Inilah satu-satunya mode yang tetap bekerja pada hari Google
 *           menolak peladen ini, dan kantor daerah ANTARA justru yang meliput
 *           unit-unit kecil yang tidak pernah muncul di arsip.
 *   umum    pencarian Google News dengan kata kunci luas — volume terbesar.
 *   isu     pencarian bertarget taksonomi negatif.
 *   unit    pencarian per nama unit, dimulai dari yang paling lama sunyi.
 *
 * Tanpa token, fungsi yang sehat membalas 401 — itulah uji hidup yang tidak
 * meninggalkan efek samping apa pun.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERSI = 'penjaring-v1.0'

const KEPALA = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Berita lebih tua dari ini dilewati.
 *
 * Lima hari, bukan empat puluh lima. Dipersempit atas permintaan pengguna
 * 6 September 2026, dan alasannya lebih dari sekadar kerapian:
 *
 *   - Angka "berita masuk hari ini" di dasbor berhenti berarti apa pun bila
 *     yang masuk hari ini ternyata terbit sebulan lalu.
 *   - Pemberitahuan Telegram berbunyi "BERITA NEGATIF MASUK". Pada berita
 *     penembakan atau kematian, mengabarkan peristiwa sebulan lalu seolah baru
 *     berujung pada tindakan yang tidak perlu.
 *   - Penguraian alamat adalah sumber daya paling mahal fungsi ini. Yang
 *     dipakai untuk arsip lama adalah yang tidak dipakai untuk berita hari ini.
 */
const UMUR_MAKS_HARI = 5

/**
 * Berapa butir teratas dipakai dari tiap kueri.
 *
 * Google membalas 100. Yang di bawah urutan ke-40 hampir selalu artikel lama
 * yang sudah pernah lewat, dan tiap butir baru berharga satu penguraian alamat
 * — sumber daya paling mahal yang dipunyai fungsi ini.
 */
const BUTIR_PER_KUERI = 40

/**
 * Umpan portal yang dibaca bersamaan.
 *
 * Hanya mode umpan yang punya angka ini. Permintaan ke Google tidak dibatasi
 * di sini melainkan oleh antrean pg_net di dalam basis data — lihat lewatDb().
 */
const SERENTAK_UMPAN = 6

/** Jeda antar-gelombang, milidetik. Menjaga agar tidak dianggap serangan. */
const JEDA_MS = 400

const PERAMBAN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

/** Nama yang dipakai bila mesin pencocokan belum menentukan unitnya. */
const UPT_BELUM = 'Belum Teridentifikasi'

function env(nama: string): string {
  return Deno.env.get(nama)?.trim() || ''
}

function jawab(isi: unknown, status = 200): Response {
  return new Response(JSON.stringify(isi, null, 2), { status, headers: KEPALA })
}

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ===================================================== penyeragaman tautan */

const PENANDA_PELACAK = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'igsh', 'igshid', 'mibextid',
  'ref', 'ref_src', 'refsrc', 'source', 'src', 'spm', 'scm',
  'mc_cid', 'mc_eid', '_ga', '_gl', 'ncid', 'cmpid', 'campaign_id',
  'at_medium', 'at_campaign', 'share_id', 'si',
])

/**
 * Salinan aturan `public.normalkan_tautan()`, dan yang paling tidak berwenang.
 *
 * Yang menentukan bentuk tersimpan tetap pemicu basis data; apa pun yang
 * dikirim dari sini akan ditimpa di sana. Salinan ini ada untuk satu hal saja:
 * menyaring kembar SEBELUM baris dikirim, supaya satu jalan tidak menghabiskan
 * penguraian alamat untuk artikel yang sudah ada.
 */
function normalkanTautan(nilai: unknown): string {
  let teks = String(nilai ?? '').replace(/\s+/g, ' ').trim()
  if (!teks) return ''
  if (!/^https?:\/\//i.test(teks)) teks = `https://${teks}`

  try {
    const alamat = new URL(teks)
    alamat.hash = ''
    alamat.protocol = 'https:'
    alamat.hostname = alamat.hostname.toLowerCase().replace(/^www\./, '')

    for (const kunci of [...alamat.searchParams.keys()]) {
      const k = kunci.toLowerCase()
      if (k.startsWith('utm_') || PENANDA_PELACAK.has(k)) alamat.searchParams.delete(kunci)
    }

    let hasil = alamat.toString()
    hasil = hasil.replace(/\?$/, '')
    hasil = hasil.replace(/\/amp\/?$/i, '')
    hasil = hasil.replace(/\?outputType=amp$/i, '')
    return hasil.replace(/\/+$/, '')
  } catch {
    return teks.replace(/\/+$/, '')
  }
}

/**
 * Membuang ruas `/amp/` di depan jalur.
 *
 * Google membalas bentuk AMP-nya untuk sebagian portal
 * (`kaltim.antaranews.com/amp/berita/266284/...`). Bentuk itu MEMBUKA dengan
 * benar, jadi menyimpannya tidak merugikan pembaca — yang merugikan adalah
 * ia berbeda dari alamat yang sama tanpa `/amp/`, sehingga artikel yang sama
 * dari sumber lain lolos penyaring kembar.
 *
 * Diperiksa langsung terhadap contoh nyata 6 September 2026: kedua bentuk
 * membalas 200. Yang dibuang hanya ruas PERTAMA, dan hanya bila masih ada
 * jalur sesudahnya — `contoh.com/amp` sendirian bisa jadi memang halamannya.
 */
function tanpaAmp(url: string): string {
  try {
    const a = new URL(url)
    if (/^\/amp\/.+/i.test(a.pathname)) {
      a.pathname = a.pathname.replace(/^\/amp\//i, '/')
      return a.toString()
    }
  } catch { /* alamat tak terurai dikembalikan apa adanya */ }
  return url
}

function hostDari(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

function kenaliPlatform(url: string): string {
  const host = hostDari(url).toLowerCase()
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube'
  if (host.includes('instagram.com')) return 'Instagram'
  if (host.includes('facebook.com') || host.includes('fb.watch')) return 'Facebook'
  if (host.includes('tiktok.com')) return 'TikTok'
  if (host.includes('news.google.com')) return 'Google News'
  return 'Portal Berita'
}

/* ============================================================ pengurai RSS */

/** Membalikkan entitas HTML yang dipakai RSS. Urutan `&amp;` terakhir — wajib. */
function nyahEntitas(teks: string): string {
  return teks
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
}

function isiTag(potongan: string, tag: string): string {
  const cocok = potongan.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!cocok) return ''
  return nyahEntitas(cocok[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim()
}

interface Butir {
  judul: string
  portal: string
  tautanRss: string
  keterangan: string
  tanggal: Date
  gnewsId: string
}

/** Pengenal artikel di dalam alamat Google News, atau '' bila bukan alamat itu. */
function idGnews(url: string): string {
  const cocok = url.match(/news\.google\.com\/(?:rss\/)?(?:articles|read)\/([^?#/]+)/i)
  return cocok ? cocok[1] : ''
}

function uraiRss(xml: string): Butir[] {
  const batasWaktu = Date.now() - UMUR_MAKS_HARI * 24 * 60 * 60 * 1000
  const hasil: Butir[] = []

  for (const kasar of xml.split('<item>').slice(1)) {
    // Dipotong pada </item> — lihat alasannya di uraiUmpan().
    const tutup = kasar.indexOf('</item>')
    const potongan = tutup > 0 ? kasar.slice(0, tutup) : kasar

    const judulPenuh = isiTag(potongan, 'title')
    const tautanRss = isiTag(potongan, 'link')
    if (!judulPenuh || !tautanRss) continue

    const tanggal = new Date(isiTag(potongan, 'pubDate'))
    if (isNaN(tanggal.getTime()) || tanggal.getTime() < batasWaktu) continue

    // Judul Google News selalu berbentuk "Judul berita - Nama Portal".
    let judul = judulPenuh
    let portal = ''
    const pisah = judulPenuh.lastIndexOf(' - ')
    if (pisah > 20) {
      judul = judulPenuh.slice(0, pisah).trim()
      portal = judulPenuh.slice(pisah + 3).trim()
    }
    if (!portal) portal = isiTag(potongan, 'source') || 'Google News'

    hasil.push({
      judul,
      portal,
      tautanRss,
      keterangan: isiTag(potongan, 'description'),
      tanggal,
      gnewsId: idGnews(tautanRss),
    })
  }

  return hasil
}

/* ========================================================= saringan relevansi */

/**
 * Kata yang menandai sebuah berita benar-benar berbicara tentang Pemasyarakatan.
 *
 * ---------------------------------------------------------------------------
 * KENAPA INI REGEX BERBATAS KATA, BUKAN DAFTAR `includes()`
 * ---------------------------------------------------------------------------
 *
 * Ditemukan uji kering 6 September 2026, pada jalan pertama mode umpan. Dari
 * 947 butir, tiga belas "lolos" — dan ketiga belasnya salah: One Piece 1192,
 * hasil Man City, harga Asus TUF Gaming.
 *
 * Sebabnya satu kata: **per-TAHANAN**. Pencocokan `includes('tahanan')` cocok
 * di tengah "pertahanan", dan "Garudayaksa Siapkan Pertahanan Rapat" masuk ke
 * arsip intelijen pemasyarakatan. Hal yang sama menunggu di "kelapas", "senapi",
 * dan entah berapa kata lain yang belum sempat lewat.
 *
 * Bahayanya bukan kotornya arsip semata. Umpan portal memuat SELURUH berita
 * sebuah portal, ratusan sehari, dan satu jangkar yang bocor mengalirkan
 * semuanya. Pada mode pencarian Google kebocoran itu tertutup kuerinya; di sini
 * tidak ada yang menutupinya.
 *
 * Pelajaran yang sama sudah dibayar mesin klasifikasi pada `letakFrasa()`:
 * mencari kata di dalam teks tanpa sadar imbuhan mengembalikan jawaban yang
 * salah secara halus, dan yang di atasnya menyimpulkan hal yang berlawanan.
 *
 * Kata yang bisa berdiri sendiri diberi batas kiri-kanan; frasa yang tidak
 * mungkin muncul sebagai bagian kata lain ("pemasyarakatan", "warga binaan")
 * dibiarkan tanpa batas.
 */
const JANGKAR_KATA = /(?<![a-z])(lapas|rutan|napi|narapidana|sipir|bapas|lpka|wbp|tahanan|kalapas|karutan|napiter)(?![a-z])/
const JANGKAR_FRASA = /(pemasyarakatan|warga binaan|lembaga pemasyarakatan|rumah tahanan|ditjenpas|kemenimipas|ditjen pas)/

/** Benar bila teksnya benar-benar berbicara tentang Pemasyarakatan. */
function berjangkar(b: Butir): boolean {
  // Tanda baca diganti spasi lebih dulu supaya "Lapas," dan "(napi)" tetap
  // terbaca sebagai kata yang berdiri sendiri.
  const teks = `${b.judul} ${b.keterangan}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  return JANGKAR_KATA.test(teks) || JANGKAR_FRASA.test(teks)
}

/**
 * Benar bila berita itu memang tentang unit yang sedang dicari.
 *
 * Dua syarat, dan keduanya perlu. Kueri "Lapas Kelas IIB Ende" mengembalikan
 * berita tentang KOTA Ende yang tidak ada urusannya dengan Pemasyarakatan —
 * ditolak syarat pertama. Kueri yang sama juga mengembalikan berita lapas lain
 * yang kebetulan memuat kata "kelas" dan "ende" di kalimat berbeda — ditolak
 * syarat kedua, yang menuntut penanda tempat unitnya muncul.
 */
function relevanUntukUnit(b: Butir, namaUnit: string): boolean {
  if (!berjangkar(b)) return false

  const teks = `${b.judul} ${b.keterangan}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  const kata = namaUnit.split(/\s+/)
  const penanda: string[] = []

  for (let i = kata.length - 1; i >= 0 && penanda.length < 2; i--) {
    // Disamakan bentuknya dengan teks yang sudah dibersihkan tanda bacanya —
    // tanpa itu "Siborong-Borong" tidak akan pernah cocok pada "siborong borong".
    const k = kata[i].toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (/^(lapas|rutan|bapas|lpka|kelas|perempuan|narkotika|terbuka|khusus|pemuda|i{1,3}|iv|ia|ib|iia|iib|iiia|iiib)$/.test(k)) continue
    if (k.length < 4) continue
    penanda.push(k)
  }

  if (!penanda.length) return true   // nama tanpa penanda tempat; serahkan ke mesin

  // Berbatas kata, karena alasan yang sama dengan JANGKAR_KATA: "Ende" yang
  // dicari dengan `includes` cocok di dalam "vendor", "kalender", dan "bende".
  return penanda.some((p) => new RegExp(`(?<![a-z])${p}(?![a-z])`).test(teks))
}

/**
 * Menyusun kueri untuk satu unit, dengan ragam namanya.
 *
 * "Lapas Kelas IIB Tobello" hampir tidak pernah ditulis lengkap oleh wartawan.
 * Yang ditulis "Lapas Tobello". Mencari hanya bentuk resminya berarti
 * melewatkan sebagian besar beritanya — bentuk resmi hanya dipakai siaran pers
 * unit itu sendiri, yang justru sudah tertangkap sumber lain.
 *
 * Bentuk ringkas TIDAK dipakai untuk unit berketerangan: "Lapas Perempuan
 * Kelas IIA Semarang" yang diringkas menjadi "Lapas Semarang" akan menarik
 * berita Lapas Kelas I Semarang — unit berbeda di kota yang sama.
 */
function kueriUnit(namaLengkap: string): string {
  const ragam = new Set<string>([namaLengkap])

  const pendek = namaLengkap
    .replace(/\s+Kelas\s+(I{1,3}|IV)[AB]?\b/i, '')
    .replace(/\s+Kelas\s+\d+[AB]?\b/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (pendek && pendek !== namaLengkap) ragam.add(pendek)

  const cocok = namaLengkap.match(/^(Lapas|Rutan|Bapas|LPKA)\s+Kelas\s+\S+\s+(.+)$/)
  if (cocok) {
    const ringkas = `${cocok[1]} ${cocok[2]}`
    if (ringkas.length > 6) ragam.add(ringkas)
  }

  const bagian: string[] = []
  for (const k of ragam) {
    // Sisa penanda kelas dibuang: "Lapas IIB Tobello" tidak pernah ditulis satu
    // wartawan pun, dan memakan satu dari tiga slot kueri yang tersedia.
    if (/\b(I{1,3}|IV)[AB]?\b/.test(k.replace(namaLengkap, ''))) continue
    bagian.push(`"${k}"`)
  }

  return bagian.slice(0, 3).join(' OR ')
}

/* =========================================================== jejak jaringan */

interface Jejak {
  panggilan: number
  batas: number
  ditolak429: boolean
  /* Galat penerus disimpan, tidak hanya dicetak ke console.
     Jurnal yang menyebut "0 butir" tanpa menyebut sebabnya adalah jurnal yang
     memaksa orang berikutnya mengulang seluruh penyelidikan dari nol. */
  galat?: string[]
}

/* ================================================ penerus lewat basis data */

interface Permintaan { kunci: string; url: string; metode?: 'GET' | 'POST' }
interface Jawaban { status: number; isi: string }

/**
 * Menitipkan permintaan ke Google lewat basis data, lalu menunggu jawabannya.
 *
 * Fungsi ini TIDAK memanggil Google sendiri, dan itu disengaja. Diukur
 * 6 September 2026 dengan permintaan yang sama pada menit yang sama:
 * dari Edge Function 503, dari basis data 200 dengan 100 butir. Alamat IP
 * Deno Deploy dipakai bersama ribuan proyek dan Google menolak seluruh
 * julatnya; basis datanya punya alamat sendiri.
 *
 * Seluruh permintaan dititipkan lebih dulu, baru jawabannya ditunggu bersama.
 * Menitipkan satu lalu menunggu satu berarti membayar seluruh waktu tunggu
 * jaringan secara berurutan — empat puluh permintaan menjadi berpuluh detik
 * yang tidak perlu.
 */
async function lewatDb(
  db: ReturnType<typeof createClient>,
  daftar: Permintaan[],
  jejak: Jejak,
  batasTungguMs = 90_000,
): Promise<Map<string, Jawaban>> {
  const hasil = new Map<string, Jawaban>()
  if (!daftar.length) return hasil

  const kepala = { 'User-Agent': PERAMBAN, 'Accept-Language': 'id-ID,id;q=0.9' }
  const idKe = new Map<number, string>()

  const dititipkan = await Promise.all(daftar.map(async (p) => {
    if (jejak.panggilan >= jejak.batas) return null
    jejak.panggilan++
    const { data, error } = await db.rpc('jaring_minta', {
      p_url: p.url, p_headers: kepala, p_metode: p.metode || 'GET',
    })
    if (error) {
      console.error(`Gagal menitipkan ${p.kunci}: ${error.message}`)
      ;(jejak.galat ||= []).push(`titip: ${error.message}`)
      return null
    }
    return { id: Number(data), kunci: p.kunci }
  }))

  for (const d of dititipkan) if (d) idKe.set(d.id, d.kunci)
  if (!idKe.size) return hasil

  const mulai = Date.now()
  const tersisa = new Set(idKe.keys())

  while (tersisa.size && Date.now() - mulai < batasTungguMs) {
    await tidur(800)
    const { data, error } = await db.rpc('jaring_hasil', { p_ids: [...tersisa] })
    if (error) {
      console.error(`Gagal membaca jawaban: ${error.message}`)
      ;(jejak.galat ||= []).push(`baca: ${error.message}`)
      break
    }

    for (const r of data || []) {
      const kunci = idKe.get(Number(r.id))
      if (!kunci) continue
      tersisa.delete(Number(r.id))

      const status = Number(r.status_code || 0)
      // 429 dan 503 sama-sama berarti "berhenti dulu". Ditandai supaya jalan
      // ini tidak melanjutkan penguraian yang pasti ditolak juga.
      if (status === 429 || status === 503) jejak.ditolak429 = true
      hasil.set(kunci, { status, isi: String(r.isi || '') })
    }
  }

  // Yang belum menjawab sampai batas waktu dibiarkan tidak ada di peta;
  // pemanggilnya membaca itu sebagai "belum sempat", bukan "gagal".
  return hasil
}

/** Alamat pencarian RSS Google News untuk sebuah kueri. */
function alamatRss(kueri: string): string {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(kueri)}&hl=id&gl=ID&ceid=ID:id`
}

/**
 * Menguraikan sekumpulan pengenal Google News menjadi alamat portalnya.
 *
 * Dua gelombang, dan keduanya wajib:
 *
 *   1. Halaman artikelnya diunduh untuk mengambil tanda tangan (`data-n-a-sg`)
 *      dan cap waktunya (`data-n-a-ts`).
 *   2. Keduanya dikirim ke titik `batchexecute`, yang membalas alamat aslinya.
 *
 * `f.req` dititipkan sebagai parameter query, bukan badan permintaan. pg_net
 * menolak Content-Type selain application/json sedangkan batchexecute menuntut
 * form-urlencoded pada badannya — jalan buntu yang ditembus dengan cara ini.
 * Diuji langsung: Google menerimanya pada POST, dan membalas 405 pada GET.
 */
async function uraikanBanyak(
  db: ReturnType<typeof createClient>,
  ids: string[],
  jejak: Jejak,
): Promise<Map<string, string>> {
  const hasil = new Map<string, string>()
  if (!ids.length || jejak.ditolak429) return hasil

  const halaman = await lewatDb(db, ids.map((id) => ({
    kunci: id,
    url: `https://news.google.com/rss/articles/${id}?hl=id&gl=ID&ceid=ID:id`,
  })), jejak)

  const permintaan: Permintaan[] = []
  for (const [id, j] of halaman) {
    if (j.status !== 200) continue
    const sg = j.isi.match(/data-n-a-sg="([^"]+)"/)?.[1]
    const ts = j.isi.match(/data-n-a-ts="([^"]+)"/)?.[1]
    const aid = j.isi.match(/data-n-a-id="([^"]+)"/)?.[1] || id
    if (!sg || !ts) continue

    const dalam = JSON.stringify([
      'garturlreq',
      [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1],
        'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      aid, Number(ts), sg,
    ])
    const freq = JSON.stringify([[['Fbv4je', dalam, null, 'generic']]])

    permintaan.push({
      kunci: id,
      metode: 'POST',
      url: 'https://news.google.com/_/DotsSplashUi/data/batchexecute'
        + `?rpcids=Fbv4je&f.req=${encodeURIComponent(freq)}`,
    })
  }

  const balasan = await lewatDb(db, permintaan, jejak)
  for (const [id, j] of balasan) {
    if (j.status !== 200) continue
    try {
      // Jawabannya diawali ")]}'" yang sengaja membuat JSON.parse gagal bila
      // seseorang memuatnya sebagai skrip. Dibuang dulu, lalu diurai.
      const luar = JSON.parse(j.isi.replace(/^\)\]\}'\s*/, ''))
      for (const baris of luar) {
        if (!Array.isArray(baris) || typeof baris[2] !== 'string') continue
        if (!baris[2].includes('garturlres')) continue
        const dalamJadi = JSON.parse(baris[2])
        const url = String(dalamJadi[1] || '')
        if (url && !url.includes('news.google.com')) { hasil.set(id, tanpaAmp(url)); break }
      }
    } catch (galat) {
      console.error(`Jawaban batchexecute tak terurai untuk ${id.slice(0, 20)}: ${galat}`)
    }
  }

  return hasil
}

/** Menjalankan pekerjaan berkelompok, supaya satu jalan tidak berjam-jam. */
async function berombak<T, H>(
  daftar: T[],
  ukuran: number,
  kerja: (butir: T) => Promise<H>,
): Promise<H[]> {
  const hasil: H[] = []
  for (let i = 0; i < daftar.length; i += ukuran) {
    hasil.push(...await Promise.all(daftar.slice(i, i + ukuran).map(kerja)))
    if (i + ukuran < daftar.length) await tidur(JEDA_MS)
  }
  return hasil
}

/* ================================================================== pelayan */

Deno.serve(async (permintaan: Request) => {
  if (permintaan.method === 'OPTIONS') return new Response('ok', { headers: KEPALA })
  if (permintaan.method !== 'POST') return jawab({ ok: false, pesan: 'Hanya menerima POST.' }, 405)

  const mulai = Date.now()

  const tokenDiharapkan = env('SHEET_SYNC_TOKEN')
  if (!tokenDiharapkan) {
    return jawab({ ok: false, pesan: 'Secret SHEET_SYNC_TOKEN belum dipasang pada Edge Function.' }, 500)
  }
  const tokenDikirim = permintaan.headers.get('x-sync-token')
    || new URL(permintaan.url).searchParams.get('token') || ''
  if (tokenDikirim !== tokenDiharapkan) {
    return jawab({ ok: false, pesan: 'Token tidak valid.' }, 401)
  }

  let opsi: Record<string, unknown> = {}
  try { opsi = await permintaan.json() } catch { /* badan kosong diperbolehkan */ }

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const aksi = String(opsi.aksi ?? 'jaring')

  /*
    ---------------------------------------------------------------------------
    KENAPA PEKERJAANNYA DILEPAS KE LATAR
    ---------------------------------------------------------------------------

    Penjadwal memanggil fungsi ini lewat `pg_net`, dan permintaan Google-nya
    juga lewat `pg_net`. Keduanya memakai antrean yang sama, dan antrean itu
    dikerjakan per gelombang: gelombang berikutnya baru mulai setelah gelombang
    sebelumnya selesai seluruhnya.

    Akibatnya, selama fungsi ini menunggu jawaban Google, yang ditunggunya
    berada DI BELAKANG panggilan yang sedang menjalankan dirinya sendiri.
    Terukur 6 September 2026: permintaan yang biasanya dijawab dalam hitungan
    detik baru dijawab 110 detik kemudian — sesudah fungsinya menyerah dan
    pulang dengan tangan kosong. Kemacetan itu tidak meninggalkan satu pun
    galat; yang terlihat cuma "0 butir".

    Menjawab seketika dan bekerja di latar memutus lingkaran itu: panggilan
    penjadwal selesai dalam sepersekian detik, antreannya kosong, dan permintaan
    Google-nya dijawab seperti biasa.

    Hasilnya karena itu TIDAK ada di dalam jawaban ini. Ia dicatat di
    `penjaring_log` — dan memang di situlah tempatnya dibaca, sebab jalan yang
    dijadwalkan tidak punya siapa pun yang membaca jawabannya.
  */
  const latar = opsi.latar !== false && (aksi === 'jaring' || aksi === 'perbaiki')

  const kerjakan = async (): Promise<Response> => {
    if (aksi === 'perbaiki') return await perbaikiAlamat(db, opsi, mulai)
    if (aksi === 'jaring') return await jaring(db, opsi, mulai)
    if (aksi === 'diagnosa') return await diagnosa(db, opsi, mulai)
    return jawab({ ok: false, pesan: `Aksi "${aksi}" tidak dikenal.`, aksi_tersedia: ['jaring', 'perbaiki', 'diagnosa'] }, 400)
  }

  if (latar) {
    const pekerjaan = kerjakan().catch((galat) => {
      const pesan = galat instanceof Error ? (galat.stack || galat.message) : String(galat)
      console.error(pesan)
      return db.from('penjaring_log').insert({
        mode: String(opsi.mode ?? aksi), status: 'Gagal', galat: pesan.slice(0, 2000),
        selesai_at: new Date().toISOString(), durasi_ms: Date.now() - mulai,
      })
    })
    // @ts-ignore EdgeRuntime hanya ada di lingkungan Supabase.
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(pekerjaan)
    return jawab({
      ok: true, versi: VERSI, latar: true, aksi, mode: opsi.mode ?? null,
      pesan: 'Penjaringan berjalan di latar. Hasilnya dicatat di penjaring_log.',
    })
  }

  try {
    return await kerjakan()
  } catch (galat) {
    const pesan = galat instanceof Error ? (galat.stack || galat.message) : String(galat)
    console.error(pesan)
    return jawab({ ok: false, versi: VERSI, pesan, durasi_ms: Date.now() - mulai }, 500)
  }
})

/* ========================================================== aksi: diagnosa */

/**
 * Membandingkan DUA jalan keluar terhadap alamat yang sama.
 *
 * Ada karena satu kegagalan yang mahal bila salah dibaca. Perayap yang seluruh
 * permintaannya ditolak menghasilkan nol baris baru — dan nol baris baru
 * terlihat persis sama dengan hari yang memang tidak ada beritanya. Yang
 * membedakan keduanya hanya angka status, dan angka status itu tidak pernah
 * muncul di mana pun kecuali di sini.
 *
 * Yang dibandingkan langsung-dari-fungsi melawan lewat-basis-data. Pada
 * 6 September 2026 jawabannya 503 dan 200 — dan selisih itulah yang membuat
 * seluruh jalur Google dipindahkan ke basis data. Bila suatu saat keadaannya
 * berbalik, perintah ini yang akan memberitahukannya lebih dulu.
 *
 * Tidak menulis apa pun ke tabel mana pun.
 */
async function diagnosa(
  db: ReturnType<typeof createClient>,
  opsi: Record<string, unknown>,
  mulai: number,
): Promise<Response> {
  const jejak: Jejak = { panggilan: 0, batas: 20, ditolak429: false }
  const langkah: Array<Record<string, unknown>> = []
  const kueri = String(opsi.kueri ?? '(lapas OR rutan) ("napi kabur" OR "melarikan diri")')

  // Jalan pertama: langsung dari fungsi ini.
  try {
    const j = await fetch(alamatRss(kueri), {
      headers: { 'User-Agent': PERAMBAN, 'Accept-Language': 'id-ID,id;q=0.9' },
    })
    const teks = j.ok ? await j.text() : ''
    langkah.push({ jalan: 'langsung dari Edge Function', status: j.status, butir: teks ? uraiRss(teks).length : 0 })
  } catch (galat) {
    langkah.push({ jalan: 'langsung dari Edge Function', galat: String(galat).slice(0, 200) })
  }

  // Pemeriksaan mentah penerusnya sendiri: apa yang sebenarnya dikembalikan
  // kedua RPC itu. Tanpa ini, penerus yang macet dan Google yang menolak
  // menghasilkan jawaban yang sama persis.
  if (opsi.mentah === true) {
    const t = await db.rpc('jaring_minta', {
      p_url: alamatRss(kueri), p_headers: { 'User-Agent': PERAMBAN }, p_metode: 'GET',
    })
    await tidur(6000)
    const b = await db.rpc('jaring_hasil', { p_ids: [Number(t.data)] })
    langkah.push({
      jalan: 'periksa mentah',
      titip: { data: t.data, jenis: typeof t.data, galat: t.error?.message ?? null },
      baca: {
        jumlah: Array.isArray(b.data) ? b.data.length : null,
        status: Array.isArray(b.data) && b.data[0] ? b.data[0].status_code : null,
        panjang: Array.isArray(b.data) && b.data[0] ? String(b.data[0].isi || '').length : null,
        galat: b.error?.message ?? null,
      },
    })
  }

  // Jalan kedua: lewat basis data.
  const lewat = await lewatDb(db, [{ kunci: 'rss', url: alamatRss(kueri) }], jejak)
  const jRss = lewat.get('rss')
  const butir = jRss?.status === 200 ? uraiRss(jRss.isi) : []
  langkah.push({ jalan: 'lewat basis data', status: jRss?.status ?? null, butir: butir.length })

  // Dan penguraian alamatnya, yang hanya masuk akal diuji lewat jalan kedua.
  const id = butir.find((b) => b.gnewsId)?.gnewsId || ''
  let alamatUji: string | null = null
  if (id) {
    alamatUji = (await uraikanBanyak(db, [id], jejak)).get(id) || null
    langkah.push({ jalan: 'penguraian alamat lewat basis data', hasil: alamatUji })
  }

  return jawab({
    ok: true,
    versi: VERSI,
    aksi: 'diagnosa',
    kueri,
    langkah,
    galat_penerus: jejak.galat ?? [],
    kesimpulan: alamatUji
      ? 'Jalur Google sehat lewat basis data.'
      : (butir.length
        ? 'Pencarian berjalan, tetapi alamatnya tidak bisa diuraikan. Periksa langkah terakhir.'
        : 'Google menolak kedua jalan keluar. Mode umpan portal tetap berjalan.'),
    durasi_ms: Date.now() - mulai,
  })
}

/* ============================================================ aksi: jaring */

async function jaring(
  db: ReturnType<typeof createClient>,
  opsi: Record<string, unknown>,
  mulai: number,
): Promise<Response> {
  const mode = String(opsi.mode ?? 'umum')
  if (mode === 'umpan') return await jaringUmpan(db, opsi, mulai)
  const kering = opsi.kering === true
  const batasKueri = Math.min(Number(opsi.batas_kueri) || 8, 40)
  const jejak: Jejak = {
    panggilan: 0,
    batas: Math.min(Number(opsi.batas_panggilan) || 120, 400),
    ditolak429: false,
  }
  const batasUraikan = Math.min(Number(opsi.batas_uraikan) || 40, 200)

  const tolak = { takRelevan: 0, alamat: 0, kembar: 0, usia: 0 }
  let butirTerlihat = 0

  /* -------------------------------------------------- menyusun daftar kueri */

  interface Tugas { kueri: string; asal: string; unit?: string; id?: string }
  const tugas: Tugas[] = []

  if (mode === 'unit') {
    const { data, error } = await db
      .from('penjaring_sasaran')
      .select('id,nama_upt')
      .eq('aktif', true)
      .order('terakhir_diperiksa_at', { ascending: true, nullsFirst: true })
      .limit(batasKueri)
    if (error) throw new Error(`Gagal membaca sasaran: ${error.message}`)
    for (const s of data || []) {
      const kueri = kueriUnit(String(s.nama_upt))
      if (kueri) tugas.push({ kueri, asal: 'unit', unit: String(s.nama_upt), id: String(s.id) })
    }
  } else {
    const { data, error } = await db
      .from('penjaring_kueri')
      .select('id,kode,kueri')
      .eq('aktif', true)
      .eq('mode', mode)
      .order('terakhir_jalan_at', { ascending: true, nullsFirst: true })
      .order('urutan', { ascending: true })
      .limit(batasKueri)
    if (error) throw new Error(`Gagal membaca kueri: ${error.message}`)
    for (const k of data || []) {
      tugas.push({ kueri: String(k.kueri), asal: `${mode}:${k.kode}`, id: String(k.id) })
    }
  }

  if (!tugas.length) {
    await catatJurnal(db, { mode, status: 'Kosong', mulai, jejak, tolak, butirTerlihat, diterima: 0, kueri: 0,
      pesan: `Tidak ada sasaran aktif untuk mode "${mode}".` })
    return jawab({ ok: true, versi: VERSI, mode, pesan: `Tidak ada sasaran aktif untuk mode "${mode}".` })
  }

  /* ------------------------------------------------------------ mengumpulkan */

  interface Calon { butir: Butir; asal: string; unit: string }
  const calon = new Map<string, Calon>()   // kunci: gnewsId

  /* Seluruh kueri dititipkan sekaligus. Menunggunya satu per satu berarti
     membayar waktu tunggu jaringan berkali-kali untuk pekerjaan yang bisa
     berjalan bersamaan. */
  const umpanBalik = await lewatDb(
    db,
    tugas.map((t, i) => ({ kunci: String(i), url: alamatRss(t.kueri) })),
    jejak,
  )

  const galatKueri: Array<{ asal: string; status: number }> = []

  for (let i = 0; i < tugas.length; i++) {
    const t = tugas[i]
    const j = umpanBalik.get(String(i))
    if (!j) { galatKueri.push({ asal: t.asal, status: 0 }); continue }
    if (j.status !== 200) { galatKueri.push({ asal: t.asal, status: j.status }); continue }

    const temuan = uraiRss(j.isi)
    butirTerlihat += temuan.length

    for (const b of temuan.slice(0, BUTIR_PER_KUERI)) {
      const cocok = t.unit ? relevanUntukUnit(b, t.unit) : berjangkar(b)
      if (!cocok) { tolak.takRelevan++; continue }
      if (!b.gnewsId) {
        // Alamat yang memang bukan Google News dipakai apa adanya.
        const langsung = normalkanTautan(b.tautanRss)
        if (!langsung || langsung.includes('news.google.com')) { tolak.alamat++; continue }
        calon.set(langsung, { butir: b, asal: t.asal, unit: t.unit || '' })
        continue
      }
      // Satu artikel muncul di beberapa kueri sekaligus; yang pertama menang.
      if (!calon.has(b.gnewsId)) calon.set(b.gnewsId, { butir: b, asal: t.asal, unit: t.unit || '' })
    }
  }

  /* ------------------------------------------------------- menguraikan alamat */

  /*
    Yang TERBARU diuraikan lebih dulu.

    Jatah penguraian selalu lebih kecil daripada jumlah calon — tiga jalan
    terakhir menemukan 206, 107, dan 299 calon dengan jatah 30. Tanpa urutan,
    yang terpakai adalah calon yang kebetulan muncul lebih awal di umpan, dan
    Google mengurutkan umpannya menurut kecocokan, bukan waktu.

    Akibatnya persis kebalikan dari yang dibutuhkan ruang pimpinan: berita
    empat hari lalu terangkat sementara peristiwa pagi ini menunggu giliran
    berikutnya. Sisanya tidak hilang — ia tetap ada di umpan pada jalan
    berikutnya, dua puluh menit kemudian.
  */
  const idPerlu = [...calon.entries()]
    .filter(([k]) => !k.startsWith('https://'))
    .sort((a, b) => b[1].butir.tanggal.getTime() - a[1].butir.tanggal.getTime())
    .map(([k]) => k)

  // Simpanan lebih dulu. Inilah yang membuat jalan kedua dan seterusnya murah.
  const simpanan = new Map<string, string | null>()
  for (let i = 0; i < idPerlu.length; i += 200) {
    const { data } = await db
      .from('penjaring_alamat')
      .select('gnews_id,url')
      .in('gnews_id', idPerlu.slice(i, i + 200))
    for (const r of data || []) simpanan.set(String(r.gnews_id), r.url ? String(r.url) : null)
  }

  const belumDiketahui = idPerlu.filter((id) => !simpanan.has(id)).slice(0, batasUraikan)
  const baruDiuraikan: Array<{ gnews_id: string; url: string | null }> = []

  const diuraikan = await uraikanBanyak(db, belumDiketahui, jejak)
  for (const id of belumDiketahui) {
    const url = diuraikan.get(id) || ''
    simpanan.set(id, url || null)

    /*
      Kegagalan ikut disimpan — TAPI TIDAK ketika Google sedang menolak.

      Membedakan keduanya menentukan apakah simpanan ini berguna atau justru
      merusak. "Gagal karena artikelnya memang tidak bisa diuraikan" pantas
      diingat: mencobanya lagi besok membayar dua permintaan untuk jawaban yang
      sudah diketahui. "Gagal karena kita sedang ditolak" adalah keadaan
      SEMENTARA, dan menyimpannya sebagai kegagalan berarti artikel itu tidak
      akan pernah dicoba lagi — satu jam penolakan berubah menjadi kehilangan
      permanen.
    */
    if (url || !jejak.ditolak429) baruDiuraikan.push({ gnews_id: id, url: url || null })
  }

  if (baruDiuraikan.length && !kering) {
    await db.from('penjaring_alamat').upsert(baruDiuraikan, { onConflict: 'gnews_id' })
  }

  /* ------------------------------------------------------------- menyaring */

  interface Siap { butir: Butir; asal: string; url: string; kunci: string }
  const siap: Siap[] = []
  const kunciTerkumpul = new Set<string>()

  for (const [kunci, c] of calon) {
    let url: string
    if (kunci.startsWith('https://')) {
      url = kunci
    } else {
      const hasil = simpanan.get(kunci)
      if (hasil === undefined) continue          // belum sempat diuraikan; giliran berikutnya
      if (!hasil) { tolak.alamat++; continue }   // pernah dicoba dan gagal
      url = hasil
    }

    const seragam = normalkanTautan(url)
    if (!seragam || seragam.includes('news.google.com')) { tolak.alamat++; continue }
    if (kunciTerkumpul.has(seragam)) { tolak.kembar++; continue }
    kunciTerkumpul.add(seragam)
    siap.push({ butir: c.butir, asal: c.asal, url, kunci: seragam })
  }

  /* Yang sudah ada di basis data dibuang sebelum dikirim. Bukan demi kebenaran
     — indeks unik sudah menjaganya — melainkan demi jurnal yang jujur: baris
     yang ditolak indeks tidak pernah terhitung sebagai "kembar" di mana pun. */
  const sudahAda = new Set<string>()
  const semuaKunci = siap.map((s) => s.kunci)
  for (let i = 0; i < semuaKunci.length; i += 100) {
    const { data } = await db
      .from('berita')
      .select('link_normalized')
      .in('link_normalized', semuaKunci.slice(i, i + 100))
    for (const r of data || []) sudahAda.add(String(r.link_normalized))
  }

  const ditanam = siap.filter((s) => {
    if (sudahAda.has(s.kunci)) { tolak.kembar++; return false }
    return true
  })

  /* -------------------------------------------------------------- menanam */

  let diterima = 0
  const contoh: Array<Record<string, unknown>> = []

  if (!kering) {
    for (const s of ditanam) {
      const { error } = await db.from('berita').insert(susunPayload(s.butir, s.url, s.asal))
      if (error) {
        // Tabrakan indeks unik adalah kembar, bukan kegagalan.
        if (/duplicate|unik|unique|kembar/i.test(error.message)) { tolak.kembar++; continue }
        console.error(`Gagal menanam ${s.kunci}: ${error.message}`)
        continue
      }
      diterima++
      if (contoh.length < 8) contoh.push({ judul: s.butir.judul, portal: s.butir.portal, asal: s.asal, tautan: s.url })
    }
  } else {
    // Uji kering menghitung yang AKAN ditanam. Melaporkan nol di sini membuat
    // jurnal uji kering tidak bisa dibedakan dari jalan yang tidak menemukan
    // apa-apa — dan itu tepat yang membuat jurnalnya tidak berguna.
    diterima = ditanam.length
    for (const s of ditanam.slice(0, 20)) {
      contoh.push({ judul: s.butir.judul, portal: s.butir.portal, asal: s.asal, tautan: s.url })
    }
  }

  /* ---------------------------------------------------- menandai sudah jalan */

  if (!kering) {
    const saat = new Date().toISOString()
    if (mode === 'unit') {
      const ids = tugas.map((t) => t.id).filter(Boolean) as string[]
      if (ids.length) {
        await db.from('penjaring_sasaran').update({ terakhir_diperiksa_at: saat }).in('id', ids)
      }
    } else {
      for (const t of tugas) {
        if (!t.id) continue
        await db.from('penjaring_kueri')
          .update({ terakhir_jalan_at: saat, terakhir_temuan: diterima })
          .eq('id', t.id)
      }
    }
  }

  /*
    Kueri yang tidak menjawab dicatat dengan ANGKA STATUSNYA, bukan dihitung
    sebagai nol temuan. Keduanya menghasilkan baris jurnal yang mirip, dan
    perbedaannya menentukan tindakan yang berlawanan: "0 temuan" berarti
    kuerinya perlu diperbaiki, "seluruhnya 503" berarti kuerinya baik-baik saja
    dan yang perlu diperbaiki jalan keluarnya.
  */
  const status = galatKueri.length === tugas.length
    ? 'Gagal'
    : (jejak.ditolak429 || galatKueri.length ? 'Sebagian' : 'Berhasil')

  await catatJurnal(db, {
    mode, status, mulai, jejak, tolak, butirTerlihat, diterima,
    kueri: tugas.length, kering,
    pesan: galatKueri.length
      ? `${galatKueri.length} dari ${tugas.length} kueri tidak dijawab Google `
        + `(status: ${[...new Set(galatKueri.map((g) => g.status))].join(', ')}).`
      : '',
    rincian: { contoh, diuraikan_baru: belumDiketahui.length, calon: calon.size, galat_kueri: galatKueri },
  })

  return jawab({
    ok: true,
    versi: VERSI,
    mode,
    kering,
    kueri_diperiksa: tugas.length,
    kueri_gagal: galatKueri,
    butir_terlihat: butirTerlihat,
    calon: calon.size,
    diuraikan_baru: belumDiketahui.length,
    diterima,
    tolak,
    panggilan_jaringan: jejak.panggilan,
    terpotong_429: jejak.ditolak429,
    contoh,
    durasi_ms: Date.now() - mulai,
  })
}

/**
 * Menyusun satu baris `berita`.
 *
 * Nilai klasifikasinya sengaja dibiarkan kosong — "Lainnya", "Tidak diketahui",
 * "Belum Teridentifikasi". Yang menilainya `klasifikasi`, yang membaca seluruh
 * teksnya dan mengenal 531 nama unit beserta sebutan sehari-harinya. Menebak di
 * sini berarti menanam tebakan yang tidak bisa dibedakan dari penilaian
 * sungguhan oleh siapa pun yang membacanya kemudian.
 */
function susunPayload(b: Butir, url: string, asal: string): Record<string, unknown> {
  const saat = new Date().toISOString()
  return {
    source_type: 'penjaring',
    source_external_id: `pj:${b.gnewsId || normalkanTautan(url)}`.slice(0, 200),
    source_record_key: `penjaring:${b.gnewsId || normalkanTautan(url)}`.slice(0, 200),
    source_sheet_id: 'penjaring',
    source_sheet_name: asal,
    source_updated_at: saat,
    last_synced_at: saat,
    sync_status: 'synced',
    nama_upt: UPT_BELUM,
    nama_petugas: 'Penjaring Otomatis',
    created_by: `penjaring:${asal}`,
    link: url,
    judul: b.judul || 'Tanpa judul',
    media: b.portal || hostDari(url) || 'Tidak diketahui',
    platform: kenaliPlatform(url),
    tanggal_publikasi: b.tanggal.toISOString(),
    detected_at: saat,
    kategori: 'Lainnya',
    subkategori: 'Umum',
    sentimen: 'Tidak diketahui',
    urgensi: 'SEDANG',
    tingkat_perhatian: 'SEDANG',
    dampak: 'UPT',
    ringkasan: b.judul,
    raw_analysis: `Ditemukan ${VERSI} (${asal}).`,
    status_baca: 'PENJARINGAN OTOMATIS',
    catatan: 'Nama UPT belum dikenali otomatis dan perlu dipetakan oleh analis.',
    status_verifikasi: 'Belum Ditelaah',
    ai_provider: 'penjaring_rss',
    updated_at: saat,
  }
}

/* ====================================================== mode: umpan portal */

/**
 * Membaca RSS milik portalnya sendiri.
 *
 * Bedanya dengan tiga mode lain ada di satu hal yang menentukan segalanya:
 * alamat di dalam umpan portal SUDAH alamat artikelnya. Tidak ada penguraian,
 * tidak ada tanda tangan, tidak ada Google di tengah jalan — dan karena itu
 * mode ini tetap bekerja pada hari Google menolak peladen ini.
 *
 * Harganya: umpan portal memuat SELURUH beritanya, bukan hasil pencarian. Dua
 * puluh butir terakhir sebuah kantor daerah hampir seluruhnya bukan urusan
 * Pemasyarakatan, dan yang menyaringnya cuma jangkar kata. Itu sebabnya angka
 * "tolak tak relevan" pada mode ini besar sekali dan justru menandakan sehat —
 * jangan pernah membacanya sebagai kegagalan.
 */
async function jaringUmpan(
  db: ReturnType<typeof createClient>,
  opsi: Record<string, unknown>,
  mulai: number,
): Promise<Response> {
  const kering = opsi.kering === true
  const batasUmpan = Math.min(Number(opsi.batas_umpan) || 12, 60)
  const jejak: Jejak = { panggilan: 0, batas: Math.min(Number(opsi.batas_panggilan) || 80, 200), ditolak429: false }
  const tolak = { takRelevan: 0, alamat: 0, kembar: 0, usia: 0 }
  let butirTerlihat = 0

  const { data, error } = await db
    .from('penjaring_umpan')
    .select('id,kode,nama,url')
    .eq('aktif', true)
    .order('terakhir_jalan_at', { ascending: true, nullsFirst: true })
    .order('urutan', { ascending: true })
    .limit(batasUmpan)
  if (error) throw new Error(`Gagal membaca umpan: ${error.message}`)

  const umpan = data || []
  if (!umpan.length) {
    return jawab({ ok: true, versi: VERSI, mode: 'umpan', pesan: 'Tidak ada umpan aktif.' })
  }

  interface Panen { butir: Butir; asal: string; url: string; kunci: string }
  const panen = new Map<string, Panen>()
  const kabar: Array<{ id: string; status: string; pesan: string; temuan: number }> = []

  await berombak(umpan, SERENTAK_UMPAN, async (u) => {
    let status = 'Berhasil'
    let pesan = ''
    let temuan = 0

    try {
      jejak.panggilan++
      const jawaban = await fetch(String(u.url), {
        headers: { 'User-Agent': PERAMBAN, 'Accept-Language': 'id-ID,id;q=0.9' },
      })
      if (!jawaban.ok) {
        kabar.push({ id: String(u.id), status: 'Gagal', pesan: `Portal membalas ${jawaban.status}.`, temuan: 0 })
        return
      }

      const butir = uraiUmpan(await jawaban.text())
      butirTerlihat += butir.length

      for (const b of butir) {
        if (!berjangkar(b)) { tolak.takRelevan++; continue }

        const seragam = normalkanTautan(b.tautanRss)
        if (!seragam || seragam.includes('news.google.com')) { tolak.alamat++; continue }
        if (panen.has(seragam)) { tolak.kembar++; continue }

        panen.set(seragam, {
          butir: { ...b, portal: b.portal || String(u.nama) },
          asal: `umpan:${u.kode}`,
          url: b.tautanRss,
          kunci: seragam,
        })
        temuan++
      }
    } catch (galat) {
      status = 'Gagal'
      pesan = String(galat).slice(0, 300)
    }

    kabar.push({ id: String(u.id), status, pesan, temuan })
  })

  /* Yang sudah ada dibuang sebelum dikirim, supaya jurnalnya jujur. */
  const semua = [...panen.keys()]
  const sudahAda = new Set<string>()
  for (let i = 0; i < semua.length; i += 100) {
    const { data: ada } = await db
      .from('berita').select('link_normalized').in('link_normalized', semua.slice(i, i + 100))
    for (const r of ada || []) sudahAda.add(String(r.link_normalized))
  }

  let diterima = 0
  const contoh: Array<Record<string, unknown>> = []

  for (const [kunci, p] of panen) {
    if (sudahAda.has(kunci)) { tolak.kembar++; continue }
    if (kering) {
      if (contoh.length < 20) contoh.push({ judul: p.butir.judul, portal: p.butir.portal, asal: p.asal, tautan: p.url })
      diterima++
      continue
    }
    const { error: galatTanam } = await db.from('berita').insert(susunPayload(p.butir, p.url, p.asal))
    if (galatTanam) {
      if (/duplicate|unik|unique|kembar/i.test(galatTanam.message)) { tolak.kembar++; continue }
      console.error(`Gagal menanam ${kunci}: ${galatTanam.message}`)
      continue
    }
    diterima++
    if (contoh.length < 10) contoh.push({ judul: p.butir.judul, portal: p.butir.portal, asal: p.asal, tautan: p.url })
  }

  if (!kering) {
    const saat = new Date().toISOString()
    for (const k of kabar) {
      await db.from('penjaring_umpan').update({
        terakhir_jalan_at: saat,
        terakhir_status: k.status,
        terakhir_pesan: k.pesan || null,
        terakhir_temuan: k.temuan,
        gagal_beruntun: k.status === 'Gagal' ? 1 : 0,
      }).eq('id', k.id)
    }
  }

  const gagal = kabar.filter((k) => k.status === 'Gagal')
  await catatJurnal(db, {
    mode: 'umpan',
    status: gagal.length === kabar.length ? 'Gagal' : (gagal.length ? 'Sebagian' : 'Berhasil'),
    mulai, jejak, tolak, butirTerlihat, diterima, kueri: umpan.length, kering,
    pesan: gagal.length ? `${gagal.length} umpan gagal dibaca.` : '',
    rincian: { contoh, gagal: gagal.map((g) => g.pesan) },
  })

  return jawab({
    ok: true,
    versi: VERSI,
    mode: 'umpan',
    kering,
    umpan_diperiksa: umpan.length,
    umpan_gagal: gagal.length,
    butir_terlihat: butirTerlihat,
    calon: panen.size,
    diterima,
    tolak,
    contoh,
    durasi_ms: Date.now() - mulai,
  })
}

/**
 * Mengurai RSS 2.0 atau Atom milik portal.
 *
 * Judulnya TIDAK dipecah pada " - " seperti pada Google News. Judul portal
 * sendiri sering memuat tanda hubung sebagai bagian kalimatnya, dan memecahnya
 * akan memotong judul di tengah lalu menyimpan potongannya sebagai nama media.
 */
function uraiUmpan(xml: string): Butir[] {
  const batasWaktu = Date.now() - UMUR_MAKS_HARI * 24 * 60 * 60 * 1000
  const hasil: Butir[] = []
  const atom = !xml.includes('<item>') && xml.includes('<entry')
  const potongan = (atom ? xml.split(/<entry[\s>]/) : xml.split('<item>')).slice(1)

  for (const kasar of potongan) {
    /*
      Dipotong pada penutupnya.

      Tanpa ini, sebuah butir yang kebetulan tidak menyebutkan <pubDate> akan
      memungut <pubDate> milik butir SESUDAHNYA — dan hasilnya bukan galat,
      melainkan tanggal yang salah sedikit pada sebagian baris. Kekeliruan
      yang tidak pernah menimbulkan pesan apa pun adalah kekeliruan yang
      bertahan paling lama.
    */
    const tutup = kasar.search(atom ? /<\/entry>/ : /<\/item>/)
    const p = tutup > 0 ? kasar.slice(0, tutup) : kasar

    const judul = isiTag(p, 'title')
    let tautan = isiTag(p, 'link')
    if (!tautan && atom) tautan = p.match(/<link[^>]+href="([^"]+)"/i)?.[1] || ''
    if (!judul || !tautan) continue

    const waktuTeks = isiTag(p, 'pubDate') || isiTag(p, 'updated')
      || isiTag(p, 'published') || isiTag(p, 'dc:date')
    // Umpan yang tidak menyebutkan waktunya tidak dibuang; ia dianggap baru.
    // Membuangnya berarti kehilangan seluruh portal hanya karena satu kolom.
    const tanggal = waktuTeks ? new Date(waktuTeks) : new Date()
    const sah = !isNaN(tanggal.getTime())
    if (sah && tanggal.getTime() < batasWaktu) continue

    hasil.push({
      judul,
      portal: isiTag(p, 'source') || '',
      tautanRss: tautan.trim(),
      keterangan: (isiTag(p, 'description') || isiTag(p, 'summary') || '')
        .replace(/<[^>]+>/g, ' ').slice(0, 800),
      tanggal: sah ? tanggal : new Date(),
      gnewsId: '',
    })
  }

  return hasil
}

/* ========================================================== aksi: perbaiki */

/**
 * Menguraikan alamat Google News yang terlanjur tersimpan di tabel `berita`.
 *
 * Dikerjakan bertahap dengan `batas`, bukan sekaligus, karena tiap baris
 * berharga dua permintaan jaringan ke Google dan Google membalas 429 bila
 * diminta terlalu sering.
 *
 * Baris yang alamat barunya ternyata sudah dipakai baris lain TIDAK dipaksakan:
 * indeks unik menolaknya, dan penolakan itu justru jawaban yang benar — kedua
 * baris itu memang satu artikel yang sama. Ia dicatat sebagai `kembar` supaya
 * bisa dirapikan analis, bukan dihapus diam-diam oleh perayap.
 */
async function perbaikiAlamat(
  db: ReturnType<typeof createClient>,
  opsi: Record<string, unknown>,
  mulai: number,
): Promise<Response> {
  const batas = Math.min(Number(opsi.batas) || 40, 200)
  const kering = opsi.kering === true
  const jejak: Jejak = { panggilan: 0, batas: Math.min(Number(opsi.batas_panggilan) || 200, 500), ditolak429: false }

  const { data, error } = await db
    .from('berita')
    .select('id,link,link_normalized,media')
    .like('link_normalized', '%news.google.com%')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(batas)
  if (error) throw new Error(`Gagal membaca berita: ${error.message}`)

  const baris = (data || []).filter((r) => idGnews(String(r.link_normalized || r.link)))
  if (!baris.length) {
    return jawab({ ok: true, versi: VERSI, aksi: 'perbaiki', tersisa: 0, pesan: 'Tidak ada alamat Google News yang tersisa.' })
  }

  const hasil = { diperbaiki: 0, gagal: 0, kembar: 0 }
  const simpananBaru: Array<{ gnews_id: string; url: string | null }> = []
  const contoh: Array<Record<string, unknown>> = []

  /* Simpanan dibaca sekali untuk seluruh baris; sisanya diuraikan sekaligus.
     Menanyakan simpanan baris per baris berarti satu perjalanan ke basis data
     untuk setiap berita — pada 605 baris itu 605 perjalanan yang tidak perlu. */
  const idBaris = new Map<string, string>()
  for (const r of baris) idBaris.set(String(r.id), idGnews(String(r.link_normalized || r.link)))

  const semuaId = [...new Set([...idBaris.values()].filter(Boolean))]
  const simpanan = new Map<string, string | null>()
  for (let i = 0; i < semuaId.length; i += 200) {
    const { data: ada } = await db
      .from('penjaring_alamat').select('gnews_id,url').in('gnews_id', semuaId.slice(i, i + 200))
    for (const s of ada || []) simpanan.set(String(s.gnews_id), s.url ? String(s.url) : null)
  }

  const perluUrai = semuaId.filter((id) => !simpanan.has(id))
  const diuraikan = await uraikanBanyak(db, perluUrai, jejak)
  for (const id of perluUrai) {
    const url = diuraikan.get(id) || ''
    simpanan.set(id, url || null)
    // Kegagalan saat sedang ditolak tidak disimpan — lihat alasannya di jaring().
    if (url || !jejak.ditolak429) simpananBaru.push({ gnews_id: id, url: url || null })
  }

  for (const r of baris) {
    const id = idBaris.get(String(r.id)) || ''
    const url = id ? (simpanan.get(id) || '') : ''

    if (!url) { hasil.gagal++; continue }
    if (kering) {
      hasil.diperbaiki++
      if (contoh.length < 10) contoh.push({ id: r.id, dari: String(r.link_normalized).slice(0, 60), ke: url })
      continue
    }

    const { error: galatTulis } = await db
      .from('berita')
      .update({ link: url, platform: kenaliPlatform(url), media: r.media || hostDari(url) })
      .eq('id', r.id)

    if (galatTulis) {
      if (/duplicate|unik|unique|kembar/i.test(galatTulis.message)) hasil.kembar++
      else hasil.gagal++
      continue
    }
    hasil.diperbaiki++
    if (contoh.length < 10) contoh.push({ id: r.id, ke: url })
  }

  if (simpananBaru.length && !kering) {
    await db.from('penjaring_alamat').upsert(simpananBaru, { onConflict: 'gnews_id' })
  }

  const { count } = await db
    .from('berita')
    .select('id', { count: 'exact', head: true })
    .like('link_normalized', '%news.google.com%')
    .is('deleted_at', null)

  return jawab({
    ok: true,
    versi: VERSI,
    aksi: 'perbaiki',
    kering,
    diproses: baris.length,
    ...hasil,
    tersisa: count ?? null,
    panggilan_jaringan: jejak.panggilan,
    terpotong_429: jejak.ditolak429,
    contoh,
    durasi_ms: Date.now() - mulai,
  })
}

/* ================================================================== jurnal */

async function catatJurnal(
  db: ReturnType<typeof createClient>,
  isi: {
    mode: string; status: string; mulai: number
    jejak: Jejak; tolak: { takRelevan: number; alamat: number; kembar: number; usia: number }
    butirTerlihat: number; diterima: number; kueri: number
    kering?: boolean; pesan?: string; rincian?: unknown
  },
): Promise<void> {
  const { error } = await db.from('penjaring_log').insert({
    mulai_at: new Date(isi.mulai).toISOString(),
    selesai_at: new Date().toISOString(),
    mode: isi.kering ? `${isi.mode} (kering)` : isi.mode,
    status: isi.status,
    kueri_diperiksa: isi.kueri,
    butir_terlihat: isi.butirTerlihat,
    diterima: isi.diterima,
    tolak_tak_relevan: isi.tolak.takRelevan,
    tolak_alamat: isi.tolak.alamat,
    tolak_kembar: isi.tolak.kembar,
    tolak_usia: isi.tolak.usia,
    panggilan_jaringan: isi.jejak.panggilan,
    durasi_ms: Date.now() - isi.mulai,
    pesan: isi.pesan || null,
    rincian: isi.rincian ?? null,
  })
  // Jurnal yang gagal ditulis tidak boleh menggagalkan penjaringannya.
  if (error) console.error(`Gagal menulis jurnal: ${error.message}`)
}
