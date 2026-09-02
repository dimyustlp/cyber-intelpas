/**
 * Tindak Lanjut.
 *
 * Tempat putusan pimpinan berhenti menjadi dokumen dan mulai menjadi
 * pekerjaan yang ada tenggatnya.
 *
 * Halaman ini menjawab satu pertanyaan yang paling sering ditanyakan dan
 * paling jarang bisa dijawab: apa yang diputuskan tiga minggu lalu, sudah
 * dikerjakan atau belum. Sebelum ada halaman ini, jawabannya hanya bisa
 * diperoleh dengan menelepon.
 *
 * Tiga keputusan yang menentukan isi berkas ini:
 *
 *   Butir yang terlambat berdiri di atas, bukan disorot merah di tengah
 *   daftar. Warna merah di tengah daftar panjang hanya terbaca oleh yang
 *   menggulir sampai ke sana. Yang lewat tenggat karena itu diangkat ke
 *   kelompoknya sendiri di puncak halaman, lengkap dengan hitungan harinya.
 *
 *   Tenggat yang lewat pada butir yang sudah selesai bukan keterlambatan,
 *   melainkan riwayat. Menandai keduanya merah membuat daftar yang sehat
 *   terbaca seperti daftar yang gagal — dan daftar yang selalu merah berhenti
 *   dibaca.
 *
 *   Kemajuan diisi pelaksananya, bukan dihitung sistem. Sistem tahu sebuah
 *   butir sudah lewat setengah waktunya; ia tidak tahu apakah pekerjaannya
 *   sudah setengah jalan. Angka yang ditebak sistem akan dipercaya pembacanya
 *   sebagai angka yang diukur.
 */

import { kartu, keping, kosong, tombol, roti } from '../ui/komponen.js'
import { amankan, angka, persen, ringkas } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { pesanRamah } from '../lib/api.js'
import { punyaIzin } from '../lib/peran.js'
import {
  NAMA_STATUS_TINDAK, PRIORITAS, nadaTindak, nadaPrioritas, terlambat,
  tindakSelesai, kalimatTenggat, sisaHari,
} from '../lib/siklus.js'
import { bacaSiklus, tulisSiklus, ubahSiklus, siapkanDemo, penulis } from '../lib/siklus-data.js'
import { bilahMaju, bidangTeks, bidangPilih, bidangSatuBaris, bacaBorang } from '../ui/siklus-ui.js'

const keadaanTindak = {
  dimuat: false,
  sibuk: false,
  galat: null,
  kasus: [],
  rekomendasi: [],
  tindak: [],
  saringStatus: 'Semua status',
  hanyaSaya: false,
  /** Butir yang sedang dibuka panel penyuntingnya. */
  dibuka: null,
  borangBaru: false,
}

/* ------------------------------------------------------------------- muat */

async function muat(keadaan) {
  if (keadaan.demo) siapkanDemo(keadaan.berita || [])

  const [kasus, rekomendasi, tindak] = await Promise.all([
    bacaSiklus('kasus'),
    bacaSiklus('rekomendasi'),
    bacaSiklus('tindak', { urut: 'created_at.desc' }),
  ])

  Object.assign(keadaanTindak, { kasus, rekomendasi, tindak, dimuat: true })
}

const kasusDari = (id) => keadaanTindak.kasus.find((k) => k.id === id)

/* --------------------------------------------------------------- penyaring */

function saring(saya) {
  return keadaanTindak.tindak
    .filter((t) => keadaanTindak.saringStatus.startsWith('Semua') || t.status === keadaanTindak.saringStatus)
    .filter((t) => !keadaanTindak.hanyaSaya || t.assigned_to === saya)
}

/**
 * Tiga kelompok, bukan satu daftar panjang.
 *
 * Urutannya mengikuti urgensi bacanya: yang sudah lewat tenggat, yang sedang
 * berjalan, lalu yang sudah tuntas. Satu daftar panjang yang diurutkan
 * menurut tanggal menyembunyikan keterlambatan di antara pekerjaan yang
 * baik-baik saja.
 */
