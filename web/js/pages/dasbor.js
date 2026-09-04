/**
 * Dasbor eksekutif.
 *
 * Tata letaknya mengikuti cara pimpinan membaca: keadaan hari ini lebih dulu,
 * lalu apa yang berubah, baru rinciannya. Yang perlu tindakan diberi bentuk,
 * bukan hanya warna — setiap keping selalu membawa katanya sendiri.
 */

import { ubin, kartu, keping, kosong, pesanSistem, tombol } from '../ui/komponen.js'
import { baganTren, baganSentimen, baganBatang, baganUrgensi } from '../ui/bagan.js'
import { sumberAsli, kelompokkanPeristiwa, validasiBanyak, rekapMutu } from '../lib/peristiwa.js'
import { sebaran } from '../lib/demo.js'
import {
  angka, persen, delta, tanggalPanjang, jarakWaktu, ringkas,
  nadaUrgensi, amankan,
} from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { belumTerpetakan } from '../lib/unit-terpetakan.js'
import { ringkasan, deretEmpatBelasHari } from '../lib/hitung.js'
import { EMBER, BELUM } from '../lib/sentimen.js'

/**
 * Bilah kesehatan aliran data.
 *
 * Kegagalan pengambilan berita selama ini baru ketahuan ketika laporan
 * mingguan terbit tipis atau kosong — biasanya beberapa hari setelah aliran
 * datanya sebenarnya berhenti. Bilah ini memindahkan kabar itu ke tempat yang
 * pasti dilihat setiap pagi.
 *
 * Perlu dibedakan dua hal yang mudah tertukar. Penyalinan dari spreadsheet ke
 * basis data bisa "berhasil" tiap lima menit sementara tidak ada satu pun
 * baris baru yang datang — yang berhasil hanyalah menyalin isi yang sama.
 * Karena itu keduanya dilaporkan terpisah.
 */
function bilahKesehatan(k) {
  if (!k || !k.status) return ''
  if (k.status === 'sehat') return ''

  const jam = Number(k.baris_jeda_jam || 0)
  const turun = Number(k.perubahan_persen ?? 0)

  const kabar = {
    'sinkron-mati': {
      nada: 'kritis', ikon: 'peringatan',
      teks: `<b>Penyalinan dari spreadsheet berhenti.</b> Penyalinan terakhir yang berhasil
             ${angka(Math.round((k.sinkron_jeda_menit || 0) / 60))} jam lalu. Selama ini berlangsung,
             berita baru tidak akan masuk ke sistem sama sekali.`,
    },
    'asupan-berhenti': {
      nada: 'kritis', ikon: 'peringatan',
      teks: `<b>Tidak ada berita baru selama ${angka(jam)} jam.</b> Penyalinan spreadsheet berjalan
             normal, jadi yang berhenti ada di hulu — perayap yang mengisi spreadsheet.
             Laporan yang disusun sekarang akan tampak sepi tanpa alasan yang sebenarnya.`,
    },
    'asupan-melambat': {
      nada: 'sedang', ikon: 'info',
      teks: `<b>Berita terakhir masuk ${angka(jam)} jam lalu.</b> Belum tentu gangguan, tetapi
             pantas dilirik bila esok pagi angkanya belum bergerak.`,
    },
    'asupan-menurun': {
      nada: 'sedang', ikon: 'info',
      teks: `<b>Jumlah berita masuk turun ${angka(Math.abs(turun))} persen dibanding pekan lalu</b>
             (${angka(k.masuk_sepekan)} berbanding ${angka(k.masuk_pekan_lalu)}). Penyalinan
             spreadsheet sendiri berjalan normal, jadi penurunan ini berasal dari perayap
             sumbernya — bukan dari sepinya pemberitaan.`,
    },
  }[k.status]

  if (!kabar) return ''
  return pesanSistem(kabar.teks, kabar.nada, kabar.ikon)
}

