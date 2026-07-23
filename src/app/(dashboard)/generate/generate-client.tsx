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
  BookOpen,
  Trash2,
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
  analyzeCookingRecipe,
  generateBoardImage,
  finalizeScript,
  rewriteSegment,
  getTopicLibrary,
  type StoryboardResult,
  type StoryboardAnalysis,
} from "@/actions";
import type { TopicCategory } from "@/services/topics";
import { buildVeoJson, genreAmbientAudio } from "@/prompts";
import { CharacterStudio } from "./character-studio";
import { loadHandoff } from "@/lib/handoff";
import { buildNanoFlowManifest } from "@/lib/nano-flow/manifest";
import {
  NANO_FLOW_MESSAGE_SOURCE,
  NANO_FLOW_MESSAGE_TYPE,
} from "@/types/nano-flow";
import { Send } from "lucide-react";
import type {
  StoryboardStyle,
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  ImageReference,
  AIProvider,
  ImageQuality,
  AspectRatio,
  VideoGoal,
  AudienceGoal,
  StoryFormat,
  VisualInterpretation,
  CharacterRepresentation,
  DirectingProfileId,
} from "@/types";
import type { CookingRecipeIR, CookingStyle } from "@/lib/cooking";
import {
  AUDIENCE_GOAL_OPTIONS as CREATIVE_GOAL_OPTIONS,
  STORY_FORMAT_OPTIONS as CREATIVE_FORMAT_OPTIONS,
  VISUAL_INTERPRETATION_OPTIONS as CREATIVE_INTERPRETATION_OPTIONS,
  CHARACTER_REPRESENTATION_OPTIONS as CREATIVE_CHARACTER_OPTIONS,
  DIRECTING_PROFILE_OPTIONS as CREATIVE_DIRECTING_OPTIONS,
  type CreativeOption,
} from "@/lib/creative-routing";

// ─── Bilingual Labels ──────────────────────────────────────────────────────

type Lang = "vi" | "en";

function localizedCreativeOptions<T extends string>(
  options: CreativeOption<T>[],
  lang: Lang,
): { value: T; label: string }[] {
  return options.map((option) => ({
    value: option.value,
    label: lang === "vi" ? option.label_vi : option.label_en,
  }));
}

function creativeOptionDescription<T extends string>(
  options: CreativeOption<T>[],
  value: T,
  lang: Lang,
): string {
  const option = options.find((item) => item.value === value);
  if (!option) return "";
  return lang === "vi" ? option.description_vi : option.description_en;
}

// ─── Nano Flow (text-only) ─────────────────────────────────────────────────
// When true, Storyboard AI stops generating the paid Gemini "nano banana"
// board images and instead writes scripts + prompts only. The images are
// produced downstream by the AutoFlow Reel extension (free nano banana in
// Google Flow) from the exported manifest. See docs/nano-flow-pipeline/.
const NANO_FLOW_TEXT_ONLY = true;

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
    vi: "Mỗi nhân vật tải tối đa 2 ảnh: ảnh 1 chính diện, ảnh 2 góc nghiêng/3-4. Mỗi người phải được thêm thành một nhân vật riêng.",
    en: "Upload up to 2 photos per character: photo 1 front-facing, photo 2 profile/three-quarter. Add each person as a separate character.",
  },
  charName: { vi: "Tên nhân vật", en: "Character name" },
  charRole: { vi: "Vai trò (VD: Nhân vật chính)", en: "Role (e.g. Main hero)" },
  charAppearance: {
    vi: "Mô tả ngoại hình (không bắt buộc nếu có ảnh)",
    en: "Appearance description (optional if uploading photos)",
  },
  refExprTitle: { vi: "Biểu cảm trong ảnh tham chiếu", en: "Expressions in the reference strip" },
  refExprHint: {
    vi: "Mỗi board dùng đúng 2 portrait cho từng người: chính diện + nghiêng, không toàn thân và không thêm lưới biểu cảm. Board còn có một overview bối cảnh nhỏ.",
    en: "Each board uses exactly 2 portraits per person: front + profile, with no full-body or expression grid. A small environment overview is also included.",
  },
  refExpr0: { vi: "Không — để Veo tự diễn (khuyên dùng)", en: "None — let Veo act it (recommended)" },
  refExpr2: { vi: "2 biểu cảm", en: "2 expressions" },
  refExpr3: { vi: "3 biểu cảm", en: "3 expressions" },
  charPhotos: { vi: "Ảnh nhân vật", en: "Character Photos" },
  charPhotosHint: { vi: "Ảnh 1: chính diện · Ảnh 2: nghiêng/3-4", en: "Photo 1: front · Photo 2: profile/three-quarter" },
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
  // Non-cooking auxiliary object/component references. Cooking has its own
  // separate, explicitly-labelled ingredient intake UI below.
  ingTitle: { vi: "Ảnh phụ / đồ vật tham chiếu (gọi theo tên)", en: "Auxiliary object/component references (by name)" },
  ingHint: {
    vi: "Tải ảnh đồ vật hoặc bộ phận cần xuất hiện (VD: móc áo, modem, chậu cây) kèm TÊN. Đây không phải nguyên liệu đồ ăn và không kích hoạt bối cảnh nấu ăn.",
    en: "Upload a named object or component that must appear (e.g. coat hook, modem, plant pot). These are not food ingredients and never activate cooking imagery.",
  },
  ingName: { vi: "Tên đồ vật / bộ phận (VD: Móc áo gỗ)", en: "Object / component name (e.g. Wooden coat hook)" },
  ingDesc: { vi: "Mô tả ngắn (không bắt buộc)", en: "Short description (optional)" },
  ingImage: { vi: "Ảnh đồ vật / bộ phận", en: "Object / component image" },
  ingImageHint: { vi: "1-2 ảnh rõ nét; chỉ dùng khi cảnh gọi đúng tên đồ vật này", en: "1-2 clear images; used only when the scene calls for this named object" },
  addIngredient: { vi: "Thêm đồ vật / bộ phận", en: "Add object / component" },
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
  segmentCount: { vi: "Số đoạn 10 giây (ghép thành video)", en: "Number of 10s segments (chained into video)" },
  segmentCountHint: {
    vi: "Mỗi đoạn = 1 clip 10s trên Omni Flash. Các đoạn được nối liền mạch (frame cuối → frame đầu) để video không bị khựng.",
    en: "Each segment = one 10s clip on Omni Flash. Segments are chained (last frame → next first frame) for seamless playback.",
  },
  beatsLabel: { vi: "Số cảnh nhỏ trong mỗi đoạn", en: "Shots per segment" },
  beatsHint: {
    vi: "Mỗi đoạn 10s được chia thành nhiều cảnh nhỏ theo từng mốc thời gian (3-5 cảnh).",
    en: "Each 10s segment is split into several quick shots across time frames (3-5).",
  },
  forceDialogueLabel: { vi: "Bắt buộc lời thoại tiếng Việt", en: "Force Vietnamese dialogue" },
  forceDialogueHint: {
    vi: "Mỗi đoạn sẽ có một câu thoại tiếng Việt, được nhúng vào prompt theo định dạng Veo để nhân vật nói đúng (lip-sync, không phụ đề).",
    en: "Every segment gets a Vietnamese spoken line, embedded into the Veo prompt for correct lip-sync (no subtitles).",
  },
  videoGoalLabel: { vi: "Mục tiêu video", en: "Video Goal" },
  imageQuality: { vi: "Chất lượng ảnh", en: "Image Quality" },
  qualityStandard: { vi: "Standard · Nano Banana (rẻ + đẹp) ✓ khuyên dùng", en: "Standard · Nano Banana (cheap + good) ✓ recommended" },
  qualityPro: { vi: "Pro · Nano Banana Pro (giữ mặt tốt nhất, đắt hơn)", en: "Pro · Nano Banana Pro (best face lock, pricier)" },
  qualityHint: {
    vi: "Cả 2 đều là Gemini Nano Banana. Board giờ chỉ để xem nên Standard là đủ đẹp mà rẻ — khuyên dùng. Pro chỉ cần khi bạn muốn giữ mặt cực gắt.",
    en: "Both are Gemini Nano Banana. Boards are review-only now, so Standard is the sweet spot (cheap + good). Use Pro only when you need the strictest face lock.",
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
    vi: "Đang tạo Character Sheet + từng frame 10s (nối liền mạch)...",
    en: "Generating Character Sheet + each 10s frame (chained)...",
  },
  generatingDone: {
    vi: "Sắp xong — đang tạo poster & hướng dẫn ghép video...",
    en: "Almost done — building poster & assembly guide...",
  },

  // How-to-use guide
  howToTitle: { vi: "Cách dùng (làm từng shot một)", en: "How to use (one shot at a time)" },
  howToStep1: {
    vi: "Mỗi shot làm RIÊNG 1 clip 10s. KHÔNG dán cả bảng lớn vào Veo.",
    en: "Each shot is its OWN 10s clip. Do NOT paste the big guide into Veo.",
  },
  howToStep2: {
    vi: "Dùng prompt JSON của từng cảnh trong Text-to-Video hoặc Ingredients/References. Chỉ cần 1 storyboard tổng để duyệt; không bắt buộc tạo keyframe AI cho từng cảnh.",
    en: "Use each scene's JSON prompt in Text-to-Video or Ingredients/References. One master storyboard is enough for review; AI keyframes are optional.",
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
  segmentsTitle: { vi: "Các shot ảnh và keyframe sạch", en: "Shot boards and clean keyframes" },
  segmentsHint: {
    vi: "Storyboard tổng dùng để duyệt bố cục. Tạo video bằng prompt JSON từng cảnh; ảnh nhân vật/bối cảnh đưa vào Ingredients/References nếu có. Nếu dùng Frames-to-Video, có thể crop miễn phí đúng ô cảnh từ bảng tổng; keyframe AI chỉ là tùy chọn.",
    en: "Use the master storyboard for layout review and each scene's JSON to generate video. Add character/location images through Ingredients/References. For Frames-to-Video, crop the matching panel from the master for free; AI keyframes are optional.",
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
    // ── Quảng cáo / thương mại ──
    { value: "advertising", label: "🎬 Quảng cáo / TVC" },
    { value: "product_demo", label: "🎬 Demo / Giới thiệu sản phẩm" },
    { value: "brand_film", label: "🎬 Phim thương hiệu" },
    { value: "luxury", label: "🎬 Luxury brand film (cao cấp)" },
    { value: "promo", label: "🎬 Khuyến mãi / Sale" },
    { value: "unboxing", label: "🎬 Unboxing / Trải nghiệm" },
    // ── Thể loại phim / câu chuyện ──
    { value: "drama", label: "🎭 Chính kịch" },
    { value: "action", label: "🎭 Hành động" },
    { value: "comedy", label: "🎭 Hài" },
    { value: "sitcom", label: "🎭 Sitcom gia đình" },
    { value: "horror", label: "🎭 Kinh dị" },
    { value: "romance", label: "🎭 Tình cảm" },
    { value: "thriller", label: "🎭 Giật gân" },
    { value: "sci-fi", label: "🎭 Khoa học viễn tưởng" },
    { value: "fantasy", label: "🎭 Fantasy / Kỳ ảo" },
    { value: "historical", label: "🎭 Cổ trang / Lịch sử" },
    { value: "mythology", label: "🎭 Thần thoại" },
    { value: "animation", label: "🎭 Hoạt hình" },
    { value: "documentary", label: "🎭 Tài liệu" },
    { value: "mockumentary", label: "🎭 Tài liệu giả (mockumentary)" },
    { value: "music_video", label: "🎭 MV / Video âm nhạc" },
    { value: "kids", label: "🎭 Trẻ em" },
    // ── Tri thức / chuyên đề ──
    { value: "numerology", label: "📚 Thần số học" },
    { value: "health", label: "📚 Sức khoẻ" },
    { value: "psychology", label: "📚 Tâm lý" },
    { value: "life_wisdom", label: "📚 Đạo lý / Ngụ ngôn / Đạo làm người" },
    { value: "education", label: "📚 Giáo dục" },
    { value: "finance", label: "📚 Tài chính" },
    { value: "tech", label: "📚 Công nghệ" },
    // ── Lifestyle / thực hành ──
    { value: "cooking", label: "🍳 Món ăn / Nấu ăn" },
    { value: "fitness", label: "🍳 Thể hình / Tập luyện" },
    { value: "lifestyle", label: "🍳 Lifestyle / Đời sống" },
    { value: "travel", label: "🍳 Du lịch" },
    { value: "nature", label: "🌿 Thiên nhiên / Natural History" },
    { value: "sports", label: "🍳 Thể thao" },
  ],
  en: [
    { value: "advertising", label: "🎬 Advertising / TVC" },
    { value: "product_demo", label: "🎬 Product demo" },
    { value: "brand_film", label: "🎬 Brand film" },
    { value: "luxury", label: "🎬 Luxury brand film" },
    { value: "promo", label: "🎬 Promo / Sale" },
    { value: "unboxing", label: "🎬 Unboxing / Experience" },
    { value: "drama", label: "🎭 Drama" },
    { value: "action", label: "🎭 Action" },
    { value: "comedy", label: "🎭 Comedy" },
    { value: "sitcom", label: "🎭 Family sitcom" },
    { value: "horror", label: "🎭 Horror" },
    { value: "romance", label: "🎭 Romance" },
    { value: "thriller", label: "🎭 Thriller" },
    { value: "sci-fi", label: "🎭 Sci-Fi" },
    { value: "fantasy", label: "🎭 Fantasy" },
    { value: "historical", label: "🎭 Historical / Period" },
    { value: "mythology", label: "🎭 Mythology" },
    { value: "animation", label: "🎭 Animation" },
    { value: "documentary", label: "🎭 Documentary" },
    { value: "mockumentary", label: "🎭 Mockumentary" },
    { value: "music_video", label: "🎭 Music video" },
    { value: "kids", label: "🎭 Kids" },
    { value: "numerology", label: "📚 Numerology" },
    { value: "health", label: "📚 Health" },
    { value: "psychology", label: "📚 Psychology" },
    { value: "life_wisdom", label: "📚 Life wisdom / Parable" },
    { value: "education", label: "📚 Education" },
    { value: "finance", label: "📚 Finance" },
    { value: "tech", label: "📚 Technology" },
    { value: "cooking", label: "🍳 Food / Cooking" },
    { value: "fitness", label: "🍳 Fitness / Workout" },
    { value: "lifestyle", label: "🍳 Lifestyle" },
    { value: "travel", label: "🍳 Travel" },
    { value: "nature", label: "🌿 Nature / Natural History" },
    { value: "sports", label: "🍳 Sports" },
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

// Topic-library genres (numerology / health) → drive the 5-beat framework and
// hide the product/story brief (their content comes from the topic library).
const TOPIC_GENRES = new Set(["numerology", "health", "psychology", "life_wisdom"]);

// Demonstration genres (cooking / fitness) → drive their own framework from the
// idea box (dish name / workout goal); no product or story brief needed.
const DEMO_GENRES = new Set(["cooking", "fitness"]);

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

// Number of 10-second segments to chain into the final video (Omni Flash = 10s/clip).
const SEGMENT_OPTIONS = [
  { value: "3", label: "3 (~30s)" },
  { value: "4", label: "4 (~40s)" },
  { value: "5", label: "5 (~50s)" },
  { value: "6", label: "6 (~60s)" },
  { value: "7", label: "7 (~70s)" },
  { value: "10", label: "10 (~100s)" },
];

// Number of quick shots (mini-frames) inside each 10s segment.
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
    { value: "numerology", label: "Thần số học (Hook→Giải mã→CTA)" },
    { value: "health", label: "Sức khoẻ (Vấn đề→Đồng hành→CTA)" },
    { value: "psychology", label: "Tâm lý (Gọi tên→Cơ chế→Chuyển hoá)" },
    { value: "documentary_story", label: "Tài liệu (Quan sát→Câu hỏi→Đúc kết)" },
    { value: "cooking", label: "Món ăn (Money shot→Các bước→Lưu)" },
    { value: "fitness", label: "Thể hình (Mục tiêu→Động tác→Lưu)" },
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
    { value: "numerology", label: "Numerology (Hook→Insight→CTA)" },
    { value: "health", label: "Health (Problem→Companion→CTA)" },
    { value: "psychology", label: "Psychology (Name it→Mechanism→Reframe)" },
    { value: "documentary_story", label: "Documentary (Observe→Question→Takeaway)" },
    { value: "cooking", label: "Food (Money shot→Steps→Save)" },
    { value: "fitness", label: "Fitness (Goal→Moves→Save)" },
  ],
};

