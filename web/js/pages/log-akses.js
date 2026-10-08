/**
 * Log Akses — siapa yang masuk, dari mana, dan siapa yang sedang aktif.
 *
 * Halaman ini hanya untuk Pemilik Sistem. Pembatasnya ada di tiga lapis, dan
 * ketiganya sengaja berlebih:
 *
 *   Tab-nya tidak digambar bagi akun lain (pages/pemantauan-sistem.js).
 *   Tabel `log_masuk` hanya terbaca lewat kebijakan `adalah_pemilik()`.
 *   Fungsi `sesi_aktif()` dan `paksa_keluar()` menolak selain pemilik.
 *
 * Kalau lapisan pertama bocor, dua lapisan di basis data masih menahan. Karena
 * itu halaman ini tidak perlu mengulang pemeriksaan, tetapi tetap menampilkan
 * kalimat penolakan yang jelas bila basis data menolak.
 *
 * Yang dicatat adalah lokasi PERKIRAAN dari alamat jaringan, setingkat kota.
 * Nilai pengawasannya ada di tanda-tanda: VPN, server hosting, luar negeri,
 * perpindahan mustahil, jam janggal. Nama kotanya sendiri hanya pelengkap, dan
 * halaman ini mengatakannya di layar.
 */

import { kartu, keping, kosong, tombol, pilihan, ubin, roti, konfirmasi, bidangCari } from '../ui/komponen.js'
import { amankan, angka, tanggalJam, jarakWaktu } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { ambil, perbarui, panggilFungsi, pesanRamah } from '../lib/api.js'

const KOLOM = 'id,waktu,auth_user_id,username,nama,peran,kanwil,upt,pemilik,ip,kota,wilayah,negara,'
  + 'kode_negara,jaringan,asn,peramban,sistem_operasi,jenis_perangkat,tingkat,tanda,catatan,dibaca,telegram_terkirim,'
  + 'gps_lintang,gps_bujur,gps_akurasi_m,gps_waktu'

const NADA_TINGKAT = { bahaya: 'kritis', perhatian: 'tinggi', normal: 'positif' }
const LABEL_TINGKAT = { bahaya: 'Bahaya', perhatian: 'Perhatian', normal: 'Normal' }

const status = {
  dimuat: false,
  galat: null,
  log: [],
  sesi: [],
  sesiGalat: null,
  peringatan: [],
  gagal: [],
  tingkat: 'Semua tingkat',
  cari: '',
  sibuk: false,
}

function dataPeragaan() {
  const lalu = (menit) => new Date(Date.now() - menit * 60_000).toISOString()
  return {
    log: [
      { id: 1, waktu: lalu(12), auth_user_id: 'u1', username: 'analis.media', nama: 'Analis Media', peran: 'media_intelligence_analyst',
        ip: '203.0.113.20', kota: 'Jakarta', negara: 'Indonesia', kode_negara: 'ID', jaringan: 'Telkomsel', asn: 'AS23693',
        peramban: 'Chrome', sistem_operasi: 'Android', jenis_perangkat: 'Ponsel', tingkat: 'normal', tanda: [], dibaca: true },
      { id: 2, waktu: lalu(95), auth_user_id: 'u2', username: 'contoh.pengguna', nama: 'Contoh Pengguna', peran: 'kanwil_admin',
        ip: '198.51.100.7', kota: 'Amsterdam', negara: 'Netherlands', kode_negara: 'NL', jaringan: 'DigitalOcean LLC', asn: 'AS14061',
        peramban: 'Chrome', sistem_operasi: 'Linux', jenis_perangkat: 'Komputer', tingkat: 'bahaya',
        tanda: ['VPN / proxy / anonim', 'Login dari luar Indonesia'], dibaca: false },
    ],
    peringatan: [
      { id: 1, waktu: lalu(40), jenis: 'login_gagal_akun', tingkat: 'perhatian', judul: 'Percobaan login berulang pada satu akun',
        rincian: { username: 'contoh.pengguna', jumlah: 7, jumlah_ip: 1, akun_dikenal: true }, pelaku: null, dibaca: false },
    ],
    gagal: [
      { id: 1, waktu: lalu(41), username_dicoba: 'contoh.pengguna', ip: '198.51.100.7' },
    ],
    sesi: [
      { sesi_id: 's1', auth_user_id: 'u1', username: 'analis.media', nama: 'Analis Media', peran: 'media_intelligence_analyst',
        pemilik: false, dibuka: lalu(12), terakhir_aktif: lalu(2), ip: '203.0.113.20', agen: 'Chrome di Android' },
    ],
  }
}

