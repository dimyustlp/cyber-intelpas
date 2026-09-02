/**
 * Tren Pemberitaan.
 *
 * Dasbor menjawab "bagaimana keadaan hari ini". Halaman ini menjawab
 * pertanyaan yang berbeda dan tidak bisa dijawab dasbor: apa yang BERUBAH.
 *
 * Satu aturan yang menentukan seluruh isi berkas ini: tidak ada satu pun
 * angka yang berdiri tanpa pembandingnya. Angka tanpa pembanding hanya bisa
 * dibaca oleh orang yang kebetulan hafal angka pekan lalu, dan tidak ada yang
 * hafal angka pekan lalu. Karena itu setiap ubin, setiap batang, dan setiap
 * baris tabel di sini membawa nilai periode sebelumnya di sampingnya —
 * periode yang panjangnya persis sama, tepat sebelum periode yang dipilih.
 *
 * Yang sengaja TIDAK ada di sini: ramalan. Sistem ini mencatat pemberitaan
 * yang sudah terbit; menarik garis lurus dari empat pekan terakhir ke pekan
 * depan akan tampak meyakinkan dan tidak berdasar apa pun.
 *
 * Seluruh angkanya dihitung dari arsip yang sudah ada di layar — tidak ada
 * satu pun panggilan tambahan ke peladen. Aturan himpunan dasarnya dipinjam
 * utuh dari lib/hitung.js, sehingga jumlah di sini selalu bisa dijumlahkan
 * kembali menjadi jumlah di dasbor.
 */

import { kartu, kosong, keping, tombol } from '../ui/komponen.js'
import { amankan, angka, persen, tanggalPanjang, tanggal } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { baganTren, baganUptMuncul, baganUrgensi } from '../ui/bagan.js'
import {
  dasar, deretTren, bandingPeriode, pergeseran, uptNaik, periodeSebelum,
} from '../lib/hitung.js'
import { sebaran } from '../lib/demo.js'

/**
 * Empat panjang periode, dan tidak lebih.
 *
 * Pilihan bebas tanggal sengaja tidak diberikan di sini. Perbandingan
 * antarperiode hanya jujur bila kedua periodenya sama panjang, dan pemilih
 * tanggal bebas membuat orang membandingkan sembilan hari dengan tiga puluh
 * hari tanpa sadar. Yang butuh rentang khusus menyusunnya di Laporan Berkala,
 * tempat rentangnya memang dinyatakan pada kop laporan.
 */
const PERIODE = [
  { hari: 7, label: '7 hari', ket: 'pekan ini dibandingkan pekan lalu' },
  { hari: 14, label: '14 hari', ket: 'dua pekan dibandingkan dua pekan sebelumnya' },
  { hari: 30, label: '30 hari', ket: 'sebulan dibandingkan sebulan sebelumnya' },
  { hari: 90, label: '90 hari', ket: 'satu triwulan dibandingkan triwulan sebelumnya' },
]

const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** Pilihan yang bertahan selama sesi. */
const pilihan = { hari: 30, bidang: 'subkategori' }

function isoHari(geser = 0) {
  const t = new Date()
  t.setDate(t.getDate() + geser)
  return t.toISOString().slice(0, 10)
}

function rentang() {
  return { mulai: isoHari(-(pilihan.hari - 1)), selesai: isoHari(0) }
}

/* ------------------------------------------------------------------ bagian */

/**
 * Ubin dengan pembanding.
 *
 * `ubin()` bawaan sudah menerima `delta`, tetapi delta yang diterimanya
 * berupa angka persen yang harus dihitung pemanggilnya. Dihitung di sini
 * sekali, supaya empat ubin tidak menghitungnya dengan empat cara.
 */
function ubinBanding({ label, kini, lalu, kaki, nada = 'netral', terbalik = false }) {
  const selisih = kini - lalu
  const arah = selisih === 0 ? 0 : selisih > 0 ? 1 : -1
  // Pada kebanyakan ubin di halaman ini, naik berarti memburuk. Tetapi bukan
  // semuanya — jumlah UPT yang diberitakan naik bisa berarti liputan yang
  // lebih merata, bukan keadaan yang memburuk. Karena itu arah "baik" bisa
  // dibalik per ubin alih-alih diputuskan sekali untuk semuanya.
  const nadaDelta = arah === 0 ? 'netral'
    : (arah > 0) === terbalik ? 'positif' : 'kritis'

  return `
    <div class="ubin" data-nada="${amankan(nada)}">
      <div class="ubin-label">${amankan(label)}</div>
      <div class="ubin-nilai angka">${angka(kini)}</div>
      <div class="ubin-kaki">
        <span class="tren-delta" data-nada="${nadaDelta}">
          ${arah === 0 ? '±0' : `${arah > 0 ? '▲' : '▼'} ${angka(Math.abs(selisih))}`}
        </span>
        ${amankan(kaki)}
      </div>
    </div>`
}

