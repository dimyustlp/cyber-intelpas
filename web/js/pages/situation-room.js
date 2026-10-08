/**
 * Situation Room — layar dinding untuk ruang kendali.
 *
 * Berbeda dari Pusat Komando (tab di Analisis Pemberitaan), yang merangkum
 * arsip berita yang termuat, layar ini dibangun di atas keluaran mesin
 * pendeteksi di peladen: unit yang melonjak dan isu yang diangkat banyak media.
 * Isinya yang pantas dilihat siapa pun yang lewat di depan dinding, jadi
 * tidak ada data akun, login, atau pengguna di sini. Itu tinggal di Log Akses.
 *
 * Tiga aturan layar dinding, sama seperti Pusat Komando:
 *
 *   Sedikit angka, besar.
 *   Tidak ada yang bergerak sendiri. Daftarnya diam; hanya seluruh layar yang
 *   disegarkan tiap satu menit.
 *   Waktu segar disebutkan apa adanya, supaya layar yang menyala semalaman
 *   tidak dipercaya secara keliru.
 *
 * Layar penuh memakai Fullscreen API milik peramban pada elemen halaman ini
 * saja, jadi menu samping dan kepala aplikasi tidak ikut tampil di dinding.
 */

import { amankan, angka, jam, jarakWaktu, tanggalPanjang, ringkas } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { KONFIG } from '../lib/konfig.js'
import { ringkasan } from '../lib/hitung.js'
import { pesanRamah } from '../lib/api.js'
import { muatLonjakan, aktifSekarang, lonjakanPeragaan } from '../lib/lonjakan.js'

const SEGAR_MS = 60_000

function angkaBesar(label, nilai, nada, kaki) {
  return `
    <div class="komando-ubin" data-nada="${nada}">
      <span class="komando-ubin-label">${amankan(label)}</span>
      <span class="komando-ubin-nilai">${typeof nilai === 'number' ? angka(nilai) : amankan(nilai)}</span>
      <span class="komando-ubin-kaki">${amankan(kaki)}</span>
    </div>`
}

function baris(nada, tingkat, judul, meta) {
  return `
    <li data-nada="${nada}">
      <span class="komando-tiker-tingkat">${amankan(tingkat)}</span>
      <span class="komando-tiker-judul">${amankan(judul)}</span>
      <span class="komando-tiker-meta">${amankan(meta)}</span>
    </li>`
}

