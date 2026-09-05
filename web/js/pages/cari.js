/**
 * Pencarian Lanjutan.
 *
 * Satu kotak, satu bahasa, satu kebenaran.
 *
 * Aturan yang mengikat seluruh halaman ini: **setiap saringan yang dipasang
 * lewat tombol ditulis ke dalam kotak kuerinya.** Menekan "Negatif" pada panel
 * aspek tidak menyimpan keadaan tersembunyi di suatu tempat — ia menambahkan
 * `sentimen:Negatif` ke teks yang sedang terbaca. Akibatnya kotak itu selalu
 * menjadi keterangan lengkap tentang apa yang sedang ditampilkan, bisa disalin
 * ke rekan lewat pesan, disimpan sebagai pantauan, dan dibaca ulang tiga bulan
 * kemudian.
 *
 * Kebalikannya — saringan berupa daftar pilihan yang menyimpan keadaannya
 * sendiri — adalah bentuk yang dipakai Pusat Data Berita, dan bentuk itu tetap
 * benar di sana: enam pilihan tetap, dipakai berulang tiap hari. Yang tidak
 * bisa dilakukannya adalah menjawab pertanyaan yang belum pernah ditanyakan
 * sebelumnya, dan itu pekerjaan halaman ini.
 *
 * ## Yang sengaja TIDAK ada di sini
 *
 * Pengubahan status telaah secara massal. Halaman ini bisa memilih dua ratus
 * baris sekaligus, dan justru karena itu ia tidak boleh mengubah status
 * mereka: setiap putusan telaah tercatat lengkap dengan nama penelaah dan
 * catatannya di Antrean Telaah, dan dua ratus putusan tanpa catatan adalah
 * dua ratus baris yang tidak bisa dijelaskan siapa pun kemudian. Yang
 * disediakan adalah tombol yang membawa hasil saringan ini ke Antrean Telaah,
 * tempat putusannya dibuat satu per satu.
 */

import { kartu, keping, kosong, tombol, pesanSistem, roti } from '../ui/komponen.js'
import {
  amankan, angka, jarakWaktu, tanggalJam, ringkas, persen,
  nadaUrgensi, nadaSentimen, nadaStatus,
} from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { saringKueri, jelaskan, kataSorot, sebagaiKueri, BIDANG, BIDANG_UTAMA } from '../lib/kueri.js'
import { dasar } from '../lib/hitung.js'
import { belumTerpetakan } from '../lib/unit-terpetakan.js'
import { simpanPantauan, bakukan, penyimpananAwet } from '../lib/pantauan.js'
import { tingkatKumpulan, labelTingkat, nadaTingkat, bannerTingkat } from '../lib/klasifikasi-informasi.js'
import { ekspor, KOLOM_BERITA } from '../lib/ekspor.js'

/** Keadaan halaman. Hanya dua: teks kueri, dan berapa baris yang sudah tampil. */
const keadaanCari = { kueri: '', batas: 60, lingkup: 'dasar' }

const LANGKAH = 60

/**
 * Contoh yang bisa ditekan.
 *
 * Bukan hiasan: bahasa kueri hanya berguna bila orang tahu ia ada. Daftar ini
 * adalah dokumentasinya, dan satu-satunya dokumentasi yang benar-benar dibaca
 * adalah yang bisa dicoba sekali tekan.
 */
const CONTOH = [
  { teks: 'narkoba ATAU sabu', ket: 'salah satu kata' },
  { teks: '"warga binaan"', ket: 'frasa utuh' },
  { teks: '"sipir narkoba"~6', ket: 'dua kata berdekatan' },
  { teks: 'upt:Cilegon -status:"Tidak Valid"', ket: 'bidang, dan pengecualian' },
  { teks: 'selundup* sentimen:Negatif', ket: 'jokar dan bidang' },
  { teks: 'sejak:2026-09-01 urgensi:Kritis', ket: 'rentang tanggal' },
]

