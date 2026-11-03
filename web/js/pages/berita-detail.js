/**
 * Detail satu berita.
 *
 * ---------------------------------------------------------------------------
 * Kenapa halaman ini ada
 * ---------------------------------------------------------------------------
 *
 * Sampai 3 September 2026, satu berita tidak punya halamannya sendiri di
 * sistem ini. Baris di Pusat Data Berita tidak bisa dibuka; satu-satunya layar
 * yang menampilkan dasar penilaian sebuah berita adalah Antrean Telaah — dan
 * antrean itu, menurut definisinya sendiri, berhenti melayani sebuah berita
 * tepat setelah berita itu selesai ditelaah.
 *
 * Akibatnya satu pertanyaan yang paling sering ditanyakan justru yang paling
 * sulit dijawab: "kenapa berita ini dinilai begitu?" Untuk berita yang sudah
 * diverifikasi, jawabannya secara harfiah tidak bisa dibuka di mana pun,
 * padahal seluruh bahannya tersimpan lengkap di basis data. Sebuah sistem
 * intelijen yang penilaiannya tidak bisa ditelusuri kembali ke sumbernya
 * adalah sistem yang menuntut kepercayaan tanpa menawarkan pemeriksaan.
 *
 * ---------------------------------------------------------------------------
 * Tiga keputusan yang menentukan isi berkas ini
 * ---------------------------------------------------------------------------
 *
 *   Dua tahap pemuatan, dan tahap pertama tidak menunggu jaringan. Baris yang
 *   sudah ada di memori — hasil tarikan dasbor — langsung digambar, sehingga
 *   halaman terbuka seketika. Kolom yang tidak ikut ditarik massal (kata
 *   kunci, alasan mesin, catatan telaah, tanggapan unit) diminta sesudahnya
 *   dan mengisi tempatnya sendiri. Menunggu jaringan untuk menampilkan judul
 *   yang sudah ada di layar sebelah adalah menunggu tanpa sebab.
 *
 *   Liputan serumpun dihitung dengan mesin yang sama dengan laporan. Kalau
 *   halaman ini mengelompokkan sendiri, cepat atau lambat ia akan menyebut
 *   "8 publikasi" untuk peristiwa yang di laporan berkala tertulis 11 — dan
 *   tidak ada satu pun cara bagi pembacanya mengetahui mana yang benar.
 *
 *   Skor risiko tidak pernah tampil tanpa rinciannya. Itu bukan pilihan
 *   halaman ini, melainkan syarat yang dinyatakan lib/risiko.js; halaman yang
 *   menampilkan angkanya saja sedang melanggar maksud berkas itu.
 */

import { kartu, keping, kosong, tombol, pesanSistem, roti } from '../ui/komponen.js'
import { panelMesin } from '../ui/panel-mesin.js'
import {
  amankan, angka, ringkas, jarakWaktu, tanggalJam, asalTautan,
  nadaUrgensi, nadaSentimen, nadaStatus,
} from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { KONFIG } from '../lib/konfig.js'
import { ambil, pesanRamah } from '../lib/api.js'
import { sarankanTindak, layakDisarankan, TINDAKAN, HASIL_VERIFIKASI } from '../lib/tindak-lanjut.js'
import { muatKeputusan, keputusanSaatIni, simpanKeputusan } from '../lib/keputusan-tindak.js'
import {
  evaluasiBerita, sumberMesin, informasiMesin, prioritas, prioritasBerita,
  labelSumber, labelInformasi, EVALUASI_SUMBER, EVALUASI_INFORMASI,
} from '../lib/sip.js'
import { punyaIzin } from '../lib/peran.js'
import { belumTerpetakan } from '../lib/unit-terpetakan.js'
import { kenaliPenerbit } from '../lib/penerbit.js'
import { kelompokkanPeristiwa, validasi, sumberAsli } from '../lib/peristiwa.js'
import { skorRisiko, TOTAL_BOBOT } from '../lib/risiko.js'
import { dasar, TELAAH_WILAYAH, SIKAP_TANGGAPAN } from '../lib/hitung.js'
import { ember, emberDari } from '../lib/sentimen.js'

/**
 * Kolom yang diminta pada tahap kedua.
 *
 * Sengaja disebut satu per satu, bukan `*`, dengan alasan yang sama seperti
 * KOLOM_BERITA di main.js: kolom baru yang muncul di basis data tidak ikut
 * terbawa ke peramban sampai ada yang memutuskan ia memang perlu di layar.
 */
