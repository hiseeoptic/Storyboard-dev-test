"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronLeft,
  RotateCw,
  Users,
  Package,
  MapPin,
  Globe,
  Copy,
  Check,
  Download,
  Film,
  Image as ImageIcon,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import {
  generateStoryboardPlan,
  generateBoardImage,
  finalizeScript,
  type StoryboardResult,
  type StoryboardAnalysis,
} from "@/actions";
import { CharacterStudio } from "./character-studio";
import type {
  StoryboardStyle,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  ImageReference,
  AIProvider,
  ImageQuality,
  AspectRatio,
  VideoGoal,
} from "@/types";

// ─── Bilingual Labels ──────────────────────────────────────────────────────

type Lang = "vi" | "en";

const t = {
  // Page
  pageTitle: { vi: "Tạo Storyboard", en: "Create Storyboard" },
  pageSubtitle: {
    vi: "Mô tả câu chuyện, tải ảnh tham chiếu lên và AI sẽ tạo storyboard hoàn chỉnh",
    en: "Describe your story, upload references, and AI generates a complete storyboard",
  },

  // Steps
  steps: {
    vi: ["Câu chuyện", "Nhân vật", "Sản phẩm", "Bối cảnh", "Phong cách"],
    en: ["Story", "Characters", "Products", "Background", "Style"],
  },

  // Step 1: Story
  storyIdea: { vi: "Ý tưởng / Concept video *", en: "Idea / Video concept *" },
  storyIdeaPlaceholder: {
    vi: "VD: Quảng cáo nồi chiên không dầu — một bà mẹ bận rộn nấu bữa tối ngon lành cho con chỉ trong 15 phút...",
    en: "e.g. Air fryer ad — a busy mom cooks a delicious dinner for her kid in just 15 minutes...",
  },
  genre: { vi: "Thể loại", en: "Genre" },
  productBriefTitle: { vi: "Thông tin sản phẩm (cho TVC quảng cáo)", en: "Product brief (for TVC ads)" },
  productBriefHint: {
    vi: "Điền để AI dựng kịch bản quảng cáo bám sát sản phẩm. Không bắt buộc nếu chỉ làm phim kể chuyện.",
    en: "Fill in so the AI builds an ad script around your product. Optional for non-ad stories.",
  },
  productName: { vi: "Tên sản phẩm / dịch vụ", en: "Product / service name" },
  productNamePlaceholder: { vi: "VD: Nồi chiên không dầu XYZ", en: "e.g. XYZ Air Fryer" },
  sellingPoints: { vi: "Điểm bán hàng nổi bật (USP)", en: "Key selling points (USP)" },
  sellingPointsPlaceholder: {
    vi: "VD: Tiết kiệm 80% dầu, nấu nhanh 15 phút, dễ vệ sinh",
    en: "e.g. 80% less oil, 15-min cooking, easy to clean",
  },
  targetAudience: { vi: "Khách hàng mục tiêu", en: "Target audience" },
  targetAudiencePlaceholder: { vi: "VD: Mẹ bỉm sữa 25-40 tuổi, bận rộn", en: "e.g. Busy moms aged 25-40" },
  keyMessage: { vi: "Thông điệp chính", en: "Key message" },
  keyMessagePlaceholder: { vi: "VD: Bữa ngon cho cả nhà chỉ trong 15 phút", en: "e.g. A tasty meal for the family in 15 minutes" },
  callToAction: { vi: "Kêu gọi hành động (CTA)", en: "Call to action (CTA)" },
  callToActionPlaceholder: { vi: "VD: Đặt mua ngay hôm nay, giảm 30%", en: "e.g. Order today, 30% off" },
  setting: { vi: "Bối cảnh", en: "Setting" },
  settingPlaceholder: { vi: "Chọn bối cảnh...", en: "Choose a setting..." },
  settingCustomPlaceholder: { vi: "Mô tả bối cảnh của bạn", en: "Describe your own setting" },
  tone: { vi: "Tông màu / Giọng kể", en: "Tone" },
  tonePlaceholder: { vi: "Chọn giọng kể...", en: "Choose a tone..." },
  toneCustomPlaceholder: { vi: "Mô tả giọng kể của bạn", en: "Describe your own tone" },

  // Story / film brief
  storyBriefTitle: { vi: "Thông tin câu chuyện (cho phim / kể chuyện)", en: "Story brief (for film / narrative)" },
  storyBriefHint: {
    vi: "Điền để AI dựng cốt truyện có chiều sâu. Không bắt buộc.",
    en: "Fill in so the AI builds a deeper narrative. Optional.",
  },
  mainCharacter: { vi: "Nhân vật chính", en: "Main character" },
  mainCharacterPlaceholder: { vi: "VD: Cô gái 20 tuổi nhút nhát, mơ làm ca sĩ", en: "e.g. A shy 20-year-old girl who dreams of singing" },
  centralConflict: { vi: "Xung đột / Cao trào", en: "Central conflict" },
  centralConflictPlaceholder: { vi: "VD: Phải vượt qua nỗi sợ đứng trên sân khấu", en: "e.g. Must overcome her fear of the stage" },
  themeMessage: { vi: "Thông điệp / Ý nghĩa", en: "Theme / message" },
  themeMessagePlaceholder: { vi: "VD: Dám ước mơ thì sẽ thành công", en: "e.g. Dare to dream and you'll succeed" },
  audienceLabel: { vi: "Đối tượng khán giả", en: "Intended audience" },
  audiencePlaceholder: { vi: "VD: Khán giả trẻ 16-25 tuổi", en: "e.g. Young viewers 16-25" },

  // Step 2: Characters
  charHint: {
    vi: "Tải lên 2-3 ảnh nhân vật từ các góc chụp khác nhau để AI tạo hình ảnh nhất quán.",
    en: "Upload 2-3 character photos from different angles for visual consistency.",
  },
  charName: { vi: "Tên nhân vật", en: "Character name" },
  charRole: { vi: "Vai trò (VD: Nhân vật chính)", en: "Role (e.g. Main hero)" },
  charAppearance: {
    vi: "Mô tả ngoại hình (không bắt buộc nếu có ảnh)",
    en: "Appearance description (optional if uploading photos)",
  },
  refExprTitle: { vi: "Biểu cảm trong ảnh tham chiếu", en: "Expressions in the reference strip" },
  refExprHint: {
    vi: "Mỗi board luôn có 3 góc mặt để khoá danh tính. Chọn thêm biểu cảm nếu muốn — nhưng nên để Veo tự diễn cảm xúc theo prompt (ít biểu cảm = mặt ít bị 'trôi', giống bạn hơn).",
    en: "Every board always has 3 face angles to lock identity. Add expressions only if you want — best to let Veo act the emotion from the prompt (fewer expressions = less identity drift).",
  },
  refExpr0: { vi: "Không — để Veo tự diễn (khuyên dùng)", en: "None — let Veo act it (recommended)" },
  refExpr2: { vi: "2 biểu cảm", en: "2 expressions" },
  refExpr3: { vi: "3 biểu cảm", en: "3 expressions" },
  charPhotos: { vi: "Ảnh nhân vật", en: "Character Photos" },
  charPhotosHint: { vi: "Tải lên 2-3 ảnh từ các góc khác nhau", en: "Upload 2-3 photos from different angles" },
  addCharacter: { vi: "Thêm nhân vật", en: "Add Character" },
  photos: { vi: "ảnh", en: "photo(s)" },
  remove: { vi: "Xóa", en: "Remove" },

  // Step 3: Products
  prodHint: {
    vi: "Tải lên 2-3 ảnh sản phẩm để đưa vào các cảnh storyboard.",
    en: "Upload product photos to include in your storyboard scenes.",
  },
  prodName: { vi: "Tên sản phẩm", en: "Product name" },
  prodDesc: { vi: "Mô tả sản phẩm (không bắt buộc)", en: "Product description (optional)" },
  prodPhotos: { vi: "Ảnh sản phẩm", en: "Product Photos" },
  prodPhotosHint: { vi: "Tải lên 2-3 ảnh sản phẩm từ các góc khác nhau", en: "Upload 2-3 product photos from different angles" },
  addProduct: { vi: "Thêm sản phẩm", en: "Add Product" },
  // Auxiliary / ingredient images
  ingTitle: { vi: "Ảnh phụ / thành phần (gọi theo tên)", en: "Auxiliary / ingredient images (by name)" },
  ingHint: {
    vi: "Tải ảnh thành phần (thảo dược, nguyên liệu...) kèm TÊN. AI sẽ minh hoạ và gọi đúng tên trong prompt để Veo nhận diện.",
    en: "Upload ingredient/component images WITH a name. The AI illustrates them and refers to each by name so Veo recognizes them.",
  },
  ingName: { vi: "Tên thành phần (VD: Hoa đu đủ đực)", en: "Ingredient name (e.g. Papaya flower)" },
  ingDesc: { vi: "Mô tả ngắn (không bắt buộc)", en: "Short description (optional)" },
  ingImage: { vi: "Ảnh thành phần", en: "Ingredient image" },
  ingImageHint: { vi: "1-2 ảnh rõ nét của thành phần", en: "1-2 clear images of the ingredient" },
  addIngredient: { vi: "Thêm thành phần", en: "Add ingredient" },
  // Review phase
  reviewTitle: { vi: "Duyệt ảnh tham chiếu nhân vật", en: "Review the character reference" },
  reviewHint: {
    vi: "Kiểm tra ảnh nhân vật có giống & đẹp như mong muốn chưa. Chưa ưng thì bấm 'Tạo lại'. Ưng rồi bấm 'Duyệt & dựng storyboard' để khoá ảnh này và dựng toàn bộ board + prompt.",
    en: "Check the character looks right. Not happy? 'Regenerate'. Happy? 'Approve & build' to lock this and build the full storyboard.",
  },
  regenerate: { vi: "Tạo lại ảnh nhân vật", en: "Regenerate character" },
  approveBuild: { vi: "Duyệt & dựng storyboard", en: "Approve & build storyboard" },
  reviewScript: { vi: "Kịch bản (xem trước)", en: "Script (preview)" },

  // Step 4: Background
  bgHint: {
    vi: "Tải lên 2-3 ảnh tham chiếu của địa điểm nơi câu chuyện diễn ra.",
    en: "Upload reference photos of locations where the story takes place.",
  },
  bgName: { vi: "Tên địa điểm (VD: Quán cà phê, Đường phố)", en: "Location name (e.g. Coffee shop, City street)" },
  bgDesc: { vi: "Mô tả (không bắt buộc)", en: "Description (optional)" },
  bgPhotos: { vi: "Ảnh bối cảnh", en: "Background Photos" },
  bgPhotosHint: { vi: "Tải lên 2-3 ảnh tham chiếu của địa điểm", en: "Upload 2-3 reference photos of the location" },
  addBackground: { vi: "Thêm bối cảnh", en: "Add Background" },

  // Step 5: Style
  visualStyle: { vi: "Phong cách hình ảnh *", en: "Visual Style *" },
  sceneCount: { vi: "Số lượng cảnh", en: "Number of Scenes" },
  segmentCount: { vi: "Số đoạn 8 giây (ghép thành video)", en: "Number of 8s segments (chained into video)" },
  segmentCountHint: {
    vi: "Mỗi đoạn = 1 clip 8s trên Veo/Seedance. Các đoạn được nối liền mạch (frame cuối → frame đầu) để video không bị khựng.",
    en: "Each segment = one 8s clip on Veo/Seedance. Segments are chained (last frame → next first frame) for seamless playback.",
  },
  beatsLabel: { vi: "Số cảnh nhỏ trong mỗi đoạn", en: "Shots per segment" },
  beatsHint: {
    vi: "Mỗi đoạn 8s được chia thành nhiều cảnh nhỏ theo từng mốc thời gian (3-5 cảnh).",
    en: "Each 8s segment is split into several quick shots across time frames (3-5).",
  },
  forceDialogueLabel: { vi: "Bắt buộc lời thoại tiếng Việt", en: "Force Vietnamese dialogue" },
  forceDialogueHint: {
    vi: "Mỗi đoạn sẽ có một câu thoại tiếng Việt, được nhúng vào prompt theo định dạng Veo để nhân vật nói đúng (lip-sync, không phụ đề).",
    en: "Every segment gets a Vietnamese spoken line, embedded into the Veo prompt for correct lip-sync (no subtitles).",
  },
  videoGoalLabel: { vi: "Mục tiêu video", en: "Video Goal" },
  imageQuality: { vi: "Chất lượng ảnh", en: "Image Quality" },
  qualityStandard: { vi: "Standard (nhanh, tiết kiệm)", en: "Standard (fast, cheaper)" },
  qualityPro: { vi: "Pro — Nano Banana Pro (giữ mặt tốt nhất)", en: "Pro — Nano Banana Pro (best face lock)" },
  qualityHint: {
    vi: "Chế độ Pro chỉ hoạt động với Gemini, giữ khuôn mặt nhân vật chính xác nhất.",
    en: "Pro mode works with Gemini only and preserves the character's face most accurately.",
  },
  aspectRatio: { vi: "Tỉ lệ khung hình", en: "Aspect Ratio" },
  aspectLandscape: { vi: "Ngang 16:9 (YouTube)", en: "Landscape 16:9 (YouTube)" },
  aspectPortrait: { vi: "Dọc 9:16 (TikTok/Reels)", en: "Portrait 9:16 (TikTok/Reels)" },
  summary: { vi: "Tóm tắt", en: "Summary" },
  scenes: { vi: "cảnh", en: "scenes" },
  style: { vi: "phong cách", en: "style" },
  characters: { vi: "nhân vật", en: "character(s)" },
  products: { vi: "sản phẩm", en: "product(s)" },
  locations: { vi: "địa điểm", en: "location(s)" },
  refImageNote: {
    vi: "Ảnh tham chiếu sẽ được AI phân tích để tạo hình ảnh chính xác hơn",
    en: "Reference images will be analyzed by AI for visual consistency",
  },

  // Navigation
  back: { vi: "Quay lại", en: "Back" },
  next: { vi: "Tiếp tục", en: "Next" },
  generate: { vi: "Tạo Storyboard", en: "Generate Storyboard" },

  // Generating
  generating: { vi: "Đang tạo storyboard...", en: "Generating your storyboard..." },
  preparing: { vi: "Đang chuẩn bị...", en: "Preparing..." },
  analyzingImages: { vi: "Bước 1/5 — Đang phân tích ảnh tham chiếu...", en: "Step 1/5 — Analyzing reference images..." },
  creatingScenes: {
    vi: "Bước 2/5 — AI đang tạo kịch bản, nhân vật, phân cảnh...",
    en: "Step 2/5 — AI creating script, characters, scene breakdown...",
  },
  generatingCharSheet: {
    vi: "Đang tạo Character Sheet + từng frame 8s (nối liền mạch)...",
    en: "Generating Character Sheet + each 8s frame (chained)...",
  },
  generatingDone: {
    vi: "Sắp xong — đang tạo poster & hướng dẫn ghép video...",
    en: "Almost done — building poster & assembly guide...",
  },

  // How-to-use guide
  howToTitle: { vi: "Cách dùng (làm từng shot một)", en: "How to use (one shot at a time)" },
  howToStep1: {
    vi: "Mỗi shot làm RIÊNG 1 clip 8s. KHÔNG dán cả bảng lớn vào Veo.",
    en: "Each shot is its OWN 8s clip. Do NOT paste the big guide into Veo.",
  },
  howToStep2: {
    vi: "Với mỗi thẻ shot bên dưới: tải ảnh board của shot đó + đính kèm Character Sheet → đưa vào Veo (image-to-video).",
    en: "For each shot card below: upload that shot's board image + attach the Character Sheet → into Veo (image-to-video).",
  },
  howToStep3: {
    vi: "Bấm 'Copy' ở thẻ đó để lấy 'Prompt Veo đầy đủ' (1 khối liền — copy nguyên, không tách mục) → dán vào Veo → tạo clip.",
    en: "Click 'Copy' on that card for the full Veo prompt (one block — paste as-is) → paste into Veo → generate the clip.",
  },
  howToStep4: {
    vi: "Làm lần lượt Shot 1 → 2 → 3... rồi ghép các clip theo thứ tự (CapCut/ffmpeg). Bảng 'Hướng dẫn ghép' chỉ để tham khảo.",
    en: "Repeat for Shot 1 → 2 → 3... then stitch the clips in order (CapCut/ffmpeg). The 'assembly guide' is reference only.",
  },

  // Results
  generated: { vi: "đã tạo", en: "generated" },
  failed: { vi: "thất bại", en: "failed" },
  newStoryboard: { vi: "Tạo mới", en: "New" },
  segments: { vi: "đoạn", en: "segments" },
  downloadAll: { vi: "Tải tất cả (ZIP)", en: "Download all (ZIP)" },
  segmentsTitle: { vi: "Các shot ảnh (mỗi shot = 1 board cho Veo)", en: "Shot boards (one board per 8s clip)" },
  segmentsHint: {
    vi: "Mỗi thẻ = 1 BOARD của clip 8s gồm: dải tham chiếu nhân vật (các góc + biểu cảm), ảnh tổng quan cảnh/sản phẩm, và 3-5 ô hành động theo mốc thời gian. Tải board → đưa vào Veo làm ảnh tham chiếu + dán motion prompt. Board N kết thúc đúng nơi board N+1 bắt đầu nên các clip nối liền thành câu chuyện.",
    en: "Each card = a BOARD for the 8s clip: a character reference strip (angles + expressions), a scene/product overview, and 3-5 time-frame action panels. Send the board to Veo as the reference + paste the motion prompt. Board N ends where board N+1 begins so the clips chain into one story.",
  },
  dialogueLabel: { vi: "Lời thoại", en: "Dialogue" },
  actionLabel: { vi: "Hành động", en: "Action" },
  motionPrompt: { vi: "Prompt Veo đầy đủ (bám reference + negative)", en: "Full Veo prompt (reference-locked + negative)" },
  continuity: { vi: "Nối tiếp", en: "Continuity" },
  copyPrompt: { vi: "Copy prompt Veo (shot này)", en: "Copy Veo prompt (this shot)" },
  assemblyGuide: { vi: "Hướng dẫn ghép video (tài liệu — đừng dán cả vào Veo)", en: "Assembly guide (reference only — don't paste it all into Veo)" },
  noDesc: { vi: "Không có mô tả", en: "No description" },

  // Language toggle
  langLabel: { vi: "EN", en: "VI" },

  // Admin panel
  adminTitle: { vi: "Bảng điều khiển Admin", en: "Admin Control Panel" },
  adminPwPrompt: { vi: "Nhập mật khẩu admin", en: "Enter admin password" },
  adminPwPlaceholder: { vi: "Mật khẩu", en: "Password" },
  adminPwError: { vi: "Mật khẩu không đúng", en: "Incorrect password" },
  adminUnlock: { vi: "Mở khóa", en: "Unlock" },
  adminClose: { vi: "Đóng", en: "Close" },
  adminProviderLabel: { vi: "Nhà cung cấp AI", en: "AI Provider" },
  adminProviderHint: {
    vi: "Lựa chọn được lưu lại cho lần sau. OpenAI dùng GPT-4o + DALL-E 3, Gemini dùng Nano Banana / Nano Banana Pro (giữ khuôn mặt).",
    en: "Your choice is saved for next time. OpenAI uses GPT-4o + DALL-E 3, Gemini uses Nano Banana / Nano Banana Pro (face lock).",
  },
  adminCurrentProvider: { vi: "Đang dùng", en: "Currently using" },
} as const;

