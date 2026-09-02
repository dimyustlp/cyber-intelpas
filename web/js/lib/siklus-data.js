/**
 * Lapisan data siklus intelijen — satu pintu untuk lima halaman.
 *
 * Dua alasan berkas ini ada, dan keduanya sudah pernah menggigit proyek ini
 * di tempat lain:
 *
 *   Satu bentuk baris. Lima halaman membaca tabel yang beririsan — daftar
 *   kasus muncul di Kasus Intelijen, di Verifikasi Lapangan, di Evaluasi, dan
 *   di Keputusan Pimpinan. Kalau tiap halaman menulis sendiri daftar kolom
 *   yang ditariknya, cepat atau lambat satu halaman lupa satu kolom, dan
 *   layarnya menampilkan "undefined" tanpa satu pun galat di konsol.
 *
 *   Satu jalur peragaan. Mode peragaan tidak menyentuh peladen sama sekali:
 *   `panggil()` di lib/api.js melempar galat begitu KONFIG.mode === 'demo'.
 *   Tanpa tempat seperti ini, tiap halaman harus menumbuhkan cabang "kalau
 *   demo" sendiri-sendiri — dan cabang yang ditulis lima kali akan berbeda
 *   perilakunya di kelima tempat.
 *
 * Yang disimpan mode peragaan hidup di memori dan hilang saat halaman
 * dimuat ulang. Itu disengaja: peragaan yang menyimpan ke localStorage akan
 * membawa kasus karangan seorang pelatih ke sesi pelatihan berikutnya.
 */

import { ambil, sisip, perbarui, profilSekarang } from './api.js'
import { KONFIG } from './konfig.js'
import { PERTANYAAN_BAKU } from './siklus.js'

const demo = () => KONFIG.mode === 'demo'

/** Kolom yang ditarik tiap tabel. Ditulis sekali, dipakai semua halaman. */
export const KOLOM = {
  kasus: 'id,case_number,title,issue_type,primary_upt,status,priority,actuality_status,'
    + 'first_detected_at,last_media_at,article_count,media_count,negative_count,highest_urgency,'
    + 'summary,owner_username,created_by,created_at,updated_at,closed_at,metadata',
  kasusBerita: 'id,case_id,berita_id,linked_by,created_at',
  penugasan: 'id,assignment_number,case_id,assigned_to,assigned_team,instruction,'
    + 'verification_questions,priority,status,assigned_by,assigned_at,accepted_at,due_at,'
    + 'completed_at,updated_at',
  laporanLapangan: 'id,assignment_id,case_id,report_type,visit_started_at,visit_finished_at,'
    + 'officers,parties_met,activity_summary,facts_found,upt_explanation,documents_checked,'
    + 'obstacles,immediate_actions,upt_commitments,commitment_due_at,finding_classification,'
    + 'initial_conclusion,status,submitted_by,submitted_at,reviewed_by,reviewed_at,review_note',
  bukti: 'id,report_id,case_id,file_name,storage_path,mime_type,size_bytes,description,'
    + 'evidence_type,verification_status,uploaded_by,created_at',
  analisis: 'id,case_id,analysis_version,media_narrative,field_facts,comparison_matrix,'
    + 'information_validity,reputation_impact,operational_impact,compliance_impact,'
    + 'media_escalation_risk,root_causes,final_analysis,follow_up_assessment,status,'
    + 'created_by,created_at,verified_by,verified_at',
  rekomendasi: 'id,case_id,analysis_id,recommendation_type,recommendation,responsible_party,'
    + 'priority,due_at,status,progress_percent,created_by,created_at,decided_by,decided_at,'
    + 'decision_note,completed_at',
  putusan: 'id,case_id,decision,decision_note,recommendation_ids,decided_by,decided_at',
  tindak: 'id,case_id,recommendation_id,title,description,assigned_role,assigned_to,priority,'
    + 'status,due_at,progress_percent,created_by,created_at,updated_at,completed_at',
}

/* ----------------------------------------------------------- simpanan demo */

