// ============================================================
// CHUYỆN NHÀ — the shared technique library. A lesson names one technique; the
// method label and the hedged research note come from here, so 200 lessons
// state the research the same, careful way (no invented statistics).
// Sources (02–03/11/2026): Gottman Institute; Terri Apter (Cambridge) on
// in-laws; C.S. Mott Children's Hospital national poll on parents and
// grandparents; Taiwanese study of daughter-in-law conflict scenarios (n=135);
// Seoul co-residence study of mother/daughter-in-law pairs; Korean studies of
// economic dominance and of multicultural families; studies of postpartum
// confinement (zuo yuezi) and family care; Harvard Study of Adult
// Development; Vietnamese family research and counselling practice.
// ============================================================

import type { FamilyLesson, FamilyRelation, FamilyRole } from "./lesson-types.ts";

export type TechniqueId =
  | "expectations"
  | "speak_gently"
  | "son_bridge"
  | "boundaries"
  | "listen_first"
  | "shared_expert"
  | "share_domains"
  | "hidden_fear"
  | "respect_choice"
  | "money"
  | "direct_talk"
  | "gentle_startup"
  | "repair"
  | "responsibility"
  | "appreciation"
  | "gratitude"
  | "bids"
  | "nvc"
  | "time_out"
  | "culture_bridge";

