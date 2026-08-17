// ============================================================
// AUTO FLOW PRO v9.52 — Background Service Worker
// Keep-alive + Notifications + Queue recovery
// ============================================================

let bgTraceRecording = false;
let bgTraceBuffer = [];
let cdpTraceRecording = false;
let cdpTraceBuffer = [];
let cdpAttachedTabId = null;
const cdpPendingRequests = new Map();
const BG_CHAIN_STORAGE_KEY = 'afBackgroundChain';
const BG_CHAIN_BULK_ACCEPTED_KEY = 'afChainBulkAccepted';
const BG_CHAIN_BULK_RESULT_KEY = 'afChainBulkResult';
const BG_CHAIN_DOWNLOAD_ACCEPTED_KEY = 'afChainDownloadAccepted';
const BG_CHAIN_DOWNLOAD_RESULT_KEY = 'afChainDownloadResult';
// Danh sách media id VIDEO đã sinh (base id, bỏ hậu tố _upsampled) — thu từ response
// generate/poll để tải hàng loạt qua API kể cả khi video không hiển thị trên màn hình.
let generatedMediaIds = [];

function safeDownloadFilename(value, fallback = 'Clip.mp4') {
  const clean = String(value || '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');
  return (clean || fallback).slice(0, 180);
}

chrome.storage.local.get(['afTraceRecording', 'afBgApiTrace', 'afCdpApiTrace', 'afGeneratedMediaIds'], (data) => {
  bgTraceRecording = !!data.afTraceRecording;
  bgTraceBuffer = Array.isArray(data.afBgApiTrace) ? data.afBgApiTrace.slice(-200) : [];
  cdpTraceRecording = !!data.afTraceRecording;
  cdpTraceBuffer = Array.isArray(data.afCdpApiTrace) ? data.afCdpApiTrace.slice(-300) : [];
  generatedMediaIds = Array.isArray(data.afGeneratedMediaIds) ? data.afGeneratedMediaIds.slice(-200) : [];
});

// Bóc media id VIDEO từ body response generate/poll. Chỉ lấy media có field ".video"
// (để loại ảnh upload/entity). Trả về danh sách base id (đã bỏ "_upsampled").
function harvestVideoMediaIds(bodyStr) {
  try {
    const obj = JSON.parse(bodyStr);
    const arr = Array.isArray(obj && obj.media) ? obj.media : [];
    const out = [];
    for (const m of arr) {
      if (m && m.video && m.name) out.push(String(m.name).replace(/_upsampled$/, ''));
    }
    return out;
  } catch (e) { return []; }
}

// Ghi nhận media id mới vào danh sách (khử trùng, giữ tối đa 200, mới nhất ở cuối).
function rememberGeneratedMediaIds(ids) {
  if (!ids || !ids.length) return;
  let changed = false;
  for (const id of ids) {
    if (!id) continue;
    const i = generatedMediaIds.indexOf(id);
    if (i !== -1) generatedMediaIds.splice(i, 1); else changed = true;
    generatedMediaIds.push(id);
  }
  while (generatedMediaIds.length > 200) generatedMediaIds.shift();
  if (changed || ids.length) chrome.storage.local.set({ afGeneratedMediaIds: generatedMediaIds });
}

function bgInterestingUrl(url) {
  const u = String(url || '').toLowerCase();
  if (!/aisandbox-pa\.googleapis\.com|labs\.google|clients6\.google/.test(u)) return false;
  if (/fetchuserrecommendations|batchlogfrontendevents|\/g\/collect|analytics|telemetry/.test(u)) return false;
  return /flowcreationagent|\/v1\/flow|\/v1\/video|agentinfo|uploadimage|batchasyncgenerate|batchcheckasync|streamchat|entities|models\/statuses|checkappavailability/.test(u);
}

function bgTraceKind(url) {
  const u = String(url || '').toLowerCase();
  if (/batchcheckasyncvideo|generationstatus|video:batchcheck/.test(u)) return 'poll';
  if (/streamchat|batchasyncgeneratevideo|flowcreationagent:streamchat|generatevideo/.test(u)) return 'generate';
  if (/uploadimage|uploadmedia/.test(u)) return 'upload';
  if (/flowcreationagent\/sessions|\/sessions\b/.test(u)) return 'session';
  if (/\/v1\/flow\/projects\b|createproject|deleteproject|:createproject|projects:batch|listprojects|getproject|checkappavailability/.test(u)) return 'project';
  if (/\/v1\/flow\/entities\b|character|persona|voice|speaker|avatar/.test(u)) return 'character';
  if (/agentinfo|models\/statuses|batchdeleteassets/.test(u)) return 'settings';
  return '';
}

// Phát hiện request TẢI XUỐNG video/media — kể cả từ CDN NGOÀI Google (googlevideo,
// storage.googleapis…). Dùng để DÒ endpoint tải video: khi GHI API, các request này
// sẽ được ghi vào trace CDP với kind='download' để người dùng copy ra xem đúng URL.
// (Chỉ CDP/debugger bắt được các host này vì nó lắng nghe MỌI request trong tab,
//  không phụ thuộc host_permissions như webRequest.)
function bgIsDownloadUrl(url, resourceType, mimeType) {
  const u = String(url || '').toLowerCase();
  const rt = String(resourceType || '').toLowerCase();
  const mt = String(mimeType || '').toLowerCase();
  if (/fetchuserrecommendations|batchlogfrontendevents|\/g\/collect|analytics|telemetry/.test(u)) return false;
  // Endpoint tải/xuất video của Flow / Google AI (theo tên hàm hay gặp).
  if (/downloadvideo|:download\b|exportvideo|:export\b|getmedia|media:download|batchdownload|generatedownload|servingurl|downloaduri/.test(u)) return true;
  // CDN / kho lưu trữ phục vụ file video thật.
  if (/googlevideo\.com|storage\.googleapis\.com|storage\.mtls\.googleapis|lh3\.googleusercontent|videoplayback|\.mp4(\?|$)|\.webm(\?|$)|fife/.test(u)) return true;
  // Gợi ý theo loại tài nguyên / mime do CDP cung cấp.
  if (rt === 'media') return true;
  if (/^video\/|application\/octet-stream|application\/mp4/.test(mt)) return true;
  return false;
}

function bgSafeHeaders(headers = []) {
  const out = {};
  for (const h of headers || []) {
    const k = h.name || '';
    if (!k) continue;
    out[k] = /authorization|cookie|token|sapisid|secret|auth/i.test(k) ? '***ĐÃ CHE***' : h.value;
  }
  return out;
}

function bgDecodeBytes(bytes) {
  try {
    if (!bytes) return '';
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch (e) {
    return '[không đọc được bytes]';
  }
}

function bgRequestBody(details) {
  const rb = details.requestBody;
  if (!rb) return { body: '', bodyType: 'none' };
  if (rb.formData) {
    return { body: JSON.stringify(rb.formData), bodyType: 'formData' };
  }
  if (Array.isArray(rb.raw) && rb.raw.length) {
    const body = rb.raw.map((part) => bgDecodeBytes(part.bytes)).join('');
    return { body, bodyType: 'raw' };
  }
  if (rb.error) return { body: rb.error, bodyType: 'error' };
  return { body: '', bodyType: 'unknown' };
}

function bgRedactValue(value) {
  if (Array.isArray(value)) return value.map(bgRedactValue);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value)) {
    const lk = key.toLowerCase();
    const v = value[key];
    if (/authorization|cookie|token|secret|sapisid|imagebytes|bytes|base64|dataurl|imagedata/.test(lk)) {
      out[key] = typeof v === 'string' ? `[ẩn ${v.length} ký tự]` : '[ẩn]';
    } else if (typeof v === 'string' && v.length > 900) {
      out[key] = v.slice(0, 360) + `… [cắt ${v.length} ký tự]`;
    } else if (v && typeof v === 'object') {
      out[key] = bgRedactValue(v);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function bgCompactBody(body) {
  if (!body || typeof body !== 'string') return body || '';
  try {
    return JSON.stringify(bgRedactValue(JSON.parse(body)), null, 2).slice(0, 16000);
  } catch (e) {
    return body.length > 5000 ? body.slice(0, 5000) + `… [cắt ${body.length} ký tự]` : body;
  }
}

function bgPushTrace(record) {
  if (!bgTraceRecording) return;
  bgTraceBuffer.push(record);
  while (bgTraceBuffer.length > 220) bgTraceBuffer.shift();
  chrome.storage.local.set({ afBgApiTrace: bgTraceBuffer }, () => {});
}

function cdpDebuggee(tabId = cdpAttachedTabId) {
  return { tabId };
}

function cdpSendCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(cdpDebuggee(tabId), method, params, (result) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(result);
    });
  });
}

