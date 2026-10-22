import type { LessonPillar, ParentingLesson } from "../lesson-pillars.ts";
import type { TeenEvidenceSourceId } from "../teen-sources.ts";

type TeenPillar = Exclude<LessonPillar, "toddler" | "preteen">;

interface TeenPillarSpec {
  pillar: TeenPillar;
  label: string;
  method: string;
  coaching: string;
  sourceIds: readonly [TeenEvidenceSourceId, TeenEvidenceSourceId, ...TeenEvidenceSourceId[]];
  topics: readonly string[];
}

const t = (value: string) => value.split("|").map((item) => item.trim());

// Twelve distinct, ordinary Vietnamese moments per area.  The coaching is
// international evidence-informed; the setting and dialogue stay local.
const SPECS: TeenPillarSpec[] = [
  { pillar: "emotions", label: "Cảm xúc", method: "Lắng nghe và xác nhận cảm xúc (UNICEF)", coaching: "gọi tên cảm xúc, nghe hết câu rồi mới cùng con chọn bước tiếp theo", sourceIds: ["unicef_adolescent_parenting_2021", "unicef_vietnam_teen_stress_2021"], topics: t("bị góp ý trước lớp|bạn thân đổi chỗ ngồi|thua cuộc thi của trường|bài đăng ít người phản hồi|kế hoạch cuối tuần bị hủy|lỡ nói nhầm khi thuyết trình|không được chọn vào đội|món đồ yêu thích bị hỏng|nhớ lớp cũ|ngại gặp họ hàng đông người|buồn vì điểm thấp hơn mong đợi|vui quá nói lớn trong nhà") },
  { pillar: "calm", label: "Bình tĩnh", method: "Dừng lại và điều hòa cảm xúc (WHO–UNICEF)", coaching: "nhận tín hiệu căng thẳng, tạm dừng ngắn và quay lại giải quyết khi cả hai đã bình tĩnh", sourceIds: ["who_unicef_hat_2021", "unicef_vietnam_teen_stress_2021"], topics: t("máy tính treo trước hạn nộp bài|em làm ồn lúc con đang học|xếp hàng lâu ở siêu thị|bị đổi lịch vào phút cuối|làm sai câu đã ôn kỹ|tranh luận trong nhóm học tập|mất đồ dùng học tập|mạng chậm khi đang nộp bài|bố mẹ hỏi dồn nhiều câu|không tìm thấy chìa khóa|bị gián đoạn lúc đang tập trung|cả nhà cùng mệt sau một ngày dài") },
  { pillar: "confidence", label: "Tự tin", method: "Ghi nhận nỗ lực và trao quyền thử sức (UNICEF)", coaching: "tách kết quả khỏi giá trị của con, ghi nhận chiến lược và để con tự chọn một thử thách vừa sức", sourceIds: ["unicef_adolescent_parenting_2021", "unicef_vietnam_mental_health"], topics: t("xung phong phát biểu trước khối|tham gia câu lạc bộ mới|đọc bài bằng tiếng Anh|thử môn thể thao mới|gửi tranh dự thi|đứng đầu nhóm thuyết trình|hỏi lại khi chưa hiểu bài|biểu diễn nhạc cụ trước nhà|tự giới thiệu với bạn mới|nộp ý tưởng cho lớp|thử làm món ăn đơn giản|nhận nhiệm vụ lớp chưa từng làm") },
  { pillar: "connection", label: "Gắn kết", method: "Thời gian chất lượng và trò chuyện không phán xét (PLH Teens)", coaching: "tạo một khoảng thời gian ngắn không thiết bị, theo sở thích của con và không biến nó thành buổi kiểm tra", sourceIds: ["who_plh_teens", "unicef_vietnam_teen_stress_2021"], topics: t("cùng đi mua đồ ăn sáng|gấp quần áo rồi trò chuyện|đi bộ quanh khu nhà|con mở cho mẹ nghe một bài hát|bố học một trò con thích|nấu bữa tối cuối tuần|cùng chăm góc cây nhỏ|xem lại ảnh gia đình|con kể chuyện trên đường về|hai bố con sửa chiếc kệ|mẹ nhờ con dạy dùng ứng dụng|cả nhà có mười phút không màn hình") },
  { pillar: "routines", label: "Thói quen", method: "Cùng lập lịch và thống nhất trách nhiệm (PLH Teens)", coaching: "để con tham gia thiết kế lịch, chọn tín hiệu nhắc và tự đánh giá sau một tuần", sourceIds: ["who_plh_teens", "unicef_vietnam_teen_stress_2021"], topics: t("chuẩn bị cặp từ tối hôm trước|dậy đúng giờ ngày đi học|chia giờ học và giờ nghỉ|để đồ đúng chỗ khi về nhà|hoàn thành việc nhà đã nhận|tắt thiết bị trước giờ ngủ|chuẩn bị quần áo cho sáng mai|theo dõi hạn nộp bài|ăn sáng trước khi đi học|giữ bàn học dễ sử dụng|ôn bài theo từng chặng ngắn|duy trì lịch cuối tuần linh hoạt") },
  { pillar: "eating", label: "Ăn uống", method: "Nề nếp bữa ăn tích cực và quyền lựa chọn phù hợp (WHO–UNICEF)", coaching: "giữ bữa ăn không phán xét, cho con chọn trong các phương án sẵn có và chú ý năng lượng cho học tập", sourceIds: ["who_vietnam_gshs_2019", "who_unicef_hat_2021"], topics: t("bỏ bữa sáng vì vội|chỉ muốn ăn một món quen|ăn vội để quay lại học|quên mang bình nước|không muốn thử món mới|mua đồ ăn theo bạn|ăn riêng vì lịch học lệch|vừa ăn vừa xem điện thoại|muốn tự chuẩn bị bữa phụ|phụ lên thực đơn cuối tuần|ăn ít khi đang căng thẳng|chia phần ăn công bằng với em") },
  { pillar: "teen", label: "Tuổi teen", method: "Tôn trọng năng lực đang phát triển của thanh thiếu niên (UNCRC–UNICEF)", coaching: "công nhận con đang lớn, hỏi ý kiến thật và tăng quyền tự quyết cùng trách nhiệm theo từng bước", sourceIds: ["crc_general_comment_20_2016", "unicef_adolescent_parenting_2021"], topics: t("muốn được gõ cửa trước khi vào phòng|trả lời ngắn sau giờ học|muốn tự chọn kiểu tóc gọn gàng|không muốn bố mẹ kể chuyện mình trước họ hàng|xin tự sắp xếp góc học tập|muốn được hỏi ý kiến về kế hoạch nhà|ngại bố mẹ gọi biệt danh trước bạn|muốn tự chọn hoạt động cuối tuần|cần thời gian yên tĩnh sau ngày dài|muốn giữ một cuốn nhật ký riêng|xin tự quản tiền tiêu vặt|muốn tự giải thích lỗi của mình") },
  { pillar: "independence", label: "Tự lập", method: "Trao quyền theo bậc thang và kiểm tra lại (UNICEF)", coaching: "giao một phần việc rõ ràng, thống nhất điểm kiểm tra và để con tự làm trước khi người lớn hỗ trợ", sourceIds: ["unicef_adolescent_parenting_2021", "crc_general_comment_20_2016"], topics: t("tự đi bộ sang thư viện gần nhà|tự đặt báo thức|tự chuẩn bị đồ cho chuyến đi|gọi hỏi thông tin lớp học|tự giặt bộ đồng phục|lập danh sách đồ cần mua|tự nấu món không dùng lửa|sắp lịch ôn kiểm tra|tự giữ thẻ thư viện|chăm em trong lúc mẹ ở phòng bên|tự xử lý món đồ bị thất lạc|chủ động xin trợ giúp khi cần") },
  { pillar: "screens", label: "Màn hình", method: "Kế hoạch truyền thông gia đình cùng xây dựng (AAP)", coaching: "xem chất lượng và hoàn cảnh sử dụng, bảo vệ giấc ngủ rồi cùng thống nhất quy tắc áp dụng cho cả nhà", sourceIds: ["aap_digital_ecosystems_2026", "unicef_cyberbullying"], topics: t("điện thoại làm trễ giờ ngủ|vừa học vừa mở nhiều ứng dụng|nhóm lớp nhắn liên tục|video ngắn kéo dài quá dự định|tranh luận về giờ chơi game|thiết bị xuất hiện trong bữa cơm|xin cài một ứng dụng mới|không muốn cho bố mẹ xem mọi tin nhắn|gặp bình luận làm con khó chịu|chia sẻ ảnh bạn khi chưa hỏi|tin một thông tin chưa kiểm chứng|cả nhà cùng sửa quy tắc màn hình") },
  { pillar: "behavior", label: "Hành vi", method: "Cùng giải quyết vấn đề thay vì trừng phạt (PLH Teens)", coaching: "mô tả hành vi không gắn nhãn con người, tìm nguyên nhân và thống nhất cách sửa có thể thực hiện", sourceIds: ["who_plh_teens", "unicef_adolescent_parenting_2021"], topics: t("đóng cửa mạnh khi bực|hứa rồi quên việc nhà|nói chen khi cả nhà bàn việc|để đồ dùng chung bừa bộn|trì hoãn đến sát hạn|đổ lỗi khi mắc lỗi|bỏ đi giữa cuộc nói chuyện|cằn nhằn khi bị nhắc|làm qua loa phần việc của mình|tự ý đổi kế hoạch gia đình|giấu thông báo của trường|phản ứng căng thẳng vì đang mệt") },
  { pillar: "words", label: "Giao tiếp", method: "Lắng nghe chủ động và câu nói tôn trọng (UNICEF)", coaching: "dùng câu bắt đầu bằng điều mình quan sát và cần, phản hồi lại ý của người kia trước khi nêu quan điểm", sourceIds: ["unicef_adolescent_parenting_2021", "unicef_vietnam_teen_stress_2021"], topics: t("nói điều không đồng ý với bố|xin mẹ nghe hết câu|góp ý cho anh chị|từ chối một lời nhờ chưa phù hợp|xin lỗi mà không biện minh|hỏi lại thay vì đoán ý|nói nhu cầu được yên tĩnh|đề nghị đổi lịch việc nhà|phản hồi khi bị hiểu nhầm|nhắn tin rõ ràng trong nhóm lớp|trình bày mong muốn với giáo viên|kết thúc tranh luận bằng lời hẹn quay lại") },
  { pillar: "manners", label: "Lễ phép", method: "Làm mẫu tôn trọng hai chiều (PLH Teens)", coaching: "người lớn làm mẫu cách chào hỏi và góp ý, giải thích theo bối cảnh thay vì buộc con biểu diễn sự ngoan ngoãn", sourceIds: ["who_plh_teens", "crc_general_comment_20_2016"], topics: t("chào khách khi đang dở bài|cảm ơn người giao hàng|xin phép rời bàn ăn|nhường lời cho người khác|gọi điện hỏi thăm ông bà|trả lời khi người lớn hỏi|giữ giọng vừa phải nơi chung|xin lỗi vì đến muộn|đón bạn đến nhà|tôn trọng quy tắc nhà người khác|giới thiệu người mới với gia đình|góp ý mà không mỉa mai") },
  { pillar: "honesty", label: "Trung thực", method: "An toàn để nói thật và sửa sai (UNICEF)", coaching: "giảm phản ứng khiến con sợ, cảm ơn việc nói thật rồi tập trung vào khắc phục và trách nhiệm", sourceIds: ["unicef_adolescent_parenting_2021", "who_plh_teens"], topics: t("làm mất sách mượn|quên nộp bài đúng hạn|lỡ làm hỏng đồ của em|dùng quá số tiền đã thống nhất|nói chưa đúng về điểm kiểm tra|sao chép một đoạn khi làm bài|đến muộn nhưng ngại nói lý do|nhận phần công của bạn|che giấu việc chưa hoàn thành|hứa giúp rồi lại quên|thấy tiền thừa khi mua hàng|thừa nhận mình đã hiểu nhầm") },
  { pillar: "respect", label: "Tôn trọng", method: "Phẩm giá, quyền tham gia và khác biệt (UNCRC)", coaching: "tách khác biệt khỏi phán xét, mời từng người nói và giữ ranh giới không xúc phạm", sourceIds: ["crc_general_comment_20_2016", "unicef_adolescent_parenting_2021"], topics: t("bạn có sở thích khác mình|người nhà nói giọng vùng khác|em học chậm hơn|bạn mới ít nói|ông bà dùng công nghệ chậm|ý kiến trong nhóm bị thiểu số|không thích câu đùa về người khác|bạn mặc đồ khác số đông|mỗi người cần mức yên tĩnh khác nhau|tranh luận mà không công kích|xin phép trước khi dùng đồ của nhau|không đăng chuyện riêng của người thân") },
  { pillar: "family", label: "Gia đình", method: "Kết nối liên thế hệ và phân vai rõ ràng (PLH Teens)", coaching: "để mỗi thế hệ nói nhu cầu, thống nhất vai trò và tạo một việc nhỏ cùng làm thay vì buộc con đứng về phe", sourceIds: ["who_plh_teens", "unicef_vietnam_teen_stress_2021"], topics: t("ông bà nhắc lại một chuyện nhiều lần|cả nhà khác ý về giờ ăn|con phụ chuẩn bị ngày giỗ|chia lịch thăm nội ngoại|giúp ông bà dùng điện thoại|giữ yên tĩnh khi người nhà nghỉ|đón họ hàng ở xa|chia việc khi nhà có khách|bố mẹ bận hơn thường lệ|anh em dùng chung không gian|cả nhà chọn hoạt động cuối tuần|nói lời cảm ơn một người thân") },
  { pillar: "social", label: "Bạn bè", method: "Kỹ năng quan hệ và giải quyết vấn đề (WHO–UNICEF)", coaching: "nghe câu chuyện từ góc nhìn của con, phân biệt điều con kiểm soát được và tập một câu phản hồi tôn trọng", sourceIds: ["who_unicef_hat_2021", "unicef_cyberbullying"], topics: t("bạn đổi nhóm làm bài|không được mời vào cuộc trò chuyện|bạn mượn đồ chưa trả|hai bạn cùng muốn con đứng về phía mình|bạn hay đến trễ|nhóm có một bạn ít được nghe|lỡ kể chuyện bạn giao riêng|muốn làm quen bạn lớp bên|bị trêu vì sở thích|bạn gửi tin nhắn cụt ngủn|muốn rời một nhóm gây mệt|cùng bạn sửa hiểu lầm") },
  { pillar: "empathy", label: "Đồng cảm", method: "Nhìn từ góc nhìn người khác và hành động nhỏ (WHO–UNICEF)", coaching: "hỏi người kia có thể đang cảm thấy gì, kiểm tra giả định rồi chọn một hành động giúp đỡ vừa sức", sourceIds: ["who_unicef_hat_2021", "unicef_adolescent_parenting_2021"], topics: t("em lo ngày đầu đến lớp|bạn buồn vì chuyển nhà|mẹ về muộn và mệt|bố làm hỏng món đang sửa|ông quên một cuộc hẹn|bạn bị bỏ lại trong hoạt động nhóm|cô lao công đang dọn hành lang|người giao hàng gặp trời mưa|bạn mới chưa biết nội quy|em làm vỡ đồ rồi sợ|hàng xóm cần giữ yên tĩnh|người nhà có một ngày không thuận lợi") },
  { pillar: "school", label: "Trường lớp", method: "Mục tiêu vừa sức và phối hợp với nhà trường (UNICEF–WHO)", coaching: "xác định một khó khăn cụ thể, để con chọn bước nhỏ và liên hệ người lớn ở trường khi cần", sourceIds: ["who_unicef_hat_2021", "unicef_vietnam_mental_health"], topics: t("nhiều bài dồn cùng tuần|ngại hỏi giáo viên|nhóm phân công chưa đều|quên lịch hoạt động trường|chuyển chỗ ngồi mới|chuẩn bị kỳ kiểm tra|không hiểu tiêu chí bài tập|mất tập trung trong giờ cuối|mâu thuẫn khi làm dự án|chọn câu lạc bộ phù hợp|xin gia hạn một nhiệm vụ chính đáng|tự đánh giá sau học kỳ") },
  { pillar: "play", label: "Vui chơi", method: "Hoạt động vui, vận động và kết nối (WHO–UNICEF)", coaching: "coi vui chơi là phần của sức khỏe, cùng con cân bằng lịch và ghi nhận tinh thần tham gia hơn thành tích", sourceIds: ["who_unicef_hat_2021", "unicef_vietnam_mental_health"], topics: t("tập một động tác thể thao mới|vẽ mà không cần thi|chơi cờ cùng bố|học một bài nhạc|làm đồ thủ công từ vật liệu cũ|tham gia trò chơi tập thể|chơi ngoài trời sau giờ học|tổ chức tối đố vui gia đình|thử chụp ảnh thiên nhiên|luyện một tiết mục với bạn|chơi cùng em theo luật đơn giản|nghỉ ngơi mà không thấy có lỗi") },
  { pillar: "learning", label: "Học tập", method: "Học chủ động, chia nhỏ và phản hồi quá trình (UNICEF)", coaching: "hỏi con đã thử cách nào, chia nhiệm vụ thành bước nhỏ và để con tự chọn chiến lược tiếp theo", sourceIds: ["unicef_adolescent_parenting_2021", "unicef_vietnam_mental_health"], topics: t("bài dài chưa biết bắt đầu đâu|học từ lỗi trong bài kiểm tra|tìm nguồn cho bài thuyết trình|ghi nhớ bằng sơ đồ|học cùng bạn có nguyên tắc|xin phản hồi thay vì chỉ hỏi điểm|thử giải theo hai cách|tự đặt câu hỏi khi đọc|ôn lại sau một tuần|dùng thời gian nghỉ hợp lý|giải thích bài cho người khác|ghi lại điều mình đã tiến bộ") },
  { pillar: "thinking", label: "Tư duy", method: "Tư duy phản biện và quyền nêu quan điểm (UNESCO–UNCRC)", coaching: "hỏi bằng chứng, nguồn và góc nhìn khác; người lớn không đưa đáp án trước khi con tự lập luận", sourceIds: ["unesco_miltiverse_2024", "crc_general_comment_20_2016"], topics: t("tin lan nhanh trong nhóm lớp|hai nguồn nói khác nhau|quảng cáo hứa điều quá tốt|ảnh bị cắt khỏi bối cảnh|con đổi ý sau khi có dữ kiện|lập luận có nhiều giả định|phân biệt sự kiện và ý kiến|hỏi ai được lợi từ thông tin|tìm nguồn gốc một con số|đối chiếu hai cách giải quyết|nhận ra mình chỉ nghe một phía|trình bày quan điểm kèm lý do") },
  { pillar: "nature", label: "Thiên nhiên", method: "Học qua hành động và trách nhiệm cộng đồng (UNESCO)", coaching: "để con quan sát vấn đề gần nhà, chọn hành động đo được và xem lại tác động thay vì giảng khẩu hiệu", sourceIds: ["unesco_miltiverse_2024", "crc_general_comment_20_2016"], topics: t("phân loại rác trong một tuần|mang bình nước cá nhân|chăm cây ở ban công an toàn|đo lượng điện phòng học|nhặt rác sau buổi dã ngoại|tìm hiểu cây bản địa|dùng lại giấy một mặt|sửa món đồ thay vì bỏ|lập góc đổi sách cũ|quan sát chim ở công viên|giảm đồ dùng một lần|chia sẻ ý tưởng xanh với lớp") },
  { pillar: "pets", label: "Thú cưng", method: "Trách nhiệm đều đặn và chăm sóc có giám sát (PLH Teens)", coaching: "thống nhất việc chăm sóc cụ thể, lịch kiểm tra của người lớn và ưu tiên an toàn của cả con lẫn vật nuôi", sourceIds: ["who_plh_teens", "unicef_adolescent_parenting_2021"], topics: t("quên cho mèo ăn đúng giờ|chó cần được dắt cùng người lớn|dọn góc ở của thú cưng|chuẩn bị nước trước khi ra ngoài|nhận biết khi vật nuôi cần nghỉ|không trêu vật nuôi đang ăn|chia việc chăm thú cưng với em|lập danh sách đồ cần mua|giữ cửa an toàn khi có khách|học cách tiếp cận vật nuôi lạ|theo dõi lịch chăm sóc|cân nhắc trách nhiệm trước khi xin nuôi") },
  { pillar: "travel", label: "Du lịch", method: "Lập kế hoạch chung và tăng tự lập an toàn (UNICEF)", coaching: "cho con phụ trách một phần kế hoạch trong giới hạn rõ ràng, có phương án liên lạc và điểm gặp của gia đình", sourceIds: ["unicef_adolescent_parenting_2021", "cdc_parental_monitoring_2024"], topics: t("tự chuẩn bị danh sách hành lý|chọn một điểm cả nhà cùng thích|giữ giấy tờ bản sao với bố mẹ|thống nhất điểm gặp khi tách nhóm|xem dự báo thời tiết trước chuyến đi|lập ngân sách quà nhỏ|tìm hiểu quy tắc nơi tham quan|để thời gian nghỉ trong lịch|giúp em chuẩn bị đồ|ghi lại một điều mới học|tôn trọng văn hóa địa phương|kiểm tra lại đồ trước khi về") },
  { pillar: "money", label: "Tiền bạc", method: "Lập kế hoạch, lựa chọn và hiểu rủi ro (OECD)", coaching: "để con phân biệt cần và muốn, lập ngân sách nhỏ, đối chiếu lựa chọn và tự xem lại quyết định", sourceIds: ["oecd_youth_finance_2023", "who_plh_teens"], topics: t("chia tiền tiêu vặt theo tuần|tiết kiệm cho món đồ đã chọn|đối chiếu giá trước khi mua|nhận ra chiêu khuyến mại|ghi lại khoản chi nhỏ|góp quỹ lớp minh bạch|mua quà trong ngân sách|lỡ tiêu quá kế hoạch|phân biệt mượn và được cho|giữ hóa đơn khi mua đồ|đặt mục tiêu tiết kiệm chung|nói không với lời rủ góp tiền mơ hồ") },
  { pillar: "seasons", label: "Lễ Tết", method: "Tham gia gia đình với quyền lựa chọn phù hợp tuổi (UNCRC–UNICEF)", coaching: "giải thích ý nghĩa, cho con chọn một vai trò thật và tôn trọng lúc con cần nghỉ khỏi không khí đông người", sourceIds: ["crc_general_comment_20_2016", "unicef_adolescent_parenting_2021"], topics: t("phụ gói quà Tết|lên lịch thăm hai bên gia đình|chúc Tết bằng lời của mình|quản lý tiền mừng tuổi|chuẩn bị mâm cơm cùng bố mẹ|hỏi ông bà về một phong tục|giữ thời gian học trong kỳ nghỉ|đón khách mà vẫn có khoảng nghỉ|tham gia dọn nhà theo phần việc|chụp ảnh sau khi mọi người đồng ý|chia quà công bằng cho các em|viết lời cảm ơn cuối năm") },
  { pillar: "public", label: "Nơi công cộng", method: "Tự chủ có kế hoạch và quan tâm cộng đồng (CDC–UNICEF)", coaching: "thống nhất trước quy tắc, điểm liên lạc và để con tự xử lý phần phù hợp trong tầm quan sát của người lớn", sourceIds: ["cdc_parental_monitoring_2024", "unicef_adolescent_parenting_2021"], topics: t("xếp hàng ở quầy đông|giữ giọng vừa phải trên xe buýt|nhường chỗ khi phù hợp|hỏi nhân viên khi cần chỉ dẫn|giữ đồ cá nhân ở thư viện|đọc bảng quy tắc nơi tham quan|đi cùng nhóm ở trung tâm thương mại|thống nhất điểm gặp với bố mẹ|xử lý khi lạc khỏi tầm mắt|giữ sạch chỗ ngồi chung|tôn trọng người đang làm việc|báo người lớn khi thấy tình huống bất thường") },
  { pillar: "safety", label: "An toàn", method: "Nhận diện rủi ro, kế hoạch nếu–thì và tìm người lớn tin cậy (UNICEF–CDC)", coaching: "cùng con tập trước một kế hoạch nếu–thì, thông tin liên lạc và cách tìm người lớn đáng tin khi tình huống thay đổi", sourceIds: ["cdc_parental_monitoring_2024", "who_unicef_hat_2021"], topics: t("đội mũ bảo hiểm đúng cách khi ngồi sau|qua đường tại nơi có vạch|biết số điện thoại của bố mẹ|khóa cửa khi ở nhà cùng anh chị|không mở cửa cho người chưa rõ|kiểm tra lối ra ở nơi đông|gọi người lớn khi thiết bị có mùi lạ|dừng lại khi thời tiết chuyển xấu|mang thẻ thông tin khi đi xa|thống nhất người đón sau giờ học|giữ khoảng cách ở công trình|biết nơi tìm trợ giúp công cộng") },
];

