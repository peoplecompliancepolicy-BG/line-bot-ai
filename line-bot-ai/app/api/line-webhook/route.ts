import { Client, validateSignature } from "@line/bot-sdk";

// สำหรับการทดสอบ Verify ในหน้าเว็บ LINE Developers
export async function GET() {
  return new Response("OK", { status: 200 });
}

// สำหรับการรับข้อความจาก LINE
export async function POST(request: Request) {
  const signature = request.headers.get("x-line-signature") ?? "";
  const bodyText = await request.text();
  const secret = process.env.LINE_CHANNEL_SECRET ?? "";

  if (!validateSignature(bodyText, secret, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  return new Response("Success", { status: 200 });
}