/**
 * Lapor Langsung — kanal masukan intelijen dari lapangan.
 *
 * Berbeda dari Input Berita (yang menyalin publikasi perayap maupun manual).
 * Lapor Langsung dipakai petugas untuk menyetor bukti pemantauan siber:
 * screenshot, foto, atau PDF gabungan — disertai penjelasan isi.
 *
 * Konteks unit disesuaikan peran, supaya pelapor tidak menulis apa yang sudah
 * bisa disimpulkan dari profilnya:
 *
 *   UPT          — nama_upt dan kanwil otomatis ter-isi dari profil.
 *   Kanwil       — kanwil otomatis; UPT dipilih dari daftar unit di wilayahnya.
 *   Pusat        — Kanwil dan UPT dipilih dari daftar lengkap.
 *
 * Berkasnya ditaruh di bucket privat `lapor-langsung`; metadata di tabel
 * `lapor_langsung`. Mirror ke Google Drive dijahit terpisah sebagai pekerjaan
 * latar belakang, tanpa mengubah bentuk halaman ini.
 */

import { kartu, tombol, pesanSistem, roti, kosong } from '../ui/komponen.js'
import { amankan, ukuranBerkas } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, sisip, unggahBerkas, pesanRamah, panggilFungsi } from '../lib/api.js'
import { LEMBAR, ZONA_WAKTU, periksaLaporan, labelPilihan, zonaPeramban } from '../lib/laporan-klarifikasi.js'
import { KONFIG } from '../lib/konfig.js'
import { keadaan } from '../main.js'
import { adalahUnit, adalahEksternal, punyaIzin } from './../lib/peran.js'

const JENIS_GAMBAR = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const JENIS_PDF = ['application/pdf']
const JENIS_DIIZINKAN = [...JENIS_GAMBAR, ...JENIS_PDF]

/**
 * Batas ukuran per jenis berkas. Gambar lebih ketat daripada PDF: satu
 * kejadian siber biasanya cukup dengan satu-dua foto sedang; PDF dipakai
 * ketika bukti dijahit dari banyak halaman sebelum diunggah.
 */
function batasJenis(mime) {
  if (JENIS_PDF.includes(mime)) return KONFIG.batasPdfBita || 10 * 1024 * 1024
  return KONFIG.batasGambarBita || 1 * 1024 * 1024
}

/** Tersimpan satu sesi sehingga perpindahan halaman sejenak tidak mengosongkan isi. */
const keadaanLapor = {
  judul: '',
  keterangan: '',
  kanwilPilih: '',
  uptPilih: '',
  berkas: [],        // File[] yang belum diunggah
  terunggah: [],     // {jalur, nama, mime, ukuran} setelah unggah berhasil
  daftarKanwil: [],
  daftarUpt: [],     // {nama_upt, kanwil}
  memuat: false,
  mengirim: false,
  terakhir: null,    // id laporan terakhir yang berhasil tersimpan

  // Laporan Verifikasi Pemberitaan yang dilampirkan UPT pada laporannya sendiri.
  sertakanVerif: false,
  verif: {},
  verifNama: '',
  verifJabatan: '',

  // Laporan dari kanwil/pusat yang menyebut unit ini, untuk dijawab.
  masuk: null,       // null = belum dimuat
  masukGalat: '',
  masukMemuat: false,
  bukaId: null,      // laporan yang formulir jawabannya sedang terbuka
  jawab: {},         // id -> { isian, nama, jabatan, berkas: File[] }
  menjawab: false,
}

/** Lembar Berita Acara Verifikasi Isu: format resmi yang sama dengan Klarifikasi UPT. */
const LEMBAR_BA = LEMBAR.find((l) => l.id === 'ba')

