// Ported from the Gen-image app (PERSONAL mode) — option presets for the
// Image Studio: photography styles, poses, contexts, outfits, lighting,
// camera, face-enhancements, expression and quality. Pure data.

export interface OptionItem { id: string; label: string; value: string; }
export interface CategoryItem { id: string; label: string; options: OptionItem[]; }

export const SPECIAL_STYLES: OptionItem[] = [
  { id: 'clean_girl', label: '✨ Clean Girl (TikTok Viral)', value: 'Clean girl aesthetic, dewy natural skin, no-makeup makeup look, minimal neutral clothing, effortless real-girl beauty, viral social media aesthetic' },
  { id: 'quiet_luxury', label: '💎 Quiet Luxury (Old Money)', value: 'Quiet luxury old money aesthetic, understated premium clothing, muted neutral palette, Loro Piana and Brunello Cucinelli vibes, timeless effortless elegance' },
  { id: 'dark_academia', label: '📚 Dark Academia', value: 'Dark academia aesthetic, moodily lit, rich warm tones, library or stone architecture setting, intellectual and romantic atmosphere, vintage scholarly vibe' },
  { id: 'film_candid_35mm', label: '📷 Film 35mm Candid', value: 'Authentic 35mm analog film photography, candid street or lifestyle moment, beautiful grain and light leaks, natural unposed genuine expression' },
  { id: 'y2k_fashion', label: '🌀 Y2K Aesthetic (2000s)', value: 'Y2K fashion aesthetic, year 2000s style, glossy metallic textures, bold colors, nostalgic early internet pop culture vibes' },
  { id: 'vogue_editorial', label: '📰 Vogue Editorial (Cover)', value: 'Vogue magazine editorial cover shoot, high fashion studio lighting, powerful commanding pose, aspirational luxury fashion photography' },
  { id: 'korean_beauty', label: '🌸 Korean Beauty (K-beauty)', value: 'Korean beauty editorial aesthetic, softly dewy living skin with pores and vellus hair still visible, minimal fresh makeup sitting on real texture, soft natural lighting and elegant contemporary photography' },
  { id: 'moody_editorial', label: '🌑 Moody Editorial Fashion', value: 'Dark moody editorial fashion photography, dramatic shadows, rich jewel tone colors, intense emotional atmosphere, high-concept fashion storytelling' },
  { id: 'cinematic_still', label: '🎬 Cinematic Still (Movie Frame)', value: 'Cinematic movie still frame, narrative atmosphere, professional color grade, feels like a scene from an acclaimed film, widescreen composition' },
  { id: 'harajuku_tokyo', label: '🗼 Harajuku Tokyo Street', value: 'Harajuku Tokyo street fashion photography, vibrant and eclectic style, busy Japanese street background, colorful and energetic urban youth culture' },
  { id: 'supermodel_90s', label: '👑 Supermodel 90s Editorial', value: '1990s supermodel editorial style, strong powerful poses, high contrast film look, iconic era fashion photography, Helmut Newton inspired' },
  { id: 'nature_editorial', label: '🌿 Nature Editorial (Tự nhiên)', value: 'Editorial portrait in natural outdoor setting, lush greenery or open field, golden light, effortless beauty in nature, fashion-meets-landscape' },
  { id: '3d_fb_profile', label: '✨ Ngồi trên Profile Facebook', value: 'Surreal 3D render art, cute miniature character sitting casually on top of a floating transparent Facebook profile interface screen, social media icon elements floating around, high quality 3D character design, soft global illumination' },
  { id: '3d_post_window', label: '✨ Ngồi trên khung bài đăng', value: 'Creative 3D composition, character sitting on the edge of a floating social media post window frame, breaking the fourth wall, interactive social media concept, 3D render style' },
  { id: 'typography_double', label: '✨ Chồng chữ nghệ thuật', value: 'Double exposure artistic portrait, silhouette of the face filled with complex typography text arrangements, newspaper print texture overlay, creative graphic design style, black and white or sepia tone' },
  { id: 'hongkong_vibes', label: '✨ Hồng Kông (Wong Kar-wai)', value: 'Wong Kar-wai cinematic style, Hong Kong aesthetic, neon lights reflecting on wet surfaces, motion blur, moody greenish-yellow color grading, melancholic atmosphere, film grain' },
  { id: 'text_overlay_poster', label: '✨ Poster Tạp chí / Xếp chữ', value: 'High-fashion magazine cover style, bold typography text overlay behind and in front of the subject, vogue aesthetic, studio lighting, graphical elements' },
  { id: 'cyberpunk_neon', label: '✨ Cyberpunk Neon', value: 'Futuristic cyberpunk style, neon blue and pink rim lighting, high-tech background, glowing skin details, sci-fi atmosphere' },
  { id: 'paper_cut_layered', label: '✨ Paper Cut 3D', value: 'Layered paper-cut art style, character and background made of stacked paper shapes, soft shadows, handcrafted illustration feel' },
  { id: 'surreal_mirror_world', label: '✨ Thế giới gương siêu thực', value: 'Surreal portrait with mirror reflections, duplicated reality, dreamlike composition, conceptual art photography' },
  { id: 'floating_head_minimal', label: '✨ Đầu nổi tối giản', value: 'Minimal surreal portrait, floating head with clean background, subtle shadow below, modern conceptual aesthetic' },
  { id: 'claymation_style', label: '✨ Đất nặn (Clay Style)', value: 'Claymation-inspired 3D character style, soft textures, rounded shapes, playful handmade look' },
  { id: 'polaroid_memory', label: '✨ Ký ức Polaroid', value: 'Polaroid photo frame aesthetic, faded colors, light leaks, nostalgic memory feel, analog photography style' },
  { id: 'glitch_identity', label: '✨ Glitch nhân dạng', value: 'Digital glitch portrait, fragmented face, data distortion effects, identity and technology theme' },
  { id: 'neon_outline_sketch', label: '✨ Phác họa viền neon', value: 'Neon outline illustration over realistic portrait, hand-drawn sketch lines, dark background, artistic contrast' },
  { id: 'dreamlike_double_self', label: '✨ Hai bản ngã', value: 'Double self portrait, overlapping faces with soft transparency, dreamy psychological concept' },
  { id: 'editorial_typo_minimal', label: '✨ Typography tối giản', value: 'Minimal editorial portrait with clean typography elements, modern magazine layout, white space focused design' },
  { id: 'hologram_identity', label: '✨ Nhân dạng hologram', value: 'Holographic portrait style, translucent glow layers, futuristic identity visualization, soft sci-fi lighting' },
];

// 2. STANDARD PHOTOGRAPHY STYLES
export const STANDARD_STYLES: OptionItem[] = [
  { id: 'front_face_clean', label: 'Chính diện rõ mặt', value: 'Centered front-facing studio portrait, preserve natural left-right facial asymmetry, clean neutral background' },
  { id: 'half_face_portrait', label: 'Chân dung nửa mặt', value: 'Half-face studio portrait, one side of face in light, the other in soft shadow, clean background' },
  { id: 'three_quarter_face', label: 'Góc 3/4 khuôn mặt', value: 'Three-quarter face portrait, slight head turn, natural facial depth, studio lighting' },
  { id: 'profile_side_view', label: 'Nghiêng mặt (Profile)', value: 'Side profile studio portrait, clean outline, minimal background, elegant composition' },
  { id: 'face_focus_blur_bg', label: 'Mặt rõ – nền mờ', value: 'Face-focused portrait, shallow depth of field, softly blurred background, studio look' },
  { id: 'eyes_contact_closeup', label: 'Cận mắt – Giao tiếp', value: 'Close-up portrait with direct eye contact, strong facial connection, soft studio lighting' },
  { id: 'shoulder_crop_portrait', label: 'Cắt vai – Gọn khung', value: 'Studio portrait cropped at shoulders, clean framing, professional headshot style' },
  { id: 'one_eye_light', label: 'Một mắt sáng/tối', value: 'Studio portrait with light focused on one eye, the other in shadow, dramatic but clean composition' },
  { id: 'face_off_center', label: 'Mặt lệch khung', value: 'Off-center portrait composition, subject slightly to one side, negative space background' },
  { id: 'chin_down_confident', label: 'Cúi cằm tự tin', value: 'Portrait with chin slightly down, eyes looking forward, confident and grounded presence' },
  { id: 'chin_up_vision', label: 'Ngẩng nhẹ – Tầm nhìn', value: 'Portrait with chin slightly up, eyes forward or above camera, visionary and leadership feel' },
  { id: 'look_away_thoughtful', label: 'Nhìn lệch – Suy tư', value: 'Subject looking slightly away from camera, thoughtful expression, calm studio mood' },
  { id: 'close_crop_face', label: 'Cắt sát mặt', value: 'Tight face crop portrait, minimal headroom, strong facial presence' },
  { id: 'headroom_space', label: 'Nhiều khoảng trống trên', value: 'Portrait with intentional headroom, balanced framing, calm and professional look' },
  { id: 'diagonal_pose', label: 'Tư thế chéo nhẹ', value: 'Slight diagonal body pose, subtle dynamic composition, natural studio posture' },
  { id: 'shoulder_turn_pose', label: 'Xoay vai', value: 'Shoulders turned slightly, face toward camera, adds depth and natural body language' },
  { id: 'hands_visible_frame', label: 'Có tay trong khung', value: 'Studio portrait with hands partially visible, relaxed gesture, conversational feel' },
  { id: 'upper_body_portrait', label: 'Nửa người trên', value: 'Upper-body studio portrait, chest to head framing, suitable for speaking or presentation' },
  { id: 'asymmetric_light_balance', label: 'Ánh sáng lệch cân', value: 'Asymmetrical lighting portrait, one side brighter, subtle depth and realism' },
  { id: 'street_handheld', label: 'Phóng sự đường phố', value: 'Street photography handheld style, candid natural movement, reportage feel, authentic and unposed' },
  { id: 'golden_outdoor', label: 'Ngoài trời Golden Hour', value: 'Outdoor golden hour portrait, warm backlight glow, natural environment, lifestyle photography' },
  { id: 'candid_lifestyle', label: 'Candid đời thường', value: 'Candid lifestyle portrait, subject in natural activity, authentic moment, documentary feel' },
  { id: 'environmental_wide', label: 'Chân dung môi trường rộng', value: 'Environmental portrait with wide perspective, subject small in large meaningful space, editorial storytelling' },
  { id: 'minimal_editorial', label: 'Tối giản Editorial', value: 'Minimalist editorial portrait, clean composition, strong negative space, modern fashion photography' },
];

