import { validateSignature, WebhookEvent, Client } from "@line/bot-sdk";
import { findFaqAnswer } from "@/lib/sheet";

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

// สร้างตัวแปรเก็บเวลา 1 ชั่วโมง (อยู่นอกฟังก์ชันเพื่อให้จำค่าได้นานที่สุด)
const userCooldowns = new Map<string, number>();

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
  
  if (!data.events || !Array.isArray(data.events)) {
    return new Response("OK", { status: 200 });
  }

  await Promise.all(data.events.map(async (event: WebhookEvent) => {
    // กรองเฉพาะ event ประเภท message เท่านั้น
    if (event.type !== "message") return;

    const userId = event.source.userId;
    const replyToken = event.replyToken;
    const msg = event.message;

    if (!userId) return;

    // 1. ระบบเช็กการจำศีล 1 ชั่วโมง (Handover to HR)
    if (userCooldowns.has(userId)) {
      const lastHandoverTime = userCooldowns.get(userId)!;
      const ONE_HOUR = 60 * 60 * 1000; // 1 ชั่วโมงในหน่วยมิลลิวินาที

      if (Date.now() - lastHandoverTime < ONE_HOUR) {
        // ถ้ายังไม่ครบ 1 ชั่วโมง ให้บอท "อ่านแล้วไม่ตอบ" ปล่อยให้ HR คุย
        return; 
      } else {
        // ถ้าเกิน 1 ชั่วโมงแล้ว ลบชื่อออกจากระบบจำศีล
        userCooldowns.delete(userId);
      }
    }

    // 2. ระบบทักทาย (ดักจับ สติกเกอร์, รูปภาพ หรือ คำทักทายสั้นๆ)
    let isGreeting = false;
    if (msg.type === "image" || msg.type === "sticker") {
      isGreeting = true;
    } else if (msg.type === "text") {
      const text = msg.text.toLowerCase();
      // เช็กคำทักทาย (จำกัดความยาวไม่เกิน 20 ตัวอักษร เพื่อไม่ให้ไปบล็อกคำถามยาวๆ ของพนักงาน)
      if (/(สวัสดี|สวสัดี|ดีจ้า|hello|hi)/.test(text) && text.length <= 20) {
        isGreeting = true;
      }
    }

    if (isGreeting) {
      await client.replyMessage(replyToken, {
        type: "text",
        text: "สวัสดีค่ะ วันนี้ต้องการให้ พี่ GPS ช่วยเหลือเรื่องอะไรคะ 💙"
      });
      return; // จบการทำงานตรงนี้ ไม่ต้องส่งไปหา FAQ
    }

    // 3. ระบบถาม-ตอบ FAQ (ทำงานเฉพาะข้อความตัวอักษรปกติ)
    if (msg.type !== "text") return;
    const userQuestion = msg.text;

    try {
      const faq = await findFaqAnswer(userQuestion);
      
      if (faq?.answer) {
        // กรณีเจอคำตอบใน Google Sheet
        await client.replyMessage(replyToken, {
          type: "text",
          text: faq.answer
        });
      } else {
        // กรณีไม่เจอคำตอบ -> ส่งต่อให้ HR และเริ่มนับเวลา 1 ชม.
        userCooldowns.set(userId, Date.now());
        await client.replyMessage(replyToken, {
          type: "text",
          text: "ขออภัยค่ะ ทีม HR จะติดต่อกลับไปโดยเร็วที่สุดค่ะ 🙏"
        });
      }
    } catch (error) {
      console.error("Error in processing:", error);
    }
  }));

  return new Response("OK", { status: 200 });
}

export async function GET() {
  return new Response("Webhook is active", { status: 200 });
}