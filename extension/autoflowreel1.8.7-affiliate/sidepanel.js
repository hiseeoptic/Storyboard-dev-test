// ============================================================
// AUTO FLOW PRO v9.52 — Side Panel Logic
// Storyboard queue + Overnight auto-run
// ============================================================

let lang = 'vi';

// Lấy chuỗi theo ngôn ngữ hiện tại, fallback: lang → en → vi → key.
function t(key) {
  const cur = LANG[lang] || {};
  if (cur[key] != null) return cur[key];
  if (LANG.en && LANG.en[key] != null) return LANG.en[key];
  if (LANG.vi && LANG.vi[key] != null) return LANG.vi[key];
  return key;
}
// Đặt cả textContent lẫn title (nếu có key _title) cho 1 phần tử theo id.
function setLabel(id, key, titleKey) {
  const el = document.getElementById(id);
  if (!el) return;
  if (key) el.textContent = t(key);
  if (titleKey) el.title = t(titleKey);
}
// Ngôn ngữ kế tiếp trong vòng vi → en → fr → zh → vi.
function nextLang(cur) {
  const order = (typeof LANG_ORDER !== 'undefined') ? LANG_ORDER : ['vi', 'en'];
  const i = order.indexOf(cur);
  return order[(i + 1) % order.length];
}

let mode = 'video';
let inputMode = 'text'; // 'text' or 'storyboard'
let state = 'idle';
const DEFAULT_SETTINGS = {
  model: 'veo31-fast',
  aspect: '16:9',
  quantity: 2,
  duration: 10,
  voice: 'auto',
  delay: 10,
  autoDownload: true,
  download1080p: false, // giữ cho tương thích cấu hình cũ; nguồn chuẩn là downloadQuality
  downloadQuality: '720', // '720' | '1080' | '4k'
  autoRetry: true,
  retryDelay: 30,
  timeout: 10,
  keepAlive: false,
  autoResume: true,
  notifyDone: true,
  imageSettle: 5, // giây chờ ảnh hiện rõ trong ô prompt TRƯỚC khi bấm Tạo
  characterMode: 'ref',
  autoEntityBeforeStart: false
};
let settings = { ...DEFAULT_SETTINGS };
// g: 'm' = giọng NAM, 'f' = giọng NỮ (để gợi ý chọn đúng giới cho từng nhân vật).
const VOICE_OPTIONS = [
  { value: 'auto', name: 'Auto', g: '', vi: 'Flow tự chọn giọng phù hợp', en: 'Let Flow choose the voice', prompt: '' },
  { value: 'achernar', name: 'Achernar', g: 'f', vi: 'Nữ mềm, dịu, cảm xúc', en: 'Soft, gentle, emotional female voice', prompt: 'Use a soft, warm, gentle female voice with emotional nuance.' },
  { value: 'achird', name: 'Achird', g: 'm', vi: 'Nam thân thiện, gần gũi, tự nhiên', en: 'Friendly, natural, conversational male voice', prompt: 'Use a friendly, natural, conversational voice.' },
  { value: 'aoede', name: 'Aoede', g: 'f', vi: 'Nữ thoáng, sáng, dễ nghe', en: 'Breezy, bright, easy-listening female voice', prompt: 'Use a breezy, bright, easy-listening female voice.' },
  { value: 'puck', name: 'Puck', g: 'm', vi: 'Nam trẻ, vui, nhiều năng lượng', en: 'Upbeat, youthful, energetic male voice', prompt: 'Use an upbeat, youthful, energetic voice.' },
  { value: 'charon', name: 'Charon', g: 'm', vi: 'Nam trầm, kể chuyện rõ ràng', en: 'Deep, clear male narrator voice', prompt: 'Use a deep, clear narrator voice.' },
  { value: 'fenrir', name: 'Fenrir', g: 'm', vi: 'Nam mạnh, phấn khích, kịch tính', en: 'Bold, excited, dramatic male voice', prompt: 'Use a bold, excited, dramatic voice.' },
  { value: 'leda', name: 'Leda', g: 'f', vi: 'Nữ trẻ trung, trong, nhẹ', en: 'Youthful, clear, light female voice', prompt: 'Use a youthful, clear, light voice.' },
  { value: 'orus', name: 'Orus', g: 'm', vi: 'Nam chắc, nghiêm, rõ lệnh', en: 'Firm, serious, commanding male voice', prompt: 'Use a firm, serious, commanding voice.' },
  { value: 'sulafat', name: 'Sulafat', g: 'f', vi: 'Nữ ấm, mượt, giàu cảm xúc', en: 'Warm, smooth, expressive female voice', prompt: 'Use a warm, smooth, expressive voice.' },
  { value: 'vindemiatrix', name: 'Vindemiatrix', g: 'f', vi: 'Nữ nhẹ, dịu, tinh tế', en: 'Gentle, delicate, refined female voice', prompt: 'Use a gentle, delicate, refined voice.' }
];
let promptList = [];
let storyboardItems = []; // [{imageDataUrl, thumbnail, extraImages:[{imageDataUrl,thumbnail,fileName}], prompt, fileName, status}]

// ─── Nano Flow (M2) — imported manifest from Storyboard AI ───
// See docs/nano-flow-pipeline/DESIGN.md §5. nano_manifest.js does the parsing.
let nanoManifest = null;   // the raw manifest object (= DỰ ÁN ĐANG ACTIVE)
let nanoQueue = [];        // render-ready shot queue (NanoManifest.toQueue output)
// B2 — multi-project: nạp 4–5 dự án nano, chạy tuần tự. nanoManifest/nanoQueue luôn
// trỏ tới dự án đang active nên toàn bộ code single-project cũ chạy y nguyên.
let nanoProjects = [];     // [{ title, manifest, queue }]
let nanoActiveIndex = -1;  // vị trí dự án đang active trong nanoProjects
let nanoGenerationEpoch = 0; // tăng khi nạp/xóa/chuyển dự án; callback cũ hết hiệu lực
let nanoActiveRun = null;    // {projectFingerprint, runId, generationEpoch, flowProjectId}
let nanoRunAll = false;    // đang chạy tuần tự tất cả dự án?
let nanoRunAllKeys = [];   // danh sách slot dự án (afProjects key) có manifest để chạy
let nanoRunAllPos = 0;     // vị trí đang chạy trong nanoRunAllKeys
const NANO_MAX_PROJECTS = 6;
let nanoPipelineAuto = false; // true while the "Bắt đầu" button runs image→video as one chain
let nanoThumbnailAfterVideos = false; // thumbnail chờ tới khi video gửi xong (v1.4 fix, không chen video)
let nanoPipelineTick = 0;     // watchdog stamp; bumped when Flow responds
let currentTeachTarget = null;
let connectedTabId = null;
let aiApiKey = ''; // kept for backward compatibility
let licenseKey = '';
let licenseValid = false;
let currentProjectEntityReady = false;
let pendingCharacterEntitySetup = null;
let pendingCharacterRefSetup = null;
let preparedCharacterRefMedia = [];
let preparedCharacterEntities = [];
let pendingBulkRun = null;
let privateTabsUnlocked = false;
const LICENSE_API = 'https://member.nguyenduchoa.com/api/license/verify';
const DEMO_API = 'https://member.nguyenduchoa.com/api/demo/consume';
const TRIAL_API = 'https://member.nguyenduchoa.com/api/trial/claim';
// All teach targets (original + Omni character flow). Used to restore status.
const TEACH_TARGETS = ['settingsToggle','promptInput','submitButton','modeVideo','modeImage','modelDropdown','galleryMenu','promptPlus','addToPrompt','fileUpload','charNew','charUpload','charName','charVoice','charDone'];
// Demo (try before signup) state
let demoMode = false;
let demoRemaining = 0;
let demoLimit = 5;

function ensureNanoProjectIdentity(project) {
  if (!project || !project.manifest || !window.NanoSession) return project;
  const fingerprint = project.projectFingerprint
    || project.manifest.project_fingerprint
    || window.NanoSession.fingerprintManifest(project.manifest);
  project.projectFingerprint = fingerprint;
  project.manifest.project_fingerprint = fingerprint;
  project.queue = Array.isArray(project.queue) ? project.queue : [];
  project.queue.forEach((item) => { if (item) item.projectFingerprint = fingerprint; });
  return project;
}

function invalidateNanoRun(reason, options = {}) {
  nanoGenerationEpoch += 1;
  nanoActiveRun = null;
  nanoPipelineAuto = false;
  nanoThumbnailAfterVideos = false;
  nanoPipelineTick = Date.now();
  try { chrome.storage.local.set({ nanoGenerationEpoch, nanoActiveRun: null }); } catch (e) {}
  if (reason && !options.silent) addLog(`🛡️ Đã vô hiệu callback Nano cũ: ${reason}.`, 'info');
}

function beginNanoRun(flowProjectId) {
  if (!window.NanoSession || nanoActiveIndex < 0 || !nanoProjects[nanoActiveIndex]) return null;
  const project = ensureNanoProjectIdentity(nanoProjects[nanoActiveIndex]);
  nanoActiveRun = window.NanoSession.createRunContext({
    projectFingerprint: project.projectFingerprint,
    generationEpoch: nanoGenerationEpoch,
    flowProjectId,
  });
  project.activeRunId = nanoActiveRun.runId;
  project.flowProjectId = nanoActiveRun.flowProjectId;
  nanoQueue.forEach((item) => {
    if (!item) return;
    item.projectFingerprint = nanoActiveRun.projectFingerprint;
    item.runId = nanoActiveRun.runId;
    item.generationEpoch = nanoActiveRun.generationEpoch;
    item.flowProjectId = nanoActiveRun.flowProjectId;
    item.resultKey = window.NanoSession.resultKey(nanoActiveRun, item.shotId, item.index);
  });
  persistNanoProjects();
  return nanoActiveRun;
}

function ensureNanoRun(flowProjectId, reuseRun) {
  const activeProject = nanoActiveIndex >= 0 ? ensureNanoProjectIdentity(nanoProjects[nanoActiveIndex]) : null;
  const reusable = reuseRun
    && nanoActiveRun
    && activeProject
    && nanoActiveRun.projectFingerprint === activeProject.projectFingerprint
    && Number(nanoActiveRun.generationEpoch) === Number(nanoGenerationEpoch)
    && String(nanoActiveRun.flowProjectId) === String(flowProjectId);
  return reusable ? nanoActiveRun : beginNanoRun(flowProjectId);
}

function activeNanoEnvelope() {
  return window.NanoSession ? window.NanoSession.envelope(nanoActiveRun) : {};
}

function acceptNanoCallback(message, label) {
  const valid = !!(window.NanoSession && window.NanoSession.matches(message, nanoActiveRun));
  if (!valid) {
    addLog(`🛡️ Bỏ callback ${label || 'Nano'} cũ/sai dự án (không khớp project + run + epoch + Flow project).`, 'warning');
  }
  return valid;
}

function findNanoQueueResult(result) {
  if (!result || !nanoActiveRun || !window.NanoSession) return null;
  const expectedKey = result.resultKey || window.NanoSession.resultKey(
    nanoActiveRun,
    result.shotId,
    result.index
  );
  return nanoQueue.find((item) => item && item.resultKey === expectedKey) || null;
}

async function flowProjectIdForTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    return projectIdFromUrl(tab && tab.url || '');
  } catch (e) { return ''; }
}

// ========================
// INIT
// ========================
document.addEventListener('DOMContentLoaded', async () => {
  const saved = await chrome.storage.local.get([
    'lang', 'mode', 'inputMode', 'settings', 'prompts', 'state', 'logs',
    'storyboard', 'savedQueue', 'licenseKey'
  ]);
  if (saved.lang) lang = saved.lang;
  if (saved.mode) mode = saved.mode;
  if (saved.inputMode) inputMode = saved.inputMode;
  if (saved.settings) settings = { ...settings, ...saved.settings };
  if (saved.prompts) document.getElementById('prompt-textarea').value = saved.prompts;
  if (saved.logs) restoreLogs(saved.logs);
  if (saved.storyboard) {
    storyboardItems = normalizeStoryboardItems(saved.storyboard);
    renderStoryboard();
  }
  if (saved.licenseKey) licenseKey = saved.licenseKey;

  // Version LUÔN đọc từ manifest — không bao giờ lệch với bản đóng gói nữa.
  try {
    const _v = document.getElementById('app-version');
    if (_v) _v.textContent = 'v' + chrome.runtime.getManifest().version;
  } catch (e) { /* giữ số ghi sẵn trong HTML */ }

  renderAll();
  bindEvents();
  bindLicenseEvents();
  bindCharacterEvents();
  bindProjectEvents();
  checkConnection();
  loadMappingStatus();

  // ===== LICENSE TẠM THỜI TẮT =====
  // Bỏ qua kiểm tra license/dùng-thử trong lúc hoàn thiện phần nạp prompt. Sẽ bật
  // lại sau. Luôn coi như hợp lệ + ẩn cổng license.
  licenseValid = true;
  demoMode = false;
  const _gate = document.getElementById('license-gate');
  if (_gate) _gate.classList.add('hidden');

  // Check for saved queue to resume
  if (saved.savedQueue && saved.savedQueue.items && saved.savedQueue.items.length > 0) {
    showResumeBanner(saved.savedQueue);
  }

  // Start keep-alive if enabled
  if (settings.keepAlive) {
    startKeepAlive();
  }

  // Nếu MỞ LẠI panel trong khi CHUỖI NỀN đang chạy → khôi phục UI "đang chạy".
  chrome.runtime.sendMessage({ action: 'CHAIN_STATUS' }, (resp) => {
    if (chrome.runtime.lastError) return;
    if (resp && resp.running) {
      state = 'running';
      updateStatus();
      showRunningControls();
      addLog(`🔄 Chuỗi nền đang chạy (dự án ${(resp.index ?? 0) + 1}/${resp.total}). Panel chỉ để theo dõi — đóng lại vẫn chạy.`, 'info');
    }
  });
});

// ========================
// RENDER
// ========================
function renderAll() {
  const L = LANG[lang];

  // Header — nút ngôn ngữ hiện NGÔN NGỮ KẾ TIẾP (vi→en→fr→zh→vi).
  { const _lb = (typeof LANG_LABEL !== 'undefined' ? LANG_LABEL : {})[nextLang(lang)]; document.getElementById('btn-lang').textContent = _lb || nextLang(lang).toUpperCase(); }
  updateStatus();

  // Tabs
  document.getElementById('tab-queue-label').textContent = L.tab_queue;
  document.getElementById('tab-setup-label').textContent = L.tab_setup;
  document.getElementById('tab-settings-label').textContent = L.tab_settings;
  document.getElementById('tab-log-label').textContent = L.tab_log;
  document.getElementById('tab-veoflow-label').textContent = L.tab_veoflow || 'VeoFlow';
  const genimgLbl = document.getElementById('tab-genimg-label');
  if (genimgLbl) genimgLbl.textContent = L.tab_genimg || 'Tạo ảnh';
  const vidmergeLbl = document.getElementById('tab-vidmerge-label');
  if (vidmergeLbl) vidmergeLbl.textContent = L.tab_vidmerge || 'Cắt ghép';
  const vidmergeTitle = document.getElementById('vidmerge-title');
  if (vidmergeTitle) vidmergeTitle.textContent = L.vidmerge_title || 'Cắt ghép video';
  const vidmergeLoad = document.getElementById('vidmerge-loading-text');
  if (vidmergeLoad) vidmergeLoad.textContent = L.vidmerge_loading || 'Đang tải Video Merger...';
  const projLbl = document.getElementById('project-label');
  if (projLbl) projLbl.textContent = L.project_label || 'Dự án';
  const scriptTitleLabel = document.getElementById('script-title-label');
  if (scriptTitleLabel) scriptTitleLabel.textContent = lang === 'vi' ? 'Tên kịch bản / tên file' : 'Script title / file name';
  const scriptTitleInput = document.getElementById('script-title');
  if (scriptTitleInput) scriptTitleInput.placeholder = lang === 'vi' ? 'Ví dụ: Family' : 'Example: Family';
  const charTitle = document.getElementById('char-section-title');
  if (charTitle) charTitle.textContent = L.char_section || '👥 Nhân vật';
  const charBtn = document.getElementById('btn-load-characters');
  if (charBtn) charBtn.textContent = t('char_upload_ref_btn');
  const charEntityBtn = document.getElementById('btn-create-character-entities');
  if (charEntityBtn) charEntityBtn.textContent = t('char_entity_btn');
  const projSel = document.getElementById('project-select');
  if (projSel) Array.from(projSel.options).forEach((o) => {
    o.textContent = t('project_word') + ' ' + o.value;
  });

  // VeoFlow Guide: chỉ có bản EN/VI → fr/zh dùng bản EN.
  const guideEn = document.getElementById('vf-guide-en');
  const guideVi = document.getElementById('vf-guide-vi');
  const guideLangBtn = document.getElementById('btn-guide-lang');
  if (guideEn && guideVi) {
    guideVi.classList.toggle('hidden', lang !== 'vi');
    guideEn.classList.toggle('hidden', lang === 'vi');
  }
  if (guideLangBtn) {
    guideLangBtn.textContent = lang === 'vi' ? '🌐 VI → EN' : '🌐 EN → VI';
  }
  const vfLoadingText = document.getElementById('vf-loading-text');
  if (vfLoadingText) {
    vfLoadingText.textContent = t('vf_loading');
  }

  // DOM Guide: chỉ có bản EN/VI → fr/zh dùng bản EN.
  const domGuideEn = document.getElementById('dom-guide-en');
  const domGuideVi = document.getElementById('dom-guide-vi');
  if (domGuideEn && domGuideVi) {
    domGuideVi.classList.toggle('hidden', lang !== 'vi');
    domGuideEn.classList.toggle('hidden', lang === 'vi');
  }
  const domGuideLabel = document.getElementById('dom-guide-toggle-label');
  if (domGuideLabel) {
    domGuideLabel.textContent = t('setup_guide_label');
  }

  // Setup tab
  document.getElementById('setup-title').textContent = L.setup_title;
  document.getElementById('setup-desc').textContent = L.setup_desc;
  document.getElementById('clear-map-label').textContent = L.setup_clear;
  { const _e = document.getElementById('setup-mapped-text'); if (_e) _e.textContent = L.setup_mapped; }
  const targets = ['settingsToggle', 'promptInput', 'submitButton', 'modeVideo', 'modeImage', 'modelDropdown', 'createNew', 'galleryMenu', 'addToPrompt', 'fileUpload'];
  targets.forEach(t => {
    const nameEl = document.getElementById(`teach-${t}-name`);
    if (nameEl && L[`teach_${t}`]) nameEl.textContent = L[`teach_${t}`];
  });

  // Mode
  document.getElementById('mode-video-text').textContent = L.mode_video;
  document.getElementById('mode-image-text').textContent = L.mode_image;
  document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));

  // Input mode toggle
  document.getElementById('input-mode-text-label').textContent = L.input_mode_text;
  document.getElementById('input-mode-sb-label').textContent = L.input_mode_storyboard;
  document.querySelectorAll('[data-inputmode]').forEach(b => b.classList.toggle('active', b.dataset.inputmode === inputMode));
  document.getElementById('text-mode-section').classList.toggle('hidden', inputMode !== 'text');
  document.getElementById('storyboard-mode-section').classList.toggle('hidden', inputMode !== 'storyboard');

  // Quick settings labels
  document.getElementById('qs-model-label').textContent = L.qs_model;
  document.getElementById('qs-ratio-label').textContent = L.qs_ratio;
  document.getElementById('qs-qty-label').textContent = L.qs_qty;
  { const _d = document.getElementById('qs-duration-label'); if (_d) _d.textContent = t('qs_duration'); }
  { const _e = document.getElementById('qs-voice-label'); if (_e) _e.textContent = L.qs_voice || 'Voice'; }
  renderModelOptions();
  renderAspectOptions();
  renderVoiceOptions();
  document.getElementById('select-qty').value = String(settings.quantity);
  { const _dur = document.getElementById('select-duration'); if (_dur) _dur.value = String(settings.duration || DEFAULT_SETTINGS.duration); }

  // Prompt (text mode)
  document.getElementById('prompt-title').textContent = L.prompt_title;
  document.getElementById('prompt-textarea').placeholder = L.prompt_placeholder;
  document.getElementById('load-label').textContent = L.load_file;
  document.getElementById('paste-label').textContent = L.paste;
  document.getElementById('clear-label').textContent = L.clear;
  updatePromptCount();

  // Storyboard
  document.getElementById('sb-title').textContent = L.sb_title;
  document.getElementById('sb-desc').textContent = L.sb_desc;
  document.getElementById('sb-drop-text').innerHTML = L.sb_drop.replace('\n', '<br>');
  document.getElementById('sb-add-label').textContent = L.sb_add;
  document.getElementById('sb-import-label').textContent = L.sb_import_prompts;
  document.getElementById('sb-clear-label').textContent = L.sb_clear;
  const _sbHint = document.getElementById('sb-paste-hint');
  if (_sbHint) _sbHint.textContent = L.sb_paste_hint;
  const _sbPasteInput = document.getElementById('sb-paste-input');
  if (_sbPasteInput) _sbPasteInput.placeholder = L.sb_paste_ph;
  const _sbPasteApply = document.getElementById('sb-paste-apply-label');
  if (_sbPasteApply) _sbPasteApply.textContent = L.sb_paste_apply;

  // Queue
  document.getElementById('queue-title').textContent = L.queue_title;

  // Settings
  document.getElementById('s-delay-label').textContent = L.s_delay_label;
  document.getElementById('s-delay-desc').textContent = L.s_delay_desc;
  const _imgL = document.getElementById('s-imgsettle-label');
  if (_imgL) _imgL.textContent = t('s_imgsettle_label');
  const _imgD = document.getElementById('s-imgsettle-desc');
  if (_imgD) _imgD.textContent = t('s_imgsettle_desc');
  document.getElementById('s-download-label').textContent = L.s_download_label;
  document.getElementById('s-download-desc').textContent = L.s_download_desc;
  document.getElementById('s-retry-label').textContent = L.s_retry_label;
  document.getElementById('s-retry-desc').textContent = L.s_retry_desc;
  document.getElementById('s-retrydelay-label').textContent = L.s_retrydelay_label;
  document.getElementById('s-retrydelay-desc').textContent = L.s_retrydelay_desc;
  document.getElementById('s-timeout-label').textContent = L.s_timeout_label;
  document.getElementById('s-timeout-desc').textContent = L.s_timeout_desc;
  document.getElementById('input-delay').value = settings.delay;
  const imgSettleEl = document.getElementById('input-imgsettle');
  if (imgSettleEl) imgSettleEl.value = settings.imageSettle;
  document.getElementById('toggle-download').checked = settings.autoDownload;
  {
    // Migration: cấu hình cũ chỉ có download1080p → suy ra downloadQuality.
    if (!['720', '1080', '4k'].includes(settings.downloadQuality)) {
      settings.downloadQuality = settings.download1080p ? '1080' : '720';
    }
    const _q = document.getElementById('select-dlquality');
    if (_q) _q.value = settings.downloadQuality;
  }
  { const _l = document.getElementById('s-dlq-label'); if (_l) _l.textContent = t('s_dlq_label'); }
  { const _d = document.getElementById('s-dlq-desc'); if (_d) _d.textContent = t('s_dlq_desc'); }
  document.getElementById('toggle-retry').checked = settings.autoRetry;
  document.getElementById('input-retry-delay').value = settings.retryDelay;
  document.getElementById('input-timeout').value = settings.timeout;

  // Overnight settings
  document.getElementById('s-keepalive-label').textContent = L.s_keepalive_label;
  document.getElementById('s-keepalive-desc').textContent = L.s_keepalive_desc;
  document.getElementById('s-autoresume-label').textContent = L.s_autoresume_label;
  document.getElementById('s-autoresume-desc').textContent = L.s_autoresume_desc;
  document.getElementById('s-notify-label').textContent = L.s_notify_label;
  document.getElementById('s-notify-desc').textContent = L.s_notify_desc;
  const supTitle = document.getElementById('support-title');
  const supDesc = document.getElementById('support-desc');
  if (supTitle) supTitle.textContent = L.support_title;
  if (supDesc) supDesc.textContent = L.support_desc;
  document.getElementById('toggle-keepalive').checked = settings.keepAlive;
  document.getElementById('toggle-autoresume').checked = settings.autoResume;
  document.getElementById('toggle-notify').checked = settings.notifyDone;
  const autoEntity = document.getElementById('toggle-auto-entity');
  if (autoEntity) autoEntity.checked = !!settings.autoEntityBeforeStart;
  updateCharacterModeUI();

  // AI tab (Storyboard AI iframe)
  document.getElementById('tab-ai-label').textContent = L.tab_ai;
  // Storyboard AI iframe loading text
  const aiLoadingText = document.getElementById('ai-loading-text');
  if (aiLoadingText) {
    aiLoadingText.textContent = t('ai_loading');
  }

  // AI Guide: chỉ có bản EN/VI → fr/zh dùng bản EN.
  const aiGuideEn = document.getElementById('ai-guide-en');
  const aiGuideVi = document.getElementById('ai-guide-vi');
  const aiGuideLangBtn = document.getElementById('btn-ai-guide-lang');
  if (aiGuideEn && aiGuideVi) {
    aiGuideVi.classList.toggle('hidden', lang !== 'vi');
    aiGuideEn.classList.toggle('hidden', lang === 'vi');
  }
  if (aiGuideLangBtn) {
    aiGuideLangBtn.textContent = lang === 'vi' ? '🌐 VI → EN' : '🌐 EN → VI';
  }

  // Log
  document.getElementById('log-title').textContent = L.log_title;
  document.getElementById('progress-label').textContent = L.progress;
  // Khu vực khoá bắt-API (đa ngôn ngữ theo lựa chọn).
  { const _lt = document.getElementById('log-lock-title'); if (_lt) _lt.textContent = t('apilock_title'); }
  { const _lp = document.getElementById('log-password'); if (_lp) _lp.placeholder = t('apilock_pass'); }
  { const _ub = document.getElementById('btn-unlock-log'); if (_ub) _ub.textContent = t('apilock_unlock'); }
  { const _th = document.getElementById('trace-hint'); if (_th) _th.textContent = t('trace_hint'); }

  // Controls
  document.getElementById('start-label').textContent = L.btn_start;
  document.getElementById('pause-label').textContent = L.btn_pause;
  document.getElementById('resume-label').textContent = L.btn_resume;
  document.getElementById('stop-label').textContent = L.btn_stop;
  { const _sa = document.querySelector('#btn-start-all-projects span:not(.btn-ctrl-icon)'); if (_sa) _sa.textContent = t('btn_start_all'); }

  // Nút API nâng cao + tải video + quét UI (text + tooltip).
  setLabel('btn-gen-bulk', 'btn_gen_bulk', 'btn_gen_bulk_title');
  setLabel('btn-gen-test', 'btn_gen_test', 'btn_gen_test_title');
  setLabel('btn-dl-1080p', 'btn_dl_1080p', 'btn_dl_1080p_title');
  setLabel('btn-dl-720p', 'btn_dl_720p', 'btn_dl_720p_title');
  setLabel('btn-trace-start', 'btn_trace_start', 'btn_trace_start_title');
  setLabel('btn-trace-copy', 'btn_trace_copy', 'btn_trace_copy_title');
  setLabel('btn-trace-clear', 'btn_trace_clear', 'btn_trace_clear_title');
  setLabel('btn-copy-api', 'btn_copy_api', 'btn_copy_api_title');
  setLabel('btn-replay-api', 'btn_replay_api', 'btn_replay_api_title');
  setLabel('btn-scan-ui', 'scan_ui', 'scan_ui_title');
  { const _cm = document.getElementById('btn-clear-map'); if (_cm) _cm.title = t('clear_all_title'); }
  { const _rt = document.getElementById('results-title'); if (_rt) _rt.textContent = t('results_title'); }
  { const _sbs = document.getElementById('sb-sort-label'); if (_sbs) _sbs.textContent = t('sb_sort'); }

  // Dịch mọi phần tử tĩnh gắn data-i18n (text) và data-i18n-title (tooltip).
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.getAttribute('data-i18n-title')); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.getAttribute('data-i18n-ph')); });
  if (typeof renderProductRefs === 'function') renderProductRefs();
}

function renderModelOptions() {
  const select = document.getElementById('select-model');
  const models = mode === 'video' ? LANG[lang].video_models : LANG[lang].image_models;
  select.innerHTML = '';
  Object.entries(models).forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    if (val === settings.model) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderAspectOptions() {
  const select = document.getElementById('select-aspect');
  const aspects = mode === 'video' ? LANG[lang].aspect_video : LANG[lang].aspect_image;
  select.innerHTML = '';
  Object.entries(aspects).forEach(([val, label]) => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    if (val === settings.aspect) opt.selected = true;
    select.appendChild(opt);
  });
}

function getVoiceOption(value) {
  return VOICE_OPTIONS.find(v => v.value === value) || VOICE_OPTIONS[0];
}

function renderVoiceOptions() {
  const select = document.getElementById('select-voice');
  if (!select) return;
  select.innerHTML = '';
  VOICE_OPTIONS.forEach((voice) => {
    const opt = document.createElement('option');
    opt.value = voice.value;
    const desc = lang === 'vi' ? voice.vi : voice.en;
    opt.textContent = voice.value === 'auto' ? `Auto - ${desc}` : `${voice.name} - ${desc}`;
    if (voice.value === settings.voice) opt.selected = true;
    select.appendChild(opt);
  });
  updateVoiceDesc();
  populateCharVoiceSelects();
}

// Đổ danh sách giọng vào select RIÊNG của từng nhân vật (char1/2/3-voice), nhóm rõ
//   👨 giọng NAM / 👩 giọng NỮ để chọn đúng giới. Giữ nguyên giá trị đang chọn.
function populateCharVoiceSelects() {
  for (let n = 1; n <= 3; n++) {
    const sel = document.getElementById(`char${n}-voice`);
    if (!sel) continue;
    const keep = sel.value || 'auto';
    sel.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = 'auto';
    auto.textContent = lang === 'vi' ? '🎙️ Giọng: Auto (Flow tự chọn)' : '🎙️ Voice: Auto';
    sel.appendChild(auto);
    const groups = [
      { g: 'm', label: lang === 'vi' ? '👨 Giọng NAM (nhân vật nam)' : '👨 MALE voices' },
      { g: 'f', label: lang === 'vi' ? '👩 Giọng NỮ (nhân vật nữ)' : '👩 FEMALE voices' },
    ];
    for (const grp of groups) {
      const og = document.createElement('optgroup');
      og.label = grp.label;
      VOICE_OPTIONS.filter((v) => v.g === grp.g).forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v.value;
        opt.textContent = `${grp.g === 'm' ? '👨' : '👩'} ${v.name} — ${lang === 'vi' ? v.vi : v.en}`;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    }
    sel.value = [...sel.options].some((o) => o.value === keep) ? keep : 'auto';
  }
}

