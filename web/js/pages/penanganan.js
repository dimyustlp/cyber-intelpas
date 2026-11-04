/**
 * Tindak Lanjut berita — Klarifikasi UPT dan Disposisi Pimpinan.
 *
 * Dua tab di dalam menu Tindak Lanjut (pages/tindak-lanjut.js). Yang tampil
 * dan yang bisa ditekan ditentukan peran:
 *
 *   pusat   melihat seluruhnya, dikelompokkan per kanwil; boleh meneruskan,
 *           menilai, dan mencatat disposisi atas kanwil mana pun
 *   kanwil  wilayahnya sendiri; meneruskan ke UPT, menilai klarifikasi,
 *           mencatat disposisi pimpinan wilayah
 *   UPT     hanya klarifikasi untuk unitnya; mengisi laporan klarifikasi
 *           menurut format resmi (lib/laporan-klarifikasi.js) dan/atau
 *           mengunggah berkas (PDF/DOCX), dan WAJIB menyebut nama serta
 *           jabatan pengirimnya
 *
 * Ketiga peran membaca laporan yang sama dalam bentuk yang sama, bisa
 * mengunduhnya sebagai .docx, dan bisa mengunduh format kosongnya.
 *
 * Tombol yang tidak berhak ditekan tidak digambar, tetapi yang menolak
 * tetap basis data (fungsi penanganan_*): halaman ini hanya menghemat satu
 * klik yang pasti ditolak.
 */

import { kartu, keping, kosong, tombol, pesanSistem, roti, ubin } from '../ui/komponen.js'
import { amankan, angka, tanggalJam, ringkas, jarakWaktu } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { pesanRamah } from '../lib/api.js'
import { KONFIG } from '../lib/konfig.js'
import { adalahEksternal, adalahUnit } from '../lib/peran.js'
import {
  muatPenanganan, penangananSaatIni, galatPenanganan, infoStatus, lewatBatas, namaKanwilPendek,
  teruskanKeUpt, kirimKlarifikasi, nilaiKlarifikasi, catatDisposisi, tautanKlarifikasi, hitungPenanganan,
} from '../lib/penanganan.js'
import {
  LEMBAR, ZONA_WAKTU, FORMAT_KOSONG, LOGO_KOP, JENIS_DOCX, HASIL, TINGKAT,
  laporanBawaan, bersihkanLaporan, periksaLaporan, labelPilihan, kalimatWaktuKonfirmasi, susunDocxKlarifikasi, namaBerkasLaporan,
} from '../lib/laporan-klarifikasi.js'

/*
   `draf` menyimpan isian laporan per permintaan selama halaman terbuka:
   halaman ini digambar ulang pada setiap perubahan keadaan (termasuk saat
   tombol kirim ditekan), dan formulir dua puluh bidang yang kosong kembali
   setelah satu penolakan adalah cara tercepat membuat UPT berhenti mengisi.
*/
const keadaanTab = { dimuat: false, saring: 'semua', sibuk: null, buka: new Set(), draf: new Map(), bukaForm: new Set() }

function gambarUlang() { document.dispatchEvent(new CustomEvent('gambar-ulang')) }

function keIso(tgl) { return tgl ? new Date(`${tgl}T16:59:00Z`).toISOString() : null }
function tglDepan(hari) { return new Date(Date.now() + hari * 86400000).toISOString().slice(0, 10) }

function pastikanDimuat() {
  if (keadaanTab.dimuat) return
  keadaanTab.dimuat = true
  muatPenanganan({ paksa: true }).then(gambarUlang)
}

function kepingBatas(p) {
  if (!p.batas_waktu) return ''
  if (infoStatus(p.status).selesai) return `<span class="mini-teks samar-teks">batas ${amankan(tanggalJam(p.batas_waktu))}</span>`
  return lewatBatas(p)
    ? keping(`Lewat batas · ${tanggalJam(p.batas_waktu)}`, 'kritis', true)
    : keping(`Batas ${tanggalJam(p.batas_waktu)}`, 'netral', true)
}

