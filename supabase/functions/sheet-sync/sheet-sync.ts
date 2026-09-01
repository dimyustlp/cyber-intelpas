/**
 * Edge Function: sheet-sync (v7)
 *
 * Menyalin baris spreadsheet menjadi baris tabel `berita`.
 *
 * Yang berubah dari v6: sumbernya tidak lagi satu alamat yang tertanam di dalam
 * berkas ini, melainkan daftar di tabel `sumber_sheet`. Kantor wilayah akan
 * mengumpulkan data lewat spreadsheet masing-masing, dan menambahkan satu
 * wilayah tidak boleh berarti menggelar ulang fungsi.
 *
 * Prinsip yang menentukan seluruh bentuk berkas ini: satu sumber yang rusak
 * tidak boleh menjatuhkan sumber lain. Spreadsheet kanwil bisa dihapus,
 * ditutup aksesnya, diganti judul kolomnya, atau diisi tanggal yang tidak
 * terbaca — dan ketika itu terjadi, penyalinan pusat harus tetap selesai
 * seperti biasa. Karena itu tiap sumber punya blok galatnya sendiri, barisnya
 * sendiri di `sheet_sync_log`, dan kegagalannya berhenti di dirinya sendiri.
 *
 * Balasan HTTP mengikuti aturan lama: 200 bila seluruhnya berhasil, 207 bila
 * sebagian, 500 hanya bila gagal sebelum satu sumber pun sempat dikerjakan.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSI = "7.0.0";

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-sync-token, x-trigger-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const DEFAULT_UNMAPPED_UPT = "Belum Teridentifikasi";

/**
 * Alamat sumber pusat yang lama.
 *
 * Masih dipakai sebagai jaring pengaman: bila tabel `sumber_sheet` belum ada
 * atau kosong, penyalin tetap menarik sumber ini seperti sebelumnya. Fungsi
 * yang berhenti bekerja hanya karena sebuah tabel belum dibuat adalah fungsi
 * yang menukar satu kegagalan dengan kegagalan lain.
 */
const DEFAULT_PUBLIC_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0-o2qi5vHXxjnwxPAB4wxtAo8ZdmmVjG-wMvOLSXKjNWXOLCyyR0-1F4aOUn9SnFY8NtFvZeSzaft/pub?output=csv";

const DEFAULT_PUBLICATION_ID =
  "2PACX-1vQ0-o2qi5vHXxjnwxPAB4wxtAo8ZdmmVjG-wMvOLSXKjNWXOLCyyR0-1F4aOUn9SnFY8NtFvZeSzaft";

type Sumber = {
  id: string | null;
  kode: string;
  nama: string;
  lingkup: "pusat" | "kanwil";
  kanwil: string | null;
  sheet_id: string | null;
  sheet_nama: string;
  csv_url: string;
  kolom_alias: Record<string, string[]> | null;
};

type SyncCounters = {
  seen: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
};

type HeaderMap = Record<string, number>;

type ExistingRow = {
  id: string;
  source_type: string | null;
  source_external_id: string | null;
  content_hash: string | null;
  link: string | null;
  link_normalized: string | null;
};

type PendingRow = {
  payload: Record<string, unknown>;
  operation: "insert" | "update";
  rowNumber: number;
};

type HasilSumber = {
  kode: string;
  nama: string;
  status: "Berhasil" | "Sebagian" | "Gagal";
  counters: SyncCounters;
  pesan: string;
  errors: string[];
};

function env(name: string, fallback = ""): string {
  return Deno.env.get(name)?.trim() || fallback;
}

function requiredEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Edge Function secret belum diisi: ${name}`);
  return value;
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.stack || error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isDuplicateLinkError(error: unknown): boolean {
  const text = safeError(error).toLowerCase();
  let code = "";

  if (typeof error === "object" && error !== null && "code" in error) {
    code = String((error as { code?: unknown }).code ?? "");
  }

  return (
    code === "23505" &&
    (
      text.includes("link berita sudah pernah disimpan") ||
      text.includes("duplicate_berita_id") ||
      text.includes("link identik ditolak")
    )
  );
}

/* ------------------------------------------------------------------- CSV */

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  return rows.filter((item) =>
    item.some((value) => String(value || "").trim() !== "")
  );
}

/** Penanda dokumen Google dari alamat apa pun, termasuk tautan /edit biasa. */
function idDokumen(url: string): { id: string; terbit: boolean } | null {
  const terbit = url.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)/);
  if (terbit) return { id: terbit[1], terbit: true };

  const biasa = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (biasa) return { id: biasa[1], terbit: false };

  return null;
}

/**
 * Daftar alamat yang dicoba berurutan untuk satu sumber.
 *
 * Alasan ada lebih dari satu: petugas kantor wilayah akan menempelkan tautan
 * yang mereka lihat di bilah alamat — tautan /edit — bukan alamat ekspor CSV
 * yang tidak pernah mereka temui. Menolak tautan itu berarti memindahkan
 * pekerjaan menerjemahkan alamat kepada orang yang paling tidak punya alasan
 * mengetahuinya.
 */
function alamatKandidat(sumber: Sumber): string[] {
  const url = sumber.csv_url.trim();
  const daftar: string[] = [];
  const sudahCsv = /output=csv|format=csv|tqx=out:csv/i.test(url);

  if (sudahCsv) daftar.push(url);

  const dok = idDokumen(url);
  if (dok?.terbit) {
    daftar.push(`https://docs.google.com/spreadsheets/d/e/${dok.id}/pub?output=csv`);
  } else if (dok) {
    const lembar = encodeURIComponent(sumber.sheet_nama || "Sheet1");
    daftar.push(`https://docs.google.com/spreadsheets/d/${dok.id}/gviz/tq?tqx=out:csv&sheet=${lembar}`);
    daftar.push(`https://docs.google.com/spreadsheets/d/${dok.id}/gviz/tq?tqx=out:csv`);
    daftar.push(`https://docs.google.com/spreadsheets/d/${dok.id}/export?format=csv`);
    daftar.push(`https://docs.google.com/spreadsheets/d/${dok.id}/pub?output=csv`);
  }

  if (!sudahCsv && !daftar.length) daftar.push(url);

  return [...new Set(daftar)];
}

/**
 * Membaca CSV sebuah sumber.
 *
 * Google tidak membalas 403 untuk lembar tertutup; ia membalas halaman masuk
 * berbentuk HTML dengan status 200 atau 401. Tanpa pemeriksaan bentuk isi,
 * halaman itu akan diurai sebagai CSV dan menghasilkan galat "kolom wajib
 * tidak ditemukan" — pesan yang menyesatkan orang mencari kolom yang
 * sebenarnya baik-baik saja.
 */
async function bacaCsv(sumber: Sumber): Promise<{ nilai: string[][]; alamat: string }> {
  const kandidat = alamatKandidat(sumber);
  const kegagalan: string[] = [];

  for (const alamat of kandidat) {
    try {
      const jawab = await fetch(alamat, {
        method: "GET",
        headers: {
          "User-Agent": `TransSiberPAS-SheetSync/${VERSI}`,
          Accept: "text/csv,text/plain,*/*",
        },
        redirect: "follow",
      });

      const jenis = (jawab.headers.get("content-type") || "").toLowerCase();
      // Penanda urutan bita di kepala berkas dibuang lewat kode angkanya, bukan
      // lewat karakternya sendiri — karakter tak tampak di dalam kode sumber
      // adalah hal yang paling mudah hilang saat berkas berpindah tangan.
      const buangBom = (t: string) => (t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t);
      const teks = buangBom(await jawab.text());

      if (!jawab.ok) {
        kegagalan.push(`${alamat} → HTTP ${jawab.status}`);
        continue;
      }

      if (jenis.includes("text/html") || /^\s*<(!doctype|html)/i.test(teks)) {
        kegagalan.push(`${alamat} → dibalas halaman HTML, bukan CSV`);
        continue;
      }

      if (!teks.trim()) {
        kegagalan.push(`${alamat} → CSV kosong`);
        continue;
      }

      return { nilai: parseCsv(teks), alamat };
    } catch (galat) {
      kegagalan.push(`${alamat} → ${safeError(galat).split("\n")[0]}`);
    }
  }

  throw new Error(
    "Spreadsheet tidak dapat dibaca tanpa masuk akun Google. Buka berkasnya, "
      + "tekan Bagikan, lalu setel akses menjadi \"Siapa saja yang memiliki link\" "
      + "sebagai Pelihat — atau File → Bagikan → Publikasikan ke web dengan format CSV. "
      + `Alamat yang sudah dicoba: ${kegagalan.join(" | ")}`,
  );
}

/* --------------------------------------------------------------- kolom */

function normalizeHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Nama kolom yang dikenali.
 *
 * Lembar kanwil tidak akan memakai judul kolom yang sama persis dengan lembar
 * pusat, dan menuntut keseragaman lebih dulu berarti menunda seluruh pekerjaan
 * sampai tiga puluh delapan wilayah sepakat. Alias di bawah menerima bentuk
 * yang wajar; yang benar-benar di luar dugaan bisa dipetakan per sumber lewat
 * kolom `kolom_alias` pada tabel `sumber_sheet`.
 */
const ALIAS_BAWAAN: Record<string, string[]> = {
  detected: ["waktu terdeteksi", "tanggal terdeteksi", "waktu deteksi", "timestamp",
    "tanggal", "tanggal berita", "tanggal publikasi", "tanggal terbit"],
  title: ["judul berita", "judul", "judul publikasi"],
  media: ["sumber / portal", "sumber/portal", "sumber", "portal", "media", "nama media"],
  risk: ["tingkat risiko", "risiko", "urgensi", "tingkat urgensi"],
  analysis: ["hasil analisis & rekomendasi", "hasil analisis", "analisis & rekomendasi",
    "analisis", "ringkasan", "isi berita", "uraian", "keterangan"],
  url: ["url / link artikel", "url/link artikel", "link artikel", "url", "link", "tautan"],
  followup: ["status tindak lanjut", "status tindak lanjut lc", "status tindak lanjut berita"],
  officer: ["petugas respon", "petugas respons", "petugas"],
  responseTime: ["waktu respon", "waktu respons"],
  upt: ["nama upt", "upt", "satuan kerja", "satker", "unit", "nama satker"],
  kanwil: ["kanwil", "kantor wilayah", "wilayah", "nama kanwil"],
  reporter: ["nama petugas", "petugas pelapor", "pelapor", "nama pelapor", "diinput oleh"],
};

function resolveColumns(headers: string[], tambahan: Record<string, string[]> | null): HeaderMap {
  const aliases: Record<string, string[]> = { ...ALIAS_BAWAAN };

  // Alias khusus sumber ditaruh di depan supaya menang atas bawaan.
  for (const [kunci, nilai] of Object.entries(tambahan || {})) {
    const daftar = (Array.isArray(nilai) ? nilai : [nilai]).map(normalizeHeader);
    aliases[kunci] = [...daftar, ...(aliases[kunci] || [])];
  }

  const result: HeaderMap = {};

  for (const [key, names] of Object.entries(aliases)) {
    result[key] = headers.findIndex((header) =>
      names.some((name) => header === name || header.startsWith(name))
    );
  }

  for (const required of ["title", "url"]) {
    if ((result[required] ?? -1) < 0) {
      throw new Error(
        `Kolom wajib tidak ditemukan: ${required === "title" ? "judul berita" : "tautan berita"}. `
          + `Judul kolom yang terbaca: ${headers.filter(Boolean).join(", ") || "(kosong)"}.`,
      );
    }
  }

  return result;
}

function cell(row: string[], index: number): string {
  return index >= 0 ? String(row[index] ?? "") : "";
}

function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanMultiline(value: unknown): string {
  return String(value ?? "").replace(/\r/g, "").trim();
}

function normalizeRisk(value: unknown): string {
  const text = clean(value).toLowerCase();
  if (text.includes("kritis")) return "Kritis";
  if (text.includes("tinggi")) return "Tinggi";
  if (text.includes("sedang")) return "Sedang";
  return "Rendah";
}

function normalizeUrl(value: unknown): string {
  let url = clean(value);
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    const parsed = new URL(url);
    const remove = [...parsed.searchParams.keys()].filter((key) =>
      key.toLowerCase().startsWith("utm_") ||
      ["fbclid", "gclid", "igsh", "igshid"].includes(key.toLowerCase())
    );

    for (const key of remove) parsed.searchParams.delete(key);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url.replace(/\/$/, "");
  }
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function detectPlatform(url: string): string {
  const host = hostFromUrl(url).toLowerCase();
  if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube";
  if (host.includes("instagram.com")) return "Instagram";
  if (host.includes("facebook.com") || host.includes("fb.watch")) return "Facebook";
  if (host.includes("tiktok.com")) return "TikTok";
  if (host.includes("news.google.com")) return "Google News";
  return "Portal Berita";
}

function parseAnalysis(text: string): { analysis: string; recommendation: string } {
  const analysisMatch = text.match(/ANALISIS\s*:\s*([\s\S]*?)(?:REKOMENDASI\s*:|$)/i);
  const recommendationMatch = text.match(/REKOMENDASI\s*:\s*([\s\S]*)$/i);

  return {
    analysis: clean(analysisMatch?.[1] || text),
    recommendation: clean(recommendationMatch?.[1] || ""),
  };
}