function waktuLokalSekarang(w = new Date()) {
  return new Date(w.getTime() - w.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function isianBaAwal(l = {}) {
  return {
    waktu_konfirmasi: waktuLokalSekarang(),
    zona: zonaPeramban(),
    ringkasan_isu: l.judul || String(l.keterangan || '').slice(0, 300),
    sumber: '',
    waktu_ditemukan: l.created_at ? new Date(l.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB' : '',
    pihak: '', pihak_nama: '', pihak_jabatan: '',
    hasil_konfirmasi: '', fakta: '', dampak: '', tingkat: '', rekomendasi: '', petugas_nama: '',
  }
}

/** Hanya kunci lembar BA yang dikirim, dipangkas. */
function bersihkanBa(d) {
  const hasil = { format: 'ba-verifikasi-isu-v1' }
  for (const k of [...LEMBAR_BA.bidang.map((b) => b.k), 'zona']) {
    const v = String(d?.[k] ?? '').trim().slice(0, 4000)
    if (v) hasil[k] = v
  }
  return hasil
}

/**
 * Bidang-bidang Berita Acara. `kunci` membedakan formulir mana yang diisi:
 * 'sendiri' untuk laporan UPT sendiri, atau id laporan yang sedang dijawab.
 */
function isianBa(d, kunci) {
  const atr = (k, kelas = 'masukan') => `class="${kelas}" data-verif="${k}" data-kunci="${amankan(kunci)}"`
  const masukan = (b) => {
    const nilai = d[b.k] || ''
    if (b.jenis === 'area') return `<textarea ${atr(b.k, 'masukan area')} rows="${b.baris || 2}" maxlength="4000">${amankan(nilai)}</textarea>`
    if (b.jenis === 'pilih') {
      const opsi = Array.isArray(b.pilihan) ? b.pilihan.map((x) => [x, x]) : Object.entries(b.pilihan)
      return `<select ${atr(b.k)}><option value="">— pilih —</option>${opsi.map(([k, l]) =>
        `<option value="${amankan(k)}"${k === nilai ? ' selected' : ''}>${amankan(l)}</option>`).join('')}</select>`
    }
    if (b.jenis === 'waktu') {
      return `<span class="baris" style="gap:6px"><input ${atr(b.k)} type="datetime-local" value="${amankan(nilai)}">
        <select ${atr('zona')} style="width:90px" aria-label="Zona waktu">${ZONA_WAKTU.map((z) =>
          `<option${z === d.zona ? ' selected' : ''}>${z}</option>`).join('')}</select></span>`
    }
    return `<input ${atr(b.k)} maxlength="300" value="${amankan(nilai)}">`
  }
  return `
    <fieldset class="laporan-lembar">
      <legend>${amankan(LEMBAR_BA.judul)}</legend>
      <div class="ket">${amankan(LEMBAR_BA.ket)}</div>
      <div class="laporan-kisi">
        ${LEMBAR_BA.bidang.map((b) => `
          <label class="bidang${b.jenis === 'area' ? ' lebar' : ''}">
            <span class="label-mono">${amankan(b.label)}${b.wajib ? ' (wajib)' : ''}</span>
            ${masukan(b)}
          </label>`).join('')}
      </div>
    </fieldset>`
}

function isianPengirim(nama, jabatan, kunci) {
  return `
    <div class="kisi kisi-2">
      <div class="isian">
        <label>Nama pengirim verifikasi <span class="wajib">wajib</span></label>
        <input class="masukan" data-verif-pengirim="nama" data-kunci="${amankan(kunci)}" maxlength="120" value="${amankan(nama)}" placeholder="Nama lengkap">
      </div>
      <div class="isian">
        <label>Jabatan</label>
        <input class="masukan" data-verif-pengirim="jabatan" data-kunci="${amankan(kunci)}" maxlength="120" value="${amankan(jabatan)}" placeholder="mis. Kepala KPLP">
      </div>
    </div>`
}

function bagianVerifSendiri() {
  const v = keadaanLapor
  return `
    <div class="isian">
      <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer">
        <input type="checkbox" data-aksi-cek="sertakan-verif"${v.sertakanVerif ? ' checked' : ''} style="margin-top:3px">
        <span><b>Sertakan Laporan Verifikasi Pemberitaan</b><br>
        <span class="ket">Isi bila temuan ini sudah Anda konfirmasi kebenarannya di unit. Formatnya sama dengan Berita Acara Verifikasi Isu pada Klarifikasi UPT.</span></span>
      </label>
    </div>
    ${v.sertakanVerif ? `${isianBa(v.verif, 'sendiri')}${isianPengirim(v.verifNama, v.verifJabatan, 'sendiri')}` : ''}`
}

// ------------------------------------------------- laporan masuk untuk unit

async function muatMasuk() {
  if (keadaanLapor.masukMemuat) return
  const profil = keadaan.profil
  const peran = profil?.role
  keadaanLapor.masukMemuat = true
  keadaanLapor.masukGalat = ''
  try {
    const saring = {
      select: 'id,created_at,pelapor_nama,pelapor_role,pelapor_user_id,kanwil,nama_upt,judul,keterangan,berkas,drive_url,status,'
        + 'verifikasi,verifikasi_nama,verifikasi_jabatan,verifikasi_pada,verifikasi_berkas,verifikasi_drive_url',
      order: 'created_at.desc',
      limit: 50,
    }
    if (profil?.auth_user_id) saring.pelapor_user_id = `neq.${profil.auth_user_id}`
    if (adalahUnit(peran)) saring.nama_upt = `eq.${profil?.assigned_upt || '-'}`
    else if (profil?.assigned_kanwil) saring.kanwil = `eq.${profil.assigned_kanwil}`
    keadaanLapor.masuk = await ambil('lapor_langsung', saring) || []
  } catch (galat) {
    keadaanLapor.masuk = []
    keadaanLapor.masukGalat = galat?.rinci?.code === '42703'
      ? 'Fitur verifikasi menunggu pembaruan basis data oleh administrator pusat.'
      : pesanRamah(galat)
  } finally {
    keadaanLapor.masukMemuat = false
  }
}

function tautanBukti(l, awalan = '') {
  const daftar = [...(l[`${awalan}berkas`] || [])].filter((b) => b?.driveUrl)
  const folder = l[`${awalan}drive_url`]
  if (!daftar.length && !folder) return ''
  return `<div class="baris" style="gap:8px;flex-wrap:wrap">
    ${folder ? `<a class="tbl kecil samar" href="${amankan(folder)}" target="_blank" rel="noopener">${ikon('tautan')} Folder bukti</a>` : ''}
    ${daftar.map((b) => `<a class="tbl kecil samar" href="${amankan(b.driveUrl)}" target="_blank" rel="noopener">${ikon('tautan')} ${amankan(String(b.nama || 'berkas').slice(0, 40))}</a>`).join('')}
  </div>`
}

function ringkasVerif(l) {
  const v = l.verifikasi || {}
  const hasil = labelPilihan(LEMBAR_BA.bidang.find((b) => b.k === 'hasil_konfirmasi'), v.hasil_konfirmasi)
  const tingkat = labelPilihan(LEMBAR_BA.bidang.find((b) => b.k === 'tingkat'), v.tingkat)
  return `
    <div class="pesan" data-nada="positif">${ikon('centang')}
      <div>
        <b>Sudah diverifikasi</b>: ${amankan(hasil || '-')} · tingkat isu ${amankan(tingkat || '-')}<br>
        <span class="ket">${amankan(l.verifikasi_nama || '')}${l.verifikasi_jabatan ? `, ${amankan(l.verifikasi_jabatan)}` : ''}${l.verifikasi_pada ? ` · ${amankan(new Date(l.verifikasi_pada).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }))} WIB` : ''}</span>
        ${v.fakta ? `<div style="margin-top:6px">${amankan(v.fakta)}</div>` : ''}
        ${tautanBukti(l, 'verifikasi_')}
      </div>
    </div>`
}

function formulirJawab(l) {
  const j = keadaanLapor.jawab[l.id]
  const sibuk = keadaanLapor.menjawab
  return `
    <div class="tumpuk" style="gap:12px;margin-top:10px">
      ${isianBa(j.isian, l.id)}
      ${isianPengirim(j.nama, j.jabatan, l.id)}
      <div class="isian">
        <label>Lampiran verifikasi <span class="ket">(opsional · foto maks 1 MB, PDF maks 10 MB)</span></label>
        <input type="file" data-berkas-jawab="${amankan(l.id)}" accept="image/*,application/pdf" multiple hidden>
        <div class="baris" style="gap:8px;flex-wrap:wrap">
          <button type="button" class="tbl kecil" data-aksi="pilih-berkas-jawab" data-id="${amankan(l.id)}">${ikon('tambah')} Tambah lampiran</button>
          ${j.berkas.map((b, i) => `<span class="ket">${amankan(b.name)} (${amankan(ukuranBerkas(b.size))})
            <button type="button" class="tbl kecil samar" data-aksi="hapus-berkas-jawab" data-id="${amankan(l.id)}" data-i="${i}" title="Hapus">${ikon('tutup')}</button></span>`).join('')}
        </div>
      </div>
      <div class="baris" style="justify-content:flex-end;gap:10px">
        <button type="button" class="tbl samar" data-aksi="tutup-jawab" ${sibuk ? 'disabled' : ''}>Batal</button>
        <button type="button" class="tbl utama" data-aksi="kirim-jawab" data-id="${amankan(l.id)}" ${sibuk ? 'disabled' : ''}>
          ${ikon(sibuk ? 'sinkron' : 'kirim')} ${sibuk ? 'Mengirim…' : 'Kirim Laporan Verifikasi'}</button>
      </div>
    </div>`
}

function kartuMasuk(profil) {
  const peran = profil?.role
  if (!adalahUnit(peran) && !adalahEksternal(peran)) return ''
  const v = keadaanLapor
  let isiKartu
  if (v.masuk === null || v.masukMemuat) isiKartu = '<div class="ket">Memuat laporan…</div>'
  else if (v.masukGalat) isiKartu = pesanSistem(amankan(v.masukGalat), 'sedang', 'info')
  else if (!v.masuk.length) {
    isiKartu = `<div class="ket">Belum ada laporan dari ${adalahUnit(peran) ? 'kanwil atau pusat yang menyebut unit Anda' : 'pihak lain untuk UPT di wilayah Anda'}.</div>`
  } else {
    isiKartu = `<div class="tumpuk" style="gap:12px">${v.masuk.map((l) => `
      <div style="border:1px solid var(--surface-3);border-radius:10px;padding:12px 14px">
        <div class="baris" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
          <b>${amankan(l.judul || 'Laporan tanpa judul')}</b>
          <span class="ket">${amankan(new Date(l.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }))} WIB</span>
        </div>
        <div class="ket">${amankan(l.nama_upt || '-')} · dari ${amankan(l.pelapor_nama || 'petugas')}</div>
        <div style="margin:8px 0;white-space:pre-wrap">${amankan(l.keterangan || '')}</div>
        ${tautanBukti(l)}
        ${l.verifikasi ? ringkasVerif(l) : (v.bukaId === l.id ? formulirJawab(l) : `
          <div class="baris" style="justify-content:flex-end;margin-top:8px">
            <button type="button" class="tbl utama kecil" data-aksi="buka-jawab" data-id="${amankan(l.id)}">${ikon('kirim')} Kirim Laporan Verifikasi</button>
          </div>`)}
      </div>`).join('')}</div>`
  }
  return kartu({
    judul: adalahUnit(peran) ? 'Laporan untuk unit Anda' : 'Laporan untuk UPT di wilayah Anda',
    ket: 'Temuan Lapor Langsung dari kanwil atau pusat. Kirim Laporan Verifikasi Pemberitaan sebagai umpan balik.',
    isi: isiKartu,
  })
}