export function halamanCari({ keadaan, isi }) {
  /* Saringan titipan dari halaman lain — palet perintah, ubin, tombol "Cari
     serupa" di detail berita. Diterima sebagai teks kueri apa adanya. */
  if (keadaan.saringMasuk) {
    const masuk = keadaan.saringMasuk
    keadaanCari.kueri = masuk.kueri
      || (masuk.cari ? String(masuk.cari) : '')
      || Object.entries(masuk).map(([k, v]) => (BIDANG[k] ? sebagaiKueri(k, v) : '')).filter(Boolean).join(' ')
    keadaanCari.batas = LANGKAH
    keadaan.saringMasuk = null
  }

  const sumber = () => (keadaanCari.lingkup === 'dasar' ? dasar(keadaan.berita || []) : (keadaan.berita || []))

  isi.innerHTML = `
    <div class="tumpuk">
      ${kartu({
        judul: 'Kueri',
        ket: 'Satu kotak untuk seluruh arsip. Kata, frasa, bidang, DAN, ATAU, TIDAK, dan tanda kurung.',
        isi: `
          <div class="cari-lanjut">
            <label class="cari cari-besar">
              ${ikon('cari')}
              <input class="masukan" id="cari-kueri" type="search" autocomplete="off" spellcheck="false"
                     value="${amankan(keadaanCari.kueri)}"
                     placeholder="mis. (narkoba ATAU sabu) upt:Cilegon -status:&quot;Tidak Valid&quot;"
                     aria-label="Kueri pencarian" aria-describedby="cari-baca">
            </label>

            <div class="cari-baca" id="cari-baca"></div>

            <div class="cari-contoh">
              <span class="mini-teks samar-teks">Coba:</span>
              ${CONTOH.map((c) => `
                <button class="keping cari-sisip" data-nada="aksen" data-sisip="${amankan(c.teks)}"
                        title="${amankan(c.ket)}">${amankan(c.teks)}</button>`).join('')}
            </div>

            <details class="cari-bantuan">
              <summary>Bidang yang bisa disebut</summary>
              <div class="cari-bidang">
                ${BIDANG_UTAMA.map((b) => `
                  <button class="cari-bidang-butir" data-sisip="${amankan(b)}:">
                    <code>${amankan(b)}:</code>
                    <span class="samar-teks">${amankan(BIDANG[b].label)}</span>
                  </button>`).join('')}
              </div>
            </details>
          </div>`,
      })}

      <div id="cari-hasil"></div>
    </div>`

  const kotak = isi.querySelector('#cari-kueri')
  const wadahBaca = isi.querySelector('#cari-baca')
  const wadahHasil = isi.querySelector('#cari-hasil')

  /**
   * Menggambar ulang HANYA bagian hasilnya.
   *
   * Menggambar ulang seluruh halaman pada tiap ketikan akan membuang fokus
   * dari kotak kueri, dan kotak pencarian yang kehilangan fokus di tengah
   * pengetikan tidak bisa dipakai sama sekali.
   */
  function gambarHasil() {
    const semua = sumber()
    const { hasil, catatan, pohon, kosong: kosongKueri } = saringKueri(semua, keadaanCari.kueri)

    wadahBaca.innerHTML = bacaanKueri(pohon, catatan, kosongKueri)
    wadahHasil.innerHTML = blokHasil({ hasil, semua, pohon, kosongKueri })
  }

  /* ------------------------------------------------------------ penyimak */

  let jeda = null
  kotak.addEventListener('input', () => {
    keadaanCari.kueri = kotak.value
    keadaanCari.batas = LANGKAH
    // Ditunda sebentar. Arsip beberapa ribu baris disaring ulang tiap ketikan,
    // dan tanpa jeda ini pengetikan cepat terasa tersendat.
    clearTimeout(jeda)
    jeda = setTimeout(gambarHasil, 90)
  })

  /*
     Satu penyimak untuk seluruh halaman, dipasang SEKALI.

     Sempat dipasang ulang di dalam `gambarHasil()`, dan itu keliru dengan cara
     yang tidak terlihat: wadah hasilnya tidak pernah diganti — hanya isinya —
     sehingga tiap ketikan menambah satu penyimak baru di atas yang lama. Pada
     ketikan kedua puluh, satu tekanan tombol "Tampilkan lagi" berjalan dua
     puluh kali sekaligus.
  */
  isi.addEventListener('click', (ev) => {
    const sisip = ev.target.closest('[data-sisip]')?.dataset.sisip
    if (sisip) {
      const awal = keadaanCari.kueri.trim()
      keadaanCari.kueri = awal ? `${awal} ${sisip}` : sisip
      keadaanCari.batas = LANGKAH
      kotak.value = keadaanCari.kueri
      kotak.focus()
      kotak.setSelectionRange(kotak.value.length, kotak.value.length)
      gambarHasil()
      return
    }

    const simpul = ev.target.closest('[data-aksi]')
    const aksi = simpul?.dataset.aksi
    if (!aksi) return

    if (aksi === 'bersihkan-kueri') {
      keadaanCari.kueri = ''
      keadaanCari.batas = LANGKAH
      kotak.value = ''
      kotak.focus()
      gambarHasil()
    } else if (aksi === 'tampil-lagi') {
      keadaanCari.batas += LANGKAH
      gambarHasil()
    } else if (aksi === 'ganti-lingkup') {
      keadaanCari.lingkup = keadaanCari.lingkup === 'dasar' ? 'semua' : 'dasar'
      keadaanCari.batas = LANGKAH
      gambarHasil()
    } else if (aksi === 'simpan-pantauan') {
      simpanSebagaiPantauan()
    } else if (aksi === 'ekspor-csv' || aksi === 'ekspor-json') {
      bawaKeluar(aksi === 'ekspor-json' ? 'json' : 'csv')
    } else if (aksi === 'buka-berita') {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'berita-detail', fokus: simpul.dataset.id },
      }))
    }
  })

  function simpanSebagaiPantauan() {
    const teks = keadaanCari.kueri.trim()
    if (!teks) { roti('Ketik kuerinya lebih dulu; pantauan tanpa kueri tidak menyaring apa pun.', 'sedang'); return }

    const hasil = simpanPantauan(bakukan({
      jenis: 'pencarian',
      nama: ringkas(teks, 60),
      kueri: teks,
      ambang: { minimum: 1 },
    }))

    if (hasil.penuh) { roti('Daftar pantauan sudah penuh. Hapus salah satu lebih dulu.', 'sedang', 5200); return }
    if (!hasil.baru) { roti('Kueri ini sudah ada di daftar pantauan Anda.', 'netral'); return }
    roti(hasil.awet
      ? 'Tersimpan sebagai pantauan. Buka Ruang Analis untuk melihatnya.'
      : 'Tersimpan untuk sesi ini saja — peramban menolak menyimpan data situs.', hasil.awet ? 'positif' : 'sedang', 5200)
  }

  function bawaKeluar(bentuk) {
    const { hasil } = saringKueri(sumber(), keadaanCari.kueri)
    const hasilEkspor = ekspor({
      judul: 'Hasil pencarian',
      kolom: KOLOM_BERITA,
      baris: hasil,
      bentuk,
      tingkat: tingkatKumpulan(hasil),
      profil: keadaan.profil,
      kueri: keadaanCari.kueri.trim() || 'seluruh baris',
    })
    roti(hasilEkspor.berhasil
      ? `${angka(hasil.length)} baris diunduh, berklasifikasi ${labelTingkat(hasilEkspor.keterangan.tingkat)}.`
      : hasilEkspor.alasan, hasilEkspor.berhasil ? 'positif' : 'sedang', 5600)
  }

  gambarHasil()

  const jumlah = saringKueri(sumber(), keadaanCari.kueri).hasil.length
  return {
    judul: 'Pencarian Lanjutan',
    sub: keadaanCari.kueri.trim()
      ? `${angka(jumlah)} baris cocok`
      : `${angka(sumber().length)} baris siap dicari`,
  }
}

