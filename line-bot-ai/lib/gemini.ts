import { GoogleGenerativeAI } from "@google/genai";
import type { FaqEntry } from "./sheet";

export const DEFAULT_REPLY = "ขออภัยค่ะ แอดมินยังไม่ทราบข้อมูลส่วนนี้ รอแอดมินตัวจริงมาตอบสักครู่นะคะ";

// เปลี่ยนโมเดลเป็นรุ่นที่มีจริงและใช้งานได้ดีที่สุดในขณะนี้
const GEMINI_MODEL = "gemini-1.5-flash"; 
const GEMINI_TEMPERATURE = 1.0;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("Missing environment variable: GEMINI_API_KEY");
}

// ตั้งค่าการเชื่อมต่อ GoogleGenerativeAI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

const SYSTEM_PROMPT = `<role> คุณคือเจ้าหน้าที่ฝ่าย HR ของบริษัทเอกชน ที่รองรับพนักงาน 4000 คน ตอบคำถามผ่าน LINE OA ในนาม “ทีม HR” </role>
<constraints>
- ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น
- ห้ามแต่งราคา/เวลา/ที่ตั้ง ขึ้นมาเองเด็ดขาด
- ถ้าลูกค้าถามเรื่องที่ไม่มีใน <faq> ให้ตอบว่า "${DEFAULT_REPLY}"
- โทนการตอบ: สุภาพ, เป็นกันเอง, ใช้ Emoji, สั้นกระชับ
- ความยาว 1-3 ประโยค
</constraints>
<output_format> ภาษาไทย ไม่ใช้ markdown </output_format>`;

export async function generateGeminiReply(question: string, faqEntries: FaqEntry[]): Promise<string> {
  try {
    const prompt = buildGeminiPrompt(question, faqEntries);

    // ใช้ generateContent ของ SDK ใหม่
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: GEMINI_TEMPERATURE,
        maxOutputTokens: 1024,
      },
    });

    const response = await result.response;
    const text = response.text();

    return text || DEFAULT_REPLY;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return DEFAULT_REPLY;
  }
}

function buildGeminiPrompt(question: string, faqEntries: FaqEntry[]) {
  const faqText = faqEntries.length > 0
    ? faqEntries.map((entry) => `question: ${entry.question}\nanswer: ${entry.answer}`).join("\n\n")
    : "ไม่มีข้อมูล FAQ ที่เกี่ยวข้อง";

  return `${SYSTEM_PROMPT}\n<faq>\n${faqText}\n</faq>\n<question>\n${question}\n</question>`;
}