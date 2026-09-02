/**
 * Jejak Audit.
 *
 * Riwayat tindakan pengguna, hanya bisa dibaca. Tidak ada tombol sunting, dan
 * tidak ada tombol hapus — bukan karena belum sempat dibuat, melainkan karena
 * basis data memang tidak menyediakan jalannya: policy `audit_log` hanya
 * mengizinkan SELECT dan INSERT. Jejak yang bisa dihapus oleh yang
 * meninggalkannya bukan jejak.
 *
 * Tiga keputusan yang menentukan isi berkas ini:
 *
 *   Yang ditampilkan pertama adalah tindakan yang mengubah keadaan, bukan
 *   seluruh baris. Pembacaan halaman dan pemuatan daftar juga tercatat di
 *   tabel yang sama, dan jumlahnya puluhan kali lipat — membiarkannya
 *   bercampur membuat satu penghapusan pengguna tenggelam di antara tiga ratus
 *   pembukaan dasbor. Sakelar di atas memunculkannya kembali bagi yang memang
 *   sedang menelusuri.
 *
 *   Metadata ditampilkan apa adanya, tidak diterjemahkan. Isinya berbeda-beda
 *   menurut jenis tindakannya, dan penerjemah yang menebak bentuknya akan
 *   menampilkan "undefined" pada bentuk yang belum dikenalnya. Yang membaca
 *   halaman ini adalah administrator; JSON mentah adalah bahasa yang ia
 *   pahami, dan kebenaran lebih penting daripada kerapian di sini.
 *
 *   Superadmin melihat seluruh baris; peran lain hanya melihat barisnya
 *   sendiri. Itu ditegakkan policy RLS, bukan oleh penyaring di halaman ini —
 *   dan halaman ini menyebutkannya di layar supaya yang melihat daftar pendek
 *   tahu daftarnya memang dipangkas, bukan sistemnya yang sepi.
 */

import { kartu, keping, kosong, tombol, roti } from '../ui/komponen.js'
import { amankan, angka, tanggalJam, jarakWaktu } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, pesanRamah } from '../lib/api.js'
import { labelPeran } from '../lib/peran.js'

/**
 * Tindakan yang mengubah keadaan.
 *
 * Daftar ini menentukan apa yang tampil pada tampilan bawaan. Kata kunci,
 * bukan nama persis: tindakan baru bernama `berita_hapus_massal` ikut
 * tertangkap oleh "hapus" tanpa daftar ini perlu disunting lagi.
 */
const KATA_PENTING = [
  'buat', 'sisip', 'tambah', 'sunting', 'ubah', 'perbarui', 'hapus', 'buang',
  'telaah', 'verifikasi', 'putus', 'setuju', 'tolak', 'kirim', 'terbit',
  'peran', 'sandi', 'akun', 'pengguna', 'kunci', 'integrasi', 'sinkron',
  'koordinat', 'tugas', 'laporan', 'keputusan', 'rekomendasi', 'tindak',
]

/** Warna menurut watak tindakannya. */
function nadaTindakan(aksi) {
  const a = String(aksi || '').toLowerCase()
  if (/hapus|buang|cabut|nonaktif|tolak/.test(a)) return 'kritis'
  if (/ubah|sunting|perbarui|peran|sandi|kunci/.test(a)) return 'tinggi'
  if (/buat|sisip|tambah|terbit|setuju/.test(a)) return 'positif'
  if (/masuk|keluar|lihat|baca|buka/.test(a)) return 'netral'
  return 'rendah'
}

function penting(baris) {
  const a = String(baris.action || '').toLowerCase()
  return KATA_PENTING.some((k) => a.includes(k))
}

const keadaanAudit = {
  dimuat: false,
  galat: null,
  baris: [],
  cari: '',
  saringEntitas: 'Semua entitas',
  saringPelaku: 'Semua pelaku',
  hanyaPenting: true,
  batas: 60,
}

/* ------------------------------------------------------------------- muat */

async function muat(keadaan) {
  if (keadaan.demo) {
    keadaanAudit.baris = barisPeragaan()
    keadaanAudit.dimuat = true
    return
  }

  keadaanAudit.baris = await ambil('audit_log', {
    select: 'id,created_at,actor_username,actor_role,action,entity,entity_id,metadata',
    order: 'created_at.desc',
    limit: 500,
  }) || []
  keadaanAudit.dimuat = true
}