// Voice payload RIÊNG của nhân vật n (đọc select char<n>-voice); 'auto' → Flow tự chọn.
function charVoicePayloadFor(n) {
  const sel = document.getElementById(`char${n}-voice`);
  const v = getVoiceOption((sel && sel.value) || 'auto');
  return { id: v.value, name: v.name, prompt: v.prompt, description: lang === 'vi' ? v.vi : v.en };
}

function updateVoiceDesc() {
  const descEl = document.getElementById('voice-desc');
  if (!descEl) return;
  const voice = getVoiceOption(settings.voice);
  descEl.textContent = lang === 'vi'
    ? `Kiểu giọng: ${voice.vi}`
    : `Voice style: ${voice.en}`;
}

function getVoicePayload() {
  const voice = getVoiceOption(settings.voice);
  return {
    id: voice.value,
    name: voice.name,
    prompt: voice.prompt,
    description: lang === 'vi' ? voice.vi : voice.en
  };
}

// ========================
// EVENTS
// ========================
// Gửi ngôn ngữ hiện tại của extension vào app Cắt ghép (Cutflow) trong iframe.
// App lắng nghe message { source: 'CUTFLOW_EXTENSION', type: 'SET_LANG', lang }
// và đổi toàn bộ UI theo (vi/en/fr/zh).
function syncVidMergeLang() {
  const iframe = document.getElementById('vidmerge-iframe');
  if (!iframe || !iframe.contentWindow) return;
  try {
    iframe.contentWindow.postMessage({ source: 'CUTFLOW_EXTENSION', type: 'SET_LANG', lang }, '*');
  } catch (e) { /* iframe chưa sẵn sàng thì thôi, lần load sau sẽ tự sync */ }
}

function bindEvents() {
  // Language
  document.getElementById('btn-lang').addEventListener('click', () => {
    lang = nextLang(lang);
    chrome.storage.local.set({ lang });
    renderAll();
    syncVidMergeLang(); // app Cắt ghép đổi ngôn ngữ theo extension
  });

  // DOM Guide toggle (collapse/expand)
  document.getElementById('btn-dom-guide-toggle').addEventListener('click', () => {
    const content = document.getElementById('dom-guide-content');
    const arrow = document.getElementById('dom-guide-arrow');
    content.classList.toggle('collapsed');
    arrow.classList.toggle('collapsed');
  });

  // Teach buttons
  document.querySelectorAll('.btn-teach').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      if (currentTeachTarget === target) {
        cancelTeach();
        return;
      }
      startTeach(target);
    });
  });

  // Triple-click a teach row to CLEAR that one mapping (re-teach afterwards).
  document.querySelectorAll('.teach-item').forEach(item => {
    let clicks = 0, t = null;
    item.addEventListener('click', (e) => {
      if (e.target.closest('.btn-teach')) return; // ignore the Teach button itself
      clicks++;
      clearTimeout(t);
      t = setTimeout(() => { clicks = 0; }, 600);
      if (clicks >= 3) {
        clicks = 0;
        clearOneMapping(item.dataset.target);
      }
    });
  });

  // Clear all mappings
  document.getElementById('btn-clear-map').addEventListener('click', async () => {
    await sendToContent({ action: 'CLEAR_MAPPINGS' });
    chrome.storage.local.set({ elementMap: {} });
    TEACH_TARGETS.forEach(t => updateTeachStatus(t, null));
    { const _e = document.getElementById('setup-mapped-count'); if (_e) _e.textContent = '0'; }
    addLog(lang === 'vi' ? '🗑️ Đã xóa tất cả mapping' : '🗑️ All mappings cleared', 'warning');
  });

  // Diagnostic: scan the live Flow UI and copy the structure to clipboard.
  // QUÉT SAU 5 GIÂY: bấm nút này xong, panel trên trang Flow có thể TỰ ĐÓNG vì mất
  // focus — nên cho 5s để người dùng kịp MỞ panel cần quét (vd bấm dấu "+" ở ô prompt).
  document.getElementById('btn-scan-ui')?.addEventListener('click', async () => {
    const tabId = await findFlowTab();
    if (!tabId) { addLog('❌ Chưa mở trang Flow (mở tab Flow rồi thử lại)', 'error'); return; }
    // Chuyển sang tab Nhật ký để xem kết quả
    document.querySelector('.tab-btn[data-tab="log"]')?.click();
    addLog('🔍 Sẽ quét sau 5 giây — HÃY MỞ panel cần quét NGAY (vd bấm dấu "+" ở ô prompt).', 'warning');
    for (let s = 5; s >= 1; s--) {
      addLog(`   …quét sau ${s}s`, 'info');
      await new Promise(r => setTimeout(r, 1000));
    }
    chrome.tabs.sendMessage(tabId, { action: 'SCAN_UI' }, async (resp) => {
      const err = chrome.runtime.lastError;
      if (err || !resp) {
        addLog(`❌ Không quét được: ${err ? err.message : 'không có phản hồi'} — hãy F5 trang Flow rồi thử lại.`, 'error');
        return;
      }
      const report = resp.report || '(rỗng)';
      addLog('🔍 KẾT QUẢ QUÉT UI (đã copy vào clipboard):', 'info');
      report.split('\n').forEach(line => addLog(line, 'info'));
      try { await navigator.clipboard.writeText(report); addLog('📋 Đã copy báo cáo — dán gửi dev.', 'success'); } catch (e) {}
    });
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lockedTabs = ['ai', 'veoflow', 'genimg'];
      if (lockedTabs.includes(btn.dataset.tab) && !privateTabsUnlocked) {
        // Khu vực trả phí: hiển thị lời mời liên hệ Dev (theo ngôn ngữ đã chọn).
        //   Dev vẫn mở được bằng cách nhập mật khẩu vào ô này.
        const pass = prompt(`${t('locked_contact_dev')}\n${t('locked_dev_hint')}`);
        if (pass !== '0208') return;
        privateTabsUnlocked = true;
      }
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Mode (Video / Image)
  document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      settings.model = mode === 'video' ? 'veo31-fast' : 'nano-banana-2';
      settings.aspect = mode === 'video' ? '16:9' : '1:1';
      chrome.storage.local.set({ mode });
      saveSettings();
      document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      renderModelOptions();
      renderAspectOptions();
    });
  });

  // Input mode toggle (Text / Storyboard)
  document.querySelectorAll('[data-inputmode]').forEach(btn => {
    btn.addEventListener('click', () => {
      inputMode = btn.dataset.inputmode;
      chrome.storage.local.set({ inputMode });
      document.querySelectorAll('[data-inputmode]').forEach(b => b.classList.toggle('active', b.dataset.inputmode === inputMode));
      document.getElementById('text-mode-section').classList.toggle('hidden', inputMode !== 'text');
      document.getElementById('storyboard-mode-section').classList.toggle('hidden', inputMode !== 'storyboard');
      scheduleProjectSave();
    });
  });

  // Quick settings
  document.getElementById('select-model').addEventListener('change', e => { settings.model = e.target.value; saveSettings(); });
  document.getElementById('select-aspect').addEventListener('change', e => { settings.aspect = e.target.value; saveSettings(); });
  document.getElementById('select-qty').addEventListener('change', e => { settings.quantity = parseInt(e.target.value); saveSettings(); });
  document.getElementById('select-duration')?.addEventListener('change', e => {
    settings.duration = parseInt(e.target.value, 10) || DEFAULT_SETTINGS.duration;
    saveSettings();
  });
  document.getElementById('select-voice')?.addEventListener('change', e => {
    settings.voice = e.target.value;
    updateVoiceDesc();
    saveSettings();
  });
  document.getElementById('script-title')?.addEventListener('input', scheduleProjectMetadataSave);

  // Prompt (text mode)
  document.getElementById('prompt-textarea').addEventListener('input', () => {
    updatePromptCount();
    chrome.storage.local.set({ prompts: document.getElementById('prompt-textarea').value });
  });

  document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const ta = document.getElementById('prompt-textarea');
      const prompts = parsePromptFileText(ev.target.result, file.name);
      if (!prompts.length) {
        addLog(lang === 'vi' ? '⚠️ File không có prompt hợp lệ.' : '⚠️ No valid prompt found in the file.', 'warning');
        return;
      }
      const existing = splitPromptBlocks(ta.value);
      ta.value = [...existing, ...prompts].join('\n\n');
      const titleInput = document.getElementById('script-title');
      if (titleInput && !titleInput.value.trim()) titleInput.value = inferScriptTitle(ev.target.result, file.name);
      updatePromptCount();
      chrome.storage.local.set({ prompts: ta.value });
      scheduleProjectSave();
      addLog(`📄 Đã nạp ${prompts.length} prompt từ ${file.name}`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-paste').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      const ta = document.getElementById('prompt-textarea');
      ta.value = [...splitPromptBlocks(ta.value), ...splitPromptBlocks(text)].join('\n\n');
      updatePromptCount();
      chrome.storage.local.set({ prompts: ta.value });
      scheduleProjectSave();
    } catch (e) {
      addLog('Cannot access clipboard', 'error');
    }
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    document.getElementById('prompt-textarea').value = '';
    updatePromptCount();
    chrome.storage.local.set({ prompts: '' });
    scheduleProjectSave();
  });

  // ===== STORYBOARD EVENTS =====
  const dropzone = document.getElementById('sb-dropzone');
  const sbFileInput = document.getElementById('sb-file-input');

  // Click to select files
  dropzone.addEventListener('click', () => sbFileInput.click());
  sbFileInput.addEventListener('change', (e) => {
    addImagesToStoryboard(e.target.files);
    e.target.value = '';
  });

  // Drag & Drop
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
    if (files.length > 0) addImagesToStoryboard(files);
  });

  // Add more images button
  document.getElementById('sb-file-add').addEventListener('change', (e) => {
    addImagesToStoryboard(e.target.files);
    e.target.value = '';
  });

  // Import TXT to pair with images
  document.getElementById('sb-import-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const prompts = parsePromptFileText(ev.target.result, file.name);
      prompts.forEach((prompt, i) => {
        if (i < storyboardItems.length) {
          storyboardItems[i].prompt = prompt.trim();
        }
      });
      saveStoryboard();
      renderStoryboard();
      addLog(lang === 'vi'
        ? `📄 Đã ghép ${Math.min(prompts.length, storyboardItems.length)} prompt với hình`
        : `📄 Paired ${Math.min(prompts.length, storyboardItems.length)} prompts with images`, 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Paste prompts inline → auto-split & pair with images in order
  const sbPasteApplyBtn = document.getElementById('btn-sb-paste-apply');
  if (sbPasteApplyBtn) sbPasteApplyBtn.addEventListener('click', applyPastedPrompts);

  // Sort storyboard images by file name (1,2,3…)
  const sbSortBtn = document.getElementById('btn-sb-sort');
  if (sbSortBtn) sbSortBtn.addEventListener('click', sortStoryboardByName);

  // Clear storyboard
  document.getElementById('btn-sb-clear').addEventListener('click', () => {
    storyboardItems = [];
    saveStoryboard();
    renderStoryboard();
  });

  // ─── Nano Flow (M2): import manifest by file, direct push, or restore ───
  document.getElementById('nf-import-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadNanoManifest(ev.target.result, { append: false });
    reader.readAsText(file);
    e.target.value = '';
  });
  document.getElementById('nf-add-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => loadNanoManifest(ev.target.result, { append: true });
    reader.readAsText(file);
    e.target.value = '';
  });
  document.getElementById('btn-nf-dryrun')?.addEventListener('click', nanoDryRun);
  document.getElementById('btn-nf-generate')?.addEventListener('click', runNanoImages);
  document.getElementById('btn-nf-video')?.addEventListener('click', runNanoVideos);
  // Nút thumbnail riêng đã bỏ — thumbnail nay tự chạy trong luồng (maybeAutoThumbnail).
  document.getElementById('btn-nf-runall')?.addEventListener('click', runAllNanoProjects); // B2
  document.getElementById('btn-nf-clear')?.addEventListener('click', clearNanoQueue);
  chrome.runtime.onMessage.addListener((m) => {
    if (m && m.type === 'NANO_IMAGES_DONE') {
      if (!acceptNanoCallback(m, 'ảnh')) return;
      applyNanoImageResults(m.results);
      // Nút "Bắt đầu" tổng: sau khi có ảnh keyframe thì tự động dựng video.
      if (nanoPipelineAuto) {
        nanoPipelineAuto = false;
        const anyImage = nanoQueue.some((q) => q.generated && q.generated.mediaId);
        if (anyImage) {
          addLog('▶️ Ảnh xong — tự động chuyển sang dựng video…', 'info');
          setTimeout(() => runNanoVideos({ reuseRun: true }), 1000);
          // Thumbnail giờ được tạo INLINE trong bước ảnh — NGAY sau sheet nhân vật,
          // TRƯỚC board (theo yêu cầu user: "mọi thứ tạo xong rồi mới tạo board").
          // Vì vậy KHÔNG tạo lại thumbnail ở cuối lúc dựng video (tránh lỗi/chen quota).
          nanoThumbnailAfterVideos = false;
        } else {
          addLog('⚠️ Không có ảnh keyframe nào — dừng pipeline, không dựng video.', 'warning');
        }
      }
    }
    if (m && m.type === 'NANO_VIDEOS_DONE') {
      if (!acceptNanoCallback(m, 'video')) return;
      applyNanoVideoResults(m.results);
      // Thumbnail chỉ chạy SAU khi video đã gửi xong (không chen quota ảnh/video).
      if (nanoThumbnailAfterVideos) {
        nanoThumbnailAfterVideos = false;
        const submitted = Array.isArray(m.results) && m.results.some((r) => r && (r.workflowId || r.videoMediaId));
        if (submitted) {
          addLog('🖼️ Video đã gửi xong — bắt đầu thumbnail ở bước CUỐI, không chen quota ảnh/video.', 'info');
          setTimeout(() => maybeAutoThumbnail(), 1500);
        } else {
          addLog('⚠️ Tạm hoãn thumbnail vì chưa gửi được video; tránh tạo thêm request khi Flow đang lỗi/quota.', 'warning');
        }
      }
    }
    if (m && m.type === 'NANO_THUMB_DONE') {
      if (!acceptNanoCallback(m, 'thumbnail')) return;
      const r = m.result;
      if (r && r.mediaId) addLog(`🖼️ Đã tạo THUMBNAIL trên Flow → "${r.name || 'THUMBNAIL'}" (${String(r.mediaId).slice(0, 12)}). Mở gallery/dự án Flow để tải ảnh về.`, 'success');
      else addLog('⚠️ Không tạo được thumbnail — xem log lỗi ở trên.', 'warning');
    }
  });

  // Restore imported manifests (survive panel reopen). B2: multi-project.
  // MỖI DỰ ÁN 1 MANIFEST: KHÔNG khôi phục manifest từ kho nano global nữa — manifest
  //   nằm trong afProjects[curProj].nano và được nạp bởi applyProject (bindProjectEvents).
  //   Ở đây chỉ khôi phục epoch + phiên chạy (nanoActiveRun) để chống callback lạc dự án.
  chrome.storage.local.get(['nanoGenerationEpoch', 'nanoActiveRun'], (r) => {
    nanoGenerationEpoch = Number(r && r.nanoGenerationEpoch) || 0;
    nanoActiveRun = (r && r.nanoActiveRun) || null;
  });

  // Direct push from the embedded Storyboard AI app (DESIGN.md §7). Additive,
  // separate from the existing VeoFlow listener; strict origin allowlist.
  window.addEventListener('message', (event) => {
    const NF_ORIGINS = [
      'https://storyboard.aiglobal.com',
      'https://storyboard-ai-mauve.vercel.app',
      'https://hiseeoptic-storyboard-ai.vercel.app',
      'https://storyboard.nguyenduchoa.com',
      'http://localhost:3000',
    ];
    if (!NF_ORIGINS.includes(event.origin)) return;
    const d = event.data || {};
    if (d.source === 'STORYBOARD_AI' && d.type === 'PUSH_NANO_MANIFEST' && d.payload) {
      // App đẩy manifest sang = gắn vào ĐÚNG dự án đang mở (afProjects[curProj]).
      //   Mỗi dự án giữ manifest riêng; chuyển dự án sẽ đổi manifest theo.
      loadNanoManifest(d.payload);
    }
  });

  // Resume banner
  document.getElementById('btn-resume-yes').addEventListener('click', resumeSavedQueue);
  document.getElementById('btn-resume-no').addEventListener('click', discardSavedQueue);

  // Settings
  document.getElementById('input-delay').addEventListener('change', e => { settings.delay = clamp(parseInt(e.target.value) || 0, 0, 300); saveSettings(); });
  document.getElementById('input-imgsettle')?.addEventListener('change', e => { settings.imageSettle = clamp(parseInt(e.target.value) || 5, 1, 30); saveSettings(); });
  document.getElementById('toggle-download').addEventListener('change', e => { settings.autoDownload = e.target.checked; saveSettings(); });
  document.getElementById('select-dlquality')?.addEventListener('change', e => {
    settings.downloadQuality = ['720', '1080', '4k'].includes(e.target.value) ? e.target.value : '720';
    settings.download1080p = settings.downloadQuality !== '720'; // đồng bộ cờ cũ
    saveSettings();
    const label = settings.downloadQuality === '4k' ? '4K (tự upscale, nếu không hỗ trợ sẽ hạ 1080p)' : settings.downloadQuality === '1080' ? '1080p (tự upscale)' : '720p (nhanh)';
    addLog(`⬇️ Tự động tải: đã chọn ${label}.`, 'info');
  });
  document.getElementById('toggle-retry').addEventListener('change', e => { settings.autoRetry = e.target.checked; saveSettings(); });
  document.getElementById('input-retry-delay').addEventListener('change', e => { settings.retryDelay = clamp(parseInt(e.target.value) || 30, 10, 120); saveSettings(); });
  document.getElementById('input-timeout').addEventListener('change', e => { settings.timeout = clamp(parseInt(e.target.value) || 10, 3, 30); saveSettings(); });

  // Overnight settings
  document.getElementById('toggle-keepalive').addEventListener('change', e => {
    settings.keepAlive = e.target.checked;
    saveSettings();
    if (e.target.checked) {
      startKeepAlive();
      addLog(lang === 'vi' ? '🌙 Chế độ qua đêm đã bật' : '🌙 Overnight mode enabled', 'info');
    } else {
      stopKeepAlive();
      addLog(lang === 'vi' ? '☀️ Chế độ qua đêm đã tắt' : '☀️ Overnight mode disabled', 'info');
    }
  });
  document.getElementById('toggle-autoresume').addEventListener('change', e => { settings.autoResume = e.target.checked; saveSettings(); });
  document.getElementById('toggle-notify').addEventListener('change', e => { settings.notifyDone = e.target.checked; saveSettings(); });
  document.querySelectorAll('input[name="character-mode"]').forEach((el) => {
    el.addEventListener('change', (e) => {
      settings.characterMode = e.target.value === 'entity' ? 'entity' : 'ref';
      settings.autoEntityBeforeStart = settings.characterMode === 'entity';
      saveSettings();
      updateCharacterModeUI();
      addLog(settings.characterMode === 'entity'
        ? '👤 Đã chọn chế độ nhân vật entity + voice. Bắt đầu sẽ tự tạo nhân vật trước.'
        : '📎 Đã chọn chế độ ảnh ref + @Tên; bỏ qua entity/voice.',
      'info');
    });
  });
  document.getElementById('toggle-auto-entity')?.addEventListener('change', e => {
    if (settings.characterMode !== 'entity') {
      e.target.checked = false;
      settings.autoEntityBeforeStart = false;
      saveSettings();
      updateCharacterModeUI();
      addLog('📎 Chế độ ref đang bật nên không chạy bước entity/voice.', 'info');
      return;
    }
    settings.autoEntityBeforeStart = e.target.checked;
    saveSettings();
    addLog(e.target.checked ? '👤 Bật tự tạo entity trước khi Bắt đầu' : '📎 Tắt tự tạo entity, dùng ảnh ref trực tiếp', 'info');
  });
  document.getElementById('btn-unlock-log')?.addEventListener('click', unlockLogPanel);
  document.getElementById('log-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') unlockLogPanel();
  });

  // ===== STORYBOARD AI IFRAME EVENTS (AI TAB) =====
  const sbIframe = document.getElementById('storyboard-ai-iframe');
  const aiLoading = document.getElementById('ai-loading');

  // Hide loading when iframe loads
  if (sbIframe) {
    sbIframe.addEventListener('load', () => {
      if (aiLoading) aiLoading.classList.add('hidden');
    });
  }

  // AI Sub-tab: App / Guide toggle
  document.querySelectorAll('.ai-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ai-subtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.aitab;
      document.getElementById('ai-panel-app').classList.toggle('hidden', tab !== 'app');
      document.getElementById('ai-panel-guide').classList.toggle('hidden', tab !== 'guide');
      document.getElementById('ai-app-toolbar').classList.toggle('hidden', tab !== 'app');
      document.getElementById('ai-guide-toolbar').classList.toggle('hidden', tab !== 'guide');
    });
  });

  // AI Guide language toggle — syncs with main lang
  document.getElementById('btn-ai-guide-lang').addEventListener('click', () => {
    lang = nextLang(lang);
    chrome.storage.local.set({ lang });
    renderAll();
  });

  // Switch Storyboard-AI view (Analyze / Generate)
  const SB_BASE = 'https://storyboard-ai-mauve.vercel.app';
  const loadSbView = (path) => {
    if (!sbIframe) return;
    if (aiLoading) aiLoading.classList.remove('hidden');
    sbIframe.src = SB_BASE + path;
  };
  document.getElementById('btn-ai-analyze')?.addEventListener('click', () => loadSbView('/analyze'));
  document.getElementById('btn-ai-generate')?.addEventListener('click', () => loadSbView('/generate'));

  // Reload AI iframe (current view)
  document.getElementById('btn-ai-reload').addEventListener('click', () => {
    if (aiLoading) aiLoading.classList.remove('hidden');
    sbIframe.src = sbIframe.src;
  });

  // Open AI in new tab (current view)
  document.getElementById('btn-ai-open-tab').addEventListener('click', () => {
    chrome.tabs.create({ url: sbIframe?.src || (SB_BASE + '/analyze') });
  });

  // ===== GEN IMAGE (live web app via iframe) =====
  const genImgIframe = document.getElementById('genimg-iframe');
  const genImgLoading = document.getElementById('genimg-loading');
  if (genImgIframe) {
    genImgIframe.addEventListener('load', () => {
      if (genImgLoading) genImgLoading.classList.add('hidden');
    });
  }
  document.getElementById('btn-genimg-reload')?.addEventListener('click', () => {
    if (genImgLoading) genImgLoading.classList.remove('hidden');
    genImgIframe.src = genImgIframe.src;
  });
  document.getElementById('btn-genimg-open-tab')?.addEventListener('click', () => {
    chrome.tabs.create({ url: genImgIframe?.src || 'https://gen-image-wheat.vercel.app' });
  });

  // ===== VIDEO MERGER / CUTFLOW (live web app via iframe) =====
  // Iframe trỏ tới bản deploy Vercel → sửa code gốc + deploy là extension tự
  // cập nhật, không cần đóng gói lại. Nút ☁️/🖥️ chuyển sang localhost:3000
  // để dev thấy thay đổi ngay khi chạy `npm run dev`.
  const VIDMERGE_CLOUD = 'https://cutflow-video-studio.vercel.app';
  const VIDMERGE_LOCAL = 'http://localhost:3000';
  const vidMergeIframe = document.getElementById('vidmerge-iframe');
  const vidMergeLoading = document.getElementById('vidmerge-loading');
  if (vidMergeIframe) {
    vidMergeIframe.addEventListener('load', () => {
      if (vidMergeLoading) vidMergeLoading.classList.add('hidden');
      // App vừa tải xong → đồng bộ ngôn ngữ hiện tại của extension vào app.
      syncVidMergeLang();
    });
  }
  document.getElementById('btn-vidmerge-reload')?.addEventListener('click', () => {
    if (vidMergeLoading) vidMergeLoading.classList.remove('hidden');
    vidMergeIframe.src = vidMergeIframe.src;
  });
  document.getElementById('btn-vidmerge-open-tab')?.addEventListener('click', () => {
    chrome.tabs.create({ url: vidMergeIframe?.src || VIDMERGE_CLOUD });
  });
  document.getElementById('btn-vidmerge-local')?.addEventListener('click', (e) => {
    if (!vidMergeIframe) return;
    const toLocal = !vidMergeIframe.src.startsWith(VIDMERGE_LOCAL);
    if (vidMergeLoading) vidMergeLoading.classList.remove('hidden');
    vidMergeIframe.src = toLocal ? VIDMERGE_LOCAL : VIDMERGE_CLOUD;
    e.target.textContent = toLocal ? '🖥️' : '☁️';
    addLog(toLocal
      ? '🖥️ Video Merger: đang dùng bản localhost:3000 (dev)'
      : '☁️ Video Merger: đang dùng bản cloud', 'info');
  });

  // ===== VEOFLOW SUB-TAB + GUIDE EVENTS =====

  // Sub-tab: App / Guide toggle
  document.querySelectorAll('.vf-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.vf-subtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.vftab;
      document.getElementById('vf-panel-app').classList.toggle('hidden', tab !== 'app');
      document.getElementById('vf-panel-guide').classList.toggle('hidden', tab !== 'guide');
      document.getElementById('vf-app-toolbar').classList.toggle('hidden', tab !== 'app');
      document.getElementById('vf-guide-toolbar').classList.toggle('hidden', tab !== 'guide');
    });
  });

  // Guide language toggle — syncs with main lang
  document.getElementById('btn-guide-lang').addEventListener('click', () => {
    lang = nextLang(lang);
    chrome.storage.local.set({ lang });
    renderAll();
  });

  // ===== VEOFLOW IFRAME TAB EVENTS =====
  const vfIframe = document.getElementById('veoflow-iframe');
  const vfLoading = document.getElementById('vf-loading');

  // Hide loading when iframe loads
  if (vfIframe) {
    vfIframe.addEventListener('load', () => {
      if (vfLoading) vfLoading.classList.add('hidden');
    });
  }

  // Reload iframe
  document.getElementById('btn-vf-reload').addEventListener('click', () => {
    if (vfLoading) vfLoading.classList.remove('hidden');
    vfIframe.src = vfIframe.src;
  });

  // Open in new tab
  document.getElementById('btn-vf-open-tab').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://flowveo.nguyenduchoa.com/' });
  });

  // Pull prompts — ask iframe for data via postMessage
  document.getElementById('btn-vf-pull').addEventListener('click', () => {
    if (vfIframe && vfIframe.contentWindow) {
      vfIframe.contentWindow.postMessage({ type: 'AUTOFLOW_PULL_REQUEST' }, 'https://flowveo.nguyenduchoa.com');
      showToast(lang === 'vi' ? '📥 Đang lấy prompts...' : '📥 Pulling prompts...', 'info');
    }
  });

  // Listen for postMessage from VeoFlow iframe
  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://flowveo.nguyenduchoa.com') return;

    const { type, payload } = event.data || {};

    if (type === 'VEOFLOW_PUSH_TO_AUTOFLOW' && payload) {
      parseAndLoadVeoFlow(JSON.stringify(payload));
    }

    if (type === 'VEOFLOW_PULL_RESPONSE' && payload) {
      parseAndLoadVeoFlow(JSON.stringify(payload));
    }
  });

  // Log
  document.getElementById('btn-clear-log').addEventListener('click', () => {
    document.getElementById('log-container').innerHTML = '';
    chrome.storage.local.set({ logs: [] });
  });

  // TẠO HÀNG LOẠT: mỗi dòng prompt = 1 video, qua API cổ điển ổn định.
  document.getElementById('btn-gen-bulk')?.addEventListener('click', async () => {
    const tabId = await findFlowTab();
    if (!tabId) { addLog('❌ Chưa mở trang Flow', 'error'); return; }
    const textPrompts = splitPromptBlocks(document.getElementById('prompt-textarea')?.value || '');
    const sbItems = storyboardItems.filter((it) => String(it.prompt || '').trim());
    const useStoryboard = inputMode === 'storyboard' || (!textPrompts.length && sbItems.length);
    const items = useStoryboard
      ? sbItems.map(storyboardItemToPayload)
      : textPrompts.map((prompt) => ({ prompt, image: null, images: [] }));
    const prompts = items.map((it) => it.prompt);
    if (!prompts.length) { addLog('🚀 Nhập prompt trước hoặc ghép prompt cho storyboard.', 'warning'); return; }
    document.querySelector('.tab-btn[data-tab="log"]')?.click();
    const characterImages = [
      char1Img ? { data: char1Img.data, name: (document.getElementById('char1-name')?.value || 'char1').trim() } : null,
      char2Img ? { data: char2Img.data, name: (document.getElementById('char2-name')?.value || 'char2').trim() } : null,
      char3Img ? { data: char3Img.data, name: (document.getElementById('char3-name')?.value || 'char3').trim() } : null,
    ].filter((c) => c && c.data);
    const commonRefs = productRefsForPayload();
    const bulkImages = [...characterImages, ...commonRefs];
    const characterRefs = [
      char1Img ? { name: (document.getElementById('char1-name')?.value || '').trim() } : null,
      char2Img ? { name: (document.getElementById('char2-name')?.value || '').trim() } : null,
      char3Img ? { name: (document.getElementById('char3-name')?.value || '').trim() } : null,
    ].filter((c) => c && c.name);
    const characterMode = getCharacterMode();
    const sendImages = characterMode === 'entity'
      ? commonRefs
      : bulkImages;
    const MODEL_MAP = { 'omni-flash': 'omni_flash', 'veo31-lite': 'lite', 'veo31-fast': 'fast', 'veo31-quality': 'quality' };
    const apiModel = MODEL_MAP[settings.model] || 'lite';
    const apiAspect = settings.aspect === '9:16' ? 'portrait' : 'landscape';
    const apiCount = Math.max(1, Math.min(4, settings.quantity || 1));
    const apiDuration = Math.max(4, Math.min(10, settings.duration || DEFAULT_SETTINGS.duration));
    const voice = characterMode === 'entity' ? getVoicePayload() : null;
    addLog(`🚀 Đang tạo hàng loạt ${prompts.length} video${useStoryboard ? ' bằng storyboard' : ''}${sendImages.length ? ' (kèm ' + sendImages.length + ' ảnh ref)' : ''} · ${apiModel} · ${apiAspect} · ${apiDuration}s · ${apiCount}x${voice ? ' · voice ' + voice.name : ''}...`, 'info');
    const characterEntities = characterMode === 'entity' ? preparedCharacterEntities : [];
    chrome.tabs.sendMessage(tabId, { action: 'GEN_BULK', items, prompts, images: sendImages, characterRefs, characterMode, characterEntities, model: apiModel, aspect: apiAspect, duration: apiDuration, count: apiCount, voice, autoDownload: !!settings.autoDownload, downloadUpsampled: settings.downloadQuality !== '720', downloadQuality: settings.downloadQuality || '720', downloadBaseName: getScriptTitle() }, () => {
      if (chrome.runtime.lastError) addLog('❌ Không gửi được — F5 trang Flow rồi thử lại.', 'error');
    });
  });

  // Test TẠO 1 video bằng API cổ điển video:batchAsyncGenerateVideoText (giống TurboFlow).
  document.getElementById('btn-gen-test')?.addEventListener('click', async () => {
    const tabId = await findFlowTab();
    if (!tabId) { addLog('❌ Chưa mở trang Flow', 'error'); return; }
    document.querySelector('.tab-btn[data-tab="log"]')?.click();
    const prompt = splitPromptBlocks(document.getElementById('prompt-textarea')?.value || '')[0]
      || (storyboardItems.find((it) => String(it.prompt || '').trim())?.prompt || '').trim()
      || 'a cat walking in the rain, cinematic';
    addLog('🎬 Đang test tạo 1 video qua API cổ điển...', 'info');
    chrome.tabs.sendMessage(tabId, { action: 'GEN_TEST', prompt, model: 'lite', aspect: 'landscape', duration: settings.duration || DEFAULT_SETTINGS.duration, voice: getVoicePayload() }, () => {
      if (chrome.runtime.lastError) addLog('❌ Không gửi được — F5 trang Flow rồi thử lại.', 'error');
    });
  });

  const API_TEMPLATE_KEYS = [
    'afApiTemplate',
    'afGenerateReferenceTemplate',
    'afGenerateTextTemplate',
    'afGenerateStartImageTemplate',
    'afGenerateStartEndTemplate',
    'afGenerateUpsampleTemplate',
    'afGenerateOtherTemplate',
    'afUploadTemplate',
    'afUploadStoryboardTemplate',
    'afUploadCharacterEntityTemplate',
    'afSessionTemplate',
    'afPollTemplate',
    'afCharacterTemplate',
    'afPatchEntityTemplate',
    'afCharacterCandidateTemplate',
    'afLastVideoRequestSettings',
    'afLastCharFailure'
  ];

  document.getElementById('btn-dl-1080p')?.addEventListener('click', async () => {
    const tabId = await findFlowTab();
    if (!tabId) { addLog('❌ Chưa mở trang Flow', 'error'); return; }
    document.querySelector('.tab-btn[data-tab="log"]')?.click();
    const hq = settings.downloadQuality === '4k' ? '4k' : '1080';
    const hqLabel = hq === '4k' ? '4K' : '1080p';
    addLog(`⬇️ Tải ${hqLabel}: đang upsample & chờ Flow xử lý từng video (có thể mất ~1 phút/video)…`, 'info');
    chrome.tabs.sendMessage(tabId, { action: 'DOWNLOAD_GENERATED_VIDEOS_API', upsampled: true, quality: hq, downloadBaseName: getScriptTitle() }, (resp) => {
      if (chrome.runtime.lastError) { addLog(`⚠️ Lỗi gửi lệnh: ${chrome.runtime.lastError.message}`, 'warning'); return; }
      if (resp && resp.started) addLog(`⏳ Đã bắt đầu tải ${hqLabel} ${resp.count || ''} video — xem tiến trình ở nhật ký.`, 'success');
      else if (resp && !resp.success) addLog(`⚠️ ${resp.error === 'no-media-ids' ? 'Chưa thu được video nào — hãy tạo/mở video để bắt poll trước.' : (resp.error || 'không tải được')}`, 'warning');
    });
  });

  document.getElementById('btn-dl-720p')?.addEventListener('click', async () => {
    const tabId = await findFlowTab();
    if (!tabId) { addLog('❌ Chưa mở trang Flow', 'error'); return; }
    document.querySelector('.tab-btn[data-tab="log"]')?.click();
    addLog('⬇️ Tải 720p: chờ các video render xong rồi tự tải (không cần bấm lại)…', 'info');
    chrome.tabs.sendMessage(tabId, { action: 'DOWNLOAD_GENERATED_VIDEOS_API', upsampled: false, downloadBaseName: getScriptTitle() }, (resp) => {
      if (chrome.runtime.lastError) { addLog(`⚠️ Lỗi gửi lệnh: ${chrome.runtime.lastError.message}`, 'warning'); return; }
      if (resp && resp.success) addLog(`⬇️ Đã tải ${resp.okCount || 0}/${resp.total || 0} video 720p ✅`, 'success');
      else if (resp && resp.error === 'not-ready') addLog('⏳ Video chưa render xong sau thời gian chờ — bấm lại khi video đã xong.', 'warning');
      else if (resp && !resp.success) addLog(`⚠️ ${resp.error === 'no-media-ids' ? 'Chưa thu được video nào — hãy tạo/mở video trước.' : (resp.error || 'không tải được')}`, 'warning');
    });
  });

  document.getElementById('btn-trace-start')?.addEventListener('click', async () => {
    const tabId = await findFlowTab();
    if (!tabId) { addLog('❌ Chưa mở trang Flow', 'error'); return; }
    await chrome.storage.local.remove(API_TEMPLATE_KEYS);
    await chrome.storage.local.set({ afTraceRecording: true, afApiTrace: [], afBgApiTrace: [], afCdpApiTrace: [] });
    chrome.runtime.sendMessage({ action: 'TRACE_BG_CONTROL', recording: true, clear: true }, () => {});
    chrome.runtime.sendMessage({ action: 'TRACE_CDP_CONTROL', recording: true, clear: true, tabId }, (resp) => {
      if (chrome.runtime.lastError || !resp?.success) {
        addLog(`⚠️ Không bật được GHI SÂU/CDP: ${chrome.runtime.lastError?.message || resp?.error || 'không rõ lỗi'}. Vẫn ghi bằng hook trang + webRequest.`, 'warning');
      } else {
        addLog('🧲 Đã bật GHI SÂU/CDP cho tab Flow hiện tại (giống Network DevTools).', 'success');
      }
    });
    document.querySelector('.tab-btn[data-tab="log"]')?.click();
    addLog('⏺️ Đã bật GHI API. Bây giờ bạn thao tác tay trong Flow; xong bấm 📋 COPY TRACE.', 'success');
    chrome.tabs.sendMessage(tabId, { action: 'TRACE_CONTROL', recording: true, clear: true }, () => {
      if (chrome.runtime.lastError) addLog('⚠️ Chưa gửi được lệnh ghi sang Flow — F5 trang Flow rồi bấm GHI API lại.', 'warning');
    });
  });

  document.getElementById('btn-trace-clear')?.addEventListener('click', async () => {
    const tabId = await findFlowTab();
    await chrome.storage.local.remove(API_TEMPLATE_KEYS);
    await chrome.storage.local.set({ afTraceRecording: false, afApiTrace: [], afBgApiTrace: [], afCdpApiTrace: [] });
    chrome.runtime.sendMessage({ action: 'TRACE_BG_CONTROL', recording: false, clear: true }, () => {});
    chrome.runtime.sendMessage({ action: 'TRACE_CDP_CONTROL', recording: false, clear: true }, () => {});
    addLog('🧹 Đã xoá trace API.', 'success');
    if (tabId) chrome.tabs.sendMessage(tabId, { action: 'TRACE_CONTROL', recording: false, clear: true }, () => {});
  });

  document.getElementById('btn-trace-copy')?.addEventListener('click', async () => {
    const tabId = await findFlowTab();
    await chrome.storage.local.set({ afTraceRecording: false });
    chrome.runtime.sendMessage({ action: 'TRACE_BG_CONTROL', recording: false }, () => {});
    chrome.runtime.sendMessage({ action: 'TRACE_CDP_CONTROL', recording: false }, () => {});
    if (tabId) chrome.tabs.sendMessage(tabId, { action: 'TRACE_CONTROL', recording: false }, () => {});
    const store = await chrome.storage.local.get(['afApiTrace', 'afBgApiTrace', 'afCdpApiTrace']);
    const pageTrace = Array.isArray(store.afApiTrace) ? store.afApiTrace : [];
    const backgroundTrace = Array.isArray(store.afBgApiTrace) ? store.afBgApiTrace : [];
    const cdpTrace = Array.isArray(store.afCdpApiTrace) ? store.afCdpApiTrace : [];
    const trace = [...pageTrace, ...backgroundTrace, ...cdpTrace].sort((a, b) => (a.at || 0) - (b.at || 0));
    if (!trace.length) {
      addLog('⚠️ Chưa có trace API. Bấm ⏺️ GHI API rồi thao tác tay trong Flow trước.', 'warning');
      return;
    }
    const text = '=== AUTOFLOW: TRACE API THEO THAO TÁC (token đã che) ===\n' + JSON.stringify({
      capturedAt: new Date().toLocaleString(),
      count: trace.length,
      pageTraceCount: pageTrace.length,
      backgroundTraceCount: backgroundTrace.length,
      deepTraceCount: cdpTrace.length,
      trace
    }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      addLog(`📋 Đã COPY TRACE API (${trace.length} dòng: trang ${pageTrace.length}, nền ${backgroundTrace.length}, sâu ${cdpTrace.length}) — dán gửi dev.`, 'success');
    } catch (e) {
      addLog('Không copy được clipboard, in trace ra Nhật ký:', 'warning');
      text.split('\n').forEach(line => addLog(line, 'info'));
    }
  });

  // Test phát lại nguyên văn request API đã bắt (kiểm tra token còn dùng được không).
  document.getElementById('btn-replay-api')?.addEventListener('click', async () => {
    const tabId = await findFlowTab();
    if (!tabId) { addLog('❌ Chưa mở trang Flow', 'error'); return; }
    document.querySelector('.tab-btn[data-tab="log"]')?.click();
    addLog('🧪 Đang test phát lại API (xem kết quả HTTP bên dưới)...', 'info');
    chrome.tabs.sendMessage(tabId, { action: 'REPLAY_API_TEST' }, () => {
      if (chrome.runtime.lastError) addLog('❌ Không gửi được — F5 trang Flow rồi thử lại.', 'error');
    });
  });

  // Sao chép request API Flow đã bắt (che token/cookie) → gửi dev để viết phần phát lại.
  document.getElementById('btn-copy-api')?.addEventListener('click', async () => {
    const store = await chrome.storage.local.get([...API_TEMPLATE_KEYS, 'afCharacterTrace', 'afApiTrace', 'afBgApiTrace', 'afCdpApiTrace']);
    const redact = (t) => {
      if (!t || !t.url) return null;
      const safeHeaders = {};
      for (const k in (t.headers || {})) {
        const lk = k.toLowerCase();
        safeHeaders[k] = /authorization|cookie|api-?key|token|sapisid|secret|auth/.test(lk) ? '***ĐÃ CHE***' : t.headers[k];
      }
      return {
        url: t.url, bodyType: t.bodyType, via: t.via,
        capturedAt: new Date(t.at || Date.now()).toLocaleString(),
        headers: safeHeaders,
        body: t.body || '(payload không phải chuỗi)'
      };
    };
    const out = {
      generate: redact(store.afApiTemplate),
      upload: redact(store.afUploadTemplate),
      session: redact(store.afSessionTemplate),
      character: redact(store.afCharacterTemplate),
      characterCandidate: redact(store.afCharacterCandidateTemplate),
      templates: {
        generateReference: redact(store.afGenerateReferenceTemplate),
        generateText: redact(store.afGenerateTextTemplate),
        generateStartImage: redact(store.afGenerateStartImageTemplate),
        generateStartEnd: redact(store.afGenerateStartEndTemplate),
        generateUpsample: redact(store.afGenerateUpsampleTemplate),
        generateOther: redact(store.afGenerateOtherTemplate),
        uploadStoryboard: redact(store.afUploadStoryboardTemplate),
        uploadCharacterEntity: redact(store.afUploadCharacterEntityTemplate),
        patchEntity: redact(store.afPatchEntityTemplate),
        poll: redact(store.afPollTemplate)
      },
      lastVideoSettings: store.afLastVideoRequestSettings || null,
      lastCharacterFailure: store.afLastCharFailure || null,
      characterTrace: Array.isArray(store.afCharacterTrace) ? store.afCharacterTrace.slice(-80) : [],
      apiTrace: Array.isArray(store.afApiTrace) ? store.afApiTrace.slice(-160) : [],
      backgroundApiTrace: Array.isArray(store.afBgApiTrace) ? store.afBgApiTrace.slice(-160) : [],
      deepApiTrace: Array.isArray(store.afCdpApiTrace) ? store.afCdpApiTrace.slice(-180) : []
    };
    const templateCount = Object.values(out.templates).filter(Boolean).length;
    if (!out.generate && !out.upload && !out.session && !out.character && !out.characterCandidate && !templateCount && !out.lastVideoSettings && !out.lastCharacterFailure && !out.characterTrace.length && !out.apiTrace.length && !out.backgroundApiTrace.length && !out.deepApiTrace.length) {
      addLog('⚠️ Chưa bắt được API nào. Hãy TẠO 1 video trên Flow (side panel đang mở), rồi bấm lại.', 'warning');
      return;
    }
    const text = '=== AUTOFLOW: API FLOW ĐÃ BẮT (token đã che) ===\n' + JSON.stringify(out, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      addLog(`📋 Đã COPY API đã bắt vào clipboard (tạo:${out.generate ? '✓' : '✗'} mẫu:${templateCount} setting:${out.lastVideoSettings ? '✓' : '✗'} ảnh:${out.upload ? '✓' : '✗'} session:${out.session ? '✓' : '✗'} nhân-vật:${out.character ? '✓' : '✗'} trace:${out.characterTrace.length} apiTrace:${out.apiTrace.length}+${out.backgroundApiTrace.length}+${out.deepApiTrace.length}) — dán gửi dev.`, 'success');
    } catch (e) {
      addLog('Không copy được clipboard, in ra Nhật ký:', 'warning');
      text.split('\n').forEach(line => addLog(line, 'info'));
    }
  });

  // Controls
  document.getElementById('btn-start').addEventListener('click', () => {
    // Đã nạp manifest Nano Flow → nút "Bắt đầu" chạy pipeline Nano (ảnh→video),
    // không cần prompt hàng đợi thường. Muốn dùng luồng thường: bấm 🗑️ Xóa manifest.
    if (nanoQueue.length) { runNanoPipeline(); return; }
    startQueue();
  });
  document.getElementById('btn-start-all-projects')?.addEventListener('click', startAllProjectsBackground);
  document.getElementById('btn-pause').addEventListener('click', pauseQueue);
  document.getElementById('btn-resume').addEventListener('click', resumeQueue);
  document.getElementById('btn-stop').addEventListener('click', stopQueue);

  // Messages from content script
  chrome.runtime.onMessage.addListener(handleMessage);
}

