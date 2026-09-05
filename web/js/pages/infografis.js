/**
 * Lembar Infografis — laporan harian dan mingguan dalam satu halaman gambar.
 *
 * KENAPA HALAMAN INI ADA DI SAMPING "LAPORAN BERKALA"
 *
 * Laporan Berkala menyusun laporan intelijen: daftar peristiwa negatif dan
 * tindakan yang dituntutnya. Pembacanya orang yang memang bertugas menangani.
 *
 * Halaman ini menyusun sesuatu yang lain, untuk pembaca yang lain: satu lembar
 * yang bisa dibaca dalam satu menit oleh orang yang tidak sedang menangani apa
 * pun — pimpinan, humas, kantor wilayah. Ia memuat sisi baiknya juga, sebab
 * lembar yang hanya memuat kabar buruk berhenti dibaca setelah pekan ketiga.
 *
 * TIGA KELUARAN, SATU GAMBAR
 *
 * Yang tampil di layar, yang diunduh sebagai PNG, dan yang tercetak adalah SVG
 * yang sama persis — bukan tiga penggambaran yang kebetulan mirip. PNG-nya
 * dirasterkan peramban itu sendiri lewat canvas; tidak ada satu baris pun kode
 * pihak ketiga yang ditarik, dan tidak ada satu bita pun data yang dikirim ke
 * peladen mana pun untuk digambar. Itu bukan kebetulan: lembar ini memuat
 * nama unit dan judul berita yang belum tentu boleh keluar dari jaringan.
 */

import { kartu, kosong, pesanSistem, tombol, roti } from '../ui/komponen.js'
import { amankan } from '../lib/format.js'
import { ambil } from '../lib/api.js'
import { susunInfografis } from '../lib/infografis.js'
import { svgInfografis } from '../ui/infografis-svg.js'
import { TATA } from '../ui/infografis-tata.js'
import { BATAS, DARATAN, TETANGGA } from '../lib/peta-indonesia.js'
import { PROVINSI, PROVINSI_INDUK } from '../lib/peta-provinsi.js'

/**
 * Pilihan bertahan selama sesi, seperti pada halaman Laporan Berkala. Menyusun
 * lembar mingguan lalu kehilangan pilihannya begitu berpindah menu adalah
 * jenis gangguan kecil yang membuat orang berhenti memakai sebuah halaman.
 */
const pilihan = { jenis: 'mingguan', mulai: '', selesai: '' }

/** Data induk unit hanya ditarik sekali per sesi; 531 baris tidak berubah tiap menit. */
let unitTersimpan = null

function isoHari(geser = 0) {
  const w = new Date(Date.now() + 7 * 3600 * 1000 + geser * 86_400_000)
  return w.toISOString().slice(0, 10)
}

/**
 * Rentang bawaan tiap jenis.
 *
 * Harian memakai KEMARIN, bukan hari ini. Lembar harian disusun pukul setengah
 * enam pagi tentang hari yang sudah selesai; hari yang sedang berjalan selalu
 * setengah kosong, dan lembar setengah kosong terbaca sebagai hari yang sepi.
 */
function rentangBaku(jenis) {
  if (jenis === 'harian') return { mulai: isoHari(-1), selesai: isoHari(-1) }
  if (jenis === 'bulanan') return { mulai: isoHari(-29), selesai: isoHari(-1) }
  return { mulai: isoHari(-7), selesai: isoHari(-1) }
}

function siapkanPeriode() {
  const r = rentangBaku(pilihan.jenis)
  pilihan.mulai = r.mulai
  pilihan.selesai = r.selesai
}

const GEO = { batas: BATAS, daratan: DARATAN, tetangga: TETANGGA, provinsi: PROVINSI }

function susun(keadaan) {
  const semua = keadaan.dalamLingkup || keadaan.berita || []
  const dalam = semua.filter((b) => {
    const t = String(b.tanggal_publikasi || b.created_at || '').slice(0, 10)
    return t >= pilihan.mulai && t <= pilihan.selesai
  })
  return susunInfografis({
    berita: dalam,
    unit: unitTersimpan || [],
    mulai: pilihan.mulai,
    selesai: pilihan.selesai,
    jenis: pilihan.jenis,
    indukProvinsi: PROVINSI_INDUK,
  })
}