const KOLOM_LENGKAP = 'id,judul,nama_upt,kanwil_asal,provinsi,media,platform,link,'
  + 'created_at,tanggal_publikasi,detected_at,kategori,subkategori,subkategori_kode,'
  + 'sentimen,urgensi,tingkat_perhatian,status_verifikasi,source_type,ringkasan,'
  + 'caption_manual,catatan,rekomendasi,kata_kunci,ai_confidence,ai_provider,'
  + 'ai_alasan,ai_classified_at,ai_reviewed_by,ai_reviewed_at,review_note,'
  + 'verified_by,verified_at,nama_petugas,created_by,status_baca,dampak,'
  + 'telaah_wilayah_status,telaah_wilayah_oleh,telaah_wilayah_pada,telaah_wilayah_catatan,'
  + 'tanggapan_sikap,tanggapan_upt,tanggapan_oleh,tanggapan_pada'

/** Baris lengkap yang sudah pernah diambil, supaya kembali ke halaman ini cepat. */
const singgahan = new Map()

/* ------------------------------------------------------------------ bantuan */

/** Baris ganda: istilah di kiri, nilai di kanan. */
function baris(istilah, nilai, mono = false) {
  return `
    <div class="rinci-baris">
      <dt>${amankan(istilah)}</dt>
      <dd${mono ? ' class="mono"' : ''}>${nilai}</dd>
    </div>`
}

function teks(nilai, kosongTeks = '—') {
  const t = String(nilai ?? '').trim()
  return t ? amankan(t) : `<span class="samar-teks">${amankan(kosongTeks)}</span>`
}

/* -------------------------------------------------------------- skor risiko */

/**
 * Panel skor risiko.
 *
 * Tiga angka berurutan, dan urutannya yang penting: tekanan pemberitaan, lalu
 * gerbang sentimen, lalu skornya. Yang membaca dari atas ke bawah melihat
 * bagaimana angka terakhir terbentuk, bukan hanya angka terakhirnya.
 */
function panelRisiko(hasil) {
  const { skor, tekanan, gerbang, tingkat, faktor, catatan } = hasil

  return `
    <div class="risiko-panel">
      <div class="risiko-kepala" data-nada="${tingkat.nada}">
        <div class="risiko-angka">
          <b>${angka(skor)}</b><span>/ 100</span>
        </div>
        <div class="risiko-tingkat">
          ${keping(tingkat.kode, tingkat.nada)}
          <p>${amankan(tingkat.ket)}</p>
        </div>
      </div>

      <div class="risiko-rumus">
        <span>Tekanan pemberitaan <b>${angka(tekanan)}</b></span>
        ${ikon('tutup')}
        ${/* Dua desimal selalu, termasuk untuk 1,00. Angka "1" yang berdiri
              sendiri di antara dua angka besar tidak terbaca sebagai pengali. */''}
        <span>Gerbang sentimen <b>${gerbang.pengali.toFixed(2).replace('.', ',')}</b></span>
        <span class="risiko-sama">= <b>${angka(skor)}</b></span>
      </div>
      <p class="risiko-gerbang-ket">${amankan(gerbang.ket)}</p>

      <div class="risiko-faktor">
        <div class="risiko-faktor-kop">
          <span class="label-mono">Penyumbang tekanan</span>
          <span class="label-mono">${angka(TOTAL_BOBOT)} poin penuh</span>
        </div>
        ${faktor.map((f) => `
          <div class="risiko-baris">
            <div class="risiko-baris-kop">
              <span title="${amankan(f.ket)}">${amankan(f.nama)}</span>
              <b>+${String(f.poin).replace('.', ',')}</b>
              <i>dari ${f.bobot}</i>
            </div>
            <div class="risiko-bilah" role="img"
              aria-label="${amankan(f.nama)}: ${f.poin} dari ${f.bobot} poin">
              <i style="width:${Math.round(f.nilai * 100)}%"></i>
            </div>
            <p>${amankan(f.dasar)}</p>
          </div>`).join('')}
      </div>

      ${catatan.length ? `
        <div class="risiko-catatan">
          <span class="label-mono">Yang perlu diketahui sebelum mengutip angka ini</span>
          <ul>${catatan.map((c) => `<li>${amankan(c)}</li>`).join('')}</ul>
        </div>` : ''}
    </div>`
}

/* --------------------------------------------------------- liputan serumpun */

/**
 * Publikasi lain yang menunjuk peristiwa yang sama.
 *
 * Dikelompokkan dari himpunan dasar, bukan dari seluruh arsip: berita yang
 * sudah dinyatakan tidak valid tidak boleh menambah angka "23 publikasi" yang
 * dibaca pimpinan sebagai ukuran tekanan opini.
 */
function cariPeristiwa(semua, b) {
  const inti = dasar(semua)
  // Berita yang sedang dibuka bisa saja sudah dikecualikan analis. Ia tetap
  // harus ikut dikelompokkan, kalau tidak halaman ini akan berkata "tidak ada
  // liputan serumpun" untuk berita yang punya sepuluh saudara.
  const bahan = inti.some((x) => x.id === b.id) ? inti : [b, ...inti]
  return kelompokkanPeristiwa(bahan).find((p) => p.publikasi.some((x) => x.id === b.id)) || null
}