// ========================
// STORYBOARD FUNCTIONS
// ========================
function normalizeStoryboardExtraImage(image) {
  if (!image) return null;
  const imageDataUrl = image.imageDataUrl || image.data || '';
  if (!imageDataUrl) return null;
  return {
    imageDataUrl,
    thumbnail: image.thumbnail || imageDataUrl,
    fileName: image.fileName || image.name || 'reference.png',
  };
}

function normalizeStoryboardItem(item) {
  const src = item || {};
  return {
    ...src,
    imageDataUrl: src.imageDataUrl || src.data || '',
    thumbnail: src.thumbnail || src.imageDataUrl || src.data || '',
    fileName: src.fileName || src.name || 'scene.png',
    prompt: String(src.prompt || ''),
    status: src.status || 'pending',
    extraImages: (Array.isArray(src.extraImages) ? src.extraImages : [])
      .map(normalizeStoryboardExtraImage)
      .filter(Boolean),
  };
}

function normalizeStoryboardItems(items) {
  return (Array.isArray(items) ? items : []).map(normalizeStoryboardItem);
}

// Ảnh chính + mọi ảnh thêm riêng của đúng hàng prompt này.
function storyboardImagesForItem(item) {
  const normalized = normalizeStoryboardItem(item);
  const images = [];
  if (normalized.imageDataUrl) {
    images.push({ data: normalized.imageDataUrl, name: normalized.fileName || 'scene.png' });
  }
  normalized.extraImages.forEach((image, index) => {
    images.push({ data: image.imageDataUrl, name: image.fileName || `reference ${index + 2}.png` });
  });
  return images;
}

function storyboardItemToPayload(item) {
  const images = storyboardImagesForItem(item);
  return {
    prompt: String(item && item.prompt || '').trim(),
    // Giữ field cũ để tương thích bản content/inject trước, field images là nguồn
    // chuẩn mới cho nhiều ảnh riêng trên cùng một prompt.
    image: images[0] ? images[0].data : null,
    imageName: images[0] ? images[0].name : 'scene.png',
    images,
  };
}

async function addImagesToStoryboard(fileList) {
  const files = [...fileList].filter(f => f.type.startsWith('image/'));
  if (files.length === 0) return;

  // Sắp xếp theo TÊN file kiểu số tự nhiên (1,2,3,…,10 đúng thứ tự) — trình duyệt
  // trả về file đa chọn không đảm bảo thứ tự, nên đặt tên 1,2,3 là ăn chắc.
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  const L = LANG[lang];
  addLog(lang === 'vi'
    ? `🖼️ Đang thêm ${files.length} hình...`
    : `🖼️ Adding ${files.length} images...`, 'info');

  for (const file of files) {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const thumbnail = await createThumbnail(dataUrl, 120);
      storyboardItems.push({
        imageDataUrl: dataUrl,
        thumbnail: thumbnail,
        extraImages: [],
        prompt: '',
        fileName: file.name,
        status: 'pending' // pending, active, done, error
      });
    } catch (err) {
      addLog(`❌ ${file.name}: ${err.message}`, 'error');
    }
  }

  saveStoryboard();
  renderStoryboard();
  addLog(lang === 'vi'
    ? `✅ Đã thêm ${files.length} hình — tổng: ${storyboardItems.length}`
    : `✅ Added ${files.length} images — total: ${storyboardItems.length}`, 'success');
}

async function addImagesToStoryboardRow(index, fileList) {
  const target = storyboardItems[index];
  const files = [...(fileList || [])].filter((file) => file && String(file.type || '').startsWith('image/'));
  if (!target || !files.length) return;
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const added = [];
  for (const file of files) {
    const imageDataUrl = await readFileAsDataUrl(file);
    added.push({
      imageDataUrl,
      thumbnail: await createThumbnail(imageDataUrl, 120),
      fileName: file.name || `reference ${added.length + 2}.png`,
    });
  }
  target.extraImages = [
    ...(Array.isArray(target.extraImages) ? target.extraImages.map(normalizeStoryboardExtraImage).filter(Boolean) : []),
    ...added,
  ];
  saveStoryboard();
  renderStoryboard();
  const currentIndex = storyboardItems.indexOf(target);
  addLog(lang === 'vi'
    ? `➕ Đã thêm ${added.length} hình vào prompt #${currentIndex + 1} · tổng ${storyboardImagesForItem(target).length} hình`
    : `➕ Added ${added.length} image(s) to prompt #${currentIndex + 1} · ${storyboardImagesForItem(target).length} total`, 'success');
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function createThumbnail(dataUrl, maxSize) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
      else { w = Math.round(w * maxSize / h); h = maxSize; }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(dataUrl); // fallback to original
    img.src = dataUrl;
  });
}

// Re-sort the WHOLE storyboard list by file name (numeric-aware). Useful after
// adding images in several batches, or after renaming to 1,2,3.
function sortStoryboardByName() {
  storyboardItems.sort((a, b) =>
    (a.fileName || '').localeCompare(b.fileName || '', undefined, { numeric: true, sensitivity: 'base' }));
  saveStoryboard();
  renderStoryboard();
  addLog(lang === 'vi' ? '🔢 Đã sắp xếp hình theo tên' : '🔢 Sorted images by name', 'success');
}

// Split pasted text into an ordered list of prompts.
// - If a blank line separates content, each blank-line-delimited BLOCK becomes
//   one prompt (so multi-line prompts stay intact).
// - Otherwise, one prompt per line.
function splitPromptBlocks(text) {
  const raw = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!raw) return [];
  // Một JSON pretty-print hợp lệ vẫn là MỘT prompt dù có xuống hàng. Nếu JSON
  // chứa mảng prompts/clips/scenes thì mỗi phần tử là một prompt.
  if (/^[\[{]/.test(raw)) {
    try {
      const data = JSON.parse(raw);
      let entries = null;
      if (Array.isArray(data)) entries = data;
      else if (data && Array.isArray(data.prompts)) entries = data.prompts;
      else if (data && Array.isArray(data.clips)) entries = data.clips;
      else if (data && Array.isArray(data.scenes)) entries = data.scenes;
      if (entries) return entries.map((entry) => typeof entry === 'string' ? entry.trim() : JSON.stringify(entry, null, 2)).filter(Boolean);
      return [raw];
    } catch (e) { /* có thể là nhiều JSON block, xử lý bằng dòng trắng bên dưới */ }
  }
  const hasBlankLine = /\n[ \t]*\n/.test(raw);
  if (hasBlankLine) {
    return raw.split(/\n[ \t]*\n+/).map(b => b.trim()).filter(Boolean);
  }
  return raw.split('\n').map(l => l.trim()).filter(Boolean);
}

// Đọc file prompt TXT/JSON. Quy tắc chung:
// - Có dòng trắng: mỗi KHỐI giữa hai dòng trắng là một prompt; xuống hàng bên
//   trong khối vẫn thuộc cùng prompt (đặc biệt quan trọng với JSON pretty-print).
// - TXT không có dòng trắng: giữ tương thích cũ, mỗi dòng là một prompt.
// - JSON hợp lệ dạng mảng/prompts/clips/scenes: mỗi phần tử là một prompt.
function parsePromptFileText(text, fileName = '') {
  const raw = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!raw) return [];
  const isJson = /\.json$/i.test(String(fileName || ''));

  if (isJson) {
    try {
      const data = JSON.parse(raw);
      let entries = null;
      if (Array.isArray(data)) entries = data;
      else if (data && Array.isArray(data.prompts)) entries = data.prompts;
      else if (data && Array.isArray(data.clips)) entries = data.clips;
      else if (data && Array.isArray(data.scenes)) entries = data.scenes;
      else entries = [data];
      return entries.map((entry) => {
        if (typeof entry === 'string') return entry.trim();
        return JSON.stringify(entry, null, 2);
      }).filter(Boolean);
    } catch (e) {
      // Nhiều JSON object pretty-print trong cùng file: một dòng trắng mới là
      // ranh giới prompt; xuống hàng thường bên trong object không được tách.
      if (/\n[ \t]*\n/.test(raw)) {
        return raw.split(/\n[ \t]*\n+/).map((block) => block.trim()).filter(Boolean);
      }
      // JSONL / nhiều object không nằm trong một mảng: thử từng dòng trước.
      const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length > 1 && lines.every((line) => {
        try { JSON.parse(line); return true; } catch (err) { return false; }
      })) return lines;
      // File JSON chưa hoàn chỉnh vẫn là MỘT prompt nhiều dòng, không tách mỗi dòng.
      return [raw];
    }
  }

  return splitPromptBlocks(raw);
}

function inferScriptTitle(text, fileName = '') {
  try {
    const data = JSON.parse(String(text || ''));
    if (data && !Array.isArray(data)) {
      const title = data.script_title || data.scriptTitle || data.story_title || data.storyTitle || data.title || data.name;
      if (typeof title === 'string' && title.trim()) return title.trim();
    }
  } catch (e) { /* dùng tên file */ }
  return String(fileName || 'Clip').replace(/\.[^.]+$/, '').trim() || 'Clip';
}

// Take the inline pasted prompts, split them, and pair with images in order.
function applyPastedPrompts() {
  const L = LANG[lang];
  const input = document.getElementById('sb-paste-input');
  if (!input) return;
  const prompts = splitPromptBlocks(input.value);

  if (storyboardItems.length === 0) {
    addLog(L.sb_paste_none, 'warning');
    return;
  }
  if (prompts.length === 0) {
    addLog(L.sb_paste_empty, 'warning');
    return;
  }

  const n = Math.min(prompts.length, storyboardItems.length);
  for (let i = 0; i < n; i++) {
    storyboardItems[i].prompt = prompts[i];
  }
  saveStoryboard();
  renderStoryboard();
  input.value = '';
  addLog('✍️ ' + String(L.sb_paste_done || '').replace('{n}', n), 'success');
  if (prompts.length > storyboardItems.length) {
    addLog(lang === 'vi'
      ? `⚠️ Có ${prompts.length - storyboardItems.length} prompt dư (nhiều hơn số hình)`
      : `⚠️ ${prompts.length - storyboardItems.length} extra prompt(s) ignored (more than images)`, 'warning');
  }
}

function renderStoryboard() {
  const list = document.getElementById('sb-list');
  const L = LANG[lang];
  list.innerHTML = '';

  document.getElementById('sb-counter').textContent = storyboardItems.length;

  if (storyboardItems.length === 0) {
    return;
  }

  storyboardItems.forEach((item, i) => {
    item = storyboardItems[i] = normalizeStoryboardItem(item);
    const el = document.createElement('div');
    el.className = `sb-item${item.status === 'active' ? ' sb-active' : ''}${item.status === 'done' ? ' sb-done' : ''}${item.status === 'error' ? ' sb-error' : ''}`;
    el.dataset.index = i;

    const statusIcon = item.status === 'done' ? '✅' : item.status === 'error' ? '❌' : item.status === 'active' ? '🔄' : '';
    const extraImages = Array.isArray(item.extraImages) ? item.extraImages : [];
    const extraThumbs = extraImages.map((image, extraIndex) => `
      <div class="sb-extra-thumb-wrap" title="${escapeHtml(image.fileName || `reference ${extraIndex + 2}`)}">
        <img class="sb-extra-thumb" src="${image.thumbnail || image.imageDataUrl}" alt="">
        <button type="button" class="sb-extra-remove" data-index="${i}" data-extra-index="${extraIndex}" title="${t('sb_remove_extra')}">×</button>
      </div>
    `).join('');

    el.innerHTML = `
      <div class="sb-media">
        <img class="sb-thumb" src="${item.thumbnail}" alt="${escapeHtml(item.fileName)}" title="${escapeHtml(item.fileName)}">
        ${extraImages.length ? `<div class="sb-extra-list">${extraThumbs}</div>` : ''}
      </div>
      <div class="sb-content">
        <span class="sb-num">#${i + 1} — ${escapeHtml(item.fileName)}${extraImages.length ? ` +${extraImages.length} ${t('sb_count')}` : ''} ${statusIcon}</span>
        <textarea class="sb-prompt-input" rows="2" data-index="${i}"
          placeholder="${L.sb_prompt_ph}">${escapeHtml(item.prompt)}</textarea>
      </div>
      <div class="sb-actions">
        <button type="button" class="sb-btn-add-image" data-index="${i}" title="${t('sb_add_more_images')}">➕ <span>${t('sb_add_more_images')}</span></button>
        <input type="file" class="sb-row-file" data-index="${i}" accept="image/*" multiple hidden>
        <button type="button" class="sb-btn-dup" data-index="${i}" title="${L.sb_duplicate || 'Nhân bản'}">⧉ <span>${t('sb_duplicate_short')}</span></button>
        <button type="button" class="sb-btn-remove" data-index="${i}" title="${L.sb_remove}">✕ <span>${L.sb_remove}</span></button>
      </div>
    `;
    list.appendChild(el);
  });

  // Thêm một hoặc nhiều ảnh vào CHÍNH hàng prompt đang chọn.
  list.querySelectorAll('.sb-btn-add-image').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.currentTarget.dataset.index);
      list.querySelector(`.sb-row-file[data-index="${idx}"]`)?.click();
    });
  });
  list.querySelectorAll('.sb-row-file').forEach((input) => {
    input.addEventListener('change', async (e) => {
      const idx = Number(e.currentTarget.dataset.index);
      const files = e.currentTarget.files;
      await addImagesToStoryboardRow(idx, files);
      e.currentTarget.value = '';
    });
  });

  list.querySelectorAll('.sb-extra-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.currentTarget.dataset.index);
      const extraIndex = Number(e.currentTarget.dataset.extraIndex);
      const item = storyboardItems[idx];
      if (!item || !Array.isArray(item.extraImages) || !item.extraImages[extraIndex]) return;
      item.extraImages.splice(extraIndex, 1);
      saveStoryboard();
      renderStoryboard();
    });
  });

  // Bind duplicate buttons — copy the WHOLE image set into a new row right below.
  list.querySelectorAll('.sb-btn-dup').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      const src = storyboardItems[idx];
      if (!src) return;
      storyboardItems.splice(idx + 1, 0, {
        thumbnail: src.thumbnail,
        imageDataUrl: src.imageDataUrl,
        fileName: src.fileName,
        extraImages: (Array.isArray(src.extraImages) ? src.extraImages : []).map((image) => ({ ...image })),
        prompt: '',
        status: 'pending'
      });
      saveStoryboard();
      renderStoryboard();
      addLog('⧉ ' + (LANG[lang].sb_duplicated || 'Đã nhân bản hình') + ` #${idx + 1}`, 'success');
    });
  });

  // Bind prompt editing
  list.querySelectorAll('.sb-prompt-input').forEach(textarea => {
    textarea.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      if (storyboardItems[idx]) {
        storyboardItems[idx].prompt = e.target.value;
        saveStoryboardDebounced();
      }
    });
  });

  // Bind remove buttons
  list.querySelectorAll('.sb-btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      storyboardItems.splice(idx, 1);
      saveStoryboard();
      renderStoryboard();
    });
  });
}

let _sbSaveTimer = null;
function saveStoryboardDebounced() {
  clearTimeout(_sbSaveTimer);
  _sbSaveTimer = setTimeout(saveStoryboard, 500);
}

function saveStoryboard() {
  // Save only thumbnails + prompts to storage (not full images — too large)
  const toSave = storyboardItems.map(item => ({
    thumbnail: item.thumbnail,
    prompt: item.prompt,
    fileName: item.fileName,
    status: item.status,
    // Store full image only if small enough, otherwise just thumbnail
    imageDataUrl: item.imageDataUrl,
    extraImages: (Array.isArray(item.extraImages) ? item.extraImages : []).map((image) => ({
      imageDataUrl: image.imageDataUrl,
      thumbnail: image.thumbnail || image.imageDataUrl,
      fileName: image.fileName || 'reference.png',
    })),
  }));

  // Chrome storage limit is ~10MB for local. Chunk if needed.
  try {
    chrome.storage.local.set({ storyboard: toSave });
  } catch (e) {
    // If too large, save without full images
    const lite = toSave.map(item => ({
      thumbnail: item.thumbnail,
      prompt: item.prompt,
      fileName: item.fileName,
      status: item.status,
      imageDataUrl: item.thumbnail, // fallback to thumbnail
      extraImages: (Array.isArray(item.extraImages) ? item.extraImages : []).map((image) => ({
        imageDataUrl: image.thumbnail || image.imageDataUrl,
        thumbnail: image.thumbnail || image.imageDataUrl,
        fileName: image.fileName || 'reference.png',
      })),
    }));
    chrome.storage.local.set({ storyboard: lite });
    addLog(lang === 'vi'
      ? '⚠️ Hình quá lớn, chỉ lưu thumbnail'
      : '⚠️ Images too large, saving thumbnails only', 'warning');
  }
  if (typeof scheduleProjectSave === 'function') scheduleProjectSave();
}