export const POSE_CATEGORIES: CategoryItem[] = [
  {
    id: 'standing',
    label: 'Dáng Đứng (Quyền lực/Thư giãn)',
    options: [
      { id: 'stand_arms_crossed', label: 'Khoanh tay tự tin', value: 'Standing tall, arms crossed confidently, power pose' },
      { id: 'stand_hands_pocket', label: 'Tay đút túi quần', value: 'Standing, one hand in pocket, relaxed but professional' },
      { id: 'stand_lean_wall', label: 'Dựa lưng vào tường', value: 'Leaning back against a wall or glass window, relaxed' },
      { id: 'stand_podium', label: 'Đứng bục phát biểu', value: 'Standing behind a podium, gesturing with hands as if speaking' },
      { id: 'stand_neutral_relaxed', label: 'Đứng thả lỏng tự nhiên', value: 'Standing in a neutral relaxed posture, shoulders down, natural body alignment' },
      { id: 'stand_hands_front', label: 'Hai tay trước người', value: 'Standing with hands lightly clasped in front, calm and approachable stance' },
      { id: 'stand_one_arm_cross', label: 'Một tay khoanh nhẹ', value: 'Standing with one arm loosely crossed, other arm relaxed, confident yet friendly posture' },
      { id: 'stand_weight_shift', label: 'Dồn trọng tâm một chân', value: 'Standing with weight shifted to one leg, natural and casual body language' },
      { id: 'stand_side_angle', label: 'Đứng nghiêng nhẹ', value: 'Standing at a slight side angle, body turned subtly, adds depth and elegance' },
      { id: 'stand_hand_gesture', label: 'Tay cử chỉ nhẹ', value: 'Standing with gentle hand gesture, conversational and expressive presence' },
      { id: 'stand_step_forward', label: 'Bước nhẹ về phía trước', value: 'Standing with one foot stepping slightly forward, confident and dynamic posture' },
      { id: 'stand_back_straight', label: 'Lưng thẳng cổ cao', value: 'Standing upright with straight back and lifted posture, composed and professional stance' },
    ]
  },
  {
    id: 'sitting',
    label: 'Dáng Ngồi (Văn phòng/Cafe)',
    options: [
      { id: 'sit_ceo', label: 'Ngồi ghế giám đốc', value: 'Sitting comfortably in a high-back leather executive chair, hands on armrests' },
      { id: 'sit_desk_working', label: 'Ngồi làm việc (Laptop)', value: 'Sitting at a desk, typing on a laptop, focused expression' },
      { id: 'sit_coffee', label: 'Ngồi cafe chill', value: 'Sitting at a cafe table, holding a coffee cup, relaxed posture' },
      { id: 'lean_desk', label: 'Dựa hông vào bàn', value: 'Leaning hip against the edge of a desk, arms crossed or holding a document' },
      { id: 'sit_legs_crossed', label: 'Ngồi vắt chân', value: 'Sitting in an armchair, legs crossed elegantly, holding a book or tablet' },
    ]
  },
  {
    id: 'action',
    label: 'Hành động & Di chuyển',
    options: [
      { id: 'walking', label: 'Đang bước đi', value: 'Walking confidently towards the camera, dynamic movement' },
      { id: 'looking_watch', label: 'Xem đồng hồ', value: 'Looking at wristwatch, busy professional vibe' },
      { id: 'phone_call', label: 'Nghe điện thoại', value: 'Talking on a smartphone, business negotiation context' },
      { id: 'cheers', label: 'Cụng ly (Tiệc)', value: 'Raising a wine glass for a toast, party atmosphere' },
      { id: 'walking_side_view', label: 'Đi ngang khung hình', value: 'Walking naturally across the frame, side view, casual and realistic movement' },
      { id: 'walking_away', label: 'Đi xa dần', value: 'Walking away from the camera, relaxed pace, reflective and calm mood' },
      { id: 'turning_back', label: 'Quay lại nhìn', value: 'Walking then turning back to look at the camera, natural transitional motion' },
      { id: 'slow_stroll', label: 'Đi chậm thư thái', value: 'Slow relaxed walk, hands loose, calm and confident presence' },
      { id: 'walking_with_coffee', label: 'Vừa đi vừa cầm cà phê', value: 'Walking while holding a coffee cup, casual lifestyle and approachable vibe' },
      { id: 'adjusting_jacket_walk', label: 'Vừa đi vừa chỉnh áo', value: 'Walking and adjusting jacket or sleeves, polished and professional motion' },
      { id: 'walking_phone_text', label: 'Vừa đi vừa nhắn tin', value: 'Walking while checking phone messages, modern urban daily movement' },
      { id: 'entering_space', label: 'Bước vào không gian', value: 'Entering a room or space with natural stride, confident and purposeful movement' },
    ]
  },
  {
    id: 'product_pose',
    label: '📦 Cầm / Trưng bày Sản phẩm',
    options: [
      { id: 'hold_product_chest', label: 'Cầm trước ngực (2 tay)', value: 'Holding the product in front of chest with both hands, product label or front facing camera clearly, confident commercial pose' },
      { id: 'hold_product_raise', label: 'Giơ sản phẩm ngang mặt', value: 'Holding the product raised up near face level with one hand, product prominently displayed beside the face, advertising style' },
      { id: 'hold_product_one_hand', label: 'Cầm 1 tay thả lỏng', value: 'Holding the product casually in one hand at waist level, relaxed natural commercial pose, product clearly visible' },
      { id: 'open_palm_product', label: 'Đặt trên lòng bàn tay', value: 'Product resting on open flat palm extended toward camera, gift-presenting gesture, close-up product reveal pose' },
      { id: 'look_at_product', label: 'Nhìn vào sản phẩm', value: 'Looking at the product held in hands with curious or satisfied expression, natural discovery moment' },
      { id: 'use_product', label: 'Đang dùng sản phẩm', value: 'Actively using or applying the product as if demonstrating it, natural usage moment, genuine interaction' },
      { id: 'unbox_product', label: 'Mở hộp / Unboxing', value: 'Unboxing or opening the product packaging with excitement, moment of first reveal, lifestyle unboxing pose' },
      { id: 'product_beside_face', label: 'Sản phẩm kề bên má', value: 'Holding product up beside cheek or ear with gentle smile, product and face both prominent, beauty/skincare style pose' },
      { id: 'sit_product_table', label: 'Ngồi – Sản phẩm trên bàn', value: 'Seated with product placed on table in front, hands resting naturally, both person and product clearly visible' },
      { id: 'point_at_product', label: 'Chỉ vào sản phẩm bên cạnh', value: 'Standing and pointing to or gesturing toward the product displayed beside them, presenter-style commercial pose' },
      { id: 'hold_product_cross_arm', label: 'Khoanh tay – Sản phẩm ở tay', value: 'Arms loosely crossed, holding product in one hand naturally at side, confident brand ambassador pose' },
      { id: 'smell_product', label: 'Ngửi / Cảm nhận sản phẩm', value: 'Eyes closed or half-closed, smelling or savoring the product with a blissful relaxed expression, perfume or food product pose' },
    ]
  },
];