function cdpAttach(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach(cdpDebuggee(tabId), '1.3', () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

function cdpDetach(tabId = cdpAttachedTabId) {
  return new Promise((resolve) => {
    if (!tabId) {
      resolve();
      return;
    }
    chrome.debugger.detach(cdpDebuggee(tabId), () => resolve());
  });
}

function cdpSafeHeaders(headers = {}) {
  const out = {};
  for (const k of Object.keys(headers || {})) {
    out[k] = /authorization|cookie|token|sapisid|secret|auth/i.test(k) ? '***ĐÃ CHE***' : headers[k];
  }
  return out;
}

function cdpCompactBody(body) {
  if (!body || typeof body !== 'string') return body || '';
  try {
    return JSON.stringify(bgRedactValue(JSON.parse(body)), null, 2).slice(0, 24000);
  } catch (e) {
    return body.length > 8000 ? body.slice(0, 8000) + `… [cắt ${body.length} ký tự]` : body;
  }
}

function cdpPushTrace(record) {
  if (!cdpTraceRecording) return;
  cdpTraceBuffer.push(record);
  while (cdpTraceBuffer.length > 320) cdpTraceBuffer.shift();
  chrome.storage.local.set({ afCdpApiTrace: cdpTraceBuffer }, () => {});
}

async function cdpStartTrace(tabId, clear) {
  if (!tabId) throw new Error('No Flow tab');
  if (clear) {
    cdpTraceBuffer = [];
    cdpPendingRequests.clear();
    await chrome.storage.local.set({ afCdpApiTrace: [] });
  }
  if (cdpAttachedTabId && cdpAttachedTabId !== tabId) {
    await cdpDetach(cdpAttachedTabId);
    cdpAttachedTabId = null;
  }
  if (!cdpAttachedTabId) {
    await cdpAttach(tabId);
    cdpAttachedTabId = tabId;
    await cdpSendCommand(tabId, 'Network.enable', {
      maxTotalBufferSize: 10000000,
      maxResourceBufferSize: 5000000,
      maxPostDataSize: 5000000
    });
  }
  cdpTraceRecording = true;
  await chrome.storage.local.set({ afCdpTraceRecording: true });
  cdpPushTrace({
    at: Date.now(),
    time: new Date().toLocaleTimeString(),
    source: 'background.debugger',
    phase: 'trace-start',
    tabId
  });
}

async function cdpStopTrace() {
  cdpTraceRecording = false;
  await chrome.storage.local.set({ afCdpTraceRecording: false });
  if (cdpAttachedTabId) {
    const oldTabId = cdpAttachedTabId;
    await cdpDetach(oldTabId);
    cdpAttachedTabId = null;
    cdpPendingRequests.clear();
  }
}

function bgSetTraceRecording(recording, clear) {
  bgTraceRecording = !!recording;
  if (clear) bgTraceBuffer = [];
  chrome.storage.local.set({
    afTraceRecording: bgTraceRecording,
    afBgApiTrace: bgTraceBuffer
  }, () => {});
}

function bgRequestKey(details) {
  return `${details.requestId || ''}:${details.url || ''}`;
}

const bgPendingRequests = new Map();

chrome.webRequest.onBeforeRequest.addListener((details) => {
  if (!bgTraceRecording || !bgInterestingUrl(details.url)) return;
  const bodyInfo = bgRequestBody(details);
  const rec = {
    at: Date.now(),
    time: new Date().toLocaleTimeString(),
    source: 'background.webRequest',
    phase: 'request',
    tabId: details.tabId,
    requestId: details.requestId,
    method: details.method || '',
    kind: bgTraceKind(details.url),
    url: details.url,
    bodyType: bodyInfo.bodyType,
    body: bgCompactBody(bodyInfo.body)
  };
  bgPendingRequests.set(bgRequestKey(details), rec);
  bgPushTrace(rec);
}, {
  urls: [
    'https://aisandbox-pa.googleapis.com/*',
    'https://labs.google.com/*',
    'https://labs.google/*',
    'https://clients6.google.com/*'
  ]
}, ['requestBody']);

chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
  if (!bgTraceRecording || !bgInterestingUrl(details.url)) return;
  const key = bgRequestKey(details);
  const pending = bgPendingRequests.get(key);
  if (pending) {
    pending.headers = bgSafeHeaders(details.requestHeaders || []);
    bgPushTrace(Object.assign({}, pending, { phase: 'request+headers' }));
  }
}, {
  urls: [
    'https://aisandbox-pa.googleapis.com/*',
    'https://labs.google.com/*',
    'https://labs.google/*',
    'https://clients6.google.com/*'
  ]
}, ['requestHeaders']);

chrome.webRequest.onCompleted.addListener((details) => {
  if (!bgTraceRecording || !bgInterestingUrl(details.url)) return;
  bgPushTrace({
    at: Date.now(),
    time: new Date().toLocaleTimeString(),
    source: 'background.webRequest',
    phase: 'response',
    tabId: details.tabId,
    requestId: details.requestId,
    kind: bgTraceKind(details.url),
    status: details.statusCode,
    ok: details.statusCode >= 200 && details.statusCode < 300,
    url: details.url
  });
  bgPendingRequests.delete(bgRequestKey(details));
}, {
  urls: [
    'https://aisandbox-pa.googleapis.com/*',
    'https://labs.google.com/*',
    'https://labs.google/*',
    'https://clients6.google.com/*'
  ]
});

