// ============================================================
// KHO DẠY CON — parenting lessons told through everyday cute-kid moments.
// Each lesson is a relatable situation, the kid's behaviour, the parent's
// respectful technique (positive-discipline principles), a one-line
// takeaway for the narrator/caption and a mild "ineffective" reaction for
// the optional A/B format (never hitting, yelling, threats or shaming).
// Pure data (node-testable). First pillars: money and emotions.
// ============================================================

import type { KidAge } from "./cute-kids.ts";

export type LessonPillar = "money" | "emotions";

export interface ParentingLesson {
  id: string;
  pillar: LessonPillar;
  ages: KidAge[];
  title: string;
  /** The story request (Vietnamese) — the relatable moment. */
  situation: string;
  /** What the kid does (cute traits come from the card). */
  behavior: string;
  /** The parent's respectful, concrete technique. */
  technique: string;
  /** One-line tip for the narrator or the parent, and the caption. */
  takeaway: string;
  /** Mild ineffective reaction for "Cách 1" in the A/B format. */
  wrongWay: string;
}

export const LESSON_PILLARS: Array<{ id: LessonPillar; label: string }> = [
  { id: "money", label: "💰 Tiền bạc" },
  { id: "emotions", label: "😤 Cảm xúc" },
];

const ALL: KidAge[] = ["toddler", "young", "school"];
const OLDER: KidAge[] = ["young", "school"];