/** Tabel pergeseran: satu bidang, periode ini melawan periode sebelumnya. */
function tabelGeser(baris, satuanNama) {
  if (!baris.length) {
    return '<p class="samar-teks kecil-teks" style="padding:8px 2px">Belum ada data pada kedua periode.</p>'
  }
  const tertinggi = Math.max(1, ...baris.map((b) => Math.max(b.jumlah, b.sebelum)))

  return `
    <div class="geser-daftar">
      ${baris.map((b) => {
        const arah = b.delta === 0 ? 'tetap' : b.delta > 0 ? 'naik' : 'turun'
        const baru = b.sebelum === 0 && b.jumlah > 0
        return `
          <div class="geser-baris">
            <span class="geser-nama" title="${amankan(b.nama)}">${amankan(b.nama)}</span>
            <span class="geser-lacak">
              <i class="geser-lalu" style="width:${((b.sebelum / tertinggi) * 100).toFixed(1)}%"></i>
              <i class="geser-kini" style="width:${((b.jumlah / tertinggi) * 100).toFixed(1)}%"></i>
            </span>
            <b class="geser-angka angka">${angka(b.jumlah)}</b>
            <span class="geser-delta" data-arah="${arah}">
              ${baru ? 'baru' : b.delta === 0 ? '±0' : `${b.delta > 0 ? '+' : '−'}${Math.abs(b.delta)}`}
            </span>
          </div>`
      }).join('')}
    </div>
    <p class="mini-teks samar-teks" style="margin-top:9px">
      Batang gelap periode ini, batang pudar di belakangnya periode sebelumnya.
      ${amankan(satuanNama)} yang tidak muncul sama sekali pada kedua periode tidak ditampilkan.
    </p>`
}

/**
 * Irama pekan: rata-rata publikasi per hari dalam pekan.
 *
 * Bukan hiasan. Pemberitaan negatif Pemasyarakatan menumpuk pada hari kerja,
 * dan unit yang meledak justru pada Sabtu atau Minggu hampir selalu berarti
 * peristiwanya sendiri terjadi di akhir pekan — bukan pemberitaan susulan
 * atas peristiwa lama. Itu perbedaan yang menentukan siapa yang harus
 * dihubungi malam itu juga.
 */
function iramaPekan(deret) {
  const ember2 = NAMA_HARI.map((nama) => ({ nama, hari: 0, total: 0, negatif: 0 }))
  for (const d of deret) {
    const n = new Date(`${d.tanggal}T00:00:00Z`).getUTCDay()
    ember2[n].hari += 1
    ember2[n].total += d.total
    ember2[n].negatif += d.negatif
  }

  const rata = ember2.map((e) => ({
    ...e,
    rerata: e.hari ? e.total / e.hari : 0,
    rerataNegatif: e.hari ? e.negatif / e.hari : 0,
  }))
  const tertinggi = Math.max(0.01, ...rata.map((r) => r.rerata))

  // Senin dulu, Minggu terakhir. Pekan kerja Indonesia dimulai Senin, dan
  // grafik yang dimulai Minggu memaksa pembacanya menggeser sendiri.
  const urut = [...rata.slice(1), rata[0]]

  return `
    <div class="irama">
      ${urut.map((h) => `
        <div class="irama-hari" title="${amankan(h.nama)}: rata-rata ${h.rerata.toFixed(1).replace('.', ',')} publikasi per hari, ${h.rerataNegatif.toFixed(1).replace('.', ',')} di antaranya negatif.">
          <span class="irama-batang">
            <i class="irama-total" style="height:${((h.rerata / tertinggi) * 100).toFixed(1)}%"></i>
            <i class="irama-negatif" style="height:${((h.rerataNegatif / tertinggi) * 100).toFixed(1)}%"></i>
          </span>
          <span class="irama-label">${amankan(h.nama.slice(0, 3))}</span>
          <span class="irama-angka angka">${h.rerata.toFixed(1).replace('.', ',')}</span>
        </div>`).join('')}
    </div>
    <p class="mini-teks samar-teks" style="margin-top:8px">
      Rata-rata publikasi per hari sepanjang periode. Batang gelap di dalamnya adalah
      bagian yang bersentimen negatif.
    </p>`
}

/* ----------------------------------------------------------------- halaman */

