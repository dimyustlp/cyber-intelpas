/**
 * Input Berita — memasukkan publikasi yang tidak tertangkap perayap.
 *
 * Sampai halaman ini ada, seluruh berita hanya bisa masuk lewat penyalinan
 * spreadsheet. Kemampuan menulisnya sudah ada di lapisan data dan policy RLS
 * sudah menerima sejak migrasi kedua; yang tidak pernah ada hanyalah pintunya.
 * Akibatnya isu viral yang belum terbaca perayap — dan itu justru yang paling
 * cepat berkembang — tidak punya jalan masuk sama sekali.
 *
 * Dua keputusan bentuk yang menentukan isi berkas ini:
 *
 *   Mesin klasifikasi dijalankan di peramban sambil petugas mengetik, bukan
 *   sesudah menyimpan. Petugas melihat kategori, sentimen, dan urgensi yang
 *   akan tercatat sebelum ia menekan Simpan, dan bisa membetulkannya saat itu
 *   juga. Penilaian yang baru terlihat sesudah tersimpan hanya menambah satu
 *   pekerjaan lagi bagi antrean telaah.
 *
 *   Hasilnya tetap berstatus "Belum Ditelaah". Masukan manual tidak lebih
 *   tepercaya daripada hasil mesin hanya karena diketik manusia; ia melewati
 *   antrean yang sama seperti seluruh berita lain.
 */

import { kartu, tombol, keping, pesanSistem, roti } from '../ui/komponen.js'
import { amankan, persen, nadaUrgensi, nadaSentimen, asalTautan } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, sisip, pesanRamah } from '../lib/api.js'
import { klasifikasikan } from '../lib/klasifikasi.js'
import { bangunIndeks, cocokkanUpt } from '../lib/pencocokan-upt.js'
import { KATEGORI, SEMUA_SUBKATEGORI } from '../lib/taksonomi.js'
import { EMBER, ember, nilaiSimpan } from '../lib/sentimen.js'
import { KONFIG } from '../lib/konfig.js'
import { adalahEksternal } from '../lib/peran.js'

const URGENSI = ['Rendah', 'Sedang', 'Tinggi', 'Kritis']

/** Bertahan selama sesi supaya isian tidak hilang saat berpindah halaman sejenak. */
const keadaanInput = {
  nilai: {
    link: '', judul: '', media: '', tanggal: '', upt: '', ringkasan: '', catatan: '',
  },
  /** Hasil mesin terakhir, dipakai sebagai usulan yang masih bisa diubah. */
  mesin: null,
  saranUpt: null,
  indeks: null,
  daftarUpt: [],
  sibuk: false,
  /** Berita yang baru saja tersimpan, untuk tautan cepat ke antrean telaah. */
  terakhir: null,
}

/**
 * Menyeragamkan tautan sebelum disimpan dan sebelum diperiksa kembarannya.
 *
 * Aturannya sama persis dengan yang dipakai penyalin spreadsheet. Kalau
 * keduanya berbeda, satu berita yang sama akan tersimpan dua kali: sekali
 * dengan penanda iklan di ekor alamatnya, sekali tanpa.
 */
