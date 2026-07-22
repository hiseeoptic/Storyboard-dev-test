# Nano Banana Storyboard Pipeline — Tài liệu thiết kế

> **Trạng thái:** Bản thiết kế v1 (trước khi code). Đây là "hợp đồng chung" giữa 2 repo.
> **Ngày:** 2026-07-21
> **Repo liên quan:**
> - `hiseeoptic/Storyboard-dev-test` — app Next.js (người **lập kế hoạch**: viết kịch bản + prompt).
> - `hiseeoptic/flow-extension` — extension Chrome MV3 "AutoFlow Reel" (người **thao tác Flow**).
>
> **Nhánh làm việc (cả 2 repo):** `claude/storyboard-extension-deploy-mv4md0`.
> **Bản production (không đụng tới):** nhánh `main` của cả 2 repo.
>
> File này được đặt **giống hệt** trong `docs/nano-flow-pipeline/` của CẢ HAI repo. Nguồn sự
> thật của cấu trúc dữ liệu là `manifest.schema.json` (cũng nằm trong cả 2 repo, nội dung y hệt).

---

## 0. TL;DR cho người mới vào (hoặc Codex nối tiếp)

- **Vấn đề:** App Storyboard đang tạo ảnh storyboard bằng **Gemini Nano Banana API — TỐN PHÍ** (`src/services/image-pipeline.ts` → `src/lib/gemini/client.ts`). Mỗi ảnh = 1 lượt tính tiền.
- **Giải pháp:** Chuyển việc tạo ảnh sang **Nano Banana MIỄN PHÍ bên trong Google Flow**, do extension tự thao tác. App Storyboard **chỉ còn viết chữ** (kịch bản + prompt), **không render ảnh trả phí** nữa.
- **Cách nối 2 bên:** App Storyboard xuất ra **1 file/luồng dữ liệu chuẩn = "manifest"**. Extension **đọc manifest** rồi tự động: (1) tạo ảnh storyboard bằng Nano Banana → (2) đặt tên theo thứ tự → (3) dùng ảnh đó + ảnh tham chiếu để tạo video.
- **An toàn:** Production (`main` + bản extension trên Chrome Store) **không bị đụng**. Mọi thử nghiệm nằm ở nhánh dev + bản extension DEV load bằng Developer Mode.
- **Nguyên tắc vàng:** *Storyboard = bộ não (100% prompt). Extension = đôi tay (chỉ thao tác, không tự nghĩ prompt).*

---

## 1. Quyết định đã chốt với người dùng (5 câu hỏi + phụ)

| # | Câu hỏi | Chốt |
|---|---|---|
| 1 | Cách chuyển dữ liệu Storyboard → Extension | **Tự động 1 chạm**: click 1 file (hoặc kết nối trực tiếp) → tự nạp hàng loạt. Ưu tiên **kết nối trực tiếp** vì Storyboard đang nằm trong tab/iframe của extension. Có **fallback import file** `.json`. |
| 2 | Data model | `Project → Shot (10s) → Scene`. Mỗi shot mang theo: **ảnh bối cảnh, ảnh nhân vật, ảnh ref, ảnh sản phẩm** (tùy chọn) để đưa vào. |
| 3 | Ai viết prompt Nano Banana | **100% Storyboard viết**. Extension chỉ **đẩy dữ liệu vào**, không sinh prompt. |
| 4 | Ảnh tham chiếu (nhân vật vs bối cảnh) | Khi bấm bắt đầu: **ảnh nhân vật + bối cảnh + sản phẩm được nạp vào bước tạo ảnh storyboard/keyframe**. Sau khi có ảnh storyboard, **mới** lấy ảnh nhân vật/bối cảnh/sản phẩm để hướng dẫn Veo tạo video. ⚠️ Người dùng **lo Veo bị nhầm** khi vừa có keyframe vừa nạp lại bối cảnh/sản phẩm → xem **§6 (tư vấn chi tiết)**. |
| 5 | Nano Banana = UI hay API | Đã xác nhận: là **một MODE/nút trong Flow**; extension **đã tự bấm được** (content_script.js dòng 109, 449) và có cả đường **API nội bộ** (background/inject hook). |
| 6 | Nguồn sự thật extension | `main` = v9.52 (production). Nhánh dev tách từ `main`. Ưu tiên cách làm mà **Codex tham gia được** → tất cả đặc tả nằm trong repo (file này + schema). |
| 7 | Bắt đầu từ đâu | **Viết tài liệu thiết kế trước** (file này) rồi mới code theo mốc. |