function kepalaButir(p, { unit }) {
  const b = p.berita || {}
  const st = infoStatus(p.status)
  return `
    <div class="baris gap-6" style="flex-wrap:wrap;align-items:center">
      ${keping(st.pendek, st.nada)}
      ${kepingBatas(p)}
      <span class="mini-teks samar-teks">${amankan(p.nama_upt || '-')}${unit ? '' : ` · ${amankan(namaKanwilPendek(p.kanwil))}`}</span>
    </div>
    <div style="margin-top:6px">
      ${b.link ? `<a href="${amankan(b.link)}" target="_blank" rel="noopener noreferrer"><b>${amankan(ringkas(b.judul || '(judul tidak termuat)', 160))}</b></a>`
        : `<b>${amankan(ringkas(b.judul || '(judul tidak termuat)', 160))}</b>`}
      <div class="mini-teks samar-teks">${amankan(b.media || '')}${b.created_at ? ` · ${amankan(tanggalJam(b.created_at))}` : ''}
        · dianalisis ${amankan(p.dibuat_oleh || '-')} ${amankan(jarakWaktu(p.dibuat_pada))}</div>
    </div>`
}

function rincianAnalisis(p) {
  const a = p.analisis || {}
  if (!a.fakta && !a.rekomendasi) return ''
  return `
    <details class="penanganan-rinci">
      <summary>Hasil analisis</summary>
      ${a.fakta ? `<div class="label-mono">Fakta</div><p class="pra">${amankan(a.fakta)}</p>` : ''}
      ${a.analisis ? `<div class="label-mono">Analisis</div><p class="pra">${amankan(a.analisis)}</p>` : ''}
      ${a.prakiraan ? `<div class="label-mono">Prakiraan</div><p class="pra">${amankan(a.prakiraan)}</p>` : ''}
      ${a.rekomendasi ? `<div class="label-mono">Rekomendasi</div><p class="pra">${amankan(a.rekomendasi)}</p>` : ''}
      ${a.nilai_sumber ? `<div class="mini-teks samar-teks">Evaluasi SIP: ${amankan(a.nilai_sumber)}${amankan(a.nilai_informasi || '')}</div>` : ''}
    </details>`
}

/* ------------------------------------------------- laporan klarifikasi */

function drafUntuk(p) {
  if (!keadaanTab.draf.has(p.id)) {
    keadaanTab.draf.set(p.id, {
      ...laporanBawaan(p),
      ...(p.laporan_klarifikasi || {}),
      pengirim: p.pengirim_nama || '', jabatan: p.pengirim_jabatan || '',
    })
  }
  return keadaanTab.draf.get(p.id)
}

/** Laporan dianggap diisi bila salah satu butir penentu artinya terisi. */
function laporanDiisi(d) {
  return Boolean(d.hasil_konfirmasi || d.tingkat || String(d.fakta || '').trim())
}

function masukanBidang(b, nilai) {
  const atr = `class="masukan${b.jenis === 'area' ? ' area' : ''}" data-lap="${b.k}"`
  if (b.jenis === 'area') return `<textarea ${atr} rows="${b.baris || 2}" maxlength="4000">${amankan(nilai)}</textarea>`
  if (b.jenis === 'pilih') {
    const opsi = Array.isArray(b.pilihan) ? b.pilihan.map((x) => [x, x]) : Object.entries(b.pilihan)
    return `<select ${atr}><option value="">— pilih —</option>${opsi.map(([k, l]) =>
      `<option value="${amankan(k)}"${k === nilai ? ' selected' : ''}>${amankan(l)}</option>`).join('')}</select>`
  }
  return `<input ${atr} maxlength="300" value="${amankan(nilai)}">`
}

function formulirLaporan(p) {
  const d = drafUntuk(p)
  const bidang = (b) => b.jenis === 'waktu'
    ? `<label class="bidang"><span class="label-mono">${amankan(b.label)}</span>
        <span class="baris gap-6"><input class="masukan" type="datetime-local" data-lap="${b.k}" value="${amankan(d[b.k] || '')}">
        <select class="masukan" data-lap="zona" style="width:90px" aria-label="Zona waktu">${ZONA_WAKTU.map((z) =>
          `<option${z === d.zona ? ' selected' : ''}>${z}</option>`).join('')}</select></span></label>`
    : `<label class="bidang${b.jenis === 'area' ? ' lebar' : ''}"><span class="label-mono">${amankan(b.label)}${b.wajib ? ' (wajib)' : ''}</span>
        ${masukanBidang(b, d[b.k] || '')}</label>`
  return LEMBAR.map((l) => `
    <fieldset class="laporan-lembar">
      <legend>${amankan(l.judul)}</legend>
      <div class="mini-teks samar-teks">${amankan(l.ket)}</div>
      <div class="laporan-kisi">${l.bidang.map(bidang).join('')}</div>
    </fieldset>`).join('')
}

function waktuBaca(l) {
  const w = kalimatWaktuKonfirmasi(l)
  return `${w.hari}, ${w.tanggal} pukul ${w.pukul} ${w.zona}`
}

