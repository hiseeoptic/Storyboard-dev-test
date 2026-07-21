# Golden Baseline — chất lượng 18/07 + khóa an toàn hiện tại

Tag khôi phục: `golden-2026-07-18-quality-v1`

Đây là mốc ổn định lấy cấu trúc prompt gọn và tự nhiên của ngày 18/07 làm nền,
đồng thời giữ các sửa lỗi bắt buộc đã xác nhận sau đó.

## Hợp đồng không được phá vỡ

1. Tên và số lượng nhân vật chỉ lấy từ phần cài đặt của người dùng; không có tên mặc định.
2. Nhân vật có ảnh tải lên dùng ảnh làm nguồn ngoại hình duy nhất. Không mô tả lại mặt,
   dáng, da, tóc, lông mày, lông mi hay trang phục; chỉ loại trừ bề mặt nhựa giả.
3. `spatial_topology` là bản đồ hình học có thẩm quyền: thứ tự vùng, kiến trúc cố định,
   vị trí nhân vật, đường đi và vùng máy quay phải thống nhất.
4. `dialogue.start_sec/end_sec` là đồng hồ số duy nhất. `motion` và `camera` chỉ mô tả
   trình tự, không có giây hay lịch độc lập.
5. Máy quay không quyết định người nói. Máy quay có thể giữ người nói, người nghe hoặc cả
   hai; chỉ chủ nhân được ghi trong dòng thoại mới phát giọng và chuyển động môi.
6. Nhân vật có thể nói khi đang đi, ngồi xuống, đứng dậy hoặc quay người nếu kịch bản/bối
   cảnh tự nhiên; không cấm tuyệt đối. Câu nói phải ngắn, đúng nhịp thở, rõ chủ nhân thoại;
   các câu nặng cảm xúc hoặc nhiều chữ nên ưu tiên tư thế ổn định để tránh sai lip-sync.
7. Chuyển động đời thường phải có vi-cơ học thật: đi tới ghế, xoay hông, hạ trọng tâm,
   gập gối/hông, chạm ghế, ngồi ổn định; đứng dậy thì trồng chân, nghiêng người, chuyển
   trọng lượng, duỗi gối/hông rồi cân bằng lại.
8. Mỗi clip là một cú máy liên tục, một hành động chính, không hard cut, dịch chuyển tức thời
   hay vật/cửa tự thay đổi trạng thái.
9. Giọng của từng nhân vật lấy từ `voice_personality`, mặc định ưu tiên tiếng Việt miền Bắc
   chuẩn khi người dùng không chọn vùng khác; một giọng tại một thời điểm.
10. Prompt Veo giữ ngắn gọn: không lặp prompt bằng nhiều alias, không có các khối khóa mặt
   và giọng toàn cục trùng với dữ liệu nhân vật/dòng thoại.

## Kiểm tra trước khi phát hành

- TypeScript không có lỗi.
- Không còn timecode trong `motion_prompt` hoặc camera beat sau hậu xử lý.
- Các cửa sổ thoại hợp lệ, tuần tự và không chồng lấn.
- Không còn bộ biên dịch camera theo từng giây hoặc luật buộc camera bám người nói.
- JSON vẫn có `characters_in_scene`, `character_lock`, `spatial_topology`, `dialogue`,
  `lip_sync_director_note` và một trường `prompt` để extension sử dụng.

Chạy kiểm tra hồi quy bằng `npm run test:timeline` và `npm run type-check`.

## Cách đối chiếu hoặc khôi phục

Xem đúng trạng thái mốc:

```bash
git show golden-2026-07-18-quality-v1
```

Khi cần khôi phục, hãy tạo một nhánh an toàn từ tag này rồi kiểm tra trước khi đưa vào main:

```bash
git switch -c restore/golden-2026-07-18-quality-v1 golden-2026-07-18-quality-v1
```
