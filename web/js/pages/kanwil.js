/**
 * Ruang Kantor Wilayah dan Ruang Unit — tiga halaman, satu berkas.
 *
 * Petugas daerah membuka aplikasi yang sama dengan petugas pusat, tetapi tidak
 * boleh melihat satu pun angka nasional. Yang menahannya bukan berkas ini,
 * melainkan policy `can_access_berita` di basis data: baris yang bukan cakupan
 * mereka tidak pernah sampai ke peramban sejak awal. Guna berkas ini hanya dua
 * — menyusun apa yang memang boleh mereka lihat, dan menyatakan batasnya di
 * layar supaya tidak ada yang mengira sedang membaca angka nasional.
 *
 * Karena datanya sudah tersaring di peladen, seluruh halaman di sini bekerja
 * pada `keadaan.berita` yang sama seperti halaman lain. Tidak ada kueri
 * tambahan, dan tidak ada penyaring cakupan yang ditulis ulang di sisi
 * peramban — sebab penyaring di peramban selalu bisa dilewati, dan yang
 * menulisnya cepat atau lambat akan mengira ia yang menjaga data.
 *
 * Ruang unit memakai berkas yang sama dengan ruang wilayah, bukan salinannya.
 * Bentuk layarnya memang sama; yang berbeda hanya seberapa luas cakupannya dan
 * satu kemampuan tambahan — menuliskan tanggapan resmi unit. Dua salinan
 * halaman yang sama pasti berpisah pelan-pelan setiap kali salah satunya
 * disunting.
 */

import { ubin, kartu, keping, kosong, pesanSistem, tombol, bidangCari } from '../ui/komponen.js'
import {
  amankan, angka, persen, jarakWaktu, tanggalJam, tanggalPanjang, ringkas,
  nadaUrgensi, nadaSentimen, nadaStatus, asalTautan,
} from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import {
  ringkasan, menungguTelaahWilayah, sudahDitanggapi, deretEmpatBelasHari,
  TELAAH_WILAYAH, SIKAP_TANGGAPAN,
} from '../lib/hitung.js'
import { ember, EMBER, BELUM } from '../lib/sentimen.js'
import { belumTerpetakan } from '../lib/unit-terpetakan.js'
import { punyaIzin, adalahUnit } from '../lib/peran.js'
import { baganSentimen, baganTren, baganUrgensi } from '../ui/bagan.js'
import { sebaran } from '../lib/demo.js'

/* ------------------------------------------------------------- perkakas */

/** Cakupan yang sedang dibuka, apa adanya dari profil. */
function cakupan(keadaan) {
  const unit = adalahUnit(keadaan.profil?.role)
  return {
    unit,
    nama: unit ? (keadaan.profil?.assigned_upt || null) : (keadaan.profil?.assigned_kanwil || null),
    sebutan: unit ? 'unit' : 'wilayah',
    label: unit ? 'Unit' : 'Wilayah',
  }
}

/**
 * Peringatan yang muncul ketika profil belum ditetapkan cakupannya.
 *
 * Tanpa `assigned_kanwil` — atau `assigned_upt` bagi petugas unit — policy
 * basis data tidak mengembalikan satu baris pun: layarnya kosong, dan tidak ada
 * apa pun yang menjelaskan mengapa. Kalimat ini yang menjelaskannya.
 */
function periksaCakupan(c) {
  if (c.nama) return ''
  return pesanSistem(
    `<b>Akun Anda belum ditetapkan ${c.unit ? 'unit pelaksana teknisnya' : 'kantor wilayahnya'}.</b> `
    + 'Selama itu belum diisi administrator, daftar di bawah akan tetap kosong — bukan karena '
    + 'tidak ada beritanya, melainkan karena basis data belum tahu berita mana yang menjadi '
    + `urusan Anda. Hubungi administrator ${c.unit ? 'kantor wilayah' : 'sistem'} Anda.`,
    'kritis', 'peringatan',
  )
}