export const FACE_ENHANCEMENT_OPTIONS: OptionItem[] = [
  { id: 'lock_face', label: '🔒 Khoá khuôn mặt', value: 'Preserve the complete facial topology and natural asymmetry from the reference: forehead, temples, cheekbones, jaw, chin, ears, eyes/eyelids, individual eyebrows and eyelashes, nose, lips, skin tone/microtexture, hairline and hair density. Do not beautify or alter anatomy.' },
  { id: 'smooth_skin', label: '✨ Làm mịn da', value: 'Gently even temporary redness while retaining zone-varying pores, vellus hair, follicles, under-eye texture, age-appropriate lines and permanent marks; never poreless or plastic.' },
  { id: 'bright_skin', label: '☀️ Da sáng tự nhiên', value: 'Slightly brighter honest exposure and healthy colour balance without whitening or changing undertone; preserve pores and natural highlight roll-off.' },
  { id: 'younger', label: '⏪ Trẻ hóa (5-10 tuổi)', value: 'Create a subtly rested impression through flattering light only; preserve the real age bracket, facial topology, skin microtexture and age-appropriate lines.' },
  { id: 'remove_wrinkles', label: '🌸 Xóa nếp nhăn', value: 'Soften harsh shadow contrast on fine lines while retaining age-appropriate wrinkle geometry, pores and real skin texture.' },
  { id: 'makeup', label: '💄 Trang điểm nhẹ', value: 'Light natural makeup sitting visibly on real textured skin; keep individual brow hairs, eyelashes, lip lines and natural facial anatomy.' },
  { id: 'bright_eyes', label: '👁 Mắt sáng nổi bật', value: 'Clear moist catchlights, detailed iris fibres, off-white sclera, tear line and anatomical eyelid folds; never glassy or glowing-white eyes.' },
  { id: 'sharp_features', label: '💎 Nét mặt sắc sảo', value: 'Improve optical focus and directional-light definition only; preserve the original jaw, cheekbones, nose, lips and natural asymmetry without reshaping.' },
];

export const RATIO_OPTIONS = [
  { id: '9:16', label: 'Dọc (Toàn thân)', value: '9:16' },
  { id: '16:9', label: 'Ngang (Điện ảnh)', value: '16:9' },
  { id: '1:1', label: 'Vuông (Avatar)', value: '1:1' },
];

