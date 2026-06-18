import { Client, validateSignature } from "@line/bot-sdk";
import { generateGeminiReply, DEFAULT_REPLY } from "@/lib/gemini";
import { findFaqAnswer } from "@/lib/sheet";

const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!LINE_CHANNEL_SECRET) {
  throw new Error("Missing environment variable: LINE_CHANNEL_SECRET");
}

if (!LINE_CHANNEL_ACCESS_TOKEN) {
  throw new Error("Missing environment variable: LINE_CHANNEL_ACCESS_TOKEN");
}

const lineClient = new Client({ channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN });

export async function POST(request: Request) {
  const signature = request.headers.get("x-line-signature") ?? "";
  const bodyText = await request.text();

  if (!validateSignature(bodyText, LINE_CHANNEL_SECRET, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(bodyText);
  } catch (error) {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events : [];

  await Promise.all(
    events.map(async (event: any) => {
      if (event?.type !== "message" || event?.message?.type !== "text" || !event?.replyToken) {
        return;
      }

      const userText = event.message.text;
      const faqEntry = await findFaqAnswer(userText);
      const replyText = await generateReplyText(userText, faqEntry);

      try {
        await lineClient.replyMessage(event.replyToken, {
          type: "text",
          text: replyText,
        });
      } catch (error) {
        console.error("LINE reply failed:", error);
      }
    })
  );

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
}

async function generateReplyText(userText: string, faqEntry: any) {
  if (!faqEntry) {
    return DEFAULT_REPLY;
  }

  const reply = await generateGeminiReply(userText, [faqEntry]);
  return reply || DEFAULT_REPLY;
}