export function halamanDasbor({ keadaan, isi }) {
  /*
     Seluruh angka halaman ini berasal dari satu himpunan dasar yang sama,
     dihitung sekali di lib/hitung.js. Sebelumnya tiap ubin menyaring sendiri
     dari `keadaan.dalamLingkup`, dengan aturan yang diam-diam berbeda: ubin
     memasukkan berita yang sudah dinyatakan tidak valid, lencana menu
     membuangnya, dan kanal memakai definisi negatif yang lain lagi. Tidak ada
     satu pun yang salah hitung — yang berbeda pertanyaannya, dan pembacanya
     yang menanggung akibatnya.
  */
  const r = ringkasan(keadaan.berita || [])
  const berita = r.inti

  const jumlahHariIni = r.hariIni.length
  const jumlahKemarin = r.kemarin.length

  const mendesak = r.mendesak
  const negatif = r.negatif
  const belumTelaah = r.antrean
  const takTerpetakan = r.takTerpetakan

  if (!berita.length) {
    isi.innerHTML = kartu({
      judul: 'Belum ada data',
      isi: kosong(
        'Belum ada berita yang masuk',
        'Sinkronisasi sumber belum menghasilkan baris apa pun, dan belum ada masukan manual. Periksa halaman Sinkronisasi Sumber untuk memastikan penjadwal berjalan.',
        /* `halaman`, bukan `aksi`. Sebagai aksi, tombol ini menuntut penyimak
           klik di berkas ini — dan berkas ini tidak punya satu pun penyimak,
           sehingga tombolnya tertekan tanpa akibat sejak hari ia ditulis.
           Lewat `halaman`, ia memakai jalur navigasi yang sama dengan menu
           samping, yang tidak bisa lupa disimak. */
        tombol({ label: 'Buka Sinkronisasi Sumber', ikon: 'sinkron', gaya: 'utama', halaman: 'sinkronisasi' }),
      ),
    })
    return { judul: 'Dasbor Eksekutif', sub: tanggalPanjang(new Date()) }
  }

  const uptTerdampak = new Set(berita.filter((b) => !belumTerpetakan(b.nama_upt)).map((b) => b.nama_upt))
  const uptMendesak = new Set(mendesak.filter((b) => !belumTerpetakan(b.nama_upt)).map((b) => b.nama_upt))

  // Peristiwa, bukan publikasi. Delapan berita tentang satu napi yang kabur
  // adalah satu kejadian; menghitungnya delapan kali membuat pimpinan membaca
  // tekanan opini sebagai jumlah insiden.
  const positif = r.positif
  const peristiwaNegatif = kelompokkanPeristiwa(negatif)
  const peristiwaPositif = kelompokkanPeristiwa(positif)
  const mutu = rekapMutu(validasiBanyak(berita))
  const netral = r.netral.length
  const belumDinilai = r.belumDinilai.length

  isi.innerHTML = `
    <div class="tumpuk">

      ${bilahKesehatan(keadaan.kesehatan)}

      ${garisKeadaan(mendesak, belumTelaah, takTerpetakan)}

      <div class="kisi kisi-4">
        ${/*
             Keempatnya membuka daftar di baliknya.

             Saringan yang dititipkan bukan hiasan: ia membuat panjang daftar
             yang terbuka sama persis dengan angka yang barusan ditekan. Ubin
             yang menyebut 37 lalu membuka 812 baris memindahkan pertanyaan
             pembacanya ke tempat yang lebih sulit, bukan menjawabnya.
          */''}
        ${ubin({
          label: 'Berita masuk hari ini',
          nilai: jumlahHariIni,
          nada: 'aksen',
          delta: delta(jumlahHariIni, jumlahKemarin),
          kaki: 'dibanding kemarin',
          halaman: 'berita',
          saring: { periode: 'Masuk hari ini', lingkup: 'Yang dihitung' },
        })}
        ${ubin({
          label: 'Perlu respons segera',
          nilai: mendesak.length,
          nada: mendesak.length ? 'kritis' : 'netral',
          kaki: `${uptMendesak.size} UPT terdampak`,
          halaman: 'peringatan',
        })}
        ${ubin({
          label: 'Menunggu telaah analis',
          nilai: belumTelaah.length,
          nada: belumTelaah.length > 20 ? 'sedang' : 'netral',
          kaki: persen(belumTelaah.length, berita.length) + ' dari arsip',
          halaman: 'telaah',
        })}
        ${ubin({
          label: 'Peristiwa negatif',
          nilai: peristiwaNegatif.length,
          nada: 'tinggi',
          kaki: `dari ${angka(negatif.length)} publikasi`,
          halaman: 'negatif',
        })}
      </div>

      ${barisRekonsiliasi(r, keadaan)}

      <div id="dasbor-siklus"><div class="rangka" style="height:104px"></div></div>

      ${blokKanal(peristiwaNegatif, peristiwaPositif, negatif, positif, netral, belumDinilai, berita.length)}

      <div class="kisi kisi-utama-samping">
        ${kartu({
          judul: 'Arus pemberitaan empat belas hari',
          ket: 'Menurut tanggal terbit beritanya, bukan tanggal penarikannya — sama dengan laporan berkala. Garis utuh seluruh berita, garis putus yang bersentimen negatif.',
          isi: `<div id="bagan-tren"></div>
                <div class="baris gap-12" style="margin-top:10px;font-size:12px" id="legenda-tren"></div>`,
        })}
        ${kartu({
          judul: 'Sebaran sentimen',
          ket: 'Seluruh arsip yang tersedia bagi Anda',
          isi: `<div id="bagan-sentimen"></div>
                ${blokMutu(mutu)}`,
        })}
      </div>

      ${/*
        Urutannya sengaja dibalik dari yang semula. Bagan kategori memuat
        delapan baris, bagan urgensi hanya empat; ketika yang pendek diletakkan
        di kiri pada kisi dua kolom yang sama lebar, sisi kiri menyisakan bidang
        kosong setinggi separuh kartu. Yang panjang di kolom lebar dan yang
        pendek di kolom sempit membuat keduanya berakhir kira-kira sejajar.
      */''}
      <div class="kisi kisi-utama-samping">
        ${kartu({
          judul: 'Isu yang paling banyak muncul',
          ket: 'Delapan kategori teratas menurut taksonomi Dirpamintel',
          isi: '<div id="bagan-kategori"></div>',
        })}
        ${kartu({
          judul: 'Tingkat urgensi',
          ket: 'Berurut dari yang paling ringan sampai yang menuntut respons segera',
          isi: '<div id="bagan-urgensi"></div>',
        })}
      </div>

      ${/*
        UPT paling banyak disorot didahulukan atas Daftar prioritas.
        Alasan urutannya: "siapa yang paling sering disorot" adalah pertanyaan
        tentang pola — jawabannya stabil dari hari ke hari, dan itulah yang
        pantas dibaca lebih dulu untuk membentuk gambaran umum. "Apa yang perlu
        ditutup sekarang" adalah pertanyaan tentang tindakan segera, dan tempat
        wajarnya adalah tepat sebelum baris aksi berikutnya di bagian bawah
        halaman — bukan memutus alur antara dua kartu berbentuk bagan.
      */''}
      <div class="kisi kisi-2">
        ${kartu({
          judul: 'UPT paling banyak disorot',
          ket: `${uptTerdampak.size} UPT muncul dalam arsip saat ini`,
          rapat: true,
          isi: tabelUpt(berita),
        })}
        ${kartu({
          judul: 'Asal data',
          ket: 'Perbandingan hasil sinkronisasi otomatis dengan masukan manual',
          isi: kartuSumber(berita),
        })}
      </div>

      ${kartu({
        judul: 'Daftar prioritas',
        ket: `${mendesak.length} berita berurgensi tinggi atau kritis yang belum ditutup`,
        aksi: tombol({ label: 'Lihat semua', ikon: 'panahKanan', kecil: true, halaman: 'peringatan' }),
        rapat: true,
        isi: mendesak.length
          ? daftarPrioritas(mendesak.slice(0, 7))
          : kosong('Tidak ada yang mendesak', 'Semua berita berurgensi tinggi sudah ditelaah atau ditutup. Keadaan terkendali.'),
      })}
    </div>`

  // Bagan digambar setelah rangka HTML terpasang, supaya ukuran wadahnya sudah pasti.
  isiSiklus(isi, keadaan)

  const deret = deretEmpatBelasHari(berita)
  const warna = baganTren(document.getElementById('bagan-tren'), deret)
  document.getElementById('legenda-tren').innerHTML = `
    <span class="baris gap-6"><i style="width:14px;height:2px;background:${warna.warnaTotal};display:block"></i> Seluruh berita</span>
    <span class="baris gap-6"><i style="width:14px;height:0;border-top:2px dashed ${warna.warnaNegatif};display:block"></i> Bersentimen negatif</span>`

  // Donat sentimen memakai ember, bukan nilai mentah — tiga golongan yang sama
  // dengan yang diputuskan analis, bukan empat yang hanya dikenal basis data.
  baganSentimen(document.getElementById('bagan-sentimen'), [
    ...EMBER.map((e) => ({ kode: e.kode, label: e.label, jumlah: r.perEmber[e.kode] })),
    { kode: BELUM.kode, label: BELUM.label, jumlah: r.perEmber.belum },
  ])
  baganUrgensi(document.getElementById('bagan-urgensi'), sebaran(berita, 'urgensi'))
  baganBatang(document.getElementById('bagan-kategori'), sebaran(berita, 'kategori'))

  return { judul: 'Dasbor Eksekutif', sub: tanggalPanjang(new Date()) }
}

