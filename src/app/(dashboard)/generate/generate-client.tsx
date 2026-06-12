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
import { generateFullStoryboard, type StoryboardResult } from "@/actions";
import type {
  StoryboardStyle,
  StoryboardGenerationInput,
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
  motionPrompt: { vi: "Motion prompt (Veo/Seedance)", en: "Motion prompt (Veo/Seedance)" },
  continuity: { vi: "Nối tiếp", en: "Continuity" },
  copyPrompt: { vi: "Copy prompt", en: "Copy prompt" },
  assemblyGuide: { vi: "Hướng dẫn ghép video (Veo/Seedance)", en: "Video assembly guide (Veo/Seedance)" },
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
    vi: "Lựa chọn được lưu lại cho lần sau. OpenAI dùng GPT-4o + DALL-E 3, Gemini dùng Gemini 2.5 Flash.",
    en: "Your choice is saved for next time. OpenAI uses GPT-4o + DALL-E 3, Gemini uses Gemini 2.5 Flash.",
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

type Phase = "input" | "generating" | "result";

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
  const [charImages, setCharImages] = useState<UploadedImage[]>([]);

  // Step 3: Products
  const [products, setProducts] = useState<ProductEntry[]>([]);
  const [prodName, setProdName] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [prodImages, setProdImages] = useState<UploadedImage[]>([]);

  // Step 4: Backgrounds
  const [backgrounds, setBackgrounds] = useState<BackgroundEntry[]>([]);
  const [bgName, setBgName] = useState("");
  const [bgDesc, setBgDesc] = useState("");
  const [bgImages, setBgImages] = useState<UploadedImage[]>([]);

  // Step 5: Style
  const [style, setStyle] = useState<StoryboardStyle>("cinematic");
  const [segmentCount, setSegmentCount] = useState(4);
  const [beatsPerSegment, setBeatsPerSegment] = useState(3);
  const [forceVietnameseDialogue, setForceVietnameseDialogue] = useState(true);
  const [videoGoal, setVideoGoal] = useState<VideoGoal>("product_ad");
  const [imageQuality, setImageQuality] = useState<ImageQuality>("standard");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [copiedSeg, setCopiedSeg] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);

  // ─── Helpers ─────────────────────────────────────────────────────

  const addCharacter = () => {
    if (!charName.trim()) return;
    setCharacters((prev) => [
      ...prev,
      { name: charName, role: charRole, appearance: charAppearance, images: charImages },
    ]);
    setCharName("");
    setCharRole("");
    setCharAppearance("");
    setCharImages([]);
  };

  const addProduct = () => {
    if (!prodName.trim()) return;
    setProducts((prev) => [
      ...prev,
      { name: prodName, description: prodDesc, images: prodImages },
    ]);
    setProdName("");
    setProdDesc("");
    setProdImages([]);
  };

  const addBackground = () => {
    if (!bgName.trim()) return;
    setBackgrounds((prev) => [
      ...prev,
      { name: bgName, description: bgDesc, images: bgImages },
    ]);
    setBgName("");
    setBgDesc("");
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
        ? [{ name: charName.trim() || "Main character", role: charRole, appearance: charAppearance, images: charImages }]
        : []),
    ];
    const effectiveProducts = [
      ...products,
      ...(prodImages.length > 0
        ? [{ name: prodName.trim() || "Product", description: prodDesc, images: prodImages }]
        : []),
    ];
    const effectiveBackgrounds = [
      ...backgrounds,
      ...(bgImages.length > 0
        ? [{ name: bgName.trim() || "Setting", description: bgDesc, images: bgImages }]
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

    const hasUploads = characterImages.length > 0 || productImages.length > 0 || backgroundImages.length > 0;

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
    };

    setProgressPercent(20);
    setProgressMessage(L("creatingScenes"));

    // Simulate progress during long generation
    const progressTimer = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev < 40) return prev + 2;
        if (prev < 60) {
          setProgressMessage(L("generatingCharSheet"));
          return prev + 1;
        }
        if (prev < 85) return prev + 0.5;
        return prev;
      });
    }, 2000);

    try {
      const res = await generateFullStoryboard(input, provider);
      clearInterval(progressTimer);

      setProgressPercent(95);
      setProgressMessage(L("generatingDone"));

      if (!res.success) {
        setError(res.error);
        setPhase("input");
        return;
      }

      // Brief delay for visual completion
      await new Promise((r) => setTimeout(r, 500));
      setProgressPercent(100);

      setResult(res.data);
      setPhase("result");
    } catch (err) {
      clearInterval(progressTimer);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setPhase("input");
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

      // Frames
      for (const seg of result.breakdown.segments) {
        if (!seg.first_frame_url) continue;
        try {
          const res = await fetch(seg.first_frame_url);
          const blob = await res.blob();
          const num = String(seg.segment_number).padStart(2, "0");
          zip.file(`frame_${num}.png`, blob);
        } catch {
          // skip failed frame
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

        {/* Character Reference Sheet */}
        {hasCharSheet ? (
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
              <p className="mt-2 text-xs text-muted-foreground">
                {lang === "vi"
                  ? "Bao gồm: Full Body, Turnaround (4 góc), Expressions (6 biểu cảm), Props, Color Palette"
                  : "Includes: Full Body, Turnaround (4 angles), Expressions (6 emotions), Props, Color Palette"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">
                {lang === "vi" ? "Character Reference Sheet không tạo được" : "Character Reference Sheet could not be generated"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {lang === "vi" ? "Vui lòng thử lại hoặc kiểm tra kết nối API" : "Please try again or check API connection"}
              </p>
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
                <Button variant="outline" size="sm" onClick={() => downloadImage(result.storyboardPosterUrl!, `storyboard-${result.breakdown.title.replace(/[^a-zA-Z0-9]/g, "_")}.png`)} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  {lang === "vi" ? "Tải ảnh" : "Download"}
                </Button>
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
              <p className="mt-1 text-xs text-muted-foreground">
                {lang === "vi" ? "Vui lòng thử lại hoặc kiểm tra kết nối API" : "Please try again or check API connection"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Segments — the core: per-8s first frame + motion prompt */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Film className="h-5 w-5" />
            <h2 className="text-lg font-bold">{L("segmentsTitle")}</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">{L("segmentsHint")}</p>

          <div className="grid gap-4">
            {result.breakdown.segments.map((seg) => (
              <Card key={seg.segment_number} className="overflow-hidden">
                <div className="relative aspect-[16/9] bg-black/90">
                  {seg.first_frame_url ? (
                    <img src={seg.first_frame_url} alt={`Segment ${seg.segment_number}`} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                      <ImageIcon className="h-6 w-6 opacity-50" />
                      <span className="text-xs">{lang === "vi" ? "Frame lỗi" : "Frame failed"}</span>
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
                    <p className="text-[11px] leading-relaxed">{seg.motion_prompt}</p>
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
                      onClick={() => copySegmentPrompt(seg.segment_number, seg.motion_prompt)}
                    >
                      {copiedSeg === seg.segment_number ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedSeg === seg.segment_number ? (lang === "vi" ? "Đã copy" : "Copied") : L("copyPrompt")}
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
                <span className="mt-0.5 block text-[10px] font-normal opacity-70">Gemini 2.5 Flash</span>
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
                <Input value={charAppearance} onChange={(e) => setCharAppearance(e.target.value)} placeholder={L("charAppearance")} />
                <ImageUploader
                  images={charImages}
                  onChange={setCharImages}
                  maxImages={3}
                  label={L("charPhotos")}
                  hint={L("charPhotosHint")}
                />
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
                <Input value={prodDesc} onChange={(e) => setProdDesc(e.target.value)} placeholder={L("prodDesc")} />
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
                <Input value={bgDesc} onChange={(e) => setBgDesc(e.target.value)} placeholder={L("bgDesc")} />
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

