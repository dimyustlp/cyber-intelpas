/**
 * Profil media — bagaimana tiap media memberitakan kita, dihitung dari arsip
 * yang sudah termuat di peramban. Tidak ada kueri tambahan.
 *
 * Yang dihitung sengaja sedikit dan dapat diperiksa tangan: jumlah, sebaran
 * nada, berapa yang mendesak, unit yang paling sering disorot, dan apakah
 * pemberitaannya naik atau turun dibanding periode sebelumnya.
 *
 * Satu kehati-hatian dipasang di kode, bukan hanya di layar: persentase negatif
 * dari media yang hanya menerbitkan dua-tiga berita tidak berarti apa-apa, jadi
 * di bawah ambang `MINIMAL_UNTUK_NADA` kolom nada ditandai "terlalu sedikit".
 * Tanpa ini daftar teratas selalu diisi media yang kebetulan baru sekali
 * menulis, dan kebetulan negatif.
 */

import { ringkasan } from './hitung.js'
import { ember } from './sentimen.js'

export const MINIMAL_UNTUK_NADA = 5
export const JENDELA_HARI = 30

const HARI = 86_400_000

function waktuBerita(b) {
  const t = new Date(b.created_at || b.tanggal || 0).getTime()
  return Number.isFinite(t) ? t : 0
}

function namaMedia(b) {
  return String(b.media || '').trim()
}

/** Satu baris per media, terbanyak dulu. */
export function susunProfilMedia(berita = [], sekarang = new Date()) {
  const inti = ringkasan(berita, sekarang).inti
  const t0 = sekarang.getTime()
  const peta = new Map()

  for (const b of inti) {
    const nama = namaMedia(b)
    if (!nama) continue
    if (!peta.has(nama)) {
      peta.set(nama, {
        media: nama, jumlah: 0, negatif: 0, positif: 0, netral: 0, belum: 0,
        mendesak: 0, kritis: 0, terakhir: 0, terbaru: 0, sebelumnya: 0, unit: new Map(),
      })
    }
    const p = peta.get(nama)
    p.jumlah += 1
    p[ember(b)] += 1
    if (b.urgensi === 'Kritis') p.kritis += 1
    if (b.urgensi === 'Kritis' || b.urgensi === 'Tinggi') p.mendesak += 1

    const t = waktuBerita(b)
    if (t > p.terakhir) p.terakhir = t
    const umur = (t0 - t) / HARI
    if (umur >= 0 && umur < JENDELA_HARI) p.terbaru += 1
    else if (umur >= JENDELA_HARI && umur < JENDELA_HARI * 2) p.sebelumnya += 1

    const unit = String(b.nama_upt || '').trim()
    if (unit) p.unit.set(unit, (p.unit.get(unit) || 0) + 1)
  }

  const semuaNegatif = inti.filter((b) => ember(b) === 'negatif').length
  const rataNegatif = inti.length ? semuaNegatif / inti.length : 0

  return [...peta.values()]
    .map((p) => {
      const cukup = p.jumlah >= MINIMAL_UNTUK_NADA
      const bagianNegatif = p.jumlah ? p.negatif / p.jumlah : 0
      return {
        ...p,
        cukup,
        bagianNegatif,
        /** Selisih bagian negatif dengan rata-rata seluruh arsip, hanya bila datanya cukup. */
        selisihRata: cukup ? bagianNegatif - rataNegatif : null,
        arah: p.sebelumnya === 0 && p.terbaru === 0 ? 'diam'
          : p.terbaru > p.sebelumnya * 1.5 && p.terbaru - p.sebelumnya >= 3 ? 'naik'
            : p.sebelumnya > p.terbaru * 1.5 && p.sebelumnya - p.terbaru >= 3 ? 'turun' : 'tetap',
        unitTeratas: [...p.unit.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      }
    })
    .sort((a, b) => b.jumlah - a.jumlah)
}

export function rataNegatifArsip(profil) {
  const total = profil.reduce((s, p) => s + p.jumlah, 0)
  const neg = profil.reduce((s, p) => s + p.negatif, 0)
  return total ? neg / total : 0
}
