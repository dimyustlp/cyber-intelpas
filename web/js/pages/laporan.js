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
import { amankan, angka, tanggalPanjang } from '../lib/format.js'
import { panggilFungsi, pesanRamah } from '../lib/api.js'
import { roti } from '../ui/komponen.js'
import { susunLaporan, nomorLaporan, olahLaporan } from '../lib/laporan.js'
import { kelompokkanPeristiwa } from '../lib/peristiwa.js'
import { ember } from '../lib/sentimen.js'
import { dasar } from '../lib/hitung.js'
import { ikon } from '../lib/ikon.js'
import { baganUptMuncul } from '../ui/bagan.js'
import { uptNaik } from '../lib/hitung.js'

/** Pilihan periode yang bertahan selama sesi. */
const pilihan = { jenis: 'mingguan', mulai: '', selesai: '', hasil: null, sibuk: false }

function isoHari(geser = 0) {
  const t = new Date()
  t.setDate(t.getDate() + geser)
  return t.toISOString().slice(0, 10)
}

function siapkanPeriode() {
  if (pilihan.jenis === 'harian') {
    pilihan.mulai = isoHari(0)
    pilihan.selesai = isoHari(0)
  } else if (pilihan.jenis === 'mingguan') {
    pilihan.mulai = isoHari(-6)
    pilihan.selesai = isoHari(0)
  } else {
    pilihan.mulai = isoHari(-29)
    pilihan.selesai = isoHari(0)
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
    const html = susunLaporan(data, {
      jenis: pilihan.jenis,
      urutan: 1,
      nomor: nomorLaporan(pilihan.jenis, 1, pilihan.selesai),
    })

    pilihan.hasil = { html, olahan, dibuat: new Date().toISOString() }
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

function unduh() {
  if (!pilihan.hasil) return
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
  const dalam = dasar(keadaan.dalamLingkup || keadaan.berita || []).filter((b) => {
    const t = String(b.tanggal_publikasi || b.created_at || '').slice(0, 10)
    return t >= pilihan.mulai && t <= pilihan.selesai
  })
  // Sama persis dengan aturan dasbor dan kanal: yang bersentimen campuran
  // memuat kedua sisi sekaligus dan bukan berita yang merugikan institusi.
  // Sebelum ini laporan memakai daftarnya sendiri, dan pratinjau di layar
  // karena itu menyebut angka yang tidak pernah cocok dengan dasbornya.
  const negatifLokal = dalam.filter((b) => ember(b) === 'negatif')
  const kiraPeristiwa = kelompokkanPeristiwa(negatifLokal).length

  const hasil = pilihan.hasil

  isi.innerHTML = `
    <div class="tumpuk">
      ${pesanSistem(
        `<b>Laporan ini hanya memuat pemberitaan negatif.</b> Publikasi positif dihitung sebagai
         konteks pada bagian ikhtisar, tetapi tidak dirinci — laporan berkala Dirpamintel adalah
         daftar hal yang menuntut tindakan, bukan rapor kehumasan.`,
        'aksen', 'info')}

      ${kartu({
        judul: 'Susun laporan berkala',
        ket: 'Berkas tersusun di peramban Anda. Tidak ada data yang dikirim ke pihak ketiga.',
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
               ${tombol({ label: 'Unduh HTML', ikon: 'unduh', aksi: 'unduh-laporan' })}
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

  isi.querySelector('[data-aksi="susun-laporan"]')?.addEventListener('click', () => buat(isi, keadaan))
  isi.querySelector('[data-aksi="unduh-laporan"]')?.addEventListener('click', unduh)
  isi.querySelector('[data-aksi="buka-laporan"]')?.addEventListener('click', bukaTab)

  return {
    judul: 'Laporan Berkala',
    sub: 'Laporan intelijen pemberitaan negatif, disusun langsung dari basis data',
  }
}
