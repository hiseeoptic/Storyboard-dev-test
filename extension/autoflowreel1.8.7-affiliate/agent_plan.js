// ============================================================
// AgentPlan — dựng LẠI ĐẦY ĐỦ quy trình Nano Flow cũ cho chế độ Agent của Flow mới.
//
// Flow mới chặn lệnh tạo do extension gửi, nên mọi ảnh/video phải do Agent tạo khi
// người dùng gửi tin nhắn. Module này biến manifest thành các TIN NHẮN theo đúng thứ
// tự pipeline cũ (genNanoImages / genNanoVideos):
//   A. SHEET trang phục nhân vật (16:9, ref = ảnh nhân vật đã nạp; đổi đồ → sheet mới)
//      + ảnh BỐI CẢNH chuẩn (16:9, khi bối cảnh không có ảnh nạp)
//   B. THUMBNAIL (ref = sản phẩm + sheet) + KEYFRAME từng shot (ref = sheet + bối
//      cảnh + sản phẩm — đúng mã ảnh vừa tạo ở bước A)
//   C. VIDEO từng shot (khung đầu = đúng mã keyframe của shot)
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
  function sheetPrompt(name, outfit, sceneHint) {
    return JSON.stringify({
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
    });
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
    (assets.products || []).forEach((a, i) => {
      const img = assetImages(a)[0];
      if (img) out.push({ key: 'products:' + (a.id || i), kind: 'products', id: a.id || '', name: String(a.name || 'Product ' + (i + 1)).trim(), data: img });
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
    const sceneHint = String((plans && plans[0] && plans[0].imageStep && plans[0].imageStep.prompt) || '').slice(0, 300);
    const charById = {};
    (assets.characters || []).forEach((a, i) => { charById[a.id || i] = { asset: a, photoKey: assetImages(a).length ? 'characters:' + (a.id || i) : '' }; });

    const sheets = [];
    const sheetByCombo = {};
    const sheetFor = (asset, outfit) => {
      const ent = charById[asset.id] || null;
      if (!ent || !ent.photoKey) return '';
      const combo = lc(asset.name) + '::' + lc(outfit);
      if (sheetByCombo[combo]) return sheetByCombo[combo];
      const key = 'SHEET ' + pad(sheets.length + 1);
      const name = String(asset.name || '').trim();
      sheets.push({ key, name, outfit, photoKey: ent.photoKey, prompt: key + ' – ' + name + ' ' + sheetPrompt(name, outfit, sceneHint) });
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
    (assets.characters || []).forEach((a) => { if (charById[a.id] && charById[a.id].photoKey) sheetFor(a, outfit[lc(a.name)]); });

    const productKeys = [];
    (assets.products || []).forEach((a, i) => { if (assetImages(a).length) productKeys.push('products:' + (a.id || i)); });

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
        if (productKeys.includes(k)) prodKeys.push(k);
      });
      const key = 'SHOT ' + pad(q.index);
      const kfBody = String((p.videoKeyframeStep && p.videoKeyframeStep.prompt) || (p.imageStep && p.imageStep.prompt) || q.videoKeyframePrompt || q.storyboardPrompt || q.name || '').trim();
      const vBody = String((p.videoStep && p.videoStep.prompt) || q.videoPrompt || '').trim();
      return {
        key, index: q.index, shotId: q.shotId, name: q.name,
        refKeys: [...prodKeys, ...charKeys, ...envKeys],
        keyframePrompt: key + ' – ' + kfBody,
        videoPrompt: key + ' – ' + vBody,
        duration: clampDuration(q.durationSeconds || opts.duration),
      };
    });

    const thumbBody = String(proj.thumbnail_prompt || '').trim();
    const thumb = thumbBody ? {
      key: 'THUMBNAIL',
      prompt: 'THUMBNAIL – ' + thumbBody,
      refKeys: [...productKeys.slice(0, 1), ...sheets.filter((s, i, arr) => arr.findIndex((x) => lc(x.name) === lc(s.name)) === i).map((s) => s.key)].slice(0, 4),
    } : null;

    return {
      title: String(proj.title || '').trim(), aspect, thumbAspect, sheets, locs, shots, thumb,
      videoModel: VIDEO_MODEL_NAMES[opts.videoModel] || '',
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
  const NO_QUESTIONS = 'Do NOT ask me any questions and do not suggest alternatives — just generate.';

  function block(title, lines, prompt) {
    return ['=== ' + title + ' ===', ...lines, 'PROMPT:', prompt, ''].join('\n');
  }

  /** Tin nhắn bước A: sheet nhân vật + ảnh bối cảnh chuẩn. */
  function prepMessage(ctx, keys, state, head) {
    const parts = [];
    parts.push((head || 'STEP A — reference sheets') + '. ' + NO_QUESTIONS);
    parts.push('Generate exactly ' + keys.length + ' image(s) with Nano Banana, one per block below, nothing else. ' + VERBATIM);
    parts.push('');
    keys.forEach((k) => {
      const s = ctx.sheets.find((x) => x.key === k);
      if (s) {
        const ids = resolveIds(ctx, [s.photoKey], state);
        parts.push(block(s.key + ' – character sheet: ' + s.name, ['Aspect ratio: 16:9 (landscape)', 'Reference image media id(s): ' + (ids.join(', ') || 'none')], s.prompt));
        return;
      }
      const l = ctx.locs.find((x) => x.key === k);
      if (l) parts.push(block(l.key + ' – location plate: ' + l.name, ['Aspect ratio: 16:9 (landscape)', 'Reference image media id(s): none (no people in this image)'], l.prompt));
    });
    parts.push('When finished, list the titles you produced.');
    return parts.join('\n');
  }

  /** Tin nhắn bước B: thumbnail (tuỳ) + keyframe các shot. */
  function framesMessage(ctx, keys, state, head) {
    const parts = [];
    parts.push((head || 'STEP B — thumbnail and keyframes') + '. ' + NO_QUESTIONS);
    parts.push('Generate exactly ' + keys.length + ' image(s) with Nano Banana, one per block below, nothing else. Each keyframe is ONE single full-frame still (the first frame of a video) — no grid, collage, split screen or text. ' + VERBATIM);
    parts.push('');
    keys.forEach((k) => {
      if (k === 'THUMBNAIL' && ctx.thumb) {
        const ids = resolveIds(ctx, ctx.thumb.refKeys, state);
        parts.push(block('THUMBNAIL', ['Aspect ratio: ' + ctx.thumbAspect, 'Reference image media id(s): ' + (ids.join(', ') || 'none')], ctx.thumb.prompt));
        return;
      }
      const s = ctx.shots.find((x) => x.key === k);
      if (!s) return;
      const ids = resolveIds(ctx, s.refKeys, state);
      parts.push(block(s.key + ' – keyframe', ['Aspect ratio: ' + ctx.aspect, 'Reference image media id(s): ' + (ids.join(', ') || 'none')], s.keyframePrompt));
    });
    parts.push('When finished, list the titles you produced.');
    return parts.join('\n');
  }

  /** Tin nhắn bước C: video từ đúng keyframe. */
  function videosMessage(ctx, keys, state, head) {
    const parts = [];
    parts.push((head || 'STEP C — videos') + '. ' + NO_QUESTIONS);
    parts.push('I approve the credit cost of every video in this message in advance — generate them all without asking for permission (if you must ask, ask only once for all of them).');
    parts.push('Generate exactly ' + keys.length + ' video(s), one per block below. For each, use the image with the given media id as the FIRST FRAME (start image)' + (ctx.videoModel ? ', with the ' + ctx.videoModel + ' video model (if it is unavailable, use your default video model)' : '') + ', no on-screen text or subtitles. ' + VERBATIM);
    parts.push('');
    keys.forEach((k) => {
      const s = ctx.shots.find((x) => x.key === k);
      if (!s) return;
      const start = ((state && state.media) || {})[s.key] || '';
      parts.push(block(s.key + ' – video', ['First frame (start image) media id: ' + (start || 'none — generate from the prompt'), 'Aspect ratio: ' + (ctx.aspect === '1:1' ? '16:9' : ctx.aspect), 'Duration: ' + s.duration + ' seconds'], s.videoPrompt));
    });
    parts.push('When finished, list the titles you produced.');
    return parts.join('\n');
  }

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

  /** Danh sách tin nhắn còn phải gửi (bỏ qua những gì đã có trong state.media). */
  function stages(ctx, state, opts) {
    opts = opts || {};
    const maxCount = Math.max(1, opts.maxCount || 20);
    const maxChars = Math.max(4000, opts.maxChars || 30000);
    const media = (state && state.media) || {};
    const videos = (state && state.videos) || {};
    const out = [];
    const prep = [...ctx.sheets.map((s) => s.key), ...ctx.locs.map((l) => l.key)].filter((k) => !media[k]);
    const promptOf = (k) => {
      const s = ctx.sheets.find((x) => x.key === k) || ctx.locs.find((x) => x.key === k);
      if (s) return s.prompt.length;
      if (k === 'THUMBNAIL') return ctx.thumb ? ctx.thumb.prompt.length : 0;
      const sh = ctx.shots.find((x) => x.key === k);
      return sh ? sh.keyframePrompt.length : 0;
    };
    chunk(prep, promptOf, maxCount, maxChars).forEach((keys) => out.push({ type: 'prep', keys }));
    const frames = [...(ctx.thumb && !media.THUMBNAIL ? ['THUMBNAIL'] : []), ...ctx.shots.map((s) => s.key).filter((k) => !media[k])];
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

  return { sheetPrompt, refUploads, buildContext, resolveIds, stages, messageFor, matchKey, fidelity, clampDuration };
});
