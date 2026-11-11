/**
 * Telaah Wilayah — dan, bagi petugas unit, Tanggapan Unit.
 *
 * Satu halaman untuk dua ruang, dengan sengaja. Kantor wilayah dan unit
 * pelaksana teknis mengerjakan pekerjaan yang sama persis — membaca penilaian
 * mesin atas sebuah berita, lalu menyatakan apakah penilaian itu tepat — dan
 * yang membedakan keduanya hanya seberapa luas berita yang sampai kepadanya.
 * Perbedaan itu ditentukan peladen, bukan halaman ini: policy `can_access_upt`
 * memotong barisnya jauh sebelum sampai ke peramban. Dua salinan halaman yang
 * sama pasti berpisah pelan-pelan; satu halaman tidak bisa.
 *
 * Yang membedakan halaman ini dari Antrean Telaah pusat, dan tidak boleh
 * dikaburkan: putusan di sini TIDAK menyentuh `status_verifikasi`. Kolom itu
 * milik analis pusat dan menentukan sebuah berita ikut dihitung atau tidak.
 * Bila unit boleh mengisinya, sebuah lapas dapat menyatakan berita tentang
 * dirinya sendiri tidak valid dan berita itu lenyap dari angka nasional tanpa
 * pernah dibaca seorang analis pun. Maka putusan daerah punya kolomnya sendiri,
 * dan keduanya terbaca berdampingan di Pusat Data Berita.
 *
 * Yang boleh diubah daerah adalah penilaian mesinnya — kategori, sentimen,
 * urgensi. Justru unit yang bersangkutan yang paling tahu apakah sebuah kabar
 * benar menyangkut unitnya, dan revisinya tercatat lengkap dengan alasannya.
 */

import { kartu, tombol, keping, kosong, pesanSistem, roti, konfirmasi } from '../ui/komponen.js'
import {
  amankan, angka, persen, ringkas, jarakWaktu, tanggalJam,
  nadaUrgensi, nadaSentimen, nadaStatus, asalTautan,
} from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { perbarui, pesanRamah } from '../lib/api.js'
import { KATEGORI, SEMUA_SUBKATEGORI } from '../lib/taksonomi.js'
import { KONFIG } from '../lib/konfig.js'
import { EMBER, ember, nilaiSimpan } from '../lib/sentimen.js'
import { menungguTelaahLapis, lapisTelaah, TELAAH_WILAYAH, SIKAP_TANGGAPAN, dasar } from '../lib/hitung.js'
import { punyaIzin, adalahUnit } from '../lib/peran.js'
import { belumTerpetakan } from '../lib/unit-terpetakan.js'

const URGENSI = ['Rendah', 'Sedang', 'Tinggi', 'Kritis']

/*
   Lapis kolom putusan untuk ruang yang sedang dibuka: 'telaah_wilayah' bagi
   kantor wilayah, 'telaah_upt' bagi petugas unit (migrasi 20261111120000).
   Ditetapkan setiap kali halaman dibuka. Semula kedua ruang menulis ke kolom
   yang sama, sehingga putusan kanwil mengosongkan antrean UPT.
*/
let KOL = 'telaah_wilayah'
let UNIT = false

/** Putusan yang tidak menuntut formulir apa pun — satu tekan, selesai. */
const PUTUSAN_LANGSUNG = ['Sesuai', 'Bukan Unit Kami', 'Perlu Perhatian']

/** Bertahan selama sesi supaya posisi antrean tidak hilang saat berpindah halaman. */
const keadaanTelaah = {
  nomor: 0,
  /** 'revisi' | 'tanggapan' | null — panel mana yang sedang terbuka. */
  panel: null,
  /** Berita yang sedang direvisi dari daftar "Dapat direvisi", bukan dari antrean. */
  revisiId: null,
  sibuk: false,
  selesai: new Set(),
  putusan: { Sesuai: 0, Direvisi: 0, 'Bukan Unit Kami': 0, 'Perlu Perhatian': 0 },
  ditanggapi: 0,
}

/**
 * Urutan antrean: yang mendesak lebih dulu, lalu yang paling tidak diyakini
 * mesin. Aturannya sama persis dengan antrean pusat — bukan karena kebetulan,
 * melainkan supaya dua orang yang membicarakan "berita nomor satu di antrean"
 * membicarakan berita yang sama.
 */