function kelompokkan(daftar) {
  const lewat = daftar.filter((t) => terlambat(t))
  const berjalan = daftar.filter((t) => !terlambat(t) && !tindakSelesai(t))
  const tuntas = daftar.filter(tindakSelesai)

  const urutTenggat = (a, b) => {
    const tA = a.due_at ? new Date(a.due_at).getTime() : Infinity
    const tB = b.due_at ? new Date(b.due_at).getTime() : Infinity
    return tA - tB
  }

  return [
    {
      kode: 'lewat',
      judul: 'Lewat tenggat',
      ket: 'Belum selesai, dan tenggatnya sudah terlampaui.',
      nada: 'kritis',
      butir: lewat.sort(urutTenggat),
    },
    {
      kode: 'berjalan',
      judul: 'Sedang berjalan',
      ket: 'Yang tenggatnya paling dekat berdiri di atas.',
      nada: 'sedang',
      butir: berjalan.sort(urutTenggat),
    },
    {
      kode: 'tuntas',
      judul: 'Sudah tuntas',
      ket: 'Selesai atau dibatalkan.',
      nada: 'positif',
      butir: tuntas.sort((a, b) =>
        String(b.completed_at || b.updated_at || '').localeCompare(String(a.completed_at || a.updated_at || ''))),
    },
  ]
}

/* -------------------------------------------------------------------- kartu */

function kartuTindak(t, bolehUbah) {
  const kasus = kasusDari(t.case_id)
  const selesai = tindakSelesai(t)
  const tenggat = kalimatTenggat(t.due_at, selesai)
  const dibuka = keadaanTindak.dibuka === t.id
  const sisa = sisaHari(t.due_at)

  return `
    <li class="tindak-kartu${terlambat(t) ? ' terlambat' : ''}${dibuka ? ' dibuka' : ''}">
      <div class="tindak-kop">
        <span class="antrean-tanda" data-nada="${amankan(nadaTindak(t.status))}"></span>
        <div class="tindak-judul">
          <b>${amankan(t.title || 'Tanpa judul')}</b>
          <span class="mini-teks samar-teks">
            ${kasus ? `${amankan(kasus.case_number)} · ${amankan(ringkas(kasus.title, 56))}` : 'Kasus tidak dikenali'}
          </span>
        </div>
        <div class="tindak-keping">
          ${keping(t.status, nadaTindak(t.status), true)}
          ${keping(t.priority || 'Sedang', nadaPrioritas(t.priority), true)}
          <span class="keping" data-nada="${amankan(tenggat.nada)}">${amankan(tenggat.teks)}</span>
        </div>
      </div>

      <div class="tindak-maju">
        ${bilahMaju(t.progress_percent, terlambat(t) ? 'kritis' : selesai ? 'positif' : 'aksen')}
        <span class="mini-teks angka">${angka(t.progress_percent || 0)}%</span>
        <span class="mini-teks samar-teks">
          ${amankan(t.assigned_to || t.assigned_role || 'belum ditugaskan')}
        </span>
        ${bolehUbah ? `
          <button class="tbl kecil samar dorong" data-buka="${amankan(t.id)}">
            ${ikon(dibuka ? 'tutup' : 'pengaturan')}${dibuka ? 'Tutup' : 'Perbarui'}
          </button>` : ''}
      </div>

      ${uraianBerbeda(t) ? `<p class="tindak-ket">${amankan(t.description)}</p>` : ''}

      ${dibuka && bolehUbah ? panelUbah(t, sisa) : ''}
    </li>`
}

/**
 * Benar bila uraian butir menambahkan sesuatu di luar judulnya.
 *
 * Butir yang lahir dari rekomendasi menyimpan rumusan penuh pada uraian dan
 * potongan sembilan puluh karakter pertamanya sebagai judul. Menampilkan
 * keduanya membuat setiap baris terbaca dua kali, dan yang membacanya
 * menyangka ada dua butir yang isinya kebetulan sama.
 */
function uraianBerbeda(t) {
  const uraian = String(t.description || '').trim()
  if (!uraian) return false
  const judul = String(t.title || '').replace(/…$/, '').trim()
  return !judul || !uraian.startsWith(judul)
}

