/**
 * Profil Media — tab di Analisis Pemberitaan.
 *
 * Menjawab "media mana yang paling sering memberitakan kita, dengan nada apa,
 * dan siapa yang sedang naik". Semuanya dihitung dari arsip yang sudah termuat
 * (lib/profil-media.js); angka di sini harus cocok dengan Tren untuk himpunan
 * berita yang sama.
 *
 * Halaman ini tidak menilai media. Ia melaporkan apa yang tercatat, dan
 * menyebutkan di layar bahwa nada negatif adalah penilaian mesin atas judul
 * dan isi berita, bukan sikap redaksi.
 */

import { kartu, keping, kosong, ubin, bidangCari, pilihan } from '../ui/komponen.js'
import { amankan, angka, persen, jarakWaktu } from '../lib/format.js'
import {
  susunProfilMedia, rataNegatifArsip, MINIMAL_UNTUK_NADA, JENDELA_HARI,
} from '../lib/profil-media.js'

const saring = { cari: '', urut: 'Terbanyak', terpilih: null }
const URUTAN = {
  Terbanyak: (a, b) => b.jumlah - a.jumlah,
  'Paling negatif': (a, b) => (b.cukup - a.cukup) || (b.bagianNegatif - a.bagianNegatif) || (b.jumlah - a.jumlah),
  'Paling mendesak': (a, b) => b.mendesak - a.mendesak || b.jumlah - a.jumlah,
  Terbaru: (a, b) => b.terakhir - a.terakhir,
}

const LABEL_ARAH = { naik: 'Naik', turun: 'Turun', tetap: 'Tetap', diam: '—' }
const NADA_ARAH = { naik: 'tinggi', turun: 'positif', tetap: 'sedang', diam: 'sedang' }

function persenNegatif(p) {
  return p.cukup ? persen(p.negatif, p.jumlah, 0) : `terlalu sedikit (<${MINIMAL_UNTUK_NADA})`
}

