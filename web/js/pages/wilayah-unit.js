/**
 * Unit di Wilayah — seluruh UPT yang dibawahi sebuah kantor wilayah.
 *
 * Berbeda dari tabel "unit yang paling banyak disorot" pada dasbor, yang hanya
 * menampilkan sepuluh teratas. Kantor wilayah bertanggung jawab atas SETIAP
 * unitnya, termasuk — dan terutama — yang tidak pernah muncul di daftar mana
 * pun. Sebuah unit yang tidak pernah diberitakan bukan unit yang tidak ada, dan
 * daftar yang hanya memuat yang berisik akan membuatnya lenyap dari perhatian
 * justru ketika ia perlu ditanyakan kabarnya.
 *
 * Karena itu daftar unitnya diambil dari tabel `upt`, bukan diturunkan dari
 * berita yang kebetulan ada. Kalau diturunkan dari berita, unit tanpa
 * pemberitaan mustahil muncul, dan halaman ini akan menjawab pertanyaan yang
 * berbeda dari yang ditanyakan judulnya.
 *
 * Halaman ini hanya untuk Administrator Kantor Wilayah. Penelaah unit tidak
 * pernah membukanya — cakupannya satu unit, dan daftar unit tetangga bukan
 * urusannya.
 */

import { ubin, kartu, keping, kosong, pesanSistem, bidangCari } from '../ui/komponen.js'
import { amankan, angka, ringkas, jarakWaktu, nadaUrgensi } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, pesanRamah } from '../lib/api.js'
import { dasar, menungguTelaahWilayah, sudahDitanggapi, tingkatKerawanan, KERAWANAN } from '../lib/hitung.js'
import { ember } from '../lib/sentimen.js'
import { belumTerpetakan } from '../lib/unit-terpetakan.js'

const keadaanUnit = {
  dimuat: false,
  galat: null,
  /** Daftar unit di wilayah ini, dari data induk. */
  daftar: [],
  /** Wilayah yang daftarnya sudah dimuat, supaya tidak ditarik ulang percuma. */
  untukWilayah: null,
  cari: '',
  urut: 'mendesak',
  dipilih: null,
}

/** Benar bila gambar ulang berikutnya harus mengembalikan fokus ke kolom cari. */
let fokusCari = false

const URUTAN = [
  { kode: 'mendesak', label: 'Paling mendesak' },
  { kode: 'negatif', label: 'Paling negatif' },
  { kode: 'total', label: 'Paling banyak diberitakan' },
  { kode: 'menunggu', label: 'Paling banyak menunggu telaah' },
  { kode: 'nama', label: 'Nama unit' },
]

