/**
 * Peringatan Dini.
 *
 * Halaman ini sengaja tidak berbentuk tabel. Yang dibaca pimpinan di sini bukan
 * kolom-kolom, melainkan satu per satu kejadian: apa yang terjadi, di mana, dan
 * apakah sudah dipastikan benar. Karena itu tiap berita ditampilkan sebagai
 * kartu dengan pita kerawanan di tepi kiri.
 *
 * Pembedaan penting: peringatan yang belum ditelaah analis diberi label AWAL,
 * yang sudah diverifikasi diberi label RESMI. Keduanya tidak boleh terlihat
 * sama, karena hanya yang kedua yang boleh menjadi dasar keputusan.
 */

import { kartu, keping, kosong, pilihan, tombol, pesanSistem } from '../ui/komponen.js'
import { amankan, angka, jarakWaktu, tanggalJam, ringkas, nadaUrgensi } from '../lib/format.js'
import { belumTerpetakan } from '../lib/unit-terpetakan.js'
import { ikon } from '../lib/ikon.js'
import { punyaIzin } from '../lib/peran.js'
import { periksaLaju, rekapLaju, ATURAN } from '../lib/peringatan-laju.js'

const saring = { tingkat: 'Semua tingkat', keadaan: 'Semua keadaan' }

export function halamanPeringatan({ keadaan, isi }) {
  const semua = (keadaan.dalamLingkup || keadaan.berita).filter(
    (b) => ['Tinggi', 'Kritis'].includes(b.urgensi)
      && !['Tidak Valid', 'Diarsipkan'].includes(b.status_verifikasi),
  )

  const daftar = semua.filter((b) => {
    if (!saring.tingkat.startsWith('Semua') && b.urgensi !== saring.tingkat) return false
    if (saring.keadaan === 'Peringatan awal' && b.status_verifikasi === 'Terverifikasi') return false
    if (saring.keadaan === 'Sudah diverifikasi' && b.status_verifikasi !== 'Terverifikasi') return false
    return true
  }).sort((a, b) => {
    const bobot = { Kritis: 2, Tinggi: 1 }
    return (bobot[b.urgensi] || 0) - (bobot[a.urgensi] || 0)
      || String(b.created_at).localeCompare(String(a.created_at))
  })

  const kritis = semua.filter((b) => b.urgensi === 'Kritis').length
  const awal = semua.filter((b) => b.status_verifikasi !== 'Terverifikasi').length

  // Pimpinan membaca halaman ini tetapi tidak menelaah. Menawarkan tombol yang
  // pasti ditolak basis data hanya memindahkan penolakan ke tempat yang lebih
  // membingungkan.
  const bolehTelaah = punyaIzin(keadaan.profil?.role, 'telaah_berita')
  const bolehKasus = punyaIzin(keadaan.profil?.role, 'kelola_kasus')

  /*
     Peringatan berbasis laju, dihitung dari arsip yang sama.

     Diletakkan DI ATAS daftar kartu, bukan di bawahnya. Yang di bawah adalah
     berita yang mesin sudah nilai berat satu per satu — analis akan menemukan
     mereka cepat atau lambat. Yang di atas adalah pola yang tidak akan pernah
     ditemukan siapa pun dengan membaca daftar: lonjakan, penyebaran, dan
     penumpukan pelan.
  */
  const laju = periksaLaju(keadaan.berita || [])
  const rekap = rekapLaju(laju)

  isi.innerHTML = `
    <div class="tumpuk">
      ${kritis
        ? pesanSistem(
            `<b>${kritis} kejadian berstatus kritis.</b> Menurut panduan Dirpamintel,
             tingkat ini berarti ancaman terhadap nyawa atau stabilitas yang menuntut respons segera,
             bukan pemantauan berkala.`, 'kritis', 'peringatan')
        : pesanSistem(
            `Tidak ada kejadian berstatus kritis. ${awal} peringatan masih berstatus awal dan menunggu telaah analis.`,
            'positif', 'centang')}

      ${kartu({
        judul: 'Pola yang terdeteksi',
        ket: laju.length
          ? `${rekap.total} pola aktif — ${rekap.kritis} kritis, ${rekap.tinggi} tinggi, ${rekap.sedang} sedang.`
          : 'Empat aturan dijalankan atas seluruh arsip yang termuat.',
        isi: laju.length
          ? `<div class="laju-daftar">${laju.slice(0, 12).map(kartuLaju).join('')}</div>
             ${pesanSistem(
               '<b>Pola ini tidak punya ingatan.</b> Ia dihitung ulang setiap kali halaman '
               + 'dibuka dan tidak menyimpan apakah seseorang sudah membacanya. Yang perlu '
               + 'ditindaklanjuti sebaiknya dijadikan kasus, supaya punya pemilik dan riwayat.',
               'netral', 'info')}`
          : kosong('Tidak ada pola yang terdeteksi',
              'Tidak ada lonjakan, penyebaran ke banyak sumber, peristiwa berat yang didiamkan, '
              + 'maupun penumpukan pelan di satu unit pada arsip yang termuat.'),
      })}

      ${kartu({
        rapat: true,
        isi: `
          <div class="bilah-alat">
            ${pilihan({ nama: 'tingkat', nilai: saring.tingkat, label: 'Saring tingkat kerawanan',
              opsi: ['Semua tingkat', 'Kritis', 'Tinggi'] })}
            ${pilihan({ nama: 'keadaan', nilai: saring.keadaan, label: 'Saring keadaan verifikasi',
              opsi: ['Semua keadaan', 'Peringatan awal', 'Sudah diverifikasi'] })}
            <div class="dorong baris gap-6">
              <span class="mini-teks samar-teks">${angka(daftar.length)} dari ${angka(semua.length)}</span>
              ${/* Tombol ini pernah bernama aksi `kirim-telegram` dan tidak
                    pernah disimak siapa pun — persis nasib tombol "Telaah" di
                    halaman yang sama, yang diperbaiki lebih dulu dan catatannya
                    ada di bawah. Dua kali cacat yang sama di satu berkas bukan
                    kebetulan: aksi yang penyimaknya ditulis di tempat lain
                    memang mudah tertinggal.

                    Sekarang ia menempuh jalur navigasi menu, yang tidak bisa
                    lupa disimak. Labelnya ikut berubah, sebab tombol ini tidak
                    mengirim apa pun sendiri — ia membuka tempat pengiriman
                    dilakukan, dan setiap kiriman di sana selalu didahului
                    pratinjau. Menamainya "Kirim" akan menjanjikan sesuatu yang
                    sengaja tidak dilakukan sekali tekan. */''}
              ${tombol({
                label: 'Buka Distribusi Telegram',
                ikon: 'kirim',
                kecil: true,
                gaya: 'utama',
                halaman: 'distribusi',
                judul: 'Menyusun dan mengirim peringatan dini ke grup pimpinan',
                nonaktif: !daftar.length,
              })}
            </div>
          </div>

          <div style="padding:14px">
            ${daftar.length
              ? `<div class="kisi kisi-kartu">
                   ${daftar.slice(0, 24).map((b) => kartuPeringatan(b, bolehTelaah, bolehKasus)).join('')}
                 </div>`
              : kosong('Tidak ada peringatan pada saringan ini',
                  'Ubah saringan tingkat atau keadaan verifikasi untuk melihat kejadian lain.')}
          </div>`,
      })}
    </div>`

  for (const s of isi.querySelectorAll('[data-saring]')) {
    s.addEventListener('change', (ev) => {
      saring[ev.target.dataset.saring] = ev.target.value
      isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))
    })
  }

  /*
     Tombol "Telaah" pada tiap kartu.

     Sebelumnya tombol ini digambar lengkap dengan penanda berita yang dituju,
     lalu tidak ada satu pun penyimak yang mendengarnya — ditekan, dan tidak
     terjadi apa-apa. Sekarang ia membawa penandanya ke Antrean Telaah lewat
     acara yang sama yang dipakai menu, sehingga berita yang barusan dibaca
     pimpinan langsung berada di kepala antrean, bukan tenggelam di nomor
     entah berapa.
  */
  isi.addEventListener('click', (ev) => {
    // Judul contoh pada kartu pola membuka catatan beritanya, bukan situs
    // medianya: yang sedang dibaca di sini adalah apa yang diketahui sistem.
    const buka = ev.target.closest('[data-buka]')?.dataset.buka
    if (buka) {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'berita-detail', fokus: buka },
      }))
      return
    }

    const tombolTelaah = ev.target.closest('[data-aksi="telaah"]')
    if (tombolTelaah) {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'telaah', fokus: tombolTelaah.dataset.id },
      }))
      return
    }

    /*
       Jalan dari berita ke perkara.

       Sebelum ini, satu-satunya pintu masuk siklus intelijen adalah halaman
       Kasus Intelijen — seorang analis yang baru membaca peringatan harus
       mengingat judulnya, berpindah halaman, lalu mencarinya lagi di antara
       empat puluh peristiwa yang ditawarkan. Yang menuntut mengingat sesuatu
       antar dua layar akan dikerjakan setengah, atau tidak sama sekali.
    */
    const tombolKasus = ev.target.closest('[data-aksi="jadikan-kasus"]')
    if (tombolKasus) {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'kasus', fokus: tombolKasus.dataset.id },
      }))
    }
  })

  return { judul: 'Peringatan Dini', sub: `${angka(semua.length)} kejadian dipantau · ${angka(awal)} masih berstatus awal` }
}