---

## 2. Kiến trúc tổng thể — 3 lớp

```
┌─────────────────────────────┐     manifest.json      ┌──────────────────────────────┐
│  LỚP 1: STORYBOARD (bộ não)  │  ───────────────────►  │  LỚP 3: EXTENSION (đôi tay)   │
│  Next.js app                │   (LỚP 2: hợp đồng)     │  AutoFlow Reel (MV3)          │
│                             │                        │                              │
│ • Viết kịch bản             │  • project + assets    │ • Đọc manifest → hàng đợi shot│
│ • Chia đoạn 10s + 3-5 beat  │  • shots[]:            │ • Với mỗi shot:               │
│ • Viết storyboard_prompt    │    - storyboard_prompt │    1. MODE → Nano Banana       │
│ • Viết video_prompt         │    - video_prompt      │    2. đẩy prompt + ref → tạo ảnh│
│ • Khai báo ref cần dùng     │    - image_refs        │    3. đọc ảnh từ gallery + đặt tên│
│ • KHÔNG render ảnh trả phí  │    - video_refs        │    4. MODE → Video             │
│   (biến thành tùy chọn)     │    - characters_in_scene│    5. nạp keyframe + ref → tạo video│
└─────────────────────────────┘                        └──────────────────────────────┘
        repo: Storyboard-dev-test          repo: flow-extension
```

**Lớp 2 (manifest)** là ranh giới hợp đồng. Sửa 1 bên không phá bên kia, miễn là cả 2 tuân theo `manifest.schema.json`. Đây chính là chỗ để **mình và Codex chia việc song song**.

---

## 3. Hợp đồng Manifest (LỚP 2) — cấu trúc dữ liệu cốt lõi

> Đặc tả đầy đủ + kiểu dữ liệu: xem `manifest.schema.json`. Ví dụ thật: `manifest.example.json`.
> Dưới đây là bản giải thích.

```jsonc
{
  "manifest_version": "1.0",
  "generator": "storyboard-ai",
  "generated_at": "2026-07-21T08:00:00Z",

  "project": {
    "project_id": "prj_making_tra_bac",
    "title": "Making Tra Bac",
    "aspect_ratio": "9:16",            // "16:9" | "9:16"
    "dialogue_language": "Vietnamese",
    "total_duration_seconds": 50,
    "thumbnail_title": "TRÀ BẮC CHÍNH GỐC",   // chữ HUGE trên thumbnail (đã có sẵn ở storyboard)
    "social_posts": { /* tiktok / youtube_shorts / facebook_reel — GIỮ NGUYÊN cấu trúc cũ */ }
  },

  // Kho ảnh tham chiếu KHAI BÁO 1 LẦN cho cả dự án. Mỗi shot chỉ trỏ tới id.
  // "image" có thể null: nghĩa là Storyboard chỉ KHAI BÁO khe ảnh, người dùng
  // sẽ tự tải ảnh vào ở phía extension (vd ảnh nhân vật thật/sản phẩm thật).
  "assets": {
    "characters": [
      { "id": "char_lan",  "name": "Lan",  "image": null, "required": true },
      { "id": "char_minh", "name": "Minh", "image": null, "required": true }
    ],
    "environments": [
      { "id": "living_room_1", "name": "Phòng khách", "image": null }
    ],
    "products": [
      { "id": "prod_tra", "name": "Hộp Trà Bắc", "image": null }
    ]
  },

  "shots": [
    {
      "shot_id": "SHOT_001",
      "index": 1,
      "storyboard_name": "Making Tra Bac 1",   // TÊN ảnh khi tạo Nano Banana (đặt theo thứ tự)
      "duration_seconds": 10,
      "marketing_role": "hook",                 // hook|problem|solution|body|cta (đã có ở storyboard)

      // ─── BƯỚC A: TẠO ẢNH STORYBOARD/KEYFRAME bằng Nano Banana (miễn phí) ───
      "storyboard_prompt": "…prompt Storyboard viết sẵn để Nano Banana tạo khung hình…",
      "image_refs": {                           // ref NÀO nạp vào bước tạo ẢNH
        "characters":   ["char_lan", "char_minh"],
        "environments": ["living_room_1"],
        "products":     []
      },

      // ─── BƯỚC B: TẠO VIDEO bằng Veo, dùng ảnh vừa tạo ở bước A ───
      "video_prompt": "…full Veo prompt Storyboard viết sẵn…",
      "characters_in_scene": ["Lan", "Minh"],   // đã có sẵn ở storyboard (quan trọng để attach đúng)
      "video_refs": {                           // ref NÀO nạp vào bước tạo VIDEO (xem §6)
        "use_generated_storyboard": true,       // ảnh Nano vừa tạo = FIRST FRAME
        "characters":   ["char_lan"],           // attach nhân vật làm identity ref
        "environments": [],                      // MẶC ĐỊNH rỗng (đã nằm trong keyframe)
        "products":     []                       // MẶC ĐỊNH rỗng (đã nằm trong keyframe)
      },

      "dialogue": "Trà này pha đúng kiểu Bắc mới ngon.",
      "voice": "achird",                        // map sang voice list của extension
      "beats": [ { "beat": "…", "camera": "…" } ]   // tùy chọn — để tham khảo/hiển thị
    }
  ]
}
```

