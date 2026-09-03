/**
 * Executive Brief — situasi dalam satu layar.
 *
 * ---------------------------------------------------------------------------
 * Kenapa halaman ini ada, dan kenapa ia baru ada sekarang
 * ---------------------------------------------------------------------------
 *
 * Izin `lihat_briefing` sudah diberikan kepada lima peran di lib/peran.js sejak
 * lama. Tidak ada satu pun butir menu dan tidak ada satu pun halaman yang
 * memakainya — izin yang menganga tanpa pintu. Berkas ini menutup lubang itu.
 *
 * ---------------------------------------------------------------------------
 * Untuk siapa, dan apa akibatnya pada isinya
 * ---------------------------------------------------------------------------
 *
 * Pembacanya pimpinan yang punya enam puluh detik, bukan analis yang punya
 * sore. Perbedaan itu menentukan tiga hal:
 *
 *   Tidak ada tabel. Tabel menuntut pembacanya menyaring sendiri, dan
 *   menyaring adalah pekerjaan analis. Yang ada di sini kalimat, angka besar,
 *   dan daftar pendek.
 *
 *   Setiap angka membawa pembandingnya. "Dua puluh empat kejadian mendesak"
 *   tidak berarti apa-apa bagi orang yang tidak hafal angka pekan lalu, dan
 *   tidak ada yang hafal angka pekan lalu.
 *
 *   Tidak ada satu angka pun yang dihitung di berkas ini. Seluruhnya dipinjam
 *   dari lib/hitung.js, lib/peristiwa.js, lib/risiko.js, dan
 *   lib/peringatan-laju.js — mesin yang sama yang dipakai dasbor, peringatan,
 *   dan laporan berkala. Sebuah briefing pimpinan yang menyebut angka berbeda
 *   dari layar yang dibaca stafnya adalah briefing yang akan dibantah di dalam
 *   rapat, dan sesudah itu tidak akan dipercaya lagi.
 *
 * Susunannya mengikuti pasal 37 spesifikasi: Situasi, Temuan Kunci, Penilaian
 * Risiko, Dampak, Tren, Rekomendasi.
 */

import { kartu, keping, kosong, tombol, pesanSistem, ubin } from '../ui/komponen.js'
import {
  amankan, angka, persen, delta, ringkas, tanggalPanjang, tanggal, jarakWaktu,
  nadaUrgensi,
} from '../lib/format.js'

import {
  ringkasan, bandingPeriode, pergeseran, uptNaik, deretTren, dasar,
} from '../lib/hitung.js'
import { kelompokkanPeristiwa } from '../lib/peristiwa.js'
import { peringkatRisiko } from '../lib/risiko.js'
import { periksaLaju, rekapLaju, ATURAN } from '../lib/peringatan-laju.js'

import { baganTren } from '../ui/bagan.js'

/** Pilihan periode. Bertahan selama sesi. */
const pilihan = { hari: 7 }

const PERIODE = [
  { hari: 1, label: '24 jam' },
  { hari: 7, label: '7 hari' },
  { hari: 30, label: '30 hari' },
]

function isoHari(geser = 0) {
  const t = new Date()
  t.setDate(t.getDate() + geser)
  return t.toISOString().slice(0, 10)
}

/**
 * Tingkat risiko nasional — satu pernyataan di puncak layar.
 *
 * Diturunkan dari kejadian, bukan dari rerata skor. Rerata adalah cara
 * tercepat membuat enam kejadian kritis menghilang di balik tiga ratus
 * unggahan seremonial.
 */
function tingkatNasional({ kritis, mendesak, lajuKritis, peristiwaBerat }) {
  if (kritis >= 3 || lajuKritis >= 2) {
    return {
      kode: 'Tinggi', nada: 'kritis',
      ket: 'Ada beberapa kejadian yang menuntut respons segera secara bersamaan.',
    }
  }
  if (kritis >= 1 || peristiwaBerat >= 3 || lajuKritis >= 1) {
    return {
      kode: 'Sedang', nada: 'tinggi',
      ket: 'Ada kejadian berat yang sedang berjalan dan menuntut sikap resmi.',
    }
  }
  if (mendesak >= 1) {
    return {
      kode: 'Rendah', nada: 'sedang',
      ket: 'Ada isu yang perlu diawasi, belum ada yang menuntut tindakan hari ini.',
    }
  }
  return {
    kode: 'Tenang', nada: 'positif',
    ket: 'Tidak ada kejadian mendesak pada periode ini.',
  }
}