/**
 * Merasterkan lembar menjadi PNG.
 *
 * Lebarnya dua kali ukuran rancangan. Satu kali terlihat kabur ketika dibuka
 * penuh di telepon — dan lembar ini justru paling sering dibuka di telepon,
 * lewat Telegram. Tiga kali menghasilkan berkas di atas empat megabita, yang
 * ditolak sebagian klien Telegram sebagai foto dan berubah menjadi lampiran
 * yang harus diunduh lebih dulu.
 *
 * Huruf tidak ikut tertanam. SVG yang dimuat lewat <img> adalah dokumen
 * terpisah yang tidak bisa membaca @font-face halaman ini, jadi yang dipakai
 * adalah huruf sistem — dan itulah sebabnya setiap tumpukan huruf di
 * ui/infografis-tata.js menyebutkan cadangan sistem yang sungguhan, bukan
 * hanya nama huruf yang diunduh.
 */
function keCanvas(svg, skala = 2) {
  return new Promise((selesai, tolak) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const alamat = URL.createObjectURL(blob)
    const gambar = new Image()
    gambar.onload = () => {
      try {
        const kanvas = document.createElement('canvas')
        kanvas.width = TATA.lebar * skala
        kanvas.height = TATA.tinggi * skala
        const kuas = kanvas.getContext('2d')
        // Latar putih ditulis lebih dulu. PNG tanpa latar menjadi tembus
        // pandang, dan lembar tembus pandang di atas tema gelap Telegram
        // berubah menjadi tulisan gelap di atas hitam.
        kuas.fillStyle = '#ffffff'
        kuas.fillRect(0, 0, kanvas.width, kanvas.height)
        kuas.drawImage(gambar, 0, 0, kanvas.width, kanvas.height)
        URL.revokeObjectURL(alamat)
        selesai(kanvas)
      } catch (galat) {
        URL.revokeObjectURL(alamat)
        tolak(galat)
      }
    }
    gambar.onerror = () => {
      URL.revokeObjectURL(alamat)
      tolak(new Error('Peramban menolak menggambar lembar ini.'))
    }
    gambar.src = alamat
  })
}

function unduhBlob(blob, nama) {
  const alamat = URL.createObjectURL(blob)
  const tautan = document.createElement('a')
  tautan.href = alamat
  tautan.download = nama
  document.body.appendChild(tautan)
  tautan.click()
  tautan.remove()
  // Ditunda sesaat: sebagian peramban membatalkan unduhan bila alamatnya
  // dicabut pada detik yang sama dengan kliknya.
  setTimeout(() => URL.revokeObjectURL(alamat), 4000)
}

function namaBerkas(model, akhiran) {
  const jenis = { harian: 'Harian', mingguan: 'Mingguan', bulanan: 'Bulanan' }[model.jenis] || 'Berkala'
  const rentang = model.periode.mulai === model.periode.selesai
    ? model.periode.mulai
    : `${model.periode.mulai}_sd_${model.periode.selesai}`
  return `Infografis-${jenis}-Trans-Siber-PAS-${rentang}.${akhiran}`
}

