// ============================================================
// CHUYỆN CÔNG SỞ — the shared practice library. A lesson names one practice;
// the method label and the hedged research note come from here, so every
// case states the research the same, careful way (no invented statistics).
// Sources (03/11/2026): Gallup (State of the Global Workplace, Q12); Google
// re:Work (Project Aristotle, Project Oxygen); Amy Edmondson (The Fearless
// Organization); Kim Scott (Radical Candor); Center for Creative Leadership
// (SBI); Patrick Lencioni (The Five Dysfunctions of a Team); Patterson,
// Grenny et al. (Crucial Conversations); Porath & Pearson (The Price of
// Incivility, HBR 2013); Adam Grant (Give and Take); Andy Grove (High Output
// Management); John Kotter (Leading Change); Dale Carnegie (Đắc nhân tâm);
// WHO ICD-11 (burnout); ILO Convention 190; Vietnam's Labour Code 2019 and
// Decree 145/2020; SHRM (toxic culture report, 2019); Vietnamese HR press and
// forums (VnExpress, VietnamWorks HR Insider, JobsGO, CareerLink, Anphabe,
// Talentnet surveys, Brands Vietnam, Advertising Vietnam).
// ============================================================

import type { OfficeAudience, OfficeLesson, OfficeRole } from "./office-types.ts";

export type OfficeTechniqueId =
  | "sbi"
  | "radical_candor"
  | "psych_safety"
  | "coach"
  | "empower"
  | "clear_goals"
  | "recognition"
  | "crucial"
  | "trust"
  | "conflict_ideas"
  | "credit"
  | "civility"
  | "time_boundaries"
  | "burnout"
  | "onboarding"
  | "generations"
  | "fairness"
  | "blameless"
  | "integrity"
  | "speak_up_channel"
  | "bystander"
  | "customer"
  | "change"
  | "listen"
  | "one_on_one"
  | "giver";