function susunAntrean(berita) {
  const peringkat = { Kritis: 4, Tinggi: 3, Sedang: 2, Rendah: 1 }
  return berita
    .filter((b) => !keadaanTelaah.selesai.has(b.id))
    .filter((b) => menungguTelaahLapis(b, UNIT))
    .sort((a, b) => {
      const u = (peringkat[b.urgensi] || 0) - (peringkat[a.urgensi] || 0)
      if (u) return u
      return (Number(a.ai_confidence) || 0) - (Number(b.ai_confidence) || 0)
    })
}

/*
   Putusan yang masih bisa direvisi. Jendela 24 jam dihitung dari putusan
   pertama (lihat migrasi 20261111100000), jadi tidak bisa diperpanjang dengan
   terus-menerus merevisi.
*/
const JENDELA_REVISI_MS = 24 * 60 * 60 * 1000
const STATUS_PUTUSAN = ['Sesuai', 'Direvisi', 'Bukan Unit Kami', 'Perlu Perhatian']

function awalPutusan(b) {
  return Date.parse(b[`${KOL}_putusan_pertama`] || b[`${KOL}_pada`]) || 0
}

function dapatDirevisi(b) {
  return STATUS_PUTUSAN.includes(b[`${KOL}_status`])
    && Date.now() - awalPutusan(b) < JENDELA_REVISI_MS
}

function sisaRevisi(b) {
  const jam = Math.max(0, Math.ceil((awalPutusan(b) + JENDELA_REVISI_MS - Date.now()) / 3600000))
  return jam > 1 ? `${jam} jam lagi` : 'kurang dari 1 jam lagi'
}

/* ------------------------------------------------------------------ bagian */

function kemajuan(sisa, awal) {
  const selesai = Math.max(awal - sisa, 0)
  const bagian = awal ? Math.round((selesai / awal) * 100) : 0
  return `
    <div class="telaah-kemajuan">
      <div class="telaah-kemajuan-bilah"><i style="width:${bagian}%"></i></div>
      <div class="telaah-kemajuan-teks">
        <span><b>${angka(selesai)}</b> ditelaah sesi ini</span>
        <span>${angka(sisa)} menunggu</span>
      </div>
    </div>`
}

/**
 * Daftar antrean yang bisa digulir dan dilompati.
 *
 * Diminta pada uji petik: menelaah satu per satu lewat "Lewati" menyulitkan
 * ketika yang dicari ada di tengah antrean. Daftar ini menampilkan seluruh
 * antrean sekaligus — berita yang sedang dibuka ditandai — dan menekan salah
 * satunya melompat langsung ke sana tanpa harus melewati yang di depannya.
 */
function daftarAntrean(antrean, aktifId) {
  if (antrean.length < 2) return ''
  return kartu({
    judul: 'Antrean telaah',
    ket: `${angka(antrean.length)} berita menunggu — tekan salah satu untuk melompat ke sana`,
    rapat: true,
    isi: `
      <ol class="telaah-daftar" style="list-style:none;margin:0;padding:0;max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:4px">
        ${antrean.map((b, i) => `
          <li>
            <button type="button" data-ke-nomor="${i}"
              style="width:100%;text-align:left;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;border:1px solid ${b.id === aktifId ? 'var(--aksen,#5ed6c4)' : 'var(--garis,transparent)'};background:${b.id === aktifId ? 'color-mix(in srgb, var(--aksen,#5ed6c4) 12%, transparent)' : 'transparent'};cursor:pointer;color:inherit">
              <span style="opacity:.55;min-width:22px;font-variant-numeric:tabular-nums">${i + 1}.</span>
              ${keping(b.urgensi || '—', nadaUrgensi(b.urgensi), true)}
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${amankan(ringkas(b.judul || 'Tanpa judul', 90))}</span>
              <span class="mini-teks samar-teks" style="flex-shrink:0">${amankan(belumTerpetakan(b.nama_upt) ? 'Belum terpetakan' : (b.nama_upt || ''))}</span>
            </button>
          </li>`).join('')}
      </ol>`,
  })
}

