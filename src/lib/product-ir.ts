import { z } from "zod";

export const affiliateVideoStyleSchema = z.enum([
  "ugc",
  "hands_on_demo",
  "problem_solution",
  "before_after",
  "expert",
  "lifestyle",
  "fast_promo",
]);

export type AffiliateVideoStyle = z.infer<typeof affiliateVideoStyleSchema>;

export const productIRSchema = z.object({
  version: z.literal("1.0").default("1.0"),
  product_name: z.string().min(1),
  detected_category: z.string().min(1),
  confidence: z.number().min(0).max(1),
  visible_features: z.array(z.string()).default([]),
  probable_uses: z.array(z.string()).default([]),
  approved_claims: z.array(z.string()).default([]),
  prohibited_claims: z.array(z.string()).default([]),
  handling_contract: z.array(z.string()).default([]),
  demo_actions: z.array(z.string()).default([]),
  recommended_environments: z.array(z.string()).default([]),
  safety_notes: z.array(z.string()).default([]),
  product_reference_lock: z.string().min(1),
  review_status: z.enum(["pending", "approved"]).default("pending"),
});

export type ProductIR = z.infer<typeof productIRSchema>;

export interface ProductAnalysisInput {
  product_name?: string;
  user_description?: string;
  verified_uses?: string;
  verified_claims?: string;
  images?: string[];
}

export function buildProductAnalysisPrompt(input: ProductAnalysisInput): string {
  return `Analyze the attached commercial product references and return one compact JSON object only.

USER-PROVIDED AUTHORITY
- Product name: ${input.product_name?.trim() || "unspecified"}
- Description / verified use notes: ${input.user_description?.trim() || "none"}
- Verified uses: ${input.verified_uses?.trim() || "none"}
- Verified advertising claims: ${input.verified_claims?.trim() || "none"}

RULES
1. Describe only visible identity facts: shape, colour, material, moving parts, packaging, logo/label placement and grip/contact surfaces.
2. Infer a probable category/use only when visually plausible. Put every inference in probable_uses and keep confidence conservative.
3. approved_claims may contain ONLY claims explicitly supplied by the user or directly visible, observable facts. Never invent capacity, dimensions, ingredients, material grade, branch diameter, performance percentage, medical benefit, durability, warranty, price or certification.
4. prohibited_claims lists tempting but unsupported claims that the script must not state.
5. handling_contract gives physically credible body-part → contact-point → object-response rules.
6. demo_actions are short, filmable, atomic operations that visibly prove use without unsafe behaviour.
7. recommended_environments are real use settings suited to the product, not generic studios unless the product actually calls for one.
8. safety_notes names visible hazards or uncertainty. No legal or medical certainty.
9. product_reference_lock is a concise instruction to preserve exact product geometry, colour, logo, packaging and scale from the attached image in every board and video.
10. review_status MUST be "pending". A human approves the result before storyboard generation.

JSON SHAPE
{"version":"1.0","product_name":"...","detected_category":"...","confidence":0.0,"visible_features":["..."],"probable_uses":["..."],"approved_claims":["..."],"prohibited_claims":["..."],"handling_contract":["..."],"demo_actions":["..."],"recommended_environments":["..."],"safety_notes":["..."],"product_reference_lock":"...","review_status":"pending"}`;
}

export function compileProductIRDigest(ir: ProductIR): string {
  const line = (label: string, values: string[]) =>
    values.length ? `${label}: ${values.join("; ")}` : `${label}: none supplied`;
  return [
    `AFFILIATE PRODUCT IR (HUMAN-APPROVED AUTHORITY):`,
    `Product: ${ir.product_name}`,
    `Category: ${ir.detected_category} (vision confidence ${Math.round(ir.confidence * 100)}%)`,
    line("Visible identity", ir.visible_features),
    line("Approved uses", ir.probable_uses),
    line("Allowed claims", ir.approved_claims),
    line("Forbidden unsupported claims", ir.prohibited_claims),
    line("Physical handling", ir.handling_contract),
    line("Filmable demo actions", ir.demo_actions),
    line("Suitable real-use environments", ir.recommended_environments),
    line("Safety/uncertainty", ir.safety_notes),
    `Reference lock: ${ir.product_reference_lock}`,
    `Commercial arc: 0-3s recognisable problem hook → product visible by 3-5s → real operation → observable proof/result → one approved benefit → exact CTA. Do not delay the product reveal, recite a feature list or state a prohibited claim.`,
  ].join("\n");
}