export const CONTEXT_CATEGORIES: CategoryItem[] = [
  {
    id: 'studio_bg',
    label: 'Phông nền Studio',
    options: [
      { id: 'bg_pure_white', label: 'Phông Trắng Tinh khiết', value: 'High-key studio photography, pure white infinity background, clean and commercial look' },
      { id: 'bg_studio_grey', label: 'Phông Xám Chuyên nghiệp', value: 'Professional studio grey backdrop, soft lighting, elegant portrait style' },
      { id: 'bg_deep_black', label: 'Phông Đen Huyền bí', value: 'Low-key studio photography, pure black background, dramatic rim lighting, intense mood' },
      { id: 'bg_pastel_pink', label: 'Phông Hồng Pastel', value: 'Soft pastel pink studio background, sweet and youthful vibe, commercial pop style' },
      { id: 'bg_pastel_blue', label: 'Phông Xanh Pastel', value: 'Soft pastel blue studio background, calm and fresh look' },
      { id: 'bg_beige', label: 'Phông Be (Beige) Hàn Quốc', value: 'Warm beige studio background, Korean profile photo style, soft and elegant' },
      { id: 'bg_textured_canvas', label: 'Phông Vải Canvas Nghệ thuật', value: 'Hand-painted textured canvas backdrop, fine art portrait style, classic look' },
      { id: 'bg_gradient_blue', label: 'Gradient Xanh Đậm', value: 'Dark blue gradient studio background, corporate headshot style' },
      { id: 'bg_abstract_light', label: 'Ánh sáng Trừu tượng', value: 'Studio background with abstract light bokeh and blurred shapes, creative mood' },
    ]
  },
  {
    id: 'office',
    label: 'Văn phòng',
    options: [
      { id: 'ceo_desk', label: 'Bàn CEO quyền lực', value: 'High-end CEO desk, city view background, luxury interior' },
      { id: 'luxury_executive_office', label: 'Phòng điều hành cao cấp', value: 'Luxury executive office, refined interior design, large desk, calm authoritative atmosphere' },
      { id: 'modern_luxury_office', label: 'Văn phòng hiện đại cao cấp', value: 'Modern luxury office, minimalist furniture, soft lighting, premium materials' },
      { id: 'classic_wood_office', label: 'Phòng gỗ cổ điển', value: 'Classic wood-paneled office, dark wood desk, elegant traditional executive style' },
      { id: 'penthouse_office', label: 'Văn phòng penthouse', value: 'Penthouse office space, floor-to-ceiling windows, city skyline view, exclusive atmosphere' },
      { id: 'designer_office', label: 'Văn phòng thiết kế cao cấp', value: 'High-end designer office, custom furniture, artistic yet professional environment' },
      { id: 'meeting_room', label: 'Phòng họp kính', value: 'Modern glass-walled meeting room, bright professional atmosphere' },
      { id: 'open_plan', label: 'Văn phòng mở', value: 'Busy modern open-plan office, blurred colleagues in background' },
      { id: 'podium', label: 'Bục phát biểu', value: 'Speaking at a podium, conference hall, spotlight' },
      { id: 'executive_office', label: 'Phòng làm việc điều hành', value: 'Executive office room, large desk, bookshelf background, calm professional mood' },
      { id: 'startup_workspace', label: 'Không gian startup', value: 'Startup office workspace, laptops and whiteboards, casual professional environment' },
      { id: 'coworking_space', label: 'Co-working space', value: 'Modern coworking space, shared desks, natural light, creative working vibe' },
      { id: 'office_window_side', label: 'Gần cửa sổ văn phòng', value: 'Office window-side area, natural daylight, city buildings outside' },
      { id: 'presentation_screen', label: 'Trước màn hình thuyết trình', value: 'Office presentation area, large screen behind, professional speaking setup' },
      { id: 'small_meeting_room', label: 'Phòng họp nhỏ', value: 'Small meeting room, round table, intimate professional discussion setting' },
      { id: 'office_corridor', label: 'Hành lang văn phòng', value: 'Office corridor with glass walls, modern corporate interior, walking perspective' },
      { id: 'desk_workstation', label: 'Bàn làm việc cá nhân', value: 'Personal workstation desk, laptop and documents, focused working atmosphere' },
      { id: 'lounge_office', label: 'Khu tiếp khách văn phòng', value: 'Office lounge area, sofa seating, relaxed professional environment' },
      { id: 'training_room', label: 'Phòng đào tạo nội bộ', value: 'Corporate training room, chairs facing front, learning-focused atmosphere' },
      { id: 'office_reception', label: 'Sảnh lễ tân', value: 'Office reception area, clean modern design, professional first-impression space' },
    ]
  },
  {
    id: 'gym_fitness',
    label: 'Gym & Thể thao',
    options: [
      { id: 'luxury_gym', label: 'Gym cao cấp hiện đại', value: 'Upscale luxury gym interior, high-end equipment, warm ambient LED lighting, mirror walls, polished concrete floors, premium fitness club atmosphere, real photography' },
      { id: 'neon_gym', label: 'Gym ánh đèn neon (Mạnh mẽ)', value: 'Neon-lit industrial gym, dramatic purple and blue colored lighting, exposed brick and metal, power and intensity atmosphere, real photography' },
      { id: 'pilates_studio', label: 'Studio Pilates sáng trưng', value: 'Bright airy pilates studio, white walls with natural light, wooden floor, reformer equipment, clean minimalist fitness space, realistic photography' },
      { id: 'boxing_studio', label: 'Phòng tập boxing', value: 'Professional boxing studio, hanging heavy bags, focused overhead lighting, raw athletic environment, gritty and powerful atmosphere' },
      { id: 'outdoor_park_training', label: 'Tập ngoài trời (Công viên)', value: 'Outdoor fitness training in urban green park, fresh morning light, trees and grass background, energetic and natural athletic setting' },
      { id: 'resort_pool', label: 'Hồ bơi resort cao cấp', value: 'Luxury resort infinity pool, turquoise crystal water, palm trees, golden hour sunlight, exclusive tropical vacation atmosphere' },
      { id: 'tennis_court', label: 'Sân tennis quốc tế', value: 'International standard hard court tennis facility, professional surroundings, clean bright sports photography, athletic prestige' },
      { id: 'yoga_rooftop', label: 'Yoga sân thượng (City view)', value: 'Rooftop yoga and wellness space, panoramic city skyline view, sunrise or sunset light, peaceful elevated urban lifestyle setting' },
      { id: 'crossfit_industrial', label: 'CrossFit Box (Công nghiệp)', value: 'Industrial crossfit training box, rubber matted floors, overhead pendant lighting, raw exposed structure, intense serious athletic environment' },
      { id: 'gym_mirror', label: 'Gương gym phản chiếu', value: 'Gym mirror full-length reflection setup, modern gym equipment visible, strong ambient lighting, fitness influencer style photography' },
    ]
  },
  {
    id: 'hongkong_cinematic',
    label: '🎬 HK Điện ảnh 80s',
    options: [
      { id: 'hk_wet_street_night', label: 'Phố đêm HK mưa (Wong Kar-wai)', value: 'Rain-slicked Hong Kong street at night circa 1980s, neon signs reflected in wet pavement, warm amber and green color cast, film grain, melancholic cinematic mood, Wong Kar-wai aesthetic, 2046 film style' },
      { id: 'hk_neon_alley', label: 'Hẻm đèn neon Hồng Kông', value: 'Narrow Hong Kong alley at night, dense neon signage in Chinese characters, red yellow and pink glowing lights, vintage 1980s Kowloon urban atmosphere, moody and evocative' },
      { id: 'hk_bar_lounge', label: 'Bar Hồng Kông thập niên 80', value: 'Intimate dim bar in 1980s Hong Kong, warm amber overhead lighting, dark wooden bar counter, smoky atmospheric haze, classic Cantopop era nostalgic vibe, In the Mood for Love style' },
      { id: 'hk_rooftop_night', label: 'Mái nhà Hồng Kông (Hè đêm)', value: 'Rooftop in Hong Kong at night, city neon lights below, humid summer air feel, dense urban skyline, cinematic urban nostalgic mood' },
      { id: 'hk_market_daytime', label: 'Chợ đêm Hồng Kông', value: 'Busy Hong Kong night market, small shops crowded together, lanterns and hanging goods, natural warm lighting, authentic 1980s Cantonese street life' },
      { id: 'hk_tram_interior', label: 'Tàu điện cổ Hồng Kông', value: 'Inside a vintage Hong Kong double-decker tram, rattan seats, warm yellow interior lighting, blurred neon street outside windows, nostalgic public transport photography' },
      { id: 'hk_cinema_lobby', label: 'Sảnh rạp HK cổ điển', value: 'Old Hong Kong cinema lobby, 1980s movie poster decor, atmospheric warm tungsten lighting, golden age of Hong Kong cinema nostalgia' },
      { id: 'hk_phone_booth_night', label: 'Bốt điện thoại đêm HK', value: 'Vintage Hong Kong phone booth at night, rain falling outside, backlit from interior glow, lonely urban atmosphere, classic noir cinematic scene' },
    ]
  },
  {
    id: 'international_landmarks_natural',
    label: 'Cảnh Đẹp Nước Ngoài',
    options: [
      { id: 'eiffel_tower_street_view', label: 'Paris – Gần Tháp Eiffel', value: 'Street-level view near Eiffel Tower, pedestrian walkway, natural daylight, casual travel photo perspective' },
      { id: 'times_square_sidewalk', label: 'New York – Vỉa hè Times Square', value: 'Standing on sidewalk at Times Square, eye-level city view, neon signs around, candid urban photo' },
      { id: 'tower_bridge_riverside', label: 'London – Bờ sông Thames', value: 'Riverside walkway near Tower Bridge, natural walking perspective, cloudy daylight, realistic city scene' },
      { id: 'burj_khalifa_downtown_walk', label: 'Dubai – Khu Downtown', value: 'Downtown Dubai pedestrian area, Burj Khalifa visible in background, natural standing viewpoint' },
      { id: 'paris_seine_riverside', label: 'Paris – Bờ sông Seine', value: 'Walking along the Seine riverbank in Paris, stone embankment, city buildings nearby, natural daylight, casual travel photo perspective' },
      { id: 'montmartre_street', label: 'Paris – Khu Montmartre', value: 'Street view in Montmartre Paris, sloped cobblestone road, small cafes, everyday European neighborhood atmosphere' },
      { id: 'lucerne_lake_walk', label: 'Thụy Sĩ – Ven hồ Lucerne', value: 'Lakeside walkway in Lucerne, calm water, old town buildings nearby, mountains in distance, eye-level viewpoint' },
      { id: 'interlaken_village_view', label: 'Thụy Sĩ – Làng Interlaken', value: 'Village street in Interlaken, traditional Swiss houses, mountains visible, quiet natural daylight scene' },
      { id: 'zermatt_village_path', label: 'Thụy Sĩ – Lối đi Zermatt', value: 'Pedestrian path in Zermatt village, alpine wooden houses, mountain scenery around, natural tourist viewpoint' },
      { id: 'rome_colosseum_outside', label: 'Rome – Bên ngoài Colosseum', value: 'Standing outside Colosseum Rome, street-level angle, tourists nearby, warm afternoon light' },
      { id: 'shibuya_crossing_corner', label: 'Tokyo – Góc đường Shibuya', value: 'Street corner at Shibuya Crossing, eye-level view, people crossing naturally, handheld photo feel' },
      { id: 'santorini_cliff_path', label: 'Santorini – Lối đi ven vách đá', value: 'Walking path along Santorini cliffs, white houses nearby, natural travel photo angle' },
      { id: 'swiss_alps_village_view', label: 'Thụy Sĩ – Làng núi Alps', value: 'Village viewpoint in Swiss Alps, ground-level perspective, mountains in distance, calm daylight' },
      { id: 'venice_canal_walkway', label: 'Venice – Lối đi ven kênh', value: 'Walking beside Venice canal, gondolas passing, eye-level tourist photo perspective' },
      { id: 'newzealand_lakeside', label: 'New Zealand – Ven hồ', value: 'Standing by lakeside in New Zealand, mountains reflected in water, natural scenic photo' },
      { id: 'sydney_harbor_walk', label: 'Sydney – Bến cảng', value: 'Harbor-side walkway near Sydney Opera House, daylight, casual travel photography angle' },
      { id: 'grand_canyon_viewpoint', label: 'Mỹ – Điểm ngắm Grand Canyon', value: 'Public viewpoint at Grand Canyon, standing position, vast landscape ahead, natural perspective' },
      { id: 'iceland_waterfall_path', label: 'Iceland – Lối đi gần thác', value: 'Walking path near Iceland waterfall, mist in air, eye-level outdoor photography' },
      { id: 'maldives_beach_walk', label: 'Maldives – Đi bộ trên bãi biển', value: 'Walking along Maldives beach, overwater villas nearby, handheld travel photo feeling' },
      { id: 'petra_main_path', label: 'Petra – Lối đi chính', value: 'Main walking path in Petra, rock formations around, natural tourist viewpoint' },
    ]
  },
  {
    id: 'street',
    label: 'Đường phố',
    options: [
      { id: 'hanoi_old_quarter_street', label: 'Phố cổ Hà Nội', value: 'Narrow street in Hanoi Old Quarter, low-rise houses, hanging signs, motorbikes passing, natural daytime street photography' },
      { id: 'hanoi_sidewalk_coffee', label: 'Cà phê vỉa hè Hà Nội', value: 'Small plastic stools on Hanoi sidewalk cafe, people chatting casually, trees overhead, everyday urban life' },
      { id: 'hanoi_lake_walk', label: 'Dạo quanh Hồ Gươm', value: 'Walking path around Hoan Kiem Lake, people strolling, trees and water nearby, calm morning atmosphere' },
      { id: 'saigon_cafe_balcony', label: 'Cafe ban công Sài Gòn', value: 'Balcony cafe in Saigon, overlooking busy street, scooters below, casual city lifestyle perspective' },
      { id: 'saigon_street_morning', label: 'Phố Sài Gòn buổi sáng', value: 'Early morning street in Saigon, street vendors setting up, soft daylight, everyday city rhythm' },
      { id: 'saigon_alley_life', label: 'Hẻm Sài Gòn', value: 'Saigon residential alley, small houses, parked motorbikes, people passing by, authentic local scene' },
      { id: 'danang_beach_road', label: 'Đường ven biển Đà Nẵng', value: 'Coastal road in Da Nang, motorbikes passing, sea visible nearby, relaxed daylight atmosphere' },
      { id: 'danang_cafe_seaside', label: 'Cafe ven biển Đà Nẵng', value: 'Seaside cafe in Da Nang, outdoor seating, ocean breeze, casual travel photography angle' },
      { id: 'hoi_an_old_street', label: 'Phố cổ Hội An', value: 'Hoi An old town street, yellow walls, lanterns overhead, slow walking pace, natural daylight scene' },
      { id: 'hue_riverside_walk', label: 'Ven sông Hương – Huế', value: 'Riverside walkway along Perfume River, trees and water nearby, quiet local atmosphere' },
      { id: 'dalat_cafe_garden', label: 'Cafe vườn Đà Lạt', value: 'Garden cafe in Da Lat, pine trees around, cool weather feel, relaxed outdoor seating' },
      { id: 'dalat_sloped_street', label: 'Dốc Đà Lạt', value: 'Sloped street in Da Lat, houses on hillside, light foggy air, everyday residential scenery' },
      { id: 'ny_street', label: 'Phố New York', value: 'Busy New York street, yellow taxis, skyscrapers, fashion photography' },
      { id: 'paris_cafe', label: 'Cafe Paris', value: 'Outdoor Parisian cafe, romantic vibe, morning sunlight' },
      { id: 'night_city', label: 'Thành phố đêm', value: 'City street at night, neon lights, rainy reflection, cyberpunk vibe' },
      { id: 'park_bench', label: 'Ghế đá công viên', value: 'Sitting on a bench in a city park, autumn leaves' },
      { id: 'newyork_neighborhood_street', label: 'Phố khu dân cư New York', value: 'Residential street in New York, brick buildings, parked cars, casual everyday city life perspective' },
      { id: 'paris_street_cafe', label: 'Cafe vỉa hè Paris', value: 'Street-side cafe in Paris, small round tables, people sitting casually, soft daylight urban scene' },
      { id: 'tokyo_local_street', label: 'Phố khu dân cư Tokyo', value: 'Quiet Tokyo neighborhood street, low-rise buildings, bicycles parked, clean everyday city atmosphere' },
      { id: 'zurich_old_town_street', label: 'Phố cổ Zurich', value: 'Old town street in Zurich, cobblestone road, small shops, calm European daily life scene' },
    ]
  },
  {
    id: 'nature',
    label: 'Thiên nhiên',
    options: [
      { id: 'sapa_mountain_trail', label: 'Sapa – Đường mòn núi', value: 'Mountain hiking trail in Sapa, terraced rice fields nearby, misty air, natural trekking photography' },
      { id: 'hoang_lien_son_ridge', label: 'Hoàng Liên Sơn – Sống núi', value: 'Ridge trail in Hoang Lien Son range, forested slopes, clouds drifting, realistic hiking viewpoint' },
      { id: 'fansipan_viewpoint', label: 'Fansipan – Điểm ngắm cảnh', value: 'Public viewpoint near Fansipan, standing position, mountains stretching ahead, cool highland atmosphere' },
      { id: 'ha_giang_rocky_path', label: 'Hà Giang – Đường đá cao nguyên', value: 'Rocky walking path in Ha Giang highlands, steep mountains around, raw northern Vietnam scenery' },
      { id: 'phu_quoc_beach_walk', label: 'Phú Quốc – Đi bộ ven biển', value: 'Walking along Phu Quoc beach, gentle waves, palm trees nearby, natural seaside photo perspective' },
      { id: 'con_dao_coastline', label: 'Côn Đảo – Ven biển hoang sơ', value: 'Coastal path in Con Dao, rocky shore and clear water, quiet untouched beach atmosphere' },
      { id: 'swiss_alps_hiking_trail', label: 'Alps – Đường trekking Thụy Sĩ', value: 'Hiking trail in Swiss Alps, grassy slopes, mountains nearby, clear daylight, eye-level view' },
      { id: 'nepal_himalaya_path', label: 'Himalaya – Lối đi Nepal', value: 'Mountain footpath in Nepal Himalayas, prayer flags nearby, calm trekking atmosphere' },
      { id: 'newzealand_mountain_track', label: 'New Zealand – Đường núi', value: 'Mountain walking track in New Zealand, open landscape, cool air, realistic outdoor hiking scene' },
      { id: 'japan_alpine_trail', label: 'Nhật Bản – Núi Alps', value: 'Japanese alpine trail, forested mountains, wooden path, quiet nature hike' },
      { id: 'dolomites_viewpoint', label: 'Dolomites – Điểm ngắm núi', value: 'Public viewpoint in Dolomites, standing position, jagged peaks ahead, natural European mountain scene' },
      { id: 'scotland_highlands_path', label: 'Scotland – Cao nguyên', value: 'Highland walking path in Scotland, rolling hills, cloudy sky, raw natural atmosphere' },
      { id: 'iceland_volcanic_hills', label: 'Iceland – Đồi núi lửa', value: 'Volcanic hills in Iceland, walking trail, moss-covered ground, dramatic but realistic landscape' },
      { id: 'thailand_cliff_beach', label: 'Thái Lan – Biển vách đá', value: 'Coastal path above beach in Thailand, limestone cliffs, blue water below, natural travel photo angle' },
      { id: 'greece_seaside_walk', label: 'Hy Lạp – Lối đi ven biển', value: 'Seaside walking path in Greece, white buildings nearby, calm Mediterranean light' },
      { id: 'bali_coastal_path', label: 'Bali – Đường ven biển', value: 'Coastal walking trail in Bali, cliffs and ocean nearby, warm tropical daylight' },
      { id: 'forest', label: 'Rừng thông', value: 'Deep pine forest, sunlight filtering through trees, cinematic' },
      { id: 'beach', label: 'Bãi biển hoàng hôn', value: 'Luxury beach resort, sunset golden hour, ocean background' },
      { id: 'garden', label: 'Vườn hoa', value: 'Blooming flower garden, soft pastel colors, dreamy' },
      { id: 'mountain', label: 'Đỉnh núi', value: 'Mountain peak, clouds below, epic adventure vibe' },
    ]
  },
];

