/*
 * nano_pipeline.js — Nano Flow M3 orchestration (planner + dry-run).
 *
 * Turns the imported shot queue (from nano_manifest.js) into an ordered,
 * per-shot EXECUTION PLAN describing exactly what the extension must do on Flow:
 *   STEP A (image): switch to Nano Banana, send storyboard_prompt + image_refs,
 *                   generate, name it storyboard_name, remember its mediaId.
 *   STEP B (video): use that image as the START FRAME + attach video_refs
 *                   (characters as reference), send video_prompt, generate.
 *
 * This module is PURE (no DOM / no network) so it runs in the browser side
 * panel AND under Node for tests. The actual Flow calls are performed by
 * content_script/inject (the "executor" seam) — see DESIGN.md §5.2 (M3).
 *
 * The dry-run (buildQueuePlan + planToLogLines) lets the user verify the
 * sequencing on the real extension BEFORE the live image-generation call is
 * wired, which is the one piece that must be captured from a live Flow session.
 *
 * Browser:  window.NanoPipeline     Node: require('./nano_pipeline.js')
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NanoPipeline = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Affiliate products are the canonical object authority and must never be
  // displaced by an optional location plate. Non-affiliate manifests have no
  // product refs, so their established character → environment order is intact.
  const IMAGE_REF_ORDER = ['products', 'characters', 'environments'];

  function refList(selector, kinds) {
    const out = [];
    (kinds || IMAGE_REF_ORDER).forEach(function (kind) {
      ((selector && selector[kind]) || []).forEach(function (asset) {
        if (!asset || !asset.id) return;
        // An asset may carry SEVERAL photos (asset.images — e.g. one location
        // shot from multiple angles). Expand each into its own ref so every
        // angle is fed to Nano Banana; fall back to the single asset.image.
        const imgs = Array.isArray(asset.images) && asset.images.length
          ? asset.images
          : (asset.image ? [asset.image] : [null]);
        imgs.forEach(function (img, i) {
          out.push({
            kind: kind,
            id: asset.id,
            name: imgs.length > 1 ? asset.name + ' (góc ' + (i + 1) + ')' : asset.name,
            image: img,
            // Trang phục khóa theo kịch bản (chỉ nhân vật) — dùng để tạo ảnh
            // toàn thân (wardrobe sheet) trước khi tạo keyframe.
            wardrobe: asset.wardrobe || '',
            // A2: bối cảnh khai 2 "ảnh nền" (toàn cảnh + góc khác) — extension tự
            // TẠO 1 lần rồi đính làm nền cho mọi scene ở địa điểm này (Veo hết bịa
            // cảnh). Chỉ mang theo khi KHÔNG có ảnh thật user nạp (ảnh thật ưu tiên).
            locationViews: (kind === 'environments' && !asset.image
              && !(Array.isArray(asset.images) && asset.images.length))
              ? (String(asset.location_sheet_prompt || '').trim()
                ? [{ angle: 'sheet', prompt: String(asset.location_sheet_prompt).trim() }]
                : (Array.isArray(asset.location_views) && asset.location_views.length
                  ? asset.location_views : null))
              : null,
          });
        });
      });
    });
    return out;
  }

  /**
   * Khóa theo ẢNH THẬT người dùng nạp (chỉ áp khi ref có image đính kèm):
   * - Bối cảnh: ảnh địa điểm nạp vào là NGUỒN CHÂN LÝ của cảnh — nano phải dựng
   *   đúng căn phòng/địa điểm trong ảnh (bố cục, nội thất, vật liệu, ánh sáng),
   *   KHÔNG tự bịa cảnh khác từ text. (Kịch bản chỉ quyết định hành động.)
   * - Nhân vật: ảnh là thẩm quyền danh tính (mặt/tóc/vóc dáng); trang phục lấy
   *   từ kịch bản, KHÔNG copy nền của ảnh chân dung.
   * - Sản phẩm: giữ đúng hình dáng/màu/nhãn của ảnh.
   * Trả về chuỗi rỗng khi không có ảnh nào — prompt giữ nguyên như manifest.
   */
  function refImageClauses(imageRefs) {
    const withImg = function (kind) {
      const seen = {};
      return imageRefs.filter(function (r) { return r.kind === kind && r.image; })
        .map(function (r) { return String(r.name).replace(/ \(góc \d+\)$/, ''); })
        .filter(function (n) { if (seen[n]) return false; seen[n] = true; return true; });
    };
    const chars = withImg('characters');
    const envs = withImg('environments');
    const prods = withImg('products');
    const parts = [];
    if (chars.length) parts.push(
      'ATTACHED CHARACTER REFERENCE(S) — identity authority for ' + chars.join(', ')
      + ': match the face, hair and body from the attached reference exactly; do not reinterpret. '
      + 'If the reference is a FULL-BODY WARDROBE SHEET, also copy its outfit EXACTLY (same garments, colours and shoes in every shot). '
      + 'Never copy the reference\'s own background.');
    if (envs.length) parts.push(
      'ATTACHED LOCATION PHOTO(S) — the setting authority (' + envs.join(', ')
      + '): all attached location photos show the SAME real place from different angles. Stage this scene INSIDE that place, '
      + 'choosing the angle that best matches the described camera framing. Reproduce its real layout, furniture/landmarks, '
      + 'materials, colours and lighting faithfully; do NOT invent a different room or relocate the scene.');
    if (prods.length) parts.push(
      'ATTACHED PRODUCT PHOTO(S) — keep the exact shape, colours, label and branding of: ' + prods.join(', ') + '.');
    return parts.length ? (' ' + parts.join(' ')) : '';
  }

  /** Build the two-step execution plan for one queue item (shot). */
  function buildShotPlan(item) {
    const imageRefs = refList(item.imageRefs, IMAGE_REF_ORDER);
    // STEP B references: only what video_refs asked for (default: characters).
    const videoRefs = refList(item.videoRefs, ['characters', 'environments', 'products']);
    const missing = imageRefs.filter(function (r) { return !r.image; });
    // Prompt ảnh có thể là JSON có cấu trúc (bản Storyboard mới) — khi đó khối
    // reference_authority đã nằm SẴN trong JSON, KHÔNG chèn prose ngoài (sẽ hỏng
    // JSON). Chỉ ghép clause văn xuôi cho prompt dạng chuỗi cũ, khi có ảnh đính kèm.
    const isJsonPrompt = /^\s*\{/.test(String(item.storyboardPrompt || ''));
    const refClauses = isJsonPrompt ? '' : refImageClauses(imageRefs);
    // A "transform" shot declares an END keyframe → we generate 2 images (start
    // + end) and drive the video in start_end_frame mode. §6.2.
    const hasEndPrompt = !!(item.endStoryboardPrompt && item.endStoryboardPrompt.trim());
    // Explicit mode wins for new manifests; old manifests remain compatible by
    // inferring two-frame execution from the existing end prompt.
    const hasEndFrame = item.frameMode
      ? item.frameMode === 'start_end' && hasEndPrompt
      : hasEndPrompt;

    return {
      shotId: item.shotId,
      index: item.index,
      name: item.name,
      durationSeconds: item.durationSeconds || 10,
      // B1 handoff: nối từ ảnh CUỐI scene trước (chỉ khi 'continuous'); cut → khung mới.
      chainFromPrev: item.chainFromPrev,
      frameMode: hasEndFrame ? 'start_end' : 'start',
      frameRole: item.frameRole || null,
      boardNo: item.boardNo || null,
      parentShotId: item.parentShotId || item.shotId,
      sceneNo: item.sceneNo || null,
      wardrobeChange: item.wardrobeChange || null,
      // ── STEP A: generate the storyboard/keyframe image with Nano Banana ──
      imageStep: {
        mode: 'nano-banana',
        prompt: item.storyboardPrompt + refClauses,
        imageName: item.name,           // the generated image is named after the shot
        refs: imageRefs,                // affiliate: product → characters → environment
        missingRefImages: missing,      // refs whose image the user hasn't attached yet
      },
      videoKeyframeStep: {
        mode: 'nano-banana-clean-video-frame',
        prompt: item.videoKeyframePrompt || '',
        imageName: item.name + ' (video keyframe)',
        refs: imageRefs,
        missingRefImages: missing,
      },
      // ── STEP A2 (optional): the END keyframe for a transform shot ──
      endImageStep: hasEndFrame ? {
        mode: 'nano-banana',
        prompt: item.endStoryboardPrompt + refClauses,
        imageName: item.name + ' (end)',
        refs: imageRefs,                // same refs as the start frame (same scene)
        missingRefImages: missing,
      } : null,
      // ── STEP B: generate video from the dedicated CLEAN keyframe, never the
      //    multi-panel STEP A board. Optional STEP A2 remains the last frame. ──
      videoStep: {
        prompt: item.videoPrompt,
        mode: hasEndFrame ? 'start_end_frame' : 'start_frame',
        useGeneratedStoryboardAsStartFrame: item.videoRefs ? item.videoRefs.useGeneratedStoryboard !== false : true,
        useCleanVideoKeyframe: item.videoRefs ? item.videoRefs.useCleanVideoKeyframe !== false : true,
        refs: videoRefs,                // characters kept as identity reference
        dialogue: item.dialogue || null,
        voice: item.voice || null,
      },
      status: 'pending',
    };
  }

  /** Build the full ordered plan for the whole queue + a readiness summary. */
  function buildQueuePlan(queue) {
    const shots = (queue || []).slice().sort(function (a, b) { return (a.index || 0) - (b.index || 0); });
    const plans = shots.map(buildShotPlan);
    const missingCount = plans.reduce(function (n, p) { return n + p.imageStep.missingRefImages.length; }, 0);
    return {
      shotCount: plans.length,
      plans: plans,
      ready: missingCount === 0,
      missingRefImageCount: missingCount,
    };
  }

  /** Human-readable dry-run: what the extension WOULD do, step by step. */
  function planToLogLines(plan, lang) {
    const vi = lang !== 'en';
    const lines = [];
    plan.plans.forEach(function (p) {
      lines.push('──────────');
      lines.push((vi ? 'Cảnh ' : 'Shot ') + '#' + p.index + ' — ' + p.name);
      const refNames = p.imageStep.refs.map(function (r) { return r.name + (r.image ? '' : ' ⚠️'); });
      lines.push('  A) ' + (vi ? 'Tạo ảnh Nano Banana' : 'Nano Banana image')
        + (refNames.length ? (vi ? ' với ref: ' : ' with refs: ') + refNames.join(', ') : (vi ? ' (không ref)' : ' (no refs)')));
      lines.push('     ' + (vi ? 'đặt tên: ' : 'name: ') + '"' + p.imageStep.imageName + '"');
      lines.push('     prompt: ' + truncate(p.imageStep.prompt, 90));
      if (p.endImageStep) {
        lines.push('  A2) ' + (vi ? 'Tạo ảnh KHUNG CUỐI' : 'END-frame image') + ' → "' + p.endImageStep.imageName + '"');
        lines.push('     prompt: ' + truncate(p.endImageStep.prompt, 90));
      }
      const vr = p.videoStep.refs.map(function (r) { return r.name; });
      lines.push('  B) ' + (vi ? 'Tạo video' : 'Video')
        + (p.videoStep.mode === 'start_end_frame'
            ? (vi ? ' — ảnh ĐẦU + ảnh CUỐI (Veo nội suy)' : ' — START + END frame (interpolated)')
            : (p.videoStep.useGeneratedStoryboardAsStartFrame ? (vi ? ' — ảnh vừa tạo = KHUNG ĐẦU' : ' — generated image = START FRAME') : ''))
        + (vr.length ? (vi ? ', ref nhân vật: ' : ', character refs: ') + vr.join(', ') : ''));
      lines.push('     prompt: ' + truncate(p.videoStep.prompt, 90)
        + (p.videoStep.dialogue ? (vi ? ' · thoại: "' : ' · line: "') + truncate(p.videoStep.dialogue, 40) + '"' : ''));
    });
    lines.push('──────────');
    lines.push((plan.ready ? '✅ ' : '⚠️ ')
      + (vi ? plan.shotCount + ' cảnh' : plan.shotCount + ' shots')
      + (plan.ready ? (vi ? ' — đủ ref, sẵn sàng' : ' — refs ready')
        : (vi ? ' — thiếu ' + plan.missingRefImageCount + ' ảnh ref (⚠️)' : ' — ' + plan.missingRefImageCount + ' ref images missing (⚠️)')));
    return lines;
  }

  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  return {
    IMAGE_REF_ORDER: IMAGE_REF_ORDER,
    buildShotPlan: buildShotPlan,
    buildQueuePlan: buildQueuePlan,
    planToLogLines: planToLogLines,
  };
});