### Điểm mấu chốt của thiết kế manifest
1. **Tách rõ 2 bước A (ảnh) và B (video)** với 2 khối ref riêng (`image_refs` vs `video_refs`) — đây chính là chỗ giải quyết lo ngại "Veo nhầm" ở §6: bạn kiểm soát chính xác ref nào vào bước nào.
2. **`use_generated_storyboard: true`** = ảnh Nano vừa tạo được dùng làm **frame đầu** của video (khóa bố cục).
3. **Kho `assets` khai báo 1 lần**, shot chỉ trỏ id → không lặp ảnh base64 nặng nề, và người dùng nạp ảnh thật 1 lần dùng cho nhiều shot.
4. **Tương thích ngược:** manifest là **thêm mới**, không phá cấu trúc `buildVeoJson` cũ. Bản production vẫn xuất như cũ.

---

## 4. Thay đổi phía STORYBOARD (repo `Storyboard-dev-test`)

**Giữ nguyên (KHÔNG đụng):** phân tích kịch bản, chia đoạn 10s, sinh 3-5 beat, `character_locks`, `scene_bible`, `world_context`, `social_posts`, `thumbnail_title`. Toàn bộ phần "chữ" đã tốt.

**Việc cần làm:**

### 4.1. Thêm bộ xuất manifest (mới — không phá cái cũ)
- **File mới:** `src/lib/nano-flow/manifest.ts`
  - `export function buildNanoFlowManifest(breakdown: StoryboardGenerationOutput, opts): NanoFlowManifest`
  - Ánh xạ từ `StoryboardGenerationOutput.segments[]` (đã có, `src/types/index.ts`) sang `shots[]`:
    - `segment.first_frame_prompt` → `shot.storyboard_prompt` (prompt tạo ảnh — ĐÃ CÓ SẴN).
    - `segment.full_prompt` (hoặc `buildSegmentVeoPrompt`) → `shot.video_prompt`.
    - `segment.characters_in_scene` → `shot.characters_in_scene` (ĐÃ CÓ).
    - `segment.title`/index → `shot.storyboard_name`, `shot.shot_id`.
  - Suy ra `image_refs` / `video_refs` mặc định từ `characters_in_scene` + `environment_ref` (xem §6 cho quy tắc mặc định).
- **File mới:** `src/types/nano-flow.ts` — khai báo TypeScript của manifest (đồng bộ với `manifest.schema.json`).

### 4.2. Nút Export + Kết nối trực tiếp (UI)
- **Sửa:** `src/app/(dashboard)/generate/generate-client.tsx`
  - Thêm nút **"Xuất cho Extension (Nano Flow)"** cạnh khu export ZIP hiện có (quanh dòng ~1990, chỗ `buildVeoJson`).
  - 2 chế độ:
    - **Tải file** `*.nanoflow.json` (fallback, luôn chạy).
    - **Gửi thẳng sang extension** qua `window.postMessage` (khi Storyboard chạy trong iframe của extension) — dùng lại giao thức đã có (xem §7).

