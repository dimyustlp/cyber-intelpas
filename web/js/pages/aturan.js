/**
 * Aturan Peringatan.
 *
 * Tempat sebuah kantor menuliskan pertanyaannya sendiri: bila apa terjadi,
 * kabari siapa.
 *
 * ## Satu hal yang membedakan halaman ini dari borang biasa
 *
 * **Jangkauan sebuah aturan ditampilkan sebelum ia disimpan.** Setiap kali
 * syaratnya berubah, halaman ini menghitung ulang berapa peristiwa di arsip
 * yang termuat akan dinyalakannya — sekarang juga, sebelum tombol Simpan
 * ditekan. Tanpa itu, ambang yang keliru satu angka tidak ketahuan sampai
 * keesokan paginya, ketika seorang analis membuka Ruang Analis dan menemukan
 * empat ratus temuan; dan aturan yang menghasilkan empat ratus temuan tidak
 * dimatikan orang, melainkan diabaikan — beserta seluruh aturan lain di
 * sebelahnya.
 *
 * ## Aturan bawaan
 *
 * Lima aturan dikirim bersama sistem. Keduanya bisa dimatikan dan ambangnya
 * bisa disunting; yang tidak bisa adalah menghapusnya. Tombol "Hapus" pada
 * baris bawaan karena itu berbunyi "Pulihkan", dan berbunyi begitu justru
 * karena keduanya berperilaku berbeda — tombol yang sama yang diam-diam
 * melakukan dua hal berbeda adalah tombol yang berbohong pada salah satu
 * barisnya.
 */

import { kartu, keping, kosong, tombol, tombolIkon, pesanSistem, roti, konfirmasi } from '../ui/komponen.js'
import { amankan, angka, ringkas } from '../lib/format.js'
import { ikon } from '../lib/ikon.js'
import { TINGKAT_RISIKO } from '../lib/risiko.js'
import {
  SINYAL, ESKALASI, SALURAN, bandingUntuk, sinyalDari,
  daftarAturan, simpanAturan, hapusAturan, setelAktif, bakukanAturan,
  jalankanAturan, ringkasAturan, BATAS,
} from '../lib/aturan.js'

/** Draf yang sedang disunting. Null berarti tidak ada borang terbuka. */
let draf = null

