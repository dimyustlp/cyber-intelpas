/**
 * Pusat Komando.
 *
 * Satu layar untuk dinding ruang piket: dibaca dari jarak tiga meter, oleh
 * orang yang sedang berdiri, sambil menerima telepon.
 *
 * Itu batasan yang menentukan seluruh isinya. Sebuah dasbor yang bagus di
 * layar meja hampir selalu buruk di dinding — angkanya terlalu kecil,
 * keterangannya terlalu banyak, dan tidak ada satu pun tempat yang bisa
 * dipandang lebih dulu. Karena itu halaman ini menyimpang dari kebiasaan
 * halaman lain dalam tiga hal:
 *
 *   **Sedikit angka, besar.** Enam angka nasional, bukan dua puluh. Yang
 *   tidak muat dalam enam angka bukan kabar untuk dinding, melainkan kabar
 *   untuk layar meja.
 *
 *   **Tidak ada yang bergerak sendiri.** Daftar peringatan di bawah tidak
 *   berjalan seperti teks berjalan. Daftar yang bergerak menuntut pembacanya
 *   menunggu giliran sebuah baris muncul kembali, dan orang yang sedang
 *   menerima telepon tidak bisa menunggu. Ia diam, terurut dari yang terberat,
 *   dan disegarkan bersama seluruh halaman.
 *
 *   **Waktu segar disebutkan.** Layar dinding adalah layar yang paling mudah
 *   dipercaya secara keliru: ia menyala sepanjang hari, dan tidak ada yang
 *   tahu kapan terakhir kali isinya berubah. Karena itu kepala halaman ini
 *   menyebut waktu terakhir data ditarik, apa adanya.
 */

import { kartu, keping, kosong, tombol, pesanSistem } from '../ui/komponen.js'
import { amankan, angka, jam, jarakWaktu, tanggalPanjang, tanggalIso, ringkas } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { KONFIG } from '../lib/konfig.js'
import { dasar, ringkasan, tingkatKerawanan, uptNaik, menungguTelaah, URGENSI_MENDESAK } from '../lib/hitung.js'
import { hitungEmber } from '../lib/sentimen.js'
import { belumTerpetakan } from '../lib/unit-terpetakan.js'
import { jalankanAturan } from '../lib/aturan.js'
import { susunNarasi, bentukDari } from '../lib/narasi.js'
import { BATAS, DARATAN } from '../lib/peta-indonesia.js'

const LEBAR = 900
const TINGGI = 380