async function muat(keadaan) {
  if (keadaan.demo) {
    Object.assign(status, dataPeragaan(), { dimuat: true, galat: null, sesiGalat: null })
    return
  }

  /*
     Log dan sesi aktif ditarik terpisah dan kegagalannya ditanggung sendiri.
     Log yang gagal dibaca tidak boleh ikut menyembunyikan daftar sesi yang
     sedang hidup — dan justru daftar sesi itulah yang dibutuhkan saat ada
     sesuatu yang mencurigakan.
  */
  const [log, sesi, peringatan, gagal] = await Promise.allSettled([
    ambil('log_masuk', { select: KOLOM, order: 'waktu.desc', limit: 300 }),
    panggilFungsi('sesi_aktif'),
    ambil('peringatan_keamanan', {
      select: 'id,waktu,jenis,tingkat,judul,rincian,pelaku,dibaca',
      tingkat: 'neq.info', order: 'waktu.desc', limit: 50,
    }),
    ambil('login_gagal', {
      select: 'id,waktu,username_dicoba,ip',
      waktu: `gte.${new Date(Date.now() - 86_400_000).toISOString()}`, order: 'waktu.desc', limit: 500,
    }),
  ])
  status.peringatan = peringatan.status === 'fulfilled' && Array.isArray(peringatan.value) ? peringatan.value : []
  status.gagal = gagal.status === 'fulfilled' && Array.isArray(gagal.value) ? gagal.value : []

  status.log = log.status === 'fulfilled' ? log.value : []
  status.galat = log.status === 'rejected' ? pesanRamah(log.reason) : null
  status.sesi = sesi.status === 'fulfilled' && Array.isArray(sesi.value) ? sesi.value : []
  status.sesiGalat = sesi.status === 'rejected' ? pesanRamah(sesi.reason) : null
  status.dimuat = true
}

function tempat(b) {
  const bagian = [...new Set([b.kota, b.negara].filter(Boolean))]
  return bagian.length ? bagian.join(', ') : 'Tidak terbaca'
}

function perangkat(b) {
  return [b.peramban, b.sistem_operasi].filter(Boolean).join(' di ') || '—'
}

function disaring() {
  const kata = status.cari.trim().toLowerCase()
  const nilai = status.tingkat === 'Bahaya' ? 'bahaya'
    : status.tingkat === 'Perhatian' ? 'perhatian'
      : status.tingkat === 'Normal' ? 'normal' : null
  return status.log.filter((b) => {
    if (nilai && (b.tingkat || 'normal') !== nilai) return false
    if (!kata) return true
    return [b.username, b.nama, b.ip, b.kota, b.negara, b.jaringan]
      .some((v) => String(v || '').toLowerCase().includes(kata))
  })
}

const NAMA_BAGIAN = {
  telegram_targets: 'tujuan Telegram', notifikasi_setelan: 'setelan notifikasi',
  notifikasi_rute: 'rute notifikasi', integration_settings: 'integrasi', report_schedules: 'jadwal laporan',
}

function rincianPeringatan(p) {
  const r = p.rincian || {}
  if (p.jenis === 'login_gagal_akun') {
    return `Akun ${r.username}${r.akun_dikenal ? '' : ' (tidak terdaftar)'} · ${r.jumlah} percobaan ditolak dalam 15 menit`
  }
  if (p.jenis === 'login_gagal_ip') return `Alamat ${r.ip} · ${r.jumlah} percobaan ditolak dalam 15 menit, ${r.jumlah_akun} nama akun`
  if (p.jenis === 'ubah_pengaturan') {
    return `${NAMA_BAGIAN[r.tabel] || r.tabel}${Array.isArray(r.kolom) && r.kolom.length ? ` · isian: ${r.kolom.join(', ')}` : ''}`
  }
  if (p.jenis === 'hapus_berita') return `${r.jumlah} berita dihapus dalam 10 menit`
  return ''
}