/**
 * Kop ruang daerah.
 *
 * Menyebutkan cakupannya dengan huruf besar di kepala layar, bukan sebagai
 * catatan kaki. Angka pada ruang ini setiap hari dibandingkan dengan angka
 * nasional oleh orang yang sama, dan satu tangkapan layar tanpa keterangan
 * cakupan sudah cukup untuk memindahkan angka wilayah ke dalam rapat nasional.
 */
function kop(c, r) {
  const negatifPersen = r.total ? Math.round((r.negatif.length / r.total) * 100) : 0
  return `
    <section class="kop-wilayah">
      <div class="kop-wilayah-teks">
        <span class="label-mono">Ruang ${amankan(c.label)}</span>
        <h2>${amankan(c.nama || `${c.label} belum ditetapkan`)}</h2>
        <p>Seluruh angka pada halaman ini hanya mencakup ${amankan(c.sebutan)} Anda.
        Ia bukan angka nasional, dan tidak memuat ${c.unit ? 'unit' : 'kantor wilayah'} lain.</p>
      </div>
      <dl class="kop-wilayah-angka">
        <div>
          <dt>Berita dihitung</dt>
          <dd class="angka">${angka(r.total)}</dd>
        </div>
        <div>
          <dt>Bersentimen negatif</dt>
          <dd class="angka" data-nada="${r.negatif.length ? 'kritis' : 'netral'}">${negatifPersen}%</dd>
        </div>
        <div>
          <dt>Masuk hari ini</dt>
          <dd class="angka">${angka(r.hariIni.length)}</dd>
        </div>
      </dl>
    </section>`
}

/** Baris rekonsiliasi — penjumlahan ember yang harus selalu kembali ke total. */
function rekonsiliasi(r) {
  return `
    <div class="rekon-baris">
      <span class="rekon-hitung">
        <b class="angka">${angka(r.total)}</b> berita dihitung
        <span class="rekon-sama">=</span>
        ${EMBER.map((e) => `<b class="angka">${angka(r.perEmber[e.kode])}</b> ${amankan(e.label.toLowerCase())}`)
          .join(' <span class="rekon-tambah">+</span> ')}
        ${r.perEmber.belum ? ` <span class="rekon-tambah">+</span> <b class="angka">${angka(r.perEmber.belum)}</b> belum dinilai` : ''}
      </span>
    </div>
    <div class="imbang" style="margin-top:10px" role="img"
      aria-label="Negatif ${angka(r.negatif.length)}, netral ${angka(r.netral.length)}, positif ${angka(r.positif.length)}">
      <span class="neg" style="flex:${r.negatif.length}"></span>
      <span class="net" style="flex:${r.netral.length + r.belumDinilai.length}"></span>
      <span class="pos" style="flex:${r.positif.length}"></span>
    </div>`
}

/** Menggambar bagan sesudah rangkanya terpasang, supaya ukurannya sudah pasti. */
function pasangBagan(berita, r) {
  const wadahTren = document.getElementById('bagan-tren-wilayah')
  if (wadahTren) {
    // Acuannya hari ini, bukan tanggal tetap. Deret empat belas hari yang
    // ditambatkan ke tanggal tertentu berhenti bergerak diam-diam, dan
    // pembacanya menyimpulkan pemberitaan berhenti — bukan bagannya.
    const warna = baganTren(wadahTren, deretEmpatBelasHari(berita))
    const legenda = document.getElementById('legenda-tren-wilayah')
    if (legenda) {
      legenda.innerHTML = `
        <span class="baris gap-6"><i style="width:14px;height:2px;background:${warna.warnaTotal};display:block"></i> Seluruh berita</span>
        <span class="baris gap-6"><i style="width:14px;height:0;border-top:2px dashed ${warna.warnaNegatif};display:block"></i> Bersentimen negatif</span>`
    }
  }

  const wadahSentimen = document.getElementById('bagan-sentimen-wilayah')
  if (wadahSentimen) {
    baganSentimen(wadahSentimen, [
      ...EMBER.map((e) => ({ kode: e.kode, label: e.label, jumlah: r.perEmber[e.kode] })),
      { kode: BELUM.kode, label: BELUM.label, jumlah: r.perEmber.belum },
    ])
  }

  const wadahUrgensi = document.getElementById('bagan-urgensi-wilayah')
  if (wadahUrgensi) baganUrgensi(wadahUrgensi, sebaran(r.inti, 'urgensi'))
}

