/**
 * Analisis Kaitan.
 *
 * Tiga pertanyaan yang tidak bisa dijawab tabel, dan ketiganya ditanyakan
 * setiap pekan di ruang analis:
 *
 *   Media mana saja yang mengangkat unit ini, dan apa lagi yang mereka angkat?
 *   Tema apa yang muncul di banyak unit sekaligus?
 *   Siapa yang menjembatani dua kelompok yang tampaknya tidak berhubungan?
 *
 * Gambarnya dibaca begini: **tebal garis = berapa kali dua hal muncul di
 * publikasi yang sama; besar simpul = berapa publikasi menyebutnya.** Tidak
 * ada arti lain yang disembunyikan di dalam warna atau jarak.
 *
 * ## Tanpa fokus, gambar ini tidak berarti
 *
 * Arsip nasional menghasilkan ribuan simpul, dan seribu simpul yang saling
 * bertaut adalah gambar yang benar dan tidak terbaca. Karena itu halaman ini
 * membuka dengan simpul terbesar sebagai pusat, dan setiap simpul bisa
 * dijadikan pusat berikutnya sekali tekan. Yang dicari analis bukan
 * keseluruhan jaring, melainkan lingkungan satu hal.
 *
 * ## Yang tidak ada di sini
 *
 * Simpul orang. Sampai kewenangan pengumpulan data akun perorangan dinyatakan
 * hitam di atas putih, jaringan ini hanya berisi lembaga, media, wilayah,
 * tema, dan platform — dan itu ditegakkan `lib/jaringan.js`, bukan oleh
 * halaman ini.
 */

import { kartu, keping, kosong, tombol, pesanSistem } from '../ui/komponen.js'
import { amankan, angka, ringkas } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { sebagaiKueri } from '../lib/kueri.js'
import {
  JENIS_SIMPUL, jenisSimpul, susunJaringan, penjembatan, tataLingkar,
} from '../lib/jaringan.js'

const pengaturan = {
  fokus: null,
  kedalaman: 1,
  maksSimpul: 40,
  minBobot: 1,
  jenisAktif: JENIS_SIMPUL.map((j) => j.kode),
}

const LEBAR = 760
const TINGGI = 520

