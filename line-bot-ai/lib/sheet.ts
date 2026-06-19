export type FaqEntry = {
  question: string;
  answer: string;
  category: string;
  tags: string[];
  updated_at: string;
};

const CACHE_TTL_MS = 60_000;
let cache: { timestamp: number; entries: FaqEntry[] } | null = null;

const SHEET_URL = process.env.SHEET_CSV_URL;
if (!SHEET_URL) {
  throw new Error("Missing environment variable: SHEET_CSV_URL");
}

export async function getFaqEntries(): Promise<FaqEntry[]> {
  const now = Date.now();

  // 1. ตรวจสอบ Cache ก่อน
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.entries;
  }

  // 2. ดึงข้อมูลจาก Google Sheets
  const response = await fetch(SHEET_URL);
  if (!response.ok) {
    throw new Error(`Failed to load FAQ CSV (${response.status})`);
  }

  // 3. อ่านข้อมูลและส่งให้ parseFaqCsv จัดการ
  const csvText = await response.text();
  const entries = parseFaqCsv(csvText);

  // 4. บันทึกผลลง Cache
  cache = { timestamp: now, entries };
  return entries;
}

function parseFaqCsv(csvText: string): FaqEntry[] {
  const rows = parseCsvRows(csvText);
  if (!rows || rows.length < 2) return [];

  const header = rows[0].map((value) => normalizeText(value));
  
  // กรองแถวที่ข้อมูลว่างเปล่าออก
  const dataRows = rows.slice(1).filter((row) => 
    row && row.some((cell) => cell?.trim().length > 0)
  );

  const questionIndex = header.findIndex((v) => v.includes("question"));
  const answerIndex = header.findIndex((v) => v.includes("answer"));
  const categoryIndex = header.findIndex((v) => v.includes("category"));
  const tagsIndex = header.findIndex((v) => v.includes("tag"));
  const updatedAtIndex = header.findIndex((v) => v.includes("date") || v.includes("updated"));

  return dataRows.map((row) => ({
    question: row[questionIndex] ?? row[0] ?? "",
    answer: row[answerIndex] ?? row[1] ?? "",
    category: row[categoryIndex] ?? "",
    tags: (row[tagsIndex] ?? "").split(/[,;\s]+/).filter(Boolean),
    updated_at: row[updatedAtIndex] ?? "",
  }));
}

// ... (เก็บฟังก์ชัน parseCsvRows, normalizeText, scoreFaqMatch ไว้เหมือนเดิมท้ายไฟล์)