const SPEC_BY_PILLAR = new Map<TeenPillar, TeenPillarSpec>(SPECS.map((spec) => [spec.pillar, spec]));

/**
 * Attach an auditable, topic-matched evidence trail to a hand-written teen
 * lesson.  This deliberately replaces an unsourced technique label rather
 * than presenting a book/programme name as if it were a verified citation.
 */
export function withTeenEvidence(lesson: ParentingLesson): ParentingLesson {
  const spec = SPEC_BY_PILLAR.get(lesson.pillar as TeenPillar);
  if (!spec || !lesson.ages.includes("teen")) throw new Error(`${lesson.id} is not a supported teen lesson`);
  return { ...lesson, method: spec.method, sourceIds: [...spec.sourceIds] };
}

const BEHAVIOURS = [
  "nhún vai nói \"Con biết rồi\" nhưng vẫn đứng lại nghe",
  "thở dài, nhìn sang chỗ khác rồi nói thật điều mình đang vướng",
  "vừa xoay cây bút vừa đưa ra ba lý do rất nghiêm túc",
  "trả lời ngắn lúc đầu, sau câu hỏi mở thì kể một mạch",
  "đặt điện thoại xuống, khoanh tay chờ bố mẹ phản ứng",
  "cố tỏ ra bình thường nhưng liên tục nhìn nét mặt của mẹ",
  "ngồi tựa cửa, im vài giây rồi chủ động đề nghị một cách giải quyết",
  "nói hơi nhanh vì sốt ruột, sau đó tự sửa lại câu cho rõ",
  "cười ngượng, thú nhận mình chưa biết bắt đầu từ đâu",
  "đưa ra một phương án táo bạo rồi hỏi bố mẹ thấy chỗ nào chưa ổn",
  "ban đầu phản đối, nhưng dịu xuống khi được hỏi ý kiến thật",
  "nói cảm ơn rất nhỏ sau khi hai bên tìm được tiếng nói chung",
] as const;