### 4.3. Cho phép BỎ QUA render ảnh trả phí
- **Sửa:** `src/actions/storyboard.ts` (nơi gọi `image-pipeline.ts`)
  - Thêm cờ `skip_paid_images` (hoặc chế độ `imageBackend: "nano_flow" | "gemini_paid"`).
  - Khi bật Nano Flow: **không gọi** `generateBoardImage`/`generateSegmentFrame` (bỏ chi phí Gemini). Chỉ sinh chữ + manifest.
  - **Mặc định giữ nguyên hành vi cũ** để bản production không đổi.

### 4.4. (Tùy chọn) Cấu hình môi trường dev
- App dev nên có nhãn rõ ("DEV / STAGING") + có thể trỏ endpoint riêng. Không bắt buộc cho bước đầu.

---

## 5. Thay đổi phía EXTENSION (repo `flow-extension`)

**Nền tảng đã có sẵn (tái sử dụng, KHÔNG viết lại):**
- Đổi MODE Video ↔ **Nano Banana** — `content_script.js` (dò nút, dòng ~109, ~449).
- Upload/kéo ảnh làm reference — `uploadImageToFlow()` `content_script.js` ~2341.
- Gộp nhiều ref (nhân vật + sản phẩm + storyboard, tối đa 3) — ~2436.
- Đọc thẻ gallery (ảnh/video vừa tạo) — ~635.
- Tạo video hàng loạt qua API — `GEN_BULK` (`sidepanel.js` ~1006, `content_script.js` ~4030, `cfg.storyboard` ~4103).
- Chế độ storyboard + `storyboardItems[]` (`sidepanel.js` ~31, ~69) + nhận dữ liệu ngoài (`VEOFLOW_PUSH_TO_AUTOFLOW`, ~985).

**Việc cần làm (phần lõi mới):**

### 5.1. Import manifest → hàng đợi shot
- **Sửa:** `sidepanel.js`
  - Thêm nút **"Nạp manifest (.nanoflow.json)"** + xử lý `postMessage` từ Storyboard (§7).
  - Hàm mới `loadNanoFlowManifest(manifest)`: validate theo schema → dựng `nanoQueue = [{shot, status}]` → render danh sách shot (tái dùng khối render storyboard hiện có).
  - Cho phép người dùng **nạp ảnh thật vào các `assets` có `image=null`** (nhân vật/sản phẩm/bối cảnh) trước khi chạy.

### 5.2. Bộ máy chạy Nano Storyboard (mới)
- **File mới:** `nano_pipeline.js` (nạp trong `content_script` hoặc gọi qua message) — vòng lặp cho từng shot:
  1. **MODE → Nano Banana** (dùng bộ dò MODE có sẵn).
  2. Đẩy `storyboard_prompt` vào ô prompt.
  3. Đính kèm ref theo `image_refs` (nhân vật → bối cảnh → sản phẩm) — dùng `uploadImageToFlow`.
  4. Bấm Tạo → **chờ ảnh xong** (poll gallery / bắt API response).
  5. **Đọc ảnh vừa tạo** từ gallery → lưu `shot.generated_storyboard = { mediaId, dataUrl }`.
  6. **Đặt tên** theo `storyboard_name` (ưu tiên gắn theo `mediaId` để không lẫn — xem §8, rủi ro nhận nhầm ảnh).
- **Quan trọng:** ưu tiên tóm ảnh theo **`mediaId` từ API response** (đáng tin) hơn là đoán theo thứ tự DOM.

### 5.3. Nối sang bước tạo video
- **Sửa:** `content_script.js` (luồng `GEN_BULK`)
  - Với mỗi shot: **MODE → Video**, đặt ảnh `generated_storyboard` làm **first frame**, đính kèm ref theo `video_refs` (mặc định chỉ nhân vật — xem §6), dán `video_prompt`, chọn model/voice → tạo video.
  - Tái dùng đường API `batchAsyncGenerateVideo*` đã có; phân biệt **frame đầu** vs **reference-entity** (extension đã có `characterMode === 'entity'`, `referenceEntities`).

### 5.4. Tách dữ liệu & nhãn cho bản DEV
- **Sửa:** `manifest.json` (của extension) cho **bản DEV**:
  - `name`: "AutoFlow Reel **DEV** — Nano Storyboard".
  - Prefix khóa `chrome.storage` riêng (vd `dev_`) để **không dùng chung** hàng đợi/nhân vật với bản production.
- Bản production (`main`, Store) **không đổi**.

---

## 6. Tư vấn: Nạp ảnh 2 bước có làm Veo nhầm không? (giải đáp lo ngại câu 4)