/* ------------------------------------------------------------- potongan */

/**
 * Baris rekonsiliasi.
 *
 * Keluhan yang melahirkan baris ini: jumlah berita di kepala dasbor tidak cocok
 * dengan jumlah di kanal negatif dan positif di bawahnya, dan tidak ada satu
 * pun keterangan yang menjelaskan mengapa. Sekarang penjumlahannya ditulis apa
 * adanya, lengkap dengan yang sengaja tidak dihitung. Selisih berikutnya —
 * kalau suatu hari muncul lagi — akan terbaca oleh pembacanya sendiri, bukan
 * ditemukan berbulan-bulan kemudian.
 */
function barisRekonsiliasi(r, keadaan) {
  const potongan = [
    `<b class="angka">${angka(r.negatif.length)}</b> negatif`,
    `<b class="angka">${angka(r.netral.length)}</b> netral/campuran`,
    `<b class="angka">${angka(r.positif.length)}</b> positif`,
  ]
  if (r.belumDinilai.length) {
    potongan.push(`<b class="angka">${angka(r.belumDinilai.length)}</b> belum dinilai`)
  }

  const dikecualikan = []
  if (r.luarLingkup) dikecualikan.push(`${angka(r.luarLingkup)} di luar lingkup Pemasyarakatan`)
  if (r.dikecualikan) dikecualikan.push(`${angka(r.dikecualikan)} tidak valid atau diarsipkan`)

  return `
    <div class="rekonsiliasi">
      <div class="rekon-baris">
        <span class="label-mono">Cakupan angka</span>
        <span class="rekon-hitung">
          <b class="angka">${angka(r.total)}</b> berita dihitung
          <span class="rekon-sama">=</span>
          ${potongan.join(' <span class="rekon-tambah">+</span> ')}
        </span>
      </div>
      <div class="rekon-kaki">
        Seluruh arsip yang tersedia bagi Anda: ${angka(r.seluruhBaris)} baris.
        ${dikecualikan.length ? `Tidak ikut dihitung: ${amankan(dikecualikan.join(', '))}.` : ''}
        ${keadaan?.terpotong
          ? '<b class="kritis-teks">Arsip melewati batas penarikan, sebagian baris lama belum termuat.</b>'
          : ''}
      </div>
    </div>`
}

