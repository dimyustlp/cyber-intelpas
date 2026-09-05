/**
 * Ruang Analis.
 *
 * Layar pertama seorang analis di pagi hari, dan satu-satunya halaman yang
 * menjawab pertanyaan "apa yang jadi bagian saya hari ini". Seluruh halaman
 * lain menjawab pertanyaan tentang arsip; halaman ini menjawab pertanyaan
 * tentang PEKERJAAN.
 *
 * Empat bagian, berurut menurut apa yang menuntut lebih dulu:
 *
 *   1. **Yang menuntut hari ini** — antrean telaah, pantauan yang menyala,
 *      dan temuan aturan. Angka, dan tiap angka membuka daftarnya.
 *   2. **Pantauan** — pencarian tersimpan dan daftar pantau, terurut dari
 *      yang menyala. Inilah bagian yang membedakan halaman ini dari dasbor:
 *      isinya ditentukan analisnya sendiri, bukan ditentukan sistem.
 *   3. **Temuan aturan** — apa yang dinyalakan mesin aturan, lengkap dengan
 *      alasannya dan kepada siapa ia pantas dinaikkan.
 *   4. **Yang baru saya putuskan** — riwayat pendek, supaya sebuah putusan
 *      yang keliru masih bisa ditemukan kembali pada hari yang sama.
 *
 * ## Sebuah catatan yang harus tetap ada di layar
 *
 * Pantauan tinggal di peramban ini, bukan di basis data. Ia tidak berpindah ke
 * komputer lain dan tidak dibagi ke rekan setim. Itu batas nyata, dan halaman
 * yang menyembunyikannya akan membuat seseorang mengandalkan pantauannya pada
 * hari ia berpindah meja.
 */

import { kartu, keping, kosong, tombol, tombolIkon, ubin, pesanSistem, roti, konfirmasi } from '../ui/komponen.js'
import {
  amankan, angka, jarakWaktu, tanggalJam, ringkas, nadaUrgensi, nadaStatus,
} from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { punyaIzin } from '../lib/peran.js'
import { dasar, menungguTelaah, URGENSI_MENDESAK } from '../lib/hitung.js'
import { belumTerpetakan } from '../lib/unit-terpetakan.js'
import {
  nilaiSemua, rekapPantauan, hapusPantauan, tandaiDilihat, simpanPantauan,
  jenisPantauan, penyimpananAwet, BATAS,
} from '../lib/pantauan.js'
import { jalankanAturan } from '../lib/aturan.js'