// ========================
// TEACH MODE FUNCTIONS
// ========================
async function startTeach(target) {
  const L = LANG[lang];

  const tabId = await findFlowTab();
  if (!tabId) {
    addLog('❌ ' + L.flow_not_open, 'error');
    addLog(lang === 'vi'
      ? '💡 Hãy mở trang labs.google/fx rồi reload trang đó'
      : '💡 Open labs.google/fx and reload the page', 'warning');
    return;
  }

  if (currentTeachTarget) {
    await cancelTeach();
  }

  currentTeachTarget = target;

  document.querySelectorAll('.btn-teach').forEach(b => {
    b.classList.remove('active');
    b.textContent = 'Teach';
  });
  const activeBtn = document.querySelector(`.btn-teach[data-target="${target}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.textContent = 'Cancel';
  }
  document.querySelectorAll('.teach-item').forEach(item => item.classList.remove('teaching'));
  const activeItem = document.querySelector(`.teach-item[data-target="${target}"]`);
  if (activeItem) activeItem.classList.add('teaching');

  try {
    chrome.tabs.sendMessage(tabId, { action: 'TEACH', target }, (resp) => {
      if (chrome.runtime.lastError) {
        addLog('❌ Content script chưa load!', 'error');
        addLog(lang === 'vi'
          ? '💡 Reload trang Flow (F5) rồi thử lại'
          : '💡 Reload the Flow page (F5) and try again', 'warning');
        currentTeachTarget = null;
        resetTeachButtons();
        return;
      }
      if (resp && resp.success) {
        addLog(`🎯 Teach mode: hãy click "${L[`teach_${target}`] || target}" trên trang Flow`, 'info');
      }
    });
  } catch (e) {
    addLog(`❌ Error: ${e.message}`, 'error');
    currentTeachTarget = null;
    resetTeachButtons();
  }
}

async function cancelTeach() {
  currentTeachTarget = null;
  resetTeachButtons();
  const tabId = await findFlowTab();
  if (tabId) {
    chrome.tabs.sendMessage(tabId, { action: 'STOP_TEACH' }, () => {
      if (chrome.runtime.lastError) { /* ok */ }
    });
  }
}

function resetTeachButtons() {
  document.querySelectorAll('.btn-teach').forEach(b => {
    b.classList.remove('active');
    b.textContent = 'Teach';
  });
  document.querySelectorAll('.teach-item').forEach(item => item.classList.remove('teaching'));
}

function updateTeachStatus(target, mapping) {
  const L = LANG[lang];
  const statusEl = document.getElementById(`teach-${target}-status`);
  const itemEl = document.querySelector(`.teach-item[data-target="${target}"]`);

  if (mapping) {
    if (statusEl) {
      const displayText = mapping.text ? mapping.text.substring(0, 25) : (mapping.selector || '').substring(0, 25);
      statusEl.textContent = `✅ ${displayText}`;
      statusEl.classList.add('mapped');
    }
    if (itemEl) { itemEl.classList.add('mapped'); itemEl.classList.remove('teaching'); }
  } else {
    if (statusEl) {
      statusEl.textContent = L.setup_not_mapped || 'Not mapped';
      statusEl.classList.remove('mapped');
    }
    if (itemEl) { itemEl.classList.remove('mapped'); itemEl.classList.remove('teaching'); }
  }
}

function updateMappedCount() {
  const el = document.getElementById('setup-mapped-count');
  if (el) el.textContent = document.querySelectorAll('.teach-item.mapped').length;
}

async function clearOneMapping(target) {
  if (!target) return;
  // Update storage directly + tell the content script to drop it live.
  const data = await chrome.storage.local.get(['elementMap']);
  const map = data.elementMap || {};
  delete map[target];
  await chrome.storage.local.set({ elementMap: map });
  await sendToContent({ action: 'CLEAR_MAPPING', target });
  updateTeachStatus(target, null);
  updateMappedCount();
  addLog((lang === 'vi' ? '🗑️ Đã hủy teach: ' : '🗑️ Cleared teach: ') + target, 'warning');
}

async function loadMappingStatus() {
  const data = await chrome.storage.local.get(['elementMap']);
  const map = data.elementMap || {};
  TEACH_TARGETS.forEach(t => updateTeachStatus(t, map[t] || null));
  updateMappedCount();
}

// ========================
// FIND FLOW TAB
// ========================
async function findFlowTab() {
  // A tab is only USABLE for Nano generation if it has a PROJECT open
  // (URL .../flow/project/<id>). Sending to the Flow HOME/tools tab (no project)
  // was the real "Gửi N shot rồi im" bug: content_script there has no projectId
  // to generate into, so genNanoImages never runs. ⇒ ALWAYS prefer a project tab.
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab && isFlowProjectUrl(activeTab.url)) {
    connectedTabId = activeTab.id;
    return activeTab.id;
  }

  // Search EVERY window (the project tab is often not the one beside the panel).
  const allTabs = await chrome.tabs.query({});
  const flowTabs = allTabs.filter(tab => isFlowUrl(tab.url));
  const projectTabs = flowTabs
    .filter(tab => isFlowProjectUrl(tab.url))
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  if (projectTabs[0]) {
    connectedTabId = projectTabs[0].id;
    return projectTabs[0].id;
  }

  // No project open anywhere → fall back to any Flow tab (the downstream
  // "no-project" message then tells the user to open a project).
  if (activeTab && isFlowUrl(activeTab.url)) { connectedTabId = activeTab.id; return activeTab.id; }
  const anyFlow = flowTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
  if (anyFlow) { connectedTabId = anyFlow.id; return anyFlow.id; }
  return null;
}

function isFlowUrl(url) {
  return url && (url.includes('labs.google.com/fx') || url.includes('labs.google/fx'));
}
// A real Flow PROJECT (has a project id in the path) — the only kind of tab that
// can actually generate. The bare tools/home page matches isFlowUrl but NOT this.
function isFlowProjectUrl(url) {
  return !!url && /labs\.google(?:\.com)?\/fx\/tools\/flow\/project\//.test(url);
}

function getScriptTitle(project) {
  const value = project && project.title != null
    ? project.title
    : document.getElementById('script-title')?.value;
  return String(value || '').trim() || 'Clip';
}

// Trong lúc CHẠY tạo/tải video: khoá không cho Chrome "discard" (giải phóng) tab Flow
//   khi nó ở nền — nếu bị discard thì inject.js chết và mất toàn bộ quy trình đang chạy.
//   persist=true → autoDiscardable:false (giữ tab sống dù chuyển sang tab khác).
//   Kết thúc lượt chạy gọi lại với persist=false để trả về mặc định.
async function setFlowTabPersistent(persist) {
  try {
    const tabId = connectedTabId || await findFlowTab();
    if (tabId) await chrome.tabs.update(tabId, { autoDiscardable: !persist });
  } catch (e) { /* tab có thể đã đóng */ }
}

// ========================
// QUEUE CONTROL
// ========================
function waitForBulkDone(timeoutMs = 30 * 60 * 1000) {
  return new Promise((resolve) => {
    if (pendingBulkRun) pendingBulkRun.resolve(false);
    const timer = setTimeout(() => {
      if (pendingBulkRun) {
        pendingBulkRun = null;
        resolve(false);
      }
    }, timeoutMs);
    pendingBulkRun = {
      resolve: (ok) => {
        clearTimeout(timer);
        resolve(ok);
      }
    };
  });
}

async function ensureCharacterEntityBeforeRun(charImages) {
  const chars = (charImages || []).filter((c) => c && c.data);
  if (getCharacterMode() !== 'entity') return true;
  if (!chars.length) return true;
  if (currentProjectEntityReady && preparedCharacterEntities.length) {
    addLog(`👤 Entity nhân vật của dự án này đã sẵn sàng (${preparedCharacterEntities.length}), bỏ qua bước thiết lập.`, 'success');
    return true;
  }
  if (currentProjectEntityReady && !preparedCharacterEntities.length) {
    addLog('👤 Entity từng được tạo nhưng chưa có entityId để gắn vào video; tạo lại một lần để lấy referenceEntities.', 'warning');
    currentProjectEntityReady = false;
  }
  addLog('👤 Preflight: tạo entity nhân vật + voice trước khi chạy video…', 'info');
  const voice = getVoicePayload();
  // Voice RIÊNG từng nhân vật (đã kèm trong charImages); thiếu mới rơi về voice chung.
  const payloadChars = chars.map((c) => ({ imageDataUrl: c.data, name: c.name || '', fileName: `${c.name || 'character'}.png`, voice: c.voice || voice }));
  const done = new Promise((resolve) => {
    if (pendingCharacterEntitySetup) pendingCharacterEntitySetup.resolve(false);
    const timer = setTimeout(() => {
      if (pendingCharacterEntitySetup) {
        pendingCharacterEntitySetup = null;
        resolve(false);
      }
    }, 4 * 60 * 1000);
    pendingCharacterEntitySetup = {
      resolve: (ok) => {
        clearTimeout(timer);
        resolve(ok);
      }
    };
  });
  await sendToContent({ action: 'SETUP_CHARACTER_ENTITIES', characters: payloadChars });
  const ok = await done;
  if (!ok) addLog('❌ Preflight entity chưa xong, dừng để tránh chạy sai nhân vật/voice.', 'error');
  return ok;
}

async function ensureCharacterRefsBeforeRun(charImages) {
  const chars = (charImages || []).filter((c) => c && c.data);
  preparedCharacterRefMedia = [];
  if (getCharacterMode() !== 'ref' || !chars.length) return true;
  const payloadChars = chars.map((c) => ({
    imageDataUrl: c.data,
    data: c.data,
    name: c.name || '',
    fileName: `${c.name || 'character'}.png`,
  }));
  const tags = payloadChars
    .map((c) => String(c.name || '').trim())
    .filter(Boolean)
    .map((n) => '@' + n.replace(/\s+/g, ''));
  addLog(`📎 Preflight: tải ảnh ref nhân vật${tags.length ? ' · ' + tags.join(' ') : ''} trước khi tạo video…`, 'info');
  const done = new Promise((resolve) => {
    if (pendingCharacterRefSetup) pendingCharacterRefSetup.resolve(false);
    const timer = setTimeout(() => {
      if (pendingCharacterRefSetup) {
        pendingCharacterRefSetup = null;
        resolve(false);
      }
    }, 2 * 60 * 1000);
    pendingCharacterRefSetup = {
      resolve: (ok) => {
        clearTimeout(timer);
        resolve(ok);
      }
    };
  });
  await sendToContent({ action: 'SETUP_CHARACTER_REFS', characters: payloadChars });
  const ok = await done;
  if (!ok) addLog('❌ Preflight ảnh ref nhân vật chưa xong, dừng để tránh chạy sai nhân vật.', 'error');
  return ok;
}

async function ensureCharactersBeforeRun(charImages) {
  if (getCharacterMode() === 'entity') return ensureCharacterEntityBeforeRun(charImages);
  return ensureCharacterRefsBeforeRun(charImages);
}

async function startQueue(options = {}) {
  const L = LANG[lang];

  // Build prompt list from current input mode
  const textPrompts = splitPromptBlocks(document.getElementById('prompt-textarea')?.value || '');
  const storyboardPromptItems = storyboardItems.filter((item) => String(item.prompt || '').trim());
  let runInputMode = inputMode;
  if (runInputMode === 'storyboard') {
    promptList = storyboardPromptItems.map((item) => String(item.prompt || '').trim());
    if (promptList.length === 0 && textPrompts.length > 0) {
      runInputMode = 'text';
      promptList = textPrompts;
      addLog('⚠️ Storyboard chưa có prompt, dùng prompt text hiện tại để tạo video.', 'warning');
    } else if (promptList.length === 0 && storyboardItems.length > 0) {
      alert(t('no_prompts_img'));
      return;
    }
  } else {
    promptList = textPrompts;
    if (promptList.length === 0 && storyboardPromptItems.length > 0) {
      runInputMode = 'storyboard';
      promptList = storyboardPromptItems.map((item) => String(item.prompt || '').trim());
      addLog('⚠️ Text prompt trống, dùng prompt + ảnh storyboard hiện tại để tạo video.', 'warning');
    }
  }

  if (promptList.length === 0) {
    alert(L.no_prompts);
    return;
  }

  if (typeof saveCurrentProject === 'function') {
    await saveCurrentProject();
  }

  // (License/dùng-thử tạm TẮT — chạy không giới hạn trong lúc hoàn thiện.)

  const tabId = await findFlowTab();
  if (!tabId) {
    alert(L.flow_not_open);
    return;
  }

  state = 'running';
  chrome.storage.local.set({ state: 'running' });
  updateStatus();
  showRunningControls();
  renderQueueList();
  showProgress(0, promptList.length);
  addLog(L.log_started, 'info');

  // Save queue state for recovery
  saveQueueState(0);

  // Character names + IMAGES from the current project → the run drags each
  // character image into the prompt (same working method as the keyframe).
  const charNames = [
    (document.getElementById('char1-name')?.value || '').trim(),
    (document.getElementById('char2-name')?.value || '').trim(),
    (document.getElementById('char3-name')?.value || '').trim(),
  ].filter(Boolean);
  // Mỗi nhân vật kèm VOICE RIÊNG (select cạnh tên) — dùng khi preflight tạo entity.
  const charImages = [
    char1Img ? { data: char1Img.data, name: (document.getElementById('char1-name')?.value || '').trim(), voice: charVoicePayloadFor(1) } : null,
    char2Img ? { data: char2Img.data, name: (document.getElementById('char2-name')?.value || '').trim(), voice: charVoicePayloadFor(2) } : null,
    char3Img ? { data: char3Img.data, name: (document.getElementById('char3-name')?.value || '').trim(), voice: charVoicePayloadFor(3) } : null,
  ].filter((c) => c && c.data);
  // Nhiều ảnh ref chung → gắn TẤT CẢ vào EVERY prompt của queue.
  const commonRefs = productRefsForPayload();
  if (commonRefs.length) addLog(`🖼️ ${commonRefs.length} ảnh ref chung sẽ được gắn vào từng prompt của hàng đợi.`, 'info');

  const characterMode = getCharacterMode();
  addLog(`🚀 Tạo hàng loạt ${promptList.length} video qua API cổ điển${runInputMode === 'storyboard' ? ' kèm ảnh storyboard' : ''}…`, 'info');
  // Gom ảnh nhân vật + sản phẩm (nếu có) → gắn làm reference cho mọi video.
  const bulkImages = [
    ...charImages.map((c) => ({ data: c.data, name: c.name || 'char' })),
    ...commonRefs,
  ];
  const characterRefs = charImages
    .map((c) => ({ name: c.name || '' }))
    .filter((c) => String(c.name || '').trim());
  // items = mỗi prompt kèm ẢNH RIÊNG (storyboard). Text mode: không ảnh riêng.
  const items = runInputMode === 'storyboard'
    ? storyboardPromptItems.map(storyboardItemToPayload)
    : promptList.map((p) => ({ prompt: p, image: null, images: [] }));
  const withImg = items.filter((it) => Array.isArray(it.images) && it.images.length).length;
  const promptImageCount = items.reduce((sum, it) => sum + (Array.isArray(it.images) ? it.images.length : 0), 0);
  if (withImg) addLog(`🖼️ ${withImg}/${items.length} prompt có ảnh riêng · tổng ${promptImageCount} hình`, 'info');
  // Map cài đặt extension → giá trị API.
  const MODEL_MAP = { 'omni-flash': 'omni_flash', 'veo31-lite': 'lite', 'veo31-fast': 'fast', 'veo31-quality': 'quality' };
  const payload = {
    action: 'GEN_BULK',
    items,
    prompts: promptList,
    images: bulkImages,
    model: MODEL_MAP[settings.model] || 'lite',
    aspect: settings.aspect === '9:16' ? 'portrait' : 'landscape',
    duration: Math.max(4, Math.min(10, settings.duration || DEFAULT_SETTINGS.duration)),
    count: Math.max(1, Math.min(4, settings.quantity || 1)),
    voice: characterMode === 'entity' ? getVoicePayload() : null,
    // TỰ ĐỘNG TẢI sau khi tạo xong (theo toggle "Tự động tải về"). downloadUpsampled
    //   = tải 1080p (cần tài khoản trả phí); mặc định 720p cho nhanh & chắc.
    //   Trong chuỗi nhiều dự án, startAllProjects tự tải nên tắt ở đây để khỏi tải 2 lần.
    autoDownload: options.suppressAutoDownload ? false : !!settings.autoDownload,
    downloadUpsampled: settings.downloadQuality !== '720',
    downloadQuality: settings.downloadQuality || '720',
    downloadBaseName: getScriptTitle(),
  };
  addLog(`⚙️ Model ${payload.model} · ${payload.aspect} · ${payload.duration}s · ${payload.count} video/prompt${payload.voice ? ' · voice ' + payload.voice.name : ''}${payload.autoDownload ? ' · TỰ TẢI ' + (payload.downloadQuality === '4k' ? '4K' : payload.downloadQuality + 'p') : ''}`, 'info');

  const preflightOk = await ensureCharactersBeforeRun(charImages);
  if (!preflightOk) {
    state = 'idle';
    chrome.storage.local.set({ state: 'idle' });
    updateStatus();
    showIdleControls();
    return false;
  }
  // HAI CHẾ ĐỘ TÁCH BẠCH (tránh lẫn lộn):
  //   • ref    → ảnh ref + @Tên; KHÔNG entity, KHÔNG voice entity.
  //   • entity → tạo nhân vật entity + voice; KHÔNG upload ảnh ref.
  const isEntityMode = characterMode === 'entity';
  const useEntityCharacters = isEntityMode && !!currentProjectEntityReady && preparedCharacterEntities.length > 0;
  payload.characterMode = characterMode;
  // @Tên vẫn cần cho cả 2 (để gán lời thoại đúng nhân vật), nhưng dữ liệu ẢNH/ENTITY thì loại trừ nhau.
  payload.characterRefs = characterRefs;
  payload.preloadedCharacterRefs = isEntityMode ? [] : preparedCharacterRefMedia;
  payload.characterEntities = isEntityMode ? preparedCharacterEntities : [];
  payload.images = [
    // Ảnh nhân vật CHỈ upload ở chế độ ref (entity không đụng tới ảnh ref).
    ...(!isEntityMode && !preparedCharacterRefMedia.length ? charImages.map((c) => ({ data: c.data, name: c.name || 'char' })) : []),
    ...commonRefs,
  ];
  addLog(isEntityMode
    ? '👤 Chế độ ENTITY + voice: tạo nhân vật entity trong Flow, KHÔNG dùng ảnh ref.'
    : '📎 Chế độ REF + @Tên: dùng ảnh ref + @Tên, KHÔNG tạo entity.', 'info');
  if (useEntityCharacters) {
    addLog(`👤 Dùng ${payload.characterEntities.length} nhân vật entity đã tạo trong Flow; video sẽ gửi referenceEntities + voice, không upload lại ảnh nhân vật ref.`, 'info');
  } else if (characterMode === 'entity') {
    addLog('👤 Chế độ entity đã chọn nhưng chưa bật/tạo xong auto entity; chỉ gửi @Tên + voice, không upload ảnh nhân vật ref.', 'warning');
  } else if (characterRefs.length) {
    addLog(`📎 Dùng chế độ ảnh ref + @Tên; đã chuẩn bị ${preparedCharacterRefMedia.length || charImages.length} ảnh ref trước khi tạo video.`, 'info');
  }

  // GIỮ QUY TRÌNH KHI CHUYỂN TAB: khoá tab Flow khỏi bị Chrome discard + bật keep-alive
  //   cho service worker, để việc tạo/tải chạy tiếp dù bạn sang tab khác làm việc.
  setFlowTabPersistent(true);
  startKeepAlive();

  const waitForDone = !!options.waitForDone;
  const donePromise = waitForDone ? waitForBulkDone() : null;
  chrome.tabs.sendMessage(tabId, payload, (resp) => {
    if (chrome.runtime.lastError) {
      addLog('❌ Cannot connect to Flow page! Reload it.', 'error');
      state = 'idle';
      updateStatus();
      showIdleControls();
    }
  });

  // Enable keep-alive during run
  if (settings.keepAlive) {
    startKeepAlive();
  }

  if (donePromise) return await donePromise;
  return true;
}

// THOÁT dự án cũ → VÀO dự án mới bằng cách điều hướng tab Flow tới link đã lưu của
//   slot dự án. Đây là "API" thực chất của việc chuyển dự án (Flow là SPA: đổi URL
//   kéo theo loạt call khởi tạo sessions/applets/likeness/checkAppAvailability).
async function navigateFlowToProject(project) {
  const url = project && project.flowUrl;
  const tabId = connectedTabId || await findFlowTab();
  if (!tabId) { addLog('❌ Chưa mở tab Flow', 'error'); return false; }
  if (!url) {
    addLog('⏭️ Slot này chưa gắn link Flow — chạy trên dự án đang mở. (Mở đúng dự án trên Flow khi chọn slot để tự lưu link.)', 'warning');
    return true;
  }
  const wantPid = projectIdFromUrl(url);
  const cur = await currentFlowTabUrl();
  if (wantPid && projectIdFromUrl(cur) === wantPid) { addLog('✅ Đã ở đúng dự án Flow.', 'info'); return true; }
  addLog(`🔀 Thoát dự án cũ → vào dự án mới: …/${wantPid.slice(0, 8)}`, 'info');
  await chrome.tabs.update(tabId, { url });
  const ok = await waitFlowReady(tabId, wantPid, 45000);
  await new Promise((r) => setTimeout(r, 3000)); // để session/Bearer khởi tạo
  if (!ok) addLog('⚠️ Chờ dự án mới tải hơi lâu — vẫn thử tiếp.', 'warning');
  return true;
}

// Map model UI → giá trị API (giống MODEL_MAP trong startQueue) — dùng để dựng payload
//   cho chuỗi nền TỪ DỮ LIỆU DỰ ÁN ĐÃ LƯU, không phụ thuộc DOM.
const CHAIN_MODEL_MAP = { 'omni-flash': 'omni_flash', 'veo31-lite': 'lite', 'veo31-fast': 'fast', 'veo31-quality': 'quality' };

// Dựng GEN_BULK payload cho 1 dự án đã lưu (afProjects[key]) — khớp đúng cách startQueue
//   xây payload. Trả { payload, charImages, characterMode } hoặc null nếu không có prompt.
function buildGenPayloadFromProject(p) {
  if (!p) return null;
  const ps = p.settings || {};
  const textPrompts = splitPromptBlocks(p.prompts || '');
  const storyItems = Array.isArray(p.storyboard) ? p.storyboard.filter((it) => String(it.prompt || '').trim()) : [];
  let items;
  const preferStory = (p.inputMode === 'storyboard') && storyItems.length;
  if (preferStory || (!textPrompts.length && storyItems.length)) {
    items = storyItems.map(storyboardItemToPayload);
  } else if (textPrompts.length) {
    items = textPrompts.map((pr) => ({ prompt: pr, image: null, images: [] }));
  } else {
    return null;
  }

  const characterMode = ps.characterMode || 'ref';
  const charImages = [
    (p.c1 && p.c1.data) ? { data: p.c1.data, name: String(p.c1.name || '').trim() } : null,
    (p.c2 && p.c2.data) ? { data: p.c2.data, name: String(p.c2.name || '').trim() } : null,
    (p.c3 && p.c3.data) ? { data: p.c3.data, name: String(p.c3.name || '').trim() } : null,
  ].filter((c) => c && c.data);
  const commonRefs = productRefsForPayload(projectProductRefs(p), p.productName || p.prod?.name || '');
  const characterRefs = charImages.map((c) => ({ name: c.name || '' })).filter((c) => String(c.name || '').trim());

  const vo = getVoiceOption(ps.voice || 'auto');
  const voice = (characterMode === 'entity') ? { id: vo.value, name: vo.name, prompt: vo.prompt, description: lang === 'vi' ? vo.vi : vo.en } : null;

  // Ảnh gắn reference: mode ref → ảnh nhân vật (upload inline khi bulk) + sản phẩm;
  //   mode entity → chỉ sản phẩm (nhân vật đã thành entity, không upload lại ảnh).
  const images = [
    ...(characterMode === 'ref' ? charImages.map((c) => ({ data: c.data, name: c.name || 'char' })) : []),
    ...commonRefs,
  ];

  const payload = {
    action: 'GEN_BULK',
    items,
    prompts: items.map((it) => it.prompt),
    model: CHAIN_MODEL_MAP[ps.model] || 'lite',
    aspect: ps.aspect === '9:16' ? 'portrait' : 'landscape',
    duration: Math.max(4, Math.min(10, ps.duration || DEFAULT_SETTINGS.duration)),
    count: Math.max(1, Math.min(4, ps.quantity || 1)),
    voice,
    characterMode,
    characterRefs,
    preloadedCharacterRefs: [],
    characterEntities: [],
    images,
    autoDownload: false, // chuỗi tự tải qua DOWNLOAD_GENERATED_AND_WAIT sau mỗi dự án
    downloadUpsampled: settings.downloadQuality !== '720',
    downloadQuality: settings.downloadQuality || '720',
    downloadBaseName: getScriptTitle(p),
  };
  return { payload, charImages, characterMode };
}

// CHẠY CHUỖI DỰ ÁN Ở NỀN: dựng sẵn payload mọi dự án rồi giao background service worker
//   tự lái. Nhờ đó ĐÓNG/THU NHỎ panel vẫn chạy tiếp (chỉ cần giữ tab Flow mở).
async function startAllProjectsBackground() {
  if (!confirm(t('confirm_run_all'))) return;
  await saveCurrentProject();
  const tabId = await findFlowTab();
  if (!tabId) { addLog('❌ Chưa mở tab Flow', 'error'); return; }
  const data = await chrome.storage.local.get(['afProjects']);
  const all = data.afProjects || {};
  const chainItems = [];
  for (let i = 1; i <= PROJECT_COUNT; i++) {
    const key = String(i);
    const p = all[key];
    if (!p || !projectHasPromptContent(p)) { continue; }
    const built = buildGenPayloadFromProject(p);
    if (!built) { addLog(`⏭️ Bỏ qua Dự án ${key}: chưa có prompt`, 'warning'); continue; }
    let preflight = null;
    if (built.characterMode === 'entity' && built.charImages.length) {
      const alreadyReady = !!p.entityReady && Array.isArray(p.entities) && p.entities.filter((e) => e && (e.entityId || e.id)).length > 0;
      if (alreadyReady) {
        built.payload.characterEntities = p.entities.filter((e) => e && (e.entityId || e.id));
      } else {
        const vo = getVoiceOption((p.settings && p.settings.voice) || 'auto');
        const voice = { id: vo.value, name: vo.name, prompt: vo.prompt, description: lang === 'vi' ? vo.vi : vo.en };
        preflight = { mode: 'entity', characters: built.charImages.map((c) => ({ imageDataUrl: c.data, name: c.name, fileName: `${c.name || 'character'}.png`, voice })) };
      }
    }
    chainItems.push({ key, flowUrl: p.flowUrl || '', preflight, genPayload: built.payload, downloadUpsampled: settings.downloadQuality !== '720', downloadQuality: settings.downloadQuality || '720' });
  }
  if (!chainItems.length) { addLog('⏭️ Không có dự án nào có prompt để chạy.', 'warning'); return; }

  // Khoá tab khỏi discard + keep-alive để nền chạy độc lập panel.
  try { await chrome.tabs.update(tabId, { autoDiscardable: false }); } catch (e) {}
  chrome.runtime.sendMessage({ action: 'START_KEEPALIVE_ALARM' }, () => { if (chrome.runtime.lastError) {} });

  chrome.runtime.sendMessage({ action: 'START_CHAIN', items: chainItems, tabId }, (resp) => {
    if (chrome.runtime.lastError) { addLog(`❌ Không khởi động được chuỗi nền: ${chrome.runtime.lastError.message}`, 'error'); return; }
    if (resp && resp.started) {
      state = 'running';
      chrome.storage.local.set({ state: 'running' });
      updateStatus();
      showRunningControls();
      document.querySelector('.tab-btn[data-tab="log"]')?.click();
      addLog(`🏁 Đã giao ${resp.count} dự án cho NỀN chạy. Bạn có thể ĐÓNG/THU NHỎ panel — quá trình vẫn tiếp tục. Giữ TAB Flow mở.`, 'success');
    } else if (resp && resp.error === 'already-running') {
      addLog('⚠️ Chuỗi nền đang chạy rồi.', 'warning');
    } else {
      addLog(`⚠️ ${(resp && resp.error) || 'không khởi động được chuỗi nền'}`, 'warning');
    }
  });
}

async function startAllProjects() {
  if (!confirm(t('confirm_run_all'))) return;
  await saveCurrentProject();
  const data = await chrome.storage.local.get(['afProjects']);
  const all = data.afProjects || {};
  const sel = document.getElementById('project-select');
  for (let i = 1; i <= PROJECT_COUNT; i++) {
    const key = String(i);
    const p = all[key];
    if (!p || !projectHasPromptContent(p)) {
      addLog(`⏭️ Bỏ qua Dự án ${key}: chưa có prompt`, 'warning');
      continue;
    }
    curProj = key;
    if (sel) sel.value = key;
    await chrome.storage.local.set({ afCurProj: key });
    applyProject(p);
    addLog(`▶️ Chạy Dự án ${key}`, 'info');
    // 1) Thoát dự án cũ → vào dự án Flow của slot này.
    const navOk = await navigateFlowToProject(p);
    if (!navOk) { addLog(`❌ Không vào được dự án Flow của slot ${key}, dừng chuỗi.`, 'error'); break; }
    // 2) Xoá danh sách video đã thu để chỉ tải video của dự án này.
    await sendToContentAwait({ action: 'CLEAR_GENERATED_VIDEOS' }, 10000);
    // 3) Tạo hàng loạt và chờ gửi xong (tắt tự-tải-sau-bulk vì bước 4 sẽ tự tải).
    const ok = await startQueue({ waitForDone: true, suppressAutoDownload: true });
    if (!ok) {
      addLog(`❌ Dự án ${key} chưa hoàn tất, dừng chuỗi 5 dự án.`, 'error');
      break;
    }
    // 4) Chờ video render xong → TẢI HẾT → chờ tải xong hẳn rồi mới sang dự án kế.
    addLog(`💾 Dự án ${key}: đợi render & tải toàn bộ video…`, 'info');
    const dl = await sendToContentAwait({ action: 'DOWNLOAD_GENERATED_AND_WAIT', upsampled: settings.downloadQuality !== '720', quality: settings.downloadQuality || '720', downloadBaseName: getScriptTitle(p) }, 30 * 60 * 1000);
    if (dl && dl.success) addLog(`✅ Dự án ${key} xong — đã tải ${dl.okCount}/${dl.total} video.`, 'success');
    else addLog(`⚠️ Dự án ${key}: tải chưa trọn (${dl && dl.error || 'timeout'}) — vẫn sang dự án kế.`, 'warning');
    await saveCurrentProject();
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  addLog('🏁 Đã chạy xong chuỗi các dự án.', 'success');
}

function pauseQueue() {
  state = 'paused';
  chrome.storage.local.set({ state: 'paused' });
  sendToContent({ action: 'PAUSE_QUEUE' });
  updateStatus();
  document.getElementById('btn-pause').classList.add('hidden');
  document.getElementById('btn-resume').classList.remove('hidden');
  addLog(LANG[lang].log_paused, 'warning');
}

function resumeQueue() {
  state = 'running';
  chrome.storage.local.set({ state: 'running' });
  sendToContent({ action: 'RESUME_QUEUE' });
  updateStatus();
  document.getElementById('btn-resume').classList.add('hidden');
  document.getElementById('btn-pause').classList.remove('hidden');
  addLog(LANG[lang].log_resumed, 'info');
}

function stopQueue() {
  if (!confirm(LANG[lang].confirm_stop)) return;
  state = 'idle';
  chrome.storage.local.set({ state: 'idle' });
  sendToContent({ action: 'STOP_QUEUE' });
  // Dừng cả chuỗi nền nếu đang chạy.
  chrome.runtime.sendMessage({ action: 'STOP_CHAIN' }, () => { if (chrome.runtime.lastError) {} });
  // Người dùng chủ động dừng → bỏ khoá discard tab + tắt keep-alive (nếu không bật sẵn).
  setFlowTabPersistent(false);
  if (!settings.keepAlive) stopKeepAlive();
  updateStatus();
  showIdleControls();
  addLog(LANG[lang].log_stopped, 'error');
  // Clear saved queue
  chrome.storage.local.remove('savedQueue');
}

async function sendToContent(data) {
  const tabId = connectedTabId || await findFlowTab();
  if (tabId) {
    chrome.tabs.sendMessage(tabId, data, () => {
      if (chrome.runtime.lastError) { /* ok */ }
    });
  }
}

// Gửi tới content và CHỜ phản hồi (cho các bước dài như tải-và-chờ trong chuỗi dự án).
function sendToContentAwait(data, timeoutMs = 0) {
  return new Promise(async (resolve) => {
    const tabId = connectedTabId || await findFlowTab();
    if (!tabId) { resolve(null); return; }
    let done = false;
    const t = timeoutMs ? setTimeout(() => { if (!done) { done = true; resolve(null); } }, timeoutMs) : null;
    chrome.tabs.sendMessage(tabId, data, (resp) => {
      if (done) return; done = true; if (t) clearTimeout(t);
      resolve(chrome.runtime.lastError ? null : resp);
    });
  });
}

function projectIdFromUrl(url) {
  const m = /\/project\/([0-9a-fA-F-]{36})/.exec(String(url || ''));
  return m ? m[1] : '';
}

async function currentFlowTabUrl() {
  const tabId = connectedTabId || await findFlowTab();
  if (!tabId) return '';
  try { const t = await chrome.tabs.get(tabId); return (t && t.url) || ''; } catch (e) { return ''; }
}

// Chờ tab Flow điều hướng xong tới dự án mong muốn và content_script đã sống lại.
async function waitFlowReady(tabId, wantPid, timeoutMs = 40000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1500));
    let tab; try { tab = await chrome.tabs.get(tabId); } catch (e) { return false; }
    if (tab && tab.status === 'complete' && isFlowUrl(tab.url) && (!wantPid || projectIdFromUrl(tab.url) === wantPid)) {
      const alive = await new Promise((res) => chrome.tabs.sendMessage(tabId, { action: 'PING' }, (r) => res(!chrome.runtime.lastError && r && r.alive)));
      if (alive) return true;
    }
  }
  return false;
}

// ========================
// QUEUE PERSISTENCE (for overnight / auto-resume)
// ========================
function saveQueueState(currentIndex) {
  const savedQueue = {
    prompts: promptList,
    currentIndex: currentIndex,
    mode: mode,
    inputMode: inputMode,
    settings: { ...settings, mode },
    title: getScriptTitle(),
    timestamp: Date.now(),
    items: promptList.map((p, i) => ({
      prompt: p,
      status: i < currentIndex ? 'done' : 'pending'
    }))
  };

  // If storyboard, include image refs
  if (inputMode === 'storyboard') {
    savedQueue.storyboard = storyboardItems.map(item => ({
      thumbnail: item.thumbnail,
      prompt: item.prompt,
      fileName: item.fileName,
      imageDataUrl: item.imageDataUrl,
      extraImages: (Array.isArray(item.extraImages) ? item.extraImages : []).map((image) => ({ ...image })),
      status: item.status
    }));
  }

  // Persist character refs so an overnight resume still attaches them.
  savedQueue.charNames = [
    (document.getElementById('char1-name')?.value || '').trim(),
    (document.getElementById('char2-name')?.value || '').trim(),
    (document.getElementById('char3-name')?.value || '').trim()
  ].filter(Boolean);
  savedQueue.charImages = [
    char1Img ? { data: char1Img.data, name: (document.getElementById('char1-name')?.value || '').trim(), voice: charVoicePayloadFor(1) } : null,
    char2Img ? { data: char2Img.data, name: (document.getElementById('char2-name')?.value || '').trim(), voice: charVoicePayloadFor(2) } : null,
    char3Img ? { data: char3Img.data, name: (document.getElementById('char3-name')?.value || '').trim(), voice: charVoicePayloadFor(3) } : null
  ].filter(Boolean);
  savedQueue.productImages = productRefsForPayload();

  chrome.storage.local.set({ savedQueue });
}

function showResumeBanner(savedQueue) {
  const L = LANG[lang];
  const banner = document.getElementById('resume-banner');
  const doneCount = savedQueue.items.filter(i => i.status === 'done').length;
  const total = savedQueue.items.length;
  const timeAgo = getTimeAgo(savedQueue.timestamp);

  document.getElementById('resume-text').textContent = L.queue_resume_ask;
  document.getElementById('resume-detail').textContent =
    `${doneCount}/${total} ${L.queue_items} — ${timeAgo}`;
  document.getElementById('btn-resume-yes').textContent = L.queue_resume_yes;
  document.getElementById('btn-resume-no').textContent = L.queue_resume_no;

  banner.classList.remove('hidden');
}

async function resumeSavedQueue() {
  const data = await chrome.storage.local.get(['savedQueue']);
  const sq = data.savedQueue;
  if (!sq) return;

  const L = LANG[lang];

  // Restore state
  mode = sq.mode || mode;
  promptList = sq.prompts;
  const resumeIndex = sq.currentIndex || 0;

  // Restore storyboard if applicable
  if (sq.inputMode === 'storyboard' && sq.storyboard) {
    storyboardItems = normalizeStoryboardItems(sq.storyboard);
    inputMode = 'storyboard';
    renderStoryboard();
  }

  // Find Flow tab
  const tabId = await findFlowTab();
  if (!tabId) {
    alert(L.flow_not_open);
    return;
  }

  state = 'running';
  chrome.storage.local.set({ state: 'running' });
  updateStatus();
  showRunningControls();
  renderQueueList();

  // Mark previously completed items
  for (let i = 0; i < resumeIndex; i++) {
    updateQueueItem(i, 'done');
  }
  showProgress(resumeIndex, promptList.length);
  addLog(`${L.queue_resumed} #${resumeIndex + 1}/${promptList.length}`, 'info');

  // Hide banner
  document.getElementById('resume-banner').classList.add('hidden');

  // Send resume command
  const payload = {
    action: 'START_QUEUE',
    prompts: promptList,
    settings: sq.settings || { ...settings, mode },
    resumeFrom: resumeIndex
  };

  if (sq.inputMode === 'storyboard' && sq.storyboard) {
    payload.storyboard = sq.storyboard;
  }
  if (sq.charImages) payload.charImages = sq.charImages;
  if (sq.charNames) payload.charNames = sq.charNames;
  if (sq.productImages) payload.productImages = sq.productImages;
  else if (sq.productImage) payload.productImages = [sq.productImage];
  payload.downloadBaseName = String(sq.title || '').trim() || getScriptTitle();

  chrome.tabs.sendMessage(tabId, payload, (resp) => {
    if (chrome.runtime.lastError) {
      addLog('❌ Cannot connect to Flow page! Reload it.', 'error');
      state = 'idle';
      updateStatus();
      showIdleControls();
    }
  });

  if (settings.keepAlive) startKeepAlive();
}

function discardSavedQueue() {
  chrome.storage.local.remove('savedQueue');
  document.getElementById('resume-banner').classList.add('hidden');
  addLog(lang === 'vi' ? '🗑️ Đã bỏ qua queue cũ' : '🗑️ Previous queue discarded', 'warning');
}

function getTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'vi' ? 'vừa xong' : 'just now';
  if (mins < 60) return `${mins} ${lang === 'vi' ? 'phút trước' : 'min ago'}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${lang === 'vi' ? 'giờ trước' : 'hr ago'}`;
  const days = Math.floor(hours / 24);
  return `${days} ${lang === 'vi' ? 'ngày trước' : 'days ago'}`;
}