export async function halamanInfografis({ keadaan, isi }) {
  if (!pilihan.mulai) siapkanPeriode()

  const jenisTombol = [
    ['harian', 'Harian'],
    ['mingguan', 'Mingguan'],
    ['bulanan', 'Bulanan'],
  ].map(([k, l]) => `<button data-jenis="${k}" aria-pressed="${pilihan.jenis === k}">${l}</button>`).join('')

  isi.innerHTML = `
    <div class="tumpuk">
      ${kartu({
        judul: 'Lembar infografis',
        ket: 'Digambar di peramban Anda. Tidak ada data yang dikirim ke pihak mana pun untuk digambar.',
        isi: `
          <div class="baris gap-12" style="flex-wrap:wrap;align-items:flex-end">
            <div>
              <div class="label-mono" style="margin-bottom:5px">Jenis lembar</div>
              <div class="segmen" data-peran="jenis">${jenisTombol}</div>
            </div>
            <div>
              <label class="label-mono" for="infografis-mulai" style="display:block;margin-bottom:5px">Mulai</label>
              <input class="masukan" type="date" id="infografis-mulai" data-peran="mulai"
                     value="${amankan(pilihan.mulai)}" style="width:150px">
            </div>
            <div>
              <label class="label-mono" for="infografis-selesai" style="display:block;margin-bottom:5px">Sampai</label>
              <input class="masukan" type="date" id="infografis-selesai" data-peran="selesai"
                     value="${amankan(pilihan.selesai)}" style="width:150px">
            </div>
            <div class="dorong baris gap-8">
              ${tombol({ label: 'Unduh PNG', ikon: 'unduh', aksi: 'png', gaya: 'utama' })}
              ${tombol({ label: 'Unduh SVG', ikon: 'unduh', aksi: 'svg' })}
              ${tombol({ label: 'Cetak', ikon: 'laporan', aksi: 'cetak' })}
            </div>
          </div>`,
      })}
      <div data-peran="lembar" class="lembar-infografis"></div>
    </div>`

  const wadah = isi.querySelector('[data-peran="lembar"]')

  // Data induk unit menentukan provinsi dan jenis tiap berita. Tanpa dia peta
  // kosong dan ubin Lapas/Rutan nol — jadi kegagalannya dikatakan, bukan
  // dibiarkan tampil sebagai lembar yang seolah benar.
  if (!unitTersimpan) {
    try {
      unitTersimpan = await ambil('upt', {
        select: 'nama_upt,jenis_upt,kanwil,provinsi',
        aktif: 'eq.true',
        limit: 1000,
      }) || []
    } catch {
      unitTersimpan = []
      wadah.insertAdjacentHTML('beforebegin', pesanSistem(
        'Data induk unit gagal dimuat. Peta sebaran dan angka Lapas/Rutan pada lembar '
        + 'di bawah tidak dapat dihitung; angka lainnya tetap benar.', 'peringatan', 'info',
      ))
    }
  }

  let model = null

  function gambar() {
    model = susun(keadaan)
    if (!model.ikhtisar.total) {
      wadah.innerHTML = kosong(
        'Tidak ada publikasi pada rentang ini',
        'Ubah rentang tanggalnya, atau tunggu penyalin berikutnya berjalan.',
      )
      return
    }
    wadah.innerHTML = svgInfografis(model, GEO)
  }

  gambar()

  isi.querySelector('[data-peran="jenis"]')?.addEventListener('click', (per) => {
    const btn = per.target.closest('button[data-jenis]')
    if (!btn) return
    pilihan.jenis = btn.dataset.jenis
    siapkanPeriode()
    isi.querySelector('[data-peran="mulai"]').value = pilihan.mulai
    isi.querySelector('[data-peran="selesai"]').value = pilihan.selesai
    isi.querySelectorAll('[data-peran="jenis"] button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.jenis === pilihan.jenis))
    })
    gambar()
  })

  for (const sisi of ['mulai', 'selesai']) {
    isi.querySelector(`[data-peran="${sisi}"]`)?.addEventListener('change', (per) => {
      pilihan[sisi] = per.target.value
      if (pilihan.mulai > pilihan.selesai) {
        // Rentang terbalik menghasilkan lembar kosong yang terbaca sebagai
        // "tidak ada berita", bukan sebagai "tanggalnya tertukar".
        const tukar = pilihan.mulai
        pilihan.mulai = pilihan.selesai
        pilihan.selesai = tukar
        isi.querySelector('[data-peran="mulai"]').value = pilihan.mulai
        isi.querySelector('[data-peran="selesai"]').value = pilihan.selesai
        roti('Tanggal mulai dan selesai ditukar.', 'aksen')
      }
      gambar()
    })
  }

  isi.querySelector('[data-aksi="png"]')?.addEventListener('click', async (per) => {
    if (!model?.ikhtisar.total) { roti('Tidak ada yang bisa diunduh.', 'sedang'); return }
    const btn = per.target.closest('button')
    btn.disabled = true
    try {
      const kanvas = await keCanvas(svgInfografis(model, GEO), 2)
      const blob = await new Promise((s) => kanvas.toBlob(s, 'image/png'))
      if (!blob) throw new Error('Peramban tidak mengembalikan berkas.')
      unduhBlob(blob, namaBerkas(model, 'png'))
      roti('Lembar PNG tersimpan.', 'baik')
    } catch (galat) {
      roti(`Gagal menyusun PNG: ${galat.message}`, 'kritis', 6000)
    } finally {
      btn.disabled = false
    }
  })

  isi.querySelector('[data-aksi="svg"]')?.addEventListener('click', () => {
    if (!model?.ikhtisar.total) { roti('Tidak ada yang bisa diunduh.', 'sedang'); return }
    const blob = new Blob([svgInfografis(model, GEO)], { type: 'image/svg+xml;charset=utf-8' })
    unduhBlob(blob, namaBerkas(model, 'svg'))
  })

  isi.querySelector('[data-aksi="cetak"]')?.addEventListener('click', () => {
    document.body.classList.add('cetak-lembar')
    // Kelasnya dilepas setelah dialog cetak ditutup, bukan sesudah print()
    // kembali: sebagian peramban mengembalikan print() seketika dan
    // dialognya masih terbuka ketika gayanya sudah hilang.
    const lepas = () => {
      document.body.classList.remove('cetak-lembar')
      window.removeEventListener('afterprint', lepas)
    }
    window.addEventListener('afterprint', lepas)
    window.print()
  })
}