export const TECHNIQUES: Record<TechniqueId, { method: string; basis: string }> = {
  expectations: {
    method: "Nói rõ kỳ vọng thay vì đoán ý nhau (Terri Apter)",
    basis: "Nhà tâm lý học Terri Apter (Đại học Cambridge) nhận thấy nhiều mâu thuẫn giữa con dâu và gia đình chồng bắt nguồn từ những kỳ vọng, giả định trái ngược nhau nhưng không được nói ra.",
  },
  speak_gently: {
    method: "Nói ra nhẹ nhàng thay vì nén chịu (Terri Apter)",
    basis: "Terri Apter mô tả kiểu \"cư xử ngoan\" bề ngoài: cả hai bên nén mâu thuẫn rồi bùng nổ; lời khuyên của bà là học cách nói ra điều mình nghĩ một cách nhẹ nhàng, trước khi ấm ức chồng chất.",
  },
  son_bridge: {
    method: "Vợ chồng thống nhất riêng trước, người con trai nói với mẹ mình",
    basis: "Nghiên cứu của Terri Apter ghi nhận người con trai thường làm rất ít để giảm căng thẳng giữa mẹ và vợ; các chuyên gia tư vấn gia đình khuyên vợ chồng thống nhất riêng trước, rồi mỗi người tự trao đổi với gia đình mình.",
  },
  boundaries: {
    method: "Ranh giới rõ ràng, nhất quán, đi kèm lời mời gắn kết",
    basis: "Các chuyên gia tư vấn gia đình khuyên vợ chồng thống nhất ranh giới (thăm nom, riêng tư, nuôi dạy con) rồi nói với gia đình một cách bình tĩnh, cụ thể và nhất quán; ranh giới bảo vệ các mối quan hệ chứ không làm hại chúng.",
  },
  listen_first: {
    method: "Lắng nghe kinh nghiệm của bà trước, đề xuất sau — coi nhau là đồng đội",
    basis: "Một khảo sát toàn quốc của Bệnh viện Nhi C.S. Mott (Mỹ) cho thấy gần một nửa cha mẹ từng bất đồng với ông bà về cách nuôi dạy cháu (kỷ luật, ăn uống, màn hình); các chuyên gia khuyên hiểu rằng ông bà nuôi con theo chuẩn mực thời của họ, và đưa thông tin mới như một sự chia sẻ chứ không phải lời chê.",
  },
  shared_expert: {
    method: "Cùng hỏi ý kiến chuyên môn — để bác sĩ làm \"trọng tài\"",
    basis: "Các chuyên gia nuôi dạy con khuyên khi cha mẹ và ông bà bất đồng về sức khỏe, an toàn của trẻ, hãy cùng nhau xem khuyến nghị mới của nhân viên y tế thay vì tranh luận ai đúng ai sai; cha mẹ giữ quyền quyết định, ông bà được mời cùng tham gia.",
  },
  share_domains: {
    method: "Chia \"vùng việc\" — mỗi người làm chủ một phần",
    basis: "Terri Apter nhận thấy nhiều xung đột đến từ việc cả hai người phụ nữ cùng muốn giữ vai trò trung tâm trong gia đình; các nghiên cứu ở Hàn Quốc về gia đình ở chung cũng ghi nhận quyền quyết định là nguồn căng thẳng — thỏa thuận rõ ai lo việc gì giúp giảm tranh giành.",
  },
  hidden_fear: {
    method: "Hỏi nỗi lo thật phía sau lời trách (giấc mơ ẩn sau mâu thuẫn — Gottman)",
    basis: "Nghiên cứu của nhóm Gottman cho thấy phía sau một mâu thuẫn lặp lại thường là một nỗi lo hay mong ước chưa nói ra; khi hỏi và hiểu được điều đó, hai bên thôi tranh luận lập trường.",
  },
  respect_choice: {
    method: "Tôn trọng quyền quyết định của vợ chồng trẻ — ông bà là cố vấn",
    basis: "Các chuyên gia gia đình nhấn mạnh cha mẹ của đứa trẻ cần giữ quyền quyết định cuối cùng, còn ông bà được trân trọng như những cố vấn yêu thương; trẻ được lợi khi có thêm người lớn thương yêu mình.",
  },
  money: {
    method: "Minh bạch tiền bạc và bàn bạc công bằng cho cả hai bên",
    basis: "Nghiên cứu về mâu thuẫn tiền bạc cho thấy xung đột về tiền thường phản ánh chuyện niềm tin và công bằng; nghiên cứu về gia đình ở chung tại Hàn Quốc ghi nhận quyền kinh tế là một nguồn căng thẳng lớn giữa mẹ chồng và nàng dâu.",
  },
  direct_talk: {
    method: "Nói thẳng, nhẹ nhàng với người trong cuộc — không kể với người ngoài",
    basis: "Các chuyên gia tâm lý gia đình ở Việt Nam khuyên khi có ấm ức với mẹ chồng hay con dâu, nên nói thẳng, nhẹ nhàng với người đó thay vì kể tội trên mạng xã hội hay với người ngoài.",
  },
  gentle_startup: {
    method: "Khởi đầu nhẹ nhàng: nói việc, cảm xúc và mong muốn (Gottman)",
    basis: "Nghiên cứu của nhóm Gottman cho thấy cách mở đầu một cuộc nói chuyện khó quyết định phần lớn kết cục; mở đầu bằng việc cụ thể, cảm xúc và mong muốn thay vì chê trách giúp người kia không phải phòng thủ.",
  },
  repair: {
    method: "Lời làm lành đúng lúc (repair attempt — Gottman)",
    basis: "Nghiên cứu của nhóm Gottman cho thấy điều giữ các mối quan hệ bền là việc đưa ra và chấp nhận những nỗ lực làm lành giữa lúc căng thẳng — một câu đùa, một cái chạm, \"mình nói lại nhé\".",
  },
  responsibility: {
    method: "Nhận phần trách nhiệm của mình (Gottman)",
    basis: "Theo nghiên cứu của nhóm Gottman, phòng thủ là một trong bốn kiểu giao tiếp làm rạn nứt quan hệ; liều giải là nhận phần trách nhiệm của mình, dù nhỏ.",
  },
  appreciation: {
    method: "Văn hóa trân trọng — nói ra điều mình quý ở người kia (Gottman)",
    basis: "Nghiên cứu của nhóm Gottman cho thấy sự trân trọng được nói ra thường xuyên là liều giải cho chê bai và khinh miệt; một nghiên cứu trên 135 con dâu ở Đài Loan ghi nhận lời chê là ngòi nổ thường gặp nhất của mâu thuẫn với mẹ chồng.",
  },
  gratitude: {
    method: "Lòng biết ơn nói thành lời, cụ thể",
    basis: "Nghiên cứu Phát triển Người trưởng thành của Đại học Harvard (theo dõi từ năm 1938) cho thấy chất lượng các mối quan hệ gần gũi gắn liền với sức khỏe và hạnh phúc về già; các nghiên cứu tâm lý học tích cực ghi nhận bày tỏ lòng biết ơn giúp mối quan hệ gắn bó hơn.",
  },
  bids: {
    method: "Đáp lại những lời mời kết nối nhỏ (Gottman)",
    basis: "Nghiên cứu của nhóm Gottman cho thấy sự gắn bó lớn lên từ những lần đáp lại các \"lời mời kết nối\" nhỏ hằng ngày — một câu hỏi, một lời kể, một ánh nhìn.",
  },
  nvc: {
    method: "Giao tiếp không bạo lực: điều xảy ra – cảm xúc – nhu cầu – đề nghị (Rosenberg)",
    basis: "Giao tiếp không bạo lực của Marshall Rosenberg gồm bốn phần: nói điều quan sát được không phán xét, cảm xúc, nhu cầu và một đề nghị cụ thể; phương pháp được dạy rộng rãi trong tư vấn gia đình.",
  },
  time_out: {
    method: "Tạm dừng có hẹn giờ quay lại khi quá nóng giận (Gottman)",
    basis: "Hướng dẫn của Viện Gottman: khi \"ngập cảm xúc\", cơ thể cần khoảng 20 phút để dịu lại; hãy nói rõ mình cần nghỉ, hẹn giờ quay lại và dùng quãng nghỉ để bình tĩnh chứ không để nghĩ cách cãi thắng.",
  },
  culture_bridge: {
    method: "Tò mò và học hỏi văn hóa của nhau",
    basis: "Các nghiên cứu về gia đình đa văn hóa ở Hàn Quốc ghi nhận mẹ chồng có con dâu người nước ngoài thường lo lắng và chịu định kiến xã hội; sự tò mò, học hỏi văn hóa của nhau giúp hai bên bớt khoảng cách.",
  },
};