// ─── Options ────────────────────────────────────────────────────────────────

const STYLE_OPTIONS: Record<Lang, { value: StoryboardStyle; label: string }[]> = {
  vi: [
    { value: "cinematic", label: "Điện ảnh" },
    { value: "realistic", label: "Chân thực" },
    { value: "commercial", label: "Quảng cáo (TVC)" },
    { value: "ugc", label: "UGC (quay điện thoại)" },
    { value: "product_showcase", label: "Trưng bày sản phẩm" },
    { value: "corporate_clean", label: "Doanh nghiệp / Brand" },
    { value: "anime", label: "Anime" },
    { value: "comic", label: "Truyện tranh" },
    { value: "watercolor", label: "Màu nước" },
    { value: "pencil_sketch", label: "Phác thảo chì" },
    { value: "noir", label: "Phim Noir" },
    { value: "3d_render", label: "3D Render" },
    { value: "pixel_art", label: "Pixel Art" },
  ],
  en: [
    { value: "cinematic", label: "Cinematic" },
    { value: "realistic", label: "Realistic" },
    { value: "commercial", label: "Commercial (TVC)" },
    { value: "ugc", label: "UGC (phone-shot)" },
    { value: "product_showcase", label: "Product Showcase" },
    { value: "corporate_clean", label: "Corporate / Brand" },
    { value: "anime", label: "Anime" },
    { value: "comic", label: "Comic Book" },
    { value: "watercolor", label: "Watercolor" },
    { value: "pencil_sketch", label: "Pencil Sketch" },
    { value: "noir", label: "Film Noir" },
    { value: "3d_render", label: "3D Render" },
    { value: "pixel_art", label: "Pixel Art" },
  ],
};