function panelSerumpun(p, b) {
  if (!p) return kosong('Belum bisa dikelompokkan', 'Peristiwa tidak dapat disusun dari data yang tersedia.')

  const saudara = p.publikasi.filter((x) => x.id !== b.id)

  return `
    <div class="serumpun">
      <div class="serumpun-angka">
        <div><b>${angka(p.jumlah_publikasi)}</b><span>publikasi</span></div>
        <div><b>${angka(p.jumlah_media)}</b><span>media berbeda</span></div>
        <div><b>1</b><span>peristiwa</span></div>
        ${p.kembar ? `<div><b>${angka(p.kembar)}</b><span>nyaris identik</span></div>` : ''}
      </div>

      ${pesanSistem(
        `<b>Satuan yang dihitung adalah peristiwa, bukan publikasi.</b>
         ${angka(p.jumlah_publikasi)} terbitan di bawah ini menunjuk satu kejadian yang sama.
         Jumlah terbitan mengukur tekanan opini; jumlah peristiwa mengukur berapa banyak
         yang harus ditangani.`, 'netral', 'info')}

      ${saudara.length ? `
        <ul class="serumpun-daftar">
          ${saudara.map((x) => `
            <li>
              <button class="serumpun-butir" data-buka="${amankan(x.id)}">
                ${keping(x.urgensi || 'Rendah', nadaUrgensi(x.urgensi), true)}
                <span class="serumpun-judul">${amankan(ringkas(x.judul || 'Tanpa judul', 110))}</span>
                <span class="serumpun-kaki">${amankan(sumberAsli(x) || 'Penerbit tidak dikenali')}
                  · ${amankan(jarakWaktu(x.tanggal_publikasi || x.created_at))}</span>
              </button>
            </li>`).join('')}
        </ul>`
        : `<p class="samar-teks" style="padding:4px 2px">Belum ada publikasi lain yang
             menunjuk peristiwa ini. Skor jangkauan dan pengulangannya karena itu rendah.</p>`}
    </div>`
}

/* ------------------------------------------------------------ mutu penilaian */

function panelMutu(b) {
  const v = validasi(b)
  if (v.lolos && !v.temuan.length) {
    return pesanSistem('Tidak ada pertentangan antarsinyal yang terdeteksi pada penilaian ini.',
      'positif', 'centang')
  }

  return `
    <div class="mutu-panel">
      ${pesanSistem(
        v.lolos
          ? `<b>Mutu penilaian: ${amankan(v.mutu)}.</b> Ada catatan, tetapi belum cukup berat untuk menahan berita ini.`
          : `<b>Mutu penilaian: ${amankan(v.mutu)}.</b> Penilaian mesin atas berita ini patut diperiksa analis sebelum dipakai.`,
        v.lolos ? 'sedang' : 'kritis', v.lolos ? 'info' : 'peringatan')}
      <ul class="mutu-temuan">
        ${v.temuan.map((t) => `<li><span class="mono">${amankan(t.kode)}</span>${amankan(t.pesan)}</li>`).join('')}
      </ul>
    </div>`
}

/* ------------------------------------------------------- telaah & tanggapan */

function panelTelaah(b) {
  const putusanWilayah = TELAAH_WILAYAH.find((t) => t.kode === b.telaah_wilayah_status)
  const sikap = SIKAP_TANGGAPAN.find((s) => s.kode === b.tanggapan_sikap)

  return `
    <dl class="rinci">
      ${baris('Status telaah pusat', keping(b.status_verifikasi || 'Belum Ditelaah',
        nadaStatus(b.status_verifikasi), true))}
      ${b.verified_by ? baris('Diverifikasi oleh',
        `${teks(b.verified_by)}<span class="mini-teks samar-teks"> · ${amankan(tanggalJam(b.verified_at))}</span>`) : ''}
      ${b.review_note ? baris('Catatan telaah', teks(b.review_note)) : ''}

      ${/*
           Putusan daerah ditampilkan berdampingan dengan putusan pusat, bukan
           menggantikannya. Keduanya menjawab pertanyaan yang berbeda: pusat
           menentukan berita ini ikut dihitung atau tidak, daerah menyatakan
           kabar itu benar menyangkut mereka dan penilaiannya sudah tepat.
           Menyatukan keduanya berarti sebuah unit bisa menghapus berita
           tentang dirinya sendiri dari angka nasional.
        */''}
      ${baris('Telaah daerah', putusanWilayah
        ? keping(putusanWilayah.kode, putusanWilayah.nada, true)
        : `<span class="samar-teks">Belum ditelaah daerah</span>`)}
      ${b.telaah_wilayah_oleh ? baris('Ditelaah oleh',
        `${teks(b.telaah_wilayah_oleh)}<span class="mini-teks samar-teks"> · ${amankan(tanggalJam(b.telaah_wilayah_pada))}</span>`) : ''}
      ${b.telaah_wilayah_catatan ? baris('Catatan daerah', teks(b.telaah_wilayah_catatan)) : ''}

      ${baris('Sikap resmi unit', sikap
        ? keping(sikap.kode, sikap.nada, true)
        : `<span class="samar-teks">Belum ada sikap resmi</span>`)}
      ${b.tanggapan_upt ? baris('Tanggapan unit', teks(b.tanggapan_upt)) : ''}
      ${b.tanggapan_oleh ? baris('Ditanggapi oleh',
        `${teks(b.tanggapan_oleh)}<span class="mini-teks samar-teks"> · ${amankan(tanggalJam(b.tanggapan_pada))}</span>`) : ''}
    </dl>`
}