function barisPeringatan(p) {
  return `
    <li class="siklus-butir">
      <div class="siklus-butir-kop">
        <b>${amankan(p.judul)}</b>
        ${keping(p.tingkat === 'bahaya' ? 'Bahaya' : 'Perhatian', p.tingkat === 'bahaya' ? 'kritis' : 'tinggi', true)}
        ${p.dibaca ? '' : keping('Baru', 'aksen', true)}
        <span class="mini-teks samar-teks dorong">${amankan(jarakWaktu(p.waktu))}</span>
      </div>
      <span class="mini-teks samar-teks">${amankan(rincianPeringatan(p))}${p.pelaku ? ` · oleh ${amankan(p.pelaku)}` : ''}</span>
    </li>`
}

function barisSesi(s) {
  const dirinya = s.pemilik
  return `
    <li class="siklus-butir">
      <div class="siklus-butir-kop">
        <b>${amankan(s.nama || s.username || 'Tanpa nama')}</b>
        <span class="mini-teks samar-teks">${amankan(s.username || '')}</span>
        ${dirinya ? keping('Akun Anda', 'aksen', true) : ''}
        <span class="mini-teks samar-teks dorong">aktif ${amankan(jarakWaktu(s.terakhir_aktif))}</span>
      </div>
      <span class="mini-teks samar-teks">
        Masuk ${amankan(tanggalJam(s.dibuka))} · IP ${amankan(s.ip || '—')}
      </span>
      <span class="mini-teks samar-teks">${amankan(s.agen || '—')}</span>
      ${dirinya ? '' : `
        <div class="baris gap-6" style="margin-top:6px">
          ${tombol({ label: 'Akhiri Sesi', ikon: 'keluar', kecil: true, aksi: 'akhiri', data: { uid: s.auth_user_id, nama: s.nama || s.username } })}
          ${tombol({ label: 'Akhiri dan nonaktifkan akun', ikon: 'gembok', kecil: true, gaya: 'bahaya', aksi: 'akhiri-nonaktif', data: { uid: s.auth_user_id, nama: s.nama || s.username } })}
        </div>`}
    </li>`
}