const GENRE_OPTIONS: Record<Lang, { value: string; label: string }[]> = {
  vi: [
    { value: "advertising", label: "Quảng cáo / TVC" },
    { value: "product_demo", label: "Demo / Giới thiệu sản phẩm" },
    { value: "brand_film", label: "Phim thương hiệu" },
    { value: "promo", label: "Khuyến mãi / Sale" },
    { value: "unboxing", label: "Unboxing / Trải nghiệm" },
    { value: "drama", label: "Chính kịch" },
    { value: "action", label: "Hành động" },
    { value: "comedy", label: "Hài" },
    { value: "horror", label: "Kinh dị" },
    { value: "romance", label: "Tình cảm" },
    { value: "sci-fi", label: "Khoa học viễn tưởng" },
    { value: "thriller", label: "Giật gân" },
    { value: "animation", label: "Hoạt hình" },
    { value: "documentary", label: "Tài liệu" },
  ],
  en: [
    { value: "advertising", label: "Advertising / TVC" },
    { value: "product_demo", label: "Product demo" },
    { value: "brand_film", label: "Brand film" },
    { value: "promo", label: "Promo / Sale" },
    { value: "unboxing", label: "Unboxing / Experience" },
    { value: "drama", label: "Drama" },
    { value: "action", label: "Action" },
    { value: "comedy", label: "Comedy" },
    { value: "horror", label: "Horror" },
    { value: "romance", label: "Romance" },
    { value: "sci-fi", label: "Sci-Fi" },
    { value: "thriller", label: "Thriller" },
    { value: "animation", label: "Animation" },
    { value: "documentary", label: "Documentary" },
  ],
};

// Genres treated as product advertising → show the product brief.
const AD_GENRES = new Set([
  "advertising",
  "product_demo",
  "brand_film",
  "promo",
  "unboxing",
]);

const CUSTOM = "__custom__";

// ─── Tone / narration voice (dropdown) ──────────────────────────────────────
const TONE_OPTIONS: Record<Lang, { value: string; label: string }[]> = {
  vi: [
    { value: "cheerful", label: "Vui tươi, năng động" },
    { value: "emotional", label: "Cảm động, sâu lắng" },
    { value: "humorous", label: "Hài hước, vui nhộn" },
    { value: "luxury", label: "Sang trọng, cao cấp" },
    { value: "professional", label: "Chuyên nghiệp, tin cậy" },
    { value: "dramatic", label: "Kịch tính, gay cấn" },
    { value: "mysterious", label: "Bí ẩn, hồi hộp" },
    { value: "inspirational", label: "Truyền cảm hứng" },
    { value: "relatable", label: "Gần gũi, đời thường" },
    { value: "trendy", label: "Trẻ trung, bắt trend" },
    { value: "warm", label: "Ấm áp, tình cảm" },
    { value: "epic", label: "Hoành tráng, sử thi" },
    { value: CUSTOM, label: "Khác (tự nhập)" },
  ],
  en: [
    { value: "cheerful", label: "Cheerful, energetic" },
    { value: "emotional", label: "Emotional, heartfelt" },
    { value: "humorous", label: "Humorous, fun" },
    { value: "luxury", label: "Luxurious, premium" },
    { value: "professional", label: "Professional, trustworthy" },
    { value: "dramatic", label: "Dramatic, intense" },
    { value: "mysterious", label: "Mysterious, suspenseful" },
    { value: "inspirational", label: "Inspirational, uplifting" },
    { value: "relatable", label: "Relatable, everyday" },
    { value: "trendy", label: "Youthful, trendy" },
    { value: "warm", label: "Warm, affectionate" },
    { value: "epic", label: "Epic, grand" },
    { value: CUSTOM, label: "Other (type your own)" },
  ],
};

// English descriptor sent to the AI for each tone key.
const TONE_PROMPT: Record<string, string> = {
  cheerful: "cheerful, energetic and upbeat",
  emotional: "emotional, heartfelt and touching",
  humorous: "humorous, light and fun",
  luxury: "luxurious, premium and elegant",
  professional: "professional, clean and trustworthy",
  dramatic: "dramatic, intense and high-stakes",
  mysterious: "mysterious, suspenseful and intriguing",
  inspirational: "inspirational and uplifting",
  relatable: "relatable, everyday and down-to-earth",
  trendy: "youthful, trendy and social-media native",
  warm: "warm, affectionate and intimate",
  epic: "epic, grand and cinematic",
};

// ─── Setting / location (dropdown) ──────────────────────────────────────────
const SETTING_OPTIONS: Record<Lang, { value: string; label: string }[]> = {
  vi: [
    { value: "home", label: "Trong nhà / phòng khách" },
    { value: "kitchen", label: "Nhà bếp" },
    { value: "office", label: "Văn phòng" },
    { value: "cafe", label: "Quán cà phê" },
    { value: "store", label: "Cửa hàng / trung tâm thương mại" },
    { value: "studio", label: "Studio nền sạch" },
    { value: "urban_street", label: "Đường phố thành thị" },
    { value: "outdoor_nature", label: "Ngoài trời / thiên nhiên" },
    { value: "beach", label: "Bãi biển" },
    { value: "gym", label: "Phòng gym" },
    { value: "restaurant", label: "Nhà hàng" },
    { value: "classroom", label: "Lớp học" },
    { value: "countryside", label: "Nông thôn / làng quê" },
    { value: "night_city", label: "Thành phố về đêm" },
    { value: CUSTOM, label: "Khác (tự nhập)" },
  ],
  en: [
    { value: "home", label: "Home / living room" },
    { value: "kitchen", label: "Kitchen" },
    { value: "office", label: "Office" },
    { value: "cafe", label: "Cafe" },
    { value: "store", label: "Store / shopping mall" },
    { value: "studio", label: "Clean studio backdrop" },
    { value: "urban_street", label: "Urban street" },
    { value: "outdoor_nature", label: "Outdoors / nature" },
    { value: "beach", label: "Beach" },
    { value: "gym", label: "Gym" },
    { value: "restaurant", label: "Restaurant" },
    { value: "classroom", label: "Classroom" },
    { value: "countryside", label: "Countryside / village" },
    { value: "night_city", label: "City at night" },
    { value: CUSTOM, label: "Other (type your own)" },
  ],
};

const SETTING_PROMPT: Record<string, string> = {
  home: "indoors at home, a cozy living room",
  kitchen: "a modern home kitchen",
  office: "a modern office workspace",
  cafe: "a cozy cafe",
  store: "a retail store / shopping mall",
  studio: "a clean studio backdrop",
  urban_street: "a busy urban street",
  outdoor_nature: "outdoors in nature",
  beach: "a sunny beach",
  gym: "a modern fitness gym",
  restaurant: "a stylish restaurant",
  classroom: "a classroom",
  countryside: "the countryside / a village",
  night_city: "a city at night with neon lights",
};

// Number of 8-second segments to chain into the final video.
const SEGMENT_OPTIONS = [
  { value: "3", label: "3 (~24s)" },
  { value: "4", label: "4 (~32s)" },
  { value: "5", label: "5 (~40s)" },
  { value: "7", label: "7 (~56s)" },
  { value: "10", label: "10 (~80s)" },
];

// Number of quick shots (mini-frames) inside each 8s segment.
const BEATS_OPTIONS: Record<Lang, { value: string; label: string }[]> = {
  vi: [
    { value: "3", label: "3 cảnh / đoạn" },
    { value: "4", label: "4 cảnh / đoạn" },
    { value: "5", label: "5 cảnh / đoạn" },
  ],
  en: [
    { value: "3", label: "3 shots / segment" },
    { value: "4", label: "4 shots / segment" },
    { value: "5", label: "5 shots / segment" },
  ],
};

const VIDEO_GOAL_OPTIONS: Record<Lang, { value: VideoGoal; label: string }[]> = {
  vi: [
    { value: "marketing_general", label: "Marketing tổng quát" },
    { value: "product_ad", label: "Quảng cáo sản phẩm" },
    { value: "promo_sale", label: "Khuyến mãi / Sale" },
    { value: "brand_story", label: "Câu chuyện thương hiệu" },
    { value: "social_short", label: "Video ngắn TikTok/Reels" },
    { value: "testimonial", label: "Khách hàng review (testimonial)" },
    { value: "storytelling", label: "Kể chuyện" },
    { value: "review", label: "Review / Đánh giá" },
    { value: "educational", label: "Giáo dục / Hướng dẫn" },
  ],
  en: [
    { value: "marketing_general", label: "General marketing" },
    { value: "product_ad", label: "Product ad" },
    { value: "promo_sale", label: "Promo / Sale" },
    { value: "brand_story", label: "Brand story" },
    { value: "social_short", label: "TikTok/Reels short" },
    { value: "testimonial", label: "Customer testimonial" },
    { value: "storytelling", label: "Storytelling" },
    { value: "review", label: "Review / Testimonial" },
    { value: "educational", label: "Educational / How-to" },
  ],
};

// ─── Description presets (dropdown instead of free typing) ──────────────────
// FORCE_REF = "lock onto the uploaded reference photo for sync" — the option
// the user picks so the tool reproduces the ref image exactly instead of
// inventing from text.
const FORCE_REF = "__force_ref__";

// English instruction injected when FORCE_REF is chosen (it flows into the
// image prompt as the subject's description).
const FORCE_TEXT = {
  character:
    "Use the uploaded reference photo as the ABSOLUTE source of truth — reproduce this exact same person identically in every shot (same face, hairstyle, build); do not restyle or invent a different look.",
  product:
    "Use the uploaded product photo as the ABSOLUTE source of truth — reproduce the exact same product identically (same shape, colour, material, branding); do not redesign or swap it.",
  background:
    "Use the uploaded interior photo as the ABSOLUTE source of truth — reproduce the exact same location identically (same cabinets, colours, layout, window, appliances); do not invent a different place.",
} as const;

const CHAR_APPR_OPTIONS: Record<Lang, { value: string; label: string }[]> = {
  vi: [
    { value: FORCE_REF, label: "🔒 Đồng bộ tuyệt đối với ảnh đã tải (khuyên dùng)" },
    { value: "glowup", label: "Giữ nhận diện, làm đẹp tự nhiên" },
    { value: "exact", label: "Giữ nguyên 100% như ảnh" },
    { value: "businessman", label: "Doanh nhân lịch lãm" },
    { value: "homecook", label: "Nội trợ / đầu bếp thân thiện" },
    { value: "athletic", label: "Năng động, khỏe khoắn" },
    { value: CUSTOM, label: "Khác (tự nhập)" },
  ],
  en: [
    { value: FORCE_REF, label: "🔒 Lock to uploaded photo (recommended)" },
    { value: "glowup", label: "Keep identity, natural glow-up" },
    { value: "exact", label: "Keep exactly as the photo" },
    { value: "businessman", label: "Polished businessman" },
    { value: "homecook", label: "Friendly home cook" },
    { value: "athletic", label: "Energetic, fit & healthy" },
    { value: CUSTOM, label: "Other (type your own)" },
  ],
};
const CHAR_APPR_PROMPT: Record<string, string> = {
  glowup: "natural, friendly and camera-ready; keep the real identity from the reference photo",
  exact: "reproduce the person exactly as in the reference photo, no restyling",
  businessman: "polished, well-groomed, smart-casual businessman look",
  homecook: "warm, friendly home cook / homemaker look",
  athletic: "energetic, fit and healthy look",
};

