/**
 * Laporan Berkala.
 *
 * Halaman ini ada supaya laporan tidak lagi bergantung pada siapa pun yang
 * menjalankan perintah di belakang layar. Analis memilih periodenya, menekan
 * satu tombol, lalu berkasnya jadi — lengkap dengan seluruh diagram dan daftar
 * sumbernya, siap dicetak atau disimpan sebagai PDF lewat menu cetak peramban.
 *
 * Laporan disusun di dalam peramban, memakai mesin yang sama dengan yang
 * dipakai layar. Tidak ada penyedia luar yang dipanggil, dan tidak ada langkah
 * yang bisa gagal diam-diam di server.
 */

import { kartu, kosong, tombol, pesanSistem } from '../ui/komponen.js'
import { amankan, angka, tanggalPanjang, hariWib } from '../lib/format.js'
import { panggilFungsi, pesanRamah, ambil, sisip } from '../lib/api.js'
import { roti } from '../ui/komponen.js'
import { susunLaporan, nomorLaporan, olahLaporan } from '../lib/laporan.js'
import { kelompokkanPeristiwa } from '../lib/peristiwa.js'
import { ember } from '../lib/sentimen.js'
import { dasar } from '../lib/hitung.js'
import { ikon } from '../lib/ikon.js'
import { baganUptMuncul } from '../ui/bagan.js'
import { uptNaik, hariBerita } from '../lib/hitung.js'
import { ekspor, eksporXlsx } from '../lib/ekspor.js'
import { punyaIzin } from '../lib/peran.js'
import { muatKeputusan, keputusanSaatIni } from '../lib/keputusan-tindak.js'
import { susunDaftarSip, penjelasanSip } from '../lib/daftar-sip.js'
import { tingkatKumpulan } from '../lib/klasifikasi-informasi.js'
import {
  tandaiProduk, pilihanKlasifikasi, klasifikasiDariTingkat, klasifikasiTertinggi,
  prioritasKumpulan, kodeSebarBoleh, PRIORITAS, KODE_SEBAR, jenisProdukBerkala, JENIS_PRODUK,
} from '../lib/sip.js'
import { KONFIG } from '../lib/konfig.js'

/** Pilihan periode yang bertahan selama sesi. */
const pilihan = { jenis: 'mingguan', mulai: '', selesai: '', hasil: null, sibuk: false }

/**
 * Penandaan SIP yang dipilih pengguna, bertahan selama sesi.
 *
 * `setuju` sengaja TIDAK bertahan: ia dikosongkan setiap kali klasifikasi
 * atau kode penyebarluasan berubah, sebab yang disetujui adalah perlakuan
 * untuk penandaan itu, bukan untuk penandaan apa pun.
 */
const penandaan = { klasifikasi: '', prioritas: '', kodeSebar: 'E', ditujukan: '', setuju: false }

/** Data induk UPT untuk kolom provinsi; dimuat sekali per sesi. */
let indukUpt = null

function siapkanPeriode() {
  if (pilihan.jenis === 'harian') {
    pilihan.mulai = hariWib(0)
    pilihan.selesai = hariWib(0)
  } else if (pilihan.jenis === 'mingguan') {
    pilihan.mulai = hariWib(-6)
    pilihan.selesai = hariWib(0)
  } else {
    pilihan.mulai = hariWib(-29)
    pilihan.selesai = hariWib(0)
  }
}

/**
 * Mengambil bahan mentah dari basis data, lalu menyusun berkasnya di sini.
 * Sengaja dua langkah terpisah: yang pertama boleh gagal karena jaringan,
 * yang kedua tidak boleh gagal sama sekali.
 */