**Lo ngại của bạn:** đã có ảnh storyboard/keyframe (đã "bao gồm" nhân vật + bối cảnh + sản phẩm), nếu tới bước video lại nạp **thêm lần nữa** ảnh bối cảnh/sản phẩm → Veo có thể trộn 2 bối cảnh → sai.

**Đánh giá:** Lo ngại này **đúng và quan trọng**. Google Flow phân biệt 2 loại đầu vào khác nhau:
- **Frame ảnh (first/last frame)** = khóa **bố cục & khung hình đầu**. Veo bám gần như tuyệt đối.
- **Reference-entity / "ingredient"** = khóa **danh tính** (mặt người, logo sản phẩm), KHÔNG áp đặt bố cục.

Nếu bạn nạp bối cảnh như một **ảnh thứ hai** ngang hàng keyframe, Veo dễ cố "hòa" 2 khung → sai. Nhưng nếu route đúng kênh thì **không xung đột**.

**Quy tắc khuyến nghị (đưa vào `video_refs` mặc định):**

| Loại ref ở bước VIDEO | Mặc định | Lý do |
|---|---|---|
| **Ảnh Nano vừa tạo (keyframe)** | ✅ **first frame** | Đã chứa bố cục + bối cảnh + nhân vật + sản phẩm. Đây là mỏ neo chính. |
| **Nhân vật** | ✅ attach làm **reference-entity** | Giữ mặt nhất quán suốt 10s chuyển động (keyframe có thể không rõ mặt). Khác kênh với first frame → không đánh nhau. |
| **Bối cảnh** | ❌ **KHÔNG** attach lại | Đã nằm trong keyframe. Nạp lại = rủi ro trộn 2 bối cảnh → đúng nỗi lo của bạn. |
| **Sản phẩm** | ❌ mặc định KHÔNG (bật khi cần) | Chỉ bật nếu cần **độ nét logo/nhãn tuyệt đối**; khi bật thì attach làm **reference-entity**, KHÔNG phải frame thứ hai. |

**Vì sao để dạng bảng bật/tắt trong manifest thay vì cứng:** hành vi Flow là **thực nghiệm** (Google hay đổi). Nên mỗi loại ref là 1 công tắc trong `video_refs` để bạn **A/B test** nhanh shot 3-5 cảnh, tìm combo tốt nhất mà không phải sửa code.

**Kết luận ngắn:** *keyframe = frame đầu (luôn); nhân vật = reference-entity (nên bật); bối cảnh = tắt (đã trong keyframe); sản phẩm = chỉ bật khi cần nét logo.* Đây là mặc định an toàn nhất và Storyboard sẽ sinh `video_refs` theo đúng quy tắc này.

---

## 7. Kết nối trực tiếp Storyboard ⇄ Extension

Storyboard AI đang được **nhúng trong side panel** của extension (`manifest.json` frame-src cho `storyboard*.vercel.app` / `storyboard.nguyenduchoa.com`; `sidepanel.js` có tab iframe + `postMessage`). Đã có sẵn kênh `VEOFLOW_PUSH_TO_AUTOFLOW` (nghe ở `sidepanel.js` ~985, chỉ nhận từ `flowveo.nguyenduchoa.com`).

**Thiết kế:**
- **Kênh chính (trực tiếp):** Storyboard (trong iframe) `postMessage({ source:'STORYBOARD_AI', type:'PUSH_NANO_MANIFEST', payload: manifest }, '*')` → extension `sidepanel.js` lắng nghe, gọi `loadNanoFlowManifest`.
  - **Bảo mật:** extension chỉ chấp nhận `event.origin` thuộc danh sách trắng (thêm origin của Storyboard dev vào cả `host_permissions` lẫn kiểm tra `origin`).
- **Kênh phụ (fallback):** người dùng bấm 1 nút tải `*.nanoflow.json` ở Storyboard rồi kéo/thả (hoặc chọn) vào extension. Luôn hoạt động kể cả khi không nhúng iframe.

Cả 2 kênh cùng đổ về **một hàm** `loadNanoFlowManifest(manifest)` → không phân mảnh logic.

---

## 8. Rủi ro & điểm phải test thực nghiệm