// OUTFIT DATABASE ORGANIZED BY GENDER
export const OUTFIT_DATABASE: Record<string, CategoryItem[]> = {
  MALE: [
    {
      id: 'suit',
      label: 'Vest/Doanh nhân',
      options: [
        { id: 'm_classic_suit', label: 'Vest Cổ điển (Cà vạt)', value: 'Classic navy blue tailored business suit with tie' },
        { id: 'm_modern_suit', label: 'Vest Hiện đại (Không cà vạt)', value: 'Modern slim-fit grey suit, white shirt open collar, no tie' },
        { id: 'm_tuxedo', label: 'Tuxedo (Dạ tiệc)', value: 'Black tuxedo, bow tie, formal evening wear' },
        { id: 'm_wool_silk_suit_tie', label: 'Vest len pha lụa (Cà vạt)', value: 'Tailored wool-silk blend suit, smooth texture, subtle sheen, classic tie, premium executive style' },
        { id: 'm_italian_cut_suit_tie', label: 'Vest form Ý (Cà vạt)', value: 'Italian-cut slim suit, structured shoulders, fine wool fabric, elegant tie, refined modern gentleman look' },
        { id: 'm_charcoal_business_suit_tie', label: 'Vest xám than doanh nhân (Cà vạt)', value: 'Charcoal grey business suit, high-quality wool, crisp tailoring, professional tie, confident leadership presence' },
        { id: 'm_light_grey_open_collar', label: 'Vest xám sáng cổ mở', value: 'Light grey premium suit, open collar white shirt, breathable fine wool, clean modern professional style' },
        { id: 'm_beige_summer_suit', label: 'Vest be mùa hè', value: 'Beige summer suit, lightweight linen-wool blend, open collar, relaxed yet upscale look' },
        { id: 'm_navy_minimal_suit', label: 'Vest xanh navy tối giản', value: 'Navy blue minimalist suit, soft tailoring, open collar shirt, young executive aesthetic' },
        { id: 'm_double_breasted_modern', label: 'Vest 2 hàng nút hiện đại', value: 'Modern double-breasted suit, premium fabric, sharp lines, open collar styling, confident fashion-forward look' },
        { id: 'm_textured_fabric_suit', label: 'Vest vải dệt texture', value: 'Textured premium fabric suit, subtle weave detail, open collar shirt, contemporary stylish appearance' },
        { id: 'm_dark_green_suit', label: 'Vest xanh rêu cao cấp', value: 'Dark green tailored suit, luxury wool fabric, open collar, distinctive yet elegant modern style' },
      ]
    },
    {
      id: 'casual',
      label: 'Đời thường',
      options: [
        { id: 'm_polo', label: 'Áo Polo & Quần tây', value: 'Smart casual polo shirt and chinos, old money aesthetic' },
        { id: 'm_linen', label: 'Sơ mi Hè/Linen', value: 'White linen shirt, rolled sleeves, relaxed summer vibe' },
        { id: 'm_hoodie', label: 'Hoodie/Jacket', value: 'Trendy streetwear, bomber jacket, layered clothing' },
        { id: 'm_business_casual_blazer', label: 'Blazer & Áo thun', value: 'Unstructured blazer with premium cotton t-shirt, tailored trousers, modern business casual style' },
        { id: 'm_knit_polo_trousers', label: 'Polo dệt & Quần tây', value: 'Fine-knit polo shirt with tailored trousers, clean smart casual businessman look' },
        { id: 'm_shirt_no_tie', label: 'Sơ mi cổ mở', value: 'Crisp white shirt, open collar, slim trousers, relaxed executive appearance' },
        { id: 'm_light_sweater_layer', label: 'Áo len mỏng khoác vai', value: 'Lightweight sweater layered over shirt, elegant casual European businessman style' },
        { id: 'm_summer_blazer_linen', label: 'Blazer linen mùa hè', value: 'Linen blazer with open collar shirt, breathable fabric, upscale summer business style' },
        { id: 'm_dark_polo_minimal', label: 'Polo tối giản cao cấp', value: 'Dark tone premium polo shirt, tailored pants, minimalist modern entrepreneur vibe' },
        { id: 'm_cardigan_smart', label: 'Cardigan lịch sự', value: 'Fine wool cardigan over shirt, clean trousers, intellectual business casual look' },
        { id: 'm_shirt_trousers_watch', label: 'Sơ mi & đồng hồ cơ', value: 'Tailored shirt with dress trousers, mechanical watch detail, refined gentleman style' },
        { id: 'm_casual_leather_jacket', label: 'Áo khoác da nhẹ', value: 'Minimal leather jacket with shirt and trousers, confident urban businessman aesthetic' },
      ]
    },
    {
      id: 'sports',
      label: 'Thể thao',
      options: [
        { id: 'm_gym', label: 'Đồ tập Gym', value: 'Professional athletic wear, compression shirt, gym context' },
        { id: 'm_golf', label: 'Đồ Golf', value: 'Professional golf outfit, polo and technical trousers' },
        { id: 'm_gym_minimal', label: 'Gym tối giản nam', value: 'Mens minimalist gym outfit, fitted performance t-shirt, tapered training pants, clean athletic look' },
        { id: 'm_gym_polo_athletic', label: 'Gym polo thể thao', value: 'Mens athletic polo shirt with technical fabric, smart gym style, professional appearance' },
        { id: 'm_gym_layered_clean', label: 'Gym layering lịch sự', value: 'Mens layered gym outfit, lightweight zip jacket over training top, refined athletic aesthetic' },
        { id: 'm_hiking_smart_tech', label: 'Leo núi tech lịch sự', value: 'Mens technical hiking outfit, breathable long-sleeve top, slim trekking pants, clean outdoor style' },
        { id: 'm_hiking_softshell', label: 'Leo núi áo softshell', value: 'Mens softshell hiking jacket, functional yet tailored fit, professional trekking appearance' },
        { id: 'm_hiking_neutral_tone', label: 'Leo núi tông trung tính', value: 'Mens hiking outfit in neutral colors, modern cut, understated and elegant outdoor look' },
        { id: 'm_hiking_travel_style', label: 'Leo núi kiểu travel', value: 'Mens travel-style hiking wear, versatile jacket and pants, suitable for city-to-mountain transition' },
        { id: 'm_running_smart_minimal', label: 'Chạy bộ tối giản', value: 'Mens minimalist running outfit, streamlined athletic wear, clean and professional runner style' },
        { id: 'm_running_long_sleeve', label: 'Chạy bộ tay dài', value: 'Mens long-sleeve running top with technical fabric, smart and composed athletic appearance' },
        { id: 'm_active_travel_casual', label: 'Activewear đa năng', value: 'Mens versatile activewear, suitable for light workout, walking, and travel, smart casual athletic style' },
      ]
    },
    {
      id: 'party',
      label: 'Đi tiệc',
      options: [
        { id: 'm_party_shirt', label: 'Sơ mi họa tiết tiệc', value: 'Stylish patterned shirt, unbuttoned collar, party lighting' },
        { id: 'm_leather_jacket', label: 'Áo khoác da cá tính', value: 'Black leather jacket, dark t-shirt, night life style' },
        { id: 'm_party_black_shirt', label: 'Sơ mi đen tiệc tối', value: 'Mens black tailored shirt, subtle sheen fabric, slim trousers, elegant evening party style' },
        { id: 'm_party_silk_shirt', label: 'Sơ mi lụa cao cấp', value: 'Mens silk-blend shirt, smooth texture, open collar, refined luxury party look' },
        { id: 'm_party_blazer_no_tie', label: 'Blazer tiệc không cà vạt', value: 'Mens sharp blazer with open-collar shirt, tailored pants, modern gentleman party aesthetic' },
        { id: 'm_party_velvet_blazer', label: 'Blazer nhung dạ tiệc', value: 'Mens velvet blazer, dark tone, soft lighting reflection, upscale evening event style' },
        { id: 'm_party_monochrome', label: 'Monochrome tiệc đêm', value: 'Mens monochrome party outfit, black or dark grey tones, minimalist luxury vibe' },
        { id: 'm_party_leather_blazer', label: 'Blazer da cá tính', value: 'Mens leather or leather-look blazer, dark shirt, confident nightlife party style' },
        { id: 'm_party_dark_turtleneck', label: 'Áo cổ lọ tiệc', value: 'Mens dark turtleneck with tailored trousers, sleek modern evening elegance' },
        { id: 'm_party_pattern_subtle', label: 'Sơ mi họa tiết tinh tế', value: 'Mens subtle patterned shirt, premium fabric, tasteful party-ready appearance' },
        { id: 'm_party_double_breasted', label: 'Vest tiệc 2 hàng nút', value: 'Mens double-breasted suit, open collar or minimal shirt, sophisticated party gentleman look' },
        { id: 'm_party_night_luxury', label: 'Luxury nightlife', value: 'Mens upscale nightlife outfit, dark tones, refined textures, confident elite party presence' },
      ]
    },
    {
      id: 'traditional',
      label: 'Truyền thống',
      options: [
        { id: 'm_aodai', label: 'Áo Dài Nam', value: 'Traditional Vietnamese Ao Dai for men, ceremonial style' },
        { id: 'm_aodai_brocade_dragon', label: 'Áo dài gấm rồng', value: 'Mens traditional Ao Dai with subtle dragon brocade pattern, structured form, dignified masculine style' },
        { id: 'm_aodai_brocade_cloud', label: 'Áo dài gấm mây', value: 'Mens Ao Dai with cloud motif brocade, refined texture, ceremonial and elegant appearance' },
        { id: 'm_aodai_solid_embroidery', label: 'Áo dài thêu tối giản', value: 'Mens Ao Dai with minimal embroidery details, clean lines, understated traditional masculinity' },
        { id: 'm_aodai_calligraphy', label: 'Áo dài thư pháp', value: 'Mens Ao Dai featuring calligraphy-inspired patterns, cultural depth, intellectual and formal style' },
        { id: 'm_aodai_geometric_classic', label: 'Áo dài hoa văn hình học', value: 'Mens Ao Dai with classic geometric patterns, balanced symmetry, strong and composed look' },
        { id: 'm_aodai_silk_jacquard', label: 'Áo dài lụa jacquard', value: 'Mens silk jacquard Ao Dai, rich woven texture, smooth drape, premium traditional outfit' },
        { id: 'm_aodai_royal_pattern', label: 'Áo dài họa tiết hoàng gia', value: 'Mens Ao Dai with royal-inspired motifs, formal ceremonial tone, authoritative masculine presence' },
        { id: 'm_aodai_bamboo_motif', label: 'Áo dài họa tiết tre', value: 'Mens Ao Dai with bamboo motif patterns, symbolic strength and integrity, elegant Vietnamese heritage style' },
        { id: 'm_aodai_dark_traditional', label: 'Áo dài tông trầm truyền thống', value: 'Mens dark-tone traditional Ao Dai, subtle woven patterns, calm and powerful formal appearance' },
      ]
    },
    {
      id: 'korean_style_m',
      label: 'Hàn Quốc (K-Style)',
      options: [
        { id: 'm_k_ootd', label: 'OOTD Hàn Quốc nam', value: "Korean men's OOTD, clean minimal layers, neutral tones, slim fit pieces, effortless Seoul street style" },
        { id: 'm_k_business_casual', label: 'Smart casual Hàn Quốc', value: "Korean smart casual, fitted turtleneck or shirt, tailored pants, clean accessories, sophisticated Korean men's fashion" },
        { id: 'm_k_streetwear', label: 'Streetwear Seoul', value: 'Seoul streetwear, oversized hoodie or shirt, jogger pants, clean sneakers, Korean urban youth fashion' },
        { id: 'm_k_minimal', label: 'Tối giản cao cấp Hàn', value: 'Korean premium minimal style, quality fabrics, muted palette, clean silhouette, understated Seoul elegance' },
      ]
    },
    {
      id: 'beach_resort_m',
      label: 'Biển & Resort',
      options: [
        { id: 'm_resort_linen_shirt', label: 'Sơ mi linen resort nam', value: "Men's linen shirt unbuttoned, resort style, relaxed vacation look, Mediterranean vibes" },
        { id: 'm_resort_shorts', label: 'Short vải cao cấp resort', value: "Men's premium fabric shorts with fitted polo, luxury resort casual style" },
        { id: 'm_beach_minimal', label: 'Biển tối giản nam', value: "Men's minimal beach style, clean swim shorts, premium casual resort wear" },
        { id: 'm_resort_blazer_white', label: 'Blazer trắng resort nam', value: "Men's white or cream linen blazer, lightweight summer luxury, yacht club inspired" },
      ]
    },
  ],
  FEMALE: [
    {
      id: 'suit',
      label: 'Vest/Doanh nhân',
      options: [
        { id: 'f_female_suit', label: 'Vest Nữ quyền lực', value: 'Sharp tailored female power suit, elegant and professional' },
        { id: 'f_blazer_skirt', label: 'Blazer & Chân váy', value: 'Professional blazer with matching pencil skirt' },
        { id: 'f_power_suit_modern', label: 'Vest nữ quyền lực hiện đại', value: 'Modern female power suit, sharp tailoring, premium fabric, confident professional presence' },
        { id: 'f_oversized_blazer', label: 'Vest oversize cá tính', value: 'Oversized blazer suit for women, relaxed fit, fashion-forward and confident style' },
        { id: 'f_pastel_suit', label: 'Vest màu pastel trẻ trung', value: 'Pastel-tone women suit, soft color palette, youthful and elegant professional look' },
        { id: 'f_crop_blazer_suit', label: 'Vest croptop phá cách', value: 'Cropped blazer suit for women, modern silhouette, bold and stylish personality' },
        { id: 'f_double_breasted_suit', label: 'Vest nữ 2 hàng nút', value: 'Double-breasted women suit, structured shoulders, classic yet powerful aesthetic' },
        { id: 'f_monochrome_suit', label: 'Vest đơn sắc thời thượng', value: 'Monochrome women suit, minimalist design, clean and high-fashion business style' },
        { id: 'f_belted_blazer_suit', label: 'Vest thắt đai eo', value: 'Belted blazer suit for women, accentuated waist, elegant and confident feminine power look' },
        { id: 'f_textured_fabric_suit', label: 'Vest vải texture cao cấp', value: 'Textured premium fabric women suit, subtle pattern, modern stylish professional appearance' },
      ]
    },
    {
      id: 'casual',
      label: 'Đời thường',
      options: [
        { id: 'f_dress_summer', label: 'Váy Hè nhẹ nhàng', value: 'Flowing summer dress, floral patterns, relaxed vibe' },
        { id: 'f_jeans_top', label: 'Jeans & Áo thun', value: 'Casual denim jeans, white stylish top, everyday look' },
        { id: 'f_wrap_dress', label: 'Váy wrap nữ tính', value: 'Wrap dress for women, flattering silhouette, soft fabric, elegant and subtly seductive everyday style' },
        { id: 'f_slip_dress', label: 'Váy lụa slip dress', value: 'Silk slip dress, minimalist cut, smooth texture, modern feminine and fashionable look' },
        { id: 'f_flared_dress', label: 'Váy xòe trẻ trung', value: 'Flared casual dress, light fabric, playful movement, youthful and energetic vibe' },
        { id: 'f_bodycon_dress', label: 'Váy ôm tôn dáng', value: 'Bodycon dress, figure-hugging fit, confident and stylish everyday femininity' },
        { id: 'f_shirt_dress', label: 'Váy sơ mi hiện đại', value: 'Shirt dress for women, relaxed yet chic cut, versatile daily fashion style' },
        { id: 'f_crop_top_jeans', label: 'Áo croptop & jeans', value: 'Crop top paired with high-waist jeans, youthful, confident and dynamic street style' },
        { id: 'f_tanktop_skirt', label: 'Tank top & chân váy', value: 'Fitted tank top with casual skirt, relaxed feminine summer look' },
        { id: 'f_blouse_shorts', label: 'Áo blouse & quần short', value: 'Light blouse with tailored shorts, fresh and fashionable casual outfit' },
        { id: 'f_oversize_shirt_jeans', label: 'Sơ mi oversize & jeans', value: 'Oversized shirt with denim jeans, effortless modern street fashion for women' },
        { id: 'f_sporty_chic', label: 'Phong cách sporty chic', value: 'Sporty chic womenswear, fitted top with casual pants, active yet stylish everyday vibe' },
      ]
    },
    {
      id: 'sports',
      label: 'Thể thao',
      options: [
        { id: 'f_yoga', label: 'Đồ tập Yoga', value: 'Premium yoga wear, leggings and sports top, fit body' },
        { id: 'f_tennis', label: 'Đồ Tennis', value: 'Classic white tennis outfit, skirt and polo' },
        { id: 'f_gym_minimal_fit', label: 'Gym tối giản nữ', value: 'Womens minimalist gym outfit, fitted performance top and high-waist leggings, clean and confident athletic look' },
        { id: 'f_gym_layered_style', label: 'Gym layering hiện đại', value: 'Womens gym wear with light zip jacket over sports top, sleek and refined fitness style' },
        { id: 'f_hiking_modern_neutral', label: 'Leo núi tông trung tính', value: 'Womens modern hiking outfit, neutral colors, fitted long-sleeve top, slim trekking pants, elegant outdoor style' },
        { id: 'f_hiking_softshell_fit', label: 'Leo núi áo softshell', value: 'Womens softshell hiking jacket with tailored fit, functional yet feminine trekking appearance' },
        { id: 'f_hiking_travel_active', label: 'Leo núi phong cách travel', value: 'Womens travel-style hiking wear, versatile jacket and pants, city-to-nature modern look' },
        { id: 'f_hiking_layered_light', label: 'Leo núi layering nhẹ', value: 'Womens layered hiking outfit, breathable inner top, lightweight outer layer, active and graceful outdoor vibe' },
        { id: 'f_running_slim_modern', label: 'Chạy bộ gọn dáng', value: 'Womens streamlined running outfit, fitted top and leggings, modern and confident runner style' },
        { id: 'f_running_long_sleeve', label: 'Chạy bộ tay dài', value: 'Womens long-sleeve running top with technical fabric, elegant and composed athletic look' },
        { id: 'f_running_jacket_light', label: 'Chạy bộ áo khoác mỏng', value: 'Womens lightweight running jacket, slim fit, sporty yet stylish urban running aesthetic' },
        { id: 'f_running_monotone', label: 'Chạy bộ đơn sắc', value: 'Womens monotone running outfit, clean lines, subtle curves, modern and tasteful fitness fashion' },
      ]
    },
    {
      id: 'party',
      label: 'Đi tiệc',
      options: [
        { id: 'f_evening_gown', label: 'Đầm dạ hội', value: 'Elegant long evening gown, luxury jewelry, gala style' },
        { id: 'f_cocktail_dress', label: 'Váy Cocktail', value: 'Chic cocktail dress, vibrant party colors' },
        { id: 'f_evening_satin_gown', label: 'Đầm satin dạ hội', value: 'Satin evening gown, smooth flowing fabric, elegant silhouette, refined and tasteful sensuality' },
        { id: 'f_one_shoulder_dress', label: 'Váy lệch vai', value: 'One-shoulder cocktail dress, clean lines, subtle feminine allure, classy party style' },
        { id: 'f_slit_long_dress', label: 'Váy dài xẻ nhẹ', value: 'Long evening dress with subtle side slit, graceful movement, elegant and confident femininity' },
        { id: 'f_midi_party_dress', label: 'Váy midi dự tiệc', value: 'Midi party dress, fitted waist, balanced coverage, chic and sophisticated look' },
        { id: 'f_back_detail_dress', label: 'Váy hở lưng tinh tế', value: 'Evening dress with refined open-back detail, tasteful sensuality, elegant night event style' },
        { id: 'f_blazer_evening_set', label: 'Blazer dự tiệc', value: 'Womens tailored blazer with elegant inner top, slim trousers or skirt, modern classy party outfit' },
        { id: 'f_silk_blouse_trousers', label: 'Áo lụa & quần tây', value: 'Silk blouse paired with tailored trousers, soft shine fabric, understated luxury evening style' },
        { id: 'f_monochrome_party_set', label: 'Set tiệc đơn sắc', value: 'Monochrome party outfit for women, clean silhouette, modern and elegant event presence' },
        { id: 'f_lace_detail_outfit', label: 'Trang phục điểm ren', value: 'Evening outfit with subtle lace accents, feminine detail, refined and tasteful allure' },
        { id: 'f_dark_turtleneck_party', label: 'Cổ lọ tiệc tối', value: 'Dark-tone turtleneck with elegant skirt or trousers, sleek and sophisticated night event look' },
      ]
    },
    {
      id: 'traditional',
      label: 'Truyền thống',
      options: [
        { id: 'f_aodai', label: 'Áo Dài Nữ', value: 'Traditional Vietnamese Ao Dai, silk texture, intricate patterns' },
        { id: 'f_aodai_classic_silk', label: 'Áo dài lụa truyền thống', value: 'Classic womens Ao Dai in silk fabric, smooth drape, elegant traditional Vietnamese femininity' },
        { id: 'f_aodai_floral_embroidery', label: 'Áo dài thêu hoa', value: 'Womens Ao Dai with floral embroidery details, graceful and refined traditional beauty' },
        { id: 'f_aodai_pastel_modern', label: 'Áo dài pastel hiện đại', value: 'Pastel-tone modern Ao Dai, soft colors, youthful and fashionable Vietnamese style' },
        { id: 'f_aodai_high_collar', label: 'Áo dài cổ cao cách tân', value: 'High-collar modern Ao Dai, clean lines, elegant and confident feminine look' },
        { id: 'f_aodai_short_sleeve', label: 'Áo dài tay ngắn', value: 'Short-sleeve Ao Dai for women, light and comfortable design, modern daily elegance' },
        { id: 'f_aodai_layered_sheer', label: 'Áo dài layering voan', value: 'Layered Ao Dai with sheer fabric overlay, airy movement, contemporary feminine aesthetic' },
        { id: 'f_aodai_geometric_pattern', label: 'Áo dài họa tiết hình học', value: 'Womens Ao Dai with geometric patterns, bold yet balanced modern-traditional fusion' },
        { id: 'f_aodai_lace_detail', label: 'Áo dài điểm ren', value: 'Ao Dai with subtle lace accents, delicate femininity, elegant and tasteful allure' },
        { id: 'f_aodai_royal_motif', label: 'Áo dài họa tiết hoàng gia', value: 'Womens Ao Dai with royal-inspired motifs, formal ceremonial tone, luxurious Vietnamese heritage' },
        { id: 'f_aodai_dark_elegant', label: 'Áo dài tông trầm sang trọng', value: 'Dark-tone elegant Ao Dai, refined patterns, mature and graceful feminine presence' },
        { id: 'f_aodai_modern_split', label: 'Áo dài cách tân xẻ hiện đại', value: 'Modern split Ao Dai design, fashion-forward silhouette, confident and stylish Vietnamese woman' },
      ]
    },
    {
      id: 'korean_style',
      label: 'Hàn Quốc (K-Style)',
      options: [
        { id: 'f_k_ootd', label: 'OOTD Hàn Quốc ngọt ngào', value: 'Korean sweet OOTD, light pastel colors, feminine silhouette, layered accessories, K-drama heroine style' },
        { id: 'f_k_street', label: 'Streetwear Hàn Quốc', value: 'Korean streetwear, oversized cotton pieces, neutral tones, clean sneakers, effortless Seoul street style' },
        { id: 'f_k_minimal', label: 'Hàn tối giản cao cấp', value: 'Korean minimalist style, premium fabrics, understated colors, clean tailoring, sophisticated Seoul fashion' },
        { id: 'f_k_cafe', label: 'Cafe look Hàn Quốc', value: 'Korean cafe date look, cozy knit sweater, straight leg jeans, clean and aesthetic everyday style' },
        { id: 'f_k_business', label: 'Business Hàn Quốc thanh lịch', value: 'Korean business chic, structured blazer with feminine details, clean professional look, Seoul office style' },
        { id: 'f_k_idol', label: 'Style idol Kpop', value: 'Kpop idol-inspired fashion, trendy and polished styling, stage-ready chic with casual luxe elements' },
      ]
    },
    {
      id: 'beach_resort',
      label: 'Biển & Resort',
      options: [
        { id: 'f_resort_white', label: 'Đầm trắng resort', value: 'White flowing resort maxi dress, light fabric, Mediterranean luxury vacation style' },
        { id: 'f_bikini_cover', label: 'Áo khoác bãi biển', value: 'Beach cover-up over swimwear, stylish resort look, tropical destination fashion' },
        { id: 'f_sundress_tropical', label: 'Sundress nhiệt đới', value: 'Bright tropical sundress, floral patterns, lightweight fabric, summer vacation style' },
        { id: 'f_resort_linen', label: 'Linen set resort', value: 'Matching linen set top and pants, neutral tones, breezy and elegant resort wear' },
        { id: 'f_beach_elegant', label: 'Biển sang trọng', value: 'Elegant beach style, tailored shorts with silk blouse, resort luxury fashion' },
      ]
    },
    {
      id: 'quiet_luxury_f',
      label: 'Quiet Luxury (Tối giản)',
      options: [
        { id: 'f_ql_camel', label: 'Camel coat tối giản', value: 'Camel wool coat, minimal branding, premium fabric, old money quiet luxury aesthetic' },
        { id: 'f_ql_cream_set', label: 'Cream matching set', value: 'Cream colored coordinated set, clean tailoring, understated elegance, Loro Piana inspired' },
        { id: 'f_ql_trench', label: 'Trench coat cổ điển', value: 'Classic trench coat, timeless cut, neutral tone, effortlessly sophisticated' },
        { id: 'f_ql_cashmere', label: 'Cashmere turtleneck', value: 'Fine cashmere turtleneck, perfectly fitted, minimal luxury, elevated everyday dressing' },
        { id: 'f_ql_wide_pants', label: 'Quần rộng vải cao cấp', value: 'Wide-leg tailored trousers, premium fabric drape, paired with simple top, refined minimalist fashion' },
      ]
    },
  ]
};

