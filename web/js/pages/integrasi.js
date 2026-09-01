/**
 * Integrasi dan Kunci — penyiapan bot Telegram dan pemantauan sambungan luar.
 *
 * Halaman ini ada karena satu kegagalan yang berulang: penyiapan Telegram
 * berhenti berhari-hari pada langkah menempelkan kunci bot, dan tidak ada satu
 * pun layar yang bisa menjelaskan kenapa. Kuncinya tersimpan di sisi peladen,
 * pesan galat Telegram hanya berbunyi "Not Found", dan satu-satunya cara
 * memeriksanya adalah lewat baris perintah oleh orang yang memegang kunci
 * peladen — yang bukan orang yang menempelkan kuncinya.
 *
 * Maka yang ditampilkan di sini bukan formulir pengaturan, melainkan sebuah
 * pemeriksaan. Petugas menekan satu tombol, dan layar menjawab dengan kalimat
 * yang menyebutkan persis apa yang salah pada nilai yang tersimpan — tanpa
 * pernah menampilkan nilainya sendiri.
 *
 * Kunci bot tidak pernah masuk ke peramban. Ia hidup sebagai secret Edge
 * Function, dan halaman ini hanya melihat hasil pemeriksaannya: panjangnya,
 * susunan jenis karakternya, dan apakah Telegram mengenalinya. Tidak ada
 * kolom isian untuk kunci di halaman ini, dan tidak boleh pernah ada — kolom
 * semacam itu berarti kuncinya melewati peramban, dan apa pun yang melewati
 * peramban bisa tertinggal di sana.
 */

import { kartu, tombol, keping, kosong, pesanSistem, roti, konfirmasi } from '../ui/komponen.js'
import { amankan, tanggalJam, jarakWaktu } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { panggilEdge, ambil, pesanRamah } from '../lib/api.js'

/* ------------------------------------------------------------------ contoh */

/** Keadaan peragaan: bot tersambung, satu grup terdaftar, satu belum. */
const DIAGNOSA_DEMO = {
  terpasang: true,
  tersambung: true,
  bot: { nama: 'Trans-Siber PAS Bot', pengguna: 'transsiberpas_bot', id: 7654321098 },
  pemeriksaan_kunci: {
    panjang_total: 46,
    nomor_bot: '7654321098',
    panjang_bagian_rahasia: 35,
    susunan: { huruf: 24, angka: 21, titik_dua: 1, lainnya: 0 },
    bentuk_wajar: true,
    ringkas: 'Bentuk kunci tampak wajar.',
    temuan: [],
  },
  grup_terdeteksi: [
    { chat_id: '-1002145887301', nama: 'Grup Pimpinan Dirpamintel', jenis: 'supergroup', utasan: null },
    { chat_id: '-1002088341170', nama: 'Piket Intelijen 24 Jam', jenis: 'supergroup', utasan: '12' },
  ],
  grup_tersimpan: [
    {
      id: 'demo-1', chat_id: '-1002145887301', label: 'Grup Pimpinan Dirpamintel',
      is_active: true, message_thread_id: null, min_classification: 'Terbatas',
      report_types: ['harian', 'mingguan'], send_urgent_alert: true,
    },
  ],
  catatan: 'Grup di atas sudah bisa dijangkau bot ini.',
}