/* ------------------------------------------------------------- bacaan kueri */

/**
 * Membaca kueri kembali sebagai kalimat.
 *
 * Alasannya sama dengan alasan `jelaskan()` ada di lib/kueri.js: kueri
 * berkurung tiga lapis tidak pernah salah menurut mesin, dan satu-satunya cara
 * menemukan anggapan keliru di kepala penulisnya adalah membacanya kembali
 * dalam bahasa biasa.
 */
function bacaanKueri(pohon, catatan, kosongKueri) {
  if (kosongKueri) {
    return `<span class="samar-teks">Kotak kosong berarti seluruh baris. Ketik satu kata untuk mulai menyempitkan.</span>`
  }
  return `
    <span class="cari-baca-inti">Menampilkan baris yang ${amankan(jelaskan(pohon))}.</span>
    ${catatan.length
      ? `<span class="cari-baca-catatan">${catatan.map((c) => amankan(c)).join(' ')}</span>`
      : ''}`
}

/* -------------------------------------------------------------- blok hasil */

function blokHasil({ hasil, semua, pohon, kosongKueri }) {
  const tingkat = hasil.length ? tingkatKumpulan(hasil) : 'internal'
  const sorot = kataSorot(pohon)

  if (!hasil.length) {
    return kartu({
      isi: kosong(
        'Tidak ada baris yang cocok',
        kosongKueri
          ? 'Arsip yang termuat kosong. Muat ulang halaman, atau periksa Sinkronisasi Sumber.'
          : 'Longgarkan kuerinya — buang satu syarat, atau ganti DAN menjadi ATAU.',
        tombol({ label: 'Bersihkan kueri', ikon: 'tutup', aksi: 'bersihkan-kueri' }),
      ),
    })
  }

  const tampil = hasil.slice(0, keadaanCari.batas)

  return `
    <div class="tumpuk">
      ${kartu({
        judul: 'Hasil',
        ket: `${angka(hasil.length)} dari ${angka(semua.length)} baris`
          + ` · ${persen(hasil.length, semua.length)} dari yang dicari`,
        aksi: `
          ${keping(labelTingkat(tingkat), nadaTingkat(tingkat))}
          ${tombol({ label: 'Simpan pantauan', ikon: 'centang', kecil: true, aksi: 'simpan-pantauan',
            judul: 'Menyimpan kueri ini sebagai pantauan di Ruang Analis' })}
          ${tombol({ label: 'CSV', ikon: 'unduh', kecil: true, aksi: 'ekspor-csv',
            judul: 'Unduh seluruh hasil sebagai CSV berlabel klasifikasi' })}
          ${tombol({ label: 'JSON', ikon: 'unduh', kecil: true, aksi: 'ekspor-json',
            judul: 'Unduh seluruh hasil sebagai JSON berlabel klasifikasi' })}`,
        rapat: true,
        isi: `
          <div class="cari-banner" data-nada="${nadaTingkat(tingkat)}">
            ${ikon('gembok')}<span>${amankan(bannerTingkat(tingkat))}</span>
          </div>

          <div class="tabel-bungkus">
            <table class="tabel">
              <thead>
                <tr>
                  <th>Waktu</th><th>Judul</th><th>Unit</th><th>Media</th>
                  <th>Isu</th><th>Sentimen</th><th>Urgensi</th><th>Status</th>
                </tr>
              </thead>
              <tbody>${tampil.map((b) => barisHasil(b, sorot)).join('')}</tbody>
            </table>
          </div>

          ${hasil.length > tampil.length ? `
            <div class="cari-lagi">
              ${tombol({ label: `Tampilkan ${angka(Math.min(LANGKAH, hasil.length - tampil.length))} baris lagi`, aksi: 'tampil-lagi' })}
              <span class="mini-teks samar-teks">${angka(tampil.length)} dari ${angka(hasil.length)} ditampilkan</span>
            </div>` : ''}

          <div class="cari-kaki">
            ${tombol({ label: keadaanCari.lingkup === 'dasar' ? 'Sertakan baris yang dikecualikan' : 'Kembali ke himpunan yang dihitung',
              ikon: 'info', kecil: true, aksi: 'ganti-lingkup',
              judul: 'Himpunan yang dihitung adalah baris dalam lingkup yang belum dinyatakan tidak valid atau diarsipkan' })}
            ${tombol({ label: 'Buka di Antrean Telaah', ikon: 'centang', kecil: true, halaman: 'telaah',
              judul: 'Putusan telaah dibuat satu per satu di sana, lengkap dengan catatannya' })}
          </div>`,
      })}

      ${kartuAspek(hasil)}
      ${kartuSelainBerita(hasil)}
      ${!penyimpananAwet() ? pesanSistem(
        'Peramban ini menolak menyimpan data situs, jadi pantauan yang Anda simpan hanya '
        + 'bertahan sampai tab ditutup. Biasanya ini terjadi di jendela penyamaran.',
        'sedang', 'info') : ''}
    </div>`
}