/** Penilaian mesin, ditampilkan apa adanya beserta dasarnya. */
function panelMesin(b) {
  const yakin = Number(b.ai_confidence) || 0
  const cukup = yakin >= KONFIG.ambangKeyakinan
  const kunci = Array.isArray(b.kata_kunci) ? b.kata_kunci : []

  return `
    <div class="mesin-panel">
      <div class="mesin-kop">
        <span class="label-mono">Penilaian mesin</span>
        <span class="mesin-yakin" data-cukup="${cukup}">${(yakin * 100).toFixed(0)}% yakin</span>
      </div>

      <div class="mesin-nilai">
        <div><dt>Kategori</dt><dd>${amankan(b.kategori || '—')}</dd></div>
        <div><dt>Subkategori</dt><dd>${amankan(b.subkategori || '—')}</dd></div>
        <div><dt>Sentimen</dt><dd>${keping(b.sentimen || '—', nadaSentimen(b.sentimen))}</dd></div>
        <div><dt>Urgensi</dt><dd>${keping(b.urgensi || '—', nadaUrgensi(b.urgensi))}</dd></div>
      </div>

      ${kunci.length ? `
        <div class="mesin-kunci">
          <span class="label-mono">Kata kunci penentu</span>
          <div>${kunci.map((k) => `<span class="kunci-keping">${amankan(k)}</span>`).join('')}</div>
        </div>` : ''}

      ${b.ai_alasan ? `<p class="mesin-alasan">${amankan(b.ai_alasan)}</p>` : ''}

      ${!cukup ? pesanSistem(
        `<b>Di bawah ambang ${persen(KONFIG.ambangKeyakinan, 1, 0)}.</b>
         Mesin sendiri menandai hasil ini sebagai perlu diperiksa.`, 'sedang', 'info') : ''}

      ${/*
        Status pusat ikut ditampilkan, tetapi sebagai keterangan — bukan sebagai
        sesuatu yang bisa disentuh dari sini. Penelaah daerah berhak tahu apakah
        pusat sudah memutuskan; ia hanya tidak berhak memutuskannya.
      */''}
      <div class="mesin-kaki">
        <span class="label-mono">Status di pusat</span>
        ${keping(b.status_verifikasi || 'Belum Ditelaah', nadaStatus(b.status_verifikasi), true)}
      </div>
    </div>`
}