async function muatDaftar() {
  if (keadaanLapor.daftarUpt.length || keadaanLapor.memuat) return
  keadaanLapor.memuat = true
  try {
    const unit = await ambil('upt', {
      select: 'nama_upt,kanwil',
      aktif: 'eq.true',
      limit: 2000,
      order: 'nama_upt.asc',
    }) || []
    keadaanLapor.daftarUpt = unit.filter((u) => u.nama_upt && u.kanwil)
    keadaanLapor.daftarKanwil = [...new Set(keadaanLapor.daftarUpt.map((u) => u.kanwil))].sort()
  } catch (galat) {
    roti(pesanRamah(galat), 'kritis', 6000)
  } finally {
    keadaanLapor.memuat = false
  }
}

function labelPeran(profil) {
  const nama = adalahUnit(profil?.role) ? 'UPT'
    : adalahEksternal(profil?.role) ? 'Kanwil'
      : 'Pusat'
  return `${nama} · ${profil?.full_name || profil?.username || 'Petugas'}`
}

function bidangUnit(profil) {
  const peran = profil?.role
  if (adalahUnit(peran)) {
    return `
      <div class="isian">
        <label>Unit</label>
        <input class="masukan" type="text" value="${amankan(profil?.assigned_upt || '(belum ditetapkan)')}" disabled>
        <div class="ket">Terisi otomatis dari profil Anda. Laporan tercatat atas unit ini.</div>
      </div>`
  }

  if (adalahEksternal(peran)) {
    const wilayah = profil?.assigned_kanwil
    const unitDiWilayah = keadaanLapor.daftarUpt.filter((u) => u.kanwil === wilayah)
    return `
      <div class="isian">
        <label>Kanwil</label>
        <input class="masukan" type="text" value="${amankan(wilayah || '(belum ditetapkan)')}" disabled>
      </div>
      <div class="isian">
        <label for="ll-upt">UPT di wilayah Anda <span class="wajib">wajib</span></label>
        <select class="pilihan" id="ll-upt" data-peran="upt">
          <option value="">— Pilih UPT —</option>
          ${unitDiWilayah.map((u) => `
            <option value="${amankan(u.nama_upt)}"${u.nama_upt === keadaanLapor.uptPilih ? ' selected' : ''}>${amankan(u.nama_upt)}</option>`).join('')}
        </select>
      </div>`
  }

  // Pusat: kanwil + UPT dipilih dari daftar lengkap.
  const unitDiKanwil = keadaanLapor.kanwilPilih
    ? keadaanLapor.daftarUpt.filter((u) => u.kanwil === keadaanLapor.kanwilPilih)
    : []
  return `
    <div class="kisi kisi-2">
      <div class="isian">
        <label for="ll-kanwil">Kanwil <span class="wajib">wajib</span></label>
        <select class="pilihan" id="ll-kanwil" data-peran="kanwil">
          <option value="">${keadaanLapor.daftarKanwil.length ? '— Pilih Kanwil —' : (keadaanLapor.memuat ? 'Memuat daftar…' : '— Pilih Kanwil —')}</option>
          ${keadaanLapor.daftarKanwil.map((k) => `
            <option value="${amankan(k)}"${k === keadaanLapor.kanwilPilih ? ' selected' : ''}>${amankan(k)}</option>`).join('')}
        </select>
      </div>
      <div class="isian">
        <label for="ll-upt">UPT <span class="wajib">wajib</span></label>
        <select class="pilihan" id="ll-upt" data-peran="upt"${unitDiKanwil.length ? '' : ' disabled'}>
          <option value="">${unitDiKanwil.length ? '— Pilih UPT —' : '— Pilih Kanwil dulu —'}</option>
          ${unitDiKanwil.map((u) => `
            <option value="${amankan(u.nama_upt)}"${u.nama_upt === keadaanLapor.uptPilih ? ' selected' : ''}>${amankan(u.nama_upt)}</option>`).join('')}
        </select>
      </div>
    </div>`
}