/** Tampilan baca: hanya butir yang terisi, dalam urutan lembar. */
function tampilanLaporan(p) {
  const l = p.laporan_klarifikasi
  if (!l) return ''
  const hasil = HASIL[l.hasil_konfirmasi]
  const tingkat = TINGKAT[l.tingkat]
  return `
    <details class="penanganan-rinci laporan-baca"${keadaanTab.bukaForm.has(`baca-${p.id}`) ? ' open' : ''} data-buka-kunci="baca-${amankan(p.id)}">
      <summary>Laporan klarifikasi${hasil ? ` — hasil konfirmasi <b>${amankan(hasil)}</b>` : ''}${tingkat ? ` · tingkat ${amankan(tingkat)}` : ''}</summary>
      ${LEMBAR.map((lembar) => {
        const isi = lembar.bidang.filter((b) => String(l[b.k] || '').trim())
        if (!isi.length) return ''
        return `<div class="label-mono" style="margin-top:8px">${amankan(lembar.judul)}</div>
          <dl class="laporan-dl">${isi.map((b) => `<dt>${amankan(b.label)}</dt><dd class="pra">${amankan(
            b.k === 'waktu_konfirmasi' ? waktuBaca(l) : labelPilihan(b, l[b.k]))}</dd>`).join('')}</dl>`
      }).join('')}
      <div style="margin-top:6px"><button class="tbl kecil" data-unduh-laporan="${amankan(p.id)}">${ikon('unduh')}Unduh laporan (.docx)</button></div>
    </details>`
}

async function ambilLogo() {
  try {
    const r = await fetch(LOGO_KOP)
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null
  } catch { return null }
}

/**
 * Unduh .docx tiga lembar. Tidak lewat lib/ekspor.js `unduh`: berkas ini
 * isian UPT sendiri, bukan petikan data berklasifikasi, dan harus bisa
 * diunduh juga di mode peragaan untuk latihan mengisi.
 */
async function unduhLaporan(p, laporan, waktuLaporan) {
  const isi = susunDocxKlarifikasi(laporan, { p, logo: await ambilLogo(), waktuLaporan })
  const alamat = URL.createObjectURL(new Blob([isi], { type: JENIS_DOCX }))
  const a = document.createElement('a')
  a.href = alamat
  a.download = namaBerkasLaporan(p, new Date(waktuLaporan))
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(alamat), 10_000)
}

function kartuFormat(unit) {
  return kartu({
    judul: 'Format Laporan Klarifikasi Berita',
    ket: unit
      ? 'Isi laporan langsung di setiap permintaan di bawah; berkas .docx tersusun otomatis. Format kosong untuk Buku Kontrol, Rekapitulasi, dan Laporan Mingguan ada di berkas yang sama.'
      : 'Format resmi yang diisi UPT: Laporan Insidental, Berita Acara Verifikasi Isu, dan Draft Tanggapan. Laporan yang masuk bisa dibaca di setiap butir dan diunduh sebagai .docx.',
    aksi: `<a class="tbl kecil" href="${FORMAT_KOSONG}" download="Format Laporan Klarifikasi Berita.docx">${ikon('unduh')}Unduh format kosong (.docx)</a>`,
    isi: `<div class="mini-teks samar-teks">${LEMBAR.map((l) => amankan(l.judul)).join(' · ')}
      · Buku Kontrol Patroli Siber · Rekapitulasi Klarifikasi Isu · Laporan Hasil Patroli Siber (mingguan)</div>`,
  })
}

/* ---------------------------------------------------------- klarifikasi UPT */