function sorotJudul(teks, sorot) {
  const aman = amankan(ringkas(teks || 'Tanpa judul', 130))
  if (!sorot.length) return aman
  /* Penyorotan dilakukan SESUDAH pengamanan, dan hanya menyisipkan <mark>.
     Menyorot lebih dulu lalu mengamankan akan mengubah tanda kurung sudutnya
     menjadi teks, dan tidak ada satu pun yang tersorot. */
  const pola = new RegExp(`(${sorot.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return aman.replace(pola, '<mark>$1</mark>')
}

function barisHasil(b, sorot) {
  return `
    <tr>
      <td class="nowrap" title="${amankan(tanggalJam(b.created_at))}">
        <span class="mini-teks samar-teks">${amankan(jarakWaktu(b.tanggal_publikasi || b.created_at))}</span>
      </td>
      <td>
        <button class="cari-judul" data-aksi="buka-berita" data-id="${amankan(b.id)}"
                title="Buka catatan berita ini">${sorotJudul(b.judul, sorot)}</button>
      </td>
      <td class="nowrap">${belumTerpetakan(b.nama_upt)
        ? '<span class="samar-teks">Belum terpetakan</span>'
        : amankan(ringkas(b.nama_upt, 34))}</td>
      <td class="nowrap">${amankan(ringkas(b.media || '—', 22))}</td>
      <td>${amankan(ringkas(b.subkategori || b.kategori || '—', 34))}</td>
      <td>${keping(b.sentimen || '—', nadaSentimen(b.sentimen))}</td>
      <td>${keping(b.urgensi || '—', nadaUrgensi(b.urgensi))}</td>
      <td>${keping(b.status_verifikasi || 'Belum Ditelaah', nadaStatus(b.status_verifikasi))}</td>
    </tr>`
}

/* ------------------------------------------------------------------- aspek */

/**
 * Aspek — saringan yang dihitung dari hasil, bukan dari daftar tetap.
 *
 * Bedanya dengan daftar pilihan di Pusat Data Berita: yang ditawarkan di sini
 * hanya nilai yang benar-benar ada di dalam hasil, beserta jumlahnya. Sebuah
 * pilihan yang menghasilkan nol baris tidak pernah ditawarkan, sehingga tidak
 * ada satu tekanan pun yang berakhir di layar kosong.
 */
function kartuAspek(hasil) {
  const aspek = [
    { bidang: 'upt', label: 'Unit', ambil: (b) => (belumTerpetakan(b.nama_upt) ? null : b.nama_upt) },
    { bidang: 'media', label: 'Media', ambil: (b) => b.media },
    { bidang: 'subkategori', label: 'Isu', ambil: (b) => b.subkategori },
    { bidang: 'sentimen', label: 'Sentimen', ambil: (b) => b.sentimen },
    { bidang: 'urgensi', label: 'Urgensi', ambil: (b) => b.urgensi },
    { bidang: 'status', label: 'Status telaah', ambil: (b) => b.status_verifikasi },
    { bidang: 'wilayah', label: 'Wilayah', ambil: (b) => b.kanwil_asal },
  ]

  const kolom = aspek.map((a) => {
    const hitung = new Map()
    for (const b of hasil) {
      const nilai = a.ambil(b)
      if (!nilai) continue
      hitung.set(nilai, (hitung.get(nilai) || 0) + 1)
    }
    const urut = [...hitung.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6)
    if (!urut.length) return ''
    return `
      <div class="aspek-kolom">
        <h4>${amankan(a.label)}</h4>
        ${urut.map(([nilai, n]) => `
          <button class="aspek-butir" data-sisip="${amankan(sebagaiKueri(a.bidang, nilai))}"
                  title="Tambahkan ${amankan(sebagaiKueri(a.bidang, nilai))} ke kueri">
            <span class="aspek-nama">${amankan(ringkas(nilai, 30))}</span>
            <span class="aspek-angka">${angka(n)}</span>
          </button>`).join('')}
      </div>`
  }).filter(Boolean).join('')

  return kartu({
    judul: 'Persempit',
    ket: 'Dihitung dari hasil yang sedang tampil. Menekan salah satunya menambahkannya ke kotak kueri.',
    isi: kolom ? `<div class="aspek-kisi">${kolom}</div>` : '<span class="samar-teks">Tidak ada nilai yang bisa dipersempit.</span>',
  })
}

/* --------------------------------------------------------- selain berita */

/**
 * Yang ditemukan selain baris berita.
 *
 * Daftar periksa menuntut pencarian menyeluruh — unit, media, isu, wilayah,
 * bukan hanya berita. Yang ditampilkan di sini bukan tabel kedua melainkan
 * pintu: berapa banyak unit yang tersentuh hasil ini, dan berapa isi
 * masing-masing.
 */
function kartuSelainBerita(hasil) {
  const unit = new Map()
  const media = new Map()
  for (const b of hasil) {
    if (!belumTerpetakan(b.nama_upt)) unit.set(b.nama_upt, (unit.get(b.nama_upt) || 0) + 1)
    if (b.media) media.set(b.media, (media.get(b.media) || 0) + 1)
  }

  return kartu({
    judul: 'Yang tersentuh hasil ini',
    ket: `${angka(unit.size)} unit · ${angka(media.size)} media`,
    isi: `
      <div class="kisi kisi-2">
        <div>
          <h4 class="kecil-teks">Unit</h4>
          ${unit.size
            ? `<ul class="cari-daftar">${[...unit.entries()]
                .sort((a, b) => b[1] - a[1]).slice(0, 8)
                .map(([n, j]) => `<li><button data-sisip="${amankan(sebagaiKueri('upt', n))}">${amankan(ringkas(n, 42))}</button><span>${angka(j)}</span></li>`)
                .join('')}</ul>`
            : '<span class="samar-teks kecil-teks">Tidak ada unit yang teridentifikasi pada hasil ini.</span>'}
        </div>
        <div>
          <h4 class="kecil-teks">Media</h4>
          ${media.size
            ? `<ul class="cari-daftar">${[...media.entries()]
                .sort((a, b) => b[1] - a[1]).slice(0, 8)
                .map(([n, j]) => `<li><button data-sisip="${amankan(sebagaiKueri('media', n))}">${amankan(ringkas(n, 42))}</button><span>${angka(j)}</span></li>`)
                .join('')}</ul>`
            : '<span class="samar-teks kecil-teks">Tidak ada media pada hasil ini.</span>'}
        </div>
      </div>`,
  })
}