export const OFFICE_TECHNIQUES: Record<OfficeTechniqueId, { method: string; basis: string }> = {
  sbi: {
    method: "Góp ý theo SBI: Tình huống – Hành vi – Tác động (Center for Creative Leadership)",
    basis: "Mô hình SBI của Center for Creative Leadership tách góp ý thành ba phần: lúc nào/ở đâu, hành vi cụ thể quan sát được, và tác động của hành vi đó; nói về hành vi thay vì phán xét con người giúp người nghe dễ tiếp nhận và cùng tìm cách sửa.",
  },
  radical_candor: {
    method: "Thẳng thắn mà quan tâm (Radical Candor — Kim Scott)",
    basis: "Kim Scott mô tả lãnh đạo tốt là vừa quan tâm thật lòng vừa nói thẳng; im lặng cho êm (\"đồng cảm tai hại\") hay chê gắt không quan tâm (\"hung hăng\") đều làm hỏng lòng tin và công việc.",
  },
  psych_safety: {
    method: "An toàn tâm lý: được nói ra mà không sợ bị trù dập (Amy Edmondson; Google Project Aristotle)",
    basis: "Amy Edmondson (Harvard) định nghĩa an toàn tâm lý là niềm tin chung rằng nhóm an toàn để dám nói, dám hỏi, dám nhận lỗi; nghiên cứu Project Aristotle của Google trên khoảng 180 nhóm ghi nhận đây là yếu tố quan trọng nhất trong các yếu tố được khảo sát.",
  },
  coach: {
    method: "Sếp là người kèm cặp: hỏi trước, gợi ý sau (Google Project Oxygen)",
    basis: "Nghiên cứu Project Oxygen của Google xếp \"là người kèm cặp giỏi\" đứng đầu các hành vi của những quản lý hiệu quả nhất; người kèm cặp giỏi đặt câu hỏi để nhân viên tự tìm ra cách thay vì giải hộ ngay.",
  },
  empower: {
    method: "Giao việc theo kết quả và trao quyền — không \"cầm tay chỉ việc\" từng bước",
    basis: "Project Oxygen của Google ghi nhận quản lý hiệu quả \"trao quyền cho đội và không quản lý vi mô\"; các tổ chức tư vấn quản trị khuyên nói rõ kết quả cần đạt và giới hạn quyết định, rồi để nhân viên chọn cách làm.",
  },
  clear_goals: {
    method: "Nói rõ mục tiêu, tiêu chuẩn \"xong\" và hạn chót ngay từ đầu",
    basis: "Câu hỏi đầu tiên trong bộ khảo sát gắn kết Q12 của Gallup là \"Tôi biết rõ công việc kỳ vọng gì ở tôi\"; Project Oxygen của Google cũng ghi nhận quản lý giỏi truyền đạt mục tiêu rõ ràng cho đội.",
  },
  recognition: {
    method: "Ghi nhận cụ thể, kịp thời, đúng người",
    basis: "Bộ Q12 của Gallup có câu \"Trong bảy ngày qua, tôi được ghi nhận hay khen ngợi vì làm tốt\"; Gallup cho rằng người quản lý chiếm ít nhất khoảng 70% mức chênh lệch về gắn kết giữa các nhóm.",
  },
  crucial: {
    method: "Cuộc trò chuyện quan trọng: tạo an toàn, nói sự thật trước, hỏi quan điểm (Crucial Conversations)",
    basis: "Các tác giả Crucial Conversations (Patterson, Grenny và cộng sự) mô tả khi căng thẳng cao và ý kiến trái nhau, người ta dễ im lặng hoặc công kích; giữ cho cuộc nói chuyện an toàn, bắt đầu bằng sự thật rồi mới đến suy diễn giúp hai bên nghe được nhau.",
  },
  trust: {
    method: "Xây lòng tin trước — dám nhận điểm yếu (Patrick Lencioni)",
    basis: "Mô hình \"Năm rối loạn chức năng của nhóm\" của Patrick Lencioni đặt sự thiếu lòng tin ở đáy: khi không ai dám nhận điểm yếu hay sai sót, nhóm sợ tranh luận, giữ hòa khí giả tạo và né trách nhiệm.",
  },
  conflict_ideas: {
    method: "Tranh luận về ý tưởng, không công kích con người (Lencioni)",
    basis: "Patrick Lencioni cho rằng nhóm mạnh tranh luận thẳng thắn về vấn đề — \"hòa khí giả tạo\" mới là nguy hiểm; điều kiện là tranh luận nhắm vào ý tưởng, không nhắm vào con người.",
  },
  credit: {
    method: "Ghi công minh bạch: nói rõ ai đã làm gì",
    basis: "Các cẩm nang nhân sự Việt Nam (VietnamWorks, JobsGO, CareerLink) mô tả \"cướp công\" là chuyện phổ biến và khuyên trao đổi riêng trước, lưu lại đóng góp bằng văn bản trên hệ thống chung; người quản lý nêu tên người đóng góp giúp cả đội tin vào sự công bằng.",
  },
  civility: {
    method: "Văn minh công sở: sự thô lỗ có cái giá thật (Porath & Pearson)",
    basis: "Nghiên cứu của Christine Porath và Christine Pearson (\"The Price of Incivility\", Harvard Business Review 2013) ghi nhận người bị đối xử thô lỗ mất thời gian lo lắng và giảm nỗ lực, còn khách hàng chứng kiến nhân viên đối xử thô lỗ với nhau dễ rời đi.",
  },
  time_boundaries: {
    method: "Thỏa thuận giờ liên lạc và quyền được nghỉ ngơi",
    basis: "Bộ luật Lao động 2019 quy định thời giờ làm việc, nghỉ ngơi và làm thêm giờ (làm thêm cần người lao động đồng ý); \"quyền ngắt kết nối\" đang được bàn ở Việt Nam và đã thành luật ở một số nước như Pháp, Úc. Thống nhất khung giờ phản hồi bảo vệ cả công việc lẫn sức khỏe.",
  },
  burnout: {
    method: "Nhận ra kiệt sức sớm và chia lại tải công việc (WHO ICD-11)",
    basis: "Tổ chức Y tế Thế giới (ICD-11) mô tả kiệt sức (burnout) là một hiện tượng nghề nghiệp do căng thẳng kéo dài tại nơi làm việc chưa được quản lý tốt, với ba dấu hiệu: cạn năng lượng, xa cách hoặc hoài nghi với công việc, giảm hiệu quả; đây không phải chẩn đoán bệnh — gốc rễ nằm ở tải việc và cách quản lý.",
  },
  onboarding: {
    method: "Đón người mới có kế hoạch: người kèm, việc đầu tiên rõ ràng",
    basis: "Báo chí nhân sự Việt Nam mô tả \"ma cũ bắt nạt ma mới\" (sai vặt, cô lập, gạt ý tưởng mới) là chuyện thường gặp; khảo sát của Anphabe ghi nhận nhiều người trẻ nghỉ việc ngay trong năm đầu. Một người kèm cặp và kế hoạch những tuần đầu giúp người mới hòa nhập.",
  },
  generations: {
    method: "Hiểu khác biệt thế hệ, thống nhất kỳ vọng rõ ràng",
    basis: "Khảo sát của Talentnet ghi nhận người đi làm ở mọi thế hệ đều không thích bị góp ý trước đông người — khác biệt không chỉ nằm ở người trẻ; các bài phân tích nhân sự cho rằng nhiều quản lý chưa được đào tạo làm việc với nhiều thế hệ, và kỳ vọng rõ ràng cùng đối thoại hai chiều giúp thu hẹp khoảng cách.",
  },
  fairness: {
    method: "Tiêu chí minh bạch cho lương thưởng và thăng tiến (công bằng quy trình)",
    basis: "Nghiên cứu về công bằng trong tổ chức (organisational justice) cho thấy người ta dễ chấp nhận kết quả — kể cả kết quả không như ý — khi quy trình minh bạch, nhất quán và họ được lắng nghe; báo cáo của SHRM (2019) ghi nhận nhiều người nghỉ việc vì văn hóa và vì người quản lý.",
  },
  blameless: {
    method: "Nhìn lại sai sót không đổ lỗi: tìm nguyên nhân, sửa quy trình",
    basis: "Nghiên cứu của Amy Edmondson ở bệnh viện ghi nhận những nhóm có không khí cởi mở lại báo cáo nhiều sai sót hơn — vì họ dám nói ra để sửa; các ngành đòi hỏi an toàn cao như hàng không, y tế dùng cách nhìn lại sự cố tập trung vào hệ thống thay vì tìm người để phạt.",
  },
  integrity: {
    method: "Liêm chính: khai báo xung đột lợi ích, từ chối quà cáp đúng quy định",
    basis: "Bộ quy tắc ứng xử của nhiều doanh nghiệp yêu cầu khai báo xung đột lợi ích và quà tặng; Luật Phòng, chống tham nhũng 2018 đã mở rộng một số quy định sang doanh nghiệp, tổ chức khu vực ngoài nhà nước.",
  },
  speak_up_channel: {
    method: "Ngăn chặn quấy rối và bắt nạt: lên tiếng, ghi lại, báo đúng kênh",
    basis: "Bộ luật Lao động 2019 lần đầu định nghĩa quấy rối tình dục tại nơi làm việc; Nghị định 145/2020 yêu cầu nội quy lao động có nội dung phòng, chống quấy rối và quy trình tiếp nhận, xử lý khiếu nại; Công ước 190 của ILO (2019) ghi nhận quyền được làm việc không bị bạo lực và quấy rối.",
  },
  bystander: {
    method: "Người chứng kiến lên tiếng — không im lặng trước sự thiếu tôn trọng",
    basis: "Các chương trình đào tạo \"người chứng kiến\" (như mô hình 5D: đánh lạc hướng, nhờ người có thẩm quyền, ghi lại, hỏi han sau đó, lên tiếng trực tiếp) giúp đồng nghiệp can thiệp an toàn thay vì đứng ngoài.",
  },
  customer: {
    method: "Lắng nghe khách hàng, giữ chữ tín, nói \"không\" kèm giải pháp",
    basis: "Nghiên cứu của Porath ghi nhận khách hàng chứng kiến sự thô lỗ thường bỏ đi; các nghiên cứu về khắc phục dịch vụ cho thấy thừa nhận vấn đề và sửa nhanh có thể lấy lại niềm tin của khách.",
  },
  change: {
    method: "Dẫn dắt thay đổi: nói rõ lý do, nghe nỗi lo, cho mọi người cùng tham gia (John Kotter)",
    basis: "Mô hình tám bước của John Kotter nhấn mạnh tạo sự cấp bách, truyền đạt tầm nhìn và tháo gỡ rào cản; nghiên cứu về quản trị thay đổi cho thấy người được tham gia vào thay đổi ít chống đối hơn.",
  },
  listen: {
    method: "Lắng nghe chủ động: hỏi thêm, nhắc lại, chưa vội phán xét (Carl Rogers; tinh thần \"Đắc nhân tâm\")",
    basis: "Nhà tâm lý học Carl Rogers phát triển kỹ năng lắng nghe chủ động — nghe để hiểu, nhắc lại điều người kia nói trước khi đáp; cuốn \"Đắc nhân tâm\" của Dale Carnegie, rất phổ biến ở Việt Nam, cũng đặt việc biết lắng nghe làm nền cho mọi mối quan hệ.",
  },
  one_on_one: {
    method: "Gặp riêng 1-1 định kỳ giữa sếp và nhân viên (Andy Grove)",
    basis: "Andy Grove (Intel) trong \"High Output Management\" coi buổi gặp 1-1 đều đặn là công cụ chính của người quản lý; Gallup ghi nhận những cuộc trò chuyện thường xuyên, có ý nghĩa với quản lý gắn với mức gắn kết cao hơn.",
  },
  giver: {
    method: "Giúp đỡ có ranh giới (Adam Grant — \"Give and Take\")",
    basis: "Adam Grant (Wharton) ghi nhận người hay giúp đỡ có mặt ở cả nhóm thành công nhất lẫn nhóm kém nhất; người giúp đỡ thành công biết giữ thời gian của mình và không để người chỉ biết nhận lợi dụng.",
  },
};

