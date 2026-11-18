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
import { ambil, sisip, perbarui, unggahBerkas, pesanRamah } from '../lib/api.js'
import { keadaan } from '../main.js'
import { adalahUnit, adalahEksternal, punyaIzin } from './../lib/peran.js'

const BATAS_BERKAS_MB = 20
const JENIS_DIIZINKAN = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']

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
          <option value="">— Pilih Kanwil —</option>
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
    <form class="tumpuk" style="gap:14px" novalidate>
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

      <div class="isian">
        <label>Berkas bukti <span class="wajib">wajib</span></label>
        <div class="ket">Gambar atau PDF, maksimal ${BATAS_BERKAS_MB} MB per berkas.</div>
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
    ? 'Anda sedang melapor atas unit Anda sendiri; tidak perlu memilih UPT.'
    : adalahEksternal(peran)
      ? 'Sebagai admin kanwil, pilih UPT di wilayah Anda yang menjadi obyek laporan.'
      : 'Sebagai operator pusat, pilih kanwil terlebih dahulu, baru UPT yang dilaporkan.'
  return `
    <div class="tumpuk" style="gap:10px">
      <div><b>Yang perlu disiapkan</b></div>
      <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px">
        <li>Screenshot bukti pemantauan siber (satu atau beberapa gambar).</li>
        <li>Atau PDF gabungan bila bukti lebih dari satu halaman.</li>
        <li>Penjelasan singkat apa yang terlihat pada berkas itu.</li>
      </ul>
      <div class="ket">${amankan(barisPeran)}</div>
      <div class="ket">Laporan tercatat dengan nama dan peran Anda. Analis akan meninjaunya kemudian.</div>
    </div>`
}

export async function halamanLaporLangsung(isi) {
  if (!punyaIzin(keadaan.profil?.role, 'lapor_langsung')) {
    isi.innerHTML = kartu({
      judul: 'Tidak berhak',
      isi: kosong('Fitur ini tidak tersedia untuk peran Anda', 'Hubungi administrator jika Anda seharusnya memiliki akses.', ''),
    })
    return { judul: 'Lapor Langsung', sub: '' }
  }

  await muatDaftar()

  function gambar() {
    isi.innerHTML = `
      <div class="kisi kisi-utama-samping">
        ${kartu({
          judul: 'Lapor Langsung',
          sub: 'Setor bukti pemantauan siber langsung ke tim analis',
          isi: `${panelHasil()}${formulir(keadaan.profil)}`,
        })}
        ${kartu({ judul: 'Panduan singkat', isi: panduanSisi(keadaan.profil) })}
      </div>`
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
      const berkasBaru = [...ev.target.files]
      for (const b of berkasBaru) {
        if (b.size > BATAS_BERKAS_MB * 1024 * 1024) {
          roti(`Berkas ${b.name} melebihi ${BATAS_BERKAS_MB} MB; dilewati.`, 'sedang', 6000)
          continue
        }
        const jenisOk = JENIS_DIIZINKAN.includes(b.type) || (b.type || '').startsWith('image/')
        if (!jenisOk) {
          roti(`Berkas ${b.name} jenisnya tidak didukung; dilewati.`, 'sedang', 6000)
          continue
        }
        keadaanLapor.berkas.push(b)
      }
      ev.target.value = ''
      gambar()
    }
    isi.querySelector('#ll-berkas')?.addEventListener('change', tangani)
    isi.querySelector('#ll-kamera')?.addEventListener('change', tangani)

    isi.querySelector('form')?.addEventListener('submit', async (ev) => {
      ev.preventDefault()
      await kirim(gambar)
    })
  }

  gambar()
  return { judul: 'Lapor Langsung', sub: 'Masukan intelijen dari lapangan' }
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

  keadaanLapor.mengirim = true
  gambar()

  try {
    const barisAwal = await sisip('lapor_langsung', {
      pelapor_user_id: profil.auth_user_id,
      pelapor_username: profil.username || null,
      pelapor_nama: profil.full_name || profil.username || 'Petugas',
      pelapor_role: profil.role || null,
      kanwil,
      nama_upt: namaUpt,
      judul: keadaanLapor.judul?.trim() || null,
      keterangan: keadaanLapor.keterangan.trim(),
      berkas: keadaanLapor.terunggah,
      status: 'baru',
    })
    const baris = Array.isArray(barisAwal) ? barisAwal[0] : barisAwal
    if (!baris?.id) throw new Error('Penyimpanan baris laporan gagal.')

    const terunggah = [...keadaanLapor.terunggah]
    for (const berkas of keadaanLapor.berkas) {
      try {
        const { jalur, ukuran } = await unggahBerkas('lapor-langsung', baris.id, berkas)
        terunggah.push({ jalur, nama: berkas.name, mime: berkas.type, ukuran })
      } catch (galat) {
        roti(`Gagal mengunggah ${berkas.name}: ${pesanRamah(galat)}`, 'kritis', 7000)
      }
    }

    if (terunggah.length) {
      await perbarui('lapor_langsung', { id: `eq.${baris.id}` }, { berkas: terunggah })
    }

    keadaanLapor.terakhir = { id: baris.id, jumlahBerkas: terunggah.length }
    keadaanLapor.berkas = []
    keadaanLapor.terunggah = []
    keadaanLapor.judul = ''
    keadaanLapor.keterangan = ''
    keadaanLapor.uptPilih = ''
    keadaanLapor.kanwilPilih = ''
    roti('Laporan tersimpan.', 'positif', 5000)
  } catch (galat) {
    roti(pesanRamah(galat), 'kritis', 7000)
    console.error(galat)
  } finally {
    keadaanLapor.mengirim = false
    gambar()
  }
}
