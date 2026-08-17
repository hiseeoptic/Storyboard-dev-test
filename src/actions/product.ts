"use server";

import { getOpenAIClient } from "@/lib/openai/client";
import { logOpenAiUsage } from "@/lib/ai/usage";
import {
  buildProductAnalysisPrompt,
  productIRSchema,
  type ProductAnalysisInput,
  type ProductIR,
} from "@/lib/product-ir";
import type { ActionResult } from "@/types";

const MAX_PRODUCT_IMAGES = 4;

function parseJsonObject(text: string): unknown {
  const stripped = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? stripped.slice(start, end + 1) : stripped);
}

async function analyzeWithOpenAI(input: ProductAnalysisInput): Promise<string> {
  const systemPrompt = "You are a conservative commercial product analyst. Never invent product specifications or advertising claims. Return JSON only.";
  const userPrompt = buildProductAnalysisPrompt(input);
  const model = process.env.OPENAI_PRODUCT_ANALYSIS_MODEL || "gpt-4.1-mini";
  const response = await getOpenAIClient().chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...(input.images ?? []).map((base64) => ({
            type: "image_url" as const,
            image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" as const },
          })),
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 4096,
  });
  logOpenAiUsage({
    stage: "affiliate_product_analysis",
    model,
    usage: response.usage,
    promptParts: [systemPrompt, userPrompt],
    imageCount: input.images?.length ?? 0,
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

export async function analyzeAffiliateProduct(
  rawInput: ProductAnalysisInput
): Promise<ActionResult<ProductIR>> {
  const input: ProductAnalysisInput = {
    product_name: rawInput.product_name?.slice(0, 300),
    user_description: rawInput.user_description?.slice(0, 5000),
    verified_uses: rawInput.verified_uses?.slice(0, 5000),
    verified_claims: rawInput.verified_claims?.slice(0, 5000),
    images: (rawInput.images ?? []).filter(Boolean).slice(0, MAX_PRODUCT_IMAGES),
  };
  if ((input.images?.length ?? 0) === 0) {
    return { success: false, error: "Hãy tải ít nhất một ảnh sản phẩm rõ trước khi phân tích.", code: "PRODUCT_IMAGE_REQUIRED" };
  }

  let raw = "";
  try {
    // Exactly ONE paid vision request. No hidden fallback/retry: the user may
    // explicitly press Analyze again if the provider fails.
    raw = await analyzeWithOpenAI(input);
  } catch (openAIError) {
    console.error("[Affiliate Product] OpenAI analysis failed:", openAIError);
    return { success: false, error: "Không phân tích được sản phẩm từ ảnh. Không có lượt AI dự phòng nào được gọi; hãy thử lại khi bạn muốn.", code: "PRODUCT_ANALYSIS_FAILED" };
  }

  try {
    const parsed = productIRSchema.parse(parseJsonObject(raw));
    return { success: true, data: { ...parsed, review_status: "pending" } };
  } catch (error) {
    console.error("[Affiliate Product] Invalid Product IR:", error);
    return { success: false, error: "AI đã đọc ảnh nhưng Product IR chưa hợp lệ. Hãy thử lại với ảnh rõ hơn.", code: "PRODUCT_IR_INVALID" };
  }
}
