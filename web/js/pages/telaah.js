/**
 * Antrean Telaah — ruang kerja analis memeriksa hasil mesin.
 *
 * Mesin klasifikasi menilai enam ratus lebih publikasi tanpa pernah ragu-ragu
 * di layar. Angka keyakinannya ada, tetapi selama tidak ada tempat untuk
 * menyetujui atau mengoreksinya, angka itu tidak berarti apa-apa: hasil
 * berkeyakinan 0,20 dan 0,95 sama-sama masuk laporan tanpa pernah dibaca
 * manusia. Halaman ini yang menutup lubang itu.
 *
 * Bentuknya antrean satu-per-satu, bukan tabel. Alasannya soal ketelitian.
 * Sebuah tabel dengan dua puluh baris mengundang orang mencentang semuanya
 * sekaligus; satu berita yang memenuhi layar menuntut ia dibaca dulu. Untuk
 * pekerjaan yang hasilnya menjadi dasar keputusan pimpinan, gesekan itu justru
 * yang diinginkan.
 *
 * Yang tidak boleh hilang dari layar ini: alasan mesin. Analis yang menyetujui
 * tanpa tahu atas dasar apa mesin memutuskan bukan sedang menelaah, ia sedang
 * menandatangani. Maka kata kunci penentu, skor, dan pesaing terdekatnya
 * ditampilkan apa adanya — termasuk ketika mesin salah, sebab dari situlah
 * kesalahan mesin bisa dilaporkan dan diperbaiki.
 */

import { kartu, tombol, keping, kosong, pesanSistem, roti, konfirmasi } from '../ui/komponen.js'
/* Panel penilaian mesin tinggal di ui/, bukan di sini, sejak halaman detail
   berita ikut memakainya. Dua salinan panel yang menampilkan dasar keputusan
   mesin akan berpisah, dan yang pertama menyadarinya adalah analis yang
   melihat dua alasan berbeda untuk berita yang sama. */
import { panelMesin } from '../ui/panel-mesin.js'
import {
  amankan, angka, ringkas, jarakWaktu, tanggalJam,
  nadaUrgensi, asalTautan,
} from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { perbarui, pesanRamah } from '../lib/api.js'
import { KATEGORI, SEMUA_SUBKATEGORI } from '../lib/taksonomi.js'
import { EMBER, ember, nilaiSimpan } from '../lib/sentimen.js'
import { menungguTelaah } from '../lib/hitung.js'

const URGENSI = ['Rendah', 'Sedang', 'Tinggi', 'Kritis']

/**
 * Keterangan tiap tingkat urgensi.
 *
 * Alasannya sama dengan keterangan sentimen: tanpa definisi di layar, "Tinggi"
 * dan "Kritis" dibedakan menurut perasaan masing-masing analis, dan angka
 * "perlu respons segera" di dasbor pimpinan menjadi jumlah perasaan.
 */
const KETERANGAN_URGENSI = {
  Rendah: 'Tidak menuntut tindakan. Dibaca sebagai bahan pemantauan biasa.',
  Sedang: 'Perlu diketahui pimpinan UPT, tetapi belum menuntut tindakan hari ini.',
  Tinggi: 'Berpotensi meluas bila dibiarkan. Menuntut verifikasi lapangan dan sikap resmi.',
  Kritis: 'Menyangkut nyawa atau stabilitas dan sedang berlangsung. Menuntut respons segera.',
}

/** Keadaan halaman, bertahan selama sesi supaya posisi antrean tidak hilang. */
const keadaanTelaah = {
  nomor: 0,
  koreksi: false,
  sibuk: false,
  /** Berita yang dituju dari Peringatan Dini, disematkan di kepala antrean. */
  fokus: null,
  /** Berita yang sudah diputuskan pada sesi ini, supaya tidak muncul lagi. */
  selesai: new Set(),
  /** Hitungan untuk bilah kemajuan. */
  disetujui: 0,
  dikoreksi: 0,
  ditolak: 0,
}