// ─── Description presets (dropdown instead of free typing) ──────────────────
// FORCE_REF = "lock onto the uploaded reference photo for sync" — the option
// the user picks so the tool reproduces the ref image exactly instead of
// inventing from text.
const FORCE_REF = "__force_ref__";

// Character references stay image-only. The uploaded pixels already define
// the person, so FORCE_REF must not inject a second prose description.
const FORCE_TEXT = {
  character: "",
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
// Downscale a rendered board (data URI) to a compact JPEG base64 so it can be
// sent back to the server as a wardrobe/look ANCHOR without bloating the request
// body. Returns null on any failure (we then just skip the anchor — the text
// wardrobe lock still applies). Never hangs.
/** Vietnamese title → readable ASCII slug for export filenames:
 * "Cái ôm đúng lúc" → "cai-om-dung-luc" (instead of "C_i__m__ng_l_c"). */
function toAsciiSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (c) => (c === "đ" ? "d" : "D"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toAnchorBase64(uri: string, max = 1024, quality = 0.8): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    let settled = false;
    const done = (v: string | null) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const img = new Image();
    const timer = setTimeout(() => done(null), 10000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const cx = canvas.getContext("2d");
        if (!cx) return done(null);
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = "high";
        cx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const out = canvas.toDataURL("image/jpeg", quality);
        done(out.split(",")[1] ?? null);
      } catch {
        done(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    img.src = uri;
  });
}

/**
 * Normalise every reference image to a small JPEG before it travels to the
 * server. Uploaded photos are already ~1024px, but studio-generated portraits
 * come back full size (up to 2048px, quality 93) and are used raw — three of
 * them blow past Vercel's hard ~4.5 MB request-body cap, so the platform
 * rejects the whole Server Action before our code runs (the opaque "Server
 * Components render" error). Downscaling here keeps every reference tiny so all
 * of them fit, instead of silently dropping some. Never hangs (toAnchorBase64
 * has an onerror + 10s timeout); on failure it keeps the original.
 */
async function downscaleRefImages(refs: ImageReference[]): Promise<ImageReference[]> {
  const out: ImageReference[] = [];
  for (const ref of refs) {
    const imgs: string[] = [];
    for (const b64 of ref.images) {
      const uri = b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`;
      const small = await toAnchorBase64(uri, 1024, 0.82);
      imgs.push(small ?? b64);
    }
    if (imgs.length > 0) out.push({ ...ref, images: imgs });
  }
  return out;
}

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
  heightCm?: string;
  bodyType: "slim" | "standard" | "stocky";
  /** True when this character is a child (khoá độ tuổi trẻ em). */
  isChild?: boolean;
  images: UploadedImage[];
  /** Nano Flow: user declared this person has a real reference photo that will
   * be attached in the extension (no in-app upload). Keep identity image-only. */
  hasRealPhoto?: boolean;
}

const BODY_TYPE_TEXT: Record<CharacterEntry["bodyType"], string> = {
  slim: "slim build",
  standard: "standard proportional build",
  stocky: "stocky/full build",
};

const BODY_TYPE_LABEL: Record<CharacterEntry["bodyType"], Record<Lang, string>> = {
  slim: { vi: "Gầy", en: "Slim" },
  standard: { vi: "Chuẩn", en: "Standard" },
  stocky: { vi: "Mập / đậm người", en: "Stocky / full" },
};

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
  const [copiedJson, setCopiedJson] = useState<string | null>(null);

  // Kept after a build so any board can be reviewed and re-rendered on demand
  // (the quality-review/redo gate) without rebuilding the whole storyboard.
  const [genInput, setGenInput] = useState<StoryboardGenerationInput | null>(null);
  const [genAnalysis, setGenAnalysis] = useState<StoryboardAnalysis | null>(null);
  const [regenTarget, setRegenTarget] = useState<number | "master" | "thumbnail" | null>(null);
  const [keyframeBusy, setKeyframeBusy] = useState<number | null>(null);
  // Per-board failure reasons, keyed by "seg-<index>" / "master".
  const [boardErrors, setBoardErrors] = useState<Record<string, string>>({});

  // Script-review phase: the editable breakdown + carried plan data.
  const [draft, setDraft] = useState<StoryboardGenerationOutput | null>(null);
  const [planWarnings, setPlanWarnings] = useState<string[]>([]);
  // Per-scene AI rewrite in the script editor (index being rewritten, or null).
  const [rewriteTarget, setRewriteTarget] = useState<number | null>(null);

  // ─── Topic library (Google Sheet: numerology / health scripts) ──
  const [topicCats, setTopicCats] = useState<TopicCategory[]>([]);
  const [topicType, setTopicType] = useState("");
  const [topicItemId, setTopicItemId] = useState("");
  const [topicError, setTopicError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getTopicLibrary().then((r) => {
      if (!alive) return;
      if (r.success) setTopicCats(r.data.categories);
      else setTopicError(r.error);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Set when reference images were handed off from the Image Studio.
  const [fromStudio, setFromStudio] = useState(false);

  // ─── Admin: AI Provider Switch ──────────────────────────────────
  // Default OpenAI. Nano Flow no longer generates images in this app (photos
  // are attached in the extension), so the old "Gemini for face lock" reason no
  // longer applies — the whole script + storyboard text pipeline runs on OpenAI.
  const [provider, setProvider] = useState<AIProvider>("openai");
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);

  // ─── Numerology script tone: inspiring + sharp behavioral analysis (both),
  // or lean fully one way. Default "balanced" (both). Persisted. ──
  const [numerologyStyle, setNumerologyStyle] = useState<
    "inspirational" | "analytical" | "balanced"
  >("balanced");
  // Hook mode: "situation" (default) opens on a real-life scene with NO numbers
  // (the number is revealed at beat 3); "number_callout" is the legacy
  // number-first hook for retargeting followers. Persisted.
  const [numerologyHookMode, setNumerologyHookModeState] = useState<
    "situation" | "number_callout"
  >("situation");
  const setNumerologyHookMode = (m: "situation" | "number_callout") => {
    setNumerologyHookModeState(m);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sb_numerology_hook_mode", m);
    }
  };

  // ─── Script model (default OpenAI — the whole text pipeline is on OpenAI now:
  // gpt-5-mini writes the script, gpt-4o builds the storyboard JSON). Claude
  // Opus timed out too often on the 60s script budget. Still switchable via the
  // hidden panel (double-click the title, passcode 2502). ──
  const [scriptProvider, setScriptProvider] = useState<AIProvider>("openai");
  const [modelPanelOpen, setModelPanelOpen] = useState(false);
  const [modelUnlocked, setModelUnlocked] = useState(false);
  const [modelPw, setModelPw] = useState("");
  const [modelPwError, setModelPwError] = useState(false);

  // Load saved provider choice on mount
  useEffect(() => {
    // Key bumped to _v3 so an older saved "gemini" no longer overrides the new
    // OpenAI default (Nano Flow: no in-app image gen, so no Gemini requirement).
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem("sb_ai_provider_v3")
        : null;
    if (saved === "gemini" || saved === "openai") {
      setProvider(saved);
    }
    // Default script writer is Claude Opus 4.8; a saved manual choice (any of
    // claude/openai/gemini) still overrides it.
    // Key bumped to _v3 so an older saved "claude" no longer overrides the new
    // OpenAI default (Opus kept timing out on the 60s script budget).
    const savedScript =
      typeof window !== "undefined"
        ? window.localStorage.getItem("sb_script_provider_v3")
        : null;
    if (savedScript === "gemini" || savedScript === "openai" || savedScript === "claude") {
      setScriptProvider(savedScript);
    }
    const savedStyle =
      typeof window !== "undefined"
        ? window.localStorage.getItem("sb_numerology_style")
        : null;
    if (savedStyle === "inspirational" || savedStyle === "analytical" || savedStyle === "balanced") {
      setNumerologyStyle(savedStyle);
    }
    const savedHookMode =
      typeof window !== "undefined"
        ? window.localStorage.getItem("sb_numerology_hook_mode")
        : null;
    if (savedHookMode === "situation" || savedHookMode === "number_callout") {
      setNumerologyHookModeState(savedHookMode);
    }
  }, []);

  const switchNumerologyStyle = (s: "inspirational" | "analytical" | "balanced") => {
    setNumerologyStyle(s);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sb_numerology_style", s);
    }
  };

  const switchScriptProvider = (p: AIProvider) => {
    setScriptProvider(p);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sb_script_provider_v3", p);
    }
  };

  const switchProvider = (p: AIProvider) => {
    setProvider(p);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sb_ai_provider_v3", p);
    }
  };

  const checkModelPassword = () => {
    if (modelPw === "2502") {
      setModelUnlocked(true);
      setModelPwError(false);
      setModelPw("");
    } else {
      setModelPwError(true);
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

  // Step 1: Story
  const [storyIdea, setStoryIdea] = useState("");
  const [genre, setGenre] = useState("advertising");
  const steps = t.steps[lang].map((label, index) =>
    genre === "cooking" && index === 2
      ? lang === "vi"
        ? "Công thức & thành phẩm"
        : "Recipe & finished dish"
      : label
  );
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
  // Nano Flow: the user ticks this instead of uploading a photo in-app. The
  // real photo is attached later in the extension; here it only tells the
  // prompt to keep this person's identity image-only (no invented face).
  const [charHasRealPhoto, setCharHasRealPhoto] = useState(false);
  const [charRole, setCharRole] = useState("");
  const [charIsChild, setCharIsChild] = useState(false);
  const [charHeightCm, setCharHeightCm] = useState("");
  const [charBodyType, setCharBodyType] = useState<CharacterEntry["bodyType"]>("standard");
  const [charAppearance, setCharAppearance] = useState("");
  const [charApprSel, setCharApprSel] = useState("");
  const [charImages, setCharImages] = useState<UploadedImage[]>([]);

  // Step 3: Products (main) + genre-routed auxiliary references.
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodDescSel, setProdDescSel] = useState("");
  const [prodImages, setProdImages] = useState<UploadedImage[]>([]);
  // Legacy shared state: non-cooking = named objects/components; cooking =
  // food ingredients. The render branches and server router keep them apart.
  const [ingredients, setIngredients] = useState<ProductEntry[]>([]);
  const [ingName, setIngName] = useState("");
  const [ingDesc, setIngDesc] = useState("");
  const [ingImages, setIngImages] = useState<UploadedImage[]>([]);

  // Cooking-only intake. The source photos/text are OCR'd once into Recipe IR;
  // only the compact, reviewable IR enters the storyboard compiler.
  const [cookingSourceText, setCookingSourceText] = useState("");
  const [cookingSourceImages, setCookingSourceImages] = useState<UploadedImage[]>([]);
  // Neutral default. Nature ASMR is an explicit choice, never inferred merely
  // because the user once supplied an outdoor creator as style inspiration.
  const [cookingStyle, setCookingStyle] = useState<CookingStyle>("kitchen_asmr");
  const [cookingRecipe, setCookingRecipe] = useState<CookingRecipeIR | null>(null);
  const [cookingAnalyzing, setCookingAnalyzing] = useState(false);
  const [cookingAnalysisError, setCookingAnalysisError] = useState<string | null>(null);
  const cookingHandsOnly =
    genre === "cooking" &&
    ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(cookingStyle);

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
    let cancelled = false;
    (async () => {
      const h = await loadHandoff<{
        characterImages?: string[];
        productImages?: string[];
        // Optional seed from the Video Analyzer (/analyze)
        storyIdea?: string;
        productName?: string;
        segmentCount?: number;
        forceDialogue?: boolean;
      }>();
      if (!h || cancelled) return;
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
      // Seed from the Video Analyzer: prefill the brief so the user just reviews.
      const fromAnalyze = typeof h.storyIdea === "string" && h.storyIdea.length > 0;
      if (fromAnalyze) {
        setStoryIdea(h.storyIdea!);
        if (h.productName) setProductName(h.productName);
        if (typeof h.segmentCount === "number")
          setSegmentCount(Math.min(10, Math.max(3, h.segmentCount)));
        if (typeof h.forceDialogue === "boolean") setForceVietnameseDialogue(h.forceDialogue);
      }
      setFromStudio(true);
      setStep(fromAnalyze ? 0 : 1);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 5: Style
  const [style, setStyle] = useState<StoryboardStyle>("cinematic");
  // Character render mode: hard photoreal lock / stylized / auto (see types).
  const [characterRender, setCharacterRender] = useState<"auto" | "photo" | "stylized">("auto");
  const [segmentCount, setSegmentCount] = useState(4);
  const [beatsPerSegment, setBeatsPerSegment] = useState(3);
  const [forceVietnameseDialogue, setForceVietnameseDialogue] = useState(true);
  const [videoGoal, setVideoGoal] = useState<VideoGoal>("product_ad");
  // Ordered creative route. Legacy videoGoal/style remain for compatibility,
  // but these independent axes stop topic, objective and rendering from leaking
  // into one another.
  const [audienceGoal, setAudienceGoal] = useState<AudienceGoal>("action");
  const [storyFormat, setStoryFormat] = useState<StoryFormat>("auto");
  const [visualInterpretation, setVisualInterpretation] = useState<VisualInterpretation>("auto");
  const [characterRepresentation, setCharacterRepresentation] = useState<CharacterRepresentation>("auto");
  const [directingProfile, setDirectingProfile] = useState<DirectingProfileId>("auto");
  const [imageQuality, setImageQuality] = useState<ImageQuality>("standard");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  // Expression heads in each board's character-reference strip (0 = let Veo act
  // the emotion from the prompt; 2-3 = include a small fixed set).
  const [copiedSeg, setCopiedSeg] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [nanoPushed, setNanoPushed] = useState(false);

  const hasCharacterUploads =
    charImages.length > 0 ||
    charHasRealPhoto ||
    characters.some((character) => character.images.length > 0 || character.hasRealPhoto);
  const effectiveCharacterRepresentation: CharacterRepresentation = hasCharacterUploads
    ? "uploaded_photoreal"
    : characterRepresentation;

  // ─── Helpers ─────────────────────────────────────────────────────

  const addCharacter = () => {
    if (!charName.trim()) return;
    setCharacters((prev) => [
      ...prev,
      {
        name: charName,
        role: charRole,
        appearance: effectiveCharAppearance,
        heightCm: charHeightCm,
        bodyType: charBodyType,
        isChild: charIsChild,
        images: charImages,
        hasRealPhoto: charHasRealPhoto,
      },
    ]);
    setCharName("");
    setCharRole("");
    setCharIsChild(false);
    setCharHasRealPhoto(false);
    setCharHeightCm("");
    setCharBodyType("standard");
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

  const runCookingAnalysis = async (): Promise<CookingRecipeIR | null> => {
    // A dish name alone is not a recipe. Preserve the legacy convenience only
    // when the main idea box clearly contains a substantial pasted recipe.
    const sourceText =
      cookingSourceText.trim() || (storyIdea.trim().length >= 80 ? storyIdea.trim() : "");
    if (!sourceText && cookingSourceImages.length === 0) {
      setCookingAnalysisError(
        lang === "vi"
          ? "Hãy dán công thức hoặc tải ảnh trang sách trước."
          : "Paste a recipe or upload cookbook pages first."
      );
      return null;
    }

    setCookingAnalyzing(true);
    setCookingAnalysisError(null);
    try {
      const compressed = await downscaleRefImages([
        {
          name: "Recipe source",
          images: cookingSourceImages.map((image) => image.base64),
        },
      ]);
      const response = await analyzeCookingRecipe({
        text: sourceText,
        images: compressed[0]?.images ?? [],
      });
      if (!response.success) {
        setCookingAnalysisError(response.error);
        return null;
      }
      setCookingRecipe(response.data);
      if (!storyIdea.trim() && response.data.dish_name) setStoryIdea(response.data.dish_name);
      if (!prodName.trim() && response.data.dish_name)
        setProdName(`${response.data.dish_name} — ảnh thành phẩm`);
      return response.data;
    } catch (analysisError) {
      const message =
        analysisError instanceof Error
          ? analysisError.message
          : lang === "vi"
            ? "Không phân tích được công thức."
            : "Could not analyze the recipe.";
      setCookingAnalysisError(message);
      return null;
    } finally {
      setCookingAnalyzing(false);
    }
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

    // Cooking has a mandatory compile boundary: raw chat/OCR sources are parsed
    // once, reviewed as Recipe IR, then only that IR proceeds. Other genres
    // never receive any cooking fields, even if stale UI state still exists.
    let recipeForInput = cookingRecipe;
    if (genre === "cooking" && !recipeForInput) {
      setProgressMessage(lang === "vi" ? "Đang đọc công thức và định lượng..." : "Reading recipe quantities...");
      recipeForInput = await runCookingAnalysis();
      if (!recipeForInput) {
        setPhase("input");
        setStep(2);
        return;
      }
    }

    // Auto-include uploads still sitting in the form (user may not have
    // clicked "Add ...") so reference photos are never silently dropped.
    // Hands-only cooking styles KEEP uploaded characters: the compiler scopes
    // them to the final clip only (the eating payoff, face visible).
    const effectiveCharacters = [
          ...characters,
          ...(charImages.length > 0 || (charHasRealPhoto && charName.trim())
            ? [{
                name: charName.trim() || "Main character",
                role: charRole,
                appearance: effectiveCharAppearance,
                heightCm: charHeightCm,
                bodyType: charBodyType,
                isChild: charIsChild,
                images: charImages,
                hasRealPhoto: charHasRealPhoto,
              }]
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

    // Include both in-app uploads (legacy) AND Nano Flow "has real photo"
    // declarations. A declared reference has no bytes here — the extension
    // attaches the photo — but it must still be marked isReference so the
    // prompt keeps that person's identity image-only.
    const rawCharacterImages: ImageReference[] = effectiveCharacters
      .filter((c) => c.images.length > 0 || c.hasRealPhoto)
      .map((c) => ({
        name: c.name,
        images: c.images.slice(0, 2).map((i) => i.base64),
        isReference: c.hasRealPhoto || c.images.length > 0,
      }));

    const rawProductImages: ImageReference[] = effectiveProducts
      .filter((p) => p.images.length > 0)
      .map((p) => ({
        name:
          genre === "cooking" && recipeForInput?.dish_name
            ? `${recipeForInput.dish_name} — ảnh thành phẩm`
            : p.name,
        description: p.description,
        images: p.images.map((i) => i.base64),
      }));

    const rawBackgroundImages: ImageReference[] = effectiveBackgrounds
      .filter((b) => b.images.length > 0)
      .map((b) => ({ name: b.name, description: b.description, images: b.images.map((i) => i.base64) }));

    const effectiveIngredients = [
      ...ingredients,
      ...(ingImages.length > 0 && (ingName.trim() || genre === "cooking")
        ? [{
            name: ingName.trim() || `Bộ nguyên liệu ${recipeForInput?.dish_name || "món ăn"}`,
            description:
              ingDesc ||
              (genre === "cooking"
                ? "Ảnh tham chiếu hình dáng và trạng thái thật của các nguyên liệu trong Recipe IR."
                : ""),
            images: ingImages,
          }]
        : []),
    ];
    const rawIngredientImages: ImageReference[] = effectiveIngredients
      .filter((g) => g.images.length > 0)
      .map((g) => ({ name: g.name, description: g.description, images: g.images.map((i) => i.base64) }));

    // Downscale ALL references (incl. full-size studio-generated portraits) to
    // ~1024px BEFORE measuring/sending, so 3+ images comfortably fit under
    // Vercel's 4.5 MB body cap instead of overflowing or being dropped.
    if (rawCharacterImages.length + rawProductImages.length + rawBackgroundImages.length + rawIngredientImages.length > 0) {
      setProgressPercent(8);
      setProgressMessage(L("analyzingImages"));
    }
    const [characterImages, productImages, backgroundImages, ingredientImages] = await Promise.all([
      downscaleRefImages(rawCharacterImages),
      downscaleRefImages(rawProductImages),
      downscaleRefImages(rawBackgroundImages),
      downscaleRefImages(rawIngredientImages),
    ]);

    // FINAL SAFETY NET. Images are already downscaled above, so all the usual
    // references (3+ uploads or studio portraits) now fit easily. This budget
    // only ever trips on a pathological case (e.g. a downscale that failed and
    // fell back to a huge original): keep the FIRST character image (primary
    // face lock) and add more only while under budget, dropping the rest, so
    // the request can never exceed Vercel's ~4.5 MB body cap (which would
    // surface as the opaque "Server Components render" error).
    // NOTE: budget by the base64 STRING length — that is what actually travels
    // over the wire (one base64 char ≈ one transmitted byte).
    const PAYLOAD_BUDGET = 3_900_000; // base64 chars sent; leaves headroom under ~4.5 MB for the rest of the JSON
    const b64Bytes = (s: string) => s.length;
    let payloadUsed = 0;
    let droppedImages = 0;
    const fitRefs = (refs: ImageReference[], alwaysKeepFirst: boolean): ImageReference[] => {
      const out: ImageReference[] = [];
      let isFirst = alwaysKeepFirst;
      for (const ref of refs) {
        const keep: string[] = [];
        for (const b64 of ref.images) {
          const bytes = b64Bytes(b64);
          if (isFirst || payloadUsed + bytes <= PAYLOAD_BUDGET) {
            payloadUsed += bytes;
            keep.push(b64);
          } else {
            droppedImages++;
          }
          isFirst = false;
        }
        if (keep.length > 0) out.push({ ...ref, images: keep });
      }
      return out;
    };
    // CAST-SYNC: guarantee at least ONE photo PER CHARACTER (the identity lock
    // of every cast member) BEFORE spending budget on extra angles — otherwise
    // a heavy first character could silently evict the 2nd/3rd character's
    // photos and break their face lock.
    const fitCharacterRefs = (refs: ImageReference[]): ImageReference[] => {
      const out: ImageReference[] = refs.map((r) => ({ ...r, images: [] as string[] }));
      // Pass 1 — the first photo of EVERY character is always kept.
      refs.forEach((ref, i) => {
        const first = ref.images[0];
        if (first) {
          payloadUsed += b64Bytes(first);
          out[i]!.images.push(first);
        }
      });
      // Pass 2 — keep only the second identity angle per character.
      refs.forEach((ref, i) => {
        for (const b64 of ref.images.slice(1, 2)) {
          const bytes = b64Bytes(b64);
          if (payloadUsed + bytes <= PAYLOAD_BUDGET) {
            payloadUsed += bytes;
            out[i]!.images.push(b64);
          } else {
            droppedImages++;
          }
        }
      });
      return out.filter((r) => r.images.length > 0);
    };
    const cappedCharacterImages = fitCharacterRefs(characterImages);
    // Nano Flow "has real photo" characters carry NO bytes in-app (the photo is
    // attached later in the extension), so the downscale/fit passes above drop
    // them. Re-add them as declared references so the server keeps their
    // identity image-only and the manifest reserves a required reference slot.
    const referenceOnlyChars: ImageReference[] = effectiveCharacters
      .filter((c) => !!c.hasRealPhoto && (c.images?.length ?? 0) === 0)
      .map((c) => ({ name: c.name, images: [], isReference: true }));
    const finalCharacterImages = [...cappedCharacterImages, ...referenceOnlyChars];
    const cappedProductImages = fitRefs(productImages, false);
    const cappedBackgroundImages = fitRefs(backgroundImages, false);
    const cappedIngredientImages = fitRefs(ingredientImages, false);
    const payloadWarnings: string[] =
      droppedImages > 0
        ? [
            lang === "vi"
              ? `Đã bỏ bớt ${droppedImages} ảnh tham chiếu để tránh vượt giới hạn dung lượng máy chủ (giữ lại ảnh quan trọng nhất).`
              : `Dropped ${droppedImages} reference image(s) to stay under the server size limit (kept the most important ones).`,
          ]
        : [];

    const hasUploads =
      cappedCharacterImages.length > 0 ||
      cappedProductImages.length > 0 ||
      cappedIngredientImages.length > 0 ||
      cappedBackgroundImages.length > 0;

    if (hasUploads) {
      setProgressPercent(10);
      setProgressMessage(L("analyzingImages"));
    }

    const input: StoryboardGenerationInput = {
      story_idea: storyIdea.trim() || recipeForInput?.dish_name || "",
      genre: genre as StoryboardGenerationInput["genre"],
      style,
      scene_count: segmentCount,
      segment_count: segmentCount,
      beats_per_segment: beatsPerSegment,
      video_goal: genre === "cooking" ? "cooking" : videoGoal,
      audience_goal: audienceGoal,
      story_format: storyFormat,
      visual_interpretation: visualInterpretation,
      character_representation:
        finalCharacterImages.length > 0 ? "uploaded_photoreal" : characterRepresentation,
      directing_profile: directingProfile,
      script_provider: scriptProvider,
      numerology_style: numerologyStyle,
      numerology_hook_mode: numerologyHookMode,
      dialogue_language:
        genre === "cooking" && ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(cookingStyle)
          ? undefined
          : forceVietnameseDialogue
            ? "Vietnamese"
            : undefined,
      force_dialogue:
        genre === "cooking" && ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(cookingStyle)
          ? false
          : forceVietnameseDialogue,
      cooking_recipe: genre === "cooking" ? recipeForInput ?? undefined : undefined,
      cooking_style: genre === "cooking" ? cookingStyle : undefined,
      character_descriptions: effectiveCharacters.length > 0
        ? effectiveCharacters.map((c) => {
            // A declared "has real photo" character (Nano Flow) is image-only
            // too — the photo is attached in the extension — so it must NOT
            // carry appearance/height/body prose that would fight those pixels.
            const hasCharacterReference = (c.images?.length ?? 0) > 0 || !!c.hasRealPhoto;
            const parsedHeight = Number.parseInt(c.heightCm ?? "", 10);
            const physicalLock = [
              Number.isFinite(parsedHeight) ? `height approximately ${parsedHeight} cm` : "",
              BODY_TYPE_TEXT[c.bodyType],
            ].filter(Boolean).join(", ");
            return {
              name: c.name,
              // A reference photo is the entire appearance contract. Do not
              // pass appearance/height/body prose that can fight the pixels.
              appearance: hasCharacterReference
                ? ""
                : [c.appearance, physicalLock].filter(Boolean).join(". "),
              personality: "",
              role: c.role,
              is_child: c.isChild,
              height_cm:
                !hasCharacterReference && Number.isFinite(parsedHeight)
                  ? parsedHeight
                  : undefined,
              body_type: hasCharacterReference ? undefined : c.bodyType,
            };
          })
        : undefined,
      character_images: finalCharacterImages.length > 0 ? finalCharacterImages : undefined,
      product_images: cappedProductImages.length > 0 ? cappedProductImages : undefined,
      ingredient_images: cappedIngredientImages.length > 0 ? cappedIngredientImages : undefined,
      background_images: cappedBackgroundImages.length > 0 ? cappedBackgroundImages : undefined,
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
      reference_expressions: 0,
      character_render:
        finalCharacterImages.length > 0 || characterRepresentation === "generated_human"
          ? "photo"
          : characterRepresentation !== "auto" && characterRepresentation !== "none"
            ? "stylized"
            : characterRender,
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
      setPlanWarnings([...payloadWarnings, ...plan.data.warnings]);
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

    // Nano Flow: text-only mode. Skip paid board image generation entirely and
    // hand off to the extension via the exported manifest. Results screen shows
    // the script + prompts + "Xuất cho Extension" card, no board images.
    if (NANO_FLOW_TEXT_ONLY) {
      setBoardErrors({});
      setProgressPercent(100);
      setResult({
        breakdown,
        characterRefSheetUrl: null,
        storyboardPosterUrl: null,
        thumbnailUrl: null,
        videoPrompt,
        warnings,
      });
      setPhase("result");
      return;
    }

    const segCount = breakdown.segments.length;
    // Auto-draw one master sheet for human review and continuity planning.
    // It is never used as an image-to-video start frame; each clip uses its
    // own clean keyframe, available from the result screen.
    const total = 1;
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

    // One master storyboard sheet for the whole video: all panels + the large
    // character-reference column. This remains a review/planning document.
    setProgressMessage(
      lang === "vi"
        ? `Đang vẽ bảng storyboard tổng (${segCount} cảnh trong 1 ảnh)`
        : `Drawing the master storyboard sheet (${segCount} panels in 1 image)`
    );
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
      thumbnailUrl: null,
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
      d
        ? {
            ...d,
            segments: d.segments.map((s, idx) =>
              idx === i
                ? field === "dialogue"
                  ? { ...s, dialogue: value, dialogue_lines: undefined }
                  : { ...s, [field]: value }
                : s
            ),
          }
        : d
    );

  // TẦNG 9 turn-taking editor: set a segment's dialogue_lines array (and keep
  // the single dialogue/speaker mirror in sync with the first turn).
  const setSegTurns = (
    i: number,
    turns: { speaker: string; text: string; start_s?: number; end_s?: number }[]
  ) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            segments: d.segments.map((s, idx) =>
              idx === i
                ? {
                    ...s,
                    dialogue_lines: turns.length > 0 ? turns : undefined,
                    dialogue: turns[0]?.text ?? (turns.length === 0 ? "" : s.dialogue),
                    speaker: turns[0]?.speaker ?? s.speaker,
                  }
                : s
            ),
          }
        : d
    );

  /** Current turns of a segment for the editor (seed from the single line). */
  const segTurns = (s: StoryboardGenerationOutput["segments"][number]) =>
    s.dialogue_lines && s.dialogue_lines.length > 0
      ? s.dialogue_lines
      : s.dialogue
        ? [{ speaker: (s.speaker ?? "") as string, text: s.dialogue }]
        : [];

  // Per-scene AI rewrite: after the user edits/adds dialogue turns, re-run the
  // AI on JUST this segment so the action, beats and turn timing are re-
  // choreographed around the new lines (the stale-action problem). The edited
  // lines themselves are locked server-side and never rewritten.
  const rewriteScene = async (i: number) => {
    if (!genInput || !draft || rewriteTarget !== null) return;
    setRewriteTarget(i);
    setError(null);
    try {
      const r = await rewriteSegment({
        input: genInput,
        breakdown: draft,
        segmentIndex: i,
        provider,
      });
      if (r.success) {
        setDraft((d) =>
          d
            ? { ...d, segments: d.segments.map((s, idx) => (idx === i ? r.data.segment : s)) }
            : d
        );
        if (r.data.warnings.length > 0) {
          setPlanWarnings((w) => [...w, ...r.data.warnings]);
        }
      } else {
        setError(r.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rewrite failed");
    } finally {
      setRewriteTarget(null);
    }
  };

  // ─── Review & redo: re-render a single board on demand ───────────
  const regenerateBoard = async (
    target: number | "master" | "thumbnail"
  ) => {
    if (!genInput || !genAnalysis || !result || regenTarget !== null) return;
    setRegenTarget(target);
    try {
      // Pin wardrobe on regenerate too: use an existing OTHER board as the
      // look anchor so the redo matches the rest (e.g. fixing the one that
      // drifted into a suit).
      const anchorSeg = result.breakdown.segments.find(
        (s, idx) => idx !== target && !!s.first_frame_url
      );
      const anchorImage = anchorSeg?.first_frame_url
        ? await toAnchorBase64(anchorSeg.first_frame_url)
        : null;
      const r = await generateBoardImage({
        input: genInput,
        breakdown: result.breakdown,
        analysis: genAnalysis,
        kind: target === "master" ? "master" : target === "thumbnail" ? "thumbnail" : "segment",
        segmentIndex: typeof target === "number" ? target : undefined,
        provider,
        anchorImage: anchorImage ?? undefined,
      });
      const key = typeof target === "number" ? `seg-${target}` : target;
      if (r.success) {
        // Clear any previous failure reason for this board.
        setBoardErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        if (target === "master") {
          setResult({ ...result, storyboardPosterUrl: r.data.url });
        } else if (target === "thumbnail") {
          setResult({ ...result, thumbnailUrl: r.data.url });
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

  // ─── Nano Flow: export the manifest for the AutoFlow Reel extension ───────
  const buildResultManifest = () => {
    if (!result) return null;
    // Build the STRUCTURED Veo clips once and embed them in the manifest so each
    // shot's video_prompt is the high-quality structured scene JSON (not a flat
    // paragraph) and the keyframe prompt is composed from that same scene.
    const veoJson = buildVeoJson(result.breakdown, {
      aspectRatio: (genInput?.aspect_ratio as "16:9" | "9:16") ?? "9:16",
      dialogueLanguage: genInput?.dialogue_language ?? "Vietnamese",
      ambientAudio: genreAmbientAudio(genInput?.genre, genInput?.video_goal),
      hasLocationRef: (genInput?.background_images?.length ?? 0) > 0,
      characterReferenceNames: (genInput?.character_images ?? [])
        .filter((c) => (c.images?.length ?? 0) > 0 || c.isReference === true)
        .map((c) => c.name),
    });
    const veoClips = Array.isArray((veoJson as { clips?: unknown[] }).clips)
      ? ((veoJson as { clips: Array<Record<string, unknown>> }).clips)
      : [];
    return buildNanoFlowManifest(result.breakdown, {
      aspectRatio: (genInput?.aspect_ratio as "16:9" | "9:16") ?? "9:16",
      dialogueLanguage: genInput?.dialogue_language ?? "Vietnamese",
      veoClips,
    });
  };

  // Download the manifest as a .nanoflow.json file the user can drop into the
  // extension's "Nạp manifest" import.
  const downloadNanoManifest = () => {
    const manifest = buildResultManifest();
    if (!manifest) return;
    const safeTitle = toAsciiSlug(manifest.project.title).slice(0, 40) || "storyboard";
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeTitle}.nanoflow.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // One-click push: postMessage the manifest to the extension (which listens
  // for NANO_FLOW_MESSAGE_SOURCE/TYPE on window). Falls back to download if the
  // extension isn't listening.
  const pushNanoToExtension = () => {
    const manifest = buildResultManifest();
    if (!manifest) return;
    try {
      // Envelope must match NanoFlowPushMessage / the extension's listener
      // (sidepanel.js reads d.payload). See DESIGN.md §7. When Storyboard runs
      // embedded as an iframe inside the extension side panel, the listener
      // lives in the parent frame, so post to window.parent (=== window when
      // standalone, harmless). The download button is the always-works fallback.
      const envelope = {
        source: NANO_FLOW_MESSAGE_SOURCE,
        type: NANO_FLOW_MESSAGE_TYPE,
        payload: manifest,
      };
      window.parent.postMessage(envelope, "*");
      if (window.parent !== window) window.postMessage(envelope, "*");
      setNanoPushed(true);
      setTimeout(() => setNanoPushed(false), 2500);
    } catch {
      downloadNanoManifest();
    }
  };

  // Download all segment frames + prompts as a single ZIP.
  const downloadAllFrames = async () => {
    if (!result) return;
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const safeTitle = toAsciiSlug(result.breakdown.title).slice(0, 40);

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
      // Viral 9:16 thumbnail (video cover) — included once generated.
      if (result.thumbnailUrl) {
        try {
          const b = await (await fetch(result.thumbnailUrl)).blob();
          zip.file(`thumbnail_9x16.png`, b);
        } catch {}
      }
      // Assembly guide / prompts
      zip.file(`video_assembly_guide.txt`, result.videoPrompt);

      // ── Master prompt (line-based, one paste-ready prompt per clip) ──
      const bd = result.breakdown;
      const aspect = genInput?.aspect_ratio ?? "9:16";
      const oneLine = (s: string) => (s ?? "").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
      const kf = (n: number) => `keyframe_${String(n).padStart(2, "0")}.jpg`;

      const masterLines: string[] = [
        `# ${bd.title}`,
        bd.synopsis ? `# ${oneLine(bd.synopsis)}` : "",
        `# ${bd.segments.length} clips · ${aspect} · Omni Flash / Veo (10s per clip)`,
        `# For each clip: attach your CHARACTER PHOTO as the reference, then paste the PROMPT.`,
        "",
      ];
      for (const seg of bd.segments) {
        masterLines.push(
          `[SEGMENT ${seg.segment_number} — ${(seg.marketing_role || "").toUpperCase()} — ${seg.duration_seconds ?? 10}s]`,
          `OPTIONAL START FRAME: ${seg.keyframe_url ? kf(seg.segment_number) : "crop đúng ô cảnh từ storyboard_overview.png hoặc dùng Text-to-Video/Ingredients"}`,
          `PROMPT: ${oneLine(seg.full_prompt ?? seg.motion_prompt ?? "")}`,
        );
        if (seg.dialogue) {
          masterLines.push(`DIALOGUE${seg.speaker ? ` (${seg.speaker})` : ""}: "${oneLine(seg.dialogue)}"`);
        }
        masterLines.push("");
      }
      zip.file(`master_prompt.txt`, masterLines.join("\n"));

      // ── Clean prompts-only file — NO headers/labels, one prompt per block,
      // blank line between prompts, ready to paste straight into a video tool. ──
      const promptsOnly = bd.segments
        .map((seg) => oneLine(seg.full_prompt ?? seg.motion_prompt ?? ""))
        .filter(Boolean)
        .join("\n\n");
      zip.file(`prompts.txt`, promptsOnly);

      // ── Structured Flow/Veo JSON — one concise, independent object per clip. ──
      const veoJson = buildVeoJson(bd, {
        aspectRatio: aspect,
        dialogueLanguage: genInput?.dialogue_language ?? "Vietnamese",
        ambientAudio: genreAmbientAudio(genInput?.genre, genInput?.video_goal),
        hasLocationRef: (genInput?.background_images?.length ?? 0) > 0,
        characterReferenceNames: (genInput?.character_images ?? [])
          .filter((c) => (c.images?.length ?? 0) > 0)
          .map((c) => c.name),
      });
      zip.file(`veo_prompts.json`, JSON.stringify(veoJson, null, 2));
      const clipArr = Array.isArray((veoJson as { clips?: unknown[] }).clips)
        ? ((veoJson as { clips: unknown[] }).clips as unknown[])
        : [];
      // Human-readable blocks: one pretty JSON object, blank line, next object.
      zip.file(
        `veo_prompts_blocks.txt`,
        clipArr.map((clip) => JSON.stringify(clip, null, 2)).join("\n\n")
      );
      // JSON Lines: exactly one complete compact prompt per physical line for
      // bulk splitters/automation tools.
      zip.file(
        `veo_prompts.jsonl`,
        clipArr.map((c) => JSON.stringify(c)).join("\n")
      );
      // Also provide one standalone JSON file per scene for direct copy/paste.
      clipArr.forEach((clip, index) => {
        const sceneNumber = String(index + 1).padStart(2, "0");
        zip.file(`veo_json/scene_${sceneNumber}.json`, JSON.stringify(clip, null, 2));
      });

      // ── Ready-to-post social captions (TikTok / YT Shorts / FB Reels) ──
      // Written by the AI together with the script, so each caption references
      // THIS video's actual hook/story — copy-paste when uploading.
      const sp = bd.social_posts;
      if (sp) {
        const tags = (arr?: string[]) => (arr ?? []).join(" ");
        const social = [
          "BÀI ĐĂNG CHO TỪNG NỀN TẢNG (copy nguyên khối khi đăng video)",
          "============================================================",
          "",
          "── 1) TIKTOK ──────────────────────────────────────────────",
          sp.tiktok?.caption ?? "",
          "",
          tags(sp.tiktok?.hashtags),
          "",
          "── 2) YOUTUBE SHORTS ──────────────────────────────────────",
          `TIÊU ĐỀ: ${sp.youtube_shorts?.title ?? ""}`,
          "",
          "MÔ TẢ:",
          sp.youtube_shorts?.description ?? "",
          "",
          tags(sp.youtube_shorts?.hashtags),
          "",
          "── 3) FACEBOOK REELS ──────────────────────────────────────",
          sp.facebook_reel?.caption ?? "",
          "",
          tags(sp.facebook_reel?.hashtags),
          "",
          "MẸO ĐĂNG:",
          "  - TikTok: đăng kèm caption + hashtag ở trên; ghim 1 comment đặt câu hỏi để kéo tương tác.",
          "  - YouTube Shorts: dán TIÊU ĐỀ vào title, MÔ TẢ + hashtag vào description (giữ #Shorts).",
          "  - Facebook Reels: caption dài hơn được — giữ câu hỏi cuối để kéo comment/share.",
          "  - Giờ vàng gợi ý: 11h30-13h & 19h-22h (giờ VN). Trả lời comment trong 30 phút đầu.",
        ].join("\n");
        zip.file(`bai_dang_social.txt`, social);
      }

      // ── Plain how-to-use guide (so the files are self-explanatory) ──
      const readme = [
        "CÁCH DÙNG BỘ PROMPT NÀY VỚI VEO / OMNI FLASH",
        "=============================================",
        "",
        "Mỗi clip làm ĐỘC LẬP nhưng chỉ cần 1 storyboard tổng để duyệt:",
        "  1) Ưu tiên Text-to-Video hoặc Ingredients/References và dán JSON của đúng cảnh.",
        "     Ảnh nhân vật/bối cảnh thêm ở mục Ingredients/References nếu Flow có mục đó.",
        "     Nếu dùng Frames-to-Video, crop miễn phí đúng ô cảnh từ storyboard_overview.png",
        "     rồi dùng ảnh crop làm start frame; KHÔNG dùng cả bảng nhiều ô làm start frame.",
        "  2) Dán ĐÚNG một object cảnh: file veo_json/scene_NN.json, một khối trong",
        "     veo_prompts_blocks.txt, hoặc một dòng tương ứng trong veo_prompts.jsonl.",
        "  3) Đặt tỉ lệ " + aspect + ", tạo clip. Lặp cho " + bd.segments.length + " clip rồi ghép (CapCut/ffmpeg).",
        "",
        "Mỗi object cảnh đã TỰ CHỨA character_lock + background_lock + camera + hành động",
        "+ âm thanh + dialogue. Chỉ dán MỘT object cho mỗi lần tạo video.",
        "Không bắt buộc tạo keyframe AI; keyframe chỉ là lựa chọn thêm khi cần ảnh khởi đầu nét hơn.",
        "",
        "\"continuity\" / \"Nối tiếp\": chỉ là GHI CHÚ cho bạn biết clip này nối với clip trước thế nào",
        "(để ghép mượt) — KHÔNG dán vào Veo. Segment 1 ghi 'opening shot' vì là cảnh mở đầu.",
        "",
        "FILE NÀO DÙNG GÌ:",
        "  - prompts.txt        → GỌN NHẤT: chỉ có các prompt, mỗi prompt cách nhau 1 dòng",
        "      trống, KHÔNG tiêu đề/giới thiệu. Đưa thẳng file này vào tool tạo video, hoặc",
        "      copy từng đoạn (mỗi đoạn = 1 clip) rồi dán vào Veo (đính kèm ảnh nhân vật).",
        "  - veo_prompts.json   → toàn bộ project, mảng \"clips\" chứa các prompt JSON gọn.",
        "  - veo_prompts_blocks.txt → từng object JSON được xuống dòng đẹp, cách nhau 1 dòng",
        "      trống; dùng để đọc và copy thủ công từng cảnh.",
        "  - veo_prompts.jsonl  → mỗi DÒNG VẬT LÝ = 1 prompt JSON hoàn chỉnh; dùng để copy",
        "      hàng loạt hoặc đưa vào công cụ tự chia dòng/batch.",
        "  - veo_json/scene_NN.json → một file JSON độc lập cho từng cảnh, dán nguyên object.",
        "  - master_prompt.txt  → bản prompt văn bản cũ dự phòng khi không dùng JSON.",
        "  - bai_dang_social.txt→ BÀI ĐĂNG viết sẵn cho TikTok / YouTube Shorts / Facebook",
        "      Reels (caption + hashtag SEO, bám đúng nội dung video này) — copy khi đăng.",
        "  - thumbnail_9x16.png → ẢNH BÌA dọc 9:16 (nếu bạn đã bấm 'Tạo thumbnail'): tiêu đề",
        "      giật + emoji đã in sẵn — kiểm tra chính tả trước khi đăng, lỗi thì Tạo lại.",
        "",
        "MẸO: mỗi clip đều có \"negative_prompt\" liệt kê rõ những thứ phải tránh",
        "(morphing, warping, teleporting, floating/duplicated objects, tay/ngón lỗi,",
        "đổi mặt, chữ/sub trên màn hình, da nhựa CGI…). Giữ nguyên trường này khi dán.",
        "",
      ].join("\n");
      zip.file(`README_HUONG_DAN.txt`, readme);

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
              <div key={i} className={`space-y-2 rounded-lg border p-3 ${rewriteTarget === i ? "opacity-70" : ""}`}>
                <div className="flex items-center gap-2">
                  <Badge>#{s.segment_number}</Badge>
                  <Badge variant="secondary" className="uppercase">{s.marketing_role}</Badge>
                  <div className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      disabled={rewriteTarget !== null}
                      onClick={() => rewriteScene(i)}
                      title={
                        lang === "vi"
                          ? "Không bắt buộc để lưu câu thoại. Chỉ bấm khi bạn muốn AI căn lại hành động + thời gian của riêng cảnh này theo thoại mới."
                          : "Not required to save dialogue. Use only when you want AI to re-time this scene's action around the new lines."
                      }
                    >
                      {rewriteTarget === i ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCw className="h-3.5 w-3.5" />
                      )}
                      {rewriteTarget === i
                        ? lang === "vi" ? "Đang viết lại..." : "Rewriting..."
                        : lang === "vi" ? "Căn lại cảnh theo thoại" : "Re-time scene to dialogue"}
                    </Button>
                  </div>
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
                {draft.character_locks.length <= 1 ? (
                  // Single character → simple one-line dialogue.
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
                ) : (
                  // Multi-character → TURN-TAKING editor (up to 3 lines in one 10s clip).
                  (() => {
                    const turns = segTurns(s);
                    const configuredNames = new Set(
                      draft.character_locks.map((character) => character.name.trim()).filter(Boolean)
                    );
                    const sceneSpeakerNames = (s.characters_in_scene ?? []).filter((name) =>
                      configuredNames.has(name)
                    );
                    const invalidSpeakerNames = [
                      ...new Set(
                        turns
                          .map((turn) => turn.speaker.trim())
                          .filter((name) => name && !configuredNames.has(name))
                      ),
                    ];
                    const speakerOpts = [
                      { value: "", label: lang === "vi" ? "— Lồng tiếng —" : "— Voiceover —" },
                      ...invalidSpeakerNames.map((name) => ({
                        value: name,
                        label:
                          lang === "vi"
                            ? `⚠ ${name} — không có trong cài đặt`
                            : `⚠ ${name} — not in settings`,
                      })),
                      ...draft.character_locks.filter((c) => c.name).map((c) => ({ value: c.name, label: c.name })),
                    ];
                    return (
                      <div className="space-y-2 rounded-lg border border-dashed p-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-muted-foreground">
                            {lang === "vi" ? "Hội thoại trong cảnh (lần lượt, tối đa 3 lượt / 10s)" : "In-scene dialogue (turn-taking, max 3 lines / 10s)"}
                          </label>
                          {turns.length < 3 && (
                            <button
                              type="button"
                              className="rounded-full border border-input px-2 py-0.5 text-[11px] hover:border-primary/50"
                              onClick={() =>
                                setSegTurns(i, [
                                  ...turns,
                                  {
                                    speaker:
                                      sceneSpeakerNames[
                                        turns.length % Math.max(sceneSpeakerNames.length, 1)
                                      ] ?? "",
                                    text: "",
                                  },
                                ])
                              }
                            >
                              ➕ {lang === "vi" ? "Thêm lượt" : "Add turn"}
                            </button>
                          )}
                        </div>
                        {turns.length === 0 && (
                          <button
                            type="button"
                            className="w-full rounded border border-dashed border-input py-1.5 text-[11px] text-muted-foreground hover:border-primary/50"
                            onClick={() =>
                              setSegTurns(i, [{ speaker: sceneSpeakerNames[0] ?? "", text: "" }])
                            }
                          >
                            {lang === "vi" ? "➕ Thêm lời thoại cho cảnh này" : "➕ Add dialogue to this scene"}
                          </button>
                        )}
                        {turns.map((t, ti) => (
                          <div key={ti} className="flex items-start gap-1.5">
                            <span className="mt-2 text-[11px] font-semibold text-muted-foreground">{ti + 1}.</span>
                            <div className="w-32 shrink-0">
                              <Select
                                value={t.speaker ?? ""}
                                onChange={(e) => setSegTurns(i, turns.map((x, xi) => (xi === ti ? { ...x, speaker: e.target.value } : x)))}
                                options={speakerOpts}
                              />
                            </div>
                            <Input
                              value={t.text}
                              onChange={(e) => setSegTurns(i, turns.map((x, xi) => (xi === ti ? { ...x, text: e.target.value } : x)))}
                              placeholder={lang === "vi" ? "câu thoại..." : "line..."}
                              className="flex-1"
                            />
                            <button
                              type="button"
                              className="mt-1.5 rounded p-1 text-muted-foreground hover:text-destructive"
                              onClick={() => setSegTurns(i, turns.filter((_, xi) => xi !== ti))}
                              title={lang === "vi" ? "Xoá lượt" : "Remove"}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <p className="text-[11px] text-muted-foreground">
                          {lang === "vi"
                            ? "Câu đang hiển thị sẽ tự đi vào prompt khi bấm 'Dựng Storyboard', không cần bấm nút căn lại. Chỉ bấm 'Căn lại cảnh theo thoại' nếu bạn muốn AI sửa hành động và thời gian cho khớp câu mới."
                            : "The lines shown here automatically go into the prompt when you click 'Build storyboard'; no extra save step is needed. Use 'Re-time scene to dialogue' only to update action and timing around the new lines."}
                        </p>
                      </div>
                    );
                  })()
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button variant="outline" onClick={() => setPhase("input")} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> {lang === "vi" ? "Quay lại brief" : "Back to brief"}
          </Button>
          <Button onClick={buildStoryboardFromScript} disabled={rewriteTarget !== null} className="gap-2">
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
    const resultVeoJson = buildVeoJson(result.breakdown, {
      aspectRatio: genInput?.aspect_ratio ?? "9:16",
      dialogueLanguage: genInput?.dialogue_language ?? "Vietnamese",
      ambientAudio: genreAmbientAudio(genInput?.genre, genInput?.video_goal),
      hasLocationRef: (genInput?.background_images?.length ?? 0) > 0,
      characterReferenceNames: (genInput?.character_images ?? [])
        .filter((c) => (c.images?.length ?? 0) > 0)
        .map((c) => c.name),
    });
    const resultJsonClips = Array.isArray((resultVeoJson as { clips?: unknown[] }).clips)
      ? ((resultVeoJson as { clips: unknown[] }).clips as unknown[])
      : [];
    const resultJsonLines = resultJsonClips.map((clip) => JSON.stringify(clip)).join("\n");
    const resultJsonBlocks = resultJsonClips
      .map((clip) => JSON.stringify(clip, null, 2))
      .join("\n\n");
    const copyJson = (key: string, text: string) => {
      navigator.clipboard.writeText(text);
      setCopiedJson(key);
      setTimeout(() => setCopiedJson(null), 2000);
    };

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

        {/* Nano Flow: export the manifest for the AutoFlow Reel extension. */}
        <Card className="border-emerald-400/50 bg-emerald-50/60 dark:border-emerald-600/50 dark:bg-emerald-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-emerald-600" />
              {lang === "vi" ? "Xuất cho Extension (Nano Flow)" : "Export for Extension (Nano Flow)"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {lang === "vi"
                ? "Gửi kịch bản + prompt sang extension AutoFlow Reel để tạo ảnh storyboard bằng nano banana miễn phí trong Google Flow. Không cần tải ảnh lên ở đây."
                : "Send the script + prompts to the AutoFlow Reel extension to generate storyboard images with free nano banana in Google Flow. No image upload needed here."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={pushNanoToExtension} className="gap-2">
                {nanoPushed ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {nanoPushed
                  ? lang === "vi" ? "Đã gửi" : "Sent"
                  : lang === "vi" ? "Gửi sang Extension" : "Push to Extension"}
              </Button>
              <Button variant="outline" onClick={downloadNanoManifest} className="gap-2">
                <Download className="h-4 w-4" />
                {lang === "vi" ? "Tải manifest (.nanoflow.json)" : "Download manifest (.nanoflow.json)"}
              </Button>
            </div>
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
                <Button variant="outline" size="sm" onClick={() => downloadImage(result.characterRefSheetUrl!, `character-ref-${toAsciiSlug(result.breakdown.title)}.png`)} className="gap-1.5">
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
                  <Button variant="outline" size="sm" onClick={() => downloadImage(result.storyboardPosterUrl!, `storyboard-${toAsciiSlug(result.breakdown.title)}.png`)} className="gap-1.5">
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
                  ? "Đây là storyboard tổng duy nhất để duyệt toàn bộ video. Không dùng nguyên bảng nhiều ô làm start frame; khi cần Frames-to-Video, crop đúng ô cảnh từ bảng này mà không tốn thêm lượt tạo ảnh AI."
                  : "This is the single master storyboard for reviewing the whole video. Do not use the full multi-panel sheet as a start frame; crop the matching panel for Frames-to-Video without paying for another AI image."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                {lang === "vi" ? "Bảng Storyboard Tổng — chưa tạo được" : "Master Board — not generated yet"}
              </p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                {lang === "vi"
                  ? "Bảng tổng chỉ dùng để duyệt bố cục và tính liên tục, không phải ảnh start frame cho Flow."
                  : "The master sheet is only for layout and continuity review, not a Flow start frame."}
              </p>
              {boardErrors["master"] && (
                <p className="mt-1 max-w-md text-xs text-destructive/80">{boardErrors["master"]}</p>
              )}
              <Button variant="outline" size="sm" disabled={regenTarget !== null} onClick={() => regenerateBoard("master")} className="mt-3 gap-1.5">
                {regenTarget === "master" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                {lang === "vi" ? "Tạo bảng tổng" : "Generate master board"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Viral 9:16 Thumbnail / video cover */}
        {result.thumbnailUrl ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ImageIcon className="h-5 w-5" />
                  {lang === "vi" ? "Thumbnail 9:16 (bìa video)" : "9:16 Thumbnail (video cover)"}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={regenTarget !== null} onClick={() => regenerateBoard("thumbnail")} className="gap-1.5">
                    {regenTarget === "thumbnail" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                    {lang === "vi" ? "Tạo lại" : "Redo"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => downloadImage(result.thumbnailUrl!, `thumbnail-${toAsciiSlug(result.breakdown.title)}.png`)} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    {lang === "vi" ? "Tải ảnh" : "Download"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mx-auto max-w-xs overflow-hidden rounded-lg border">
                <img src={result.thumbnailUrl!} alt="Video thumbnail" className="w-full" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {lang === "vi"
                  ? "Bìa dọc 9:16 theo khoảnh khắc hài nhất của video — tiêu đề giật + 1 emoji cảm xúc đã in sẵn thật to (kiểm tra chính tả; nếu chữ lỗi bấm Tạo lại). Ảnh này cũng được kèm vào ZIP khi tải."
                  : "Vertical 9:16 cover staging the video's funniest beat — the smash-hook headline + 1 emotion emoji are printed on it (check spelling; hit Redo if garbled). Included in the ZIP download."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                {lang === "vi" ? "Thumbnail 9:16 — bìa video (tuỳ chọn)" : "9:16 Thumbnail — video cover (optional)"}
              </p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                {lang === "vi"
                  ? "Tạo 1 ảnh bìa dọc kiểu hài hước, bắt mắt: nhân vật cutout viền trắng + neon với biểu cảm cường điệu, TIÊU ĐỀ GIẬT in sẵn thật to + 1 emoji cảm xúc — đập vào mắt ngay khi lướt. Dùng làm cover khi đăng TikTok/Shorts/Reels."
                  : "Generate one funny, scroll-stopping vertical cover: sticker-cutout character with neon rim, the HUGE smash-hook headline + 1 emotion emoji printed on it. Use as the upload cover."}
              </p>
              {boardErrors["thumbnail"] && (
                <p className="mt-1 max-w-md text-xs text-destructive/80">{boardErrors["thumbnail"]}</p>
              )}
              <Button variant="outline" size="sm" disabled={regenTarget !== null} onClick={() => regenerateBoard("thumbnail")} className="mt-3 gap-1.5">
                {regenTarget === "thumbnail" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {lang === "vi" ? "Tạo thumbnail hài hước" : "Generate funny thumbnail"}
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
                  <Badge variant="outline" className="absolute bottom-2 left-2 bg-background/80 text-[10px]">
                    {lang === "vi" ? "Board (storyboard)" : "Board (storyboard)"}
                  </Badge>
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
                        onClick={() => downloadImage(seg.first_frame_url!, `board_${String(seg.segment_number).padStart(2, "0")}.png`)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Optional clean keyframe for users who want an extra AI-generated start frame. */}
                  <div className="rounded-md border-2 border-primary/50 bg-primary/5 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase text-primary">
                        {lang === "vi" ? "Keyframe sạch tùy chọn" : "Optional clean keyframe"}
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
                            <RotateCw className="h-3 w-3" />
                          )}
                          {seg.keyframe_url
                            ? lang === "vi" ? "Tạo lại" : "Redo"
                            : lang === "vi" ? "Tạo keyframe" : "Generate keyframe"}
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
                    {seg.keyframe_url ? (
                      <img src={seg.keyframe_url} alt={`Keyframe ${seg.segment_number}`} className="mt-2 w-full rounded border" />
                    ) : (
                      <div className="mt-2 flex aspect-video items-center justify-center gap-1.5 rounded border border-dashed text-[10px] text-muted-foreground">
                        {keyframeBusy === result.breakdown.segments.indexOf(seg) ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {lang === "vi" ? "Đang tạo..." : "Generating..."}</>
                        ) : (
                          <span>{lang === "vi" ? "Chưa tạo (không bắt buộc)" : "Not generated (optional)"}</span>
                        )}
                      </div>
                    )}
                    <p className="mt-1 text-[10px] font-medium text-primary/80">
                      {lang === "vi"
                        ? "Không bắt buộc tạo ảnh này. Bạn có thể dùng prompt JSON với Text-to-Video/Ingredients hoặc crop ô cảnh từ storyboard tổng để tiết kiệm chi phí."
                        : "This image is optional. Use the JSON prompt with Text-to-Video/Ingredients or crop the scene panel from the master storyboard to save cost."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Structured Flow/Veo JSON prompts */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Film className="h-5 w-5" />
                  {lang === "vi" ? "Prompt JSON cho Flow / Veo" : "Flow / Veo JSON prompts"}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {lang === "vi"
                    ? "Mỗi object là một cảnh độc lập. Copy hàng loạt dùng JSONL: đúng một prompt trên mỗi dòng để công cụ batch tự chia."
                    : "Each object is one independent scene. Bulk copy uses JSONL: exactly one prompt per line for automatic batch splitting."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyJson("all", resultJsonLines)}
                className="gap-1.5"
              >
                {copiedJson === "all" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedJson === "all"
                  ? lang === "vi" ? "Đã copy" : "Copied"
                  : lang === "vi" ? "Copy hàng loạt JSONL" : "Copy all JSONL"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {resultJsonClips.map((clip, index) => {
                const key = `scene-${index + 1}`;
                return (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    onClick={() => copyJson(key, JSON.stringify(clip, null, 2))}
                    className="gap-1.5"
                  >
                    {copiedJson === key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedJson === key
                      ? lang === "vi" ? `Đã copy cảnh ${index + 1}` : `Copied scene ${index + 1}`
                      : lang === "vi" ? `Copy cảnh ${index + 1}` : `Copy scene ${index + 1}`}
                  </Button>
                );
              })}
            </div>
            <pre className="max-h-96 overflow-auto whitespace-pre rounded-lg bg-muted p-4 text-xs font-mono">
              {resultJsonBlocks}
            </pre>
          </CardContent>
        </Card>

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

      {/* Hidden script-model switcher — double-click the title, passcode 2502 */}
      {modelPanelOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setModelPanelOpen(false)}
        >
          <div
            className="w-full max-w-sm space-y-3 rounded-lg border bg-background p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {!modelUnlocked ? (
              <>
                <p className="text-sm font-medium">Nhập mã để đổi model API</p>
                <Input
                  type="password"
                  value={modelPw}
                  onChange={(e) => {
                    setModelPw(e.target.value);
                    setModelPwError(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && checkModelPassword()}
                  placeholder="••••"
                  autoFocus
                />
                {modelPwError && <p className="text-xs text-destructive">Sai mã.</p>}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setModelPanelOpen(false)}>
                    Đóng
                  </Button>
                  <Button size="sm" onClick={checkModelPassword}>
                    Mở
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Model viết kịch bản</p>
                <p className="text-xs text-muted-foreground">
                  Chỉ đổi model VIẾT KỊCH BẢN. Ảnh vẫn dùng Gemini (Nano Banana).
                </p>
                <div className="space-y-1.5">
                  {([
                    { v: "openai" as AIProvider, label: "GPT-5-mini (mặc định — rẻ + kịch bản hay)" },
                    { v: "claude" as AIProvider, label: "Claude Opus 4.8 (chất lượng cao nhất)" },
                    { v: "gemini" as AIProvider, label: "Gemini 2.5 Flash (rẻ)" },
                  ]).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => switchScriptProvider(o.v)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        scriptProvider === o.v
                          ? "border-primary bg-primary/10 font-medium"
                          : "border-input hover:border-primary/50"
                      }`}
                    >
                      {o.label}
                      {scriptProvider === o.v && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Claude cần <code>ANTHROPIC_API_KEY</code> trong Vercel. GPT-4o cần <code>OPENAI_API_KEY</code>.
                </p>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setModelPanelOpen(false)}>
                    Xong
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="mb-6 text-center">
        <div className="mb-3 flex justify-center">
          <LangToggle />
        </div>
        <h1
          className="text-3xl font-bold select-none"
          onDoubleClick={() => setModelPanelOpen(true)}
          title=""
        >
          {L("pageTitle")}
        </h1>
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
              <div className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <BookOpen className="h-4 w-4" />
                  {lang === "vi" ? "Kho chủ đề (thần số học / sức khoẻ)" : "Topic library"}
                </div>
                {topicCats.length > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {lang === "vi"
                        ? "Chọn loại nội dung → chọn chủ đề. Nội dung sẽ đổ vào ô ý tưởng bên dưới để AI dựng kịch bản (bạn vẫn sửa được)."
                        : "Pick a category → a topic. Its content fills the idea below; you can still edit it."}
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Select
                        value={topicType}
                        onChange={(e) => {
                          setTopicType(e.target.value);
                          setTopicItemId("");
                        }}
                        options={[
                          { value: "", label: lang === "vi" ? "— Loại nội dung —" : "— Category —" },
                          ...topicCats.map((c) => ({ value: c.key, label: c.label })),
                        ]}
                      />
                      <Select
                        value={topicItemId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setTopicItemId(id);
                          const cat = topicCats.find((c) => c.key === topicType);
                          const item = cat?.items.find((it) => it.id === id);
                          if (item) setStoryIdea(item.content);
                          // Numerology topics → drive the dedicated 5-beat
                          // Hook→Insight→CTA framework automatically.
                          if (cat && /thần số|than so|numerolog/i.test(`${cat.label} ${cat.key}`)) {
                            setVideoGoal("numerology");
                          }
                        }}
                        options={[
                          { value: "", label: lang === "vi" ? "— Chọn chủ đề —" : "— Choose topic —" },
                          ...(topicCats.find((c) => c.key === topicType)?.items.map((it) => ({
                            value: it.id,
                            label: it.label,
                          })) ?? []),
                        ]}
                      />
                    </div>
                  </>
                ) : topicError ? (
                  <p className="text-xs text-destructive">
                    {lang === "vi" ? "⚠️ Không tải được kho chủ đề: " : "⚠️ Topic library failed: "}
                    {topicError}
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {lang === "vi" ? "Đang tải kho chủ đề..." : "Loading topics..."}
                  </p>
                )}
              </div>
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
                  <Select value={genre} onChange={(e) => {
                    const g = e.target.value;
                    if (genre === "nature" && g !== "nature" && characterRepresentation === "none") {
                      setCharacterRepresentation("auto");
                    }
                    setGenre(g);
                    // Reset only the new route axes to AUTO so the selected
                    // topic can compile its own structure without stale DNA.
                    setStoryFormat("auto");
                    setVisualInterpretation("auto");
                    setDirectingProfile("auto");
                    // Genre is the hard router. Reset stale specialist goals so
                    // Cooking can never leak into numerology/film/etc.
                    if (g === "numerology") {
                      setVideoGoal("numerology");
                      setAudienceGoal("reflection");
                    }
                    else if (g === "health") {
                      setVideoGoal("health");
                      setAudienceGoal("explain");
                    }
                    else if (g === "psychology") {
                      setVideoGoal("psychology");
                      setAudienceGoal("reflection");
                    }
                    else if (g === "life_wisdom") {
                      setVideoGoal("storytelling");
                      setAudienceGoal("reflection");
                    }
                    else if (g === "cooking") {
                      setVideoGoal("cooking");
                      setAudienceGoal("retention");
                      setSegmentCount(6);
                      setForceVietnameseDialogue(false);
                      setAspectRatio("9:16");
                    }
                    else if (g === "fitness") {
                      setVideoGoal("fitness");
                      setAudienceGoal("explain");
                    }
                    else if (g === "nature") {
                      setVideoGoal("documentary_story");
                      setAudienceGoal("retention");
                      setCharacterRepresentation("none");
                    }
                    else if (["education", "finance", "tech"].includes(g)) {
                      setVideoGoal("educational");
                      setAudienceGoal("explain");
                    }
                    else if (AD_GENRES.has(g)) {
                      setVideoGoal("product_ad");
                      setAudienceGoal("action");
                    }
                    else {
                      setVideoGoal("storytelling");
                      setAudienceGoal(["comedy", "action", "horror", "thriller"].includes(g) ? "retention" : "empathy");
                    }
                  }} options={GENRE_OPTIONS[lang]} />
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

              {/* Brief — topic (numerology/health) vs product (ad) vs story */}
              {TOPIC_GENRES.has(genre) ? (
                <div className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <BookOpen className="h-4 w-4" />
                    {genre === "numerology"
                      ? (lang === "vi" ? "Nội dung Thần số học" : "Numerology content")
                      : genre === "health"
                        ? (lang === "vi" ? "Nội dung Sức khoẻ" : "Health content")
                        : genre === "psychology"
                          ? (lang === "vi" ? "Nội dung Tâm lý" : "Psychology content")
                          : (lang === "vi" ? "Đạo lý / Ngụ ngôn / Đạo làm người" : "Life wisdom / Parable")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {genre === "life_wisdom"
                      ? lang === "vi"
                        ? "Dán một câu ngụ ngôn, câu dạy đạo lý hoặc ý nghĩa muốn truyền tải. Hệ thống giữ nguyên tinh thần câu gốc và dựng theo: tình huống → lựa chọn → hệ quả → nhận ra → nguyên tắc → câu hỏi suy ngẫm."
                        : "Paste a proverb, parable or lesson. The system preserves its meaning and builds: situation → choice → consequence → realisation → principle → reflective question."
                      : genre === "psychology"
                        ? lang === "vi"
                          ? "Nhập một hành vi, cảm xúc hoặc tình huống tâm lý cụ thể. Hệ thống mô tả trải nghiệm quan sát được, giải thích dễ hiểu, không tự chẩn đoán hay gắn nhãn con người."
                          : "Enter a concrete behaviour, feeling or psychological situation. The system uses observable experience and plain explanation without diagnosing or labelling a person."
                        : lang === "vi"
                          ? 'Có thể chọn nội dung từ "Kho chủ đề" hoặc nhập trực tiếp vào ô ý tưởng. Mỗi thể loại chỉ kích hoạt đúng bộ luật chuyên ngành của nó.'
                          : "Choose from the Topic Library or type directly. Each topic activates only its own specialist rules."}
                  </p>
                  {genre === "numerology" && (
                    <p className="rounded-md bg-primary/5 p-2 text-xs text-muted-foreground">
                      {lang === "vi"
                        ? '💡 Chỉ cần gõ ngắn gọn, ghép 2-3 chỉ số tuỳ ý: "Hành trình của cô gái có Số Chủ Đạo 1, Sứ Mệnh 5" / "chàng trai Nội Tâm 7, Sứ Mệnh 9"… App tự nhận diện hồ sơ năng lượng từng số. Không cần mô tả thêm.'
                        : '💡 Type a short line combining any 2-3 indices: "Journey of a girl with Life Path 1, Mission 5" / "a guy with Soul Urge 7, Mission 9"… The app detects the number profiles automatically.'}
                    </p>
                  )}
                  {genre === "numerology" && (
                    <div className="space-y-2 pt-1">
                      <label className="text-xs font-medium">
                        {lang === "vi" ? "Phong cách kịch bản" : "Script style"}
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {(
                          [
                            {
                              v: "balanced",
                              t: lang === "vi" ? "Kết hợp" : "Balanced",
                              d: lang === "vi" ? "Cảm hứng + phân tích sắc bén" : "Inspiring + sharp analysis",
                            },
                            {
                              v: "inspirational",
                              t: lang === "vi" ? "Truyền cảm hứng" : "Inspirational",
                              d: lang === "vi" ? "Điện ảnh, cảm xúc, nâng đỡ" : "Cinematic, emotional, uplifting",
                            },
                            {
                              v: "analytical",
                              t: lang === "vi" ? "Phân tích sắc bén" : "Sharp analysis",
                              d: lang === "vi" ? "Đọc vị hành vi, ví dụ thực tế" : "Behavioral, real examples",
                            },
                          ] as const
                        ).map((o) => (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => switchNumerologyStyle(o.v)}
                            className={`rounded-lg border p-2 text-left transition ${
                              numerologyStyle === o.v
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-medium">{o.t}</span>
                              {numerologyStyle === o.v && <Check className="h-3.5 w-3.5 text-primary" />}
                            </div>
                            <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{o.d}</span>
                          </button>
                        ))}
                      </div>
                      <label className="pt-1 text-xs font-medium">
                        {lang === "vi" ? "Kiểu hook mở đầu" : "Hook mode"}
                      </label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(
                          [
                            {
                              v: "situation",
                              t: lang === "vi" ? "Tình huống đời thực (khuyên dùng)" : "Real-life situation (recommended)",
                              d: lang === "vi"
                                ? "Mở bằng cảnh gây sốc/đồng cảm, KHÔNG nhắc số — con số chỉ xuất hiện ở nhịp giải mã. Hút cả người chưa biết thần số học."
                                : "Open on a shocking/relatable scene with NO numbers — the number appears only at the reveal beat. Reaches cold viewers.",
                            },
                            {
                              v: "number_callout",
                              t: lang === "vi" ? "Gọi thẳng con số" : "Number call-out",
                              d: lang === "vi"
                                ? "Mở bằng \"Nếu bạn là Số X…\" — dành cho video retarget người đã biết số của mình."
                                : "Open with \"If you're Number X…\" — for retargeting followers who know their numbers.",
                            },
                          ] as const
                        ).map((o) => (
                          <button
                            key={o.v}
                            type="button"
                            onClick={() => setNumerologyHookMode(o.v)}
                            className={`rounded-lg border p-2 text-left transition ${
                              numerologyHookMode === o.v
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-medium">{o.t}</span>
                              {numerologyHookMode === o.v && <Check className="h-3.5 w-3.5 text-primary" />}
                            </div>
                            <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{o.d}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : DEMO_GENRES.has(genre) ? (
                <div className="space-y-2 rounded-lg border border-dashed border-primary/40 bg-primary/[0.03] p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <BookOpen className="h-4 w-4" />
                    {genre === "cooking"
                      ? (lang === "vi" ? "Nội dung Món ăn" : "Food content")
                      : (lang === "vi" ? "Nội dung Thể hình" : "Fitness content")}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {genre === "cooking"
                      ? (lang === "vi"
                          ? "Nhập tên món ở trên, sau đó sang bước Sản phẩm để dán toàn bộ công thức hoặc tải ảnh trang sách. AI sẽ đọc định lượng thành Recipe IR để bạn duyệt trước khi dựng: Hook thành phẩm 3-5s → mise en place → các biến đổi chính → plating/payoff."
                          : "Enter the dish name, then use the Product step to paste the full recipe or upload cookbook pages. AI extracts a reviewable Recipe IR before directing: 3-5s finished-dish Hook → mise en place → key transformations → plating/payoff.")
                      : (lang === "vi"
                          ? 'Gõ MỤC TIÊU/BÀI TẬP vào ô ý tưởng ở trên (vd "giảm mỡ bụng", "3 động tác cho mông"). AI dựng theo: Mục tiêu/lỗi sai → Động tác đúng → Kết quả → Lưu tập theo. Đúng form, an toàn.'
                          : 'Type the GOAL/workout in the idea box above (e.g. "lose belly fat"). The AI builds: goal/mistake → correct moves → result → save. Correct form, safe.')}
                  </p>
                </div>
              ) : isAdGenre ? (
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
              {cookingHandsOnly && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    {lang === "vi"
                      ? "Phong cách Cooking ASMR đang chọn là tay/POV: các cảnh nấu chỉ quay tay. Nếu bạn tải ảnh nhân vật, người đó sẽ CHỈ xuất hiện ở clip cuối — ngồi vào bàn và nếm miếng đầu tiên, quay rõ mặt."
                      : "The selected Cooking ASMR profile is hands/POV: cooking scenes show hands only. If you upload a character, they appear ONLY in the final clip — seated at the table tasting the first bite, face clearly visible."}
                  </span>
                </div>
              )}
              {fromStudio && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm text-primary">
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>{lang === "vi" ? "Đã nhận ảnh đã duyệt từ Image Studio làm ảnh tham chiếu nhân vật." : "Approved images from Image Studio loaded as character references."}</span>
                </div>
              )}
              <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/[0.03] p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Users className="h-4 w-4 shrink-0" />
                  <span>{lang === "vi" ? "Video nhiều nhân vật? Thêm TỪNG NGƯỜI MỘT" : "Multiple characters? Add them ONE BY ONE"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {lang === "vi"
                    ? "Mỗi nhân vật: ① nhập TÊN → ② bật 👶 nếu là trẻ em → ③ tải ảnh 1 CHÍNH DIỆN và ảnh 2 NGHIÊNG/3-4 của đúng người đó → ④ bấm \"➕ Thêm nhân vật\". Người tiếp theo phải thêm thành một nhân vật riêng. Tên nên trùng với vai trong kịch bản để hệ thống gán đúng mặt và lời thoại."
                    : "For each character: ① enter their NAME → ② toggle 👶 if needed → ③ upload photo 1 FRONT and photo 2 PROFILE/3-4 of that person → ④ click \"➕ Add character\". Add the next person separately. Match script names so faces and dialogue bind correctly."}
                </p>
              </div>

              {characters.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {lang === "vi" ? `Dàn nhân vật đã thêm (${characters.length})` : `Cast added (${characters.length})`}
                  </p>
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
                          <p className="font-medium">{c.name}{c.isChild ? " 👶" : ""}</p>
                          <p className="text-xs text-muted-foreground">{c.isChild ? (lang === "vi" ? "Trẻ em · " : "Child · ") : ""}{c.role}{c.appearance ? ` — ${c.appearance}` : ""}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.heightCm ? `${c.heightCm} cm · ` : ""}{BODY_TYPE_LABEL[c.bodyType][lang]}
                          </p>
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
                <p className="text-sm font-semibold">
                  ➕ {lang === "vi" ? `Nhân vật thứ ${characters.length + 1}` : `Character #${characters.length + 1}`}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder={L("charName")} />
                  <Input value={charRole} onChange={(e) => setCharRole(e.target.value)} placeholder={L("charRole")} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "vi" ? "Chiều cao (cm)" : "Height (cm)"}
                    </label>
                    <Input
                      type="number"
                      min={50}
                      max={230}
                      value={charHeightCm}
                      onChange={(e) => setCharHeightCm(e.target.value)}
                      placeholder={lang === "vi" ? "VD: 170" : "e.g. 170"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {lang === "vi" ? "Vóc dáng" : "Body type"}
                    </label>
                    <Select
                      value={charBodyType}
                      onChange={(e) => setCharBodyType(e.target.value as CharacterEntry["bodyType"])}
                      options={([
                        "slim",
                        "standard",
                        "stocky",
                      ] as CharacterEntry["bodyType"][]).map((value) => ({
                        value,
                        label: BODY_TYPE_LABEL[value][lang],
                      }))}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCharIsChild((v) => !v)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                    charIsChild
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input hover:border-primary/50"
                  }`}
                >
                  👶 {lang === "vi" ? "Nhân vật này là TRẺ EM (khoá đúng độ tuổi, vóc dáng trẻ con)" : "This character is a CHILD (locked child age & proportions)"}
                </button>
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
                {/* Nano Flow: real character photos are attached in the AutoFlow
                    Reel extension, not here. The Storyboard app only DECLARES the
                    character by name; tick "có ảnh thật" so the prompt keeps that
                    person's identity image-only (no invented face) and the
                    manifest marks a required reference slot for the extension. */}
                {NANO_FLOW_TEXT_ONLY ? (
                  <button
                    type="button"
                    onClick={() => setCharHasRealPhoto((v) => !v)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      charHasRealPhoto
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
                        : "border-input hover:border-primary/50"
                    }`}
                  >
                    {charHasRealPhoto ? "✅" : "⬜"}{" "}
                    {lang === "vi"
                      ? "Nhân vật này CÓ ẢNH THẬT (sẽ gắn ở extension) — app không tự chế khuôn mặt"
                      : "This character HAS a real photo (attached in the extension) — the app won't invent a face"}
                  </button>
                ) : (
                  <>
                    <ImageUploader
                      images={charImages}
                      onChange={setCharImages}
                      maxImages={2}
                      label={
                        lang === "vi"
                          ? `Ảnh của ${charName.trim() || "nhân vật này"} (tối đa 2: chính diện + nghiêng)`
                          : `Photos of ${charName.trim() || "this character"} (max 2: front + profile)`
                      }
                      hint={L("charPhotosHint")}
                    />
                    {charImages.length > 0 && (
                      <p className="text-xs font-medium text-emerald-600">
                        {lang === "vi"
                          ? "Reference Lock đang bật: ảnh nhân vật sẽ được gửi trực tiếp vào model tạo hình, không chỉ chuyển thành mô tả chữ."
                          : "Reference Lock is active: character photos go directly to the image model, not only into a text description."}
                      </p>
                    )}

                    <CharacterStudio
                      sourceImages={charImages}
                      onApprove={(img) => setCharImages((prev) => [...prev, img].slice(0, 2))}
                    />
                  </>
                )}

                <Button onClick={addCharacter} disabled={!charName.trim()} className="w-full gap-2">
                  ➕ {lang === "vi"
                    ? charName.trim()
                      ? `Thêm "${charName.trim()}" vào dàn nhân vật`
                      : "Nhập tên nhân vật trước"
                    : charName.trim()
                      ? `Add "${charName.trim()}" to the cast`
                      : "Enter a name first"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  {lang === "vi"
                    ? "Sau khi thêm, form trống lại để bạn nhập nhân vật tiếp theo."
                    : "After adding, the form resets for the next character."}
                </p>
              </div>

              {/* Fixed identity-reference layout: two portraits per person + environment overview. */}
              <div className="space-y-1.5 rounded-lg border border-dashed p-3">
                <label className="text-sm font-medium">
                  {lang === "vi" ? "Bố cục ảnh tham chiếu cố định" : "Fixed reference layout"}
                </label>
                <p className="text-xs text-muted-foreground">{L("refExprHint")}</p>
              </div>
            </>
          )}

          {/* ── Step 3: Products ──────────────────────────────────── */}
          {step === 2 && (
            <>
              {genre === "cooking" ? (
                <div className="space-y-5">
                  <div className="rounded-xl border border-primary/40 bg-primary/[0.04] p-4">
                    <div className="flex items-start gap-3">
                      <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="font-semibold">
                          {lang === "vi" ? "Cooking Intake — đọc công thức trước khi dựng" : "Cooking Intake — parse before directing"}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          {lang === "vi"
                            ? "Dán nguyên liệu, định lượng và các bước. Có thể tải ảnh trang sách rõ nét; Gemini Vision sẽ OCR thành dữ liệu có cấu trúc để bạn kiểm tra. Ảnh sách không bị gửi lặp lại qua các bước dựng storyboard."
                            : "Paste ingredients, quantities and steps, or upload clear cookbook pages. Gemini Vision converts them into reviewable structured data; source pages are not resent through storyboard stages."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border p-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">
                        {lang === "vi" ? "Công thức / nguyên liệu (ô nhập tự do)" : "Recipe / ingredients (free-form input)"}
                      </label>
                      <Textarea
                        value={cookingSourceText}
                        onChange={(e) => {
                          setCookingSourceText(e.target.value);
                          setCookingRecipe(null);
                        }}
                        rows={10}
                        placeholder={
                          lang === "vi"
                            ? "Dán thẳng nội dung:\nKhẩu phần: 2\n- Udon đông lạnh: 2 phần, 120g/phần\n- Thịt băm: 150g\n...\nBước 1..."
                            : "Paste the full recipe, quantities and ordered steps here..."
                        }
                        className="font-mono text-sm"
                      />
                    </div>

                    <ImageUploader
                      images={cookingSourceImages}
                      onChange={(images) => {
                        setCookingSourceImages(images);
                        setCookingRecipe(null);
                      }}
                      maxImages={4}
                      label={lang === "vi" ? "Ảnh trang sách / công thức để OCR" : "Cookbook / recipe pages for OCR"}
                      hint={
                        lang === "vi"
                          ? "Tối đa 4 ảnh rõ chữ. Nên chụp thẳng trang, đủ sáng, không cắt mất cột nguyên liệu."
                          : "Up to 4 legible pages. Shoot straight-on, well lit, with ingredient columns intact."
                      }
                    />

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">
                        {lang === "vi" ? "Phong cách đạo diễn nấu ăn" : "Cooking direction style"}
                      </label>
                      <Select
                        value={cookingStyle}
                        onChange={(e) => {
                          const nextStyle = e.target.value as CookingStyle;
                          setCookingStyle(nextStyle);
                          if (["nature_asmr", "kitchen_asmr", "pov_hands"].includes(nextStyle))
                            setForceVietnameseDialogue(false);
                        }}
                        options={[
                          { value: "nature_asmr", label: lang === "vi" ? "Thiên nhiên ASMR — tay/POV, lửa, cảnh quan" : "Nature ASMR — hands/POV, fire, landscape" },
                          { value: "kitchen_asmr", label: lang === "vi" ? "Bếp ASMR — macro, tiếng dụng cụ/nguyên liệu" : "Kitchen ASMR — macro ingredient/tool sound" },
                          { value: "pov_hands", label: lang === "vi" ? "POV đôi tay — góc nhìn người nấu" : "Hands POV — cook's viewpoint" },
                          { value: "fast_cut", label: lang === "vi" ? "Công thức nhanh — tiết tấu dồn, speed-ramp" : "Fast recipe — brisk visual speed ramps" },
                          { value: "cinematic_food", label: lang === "vi" ? "Food film điện ảnh — chất liệu, hơi nóng, ánh sáng" : "Cinematic food film — texture, steam, light" },
                        ]}
                      />
                    </div>

                    <Button
                      type="button"
                      onClick={() => void runCookingAnalysis()}
                      disabled={cookingAnalyzing || (!cookingSourceText.trim() && cookingSourceImages.length === 0 && storyIdea.trim().length < 80)}
                      className="w-full gap-2"
                    >
                      {cookingAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {cookingAnalyzing
                        ? lang === "vi" ? "Đang OCR và chuẩn hóa định lượng..." : "Reading and normalizing quantities..."
                        : lang === "vi" ? "Phân tích nguyên liệu & định lượng" : "Analyze ingredients & quantities"}
                    </Button>
                    {cookingAnalysisError && (
                      <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{cookingAnalysisError}</span>
                      </div>
                    )}
                  </div>

                  {cookingRecipe && (
                    <div className="space-y-4 rounded-xl border border-emerald-500/40 bg-emerald-500/[0.03] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                          <Input
                            value={cookingRecipe.dish_name}
                            onChange={(e) => setCookingRecipe((current) => current ? { ...current, dish_name: e.target.value } : current)}
                            placeholder={lang === "vi" ? "Tên món" : "Dish name"}
                            className="font-semibold"
                          />
                          <Input
                            value={cookingRecipe.servings}
                            onChange={(e) => setCookingRecipe((current) => current ? { ...current, servings: e.target.value } : current)}
                            placeholder={lang === "vi" ? "Khẩu phần" : "Servings"}
                          />
                          <p className="text-xs text-muted-foreground sm:col-span-2">
                            OCR {Math.round(cookingRecipe.confidence * 100)}% · {lang === "vi" ? "hãy duyệt trước khi dựng" : "review before generation"}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {cookingRecipe.ingredients.length} {lang === "vi" ? "nguyên liệu" : "ingredients"} · {cookingRecipe.steps.length} {lang === "vi" ? "bước" : "steps"}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          {lang === "vi" ? "Kiểm tra định lượng — có thể sửa trực tiếp" : "Review quantities — editable"}
                        </p>
                        {cookingRecipe.ingredients.map((ingredient, index) => (
                          <div key={ingredient.id} className="grid grid-cols-12 gap-2 rounded-lg border bg-background p-2">
                            <Input
                              value={ingredient.name}
                              onChange={(e) => setCookingRecipe((current) => current ? {
                                ...current,
                                ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, name: e.target.value } : item),
                              } : current)}
                              className="col-span-12 sm:col-span-5"
                              aria-label={lang === "vi" ? "Tên nguyên liệu" : "Ingredient name"}
                            />
                            <Input
                              value={ingredient.amount}
                              onChange={(e) => setCookingRecipe((current) => current ? {
                                ...current,
                                ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, amount: e.target.value } : item),
                              } : current)}
                              placeholder={lang === "vi" ? "Số lượng" : "Amount"}
                              className="col-span-5 sm:col-span-2"
                            />
                            <Input
                              value={ingredient.unit}
                              onChange={(e) => setCookingRecipe((current) => current ? {
                                ...current,
                                ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, unit: e.target.value } : item),
                              } : current)}
                              placeholder={lang === "vi" ? "Đơn vị" : "Unit"}
                              className="col-span-3 sm:col-span-2"
                            />
                            <Input
                              value={ingredient.preparation}
                              onChange={(e) => setCookingRecipe((current) => current ? {
                                ...current,
                                ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, preparation: e.target.value } : item),
                              } : current)}
                              placeholder={lang === "vi" ? "Sơ chế" : "Prep"}
                              className="col-span-4 sm:col-span-3"
                            />
                          </div>
                        ))}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Mise en place</p>
                          {cookingRecipe.mise_en_place.map((group) => (
                            <div key={`${group.order}-${group.vessel}`} className="rounded-lg border bg-background p-2 text-xs">
                              <span className="font-medium">{group.order}. {group.vessel}</span>
                              <span className="text-muted-foreground"> — {group.ingredient_ids.map((id) => cookingRecipe.ingredients.find((item) => item.id === id)?.name ?? id).join(", ")}</span>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{lang === "vi" ? "Trình tự nấu đã khóa" : "Locked cooking order"}</p>
                          {cookingRecipe.steps.map((recipeStep, stepIndex) => (
                            <div key={recipeStep.order} className="space-y-1.5 rounded-lg border bg-background p-2 text-xs">
                              <Input
                                value={recipeStep.title}
                                onChange={(e) => setCookingRecipe((current) => current ? {
                                  ...current,
                                  steps: current.steps.map((item, itemIndex) => itemIndex === stepIndex ? { ...item, title: e.target.value } : item),
                                } : current)}
                                className="h-8 font-medium"
                                aria-label={lang === "vi" ? `Tên bước ${recipeStep.order}` : `Step ${recipeStep.order} title`}
                              />
                              <Textarea
                                value={recipeStep.action}
                                onChange={(e) => setCookingRecipe((current) => current ? {
                                  ...current,
                                  steps: current.steps.map((item, itemIndex) => itemIndex === stepIndex ? { ...item, action: e.target.value } : item),
                                } : current)}
                                rows={2}
                                className="resize-none text-xs"
                                aria-label={lang === "vi" ? `Thao tác bước ${recipeStep.order}` : `Step ${recipeStep.order} action`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {cookingRecipe.uncertainties.length > 0 && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                          <p className="font-medium">{lang === "vi" ? "Cần kiểm tra lại từ ảnh" : "Needs source review"}</p>
                          <ul className="mt-1 list-disc space-y-1 pl-4">
                            {cookingRecipe.uncertainties.map((note, index) => <li key={index}>{note}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3 rounded-xl border border-dashed p-4">
                      <div>
                        <p className="text-sm font-semibold">{lang === "vi" ? "Ảnh thành phẩm — dùng cho Hook và payoff" : "Finished dish — Hook and payoff reference"}</p>
                        <p className="text-xs text-muted-foreground">{lang === "vi" ? "Đây là ảnh món hoàn chỉnh, không phải ảnh bao bì sản phẩm." : "This is a finished-dish reference, not product packaging."}</p>
                      </div>
                      <Input
                        value={prodName}
                        onChange={(e) => setProdName(e.target.value)}
                        placeholder={lang === "vi" ? "Tên món / ảnh thành phẩm" : "Dish / finished photo name"}
                      />
                      {/* Nano Flow: finished-dish reference is attached in the extension. */}
                      {!NANO_FLOW_TEXT_ONLY && (
                        <ImageUploader
                          images={prodImages}
                          onChange={setProdImages}
                          maxImages={3}
                          label={lang === "vi" ? "Ảnh món hoàn chỉnh" : "Finished-dish photos"}
                          hint={lang === "vi" ? "1-3 góc; ảnh chính nên rõ hơi nóng, xốt và topping." : "1-3 angles; make steam, sauce and toppings legible."}
                        />
                      )}
                    </div>

                    <div className="space-y-3 rounded-xl border border-dashed p-4">
                      <div>
                        <p className="text-sm font-semibold">{lang === "vi" ? "Ảnh nguyên liệu — tùy chọn" : "Ingredient reference — optional"}</p>
                        <p className="text-xs text-muted-foreground">{lang === "vi" ? "Dùng để khóa màu sắc, hình dạng và trạng thái thật; định lượng lấy từ Recipe IR." : "Locks real colour/form/state; quantities come from Recipe IR."}</p>
                      </div>
                      <Input
                        value={ingName}
                        onChange={(e) => setIngName(e.target.value)}
                        placeholder={lang === "vi" ? "VD: Bộ nguyên liệu Udon" : "e.g. Udon ingredient set"}
                      />
                      {/* Nano Flow: ingredient photos are attached in the extension. */}
                      {!NANO_FLOW_TEXT_ONLY && (
                        <ImageUploader
                          images={ingImages}
                          onChange={setIngImages}
                          maxImages={2}
                          label={lang === "vi" ? "Ảnh tổng hợp / ảnh từng nguyên liệu" : "Ingredient set / individual references"}
                          hint={lang === "vi" ? "Không bắt buộc phải gõ tên nếu đã có Recipe IR." : "A name is optional once Recipe IR exists."}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
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
                {/* Nano Flow: real product photos are attached in the extension;
                    here the product is declared by name + description only. */}
                {!NANO_FLOW_TEXT_ONLY && (
                  <>
                    <ImageUploader
                      images={prodImages}
                      onChange={setProdImages}
                      maxImages={3}
                      label={L("prodPhotos")}
                      hint={L("prodPhotosHint")}
                    />
                    {prodImages.length > 0 && (
                      <p className="text-xs font-medium text-emerald-600">
                        {lang === "vi"
                          ? "Product Reference Lock đang bật: hình dáng, màu sắc và chi tiết sản phẩm tải lên là nguồn ưu tiên cao nhất."
                          : "Product Reference Lock is active: the uploaded design, colour and details are authoritative."}
                      </p>
                    )}
                  </>
                )}
                <Button variant="outline" size="sm" onClick={addProduct} disabled={!prodName.trim()}>
                  {L("addProduct")}
                </Button>
              </div>

              {/* Non-cooking auxiliary object/component references (named) */}
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
                {/* Nano Flow: object/component photos are attached in the
                    extension; declare the object by name + description only. */}
                {!NANO_FLOW_TEXT_ONLY && (
                  <ImageUploader
                    images={ingImages}
                    onChange={setIngImages}
                    maxImages={2}
                    label={L("ingImage")}
                    hint={L("ingImageHint")}
                  />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addIngredient}
                  disabled={!ingName.trim() || (!NANO_FLOW_TEXT_ONLY && ingImages.length === 0)}
                >
                  {L("addIngredient")}
                </Button>
              </div>
                </>
              )}
            </>
          )}

          {/* ── Step 4: Background ───────────────────────────────── */}
          {step === 3 && (
            <>
              {genre === "cooking" && (
                <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-3 text-xs leading-relaxed text-muted-foreground">
                  {lang === "vi"
                    ? cookingStyle === "nature_asmr"
                      ? "Ảnh ở bước này là địa điểm thật bạn muốn dùng cho video, không phải ảnh chụp kênh tham khảo phong cách. Nếu không tải, hệ thống chỉ dùng bối cảnh bạn đã mô tả và không tự mặc định núi, tuyết, hồ, rừng hay bếp đá."
                      : "Ảnh ở bước này khóa đúng không gian nấu của dự án. Hệ thống không lấy địa điểm, đạo cụ hay bố cục từ ảnh của một kênh tham khảo phong cách."
                    : "This step locks the project's actual cooking location. Style inspiration never supplies a creator's location, props or exact composition."}
                </div>
              )}
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
                {/* Nano Flow: real location photos are attached in the extension;
                    the location is declared by name + description only. */}
                {!NANO_FLOW_TEXT_ONLY && (
                  <>
                    <ImageUploader
                      images={bgImages}
                      onChange={setBgImages}
                      maxImages={3}
                      label={L("bgPhotos")}
                      hint={L("bgPhotosHint")}
                    />
                    {bgImages.length > 0 && (
                      <p className="text-xs font-medium text-emerald-600">
                        {lang === "vi"
                          ? "Environment Reference Lock đang bật: storyboard bắt buộc có preview tổng thể và bám đúng bố cục, vật liệu, cửa, đồ đạc và ánh sáng của ảnh này."
                          : "Environment Reference Lock is active: the storyboard must include an overview and preserve this layout, materials, openings, furniture and light."}
                      </p>
                    )}
                  </>
                )}
                <Button variant="outline" size="sm" onClick={addBackground} disabled={!bgName.trim()}>
                  {L("addBackground")}
                </Button>
              </div>
            </>
          )}

          {/* ── Step 5: Style & Generate ─────────────────────────── */}
          {step === 4 && (
            <>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
                <p className="text-sm font-semibold">
                  {lang === "vi" ? "Cấu trúc sáng tạo theo thứ tự" : "Ordered creative structure"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lang === "vi"
                    ? "Chủ đề → mục tiêu người xem → cấu trúc kể → cách thể hiện → kiểu nhân vật → cách đạo diễn. Chỉ bộ luật đúng chủ đề mới được kích hoạt."
                    : "Topic → audience outcome → story structure → interpretation → character medium → directing. Only the matching topic laws are activated."}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {lang === "vi" ? "1. Video muốn tạo thay đổi gì ở người xem?" : "1. Intended audience outcome"}
                </label>
                <Select
                  value={audienceGoal}
                  onChange={(e) => setAudienceGoal(e.target.value as AudienceGoal)}
                  options={localizedCreativeOptions(CREATIVE_GOAL_OPTIONS, lang)}
                />
                <p className="text-xs text-muted-foreground">
                  {creativeOptionDescription(CREATIVE_GOAL_OPTIONS, audienceGoal, lang)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {lang === "vi" ? "2. Cấu trúc kể chuyện" : "2. Story format"}
                </label>
                <Select
                  value={storyFormat}
                  onChange={(e) => setStoryFormat(e.target.value as StoryFormat)}
                  options={localizedCreativeOptions(CREATIVE_FORMAT_OPTIONS, lang)}
                />
                <p className="text-xs text-muted-foreground">
                  {creativeOptionDescription(CREATIVE_FORMAT_OPTIONS, storyFormat, lang)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {lang === "vi" ? "3. Cách chuyển ý tưởng thành hình ảnh" : "3. Visual interpretation"}
                </label>
                <Select
                  value={visualInterpretation}
                  onChange={(e) => setVisualInterpretation(e.target.value as VisualInterpretation)}
                  options={localizedCreativeOptions(CREATIVE_INTERPRETATION_OPTIONS, lang)}
                />
                <p className="text-xs text-muted-foreground">
                  {creativeOptionDescription(CREATIVE_INTERPRETATION_OPTIONS, visualInterpretation, lang)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {lang === "vi" ? "4. Hình thức nhân vật" : "4. Character medium"}
                </label>
                <Select
                  value={effectiveCharacterRepresentation}
                  onChange={(e) => setCharacterRepresentation(e.target.value as CharacterRepresentation)}
                  options={localizedCreativeOptions(CREATIVE_CHARACTER_OPTIONS, lang)}
                  disabled={hasCharacterUploads}
                />
                <p className={`text-xs ${hasCharacterUploads ? "font-medium text-emerald-600" : "text-muted-foreground"}`}>
                  {hasCharacterUploads
                    ? lang === "vi"
                      ? "Đã phát hiện ảnh nhân vật: tự khóa Người thật từ ảnh tải lên, giữ mặt và danh tính 100%. Muốn dùng người que/nhân hoá, hãy gỡ ảnh nhân vật."
                      : "Character photos detected: strict uploaded-person identity lock is automatic. Remove those photos to use stick figures or personification."
                    : creativeOptionDescription(CREATIVE_CHARACTER_OPTIONS, effectiveCharacterRepresentation, lang)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {lang === "vi" ? "5. Ngôn ngữ đạo diễn / cách quay" : "5. Directing profile / camera grammar"}
                </label>
                <Select
                  value={directingProfile}
                  onChange={(e) => setDirectingProfile(e.target.value as DirectingProfileId)}
                  options={localizedCreativeOptions(CREATIVE_DIRECTING_OPTIONS, lang)}
                />
                <p className="text-xs text-muted-foreground">
                  {creativeOptionDescription(CREATIVE_DIRECTING_OPTIONS, directingProfile, lang)}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {lang === "vi" ? "Cấu trúc mục tiêu cũ (giữ tương thích)" : "Legacy goal template (compatibility)"}
                </label>
                <Select
                  value={genre === "cooking" ? "cooking" : videoGoal}
                  onChange={(e) => setVideoGoal(e.target.value as VideoGoal)}
                  options={VIDEO_GOAL_OPTIONS[lang]}
                  disabled={genre === "cooking"}
                />
                {genre === "cooking" && (
                  <p className="text-xs text-muted-foreground">
                    {lang === "vi"
                      ? "Đã khóa theo thể loại Nấu ăn; luật Cooking không thể tràn sang thể loại khác."
                      : "Locked by the Cooking genre; this profile cannot leak into other genres."}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {lang === "vi" ? "Chất liệu hình ảnh / render" : "Visual treatment / render"}
                </label>
                <Select value={style} onChange={(e) => setStyle(e.target.value as StoryboardStyle)} options={STYLE_OPTIONS[lang]} />
                <p className="text-xs text-muted-foreground">
                  {lang === "vi"
                    ? "Chất liệu này không tự thay đổi chủ đề, cấu trúc kể hoặc bộ luật đạo diễn ở trên."
                    : "This treatment cannot change the topic, story structure or directing laws above."}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {lang === "vi" ? "Chế độ render nhân vật cũ (giữ tương thích)" : "Legacy character render mode (compatibility)"}
                </label>
                <Select
                  value={hasCharacterUploads ? "photo" : characterRender}
                  onChange={(e) => setCharacterRender(e.target.value as "auto" | "photo" | "stylized")}
                  options={[
                    {
                      value: "auto",
                      label: lang === "vi" ? "Tự động (theo phong cách đã chọn)" : "Auto (follow the visual style)",
                    },
                    {
                      value: "photo",
                      label: lang === "vi" ? "📷 Ảnh thật — giữ đúng mặt trong ảnh ref, cấm hoạt hình" : "📷 Photoreal — lock the real face, never cartoon",
                    },
                    {
                      value: "stylized",
                      label: lang === "vi" ? "🎨 Hoạt hình / cách điệu — không giữ mặt thật" : "🎨 Cartoon / stylized — real-face lock off",
                    },
                  ]}
                  disabled={hasCharacterUploads}
                />
                <p className="text-xs text-muted-foreground">
                  {lang === "vi"
                    ? "Trường cũ vẫn được giữ để các dữ liệu trước đây hoạt động. Khi có ảnh nhân vật, hệ thống tự khóa Ảnh thật."
                    : "This legacy field remains for older data. Character uploads automatically force Photoreal."}
                </p>
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
                    checked={
                      genre === "cooking" && ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(cookingStyle)
                        ? false
                        : forceVietnameseDialogue
                    }
                    onChange={(e) => setForceVietnameseDialogue(e.target.checked)}
                    disabled={genre === "cooking" && ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(cookingStyle)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    <span className="text-sm font-medium">{L("forceDialogueLabel")}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {genre === "cooking" && ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(cookingStyle)
                        ? lang === "vi"
                          ? "Phong cách ASMR đã khóa: không thoại, không voice-over, không nhạc."
                          : "ASMR lock: no dialogue, voice-over or music."
                        : L("forceDialogueHint")}
                    </span>
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
                  <strong>{segmentCount}</strong> {L("segments")} (~{segmentCount * 10}s) · <strong>{style}</strong> {L("style")} · <strong>{aspectRatio}</strong> · <strong>{imageQuality === "pro" ? "Pro" : "Standard"}</strong>
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
