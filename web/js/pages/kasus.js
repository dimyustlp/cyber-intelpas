/**
 * Kasus Intelijen.
 *
 * Tempat pemberitaan berhenti menjadi daftar dan mulai menjadi perkara.
 *
 * Persoalan yang dijawab halaman ini. Satu peristiwa di lapangan rutin
 * melahirkan delapan sampai dua puluh publikasi di media yang berbeda,
 * masing-masing dengan judul sendiri. Di dalam tabel berita, kedua puluhnya
 * adalah dua puluh baris yang setara — dan pertanyaan "sudah sampai mana
 * penanganan perkara ini" tidak punya tempat untuk dijawab, sebab tidak ada
 * satu baris pun yang mewakili perkaranya.
 *
 * Tiga keputusan yang menentukan isi berkas ini:
 *
 *   Kasus dibentuk dari peristiwa, bukan dari satu berita. Tombol utamanya
 *   menawarkan kelompok publikasi yang sudah disatukan lib/peristiwa.js —
 *   mesin yang sama yang dipakai laporan berkala — sehingga seorang analis
 *   tidak perlu mencari sendiri kedua puluh berita itu satu per satu. Membuat
 *   kasus dari satu berita tetap bisa, dan itu memang yang dilakukan untuk
 *   isu yang baru terbit sekali.
 *
 *   Menaikkan tahap tidak pernah otomatis. Sistem tahu sebuah kasus sudah
 *   punya laporan lapangan; ia tidak tahu apakah laporan itu cukup. Yang
 *   menaikkan tahap selalu orang, dan namanya tercatat. Yang dilakukan
 *   halaman ini hanya menunjukkan tahap mana yang sudah punya berkasnya —
 *   lewat rel enam tahap di puncak panel.
 *
 *   Berita yang sudah masuk satu kasus tetap boleh masuk kasus lain. Satu
 *   pemberitaan bisa menyangkut dua perkara sekaligus — kaburnya warga binaan
 *   dan dugaan pungutan liar yang terbongkar karenanya — dan memaksa analis
 *   memilih salah satu berarti memaksanya membuang setengah perkaranya.
 */

import { kartu, keping, kosong, tombol, roti, konfirmasi } from '../ui/komponen.js'
import { amankan, angka, ringkas, jarakWaktu, tanggalJam, nadaUrgensi } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { pesanRamah } from '../lib/api.js'
import { punyaIzin } from '../lib/peran.js'
import { dasar } from '../lib/hitung.js'
import { ember } from '../lib/sentimen.js'
import { kelompokkanPeristiwa } from '../lib/peristiwa.js'
import { belumTerpetakan } from '../lib/pencocokan-upt.js'
import {
  NAMA_STATUS_KASUS, PRIORITAS, NAMA_KEAKTUALAN, statusKasus,
  kasusTerbuka, langkahBerikut, PERINGKAT_PRIORITAS,
} from '../lib/siklus.js'
import {
  bacaSiklus, tulisSiklus, ubahSiklus, hitungIsiKasus, siapkanDemo, penulis,
} from '../lib/siklus-data.js'
import {
  relTahap, kepalaKasus, barisAntrean, belumDipilih, bidangTeks, bidangPilih,
  bidangSatuBaris, bacaBorang,
} from '../ui/siklus-ui.js'

/** Keadaan halaman, bertahan selama sesi supaya saringan tidak hilang. */
const keadaanKasus = {
  dimuat: false,
  sibuk: false,
  galat: null,
  kasus: [],
  kasusBerita: [],
  isi: null,
  dipilih: null,
  saringStatus: 'Semua status',
  saringPrioritas: 'Semua prioritas',
  cari: '',
  /** Borang kasus baru sedang terbuka, beserta peristiwa yang dipilih. */
  borang: null,
}

/* ------------------------------------------------------------------- muat */