/**
 * Simpanan peragaan. Diisi sekali oleh `siapkanDemo()`, lalu disunting di
 * tempat oleh fungsi tulis di bawah, sehingga mode peragaan terasa hidup:
 * kasus yang dibuat pelatih benar-benar muncul di daftar.
 */
const simpanan = {
  siap: false,
  kasus: [],
  kasusBerita: [],
  penugasan: [],
  laporanLapangan: [],
  bukti: [],
  analisis: [],
  rekomendasi: [],
  putusan: [],
  tindak: [],
}

export function simpananDemo() { return simpanan }

/** Penanda acak sederhana. Tidak perlu tahan tabrakan — hanya hidup di memori. */
let nomorUrut = 0
export function idDemo(awalan = 'demo') {
  nomorUrut += 1
  return `${awalan}-${nomorUrut.toString().padStart(4, '0')}`
}

function siapa() {
  return profilSekarang()?.username || 'peraga'
}

/* --------------------------------------------------------------- pembacaan */

/**
 * Membaca satu tabel siklus.
 *
 * `saring` memakai tata bahasa PostgREST apa adanya (`eq.`, `in.`, dan
 * seterusnya) supaya pemanggilnya tidak perlu belajar dua tata bahasa. Pada
 * mode peragaan hanya bentuk `eq.` dan `in.` yang dikenali — itu yang dipakai
 * kelima halaman, dan menerjemahkan seluruh tata bahasa PostgREST di sini
 * berarti menulis ulang PostgREST.
 */
export async function bacaSiklus(nama, { saring = {}, urut = null, batas = 500 } = {}) {
  if (demo()) return saringLokal(simpanan[nama] || [], saring, urut, batas)

  const params = { select: KOLOM[nama], limit: batas, ...saring }
  if (urut) params.order = urut
  return (await ambil(TABEL[nama], params)) || []
}

/** Nama tabel basis data untuk tiap kunci. */
const TABEL = {
  kasus: 'intelligence_cases',
  kasusBerita: 'case_news',
  penugasan: 'field_assignments',
  laporanLapangan: 'field_reports',
  bukti: 'field_evidence',
  analisis: 'case_analyses',
  rekomendasi: 'case_recommendations',
  putusan: 'case_decisions',
  tindak: 'action_items',
}

function saringLokal(baris, saring, urut, batas) {
  let hasil = [...baris]
  for (const [kolom, ungkapan] of Object.entries(saring)) {
    if (kolom === 'select' || kolom === 'limit' || kolom === 'order') continue
    const [operator, ...sisa] = String(ungkapan).split('.')
    const nilai = sisa.join('.')
    if (operator === 'eq') hasil = hasil.filter((b) => String(b[kolom]) === nilai)
    else if (operator === 'in') {
      const anggota = nilai.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''))
      hasil = hasil.filter((b) => anggota.includes(String(b[kolom])))
    } else if (operator === 'is' && nilai === 'null') hasil = hasil.filter((b) => b[kolom] == null)
    else if (operator === 'not') hasil = hasil.filter((b) => b[kolom] != null)
  }
  if (urut) {
    const [kolom, arah] = urut.split('.')
    hasil.sort((a, b) => String(a[kolom] ?? '').localeCompare(String(b[kolom] ?? '')))
    if (arah === 'desc') hasil.reverse()
  }
  return hasil.slice(0, batas)
}

/* ---------------------------------------------------------------- penulisan */

export async function tulisSiklus(nama, isi) {
  if (demo()) {
    const baris = {
      id: idDemo(nama),
      created_at: new Date().toISOString(),
      ...isi,
    }
    simpanan[nama].unshift(baris)
    return [baris]
  }
  return sisip(TABEL[nama], isi)
}

export async function ubahSiklus(nama, id, perubahan) {
  if (demo()) {
    const baris = simpanan[nama].find((b) => b.id === id)
    if (baris) Object.assign(baris, perubahan)
    return baris ? [baris] : []
  }
  return perbarui(TABEL[nama], { id: `eq.${id}` }, perubahan)
}

/* ------------------------------------------------------------- penghitungan */