export function halamanKomando({ keadaan, isi }) {
  const sekarang = new Date()
  const semua = keadaan.berita || []
  const dalam = dasar(semua)

  const rekap = ringkasan(dalam, sekarang)
  const ember = hitungEmber(dalam)
  const mendesak = dalam.filter((b) => URGENSI_MENDESAK.includes(b.urgensi))
  const antrean = dalam.filter(menungguTelaah)

  const { temuan } = jalankanAturan(semua, { sekarang })
  const kritis = temuan.filter((t) => t.tingkat === 'Kritis')

  const narasi = susunNarasi(semua, { sekarang }).slice(0, 5)

  /*
     Daftar unit diambil dari `uptNaik`, bukan dihitung ulang di sini.

     Angka pada baris ini muncul juga di Dasbor Eksekutif dan di laporan
     berkala. Menghitungnya sendiri — sekalipun dengan aturan yang tampak
     sama — adalah persis kelas kekeliruan yang dihapus lib/hitung.js, dan
     kekeliruan itu baru ketahuan ketika seseorang kebetulan membandingkan
     layar dinding dengan layar mejanya.
  */
  const unitPanas = uptNaik(dalam, {
    mulai: tanggalIso(new Date(sekarang.getTime() - 29 * 86_400_000)),
    selesai: tanggalIso(sekarang),
    maks: 8,
  })

  /* Baris per unit, untuk mewarnai batang dan titik peta dengan derajat
     kerawanan yang sama dengan yang dipakai Peta Sebaran. */
  const perUnit = new Map()
  for (const b of dalam) {
    if (belumTerpetakan(b.nama_upt)) continue
    if (!perUnit.has(b.nama_upt)) perUnit.set(b.nama_upt, [])
    perUnit.get(b.nama_upt).push(b)
  }

  const terbaru = dalam
    .map((b) => new Date(b.created_at || 0).getTime())
    .filter((t) => Number.isFinite(t) && t > 0)
    .sort((a, b) => b - a)[0]

  isi.innerHTML = `
    <div class="komando">
      <header class="komando-kop">
        <div class="komando-kop-kiri">
          <div class="komando-nama">${amankan(KONFIG.nama)} · Pusat Komando</div>
          <div class="komando-tanggal">${amankan(tanggalPanjang(sekarang))} · ${amankan(jam(sekarang))} WIB</div>
        </div>
        <div class="komando-kop-kanan">
          ${kritis.length
            ? `<span class="komando-status" data-nada="kritis">${ikon('peringatan')} ${angka(kritis.length)} temuan kritis</span>`
            : `<span class="komando-status" data-nada="positif">${ikon('centang')} Tidak ada temuan kritis</span>`}
          <span class="komando-segar" title="Baris paling baru di arsip yang termuat">
            data terakhir ${terbaru ? amankan(jarakWaktu(new Date(terbaru).toISOString())) : 'tidak diketahui'}
          </span>
        </div>
      </header>

      <div class="komando-angka">
        ${angkaBesar('Terbitan dipantau', rekap.total, 'aksen', 'seluruh arsip termuat')}
        ${angkaBesar('Negatif', ember.negatif, ember.negatif ? 'kritis' : 'positif', 'merugikan institusi')}
        ${angkaBesar('Mendesak', mendesak.length, mendesak.length ? 'tinggi' : 'positif', 'Tinggi dan Kritis')}
        ${angkaBesar('Menunggu telaah', antrean.length, antrean.length ? 'sedang' : 'positif', 'belum diputus analis')}
        ${angkaBesar('Temuan aturan', temuan.length, temuan.length ? 'sedang' : 'netral', 'menyala saat ini')}
        ${angkaBesar('Unit tersentuh', new Set(dalam.map((b) => b.nama_upt).filter((u) => !belumTerpetakan(u))).size,
          'netral', 'punya sekurangnya satu terbitan')}
      </div>

      <div class="komando-tata">
        <section class="komando-peta-kotak">
          <h2>Sebaran nasional</h2>
          <div id="komando-peta" class="komando-peta">
            <div class="rangka" style="height:${TINGGI}px"></div>
          </div>
          <div class="komando-legenda" id="komando-legenda"></div>
        </section>

        <section class="komando-sisi">
          <h2>Peringatan terberat</h2>
          ${temuan.length
            ? `<ol class="komando-tiker">
                ${temuan.slice(0, 8).map((t) => `
                  <li data-nada="${t.nada}">
                    <span class="komando-tiker-tingkat">${amankan(t.tingkat)}</span>
                    <span class="komando-tiker-judul">${amankan(ringkas(t.peristiwa.judul || 'Tanpa judul', 90))}</span>
                    <span class="komando-tiker-meta">
                      ${belumTerpetakan(t.peristiwa.nama_upt) ? 'unit belum terpetakan' : amankan(ringkas(t.peristiwa.nama_upt, 30))}
                      · ${angka(t.peristiwa.jumlah_media)} media
                      · ke ${amankan(t.eskalasi.label)}
                    </span>
                  </li>`).join('')}
              </ol>`
            : `<div class="komando-tenang">${ikon('centang')}
                 <div><b>Tidak ada aturan yang menyala.</b>
                 <div class="kecil-teks samar-teks">Bukan berarti tidak ada apa-apa — berarti tidak ada yang melewati ambang yang disetel.</div></div>
               </div>`}

          <h2>Narasi berjalan</h2>
          ${narasi.length
            ? `<ul class="komando-narasi">
                ${narasi.map((n) => {
                  const b = bentukDari(n.bentuk)
                  return `<li>
                    ${keping(b.label, b.nada)}
                    <span class="komando-narasi-teks">${amankan(ringkas(n.tema, 44))}</span>
                    <span class="komando-narasi-angka">${angka(n.jumlah_publikasi)}</span>
                  </li>`
                }).join('')}
              </ul>`
            : '<div class="samar-teks kecil-teks">Belum ada narasi pada jendela ini.</div>'}
        </section>
      </div>

      <section class="komando-bawah">
        <div>
          <h2>Unit paling banyak diberitakan</h2>
          ${unitPanas.length
            ? `<ol class="komando-unit">
                ${unitPanas.map((u) => {
                  const tingkat = tingkatKerawanan(perUnit.get(u.nama) || [])
                  return `<li>
                    <span class="komando-unit-nama">${amankan(ringkas(u.nama, 40))}</span>
                    <span class="komando-unit-batang">
                      <span style="width:${Math.round((u.jumlah / (unitPanas[0].jumlah || 1)) * 100)}%"
                            data-nada="${tingkat?.nada || 'rendah'}"></span>
                    </span>
                    <span class="komando-unit-angka" title="${angka(u.negatif)} di antaranya negatif">${angka(u.jumlah)}</span>
                  </li>`
                }).join('')}
              </ol>`
            : '<div class="samar-teks kecil-teks">Belum ada unit yang teridentifikasi pada arsip ini.</div>'}
        </div>

        <div>
          <h2>Terbitan 24 jam terakhir</h2>
          ${denyutJam(dalam, sekarang)}
        </div>
      </section>

      ${pesanSistem(
        'Layar ini tidak menyegarkan dirinya sendiri. Tekan Muat ulang di bilah atas, atau '
        + 'muat ulang halaman, untuk menarik data terbaru — waktu tarik terakhir disebutkan di kepala layar.',
        'netral', 'info')}
    </div>`

  /* Peta dimuat belakangan. Koordinat 531 unit tinggal di basis data (atau di
     berkas peragaan yang tidak kecil), dan menunggunya sebelum menggambar apa
     pun berarti layar dinding kosong selama beberapa detik pertama — persis
     saat seseorang berdiri di depannya menunggu jawaban. */
  gambarPeta(isi, perUnit, keadaan)

  return {
    judul: 'Pusat Komando',
    sub: `${angka(rekap.total)} terbitan · ${angka(mendesak.length)} mendesak · `
      + `${angka(temuan.length)} temuan aturan`,
  }
}