export function halamanJaringan({ keadaan, isi }) {
  const berita = keadaan.berita || []

  /*
     Fokus bawaan: UNIT terbesar, bukan simpul terbesar.

     Gambar tanpa pusat pada arsip nasional benar dan tidak terbaca, jadi harus
     ada pusat bawaan. Simpul terbesar hampir selalu sebuah platform — "Google
     News" menyentuh seperempat arsip — dan lingkungan sebuah platform tidak
     menerangkan apa pun: semua ada di dalamnya. Analis membaca jaringan ini
     untuk bertanya tentang sebuah unit, jadi unit yang paling banyak
     diberitakan adalah layar pertama yang paling mungkin benar. Kalau tidak
     ada satu unit pun yang teridentifikasi, barulah simpul terbesar dipakai.
  */
  if (!pengaturan.fokus) {
    const awal = susunJaringan(berita, { maksSimpul: 200, jenisAktif: pengaturan.jenisAktif })
    const unitTerbesar = awal.simpul.find((s) => s.jenis === 'unit')
    pengaturan.fokus = (unitTerbesar || awal.simpul[0])?.id || null
  }

  const jaringan = susunJaringan(berita, { ...pengaturan })
  const tata = tataLingkar(jaringan, { lebar: LEBAR, tinggi: TINGGI })
  const jembatan = penjembatan(jaringan, 6)
  const pusat = jaringan.simpul.find((s) => s.id === jaringan.fokus)

  /* Daftar simpul yang bisa dijadikan pusat, dihitung dari seluruh arsip —
     bukan dari gambar yang sedang tampil. Yang sedang tampil sudah dipangkas,
     dan memilih pusat dari daftar yang sudah dipangkas berarti tidak bisa
     berpindah ke luar lingkungan yang sedang dilihat. */
  const semuaSimpul = susunJaringan(berita, {
    maksSimpul: 200, jenisAktif: pengaturan.jenisAktif,
  }).simpul

  isi.innerHTML = `
    <div class="tumpuk">
      ${kartu({
        rapat: true,
        isi: `
          <div class="bilah-alat">
            <label class="cari" style="min-width:280px">
              ${ikon('cari')}
              <select class="masukan" data-atur="fokus" aria-label="Simpul yang dijadikan pusat">
                ${semuaSimpul.map((s) => `
                  <option value="${amankan(s.id)}"${s.id === jaringan.fokus ? ' selected' : ''}>
                    ${amankan(jenisSimpul(s.jenis).label)} · ${amankan(ringkas(s.nama, 46))} (${angka(s.bobot)})
                  </option>`).join('')}
              </select>
            </label>

            <select class="pilihan" data-atur="kedalaman" aria-label="Kedalaman jangkauan">
              <option value="1"${pengaturan.kedalaman === 1 ? ' selected' : ''}>Tetangga langsung</option>
              <option value="2"${pengaturan.kedalaman === 2 ? ' selected' : ''}>Sampai dua langkah</option>
            </select>

            <select class="pilihan" data-atur="maksSimpul" aria-label="Batas jumlah simpul">
              ${[20, 40, 60, 100].map((n) => `
                <option value="${n}"${pengaturan.maksSimpul === n ? ' selected' : ''}>maks ${n} simpul</option>`).join('')}
            </select>

            <select class="pilihan" data-atur="minBobot" aria-label="Ambang tebal garis">
              ${[1, 2, 3, 5].map((n) => `
                <option value="${n}"${pengaturan.minBobot === n ? ' selected' : ''}>garis ≥ ${n}</option>`).join('')}
            </select>

            <div class="dorong baris gap-6">
              ${JENIS_SIMPUL.map((j) => `
                <label class="centang-baris mini-teks" title="Tampilkan simpul ${amankan(j.label)}">
                  <input type="checkbox" data-jenis="${amankan(j.kode)}"
                         ${pengaturan.jenisAktif.includes(j.kode) ? 'checked' : ''}>
                  <span>${amankan(j.label)}</span>
                </label>`).join('')}
            </div>
          </div>`,
      })}

      <div class="kisi kisi-utama-samping">
        ${kartu({
          judul: pusat ? `Lingkungan ${jenisSimpul(pusat.jenis).label.toLowerCase()}: ${pusat.nama}` : 'Jaringan kaitan',
          ket: `${angka(jaringan.simpul.length)} simpul · ${angka(jaringan.sisi.length)} kaitan`
            + (jaringan.terpangkas ? ` · ${angka(jaringan.terpangkas)} simpul lain tidak digambar` : ''),
          rapat: true,
          isi: jaringan.simpul.length
            ? gambarJaringan(jaringan, tata)
            : kosong('Belum ada yang bisa dikaitkan',
                'Arsip yang termuat belum memuat cukup publikasi untuk membentuk kaitan.'),
        })}

        <div class="tumpuk">
          ${kartu({
            judul: 'Yang paling menjembatani',
            ket: 'Diukur dari keragaman JENIS tetangganya, bukan dari jumlah tetangganya. '
              + 'Media yang menyentuh sepuluh unit di lima wilayah lebih layak diperhatikan '
              + 'daripada media yang menyentuh sepuluh unit di satu wilayah.',
            isi: jembatan.length
              ? `<ul class="jaring-daftar">
                  ${jembatan.map((s) => `
                    <li>
                      <button data-aksi="jadikan-pusat" data-id="${amankan(s.id)}"
                              title="Jadikan simpul ini pusat gambar">
                        <span class="jaring-jenis" data-nada="${jenisSimpul(s.jenis).nada}">${amankan(jenisSimpul(s.jenis).label)}</span>
                        <span class="jaring-nama">${amankan(ringkas(s.nama, 34))}</span>
                      </button>
                      <span class="jaring-angka" title="${angka(s.derajat)} kaitan, ${angka(s.ragamJenis)} jenis tetangga">
                        ${angka(s.derajat)}·${angka(s.ragamJenis)}
                      </span>
                    </li>`).join('')}
                </ul>`
              : '<span class="samar-teks kecil-teks">Belum ada simpul yang menjembatani lebih dari satu jenis.</span>',
          })}

          ${pusat ? kartu({
            judul: 'Pusat yang sedang dilihat',
            isi: `
              <dl class="narasi-angka">
                <div><dt>Publikasi</dt><dd>${angka(pusat.bobot)}</dd></div>
                <div><dt>Negatif</dt><dd>${angka(pusat.negatif)}</dd></div>
                <div><dt>Mendesak</dt><dd>${angka(pusat.mendesak)}</dd></div>
                <div><dt>Kaitan</dt><dd>${angka(pusat.derajat)}</dd></div>
              </dl>
              <div class="baris gap-6" style="margin-top:10px">
                <button class="tbl kecil" data-aksi="buka-kueri"
                        data-kueri="${amankan(sebagaiKueri(jenisSimpul(pusat.jenis).bidang, pusat.nama))}">
                  ${ikon('cari')} Buka daftarnya
                </button>
              </div>`,
          }) : ''}

          ${kartu({
            judul: 'Membaca gambar ini',
            isi: `
              <ul class="jaring-legenda">
                ${JENIS_SIMPUL.map((j) => `
                  <li><span class="jaring-bulat" data-nada="${j.nada}"></span>${amankan(j.label)}</li>`).join('')}
              </ul>
              <p class="kecil-teks samar-teks" style="margin-top:8px">
                Tebal garis adalah berapa kali dua hal muncul di publikasi yang sama.
                Besar bulatan adalah berapa publikasi menyebutnya. Letaknya melingkar dan
                tetap — masukan yang sama selalu menghasilkan gambar yang sama, supaya yang
                terlihat berubah adalah datanya, bukan gambarnya.
              </p>`,
          })}
        </div>
      </div>

      ${pesanSistem(
        'Jaringan ini hanya memuat lembaga, media, wilayah, tema, dan platform. Tidak ada '
        + 'simpul orang, dan tidak ada satu pun pengenal perorangan yang disimpan — '
        + 'menambahkannya menuntut dasar kewenangan, bukan menuntut kode.',
        'netral', 'gembok')}
    </div>`

  /* --------------------------------------------------------------- penyimak */

  const gambarUlang = () => isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))

  for (const el of isi.querySelectorAll('[data-atur]')) {
    el.addEventListener('change', () => {
      const kunci = el.dataset.atur
      pengaturan[kunci] = kunci === 'fokus' ? el.value : Number(el.value)
      gambarUlang()
    })
  }

  for (const el of isi.querySelectorAll('[data-jenis]')) {
    el.addEventListener('change', () => {
      const kode = el.dataset.jenis
      const berikut = el.checked
        ? [...new Set([...pengaturan.jenisAktif, kode])]
        : pengaturan.jenisAktif.filter((j) => j !== kode)
      // Mematikan seluruh jenis menghasilkan gambar kosong tanpa satu pun cara
      // menghidupkannya kembali selain memuat ulang halaman.
      if (!berikut.length) { el.checked = true; return }
      pengaturan.jenisAktif = berikut
      if (pengaturan.fokus && !berikut.includes(pengaturan.fokus.split(':')[0])) pengaturan.fokus = null
      gambarUlang()
    })
  }

  isi.addEventListener('click', (ev) => {
    const simpul = ev.target.closest('[data-aksi]')
    const aksi = simpul?.dataset.aksi
    if (!aksi) return

    if (aksi === 'jadikan-pusat') {
      pengaturan.fokus = simpul.dataset.id
      gambarUlang()
    } else if (aksi === 'buka-kueri') {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'cari', saring: { kueri: simpul.dataset.kueri } },
      }))
    }
  })

  return {
    judul: 'Analisis Kaitan',
    sub: pusat
      ? `Pusat: ${pusat.nama} · ${angka(jaringan.simpul.length)} simpul tergambar`
      : `${angka(jaringan.total.simpul)} simpul dalam arsip`,
  }
}