chrome.webRequest.onErrorOccurred.addListener((details) => {
  if (!bgTraceRecording || !bgInterestingUrl(details.url)) return;
  bgPushTrace({
    at: Date.now(),
    time: new Date().toLocaleTimeString(),
    source: 'background.webRequest',
    phase: 'error',
    tabId: details.tabId,
    requestId: details.requestId,
    kind: bgTraceKind(details.url),
    error: details.error,
    url: details.url
  });
  bgPendingRequests.delete(bgRequestKey(details));
}, {
  urls: [
    'https://aisandbox-pa.googleapis.com/*',
    'https://labs.google.com/*',
    'https://labs.google/*',
    'https://clients6.google.com/*'
  ]
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (!cdpTraceRecording || !source || source.tabId !== cdpAttachedTabId) return;

  if (method === 'Network.requestWillBeSent') {
    const req = params.request || {};
    const isDownload = bgIsDownloadUrl(req.url, params.type);
    if (!bgInterestingUrl(req.url) && !isDownload) return;
    const rec = {
      at: Date.now(),
      time: new Date().toLocaleTimeString(),
      source: 'background.debugger',
      phase: 'request',
      tabId: source.tabId,
      requestId: params.requestId,
      method: req.method || '',
      kind: isDownload ? 'download' : bgTraceKind(req.url),
      resourceType: params.type || '',
      url: req.url,
      headers: cdpSafeHeaders(req.headers || {}),
      postData: cdpCompactBody(req.postData || ''),
      initiator: params.initiator ? {
        type: params.initiator.type,
        url: params.initiator.url || '',
        lineNumber: params.initiator.lineNumber
      } : null
    };
    cdpPendingRequests.set(params.requestId, rec);
    cdpPushTrace(rec);
    return;
  }

  if (method === 'Network.responseReceived') {
    const resp = params.response || {};
    const isDownload = bgIsDownloadUrl(resp.url, params.type, resp.mimeType);
    if (!bgInterestingUrl(resp.url) && !isDownload) return;
    const pending = cdpPendingRequests.get(params.requestId) || {};
    const rec = {
      at: Date.now(),
      time: new Date().toLocaleTimeString(),
      source: 'background.debugger',
      phase: 'response',
      tabId: source.tabId,
      requestId: params.requestId,
      method: pending.method || '',
      kind: pending.kind || (isDownload ? 'download' : bgTraceKind(resp.url)),
      status: resp.status,
      ok: resp.status >= 200 && resp.status < 300,
      mimeType: resp.mimeType || '',
      url: resp.url,
      headers: cdpSafeHeaders(resp.headers || {})
    };
    cdpPushTrace(rec);
    return;
  }

  if (method === 'Network.loadingFinished') {
    const pending = cdpPendingRequests.get(params.requestId);
    if (!pending) return;
    // File video/media tải xuống có thể rất lớn → KHÔNG kéo body, chỉ ghi nhận đã xong.
    if (pending.kind === 'download') {
      cdpPushTrace({
        at: Date.now(),
        time: new Date().toLocaleTimeString(),
        source: 'background.debugger',
        phase: 'download-finished',
        tabId: source.tabId,
        requestId: params.requestId,
        method: pending.method || '',
        kind: 'download',
        url: pending.url,
        note: 'file tải xuống — bỏ qua nội dung body'
      });
      cdpPendingRequests.delete(params.requestId);
      return;
    }
    cdpSendCommand(source.tabId, 'Network.getResponseBody', { requestId: params.requestId })
      .then((bodyResp) => {
        // Thu media id VIDEO từ response generate/poll để tải hàng loạt qua API.
        if (!bodyResp.base64Encoded && (pending.kind === 'generate' || pending.kind === 'poll')) {
          rememberGeneratedMediaIds(harvestVideoMediaIds(bodyResp.body || ''));
        }
        cdpPushTrace({
          at: Date.now(),
          time: new Date().toLocaleTimeString(),
          source: 'background.debugger',
          phase: 'response-body',
          tabId: source.tabId,
          requestId: params.requestId,
          method: pending.method || '',
          kind: pending.kind || '',
          url: pending.url,
          base64Encoded: !!bodyResp.base64Encoded,
          body: bodyResp.base64Encoded ? '[response body base64 đã ẩn]' : cdpCompactBody(bodyResp.body || '')
        });
      })
      .catch((e) => {
        cdpPushTrace({
          at: Date.now(),
          time: new Date().toLocaleTimeString(),
          source: 'background.debugger',
          phase: 'response-body-error',
          tabId: source.tabId,
          requestId: params.requestId,
          kind: pending.kind || '',
          url: pending.url,
          error: e.message
        });
      })
      .finally(() => {
        cdpPendingRequests.delete(params.requestId);
      });
    return;
  }

  if (method === 'Network.loadingFailed') {
    const pending = cdpPendingRequests.get(params.requestId);
    if (!pending) return;
    cdpPushTrace({
      at: Date.now(),
      time: new Date().toLocaleTimeString(),
      source: 'background.debugger',
      phase: 'error',
      tabId: source.tabId,
      requestId: params.requestId,
      method: pending.method || '',
      kind: pending.kind || '',
      url: pending.url,
      error: params.errorText || ''
    });
    cdpPendingRequests.delete(params.requestId);
  }
});

chrome.debugger.onDetach.addListener((source, reason) => {
  if (source && source.tabId === cdpAttachedTabId) {
    cdpPushTrace({
      at: Date.now(),
      time: new Date().toLocaleTimeString(),
      source: 'background.debugger',
      phase: 'trace-detached',
      reason
    });
    cdpAttachedTabId = null;
    cdpTraceRecording = false;
    cdpPendingRequests.clear();
    chrome.storage.local.set({ afCdpTraceRecording: false }, () => {});
  }
});

// Chờ 1 lượt tải hoàn tất (state=complete) hoặc lỗi (interrupted). Dùng cho chuỗi
//   tự động nhiều dự án: phải tải XONG hết mới sang dự án kế.
function bgWaitDownloadComplete(downloadId, timeoutMs = 5 * 60 * 1000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => { if (done) return; done = true; chrome.downloads.onChanged.removeListener(onChanged); clearTimeout(timer); resolve(ok); };
    const onChanged = (delta) => {
      if (delta.id !== downloadId || !delta.state) return;
      if (delta.state.current === 'complete') finish(true);
      else if (delta.state.current === 'interrupted') finish(false);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    chrome.downloads.onChanged.addListener(onChanged);
    // Có thể đã xong trước khi kịp gắn listener.
    chrome.downloads.search({ id: downloadId }, (items) => {
      const st = items && items[0] && items[0].state;
      if (st === 'complete') finish(true);
      else if (st === 'interrupted') finish(false);
    });
  });
}

