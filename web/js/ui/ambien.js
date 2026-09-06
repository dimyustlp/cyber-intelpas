/**
 * Ambien — tiga hal kecil yang membuat layar terasa hidup, dan tidak lebih.
 *
 *   Sorot penunjuk  — kartu menyala di bawah kursor
 *   Ungkap saat gulir — isi jauh di bawah datang ketika benar-benar dilihat
 *   Pita muat       — garis di puncak layar selama modul halaman diunduh
 *
 * Latar yang bergerak TIDAK ada di sini. Ia hidup di index.html sebagai empat
 * div dan digerakkan seluruhnya oleh CSS; tidak ada satu baris JavaScript pun
 * yang terlibat. Itu disengaja: latar yang digambar JavaScript akan berhenti
 * bergerak setiap kali utas utama sibuk — persis pada saat halaman berat
 * sedang menyusun tabelnya, yaitu saat satu-satunya orang menatap layar tanpa
 * bisa berbuat apa-apa.
 *
 * Aturan yang dipegang berkas ini: apa pun yang gagal di sini harus berakhir
 * pada tampilan tanpa animasi, tidak pernah pada isi yang tidak terlihat.
 * Kelas `.ungkap` menyembunyikan isinya sampai ada yang mengungkapnya; kalau
 * pengungkapnya bisa gagal, kelas itu tidak boleh dipasang sama sekali.
 *
 * Modul ES murni, tanpa pustaka luar.
 */

/* ------------------------------------------------------------ sorot penunjuk */

let sorotTerpasang = false
let bingkaiSorot = 0

/**
 * Memasang sorot yang mengikuti penunjuk pada kartu dan ubin.
 *
 * Satu penyimak untuk seluruh dokumen, bukan satu per kartu. Halaman terpadat
 * di aplikasi ini memasang lebih dari empat puluh kartu, dan empat puluh
 * penyimak `pointermove` yang masing-masing menghitung letak kotaknya adalah
 * cara paling pasti membuat halaman yang sudah berat menjadi tersendat.
 *
 * Dipanggil sekali saja, dari main.js. Penyimaknya menempel di dokumen,
 * sehingga kartu yang dibuat halaman mana pun sesudahnya ikut terlayani tanpa
 * perlu didaftarkan.
 */
export function pasangSorot() {
  if (sorotTerpasang) return
  sorotTerpasang = true

  /*
     Layar sentuh dilewati seluruhnya.

     Di sana `pointermove` hanya tiba pada saat jari menyentuh, sehingga
     sorotnya akan menyala tepat di bawah jari yang menutupinya — tidak
     terlihat, dan tetap membayar ongkos hitungnya. Pemeriksaannya memakai
     kueri media yang sama dengan yang dipakai css/gerak.css, supaya keduanya
     tidak bisa berbeda pendapat.
  */
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return

  /*
     Gerak-dikurangi TIDAK diperiksa di sini, dan itu disengaja.

     Sorot penunjuk bukan gerak melainkan penunjuk sasaran — jawaban atas
     "yang mana yang akan saya kenai kalau saya menekan sekarang" — dan
     mematikannya justru mengambil bantuan dari orang yang sudah menyatakan
     kesulitan mengikuti gerak. Yang dipadamkan css/gerak.css pada mode itu
     hanya PERALIHANnya, sehingga sorotnya berpindah seketika alih-alih
     meluncur.

     Berkas ini juga sengaja tidak mengimpor apa pun dari lib/gerak.js:
     gerak.js yang mengimpor berkas ini, dan dua berkas yang saling mengimpor
     akan bekerja hari ini lalu gagal pada hari pertama salah satunya
     memindahkan satu baris ke atas.
  */

  let terakhir = null

  document.addEventListener('pointermove', (ev) => {
    /*
       Satu bingkai, satu hitungan. `pointermove` bisa tiba lebih dari seratus
       kali sedetik pada tetikus bermutu tinggi, sedangkan layar hanya digambar
       enam puluh kali — sisanya pekerjaan yang hasilnya dibuang sebelum
       sempat terlihat.
    */
    if (bingkaiSorot) return
    bingkaiSorot = requestAnimationFrame(() => {
      bingkaiSorot = 0

      const sasaran = ev.target instanceof Element
        ? ev.target.closest('.kartu, .ubin')
        : null

      if (sasaran !== terakhir) {
        terakhir?.removeAttribute('data-sorot')
        terakhir = sasaran
        sasaran?.setAttribute('data-sorot', '')
      }

      if (!sasaran) return

      /*
         `getBoundingClientRect` memaksa peramban menghitung tata letak, dan
         karena itu ia dipanggil hanya untuk satu elemen — yang sedang
         disentuh penunjuk — dan hanya sekali per bingkai. Menyimpan kotaknya
         tidak dilakukan: halaman ini bergulir, dan kotak yang disimpan akan
         salah pada gulir berikutnya dengan cara yang tidak meninggalkan galat
         apa pun, hanya sorot yang meleset dari kursor.
      */
      const kotak = sasaran.getBoundingClientRect()
      sasaran.style.setProperty('--sx', `${ev.clientX - kotak.left}px`)
      sasaran.style.setProperty('--sy', `${ev.clientY - kotak.top}px`)
    })
  }, { passive: true })

  // Penunjuk yang meninggalkan jendela tidak mengirim `pointermove` lagi, dan
  // sorotnya akan tertinggal menyala di kartu terakhir sampai kursor kembali.
  document.addEventListener('pointerleave', () => {
    terakhir?.removeAttribute('data-sorot')
    terakhir = null
  })
}