/**
 * Jumlah berkas tiap kasus, dari seluruh tabel sekaligus.
 *
 * Dihitung sekali di sini dan dibagikan, bukan dihitung ulang tiap kartu.
 * Daftar kasus menampilkan lima angka per baris; menghitungnya per baris
 * berarti lima ratus penelusuran larik untuk seratus kasus di layar.
 */
export function hitungIsiKasus(kumpulan) {
  const kosong = () => ({
    berita: 0, penugasan: 0, laporanLapangan: 0, analisis: 0,
    rekomendasi: 0, rekomendasiDisetujui: 0, putusan: 0, tindak: 0, tindakSelesai: 0,
    tindakTerlambat: 0,
  })
  const peta = new Map()
  const ambilBaris = (id) => {
    if (!peta.has(id)) peta.set(id, kosong())
    return peta.get(id)
  }

  for (const b of kumpulan.kasusBerita || []) ambilBaris(b.case_id).berita += 1
  for (const p of kumpulan.penugasan || []) ambilBaris(p.case_id).penugasan += 1
  for (const l of kumpulan.laporanLapangan || []) ambilBaris(l.case_id).laporanLapangan += 1
  for (const a of kumpulan.analisis || []) ambilBaris(a.case_id).analisis += 1
  for (const r of kumpulan.rekomendasi || []) {
    const baris = ambilBaris(r.case_id)
    baris.rekomendasi += 1
    if (r.status === 'Disetujui' || r.status === 'Selesai') baris.rekomendasiDisetujui += 1
  }
  for (const k of kumpulan.putusan || []) ambilBaris(k.case_id).putusan += 1

  const sekarang = new Date()
  for (const t of kumpulan.tindak || []) {
    const baris = ambilBaris(t.case_id)
    baris.tindak += 1
    if (t.status === 'Selesai' || t.status === 'Dibatalkan') baris.tindakSelesai += 1
    else if (t.due_at && new Date(t.due_at) < sekarang) baris.tindakTerlambat += 1
  }

  return { peta, untuk: (id) => peta.get(id) || kosong() }
}

/* ------------------------------------------------------------ data peragaan */

/**
 * Menyusun satu siklus peragaan yang utuh dari berita peragaan yang sudah ada
 * di layar.
 *
 * Enam kasus, sengaja berhenti di enam tahap yang berbeda, supaya seorang
 * pelatih bisa memperlihatkan seluruh alur dalam satu sesi tanpa perlu
 * menunggu kasus sungguhan berjalan berminggu-minggu. Nama petugasnya diambil
 * dari daftar akun peragaan; tidak ada satu pun nama orang sungguhan.
 */
