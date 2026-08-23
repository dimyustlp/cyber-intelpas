/**
 * Pemotret halaman — menjalankan aplikasi di peramban tanpa layar, lalu
 * menyimpan gambarnya.
 *
 * Gunanya bukan sekadar bikin gambar untuk dipamerkan. Peramban tanpa layar
 * adalah satu-satunya cara memastikan berkas benar-benar hidup: kalau ada modul
 * yang luput, atau ada sintaks yang salah, halamannya diam saja dan gambarnya
 * kosong. Kesalahan konsol ikut dicetak, jadi kegagalan tidak lewat begitu saja.
 *
 * ---------------------------------------------------------------------------
 * Kenapa memakai protokol, bukan --window-size
 * ---------------------------------------------------------------------------
 *
 * Versi sebelumnya mengatur lebar lewat `--window-size` dan diam-diam salah.
 * Di Windows, jendela peramban punya lebar minimum: permintaan 390 piksel
 * menghasilkan lebar CSS 491, dan permintaan yang lebih sempit dari itu pun
 * tetap 491. Akibatnya setiap pemeriksaan tampilan telepon selama ini menilai
 * layar yang sama sekali berbeda dari yang dimaksud — dan tata letak yang
 * meluber di telepon sungguhan lolos berkali-kali karena gambarnya memang tidak
 * pernah dibuat pada lebar telepon.
 *
 * Sekarang lebar diatur lewat Emulation.setDeviceMetricsOverride pada protokol
 * DevTools, yang tidak mengenal batas jendela sistem. Lebar yang diminta adalah
 * lebar yang dipakai, dan tool ini mencetaknya kembali supaya kalau suatu saat
 * ia meleset lagi, kesalahannya terbaca alih-alih tersembunyi.
 *
 * WebSocket dipakai langsung dari Node, tanpa pustaka tambahan.
 *
 *   node tools/potret.mjs <alamat> <keluaran.png> [lebar] [tinggi] [--telepon]
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PERAMBAN = [
  process.env.PERAMBAN || '',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((j) => j && existsSync(j))

if (!PERAMBAN) {
  console.error('Peramban tanpa layar tidak ditemukan.')
  process.exit(1)
}

const argumen = process.argv.slice(2)
const bendera = new Set(argumen.filter((a) => a.startsWith('--')))
const [alamat, keluaran, lebarArg = '1440', tinggiArg = '2400'] = argumen.filter((a) => !a.startsWith('--'))

if (!alamat || !keluaran) {
  console.error('Pemakaian: node tools/potret.mjs <alamat> <keluaran.png> [lebar] [tinggi] [--telepon]')
  process.exit(1)
}

const lebar = Number(lebarArg)
const tinggi = Number(tinggiArg)
const telepon = bendera.has('--telepon') || lebar < 700
const skala = Number(process.env.SKALA || 2)

/* ------------------------------------------------------------- peramban */

const profil = mkdtempSync(join(tmpdir(), 'potret-'))

const anak = spawn(PERAMBAN, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  '--remote-debugging-port=0',
  '--remote-allow-origins=*',
  `--user-data-dir=${profil}`,
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
])

let cerocos = ''

/** Alamat soket protokol dicetak peramban ke stderr saat ia siap. */
const alamatSoket = await new Promise((selesai, tolak) => {
  const jaga = setTimeout(() => tolak(new Error('Peramban tidak kunjung siap.')), 30000)
  anak.stderr.on('data', (d) => {
    cerocos += d.toString()
    const cocok = cerocos.match(/ws:\/\/[^\s]+/)
    if (cocok) { clearTimeout(jaga); selesai(cocok[0]) }
  })
  anak.on('exit', (kode) => { clearTimeout(jaga); tolak(new Error(`Peramban berhenti, kode ${kode}.`)) })
})

/* -------------------------------------------------------------- protokol */

const soket = new WebSocket(alamatSoket)
await new Promise((selesai, tolak) => {
  soket.onopen = selesai
  soket.onerror = () => tolak(new Error('Tidak dapat tersambung ke protokol peramban.'))
})

let nomor = 0
const menunggu = new Map()
const galatHalaman = []