function daftarBerkas() {
  const diantre = keadaanLapor.berkas
  const sudah = keadaanLapor.terunggah
  if (!diantre.length && !sudah.length) {
    return '<div class="ket">Belum ada berkas dipilih.</div>'
  }
  return `
    <div class="tumpuk" style="gap:6px">
      ${sudah.map((b) => `
        <div class="baris" style="gap:8px;padding:6px 10px;border:1px solid var(--surface-3);border-radius:8px">
          ${ikon('centang')}
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${amankan(b.nama)}</span>
          <span class="ket">${amankan(ukuranBerkas(b.ukuran))} · tersimpan</span>
        </div>`).join('')}
      ${diantre.map((b, i) => `
        <div class="baris" style="gap:8px;padding:6px 10px;border:1px solid var(--surface-3);border-radius:8px">
          ${ikon('tautan')}
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${amankan(b.name)}</span>
          <span class="ket">${amankan(ukuranBerkas(b.size))}</span>
          <button class="tbl kecil samar" type="button" data-aksi="hapus-berkas" data-i="${i}" title="Hapus">${ikon('tutup')}</button>
        </div>`).join('')}
    </div>`
}

function panelHasil() {
  if (!keadaanLapor.terakhir) return ''
  const t = keadaanLapor.terakhir
  return pesanSistem(
    `Laporan tersimpan (ID ${amankan(t.id.slice(0, 8))}). ${amankan(String(t.jumlahBerkas))} berkas tercatat. Analis akan meninjaunya.`,
    'positif', 'centang',
  )
}

function formulir(profil) {
  const sibuk = keadaanLapor.mengirim

  return `
    <form class="tumpuk" style="gap:14px" id="ll-form" novalidate>
      <div class="isian">
        <label>Pelapor</label>
        <input class="masukan" type="text" value="${amankan(labelPeran(profil))}" disabled>
      </div>

      ${bidangUnit(profil)}

      <div class="isian">
        <label for="ll-judul">Judul singkat <span class="ket">(opsional)</span></label>
        <input class="masukan" type="text" id="ll-judul" maxlength="140"
               placeholder="Mis. Akun X menyebarkan hoaks tentang Lapas Y"
               value="${amankan(keadaanLapor.judul)}">
      </div>

      <div class="isian">
        <label for="ll-keterangan">Penjelasan isi bukti <span class="wajib">wajib</span></label>
        <textarea class="masukan area" id="ll-keterangan" rows="5" maxlength="4000"
                  placeholder="Jelaskan isi bukti yang diunggah: apa yang terlihat, kapan dan di mana ditemukan, dugaan dampaknya.">${amankan(keadaanLapor.keterangan)}</textarea>
        <div class="ket">Deskripsikan sejelas mungkin agar analis bisa menilai urgensinya tanpa harus membuka berkas.</div>
      </div>

      ${adalahUnit(profil?.role) ? bagianVerifSendiri() : ''}

      <div class="isian">
        <label>Berkas bukti <span class="wajib">wajib</span></label>
        <div class="ket">Gambar maksimal ${Math.round((KONFIG.batasGambarBita || 1048576) / 1024 / 1024)} MB per berkas · PDF maksimal ${Math.round((KONFIG.batasPdfBita || 10485760) / 1024 / 1024)} MB per berkas. Gabungkan banyak screenshot menjadi satu PDF bila perlu.</div>
        <input type="file" id="ll-berkas" accept="image/*,application/pdf" multiple hidden>
        <input type="file" id="ll-kamera" accept="image/*" capture="environment" hidden>
        <div class="baris" style="gap:8px;flex-wrap:wrap;margin-top:6px">
          <button type="button" class="tbl" data-aksi="pilih-berkas">${ikon('tambah')} Pilih dari galeri</button>
          <button type="button" class="tbl samar" data-aksi="pilih-kamera">${ikon('tambah')} Ambil dari kamera</button>
        </div>
        <div style="margin-top:10px">${daftarBerkas()}</div>
      </div>

      <div class="baris" style="justify-content:flex-end;gap:10px">
        <button type="button" class="tbl samar" data-aksi="reset" ${sibuk ? 'disabled' : ''}>Bersihkan</button>
        <button type="submit" class="tbl utama" ${sibuk ? 'disabled' : ''}>
          ${ikon(sibuk ? 'sinkron' : 'kirim')} ${sibuk ? 'Mengirim…' : 'Kirim Laporan'}
        </button>
      </div>
    </form>`
}