/**
 * Urutan antrean.
 *
 * Yang mendesak lebih dulu, lalu yang paling tidak diyakini mesin. Bukan
 * sebaliknya: berita kritis yang salah kategori merugikan jauh lebih cepat
 * daripada unggahan seremonial yang salah kategori, betapa pun rendah
 * keyakinannya.
 */
function susunAntrean(berita) {
  const peringkat = { Kritis: 4, Tinggi: 3, Sedang: 2, Rendah: 1 }
  const urut = berita
    .filter((b) => !keadaanTelaah.selesai.has(b.id))
    // Aturan "apa yang menunggu telaah" dipinjam dari lib/hitung.js, bukan
    // ditulis ulang di sini. Dulu keduanya berbeda, dan lencana menu karena itu
    // menyebut angka yang tidak pernah cocok dengan panjang antreannya.
    .filter(menungguTelaah)
    .sort((a, b) => {
      const u = (peringkat[b.urgensi] || 0) - (peringkat[a.urgensi] || 0)
      if (u) return u
      return (Number(a.ai_confidence) || 0) - (Number(b.ai_confidence) || 0)
    })

  /*
     Berita yang dituju dari Peringatan Dini disematkan di kepala antrean.
     Tanpa ini, tombol "Telaah" di sana hanya memindahkan orang ke halaman
     telaah dan meninggalkannya mencari sendiri berita yang barusan dibaca —
     yang justru mustahil, sebab antrean disusun menurut urgensi dan keyakinan
     mesin, bukan menurut apa yang terakhir dibuka.
  */
  const id = keadaanTelaah.fokus
  if (!id) return urut

  const posisi = urut.findIndex((b) => b.id === id)
  if (posisi > 0) {
    const [dipilih] = urut.splice(posisi, 1)
    urut.unshift(dipilih)
    return urut
  }
  if (posisi === 0) return urut

  // Tidak ada di antrean — misalnya statusnya sudah berubah di tempat lain.
  // Tetap dibuka, supaya penekan tombolnya tidak menghadapi layar yang diam.
  const luar = berita.find((b) => b.id === id && !keadaanTelaah.selesai.has(b.id))
  if (luar) urut.unshift(luar)
  return urut
}

/* ------------------------------------------------------------------ bagian */

/** Bilah kemajuan sesi. Menelaah tanpa tahu sisa antreannya terasa tanpa ujung. */
function kemajuan(sisa, awal) {
  const selesai = awal - sisa
  const bagian = awal ? Math.round((selesai / awal) * 100) : 0
  return `
    <div class="telaah-kemajuan">
      <div class="telaah-kemajuan-bilah">
        <i style="width:${bagian}%"></i>
      </div>
      <div class="telaah-kemajuan-teks">
        <span><b>${angka(selesai)}</b> ditelaah sesi ini</span>
        <span>${angka(sisa)} menunggu</span>
      </div>
    </div>`
}

