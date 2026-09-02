/**
 * Koordinat UPT.
 *
 * Alat verifikasi titik, satu unit pada satu waktu.
 *
 * Keadaan yang melahirkan halaman ini: dari 531 unit, 530 koordinatnya masih
 * berupa titik pusat kota atau kabupaten yang diambil dari dataset geocode
 * administratif, bukan alamat gedungnya. Peta Sebaran menyatakan itu di layar
 * dan tidak menyembunyikannya — tetapi menyatakan sebuah cacat tidak
 * memperbaikinya. Yang memperbaikinya adalah seseorang yang membuka unit satu
 * per satu, membandingkan titiknya dengan alamat yang ia tahu, lalu
 * membetulkan atau membenarkannya.
 *
 * Tiga keputusan yang menentukan isi berkas ini:
 *
 *   Pratinjaunya digambar dari garis pantai yang sama dengan Peta Sebaran,
 *   bukan dari ubin peta luar. Alasannya sama persis: aplikasi ini tidak
 *   menarik apa pun dari peladen pihak ketiga, dan peta yang bergantung
 *   padanya akan kosong justru di jaringan kantor yang memblokirnya. Yang bisa
 *   diperiksa dengan pratinjau ini memang terbatas — apakah titiknya jatuh di
 *   pulau yang benar, di provinsi yang benar, di sisi yang benar. Itu sudah
 *   menangkap kelas kesalahan yang paling sering: bujur dan lintang tertukar,
 *   atau tanda minus hilang.
 *
 *   Memverifikasi tanpa mengubah adalah tindakan yang sah dan punya tombolnya
 *   sendiri. Sebagian besar unit koordinatnya memang sudah cukup baik; yang
 *   dibutuhkan hanya seseorang yang menyatakan sudah memeriksanya. Kalau
 *   satu-satunya jalan menandai "sudah diperiksa" adalah mengubah angkanya,
 *   tidak akan ada yang tertandai.
 *
 *   Angka yang mustahil ditolak di sini, bukan di basis data. Lintang di luar
 *   -11..6 dan bujur di luar 95..142 berada di luar Indonesia, dan titik yang
 *   jatuh di Samudra Hindia tidak akan pernah terlihat salah oleh siapa pun
 *   yang tidak kebetulan membuka petanya.
 */

import { kartu, keping, tombol, roti } from '../ui/komponen.js'
import { amankan, angka, persen, jarakWaktu, tanggalJam } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, perbarui, pesanRamah, profilSekarang } from '../lib/api.js'
import { DARATAN, TETANGGA } from '../lib/peta-indonesia.js'

/** Mutu koordinat, dari yang paling dipercaya ke yang paling perlu diperiksa. */
const MUTU = [
  { nama: 'Terverifikasi', nada: 'positif', ket: 'Sudah dicocokkan dengan alamat gedungnya.' },
  { nama: 'Alamat gedung', nada: 'positif', ket: 'Titik diambil dari alamat unit, belum ditandatangani pemeriksa.' },
  { nama: 'Pusat kota/kabupaten—kandidat', nada: 'sedang', ket: 'Titik pusat wilayah dari dataset administratif.' },
  { nama: 'Titik wilayah—warisan unit terdekat', nada: 'tinggi', ket: 'Diwarisi dari unit lain di tempat yang sama.' },
  { nama: 'Pusat provinsi—perlu verifikasi', nada: 'kritis', ket: 'Hanya titik pusat provinsi. Kesalahannya bisa ratusan kilometer.' },
]

const nadaMutu = (nama) => MUTU.find((m) => m.nama === nama)?.nada || 'netral'

/** Batas kewajaran koordinat Indonesia, sedikit lebih longgar dari kotak daratan. */
const SAH = { latMin: -11.5, latMaks: 6.5, lonMin: 94.5, lonMaks: 141.5 }

const keadaanKoordinat = {
  dimuat: false,
  sibuk: false,
  galat: null,
  unit: [],
  dipilih: null,
  cari: '',
  saringMutu: 'Semua mutu',
  saringKanwil: 'Seluruh Indonesia',
  hanyaBelum: true,
}

/* ------------------------------------------------------------------- muat */