/* -------------------------------------------------- ringkasan wilayah */

export function halamanKanwilDasbor({ keadaan, isi }) {
  const c = cakupan(keadaan)
  const r = ringkasan(keadaan.berita || [])
  const bolehTelaah = punyaIzin(keadaan.profil?.role, 'telaah_wilayah')

  const ditelaahWilayah = r.inti.filter((b) => !menungguTelaahWilayah(b))
  const milikSendiri = r.inti.filter((b) => b.created_by === keadaan.profil?.username)
  const negatifTanpaTanggapan = r.negatif.filter((b) => !sudahDitanggapi(b))

  isi.innerHTML = `
    <div class="tumpuk">
      ${periksaCakupan(c)}
      ${kop(c, r)}

      <div class="kisi kisi-4">
        ${ubin({
          label: 'Berita wilayah',
          nilai: r.total,
          nada: 'aksen',
          kaki: `${angka(r.hariIni.length)} masuk hari ini`,
        })}
        ${ubin({
          label: 'Perlu respons segera',
          nilai: r.mendesak.length,
          nada: r.mendesak.length ? 'kritis' : 'netral',
          kaki: `${angka(r.kritis.length)} di antaranya kritis`,
        })}
        ${ubin({
          label: 'Menunggu telaah Anda',
          nilai: r.antreanWilayah.length,
          nada: r.antreanWilayah.length ? 'sedang' : 'positif',
          kaki: `${angka(ditelaahWilayah.length)} sudah ditelaah wilayah`,
        })}
        ${ubin({
          label: 'Menunggu telaah pusat',
          nilai: r.antrean.length,
          nada: 'netral',
          kaki: 'belum diputuskan analis pusat',
        })}
      </div>

      ${r.antreanWilayah.length && bolehTelaah ? pesanSistem(
        `<b>${angka(r.antreanWilayah.length)} berita menunggu telaah wilayah.</b> `
        + 'Putusan wilayah dibaca analis pusat sebelum ia memutuskan — antrean yang dibiarkan '
        + 'menumpuk berarti pusat memutuskan tanpa pernah mendengar daerah. '
        + `${tombol({ label: 'Buka antrean', ikon: 'centang', kecil: true, gaya: 'utama', halaman: 'wilayah-telaah' })}`,
        'sedang', 'peringatan') : ''}

      <div class="kisi kisi-utama-samping">
        ${kartu({
          judul: 'Empat belas hari terakhir',
          ket: 'Seluruh berita wilayah dan yang bersentimen negatif',
          aksi: '<div class="legenda" id="legenda-tren-wilayah"></div>',
          isi: '<div id="bagan-tren-wilayah"></div>',
        })}
        ${kartu({
          judul: 'Keseimbangan pemberitaan',
          ket: 'Aturan yang sama dengan dasbor pusat',
          isi: `<div id="bagan-sentimen-wilayah"></div>${rekonsiliasi(r)}`,
        })}
      </div>

      <div class="kisi kisi-utama-samping">
        ${kartu({
          judul: 'Unit yang paling banyak disorot',
          ket: 'Unit pelaksana teknis di wilayah Anda',
          rapat: true,
          isi: tabelUnit(r.inti),
        })}
        ${kartu({
          judul: 'Sebaran urgensi',
          ket: 'Dari berita yang dihitung',
          isi: '<div id="bagan-urgensi-wilayah"></div>',
        })}
      </div>

      ${kartu({
        judul: 'Berita negatif yang belum ditanggapi unit',
        ket: negatifTanpaTanggapan.length
          ? `${angka(negatifTanpaTanggapan.length)} dari ${angka(r.negatif.length)} berita negatif`
          : 'Seluruh berita negatif sudah punya tanggapan unit',
        aksi: tombol({ label: 'Berita wilayah', ikon: 'panahKanan', kecil: true, halaman: 'wilayah-berita' }),
        rapat: true,
        isi: negatifTanpaTanggapan.length
          ? daftarRingkas(negatifTanpaTanggapan.slice(0, 8))
          : kosong('Tidak ada yang menggantung',
              'Setiap berita negatif di wilayah Anda sudah dijawab unit yang bersangkutan.'),
      })}

      ${kartu({
        judul: 'Yang mendesak',
        ket: `${angka(r.mendesak.length)} berita berurgensi tinggi atau kritis`,
        rapat: true,
        isi: r.mendesak.length
          ? daftarRingkas(r.mendesak.slice(0, 8))
          : kosong('Tidak ada yang mendesak',
              'Tidak ada berita berurgensi tinggi atau kritis di wilayah Anda saat ini.'),
      })}

      ${milikSendiri.length ? kartu({
        judul: 'Kiriman Anda sendiri',
        ket: `${angka(milikSendiri.length)} dari ${angka(r.total)} berita wilayah ini Anda yang memasukkan`,
        rapat: true,
        isi: daftarRingkas(milikSendiri.slice(0, 5)),
      }) : ''}
    </div>`

  pasangBagan(keadaan.berita || [], r)

  return {
    judul: 'Ringkasan Wilayah',
    sub: c.nama ? `${c.nama} · ${tanggalPanjang(new Date())}` : tanggalPanjang(new Date()),
  }
}

