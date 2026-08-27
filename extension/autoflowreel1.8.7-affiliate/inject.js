// ============================================================
// AutoFlow Reel — NETWORK HOOK (chạy trong MAIN world của trang Flow)
// Mục tiêu: BẮT request API THẬT mà Flow gửi đi khi tạo video/ảnh, để extension
// HỌC giao thức rồi PHÁT LẠI với prompt của người dùng (giống TurboFlow) — KHÔNG
// cần thao tác DOM. Hook chỉ QUAN SÁT, luôn gọi lại hàm gốc, không chặn gì.
// ============================================================
(function () {
  if (window.__afNetHook) return;
  window.__afNetHook = true;

  const post = (d) => { try { window.postMessage(Object.assign({ source: 'AF_NET' }, d), '*'); } catch (e) {} };

  // Race any promise against a timeout so a HANGING step (reCAPTCHA that never
  // resolves, a stuck fetch) surfaces as a clear, fast error instead of freezing
  // the whole batch — which looked like "Gửi N shot rồi im 75s" with no reason.
  const withTimeout = (p, ms, label) => Promise.race([
    Promise.resolve(p),
    new Promise((_, rej) => setTimeout(() => rej(new Error((label || 'thao tác') + ' quá thời gian (' + Math.round(ms / 1000) + 's) — có thể Flow đổi giao thức, F5 trang Flow rồi thử lại')), ms)),
  ]);

  // fetch that ABORTS after ms so a stuck upload/generate call can't freeze the
  // whole batch (the silent 75s symptom). origFetch is the page's real fetch.
  async function fetchWithTimeout(url, opts, ms, label) {
    const ctrl = new AbortController();
    const t = setTimeout(() => { try { ctrl.abort(); } catch (e) {} }, ms || 90000);
    try {
      return await origFetch(url, Object.assign({}, opts || {}, { signal: ctrl.signal }));
    } catch (e) {
      throw new Error(/abort/i.test(String(e && e.message))
        ? ((label || 'request') + ' quá thời gian (' + Math.round((ms || 90000) / 1000) + 's) — mạng/Flow không phản hồi')
        : ((label || 'request') + ' lỗi: ' + ((e && e.message) || e)));
    } finally { clearTimeout(t); }
  }

  // URL backend của Flow / Google AI (chỉ quan tâm các host này để khỏi nhiễu).
  const interesting = (url) => {
    const u = (url || '').toLowerCase();
    return /aisandbox|googleapis|labs\.google|clients6\.google/.test(u);
  };
  // Phân loại request Flow đời mới (Omni Flash) — theo log thực tế:
  //  • generate: flowCreationAgent:streamChat (tạo video qua creation agent)
  //  • upload:   flow/uploadImage (tải ảnh reference → media_id)
  //  • session:  flowCreationAgent/sessions
  // LOẠI nhiễu: batchLogFrontendEvents, fetchUserRecommendations, log/analytics.
  const kindOf = (url) => {
    const u = (url || '').toLowerCase();
    if (/batchlogfrontendevents|fetchuserrecommendations|frontendevent|analytics|telemetry|\/log\b|\/g\/collect/.test(u)) return '';
    // DOWNLOAD: lấy URL tải video (getMediaUrlRedirect trả 302 → mp4 trên CDN).
    if (/getmediaurlredirect|media\.getmediaurl|flow-content\.google\/video|:download\b|downloadvideo/.test(u)) return 'download';
    // POLL: kiểm tra trạng thái video đang tạo (API cổ điển video:) — bắt trước generate.
    if (/batchcheckasyncvideo|checkasyncvideogeneration|video:batchcheck|generationstatus|:fetchoperation|operations\b/.test(u)) return 'poll';
    if (/streamchat|creationagent[:/](generate|run)|batchasyncgeneratevideo|generatevideo|generateimage|:generate\b|runvideo/.test(u)) return 'generate';
    if (/uploadimage|uploadmedia|:upload\b|media:upload/.test(u)) return 'upload';
    if (/creationagent\/sessions|createsession|\/sessions\b/.test(u)) return 'session';
    // PROJECT: tạo/mở/xoá/đổi dự án (thoát dự án cũ → vào dự án mới).
    if (/\/v1\/flow\/projects\b|createproject|deleteproject|:createproject|projects:batch|listprojects|getproject|project:create|checkappavailability/.test(u)) return 'project';
    if (/\/v1\/flow\/entities\b|character|persona|subject|actor|cast|speaker|voice|avatar/.test(u)) return 'character';
    return '';
  };

  const shouldTraceRequest = (url, method) => {
    const u = (url || '').toLowerCase();
    if (!interesting(url)) return false;
    if (/fetchuserrecommendations|\/g\/collect|analytics|telemetry/.test(u)) return false;
    if (method !== 'GET') return true;
    return /\/v1\/flow\/entities\b|\/v1\/flow\/models\/statuses\b|uploadimage|character|persona|voice|avatar|asset|getmediaurlredirect|\/v1\/flow\/projects\b|listprojects|getproject|checkappavailability/.test(u);
  };

  const shouldCaptureResponseText = (url) => /\/v1\/flow\/entities\b|flow|character|persona|voice|uploadimage|asset|generation/i.test(url || '');

  const headersToObj = (h) => {
    const o = {};
    try {
      if (!h) return o;
      if (typeof h.forEach === 'function') h.forEach((v, k) => { o[k] = v; });
      else if (Array.isArray(h)) h.forEach(([k, v]) => { o[k] = v; });
      else Object.assign(o, h);
    } catch (e) {}
    return o;
  };

  // Bearer token TƯƠI NHẤT — bắt từ mọi request tới backend để phát lại khỏi bị 401.
  let gAuth = null;
  const grabAuth = (headers) => {
    try {
      for (const k in headers) {
        if (k.toLowerCase() === 'authorization' && headers[k]) { gAuth = headers[k]; return; }
      }
    } catch (e) {}
  };

  // ---- fetch ----
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    let _kind = '', _url = '', _trace = false;
    try {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      _url = url;
      const method = ((init && init.method) || (typeof input === 'object' && input && input.method) || 'GET').toUpperCase();
      if (interesting(url)) {
        grabAuth(headersToObj((init && init.headers) || (typeof input === 'object' && input && input.headers)));
      }
      _trace = shouldTraceRequest(url, method);
      if (_trace) {
        _kind = kindOf(url);
        const headers = headersToObj((init && init.headers) || (typeof input === 'object' && input && input.headers));
        const rawBody = init && init.body;
        const body = typeof rawBody === 'string' ? rawBody : null;
        const bodyType = rawBody ? (typeof rawBody === 'string' ? 'string' : (rawBody.constructor && rawBody.constructor.name) || typeof rawBody) : 'none';
        post({ via: 'fetch', url, method, headers, body, bodyType, kind: _kind });
      }
    } catch (e) {}
    const p = origFetch.apply(this, arguments);
    if (_trace || _kind) {
      try {
        p.then((r) => {
          const base = { via: 'resp', kind: 'resp', respKind: _kind || '', url: _url, status: r.status, ok: r.ok };
          try {
            if (shouldCaptureResponseText(_url)) {
              r.clone().text().then((text) => post(Object.assign(base, { text: text.slice(0, 4000) }))).catch(() => post(base));
            } else post(base);
          } catch (e) { post(base); }
        }).catch(() => {});
      } catch (e) {}
    }
    return p;
  };

  // ---- XMLHttpRequest ----
  const O = XMLHttpRequest.prototype.open;
  const H = XMLHttpRequest.prototype.setRequestHeader;
  const S = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__afM = (m || '').toUpperCase(); this.__afU = u; this.__afH = {}; return O.apply(this, arguments); };
  XMLHttpRequest.prototype.setRequestHeader = function (k, v) { try { this.__afH[k] = v; } catch (e) {} return H.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    try {
      if (interesting(this.__afU)) grabAuth(this.__afH || {});
      const trace = shouldTraceRequest(this.__afU, this.__afM || 'GET');
      if (trace) {
        const _k = kindOf(this.__afU);
        const bodyType = body ? (typeof body === 'string' ? 'string' : (body.constructor && body.constructor.name) || typeof body) : 'none';
        post({ via: 'xhr', url: this.__afU, method: this.__afM || 'GET', headers: this.__afH || {}, body: typeof body === 'string' ? body : null, bodyType, kind: _k });
        try {
          this.addEventListener('load', () => {
            const base = { via: 'resp', kind: 'resp', respKind: _k, url: this.__afU, status: this.status, ok: this.status >= 200 && this.status < 300 };
            const txt = shouldCaptureResponseText(this.__afU) && typeof this.responseText === 'string' ? this.responseText.slice(0, 4000) : '';
            post(txt ? Object.assign(base, { text: txt }) : base);
          });
        } catch (e) {}
      }
    } catch (e) {}
    return S.apply(this, arguments);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ĐĂNG KÝ SỚM bộ điều phối lệnh Nano Flow (QUAN TRỌNG — chống "chết im lặng").
  // genNanoImages/genNanoVideos là FUNCTION DECLARATION nên được hoisted và luôn
  // sẵn sàng, còn post/gAuth/origFetch + các helper (batchGenerateImages,
  // uploadImageToFlow, renameWorkflow, mintRecaptcha) đều là hàm khai báo/biến
  // khởi tạo TRƯỚC điểm này. Nhờ vậy DÙ phần sau của script gặp lỗi nạp (ví dụ
  // giao diện Flow mới/agent khác cấu trúc) khiến bộ nghe ở cuối file KHÔNG kịp
  // đăng ký, thì lệnh "Tạo ảnh/Tạo video" VẪN chạy được. Lỗi đồng bộ (nếu có) sẽ
  // hiện ra log thay vì biến mất. Bộ nghe ở cuối file KHÔNG còn xử lý Nano nữa
  // (tránh chạy 2 lần).
  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d) return;
    if (d.__afNanoImages === true) {
      try { genNanoImages(d); }
      catch (e) { post({ via: 'log', kind: 'log', message: '❌ genNanoImages lỗi khởi chạy: ' + ((e && e.message) || e) + ' — F5 trang Flow rồi thử lại.' }); }
    } else if (d.__afNanoVideos === true) {
      try { genNanoVideos(d); }
      catch (e) { post({ via: 'log', kind: 'log', message: '❌ genNanoVideos lỗi khởi chạy: ' + ((e && e.message) || e) + ' — F5 trang Flow rồi thử lại.' }); }
    } else if (d.__afNanoThumb === true) {
      try { genNanoThumb(d); }
      catch (e) { post({ via: 'log', kind: 'log', message: '❌ genNanoThumb lỗi khởi chạy: ' + ((e && e.message) || e) + ' — F5 trang Flow rồi thử lại.' }); }
    }
  });
  // Bắt lỗi nạp trang (uncaught) và BÁO ra log — thay vì để inject.js chết lặng.
  window.addEventListener('error', (e) => {
    try {
      const src = String((e && e.filename) || '');
      if (!/inject\.js/.test(src) && src) return; // chỉ quan tâm lỗi của inject.js
      post({ via: 'log', kind: 'log', message: '❌ inject.js lỗi nạp: ' + ((e && e.message) || '') + ((e && e.lineno) ? ' @dòng ' + e.lineno : '') });
    } catch (_) {}
  });

  // ---- reCAPTCHA: hook grecaptcha.enterprise.execute để LẤY site key + action,
  //      rồi tự gọi lại tạo token MỚI mỗi lần phát lại (vì token cũ dùng 1 lần).
  const gState = { siteKey: null, action: null, origExec: null };
  function hookRecaptcha() {
    const g = window.grecaptcha && window.grecaptcha.enterprise;
    if (!g || typeof g.execute !== 'function') return false;
    if (g.__afHooked) return true;
    const orig = g.execute.bind(g);
    gState.origExec = orig;
    g.execute = function (siteKey, opts) {
      try {
        gState.siteKey = siteKey;
        if (opts && opts.action) gState.action = opts.action;
        post({ via: 'log', kind: 'log', message: `🔑 Đã bắt reCAPTCHA site key + action="${(opts && opts.action) || '?'}"` });
      } catch (e) {}
      return orig(siteKey, opts);
    };
    g.__afHooked = true;
    return true;
  }
  let _rtries = 0;
  const _riv = setInterval(() => { if (hookRecaptcha() || _rtries++ > 120) clearInterval(_riv); }, 500);

  // Tìm site key CHỦ ĐỘNG trong trang (khỏi phải chờ trang tự gọi execute).
  function deepFindSiteKey(obj, depth) {
    if (!obj || depth > 6 || typeof obj !== 'object') return null;
    for (const k in obj) {
      try {
        const v = obj[k];
        if (typeof v === 'string' && /^6L[\w-]{30,}$/.test(v)) return v; // dạng site key reCAPTCHA
        if (v && typeof v === 'object') { const r = deepFindSiteKey(v, depth + 1); if (r) return r; }
      } catch (e) {}
    }
    return null;
  }
  function findSiteKey() {
    if (gState.siteKey) return gState.siteKey;
    // 1) thẻ <script src="...recaptcha/(enterprise|api).js?render=KEY">
    try {
      const scripts = document.querySelectorAll('script[src*="recaptcha"]');
      for (const s of scripts) {
        const m = /[?&]render=([^&]+)/.exec(s.src || '');
        if (m && m[1] && m[1] !== 'explicit' && m[1] !== 'onload') { gState.siteKey = decodeURIComponent(m[1]); break; }
      }
    } catch (e) {}
    // 2) window.___grecaptcha_cfg.clients → tìm chuỗi giống site key
    if (!gState.siteKey) { try { gState.siteKey = deepFindSiteKey(window.___grecaptcha_cfg, 0); } catch (e) {} }
    if (gState.siteKey) post({ via: 'log', kind: 'log', message: `🔑 Tìm thấy reCAPTCHA site key trong trang` });
    return gState.siteKey;
  }

  // Circuit breaker: once reCAPTCHA fails repeatedly, stop RE-trying it for every
  // one of the 18 shots (which would waste ~6 minutes of timeouts) — fail the batch
  // fast with a clear reason instead.
  let recaptchaFailStreak = 0;
  async function mintRecaptcha(action) {
    if (recaptchaFailStreak >= 2) {
      throw new Error('reCAPTCHA liên tục hỏng — dừng thử. F5 trang Flow; nếu vẫn lỗi thì Flow có thể đã đổi cơ chế bảo mật (báo mình để cập nhật).');
    }
    try {
      const g = window.grecaptcha && window.grecaptcha.enterprise;
      if (!g || typeof g.execute !== 'function') throw new Error('grecaptcha.enterprise chưa tải trên trang — F5 lại trang Flow');
      const siteKey = findSiteKey();
      if (!siteKey) throw new Error('không tìm thấy reCAPTCHA site key trên trang');
      // g.ready(cb) queues cb until reCAPTCHA is ready; if the page's grecaptcha is
      // a half-loaded stub the callback may NEVER fire → cap the wait so we don't hang.
      if (typeof g.ready === 'function') {
        await withTimeout(new Promise((r) => g.ready(r)), 8000, 'reCAPTCHA ready');
      }
      const exec = gState.origExec || g.execute.bind(g);
      // action PHẢI khớp thao tác: VIDEO_GENERATION cho video, IMAGE_GENERATION cho ảnh.
      // execute() returns a token promise that can also hang on a wrong/stale site key.
      const tok = await withTimeout(
        exec(siteKey, { action: action || gState.action || 'VIDEO_GENERATION' }),
        12000, 'reCAPTCHA execute'
      );
      recaptchaFailStreak = 0; // recovered
      return tok;
    } catch (e) {
      recaptchaFailStreak++;
      throw e;
    }
  }
  const uuid4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });

  // Tách data URL → {mime, b64}. imageBytes cần base64 THUẦN (bỏ tiền tố data:).
  const parseDataUrl = (u) => { const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(u || ''); return m ? { mime: m[1], b64: m[2] } : { mime: 'image/png', b64: (u || '') }; };

  // Upload 1 ảnh → trả mediaId (media.name). Dùng cho ảnh nhân vật/reference.
  async function uploadImageToFlow(pid, dataUrl, fileName) {
    const { mime, b64 } = parseDataUrl(dataUrl);
    const res = await fetchWithTimeout('https://aisandbox-pa.googleapis.com/v1/flow/uploadImage', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8', Authorization: gAuth },
      body: JSON.stringify({ clientContext: { projectId: pid, tool: 'PINHOLE' }, fileName: fileName || 'ref.png', imageBytes: b64, isHidden: false, isUserUploaded: true, mimeType: mime }),
      credentials: 'include',
    }, 90000, 'uploadImage');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    const id = j && j.media && j.media.name;
    if (!id) throw new Error('không có mediaId trong phản hồi upload');
    return id;
  }

  async function uploadImageWorkflowToFlow(pid, dataUrl, fileName) {
    const { mime, b64 } = parseDataUrl(dataUrl);
    const headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
    if (gAuth) headers.Authorization = gAuth;
    const res = await origFetch('https://aisandbox-pa.googleapis.com/v1/flow/uploadImage', {
      method: 'POST',
      headers,
      body: JSON.stringify({ clientContext: { projectId: pid, tool: 'PINHOLE' }, fileName: fileName || 'character.png', imageBytes: b64, isHidden: false, isUserUploaded: true, mimeType: mime }),
      credentials: 'include',
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) throw new Error(`upload ảnh thường HTTP ${res.status}: ${text.slice(0, 180)}`);
    let j = {};
    try { j = JSON.parse(text || '{}'); } catch (e) {}
    const mediaId = j && j.media && j.media.name;
    const workflowId = (j && j.workflow && j.workflow.name) || (j && j.media && j.media.workflowId);
    if (!workflowId) throw new Error('upload ảnh thường không trả workflowId');
    return { mediaId, workflowId, raw: j };
  }

  // CÁCH 2 (lấy ảnh từ dự án làm nhân vật): sao chép 1 media ĐÃ có trong dự án vào
  //   slot ảnh của 1 entity MỚI → server tạo entity kèm ảnh, trả workflowId. Đúng như
  //   trace Flow thật (POST /v1/flow:copyProjectMedia).
  async function copyProjectMediaToEntity(pid, mediaId, entityId) {
    const headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
    if (gAuth) headers.Authorization = gAuth;
    const body = {
      mediaId,
      destinationProjectId: pid,
      destinationMediaContext: {
        entityContext: { entityId, characterSlot: { imageReferenceIndex: 0 } }
      }
    };
    const res = await origFetch('https://aisandbox-pa.googleapis.com/v1/flow:copyProjectMedia', {
      method: 'POST', headers, body: JSON.stringify(body), credentials: 'include',
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) throw new Error(`copyProjectMedia HTTP ${res.status}: ${text.slice(0, 180)}`);
    let j = {};
    try { j = JSON.parse(text || '{}'); } catch (e) {}
    const workflowId = (j && j.workflow && j.workflow.name) || (j && j.media && j.media.workflowId);
    if (!workflowId) throw new Error('copyProjectMedia không trả workflowId');
    return { workflowId, mediaId: j && j.media && j.media.name };
  }

  const looksSecretHeader = (k) => /authorization|cookie|api-?key|token|sapisid|secret|auth/i.test(k || '');
  function setFreshAuth(headers) {
    const out = {};
    for (const k in (headers || {})) {
      if (/^(:|host$|content-length$|cookie$|origin$|referer$|sec-|accept-encoding$|connection$)/i.test(k)) continue;
      out[k] = headers[k];
    }
    if (gAuth) {
      for (const k in out) { if (k.toLowerCase() === 'authorization') delete out[k]; }
      out.Authorization = gAuth;
    }
    return out;
  }

  async function uploadCharacterImageToFlow(pid, dataUrl, fileName, entityId) {
    const { mime, b64 } = parseDataUrl(dataUrl);
    const headers = { 'Content-Type': 'text/plain;charset=UTF-8' };
    if (gAuth) headers.Authorization = gAuth;
    const body = {
      clientContext: { projectId: pid, tool: 'PINHOLE' },
      imageBytes: b64,
      isUserUploaded: true,
      isHidden: false,
      mimeType: mime,
      fileName: fileName || 'character.png',
      mediaGenerationContext: {
        entityContext: {
          entityId,
          characterSlot: { imageReferenceIndex: 0 }
        }
      }
    };
    const res = await origFetch('https://aisandbox-pa.googleapis.com/v1/flow/uploadImage', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include',
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) throw new Error(`upload ảnh nhân vật HTTP ${res.status}: ${text.slice(0, 180)}`);
    let j = {};
    try { j = JSON.parse(text || '{}'); } catch (e) {}
    const mediaId = j && j.media && j.media.name;
    const workflowId = (j && j.workflow && j.workflow.name) || (j && j.media && j.media.workflowId);
    if (!workflowId) throw new Error('upload ảnh nhân vật không trả workflowId');
    return { mediaId, workflowId, raw: j };
  }

  function buildCharacterEntity(projectId, entityId, displayName, workflowId, voiceId) {
    const characterInfo = {
      imageReferences: workflowId ? [{ workflowId }, {}] : [{}, {}]
    };
    if (voiceId && voiceId !== 'auto') characterInfo.audioReferences = [{ presetVoiceId: voiceId }];
    return {
      projectId,
      entityId,
      entityInfo: {
        displayName,
        characterInfo
      }
    };
  }

  function buildCharacterPatchBody(projectId, entityId, displayName, workflowId, voiceId) {
    return JSON.stringify({
      entity: buildCharacterEntity(projectId, entityId, displayName, workflowId, voiceId),
      updateMask: 'entityInfo.displayName,entityInfo.characterInfo.audioReferences,entityInfo.characterInfo.imageReferences'
    });
  }

  function entityUrl(projectId, template) {
    const learnedUrl = template && /\/v1\/flow\/entities\b/i.test(template.url || '') ? template.url : '';
    return rewriteProjectInUrl(learnedUrl || 'https://aisandbox-pa.googleapis.com/v1/flow/entities', projectId);
  }

  function entityHeaders(templateHeaders) {
    const headers = setFreshAuth(templateHeaders || {});
    let hasContentType = false;
    for (const k in headers) {
      if (k.toLowerCase() === 'content-type') hasContentType = true;
    }
    if (!hasContentType) headers['Content-Type'] = 'text/plain;charset=UTF-8';
    return headers;
  }

  function flowProjectBasePath(projectId) {
    const path = window.location && window.location.pathname || '';
    const m = /(\/fx\/(?:[^/]+\/)?tools\/flow\/project\/)[^/]+/.exec(path);
    if (m) return m[1] + encodeURIComponent(projectId);
    return `/fx/vi/tools/flow/project/${encodeURIComponent(projectId)}`;
  }

  async function activateCharacterRoute(projectId, entityId) {
    const prev = (window.location && (window.location.pathname + window.location.search + window.location.hash)) || '';
    const target = `${flowProjectBasePath(projectId)}/character/${encodeURIComponent(entityId)}`;
    try {
      if (window.location.pathname !== target) {
        window.history.pushState({ afCharacterEntityId: entityId }, '', target);
        try { window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state })); } catch (e) {}
        try { window.dispatchEvent(new Event('locationchange')); } catch (e) {}
      }
      await new Promise((r) => setTimeout(r, 2600));
      return { ok: true, previousPath: prev, targetPath: target };
    } catch (e) {
      return { ok: false, previousPath: prev, targetPath: target, error: e.message };
    }
  }

  async function restoreFlowRoute(path) {
    if (!path || path === window.location.pathname + window.location.search + window.location.hash) return;
    try {
      window.history.pushState({ afRestored: true }, '', path);
      try { window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state })); } catch (e) {}
      try { window.dispatchEvent(new Event('locationchange')); } catch (e) {}
      await new Promise((r) => setTimeout(r, 500));
    } catch (e) {}
  }

  async function saveCharacterEntity(projectId, entityId, name, workflowId, voiceId, template) {
    const url = entityUrl(projectId, template);
    const learnedMethod = String((template && template.method) || '').toUpperCase();
    const methods = [];
    [learnedMethod, 'PATCH', 'POST', 'PUT'].forEach((m) => {
      if (m && m !== 'GET' && !methods.includes(m)) methods.push(m);
    });
    const bodyVariants = [
      { label: 'flow-patch', body: buildCharacterPatchBody(projectId, entityId, name, workflowId, voiceId) },
      { label: 'entity-only', body: JSON.stringify({ entity: buildCharacterEntity(projectId, entityId, name, workflowId, voiceId) }) },
      { label: 'clientContext+entity', body: JSON.stringify({ clientContext: { projectId, tool: 'PINHOLE' }, entity: buildCharacterEntity(projectId, entityId, name, workflowId, voiceId) }) }
    ];
    const failures = [];
    for (const method of methods) {
      for (const variant of bodyVariants) {
        const body = variant.body;
        const headers = entityHeaders(template && template.headers);
        try {
          const res = await origFetch(url, { method, headers, body, credentials: 'include' });
          const text = await res.text().catch(() => '');
          if (res.ok) {
            let parsed = {};
            try { parsed = JSON.parse(text || '{}'); } catch (e) {}
            return { status: res.status, method, variant: variant.label, response: parsed, text };
          }
          failures.push(`${method}/${variant.label}: HTTP ${res.status} ${text.slice(0, 180)}`);
        } catch (e) {
          failures.push(`${method}/${variant.label}: ${e.message}`);
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    const err = new Error(failures.join(' | ').slice(0, 1200) || 'không lưu được entity nhân vật');
    err.url = url;
    err.requestBody = buildCharacterPatchBody(projectId, entityId, name, workflowId, voiceId);
    throw err;
  }

  function deepRewriteCharacterPayload(value, ctx, parentKey) {
    if (Array.isArray(value)) return value.map((v) => deepRewriteCharacterPayload(v, ctx, parentKey));
    if (!value || typeof value !== 'object') return value;
    for (const key of Object.keys(value)) {
      const lk = key.toLowerCase();
      const v = value[key];
      if (typeof v === 'string') {
        if (lk === 'projectid' || lk.endsWith('projectid')) value[key] = ctx.projectId;
        else if ((lk === 'project' || lk.endsWith('project')) && /projects\//.test(v)) value[key] = 'projects/' + ctx.projectId;
        else if ((lk === 'displayname' || lk === 'charactername' || lk === 'titlename' || lk === 'title' || (lk === 'name' && parentKey !== 'media')) && !/[/:]/.test(v)) value[key] = ctx.name;
        else if (/voice|speaker/.test(lk) && ctx.voiceName) value[key] = ctx.voiceName;
        else if (/mediaid|imageid|portraitid|assetid/.test(lk) && ctx.mediaId) value[key] = ctx.mediaId;
        else if (/filename|file_name/.test(lk)) value[key] = ctx.fileName;
        else if (/imagebytes|bytes|base64/.test(lk) && ctx.b64) value[key] = ctx.b64;
        else if (/mimetype|mime/.test(lk) && ctx.mime) value[key] = ctx.mime;
      } else if (v && typeof v === 'object') {
        if (/voice|speaker/.test(lk) && ctx.voiceName) {
          if ('name' in v && typeof v.name === 'string') v.name = ctx.voiceName;
          if ('displayName' in v && typeof v.displayName === 'string') v.displayName = ctx.voiceName;
          if ('voiceName' in v && typeof v.voiceName === 'string') v.voiceName = ctx.voiceName;
          if ('voiceId' in v && typeof v.voiceId === 'string') v.voiceId = ctx.voiceId || ctx.voiceName;
        }
        if (/media|image|portrait|asset/.test(lk) && ctx.mediaId) {
          if ('mediaId' in v && typeof v.mediaId === 'string') v.mediaId = ctx.mediaId;
          if ('name' in v && typeof v.name === 'string' && /media|projects\//.test(v.name)) v.name = ctx.mediaId;
        }
        deepRewriteCharacterPayload(v, ctx, lk);
      }
    }
    return value;
  }

  function rewriteCharacterTemplateBody(templateBody, ctx) {
    let obj;
    try { obj = JSON.parse(templateBody || '{}'); } catch (e) { throw new Error('template nhân vật không phải JSON'); }
    return JSON.stringify(deepRewriteCharacterPayload(obj, ctx, ''));
  }

  function rewriteProjectInUrl(url, projectId) {
    let out = String(url || '');
    if (!projectId) return out;
    out = out.replace(/projects\/[^/?#"'\\\s]+/g, 'projects/' + projectId);
    out = out.replace(/([?&](?:projectId|project)=)[^&#]+/g, '$1' + encodeURIComponent(projectId));
    return out;
  }

  function isUploadEndpoint(url) {
    return /uploadimage|uploadmedia|:upload\b|media:upload/.test(String(url || '').toLowerCase());
  }

  function isKnownNonCharacterEndpoint(url) {
    const u = String(url || '').toLowerCase();
    return (
      isUploadEndpoint(u) ||
      /streamchat|creationagent[:/](generate|run)|batchasyncgeneratevideo|generatevideo|generateimage|:generate\b|runvideo/.test(u) ||
      /creationagent\/sessions|createsession|\/sessions\b/.test(u) ||
      /batchcheckasyncvideo|checkasyncvideogeneration|video:batchcheck|generationstatus|:fetchoperation|operations\b/.test(u) ||
      /batchlogfrontendevents|fetchuserrecommendations|frontendevent|analytics|telemetry|\/log\b|\/g\/collect/.test(u)
    );
  }

  function scrubJsonForLog(value, parentKey) {
    if (Array.isArray(value)) return value.map((v) => scrubJsonForLog(v, parentKey));
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const key of Object.keys(value)) {
      const lk = key.toLowerCase();
      const v = value[key];
      if (/authorization|cookie|token|secret|sapisid|imagebytes|bytes|base64|dataurl|imagedata/.test(lk)) {
        out[key] = typeof v === 'string' ? `[ẩn ${v.length} ký tự]` : '[ẩn]';
      } else if (typeof v === 'string' && v.length > 500) {
        out[key] = v.slice(0, 220) + `… [cắt ${v.length} ký tự]`;
      } else if (v && typeof v === 'object') {
        out[key] = scrubJsonForLog(v, lk);
      } else {
        out[key] = v;
      }
    }
    return out;
  }

  function scrubBodyForLog(body) {
    try { return JSON.stringify(scrubJsonForLog(JSON.parse(body || '{}'), ''), null, 2).slice(0, 5000); }
    catch (e) { return String(body || '').slice(0, 2000); }
  }

  function replaceRecaptchaToken(value, token, insideRecaptcha) {
    if (!value || typeof value !== 'object') return false;
    let changed = false;
    if (Array.isArray(value)) {
      value.forEach((item) => { if (replaceRecaptchaToken(item, token, insideRecaptcha)) changed = true; });
      return changed;
    }
    for (const key of Object.keys(value)) {
      const lk = key.toLowerCase();
      const nextInside = insideRecaptcha || lk.includes('recaptcha');
      if (nextInside && lk === 'token' && typeof value[key] === 'string') {
        value[key] = token;
        changed = true;
      } else if (value[key] && typeof value[key] === 'object') {
        if (replaceRecaptchaToken(value[key], token, nextInside)) changed = true;
      }
    }
    return changed;
  }

  async function refreshRecaptchaIfPresent(body) {
    if (!/recaptcha/i.test(body || '')) return body;
    let obj;
    try { obj = JSON.parse(body); } catch (e) { return body; }
    const token = await mintRecaptcha();
    return replaceRecaptchaToken(obj, token, false) ? JSON.stringify(obj) : body;
  }

  async function createCharactersViaTemplate(d) {
    const template = d.template || {};
    const chars = Array.isArray(d.characters) ? d.characters.filter((c) => c && c.imageDataUrl) : [];
    const projectId = String(d.projectId || '').replace(/^projects\//, '');
    if (!projectId) { post({ via: 'log', kind: 'log', message: '❌ Chưa có projectId để tạo nhân vật qua API.' }); return; }
    if (!gAuth) { post({ via: 'log', kind: 'log', message: '❌ Chưa bắt được token Flow. F5 trang Flow, mở project hiện tại, rồi bấm nạp lại.' }); return; }
    let ok = 0, fail = 0;
    const entities = [];
    const learnedEntityApi = template.url && /\/v1\/flow\/entities\b/i.test(template.url);
    post({ via: 'log', kind: 'log', message: `👤 API nhân vật ẩn: bắt đầu tạo ${chars.length} nhân vật${learnedEntityApi ? ' bằng mẫu /entities đã học' : ' bằng cấu trúc entity đã bắt'}…` });
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const name = String(c.name || `Character ${i + 1}`).trim();
      try {
        const entityId = uuid4();
        const voiceId = String((c.voice && c.voice.id) || '').toLowerCase();
        post({ via: 'log', kind: 'log', message: `👤 [${i + 1}] Tạo entity "${name}" · voice=${(c.voice && c.voice.name) || 'Auto'} · ${entityId.slice(0, 8)}…` });
        const route = await activateCharacterRoute(projectId, entityId);
        if (route.ok) post({ via: 'log', kind: 'log', message: `👤 [${i + 1}] Đã kích hoạt route nhân vật /character/${entityId.slice(0, 8)}…` });
        else post({ via: 'log', kind: 'log', message: `👤 [${i + 1}] Chưa kích hoạt được route nhân vật (${route.error || 'unknown'}), vẫn thử tiếp…` });
        let uploaded;
        try {
          // CÁCH 1: upload ảnh THẲNG vào entity mới — server tự tạo entity + gắn ảnh.
          uploaded = await uploadCharacterImageToFlow(projectId, c.imageDataUrl, c.fileName || `${name}.png`, entityId);
          post({ via: 'log', kind: 'log', message: `🖼️ [${i + 1}] Cách 1: ảnh gắn thẳng vào nhân vật → workflow ${uploaded.workflowId.slice(0, 8)}…` });
        } catch (uploadErr) {
          // CÁCH 2: upload ảnh vào DỰ ÁN rồi copyProjectMedia vào entity mới — cũng TẠO
          //   entity (khác đường cũ chỉ upload thường rồi PATCH → 404 vì entity chưa có).
          post({ via: 'log', kind: 'log', message: `🖼️ [${i + 1}] Cách 1 lỗi (${(uploadErr.message || '').slice(0, 80)}); chuyển Cách 2: tải ảnh vào dự án → lấy làm nhân vật…` });
          const plain = await uploadImageWorkflowToFlow(projectId, c.imageDataUrl, c.fileName || `${name}.png`);
          uploaded = await copyProjectMediaToEntity(projectId, plain.mediaId, entityId);
          post({ via: 'log', kind: 'log', message: `🖼️ [${i + 1}] Cách 2: đã tạo nhân vật từ ảnh dự án → workflow ${uploaded.workflowId.slice(0, 8)}…` });
        }
        await new Promise((r) => setTimeout(r, 600)); // để entity vừa tạo kịp sẵn sàng trước khi PATCH tên/voice
        const saved = await saveCharacterEntity(projectId, entityId, name, uploaded.workflowId, voiceId, learnedEntityApi ? template : null);
        ok++;
        entities.push({
          entityId,
          name,
          voiceId,
          voiceName: (c.voice && c.voice.name) || '',
          workflowId: uploaded.workflowId,
        });
        post({ via: 'log', kind: 'log', message: `✅ [${i + 1}] Đã lưu nhân vật "${name}" voice=${(c.voice && c.voice.name) || 'Auto'} → HTTP ${saved.status} (${saved.method}/${saved.variant})` });
        if (route.previousPath && /\/characters(?:[/?#]|$)/.test(route.previousPath)) await restoreFlowRoute(route.previousPath);
      } catch (e) {
        fail++;
        post({ via: 'log', kind: 'log', message: `❌ [${i + 1}] Tạo nhân vật "${name}" lỗi: ${e.message}` });
        post({ via: 'charApiFailure', kind: 'charApiFailure', invalidTemplate: false, status: 0, url: e.url || 'https://aisandbox-pa.googleapis.com/v1/flow/entities', response: e.message || '', requestBody: scrubBodyForLog(e.requestBody || ''), templateUrl: template.url || '' });
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    post({ via: 'charApiResult', kind: 'charApiResult', ok: fail === 0, invalidTemplate: false, status: 200, text: `Xong API nhân vật: ${ok} thành công, ${fail} lỗi.`, entities });
  }

  // KẾT HỢP: DOM đã bấm "Nhân vật mới" thật (Flow đã tạo entity + cho entityId thật),
  //   giờ chỉ GẮN ảnh + tên/voice qua API vào đúng entityId đó. Không tự chế uuid, không
  //   pushState — nên uploadImage kèm entityContext.entityId chạy được (entity đã có thật).
  async function attachCharacterViaApi(d) {
    const projectId = String(d.projectId || '').replace(/^projects\//, '');
    const entityId = String(d.entityId || '');
    const c = d.character || {};
    const name = String(c.name || 'Character').trim();
    const voiceId = String((c.voice && c.voice.id) || '').toLowerCase();
    if (!gAuth || !projectId || !entityId) {
      post({ via: 'charAttachResult', kind: 'charAttachResult', ok: false, entityId, error: 'thiếu token/projectId/entityId' });
      return;
    }
    try {
      let uploaded;
      try {
        // CÁCH 1: gắn ảnh thẳng vào entity thật.
        uploaded = await uploadCharacterImageToFlow(projectId, c.imageDataUrl, c.fileName || `${name}.png`, entityId);
        post({ via: 'log', kind: 'log', message: `🖼️ Cách 1: ảnh gắn vào nhân vật ${entityId.slice(0, 8)}… → workflow ${uploaded.workflowId.slice(0, 8)}…` });
      } catch (e1) {
        // CÁCH 2: upload ảnh vào dự án → copyProjectMedia vào entity thật.
        post({ via: 'log', kind: 'log', message: `🖼️ Cách 1 lỗi (${(e1.message || '').slice(0, 70)}); chuyển Cách 2: ảnh dự án → nhân vật…` });
        const plain = await uploadImageWorkflowToFlow(projectId, c.imageDataUrl, c.fileName || `${name}.png`);
        uploaded = await copyProjectMediaToEntity(projectId, plain.mediaId, entityId);
        post({ via: 'log', kind: 'log', message: `🖼️ Cách 2: ảnh dự án gắn vào nhân vật → workflow ${uploaded.workflowId.slice(0, 8)}…` });
      }
      await new Promise((r) => setTimeout(r, 500));
      const saved = await saveCharacterEntity(projectId, entityId, name, uploaded.workflowId, voiceId, null);
      post({ via: 'charAttachResult', kind: 'charAttachResult', ok: true, entityId, workflowId: uploaded.workflowId, name, voiceId, voiceName: (c.voice && c.voice.name) || '', status: saved.status });
    } catch (e) {
      post({ via: 'charAttachResult', kind: 'charAttachResult', ok: false, entityId, error: e.message });
    }
  }

  async function uploadCharacterRefs(d) {
    const projectId = String(d.projectId || '').replace(/^projects\//, '');
    const chars = Array.isArray(d.characters) ? d.characters.filter((c) => c && (c.imageDataUrl || c.data)) : [];
    if (!projectId) { post({ via: 'log', kind: 'log', message: '❌ Chưa có projectId để tải ảnh ref nhân vật.' }); return; }
    if (!gAuth) { post({ via: 'log', kind: 'log', message: '❌ Chưa bắt được token Flow. F5 trang Flow, mở project hiện tại, rồi thử lại.' }); return; }
    let ok = 0, fail = 0;
    const refs = [];
    post({ via: 'log', kind: 'log', message: `📎 Tải ${chars.length} ảnh ref nhân vật lên Flow…` });
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      const name = String(c.name || c.fileName || `character_${i + 1}`).trim() || `character_${i + 1}`;
      try {
        const mediaId = await uploadImageToFlow(projectId, c.imageDataUrl || c.data, c.fileName || `${name}.png`);
        ok++;
        refs.push({ name: c.name || name, mediaId });
        const tag = c.name ? ' @' + String(c.name).trim().replace(/\s+/g, '') : '';
        post({ via: 'log', kind: 'log', message: `✅ Ảnh ref "${name}"${tag} → ${String(mediaId).slice(0, 10)}` });
      } catch (e) {
        fail++;
        post({ via: 'log', kind: 'log', message: `❌ Ảnh ref "${name}" lỗi: ${e.message}` });
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    post({ via: 'charRefResult', kind: 'charRefResult', ok: fail === 0, status: fail ? 400 : 200, text: `Ảnh ref: ${ok} thành công, ${fail} lỗi.`, refs });
  }

  // ---- TẠO VIDEO qua API CỔ ĐIỂN video:batchAsyncGenerate... (giống TurboFlow) ----
  // Giao thức trích từ TurboFlow: endpoint theo chế độ + videoModelKey theo model/duration.
  const vtMethod = (mode) => ({
    text: 'batchAsyncGenerateVideoText',
    start_frame: 'batchAsyncGenerateVideoStartImage',
    start_end_frame: 'batchAsyncGenerateVideoStartAndEndImage',
    reference: 'batchAsyncGenerateVideoReferenceImages',
  }[mode] || 'batchAsyncGenerateVideoText');
  const videoModelKey = (mode, model, duration) => {
    const d = duration || 8;
    const n = d !== 8, i = n ? '_' + d + 's' : '';
    if (model === 'omni_flash') { const t = '_' + d + 's'; return ({ text: 'abra_t2v' + t, reference: 'abra_r2v' + t, start_frame: 'abra_i2v' + t }[mode]) || ('abra_t2v' + t); }
    if (model === 'fast') return ({ text: 'veo_3_1_t2v_fast' + i, start_frame: 'veo_3_1_i2v_s_fast' + i, start_end_frame: 'veo_3_1_i2v_s_fast' + i + '_fl', reference: 'veo_3_1_r2v_fast' }[mode]) || ('veo_3_1_t2v_fast' + i);
    if (model === 'quality') return ({ text: 'veo_3_1_t2v_quality' + i, start_frame: 'veo_3_1_i2v_s_quality' + i, start_end_frame: 'veo_3_1_i2v_s_quality' + i + '_fl', reference: 'veo_3_1_r2v_quality' }[mode]) || ('veo_3_1_t2v_quality' + i);
    // Mặc định model 'lite' (Veo 3.1 Lite — đã xác nhận chạy 200)
    return ({
      text: 'veo_3_1_t2v_lite' + i,
      start_frame: n ? 'veo_3_1_i2v_s_lite' + i : 'veo_3_1_i2v_lite',
      start_end_frame: n ? 'veo_3_1_i2v_s_lite' + i + '_fl' : 'veo_3_1_interpolation_lite',
      reference: 'veo_3_1_r2v_lite',
    }[mode]) || ('veo_3_1_t2v_lite' + i);
  };
  const NO_TEXT_OVERLAY = 'Important visual rule: no subtitles, no captions, no dialogue text, no lower-thirds, and no added on-screen text or text overlays.';
  function promptMentions(prompt, name) {
    const n = String(name || '').trim();
    if (n.length < 2 || !prompt) return false;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return new RegExp('(^|[^\\p{L}\\p{N}])' + esc + '($|[^\\p{L}\\p{N}])', 'iu').test(prompt); }
    catch (e) { return String(prompt).toLowerCase().includes(n.toLowerCase()); }
  }
  function buildCharacterTags(prompt, chars) {
    const named = (Array.isArray(chars) ? chars : []).filter((c) => c && String(c.name || '').trim());
    if (!named.length) return '';
    const mentioned = named.filter((c) => promptMentions(prompt, c.name));
    const apply = mentioned.length ? mentioned : named;
    const tags = [];
    apply.forEach((c) => {
      const tag = '@' + String(c.name || '').trim().replace(/\s+/g, '');
      if (tag.length > 1 && !tags.includes(tag) && !String(prompt || '').includes(tag)) tags.push(tag);
    });
    return tags.join(' ');
  }

  function buildPrompt(raw, voice) {
    const parts = [String(raw || '').trim()].filter(Boolean);
    if (voice && voice.id && voice.id !== 'auto' && voice.prompt) {
      parts.push(`Voice direction: ${voice.prompt} Use spoken audio only; do not render the words as subtitles or captions.`);
    }
    parts.push(NO_TEXT_OVERLAY);
    return parts.join('\n\n');
  }

  const VIDEO_POLL_URL = 'https://aisandbox-pa.googleapis.com/v1/video:batchCheckAsyncVideoGenerationStatus';
  const VIDEO_UPSAMPLE_URL = 'https://aisandbox-pa.googleapis.com/v1/video:batchAsyncGenerateVideoUpsampleVideo';
  let videoPollBodyIndex = -1;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ============================================================
  // TẢI 1080P QUA API — quy trình 3 bước (đã học từ trace thực tế):
  //   1) UPSAMPLE: POST video:batchAsyncGenerateVideoUpsampleVideo (cần reCAPTCHA)
  //      → tạo media "<baseId>_upsampled" (status PENDING).
  //   2) POLL:    video:batchCheckAsyncVideoGenerationStatus tới khi SUCCESSFUL.
  //   3) DOWNLOAD: báo content_script tải "<baseId>_upsampled" qua chrome.downloads.
  // ============================================================
  const AF_ASPECT = (a) => {
    const s = String(a || '').toLowerCase();
    if (/portrait|9:16|9_16/.test(s)) return 'VIDEO_ASPECT_RATIO_PORTRAIT';
    if (/landscape|16:9|16_9/.test(s)) return 'VIDEO_ASPECT_RATIO_LANDSCAPE';
    return /^video_aspect_ratio_/i.test(s) ? a : 'VIDEO_ASPECT_RATIO_LANDSCAPE';
  };

  // Dựng body upsample. Ưu tiên NHÂN BẢN template đã bắt (afGenerateUpsampleTemplate)
  //   rồi ghi đè mediaId/workflowId/aspect/token — để giữ đúng mọi field (paygate,
  //   sessionId, seed, useV2ModelConfig…). Nếu không có template thì dựng tối thiểu.
  // resolution: '1080' (mặc định) hoặc '4k'. 4K dùng enum 2160P + model key 4k;
  //   nếu Flow/tài khoản không hỗ trợ, caller sẽ tự hạ xuống 1080p.
  const AF_RES = (resolution) => (resolution === '4k'
    ? { enum: 'VIDEO_RESOLUTION_2160P', modelKey: 'veo_3_1_upsampler_4k', label: '4K' }
    : { enum: 'VIDEO_RESOLUTION_1080P', modelKey: 'veo_3_1_upsampler_1080p', label: '1080P' });

  function buildUpsampleBody(projectId, baseId, workflowId, aspectRatio, token, templateBody, resolution = '1080') {
    const res = AF_RES(resolution);
    let obj = null;
    try { if (templateBody) obj = JSON.parse(templateBody); } catch (e) { obj = null; }
    if (obj && Array.isArray(obj.requests) && obj.requests[0]) {
      obj.mediaGenerationContext = obj.mediaGenerationContext || {};
      obj.mediaGenerationContext.batchId = uuid4();
      obj.clientContext = obj.clientContext || {};
      obj.clientContext.projectId = projectId;
      obj.clientContext.tool = obj.clientContext.tool || 'PINHOLE';
      obj.clientContext.recaptchaContext = { token, applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB' };
      const r = obj.requests[0];
      r.resolution = res.enum;
      if (aspectRatio) r.aspectRatio = AF_ASPECT(aspectRatio);
      r.videoModelKey = resolution === '4k' ? res.modelKey : (r.videoModelKey || res.modelKey);
      r.metadata = Object.assign({}, r.metadata, workflowId ? { workflowId } : {});
      r.videoInput = { mediaId: baseId };
      obj.requests = [r];
      return obj;
    }
    return {
      mediaGenerationContext: { batchId: uuid4(), audioFailurePreference: 'BLOCK_SILENCED_VIDEOS' },
      clientContext: { projectId, tool: 'PINHOLE', recaptchaContext: { token, applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB' } },
      requests: [{
        resolution: res.enum,
        aspectRatio: AF_ASPECT(aspectRatio),
        videoModelKey: res.modelKey,
        seed: Math.floor(Math.random() * 1000000),
        metadata: workflowId ? { workflowId } : {},
        videoInput: { mediaId: baseId },
      }],
      useV2ModelConfig: true,
    };
  }

  async function pollUpsampleStatus(projectId, upName, rounds = 40, delayMs = 5000) {
    for (let i = 0; i < rounds; i++) {
      if (i > 0) await sleep(delayMs);
      try {
        const res = await origFetch(VIDEO_POLL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: gAuth },
          body: JSON.stringify({ media: [{ name: upName, projectId }] }),
          credentials: 'include',
        });
        const txt = await res.text().catch(() => '');
        post({ via: 'resp', kind: 'resp', respKind: 'poll', url: VIDEO_POLL_URL, status: res.status, ok: res.ok, text: txt.slice(0, 20000) });
        if (/MEDIA_GENERATION_STATUS_SUCCESSFUL/.test(txt)) return true;
        if (/STATUS_FAILED|STATUS_ERROR|STATUS_CANCELL?ED/.test(txt)) return false;
      } catch (e) { /* thử vòng sau */ }
    }
    return false;
  }

  async function upsampleAndDownloadOne(item, projectId, templateBody, resolution = '1080') {
    const baseId = String(item.mediaId || '').replace(/_upsampled$/, '');
    if (!baseId) return;
    const upName = baseId + '_upsampled';
    let effRes = resolution === '4k' ? '4k' : '1080';
    const resLabel = () => AF_RES(effRes).label;

    // Gọi upsample với 1 resolution; trả { ok, status } (không throw).
    const callUpsample = async (wantRes) => {
      const token = await mintRecaptcha('VIDEO_GENERATION');
      const body = buildUpsampleBody(projectId, baseId, item.workflowId, item.aspectRatio, token, templateBody, wantRes);
      const res = await origFetch(VIDEO_UPSAMPLE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: gAuth },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const txt = await res.text().catch(() => '');
      post({ via: 'resp', kind: 'resp', respKind: 'generate', url: VIDEO_UPSAMPLE_URL, status: res.status, ok: res.ok, text: txt.slice(0, 2000) });
      return { ok: res.ok, status: res.status };
    };

    post({ via: 'log', kind: 'log', message: `🎬 ${resLabel()} [${baseId.slice(0, 8)}]: gọi upsample…` });
    try {
      let r = await callUpsample(effRes);
      // 4K bị từ chối (tài khoản/model không hỗ trợ) → TỰ HẠ xuống 1080p, vẫn có video.
      if (!r.ok && effRes === '4k') {
        post({ via: 'log', kind: 'log', message: `⚠️ 4K [${baseId.slice(0, 8)}]: Flow từ chối (HTTP ${r.status}) — tự hạ xuống 1080P.` });
        effRes = '1080';
        r = await callUpsample(effRes);
      }
      // Không chặn nếu lỗi: có thể "_upsampled" đã tồn tại từ trước → vẫn thử poll.
    } catch (e) {
      post({ via: 'log', kind: 'log', message: `⚠️ ${resLabel()} [${baseId.slice(0, 8)}]: upsample lỗi (${e.message}) — vẫn thử poll.` });
    }
    post({ via: 'log', kind: 'log', message: `⏳ ${resLabel()} [${baseId.slice(0, 8)}]: đợi xử lý ${resLabel()}…` });
    const ok = await pollUpsampleStatus(projectId, upName, 60, 5000);
    // Báo content_script tải (chrome.downloads chạy ở background, không phải MAIN world).
    post({ via: 'upsampleReady', kind: 'upsampleReady', mediaId: baseId, downloadName: item.downloadName || '', ok, resolution: effRes });
    post({ via: 'log', kind: 'log', message: ok ? `✅ ${resLabel()} [${baseId.slice(0, 8)}]: sẵn sàng, đang tải.` : `❌ ${resLabel()} [${baseId.slice(0, 8)}]: chưa xong sau thời gian chờ.` });
  }

  // Chờ các video BASE (không _upsampled) render xong (SUCCESSFUL) trước khi tải.
  //   Trả về danh sách id đã sẵn sàng. Dùng cho chuỗi tự động nhiều dự án.
  async function waitVideosReady(ids, projectId, rounds = 60, delayMs = 5000) {
    const ordered = (ids || []).map((x) => String(x || '').replace(/_upsampled$/, '')).filter(Boolean);
    const pending = new Set(ordered);
    const ready = new Set();
    for (let i = 0; i < rounds && pending.size; i++) {
      if (i > 0) await sleep(delayMs);
      for (const id of Array.from(pending)) {
        try {
          const res = await origFetch(VIDEO_POLL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: gAuth },
            body: JSON.stringify({ media: [{ name: id, projectId }] }),
            credentials: 'include',
          });
          const txt = await res.text().catch(() => '');
          if (/MEDIA_GENERATION_STATUS_SUCCESSFUL/.test(txt)) { pending.delete(id); ready.add(id); }
          else if (/STATUS_FAILED|STATUS_ERROR|STATUS_CANCELL?ED/.test(txt)) { pending.delete(id); }
        } catch (e) { /* thử vòng sau */ }
      }
      post({ via: 'log', kind: 'log', message: `⏳ Chờ render: còn ${pending.size}, xong ${ready.size}…` });
    }
    // Giữ đúng thứ tự clip đã tạo để tên "Kịch bản 1, 2, 3..." ổn định,
    // không phụ thuộc clip nào render xong trước.
    return ordered.filter((id) => ready.has(id));
  }

  async function waitVideosReadyHandler(d) {
    const projectId = String(d.projectId || '').replace(/^projects\//, '');
    const ids = Array.isArray(d.ids) ? d.ids : [];
    if (!gAuth || !projectId || !ids.length) { post({ via: 'videosReady', kind: 'videosReady', reqId: d.reqId, ready: [] }); return; }
    const ready = await waitVideosReady(ids, projectId, d.rounds || 60, d.delayMs || 5000);
    post({ via: 'videosReady', kind: 'videosReady', reqId: d.reqId, ready });
  }

  async function upsampleDownloadBulk(d) {
    if (!gAuth) { post({ via: 'log', kind: 'log', message: '❌ Chưa bắt được Bearer — mở/thao tác 1 lần trên Flow rồi thử lại.' }); return; }
    const projectId = String(d.projectId || '').replace(/^projects\//, '');
    const items = Array.isArray(d.items) ? d.items.filter((it) => it && it.mediaId) : [];
    const resolution = d.resolution === '4k' ? '4k' : '1080';
    const label = AF_RES(resolution).label;
    if (!projectId || !items.length) { post({ via: 'log', kind: 'log', message: `❌ Thiếu projectId hoặc danh sách video để tải ${label}.` }); return; }
    post({ via: 'log', kind: 'log', message: `⬇️ Tải ${label} hàng loạt: ${items.length} video…` });
    for (const it of items) {
      await upsampleAndDownloadOne(it, projectId, d.templateBody, resolution);
    }
    post({ via: 'log', kind: 'log', message: `🏁 Xong lượt tải ${label} (${items.length} video).` });
  }

  function normalizeWorkflowName(name) {
    return String(name || '').trim().replace(/^workflows\//, '');
  }

  function videoPollBodies(projectId, workflowNames) {
    const pid = String(projectId || '').replace(/^projects\//, '');
    return [
      { projectId: pid, workflowNames },
      { projectId: pid, workflows: workflowNames },
      { workflowNames },
      { names: workflowNames },
      { projectId: `projects/${pid}`, workflowNames },
    ];
  }

  function summarizePoll(text) {
    try {
      const json = JSON.parse(text || '{}');
      const values = [];
      const walk = (v) => {
        if (!v || values.length >= 3) return;
        if (Array.isArray(v)) { v.forEach(walk); return; }
        if (typeof v === 'object') {
          const state = v.status || v.state || v.generationStatus || v.videoGenerationStatus || '';
          const name = v.name || v.workflowName || v.workflowId || '';
          if (state || name) values.push(`${String(name).slice(0, 8) || 'video'}:${state || 'ok'}`);
          Object.keys(v).forEach((k) => walk(v[k]));
        }
      };
      walk(json);
      return values.length ? values.join(', ') : text.slice(0, 120);
    } catch (e) {
      return String(text || '').slice(0, 120);
    }
  }

  // Bóc MEDIA ID video từ response tạo/poll (parse ĐẦY ĐỦ — không dựa vào bản cắt).
  //   Theo trace thực tế, id có thể nằm ở 3 chỗ:
  //   • media[].name (kèm .video, workflowId, aspect)
  //   • operations[].operation.name
  //   • workflows[].metadata.primaryMediaId
  //   Trả [{ id, workflowId, aspectRatio }] đã khử trùng, bỏ hậu tố _upsampled.
  function extractVideosFromGenerateResponse(text, fallbackWorkflowId = '', fallbackAspect = '') {
    let obj = null;
    try { obj = JSON.parse(text || '{}'); } catch (e) { return []; }
    const byId = new Map();
    const addId = (rawName, workflowId, aspectRatio) => {
      const id = String(rawName || '').replace(/_upsampled$/, '').trim();
      if (!id || !/^[0-9a-f-]{20,}$/i.test(id)) return;
      const prev = byId.get(id) || {};
      byId.set(id, {
        id,
        workflowId: workflowId || prev.workflowId || fallbackWorkflowId || '',
        aspectRatio: aspectRatio || prev.aspectRatio || fallbackAspect || '',
      });
    };
    const mediaArr = Array.isArray(obj && obj.media) ? obj.media : [];
    for (const m of mediaArr) {
      if (!m || !m.name) continue;
      // Chỉ nhận media là VIDEO (có .video) hoặc chưa rõ loại nhưng nằm trong response tạo video.
      if (m.image) continue;
      const ctrl = m.mediaMetadata && m.mediaMetadata.requestData && m.mediaMetadata.requestData.videoGenerationRequestData && m.mediaMetadata.requestData.videoGenerationRequestData.videoModelControlInput;
      const aspect = (ctrl && ctrl.videoAspectRatio) || (m.video && m.video.generatedVideo && m.video.generatedVideo.aspectRatio) || '';
      addId(m.name, m.workflowId || '', aspect);
    }
    const opsArr = Array.isArray(obj && obj.operations) ? obj.operations : [];
    for (const o of opsArr) addId(o && o.operation && o.operation.name, '', '');
    const wfArr = Array.isArray(obj && obj.workflows) ? obj.workflows : [];
    for (const w of wfArr) addId(w && w.metadata && w.metadata.primaryMediaId, (w && w.name) || '', '');
    return Array.from(byId.values());
  }

  async function pollGeneratedVideos(projectId, workflowNames, rounds = 4, delayMs = 9000) {
    const names = Array.from(new Set((workflowNames || []).map(normalizeWorkflowName).filter(Boolean)));
    if (!names.length || !gAuth) return;
    for (let round = 1; round <= rounds; round++) {
      if (round > 1) await sleep(delayMs);
      post({ via: 'log', kind: 'log', message: `⏳ API POLL: /v1/video:batchCheckAsyncVideoGenerationStatus | workflows=${names.length} | lần ${round}/${rounds}` });
      const bodies = videoPollBodies(projectId, names);
      const order = videoPollBodyIndex >= 0 ? [videoPollBodyIndex] : bodies.map((_, i) => i);
      let finalStatus = 0;
      let finalOk = false;
      let finalText = '';
      for (const idx of order) {
        try {
          const res = await origFetch(VIDEO_POLL_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: gAuth },
            body: JSON.stringify(bodies[idx]),
            credentials: 'include',
          });
          finalStatus = res.status;
          finalOk = res.ok;
          finalText = await res.text().catch(() => '');
          if (res.ok) {
            videoPollBodyIndex = idx;
            break;
          }
        } catch (e) {
          finalStatus = 0;
          finalOk = false;
          finalText = 'lỗi fetch poll: ' + e.message;
        }
      }
      post({ via: 'resp', kind: 'resp', respKind: 'poll', url: VIDEO_POLL_URL, status: finalStatus, ok: finalOk, text: finalText.slice(0, 20000) });
      if (finalOk) post({ via: 'log', kind: 'log', message: `↳ poll: ${summarizePoll(finalText)}` });
      else break;
    }
  }

  async function genVideo(d) {
    if (!gAuth) { post({ via: 'genResult', kind: 'genResult', ok: false, status: 0, text: 'Chưa bắt được Bearer — hãy thao tác 1 lần trên Flow (mở project) rồi thử lại' }); return; }
    let token;
    try { token = await mintRecaptcha('VIDEO_GENERATION'); } catch (e) { post({ via: 'genResult', kind: 'genResult', ok: false, status: 0, text: 'reCAPTCHA lỗi: ' + e.message }); return; }
    const pid = String(d.projectId || '').replace(/^projects\//, '');
    const mode = d.mode || 'text';
    const url = 'https://aisandbox-pa.googleapis.com/v1/video:' + vtMethod(mode);
    const item = {
      aspectRatio: d.aspect === 'portrait' ? 'VIDEO_ASPECT_RATIO_PORTRAIT' : 'VIDEO_ASPECT_RATIO_LANDSCAPE',
      seed: Math.floor(Math.random() * 1000000),
      metadata: {},
      textInput: { structuredPrompt: { parts: [{ text: d.prompt || '' }] } },
      videoModelKey: videoModelKey(mode, d.model || 'lite', d.duration),
    };
    if (d.startImageMediaId) item.startImage = { mediaId: d.startImageMediaId, cropCoordinates: { top: 0, left: 0, bottom: 1, right: 1 } };
    if (d.endImageMediaId) item.endImage = { mediaId: d.endImageMediaId, cropCoordinates: { top: 0, left: 0, bottom: 1, right: 1 } };
    if (Array.isArray(d.referenceMediaIds) && d.referenceMediaIds.length) item.referenceImages = d.referenceMediaIds.map((id) => ({ mediaId: id, imageUsageType: 'IMAGE_USAGE_TYPE_ASSET' }));
    // Body ĐẦY ĐỦ đúng như TurboFlow gửi.
    const body = {
      mediaGenerationContext: { batchId: uuid4(), audioFailurePreference: 'BLOCK_SILENCED_VIDEOS' },
      clientContext: {
        projectId: pid,
        tool: 'PINHOLE',
        recaptchaContext: { applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB', token },
        sessionId: uuid4(),
        userPaygateTier: 'PAYGATE_TIER_NOT_PAID',
      },
      requests: [item],
      useV2ModelConfig: true,
    };
    post({ via: 'log', kind: 'log', message: `🎬 Gửi video:${vtMethod(mode)} | model=${item.videoModelKey} | pid=${pid.slice(0, 8)}… (action=VIDEO_GENERATION)` });
    try {
      const res = await origFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: gAuth }, body: JSON.stringify(body), credentials: 'include' });
      let text = '';
      try { text = (await res.text()).slice(0, 400); } catch (e) {}
      post({ via: 'genResult', kind: 'genResult', ok: res.ok, status: res.status, text });
    } catch (e) { post({ via: 'genResult', kind: 'genResult', ok: false, status: 0, text: 'lỗi fetch: ' + e.message }); }
  }
  // ---- TẠO HÀNG LOẠT: lặp qua nhiều prompt, mỗi prompt 1 request video (mint token mới).
  async function genBulk(d) {
    if (!gAuth) { post({ via: 'genResult', kind: 'genResult', bulk: true, ok: false, status: 0, text: 'Chưa bắt được Bearer — thao tác trên Flow rồi thử lại', requestedCount: 0, submittedCount: 0, harvestedIdCount: 0, failedCount: 1, results: [] }); return; }
    const pid = String(d.projectId || '').replace(/^projects\//, '');
    const count = Math.max(1, Math.min(4, d.count || 1));
    const model = d.model || 'lite';
    let harvestedIdCount = 0; // số media id đã bóc trực tiếp từ response tạo
    // items = danh sách {prompt, image?} — mỗi prompt có thể kèm ảnh RIÊNG (storyboard/reference).
    let items = Array.isArray(d.items) ? d.items : (d.prompts || []).map((p) => ({ prompt: p, image: null }));
    items = items.filter((it) => it && String(it.prompt || '').trim());
    if (!items.length) {
      post({ via: 'genResult', kind: 'genResult', bulk: true, ok: false, status: 0, text: 'Không có prompt hợp lệ để tạo video.', requestedCount: 0, submittedCount: 0, harvestedIdCount: 0, failedCount: 0, results: [] });
      return;
    }

    // 1) Ảnh nhân vật/sản phẩm CHUNG — giữ engine v9.20, chỉ cho phép nhận media đã preflight.
    const charMediaIds = [...new Set((Array.isArray(d.preloadedCharacterRefs) ? d.preloadedCharacterRefs : [])
      .map((r) => r && (r.mediaId || r.id))
      .filter(Boolean))];
    // KHỬ TRÙNG entity (phòng danh sách bị dồn 2 lần từ các lượt preflight).
    const entityRefs = [...new Set((Array.isArray(d.characterEntities) ? d.characterEntities : [])
      .map((e) => e && (e.entityId || e.id))
      .filter(Boolean))];
    post({ via: 'log', kind: 'log', message: `🔬 REF gửi đi: ảnh_chung=${charMediaIds.length} · entity=${entityRefs.length} [${entityRefs.map((x) => String(x).slice(0, 6)).join(', ')}]` });
    const chars = Array.isArray(d.characterImages) ? d.characterImages.filter((im) => im && im.data) : [];
    // Chỉ dữ liệu `characterRefs` mới được biến thành @Tên. Không dùng toàn bộ
    // `characterImages` làm fallback vì danh sách đó còn chứa ảnh ref chung/sản phẩm.
    const tagSources = Array.isArray(d.characterRefs) ? d.characterRefs : chars;
    if (charMediaIds.length) {
      post({ via: 'log', kind: 'log', message: `📎 Dùng ${charMediaIds.length} ảnh ref nhân vật đã chuẩn bị trước.` });
    }
    if (entityRefs.length) {
      post({ via: 'log', kind: 'log', message: `👤 Dùng ${entityRefs.length} nhân vật entity Flow trong referenceEntities.` });
    }
    if (chars.length) {
      post({ via: 'log', kind: 'log', message: `📎 Tải ${chars.length} ảnh nhân vật/sản phẩm (chung)…` });
      for (const im of chars) {
        try { const id = await uploadImageToFlow(pid, im.data, im.name || 'char.png'); charMediaIds.push(id); post({ via: 'log', kind: 'log', message: `✅ Nhân vật "${im.name || ''}" → ${String(id).slice(0, 10)}` }); }
        catch (e) { post({ via: 'log', kind: 'log', message: `❌ Ảnh nhân vật "${im.name || ''}" lỗi: ${e.message}` }); }
      }
    }

    let ok = 0, fail = 0;
    const results = [];
    post({ via: 'log', kind: 'log', message: `🚀 Bắt đầu tạo HÀNG LOẠT ${items.length} video…` });
    for (let i = 0; i < items.length; i++) {
      const basePrompt = String(items[i].prompt || '').trim();
      // Chế độ ENTITY: referenceEntities đã đính nhân vật rồi — KHÔNG gắn thêm "@Tên"
      //   (gắn cả hai làm mỗi nhân vật xuất hiện 2 lần trong khung ref → Veo tưởng 4 người).
      const tags = entityRefs.length ? '' : buildCharacterTags(basePrompt, tagSources);
      const prompt = tags ? `${tags} ${basePrompt}` : basePrompt;
      if (tags) post({ via: 'log', kind: 'log', message: `👤 [${i + 1}] Gọi nhân vật Flow: ${tags}` });
      if (entityRefs.length && i === 0) post({ via: 'log', kind: 'log', message: '👤 Entity mode: chỉ dùng referenceEntities, không gắn @Tên (tránh nhân vật hiện 2 lần).' });
      // 2) MỘT HOẶC NHIỀU ảnh RIÊNG của prompt này — tải cho đúng video.
      const refIds = charMediaIds.slice();
      const promptImages = Array.isArray(items[i].images) && items[i].images.length
        ? items[i].images.filter((image) => image && (image.data || image.imageDataUrl))
        : (items[i].image ? [{ data: items[i].image, name: items[i].imageName || 'scene.png' }] : []);
      if (promptImages.length) {
        post({ via: 'log', kind: 'log', message: `🖼️ [${i + 1}] Tải ${promptImages.length} ảnh riêng của prompt…` });
        for (let imageIndex = 0; imageIndex < promptImages.length; imageIndex++) {
          const promptImage = promptImages[imageIndex];
          const imageName = promptImage.name || promptImage.fileName || `scene ${imageIndex + 1}.png`;
          try {
            const id = await uploadImageToFlow(pid, promptImage.data || promptImage.imageDataUrl, imageName);
            refIds.push(id);
            post({ via: 'log', kind: 'log', message: `✅ [${i + 1}] Ảnh prompt ${imageIndex + 1}/${promptImages.length} → ${String(id).slice(0, 10)}` });
          } catch (e) {
            post({ via: 'log', kind: 'log', message: `❌ [${i + 1}] Ảnh prompt "${imageName}" lỗi: ${e.message}` });
          }
        }
      }
      const mode = (refIds.length || entityRefs.length) ? 'reference' : 'text';
      const url = 'https://aisandbox-pa.googleapis.com/v1/video:' + vtMethod(mode);
      let token;
      try { token = await mintRecaptcha('VIDEO_GENERATION'); } catch (e) { fail++; post({ via: 'log', kind: 'log', message: `❌ [${i + 1}] reCAPTCHA lỗi: ${e.message}` }); continue; }
      const mkItem = () => {
        const it = {
          aspectRatio: d.aspect === 'portrait' ? 'VIDEO_ASPECT_RATIO_PORTRAIT' : 'VIDEO_ASPECT_RATIO_LANDSCAPE',
          seed: Math.floor(Math.random() * 1000000),
          metadata: {},
          textInput: { structuredPrompt: { parts: [{ text: prompt }] } },
          videoModelKey: videoModelKey(mode, model, d.duration),
        };
        if (refIds.length) it.referenceImages = refIds.map((id) => ({ mediaId: id, imageUsageType: 'IMAGE_USAGE_TYPE_ASSET' }));
        if (entityRefs.length) it.referenceEntities = entityRefs.map((entityId) => ({ entityId }));
        return it;
      };
      const body = {
        mediaGenerationContext: { batchId: uuid4(), audioFailurePreference: 'BLOCK_SILENCED_VIDEOS' },
        clientContext: { projectId: pid, tool: 'PINHOLE', recaptchaContext: { applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB', token }, sessionId: uuid4(), userPaygateTier: 'PAYGATE_TIER_NOT_PAID' },
        requests: Array.from({ length: count }, mkItem),
        useV2ModelConfig: true,
      };
      try {
        const res = await origFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: gAuth }, body: JSON.stringify(body), credentials: 'include' });
        const text = await res.text().catch(() => '');
        if (res.ok) {
          ok++;
          let wf = '';
          let generatedNames = [];
          try {
            generatedNames = (JSON.parse(text).workflows || []).map((w) => w && w.name).filter(Boolean);
            wf = generatedNames[0] || '';
          } catch (e) {}
          // Gửi response tạo để content_script THU media id video (name có field .video)
          //   → phục vụ tải hàng loạt qua API kể cả khi làm nhiều video.
          post({ via: 'resp', kind: 'resp', respKind: 'generate', url, status: res.status, ok: true, text: text.slice(0, 20000) });
          // BÓC MEDIA ID TRỰC TIẾP từ response tạo (parse ĐẦY ĐỦ, không cắt) và gửi
          //   thẳng sang content_script — KHÔNG phụ thuộc "nghe lỏm" trang poll nữa.
          //   Trace thực tế: id nằm ở operations[].operation.name (+ media[] nếu có).
          const directVids = extractVideosFromGenerateResponse(text, wf, d.aspect);
          if (directVids.length) {
            harvestedIdCount += directVids.length;
            post({ via: 'harvestVideos', kind: 'harvestVideos', videos: directVids });
            post({ via: 'log', kind: 'log', message: `🎯 [${i + 1}] Đã bóc ${directVids.length} media id từ response tạo: ${directVids.map((v) => v.id.slice(0, 8)).join(', ')}` });
          }
          results.push({ index: i + 1, prompt: basePrompt.slice(0, 80), workflowId: wf });
          post({ via: 'log', kind: 'log', message: `✅ [${i + 1}/${items.length}] "${basePrompt.slice(0, 30)}…" ${refIds.length ? '🖼️' + refIds.length : ''} → wf ${wf.slice(0, 8)}` });
        }
        else { fail++; post({ via: 'log', kind: 'log', message: `❌ [${i + 1}] HTTP ${res.status}: ${text.slice(0, 90)}` }); }
      } catch (e) { fail++; post({ via: 'log', kind: 'log', message: `❌ [${i + 1}] lỗi: ${e.message}` }); }
      await new Promise((r) => setTimeout(r, 1500));
    }
    // LƯỚI AN TOÀN: nếu response tạo không cho id nào (Flow đổi format) → chủ động
    //   poll theo workflow một lúc để tìm media id, KHÔNG phụ thuộc trang tự poll.
    if (!harvestedIdCount && results.some((r) => r.workflowId)) {
      const wfs = results.map((r) => r.workflowId).filter(Boolean);
      post({ via: 'log', kind: 'log', message: `🔎 Chưa bóc được media id từ response tạo — poll theo ${wfs.length} workflow để tìm…` });
      pollGeneratedVideos(pid, wfs, 30, 10000); // chạy nền, content sẽ harvest từ resp poll
    }
    post({
      via: 'genResult', kind: 'genResult', bulk: true,
      ok: fail === 0,
      status: fail ? 207 : 200,
      text: `Xong: ${ok} thành công, ${fail} lỗi. Video hiện dần trong Gallery Flow.`,
      requestedCount: items.length * count,
      submittedCount: ok * count,
      harvestedIdCount,
      failedCount: fail * count,
      results,
    });
  }

  async function createAgentSession(pid) {
    if (!gAuth) return '';
    const headers = { 'Content-Type': 'application/json', Authorization: gAuth };
    try {
      const res = await origFetch('https://aisandbox-pa.googleapis.com/v1/flowCreationAgent/sessions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ projectId: `projects/${String(pid || '').replace(/^projects\//, '')}` }),
        credentials: 'include',
      });
      const text = await res.text().catch(() => '');
      let sessionId = '';
      try {
        const j = JSON.parse(text || '{}');
        sessionId = j.agentSessionId || j.sessionId || j.name || '';
      } catch (e) {}
      post({ via: 'log', kind: 'log', message: `🗂️ Flow Agent session → HTTP ${res.status}${res.ok ? ' ✅' : ' ❌'}` });
      return res.ok ? sessionId : '';
    } catch (e) {
      post({ via: 'log', kind: 'log', message: `⚠️ Flow Agent session lỗi: ${e.message}` });
      return '';
    }
  }

  function agentModelUsageKey(model, duration, hasReferences) {
    const d = duration || 8;
    if (model === 'omni_flash' || model === 'omni-flash') return `abra_${hasReferences ? 'r2v' : 't2v'}_${d}s`;
    if (model === 'fast') return hasReferences ? 'veo_3_1_r2v_fast' : `veo_3_1_t2v_fast${d !== 8 ? '_' + d + 's' : ''}`;
    return hasReferences ? 'veo_3_1_r2v_lite' : `veo_3_1_t2v_lite${d !== 8 ? '_' + d + 's' : ''}`;
  }

  async function sendAgentPrompt(pid, agentSessionId, clientSessionId, turnNumber, prompt, mediaIds, opts = {}) {
    const refs = (mediaIds || []).filter(Boolean);
    const token = await mintRecaptcha('CHAT_GENERATION');
    const body = {
      agentSessionId,
      agentClientContext: {
        projectId: `projects/${pid}`,
        clientSessionId,
        recaptchaContext: {
          token,
          applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB',
        },
        turnNumber,
      },
      userMessage: {
        userPrompt: { parts: [{ text: prompt }] },
        mediaReferences: refs.map((mediaId) => ({ mediaId })),
      },
    };
    if (refs.length) {
      body.directActionRequest = {
        generateVideoWithReferences: {
          aspectRatio: opts.aspect === 'portrait' ? 'VIDEO_ASPECT_RATIO_PORTRAIT' : 'VIDEO_ASPECT_RATIO_LANDSCAPE',
          referenceImageMediaIds: refs,
          modelUsageKey: agentModelUsageKey(opts.model || 'omni_flash', opts.duration || 8, true),
        },
      };
    }
    const headers = { Accept: 'text/event-stream', 'Content-Type': 'application/json' };
    if (gAuth) headers.Authorization = gAuth;
    return await origFetch('https://aisandbox-pa.googleapis.com/v1/flowCreationAgent:streamChat?alt=sse', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      credentials: 'include',
    });
  }

  // ---- TẠO QUA FLOW AGENT: đúng luồng thao tác tay, prompt + mediaReferences.
  async function genAgentBulk(d) {
    if (!gAuth) { post({ via: 'genResult', kind: 'genResult', agent: true, bulk: true, ok: false, status: 0, text: 'Chưa bắt được Bearer — thao tác trên Flow rồi thử lại', results: [] }); return; }
    const pid = String(d.projectId || '').replace(/^projects\//, '');
    if (!pid) { post({ via: 'genResult', kind: 'genResult', agent: true, bulk: true, ok: false, status: 0, text: 'Thiếu projectId Flow.', results: [] }); return; }
    let items = Array.isArray(d.items) ? d.items : (d.prompts || []).map((p) => ({ prompt: p, image: null }));
    items = items.filter((it) => it && String(it.prompt || '').trim());
    post({ via: 'log', kind: 'log', message: `🚀 Flow Agent nhận ${items.length} prompt${items.some((it) => it.image) ? ' + ảnh storyboard' : ''}.` });
    if (!items.length) {
      post({ via: 'genResult', kind: 'genResult', agent: true, bulk: true, ok: false, status: 0, text: 'Không có prompt hợp lệ để đẩy vào Flow Agent.', results: [] });
      return;
    }

    const createdSessionId = await createAgentSession(pid);

    const commonMediaIds = [];
    const commonImages = Array.isArray(d.characterImages) ? d.characterImages.filter((im) => im && im.data) : [];
    const tagSources = (Array.isArray(d.characterRefs) && d.characterRefs.length) ? d.characterRefs : commonImages;
    if (commonImages.length) {
      const label = d.characterMode === 'entity' ? 'ảnh sản phẩm/chung' : 'ảnh nhân vật/sản phẩm ref';
      post({ via: 'log', kind: 'log', message: `📎 Flow Agent tải ${commonImages.length} ${label}…` });
      for (const im of commonImages) {
        try {
          const id = await uploadImageToFlow(pid, im.data, im.name || 'ref.png');
          commonMediaIds.push(id);
          post({ via: 'log', kind: 'log', message: `✅ Ref "${im.name || ''}" → ${String(id).slice(0, 10)}` });
        } catch (e) {
          post({ via: 'log', kind: 'log', message: `❌ Ref "${im.name || ''}" lỗi: ${e.message}` });
        }
      }
    }

    const agentSessionId = createdSessionId || uuid4();
    const clientSessionId = ';' + Date.now();
    const repeat = Math.max(1, Math.min(4, d.count || 1));
    let ok = 0, fail = 0, turn = 1;
    const results = [];

    for (let i = 0; i < items.length; i++) {
      const basePrompt = String(items[i].prompt || '').trim();
      const tags = buildCharacterTags(basePrompt, tagSources);
      const taggedPrompt = tags ? `${tags} ${basePrompt}` : basePrompt;
      const finalPrompt = buildPrompt(taggedPrompt, d.voice);
      const itemMediaIds = commonMediaIds.slice();
      const promptImages = Array.isArray(items[i].images) && items[i].images.length
        ? items[i].images.filter((image) => image && (image.data || image.imageDataUrl))
        : (items[i].image ? [{ data: items[i].image, name: items[i].imageName || 'scene.png' }] : []);
      if (promptImages.length) {
        post({ via: 'log', kind: 'log', message: `🖼️ [${i + 1}] Upload ${promptImages.length} ảnh storyboard riêng…` });
        for (let imageIndex = 0; imageIndex < promptImages.length; imageIndex++) {
          const promptImage = promptImages[imageIndex];
          const imageName = promptImage.name || promptImage.fileName || `scene ${imageIndex + 1}.png`;
          try {
            const id = await uploadImageToFlow(pid, promptImage.data || promptImage.imageDataUrl, imageName);
            itemMediaIds.push(id);
            post({ via: 'log', kind: 'log', message: `✅ [${i + 1}] Ảnh storyboard ${imageIndex + 1}/${promptImages.length} → ${String(id).slice(0, 10)}` });
          } catch (e) {
            post({ via: 'log', kind: 'log', message: `❌ [${i + 1}] Ảnh storyboard "${imageName}" lỗi: ${e.message}` });
          }
        }
      }
      if (tags) post({ via: 'log', kind: 'log', message: `👤 [${i + 1}] Gọi nhân vật Flow: ${tags}` });

      for (let n = 0; n < repeat; n++) {
        try {
          post({ via: 'log', kind: 'log', message: `🚀 [${i + 1}/${items.length}] Đẩy prompt vào Flow Agent${itemMediaIds.length ? ' + ' + itemMediaIds.length + ' mediaReferences' : ''}…` });
          const res = await sendAgentPrompt(pid, agentSessionId, clientSessionId, turn++, finalPrompt, itemMediaIds, {
            model: d.model || 'omni_flash',
            aspect: d.aspect || 'portrait',
            duration: d.duration || 8,
          });
          const text = await res.text().catch(() => '');
          if (res.ok) {
            ok++;
            results.push({ index: i + 1, prompt: basePrompt.slice(0, 80), agent: true });
            post({ via: 'log', kind: 'log', message: `✅ [${i + 1}/${items.length}] Flow Agent HTTP ${res.status} — đã gửi tạo video${itemMediaIds.length ? ' bằng reference' : ''}.` });
          } else {
            fail++;
            post({ via: 'log', kind: 'log', message: `❌ [${i + 1}] Flow Agent HTTP ${res.status}: ${text.slice(0, 160)}` });
          }
        } catch (e) {
          fail++;
          post({ via: 'log', kind: 'log', message: `❌ [${i + 1}] Flow Agent lỗi: ${e.message}` });
        }
        await new Promise((r) => setTimeout(r, 1800));
      }
    }
    post({ via: 'genResult', kind: 'genResult', agent: true, bulk: true, ok: fail === 0, status: fail ? 207 : 200, text: `Flow Agent xong: ${ok} thành công, ${fail} lỗi.`, results });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NANO BANANA IMAGE GENERATION (M3) — endpoint/shape grounded in a real Flow
  // trace: POST /v1/projects/{pid}/flowMedia:batchGenerateImages (action
  // IMAGE_GENERATION) → media[0].name = mediaId, media[0].workflowId. Renaming
  // = PATCH /v1/flowWorkflows/{workflowId} metadata.displayName.
  // ─────────────────────────────────────────────────────────────────────────
  function imageAspectRatioKey(aspect) {
    const a = String(aspect || '');
    // Already a full Flow enum (sent from the panel's aspect dropdown) → use as-is.
    if (a.indexOf('IMAGE_ASPECT_RATIO') === 0) return a;
    // Legacy short codes.
    if (a === 'portrait' || a === '9:16') return 'IMAGE_ASPECT_RATIO_PORTRAIT';
    if (a === '1:1') return 'IMAGE_ASPECT_RATIO_SQUARE';
    return 'IMAGE_ASPECT_RATIO_LANDSCAPE';
  }

  async function batchGenerateImages(pid, opts) {
    // One attempt: mint a FRESH reCAPTCHA token, then POST. Returns {res, text}.
    const attempt = async () => {
      const token = await mintRecaptcha('IMAGE_GENERATION');
      const clientContext = {
        recaptchaContext: { token, applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB' },
        projectId: pid,
        tool: 'PINHOLE',
        sessionId: ';' + Date.now(),
      };
      const request = {
        clientContext,
        imageModelName: opts.model || 'GEM_PIX_2',
        imageAspectRatio: imageAspectRatioKey(opts.aspect),
        structuredPrompt: { parts: [{ text: String(opts.prompt || '') }] },
        seed: Math.floor(Math.random() * 1000000),
        // imageInputs: reference images fed to Nano Banana. Shape below is a best
        // guess ([{ mediaId }]) pending a ref-capture; empty array = text-only
        // (confirmed working in the trace).
        imageInputs: Array.isArray(opts.imageInputs) ? opts.imageInputs : [],
      };
      const body = {
        clientContext,
        mediaGenerationContext: { batchId: uuid4() },
        useNewMedia: true,
        requests: [request],
      };
      const url = 'https://aisandbox-pa.googleapis.com/v1/projects/' + pid + '/flowMedia:batchGenerateImages';
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: gAuth },
        body: JSON.stringify(body),
        credentials: 'include',
      }, 90000, 'batchGenerateImages');
      const text = await res.text().catch(() => '');
      return { res, text };
    };
    // reCAPTCHA WARMUP race: the FIRST image request right after the page loads
    // often comes back 403 "reCAPTCHA evaluation failed / PERMISSION_DENIED"
    // because the token was not yet valid (the log shows video/board 1 fails, then
    // the rest succeed). Re-mint a fresh token + retry a few times with backoff so
    // the FIRST board/thumbnail/sheet no longer fails on a cold token. Applies to
    // every caller (boards, sheets, thumbnail). NOT a quota error — those surface
    // as USER_QUOTA_REACHED/RESOURCE_EXHAUSTED and are handled by callers.
    let { res, text } = await attempt();
    let tries = 0;
    while (!res.ok && res.status === 403
      && /reCAPTCHA|PERMISSION_DENIED|evaluation failed/i.test(text)
      && !/USER_QUOTA_REACHED|RESOURCE_EXHAUSTED/i.test(text)
      && tries < 3) {
      tries++;
      post({ via: 'log', kind: 'log', message: `  ⏳ reCAPTCHA chưa sẵn sàng (403) — làm nóng lại token rồi thử lại lần ${tries}/3…` });
      await new Promise((r) => setTimeout(r, 1500 * tries));
      ({ res, text } = await attempt());
    }
    if (!res.ok) throw new Error('batchGenerateImages HTTP ' + res.status + ': ' + text.slice(0, 200));
    let j = {}; try { j = JSON.parse(text || '{}'); } catch (e) {}
    const media = (j.media && j.media[0]) || null;
    if (!media || !media.name) throw new Error('phản hồi không có mediaId');
    return { mediaId: media.name, workflowId: media.workflowId || (media.image && media.image.workflowId) || '', raw: j };
  }

  async function renameWorkflow(pid, workflowId, displayName) {
    if (!workflowId || !displayName) return false;
    const url = 'https://aisandbox-pa.googleapis.com/v1/flowWorkflows/' + workflowId;
    const body = {
      workflow: { name: workflowId, projectId: pid, metadata: { displayName: String(displayName) } },
      updateMask: 'metadata.displayName',
    };
    const res = await origFetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8', Authorization: gAuth },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return res.ok;
  }

  function nanoContextFrom(d) {
    return {
      projectFingerprint: String(d && d.projectFingerprint || ''),
      runId: String(d && d.runId || ''),
      generationEpoch: Number(d && d.generationEpoch) || 0,
      flowProjectId: String(d && d.flowProjectId || '').replace(/^projects\//, ''),
    };
  }

  function validNanoContext(context, pid) {
    return !!(context.projectFingerprint && context.runId && context.flowProjectId
      && String(context.flowProjectId) === String(pid));
  }

  function nanoItemMatches(item, context) {
    return !!(item && item.resultKey
      && String(item.projectFingerprint || '') === context.projectFingerprint
      && String(item.runId || '') === context.runId
      && Number(item.generationEpoch) === context.generationEpoch
      && String(item.flowProjectId || '').replace(/^projects\//, '') === context.flowProjectId);
  }

  async function genNanoImages(d) {
    const context = nanoContextFrom(d);
    const done = (results) => post({ via: 'nanoImagesDone', kind: 'nanoImagesDone', results: results || [], ...context });
    // Xác nhận lệnh ĐÃ tới trang Flow (nếu không thấy dòng này sau "Gửi N shot"
    // thì inject.js chưa nạp vào tab → F5 trang Flow sau khi cập nhật extension).
    post({ via: 'log', kind: 'log', message: `▶️ Trang Flow nhận lệnh tạo ảnh: ${Array.isArray(d.items) ? d.items.length : 0} shot · token=${gAuth ? 'có' : 'CHƯA'} · pid=${String(d.projectId || '').slice(0, 8) || 'TRỐNG'}` });
    if (!gAuth) { post({ via: 'log', kind: 'log', message: '❌ Chưa bắt được Bearer — MỞ 1 PROJECT Flow và thao tác 1 lần (tạo/bấm) rồi thử lại.' }); return done([]); }
    const pid = String(d.projectId || '').replace(/^projects\//, '');
    if (!pid) { post({ via: 'log', kind: 'log', message: '❌ Chưa có projectId — mở 1 project Flow (URL .../project/...) rồi thử lại.' }); return done([]); }
    const items = Array.isArray(d.items) ? d.items : [];
    if (!items.length) { post({ via: 'log', kind: 'log', message: '❌ Không có shot nào để tạo ảnh.' }); return done([]); }
    if (!validNanoContext(context, pid) || !items.every((item) => nanoItemMatches(item, context))) {
      post({ via: 'log', kind: 'log', message: '🛡️ Từ chối batch ảnh thiếu/sai project fingerprint, run ID, epoch hoặc Flow project ID.' });
      return done([]);
    }
    const aspect = d.aspect || 'landscape';
    const model = d.model || 'GEM_PIX_2';
    const results = [];
    // DEDUPE: mỗi ảnh ref chỉ upload MỘT lần cho cả loạt (key theo tên + độ dài
    // data). Trước đây mỗi shot upload lại Lan/Minh… → gallery ngập ảnh trùng.
    const refCache = new Map();
    const uploadRefOnce = async (r) => {
      const data = r && (r.data || r.image);
      if (!data) return '';
      const key = (r.name || 'ref') + ':' + String(data).length;
      if (refCache.has(key)) return refCache.get(key);
      const mid = await uploadImageToFlow(pid, data, (r.name || 'ref') + '.png');
      refCache.set(key, mid);
      post({ via: 'log', kind: 'log', message: `  📎 ref "${r.name || ''}" → ${String(mid).slice(0, 10)} (tải 1 lần, dùng lại cho các shot sau)` });
      return mid;
    };
    post({ via: 'log', kind: 'log', message: `🍌 Bắt đầu tạo ${items.length} ảnh Nano Banana (model ${model})…` });
    // ── WARDROBE SHEETS (theo yêu cầu user): TRƯỚC khi tạo keyframe, mỗi NHÂN
    // VẬT được tạo 1 ảnh TOÀN THÂN mặc đúng trang phục khóa theo kịch bản (dựng
    // từ ảnh nhận dạng user nạp). Sheet này THAY ảnh gốc làm ref cho mọi
    // keyframe → mặt + quần áo đồng nhất. Khi shot khai wardrobe_change, sheet
    // được tạo lại với trang phục mới và dùng từ shot đó trở đi. ──
    const sheetsOn = d.sheets !== false;
    const sceneHint = String(d.sceneHint || '').replace(/\s+/g, ' ').slice(0, 300);
    const outfitByChar = new Map();  // tên nhân vật -> trang phục hiện hành
    const sheetCache = new Map();    // tên::trang phục -> mediaId sheet
    let quotaExhausted = false;
    const isQuotaError = (m) => /USER_QUOTA_REACHED|RESOURCE_EXHAUSTED/i.test(String(m || ''));
    // Prompt JSON cho ảnh TOÀN THÂN: danh tính (mặt/tóc/vóc dáng) phải theo ĐÚNG
    // ẢNH THAM CHIẾU người dùng nạp; trang phục theo lựa chọn kịch bản. Dạng JSON
    // cho Nano Banana kết quả bám sát hơn (theo yêu cầu user).
    // 16:9 TRIPLE-VIEW character-board sheet (user request): ONE landscape image
    // with THREE framings of the SAME person in the SAME locked outfit — a sharp
    // chest-up close-up, a 3/4-turned full-body, and a 90° SIDE-PROFILE waist-up.
    // The close-up restores face fidelity, the full-body pins the complete outfit,
    // and the side profile locks the head/body silhouette for consistent turns.
    const sheetPromptFor = (name, outfit) => JSON.stringify({
      type: 'photoreal_character_board_sheet',
      layout: 'A single 16:9 landscape character reference sheet holding THREE framings of the SAME person, side by side against one continuous studio background: LEFT = a chest-up close-up, face sharp and fully lit, showing the upper garment clearly; MIDDLE = a 3/4-turned full-body, whole body from head to shoes visible, standing relaxed; RIGHT = a 90° SIDE PROFILE waist-up (a pure side view of the head and upper body, nose pointing to the side).',
      subject: name + ' — the identical individual in all three framings; same face, same outfit, same grooming in each.',
      identity_authority: 'Match the face, hair, skin and body build of the ATTACHED reference photo EXACTLY in ALL THREE framings — this is the identity source of truth; do not reinterpret, age or beautify, and keep the close-up, the full-body and the side profile unmistakably the same person.',
      wardrobe: outfit || ("one practical, concrete everyday outfit that fits this story's setting (" + sceneHint + ') — pick specific garments (top, bottom, footwear)'),
      wardrobe_rule: 'Dress the person in the wardrobe above and render the COMPLETE outfit clearly and IDENTICALLY in all three framings (same top across every framing, plus bottom and footwear on the full-body). Ignore whatever clothes appear in the reference photo — the reference photo governs only the face/identity, not the clothing.',
      background: 'plain light-grey seamless studio background, soft even lighting, no props, no text',
      render: 'Photorealistic, true-to-life skin and fabric textures, sharp focus, ultra-detailed — a real photograph.',
      negative: 'NOT cartoon, NOT anime, NOT illustration, NOT 3D render, NOT CGI, different people between framings, mismatched outfit between the framings, cut-off feet on the full-body, on-screen text, watermark',
    });
    const ensureWardrobeSheet = async (r) => {
      const name = r.name || 'character';
      if (!outfitByChar.has(name)) outfitByChar.set(name, String(r.wardrobe || '').trim());
      const outfit = outfitByChar.get(name) || '';
      const key = name + '::' + outfit;
      if (sheetCache.has(key)) return sheetCache.get(key);
      const photoId = await uploadRefOnce(r);
      if (!photoId) return '';
      try {
        post({ via: 'log', kind: 'log', message: `🧍 Tạo ảnh TOÀN THÂN nhân vật "${name}"${outfit ? ` — trang phục: ${outfit.slice(0, 60)}` : ' — trang phục theo bối cảnh'}…` });
        const g = await batchGenerateImages(pid, {
          prompt: sheetPromptFor(name, outfit),
          // 16:9 landscape so the close-up + full-body sit side by side (user request).
          aspect: 'IMAGE_ASPECT_RATIO_LANDSCAPE',
          model,
          imageInputs: [{ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: photoId }],
        });
        // Đặt tên RIÊNG BIỆT (bảng nhân vật) để KHÔNG lẫn với ảnh cảnh (keyframe)
        // hay ảnh tham chiếu ban đầu người dùng nạp ở ô nhân vật. Kèm trang phục
        // để phân biệt các lần đổi đồ.
        try { await renameWorkflow(pid, g.workflowId, `👗 BẢNG NHÂN VẬT · ${name}${outfit ? ' — ' + outfit.slice(0, 40) : ''} (mặt cận + toàn thân + nghiêng 90°, KHÔNG phải cảnh)`); } catch (e2) {}
        sheetCache.set(key, g.mediaId);
        post({ via: 'log', kind: 'log', message: `  ✅ sheet "${name}" → ${String(g.mediaId).slice(0, 10)} (dùng làm ref cho các keyframe)` });
        await new Promise((r2) => setTimeout(r2, 1200));
        return g.mediaId;
      } catch (e) {
        if (isQuotaError(e.message)) throw e; // hết quota → dừng cả loạt, xử lý ở ngoài
        post({ via: 'log', kind: 'log', message: `  ⚠️ sheet "${name}" lỗi (${e.message.slice(0, 60)}) — dùng ảnh gốc thay thế.` });
        sheetCache.set(key, photoId);
        return photoId;
      }
    };
    // ── CANONICAL LOCATION REFERENCE: mỗi địa điểm chỉ có ĐÚNG MỘT ảnh nền.
    //    Có ảnh user nạp → tải và dùng TRỰC TIẾP, tuyệt đối không tái tạo.
    //    Không có ảnh nạp → tạo đúng một ảnh toàn cảnh 16:9 từ location_views.
    //    Cùng mediaId được tái dùng cho mọi keyframe và video tại địa điểm đó. ──
    const locationSheetCache = new Map();  // location id -> [mediaId,…] (ảnh nền)
    const ensureLocationSheet = async (r) => {
      const locId = r.id || r.name || 'location';
      if (locationSheetCache.has(locId)) return locationSheetCache.get(locId);
      const views = Array.isArray(r.locationViews) ? r.locationViews : [];
      // Ảnh NGUỒN (nếu user nạp ảnh bối cảnh cho địa điểm này) → tải 1 lần rồi đính
      // làm reference cho MỌI góc để sheet tái hiện đúng nơi thật (không có thì tạo
      // từ mô tả như cũ).
      const srcData = (r.locationSourceImage || r.data || r.image || '');
      let srcMediaId = '';
      if (srcData) {
        try {
          srcMediaId = await uploadRefOnce({ id: 'locsrc_' + locId, name: (r.name || locId) + ' (ảnh nạp)', data: srcData });
          if (srcMediaId) {
            const directIds = [srcMediaId];
            locationSheetCache.set(locId, directIds);
            post({ via: 'log', kind: 'log', message: `  🖼️ dùng TRỰC TIẾP ảnh bối cảnh đã nạp "${r.name || locId}" — không tạo lại.` });
            return directIds;
          }
        } catch (e) { srcMediaId = ''; }
      }
      const ids = [];
      // New manifests contain one establishing prompt. slice(0, 1) also guards
      // older manifests from generating multiple location images.
      for (let vi = 0; vi < views.slice(0, 1).length; vi++) {
        const v = views[vi] || {};
        const angle = v.angle || 'establishing';
        const vPrompt = String(v.prompt || '').trim();
        if (!vPrompt) continue;
        try {
          post({ via: 'log', kind: 'log', message: `🏞️ Tạo MỘT ẢNH TOÀN CẢNH 16:9 "${r.name || locId}" từ mô tả…` });
          const g = await batchGenerateImages(pid, {
            prompt: vPrompt,
            aspect: 'IMAGE_ASPECT_RATIO_LANDSCAPE',
            model,
            imageInputs: [],
          });
          try { await renameWorkflow(pid, g.workflowId, `🏞️ BỐI CẢNH · ${r.name || locId} — TOÀN CẢNH 16:9 (KHÔNG nhân vật)`); } catch (e2) {}
          if (g.mediaId) ids.push(g.mediaId);
          post({ via: 'log', kind: 'log', message: `  ✅ ảnh bối cảnh chuẩn "${r.name || locId}" → ${String(g.mediaId).slice(0, 10)} (dùng khóa mọi cảnh)` });
          await new Promise((r2) => setTimeout(r2, 1200));
        } catch (e) {
          if (isQuotaError(e.message)) throw e; // hết quota → dừng cả loạt
          post({ via: 'log', kind: 'log', message: `  ⚠️ ảnh bối cảnh "${r.name || locId}" lỗi (${String(e.message).slice(0, 60)}).` });
        }
      }
      locationSheetCache.set(locId, ids);
      return ids;
    };
    // CHAINING (liên tục hoá): keyframe của shot TRƯỚC được nạp làm ref cho shot
    // SAU → cùng bộ quần áo, đầu tóc, địa điểm, đạo cụ xuyên suốt cả loạt.
    let prevKeyframeId = '';

    // TẠO TRƯỚC TOÀN BỘ SHEET NHÂN VẬT (theo yêu cầu): gom mọi nhân vật (có ảnh)
    // từ TẤT CẢ shot rồi tạo sheet cho từng người NGAY TỪ ĐẦU, trước khi dựng bất
    // kỳ board nào — tránh cảnh "xong board 1,2,3 mới tạo tiếp sheet nhân vật khác".
    // ensureWardrobeSheet có cache (sheetCache) nên vòng lặp board bên dưới TÁI DÙNG,
    // KHÔNG tạo lại → không tốn thêm quota. Lỗi 1 sheet không chặn cả loạt; đổi
    // trang phục giữa truyện vẫn tạo sheet mới đúng lúc như cũ.
    if (sheetsOn) {
      const seenChar = new Set();
      const allCharRefs = [];
      for (const itm of items) {
        for (const r of (Array.isArray(itm.refs) ? itm.refs : [])) {
          if (r && r.kind === 'characters' && (r.data || r.image)) {
            const nm = String(r.name || '').trim().toLowerCase();
            if (nm && !seenChar.has(nm)) { seenChar.add(nm); allCharRefs.push(r); }
          }
        }
      }
      if (allCharRefs.length) {
        post({ via: 'log', kind: 'log', message: `🧑‍🎨 Tạo TRƯỚC toàn bộ ${allCharRefs.length} sheet nhân vật (khóa mặt/đồ) rồi mới dựng board…` });
        for (const r of allCharRefs) {
          if (quotaExhausted) break;
          try { await ensureWardrobeSheet(r); } catch (e) {}
        }
      }
    }

    // AFFILIATE PRODUCT REFERENCES: upload every unique product image ONCE for
    // this project run, before thumbnail/boards. `uploadRefOnce` is scoped to
    // this GEN_NANO_IMAGES command, so media from another project can never leak.
    const allProductMediaIds = [];
    const seenProductRef = new Set();
    for (const itm of items) {
      for (const r of (Array.isArray(itm.refs) ? itm.refs : [])) {
        if (!(r && r.kind === 'products' && (r.data || r.image))) continue;
        const refKey = String(r.id || r.name || '') + ':' + String(r.data || r.image || '').length;
        if (seenProductRef.has(refKey)) continue;
        seenProductRef.add(refKey);
        try {
          const mid = await uploadRefOnce(r);
          if (mid && !allProductMediaIds.includes(mid)) allProductMediaIds.push(mid);
        } catch (e) {
          if (isQuotaError(e.message)) { quotaExhausted = true; break; }
          post({ via: 'log', kind: 'log', message: `  ⚠️ ảnh sản phẩm "${r.name || ''}" lỗi: ${String(e.message).slice(0, 70)}` });
        }
      }
      if (quotaExhausted) break;
    }
    if (allProductMediaIds.length) {
      post({ via: 'log', kind: 'log', message: `📦 Đã khóa ${allProductMediaIds.length} ảnh sản phẩm cho đúng project/run; sẽ ưu tiên trong thumbnail, board và video affiliate.` });
    }

    // ── THUMBNAIL TRƯỚC BOARD (theo yêu cầu user): NGAY sau khi có sheet nhân vật,
    //    tạo thumbnail (khóa mặt bằng sheet) — KHÔNG để tới cuối lúc dựng video (dễ
    //    lỗi/chen quota như user báo). Chỉ chạy khi manifest có thumbnail_prompt;
    //    lỗi được nuốt, không chặn board. "Mọi thứ tạo xong rồi mới tạo board." ──
    if (!quotaExhausted && String(d.thumbnailPrompt || '').trim()) {
      try {
        const sheetMids = Array.from(new Set(Array.from(sheetCache.values()).filter(Boolean)));
        const thumbIds = [...allProductMediaIds.slice(0, 1), ...sheetMids].slice(0, 4);
        const thumbInputs = thumbIds.map((mid) => ({ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: mid }));
        post({ via: 'log', kind: 'log', message: `🖼️ Tạo THUMBNAIL TRƯỚC board (ref order: ${allProductMediaIds.length ? 'sản phẩm → ' : ''}${sheetMids.length ? 'sheet nhân vật' : 'prompt'})…` });
        const tg = await batchGenerateImages(pid, {
          prompt: String(d.thumbnailPrompt),
          aspect: d.thumbnailAspect || 'IMAGE_ASPECT_RATIO_PORTRAIT',
          model,
          imageInputs: thumbInputs,
        });
        try { await renameWorkflow(pid, tg.workflowId, `🖼️ THUMBNAIL${d.thumbnailTitle ? ' · ' + String(d.thumbnailTitle).slice(0, 40) : ''} (bìa video, KHÔNG phải board)`); } catch (e2) {}
        post({ via: 'nanoThumbDone', kind: 'nanoThumbDone', result: { mediaId: tg.mediaId, workflowId: tg.workflowId, name: 'THUMBNAIL' } });
        post({ via: 'log', kind: 'log', message: `  ✅ thumbnail → ${String(tg.mediaId).slice(0, 12)} (tạo xong TRƯỚC board).` });
        await new Promise((r) => setTimeout(r, d.delayMs || 1500));
      } catch (e) {
        if (isQuotaError(e.message)) { quotaExhausted = true; }
        else post({ via: 'log', kind: 'log', message: `  ⚠️ thumbnail lỗi (${String(e.message).slice(0, 80)}) — bỏ qua, vẫn dựng board.` });
      }
    }

    // ── LOCATION SHEET TRƯỚC BOARD: tạo HẾT sheet bối cảnh (1 ảnh/địa điểm) TRƯỚC
    //    khi dựng board — để "mọi thứ tạo xong rồi mới tạo board". ensureLocationSheet
    //    có cache nên vòng lặp board bên dưới TÁI DÙNG, không tạo lại (không tốn quota). ──
    if (!quotaExhausted) {
      const seenLoc = new Set();
      for (const itm of items) {
        if (quotaExhausted) break;
        for (const r of (Array.isArray(itm.refs) ? itm.refs : [])) {
          if (!(r && r.kind === 'environments' && Array.isArray(r.locationViews) && r.locationViews.length)) continue;
          const locId = r.id || r.name || 'location';
          if (seenLoc.has(locId)) continue;
          seenLoc.add(locId);
          try { await ensureLocationSheet(r); }
          catch (e) { if (isQuotaError(e.message)) { quotaExhausted = true; break; } }
        }
      }
    }

    // Nhịp nghỉ TRƯỚC board đầu: reCAPTCHA đã ấm nhờ các bước trên (sheet/thumbnail),
    // thêm nghỉ để KHÔNG ép thời gian gây lỗi board đầu như user báo. batchGenerateImages
    // cũng tự retry 403 reCAPTCHA nên board đầu không còn hỏng vì token lạnh.
    if (!quotaExhausted) await new Promise((r) => setTimeout(r, (d.delayMs || 1500) + 1500));

    for (let i = 0; i < items.length; i++) {
      if (quotaExhausted) break;
      const it = items[i] || {};
      const label = it.name || ('Storyboard ' + (i + 1));
      try {
        // 0) Đổi trang phục giữa truyện: shot khai wardrobe_change = { "Tên":
        //    "outfit mới" } → cập nhật outfit hiện hành để ensureWardrobeSheet
        //    tạo LẠI ảnh toàn thân với bộ đồ mới, dùng từ shot này trở đi.
        let wardrobeChangedThisShot = false;
        if (it.wardrobeChange && typeof it.wardrobeChange === 'object') {
          Object.keys(it.wardrobeChange).forEach(function (nm) {
            const nu = String(it.wardrobeChange[nm] || '').trim();
            if (nu) { outfitByChar.set(nm, nu); wardrobeChangedThisShot = true; }
          });
        }
        // Shot này CÓ nối keyframe trước không? (dùng để bớt ref thừa bên dưới.)
        const willChain = false;
        // 1) Reference images (character → scene → product) → imageInputs.
        //    Confirmed Flow shape (from real trace):
        //    { imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: <mediaId> }.
        //    NHÂN VẬT: thay ảnh chân dung gốc bằng ẢNH TOÀN THÂN (wardrobe
        //    sheet) mặc đúng trang phục kịch bản → mặt + quần áo đồng nhất.
        //    BỐI CẢNH: khi đã nối keyframe trước, bối cảnh đã nằm TRONG keyframe
        //    đó → BỎ ảnh bối cảnh riêng để bớt số ref phải trộn (nhiều ref khác
        //    nội dung khiến Nano Banana ra ảnh "nhập nhoè" — lỗi scene 2 báo).
        const imageInputs = [];
        // mediaId các ẢNH BẢNG NHÂN VẬT (wardrobe sheet / ref nhân vật) dùng cho
        // keyframe NÀY → trả về sidepanel để bước VIDEO nạp lại cùng keyframe làm
        // reference asset (r2v), giữ mặt + trang phục khóa xuyên suốt clip.
        const shotSheetIds = [];
        // mediaId các ẢNH SHEET BỐI CẢNH (wide+alt) extension TỰ tạo cho board này →
        // trả về sidepanel để bước VIDEO nạp lại làm reference (r2v) cùng keyframe,
        // giúp Veo khóa đúng bối cảnh (không tự bịa/đổi cảnh) như user yêu cầu.
        const shotLocationSheetIds = [];
        // Product refs used by THIS board. Returned to sidepanel so Veo receives
        // the canonical product again, ahead of optional location refs.
        const shotProductIds = [];
        let shotLocationId = ''; // mediaId ảnh BỐI CẢNH user nạp → dùng cho bước video
        for (const r of (Array.isArray(it.refs) ? it.refs : [])) {
          try {
            // Bối cảnh khai location_views → TẠO SHEET BỐI CẢNH 2 góc 1 lần cho địa
            // điểm này rồi đính CẢ HAI làm ref khóa bối cảnh. CÓ ảnh nạp
            // (locationSourceImage/data) thì ensureLocationSheet dùng chính ảnh nạp
            // làm NGUỒN để quét ra sheet (không đính ảnh thô) — giống trường hợp
            // không ảnh, chỉ khác là bám ảnh thật.
            const isEnvPlate = !!(r && r.kind === 'environments'
              && Array.isArray(r.locationViews) && r.locationViews.length);
            if (isEnvPlate) {
              const plateIds = await ensureLocationSheet(r);
              plateIds.forEach(function (mid) {
                if (mid) {
                  imageInputs.push({ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: mid });
                  // Nhớ id sheet bối cảnh để bước video nạp lại làm ref (khóa cảnh).
                  if (!shotLocationSheetIds.includes(mid)) shotLocationSheetIds.push(mid);
                }
              });
              if (plateIds.length) post({ via: 'log', kind: 'log', message: `  🏞️ đính ${plateIds.length} ảnh nền "${r.name || ''}" làm ref khóa bối cảnh.` });
              continue;
            }
            const isChar = !!(r && r.kind === 'characters' && (r.data || r.image));
            const mid = (sheetsOn && isChar)
              ? await ensureWardrobeSheet(r)
              : await uploadRefOnce(r);
            if (mid) {
              imageInputs.push({ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: mid });
              if (isChar && !shotSheetIds.includes(mid)) shotSheetIds.push(mid);
              else if (r && r.kind === 'products' && !shotProductIds.includes(mid)) shotProductIds.push(mid);
              // Ảnh BỐI CẢNH user nạp (env ref có data) → nhớ mediaId cho bước video
              // làm reference SẠCH (thay board nhiều-ô — board làm Veo render lỗi).
              else if (r && r.kind === 'environments' && (r.data || r.image) && !shotLocationId) shotLocationId = mid;
            }
          } catch (e) {
            if (isQuotaError(e.message)) { quotaExhausted = true; break; }
            post({ via: 'log', kind: 'log', message: `  ❌ ref "${r && r.name || ''}" lỗi: ${e.message}` });
          }
        }
        if (quotaExhausted) break;
        // 1b) Boundary continuity is exact media reuse, not loose image guidance.
        let prompt = String(it.prompt || '');
        // Nối tiếp keyframe trước để giữ liên tục bối cảnh/đạo cụ — TRỪ shot đổi
        // A wardrobe change intentionally breaks boundary reuse so the new
        // character sheet remains the clothing authority.
        if (willChain) {
          post({ via: 'log', kind: 'log', message: `  🔗 dùng CHÍNH XÁC khung cuối cảnh trước (${String(prevKeyframeId).slice(0, 10)}) làm khung đầu cảnh này — không tạo ảnh đầu mới.` });
        } else if (prevKeyframeId && wardrobeChangedThisShot) {
          post({ via: 'log', kind: 'log', message: `  👕 shot đổi trang phục — KHÔNG nối keyframe cũ (tránh đè đồ cũ); chỉ dùng ảnh bảng nhân vật trang phục mới.` });
        }
        // 2) Generate the storyboard/keyframe image. If the reference-image
        //    shape (imageInputs) is rejected, retry text-only so the shot still
        //    produces an image instead of failing the whole batch.
        post({ via: 'log', kind: 'log', message: `🖼️ [${i + 1}/${items.length}] "${label}" — đang tạo ảnh…` });
        let g;
        try {
          g = willChain
            ? { mediaId: prevKeyframeId, workflowId: '', raw: { reusedBoundary: true } }
            : await batchGenerateImages(pid, { prompt, aspect, model, imageInputs });
        } catch (e1) {
          if (/HTTP 429/.test(e1.message)) {
            // Hết lượt tạm thời → nghỉ 30s rồi thử lại 1 lần.
            post({ via: 'log', kind: 'log', message: `  ⏳ 429 hết lượt tạm thời — nghỉ 30s rồi thử lại "${label}"…` });
            await new Promise((r2) => setTimeout(r2, 30000));
            g = await batchGenerateImages(pid, { prompt, aspect, model, imageInputs });
          } else if (imageInputs.length && /image_inputs|imageInputs|mediaId/i.test(e1.message)) {
            post({ via: 'log', kind: 'log', message: `  ⚠️ ref chưa đúng định dạng — tạo lại KHÔNG ref (text-only). Lỗi: ${e1.message.slice(0, 80)}` });
            g = await batchGenerateImages(pid, { prompt: it.prompt, aspect, model, imageInputs: [] });
          } else {
            throw e1;
          }
        }
        // DIAGNOSTIC (M3): dump the full generate response + surface the top-level
        // shape, so when an image "doesn't show in Flow" we can see whether the
        // media is PENDING, whether a workflowId came back, and what fields Flow
        // returned. Shown in the API-trace panel + log.
        try { post({ via: 'resp', kind: 'resp', respKind: 'nanoImage', url: 'flowMedia:batchGenerateImages', status: 200, ok: true, text: JSON.stringify(g.raw || {}).slice(0, 20000) }); } catch (e) {}
        try {
          const m0 = (g.raw && g.raw.media && g.raw.media[0]) || {};
          post({ via: 'log', kind: 'log', message: `  🔎 wf=${String(g.workflowId || '∅').slice(0, 14)} · media=${String(g.mediaId || '∅').slice(0, 18)} · fields=[${Object.keys(m0).join(',')}] · topKeys=[${Object.keys(g.raw || {}).join(',')}]` });
        } catch (e) {}
        // 3) Name it after the shot.
        const renamed = g.workflowId ? await renameWorkflow(pid, g.workflowId, label) : false;
        const result = { shotId: it.shotId || null, index: it.index || (i + 1), resultKey: it.resultKey, ...context, name: label, mediaId: g.mediaId, workflowId: g.workflowId, renamed: !!renamed, frameMode: 'start', sheetMediaIds: shotSheetIds.slice(), productMediaIds: shotProductIds.slice(), locationMediaId: shotLocationId, locationSheetIds: shotLocationSheetIds.slice() };
        post({ via: 'log', kind: 'log', message: willChain
          ? `  ✅ "${label}" dùng lại boundary → ${String(g.mediaId).slice(0, 12)}`
          : `  ✅ "${label}" → ${String(g.mediaId).slice(0, 12)} ${renamed ? '(đã đặt tên)' : '(⚠️ chưa đặt tên được — workflowId có thể trống)'}` });
        if (g.mediaId) prevKeyframeId = g.mediaId; // shot sau nối tiếp từ ảnh này

        // Preserve the optional legacy CLEAN frame artifact when the manifest
        // supplies one, but BOARD remains the authoritative video start frame in
        // sidepanel.js (the same hand-run behaviour as 1.8.6/1.81).
        const cleanVideoPrompt = String(it.videoKeyframePrompt || '').trim();
        if (cleanVideoPrompt) {
          try {
            post({ via: 'log', kind: 'log', message: `  🎥 "${label}" — tạo CLEAN VIDEO KEYFRAME (1 frame, không grid/caption)…` });
            const clean = await batchGenerateImages(pid, {
              prompt: cleanVideoPrompt,
              aspect: d.videoKeyframeAspect || 'IMAGE_ASPECT_RATIO_LANDSCAPE',
              model,
              imageInputs: imageInputs.slice(),
            });
            const cleanName = label + ' (video keyframe)';
            const cleanRenamed = await renameWorkflow(pid, clean.workflowId, cleanName);
            result.videoKeyframeMediaId = clean.mediaId;
            result.videoKeyframeWorkflowId = clean.workflowId;
            result.videoKeyframeRenamed = !!cleanRenamed;
            post({ via: 'log', kind: 'log', message: `  ✅ clean keyframe phụ → ${String(clean.mediaId).slice(0, 12)} (BOARD vẫn là khung đầu Veo)` });
          } catch (cleanError) {
            result.videoKeyframeError = String(cleanError && cleanError.message || cleanError);
            post({ via: 'log', kind: 'log', message: `  ⚠️ clean keyframe phụ lỗi: ${result.videoKeyframeError} — không ảnh hưởng; Veo vẫn dùng BOARD.` });
          }
        } else {
          // Manifest KHÔNG có video_keyframe_prompt riêng cho shot này. Đây KHÔNG phải
          //   lỗi và KHÔNG phải "manifest cũ": bước dựng video sẽ dùng chính ẢNH BOARD
          //   của shot làm khung đầu (board bản mới là 1 ảnh scene sạch, không phải lưới
          //   nhiều panel). Video VẪN được dựng bình thường — không hề bị giữ lại.
          post({ via: 'log', kind: 'log', message: '  🎞️ Shot không có video_keyframe_prompt riêng — dùng ảnh board làm khung đầu cho video (bình thường).' });
        }

        // 4) END keyframe: use only canonical character/product/location refs.
        //    Do not feed the start image back as a loose style reference; the
        //    structured end prompt already carries the exact boundary contract.
        const endPrompt = '';
        if (endPrompt) {
          try {
            post({ via: 'log', kind: 'log', message: `  🎞️ [${i + 1}/${items.length}] "${label}" — tạo KHUNG CUỐI…` });
            const endInputs = imageInputs.filter((input) => input && input.name !== g.mediaId);
            let endP = endPrompt;
            let ge;
            try {
              ge = await batchGenerateImages(pid, { prompt: endP, aspect, model, imageInputs: endInputs });
            } catch (e2) {
              if (/HTTP 429/.test(String(e2.message || ''))) {
                post({ via: 'log', kind: 'log', message: `  ⏳ khung cuối bị 429 — nghỉ 30s rồi thử lại "${label}"…` });
                await new Promise((r2) => setTimeout(r2, 30000));
                ge = await batchGenerateImages(pid, { prompt: endP, aspect, model, imageInputs: endInputs });
              } else if (endInputs.length && /image_inputs|imageInputs|mediaId/i.test(e2.message)) {
                ge = await batchGenerateImages(pid, { prompt: endPrompt, aspect, model, imageInputs: [] });
              } else {
                // One controlled retry preserves the same prompt and canonical
                // refs. A declared 2-frame shot must not silently degrade.
                await new Promise((r2) => setTimeout(r2, 1500));
                ge = await batchGenerateImages(pid, { prompt: endP, aspect, model, imageInputs: endInputs });
              }
            }
            const endLabel = label + ' (end)';
            const renamedEnd = await renameWorkflow(pid, ge.workflowId, endLabel);
            result.endMediaId = ge.mediaId;
            result.endWorkflowId = ge.workflowId;
            result.endRenamed = !!renamedEnd;
            if (ge.mediaId) prevKeyframeId = ge.mediaId; // trạng thái CUỐI của shot = mốc nối cho shot sau
            post({ via: 'log', kind: 'log', message: `  ✅ khung cuối "${endLabel}" → ${String(ge.mediaId).slice(0, 12)} ${renamedEnd ? '(đã đặt tên)' : ''}` });
          } catch (e2) {
            result.endError = String(e2 && e2.message || e2).slice(0, 180);
            post({ via: 'log', kind: 'log', message: `  ⚠️ khung cuối "${label}" lỗi: ${e2.message} — giữ trạng thái CẦN TẠO LẠI, không hạ xuống video 1 frame.` });
          }
          await new Promise((r) => setTimeout(r, d.delayMs || 1500));
        }
        results.push(result);
      } catch (e) {
        if (isQuotaError(e.message)) { quotaExhausted = true; break; }
        results.push({ shotId: it.shotId || null, index: it.index || (i + 1), resultKey: it.resultKey, ...context, name: label, error: e.message });
        post({ via: 'log', kind: 'log', message: `  ❌ "${label}" lỗi: ${e.message}` });
      }
      await new Promise((r) => setTimeout(r, d.delayMs || 1500));
    }
    const okN = results.filter((r) => r.mediaId).length;
    if (quotaExhausted) {
      post({ via: 'log', kind: 'log', message: `🛑 HẾT QUOTA hôm nay (Google Flow đã dùng hết lượt tạo ảnh của tài khoản). Đã tạo ${okN}/${items.length} ảnh. Hãy đợi quota reset (thường 24h) hoặc đổi tài khoản Flow rồi chạy lại — KHÔNG phải lỗi pipeline.` });
    } else {
      post({ via: 'log', kind: 'log', message: `🍌 Hoàn tất: ${okN}/${items.length} ảnh tạo được.` });
    }
    done(results);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NANO FLOW THUMBNAIL — sinh 1 ẢNH THUMBNAIL giật tít (clickbait) từ
  // project.thumbnail_prompt do app viết. Đính SHEET NHÂN VẬT (ảnh bảng nhân vật
  // đã tạo cho các board) làm reference để KHÓA mặt/nhận dạng của dàn nhân vật →
  // thumbnail đúng người. Nếu chưa có sheet (chưa tạo board) thì fallback: nạp
  // ảnh nhận dạng gốc user cung cấp làm reference. Trả về 1 mediaId ảnh thumbnail.
  // ─────────────────────────────────────────────────────────────────────────
  async function genNanoThumb(d) {
    const context = nanoContextFrom(d);
    const done = (result) => post({ via: 'nanoThumbDone', kind: 'nanoThumbDone', result: result || null, ...context });
    post({ via: 'log', kind: 'log', message: `▶️ Trang Flow nhận lệnh tạo THUMBNAIL · token=${gAuth ? 'có' : 'CHƯA'} · pid=${String(d.projectId || '').slice(0, 8) || 'TRỐNG'}` });
    if (!gAuth) { post({ via: 'log', kind: 'log', message: '❌ Chưa bắt được Bearer — MỞ 1 PROJECT Flow và thao tác 1 lần rồi thử lại.' }); return done(null); }
    const pid = String(d.projectId || '').replace(/^projects\//, '');
    if (!pid) { post({ via: 'log', kind: 'log', message: '❌ Chưa có projectId — mở 1 project Flow rồi thử lại.' }); return done(null); }
    if (!validNanoContext(context, pid)) { post({ via: 'log', kind: 'log', message: '🛡️ Từ chối thumbnail thiếu/sai khóa phiên dự án.' }); return done(null); }
    const prompt = String(d.prompt || '').trim();
    if (!prompt) { post({ via: 'log', kind: 'log', message: '❌ Manifest chưa có project.thumbnail_prompt — tạo lại kịch bản trên web (bản mới) rồi nạp lại.' }); return done(null); }
    const model = d.model || 'GEM_PIX_2';
    // Thumbnail giật tít mặc định KHỔ DỌC 9:16 (khớp video reel) — trừ khi user
    // chọn khung khác trên dropdown (d.aspect truyền xuống).
    const aspect = d.aspect || 'IMAGE_ASPECT_RATIO_PORTRAIT';

    // 1) Reference nhận dạng: ưu tiên SHEET NHÂN VẬT đã tạo (mediaId sẵn trên
    //    Flow — không tốn lượt tạo lại). Thiếu thì nạp ảnh nhận dạng gốc.
    const imageInputs = [];
    const seen = new Set();
    const productRefs = Array.isArray(d.productRefs) ? d.productRefs : [];
    for (const r of productRefs.slice(0, 1)) {
      const data = r && (r.data || r.image);
      if (!data) continue;
      try {
        const mid = await uploadImageToFlow(pid, data, (r.name || 'product') + '.png');
        if (mid && !seen.has(mid)) { seen.add(mid); imageInputs.push({ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: mid }); }
      } catch (e) { post({ via: 'log', kind: 'log', message: `  ⚠️ ref sản phẩm "${r && r.name || ''}" lỗi: ${String(e.message).slice(0, 60)}` }); }
    }
    const sheetIds = Array.isArray(d.sheetMediaIds) ? d.sheetMediaIds : [];
    sheetIds.forEach((mid) => {
      if (mid && !seen.has(mid) && imageInputs.length < 4) { seen.add(mid); imageInputs.push({ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: mid }); }
    });
    if (sheetIds.length) {
      post({ via: 'log', kind: 'log', message: `  📎 thumbnail ref order: ${productRefs.length ? 'SẢN PHẨM → ' : ''}${sheetIds.length} BẢNG NHÂN VẬT.` });
    } else {
      const refs = Array.isArray(d.characterRefs) ? d.characterRefs : [];
      for (const r of refs) {
        if (imageInputs.length >= 4) break;
        const data = r && (r.data || r.image);
        if (!data) continue;
        try {
          const mid = await uploadImageToFlow(pid, data, (r.name || 'char') + '.png');
          if (mid && !seen.has(mid)) { seen.add(mid); imageInputs.push({ imageInputType: 'IMAGE_INPUT_TYPE_REFERENCE', name: mid }); }
        } catch (e) { post({ via: 'log', kind: 'log', message: `  ⚠️ ref nhân vật "${r && r.name || ''}" lỗi: ${String(e.message).slice(0, 60)}` }); }
      }
      if (refs.length) post({ via: 'log', kind: 'log', message: `  📎 thumbnail ref order: ${productRefs.length ? 'SẢN PHẨM → ' : ''}ẢNH NHẬN DẠNG (chưa có sheet).` });
      else if (!imageInputs.length) post({ via: 'log', kind: 'log', message: '  ⚠️ KHÔNG có ref sản phẩm/nhân vật — thumbnail tạo từ prompt trần.' });
    }

    // 2) Tạo ảnh thumbnail. Nếu ref bị từ chối định dạng → tạo lại text-only để
    //    vẫn ra ảnh thay vì hỏng cả lệnh.
    post({ via: 'log', kind: 'log', message: `🖼️ Đang tạo THUMBNAIL (model ${model}, khung ${aspect.replace('IMAGE_ASPECT_RATIO_', '')})…` });
    try {
      let g;
      try {
        g = await batchGenerateImages(pid, { prompt, aspect, model, imageInputs });
      } catch (e1) {
        if (/HTTP 429/.test(e1.message)) {
          post({ via: 'log', kind: 'log', message: '  ⏳ 429 hết lượt tạm thời — nghỉ 30s rồi thử lại thumbnail…' });
          await new Promise((r2) => setTimeout(r2, 30000));
          g = await batchGenerateImages(pid, { prompt, aspect, model, imageInputs });
        } else if (imageInputs.length && /image_inputs|imageInputs|mediaId/i.test(e1.message)) {
          post({ via: 'log', kind: 'log', message: `  ⚠️ ref chưa đúng định dạng — tạo lại KHÔNG ref (text-only). Lỗi: ${e1.message.slice(0, 80)}` });
          g = await batchGenerateImages(pid, { prompt, aspect, model, imageInputs: [] });
        } else {
          throw e1;
        }
      }
      const name = `🖼️ THUMBNAIL${d.title ? ' · ' + String(d.title).slice(0, 40) : ''}`;
      const renamed = await renameWorkflow(pid, g.workflowId, name);
      post({ via: 'log', kind: 'log', message: `  ✅ THUMBNAIL → ${String(g.mediaId).slice(0, 12)} ${renamed ? '(đã đặt tên)' : ''}` });
      done({ mediaId: g.mediaId, workflowId: g.workflowId, name, ...context });
    } catch (e) {
      post({ via: 'log', kind: 'log', message: `  ❌ Tạo thumbnail lỗi: ${e.message}` });
      done(null);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NANO FLOW VIDEO GENERATION (M5) — turn each generated keyframe into a 10s
  // clip. Per DESIGN.md §6: keyframe = start frame (always); characters =
  // reference-entity (identity); environments/products OFF (already baked into
  // the keyframe). Uses the proven start_frame path (video:batchAsyncGenerate
  // VideoStartImage). If start_frame + referenceImages is rejected, we retry
  // keyframe-only so the shot still renders.
  // ─────────────────────────────────────────────────────────────────────────
  async function genNanoVideos(d) {
    const context = nanoContextFrom(d);
    const done = (results) => post({ via: 'nanoVideosDone', kind: 'nanoVideosDone', results: results || [], ...context });
    if (!gAuth) { post({ via: 'log', kind: 'log', message: '❌ Chưa bắt được Bearer — thao tác 1 lần trên Flow rồi thử lại.' }); return done([]); }
    const pid = String(d.projectId || '').replace(/^projects\//, '');
    if (!pid) { post({ via: 'log', kind: 'log', message: '❌ Chưa có projectId — mở 1 project Flow rồi thử lại.' }); return done([]); }
    const items = Array.isArray(d.items) ? d.items : [];
    if (!items.length) { post({ via: 'log', kind: 'log', message: '❌ Không có shot nào (đã tạo ảnh keyframe) để dựng video.' }); return done([]); }
    if (!validNanoContext(context, pid) || !items.every((item) => nanoItemMatches(item, context))) {
      post({ via: 'log', kind: 'log', message: '🛡️ Từ chối batch video thiếu/sai project fingerprint, run ID, epoch hoặc Flow project ID.' });
      return done([]);
    }
    const model = d.model || 'lite';
    const aspectEnum = d.aspect === 'portrait' ? 'VIDEO_ASPECT_RATIO_PORTRAIT' : 'VIDEO_ASPECT_RATIO_LANDSCAPE';
    const results = [];
    let quotaExhausted = false;
    const isQuotaError = (m) => /USER_QUOTA_REACHED|RESOURCE_EXHAUSTED/i.test(String(m || ''));
    post({ via: 'log', kind: 'log', message: `🎬 Bắt đầu dựng ${items.length} video từ keyframe (model ${model})…` });

    for (let i = 0; i < items.length; i++) {
      const it = items[i] || {};
      const label = it.name || ('Storyboard ' + (i + 1));
      const startImageMediaId = it.startImageMediaId || it.mediaId || '';
      if (!startImageMediaId) {
        results.push({ shotId: it.shotId || null, index: it.index || (i + 1), resultKey: it.resultKey, ...context, name: label, error: 'thiếu keyframe (chưa tạo ảnh)' });
        post({ via: 'log', kind: 'log', message: `  ⚠️ "${label}" bỏ qua — chưa có ảnh keyframe.` });
        continue;
      }
      try {
        // BƯỚC VIDEO — nạp ẢNH BẢNG NHÂN VẬT (wardrobe sheet) + KEYFRAME CÙNG LÚC
        // làm reference asset, ĐÚNG như Flow tự làm khi bấm tay (trace 24/7):
        //   POST video:batchAsyncGenerateVideoReferenceImages
        //   videoModelKey abra_r2v_10s
        //   referenceImages = [sheet Lan, sheet Minh, keyframe], KHÔNG có startImage
        // → mặt + BỘ ĐỒ KHÓA của TỪNG nhân vật bám chắc trong clip, thay vì trôi
        // dạt từ mỗi keyframe. Production is single-frame only; the BOARD is the
        // start image and character/location assets remain supplemental refs.
        const endImageMediaId = '';
        const refIds = Array.isArray(it.referenceMediaIds) ? it.referenceMediaIds.filter(Boolean) : [];
        // Prompt là JSON cấu trúc (bắt đầu bằng '{') → gửi NGUYÊN VẸN: khối JSON đã
        // có output_rules/negative_prompt riêng, gắn thêm text ngoài khối dễ gây
        // nhiễu/xung khắc. Prompt text thường mới qua buildPrompt.
        const promptText = /^\s*\{/.test(String(it.prompt || '')) ? String(it.prompt) : buildPrompt(it.prompt, it.voice);
        const postVideo = async (vMode, item) => {
          const token = await mintRecaptcha('VIDEO_GENERATION');
          const body = {
            mediaGenerationContext: { batchId: uuid4(), audioFailurePreference: 'BLOCK_SILENCED_VIDEOS' },
            clientContext: { projectId: pid, tool: 'PINHOLE', recaptchaContext: { applicationType: 'RECAPTCHA_APPLICATION_TYPE_WEB', token }, sessionId: uuid4(), userPaygateTier: 'PAYGATE_TIER_NOT_PAID' },
            requests: [item],
            useV2ModelConfig: true,
          };
          const url = 'https://aisandbox-pa.googleapis.com/v1/video:' + vtMethod(vMode);
          const res = await origFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: gAuth }, body: JSON.stringify(body), credentials: 'include' });
          const text = await res.text().catch(() => '');
          return { ok: res.ok, status: res.status, text };
        };
        // Reference mode accepts at most three asset images. The normal path
        // keeps BOARD as the actual startImage and attaches up to three extra
        // product/character/location refs. If that Flow route is unavailable,
        // retry r2v with BOARD + two extras (three total), then finally BOARD-only
        // with an explicit warning. Never drop refs silently.
        const refImageIds = [startImageMediaId, ...refIds.filter((id) => id && id !== startImageMediaId)].slice(0, 3);
        const sendRef = () => postVideo('reference', {
          aspectRatio: aspectEnum,
          seed: Math.floor(Math.random() * 1000000),
          metadata: {},
          textInput: { structuredPrompt: { parts: [{ text: promptText }] } },
          videoModelKey: videoModelKey('reference', model, it.durationSeconds || d.duration),
          referenceImages: refImageIds.map((id) => ({ mediaId: id, imageUsageType: 'IMAGE_USAGE_TYPE_ASSET' })),
        });
        // Đường cũ: keyframe = khung đầu (i2v). Transform shot có khung CUỐI → nội suy.
        const supplementalRefIds = refIds
          .filter((id) => id && id !== startImageMediaId && id !== endImageMediaId)
          .slice(0, 3);
        const sendStart = (includeSupplementalRefs = true) => {
          const vMode = endImageMediaId ? 'start_end_frame' : 'start_frame';
          const item = {
            aspectRatio: aspectEnum,
            seed: Math.floor(Math.random() * 1000000),
            metadata: {},
            textInput: { structuredPrompt: { parts: [{ text: promptText }] } },
            videoModelKey: videoModelKey(vMode, model, it.durationSeconds || d.duration),
            startImage: { mediaId: startImageMediaId, cropCoordinates: { top: 0, left: 0, bottom: 1, right: 1 } },
          };
          if (endImageMediaId) item.endImage = { mediaId: endImageMediaId, cropCoordinates: { top: 0, left: 0, bottom: 1, right: 1 } };
          if (includeSupplementalRefs && supplementalRefIds.length) {
            item.referenceImages = supplementalRefIds.map((id) => ({ mediaId: id, imageUsageType: 'IMAGE_USAGE_TYPE_ASSET' }));
          }
          return postVideo(vMode, item);
        };

        post({ via: 'log', kind: 'log', message: `  🔗 Gửi BOARD làm khung đầu + ${supplementalRefIds.length} ref phụ: ${supplementalRefIds.length ? supplementalRefIds.map((id) => String(id).slice(0, 8)).join(' → ') : 'không có'}.` });
        post({ via: 'log', kind: 'log', message: `🎬 [${i + 1}/${items.length}] "${label}" — dựng video một keyframe, giữ ref nhân vật/bối cảnh…` });
        let r = await sendStart(true);
        // 429 (hết lượt tạm thời) → nghỉ rồi thử lại 1 lần.
        if (!r.ok && r.status === 429) {
          post({ via: 'log', kind: 'log', message: `  ⏳ 429 hết lượt tạm thời — nghỉ 30s rồi thử lại "${label}"…` });
          await new Promise((res2) => setTimeout(res2, 30000));
          r = await sendStart(true);
        }
        if (!r.ok && supplementalRefIds.length && !isQuotaError(r.text)) {
          post({ via: 'log', kind: 'log', message: `  ↩️ Flow từ chối START+ref (HTTP ${r.status}) — thử r2v với BOARD + tối đa 2 ref, không bỏ ref âm thầm.` });
          r = await sendRef();
          if (!r.ok && r.status === 429) {
            await new Promise((res2) => setTimeout(res2, 30000));
            r = await sendRef();
          }
        }
        if (!r.ok && supplementalRefIds.length && !isQuotaError(r.text)) {
          post({ via: 'log', kind: 'log', message: `  ⚠️ Cả START+ref và r2v+ref đều bị Flow từ chối (HTTP ${r.status}); lần cuối dùng BOARD-only để không mất cả clip. Ref KHÔNG được báo là đã gửi.` });
          r = await sendStart(false);
        }
        if (!r.ok) {
          if (isQuotaError(r.text)) { quotaExhausted = true; break; }
          results.push({ shotId: it.shotId || null, index: it.index || (i + 1), resultKey: it.resultKey, ...context, name: label, error: `HTTP ${r.status}: ${r.text.slice(0, 120)}` });
          post({ via: 'log', kind: 'log', message: `  ❌ "${label}" lỗi HTTP ${r.status}: ${r.text.slice(0, 90)}` });
        } else {
          let wf = '';
          try { wf = ((JSON.parse(r.text).workflows || [])[0] || {}).name || ''; } catch (e) {}
          const vids = extractVideosFromGenerateResponse(r.text, wf, d.aspect);
          if (vids.length) { post({ via: 'harvestVideos', kind: 'harvestVideos', videos: vids }); }
          // Name the video workflow after the shot so it's findable in the gallery.
          let renamed = false;
          if (wf) { try { renamed = await renameWorkflow(pid, wf, label); } catch (e) {} }
          results.push({ shotId: it.shotId || null, index: it.index || (i + 1), resultKey: it.resultKey, ...context, name: label, workflowId: wf, videoMediaId: (vids[0] && vids[0].id) || '', renamed: !!renamed });
          post({ via: 'log', kind: 'log', message: `  ✅ "${label}" → wf ${String(wf).slice(0, 8)}${vids.length ? ' · media ' + String(vids[0].id).slice(0, 8) : ''} ${renamed ? '(đã đặt tên)' : ''}` });
        }
      } catch (e) {
        if (isQuotaError(e.message)) { quotaExhausted = true; break; }
        results.push({ shotId: it.shotId || null, index: it.index || (i + 1), resultKey: it.resultKey, ...context, name: label, error: e.message });
        post({ via: 'log', kind: 'log', message: `  ❌ "${label}" lỗi: ${e.message}` });
      }
      await new Promise((r) => setTimeout(r, d.delayMs || 1800));
    }
    const okN = results.filter((r) => r.workflowId || r.videoMediaId).length;
    if (quotaExhausted) {
      post({ via: 'log', kind: 'log', message: `🛑 HẾT QUOTA hôm nay (Google Flow đã dùng hết lượt tạo video). Đã gửi ${okN}/${items.length} video. Hãy đợi quota reset hoặc đổi tài khoản Flow — KHÔNG phải lỗi pipeline.` });
    } else {
      post({ via: 'log', kind: 'log', message: `🎬 Hoàn tất: ${okN}/${items.length} video đã gửi. Video hiện dần trong Gallery Flow.` });
    }
    done(results);
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (d && d.__afGen === true) genVideo(d);
    if (d && d.__afBulk === true) genBulk(d);
    // __afNanoImages / __afNanoVideos ĐÃ được xử lý ở bộ nghe ĐĂNG KÝ SỚM phía
    // trên (chống chết im lặng) — KHÔNG lặp lại ở đây kẻo chạy 2 lần.
    if (d && d.__afAgentBulk === true) genAgentBulk(d);
    if (d && d.__afCreateCharacters === true) createCharactersViaTemplate(d);
    if (d && d.__afAttachCharacter === true) attachCharacterViaApi(d);
    if (d && d.__afUploadCharacterRefs === true) uploadCharacterRefs(d);
    if (d && d.__afUpsampleDownload === true) upsampleDownloadBulk(d);
    if (d && d.__afWaitVideosReady === true) waitVideosReadyHandler(d);
  });

  // ---- PHÁT LẠI (replay) — chạy trong MAIN world nên có cookie + origin như trang.
  // Nếu freshRecaptcha=true và body có recaptchaContext → thay token MỚI trước khi gửi.
  window.addEventListener('message', async (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.__afReplay !== true) return;
    try {
      let body = d.body;
      // Thay Bearer TƯƠI NHẤT (nếu bắt được) để khỏi 401 do token cũ hết hạn.
      const headers = Object.assign({}, d.headers || {});
      if (gAuth) {
        for (const k in headers) { if (k.toLowerCase() === 'authorization') delete headers[k]; }
        headers['Authorization'] = gAuth;
        post({ via: 'log', kind: 'log', message: '🔐 Đã thay Bearer token tươi nhất vào request' });
      }
      if (d.freshRecaptcha && typeof body === 'string' && body.indexOf('recaptchaContext') !== -1) {
        try {
          const token = await mintRecaptcha();
          const obj = JSON.parse(body);
          if (obj.agentClientContext && obj.agentClientContext.recaptchaContext) {
            obj.agentClientContext.recaptchaContext.token = token;
            body = JSON.stringify(obj);
            post({ via: 'log', kind: 'log', message: '🔑 Đã mint reCAPTCHA MỚI và thay vào body' });
          }
        } catch (e) {
          post({ via: 'replayResult', kind: 'replayResult', ok: false, status: 0, text: 'mint reCAPTCHA lỗi: ' + e.message });
          return;
        }
      }
      const res = await origFetch(d.url, { method: 'POST', headers, body, credentials: 'include' });
      let text = '';
      try { text = (await res.text()).slice(0, 300); } catch (e) {}
      post({ via: 'replayResult', kind: 'replayResult', ok: res.ok, status: res.status, text });
    } catch (e) {
      post({ via: 'replayResult', kind: 'replayResult', ok: false, status: 0, text: 'lỗi: ' + e.message });
    }
  });

  post({ via: 'init', url: '(net hook installed)', method: '', headers: {}, body: null });
})();