export function siapkanDemo(berita = []) {
  if (simpanan.siap) return simpanan
  simpanan.siap = true

  const negatif = berita
    .filter((b) => b.sentimen === 'Negatif' && b.nama_upt && !/belum|tidak/i.test(b.nama_upt))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

  const hari = (geser) => {
    const t = new Date()
    t.setDate(t.getDate() + geser)
    return t.toISOString()
  }

  /* Enam kasus, satu per tahap. Yang pertama paling baru. */
  const rencana = [
    { status: 'Terdeteksi', prioritas: 'Tinggi', umur: -1, aktual: 'Tidak Dapat Dipastikan' },
    { status: 'Verifikasi Lapangan', prioritas: 'Kritis', umur: -4, aktual: 'Tidak Dapat Dipastikan' },
    { status: 'Evaluasi', prioritas: 'Tinggi', umur: -8, aktual: 'Benar Sebagian' },
    { status: 'Menunggu Keputusan', prioritas: 'Kritis', umur: -12, aktual: 'Terbukti Benar' },
    { status: 'Tindak Lanjut', prioritas: 'Sedang', umur: -18, aktual: 'Terbukti Benar' },
    { status: 'Selesai', prioritas: 'Sedang', umur: -26, aktual: 'Tidak Benar' },
  ]

  rencana.forEach((r, i) => {
    const sumber = negatif[i] || negatif[0]
    if (!sumber) return
    const nomor = `KI-${String(new Date().getFullYear()).slice(2)}${String(i + 1).padStart(4, '0')}`
    const kasus = {
      id: idDemo('kasus'),
      case_number: nomor,
      title: sumber.judul,
      issue_type: sumber.subkategori || sumber.kategori || 'Lainnya',
      primary_upt: sumber.nama_upt,
      status: r.status,
      priority: r.prioritas,
      actuality_status: r.aktual,
      first_detected_at: hari(r.umur),
      last_media_at: hari(r.umur + 1),
      article_count: 2 + (i % 4),
      media_count: 1 + (i % 3),
      negative_count: 2 + (i % 3),
      highest_urgency: r.prioritas,
      summary: sumber.ringkasan || null,
      owner_username: 'analis.media',
      created_by: 'analis.media',
      created_at: hari(r.umur),
      updated_at: hari(r.umur + 2),
      closed_at: r.status === 'Selesai' ? hari(-1) : null,
      metadata: {},
    }
    simpanan.kasus.push(kasus)

    // Berita yang terkait: yang jadi sumbernya, ditambah satu berita lain dari
    // unit yang sama bila ada.
    const serumpun = negatif.filter((b) => b.nama_upt === sumber.nama_upt).slice(0, 3)
    for (const b of serumpun) {
      simpanan.kasusBerita.push({
        id: idDemo('kb'), case_id: kasus.id, berita_id: b.id,
        linked_by: 'analis.media', created_at: kasus.created_at,
      })
    }

    if (i >= 1) tambahPenugasanDemo(kasus, i, hari)
    if (i >= 2) tambahLaporanDemo(kasus, i, hari)
    if (i >= 2) tambahAnalisisDemo(kasus, i, hari)
    if (i >= 3) tambahRekomendasiDemo(kasus, i, hari)
    if (i >= 4) tambahPutusanDemo(kasus, i, hari)
    if (i >= 4) tambahTindakDemo(kasus, i, hari)
  })

  return simpanan
}

function tambahPenugasanDemo(kasus, i, hari) {
  simpanan.penugasan.push({
    id: idDemo('tugas'),
    assignment_number: `ST-${kasus.case_number.slice(3)}`,
    case_id: kasus.id,
    assigned_to: 'petugas.lapangan',
    assigned_team: 'Tim Verifikasi Lapangan',
    instruction: `Verifikasi langsung ke ${kasus.primary_upt} atas pemberitaan "${kasus.title}". `
      + 'Temui kepala unit dan pejabat struktural terkait, mintakan keterangan tertulis, '
      + 'dan dokumentasikan keadaan di lokasi.',
    verification_questions: PERTANYAAN_BAKU.slice(0, 4),
    priority: kasus.priority,
    status: i === 1 ? 'Berjalan' : 'Selesai',
    assigned_by: 'analis.media',
    assigned_at: hari(-(30 - i * 3)),
    accepted_at: hari(-(29 - i * 3)),
    due_at: hari(i === 1 ? 2 : -(24 - i * 3)),
    completed_at: i === 1 ? null : hari(-(25 - i * 3)),
    updated_at: hari(-(25 - i * 3)),
  })
}