const KIRIMAN_DEMO = [
  { id: 'd1', status: 'sent', delivery_type: 'report', trigger_type: 'scheduled', chat_id: '-1002145887301', caption: 'Laporan Harian Trans-Siber PAS — 22 Agustus 2026', requested_by: 'Penjadwal', requested_at: new Date(Date.now() - 3600e3).toISOString(), delivered_at: new Date(Date.now() - 3598e3).toISOString() },
  { id: 'd2', status: 'sent', delivery_type: 'urgent_alert', trigger_type: 'manual', chat_id: '-1002145887301', caption: 'PERINGATAN DINI — Kerusuhan Lapas Kelas IIA Cilegon', requested_by: 'Analis OSINT', requested_at: new Date(Date.now() - 26 * 3600e3).toISOString(), delivered_at: new Date(Date.now() - 26 * 3600e3).toISOString() },
  { id: 'd3', status: 'failed', delivery_type: 'report', trigger_type: 'scheduled', chat_id: '-1002088341170', caption: 'Laporan Harian Trans-Siber PAS — 21 Agustus 2026', requested_by: 'Penjadwal', requested_at: new Date(Date.now() - 50 * 3600e3).toISOString(), error_detail: 'Telegram menolak sendMessage: bot was kicked from the supergroup chat' },
]

/* ------------------------------------------------------------------ bagian */

/**
 * Empat langkah penyiapan, dan yang mana yang sedang berlaku.
 *
 * Menampilkan seluruh langkah sekaligus — bukan hanya yang sedang berjalan —
 * disengaja. Petugas yang macet di langkah dua perlu melihat bahwa masih ada
 * dua langkah lagi sesudahnya, supaya ia tidak menyangka semuanya sudah selesai
 * ketika kuncinya akhirnya diterima.
 */
function langkah(d) {
  const adaTujuan = (d?.grup_tersimpan || []).some((g) => g.is_active)
  const daftar = [
    {
      judul: 'Buat bot dan ambil kuncinya',
      isi: 'Di Telegram, buka @BotFather → /newbot (atau /mybots bila botnya sudah ada) → API Token.',
      selesai: Boolean(d?.terpasang),
    },
    {
      judul: 'Tempel kunci sebagai secret peladen',
      isi: 'Supabase → Project Settings → Edge Functions → Secrets, dengan nama TELEGRAM_BOT_TOKEN. '
        + 'Kuncinya tidak pernah melewati halaman ini.',
      selesai: Boolean(d?.tersambung),
    },
    {
      judul: 'Masukkan bot ke grup, lalu kirim satu pesan di sana',
      isi: 'Telegram hanya memberi tahu bot tentang grup yang pernah mengirimi ia pesan. '
        + 'Satu pesan apa pun sudah cukup.',
      selesai: Boolean(d?.grup_terdeteksi?.length),
    },
    {
      judul: 'Daftarkan grup sebagai tujuan pengiriman',
      isi: 'Grup yang terdeteksi belum otomatis menerima laporan. Ia harus didaftarkan lebih dulu, '
        + 'lengkap dengan batas klasifikasi yang boleh masuk ke sana.',
      selesai: adaTujuan,
    },
  ]

  const berjalan = daftar.findIndex((l) => !l.selesai)

  return `<ol class="langkah">${daftar.map((l, i) => `
    <li class="langkah-butir${l.selesai ? ' selesai' : i === berjalan ? ' berjalan' : ''}">
      <span class="langkah-nomor">${l.selesai ? ikon('centang') : i + 1}</span>
      <div>
        <b>${amankan(l.judul)}</b>
        <p>${amankan(l.isi)}</p>
      </div>
    </li>`).join('')}</ol>`
}