function garisKeadaan(mendesak, belumTelaah, takTerpetakan) {
  const kritis = mendesak.filter((b) => b.urgensi === 'Kritis')

  if (kritis.length) {
    return pesanSistem(
      `<b>${kritis.length} berita berstatus kritis menunggu penanganan.</b>
       Menurut panduan Dirpamintel, tingkat ini berarti kejadian sedang berlangsung dan menyangkut keselamatan.
       UPT terdampak: ${amankan([...new Set(kritis.map((b) => b.nama_upt))].slice(0, 3).join(', '))}.`,
      'kritis', 'peringatan',
    )
  }

  if (takTerpetakan.length > mendesak.length * 2 && takTerpetakan.length > 10) {
    return pesanSistem(
      `<b>${takTerpetakan.length} berita belum terhubung ke unit mana pun.</b>
       Selama belum dipetakan, berita ini tidak muncul di peta sebaran dan tidak terhitung dalam rekap per wilayah.`,
      'sedang', 'peta',
    )
  }

  if (belumTelaah.length > 40) {
    return pesanSistem(
      `<b>Antrean telaah menumpuk: ${belumTelaah.length} berita.</b>
       Klasifikasi mesin baru menjadi angka resmi setelah analis menyetujuinya.`,
      'sedang', 'jam',
    )
  }

  return pesanSistem(
    'Tidak ada berita berstatus kritis. Pemeriksaan sumber berjalan setiap lima menit.',
    'positif', 'centang',
  )
}