/**
 * Baris peragaan.
 *
 * Sengaja memuat satu tindakan dari tiap watak — penambahan, perubahan,
 * penghapusan, dan pembacaan — supaya pelatih bisa memperlihatkan bagaimana
 * keempatnya dibedakan warnanya tanpa menunggu keempatnya benar-benar terjadi.
 */
function barisPeragaan() {
  const lalu = (menit) => new Date(Date.now() - menit * 60_000).toISOString()
  return [
    { id: 1, created_at: lalu(6), actor_username: 'analis.media', actor_role: 'media_intelligence_analyst', action: 'kasus_buat', entity: 'intelligence_cases', entity_id: 'KI-260001', metadata: { judul: 'Kasus dibentuk dari peristiwa', publikasi: 4 } },
    { id: 2, created_at: lalu(24), actor_username: 'pimpinan', actor_role: 'executive_decision_maker', action: 'keputusan_terbit', entity: 'case_decisions', entity_id: 'KI-260004', metadata: { putusan: 'Disetujui dengan Catatan', rekomendasi: 3 } },
    { id: 3, created_at: lalu(75), actor_username: 'analis.media', actor_role: 'media_intelligence_analyst', action: 'berita_telaah_verifikasi', entity: 'berita', entity_id: 'b-8812', metadata: { dari: 'Belum Ditelaah', ke: 'Terverifikasi' } },
    { id: 4, created_at: lalu(150), actor_username: 'superadmin', actor_role: 'super_admin', action: 'pengguna_ubah_peran', entity: 'app_users', entity_id: 'u-31', metadata: { dari: 'kanwil_penelaah', ke: 'upt_penelaah' } },
    { id: 5, created_at: lalu(220), actor_username: 'petugas.lapangan', actor_role: 'field_verification_officer', action: 'laporan_lapangan_kirim', entity: 'field_reports', entity_id: 'ST-260002', metadata: { temuan: 'Terbukti Sebagian' } },
    { id: 6, created_at: lalu(400), actor_username: 'superadmin', actor_role: 'super_admin', action: 'berita_hapus', entity: 'berita', entity_id: 'b-7740', metadata: { alasan: 'duplikat penuh' } },
    { id: 7, created_at: lalu(520), actor_username: 'operator.puldata', actor_role: 'news_data_operator', action: 'sinkronisasi_jalan', entity: 'sheet_sync_log', entity_id: 's-9931', metadata: { baris_baru: 46, dilewati: 3 } },
    { id: 8, created_at: lalu(700), actor_username: 'pimpinan', actor_role: 'executive_decision_maker', action: 'dasbor_lihat', entity: 'ui', entity_id: null, metadata: {} },
  ]
}

/* --------------------------------------------------------------- penyaring */

function saring() {
  const kata = keadaanAudit.cari.trim().toLowerCase()
  return keadaanAudit.baris
    .filter((b) => !keadaanAudit.hanyaPenting || penting(b))
    .filter((b) => keadaanAudit.saringEntitas.startsWith('Semua') || b.entity === keadaanAudit.saringEntitas)
    .filter((b) => keadaanAudit.saringPelaku.startsWith('Semua') || b.actor_username === keadaanAudit.saringPelaku)
    .filter((b) => !kata || [b.action, b.entity, b.entity_id, b.actor_username, JSON.stringify(b.metadata || {})]
      .filter(Boolean).join(' ').toLowerCase().includes(kata))
}

/* ------------------------------------------------------------------- tabel */

function baris(b) {
  const meta = b.metadata && Object.keys(b.metadata).length ? b.metadata : null
  return `
    <tr>
      <td class="kecil" style="white-space:nowrap">
        <div>${amankan(tanggalJam(b.created_at))}</div>
        <div class="mini-teks samar-teks">${amankan(jarakWaktu(b.created_at))}</div>
      </td>
      <td>
        <div class="audit-pelaku">
          <b>${amankan(b.actor_username || 'tidak dikenali')}</b>
          <span class="mini-teks samar-teks">${amankan(labelPeran(b.actor_role) || b.actor_role || '—')}</span>
        </div>
      </td>
      <td>${keping(b.action || '—', nadaTindakan(b.action), true)}</td>
      <td class="kecil">
        <div class="mono">${amankan(b.entity || '—')}</div>
        ${b.entity_id ? `<div class="mini-teks samar-teks mono">${amankan(b.entity_id)}</div>` : ''}
      </td>
      <td class="kecil">
        ${meta ? `<code class="audit-meta">${amankan(JSON.stringify(meta))}</code>` : '<span class="samar-teks">—</span>'}
      </td>
    </tr>`
}