export function normalkanTautan(nilai) {
  let url = String(nilai || '').trim()
  if (!url) return ''
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`

  try {
    const alamat = new URL(url)
    const buang = [...alamat.searchParams.keys()].filter((k) =>
      k.toLowerCase().startsWith('utm_')
      || ['fbclid', 'gclid', 'igsh', 'igshid'].includes(k.toLowerCase()))
    for (const k of buang) alamat.searchParams.delete(k)
    alamat.hash = ''
    return alamat.toString().replace(/\/$/, '')
  } catch {
    return url.replace(/\/$/, '')
  }
}

/** Platform ditebak dari alamatnya, sama seperti yang dilakukan penyalin. */
function kenaliPlatform(url) {
  const inang = asalTautan(url).toLowerCase()
  if (inang.includes('youtube') || inang.includes('youtu.be')) return 'YouTube'
  if (inang.includes('instagram')) return 'Instagram'
  if (inang.includes('facebook') || inang.includes('fb.watch')) return 'Facebook'
  if (inang.includes('tiktok')) return 'TikTok'
  if (inang.includes('news.google')) return 'Google News'
  return inang ? 'Portal Berita' : ''
}

/* ------------------------------------------------------------------ bagian */

function panelMesin() {
  const m = keadaanInput.mesin

  if (!m) {
    return `
      <div class="mesin-panel">
        <div class="mesin-kop"><span class="label-mono">Penilaian mesin</span></div>
        <p class="ket" style="margin:0">
          Isi judul dan ringkasan, lalu penilaian mesin muncul di sini sebelum Anda menyimpan.
        </p>
      </div>`
  }

  const cukup = Number(m.ai_confidence) >= KONFIG.ambangKeyakinan
  const kunci = Array.isArray(m.kata_kunci) ? m.kata_kunci : []

  return `
    <div class="mesin-panel">
      <div class="mesin-kop">
        <span class="label-mono">Penilaian mesin</span>
        <span class="mesin-yakin" data-cukup="${cukup}">
          ${(Number(m.ai_confidence) * 100).toFixed(0)}% yakin
        </span>
      </div>

      <div class="mesin-nilai">
        <div><dt>Kategori</dt><dd>${amankan(m.kategori || '—')}</dd></div>
        <div><dt>Subkategori</dt><dd>${amankan(m.subkategori || '—')}</dd></div>
        <div><dt>Sentimen</dt><dd>${keping(m.sentimen || '—', nadaSentimen(m.sentimen))}</dd></div>
        <div><dt>Urgensi</dt><dd>${keping(m.urgensi || '—', nadaUrgensi(m.urgensi))}</dd></div>
      </div>

      ${kunci.length ? `
        <div class="mesin-kunci">
          <span class="label-mono">Kata kunci penentu</span>
          <div>${kunci.map((k) => `<span class="kunci-keping">${amankan(k)}</span>`).join('')}</div>
        </div>` : ''}

      ${m.alasan ? `<p class="mesin-alasan">${amankan(m.alasan)}</p>` : ''}

      ${m.kategori === 'Di Luar Lingkup' ? pesanSistem(
        '<b>Mesin menilai berita ini di luar lingkup Pemasyarakatan.</b> '
        + 'Ia tetap bisa disimpan, tetapi tidak akan ikut menjadi angka di dasbor mana pun.',
        'sedang', 'info') : ''}

      ${!cukup && m.kategori !== 'Di Luar Lingkup' ? pesanSistem(
        `<b>Di bawah ambang ${persen(KONFIG.ambangKeyakinan, 1, 0)}.</b> `
        + 'Periksa kategori dan sentimennya sebelum menyimpan.',
        'sedang', 'info') : ''}
    </div>`
}

function panelSaranUpt() {
  const s = keadaanInput.saranUpt
  if (!s || !s.nama) return ''
  return `
    <div class="ket" style="margin-top:5px">
      ${ikon('peta')} Mesin pencocokan menyarankan <b>${amankan(s.nama)}</b>
      (${Math.round(s.skor * 100)}% yakin${s.bersaing ? ', bersaing dengan unit lain' : ''}).
      ${keadaanInput.nilai.upt === s.nama ? '' : `<button class="tbl kecil" data-aksi="pakai-upt"
        style="margin-left:6px">Pakai saran ini</button>`}
    </div>`
}

/* ----------------------------------------------------------------- halaman */

export function halamanInput({ keadaan, isi }) {
  const profil = keadaan.profil || {}
  const eksternal = adalahEksternal(profil.role)

  function gambar() {
    const n = keadaanInput.nilai
    const m = keadaanInput.mesin

    const pilihanSub = KATEGORI.map((k) => `
      <optgroup label="${amankan(k.kode)}. ${amankan(k.nama)}">
        ${k.subkategori.map((s) => `
          <option value="${amankan(s.kode)}"${s.kode === m?.subkategori_kode ? ' selected' : ''}>
            ${amankan(s.kode)} ${amankan(s.nama)}
          </option>`).join('')}
      </optgroup>`).join('')

    isi.innerHTML = `
      <div class="tumpuk">
        ${keadaanInput.terakhir ? pesanSistem(
          `<b>Tersimpan.</b> “${amankan(keadaanInput.terakhir.judul)}” masuk ke antrean telaah
           dan akan ikut dihitung setelah analis menyetujuinya.`, 'positif', 'centang') : ''}

        ${pesanSistem(
          'Berita yang dimasukkan di sini <b>tidak langsung menjadi angka</b>. Ia melewati '
          + 'Antrean Telaah seperti seluruh berita lain, sebab masukan manual tidak lebih '
          + 'tepercaya daripada hasil mesin hanya karena diketik manusia.', 'netral', 'info')}

        ${/*
          Petugas wilayah berhak tahu wilayah apa yang akan tertulis pada
          kirimannya sebelum menekan Simpan — dan berhak tahu lebih awal bila
          wilayahnya belum ditetapkan, sebab basis data akan menolak kirimannya
          tanpa memberi tahu apa yang kurang.
        */''}
        ${profil.assigned_kanwil
          ? pesanSistem(
              `Kiriman ini akan tercatat atas nama <b>${amankan(profil.assigned_kanwil)}</b> `
              + 'dan hanya terlihat oleh wilayah Anda serta analis pusat.', 'aksen', 'peta')
          : (eksternal
            ? pesanSistem(
                '<b>Wilayah pada akun Anda belum ditetapkan.</b> Kiriman akan ditolak basis data '
                + 'sampai administrator mengisinya. Hubungi administrator sistem lebih dulu.',
                'kritis', 'peringatan')
            : '')}

        <form id="borang-input" novalidate>
          <div class="kisi kisi-utama-samping">
            ${kartu({
              judul: 'Berita yang dimasukkan',
              ket: 'Tautan dan judul wajib diisi; sisanya membantu mesin menilai lebih tepat',
              isi: `
                <div class="tumpuk" style="gap:12px">
                  <div class="isian">
                    <label for="in-link">Tautan berita <span class="wajib">wajib</span></label>
                    <input class="masukan" id="in-link" name="link" type="url" inputmode="url"
                           value="${amankan(n.link)}" placeholder="https://…" autofocus>
                    <div class="ket" id="ket-link">
                      ${n.link ? amankan(`Sumber terbaca: ${asalTautan(normalkanTautan(n.link)) || 'belum dikenali'}`)
                        : 'Penanda iklan di ekor alamat dibuang otomatis sebelum disimpan.'}
                    </div>
                  </div>

                  <div class="isian">
                    <label for="in-judul">Judul berita <span class="wajib">wajib</span></label>
                    <input class="masukan" id="in-judul" name="judul" type="text"
                           value="${amankan(n.judul)}" placeholder="Judul sebagaimana tertulis di sumber">
                  </div>

                  <div class="kisi kisi-2">
                    <div class="isian">
                      <label for="in-media">Media atau kanal</label>
                      <input class="masukan" id="in-media" name="media" type="text"
                             value="${amankan(n.media)}" placeholder="mis. Kompas.com">
                    </div>
                    <div class="isian">
                      <label for="in-tanggal">Tanggal terbit</label>
                      <input class="masukan" id="in-tanggal" name="tanggal" type="datetime-local"
                             value="${amankan(n.tanggal)}">
                    </div>
                  </div>

                  <div class="isian">
                    <label for="in-upt">Unit pelaksana teknis</label>
                    <input class="masukan" id="in-upt" name="upt" type="text" list="daftar-upt"
                           value="${amankan(n.upt)}" placeholder="Kosongkan bila belum jelas unitnya">
                    <datalist id="daftar-upt">
                      ${keadaanInput.daftarUpt.slice(0, 600)
                        .map((u) => `<option value="${amankan(u)}"></option>`).join('')}
                    </datalist>
                    ${panelSaranUpt()}
                  </div>

                  <div class="isian">
                    <label for="in-ringkasan">Ringkasan isi berita</label>
                    <textarea class="masukan" id="in-ringkasan" name="ringkasan" rows="5"
                      placeholder="Apa yang terjadi, di mana, dan siapa yang terlibat.">${amankan(n.ringkasan)}</textarea>
                    <div class="ket">Makin lengkap ringkasannya, makin tepat penilaian mesin di sebelah kanan.</div>
                  </div>

                  <div class="isian">
                    <label for="in-catatan">Catatan petugas</label>
                    <input class="masukan" id="in-catatan" name="catatan" type="text"
                           value="${amankan(n.catatan)}" placeholder="Mis. sumber pertama isu ini, atau konteks yang tidak ada di berita">
                  </div>
                </div>`,
            })}

            ${kartu({
              judul: 'Penilaian yang akan tercatat',
              ket: 'Usulan mesin, masih bisa Anda ubah sebelum disimpan',
              isi: `
                ${panelMesin()}

                <div class="tumpuk" style="gap:12px;margin-top:14px">
                  <div class="isian">
                    <label for="in-sub">Subkategori</label>
                    <select class="pilihan penuh" id="in-sub" name="sub">
                      ${pilihanSub}
                      <option value="0.1"${m?.subkategori_kode === '0.1' ? ' selected' : ''}>0.1 Belum Dikelompokkan</option>
                      <option value="9.1"${m?.subkategori_kode === '9.1' ? ' selected' : ''}>9.1 Unit Non-Pemasyarakatan</option>
                      <option value="9.2"${m?.subkategori_kode === '9.2' ? ' selected' : ''}>9.2 Konten Tidak Relevan</option>
                    </select>
                  </div>

                  <fieldset class="pilih-sentimen">
                    <legend>Sentimen</legend>
                    <div class="pilih-deret">
                      ${EMBER.map((e) => {
                        const terpilih = ember(m?.sentimen || 'Netral') === e.kode
                        return `
                          <label class="pilih-kartu" data-nada="${e.nada}">
                            <input type="radio" name="in-sentimen" value="${e.kode}"${terpilih ? ' checked' : ''}>
                            <span class="pilih-isi">
                              <span class="pilih-judul">${amankan(e.label)}
                                <span class="pilih-ringkas">${amankan(e.ringkas)}</span></span>
                              <span class="pilih-ket">${amankan(e.keterangan)}</span>
                            </span>
                          </label>`
                      }).join('')}
                    </div>
                  </fieldset>

                  <div class="isian">
                    <label for="in-urgensi">Urgensi</label>
                    <select class="pilihan penuh" id="in-urgensi" name="urgensi">
                      ${URGENSI.map((u) => `<option${u === (m?.urgensi || 'Rendah') ? ' selected' : ''}>${u}</option>`).join('')}
                    </select>
                  </div>
                </div>`,
            })}
          </div>

          <div class="telaah-aksi" style="margin-top:14px">
            ${tombol({ label: 'Simpan berita', ikon: 'centang', gaya: 'utama',
              aksi: 'simpan', nonaktif: keadaanInput.sibuk })}
            ${tombol({ label: 'Kosongkan borang', ikon: 'tutup', aksi: 'kosongkan' })}
            <span class="dorong"></span>
            ${keadaanInput.terakhir
              ? tombol({ label: 'Buka antrean telaah', ikon: 'panahKanan', gaya: 'samar', aksi: 'ke-telaah' })
              : ''}
          </div>
        </form>
      </div>`
  }

  /* ------------------------------------------------------------- mesin */

  function nilaiUlang() {
    const n = keadaanInput.nilai
    const teks = `${n.judul} . ${n.ringkasan}`.trim()

    if (teks.length < 12) {
      keadaanInput.mesin = null
      keadaanInput.saranUpt = null
      return
    }

    keadaanInput.mesin = klasifikasikan({
      judul: n.judul,
      ringkasan: n.ringkasan,
      media: n.media,
      link: n.link,
    })

    if (keadaanInput.indeks) {
      const cocok = cocokkanUpt(`${n.judul} . ${n.ringkasan}`, keadaanInput.indeks)
      keadaanInput.saranUpt = cocok?.nama ? cocok : null
      // Saran yang cukup meyakinkan langsung mengisi kolomnya. Petugas yang
      // tidak setuju tinggal mengetik ulang; yang setuju tidak perlu mengetik
      // nama unit yang sudah dikenali mesin.
      if (!n.upt && cocok?.otomatis && cocok.nama) n.upt = cocok.nama
    }
  }

  /* ------------------------------------------------------------ simpan */

  function bacaBorang() {
    const ambilNilai = (id) => isi.querySelector(id)?.value ?? ''
    keadaanInput.nilai = {
      link: ambilNilai('#in-link').trim(),
      judul: ambilNilai('#in-judul').trim(),
      media: ambilNilai('#in-media').trim(),
      tanggal: ambilNilai('#in-tanggal'),
      upt: ambilNilai('#in-upt').trim(),
      ringkasan: ambilNilai('#in-ringkasan').trim(),
      catatan: ambilNilai('#in-catatan').trim(),
    }
  }

  async function simpan() {
    if (keadaanInput.sibuk) return
    bacaBorang()
    const n = keadaanInput.nilai

    if (!n.link) { roti('Tautan berita wajib diisi.', 'sedang'); isi.querySelector('#in-link')?.focus(); return }
    if (!n.judul) { roti('Judul berita wajib diisi.', 'sedang'); isi.querySelector('#in-judul')?.focus(); return }

    const tautan = normalkanTautan(n.link)
    const kodeSub = isi.querySelector('#in-sub')?.value || '0.1'
    const sub = SEMUA_SUBKATEGORI.find((s) => s.kode === kodeSub)
    const emberDipilih = isi.querySelector('input[name="in-sentimen"]:checked')?.value || 'netral'
    const urgensi = isi.querySelector('#in-urgensi')?.value || 'Rendah'
    const m = keadaanInput.mesin

    const luar = kodeSub === '9.1' || kodeSub === '9.2'
    const baris = {
      link: tautan,
      link_normalized: tautan,
      judul: n.judul,
      media: n.media || asalTautan(tautan) || 'Tidak diketahui',
      platform: kenaliPlatform(tautan),
      tanggal_publikasi: n.tanggal ? new Date(n.tanggal).toISOString() : null,
      // Kolom ini NOT NULL di basis data, dan artinya siapa yang bertanggung
      // jawab atas masuknya baris — bukan siapa yang menulis beritanya.
      nama_petugas: profil.full_name || profil.username || 'Petugas',
      created_by: profil.username || null,
      nama_upt: n.upt || 'Belum Teridentifikasi',
      ringkasan: n.ringkasan || n.judul,
      caption_manual: n.ringkasan || '',
      catatan: n.catatan || '',
      kategori: sub ? sub.kategoriNama : (luar ? 'Di Luar Lingkup' : 'Lainnya'),
      subkategori: sub ? sub.nama : (kodeSub === '0.1' ? 'Belum Dikelompokkan' : 'Konten Tidak Relevan'),
      subkategori_kode: kodeSub,
      sentimen: nilaiSimpan(emberDipilih, m?.sentimen),
      urgensi,
      tingkat_perhatian: urgensi,
      kata_kunci: m?.kata_kunci || [],
      ai_confidence: m?.ai_confidence ?? null,
      ai_provider: m?.ai_provider || 'manual',
      ai_alasan: m?.alasan || null,
      ai_classified_at: m ? new Date().toISOString() : null,
      source_type: 'manual',
      status_verifikasi: 'Belum Ditelaah',
      status_baca: 'INPUT MANUAL',
      dampak: 'UPT',
      detected_at: new Date().toISOString(),
    }

    // Petugas wilayah wajib menandai asal kirimannya; policy RLS menolak baris
    // yang tidak menyebutkannya, dan penolakan itu benar — kiriman tanpa asal
    // tidak bisa dibatasi kepada siapa pun.
    if (profil.assigned_kanwil) baris.kanwil_asal = profil.assigned_kanwil

    keadaanInput.sibuk = true
    gambar()

    if (keadaan.demo) {
      roti('Mode peragaan: berita tidak disimpan.', 'sedang', 5000)
      keadaanInput.sibuk = false
      gambar()
      return
    }

    try {
      // Kembaran diperiksa lebih dulu supaya petugas mendapat kalimat yang bisa
      // ditindaklanjuti, bukan galat kunci ganda dari basis data.
      const kembar = await ambil('berita', {
        select: 'id,judul,status_verifikasi',
        or: `(link_normalized.eq.${tautan},link.eq.${tautan})`,
        limit: 1,
      })

      if (Array.isArray(kembar) && kembar.length) {
        roti(`Tautan ini sudah tersimpan: “${kembar[0].judul || 'tanpa judul'}”.`, 'sedang', 6000)
        keadaanInput.sibuk = false
        gambar()
        return
      }

      const hasil = await sisip('berita', baris)
      const tersimpan = Array.isArray(hasil) ? hasil[0] : hasil

      // Berita baru ikut ke dalam keadaan aplikasi tanpa menunggu pemuatan
      // ulang, supaya dasbor dan antrean telaah langsung menghitungnya.
      if (tersimpan) {
        keadaan.berita.unshift(tersimpan)
        document.dispatchEvent(new CustomEvent('hitung-ulang'))
      }

      keadaanInput.terakhir = { id: tersimpan?.id, judul: n.judul }
      keadaanInput.nilai = { link: '', judul: '', media: '', tanggal: '', upt: '', ringkasan: '', catatan: '' }
      keadaanInput.mesin = null
      keadaanInput.saranUpt = null
      roti('Berita tersimpan dan masuk antrean telaah.', 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 7000)
    } finally {
      keadaanInput.sibuk = false
      gambar()
    }
  }

  /* ---------------------------------------------------------- penyimak */

  let jeda = null

  isi.addEventListener('input', (ev) => {
    if (!ev.target.matches('#in-link, #in-judul, #in-ringkasan, #in-media, #in-upt, #in-catatan')) return
    bacaBorang()

    // Mesin dijalankan sesudah ketikan berhenti sejenak. Menjalankannya pada
    // tiap huruf berarti menggambar ulang panel di tengah orang mengetik.
    clearTimeout(jeda)
    jeda = setTimeout(() => {
      const fokus = document.activeElement?.id
      const posisi = document.activeElement?.selectionStart
      nilaiUlang()
      gambar()
      const kembali = fokus && isi.querySelector(`#${fokus}`)
      if (kembali) {
        kembali.focus()
        try { kembali.setSelectionRange(posisi, posisi) } catch { /* bukan kolom teks */ }
      }
    }, 550)
  })

  isi.addEventListener('submit', (ev) => { ev.preventDefault(); simpan() })

  isi.addEventListener('click', (ev) => {
    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (!aksi) return

    if (aksi === 'simpan') { ev.preventDefault(); simpan() }
    else if (aksi === 'kosongkan') {
      keadaanInput.nilai = { link: '', judul: '', media: '', tanggal: '', upt: '', ringkasan: '', catatan: '' }
      keadaanInput.mesin = null
      keadaanInput.saranUpt = null
      keadaanInput.terakhir = null
      gambar()
    } else if (aksi === 'pakai-upt') {
      bacaBorang()
      keadaanInput.nilai.upt = keadaanInput.saranUpt?.nama || ''
      gambar()
    } else if (aksi === 'ke-telaah') {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'telaah', fokus: keadaanInput.terakhir?.id },
      }))
    }
  })

  /* -------------------------------------------------------------- muat */

  async function muatUpt() {
    if (keadaanInput.indeks || keadaan.demo) return
    try {
      const daftar = await ambil('upt', {
        select: 'nama_upt,jenis_upt,kelas_upt,subjenis_upt,provinsi,kanwil,kabupaten_kota,location_hint',
        aktif: 'eq.true',
        limit: 1000,
      })
      keadaanInput.indeks = bangunIndeks(daftar || [])
      keadaanInput.daftarUpt = (daftar || []).map((u) => u.nama_upt).filter(Boolean).sort()
      gambar()
    } catch {
      // Tanpa daftar unit, borang tetap bisa dipakai — kolom UPT hanya kehilangan
      // saran dan pelengkapan otomatisnya.
      keadaanInput.indeks = bangunIndeks([])
    }
  }

  gambar()
  muatUpt()

  return {
    judul: 'Input Berita',
    sub: 'Memasukkan publikasi yang belum tertangkap sinkronisasi',
  }
}