const TECHNIQUES = [
  (topic: string, coaching: string) => `bố mẹ nói lại điều vừa nghe về chuyện ${topic}, rồi ${coaching}; con chọn một việc nhỏ sẽ làm ngay và hẹn lúc xem lại`,
  (topic: string, coaching: string) => `mẹ không hỏi dồn về chuyện ${topic}; mẹ dùng một câu hỏi mở, nghe hết câu, rồi ${coaching}; mẹ nhắc lại kế hoạch bằng đúng lời của con`,
  (topic: string, coaching: string) => `bố công nhận con muốn được tự chủ trong chuyện ${topic}; bố nêu giới hạn an toàn, rồi ${coaching}; hai bố con chốt hai lựa chọn đều chấp nhận được`,
  (topic: string, coaching: string) => `cả nhà viết vấn đề ${topic} thành một câu không đổ lỗi; từng người nói một nhu cầu, rồi ${coaching}; con chọn phương án thử trong ba ngày`,
  (topic: string, coaching: string) => `mẹ chọn lúc cả hai bình tĩnh để nói về ${topic}; mẹ mô tả điều quan sát được thay vì gắn nhãn, rồi ${coaching}; hai bên thống nhất tín hiệu nhắc ngắn`,
  (topic: string, coaching: string) => `bố làm mẫu bước đầu của việc ${topic}, sau đó lùi lại để con thử; bố chỉ hỗ trợ khi con hỏi và ${coaching}; cuối cùng hai người cùng rút một kinh nghiệm`,
  (topic: string, coaching: string) => `mẹ hỏi \"Nếu việc ${topic} xảy ra lần nữa thì con muốn làm gì trước?\"; hai mẹ con lập kế hoạch nếu–thì, rồi ${coaching}; con tự nhắc lại kế hoạch`,
  (topic: string, coaching: string) => `bố mẹ chia chuyện ${topic} thành ba mức trách nhiệm; con tự làm mức đầu, báo lại ở điểm đã hẹn, rồi ${coaching}; quyền tự chủ tăng khi con giữ thỏa thuận`,
  (topic: string, coaching: string) => `sau trục trặc về ${topic}, mẹ cảm ơn con đã quay lại nói chuyện; hai người tập trung vào sửa hậu quả, rồi ${coaching}; không ai nhắc lại lỗi để châm chọc`,
  (topic: string, coaching: string) => `bố chỉ ra một chiến lược con đã làm tốt trong chuyện ${topic}, hỏi con muốn cải thiện điều gì, rồi ${coaching}; lời khen hướng vào nỗ lực cụ thể`,
  (topic: string, coaching: string) => `mẹ hẹn một cuộc kiểm tra năm phút về chuyện ${topic} sau vài ngày; đến hẹn mẹ hỏi điều gì hiệu quả trước, rồi ${coaching}; kế hoạch được chỉnh cùng con`,
  (topic: string, coaching: string) => `bố mẹ mời con giải thích cách người lớn nên hiểu chuyện ${topic}; bố mẹ nghe và hỏi lại cho rõ, rồi ${coaching}; con cũng nêu phần trách nhiệm của mình`,
] as const;