/** Formulir koreksi. Muncul hanya ketika analis memang hendak mengubah. */
function panelKoreksi(b) {
  const pilihanSub = KATEGORI.map((k) => `
    <optgroup label="${amankan(k.kode)}. ${amankan(k.nama)}">
      ${k.subkategori.map((s) => `
        <option value="${amankan(s.kode)}"${s.kode === b.subkategori_kode ? ' selected' : ''}>
          ${amankan(s.kode)} ${amankan(s.nama)}
        </option>`).join('')}
    </optgroup>`).join('')

  return `
    <div class="koreksi-panel">
      <div class="isian">
        <label for="koreksi-sub">Subkategori yang benar</label>
        <select class="pilihan penuh" id="koreksi-sub">
          ${pilihanSub}
          <option value="0.1"${b.subkategori_kode === '0.1' ? ' selected' : ''}>0.1 Belum Dikelompokkan</option>
          <option value="9.1"${b.subkategori_kode === '9.1' ? ' selected' : ''}>9.1 Unit Non-Pemasyarakatan</option>
          <option value="9.2"${b.subkategori_kode === '9.2' ? ' selected' : ''}>9.2 Konten Tidak Relevan</option>
        </select>
        <div class="ket">Kategori induknya ikut menyesuaikan sendiri.</div>
      </div>

      ${/*
        Sentimen tidak lagi berupa daftar polos berisi empat kata.
        Empat kata tanpa definisi berarti dua analis yang membaca berita yang
        sama boleh memilih berbeda, dan tidak ada cara mengetahui siapa yang
        keliru — sementara pilihan itulah yang menjadi angka di dasbor
        pimpinan. Sekarang tiap ember membawa definisinya sendiri di layar.
      */''}
      <fieldset class="pilih-sentimen">
        <legend>Sentimen</legend>
        <div class="pilih-deret">
          ${EMBER.map((e) => {
            const terpilih = ember(b) === e.kode
            return `
              <label class="pilih-kartu" data-nada="${e.nada}">
                <input type="radio" name="koreksi-sentimen" value="${e.kode}"${terpilih ? ' checked' : ''}>
                <span class="pilih-isi">
                  <span class="pilih-judul">${amankan(e.label)}
                    <span class="pilih-ringkas">${amankan(e.ringkas)}</span></span>
                  <span class="pilih-ket">${amankan(e.keterangan)}</span>
                  ${e.petunjuk ? `<span class="pilih-petunjuk">${amankan(e.petunjuk)}</span>` : ''}
                </span>
              </label>`
          }).join('')}
        </div>
        ${b.sentimen === 'Campuran' ? `
          <div class="ket">Mesin menilai berita ini <b>Campuran</b>. Membiarkannya pada ember
          Netral/Campuran tidak menghapus nilai itu.</div>` : ''}
      </fieldset>

      <div class="isian">
        <label for="koreksi-urgensi">Urgensi</label>
        <select class="pilihan penuh" id="koreksi-urgensi">
          ${URGENSI.map((s) => `<option${s === b.urgensi ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
        <div class="ket" id="ket-urgensi">${amankan(KETERANGAN_URGENSI[b.urgensi] || KETERANGAN_URGENSI.Rendah)}</div>
      </div>

      <div class="isian">
        <label for="koreksi-catatan">Alasan koreksi</label>
        <textarea class="masukan" id="koreksi-catatan" rows="2"
          placeholder="Apa yang keliru dari penilaian mesin?"></textarea>
        <div class="ket">
          Catatan ini yang dipakai memperbaiki mesin. Menuliskan “salah” tanpa menyebut
          apa yang salah tidak menolong siapa pun pada peninjauan berikutnya.
        </div>
      </div>
    </div>`
}

/* ----------------------------------------------------------------- halaman */

export function halamanTelaah({ keadaan, isi }) {
  const semua = keadaan.dalamLingkup || []

  /*
     Berita yang dituju dipindahkan ke keadaan halaman, lalu penandanya di
     keadaan aplikasi dihapus. Kalau tidak, kembali ke halaman ini seminggu
     kemudian akan menyematkan lagi berita yang sudah lama selesai.
  */
  if (keadaan.fokus) {
    keadaanTelaah.fokus = keadaan.fokus
    keadaanTelaah.nomor = 0
    keadaanTelaah.koreksi = false
    keadaan.fokus = null
  }

  const awal = susunAntrean(semua).length + keadaanTelaah.selesai.size

  function gambar() {
    const antrean = susunAntrean(semua)
    const b = antrean[Math.min(keadaanTelaah.nomor, Math.max(0, antrean.length - 1))]

    if (!antrean.length) {
      isi.innerHTML = `<div class="tumpuk">
        ${kemajuan(0, Math.max(awal, 1))}
        ${kartu({
          isi: kosong(
            'Antrean telaah kosong',
            keadaanTelaah.selesai.size
              ? `${angka(keadaanTelaah.selesai.size)} publikasi selesai ditelaah pada sesi ini. Tidak ada lagi yang menunggu.`
              : 'Tidak ada publikasi yang menunggu telaah. Setiap hasil mesin sudah pernah dibaca manusia.',
            tombol({ label: 'Kembali ke dasbor', ikon: 'dasbor', gaya: 'utama', halaman: 'dasbor' }),
          ),
        })}
      </div>`
      return
    }

    isi.innerHTML = `
      <div class="tumpuk">
        ${kemajuan(antrean.length, Math.max(awal, 1))}

        ${keadaanTelaah.fokus === b.id ? pesanSistem(
          '<b>Dibuka dari Peringatan Dini.</b> Berita ini disematkan di kepala antrean. '
          + 'Sesudah diputuskan, antrean kembali berjalan menurut urutan biasa.',
          'aksen', 'peringatan',
        ) : ''}

        ${kartu({
          judul: 'Publikasi yang ditelaah',
          ket: `Nomor ${keadaanTelaah.nomor + 1} dari ${angka(antrean.length)} dalam antrean`,
          aksi: `
            <span class="keping" data-nada="${nadaUrgensi(b.urgensi)}">${amankan(b.urgensi || '—')}</span>
            ${b.link ? `<a class="tbl kecil" href="${amankan(b.link)}" target="_blank" rel="noopener">
              ${ikon('tautan')}Buka sumber</a>` : ''}`,
          isi: `
            <article class="telaah-berita">
              <h3>${amankan(b.judul || '(tanpa judul)')}</h3>
              <div class="telaah-meta">
                ${[
                  b.media ? amankan(b.media) : '',
                  b.nama_upt ? amankan(b.nama_upt) : '<span class="kritis-teks">unit belum dipetakan</span>',
                  b.tanggal_publikasi ? amankan(tanggalJam(b.tanggal_publikasi)) : amankan(jarakWaktu(b.created_at)),
                  b.link ? amankan(asalTautan(b.link)) : '',
                ].filter(Boolean).join(' <span class="pemisah">·</span> ')}
              </div>
              ${b.ringkasan ? `<p class="telaah-ringkas">${amankan(ringkas(b.ringkasan, 600))}</p>` : ''}
            </article>

            <div class="kisi kisi-utama-samping" style="margin-top:16px">
              ${panelMesin(b)}
              <div>
                ${keadaanTelaah.koreksi
                  ? panelKoreksi(b)
                  : `<div class="telaah-tuntun">
                      <p>Bacalah judul dan penilaian mesin di sebelah kiri, lalu putuskan.</p>
                      <ul>
                        <li><b>Setujui</b> bila penilaiannya sudah tepat.</li>
                        <li><b>Koreksi</b> bila kategorinya keliru — dan sebutkan kelirunya.</li>
                        <li><b>Tidak valid</b> bila ini bukan berita, atau bukan urusan Pemasyarakatan.</li>
                      </ul>
                      <p class="ket">Pintasan papan tik: <kbd>S</kbd> setujui, <kbd>K</kbd> koreksi,
                      <kbd>X</kbd> tidak valid, <kbd>→</kbd> lewati.</p>
                    </div>`}
              </div>
            </div>`,
        })}

        <div class="telaah-aksi">
          ${keadaanTelaah.koreksi
            ? `${tombol({ label: 'Simpan koreksi', ikon: 'centang', gaya: 'utama', aksi: 'simpan-koreksi', nonaktif: keadaanTelaah.sibuk })}
               ${tombol({ label: 'Batal', aksi: 'batal-koreksi' })}`
            : `${tombol({ label: 'Setujui', ikon: 'centang', gaya: 'utama', aksi: 'setujui', nonaktif: keadaanTelaah.sibuk })}
               ${tombol({ label: 'Koreksi', ikon: 'saring', aksi: 'koreksi' })}
               ${tombol({ label: 'Tidak valid', ikon: 'tutup', gaya: 'bahaya', aksi: 'tolak' })}
               <span class="dorong"></span>
               ${tombol({ label: 'Lewati', ikon: 'panahKanan', gaya: 'samar', aksi: 'lewati' })}`}
        </div>

        ${(keadaanTelaah.disetujui || keadaanTelaah.dikoreksi || keadaanTelaah.ditolak) ? `
          <div class="telaah-rekap">
            ${keadaanTelaah.disetujui ? `<span>${keping(`${keadaanTelaah.disetujui} disetujui`, 'positif')}</span>` : ''}
            ${keadaanTelaah.dikoreksi ? `<span>${keping(`${keadaanTelaah.dikoreksi} dikoreksi`, 'sedang')}</span>` : ''}
            ${keadaanTelaah.ditolak ? `<span>${keping(`${keadaanTelaah.ditolak} tidak valid`, 'rendah')}</span>` : ''}
          </div>` : ''}
      </div>`
  }

  /* ---------------------------------------------------------- keputusan */

  function beritaSekarang() {
    const antrean = susunAntrean(semua)
    return antrean[Math.min(keadaanTelaah.nomor, Math.max(0, antrean.length - 1))]
  }

  /**
   * Menuliskan keputusan.
   *
   * Perubahan diterapkan lebih dulu pada salinan di peramban, lalu dikirim ke
   * peladen. Kalau peladen menolak, salinannya dikembalikan — antrean tidak
   * boleh menunjukkan sesuatu yang sebenarnya tidak tersimpan.
   */
  async function putuskan(b, isian, kabar) {
    if (keadaanTelaah.sibuk) return
    keadaanTelaah.sibuk = true
    const sebelum = { ...b }
    Object.assign(b, isian)
    keadaanTelaah.selesai.add(b.id)
    if (keadaanTelaah.fokus === b.id) keadaanTelaah.fokus = null
    keadaanTelaah.nomor = 0
    gambar()

    // Lencana menu dan angka dasbor dihitung ulang seketika. Sebelumnya
    // keduanya baru berubah pada pemuatan ulang berikutnya, sehingga analis
    // yang baru saja mengosongkan antrean tetap melihat lencana berisi puluhan.
    document.dispatchEvent(new CustomEvent('hitung-ulang'))

    if (keadaan.demo) {
      roti(`${kabar} (mode peragaan, tidak disimpan)`, 'sedang')
      keadaanTelaah.sibuk = false
      return
    }

    try {
      await perbarui('berita', { id: `eq.${b.id}` }, isian)
      roti(kabar, 'positif')
    } catch (galat) {
      Object.assign(b, sebelum)
      keadaanTelaah.selesai.delete(b.id)
      roti(pesanRamah(galat), 'kritis', 6000)
      gambar()
    } finally {
      keadaanTelaah.sibuk = false
    }
  }

  function setujui() {
    const b = beritaSekarang()
    if (!b) return
    keadaanTelaah.disetujui += 1
    putuskan(b, {
      status_verifikasi: 'Terverifikasi',
      ai_reviewed_by: keadaan.profil?.username || keadaan.profil?.full_name || null,
      ai_reviewed_at: new Date().toISOString(),
      verified_by: keadaan.profil?.username || keadaan.profil?.full_name || null,
      verified_at: new Date().toISOString(),
    }, 'Penilaian mesin disetujui.')
  }

  async function simpanKoreksi() {
    const b = beritaSekarang()
    if (!b) return
    const kode = isi.querySelector('#koreksi-sub')?.value
    const sub = SEMUA_SUBKATEGORI.find((s) => s.kode === kode)
    const catatan = isi.querySelector('#koreksi-catatan')?.value.trim() || ''
    const emberDipilih = isi.querySelector('input[name="koreksi-sentimen"]:checked')?.value || ember(b)

    if (!catatan) {
      roti('Sebutkan apa yang keliru. Koreksi tanpa alasan tidak bisa dipakai memperbaiki mesin.', 'sedang', 5000)
      isi.querySelector('#koreksi-catatan')?.focus()
      return
    }

    const luar = kode === '9.1' || kode === '9.2'
    keadaanTelaah.dikoreksi += 1
    keadaanTelaah.koreksi = false

    await putuskan(b, {
      subkategori_kode: kode,
      subkategori: sub ? sub.nama : (kode === '0.1' ? 'Belum Dikelompokkan' : 'Konten Tidak Relevan'),
      kategori: sub ? sub.kategoriNama : (luar ? 'Di Luar Lingkup' : 'Lainnya'),
      // Nilai yang ditulis ditentukan lib/sentimen.js, bukan di sini: memilih
      // "Netral/Campuran" pada berita yang memang dinilai mesin sebagai
      // Campuran tidak menghapus nilai itu.
      sentimen: nilaiSimpan(emberDipilih, b.sentimen),
      urgensi: isi.querySelector('#koreksi-urgensi')?.value,
      status_verifikasi: 'Terverifikasi',
      review_note: catatan,
      ai_reviewed_by: keadaan.profil?.username || keadaan.profil?.full_name || null,
      ai_reviewed_at: new Date().toISOString(),
      verified_by: keadaan.profil?.username || keadaan.profil?.full_name || null,
      verified_at: new Date().toISOString(),
    }, 'Koreksi tersimpan.')
  }

  async function tolak() {
    const b = beritaSekarang()
    if (!b) return
    const ya = await konfirmasi({
      judul: 'Tandai tidak valid?',
      pesan: `“${ringkas(b.judul, 80)}” tidak akan ikut dihitung dalam laporan mana pun. `
        + 'Datanya tetap tersimpan dan masih bisa dilihat di Pusat Data Berita.',
      tegas: 'Tandai tidak valid', bahaya: true,
    })
    if (!ya) return
    keadaanTelaah.ditolak += 1
    putuskan(b, {
      status_verifikasi: 'Tidak Valid',
      ai_reviewed_by: keadaan.profil?.username || keadaan.profil?.full_name || null,
      ai_reviewed_at: new Date().toISOString(),
    }, 'Ditandai tidak valid.')
  }

  function lewati() {
    const antrean = susunAntrean(semua)
    // Melewati berita yang barusan dibuka dari Peringatan Dini berarti
    // melepaskannya dari kepala antrean; kalau tidak, ia akan muncul lagi
    // sebagai nomor satu pada gambar berikutnya dan tidak bisa dilewati.
    if (keadaanTelaah.fokus && antrean[keadaanTelaah.nomor]?.id === keadaanTelaah.fokus) {
      keadaanTelaah.fokus = null
    }
    keadaanTelaah.nomor = (keadaanTelaah.nomor + 1) % Math.max(antrean.length, 1)
    keadaanTelaah.koreksi = false
    gambar()
  }

  /* ------------------------------------------------------------ penyimak */

  // Keterangan urgensi mengikuti pilihan, supaya definisinya terbaca pada saat
  // memutuskan — bukan sesudahnya.
  isi.addEventListener('change', (ev) => {
    if (ev.target.id !== 'koreksi-urgensi') return
    const ket = isi.querySelector('#ket-urgensi')
    if (ket) ket.textContent = KETERANGAN_URGENSI[ev.target.value] || ''
  })

  isi.addEventListener('click', (ev) => {
    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (!aksi) return
    if (aksi === 'setujui') setujui()
    else if (aksi === 'koreksi') { keadaanTelaah.koreksi = true; gambar(); isi.querySelector('#koreksi-sub')?.focus() }
    else if (aksi === 'batal-koreksi') { keadaanTelaah.koreksi = false; gambar() }
    else if (aksi === 'simpan-koreksi') simpanKoreksi()
    else if (aksi === 'tolak') tolak()
    else if (aksi === 'lewati') lewati()
  })

  /*
     Pintasan papan tik. Antrean yang panjang dikerjakan dengan satu tangan di
     papan tik, dan menuntut tetikus untuk setiap keputusan menjadikan seratus
     telaah sebagai seratus perjalanan kursor.

     Tidak berlaku saat sedang mengetik di kolom isian, supaya huruf "s" pada
     catatan koreksi tidak diam-diam menyetujui berita.
  */
  function pintasan(ev) {
    if (!isi.isConnected) { document.removeEventListener('keydown', pintasan); return }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return
    const t = ev.target
    if (t.matches('input, textarea, select')) return
    if (document.querySelector('.tirai, .palet-tirai')) return

    const k = ev.key.toLowerCase()
    if (k === 's') { ev.preventDefault(); setujui() }
    else if (k === 'k') { ev.preventDefault(); keadaanTelaah.koreksi = true; gambar(); isi.querySelector('#koreksi-sub')?.focus() }
    else if (k === 'x') { ev.preventDefault(); tolak() }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); lewati() }
  }
  document.addEventListener('keydown', pintasan)

  gambar()

  return {
    judul: 'Antrean Telaah',
    sub: 'Memeriksa penilaian mesin sebelum dipakai sebagai dasar keputusan',
  }
}