export const PARENTING_LESSONS: ParentingLesson[] = [
  // ─── 💰 Tiền bạc ──────────────────────────────────────────────────────────
  {
    id: "toy_aisle", pillar: "money", ages: ALL,
    title: "Đòi mua đồ chơi ở siêu thị",
    situation: "Đi siêu thị, bé đứng lì ở quầy đồ chơi, ôm chặt một món đồ chơi và đòi mua cho bằng được.",
    behavior: "nài nỉ ngọt ngào, bị từ chối thì ăn vạ ngay giữa quầy",
    technique: "bố mẹ ngồi xuống ngang tầm mắt, thừa nhận mong muốn (\"Con thích nó lắm đúng không\"), giữ giới hạn (\"Hôm nay mình chỉ mua đồ trong danh sách\") và cho bé một kế hoạch: chụp ảnh món đồ vào \"danh sách mơ ước\", để dành tiền heo đất để mua",
    takeaway: "Thừa nhận mong muốn của con nhưng giữ nguyên giới hạn, và cho con một kế hoạch thay vì chỉ một chữ \"không\".",
    wrongWay: "bố mẹ nói cụt \"Không mua là không mua!\" khiến bé khóc to hơn, rồi lại mua cho xong chuyện",
  },
  {
    id: "three_jars", pillar: "money", ages: OLDER,
    title: "Đòi đập heo đất mua kẹo",
    situation: "Bé ôm heo đất đòi lấy hết tiền ra mua kẹo ngay bây giờ.",
    behavior: "lắc heo đất, nũng nịu đòi tiêu luôn, lý sự rằng tiền của con thì con được tiêu",
    technique: "bố mẹ đồng ý tiền là của con, rồi cùng con chia tiền vào 3 hũ dán nhãn \"Tiêu\", \"Để dành\", \"Chia sẻ\"; con được tiêu đúng phần trong hũ \"Tiêu\"",
    takeaway: "Chia tiền thành 3 hũ: tiêu, để dành, chia sẻ — con học quản lý tiền từ những đồng xu đầu tiên.",
    wrongWay: "bố mẹ cất heo đất lên tủ và nói \"Để mẹ giữ cho\", bé dỗi không hiểu vì sao",
  },
  {
    id: "need_vs_want", pillar: "money", ages: OLDER,
    title: "Cần hay muốn?",
    situation: "Bé đã có hai đôi giày nhưng vẫn đòi mua thêm đôi giày phát sáng thứ ba.",
    behavior: "liệt kê đủ lý do vì sao \"con cần\" đôi giày mới",
    technique: "bố mẹ biến nó thành trò chơi \"Cần hay Muốn\": bé tự xếp các món đồ (cơm, áo ấm, đồ chơi, giày phát sáng) vào hai giỏ, rồi tự nhận ra đôi giày nằm ở giỏ \"Muốn\"",
    takeaway: "Dạy con phân biệt \"cần\" và \"muốn\" bằng một trò chơi, không cần giảng giải.",
    wrongWay: "bố mẹ giảng một tràng dài về tiết kiệm trong khi bé chán nản nhìn đi chỗ khác",
  },
  {
    id: "lucky_money", pillar: "money", ages: OLDER,
    title: "Tiền lì xì của ai?",
    situation: "Sau Tết, mẹ định giữ tiền lì xì giúp, bé ôm phong bao không chịu đưa.",
    behavior: "giấu phong bao sau lưng, cãi \"tiền của con mà\"",
    technique: "mẹ cùng bé làm một cuốn \"sổ tiết kiệm\" bằng giấy: bé giữ một phần để tự quyết, phần còn lại ghi vào sổ cho một mục tiêu bé tự chọn",
    takeaway: "Cho con quyền quyết định một phần tiền lì xì — trách nhiệm đi kèm với quyền.",
    wrongWay: "mẹ lấy hết phong bao và nói \"Mẹ giữ cho, lớn mẹ trả\"",
  },
  {
    id: "where_money_from", pillar: "money", ages: OLDER,
    title: "Tiền ở đâu ra?",
    situation: "Bé đòi mua đồ và nói \"Bố cứ quẹt thẻ là có tiền mà!\".",
    behavior: "ngây thơ tin rằng chiếc thẻ tự sinh ra tiền",
    technique: "bố cho bé xem một ngày đi làm của bố qua đồng hồ và lịch, giải thích bố đổi thời gian làm việc lấy tiền, quẹt thẻ là tiêu số tiền đã kiếm được",
    takeaway: "Cho con thấy tiền đến từ công sức — con sẽ biết trân trọng từng món đồ.",
    wrongWay: "bố trả lời qua loa \"Thẻ thì có tiền chứ sao\" rồi mua luôn, bé càng tin thẻ tự sinh ra tiền",
  },
  {
    id: "chores_for_pay", pillar: "money", ages: ["school"],
    title: "Dọn đồ chơi đòi trả tiền",
    situation: "Mẹ nhờ bé dọn đồ chơi, bé khoanh tay ra điều kiện: \"Mẹ trả con mười nghìn con mới dọn\".",
    behavior: "mặc cả khôn lanh như một doanh nhân nhí",
    technique: "mẹ phân biệt rõ: việc của bản thân và việc chung trong nhà thì ai cũng làm không lấy tiền; chỉ \"việc làm thêm\" (lau xe cùng bố) mới có thưởng",
    takeaway: "Việc nhà là trách nhiệm của cả nhà; chỉ việc \"làm thêm\" mới có thưởng.",
    wrongWay: "mẹ đồng ý trả tiền cho mọi việc, hôm sau bé đòi tiền cả việc đánh răng",
  },
  {
    id: "pay_by_myself", pillar: "money", ages: OLDER,
    title: "Lần đầu tự trả tiền",
    situation: "Đi mua kem, mẹ đưa tiền cho bé tự trả cô bán hàng và tự nhận tiền thừa.",
    behavior: "hồi hộp, đếm tiền nghiêm túc, tự hào khi làm được",
    technique: "mẹ đứng cạnh nhưng để bé tự làm, chỉ nhắc nhẹ khi cần, khen cụ thể khi bé đếm đúng tiền thừa",
    takeaway: "Để con tự cầm tiền trả — một lần thực hành bằng mười lần nói.",
    wrongWay: "mẹ giành trả hết vì sợ chậm, bé đứng nhìn không học được gì",
  },
  {
    id: "same_as_friend", pillar: "money", ages: OLDER,
    title: "Bạn có thì con cũng phải có",
    situation: "Bé về nhà đòi mua chiếc cặp giống hệt của bạn cùng lớp.",
    behavior: "dỗi vì \"bạn nào cũng có\"",
    technique: "bố mẹ hỏi con thích điều gì ở chiếc cặp, rồi cùng con lên kế hoạch để dành cho thứ con thật sự thích, nói về lựa chọn của gia đình mình",
    takeaway: "Đừng mua để con \"bằng bạn\" — hãy giúp con có kế hoạch cho điều con thật sự thích.",
    wrongWay: "bố mẹ gạt đi \"Cặp cũ vẫn dùng được\" mà không hỏi lý do, bé dỗi",
  },
  {
    id: "broke_toy", pillar: "money", ages: ALL,
    title: "Làm hỏng đồ chơi đòi mua cái mới",
    situation: "Bé ném chiếc ô tô đồ chơi làm gãy bánh, rồi đòi mua ngay một chiếc mới.",
    behavior: "mếu máo đòi cái mới, đổ lỗi cho chiếc ô tô",
    technique: "bố mẹ không mua lại ngay: cùng bé thử sửa bằng băng dính, và nói nếu muốn cái mới thì cùng để dành",
    takeaway: "Không mua lại ngay khi con làm hỏng — để con học giữ gìn đồ của mình.",
    wrongWay: "bố mẹ mua ngay cái mới cho bé nín",
  },
  {
    id: "saving_goal", pillar: "money", ages: OLDER,
    title: "Để dành mua xe đạp",
    situation: "Bé mơ có một chiếc xe đạp mới và hỏi bố bao giờ mới mua.",
    behavior: "sốt ruột, ngày nào cũng hỏi",
    technique: "bố vẽ một \"bảng tiết kiệm\" hình chiếc xe đạp, mỗi lần bé bỏ tiền vào heo đất thì tô màu thêm một ô",
    takeaway: "Biến mục tiêu tiết kiệm thành hình ảnh con nhìn thấy mỗi ngày.",
    wrongWay: "bố hứa hẹn \"để bố tính\" rồi quên mất",
  },

  // ─── 😤 Cảm xúc ────────────────────────────────────────────────────────────
  {
    id: "screen_tantrum", pillar: "emotions", ages: ALL,
    title: "Ăn vạ khi phải tắt tivi",
    situation: "Đến giờ tắt tivi, bé lăn ra sofa khóc ăn vạ đòi xem thêm một tập.",
    behavior: "khóc nhè, hé mắt xem bố mẹ có mềm lòng không",
    technique: "bố mẹ ngồi xuống ngang tầm mắt, gọi tên cảm xúc (\"Con đang tiếc vì phim đang hay\"), chờ bé dịu rồi mới nhắc lại giới hạn và đưa lựa chọn tiếp theo (đọc truyện hay xếp hình)",
    takeaway: "Gọi tên cảm xúc trước, nói chuyện đúng sai sau — cơn giận sẽ qua nhanh hơn.",
    wrongWay: "bố mẹ nói cứng \"Hết giờ là hết, không khóc nữa\", bé càng khóc to hơn",
  },
  {
    id: "jealous_sibling", pillar: "emotions", ages: ALL,
    title: "Ghen với em bé",
    situation: "Mẹ đang bế em bé, bé lớn giận dỗi ngồi một góc, nói \"Mẹ chỉ thương em thôi\".",
    behavior: "dỗi, quay lưng, liếc trộm mẹ",
    technique: "mẹ dành \"thời gian riêng của hai mẹ con\" mỗi ngày và giao cho bé vai \"anh/chị cả\" giúp mẹ chăm em, khen bé trước mặt em",
    takeaway: "Con lớn ghen vì sợ mất mẹ — hãy cho con thời gian riêng và một vai trò quan trọng.",
    wrongWay: "mẹ vừa bế em vừa nói vội \"Con lớn rồi, tự chơi đi\", bé càng dỗi",
  },
  {
    id: "sore_loser", pillar: "emotions", ages: OLDER,
    title: "Thua là giận",
    situation: "Chơi cờ cá ngựa với bố, bé thua và hất tung bàn cờ.",
    behavior: "giận dỗi, khoanh tay, nói \"Con không chơi nữa\"",
    technique: "bố công nhận cảm xúc (\"Thua thì tức thật\"), rồi làm mẫu thua vui vẻ ở ván sau: \"Bố thua rồi, ván sau bố cố gắng hơn!\"",
    takeaway: "Để con thấy bố mẹ thua một cách vui vẻ — con học cách thua từ chính bố mẹ.",
    wrongWay: "bố cố tình nhường hết các ván để bé không khóc",
  },
  {
    id: "afraid_dark", pillar: "emotions", ages: ALL,
    title: "Sợ ngủ một mình",
    situation: "Đến giờ ngủ, bé không chịu ở phòng một mình vì sợ \"có quái vật\".",
    behavior: "ôm gấu bông, níu tay bố mẹ không cho đi",
    technique: "bố mẹ không chê \"có gì đâu mà sợ\", mà cùng bé \"đi tuần tra\" kiểm tra phòng với đèn pin, đặt gấu bông làm \"lính gác\" và để đèn ngủ nhỏ",
    takeaway: "Đừng nói \"có gì đâu mà sợ\" — hãy cùng con biến nỗi sợ thành trò chơi dũng cảm.",
    wrongWay: "bố mẹ nói \"Có gì đâu mà sợ, ngủ đi!\" rồi tắt đèn đi ra",
  },
  {
    id: "spilled_lie", pillar: "emotions", ages: OLDER,
    title: "Làm đổ nước cam rồi đổ cho mèo",
    situation: "Bé làm đổ cốc nước cam lên sofa, khi mẹ hỏi thì chỉ tay vào con mèo.",
    behavior: "lúng túng, mắt đảo, đổ lỗi đầy khôn lanh",
    technique: "mẹ giữ bình tĩnh, nói \"Mẹ sẽ không giận nếu con nói thật\", cảm ơn bé khi bé thừa nhận, rồi cùng bé lau sạch",
    takeaway: "Khi con nói thật, hãy cảm ơn trước khi xử lý lỗi — con sẽ không cần nói dối nữa.",
    wrongWay: "mẹ hỏi dồn \"Có đúng là con mèo không?\" khiến bé càng chối",
  },
  {
    id: "wont_share", pillar: "emotions", ages: ALL,
    title: "Không chịu chia đồ chơi",
    situation: "Em họ đến chơi, bé ôm hết đồ chơi vào lòng không cho em động vào.",
    behavior: "giữ chặt, la \"Của con!\"",
    technique: "bố mẹ không ép, mà dùng đồng hồ cát: mỗi người chơi một lượt, khi cát chảy hết thì \"đến lượt\" người kia",
    takeaway: "Đừng ép con chia — hãy dạy con \"đến lượt\" bằng một chiếc đồng hồ.",
    wrongWay: "bố mẹ lấy đồ chơi từ tay bé đưa cho em, bé càng ôm chặt phần còn lại",
  },
  {
    id: "friend_teased", pillar: "emotions", ages: OLDER,
    title: "Bị bạn chê, buồn",
    situation: "Bé đi học về buồn thiu vì bạn chê bức tranh của bé xấu.",
    behavior: "ỉu xìu, giấu bức tranh sau lưng",
    technique: "bố mẹ lắng nghe trọn vẹn, hỏi \"Con thấy bức tranh của con thế nào?\", rồi khen cụ thể sự cố gắng (\"Con tô màu bầu trời kỹ lắm\")",
    takeaway: "Khen sự cố gắng cụ thể, đừng chỉ nói \"đẹp lắm\" — con sẽ tự tin từ bên trong.",
    wrongWay: "bố mẹ gạt đi \"Kệ nó, có gì đâu mà buồn\"",
  },
  {
    id: "i_hate_you", pillar: "emotions", ages: OLDER,
    title: "\"Con ghét mẹ!\"",
    situation: "Bị cấm ăn kem trước bữa tối, bé hét lên \"Con ghét mẹ!\".",
    behavior: "giận đỏ mặt, dậm chân",
    technique: "mẹ không phản ứng gay gắt, ngồi xuống nói \"Mẹ biết con đang rất giận. Mẹ vẫn thương con\", đợi bé dịu rồi ôm bé và nói kem để sau bữa tối",
    takeaway: "Khi con nói \"con ghét mẹ\", con đang nói \"con đang rất giận\" — giữ bình tĩnh và giữ yêu thương.",
    wrongWay: "mẹ phật ý đáp \"Ừ, thế thì thôi\" rồi quay đi, bé càng dậm chân",
  },
  {
    id: "repair_not_sorry", pillar: "emotions", ages: ALL,
    title: "Không chịu xin lỗi em",
    situation: "Bé giành đồ chơi làm em khóc, mẹ bảo xin lỗi thì bé quay mặt đi.",
    behavior: "bướng, khoanh tay, nhưng liếc nhìn em",
    technique: "mẹ không ép nói câu xin lỗi, mà hướng dẫn bé \"sửa sai\": hỏi em có đau không, trả lại đồ chơi, cùng em chơi tiếp",
    takeaway: "Dạy con sửa sai bằng hành động, không chỉ ép nói \"xin lỗi\".",
    wrongWay: "mẹ ép bé nói \"xin lỗi\" ngay, bé nói lí nhí cho xong rồi lại giành đồ",
  },
  {
    id: "first_school_day", pillar: "emotions", ages: ALL,
    title: "Hồi hộp ngày đầu đi học",
    situation: "Tối trước ngày đầu đi học, bé lo lắng không chịu ngủ, nói \"Con không muốn đi học\".",
    behavior: "níu tay bố mẹ, hỏi đi hỏi lại",
    technique: "bố mẹ kể trước cho bé nghe ngày mai sẽ diễn ra thế nào, cùng bé vẽ một \"trái tim dũng cảm\" trong lòng bàn tay để bé nắm lại khi nhớ bố mẹ",
    takeaway: "Kể trước cho con biết điều gì sẽ xảy ra — biết trước là bớt sợ.",
    wrongWay: "bố mẹ nói \"Đi học thì có gì đâu, ngủ ngay!\"",
  },
];

export function findLesson(id: string | undefined | null): ParentingLesson | undefined {
  return id ? PARENTING_LESSONS.find((l) => l.id === id) : undefined;
}

/** Lessons for one pillar that suit the kid's age (all when no age match). */
export function lessonsFor(pillar: LessonPillar, age: KidAge): ParentingLesson[] {
  const inPillar = PARENTING_LESSONS.filter((l) => l.pillar === pillar);
  const fit = inPillar.filter((l) => l.ages.includes(age));
  return fit.length ? fit : inPillar;
}

export const pillarLabel = (pillar: LessonPillar) => LESSON_PILLARS.find((p) => p.id === pillar)?.label ?? pillar;
