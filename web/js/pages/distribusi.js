/**
 * Distribusi Telegram.
 *
 * Tempat laporan dan peringatan benar-benar berangkat. Tiga hal yang dijaga di
 * halaman ini, dan ketiganya adalah jawaban atas cacat sistem lama:
 *
 *   1. Tidak ada pengiriman tanpa pratinjau. Sistem lama mengirim apa pun yang
 *      keluar dari mesinnya — termasuk dua berita fiktif yang dibuat kodenya
 *      sendiri ketika penarikan data gagal, lengkap dengan nama unit dan
 *      ringkasan kejadian yang tidak pernah terjadi. Di sini, yang akan terkirim
 *      selalu terlihat lebih dulu, persis seperti yang akan dibaca penerimanya.
 *
 *   2. Tidak ada pengiriman tanpa tujuan yang jelas. Layar menyebutkan grup
 *      mana saja yang akan menerima, sebelum tombolnya ditekan.
 *
 *   3. Tidak ada pengiriman yang tidak tercatat. Setiap kiriman meninggalkan
 *      barisnya sendiri, berhasil maupun gagal, beserta sebabnya.
 */

import { kartu, tombol, keping, kosong, pesanSistem, roti, konfirmasi } from '../ui/komponen.js'
import { amankan, angka, tanggal, tanggalIso, jarakWaktu, nadaUrgensi } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { panggilEdge, panggilFungsi, ambil, pesanRamah } from '../lib/api.js'
import { olahLaporan, susunLaporan, nomorLaporan } from '../lib/laporan.js'
import { pesanLaporan, pesanPeringatan, BATAS_PESAN } from '../lib/pesan-telegram.js'

/* --------------------------------------------------------------- keadaan */

/** Bertahan selama sesi, supaya periode yang sudah dipilih tidak hilang. */
const pilihan = {
  jenis: 'harian',
  lampirkan: true,
  bahan: null,      // { olahan, html, nomor }
  pesan: '',
  sibuk: false,
  tujuan: [],
  kiriman: [],
  dimuat: false,
}

function isoHari(geser = 0) {
  const t = new Date()
  t.setDate(t.getDate() + geser)
  return tanggalIso(t)
}

function periode() {
  if (pilihan.jenis === 'harian') return { mulai: isoHari(0), selesai: isoHari(0) }
  if (pilihan.jenis === 'mingguan') return { mulai: isoHari(-6), selesai: isoHari(0) }
  return { mulai: isoHari(-29), selesai: isoHari(0) }
}

function gambarUlang() {
  document.dispatchEvent(new CustomEvent('gambar-ulang'))
}

/* ---------------------------------------------------------------- bagian */

/**
 * Pratinjau pesan.
 *
 * Ditampilkan dalam gelembung yang meniru bentuk pesan Telegram, bukan sebagai
 * blok teks biasa. Bukan hiasan: penerimanya akan membaca pesan ini di ruang
 * selebar telepon, dan kalimat yang terlihat ringkas pada kotak selebar layar
 * kerja bisa menjadi delapan baris di sana.
 */
function pratinjau(html, sibuk) {
  if (sibuk) {
    return `<div class="gelembung"><div class="rangka" style="height:14px;width:70%"></div>
      <div class="rangka" style="height:14px;width:90%;margin-top:8px"></div>
      <div class="rangka" style="height:14px;width:55%;margin-top:8px"></div></div>`
  }
  if (!html) {
    return kosong(
      'Belum ada bahan',
      'Pilih periode lalu tekan “Susun ringkasan”. Tidak ada yang bisa dikirim sebelum isinya terlihat.',
    )
  }

  const panjang = html.replace(/<[^>]*>/g, '').length
  return `
    <div class="gelembung-wadah">
      <div class="gelembung">${html.replace(/\n/g, '<br>')}</div>
      <div class="gelembung-kaki">
        <span>${angka(panjang)} karakter terbaca · batas ${angka(BATAS_PESAN)}</span>
      </div>
    </div>`
}

/** Daftar grup yang akan menerima kiriman ini. */
function daftarPenerima(tujuan) {
  if (!tujuan.length) {
    return `<div class="pesan" data-nada="tinggi">${ikon('peringatan')}
      <div><b>Belum ada grup tujuan.</b> Laporan tidak akan sampai ke mana pun sampai
      setidaknya satu grup didaftarkan pada halaman Integrasi dan Kunci.
      <div class="pesan-rinci">${tombol({ label: 'Buka Integrasi dan Kunci', ikon: 'gembok', kecil: true, halaman: 'integrasi' })}</div>
      </div></div>`
  }

  return `<div class="penerima">${tujuan.map((t) => `
    <span class="penerima-keping">
      ${ikon('kirim')}<b>${amankan(t.label)}</b>
      <span class="ket">${amankan(t.min_classification || 'Internal')}</span>
    </span>`).join('')}</div>`
}