/**
 * Satu pola yang terdeteksi.
 *
 * Tiga hal wajib ada di setiap kartu, dan ketiganya menjawab pertanyaan yang
 * pasti muncul: apa yang terjadi (judul), kenapa ini muncul (sebab, lengkap
 * dengan angkanya), dan aturan mana yang menyalakannya (nama aturan). Sebuah
 * peringatan yang hanya menyebutkan yang pertama akan dicurigai, lalu
 * diabaikan.
 */
function kartuLaju(a) {
  const aturan = ATURAN[a.kode] || {}
  const contoh = (a.berita || []).slice(0, 3)

  return `
    <article class="laju-kartu" data-nada="${nadaUrgensi(a.tingkat)}">
      <div class="laju-kop">
        ${keping(a.tingkat, nadaUrgensi(a.tingkat))}
        <span class="laju-aturan" title="${amankan(aturan.ket || '')}">${amankan(aturan.nama || a.kode)}</span>
        <span class="mini-teks samar-teks dorong">${amankan(jarakWaktu(new Date(a.waktu).toISOString()))}</span>
      </div>

      <h3 class="laju-judul">${amankan(ringkas(a.judul, 120))}</h3>
      <p class="laju-sebab">${amankan(a.sebab)}</p>

      ${contoh.length ? `
        <ul class="laju-contoh">
          ${contoh.map((b) => `
            <li><button data-buka="${amankan(b.id)}"
              title="Buka detail berita ini">${amankan(ringkas(b.judul || 'Tanpa judul', 88))}</button></li>`).join('')}
          ${a.berita.length > contoh.length
            ? `<li class="samar-teks">dan ${angka(a.berita.length - contoh.length)} terbitan lain</li>` : ''}
        </ul>` : ''}
    </article>`
}