function butirKlarifikasi(p, { peran, unit, bolehKelola }) {
  const sibuk = keadaanTab.sibuk === p.id
  let aksi = ''

  if (p.status === 'menunggu_kanwil' && bolehKelola) {
    aksi = `
      <div class="penanganan-aksi" data-id="${amankan(p.id)}">
        <div class="label-mono">Teruskan ke ${amankan(p.nama_upt)}</div>
        <textarea class="masukan area" data-isian="instruksi" rows="2">${amankan(p.instruksi || 'Mohon klarifikasi tertulis atas pemberitaan ini disertai kronologi dan bukti pendukung.')}</textarea>
        <div class="baris gap-6" style="flex-wrap:wrap;margin-top:6px">
          <label class="mini-teks">Batas <input class="masukan" type="date" data-isian="batas" value="${tglDepan(2)}" style="width:160px"></label>
          ${tombol({ label: sibuk ? 'Meneruskan…' : 'Teruskan ke UPT', ikon: 'kirim', gaya: 'utama', kecil: true, aksi: 'teruskan', nonaktif: sibuk })}
        </div>
      </div>`
  } else if (['menunggu_upt', 'perlu_perbaikan'].includes(p.status) && (unit || peran === 'kanwil_admin' || peran === 'super_admin')) {
    aksi = `
      <div class="penanganan-aksi" data-id="${amankan(p.id)}">
        ${p.status === 'perlu_perbaikan' && p.catatan_penilaian
          ? pesanSistem(`<b>Perlu diperbaiki:</b> ${amankan(p.catatan_penilaian)}`, 'sedang', 'peringatan') : ''}
        <details class="laporan-isi"${keadaanTab.bukaForm.has(p.id) ? ' open' : ''} data-buka-kunci="${amankan(p.id)}">
          <summary>${ikon('arsip')}${unit ? 'Isi laporan klarifikasi' : `Isi laporan klarifikasi atas nama ${amankan(p.nama_upt)}`}
            <span class="mini-teks samar-teks">— format resmi: Laporan Insidental, Berita Acara Verifikasi Isu, Draft Tanggapan</span></summary>
          ${formulirLaporan(p)}
        </details>
        <div class="sip-kisi" style="margin-top:6px">
          <label><span class="label-mono">Nama pengirim (wajib)</span>
            <input class="masukan" data-lap="pengirim" maxlength="120" value="${amankan(drafUntuk(p).pengirim || '')}" placeholder="Nama lengkap yang mengirim"></label>
          <label><span class="label-mono">Jabatan pengirim (wajib)</span>
            <input class="masukan" data-lap="jabatan" maxlength="120" value="${amankan(drafUntuk(p).jabatan || '')}" placeholder="mis. Kepala KPLP"></label>
          <label><span class="label-mono">Lampiran bertanda tangan (PDF/DOCX, opsional)</span>
            <input class="masukan" type="file" data-isian="berkas" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></label>
        </div>
        <div class="mini-teks samar-teks">Isi laporan di atas, unggah berkas, atau keduanya. Hasil konfirmasi, fakta sebenarnya, dan tingkat isu wajib bila laporan diisi.</div>
        <div class="baris gap-6" style="margin-top:6px;flex-wrap:wrap">
          ${tombol({ label: sibuk ? 'Mengirim…' : 'Kirim klarifikasi', ikon: 'kirim', gaya: 'utama', kecil: true, aksi: 'kirim-klarifikasi', nonaktif: sibuk })}
          ${tombol({ label: 'Unduh laporan (.docx)', ikon: 'unduh', kecil: true, aksi: 'unduh-draf', nonaktif: sibuk })}
        </div>
      </div>`
  }

  let masuk = ''
  if (p.berkas_jalur || p.laporan_klarifikasi) {
    masuk = `
      <div class="penanganan-masuk">
        ${p.berkas_jalur ? `<div class="baris gap-6" style="flex-wrap:wrap">
          ${ikon('arsip')}
          <b>${amankan(p.berkas_nama || 'berkas')}</b>
          <button class="tbl kecil" data-buka-berkas="${amankan(p.berkas_jalur)}">${ikon('unduh')}Buka berkas</button>
        </div>` : ''}
        <div class="mini-teks">Dikirim oleh <b>${amankan(p.pengirim_nama)}</b> (${amankan(p.pengirim_jabatan)})
          · ${amankan(tanggalJam(p.diunggah_pada))} · akun ${amankan(p.diunggah_oleh || '-')}</div>
        ${p.ringkasan_klarifikasi && !p.laporan_klarifikasi ? `<p class="pra" style="margin:6px 0 0">${amankan(p.ringkasan_klarifikasi)}</p>` : ''}
        ${tampilanLaporan(p)}
        ${p.status === 'diterima' ? `<div class="mini-teks samar-teks">Diterima ${amankan(p.dinilai_oleh || '')} · ${amankan(tanggalJam(p.dinilai_pada))}${p.catatan_penilaian ? ` — ${amankan(p.catatan_penilaian)}` : ''}</div>` : ''}
      </div>`
    if (p.status === 'klarifikasi_masuk' && bolehKelola) {
      masuk += `
        <div class="penanganan-aksi" data-id="${amankan(p.id)}">
          <textarea class="masukan area" data-isian="catatan" rows="2" placeholder="Catatan penilaian (wajib bila dikembalikan)"></textarea>
          <div class="baris gap-6" style="margin-top:6px">
            ${tombol({ label: 'Terima klarifikasi', ikon: 'centang', gaya: 'utama', kecil: true, aksi: 'terima', nonaktif: sibuk })}
            ${tombol({ label: 'Kembalikan untuk diperbaiki', ikon: 'segar', kecil: true, aksi: 'kembalikan', nonaktif: sibuk })}
          </div>
        </div>`
    }
  }

  return `
    <article class="penanganan-butir${lewatBatas(p) ? ' lewat' : ''}">
      ${kepalaButir(p, { unit })}
      ${p.instruksi ? `<div class="mini-teks" style="margin-top:6px"><b>Instruksi:</b> ${amankan(p.instruksi)}</div>` : ''}
      ${p.diteruskan_pada ? `<div class="mini-teks samar-teks">Diteruskan ${amankan(p.diteruskan_oleh || '')} · ${amankan(tanggalJam(p.diteruskan_pada))}</div>` : ''}
      ${unit ? '' : rincianAnalisis(p)}
      ${masuk}
      ${aksi}
    </article>`
}

