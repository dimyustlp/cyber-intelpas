/**
 * Kesehatan Sistem.
 *
 * Satu layar yang menjawab pertanyaan yang selalu ditanyakan pada saat yang
 * paling buruk: apakah sistemnya masih bekerja.
 *
 * Yang diperiksa di sini bukan "apakah peladen menyala" — peladen menyala
 * bukan kabar yang berguna. Yang diperiksa adalah apakah pekerjaan yang
 * seharusnya terjadi memang terjadi: penyalin menarik baris hari ini,
 * penjadwal menerbitkan laporan pagi tadi, pesan Telegram sampai ke grup
 * pimpinan. Ketiganya bisa berhenti tanpa satu pun galat muncul di layar
 * siapa pun, dan itulah kelas kegagalan yang paling lama tidak ketahuan.
 *
 * Tiga keputusan yang menentukan isi berkas ini:
 *
 *   Diamnya sebuah komponen dinilai sebagai kabar, bukan sebagai ketiadaan
 *   kabar. Penyalin yang tidak pernah gagal dan tidak pernah berjalan sejak
 *   tiga hari lalu bukan penyalin yang sehat; ia penyalin yang mati. Karena
 *   itu tiap komponen dinilai dari WAKTU kegiatan terakhirnya, bukan hanya
 *   dari status baris terakhirnya.
 *
 *   Ambang diamnya ditulis di layar, bukan hanya di dalam kode. Seseorang
 *   yang melihat "penyalin: perlu diperiksa" berhak tahu bahwa yang
 *   dimaksudkan adalah "tidak ada kegiatan lebih dari enam jam", dan bukan
 *   penilaian yang tidak bisa ditelusuri.
 *
 *   Gangguan yang belum ditutup berdiri di atas, dan hanya superadmin yang
 *   bisa menutupnya. Menutup gangguan berarti menyatakan sudah beres; itu
 *   pernyataan, bukan pembersihan layar.
 */

import { kartu, keping, kosong, tombol, roti } from '../ui/komponen.js'
import { amankan, angka, tanggalJam, jarakWaktu } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, perbarui, pesanRamah, profilSekarang } from '../lib/api.js'

/**
 * Ambang diam tiap komponen, dalam jam.
 *
 * Angkanya bukan tebakan: penyalin dijadwalkan tiap jam, laporan harian tiap
 * pagi, dan pengiriman Telegram mengikuti laporan. Ambangnya diberi kelonggaran
 * beberapa kali lipat jadwalnya supaya satu jadwal yang meleset tidak langsung
 * berbunyi — yang berbunyi hanyalah berhenti yang sesungguhnya.
 */
const AMBANG = {
  sinkronisasi: { jam: 6, nama: 'Sinkronisasi sumber', ket: 'Dijadwalkan tiap jam. Berbunyi bila diam lebih dari enam jam.' },
  laporan: { jam: 36, nama: 'Penjadwal laporan', ket: 'Laporan harian terbit tiap pagi. Berbunyi bila diam lebih dari 36 jam.' },
  telegram: { jam: 36, nama: 'Pengiriman Telegram', ket: 'Mengikuti jadwal laporan. Berbunyi bila diam lebih dari 36 jam.' },
}

const keadaanKesehatan = {
  dimuat: false,
  galat: null,
  gangguan: [],
  sinkron: [],
  jadwal: [],
  kiriman: [],
  sibuk: false,
}

/* ------------------------------------------------------------------- muat */

async function muat(keadaan) {
  if (keadaan.demo) {
    Object.assign(keadaanKesehatan, dataPeragaan(), { dimuat: true })
    return
  }

  /*
     Empat penarikan sekaligus, dan tiap kegagalan ditanggung sendiri.

     Kalau keempatnya digabung dalam satu Promise.all yang menolak, satu tabel
     yang tidak bisa dibaca — misalnya karena perannya memang tidak berhak —
     membuat seluruh halaman kosong. Halaman kesehatan yang kosong justru pada
     saat ada gangguan adalah kegagalan yang paling tidak berguna.
  */
  const [gangguan, sinkron, jadwal, kiriman] = await Promise.all([
    ambil('system_health_events', {
      select: 'id,component,status,message,detail,detected_at,resolved_at,resolved_by,metadata',
      order: 'detected_at.desc', limit: 100,
    }).catch(() => []),
    ambil('sheet_sync_log', {
      select: 'id,started_at,finished_at,status,sheet_name,trigger_type,rows_seen,rows_inserted,'
        + 'rows_updated,rows_skipped,rows_failed,duration_ms,message',
      order: 'started_at.desc', limit: 40,
    }).catch(() => []),
    ambil('report_schedules', {
      select: 'id,report_type,label,cron_expression,timezone,is_active,auto_publish,'
        + 'auto_send_telegram,last_run_at,last_status,last_error,next_run_at',
      order: 'report_type.asc',
    }).catch(() => []),
    ambil('telegram_deliveries', {
      select: 'id,delivery_type,trigger_type,status,requested_at,delivered_at,error_detail,requested_by',
      order: 'requested_at.desc', limit: 40,
    }).catch(() => []),
  ])

  Object.assign(keadaanKesehatan, { gangguan, sinkron, jadwal, kiriman, dimuat: true })
}