async function muat(keadaan) {
  if (keadaan.demo) siapkanDemo(keadaan.berita || [])

  const [kasus, kasusBerita, penugasan, laporanLapangan, analisis, rekomendasi, putusan, tindak] =
    await Promise.all([
      bacaSiklus('kasus', { urut: 'created_at.desc' }),
      bacaSiklus('kasusBerita'),
      bacaSiklus('penugasan'),
      bacaSiklus('laporanLapangan'),
      bacaSiklus('analisis'),
      bacaSiklus('rekomendasi'),
      bacaSiklus('putusan'),
      bacaSiklus('tindak'),
    ])

  keadaanKasus.kasus = kasus
  keadaanKasus.kasusBerita = kasusBerita
  keadaanKasus.isi = hitungIsiKasus({
    kasusBerita, penugasan, laporanLapangan, analisis, rekomendasi, putusan, tindak,
  })
  keadaanKasus.dimuat = true
}

/* --------------------------------------------------------------- penyaring */

function saring(daftar) {
  const kata = keadaanKasus.cari.trim().toLowerCase()
  return daftar
    .filter((k) => keadaanKasus.saringStatus.startsWith('Semua') || k.status === keadaanKasus.saringStatus)
    .filter((k) => keadaanKasus.saringPrioritas.startsWith('Semua') || k.priority === keadaanKasus.saringPrioritas)
    .filter((k) => !kata || [k.case_number, k.title, k.primary_upt, k.issue_type]
      .filter(Boolean).join(' ').toLowerCase().includes(kata))
    .sort((a, b) => {
      // Yang terbuka selalu di atas yang tertutup, lalu prioritas, lalu yang
      // terbaru. Kasus yang sudah ditutup tidak menuntut apa pun dari siapa
      // pun; menaruhnya di antara yang terbuka hanya memperpanjang pencarian.
      const bukaA = kasusTerbuka(a) ? 1 : 0
      const bukaB = kasusTerbuka(b) ? 1 : 0
      if (bukaA !== bukaB) return bukaB - bukaA
      const pA = PERINGKAT_PRIORITAS[a.priority] || 0
      const pB = PERINGKAT_PRIORITAS[b.priority] || 0
      if (pA !== pB) return pB - pA
      return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    })
}

/**
 * Peristiwa yang belum punya kasus.
 *
 * Yang dibandingkan adalah id publikasinya, bukan judulnya. Judul peristiwa
 * dipilih lib/peristiwa.js dari publikasi terbaik di dalam kelompoknya, dan
 * pilihan itu bisa berubah begitu ada publikasi baru masuk — sehingga
 * pencocokan menurut judul akan menawarkan ulang peristiwa yang kasusnya
 * sudah dibuat kemarin.
 */
function peristiwaTanpaKasus(berita) {
  const sudah = new Set(keadaanKasus.kasusBerita.map((b) => String(b.berita_id)))
  const negatif = dasar(berita).filter((b) => ember(b) === 'negatif')
  return kelompokkanPeristiwa(negatif)
    .filter((p) => !p.publikasi.some((b) => sudah.has(String(b.id))))
    .slice(0, 40)
}

/* ------------------------------------------------------------------ antrean */

function antrean(daftar) {
  if (!daftar.length) {
    return `<li><p class="ket" style="padding:16px 10px">
      Tidak ada kasus yang cocok dengan saringan ini.</p></li>`
  }

  return daftar.map((k) => {
    const s = statusKasus(k.status)
    const isi = keadaanKasus.isi.untuk(k.id)
    const tanda = isi.tindakTerlambat
      ? `<span class="keping" data-nada="kritis">${angka(isi.tindakTerlambat)} terlambat</span>`
      : ''
    return barisAntrean({
      id: k.id,
      nomor: k.case_number,
      judul: k.title,
      ket: `${k.primary_upt || 'Unit belum teridentifikasi'} · ${jarakWaktu(k.created_at)}`,
      nada: s.nada,
      label: s.nama,
      angka: isi.berita,
      satuan: 'berita',
      terpilih: k.id === keadaanKasus.dipilih,
      tanda,
    })
  }).join('')
}

/* ------------------------------------------------------------------ rincian */