function panduanSisi(profil) {
  const peran = profil?.role
  const barisPeran = adalahUnit(peran)
    ? 'Anda melapor atas unit Anda sendiri, jadi tidak perlu memilih UPT. Bila temuan sudah Anda konfirmasi, centang "Sertakan Laporan Verifikasi Pemberitaan". Laporan dari kanwil atau pusat yang menyebut unit Anda muncul di bawah halaman ini untuk Anda jawab dengan laporan verifikasi.'
    : adalahEksternal(peran)
      ? 'Sebagai admin kanwil, pilih UPT di wilayah Anda yang menjadi obyek laporan. UPT tersebut akan melihat laporan Anda dan dapat mengirim Laporan Verifikasi Pemberitaan sebagai umpan balik.'
      : 'Sebagai operator pusat, pilih kanwil terlebih dahulu, baru UPT yang dilaporkan.'
  const daftar = (butir) => `
      <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
        ${butir.map((b) => `<li>${b}</li>`).join('')}
      </ul>`
  return `
    <div class="tumpuk" style="gap:14px">
      <div class="tumpuk" style="gap:6px">
        <div><b>Apa itu Input Lapor Langsung</b></div>
        <div>Jalur cepat untuk menyetor temuan patroli siber yang tidak tertangkap penjaring berita otomatis. Termasuk di dalamnya pengaduan yang masuk langsung ke akun media sosial resmi UPT atau Kanwil, komentar warganet di postingan akun pimpinan atau instansi, serta unggahan, pesan berantai, dan konten daring lain yang Anda temukan sendiri dan perlu segera diketahui pusat.</div>
      </div>

      <div class="tumpuk" style="gap:6px">
        <div><b>Sasaran yang dilaporkan</b></div>
        ${daftar([
          'Pengaduan masyarakat yang dikirim lewat pesan langsung (DM), komentar, atau tag ke akun Instagram resmi UPT/Kanwil.',
          'Komentar pengguna Instagram di postingan akun pimpinan tinggi atau akun resmi instansi, terutama yang berisi keluhan, tuduhan, atau provokasi.',
          'Unggahan atau siaran langsung dari dalam Lapas/Rutan, termasuk indikasi penggunaan HP ilegal oleh WBP.',
          'Hoaks, fitnah, atau narasi negatif tentang petugas dan unit Pemasyarakatan.',
          'Ajakan atau ancaman kerusuhan, pelarian, dan gangguan keamanan lain.',
          'Indikasi peredaran narkoba atau penipuan yang dikendalikan dari dalam UPT.',
          'Bocornya foto, video, atau dokumen internal ke ruang publik.',
        ])}
      </div>

      <div class="tumpuk" style="gap:6px">
        <div><b>Hasilnya</b></div>
        <div>Laporan tercatat atas nama dan peran Anda, terikat pada UPT dan kanwil yang dipilih. Berkas bukti tersimpan di arsip Google Drive Direktorat, satu folder untuk setiap laporan. Analis pusat menelaahnya dan menentukan apakah temuan itu perlu diangkat menjadi kasus intelijen atau diteruskan sebagai tindak lanjut ke wilayah.</div>
      </div>

      <div class="tumpuk" style="gap:6px">
        <div><b>Bukti yang diunggah</b></div>
        ${daftar([
          'Foto atau screenshot: satu temuan cukup satu-dua gambar, maksimal 1 MB per berkas. Pastikan nama akun, tanggal, dan isi unggahan, pesan, atau komentar terbaca. Untuk komentar, sertakan juga postingan tempat komentar itu muncul.',
          'PDF: bila bukti lebih dari beberapa screenshot, gabungkan menjadi satu PDF, maksimal 10 MB.',
          'Penjelasan: tulis apa yang terlihat, di platform mana dan kapan ditemukan, serta tautannya bila ada.',
        ])}
      </div>

      <div class="ket">${amankan(barisPeran)}</div>
    </div>`
}