export type MilTheme =
  | "ngay_dau"
  | "bep"
  | "cham_chau"
  | "o_cu"
  | "tien"
  | "le_tet"
  | "o_chung"
  | "loi_noi"
  | "loi_song"
  | "nha_ngoai"
  | "tuoi_gia"
  | "thoi_dai";

export const MIL_THEMES: Array<{ id: MilTheme; label: string }> = [
  { id: "ngay_dau", label: "💍 Ra mắt, đám cưới & ngày đầu làm dâu" },
  { id: "bep", label: "🍲 Bếp núc & việc nhà" },
  { id: "cham_chau", label: "👶 Chăm cháu & nuôi dạy cháu" },
  { id: "o_cu", label: "🤰 Mang thai, sinh nở & ở cữ" },
  { id: "tien", label: "💰 Tiền bạc & tài sản" },
  { id: "le_tet", label: "🏮 Lễ Tết, giỗ chạp & phong tục" },
  { id: "o_chung", label: "🏠 Ở chung, riêng tư & ranh giới" },
  { id: "loi_noi", label: "🗣️ Lời nói, so sánh & dư luận" },
  { id: "loi_song", label: "💼 Công việc, lối sống & ngoại hình" },
  { id: "nha_ngoai", label: "👵 Nhà ngoại, họ hàng & anh chị em" },
  { id: "tuoi_gia", label: "🩺 Sức khỏe, tuổi già & chăm sóc" },
  { id: "thoi_dai", label: "📱 Mạng xã hội & thời đại mới" },
];

export interface CompactLesson {
  id: string;
  title: string;
  hook: string;
  situation: string;
  conflict: string;
  climax: string;
  turning: string;
  lesson: string;
  awakening: string;
  takeaway: string;
  pattern: string;
  tech: TechniqueId;
  roles?: FamilyRole[];
  place?: string;
}

/** A full lesson from the compact form: the technique fills method + basis. */
export function lessonFrom(relation: FamilyRelation, theme: string, raw: CompactLesson): FamilyLesson {
  const technique = TECHNIQUES[raw.tech];
  return {
    id: raw.id,
    relation,
    theme,
    title: raw.title,
    hook: raw.hook,
    situation: raw.situation,
    conflict: raw.conflict,
    climax: raw.climax,
    turning: raw.turning,
    lesson: raw.lesson,
    awakening: raw.awakening,
    takeaway: raw.takeaway,
    pattern: raw.pattern,
    method: technique.method,
    basis: technique.basis,
    roles: raw.roles ?? ["wife", "mother_in_law", "husband"],
    place: raw.place ?? "căn nhà của gia đình",
  };
}

/** Mother-in-law / daughter-in-law lessons of one theme. */
export const milLessons = (theme: MilTheme, list: CompactLesson[]): FamilyLesson[] => list.map((raw) => lessonFrom("mil_dil", theme, raw));
