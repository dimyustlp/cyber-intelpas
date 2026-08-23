/**
 * Pemetaan UPT — memutuskan unit mana yang dimaksud sebuah berita.
 *
 * Mesin pencocokan (pencocokan-upt.js) sudah selesai dan teruji sejak lama.
 * Yang tidak pernah ada adalah tempat memakainya: Edge Function klasifikasi
 * menjalankannya dan hanya menyimpan pemenang otomatis — daftar kandidatnya
 * dihitung, ditampilkan pada jawaban HTTP, lalu dibuang begitu saja. Analis
 * tidak pernah melihat kandidat itu, dan berita yang skornya di bawah ambang
 * 0,72 tertahan tanpa jalan keluar selain menyunting baris basis data secara
 * langsung.
 *
 * Halaman ini menjalankan ulang mesin yang sama persis, di peramban, atas
 * berita yang belum terpetakan — lalu menampilkan kandidatnya sebagai tombol.
 * Satu tekan menuliskan keputusannya. Tidak ada kandidat yang cocok pun bukan
 * jalan buntu: ada pencarian bebas ke seluruh 492 unit.
 */

import { kartu, tombol, keping, kosong, pesanSistem, roti } from '../ui/komponen.js'
import { amankan, angka, ringkas, jarakWaktu } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, perbarui, pesanRamah } from '../lib/api.js'
import { bangunIndeks, cocokkanUpt, belumTerpetakan } from '../lib/pencocokan-upt.js'

const keadaanPemetaan = {
  nomor: 0,
  sibuk: false,
  dimuat: false,
  indeks: null,
  antrean: [],
  selesai: new Set(),
  dipetakan: 0,
  dilewati: 0,
  cari: '',
}

/** Contoh UPT untuk mode peragaan — cukup untuk mendemonstrasikan alurnya. */
const UPT_DEMO = [
  { nama_upt: 'Lapas Kelas IIA Cilegon', jenis_upt: 'Lapas', kelas_upt: 'IIA', subjenis_upt: 'Umum', provinsi: 'Banten', kanwil: 'Kanwil Banten', kabupaten_kota: 'Kota Cilegon' },
  { nama_upt: 'Lapas Kelas I Semarang', jenis_upt: 'Lapas', kelas_upt: 'I', subjenis_upt: 'Umum', provinsi: 'Jawa Tengah', kanwil: 'Kanwil Jawa Tengah', kabupaten_kota: 'Kota Semarang' },
  { nama_upt: 'Rutan Kelas I Medan', jenis_upt: 'Rutan', kelas_upt: 'I', subjenis_upt: 'Umum', provinsi: 'Sumatera Utara', kanwil: 'Kanwil Sumatera Utara', kabupaten_kota: 'Kota Medan' },
  { nama_upt: 'Lapas Kelas IIB Warungkiara', jenis_upt: 'Lapas', kelas_upt: 'IIB', subjenis_upt: 'Umum', provinsi: 'Jawa Barat', kanwil: 'Kanwil Jawa Barat', kabupaten_kota: 'Kabupaten Sukabumi' },
  { nama_upt: 'Lapas Kelas IIA Kerobokan', jenis_upt: 'Lapas', kelas_upt: 'IIA', subjenis_upt: 'Umum', provinsi: 'Bali', kanwil: 'Kanwil Bali', kabupaten_kota: 'Kabupaten Badung' },
]

const BERITA_DEMO_TANPA_UPT = [
  { id: 'demo-p1', judul: 'Sidak Malam di Lapas Cilegon, Petugas Temukan Barang Terlarang di Blok Hunian', ringkasan: 'Sidak dilaksanakan sekitar pukul 23.00 WIB oleh regu pengamanan.', media: 'Radar Banten', created_at: new Date().toISOString(), status_verifikasi: 'Belum Ditelaah', kategori: 'Operasional dan Pengamanan Rutin' },
  { id: 'demo-p2', judul: 'Warga Binaan Ikuti Pelatihan Menjahit di Lapas Semarang', ringkasan: 'Sepuluh warga binaan mengikuti pelatihan menjahit bersama Dinas Ketenagakerjaan.', media: 'Suara Merdeka', created_at: new Date().toISOString(), status_verifikasi: 'Belum Ditelaah', kategori: 'Narasi Positif dan Kehumasan' },
  { id: 'demo-p3', judul: 'Kunjungan Kerja Kepala Kanwil ke Rutan Medan', ringkasan: 'Kepala Kanwil meninjau kesiapan pengamanan menjelang HUT RI.', media: 'Waspada Online', created_at: new Date().toISOString(), status_verifikasi: 'Belum Ditelaah', kategori: 'Narasi Positif dan Kehumasan' },
]

function gambarUlang() {
  document.dispatchEvent(new CustomEvent('gambar-ulang'))
}