const WRONG_WAYS = [
  "bố mẹ lập tức bảo chuyện đó chẳng đáng để bận tâm; con ngừng kể",
  "mẹ hỏi dồn rồi tự kết luận trước khi con nói xong; con chỉ còn trả lời cho có",
  "bố dùng quyền người lớn để chốt mọi việc; con làm đối phó và không học được cách quyết định",
  "cả nhà tranh nhau chứng minh ai đúng; vấn đề ban đầu vẫn nguyên",
  "mẹ gắn nhãn con lười hoặc bướng; con chuyển sang bảo vệ mình thay vì sửa việc",
  "bố làm thay cho nhanh rồi than rằng con không biết tự lập",
  "mẹ chỉ cảnh báo điều xấu nhưng không cùng con chuẩn bị một bước cụ thể",
  "bố mẹ giao toàn bộ trách nhiệm một lần rồi thất vọng khi con chưa làm trọn",
  "người lớn nhắc lại lỗi cũ để thắng cuộc nói chuyện; con không còn muốn sửa sai",
  "bố chỉ khen con thông minh hoặc chê kết quả; con không biết chiến lược nào cần giữ",
  "mẹ đặt quy tắc rồi không bao giờ xem lại; thỏa thuận nhanh chóng mất tác dụng",
  "bố mẹ nói rằng đã biết con nghĩ gì; con cảm thấy ý kiến của mình chỉ là hình thức",
] as const;