const SARING_KLARIFIKASI = [
  ['semua', 'Semua'],
  ['menunggu_kanwil', 'Belum diteruskan'],
  ['belum', 'Belum menginput'],
  ['klarifikasi_masuk', 'Sudah menginput'],
  ['diterima', 'Selesai'],
]

function cocokSaring(p) {
  const s = keadaanTab.saring
  if (s === 'semua') return true
  if (s === 'belum') return ['menunggu_upt', 'perlu_perbaikan'].includes(p.status)
  return p.status === s
}

function daftarBerkelompok(daftar, pusat, gambarButir) {
  if (!pusat) return daftar.map(gambarButir).join('')
  const kelompok = new Map()
  for (const p of daftar) {
    const k = p.kanwil || 'Tanpa kanwil'
    if (!kelompok.has(k)) kelompok.set(k, [])
    kelompok.get(k).push(p)
  }
  return [...kelompok.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, isi]) => {
    const h = hitungPenanganan(isi)
    const terbuka = kelompok.size === 1 || keadaanTab.buka.has(k)
    return `
      <details class="analisis-kelompok" data-kanwil="${amankan(k)}"${terbuka ? ' open' : ''}>
        <summary><b>${amankan(namaKanwilPendek(k))}</b>
          <span class="mini-teks samar-teks">${angka(isi.length)} butir
            ${h.belumMenginput ? ` · <b style="color:var(--tinggi,#b45309)">${angka(h.belumMenginput)} belum menginput</b>` : ''}
            ${h.sudahMenginput ? ` · ${angka(h.sudahMenginput)} sudah menginput` : ''}
            ${h.belumDiteruskan ? ` · ${angka(h.belumDiteruskan)} belum diteruskan` : ''}
            ${h.lewat ? ` · ${angka(h.lewat)} lewat batas` : ''}</span></summary>
        <div class="tumpuk" style="gap:10px;margin-top:8px">${isi.map(gambarButir).join('')}</div>
      </details>`
  }).join('')
}