/** Susunan antrean: yang punya kandidat kuat dulu, supaya keputusan cepat dulu diambil. */
function susunAntrean(daftar, indeks) {
  return daftar
    .filter((b) => belumTerpetakan(b.nama_upt))
    .filter((b) => !keadaanPemetaan.selesai.has(b.id))
    .map((b) => {
      const teks = [b.judul, b.ringkasan, b.raw_analysis, b.caption_manual, b.media].filter(Boolean).join(' . ')
      const hasil = cocokkanUpt(teks, indeks)
      return { berita: b, hasil }
    })
    .sort((a, b) => b.hasil.skor - a.hasil.skor)
}

function kemajuan(sisa, awal) {
  const selesai = awal - sisa
  const bagian = awal ? Math.round((selesai / awal) * 100) : 0
  return `
    <div class="telaah-kemajuan">
      <div class="telaah-kemajuan-bilah"><i style="width:${bagian}%"></i></div>
      <div class="telaah-kemajuan-teks">
        <span><b>${angka(selesai)}</b> dipetakan sesi ini</span>
        <span>${angka(sisa)} menunggu</span>
      </div>
    </div>`
}

function panelKandidat(hasil) {
  if (!hasil.saran.length) {
    return pesanSistem(
      '<b>Tidak ada kandidat.</b> Tidak ada nama unit yang cukup mirip ditemukan dalam teks. '
      + 'Gunakan pencarian bebas di sebelah kanan.',
      'netral', 'info',
    )
  }
  return `<div class="kandidat-daftar">${hasil.saran.map((s, i) => `
    <button class="kandidat-baris" data-aksi="pilih" data-index="${i}">
      <span class="kandidat-skor" data-kuat="${s.skor >= 0.72}">${Math.round(s.skor * 100)}%</span>
      <span class="kandidat-teks">
        <span class="kandidat-nama">${amankan(s.nama)}</span>
        <span class="kandidat-ket">${amankan([s.provinsi, s.kanwil].filter(Boolean).join(' · '))} — ${amankan(s.alasan)}</span>
      </span>
      <span class="kandidat-panah">${ikon('panahKanan')}</span>
    </button>`).join('')}</div>`
}

