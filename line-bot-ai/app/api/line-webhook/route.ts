import { validateSignature, WebhookEvent, Client } from "@line/bot-sdk";
import { findFaqAnswer } from "@/lib/sheet";

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

export async function POST(request: Request) {
  const signature = request.headers.get("x-line-signature") ?? "";
  const body = await request.text();
  const secret = process.env.LINE_CHANNEL_SECRET;

  if (!secret) {
    console.error("LINE_CHANNEL_SECRET is missing");
    return new Response("Configuration Error", { status: 500 });
  }

  if (!validateSignature(body, secret, signature)) {
    console.error("Invalid signature");
    return new Response("Invalid signature", { status: 401 });
  }

  const data = JSON.parse(body);
  
  // เพิ่มการเช็คว่า data.events มีอยู่จริงไหม
  if (!data.events || !Array.isArray(data.events)) {
    return new Response("OK", { status: 200 });
  }

  // ใช้ Promise.all เพื่อให้ประมวลผลพร้อมกันและไม่พลาดเหตุการณ์ใดเหตุการณ์หนึ่ง
  await Promise.all(data.events.map(async (event: WebhookEvent) => {
    // สนใจเฉพาะ event ประเภท message และเป็น text
    if (event.type !== "message" || event.message.type !== "text") {
      return;
    }

    const { replyToken } = event;
    const userQuestion = event.message.text;

    try {
      const faq = await findFaqAnswer(userQuestion);
      const replyText = faq?.answer ?? "ขออภัยค่ะ พี่เติมสุขยังไม่มีข้อมูลส่วนนี้ สอบถามเพิ่มเติมได้ที่ฝ่าย HR นะคะ";

      await client.replyMessage(replyToken, {
        type: "text",
        text: replyText,
      });
    } catch (error) {
      console.error("Error in processing:", error);
    }
  }));

  return new Response("OK", { status: 200 });
}

export async function GET() {
  return new Response("Webhook is active", { status: 200 });
}