function rincian(kasus, keadaan, bolehKelola) {
  const isi = keadaanKasus.isi.untuk(kasus.id)
  const berikut = langkahBerikut(kasus)

  const terkait = keadaanKasus.kasusBerita
    .filter((b) => b.case_id === kasus.id)
    .map((b) => (keadaan.berita || []).find((x) => String(x.id) === String(b.berita_id)) || {
      id: b.berita_id, judul: '(berita tidak lagi ada di arsip yang dimuat)',
    })

  const aksi = `
    ${kasusTerbuka(kasus) ? tombol({
      label: `Lanjutkan: ${berikut.label}`,
      ikon: 'panahKanan', gaya: 'utama', kecil: true, halaman: berikut.halaman,
    }) : ''}
    ${bolehKelola ? tombol({ label: 'Sunting', ikon: 'pengaturan', kecil: true, aksi: 'sunting-kasus' }) : ''}`

  return `
    ${kepalaKasus(kasus, { aksi })}

    <div class="siklus-bagian">
      ${relTahap(kasus, isi)}
    </div>

    <div class="siklus-bagian">
      <div class="kisi kisi-4" style="gap:10px">
        ${ubinKecil('Publikasi terkait', isi.berita, 'berita yang dikaitkan analis')}
        ${ubinKecil('Surat tugas', isi.penugasan, `${angka(isi.laporanLapangan)} laporan masuk`)}
        ${ubinKecil('Rekomendasi', isi.rekomendasi, `${angka(isi.rekomendasiDisetujui)} disetujui`)}
        ${ubinKecil('Tindak lanjut', isi.tindak,
          isi.tindakTerlambat ? `${angka(isi.tindakTerlambat)} lewat tenggat` : `${angka(isi.tindakSelesai)} selesai`,
          isi.tindakTerlambat ? 'kritis' : 'netral')}
      </div>
    </div>

    ${kasus.summary ? `
      <div class="siklus-bagian">
        <div class="siklus-bagian-kop"><span class="label-mono">Ringkasan analis</span></div>
        <p class="kecil-teks" style="line-height:1.6;color:var(--ink-2)">${amankan(kasus.summary)}</p>
      </div>` : ''}

    <div class="siklus-bagian">
      <div class="siklus-bagian-kop">
        <span class="label-mono">Publikasi yang dikaitkan</span>
        <span class="mini-teks samar-teks">${angka(terkait.length)} berita</span>
      </div>
      ${terkait.length ? `
        <ul class="siklus-daftar">
          ${terkait.map((b) => `
            <li class="siklus-butir">
              <div class="siklus-butir-kop">
                ${b.urgensi ? keping(b.urgensi, nadaUrgensi(b.urgensi), true) : ''}
                <span class="mini-teks samar-teks">
                  ${amankan(b.media || 'Sumber tidak tercatat')}
                  ${b.created_at ? ` · ${amankan(jarakWaktu(b.created_at))}` : ''}
                </span>
                ${bolehKelola ? `
                  <button class="tbl ikon samar kecil dorong" data-lepas="${amankan(b.id)}"
                          title="Lepaskan dari kasus ini" aria-label="Lepaskan dari kasus ini">
                    ${ikon('tutup')}</button>` : ''}
              </div>
              <p>${amankan(ringkas(b.judul || 'Tanpa judul', 150))}</p>
              ${b.link ? `<a class="mini-teks" href="${amankan(b.link)}" target="_blank"
                    rel="noopener noreferrer">Buka sumber asli</a>` : ''}
            </li>`).join('')}
        </ul>`
        : `<p class="ket">Belum ada publikasi yang dikaitkan. Kasus tanpa publikasi tetap sah —
           misalnya laporan yang masuk lewat jalur lain — tetapi laporan berkala tidak akan
           bisa menyebutkan sumbernya.</p>`}
    </div>

    <div class="siklus-bagian">
      <div class="siklus-bagian-kop"><span class="label-mono">Riwayat</span></div>
      <dl class="riwayat-ringkas">
        <div><dt>Dibuat</dt><dd>${amankan(tanggalJam(kasus.created_at))} oleh ${amankan(kasus.created_by || '—')}</dd></div>
        <div><dt>Pemberitaan pertama</dt><dd>${amankan(kasus.first_detected_at ? tanggalJam(kasus.first_detected_at) : '—')}</dd></div>
        <div><dt>Pemberitaan terakhir</dt><dd>${amankan(kasus.last_media_at ? tanggalJam(kasus.last_media_at) : '—')}</dd></div>
        <div><dt>Penanggung jawab</dt><dd>${amankan(kasus.owner_username || 'Belum ditetapkan')}</dd></div>
        ${kasus.closed_at ? `<div><dt>Ditutup</dt><dd>${amankan(tanggalJam(kasus.closed_at))}</dd></div>` : ''}
      </dl>
    </div>`
}