| Rủi ro | Giảm thiểu |
|---|---|
| **Nhận nhầm ảnh vừa tạo** (đọc sai thẻ gallery) | Ưu tiên tóm theo `mediaId` từ API response, không đoán theo DOM/thứ tự. Fallback: chờ ảnh mới nhất + đối chiếu prompt. |
| **Nano Banana đổi UI** (nút/mode di chuyển) | Đã có cơ chế "quét UI/DOM guide" trong extension (`sidepanel.js` scan-ui). Giữ selector linh hoạt + có bản đồ UI cấu hình được. |
| **Veo trộn bối cảnh** (§6) | Mặc định tắt attach bối cảnh ở bước video; công tắc trong `video_refs`. |
| **Giới hạn lượt free Nano Banana** | Chạy theo lô nhỏ (3-5 shot), có nghỉ/nhận diện quota; log rõ. |
| **Chờ ảnh/video lâu, timeout** | Poll có timeout + retry; trạng thái per-shot (pending/generating/done/failed) để chạy lại đúng shot lỗi. |
| **Lẫn dữ liệu DEV ↔ production** | Prefix `chrome.storage` riêng cho bản DEV + tên hiển thị khác + Chrome profile khác. |
| **base64 ảnh nặng khi truyền postMessage** | Kho `assets` khai báo 1 lần; ảnh do người dùng nạp ở phía extension khi có thể, thay vì nhồi vào manifest. |

---

## 9. Mốc công việc (làm tăng dần, chia được cho Codex)

Thứ tự này để **luôn có bản chạy được** và **2 người làm song song** qua ranh giới manifest.

- **M0 — Khung & an toàn (xong trong tài liệu này):** nhánh dev 2 repo, backup (main = production), schema + ví dụ manifest, tài liệu thiết kế. ✅
- **M1 — Storyboard xuất manifest:** §4.1 + §4.2 (buildNanoFlowManifest + nút export/tải file). ✅ **XONG (Claude)** — `src/types/nano-flow.ts`, `src/lib/nano-flow/manifest.ts` (+ test `manifest.test.ts`, 6/6 pass, output đã validate khớp `manifest.schema.json`), và 2 nút "Tải .nanoflow.json" / "Gửi sang Extension" trong `generate-client.tsx`. Còn lại của §4 (cờ `skip_paid_images`) nằm ở M7.
- **M2 — Extension nạp manifest:** §5.1 (import + render hàng đợi shot + nạp ảnh assets). ✅ **XONG (Claude)** — module thuần `nano_manifest.js` (parse/validate/toQueue/missingImages/load) + test `nano_manifest.test.js` (7/7 pass trên `manifest.example.json`); UI trong `sidepanel.html`/`sidepanel.js`: section "⚡ Nano Flow (beta)" với nút Nạp manifest (file), listener nhận **push trực tiếp** từ Storyboard AI (origin allowlist), khôi phục khi mở lại panel, và render hàng đợi shot. *Còn lại của §5.1: cho người dùng nạp ảnh thật vào các `assets` có `image=null` (nút upload per-asset) — làm cùng M3.*
- **M3 — Tạo ảnh Nano Banana từng shot:** §5.2 (vòng lặp MODE→Nano→prompt→ref→tạo). 🟡 **ĐANG LÀM** — đã xong **planner + dry-run** (`nano_pipeline.js` + test 5/5): sắp xếp đúng 2 bước/shot (A: tạo ảnh Nano với ref theo thứ tự nhân vật→cảnh→sản phẩm, đặt tên; B: video dùng ảnh làm khung đầu + ref nhân vật), nút "▶️ Chạy thử (dry-run)" in ra log để kiểm chứng KHÔNG gọi Flow. **Còn thiếu (cần Flow thật):** lời gọi API tạo ảnh Nano Banana (`IMAGE_GENERATION`) + tóm `mediaId` ảnh vừa tạo. `inject.js` đã có sẵn `uploadImageToFlow`→mediaId, `mintRecaptcha('IMAGE_GENERATION')`, và video hỗ trợ `startImageMediaId`/`referenceMediaIds` — chỉ thiếu endpoint/payload tạo ảnh, phải bắt từ 1 phiên Flow thật (dùng tính năng TRACE_CONTROL/afApiTemplate có sẵn).
- **M4 — Tóm & đặt tên ảnh vừa tạo:** §5.2 bước 5-6 (theo `mediaId`). *Kiểm thử: tên đúng thứ tự, không lẫn.*
- **M5 — Tạo video từ ảnh đó:** §5.3 (keyframe = first frame + nhân vật = entity). *Kiểm thử theo §6.*
- **M6 — Chạy chuỗi 3-5 shot → rồi mở rộng.** Tinh chỉnh quota, retry, trạng thái.
- **M7 — Bỏ render ảnh trả phí ở Storyboard:** §4.3 (cờ `skip_paid_images`). ✅ **XONG phần chính (Claude)** — cờ `NANO_FLOW_TEXT_ONLY` trong `generate-client.tsx`: (a) `runBoards` KHÔNG gọi `generateBoardImage` (bỏ chi phí Gemini bảng tổng); (b) ẩn toàn bộ thẻ ảnh ở màn kết quả (character sheet, bảng tổng, thumbnail, khung ảnh + nút Redo/keyframe từng segment). Giữ lại: kịch bản, prompt từng shot + nút Copy, card Xuất Nano Flow, JSON, social posts. `next build` pass. *Còn tùy chọn: dọn nút ZIP ảnh nếu muốn.*
- **M8 — Đóng gói bản DEV extension + nhãn/tách storage:** §5.4.