function parseDate(value: unknown): string | null {
  const text = clean(value).replace(/\.(?=\d{2}(?:\D|$))/g, ":");
  if (!text) return null;

  const match = text.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:[,\s]+(\d{1,2})[:.](\d{2}))?/
  );

  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    const year = Number(match[3]);
    const hour = Number(match[4] || 0);
    const minute = Number(match[5] || 0);

    return new Date(Date.UTC(year, month, day, hour - 7, minute)).toISOString();
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeUptText(value: unknown): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchUpt(text: string, uptNames: { name: string; key: string }[]): string | null {
  const haystack = ` ${normalizeUptText(text)} `;

  for (const item of uptNames) {
    if (item.key && haystack.includes(` ${item.key} `)) return item.name;
  }

  return null;
}

async function sha256(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  );

  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchAll<T>(
  queryFactory: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const output: T[] = [];

  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryFactory(from, from + 999);
    if (error) throw new Error(`Query Supabase gagal: ${safeError(error)}`);

    const batch = data || [];
    output.push(...batch);

    if (batch.length < 1000) break;
  }

  return output;
}

/* -------------------------------------------------------------- sumber */

/**
 * Daftar sumber yang akan ditarik.
 *
 * Kegagalan membaca tabelnya tidak dianggap fatal: penyalinan pusat tetap
 * berjalan dengan alamat bawaan. Sumber data yang berhenti diam-diam adalah
 * kegagalan yang paling lama tidak ketahuan, dan tidak pantas dipicu oleh
 * sebuah tabel daftar.
 */
async function daftarSumber(
  supabase: ReturnType<typeof createClient>,
): Promise<{ sumber: Sumber[]; catatan: string | null }> {
  const bawaan: Sumber = {
    id: null,
    kode: "pusat",
    nama: "Pemantauan Pusat — Dirpamintel",
    lingkup: "pusat",
    kanwil: null,
    sheet_id: DEFAULT_PUBLICATION_ID,
    sheet_nama: env("GOOGLE_SHEET_NAME", "Sheet1"),
    csv_url: env("PUBLIC_SHEET_CSV_URL", DEFAULT_PUBLIC_CSV_URL),
    kolom_alias: null,
  };

  try {
    const { data, error } = await supabase
      .from("sumber_sheet")
      .select("id,kode,nama,lingkup,kanwil,sheet_id,sheet_nama,csv_url,kolom_alias,aktif,urutan")
      .eq("aktif", true)
      .order("urutan", { ascending: true });

    if (error) throw error;
    if (!data || !data.length) {
      return { sumber: [bawaan], catatan: "Tabel sumber_sheet kosong, memakai sumber bawaan." };
    }

    return {
      sumber: data.map((row) => ({
        id: String(row.id),
        kode: String(row.kode),
        nama: String(row.nama),
        lingkup: row.lingkup === "pusat" ? "pusat" : "kanwil",
        kanwil: row.kanwil ? String(row.kanwil) : null,
        sheet_id: row.sheet_id ? String(row.sheet_id) : null,
        sheet_nama: String(row.sheet_nama || "Sheet1"),
        csv_url: String(row.csv_url),
        kolom_alias: (row.kolom_alias as Record<string, string[]> | null) ?? null,
      })),
      catatan: null,
    };
  } catch (galat) {
    return {
      sumber: [bawaan],
      catatan: `Daftar sumber tidak terbaca (${safeError(galat).split("\n")[0]}), memakai sumber bawaan.`,
    };
  }
}

async function updateSyncLog(
  supabase: ReturnType<typeof createClient>,
  logId: string,
  values: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("sheet_sync_log").update(values).eq("id", logId);
  if (error) throw new Error(`Gagal memperbarui sheet_sync_log: ${safeError(error)}`);
}

/** Menandai keadaan terakhir sebuah sumber. Kegagalannya tidak pernah fatal. */
async function tandaiSumber(
  supabase: ReturnType<typeof createClient>,
  sumber: Sumber,
  nilai: Record<string, unknown>,
): Promise<void> {
  if (!sumber.id) return;
  try {
    await supabase.from("sumber_sheet").update(nilai).eq("id", sumber.id);
  } catch (galat) {
    console.warn(`Gagal menandai sumber ${sumber.kode}:`, safeError(galat));
  }
}

/* ------------------------------------------------------ satu sumber */

