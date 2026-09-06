/**
 * Layar nyala — yang dilihat orang selama aplikasinya belum ada.
 *
 * Markahnya TIDAK di sini. Ia ditulis langsung di index.html supaya tergambar
 * pada cat pertama, sebelum modul mana pun diunduh; berkas ini hanya
 * menggerakkannya. Kalau berkas ini sendiri gagal diunduh, layar nyala tetap
 * tampil dan tetap memadamkan dirinya sesudah lima belas detik lewat CSS —
 * lihat `.nyala` di css/gerak.css.
 *
 * Yang membedakannya dari bilah pemuat yang biasa: relnya maju pada langkah
 * yang BENAR-BENAR selesai, bukan menurut jam. Bilah palsu yang penuh dalam
 * dua detik lalu menggantung di 100% sementara layarnya masih kosong bukan
 * hanya tidak menolong — ia membuat orang berhenti mempercayai bilah mana pun
 * sesudahnya, termasuk yang jujur.
 *
 * Modul ES murni, tanpa pustaka luar.
 */

/**
 * Langkah pemuatan yang sungguhan, beserta sejauh mana relnya sudah maju.
 *
 * Angkanya bukan bagi rata. `arsip` mendapat lompatan terbesar karena memang
 * langkah terlama — menarik seluruh berita yang menjadi hak pengguna bisa
 * memakan beberapa detik di jaringan kantor, sedangkan memeriksa sesi hampir
 * selalu selesai seketika. Rel yang membagi rata akan terlihat macet di satu
 * tempat dan melesat di tempat lain.
 */
const LANGKAH = {
  nyala:  { laju: 6,   teks: 'Menyalakan sistem' },
  sesi:   { laju: 20,  teks: 'Memeriksa sesi petugas' },
  arsip:  { laju: 74,  teks: 'Menarik arsip pemberitaan' },
  layar:  { laju: 92,  teks: 'Menyusun layar' },
  selesai:{ laju: 100, teks: 'Siap' },
}

let kotak = null
let rel = null
let keadaan = null
let sudahDicari = false

function cari() {
  if (sudahDicari) return
  sudahDicari = true
  kotak = document.getElementById('nyala')
  rel = document.getElementById('nyala-laju')
  keadaan = document.getElementById('nyala-keadaan')
}

/**
 * Memajukan layar nyala ke satu langkah bernama.
 *
 * Aman dipanggil kapan pun, termasuk sesudah layarnya padam: seluruh
 * pemanggilan sesudah `padamkanNyala()` tidak melakukan apa-apa. Itu bukan
 * kelonggaran, melainkan syarat — `mulaiSesi()` bisa berjalan dua kali dalam
 * satu kunjungan (masuk, lalu ganti pengguna), dan yang kedua tidak boleh
 * menghidupkan kembali layar yang sudah tidak ada.
 *
 * @param {keyof LANGKAH} nama
 */
export function langkahNyala(nama) {
  cari()
  if (!kotak || kotak.classList.contains('padam')) return

  const langkah = LANGKAH[nama]
  if (!langkah) return

  if (rel) rel.style.setProperty('--laju', `${langkah.laju}%`)

  if (keadaan && keadaan.textContent !== langkah.teks) {
    keadaan.textContent = langkah.teks
    /*
       Animasi dipasang ulang dengan cara yang berputar-putar ini karena
       memang harus. Menambahkan kelas yang sudah ada tidak memulai ulang
       animasi apa pun; membaca `offsetWidth` di antaranya memaksa peramban
       menghitung tata letak, dan itulah yang menutup satu daur animasi
       sehingga daur berikutnya benar-benar dimulai dari nol.
    */
    keadaan.classList.remove('ganti')
    void keadaan.offsetWidth
    keadaan.classList.add('ganti')
  }
}

/**
 * Memadamkan layar nyala, sesudah layar pertama benar-benar berdiri.
 *
 * Dua bingkai ditunggu sebelum peleburan dimulai, dan keduanya diperlukan:
 * yang pertama menutup penggambaran isi yang barusan dipasang, yang kedua
 * menutup tata letak yang dihitung darinya. Melebur pada bingkai yang sama
 * akan memperlihatkan satu kedipan halaman yang belum selesai disusun — persis
 * hal yang layar ini ada untuk menutupinya. Penjaga waktu di belakangnya
 * mengambil alih bila bingkainya tidak pernah datang; alasannya di badan
 * fungsi.
 *
 * Elemennya dibuang dari dokumen sesudah peleburan, bukan sekadar
 * disembunyikan. Ia berisi animasi yang berjalan tanpa henti (busur berputar,
 * kilau menyapu), dan animasi yang tidak terlihat tetap dihitung peramban
 * selama elemennya masih ada — beban yang percuma sepanjang sisa hari kerja.
 */
export function padamkanNyala() {
  cari()
  if (!kotak || kotak.classList.contains('padam')) return

  langkahNyala('selesai')

  /*
     Dua bingkai, ATAU seperempat detik — mana pun yang lebih dahulu.

     Menunggu bingkai saja benar pada tab yang sedang dilihat orang, dan
     salah pada tab yang dibuka di latar belakang: di sana peramban berhenti
     memberikan bingkai sama sekali, sehingga `requestAnimationFrame` tidak
     pernah dipanggil dan layar nyala tidak pernah dipadamkan. Aplikasi ini
     memang dibuka begitu — satu tab di antara banyak tab pagi hari — dan
     yang kembali ke tab itu akan mendapati layar nyala masih berdiri di
     atas aplikasi yang sebenarnya sudah lama siap.

     Ditemukan saat pengujian di peramban yang panelnya sedang tertutup, dan
     tidak akan pernah ditemukan dengan membaca kodenya: keduanya benar
     secara logika, dan yang membedakan hanya apakah ada yang melihat.
  */
  let sudah = false
  const lebur = () => {
    if (sudah) return
    sudah = true
    kotak.classList.add('padam')
    /*
       Dibuang lewat penanda selesainya animasi, dengan penjaga waktu di
       belakangnya. Peristiwa `animationend` tidak pernah tiba kalau elemennya
       tersembunyi saat animasinya mulai — tab yang sedang di latar belakang,
       misalnya — dan tanpa penjaga itu layar nyala akan menetap di atas
       aplikasi sampai halaman dimuat ulang.
    */
    const buang = () => kotak?.remove()
    kotak.addEventListener('animationend', buang, { once: true })
    setTimeout(buang, 1200)
  }

  requestAnimationFrame(() => requestAnimationFrame(lebur))
  setTimeout(lebur, 250)
}