// ========================
// KEEP-ALIVE (Overnight Mode)
// ========================
let _keepAliveTimer = null;

function startKeepAlive() {
  stopKeepAlive(); // Clear existing

  // Ping background every 25 seconds to keep service worker alive
  _keepAliveTimer = setInterval(() => {
    chrome.runtime.sendMessage({ action: 'KEEP_ALIVE' }, () => {
      if (chrome.runtime.lastError) { /* ok, service worker may restart */ }
    });
  }, 25000);

  // Also use chrome.alarms for more reliable keep-alive
  chrome.runtime.sendMessage({ action: 'START_KEEPALIVE_ALARM' });
}

function stopKeepAlive() {
  if (_keepAliveTimer) {
    clearInterval(_keepAliveTimer);
    _keepAliveTimer = null;
  }
  chrome.runtime.sendMessage({ action: 'STOP_KEEPALIVE_ALARM' }, () => {
    if (chrome.runtime.lastError) { /* ok */ }
  });
}

// ========================
// UI UPDATES
// ========================
function updateStatus() {
  const L = LANG[lang];
  const bar = document.getElementById('status-bar');
  const icon = document.getElementById('status-icon');
  const text = document.getElementById('status-text');

  bar.className = 'status-bar';
  switch (state) {
    case 'running':
      bar.classList.add('status-running');
      icon.textContent = '⚡';
      text.textContent = L.status_running + (settings.keepAlive ? ' 🌙' : '');
      break;
    case 'paused':
      bar.classList.add('status-paused');
      icon.textContent = '⏸';
      text.textContent = L.status_paused;
      break;
    case 'done':
      bar.classList.add('status-done');
      icon.textContent = '✅';
      text.textContent = L.status_done;
      break;
    case 'error':
      bar.classList.add('status-error');
      icon.textContent = '❌';
      text.textContent = L.status_error;
      break;
    default:
      bar.classList.add('status-idle');
      icon.textContent = '⏸';
      text.textContent = L.status_idle;
  }
}

function updatePromptCount() {
  const text = document.getElementById('prompt-textarea').value.trim();
  const count = splitPromptBlocks(text).length;
  document.getElementById('prompt-counter').textContent = count;
}

function showRunningControls() {
  document.getElementById('btn-start').classList.add('hidden');
  document.getElementById('btn-start-all-projects')?.classList.add('hidden');
  document.getElementById('btn-pause').classList.remove('hidden');
  document.getElementById('btn-resume').classList.add('hidden');
  document.getElementById('btn-stop').classList.remove('hidden');
  document.getElementById('progress-section').classList.remove('hidden');
  document.getElementById('queue-list-section').classList.remove('hidden');
  document.getElementById('resume-banner').classList.add('hidden');
}

function showIdleControls() {
  document.getElementById('btn-start').classList.remove('hidden');
  document.getElementById('btn-start-all-projects')?.classList.remove('hidden');
  document.getElementById('btn-pause').classList.add('hidden');
  document.getElementById('btn-resume').classList.add('hidden');
  document.getElementById('btn-stop').classList.add('hidden');
  document.getElementById('progress-section').classList.add('hidden');
}

function showProgress(current, total) {
  document.getElementById('progress-text').textContent = `${current} / ${total}`;
  const pct = total > 0 ? Math.round(current / total * 100) : 0;
  document.getElementById('progress-pct').textContent = `${pct}%`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
}

function renderQueueList() {
  const list = document.getElementById('queue-list');
  list.innerHTML = '';
  promptList.forEach((p, i) => {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.id = `qi-${i}`;

    // Show thumbnail if storyboard mode
    const thumbHtml = (inputMode === 'storyboard' && storyboardItems[i])
      ? `<img class="sb-thumb" style="width:30px;height:30px;border-radius:4px;" src="${storyboardItems[i].thumbnail}" alt="">`
      : '';

    const tipExpand = lang === 'vi' ? 'Bấm để xem toàn bộ prompt' : 'Click to read the full prompt';
    item.innerHTML = `
      <div class="qi-num">${i + 1}</div>
      ${thumbHtml}
      <div class="qi-text" title="${escapeHtml(tipExpand)}">${escapeHtml(p)}</div>
      <button class="qi-zoom" title="${escapeHtml(tipExpand)}">🔍</button>
      <div class="qi-status">⏳</div>
    `;
    // Click the prompt text OR the 🔍 button to read the full prompt in a popup.
    const open = (e) => { e.stopPropagation(); openPromptModal(p, i + 1); };
    item.querySelector('.qi-text')?.addEventListener('click', open);
    item.querySelector('.qi-zoom')?.addEventListener('click', open);
    list.appendChild(item);
  });
}