export const QUALITY_OPTIONS: OptionItem[] = [
  { id: 'hyperreal_8k', label: 'Siêu thực 8K (Photorealistic)', value: 'Hyper-realistic camera photography, high optical resolution, honest unprocessed tonal response, physically plausible skin/hair/fabric microdetail without synthetic pore noise or crunchy oversharpening' },
  { id: 'cinematic', label: 'Điện ảnh (Cinematic)', value: 'Cinematic movie quality, professional DCI color grading, film-like atmosphere, teal and orange tone palette' },
  { id: 'high_fashion', label: 'Thời trang cao cấp (Editorial)', value: "High-fashion editorial photography, Vogue and Harper's Bazaar magazine quality, luxury aesthetic, impeccable styling" },
  { id: 'luxury_commercial', label: 'Quảng cáo thương mại (Luxury)', value: 'Luxury commercial advertising photography, premium brand campaign quality, aspirational and flawless presentation' },
  { id: '4k_studio', label: '4K Studio Professional', value: '4K professional studio photography, extreme sharpness, precise lighting control, commercial portfolio quality' },
  { id: 'vintage_film', label: 'Film Analog 35mm (Cổ điển)', value: 'Authentic 35mm analog film photography, organic grain, Kodak Portra 400 color science, timeless nostalgic quality' },
  { id: 'natural_realistic', label: 'Đời thường tự nhiên', value: 'Natural camera photography, unretouched authentic look, zone-varying pores, vellus hair, real brows/lashes/hairline, age-appropriate texture and candid natural lighting' },
  { id: 'smartphone_candid', label: 'Điện thoại (Candid đời thật)', value: 'Smartphone photography aesthetic, candid feel, natural exposure, slight handheld realism, social media authentic style' },
];