export function halamanSituationRoom({ keadaan, isi }) {
  const status = { data: null, galat: null }
  let pewaktu = null

  const akar = document.createElement('div')
  akar.className = 'situation'
  isi.innerHTML = ''
  isi.appendChild(akar)

  function gambar() {
    const sekarang = new Date()
    const rekap = ringkasan(keadaan.berita || [], sekarang)
    const aktif = status.data ? aktifSekarang(status.data) : { lonjakan: [], isu: [] }
    const adaData = !!status.data

    const negatifTerbaru = [...rekap.negatif]
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 6)

    const gawat = aktif.lonjakan.length + aktif.isu.length

    akar.innerHTML = `
      <div class="komando">
        <header class="komando-kop">
          <div class="komando-kop-kiri">
            <div class="komando-nama">${amankan(KONFIG.nama)} · Situation Room</div>
            <div class="komando-tanggal">${amankan(tanggalPanjang(sekarang))} · ${amankan(jam(sekarang))} WIB</div>
          </div>
          <div class="komando-kop-kanan">
            ${!adaData
              ? `<span class="komando-status" data-nada="sedang">Membaca data…</span>`
              : gawat
                ? `<span class="komando-status" data-nada="kritis">${ikon('peringatan')} ${angka(gawat)} perlu dicermati</span>`
                : `<span class="komando-status" data-nada="positif">${ikon('centang')} Tidak ada lonjakan</span>`}
            <span class="komando-segar">
              mesin dibaca ${adaData ? amankan(jarakWaktu(status.data.dimuatPada)) : '—'}
            </span>
            <button class="tbl kecil" data-aksi="layar-penuh" title="Tampilkan layar penuh">
              ${ikon('dasbor')}Layar penuh</button>
          </div>
        </header>

        ${status.galat ? `
          <div class="pesan" data-nada="kritis">${ikon('peringatan')}
            <div><b>Data mesin gagal dibaca.</b> ${amankan(status.galat)}</div></div>` : ''}

        <div class="komando-angka">
          ${angkaBesar('Unit melonjak', aktif.lonjakan.length, aktif.lonjakan.length ? 'kritis' : 'positif', '24 jam terakhir')}
          ${angkaBesar('Isu lintas media', aktif.isu.length, aktif.isu.length ? 'tinggi' : 'positif', 'masih bergerak')}
          ${angkaBesar('Berita negatif', rekap.negatif.length, rekap.negatif.length ? 'tinggi' : 'positif', 'di arsip termuat')}
          ${angkaBesar('Mendesak', rekap.mendesak.length, rekap.mendesak.length ? 'tinggi' : 'positif', 'Tinggi dan Kritis')}
          ${angkaBesar('Menunggu telaah', rekap.antrean.length, rekap.antrean.length ? 'sedang' : 'positif', 'belum diputus analis')}
        </div>

        <div class="situation-tata">
          <section class="komando-sisi">
            <h2>Unit yang melonjak</h2>
            ${aktif.lonjakan.length ? `
              <ol class="komando-tiker">
                ${aktif.lonjakan.slice(0, 7).map((l) => baris('kritis',
                  `${String(Number(l.lipat || 0).toFixed(1)).replace('.', ',')}×`,
                  l.subjek,
                  `${angka(l.jumlah_24j)} berita negatif dalam 24 jam · ${jarakWaktu(l.terdeteksi)}`)).join('')}
              </ol>` : `<div class="komando-tenang">${ikon('centang')}
                <div><b>Tidak ada unit yang melewati ambang.</b></div></div>`}
          </section>

          <section class="komando-sisi">
            <h2>Isu lintas media</h2>
            ${aktif.isu.length ? `
              <ol class="komando-tiker">
                ${aktif.isu.slice(0, 7).map((i) => baris('tinggi',
                  `${angka(i.media)} media`,
                  ringkas(i.judul || 'Tanpa judul', 110),
                  `${angka(i.artikel)} artikel, ${angka(i.negatif)} negatif · ${jarakWaktu(i.terakhir)}`)).join('')}
              </ol>` : `<div class="komando-tenang">${ikon('centang')}
                <div><b>Tidak ada isu yang diangkat banyak media sekaligus.</b></div></div>`}
          </section>

          <section class="komando-sisi">
            <h2>Berita negatif terbaru</h2>
            ${negatifTerbaru.length ? `
              <ol class="komando-tiker">
                ${negatifTerbaru.map((b) => baris(
                  b.urgensi === 'Kritis' ? 'kritis' : b.urgensi === 'Tinggi' ? 'tinggi' : 'sedang',
                  b.urgensi || 'Negatif',
                  ringkas(b.judul || 'Tanpa judul', 110),
                  `${b.nama_upt ? ringkas(b.nama_upt, 40) : 'unit belum dipetakan'} · ${b.created_at ? jarakWaktu(b.created_at) : '—'}`)).join('')}
              </ol>` : `<div class="komando-tenang">${ikon('centang')}
                <div><b>Tidak ada berita negatif di arsip yang termuat.</b></div></div>`}
          </section>
        </div>

        <div class="mini-teks samar-teks">
          Layar ini disegarkan tiap satu menit. Daftar unit dan isu berasal dari mesin pendeteksi di peladen; ambangnya ada di halaman Deteksi Lonjakan.
        </div>
      </div>`
  }

  async function segarkan() {
    try {
      status.data = keadaan.demo ? lonjakanPeragaan() : await muatLonjakan()
      status.galat = status.data.galatLonjakan || status.data.galatIsu
        ? pesanRamah(status.data.galatLonjakan || status.data.galatIsu) : null
    } catch (galat) {
      status.galat = pesanRamah(galat)
    }
    if (akar.isConnected) gambar()
  }

  akar.addEventListener('click', (ev) => {
    if (!ev.target.closest('[data-aksi="layar-penuh"]')) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else akar.requestFullscreen?.().catch(() => { /* peramban menolak; layar biasa tetap jalan */ })
  })

  gambar()
  segarkan()

  /*
     Penyegar berhenti sendiri begitu halamannya tidak lagi ada di dokumen.
     Tanpa pemeriksaan ini, setiap kali seseorang membuka Situation Room, satu
     penyegar baru ikut hidup selamanya di latar belakang.
  */
  clearInterval(pewaktu)
  pewaktu = setInterval(() => {
    if (!akar.isConnected) { clearInterval(pewaktu); return }
    segarkan()
  }, SEGAR_MS)

  return {
    judul: 'Situation Room',
    sub: 'Layar dinding: unit yang melonjak dan isu lintas media',
  }
}