const PROD_DESC_OPTIONS: Record<Lang, { value: string; label: string }[]> = {
  vi: [
    { value: FORCE_REF, label: "🔒 Đồng bộ tuyệt đối với ảnh sản phẩm (khuyên dùng)" },
    { value: "premium", label: "Cao cấp, bóng bẩy" },
    { value: "natural", label: "Mộc mạc, tự nhiên" },
    { value: CUSTOM, label: "Khác (tự nhập)" },
  ],
  en: [
    { value: FORCE_REF, label: "🔒 Lock to uploaded product photo (recommended)" },
    { value: "premium", label: "Premium, glossy" },
    { value: "natural", label: "Natural, rustic" },
    { value: CUSTOM, label: "Other (type your own)" },
  ],
};
const PROD_DESC_PROMPT: Record<string, string> = {
  premium: "premium, glossy, high-end product presentation",
  natural: "natural, rustic, authentic product presentation",
};

const BG_DESC_OPTIONS: Record<Lang, { value: string; label: string }[]> = {
  vi: [
    { value: FORCE_REF, label: "🔒 Đồng bộ tuyệt đối với ảnh bối cảnh (khuyên dùng)" },
    { value: "bright", label: "Sáng sủa, hiện đại" },
    { value: "cozy", label: "Ấm cúng, gần gũi" },
    { value: CUSTOM, label: "Khác (tự nhập)" },
  ],
  en: [
    { value: FORCE_REF, label: "🔒 Lock to uploaded location photo (recommended)" },
    { value: "bright", label: "Bright, modern" },
    { value: "cozy", label: "Cozy, homely" },
    { value: CUSTOM, label: "Other (type your own)" },
  ],
};
const BG_DESC_PROMPT: Record<string, string> = {
  bright: "bright, clean, modern interior",
  cozy: "cozy, warm, homely interior",
};