async function muat(keadaan) {
  if (keadaan.demo) {
    const { UNIT_CONTOH } = await import('../lib/peta-upt-contoh.js')
    keadaanKoordinat.unit = UNIT_CONTOH.map(([nama, jenis, kanwil, provinsi, kabupaten, lat, lon], i) => ({
      id: `demo-${i}`,
      nama_upt: nama,
      jenis_upt: jenis,
      kanwil,
      provinsi,
      kabupaten_kota: kabupaten,
      latitude: lat,
      longitude: lon,
      coordinate_quality: i === 0 ? 'Terverifikasi' : 'Pusat kota/kabupaten—kandidat',
      coordinate_source: 'Kandidat pusat wilayah dari dataset geocode administratif',
      coordinate_verified_at: i === 0 ? new Date().toISOString() : null,
      coordinate_verified_by: i === 0 ? 'peraga' : null,
      catatan_verifikasi: null,
      alamat: null,
    }))
    keadaanKoordinat.dimuat = true
    return
  }

  const baris = await ambil('upt', {
    select: 'id,nama_upt,jenis_upt,kanwil,provinsi,kabupaten_kota,alamat,latitude,longitude,'
      + 'coordinate_quality,coordinate_source,coordinate_score,coordinate_verified_at,'
      + 'coordinate_verified_by,catatan_verifikasi,location_hint',
    aktif: 'eq.true',
    order: 'nama_upt.asc',
    limit: 1000,
  }) || []

  keadaanKoordinat.unit = baris
  keadaanKoordinat.dimuat = true
}

/* --------------------------------------------------------------- penyaring */

function saring() {
  const kata = keadaanKoordinat.cari.trim().toLowerCase()
  return keadaanKoordinat.unit
    .filter((u) => keadaanKoordinat.saringKanwil.startsWith('Seluruh') || u.kanwil === keadaanKoordinat.saringKanwil)
    .filter((u) => keadaanKoordinat.saringMutu.startsWith('Semua') || u.coordinate_quality === keadaanKoordinat.saringMutu)
    .filter((u) => !keadaanKoordinat.hanyaBelum || !u.coordinate_verified_at)
    .filter((u) => !kata || [u.nama_upt, u.provinsi, u.kabupaten_kota, u.kanwil]
      .filter(Boolean).join(' ').toLowerCase().includes(kata))
    .slice(0, 300)
}

/* ---------------------------------------------------------------- pratinjau */

/**
 * Peta kecil yang memusatkan pandangan pada satu titik.
 *
 * Lebar pandangnya tetap enam derajat — kira-kira 660 km — bukan menyesuaikan
 * isi. Skala yang berubah-ubah membuat dua unit yang diperiksa berurutan
 * tampil pada perbesaran berbeda, dan mata kehilangan pembanding yang justru
 * dibutuhkan untuk menilai apakah titiknya masuk akal.
 */
function pratinjau(lat, lon) {
  const lebar = 6
  const tinggi = lebar * 0.62
  const x = lon - lebar / 2
  const y = -lat - tinggi / 2

  const jalur = (d) => d.replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g, (_, huruf, bujur, lintang) =>
    `${huruf}${bujur} ${-Number(lintang)}`)

  return `
    <div class="koordinat-peta">
      <svg viewBox="${x} ${y} ${lebar} ${tinggi}" preserveAspectRatio="xMidYMid meet"
           role="img" aria-label="Pratinjau letak titik pada garis pantai Indonesia">
        <g class="peta-tetangga">${TETANGGA.map((d) => `<path d="${jalur(d)}"/>`).join('')}</g>
        <g class="peta-halo">${DARATAN.map((d) => `<path d="${jalur(d)}"/>`).join('')}</g>
        <g class="peta-daratan">${DARATAN.map((d) => `<path d="${jalur(d)}"/>`).join('')}</g>
        <g class="koordinat-silang">
          <line x1="${x}" y1="${-lat}" x2="${x + lebar}" y2="${-lat}"/>
          <line x1="${lon}" y1="${y}" x2="${lon}" y2="${y + tinggi}"/>
          <circle cx="${lon}" cy="${-lat}" r="0.09"/>
          <circle class="denyut" cx="${lon}" cy="${-lat}" r="0.09"/>
        </g>
      </svg>
      <span class="koordinat-skala">bidang pandang ± 660 km</span>
    </div>`
}

