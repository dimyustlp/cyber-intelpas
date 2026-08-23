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
import { ikon } from '../lib/ikon.js'

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
async function buat(isi) {
  pilihan.sibuk = true
  gambarUlang()

  try {
    const snapshot = await panggilFungsi('snapshot_negatif', {
      p_mulai: pilihan.mulai,
      p_selesai: pilihan.selesai,
    })

    const data = Array.isArray(snapshot) ? snapshot[0] : snapshot
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
  const dalam = (keadaan.dalamLingkup || keadaan.berita || []).filter((b) => {
    const t = String(b.tanggal_publikasi || b.created_at || '').slice(0, 10)
    return t >= pilihan.mulai && t <= pilihan.selesai
  })
  const negatifLokal = dalam.filter((b) => ['Negatif', 'Campuran'].includes(b.sentimen))
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
            <div>
              <div class="label-mono" style="margin-bottom:5px">Mulai</div>
              <input class="masukan" type="date" data-peran="mulai" value="${amankan(pilihan.mulai)}" style="width:150px">
            </div>
            <div>
              <div class="label-mono" style="margin-bottom:5px">Sampai</div>
              <input class="masukan" type="date" data-peran="selesai" value="${amankan(pilihan.selesai)}" style="width:150px">
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

      ${hasil ? kartu({
        judul: 'Laporan siap',
        ket: `${angka(hasil.olahan.peristiwa.length)} peristiwa · ${angka(hasil.olahan.publikasi.length)} publikasi · ${angka(hasil.olahan.daftarUnit.length)} unit terdampak`,
        aksi: `${tombol({ label: 'Buka', ikon: 'tautan', aksi: 'buka-laporan' })}
               ${tombol({ label: 'Unduh HTML', ikon: 'unduh', gaya: 'utama', aksi: 'unduh-laporan' })}`,
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

  isi.querySelector('[data-aksi="susun-laporan"]')?.addEventListener('click', () => buat(isi))
  isi.querySelector('[data-aksi="unduh-laporan"]')?.addEventListener('click', unduh)
  isi.querySelector('[data-aksi="buka-laporan"]')?.addEventListener('click', bukaTab)

  return {
    judul: 'Laporan Berkala',
    sub: 'Laporan intelijen pemberitaan negatif, disusun langsung dari basis data',
  }
}