function daftarPrioritas(daftar) {
  return `
  <div class="tabel-bungkus">
    <table class="tabel">
      <thead>
        <tr>
          <th style="width:78px">Urgensi</th>
          <th>Berita</th>
          <th style="width:190px">UPT</th>
          <th style="width:110px">Status</th>
          <th style="width:96px">Masuk</th>
        </tr>
      </thead>
      <tbody>
        ${daftar.map((b) => `
          <tr>
            <td>${keping(b.urgensi, nadaUrgensi(b.urgensi))}</td>
            <td>
              <span class="judul-sel">${amankan(b.judul)}</span>
              <span class="mini-teks samar-teks">${amankan(b.subkategori || b.kategori || 'Belum dikelompokkan')} · ${amankan(sumberAsli(b))}</span>
            </td>
            <td class="kecil">${amankan(belumTerpetakan(b.nama_upt) ? 'Belum terpetakan' : b.nama_upt)}</td>
            <td>${keping(b.status_verifikasi, b.status_verifikasi === 'Terverifikasi' ? 'positif' : 'sedang', true)}</td>
            <td class="angka kecil">${amankan(jarakWaktu(b.created_at))}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

function tabelUpt(berita) {
  const peta = new Map()
  for (const b of berita) {
    if (belumTerpetakan(b.nama_upt)) continue
    const p = peta.get(b.nama_upt) || { nama: b.nama_upt, total: 0, negatif: 0, mendesak: 0 }
    p.total += 1
    if (b.sentimen === 'Negatif') p.negatif += 1
    if (['Tinggi', 'Kritis'].includes(b.urgensi)) p.mendesak += 1
    peta.set(b.nama_upt, p)
  }

  const daftar = [...peta.values()]
    .sort((a, b) => b.mendesak - a.mendesak || b.negatif - a.negatif || b.total - a.total)
    .slice(0, 7)

  if (!daftar.length) return kosong('Belum ada unit terpetakan', 'Berita yang masuk belum terhubung ke unit mana pun.')

  return `
  <div class="tabel-bungkus">
    <table class="tabel">
      <thead><tr><th>UPT</th><th style="width:62px" class="rata-kanan">Total</th><th style="width:72px" class="rata-kanan">Negatif</th><th style="width:76px" class="rata-kanan">Mendesak</th></tr></thead>
      <tbody>
        ${daftar.map((u) => `
          <tr>
            <td style="font-weight:550">${amankan(u.nama)}</td>
            <td class="angka rata-kanan">${angka(u.total)}</td>
            <td class="angka rata-kanan">${u.negatif ? `<span style="color:var(--kritis)">${angka(u.negatif)}</span>` : '—'}</td>
            <td class="angka rata-kanan">${u.mendesak ? `<span style="color:var(--tinggi);font-weight:650">${angka(u.mendesak)}</span>` : '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}

function kartuSumber(berita) {
  // Sejak kanwil daerah punya spreadsheet sendiri, "otomatis" tidak lagi berarti
  // satu sumber. Yang dibedakan di sini tetap caranya masuk, bukan asalnya.
  const otomatis = berita.filter((b) => String(b.source_type || '').startsWith('google_sheet')).length
  const manual = berita.length - otomatis
  const rata = berita.filter((b) => b.ai_confidence).reduce((a, b) => a + Number(b.ai_confidence), 0)
    / Math.max(berita.filter((b) => b.ai_confidence).length, 1)

  return `
    <div class="tumpuk" style="gap:13px">
      <div>
        <div class="baris" style="justify-content:space-between;margin-bottom:5px">
          <span class="kecil-teks">Sinkronisasi Spreadsheet</span>
          <b class="angka kecil-teks">${angka(otomatis)} · ${persen(otomatis, berita.length)}</b>
        </div>
        <div class="bilah-progres"><span style="width:${(otomatis / berita.length) * 100}%"></span></div>
      </div>
      <div>
        <div class="baris" style="justify-content:space-between;margin-bottom:5px">
          <span class="kecil-teks">Masukan manual petugas</span>
          <b class="angka kecil-teks">${angka(manual)} · ${persen(manual, berita.length)}</b>
        </div>
        <div class="bilah-progres" style="--nada:var(--brass)"><span style="width:${(manual / berita.length) * 100}%"></span></div>
      </div>

      <div class="pesan" data-nada="netral" style="margin-top:2px">
        ${ikon('info')}
        <div class="kecil-teks">
          Rata-rata keyakinan mesin klasifikasi <b>${(rata * 100).toFixed(0)}%</b>.
          Hasil di bawah 75 persen selalu masuk antrean telaah, tidak pernah langsung dipakai.
        </div>
      </div>
    </div>`
}



/* ------------------------------------------------------------ kanal sentimen */

/**
 * Dua kanal berdampingan: yang merugikan di kiri, yang menguatkan di kanan.
 *
 * Sebelum ini dasbor hanya menampilkan satu angka sentimen di dalam donat, dan
 * untuk mengetahui berita negatifnya apa saja, pimpinan harus membuka halaman
 * lain lalu menyaring sendiri. Sekarang keduanya berdiri sendiri, lengkap
 * dengan tiga peristiwa teratas masing-masing dan pintu ke daftar penuhnya.
 */
function blokKanal(peristiwaNegatif, peristiwaPositif, negatif, positif, netral, belumDinilai, total) {
  const sisi = (nama, sisiKode, peristiwa, publikasi, ikonNama, halaman, ket) => {
    const teratas = peristiwa.slice(0, 3).map((p) => `
      <div class="kanal-baris">
        <span class="kanal-hitung">${angka(p.jumlah_publikasi)}×</span>
        <div style="min-width:0;flex:1">
          <div class="kanal-judul">${amankan(ringkas(p.judul || '', 88))}</div>
          <div class="kanal-sub">${amankan(p.subkategori)}${
            belumTerpetakan(p.nama_upt) ? '' : ' · ' + amankan(p.nama_upt)
          } · ${angka(p.jumlah_media)} media</div>
        </div>
      </div>`).join('')

    return `
    <section class="kanal-kotak" data-sisi="${sisiKode}">
      <header class="kanal-kop">
        <span class="kanal-tanda">${ikon(ikonNama)}</span>
        <div style="min-width:0">
          <div class="kanal-nama">${amankan(nama)}</div>
          <div class="kanal-ket">${amankan(ket)}</div>
        </div>
        <span class="kanal-angka">${angka(peristiwa.length)}</span>
      </header>
      <div class="kanal-isi">
        ${teratas || '<div class="kanal-baris"><span class="kanal-sub">Belum ada peristiwa pada kanal ini.</span></div>'}
      </div>
      <footer style="padding:10px 16px;border-top:1px solid var(--line-3);display:flex;align-items:center;gap:10px">
        <span class="mini-teks samar-teks">${angka(publikasi.length)} publikasi · ${
          angka(new Set(publikasi.map(sumberAsli).filter(Boolean)).size)} media</span>
        ${tombol({ label: 'Buka kanal', ikon: 'tautan', gaya: 'samar', kecil: true, halaman })}
      </footer>
    </section>`
  }

  const p = (n) => (total ? (n / total) * 100 : 0)

  return `
  ${kartu({
    judul: 'Keseimbangan pemberitaan',
    ket: 'Negatif dan positif dihitung terpisah, karena keduanya menuntut tindakan yang berbeda',
    isi: `
      <div class="imbang" role="img"
        aria-label="Negatif ${angka(negatif.length)}, netral atau campuran ${angka(netral)}, positif ${angka(positif.length)}">
        <span class="neg" style="flex:${negatif.length}"></span>
        <span class="net" style="flex:${Math.max(netral + belumDinilai, 0)}"></span>
        <span class="pos" style="flex:${positif.length}"></span>
      </div>
      <div class="baris gap-12" style="margin-top:9px;font-size:12px;flex-wrap:wrap">
        <span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--kritis)"></i>
          Negatif <b class="angka">${angka(negatif.length)}</b>
          <span class="samar-teks">${p(negatif.length).toFixed(1).replace('.', ',')}%</span></span>
        <span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--netral)"></i>
          Netral/Campuran <b class="angka">${angka(Math.max(netral, 0))}</b></span>
        <span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--positif)"></i>
          Positif <b class="angka">${angka(positif.length)}</b>
          <span class="samar-teks">${p(positif.length).toFixed(1).replace('.', ',')}%</span></span>
        ${belumDinilai ? `<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:var(--ink-4)"></i>
          Belum dinilai <b class="angka">${angka(belumDinilai)}</b></span>` : ''}
      </div>`,
  })}

  <div class="kanal">
    ${sisi('Kanal Negatif', 'negatif', peristiwaNegatif, negatif, 'peringatan', 'negatif',
           'Peristiwa yang merugikan institusi')}
    ${sisi('Kanal Positif', 'positif', peristiwaPositif, positif, 'centang', 'positif',
           'Narasi yang menguatkan institusi')}
  </div>`
}