/* ------------------------------------------------------------------ rincian */

function rincian(u, bolehUbah) {
  const sah = titikSah(u.latitude, u.longitude)
  const mutu = MUTU.find((m) => m.nama === u.coordinate_quality)

  return `
    <div class="kasus-kepala">
      <div class="kasus-kepala-teks">
        <span class="label-mono">${amankan(u.jenis_upt || 'UPT')}</span>
        <h3>${amankan(u.nama_upt)}</h3>
        <div class="baris gap-6" style="margin-top:6px">
          ${keping(u.coordinate_quality || 'Tanpa keterangan mutu', nadaMutu(u.coordinate_quality))}
          ${u.coordinate_verified_at
            ? keping(`Diperiksa ${jarakWaktu(u.coordinate_verified_at)}`, 'positif', true)
            : keping('Belum diperiksa', 'sedang', true)}
        </div>
        <p class="mini-teks samar-teks" style="margin-top:6px">
          ${amankan([u.kabupaten_kota, u.provinsi].filter(Boolean).join(', ') || '—')}<br>
          ${amankan(u.kanwil || '')}
        </p>
      </div>
    </div>

    ${sah ? '' : `
      <div class="pesan" data-nada="kritis" style="margin-bottom:13px">
        ${ikon('peringatan')}
        <div>
          <b>Koordinat ini di luar wilayah Indonesia.</b>
          Penyebab yang paling sering: bujur dan lintang tertukar, atau tanda minus pada
          lintang hilang. Titik ini tidak akan tergambar benar di Peta Sebaran.
        </div>
      </div>`}

    ${pratinjau(Number(u.latitude) || 0, Number(u.longitude) || 0)}

    <div class="siklus-bagian">
      <div class="siklus-bagian-kop"><span class="label-mono">Titik sekarang</span></div>
      <dl class="riwayat-ringkas">
        <div><dt>Lintang</dt><dd class="angka">${Number(u.latitude ?? 0).toFixed(6)}</dd></div>
        <div><dt>Bujur</dt><dd class="angka">${Number(u.longitude ?? 0).toFixed(6)}</dd></div>
        <div><dt>Asal titik</dt><dd>${amankan(u.coordinate_source || '—')}</dd></div>
        <div><dt>Alamat tercatat</dt><dd>${amankan(u.alamat || 'belum ada')}</dd></div>
      </dl>
      ${mutu ? `<p class="mini-teks samar-teks" style="margin-top:9px">${amankan(mutu.ket)}</p>` : ''}
      ${u.coordinate_verified_at ? `
        <p class="mini-teks samar-teks" style="margin-top:6px">
          Diperiksa ${amankan(tanggalJam(u.coordinate_verified_at))}
          oleh ${amankan(u.coordinate_verified_by || '—')}
          ${u.catatan_verifikasi ? ` — ${amankan(u.catatan_verifikasi)}` : ''}
        </p>` : ''}
    </div>

    ${bolehUbah ? `
      <div class="siklus-bagian">
        <div class="siklus-bagian-kop"><span class="label-mono">Perbaiki titik</span></div>
        <div class="borang-kisi" data-peran="borang-koordinat">
          <label class="bidang">
            <span class="label-mono">Lintang</span>
            <input class="masukan" type="number" step="0.000001" data-bidang="latitude"
                   value="${Number(u.latitude ?? 0)}">
            <span class="mini-teks samar-teks">Negatif di selatan khatulistiwa.</span>
          </label>
          <label class="bidang">
            <span class="label-mono">Bujur</span>
            <input class="masukan" type="number" step="0.000001" data-bidang="longitude"
                   value="${Number(u.longitude ?? 0)}">
            <span class="mini-teks samar-teks">Antara 95 dan 141 untuk Indonesia.</span>
          </label>
          <label class="bidang">
            <span class="label-mono">Mutu titik</span>
            <select class="pilihan" data-bidang="coordinate_quality">
              ${MUTU.map((m) => `<option${m.nama === u.coordinate_quality ? ' selected' : ''}>${amankan(m.nama)}</option>`).join('')}
            </select>
          </label>
          <label class="bidang">
            <span class="label-mono">Alamat gedung</span>
            <input class="masukan" type="text" data-bidang="alamat" value="${amankan(u.alamat || '')}"
                   placeholder="Jalan, nomor, kelurahan">
          </label>
          <label class="bidang penuh">
            <span class="label-mono">Catatan pemeriksaan</span>
            <textarea class="masukan area" rows="2" data-bidang="catatan_verifikasi"
              placeholder="Dari mana titik ini diperoleh, dan apa yang dicocokkan.">${amankan(u.catatan_verifikasi || '')}</textarea>
          </label>
        </div>

        <div class="baris gap-6" style="margin-top:13px">
          ${tombol({
            label: 'Simpan dan tandai diperiksa', ikon: 'centang', gaya: 'utama',
            aksi: 'simpan-koordinat', nonaktif: keadaanKoordinat.sibuk,
          })}
          ${tombol({
            label: 'Sudah benar, tandai saja', ikon: 'keputusan',
            aksi: 'tandai-benar', nonaktif: keadaanKoordinat.sibuk,
          })}
        </div>
        <p class="mini-teks samar-teks" style="margin-top:8px">
          Tombol kedua menandai titiknya sudah diperiksa tanpa mengubah angkanya — sebagian
          besar unit memang hanya butuh itu.
        </p>
      </div>` : `
      <div class="pesan" data-nada="aksen">
        ${ikon('gembok')}
        <div>Peran Anda dapat membaca koordinat, tetapi tidak mengubahnya.</div>
      </div>`}`
}