// Open side panel when clicking extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Handle messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // SELF-HEAL — (re)inject the MAIN-world network hook (inject.js) on demand.
  // After an extension UPDATE, Chrome does NOT re-inject world:MAIN content
  // scripts into already-open tabs, so inject.js can be missing even though the
  // ISOLATED content script reloaded — the extension then "does nothing" (no
  // Bearer captured, no image/video generation). The content script detects this
  // and asks us to force-load inject.js here. inject.js guards against
  // double-load (window.__afNetHook), so this is safe to call repeatedly.
  if (msg && msg.type === 'AF_ENSURE_INJECT') {
    const tabId = (sender && sender.tab && sender.tab.id) || msg.tabId;
    if (!tabId || !chrome.scripting || !chrome.scripting.executeScript) {
      sendResponse({ ok: false, reason: 'no-scripting-or-tab' });
      return false;
    }
    chrome.scripting.executeScript(
      { target: { tabId }, world: 'MAIN', files: ['inject.js'] },
      () => {
        const err = chrome.runtime.lastError;
        if (err) { console.warn('[AutoFlow] ensure-inject failed:', err.message); sendResponse({ ok: false, reason: err.message }); }
        else sendResponse({ ok: true });
      }
    );
    return true; // async sendResponse
  }

  // Download requests from content script
  if (msg.action === 'DOWNLOAD_FILE' && msg.url) {
    const options = { url: msg.url, saveAs: false };
    if (msg.filename) options.filename = safeDownloadFilename(msg.filename);
    chrome.downloads.download(options, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[AutoFlow] Download error:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId });
      }
    });
    return true;
  }

  // TẢI VIDEO QUA API (giống thao tác tay "Download 1080p" trên Flow).
  // Endpoint đã bắt được: GET https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=<MEDIA_ID>
  //   → server trả 302 redirect thẳng tới file mp4 đã ký trên flow-content.google.
  // Xác thực bằng COOKIE same-origin (labs.google) nên chrome.downloads tự gửi kèm,
  //   không cần Bearer token. Hậu tố "_upsampled" = bản 1080p; id trần = bản preview.
  if (msg.action === 'DOWNLOAD_FLOW_MEDIA') {
    const ids = Array.isArray(msg.mediaIds) ? msg.mediaIds : (msg.mediaId ? [msg.mediaId] : []);
    const fileNames = Array.isArray(msg.fileNames) ? msg.fileNames : [];
    const upsampled = msg.upsampled !== false; // mặc định tải bản 1080p
    const waitComplete = !!msg.waitComplete;   // chờ tải xong hẳn (cho chuỗi dự án)
    if (!ids.length) { sendResponse({ success: false, error: 'Thiếu mediaId' }); return false; }
    (async () => {
      const results = [];
      const startDownload = (name, id, filename) => new Promise((resolve, reject) => {
        const url = `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=${encodeURIComponent(name)}`;
        chrome.downloads.download({ url, saveAs: false, filename: safeDownloadFilename(filename, `${id}.mp4`) }, (dId) => {
          const err = chrome.runtime.lastError;
          if (err) reject(new Error(err.message)); else resolve(dId);
        });
      });
      for (let index = 0; index < ids.length; index++) {
        const raw = ids[index];
        const id = String(raw || '').trim().replace(/_upsampled$/, '');
        if (!id) continue;
        const filename = fileNames[index] || `${id}.mp4`;
        try {
          const downloadId = await startDownload(upsampled ? `${id}_upsampled` : id, id, filename);
          const completed = waitComplete ? await bgWaitDownloadComplete(downloadId) : true;
          results.push({ id, ok: completed, downloadId });
        } catch (e) {
          // Bản 1080p có thể chưa upsample xong → thử lại bản gốc (id trần).
          if (upsampled) {
            try {
              const dId = await startDownload(id, id, filename);
              const completed = waitComplete ? await bgWaitDownloadComplete(dId) : true;
              results.push({ id, ok: completed, downloadId: dId, fallback: 'preview' });
              continue;
            } catch (e2) { /* rơi xuống báo lỗi bên dưới */ }
          }
          results.push({ id, ok: false, error: e.message });
        }
      }
      const okCount = results.filter((r) => r.ok).length;
      sendResponse({ success: okCount > 0, okCount, total: results.length, results });
    })();
    return true;
  }

  // Forward from side panel → content script (explicit routing)
  if (msg.action === 'TO_CONTENT') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, msg.data, (resp) => {
          sendResponse(chrome.runtime.lastError ? { error: chrome.runtime.lastError.message } : resp);
        });
      } else {
        sendResponse({ error: 'No active tab' });
      }
    });
    return true;
  }

  // Keep-alive ping (from sidepanel)
  if (msg.action === 'KEEP_ALIVE') {
    sendResponse({ alive: true, timestamp: Date.now() });
    return false;
  }

  if (msg.action === 'TRACE_BG_CONTROL') {
    bgSetTraceRecording(!!msg.recording, !!msg.clear);
    sendResponse({ success: true, recording: bgTraceRecording, count: bgTraceBuffer.length });
    return false;
  }

  if (msg.action === 'TRACE_CDP_CONTROL') {
    (async () => {
      if (msg.recording) {
        await cdpStartTrace(msg.tabId, !!msg.clear);
        sendResponse({ success: true, recording: true, count: cdpTraceBuffer.length, tabId: cdpAttachedTabId });
      } else {
        await cdpStopTrace();
        if (msg.clear) {
          cdpTraceBuffer = [];
          await chrome.storage.local.set({ afCdpApiTrace: [] });
        }
        sendResponse({ success: true, recording: false, count: cdpTraceBuffer.length });
      }
    })().catch((e) => {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }

  // Start keep-alive alarm
  if (msg.action === 'START_KEEPALIVE_ALARM') {
    chrome.alarms.create('autoflow-keepalive', { periodInMinutes: 0.4 }); // Every 24 seconds
    console.log('[AutoFlow] Keep-alive alarm started');
    sendResponse({ success: true });
    return false;
  }

  // Stop keep-alive alarm
  if (msg.action === 'STOP_KEEPALIVE_ALARM') {
    // KHÔNG tắt alarm nếu đang chạy chuỗi nền — chuỗi cần keep-alive để sống.
    if (!bgChain) chrome.alarms.clear('autoflow-keepalive');
    console.log('[AutoFlow] Keep-alive alarm stopped (or kept for chain)');
    sendResponse({ success: true });
    return false;
  }

  // ===== CHUỖI DỰ ÁN CHẠY NỀN (độc lập side panel) =====
  // Side panel dựng sẵn danh sách payload từng dự án rồi giao cho background chạy,
  //   nhờ đó ĐÓNG/THU NHỎ panel vẫn tiếp tục. Chỉ cần giữ TAB Flow mở.
  if (msg.action === 'START_CHAIN') {
    const items = Array.isArray(msg.items) ? msg.items : [];
    if (!items.length) { sendResponse({ success: false, error: 'no-items' }); return false; }
    if (bgChain) { sendResponse({ success: false, error: 'already-running' }); return false; }
    (async () => {
      const savedData = await chrome.storage.local.get([BG_CHAIN_STORAGE_KEY]);
      const savedChain = savedData[BG_CHAIN_STORAGE_KEY];
      if (savedChain && savedChain.running) {
        sendResponse({ success: false, error: 'already-running' });
        bgResumePersistedChain();
        return;
      }
      let tabId = msg.tabId;
      if (!tabId) {
        const tabs = await chrome.tabs.query({});
        const f = tabs.find((t) => t.url && (t.url.includes('labs.google.com/fx') || t.url.includes('labs.google/fx')));
        tabId = f ? f.id : null;
      }
      if (!tabId) { sendResponse({ success: false, error: 'no-flow-tab' }); return; }
      const runId = `chain_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const chain = {
        running: true,
        runId,
        tabId,
        items,
        index: 0,
        phase: 'prepare',
        projectRunId: '',
        usedProjectIds: [],
        stopping: false,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      };
      await chrome.storage.local.set({
        [BG_CHAIN_STORAGE_KEY]: chain,
        [BG_CHAIN_BULK_ACCEPTED_KEY]: null,
        [BG_CHAIN_BULK_RESULT_KEY]: null,
        [BG_CHAIN_DOWNLOAD_ACCEPTED_KEY]: null,
        [BG_CHAIN_DOWNLOAD_RESULT_KEY]: null,
      });
      sendResponse({ success: true, started: true, count: items.length, runId });
      bgStartChainRunner(chain); // checkpoint trong storage giúp service worker ngủ vẫn tiếp tục
    })();
    return true;
  }

  if (msg.action === 'STOP_CHAIN') {
    (async () => {
      if (bgChain) {
        bgChain.stopping = true;
        await bgPersistChain();
        sendResponse({ success: true, stopping: true });
        return;
      }
      const data = await chrome.storage.local.get([BG_CHAIN_STORAGE_KEY]);
      const saved = data[BG_CHAIN_STORAGE_KEY];
      if (saved && saved.running) {
        saved.stopping = true;
        saved.updatedAt = Date.now();
        await chrome.storage.local.set({ [BG_CHAIN_STORAGE_KEY]: saved });
        sendResponse({ success: true, stopping: true });
        return;
      }
      sendResponse({ success: true, stopping: false });
    })();
    return true;
  }

  if (msg.action === 'CHAIN_STATUS') {
    (async () => {
      if (bgChain) {
        sendResponse({ running: true, index: bgChain.index, total: bgChain.items.length, phase: bgChain.phase || '' });
        return;
      }
      const data = await chrome.storage.local.get([BG_CHAIN_STORAGE_KEY]);
      const saved = data[BG_CHAIN_STORAGE_KEY];
      sendResponse({ running: !!(saved && saved.running), index: saved && saved.running ? saved.index : -1, total: saved && Array.isArray(saved.items) ? saved.items.length : 0, phase: saved && saved.phase || '' });
    })();
    return true;
  }

  // Notification request
  if (msg.action === 'NOTIFY') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: msg.title || 'Auto Flow Pro',
      message: msg.message || 'Queue completed!',
      priority: 2
    }, (notifId) => {
      if (chrome.runtime.lastError) {
        console.error('[AutoFlow] Notification error:', chrome.runtime.lastError.message);
      }
    });
    sendResponse({ success: true });
    return false;
  }
});

// Alarm handler — keep service worker alive
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoflow-keepalive') {
    // Ping content script to check if it's still alive
    checkFlowTabAlive();
    // MV3 có thể đã huỷ toàn bộ biến trong service worker. Checkpoint trong storage
    // cho phép alarm đánh thức và nối lại đúng phase thay vì dừng sau dự án đầu.
    bgResumePersistedChain();
  }
});

// Check if Flow tab is still alive and queue is running
async function checkFlowTabAlive() {
  try {
    const tabs = await chrome.tabs.query({});
    const flowTab = tabs.find(t =>
      t.url && (t.url.includes('labs.google.com/fx') || t.url.includes('labs.google/fx'))
    );

    if (flowTab) {
      chrome.tabs.sendMessage(flowTab.id, { action: 'PING' }, (resp) => {
        if (chrome.runtime.lastError) {
          console.log('[AutoFlow] Flow tab not responding, may need reload');
          handleConnectionLost(flowTab.id);
        } else {
          // Flow tab is alive
          if (resp && resp.state === 'running') {
            console.log('[AutoFlow] Queue running, prompt', resp.current, '/', resp.total);
          }
        }
      });
    }
  } catch (e) {
    console.error('[AutoFlow] Keep-alive check error:', e);
  }
}

// ============================================================================
// CHUỖI DỰ ÁN CHẠY NỀN — điều phối trong service worker, sống độc lập side panel.
//   Mỗi item: { key, flowUrl, preflight:{mode,characters}|null, genPayload, downloadUpsampled }
//   Vòng lặp: điều hướng tab → (tạo entity nếu cần) → xoá list → GEN_BULK (chờ BULK_DONE)
//             → DOWNLOAD_GENERATED_AND_WAIT (chờ render+tải) → dự án kế.
//   Keep-alive alarm (24s) giữ SW sống suốt lượt chạy.
// ============================================================================
let bgChain = null; // checkpoint hiện tại; bản bền vững nằm ở chrome.storage.local
let bgChainRunnerPromise = null;

function bgChainLog(text, level = 'info') {
  try { chrome.runtime.sendMessage({ type: 'CHAIN_LOG', text, level }, () => { if (chrome.runtime.lastError) { /* panel đóng: bỏ qua */ } }); } catch (e) {}
}

async function bgPersistChain(patch = null) {
  if (!bgChain) return;
  if (patch && typeof patch === 'object') Object.assign(bgChain, patch);
  bgChain.updatedAt = Date.now();
  await chrome.storage.local.set({ [BG_CHAIN_STORAGE_KEY]: bgChain });
}

function bgStartChainRunner(chain) {
  if (bgChainRunnerPromise) return bgChainRunnerPromise;
  bgChain = chain;
  bgChainRunnerPromise = bgRunChain().catch(async (e) => {
    bgChainLog(`⚠️ Nền tạm ngắt ở dự án ${bgChain && bgChain.items && bgChain.items[bgChain.index] ? bgChain.items[bgChain.index].key : '?'} (${e.message}). Checkpoint đã lưu, alarm sẽ tự nối lại.`, 'warning');
    if (bgChain) {
      bgChain.lastError = e.message || String(e);
      await bgPersistChain();
    }
  }).finally(() => {
    bgChainRunnerPromise = null;
    // Khi chưa hoàn tất, bỏ biến RAM để alarm có thể phục hồi từ checkpoint sạch.
    if (bgChain && bgChain.running) bgChain = null;
  });
  return bgChainRunnerPromise;
}

async function bgResumePersistedChain() {
  if (bgChain || bgChainRunnerPromise) return;
  try {
    const data = await chrome.storage.local.get([BG_CHAIN_STORAGE_KEY]);
    const saved = data[BG_CHAIN_STORAGE_KEY];
    if (!saved || !saved.running || !Array.isArray(saved.items) || !saved.items.length) return;
    // Chốt chống "chuỗi ma": một chuỗi bị bỏ dở (đóng trình duyệt, service worker chết
    //   giữa chừng) vẫn giữ cờ running=true trong storage. Nếu KHÔNG canh, lần thức dậy
    //   sau (kể cả nhiều giờ/ngày) sẽ tự chạy lại → TẠO/TẢI LẠI dự án cũ. Quá 12 giờ
    //   không cập nhật checkpoint = chắc chắn đã bỏ → dọn sạch, không tự chạy lại.
    const STALE_CHAIN_MS = 12 * 60 * 60 * 1000;
    if (saved.updatedAt && (Date.now() - saved.updatedAt) > STALE_CHAIN_MS) {
      await chrome.storage.local.remove([
        BG_CHAIN_STORAGE_KEY,
        BG_CHAIN_BULK_ACCEPTED_KEY,
        BG_CHAIN_BULK_RESULT_KEY,
        BG_CHAIN_DOWNLOAD_ACCEPTED_KEY,
        BG_CHAIN_DOWNLOAD_RESULT_KEY,
      ]);
      try { chrome.storage.local.set({ state: 'idle', afChainRunning: false }); } catch (e) {}
      bgChainLog('🧹 Nền: đã bỏ chuỗi cũ bị treo (hơn 12 giờ không hoạt động) — KHÔNG tự chạy/tải lại dự án cũ.', 'warning');
      return;
    }
    bgChainLog(`🔄 Nền: khôi phục chuỗi tại dự án ${saved.index + 1}/${saved.items.length} · bước ${saved.phase || 'prepare'}.`, 'warning');
    chrome.alarms.create('autoflow-keepalive', { periodInMinutes: 0.4 });
    bgStartChainRunner(saved);
  } catch (e) {
    console.warn('[AutoFlow] Không khôi phục được chuỗi:', e);
  }
}

function bgChainResultMatches(value, runId, projectRunId) {
  return !!(value && value.chainRunId === runId && value.projectRunId === projectRunId);
}

async function bgHasStoredChainMarker(storageKey, runId, projectRunId) {
  try {
    const data = await chrome.storage.local.get([storageKey]);
    return bgChainResultMatches(data[storageKey], runId, projectRunId);
  } catch (e) {
    return false;
  }
}

// Chờ tín hiệu có checkpoint kết quả. Kết quả được content_script ghi storage TRƯỚC
// khi broadcast, nên nếu service worker bị Chrome cho ngủ rồi khởi động lại vẫn đọc được.
function bgWaitForChainResult(messageType, storageKey, runId, projectRunId, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    let checking = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(poller);
      try { chrome.runtime.onMessage.removeListener(handler); } catch (e) {}
      resolve(value || null);
    };
    const checkStored = async () => {
      if (done || checking) return;
      if (bgChain && bgChain.stopping) { finish(null); return; }
      checking = true;
      try {
        const data = await chrome.storage.local.get([storageKey]);
        const value = data[storageKey];
        if (bgChainResultMatches(value, runId, projectRunId)) finish(value);
      } catch (e) {}
      checking = false;
    };
    const handler = (m) => {
      if (m && m.type === messageType && bgChainResultMatches(m, runId, projectRunId)) finish(m);
    };
    chrome.runtime.onMessage.addListener(handler);
    const poller = setInterval(checkStored, 3000);
    const timer = setTimeout(() => finish(null), timeoutMs);
    checkStored();
  });
}

// Gửi 1 message tới tab và chờ phản hồi (hoặc timeout) — không bao giờ throw.
function bgSendTab(tabId, data, timeoutMs = 0) {
  return new Promise((resolve) => {
    let done = false;
    const timer = timeoutMs ? setTimeout(() => { if (!done) { done = true; resolve(null); } }, timeoutMs) : null;
    try {
      chrome.tabs.sendMessage(tabId, data, (resp) => {
        if (done) return; done = true; if (timer) clearTimeout(timer);
        resolve(chrome.runtime.lastError ? null : resp);
      });
    } catch (e) { if (!done) { done = true; if (timer) clearTimeout(timer); resolve(null); } }
  });
}

// Chờ 1 broadcast runtime-message thoả điều kiện (BULK_DONE / CHAR_DONE…), 1 lần.
function bgWaitForMessage(matchFn, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (val) => { if (done) return; done = true; clearTimeout(timer); try { chrome.runtime.onMessage.removeListener(handler); } catch (e) {} resolve(val); };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const handler = (m) => { if (!done && matchFn(m)) finish(m); };
    chrome.runtime.onMessage.addListener(handler);
  });
}

// Chờ tab điều hướng xong tới đúng dự án và content_script phản hồi PING.
async function bgWaitFlowReady(tabId, wantPid, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (bgChain && bgChain.stopping) return false;
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab && tab.status === 'complete' && (!wantPid || bgProjectIdFromUrl(tab.url) === wantPid)) {
        const resp = await bgSendTab(tabId, { action: 'PING' }, 2500);
        if (resp) return true;
      }
    } catch (e) { return false; }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

function bgIsFlowHomeUrl(url) {
  try {
    const u = new URL(url || '');
    return /\/tools\/flow\/?$/.test(u.pathname) && !bgProjectIdFromUrl(u.toString());
  } catch (e) {
    return false;
  }
}

// Không dùng bgWaitFlowReady(tabId, '') cho bước thoát project: wantPid rỗng từng
// khiến PING của content script cũ được nhận ngay trước khi navigation bắt đầu,
// làm background tưởng đã về trang danh sách dù URL vẫn là project 1.
async function bgWaitFlowHomeReady(tabId, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (bgChain && bgChain.stopping) return false;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) return false;
    if (tab.status === 'complete' && bgIsFlowHomeUrl(tab.url)) {
      const resp = await bgSendTab(tabId, { action: 'PING' }, 2500);
      if (resp) return true;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

// Sinh UUID v4 — dùng làm projectId MỚI khi tự tạo project cho dự án kế tiếp.
//   (Theo trace 18/7: bấm "New project" trên Flow chỉ là điều hướng URL sang
//   /project/<uuid mới> — id sinh phía client, server tự khởi tạo project.)
function bgUuid4() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}

// Dựng URL project MỚI, giữ nguyên origin + locale của tab hiện tại
//   (vd. https://labs.google/fx/vi/tools/flow/project/<pid>).
function bgNewProjectUrl(currentUrl, pid) {
  try {
    const u = new URL(currentUrl || 'https://labs.google/fx/vi/tools/flow');
    const m = u.pathname.match(/^(.*\/tools\/flow)/);
    const base = m ? m[1] : '/fx/vi/tools/flow';
    return `${u.origin}${base}/project/${pid}`;
  } catch (e) {
    return `https://labs.google/fx/vi/tools/flow/project/${pid}`;
  }
}

function bgFlowHomeUrl(currentUrl) {
  try {
    const u = new URL(currentUrl || 'https://labs.google/fx/vi/tools/flow');
    const m = u.pathname.match(/^(.*\/tools\/flow)/);
    u.pathname = m ? m[1] : '/fx/vi/tools/flow';
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch (e) {
    return 'https://labs.google/fx/vi/tools/flow';
  }
}

async function bgLeaveCurrentProject(tabId) {
  const cur = await chrome.tabs.get(tabId).catch(() => null);
  const homeUrl = bgFlowHomeUrl(cur && cur.url);
  if (!cur || !bgIsFlowHomeUrl(cur.url)) {
    bgChainLog('↩️ Nền: thoát dự án cũ → về danh sách Flow…', 'info');
    await chrome.tabs.update(tabId, { url: homeUrl }).catch(() => {});
  }
  const ready = await bgWaitFlowHomeReady(tabId, 60000);
  if (!ready) throw new Error('Không xác nhận được trang danh sách Flow sau khi thoát project');
  await new Promise((r) => setTimeout(r, 900));
  return homeUrl;
}

async function bgWaitForNewProjectRoute(tabId, usedProjectIds, timeoutMs = 60000) {
  const used = usedProjectIds instanceof Set ? usedProjectIds : new Set(usedProjectIds || []);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (bgChain && bgChain.stopping) return null;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    const pid = bgProjectIdFromUrl(tab && tab.url);
    if (pid && !used.has(pid)) {
      const ready = await bgWaitFlowReady(tabId, pid, 60000);
      if (ready) return { pid, url: tab.url };
      return null;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

async function bgRememberProjectFlowUrl(key, flowUrl) {
  if (!key || !flowUrl) return;
  try {
    const data = await chrome.storage.local.get(['afProjects']);
    const projects = data.afProjects || {};
    if (!projects[key]) return;
    projects[key] = { ...projects[key], flowUrl };
    await chrome.storage.local.set({ afProjects: projects });
  } catch (e) {}
}

// Mở đúng project cho một slot. Trace thao tác tay 18/7 cho thấy luồng chuẩn là:
// project cũ → /tools/flow (danh sách) → /project/<uuid> → POST session.
// Dự án đầu có thể dùng project đang gắn sẵn. Từ dự án thứ 2 trở đi LUÔN tạo
// project Flow mới: flowUrl của các slot có thể đã bị auto-save nhầm về project 1.
async function bgPrepareProjectRoute(it, index) {
  const tabId = bgChain.tabId;
  const used = new Set(Array.isArray(bgChain.usedProjectIds) ? bgChain.usedProjectIds : []);
  const linkedPid = bgProjectIdFromUrl(it.flowUrl || '');
  const duplicateLink = !!(linkedPid && used.has(linkedPid));
  // key !== '1' phòng trường hợp Dự án 1 trống: Dự án 2 dù là item đầu tiên
  // trong chain vẫn phải tạo thư mục mới, không được dùng flowUrl cũ của slot 2.
  const mustCreateNew = index > 0 || String(it.key || '') !== '1' || !linkedPid || duplicateLink;

  // Không chỉ chặn project đã chạy trong lượt hiện tại mà chặn luôn toàn bộ link cũ
  // trong các slot. Ảnh log thực tế cho thấy slot 2 giữ URL project 1 nhưng ID đó
  // không có trong used sau một lần service-worker khôi phục, nên kiểm tra cũ lọt.
  const blockedProjectIds = new Set(used);
  for (const savedItem of (Array.isArray(bgChain.items) ? bgChain.items : [])) {
    const oldPid = bgProjectIdFromUrl(savedItem && savedItem.flowUrl || '');
    if (oldPid) blockedProjectIds.add(oldPid);
  }
  const beforeLeave = await chrome.tabs.get(tabId).catch(() => null);
  const previousPid = bgProjectIdFromUrl(beforeLeave && beforeLeave.url);
  if (mustCreateNew && previousPid) blockedProjectIds.add(previousPid);

  if (mustCreateNew) await bgLeaveCurrentProject(tabId);

  let targetUrl = it.flowUrl || '';
  let targetPid = linkedPid;
  if (mustCreateNew) {
    bgChainLog(index > 0
      ? `🆕 Nền: Dự án ${it.key} — bỏ link cũ và bấm “Dự án mới” trên Flow…`
      : duplicateLink
        ? `🆕 Nền: Dự án ${it.key} có link trùng — bấm tạo project MỚI trên Flow…`
        : `🆕 Nền: Dự án ${it.key} — bấm tạo project MỚI trên Flow…`, 'info');

    // Ưu tiên đúng thao tác tay trong trace: từ /tools/flow bấm "Create with Google
    // Flow" để frontend tự sinh UUID và khởi tạo session. Trước đây tự ghép UUID
    // trực tiếp nên có thể mắc ở route project chưa được app khởi tạo.
    const createAck = await bgSendTab(tabId, { action: 'CREATE_NEW_FLOW_PROJECT' }, 8000);
    const created = createAck && createAck.success
      ? await bgWaitForNewProjectRoute(tabId, blockedProjectIds, 25000)
      : null;
    if (created) {
      targetPid = created.pid;
      targetUrl = created.url;
      bgChainLog(`✅ Nền: Flow đã tạo project mới …/${targetPid.slice(0, 8)}.`, 'success');
    } else {
      // Lưới an toàn khi Google đổi nhãn/nút: vẫn không để cả chuỗi đứng vô hạn.
      const cur = await chrome.tabs.get(tabId).catch(() => null);
      targetPid = bgUuid4();
      targetUrl = bgNewProjectUrl(cur && cur.url, targetPid);
      bgChainLog(`⚠️ Nền: nút tạo project không phản hồi — dùng URL dự phòng …/${targetPid.slice(0, 8)}.`, 'warning');
    }
  } else {
    bgChainLog(`🔀 Nền: mở project của Dự án ${it.key} …/${targetPid.slice(0, 8)}`, 'info');
  }

  const cur = await chrome.tabs.get(tabId).catch(() => null);
  if (!cur || bgProjectIdFromUrl(cur.url) !== targetPid) {
    await chrome.tabs.update(tabId, { url: targetUrl }).catch(() => {});
  }
  const ready = await bgWaitFlowReady(tabId, targetPid, 60000);
  await new Promise((r) => setTimeout(r, 5000)); // đợi Flow POST session và bắt Bearer
  if (!ready) bgChainLog(`⚠️ Nền: project …/${targetPid.slice(0, 8)} tải hơi lâu — vẫn thử tiếp.`, 'warning');

  // Chốt bảo vệ cuối: dự án sau tuyệt đối không được phát GEN_BULK vào project cũ.
  const afterOpen = await chrome.tabs.get(tabId).catch(() => null);
  const openedPid = bgProjectIdFromUrl(afterOpen && afterOpen.url);
  if (index > 0 && (!openedPid || openedPid === previousPid || blockedProjectIds.has(openedPid))) {
    throw new Error(`Dự án ${it.key} chưa mở được project Flow mới (vẫn ở …/${String(openedPid || previousPid || '?').slice(0, 8)})`);
  }

  it.flowUrl = targetUrl;
  used.add(targetPid);
  bgChain.usedProjectIds = [...used];
  await bgRememberProjectFlowUrl(it.key, targetUrl);
  await bgPersistChain();
  return targetPid;
}

async function bgRunChain() {
  const items = bgChain.items;
  const tabId = bgChain.tabId;
  chrome.alarms.create('autoflow-keepalive', { periodInMinutes: 0.4 });
  try { chrome.storage.local.set({ state: 'running', afChainRunning: true }); } catch (e) {}
  try { await chrome.tabs.update(tabId, { autoDiscardable: false }); } catch (e) {}
  if ((bgChain.index || 0) === 0 && (bgChain.phase || 'prepare') === 'prepare') {
    bgChainLog(`🏁 Nền: bắt đầu chuỗi ${items.length} dự án. Có thể đóng/thu nhỏ panel — giữ tab Flow mở.`, 'success');
  }

  for (let i = Math.max(0, bgChain.index || 0); i < items.length; i++) {
    if (!bgChain || bgChain.stopping) break;
    bgChain.index = i;
    const it = items[i] || {};
    if (!bgChain.projectRunId) bgChain.projectRunId = `${bgChain.runId}_p${i}_${Date.now()}`;
    const projectRunId = bgChain.projectRunId;
    let phase = bgChain.phase || 'prepare';
    bgChainLog(`▶️ Nền: dự án ${it.key} (${i + 1}/${items.length}) · bước ${phase}`, 'info');

    const nominalExpectVideos = it.genPayload
      ? Math.max(1, ((it.genPayload.items && it.genPayload.items.length) || (it.genPayload.prompts && it.genPayload.prompts.length) || 1) * Math.max(1, it.genPayload.count || 1))
      : 0;
    let expectVideos = Math.max(0, Number(bgChain.expectedVideos) || nominalExpectVideos);

    let bulk = null;
    if (phase === 'prepare') {
      // 1) Thoát project cũ (từ dự án 2) rồi vào/tạo project đúng slot.
      await bgPrepareProjectRoute(it, i);
      if (bgChain.stopping) break;

      // 2) Preflight tạo ENTITY nhân vật (chỉ khi mode=entity & chưa có sẵn).
      if (it.preflight && it.preflight.mode === 'entity' && Array.isArray(it.preflight.characters) && it.preflight.characters.length) {
        bgChainLog(`👤 Nền: tạo entity nhân vật cho dự án ${it.key}…`, 'info');
        const charWait = bgWaitForMessage((m) => m && m.type === 'CHAR_DONE', 4 * 60 * 1000);
        bgSendTab(tabId, { action: 'SETUP_CHARACTER_ENTITIES', characters: it.preflight.characters });
        const done = await charWait;
        const entities = done && Array.isArray(done.entities) ? done.entities.filter((e) => e && (e.entityId || e.id)) : [];
        if (entities.length) { it.genPayload.characterEntities = entities; bgChainLog(`👤 Nền: đã có ${entities.length} entityId.`, 'success'); }
        else bgChainLog(`⚠️ Nền: entity chưa sẵn sàng cho dự án ${it.key} — vẫn thử tạo video bằng @Tên.`, 'warning');
      }
      if (bgChain.stopping) break;

      // 3) Xoá media/result cũ, checkpoint TRƯỚC khi gửi tạo để không tạo trùng nếu SW ngủ.
      await bgSendTab(tabId, { action: 'CLEAR_GENERATED_VIDEOS' }, 10000);
      await chrome.storage.local.set({
        [BG_CHAIN_BULK_ACCEPTED_KEY]: null,
        [BG_CHAIN_BULK_RESULT_KEY]: null,
        [BG_CHAIN_DOWNLOAD_ACCEPTED_KEY]: null,
        [BG_CHAIN_DOWNLOAD_RESULT_KEY]: null,
      });
      phase = 'generating';
      await bgPersistChain({ phase });
      const bulkWait = bgWaitForChainResult('BULK_DONE', BG_CHAIN_BULK_RESULT_KEY, bgChain.runId, projectRunId, 30 * 60 * 1000);
      const genPayload = { ...it.genPayload, chainRunId: bgChain.runId, projectRunId, chainIndex: i, projectKey: it.key };
      await bgSendTab(tabId, genPayload, 10000);
      bgChainLog(`🚀 Nền: đã gửi tạo video dự án ${it.key}, chờ gửi xong…`, 'info');
      bulk = await bulkWait;
    } else if (phase === 'generating') {
      // Service worker vừa thức lại: KHÔNG gửi tạo lần hai; đọc kết quả đã checkpoint
      // hoặc chờ BULK_DONE của lượt đang chạy trên trang.
      const accepted = await bgHasStoredChainMarker(BG_CHAIN_BULK_ACCEPTED_KEY, bgChain.runId, projectRunId);
      const completed = await bgHasStoredChainMarker(BG_CHAIN_BULK_RESULT_KEY, bgChain.runId, projectRunId);
      if (!accepted && !completed) {
        // Checkpoint được ghi trước khi dispatch. Nếu Chrome ngủ đúng khe rất nhỏ đó,
        // content chưa ghi marker "accepted" → gửi lại là an toàn và cần thiết.
        bgChainLog(`🔄 Nền: yêu cầu tạo dự án ${it.key} chưa tới trang — gửi lại từ checkpoint.`, 'warning');
        const genPayload = { ...it.genPayload, chainRunId: bgChain.runId, projectRunId, chainIndex: i, projectKey: it.key };
        await bgSendTab(tabId, genPayload, 10000);
      } else {
        bgChainLog(`🔄 Nền: nối lại bước chờ tạo của dự án ${it.key} (không gửi trùng prompt).`, 'info');
      }
      bulk = await bgWaitForChainResult('BULK_DONE', BG_CHAIN_BULK_RESULT_KEY, bgChain.runId, projectRunId, 30 * 60 * 1000);
    }
    if (bgChain.stopping) break;
    let dl = null;
    if (phase !== 'downloading') {
      if (!bulk) bgChainLog(`⚠️ Nền: dự án ${it.key} không nhận được báo tạo xong (timeout) — vẫn thử tải.`, 'warning');
      else if (!bulk.ok) bgChainLog(`❌ Nền: dự án ${it.key} tạo lỗi — vẫn thử tải phần đã tạo.`, 'error');

      // Dùng đúng số media id mà response tạo đã bóc được. Trước đây luôn chờ số
      // prompt danh nghĩa; chỉ cần một prompt lỗi hoặc storage mất một lượt ghi là
      // dự án 1 đứng thêm 10–45 phút và người dùng tưởng chuỗi đã dừng hẳn.
      if (bulk) {
        const harvested = Math.max(0, Number(bulk.harvestedIdCount) || 0);
        const submitted = Math.max(0, Number(bulk.submittedCount) || 0);
        expectVideos = harvested || submitted || (bulk.ok ? nominalExpectVideos : 0);
      }

      // Không có request video nào được Flow nhận: ghi lỗi rồi chuyển dự án kế,
      // tuyệt đối không chờ download một thứ không tồn tại.
      if (bulk && Object.prototype.hasOwnProperty.call(bulk, 'submittedCount') && Number(bulk.submittedCount) === 0) {
        dl = { success: false, error: 'no-video-submitted', okCount: 0, total: 0 };
      } else {
      // 4) Checkpoint TRƯỚC khi yêu cầu download; completion cũng được content lưu.
      phase = 'downloading';
      await bgPersistChain({ phase, expectedVideos: expectVideos });
      bgChainLog(`💾 Nền: dự án ${it.key} — chờ render & tải toàn bộ video…`, 'info');
      const downloadWait = bgWaitForChainResult('CHAIN_DOWNLOAD_DONE', BG_CHAIN_DOWNLOAD_RESULT_KEY, bgChain.runId, projectRunId, 45 * 60 * 1000);
      bgSendTab(tabId, {
        action: 'DOWNLOAD_GENERATED_AND_WAIT',
        upsampled: !!it.downloadUpsampled,
        quality: it.downloadQuality || (it.downloadUpsampled ? '1080' : '720'),
        expect: expectVideos,
        downloadBaseName: it.genPayload && it.genPayload.downloadBaseName,
        chainRunId: bgChain.runId,
        projectRunId,
        chainIndex: i,
        projectKey: it.key,
      }, 15000);
      dl = await downloadWait;
      }
    } else {
      const accepted = await bgHasStoredChainMarker(BG_CHAIN_DOWNLOAD_ACCEPTED_KEY, bgChain.runId, projectRunId);
      const completed = await bgHasStoredChainMarker(BG_CHAIN_DOWNLOAD_RESULT_KEY, bgChain.runId, projectRunId);
      if (!accepted && !completed) {
        bgChainLog(`🔄 Nền: yêu cầu tải dự án ${it.key} chưa tới trang — gửi lại từ checkpoint.`, 'warning');
        bgSendTab(tabId, {
          action: 'DOWNLOAD_GENERATED_AND_WAIT',
          upsampled: !!it.downloadUpsampled,
          quality: it.downloadQuality || (it.downloadUpsampled ? '1080' : '720'),
          expect: expectVideos,
          downloadBaseName: it.genPayload && it.genPayload.downloadBaseName,
          chainRunId: bgChain.runId,
          projectRunId,
          chainIndex: i,
          projectKey: it.key,
        }, 15000);
      } else {
        bgChainLog(`🔄 Nền: nối lại bước chờ tải của dự án ${it.key}.`, 'info');
      }
      dl = await bgWaitForChainResult('CHAIN_DOWNLOAD_DONE', BG_CHAIN_DOWNLOAD_RESULT_KEY, bgChain.runId, projectRunId, 45 * 60 * 1000);
    }
    if (dl && dl.success) bgChainLog(`✅ Nền: dự án ${it.key} xong — đã tải ${dl.okCount}/${dl.total} video.`, 'success');
    else bgChainLog(`⚠️ Nền: dự án ${it.key} tải chưa trọn (${(dl && dl.error) || 'timeout'}).`, 'warning');

    // Checkpoint dự án kế. Từ vòng sau luôn đi qua /tools/flow trước khi mở project.
    await bgPersistChain({ index: i + 1, phase: 'prepare', projectRunId: '', expectedVideos: 0, lastError: '' });
    await new Promise((r) => setTimeout(r, 2500));
  }

  const stopped = !!(bgChain && bgChain.stopping);
  if (bgChain) bgChain.running = false;
  await chrome.storage.local.remove([
    BG_CHAIN_STORAGE_KEY,
    BG_CHAIN_BULK_ACCEPTED_KEY,
    BG_CHAIN_BULK_RESULT_KEY,
    BG_CHAIN_DOWNLOAD_ACCEPTED_KEY,
    BG_CHAIN_DOWNLOAD_RESULT_KEY,
  ]);
  bgChain = null;
  try { chrome.storage.local.set({ state: 'idle', afChainRunning: false }); } catch (e) {}
  try { await chrome.tabs.update(tabId, { autoDiscardable: true }); } catch (e) {}
  bgChainLog(stopped ? '⏹️ Nền: đã dừng chuỗi dự án.' : '🏁 Nền: đã chạy xong chuỗi các dự án.', stopped ? 'warning' : 'success');
  try { chrome.runtime.sendMessage({ type: 'CHAIN_DONE', stopped }, () => { if (chrome.runtime.lastError) {} }); } catch (e) {}
  try {
    chrome.notifications.create({ type: 'basic', iconUrl: 'icons/icon128.png', title: 'AutoFlow Reel', message: stopped ? 'Đã dừng chuỗi dự án.' : 'Đã chạy xong tất cả dự án!', priority: 2 }, () => { if (chrome.runtime.lastError) {} });
  } catch (e) {}
}

// Handle connection loss — try to recover
async function handleConnectionLost(tabId) {
  // Đang chạy CHUỖI NỀN: chuỗi tự điều hướng/chờ tab; KHÔNG được reload tab kẻo đứt lượt.
  //   (Ping có thể lỗi tạm thời trong lúc chuyển dự án — đó là bình thường.)
  if (bgChain) return;
  const data = await chrome.storage.local.get(['settings', 'savedQueue', 'state']);

  // Only auto-recover if autoResume is enabled and we were running
  if (data.settings && data.settings.autoResume && data.state === 'running' && data.savedQueue) {
    console.log('[AutoFlow] Auto-resume: connection lost, will attempt recovery');

    // Try to reload the content script by refreshing the tab
    try {
      await chrome.tabs.reload(tabId);
      console.log('[AutoFlow] Reloaded Flow tab for recovery');

      // Wait for page to load, then signal sidepanel
      setTimeout(() => {
        chrome.runtime.sendMessage({ type: 'CONNECTION_RECOVERED', tabId }, () => {
          if (chrome.runtime.lastError) { /* sidepanel may not be open */ }
        });
      }, 5000);
    } catch (e) {
      console.error('[AutoFlow] Tab reload failed:', e);
    }
  }
}

// Đọc projectId từ URL Flow (dạng .../project/<uuid>).
function bgProjectIdFromUrl(url) {
  const m = /\/project\/([0-9a-fA-F-]{36})/.exec(String(url || ''));
  return m ? m[1] : '';
}
const bgLastProjectByTab = new Map();

// Ghi mốc CHUYỂN DỰ ÁN vào trace (khi đang GHI) — bắt được "thoát dự án cũ → vào
//   dự án mới". Flow là SPA nên đổi dự án làm URL đổi qua history API; onUpdated báo
//   changeInfo.url. Đây là "API" thực chất của việc chuyển dự án: điều hướng URL,
//   kéo theo loạt call khởi tạo (sessions/applets/likeness/checkAppAvailability).
function bgTrackProjectSwitch(tabId, url) {
  const pid = bgProjectIdFromUrl(url);
  if (!pid) return;
  const prev = bgLastProjectByTab.get(tabId) || '';
  if (prev === pid) return;
  bgLastProjectByTab.set(tabId, pid);
  const rec = {
    at: Date.now(),
    time: new Date().toLocaleTimeString(),
    source: 'background.tabs',
    phase: 'project-switch',
    kind: 'project',
    tabId,
    fromProjectId: prev || null,
    toProjectId: pid,
    url,
  };
  bgPushTrace(rec);
  cdpPushTrace(rec);
}

// Listen for tab updates (page reload, navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || (tab && tab.url) || '';
  if ((tab && tab.url && /labs\.google(\.com)?\/fx/.test(tab.url)) || /labs\.google(\.com)?\/fx/.test(url)) {
    bgTrackProjectSwitch(tabId, url || (tab && tab.url));
  }
  if (changeInfo.status === 'complete' && tab.url &&
      (tab.url.includes('labs.google.com/fx') || tab.url.includes('labs.google/fx'))) {
    // Flow page just loaded/reloaded — notify sidepanel
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'FLOW_TAB_READY', tabId }, () => {
        if (chrome.runtime.lastError) { /* sidepanel may not be open */ }
      });
    }, 2000);
  }
});

// Log installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('[AutoFlow] Extension v9.52 installed');
});

// Khi Chrome dựng lại MV3 service worker, nối tiếp checkpoint chuỗi nếu còn chạy.
bgResumePersistedChain();
