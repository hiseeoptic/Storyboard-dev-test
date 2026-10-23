// ============================================================
// AgentPlan — dựng LẠI ĐẦY ĐỦ quy trình Nano Flow cũ cho chế độ Agent của Flow mới.
//
// Flow mới chặn lệnh tạo do extension gửi, nên mọi ảnh/video phải do Agent tạo khi
// người dùng gửi tin nhắn. Module này biến manifest thành các TIN NHẮN theo thứ tự
// pipeline cũ (genNanoImages / genNanoVideos) — thường 3 tin, mỗi tin gom mọi mục cùng
// lúc; bước nào có tổng prompt quá sức Agent một lượt (AGENT_TURN_CHARS) thì chia nhỏ:
//   1. SHEET trang phục nhân vật (16:9, ref = ảnh nhân vật đã nạp; đổi đồ → sheet mới)
//      + ảnh BỐI CẢNH chuẩn (16:9, khi bối cảnh không có ảnh nạp)
//      + THUMBNAIL (ref = sản phẩm + ảnh nhân vật đã nạp — sheet chưa có lúc này)
//   2. KEYFRAME mọi shot (ref = mã sheet + mã ảnh bối cảnh vừa tạo ở tin 1 + sản phẩm)
//   3. VIDEO mọi shot: mặc định ref = keyframe + sheet + bối cảnh (tối đa 3 ảnh),
//      hoặc chế độ cũ "khung đầu = keyframe".
// Mọi ảnh đều có mã (media id) trước khi được dùng: ảnh nạp có mã ngay khi nạp, ảnh
// Agent tạo được đọc mã từ phản hồi StreamChat rồi ghi vào tin nhắn kế tiếp.
// Prompt lấy NGUYÊN VĂN từ manifest (không cắt); Agent được yêu cầu chép y nguyên.
// Hàm thuần — không đụng DOM/Chrome — để kiểm thử được bằng node.
// ============================================================
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AgentPlan = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const pad = (n) => String(n).padStart(2, '0');
  const lc = (s) => String(s || '').trim().toLowerCase();

  // Cùng prompt sheet nhân vật của pipeline cũ (inject.js · sheetPromptFor).
  // Thời trang: ảnh váy là mẫu, KHÔNG kèm mô tả chữ của món có ảnh (chữ làm mô hình
  // vẽ lại sai — viền bèo nhỏ thành dải bèo to). Chỉ giữ các món ảnh không có.
  const outfitPiecesNotInPhoto = (outfit) => {
    const m = String(outfit || '').match(/;\s*(?:plus pieces not in the photo|styled with)[^:]*:\s*([\s\S]*)$/i);
    return m ? m[1].trim() : '';
  };
  const tryOnHead = (opts) => (opts && opts.outfitRef) ? {
    task: opts.hasFace === false
      ? 'VIRTUAL TRY-ON CHARACTER SHEET: ONE new person wearing the EXACT garment(s) from the attached OUTFIT photo(s), copied piece for piece like the product photo put on a body; then lay the result out as the sheet described below.'
      : 'VIRTUAL TRY-ON CHARACTER SHEET: the person from the PERSON photo (the LAST attached image) wearing the EXACT garment(s) from the OUTFIT photo(s) (the FIRST attached image(s)), copied piece for piece like the product photo put on a body; then lay the result out as the sheet described below.',
  } : {};
  function sheetPrompt(name, outfit, sceneHint, opts) {
    const outfitRef = !!(opts && opts.outfitRef);
    return JSON.stringify(Object.assign(tryOnHead(opts), {
      type: 'photoreal_character_board_sheet',
      canvas_contract: 'Exactly ONE 16:9 landscape image. Split it at x=50%. The LEFT region occupies x=0–50%, y=0–100%. Split only the RIGHT region horizontally: RIGHT-TOP occupies x=50–100%, y=0–50%; RIGHT-BOTTOM occupies x=50–100%, y=50–100%. Use thin clean dividers. Never swap, mirror, reorder or resize these three cells. No labels, text or numbers.',
      left_cell_x0_50_y0_100: 'ONE 3/4-to-front FULL-BODY view of the person, entire body visible continuously from top of head through both shoes, standing relaxed and wearing the complete locked outfit. This is the ONLY full-body or torso view on the sheet.',
      right_top_cell_x50_100_y0_50: 'ONE straight-on FRONTAL portrait of the same person, cropped strictly FROM THE BASE OF THE NECK UP. Show the complete head, face, hair and neck only. No shoulders, chest, torso, arms, hands or clothing below the neck.',
      right_bottom_cell_x50_100_y50_100: 'ONE exact 90-DEGREE SIDE PROFILE of the same person, cropped strictly FROM THE BASE OF THE NECK UP. Show the complete head, hair and neck only; nose points fully left or fully right. No three-quarter angle, shoulders, chest, torso, arms, hands or clothing below the neck.',
      subject: name + ' — the identical individual in all three cells; same face, head shape, hair, skin, age and grooming. Only the LEFT full-body cell may show the outfit or body below the neck.',
      identity_authority: 'Copy the face, head, hair, skin and features of the ATTACHED reference photo EXACTLY — do not reinterpret, age, slim or beautify. The RIGHT-TOP frontal neck-up crop and RIGHT-BOTTOM 90° profile neck-up crop are equal identity anchors of the SAME head. The LEFT full-body cell carries that identical face. Every cell must unmistakably depict the same real person.',
      wardrobe: outfit || ("one practical, concrete everyday outfit that fits this story's setting (" + String(sceneHint || '').replace(/\s+/g, ' ').slice(0, 300) + ') — pick specific garments (top, bottom, footwear)'),
      wardrobe_rule: 'ONLY the LEFT full-body cell shows the complete locked outfit (top, bottom, footwear). BOTH RIGHT cells terminate at the base of the neck; at most a very narrow collar edge may appear. Never show shoulders or any garment body in either RIGHT cell. Ignore clothes in the attached reference photo — it governs face and identity only.',
      background: 'plain light-grey seamless studio background, soft even lighting, no props, no text',
      render: 'Photorealistic, true-to-life skin and fabric textures, sharp focus, ultra-detailed — a real photograph.',
      negative: 'swapped cells, frontal close-up in the LEFT cell, full-body or half-body person in either RIGHT cell, shoulders in either RIGHT cell, chest in either RIGHT cell, torso in either RIGHT cell, arms or hands in either RIGHT cell, three-quarter face in the RIGHT-BOTTOM cell, cut-off feet in the LEFT cell, different face between cells, beautified or altered face, mismatched outfit, cartoon, anime, illustration, 3D render, CGI, on-screen text, watermark',
    }, outfitRef ? {
      // Trang phục người dùng gắn (ảnh sản phẩm): ảnh đồ TRƯỚC, ảnh mặt SAU; không mô tả chữ món có ảnh.
      reference_roles: (opts.hasFace === false
        ? 'All attached images are OUTFIT product photos — clothes only.'
        : 'The FIRST attached image(s) are the OUTFIT product photo(s); the LAST attached image is the PERSON photo (face, hair and identity only — ignore its clothes).')
        + ' Outfit photos define the clothing exactly and NOTHING else: never copy the face, hair, skin, body or pose of any model or mannequin in them.',
      wardrobe: 'VIRTUAL TRY-ON: EXACTLY the garment(s) in the OUTFIT photo(s), transferred piece for piece — the same silhouette, neckline, straps or strapless top, gathers/ruching and frills at the same size, ties or sash in the same position with the same knot, the same number of layers and hem shape, length, colour, print and fabric texture. The photo decides every detail; there is deliberately no text description of it — never redesign, simplify or embellish it.' + (outfitPiecesNotInPhoto(outfit) ? ' Pieces the photo does not show: ' + outfitPiecesNotInPhoto(outfit) + '.' : ''),
      wardrobe_rule: 'ONLY the LEFT full-body cell shows the complete outfit. BOTH RIGHT cells terminate at the base of the neck. Do not add, remove or restyle any garment.',
      ...(opts.hasFace === false ? {} : { identity_authority: 'Copy the face, head, hair, skin and features of the PERSON photo (the LAST attached image) EXACTLY — do not reinterpret, age, slim or beautify, and never take a face from an outfit photo. The RIGHT-TOP frontal and RIGHT-BOTTOM 90° profile neck-up crops are equal identity anchors of the SAME head; the LEFT full-body cell carries that identical face.' }),
    } : {}, (opts && opts.makeup) ? {
      makeup: opts.makeup + ' Identical in all three cells.',
    } : {}, (opts && opts.hasFace === false) ? {
      identity_authority: 'No face photo exists for this character: create ONE new, natural, believable real person — ' + (opts.appearance || 'matching the story') + (opts.outfitRef ? ' — with a distinctive everyday face that is NOT the model from any outfit photo.' : ' — with a distinctive, natural everyday face; this sheet becomes the ONLY identity reference for every later frame.') + ' The RIGHT-TOP frontal and RIGHT-BOTTOM 90° profile neck-up crops are the identity anchors; the LEFT full-body cell carries that identical face.',
    } : {}, (opts && opts.hasFace === false && !opts.outfitRef) ? {
      reference_roles: 'No image is attached: build this person from the description alone.',
      wardrobe_rule: 'ONLY the LEFT full-body cell shows the complete locked outfit (top, bottom, footwear). BOTH RIGHT cells terminate at the base of the neck; at most a very narrow collar edge may appear.',
    } : {}));
  }

  function assetImages(a) {
    if (!a) return [];
    if (Array.isArray(a.images) && a.images.length) return a.images.filter(Boolean);
    return a.image ? [a.image] : [];
  }
  function locationPrompt(env) {
    const sheet = String((env && env.location_sheet_prompt) || '').trim();
    if (sheet) return sheet;
    const v = Array.isArray(env && env.location_views) ? env.location_views[0] : null;
    return String((v && v.prompt) || '').trim();
  }

  /** Mọi ảnh cần NẠP vào project (nhân vật, mọi góc bối cảnh, sản phẩm, ảnh bối cảnh riêng của shot). */
  function refUploads(manifest, queue) {
    const out = [];
    const assets = (manifest && manifest.assets) || {};
    (assets.characters || []).forEach((a, i) => {
      const img = assetImages(a)[0];
      if (img) out.push({ key: 'characters:' + (a.id || i), kind: 'characters', id: a.id || '', name: String(a.name || 'Character ' + (i + 1)).trim(), data: img });
    });
    (assets.environments || []).forEach((a, i) => {
      const imgs = assetImages(a);
      imgs.forEach((img, j) => out.push({
        key: 'environments:' + (a.id || i) + ':' + j, kind: 'environments', id: a.id || '',
        name: String(a.name || 'Location ' + (i + 1)).trim() + (imgs.length > 1 ? ' (góc ' + (j + 1) + ')' : ''), data: img,
      }));
    });
    // Sản phẩm: nạp MỌI góc ảnh (tối đa 4) — quay "chỉ sản phẩm" lấy hình dáng từ đủ các góc.
    (assets.products || []).forEach((a, i) => {
      const imgs = assetImages(a).slice(0, 4);
      const base = String(a.name || 'Product ' + (i + 1)).trim();
      imgs.forEach((img, j) => out.push({
        key: 'products:' + (a.id || i) + (j ? ':' + j : ''), kind: 'products', id: a.id || '',
        name: base + (imgs.length > 1 ? ' (góc ' + (j + 1) + ')' : ''), data: img,
      }));
    });
    (queue || []).forEach((q) => {
      if (q && q.boardLocationImage) out.push({ key: 'shotloc:' + q.shotId, kind: 'environments', id: '', name: 'SHOT ' + pad(q.index) + ' location', data: q.boardLocationImage });
    });
    return out;
  }

  const VIDEO_MODEL_NAMES = { 'omni-flash': 'Omni 1.1 Flash', 'veo31-lite': 'Veo 3.1 Lite', 'veo31-fast': 'Veo 3.1 Fast', 'veo31-quality': 'Veo 3.1 Quality' };
  function clampDuration(d) {
    const n = Number(d) || 8;
    return [4, 6, 8, 10].reduce((best, x) => (x <= Math.max(4, n) ? x : best), 4);
  }

  /**
   * Kế hoạch dự án. `plans` = NanoPipeline.buildQueuePlan(queue).plans (để dùng
   * đúng prompt ảnh/video mà pipeline cũ gửi Flow).
   */
  function buildContext(manifest, queue, plans, opts) {
    opts = opts || {};
    const proj = (manifest && manifest.project) || {};
    const assets = (manifest && manifest.assets) || {};
    const aspect = /9:16/.test(proj.aspect_ratio || '') ? '9:16' : (/1:1/.test(proj.aspect_ratio || '') ? '1:1' : (proj.aspect_ratio ? '16:9' : (opts.aspect || '9:16')));
    const thumbAspect = proj.thumbnail_aspect_ratio === '16:9' ? '16:9' : '9:16';
    // Keyframe = khung mở đầu video → cùng khung với video (1:1 dựng ngang 16:9).
    const keyframeAspect = proj.keyframe_aspect_ratio === '9:16' || proj.keyframe_aspect_ratio === '16:9'
      ? proj.keyframe_aspect_ratio
      : (aspect === '1:1' ? '16:9' : aspect);
    const sceneHint = String((plans && plans[0] && plans[0].imageStep && plans[0].imageStep.prompt) || '').slice(0, 300);
    const charById = {};
    (assets.characters || []).forEach((a, i) => { charById[a.id || i] = { asset: a, photoKey: assetImages(a).length ? 'characters:' + (a.id || i) : '' }; });
    // Trang phục gắn link/ảnh (product asset loại outfit) → ảnh của nó tham chiếu khi tạo sheet.
    const outfitKeysFor = (asset) => {
      const pid = asset && asset.outfit_product_id;
      if (!pid) return [];
      const all = assets.products || [];
      const idx = all.findIndex((p) => p && p.id === pid);
      if (idx < 0) return [];
      return assetImages(all[idx]).slice(0, 2).map((_, j) => 'products:' + (all[idx].id || idx) + (j ? ':' + j : ''));
    };

    const sheets = [];
    const sheetByCombo = {};
    const sheetFor = (asset, outfit) => {
      const ent = charById[asset.id] || null;
      // Nhân vật không ảnh mặt nhưng mặc đồ đang bán vẫn có sheet "thử đồ".
      // Bé cưng / gia đình không ảnh: sheet dựng TỪ MÔ TẢ, khóa mặt cho mọi keyframe.
      const fromText = !!(ent && ent.asset.sheet_from_text === true && String(ent.asset.appearance || '').trim());
      if (!ent || (!ent.photoKey && !outfitKeysFor(ent.asset).length && !fromText)) return '';
      const combo = lc(asset.name) + '::' + lc(outfit);
      if (sheetByCombo[combo]) return sheetByCombo[combo];
      const key = 'SHEET ' + pad(sheets.length + 1);
      const name = String(asset.name || '').trim();
      const outfitKeys = outfitKeysFor(ent.asset);
      sheets.push({ key, name, outfit, photoKey: ent.photoKey, outfitKeys, prompt: key + ' – ' + name + ' ' + sheetPrompt(name, outfit, sceneHint, { outfitRef: outfitKeys.length > 0, hasFace: !!ent.photoKey, appearance: String(ent.asset.appearance || ''), makeup: String(ent.asset.makeup || '') }) });
      sheetByCombo[combo] = key;
      return key;
    };
    const locs = [];
    const locByEnv = {};
    const locFor = (env) => {
      const id = env.id || env.name;
      if (locByEnv[id] !== undefined) return locByEnv[id];
      const p = locationPrompt(env);
      if (!p || assetImages(env).length) { locByEnv[id] = ''; return ''; }
      const key = 'LOCATION ' + pad(locs.length + 1);
      locs.push({ key, name: String(env.name || id).trim(), prompt: key + ' – ' + String(env.name || id).trim() + ' ' + p });
      locByEnv[id] = key;
      return key;
    };
    const envPhotoKeys = (env) => {
      const all = assets.environments || [];
      const i = all.indexOf(env);
      const idx = i >= 0 ? i : all.findIndex((a) => a && env && a.id === env.id);
      return assetImages(idx >= 0 ? all[idx] : env).map((_, j) => 'environments:' + ((idx >= 0 && all[idx].id) || env.id || idx) + ':' + j);
    };

    // Trang phục hiện hành theo tên, đổi theo wardrobe_change của từng shot (từ shot đó trở đi).
    const outfit = {};
    (assets.characters || []).forEach((a) => { outfit[lc(a.name)] = String(a.wardrobe || '').trim(); });
    const sortedQueue = (queue || []).slice().sort((a, b) => (a.index || 0) - (b.index || 0));
    // Ưu tiên tạo sheet trang phục ĐẦU TIÊN của mọi nhân vật trước (như pipeline cũ).
    (assets.characters || []).forEach((a) => { if (charById[a.id] && (charById[a.id].photoKey || outfitKeysFor(a).length || (a.sheet_from_text === true && String(a.appearance || '').trim()))) sheetFor(a, outfit[lc(a.name)]); });

    const productKeys = [];
    // Ảnh đồ thời trang có thể có người mẫu → chỉ dùng cho sheet "thử đồ", không đính thẳng vào bìa.
    const garmentsOnlyKeys = [];
    const productAngles = {};   // 'products:<id>' → mọi góc ảnh đã nạp của sản phẩm đó
    (assets.products || []).forEach((a, i) => {
      const imgs = assetImages(a).slice(0, 4);
      if (!imgs.length) return;
      const k = 'products:' + (a.id || i);
      productKeys.push(k);
      // Bìa chỉ dùng sản phẩm manifest đánh dấu thumbnail_hero (video bán hàng); truyện thì không.
      if (a.garments_only || (typeof a.thumbnail_hero === 'boolean' && !a.thumbnail_hero)) garmentsOnlyKeys.push(k);
      productAngles[k] = imgs.map((_, j) => k + (j ? ':' + j : ''));
    });
    // Quay không có người (app storyboard: production_profile.product_shoot), hoặc dự án
    // không có nhân vật nào → sản phẩm là chủ thể: mỗi khung hình kèm nhiều góc sản phẩm.
    const shootPresence = String(((proj.production_profile || {}).product_shoot || {}).presence || '');
    const peopleFree = shootPresence === 'product_only' || shootPresence === 'hands_only'
      || (!shootPresence && !(assets.characters || []).length);

    const shots = sortedQueue.map((q) => {
      if (q.wardrobeChange && typeof q.wardrobeChange === 'object') {
        Object.keys(q.wardrobeChange).forEach((nm) => { const v = String(q.wardrobeChange[nm] || '').trim(); if (v) outfit[lc(nm)] = v; });
      }
      const p = (plans || []).find((x) => (x.shotId && x.shotId === q.shotId) || x.index === q.index) || {};
      const ir = q.imageRefs || {};
      const charKeys = [];
      (ir.characters || []).forEach((a) => {
        const k = sheetFor(a, outfit[lc(a.name)]);
        if (k) charKeys.push(k);
      });
      const envKeys = [];
      if (q.boardLocationImage) envKeys.push('shotloc:' + q.shotId);
      else (ir.environments || []).forEach((e) => {
        const photos = envPhotoKeys(e);
        if (photos.length) photos.slice(0, 2).forEach((k) => envKeys.push(k));
        else { const lk = locFor(e); if (lk) envKeys.push(lk); }
      });
      const prodKeys = [];
      (ir.products || []).forEach((a) => {
        const all = assets.products || [];
        const i = all.findIndex((x) => x && a && x.id === a.id);
        const k = 'products:' + (a.id || i);
        if (productKeys.includes(k)) (peopleFree ? productAngles[k].slice(0, 3) : [k]).forEach((x) => prodKeys.push(x));
      });
      const key = 'SHOT ' + pad(q.index);
      const kfBody = String((p.videoKeyframeStep && p.videoKeyframeStep.prompt) || (p.imageStep && p.imageStep.prompt) || q.videoKeyframePrompt || q.storyboardPrompt || q.name || '').trim();
      const vBody = String((p.videoStep && p.videoStep.prompt) || q.videoPrompt || '').trim();
      return {
        key, index: q.index, shotId: q.shotId, name: q.name,
        refKeys: [...prodKeys, ...charKeys, ...envKeys],
        charKeys, envKeys, prodKeys,
        keyframePrompt: key + ' – ' + kfBody,
        videoPrompt: key + ' – ' + vBody,
        duration: clampDuration(q.durationSeconds || opts.duration),
      };
    });

    const thumbBody = String(proj.thumbnail_prompt || '').trim();
    const thumb = thumbBody ? {
      key: 'THUMBNAIL',
      prompt: 'THUMBNAIL – ' + thumbBody,
      refKeys: peopleFree
        ? (productKeys.length ? productAngles[productKeys[0]].slice(0, 3) : [])
        : [...productKeys.filter((k) => !garmentsOnlyKeys.includes(k)).slice(0, 1), ...sheets.filter((s, i, arr) => arr.findIndex((x) => lc(x.name) === lc(s.name)) === i).map((s) => s.key)].slice(0, 4),
    } : null;

    return {
      title: String(proj.title || '').trim(), aspect, keyframeAspect, thumbAspect, sheets, locs, shots, thumb,
      videoModel: VIDEO_MODEL_NAMES[opts.videoModel] || '',
      videoMode: opts.videoMode === 'first' ? 'first' : 'refs',
      peopleFree,
    };
  }

  /** key → mediaId: kết quả Agent (state.media) trước, rồi ảnh đã nạp (refs). Sheet hỏng → ảnh gốc. */
  function resolveIds(ctx, keys, state) {
    const media = (state && state.media) || {};
    const refs = (state && state.refs) || {};
    const out = [];
    (keys || []).forEach((k) => {
      let id = media[k] || refs[k] || '';
      if (!id && /^SHEET /.test(k)) { const s = ctx.sheets.find((x) => x.key === k); id = s ? (refs[s.photoKey] || '') : ''; }
      if (id && !out.includes(id)) out.push(id);
    });
    return out;
  }

  const VERBATIM = 'Copy each PROMPT exactly as written, character for character, into the prompt of that generation — do NOT shorten, summarize, rewrite, translate or merge prompts, and keep the title at the start. Use exactly the aspect ratio and reference media ids listed for each item.';
  // Khi Flow từ chối 1 mục, Agent hay tự viết lại prompt thành vài câu ngắn rồi tạo
  // lại → mất cả cấu trúc (camera, thoại, khóa nhân vật). Cấm hẳn: báo lỗi, không tự sửa.
  const NO_REWRITE = 'A PROMPT that is a JSON object is pasted WHOLE — from its title through the final closing brace — never turned into prose, never reduced to its action text, never trimmed. If a generation is refused or fails, do NOT rewrite, soften, shorten or re-word its prompt and do NOT retry it with your own wording: skip that item and tell me its title and the exact error message.';
  const NO_QUESTIONS = 'Do NOT ask me any questions and do not suggest alternatives — just generate.';
  const ALL_AT_ONCE = 'Generate ALL of them in this one turn (they are independent of each other) — do not stop after the first ones and do not wait for me between items.';

  /** "9:16" → "9:16 (portrait / vertical)" — the agent must not guess the orientation. */
  function aspectLabel(a) {
    return a === '9:16' ? '9:16 (portrait / vertical)' : a === '1:1' ? '1:1 (square)' : '16:9 (landscape / horizontal)';
  }

  function block(title, lines, prompt) {
    return ['=== ' + title + ' ===', ...lines, 'PROMPT:', prompt, ''].join('\n');
  }

  /** Tin nhắn 1: sheet nhân vật + ảnh bối cảnh chuẩn + thumbnail — tạo cùng lúc. */
  function prepMessage(ctx, keys, state, head) {
    const parts = [];
    parts.push((head || 'MESSAGE 1 — character sheets, location plates and thumbnail') + '. ' + NO_QUESTIONS);
    parts.push('Generate exactly ' + keys.length + ' image(s) with Nano Banana, one per block below, nothing else. Character sheets and location plates are ' + aspectLabel('16:9') + ' reference images (the video itself is ' + aspectLabel(ctx.keyframeAspect || ctx.aspect) + '). ' + ALL_AT_ONCE + ' ' + VERBATIM + ' ' + NO_REWRITE);
    parts.push('');
    keys.forEach((k) => {
      const s = ctx.sheets.find((x) => x.key === k);
      if (s) {
        // Ảnh đồ đặt TRƯỚC, ảnh mặt đặt SAU (khớp reference_roles của sheet).
        const ids = resolveIds(ctx, [...(s.outfitKeys || []), s.photoKey], state);
        parts.push(block(s.key + ' – character sheet: ' + s.name, ['Aspect ratio: ' + aspectLabel('16:9'), 'Reference image media id(s): ' + (ids.join(', ') || 'none')], s.prompt));
        return;
      }
      const l = ctx.locs.find((x) => x.key === k);
      if (l) { parts.push(block(l.key + ' – location plate: ' + l.name, ['Aspect ratio: ' + aspectLabel('16:9'), 'Reference image media id(s): none (no people in this image)'], l.prompt)); return; }
      if (k === 'THUMBNAIL' && ctx.thumb) {
        // Sheet chưa có ở tin 1 → resolveIds tự lùi về ảnh nhân vật đã nạp (cùng khuôn mặt).
        const ids = resolveIds(ctx, ctx.thumb.refKeys, state);
        parts.push(block('THUMBNAIL', ['Aspect ratio: ' + aspectLabel(ctx.thumbAspect), 'Reference image media id(s): ' + (ids.join(', ') || 'none')], ctx.thumb.prompt));
      }
    });
    parts.push('When finished, list the titles you produced.');
    return parts.join('\n');
  }

  /** Tin nhắn 2: keyframe mọi shot (ref = mã sheet + bối cảnh vừa tạo ở tin 1). */
  function framesMessage(ctx, keys, state, head) {
    const parts = [];
    parts.push((head || 'MESSAGE 2 — shot keyframes') + '. ' + NO_QUESTIONS);
    parts.push('Generate exactly ' + keys.length + ' image(s) with Nano Banana, one per block below, nothing else. Each keyframe is ONE single full-frame still (the first frame of a video) in ' + aspectLabel(ctx.keyframeAspect || ctx.aspect) + ' — the same frame as the videos — no grid, collage, split screen or text. ' + ALL_AT_ONCE + ' ' + VERBATIM + ' ' + NO_REWRITE);
    parts.push('');
    keys.forEach((k) => {
      if (k === 'THUMBNAIL' && ctx.thumb) {
        const ids = resolveIds(ctx, ctx.thumb.refKeys, state);
        parts.push(block('THUMBNAIL', ['Aspect ratio: ' + aspectLabel(ctx.thumbAspect), 'Reference image media id(s): ' + (ids.join(', ') || 'none')], ctx.thumb.prompt));
        return;
      }
      const s = ctx.shots.find((x) => x.key === k);
      if (!s) return;
      const ids = resolveIds(ctx, s.refKeys, state);
      parts.push(block(s.key + ' – keyframe', ['Aspect ratio: ' + aspectLabel(ctx.keyframeAspect || ctx.aspect), 'Reference image media id(s): ' + (ids.join(', ') || 'none')], s.keyframePrompt));
    });
    parts.push('When finished, list the titles you produced.');
    return parts.join('\n');
  }

  /**
   * Ảnh tham chiếu cho video của 1 shot (chế độ "refs"): keyframe trước, rồi sheet nhân
   * vật, ảnh bối cảnh, sản phẩm — tối đa 3 (giới hạn ảnh tham chiếu của video Flow).
   */
  function videoRefIds(ctx, shot, state) {
    const media = (state && state.media) || {};
    const out = [];
    const add = (id) => { if (id && !out.includes(id) && out.length < 3) out.push(id); };
    add(media[shot.key] || '');
    if (ctx.peopleFree) {
      // Không có người: keyframe + các góc sản phẩm giữ đúng hình dáng/nhãn, rồi tới bối cảnh.
      resolveIds(ctx, shot.prodKeys || [], state).forEach(add);
      resolveIds(ctx, shot.envKeys || [], state).slice(0, 1).forEach(add);
      return out;
    }
    resolveIds(ctx, shot.charKeys || [], state).forEach(add);
    resolveIds(ctx, shot.envKeys || [], state).slice(0, 1).forEach(add);
    resolveIds(ctx, shot.prodKeys || [], state).forEach(add);
    return out;
  }

  /** Tin nhắn 3: video mọi shot. */
  function videosMessage(ctx, keys, state, head) {
    const refsMode = ctx.videoMode !== 'first';
    const parts = [];
    parts.push((head || 'MESSAGE 3 — shot videos') + '. ' + NO_QUESTIONS);
    parts.push('I approve the credit cost of every video in this message in advance — generate them all without asking for permission (if you must ask, ask only once for all of them).');
    const model = ctx.videoModel ? ', with the ' + ctx.videoModel + ' video model (if it is unavailable, use your default video model)' : '';
    parts.push(refsMode
      ? 'Generate exactly ' + keys.length + ' video(s), one per block below, each as a video WITH REFERENCE IMAGES: pass ALL the reference image media ids listed for that video. The first id is that shot\'s keyframe = its OPENING FRAME: the video must start from exactly that picture — same ' + (ctx.peopleFree ? 'product position, light and set' : 'people in the same places and poses (sitting/standing, facing), same framing, room, light and wardrobe') + ' — and play the prompt\'s action from there; never re-stage it or move to another room. ' + (ctx.peopleFree ? 'The others are the product photos (exact shape, colour, label and logo) and the set plate' : 'The others are the character sheet(s) and location plate that lock identity and place') + '. Use each block\'s own prompt with its own SHOT number — never mix prompts between shots' + model + ', no on-screen text or subtitles. ' + ALL_AT_ONCE + ' ' + VERBATIM + ' ' + NO_REWRITE
      : 'Generate exactly ' + keys.length + ' video(s), one per block below. For each, use the image with the given media id as the FIRST FRAME (start image)' + model + ', no on-screen text or subtitles. ' + ALL_AT_ONCE + ' ' + VERBATIM + ' ' + NO_REWRITE);
    parts.push('');
    const vAspect = aspectLabel(ctx.aspect === '1:1' ? '16:9' : ctx.aspect);
    parts.push('Every video in this message is ' + vAspect + ', the same frame as its keyframe.');
    keys.forEach((k) => {
      const s = ctx.shots.find((x) => x.key === k);
      if (!s) return;
      if (refsMode) {
        const ids = videoRefIds(ctx, s, state);
        parts.push(block(s.key + ' – video', ['Reference image media id(s): ' + (ids.join(', ') || 'none — generate from the prompt'), 'Aspect ratio: ' + vAspect, 'Duration: ' + s.duration + ' seconds'], s.videoPrompt));
        return;
      }
      const start = ((state && state.media) || {})[s.key] || '';
      parts.push(block(s.key + ' – video', ['First frame (start image) media id: ' + (start || 'none — generate from the prompt'), 'Aspect ratio: ' + vAspect, 'Duration: ' + s.duration + ' seconds'], s.videoPrompt));
    });
    parts.push('When finished, list the titles you produced.');
    return parts.join('\n');
  }

  // Số ký tự prompt mà Agent của Flow chép NGUYÊN VĂN được trong MỘT lượt trả lời.
  // Nhật ký 23/10/2026: tin 1 (~19k ký tự, 6 mục) xong trọn; tin keyframe 5 shot
  // (~198k, mỗi shot ~40k) chỉ tạo SHOT 01 rồi dừng lượt. Nên mỗi tin chỉ gom tới
  // ngân sách này; một prompt dài hơn ngân sách vẫn đi nguyên văn, một mục / tin.
  const AGENT_TURN_CHARS = 30000;

  function chunk(keys, sizeOf, maxCount, maxChars) {
    const out = [];
    let cur = [], size = 0;
    keys.forEach((k) => {
      const n = sizeOf(k);
      if (cur.length && (cur.length >= maxCount || size + n > maxChars)) { out.push(cur); cur = []; size = 0; }
      cur.push(k); size += n;
    });
    if (cur.length) out.push(cur);
    return out;
  }

  /**
   * Danh sách tin nhắn còn phải gửi (bỏ qua những gì đã có trong state.media).
   * Thường là 3 tin nhắn (1 sheet+bối cảnh+thumbnail · 2 keyframe · 3 video). Một bước
   * được chia thêm khi tổng prompt vượt sức Agent một lượt (turnChars, mặc định
   * AGENT_TURN_CHARS), khi đặt maxCount (số mục / tin) hoặc khi khung chat cắt chữ (maxChars).
   */
  function stages(ctx, state, opts) {
    opts = opts || {};
    const maxCount = opts.maxCount > 0 ? opts.maxCount : Infinity;
    const turnChars = opts.turnChars > 0 ? opts.turnChars : AGENT_TURN_CHARS;
    const maxChars = Math.min(opts.maxChars > 0 ? Math.max(4000, opts.maxChars) : Infinity, turnChars);
    const media = (state && state.media) || {};
    const videos = (state && state.videos) || {};
    const out = [];
    const promptOf = (k) => {
      const s = ctx.sheets.find((x) => x.key === k) || ctx.locs.find((x) => x.key === k);
      if (s) return s.prompt.length;
      if (k === 'THUMBNAIL') return ctx.thumb ? ctx.thumb.prompt.length : 0;
      const sh = ctx.shots.find((x) => x.key === k);
      return sh ? sh.keyframePrompt.length : 0;
    };
    const prep = [...ctx.sheets.map((s) => s.key), ...ctx.locs.map((l) => l.key), ...(ctx.thumb ? ['THUMBNAIL'] : [])].filter((k) => !media[k]);
    chunk(prep, promptOf, maxCount, maxChars).forEach((keys) => out.push({ type: 'prep', keys }));
    const frames = ctx.shots.map((s) => s.key).filter((k) => !media[k]);
    chunk(frames, promptOf, maxCount, maxChars).forEach((keys) => out.push({ type: 'frames', keys }));
    const vids = ctx.shots.map((s) => s.key).filter((k) => !videos[k]);
    chunk(vids, (k) => (ctx.shots.find((x) => x.key === k) || { videoPrompt: '' }).videoPrompt.length, maxCount, maxChars)
      .forEach((keys) => out.push({ type: 'videos', keys }));
    return out;
  }

  function messageFor(ctx, stage, state, head) {
    if (stage.type === 'prep') return prepMessage(ctx, stage.keys, state, head);
    if (stage.type === 'frames') return framesMessage(ctx, stage.keys, state, head);
    return videosMessage(ctx, stage.keys, state, head);
  }

  /** Nhận diện 1 kết quả Agent thuộc mục nào (theo tiêu đề đầu prompt, rồi theo nội dung). */
  function matchKey(ctx, rec) {
    const prompt = String((rec && rec.prompt) || '');
    const kind = rec && rec.mediaKind;
    // Tiêu đề nằm ĐẦU prompt; chỉ xét 40 ký tự đầu để chữ "shot 2" trong thân prompt không gây nhầm.
    const head = prompt.replace(/^[\s"'*]+/, '').slice(0, 40);
    let m;
    if (kind === 'video') {
      m = /\bSHOT\s*0*(\d{1,3})\b/i.exec(head);
      if (m) return 'SHOT ' + pad(m[1]);
    } else {
      if ((m = /\bSHEET\s*0*(\d{1,3})\b/i.exec(head))) return 'SHEET ' + pad(m[1]);
      if ((m = /\bLOCATION\s*0*(\d{1,3})\b/i.exec(head))) return 'LOCATION ' + pad(m[1]);
      if (/\bTHUMBNAIL\b/i.test(head)) return 'THUMBNAIL';
      if ((m = /\bSHOT\s*0*(\d{1,3})\b/i.exec(head))) return 'SHOT ' + pad(m[1]);
    }
    // Dự phòng: Agent bỏ tiêu đề → so các đoạn RIÊNG của từng prompt gốc (prompt manifest
    // có rất nhiều đoạn chung giữa các shot, nên chỉ tính đoạn không xuất hiện ở prompt khác).
    const pool = kind === 'video'
      ? ctx.shots.map((s) => [s.key, s.videoPrompt])
      : [...ctx.sheets.map((s) => [s.key, s.prompt]), ...ctx.locs.map((l) => [l.key, l.prompt]),
        ...(ctx.thumb ? [['THUMBNAIL', ctx.thumb.prompt]] : []), ...ctx.shots.map((s) => [s.key, s.keyframePrompt])];
    const probes = uniqueProbes(pool);
    let best = '', bestScore = 0;
    pool.forEach(([key]) => {
      const score = (probes[key] || []).filter((pr) => prompt.includes(pr)).length;
      if (score > bestScore) { best = key; bestScore = score; }
    });
    if (best) return best;
    return '';
  }

  function uniqueProbes(pool) {
    const out = {};
    pool.forEach(([key, p], i) => {
      const body = String(p).replace(/^[A-Z]+\s*\d*\s*–\s*/, '');
      const others = pool.filter((_, j) => j !== i).map(([, q]) => String(q));
      const list = [];
      for (let off = 0; off + 60 <= body.length && list.length < 6; off += 97) {
        const pr = body.slice(off, off + 60);
        if (!others.some((q) => q.includes(pr))) list.push(pr);
      }
      out[key] = list;
    });
    return out;
  }

  /** Tỉ lệ prompt gốc được giữ (1 = nguyên văn). */
  function fidelity(expected, got) {
    const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
    const e = norm(expected), g = norm(got);
    if (!e) return 1;
    if (g.includes(e) || g === e) return 1;
    return Math.min(1, g.length / e.length);
  }

  return { AGENT_TURN_CHARS, sheetPrompt, refUploads, buildContext, resolveIds, videoRefIds, stages, messageFor, matchKey, fidelity, clampDuration };
});