export function halamanLogAkses({ keadaan, isi }) {
  function gambar() {
    if (!status.dimuat) {
      isi.innerHTML = kartu({ isi: '<div class="rangka" style="height:380px"></div>' })
      return
    }

    const sehari = Date.now() - 86_400_000
    const baru = status.log.filter((b) => new Date(b.waktu).getTime() >= sehari)
    const bahaya = baru.filter((b) => b.tingkat === 'bahaya')
    const perhatian = baru.filter((b) => b.tingkat === 'perhatian')
    const belumDibaca = status.log.filter((b) => b.dibaca === false && b.tingkat && b.tingkat !== 'normal')
    const hasil = disaring()
    const peringatanBaru = status.peringatan.filter((p) => p.dibaca === false)

    isi.innerHTML = `
      <div class="tumpuk">
        ${status.galat ? `
          <div class="pesan" data-nada="kritis">${ikon('peringatan')}
            <div><b>Log gagal dibaca.</b> ${amankan(status.galat)}</div></div>` : ''}

        <div class="kisi kisi-4">
          ${ubin({ label: 'Login gagal 24 jam', nilai: status.gagal.length, nada: status.gagal.length >= 10 ? 'tinggi' : undefined, kaki: 'ditolak di halaman masuk' })}
          ${ubin({ label: 'Login 24 jam', nilai: baru.length, kaki: 'dari log yang termuat' })}
          ${ubin({ label: 'Bahaya', nilai: bahaya.length, nada: bahaya.length ? 'kritis' : 'positif', kaki: 'VPN, hosting, luar negeri, jam janggal' })}
          ${ubin({ label: 'Perhatian', nilai: perhatian.length, nada: perhatian.length ? 'tinggi' : 'positif', kaki: 'IP, jaringan, atau kota baru' })}
          ${ubin({ label: 'Sesi aktif', nilai: status.sesi.length, kaki: '7 hari terakhir' })}
        </div>

        ${kartu({
          judul: 'Peringatan keamanan',
          ket: 'Login gagal berulang, perubahan pengaturan notifikasi oleh akun selain Anda, dan penghapusan berita beruntun.',
          aksi: peringatanBaru.length ? tombol({ label: `Tandai ${angka(peringatanBaru.length)} sudah dibaca`, ikon: 'centang', kecil: true, aksi: 'tandai-peringatan' }) : '',
          isi: status.peringatan.length
            ? `<ul class="siklus-daftar">${status.peringatan.slice(0, 20).map(barisPeringatan).join('')}</ul>`
            : kosong('Tidak ada peringatan', 'Belum ada kejadian yang melewati ambang.'),
        })}

        ${kartu({
          judul: 'Sesi aktif',
          ket: 'Akhiri Sesi mengeluarkan orang itu dari semua perangkat. Ia masih bisa masuk lagi dengan sandinya, kecuali akunnya ikut dinonaktifkan.',
          isi: status.sesiGalat
            ? `<div class="pesan" data-nada="kritis">${ikon('peringatan')}<div>${amankan(status.sesiGalat)}</div></div>`
            : status.sesi.length
              ? `<ul class="siklus-daftar">${status.sesi.map(barisSesi).join('')}</ul>`
              : kosong('Tidak ada sesi aktif', 'Tidak ada yang sedang masuk dalam tujuh hari terakhir.'),
        })}

        ${kartu({
          judul: 'Riwayat login',
          ket: 'Lokasi diperkirakan dari alamat jaringan, setingkat kota. Yang berarti adalah tandanya, bukan nama kotanya.',
          aksi: `
            ${bidangCari(status.cari, 'Cari akun, IP, atau kota')}
            ${pilihan({ nama: 'tingkat', nilai: status.tingkat, label: 'Saring tingkat',
              opsi: ['Semua tingkat', 'Bahaya', 'Perhatian', 'Normal'] })}
            ${belumDibaca.length ? tombol({ label: `Tandai ${angka(belumDibaca.length)} sudah dibaca`, ikon: 'centang', kecil: true, aksi: 'tandai-baca' }) : ''}`,
          rapat: true,
          isi: hasil.length ? `
            <div class="tabel-bungkus">
              <table class="tabel">
                <thead><tr>
                  <th>Waktu</th><th>Akun</th><th>Lokasi</th><th>Jaringan</th><th>Perangkat</th><th>Tingkat</th>
                </tr></thead>
                <tbody>
                  ${hasil.slice(0, 120).map((b) => `
                    <tr>
                      <td class="kecil">${amankan(tanggalJam(b.waktu))}</td>
                      <td>
                        <b>${amankan(b.nama || b.username || '—')}</b>
                        ${b.pemilik ? keping('Anda', 'aksen', true) : ''}
                        <div class="mini-teks samar-teks">${amankan(b.username || '')}</div>
                      </td>
                      <td class="kecil">${amankan(tempat(b))}<div class="mini-teks samar-teks mono">${amankan(b.ip || '—')}</div>${b.gps_lintang != null && b.gps_bujur != null
                        ? `<div class="mini-teks"><a href="https://www.openstreetmap.org/?mlat=${Number(b.gps_lintang)}&amp;mlon=${Number(b.gps_bujur)}#map=16/${Number(b.gps_lintang)}/${Number(b.gps_bujur)}" target="_blank" rel="noopener noreferrer">GPS peramban</a>${b.gps_akurasi_m != null ? ` ±${angka(b.gps_akurasi_m)} m` : ''}</div>` : ''}</td>
                      <td class="kecil">${amankan(b.jaringan || '—')}${b.asn ? `<div class="mini-teks samar-teks">${amankan(b.asn)}</div>` : ''}</td>
                      <td class="kecil">${amankan(perangkat(b))}${b.jenis_perangkat ? `<div class="mini-teks samar-teks">${amankan(b.jenis_perangkat)}</div>` : ''}</td>
                      <td>
                        ${keping(LABEL_TINGKAT[b.tingkat] || 'Normal', NADA_TINGKAT[b.tingkat] || 'positif', true)}
                        ${(b.tanda || []).map((t) => `<div class="mini-teks samar-teks">${amankan(t)}</div>`).join('')}
                        ${b.catatan ? `<div class="mini-teks" style="color:var(--kritis)">${amankan(b.catatan)}</div>` : ''}
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
            ${hasil.length > 120 ? `<div class="mini-teks samar-teks" style="padding:10px 14px">Menampilkan 120 dari ${angka(hasil.length)} baris. Persempit dengan saringan di atas.</div>` : ''}`
            : `<div style="padding:18px">${kosong('Tidak ada baris yang cocok',
              status.log.length ? 'Longgarkan saringan di atas.' : 'Belum ada login yang tercatat.')}</div>`,
        })}

        <div class="mini-teks samar-teks">
          Log disimpan 180 hari, titik GPS 30 hari. Login gagal hanya terlihat bila dicoba lewat halaman masuk aplikasi ini. Peringatan merah juga dikirim ke Telegram pribadi Anda saat kejadiannya.
        </div>
      </div>`
  }

  async function akhiri(uid, nama, nonaktifkan) {
    const ya = await konfirmasi({
      judul: nonaktifkan ? 'Akhiri sesi dan nonaktifkan akun?' : 'Akhiri sesi ini?',
      pesan: nonaktifkan
        ? `${nama} akan dikeluarkan dari semua perangkat dan akunnya dinonaktifkan. Akun bisa diaktifkan lagi dari halaman Pengguna.`
        : `${nama} akan dikeluarkan dari semua perangkat. Ia tetap bisa masuk lagi dengan sandinya.`,
      tegas: nonaktifkan ? 'Akhiri dan nonaktifkan' : 'Akhiri Sesi',
      bahaya: true,
    })
    if (!ya) return
    status.sibuk = true
    try {
      if (!keadaan.demo) await panggilFungsi('paksa_keluar', { p_auth_user: uid, p_nonaktifkan: nonaktifkan })
      roti(nonaktifkan ? 'Sesi diakhiri dan akun dinonaktifkan.' : 'Sesi diakhiri.', 'positif')
      await muat(keadaan)
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    } finally {
      status.sibuk = false
      gambar()
    }
  }

  async function tandaiBaca() {
    const id = status.log.filter((b) => b.dibaca === false && b.tingkat && b.tingkat !== 'normal').map((b) => b.id)
    if (!id.length) return
    try {
      if (!keadaan.demo) await perbarui('log_masuk', { id: `in.(${id.join(',')})` }, { dibaca: true })
      for (const b of status.log) if (id.includes(b.id)) b.dibaca = true
      roti('Ditandai sudah dibaca.', 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    }
    gambar()
  }

  async function tandaiPeringatan() {
    const id = status.peringatan.filter((p) => p.dibaca === false).map((p) => p.id)
    if (!id.length) return
    try {
      if (!keadaan.demo) await perbarui('peringatan_keamanan', { id: `in.(${id.join(',')})` }, { dibaca: true })
      for (const p of status.peringatan) if (id.includes(p.id)) p.dibaca = true
      roti('Ditandai sudah dibaca.', 'positif')
    } catch (galat) {
      roti(pesanRamah(galat), 'kritis', 6000)
    }
    gambar()
  }

  isi.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-aksi]')
    if (!el) return
    const { aksi, uid, nama } = el.dataset
    if (aksi === 'akhiri') akhiri(uid, nama, false)
    if (aksi === 'akhiri-nonaktif') akhiri(uid, nama, true)
    if (aksi === 'tandai-baca') tandaiBaca()
    if (aksi === 'tandai-peringatan') tandaiPeringatan()
  })

  isi.addEventListener('change', (ev) => {
    if (ev.target.dataset.saring === 'tingkat') {
      status.tingkat = ev.target.value
      gambar()
    }
  })

  isi.addEventListener('input', (ev) => {
    if (ev.target.dataset.peran === 'cari') {
      status.cari = ev.target.value
      const posisi = ev.target.selectionStart
      gambar()
      const kotak = isi.querySelector('[data-peran="cari"]')
      if (kotak) { kotak.focus(); kotak.setSelectionRange(posisi, posisi) }
    }
  })

  gambar()
  muat(keadaan).then(gambar).catch((galat) => {
    status.galat = pesanRamah(galat)
    status.dimuat = true
    gambar()
  })

  return {
    judul: 'Log Akses',
    sub: 'Siapa yang masuk, dari mana, dan siapa yang sedang aktif — khusus Pemilik Sistem',
  }
}