function pasangPenyimak(isi, keadaan) {
  isi.querySelectorAll('[data-saring-penanganan]').forEach((b) => b.addEventListener('click', () => {
    keadaanTab.saring = b.dataset.saringPenanganan; gambarUlang()
  }))
  isi.querySelectorAll('details.analisis-kelompok').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) keadaanTab.buka.add(d.dataset.kanwil); else keadaanTab.buka.delete(d.dataset.kanwil)
  }))
  isi.querySelectorAll('[data-buka-berkas]').forEach((b) => b.addEventListener('click', async () => {
    if (KONFIG.mode === 'demo') { roti('Mode peragaan tidak menyimpan berkas sungguhan.', 'sedang'); return }
    try {
      const url = await tautanKlarifikasi(b.dataset.bukaBerkas)
      if (url) window.open(url, '_blank', 'noopener')
      else roti('Tautan berkas tidak bisa dibuat.', 'sedang')
    } catch (e) { roti(pesanRamah(e), 'kritis') }
  }))
  isi.querySelectorAll('details[data-buka-kunci]').forEach((d) => d.addEventListener('toggle', () => {
    if (d.open) keadaanTab.bukaForm.add(d.dataset.bukaKunci); else keadaanTab.bukaForm.delete(d.dataset.bukaKunci)
  }))
  isi.querySelectorAll('[data-unduh-laporan]').forEach((b) => b.addEventListener('click', async () => {
    const p = penangananSaatIni().find((x) => x.id === b.dataset.unduhLaporan)
    if (!p?.laporan_klarifikasi) return
    try { await unduhLaporan(p, p.laporan_klarifikasi, p.diunggah_pada || new Date()) } catch (e) { roti(pesanRamah(e), 'kritis') }
  }))

  isi.querySelectorAll('.penanganan-aksi').forEach((wadah) => {
    const id = wadah.dataset.id
    const ambilIsian = (n) => wadah.querySelector(`[data-isian="${n}"]`)
    const jalankan = async (fungsi, pesan) => {
      keadaanTab.sibuk = id
      gambarUlang()
      try {
        await fungsi()
        roti(pesan, 'positif', 4500)
      } catch (e) {
        roti(pesanRamah(e), 'kritis', 7000)
      } finally {
        keadaanTab.sibuk = null
        gambarUlang()
      }
    }
    wadah.querySelector('[data-aksi="teruskan"]')?.addEventListener('click', () => jalankan(
      () => teruskanKeUpt(id, { instruksi: ambilIsian('instruksi')?.value, batas: keIso(ambilIsian('batas')?.value) }),
      'Diteruskan ke UPT. Grup Telegram kanwil diberi tahu.'))
    const draf = keadaanTab.draf.get(id)
    wadah.querySelectorAll('[data-lap]').forEach((m) => {
      const simpan = () => { if (draf) draf[m.dataset.lap] = m.value }
      m.addEventListener('input', simpan)
      m.addEventListener('change', simpan)
    })
    const pTerpilih = () => penangananSaatIni().find((x) => x.id === id)
    wadah.querySelector('[data-aksi="unduh-draf"]')?.addEventListener('click', async () => {
      try { await unduhLaporan(pTerpilih(), bersihkanLaporan(draf), new Date()) } catch (e) { roti(pesanRamah(e), 'kritis') }
    })
    wadah.querySelector('[data-aksi="kirim-klarifikasi"]')?.addEventListener('click', () => {
      const berkas = ambilIsian('berkas')?.files?.[0] || null
      const pengirim = String(draf?.pengirim || '').trim()
      const jabatan = String(draf?.jabatan || '').trim()
      const diisi = draf && laporanDiisi(draf)
      if (!berkas && !diisi) { roti('Isi laporan klarifikasi atau unggah berkas klarifikasi.', 'sedang'); keadaanTab.bukaForm.add(id); gambarUlang(); return }
      if (diisi) {
        const galat = periksaLaporan(draf)
        if (galat) { roti(galat, 'sedang'); keadaanTab.bukaForm.add(id); gambarUlang(); return }
      }
      if (pengirim.length < 3) { roti('Nama pengirim wajib diisi.', 'sedang'); return }
      if (jabatan.length < 2) { roti('Jabatan pengirim wajib diisi.', 'sedang'); return }
      jalankan(async () => {
        await kirimKlarifikasi(id, { berkas, pengirim, jabatan, laporan: diisi ? bersihkanLaporan(draf) : null })
        keadaanTab.draf.delete(id)
      }, 'Klarifikasi terkirim. Kanwil dan pusat diberi tahu otomatis.')
    })
    wadah.querySelector('[data-aksi="terima"]')?.addEventListener('click', () => jalankan(
      () => nilaiKlarifikasi(id, { terima: true, catatan: ambilIsian('catatan')?.value }), 'Klarifikasi diterima.'))
    wadah.querySelector('[data-aksi="kembalikan"]')?.addEventListener('click', () => {
      const catatan = ambilIsian('catatan')?.value?.trim()
      if (!catatan || catatan.length < 5) { roti('Tuliskan apa yang perlu diperbaiki UPT.', 'sedang'); return }
      jalankan(() => nilaiKlarifikasi(id, { terima: false, catatan }), 'Dikembalikan ke UPT untuk diperbaiki.')
    })
    wadah.querySelector('[data-aksi="catat-disposisi"]')?.addEventListener('click', () => jalankan(
      () => catatDisposisi(id, {
        pimpinan: ambilIsian('pimpinan')?.value, isi: ambilIsian('isi')?.value, batas: keIso(ambilIsian('batas')?.value),
      }), 'Disposisi pimpinan dicatat.'))
    wadah.querySelector('[data-aksi="selesai-disposisi"]')?.addEventListener('click', () => {
      const hasil = ambilIsian('hasil')?.value?.trim()
      if (!hasil || hasil.length < 5) { roti('Tuliskan hasil tindak lanjutnya.', 'sedang'); return }
      jalankan(() => catatDisposisi(id, { hasil, selesai: true }), 'Disposisi ditandai selesai.')
    })
    wadah.querySelector('[data-aksi="simpan-hasil"]')?.addEventListener('click', () => jalankan(
      () => catatDisposisi(id, { hasil: ambilIsian('hasil')?.value, selesai: false }), 'Kemajuan tersimpan.'))
  })
  void keadaan
}

