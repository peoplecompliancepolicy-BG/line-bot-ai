import { TextGenerationModel } from "@google/genai";
import type { FaqEntry } from "./sheet";

export const DEFAULT_REPLY = "ขอบคุณสำหรับข้อมูล กำลังติดต่อเจ้าหน้าที่ ที่เกี่ยวข้องเพื่อให้รายละเอียดค่ะ";
const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_TEMPERATURE = 1.0;
const GEMINI_MAX_OUTPUT_TOKENS = 1024;

const gemini = new TextGenerationModel({ model: GEMINI_MODEL });

const SYSTEM_PROMPT = `<role> คุณคือเจ้าหน้าที่ฝ่าย HR ของบริษัทเอกชน ที่รองรับพนักงาน 4000 คน ตอบคำถามผ่าน LINE OA ในนาม “ทีม HR” </role> <constraints> - ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น - ห้ามแต่งราคา, เวลา, สถานที่ หรือข้อมูลนอก FAQ - ถ้าไม่มีคำตอบใน FAQ ให้ตอบด้วย default message ว่า “ขอบคุณสำหรับข้อมูล กำลังติดต่อเจ้าหน้าที่ ที่เกี่ยวข้องเพื่อให้รายละเอียดค่ะ” - โทนสุภาพและเป็นกันเอง ให้ความรู้ถูกต้อง เชี่ยวชาญด้านภาษาไทยและอังกฤษ - สามารถใส่ Emoji ได้เล็กน้อย - ความยาว 1-3 ประโยค </constraints> <output_format> ภาษาไทย ไม่ใช้ markdown </output_format>`;

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
    ? faqEntries.map((entry) => `question: ${entry.question}\nanswer: ${entry.answer}\ncategory: ${entry.category}\ntags: ${entry.tags.join(" ")}\nupdated_at: ${entry.updated_at}`).join("\n\n")
    : "ไม่มีข้อมูล FAQ ที่เกี่ยวข้อง";

  return `${SYSTEM_PROMPT} <faq>\n${faqText}\n</faq> <question> ${question} </question>`;
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