async function kerjakanSumber(
  supabase: ReturnType<typeof createClient>,
  sumber: Sumber,
  konteks: {
    uptNames: { name: string; key: string }[];
    existingByExternalId: Map<string, ExistingRow>;
    existingByUrl: Map<string, ExistingRow>;
    queuedUrls: Set<string>;
    triggerType: string;
  },
): Promise<HasilSumber> {
  const mulai = new Date();
  const counters: SyncCounters = { seen: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
  const rowErrors: string[] = [];
  let logId: string | null = null;

  /*
     Penanda baris sumber pusat sengaja mempertahankan bentuk lamanya, "gs:".
     Menambahkan kode sumber ke depannya akan membuat tujuh ratus lebih berita
     yang sudah tersimpan tidak dikenali lagi, lalu masuk ulang sebagai berita
     baru — arsip berlipat dua dalam satu kali jalan.
  */
  const awalan = sumber.kode === "pusat" ? "gs:" : `gs:${sumber.kode}:`;
  const sourceType = sumber.lingkup === "kanwil" ? "google_sheet_kanwil" : "google_sheet";

  try {
    const { data: logRow, error: logError } = await supabase
      .from("sheet_sync_log")
      .insert({
        started_at: mulai.toISOString(),
        status: "Berjalan",
        spreadsheet_id: sumber.sheet_id || sumber.kode,
        sheet_name: sumber.sheet_nama,
        trigger_type: konteks.triggerType,
        metadata: {
          architecture: "public_csv_pull",
          function: "sheet-sync",
          version: VERSI,
          read_only: true,
          sumber_kode: sumber.kode,
          sumber_nama: sumber.nama,
          lingkup: sumber.lingkup,
          source_url: sumber.csv_url,
        },
      })
      .select("id")
      .single();

    if (logError) throw new Error(`Gagal membuat log: ${safeError(logError)}`);
    logId = String(logRow.id);

    const { nilai: values, alamat } = await bacaCsv(sumber);

    if (values.length < 2) {
      const selesai = new Date();
      await updateSyncLog(supabase, logId, {
        finished_at: selesai.toISOString(),
        status: "Berhasil",
        rows_seen: 0, rows_inserted: 0, rows_updated: 0, rows_skipped: 0, rows_failed: 0,
        duration_ms: selesai.getTime() - mulai.getTime(),
        message: "Tidak ada baris data.",
        error_detail: null,
      });
      await tandaiSumber(supabase, sumber, {
        terakhir_sinkron_at: selesai.toISOString(),
        terakhir_status: "Berhasil",
        terakhir_pesan: "Tidak ada baris data.",
        baris_terakhir: 0,
      });
      return {
        kode: sumber.kode, nama: sumber.nama, status: "Berhasil", counters,
        pesan: "Tidak ada baris data.", errors: [],
      };
    }

    const headers = values[0].map(normalizeHeader);
    const columns = resolveColumns(headers, sumber.kolom_alias);

    const now = new Date().toISOString();
    const pendingRows: PendingRow[] = [];

    for (let index = 1; index < values.length; index++) {
      counters.seen++;

      try {
        const row = values[index] || [];
        const title = clean(cell(row, columns.title));
        const normalizedUrl = normalizeUrl(cell(row, columns.url));

        if (!title && !normalizedUrl) {
          counters.skipped++;
          continue;
        }

        const detected = parseDate(cell(row, columns.detected));
        const media = clean(cell(row, columns.media))
          || hostFromUrl(normalizedUrl)
          || "Tidak diketahui";
        const risk = normalizeRisk(cell(row, columns.risk));
        const rawAnalysis = cleanMultiline(cell(row, columns.analysis));
        const parsed = parseAnalysis(rawAnalysis);

        const identityRaw = normalizedUrl || [detected, title, media].join("|");
        const externalId = `${awalan}${await sha256(identityRaw.toLowerCase())}`;

        const contentHash = await sha256([
          detected, title, media, risk, rawAnalysis, normalizedUrl,
          cell(row, columns.followup),
          cell(row, columns.officer),
          cell(row, columns.responseTime),
          cell(row, columns.upt),
          cell(row, columns.kanwil),
        ].join("|"));

        const existingSourceRow = konteks.existingByExternalId.get(externalId);
        if ((existingSourceRow?.content_hash || "") === contentHash) {
          counters.skipped++;
          continue;
        }

        /*
          Trigger database menolak link identik, termasuk berita yang dahulu
          dimasukkan manual dan belum memiliki source_external_id. Karena itu,
          link yang sudah ada tidak dimasukkan ulang dan dihitung sebagai skip.
          Aturan ini sekarang juga yang menjaga agar berita yang sama, dikirim
          oleh pusat dan oleh kanwil, tidak tercatat dua kali.
        */
        const existingLinkRow = normalizedUrl ? konteks.existingByUrl.get(normalizedUrl) : undefined;
        if (existingLinkRow && existingLinkRow.source_external_id !== externalId) {
          counters.skipped++;
          continue;
        }

        if (normalizedUrl && konteks.queuedUrls.has(normalizedUrl)) {
          counters.skipped++;
          continue;
        }

        /* Nama unit dari kolomnya sendiri bila lembar menyediakannya; kalau
           tidak, dicocokkan dari teks seperti sebelumnya. Kolom yang diisi
           petugas wilayah lebih dapat dipercaya daripada tebakan mesin atas
           judul berita. */
        const uptTertulis = clean(cell(row, columns.upt));
        const matchedUpt = (uptTertulis && matchUpt(uptTertulis, konteks.uptNames))
          || matchUpt(`${title} ${rawAnalysis}`, konteks.uptNames);

        const kanwilBaris = clean(cell(row, columns.kanwil)) || sumber.kanwil || null;
        const pelapor = clean(cell(row, columns.reporter))
          || (sumber.lingkup === "kanwil"
            ? `Kiriman ${sumber.nama}`
            : "Sinkronisasi Spreadsheet Publik");

        if (normalizedUrl) konteks.queuedUrls.add(normalizedUrl);

        const payload: Record<string, unknown> = {
          source_record_key: `${sourceType}:${externalId}`,
          source_type: sourceType,
          source_external_id: externalId,
          source_sheet_id: sumber.sheet_id || sumber.kode,
          source_sheet_name: sumber.sheet_nama,
          source_row_number: index + 1,
          source_updated_at: now,
          last_synced_at: now,
          sync_status: "synced",
          sync_error: "",
          content_hash: contentHash,
          // Nama unit yang tidak dikenali data induk UPT tidak pernah ditulis apa
          // adanya ke kolom ini. Nama yang salah ketik akan tampak "sudah
          // terpetakan" di layar dan tidak pernah masuk antrean Pemetaan UPT.
          nama_upt: matchedUpt || DEFAULT_UNMAPPED_UPT,
          kanwil_asal: kanwilBaris,
          nama_petugas: pelapor,
          created_by: sumber.kode === "pusat" ? "public_csv_sync" : `sheet_sync:${sumber.kode}`,
          link: normalizedUrl,
          link_normalized: normalizedUrl,
          judul: title || "Tanpa judul",
          media,
          platform: detectPlatform(normalizedUrl),
          tanggal_publikasi: detected,
          detected_at: detected,
          kategori: "Lainnya",
          subkategori: "Umum",
          sentimen: "Tidak diketahui",
          urgensi: risk,
          tingkat_perhatian: risk,
          dampak: "UPT",
          ringkasan: parsed.analysis || rawAnalysis || title,
          rekomendasi: parsed.recommendation,
          raw_analysis: rawAnalysis,
          caption_manual: rawAnalysis,
          status_baca: "SINKRONISASI OTOMATIS",
          catatan: matchedUpt
            ? ""
            : (uptTertulis
              ? `Pengirim menuliskan unit "${uptTertulis}", dan nama itu tidak ada pada data induk ${konteks.uptNames.length} UPT. Perlu dipetakan analis.`
              : "Nama UPT belum dikenali otomatis dan perlu dipetakan oleh analis."),
          status_verifikasi: "Belum Ditelaah",
          ai_provider: "spreadsheet_public_csv",
          status_tindak_lanjut: clean(cell(row, columns.followup)),
          petugas_respon: clean(cell(row, columns.officer)),
          waktu_respon: parseDate(cell(row, columns.responseTime)),
          updated_at: now,
        };

        pendingRows.push({
          operation: existingSourceRow ? "update" : "insert",
          rowNumber: index + 1,
          payload,
        });
      } catch (rowError) {
        counters.failed++;
        const message = `Baris ${index + 1}: ${safeError(rowError)}`;
        rowErrors.push(message);
        console.error(message);
      }
    }

    /*
      Simpan satu per satu. Cara ini sengaja dipilih agar satu link duplikat
      tidak menggagalkan seluruh batch berita lainnya.
    */
    for (const item of pendingRows) {
      const { error } = await supabase
        .from("berita")
        .upsert(item.payload, { onConflict: "source_record_key", ignoreDuplicates: false });

      if (error) {
        if (isDuplicateLinkError(error)) {
          counters.skipped++;
          continue;
        }

        counters.failed++;
        const rowError = `Upsert gagal untuk baris ${item.rowNumber}: ${safeError(error)}`;
        rowErrors.push(rowError);
        console.error(rowError);
        continue;
      }

      if (item.operation === "insert") counters.inserted++;
      else counters.updated++;
    }

    const status: HasilSumber["status"] = counters.failed > 0 ? "Sebagian" : "Berhasil";
    const selesai = new Date();
    const pesan = status === "Berhasil"
      ? `Penyalinan selesai dari ${alamat}.`
      : "Penyalinan selesai dengan sebagian baris bermasalah.";

    await updateSyncLog(supabase, logId, {
      finished_at: selesai.toISOString(),
      status,
      rows_seen: counters.seen,
      rows_inserted: counters.inserted,
      rows_updated: counters.updated,
      rows_skipped: counters.skipped,
      rows_failed: counters.failed,
      duration_ms: selesai.getTime() - mulai.getTime(),
      message: pesan,
      error_detail: rowErrors.length ? rowErrors.join("\n").slice(0, 10000) : null,
      metadata: {
        architecture: "public_csv_pull",
        version: VERSI,
        sumber_kode: sumber.kode,
        lingkup: sumber.lingkup,
        rows_payload: pendingRows.length,
        read_only: true,
        source_url: alamat,
      },
    });

    await tandaiSumber(supabase, sumber, {
      terakhir_sinkron_at: selesai.toISOString(),
      terakhir_status: status,
      terakhir_pesan: pesan,
      baris_terakhir: counters.seen,
    });

    return { kode: sumber.kode, nama: sumber.nama, status, counters, pesan, errors: rowErrors.slice(0, 10) };
  } catch (galat) {
    /*
       Kegagalan berhenti di sini — di dalam blok milik satu sumber. Sumber
       berikutnya tetap dikerjakan, dan itulah seluruh alasan fungsi ini ditulis
       ulang: spreadsheet kanwil yang belum dibuka aksesnya tidak boleh
       menghentikan penyalinan pusat yang berjalan setiap lima menit.
    */
    const pesan = safeError(galat);
    const selesai = new Date();
    console.error(`Sumber ${sumber.kode} gagal: ${pesan}`);

    if (logId) {
      try {
        await updateSyncLog(supabase, logId, {
          finished_at: selesai.toISOString(),
          status: "Gagal",
          rows_seen: counters.seen,
          rows_inserted: counters.inserted,
          rows_updated: counters.updated,
          rows_skipped: counters.skipped,
          rows_failed: Math.max(counters.failed, 1),
          duration_ms: selesai.getTime() - mulai.getTime(),
          message: `Penyalinan sumber ${sumber.nama} gagal.`,
          error_detail: [...rowErrors, pesan].join("\n").slice(0, 10000),
        });
      } catch (galatLog) {
        console.error("Gagal memperbarui log kegagalan:", safeError(galatLog));
      }
    }

    await tandaiSumber(supabase, sumber, {
      terakhir_sinkron_at: selesai.toISOString(),
      terakhir_status: "Gagal",
      terakhir_pesan: pesan.split("\n")[0].slice(0, 500),
    });

    return {
      kode: sumber.kode, nama: sumber.nama, status: "Gagal", counters,
      pesan: pesan.split("\n")[0], errors: [pesan.slice(0, 1000)],
    };
  }
}

/* ------------------------------------------------------------- pelayan */

Deno.serve(async (request: Request) => {
  const mulai = new Date();

  try {
    if (request.method === "OPTIONS") {
      return new Response("ok", { headers: jsonHeaders });
    }

    if (!["POST", "GET"].includes(request.method)) {
      return new Response(
        JSON.stringify({ ok: false, status: "Gagal", message: "Method tidak didukung." }),
        { status: 405, headers: jsonHeaders },
      );
    }

    const expectedToken = requiredEnv("SHEET_SYNC_TOKEN");
    const suppliedToken = request.headers.get("x-sync-token")
      || new URL(request.url).searchParams.get("token")
      || "";

    if (suppliedToken !== expectedToken) {
      return new Response(
        JSON.stringify({ ok: false, status: "Gagal", message: "Token sinkronisasi tidak valid." }),
        { status: 401, headers: jsonHeaders },
      );
    }

    const supabase = createClient(
      requiredEnv("SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const triggerType = request.headers.get("x-trigger-type") || "scheduled";

    // Sumber tertentu saja, bila diminta. Berguna untuk mencoba satu
    // spreadsheet kanwil yang baru didaftarkan tanpa menunggu jadwal.
    let hanyaKode = "";
    if (request.method === "POST") {
      try {
        const badan = await request.json();
        hanyaKode = String(badan?.sumber || "").trim();
      } catch { /* badan kosong diperbolehkan */ }
    }

    const { sumber: semuaSumber, catatan } = await daftarSumber(supabase);
    const sumber = hanyaKode ? semuaSumber.filter((s) => s.kode === hanyaKode) : semuaSumber;

    if (!sumber.length) {
      return new Response(
        JSON.stringify({
          ok: false, status: "Gagal",
          message: hanyaKode
            ? `Sumber dengan kode "${hanyaKode}" tidak ditemukan atau tidak aktif.`
            : "Tidak ada sumber aktif.",
        }),
        { status: 404, headers: jsonHeaders },
      );
    }

    // Data induk ditarik sekali untuk seluruh sumber, bukan sekali per sumber.
    const uptRows = await fetchAll<{ nama_upt: string }>((from, to) =>
      supabase.from("upt").select("nama_upt").eq("aktif", true).range(from, to)
    );

    const uptNames = uptRows
      .map((row) => ({ name: row.nama_upt, key: normalizeUptText(row.nama_upt) }))
      .filter((row) => row.key)
      .sort((a, b) => b.key.length - a.key.length);

    const existingRows = await fetchAll<ExistingRow>((from, to) =>
      supabase
        .from("berita")
        .select("id,source_type,source_external_id,content_hash,link,link_normalized")
        .range(from, to)
    );

    const existingByExternalId = new Map<string, ExistingRow>();
    const existingByUrl = new Map<string, ExistingRow>();

    for (const existingRow of existingRows) {
      // Penanda baris dipetakan tanpa memandang jenis sumbernya: sejak ada
      // lebih dari satu spreadsheet, jenis sumber tidak lagi cukup menjadi
      // syarat pengenalan baris yang sama.
      if (existingRow.source_external_id) {
        existingByExternalId.set(existingRow.source_external_id, existingRow);
      }

      const existingUrl = normalizeUrl(existingRow.link_normalized || existingRow.link || "");
      if (existingUrl && !existingByUrl.has(existingUrl)) {
        existingByUrl.set(existingUrl, existingRow);
      }
    }

    const konteks = {
      uptNames,
      existingByExternalId,
      existingByUrl,
      queuedUrls: new Set<string>(),
      triggerType,
    };

    const hasil: HasilSumber[] = [];
    for (const s of sumber) {
      hasil.push(await kerjakanSumber(supabase, s, konteks));
    }

    const total: SyncCounters = { seen: 0, inserted: 0, updated: 0, skipped: 0, failed: 0 };
    for (const h of hasil) {
      total.seen += h.counters.seen;
      total.inserted += h.counters.inserted;
      total.updated += h.counters.updated;
      total.skipped += h.counters.skipped;
      total.failed += h.counters.failed;
    }

    const gagal = hasil.filter((h) => h.status === "Gagal");
    const sebagian = hasil.filter((h) => h.status === "Sebagian");
    const seluruhnyaGagal = gagal.length === hasil.length;

    const status = gagal.length || sebagian.length
      ? (seluruhnyaGagal ? "Gagal" : "Sebagian")
      : "Berhasil";

    const pesan = status === "Berhasil"
      ? `Penyalinan ${hasil.length} sumber selesai.`
      : `${gagal.length} sumber gagal, ${hasil.length - gagal.length} sumber selesai.`;

    return new Response(
      JSON.stringify({
        ok: status === "Berhasil",
        status,
        message: pesan,
        catatan,
        durasi_ms: Date.now() - mulai.getTime(),
        counters: total,
        sumber: hasil.map((h) => ({
          kode: h.kode, nama: h.nama, status: h.status,
          counters: h.counters, pesan: h.pesan,
        })),
        errors: hasil.flatMap((h) => h.errors).slice(0, 20),
      }, null, 2),
      { status: status === "Berhasil" ? 200 : seluruhnyaGagal ? 500 : 207, headers: jsonHeaders },
    );
  } catch (error) {
    // Sampai di sini berarti gagal sebelum satu sumber pun sempat dikerjakan:
    // token, kunci layanan, atau data induk UPT.
    const errorText = safeError(error);
    console.error(errorText);

    return new Response(
      JSON.stringify({ ok: false, status: "Gagal", message: errorText }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