function dataPeragaan() {
  const lalu = (menit) => new Date(Date.now() - menit * 60_000).toISOString()
  return {
    gangguan: [
      {
        id: 1, component: 'sheet-sync', status: 'peringatan',
        message: 'Satu lembar kanwil menolak dibaca',
        detail: 'Spreadsheet Kanwil Jawa Barat mengembalikan 403. Izin berbagi kemungkinan dicabut.',
        detected_at: lalu(180), resolved_at: null, resolved_by: null, metadata: {},
      },
      {
        id: 2, component: 'klasifikasi', status: 'pulih',
        message: 'Edge Function sempat gagal dibundel',
        detail: 'Berkas pustaka tidak ikut terkirim pada penggelaran; sudah digelar ulang.',
        detected_at: lalu(2600), resolved_at: lalu(2540), resolved_by: 'superadmin', metadata: {},
      },
    ],
    sinkron: Array.from({ length: 8 }, (_, i) => ({
      id: `s-${i}`,
      started_at: lalu(60 * (i + 1)),
      finished_at: lalu(60 * (i + 1) - 1),
      status: i === 3 ? 'gagal_sebagian' : 'sukses',
      sheet_name: i % 2 ? 'Pusat' : 'Kanwil Jawa Timur',
      trigger_type: 'jadwal',
      rows_seen: 120 + i * 7,
      rows_inserted: 12 - i,
      rows_updated: 3,
      rows_skipped: 100 + i * 7,
      rows_failed: i === 3 ? 4 : 0,
      duration_ms: 3200 + i * 180,
      message: i === 3 ? 'Empat baris ditolak: tanggal tidak terbaca.' : null,
    })),
    jadwal: [
      { id: 'j1', report_type: 'harian', label: 'Laporan harian pimpinan', cron_expression: '0 6 * * *', timezone: 'Asia/Jakarta', is_active: true, auto_publish: true, auto_send_telegram: true, last_run_at: lalu(300), last_status: 'sukses', last_error: null, next_run_at: lalu(-1140) },
      { id: 'j2', report_type: 'mingguan', label: 'Laporan mingguan', cron_expression: '0 7 * * 1', timezone: 'Asia/Jakarta', is_active: true, auto_publish: false, auto_send_telegram: true, last_run_at: lalu(4300), last_status: 'sukses', last_error: null, next_run_at: lalu(-5000) },
    ],
    kiriman: [
      { id: 'k1', delivery_type: 'laporan', trigger_type: 'jadwal', status: 'terkirim', requested_at: lalu(299), delivered_at: lalu(298), error_detail: null, requested_by: 'Penjadwal Harian' },
      { id: 'k2', delivery_type: 'peringatan', trigger_type: 'manual', status: 'terkirim', requested_at: lalu(640), delivered_at: lalu(640), error_detail: null, requested_by: 'analis.media' },
    ],
  }
}

/* ------------------------------------------------------------- penilaian */

/**
 * Menilai satu komponen dari waktu kegiatan terakhirnya dan hasil terakhirnya.
 *
 * Dua sumbu, bukan satu. Sebuah komponen yang kegiatan terakhirnya berhasil
 * tetapi terjadi tiga hari lalu sama tidak sehatnya dengan yang berjalan tiap
 * jam tetapi selalu gagal — dan keduanya luput bila yang dibaca hanya salah
 * satunya.
 */
function nilaiKomponen(kunci, terakhir, gagalTerakhir) {
  const ambang = AMBANG[kunci]
  if (!terakhir) {
    return { nada: 'kritis', label: 'Tidak ada kegiatan', ket: 'Belum pernah tercatat berjalan sama sekali.' }
  }

  const jam = (Date.now() - new Date(terakhir).getTime()) / 3_600_000
  if (jam > ambang.jam) {
    return {
      nada: 'kritis',
      label: 'Diam terlalu lama',
      ket: `Kegiatan terakhir ${jarakWaktu(terakhir)}, melewati ambang ${ambang.jam} jam.`,
    }
  }
  if (gagalTerakhir) {
    return {
      nada: 'tinggi',
      label: 'Berjalan dengan kegagalan',
      ket: `Berjalan ${jarakWaktu(terakhir)}, tetapi hasil terakhirnya bukan keberhasilan penuh.`,
    }
  }
  return {
    nada: 'positif',
    label: 'Berjalan normal',
    ket: `Kegiatan terakhir ${jarakWaktu(terakhir)}.`,
  }
}