/* ------------------------------------------------------------------ gambar */

function gambarJaringan(jaringan, tata) {
  const bobotMaks = Math.max(...jaringan.simpul.map((s) => s.bobot), 1)
  const sisiMaks = Math.max(...jaringan.sisi.map((e) => e.bobot), 1)

  const garis = jaringan.sisi.map((e) => {
    const a = tata.letak.get(e.dari)
    const z = tata.letak.get(e.ke)
    if (!a || !z) return ''
    const tebal = 0.6 + (e.bobot / sisiMaks) * 3.2
    const buram = 0.18 + (e.bobot / sisiMaks) * 0.42
    return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}"
      x2="${z.x.toFixed(1)}" y2="${z.y.toFixed(1)}"
      stroke-width="${tebal.toFixed(2)}" opacity="${buram.toFixed(2)}"
      class="jaring-garis${e.negatif ? ' negatif' : ''}"><title>${amankan(
        `${e.dari.split(':').slice(1).join(':')} — ${e.ke.split(':').slice(1).join(':')}: ${e.bobot} publikasi bersama`,
      )}</title></line>`
  }).join('')

  const bulat = jaringan.simpul.map((s) => {
    const p = tata.letak.get(s.id)
    if (!p) return ''
    const j = jenisSimpul(s.jenis)
    // Jari-jari mengikuti akar bobotnya, bukan bobotnya. Tanpa akar, satu
    // simpul berbobot 300 di antara simpul berbobot 3 menjadi lingkaran yang
    // menutupi separuh gambar.
    const jari = 4 + Math.sqrt(s.bobot / bobotMaks) * 13
    const pusat = s.id === jaringan.fokus

    return `
      <g class="jaring-simpul${pusat ? ' pusat' : ''}" data-aksi="jadikan-pusat" data-id="${amankan(s.id)}"
         tabindex="0" role="button"
         aria-label="${amankan(`${j.label} ${s.nama}, ${s.bobot} publikasi, ${s.derajat} kaitan`)}">
        <title>${amankan(`${j.label}: ${s.nama}\n${s.bobot} publikasi · ${s.negatif} negatif · ${s.derajat} kaitan`)}</title>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${jari.toFixed(1)}"
                data-nada="${j.nada}"/>
        ${pusat || jari > 9 ? `
          <text x="${p.x.toFixed(1)}" y="${(p.y + jari + 11).toFixed(1)}" text-anchor="middle"
                class="jaring-label">${amankan(ringkas(s.nama, 22))}</text>` : ''}
      </g>`
  }).join('')

  return `
    <div class="jaring-bungkus">
      <svg class="jaring-svg" viewBox="0 0 ${LEBAR} ${TINGGI}" role="img"
           aria-label="Jaringan kaitan antara unit, media, tema, wilayah, dan platform">
        <g class="jaring-garis-lapis">${garis}</g>
        <g class="jaring-simpul-lapis">${bulat}</g>
      </svg>
    </div>`
}