// ===== FULL-PROMPT READER POPUP =====
function ensurePromptModal() {
  let overlay = document.getElementById('prompt-modal-overlay');
  if (overlay) return overlay;
  overlay = document.createElement('div');
  overlay.id = 'prompt-modal-overlay';
  overlay.className = 'prompt-modal-overlay hidden';
  overlay.innerHTML = `
    <div class="prompt-modal" role="dialog" aria-modal="true">
      <div class="prompt-modal-head">
        <span class="prompt-modal-title" id="prompt-modal-title"></span>
        <div class="prompt-modal-actions">
          <button class="prompt-modal-copy" id="prompt-modal-copy" type="button"></button>
          <button class="prompt-modal-close" id="prompt-modal-close" type="button" title="Close">✕</button>
        </div>
      </div>
      <div class="prompt-modal-body" id="prompt-modal-body"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  // Close on backdrop click or ✕
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closePromptModal(); });
  overlay.querySelector('#prompt-modal-close').addEventListener('click', closePromptModal);
  overlay.querySelector('#prompt-modal-copy').addEventListener('click', () => {
    const body = document.getElementById('prompt-modal-body');
    const txt = body ? body.textContent : '';
    navigator.clipboard?.writeText(txt).then(() => {
      const L = LANG[lang];
      addLog('📋 ' + (L.qz_copied || 'Copied prompt'), 'success');
    }).catch(() => {});
  });
  return overlay;
}

function openPromptModal(text, num) {
  const L = LANG[lang];
  const overlay = ensurePromptModal();
  const title = document.getElementById('prompt-modal-title');
  const body = document.getElementById('prompt-modal-body');
  const copyBtn = document.getElementById('prompt-modal-copy');
  if (title) title.textContent = (L.qz_title || 'Prompt') + (num ? ' #' + num : '');
  if (body) body.textContent = String(text || '');
  if (copyBtn) copyBtn.textContent = '📋 ' + (L.qz_copy || 'Copy');
  overlay.classList.remove('hidden');
  // ESC to close
  if (!overlay._escBound) {
    overlay._escBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.classList.contains('hidden')) closePromptModal();
    });
  }
}

function closePromptModal() {
  const overlay = document.getElementById('prompt-modal-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function updateQueueItem(index, status) {
  const item = document.getElementById(`qi-${index}`);
  if (!item) return;

  item.className = 'queue-item';
  const statusEl = item.querySelector('.qi-status');

  switch (status) {
    case 'active':
      item.classList.add('qi-active');
      statusEl.textContent = '🔄';
      break;
    case 'done':
      item.classList.add('qi-done');
      statusEl.textContent = '✅';
      break;
    case 'error':
      item.classList.add('qi-error');
      statusEl.textContent = '❌';
      break;
    case 'skipped':
      item.classList.add('qi-error');
      statusEl.textContent = '⏭️';
      break;
  }

  // Update storyboard item status
  if (inputMode === 'storyboard' && storyboardItems[index]) {
    storyboardItems[index].status = status;
  }

  item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ========================
// LOG
// ========================
// ─── Nano Flow manifest → shot queue (M2) ───────────────────────────────────
function nfTruncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function nfRefSummary(item) {
  const c = item.imageRefs.characters.length;
  const e = item.imageRefs.environments.length;
  const p = item.imageRefs.products.length;
  const parts = [];
  if (c) parts.push('👤' + c);
  if (e) parts.push('🏠' + e);
  if (p) parts.push('📦' + p);
  return parts.join(' ');
}

function renderNanoQueue(missingImages) {
  const counter = document.getElementById('nf-counter');
  if (counter) counter.textContent = nanoQueue.length;
  const list = document.getElementById('nf-list');
  if (list) {
    list.innerHTML = nanoQueue.map((it) => `
      <div class="sb-item">
        <span class="sb-num">#${it.index} — ${escapeHtml(it.name)}${it.endStoryboardPrompt ? ' 🎞️2' : ''}${it.dialogue ? ' 💬' : ''}${it.generated ? (it.generated.endMediaId ? ' 🍌✅✅' : ' 🍌✅') : ''}${it.video ? ' 🎬✅' : ''}</span>
        <div class="setup-desc" style="margin:2px 0;">🖼️ ${escapeHtml(nfTruncate(it.storyboardPrompt, 100))}</div>
        <div class="setup-desc" style="opacity:.8;">🎬 ${escapeHtml(nfTruncate(it.videoPrompt, 80))} ${nfRefSummary(it)}</div>
      </div>`).join('');
  }
  const status = document.getElementById('nf-status');
  if (status) {
    const required = (missingImages || []).filter((m) => m.required);
    status.textContent = !nanoQueue.length
      ? ''
      : required.length
        ? `⚠️ Cần nạp ${required.length} ảnh tham chiếu: ${required.map((m) => m.name).join(', ')}`
        : `✅ ${nanoQueue.length} shot đã sẵn sàng`;
  }
}

// Render the manifest's declared assets with a per-asset image-upload button,
// so the user can attach real character/scene/product photos as Nano Banana refs.
function renderNanoAssets() {
  const box = document.getElementById('nf-assets');
  if (!box) return;
  if (!nanoManifest || !nanoManifest.assets) { box.innerHTML = ''; return; }
  const kinds = [['characters', '👤 Nhân vật'], ['environments', '🏠 Bối cảnh'], ['products', '📦 Sản phẩm']];
  let html = '';
  kinds.forEach(([kind, label]) => {
    const list = nanoManifest.assets[kind] || [];
    if (!list.length) return;
    html += `<div class="setup-desc" style="margin-top:6px;opacity:.8;">${label}</div>`;
    list.forEach((a, i) => {
      const n = Array.isArray(a.images) ? a.images.length : (a.image ? 1 : 0);
      // Bối cảnh cho phép NHIỀU ảnh (nhiều góc của cùng 1 địa điểm) — extension
      // sẽ nạp tất cả làm ref; kịch bản/prompt quyết cảnh nào dùng góc nào.
      const multi = kind === 'environments' ? ' multiple' : '';
      // Board model: bối cảnh do BOARD (và nút "nạp ảnh bối cảnh theo board" bên
      // dưới) lo → environment ở đây là TÙY CHỌN, không cảnh báo "thiếu ảnh".
      const envOptional = kind === 'environments' && !n;
      const statusTxt = n ? (n > 1 ? `✅×${n}` : '✅')
        : (envOptional ? '🖼️ board tự lo (nạp nếu muốn)' : '⚠️ chưa có ảnh');
      const btnTxt = n ? 'Đổi ảnh'
        : (kind === 'environments' ? 'Gắn ảnh (chọn nhiều)' : 'Gắn ảnh');
      html += `<div style="display:flex;align-items:center;gap:8px;margin:2px 0;">
        <span class="setup-desc" style="flex:1;">${escapeHtml(a.name)} ${statusTxt}</span>
        <label class="btn-sm btn-outline" style="cursor:pointer;">📎 <span>${btnTxt}</span>
          <input type="file" accept="image/*"${multi} data-kind="${kind}" data-idx="${i}" class="nf-asset-file" hidden></label>
      </div>`;
    });
  });
  box.innerHTML = html;
  box.querySelectorAll('.nf-asset-file').forEach((inp) => inp.addEventListener('change', onNanoAssetFile));
}

function onNanoAssetFile(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length || !nanoManifest) { e.target.value = ''; return; }
  const kind = e.target.getAttribute('data-kind');
  const idx = parseInt(e.target.getAttribute('data-idx'), 10);
  // Đọc TẤT CẢ file được chọn (bối cảnh cho phép nhiều góc của cùng địa điểm).
  Promise.all(files.map((f) => new Promise((resolve) => {
    const r = new FileReader();
    r.onload = (ev) => resolve(ev.target.result);
    r.onerror = () => resolve(null);
    r.readAsDataURL(f);
  }))).then((dataUrls) => {
    const imgs = dataUrls.filter(Boolean);
    const asset = nanoManifest.assets[kind] && nanoManifest.assets[kind][idx];
    if (!asset || !imgs.length) return;
    asset.images = imgs;        // full list (multi-angle location refs)
    asset.image = imgs[0];      // back-compat: single-image consumers
    // Rebuild the queue so each shot's imageRefs pick up the new image(s).
    if (window.NanoManifest) nanoQueue = window.NanoManifest.toQueue(nanoManifest);
    persistNanoProjects();  // B2: sync queue mới vào dự án active + lưu
    renderNanoAssets();
    renderNanoQueue(window.NanoManifest ? window.NanoManifest.missingImages(nanoManifest) : []);
    addLog(`📎 Đã gắn ${imgs.length} ảnh cho "${asset.name}".`, 'success');
  });
  e.target.value = '';
}

// Per-board (per-shot) location upload — mỗi board 10s có thể nạp RIÊNG 1 ảnh bối
// cảnh. Đã nạp ⇒ đính làm ref khóa bối cảnh (ưu tiên) cho board đó; chưa nạp ⇒ board
// tự sinh từ prompt bối cảnh 4 góc. 5 shot ⇒ 5 nút nạp (theo yêu cầu).
function renderNanoBoards() {
  const box = document.getElementById('nf-boards');
  if (!box) return;
  if (!nanoManifest || !Array.isArray(nanoManifest.shots) || !nanoManifest.shots.length) { box.innerHTML = ''; return; }
  const shots = nanoManifest.shots.slice().sort((a, b) => (a.index || 0) - (b.index || 0));
  let html = '<div class="setup-desc" style="margin-top:6px;opacity:.8;">🎬 Ảnh bối cảnh theo từng board (tùy chọn — nạp để khóa đúng bối cảnh; bỏ trống thì tự tạo):</div>';
  shots.forEach((s) => {
    const has = !!s.board_location_image;
    const nm = s.storyboard_name || s.shot_id || ('Board ' + (s.index || ''));
    const status = has ? '✅ đã nạp' : '🖼️ tự tạo từ prompt';
    const sid = escapeHtml(String(s.shot_id || ''));
    html += `<div style="display:flex;align-items:center;gap:8px;margin:2px 0;">
      <span class="setup-desc" style="flex:1;">#${s.index || ''} ${escapeHtml(nm)} — ${status}</span>
      ${has ? `<button class="btn-sm btn-outline nf-board-clear" data-shot="${sid}" title="Bỏ ảnh">✖️</button>` : ''}
      <label class="btn-sm btn-outline" style="cursor:pointer;">📎 <span>${has ? 'Đổi' : 'Nạp bối cảnh'}</span>
        <input type="file" accept="image/*" data-shot="${sid}" class="nf-board-file" hidden></label>
    </div>`;
  });
  box.innerHTML = html;
  box.querySelectorAll('.nf-board-file').forEach((inp) => inp.addEventListener('change', onNanoBoardFile));
  box.querySelectorAll('.nf-board-clear').forEach((b) => b.addEventListener('click', onNanoBoardClear));
}

function nfFindShot(shotId) {
  return (nanoManifest && Array.isArray(nanoManifest.shots))
    ? nanoManifest.shots.find((s) => String(s.shot_id) === String(shotId)) : null;
}

function onNanoBoardFile(e) {
  const file = (e.target.files || [])[0];
  const shotId = e.target.getAttribute('data-shot');
  if (!file || !nanoManifest) { e.target.value = ''; return; }
  const r = new FileReader();
  r.onload = (ev) => {
    const shot = nfFindShot(shotId);
    if (!shot) return;
    shot.board_location_image = ev.target.result;   // dataURL nạp cho RIÊNG board này
    if (window.NanoManifest) nanoQueue = window.NanoManifest.toQueue(nanoManifest);
    persistNanoProjects();
    renderNanoBoards();
    renderNanoQueue(window.NanoManifest ? window.NanoManifest.missingImages(nanoManifest) : []);
    addLog(`📎 Đã nạp ảnh bối cảnh cho board "${shot.storyboard_name || shotId}" — sẽ dùng làm ref khóa bối cảnh.`, 'success');
  };
  r.onerror = () => addLog('❌ Không đọc được ảnh bối cảnh.', 'error');
  r.readAsDataURL(file);
  e.target.value = '';
}

function onNanoBoardClear(e) {
  const shotId = e.currentTarget.getAttribute('data-shot');
  const shot = nfFindShot(shotId);
  if (!shot) return;
  delete shot.board_location_image;
  if (window.NanoManifest) nanoQueue = window.NanoManifest.toQueue(nanoManifest);
  persistNanoProjects();
  renderNanoBoards();
  addLog(`🗑️ Đã bỏ ảnh bối cảnh board "${shot.storyboard_name || shotId}" — board sẽ tự tạo lại từ prompt.`, 'info');
}

function loadNanoManifest(input, options = {}) {
  if (!window.NanoManifest) {
    addLog('❌ Thiếu nano_manifest.js', 'error');
    return;
  }
  try {
    const res = window.NanoManifest.load(input);
    // MỖI DỰ ÁN 1 MANIFEST RIÊNG: manifest + hàng đợi được GẮN VÀO ĐÚNG dự án đang mở
    //   (afProjects[curProj]) — y như một trường bình thường của dự án. Nạp manifest =
    //   THAY manifest của DỰ ÁN HIỆN TẠI; chuyển sang dự án khác sẽ nạp lại manifest
    //   của dự án đó (xem applyProject → applyNanoFromProject). KHÔNG còn kho nano
    //   global dùng chung cho cả 5 dự án — đó là lý do trước đây "qua dự án 2 vẫn
    //   hiện manifest của dự án 1".
    invalidateNanoRun('nạp manifest mới cho Dự án ' + curProj);
    const title = (res.manifest.project && res.manifest.project.title) || ('Dự án ' + curProj);
    const project = ensureNanoProjectIdentity({ title: title, manifest: res.manifest, queue: res.queue, flowUrl: '' });
    nanoProjects = [project];        // active nano = ĐÚNG 1 manifest của dự án này
    setActiveNanoProject(0);
    captureNanoFlowUrl(0, { silent: true }); // best-effort: gắn link Flow đang mở
    saveCurrentProject();            // GẮN manifest + hàng đợi vào afProjects[curProj]
    addLog(`⚡ Nano Flow: đã gắn manifest "${title}" (${res.queue.length} shot) vào Dự án ${curProj} — fingerprint ${project.projectFingerprint}.`, 'success');
  } catch (err) {
    const s = document.getElementById('nf-status');
    if (s) s.textContent = '❌ ' + err.message;
    addLog('❌ Manifest lỗi: ' + err.message, 'error');
  }
}

// B2 — trỏ dự án active: gán nanoManifest/nanoQueue = dự án đó (code single cũ chạy y nguyên).
function setActiveNanoProject(i) {
  if (i < 0 || i >= nanoProjects.length) {
    nanoActiveIndex = -1; nanoManifest = null; nanoQueue = [];
  } else {
    nanoActiveIndex = i;
    const project = ensureNanoProjectIdentity(nanoProjects[i]);
    nanoManifest = project.manifest;
    nanoQueue = project.queue;
  }
  renderNanoQueue(nanoManifest && window.NanoManifest ? window.NanoManifest.missingImages(nanoManifest) : []);
  renderNanoAssets();
  renderNanoBoards();
  renderNanoProjects();
}

// MỖI DỰ ÁN 1 MANIFEST: sync manifest/hàng đợi (gồm kết quả ảnh/video vừa tạo) vào
//   ĐÚNG dự án đang mở rồi lưu cả dự án (afProjects[curProj].nano). Không còn kho nano
//   global dùng chung. Vẫn lưu epoch/phiên chạy để chống callback lạc sau khi mở lại.
function persistNanoProjects() {
  if (nanoActiveIndex >= 0 && nanoActiveIndex < nanoProjects.length) {
    nanoProjects[nanoActiveIndex].manifest = nanoManifest;
    nanoProjects[nanoActiveIndex].queue = nanoQueue;
  }
  chrome.storage.local.set({ nanoGenerationEpoch, nanoActiveRun });
  saveCurrentProject();
}

// v9.58 — gắn LINK DỰ ÁN FLOW cho 1 slot nano: nếu tab Flow đang mở đúng 1 dự án
// thì lưu URL đó vào slot để chuỗi "Chạy tất cả" tự thoát dự án cũ → vào dự án này.
async function captureNanoFlowUrl(index, opts = {}) {
  if (index < 0 || index >= nanoProjects.length) return;
  const url = await currentFlowTabUrl();
  if (!projectIdFromUrl(url)) {
    if (!opts.silent) addLog('⚠️ Tab Flow đang mở không phải 1 dự án (URL cần có /project/…). Mở đúng dự án Flow rồi bấm 🔗 lại.', 'warning');
    return;
  }
  nanoProjects[index].flowUrl = url;
  persistNanoProjects();
  renderNanoProjects();
  if (!opts.silent) addLog(`🔗 Đã gắn link Flow cho "${nanoProjects[index].title}": …/${projectIdFromUrl(url).slice(0, 8)}`, 'success');
}

// Chọn slot do NGƯỜI DÙNG bấm: đổi active + tự cập nhật link Flow đang mở cho slot
// đó (tiện: mở dự án Flow rồi bấm slot là gắn luôn). Khác setActiveNanoProject dùng
// trong lúc chạy chuỗi (không tự chụp link để tránh ghi đè nhầm).
function selectNanoProjectByUser(i) {
  if (i !== nanoActiveIndex) invalidateNanoRun('người dùng chuyển dự án');
  setActiveNanoProject(i);
  captureNanoFlowUrl(i, { silent: true });
}

// B2 — danh sách dự án (chọn active / xóa từng cái).
function renderNanoProjects() {
  const box = document.getElementById('nf-projects');
  if (!box) return;
  if (nanoProjects.length <= 1) { box.innerHTML = ''; return; } // 0-1 dự án: khỏi bày list
  box.innerHTML = '<div class="setup-desc" style="margin-top:6px;opacity:.85;">📚 Dự án đã nạp (' + nanoProjects.length + '/' + NANO_MAX_PROJECTS + ') — "Chạy tất cả" sẽ chạy lần lượt, xong dự án này tự thoát ra vào dự án Flow của dự án kế. Bấm 🔗 để gắn link dự án Flow cho từng slot.</div>' +
    nanoProjects.map((p, i) => {
      const pid = p.flowUrl ? projectIdFromUrl(p.flowUrl) : '';
      const linkTag = pid ? ' · 🔗' + escapeHtml(pid.slice(0, 6)) : ' · ⚠️ chưa gắn link';
      return '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;">' +
      '<button class="btn-sm ' + (i === nanoActiveIndex ? 'btn-primary' : 'btn-outline') + ' nf-proj-sel" data-i="' + i + '" style="flex:1;text-align:left;">' +
      (i === nanoActiveIndex ? '▶️ ' : '') + escapeHtml(p.title) + ' · ' + (p.queue ? p.queue.length : 0) + ' shot' + linkTag + '</button>' +
      '<button class="btn-sm btn-outline nf-proj-link" data-i="' + i + '" title="Gắn/đổi link dự án Flow cho slot này (mở đúng dự án Flow rồi bấm)">🔗</button>' +
      '<button class="btn-sm btn-outline nf-proj-del" data-i="' + i + '" title="Xóa dự án">🗑️</button></div>';
    }).join('');
  box.querySelectorAll('.nf-proj-sel').forEach((b) => b.addEventListener('click', () => selectNanoProjectByUser(parseInt(b.dataset.i, 10))));
  box.querySelectorAll('.nf-proj-link').forEach((b) => b.addEventListener('click', () => captureNanoFlowUrl(parseInt(b.dataset.i, 10))));
  box.querySelectorAll('.nf-proj-del').forEach((b) => b.addEventListener('click', () => removeNanoProject(parseInt(b.dataset.i, 10))));
}

function removeNanoProject(i) {
  if (i < 0 || i >= nanoProjects.length) return;
  invalidateNanoRun('xóa dự án');
  nanoProjects.splice(i, 1);
  setActiveNanoProject(nanoProjects.length ? Math.min(i, nanoProjects.length - 1) : -1);
  persistNanoProjects();
}

// Tính URL DANH SÁCH Flow (/tools/flow) từ URL hiện tại — để thoát dự án cũ về menu.
function flowHomeUrlFrom(url) {
  try {
    const u = new URL(url || 'https://labs.google/fx/vi/tools/flow');
    const m = /^(\/fx\/[a-z-]+\/tools\/flow)/.exec(u.pathname);
    return u.origin + (m ? m[1] : '/fx/vi/tools/flow');
  } catch (e) { return 'https://labs.google/fx/vi/tools/flow'; }
}

// TẠO 1 DỰ ÁN FLOW MỚI (project id mới): thoát dự án cũ → về danh sách /tools/flow →
//   bấm nút "Create with Google Flow" THẬT của Flow → chờ URL nhảy sang /project/<id
//   MỚI>. Trả về pid mới, hoặc '' nếu không tạo được (vẫn chạy trên dự án đang mở).
//   Dùng lại đúng cơ chế đã chạy ổn ở chuỗi nền (CREATE_NEW_FLOW_PROJECT).
async function createFreshFlowProject() {
  const tabId = connectedTabId || await findFlowTab();
  if (!tabId) { addLog('❌ Chưa mở tab Flow để tạo dự án mới.', 'error'); return ''; }
  const before = await currentFlowTabUrl();
  const prevPid = projectIdFromUrl(before);
  // 1) Thoát về danh sách Flow.
  addLog('↩️ Thoát dự án cũ → về danh sách Flow để tạo project mới…', 'info');
  await chrome.tabs.update(tabId, { url: flowHomeUrlFrom(before) });
  await waitFlowReady(tabId, '', 30000);
  await new Promise((r) => setTimeout(r, 1500));
  // 2) Bấm nút tạo dự án mới thật của Flow (Flow tự sinh project id + session).
  const ack = await sendToContentAwait({ action: 'CREATE_NEW_FLOW_PROJECT' }, 8000);
  if (!ack || !ack.success) addLog(`⚠️ Không bấm được nút tạo dự án mới (${(ack && ack.error) || 'không phản hồi'}) — thử chờ điều hướng.`, 'warning');
  // 3) Chờ URL nhảy sang /project/<id MỚI> (khác pid cũ).
  const start = Date.now();
  while (Date.now() - start < 30000) {
    await new Promise((r) => setTimeout(r, 1500));
    const pid = projectIdFromUrl(await currentFlowTabUrl());
    if (pid && pid !== prevPid) {
      addLog(`🆕 Đã vào dự án Flow MỚI: …/${pid.slice(0, 8)} — bắt đầu chạy.`, 'success');
      await new Promise((r) => setTimeout(r, 3000)); // đợi Flow POST session + bắt Bearer
      return pid;
    }
  }
  addLog('⚠️ Chờ dự án Flow mới quá lâu — vẫn thử chạy trên dự án đang mở.', 'warning');
  return '';
}

// CHẠY TẤT CẢ DỰ ÁN NANO tuần tự — MỖI DỰ ÁN 1 PROJECT FLOW RIÊNG (project id mới):
//   với mỗi slot afProjects có manifest → TẠO project Flow mới → nạp manifest của slot
//   → tạo ảnh → video → tải → xong thì THOÁT ra, tạo project mới cho dự án kế.
//   Đây chính là "làm xong dự án 1 thoát ra vào lại project id mới cho dự án 2".
async function runAllNanoProjects() {
  await saveCurrentProject();
  const all = (await chrome.storage.local.get(['afProjects'])).afProjects || {};
  nanoRunAllKeys = [];
  for (let i = 1; i <= PROJECT_COUNT; i++) {
    const k = String(i);
    const nano = all[k] && all[k].nano;
    if (nano && nano.manifest && Array.isArray(nano.queue) && nano.queue.length) nanoRunAllKeys.push(k);
  }
  if (!nanoRunAllKeys.length) { addLog('⚠️ Chưa có dự án nào đã nạp manifest để chạy. Nạp manifest vào từng dự án rồi thử lại.', 'warning'); return; }
  if (!confirm(`Chạy tuần tự ${nanoRunAllKeys.length} dự án nano (${nanoRunAllKeys.map((k) => 'DA' + k).join(', ')})?\n\nMỖI DỰ ÁN sẽ TẠO 1 PROJECT FLOW MỚI (project id riêng) rồi tạo ảnh → video → tải. Xong dự án này tự thoát ra, tạo project mới cho dự án kế.\n\nGiữ TAB Flow mở trong suốt quá trình.`)) return;
  nanoRunAll = true;
  nanoRunAllPos = 0;
  document.querySelector('.tab-btn[data-tab="log"]')?.click();
  addLog(`▶️ CHẠY TẤT CẢ ${nanoRunAllKeys.length} dự án nano — mỗi dự án 1 project Flow mới.`, 'success');
  await runNanoProjectAtRunAllPos();
}

// Chạy 1 dự án tại vị trí nanoRunAllPos: chuyển sang slot đó (nạp manifest) → tạo
//   project Flow MỚI → chạy pipeline nano.
async function runNanoProjectAtRunAllPos() {
  const key = nanoRunAllKeys[nanoRunAllPos];
  if (!key) { nanoRunAll = false; return; }
  const sel = document.getElementById('project-select');
  curProj = key;
  if (sel) sel.value = key;
  await chrome.storage.local.set({ afCurProj: key });
  const fresh = (await chrome.storage.local.get(['afProjects'])).afProjects || {};
  applyProject(fresh[key] || null);   // nạp manifest ĐÚNG của dự án này
  if (!nanoQueue.length) { addLog(`⏭️ Dự án ${key} chưa có shot — bỏ qua.`, 'warning'); return advanceNanoRunAll(); }
  addLog(`▶️ Dự án ${key} (${nanoRunAllPos + 1}/${nanoRunAllKeys.length}) — tạo project Flow mới rồi chạy…`, 'info');
  await createFreshFlowProject();     // THOÁT → tạo project id MỚI cho dự án này
  invalidateNanoRun('chạy dự án ' + key + ' trong project Flow mới');
  runNanoPipeline();                  // ảnh → video → tải; xong sẽ gọi advanceNanoRunAll
}

// Sang dự án kế (gọi sau khi video dự án hiện tại tải xong / không có video).
async function advanceNanoRunAll() {
  if (!nanoRunAll) return;
  nanoRunAllPos++;
  if (nanoRunAllPos < nanoRunAllKeys.length) {
    addLog(`▶️ Xong 1 dự án → thoát ra, tạo project Flow mới cho dự án kế (${nanoRunAllPos + 1}/${nanoRunAllKeys.length})…`, 'info');
    await runNanoProjectAtRunAllPos();
  } else {
    nanoRunAll = false;
    addLog(`✅ Đã chạy xong TẤT CẢ ${nanoRunAllKeys.length} dự án nano — mỗi dự án 1 project Flow riêng.`, 'success');
  }
}

function clearNanoQueue() {
  if (!nanoManifest && !nanoQueue.length) { addLog('ℹ️ Nano Flow: chưa có dữ liệu nào để xóa.', 'info'); return; }
  const title = (nanoManifest && nanoManifest.project && nanoManifest.project.title) || '';
  if (!confirm(`Xóa manifest Nano Flow của Dự án ${curProj}${title ? ` ("${title}")` : ''}?\n\nGồm: manifest, hàng đợi shot, ảnh tham chiếu đã gắn, và kết quả ảnh/video đã lưu CỦA DỰ ÁN NÀY.\n(Các dự án khác + ảnh/video đã tạo trên Flow KHÔNG bị xóa.)`)) return;
  const nShots = nanoQueue.length;
  invalidateNanoRun('xóa manifest của dự án ' + curProj);
  nanoManifest = null;
  nanoQueue = [];
  nanoProjects = [];       // xóa manifest của DỰ ÁN HIỆN TẠI
  nanoActiveIndex = -1;
  nanoRunAll = false;
  chrome.storage.local.set({ nanoGenerationEpoch, nanoActiveRun: null });
  saveCurrentProject();    // gỡ manifest khỏi afProjects[curProj] (đặt nano=null)
  renderNanoProjects();
  // Reset ô chọn file để nạp lại cùng 1 file cũng kích hoạt 'change'.
  const imp = document.getElementById('nf-import-input'); if (imp) imp.value = '';
  document.querySelectorAll('.nf-asset-file').forEach((inp) => { inp.value = ''; });
  renderNanoQueue([]);
  renderNanoAssets();
  const status = document.getElementById('nf-status'); if (status) status.textContent = '';
  addLog(`🗑️ Đã xóa dữ liệu Nano Flow (${nShots} shot, manifest, ảnh ref).`, 'success');
}

// Dry-run (M3): show, step by step, what the extension WOULD do on Flow for the
// imported queue — without calling Flow. Lets the user verify sequencing/refs
// before the live Nano Banana image-generation call is wired.
function nanoDryRun() {
  if (!nanoQueue.length) {
    addLog('⚠️ Chưa nạp manifest — bấm "Nạp manifest" trước.', 'warning');
    return;
  }
  if (!window.NanoPipeline) {
    addLog('❌ Thiếu nano_pipeline.js', 'error');
    return;
  }
  const plan = window.NanoPipeline.buildQueuePlan(nanoQueue);
  document.querySelector('.tab-btn[data-tab="log"]')?.click();
  addLog('▶️ DRY-RUN Nano Storyboard — mô phỏng, KHÔNG gọi Flow:', 'info');
  window.NanoPipeline.planToLogLines(plan, lang).forEach((line) => addLog(line, ''));
  addLog(plan.ready
    ? '✅ Pipeline hợp lệ. Bấm "🍌 Tạo ảnh Nano (thật)" để chạy trên Flow.'
    : `⚠️ Còn thiếu ${plan.missingRefImageCount} ảnh ref — vẫn tạo được ảnh từ prompt, ref sẽ bỏ qua.`,
    plan.ready ? 'success' : 'warning');
}

// M3 live: gửi từng shot sang Flow để tạo ảnh Nano Banana thật, đặt tên, và
// nhận lại mediaId (lưu vào hàng đợi để bước video dùng làm khung đầu).
async function runNanoImages(options = {}) {
  if (!nanoQueue.length) { addLog('⚠️ Chưa nạp manifest.', 'warning'); return; }
  if (!window.NanoPipeline) { addLog('❌ Thiếu nano_pipeline.js', 'error'); return; }
  const tabId = await findFlowTab();
  if (!tabId) { addLog('❌ Chưa mở trang Flow (labs.google/fx) — mở 1 project rồi thử lại.', 'error'); return; }
  const flowProjectId = await flowProjectIdForTab(tabId);
  if (!flowProjectId) { addLog('❌ Tab Flow không có project ID hợp lệ — mở đúng URL /project/... rồi thử lại.', 'error'); return; }
  const runContext = ensureNanoRun(flowProjectId, options.reuseRun === true);
  if (!runContext) { addLog('❌ Không tạo được phiên Nano độc lập cho dự án này.', 'error'); return; }
  const plan = window.NanoPipeline.buildQueuePlan(nanoQueue);
  const rawItems = plan.plans.map((p) => {
    // Ảnh bối cảnh user nạp cho RIÊNG shot này (nếu có). KHÔNG đính thô nữa: dùng
    // làm NGUỒN để extension "quét" ra SHEET BỐI CẢNH 2 góc — GIỐNG trường hợp không
    // ảnh (theo yêu cầu user) — để board/Veo luôn nhận 1 sheet bối cảnh thống nhất.
    const qItem = nanoQueue.find((q) => q.shotId === p.shotId);
    const uploadedLoc = (qItem && qItem.boardLocationImage) || '';
    // Board model: giữ ref CÓ ảnh thật (sheet nhân vật / sản phẩm) VÀ ref BỐI CẢNH
    // khai location_views để extension TẠO "SHEET BỐI CẢNH" 2 góc rồi ghép vào board.
    let sheetHasLoc = false;
    const refs = p.imageStep.refs
      .filter((r) => r.image || (r.kind === 'environments'
        && Array.isArray(r.locationViews) && r.locationViews.length))
      .map((r) => {
        const isEnvSheet = r.kind === 'environments' && !r.image
          && Array.isArray(r.locationViews) && r.locationViews.length;
        if (isEnvSheet) sheetHasLoc = true;
        return {
          kind: r.kind, id: r.id, name: r.name, data: r.image, wardrobe: r.wardrobe || '',
          locationViews: isEnvSheet ? r.locationViews : null,
          // Ảnh NẠP làm NGUỒN để quét ra sheet bối cảnh 2 góc (giống ảnh nhân vật → sheet).
          locationSourceImage: isEnvSheet ? uploadedLoc : '',
        };
      });
    // Dự phòng (đường Cách 1 cũ, KHÔNG xoá): shot có ảnh nạp NHƯNG không có ref sheet
    // bối cảnh (vd location 'custom' app không khai location_views) → vẫn đính ảnh
    // nạp trực tiếp để không mất bối cảnh.
    if (uploadedLoc && !sheetHasLoc) {
      refs.push({ kind: 'environments', id: 'board_loc_' + p.shotId, name: 'Bối cảnh (ảnh nạp)', data: uploadedLoc, wardrobe: '', locationViews: null, locationSourceImage: '' });
    }
    return {
      shotId: p.shotId,
      index: p.index,
      name: p.name,
      // Board model: KHÔNG nối keyframe trước (bỏ end/start frame chaining).
      chainFromPrev: p.chainFromPrev,
      frameMode: p.frameMode || (p.endImageStep ? 'start_end' : 'start'),
      frameRole: p.frameRole || null,
      prompt: p.imageStep.prompt,
      videoKeyframePrompt: p.videoKeyframeStep ? p.videoKeyframeStep.prompt : '',
      // Transform shot: also generate the END keyframe (start_end_frame). §6.2
      endPrompt: p.endImageStep ? p.endImageStep.prompt : '',
      // Đổi trang phục từ shot này (nếu manifest khai) → tạo lại wardrobe sheet.
      wardrobeChange: p.wardrobeChange || null,
      refs: refs,
    };
  });
  const items = rawItems.map((item) => window.NanoSession.stampItem(item, runContext));
  // Gợi ý bối cảnh cho sheet trang phục khi manifest không khai costume cụ thể.
  const sceneHint = String((plan.plans[0] && plan.plans[0].imageStep.prompt) || '').slice(0, 300);
  // Ảnh BOARD LUÔN 16:9 (landscape) — app cố định project.board_aspect_ratio="16:9".
  // Sheet rộng mô tả đúng nhân vật + bố cục nhiều panel → video chất lượng hơn.
  // KHÔNG theo tỉ lệ VIDEO (9:16/1:1) và bỏ qua dropdown để board không bị bóp dọc.
  const boardAspect = (nanoManifest && nanoManifest.project && nanoManifest.project.board_aspect_ratio) || '16:9';
  const aspect = boardAspect === '9:16' ? 'IMAGE_ASPECT_RATIO_PORTRAIT'
    : boardAspect === '1:1' ? 'IMAGE_ASPECT_RATIO_SQUARE'
    : 'IMAGE_ASPECT_RATIO_LANDSCAPE';
  const videoAspect = (nanoManifest && nanoManifest.project && nanoManifest.project.aspect_ratio) || '16:9';
  const videoKeyframeAspect = videoAspect === '9:16' ? 'IMAGE_ASPECT_RATIO_PORTRAIT'
    : videoAspect === '1:1' ? 'IMAGE_ASPECT_RATIO_SQUARE'
    : 'IMAGE_ASPECT_RATIO_LANDSCAPE';
  const model = document.getElementById('nf-model')?.value || 'GEM_PIX_2';
  // THUMBNAIL TRƯỚC BOARD (theo yêu cầu user): gửi kèm prompt thumbnail để inject
  // tạo NGAY sau sheet nhân vật, TRƯỚC khi dựng board — không để tới cuối lúc dựng
  // video (dễ lỗi). Khung theo project.thumbnail_aspect_ratio (mặc định 9:16 dọc).
  const proj = (nanoManifest && nanoManifest.project) || {};
  const thumbnailPrompt = String(proj.thumbnail_prompt || '').trim();
  const thumbnailAspect = proj.thumbnail_aspect_ratio === '16:9'
    ? 'IMAGE_ASPECT_RATIO_LANDSCAPE' : 'IMAGE_ASPECT_RATIO_PORTRAIT';
  const thumbnailTitle = String(proj.thumbnail_title || proj.title || '').trim();
  document.querySelector('.tab-btn[data-tab="log"]')?.click();
  // DIAGNOSTIC: show EXACTLY which tab we target — a wrong/second Flow tab is a
  // common reason "Gửi N shot" is followed by silence (the command lands in a tab
  // where no project is open / inject isn't the one you're watching).
  try {
    const t = await chrome.tabs.get(tabId);
    addLog(`🎯 Gửi tới tab #${tabId}: ${String(t && t.url || '').slice(0, 90)}`, 'info');
  } catch (e) { addLog(`🎯 Gửi tới tab #${tabId} (không đọc được URL tab)`, 'warning'); }
  addLog(`🍌 Gửi ${items.length} shot sang Flow để tạo ảnh Nano Banana (${model})${thumbnailPrompt ? ' · thumbnail tạo TRƯỚC board' : ''} · run=${runContext.runId.slice(0, 12)}…`, 'info');
  chrome.tabs.sendMessage(tabId, {
    action: 'GEN_NANO_IMAGES',
    items,
    aspect,
    model,
    sceneHint,
    thumbnailPrompt,
    thumbnailAspect,
    thumbnailTitle,
    videoKeyframeAspect,
    ...activeNanoEnvelope(),
  }, (resp) => {
    if (chrome.runtime.lastError) {
      nanoPipelineAuto = false; // gửi hỏng → hủy nối video, tránh kẹt cờ
      addLog(`❌ Không gửi được lệnh tới trang Flow: ${chrome.runtime.lastError.message}. Tab Flow có thể chưa nạp content script — F5 tab Flow rồi thử lại.`, 'error');
      return;
    }
    // Ack TRỰC TIẾP từ content script (không qua relay) → luôn thấy trong Nhật ký.
    if (resp && resp.success === false && resp.reason === 'no-project') {
      nanoPipelineAuto = false;
      addLog(`❌ Tab Flow đang mở KHÔNG phải 1 project (URL: ${String(resp.url || '').slice(0, 80)}). Mở đúng 1 project (URL có /project/…) rồi bấm lại.`, 'error');
      return;
    }
    if (resp && resp.success) {
      addLog(`📨 Content script đã nhận · project=${String(resp.pid || '').slice(0, 8)} · inject(hook trang)=${resp.injectSeen ? 'ĐÃ NẠP' : 'CHƯA NẠP → tự nạp lại…'}. Đang chờ trang Flow tạo ảnh…`, resp.injectSeen ? 'info' : 'warning');
      if (!resp.injectSeen) nanoPipelineAuto = false;
      return;
    }
    // Catch-all: content script trả lời một dạng KHÔNG mong đợi (hoặc rỗng) →
    // in nguyên văn để biết đứt ở đâu thay vì im lặng tới lúc watchdog kêu.
    addLog(`⚠️ Phản hồi lạ từ content script: ${JSON.stringify(resp || null).slice(0, 200)}. Nếu sau đó không có "▶️ Trang Flow nhận lệnh…" thì content script/inject của tab này có vấn đề — F5 tab Flow.`, 'warning');
  });
}

function applyNanoImageResults(results) {
  nanoPipelineTick = Date.now(); // Flow responded → cancel the watchdog warning
  if (!Array.isArray(results)) return;
  let n = 0;
  results.forEach((r) => {
    if (!r || !r.mediaId) return;
    const item = findNanoQueueResult(r);
    if (item) {
      item.generated = {
        mediaId: r.mediaId, workflowId: r.workflowId || '', name: r.name || '',
        videoKeyframeMediaId: r.videoKeyframeMediaId || '',
        videoKeyframeWorkflowId: r.videoKeyframeWorkflowId || '',
        // END keyframe of a transform shot (may be absent).
        endMediaId: r.endMediaId || '', endWorkflowId: r.endWorkflowId || '',
        frameMode: r.frameMode || 'start', endError: r.endError || '',
        // Ảnh BẢNG NHÂN VẬT (wardrobe sheet) đã dùng cho keyframe này → bước video
        // nạp lại cùng keyframe làm reference asset (r2v) để khóa mặt + trang phục.
        sheetMediaIds: Array.isArray(r.sheetMediaIds) ? r.sheetMediaIds : [],
        productMediaIds: Array.isArray(r.productMediaIds) ? r.productMediaIds : [],
        // Ảnh BỐI CẢNH user nạp → bước video dùng làm reference SẠCH (thay board).
        locationMediaId: r.locationMediaId || '',
        // Ảnh SHEET BỐI CẢNH (wide+alt) extension tự tạo cho board này → bước video
        // nạp lại làm reference (r2v) để Veo khóa đúng bối cảnh (không tự bịa cảnh).
        locationSheetIds: Array.isArray(r.locationSheetIds) ? r.locationSheetIds : [],
      };
      item.status = 'image-done';
      n++;
    }
  });
  if (nanoManifest) persistNanoProjects();  // B2
  renderNanoQueue([]);
  addLog(n ? `🍌 Đã lưu ${n} mediaId ảnh vào hàng đợi. Bước tiếp: bấm "🎬 Tạo video" để dựng clip từ các ảnh này (M5).`
           : '⚠️ Không có ảnh nào tạo thành công — xem log lỗi ở trên.',
    n ? 'success' : 'warning');
}

// Thumbnail TÍCH HỢP vào luồng chạy manifest (thay nút "Tạo thumbnail" riêng).
// Chỉ chạy khi manifest có project.thumbnail_prompt; mọi lỗi được nuốt để KHÔNG
// làm hỏng chuỗi ảnh→video. Gọi sau bước ảnh nên sheet nhân vật đã sẵn (khoá mặt).
function maybeAutoThumbnail() {
  try {
    const hasPrompt = !!(nanoManifest && nanoManifest.project
      && String(nanoManifest.project.thumbnail_prompt || '').trim());
    if (!hasPrompt) return; // manifest cũ không có prompt thumbnail → bỏ qua im lặng
    addLog('🖼️ Tự tạo thumbnail (đã tích hợp vào luồng chạy)…', 'info');
    runNanoThumbnail();
  } catch (e) {
    addLog('⚠️ Bỏ qua thumbnail tự động: ' + ((e && e.message) || e), 'warning');
  }
}

// 🖼️ THUMBNAIL — sinh 1 ảnh thumbnail giật tít từ project.thumbnail_prompt (app
// viết). Ưu tiên đính SHEET NHÂN VẬT đã tạo cho các board (mediaId sẵn trên Flow
// → khóa mặt, không tốn lượt tạo lại); chưa tạo board thì fallback ảnh nhận dạng
// gốc. Ảnh ra nằm trong gallery/dự án Flow, user tải về dùng làm thumbnail.
async function runNanoThumbnail() {
  if (!nanoManifest) { addLog('⚠️ Chưa nạp manifest.', 'warning'); return; }
  const prompt = String((nanoManifest.project && nanoManifest.project.thumbnail_prompt) || '').trim();
  if (!prompt) { addLog('⚠️ Manifest này chưa có prompt thumbnail (project.thumbnail_prompt). Hãy tạo lại kịch bản trên web (bản mới) rồi nạp lại file .nanoflow.json.', 'warning'); return; }
  const tabId = await findFlowTab();
  if (!tabId) { addLog('❌ Chưa mở trang Flow (labs.google/fx) — mở 1 project rồi thử lại.', 'error'); return; }
  const flowProjectId = await flowProjectIdForTab(tabId);
  if (!flowProjectId) { addLog('❌ Tab Flow không có project ID hợp lệ.', 'error'); return; }
  const runContext = ensureNanoRun(flowProjectId, true);
  if (!runContext) { addLog('❌ Không tạo được phiên thumbnail Nano độc lập.', 'error'); return; }
  // Ưu tiên: sheet nhân vật ĐÃ tạo (union mediaId qua các shot) → khóa mặt.
  const sheetSet = new Set();
  nanoQueue.forEach((q) => {
    const ids = q && q.generated && q.generated.sheetMediaIds;
    if (Array.isArray(ids)) ids.forEach((m) => { if (m) sheetSet.add(m); });
  });
  const sheetMediaIds = Array.from(sheetSet);
  // Fallback: ảnh nhận dạng gốc user nạp ở phần 👤 Nhân vật (khi chưa tạo board).
  const characterRefs = [];
  ((nanoManifest.assets && nanoManifest.assets.characters) || []).forEach((c) => {
    const data = c && (c.image || (Array.isArray(c.images) && c.images[0]));
    if (data) characterRefs.push({ name: c.name || 'char', data });
  });
  const productRefs = [];
  ((nanoManifest.assets && nanoManifest.assets.products) || []).forEach((product) => {
    const data = product && (product.image || (Array.isArray(product.images) && product.images[0]));
    if (data) productRefs.push({ name: product.name || 'product', data });
  });
  // Khung: dropdown thắng; nếu không, theo aspect dự án (mặc định 9:16 dọc).
  const aspectSel = document.getElementById('nf-aspect')?.value || '';
  const aspect = aspectSel
    || ((nanoManifest.project && nanoManifest.project.aspect_ratio === '16:9')
      ? 'IMAGE_ASPECT_RATIO_LANDSCAPE' : 'IMAGE_ASPECT_RATIO_PORTRAIT');
  const model = document.getElementById('nf-model')?.value || 'GEM_PIX_2';
  const title = (nanoManifest.project && (nanoManifest.project.thumbnail_title || nanoManifest.project.title)) || '';
  document.querySelector('.tab-btn[data-tab="log"]')?.click();
  if (!sheetMediaIds.length && !characterRefs.length) {
    addLog('⚠️ Chưa có sheet nhân vật lẫn ảnh nhận dạng — thumbnail sẽ tạo từ prompt trần (mặt có thể không khớp). Nên bấm "🍌 Chỉ tạo ảnh" trước để có sheet rồi tạo thumbnail.', 'warning');
  } else if (!sheetMediaIds.length) {
    addLog('ℹ️ Chưa tạo board nên dùng ảnh nhận dạng gốc làm ref. Muốn khóa mặt chuẩn hơn: tạo ảnh board trước rồi bấm lại nút này.', 'info');
  }
  addLog(`🖼️ Gửi lệnh tạo THUMBNAIL sang Flow (ref: ${productRefs.length ? 'sản phẩm + ' : ''}${sheetMediaIds.length ? sheetMediaIds.length + ' sheet nhân vật' : characterRefs.length + ' ảnh nhận dạng'})…`, 'info');
  chrome.tabs.sendMessage(tabId, {
    action: 'GEN_NANO_THUMB', prompt, sheetMediaIds, characterRefs, productRefs, aspect, model, title, ...activeNanoEnvelope(),
  }, (resp) => {
    if (chrome.runtime.lastError) {
      addLog(`❌ Không gửi được lệnh tới trang Flow: ${chrome.runtime.lastError.message}. F5 tab Flow rồi thử lại.`, 'error');
      return;
    }
    if (resp && resp.success === false && resp.reason === 'no-project') {
      addLog('❌ Tab Flow đang mở KHÔNG phải 1 project. Mở đúng 1 project (URL có /project/…) rồi bấm lại.', 'error');
      return;
    }
    if (resp && resp.success) addLog('📨 Content script đã nhận lệnh thumbnail. Đang chờ trang Flow tạo ảnh…', resp.injectSeen ? 'info' : 'warning');
  });
}

// Nút "Bắt đầu" tổng cho Nano Flow: chạy liền mạch TẠO ẢNH → (chờ xong) → TẠO VIDEO.
// runNanoImages gửi GEN_NANO_IMAGES; khi NANO_IMAGES_DONE về, listener sẽ tự gọi
// runNanoVideos vì cờ nanoPipelineAuto đang bật.
async function runNanoPipeline() {
  if (!nanoQueue.length) { addLog('⚠️ Chưa nạp manifest Nano Flow.', 'warning'); return; }
  if (!window.NanoPipeline) { addLog('❌ Thiếu nano_pipeline.js', 'error'); return; }
  const tabId = await findFlowTab();
  if (!tabId) { addLog('❌ Chưa mở trang Flow (labs.google/fx) — mở 1 project rồi thử lại.', 'error'); return; }
  document.querySelector('.tab-btn[data-tab="log"]')?.click();
  addLog('▶️ BẮT ĐẦU pipeline Nano Flow: tạo ảnh keyframe → tự động dựng video.', 'info');
  nanoPipelineAuto = true;
  nanoPipelineTick = Date.now();
  // ĐỒNG HỒ CẢNH BÁO: nếu 40s không thấy trang Flow báo nhận lệnh (dòng "▶️
  // Trang Flow nhận lệnh…"/kết quả ảnh) → nhắc user F5 + mở project, thay vì
  // treo im lặng. Tự huỷ khi ảnh xong (applyNanoImageResults cập nhật tick).
  const startedAt = nanoPipelineTick;
  setTimeout(() => {
    // Nếu tick chưa nhúc nhích sau 75s = trang Flow chưa hề phản hồi (thường do
    // inject chưa nạp / chưa mở project). Nếu đang chạy bình thường thì bỏ qua.
    if (nanoPipelineAuto && nanoPipelineTick === startedAt) {
      addLog('⏳ Chưa thấy trang Flow phản hồi tạo ảnh sau 75s. XEM 4 dòng chẩn đoán ở trên để biết đứt ở đâu: 🎯 (gửi tới tab nào) → 📥 (content_script nhận chưa) → 📤 (đã chuyển vào trang chưa) → ▶️ (trang Flow nhận lệnh chưa). Dòng CUỐI cùng bạn thấy = điểm đứt. Nếu THIẾU 📥 → sai tab/tab chưa nạp content script (F5 tab Flow). Thiếu ▶️ mà có 📤 → hook trang lỗi (F5). Copy nguyên khúc Nhật ký này gửi mình.', 'warning');
    }
  }, 75000);
  await runNanoImages({ reuseRun: false }); // NANO_IMAGES_DONE sẽ nối sang video (xem listener)
}

