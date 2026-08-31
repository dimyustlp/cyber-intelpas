/**
 * Lapisan gerak Cyber-Intelpas.
 *
 * Aturan yang dipegang berkas ini: gerak dipakai untuk menjelaskan, bukan untuk
 * menghibur. Setiap animasi di sini menjawab satu pertanyaan yang memang dimiliki
 * orang yang sedang memakai aplikasi.
 *
 *   Kartu masuk berurutan     — "mana yang paling penting?" Yang muncul lebih
 *                               dulu adalah yang diletakkan lebih dulu.
 *   Angka berhitung naik      — "angkanya berubah atau saya salah lihat?"
 *   Bagan menggambar diri     — "ini data baru atau sisa tampilan tadi?"
 *   Kilau sorot pada nilai    — "apa yang berubah sejak saya terakhir melihat?"
 *   Peralihan halaman menyatu — "saya masih di aplikasi yang sama, kan?"
 *
 * Semua padam ketika perangkat meminta gerak dikurangi. Itu bukan tambahan
 * kesopanan; bagi sebagian orang gerak yang berlebihan menimbulkan pusing dan
 * mual, dan aplikasi dinas dipakai berjam-jam setiap hari.
 *
 * Modul ES murni, tanpa pustaka luar.
 */

const kurangiGerak = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Nilai terakhir tiap angka, supaya perubahan bisa dikenali antar gambar ulang. */
const nilaiTerakhir = new Map()

/* ------------------------------------------------------------ angka naik */

function uraikanAngka(teks) {
  // Format Indonesia: titik pemisah ribuan, koma pemisah desimal.
  const bersih = String(teks).replace(/\./g, '').replace(',', '.')
  const cocok = bersih.match(/-?\d+(\.\d+)?/)
  return cocok ? Number(cocok[0]) : null
}

function bentukUlang(contoh, nilai) {
  // Mengembalikan angka ke bentuk aslinya, termasuk imbuhan seperti "%" atau
  // satuan yang menempel di belakangnya.
  const teks = String(contoh)
  const cocok = teks.match(/-?[\d.,]+/)
  if (!cocok) return teks
  const bulat = Math.round(nilai)
  const berkoma = cocok[0].includes(',')
  const angka = berkoma
    ? nilai.toFixed(1).replace('.', ',')
    : String(bulat).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return teks.slice(0, cocok.index) + angka + teks.slice(cocok.index + cocok[0].length)
}

/**
 * Menghitung satu angka naik dari nol, atau dari nilai sebelumnya bila elemen
 * yang sama pernah tampil. Berhitung dari nilai lama jauh lebih berguna: mata
 * langsung menangkap arah perubahannya.
 */
function angkaNaik(el, kunci) {
  const tujuanTeks = el.textContent.trim()
  const tujuan = uraikanAngka(tujuanTeks)
  if (tujuan === null || !Number.isFinite(tujuan)) return

  const awal = nilaiTerakhir.has(kunci) ? nilaiTerakhir.get(kunci) : 0
  nilaiTerakhir.set(kunci, tujuan)

  if (awal === tujuan) return
  if (kurangiGerak()) return

  // Perubahan sejak tampilan terakhir diberi sorotan sekejap, supaya pembaca
  // tahu angka mana yang bergerak tanpa harus membandingkan sendiri.
  if (nilaiTerakhir.size && awal !== 0) el.classList.add('sorot-ubah')

  const jarak = Math.abs(tujuan - awal)
  const durasi = Math.min(900, Math.max(320, jarak * 12))
  const mulai = performance.now()

  // Penjaga. Kalau bingkai gambar berhenti diberikan — tab pindah ke latar,
  // peramban menghemat daya — angkanya akan membeku di tengah hitungan. Pada
  // dasbor intelijen, angka yang salah lebih buruk daripada angka yang tidak
  // beranimasi sama sekali, jadi nilai akhirnya dipasang paksa kalau tenggatnya
  // lewat.
  let selesai = false
  const jaga = setTimeout(() => {
    if (selesai) return
    el.textContent = tujuanTeks
    el.classList.remove('sorot-ubah')
  }, durasi + 500)

  const langkah = (waktu) => {
    const maju = Math.min(1, (waktu - mulai) / durasi)
    // Perlambatan di ujung: angka berhenti dengan tenang, bukan direm mendadak.
    const halus = 1 - Math.pow(1 - maju, 3)
    el.textContent = bentukUlang(tujuanTeks, awal + (tujuan - awal) * halus)
    if (maju < 1) { requestAnimationFrame(langkah); return }
    selesai = true
    clearTimeout(jaga)
    el.textContent = tujuanTeks
    setTimeout(() => el.classList.remove('sorot-ubah'), 900)
  }

  el.textContent = bentukUlang(tujuanTeks, awal)
  requestAnimationFrame(langkah)
}