/* ------------------------------------------------------- saran tindak lanjut */

const DASAR = { analis: 'Diputuskan analis', unit: 'Menurut sikap unit', mesin: 'Saran mesin' }

/**
 * Kartu rekomendasi tindak lanjut.
 *
 * Tiga bagian dalam satu kartu: saran beserta alasannya (selalu), langkah yang
 * disarankan, dan formulir keputusan (hanya bagi yang berhak mencatat). Ketiganya
 * di satu tempat karena alasan yang sama dengan seluruh halaman ini: orang yang
 * memutuskan harus bisa melihat dasar saran di sebelah tombol yang ia tekan.
 */
function panelTindak(b, keadaan, media, { pesan = null } = {}) {
  const peran = keadaan.profil?.role
  if (!layakDisarankan(b)) {
    return pesanSistem(
      'Saran tindak lanjut hanya diberikan untuk berita negatif yang ikut dihitung. '
      + 'Berita ini positif, netral, di luar lingkup, atau sudah dinyatakan tidak valid.',
      'netral', 'info')
  }

  const keputusan = keputusanSaatIni().get(b.id) || null
  const s = sarankanTindak(b, { media, keputusan })
  const bolehCatat = punyaIzin(peran, 'catat_tindak_berita')

  // Penilaian SIP 2023. Pilihan kosong berarti "ikuti saran mesin", dan
  // labelnya menyebut saran itu supaya analis tahu apa yang ia setujui.
  const ev = evaluasiBerita(b, { media, keputusan })
  const mesinSumber = sumberMesin(b)
  const mesinInfo = informasiMesin(b, { media, keputusan })
  const prio = prioritas(prioritasBerita(b))
  const pilihEvaluasi = (nama, daftar, nilai, saranMesin, labelMesin) => `
    <select class="pilihan" name="${nama}">
      <option value="">Ikuti saran mesin (${amankan(saranMesin)} — ${amankan(labelMesin)})</option>
      ${daftar.map((e) => `<option value="${e.kode}"${nilai === e.kode ? ' selected' : ''}>${e.kode} — ${amankan(e.label)}</option>`).join('')}
    </select>`

  const formulir = bolehCatat ? `
    <div class="saran-form" data-peran="form-tindak">
      <div class="label-mono">Catat keputusan</div>
      <label class="saran-isian">
        <span>Evaluasi sumber <span class="samar-teks">(SIP 2023)</span></span>
        ${pilihEvaluasi('evaluasi_sumber', EVALUASI_SUMBER, keputusan?.evaluasi_sumber, mesinSumber, labelSumber(mesinSumber))}
      </label>
      <label class="saran-isian">
        <span>Evaluasi informasi <span class="samar-teks">(SIP 2023)</span></span>
        ${pilihEvaluasi('evaluasi_informasi', EVALUASI_INFORMASI, keputusan?.evaluasi_informasi, mesinInfo, labelInformasi(mesinInfo))}
      </label>
      <label class="saran-isian">
        <span>Hasil verifikasi</span>
        <select class="pilihan" name="hasil">
          <option value="">Belum diperiksa</option>
          ${HASIL_VERIFIKASI.map((h) => `<option value="${amankan(h.kode)}"${s.hasil === h.kode ? ' selected' : ''}>${amankan(h.kode)} — ${amankan(h.ket)}</option>`).join('')}
        </select>
      </label>
      <label class="saran-isian">
        <span>Tindakan</span>
        <select class="pilihan" name="tindak">
          ${TINDAKAN.map((x) => `<option value="${x.kode}"${s.kode === x.kode ? ' selected' : ''}>${amankan(x.label)}</option>`).join('')}
        </select>
      </label>
      <label class="saran-isian">
        <span>Catatan <span class="samar-teks">(maksimal 1000 huruf)</span></span>
        <textarea class="masukan" name="catatan" rows="3" maxlength="1000"
                  placeholder="Siapa yang dihubungi, apa yang ditemukan, apa yang akan dilakukan">${amankan(keputusan?.catatan || '')}</textarea>
        <span class="mini-teks samar-teks">Pisahkan fakta dari pendapat, dan pastikan memuat 5W1H: siapa,
          apa, di mana, kapan, mengapa, bagaimana. Jangan tulis nama informan atau nomor dokumen;
          catatan ini ikut keluar di berkas ekspor dan dikaburkan hanya pada versi edaran.</span>
      </label>
      <div class="baris gap-6">
        ${tombol({ label: keputusan ? 'Perbarui keputusan' : 'Simpan keputusan', ikon: 'centang', gaya: 'utama', aksi: 'simpan-tindak' })}
        ${KONFIG.mode === 'demo'
          ? '<span class="mini-teks samar-teks">Mode peragaan: keputusan hanya tersimpan sampai halaman dimuat ulang.</span>' : ''}
      </div>
    </div>` : ''

  return `
    ${pesan ? pesanSistem(amankan(pesan), 'positif', 'centang') : ''}
    <div class="saran-tindak saran-besar" data-tindak="${amankan(s.kode)}">
      <div class="saran-kop">
        ${keping(s.label, s.nada)}
        <span class="mini-teks samar-teks">${amankan(DASAR[s.dasar] || '')}${s.oleh
          ? ` · ${amankan(s.oleh)}, ${amankan(tanggalJam(s.pada))}` : ''}</span>
      </div>
      ${s.berbeda ? `<p class="mini-teks" style="margin:4px 0 0">Mesin menyarankan <b>${amankan(s.mesin.pendek)}</b>;
        analis memutuskan berbeda. Alasan mesin: ${amankan(s.mesin.alasan.join(' '))}</p>` : ''}
      <ul class="saran-alasan">${s.alasan.map((a) => `<li>${amankan(a)}</li>`).join('')}</ul>
      <div class="label-mono" style="margin-top:6px">Langkah yang disarankan</div>
      <ol class="saran-langkah">${s.langkah.map((l) => `<li>${amankan(l)}</li>`).join('')}</ol>
      <div class="label-mono" style="margin-top:6px">Penilaian SIP 2023</div>
      <p class="mini-teks" style="margin:2px 0 0">
        Nilai <b>${amankan(ev.nilai)}</b> — sumber ${amankan(labelSumber(ev.sumber).toLowerCase())},
        informasi ${amankan(labelInformasi(ev.informasi).toLowerCase())}
        <span class="samar-teks">(${ev.dasar === 'analis' ? 'dinilai analis' : 'saran mesin'})</span>.
        Prioritas <b>${amankan(prio.label)}</b>: ${amankan(prio.batas.toLowerCase())}.
      </p>
    </div>
    ${formulir}
    <p class="mini-teks samar-teks" style="margin:8px 0 0">
      Mesin menyarankan, analis memutuskan. Saran dihitung dari subkategori, urgensi, kualitas
      dan jumlah media, serta sikap unit; ia bukan pengganti penilaian lapangan.
    </p>`
}