// M5 live: dựng video 10s cho từng shot, dùng ảnh keyframe vừa tạo làm KHUNG ĐẦU
// (§6). Chỉ chạy các shot đã có generated.mediaId từ bước ảnh.
async function runNanoVideos(options = {}) {
  if (!nanoQueue.length) { nanoThumbnailAfterVideos = false; addLog('⚠️ Chưa nạp manifest.', 'warning'); return; }
  if (!window.NanoPipeline) { nanoThumbnailAfterVideos = false; addLog('❌ Thiếu nano_pipeline.js', 'error'); return; }
  const tabId = await findFlowTab();
  if (!tabId) { nanoThumbnailAfterVideos = false; addLog('❌ Chưa mở trang Flow (labs.google/fx) — mở 1 project rồi thử lại.', 'error'); return; }
  const flowProjectId = await flowProjectIdForTab(tabId);
  if (!flowProjectId) { nanoThumbnailAfterVideos = false; addLog('❌ Tab Flow không có project ID hợp lệ.', 'error'); return; }
  const runContext = ensureNanoRun(flowProjectId, options.reuseRun === true);
  if (!runContext) { nanoThumbnailAfterVideos = false; addLog('❌ Không tạo được phiên video Nano độc lập.', 'error'); return; }

  const plan = window.NanoPipeline.buildQueuePlan(nanoQueue);
  const items = [];
  let skippedNoImage = 0;
  plan.plans.forEach((p) => {
    const q = nanoQueue.find((it) => (p.shotId && it.shotId === p.shotId) || it.index === p.index);
    const gen = q && q.generated;
    // KHUNG ĐẦU VIDEO = ẢNH BOARD của shot (gen.mediaId) — đúng cách chạy tay 1.81.
    // Clean keyframe chỉ dùng nếu sẵn có; KHÔNG bắt buộc, KHÔNG chặn video khi thiếu.
    const startImageMediaId = (gen && gen.mediaId) || (gen && gen.videoKeyframeMediaId) || '';
    if (!startImageMediaId) { skippedNoImage++; return; } // chưa tạo ảnh board → bỏ qua shot này
    const expectedFrameMode = (gen && gen.frameMode) || p.frameMode || (p.endImageStep ? 'start_end' : 'start');
    if (expectedFrameMode === 'start_end' && !(gen && gen.endMediaId)) {
      addLog(`⚠️ ${p.name}: đã chọn 2 frame nhưng KHUNG CUỐI chưa tạo sạch${gen && gen.endError ? ' — ' + gen.endError : ''}. Chạy lại bước ảnh; không gửi nhầm video 1 frame.`, 'warning');
      return;
    }
    items.push(window.NanoSession.stampItem({
      shotId: p.shotId,
      index: p.index,
      name: p.name,
      durationSeconds: p.durationSeconds || 10,
      prompt: p.videoStep.prompt,
      voice: p.videoStep.voice || null,
      startImageMediaId,
      // Transform shot: end keyframe → start_end_frame (Veo interpolates). §6.2
      endImageMediaId: (gen && gen.endMediaId) || '',
      frameMode: expectedFrameMode,
      // ẢNH BẢNG NHÂN VẬT (wardrobe sheet) của shot này → bước video nạp CÙNG
      // keyframe làm reference asset (r2v), đúng như Flow tự làm khi bấm tay
      // (trace 24/7): mặt + BỘ ĐỒ KHÓA của nhân vật bám chắc trong clip thay vì
      // trôi dạt từ mỗi keyframe. genNanoVideos tự fallback start_frame nếu bị từ chối.
      // Bước video đưa ẢNH BOARD vào Veo. Ref bổ sung:
      // SHEET NHÂN VẬT (khóa mặt/đồ) + SHEET BỐI CẢNH (khóa cảnh) — cùng keyframe
      // genNanoVideos giới hạn tổng ref (BOARD + tối đa 3) nên nhân vật
      // đứng trước, sheet bối cảnh bổ sung nếu còn chỗ; dù bị cắt, bối cảnh vẫn nằm
      // và bối cảnh được bổ sung theo số slot còn lại.
      // Affiliate priority under Flow's 4-ref ceiling: BOARD is first inside
      // inject.js, then one canonical PRODUCT, then character sheets, then a
      // location sheet only if a slot remains. Non-affiliate arrays are empty,
      // preserving the exact 1.8.6 behaviour.
      referenceMediaIds: [
        ...((gen && Array.isArray(gen.productMediaIds)) ? gen.productMediaIds.slice(0, 1) : []),
        ...((gen && Array.isArray(gen.sheetMediaIds)) ? gen.sheetMediaIds : []),
        ...((gen && Array.isArray(gen.locationSheetIds)) ? gen.locationSheetIds : []),
      ],
    }, runContext));
  });

  items.forEach((item) => {
    const q = nanoQueue.find((entry) => entry && entry.shotId === item.shotId);
    const gen = q && q.generated;
    const order = [
      'BOARD',
      ...((gen && gen.productMediaIds && gen.productMediaIds.length) ? ['PRODUCT'] : []),
      ...((gen && gen.sheetMediaIds) || []).map(() => 'CHARACTER_SHEET'),
      ...((gen && gen.locationSheetIds) || []).map(() => 'LOCATION_SHEET'),
    ].slice(0, 4);
    addLog(`🔗 ${item.name}: Veo ref order = ${order.join(' → ')}`, 'info');
  });

  if (!items.length) {
    nanoThumbnailAfterVideos = false;
    addLog(skippedNoImage
      ? `⚠️ Chưa có shot nào có ẢNH BOARD — bấm "🍌 Tạo ảnh Nano" tạo ảnh trước, rồi mới "🎬 Tạo video".`
      : '⚠️ Không có shot hợp lệ để tạo video.', 'warning');
    return;
  }

  // Tỉ lệ VIDEO = lựa chọn của APP (manifest.project.aspect_ratio) LÀM CHỦ, để
  // KHÔNG lệch app↔Veo (app 16:9 mà Veo 9:16 = video sai). Veo chỉ có dọc/ngang;
  // 1:1 (không có ở Veo) tạm dựng ngang và báo rõ. Dropdown chỉ dùng khi manifest
  // không khai tỉ lệ.
  const aspectSel = document.getElementById('nf-aspect')?.value || '';
  const projAspect = (nanoManifest && nanoManifest.project && nanoManifest.project.aspect_ratio) || '';
  let aspect;
  if (projAspect === '9:16') aspect = 'portrait';
  else if (projAspect === '16:9') aspect = 'landscape';
  else if (projAspect === '1:1') { aspect = 'landscape'; addLog('ℹ️ Veo chưa hỗ trợ video 1:1 — dựng ngang 16:9. (Ảnh board vẫn 16:9.)', 'info'); }
  else aspect = /PORTRAIT|9:16|portrait/i.test(aspectSel) ? 'portrait' : 'landscape';
  // Model + độ dài LẤY TỪ CÀI ĐẶT TỔNG (gồm cả omni) — không dùng dropdown riêng,
  // để Nano Flow và tạo video thường dùng chung 1 chỗ cấu hình.
  const NF_MODEL_MAP = { 'omni-flash': 'omni_flash', 'veo31-lite': 'lite', 'veo31-fast': 'fast', 'veo31-quality': 'quality' };
  const model = NF_MODEL_MAP[settings.model] || 'lite';
  const duration = Math.max(4, Math.min(10, settings.duration || DEFAULT_SETTINGS.duration));

  document.querySelector('.tab-btn[data-tab="log"]')?.click();
  addLog(`🎬 Gửi ${items.length} shot sang Flow để dựng video (model ${model} từ Cài đặt, ${duration}s, keyframe = khung đầu)…`, 'info');
  if (skippedNoImage) addLog(`ℹ️ Bỏ qua ${skippedNoImage} shot chưa có ảnh keyframe.`, 'info');
  // XÓA danh sách video đã thu của LƯỢT/DỰ ÁN TRƯỚC trước khi dựng video mới, để bước
  //   "Tự tải video Nano" chỉ tải đúng video của dự án này. Trước đây bước này bị thiếu
  //   (chỉ đường chạy chuỗi mới xóa) nên dự án sau tải gộp cả video dự án trước.
  await sendToContentAwait({ action: 'CLEAR_GENERATED_VIDEOS' }, 10000);
  chrome.tabs.sendMessage(tabId, {
    action: 'GEN_NANO_VIDEOS', items, aspect, model, duration, ...activeNanoEnvelope(),
  }, () => {
    if (chrome.runtime.lastError) addLog('❌ Không gửi được — F5 trang Flow rồi thử lại.', 'error');
  });
}

function applyNanoVideoResults(results) {
  if (!Array.isArray(results)) return;
  let n = 0;
  results.forEach((r) => {
    if (!r || (!r.workflowId && !r.videoMediaId)) return;
    const item = findNanoQueueResult(r);
    if (item) {
      item.video = { workflowId: r.workflowId || '', mediaId: r.videoMediaId || '', name: r.name || '' };
      item.status = 'video-done';
      n++;
    }
  });
  if (nanoManifest) persistNanoProjects();  // B2
  renderNanoQueue([]);
  addLog(n ? `🎬 Đã gửi ${n} video sang Flow.`
           : '⚠️ Không có video nào gửi được — xem log lỗi ở trên.',
    n ? 'success' : 'warning');
  // B3: TỰ TẢI video Nano khi render xong. Trước đây hàm này chỉ GHI mediaId rồi báo
  // "chờ tải tay" — không hề gọi tải, nên "tải video" không hoạt động sau manifest.
  if (n && settings.autoDownload) {
    autoDownloadNanoVideos();   // B2: sẽ tự sang dự án kế sau khi tải xong (nếu runAll)
  } else if (nanoRunAll) {
    advanceNanoRunAll();        // B2: không bật tải → sang dự án kế ngay
  }
}

// B3 — chờ Flow render xong các video Nano rồi tự tải (tái dùng đường
// DOWNLOAD_GENERATED_AND_WAIT vốn dùng cho chuỗi dự án).
async function autoDownloadNanoVideos() {
  addLog('⬇️ Tự tải video Nano — chờ Flow render xong rồi tải (có thể vài phút)…', 'info');
  try {
    const title = (nanoManifest && nanoManifest.project && nanoManifest.project.title) || 'NanoFlow';
    const dl = await sendToContentAwait({
      action: 'DOWNLOAD_GENERATED_AND_WAIT',
      upsampled: settings.downloadQuality !== '720',
      quality: settings.downloadQuality || '720',
      downloadBaseName: title,
    }, 30 * 60 * 1000);
    addLog(
      dl && dl.success
        ? `⬇️ Đã tải ${dl.okCount || 0}/${dl.total || 0} video Nano ✅`
        : `⚠️ Chưa tải xong video Nano (${(dl && dl.error) || 'hết thời gian chờ / chưa render'}) — bấm nút tải thủ công nếu cần.`,
      dl && dl.success ? 'success' : 'warning'
    );
  } catch (e) {
    addLog('⚠️ Lỗi tải video Nano: ' + ((e && e.message) || e), 'warning');
  }
  if (nanoRunAll) advanceNanoRunAll();   // B2: tải xong dự án này → sang dự án kế
}

function addLog(msg, type = '') {
  const container = document.getElementById('log-container');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  entry.innerHTML = `<span class="log-time">${time}</span><span class="log-msg ${type}">${escapeHtml(msg)}</span>`;
  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;
  saveLogs();
}

function saveLogs() {
  const entries = document.getElementById('log-container').innerHTML;
  chrome.storage.local.set({ logs: entries });
}

function restoreLogs(html) {
  if (html) document.getElementById('log-container').innerHTML = html;
}

function renderResultPreview(results) {
  const box = document.getElementById('result-preview');
  const list = document.getElementById('result-preview-list');
  if (!box || !list) return;
  const rows = Array.isArray(results) ? results.filter(Boolean) : [];
  if (!rows.length) {
    box.classList.add('hidden');
    list.innerHTML = '';
    return;
  }
  list.innerHTML = rows.map((r) => {
    const wf = r.workflowId ? String(r.workflowId).slice(0, 12) : 'đang xử lý';
    return `<div class="result-preview-item">#${r.index || '?'} · ${escapeHtml(r.prompt || '')}<br>workflow: ${escapeHtml(wf)}</div>`;
  }).join('');
  box.classList.remove('hidden');
}

function projectHasPromptContent(project) {
  if (!project) return false;
  if (splitPromptBlocks(project.prompts || '').length) return true;
  return Array.isArray(project.storyboard) && project.storyboard.some((item) => String(item.prompt || '').trim());
}

function unlockLogPanel() {
  const input = document.getElementById('log-password');
  const val = input ? input.value : '';
  if (val !== '0208') {
    if (input) {
      input.value = '';
      input.placeholder = t('apilock_wrong');
      input.focus();
    }
    return;
  }
  document.getElementById('log-lock')?.classList.add('hidden');
  document.getElementById('log-private')?.classList.remove('hidden');
}

// ========================
// MESSAGE HANDLER
// ========================
function handleMessage(msg, sender) {
  const L = LANG[lang];

  if (sender && sender.tab) {
    connectedTabId = sender.tab.id;
  }

  switch (msg.type) {
    case 'LOG':
      addLog(msg.message || '', msg.level || 'info');
      // Bất kỳ log nào từ trang Flow gửi về trong lúc pipeline chạy = Flow ĐANG
      // phản hồi → đẩy mốc watchdog để KHÔNG báo nhầm "chưa phản hồi sau 75s"
      // trong khi đang tạo ảnh toàn thân (mỗi ảnh ~30s, dễ vượt 75s trước khung
      // đầu tiên). Watchdog chỉ còn kêu khi THỰC SỰ im lặng.
      if (nanoPipelineAuto) nanoPipelineTick = Date.now();
      break;

    case 'PROGRESS':
      showProgress(msg.current, msg.total);
      updateQueueItem(msg.current - 1, 'active');
      addLog(`${L.log_submitting} ${msg.current}/${msg.total}: ${(msg.promptText || '').substring(0, 45)}`, 'info');
      // Save queue state for recovery
      saveQueueState(msg.current - 1);
      break;

    case 'WAITING':
      addLog(L.log_waiting, '');
      break;

    case 'PROMPT_DONE':
      updateQueueItem(msg.index, 'done');
      addLog(`${L.log_completed} #${msg.index + 1}`, 'success');
      // Update saved queue state
      saveQueueState(msg.index + 1);
      break;

    case 'DOWNLOADING':
      addLog(L.log_downloading, 'info');
      break;

    case 'DOWNLOADED':
      addLog(L.log_downloaded, 'success');
      break;

    case 'ERROR':
      if (pendingCharacterEntitySetup) {
        pendingCharacterEntitySetup.resolve(false);
        pendingCharacterEntitySetup = null;
      }
      if (pendingCharacterRefSetup) {
        pendingCharacterRefSetup.resolve(false);
        pendingCharacterRefSetup = null;
      }
      addLog(`${L.log_error}: ${msg.message}`, 'error');
      if (msg.index !== undefined) updateQueueItem(msg.index, 'error');
      break;

    case 'SKIPPED':
      addLog(`${L.log_skipped}: ${msg.reason}`, 'warning');
      if (msg.index !== undefined) updateQueueItem(msg.index, 'skipped');
      break;

    case 'RETRYING':
      addLog(L.log_retrying, 'warning');
      break;

    case 'APPLYING_SETTINGS':
      addLog(L.log_applying, 'info');
      break;

    case 'CHAR_PROGRESS': {
      const st = document.getElementById('char-status');
      if (st) st.textContent = `⏳ Đang tạo nhân vật ${msg.current}/${msg.total}${msg.name ? ' — ' + msg.name : ''}${msg.voice ? ' · voice ' + msg.voice : ''}...`;
      break;
    }
    case 'CHAR_DONE': {
      const st = document.getElementById('char-status');
      // KHỬ TRÙNG theo entityId VÀ theo TÊN (giữ bản mới nhất) — chặn mọi đường dồn đôi
      //   nhân vật vào referenceEntities khi tạo video.
      {
        const raw = (Array.isArray(msg.entities) ? msg.entities : []).filter((e) => e && (e.entityId || e.id));
        const byKey = new Map();
        for (const e of raw) byKey.set((e.name || '').trim().toLowerCase() || (e.entityId || e.id), e);
        preparedCharacterEntities = [...byKey.values()];
        addLog(`👤 Entity dùng cho video: ${preparedCharacterEntities.map((e) => `${e.name || '?'}(${String(e.entityId || e.id).slice(0, 6)})`).join(', ') || '(trống)'}`, 'info');
      }
      if (st) st.textContent = `✅ Đã nạp ${msg.count} nhân vật vào Flow${preparedCharacterEntities.length ? ` · ${preparedCharacterEntities.length} entityId` : ''}.`;
      currentProjectEntityReady = preparedCharacterEntities.length > 0 || !!msg.count;
      saveCurrentProject();
      if (pendingCharacterEntitySetup) {
        pendingCharacterEntitySetup.resolve(true);
        pendingCharacterEntitySetup = null;
      }
      break;
    }
    case 'CHAR_REF_DONE': {
      const st = document.getElementById('char-status');
      if (st) st.textContent = `${msg.ok ? '✅' : '❌'} ${msg.text || 'Đã xử lý ảnh ref nhân vật.'}`;
      preparedCharacterRefMedia = Array.isArray(msg.refs) ? msg.refs : [];
      if (pendingCharacterRefSetup) {
        pendingCharacterRefSetup.resolve(!!msg.ok);
        pendingCharacterRefSetup = null;
      }
      break;
    }
    case 'CHAIN_LOG':
      // Tiến trình chuỗi nền (background) — chỉ hiển thị khi panel đang mở.
      addLog(msg.text || '', msg.level || 'info');
      break;
    case 'CHAIN_DONE':
      state = 'idle';
      chrome.storage.local.set({ state: 'idle' });
      if (!settings.keepAlive) stopKeepAlive();
      updateStatus();
      showIdleControls();
      addLog(msg.stopped ? '⏹️ Chuỗi nền đã dừng.' : '🏁 Chuỗi nền đã chạy xong tất cả dự án.', msg.stopped ? 'warning' : 'success');
      break;
    case 'BULK_DONE': {
      addLog(`📦 Bulk: ${msg.text || (msg.ok ? 'xong' : 'lỗi')}`, msg.ok ? 'success' : 'error');
      renderResultPreview(msg.results || []);
      // Đây mới là kết thúc bước TẠO của một dự án trong chuỗi; background còn phải
      // chờ render, tải và chuyển project. Không trả UI về idle/cho tab bị discard.
      if (msg.chainRunId && msg.projectRunId) {
        state = 'running';
        chrome.storage.local.set({ state: 'running' });
        updateStatus();
        showRunningControls();
        break;
      }
      state = msg.ok ? 'done' : 'idle';
      chrome.storage.local.set({ state: 'idle' });
      // Hết lượt tạo: nếu KHÔNG bật tự-động-tải thì bỏ khoá discard + tắt keep-alive.
      //   Nếu CÓ tự-động-tải: content_script vẫn đang chờ render & tải nhiều phút nên
      //   giữ tab sống, để nguyên khoá — sẽ được bỏ khi bấm Dừng / lượt chạy kế.
      if (!settings.autoDownload) {
        setFlowTabPersistent(false);
        if (!settings.keepAlive) stopKeepAlive();
      }
      updateStatus();
      showIdleControls();
      if (pendingBulkRun) {
        pendingBulkRun.resolve(!!msg.ok);
        pendingBulkRun = null;
      }
      break;
    }
    case 'TEACH_DONE':
      if (msg.target) {
        currentTeachTarget = null;
        updateTeachStatus(msg.target, msg.mapping);
        resetTeachButtons();
        updateMappedCount();
        const info = msg.mapping ? `tag=${msg.mapping.tag}, role=${msg.mapping.role || 'none'}, text="${(msg.mapping.text || '').substring(0, 25)}"` : 'unknown';
        addLog(`✅ Mapped: ${msg.target} → ${info}`, 'success');
      }
      break;

    case 'QUEUE_DONE':
      state = 'done';
      chrome.storage.local.set({ state: 'idle' });
      if (!settings.autoDownload) {
        setFlowTabPersistent(false);
        if (!settings.keepAlive) stopKeepAlive();
      }
      updateStatus();
      showIdleControls();
      addLog(`🎉 ${L.log_completed} — ${promptList.length} prompts`, 'success');
      // Clear saved queue
      chrome.storage.local.remove('savedQueue');
      // Notify if enabled
      if (settings.notifyDone) {
        chrome.runtime.sendMessage({
          action: 'NOTIFY',
          title: 'Auto Flow Pro',
          message: lang === 'vi'
            ? `Hoàn thành ${promptList.length} prompts!`
            : `Completed ${promptList.length} prompts!`
        });
      }
      // Update storyboard statuses
      if (inputMode === 'storyboard') {
        storyboardItems.forEach(item => { if (item.status !== 'error') item.status = 'done'; });
        saveStoryboard();
        renderStoryboard();
      }
      break;

    case 'CONNECTION':
      const dot = document.getElementById('connection-dot');
      if (msg.connected) {
        dot.className = 'dot dot-connected';
        dot.title = L.log_connected;
        addLog(L.log_connected, 'success');
      } else {
        dot.className = 'dot dot-disconnected';
        dot.title = L.log_disconnected;

        // Auto-resume logic: if we were running and lost connection
        if (state === 'running' && settings.autoResume) {
          addLog(lang === 'vi'
            ? '⚠️ Mất kết nối — sẽ tự thử lại sau 10 giây...'
            : '⚠️ Connection lost — will retry in 10 seconds...', 'warning');
          setTimeout(async () => {
            const newTabId = await findFlowTab();
            if (newTabId && state === 'running') {
              addLog(lang === 'vi' ? '🔄 Đang thử kết nối lại...' : '🔄 Reconnecting...', 'info');
              checkConnection();
            }
          }, 10000);
        }
      }
      break;
  }
}

// ========================
// CONNECTION CHECK
// ========================
async function checkConnection() {
  try {
    const tabId = await findFlowTab();
    if (!tabId) {
      const dot = document.getElementById('connection-dot');
      dot.className = 'dot dot-disconnected';
      dot.title = LANG[lang].status_not_connected;
      return;
    }

    chrome.tabs.sendMessage(tabId, { action: 'PING' }, (resp) => {
      const dot = document.getElementById('connection-dot');
      if (chrome.runtime.lastError || !resp) {
        dot.className = 'dot dot-disconnected';
        dot.title = LANG[lang].status_not_connected;
        addLog(lang === 'vi'
          ? '⚠️ Chưa kết nối. Reload trang Flow (F5) rồi mở lại extension.'
          : '⚠️ Not connected. Reload Flow page (F5) then reopen extension.', 'warning');
      } else {
        dot.className = 'dot dot-connected';
        dot.title = LANG[lang].log_connected;
        addLog(`${LANG[lang].log_connected} (v${resp.version || '?'}, ${resp.mappingCount || 0} mappings)`, 'success');

        // Cảnh báo TAB CŨ: nếu content_script trên trang Flow (resp.version) khác
        // phiên bản extension đang cài → trang Flow còn chạy code CŨ → BẤM F5.
        // Đây là nguyên nhân số 1 khiến "Tạo ảnh" gửi đi mà không có gì xảy ra.
        try {
          const extVer = chrome.runtime.getManifest().version;
          if (resp.version && String(resp.version) !== String(extVer)) {
            addLog(`⚠️ TRANG FLOW ĐANG CHẠY BẢN CŨ (v${resp.version}) khác extension (v${extVer}) → BẤM F5 TAB FLOW rồi thử lại. Không F5 thì lệnh Tạo ảnh/Video có thể "gửi đi mà không chạy".`, 'warning');
          }
        } catch (e) {}

        if (resp.scan) {
          const scan = resp.scan;
          addLog(`🔍 Auto-scan: prompt=${scan.promptInput ? '✅' : '❌'}, submit=${scan.submitButton ? '✅' : '❌'}, settings=${scan.settingsToggle ? '✅' : '❌'}`, 'info');
        }

        if (resp.state && resp.state !== 'idle') {
          state = resp.state;
          updateStatus();
          if (state === 'running') showRunningControls();
          if (resp.total) showProgress(resp.current || 0, resp.total);
        }
      }
    });
  } catch (e) { /* ignore */ }
}

// ========================
// TOAST NOTIFICATION
// ========================
function showToast(message, type = 'info') {
  // Remove existing toast
  const old = document.getElementById('vf-toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'vf-toast';
  toast.textContent = message;
  const colors = {
    success: '#22c55e',
    error: '#ef4444',
    warn: '#eab308',
    info: '#3b82f6'
  };
  Object.assign(toast.style, {
    position: 'fixed',
    top: '60px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: colors[type] || colors.info,
    color: '#fff',
    padding: '10px 20px',
    borderRadius: '10px',
    fontSize: '12px',
    fontWeight: '700',
    zIndex: '9999',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    transition: 'opacity 0.3s',
    opacity: '1',
    whiteSpace: 'nowrap'
  });
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========================
// UTILS
// ========================
function saveSettings() {
  chrome.storage.local.set({ settings });
  if (typeof scheduleProjectSave === 'function') scheduleProjectSave();
}

function getCharacterMode() {
  const checked = document.querySelector('input[name="character-mode"]:checked');
  if (checked && (checked.value === 'entity' || checked.value === 'ref')) {
    settings.characterMode = checked.value;
    return checked.value;
  }
  return settings.characterMode === 'entity' ? 'entity' : 'ref';
}

function updateCharacterModeUI() {
  const mode = settings.characterMode === 'entity' ? 'entity' : 'ref';
  document.querySelectorAll('input[name="character-mode"]').forEach((el) => {
    el.checked = el.value === mode;
  });
  document.querySelectorAll('[data-char-mode-option]').forEach((el) => {
    el.classList.toggle('active', el.dataset.charModeOption === mode);
  });
  const autoEntity = document.getElementById('toggle-auto-entity');
  const autoEntityWrap = autoEntity?.closest('.char-inline-toggle');
  if (autoEntity) {
    autoEntity.disabled = mode !== 'entity';
    if (mode !== 'entity') autoEntity.checked = false;
    else autoEntity.checked = !!settings.autoEntityBeforeStart;
  }
  if (autoEntityWrap) autoEntityWrap.classList.toggle('disabled', mode !== 'entity');
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========================
// (AI tab now uses Storyboard AI iframe — old AI Creative Studio removed)

// ========================
// VEOFLOW IMPORT
// ========================
function parseAndLoadVeoFlow(rawText) {
  const L = LANG[lang];
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    showToast(`❌ ${L.vf_invalid}`, 'error');
    addLog(`❌ ${L.vf_invalid}`, 'error');
    return;
  }

  // Validate payload
  if (!data.prompts && !data.clips) {
    showToast(`❌ ${L.vf_invalid}`, 'error');
    addLog(`❌ ${L.vf_invalid} — no prompts/clips found`, 'error');
    return;
  }

  // Extract prompts
  let prompts = [];
  if (data.prompts && Array.isArray(data.prompts)) {
    prompts = data.prompts.filter(p => typeof p === 'string' && p.trim());
  } else if (data.clips && Array.isArray(data.clips)) {
    prompts = data.clips.map(c => c.prompt || c.flattened_prompt).filter(p => p && p.trim());
  }

  if (prompts.length === 0) {
    showToast(`❌ ${L.vf_invalid} — 0 prompts`, 'error');
    addLog(`❌ ${L.vf_invalid} — 0 prompts`, 'error');
    return;
  }

  // Apply settings from payload if present
  if (data.settings) {
    if (data.settings.mode && (data.settings.mode === 'video' || data.settings.mode === 'image')) {
      mode = data.settings.mode;
      chrome.storage.local.set({ mode });
    }
    if (data.settings.model) {
      settings.model = data.settings.model;
    }
    if (data.settings.aspect) {
      settings.aspect = data.settings.aspect;
    }
    if (data.settings.quantity) {
      settings.quantity = data.settings.quantity;
    }
    if (data.settings.duration) {
      settings.duration = data.settings.duration;
    }
    if (data.settings.voice) {
      settings.voice = data.settings.voice;
    }
    saveSettings();
  }

  // Load prompts into textarea
  const ta = document.getElementById('prompt-textarea');
  const existing = ta.value.trim();
  const newText = prompts.join('\n');
  ta.value = existing ? existing + '\n' + newText : newText;
  updatePromptCount();
  chrome.storage.local.set({ prompts: ta.value });

  // Switch to queue tab, text mode
  inputMode = 'text';
  chrome.storage.local.set({ inputMode });
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-tab="queue"]').classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-queue').classList.add('active');
  document.querySelectorAll('[data-inputmode]').forEach(b => b.classList.toggle('active', b.dataset.inputmode === 'text'));
  document.getElementById('text-mode-section').classList.remove('hidden');
  document.getElementById('storyboard-mode-section').classList.add('hidden');

  renderAll();

  // Visual feedback on button
  const btn = document.getElementById('btn-vf-paste');
  if (btn) {
    btn.classList.add('vf-success');
    setTimeout(() => btn.classList.remove('vf-success'), 2000);
  }

  const title = data.project_title ? ` — ${data.project_title}` : '';
  showToast(`🎬 ${L.vf_imported}${title} — ${prompts.length} ${L.vf_clips}`, 'success');
  addLog(`🎬 ${L.vf_imported}${title} — ${prompts.length} ${L.vf_clips}`, 'success');
}

// ========================
// LICENSE VERIFICATION
// ========================
async function getDeviceId() {
  // Stable per-machine device ID: generated once, persisted in this browser's storage.
  // The same extension installed on another machine gets a different ID.
  const saved = await chrome.storage.local.get(['deviceId']);
  if (saved.deviceId) return saved.deviceId;

  const rand =
    (crypto?.randomUUID?.() ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)
      .replace(/-/g, '')
      .slice(0, 16);
  const deviceId = `dev-${rand}`;
  await chrome.storage.local.set({ deviceId });
  return deviceId;
}

function showLicenseGate() {
  document.getElementById('license-gate').classList.remove('hidden');
  licenseValid = false;
  renderLicenseUI();
}