/**
 * Ukuran mutu klasifikasi. Angka pada dasbor hanya berarti sejauh penilaian di
 * belakangnya bisa dipercaya, dan batang ini menyatakan seberapa jauh itu.
 */
function blokMutu(mutu) {
  if (!mutu.total) return ''
  return `
  <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line-3)">
    <div class="label-mono" style="margin-bottom:6px">Mutu klasifikasi mesin</div>
    <div class="mutu">
      <div class="mutu-batang" role="img"
        aria-label="${angka(mutu.baik)} baik, ${angka(mutu['perlu-lirik'])} perlu dilirik, ${angka(mutu['perlu-telaah'])} perlu telaah">
        <span class="baik" style="flex:${mutu.baik}"></span>
        <span class="lirik" style="flex:${mutu['perlu-lirik']}"></span>
        <span class="telaah" style="flex:${mutu['perlu-telaah']}"></span>
      </div>
      <b class="angka" style="color:var(--positif)">${mutu.persenBaik}%</b>
    </div>
    <div class="mini-teks samar-teks" style="margin-top:5px">
      ${angka(mutu['perlu-telaah'])} publikasi ditandai perlu telaah analis sebelum dipakai sebagai dasar keputusan.
    </div>
  </div>`
}

/* ------------------------------------------------------- siklus intelijen */