/* ------------------------------------------------------ ringkasan unit */

export function halamanUptDasbor({ keadaan, isi }) {
  const c = cakupan(keadaan)
  const r = ringkasan(keadaan.berita || [])

  const belumDitanggapi = r.inti.filter((b) => !sudahDitanggapi(b))
  const negatifBelumDitanggapi = r.negatif.filter((b) => !sudahDitanggapi(b))

  isi.innerHTML = `
    <div class="tumpuk">
      ${periksaCakupan(c)}
      ${kop(c, r)}

      <div class="kisi kisi-4">
        ${ubin({
          label: 'Berita unit ini',
          nilai: r.total,
          nada: 'aksen',
          kaki: `${angka(r.hariIni.length)} masuk hari ini`,
        })}
        ${ubin({
          label: 'Perlu respons segera',
          nilai: r.mendesak.length,
          nada: r.mendesak.length ? 'kritis' : 'netral',
          kaki: `${angka(r.kritis.length)} di antaranya kritis`,
        })}
        ${ubin({
          label: 'Menunggu telaah Anda',
          nilai: r.antreanWilayah.length,
          nada: r.antreanWilayah.length ? 'sedang' : 'positif',
          kaki: 'berita yang belum Anda nilai',
        })}
        ${ubin({
          label: 'Belum ditanggapi',
          nilai: negatifBelumDitanggapi.length,
          nada: negatifBelumDitanggapi.length ? 'kritis' : 'positif',
          kaki: `dari ${angka(r.negatif.length)} berita negatif`,
        })}
      </div>

      ${negatifBelumDitanggapi.length ? pesanSistem(
        `<b>${angka(negatifBelumDitanggapi.length)} berita negatif tentang unit ini belum ditanggapi.</b> `
        + 'Tanggapan unit terbaca kantor wilayah dan analis pusat, dan itulah satu-satunya '
        + 'keterangan dari pihak yang benar-benar berada di tempat kejadian. '
        + `${tombol({ label: 'Tulis tanggapan', ikon: 'centang', kecil: true, gaya: 'utama', halaman: 'wilayah-telaah' })}`,
        'kritis', 'peringatan') : ''}

      <div class="kisi kisi-utama-samping">
        ${kartu({
          judul: 'Empat belas hari terakhir',
          ket: 'Seluruh berita unit ini dan yang bersentimen negatif',
          aksi: '<div class="legenda" id="legenda-tren-wilayah"></div>',
          isi: '<div id="bagan-tren-wilayah"></div>',
        })}
        ${kartu({
          judul: 'Keseimbangan pemberitaan',
          ket: 'Aturan yang sama dengan dasbor pusat',
          isi: `<div id="bagan-sentimen-wilayah"></div>${rekonsiliasi(r)}`,
        })}
      </div>

      ${kartu({
        judul: 'Sikap unit yang sudah dinyatakan',
        ket: `${angka(r.ditanggapi.length)} dari ${angka(r.total)} berita sudah ditanggapi`,
        isi: r.ditanggapi.length
          ? sebaranSikap(r.ditanggapi)
          : kosong('Belum ada tanggapan',
              'Belum satu pun berita tentang unit ini yang dinyatakan sikapnya. '
              + 'Tanggapan ditulis dari halaman Telaah & Tanggapan.',
              tombol({ label: 'Telaah & Tanggapan', ikon: 'centang', gaya: 'utama', halaman: 'wilayah-telaah' })),
      })}

      ${kartu({
        judul: 'Yang menunggu tanggapan Anda',
        ket: `${angka(belumDitanggapi.length)} berita belum dinyatakan sikapnya`,
        aksi: tombol({ label: 'Berita unit', ikon: 'panahKanan', kecil: true, halaman: 'wilayah-berita' }),
        rapat: true,
        isi: belumDitanggapi.length
          ? daftarRingkas(belumDitanggapi.slice(0, 10))
          : kosong('Tidak ada yang menggantung',
              'Setiap berita tentang unit ini sudah dinyatakan sikapnya.'),
      })}
    </div>`

  pasangBagan(keadaan.berita || [], r)

  return {
    judul: 'Ringkasan Unit',
    sub: c.nama ? `${c.nama} · ${tanggalPanjang(new Date())}` : tanggalPanjang(new Date()),
  }
}

