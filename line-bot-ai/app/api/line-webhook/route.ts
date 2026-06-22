import { validateSignature, WebhookEvent, Client } from "@line/bot-sdk";
import { findFaqAnswer } from "@/lib/sheet"; // นำเข้าฟังก์ชันค้นหาคำตอบ

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

export async function POST(request: Request) {
  const signature = request.headers.get("x-line-signature") ?? "";
  const body = await request.text();
  const secret = process.env.LINE_CHANNEL_SECRET;

  if (!secret) return new Response("Configuration Error", { status: 500 });

  if (!validateSignature(body, secret, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const data = JSON.parse(body);
  const events: WebhookEvent[] = data.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const replyToken = event.replyToken;
      const userQuestion = event.message.text;

      try {
        // 1. ค้นหาคำตอบจาก Sheet
        const faq = await findFaqAnswer(userQuestion);

        // 2. เตรียมข้อความตอบกลับ
        const replyText = faq 
          ? faq.answer 
          : "ขออภัยค่ะ พี่เติมสุขยังไม่มีข้อมูลส่วนนี้ สอบถามเพิ่มเติมได้ที่ฝ่าย HR นะคะ";

        // 3. ส่งกลับไปที่ LINE
        await client.replyMessage(replyToken, {
          type: "text",
          text: replyText,
        });
      } catch (error) {
        console.error("Error processing FAQ:", error);
        await client.replyMessage(replyToken, {
          type: "text",
          text: "ขออภัยค่ะ เกิดข้อผิดพลาดในการประมวลผลคำตอบ",
        });
      }
    }
  }

  return new Response("OK", { status: 200 });
}

export async function GET() {
  return new Response("Webhook is active", { status: 200 });
}