async function buat(isi, keadaan) {
  pilihan.sibuk = true
  gambarUlang()

  try {
    /*
       Mode peragaan menyusun bahan mentahnya dari arsip yang sudah ada di
       layar. Tanpa cabang ini halaman ini adalah satu-satunya yang tidak bisa
       menunjukkan hasilnya tanpa akun sungguhan — dan hasilnya justru bagian
       yang paling perlu diperiksa mata sebelum dikirim ke pimpinan.

       Cabangnya berhenti di sini. Yang di bawah — pengolahan dan penyusunan
       berkasnya — dijalani kedua mode dengan kode yang sama persis; kalau
       tidak, laporan yang diperiksa di peragaan bukan laporan yang terbit.
    */
    let data
    if (keadaan?.demo) {
      const { snapshotDemo } = await import('../lib/demo.js')
      data = snapshotDemo(keadaan.berita || [], {
        mulai: pilihan.mulai, selesai: pilihan.selesai,
      })
    } else {
      const snapshot = await panggilFungsi('snapshot_negatif', {
        p_mulai: pilihan.mulai,
        p_selesai: pilihan.selesai,
      })
      data = Array.isArray(snapshot) ? snapshot[0] : snapshot
    }

    if (!data) throw new Error('Basis data tidak mengembalikan apa pun.')

    const olahan = olahLaporan(data)
    // Isi laporan bisa menuntut klasifikasi lebih tinggi dari perkiraan di
    // layar (basis data memuat berita yang belum termuat di layar); lantainya
    // dihitung ulang dari bahan yang sungguh dipakai.
    const sip = penandaanSaatIni(keadaan, data.publikasi || [])
    const nomor = nomorLaporan(pilihan.jenis, 1, pilihan.selesai)
    const html = susunLaporan(data, { jenis: pilihan.jenis, urutan: 1, nomor, sip })

    pilihan.hasil = { html, olahan, sip, nomor, dibuat: new Date().toISOString() }
    roti(`Laporan tersusun: ${angka(olahan.peristiwa.length)} peristiwa dari ${angka(olahan.publikasi.length)} publikasi.`, 'positif', 4000)
  } catch (galat) {
    pilihan.hasil = null
    roti(pesanRamah(galat), 'kritis', 6000)
    console.error(galat)
  } finally {
    pilihan.sibuk = false
    gambarUlang()
  }
}