/* --------------------------------------------------------- ungkap saat gulir */

let pengamatUngkap = null

/**
 * Mengungkap isi yang berada di bawah layar ketika digulir sampai ke sana.
 *
 * Sebelum ini seluruh isi halaman datang sekaligus pada saat digambar,
 * termasuk yang berada dua layar di bawah dan belum dilihat siapa pun. Yang
 * hilang bukan hanya kesan bahwa halamannya menyusun diri saat dibaca:
 * dua puluh animasi berjalan berbarengan pada detik yang sama dengan detik
 * ketika halamannya sedang menyusun tabel.
 *
 * @param {Element[]} unsur elemen yang berada di luar layar pertama
 */
export function ungkapSaatGulir(unsur) {
  if (!unsur.length) return

  /*
     Kalau pengamatnya tidak bisa dibuat, isinya tampil apa adanya.

     Ini bukan kelonggaran melainkan syarat keselamatan. `.ungkap` membuat
     elemennya tembus pandang sampai ada yang memasang `.tampak`; kalau
     pemasangnya tidak pernah berjalan, halamannya tampak KOSONG tanpa satu pun
     galat di konsol yang menjelaskannya. Karena itu kelasnya baru dipasang
     sesudah pengamatnya terbukti ada.
  */
  if (typeof IntersectionObserver !== 'function') return

  pengamatUngkap?.disconnect()
  pengamatUngkap = new IntersectionObserver((catatan, pengamat) => {
    for (const c of catatan) {
      if (!c.isIntersecting) continue
      c.target.classList.add('tampak')
      // Sekali terungkap, selamanya terungkap. Isi yang menghilang lagi ketika
      // digulir ke bawah lalu kembali ke atas terbaca sebagai kerusakan.
      pengamat.unobserve(c.target)
    }
  }, {
    /*
       Diungkap sedikit SEBELUM benar-benar terlihat. Nol berarti animasinya
       baru mulai ketika tepi atas elemennya sudah menyentuh tepi bawah layar,
       dan pada gulir cepat orang akan melihat separuh gerakannya saja.
       Nilai negatifnya kecil supaya isinya tetap terbaca sebagai "muncul saat
       saya sampai ke sana", bukan "sudah muncul sejak tadi".
    */
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.01,
  })

  unsur.forEach((el, i) => {
    el.classList.add('ungkap')
    // Bertahap di dalam kelompoknya sendiri, bukan menurut nomor urut di
    // seluruh halaman: elemen ke-30 yang menunggu 30 × 60 md akan terlihat
    // seperti halaman yang macet.
    el.style.setProperty('--tunda', `${(i % 6) * 55}ms`)
    pengamatUngkap.observe(el)
  })
}

/** Melepas pengamat sebelum halaman diganti, supaya elemen lama tidak ditahan. */
export function lepasUngkap() {
  pengamatUngkap?.disconnect()
  pengamatUngkap = null
}

/* ------------------------------------------------------------------ pita muat */

let pita = null
let pitaJumlah = 0

/**
 * Menyalakan pita muat di puncak layar.
 *
 * Dihitung, bukan dinyalakan-dipadamkan. Dua unduhan yang bertumpang tindih —
 * petugas menekan menu kedua sementara yang pertama belum tiba — akan
 * memadamkan pitanya pada unduhan mana pun yang selesai lebih dulu, dan yang
 * kedua berjalan sisa waktunya tanpa satu pun tanda di layar.
 */
export function pitaMulai() {
  pitaJumlah += 1
  if (pita) return
  pita = document.createElement('div')
  pita.className = 'pita-muat'
  pita.setAttribute('aria-hidden', 'true')
  document.body.appendChild(pita)
}

/** Memadamkan pita muat, ketika unduhan terakhir yang berjalan sudah selesai. */
export function pitaSelesai() {
  pitaJumlah = Math.max(0, pitaJumlah - 1)
  if (pitaJumlah > 0) return
  pita?.remove()
  pita = null
}