export function halamanRuang({ keadaan, isi }) {
  const semua = keadaan.berita || []
  const dalam = dasar(semua)
  const sekarang = new Date()

  const antrean = dalam.filter(menungguTelaah)
  const mendesak = dalam.filter((b) => URGENSI_MENDESAK.includes(b.urgensi) && menungguTelaah(b))

  const penilaian = nilaiSemua(semua, sekarang)
  const rekap = rekapPantauan(penilaian)

  const { temuan, aturanAktif } = jalankanAturan(semua, { sekarang })

  const saya = keadaan.profil?.username || ''
  const punyaSaya = saya
    ? semua.filter((b) => b.verified_by === saya)
      .sort((a, b) => String(b.verified_at || '').localeCompare(String(a.verified_at || '')))
      .slice(0, 8)
    : []

  const bolehTelaah = punyaIzin(keadaan.profil?.role, 'telaah_berita')
    || punyaIzin(keadaan.profil?.role, 'telaah_wilayah')

  isi.innerHTML = `
    <div class="tumpuk">
      <div class="kisi kisi-4">
        ${ubin({
          label: 'Menunggu telaah', nilai: antrean.length, nada: antrean.length ? 'sedang' : 'positif',
          kaki: antrean.length ? 'Buka antreannya' : 'Antrean bersih',
          halaman: bolehTelaah ? 'telaah' : '',
        })}
        ${ubin({
          label: 'Mendesak & belum ditelaah', nilai: mendesak.length,
          nada: mendesak.length ? 'kritis' : 'positif',
          kaki: 'Tinggi dan Kritis', halaman: bolehTelaah ? 'telaah' : '',
        })}
        ${ubin({
          label: 'Pantauan menyala', nilai: rekap.menyala, nada: rekap.menyala ? 'tinggi' : 'netral',
          kaki: `${angka(rekap.jumlah)} pantauan aktif`,
        })}
        ${ubin({
          label: 'Temuan aturan', nilai: temuan.length, nada: temuan.length ? 'sedang' : 'netral',
          kaki: `${angka(aturanAktif)} aturan berjalan`, halaman: 'aturan',
        })}
      </div>

      ${bagianPantauan(penilaian)}
      ${bagianTemuan(temuan)}
      ${bagianRiwayat(punyaSaya, Boolean(saya))}
    </div>`

  /* --------------------------------------------------------------- penyimak */

  isi.addEventListener('click', async (ev) => {
    const simpul = ev.target.closest('[data-aksi]')
    const aksi = simpul?.dataset.aksi
    if (!aksi) return

    if (aksi === 'buka-kueri') {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'cari', saring: { kueri: simpul.dataset.kueri } },
      }))
      return
    }

    if (aksi === 'buka-berita') {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'berita-detail', fokus: simpul.dataset.id },
      }))
      return
    }

    if (aksi === 'tandai-dilihat') {
      tandaiDilihat(simpul.dataset.id)
      roti('Ditandai sudah dibaca. Hitungan "baru" dimulai dari sekarang.', 'positif')
      isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))
      return
    }

    if (aksi === 'hapus-pantauan') {
      const nama = simpul.dataset.nama || 'pantauan ini'
      const ya = await konfirmasi({
        judul: 'Hapus pantauan?',
        pesan: `"${nama}" akan hilang dari daftar Anda. Berita yang dipantaunya tidak terpengaruh.`,
        tegas: 'Hapus',
        bahaya: true,
      })
      if (!ya) return
      hapusPantauan(simpul.dataset.id)
      roti('Pantauan dihapus.', 'netral')
      isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))
      return
    }

    if (aksi === 'setel-ambang') {
      const id = simpul.dataset.id
      const p = penilaian.find((x) => x.pantauan.id === id)?.pantauan
      if (!p) return
      /* Ambang berputar 0 → 1 → 3 → 5 → 0. Empat pilihan, satu tombol: menu
         bertingkat untuk satu bilangan menuntut tiga tekanan untuk perubahan
         yang biasanya hanya "jangan berisik" atau "kabari saya". */
      const urutan = [0, 1, 3, 5]
      const berikut = urutan[(urutan.indexOf(p.ambang.minimum) + 1) % urutan.length]
      simpanPantauan({ ...p, ambang: { ...p.ambang, minimum: berikut } })
      roti(berikut
        ? `Menyala bila ada ${berikut} publikasi baru atau lebih.`
        : 'Pantauan ini tidak akan menyala; ia hanya menghitung.', 'netral')
      isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))
    }
  })

  return {
    judul: 'Ruang Analis',
    sub: `${angka(antrean.length)} menunggu telaah · ${angka(rekap.menyala)} pantauan menyala · `
      + `${angka(temuan.length)} temuan aturan`,
  }
}

/* ---------------------------------------------------------------- pantauan */

function bagianPantauan(penilaian) {
  const catatanSimpanan = penyimpananAwet()
    ? 'Pantauan tersimpan di peramban ini saja — tidak berpindah ke komputer lain, dan tidak dibagi ke rekan setim.'
    : 'Peramban ini menolak menyimpan data situs, jadi pantauan hanya bertahan sampai tab ditutup.'

  return kartu({
    judul: 'Pantauan saya',
    ket: `${angka(penilaian.length)} dari ${BATAS} · terurut dari yang menyala`,
    aksi: tombol({
      label: 'Buat dari pencarian', ikon: 'cari', kecil: true, halaman: 'cari',
      judul: 'Susun kuerinya di Pencarian Lanjutan, lalu simpan sebagai pantauan',
    }),
    isi: penilaian.length
      ? `<div class="pantau-daftar">${penilaian.map(barisPantauan).join('')}</div>
         ${pesanSistem(catatanSimpanan, penyimpananAwet() ? 'netral' : 'sedang', 'info')}`
      : kosong(
          'Belum ada pantauan',
          'Pantauan adalah pencarian yang disimpan beserta ambangnya: unit yang Anda pegang, '
          + 'kata kunci yang sedang ramai, atau media tertentu. Susun kuerinya di Pencarian '
          + 'Lanjutan, lalu simpan.',
          tombol({ label: 'Buka Pencarian Lanjutan', ikon: 'cari', halaman: 'cari' }),
        ),
  })
}