/** Kepala halaman: satu kalimat yang menyatakan keadaan sambungan. */
function panelStatus(d, galat) {
  if (galat) {
    return pesanSistem(
      `<b>Pemeriksaan tidak dapat dijalankan.</b> ${amankan(galat)}`,
      'kritis', 'peringatan',
    )
  }
  if (!d) {
    return pesanSistem(
      '<b>Sambungan belum diperiksa.</b> Tekan “Periksa sambungan” untuk menanyakan keadaan '
      + 'kunci bot ke peladen.', 'netral', 'info',
    )
  }

  if (!d.terpasang) {
    return pesanSistem(
      '<b>Kunci bot belum dipasang.</b> Secret <code>TELEGRAM_BOT_TOKEN</code> belum ada di Edge '
      + 'Function, sehingga tidak ada satu pun laporan yang bisa dikirim.', 'tinggi', 'peringatan',
    )
  }

  if (!d.tersambung) {
    const p = d.pemeriksaan_kunci || {}
    const rincian = [
      `panjang ${p.panjang_total ?? '?'} karakter`,
      p.susunan ? `${p.susunan.huruf} huruf, ${p.susunan.angka} angka, ${p.susunan.titik_dua} titik dua` : '',
    ].filter(Boolean).join(' · ')

    return `
      <div class="pesan" data-nada="kritis">
        ${ikon('peringatan')}
        <div>
          <b>Kunci bot ditolak.</b> ${amankan(p.ringkas || d.galat || 'Telegram tidak mengenali kunci ini.')}
          ${rincian ? `<div class="pesan-rinci">Yang tersimpan sekarang: ${amankan(rincian)}. Nilainya sendiri tidak ditampilkan.</div>` : ''}
          ${d.petunjuk ? `<div class="pesan-rinci">${amankan(d.petunjuk)}</div>` : ''}
        </div>
      </div>`
  }

  const b = d.bot || {}
  return `
    <div class="pesan" data-nada="positif">
      ${ikon('centang')}
      <div>
        <b>Bot tersambung.</b> ${amankan(b.nama || 'Bot Telegram')}
        ${b.pengguna ? `<span class="mono">@${amankan(b.pengguna)}</span>` : ''}
        menjawab dengan normal.
        <div class="pesan-rinci">${amankan(d.catatan || '')}</div>
      </div>
    </div>`
}

/** Grup yang bot-nya sudah bisa jangkau, tetapi belum jadi tujuan pengiriman. */
function daftarTerdeteksi(d) {
  const tersimpan = new Set((d?.grup_tersimpan || []).map((g) => String(g.chat_id)))
  const baru = (d?.grup_terdeteksi || []).filter((g) => !tersimpan.has(String(g.chat_id)))

  if (!d?.tersambung) {
    return kosong(
      'Belum ada grup yang bisa diperiksa',
      'Daftar grup baru bisa diambil setelah kunci bot diterima Telegram.',
    )
  }

  if (!baru.length) {
    return kosong(
      'Tidak ada grup baru',
      (d.grup_terdeteksi || []).length
        ? 'Seluruh grup yang menjangkau bot ini sudah terdaftar sebagai tujuan pengiriman.'
        : 'Masukkan bot ke grup, kirim satu pesan apa saja di grup itu, lalu periksa ulang.',
    )
  }

  return `<div class="grup-daftar">${baru.map((g) => `
    <div class="grup-baris">
      <div class="grup-tanda">${ikon('kirim')}</div>
      <div style="min-width:0;flex:1">
        <div class="grup-nama potong">${amankan(g.nama)}</div>
        <div class="grup-meta">
          <span class="mono">${amankan(g.chat_id)}</span> · ${amankan(g.jenis || 'grup')}
          ${g.utasan ? ` · utasan ${amankan(g.utasan)}` : ''}
        </div>
      </div>
      ${tombol({
        label: 'Daftarkan', ikon: 'tambah', gaya: 'utama', kecil: true,
        aksi: `daftarkan:${g.chat_id}`,
      })}
    </div>`).join('')}</div>`
}

const KLASIFIKASI = ['Publik', 'Internal', 'Terbatas', 'Rahasia']