// Resolve a description dropdown selection into the text fed to the AI.
function resolveDesc(
  sel: string,
  custom: string,
  map: Record<string, string>,
  forceText: string
): string {
  if (sel === FORCE_REF) return forceText;
  if (sel === CUSTOM) return custom.trim();
  return sel ? map[sel] ?? "" : "";
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface CharacterEntry {
  name: string;
  role: string;
  appearance: string;
  images: UploadedImage[];
}

interface ProductEntry {
  name: string;
  description: string;
  images: UploadedImage[];
}

interface BackgroundEntry {
  name: string;
  description: string;
  images: UploadedImage[];
}

type Phase = "input" | "generating" | "script" | "result";

// ─── Component ──────────────────────────────────────────────────────────────

export function GenerateClient() {
  const [lang, setLang] = useState<Lang>("vi");
  const [phase, setPhase] = useState<Phase>("input");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [result, setResult] = useState<StoryboardResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Kept after a build so any board can be reviewed and re-rendered on demand
  // (the quality-review/redo gate) without rebuilding the whole storyboard.
  const [genInput, setGenInput] = useState<StoryboardGenerationInput | null>(null);
  const [genAnalysis, setGenAnalysis] = useState<StoryboardAnalysis | null>(null);
  const [regenTarget, setRegenTarget] = useState<number | "master" | null>(null);
  const [keyframeBusy, setKeyframeBusy] = useState<number | null>(null);
  // Per-board failure reasons, keyed by "seg-<index>" / "master".
  const [boardErrors, setBoardErrors] = useState<Record<string, string>>({});

  // Script-review phase: the editable breakdown + carried plan data.
  const [draft, setDraft] = useState<StoryboardGenerationOutput | null>(null);
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);

  // Set when reference images were handed off from the Image Studio.
  const [fromStudio, setFromStudio] = useState(false);

  // ─── Admin: AI Provider Switch ──────────────────────────────────
  // Default Gemini — required for face lock from uploaded photos.
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  // Load saved provider choice on mount
  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("sb_ai_provider")
        : null;
    if (saved === "gemini" || saved === "openai") {
      setProvider(saved);
    }
  }, []);

  const switchProvider = (p: AIProvider) => {
    setProvider(p);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sb_ai_provider", p);
    }
  };

  const checkPassword = () => {
    if (pwInput === "25021987") {
      setAdminUnlocked(true);
      setPwError(false);
      setPwInput("");
    } else {
      setPwError(true);
    }
  };

  const closeAdmin = () => {
    setShowAdmin(false);
    setAdminUnlocked(false);
    setPwInput("");
    setPwError(false);
  };

  const L = (key: keyof typeof t) => {
    const val = t[key];
    if (typeof val === "object" && "vi" in val && "en" in val) {
      return val[lang] as string;
    }
    return String(val);
  };

  const steps = t.steps[lang];

  // Step 1: Story
  const [storyIdea, setStoryIdea] = useState("");
  const [genre, setGenre] = useState("advertising");
  // Setting & tone are now dropdown-driven (with a custom free-text option).
  const [settingSel, setSettingSel] = useState("");
  const [settingCustom, setSettingCustom] = useState("");
  const [toneSel, setToneSel] = useState("");
  const [toneCustom, setToneCustom] = useState("");
  // Product / TVC brief
  const [productName, setProductName] = useState("");
  const [sellingPoints, setSellingPoints] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [callToAction, setCallToAction] = useState("");
  // Story / film brief
  const [mainCharacter, setMainCharacter] = useState("");
  const [centralConflict, setCentralConflict] = useState("");

  const isAdGenre = AD_GENRES.has(genre);

  // Resolve dropdown selection (or custom text) into the value sent to the AI.
  const effectiveSetting =
    settingSel === CUSTOM
      ? settingCustom.trim()
      : settingSel
        ? SETTING_PROMPT[settingSel] ?? ""
        : "";
  const effectiveTone =
    toneSel === CUSTOM
      ? toneCustom.trim()
      : toneSel
        ? TONE_PROMPT[toneSel] ?? ""
        : "";

  // Step 2: Characters
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [charName, setCharName] = useState("");
  const [charRole, setCharRole] = useState("");
  const [charAppearance, setCharAppearance] = useState("");
  const [charApprSel, setCharApprSel] = useState("");
  const [charImages, setCharImages] = useState<UploadedImage[]>([]);

  // Step 3: Products (main) + named ingredients (auxiliary)
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodDescSel, setProdDescSel] = useState("");
  const [prodImages, setProdImages] = useState<UploadedImage[]>([]);
  // Auxiliary/ingredient images — each named, referenced by name in prompts.
  const [ingredients, setIngredients] = useState<ProductEntry[]>([]);
  const [ingName, setIngName] = useState("");
  const [ingDesc, setIngDesc] = useState("");
  const [ingImages, setIngImages] = useState<UploadedImage[]>([]);

  // Step 4: Backgrounds
  const [backgrounds, setBackgrounds] = useState<BackgroundEntry[]>([]);
  const [bgName, setBgName] = useState("");
  const [bgDesc, setBgDesc] = useState("");
  const [bgDescSel, setBgDescSel] = useState("");
  const [bgImages, setBgImages] = useState<UploadedImage[]>([]);

  // Resolved description text (dropdown selection or custom free-text).
  const effectiveCharAppearance = resolveDesc(charApprSel, charAppearance, CHAR_APPR_PROMPT, FORCE_TEXT.character);
  const effectiveProdDesc = resolveDesc(prodDescSel, prodDesc, PROD_DESC_PROMPT, FORCE_TEXT.product);
  const effectiveBgDesc = resolveDesc(bgDescSel, bgDesc, BG_DESC_PROMPT, FORCE_TEXT.background);

  // Hydrate approved images handed off from the Image Studio (/studio).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem("sb_studio_handoff");
    if (!raw) return;
    window.sessionStorage.removeItem("sb_studio_handoff");
    try {
      const h = JSON.parse(raw) as { characterImages?: string[]; productImages?: string[] };
      const toUploaded = (b64: string): UploadedImage => ({
        id: Math.random().toString(36).slice(2, 10),
        preview: `data:image/jpeg;base64,${b64}`,
        base64: b64,
        fileName: "studio.jpg",
      });
      // Land the handed-off images directly in the visible uploaders (not a
      // hidden "added character" card) so the user SEES them, the Character
      // Studio can reuse them, and handleGenerate auto-includes them as the
      // locked references for the whole storyboard.
      if (h.characterImages && h.characterImages.length > 0) {
        setCharName("Nhân vật chính");
        setCharImages(h.characterImages.slice(0, 4).map(toUploaded));
      }
      if (h.productImages && h.productImages.length > 0) {
        setProdName("Sản phẩm");
        setProdImages(h.productImages.slice(0, 3).map(toUploaded));
      }
      setFromStudio(true);
      setStep(1);
    } catch {
      /* ignore malformed handoff */
    }
  }, []);

  // Step 5: Style
  const [style, setStyle] = useState<StoryboardStyle>("cinematic");
  const [segmentCount, setSegmentCount] = useState(4);
  const [beatsPerSegment, setBeatsPerSegment] = useState(3);
  const [forceVietnameseDialogue, setForceVietnameseDialogue] = useState(true);
  const [videoGoal, setVideoGoal] = useState<VideoGoal>("product_ad");
  const [imageQuality, setImageQuality] = useState<ImageQuality>("standard");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  // Expression heads in each board's character-reference strip (0 = let Veo act
  // the emotion from the prompt; 2-3 = include a small fixed set).
  const [refExpressions, setRefExpressions] = useState(0);
  const [copiedSeg, setCopiedSeg] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);

  // ─── Helpers ─────────────────────────────────────────────────────

  const addCharacter = () => {
    if (!charName.trim()) return;
    setCharacters((prev) => [
      ...prev,
      { name: charName, role: charRole, appearance: effectiveCharAppearance, images: charImages },
    ]);
    setCharName("");
    setCharRole("");
    setCharAppearance("");
    setCharApprSel("");
    setCharImages([]);
  };

  const addProduct = () => {
    if (!prodName.trim()) return;
    setProducts((prev) => [
      ...prev,
      { name: prodName, description: effectiveProdDesc, images: prodImages },
    ]);
    setProdName("");
    setProdDesc("");
    setProdDescSel("");
    setProdImages([]);
  };

  const addIngredient = () => {
    if (!ingName.trim() || ingImages.length === 0) return;
    setIngredients((prev) => [
      ...prev,
      { name: ingName, description: ingDesc, images: ingImages },
    ]);
    setIngName("");
    setIngDesc("");
    setIngImages([]);
  };

  const addBackground = () => {
    if (!bgName.trim()) return;
    setBackgrounds((prev) => [
      ...prev,
      { name: bgName, description: effectiveBgDesc, images: bgImages },
    ]);
    setBgName("");
    setBgDesc("");
    setBgDescSel("");
    setBgImages([]);
  };

  // ─── Generate ────────────────────────────────────────────────────

  const handleGenerate = async () => {
    setPhase("generating");
    setError(null);
    setProgressPercent(5);
    setProgressMessage(L("preparing"));

    // Auto-include uploads still sitting in the form (user may not have
    // clicked "Add ...") so reference photos are never silently dropped.
    const effectiveCharacters = [
      ...characters,
      ...(charImages.length > 0
        ? [{ name: charName.trim() || "Main character", role: charRole, appearance: effectiveCharAppearance, images: charImages }]
        : []),
    ];
    const effectiveProducts = [
      ...products,
      ...(prodImages.length > 0
        ? [{ name: prodName.trim() || "Product", description: effectiveProdDesc, images: prodImages }]
        : []),
    ];
    const effectiveBackgrounds = [
      ...backgrounds,
      ...(bgImages.length > 0
        ? [{ name: bgName.trim() || "Setting", description: effectiveBgDesc, images: bgImages }]
        : []),
    ];

    const characterImages: ImageReference[] = effectiveCharacters
      .filter((c) => c.images.length > 0)
      .map((c) => ({ name: c.name, images: c.images.map((i) => i.base64) }));

    const productImages: ImageReference[] = effectiveProducts
      .filter((p) => p.images.length > 0)
      .map((p) => ({ name: p.name, description: p.description, images: p.images.map((i) => i.base64) }));

    const backgroundImages: ImageReference[] = effectiveBackgrounds
      .filter((b) => b.images.length > 0)
      .map((b) => ({ name: b.name, description: b.description, images: b.images.map((i) => i.base64) }));

    const effectiveIngredients = [
      ...ingredients,
      ...(ingImages.length > 0 && ingName.trim()
        ? [{ name: ingName.trim(), description: ingDesc, images: ingImages }]
        : []),
    ];
    const ingredientImages: ImageReference[] = effectiveIngredients
      .filter((g) => g.images.length > 0)
      .map((g) => ({ name: g.name, description: g.description, images: g.images.map((i) => i.base64) }));

    const hasUploads =
      characterImages.length > 0 ||
      productImages.length > 0 ||
      ingredientImages.length > 0 ||
      backgroundImages.length > 0;

    if (hasUploads) {
      setProgressPercent(10);
      setProgressMessage(L("analyzingImages"));
    }

    const input: StoryboardGenerationInput = {
      story_idea: storyIdea,
      genre: genre as StoryboardGenerationInput["genre"],
      style,
      scene_count: segmentCount,
      segment_count: segmentCount,
      beats_per_segment: beatsPerSegment,
      video_goal: videoGoal,
      dialogue_language: forceVietnameseDialogue ? "Vietnamese" : undefined,
      force_dialogue: forceVietnameseDialogue,
      character_descriptions: effectiveCharacters.length > 0
        ? effectiveCharacters.map((c) => ({ name: c.name, appearance: c.appearance, personality: "", role: c.role }))
        : undefined,
      character_images: characterImages.length > 0 ? characterImages : undefined,
      product_images: productImages.length > 0 ? productImages : undefined,
      ingredient_images: ingredientImages.length > 0 ? ingredientImages : undefined,
      background_images: backgroundImages.length > 0 ? backgroundImages : undefined,
      setting: effectiveSetting || undefined,
      tone: effectiveTone || undefined,
      // Ad genres send the product brief; narrative genres send the story brief.
      product_name: isAdGenre ? productName || undefined : undefined,
      selling_points: isAdGenre ? sellingPoints || undefined : undefined,
      call_to_action: isAdGenre ? callToAction || undefined : undefined,
      main_character: !isAdGenre ? mainCharacter || undefined : undefined,
      central_conflict: !isAdGenre ? centralConflict || undefined : undefined,
      target_audience: targetAudience || undefined,
      key_message: keyMessage || undefined,
      image_quality: imageQuality,
      aspect_ratio: aspectRatio,
      reference_expressions: refExpressions,
    };

    setProgressPercent(6);
    setProgressMessage(L("creatingScenes"));

    try {
      // Phase 1: script + ready-to-paste prompts (fast, tiny payload).
      const plan = await generateStoryboardPlan(input, provider);
      if (!plan.success) {
        setError(plan.error);
        setPhase("input");
        return;
      }

      // Keep inputs + the generated script, then let the user REVIEW & EDIT it
      // before we spend any image generations (catch wrong gender / dialogue /
      // action while it's still cheap text).
      setGenInput(input);
      setGenAnalysis(plan.data.analysis);
      setDraft(plan.data.breakdown);
      setPlanWarnings(plan.data.warnings);
      setPhase("script");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setPhase("input");
    }
  };

  // ─── Build the boards from the (edited) script ───────────────────
  const runBoards = async (
    breakdown: StoryboardGenerationOutput,
    videoPrompt: string,
    warnings: string[]
  ) => {
    if (!genInput || !genAnalysis) return;
    const input = genInput;
    const analysis = genAnalysis;
    setPhase("generating");
    setProgressPercent(12);

    const segCount = breakdown.segments.length;
    const total = segCount + 1;
    let done = 0;
    const bump = () => {
      done++;
      setProgressPercent(12 + Math.round((done / total) * 85));
    };
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const boardWarnings: string[] = [];
    const errs: Record<string, string> = {};

    const genBoard = async (
      args: Parameters<typeof generateBoardImage>[0],
      label: string,
      key: string
    ): Promise<string | null> => {
      let lastErr = "unknown";
      for (let k = 0; k < 3; k++) {
        try {
          const r = await generateBoardImage(args);
          if (r.success) return r.data.url;
          lastErr = r.error;
        } catch (e) {
          lastErr = e instanceof Error ? e.message : "network error";
        }
        if (k < 2) await sleep(4000 * (k + 1));
      }
      boardWarnings.push(`${label}: ${lastErr}`);
      errs[key] = lastErr;
      return null;
    };

    for (let i = 0; i < segCount; i++) {
      setProgressMessage(lang === "vi" ? `Đang vẽ cảnh ${i + 1}/${segCount}` : `Drawing board ${i + 1}/${segCount}`);
      const url = await genBoard(
        { input, breakdown, analysis, kind: "segment", segmentIndex: i, provider },
        lang === "vi" ? `Cảnh ${i + 1}` : `Board ${i + 1}`,
        `seg-${i}`
      );
      const seg = breakdown.segments[i];
      if (seg) seg.first_frame_url = url;
      bump();
      if (i < segCount - 1) await sleep(1500);
    }

    setProgressMessage(lang === "vi" ? "Đang vẽ bảng tổng" : "Drawing master board");
    await sleep(1500);
    const posterUrl = await genBoard(
      { input, breakdown, analysis, kind: "master", provider },
      lang === "vi" ? "Bảng tổng" : "Master board",
      "master"
    );
    bump();

    setBoardErrors(errs);
    setProgressPercent(100);
    setResult({
      breakdown,
      characterRefSheetUrl: null,
      storyboardPosterUrl: posterUrl,
      videoPrompt,
      warnings: [...warnings, ...boardWarnings],
    });
    setPhase("result");
  };

  // Finalize the edited script (re-sync Veo prompts) then build the boards.
  const buildStoryboardFromScript = async () => {
    if (!genInput || !genAnalysis || !draft) return;
    setError(null);
    setPhase("generating");
    setProgressMessage(lang === "vi" ? "Đang chốt kịch bản..." : "Finalizing script...");
    setProgressPercent(8);
    try {
      const fin = await finalizeScript({
        input: genInput,
        breakdown: draft,
        analysis: genAnalysis,
        provider,
      });
      if (!fin.success) {
        setError(fin.error);
        setPhase("script");
        return;
      }
      await runBoards(fin.data.breakdown, fin.data.videoPrompt, planWarnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setPhase("script");
    }
  };

  // ─── Script editor helpers (immutable updates on the draft) ──────
  const updateChar = (i: number, field: string, value: string) =>
    setDraft((d) =>
      d
        ? { ...d, character_locks: d.character_locks.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)) }
        : d
    );
  const updateSeg = (i: number, field: string, value: string) =>
    setDraft((d) =>
      d ? { ...d, segments: d.segments.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)) } : d
    );

  // ─── Review & redo: re-render a single board on demand ───────────
  const regenerateBoard = async (
    target: number | "master"
  ) => {
    if (!genInput || !genAnalysis || !result || regenTarget !== null) return;
    setRegenTarget(target);
    try {
      const r = await generateBoardImage({
        input: genInput,
        breakdown: result.breakdown,
        analysis: genAnalysis,
        kind: target === "master" ? "master" : "segment",
        segmentIndex: target === "master" ? undefined : target,
        provider,
      });
      const key = target === "master" ? "master" : `seg-${target}`;
      if (r.success) {
        // Clear any previous failure reason for this board.
        setBoardErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        if (target === "master") {
          setResult({ ...result, storyboardPosterUrl: r.data.url });
        } else {
          const segments = result.breakdown.segments.slice();
          const seg = segments[target];
          if (seg) segments[target] = { ...seg, first_frame_url: r.data.url };
          setResult({ ...result, breakdown: { ...result.breakdown, segments } });
        }
      } else {
        setBoardErrors((prev) => ({ ...prev, [key]: r.error }));
        setError(r.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regenerate failed");
    } finally {
      setRegenTarget(null);
    }
  };

  // ─── Generate a clean keyframe (veoflow first-frame) for one clip ──
  const genKeyframe = async (index: number) => {
    if (!genInput || !genAnalysis || !result || keyframeBusy !== null) return;
    setKeyframeBusy(index);
    try {
      const r = await generateBoardImage({
        input: genInput,
        breakdown: result.breakdown,
        analysis: genAnalysis,
        kind: "keyframe",
        segmentIndex: index,
        provider,
      });
      if (r.success) {
        const segments = result.breakdown.segments.slice();
        const seg = segments[index];
        if (seg) segments[index] = { ...seg, keyframe_url: r.data.url };
        setResult({ ...result, breakdown: { ...result.breakdown, segments } });
      } else {
        setError(r.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Keyframe failed");
    } finally {
      setKeyframeBusy(null);
    }
  };

  // ─── Downloads ───────────────────────────────────────────────────

  const downloadImage = async (url: string, filename: string) => {
    try {
      // Works for both data URIs (Gemini) and remote URLs (DALL-E)
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      // Fallback: open in new tab if fetch fails (e.g. CORS)
      window.open(url, "_blank");
    }
  };

  const copyVideoPrompt = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.videoPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySegmentPrompt = (segNumber: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSeg(segNumber);
    setTimeout(() => setCopiedSeg(null), 2000);
  };

  // Download all segment frames + prompts as a single ZIP.
  const downloadAllFrames = async () => {
    if (!result) return;
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const safeTitle = result.breakdown.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);

      // Frames (board) + clean keyframes (Veo first-frame)
      for (const seg of result.breakdown.segments) {
        const num = String(seg.segment_number).padStart(2, "0");
        if (seg.first_frame_url) {
          try {
            const blob = await (await fetch(seg.first_frame_url)).blob();
            zip.file(`board_${num}.png`, blob);
          } catch {}
        }
        if (seg.keyframe_url) {
          try {
            const blob = await (await fetch(seg.keyframe_url)).blob();
            zip.file(`keyframe_${num}.jpg`, blob);
          } catch {}
        }
      }
      // Ref sheet + poster
      if (result.characterRefSheetUrl) {
        try {
          const b = await (await fetch(result.characterRefSheetUrl)).blob();
          zip.file(`character_reference_sheet.png`, b);
        } catch {}
      }
      if (result.storyboardPosterUrl) {
        try {
          const b = await (await fetch(result.storyboardPosterUrl)).blob();
          zip.file(`storyboard_overview.png`, b);
        } catch {}
      }
      // Assembly guide / prompts
      zip.file(`video_assembly_guide.txt`, result.videoPrompt);

      const out = await zip.generateAsync({ type: "blob" });
      const objectUrl = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${safeTitle || "storyboard"}_package.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } finally {
      setZipping(false);
    }
  };

  // ─── Language Toggle Button ──────────────────────────────────────

  const LangToggle = () => (
    <Button
      variant="outline"
      size="sm"
      onClick={() => setLang((l) => (l === "vi" ? "en" : "vi"))}
      className="gap-1.5 text-xs"
    >
      <Globe className="h-3.5 w-3.5" />
      {L("langLabel")}
    </Button>
  );

  // ─── Generating Phase ──────────────────────────────────────────────

  if (phase === "generating") {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <Loader2 className="mx-auto mb-6 h-12 w-12 animate-spin text-primary" />
        <h2 className="mb-2 text-xl font-bold">{L("generating")}</h2>
        <p className="mb-6 text-sm text-muted-foreground">{progressMessage}</p>
        <Progress value={progressPercent} showLabel className="mx-auto max-w-xs" />
      </div>
    );
  }

  // ─── Script Review / Edit Phase ─────────────────────────────────────
  if (phase === "script" && draft) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {lang === "vi" ? "Duyệt & sửa kịch bản" : "Review & edit the script"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {lang === "vi"
                ? "Kiểm tra & sửa kịch bản TRƯỚC khi vẽ ảnh (sửa ở đây miễn phí, nhanh). Đặc biệt: kiểm tra giới tính/diện mạo nhân vật và lời thoại. Ưng rồi bấm 'Dựng Storyboard'."
                : "Check & fix the script BEFORE drawing (editing here is free & fast). Especially verify the character's gender/look and the dialogue. Then hit 'Build storyboard'."}
            </p>
          </div>
          <LangToggle />
        </div>

        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {/* Title */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <label className="text-xs font-medium text-muted-foreground">
              {lang === "vi" ? "Tiêu đề" : "Title"}
            </label>
            <Input value={draft.title} onChange={(e) => setDraft((d) => (d ? { ...d, title: e.target.value } : d))} />
            {draft.synopsis && <p className="text-xs text-muted-foreground">{draft.synopsis}</p>}
          </CardContent>
        </Card>

        {/* Characters */}
        {draft.character_locks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" /> {lang === "vi" ? "Nhân vật" : "Characters"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {draft.character_locks.map((c, i) => (
                <div key={i} className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {lang === "vi" ? "Giới tính ⚠️" : "Gender ⚠️"}
                      </label>
                      <Select
                        value={c.gender ?? ""}
                        onChange={(e) => updateChar(i, "gender", e.target.value)}
                        options={[
                          { value: "male", label: lang === "vi" ? "Nam" : "Male" },
                          { value: "female", label: lang === "vi" ? "Nữ" : "Female" },
                        ]}
                        placeholder={lang === "vi" ? "Chọn..." : "Pick..."}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {lang === "vi" ? "Tuổi" : "Age"}
                      </label>
                      <Input value={c.gender_age ?? ""} onChange={(e) => updateChar(i, "gender_age", e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        {lang === "vi" ? "Trang phục" : "Costume"}
                      </label>
                      <Input value={c.costume ?? ""} onChange={(e) => updateChar(i, "costume", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "vi" ? "Đặc điểm nhận dạng" : "Signature features"}
                    </label>
                    <Textarea
                      value={c.signature_features ?? ""}
                      onChange={(e) => updateChar(i, "signature_features", e.target.value)}
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                {lang === "vi"
                  ? "⚠️ Nếu giới tính/diện mạo sai so với ảnh bạn tải, sửa ở đây — nó sẽ áp dụng cho toàn bộ board."
                  : "⚠️ If the gender/look is wrong vs your photo, fix it here — it applies to every board."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Segments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Film className="h-4 w-4" /> {lang === "vi" ? "Các cảnh" : "Scenes"} ({draft.segments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {draft.segments.map((s, i) => (
              <div key={i} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Badge>#{s.segment_number}</Badge>
                  <Badge variant="secondary" className="uppercase">{s.marketing_role}</Badge>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {lang === "vi" ? "Tiêu đề cảnh" : "Scene title"}
                  </label>
                  <Input value={s.title} onChange={(e) => updateSeg(i, "title", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {lang === "vi" ? "Hành động (mô tả cảnh quay)" : "Action (motion)"}
                  </label>
                  <Textarea
                    value={s.motion_prompt ?? ""}
                    onChange={(e) => updateSeg(i, "motion_prompt", e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {lang === "vi" ? "Lời thoại" : "Dialogue"}
                  </label>
                  <Input
                    value={s.dialogue ?? ""}
                    onChange={(e) => updateSeg(i, "dialogue", e.target.value)}
                    placeholder={lang === "vi" ? "(không có thoại)" : "(no dialogue)"}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => setPhase("input")} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> {lang === "vi" ? "Quay lại brief" : "Back to brief"}
          </Button>
          <Button onClick={buildStoryboardFromScript} className="gap-2">
            <Sparkles className="h-4 w-4" /> {lang === "vi" ? "Dựng Storyboard" : "Build storyboard"}
          </Button>
        </div>
      </div>
    );
  }


  // ─── Result Phase ──────────────────────────────────────────────────

  if (phase === "result" && result) {
    const hasCharSheet = !!result.characterRefSheetUrl;
    const hasPoster = !!result.storyboardPosterUrl;
    const hasWarnings = result.warnings && result.warnings.length > 0;

    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{result.breakdown.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{result.breakdown.synopsis}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{result.breakdown.segments.length} {L("segments")}</Badge>
              <Badge variant="secondary">≈{result.breakdown.total_duration_seconds}s</Badge>
              {result.breakdown.mood_tags.map((tag) => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <LangToggle />
            <Button variant="outline" onClick={downloadAllFrames} disabled={zipping} className="gap-2">
              {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {L("downloadAll")}
            </Button>
            <Button onClick={() => { setPhase("input"); setResult(null); setStep(0); }} className="gap-2">
              <RotateCw className="h-4 w-4" /> {L("newStoryboard")}
            </Button>
          </div>
        </div>

        {/* Warnings */}
        {hasWarnings && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-600 dark:bg-yellow-950">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  {lang === "vi" ? "Cảnh báo trong quá trình tạo:" : "Warnings during generation:"}
                </p>
                <ul className="mt-1 list-disc pl-4 text-yellow-700 dark:text-yellow-300">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* How to use */}
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Film className="h-5 w-5 text-primary" />
              {L("howToTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {[L("howToStep1"), L("howToStep2"), L("howToStep3"), L("howToStep4")].map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Character Reference Sheet — only shown if one was generated.
            (The per-board flow no longer produces a separate sheet; each board
            carries its own character-ref strip, so we don't show a failure
            card when it's intentionally absent.) */}
        {hasCharSheet && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  {lang === "vi" ? "Bảng Tham Chiếu Nhân Vật" : "Character Reference Sheet"}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => downloadImage(result.characterRefSheetUrl!, `character-ref-${result.breakdown.title.replace(/[^a-zA-Z0-9]/g, "_")}.png`)} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  {lang === "vi" ? "Tải ảnh" : "Download"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <img src={result.characterRefSheetUrl!} alt="Character Reference Sheet" className="w-full" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Storyboard Poster */}
        {hasPoster ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ImageIcon className="h-5 w-5" />
                  {lang === "vi" ? "Bảng Storyboard Tổng (Sheet + Action + Lời thoại)" : "Master Board (Sheet + Action + Dialogue)"}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={regenTarget !== null} onClick={() => regenerateBoard("master")} className="gap-1.5">
                    {regenTarget === "master" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                    {lang === "vi" ? "Tạo lại" : "Redo"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadImage(result.storyboardPosterUrl!, `storyboard-${result.breakdown.title.replace(/[^a-zA-Z0-9]/g, "_")}.png`)} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    {lang === "vi" ? "Tải ảnh" : "Download"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <img src={result.storyboardPosterUrl!} alt="Storyboard Poster" className="w-full" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {lang === "vi"
                  ? `Bố cục tài liệu production: Character Sheet bên trái + lưới ${result.breakdown.segments.length} panel kèm Action & Lời thoại — dùng để trình bày/duyệt kịch bản`
                  : `Production-document layout: Character Sheet on the left + ${result.breakdown.segments.length}-panel grid with Action & Dialogue captions — for presenting/approving the script`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                {lang === "vi" ? "Bảng Storyboard Tổng không tạo được" : "Master Board could not be generated"}
              </p>
              {boardErrors["master"] && (
                <p className="mt-1 max-w-md text-xs text-destructive/80">{boardErrors["master"]}</p>
              )}
              <Button variant="outline" size="sm" disabled={regenTarget !== null} onClick={() => regenerateBoard("master")} className="mt-3 gap-1.5">
                {regenTarget === "master" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                {lang === "vi" ? "Thử lại" : "Retry"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Segments — the core: per-8s first frame + motion prompt */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Film className="h-5 w-5" />
            <h2 className="text-lg font-bold">{L("segmentsTitle")}</h2>
          </div>
          <p className="mb-2 text-sm text-muted-foreground">{L("segmentsHint")}</p>
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-xs text-primary">
            <RotateCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {lang === "vi"
                ? "Duyệt chất lượng từng ảnh trước khi xuất. Board nào chưa nét/chưa giống nhân vật, bấm nút Tạo lại ↻ trên thẻ đó để vẽ lại riêng board ấy — không phải dựng lại toàn bộ. Ưng hết thì mới tải ZIP."
                : "Review each board's quality before exporting. If a board is soft or off-model, hit the Redo ↻ button on that card to re-render just that one — no need to rebuild everything. Download the ZIP once you're happy."}
            </span>
          </div>

          <div className="grid gap-4">
            {result.breakdown.segments.map((seg) => (
              <Card key={seg.segment_number} className="overflow-hidden">
                <div className="relative aspect-[16/9] bg-black/90">
                  {seg.first_frame_url ? (
                    <img src={seg.first_frame_url} alt={`Segment ${seg.segment_number}`} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center text-muted-foreground">
                      <ImageIcon className="h-6 w-6 opacity-50" />
                      <span className="text-xs">{lang === "vi" ? "Frame lỗi" : "Frame failed"}</span>
                      {boardErrors[`seg-${result.breakdown.segments.indexOf(seg)}`] && (
                        <span className="mt-0.5 max-w-full text-[10px] leading-tight text-destructive/80">
                          {boardErrors[`seg-${result.breakdown.segments.indexOf(seg)}`]}
                        </span>
                      )}
                      <span className="mt-1 text-[10px] opacity-70">
                        {lang === "vi" ? "Bấm ↻ để thử lại" : "Press ↻ to retry"}
                      </span>
                    </div>
                  )}
                  <Badge className="absolute left-2 top-2">#{seg.segment_number}</Badge>
                  <Badge variant="secondary" className="absolute right-2 top-2 uppercase">{seg.marketing_role}</Badge>
                  <Badge variant="outline" className="absolute bottom-2 right-2 bg-background/80">{seg.duration_seconds}s</Badge>
                </div>
                <CardContent className="space-y-3 p-3">
                  <div>
                    <p className="text-sm font-semibold">{seg.title}</p>
                    {seg.beats?.[0]?.beat && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-semibold">{L("actionLabel")}:</span> {seg.beats[0].beat}
                      </p>
                    )}
                    {seg.dialogue && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-semibold">{L("dialogueLabel")}:</span>{" "}
                        <span className="italic">&ldquo;{seg.dialogue}&rdquo;</span>
                      </p>
                    )}
                  </div>

                  {seg.beats && seg.beats.length > 0 && (
                    <ul className="space-y-0.5">
                      {seg.beats.map((b, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground">
                          <span className="font-mono text-primary">{b.camera}</span> — {b.beat}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="rounded-md bg-muted p-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">{L("motionPrompt")}</p>
                    <p className="text-[11px] leading-relaxed">{seg.full_prompt ?? seg.motion_prompt}</p>
                  </div>

                  {seg.continuity_note && (
                    <p className="text-[10px] text-muted-foreground">
                      <span className="font-semibold">{L("continuity")}:</span> {seg.continuity_note}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1.5"
                      onClick={() => copySegmentPrompt(seg.segment_number, seg.full_prompt ?? seg.motion_prompt)}
                    >
                      {copiedSeg === seg.segment_number ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedSeg === seg.segment_number ? (lang === "vi" ? "Đã copy" : "Copied") : L("copyPrompt")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={regenTarget !== null}
                      title={lang === "vi" ? "Chưa ưng? Vẽ lại board này" : "Not happy? Re-render this board"}
                      onClick={() => regenerateBoard(result.breakdown.segments.indexOf(seg))}
                    >
                      {regenTarget === result.breakdown.segments.indexOf(seg) ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {seg.first_frame_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => downloadImage(seg.first_frame_url!, `frame_${String(seg.segment_number).padStart(2, "0")}.png`)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Clean keyframe (veoflow first-frame for Veo image-to-video) */}
                  <div className="rounded-md border border-dashed p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {lang === "vi" ? "Keyframe sạch (ảnh đầu cho Veo)" : "Clean keyframe (Veo first-frame)"}
                      </p>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={keyframeBusy !== null}
                          onClick={() => genKeyframe(result.breakdown.segments.indexOf(seg))}
                          className="h-7 gap-1.5 text-[11px]"
                        >
                          {keyframeBusy === result.breakdown.segments.indexOf(seg) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ImageIcon className="h-3 w-3" />
                          )}
                          {seg.keyframe_url
                            ? lang === "vi" ? "Tạo lại" : "Redo"
                            : lang === "vi" ? "Tạo keyframe" : "Make keyframe"}
                        </Button>
                        {seg.keyframe_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-[11px]"
                            onClick={() => downloadImage(seg.keyframe_url!, `keyframe_${String(seg.segment_number).padStart(2, "0")}.jpg`)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {seg.keyframe_url && (
                      <img src={seg.keyframe_url} alt={`Keyframe ${seg.segment_number}`} className="mt-2 w-full rounded border" />
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {lang === "vi"
                        ? "Ảnh tĩnh 1 cảnh, đúng DNA/scene-bible — đẩy vào Veo (image-to-video) làm ảnh đầu."
                        : "Single static frame with locked DNA/scene-bible — feed into Veo (image-to-video) as the first frame."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Assembly Guide */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Film className="h-5 w-5" />
                {L("assemblyGuide")}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={copyVideoPrompt} className="gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? (lang === "vi" ? "Đã copy" : "Copied") : "Copy"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-xs font-mono">
              {result.videoPrompt}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Input Phase (Wizard) ──────────────────────────────────────────

  const canNext = step === 0 ? storyIdea.trim().length > 0 : true;

  // ─── Admin Modal (hidden double-click trigger) ───────────────────
  const adminModal = showAdmin && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={closeAdmin}
    >
      <div
        className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-bold">{L("adminTitle")}</h3>

        {!adminUnlocked ? (
          <div className="space-y-3">
            <label className="text-sm text-muted-foreground">{L("adminPwPrompt")}</label>
            <Input
              type="password"
              value={pwInput}
              onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") checkPassword(); }}
              placeholder={L("adminPwPlaceholder")}
              autoFocus
            />
            {pwError && <p className="text-xs text-destructive">{L("adminPwError")}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={closeAdmin}>{L("adminClose")}</Button>
              <Button size="sm" onClick={checkPassword}>{L("adminUnlock")}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium">{L("adminProviderLabel")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{L("adminProviderHint")}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => switchProvider("openai")}
                className={`rounded-lg border-2 p-3 text-center text-sm font-medium transition ${
                  provider === "openai"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted text-muted-foreground hover:border-primary/40"
                }`}
              >
                OpenAI
                <span className="mt-0.5 block text-[10px] font-normal opacity-70">GPT-4o · DALL-E 3</span>
              </button>
              <button
                onClick={() => switchProvider("gemini")}
                className={`rounded-lg border-2 p-3 text-center text-sm font-medium transition ${
                  provider === "gemini"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted text-muted-foreground hover:border-primary/40"
                }`}
              >
                Gemini
                <span className="mt-0.5 block text-[10px] font-normal opacity-70">Nano Banana Pro</span>
              </button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {L("adminCurrentProvider")}: <strong className="uppercase">{provider}</strong>
            </p>

            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={closeAdmin}>{L("adminClose")}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Hidden trigger: low-opacity dot, double-click to open admin panel
  const hiddenTrigger = (
    <div
      onDoubleClick={() => setShowAdmin(true)}
      title=""
      className="fixed bottom-2 right-2 z-40 h-4 w-4 cursor-default select-none rounded-full opacity-[0.06] hover:opacity-20"
      style={{ backgroundColor: "currentColor" }}
      aria-hidden="true"
    />
  );

  return (
    <div className="mx-auto max-w-2xl">
      {hiddenTrigger}
      {adminModal}
      <div className="mb-6 text-center">
        <div className="mb-3 flex justify-center">
          <LangToggle />
        </div>
        <h1 className="text-3xl font-bold">{L("pageTitle")}</h1>
        <p className="mt-1 text-muted-foreground">{L("pageSubtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{steps[step]}</CardTitle>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {steps.map((s, i) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={i <= step ? "font-bold text-primary" : ""}>{i + 1}</span>
                  {i < steps.length - 1 && <ChevronRight className="h-3 w-3" />}
                </span>
              ))}
            </div>
          </div>
          <Progress value={((step + 1) / steps.length) * 100} />
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ── Step 1: Story ─────────────────────────────────────── */}
          {step === 0 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{L("storyIdea")}</label>
                <Textarea
                  value={storyIdea}
                  onChange={(e) => setStoryIdea(e.target.value)}
                  placeholder={L("storyIdeaPlaceholder")}
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{L("genre")}</label>
                  <Select value={genre} onChange={(e) => setGenre(e.target.value)} options={GENRE_OPTIONS[lang]} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{L("setting")}</label>
                  <Select
                    value={settingSel}
                    onChange={(e) => setSettingSel(e.target.value)}
                    options={SETTING_OPTIONS[lang]}
                    placeholder={L("settingPlaceholder")}
                  />
                  {settingSel === CUSTOM && (
                    <Input value={settingCustom} onChange={(e) => setSettingCustom(e.target.value)} placeholder={L("settingCustomPlaceholder")} />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{L("tone")}</label>
                <Select
                  value={toneSel}
                  onChange={(e) => setToneSel(e.target.value)}
                  options={TONE_OPTIONS[lang]}
                  placeholder={L("tonePlaceholder")}
                />
                {toneSel === CUSTOM && (
                  <Input value={toneCustom} onChange={(e) => setToneCustom(e.target.value)} placeholder={L("toneCustomPlaceholder")} />
                )}
              </div>

              {/* Brief — product (ad genres) vs story (narrative genres) */}
              {isAdGenre ? (
                <div className="space-y-3 rounded-lg border border-dashed p-4">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{L("productBriefTitle")}</p>
                      <p className="text-xs text-muted-foreground">{L("productBriefHint")}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{L("productName")}</label>
                    <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder={L("productNamePlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{L("sellingPoints")}</label>
                    <Textarea
                      value={sellingPoints}
                      onChange={(e) => setSellingPoints(e.target.value)}
                      placeholder={L("sellingPointsPlaceholder")}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{L("targetAudience")}</label>
                      <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder={L("targetAudiencePlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{L("callToAction")}</label>
                      <Input value={callToAction} onChange={(e) => setCallToAction(e.target.value)} placeholder={L("callToActionPlaceholder")} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{L("keyMessage")}</label>
                    <Input value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} placeholder={L("keyMessagePlaceholder")} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-dashed p-4">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{L("storyBriefTitle")}</p>
                      <p className="text-xs text-muted-foreground">{L("storyBriefHint")}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{L("mainCharacter")}</label>
                    <Input value={mainCharacter} onChange={(e) => setMainCharacter(e.target.value)} placeholder={L("mainCharacterPlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{L("centralConflict")}</label>
                    <Textarea
                      value={centralConflict}
                      onChange={(e) => setCentralConflict(e.target.value)}
                      placeholder={L("centralConflictPlaceholder")}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{L("themeMessage")}</label>
                      <Input value={keyMessage} onChange={(e) => setKeyMessage(e.target.value)} placeholder={L("themeMessagePlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{L("audienceLabel")}</label>
                      <Input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder={L("audiencePlaceholder")} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Characters ────────────────────────────────── */}
          {step === 1 && (
            <>
              {fromStudio && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm text-primary">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>{lang === "vi" ? "Đã nhận ảnh đã duyệt từ Image Studio làm ảnh tham chiếu nhân vật." : "Approved images from Image Studio loaded as character references."}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                <span>{L("charHint")}</span>
              </div>

              {characters.length > 0 && (
                <div className="space-y-2">
                  {characters.map((c, i) => (
                    <div key={i} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="flex gap-3">
                        {c.images.length > 0 && (
                          <div className="flex gap-1">
                            {c.images.map((img) => (
                              <img key={img.id} src={img.preview} alt="" className="h-12 w-12 rounded object-cover" />
                            ))}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.role}{c.appearance ? ` — ${c.appearance}` : ""}</p>
                          <p className="text-xs text-muted-foreground">{c.images.length} {L("photos")}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setCharacters((p) => p.filter((_, j) => j !== i))}>
                        {L("remove")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <div className="grid grid-cols-2 gap-2">
                  <Input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder={L("charName")} />
                  <Input value={charRole} onChange={(e) => setCharRole(e.target.value)} placeholder={L("charRole")} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {lang === "vi" ? "Mô tả ngoại hình (chọn nhanh)" : "Appearance (quick pick)"}
                  </label>
                  <Select
                    value={charApprSel}
                    onChange={(e) => setCharApprSel(e.target.value)}
                    options={CHAR_APPR_OPTIONS[lang]}
                    placeholder={lang === "vi" ? "Chọn mô tả..." : "Choose..."}
                  />
                  {charApprSel === CUSTOM && (
                    <Input value={charAppearance} onChange={(e) => setCharAppearance(e.target.value)} placeholder={L("charAppearance")} />
                  )}
                </div>
                <ImageUploader
                  images={charImages}
                  onChange={setCharImages}
                  maxImages={3}
                  label={L("charPhotos")}
                  hint={L("charPhotosHint")}
                />

                <CharacterStudio
                  sourceImages={charImages}
                  onApprove={(img) => setCharImages((prev) => [...prev, img].slice(0, 6))}
                />

                {/* Expression control for the board CHARACTER REFERENCE strip */}
                <div className="space-y-1.5 rounded-lg border border-dashed p-3">
                  <label className="text-sm font-medium">{L("refExprTitle")}</label>
                  <Select
                    value={String(refExpressions)}
                    onChange={(e) => setRefExpressions(Number(e.target.value))}
                    options={[
                      { value: "0", label: L("refExpr0") },
                      { value: "2", label: L("refExpr2") },
                      { value: "3", label: L("refExpr3") },
                    ]}
                  />
                  <p className="text-xs text-muted-foreground">{L("refExprHint")}</p>
                </div>

                <Button variant="outline" size="sm" onClick={addCharacter} disabled={!charName.trim()}>
                  {L("addCharacter")}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 3: Products ──────────────────────────────────── */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4 shrink-0" />
                <span>{L("prodHint")}</span>
              </div>

              {products.length > 0 && (
                <div className="space-y-2">
                  {products.map((p, i) => (
                    <div key={i} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="flex gap-3">
                        {p.images.length > 0 && (
                          <div className="flex gap-1">
                            {p.images.map((img) => (
                              <img key={img.id} src={img.preview} alt="" className="h-12 w-12 rounded object-cover" />
                            ))}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.description || L("noDesc")}</p>
                          <p className="text-xs text-muted-foreground">{p.images.length} {L("photos")}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setProducts((prev) => prev.filter((_, j) => j !== i))}>
                        {L("remove")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <Input value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder={L("prodName")} />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {lang === "vi" ? "Mô tả sản phẩm (chọn nhanh)" : "Product description (quick pick)"}
                  </label>
                  <Select
                    value={prodDescSel}
                    onChange={(e) => setProdDescSel(e.target.value)}
                    options={PROD_DESC_OPTIONS[lang]}
                    placeholder={lang === "vi" ? "Chọn mô tả..." : "Choose..."}
                  />
                  {prodDescSel === CUSTOM && (
                    <Input value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} placeholder={L("prodDesc")} />
                  )}
                </div>
                <ImageUploader
                  images={prodImages}
                  onChange={setProdImages}
                  maxImages={3}
                  label={L("prodPhotos")}
                  hint={L("prodPhotosHint")}
                />
                <Button variant="outline" size="sm" onClick={addProduct} disabled={!prodName.trim()}>
                  {L("addProduct")}
                </Button>
              </div>

              {/* Auxiliary / ingredient images (named) */}
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium text-foreground">{L("ingTitle")}</p>
                  <p className="text-xs">{L("ingHint")}</p>
                </div>
              </div>

              {ingredients.length > 0 && (
                <div className="space-y-2">
                  {ingredients.map((g, i) => (
                    <div key={i} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="flex gap-3">
                        {g.images.length > 0 && (
                          <div className="flex gap-1">
                            {g.images.map((img) => (
                              <img key={img.id} src={img.preview} alt="" className="h-12 w-12 rounded object-cover" />
                            ))}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{g.name}</p>
                          <p className="text-xs text-muted-foreground">{g.description || L("noDesc")}</p>
                          <p className="text-xs text-muted-foreground">{g.images.length} {L("photos")}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setIngredients((prev) => prev.filter((_, j) => j !== i))}>
                        {L("remove")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <Input value={ingName} onChange={(e) => setIngName(e.target.value)} placeholder={L("ingName")} />
                <Input value={ingDesc} onChange={(e) => setIngDesc(e.target.value)} placeholder={L("ingDesc")} />
                <ImageUploader
                  images={ingImages}
                  onChange={setIngImages}
                  maxImages={2}
                  label={L("ingImage")}
                  hint={L("ingImageHint")}
                />
                <Button variant="outline" size="sm" onClick={addIngredient} disabled={!ingName.trim() || ingImages.length === 0}>
                  {L("addIngredient")}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 4: Background ───────────────────────────────── */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{L("bgHint")}</span>
              </div>

              {backgrounds.length > 0 && (
                <div className="space-y-2">
                  {backgrounds.map((b, i) => (
                    <div key={i} className="flex items-start justify-between rounded-lg border p-3">
                      <div className="flex gap-3">
                        {b.images.length > 0 && (
                          <div className="flex gap-1">
                            {b.images.map((img) => (
                              <img key={img.id} src={img.preview} alt="" className="h-12 w-12 rounded object-cover" />
                            ))}
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{b.name}</p>
                          <p className="text-xs text-muted-foreground">{b.description || L("noDesc")}</p>
                          <p className="text-xs text-muted-foreground">{b.images.length} {L("photos")}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setBackgrounds((prev) => prev.filter((_, j) => j !== i))}>
                        {L("remove")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 rounded-lg border border-dashed p-4">
                <Input value={bgName} onChange={(e) => setBgName(e.target.value)} placeholder={L("bgName")} />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {lang === "vi" ? "Mô tả bối cảnh (chọn nhanh)" : "Location description (quick pick)"}
                  </label>
                  <Select
                    value={bgDescSel}
                    onChange={(e) => setBgDescSel(e.target.value)}
                    options={BG_DESC_OPTIONS[lang]}
                    placeholder={lang === "vi" ? "Chọn mô tả..." : "Choose..."}
                  />
                  {bgDescSel === CUSTOM && (
                    <Input value={bgDesc} onChange={(e) => setBgDesc(e.target.value)} placeholder={L("bgDesc")} />
                  )}
                </div>
                <ImageUploader
                  images={bgImages}
                  onChange={setBgImages}
                  maxImages={3}
                  label={L("bgPhotos")}
                  hint={L("bgPhotosHint")}
                />
                <Button variant="outline" size="sm" onClick={addBackground} disabled={!bgName.trim()}>
                  {L("addBackground")}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 5: Style & Generate ─────────────────────────── */}
          {step === 4 && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{L("videoGoalLabel")}</label>
                <Select value={videoGoal} onChange={(e) => setVideoGoal(e.target.value as VideoGoal)} options={VIDEO_GOAL_OPTIONS[lang]} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{L("visualStyle")}</label>
                <Select value={style} onChange={(e) => setStyle(e.target.value as StoryboardStyle)} options={STYLE_OPTIONS[lang]} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{L("segmentCount")}</label>
                <Select value={String(segmentCount)} onChange={(e) => setSegmentCount(Number(e.target.value))} options={SEGMENT_OPTIONS} />
                <p className="text-xs text-muted-foreground">{L("segmentCountHint")}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{L("beatsLabel")}</label>
                <Select value={String(beatsPerSegment)} onChange={(e) => setBeatsPerSegment(Number(e.target.value))} options={BEATS_OPTIONS[lang]} />
                <p className="text-xs text-muted-foreground">{L("beatsHint")}</p>
              </div>

              <div className="rounded-lg border p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={forceVietnameseDialogue}
                    onChange={(e) => setForceVietnameseDialogue(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    <span className="text-sm font-medium">{L("forceDialogueLabel")}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{L("forceDialogueHint")}</span>
                  </span>
                </label>
              </div>

              {/* Aspect ratio */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{L("aspectRatio")}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAspectRatio("16:9")}
                    className={`rounded-lg border-2 p-3 text-center text-sm font-medium transition ${
                      aspectRatio === "16:9"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="mx-auto mb-1 block h-5 w-9 rounded-sm border-2 border-current" />
                    {L("aspectLandscape")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspectRatio("9:16")}
                    className={`rounded-lg border-2 p-3 text-center text-sm font-medium transition ${
                      aspectRatio === "9:16"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <span className="mx-auto mb-1 block h-9 w-5 rounded-sm border-2 border-current" />
                    {L("aspectPortrait")}
                  </button>
                </div>
              </div>

              {/* Image quality */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{L("imageQuality")}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImageQuality("standard")}
                    className={`rounded-lg border-2 p-3 text-center text-xs font-medium transition ${
                      imageQuality === "standard"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {L("qualityStandard")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageQuality("pro")}
                    className={`rounded-lg border-2 p-3 text-center text-xs font-medium transition ${
                      imageQuality === "pro"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-muted text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {L("qualityPro")}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{L("qualityHint")}</p>
              </div>

              {/* Summary */}
              <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-1">
                <p className="font-medium">{L("summary")}</p>
                <p className="text-muted-foreground">
                  <strong>{segmentCount}</strong> {L("segments")} (~{segmentCount * 8}s) · <strong>{style}</strong> {L("style")} · <strong>{aspectRatio}</strong> · <strong>{imageQuality === "pro" ? "Pro" : "Standard"}</strong>
                  {characters.length > 0 && <> · {characters.length} {L("characters")}</>}
                  {products.length > 0 && <> · {products.length} {L("products")}</>}
                  {backgrounds.length > 0 && <> · {backgrounds.length} {L("locations")}</>}
                </p>
                {(characters.some((c) => c.images.length > 0) ||
                  products.some((p) => p.images.length > 0) ||
                  backgrounds.some((b) => b.images.length > 0)) && (
                  <p className="text-xs text-muted-foreground">
                    {L("refImageNote")}
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── Error ────────────────────────────────────────────── */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          {/* ── Navigation ───────────────────────────────────────── */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> {L("back")}
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext} className="gap-1">
                {L("next")} <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleGenerate} className="gap-2">
                <Sparkles className="h-4 w-4" />
                {L("generate")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