function ubinKecil(label, nilai, kaki, nada = 'netral') {
  return `
    <div class="ubin" data-nada="${amankan(nada)}">
      <div class="ubin-label">${amankan(label)}</div>
      <div class="ubin-nilai angka">${angka(nilai)}</div>
      <div class="ubin-kaki">${amankan(kaki)}</div>
    </div>`
}

/* ------------------------------------------------------------------- borang */

function borangKasus(kasus, peristiwa) {
  const baru = !kasus?.id
  return `
    <div class="siklus-rinci">
      <div class="kasus-kepala">
        <div class="kasus-kepala-teks">
          <span class="label-mono">${baru ? 'Kasus baru' : amankan(kasus.case_number)}</span>
          <h3>${baru ? 'Bentuk kasus intelijen' : 'Sunting kasus'}</h3>
        </div>
        <button class="tbl kecil samar" data-aksi="batal-borang">${ikon('tutup')}Batal</button>
      </div>

      ${baru && peristiwa ? `
        <div class="pesan" data-nada="aksen" style="margin-bottom:14px">
          ${ikon('info')}
          <div>
            <b>${angka(peristiwa.jumlah_publikasi)} publikasi dari ${angka(peristiwa.jumlah_media)} media</b>
            akan langsung dikaitkan ke kasus ini. Semuanya sudah disatukan mesin peristiwa
            sebagai satu kejadian yang sama.
          </div>
        </div>` : ''}

      <form class="borang-kisi" data-peran="borang-kasus">
        ${bidangSatuBaris({
          nama: 'title', label: 'Judul kasus', nilai: kasus?.title || '',
          ket: 'Kalimat yang menyebut perkaranya, bukan judul salah satu beritanya.',
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}

        ${bidangSatuBaris({
          nama: 'primary_upt', label: 'UPT utama', nilai: kasus?.primary_upt || '',
          ket: 'Unit yang menjadi pokok perkara. Satu, sekalipun beritanya menyebut beberapa.',
        })}

        ${bidangSatuBaris({
          nama: 'issue_type', label: 'Jenis isu', nilai: kasus?.issue_type || '',
          ket: 'Diambil dari subkategori berita bila kasusnya dibentuk dari peristiwa.',
        })}

        ${bidangPilih({
          nama: 'status', label: 'Status', nilai: kasus?.status || 'Terdeteksi',
          opsi: NAMA_STATUS_KASUS,
          ket: 'Menaikkan tahap tidak pernah otomatis — yang menaikkannya orang, dan namanya tercatat.',
        })}

        ${bidangPilih({
          nama: 'priority', label: 'Prioritas', nilai: kasus?.priority || 'Sedang',
          opsi: PRIORITAS,
        })}

        ${bidangPilih({
          nama: 'actuality_status', label: 'Keaktualan', nilai: kasus?.actuality_status || 'Tidak Dapat Dipastikan',
          opsi: NAMA_KEAKTUALAN,
          ket: 'Apakah isi beritanya benar. Terpisah dari status penanganannya.',
        })}

        ${bidangSatuBaris({
          nama: 'owner_username', label: 'Penanggung jawab', nilai: kasus?.owner_username || '',
          petunjuk: 'username analis',
        })}

        ${bidangTeks({
          nama: 'summary', label: 'Ringkasan analis', nilai: kasus?.summary || '', baris: 4,
          ket: 'Apa yang terjadi, apa yang belum diketahui, dan mengapa ini menuntut perhatian.',
        }).replace('<label class="bidang"', '<label class="bidang penuh"')}
      </form>

      <div class="baris gap-6" style="margin-top:16px">
        ${tombol({
          label: baru ? 'Bentuk kasus' : 'Simpan perubahan',
          ikon: 'centang', gaya: 'utama', aksi: 'simpan-kasus',
          nonaktif: keadaanKasus.sibuk,
        })}
        <span class="mini-teks samar-teks">
          Perubahan status tercatat di Jejak Audit beserta nama dan waktunya.
        </span>
      </div>
    </div>`
}