/**
 * Pemuatan keputusan, penyegaran panel, dan penyimpanan.
 *
 * Penyimak dipasang pada `isi` dengan delegasi, bukan pada tombolnya: panel
 * digambar ulang setiap kali keputusan tersimpan, dan penyimak yang menempel
 * pada tombol lama hilang bersamanya tanpa pesan apa pun.
 */
function pasangTindak(isi, keadaan, b, media) {
  const segarkan = (opsi) => {
    const wadah = isi.querySelector('#detail-tindak')
    if (wadah) wadah.innerHTML = panelTindak(b, keadaan, media, opsi)
  }

  muatKeputusan().then(() => segarkan())

  isi.addEventListener('change', (ev) => {
    if (!ev.target.matches('#detail-tindak [name="hasil"]')) return
    // Hasil verifikasi yang dipilih menggeser tindakan ke yang menjadi akibatnya;
    // analis tetap bebas mengubahnya sesudah itu.
    const h = HASIL_VERIFIKASI.find((x) => x.kode === ev.target.value)
    const pilih = isi.querySelector('#detail-tindak [name="tindak"]')
    if (h && pilih) pilih.value = h.tindakan
  })

  isi.addEventListener('click', async (ev) => {
    const tombolSimpan = ev.target.closest('#detail-tindak [data-aksi="simpan-tindak"]')
    if (!tombolSimpan || tombolSimpan.disabled) return
    const bidang = (n) => isi.querySelector(`#detail-tindak [name="${n}"]`)?.value || ''

    tombolSimpan.disabled = true
    try {
      await simpanKeputusan({
        beritaId: b.id,
        tindakan: bidang('tindak'),
        hasil: bidang('hasil'),
        catatan: bidang('catatan'),
        evaluasiSumber: bidang('evaluasi_sumber'),
        evaluasiInformasi: bidang('evaluasi_informasi'),
        oleh: keadaan.profil?.username || keadaan.profil?.full_name || 'peragaan',
      })
      segarkan({ pesan: 'Keputusan tersimpan.' })
    } catch (e) {
      tombolSimpan.disabled = false
      roti(pesanRamah(e), 'kritis')
    }
  })
}

