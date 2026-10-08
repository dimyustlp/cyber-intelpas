/**
 * Deteksi Lonjakan.
 *
 * Peringatan Dini menilai berita satu per satu. Halaman ini menilai pola:
 * sebuah unit yang mendadak diberitakan buruk berkali-kali dalam sehari, dan
 * sebuah isu yang diangkat banyak media sekaligus. Keduanya sering lolos dari
 * penilaian per berita, sebab tidak satu pun beritanya cukup buruk untuk
 * berdiri sendiri.
 *
 * Mesinnya berjalan di peladen tiap jam; halaman ini hanya membaca hasilnya.
 * Ambangnya ditulis di layar, bukan hanya di kode — orang yang melihat sebuah
 * unit ditandai berhak tahu persis apa yang membuatnya ditandai.
 */

import { kartu, keping, kosong, tombol, ubin } from '../ui/komponen.js'
import { amankan, angka, tanggalJam, jarakWaktu } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { pesanRamah } from '../lib/api.js'
import {
  AMBANG, muatLonjakan, aktifSekarang, contohArtikel, dalamJam, lonjakanPeragaan,
} from '../lib/lonjakan.js'

const status = { dimuat: false, galat: null, data: null }

function daftarContoh(contoh) {
  const baris = contohArtikel(contoh)
  if (!baris.length) return ''
  return `
    <ul class="mini-teks" style="margin:6px 0 0;padding-left:16px">
      ${baris.map((c) => `
        <li>
          ${c.link
            ? `<a href="${amankan(c.link)}" target="_blank" rel="noopener noreferrer">${amankan(c.judul)}</a>`
            : amankan(c.judul)}
          ${c.media ? `<span class="samar-teks"> · ${amankan(c.media)}</span>` : ''}
        </li>`).join('')}
    </ul>`
}

function butirLonjakan(l) {
  const aktif = dalamJam(l.terdeteksi)
  return `
    <li class="siklus-butir">
      <div class="siklus-butir-kop">
        <b>${amankan(l.subjek)}</b>
        ${keping(`${angka(l.jumlah_24j)} berita negatif / 24 jam`, aktif ? 'kritis' : 'sedang', true)}
        ${keping(`${String(Number(l.lipat || 0).toFixed(1)).replace('.', ',')}× rata-rata`, 'tinggi', true)}
        <span class="mini-teks samar-teks dorong">${amankan(jarakWaktu(l.terdeteksi))}</span>
      </div>
      <span class="mini-teks samar-teks">
        Rata-rata harian ${amankan(String(Number(l.rata_harian || 0).toFixed(1)).replace('.', ','))}
        · simpangan ${amankan(String(Number(l.simpangan || 0).toFixed(1)).replace('.', ','))}
        · terdeteksi ${amankan(tanggalJam(l.terdeteksi))}
      </span>
      ${daftarContoh(l.contoh)}
    </li>`
}

function butirIsu(i) {
  const aktif = dalamJam(i.terakhir)
  return `
    <li class="siklus-butir">
      <div class="siklus-butir-kop">
        <b>${amankan(i.judul)}</b>
        ${keping(`${angka(i.artikel)} artikel · ${angka(i.media)} media`, aktif ? 'kritis' : 'sedang', true)}
        ${keping(`${angka(i.negatif)} negatif`, 'tinggi', true)}
        <span class="mini-teks samar-teks dorong">bergerak ${amankan(jarakWaktu(i.terakhir))}</span>
      </div>
      <span class="mini-teks samar-teks">
        Mulai ${amankan(tanggalJam(i.mulai))} · terdeteksi ${amankan(tanggalJam(i.terdeteksi))}
      </span>
      ${daftarContoh(i.contoh)}
    </li>`
}

