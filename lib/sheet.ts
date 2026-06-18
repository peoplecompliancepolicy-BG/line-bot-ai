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

const CSV_SCHEMA_COMMENT = `
FAQ CSV schema:
- question — ข้อความคำถามหรือหัวข้อที่ลูกค้าถาม
- answer — คำตอบหลักที่จะใช้เป็นข้อมูลอ้างอิง
- category — ประเภท เช่น ลา, สวัสดิการ, ประกัน, ค่าจ้าง
- tags — คีย์เวิร์ดช่วยค้นหา
- updated_at — วันที่ปรับปรุงล่าสุด

Example row:
question: การลาป่วยต้องทำอย่างไร
answer: แจ้งหัวหน้างานและส่งเอกสารภายใน 24 ชั่วโมง
category: การลา
tags: ลา ป่วย เอกสาร
updated_at: 2026-06-17
`;

export async function getFaqEntries(): Promise<FaqEntry[]> {
  const now = Date.now();
  if (cache && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.entries;
  }

  const response = await fetch(SHEET_URL);
  if (!response.ok) {
    throw new Error(`Failed to load FAQ CSV from ${SHEET_URL} (${response.status})`);
  }

  const csvText = await response.text();
  const entries = parseFaqCsv(csvText);

  cache = { timestamp: now, entries };
  return entries;
}

export async function findFaqAnswer(question: string): Promise<FaqEntry | null> {
  const entries = await getFaqEntries();
  const normalizedQuestion = normalizeText(question);

  const exactMatch = entries.find(
    (entry) => normalizeText(entry.question) === normalizedQuestion
  );
  if (exactMatch) {
    return exactMatch;
  }

  const scored = entries
    .map((entry) => ({ entry, score: scoreFaqMatch(entry, normalizedQuestion) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.length > 0 ? scored[0].entry : null;
}

function parseFaqCsv(csvText: string): FaqEntry[] {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) {
    return [];
  }

  const header = rows[0].map((value) => normalizeText(value));
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell.trim().length > 0));

  const questionIndex = header.indexOf("question");
  const answerIndex = header.indexOf("answer");
  const categoryIndex = header.indexOf("category");
  const tagsIndex = header.indexOf("tags");
  const updatedAtIndex = header.indexOf("updated_at");

  return dataRows.map((row) => ({
    question: row[questionIndex] ?? "",
    answer: row[answerIndex] ?? "",
    category: row[categoryIndex] ?? "",
    tags: (row[tagsIndex] ?? "").split(/\s+/).filter(Boolean),
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

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = "";
      continue;
    }

    if (char === '\r') {
      continue;
    }

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
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”«»„‟]/g, '"');
}

function scoreFaqMatch(entry: FaqEntry, normalizedQuestion: string): number {
  let score = 0;
  const normalizedQuestionText = normalizeText(entry.question);
  const normalizedAnswerText = normalizeText(entry.answer);
  const normalizedTagsText = normalizeText(entry.tags.join(" "));
  const normalizedCategory = normalizeText(entry.category);

  if (normalizedQuestionText.includes(normalizedQuestion)) {
    score += 50;
  }

  if (normalizedAnswerText.includes(normalizedQuestion)) {
    score += 20;
  }

  if (normalizedTagsText.includes(normalizedQuestion) || normalizedCategory.includes(normalizedQuestion)) {
    score += 15;
  }

  const tokens = normalizedQuestion.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (normalizedQuestionText.includes(token)) score += 8;
    if (normalizedAnswerText.includes(token)) score += 5;
    if (normalizedTagsText.includes(token)) score += 4;
    if (normalizedCategory.includes(token)) score += 3;
  }

  return score;
}

// Export schema comment in case it is useful for documentation or runtime logging.
export const FAQ_CSV_SCHEMA = CSV_SCHEMA_COMMENT;