/* ------------------------------------------------------------------- angka */

function angkaBesar(label, nilai, nada, kaki) {
  return `
    <div class="komando-ubin" data-nada="${nada}">
      <span class="komando-ubin-label">${amankan(label)}</span>
      <span class="komando-ubin-nilai">${angka(nilai)}</span>
      <span class="komando-ubin-kaki">${amankan(kaki)}</span>
    </div>`
}

/* -------------------------------------------------------------------- peta */

/** Proyeksi silindris sederhana, sama dengan yang dipakai Peta Sebaran. */
function proyeksi(lon, lat) {
  const x = ((lon - BATAS.minLon) / (BATAS.maxLon - BATAS.minLon)) * LEBAR
  const y = ((BATAS.maxLat - lat) / (BATAS.maxLat - BATAS.minLat)) * TINGGI
  return { x, y }
}

/** Jalur daratan, dari derajat menjadi satuan gambar. */
function jalurDaratan() {
  return DARATAN.map((d) => d.replace(/(-?\d+(?:\.\d+)?)\s(-?\d+(?:\.\d+)?)/g, (_, lon, lat) => {
    const p = proyeksi(Number(lon), Number(lat))
    return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  })).join(' ')
}

async function gambarPeta(isi, perUnit, keadaan) {
  const wadah = isi.querySelector('#komando-peta')
  const legenda = isi.querySelector('#komando-legenda')
  if (!wadah) return

  let unit = []
  try {
    if (keadaan.demo) {
      const { UNIT_CONTOH } = await import('../lib/peta-upt-contoh.js')
      unit = UNIT_CONTOH.map((u) => ({ nama: u[0], lat: u[5], lon: u[6] }))
    } else {
      const { ambil } = await import('../lib/api.js')
      const baris = await ambil('upt', {
        select: 'nama_upt,latitude,longitude',
        limit: 700,
      })
      unit = (baris || [])
        .filter((u) => u.latitude != null && u.longitude != null)
        .map((u) => ({ nama: u.nama_upt, lat: Number(u.latitude), lon: Number(u.longitude) }))
    }
  } catch {
    // Peta yang gagal dimuat tidak boleh menjatuhkan seluruh layar dinding.
    // Angka nasional di atasnya tetap benar tanpa satu titik pun tergambar.
    wadah.innerHTML = `<div class="komando-peta-gagal">${ikon('peta')}
      <div>Koordinat unit gagal dimuat. Angka di layar ini tidak terpengaruh.</div></div>`
    return
  }

  const titik = unit
    .filter((u) => Number.isFinite(u.lat) && Number.isFinite(u.lon))
    .map((u) => {
      const isiUnit = perUnit.get(u.nama) || []
      const tingkat = isiUnit.length ? tingkatKerawanan(isiUnit) : null
      const p = proyeksi(u.lon, u.lat)
      return { ...u, ...p, jumlah: isiUnit.length, tingkat }
    })

  const bersuara = titik.filter((t) => t.jumlah > 0)
  const maks = Math.max(...bersuara.map((t) => t.jumlah), 1)

  wadah.innerHTML = `
    <svg class="komando-peta-svg" viewBox="0 0 ${LEBAR} ${TINGGI}" role="img"
         aria-label="Peta Indonesia dengan ${angka(bersuara.length)} unit yang punya pemberitaan">
      <path class="komando-daratan" d="${jalurDaratan()}"/>
      <g class="komando-titik-sepi">
        ${titik.filter((t) => !t.jumlah).map((t) => `
          <circle cx="${t.x.toFixed(1)}" cy="${t.y.toFixed(1)}" r="1.4"/>`).join('')}
      </g>
      <g class="komando-titik">
        ${bersuara
          .sort((a, b) => a.jumlah - b.jumlah)
          .map((t) => `
            <circle cx="${t.x.toFixed(1)}" cy="${t.y.toFixed(1)}"
                    r="${(2.6 + Math.sqrt(t.jumlah / maks) * 9).toFixed(1)}"
                    data-nada="${t.tingkat?.nada || 'rendah'}">
              <title>${amankan(`${t.nama}: ${t.jumlah} terbitan`)}</title>
            </circle>`).join('')}
      </g>
    </svg>`

  if (legenda) {
    legenda.innerHTML = `
      <span class="mini-teks samar-teks">
        ${angka(bersuara.length)} dari ${angka(titik.length)} unit punya pemberitaan pada arsip yang termuat.
        Titik kecil kelabu adalah unit yang tenang — digambar supaya sebaran yang sepi tidak
        terbaca sebagai sebaran yang belum terpetakan.
      </span>`
  }
}