export const EXPRESSION_OPTIONS: OptionItem[] = [
  { id: 'friendly', label: 'Thân thiện (Friendly)', value: 'Friendly, slight smile, approachable, warm eyes' },
  { id: 'confident', label: 'Tự tin (Confident)', value: 'Confident, subtle closed-mouth smile, direct eye contact' },
  { id: 'professional', label: 'Chuyên nghiệp', value: 'Professional, calm, composed, trustworthy' },
  { id: 'slight_smile', label: 'Cười mỉm nhẹ', value: 'Very subtle smile, soft expression, elegant' },
  { id: 'serious', label: 'Nghiêm nghị (Serious)', value: 'Serious, intense focus, powerful gaze' },
  { id: 'neutral', label: 'Tự nhiên (Neutral)', value: 'Neutral relaxed expression, calm' },
  { id: 'dreamy', label: 'Mơ màng', value: 'Dreamy look, looking away slightly, soft eyes' },
];

export const LIGHTING_OPTIONS: OptionItem[] = [
  { id: 'studio_soft', label: '💡 Studio Soft (Softbox)', value: 'Professional softbox studio lighting, beautifully even and flattering illumination, clean controlled shadows' },
  { id: 'natural_window', label: '🪟 Cửa sổ tự nhiên', value: 'Natural window light, soft directional daylight, warm indoor photography atmosphere, realistic and flattering' },
  { id: 'golden_hour', label: '🌅 Golden Hour (Hoàng hôn)', value: 'Warm golden hour sunlight, romantic cinematic glow, long soft shadows, magical late afternoon quality' },
  { id: 'rembrandt', label: '🎭 Rembrandt (Nghệ thuật)', value: 'Classic Rembrandt lighting, dramatic side illumination, triangular highlight on cheek, fine art portrait depth' },
  { id: 'split', label: '⚡ Split Light (Nửa sáng/tối)', value: 'Bold split lighting, exactly half face in bright light and half in shadow, strong dramatic portrait statement' },
  { id: 'butterfly', label: '🦋 Butterfly (Glamour)', value: 'Butterfly lighting from directly above, glamour shadow beneath nose, Hollywood golden age beauty style' },
  { id: 'backlit', label: '✨ Ngược sáng (Backlit)', value: 'Beautiful artistic backlight, glowing rim light around subject, dreamy and ethereal halo atmosphere' },
  { id: 'neon', label: '🌈 Neon Cyber (Đô thị đêm)', value: 'Vivid neon pink and blue cyberpunk lighting, urban night atmosphere, colorful and dramatic mood' },
  { id: 'candle', label: '🕯 Nến / Ánh đèn ấm', value: 'Warm intimate candlelight or ambient lamp glow, soft warm color temperature, romantic atmosphere' },
  { id: 'blue_hour', label: '🌙 Blue Hour (Chạng vạng)', value: 'Blue hour twilight outdoor light, cool deep blue sky, warm artificial lights in contrast, magical evening atmosphere' },
  { id: 'overcast', label: '☁️ Overcast (Mây khuếch tán)', value: 'Soft overcast sky diffused light, even outdoor illumination, no harsh shadows, clean and professional outdoor result' },
];