/*
   Halaman dipanggil penata halaman di main.js sebagai bangun({ keadaan, isi })
   dan harus sinkron: hasilnya dibaca langsung untuk judul bilah atas. Versi
   pertama (17-18 November 2026) menerima `isi` sebagai argumen tunggal dan
   async, sehingga yang diisi adalah objek pembungkus, bukan wadah layar, dan
   halaman tampil kosong. Daftar UPT kini dimuat di belakang dan formulir
   digambar ulang begitu daftarnya tiba.
*/
export function halamanLaporLangsung({ isi }) {
  if (!punyaIzin(keadaan.profil?.role, 'lapor_langsung')) {
    isi.innerHTML = kartu({
      judul: 'Tidak berhak',
      isi: kosong('Fitur ini tidak tersedia untuk peran Anda', 'Hubungi administrator jika Anda seharusnya memiliki akses.', ''),
    })
    return { judul: 'Input Lapor Langsung', sub: '' }
  }

  function gambar() {
    isi.innerHTML = `
      <div class="kisi kisi-utama-samping">
        ${kartu({
          judul: 'Input Lapor Langsung',
          ket: 'Setor bukti pemantauan siber langsung ke tim analis',
          isi: `${panelHasil()}${formulir(keadaan.profil)}`,
        })}
        ${kartu({ judul: 'Panduan singkat', isi: panduanSisi(keadaan.profil) })}
      </div>
      <div style="margin-top:16px">${kartuMasuk(keadaan.profil)}</div>`
    pasangPenyimak(isi)
  }

  function pasangPenyimak(isi) {
    isi.querySelector('#ll-judul')?.addEventListener('input', (ev) => {
      keadaanLapor.judul = ev.target.value
    })
    isi.querySelector('#ll-keterangan')?.addEventListener('input', (ev) => {
      keadaanLapor.keterangan = ev.target.value
    })
    isi.querySelector('[data-peran="kanwil"]')?.addEventListener('change', (ev) => {
      keadaanLapor.kanwilPilih = ev.target.value
      keadaanLapor.uptPilih = ''
      gambar()
    })
    isi.querySelector('[data-peran="upt"]')?.addEventListener('change', (ev) => {
      keadaanLapor.uptPilih = ev.target.value
    })

    isi.querySelectorAll('[data-aksi]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.preventDefault()
        const aksi = btn.dataset.aksi
        if (aksi === 'pilih-berkas') isi.querySelector('#ll-berkas')?.click()
        else if (aksi === 'pilih-kamera') isi.querySelector('#ll-kamera')?.click()
        else if (aksi === 'hapus-berkas') {
          keadaanLapor.berkas.splice(Number(btn.dataset.i), 1); gambar()
        } else if (aksi === 'reset') {
          Object.assign(keadaanLapor, {
            judul: '', keterangan: '', uptPilih: '', kanwilPilih: '',
            berkas: [], terunggah: [], terakhir: null,
          })
          gambar()
        }
      })
    })

    const tangani = (ev) => {
      keadaanLapor.berkas.push(...saringBerkas([...ev.target.files]))
      ev.target.value = ''
      gambar()
    }
    isi.querySelector('#ll-berkas')?.addEventListener('change', tangani)
    isi.querySelector('#ll-kamera')?.addEventListener('change', tangani)

    // --- Laporan Verifikasi Pemberitaan
    const ambilWadahVerif = (kunci) => (kunci === 'sendiri'
      ? { isian: keadaanLapor.verif, set: (k, v) => { if (k === 'nama') keadaanLapor.verifNama = v; else keadaanLapor.verifJabatan = v } }
      : { isian: keadaanLapor.jawab[kunci]?.isian, set: (k, v) => { if (keadaanLapor.jawab[kunci]) keadaanLapor.jawab[kunci][k] = v } })
    isi.querySelectorAll('[data-verif]').forEach((m) => {
      const simpan = () => { const w = ambilWadahVerif(m.dataset.kunci).isian; if (w) w[m.dataset.verif] = m.value }
      m.addEventListener('input', simpan); m.addEventListener('change', simpan)
    })
    isi.querySelectorAll('[data-verif-pengirim]').forEach((m) => {
      m.addEventListener('input', () => ambilWadahVerif(m.dataset.kunci).set(m.dataset.verifPengirim, m.value))
    })
    isi.querySelector('[data-aksi-cek="sertakan-verif"]')?.addEventListener('change', (ev) => {
      keadaanLapor.sertakanVerif = ev.target.checked
      if (ev.target.checked && !Object.keys(keadaanLapor.verif).length) {
        keadaanLapor.verif = isianBaAwal({ judul: keadaanLapor.judul, keterangan: keadaanLapor.keterangan })
        keadaanLapor.verifNama = keadaan.profil?.full_name || ''
      }
      gambar()
    })
    isi.querySelectorAll('[data-aksi="buka-jawab"],[data-aksi="tutup-jawab"],[data-aksi="kirim-jawab"],[data-aksi="pilih-berkas-jawab"],[data-aksi="hapus-berkas-jawab"]').forEach((btn) => {
      btn.addEventListener('click', async (ev) => {
        ev.preventDefault()
        const id = btn.dataset.id
        const aksi = btn.dataset.aksi
        if (aksi === 'buka-jawab') {
          const l = (keadaanLapor.masuk || []).find((x) => x.id === id)
          if (!keadaanLapor.jawab[id]) {
            keadaanLapor.jawab[id] = { isian: isianBaAwal(l), nama: keadaan.profil?.full_name || '', jabatan: '', berkas: [] }
          }
          keadaanLapor.bukaId = id; gambar()
        } else if (aksi === 'tutup-jawab') {
          keadaanLapor.bukaId = null; gambar()
        } else if (aksi === 'pilih-berkas-jawab') {
          isi.querySelector(`[data-berkas-jawab="${CSS.escape(id)}"]`)?.click()
        } else if (aksi === 'hapus-berkas-jawab') {
          keadaanLapor.jawab[id]?.berkas.splice(Number(btn.dataset.i), 1); gambar()
        } else if (aksi === 'kirim-jawab') {
          await kirimJawaban(id, gambar)
        }
      })
    })
    isi.querySelectorAll('[data-berkas-jawab]').forEach((m) => {
      m.addEventListener('change', (ev) => {
        const j = keadaanLapor.jawab[m.dataset.berkasJawab]
        if (j) j.berkas.push(...saringBerkas([...ev.target.files]))
        ev.target.value = ''
        gambar()
      })
    })

    isi.querySelector('#ll-form')?.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      await kirim(gambar)
    })
  }

  // Dipicu sebelum gambar() supaya penanda `memuat` sudah menyala di tampilan pertama.
  const daftarTiba = keadaanLapor.daftarUpt.length ? null : muatDaftar()
  const peran = keadaan.profil?.role
  const masukTiba = (adalahUnit(peran) || adalahEksternal(peran)) ? muatMasuk() : null
  gambar()
  const gambarBila = () => { if (isi.isConnected && keadaan.halaman === 'lapor-langsung') gambar() }
  daftarTiba?.then(gambarBila)
  masukTiba?.then(gambarBila)
  return { judul: 'Input Lapor Langsung', sub: 'Setor bukti pemantauan siber langsung ke tim analis' }
}

