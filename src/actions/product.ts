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
import {
  buildGarmentAnalysisPrompt,
  normalizeGarmentAnalysis,
  type GarmentAnalysis,
  type WearerGroup,
} from "@/lib/fashion/outfit";

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

const MAX_OUTFIT_IMAGES = 4;

/**
 * Read the garments in a character's outfit photos: which slots they fill,
 * whether a shop model wears them, and neutral pieces for the missing slots.
 * One paid vision request per press, like the product analysis.
 */
export async function analyzeOutfitImages(raw: {
  images: string[];
  name?: string;
  group?: WearerGroup;
  note?: string;
}): Promise<ActionResult<GarmentAnalysis>> {
  const images = (raw.images ?? []).filter(Boolean).slice(0, MAX_OUTFIT_IMAGES);
  if (images.length === 0) {
    return { success: false, error: "Hãy tải ít nhất một ảnh trang phục trước khi phân tích.", code: "OUTFIT_IMAGE_REQUIRED" };
  }
  const systemPrompt =
    "You are a precise fashion product analyst. Describe only the clothes and wearable items for sale, never the person wearing them. Return JSON only.";
  const userPrompt = buildGarmentAnalysisPrompt({ name: raw.name?.slice(0, 200), group: raw.group, note: raw.note?.slice(0, 1000), imageCount: images.length });
  const model = process.env.OPENAI_PRODUCT_ANALYSIS_MODEL || "gpt-4.1-mini";
  let content = "";
  try {
    const response = await getOpenAIClient().chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            ...images.map((base64) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/jpeg;base64,${base64}`, detail: "high" as const },
            })),
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000,
    });
    logOpenAiUsage({ stage: "fashion_outfit_analysis", model, usage: response.usage, promptParts: [systemPrompt, userPrompt], imageCount: images.length });
    content = response.choices[0]?.message?.content?.trim() ?? "";
  } catch (error) {
    console.error("[Fashion] Outfit analysis failed:", error);
    return { success: false, error: "Không đọc được ảnh trang phục. Bạn bấm phân tích lại nhé.", code: "OUTFIT_ANALYSIS_FAILED" };
  }
  try {
    const analysis = normalizeGarmentAnalysis(parseJsonObject(content), images.length);
    if (analysis.garments.length === 0) {
      return { success: false, error: "AI không thấy món đồ nào trong ảnh. Hãy dùng ảnh rõ sản phẩm hơn.", code: "OUTFIT_NO_GARMENT" };
    }
    return { success: true, data: analysis };
  } catch (error) {
    console.error("[Fashion] Invalid outfit analysis:", error);
    return { success: false, error: "AI đã đọc ảnh nhưng kết quả chưa hợp lệ. Hãy thử lại.", code: "OUTFIT_ANALYSIS_INVALID" };
  }
}