/* ----------------------------------------------------------------- halaman */

export function halamanBeritaDetail({ keadaan, isi }) {
  const id = keadaan.fokus
  const semua = keadaan.berita || []
  const ringkasBaris = semua.find((b) => b.id === id)
  const b = { ...(ringkasBaris || {}), ...(singgahan.get(id) || {}) }

  if (!id || !b.id) {
    isi.innerHTML = kartu({
      isi: kosong(
        'Berita tidak ditemukan',
        'Alamat yang dibuka menunjuk berita yang tidak ada di dalam arsip yang termuat. '
          + 'Berita itu mungkin sudah dihapus, atau berada di luar wilayah yang boleh Anda baca.',
        tombol({ label: 'Kembali ke Pusat Data Berita', ikon: 'berita', gaya: 'utama', halaman: 'berita' }),
      ),
    })
    return { judul: 'Detail Berita', sub: 'Berita tidak ditemukan' }
  }

  const peristiwa = cariPeristiwa(semua, b)
  const risiko = skorRisiko(peristiwa || {
    urgensi: b.urgensi, sentimen: b.sentimen, publikasi: [b],
    jumlah_publikasi: 1, jumlah_media: sumberAsli(b) ? 1 : 0, rentang_hari: 1, kembar: 0,
    tanggal_terakhir: b.tanggal_publikasi || b.created_at,
  })

  const penerbit = kenaliPenerbit(b)
  const emberIni = emberDari(ember(b))
  const bolehSaran = punyaIzin(keadaan.profil?.role, 'lihat_saran_tindak')
  const bolehTelaah = punyaIzin(keadaan.profil?.role, 'telaah_berita')
    || punyaIzin(keadaan.profil?.role, 'telaah_wilayah')

  isi.innerHTML = `
    <div class="tumpuk">

      ${/* ------------------------------------------------------------ kepala */''}
      ${kartu({
        isi: `
          <div class="detail-kepala">
            <div class="detail-lencana">
              ${keping(b.urgensi || 'Rendah', nadaUrgensi(b.urgensi))}
              ${keping(emberIni.label, emberIni.nada, true)}
              ${keping(b.status_verifikasi || 'Belum Ditelaah', nadaStatus(b.status_verifikasi), true)}
              ${b.kategori === 'Di Luar Lingkup'
                ? keping('Tidak ikut dihitung', 'netral', true) : ''}
            </div>

            <h2 class="detail-judul">${amankan(b.judul || 'Tanpa judul')}</h2>

            <div class="detail-meta">
              <span>${ikon('berita')}${amankan(sumberAsli(b) || b.media || asalTautan(b.link) || 'Penerbit tidak dikenali')}</span>
              ${b.platform ? `<span>${amankan(b.platform)}</span>` : ''}
              <span>${ikon('jam')}${amankan(tanggalJam(b.tanggal_publikasi || b.created_at))}</span>
              <span title="Waktu baris ini masuk ke sistem">masuk ${amankan(jarakWaktu(b.created_at))}</span>
            </div>

            <div class="baris gap-6" style="flex-wrap:wrap">
              ${b.link ? `<a class="tbl utama" href="${amankan(b.link)}" target="_blank"
                 rel="noopener noreferrer">${ikon('tautan')}Buka sumber asli</a>` : ''}
              ${bolehTelaah ? tombol({ label: 'Telaah berita ini', ikon: 'centang', aksi: 'ke-telaah' }) : ''}
              ${tombol({ label: 'Kembali ke daftar', ikon: 'berita', halaman: 'berita' })}
            </div>
          </div>`,
      })}

      <div class="kisi kisi-utama-samping">
        <div class="tumpuk">

          ${bolehSaran ? kartu({
            judul: 'Rekomendasi tindak lanjut',
            ket: 'Perlu ditangani langsung, cukup diklarifikasi, atau diperiksa dulu.',
            // Jalan ke analisis kasus per kasus: hasilnya diteruskan sebagai
            // Klarifikasi UPT atau Disposisi Pimpinan (3 November 2026).
            aksi: tombol({ label: 'Analisis & teruskan', ikon: 'kasus', kecil: true, gaya: 'utama', halaman: 'analisis-berita', data: { fokus: b.id } }),
            isi: `<div id="detail-tindak">${panelTindak(b, keadaan, peristiwa?.jumlah_media || 1)}</div>`,
          }) : ''}

          ${/* --------------------------------------------------- ringkasan */''}
          ${kartu({
            judul: 'Ringkasan',
            ket: 'Disusun mesin dari judul dan isi publikasi. Belum tentu sudah dibaca manusia.',
            isi: `
              ${pesanSistem(
                '<b>Disusun mesin.</b> Kalimat di bawah bukan pernyataan resmi instansi '
                + 'dan bukan kesimpulan analis. Ia hasil mesin berbasis aturan, dan '
                + 'boleh keliru.', 'netral', 'info')}
              <p class="detail-ringkasan">${teks(b.ringkasan, 'Tidak ada ringkasan.')}</p>
              ${b.caption_manual && b.caption_manual !== b.ringkasan
                ? `<p class="detail-ringkasan"><span class="label-mono">Isi yang dimasukkan petugas</span><br>
                   ${teks(b.caption_manual)}</p>` : ''}
              ${b.rekomendasi ? `<p class="detail-ringkasan"><span class="label-mono">Catatan rekomendasi dari lembar sumber</span><br>
                 ${teks(b.rekomendasi)}</p>` : ''}`,
          })}

          ${/* ------------------------------------------------ penilaian mesin */''}
          ${kartu({
            judul: 'Dasar penilaian mesin',
            ket: 'Apa yang dibaca mesin, dan apa yang hampir dipilihnya.',
            isi: `<div id="detail-mesin">${panelMesin(b, { pesaing: true })}</div>`,
          })}

          ${kartu({
            judul: 'Mutu penilaian',
            ket: 'Pertentangan antarsinyal yang membuat hasil ini patut diperiksa.',
            isi: panelMutu(b),
          })}

          ${/* ------------------------------------------------------ serumpun */''}
          ${kartu({
            judul: 'Liputan serumpun',
            ket: 'Publikasi lain yang menunjuk peristiwa yang sama.',
            isi: panelSerumpun(peristiwa, b),
          })}

          ${kartu({
            judul: 'Telaah dan tanggapan',
            ket: 'Putusan pusat, putusan daerah, dan sikap resmi unit — bertiga, berdampingan.',
            isi: `<div id="detail-telaah">${panelTelaah(b)}</div>`,
          })}
        </div>

        <div class="tumpuk">

          ${/* ---------------------------------------------------- skor risiko */''}
          ${kartu({
            judul: 'Skor risiko',
            ket: 'Dihitung ulang setiap kali halaman ini dibuka. Tidak disimpan.',
            isi: panelRisiko(risiko),
          })}

          ${/* -------------------------------------------------- klasifikasi */''}
          ${kartu({
            judul: 'Klasifikasi',
            isi: `
              <dl class="rinci">
                ${baris('Unit', belumTerpetakan(b.nama_upt)
                  ? keping('Belum terpetakan', 'sedang', true)
                  : teks(b.nama_upt))}
                ${baris('Kantor wilayah', teks(b.kanwil_asal))}
                ${baris('Provinsi', teks(b.provinsi))}
                ${baris('Kategori', teks(b.kategori))}
                ${baris('Subkategori', `${teks(b.subkategori)}
                  ${b.subkategori_kode ? `<span class="mono mini-teks samar-teks"> ${amankan(b.subkategori_kode)}</span>` : ''}`)}
                ${baris('Sentimen', keping(b.sentimen || '—', nadaSentimen(b.sentimen), true))}
                ${baris('Urgensi', keping(b.urgensi || '—', nadaUrgensi(b.urgensi), true))}
                ${baris('Tingkat perhatian', teks(b.tingkat_perhatian))}
                ${baris('Keyakinan mesin', b.ai_confidence != null
                  ? `<b class="mono">${(Number(b.ai_confidence) * 100).toFixed(0)}%</b>
                     <span class="mini-teks samar-teks">
                       ${Number(b.ai_confidence) >= KONFIG.ambangKeyakinan ? 'di atas ambang' : 'di bawah ambang'}</span>`
                  : teks(null))}
              </dl>

              ${pesanSistem(
                '<b>Keyakinan bukan risiko.</b> Yang satu menyatakan seberapa yakin mesin '
                + 'pada klasifikasinya; yang lain menyatakan seberapa besar persoalannya. '
                + 'Keduanya bisa tinggi bersamaan, dan bisa rendah bersamaan.',
                'netral', 'info')}`,
          })}

          ${/* ------------------------------------------------- sumber & asal */''}
          ${kartu({
            judul: 'Sumber',
            isi: `
              <dl class="rinci">
                ${baris('Penerbit', teks(penerbit.akun || b.media))}
                ${baris('Jenis penerbit', keping(
                  { institusi: 'Kanal resmi unit', media_massa: 'Media massa',
                    penyisiran: 'Penyisiran media sosial', tidak_dikenal: 'Tidak dikenali' }[penerbit.jenis],
                  penerbit.jenis === 'media_massa' ? 'tinggi'
                    : penerbit.jenis === 'institusi' ? 'positif' : 'netral', true))}
                ${baris('Cara masuk', teks({ manual: 'Input manual petugas', google_sheet: 'Sinkronisasi spreadsheet' }[b.source_type] || b.source_type))}
                ${baris('Petugas penanggung jawab', teks(b.nama_petugas || b.created_by))}
                ${baris('Terbit', teks(tanggalJam(b.tanggal_publikasi)))}
                ${baris('Terdeteksi sistem', teks(tanggalJam(b.detected_at || b.created_at)))}
                ${baris('Tautan', b.link
                  ? `<a href="${amankan(b.link)}" target="_blank" rel="noopener noreferrer"
                       class="detail-tautan">${amankan(ringkas(b.link, 46))}</a>`
                  : teks(null))}
                ${baris('Pengenal baris', `<span class="mono mini-teks">${amankan(b.id)}</span>`)}
              </dl>

              <p class="mini-teks samar-teks" style="padding:2px 2px 0">
                ${amankan(penerbit.alasan)}
              </p>

              ${pesanSistem(
                'Jenis penerbit dipakai menghitung kredibilitas pada skor risiko. Ia menyatakan '
                + 'bobot kelembagaan sebuah terbitan, bukan penilaian atas mutu jurnalistik '
                + 'media mana pun.', 'netral', 'info')}`,
          })}
        </div>
      </div>
    </div>`

  pasangPenyimak(isi, keadaan, b)
  if (bolehSaran) pasangTindak(isi, keadaan, b, peristiwa?.jumlah_media || 1)
  muatLengkap(isi, b)

  return {
    judul: ringkas(b.judul || 'Detail Berita', 72),
    sub: `${belumTerpetakan(b.nama_upt) ? 'Unit belum terpetakan' : b.nama_upt} · risiko ${risiko.skor}/100`,
  }
}