/** Berita yang layak dijadikan peringatan dini. */
function daftarMendesak(berita) {
  const calon = berita
    .filter((b) => ['Kritis', 'Tinggi'].includes(b.urgensi))
    .filter((b) => !['Tidak Valid', 'Diarsipkan'].includes(b.status_verifikasi))
    .slice(0, 12)

  if (!calon.length) {
    return kosong(
      'Tidak ada yang mendesak',
      'Tidak ada berita berurgensi tinggi atau kritis yang masih terbuka. Ini keadaan yang baik.',
    )
  }

  return `<div class="tumpuk-rapat">${calon.map((b) => `
    <div class="mendesak-baris">
      ${keping(b.urgensi, nadaUrgensi(b.urgensi))}
      <div style="min-width:0;flex:1">
        <div class="potong-2 tebal">${amankan(b.judul)}</div>
        <div class="ket">${amankan([b.subkategori, b.nama_upt, b.media].filter(Boolean).join(' · '))}</div>
      </div>
      ${tombol({ label: 'Kirim peringatan', ikon: 'kirim', kecil: true, aksi: `peringatan:${b.id}` })}
    </div>`).join('')}</div>`
}

/** Jadwal otomatis yang tersimpan di basis data. */
function daftarJadwal(jadwal) {
  if (!jadwal?.length) {
    return kosong('Belum ada jadwal', 'Pengiriman berkala otomatis belum diatur.')
  }
  return `
    <div class="tabel-bungkus">
    <table class="tabel">
      <thead><tr><th>Laporan</th><th>Jadwal</th><th>Kirim otomatis</th><th>Terakhir</th></tr></thead>
      <tbody>${jadwal.map((j) => `
        <tr${j.is_active ? '' : ' class="redup"'}>
          <td><div class="tebal">${amankan(j.label)}</div>
              <div class="ket">${amankan(j.report_type)}</div></td>
          <td><code>${amankan(j.cron_expression)}</code>
              <div class="ket">${amankan(j.timezone || 'Asia/Jakarta')}</div></td>
          <td>${j.auto_send_telegram ? keping('Ya', 'positif') : keping('Tidak', 'rendah')}
              ${j.auto_publish ? '' : '<div class="ket">menunggu pengesahan analis</div>'}</td>
          <td class="ket">${j.last_run_at ? amankan(jarakWaktu(j.last_run_at)) : 'belum pernah'}
              ${j.last_error ? `<div class="kritis-teks">${amankan(j.last_error)}</div>` : ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>`
}

/* --------------------------------------------------------------- halaman */

export function halamanDistribusi({ keadaan, isi }) {
  const demo = keadaan.demo

  function gambar() {
    const p = periode()
    const jenisTombol = [
      ['harian', 'Harian'],
      ['mingguan', 'Mingguan'],
      ['bulanan', 'Bulanan'],
    ].map(([k, l]) => `<button data-jenis="${k}" aria-pressed="${pilihan.jenis === k}">${l}</button>`).join('')

    const siap = Boolean(pilihan.pesan) && pilihan.tujuan.length > 0

    isi.innerHTML = `
      <div class="tumpuk">
        ${demo ? pesanSistem(
          '<b>Mode peragaan.</b> Tidak ada pesan yang benar-benar dikirim ke Telegram dari sini.',
          'sedang', 'info',
        ) : ''}

        ${kartu({
          judul: 'Ringkasan berkala',
          ket: `Periode ${tanggal(p.mulai)} – ${tanggal(p.selesai)}`,
          aksi: `
            <div class="segmen" role="group" aria-label="Jenis laporan">${jenisTombol}</div>
            ${tombol({
              label: pilihan.sibuk ? 'Menyusun…' : 'Susun ringkasan',
              ikon: 'segar', aksi: 'susun', nonaktif: pilihan.sibuk,
            })}`,
          isi: `
            <div class="kisi kisi-distribusi">
              <div>
                ${pratinjau(pilihan.pesan, pilihan.sibuk)}
              </div>
              <div class="tumpuk-rapat">
                <div>
                  <div class="label-mono">Akan diterima oleh</div>
                  ${daftarPenerima(pilihan.tujuan)}
                </div>

                <label class="centang-baris">
                  <input type="checkbox" data-pilih="lampirkan"${pilihan.lampirkan ? ' checked' : ''}>
                  <span>
                    <b>Lampirkan laporan utuh</b>
                    <span class="ket">Berkas HTML berisi seluruh diagram, tabel peristiwa, dan daftar
                    sumber. Bisa dibuka dan dicetak langsung dari Telegram.</span>
                  </span>
                </label>

                ${tombol({
                  label: `Kirim ke ${pilihan.tujuan.length} grup`,
                  ikon: 'kirim', gaya: 'utama', aksi: 'kirim-laporan',
                  nonaktif: !siap || pilihan.sibuk,
                })}

                <p class="ket">
                  Pengiriman tidak bisa dibatalkan. Telegram tidak menyediakan cara menarik
                  kembali pesan yang sudah dibaca, dan grup pimpinan tidak seharusnya menerima
                  ralat atas laporan yang seharusnya diperiksa lebih dulu.
                </p>
              </div>
            </div>`,
        })}

        ${kartu({
          judul: 'Peringatan dini',
          ket: 'Peristiwa berurgensi tinggi yang bisa dikirim satu per satu, tanpa menunggu laporan berkala',
          isi: daftarMendesak(keadaan.dalamLingkup || []),
        })}

        ${kartu({
          judul: 'Jadwal otomatis',
          ket: 'Dibaca penjadwal di dalam basis data setiap kali ia berjalan',
          isi: daftarJadwal(pilihan.jadwal),
        })}

        ${kartu({
          judul: 'Riwayat pengiriman',
          ket: 'Bukti bahwa laporan sampai — atau sebab kenapa tidak',
          isi: riwayatSingkat(pilihan.kiriman),
        })}
      </div>`
  }

  function riwayatSingkat(baris) {
    if (!baris?.length) {
      return kosong('Belum ada jejak pengiriman', 'Setiap kiriman akan tercatat di sini beserta hasilnya.')
    }
    const NAMA = { report: 'Laporan berkala', urgent_alert: 'Peringatan dini', case_update: 'Perkembangan kasus', test: 'Percobaan' }
    const NADA = { sent: 'positif', failed: 'kritis', pending: 'sedang', skipped: 'rendah' }
    const LABEL = { sent: 'Terkirim', failed: 'Gagal', pending: 'Menunggu', skipped: 'Dilewati' }

    return `<div class="tumpuk-rapat">${baris.slice(0, 12).map((b) => `
      <div class="jejak-baris">
        ${keping(LABEL[b.status] || b.status, NADA[b.status] || 'rendah')}
        <div style="min-width:0;flex:1">
          <div class="potong tebal">${amankan(NAMA[b.delivery_type] || b.delivery_type)}</div>
          <div class="ket potong">${amankan(b.caption || '—')}</div>
          ${b.error_detail ? `<div class="ket kritis-teks">${amankan(b.error_detail)}</div>` : ''}
        </div>
        <div class="ket nowrap">${amankan(jarakWaktu(b.requested_at))}</div>
      </div>`).join('')}</div>`
  }

  /* ------------------------------------------------------------ tindakan */

  async function susun() {
    pilihan.sibuk = true; gambar()
    const p = periode()

    try {
      let olahan
      let html
      if (demo) {
        // Mode peragaan menyusun dari berita yang sudah ada di layar, supaya
        // bentuk pesannya tetap bisa diperiksa tanpa menyentuh basis data.
        olahan = olahanDemo(keadaan)
        html = null
      } else {
        const snapshot = await panggilFungsi('snapshot_negatif', { p_mulai: p.mulai, p_selesai: p.selesai })
        const data = Array.isArray(snapshot) ? snapshot[0] : snapshot
        if (!data) throw new Error('Basis data tidak mengembalikan apa pun.')
        olahan = olahLaporan(data)
        html = susunLaporan(data, { jenis: pilihan.jenis, urutan: 1, nomor: nomorLaporan(pilihan.jenis, 1, p.selesai) })
      }

      const nomor = nomorLaporan(pilihan.jenis, 1, p.selesai)
      pilihan.bahan = { olahan, html, nomor }
      pilihan.pesan = pesanLaporan(olahan, { jenis: pilihan.jenis, nomor })
      roti(`Ringkasan tersusun: ${angka(olahan.ikhtisar.peristiwa)} peristiwa.`, 'positif')
    } catch (galat) {
      pilihan.bahan = null
      pilihan.pesan = ''
      roti(pesanRamah(galat), 'kritis', 6000)
    } finally {
      pilihan.sibuk = false; gambar()
    }
  }

  async function kirimLaporan() {
    if (!pilihan.bahan) return
    const ya = await konfirmasi({
      judul: `Kirim ke ${pilihan.tujuan.length} grup?`,
      pesan: `Pesan yang tampil di pratinjau akan dikirim apa adanya ke `
        + `${pilihan.tujuan.map((t) => t.label).join(', ')}. Pengiriman tidak dapat dibatalkan.`,
      tegas: 'Kirim sekarang',
    })
    if (!ya) return

    if (demo) { roti('Mode peragaan tidak mengirim apa pun ke Telegram.', 'sedang'); return }

    pilihan.sibuk = true; gambar()
    try {
      const dokumen = []
      if (pilihan.lampirkan && pilihan.bahan.html) {
        dokumen.push({
          nama: `${pilihan.bahan.nomor.replace(/[^\w-]/g, '-')}.html`,
          isi_base64: keBase64(pilihan.bahan.html),
          keterangan: `Laporan utuh — ${pilihan.bahan.nomor}`,
        })
      }

      const hasil = await panggilEdge('telegram-kirim', {
        aksi: 'kirim',
        jenis: 'laporan',
        pemicu: 'manual',
        teks: pilihan.pesan,
        dokumen,
      })

      if (hasil?.gagal) roti(`${hasil.terkirim} terkirim, ${hasil.gagal} gagal. Periksa riwayat di bawah.`, 'tinggi', 6000)
      else roti(`Terkirim ke ${hasil?.terkirim ?? 0} grup.`, 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    } finally {
      pilihan.sibuk = false
      await muat()
      gambar()
    }
  }

  async function kirimPeringatan(id) {
    const b = (keadaan.dalamLingkup || []).find((x) => String(x.id) === String(id))
    if (!b) return

    const pesan = pesanPeringatan(b, { oleh: keadaan.profil?.full_name })
    const ya = await konfirmasi({
      judul: 'Kirim peringatan dini?',
      pesan: b.status_verifikasi === 'Terverifikasi'
        ? `“${b.judul}” akan dikirim ke seluruh grup yang menerima peringatan dini.`
        : `Berita ini berstatus “${b.status_verifikasi || 'Belum Ditelaah'}” — belum diperiksa analis. `
          + 'Peringatan tetap akan menyebutkan status itu, tetapi isinya bisa berubah setelah ditelaah.',
      tegas: 'Kirim peringatan',
    })
    if (!ya) return

    if (demo) { roti('Mode peragaan tidak mengirim apa pun ke Telegram.', 'sedang'); return }

    try {
      const hasil = await panggilEdge('telegram-kirim', {
        aksi: 'kirim', jenis: 'peringatan', pemicu: 'manual', teks: pesan,
      })
      if (hasil?.gagal) roti(`${hasil.terkirim} terkirim, ${hasil.gagal} gagal.`, 'tinggi', 6000)
      else roti(`Peringatan terkirim ke ${hasil?.terkirim ?? 0} grup.`, 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    }
    await muat(); gambar()
  }

  /* ------------------------------------------------------------ pemuatan */

  async function muat() {
    if (demo) {
      pilihan.tujuan = [{ id: 'demo-1', label: 'Grup Pimpinan Dirpamintel', min_classification: 'Terbatas' }]
      pilihan.jadwal = [
        { label: 'Laporan Harian Trans-Siber PAS', report_type: 'harian', cron_expression: '50 16 * * *', timezone: 'Asia/Jakarta', is_active: true, auto_publish: false, auto_send_telegram: true, last_run_at: new Date(Date.now() - 8 * 3600e3).toISOString() },
        { label: 'Laporan Mingguan Trans-Siber PAS', report_type: 'mingguan', cron_expression: '50 16 * * 0', timezone: 'Asia/Jakarta', is_active: true, auto_publish: false, auto_send_telegram: true, last_run_at: null },
      ]
      pilihan.kiriman = []
      pilihan.dimuat = true
      return
    }

    // Ketiganya berdiri sendiri. Satu yang gagal tidak boleh menghapus dua
    // lainnya dari layar — tujuan yang tidak terbaca membuat tombol kirim mati,
    // dan itu sudah cukup sebagai penjagaan.
    const [tujuan, jadwal, kiriman] = await Promise.allSettled([
      ambil('telegram_targets', { select: 'id,label,chat_id,min_classification,report_types,send_urgent_alert', is_active: 'eq.true', order: 'created_at' }),
      ambil('report_schedules', { select: 'label,report_type,cron_expression,timezone,is_active,auto_publish,auto_send_telegram,last_run_at,last_error', order: 'report_type' }),
      ambil('telegram_deliveries', { select: 'id,status,delivery_type,caption,requested_at,error_detail', order: 'requested_at.desc', limit: 12 }),
    ])

    pilihan.tujuan = tujuan.status === 'fulfilled' ? (tujuan.value || []) : []
    pilihan.jadwal = jadwal.status === 'fulfilled' ? (jadwal.value || []) : []
    pilihan.kiriman = kiriman.status === 'fulfilled' ? (kiriman.value || []) : []
    pilihan.dimuat = true
  }

  isi.addEventListener('click', (ev) => {
    const jenis = ev.target.closest('[data-jenis]')?.dataset.jenis
    if (jenis) {
      pilihan.jenis = jenis
      pilihan.pesan = ''
      pilihan.bahan = null
      gambar()
      return
    }
    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (!aksi) return
    const [nama, arg] = aksi.split(':')
    if (nama === 'susun') susun()
    else if (nama === 'kirim-laporan') kirimLaporan()
    else if (nama === 'peringatan') kirimPeringatan(arg)
  })

  isi.addEventListener('change', (ev) => {
    if (ev.target.dataset.pilih === 'lampirkan') pilihan.lampirkan = ev.target.checked
  })

  gambar()
  if (!pilihan.dimuat) muat().then(gambar)

  return {
    judul: 'Distribusi Telegram',
    sub: 'Pengiriman laporan berkala dan peringatan dini ke grup pimpinan',
  }
}

/* ------------------------------------------------------------- pembantu */

/**
 * Teks UTF-8 menjadi base64.
 *
 * btoa() sendiri hanya menerima karakter Latin-1, dan laporan ini penuh dengan
 * tanda kutip melengkung, tanda pisah, serta huruf beraksen. Melewatkannya
 * langsung ke btoa() melempar InvalidCharacterError pada laporan pertama yang
 * memuat satu saja karakter semacam itu — yaitu semuanya.
 */
function keBase64(teks) {
  const bita = new TextEncoder().encode(teks)
  let biner = ''
  const POTONG = 0x8000
  for (let i = 0; i < bita.length; i += POTONG) {
    biner += String.fromCharCode(...bita.subarray(i, i + POTONG))
  }
  return btoa(biner)
}

/** Bahan peragaan, disusun dari berita contoh yang sudah ada di layar. */
function olahanDemo(keadaan) {
  const negatif = (keadaan.dalamLingkup || []).filter((b) => b.sentimen === 'Negatif')
  const peristiwa = negatif.slice(0, 8).map((b) => ({
    judul: b.judul,
    subkategori: b.subkategori,
    nama_upt: b.nama_upt,
    urgensi: b.urgensi,
    jumlah_publikasi: 1,
    jumlah_media: 1,
    rentang_hari: 1,
    publikasi: [b],
  }))

  const unit = new Map()
  for (const p of peristiwa) {
    if (!p.nama_upt) continue
    const u = unit.get(p.nama_upt) || { nama: p.nama_upt, provinsi: '-', publikasi: 0, media: 1, isu: [] }
    u.publikasi += 1
    unit.set(p.nama_upt, u)
  }

  const p = periode()
  return {
    periode: { mulai: p.mulai, selesai: p.selesai },
    konteks: { total: (keadaan.dalamLingkup || []).length, positif: (keadaan.dalamLingkup || []).filter((b) => b.sentimen === 'Positif').length },
    publikasi: negatif,
    peristiwa,
    mendesak: peristiwa.filter((x) => ['Tinggi', 'Kritis'].includes(x.urgensi)),
    perluTelaah: [],
    daftarUnit: [...unit.values()].sort((a, b) => b.publikasi - a.publikasi),
    perHari: [],
    perKategori: [],
    perSubkategori: [{ nama: peristiwa[0]?.subkategori || 'Lainnya', peristiwa: 1, publikasi: 1 }],
    perProvinsi: [],
    ikhtisar: {
      peristiwa: peristiwa.length,
      publikasi: negatif.length,
      media: 1,
      unit: unit.size,
      tanpaUnit: 0,
      mendesak: peristiwa.filter((x) => ['Tinggi', 'Kritis'].includes(x.urgensi)).length,
      kritis: peristiwa.filter((x) => x.urgensi === 'Kritis').length,
      eksposurTertinggi: 0,
    },
    dibuat_pada: new Date().toISOString(),
  }
}