function kartuPeringatan(b, bolehTelaah, bolehKasus) {
  const resmi = b.status_verifikasi === 'Terverifikasi'
  const nada = nadaUrgensi(b.urgensi)

  return `
    <article class="kartu" style="border-left:3px solid var(--${nada})">
      <div class="kartu-isi" style="display:flex;flex-direction:column;gap:9px">
        <div class="baris gap-6">
          ${keping(b.urgensi, nada)}
          ${resmi
            ? `<span class="keping polos" data-nada="positif">Resmi</span>`
            : `<span class="keping polos" data-nada="sedang">Awal</span>`}
          <span class="mini-teks samar-teks dorong" title="${amankan(tanggalJam(b.created_at))}">
            ${amankan(jarakWaktu(b.created_at))}</span>
        </div>

        <h3 style="font-size:13.5px;line-height:1.4;font-family:var(--sans);font-weight:600">
          ${amankan(b.judul || 'Tanpa judul')}
        </h3>

        <p class="kecil-teks samar-teks" style="line-height:1.5">
          ${amankan(ringkas(b.ringkasan || b.rekomendasi || 'Belum ada ringkasan.', 180))}
        </p>

        <dl style="margin:0;display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:11.5px">
          <dt class="samar-teks">UPT</dt>
          <dd style="margin:0">${belumTerpetakan(b.nama_upt)
            ? '<span style="color:var(--sedang)">Belum terpetakan</span>'
            : amankan(b.nama_upt)}</dd>
          <dt class="samar-teks">Isu</dt>
          <dd style="margin:0">${amankan(b.subkategori || b.kategori || 'Belum dikelompokkan')}</dd>
          <dt class="samar-teks">Sumber</dt>
          <dd style="margin:0">${amankan(b.media || '—')}</dd>
        </dl>

        <div class="baris gap-6" style="margin-top:2px">
          ${b.link ? `<a class="tbl kecil" href="${amankan(b.link)}" target="_blank" rel="noopener noreferrer">
            ${ikon('tautan')} Sumber asli</a>` : ''}
          ${!resmi && bolehTelaah ? `<button class="tbl kecil utama" data-aksi="telaah" data-id="${amankan(b.id)}">
            ${ikon('centang')} Telaah</button>` : ''}
          ${bolehKasus ? `<button class="tbl kecil" data-aksi="jadikan-kasus" data-id="${amankan(b.id)}"
            title="Buka Kasus Intelijen dengan peristiwa ini terpilih">
            ${ikon('kasus')} Jadikan kasus</button>` : ''}
        </div>
      </div>
    </article>`
}