/** Kalimat pembanding: "naik 8 dari 16 pada periode sebelumnya". */
function banding(kini, lalu, satuan) {
  if (kini === lalu) return `sama dengan ${lalu} pada periode sebelumnya`
  const arah = kini > lalu ? 'naik' : 'turun'
  return `${arah} ${angka(Math.abs(kini - lalu))} ${satuan} dari ${angka(lalu)} pada periode sebelumnya`
}

export function halamanBriefing({ keadaan, isi }) {
  const mulai = isoHari(-(pilihan.hari - 1))
  const selesai = isoHari(0)

  const semua = keadaan.berita || []
  const b = bandingPeriode(semua, { mulai, selesai })
  const periodeIni = b.daftarKini

  const r = ringkasan(periodeIni)
  const peristiwa = kelompokkanPeristiwa(dasar(periodeIni))
  const peringkat = peringkatRisiko(peristiwa)
  const laju = periksaLaju(semua)
  const rekapL = rekapLaju(laju)

  const peristiwaBerat = peringkat.filter((p) => p.skor >= 65).length
  const nasional = tingkatNasional({
    kritis: r.kritis.length,
    mendesak: r.mendesak.length,
    lajuKritis: rekapL.kritis,
    peristiwaBerat,
  })

  const isuNaik = pergeseran(b.daftarKini, b.daftarLalu, 'subkategori', 5)
    .filter((x) => x.delta > 0)
  const unitNaik = uptNaik(semua, { mulai, selesai, maks: 5 })
    .filter((u) => u.delta > 0)

  if (!periodeIni.length) {
    isi.innerHTML = kartu({
      isi: kosong(
        'Tidak ada pemberitaan pada periode ini',
        `Tidak ada satu pun berita yang masuk himpunan hitung antara ${tanggal(mulai)} dan ${tanggal(selesai)}. `
          + 'Perluas periodenya, atau periksa halaman Sinkronisasi Sumber untuk memastikan penjadwal berjalan.',
        bilahPeriode(),
      ),
    })
    pasangPenyimak(isi)
    return { judul: 'Executive Brief', sub: 'Tidak ada data pada periode ini' }
  }

  isi.innerHTML = `
    <div class="tumpuk">

      ${bilahPeriode()}

      ${/* ------------------------------------------------------ I. situasi */''}
      ${kartu({
        judul: 'Situasi',
        ket: `${tanggalPanjang(mulai)} sampai ${tanggalPanjang(selesai)}.`,
        isi: `
          <div class="brief-nasional" data-nada="${nasional.nada}">
            <div>
              <span class="label-mono">Tingkat risiko nasional</span>
              <b>${amankan(nasional.kode)}</b>
              <p>${amankan(nasional.ket)}</p>
            </div>
            <div class="brief-nasional-angka">
              <div><b>${angka(r.kritis.length)}</b><span>kejadian kritis</span></div>
              <div><b>${angka(peristiwaBerat)}</b><span>peristiwa berisiko tinggi</span></div>
              <div><b>${angka(rekapL.total)}</b><span>pola terdeteksi</span></div>
            </div>
          </div>

          <p class="brief-kalimat">
            Pada periode ini terpantau <b>${angka(b.kini.publikasi)} publikasi</b> yang
            dihitung — ${amankan(banding(b.kini.publikasi, b.lalu.publikasi, 'publikasi'))}.
            Di antaranya <b>${angka(b.kini.negatif)} bersentimen negatif</b>
            (${persen(b.kini.negatif, b.kini.publikasi)}),
            ${amankan(banding(b.kini.negatif, b.lalu.negatif, 'publikasi'))}.
            Publikasi itu mengelompok menjadi <b>${angka(peristiwa.length)} peristiwa</b>,
            menyangkut <b>${angka(b.kini.unit)} unit</b> dan disiarkan
            <b>${angka(b.kini.media)} media</b>.
          </p>`,
      })}

      ${/* -------------------------------------------------- II. temuan kunci */''}
      ${kartu({
        judul: 'Temuan kunci',
        ket: 'Lima peristiwa dengan skor risiko tertinggi pada periode ini.',
        isi: peringkat.length
          ? `<ol class="brief-temuan">
               ${peringkat.slice(0, 5).map((p, i) => barisTemuan(p, i)).join('')}
             </ol>`
          : kosong('Tidak ada peristiwa negatif',
              'Seluruh pemberitaan pada periode ini bersentimen positif atau netral.'),
      })}

      ${/* ------------------------------------------------ III. penilaian risiko */''}
      ${kartu({
        judul: 'Penilaian risiko',
        /*
           Satu-satunya bagian halaman ini yang TIDAK mengikuti periode di
           atas, dan itu disebutkan terus terang. Tiap aturan punya jendela
           waktunya sendiri — lonjakan membandingkan 24 jam, penumpukan
           mengamati 30 hari — dan memaksanya mengikuti periode pilihan akan
           membuat aturan lonjakan mustahil menyala pada periode "30 hari".
        */
        ket: 'Pola yang terdeteksi mesin, di luar penilaian berita satuan. '
          + 'Tiap aturan memakai jendela waktunya sendiri, bukan periode yang dipilih di atas.',
        isi: laju.length
          ? `<ul class="brief-pola">
               ${laju.slice(0, 5).map((a) => `
                 <li data-nada="${nadaUrgensi(a.tingkat)}">
                   ${keping(a.tingkat, nadaUrgensi(a.tingkat), true)}
                   <div>
                     <b>${amankan(ATURAN[a.kode]?.nama || a.kode)}</b>
                     <span>${amankan(ringkas(a.judul, 96))}</span>
                     <em>${amankan(a.sebab)}</em>
                   </div>
                 </li>`).join('')}
             </ul>
             ${tombol({ label: 'Buka Peringatan Dini', ikon: 'peringatan', halaman: 'peringatan' })}`
          : pesanSistem('Tidak ada lonjakan, penyebaran ke banyak sumber, peristiwa berat yang '
              + 'didiamkan, maupun penumpukan pelan di satu unit.', 'positif', 'centang'),
      })}

      <div class="kisi kisi-utama-samping">
        <div class="tumpuk">

          ${/* --------------------------------------------------------- V. tren */''}
          ${kartu({
            judul: 'Tren',
            ket: 'Publikasi harian dan bagian negatifnya.',
            isi: `<div id="brief-bagan" class="brief-bagan"></div>`,
          })}

          ${/* ------------------------------------------------ VI. rekomendasi */''}
          ${kartu({
            judul: 'Rekomendasi',
            ket: 'Disusun dari keadaan di atas, bukan dari penilaian bebas.',
            isi: `<ol class="brief-rekomendasi">
                    ${rekomendasi({ r, peringkat, laju, unitNaik, nasional })
                      .map((k) => `<li>${k}</li>`).join('')}
                  </ol>`,
          })}
        </div>

        <div class="tumpuk">

          ${/* ------------------------------------------------------ IV. dampak */''}
          ${kartu({
            judul: 'Dampak',
            ket: 'Ke mana beban pemberitaan jatuh.',
            isi: `
              <div class="kisi kisi-2" style="margin-bottom:14px">
                ${ubin({ label: 'Perlu respons segera', nilai: r.mendesak.length,
                  nada: r.mendesak.length ? 'kritis' : 'netral',
                  kaki: banding(b.kini.mendesak, b.lalu.mendesak, 'publikasi'),
                  halaman: 'peringatan' })}
                ${ubin({ label: 'Unit terdampak', nilai: b.kini.unit, nada: 'aksen',
                  delta: delta(b.kini.unit, b.lalu.unit), kaki: 'dibanding periode lalu',
                  halaman: 'peta' })}
              </div>

              ${unitNaik.length ? `
                <span class="label-mono">Unit yang naik ke permukaan</span>
                <ul class="brief-daftar">
                  ${unitNaik.map((u) => `
                    <li>
                      <span>${amankan(u.nama)}</span>
                      <b>${angka(u.jumlah)}</b>
                      <i class="naik">+${angka(u.delta)}</i>
                    </li>`).join('')}
                </ul>` : ''}

              ${isuNaik.length ? `
                <span class="label-mono" style="margin-top:14px;display:block">Isu yang menanjak</span>
                <ul class="brief-daftar">
                  ${isuNaik.map((x) => `
                    <li>
                      <span>${amankan(x.nama)}</span>
                      <b>${angka(x.jumlah)}</b>
                      <i class="naik">+${angka(x.delta)}</i>
                    </li>`).join('')}
                </ul>` : ''}

              ${!unitNaik.length && !isuNaik.length
                ? pesanSistem('Tidak ada unit maupun isu yang naik dibanding periode sebelumnya.',
                    'positif', 'centang') : ''}`,
          })}

          ${kartu({
            judul: 'Cara membaca',
            isi: `
              <div class="brief-catatan">
                <p><b>Peristiwa, bukan publikasi.</b> Delapan berita tentang satu kejadian
                   adalah satu peristiwa dengan eksposur besar. Jumlah peristiwa menentukan
                   berapa banyak yang harus ditangani; jumlah publikasi menentukan seberapa
                   keras tekanan opininya.</p>
                <p><b>Skor risiko dihitung, bukan dinilai.</b> Enam faktor berbobot tetap,
                   dan rinciannya bisa dibuka pada halaman detail tiap berita.</p>
                <p><b>Belum tentu sudah diverifikasi.</b> Peristiwa yang beritanya masih
                   berstatus awal ikut dihitung di sini. Yang sudah dinyatakan tidak valid
                   oleh analis tidak.</p>
              </div>`,
          })}
        </div>
      </div>

      <p class="brief-kaki">
        Disusun otomatis ${amankan(tanggalPanjang(new Date()))} dari
        ${angka(semua.length)} baris arsip yang tersedia bagi Anda.
        ${keadaan.demo ? 'Data peragaan — seluruh unit, media, dan kejadian di dalamnya fiktif.' : ''}
      </p>
    </div>`

  const wadah = isi.querySelector('#brief-bagan')
  if (wadah) baganTren(wadah, deretTren(periodeIni, { mulai, selesai }))

  pasangPenyimak(isi)

  return {
    judul: 'Executive Brief',
    sub: `Risiko nasional ${nasional.kode} · ${tanggal(mulai)} – ${tanggal(selesai)}`,
  }
}