/** Tujuan pengiriman yang sudah tersimpan, beserta aturan penyaringnya. */
function daftarTujuan(d, bisaKirim) {
  const daftar = d?.grup_tersimpan || []
  if (!daftar.length) {
    return kosong(
      'Belum ada tujuan pengiriman',
      'Laporan tidak akan terkirim ke mana pun sampai setidaknya satu grup didaftarkan di sini.',
    )
  }

  return `
    <div class="tabel-bungkus">
    <table class="tabel">
      <thead><tr>
        <th>Grup</th><th>Batas klasifikasi</th><th>Menerima</th><th>Keadaan</th><th></th>
      </tr></thead>
      <tbody>${daftar.map((g) => `
        <tr${g.is_active ? '' : ' class="redup"'}>
          <td>
            <div class="tebal">${amankan(g.label)}</div>
            <div class="ket mono">${amankan(g.chat_id)}${g.message_thread_id ? ` · utasan ${amankan(g.message_thread_id)}` : ''}</div>
          </td>
          <td>${keping(g.min_classification || 'Internal', 'rendah', true)}</td>
          <td class="ket">
            ${amankan((g.report_types || []).join(', ') || 'tidak ada laporan berkala')}
            ${g.send_urgent_alert ? ' · peringatan dini' : ''}
          </td>
          <td>${g.is_active ? keping('Aktif', 'positif') : keping('Nonaktif', 'rendah')}</td>
          <td class="rata-kanan">
            <div class="baris gap-6 rata-kanan dorong-kanan">
              ${bisaKirim && g.is_active ? tombol({ label: 'Kirim uji', ikon: 'kirim', kecil: true, aksi: `uji:${g.chat_id}` }) : ''}
              ${g.is_active ? tombol({ label: 'Nonaktifkan', kecil: true, gaya: 'samar', aksi: `matikan:${g.id}` }) : ''}
            </div>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>`
}

/** Riwayat pengiriman — bukti bahwa laporan benar-benar sampai. */
function riwayat(baris) {
  if (!baris?.length) {
    return kosong(
      'Belum ada jejak pengiriman',
      'Setiap pengiriman, berhasil maupun gagal, akan tercatat di sini beserta sebabnya.',
    )
  }

  const NAMA_JENIS = {
    report: 'Laporan berkala', urgent_alert: 'Peringatan dini',
    case_update: 'Perkembangan kasus', test: 'Percobaan',
  }
  const NAMA_STATUS = { sent: 'Terkirim', failed: 'Gagal', pending: 'Menunggu', skipped: 'Dilewati' }
  const NADA_STATUS = { sent: 'positif', failed: 'kritis', pending: 'sedang', skipped: 'rendah' }

  return `
    <div class="tabel-bungkus">
    <table class="tabel">
      <thead><tr><th>Waktu</th><th>Jenis</th><th>Isi</th><th>Status</th></tr></thead>
      <tbody>${baris.map((b) => `
        <tr>
          <td class="mono nowrap kecil-teks">${amankan(jarakWaktu(b.requested_at))}</td>
          <td>
            <div>${amankan(NAMA_JENIS[b.delivery_type] || b.delivery_type)}</div>
            <div class="ket">${amankan(b.trigger_type === 'scheduled' ? 'penjadwal' : b.requested_by || 'manual')}</div>
          </td>
          <td>
            <div class="potong-2">${amankan(b.caption || '—')}</div>
            ${b.error_detail ? `<div class="ket kritis-teks">${amankan(b.error_detail)}</div>` : ''}
          </td>
          <td>${keping(NAMA_STATUS[b.status] || b.status, NADA_STATUS[b.status] || 'rendah')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>`
}

/* ------------------------------------------------------------------ halaman */

export function halamanIntegrasi({ keadaan, isi }) {
  const demo = keadaan.demo
  const peran = keadaan.profil?.role
  const bisaKirim = peran === 'super_admin' || peran === 'media_intelligence_analyst'

  // Hasil pemeriksaan disimpan pada keadaan halaman, bukan pada keadaan global.
  // Diagnosa memanggil Telegram; menjalankannya ulang setiap kali layar
  // digambar berarti memanggil Telegram setiap kali seseorang mengetik.
  const lokal = { diagnosa: demo ? DIAGNOSA_DEMO : null, galat: null, sibuk: false, kiriman: demo ? KIRIMAN_DEMO : [] }

  function gambar() {
    const d = lokal.diagnosa

    isi.innerHTML = `
      <div class="tumpuk">
        ${panelStatus(d, lokal.galat)}

        <div class="kisi kisi-integrasi">
          ${kartu({
            judul: 'Penyiapan bot Telegram',
            ket: 'Empat langkah, berurutan. Yang bertanda centang sudah terpenuhi.',
            aksi: tombol({
              label: lokal.sibuk ? 'Memeriksa…' : 'Periksa sambungan',
              ikon: 'segar', gaya: 'utama', aksi: 'periksa', nonaktif: lokal.sibuk,
            }),
            isi: langkah(d),
          })}

          ${kartu({
            judul: 'Keterangan kunci',
            ket: 'Sifat nilai yang tersimpan — bukan nilainya',
            isi: keteranganKunci(d),
          })}
        </div>

        ${kartu({
          judul: 'Grup yang menjangkau bot',
          ket: 'Grup yang pernah mengirimi bot ini pesan, tetapi belum menjadi tujuan pengiriman',
          isi: daftarTerdeteksi(d),
        })}

        ${kartu({
          judul: 'Tujuan pengiriman',
          ket: 'Grup yang menerima laporan dan peringatan, beserta batas klasifikasinya',
          isi: daftarTujuan(d, bisaKirim),
        })}

        ${kartu({
          judul: 'Riwayat pengiriman',
          ket: 'Tiga puluh pengiriman terakhir, berhasil maupun gagal',
          isi: riwayat(lokal.kiriman),
        })}
      </div>`
  }

  /** Ringkasan sifat kunci. Sengaja tanpa satu pun karakter dari kuncinya. */
  function keteranganKunci(d) {
    if (!d?.terpasang) {
      return `<div class="ket" style="padding:6px 0">
        Belum ada nilai tersimpan untuk <code>TELEGRAM_BOT_TOKEN</code>.
      </div>`
    }
    const p = d.pemeriksaan_kunci || {}
    const s = p.susunan || {}
    const baris = [
      ['Nomor bot', p.nomor_bot ? `<span class="mono">${amankan(p.nomor_bot)}</span>` : '<span class="ket">tidak terbaca</span>'],
      ['Panjang total', `${p.panjang_total ?? '—'} karakter`],
      ['Bagian rahasia', p.panjang_bagian_rahasia != null ? `${p.panjang_bagian_rahasia} karakter` : '<span class="ket">tidak ada</span>'],
      ['Susunan', `${s.huruf ?? 0} huruf · ${s.angka ?? 0} angka · ${s.titik_dua ?? 0} titik dua · ${s.lainnya ?? 0} lainnya`],
      ['Bentuk', p.bentuk_wajar ? keping('Wajar', 'positif') : keping('Tidak wajar', 'kritis')],
    ]

    return `
      <dl class="ringkas-nilai">
        ${baris.map(([k, v]) => `<div><dt>${amankan(k)}</dt><dd>${v}</dd></div>`).join('')}
      </dl>
      ${(p.temuan || []).length ? `<ul class="temuan">${p.temuan.map((t) => `<li>${amankan(t)}</li>`).join('')}</ul>` : ''}
      <p class="ket" style="margin-top:12px">
        Nilai kuncinya tidak pernah dikirim ke halaman ini. Yang diperiksa hanya bentuknya,
        supaya kesalahan penempelan bisa dikenali tanpa siapa pun perlu membaca kuncinya.
      </p>`
  }

  /* ------------------------------------------------------------ tindakan */

  async function periksa() {
    if (demo) { roti('Mode peragaan tidak menghubungi Telegram.', 'sedang'); return }
    lokal.sibuk = true; lokal.galat = null; gambar()
    try {
      lokal.diagnosa = await panggilEdge('telegram-kirim', { aksi: 'diagnosa' })
    } catch (galat) {
      // Fungsi ini menjawab 400 dan 503 dengan badan yang justru berisi
      // penjelasannya. Badan itu yang dibutuhkan, bukan pesan galat HTTP-nya.
      if (galat?.rinci && typeof galat.rinci === 'object') {
        lokal.diagnosa = galat.rinci
        lokal.galat = null
      } else {
        lokal.galat = pesanRamah(galat)
      }
    } finally {
      lokal.sibuk = false
      await muatRiwayat()
      gambar()
    }
  }

  async function muatRiwayat() {
    if (demo) return
    try {
      lokal.kiriman = await ambil('telegram_deliveries', {
        select: 'id,status,delivery_type,trigger_type,chat_id,caption,requested_by,requested_at,delivered_at,error_detail',
        order: 'requested_at.desc',
        limit: 30,
      }) || []
    } catch {
      // Riwayat yang gagal dimuat tidak boleh menjatuhkan halaman penyiapan.
      lokal.kiriman = []
    }
  }

  async function daftarkan(chatId) {
    const g = (lokal.diagnosa?.grup_terdeteksi || []).find((x) => String(x.chat_id) === String(chatId))
    if (!g) return

    const ya = await konfirmasi({
      judul: 'Daftarkan grup ini?',
      pesan: `“${g.nama}” akan menerima laporan berkala dan peringatan dini. Batas klasifikasi `
        + 'awalnya "Internal" — laporan berklasifikasi Terbatas dan Rahasia tidak akan masuk ke sana '
        + 'sampai batasnya dinaikkan.',
      tegas: 'Daftarkan',
    })
    if (!ya) return

    try {
      await panggilEdge('telegram-kirim', {
        aksi: 'daftarkan',
        chat_id: g.chat_id,
        label: g.nama,
        message_thread_id: g.utasan,
        klasifikasi: 'Internal',
      })
      roti(`“${g.nama}” terdaftar sebagai tujuan pengiriman.`, 'positif')
      await periksa()
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    }
  }

  async function kirimUji(chatId) {
    try {
      const hasil = await panggilEdge('telegram-kirim', { aksi: 'uji', chat_id: chatId })
      const r = hasil?.rincian?.[0]
      if (r?.status === 'Berhasil') roti('Pesan percobaan terkirim. Periksa grupnya.', 'positif')
      else roti(r?.sebab || 'Pengiriman gagal.', 'kritis', 7000)
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    }
    await muatRiwayat(); gambar()
  }

  async function matikan(id) {
    const ya = await konfirmasi({
      judul: 'Nonaktifkan tujuan ini?',
      pesan: 'Grup berhenti menerima laporan, tetapi riwayat pengirimannya tetap tersimpan '
        + 'sebagai bukti. Tujuan ini bisa diaktifkan kembali dengan mendaftarkannya ulang.',
      tegas: 'Nonaktifkan', bahaya: true,
    })
    if (!ya) return
    try {
      await panggilEdge('telegram-kirim', { aksi: 'hapus', id })
      roti('Tujuan dinonaktifkan.', 'positif')
      await periksa()
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    }
  }

  isi.addEventListener('click', (ev) => {
    const aksi = ev.target.closest('[data-aksi]')?.dataset.aksi
    if (!aksi) return
    const [nama, arg] = aksi.split(':')
    if (nama === 'periksa') periksa()
    else if (nama === 'daftarkan') daftarkan(arg)
    else if (nama === 'uji') kirimUji(arg)
    else if (nama === 'matikan') matikan(arg)
  })

  gambar()

  // Pemeriksaan pertama dijalankan sendiri. Halaman yang membuka dengan
  // keadaan "belum diperiksa" memaksa setiap orang menekan satu tombol sebelum
  // melihat apa pun, dan tombol yang selalu ditekan lebih baik tidak ada.
  if (!demo) { periksa() }

  return {
    judul: 'Integrasi dan Kunci',
    sub: 'Bot Telegram, tujuan pengiriman, dan jejak sambungan',
  }
}
