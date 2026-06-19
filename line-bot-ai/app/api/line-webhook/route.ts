import { validateSignature } from "@line/bot-sdk";

export async function POST(request: Request) {
  // 1. รับค่า signature จาก header
  const signature = request.headers.get("x-line-signature") ?? "";
  
  // 2. รับค่า body เป็นข้อความ (สำคัญ: ทำนอก if)
  const body = await request.text();
  
  // 3. ดึงค่า secret
  const secret = process.env.LINE_CHANNEL_SECRET;

  // 4. เช็คว่า secret มีจริงไหม
  if (!secret) {
    console.error("DEBUG: LINE_CHANNEL_SECRET is missing");
    return new Response("Configuration Error: Missing Secret", { status: 500 });
  }

  // 5. ตรวจสอบ Signature โดยใช้ตัวแปร body ที่ประกาศไว้ข้างบน
  try {
    const isValid = validateSignature(body, secret, signature);

    if (!isValid) {
      console.error("DEBUG: Signature verification failed");
      return new Response("Invalid signature", { status: 401 });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("DEBUG: Error in validateSignature", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function GET() {
  return new Response("Webhook is active", { status: 200 });
}