function makeLesson(spec: TeenPillarSpec, index: number, topic: string): ParentingLesson {
  const n = index + 1;
  return {
    id: `teen_${spec.pillar}_${String(n).padStart(2, "0")}`,
    pillar: spec.pillar,
    ages: ["teen"],
    title: `${spec.label}: ${topic[0]!.toUpperCase()}${topic.slice(1)}`,
    situation: `Trong một ngày bình thường của gia đình Việt Nam, con 13–15 tuổi gặp chuyện ${topic}; bố mẹ nhận ra đây là lúc vừa giữ giới hạn vừa để con tập tự chủ.`,
    behavior: BEHAVIOURS[index]!,
    technique: TECHNIQUES[index]!(topic, spec.coaching),
    takeaway: `${spec.coaching[0]!.toUpperCase()}${spec.coaching.slice(1)} — tuổi teen hợp tác tốt hơn khi có tiếng nói và trách nhiệm rõ ràng.`,
    wrongWay: WRONG_WAYS[index]!,
    method: spec.method,
    sourceIds: [...spec.sourceIds],
  };
}

export const TEEN_LESSONS: ParentingLesson[] = SPECS.flatMap((spec) => {
  if (spec.topics.length !== 12) throw new Error(`${spec.pillar} must have exactly 12 teen topics`);
  return spec.topics.map((topic, index) => makeLesson(spec, index, topic));
});