export function halamanProfilMedia({ keadaan, isi }) {
  const sekarang = new Date()
  const semua = susunProfilMedia(keadaan.berita || [], sekarang)
  const rata = rataNegatifArsip(semua)

  function gambar() {
    const kata = saring.cari.trim().toLowerCase()
    const daftar = semua
      .filter((p) => !kata || p.media.toLowerCase().includes(kata))
      .sort(URUTAN[saring.urut] || URUTAN.Terbanyak)
    const pilih = saring.terpilih ? semua.find((p) => p.media === saring.terpilih) : null
    const naik = semua.filter((p) => p.arah === 'naik')

    isi.innerHTML = `
      <div class="tumpuk">
        <div class="kisi kisi-4">
          ${ubin({ label: 'Media tercatat', nilai: semua.length, kaki: 'dari arsip yang termuat' })}
          ${ubin({ label: 'Nada negatif keseluruhan', nilai: persen(rata * 1000, 1000, 0), kaki: 'rata-rata seluruh arsip' })}
          ${ubin({ label: 'Sedang naik', nilai: naik.length, nada: naik.length ? 'tinggi' : 'positif',
            kaki: `${JENDELA_HARI} hari terakhir vs ${JENDELA_HARI} hari sebelumnya` })}
          ${ubin({ label: 'Cukup data', nilai: semua.filter((p) => p.cukup).length,
            kaki: `sedikitnya ${MINIMAL_UNTUK_NADA} berita` })}
        </div>

        ${pilih ? kartu({
          judul: pilih.media,
          ket: `${angka(pilih.jumlah)} berita · terakhir ${pilih.terakhir ? jarakWaktu(new Date(pilih.terakhir).toISOString()) : '—'}`,
          aksi: '<button class="tbl kecil" data-aksi="tutup-media">Tutup</button>',
          isi: `
            <div class="kisi kisi-4">
              ${ubin({ label: 'Negatif', nilai: pilih.negatif, nada: pilih.negatif ? 'tinggi' : 'positif', kaki: persenNegatif(pilih) })}
              ${ubin({ label: 'Netral / campuran', nilai: pilih.netral, kaki: 'dinilai mesin' })}
              ${ubin({ label: 'Positif', nilai: pilih.positif, nada: 'positif', kaki: 'dinilai mesin' })}
              ${ubin({ label: 'Mendesak', nilai: pilih.mendesak, nada: pilih.mendesak ? 'kritis' : 'positif', kaki: `${angka(pilih.kritis)} kritis` })}
            </div>
            <p class="mini-teks" style="margin-top:12px"><b>Unit yang paling sering disorot:</b>
              ${pilih.unitTeratas.length
                ? pilih.unitTeratas.map(([u, n]) => `${amankan(u)} (${angka(n)})`).join('; ')
                : 'belum ada berita yang terpetakan ke unit'}</p>
            <p class="mini-teks samar-teks">${JENDELA_HARI} hari terakhir: ${angka(pilih.terbaru)} berita; ${JENDELA_HARI} hari sebelumnya: ${angka(pilih.sebelumnya)}.</p>`,
        }) : ''}

        ${kartu({
          judul: 'Daftar media',
          ket: 'Klik sebuah baris untuk melihat rinciannya.',
          aksi: `
            ${bidangCari(saring.cari, 'Cari media')}
            ${pilihan({ nama: 'urut', nilai: saring.urut, label: 'Urutkan', opsi: Object.keys(URUTAN) })}`,
          rapat: true,
          isi: daftar.length ? `
            <div class="tabel-bungkus">
              <table class="tabel">
                <thead><tr><th>Media</th><th>Berita</th><th>Negatif</th><th>Mendesak</th><th>Arah</th><th>Terakhir</th></tr></thead>
                <tbody>
                  ${daftar.slice(0, 100).map((p) => `
                    <tr data-media="${amankan(p.media)}" tabindex="0" style="cursor:pointer">
                      <td><b>${amankan(p.media)}</b></td>
                      <td>${angka(p.jumlah)}</td>
                      <td>${amankan(String(persenNegatif(p)))}${p.selisihRata != null && Math.abs(p.selisihRata) >= 0.15
                        ? ` ${keping(p.selisihRata > 0 ? 'di atas rata-rata' : 'di bawah rata-rata', p.selisihRata > 0 ? 'tinggi' : 'positif', true)}` : ''}</td>
                      <td>${angka(p.mendesak)}</td>
                      <td>${keping(LABEL_ARAH[p.arah], NADA_ARAH[p.arah], true)}</td>
                      <td class="kecil">${p.terakhir ? amankan(jarakWaktu(new Date(p.terakhir).toISOString())) : '—'}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
            ${daftar.length > 100 ? `<div class="mini-teks samar-teks" style="padding:10px 14px">Menampilkan 100 dari ${angka(daftar.length)} media.</div>` : ''}`
            : `<div style="padding:18px">${kosong('Tidak ada media yang cocok', semua.length ? 'Ubah kata pencarian.' : 'Arsip yang termuat belum mencantumkan nama media.')}</div>`,
        })}

        <div class="mini-teks samar-teks">
          Nada negatif adalah penilaian mesin atas berita, bukan sikap redaksi media itu. Persentase hanya ditampilkan untuk media dengan sedikitnya ${MINIMAL_UNTUK_NADA} berita; di bawah itu angkanya terlalu mudah berubah.
        </div>
      </div>`
  }

  isi.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-aksi="tutup-media"]')) { saring.terpilih = null; gambar(); return }
    const baris = ev.target.closest('tr[data-media]')
    if (baris) { saring.terpilih = baris.dataset.media; gambar(); isi.scrollIntoView?.({ block: 'start' }) }
  })
  isi.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return
    const baris = ev.target.closest?.('tr[data-media]')
    if (baris) { saring.terpilih = baris.dataset.media; gambar() }
  })
  isi.addEventListener('change', (ev) => {
    if (ev.target.dataset.saring === 'urut') { saring.urut = ev.target.value; gambar() }
  })
  isi.addEventListener('input', (ev) => {
    if (ev.target.dataset.peran === 'cari') {
      saring.cari = ev.target.value
      const posisi = ev.target.selectionStart
      gambar()
      const kotak = isi.querySelector('[data-peran="cari"]')
      if (kotak) { kotak.focus(); kotak.setSelectionRange(posisi, posisi) }
    }
  })

  gambar()
  return {
    judul: 'Profil Media',
    sub: 'Siapa yang memberitakan kita, dengan nada apa, dan siapa yang sedang naik',
  }
}
