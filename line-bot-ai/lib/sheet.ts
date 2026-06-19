export type FaqEntry = {
  question: string;
  answer: string;
  category: string;
  tags: string[];
  updated_at: string;
};

// --- ส่วนการตั้งค่าและ Cache ---
const CACHE_TTL_MS = 60_000;
let cache: { timestamp: number; entries: FaqEntry[] } | null = null;

const SHEET_URL = process.env.SHEET_CSV_URL;
if (!SHEET_URL) {
  throw new Error("Missing environment variable: SHEET_CSV_URL");
}

// --- ฟังก์ชันหลัก ---
export async function getFaqEntries(): Promise<FaqEntry[]> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.entries;
  }

  const response = await fetch(SHEET_URL!);
  if (!response.ok) {
    throw new Error(`Failed to load FAQ CSV (${response.status})`);
  }

  const csvText = await response.text();
  const entries = parseFaqCsv(csvText);

  cache = { timestamp: now, entries };
  return entries;
}

// --- ฟังก์ชันตัวช่วย (Helper Functions) ---
function parseFaqCsv(csvText: string): FaqEntry[] {
  const rows = parseCsvRows(csvText); // ตอนนี้จะมองเห็นแล้วค่ะ
  if (!rows || rows.length < 2) return [];

  const header = rows[0].map((value) => normalizeText(value));
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

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') { inQuotes = true; continue; }
    if (char === ',') { row.push(field); field = ""; continue; }
    if (char === '\r') continue;
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeText(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[“”«»„‟]/g, '"');
}