export function halamanTren({ keadaan, isi }) {
  const semua = keadaan.berita || []
  const { mulai, selesai } = rentang()
  const periodeIni = PERIODE.find((p) => p.hari === pilihan.hari) || PERIODE[2]

  if (!dasar(semua).length) {
    isi.innerHTML = kartu({
      isi: kosong(
        'Belum ada arsip yang bisa dibandingkan',
        'Halaman ini menyandingkan satu periode dengan periode sepanjang itu tepat sebelumnya. '
        + 'Selama arsipnya masih kosong, tidak ada yang bisa disandingkan.',
      ),
    })
    return { judul: 'Tren Pemberitaan', sub: 'Menunggu arsip terklasifikasi' }
  }

  const banding = bandingPeriode(semua, { mulai, selesai })
  const lalu = periodeSebelum(mulai, selesai)
  const deret = deretTren(semua, { mulai, selesai })
  const unit = uptNaik(semua, { mulai, selesai, maks: 10 })

  const geserIsu = pergeseran(banding.daftarKini, banding.daftarLalu, pilihan.bidang, 9)
  const geserMedia = pergeseran(banding.daftarKini, banding.daftarLalu, 'media', 8)

  // Unit yang benar-benar baru muncul — nol pada periode sebelumnya. Dipisah
  // dari daftar utama karena artinya berbeda: bukan unit yang lebih ramai,
  // melainkan unit yang sebelumnya sama sekali tidak terdengar.
  const munculBaru = unit.filter((u) => u.sebelum === 0 && u.jumlah > 0)

  const porsiNegatif = banding.kini.publikasi
    ? persen(banding.kini.negatif, banding.kini.publikasi) : '0,0%'
  const porsiNegatifLalu = banding.lalu.publikasi
    ? persen(banding.lalu.negatif, banding.lalu.publikasi) : '0,0%'

  isi.innerHTML = `
    <div class="tumpuk">
      <div class="bilah-alat">
        <div class="segmen" role="group" aria-label="Panjang periode">
          ${PERIODE.map((p) => `
            <button data-periode="${p.hari}" aria-pressed="${p.hari === pilihan.hari}">
              ${p.label}
            </button>`).join('')}
        </div>
        <span class="mini-teks samar-teks">
          ${amankan(tanggal(mulai))} – ${amankan(tanggal(selesai))}
          &nbsp;dibandingkan&nbsp;
          ${amankan(tanggal(lalu.mulai))} – ${amankan(tanggal(lalu.selesai))}
        </span>
        <div class="dorong">
          ${tombol({ label: 'Ke Peta Sebaran', ikon: 'peta', kecil: true, halaman: 'peta' })}
        </div>
      </div>

      <div class="kisi kisi-4">
        ${ubinBanding({
          label: 'Publikasi',
          kini: banding.kini.publikasi, lalu: banding.lalu.publikasi,
          kaki: 'dibanding periode sebelumnya',
        })}
        ${ubinBanding({
          label: 'Bersentimen negatif',
          kini: banding.kini.negatif, lalu: banding.lalu.negatif,
          kaki: `${porsiNegatif} dari publikasi (sebelumnya ${porsiNegatifLalu})`,
          nada: 'kritis',
        })}
        ${ubinBanding({
          label: 'Menuntut respons',
          kini: banding.kini.mendesak, lalu: banding.lalu.mendesak,
          kaki: 'berurgensi tinggi atau kritis',
          nada: 'sedang',
        })}
        ${ubinBanding({
          label: 'UPT yang diberitakan',
          kini: banding.kini.unit, lalu: banding.lalu.unit,
          kaki: `${angka(munculBaru.length)} di antaranya baru muncul`,
          terbalik: true,
        })}
      </div>

      ${kartu({
        judul: `Pergerakan ${amankan(periodeIni.label.toLowerCase())}`,
        ket: `Garis utuh seluruh publikasi, garis putus bagian yang bersentimen negatif — ${amankan(periodeIni.ket)}.`,
        isi: `<div id="tren-garis"></div>`,
      })}

      ${kartu({
        judul: 'UPT yang naik ke permukaan',
        ket: 'Unit dengan pemberitaan terbanyak pada periode ini, disandingkan dengan periode sebelumnya.',
        aksi: tombol({ label: 'Buka peta', ikon: 'peta', kecil: true, halaman: 'peta' }),
        isi: `
          <div id="tren-upt"></div>
          ${munculBaru.length ? `
            <div class="pesan" data-nada="sedang" style="margin-top:13px">
              ${ikon('peringatan')}
              <div>
                <b>${angka(munculBaru.length)} unit baru muncul pada periode ini.</b>
                Tidak satu pun diberitakan pada
                ${amankan(tanggal(lalu.mulai))}–${amankan(tanggal(lalu.selesai))}:
                ${munculBaru.slice(0, 5).map((u) => `${amankan(u.nama)} (${angka(u.jumlah)})`).join(', ')}${munculBaru.length > 5 ? ', dan lainnya' : ''}.
              </div>
            </div>` : ''}`,
      })}

      <div class="kisi kisi-2">
        ${kartu({
          judul: 'Isu yang bergeser',
          ket: 'Diurutkan menurut kenaikan, bukan menurut jumlah — yang dicari di sini adalah perubahannya.',
          aksi: `
            <div class="segmen kecil" role="group" aria-label="Tingkat pengelompokan isu">
              <button data-bidang="subkategori" aria-pressed="${pilihan.bidang === 'subkategori'}">Subkategori</button>
              <button data-bidang="kategori" aria-pressed="${pilihan.bidang === 'kategori'}">Kategori</button>
            </div>`,
          isi: tabelGeser(geserIsu, pilihan.bidang === 'kategori' ? 'Kategori' : 'Subkategori'),
        })}

        ${kartu({
          judul: 'Media yang bergeser',
          ket: 'Media yang tiba-tiba ramai memberitakan biasanya sedang mengangkat satu isu, bukan banyak.',
          isi: tabelGeser(geserMedia, 'Media'),
        })}
      </div>

      <div class="kisi kisi-2">
        ${kartu({
          judul: 'Irama pekan',
          ket: 'Hari mana pemberitaan menumpuk sepanjang periode ini.',
          isi: iramaPekan(deret),
        })}

        ${kartu({
          judul: 'Bauran urgensi periode ini',
          ket: `${angka(banding.kini.publikasi)} publikasi, ${angka(banding.kini.media)} media.`,
          isi: '<div id="tren-urgensi"></div>',
        })}
      </div>

      ${kartu({
        judul: 'Hari tersibuk pada periode ini',
        rapat: true,
        isi: tabelHari(deret),
      })}
    </div>`

  /* Bagan digambar setelah rangka terpasang, supaya ukuran wadahnya sudah pasti. */
  baganTren(isi.querySelector('#tren-garis'), deret, {
    label: `Tren ${pilihan.hari} hari terakhir`,
  })
  baganUptMuncul(isi.querySelector('#tren-upt'), unit)
  baganUrgensi(isi.querySelector('#tren-urgensi'), sebaran(banding.daftarKini, 'urgensi'))

  /* --------------------------------------------------------------- penyimak */

  isi.addEventListener('click', (ev) => {
    const periode = ev.target.closest('[data-periode]')?.dataset.periode
    if (periode) {
      pilihan.hari = Number(periode)
      isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))
      return
    }
    const bidang = ev.target.closest('[data-bidang]')?.dataset.bidang
    if (bidang) {
      pilihan.bidang = bidang
      isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))
    }
  })

  return {
    judul: 'Tren Pemberitaan',
    sub: `${periodeIni.label} terakhir dibandingkan ${periodeIni.label} sebelumnya`,
  }
}