function panelUbah(t, sisa) {
  return `
    <div class="tindak-ubah" data-peran="borang-ubah">
      <div class="borang-kisi">
        ${bidangPilih({ nama: 'status', label: 'Status', nilai: t.status, opsi: NAMA_STATUS_TINDAK })}
        ${bidangSatuBaris({
          nama: 'progress_percent', label: 'Kemajuan (%)', jenis: 'number',
          nilai: String(t.progress_percent ?? 0),
        })}
        ${bidangSatuBaris({
          nama: 'assigned_to', label: 'Pelaksana', nilai: t.assigned_to || '',
          petunjuk: 'username',
        })}
        ${bidangSatuBaris({
          nama: 'due_at', label: 'Tenggat', jenis: 'date',
          nilai: t.due_at ? String(t.due_at).slice(0, 10) : '',
          ket: sisa != null && sisa < 0 ? `Tenggat lama sudah lewat ${Math.abs(sisa)} hari.` : '',
        })}
      </div>

      <div class="baris gap-6" style="margin-top:11px">
        ${tombol({
          label: 'Simpan', ikon: 'centang', gaya: 'utama', kecil: true,
          aksi: 'simpan-tindak', nonaktif: keadaanTindak.sibuk,
        })}
        ${t.status !== 'Selesai' ? tombol({
          label: 'Tandai selesai', ikon: 'centang', kecil: true, aksi: 'tandai-selesai',
        }) : ''}
      </div>
    </div>`
}

/* ------------------------------------------------------------------- borang */

function borangBaru() {
  const terbuka = keadaanTindak.kasus.filter((k) => !['Ditutup'].includes(k.status))
  return kartu({
    judul: 'Butir tindak lanjut baru',
    ket: 'Butir yang lahir dari putusan pimpinan dibuat otomatis. Yang di sini untuk tindakan '
      + 'yang muncul di luar putusan formal.',
    aksi: `<button class="tbl kecil samar" data-aksi="batal-borang">${ikon('tutup')}Batal</button>`,
    isi: terbuka.length ? `
      <form class="borang-kisi" data-peran="borang-baru">
        ${bidangPilih({
          nama: 'case_id', label: 'Kasus', nilai: '',
          opsi: terbuka.map((k) => ({ nilai: k.id, teks: `${k.case_number} — ${ringkas(k.title, 60)}` })),
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}
        ${bidangSatuBaris({ nama: 'title', label: 'Judul butir' }).replace('<label class="bidang"', '<label class="bidang penuh"')}
        ${bidangSatuBaris({ nama: 'assigned_to', label: 'Pelaksana', petunjuk: 'username' })}
        ${bidangPilih({ nama: 'priority', label: 'Prioritas', nilai: 'Sedang', opsi: PRIORITAS })}
        ${bidangSatuBaris({ nama: 'due_at', label: 'Tenggat', jenis: 'date' })}
        ${bidangTeks({ nama: 'description', label: 'Uraian', baris: 3 })
          .replace('<label class="bidang"', '<label class="bidang penuh"')}
      </form>
      <div class="baris gap-6" style="margin-top:14px">
        ${tombol({
          label: 'Tambahkan butir', ikon: 'tambah', gaya: 'utama',
          aksi: 'simpan-baru', nonaktif: keadaanTindak.sibuk,
        })}
      </div>`
      : kosong('Belum ada kasus', 'Butir tindak lanjut selalu terikat pada satu kasus.'),
  })
}

/* ------------------------------------------------------------------ halaman */