function bagianGalat() {
  const g = galatPenanganan()
  return g ? pesanSistem(`<b>Daftar tindak lanjut gagal dimuat.</b> ${amankan(g)}`, 'kritis', 'peringatan') : ''
}

export function halamanKlarifikasi({ keadaan, isi }) {
  pastikanDimuat()
  const peran = keadaan.profil?.role
  const unit = adalahUnit(peran)
  const pusat = !adalahEksternal(peran)
  const bolehKelola = !unit
  const semua = penangananSaatIni().filter((p) => p.tujuan === 'klarifikasi_upt')
  const h = hitungPenanganan(semua)
  const terlihat = semua
    .filter(cocokSaring)
    .sort((a, b) => Number(lewatBatas(b)) - Number(lewatBatas(a))
      || String(b.diperbarui_pada).localeCompare(String(a.diperbarui_pada)))

  isi.innerHTML = `
    <div class="tumpuk">
      ${bagianGalat()}
      ${unit ? pesanSistem('<b>Klarifikasi UPT.</b> Pemberitaan negatif tentang unit Anda yang diminta klarifikasinya oleh kanwil. '
        + 'Isi laporan klarifikasi menurut format resmi (atau unggah berkasnya), lalu isi nama serta jabatan pengirim. Kanwil dan pusat diberi tahu otomatis.', 'aksen', 'info') : ''}
      ${unit ? kartuFormat(unit) : ''}
      <div class="kisi kisi-4">
        ${unit
          ? ubin({ label: 'Permintaan', nilai: semua.length, kaki: 'untuk unit Anda', nada: 'netral' })
          : ubin({ label: 'Belum diteruskan', nilai: h.belumDiteruskan, kaki: 'menunggu kanwil', nada: h.belumDiteruskan ? 'sedang' : 'netral' })}
        ${ubin({ label: 'Belum menginput', nilai: h.belumMenginput, kaki: `${angka(h.lewat)} lewat batas`, nada: h.belumMenginput ? 'tinggi' : 'positif' })}
        ${ubin({ label: 'Sudah menginput', nilai: h.sudahMenginput, kaki: 'menunggu dinilai', nada: h.sudahMenginput ? 'aksen' : 'netral' })}
        ${ubin({ label: 'Selesai', nilai: h.diterima, kaki: `dari ${angka(semua.length)} permintaan`, nada: 'positif' })}
      </div>
      ${unit ? '' : kartuFormat(unit)}
      <div class="segmen" role="group" aria-label="Saring status">
        ${SARING_KLARIFIKASI.filter(([k]) => !(unit && k === 'menunggu_kanwil')).map(([k, l]) =>
          `<button data-saring-penanganan="${k}" aria-pressed="${keadaanTab.saring === k}">${amankan(l)}</button>`).join('')}
      </div>
      ${kartu({
        judul: pusat ? 'Klarifikasi UPT per kanwil' : unit ? 'Permintaan klarifikasi untuk unit Anda' : 'Klarifikasi UPT di wilayah Anda',
        ket: `${angka(terlihat.length)} butir tampil`,
        isi: terlihat.length
          ? daftarBerkelompok(terlihat, pusat, (p) => butirKlarifikasi(p, { peran, unit, bolehKelola }))
          : kosong('Belum ada permintaan klarifikasi', unit
            ? 'Belum ada pemberitaan tentang unit Anda yang dimintakan klarifikasi.'
            : 'Analisis berita negatif di menu Analisis Berita, lalu pilih tujuan Klarifikasi UPT.'),
      })}
    </div>`

  pasangPenyimak(isi, keadaan)
  return { judul: 'Klarifikasi UPT', sub: unit ? 'Klarifikasi pemberitaan tentang unit Anda' : 'Diteruskan kanwil, diinput UPT, dinilai kanwil/pusat' }
}

/* ------------------------------------------------------- disposisi pimpinan */

