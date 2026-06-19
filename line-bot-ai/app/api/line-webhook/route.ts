import { validateSignature } from "@line/bot-sdk";

// สำหรับการรับข้อความจาก LINE (รองรับทั้ง POST ของการรับข้อความ และ POST ของการ Verify)
export async function POST(request: Request) {
  const secret = process.env.LINE_CHANNEL_SECRET;

  // บรรทัดนี้จะพ่นค่าออกมาใน Log (อย่าลืมเอาออกหลังจากใช้งานเสร็จนะคะ)
  console.log("Secret length:", secret ? secret.length : "UNDEFINED");

  if (!secret) {
    return new Response("Configuration Error", { status: 500 });
  }
  // ตรวจสอบ Signature
  const isValid = validateSignature(body, secret, signature);

  if (!isValid) {
    console.error("Invalid signature attempt");
    return new Response("Invalid signature", { status: 401 });
  }

  // ถ้าผ่านการตรวจสอบ ให้ตอบกลับ 200 ทันที
  return new Response("OK", { status: 200 });
}

// เพิ่ม GET เพื่อป้องกัน Error หาก LINE มีการเช็คผ่าน URL ตรงๆ
export async function GET() {
  return new Response("Webhook is active", { status: 200 });
}