/* --------------------------------------------------------------- penyimak */

function pasangPenyimak(isi, keadaan, b) {
  isi.addEventListener('click', (ev) => {
    const buka = ev.target.closest('[data-buka]')?.dataset.buka
    if (buka) {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'berita-detail', fokus: buka },
      }))
      return
    }

    if (ev.target.closest('[data-aksi="ke-telaah"]')) {
      document.dispatchEvent(new CustomEvent('buka-halaman', {
        detail: { halaman: 'telaah', fokus: b.id },
      }))
    }
  })
  void keadaan
}

/* ---------------------------------------------------------- tahap kedua */

/**
 * Mengambil baris lengkap, lalu mengisi dua bagian yang menunggunya.
 *
 * Yang digambar ulang hanya dua panel, bukan seluruh halaman. Menggambar ulang
 * seluruh halaman berarti pembacanya kehilangan posisi gulir tepat ketika ia
 * sudah mulai membaca — dan bagian yang paling sering dibaca lebih dulu, skor
 * risiko, justru bagian yang tidak menunggu jaringan sama sekali.
 */
async function muatLengkap(isi, b) {
  // Mode peragaan tidak punya peladen, dan barisnya memang sudah lengkap.
  if (KONFIG.mode === 'demo' || singgahan.has(b.id)) return

  try {
    const [penuh] = await ambil('berita', {
      select: KOLOM_LENGKAP,
      id: `eq.${b.id}`,
      limit: 1,
    }) || []

    if (!penuh) return
    singgahan.set(b.id, penuh)

    const lengkap = { ...b, ...penuh }
    const wadahMesin = isi.querySelector('#detail-mesin')
    if (wadahMesin) wadahMesin.innerHTML = panelMesin(lengkap, { pesaing: true })

    const wadahTelaah = isi.querySelector('#detail-telaah')
    if (wadahTelaah) wadahTelaah.innerHTML = panelTelaah(lengkap)
  } catch (galat) {
    /*
       Kegagalan di sini tidak boleh menjatuhkan halaman. Yang hilang hanya
       kata kunci, catatan telaah, dan tanggapan unit — judul, klasifikasi,
       skor risiko, dan liputan serumpun semuanya sudah tergambar dari baris
       yang ada di memori.
    */
    roti(pesanRamah(galat), 'sedang', 5000)
  }
}