/** Menyaring berkas pilihan menurut jenis dan batas ukuran; yang ditolak diberi tahu. */
function saringBerkas(daftar) {
  const lolos = []
  for (const b of daftar) {
    const mime = b.type || ''
    const gambar_ = mime.startsWith('image/') || JENIS_GAMBAR.includes(mime)
    const pdf = JENIS_PDF.includes(mime)
    if (!gambar_ && !pdf) {
      roti(`Berkas ${b.name} jenisnya tidak didukung; dilewati.`, 'sedang', 6000)
      continue
    }
    const batas = pdf ? (KONFIG.batasPdfBita || 10 * 1024 * 1024) : (KONFIG.batasGambarBita || 1024 * 1024)
    if (b.size > batas) {
      const batasMb = Math.round(batas / 1024 / 1024)
      roti(`${b.name} ${ukuranBerkas(b.size)} melebihi batas ${batasMb} MB untuk ${pdf ? 'PDF' : 'gambar'}; dilewati.`, 'sedang', 7000)
      continue
    }
    lolos.push(b)
  }
  return lolos
}

/** Mengunggah berkas ke Drive (sandaran: bucket Supabase). Mengembalikan { berkas, folderUrl }. */
async function unggahSemua(laporanId, daftar, awalanNama = '') {
  const hasil = []
  let folderUrl = null
  if (!daftar.length) return { berkas: hasil, folderUrl }
  const bernama = awalanNama
    ? daftar.map((f) => new File([f], `${awalanNama}${f.name}`, { type: f.type }))
    : daftar
  if (KONFIG.driveUpload) {
    try {
      const h = await unggahDrive(laporanId, bernama)
      folderUrl = h?.folderUrl || null
      hasil.push(...(h?.berkas || []))
      return { berkas: hasil, folderUrl }
    } catch (galat) {
      roti(`Unggah ke Drive gagal: ${pesanRamah(galat)}. Berkas dicoba disimpan di penampung sandaran.`, 'kritis', 8000)
    }
  }
  for (const f of bernama) {
    try {
      const { jalur, ukuran } = await unggahBerkas('lapor-langsung', laporanId, f)
      hasil.push({ jalur, nama: f.name, mime: f.type, ukuran })
    } catch (sub) {
      roti(`Gagal menyimpan ${f.name}: ${pesanRamah(sub)}`, 'kritis', 7000)
    }
  }
  return { berkas: hasil, folderUrl }
}

async function kirimJawaban(id, gambar) {
  const j = keadaanLapor.jawab[id]
  if (!j) return
  const laporan = bersihkanBa(j.isian)
  const salah = periksaLaporan(laporan)
  if (salah) { roti(salah, 'sedang', 6000); return }
  if (String(j.nama || '').trim().length < 3) { roti('Nama pengirim verifikasi wajib diisi.', 'sedang', 5000); return }

  keadaanLapor.menjawab = true
  gambar()
  try {
    const { berkas, folderUrl } = await unggahSemua(id, j.berkas, 'verifikasi-')
    if (j.berkas.length && !berkas.length) throw new Error('Lampiran verifikasi gagal diunggah. Silakan coba lagi.')
    await panggilFungsi('lapor_kirim_verifikasi', {
      p_id: id,
      p_laporan: laporan,
      p_nama: j.nama.trim(),
      p_jabatan: (j.jabatan || '').trim() || null,
      p_berkas: berkas,
      p_drive_url: folderUrl,
    })
    delete keadaanLapor.jawab[id]
    keadaanLapor.bukaId = null
    roti('Laporan verifikasi terkirim.', 'positif', 5000)
    await muatMasuk()
  } catch (galat) {
    const kode = galat?.rinci?.code
    roti(kode === 'PGRST202' || kode === '42883'
      ? 'Fitur verifikasi menunggu pembaruan basis data oleh administrator pusat.'
      : pesanRamah(galat), 'kritis', 8000)
  } finally {
    keadaanLapor.menjawab = false
    gambar()
  }
}