function barisPantauan(p) {
  const j = jenisPantauan(p.pantauan.jenis)
  const ambang = p.pantauan.ambang.minimum

  return `
    <article class="pantau-baris${p.menyala ? ' menyala' : ''}">
      <div class="pantau-ikon" aria-hidden="true">${ikon(j.ikon)}</div>

      <div class="pantau-teks">
        <div class="baris gap-6">
          <button class="pantau-nama" data-aksi="buka-kueri" data-kueri="${amankan(p.pantauan.kueri)}"
                  title="Buka hasilnya di Pencarian Lanjutan">${amankan(ringkas(p.pantauan.nama, 68))}</button>
          ${keping(j.label, 'rendah', true)}
          ${p.menyala ? keping('Menyala', 'tinggi') : ''}
        </div>
        <code class="pantau-kueri">${amankan(ringkas(p.pantauan.kueri, 110))}</code>
        ${p.catatan.length ? `<div class="pantau-catatan">${p.catatan.map(amankan).join(' ')}</div>` : ''}
        ${p.contoh.length ? `
          <ul class="pantau-contoh">
            ${p.contoh.map((b) => `
              <li><button data-aksi="buka-berita" data-id="${amankan(b.id)}"
                  title="Buka catatan berita ini">${amankan(ringkas(b.judul || 'Tanpa judul', 76))}</button></li>`).join('')}
          </ul>` : ''}
      </div>

      <div class="pantau-angka">
        <div class="pantau-utama" title="Jumlah baris yang cocok pada arsip yang termuat">${angka(p.jumlah)}</div>
        <div class="mini-teks samar-teks">
          ${p.baru ? `<b class="kritis-teks">${angka(p.baru)} baru</b>` : 'tidak ada yang baru'}
          ${p.mendesak ? ` · ${angka(p.mendesak)} mendesak` : ''}
        </div>
        <div class="mini-teks samar-teks">
          ${p.pantauan.dilihat
            ? `dibaca ${amankan(jarakWaktu(p.pantauan.dilihat))}`
            : 'belum pernah ditandai dibaca'}
        </div>
      </div>

      <div class="pantau-aksi">
        <button class="tbl kecil samar" data-aksi="setel-ambang" data-id="${amankan(p.pantauan.id)}"
                title="Ambang: berapa publikasi baru sebelum pantauan ini menyala">
          ${ambang ? `≥ ${ambang}` : 'diam'}
        </button>
        ${tombolIkon({
          ikon: 'centang', aksi: 'tandai-dilihat', kecil: true,
          judul: 'Tandai sudah dibaca sampai sekarang',
          data: { id: p.pantauan.id },
        })}
        ${tombolIkon({
          ikon: 'tutup', aksi: 'hapus-pantauan', kecil: true,
          judul: 'Hapus pantauan ini',
          data: { id: p.pantauan.id, nama: p.pantauan.nama },
        })}
      </div>
    </article>`
}

/* ----------------------------------------------------------------- temuan */