/* ------------------------------------------------------------------ bagian */

function bilahPeriode() {
  return `
    <div class="brief-periode">
      <span class="label-mono">Periode</span>
      ${PERIODE.map((p) => `
        <button class="tbl kecil${p.hari === pilihan.hari ? ' utama' : ''}"
          data-periode="${p.hari}">${amankan(p.label)}</button>`).join('')}
    </div>`
}

function barisTemuan(p, i) {
  const { peristiwa: e, skor, tingkat } = p
  return `
    <li>
      <span class="brief-nomor">${String(i + 1).padStart(2, '0')}</span>
      <div class="brief-temuan-isi">
        <button class="brief-temuan-judul" data-buka="${amankan(e.publikasi[0]?.id || '')}"
          title="Buka detail berita ini">${amankan(ringkas(e.judul || 'Tanpa judul', 118))}</button>
        <span class="brief-temuan-meta">
          ${amankan(e.nama_upt || 'Unit belum terpetakan')}
          · ${angka(e.jumlah_publikasi)} terbitan di ${angka(e.jumlah_media)} media
          · ${amankan(jarakWaktu(e.tanggal_terakhir))}
        </span>
      </div>
      <div class="brief-temuan-skor">
        ${keping(tingkat.kode, tingkat.nada, true)}
        <b>${angka(skor)}</b>
      </div>
    </li>`
}