export type OfficeTheme =
  | "gop_y"
  | "lanh_dao"
  | "dong_doi"
  | "nguoi_moi"
  | "hop_viec"
  | "gio_giac"
  | "the_he"
  | "cong_bang"
  | "sai_lam"
  | "khach_hang"
  | "ton_trong"
  | "thay_doi";

export const OFFICE_THEMES: Array<{ id: OfficeTheme; label: string }> = [
  { id: "gop_y", label: "💬 Giao tiếp & góp ý" },
  { id: "lanh_dao", label: "👔 Phong cách lãnh đạo" },
  { id: "dong_doi", label: "🤝 Đồng nghiệp & làm việc nhóm" },
  { id: "nguoi_moi", label: "🌱 Nhân viên mới & hội nhập" },
  { id: "hop_viec", label: "📋 Họp hành, giao việc & deadline" },
  { id: "gio_giac", label: "⏰ Giờ giấc, làm thêm & cân bằng" },
  { id: "the_he", label: "🧑‍🤝‍🧑 Thế hệ & khác biệt văn hóa" },
  { id: "cong_bang", label: "⚖️ Công bằng, khen thưởng & thăng tiến" },
  { id: "sai_lam", label: "🛠️ Sai sót, áp lực & an toàn tâm lý" },
  { id: "khach_hang", label: "🧾 Khách hàng & đối tác" },
  { id: "ton_trong", label: "🛡️ Liêm chính & tôn trọng" },
  { id: "thay_doi", label: "🔄 Thay đổi, nghỉ việc & chuyển đổi số" },
];

export interface CompactOfficeLesson {
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
  tech: OfficeTechniqueId;
  audience: OfficeAudience;
  questions: [string, string];
  roles?: OfficeRole[];
  place?: string;
}

/** A full lesson from the compact form: the practice fills method + basis. */
export function officeLessonFrom(theme: OfficeTheme, raw: CompactOfficeLesson): OfficeLesson {
  const technique = OFFICE_TECHNIQUES[raw.tech];
  return {
    id: raw.id,
    theme,
    audience: raw.audience,
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
    questions: [...raw.questions],
    roles: raw.roles ?? ["staff", "manager"],
    place: raw.place ?? "văn phòng công ty",
  };
}

/** Lessons of one shelf. */
export const officeLessons = (theme: OfficeTheme, list: CompactOfficeLesson[]): OfficeLesson[] => list.map((raw) => officeLessonFrom(theme, raw));