/* ---------------------------------------------------------- masuk bertahap */

/**
 * Memberi tundaan berjenjang kepada sekumpulan elemen.
 * Jenjangnya dibatasi supaya kartu terakhir tidak terasa lamban ditunggu.
 */
function bertahap(daftar, langkah = 45, maksimum = 320) {
  daftar.forEach((el, i) => {
    el.style.setProperty('--tunda', `${Math.min(i * langkah, maksimum)}ms`)
    el.classList.add('gerak-masuk')
    el.addEventListener('animationend', () => el.classList.remove('gerak-masuk'), { once: true })
  })
}

/**
 * Jaring pengaman.
 *
 * Kelas masuk menyembunyikan elemennya sampai animasinya berjalan. Kalau karena
 * satu dan lain hal animasi itu tidak pernah berjalan — peramban tanpa
 * kompositor, tab yang berpindah ke latar tepat saat halaman digambar,
 * pengaturan yang mematikan animasi di tengah jalan — elemennya akan tertinggal
 * tak terlihat. Isi halaman tidak boleh bergantung pada animasi yang berhasil.
 *
 * Karena itu semua kelas masuk dicabut paksa setelah tenggat yang pasti lebih
 * panjang daripada animasi terlama. Yang sudah selesai tidak terpengaruh; yang
 * tidak pernah jalan langsung tampil.
 */
function bukaPaksa(akar, tenggat = 1500) {
  setTimeout(() => {
    akar.querySelectorAll('.gerak-masuk').forEach((el) => el.classList.remove('gerak-masuk'))
    akar.querySelectorAll('.gerak-bidang, .gerak-titik, .gerak-busur, .gerak-pita')
      .forEach((el) => el.classList.remove('gerak-bidang', 'gerak-titik', 'gerak-busur', 'gerak-pita'))
    akar.querySelectorAll('svg.bagan path.garis').forEach((el) => {
      el.style.strokeDashoffset = ''
    })
    akar.querySelectorAll('.bar-isi').forEach((el) => {
      const lebar = el.style.getPropertyValue('--lebar')
      if (lebar) el.style.width = lebar
    })
  }, tenggat)
}

/* ------------------------------------------------------------ bagan hidup */

function hidupkanBagan(akar) {
  // Garis tren digambar dari kiri ke kanan memakai panjang jalurnya sendiri.
  for (const garis of akar.querySelectorAll('svg.bagan path.garis')) {
    let panjang = 0
    try { panjang = garis.getTotalLength() } catch { panjang = 0 }
    if (!panjang) continue
    const putus = garis.getAttribute('stroke-dasharray')
    garis.style.strokeDasharray = String(panjang)
    garis.style.strokeDashoffset = String(panjang)
    garis.getBoundingClientRect() // memaksa perhitungan ulang sebelum transisi
    garis.style.transition = 'stroke-dashoffset 720ms cubic-bezier(0.22, 1, 0.36, 1)'
    garis.style.strokeDashoffset = '0'
    // Garis putus-putus dikembalikan setelah selesai menggambar, supaya
    // pembedaan antara garis total dan garis negatif tidak hilang.
    if (putus) {
      setTimeout(() => {
        garis.style.transition = ''
        garis.style.strokeDasharray = putus
        garis.style.strokeDashoffset = ''
      }, 760)
    }
  }

  for (const bidang of akar.querySelectorAll('svg.bagan path.isi-area')) {
    bidang.classList.add('gerak-bidang')
  }

  akar.querySelectorAll('svg.bagan circle.titik-akhir').forEach((titik, i) => {
    titik.style.setProperty('--tunda', `${620 + i * 90}ms`)
    titik.classList.add('gerak-titik')
  })

  akar.querySelectorAll('svg.bagan path.busur').forEach((busur, i) => {
    busur.style.setProperty('--tunda', `${i * 90}ms`)
    busur.classList.add('gerak-busur')
  })

  for (const isi of akar.querySelectorAll('.bar-isi')) {
    const lebar = isi.style.getPropertyValue('--lebar')
    isi.style.width = '0%'
    isi.getBoundingClientRect()
    isi.style.transition = 'width 620ms cubic-bezier(0.22, 1, 0.36, 1)'
    isi.style.width = lebar
  }

  akar.querySelectorAll('.pita-potong').forEach((potong, i) => {
    potong.style.setProperty('--tunda', `${i * 70}ms`)
    potong.classList.add('gerak-pita')
  })
}