soket.onmessage = (pesan) => {
  const isi = JSON.parse(pesan.data)

  if (isi.id && menunggu.has(isi.id)) {
    const { selesai, tolak } = menunggu.get(isi.id)
    menunggu.delete(isi.id)
    if (isi.error) tolak(new Error(isi.error.message))
    else selesai(isi.result)
    return
  }

  // Kesalahan halaman dikumpulkan apa adanya. Halaman yang tampak baik-baik
  // saja tetapi melempar galat saat dimuat adalah halaman yang rusak.
  if (isi.method === 'Runtime.exceptionThrown') {
    const r = isi.params?.exceptionDetails
    galatHalaman.push(r?.exception?.description || r?.text || 'galat tanpa keterangan')
  }
  if (isi.method === 'Runtime.consoleAPICalled' && isi.params?.type === 'error') {
    galatHalaman.push((isi.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
  }
}

function kirim(metode, params = {}, sesi) {
  const id = ++nomor
  return new Promise((selesai, tolak) => {
    menunggu.set(id, { selesai, tolak })
    soket.send(JSON.stringify({ id, method: metode, params, sessionId: sesi }))
  })
}

/* ---------------------------------------------------------------- potret */

let kode = 0

try {
  const { targetId } = await kirim('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await kirim('Target.attachToTarget', { targetId, flatten: true })

  await kirim('Page.enable', {}, sessionId)
  await kirim('Runtime.enable', {}, sessionId)

  // Inilah bagian yang dulu tidak ada. Lebar, tinggi, dan kerapatan piksel
  // ditetapkan pada mesin rendernya sendiri, bukan pada jendela sistem.
  await kirim('Emulation.setDeviceMetricsOverride', {
    width: lebar,
    height: tinggi,
    deviceScaleFactor: skala,
    mobile: telepon,
    screenWidth: lebar,
    screenHeight: tinggi,
  }, sessionId)

  if (telepon) {
    await kirim('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }, sessionId)
  }

  const dimuat = new Promise((selesai) => {
    const asli = soket.onmessage
    soket.onmessage = (pesan) => {
      asli(pesan)
      const isi = JSON.parse(pesan.data)
      if (isi.method === 'Page.loadEventFired') selesai()
    }
  })

  await kirim('Page.navigate', { url: alamat }, sessionId)
  await dimuat

  // Aplikasi ini menggambar dirinya setelah modul dimuat, jadi memotret tepat
  // pada load event akan menangkap kerangka kosong.
  await new Promise((r) => setTimeout(r, 1200))

  /*
     Sebagian keadaan hanya muncul setelah ada yang menekan sesuatu: palet
     perintah, laci menu, sembul konfirmasi. Tanpa jalan untuk memicunya,
     keadaan-keadaan itu tidak pernah bisa diperiksa lewat gambar — dan
     justru di sanalah kesalahan tata letak paling sering bersembunyi, sebab
     tidak ada yang pernah melihatnya berdampingan dengan halamannya.
  */
  const skrip = process.env.JALANKAN || ''
  if (skrip) {
    const { result: hasilSkrip, exceptionDetails } = await kirim('Runtime.evaluate', {
      expression: skrip,
      awaitPromise: true,
      returnByValue: true,
    }, sessionId)
    if (exceptionDetails) {
      console.error('Skrip pemicu gagal: ' + (exceptionDetails.exception?.description || exceptionDetails.text))
      kode = 2
    } else if (hasilSkrip?.value !== undefined) {
      console.log('Skrip pemicu: ' + JSON.stringify(hasilSkrip.value).slice(0, 200))
    }
    await new Promise((r) => setTimeout(r, 600))
  }

  // Lebar yang sungguh-sungguh dipakai, dibaca dari halamannya sendiri.
  const { result } = await kirim('Runtime.evaluate', {
    expression: `JSON.stringify({
      css: document.documentElement.clientWidth,
      gulung: document.documentElement.scrollWidth,
      dpr: window.devicePixelRatio,
    })`,
    returnByValue: true,
  }, sessionId)
  const ukuran = JSON.parse(result.value)

  const { data } = await kirim('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
  }, sessionId)

  writeFileSync(keluaran, Buffer.from(data, 'base64'))

  const meluber = ukuran.gulung > ukuran.css + 1
  console.log(
    `${keluaran} tersimpan — lebar CSS ${ukuran.css}px, dpr ${ukuran.dpr}`
    + (meluber ? `, MELUBER ke samping sampai ${ukuran.gulung}px` : ''),
  )

  if (ukuran.css !== lebar) {
    console.error(`Peringatan: lebar yang diminta ${lebar}px, yang dipakai ${ukuran.css}px.`)
    kode = 3
  }
  if (meluber) kode = 3

  if (galatHalaman.length) {
    console.error('Kesalahan di halaman:')
    for (const g of [...new Set(galatHalaman)].slice(0, 8)) console.error('  ' + String(g).slice(0, 200))
    kode = 2
  }
} catch (galat) {
  console.error(`Gagal memotret: ${galat.message}`)
  kode = 1
} finally {
  try { soket.close() } catch { /* sudah tertutup */ }
  anak.kill()
  try { rmSync(profil, { recursive: true, force: true }) } catch { /* Windows kadang menahan berkasnya */ }
}

process.exit(kode)