export const CAMERA_OPTIONS: OptionItem[] = [
  { id: 'portrait_85mm', label: '85mm f/1.4 Portrait (Bokeh đẹp)', value: 'Shot on 85mm f/1.4 portrait lens, beautiful creamy bokeh background blur, flattering perspective compression, sharp subject' },
  { id: 'standard_50mm', label: '50mm f/1.8 Standard (Tự nhiên)', value: 'Shot on 50mm f/1.8 standard lens, natural perspective, slight background separation, clean and realistic rendering' },
  { id: 'street_35mm', label: '35mm f/1.4 Street (Môi trường)', value: 'Shot on 35mm lens, wide environmental portrait, natural perspective with surroundings, reportage street style' },
  { id: 'tele_135mm', label: '135mm f/2 Telephoto (Nén cảnh)', value: 'Shot on 135mm f/2 telephoto lens, strong background compression, very flattering subject rendering, silky bokeh' },
  { id: 'medium_format', label: 'Medium Format (Hasselblad)', value: 'Shot on Hasselblad medium format camera, extraordinary tonal depth and resolution, luxury fashion campaign quality' },
  { id: 'zoom_2470', label: '24-70mm f/2.8 (Đa năng)', value: 'Shot on professional 24-70mm f/2.8 zoom lens, versatile framing, sharp commercial photography quality' },
  { id: 'wide_16mm', label: '16mm Wide Angle (Toàn cảnh)', value: 'Shot on 16mm ultra-wide angle lens, dramatic environmental context, powerful sense of place and scale' },
  { id: 'film_35mm', label: 'Film Camera 35mm (Analog)', value: 'Shot on analog 35mm film camera, authentic organic grain and vintage color rendering, timeless photographic character' },
  { id: 'none', label: 'Không chọn (Mặc định AI)', value: '' },
];

export const ANGLE_OPTIONS = [
  { id: 'wide', label: 'Toàn thân (Full Body)', value: 'Full body shot, head to toe visible, wide angle' },
  { id: 'half_body', label: 'Nửa người (Medium)', value: 'Medium shot, waist up' },
  { id: 'portrait', label: 'Cận cảnh (Headshot)', value: 'Close-up headshot, focus on face' },
  { id: 'low', label: 'Góc thấp (Quyền lực)', value: 'Low angle from below, looking up' },
  { id: 'eye', label: 'Ngang mắt', value: 'Eye level' },
];