function kartuKomponen(kunci, nilai, angkaTambahan = '') {
  const ambang = AMBANG[kunci]
  return `
    <div class="sehat-kartu" data-nada="${amankan(nilai.nada)}">
      <div class="sehat-kop">
        <span class="sehat-lampu" data-nada="${amankan(nilai.nada)}"></span>
        <b>${amankan(ambang.nama)}</b>
        ${keping(nilai.label, nilai.nada, true)}
      </div>
      <p class="mini-teks">${amankan(nilai.ket)}</p>
      ${angkaTambahan ? `<p class="mini-teks samar-teks">${angkaTambahan}</p>` : ''}
      <p class="mini-teks samar-teks sehat-ambang">${amankan(ambang.ket)}</p>
    </div>`
}

/* ------------------------------------------------------------------ halaman */

export function halamanKesehatan({ keadaan, isi }) {
  const superadmin = keadaan.profil?.role === 'super_admin'

  function gambar() {
    if (keadaanKesehatan.galat) {
      isi.innerHTML = kartu({
        isi: `<div class="pesan" data-nada="kritis">${ikon('peringatan')}
          <div><b>Keadaan sistem gagal dibaca.</b> ${amankan(keadaanKesehatan.galat)}</div></div>`,
      })
      return
    }
    if (!keadaanKesehatan.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:380px"></div>' })
      return
    }

    const { gangguan, sinkron, jadwal, kiriman } = keadaanKesehatan
    const terbuka = gangguan.filter((g) => !g.resolved_at)

    const sinkronTerakhir = sinkron[0]
    const nilaiSinkron = nilaiKomponen('sinkronisasi',
      sinkronTerakhir?.started_at,
      sinkronTerakhir && sinkronTerakhir.status !== 'sukses')

    const jadwalTerakhir = jadwal
      .map((j) => j.last_run_at).filter(Boolean)
      .sort().reverse()[0]
    const nilaiJadwal = nilaiKomponen('laporan', jadwalTerakhir,
      jadwal.some((j) => j.is_active && j.last_status && j.last_status !== 'sukses'))

    const kirimTerakhir = kiriman[0]
    const nilaiKirim = nilaiKomponen('telegram',
      kirimTerakhir?.requested_at,
      kirimTerakhir && kirimTerakhir.status !== 'terkirim')

    const gagalBaris = sinkron.reduce((a, s) => a + (s.rows_failed || 0), 0)
    const barisMasuk = sinkron.reduce((a, s) => a + (s.rows_inserted || 0), 0)

    isi.innerHTML = `
      <div class="tumpuk">
        ${terbuka.length ? `
          <div class="pesan" data-nada="kritis">
            ${ikon('peringatan')}
            <div>
              <b>${angka(terbuka.length)} gangguan belum ditutup.</b>
              Yang paling baru: ${amankan(terbuka[0].message || terbuka[0].component)}
              (${amankan(jarakWaktu(terbuka[0].detected_at))}).
            </div>
          </div>` : `
          <div class="pesan" data-nada="positif">
            ${ikon('centang')}
            <div><b>Tidak ada gangguan yang belum ditutup.</b></div>
          </div>`}

        <div class="sehat-kisi">
          ${kartuKomponen('sinkronisasi', nilaiSinkron,
            sinkron.length ? `${angka(barisMasuk)} baris baru dan ${angka(gagalBaris)} baris gagal pada ${angka(sinkron.length)} penarikan terakhir.` : '')}
          ${kartuKomponen('laporan', nilaiJadwal,
            jadwal.length ? `${angka(jadwal.filter((j) => j.is_active).length)} jadwal aktif dari ${angka(jadwal.length)}.` : 'Belum ada jadwal terdaftar.')}
          ${kartuKomponen('telegram', nilaiKirim,
            kiriman.length ? `${angka(kiriman.filter((k) => k.status === 'terkirim').length)} dari ${angka(kiriman.length)} pengiriman terakhir berhasil.` : '')}
        </div>

        ${kartu({
          judul: 'Gangguan tercatat',
          ket: 'Yang belum ditutup berdiri di atas. Menutup gangguan berarti menyatakan sudah beres.',
          rapat: true,
          isi: gangguan.length ? `
            <ul class="sehat-gangguan">
              ${[...gangguan].sort((a, b) => (a.resolved_at ? 1 : 0) - (b.resolved_at ? 1 : 0)
                  || String(b.detected_at).localeCompare(String(a.detected_at)))
                .slice(0, 20).map((g) => `
                <li${g.resolved_at ? ' class="tutup"' : ''}>
                  <span class="antrean-tanda" data-nada="${g.resolved_at ? 'positif' : nadaGangguan(g.status)}"></span>
                  <div class="sehat-gangguan-isi">
                    <div class="siklus-butir-kop">
                      <b>${amankan(g.message || 'Tanpa keterangan')}</b>
                      ${keping(g.component || '—', 'aksen', true)}
                      ${keping(g.resolved_at ? 'Ditutup' : (g.status || 'terbuka'),
                        g.resolved_at ? 'positif' : nadaGangguan(g.status), true)}
                    </div>
                    ${g.detail ? `<p class="mini-teks samar-teks">${amankan(g.detail)}</p>` : ''}
                    <span class="mini-teks samar-teks">
                      Terdeteksi ${amankan(tanggalJam(g.detected_at))}
                      ${g.resolved_at ? ` · ditutup ${amankan(jarakWaktu(g.resolved_at))} oleh ${amankan(g.resolved_by || '—')}` : ''}
                    </span>
                  </div>
                  ${!g.resolved_at && superadmin ? `
                    <button class="tbl kecil dorong" data-tutup="${amankan(g.id)}">
                      ${ikon('centang')}Tandai beres</button>` : ''}
                </li>`).join('')}
            </ul>`
            : `<div style="padding:18px">${kosong('Belum ada gangguan tercatat',
              'Tabel gangguan diisi proses latar ketika sesuatu gagal. Kosong berarti belum '
              + 'ada yang gagal sejak tabel ini dipasang — bukan berarti tidak dipantau.')}</div>`,
        })}

        ${kartu({
          judul: 'Penarikan sumber terakhir',
          ket: 'Sepuluh penarikan terbaru, beserta baris yang masuk, dilewati, dan gagal.',
          aksi: tombol({ label: 'Buka Sinkronisasi', ikon: 'sinkron', kecil: true, halaman: 'sinkronisasi' }),
          rapat: true,
          isi: sinkron.length ? `
            <div class="tabel-bungkus">
              <table class="tabel">
                <thead>
                  <tr>
                    <th>Mulai</th><th>Lembar</th><th>Pemicu</th><th>Status</th>
                    <th class="rata-kanan">Terbaca</th><th class="rata-kanan">Baru</th>
                    <th class="rata-kanan">Gagal</th><th class="rata-kanan">Lama</th>
                  </tr>
                </thead>
                <tbody>
                  ${sinkron.slice(0, 10).map((s) => `
                    <tr>
                      <td class="kecil">${amankan(tanggalJam(s.started_at))}</td>
                      <td class="kecil">${amankan(s.sheet_name || '—')}</td>
                      <td class="kecil samar-teks">${amankan(s.trigger_type || '—')}</td>
                      <td>${keping(s.status || '—', s.status === 'sukses' ? 'positif'
                        : s.status === 'gagal' ? 'kritis' : 'sedang', true)}</td>
                      <td class="rata-kanan angka">${angka(s.rows_seen || 0)}</td>
                      <td class="rata-kanan angka">${angka(s.rows_inserted || 0)}</td>
                      <td class="rata-kanan angka">${s.rows_failed
                        ? `<span style="color:var(--kritis)">${angka(s.rows_failed)}</span>` : '—'}</td>
                      <td class="rata-kanan angka">${s.duration_ms ? `${(s.duration_ms / 1000).toFixed(1).replace('.', ',')} d` : '—'}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`
            : `<div style="padding:18px">${kosong('Belum ada catatan penarikan',
              'Penyalin belum pernah berjalan, atau catatannya belum sampai ke tabel ini.')}</div>`,
        })}

        <div class="kisi kisi-2">
          ${kartu({
            judul: 'Jadwal laporan',
            ket: 'Cron dan hasil jalannya yang terakhir.',
            isi: jadwal.length ? `
              <ul class="siklus-daftar">
                ${jadwal.map((j) => `
                  <li class="siklus-butir">
                    <div class="siklus-butir-kop">
                      <b>${amankan(j.label || j.report_type)}</b>
                      ${keping(j.is_active ? 'Aktif' : 'Nonaktif', j.is_active ? 'positif' : 'netral', true)}
                      ${j.last_status ? keping(j.last_status,
                        j.last_status === 'sukses' ? 'positif' : 'kritis', true) : ''}
                    </div>
                    <span class="mini-teks samar-teks mono">
                      ${amankan(j.cron_expression || '—')} · ${amankan(j.timezone || 'Asia/Jakarta')}
                    </span>
                    <span class="mini-teks samar-teks">
                      Terakhir jalan ${amankan(j.last_run_at ? jarakWaktu(j.last_run_at) : 'belum pernah')}
                      ${j.next_run_at ? ` · berikutnya ${amankan(tanggalJam(j.next_run_at))}` : ''}
                    </span>
                    ${j.last_error ? `
                      <span class="mini-teks" style="color:var(--kritis)">${amankan(j.last_error)}</span>` : ''}
                    <span class="mini-teks samar-teks">
                      ${j.auto_publish ? 'Terbit otomatis' : 'Menunggu pengesahan'}
                      · ${j.auto_send_telegram ? 'dikirim ke Telegram' : 'tidak dikirim otomatis'}
                    </span>
                  </li>`).join('')}
              </ul>`
              : kosong('Belum ada jadwal', 'Laporan berkala masih disusun manual di halaman Laporan Berkala.'),
          })}

          ${kartu({
            judul: 'Pengiriman Telegram terakhir',
            ket: 'Delapan pengiriman terbaru.',
            aksi: tombol({ label: 'Buka Distribusi', ikon: 'kirim', kecil: true, halaman: 'distribusi' }),
            isi: kiriman.length ? `
              <ul class="siklus-daftar">
                ${kiriman.slice(0, 8).map((k) => `
                  <li class="siklus-butir">
                    <div class="siklus-butir-kop">
                      ${keping(k.delivery_type || '—', 'aksen', true)}
                      ${keping(k.status || '—', k.status === 'terkirim' ? 'positif' : 'kritis', true)}
                      <span class="mini-teks samar-teks dorong">${amankan(jarakWaktu(k.requested_at))}</span>
                    </div>
                    <span class="mini-teks samar-teks">
                      Pemicu ${amankan(k.trigger_type || '—')} · diminta ${amankan(k.requested_by || '—')}
                    </span>
                    ${k.error_detail ? `
                      <span class="mini-teks" style="color:var(--kritis)">${amankan(k.error_detail)}</span>` : ''}
                  </li>`).join('')}
              </ul>`
              : kosong('Belum ada pengiriman', 'Belum satu pun pesan dikirim ke grup Telegram.'),
          })}
        </div>

        <p class="ket" style="max-width:88ch">
          ${ikon('info')}
          <span>
            Halaman ini membaca apa yang tercatat, bukan menguji langsung. Sebuah komponen yang
            gagal tanpa sempat menuliskan catatannya akan terbaca di sini sebagai
            <b>diam</b> — dan itulah sebabnya diam dinilai sebagai kabar buruk, bukan
            sebagai ketiadaan kabar.
          </span>
        </p>
      </div>`
  }

  function nadaGangguan(status) {
    const s = String(status || '').toLowerCase()
    if (/kritis|gagal|mati|fatal/.test(s)) return 'kritis'
    if (/peringatan|warn|sebagian/.test(s)) return 'tinggi'
    if (/pulih|beres|normal/.test(s)) return 'positif'
    return 'sedang'
  }

  /* --------------------------------------------------------------- tindakan */

  async function tutup(id) {
    const g = keadaanKesehatan.gangguan.find((x) => String(x.id) === String(id))
    if (!g) return
    keadaanKesehatan.sibuk = true
    try {
      const perubahan = {
        resolved_at: new Date().toISOString(),
        resolved_by: profilSekarang()?.username || 'superadmin',
      }
      if (!keadaan.demo) await perbarui('system_health_events', { id: `eq.${g.id}` }, perubahan)
      Object.assign(g, perubahan)
      roti('Gangguan ditandai beres.', 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    } finally {
      keadaanKesehatan.sibuk = false
      gambar()
    }
  }

  isi.addEventListener('click', (ev) => {
    const id = ev.target.closest('[data-tutup]')?.dataset.tutup
    if (id) tutup(id)
  })

  /* ------------------------------------------------------------------- muat */

  gambar()
  muat(keadaan)
    .then(gambar)
    .catch((galat) => {
      keadaanKesehatan.galat = pesanRamah(galat)
      gambar()
    })

  return {
    judul: 'Kesehatan Sistem',
    sub: 'Penyalin, penjadwal, dan pengiriman — dinilai dari kegiatan terakhirnya',
  }
}
