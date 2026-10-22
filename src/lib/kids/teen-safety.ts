// 13–15 is still a child audience.  These subjects are intentionally outside
// this light, everyday parenting-reel format.  The detector protects both the
// curated shelf and free-text requests before they reach a model.

export const TEEN_SAFETY_RULE =
  "TEEN 13–15 SAFETY (HARD): keep the story to ordinary home, school, friendship, learning, hobby and supervised public-life situations. Do not introduce romance or dating; puberty or body-change discussion; weight loss or dieting; alcohol, tobacco, vaping or drugs; self-harm or suicide; fighting, weapons or graphic injury; gambling or betting; the teen driving a motorbike or car on public roads; or unsupervised late-night outings. Never diagnose a mental-health condition. If the input asks for a blocked topic, replace it with a safe everyday parent–teen communication situation. Adults stay responsible; school or professional support may be suggested without making clinical claims.";

const BLOCKED: Array<{ id: string; pattern: RegExp }> = [
  { id: "romance", pattern: /(?<!\p{L})(?:yêu đương|người yêu|hẹn hò|crush|tỏ tình|chia tay người yêu|romance|dating)(?!\p{L})/iu },
  { id: "body_changes", pattern: /(?<!\p{L})(?:dậy thì|kinh nguyệt|thay đổi cơ thể|cơ thể phát triển|puberty|body changes?)(?!\p{L})/iu },
  { id: "weight_diet", pattern: /(?<!\p{L})(?:giảm cân|ăn kiêng|cân nặng|nhịn ăn|dieting|weight loss)(?!\p{L})/iu },
  { id: "substances", pattern: /(?<!\p{L})(?:rượu|bia|thuốc lá|thuốc điện tử|vape|ma túy|alcohol|tobacco|cigarette|drugs?)(?!\p{L})/iu },
  { id: "self_harm", pattern: /(?<!\p{L})(?:tự làm hại|tự gây thương tích|tự tử|suicide|self[- ]?harm)(?!\p{L})/iu },
  { id: "violence", pattern: /(?<!\p{L})(?:đánh nhau|ẩu đả|dao|súng|vũ khí|fighting|weapons?)(?!\p{L})/iu },
  { id: "gambling", pattern: /(?<!\p{L})(?:cờ bạc|cá cược|đánh bạc|gambling|betting)(?!\p{L})/iu },
  { id: "road_driving", pattern: /(?<!\p{L})(?:(?:tự |đòi |lén )?(?:lái|chạy|điều khiển) (?:xe máy|ô tô)|motorbike driving|driving a car)(?!\p{L})/iu },
  { id: "late_night", pattern: /(?<!\p{L})(?:đi chơi đêm|đi qua đêm|trốn đi đêm|overnight party|late[- ]night outing)(?!\p{L})/iu },
];

export function teenSafetyViolations(text: string): string[] {
  return BLOCKED.filter((rule) => rule.pattern.test(text.normalize("NFC"))).map((rule) => rule.id);
}

export function isTeenSafeText(text: string): boolean {
  return teenSafetyViolations(text).length === 0;
}

export function teenSafeRequest(text: string): string {
  const request = String(text ?? "").trim().slice(0, 4000);
  return isTeenSafeText(request)
    ? request
    : "Một tình huống đời thường an toàn giữa con tuổi teen và bố mẹ: hai bên bình tĩnh lắng nghe, thống nhất giới hạn và cùng chọn một bước giải quyết nhỏ.";
}