function butirDisposisi(p, { bolehKelola }) {
  const sibuk = keadaanTab.sibuk === p.id
  let aksi = ''
  if (bolehKelola && p.status === 'menunggu_disposisi') {
    aksi = `
      <div class="penanganan-aksi" data-id="${amankan(p.id)}">
        <div class="label-mono">Catat disposisi pimpinan</div>
        <div class="sip-kisi" style="margin-top:6px">
          <label><span class="label-mono">Dari pimpinan</span><input class="masukan" data-isian="pimpinan" value="${amankan(p.pimpinan || '')}" placeholder="mis. Direktur Kamtib"></label>
          <label><span class="label-mono">Batas waktu</span><input class="masukan" type="date" data-isian="batas" value="${tglDepan(7)}"></label>
        </div>
        <label class="bidang" style="margin-top:6px"><span class="label-mono">Isi disposisi</span>
          <textarea class="masukan area" data-isian="isi" rows="2" placeholder="Arahan pimpinan"></textarea></label>
        <div style="margin-top:6px">${tombol({ label: 'Catat disposisi', ikon: 'centang', gaya: 'utama', kecil: true, aksi: 'catat-disposisi', nonaktif: sibuk })}</div>
      </div>`
  } else if (bolehKelola && p.status === 'dalam_proses') {
    aksi = `
      <div class="penanganan-aksi" data-id="${amankan(p.id)}">
        <label class="bidang"><span class="label-mono">Hasil / kemajuan tindak lanjut</span>
          <textarea class="masukan area" data-isian="hasil" rows="2">${amankan(p.hasil_tindak || '')}</textarea></label>
        <div class="baris gap-6" style="margin-top:6px">
          ${tombol({ label: 'Simpan kemajuan', ikon: 'centang', kecil: true, aksi: 'simpan-hasil', nonaktif: sibuk })}
          ${tombol({ label: 'Tandai selesai', ikon: 'centang', gaya: 'utama', kecil: true, aksi: 'selesai-disposisi', nonaktif: sibuk })}
        </div>
      </div>`
  }
  return `
    <article class="penanganan-butir${lewatBatas(p) ? ' lewat' : ''}">
      ${kepalaButir(p, { unit: false })}
      ${p.isi_disposisi ? `<div class="penanganan-masuk"><div class="mini-teks"><b>Disposisi${p.pimpinan ? ` ${amankan(p.pimpinan)}` : ''}:</b> ${amankan(p.isi_disposisi)}</div>
        ${p.hasil_tindak ? `<div class="mini-teks" style="margin-top:4px"><b>Hasil:</b> ${amankan(p.hasil_tindak)}</div>` : ''}</div>` : ''}
      ${rincianAnalisis(p)}
      ${aksi}
    </article>`
}

export function halamanDisposisi({ keadaan, isi }) {
  pastikanDimuat()
  const peran = keadaan.profil?.role
  const pusat = !adalahEksternal(peran)
  const semua = penangananSaatIni().filter((p) => p.tujuan === 'disposisi_pimpinan')
  const menunggu = semua.filter((p) => p.status === 'menunggu_disposisi')
  const jalan = semua.filter((p) => p.status === 'dalam_proses')
  const selesai = semua.filter((p) => p.status === 'selesai')
  const urut = [...menunggu, ...jalan, ...selesai]

  isi.innerHTML = `
    <div class="tumpuk">
      ${bagianGalat()}
      <div class="kisi kisi-4">
        ${ubin({ label: 'Menunggu disposisi', nilai: menunggu.length, kaki: 'perlu putusan pimpinan', nada: menunggu.length ? 'sedang' : 'netral' })}
        ${ubin({ label: 'Dalam proses', nilai: jalan.length, kaki: `${angka(jalan.filter((p) => lewatBatas(p)).length)} lewat batas`, nada: 'aksen' })}
        ${ubin({ label: 'Selesai', nilai: selesai.length, kaki: `dari ${angka(semua.length)} disposisi`, nada: 'positif' })}
        ${ubin({ label: 'Kanwil terlibat', nilai: new Set(semua.map((p) => p.kanwil)).size, kaki: pusat ? 'seluruh wilayah' : 'wilayah Anda', nada: 'netral' })}
      </div>
      ${kartu({
        judul: pusat ? 'Disposisi pimpinan per kanwil' : 'Disposisi pimpinan di wilayah Anda',
        ket: 'Berita yang dianalisis dengan tujuan tindak lanjut disposisi pimpinan.',
        isi: urut.length
          ? daftarBerkelompok(urut, pusat, (p) => butirDisposisi(p, { bolehKelola: true }))
          : kosong('Belum ada disposisi', 'Analisis berita negatif di menu Analisis Berita, lalu pilih tujuan Tindak lanjut disposisi pimpinan.'),
      })}
    </div>`

  pasangPenyimak(isi, keadaan)
  return { judul: 'Disposisi Pimpinan', sub: 'Disposisi dicatat, dikerjakan, dan dilaporkan hasilnya' }
}