async function kirim(gambar) {
  const profil = keadaan.profil
  const peran = profil?.role

  if (!keadaanLapor.keterangan.trim()) {
    roti('Penjelasan isi bukti belum diisi.', 'sedang', 5000); return
  }
  if (!keadaanLapor.berkas.length && !keadaanLapor.terunggah.length) {
    roti('Belum ada berkas bukti yang dipilih.', 'sedang', 5000); return
  }

  let kanwil = null
  let namaUpt = null
  if (adalahUnit(peran)) {
    namaUpt = profil?.assigned_upt || null
    const u = keadaanLapor.daftarUpt.find((x) => x.nama_upt === namaUpt)
    kanwil = u?.kanwil || null
  } else if (adalahEksternal(peran)) {
    kanwil = profil?.assigned_kanwil || null
    namaUpt = keadaanLapor.uptPilih || null
    if (!namaUpt) { roti('Pilih UPT di wilayah Anda.', 'sedang', 5000); return }
  } else {
    kanwil = keadaanLapor.kanwilPilih || null
    namaUpt = keadaanLapor.uptPilih || null
    if (!kanwil) { roti('Pilih Kanwil.', 'sedang', 5000); return }
    if (!namaUpt) { roti('Pilih UPT.', 'sedang', 5000); return }
  }

  // Laporan Verifikasi yang dilampirkan UPT pada temuannya sendiri.
  let verif = null
  if (adalahUnit(peran) && keadaanLapor.sertakanVerif) {
    verif = bersihkanBa(keadaanLapor.verif)
    const salah = periksaLaporan(verif)
    if (salah) { roti(`Laporan verifikasi: ${salah}`, 'sedang', 6000); return }
    if (keadaanLapor.verifNama.trim().length < 3) { roti('Nama pengirim verifikasi wajib diisi.', 'sedang', 5000); return }
  }

  keadaanLapor.mengirim = true
  gambar()

  try {
    // Id dibuat di sisi klien supaya berkas bisa diunggah lebih dulu dan baris
    // laporan disimpan SEKALI dengan daftar berkas yang sudah lengkap. Pelapor
    // memang tidak punya hak UPDATE pada tabel ini (hanya analis), jadi alur
    // "simpan baris kosong lalu perbarui" akan diam-diam gagal bagi UPT,
    // kanwil, dan operator.
    const baris = { id: globalThis.crypto?.randomUUID?.() || buatUuid() }

    const terunggah = [...keadaanLapor.terunggah]
    let driveFolderUrl = null
    if (KONFIG.driveUpload && keadaanLapor.berkas.length) {
      // Jalur Google Drive. Semua berkas sesi ini dikirim satu permintaan;
      // Apps Script menolak bila total melewati 45 MB.
      try {
        const hasil = await unggahDrive(baris.id, keadaanLapor.berkas)
        driveFolderUrl = hasil?.folderUrl || null
        for (const b of (hasil?.berkas || [])) terunggah.push(b)
      } catch (galat) {
        roti(`Unggah ke Drive gagal: ${pesanRamah(galat)}. Berkas dicoba disimpan di penampung sandaran.`, 'kritis', 8000)
        for (const berkas of keadaanLapor.berkas) {
          try {
            const { jalur, ukuran } = await unggahBerkas('lapor-langsung', baris.id, berkas)
            terunggah.push({ jalur, nama: berkas.name, mime: berkas.type, ukuran })
          } catch (sub) {
            roti(`Gagal menyimpan ${berkas.name}: ${pesanRamah(sub)}`, 'kritis', 7000)
          }
        }
      }
    } else {
      // Jalur sandaran: Supabase Storage. Dipakai selama KONFIG.driveUpload belum diisi.
      for (const berkas of keadaanLapor.berkas) {
        try {
          const { jalur, ukuran } = await unggahBerkas('lapor-langsung', baris.id, berkas)
          terunggah.push({ jalur, nama: berkas.name, mime: berkas.type, ukuran })
        } catch (galat) {
          roti(`Gagal mengunggah ${berkas.name}: ${pesanRamah(galat)}`, 'kritis', 7000)
        }
      }
    }

    // Laporan tanpa satu pun berkas yang berhasil tersimpan tidak dicatat:
    // bukti adalah isinya, dan baris kosong hanya menyesatkan peninjau.
    if (!terunggah.length) {
      throw new Error('Tidak ada berkas yang berhasil diunggah. Laporan belum disimpan, silakan coba lagi.')
    }

    const isi = {
      id: baris.id,
      pelapor_user_id: profil.auth_user_id,
      pelapor_username: profil.username || null,
      pelapor_nama: profil.full_name || profil.username || 'Petugas',
      pelapor_role: profil.role || null,
      kanwil,
      nama_upt: namaUpt,
      judul: keadaanLapor.judul?.trim() || null,
      keterangan: keadaanLapor.keterangan.trim(),
      berkas: terunggah,
      status: 'baru',
    }
    if (driveFolderUrl) {
      isi.drive_url = driveFolderUrl
      isi.disinkronkan_pada = new Date().toISOString()
    }
    if (verif) {
      Object.assign(isi, {
        verifikasi: verif,
        verifikasi_nama: keadaanLapor.verifNama.trim(),
        verifikasi_jabatan: keadaanLapor.verifJabatan.trim() || null,
        verifikasi_oleh: profil.username || null,
        verifikasi_pada: new Date().toISOString(),
        status: 'diverifikasi_upt',
      })
    }
    await sisip('lapor_langsung', isi, { kembalikan: 'minimal' })

    keadaanLapor.terakhir = { id: baris.id, jumlahBerkas: terunggah.length }
    keadaanLapor.berkas = []
    keadaanLapor.terunggah = []
    keadaanLapor.judul = ''
    keadaanLapor.keterangan = ''
    keadaanLapor.uptPilih = ''
    keadaanLapor.kanwilPilih = ''
    keadaanLapor.sertakanVerif = false
    keadaanLapor.verif = {}
    keadaanLapor.verifJabatan = ''
    roti('Laporan tersimpan.', 'positif', 5000)
  } catch (galat) {
    roti(galat?.rinci?.code === 'PGRST204'
      ? 'Laporan verifikasi belum bisa disimpan: basis data menunggu pembaruan oleh administrator pusat. Hapus centang verifikasi untuk tetap mengirim laporan.'
      : pesanRamah(galat), 'kritis', 9000)
    console.error(galat)
  } finally {
    keadaanLapor.mengirim = false
    gambar()
  }
}

/**
 * Mengirim beberapa berkas sekaligus ke Apps Script Web App yang mengelola
 * folder Drive pengelola sistem. Berkas disandikan base64 di dalam badan
 * JSON; Content-Type sengaja `text/plain` supaya peramban tidak mengirim
 * preflight OPTIONS yang tidak bisa dilayani Apps Script.
 */
async function unggahDrive(laporanId, berkasDaftar) {
  const berkasBase64 = await Promise.all(berkasDaftar.map(bacaBase64))
  const jawab = await fetch(KONFIG.driveUpload, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ laporanId, berkas: berkasBase64 }),
    redirect: 'follow',
  })
  if (!jawab.ok) throw new Error(`HTTP ${jawab.status}`)
  const hasil = await jawab.json().catch(() => null)
  if (!hasil?.ok) throw new Error(hasil?.pesan || 'Jawaban tidak dikenali.')
  return hasil
}

/** Sandaran untuk peramban lama yang belum punya crypto.randomUUID(). */
function buatUuid() {
  const h = '0123456789abcdef'
  let u = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) u += '-'
    else if (i === 14) u += '4'
    else if (i === 19) u += h[(Math.random() * 4 | 8)]
    else u += h[(Math.random() * 16 | 0)]
  }
  return u
}

function bacaBase64(berkas) {
  return new Promise((selesai, gagal) => {
    const r = new FileReader()
    r.onerror = () => gagal(r.error || new Error('Gagal membaca berkas.'))
    r.onload = () => {
      const url = String(r.result || '')
      const koma = url.indexOf(',')
      selesai({
        nama: berkas.name,
        mime: berkas.type || 'application/octet-stream',
        ukuran: berkas.size,
        data: koma >= 0 ? url.slice(koma + 1) : url,
      })
    }
    r.readAsDataURL(berkas)
  })
}