function bagianTemuan(temuan) {
  return kartu({
    judul: 'Temuan aturan',
    ket: temuan.length
      ? `${angka(temuan.length)} peristiwa memenuhi sekurangnya satu aturan yang aktif.`
      : 'Tidak ada peristiwa yang memenuhi aturan mana pun pada arsip yang termuat.',
    aksi: tombol({ label: 'Atur aturannya', ikon: 'gembok', kecil: true, halaman: 'aturan' }),
    isi: temuan.length
      ? `<div class="temuan-daftar">${temuan.slice(0, 10).map(kartuTemuan).join('')}</div>
         ${temuan.length > 10
            ? `<div class="mini-teks samar-teks" style="margin-top:10px">
                 dan ${angka(temuan.length - 10)} temuan lain. Seluruhnya ada di Peringatan Dini.
               </div>` : ''}`
      : kosong(
          'Tidak ada yang menyala',
          'Aturan dijalankan ulang setiap kali halaman ini dibuka, atas seluruh arsip yang termuat. '
          + 'Bila Anda mengharapkan sesuatu muncul di sini, periksa ambangnya di halaman Aturan Peringatan.',
          tombol({ label: 'Buka Aturan Peringatan', ikon: 'gembok', halaman: 'aturan' }),
        ),
  })
}

function kartuTemuan(t) {
  const p = t.peristiwa
  return `
    <article class="temuan-kartu" data-nada="${t.nada}">
      <div class="temuan-kop">
        ${keping(t.tingkat, t.nada)}
        <span class="temuan-aturan">${amankan(t.aturan.nama)}</span>
        <span class="dorong mini-teks samar-teks">skor ${angka(Math.round(t.skor))}</span>
      </div>

      <h3 class="temuan-judul">${amankan(ringkas(p.judul || 'Tanpa judul', 120))}</h3>

      <div class="temuan-meta mini-teks samar-teks">
        ${belumTerpetakan(p.nama_upt) ? 'Unit belum terpetakan' : amankan(p.nama_upt)}
        · ${angka(p.jumlah_publikasi)} terbitan di ${angka(p.jumlah_media)} media
        · naik ke ${amankan(t.eskalasi.label)}
      </div>

      <ul class="temuan-dasar">
        ${t.dasar.map((d) => `<li>${amankan(d)}</li>`).join('')}
      </ul>

      ${p.publikasi?.length ? `
        <div class="baris gap-6">
          <button class="tbl kecil" data-aksi="buka-berita" data-id="${amankan(p.publikasi[0].id)}">
            ${ikon('berita')} Buka terbitannya
          </button>
        </div>` : ''}
    </article>`
}

/* ---------------------------------------------------------------- riwayat */

function bagianRiwayat(daftar, adaSesi) {
  if (!adaSesi) {
    return kartu({
      judul: 'Yang baru saya putuskan',
      isi: kosong('Tidak ada sesi', 'Riwayat putusan hanya bisa ditampilkan untuk akun yang sedang masuk.'),
    })
  }

  return kartu({
    judul: 'Yang baru saya putuskan',
    ket: 'Delapan putusan telaah terakhir atas nama Anda. Ada supaya putusan yang keliru '
      + 'masih bisa ditemukan kembali pada hari yang sama.',
    isi: daftar.length
      ? `<div class="tabel-bungkus">
          <table class="tabel">
            <thead><tr><th>Waktu</th><th>Judul</th><th>Unit</th><th>Putusan</th></tr></thead>
            <tbody>
              ${daftar.map((b) => `
                <tr>
                  <td class="nowrap"><span class="mini-teks samar-teks"
                    title="${amankan(tanggalJam(b.verified_at))}">${amankan(jarakWaktu(b.verified_at))}</span></td>
                  <td><button class="cari-judul" data-aksi="buka-berita" data-id="${amankan(b.id)}">
                    ${amankan(ringkas(b.judul || 'Tanpa judul', 96))}</button></td>
                  <td class="nowrap">${belumTerpetakan(b.nama_upt)
                    ? '<span class="samar-teks">—</span>' : amankan(ringkas(b.nama_upt, 30))}</td>
                  <td>${keping(b.status_verifikasi || '—', nadaStatus(b.status_verifikasi))}
                      ${keping(b.urgensi || '—', nadaUrgensi(b.urgensi))}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`
      : kosong(
          'Belum ada putusan atas nama Anda',
          'Putusan telaah yang Anda buat akan muncul di sini beserta waktunya.',
          tombol({ label: 'Buka Antrean Telaah', ikon: 'centang', halaman: 'telaah' }),
        ),
  })
}