/* ------------------------------------------------------------ pintu utama */

/**
 * Menghidupkan seluruh isi sebuah wadah setelah HTML-nya terpasang.
 * Dipanggil sekali tiap gambar ulang; aman dipanggil berkali-kali.
 *
 * @param {HTMLElement} akar wadah yang baru saja digambar
 * @param {object} [opsi]
 * @param {string} [opsi.ruang] penanda halaman, dipakai sebagai kunci angka
 */
export function hidupkan(akar, opsi = {}) {
  if (!akar) return
  const ruang = opsi.ruang || 'umum'

  if (kurangiGerak()) {
    // Gerak dimatikan, tetapi angka tetap dicatat supaya perbandingan pada
    // gambar ulang berikutnya tidak melompat dari nol.
    akar.querySelectorAll('.ubin-nilai').forEach((el, i) => {
      const nilai = uraikanAngka(el.textContent.trim())
      if (nilai !== null) nilaiTerakhir.set(`${ruang}:${i}`, nilai)
    })
    return
  }

  bertahap([...akar.querySelectorAll(':scope > .baris-ubin > .ubin, :scope > .ubin')], 40, 240)
  bertahap([...akar.querySelectorAll('.kartu')], 55, 330)

  akar.querySelectorAll('.ubin-nilai').forEach((el, i) => angkaNaik(el, `${ruang}:${i}`))

  // Bagan digambar oleh halaman sesudah HTML terpasang, jadi penghidupannya
  // ditunda satu bingkai supaya simpul SVG-nya sudah benar-benar ada.
  requestAnimationFrame(() => requestAnimationFrame(() => hidupkanBagan(akar)))

  const baris = [...akar.querySelectorAll('table.tabel tbody tr')].slice(0, 14)
  bertahap(baris, 22, 260)

  bukaPaksa(akar)
}

/**
 * Membungkus penggambaran ulang dengan peralihan halus bila peramban
 * mendukungnya. Tanpa dukungan, fungsinya dijalankan apa adanya — tidak ada
 * yang rusak, hanya tidak ada peralihan.
 */
export function denganPeralihan(kerjakan) {
  if (kurangiGerak() || !document.startViewTransition) { kerjakan(); return }
  try {
    const peralihan = document.startViewTransition(() => kerjakan())
    /*
       Peralihan yang dipotong peralihan berikutnya menolak janjinya dengan
       InvalidStateError. Itu keadaan yang wajar — orang menekan dua butir menu
       beruntun — tetapi janji yang ditolak tanpa penampung berakhir sebagai
       galat merah di konsol, dan galat yang selalu muncul membuat galat yang
       sungguhan tidak lagi terbaca. Halamannya sendiri sudah tergambar.
    */
    peralihan?.finished?.catch(() => {})
    peralihan?.updateCallbackDone?.catch(() => {})
    peralihan?.ready?.catch(() => {})
  } catch {
    kerjakan()
  }
}

/** Menyorot sebuah elemen sekejap, misalnya baris yang baru saja berubah. */
export function sorot(el) {
  if (!el || kurangiGerak()) return
  el.classList.remove('sorot-ubah')
  void el.offsetWidth
  el.classList.add('sorot-ubah')
  setTimeout(() => el.classList.remove('sorot-ubah'), 1100)
}

/** Melupakan nilai tersimpan, dipakai ketika berpindah pengguna atau keluar. */
export function lupakanNilai() {
  nilaiTerakhir.clear()
}

export const META_GERAK = { versi: 'gerak-v1.0' }