export function halamanTindak({ keadaan, isi }) {
  const peran = keadaan.profil?.role
  const saya = keadaan.profil?.username || ''
  const bolehKelola = punyaIzin(peran, 'kelola_tindak_lanjut')
  const bolehPerbarui = bolehKelola || punyaIzin(peran, 'perbarui_tindak_lanjut')

  function gambar() {
    if (keadaanTindak.galat) {
      isi.innerHTML = kartu({
        isi: `<div class="pesan" data-nada="kritis">${ikon('peringatan')}
          <div><b>Daftar tindak lanjut gagal dimuat.</b> ${amankan(keadaanTindak.galat)}</div></div>`,
      })
      return
    }
    if (!keadaanTindak.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:380px"></div>' })
      return
    }

    const terlihat = saring(saya)
    const kelompok = kelompokkan(terlihat)
    const semua = keadaanTindak.tindak
    const lewat = semua.filter((t) => terlambat(t)).length
    const tuntas = semua.filter(tindakSelesai).length

    isi.innerHTML = `
      <div class="tumpuk">
        <div class="kisi kisi-4">
          ${ubinTindak('Seluruh butir', semua.length, `${angka(keadaanTindak.kasus.length)} kasus`)}
          ${ubinTindak('Sedang berjalan', semua.filter((t) => t.status === 'Berjalan').length,
            'sudah dimulai pelaksananya')}
          ${ubinTindak('Lewat tenggat', lewat,
            lewat ? 'menuntut penjelasan pelaksananya' : 'tidak ada yang terlambat', lewat ? 'kritis' : 'positif')}
          ${ubinTindak('Tuntas', tuntas,
            semua.length ? `${persen(tuntas, semua.length)} dari seluruh butir` : 'belum ada butir', 'positif')}
        </div>

        <div class="bilah-alat">
          <select class="pilihan" data-saring="saringStatus" aria-label="Saring status"
                  style="width:auto;min-width:170px">
            ${['Semua status', ...NAMA_STATUS_TINDAK].map((s) =>
              `<option${s === keadaanTindak.saringStatus ? ' selected' : ''}>${amankan(s)}</option>`).join('')}
          </select>
          <button class="tbl kecil${keadaanTindak.hanyaSaya ? ' utama' : ''}"
                  data-aksi="hanya-saya" aria-pressed="${keadaanTindak.hanyaSaya}">
            ${ikon('pengguna')}Hanya butir saya
          </button>
          <div class="dorong baris gap-6">
            <span class="mini-teks samar-teks">${angka(terlihat.length)} butir tampil</span>
            ${bolehKelola ? tombol({
              label: 'Butir baru', ikon: 'tambah', gaya: 'utama', kecil: true, aksi: 'butir-baru',
            }) : ''}
          </div>
        </div>

        ${keadaanTindak.borangBaru ? borangBaru() : ''}

        ${semua.length ? kelompok.map((g) => g.butir.length ? kartu({
          judul: g.judul,
          ket: g.ket,
          aksi: `<span class="keping" data-nada="${g.nada}">${angka(g.butir.length)}</span>`,
          rapat: true,
          isi: `<ul class="tindak-daftar">${g.butir.map((t) => kartuTindak(t, bolehPerbarui)).join('')}</ul>`,
        }) : '').join('')
          : kartu({
            isi: kosong(
              'Belum ada butir tindak lanjut',
              'Butir tindak lanjut lahir dari rekomendasi yang disetujui pimpinan di halaman '
              + 'Keputusan Pimpinan. Yang muncul di sini adalah pekerjaan yang sudah punya '
              + 'penanggung jawab dan tenggat.',
            ),
          })}
      </div>`
  }

  function ubinTindak(label, nilai, kaki, nada = 'netral') {
    return `
      <div class="ubin" data-nada="${amankan(nada)}">
        <div class="ubin-label">${amankan(label)}</div>
        <div class="ubin-nilai angka">${angka(nilai)}</div>
        <div class="ubin-kaki">${amankan(kaki)}</div>
      </div>`
  }

  /* --------------------------------------------------------------- tindakan */

  async function simpanUbah(t) {
    const borang = isi.querySelector('[data-peran="borang-ubah"]')
    if (!borang) return
    const nilai = bacaBorang(borang)

    const maju = Math.max(0, Math.min(100, Number(nilai.progress_percent) || 0))
    const perubahan = {
      status: nilai.status,
      progress_percent: maju,
      assigned_to: nilai.assigned_to?.trim() || null,
      due_at: nilai.due_at ? new Date(`${nilai.due_at}T17:00:00`).toISOString() : null,
      updated_at: new Date().toISOString(),
    }

    // Butir yang dinyatakan selesai selalu tercatat 100 persen, dan sebaliknya:
    // butir 100 persen yang statusnya masih berjalan adalah keadaan yang tidak
    // bisa dijelaskan kepada siapa pun yang membaca daftarnya.
    if (nilai.status === 'Selesai') {
      perubahan.progress_percent = 100
      perubahan.completed_at = t.completed_at || new Date().toISOString()
    } else {
      perubahan.completed_at = null
      if (maju >= 100) perubahan.progress_percent = 99
    }

    keadaanTindak.sibuk = true
    gambar()
    try {
      await ubahSiklus('tindak', t.id, perubahan)
      Object.assign(t, perubahan)
      keadaanTindak.dibuka = null
      roti('Butir tindak lanjut diperbarui.', 'positif')
      await selaraskanKasus(t.case_id)
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      console.error(galat)
    } finally {
      keadaanTindak.sibuk = false
      gambar()
    }
  }

  /**
   * Menutup kasus ketika seluruh butirnya tuntas.
   *
   * Ini satu-satunya perubahan status kasus yang dilakukan halaman ini, dan
   * sah karena tidak menilai apa pun: yang dinyatakan hanyalah "tidak ada lagi
   * yang tersisa untuk dikerjakan". Kasus tanpa satu pun butir tidak pernah
   * ditutup dari sini — kasus kosong belum tentu selesai, ia bisa saja belum
   * mulai.
   */
  async function selaraskanKasus(kasusId) {
    const kasus = kasusDari(kasusId)
    if (!kasus || kasus.status !== 'Tindak Lanjut') return
    const butir = keadaanTindak.tindak.filter((t) => t.case_id === kasusId)
    if (!butir.length || !butir.every(tindakSelesai)) return

    await ubahSiklus('kasus', kasusId, {
      status: 'Selesai', closed_at: new Date().toISOString(),
    })
    kasus.status = 'Selesai'
    roti(`Seluruh butir tuntas — kasus ${kasus.case_number} ditandai selesai.`, 'positif', 5000)
  }

  async function simpanBaru() {
    const borang = isi.querySelector('[data-peran="borang-baru"]')
    if (!borang) return
    const nilai = bacaBorang(borang)
    if (!nilai.title?.trim()) { roti('Judul butir tidak boleh kosong.', 'sedang'); return }

    keadaanTindak.sibuk = true
    gambar()
    try {
      const baris = await tulisSiklus('tindak', {
        case_id: nilai.case_id,
        recommendation_id: null,
        title: nilai.title.trim(),
        description: nilai.description?.trim() || null,
        assigned_to: nilai.assigned_to?.trim() || null,
        assigned_role: null,
        priority: nilai.priority,
        status: 'Belum Dimulai',
        due_at: nilai.due_at ? new Date(`${nilai.due_at}T17:00:00`).toISOString() : null,
        progress_percent: 0,
        created_by: penulis(),
      })
      keadaanTindak.tindak.unshift(Array.isArray(baris) ? baris[0] : baris)
      keadaanTindak.borangBaru = false
      roti('Butir tindak lanjut ditambahkan.', 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      console.error(galat)
    } finally {
      keadaanTindak.sibuk = false
      gambar()
    }
  }

  /* ---------------------------------------------------------------- penyimak */

  isi.addEventListener('click', (ev) => {
    const buka = ev.target.closest('[data-buka]')?.dataset.buka
    if (buka) {
      keadaanTindak.dibuka = keadaanTindak.dibuka === buka ? null : buka
      gambar()
      return
    }

    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    const t = keadaanTindak.tindak.find((x) => x.id === keadaanTindak.dibuka)

    if (aksi === 'hanya-saya') { keadaanTindak.hanyaSaya = !keadaanTindak.hanyaSaya; gambar() }
    else if (aksi === 'butir-baru') { keadaanTindak.borangBaru = true; gambar() }
    else if (aksi === 'batal-borang') { keadaanTindak.borangBaru = false; gambar() }
    else if (aksi === 'simpan-baru') simpanBaru()
    else if (aksi === 'simpan-tindak' && t) simpanUbah(t)
    else if (aksi === 'tandai-selesai' && t) {
      const pilihStatus = isi.querySelector('[data-peran="borang-ubah"] [data-bidang="status"]')
      const pilihMaju = isi.querySelector('[data-peran="borang-ubah"] [data-bidang="progress_percent"]')
      if (pilihStatus) pilihStatus.value = 'Selesai'
      if (pilihMaju) pilihMaju.value = '100'
      simpanUbah(t)
    }
  })

  isi.addEventListener('change', (ev) => {
    const bidangSaring = ev.target.dataset.saring
    if (!bidangSaring) return
    keadaanTindak[bidangSaring] = ev.target.value
    gambar()
  })

  /* ------------------------------------------------------------------- muat */

  gambar()
  muat(keadaan)
    .then(gambar)
    .catch((galat) => {
      keadaanTindak.galat = pesanRamah(galat)
      gambar()
    })

  return {
    judul: 'Tindak Lanjut',
    sub: 'Butir tindakan dari putusan pimpinan, beserta penanggung jawab dan tenggatnya',
  }
}