/** Formulir revisi penilaian mesin. */
function panelRevisi(b) {
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
        <label for="w-sub">Subkategori yang benar</label>
        <select class="pilihan penuh" id="w-sub">
          ${pilihanSub}
          <option value="0.1"${b.subkategori_kode === '0.1' ? ' selected' : ''}>0.1 Belum Dikelompokkan</option>
          <option value="9.1"${b.subkategori_kode === '9.1' ? ' selected' : ''}>9.1 Unit Non-Pemasyarakatan</option>
          <option value="9.2"${b.subkategori_kode === '9.2' ? ' selected' : ''}>9.2 Konten Tidak Relevan</option>
        </select>
        <div class="ket">Kategori induknya ikut menyesuaikan sendiri.</div>
      </div>

      <fieldset class="pilih-sentimen">
        <legend>Sentimen</legend>
        <div class="pilih-deret">
          ${EMBER.map((e) => `
            <label class="pilih-kartu" data-nada="${e.nada}">
              <input type="radio" name="w-sentimen" value="${e.kode}"${ember(b) === e.kode ? ' checked' : ''}>
              <span class="pilih-isi">
                <span class="pilih-judul">${amankan(e.label)}
                  <span class="pilih-ringkas">${amankan(e.ringkas)}</span></span>
                <span class="pilih-ket">${amankan(e.keterangan)}</span>
              </span>
            </label>`).join('')}
        </div>
      </fieldset>

      <div class="isian">
        <label for="w-urgensi">Urgensi</label>
        <select class="pilihan penuh" id="w-urgensi">
          ${URGENSI.map((s) => `<option${s === b.urgensi ? ' selected' : ''}>${s}</option>`).join('')}
        </select>
      </div>

      <div class="isian">
        <label for="w-catatan">Alasan revisi <span class="wajib">wajib</span></label>
        <textarea class="masukan" id="w-catatan" rows="3"
          placeholder="Apa yang keliru dari penilaian mesin, dan atas dasar apa?">${amankan(b[`${KOL}_catatan`] || '')}</textarea>
        <div class="ket">
          Catatan ini dibaca analis pusat sebelum ia memutuskan, dan dipakai memperbaiki mesin.
          Menuliskan “salah” tanpa menyebut apa yang salah tidak menolong siapa pun.
        </div>
      </div>
    </div>`
}

/** Formulir tanggapan resmi unit. Hanya untuk peran yang cakupannya satu unit. */
function panelTanggapan(b) {
  return `
    <div class="koreksi-panel">
      ${pesanSistem(
        '<b>Tanggapan ini terbaca kantor wilayah dan analis pusat.</b> Ia tidak mengubah '
        + 'angka mana pun; ia menyertakan sikap resmi unit pada berita yang bersangkutan.',
        'netral', 'info')}

      <fieldset class="pilih-sentimen">
        <legend>Sikap unit atas berita ini</legend>
        <div class="pilih-deret">
          ${SIKAP_TANGGAPAN.map((s) => `
            <label class="pilih-kartu" data-nada="${s.nada}">
              <input type="radio" name="w-sikap" value="${amankan(s.kode)}"${b.tanggapan_sikap === s.kode ? ' checked' : ''}>
              <span class="pilih-isi">
                <span class="pilih-judul">${amankan(s.kode)}</span>
                <span class="pilih-ket">${amankan(s.ket)}</span>
              </span>
            </label>`).join('')}
        </div>
      </fieldset>

      <div class="isian">
        <label for="w-tanggapan">Uraian tanggapan <span class="wajib">wajib</span></label>
        <textarea class="masukan" id="w-tanggapan" rows="4"
          placeholder="Keadaan sebenarnya menurut unit, dan tindakan yang sudah atau akan diambil."
          >${amankan(b.tanggapan_upt || '')}</textarea>
        <div class="ket">
          Tulislah yang dapat dipertanggungjawabkan. Tanggapan ini tersimpan bersama beritanya
          dan tidak dapat dihapus dari ruang ini.
        </div>
      </div>
    </div>`
}

/** Tanggapan yang sudah pernah ditulis, ditampilkan apa adanya. */
function tanggapanTersimpan(b) {
  if (!b.tanggapan_sikap && !b.tanggapan_upt) return ''
  const nada = SIKAP_TANGGAPAN.find((s) => s.kode === b.tanggapan_sikap)?.nada || 'netral'
  return `
    <div class="tanggapan-tersimpan">
      <div class="baris gap-6">
        <span class="label-mono">Tanggapan unit</span>
        ${b.tanggapan_sikap ? keping(b.tanggapan_sikap, nada, true) : ''}
        <span class="mini-teks samar-teks">
          ${amankan(b.tanggapan_oleh || '')}${b.tanggapan_pada ? ` · ${amankan(jarakWaktu(b.tanggapan_pada))}` : ''}
        </span>
      </div>
      ${b.tanggapan_upt ? `<p class="mini-teks">${amankan(b.tanggapan_upt)}</p>` : ''}
    </div>`
}

/* ----------------------------------------------------------------- halaman */

export function halamanWilayahTelaah({ keadaan, isi }) {
  const peran = keadaan.profil?.role
  const unit = adalahUnit(peran)
  UNIT = unit
  KOL = lapisTelaah(unit)
  const bolehTanggapi = punyaIzin(peran, 'tanggapi_berita_unit')
  const nama = unit
    ? (keadaan.profil?.assigned_upt || null)
    : (keadaan.profil?.assigned_kanwil || null)

  /*
     Himpunan dasarnya sama dengan yang dipakai seluruh angka lain — berita di
     luar lingkup dan yang sudah dikecualikan tidak pernah masuk antrean. Tidak
     ada gunanya meminta sebuah lapas menelaah unggahan berbahasa asing yang
     kebetulan memuat kata "lapas".
  */
  const semua = dasar(keadaan.berita || [])
  const awal = susunAntrean(semua).length + keadaanTelaah.selesai.size

  function beritaSekarang() {
    const antrean = susunAntrean(semua)
    return antrean[Math.min(keadaanTelaah.nomor, Math.max(0, antrean.length - 1))]
  }

  /** Daftar putusan yang masih boleh direvisi. Tampil di atas antrean. */
  function kartuRevisi() {
    const daftar = semua.filter(dapatDirevisi)
    if (!daftar.length) return ''
    return kartu({
      judul: 'Dapat direvisi (24 jam)',
      ket: `${angka(daftar.length)} putusan masih bisa diubah`,
      rapat: true,
      isi: `
        <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px">
          ${daftar.map((b) => `
            <li style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
              <span>${amankan(ringkas(b.judul || '(tanpa judul)', 90))}
                <span class="mini-teks samar-teks">· ${amankan(b[`${KOL}_status`])} · ${amankan(sisaRevisi(b))}</span></span>
              <button type="button" class="tbl kecil" data-revisi-id="${amankan(b.id)}">Revisi penilaian</button>
            </li>`).join('')}
        </ul>`,
    })
  }

  /** Tampilan khusus revisi untuk satu berita yang sudah diputuskan. */
  function tampilRevisi(b) {
    return `
      <div class="tumpuk">
        ${kartu({
          judul: 'Revisi penilaian',
          ket: `Putusan saat ini: ${amankan(b[`${KOL}_status`])} · boleh direvisi ${amankan(sisaRevisi(b))}`,
          isi: `
            <article class="telaah-berita">
              <h3>${amankan(b.judul || '(tanpa judul)')}</h3>
              ${b.ringkasan ? `<p class="telaah-ringkas">${amankan(ringkas(b.ringkasan, 600))}</p>` : ''}
            </article>
            <div class="kisi kisi-utama-samping" style="margin-top:16px">
              ${panelMesin(b)}
              <div>${panelRevisi(b)}</div>
            </div>`,
        })}
        <div class="telaah-aksi">
          ${tombol({ label: 'Simpan revisi', ikon: 'centang', gaya: 'utama', aksi: 'simpan-revisi-24', nonaktif: keadaanTelaah.sibuk })}
          ${tombol({ label: 'Batal', aksi: 'batal-revisi' })}
        </div>
      </div>`
  }

  function gambar() {
    if (keadaanTelaah.revisiId) {
      const r = semua.find((x) => x.id === keadaanTelaah.revisiId)
      if (r && dapatDirevisi(r)) { isi.innerHTML = tampilRevisi(r); return }
      keadaanTelaah.revisiId = null
    }
    const antrean = susunAntrean(semua)
    const b = beritaSekarang()

    if (!nama) {
      isi.innerHTML = kartu({
        isi: pesanSistem(
          `<b>Akun Anda belum ditetapkan ${unit ? 'unitnya' : 'kantor wilayahnya'}.</b> `
          + 'Selama itu belum diisi administrator, tidak ada satu baris pun yang sampai ke '
          + 'layar ini — bukan karena tidak ada beritanya, melainkan karena basis data belum '
          + 'tahu berita mana yang menjadi urusan Anda. Hubungi administrator Anda.',
          'kritis', 'peringatan'),
      })
      return
    }

    if (!antrean.length) {
      isi.innerHTML = `<div class="tumpuk">
        ${kemajuan(0, Math.max(awal, 1))}
        ${kartuRevisi()}
        ${kartu({
          isi: kosong(
            'Antrean telaah kosong',
            keadaanTelaah.selesai.size
              ? `${angka(keadaanTelaah.selesai.size)} berita selesai ditelaah pada sesi ini. `
                + 'Tidak ada lagi yang menunggu putusan Anda.'
              : `Setiap berita ${unit ? 'unit' : 'wilayah'} Anda sudah pernah ditelaah. `
                + 'Berita baru akan muncul di sini begitu masuk.',
            tombol({
              label: unit ? 'Lihat berita unit' : 'Lihat berita wilayah',
              ikon: 'berita', gaya: 'utama', halaman: 'wilayah-berita',
            }),
          ),
        })}
        ${rekap()}
      </div>`
      return
    }

    const sudahTanggap = Boolean(b.tanggapan_sikap || b.tanggapan_upt)

    isi.innerHTML = `
      <div class="tumpuk">
        ${kemajuan(antrean.length, Math.max(awal, 1))}
        ${kartuRevisi()}

        ${daftarAntrean(antrean, b.id)}

        ${kartu({
          judul: 'Berita yang ditelaah',
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
                  belumTerpetakan(b.nama_upt)
                    ? '<span class="kritis-teks">unit belum dipetakan</span>'
                    : amankan(b.nama_upt),
                  b.tanggal_publikasi ? amankan(tanggalJam(b.tanggal_publikasi)) : amankan(jarakWaktu(b.created_at)),
                  b.link ? amankan(asalTautan(b.link)) : '',
                ].filter(Boolean).join(' <span class="pemisah">·</span> ')}
              </div>
              ${b.ringkasan ? `<p class="telaah-ringkas">${amankan(ringkas(b.ringkasan, 600))}</p>` : ''}
              ${tanggapanTersimpan(b)}
            </article>

            <div class="kisi kisi-utama-samping" style="margin-top:16px">
              ${panelMesin(b)}
              <div>
                ${keadaanTelaah.panel === 'revisi' ? panelRevisi(b)
                  : keadaanTelaah.panel === 'tanggapan' ? panelTanggapan(b)
                  : tuntunan()}
              </div>
            </div>`,
        })}

        ${keadaanTelaah.panel === null ? `
          <div class="telaah-urgensi" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px">
            <span class="label-mono">Atur tingkat urgensi</span>
            <div class="segmen" data-peran="atur-urgensi">
              ${URGENSI.map((u) => `<button type="button" data-urgensi="${amankan(u)}" aria-pressed="${b.urgensi === u}">${amankan(u)}</button>`).join('')}
            </div>
            <span class="mini-teks samar-teks">Tercatat atas nama Anda; tidak mengeluarkan berita dari antrean.</span>
          </div>` : ''}

        <div class="telaah-aksi">
          ${keadaanTelaah.panel === 'revisi'
            ? `${tombol({ label: 'Simpan revisi', ikon: 'centang', gaya: 'utama', aksi: 'simpan-revisi', nonaktif: keadaanTelaah.sibuk })}
               ${tombol({ label: 'Batal', aksi: 'batal-panel' })}`
            : keadaanTelaah.panel === 'tanggapan'
              ? `${tombol({ label: 'Simpan tanggapan', ikon: 'centang', gaya: 'utama', aksi: 'simpan-tanggapan', nonaktif: keadaanTelaah.sibuk })}
                 ${tombol({ label: 'Batal', aksi: 'batal-panel' })}`
              : `${tombol({ label: 'Sudah sesuai', ikon: 'centang', gaya: 'utama', aksi: 'putus-Sesuai', nonaktif: keadaanTelaah.sibuk })}
                 ${tombol({ label: 'Revisi penilaian', ikon: 'saring', aksi: 'revisi' })}
                 ${tombol({ label: 'Bukan unit kami', ikon: 'tutup', aksi: 'putus-Bukan Unit Kami' })}
                 ${tombol({ label: 'Perlu perhatian', ikon: 'peringatan', gaya: 'bahaya', aksi: 'putus-Perlu Perhatian' })}
                 ${bolehTanggapi ? tombol({
                     label: sudahTanggap ? 'Ubah tanggapan' : 'Tulis tanggapan',
                     ikon: 'berita', aksi: 'tanggapan',
                   }) : ''}
                 <span class="dorong"></span>
                 ${tombol({ label: 'Lewati', ikon: 'panahKanan', gaya: 'samar', aksi: 'lewati' })}`}
        </div>

        ${rekap()}
      </div>`
  }

  function tuntunan() {
    return `
      <div class="telaah-tuntun">
        <p>Bacalah judul dan penilaian mesin di sebelah kiri, lalu nyatakan putusan
        ${unit ? 'unit' : 'wilayah'} Anda.</p>
        <ul>
          ${TELAAH_WILAYAH.map((t) => `<li><b>${amankan(t.kode)}</b> — ${amankan(t.ket)}</li>`).join('')}
        </ul>
        <p class="ket">
          Putusan Anda tidak mengubah status di pusat. Ia tercatat berdampingan dengan
          putusan analis pusat, dan terbaca sebelum pusat memutuskan.
        </p>
        ${bolehTanggapi ? `<p class="ket">
          <b>Tanggapan</b> berbeda dari telaah: telaah menilai penilaian mesin,
          tanggapan menyatakan sikap unit atas isi beritanya.</p>` : ''}
      </div>`
  }

  function rekap() {
    const isiRekap = Object.entries(keadaanTelaah.putusan)
      .filter(([, n]) => n > 0)
      .map(([kode, n]) => {
        const nada = TELAAH_WILAYAH.find((t) => t.kode === kode)?.nada || 'netral'
        return `<span>${keping(`${n} ${kode.toLowerCase()}`, nada)}</span>`
      })
    if (keadaanTelaah.ditanggapi) {
      isiRekap.push(`<span>${keping(`${keadaanTelaah.ditanggapi} ditanggapi`, 'aksen')}</span>`)
    }
    return isiRekap.length ? `<div class="telaah-rekap">${isiRekap.join('')}</div>` : ''
  }

  /* ---------------------------------------------------------- keputusan */

  /**
   * Menuliskan putusan.
   *
   * Perubahan diterapkan lebih dulu pada salinan di peramban, lalu dikirim ke
   * peladen. Kalau peladen menolak, salinannya dikembalikan — antrean tidak
   * boleh menunjukkan sesuatu yang sebenarnya tidak tersimpan.
   */
  async function tulis(b, isian, kabar, { keluarAntrean = true } = {}) {
    if (keadaanTelaah.sibuk) return false
    keadaanTelaah.sibuk = true

    const sebelum = { ...b }
    Object.assign(b, isian)
    if (keluarAntrean) {
      keadaanTelaah.selesai.add(b.id)
      keadaanTelaah.nomor = 0
    }
    keadaanTelaah.panel = null
    gambar()
    document.dispatchEvent(new CustomEvent('hitung-ulang'))

    if (keadaan.demo) {
      roti(`${kabar} (mode peragaan, tidak disimpan)`, 'sedang')
      keadaanTelaah.sibuk = false
      return true
    }

    try {
      await perbarui('berita', { id: `eq.${b.id}` }, isian)
      roti(kabar, 'positif')
      return true
    } catch (galat) {
      Object.assign(b, sebelum)
      keadaanTelaah.selesai.delete(b.id)
      roti(pesanRamah(galat), 'kritis', 7000)
      gambar()
      return false
    } finally {
      keadaanTelaah.sibuk = false
    }
  }

  /** Penanda putusan yang selalu ikut, apa pun putusannya. */
  function jejak() {
    return {
      [`${KOL}_oleh`]: keadaan.profil?.username || keadaan.profil?.full_name || null,
      [`${KOL}_pada`]: new Date().toISOString(),
    }
  }

  async function putuskan(kode) {
    const b = beritaSekarang()
    if (!b || !PUTUSAN_LANGSUNG.includes(kode)) return

    /*
       "Bukan unit kami" ditanyakan ulang. Putusan itu berarti sebuah berita
       dilepaskan dari daftar tanggung jawab unit ini, dan bila keliru, berita
       itu tidak akan pernah ditelaah siapa pun di daerah — pusat mengiranya
       sudah ditangani daerah, daerah mengiranya bukan urusannya.
    */
    if (kode === 'Bukan Unit Kami') {
      const ya = await konfirmasi({
        judul: 'Nyatakan bukan urusan unit ini?',
        pesan: `“${ringkas(b.judul, 80)}” akan tercatat sebagai berita yang tidak menyangkut `
          + `${nama}. Analis pusat membaca putusan ini saat menelaah.`,
        tegas: 'Ya, bukan urusan kami',
      })
      if (!ya) return
    }

    keadaanTelaah.putusan[kode] += 1
    await tulis(b, {
      [`${KOL}_status`]: kode,
      ...jejak(),
    }, `Putusan “${kode}” tersimpan.`)
  }

  async function simpanRevisi() {
    const dariRevisi = keadaanTelaah.revisiId
    const b = dariRevisi ? semua.find((x) => x.id === dariRevisi) : beritaSekarang()
    if (!b) return

    const kode = isi.querySelector('#w-sub')?.value
    const sub = SEMUA_SUBKATEGORI.find((s) => s.kode === kode)
    const catatan = isi.querySelector('#w-catatan')?.value.trim() || ''
    const emberDipilih = isi.querySelector('input[name="w-sentimen"]:checked')?.value || ember(b)

    if (!catatan) {
      roti('Sebutkan apa yang keliru. Revisi tanpa alasan tidak bisa dibaca siapa pun.', 'sedang', 5000)
      isi.querySelector('#w-catatan')?.focus()
      return
    }

    const luar = kode === '9.1' || kode === '9.2'
    keadaanTelaah.putusan.Direvisi += 1
    keadaanTelaah.revisiId = null

    await tulis(b, {
      subkategori_kode: kode,
      subkategori: sub ? sub.nama : (kode === '0.1' ? 'Belum Dikelompokkan' : 'Konten Tidak Relevan'),
      kategori: sub ? sub.kategoriNama : (luar ? 'Di Luar Lingkup' : 'Lainnya'),
      // Nilai yang ditulis ditentukan lib/sentimen.js: memilih "Netral/Campuran"
      // pada berita yang memang dinilai mesin sebagai Campuran tidak menghapus
      // nilai itu.
      sentimen: nilaiSimpan(emberDipilih, b.sentimen),
      urgensi: isi.querySelector('#w-urgensi')?.value,
      [`${KOL}_status`]: 'Direvisi',
      [`${KOL}_catatan`]: catatan,
      ...jejak(),
    }, 'Revisi tersimpan.', { keluarAntrean: !dariRevisi })
  }

  /**
   * Menyimpan tanggapan unit.
   *
   * Tidak mengeluarkan beritanya dari antrean. Tanggapan bukan putusan telaah:
   * sebuah berita yang sudah ditanggapi tetap perlu dinyatakan apakah penilaian
   * mesinnya sudah tepat, dan menggabungkan keduanya berarti satu di antaranya
   * diam-diam terlewat.
   */
  async function simpanTanggapan() {
    const b = beritaSekarang()
    if (!b) return

    const teks = isi.querySelector('#w-tanggapan')?.value.trim() || ''
    const sikap = isi.querySelector('input[name="w-sikap"]:checked')?.value || ''

    if (!sikap) {
      roti('Pilih dulu sikap unit atas berita ini.', 'sedang')
      return
    }
    if (!teks) {
      roti('Uraian tanggapan wajib diisi. Sikap tanpa uraian tidak bisa ditindaklanjuti.', 'sedang', 5000)
      isi.querySelector('#w-tanggapan')?.focus()
      return
    }

    const baru = !b.tanggapan_upt
    const berhasil = await tulis(b, {
      tanggapan_upt: teks,
      tanggapan_sikap: sikap,
      tanggapan_oleh: keadaan.profil?.username || keadaan.profil?.full_name || null,
      tanggapan_pada: new Date().toISOString(),
    }, 'Tanggapan unit tersimpan.', { keluarAntrean: false })

    if (berhasil && baru) keadaanTelaah.ditanggapi += 1
  }

  /**
   * Instrumen urgensi: mengatur tingkat urgensi dalam satu tekan.
   *
   * Berbeda dari "Revisi penilaian" yang menuntut kategori dan alasan — ini
   * khusus untuk menaikkan/menurunkan urgensi berita (terutama yang negatif)
   * dengan cepat. Perubahannya tetap tercatat (siapa dan kapan) dan tidak
   * mengeluarkan berita dari antrean telaah.
   */
  async function aturUrgensi(nilai) {
    const b = beritaSekarang()
    if (!b || !URGENSI.includes(nilai) || b.urgensi === nilai) return
    await tulis(b, { urgensi: nilai, ...jejak() }, `Urgensi diatur ke “${nilai}”.`, { keluarAntrean: false })
  }

  function lewati() {
    const antrean = susunAntrean(semua)
    keadaanTelaah.nomor = (keadaanTelaah.nomor + 1) % Math.max(antrean.length, 1)
    keadaanTelaah.panel = null
    gambar()
  }

  /* ------------------------------------------------------------ penyimak */

  isi.addEventListener('click', (ev) => {
    // Lompatan dari daftar antrean: pindah ke nomor itu, tutup panel yang
    // mungkin terbuka, lalu gambar ulang.
    const ke = ev.target.closest('[data-ke-nomor]')
    if (ke) {
      keadaanTelaah.nomor = Number(ke.dataset.keNomor) || 0
      keadaanTelaah.panel = null
      gambar()
      return
    }

    const urg = ev.target.closest('[data-urgensi]')
    if (urg) { aturUrgensi(urg.dataset.urgensi); return }

    const buka = ev.target.closest('[data-revisi-id]')
    if (buka) {
      keadaanTelaah.revisiId = buka.dataset.revisiId
      keadaanTelaah.panel = null
      gambar()
      isi.querySelector('#w-sub')?.focus()
      return
    }

    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (!aksi) return

    if (aksi.startsWith('putus-')) putuskan(aksi.slice(6))
    else if (aksi === 'revisi') { keadaanTelaah.panel = 'revisi'; gambar(); isi.querySelector('#w-sub')?.focus() }
    else if (aksi === 'tanggapan') { keadaanTelaah.panel = 'tanggapan'; gambar(); isi.querySelector('#w-tanggapan')?.focus() }
    else if (aksi === 'batal-panel') { keadaanTelaah.panel = null; gambar() }
    else if (aksi === 'simpan-revisi' || aksi === 'simpan-revisi-24') simpanRevisi()
    else if (aksi === 'batal-revisi') { keadaanTelaah.revisiId = null; gambar() }
    else if (aksi === 'simpan-tanggapan') simpanTanggapan()
    else if (aksi === 'lewati') lewati()
  })

  /*
     Pintasan papan tik, dengan alasan yang sama seperti di antrean pusat:
     antrean panjang dikerjakan dengan satu tangan di papan tik. Tidak berlaku
     saat sedang mengetik, supaya huruf "s" pada catatan revisi tidak diam-diam
     menyatakan sebuah berita sudah sesuai.
  */
  function pintasan(ev) {
    if (!isi.isConnected) { document.removeEventListener('keydown', pintasan); return }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return
    if (ev.target.matches('input, textarea, select')) return
    if (document.querySelector('.tirai, .palet-tirai')) return

    const k = ev.key.toLowerCase()
    if (k === 's') { ev.preventDefault(); putuskan('Sesuai') }
    else if (k === 'r') { ev.preventDefault(); keadaanTelaah.panel = 'revisi'; gambar(); isi.querySelector('#w-sub')?.focus() }
    else if (k === 'b') { ev.preventDefault(); putuskan('Bukan Unit Kami') }
    else if (k === 'p') { ev.preventDefault(); putuskan('Perlu Perhatian') }
    else if (k === 't' && bolehTanggapi) { ev.preventDefault(); keadaanTelaah.panel = 'tanggapan'; gambar(); isi.querySelector('#w-tanggapan')?.focus() }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); lewati() }
  }
  document.addEventListener('keydown', pintasan)

  gambar()

  return {
    judul: unit ? 'Telaah & Tanggapan' : 'Telaah Wilayah',
    sub: nama
      ? `${nama} · memeriksa penilaian mesin sebelum dibaca pusat`
      : (unit ? 'Unit belum ditetapkan' : 'Wilayah belum ditetapkan'),
  }
}