function unduh(keadaan) {
  if (!pilihan.hasil) return
  if (!penandaan.setuju) {
    roti('Centang pernyataan perlakuan pada kartu Penandaan produk intelijen lebih dulu.', 'sedang', 5000)
    return
  }
  catatRegister(keadaan, {
    nomor: pilihan.hasil.nomor,
    jenis: jenisProdukBerkala(pilihan.jenis),
    bentuk: 'html',
    sip: pilihan.hasil.sip,
    jumlah: pilihan.hasil.olahan.publikasi.length,
  })
  const nama = `laporan-negatif-${pilihan.jenis}-${pilihan.mulai}-sd-${pilihan.selesai}.html`
  const berkas = new Blob([pilihan.hasil.html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(berkas)
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  a.click()
  // Alamat sementara dilepas setelah unduhan berjalan, supaya memori tidak
  // menahan berkas yang sudah tidak dipakai.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  roti(`Berkas ${nama} diunduh.`, 'positif')
}

/**
 * Pilihan cepat periode. "Kemarin" ada karena laporan harian Telegram terbit
 * pukul 05.30 untuk HARI SEBELUMNYA; analis yang ingin berkas yang sama persis
 * dengan yang dibaca pimpinan pagi tadi harus bisa memilihnya dengan satu tekan.
 */
const PRATAKIR = {
  hariini: { jenis: 'harian', mulai: () => hariWib(0), selesai: () => hariWib(0) },
  kemarin: { jenis: 'harian', mulai: () => hariWib(-1), selesai: () => hariWib(-1) },
  tujuh: { jenis: 'mingguan', mulai: () => hariWib(-6), selesai: () => hariWib(0) },
  tigapuluh: { jenis: 'bulanan', mulai: () => hariWib(-29), selesai: () => hariWib(0) },
}

/**
 * Berita pada periode yang dipilih, dari arsip yang sudah termuat di layar.
 *
 * Hari ditentukan `hariBerita()` — hari kalender Jakarta menurut waktu TANGKAP —
 * sama persis dengan laporan Telegram dan Laporan Berkala. Memotong menurut
 * tanggal terbit membuat berita yang terbit pekan lalu tetapi baru tertangkap
 * tadi malam tidak pernah muncul di berkas mana pun.
 */
function beritaPeriode(keadaan, { hanyaNegatif }) {
  const inti = dasar(keadaan.dalamLingkup || keadaan.berita || [])
  return inti.filter((b) => {
    const h = hariBerita(b)
    if (!h || h < pilihan.mulai || h > pilihan.selesai) return false
    return hanyaNegatif ? ember(b) === 'negatif' : true
  })
}

/** Hari tertua yang termuat; arsip yang terpotong tidak boleh diam-diam dianggap lengkap. */
function hariTertuaTermuat(keadaan) {
  let tertua = null
  for (const b of keadaan.berita || []) {
    const h = hariBerita(b)
    if (h && (!tertua || h < tertua)) tertua = h
  }
  return tertua
}

/**
 * Penandaan SIP yang berlaku sekarang: pilihan pengguna, dinaikkan ke lantai
 * yang dituntut isinya. `tambahan` adalah bahan lain yang ikut menentukan
 * lantai (publikasi dari snapshot laporan).
 */
function penandaanSaatIni(keadaan, tambahan = []) {
  const isi = [...beritaPeriode(keadaan, { hanyaNegatif: false }), ...tambahan]
  const minimum = klasifikasiDariTingkat(tingkatKumpulan(isi))
  return tandaiProduk({
    minimum,
    prioritasMesin: prioritasKumpulan(isi),
    pilihan: {
      klasifikasi: penandaan.klasifikasi ? klasifikasiTertinggi(penandaan.klasifikasi, minimum) : minimum,
      prioritas: penandaan.prioritas || undefined,
      kodeSebar: penandaan.kodeSebar,
      ditujukan: penandaan.ditujukan,
    },
  })
}

/**
 * Register produk (SIP 2023 Lampiran III, Lembar Pengarsipan).
 *
 * Setiap berkas yang keluar dicatat di audit_log: nomor, jenis, klasifikasi,
 * kode penyebarluasan, dan siapa. Nomor asli berkas edaran — yang di dalam
 * berkasnya sendiri sudah dikaburkan menjadi "-" — hanya tersimpan di sini.
 * Kegagalan mencatat tidak menahan unduhan, tetapi dikatakan.
 */
async function catatRegister(keadaan, { nomor, jenis, bentuk, sip, jumlah }) {
  if (keadaan?.demo || KONFIG.mode === 'demo' || !keadaan?.profil?.username) return
  try {
    await sisip('audit_log', {
      actor_username: keadaan.profil.username,
      actor_role: keadaan.profil.role,
      action: 'produk_ekspor',
      entity: 'produk_intelijen',
      entity_id: nomor,
      metadata: {
        jenis, bentuk, jumlah,
        klasifikasi: sip.klasifikasi, prioritas: sip.prioritas,
        kode_sebar: sip.kodeSebar, ditujukan: sip.ditujukan || null,
        edaran: sip.edaran, periode: [pilihan.mulai, pilihan.selesai],
      },
    }, { kembalikan: 'minimal' })
  } catch (galat) {
    console.warn('Register produk gagal dicatat', galat)
    roti('Berkas diunduh, tetapi register produk gagal dicatat. Catat nomornya secara manual.', 'sedang', 6000)
  }
}

async function muatIndukUpt() {
  if (indukUpt) return indukUpt
  try {
    indukUpt = await ambil('upt', { select: 'nama_upt,kanwil,provinsi', limit: 1000 }) || []
  } catch {
    indukUpt = []
  }
  return indukUpt
}

/**
 * Mengunduh daftar berita periode ini.
 *
 * Bentuk utamanya buku kerja Excel (.xlsx), dengan dua lembar: Daftar dan
 * Keterangan. CSV tetap tersedia untuk olah data, berisi kolom yang sama.
 * Keduanya lewat pemeriksaan hak yang sama di lib/ekspor.js, dan keduanya
 * ditandai menurut SIP 2023. Kolom rekomendasi ikut bagi peran yang berhak
 * melihat saran tindak lanjut.
 */
async function unduhDaftar(keadaan, { hanyaNegatif, bentuk = 'xlsx' }) {
  const baris = beritaPeriode(keadaan, { hanyaNegatif })
  if (!baris.length) {
    roti('Tidak ada berita pada periode ini di arsip yang termuat.', 'sedang', 4000)
    return
  }
  if (!penandaan.setuju) {
    roti('Centang pernyataan perlakuan pada kartu Penandaan produk intelijen lebih dulu.', 'sedang', 5000)
    return
  }

  const dengan = punyaIzin(keadaan.profil?.role, 'lihat_saran_tindak')
  if (dengan) await muatKeputusan()
  const upt = keadaan.demo ? [] : await muatIndukUpt()

  const sip = penandaanSaatIni(keadaan)
  const daftar = susunDaftarSip(baris, {
    keputusan: dengan ? keputusanSaatIni() : new Map(),
    upt,
    denganSaran: dengan,
    edaran: sip.edaran,
  })

  const rentang = pilihan.mulai === pilihan.selesai ? pilihan.mulai : `${pilihan.mulai} s.d. ${pilihan.selesai}`
  const bahan = {
    judul: `Daftar berita ${hanyaNegatif ? 'negatif ' : ''}${pilihan.jenis} ${rentang}`,
    kolom: daftar.kolom,
    baris: daftar.baris,
    profil: keadaan.profil,
    tingkat: tingkatKumpulan(baris),
    sip,
    jenisProduk: JENIS_PRODUK.informasi,
    kueri: `periode ${rentang} (hari kalender Jakarta menurut waktu tangkap); `
      + `${hanyaNegatif ? 'hanya sentimen negatif' : 'seluruh sentimen'}; urut negatif dan prioritas lebih dulu`,
  }
  const hasil = bentuk === 'csv'
    ? ekspor({ ...bahan, bentuk: 'csv' })
    : await eksporXlsx({ ...bahan, penjelasan: penjelasanSip() })

  if (hasil.berhasil) {
    catatRegister(keadaan, {
      nomor: hasil.keterangan.nomor, jenis: JENIS_PRODUK.informasi, bentuk, sip, jumlah: baris.length,
    })
  }
  roti(hasil.berhasil
    ? `Berkas diunduh: ${angka(baris.length)} berita, ${sip.klasifikasi} · kode sebar ${sip.kodeSebar}.`
    : hasil.alasan, hasil.berhasil ? 'positif' : 'sedang', 5000)
}

/** Kartu penandaan SIP: klasifikasi, prioritas, kode sebar, tujuan, pernyataan. */
function kartuPenandaan(keadaan) {
  const sip = penandaanSaatIni(keadaan)
  const isi = beritaPeriode(keadaan, { hanyaNegatif: false })
  const minimum = klasifikasiDariTingkat(tingkatKumpulan(isi))
  const negatifBelum = isi.filter((b) => ember(b) === 'negatif' && b.status_verifikasi !== 'Terverifikasi').length

  const opsiKlas = pilihanKlasifikasi(minimum).map((k) =>
    `<option value="${k.kode}" ${k.kode === sip.klasifikasi ? 'selected' : ''}>${k.kode} — ${amankan(k.label)}</option>`).join('')
  const opsiPrio = PRIORITAS.slice().reverse().map((p) =>
    `<option value="${p.kode}" ${p.kode === sip.prioritas ? 'selected' : ''}>${amankan(p.label)} (${p.kode}) — ${amankan(p.batas)}</option>`).join('')
  const boleh = kodeSebarBoleh(sip.klasifikasi)
  const opsiSebar = KODE_SEBAR.filter((k) => boleh.includes(k.kode)).map((k) =>
    `<option value="${k.kode}" ${k.kode === sip.kodeSebar ? 'selected' : ''}>${k.kode} — ${amankan(k.label)}</option>`).join('')

  return kartu({
    judul: 'Penandaan produk intelijen (SIP 2023)',
    ket: 'Berlaku untuk laporan HTML dan daftar berita yang diunduh dari halaman ini. '
      + 'Mengikuti blok Klasifikasi & Prioritas formulir Lampiran I Kepdirjenpas PAS-17.OT.02.02 Tahun 2023.',
    isi: `
      <div class="sip-kisi">
        <div>
          <label class="label-mono" for="sip-klasifikasi">Klasifikasi keamanan</label>
          <select class="masukan" id="sip-klasifikasi" data-sip="klasifikasi">${opsiKlas}</select>
          <div class="mini-teks samar-teks">${amankan(sip.akses)}</div>
        </div>
        <div>
          <label class="label-mono" for="sip-prioritas">Prioritas</label>
          <select class="masukan" id="sip-prioritas" data-sip="prioritas">${opsiPrio}</select>
        </div>
        <div>
          <label class="label-mono" for="sip-sebar">Kode penyebarluasan</label>
          <select class="masukan" id="sip-sebar" data-sip="kodeSebar">${opsiSebar}</select>
        </div>
        <div>
          <label class="label-mono" for="sip-tujuan">Ditujukan kepada Yth.</label>
          <input class="masukan" id="sip-tujuan" data-sip="ditujukan" maxlength="160"
            placeholder="mis. Direktur Kamtib" value="${amankan(penandaan.ditujukan)}">
        </div>
      </div>

      <div class="mini-teks samar-teks" style="margin-top:8px">
        Paling rendah <b>${minimum}</b> untuk periode ini${minimum !== 'YPM'
          ? `, karena memuat ${angka(negatifBelum)} berita negatif yang belum ditelaah atau berurgensi tinggi` : ''}.
        Klasifikasi boleh dinaikkan, tidak bisa diturunkan. SR dan R, serta prioritas Mendesak,
        tidak pernah dipilih mesin.
      </div>
      ${sip.koreksi.length ? `<div style="margin-top:8px">${pesanSistem(sip.koreksi.map(amankan).join('<br>'), 'sedang', 'info')}</div>` : ''}
      ${sip.edaran ? `<div style="margin-top:8px">${pesanSistem(
        '<b>Versi edaran.</b> Kode ini membawa berkas ke luar pimpinan Pemasyarakatan, jadi nama pengunduh, '
        + 'nomor berkas, catatan analis, NIP, dan nomor telepon dikaburkan otomatis (Lampiran VI). Judul '
        + 'berita dan nama UPT tidak dikaburkan karena sudah terbit di media terbuka; samarkan sendiri bila perlu.',
        'aksen', 'info')}</div>` : ''}

      <label class="sip-setuju">
        <input type="checkbox" data-sip="setuju" ${penandaan.setuju ? 'checked' : ''}>
        <span>Saya memahami berkas ini berklasifikasi <b>${sip.klasifikasi} (${amankan(sip.klasifikasiLabel)})</b>,
        hanya akan saya teruskan sesuai kode penyebarluasan <b>${sip.kodeSebar}</b>, dan akan mengaburkan
        identitas orang, nama instansi, serta nomor dokumen internal yang tersisa sebelum meneruskannya,
        sesuai Standar Intelijen Pemasyarakatan 2023.</span>
      </label>`,
  })
}

function bukaTab() {
  if (!pilihan.hasil) return
  const jendela = window.open('', '_blank')
  if (!jendela) { roti('Peramban menahan jendela baru. Izinkan pop-up untuk halaman ini.', 'sedang', 5000); return }
  jendela.document.write(pilihan.hasil.html)
  jendela.document.close()
}

function gambarUlang() {
  document.dispatchEvent(new CustomEvent('gambar-ulang'))
}

/* ------------------------------------------------------------------ halaman */

export function halamanLaporan({ keadaan, isi }) {
  if (!pilihan.mulai) siapkanPeriode()

  const jenisTombol = [
    ['harian', 'Harian'],
    ['mingguan', 'Mingguan'],
    ['bulanan', 'Bulanan'],
  ].map(([k, l]) => `<button data-jenis="${k}" aria-pressed="${pilihan.jenis === k}">${l}</button>`).join('')

  // Pratinjau angka dari data yang sudah ada di layar, supaya analis tahu
  // kira-kira apa yang akan keluar sebelum menekan tombolnya.
  // Hari dipotong menurut waktu TANGKAP, seperti snapshot_negatif di basis
  // data. Sampai 3 November 2026 pratinjau ini memotong menurut tanggal terbit
  // (dan tanggal UTC, bukan WIB), sehingga angkanya tidak pernah persis sama
  // dengan laporan yang kemudian tersusun.
  // Sama persis dengan aturan dasbor dan kanal: yang bersentimen campuran
  // memuat kedua sisi sekaligus dan bukan berita yang merugikan institusi.
  const negatifLokal = beritaPeriode(keadaan, { hanyaNegatif: true })
  const kiraPeristiwa = kelompokkanPeristiwa(negatifLokal).length

  const hasil = pilihan.hasil

  isi.innerHTML = `
    <div class="tumpuk">
      ${pesanSistem(
        `<b>Laporan ini hanya memuat pemberitaan negatif.</b> Publikasi positif dihitung sebagai
         konteks pada bagian ikhtisar, tetapi tidak dirinci — laporan berkala Ditpamintel adalah
         daftar hal yang menuntut tindakan, bukan rapor kehumasan.`,
        'aksen', 'info')}

      ${kartu({
        judul: 'Susun laporan berkala',
        ket: 'Berkas dibuat di browser Anda sendiri. Tidak ada data yang dikirim ke pihak ketiga.',
        isi: `
          <div class="baris gap-12" style="flex-wrap:wrap;align-items:flex-end">
            <div>
              <div class="label-mono" style="margin-bottom:5px">Jenis laporan</div>
              <div class="segmen" data-peran="jenis">${jenisTombol}</div>
            </div>
            ${/* Keterangan di atas kotaknya adalah <label for>, bukan sekadar teks
                  yang kebetulan berada di dekatnya. Tanpa itu pembaca layar
                  menyebut kedua kotak ini "tanggal, edit" — dua kali, tanpa
                  satu pun petunjuk mana yang awal dan mana yang akhir. */''}
            <div>
              <label class="label-mono" for="laporan-mulai" style="display:block;margin-bottom:5px">Mulai</label>
              <input class="masukan" type="date" id="laporan-mulai" data-peran="mulai" value="${amankan(pilihan.mulai)}" style="width:150px">
            </div>
            <div>
              <label class="label-mono" for="laporan-selesai" style="display:block;margin-bottom:5px">Sampai</label>
              <input class="masukan" type="date" id="laporan-selesai" data-peran="selesai" value="${amankan(pilihan.selesai)}" style="width:150px">
            </div>
            <div class="dorong">
              ${tombol({
                label: pilihan.sibuk ? 'Menyusun…' : 'Susun laporan',
                ikon: 'laporan', gaya: 'utama', aksi: 'susun-laporan', nonaktif: pilihan.sibuk,
              })}
            </div>
          </div>

          <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line-3)">
            <div class="mini-teks samar-teks">Perkiraan dari data yang sudah dimuat di layar ini</div>
            <div class="baris gap-16" style="margin-top:6px;flex-wrap:wrap">
              <span>Publikasi negatif <b class="angka">${angka(negatifLokal.length)}</b></span>
              <span>Peristiwa <b class="angka">${angka(kiraPeristiwa)}</b></span>
              <span>Periode <b>${amankan(tanggalPanjang(pilihan.mulai))} — ${amankan(tanggalPanjang(pilihan.selesai))}</b></span>
            </div>
            <div class="mini-teks samar-teks" style="margin-top:5px">
              Angka pada berkas laporan dihitung ulang langsung dari basis data, sehingga bisa
              berbeda sedikit dari perkiraan di atas bila ada berita baru masuk.
            </div>
          </div>`,
      })}

      ${kartuPenandaan(keadaan)}

      ${punyaIzin(keadaan.profil?.role, 'unduh_laporan') ? kartu({
        judul: 'Ekspor daftar berita',
        ket: 'Buku kerja Excel berisi berita pada periode di atas, berurut negatif dan prioritas lebih dulu. '
          + 'Berbeda dari laporan di atas: ini DAFTAR berita, bukan ringkasan.',
        isi: (() => {
          const semuaP = beritaPeriode(keadaan, { hanyaNegatif: false })
          const negatifP = beritaPeriode(keadaan, { hanyaNegatif: true })
          const tertua = hariTertuaTermuat(keadaan)
          const terpotong = tertua && tertua > pilihan.mulai
          const pratakir = [['hariini', 'Hari ini'], ['kemarin', 'Kemarin'], ['tujuh', '7 hari terakhir'], ['tigapuluh', '30 hari terakhir']]
            .map(([k, l]) => `<button class="tbl kecil" data-pratakir="${k}">${l}</button>`).join('')
          return `
            <div class="label-mono" style="margin-bottom:6px">Pilih cepat</div>
            <div class="baris gap-6" style="flex-wrap:wrap">${pratakir}</div>

            <div class="baris gap-16" style="margin-top:12px;flex-wrap:wrap">
              <span>Periode <b>${amankan(tanggalPanjang(pilihan.mulai))} — ${amankan(tanggalPanjang(pilihan.selesai))}</b></span>
              <span>Seluruh berita <b class="angka">${angka(semuaP.length)}</b></span>
              <span>Negatif <b class="angka">${angka(negatifP.length)}</b></span>
            </div>

            ${terpotong ? `<div style="margin-top:10px">${pesanSistem(
              `<b>Arsip yang termuat di layar hanya sampai ${amankan(tanggalPanjang(tertua))}.</b>
               Berita sebelum tanggal itu tidak ikut terunduh. Pilih periode yang lebih pendek,
               atau susun laporan di atas, yang membaca langsung dari basis data.`,
              'sedang', 'peringatan')}</div>` : ''}

            <div class="baris gap-6" style="margin-top:12px;flex-wrap:wrap">
              ${tombol({ label: 'Unduh Excel — seluruh berita', ikon: 'unduh', gaya: 'utama', aksi: 'unduh-daftar-semua', nonaktif: !semuaP.length || !penandaan.setuju })}
              ${tombol({ label: 'Unduh Excel — negatif saja', ikon: 'unduh', aksi: 'unduh-daftar-negatif', nonaktif: !negatifP.length || !penandaan.setuju })}
              ${tombol({ label: 'CSV untuk olah data', ikon: 'unduh', gaya: 'samar', aksi: 'unduh-daftar-csv', nonaktif: !semuaP.length || !penandaan.setuju })}
            </div>
            ${!penandaan.setuju ? `<div class="mini-teks samar-teks" style="margin-top:6px">
              Tombol unduh aktif setelah pernyataan pada kartu Penandaan produk intelijen dicentang.</div>` : ''}
            <div class="mini-teks samar-teks" style="margin-top:8px">
              Satu hari adalah pukul 00.00 sampai 23.59 WIB menurut waktu berita ditangkap, sama
              dengan laporan Telegram. Buku kerja berisi lembar <b>Daftar</b> dan lembar
              <b>Keterangan</b> (penandaan SIP dan arti setiap kode). CSV memakai pemisah koma;
              di Excel berbahasa Indonesia bukalah lewat Data › Dari Teks/CSV, atau pakai berkas Excel.
            </div>`
        })(),
      }) : ''}

      ${kartu({
        judul: 'UPT yang naik ke permukaan',
        ket: 'Dihitung dari arsip yang sudah ada di layar, sebagai pratinjau sebelum laporan '
          + 'disusun. Angka pada berkas laporannya dihitung ulang langsung dari basis data.',
        isi: '<div id="laporan-upt"></div>',
      })}

      ${hasil ? kartu({
        judul: 'Laporan siap',
        ket: `${angka(hasil.olahan.peristiwa.length)} peristiwa · ${angka(hasil.olahan.publikasi.length)} publikasi · ${angka(hasil.olahan.daftarUnit.length)} UPT terdampak`,
        /*
           Tiga tombol, dan yang ketiga baru ada sejak 4 September 2026.

           Sebelumnya laporan yang sudah tersusun hanya bisa dibuka dan diunduh.
           Tidak ada satu pun jalan dari sini menuju Distribusi Telegram —
           padahal mengirimkannya kepada pimpinan adalah alasan laporan itu
           disusun, dan analis yang baru menyusunnya adalah satu-satunya peran
           yang memegang izin `kirim_telegram`. Jalannya ada, dan ia harus
           menemukannya sendiri lewat menu, sesudah menebak bahwa halaman
           bernama "Distribusi Telegram" ada hubungannya dengan berkas yang
           barusan ia buat.

           Tombol ini membuka halaman pengiriman, bukan mengirim. Itu bukan
           kekurangan yang belum sempat diperbaiki, melainkan aturan pertama
           halaman tujuannya: tidak ada pengiriman tanpa pratinjau. Labelnya
           dijaga agar tidak menjanjikan lebih dari itu.

           Periodenya sengaja tidak dititipkan. Halaman ini menerima tanggal
           mulai dan selesai yang bebas; halaman tujuan hanya mengenal harian,
           mingguan, dan bulanan. Memetakan yang pertama ke yang kedua berarti
           mengirim rentang yang BUKAN rentang yang barusan disusun, tanpa
           seorang pun menyadari selisihnya.
        */
        aksi: `${tombol({ label: 'Buka', ikon: 'tautan', aksi: 'buka-laporan' })}
               ${tombol({ label: 'Unduh HTML', ikon: 'unduh', aksi: 'unduh-laporan', nonaktif: !penandaan.setuju })}
               ${tombol({
                 label: 'Kirim lewat Telegram',
                 ikon: 'kirim',
                 gaya: 'utama',
                 halaman: 'distribusi',
                 judul: 'Membuka Distribusi Telegram, tempat pesan disusun dan dipratinjau sebelum dikirim',
               })}`,
        isi: `
          <p class="kecil-teks">
            Berkas dapat dibuka di peramban mana pun tanpa sambungan internet, dan dicetak menjadi
            PDF lewat menu <b>Cetak</b> peramban. Seluruh diagram di dalamnya adalah gambar vektor,
            sehingga tetap tajam saat dicetak.
          </p>
          <div class="pratinjau">
            <iframe title="Pratinjau laporan" style="width:100%;height:520px;border:1px solid var(--line-2);border-radius:var(--r-2);background:#fff"></iframe>
          </div>`,
      }) : kartu({
        judul: 'Belum ada laporan tersusun',
        isi: kosong(
          'Pilih periode, lalu tekan Susun laporan',
          'Berkas akan berisi ikhtisar, isu prioritas, peringkat eksposur, rekap harian, sebaran wilayah, rekomendasi tindak lanjut, dan daftar seluruh sumber pemberitaan lengkap dengan tautannya.',
        ),
      })}
    </div>`

  // Pratinjau diisi lewat srcdoc setelah HTML terpasang; menaruhnya langsung
  // di dalam templat akan membuat tanda kutipnya bertabrakan.
  if (hasil) {
    const bingkai = isi.querySelector('iframe')
    if (bingkai) bingkai.srcdoc = hasil.html
  }

  /*
     Bagan pratinjau digambar dari arsip yang sudah ada di layar, bukan dari
     hasil susunan laporan.

     Sengaja: ia harus sudah terbaca SEBELUM tombol susun ditekan. Analis yang
     memilih periode berhak melihat unit mana yang akan mengisi laporannya
     sebelum menunggu penyusunannya selesai — dan bila hasilnya tidak seperti
     dugaannya, periodenya diganti tanpa satu pun panggilan ke peladen.
  */
  const wadahUpt = isi.querySelector('#laporan-upt')
  if (wadahUpt) {
    baganUptMuncul(wadahUpt, uptNaik(keadaan.berita || [], {
      mulai: pilihan.mulai, selesai: pilihan.selesai, maks: 10,
    }))
  }

  isi.querySelectorAll('[data-jenis]').forEach((b) => {
    b.addEventListener('click', () => {
      pilihan.jenis = b.dataset.jenis
      siapkanPeriode()
      pilihan.hasil = null
      gambarUlang()
    })
  })

  isi.querySelector('[data-peran="mulai"]')?.addEventListener('change', (ev) => {
    pilihan.mulai = ev.target.value
    pilihan.hasil = null
  })
  isi.querySelector('[data-peran="selesai"]')?.addEventListener('change', (ev) => {
    pilihan.selesai = ev.target.value
    pilihan.hasil = null
  })

  isi.querySelectorAll('[data-pratakir]').forEach((b) => {
    b.addEventListener('click', () => {
      const p = PRATAKIR[b.dataset.pratakir]
      if (!p) return
      pilihan.jenis = p.jenis
      pilihan.mulai = p.mulai()
      pilihan.selesai = p.selesai()
      pilihan.hasil = null
      gambarUlang()
    })
  })
  isi.querySelector('[data-aksi="unduh-daftar-semua"]')?.addEventListener('click', () => unduhDaftar(keadaan, { hanyaNegatif: false }))
  isi.querySelector('[data-aksi="unduh-daftar-negatif"]')?.addEventListener('click', () => unduhDaftar(keadaan, { hanyaNegatif: true }))
  isi.querySelector('[data-aksi="unduh-daftar-csv"]')?.addEventListener('click', () => unduhDaftar(keadaan, { hanyaNegatif: false, bentuk: 'csv' }))

  /*
     Penandaan. Mengubah klasifikasi, prioritas, atau kode sebar mengosongkan
     persetujuan dan laporan yang sudah tersusun: keduanya dibuat untuk
     penandaan yang lama. Tujuan surat hanya teks, jadi diubah tanpa menggambar
     ulang supaya kursor tidak hilang di tengah mengetik.
  */
  isi.querySelectorAll('select[data-sip]').forEach((el) => {
    el.addEventListener('change', () => {
      penandaan[el.dataset.sip] = el.value
      penandaan.setuju = false
      pilihan.hasil = null
      gambarUlang()
    })
  })
  isi.querySelector('input[data-sip="ditujukan"]')?.addEventListener('change', (ev) => {
    penandaan.ditujukan = ev.target.value.slice(0, 160)
    pilihan.hasil = null
    gambarUlang()
  })
  isi.querySelector('input[data-sip="setuju"]')?.addEventListener('change', (ev) => {
    penandaan.setuju = ev.target.checked
    gambarUlang()
  })

  isi.querySelector('[data-aksi="susun-laporan"]')?.addEventListener('click', () => buat(isi, keadaan))
  isi.querySelector('[data-aksi="unduh-laporan"]')?.addEventListener('click', () => unduh(keadaan))
  isi.querySelector('[data-aksi="buka-laporan"]')?.addEventListener('click', bukaTab)

  return {
    judul: 'Laporan Berkala',
    sub: 'Laporan intelijen pemberitaan negatif, disusun langsung dari basis data',
  }
}
