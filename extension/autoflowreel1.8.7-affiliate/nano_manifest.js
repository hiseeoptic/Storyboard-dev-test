/*
 * nano_manifest.js — Nano Flow manifest parser / validator / queue builder.
 *
 * This is the EXTENSION side of the shared contract in
 * docs/nano-flow-pipeline/manifest.schema.json (identical schema in both repos).
 * It turns a manifest produced by Storyboard AI into a flat, render-ready
 * "shot queue" the side panel can display and (later, M3+) drive through Flow.
 *
 * Pure + dependency-free so it runs unchanged in the browser (side panel) and
 * under Node for tests. See docs/nano-flow-pipeline/DESIGN.md §5.1 (M2).
 *
 * Browser:  <script src="nano_manifest.js"></script>  →  window.NanoManifest
 * Node:     const NanoManifest = require('./nano_manifest.js');
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NanoManifest = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUPPORTED_VERSIONS = ['1.0'];

  /** Parse a manifest from a JSON string or a plain object. Throws on bad JSON. */
  function parse(input) {
    if (input && typeof input === 'object') return input;
    if (typeof input !== 'string') throw new Error('Manifest must be a JSON string or object');
    return JSON.parse(input);
  }

  /** Structural validation. Returns { ok, errors: string[] }.
   * Deliberately lenient about extra fields (forward-compat) but strict about
   * the fields the extension relies on to run a shot. */
  function validate(manifest) {
    const errors = [];
    const m = manifest || {};

    if (!m.manifest_version) errors.push('missing manifest_version');
    else if (!SUPPORTED_VERSIONS.includes(String(m.manifest_version)))
      errors.push('unsupported manifest_version: ' + m.manifest_version);

    if (!m.project || typeof m.project !== 'object') errors.push('missing project');
    else if (!m.project.title) errors.push('missing project.title');

    if (!Array.isArray(m.shots) || m.shots.length === 0) {
      errors.push('missing shots[]');
    } else {
      m.shots.forEach(function (s, i) {
        const at = 'shots[' + i + ']';
        if (!s || typeof s !== 'object') { errors.push(at + ' is not an object'); return; }
        if (!s.shot_id) errors.push(at + '.shot_id missing');
        if (!s.storyboard_prompt || !String(s.storyboard_prompt).trim())
          errors.push(at + '.storyboard_prompt empty');
        // video_prompt: chuỗi (bản cũ) HOẶC object JSON có cấu trúc (Veo clip,
        // bản Storyboard mới) — cả hai đều hợp lệ, chỉ rỗng mới lỗi.
        if (!s.video_prompt
            || (typeof s.video_prompt === 'string' && !s.video_prompt.trim())
            || (typeof s.video_prompt === 'object' && !Object.keys(s.video_prompt).length))
          errors.push(at + '.video_prompt empty');
      });
    }

    // Referenced asset ids must exist in the assets pool (catches typos early).
    const pool = assetIndex(m.assets);
    (Array.isArray(m.shots) ? m.shots : []).forEach(function (s, i) {
      ['image_refs', 'video_refs'].forEach(function (key) {
        const sel = s && s[key];
        if (!sel) return;
        ['characters', 'environments', 'products'].forEach(function (kind) {
          (sel[kind] || []).forEach(function (id) {
            if (!pool[kind] || !pool[kind][id])
              errors.push('shots[' + i + '].' + key + '.' + kind + ' -> unknown asset id "' + id + '"');
          });
        });
      });
    });

    return { ok: errors.length === 0, errors: errors };
  }

  /** Build { characters:{id:asset}, environments:{...}, products:{...} }. */
  function assetIndex(assets) {
    const a = assets || {};
    const idx = { characters: {}, environments: {}, products: {} };
    ['characters', 'environments', 'products'].forEach(function (kind) {
      (a[kind] || []).forEach(function (asset) {
        if (asset && asset.id) idx[kind][asset.id] = asset;
      });
    });
    return idx;
  }

  /** Resolve a ref selector's ids into concrete asset objects (keeps order). */
  function resolveRefs(selector, pool) {
    const sel = selector || {};
    const out = { characters: [], environments: [], products: [] };
    ['characters', 'environments', 'products'].forEach(function (kind) {
      out[kind] = (sel[kind] || [])
        .map(function (id) { return pool[kind] && pool[kind][id]; })
        .filter(Boolean);
    });
    return out;
  }

  /**
   * Flatten a manifest into an ordered, render-ready queue. Each item:
   * {
   *   shotId, index, name, durationSeconds, marketingRole,
   *   storyboardPrompt, videoPrompt, dialogue, voice, charactersInScene,
   *   imageRefs:  { characters:[asset], environments:[asset], products:[asset] },
   *   videoRefs:  { useGeneratedStoryboard, useCleanVideoKeyframe, characters:[asset], environments:[asset], products:[asset] },
   *   generated:  null,   // filled in M3/M4 with { mediaId, dataUrl }
   *   status:     'pending'
   * }
   */
  function toQueue(manifest) {
    const m = manifest || {};
    const pool = assetIndex(m.assets);
    const shots = Array.isArray(m.shots) ? m.shots.slice() : [];
    shots.sort(function (a, b) { return (a.index || 0) - (b.index || 0); });

    const queue = [];
    shots.forEach(function (s, i) {
      const vref = s.video_refs || {};
      const shotId = s.shot_id || ('SHOT_' + String(i + 1).padStart(3, '0'));
      const shotName = s.storyboard_name || s.shot_id || ('Shot ' + (i + 1));
      // Object (structured Veo clip) → JSON text cho ô prompt của Flow; chuỗi
      // giữ nguyên. KHÔNG String(object) — sẽ thành "[object Object]".
      const videoPrompt = (s.video_prompt && typeof s.video_prompt === 'object')
        ? JSON.stringify(s.video_prompt)
        : String(s.video_prompt || '').trim();
      const charactersInScene = Array.isArray(s.characters_in_scene) ? s.characters_in_scene : [];
      const videoRefs = Object.assign(
        {
          useGeneratedStoryboard: vref.use_generated_storyboard === true,
          useCleanVideoKeyframe: vref.use_clean_video_keyframe !== false,
        },
        resolveRefs(vref, pool)
      );

      // BOARD MODEL — luôn 1 ảnh board / shot 10s. Đã BỎ hẳn nhánh tách scenes[]
      // (bản cũ nổ mỗi shot thành nhiều ảnh frame → nghẽn/treo). Dù manifest có
      // mang scenes[] hay không, mỗi shot chỉ sinh ĐÚNG 1 board từ storyboard_prompt.
      queue.push({
        shotId: shotId,
        parentShotId: shotId,
        sceneNo: null,
        // Board model: 1 ảnh board bối cảnh / shot 10s — KHÔNG nối keyframe trước
        // (bỏ end/start frame chaining theo yêu cầu). Mỗi board độc lập.
        chainFromPrev: false,
        // Ảnh bối cảnh user nạp cho RIÊNG board này (nút nạp theo từng board). Có
        // thì đính làm ref khóa bối cảnh (ưu tiên), không có thì tạo board từ prompt.
        boardLocationImage: s.board_location_image || null,
        index: queue.length + 1,
        name: shotName,
        durationSeconds: s.duration_seconds || 10,
        marketingRole: s.marketing_role || null,
        storyboardPrompt: String(s.storyboard_prompt || '').trim(),
        // Clean SINGLE full-bleed frame dedicated to Veo. The multi-panel board
        // remains a review artifact and is never used as video conditioning.
        videoKeyframePrompt: String(s.video_keyframe_prompt || '').trim(),
        // Optional END keyframe (start_end_frame mode): when present, the shot
        // has a "transform" — Veo interpolates start→end. See DESIGN §6.2.
        endStoryboardPrompt: String(s.end_storyboard_prompt || '').trim(),
        videoPrompt: videoPrompt,
        // Đổi trang phục giữa truyện (ướt mưa, thay đồ…): { "Tên": "outfit mới" }.
        // Extension sẽ tạo lại ảnh toàn thân (wardrobe sheet) từ shot này trở đi.
        wardrobeChange: s.wardrobe_change || null,
        dialogue: s.dialogue || null,
        voice: s.voice || null,
        charactersInScene: charactersInScene,
        camera: null,
        action: null,
        continuityMode: s.continuity_mode || null,
        locationId: s.location_id || null,
        imageRefs: resolveRefs(s.image_refs, pool),
        videoRefs: videoRefs,
        generated: null,
        status: 'pending',
      });
    });
    return queue;
  }

  /** List every asset slot that still needs a real image attached (image=null).
   * The side panel uses this to prompt the user to upload before running. */
  function missingImages(manifest) {
    const m = manifest || {};
    const out = [];
    // Board model: bối cảnh do BOARD (storyboard_prompt) khóa + có nút nạp ảnh
    // bối cảnh theo từng board (tùy chọn) → KHÔNG coi environment là "thiếu ảnh".
    ['characters', 'products'].forEach(function (kind) {
      ((m.assets || {})[kind] || []).forEach(function (asset) {
        if (!asset || asset.image) return;
        out.push({ kind: kind, id: asset.id, name: asset.name, required: !!asset.required });
      });
    });
    return out;
  }

  /** One-call convenience: parse → validate → queue. Throws on invalid. */
  function load(input) {
    const manifest = parse(input);
    const v = validate(manifest);
    if (!v.ok) throw new Error('Invalid Nano Flow manifest:\n- ' + v.errors.join('\n- '));
    return { manifest: manifest, queue: toQueue(manifest), missingImages: missingImages(manifest) };
  }

  return {
    SUPPORTED_VERSIONS: SUPPORTED_VERSIONS,
    parse: parse,
    validate: validate,
    assetIndex: assetIndex,
    resolveRefs: resolveRefs,
    toQueue: toQueue,
    missingImages: missingImages,
    load: load,
  };
});