/** Daftar peristiwa yang bisa dijadikan kasus. */
function pilihPeristiwa(peristiwa) {
  return `
    <div class="siklus-rinci">
      <div class="kasus-kepala">
        <div class="kasus-kepala-teks">
          <span class="label-mono">Kasus baru</span>
          <h3>Pilih peristiwa yang akan dijadikan kasus</h3>
          <p class="mini-teks samar-teks" style="margin-top:5px">
            Publikasi di bawah sudah disatukan mesin peristiwa sebagai kejadian yang sama.
            Yang sudah punya kasus tidak ditawarkan lagi.
          </p>
        </div>
        <button class="tbl kecil samar" data-aksi="batal-borang">${ikon('tutup')}Batal</button>
      </div>

      ${peristiwa.length ? `
        <ul class="siklus-daftar">
          ${peristiwa.map((p, i) => `
            <li class="siklus-butir">
              <div class="siklus-butir-kop">
                ${keping(p.urgensi || 'Rendah', nadaUrgensi(p.urgensi), true)}
                <span class="mini-teks samar-teks">
                  ${amankan(p.nama_upt || 'Unit belum terpetakan')} ·
                  ${angka(p.jumlah_publikasi)} publikasi · ${angka(p.jumlah_media)} media
                </span>
                <button class="tbl kecil utama dorong" data-peristiwa="${i}">
                  ${ikon('tambah')}Jadikan kasus
                </button>
              </div>
              <p>${amankan(ringkas(p.judul || 'Tanpa judul', 160))}</p>
              <span class="mini-teks samar-teks">
                ${amankan(p.subkategori || p.kategori || '')}
                ${p.tanggal_pertama ? ` · pertama terbit ${amankan(jarakWaktu(p.tanggal_pertama))}` : ''}
              </span>
            </li>`).join('')}
        </ul>`
        : kosong(
          'Tidak ada peristiwa yang belum berkasus',
          'Setiap kelompok pemberitaan negatif yang terdeteksi sudah punya kasusnya masing-masing. '
          + 'Kasus baru tetap bisa dibentuk dari nol lewat tombol di bawah.',
        )}

      <div class="baris gap-6" style="margin-top:14px">
        ${tombol({ label: 'Bentuk kasus dari nol', ikon: 'tambah', aksi: 'kasus-kosong' })}
      </div>
    </div>`
}

/* ------------------------------------------------------------------ halaman */