/**
 * Ringkasan siklus intelijen di dasbor.
 *
 * Celah yang ditutupnya: sejak lima halaman siklus dibangun, tidak ada satu
 * pun tempat yang menyatakan keadaannya secara keseluruhan. Pimpinan yang
 * membuka dasbor melihat arus pemberitaan dengan lengkap dan tidak melihat
 * bahwa tiga kasus sudah menunggu putusannya sejak pekan lalu — untuk
 * mengetahuinya ia harus membuka empat halaman satu per satu, dan yang harus
 * dibuka satu per satu tidak dibuka.
 *
 * Ditarik SESUDAH dasbor tergambar, bukan sebelumnya. Dasbor adalah layar
 * pertama sesudah masuk; menunda seluruh isinya demi tiga tabel yang mungkin
 * kosong berarti setiap orang menunggu lebih lama setiap pagi. Kartunya muncul
 * sebagai rangka lebih dulu, lalu terisi.
 *
 * Kegagalan penarikan tidak memunculkan galat merah. Peran yang tidak berhak
 * membaca tabel kasus memang ada — dan bagi mereka kartu ini sekadar tidak
 * pernah muncul, bukan menjadi pesan gagal yang tidak bisa mereka apa-apakan.
 */
async function isiSiklus(isi, keadaan) {
  const wadah = isi.querySelector('#dasbor-siklus')
  if (!wadah) return

  try {
    const { bacaSiklus, siapkanDemo } = await import('../lib/siklus-data.js')
    if (keadaan.demo) siapkanDemo(keadaan.berita || [])

    const [kasus, rekomendasi, penugasan, tindak] = await Promise.all([
      bacaSiklus('kasus'), bacaSiklus('rekomendasi'),
      bacaSiklus('penugasan'), bacaSiklus('tindak'),
    ])

    const { kasusTerbuka, terlambat, tindakSelesai } = await import('../lib/siklus.js')

    const terbuka = kasus.filter(kasusTerbuka)
    const menungguPutusan = kasus.filter((k) => k.status === 'Menunggu Keputusan')
    const verifikasiJalan = penugasan.filter(
      (p) => ['Ditugaskan', 'Diterima', 'Berjalan'].includes(p.status))
    const tindakTerlambat = tindak.filter((t) => terlambat(t))
    const tindakJalan = tindak.filter((t) => !tindakSelesai(t))
    const usulMenunggu = rekomendasi.filter((r) => r.status === 'Diusulkan')

    // Kartu tidak ditampilkan sama sekali bila belum ada satu kasus pun.
    // Empat angka nol berjajar tidak memberi tahu apa-apa, dan menempati
    // ruang yang pada dasbor selalu diperebutkan.
    if (!kasus.length) { wadah.innerHTML = ''; return }

    wadah.innerHTML = kartu({
      judul: 'Siklus intelijen',
      ket: 'Keadaan perkara yang sedang berjalan. Tekan salah satu untuk membukanya.',
      isi: `
        <div class="kisi kisi-4">
          ${ubin({ label: 'Kasus terbuka', nilai: terbuka.length, nada: 'aksen',
            kaki: `dari ${angka(kasus.length)} kasus tercatat`, halaman: 'kasus' })}
          ${ubin({ label: 'Verifikasi berjalan', nilai: verifikasiJalan.length,
            nada: verifikasiJalan.length ? 'sedang' : 'netral',
            kaki: verifikasiJalan.length ? 'surat tugas menunggu laporan' : 'tidak ada yang di lapangan',
            halaman: 'lapangan' })}
          ${ubin({ label: 'Menunggu putusan', nilai: menungguPutusan.length,
            nada: menungguPutusan.length ? 'kritis' : 'netral',
            kaki: `${angka(usulMenunggu.length)} rekomendasi belum diputus`,
            halaman: 'keputusan' })}
          ${ubin({ label: 'Tindak lanjut terlambat', nilai: tindakTerlambat.length,
            nada: tindakTerlambat.length ? 'kritis' : 'positif',
            kaki: `dari ${angka(tindakJalan.length)} butir yang berjalan`,
            halaman: 'tindak' })}
        </div>`,
    })
  } catch {
    // Peran yang tidak berhak membaca tabel siklus tidak perlu diberi tahu
    // bahwa ia tidak berhak; ia sudah tidak melihat menunya.
    wadah.innerHTML = ''
  }
}

/*
   `ubinSiklus()` pernah berdiri di sini — salinan `ubin()` yang tumbuh sendiri
   hanya karena `ubin()` belum bisa ditekan. Ia dihapus pada 3 September 2026,
   ketika `ubin()` menerima parameter `halaman`. Dua salinan komponen yang sama
   selalu berpisah cepat atau lambat, dan yang pertama menyadarinya adalah
   petugas yang melihat dua ubin bergaya berbeda di satu layar.
*/