function titikSah(lat, lon) {
  const a = Number(lat)
  const b = Number(lon)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return a >= SAH.latMin && a <= SAH.latMaks && b >= SAH.lonMin && b <= SAH.lonMaks
}

/* ------------------------------------------------------------------ halaman */

export function halamanKoordinat({ keadaan, isi }) {
  // Policy `upt_write_curator` menerima superadmin dan analis intelijen media.
  // Menunya sendiri hanya terbuka bagi superadmin; syarat di sini dibiarkan
  // longgar supaya kelak, bila menunya dibuka untuk analis, halamannya tidak
  // perlu ikut disunting.
  const bolehUbah = ['super_admin', 'media_intelligence_analyst'].includes(keadaan.profil?.role)

  function gambar() {
    if (keadaanKoordinat.galat) {
      isi.innerHTML = kartu({
        isi: `<div class="pesan" data-nada="kritis">${ikon('peringatan')}
          <div><b>Data induk unit gagal dimuat.</b> ${amankan(keadaanKoordinat.galat)}</div></div>`,
      })
      return
    }
    if (!keadaanKoordinat.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:420px"></div>' })
      return
    }

    const semua = keadaanKoordinat.unit
    const terlihat = saring()
    const dipilih = semua.find((u) => u.id === keadaanKoordinat.dipilih)
    const diperiksa = semua.filter((u) => u.coordinate_verified_at).length
    const takSah = semua.filter((u) => !titikSah(u.latitude, u.longitude)).length
    const kanwilAda = [...new Set(semua.map((u) => u.kanwil).filter(Boolean))].sort()

    isi.innerHTML = `
      <div class="tumpuk">
        <div class="kisi kisi-4">
          ${ubinKoordinat('Unit aktif', semua.length, 'Lapas, Rutan, LPKA, dan lainnya')}
          ${ubinKoordinat('Sudah diperiksa', diperiksa,
            semua.length ? `${persen(diperiksa, semua.length)} dari seluruh unit` : '—',
            diperiksa ? 'positif' : 'sedang')}
          ${ubinKoordinat('Menunggu pemeriksaan', semua.length - diperiksa,
            'masih memakai titik pusat wilayah', 'sedang')}
          ${ubinKoordinat('Di luar batas Indonesia', takSah,
            takSah ? 'perlu dibetulkan segera' : 'seluruh titik masuk akal',
            takSah ? 'kritis' : 'positif')}
        </div>

        <div class="pesan" data-nada="aksen">
          ${ikon('info')}
          <div>
            <b>Yang bisa diperiksa dengan pratinjau di sini terbatas</b> — apakah titiknya jatuh
            di pulau, provinsi, dan sisi yang benar. Itu sudah cukup menangkap kesalahan yang
            paling sering terjadi: bujur dan lintang tertukar, atau tanda minus yang hilang.
            Ketepatan sampai alamat gedung dicocokkan dengan dokumen unit, bukan dengan peta ini.
          </div>
        </div>

        <div class="bilah-alat">
          <label class="cari" style="max-width:250px">
            ${ikon('cari')}
            <input class="masukan" type="search" data-peran="cari-unit"
                   value="${amankan(keadaanKoordinat.cari)}"
                   placeholder="Cari unit, kabupaten, provinsi" aria-label="Cari unit">
          </label>

          <select class="pilihan" data-saring="saringKanwil" aria-label="Saring kantor wilayah"
                  style="width:auto;min-width:220px">
            ${['Seluruh Indonesia', ...kanwilAda].map((k) =>
              `<option${k === keadaanKoordinat.saringKanwil ? ' selected' : ''}>${amankan(k)}</option>`).join('')}
          </select>

          <select class="pilihan" data-saring="saringMutu" aria-label="Saring mutu titik"
                  style="width:auto;min-width:220px">
            ${['Semua mutu', ...MUTU.map((m) => m.nama)].map((m) =>
              `<option${m === keadaanKoordinat.saringMutu ? ' selected' : ''}>${amankan(m)}</option>`).join('')}
          </select>

          <button class="tbl kecil${keadaanKoordinat.hanyaBelum ? ' utama' : ''}"
                  data-aksi="hanya-belum" aria-pressed="${keadaanKoordinat.hanyaBelum}">
            ${ikon('saring')}Hanya yang belum diperiksa
          </button>

          <div class="dorong">
            <span class="mini-teks samar-teks">${angka(terlihat.length)} unit tampil</span>
          </div>
        </div>

        <div class="siklus-tata">
          <div class="siklus-antrean">
            <div class="siklus-antrean-kop">
              <span class="label-mono">Daftar unit</span>
              <span class="mini-teks samar-teks dorong">300 teratas</span>
            </div>
            <ul>${daftarUnit(terlihat)}</ul>
          </div>
          <div class="siklus-rinci">
            ${dipilih ? rincian(dipilih, bolehUbah) : `
              <div class="siklus-kosong">
                ${ikon('lapangan')}
                <h3>Pilih satu unit di sebelah kiri</h3>
                <p>Pratinjau letaknya, koordinat yang tersimpan, dan tempat membetulkannya
                   muncul di sini.</p>
              </div>`}
          </div>
        </div>
      </div>`
  }

  function ubinKoordinat(label, nilai, kaki, nada = 'netral') {
    return `
      <div class="ubin" data-nada="${amankan(nada)}">
        <div class="ubin-label">${amankan(label)}</div>
        <div class="ubin-nilai angka">${angka(nilai)}</div>
        <div class="ubin-kaki">${amankan(kaki)}</div>
      </div>`
  }

  function daftarUnit(daftar) {
    if (!daftar.length) {
      return `<li><p class="ket" style="padding:16px 10px">
        Tidak ada unit yang cocok dengan saringan ini.</p></li>`
    }
    return daftar.map((u) => `
      <li>
        <button class="antrean-baris${u.id === keadaanKoordinat.dipilih ? ' terpilih' : ''}"
                data-pilih="${amankan(u.id)}">
          <span class="antrean-tanda" data-nada="${amankan(nadaMutu(u.coordinate_quality))}"></span>
          <span class="antrean-isi">
            <span class="antrean-judul">${amankan(u.nama_upt)}</span>
            <span class="mini-teks samar-teks">
              ${amankan([u.kabupaten_kota, u.provinsi].filter(Boolean).join(', ') || '—')}
            </span>
          </span>
          ${u.coordinate_verified_at
            ? `<span class="koordinat-tanda" title="Sudah diperiksa">${ikon('centang')}</span>`
            : !titikSah(u.latitude, u.longitude)
              ? `<span class="koordinat-tanda bahaya" title="Di luar batas Indonesia">${ikon('peringatan')}</span>`
              : ''}
        </button>
      </li>`).join('')
  }

  /* --------------------------------------------------------------- tindakan */

  async function simpan(u, { ubahAngka }) {
    const perubahan = {
      coordinate_verified_at: new Date().toISOString(),
      coordinate_verified_by: profilSekarang()?.username || 'tidak dikenali',
    }

    if (ubahAngka) {
      const borang = isi.querySelector('[data-peran="borang-koordinat"]')
      if (!borang) return
      const nilai = {}
      for (const b of borang.querySelectorAll('[data-bidang]')) nilai[b.dataset.bidang] = b.value

      const lat = Number(nilai.latitude)
      const lon = Number(nilai.longitude)
      if (!titikSah(lat, lon)) {
        roti('Koordinat itu di luar wilayah Indonesia. Periksa apakah lintang dan bujurnya '
          + 'tertukar, atau tanda minusnya hilang.', 'kritis', 7000)
        return
      }

      Object.assign(perubahan, {
        latitude: lat,
        longitude: lon,
        coordinate_quality: nilai.coordinate_quality,
        alamat: nilai.alamat?.trim() || null,
        catatan_verifikasi: nilai.catatan_verifikasi?.trim() || null,
        // Sumbernya ikut ditulis ulang: titik yang sudah dibetulkan manusia
        // bukan lagi kandidat dari dataset geocode, dan membiarkan keterangan
        // lamanya membuat riwayatnya berbohong.
        coordinate_source: 'Diperiksa dan ditetapkan petugas',
        updated_at: new Date().toISOString(),
      })
    }

    keadaanKoordinat.sibuk = true
    gambar()
    try {
      if (!keadaan.demo) await perbarui('upt', { id: `eq.${u.id}` }, perubahan)
      Object.assign(u, perubahan)
      roti(ubahAngka ? 'Koordinat diperbarui dan ditandai diperiksa.'
        : 'Ditandai sudah diperiksa.', 'positif')

      // Yang sudah diperiksa hilang dari daftar bila saringannya menyala, jadi
      // unit berikutnya langsung dibuka. Tanpa ini, petugas harus kembali ke
      // daftar dan mencari sendiri setelah tiap unit — dan 530 kali menemukan
      // sendiri baris berikutnya adalah alasan pekerjaan ini tidak selesai.
      if (keadaanKoordinat.hanyaBelum) {
        const berikut = saring()[0]
        keadaanKoordinat.dipilih = berikut?.id || null
      }
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      console.error(galat)
    } finally {
      keadaanKoordinat.sibuk = false
      gambar()
    }
  }

  /* ---------------------------------------------------------------- penyimak */

  isi.addEventListener('click', (ev) => {
    const pilih = ev.target.closest('[data-pilih]')?.dataset.pilih
    if (pilih) { keadaanKoordinat.dipilih = pilih; gambar(); return }

    const u = keadaanKoordinat.unit.find((x) => x.id === keadaanKoordinat.dipilih)
    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (aksi === 'hanya-belum') {
      keadaanKoordinat.hanyaBelum = !keadaanKoordinat.hanyaBelum
      gambar()
    } else if (aksi === 'simpan-koordinat' && u) simpan(u, { ubahAngka: true })
    else if (aksi === 'tandai-benar' && u) simpan(u, { ubahAngka: false })
  })

  isi.addEventListener('change', (ev) => {
    const bidangSaring = ev.target.dataset.saring
    if (!bidangSaring) return
    keadaanKoordinat[bidangSaring] = ev.target.value
    gambar()
  })

  let jeda = null
  isi.addEventListener('input', (ev) => {
    if (ev.target.dataset.peran !== 'cari-unit') return
    const nilai = ev.target.value
    clearTimeout(jeda)
    jeda = setTimeout(() => {
      keadaanKoordinat.cari = nilai
      const daftar = isi.querySelector('.siklus-antrean ul')
      if (daftar) daftar.innerHTML = daftarUnit(saring())
    }, 180)
  })

  /* ------------------------------------------------------------------- muat */

  gambar()
  muat(keadaan)
    .then(() => {
      if (!keadaanKoordinat.dipilih) keadaanKoordinat.dipilih = saring()[0]?.id || null
      gambar()
    })
    .catch((galat) => {
      keadaanKoordinat.galat = pesanRamah(galat)
      gambar()
    })

  return {
    judul: 'Koordinat UPT',
    sub: keadaanKoordinat.unit.length
      ? `${angka(keadaanKoordinat.unit.length)} unit, satu per satu`
      : 'Memuat data induk unit…',
  }
}