/* ------------------------------------------------------------------ denyut */

/**
 * Terbitan per jam selama 24 jam terakhir.
 *
 * Batang, bukan garis: pada jarak tiga meter, garis setipis satu piksel hilang
 * sama sekali, dan yang tersisa hanya bentuk umumnya — padahal yang dicari
 * justru satu batang yang jauh lebih tinggi daripada tetangganya.
 */
function denyutJam(dalam, sekarang) {
  const ember = Array.from({ length: 24 }, () => 0)
  const batasBawah = sekarang.getTime() - 24 * 3_600_000

  for (const b of dalam) {
    const t = new Date(b.created_at || b.tanggal_publikasi || 0).getTime()
    if (!Number.isFinite(t) || t < batasBawah || t > sekarang.getTime()) continue
    const mundur = Math.floor((sekarang.getTime() - t) / 3_600_000)
    const kotak = 23 - Math.min(23, mundur)
    ember[kotak] += 1
  }

  const maks = Math.max(...ember, 1)
  const total = ember.reduce((a, b) => a + b, 0)

  if (!total) {
    return `<div class="samar-teks kecil-teks">Tidak ada terbitan baru dalam 24 jam terakhir pada arsip yang termuat.</div>`
  }

  return `
    <div class="komando-denyut" role="img"
         aria-label="Terbitan per jam selama 24 jam terakhir, total ${angka(total)}">
      ${ember.map((n, i) => `
        <span class="komando-denyut-batang" title="${23 - i} jam lalu: ${angka(n)} terbitan">
          <span style="height:${Math.max(2, Math.round((n / maks) * 100))}%"></span>
        </span>`).join('')}
    </div>
    <div class="mini-teks samar-teks">${angka(total)} terbitan · puncak ${angka(maks)} dalam satu jam</div>`
}
