import OpenAI from "openai";

let openaiInstance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // maxRetries: 0 — TẮT retry ngầm của SDK (mặc định là 2). App đã tự quản lý
      // retry theo hạn thời gian (boundedTimeoutMs + vòng attempt). Nếu để SDK tự
      // retry 2 lần, một call bị timeout/429 sẽ chạy tới ~3× thời gian → vượt trần
      // 300s của Vercel (gây lỗi "unexpected response") VÀ bị TÍNH TIỀN TOKEN lại
      // cho mỗi lần retry ngầm (đắt gấp bội với model reasoning). Đây là nguyên nhân
      // chính khiến "từ hôm qua trừ tiền kinh khủng" + hay timeout.
      maxRetries: 0,
    });
  }
  return openaiInstance;
}