export function halamanKasus({ keadaan, isi }) {
  const bolehKelola = punyaIzin(keadaan.profil?.role, 'kelola_kasus')

  function gambar() {
    if (keadaanKasus.galat) {
      isi.innerHTML = kartu({
        isi: `<div class="pesan" data-nada="kritis">${ikon('peringatan')}
          <div><b>Daftar kasus gagal dimuat.</b> ${amankan(keadaanKasus.galat)}</div></div>`,
      })
      return
    }

    if (!keadaanKasus.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:420px"></div>' })
      return
    }

    const terlihat = saring(keadaanKasus.kasus)
    const dipilih = keadaanKasus.kasus.find((k) => k.id === keadaanKasus.dipilih)
    const terbuka = keadaanKasus.kasus.filter(kasusTerbuka).length

    const kanan = keadaanKasus.borang === 'pilih'
      ? pilihPeristiwa(peristiwaTanpaKasus(keadaan.berita || []))
      : keadaanKasus.borang
        ? borangKasus(keadaanKasus.borang.kasus, keadaanKasus.borang.peristiwa)
        : `<div class="siklus-rinci">${dipilih
          ? rincian(dipilih, keadaan, bolehKelola)
          : belumDipilih(
            'Pilih satu kasus di sebelah kiri',
            'Rinciannya muncul di sini: tahap yang sudah dilewati, publikasi yang dikaitkan, '
            + 'dan jumlah berkas pada tiap tahap berikutnya.',
          )}</div>`

    isi.innerHTML = `
      <div class="tumpuk">
        <div class="bilah-alat">
          <label class="cari" style="max-width:260px">
            ${ikon('cari')}
            <input class="masukan" type="search" data-peran="cari-kasus"
                   value="${amankan(keadaanKasus.cari)}"
                   placeholder="Cari nomor, judul, atau UPT" aria-label="Cari kasus">
          </label>

          <select class="pilihan" data-saring="saringStatus" aria-label="Saring status"
                  style="width:auto;min-width:180px">
            ${['Semua status', ...NAMA_STATUS_KASUS].map((s) =>
              `<option${s === keadaanKasus.saringStatus ? ' selected' : ''}>${amankan(s)}</option>`).join('')}
          </select>

          <select class="pilihan" data-saring="saringPrioritas" aria-label="Saring prioritas"
                  style="width:auto;min-width:150px">
            ${['Semua prioritas', ...PRIORITAS].map((p) =>
              `<option${p === keadaanKasus.saringPrioritas ? ' selected' : ''}>${amankan(p)}</option>`).join('')}
          </select>

          <div class="dorong baris gap-6">
            <span class="mini-teks samar-teks">
              ${angka(terbuka)} terbuka dari ${angka(keadaanKasus.kasus.length)} kasus
            </span>
            ${bolehKelola ? tombol({
              label: 'Kasus baru', ikon: 'tambah', gaya: 'utama', kecil: true, aksi: 'kasus-baru',
            }) : ''}
          </div>
        </div>

        <div class="siklus-tata">
          <div class="siklus-antrean">
            <div class="siklus-antrean-kop">
              <span class="label-mono">Daftar kasus</span>
              <span class="mini-teks samar-teks dorong">${angka(terlihat.length)} tampil</span>
            </div>
            <ul>${antrean(terlihat)}</ul>
          </div>
          ${kanan}
        </div>
      </div>`
  }

  /* --------------------------------------------------------------- tindakan */

  async function simpan() {
    const borang = isi.querySelector('[data-peran="borang-kasus"]')
    if (!borang) return
    const nilai = bacaBorang(borang)

    if (!nilai.title?.trim()) {
      roti('Judul kasus tidak boleh kosong.', 'sedang')
      return
    }

    keadaanKasus.sibuk = true
    gambar()

    try {
      const lama = keadaanKasus.borang.kasus
      const perubahan = {
        title: nilai.title.trim(),
        primary_upt: nilai.primary_upt?.trim() || 'Belum Teridentifikasi',
        issue_type: nilai.issue_type?.trim() || 'Lainnya',
        status: nilai.status,
        priority: nilai.priority,
        actuality_status: nilai.actuality_status,
        owner_username: nilai.owner_username?.trim() || null,
        summary: nilai.summary?.trim() || null,
      }

      if (lama?.id) {
        // Kasus yang ditutup mencatat waktunya; yang dibuka kembali
        // membersihkannya. Tanpa ini, sebuah kasus bisa berstatus "Terdeteksi"
        // sekaligus punya tanggal penutupan — dan yang membacanya tidak punya
        // cara tahu mana yang benar.
        const menutup = ['Selesai', 'Ditutup'].includes(nilai.status)
        perubahan.closed_at = menutup ? (lama.closed_at || new Date().toISOString()) : null
        perubahan.updated_by = penulis()
        perubahan.updated_at = new Date().toISOString()
        await ubahSiklus('kasus', lama.id, perubahan)
        Object.assign(lama, perubahan)
        roti('Kasus diperbarui.', 'positif')
      } else {
        const peristiwa = keadaanKasus.borang.peristiwa
        const baris = await tulisSiklus('kasus', {
          ...perubahan,
          ...(keadaan.demo ? { case_number: nomorSementara() } : {}),
          first_detected_at: peristiwa?.tanggal_pertama || new Date().toISOString(),
          last_media_at: peristiwa?.tanggal_terakhir || new Date().toISOString(),
          article_count: peristiwa?.jumlah_publikasi || 0,
          media_count: peristiwa?.jumlah_media || 0,
          negative_count: peristiwa?.jumlah_publikasi || 0,
          highest_urgency: peristiwa?.urgensi || nilai.priority,
          created_by: penulis(),
        })

        const kasusBaru = Array.isArray(baris) ? baris[0] : baris
        keadaanKasus.kasus.unshift(kasusBaru)
        keadaanKasus.dipilih = kasusBaru.id

        if (peristiwa?.publikasi?.length) {
          for (const b of peristiwa.publikasi) {
            const kaitan = await tulisSiklus('kasusBerita', {
              case_id: kasusBaru.id, berita_id: String(b.id), linked_by: penulis(),
            })
            keadaanKasus.kasusBerita.push(Array.isArray(kaitan) ? kaitan[0] : kaitan)
          }
        }
        roti(`Kasus ${kasusBaru.case_number || 'baru'} terbentuk.`, 'positif')
      }

      keadaanKasus.borang = null
      hitungUlang()
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
      console.error(galat)
    } finally {
      keadaanKasus.sibuk = false
      gambar()
    }
  }

  /**
   * Nomor sementara untuk mode peragaan.
   *
   * Pada penggelaran sungguhan nomornya diterbitkan basis data lewat
   * `next_intelligence_case_number()`, dan itu memang tempatnya: nomor yang
   * diterbitkan peramban akan bertabrakan begitu dua analis membentuk kasus
   * pada detik yang sama.
   */
  function nomorSementara() {
    const tahun = String(new Date().getFullYear()).slice(2)
    const urut = keadaanKasus.kasus.length + 1
    return `KI-${tahun}${String(urut).padStart(4, '0')}`
  }

  function hitungUlang() {
    keadaanKasus.isi = hitungIsiKasus({
      kasusBerita: keadaanKasus.kasusBerita,
      penugasan: [], laporanLapangan: [], analisis: [], rekomendasi: [], putusan: [], tindak: [],
    })
    // Hitungan tahap lain tidak ikut dimuat ulang di sini — halaman ini tidak
    // mengubahnya. Yang berubah hanya kaitan berita, dan itulah yang dihitung
    // ulang; sisanya diambil lagi pada pemuatan halaman berikutnya.
    muat(keadaan).then(gambar).catch(() => {})
  }

  async function lepaskan(beritaId) {
    const kasus = keadaanKasus.kasus.find((k) => k.id === keadaanKasus.dipilih)
    if (!kasus) return
    const ya = await konfirmasi({
      judul: 'Lepaskan publikasi dari kasus ini?',
      pesan: 'Beritanya tidak dihapus — hanya kaitannya dengan kasus ini yang dilepas. '
        + 'Ia tetap ada di Pusat Data Berita dan tetap dihitung pada seluruh angka lain.',
      tegas: 'Lepaskan',
    })
    if (!ya) return

    try {
      const kaitan = keadaanKasus.kasusBerita.find(
        (b) => b.case_id === kasus.id && String(b.berita_id) === String(beritaId),
      )
      if (!kaitan) return
      await hapusKaitan(kaitan)
      keadaanKasus.kasusBerita = keadaanKasus.kasusBerita.filter((b) => b !== kaitan)
      keadaanKasus.isi = hitungIsiKasus({ kasusBerita: keadaanKasus.kasusBerita })
      roti('Publikasi dilepaskan dari kasus.', 'positif')
      gambar()
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    }
  }

  /**
   * Melepas kaitan berarti menghapus barisnya.
   *
   * Menandainya "lepas" tidak mungkin: case_id pada case_news NOT NULL, jadi
   * tidak ada nilai yang bisa dipakai sebagai penanda lepas. Riwayat
   * pelepasannya tetap ada — di Jejak Audit, tempat setiap tindakan tercatat
   * beserta nama dan waktunya.
   *
   * DELETE tidak disediakan lib/api.js karena tidak ada halaman lain yang
   * memerlukannya; permintaannya dirakit di sini, dengan kepala yang sama
   * dengan yang dipakai lapisan itu.
   */
  async function hapusKaitan(kaitan) {
    if (keadaan.demo) {
      const { simpananDemo } = await import('../lib/siklus-data.js')
      const simpanan = simpananDemo()
      const i = simpanan.kasusBerita.indexOf(kaitan)
      if (i >= 0) simpanan.kasusBerita.splice(i, 1)
      return
    }

    const { KONFIG_AKTIF, sesiSekarang } = await import('../lib/api.js')
    const sesi = sesiSekarang()
    const jawab = await fetch(
      `${KONFIG_AKTIF.url}/rest/v1/case_news?id=eq.${encodeURIComponent(kaitan.id)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: KONFIG_AKTIF.kunciPublik,
          Authorization: sesi?.access_token ? `Bearer ${sesi.access_token}` : '',
        },
      },
    )
    if (!jawab.ok) throw new Error(`Peladen menolak pelepasan kaitan (${jawab.status}).`)
  }

  /* ---------------------------------------------------------------- penyimak */

  isi.addEventListener('click', async (ev) => {
    const pilih = ev.target.closest('[data-pilih]')?.dataset.pilih
    if (pilih) {
      keadaanKasus.dipilih = pilih
      keadaanKasus.borang = null
      gambar()
      return
    }

    const lepas = ev.target.closest('[data-lepas]')?.dataset.lepas
    if (lepas) { lepaskan(lepas); return }

    const indeksPeristiwa = ev.target.closest('[data-peristiwa]')?.dataset.peristiwa
    if (indeksPeristiwa != null) {
      const p = peristiwaTanpaKasus(keadaan.berita || [])[Number(indeksPeristiwa)]
      if (!p) return
      keadaanKasus.borang = {
        peristiwa: p,
        kasus: {
          title: p.judul,
          primary_upt: belumTerpetakan(p.nama_upt) ? '' : p.nama_upt,
          issue_type: p.subkategori || p.kategori || '',
          status: 'Terdeteksi',
          priority: p.urgensi || 'Sedang',
          actuality_status: 'Tidak Dapat Dipastikan',
        },
      }
      gambar()
      return
    }

    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (aksi === 'kasus-baru') { keadaanKasus.borang = 'pilih'; gambar() }
    else if (aksi === 'kasus-kosong') { keadaanKasus.borang = { kasus: null, peristiwa: null }; gambar() }
    else if (aksi === 'batal-borang') { keadaanKasus.borang = null; gambar() }
    else if (aksi === 'sunting-kasus') {
      const kasus = keadaanKasus.kasus.find((k) => k.id === keadaanKasus.dipilih)
      if (kasus) { keadaanKasus.borang = { kasus, peristiwa: null }; gambar() }
    } else if (aksi === 'simpan-kasus') simpan()
  })

  isi.addEventListener('change', (ev) => {
    const bidangSaring = ev.target.dataset.saring
    if (!bidangSaring) return
    keadaanKasus[bidangSaring] = ev.target.value
    gambar()
  })

  let jeda = null
  isi.addEventListener('input', (ev) => {
    if (ev.target.dataset.peran !== 'cari-kasus') return
    const nilai = ev.target.value
    clearTimeout(jeda)
    jeda = setTimeout(() => {
      keadaanKasus.cari = nilai
      // Hanya antrean yang digambar ulang, supaya fokus dan letak kursor teks
      // di kotak cari tidak hilang di tengah kata kedua.
      const daftar = isi.querySelector('.siklus-antrean ul')
      if (daftar) daftar.innerHTML = antrean(saring(keadaanKasus.kasus))
    }, 180)
  })

  /* ------------------------------------------------------------------- muat */

  gambar()
  muat(keadaan)
    .then(() => {
      if (!keadaanKasus.dipilih) keadaanKasus.dipilih = saring(keadaanKasus.kasus)[0]?.id || null
      gambar()
    })
    .catch((galat) => {
      keadaanKasus.galat = pesanRamah(galat)
      gambar()
    })

  return {
    judul: 'Kasus Intelijen',
    sub: 'Pemberitaan yang sudah menjadi perkara, beserta tahap penanganannya',
  }
}