function tambahLaporanDemo(kasus, i, hari) {
  const tugas = simpanan.penugasan.find((p) => p.case_id === kasus.id)
  if (!tugas) return
  simpanan.laporanLapangan.push({
    id: idDemo('lap'),
    assignment_id: tugas.id,
    case_id: kasus.id,
    report_type: 'Laporan Lengkap',
    visit_started_at: hari(-(26 - i * 3)),
    visit_finished_at: hari(-(26 - i * 3)),
    officers: ['Petugas Verifikasi Lapangan 1', 'Petugas Verifikasi Lapangan 2'],
    parties_met: ['Kepala Unit', 'Kepala Pengamanan', 'Petugas Jaga Regu B'],
    activity_summary: 'Kunjungan lapangan selama satu hari kerja: pemeriksaan lokasi, '
      + 'permintaan keterangan, dan penyalinan dokumen pendukung.',
    facts_found: i === 5
      ? 'Peristiwa yang diberitakan tidak ditemukan. Rekaman yang beredar berasal dari '
        + 'kegiatan tahun sebelumnya dan bukan dari unit ini.'
      : 'Peristiwa benar terjadi pada tanggal yang disebutkan. Jumlah yang terlibat lebih '
        + 'sedikit daripada yang diberitakan, dan penanganan awal sudah dilakukan unit.',
    upt_explanation: 'Unit menyatakan telah menempuh langkah pengamanan dan pemeriksaan '
      + 'internal sejak hari kejadian.',
    documents_checked: ['Laporan kejadian', 'Buku jaga', 'Berita acara pemeriksaan'],
    obstacles: i === 3 ? 'Dua saksi yang diperlukan sedang tidak bertugas pada hari kunjungan.' : null,
    immediate_actions: 'Penguatan penjagaan pada blok terkait dan penggeledahan menyeluruh.',
    upt_commitments: 'Menyerahkan hasil pemeriksaan internal dalam empat belas hari.',
    commitment_due_at: hari(14 - i * 2).slice(0, 10),
    finding_classification: i === 5 ? 'Tidak Terbukti' : i === 2 ? 'Terbukti Sebagian' : 'Terbukti',
    initial_conclusion: 'Pemberitaan sebagian besar sesuai keadaan lapangan, dengan koreksi pada angka.',
    status: 'Diterima',
    submitted_by: 'petugas.lapangan',
    submitted_at: hari(-(25 - i * 3)),
    reviewed_by: 'analis.media',
    reviewed_at: hari(-(24 - i * 3)),
    review_note: null,
  })
}

function tambahAnalisisDemo(kasus, i, hari) {
  const laporan = simpanan.laporanLapangan.find((l) => l.case_id === kasus.id)
  simpanan.analisis.push({
    id: idDemo('analisis'),
    case_id: kasus.id,
    analysis_version: 1,
    media_narrative: 'Media menempatkan peristiwa ini sebagai kegagalan pengawasan, '
      + 'dengan penekanan pada jumlah yang terlibat dan lamanya kejadian tidak diketahui.',
    field_facts: laporan?.facts_found || null,
    comparison_matrix: [
      { aspek: 'Jumlah yang terlibat', media: 'Disebut lebih dari sepuluh orang', lapangan: 'Tiga orang menurut buku jaga', sesuai: 'Tidak' },
      { aspek: 'Waktu kejadian', media: 'Dini hari', lapangan: 'Dini hari, sesuai', sesuai: 'Ya' },
      { aspek: 'Penanganan unit', media: 'Tidak disebutkan', lapangan: 'Penggeledahan dilakukan hari yang sama', sesuai: 'Tidak disebutkan media' },
    ],
    information_validity: i === 5 ? 'Terbantahkan' : 'Terverifikasi Sebagian',
    reputation_impact: i >= 3 ? 'Berat' : 'Sedang',
    operational_impact: 'Terbatas',
    compliance_impact: i === 5 ? 'Sesuai Prosedur' : 'Perlu pemeriksaan',
    media_escalation_risk: i === 3 ? 'Menanjak' : 'Stabil',
    root_causes: [
      'Rasio petugas jaga terhadap warga binaan di bawah standar pada regu malam.',
      'Prosedur penggeledahan berkala tidak terdokumentasi lengkap.',
    ],
    final_analysis: 'Peristiwanya benar, tetapi skalanya lebih kecil daripada yang '
      + 'diberitakan. Yang menuntut perhatian bukan peristiwanya sendiri melainkan '
      + 'lambatnya unit menyampaikan keterangan resmi.',
    follow_up_assessment: i >= 4 ? 'Memadai' : 'Belum Dapat Dinilai',
    status: i === 2 ? 'Draf' : 'Terverifikasi',
    created_by: 'analis.evaluasi',
    created_at: hari(-(23 - i * 2)),
    verified_by: i === 2 ? null : 'analis.evaluasi',
    verified_at: i === 2 ? null : hari(-(22 - i * 2)),
  })
}

