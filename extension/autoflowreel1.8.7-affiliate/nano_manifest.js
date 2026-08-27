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

  /** Parse an optional JSON prompt carried by an environment asset. */
  function parsePromptObject(input) {
    if (input && typeof input === 'object') return input;
    if (typeof input !== 'string' || !input.trim()) return null;
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  /** Canonical spatial fields owned by an environment asset, when available. */
  function environmentAuthority(asset) {
    if (!asset || typeof asset !== 'object') return null;
    const sheet = parsePromptObject(asset.location_sheet_prompt)
      || parsePromptObject(asset.location_views && asset.location_views[0] && asset.location_views[0].prompt)
      || {};
    return {
      name: String(asset.name || sheet.location_name || '').trim(),
      setting: String(sheet.source_authority || sheet.setting || '').trim(),
      scenery: String(sheet.scenery || '').trim(),
      lighting: String(sheet.lighting || '').trim(),
    };
  }

  /**
   * Repair only legacy multi-setup camera prose. Valid pans, tracks, dollies,
   * pushes and holds survive unchanged; a single-keyframe workflow does not
   * imply a static camera.
   */
  function normalizeCameraMovement(camera) {
    const framing = String(camera && camera.framing || 'medium').toLowerCase();
    const angle = String(camera && camera.angle || 'eye level');
    const movement = String(camera && camera.movement || '').trim();
    const multiSetup = /\b(?:orbit|reverse angle|second (?:camera )?setup|cut to|switch(?:es|ing)? to|changes? (?:the )?shot scale)\b/i.test(movement)
      || /\bbegins? with[\s\S]*(?:before settling|settles? on|ending on)\b/i.test(movement)
      || /\bfront(?:al)?[\s\S]{0,120}\b(?:rear|behind)\b/i.test(movement);
    const axisLock = 'Keep one camera axis for the whole clip; no cut, orbit, reverse angle, shot-scale jump or second setup.';
    if (!movement || multiSetup) {
      return 'Hold one stable ' + framing + ' ' + angle
        + ' camera axis; a motivated pan, track, dolly, push or focus adjustment may follow the scripted action without crossing to another setup. '
        + axisLock;
    }
    if (/one camera axis|same camera axis|no (?:cut|cuts)/i.test(movement)) return movement;
    return movement + ' ' + axisLock;
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

    // Compatibility authority for manifests exported before the one-keyframe
    // fix. Spatial identity comes from the location asset when one exists, then
    // falls back to the first script-derived shot. Temporal fields (shot light,
    // sound and reverb) remain shot-local so an intentional day/night or sound
    // transition in an arbitrary script is never flattened.
    const locationAuthority = {};
    Object.keys(pool.environments || {}).forEach(function (id) {
      const authority = environmentAuthority(pool.environments[id]);
      if (authority) locationAuthority[id] = authority;
    });
    shots.forEach(function (s) {
      const clip = s && s.video_prompt && typeof s.video_prompt === 'object'
        ? s.video_prompt : null;
      if (!clip) return;
      const bg = clip.background_lock && typeof clip.background_lock === 'object'
        ? clip.background_lock : {};
      const loc = String(s.location_id || clip.location_id || bg.id || '').trim();
      if (!loc || locationAuthority[loc]) return;
      const setting = String(bg.setting || '').trim();
      locationAuthority[loc] = {
        name: setting.split(/[;,]/)[0].trim() || String(bg.name || loc),
        setting: setting,
        scenery: String(bg.scenery || '').trim(),
        lighting: String(bg.lighting || '').split(';')[0].trim(),
      };
    });

    const normalizedVideoPrompt = function (s) {
      if (!s.video_prompt || typeof s.video_prompt !== 'object') return s.video_prompt;
      const clip = JSON.parse(JSON.stringify(s.video_prompt));
      const bg = clip.background_lock && typeof clip.background_lock === 'object'
        ? clip.background_lock : {};
      const loc = String(s.location_id || clip.location_id || bg.id || '').trim();
      const authority = locationAuthority[loc];
      if (authority) {
        const tokens = clip.scene_bible_tokens && typeof clip.scene_bible_tokens === 'object'
          ? clip.scene_bible_tokens : {};
        const foley = clip.foley_and_ambience && typeof clip.foley_and_ambience === 'object'
          ? clip.foley_and_ambience : {};
        // Scene-bible/audio fields are already script-derived for THIS shot.
        // Prefer them over a location's baseline so intentional temporal change
        // remains possible while geometry and location identity stay locked.
        const shotLighting = String(tokens.lighting || authority.lighting || bg.lighting || '').trim();
        const shotSoundBed = String(tokens.audio_bed || foley.environment_sound_bed || '').trim();
        const shotReverb = String(tokens.reverb || foley.environment_reverb || '').trim();
        clip.background_lock = Object.assign({}, bg, {
          name: authority.name || bg.name,
          setting: authority.setting || bg.setting,
          scenery: authority.scenery || bg.scenery,
          lighting: shotLighting,
        });
        if (clip.scene_bible_tokens && typeof clip.scene_bible_tokens === 'object') {
          clip.scene_bible_tokens = Object.assign({}, clip.scene_bible_tokens, {
            backdrop: authority.scenery || clip.scene_bible_tokens.backdrop,
          });
        }
        if (clip.foley_and_ambience && typeof clip.foley_and_ambience === 'object') {
          clip.foley_and_ambience = Object.assign({}, clip.foley_and_ambience, {
            environment_sound_bed: shotSoundBed || clip.foley_and_ambience.environment_sound_bed,
            environment_reverb: shotReverb || clip.foley_and_ambience.environment_reverb,
            ambience: shotSoundBed ? [shotSoundBed] : clip.foley_and_ambience.ambience,
          });
        }
        if (clip.audio_transition && typeof clip.audio_transition === 'object') {
          clip.audio_transition = Object.assign({}, clip.audio_transition, {
            sound_bed: shotSoundBed || clip.audio_transition.sound_bed,
            reverb_profile: shotReverb || clip.audio_transition.reverb_profile,
          });
        }
      }
      if (clip.camera && typeof clip.camera === 'object') {
        clip.camera = Object.assign({}, clip.camera, {
          movement: normalizeCameraMovement(clip.camera),
        });
      }
      clip.board_usage = 'Use the attached single full-frame storyboard keyframe as the visual opening authority and animate forward in one continuous shot.';
      if (clip.output_rules && typeof clip.output_rules === 'object') {
        clip.output_rules = Object.assign({}, clip.output_rules, {
          board_is_reference_not_a_frame: 'The attached image is one single full-frame storyboard keyframe. Keep it as the opening visual authority; never create a grid, collage, split screen, numbered panel or second camera setup.',
        });
      }
      return clip;
    };

    const queue = [];
    shots.forEach(function (s, i) {
      const vref = s.video_refs || {};
      const shotId = s.shot_id || ('SHOT_' + String(i + 1).padStart(3, '0'));
      const shotName = s.storyboard_name || s.shot_id || ('Shot ' + (i + 1));
      // Object (structured Veo clip) → JSON text cho ô prompt của Flow; chuỗi
      // giữ nguyên. KHÔNG String(object) — sẽ thành "[object Object]".
      const normalizedClip = normalizedVideoPrompt(s);
      const videoPrompt = (normalizedClip && typeof normalizedClip === 'object')
        ? JSON.stringify(normalizedClip)
        : String(normalizedClip || '').trim();
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
        // Production is hard-locked to one independent keyframe per shot. Old
        // manifests may still carry chain_from_prev/start_end; normalize them at
        // import so they cannot reuse another shot's image or create a second
        // frame behind the hidden UI.
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
        frameMode: 'start',
        // Optional END keyframe (start_end_frame mode): when present, the shot
        // has a "transform" — Veo interpolates start→end. See DESIGN §6.2.
        endStoryboardPrompt: '',
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
