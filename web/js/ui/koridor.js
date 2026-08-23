/**
 * Koridor — dinding kartu yang melaju ke arah penonton.
 *
 * Dipakai di panel kiri halaman Masuk, menggantikan latar polos. Idenya
 * dipinjam dari pola "image stream hero" yang umum dipakai halaman muka
 * produk: dua jalur kartu berjalan dari titik hilang di kejauhan menuju
 * penonton, membesar seiring mendekat.
 *
 * Tiga penyesuaian dari pola aslinya, dan alasannya:
 *
 *   Tidak ada foto. Pola aslinya menarik gambar dari CDN pihak ketiga.
 *   Aplikasi ini sengaja tidak menarik kode maupun aset dari peladen luar —
 *   satu-satunya kekecualian adalah huruf Google Fonts, dan itu pun punya
 *   cadangan huruf sistem. Foto sungguhan fasilitas Pemasyarakatan juga tidak
 *   pantas dipakai sebagai hiasan; yang ditampilkan di sini adalah kartu
 *   bermotif kelembagaan — ikon modul sistem di atas gradien warna dinas —
 *   bukan potret tempat sungguhan.
 *
 *   Tidak ada React. Logikanya sama persis — geometri proyeksi dihitung
 *   sekali untuk membentuk gelagat CSS @keyframes, lalu dipasang sebagai satu
 *   elemen <style>. Tidak ada state, tidak ada re-render; setelah terpasang,
 *   geraknya seluruhnya milik CSS.
 *
 *   Isinya bermakna. Setiap kartu memuat satu ikon dan satu label modul
 *   sistem — Deteksi Media, Peringatan Dini, Verifikasi Lapangan, dan
 *   seterusnya. Halaman masuk adalah tempat pertama yang dilihat siapa pun
 *   sebelum tahu sistem ini isinya apa; dinding kartu ini menjawabnya sambil
 *   bergerak, bukan sekadar hiasan yang kebetulan indah.
 *
 * Matematika proyeksinya dipertahankan apa adanya dari sumbernya, sebab
 * itulah bagian yang sudah teruji: skala diaturkan geometris supaya rasio
 * ukuran antar-kartu tetap konstan sepanjang jalan (yang membuat sela antar
 * kartu tidak pernah merenggang saat mendekat), jalurnya membuka cepat di
 * awal lalu bertahan (`fan` > 1, menahan pita tetap rapat di tengah sebelum
 * membelah ke diagonal), dan kartu lahir di seberang sumbu (`railBirth`
 * negatif) supaya sumbu tengah tidak pernah kosong barang sesaat.
 */

/** @typedef {{ikon:string, label:string}} KartuKoridor */

const GEOMETRI = {
  perspective: 30,
  cardWidth: 15,
  cardHeight: 19,
  cardRadius: 1.1,
  birthHeight: 2.6,
  exitHeight: 42,
  railBirth: -11,
  railExit: 46,
  fan: 3.3,
  turnBirth: 6,
  turnExit: 26,
  stops: 24,
}

let penghitung = 0

/** Menjejak kurva sekali, menghasilkan teks @keyframes untuk satu jalur. */
function keyframes(arah, nama, p) {
  const baris = []
  for (let s = 0; s <= p.stops; s++) {
    const u = s / p.stops
    const skala = (p.birthHeight / p.cardHeight) * Math.pow(p.exitHeight / p.birthHeight, u)
    const z = p.perspective * (1 - 1 / skala)
    const rel = p.railExit - (p.railExit - p.railBirth) * Math.pow(1 - u, p.fan)
    const putar = p.turnBirth + (p.turnExit - p.turnBirth) * u
    baris.push(
      `${(u * 100).toFixed(2)}%{transform:translate3d(${(arah * rel).toFixed(2)}cqw,0,${z.toFixed(2)}cqw) `
      + `rotateY(${(-arah * putar).toFixed(2)}deg)}`,
    )
  }
  return `@keyframes ${nama}{${baris.join('')}}`
}

/**
 * Memasang koridor ke dalam sebuah elemen wadah.
 *
 * @param {HTMLElement} wadah
 * @param {object} opsi
 * @param {(nama:string)=>string} opsi.ikon fungsi pengambil markah SVG dari lib/ikon.js
 * @param {KartuKoridor[]} opsi.kartu
 * @param {number} [opsi.jumlahPerJalur]
 * @param {number} [opsi.kecepatan] detik untuk satu kartu menempuh seluruh koridor
 * @param {number} [opsi.sumbu] posisi tegak sumbu koridor, persen tinggi wadah
 */
export function pasangKoridor(wadah, { ikon, kartu, jumlahPerJalur = 8, kecepatan = 22, sumbu = 52 }) {
  if (!wadah || !kartu?.length) return

  penghitung += 1
  const id = `kdr${penghitung}`
  const kanan = `${id}-k`
  const kiri = `${id}-l`
  const kelasKartu = `${id}-kartu`

  const gaya = document.createElement('style')
  gaya.textContent = keyframes(1, kanan, GEOMETRI) + keyframes(-1, kiri, GEOMETRI)
    // Gerak dijeda, bukan dimatikan. Setiap kartu sudah diberi delay negatif
    // sehingga sedang di tengah perjalanan; menjeda membekukannya sebagai
    // gambar utuh, sedangkan mematikan animasi sama sekali akan
    // mengumpulkan semua kartu kembali ke titik nol di sumbu tengah.
    + `@media(prefers-reduced-motion:reduce){.${kelasKartu}{animation-play-state:paused}}`
  wadah.appendChild(gaya)

  const panggung = document.createElement('div')
  panggung.className = 'koridor-panggung'
  panggung.setAttribute('aria-hidden', 'true')
  panggung.style.perspective = `${GEOMETRI.perspective}cqw`
  panggung.style.perspectiveOrigin = `50% ${sumbu}%`
  wadah.appendChild(panggung)

  const lapis = document.createElement('div')
  lapis.className = 'koridor-lapis'
  panggung.appendChild(lapis)

  for (const nama of [kanan, kiri]) {
    for (let i = 0; i < jumlahPerJalur; i++) {
      const isi = kartu[i % kartu.length]
      const kartuEl = document.createElement('div')
      kartuEl.className = `koridor-kartu ${kelasKartu}`
      kartuEl.style.cssText = [
        'left:50%', `top:${sumbu}%`,
        `width:${GEOMETRI.cardWidth}cqw`, `height:${GEOMETRI.cardHeight}cqw`,
        `margin-left:${-GEOMETRI.cardWidth / 2}cqw`, `margin-top:${-GEOMETRI.cardHeight / 2}cqw`,
        `border-radius:${GEOMETRI.cardRadius}cqw`,
        `animation:${nama} ${kecepatan}s linear infinite`,
        `animation-delay:${-(i * kecepatan) / jumlahPerJalur}s`,
      ].join(';')
      kartuEl.innerHTML = `<span class="koridor-ikon">${ikon(isi.ikon)}</span>
        <span class="koridor-label">${isi.label}</span>`
      lapis.appendChild(kartuEl)
    }
  }
}