/** Sebaran sikap unit, sebagai batang bertingkat sederhana. */
function sebaranSikap(daftar) {
  const total = daftar.length
  return `
    <div class="sikap-deret">
      ${SIKAP_TANGGAPAN.map((s) => {
        const jumlah = daftar.filter((b) => b.tanggapan_sikap === s.kode).length
        return `
          <div class="sikap-baris">
            <div class="baris gap-6">
              ${keping(s.kode, s.nada, true)}
              <b class="angka" style="margin-left:auto">${angka(jumlah)}</b>
              <span class="mini-teks samar-teks">${persen(jumlah, total, 0)}</span>
            </div>
            <div class="bar-lacak">
              <div class="bar-isi" data-nada="${s.nada}"
                   style="--lebar:${total ? ((jumlah / total) * 100).toFixed(1) : 0}%"></div>
            </div>
          </div>`
      }).join('')}
    </div>`
}

/* --------------------------------------------------------- tabel unit */

function tabelUnit(berita) {
  const peta = new Map()
  for (const b of berita) {
    if (belumTerpetakan(b.nama_upt)) continue
    const p = peta.get(b.nama_upt) || { nama: b.nama_upt, total: 0, negatif: 0, mendesak: 0, menunggu: 0 }
    p.total += 1
    if (ember(b) === 'negatif') p.negatif += 1
    if (['Tinggi', 'Kritis'].includes(b.urgensi)) p.mendesak += 1
    if (menungguTelaahWilayah(b)) p.menunggu += 1
    peta.set(b.nama_upt, p)
  }

  const daftar = [...peta.values()]
    .sort((a, b) => b.mendesak - a.mendesak || b.negatif - a.negatif || b.total - a.total)
    .slice(0, 10)

  if (!daftar.length) {
    return kosong('Belum ada unit terpetakan',
      'Berita di wilayah Anda belum terhubung ke unit mana pun, atau belum ada berita sama sekali.')
  }

  const puncak = Math.max(...daftar.map((u) => u.total))

  return `
  <div class="tabel-bungkus">
    <table class="tabel">
      <thead><tr>
        <th>Unit</th>
        <th style="width:120px">Sebaran</th>
        <th style="width:62px" class="rata-kanan">Total</th>
        <th style="width:72px" class="rata-kanan">Negatif</th>
        <th style="width:80px" class="rata-kanan">Mendesak</th>
        <th style="width:88px" class="rata-kanan">Menunggu</th>
      </tr></thead>
      <tbody>
        ${daftar.map((u) => `
          <tr>
            <td style="font-weight:550">${amankan(u.nama)}</td>
            <td>
              ${/* Batang perbandingan, bukan angka kedua. Mata membaca panjang
                   jauh lebih cepat daripada membandingkan enam angka sekolom. */''}
              <div class="bar-lacak" title="${angka(u.total)} berita">
                <div class="bar-isi" style="--lebar:${((u.total / puncak) * 100).toFixed(1)}%"></div>
              </div>
            </td>
            <td class="angka rata-kanan">${angka(u.total)}</td>
            <td class="angka rata-kanan">${u.negatif ? `<span style="color:var(--kritis)">${angka(u.negatif)}</span>` : '—'}</td>
            <td class="angka rata-kanan">${u.mendesak ? `<span style="color:var(--tinggi);font-weight:650">${angka(u.mendesak)}</span>` : '—'}</td>
            <td class="angka rata-kanan">${u.menunggu ? angka(u.menunggu) : '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

function daftarRingkas(daftar) {
  return `
  <div class="tabel-bungkus">
    <table class="tabel">
      <thead><tr>
        <th style="width:78px">Urgensi</th>
        <th>Berita</th>
        <th style="width:170px">Unit</th>
        <th style="width:96px">Masuk</th>
      </tr></thead>
      <tbody>
        ${daftar.map((b) => `
          <tr>
            <td>${keping(b.urgensi || '—', nadaUrgensi(b.urgensi))}</td>
            <td>
              <span class="judul-sel">${amankan(ringkas(b.judul || 'Tanpa judul', 110))}</span>
              <span class="mini-teks samar-teks">${amankan(b.subkategori || b.kategori || 'Belum dikelompokkan')}</span>
            </td>
            <td class="kecil">${amankan(belumTerpetakan(b.nama_upt) ? 'Belum terpetakan' : b.nama_upt)}</td>
            <td class="angka kecil">${amankan(jarakWaktu(b.created_at))}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

/* ------------------------------------------------- daftar berita daerah */

const saring = {
  lingkup: 'semua',
  telaah: 'Semua putusan',
  sentimen: 'semua',
  cari: '',
}

/** Benar bila gambar ulang berikutnya harus mengembalikan fokus ke kolom cari. */
let fokusCari = false

/**
 * Berita Wilayah, dan bagi petugas unit: Berita Unit.
 *
 * Menggantikan halaman "Riwayat Kiriman" yang lama. Halaman itu disusun ketika
 * satu-satunya pekerjaan daerah adalah mengirim, sehingga ia menjawab "apa yang
 * sudah saya kirim" — pertanyaan yang tidak berlaku lagi bagi dua peran daerah
 * yang tidak pernah mengirim apa pun. Yang ditanyakan sekarang: apa yang
 * diberitakan tentang kami, dan mana yang belum kami tangani.
 */
export function halamanWilayahBerita({ keadaan, isi }) {
  const c = cakupan(keadaan)
  const username = keadaan.profil?.username
  const bolehKirim = punyaIzin(keadaan.profil?.role, 'buat_berita')
  const bolehTelaah = punyaIzin(keadaan.profil?.role, 'telaah_wilayah')

  const semua = (keadaan.berita || []).filter((b) => !b.deleted_at)

  const dasarDaftar = bolehKirim && saring.lingkup === 'sendiri'
    ? semua.filter((b) => b.created_by === username)
    : semua

  const kata = saring.cari.trim().toLowerCase()
  const daftar = dasarDaftar
    .filter((b) => saring.telaah.startsWith('Semua')
      || (saring.telaah === 'Belum Ditelaah'
        ? menungguTelaahWilayah(b)
        : b.telaah_wilayah_status === saring.telaah))
    .filter((b) => saring.sentimen === 'semua' || ember(b) === saring.sentimen)
    .filter((b) => !kata
      || String(b.judul || '').toLowerCase().includes(kata)
      || String(b.nama_upt || '').toLowerCase().includes(kata)
      || String(b.media || '').toLowerCase().includes(kata))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))

  const menunggu = dasarDaftar.filter(menungguTelaahWilayah)
  const ditelaah = dasarDaftar.filter((b) => b.telaah_wilayah_status && b.telaah_wilayah_status !== 'Belum Ditelaah')
  const ditanggapi = dasarDaftar.filter(sudahDitanggapi)

  isi.innerHTML = `
    <div class="tumpuk">
      ${periksaCakupan(c)}

      <div class="kisi kisi-4">
        ${ubin({
          label: `Seluruh berita ${amankan(c.sebutan)}`,
          nilai: dasarDaftar.length,
          nada: 'aksen',
          kaki: bolehKirim && saring.lingkup === 'sendiri' ? 'kiriman Anda sendiri' : `cakupan ${c.sebutan} Anda`,
        })}
        ${ubin({
          label: 'Menunggu telaah Anda',
          nilai: menunggu.length,
          nada: menunggu.length ? 'sedang' : 'positif',
          kaki: 'belum dinilai daerah',
        })}
        ${ubin({
          label: 'Sudah ditelaah daerah',
          nilai: ditelaah.length,
          nada: 'positif',
          kaki: 'putusannya terbaca pusat',
        })}
        ${ubin({
          label: 'Sudah ditanggapi unit',
          nilai: ditanggapi.length,
          nada: 'netral',
          kaki: 'disertai sikap resmi unit',
        })}
      </div>

      ${kartu({
        rapat: true,
        isi: `
          <div class="bilah-alat">
            ${bolehKirim ? `
              <div class="segmen" data-peran="lingkup">
                <button data-lingkup="semua" aria-pressed="${saring.lingkup === 'semua'}">Seluruh wilayah</button>
                <button data-lingkup="sendiri" aria-pressed="${saring.lingkup === 'sendiri'}">Kiriman saya</button>
              </div>` : ''}

            <select class="pilihan" data-saring="telaah" aria-label="Saring putusan telaah daerah"
                    style="width:auto;min-width:160px">
              ${['Semua putusan', 'Belum Ditelaah', ...TELAAH_WILAYAH.map((t) => t.kode)]
                .map((s) => `<option${s === saring.telaah ? ' selected' : ''}>${s}</option>`).join('')}
            </select>

            <div class="segmen" data-peran="sentimen">
              <button data-sentimen="semua" aria-pressed="${saring.sentimen === 'semua'}">Semua</button>
              ${EMBER.map((e) => `
                <button data-sentimen="${e.kode}" aria-pressed="${saring.sentimen === e.kode}">${amankan(e.label)}</button>`).join('')}
            </div>

            ${bidangCari(saring.cari, 'Cari judul, unit, atau media')}

            <div class="dorong baris gap-6">
              <span class="mini-teks samar-teks">${angka(daftar.length)} dari ${angka(dasarDaftar.length)}</span>
              ${bolehTelaah ? tombol({ label: 'Telaah', ikon: 'centang', kecil: true, halaman: 'wilayah-telaah' }) : ''}
              ${bolehKirim ? tombol({ label: 'Kirim berita', ikon: 'tambah', kecil: true, gaya: 'utama', halaman: 'input' }) : ''}
            </div>
          </div>

          ${daftar.length ? tabelBerita(daftar.slice(0, 80)) : kosong(
            'Tidak ada yang cocok',
            c.nama
              ? 'Tidak ada berita yang cocok dengan saringan ini. Longgarkan saringannya, atau tunggu berita berikutnya masuk.'
              : `${c.label} pada profil Anda belum ditetapkan, sehingga belum ada berita yang bisa ditampilkan.`,
            bolehKirim ? tombol({ label: 'Kirim berita', ikon: 'tambah', gaya: 'utama', halaman: 'input' }) : '',
          )}

          ${daftar.length > 80 ? `<p class="mini-teks samar-teks" style="margin-top:10px">
            Menampilkan 80 teratas dari ${angka(daftar.length)} yang cocok. Persempit saringannya
            untuk melihat sisanya.</p>` : ''}`,
      })}
    </div>`

  /* ------------------------------------------------------------ penyimak */

  for (const s of isi.querySelectorAll('[data-saring="telaah"]')) {
    s.addEventListener('change', (ev) => {
      saring.telaah = ev.target.value
      document.dispatchEvent(new CustomEvent('gambar-ulang'))
    })
  }

  for (const b of isi.querySelectorAll('[data-lingkup]')) {
    b.addEventListener('click', () => {
      saring.lingkup = b.dataset.lingkup
      document.dispatchEvent(new CustomEvent('gambar-ulang'))
    })
  }

  for (const b of isi.querySelectorAll('[data-sentimen]')) {
    b.addEventListener('click', () => {
      saring.sentimen = b.dataset.sentimen
      document.dispatchEvent(new CustomEvent('gambar-ulang'))
    })
  }

  const cari = isi.querySelector('input[data-peran="cari"]')
  if (cari) {
    /*
       Dua hal yang harus dikerjakan bersama, dan yang kalau salah satunya
       hilang membuat kolom ini tidak bisa dipakai:

       Pertama, gambar ulang ditunda sampai pengetikan berhenti sejenak —
       menggambar ulang tiap huruf berarti menyusun ulang tabel delapan puluh
       baris pada tiap ketukan.

       Kedua, fokus dan posisi kursor dikembalikan sesudahnya. Gambar ulang
       membuang seluruh isi layar termasuk kolom isian ini, dan tanpa
       pengembalian itu yang mengetik kehilangan kursornya di tengah kata —
       berkali-kali, sampai ia berhenti memakai kolomnya.
    */
    if (fokusCari) {
      cari.focus({ preventScroll: true })
      const akhir = cari.value.length
      cari.setSelectionRange(akhir, akhir)
      fokusCari = false
    }

    let jeda = null
    cari.addEventListener('input', (ev) => {
      saring.cari = ev.target.value
      clearTimeout(jeda)
      jeda = setTimeout(() => {
        fokusCari = true
        document.dispatchEvent(new CustomEvent('gambar-ulang'))
      }, 280)
    })
  }

  return {
    judul: c.unit ? 'Berita Unit' : 'Berita Wilayah',
    sub: c.nama ? `${c.nama} · ${angka(dasarDaftar.length)} berita tercatat` : `${c.label} belum ditetapkan`,
  }
}

/**
 * Nama lama halaman ini.
 *
 * Petugas yang menyimpan tautan `#kanwil-riwayat` di peramban tidak perlu tahu
 * halamannya berganti nama. Dipertahankan sebagai penerus, bukan sebagai
 * salinan.
 */
export const halamanKanwilRiwayat = halamanWilayahBerita

function tabelBerita(daftar) {
  return `
  <div class="tabel-bungkus">
    <table class="tabel">
      <thead><tr>
        <th>Berita</th>
        <th style="width:150px">Unit</th>
        <th style="width:104px">Sentimen</th>
        <th style="width:132px">Telaah daerah</th>
        <th style="width:116px">Status pusat</th>
        <th style="width:96px">Masuk</th>
      </tr></thead>
      <tbody>
        ${daftar.map((b) => {
          const putusan = b.telaah_wilayah_status && b.telaah_wilayah_status !== 'Belum Ditelaah'
            ? b.telaah_wilayah_status : null
          const nada = TELAAH_WILAYAH.find((t) => t.kode === putusan)?.nada || 'rendah'
          return `
          <tr>
            <td>
              <span class="judul-sel">${amankan(ringkas(b.judul || 'Tanpa judul', 110))}</span>
              <span class="mini-teks samar-teks">
                ${amankan(b.media || asalTautan(b.link || '') || 'Tidak tercatat')}
                ${b.link ? ` · <a href="${amankan(b.link)}" target="_blank" rel="noopener noreferrer">sumber</a>` : ''}
                ${sudahDitanggapi(b) ? ` · <span class="positif-teks">sudah ditanggapi unit</span>` : ''}
              </span>
            </td>
            <td class="kecil">${amankan(belumTerpetakan(b.nama_upt) ? 'Belum terpetakan' : b.nama_upt)}</td>
            <td>${keping(b.sentimen || 'Belum dinilai', nadaSentimen(b.sentimen), true)}</td>
            <td>${keping(putusan || 'Belum ditelaah', nada, true)}</td>
            <td>${keping(b.status_verifikasi || 'Belum Ditelaah', nadaStatus(b.status_verifikasi), true)}</td>
            <td class="angka kecil" title="${amankan(tanggalJam(b.created_at))}">${amankan(jarakWaktu(b.created_at))}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
  </div>`
}