function tambahRekomendasiDemo(kasus, i, hari) {
  const analisis = simpanan.analisis.find((a) => a.case_id === kasus.id)
  const usulan = [
    ['Klarifikasi Publik', 'Menerbitkan siaran pers resmi yang meluruskan angka dan menyebutkan langkah yang sudah diambil.', 'Humas Ditjenpas'],
    ['Pemeriksaan', 'Memeriksa petugas jaga regu malam pada tanggal kejadian.', 'Kepala Unit'],
    ['Perbaikan Prosedur', 'Menetapkan jadwal penggeledahan berkala beserta format dokumentasinya.', 'Kantor Wilayah'],
  ]
  usulan.forEach(([jenis, teks, pihak], n) => {
    const disetujui = i >= 4
    simpanan.rekomendasi.push({
      id: idDemo('rek'),
      case_id: kasus.id,
      analysis_id: analisis?.id || null,
      recommendation_type: jenis,
      recommendation: teks,
      responsible_party: pihak,
      priority: n === 0 ? 'Tinggi' : 'Sedang',
      due_at: hari(14 + n * 7).slice(0, 10),
      status: disetujui ? (i === 5 ? 'Selesai' : 'Disetujui') : 'Diusulkan',
      progress_percent: disetujui ? (i === 5 ? 100 : 40) : 0,
      created_by: 'analis.evaluasi',
      created_at: hari(-(21 - i * 2)),
      decided_by: disetujui ? 'pimpinan' : null,
      decided_at: disetujui ? hari(-(19 - i * 2)) : null,
      decision_note: null,
      completed_at: i === 5 ? hari(-3) : null,
    })
  })
}

function tambahPutusanDemo(kasus, i, hari) {
  const rekomendasi = simpanan.rekomendasi.filter((r) => r.case_id === kasus.id)
  simpanan.putusan.push({
    id: idDemo('putusan'),
    case_id: kasus.id,
    decision: i === 5 ? 'Disetujui' : 'Disetujui dengan Catatan',
    decision_note: i === 5 ? null
      : 'Klarifikasi publik dilakukan setelah hasil pemeriksaan internal keluar, '
        + 'bukan mendahuluinya.',
    recommendation_ids: rekomendasi.map((r) => r.id),
    decided_by: 'pimpinan',
    decided_at: hari(-(19 - i * 2)),
  })
}

function tambahTindakDemo(kasus, i, hari) {
  const rekomendasi = simpanan.rekomendasi.filter((r) => r.case_id === kasus.id)
  const keadaan = i === 5
    ? ['Selesai', 'Selesai', 'Selesai']
    : ['Berjalan', 'Belum Dimulai', 'Tertunda']
  rekomendasi.forEach((r, n) => {
    simpanan.tindak.push({
      id: idDemo('tindak'),
      case_id: kasus.id,
      recommendation_id: r.id,
      title: r.recommendation.split('.')[0],
      description: r.recommendation,
      assigned_role: n === 0 ? 'media_intelligence_analyst' : null,
      assigned_to: n === 0 ? 'analis.media' : 'petugas.lapangan',
      priority: r.priority,
      status: keadaan[n],
      // Satu butir sengaja dibuat lewat tenggat: daftar tindak lanjut yang
      // seluruhnya hijau tidak pernah memperlihatkan bagaimana keterlambatan
      // ditampilkan, dan itulah keadaan yang paling perlu dikenali cepat.
      due_at: hari(n === 2 ? -5 : 10 + n * 5),
      progress_percent: keadaan[n] === 'Selesai' ? 100 : keadaan[n] === 'Berjalan' ? 45 : 0,
      created_by: 'analis.evaluasi',
      created_at: hari(-(18 - i)),
      updated_at: hari(-2),
      completed_at: keadaan[n] === 'Selesai' ? hari(-3) : null,
    })
  })
}

/** Nama pengguna yang dipakai pada baris baru. */
export function penulis() { return siapa() }

export const META_SIKLUS_DATA = { versi: 'siklus-data-v1.0' }