export function halamanDeteksiLonjakan({ keadaan, isi }) {
  function gambar() {
    if (status.galat) {
      isi.innerHTML = kartu({
        isi: `<div class="pesan" data-nada="kritis">${ikon('peringatan')}
          <div><b>Data lonjakan gagal dibaca.</b> ${amankan(status.galat)}</div></div>`,
      })
      return
    }
    if (!status.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:320px"></div>' })
      return
    }

    const { data } = status
    const aktif = aktifSekarang(data)
    const lonjakanLama = data.lonjakan.filter((l) => !dalamJam(l.terdeteksi))
    const isuLama = data.isu.filter((i) => !dalamJam(i.terakhir))

    isi.innerHTML = `
      <div class="tumpuk">
        ${data.galatLonjakan || data.galatIsu ? `
          <div class="pesan" data-nada="kritis">${ikon('peringatan')}
            <div><b>Sebagian data tidak terbaca.</b>
              ${amankan(pesanRamah(data.galatLonjakan || data.galatIsu))}</div></div>` : ''}

        <div class="kisi kisi-3">
          ${ubin({ label: 'Unit melonjak', nilai: aktif.lonjakan.length,
            nada: aktif.lonjakan.length ? 'kritis' : 'positif', kaki: '24 jam terakhir' })}
          ${ubin({ label: 'Isu lintas media', nilai: aktif.isu.length,
            nada: aktif.isu.length ? 'tinggi' : 'positif', kaki: 'masih bergerak dalam 24 jam' })}
          ${ubin({ label: 'Pembacaan terakhir', nilai: jarakWaktu(data.dimuatPada),
            kaki: 'mesin berjalan tiap jam' })}
        </div>

        ${kartu({
          judul: 'Unit yang melonjak',
          ket: 'Berita negatif per unit yang naik tajam dibanding kebiasaannya sendiri.',
          aksi: tombol({ label: 'Buka Situation Room', ikon: 'dasbor', kecil: true, halaman: 'situation-room' }),
          isi: aktif.lonjakan.length
            ? `<ul class="siklus-daftar">${aktif.lonjakan.map(butirLonjakan).join('')}</ul>`
            : kosong('Tidak ada unit yang melonjak',
              'Tidak ada unit yang melewati ambang dalam 24 jam terakhir. Itu kabar tentang ambangnya, bukan jaminan bahwa tidak ada yang perlu dibaca.'),
        })}

        ${kartu({
          judul: 'Isu lintas media',
          ket: 'Satu peristiwa yang diangkat banyak media berbeda.',
          isi: aktif.isu.length
            ? `<ul class="siklus-daftar">${aktif.isu.map(butirIsu).join('')}</ul>`
            : kosong('Tidak ada isu lintas media', 'Belum ada isu yang memenuhi ambang dalam 24 jam terakhir.'),
        })}

        ${lonjakanLama.length || isuLama.length ? kartu({
          judul: 'Sebelumnya',
          ket: 'Yang sudah lewat dari 24 jam. Disimpan untuk dibandingkan.',
          isi: `<ul class="siklus-daftar">
            ${lonjakanLama.slice(0, 10).map(butirLonjakan).join('')}
            ${isuLama.slice(0, 10).map(butirIsu).join('')}
          </ul>`,
        }) : ''}

        ${kartu({
          judul: 'Cara mesin menilai',
          isi: `
            <p class="mini-teks"><b>Unit.</b> ${amankan(AMBANG.lonjakan)}</p>
            <p class="mini-teks"><b>Isu.</b> ${amankan(AMBANG.isu)}</p>
            <p class="mini-teks samar-teks">Setiap penandaan juga dikirim ke Telegram pemilik sistem.</p>`,
        })}
      </div>`
  }

  gambar()

  const tarik = keadaan.demo ? Promise.resolve(lonjakanPeragaan()) : muatLonjakan()
  tarik
    .then((data) => { status.data = data; status.dimuat = true; status.galat = null; gambar() })
    .catch((galat) => { status.galat = pesanRamah(galat); gambar() })

  return {
    judul: 'Deteksi Lonjakan',
    sub: 'Unit yang mendadak diberitakan buruk, dan isu yang diangkat banyak media sekaligus',
  }
}