/**
 * Rekomendasi.
 *
 * Diturunkan dari keadaan, bukan dikarang. Setiap kalimat di bawah punya
 * syarat yang bisa diperiksa, dan tidak muncul ketika syaratnya tidak
 * terpenuhi. Alasannya sederhana: rekomendasi yang selalu sama akan berhenti
 * dibaca setelah briefing ketiga.
 *
 * Yang sengaja TIDAK dilakukan berkas ini: menyarankan tindakan terhadap orang
 * — memeriksa seseorang, menonaktifkan seseorang, menindak seseorang. Sistem
 * ini memantau pemberitaan; ia tidak pernah membuktikan siapa pun bersalah,
 * dan rekomendasi yang melangkah ke sana akan dikutip sebagai temuan.
 */
function rekomendasi({ r, peringkat, laju, unitNaik, nasional }) {
  const daftar = []

  const kritis = peringkat.filter((p) => p.skor >= 75)
  if (kritis.length) {
    daftar.push(`<b>Minta laporan lapangan atas ${angka(kritis.length)} peristiwa berskor kritis.</b>
      Skor setinggi itu berarti kabarnya sudah menyebar dan belum diimbangi keterangan resmi;
      yang dibutuhkan lebih dulu adalah fakta dari unitnya, bukan sikap.`)
  }

  const diam = laju.filter((a) => a.kode === 'diam')
  if (diam.length) {
    daftar.push(`<b>Tetapkan tenggat sikap resmi untuk ${angka(diam.length)} peristiwa yang belum ditanggapi.</b>
      Sepuluh poin dari skor tiap peristiwa itu semata-mata karena belum ada tanggapan —
      dan itu satu-satunya bagian skor yang bisa diturunkan tanpa menunggu pemberitaan mereda.`)
  }

  const menumpuk = laju.filter((a) => a.kode === 'menumpuk')
  if (menumpuk.length) {
    daftar.push(`<b>Periksa pola di ${menumpuk.map((a) => amankan(a.unit)).join(', ')}.</b>
      Tidak satu pun beritanya cukup berat untuk berdiri sendiri, dan justru itu sebabnya
      pola ini tidak pernah muncul di daftar peringatan mana pun sebelum hari ini.`)
  }

  if (unitNaik.length) {
    const u = unitNaik[0]
    daftar.push(`<b>Perhatikan ${amankan(u.nama)}.</b> Naik ${angka(u.delta)} publikasi
      dibanding periode sebelumnya — kenaikan terbesar di antara seluruh unit pada periode ini.`)
  }

  if (r.antrean.length > 20) {
    daftar.push(`<b>Percepat telaah ${angka(r.antrean.length)} berita yang mengantre.</b>
      Selama belum ditelaah, klasifikasinya masih penilaian mesin — dan penilaian mesin
      belum boleh menjadi dasar keputusan.`)
  }

  if (r.takTerpetakan.length > 10) {
    daftar.push(`<b>Petakan ${angka(r.takTerpetakan.length)} berita yang belum punya unit.</b>
      Berita negatif tanpa unit tidak bisa ditindaklanjuti kepada siapa pun, dan tidak
      muncul pada peta sebaran maupun peringatan berbasis unit.`)
  }

  if (!daftar.length) {
    daftar.push(`<b>Lanjutkan pemantauan berkala.</b> Tingkat risiko nasional
      ${amankan(nasional.kode.toLowerCase())}, dan tidak ada pola yang menuntut tindakan
      di luar rutinitas pada periode ini.`)
  }

  return daftar
}

/* ---------------------------------------------------------------- penyimak */

function pasangPenyimak(isi) {
  isi.addEventListener('click', (ev) => {
    const periode = ev.target.closest('[data-periode]')?.dataset.periode
    if (periode) {
      pilihan.hari = Number(periode)
      isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))
      return
    }

    const buka = ev.target.closest('[data-buka]')?.dataset.buka
    if (buka) {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'berita-detail', fokus: buka },
      }))
    }
  })
}