export function halamanAturan({ keadaan, isi }) {
  const semua = keadaan.berita || []
  const sekarang = new Date()

  const aturan = daftarAturan()
  const { perAturan, jumlahPeristiwa } = jalankanAturan(semua, { sekarang, aturan })

  isi.innerHTML = `
    <div class="tumpuk">
      ${pesanSistem(
        '<b>Aturan di sini menemukan, tidak mengirim.</b> Yang dinyalakannya muncul di Ruang '
        + 'Analis dan Peringatan Dini; alamat eskalasi dan saluran adalah keterangan bagi '
        + 'petugas yang menekan kirim di halaman Distribusi, bukan perintah kepada mesin. '
        + 'Tidak ada satu pun pesan yang berangkat sendiri dari halaman ini.',
        'netral', 'info')}

      ${draf ? borangAturan(draf, semua, sekarang) : ''}

      ${kartu({
        judul: 'Aturan yang berlaku',
        ket: `${angka(aturan.length)} aturan · dijalankan atas ${angka(jumlahPeristiwa)} peristiwa `
          + 'pada arsip yang termuat',
        aksi: draf ? '' : tombol({ label: 'Aturan baru', ikon: 'tambah', kecil: true, gaya: 'utama', aksi: 'aturan-baru' }),
        isi: `<div class="aturan-daftar">
          ${aturan.map((a) => barisAturan(a, perAturan[a.id] || 0)).join('')}
        </div>`,
      })}

      ${kartu({
        judul: 'Sinyal yang bisa dipakai',
        ket: 'Daftar tertutup. Kotak isian bebas akan menghasilkan aturan yang menyebut nama '
          + 'kolom salah ketik — tersimpan, tampil di daftar, tidak pernah menyala, dan tidak pernah mengeluh.',
        isi: `<div class="tabel-bungkus">
          <table class="tabel">
            <thead><tr><th>Sinyal</th><th>Jenis</th><th>Artinya</th></tr></thead>
            <tbody>
              ${SINYAL.map((s) => `
                <tr>
                  <td class="nowrap"><b>${amankan(s.label)}</b>${s.satuan ? `<br><span class="mini-teks samar-teks">${amankan(s.satuan)}</span>` : ''}</td>
                  <td class="nowrap"><span class="keping" data-nada="rendah">${amankan(s.jenis)}</span></td>
                  <td class="kecil-teks">${amankan(s.ket)}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`,
      })}
    </div>`

  pasangPenyimak(isi, semua, sekarang)

  const aktif = aturan.filter((a) => a.aktif).length
  const menyala = Object.values(perAturan).filter((n) => n > 0).length
  return {
    judul: 'Aturan Peringatan',
    sub: `${angka(aktif)} dari ${angka(aturan.length)} aktif · ${angka(menyala)} sedang menyala`,
  }
}

/* ------------------------------------------------------------ baris aturan */

function barisAturan(a, jumlah) {
  const nada = TINGKAT_RISIKO.find((t) => t.kode === a.tingkat)?.nada || 'rendah'

  return `
    <article class="aturan-baris${a.aktif ? '' : ' mati'}">
      <div class="aturan-utama">
        <div class="baris gap-6">
          <b>${amankan(a.nama)}</b>
          ${keping(a.tingkat, nada)}
          ${a.bawaan ? keping('Bawaan', 'rendah', true) : ''}
          ${a.aktif ? '' : keping('Dimatikan', 'rendah')}
        </div>
        <div class="aturan-kalimat">${amankan(ringkasAturan(a))}</div>
        ${a.ket ? `<div class="mini-teks samar-teks">${amankan(a.ket)}</div>` : ''}
      </div>

      <div class="aturan-angka">
        <div class="aturan-jumlah${jumlah ? ' menyala' : ''}"
             title="Berapa peristiwa memenuhi aturan ini pada arsip yang termuat">${angka(jumlah)}</div>
        <div class="mini-teks samar-teks">${jumlah === 1 ? 'peristiwa' : 'peristiwa'}</div>
      </div>

      <div class="aturan-aksi">
        ${tombol({
          label: a.aktif ? 'Matikan' : 'Nyalakan', kecil: true, aksi: 'alih-aktif',
          data: { id: a.id, aktif: a.aktif ? 'ya' : 'tidak' },
          judul: a.aktif ? 'Aturan ini berhenti dinilai' : 'Aturan ini kembali dinilai',
        })}
        ${tombolIkon({ ikon: 'pengaturan', aksi: 'sunting-aturan', judul: 'Sunting aturan ini', kecil: true, data: { id: a.id } })}
        ${tombolIkon({
          ikon: a.bawaan ? 'sinkron' : 'tutup',
          aksi: 'hapus-aturan',
          judul: a.bawaan ? 'Pulihkan ke bentuk bawaannya' : 'Hapus aturan ini',
          kecil: true,
          data: { id: a.id, nama: a.nama, bawaan: a.bawaan ? 'ya' : '' },
        })}
      </div>
    </article>`
}

/* ------------------------------------------------------------------ borang */

function borangAturan(d, semua, sekarang) {
  const percobaan = jalankanAturan(semua, { sekarang, aturan: [bakukanAturan({ ...d, aktif: true })] })
  const kena = percobaan.temuan.length
  const bagian = percobaan.jumlahPeristiwa ? kena / percobaan.jumlahPeristiwa : 0

  const nadaJangkauan = !d.syarat.length ? 'netral'
    : kena === 0 ? 'sedang'
      : bagian > 0.3 ? 'kritis'
        : bagian > 0.12 ? 'sedang' : 'positif'

  const kalimatJangkauan = !d.syarat.length
    ? 'Belum ada syarat, jadi aturan ini tidak akan pernah menyala.'
    : kena === 0
      ? 'Tidak ada satu pun peristiwa di arsip yang termuat yang memenuhi aturan ini. Itu boleh saja — '
        + 'aturan untuk keadaan langka memang jarang menyala — tetapi periksa dulu apakah ambangnya keliru.'
      : bagian > 0.3
        ? `Aturan ini menyala pada ${angka(kena)} dari ${angka(percobaan.jumlahPeristiwa)} peristiwa. `
          + 'Sebanyak itu bukan peringatan lagi, melainkan daftar. Naikkan ambangnya.'
        : `Aturan ini akan menyala pada ${angka(kena)} dari ${angka(percobaan.jumlahPeristiwa)} peristiwa `
          + 'pada arsip yang termuat.';

  return kartu({
    judul: d.id ? 'Sunting aturan' : 'Aturan baru',
    ket: 'Jangkauannya dihitung ulang setiap kali syaratnya berubah, sebelum disimpan.',
    isi: `
      <div class="aturan-borang">
        <label class="bidang">
          <span>Nama aturan</span>
          <input class="masukan" data-bidang="nama" value="${amankan(d.nama)}"
                 placeholder="mis. Isu narkotika di wilayah saya" maxlength="100">
        </label>

        <label class="bidang">
          <span>Keterangan singkat</span>
          <input class="masukan" data-bidang="ket" value="${amankan(d.ket)}"
                 placeholder="Untuk apa aturan ini ada" maxlength="240">
        </label>

        <div class="aturan-syarat">
          <div class="baris gap-6">
            <b class="kecil-teks">Syarat</b>
            <select class="pilihan" data-bidang="gabung" aria-label="Cara syarat digabungkan">
              <option value="semua"${d.gabung === 'semua' ? ' selected' : ''}>Seluruhnya harus terpenuhi</option>
              <option value="salah_satu"${d.gabung === 'salah_satu' ? ' selected' : ''}>Salah satunya cukup</option>
            </select>
            <div class="dorong">
              ${tombol({ label: 'Tambah syarat', ikon: 'tambah', kecil: true, aksi: 'tambah-syarat',
                nonaktif: d.syarat.length >= 8 })}
            </div>
          </div>

          ${d.syarat.length
            ? d.syarat.map((s, i) => barisSyarat(s, i)).join('')
            : '<div class="samar-teks kecil-teks">Belum ada syarat. Tambahkan sekurangnya satu.</div>'}
        </div>

        <div class="kisi kisi-3">
          <label class="bidang">
            <span>Tingkat</span>
            <select class="pilihan" data-bidang="tingkat" aria-label="Tingkat peringatan">
              ${TINGKAT_RISIKO.map((t) => `
                <option value="${amankan(t.kode)}"${d.tingkat === t.kode ? ' selected' : ''}>${amankan(t.kode)}</option>`).join('')}
            </select>
          </label>

          <label class="bidang">
            <span>Naikkan ke</span>
            <select class="pilihan" data-bidang="eskalasi" aria-label="Alamat eskalasi">
              ${ESKALASI.map((e) => `
                <option value="${amankan(e.kode)}"${d.eskalasi === e.kode ? ' selected' : ''}>${amankan(e.label)}</option>`).join('')}
            </select>
          </label>

          <div class="bidang">
            <span>Saluran</span>
            <div class="baris gap-6">
              ${SALURAN.map((s) => `
                <label class="centang-baris" title="${amankan(s.ket)}">
                  <input type="checkbox" data-saluran="${amankan(s.kode)}"
                         ${d.saluran.includes(s.kode) ? 'checked' : ''}>
                  <span>${amankan(s.label)}</span>
                </label>`).join('')}
            </div>
          </div>
        </div>

        <div class="aturan-jangkauan" data-nada="${nadaJangkauan}">
          ${ikon('info')}
          <div>
            <b>${amankan(ringkasAturan(bakukanAturan(d)))}</b>
            <div class="kecil-teks">${amankan(kalimatJangkauan)}</div>
          </div>
        </div>

        <div class="baris gap-6">
          ${tombol({ label: 'Simpan aturan', ikon: 'centang', gaya: 'utama', aksi: 'simpan-aturan',
            nonaktif: !d.syarat.length || !d.nama.trim() })}
          ${tombol({ label: 'Batal', ikon: 'tutup', aksi: 'batal-sunting' })}
        </div>
      </div>`,
  })
}

function barisSyarat(s, i) {
  const sinyal = sinyalDari(s.sinyal)
  const banding = bandingUntuk(s.sinyal)

  return `
    <div class="syarat-baris" data-nomor="${i}">
      <select class="pilihan" data-syarat="sinyal" data-nomor="${i}" aria-label="Sinyal syarat ${i + 1}">
        ${SINYAL.map((x) => `
          <option value="${amankan(x.kode)}"${x.kode === s.sinyal ? ' selected' : ''}>${amankan(x.label)}</option>`).join('')}
      </select>

      <select class="pilihan" data-syarat="banding" data-nomor="${i}" aria-label="Pembanding syarat ${i + 1}">
        ${banding.map((b) => `
          <option value="${amankan(b.kode)}"${b.kode === s.banding ? ' selected' : ''}>${amankan(b.tanda)} ${amankan(b.label)}</option>`).join('')}
      </select>

      ${bidangNilai(sinyal, s, i)}

      ${tombolIkon({ ikon: 'tutup', aksi: 'hapus-syarat', judul: `Hapus syarat ${i + 1}`, kecil: true, data: { nomor: i } })}
    </div>`
}

/**
 * Bidang nilai mengikuti jenis sinyalnya.
 *
 * Sinyal berjenis pilihan dan boolean tidak boleh diberi kotak teks bebas:
 * `sentimen: Negatip` akan tersimpan, tampil rapi, dan tidak pernah cocok
 * dengan satu baris pun.
 */
function bidangNilai(sinyal, s, i) {
  if (!sinyal) return ''

  if (sinyal.jenis === 'boolean') {
    return `
      <select class="pilihan" data-syarat="nilai" data-nomor="${i}" aria-label="Nilai syarat ${i + 1}">
        <option value="true"${s.nilai === true || s.nilai === 'true' ? ' selected' : ''}>ya</option>
        <option value="false"${!(s.nilai === true || s.nilai === 'true') ? ' selected' : ''}>tidak</option>
      </select>`
  }

  if (sinyal.pilihan) {
    return `
      <select class="pilihan" data-syarat="nilai" data-nomor="${i}" aria-label="Nilai syarat ${i + 1}">
        ${sinyal.pilihan.map((p) => `
          <option value="${amankan(p)}"${String(s.nilai) === p ? ' selected' : ''}>${amankan(p)}</option>`).join('')}
      </select>`
  }

  if (sinyal.jenis === 'angka') {
    return `<input class="masukan" type="number" min="0" data-syarat="nilai" data-nomor="${i}"
      value="${amankan(s.nilai ?? 0)}" aria-label="Nilai syarat ${i + 1}" style="max-width:110px">`
  }

  return `<input class="masukan" data-syarat="nilai" data-nomor="${i}"
    value="${amankan(s.nilai ?? '')}" placeholder="teks" aria-label="Nilai syarat ${i + 1}">`
}

/* ---------------------------------------------------------------- penyimak */

function pasangPenyimak(isi, semua, sekarang) {
  const gambarUlang = () => isi.dispatchEvent(new CustomEvent('gambar-ulang', { bubbles: true }))

  /* Bidang teks tidak menggambar ulang halaman pada tiap ketikan — fokusnya
     akan hilang di tengah kalimat. Nilainya disimpan apa adanya; jangkauan
     dihitung ulang saat bidangnya ditinggalkan. */
  for (const el of isi.querySelectorAll('[data-bidang]')) {
    const nama = el.dataset.bidang
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', () => { if (draf) { draf[nama] = el.value; gambarUlang() } })
    } else {
      el.addEventListener('input', () => { if (draf) draf[nama] = el.value })
      el.addEventListener('change', () => { if (draf) { draf[nama] = el.value; gambarUlang() } })
    }
  }

  for (const el of isi.querySelectorAll('[data-syarat]')) {
    const ubah = () => {
      if (!draf) return
      const n = Number(el.dataset.nomor)
      const kunci = el.dataset.syarat
      const s = draf.syarat[n]
      if (!s) return

      if (kunci === 'sinyal') {
        s.sinyal = el.value
        // Pembanding dan nilai lama hampir selalu tidak sah untuk sinyal baru.
        const pertama = bandingUntuk(el.value)[0]
        s.banding = pertama ? pertama.kode : 'eq'
        const sinyal = sinyalDari(el.value)
        s.nilai = sinyal?.jenis === 'angka' ? 0
          : sinyal?.jenis === 'boolean' ? true
            : sinyal?.pilihan ? sinyal.pilihan[0] : ''
      } else if (kunci === 'nilai') {
        const sinyal = sinyalDari(s.sinyal)
        s.nilai = sinyal?.jenis === 'angka' ? Number(el.value) || 0
          : sinyal?.jenis === 'boolean' ? el.value === 'true'
            : el.value
      } else {
        s.banding = el.value
      }
      gambarUlang()
    }
    el.addEventListener('change', ubah)
  }

  for (const el of isi.querySelectorAll('[data-saluran]')) {
    el.addEventListener('change', () => {
      if (!draf) return
      const kode = el.dataset.saluran
      draf.saluran = el.checked
        ? [...new Set([...draf.saluran, kode])]
        : draf.saluran.filter((s) => s !== kode)
    })
  }

  isi.addEventListener('click', async (ev) => {
    const simpul = ev.target.closest('[data-aksi]')
    const aksi = simpul?.dataset.aksi
    if (!aksi) return

    if (aksi === 'aturan-baru') {
      draf = bakukanAturan({
        ket: '', tingkat: 'Tinggi', eskalasi: 'analis', saluran: ['aplikasi'],
        syarat: [{ sinyal: 'skor', banding: 'ge', nilai: 65 }],
      })
      /*
         Nama dikosongkan SESUDAH pembakuan, bukan sebelumnya.

         `bakukanAturan` mengisi nama kosong dengan "Aturan tanpa nama" — benar
         untuk baris yang sudah tersimpan, sebab daftar tanpa nama tidak bisa
         dibaca siapa pun. Pada borang yang baru dibuka ia salah: kotaknya
         terisi teks yang harus dihapus lebih dulu, dan tombol Simpan menyala
         seolah-olah aturannya sudah siap.
      */
      draf.nama = ''
      draf.id = ''
      gambarUlang()
      return
    }

    if (aksi === 'sunting-aturan') {
      const a = daftarAturan().find((x) => x.id === simpul.dataset.id)
      if (a) { draf = bakukanAturan(a); gambarUlang() }
      return
    }

    if (aksi === 'batal-sunting') { draf = null; gambarUlang(); return }

    if (aksi === 'tambah-syarat') {
      if (!draf) return
      draf.syarat.push({ sinyal: 'media', banding: 'ge', nilai: 3 })
      gambarUlang()
      return
    }

    if (aksi === 'hapus-syarat') {
      if (!draf) return
      draf.syarat.splice(Number(simpul.dataset.nomor), 1)
      gambarUlang()
      return
    }

    if (aksi === 'alih-aktif') {
      setelAktif(simpul.dataset.id, simpul.dataset.aktif !== 'ya')
      gambarUlang()
      return
    }

    if (aksi === 'hapus-aturan') {
      const bawaan = simpul.dataset.bawaan === 'ya'
      const ya = await konfirmasi({
        judul: bawaan ? 'Pulihkan aturan bawaan?' : 'Hapus aturan?',
        pesan: bawaan
          ? `"${simpul.dataset.nama}" akan kembali ke ambang bawaannya. Perubahan yang Anda buat hilang.`
          : `"${simpul.dataset.nama}" akan dihapus. Temuan yang sudah pernah muncul tidak terpengaruh.`,
        tegas: bawaan ? 'Pulihkan' : 'Hapus',
        bahaya: !bawaan,
      })
      if (!ya) return
      const hasil = hapusAturan(simpul.dataset.id)
      roti(hasil.dipulihkan ? 'Aturan bawaan dipulihkan.' : 'Aturan dihapus.', 'netral')
      if (draf?.id === simpul.dataset.id) draf = null
      gambarUlang()
      return
    }

    if (aksi === 'simpan-aturan') {
      if (!draf) return
      if (!draf.nama.trim()) { roti('Beri nama dulu; daftar aturan tanpa nama tidak bisa dibaca siapa pun.', 'sedang'); return }
      if (!draf.syarat.length) { roti('Aturan tanpa syarat tidak akan pernah menyala.', 'sedang'); return }

      const hasil = simpanAturan(draf)
      if (hasil.penuh) {
        roti(`Sudah ada ${BATAS} aturan buatan sendiri. Hapus salah satu lebih dulu.`, 'sedang', 5200)
        return
      }
      roti(hasil.awet
        ? 'Aturan tersimpan.'
        : 'Tersimpan untuk sesi ini saja — peramban menolak menyimpan data situs.',
      hasil.awet ? 'positif' : 'sedang', 5200)
      draf = null
      gambarUlang()
    }
  })
}