/* ------------------------------------------------------------------ halaman */

export function halamanAudit({ keadaan, isi }) {
  const superadmin = keadaan.profil?.role === 'super_admin'

  function gambar() {
    if (keadaanAudit.galat) {
      isi.innerHTML = kartu({
        isi: `<div class="pesan" data-nada="kritis">${ikon('peringatan')}
          <div><b>Jejak audit gagal dimuat.</b> ${amankan(keadaanAudit.galat)}</div></div>`,
      })
      return
    }
    if (!keadaanAudit.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:380px"></div>' })
      return
    }

    const semua = keadaanAudit.baris
    const hasil = saring()
    const tampil = hasil.slice(0, keadaanAudit.batas)

    const entitasAda = [...new Set(semua.map((b) => b.entity).filter(Boolean))].sort()
    const pelakuAda = [...new Set(semua.map((b) => b.actor_username).filter(Boolean))].sort()

    const sehari = semua.filter((b) => Date.now() - new Date(b.created_at).getTime() < 86_400_000)
    const berubah = semua.filter(penting)

    isi.innerHTML = `
      <div class="tumpuk">
        <div class="kisi kisi-4">
          ${ubinAudit('Baris termuat', semua.length, 'lima ratus terbaru')}
          ${ubinAudit('24 jam terakhir', sehari.length, 'tindakan tercatat')}
          ${ubinAudit('Mengubah keadaan', berubah.length, 'di luar pembacaan biasa')}
          ${ubinAudit('Pelaku berbeda', pelakuAda.length, 'akun yang muncul di rentang ini')}
        </div>

        ${superadmin ? '' : `
          <div class="pesan" data-nada="aksen">
            ${ikon('gembok')}
            <div>
              <b>Anda melihat jejak tindakan Anda sendiri.</b>
              Jejak seluruh pengguna hanya terbuka bagi Administrator Sistem Intelijen —
              itu ditegakkan basis data, bukan oleh tampilan ini. Daftar yang pendek di sini
              berarti tindakan Anda memang sedikit, bukan sistemnya yang sepi.
            </div>
          </div>`}

        <div class="bilah-alat">
          <label class="cari" style="max-width:270px">
            ${ikon('cari')}
            <input class="masukan" type="search" data-peran="cari-audit"
                   value="${amankan(keadaanAudit.cari)}"
                   placeholder="Cari tindakan, entitas, atau isi metadata"
                   aria-label="Cari jejak audit">
          </label>

          <select class="pilihan" data-saring="saringEntitas" aria-label="Saring entitas"
                  style="width:auto;min-width:170px">
            ${['Semua entitas', ...entitasAda].map((e) =>
              `<option${e === keadaanAudit.saringEntitas ? ' selected' : ''}>${amankan(e)}</option>`).join('')}
          </select>

          ${superadmin ? `
            <select class="pilihan" data-saring="saringPelaku" aria-label="Saring pelaku"
                    style="width:auto;min-width:160px">
              ${['Semua pelaku', ...pelakuAda].map((p) =>
                `<option${p === keadaanAudit.saringPelaku ? ' selected' : ''}>${amankan(p)}</option>`).join('')}
            </select>` : ''}

          <button class="tbl kecil${keadaanAudit.hanyaPenting ? ' utama' : ''}"
                  data-aksi="hanya-penting" aria-pressed="${keadaanAudit.hanyaPenting}">
            ${ikon('saring')}Hanya yang mengubah keadaan
          </button>

          <div class="dorong baris gap-6">
            <span class="mini-teks samar-teks">
              ${angka(tampil.length)} dari ${angka(hasil.length)} baris
            </span>
            ${tombol({ label: 'Unduh CSV', ikon: 'unduh', kecil: true, aksi: 'unduh-audit' })}
          </div>
        </div>

        ${hasil.length ? kartu({
          rapat: true,
          isi: `
            <div class="tabel-bungkus">
              <table class="tabel">
                <thead>
                  <tr>
                    <th style="width:150px">Waktu</th>
                    <th style="width:180px">Pelaku</th>
                    <th style="width:190px">Tindakan</th>
                    <th style="width:170px">Entitas</th>
                    <th>Metadata</th>
                  </tr>
                </thead>
                <tbody>${tampil.map(baris).join('')}</tbody>
              </table>
            </div>
            ${hasil.length > tampil.length ? `
              <div style="padding:12px;text-align:center;border-top:1px solid var(--line-3)">
                ${tombol({ label: `Tampilkan ${Math.min(60, hasil.length - tampil.length)} baris lagi`,
                  ikon: 'panahKanan', aksi: 'lebih-banyak' })}
              </div>` : ''}`,
        }) : kartu({
          isi: kosong(
            'Tidak ada baris yang cocok',
            'Longgarkan saringannya, atau matikan sakelar "hanya yang mengubah keadaan" untuk '
            + 'melihat pembacaan halaman dan pemuatan daftar juga.',
          ),
        })}

        <p class="ket" style="max-width:88ch">
          ${ikon('gembok')}
          <span>
            Jejak audit tidak dapat disunting maupun dihapus dari mana pun, termasuk dari
            layar ini — basis data hanya menerima penambahan baris. Yang tercatat keliru
            dikoreksi dengan baris baru, dan keduanya tetap terbaca.
          </span>
        </p>
      </div>`
  }

  function ubinAudit(label, nilai, kaki) {
    return `
      <div class="ubin" data-nada="netral">
        <div class="ubin-label">${amankan(label)}</div>
        <div class="ubin-nilai angka">${angka(nilai)}</div>
        <div class="ubin-kaki">${amankan(kaki)}</div>
      </div>`
  }

  /**
   * Unduhan CSV.
   *
   * Yang diunduh adalah hasil saringan yang sedang tampil, bukan seluruh
   * tabel. Administrator yang mengunduh sesudah menyaring hampir selalu
   * bermaksud membawa hasil saringannya ke luar — berkas berisi lima ratus
   * baris ketika yang di layar dua belas adalah kejutan yang tidak
   * menyenangkan.
   */
  function unduh() {
    const hasil = saring()
    if (!hasil.length) { roti('Tidak ada baris untuk diunduh.', 'sedang'); return }

    const kolom = ['waktu', 'pelaku', 'peran', 'tindakan', 'entitas', 'entitas_id', 'metadata']
    const kutip = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const isiCsv = [
      kolom.join(','),
      ...hasil.map((b) => [
        b.created_at, b.actor_username, b.actor_role, b.action,
        b.entity, b.entity_id, JSON.stringify(b.metadata || {}),
      ].map(kutip).join(',')),
    ].join('\n')

    // BOM di depan supaya Excel di Windows membaca UTF-8 dengan benar; tanpa
    // itu, setiap "é" dan setiap em dash pada catatan berubah menjadi sampah.
    const berkas = new Blob([`﻿${isiCsv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(berkas)
    const a = document.createElement('a')
    a.href = url
    a.download = `jejak-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    roti(`${angka(hasil.length)} baris diunduh.`, 'positif')
  }

  /* ---------------------------------------------------------------- penyimak */

  isi.addEventListener('click', (ev) => {
    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (aksi === 'hanya-penting') {
      keadaanAudit.hanyaPenting = !keadaanAudit.hanyaPenting
      keadaanAudit.batas = 60
      gambar()
    } else if (aksi === 'lebih-banyak') {
      keadaanAudit.batas += 60
      gambar()
    } else if (aksi === 'unduh-audit') unduh()
  })

  isi.addEventListener('change', (ev) => {
    const bidangSaring = ev.target.dataset.saring
    if (!bidangSaring) return
    keadaanAudit[bidangSaring] = ev.target.value
    keadaanAudit.batas = 60
    gambar()
  })

  let jeda = null
  isi.addEventListener('input', (ev) => {
    if (ev.target.dataset.peran !== 'cari-audit') return
    const nilai = ev.target.value
    clearTimeout(jeda)
    jeda = setTimeout(() => {
      keadaanAudit.cari = nilai
      keadaanAudit.batas = 60
      // Hanya badan tabel dan penghitungnya yang diganti, supaya fokus dan
      // letak kursor di kotak cari tidak hilang di tengah kata kedua.
      const badan = isi.querySelector('table.tabel tbody')
      const hasil = saring()
      if (badan) badan.innerHTML = hasil.slice(0, keadaanAudit.batas).map(baris).join('')
      else gambar()
    }, 200)
  })

  /* ------------------------------------------------------------------- muat */

  gambar()
  muat(keadaan)
    .then(gambar)
    .catch((galat) => {
      keadaanAudit.galat = pesanRamah(galat)
      gambar()
    })

  return {
    judul: 'Jejak Audit',
    sub: superadmin
      ? 'Riwayat tindakan seluruh pengguna — hanya bisa dibaca'
      : 'Riwayat tindakan Anda sendiri — hanya bisa dibaca',
  }
}