export function halamanWilayahUnit({ keadaan, isi }) {
  const wilayah = keadaan.profil?.assigned_kanwil || null

  /** Menggabungkan data induk unit dengan berita yang terpetakan kepadanya. */
  function susun() {
    const perUnit = new Map()
    for (const b of dasar(keadaan.berita || [])) {
      if (belumTerpetakan(b.nama_upt)) continue
      const kumpulan = perUnit.get(b.nama_upt) || []
      kumpulan.push(b)
      perUnit.set(b.nama_upt, kumpulan)
    }

    return keadaanUnit.daftar.map((u) => {
      const berita = perUnit.get(u.nama) || []
      return {
        ...u,
        berita,
        total: berita.length,
        negatif: berita.filter((b) => ember(b) === 'negatif').length,
        mendesak: berita.filter((b) => ['Tinggi', 'Kritis'].includes(b.urgensi)).length,
        menunggu: berita.filter(menungguTelaahWilayah).length,
        ditanggapi: berita.filter(sudahDitanggapi).length,
        tingkat: tingkatKerawanan(berita),
      }
    })
  }

  function saring(semua) {
    const kata = keadaanUnit.cari.trim().toLowerCase()
    const hasil = semua.filter((u) => !kata
      || u.nama.toLowerCase().includes(kata)
      || String(u.kabupaten || '').toLowerCase().includes(kata))

    const urut = keadaanUnit.urut
    return hasil.sort((a, b) => {
      if (urut === 'nama') return a.nama.localeCompare(b.nama)
      // Pengurut kedua selalu sama, supaya unit yang angkanya seri tidak
      // berpindah tempat setiap kali halaman digambar ulang — perpindahan yang
      // tidak diminta siapa pun membuat daftar panjang mustahil dibaca dua kali.
      return (b[urut] - a[urut]) || (b.total - a.total) || a.nama.localeCompare(b.nama)
    })
  }

  function gambar() {
    if (!wilayah) {
      isi.innerHTML = kartu({
        isi: pesanSistem(
          '<b>Akun Anda belum ditetapkan kantor wilayahnya.</b> Selama itu belum diisi '
          + 'administrator sistem, tidak ada satu unit pun yang bisa ditampilkan di sini — '
          + 'basis data belum tahu unit mana yang menjadi urusan Anda.',
          'kritis', 'peringatan'),
      })
      return
    }

    if (keadaanUnit.galat) {
      isi.innerHTML = kartu({
        isi: pesanSistem(`<b>Data induk unit gagal dimuat.</b> ${amankan(keadaanUnit.galat)}`,
          'kritis', 'peringatan'),
      })
      return
    }

    if (!keadaanUnit.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:360px"></div>' })
      return
    }

    const semua = susun()
    const daftar = saring(semua)

    const bermasalah = semua.filter((u) => ['kritis', 'rawan'].includes(u.tingkat.kode))
    const sepi = semua.filter((u) => u.tingkat.kode === 'sepi')
    const menungguTotal = semua.reduce((a, u) => a + u.menunggu, 0)

    isi.innerHTML = `
      <div class="tumpuk">
        <div class="kisi kisi-4">
          ${ubin({
            label: 'Unit di wilayah ini',
            nilai: semua.length,
            nada: 'aksen',
            kaki: `${angka(semua.length - sepi.length)} pernah diberitakan`,
          })}
          ${ubin({
            label: 'Rawan atau kritis',
            nilai: bermasalah.length,
            nada: bermasalah.length ? 'kritis' : 'positif',
            kaki: 'menurut pemberitaan yang tercatat',
          })}
          ${ubin({
            label: 'Menunggu telaah',
            nilai: menungguTotal,
            nada: menungguTotal ? 'sedang' : 'positif',
            kaki: 'berita di seluruh unit wilayah ini',
          })}
          ${ubin({
            label: 'Tanpa pemberitaan',
            nilai: sepi.length,
            nada: 'netral',
            kaki: 'belum ada berita yang terpetakan',
          })}
        </div>

        <div class="peta-tata">
          ${kartu({
            rapat: true,
            isi: `
              <div class="bilah-alat">
                ${bidangCari(keadaanUnit.cari, 'Cari nama unit atau kabupaten/kota')}
                <select class="pilihan" data-urut aria-label="Urutkan unit"
                        style="width:auto;min-width:210px">
                  ${URUTAN.map((u) => `
                    <option value="${amankan(u.kode)}"${u.kode === keadaanUnit.urut ? ' selected' : ''}>
                      ${amankan(u.label)}
                    </option>`).join('')}
                </select>
                <span class="dorong mini-teks samar-teks">
                  ${angka(daftar.length)} dari ${angka(semua.length)} unit
                </span>
              </div>

              ${daftar.length ? tabelUnit(daftar, keadaanUnit.dipilih) : kosong(
                'Tidak ada unit yang cocok',
                'Tidak ada unit di wilayah ini yang cocok dengan pencarian itu.')}`,
          })}
          ${panelUnit(semua)}
        </div>
      </div>`

    pasangPenyimak()
  }

  /** Rincian satu unit, atau legenda beserta petunjuk bila belum ada yang dipilih. */
  function panelUnit(semua) {
    const u = keadaanUnit.dipilih ? semua.find((x) => x.nama === keadaanUnit.dipilih) : null

    if (!u) {
      return `
        <div class="peta-panel">
          <div class="peta-panel-kop"><span class="label-mono">Rincian unit</span></div>
          <p class="ket" style="padding:8px 2px 12px">
            Pilih salah satu unit di sebelah kiri untuk membaca angkanya beserta pemberitaan
            terakhirnya — tanpa perlu berganti akun.
          </p>
          <div class="unit-legenda">
            ${KERAWANAN.map((k) => `
              <span class="peta-legenda-butir" title="${amankan(k.ket)}">
                <i data-nada="${amankan(k.nada)}"></i>${amankan(k.label)}
                <b class="angka">${angka(semua.filter((x) => x.tingkat.kode === k.kode).length)}</b>
              </span>`).join('')}
          </div>
        </div>`
    }

    const terbaru = [...u.berita]
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
      .slice(0, 6)

    return `
      <div class="peta-panel">
        <div class="peta-panel-kop">
          <span class="label-mono">Rincian unit</span>
          <button class="tbl kecil samar" data-aksi="tutup-unit">${ikon('tutup')}Tutup</button>
        </div>

        <h3 class="peta-panel-judul">${amankan(u.nama)}</h3>
        <p class="mini-teks samar-teks">
          ${amankan(u.jenis || '')}${u.kabupaten ? ` · ${amankan(u.kabupaten)}` : ''}
        </p>

        <div class="baris gap-6" style="margin:10px 0 12px;flex-wrap:wrap">
          ${keping(u.tingkat.label, u.tingkat.nada)}
          <span class="mini-teks samar-teks">${amankan(u.tingkat.ket)}</span>
        </div>

        <dl class="peta-angka">
          <div><dt>Berita</dt><dd class="angka">${angka(u.total)}</dd></div>
          <div><dt>Negatif</dt><dd class="angka">${angka(u.negatif)}</dd></div>
          <div><dt>Mendesak</dt><dd class="angka">${angka(u.mendesak)}</dd></div>
          <div><dt>Ditanggapi</dt><dd class="angka">${angka(u.ditanggapi)}</dd></div>
        </dl>

        ${u.menunggu ? pesanSistem(
          `<b>${angka(u.menunggu)} berita unit ini menunggu telaah.</b> Penelaah unitnya yang `
          + 'memeriksa lebih dulu; bila akunnya belum ada, terbitkan dari Pengguna Wilayah.',
          'sedang', 'info') : ''}

        ${terbaru.length ? `
          <div class="peta-panel-kop" style="margin-top:14px">
            <span class="label-mono">Pemberitaan terakhir</span>
          </div>
          <ul class="peta-berita">
            ${terbaru.map((b) => `
              <li>
                <span class="peta-berita-judul">${amankan(ringkas(b.judul || 'Tanpa judul', 92))}</span>
                <span class="mini-teks samar-teks">
                  ${keping(b.urgensi || '—', nadaUrgensi(b.urgensi), true)}
                  ${amankan(b.media || '')} · ${amankan(jarakWaktu(b.created_at))}
                </span>
              </li>`).join('')}
          </ul>`
          : `<p class="ket" style="margin-top:12px">
             Belum ada berita yang terpetakan ke unit ini. Itu bisa berarti unitnya memang tidak
             diberitakan, atau beritanya ada tetapi belum terhubung ke unit mana pun — dan yang
             kedua hanya bisa dibereskan analis pusat lewat Pemetaan UPT.</p>`}
      </div>`
  }

  /* ------------------------------------------------------------ penyimak */

  function pasangPenyimak() {
    const kotak = isi.querySelector('input[data-peran="cari"]')
    if (kotak) {
      /*
         Fokus dikembalikan sesudah gambar ulang. Gambar ulang membuang kolom
         isian ini beserta kursor di dalamnya, dan tanpa pengembalian itu yang
         mengetik kehilangan tempatnya di tengah kata — berkali-kali, sampai ia
         berhenti memakai kolomnya.
      */
      if (fokusCari) {
        kotak.focus({ preventScroll: true })
        kotak.setSelectionRange(kotak.value.length, kotak.value.length)
        fokusCari = false
      }
      let jeda = null
      kotak.addEventListener('input', (ev) => {
        keadaanUnit.cari = ev.target.value
        clearTimeout(jeda)
        jeda = setTimeout(() => { fokusCari = true; gambar() }, 260)
      })
    }

    isi.querySelector('[data-urut]')?.addEventListener('change', (ev) => {
      keadaanUnit.urut = ev.target.value
      gambar()
    })

    for (const baris of isi.querySelectorAll('tr[data-unit]')) {
      baris.addEventListener('click', () => {
        // Menekan unit yang sedang terbuka menutupnya kembali. Tanpa itu, satu-
        // satunya jalan keluar adalah tombol Tutup, dan tombol itu berada di
        // ujung lain layar.
        keadaanUnit.dipilih = baris.dataset.unit === keadaanUnit.dipilih ? null : baris.dataset.unit
        gambar()
      })
    }

    isi.querySelector('[data-aksi="tutup-unit"]')?.addEventListener('click', () => {
      keadaanUnit.dipilih = null
      gambar()
    })
  }

  /* ---------------------------------------------------------------- muat */

  async function muat() {
    // Ditarik ulang hanya bila wilayahnya berganti. Daftar unit tidak berubah
    // dari menit ke menit, dan menariknya setiap kali halaman dibuka hanya
    // menambah jeda yang terlihat tanpa menambah satu keterangan pun.
    if (keadaanUnit.dimuat && keadaanUnit.untukWilayah === wilayah) { gambar(); return }

    keadaanUnit.untukWilayah = wilayah
    keadaanUnit.galat = null

    if (keadaan.demo) {
      const { UNIT_CONTOH } = await import('../lib/peta-upt-contoh.js')
      keadaanUnit.daftar = UNIT_CONTOH
        .filter(([, , kanwil]) => kanwil === wilayah)
        .map(([nama, jenis, , , kabupaten]) => ({ nama, jenis, kabupaten }))
      keadaanUnit.dimuat = true
      gambar()
      perbaruiSubjudul()
      return
    }

    try {
      const baris = await ambil('upt', {
        select: 'nama_upt,jenis_upt,kabupaten_kota',
        kanwil: `eq.${wilayah}`,
        aktif: 'eq.true',
        limit: 1000,
      }) || []
      keadaanUnit.daftar = baris.map((u) => ({
        nama: u.nama_upt, jenis: u.jenis_upt, kabupaten: u.kabupaten_kota,
      }))
    } catch (galat) {
      keadaanUnit.galat = pesanRamah(galat)
    }

    keadaanUnit.dimuat = true
    gambar()
    perbaruiSubjudul()
  }

  /**
   * Kerangka layar menanyakan keterangan bilah kepala sekali, pada saat halaman
   * dibangun — dan pada saat itu daftar unitnya belum sampai. Tanpa pembaruan
   * ini, bilahnya terus berbunyi "memuat" sekalipun tabelnya sudah penuh.
   */
  function perbaruiSubjudul() {
    const bilah = document.getElementById('bilah-sub')
    if (bilah) bilah.textContent = subjudul()
  }

  function subjudul() {
    if (!wilayah) return 'Wilayah belum ditetapkan'
    return keadaanUnit.dimuat
      ? `${wilayah} · ${angka(keadaanUnit.daftar.length)} unit dibawahi`
      : `${wilayah} · memuat daftar unit…`
  }

  gambar()
  muat()

  return { judul: 'Unit di Wilayah', sub: subjudul() }
}