**Ranh giới chia việc:** M1/M7 (+ một phần M2 phần schema) thuần **Storyboard**. M2-M6/M8 thuần **Extension**. Manifest schema là hợp đồng chung → ai làm bên nào cũng không phá bên kia.

---

## 10. Cách Codex nối tiếp

1. Đọc file này + `manifest.schema.json` + `manifest.example.json` (có trong **cả 2 repo**, nội dung giống hệt).
2. Làm trên nhánh `claude/storyboard-extension-deploy-mv4md0` của repo tương ứng. **Không đụng `main`.**
3. Chọn mốc còn dở ở §9, bám đúng tên file/hàm ở §4-§5.
4. Nếu đổi cấu trúc dữ liệu → **sửa `manifest.schema.json` ở CẢ 2 repo** cho khớp, và ghi chú vào phần "Changelog" cuối file này.
5. Commit nhỏ, rõ; không tự merge sang `main` cho tới khi pipeline chạy ổn thật.

---

## Changelog thiết kế
- **2026-07-21 — v1 (Claude):** Bản thiết kế đầu tiên. Chốt kiến trúc 3 lớp, hợp đồng manifest v1.0, quy tắc ref 2 bước (§6), lộ trình M0-M8.
- **2026-07-22 — M1 xong (Claude):** Storyboard xuất manifest (types + builder + test + nút UI). Không đổi schema.
- **2026-07-22 — M2 xong (Claude):** Extension nạp & hiển thị manifest (`nano_manifest.js` + test + UI Nano Flow trong side panel). Không đổi schema. Bước tiếp theo: **M3** (extension tạo ảnh Nano Banana từng shot) — đây là phần đụng DOM/API Flow, khó nhất; nên để Claude làm hoặc review kỹ nếu Codex làm. Prompt giao việc ở §10.
- **2026-07-22 — Gỡ tải ảnh ở form Storyboard (Claude):** Theo yêu cầu, bỏ toàn bộ widget tải ảnh (ảnh nhân vật + CharacterStudio, ảnh món/nguyên liệu cooking, ảnh sản phẩm, ảnh bối cảnh) khỏi `generate-client.tsx`; **giữ ô nhập mô tả chữ + ô chọn** vì storyboard vẫn cần dữ liệu này để viết prompt. Ảnh tham chiếu từ nay nạp bên extension (Nano Banana). `next build` pass.
- **2026-07-22 — M7 phần chính xong (Claude):** Cờ `NANO_FLOW_TEXT_ONLY = true` — tắt tạo ảnh trả phí (Gemini) trong luồng `/generate` và ẩn mọi thẻ ảnh ở màn kết quả. Storyboard giờ chỉ xuất chữ + prompt + manifest. Muốn khôi phục hành vi cũ: đặt cờ = false.
- **2026-07-22 — Chuyển sang commit thẳng `main` (theo yêu cầu user):** repo `storyboard-dev-test` là bản dự án của user (deploy `hiseeoptic-storyboard-ai.vercel.app`), nên từ đây commit thẳng lên `main` cả 2 repo, không dùng nhánh phụ.
- **2026-07-22 — M3 planner + dry-run (Claude):** `nano_pipeline.js` + test (5/5) + nút "Chạy thử (dry-run)". Live image-gen còn chờ 1 capture từ Flow thật (xem M3 §9).
