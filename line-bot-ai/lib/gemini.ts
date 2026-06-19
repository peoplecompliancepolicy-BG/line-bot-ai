import { TextGenerationModel } from "@google/genai";
import type { FaqEntry } from "./sheet";

export const DEFAULT_REPLY = "ขออภัยค่ะ แอดมินยังไม่ทราบข้อมูลส่วนนี้ รอแอดมินตัวจริงมาตอบสักครู่นะคะ";
const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_TEMPERATURE = 1.0;
const GEMINI_MAX_OUTPUT_TOKENS = 1024;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("Missing environment variable: GEMINI_API_KEY");
}

const gemini = new TextGenerationModel({ model: GEMINI_MODEL, apiKey: GEMINI_API_KEY });

const SYSTEM_PROMPT = `<role> คุณคือเจ้าหน้าที่ฝ่าย HR ของบริษัทเอกชน ที่รองรับพนักงาน 4000 คน ตอบคำถามผ่าน LINE OA ในนาม “ทีม HR” </role>
<constraints>
- ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น
- ห้ามแต่งราคา/เวลา/ที่ตั้ง ขึ้นมาเองเด็ดขาด
- ถ้าลูกค้าถามเรื่องที่ไม่มีใน <faq> ให้ตอบว่า "ขออภัยค่ะ แอดมินยังไม่ทราบข้อมูลส่วนนี้ รอแอดมินตัวจริงมาตอบสักครู่นะคะ"
- โทนการตอบ: สุภาพ, เป็นกันเอง, ใช้ Emoji, สั้นกระชับ
- ความยาว 1-3 ประโยค
</constraints>
<output_format> ภาษาไทย ไม่ใช้ markdown </output_format>`;

export async function generateGeminiReply(question: string, faqEntries: FaqEntry[]): Promise<string> {
  const prompt = buildGeminiPrompt(question, faqEntries);

  const response = await gemini.generate({
    prompt,
    temperature: GEMINI_TEMPERATURE,
    max_output_tokens: GEMINI_MAX_OUTPUT_TOKENS,
  });

  const finishReason = getFinishReason(response);
  const thoughtsTokenCount = getThoughtsTokenCount(response);
  const candidatesTokenCount = getCandidatesTokenCount(response);

  console.log("Gemini reply metadata", {
    finishReason,
    thoughtsTokenCount,
    candidatesTokenCount,
  });

  if (finishReason === "MAX_TOKENS") {
    return DEFAULT_REPLY;
  }

  const text = extractTextFromResponse(response);
  return text || DEFAULT_REPLY;
}

function buildGeminiPrompt(question: string, faqEntries: FaqEntry[]) {
  const faqText = faqEntries.length > 0
    ? faqEntries.map((entry) => `question: ${entry.question}\nanswer: ${entry.answer}`).join("\n\n")
    : "ไม่มีข้อมูล FAQ ที่เกี่ยวข้อง";

  return `${SYSTEM_PROMPT}\n<faq>\n${faqText}\n</faq>\n<question>\n${question}\n</question>`;
}

function getFinishReason(response: any): string | null {
  return response?.metadata?.finish_reason
    ?? response?.candidates?.[0]?.metadata?.finish_reason
    ?? response?.finish_reason
    ?? null;
}

function getThoughtsTokenCount(response: any): number | null {
  return response?.metadata?.thoughtsTokenCount
    ?? response?.tokenUsage?.thoughtsTokenCount
    ?? null;
}

function getCandidatesTokenCount(response: any): number | null {
  return response?.metadata?.candidatesTokenCount
    ?? response?.tokenUsage?.candidatesTokenCount
    ?? response?.candidates?.length
    ?? null;
}

function extractTextFromResponse(response: any): string {
  const candidate = response?.candidates?.[0] ?? response?.output?.[0];
  if (!candidate) {
    return "";
  }

  const content = candidate?.content ?? candidate;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((item) => (typeof item === "string" ? item : item?.text ?? "")).join("");
  }

  return "";
}