// Xoá SẠCH trạng thái license/trial đã lưu (key, email, cache xác thực) rồi
// hiện lại cổng license trống. Gọi khi hết hạn/hết lượt để người dùng sau
// trên cùng máy KHÔNG thấy email/key của người trước.
async function resetLicenseState(reasonMsg) {
  licenseKey = '';
  licenseValid = false;
  demoMode = false;
  demoRemaining = 0;
  try {
    await chrome.storage.local.remove(['licenseKey', 'trialEmail', 'licenseLastVerified', 'licenseStatus']);
  } catch (e) { /* storage không khả dụng thì bỏ qua */ }
  // Làm trống các ô nhập trên cổng license
  const keyInput = document.getElementById('license-key-input');
  if (keyInput) keyInput.value = '';
  const emailInput = document.getElementById('trial-email-input');
  if (emailInput) emailInput.value = '';
  // Ẩn info plan cũ
  document.getElementById('license-info')?.classList.add('hidden');
  updateDemoBanner();
  if (reasonMsg) addLog('🔄 ' + reasonMsg, 'warning');
  showLicenseGate();
}

function hideLicenseGate() {
  document.getElementById('license-gate').classList.add('hidden');
  licenseValid = true;
}

function renderLicenseUI() {
  const L = LANG[lang];
  const input = document.getElementById('license-key-input');
  const verifyBtn = document.getElementById('license-verify-label');
  const getKeyLabel = document.getElementById('license-get-key-label');
  const dashLabel = document.getElementById('license-dashboard-label');

  if (input) input.placeholder = 'AF-XXXX-XXXX-XXXX';
  if (verifyBtn) verifyBtn.textContent = lang === 'vi' ? 'Xác thực' : 'Verify';
  if (getKeyLabel) getKeyLabel.textContent = lang === 'vi'
    ? 'Đăng ký nhận License Key miễn phí (15 ngày)'
    : 'Sign up for free License Key (15-day trial)';
  if (dashLabel) dashLabel.textContent = lang === 'vi' ? 'Mở Dashboard' : 'Open Dashboard';

  const trialLabel = document.getElementById('trial-email-label');
  const trialBtn = document.getElementById('trial-claim-label');
  const trialHint = document.getElementById('trial-email-hint');
  const trialInput = document.getElementById('trial-email-input');
  const orLabel = document.getElementById('license-or-label');
  if (trialLabel) trialLabel.textContent = lang === 'vi'
    ? '🎁 Nhập email để dùng thử 7 ngày miễn phí'
    : '🎁 Enter your email for a free 7-day trial';
  if (trialBtn) trialBtn.textContent = lang === 'vi'
    ? 'Dùng thử miễn phí 7 ngày'
    : 'Start 7-day free trial';
  if (trialHint) trialHint.textContent = lang === 'vi'
    ? 'Chỉ cần email — không cần mật khẩu, không cần thẻ'
    : 'Just your email — no password, no card';
  if (trialInput) trialInput.placeholder = lang === 'vi' ? 'email@cua-ban.com' : 'you@email.com';
  if (orLabel) orLabel.textContent = lang === 'vi' ? 'hoặc đã có mã kích hoạt' : 'or already have a code';
}

async function verifyLicenseKey(key) {
  const gate = document.getElementById('license-gate');
  const statusBox = document.getElementById('license-status-box');
  const statusIcon = document.getElementById('license-status-icon');
  const statusText = document.getElementById('license-status-text');
  const infoBox = document.getElementById('license-info');
  const planValue = document.getElementById('license-plan-value');
  const expiresValue = document.getElementById('license-expires-value');
  const dashLink = document.getElementById('license-dashboard-link');
  const verifyBtn = document.getElementById('btn-license-verify');

  // Show loading
  statusBox.className = 'license-status-box';
  statusIcon.textContent = '⏳';
  statusText.textContent = lang === 'vi' ? 'Đang xác thực...' : 'Verifying...';
  if (verifyBtn) verifyBtn.disabled = true;

  try {
    const resp = await fetch(LICENSE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key, deviceId: await getDeviceId() }),
    });

    const result = await resp.json();

    if (result.valid) {
      // Save key
      licenseKey = key;
      licenseValid = true;
      demoMode = false;
      updateDemoBanner();
      chrome.storage.local.set({ licenseKey: key });

      // Show success briefly then hide gate
      statusBox.className = 'license-status-box ' + (result.status === 'TRIAL' ? 'trial' : 'success');
      statusIcon.textContent = result.status === 'TRIAL' ? '⏰' : '✅';
      statusText.textContent = result.message;

      // Show plan info
      infoBox.classList.remove('hidden');
      planValue.textContent = result.plan === 'YEARLY' ? 'Pro Yearly' : result.plan === 'MONTHLY' ? 'Pro Monthly' : 'Trial';
      expiresValue.textContent = result.expiresAt
        ? new Date(result.expiresAt).toLocaleDateString()
        : '—';
      dashLink.classList.remove('hidden');

      // Hide gate after brief display
      setTimeout(() => hideLicenseGate(), 1200);

      addLog(`🔑 License: ${result.message}`, 'success');
    } else {
      // Invalid or expired → xoá key/email/cache cũ khỏi máy để không
      // hiển thị thông tin của người dùng trước (reset khi hết lượt).
      licenseValid = false;
      await resetLicenseState();
      statusBox.className = 'license-status-box error';
      statusIcon.textContent = '❌';
      statusText.textContent = result.message;
      infoBox.classList.add('hidden');
      dashLink.classList.remove('hidden');

      addLog(`🔑 License: ${result.message}`, 'error');
    }
  } catch (err) {
    // Network error — allow offline use if previously verified
    const cachedResult = await chrome.storage.local.get(['licenseLastVerified', 'licenseStatus']);
    if (cachedResult.licenseLastVerified) {
      const hoursSince = (Date.now() - cachedResult.licenseLastVerified) / 3600000;
      if (hoursSince < 72) { // Allow 72h offline grace
        statusBox.className = 'license-status-box trial';
        statusIcon.textContent = '📡';
        statusText.textContent = lang === 'vi'
          ? 'Offline — dùng cache (còn ' + Math.round(72 - hoursSince) + 'h)'
          : 'Offline — cached (' + Math.round(72 - hoursSince) + 'h remaining)';
        licenseValid = true;
        setTimeout(() => hideLicenseGate(), 1500);
        return;
      }
    }

    statusBox.className = 'license-status-box error';
    statusIcon.textContent = '📡';
    statusText.textContent = lang === 'vi'
      ? 'Không thể kết nối server. Kiểm tra mạng.'
      : 'Cannot reach server. Check your connection.';
    licenseValid = false;
  } finally {
    if (verifyBtn) verifyBtn.disabled = false;

    // Cache verification time if valid
    if (licenseValid) {
      chrome.storage.local.set({
        licenseLastVerified: Date.now(),
        licenseStatus: 'valid',
      });
    }
  }
}

// ===== DEMO MODE (try before signup) =====
// Calls /api/demo/consume. count=0 -> check only; count>0 -> consume.
async function demoConsume(count = 0) {
  try {
    const resp = await fetch(DEMO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: await getDeviceId(), count }),
    });
    return await resp.json();
  } catch (err) {
    return { allowed: false, error: 'network', remaining: 0 };
  }
}

function updateDemoBanner() {
  const banner = document.getElementById('demo-banner');
  const text = document.getElementById('demo-banner-text');
  if (!banner) return;
  if (!demoMode) { banner.classList.add('hidden'); return; }
  banner.classList.remove('hidden');
  if (demoRemaining > 0) {
    banner.classList.remove('exhausted');
    text.textContent = lang === 'vi'
      ? `🎮 Bản dùng thử — còn ${demoRemaining}/${demoLimit} lượt`
      : `🎮 Demo — ${demoRemaining}/${demoLimit} runs left`;
  } else {
    banner.classList.add('exhausted');
    text.textContent = lang === 'vi'
      ? '⚠️ Hết lượt dùng thử — đăng ký để nhận 15 ngày'
      : '⚠️ Demo used up — sign up for a 15-day trial';
  }
}

// Enter demo mode: hide the gate and let the user run a few free generations.
async function startDemoMode() {
  const btn = document.getElementById('btn-demo-try');
  const statusBox = document.getElementById('license-status-box');
  const statusIcon = document.getElementById('license-status-icon');
  const statusText = document.getElementById('license-status-text');
  if (btn) btn.disabled = true;

  const res = await demoConsume(0);
  if (res.error === 'network') {
    if (statusBox) statusBox.className = 'license-status-box error';
    if (statusIcon) statusIcon.textContent = '📡';
    if (statusText) statusText.textContent = lang === 'vi'
      ? 'Không thể kết nối server. Thử lại.'
      : 'Cannot reach server. Try again.';
    if (btn) btn.disabled = false;
    return;
  }

  demoLimit = res.limit || 5;
  demoRemaining = res.remaining || 0;

  if (demoRemaining <= 0) {
    // No demo runs left on this device → reset sạch key/email đã lưu
    await resetLicenseState();
    if (statusBox) statusBox.className = 'license-status-box error';
    if (statusIcon) statusIcon.textContent = '⚠️';
    if (statusText) statusText.textContent = lang === 'vi'
      ? 'Đã hết lượt dùng thử trên thiết bị này. Vui lòng đăng ký miễn phí (15 ngày).'
      : 'No free demo runs left on this device. Please sign up (free 15-day trial).';
    if (btn) btn.disabled = false;
    return;
  }

  demoMode = true;
  hideLicenseGate();      // NB: this sets licenseValid = true ...
  licenseValid = false;   // ... so force it back: demo users are NOT licensed
  updateDemoBanner();
  addLog(lang === 'vi'
    ? `🎮 Dùng thử: còn ${demoRemaining} lượt`
    : `🎮 Demo mode: ${demoRemaining} runs left`, 'info');
  if (btn) btn.disabled = false;
}

// ===== FREE TRIAL BY EMAIL (no signup link, instant) =====
async function claimTrialByEmail() {
  const input = document.getElementById('trial-email-input');
  const btn = document.getElementById('btn-trial-claim');
  const statusBox = document.getElementById('license-status-box');
  const statusIcon = document.getElementById('license-status-icon');
  const statusText = document.getElementById('license-status-text');
  const email = (input?.value || '').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (statusBox) statusBox.className = 'license-status-box error';
    if (statusIcon) statusIcon.textContent = '✉️';
    if (statusText) statusText.textContent = lang === 'vi' ? 'Email không hợp lệ' : 'Invalid email';
    return;
  }

  if (btn) btn.disabled = true;
  if (statusBox) statusBox.className = 'license-status-box';
  if (statusIcon) statusIcon.textContent = '⏳';
  if (statusText) statusText.textContent = lang === 'vi' ? 'Đang kích hoạt...' : 'Activating...';

  try {
    const resp = await fetch(TRIAL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, deviceId: await getDeviceId() }),
    });
    const result = await resp.json();

    if (result.ok && result.licenseKey) {
      chrome.storage.local.set({ trialEmail: email });
      // Xoá email khỏi ô nhập ngay sau khi kích hoạt — tránh email của người
      // này còn hiển thị trong ô cho người dùng sau trên cùng máy.
      if (input) input.value = '';
      document.getElementById('license-key-input').value = result.licenseKey;
      await verifyLicenseKey(result.licenseKey);
      addLog(`🎁 ${result.message || 'Trial activated'}`, 'success');
    } else {
      if (statusBox) statusBox.className = 'license-status-box error';
      if (statusIcon) statusIcon.textContent = '⚠️';
      if (statusText) statusText.textContent = result.message
        || (lang === 'vi' ? 'Không kích hoạt được' : 'Could not activate');
      addLog(`🎁 ${result.message || 'Trial failed'}`, 'error');
    }
  } catch (err) {
    if (statusBox) statusBox.className = 'license-status-box error';
    if (statusIcon) statusIcon.textContent = '📡';
    if (statusText) statusText.textContent = lang === 'vi'
      ? 'Không kết nối được server. Kiểm tra mạng.'
      : 'Cannot reach server. Check your connection.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ===== OMNI CHARACTER SETUP =====
let char1Img = null, char2Img = null, char3Img = null;
let productImages = []; // nhiều ảnh ref chung, tự gắn vào mọi prompt trong queue

function projectProductRefs(project) {
  if (project && Array.isArray(project.productRefs)) {
    return project.productRefs.filter((item) => item && item.data).map((item) => ({ data: item.data, name: item.name || 'reference.png' }));
  }
  // Tương thích project cũ chỉ có một `prod`.
  if (project && project.prod && project.prod.data) return [{ data: project.prod.data, name: project.prod.name || 'reference.png' }];
  return [];
}

function productRefsForPayload(refs = productImages, groupName) {
  // Ô "Ảnh ref chung" đã bỏ khỏi tab Nhân vật. Ảnh bổ sung giờ phải được gắn
  // tại đúng hàng storyboard/prompt để không vô tình áp một ref cho mọi prompt.
  return [];
}

function renderProductRefs() {
  const list = document.getElementById('product-ref-list');
  const label = document.getElementById('product-upload');
  const wrap = document.getElementById('product-thumb-wrap');
  if (wrap) wrap.textContent = productImages.length
    ? `➕ Thêm ảnh ref (${productImages.length})`
    : t('product_ph_label');
  if (label) label.classList.toggle('has-refs', productImages.length > 0);
  if (!list) return;
  list.innerHTML = '';
  productImages.forEach((item, index) => {
    const box = document.createElement('div');
    box.className = 'product-ref-item';
    const img = document.createElement('img');
    img.className = 'product-ref-thumb';
    img.src = item.data;
    img.alt = item.name || `Reference ${index + 1}`;
    const name = document.createElement('span');
    name.className = 'product-ref-name';
    name.title = item.name || '';
    name.textContent = `#${index + 1} ${item.name || 'reference'}`;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'product-ref-remove';
    remove.dataset.index = String(index);
    remove.title = lang === 'vi' ? 'Xóa ảnh ref này' : 'Remove this reference';
    remove.textContent = '×';
    box.append(img, name, remove);
    list.appendChild(box);
  });
}

async function addProductRefFiles(fileList) {
  const files = Array.from(fileList || []).filter((file) => file && String(file.type || '').startsWith('image/'));
  if (!files.length) return;
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  const added = await Promise.all(files.map(async (file) => ({ data: await readFileAsDataUrl(file), name: file.name })));
  productImages.push(...added);
  renderProductRefs();
  scheduleProjectMetadataSave();
  addLog(`🖼️ Đã thêm ${added.length} ảnh ref chung · tổng ${productImages.length} ảnh`, 'success');
}

function bindCharacterEvents() {
  const setupSlot = (fileId, store) => {
    const fileEl = document.getElementById(fileId);
    if (!fileEl) return;
    fileEl.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        store(reader.result, f.name);
        currentProjectEntityReady = false;
        const label = fileEl.closest('.char-upload');
        if (label) { label.classList.add('has-img'); label.style.backgroundImage = `url(${reader.result})`; }
        if (typeof scheduleProjectSave === 'function') scheduleProjectSave();
      };
      reader.readAsDataURL(f);
    });
  };
  setupSlot('char1-file', (d, n) => { char1Img = { data: d, name: n }; });
  setupSlot('char2-file', (d, n) => { char2Img = { data: d, name: n }; });
  setupSlot('char3-file', (d, n) => { char3Img = { data: d, name: n }; });
  const productFile = document.getElementById('product-file');
  productFile?.addEventListener('change', async (e) => {
    await addProductRefFiles(e.target.files);
    e.target.value = '';
  });
  document.getElementById('product-ref-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.product-ref-remove');
    if (!btn) return;
    const index = Number(btn.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= productImages.length) return;
    productImages.splice(index, 1);
    renderProductRefs();
    scheduleProjectMetadataSave();
  });
  document.getElementById('btn-clear-product-refs')?.addEventListener('click', () => {
    productImages = [];
    if (productFile) productFile.value = '';
    renderProductRefs();
    scheduleProjectMetadataSave();
  });
  document.getElementById('product-name')?.addEventListener('input', scheduleProjectMetadataSave);
  renderProductRefs();

  const getCharactersForSetup = () => {
    // Mỗi nhân vật mang VOICE RIÊNG từ select cạnh tên (👨 nam / 👩 nữ).
    const chars = [];
    const imgs = [char1Img, char2Img, char3Img];
    for (let n = 1; n <= 3; n++) {
      const img = imgs[n - 1];
      if (!img) continue;
      const name = (document.getElementById(`char${n}-name`)?.value || '').trim();
      chars.push({ imageDataUrl: img.data, name, fileName: img.name, voice: charVoicePayloadFor(n) });
    }
    return { chars, voice: getVoicePayload() };
  };

  const refBtn = document.getElementById('btn-load-characters');
  if (refBtn) refBtn.addEventListener('click', async () => {
    settings.characterMode = 'ref';
    settings.autoEntityBeforeStart = false;
    saveSettings();
    updateCharacterModeUI();
    const status = document.getElementById('char-status');
    const { chars } = getCharactersForSetup();
    if (!chars.length) { if (status) status.textContent = '⚠️ Hãy tải ít nhất 1 ảnh nhân vật.'; return; }
    const named = chars.filter((c) => (c.name || '').trim()).map((c) => '@' + c.name.trim().replace(/\s+/g, ''));
    if (status) status.textContent = `⏳ Đang tải ảnh ref lên Flow${named.length ? ' · ' + named.join(' ') : ''}...`;
    addLog(`📎 Tải ảnh ref nhân vật: ${chars.map((c) => c.name || c.fileName || 'character').join(', ')}${named.length ? ' · ' + named.join(' ') : ''}`, 'info');
    await sendToContent({ action: 'SETUP_CHARACTER_REFS', characters: chars });
  });

  const entityBtn = document.getElementById('btn-create-character-entities');
  if (entityBtn) entityBtn.addEventListener('click', async () => {
    settings.characterMode = 'entity';
    saveSettings();
    updateCharacterModeUI();
    const status = document.getElementById('char-status');
    const { chars, voice } = getCharactersForSetup();
    if (!chars.length) { if (status) status.textContent = '⚠️ Hãy tải ít nhất 1 ảnh nhân vật.'; return; }
    if (status) status.textContent = `⏳ Đang thử tạo entity nhân vật Flow với voice ${voice.name}... (xem tab Nhật ký)`;
    addLog(`👤 Thử tạo entity nhân vật Flow: ${chars.map((c) => c.name || c.fileName || 'character').join(', ')} · voice ${voice.name}`, 'info');
    await sendToContent({ action: 'SETUP_CHARACTER_ENTITIES', characters: chars });
  });

  const resetBtn = document.getElementById('btn-reset-characters');
  if (resetBtn) resetBtn.addEventListener('click', resetCharacters);
}

// Clear all 3 loaded character slots so a fresh set can be uploaded.
function resetCharacters() {
  const L = LANG[lang];
  char1Img = null; char2Img = null; char3Img = null;
  currentProjectEntityReady = false;
  preparedCharacterEntities = [];
  for (let n = 1; n <= 3; n++) {
    const nameEl = document.getElementById(`char${n}-name`);
    if (nameEl) nameEl.value = '';
    const voiceEl = document.getElementById(`char${n}-voice`);
    if (voiceEl) voiceEl.value = 'auto';
    const fileEl = document.getElementById(`char${n}-file`);
    if (fileEl) fileEl.value = '';
    const label = fileEl?.closest('.char-upload');
    if (label) { label.classList.remove('has-img'); label.style.backgroundImage = ''; }
  }
  const status = document.getElementById('char-status');
  if (status) status.textContent = L.char_reset_done || '';
  if (typeof scheduleProjectSave === 'function') scheduleProjectSave();
  addLog('♻️ ' + (L.char_reset_done || 'Reset characters'), 'info');
}

// ===== PROJECTS (mỗi dự án = 1 bộ nhân vật + storyboard + prompt riêng) =====
const PROJECT_COUNT = 5;
let curProj = '1';
let _projSaveTimer = null;

function snapshotProject() {
  return {
    prompts: (document.getElementById('prompt-textarea')?.value) || '',
    title: (document.getElementById('script-title')?.value || '').trim(),
    mode,
    inputMode,
    settings: {
      model: settings.model,
      aspect: settings.aspect,
      quantity: settings.quantity,
      duration: settings.duration || DEFAULT_SETTINGS.duration,
      voice: settings.voice || 'auto',
      characterMode: getCharacterMode()
    },
    c1: char1Img ? { data: char1Img.data, name: (document.getElementById('char1-name')?.value || ''), voice: (document.getElementById('char1-voice')?.value || 'auto') } : null,
    c2: char2Img ? { data: char2Img.data, name: (document.getElementById('char2-name')?.value || ''), voice: (document.getElementById('char2-voice')?.value || 'auto') } : null,
    c3: char3Img ? { data: char3Img.data, name: (document.getElementById('char3-name')?.value || ''), voice: (document.getElementById('char3-voice')?.value || 'auto') } : null,
    productRefs: productImages.map((item) => ({ data: item.data, name: item.name || 'reference.png' })),
    productName: (document.getElementById('product-name')?.value || '').trim(),
    storyboard: storyboardItems || [],
    entityReady: !!currentProjectEntityReady,
    entities: preparedCharacterEntities || [],
    // MANIFEST + HÀNG ĐỢI NANO GẮN THEO DỰ ÁN: mỗi dự án giữ manifest riêng, chuyển
    //   dự án sẽ đổi manifest theo. null nếu dự án này chưa nạp manifest.
    nano: nanoManifest ? { manifest: nanoManifest, queue: nanoQueue || [] } : null,
  };
}

function projectHasPrompts(project) {
  if (!project) return false;
  if (splitPromptBlocks(project.prompts || '').length) return true;
  return Array.isArray(project.storyboard) && project.storyboard.some((item) => String(item.prompt || '').trim());
}

function mergeProjectPromptsIfEmpty(project, fallback) {
  const out = { ...(project || {}) };
  if (!projectHasPrompts(out) && projectHasPrompts(fallback)) {
    out.prompts = fallback.prompts || '';
    out.storyboard = fallback.storyboard || [];
    out.inputMode = fallback.inputMode || out.inputMode || inputMode;
    out.mode = fallback.mode || out.mode || mode;
  }
  return out;
}

async function saveCurrentProject() {
  const all = (await chrome.storage.local.get(['afProjects'])).afProjects || {};
  const snap = snapshotProject();
  // Tự gắn LINK FLOW của slot: nếu đang mở đúng 1 dự án trên Flow thì lưu URL đó,
  //   ngược lại giữ link cũ. Dùng để chuyển dự án tự động trong chuỗi.
  const url = await currentFlowTabUrl();
  snap.flowUrl = projectIdFromUrl(url) ? url : ((all[curProj] && all[curProj].flowUrl) || '');
  all[curProj] = snap;
  await chrome.storage.local.set({ afProjects: all });
}

function scheduleProjectSave() {
  currentProjectEntityReady = false;
  preparedCharacterEntities = [];
  clearTimeout(_projSaveTimer);
  _projSaveTimer = setTimeout(saveCurrentProject, 700);
}

// Lưu tiêu đề / ảnh ref chung nhưng không làm mất trạng thái entity nhân vật đã tạo.
function scheduleProjectMetadataSave() {
  clearTimeout(_projSaveTimer);
  _projSaveTimer = setTimeout(saveCurrentProject, 700);
}

function applyProject(p) {
  const projectSettings = p?.settings || {};
  mode = p?.mode || (p ? mode : 'video');
  inputMode = p?.inputMode || (p ? inputMode : 'text');
  settings = {
    ...settings,
    model: projectSettings.model || (p ? settings.model : DEFAULT_SETTINGS.model),
    aspect: projectSettings.aspect || (p ? settings.aspect : DEFAULT_SETTINGS.aspect),
    quantity: projectSettings.quantity || (p ? settings.quantity : DEFAULT_SETTINGS.quantity),
    duration: projectSettings.duration || (p ? settings.duration || DEFAULT_SETTINGS.duration : DEFAULT_SETTINGS.duration),
    voice: projectSettings.voice || (p ? settings.voice || 'auto' : DEFAULT_SETTINGS.voice),
    characterMode: projectSettings.characterMode || (p ? settings.characterMode || 'ref' : DEFAULT_SETTINGS.characterMode)
  };
  const ta = document.getElementById('prompt-textarea');
  if (ta) ta.value = p?.prompts || '';
  const scriptTitle = document.getElementById('script-title');
  if (scriptTitle) scriptTitle.value = p?.title || '';
  updatePromptCount();
  currentProjectEntityReady = !!p?.entityReady;
  preparedCharacterEntities = Array.isArray(p?.entities) ? p.entities : [];
  char1Img = p?.c1 ? { data: p.c1.data, name: p.c1.name } : null;
  char2Img = p?.c2 ? { data: p.c2.data, name: p.c2.name } : null;
  char3Img = p?.c3 ? { data: p.c3.data, name: p.c3.name } : null;
  productImages = [];
  [['1', p?.c1], ['2', p?.c2], ['3', p?.c3]].forEach(([n, c]) => {
    const nameEl = document.getElementById(`char${n}-name`);
    if (nameEl) nameEl.value = c?.name || '';
    const voiceEl = document.getElementById(`char${n}-voice`);
    if (voiceEl) voiceEl.value = c?.voice || 'auto';
    const fileEl = document.getElementById(`char${n}-file`);
    if (fileEl) fileEl.value = '';
    const label = document.getElementById(`char${n}-file`)?.closest('.char-upload');
    if (label) {
      if (c?.data) { label.classList.add('has-img'); label.style.backgroundImage = `url(${c.data})`; }
      else { label.classList.remove('has-img'); label.style.backgroundImage = ''; }
    }
  });
  // Restore nhiều ảnh ref chung (migrate được project cũ chỉ có `prod`).
  const prodName = document.getElementById('product-name');
  if (prodName) prodName.value = p?.productName || p?.prod?.name || '';
  const prodFile = document.getElementById('product-file');
  if (prodFile) prodFile.value = '';
  renderProductRefs();
  storyboardItems = normalizeStoryboardItems(p?.storyboard || []);
  if (typeof renderStoryboard === 'function') renderStoryboard();
  chrome.storage.local.set({
    mode,
    inputMode,
    settings,
    prompts: ta?.value || '',
    storyboard: storyboardItems
  });
  applyNanoFromProject(p); // nạp manifest + hàng đợi ĐÚNG của dự án này (hoặc xóa sạch)
  renderAll();
}

// MỖI DỰ ÁN 1 MANIFEST RIÊNG: nạp manifest + hàng đợi nano ĐÚNG của dự án p (hoặc xóa
//   sạch UI nano nếu dự án chưa có manifest). Gọi trong applyProject để chuyển dự án
//   1↔2 KHÔNG còn lẫn manifest của nhau.
function applyNanoFromProject(p) {
  const nano = p && p.nano;
  if (nano && nano.manifest && Array.isArray(nano.queue)) {
    const title = (nano.manifest.project && nano.manifest.project.title) || ('Dự án ' + curProj);
    nanoProjects = [ensureNanoProjectIdentity({ title: title, manifest: nano.manifest, queue: nano.queue, flowUrl: (p && p.flowUrl) || '' })];
    setActiveNanoProject(0);
  } else {
    nanoProjects = [];
    setActiveNanoProject(-1); // dự án này chưa có manifest → xóa sạch UI nano
  }
}

async function bindProjectEvents() {
  const sel = document.getElementById('project-select');
  if (!sel) return;
  sel.innerHTML = '';
  for (let i = 1; i <= PROJECT_COUNT; i++) {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = (lang === 'vi' ? 'Dự án ' : 'Project ') + i;
    sel.appendChild(o);
  }
  const store = await chrome.storage.local.get(['afProjects', 'afCurProj']);
  const legacySnapshot = snapshotProject();
  let all = store.afProjects;
  if (!all) {
    // First run: seed project 1 with whatever is already loaded (migrate legacy data).
    all = { '1': legacySnapshot };
    await chrome.storage.local.set({ afProjects: all });
  }
  curProj = store.afCurProj || '1';
  all[curProj] = mergeProjectPromptsIfEmpty(all[curProj], legacySnapshot);
  // MIGRATION 1 LẦN: bản cũ giữ manifest ở kho nano GLOBAL (nanoFlow) dùng chung cho
  //   mọi dự án. Chuyển nó vào ĐÚNG dự án đang mở để không mất manifest khi nâng cấp,
  //   rồi dọn kho global (từ nay mỗi dự án giữ manifest riêng trong afProjects[key].nano).
  try {
    const legacy = await chrome.storage.local.get(['nanoFlow']);
    const nf = legacy && legacy.nanoFlow;
    if (nf && nf.manifest && Array.isArray(nf.queue) && all[curProj] && !all[curProj].nano) {
      all[curProj] = { ...all[curProj], nano: { manifest: nf.manifest, queue: nf.queue } };
    }
    await chrome.storage.local.remove(['nanoFlow', 'nanoProjects', 'nanoActiveIndex']);
  } catch (e) {}
  await chrome.storage.local.set({ afProjects: all });
  sel.value = curProj;
  applyProject(all[curProj] || null);

  sel.addEventListener('change', async () => {
    await saveCurrentProject();           // save the project we're leaving
    curProj = sel.value;
    await chrome.storage.local.set({ afCurProj: curProj });
    const fresh = (await chrome.storage.local.get(['afProjects'])).afProjects || {};
    applyProject(fresh[curProj] || null); // load the chosen project
  });
  // Auto-save current project on edits
  document.getElementById('prompt-textarea')?.addEventListener('input', scheduleProjectSave);
  document.getElementById('char1-name')?.addEventListener('input', scheduleProjectSave);
  document.getElementById('char2-name')?.addEventListener('input', scheduleProjectSave);
  document.getElementById('char3-name')?.addEventListener('input', scheduleProjectSave);
  document.getElementById('product-name')?.addEventListener('input', scheduleProjectSave);
  // Đổi voice riêng của nhân vật → lưu dự án + entity cũ hết hiệu lực (cần tạo lại để gắn voice mới).
  for (const n of [1, 2, 3]) {
    document.getElementById(`char${n}-voice`)?.addEventListener('change', () => { currentProjectEntityReady = false; scheduleProjectSave(); });
  }
}

function bindLicenseEvents() {
  // Verify button
  document.getElementById('btn-license-verify').addEventListener('click', async () => {
    const key = document.getElementById('license-key-input').value.trim();
    if (!key) return;
    await verifyLicenseKey(key);
  });

  // Free trial by email (primary action)
  const trialBtn = document.getElementById('btn-trial-claim');
  if (trialBtn) trialBtn.addEventListener('click', claimTrialByEmail);
  const trialInput = document.getElementById('trial-email-input');
  if (trialInput) {
    trialInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') claimTrialByEmail();
    });
  }

  // Enter key to verify
  document.getElementById('license-key-input').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const key = e.target.value.trim();
      if (key) await verifyLicenseKey(key);
    }
  });

  // Auto-format license key input (uppercase, add dashes)
  document.getElementById('license-key-input').addEventListener('input', (e) => {
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    e.target.value = val;
  });
}