export function halamanPemetaan({ keadaan, isi }) {
  const demo = keadaan.demo

  function gambar() {
    const antrean = keadaanPemetaan.antrean
    const awal = antrean.length + keadaanPemetaan.selesai.size
    const butir = antrean[Math.min(keadaanPemetaan.nomor, Math.max(0, antrean.length - 1))]

    if (!keadaanPemetaan.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:200px"></div>' })
      return
    }

    if (!antrean.length) {
      isi.innerHTML = `<div class="tumpuk">
        ${kemajuan(0, Math.max(awal, 1))}
        ${kartu({
          isi: kosong(
            'Tidak ada berita menunggu pemetaan',
            keadaanPemetaan.selesai.size
              ? `${angka(keadaanPemetaan.dipetakan)} berita dipetakan dan ${angka(keadaanPemetaan.dilewati)} dilewati pada sesi ini.`
              : 'Seluruh berita dalam lingkup Pemasyarakatan sudah terhubung ke sebuah UPT.',
            tombol({ label: 'Kembali ke dasbor', ikon: 'dasbor', gaya: 'utama', halaman: 'dasbor' }),
          ),
        })}
      </div>`
      return
    }

    const { berita: b, hasil } = butir
    const teksSaring = keadaanPemetaan.cari.trim().toLowerCase()
    const hasilCari = teksSaring.length >= 2
      ? keadaanPemetaan.indeks.entri
        .filter((e) => e.namaNormal.includes(teksSaring))
        .slice(0, 8)
      : []

    isi.innerHTML = `
      <div class="tumpuk">
        ${kemajuan(antrean.length, Math.max(awal, 1))}

        ${kartu({
          judul: 'Berita yang dipetakan',
          ket: `Nomor ${keadaanPemetaan.nomor + 1} dari ${angka(antrean.length)} dalam antrean — diurutkan dari kandidat terkuat`,
          aksi: tombol({ label: 'Lewati', ikon: 'panahKanan', gaya: 'samar', kecil: true, aksi: 'lewati' }),
          isi: `
            <article class="telaah-berita">
              <h3>${amankan(b.judul || '(tanpa judul)')}</h3>
              <div class="telaah-meta">
                ${[b.media, b.kategori, jarakWaktu(b.created_at)].filter(Boolean).map(amankan).join(' <span class="pemisah">·</span> ')}
              </div>
              ${b.ringkasan ? `<p class="telaah-ringkas">${amankan(ringkas(b.ringkasan, 320))}</p>` : ''}
            </article>

            <div class="kisi kisi-utama-samping" style="margin-top:16px">
              <div>
                <span class="label-mono">Kandidat dari mesin pencocokan</span>
                <div style="margin-top:8px">${panelKandidat(hasil)}</div>
              </div>
              <div>
                <span class="label-mono">Cari UPT lain</span>
                <label class="cari" style="margin-top:8px">
                  ${ikon('cari')}
                  <input class="masukan" id="cari-upt" type="search" placeholder="Ketik nama unit…"
                         value="${amankan(keadaanPemetaan.cari)}" autocomplete="off">
                </label>
                ${hasilCari.length ? `<div class="kandidat-daftar" style="margin-top:8px">${hasilCari.map((e, i) => `
                  <button class="kandidat-baris" data-aksi="pilih-cari" data-index="${i}">
                    <span class="kandidat-teks">
                      <span class="kandidat-nama">${amankan(e.nama)}</span>
                      <span class="kandidat-ket">${amankan([e.provinsi, e.kanwil].filter(Boolean).join(' · '))}</span>
                    </span>
                    <span class="kandidat-panah">${ikon('panahKanan')}</span>
                  </button>`).join('')}</div>`
                  : teksSaring.length >= 2 ? '<p class="ket" style="margin-top:8px">Tidak ada unit yang cocok.</p>' : ''}
              </div>
            </div>`,
        })}
      </div>`

    isi.querySelector('#cari-upt')?.addEventListener('input', (ev) => {
      keadaanPemetaan.cari = ev.target.value
      gambar()
      isi.querySelector('#cari-upt')?.focus()
      const v = isi.querySelector('#cari-upt')
      if (v) v.selectionStart = v.selectionEnd = v.value.length
    })

    isi.querySelector('#cari-upt')?.focus()
  }

  async function tetapkan(nama) {
    const antrean = keadaanPemetaan.antrean
    const butir = antrean[Math.min(keadaanPemetaan.nomor, Math.max(0, antrean.length - 1))]
    if (!butir || keadaanPemetaan.sibuk) return
    keadaanPemetaan.sibuk = true

    butir.berita.nama_upt = nama
    keadaanPemetaan.selesai.add(butir.berita.id)
    keadaanPemetaan.dipetakan += 1
    keadaanPemetaan.antrean = susunAntrean(keadaanPemetaan.sumber, keadaanPemetaan.indeks)
    keadaanPemetaan.nomor = 0
    keadaanPemetaan.cari = ''
    gambar()

    if (demo) { roti(`Dipetakan ke "${nama}" (mode peragaan, tidak disimpan).`, 'sedang'); keadaanPemetaan.sibuk = false; return }

    try {
      await perbarui('berita', { id: `eq.${butir.berita.id}` }, { nama_upt: nama })
      roti(`Ditautkan ke "${nama}".`, 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    } finally {
      keadaanPemetaan.sibuk = false
    }
  }

  function lewati() {
    const antrean = keadaanPemetaan.antrean
    if (!antrean.length) return
    keadaanPemetaan.nomor = (keadaanPemetaan.nomor + 1) % antrean.length
    keadaanPemetaan.dilewati += 1
    keadaanPemetaan.cari = ''
    gambar()
  }

  isi.addEventListener('click', (ev) => {
    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (!aksi) return
    if (aksi === 'lewati') { lewati(); return }

    const baris = ev.target.closest('.kandidat-baris')
    const index = Number(baris?.dataset.index ?? -1)
    if (index < 0) return

    if (aksi === 'pilih') {
      const antrean = keadaanPemetaan.antrean
      const butir = antrean[Math.min(keadaanPemetaan.nomor, Math.max(0, antrean.length - 1))]
      const s = butir?.hasil.saran[index]
      if (s) tetapkan(s.nama)
    } else if (aksi === 'pilih-cari') {
      const teksSaring = keadaanPemetaan.cari.trim().toLowerCase()
      const e = keadaanPemetaan.indeks.entri.filter((x) => x.namaNormal.includes(teksSaring))[index]
      if (e) tetapkan(e.nama)
    }
  })

  async function muat() {
    if (demo) {
      keadaanPemetaan.indeks = bangunIndeks(UPT_DEMO)
      keadaanPemetaan.sumber = BERITA_DEMO_TANPA_UPT
      keadaanPemetaan.antrean = susunAntrean(keadaanPemetaan.sumber, keadaanPemetaan.indeks)
      keadaanPemetaan.dimuat = true
      gambar()
      return
    }
    try {
      const [daftarUpt, berita] = await Promise.all([
        ambil('upt', {
          select: 'nama_upt,jenis_upt,kelas_upt,subjenis_upt,provinsi,kanwil,kabupaten_kota,location_hint',
          aktif: 'eq.true',
          limit: 1000,
        }),
        ambil('berita', {
          select: 'id,judul,ringkasan,raw_analysis,caption_manual,media,nama_upt,kategori,status_verifikasi,created_at',
          deleted_at: 'is.null',
          kategori: 'neq.Di Luar Lingkup',
          order: 'created_at.desc',
          limit: 500,
        }),
      ])
      keadaanPemetaan.indeks = bangunIndeks(daftarUpt || [])
      keadaanPemetaan.sumber = berita || []
      keadaanPemetaan.antrean = susunAntrean(keadaanPemetaan.sumber, keadaanPemetaan.indeks)
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      keadaanPemetaan.indeks = bangunIndeks([])
      keadaanPemetaan.sumber = []
      keadaanPemetaan.antrean = []
    }
    keadaanPemetaan.dimuat = true
    gambar()
  }

  gambar()
  muat()

  return {
    judul: 'Pemetaan UPT',
    sub: 'Menautkan berita ke unit pelaksana teknis yang dimaksud',
  }
}