function tabelUnit(daftar, dipilih) {
  const puncak = Math.max(1, ...daftar.map((u) => u.total))

  return `
  <div class="tabel-bungkus">
    <table class="tabel tabel-pilih">
      <thead><tr>
        <th>Unit</th>
        <th style="width:96px">Sebaran</th>
        <th style="width:56px" class="rata-kanan">Total</th>
        <th style="width:66px" class="rata-kanan">Negatif</th>
        <th style="width:76px" class="rata-kanan">Mendesak</th>
        <th style="width:82px" class="rata-kanan">Menunggu</th>
        <th style="width:120px">Keadaan</th>
      </tr></thead>
      <tbody>
        ${daftar.map((u) => `
          <tr data-unit="${amankan(u.nama)}"${u.nama === dipilih ? ' aria-selected="true"' : ''}>
            <td>
              <span class="judul-sel">${amankan(u.nama)}</span>
              <span class="mini-teks samar-teks">${amankan(u.kabupaten || u.jenis || '')}</span>
            </td>
            <td>
              <div class="bar-lacak" title="${angka(u.total)} berita">
                <div class="bar-isi" data-nada="${amankan(u.tingkat.nada)}"
                     style="--lebar:${((u.total / puncak) * 100).toFixed(1)}%"></div>
              </div>
            </td>
            <td class="angka rata-kanan">${u.total ? angka(u.total) : '—'}</td>
            <td class="angka rata-kanan">${u.negatif ? `<span style="color:var(--kritis)">${angka(u.negatif)}</span>` : '—'}</td>
            <td class="angka rata-kanan">${u.mendesak ? `<span style="color:var(--tinggi);font-weight:650">${angka(u.mendesak)}</span>` : '—'}</td>
            <td class="angka rata-kanan">${u.menunggu ? angka(u.menunggu) : '—'}</td>
            <td>${keping(u.tingkat.label, u.tingkat.nada, true)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`
}