/** Sepuluh hari paling ramai, supaya lonjakan punya tanggal dan judulnya. */
function tabelHari(deret) {
  const ramai = [...deret]
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total || b.negatif - a.negatif)
    .slice(0, 8)

  if (!ramai.length) {
    return `<div style="padding:16px">${kosong('Tidak ada publikasi pada periode ini',
      'Periode sepi adalah keadaan yang sah. Yang perlu diperiksa hanyalah apakah sinkronisasi sumber memang berjalan pada rentang tanggal tersebut.')}</div>`
  }

  const tertinggi = Math.max(...ramai.map((d) => d.total))

  return `
    <div class="tabel-bungkus">
      <table class="tabel">
        <thead>
          <tr>
            <th>Tanggal</th><th>Hari</th>
            <th style="width:32%">Volume</th>
            <th class="rata-kanan">Publikasi</th><th class="rata-kanan">Negatif</th><th class="rata-kanan">Mendesak</th>
          </tr>
        </thead>
        <tbody>
          ${ramai.map((d) => `
            <tr>
              <td class="kecil-teks">${amankan(tanggalPanjang(d.tanggal))}</td>
              <td class="kecil-teks samar-teks">
                ${amankan(NAMA_HARI[new Date(`${d.tanggal}T00:00:00Z`).getUTCDay()])}
              </td>
              <td>
                <span class="maju-lacak" style="min-width:100px">
                  <i style="--lebar:${((d.total / tertinggi) * 100).toFixed(1)}%"></i>
                </span>
              </td>
              <td class="rata-kanan angka">${angka(d.total)}</td>
              <td class="rata-kanan angka">${d.negatif ? keping(String(d.negatif), 'kritis', true) : '—'}</td>
              <td class="rata-kanan angka">${d.mendesak || '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`
}
