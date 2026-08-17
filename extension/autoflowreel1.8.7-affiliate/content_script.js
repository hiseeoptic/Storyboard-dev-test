// ============================================================
// AutoFlow Reel — Content Script (xem const EXT_VERSION bên dưới để biết phiên bản)
// Key: Google Flow 2026 uses Slate.js editor, NOT regular textarea
// ============================================================

(function () {
  'use strict';

  if (window.__autoFlowLoaded) return;
  window.__autoFlowLoaded = true;

  // PHIÊN BẢN content_script ĐANG CHẠY TRÊN TRANG FLOW. Phải khớp header side panel.
  // Nếu Nhật ký/Quét UI hiện số CŨ hơn → trang Flow CHƯA nạp code mới → BẤM F5.
  // Lấy TỰ ĐỘNG từ manifest để KHÔNG bao giờ lệch (trước đây hằng số này bị quên
  // cập nhật → luôn hiện "9.52" dù đã build bản mới, gây hiểu nhầm).
  const EXT_VERSION = (function () {
    try { return chrome.runtime.getManifest().version; } catch (e) { return '9.58'; }
  })();

  // ========================
  // STATE
  // ========================
  let queue = [];
  let currentIndex = 0;
  let state = 'idle';
  let cfg = {};
  let totalPrompts = 0;
  let teachTarget = null;
  let elementMap = {};
  let overlay = null;
  let banner = null;

  // ========================
  // LOGGING
  // ========================
  const log = msg => console.log(`%c[AutoFlow] ${msg}`, 'color:#3b82f6;font-weight:bold');
  const logWarn = msg => console.warn(`%c[AutoFlow] ${msg}`, 'color:#eab308;font-weight:bold');
  const logError = msg => console.error(`%c[AutoFlow] ${msg}`, 'color:#ef4444;font-weight:bold');
  // logUI: vừa ghi console, vừa GỬI LÊN SIDE PANEL (Nhật ký) để người dùng thấy
  // các bước quan trọng mà không cần mở Console (F12).
  const logUI = (msg, level) => { (level === 'error' ? logError : level === 'warning' ? logWarn : log)(msg); notify('LOG', { message: msg, level: level || 'info' }); };
  // True once we've received ANY message from the MAIN-world hook (inject.js).
  // Only inject.js posts source:'AF_NET', so this is a reliable "is inject
  // loaded on this page?" signal we can report back synchronously.
  let afNetSeen = false;
  let afEnsureInjectTries = 0;
  // SELF-HEAL: after an extension UPDATE, Chrome does NOT re-inject world:MAIN
  // content scripts into already-open tabs, so inject.js (the network hook that
  // captures the Bearer and runs image/video generation) can be missing even
  // though THIS isolated script reloaded — the panel then "does nothing". Ask the
  // background to programmatically (re)inject inject.js into the MAIN world. It is
  // idempotent (inject.js guards on window.__afNetHook), so repeat calls are safe.
  function ensureInjectLoaded() {
    return new Promise((resolve) => {
      if (afNetSeen) { resolve(true); return; }
      afEnsureInjectTries++;
      try {
        chrome.runtime.sendMessage({ type: 'AF_ENSURE_INJECT' }, (resp) => {
          void chrome.runtime.lastError; // ignore; caller waits on afNetSeen
          resolve(!!(resp && resp.ok));
        });
      } catch (e) { resolve(false); }
    });
  }
  // Wait up to timeoutMs for the MAIN-world hook to come alive, forcing a
  // (re)injection first when it hasn't been seen. Returns whether it is alive.
  async function waitForInject(timeoutMs) {
    if (afNetSeen) return true;
    await ensureInjectLoaded();
    const deadline = Date.now() + (timeoutMs || 2500);
    while (!afNetSeen && Date.now() < deadline) { await sleep(150); }
    return afNetSeen;
  }

  // ========================
  // UTILS
  // ========================
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = seconds => sleep(seconds * 1000);

  function isVisible(el) {
    if (!el) return false;
    try {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0;
    } catch (e) { return false; }
  }

  // El có phải Ô GÕ thật không? (textarea/input, hoặc contenteditable / Slate editor).
  // Dùng để loại bỏ trường hợp teach trúng thẻ <p> placeholder "Bạn muốn tạo gì?".
  function isEditableInput(el) {
    if (!el || !isVisible(el)) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') return true;
    if (el.isContentEditable) return true;
    const ce = el.getAttribute && el.getAttribute('contenteditable');
    if (ce === 'true' || ce === 'plaintext-only') return true;
    if (el.getAttribute && el.getAttribute('data-slate-editor') === 'true') return true;
    // role=textbox bao quanh một editor con
    if (el.getAttribute && el.getAttribute('role') === 'textbox' &&
        el.querySelector('[contenteditable="true"],[data-slate-editor="true"]')) return true;
    return false;
  }

  // Khung "thanh prompt" chứa cả ô gõ LẪN các nút (+ / Tác nhân / Tạo). Leo lên từ
  // ô gõ tới tổ tiên đầu tiên có chứa <button> — đảm bảo phạm vi tìm "+" và đếm
  // ảnh đính kèm là ĐÚNG thanh prompt, không bị bó hẹp vào riêng ô chữ.
  function getPromptScope() {
    const pi = DOM.getPromptInput && DOM.getPromptInput();
    if (!pi) return document.body;
    let node = pi;
    for (let i = 0; i < 6 && node && node !== document.body; i++) {
      node = node.parentElement;
      if (node && node.querySelector('button, [role="button"]')) return node;
    }
    return pi.closest('form, [class*="prompt"], [class*="composer"], [class*="input"]') || pi.parentElement || document.body;
  }

  function notify(type, data = {}) {
    try {
      chrome.runtime.sendMessage({ type, ...data }, () => {
        if (chrome.runtime.lastError) {}
      });
    } catch (e) {}
  }

  // ========================
  // RADIX UI CLICK — Required for Google Flow popups/buttons
  // Simple .click() does NOT work for Radix UI components!
  // ========================
  function simulateRadixClick(el) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
  }

  // Find the MODE button in bottom bar (shows "Video □ x2", "Nano Banana □ x2" etc.)
  function findModeButton() {
    // Strategy 1: Legacy combobox
    const combobox = document.querySelector('button[role="combobox"]');
    if (combobox && isVisible(combobox)) return combobox;

    // Strategy 2: Button with "x1"-"x4" pattern + mode keywords
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      if (!isVisible(btn)) continue;
      const text = (btn.textContent || '').trim();
      if (/x\d+$/i.test(text) && (
        text.toLowerCase().includes('video') ||
        text.toLowerCase().includes('image') ||
        text.toLowerCase().includes('nano') ||
        text.toLowerCase().includes('veo') ||
        text.toLowerCase().includes('imagen')
      )) {
        return btn;
      }
    }

    // Strategy 3: Any button matching mode keywords in bottom half
    for (const btn of allButtons) {
      if (!isVisible(btn)) continue;
      const r = btn.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.5) continue;
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text.includes('video') || text.includes('image') || text.includes('nano') || text.includes('veo')) {
        return btn;
      }
    }
    return null;
  }

  // Open the mode popup (Radix UI popup)
  async function openModePopup(waitMs) {
    waitMs = waitMs || 800;
    const btn = findModeButton();
    if (!btn) {
      logWarn('Mode button not found');
      return null;
    }
    log(`Opening mode popup via: "${btn.textContent.trim().substring(0, 30)}"`);
    simulateRadixClick(btn);
    await sleep(waitMs);

    // Flow 2026: Radix popup
    const radixPopup = document.querySelector(
      '[data-radix-popper-content-wrapper], [id^="radix-"][role="dialog"]'
    );
    if (radixPopup) {
      log('Mode popup opened (Radix)');
      return radixPopup;
    }
    // Legacy
    const legacy = document.querySelector('.mdc-menu-surface--open, [role="listbox"], [role="menu"]');
    if (legacy) { log('Mode popup opened (legacy)'); return legacy; }

    logWarn('Mode popup not found after click');
    return null;
  }

  // Click an option inside a popup by text matching
  function clickPopupOption(popup, keywords) {
    if (!popup) return false;
    const clickables = popup.querySelectorAll(
      'button, [role="tab"], [role="menuitem"], [role="option"], a, div[tabindex]'
    );
    for (const el of clickables) {
      const text = (el.textContent || '').trim().toLowerCase();
      if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
        simulateRadixClick(el);
        log(`Clicked popup option: "${text}"`);
        return true;
      }
    }
    return false;
  }

  // Close all Radix popups
  async function closeAllPopups() {
    for (let i = 0; i < 3; i++) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(300);
      const remaining = document.querySelectorAll(
        '[data-radix-popper-content-wrapper], [id^="radix-"][role="dialog"]'
      );
      const visible = Array.from(remaining).filter(p => {
        const r = p.getBoundingClientRect();
        return r.height > 0 && r.width > 0;
      });
      if (visible.length === 0) break;
      document.body.click();
      await sleep(300);
    }
    document.body.click();
    await sleep(200);
  }

  // ========================
  // DOM FINDERS — Google Flow 2026 specific
  // ========================
  const DOM = {
    // *** PROMPT INPUT ***
    // Flow 2026 uses Slate.js: <div role="textbox" contenteditable="true">
    // Legacy: textarea with id PINHOLE_TEXT_AREA_ELEMENT_ID
    getPromptInput() {
      // TỰ NHẬN DIỆN ô prompt của FLOW ("Bạn muốn tạo gì?") — KHÔNG cần teach. Quan
      // trọng: LOẠI ô chat Gemini ("Hãy hỏi tôi bất cứ điều gì") vì nó cũng là
      // textarea và hay bị bắt nhầm (bug đã thấy qua Quét UI).
      const attrs = (el) => `${(el.getAttribute && el.getAttribute('placeholder')) || ''} ${(el.getAttribute && el.getAttribute('aria-label')) || ''} ${(el.getAttribute && el.getAttribute('data-placeholder')) || ''}`.toLowerCase();
      const isGemini = (el) => el && /hỏi tôi|bất cứ điều|hỏi gemini|ask me|ask gemini|anything|trợ lý|assistant/.test(attrs(el));
      const isFlowPh = (el) => /tạo gì|muốn tạo|tạo video|mô tả cảnh|prompt|describe|generate a video|create a video|want to create/.test(attrs(el));

      // 0) Mapping đã teach — chỉ nhận nếu là ô gõ thật VÀ KHÔNG phải ô Gemini.
      const mapped = findMapped('promptInput');
      if (mapped && isEditableInput(mapped) && !isGemini(mapped)) { log('Using TAUGHT promptInput'); return mapped; }

      const cands = [...document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable="plaintext-only"], [data-slate-editor="true"], [role="textbox"]')]
        .filter((el) => isVisible(el) && !isGemini(el));

      // 1) Ô có placeholder/aria khớp FLOW (chắc nhất).
      for (const el of cands) if (isFlowPh(el)) { log('Flow prompt: khớp placeholder/aria'); return el; }

      // 2) Qua thẻ placeholder "Bạn muốn tạo gì?" → lấy ô gõ gần đó.
      const phEls = [...document.querySelectorAll('p, span, div')].filter((el) => {
        if (!isVisible(el)) return false;
        const t = (el.textContent || '').trim().toLowerCase();
        return t.length > 0 && t.length < 40 && /bạn muốn tạo gì|muốn tạo gì|what do you want to create/.test(t);
      });
      for (const ph of phEls) {
        let box = ph;
        for (let i = 0; i < 6 && box; i++) {
          const ed = box.querySelector('textarea, [contenteditable="true"], [contenteditable="plaintext-only"], [data-slate-editor="true"], [role="textbox"]');
          if (ed && isVisible(ed) && !isGemini(ed)) { log('Flow prompt: qua placeholder <p>'); return ed; }
          box = box.parentElement;
        }
        const self = ph.closest('[contenteditable="true"],[data-slate-editor="true"],[role="textbox"]');
        if (self && isVisible(self) && !isGemini(self)) return self;
      }

      // 3) Ô gõ ở NỬA DƯỚI màn hình (thanh prompt Flow nằm ở đáy), không phải Gemini.
      const bottom = cands.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top > window.innerHeight * 0.45 && r.width > 150;
      });
      if (bottom.length) { log('Flow prompt: ô gõ ở đáy trang'); return bottom[bottom.length - 1]; }

      // 4) Cùng đường: ô gõ đầu tiên KHÔNG phải Gemini.
      if (cands.length) { log('Flow prompt: ô gõ đầu tiên (không Gemini)'); return cands[0]; }
      logWarn('Không tìm thấy ô prompt Flow (chỉ thấy ô Gemini?)');
      return null;
    },

    // *** SUBMIT/CREATE BUTTON ***
    // Flow 2026: button containing icon "arrow_forward" (Google Material Icons)
    getSubmitButton() {
      const mapped = findMapped('submitButton');
      if (mapped) { log('Using TAUGHT submitButton'); return mapped; }

      // Strategy 1 (MOST RELIABLE): XPath for button with arrow_forward icon
      try {
        const xpath = "//button[.//i[contains(text(), 'arrow_forward')]]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (result.singleNodeValue && isVisible(result.singleNodeValue)) {
          log('Found Create button via XPath (arrow_forward icon)');
          return result.singleNodeValue;
        }
      } catch (e) {}

      // Strategy 2: querySelector for arrow_forward icon inside button
      const allButtons = document.querySelectorAll('button');
      for (const btn of allButtons) {
        if (!isVisible(btn)) continue;
        const icons = btn.querySelectorAll('i, span.google-symbols, span.material-icons, [class*="google-symbols"], [class*="material-icons"]');
        for (const icon of icons) {
          if (icon.textContent.trim() === 'arrow_forward') {
            log('Found Create button via icon text match');
            return btn;
          }
        }
      }

      // Strategy 3: aria-label
      const byAria = document.querySelector('button[aria-label*="Create" i]')
        || document.querySelector('button[aria-label*="Generate" i]')
        || document.querySelector('button[aria-label*="send" i]')
        || document.querySelector('button[aria-label*="submit" i]');
      if (byAria && isVisible(byAria)) {
        log('Found Create button via aria-label');
        return byAria;
      }

      // Strategy 4: Text content (Create / Generate / Tao)
      for (const btn of allButtons) {
        if (!isVisible(btn)) continue;
        const span = btn.querySelector('span');
        if (span) {
          const text = span.textContent.trim().toLowerCase();
          if (['create', 'generate', 'tạo', 'gửi', 'run'].includes(text) || text.includes('create') || text.includes('generate')) {
            log(`Found Create button via text: "${text}"`);
            return btn;
          }
        }
      }

      // Strategy 5: findButtonByText fallback
      const byText = this.findButtonByText('Create')
        || this.findButtonByText('Generate')
        || this.findButtonByText('Run')
        || this.findButtonByText('Tạo')
        || this.findButtonByText('Gửi');
      if (byText) return byText;

      // Strategy 6: Proximity to prompt input
      const input = this.getPromptInput();
      if (input) {
        const inputRect = input.getBoundingClientRect();
        let best = null, bestDist = Infinity;
        for (const btn of allButtons) {
          if (!isVisible(btn)) continue;
          const r = btn.getBoundingClientRect();
          if (Math.abs(r.top - inputRect.top) > 80) continue;
          if (r.left < inputRect.left) continue;
          const dist = Math.hypot(r.left - inputRect.right, r.top - inputRect.top);
          if (dist < bestDist) { bestDist = dist; best = btn; }
        }
        if (best && bestDist < 200) {
          log(`Found Create button by proximity (${Math.round(bestDist)}px)`);
          return best;
        }
      }

      return null;
    },

    findButtonByText(searchText) {
      const lower = searchText.toLowerCase();
      const buttons = document.querySelectorAll('button, [role="button"]');
      for (const btn of buttons) {
        if (!isVisible(btn)) continue;
        const text = btn.textContent.trim().toLowerCase();
        if (text === lower || (text.length < 20 && text.includes(lower))) return btn;
      }
      const labeled = document.querySelector(`[aria-label*="${searchText}" i], [title*="${searchText}" i]`);
      if (labeled && isVisible(labeled)) return labeled;
      return null;
    },

    // *** CLEAR PROMPT BAR ***
    // Flow 2026 keeps old prompt as a chip after Create — must clear it first
    async clearPromptBar() {
      const allBtns = document.querySelectorAll('button');

      // Strategy 1: "Clear prompt" text
      for (const btn of allBtns) {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text.includes('clear prompt') || text === 'clear') {
          if (isVisible(btn)) {
            log('Clearing prompt bar via "Clear prompt" button');
            btn.click();
            await sleep(800);
            return true;
          }
        }
      }

      // Strategy 2: Close icon in bottom area (prompt bar)
      for (const btn of allBtns) {
        const rect = btn.getBoundingClientRect();
        if (rect.bottom < window.innerHeight - 350) continue;
        if (!isVisible(btn)) continue;
        const icon = btn.querySelector('i, span.google-symbols, span.material-icons');
        if (icon && icon.textContent.trim().toLowerCase() === 'close') {
          log('Clearing prompt bar via close icon');
          btn.click();
          await sleep(800);
          return true;
        }
      }

      // Strategy 3: aria-label
      for (const btn of allBtns) {
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (ariaLabel.includes('clear prompt') || ariaLabel.includes('close prompt')) {
          if (isVisible(btn)) {
            log('Clearing prompt bar via aria-label');
            btn.click();
            await sleep(800);
            return true;
          }
        }
      }

      log('No clear prompt button found (prompt bar already clean)');
      return false;
    },

    // *** SETTINGS / MODE / MODEL ***
    getSettingsToggle() {
      const mapped = findMapped('settingsToggle');
      if (mapped) return mapped;
      const all = document.querySelectorAll('button, [role="button"], [tabindex]');
      for (const el of all) {
        if (!isVisible(el)) continue;
        const text = el.textContent.trim();
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight * 0.3) continue;
        const hasMode = /video|image|hình/i.test(text);
        const hasQty = /x\d|\d+x/i.test(text);
        const hasRatio = /\d+:\d+/.test(text);
        const hasDuration = /\d+s/i.test(text);
        if ((hasMode && hasQty) || (hasMode && hasRatio) || (hasMode && hasDuration)) return el;
      }
      return null;
    },

    getModeTab(targetMode) {
      const key = targetMode === 'video' ? 'modeVideo' : 'modeImage';
      const mapped = findMapped(key);
      if (mapped) return mapped;

      const keywords = targetMode === 'video'
        ? ['Video', 'Text to Video', 'video']
        : ['Image', 'Create Image', 'image', 'hình ảnh'];
      const tabs = document.querySelectorAll('button, [role="tab"], [role="radio"], label, [role="button"]');
      for (const el of tabs) {
        if (!isVisible(el)) continue;
        const text = el.textContent.trim();
        for (const kw of keywords) {
          if (text === kw || text.toLowerCase().includes(kw.toLowerCase())) return el;
        }
      }
      return null;
    },

    getModelDropdown() {
      const mapped = findMapped('modelDropdown');
      if (mapped) return mapped;
      const names = ['Veo', 'Omni', 'Nano Banana', 'Imagen'];
      const els = document.querySelectorAll('button, [role="combobox"], [role="listbox"], [role="button"], [aria-haspopup]');
      for (const el of els) {
        if (!isVisible(el)) continue;
        const text = el.textContent.trim();
        if (el.getBoundingClientRect().width > 400) continue;
        for (const n of names) { if (text.includes(n)) return el; }
      }
      return null;
    },

    getModelOption(modelKey) {
      const map = {
        'omni-flash': 'Omni Flash', 'veo31-lite': 'Veo 3.1 - Lite',
        'veo31-fast': 'Veo 3.1', 'veo31-quality': 'Quality',
        'nano-banana-pro': 'Pro', 'nano-banana-2': 'Nano Banana 2',
        'imagen-4': 'Imagen 4'
      };
      const name = map[modelKey];
      if (!name) return null;
      const candidates = document.querySelectorAll(
        '[role="option"], [role="menuitem"], [role="menuitemradio"], li, button, [role="button"], label, [role="radio"]'
      );
      let best = null, bestLen = Infinity;
      for (const el of candidates) {
        if (!isVisible(el)) continue;
        const text = el.textContent.trim();
        if (text.includes(name) && text.length < name.length + 20 && text.length < bestLen) {
          bestLen = text.length;
          best = el;
        }
      }
      return best;
    },

    getAspectButton(ratio) {
      return this.findButtonByText(ratio);
    },

    getQuantityButton(qty) {
      return this.findButtonByText(`${qty}`);
    },

    isGenerating() {
      if (document.querySelector('[role="progressbar"]')) return true;
      const loadSels = ['[class*="spinner"]', '[class*="loading"]', '[class*="progress"]',
        '[class*="generating"]', '[aria-busy="true"]', '[aria-label*="loading" i]',
        '[aria-label*="generating" i]'];
      for (const sel of loadSels) {
        try { const el = document.querySelector(sel); if (el && isVisible(el)) return true; } catch (e) {}
      }
      const sub = this.getSubmitButton();
      if (sub && (sub.disabled || sub.getAttribute('aria-disabled') === 'true')) return true;
      return false;
    },

    countResults() {
      let videos = 0, canvases = 0;
      document.querySelectorAll('video').forEach(v => { if (isVisible(v)) videos++; });
      document.querySelectorAll('canvas').forEach(c => { if (isVisible(c) && c.width > 50) canvases++; });
      return { videos, canvases, total: videos + canvases };
    },

    getDownloadButtons() {
      const results = [];
      document.querySelectorAll('button, a, [role="button"]').forEach(el => {
        if (!isVisible(el)) return;
        const t = (el.textContent || '').toLowerCase();
        const a = (el.getAttribute('aria-label') || '').toLowerCase();
        if (a.includes('download') || a.includes('tải') || t.includes('download') || t.includes('tải')) {
          results.push(el);
        }
      });
      document.querySelectorAll('a[download]').forEach(a => { if (isVisible(a)) results.push(a); });
      return results;
    },

    // *** STORYBOARD: Create New button (+) ***
    getCreateNewButton() {
      const mapped = findMapped('createNew');
      if (mapped) return mapped;

      // Strategy 1: button with "+" or "add" icon in top-right area
      const allBtns = document.querySelectorAll('button, [role="button"]');
      for (const btn of allBtns) {
        if (!isVisible(btn)) continue;
        const rect = btn.getBoundingClientRect();
        // Top-right area of page
        if (rect.top > 100) continue;
        const text = (btn.textContent || '').trim();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const icon = btn.querySelector('i, span.google-symbols, span.material-icons');
        const iconText = icon ? icon.textContent.trim() : '';

        if (text === '+' || text === 'add' ||
            iconText === 'add' || iconText === 'add_circle' ||
            aria.includes('create') || aria.includes('new') || aria.includes('tạo mới')) {
          log(`Found Create New button: "${text || iconText}" at top-right`);
          return btn;
        }
      }

      // Strategy 2: a[href] containing /create or /new
      const links = document.querySelectorAll('a[href*="create"], a[href*="new"]');
      for (const link of links) {
        if (isVisible(link)) return link;
      }

      return null;
    },

    // *** STORYBOARD: Gallery card menu (3-dot) ***
    getGalleryCardMenu(cardEl) {
      const mapped = findMapped('galleryMenu');
      if (mapped) return mapped;

      // If we have a card element, look for 3-dot menu button inside it
      const container = cardEl || document;
      const btns = container.querySelectorAll('button, [role="button"]');
      for (const btn of btns) {
        if (!isVisible(btn)) continue;
        const text = (btn.textContent || '').trim();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const icon = btn.querySelector('i, span.google-symbols, span.material-icons');
        const iconText = icon ? icon.textContent.trim() : '';

        if (text === '⋮' || text === '...' || text === 'more_vert' ||
            iconText === 'more_vert' || iconText === 'more_horiz' ||
            aria.includes('more') || aria.includes('menu') || aria.includes('option')) {
          return btn;
        }
      }
      return null;
    },

    // *** STORYBOARD: "Add to prompt" menu item ***
    getAddToPromptMenuItem() {
      const mapped = findMapped('addToPrompt');
      if (mapped) return mapped;

      // Look in open menus/popups
      const menuItems = document.querySelectorAll('[role="menuitem"], [role="option"], button, [role="button"]');
      for (const item of menuItems) {
        if (!isVisible(item)) continue;
        const text = (item.textContent || '').trim().toLowerCase();
        if (text.includes('thêm vào câu lệnh') || text.includes('add to prompt') ||
            text.includes('use as reference') || text.includes('add to input')) {
          log(`Found "Add to prompt" menu item: "${text}"`);
          return item;
        }
      }
      return null;
    },

    // *** STORYBOARD: File upload input ***
    getFileUploadInput() {
      const mapped = findMapped('fileUpload');
      if (mapped) return mapped;

      // Look for file input elements
      const inputs = document.querySelectorAll('input[type="file"]');
      for (const input of inputs) {
        if (input.accept && (input.accept.includes('image') || input.accept.includes('*'))) {
          return input;
        }
      }

      // Look for upload button that triggers file dialog
      const allBtns = document.querySelectorAll('button, [role="button"], label');
      for (const btn of allBtns) {
        if (!isVisible(btn)) continue;
        const text = (btn.textContent || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        const icon = btn.querySelector('i, span.google-symbols, span.material-icons');
        const iconText = icon ? icon.textContent.trim().toLowerCase() : '';

        if (text.includes('upload') || text.includes('tải lên') ||
            aria.includes('upload') || aria.includes('tải lên') ||
            iconText === 'upload' || iconText === 'cloud_upload' || iconText === 'file_upload') {
          return btn;
        }
      }

      return null;
    },

    // *** STORYBOARD: Find gallery cards (images/videos) ***
    getGalleryCards() {
      // Flow gallery cards are typically in a grid
      const cards = document.querySelectorAll('[class*="card"], [class*="tile"], [class*="item"], [role="listitem"], [role="gridcell"]');
      const results = [];
      for (const card of cards) {
        if (!isVisible(card)) continue;
        const hasImage = card.querySelector('img, video, canvas');
        if (hasImage && card.getBoundingClientRect().width > 80) {
          results.push(card);
        }
      }
      return results;
    }
  };

  // ========================
  // INJECT PROMPT — Slate.js compatible (PROVEN METHOD)
  // ========================
  // Kiểm tra ĐÃ GÕ ĐƯỢC chưa — KHOAN DUNG: bỏ @mention ở đầu khi so khớp (Flow có
  // thể đổi "@Hoà" thành chip làm lệch khớp), hoặc chấp nhận nếu ô gõ đã có đủ chữ.
  function _injectOK(current, text) {
    if (!current) return false;
    const core = (text.replace(/^(?:\s*@\S+)+\s*/, '').trim()) || text;
    const probe = core.substring(0, Math.min(15, core.length));
    if (probe && current.includes(probe)) return true;
    return current.replace(/\s+/g, '').length >= Math.min(12, Math.round(text.replace(/\s+/g, '').length * 0.5));
  }

  async function injectPromptText(text) {
    // Wait for input
    let el = null;
    for (let i = 0; i < 20; i++) {
      el = DOM.getPromptInput();
      if (el) break;
      log(`Waiting for prompt input... (${i + 1}/20)`);
      await wait(1);
    }
    if (!el) {
      logError('Prompt input NOT FOUND after 20s');
      return false;
    }

    const tagName = el.tagName;
    const isEditable = el.getAttribute('contenteditable') === 'true' || el.isContentEditable;
    log(`Found input: <${tagName}> contentEditable=${isEditable} role=${el.getAttribute('role')}`);

    // Focus
    el.focus();
    el.click();
    await sleep(200);

    let injected = false;

    if (isEditable) {
      // ============================================
      // SLATE.JS / ContentEditable (Flow 2026)
      // Uses Level 2 Input Events (beforeinput)
      // ============================================
      log('Using Slate.js injection method');
      injected = await _injectSlate(el, text);

      if (!injected) {
        log('Slate method failed, trying execCommand fallback');
        injected = await _injectExecCommand(el, text);
      }

      if (!injected) {
        log('execCommand failed, trying char-by-char');
        injected = await _injectCharByChar(el, text);
      }

    } else if (tagName === 'TEXTAREA' || tagName === 'INPUT') {
      // ============================================
      // LEGACY TEXTAREA
      // ============================================
      log('Using textarea injection method');
      injected = await _injectTextarea(el, text);

    } else {
      logWarn(`Unknown input type: <${tagName}>`);
      el.textContent = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      injected = true;
    }

    if (injected) log('Prompt injected successfully');
    else logError('ALL injection methods FAILED');
    return injected;
  }

  // --- Slate.js: beforeinput events (PROVEN by FlowForge) ---
  async function _injectSlate(el, text) {
    try {
      // Step 1: Select all existing content
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
      await sleep(50);

      // Step 2: Delete selected content via beforeinput
      const hasContent = el.textContent.trim().length > 0;
      if (hasContent) {
        el.dispatchEvent(new InputEvent('beforeinput', {
          inputType: 'deleteContentBackward',
          bubbles: true, cancelable: true, composed: true
        }));
        await sleep(100);
        el.dispatchEvent(new InputEvent('input', {
          inputType: 'deleteContentBackward',
          bubbles: true, cancelable: false, composed: true
        }));
        await sleep(50);
      }

      // Step 3: Insert new text via beforeinput insertText
      el.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: text,
        bubbles: true, cancelable: true, composed: true
      }));
      await sleep(100);

      // Also fire input event (Slate listens to both)
      el.dispatchEvent(new InputEvent('input', {
        inputType: 'insertText',
        data: text,
        bubbles: true, cancelable: false, composed: true
      }));
      await sleep(300);

      // Verify
      const current = el.textContent.trim();
      const ok = _injectOK(current, text);
      log(`Slate beforeinput: verified=${ok}, content="${current.substring(0, 40)}"`);
      return ok;

    } catch (e) {
      logError(`Slate beforeinput error: ${e.message}`);
      return false;
    }
  }

  // --- execCommand fallback ---
  async function _injectExecCommand(el, text) {
    try {
      el.focus();
      document.execCommand('selectAll', false, null);
      await sleep(50);
      document.execCommand('delete', false, null);
      await sleep(50);
      document.execCommand('insertText', false, text);
      await sleep(100);

      el.dispatchEvent(new InputEvent('input', {
        bubbles: true, cancelable: false,
        inputType: 'insertText', data: text
      }));
      await sleep(200);

      const current = el.textContent.trim();
      const ok = _injectOK(current, text);
      log(`execCommand: verified=${ok}`);
      return ok;
    } catch (e) {
      logError(`execCommand error: ${e.message}`);
      return false;
    }
  }

  // --- Char-by-char (slowest but most reliable) ---
  async function _injectCharByChar(el, text) {
    try {
      el.focus();
      document.execCommand('selectAll', false, null);
      await sleep(50);
      el.dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'deleteContentBackward',
        bubbles: true, cancelable: true, composed: true
      }));
      await sleep(100);

      for (let i = 0; i < text.length; i++) {
        el.dispatchEvent(new InputEvent('beforeinput', {
          inputType: 'insertText', data: text[i],
          bubbles: true, cancelable: true, composed: true
        }));
        el.dispatchEvent(new InputEvent('input', {
          inputType: 'insertText', data: text[i],
          bubbles: true, cancelable: false, composed: true
        }));
        if (i % 50 === 0) await sleep(10);
      }

      await sleep(200);
      const current = el.textContent.trim();
      const ok = _injectOK(current, text);
      log(`Char-by-char: verified=${ok} (${text.length} chars)`);
      return ok;
    } catch (e) {
      logError(`Char-by-char error: ${e.message}`);
      return false;
    }
  }

  // --- Legacy textarea ---
  async function _injectTextarea(el, text) {
    // React native setter
    let nativeSetter = null;
    let proto = el;
    while ((proto = Object.getPrototypeOf(proto))) {
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) { nativeSetter = desc.set; break; }
    }

    if (nativeSetter) {
      nativeSetter.call(el, '');
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent' }));
      await sleep(100);
      nativeSetter.call(el, text);
    } else {
      el.value = text;
    }

    // Reset React tracker
    const tracker = el._valueTracker;
    if (tracker) tracker.setValue('__force__');

    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    await sleep(500);

    const ok = (el.value || '').includes(text.substring(0, 15));
    log(`Textarea: verified=${ok}`);
    return ok;
  }

  // ========================
  // CLICK SUBMIT
  // ========================
  async function clickSubmit() {
    let btn = null;
    for (let i = 0; i < 20; i++) {
      btn = DOM.getSubmitButton();
      if (btn) break;
      log(`Waiting for submit button... (${i + 1}/20)`);
      await wait(1);
    }
    if (!btn) {
      logError('Submit button NOT FOUND');
      // Enter key fallback
      const input = DOM.getPromptInput();
      if (input) {
        log('Trying Enter key as last resort');
        input.focus();
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        await sleep(100);
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        await wait(1);
        return true;
      }
      return false;
    }

    log(`Found submit: <${btn.tagName}> disabled=${btn.disabled}`);

    // Wait for enabled
    let tries = 0;
    while (btn.disabled && tries < 20) {
      await sleep(500);
      tries++;
      btn = DOM.getSubmitButton() || btn;
    }

    if (btn.disabled) {
      logWarn('Submit still disabled after 10s');
    }

    // Click
    log('Clicking submit...');
    btn.click();
    await sleep(500);

    log('Submit clicked');
    await wait(1);
    return true;
  }

  // ========================
  // TEACH MODE
  // ========================
  function isAutoFlowEl(el) {
    let n = el;
    while (n) {
      if (n.id && n.id.startsWith('autoflow')) return true;
      n = n.parentElement;
    }
    return false;
  }

  function findBestElement(clickedEl) {
    if (!clickedEl || clickedEl === document.body || clickedEl === document.documentElement) return null;
    // Snap to the NEAREST real clickable ancestor (precise — avoids grabbing a
    // wrapper that contains several controls, which caused e.g. "add_2Tạo").
    const SEL = 'button, a, input, textarea, select, label, [role="button"], [role="tab"], [role="radio"], [role="option"], [role="menuitem"], [role="combobox"], [role="textbox"], [role="switch"], [role="checkbox"], [role="link"], [contenteditable="true"]';
    const hit = clickedEl.closest(SEL);
    if (!hit || isAutoFlowEl(hit)) return clickedEl;
    // Nếu `hit` là WRAPPER chứa nhiều control con (vd cụm gộp dấu "+" và nút "Tạo"
    // → "add_2Tạo"), thu hẹp về control con NHỎ NHẤT vẫn chứa điểm bấm.
    const inner = Array.from(hit.querySelectorAll(SEL))
      .filter((c) => !isAutoFlowEl(c) && (c === clickedEl || c.contains(clickedEl)));
    if (inner.length) {
      // chọn control sâu nhất (ít text nhất ⇒ gần icon "+", không dính chữ "Tạo")
      inner.sort((a, b) => (a.textContent || '').trim().length - (b.textContent || '').trim().length);
      return inner[0];
    }
    return hit;
  }

  function buildSelector(el) {
    if (!el || el === document.body) return null;

    // Stable ID
    if (el.id && !el.id.startsWith('autoflow') && !el.id.startsWith(':') && !el.id.match(/^r\d/)) {
      const sel = `#${CSS.escape(el.id)}`;
      try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (e) {}
    }
    // aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) {
      const sel = `[aria-label="${CSS.escape(ariaLabel)}"]`;
      try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (e) {}
    }
    // role+contenteditable
    const role = el.getAttribute('role');
    if (role && el.contentEditable === 'true') {
      const sel = `[role="${role}"][contenteditable="true"]`;
      try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (e) {}
    }
    // placeholder
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) {
      const sel = `[placeholder="${CSS.escape(placeholder)}"]`;
      try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (e) {}
    }
    // data-* attributes
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-') && attr.value && !attr.name.includes('react')) {
        const sel = `[${attr.name}="${CSS.escape(attr.value)}"]`;
        try { if (document.querySelectorAll(sel).length === 1) return sel; } catch (e) {}
      }
    }
    // nth-of-type path (last resort)
    const path = [];
    let cur = el;
    while (cur && cur !== document.body && path.length < 4) {
      let sel = cur.tagName.toLowerCase();
      if (cur.id && !cur.id.startsWith('autoflow') && !cur.id.startsWith(':')) { path.unshift(`#${CSS.escape(cur.id)}`); break; }
      const parent = cur.parentElement;
      if (parent) {
        const sibs = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
        if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      }
      path.unshift(sel);
      cur = cur.parentElement;
    }
    return path.join(' > ') || null;
  }

  function findMapped(key) {
    const m = elementMap[key];
    if (!m) return null;

    // CSS selector
    if (m.selector) {
      try {
        const el = document.querySelector(m.selector);
        if (el && isVisible(el)) return el;
      } catch (e) {}
    }
    // aria-label
    if (m.ariaLabel) {
      try {
        const el = document.querySelector(`[aria-label="${CSS.escape(m.ariaLabel)}"]`);
        if (el && isVisible(el)) return el;
      } catch (e) {}
    }
    // role+contenteditable
    if (m.role && m.role === 'textbox') {
      const el = document.querySelector(`[role="textbox"][contenteditable="true"]`);
      if (el && isVisible(el)) return el;
    }
    // text+tag EXACT match (no substring — substring caused wrong matches)
    if (m.text && m.tag) {
      const candidates = document.querySelectorAll(m.tag + ', button, [role="button"], [role="tab"], [role="menuitem"], [role="option"]');
      for (const el of candidates) {
        if (!isVisible(el)) continue;
        if (el.textContent.trim() === m.text) return el;
      }
    }
    // Coordinates fallback
    if (m.rect && m.rect.width > 0) {
      const cx = m.rect.left + m.rect.width / 2;
      const cy = m.rect.top + m.rect.height / 2;
      if (cx > 0 && cy > 0 && cx < window.innerWidth && cy < window.innerHeight) {
        const el = document.elementFromPoint(cx, cy);
        if (el && isVisible(el) && !isAutoFlowEl(el) && el.tagName !== 'HTML' && el.tagName !== 'BODY') return el;
      }
    }
    return null;
  }

  function startTeaching(target) {
    teachTarget = target;
    state = 'teaching';
    log(`TEACH: click "${target}" on the page`);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'autoflow-overlay';
      overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483645;border:3px solid #3b82f6;border-radius:4px;background:rgba(59,130,246,0.15);transition:all 0.05s;display:none;';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'autoflow-banner';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483646;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:white;padding:12px 20px;font:600 14px -apple-system,sans-serif;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:none;';
      document.body.appendChild(banner);
    }
    const labels = {
      settingsToggle: '⚙️ Click vào nút mở Settings',
      modeVideo: '🎬 Click vào tab VIDEO / Text to Video',
      modeImage: '🖼️ Click vào tab IMAGE / Create Image',
      modelDropdown: '📋 Click vào dropdown chọn MODEL',
      promptInput: '✏️ Click vào ô nhập PROMPT (vùng gõ text)',
      submitButton: '▶ Click vào nút TẠO / CREATE (mũi tên →)',
      createNew: '➕ Click vào nút TẠO MỚI (+) ở góc phải trên',
      galleryMenu: '⋮ Click vào nút 3 CHẤM (⋮) trên 1 card hình',
      addToPrompt: '📎 Click vào "THÊM VÀO CÂU LỆNH" (nút xác nhận trong panel)',
      fileUpload: '📤 Click vào nút UPLOAD FILE / TẢI LÊN',
      promptPlus: '➕ Click nút "+" trong ô prompt (mở panel thêm thành phần)',
      charNew: '👤 Click nút "Nhân vật mới" (+)',
      charUpload: '📤 Click nút "Tải lên" (trang nhân vật mới)',
      charName: '✏️ Click vào Ô TÊN nhân vật (sau khi tải ảnh)',
      charVoice: '🎙️ Click Dropdown Voice nhân vật',
      charDone: '✅ Click nút "Xong" (góc phải)',
    };
    banner.textContent = labels[target] || `Click: ${target}`;
    banner.style.display = 'block';
    document.addEventListener('mousemove', _teachMove, true);
    document.addEventListener('click', _teachClick, true);
  }

  function stopTeaching() {
    state = 'idle';
    teachTarget = null;
    if (overlay) overlay.style.display = 'none';
    if (banner) banner.style.display = 'none';
    document.removeEventListener('mousemove', _teachMove, true);
    document.removeEventListener('click', _teachClick, true);
  }

  function _teachMove(e) {
    if (state !== 'teaching' || !overlay) return;
    const rawEl = document.elementFromPoint(e.clientX, e.clientY);
    if (!rawEl || isAutoFlowEl(rawEl)) return;
    const el = findBestElement(rawEl);
    if (!el) return;
    const r = el.getBoundingClientRect();
    Object.assign(overlay.style, { left: r.left+'px', top: r.top+'px', width: r.width+'px', height: r.height+'px', display: 'block' });
  }

  function _teachClick(e) {
    if (state !== 'teaching' || !teachTarget) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const rawEl = document.elementFromPoint(e.clientX, e.clientY);
    if (!rawEl || isAutoFlowEl(rawEl)) return;
    const el = findBestElement(rawEl);
    if (!el || el === document.body) return;

    const rect = el.getBoundingClientRect();
    const mapping = {
      selector: buildSelector(el),
      text: el.textContent.trim().substring(0, 100),
      tag: el.tagName.toLowerCase(),
      ariaLabel: el.getAttribute('aria-label') || '',
      placeholder: el.getAttribute('placeholder') || '',
      role: el.getAttribute('role') || '',
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      timestamp: Date.now()
    };
    const saved = teachTarget;
    elementMap[saved] = mapping;
    chrome.storage.local.set({ elementMap });
    log(`MAPPED "${saved}" => <${mapping.tag}> role="${mapping.role}" selector="${mapping.selector}"`);
    stopTeaching();
    notify('TEACH_DONE', { target: saved, mapping });
  }

  // ========================
  // APPLY SETTINGS — Radix UI compatible (PROVEN by FlowForge)
  // ========================
  async function applySettings() {
    log('Applying settings...');
    notify('APPLYING_SETTINGS');

    const applied = [];

    // STEP 1: Switch mode (Video / Image) by clicking mode tab on the page
    // This is done OUTSIDE the popup — mode tabs are directly on the page
    if (cfg.mode) {
      log(`Switching mode to: ${cfg.mode}`);
      const modeTab = DOM.getModeTab(cfg.mode);
      if (modeTab) {
        simulateRadixClick(modeTab);
        applied.push(`mode:${cfg.mode}`);
        await sleep(1500); // Wait for mode switch animation
      } else {
        logWarn(`Mode tab "${cfg.mode}" not found on page`);
      }
    }

    // STEP 2: Open mode popup for orientation/variations/model
    const needsPopup = cfg.aspect || cfg.quantity || cfg.model;
    if (needsPopup) {
      let popup = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        popup = await openModePopup(800);
        if (popup) break;
        log(`Popup not found, retry ${attempt + 1}/3...`);
        await sleep(1000);
      }

      if (popup) {
        // STEP 2a: Orientation (aspect ratio)
        if (cfg.aspect) {
          const orientation = cfg.aspect === '9:16' ? 'PORTRAIT' : 'LANDSCAPE';
          log(`Setting orientation: ${orientation}`);

          // Try Radix trigger ID first
          const orientTab = document.querySelector(`button[id*="trigger-${orientation}"]`);
          if (orientTab) {
            simulateRadixClick(orientTab);
            applied.push(`orientation:${orientation}`);
            await sleep(300);
          } else {
            // Fallback: click by text
            const clicked = clickPopupOption(popup, [orientation.toLowerCase(), cfg.aspect]);
            if (clicked) applied.push(`orientation:${orientation}(text)`);
            await sleep(300);
          }
        }

        // STEP 2b: Variations (quantity)
        if (cfg.quantity) {
          log(`Setting variations: x${cfg.quantity}`);

          const varTab = document.querySelector(`button[id*="trigger-${cfg.quantity}"]`);
          if (varTab) {
            simulateRadixClick(varTab);
            applied.push(`variations:x${cfg.quantity}`);
            await sleep(300);
          } else {
            const clicked = clickPopupOption(popup, [`x${cfg.quantity}`, `${cfg.quantity}`]);
            if (clicked) applied.push(`variations:x${cfg.quantity}(text)`);
            await sleep(300);
          }
        }

        // STEP 2c: Model selection
        if (cfg.model) {
          log(`Setting model: ${cfg.model}`);
          const modelMap = {
            'omni-flash': 'Omni Flash',
            'veo31-lite': 'Veo 3.1 - Lite',
            'veo31-fast': 'Veo 3.1',
            'veo31-quality': 'Quality',
            'nano-banana-pro': 'Pro',
            'nano-banana-2': 'Nano Banana 2',
            'imagen-4': 'Imagen 4'
          };
          const modelText = modelMap[cfg.model] || cfg.model;

          // Find model dropdown button inside the popup
          // It's NOT a tab — it's a button showing current model name
          const popupBtns = popup.querySelectorAll('button');
          let modelBtn = null;
          for (const btn of popupBtns) {
            const text = (btn.textContent || '').trim();
            if (btn.getAttribute('role') !== 'tab' &&
                !(btn.id && btn.id.includes('trigger-')) &&
                text.length > 3 && text.length < 50) {
              modelBtn = btn;
            }
          }

          if (modelBtn) {
            log(`Clicking model dropdown: "${modelBtn.textContent.trim().substring(0, 25)}"`);
            simulateRadixClick(modelBtn);
            await sleep(500);

            // Model dropdown creates a SECOND Radix popper
            const allPoppers = document.querySelectorAll('[data-radix-popper-content-wrapper]');
            const modelMenu = allPoppers.length > 1 ? allPoppers[allPoppers.length - 1] : allPoppers[0];
            let modelClicked = false;

            if (modelMenu) {
              const menuItems = modelMenu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]');
              log(`Found ${menuItems.length} model options`);

              for (const item of menuItems) {
                const itemText = (item.textContent || '').trim();
                if (itemText.toLowerCase().includes(modelText.toLowerCase())) {
                  item.click();
                  modelClicked = true;
                  applied.push(`model:${modelText}`);
                  log(`Selected model: "${itemText}"`);
                  break;
                }
              }
            }

            if (!modelClicked) {
              // Fallback: try all visible menus
              const lists = document.querySelectorAll('[role="listbox"], [role="menu"]');
              for (const list of lists) {
                const items = list.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="option"]');
                for (const item of items) {
                  const t = (item.textContent || '').trim();
                  if (t.toLowerCase().includes(modelText.toLowerCase())) {
                    item.click();
                    modelClicked = true;
                    applied.push(`model:${modelText}(fallback)`);
                    log(`Selected model (fallback): "${t}"`);
                    break;
                  }
                }
                if (modelClicked) break;
              }
            }

            if (!modelClicked) {
              logWarn(`Model "${modelText}" not found in dropdown`);
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            }
            await sleep(300);
          } else {
            logWarn('Model dropdown button not found in popup');
          }
        }

        // Close all popups
        await closeAllPopups();
      } else {
        logWarn('Could not open settings popup');
      }
    }

    await sleep(500);
    log(`Settings applied: [${applied.join(', ')}]`);
  }

  // ========================
  // WAIT FOR COMPLETION
  // ========================
  async function waitForCompletion() {
    const timeoutMs = (cfg.timeout || 10) * 60 * 1000;
    const start = Date.now();
    const initialResults = DOM.countResults();

    // Wait for generation to start
    for (let i = 0; i < 15; i++) {
      if (state === 'idle') return 'stopped';
      if (DOM.isGenerating()) break;
      const cr = DOM.countResults();
      if (cr.total > initialResults.total) return 'done';
      await wait(1);
    }

    // Wait for completion
    let stableCount = 0;
    while (Date.now() - start < timeoutMs) {
      if (state === 'idle') return 'stopped';
      while (state === 'paused') { await wait(1); if (state === 'idle') return 'stopped'; }

      const cr = DOM.countResults();
      if (cr.total > initialResults.total) {
        await wait(3);
        return 'done';
      }

      if (!DOM.isGenerating()) {
        stableCount++;
        if (stableCount >= 5) {
          const dlBtns = DOM.getDownloadButtons();
          if (dlBtns.length > 0) return 'done';
          return 'done';
        }
      } else { stableCount = 0; }

      await wait(2);
    }
    return 'timeout';
  }

  // ========================
  // AUTO DOWNLOAD
  // ========================
  // Trích MEDIA_ID (UUID của video) từ src của thẻ <video>. Flow trỏ src tới
  //   .../media.getMediaUrlRedirect?name=<id>  hoặc  flow-content.google/video/<id>
  // → cùng 1 id dùng để tải qua API. Bỏ hậu tố "_upsampled" để lấy id gốc.
  function mediaIdFromVideoEl(v) {
    if (!v) return '';
    const src = v.currentSrc || v.src || (v.querySelector && v.querySelector('source') && v.querySelector('source').src) || '';
    let m = /[?&]name=([^&]+)/.exec(src);
    if (m) return decodeURIComponent(m[1]).replace(/_upsampled$/, '');
    m = /flow-content\.google\/video\/([^?/]+)/.exec(src);
    if (m) return decodeURIComponent(m[1]).replace(/_upsampled$/, '');
    return '';
  }

  // Lấy media id của video đang/last hiển thị trên trang (để tải bản đang xem).
  function currentVideoMediaId() {
    const vids = Array.from(document.querySelectorAll('video'));
    for (let i = vids.length - 1; i >= 0; i--) {
      const id = mediaIdFromVideoEl(vids[i]);
      if (id) return id;
    }
    return '';
  }

  // Gom media id của MỌI video trên trang (cho tải hàng loạt), giữ thứ tự, khử trùng.
  function allVideoMediaIds() {
    const seen = new Set();
    const out = [];
    document.querySelectorAll('video').forEach((v) => {
      const id = mediaIdFromVideoEl(v);
      if (id && !seen.has(id)) { seen.add(id); out.push(id); }
    });
    return out;
  }

  // Bóc thông tin VIDEO (id + workflowId + aspect) từ response poll/generate, lưu vào
  //   afGeneratedVideos (giàu, cho pipeline 1080p) và afGeneratedMediaIds (id thuần).
  //   Chỉ lấy media có field ".video" để loại ảnh upload/entity. Khử trùng, tối đa 200.
  // Lưu danh sách video đã bóc được vào storage (khử trùng, tối đa 200).
  //   Dùng chung cho: nghe lỏm response (harvestGeneratedMediaIds) VÀ bóc trực tiếp
  //   từ response tạo do inject gửi qua message 'harvestVideos'.
  // Mọi response tạo/poll có thể về sát nhau. Nếu mỗi callback cùng đọc storage rồi
  // tự ghi, lượt ghi sau sẽ đè danh sách của lượt trước và chuỗi cứ chờ thiếu clip.
  // Xếp tất cả thao tác vào một hàng đợi để dữ liệu của cả batch luôn được cộng dồn.
  let harvestedVideoWriteQueue = Promise.resolve();

  function storeHarvestedVideos(vids) {
    const list = (Array.isArray(vids) ? vids : []).filter((v) => v && v.id);
    if (!list.length) return harvestedVideoWriteQueue;
    // GẮN NHÃN DỰ ÁN: chụp projectId của tab NGAY LÚC thu (đồng bộ), trước khi hàng
    //   đợi ghi chạy — để mỗi video biết mình thuộc dự án Flow nào. Nhờ đó bước tải
    //   chỉ lấy video của ĐÚNG dự án hiện tại, không gộp/tải lại video dự án trước.
    const harvestPid = getProjectIdFromUrl() || '';
    harvestedVideoWriteQueue = harvestedVideoWriteQueue.then(async () => {
      const data = await new Promise((resolve) => chrome.storage.local.get(['afGeneratedVideos', 'afGeneratedMediaIds'], resolve));
      const rich = Array.isArray(data.afGeneratedVideos) ? data.afGeneratedVideos : [];
      const ids = Array.isArray(data.afGeneratedMediaIds) ? data.afGeneratedMediaIds : [];
      for (const v of list) {
        const item = { id: String(v.id), workflowId: v.workflowId || '', aspectRatio: v.aspectRatio || '', pid: harvestPid };
        let ri = rich.findIndex((x) => x && x.id === item.id);
        if (ri !== -1) {
          // Giữ workflowId/aspect/pid cũ nếu bản mới thiếu.
          item.workflowId = item.workflowId || rich[ri].workflowId || '';
          item.aspectRatio = item.aspectRatio || rich[ri].aspectRatio || '';
          item.pid = item.pid || rich[ri].pid || '';
          rich.splice(ri, 1);
        }
        rich.push(item);
        const ii = ids.indexOf(item.id);
        if (ii !== -1) ids.splice(ii, 1);
        ids.push(item.id);
      }
      while (rich.length > 200) rich.shift();
      while (ids.length > 200) ids.shift();
      await new Promise((resolve) => chrome.storage.local.set({ afGeneratedVideos: rich, afGeneratedMediaIds: ids }, resolve));
    }).catch((e) => {
      logUI(`⚠️ Không lưu được danh sách media vừa tạo: ${e.message}`, 'warning');
    });
    return harvestedVideoWriteQueue;
  }

  function clearHarvestedVideos() {
    harvestedVideoWriteQueue = harvestedVideoWriteQueue.then(() => new Promise((resolve) => {
      chrome.storage.local.set({ afGeneratedVideos: [], afGeneratedMediaIds: [] }, resolve);
    }));
    return harvestedVideoWriteQueue;
  }

  function harvestGeneratedMediaIds(responseText) {
    const vids = [];
    try {
      const obj = JSON.parse(responseText);
      const arr = Array.isArray(obj && obj.media) ? obj.media : [];
      for (const m of arr) {
        if (!m || !m.video || !m.name) continue;
        const id = String(m.name).replace(/_upsampled$/, '');
        const ctrl = m.mediaMetadata && m.mediaMetadata.requestData && m.mediaMetadata.requestData.videoGenerationRequestData && m.mediaMetadata.requestData.videoGenerationRequestData.videoModelControlInput;
        const aspect = (ctrl && ctrl.videoAspectRatio) || (m.video.generatedVideo && m.video.generatedVideo.aspectRatio) || '';
        vids.push({ id, workflowId: m.workflowId || '', aspectRatio: aspect });
      }
    } catch (e) { return; }
    storeHarvestedVideos(vids);
  }

  // Gửi danh sách video sang inject (MAIN world) để chạy pipeline 1080p:
  //   upsample → poll → (inject báo 'upsampleReady') → content tải _upsampled.
  function safeDownloadBaseName(value) {
    return String(value || '')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 150) || 'Clip';
  }

  function numberedDownloadName(baseName, index) {
    return `${safeDownloadBaseName(baseName)} ${index + 1}.mp4`;
  }

  function startUpsampleDownload(items, downloadBaseName = '', quality = '1080') {
    const pid = getProjectIdFromUrl() || '';
    if (!pid) { logUI('⬇️ Upscale: chưa xác định được projectId — mở 1 project trên Flow.', 'warning'); return false; }
    const namedItems = (Array.isArray(items) ? items : []).map((item, index) => ({
      ...item,
      downloadName: item.downloadName || numberedDownloadName(downloadBaseName, index),
    }));
    chrome.storage.local.get(['afGenerateUpsampleTemplate'], (data) => {
      const tmpl = data.afGenerateUpsampleTemplate;
      window.postMessage({
        __afUpsampleDownload: true,
        projectId: pid,
        items: namedItems,
        resolution: quality === '4k' ? '4k' : '1080',
        templateBody: (tmpl && tmpl.body) || ''
      }, '*');
    });
    return true;
  }

  // TỰ ĐỘNG TẢI sau khi tạo hàng loạt: bật khi người dùng để "Tự động tải về" ON.
  //   Lưu tùy chọn của lượt bulk gần nhất để chạy khi có kết quả tạo xong.
  let pendingAutoDownload = null; // { upsampled: bool, downloadBaseName: string } hoặc null
  // Ngữ cảnh của dự án trong chuỗi nền. BULK_DONE và kết quả tải được checkpoint
  // theo hai id này để background service worker có ngủ/thức lại cũng không mất lượt.
  let activeBulkChainContext = null;

  // Đọc danh sách video đã thu từ storage. Trả { rich, ids }.
  //   scopeToCurrentProject=true (mặc định): CHỈ trả video của dự án Flow đang mở —
  //   loại video đã gắn pid của DỰ ÁN KHÁC. Đây là chốt chống "tải lại dự án cũ":
  //   dù danh sách còn sót id dự án trước, bước tải cũng bỏ qua chúng.
  //   Video chưa gắn pid (dữ liệu cũ trước bản vá) vẫn được giữ để tương thích ngược.
  async function readGeneratedVideos(scopeToCurrentProject = true) {
    const data = await new Promise((res) => chrome.storage.local.get(['afGeneratedVideos', 'afGeneratedMediaIds'], res));
    let rich = Array.isArray(data.afGeneratedVideos) ? data.afGeneratedVideos : [];
    if (scopeToCurrentProject) {
      const curPid = getProjectIdFromUrl() || '';
      if (curPid) rich = rich.filter((v) => v && (!v.pid || v.pid === curPid));
    }
    const ids = rich.length ? rich.map((v) => v.id) : (Array.isArray(data.afGeneratedMediaIds) ? data.afGeneratedMediaIds : []);
    return { rich, ids };
  }

  // CHỜ THU THẬP media id: id video chỉ xuất hiện khi Flow poll trạng thái về —
  //   ngay sau "tạo xong" thường CHƯA có id nào. Kiên nhẫn đọc lại storage tới khi
  //   đủ expectCount id (hoặc hết maxWaitMs). KHÔNG bỏ cuộc sau 1 lần đọc.
  async function waitHarvestedVideos(expectCount = 0, maxWaitMs = 15 * 60 * 1000) {
    const deadline = Date.now() + maxWaitMs;
    let lastLog = 0;
    for (;;) {
      const got = await readGeneratedVideos();
      const enough = expectCount > 0 ? got.ids.length >= expectCount : got.ids.length > 0;
      if (enough || Date.now() > deadline) return got;
      if (Date.now() - lastLog > 30000) {
        lastLog = Date.now();
        logUI(`⏳ Tự động tải: chờ thu media id video (đã thấy ${got.ids.length}${expectCount ? '/' + expectCount : ''})…`, 'info');
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  // Chờ toàn bộ video đã sinh render xong rồi TẢI hết (không cần bấm tay).
  //   quality: '720' → tải thẳng; '1080'/'4k' → pipeline upsample rồi tải.
  async function autoDownloadGeneratedVideos(quality, downloadBaseName = '', expectCount = 0) {
    const q = quality === true ? '1080' : (quality === false || !quality ? '720' : String(quality));
    const pid = getProjectIdFromUrl() || '';
    // BƯỚC 1: chờ thu đủ media id (không bỏ cuộc chỉ vì đọc lần đầu chưa thấy).
    const { rich, ids } = await waitHarvestedVideos(expectCount);
    if (!ids.length) { logUI('⬇️ Tự động tải: sau 15 phút vẫn chưa thu được video nào — video có thể chưa tạo xong; bấm "Tải 720p/1080p" thủ công khi video hiện trong Gallery.', 'warning'); return; }
    if (expectCount && ids.length < expectCount) logUI(`⚠️ Tự động tải: chỉ thu được ${ids.length}/${expectCount} video — tải phần đã có.`, 'warning');
    // LUÔN chờ video gốc render xong trước — kể cả khi sẽ upscale (upsample video
    //   chưa render xong sẽ lỗi ngay).
    logUI(`⏳ Tự động tải: chờ ${ids.length} video render xong…`, 'info');
    const ready = pid ? await waitVideosReadyViaInject(ids, pid) : ids;
    if (!ready.length) { logUI('⬇️ Tự động tải: không video nào sẵn sàng sau thời gian chờ.', 'warning'); return; }
    if (q === '1080' || q === '4k') {
      const readySet = new Set(ready);
      const items = (rich.length ? rich : ids.map((id) => ({ id })))
        .filter((v) => readySet.has(v.id))
        .map((v) => ({ mediaId: v.id, workflowId: v.workflowId || '', aspectRatio: v.aspectRatio || '' }));
      logUI(`⬇️ Tự động tải ${q === '4k' ? '4K' : '1080p'} ${items.length} video (upsample → chờ → tải)…`, 'info');
      startUpsampleDownload(items, downloadBaseName, q);
      return;
    }
    logUI(`⬇️ Tự động tải ${ready.length} video (720p)…`, 'info');
    const r = await apiDownloadMediaIds(ready, false, false, downloadBaseName);
    logUI(r && r.success ? `⬇️ Tự động tải xong ${r.okCount}/${r.total} video ✅` : `⬇️ Tự động tải lỗi (${r && r.error || '?'})`, r && r.success ? 'success' : 'error');
  }

  // Cầu nối chờ inject báo video render xong (waitVideosReadyHandler → 'videosReady').
  const _afReadyWaiters = new Map();
  // Waiter cho CHUỖI DỰ ÁN chờ cả lượt upscale + tải xong (1 lượt tại 1 thời điểm).
  let _afUpsampleBatchWaiter = null; // { pending: Set<mediaId>, resolve } | null
  function _afNotifyUpsampleBatch(mediaId) {
    if (!_afUpsampleBatchWaiter || !mediaId) return;
    _afUpsampleBatchWaiter.pending.delete(String(mediaId).replace(/_upsampled$/, ''));
    if (!_afUpsampleBatchWaiter.pending.size) {
      const w = _afUpsampleBatchWaiter;
      _afUpsampleBatchWaiter = null;
      w.resolve();
    }
  }
  function waitVideosReadyViaInject(ids, projectId, timeoutMs = 20 * 60 * 1000) {
    return new Promise((resolve) => {
      const reqId = 'rdy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const timer = setTimeout(() => { _afReadyWaiters.delete(reqId); resolve(ids.slice()); }, timeoutMs);
      _afReadyWaiters.set(reqId, (ready) => { clearTimeout(timer); _afReadyWaiters.delete(reqId); resolve(ready); });
      // rounds khớp với timeout (mỗi vòng 5s) — trước kia inject mặc định bỏ cuộc
      //   sau 60 vòng (5 phút) dù content chờ tới 20 phút.
      const delayMs = 5000;
      const rounds = Math.max(12, Math.ceil(timeoutMs / delayMs));
      window.postMessage({ __afWaitVideosReady: true, reqId, ids, projectId, rounds, delayMs }, '*');
    });
  }

  const mediaRedirectUrl = (name) => `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=${encodeURIComponent(name)}`;

  // Tải 1 video bằng FETCH SAME-ORIGIN (content_script chạy trên labs.google nên có
  //   cookie first-party đầy đủ — giống hệt cách trang tự tải). Lấy blob mp4 rồi tải
  //   bằng thẻ <a download>. Đáng tin cậy hơn chrome.downloads (không dính SameSite).
  //   Trả về {id, ok, status, bytes|error}. Không throw.
  async function fetchBlobDownloadOne(mediaId, upsampled, downloadName) {
    const id = String(mediaId || '').replace(/_upsampled$/, '');
    if (!id) return { id, ok: false, error: 'empty-id' };
    const tryOne = async (name) => {
      // credentials:'same-origin' — chặng labs.google (same-origin) vẫn gửi cookie để
      //   xác thực; chặng CDN flow-content.google (đã ký, ACAO:*) đọc được vì KHÔNG kèm
      //   credentials. Dùng 'include' sẽ bị CORS chặn vì ACAO:* cấm đi với credentials.
      const res = await fetch(mediaRedirectUrl(name), { credentials: 'same-origin', cache: 'no-store', redirect: 'follow' });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.ok) return { ok: false, status: res.status, ct };
      // Chỉ loại khi RÕ RÀNG là trang HTML/JSON (redirect login / lỗi). Content-type
      //   trống hoặc video/octet-stream đều chấp nhận rồi kiểm tra kích thước blob.
      if (/text\/html|application\/json/.test(ct)) return { ok: false, status: res.status, ct, notVideo: true };
      const blob = await res.blob();
      if (!blob || blob.size < 10000) return { ok: false, status: res.status, ct, tooSmall: true };
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl; a.download = downloadName || `${id}.mp4`; a.style.display = 'none';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => { try { URL.revokeObjectURL(objUrl); } catch (e) {} }, 60000);
      return { ok: true, status: res.status, bytes: blob.size };
    };
    try {
      let r = await tryOne(upsampled ? `${id}_upsampled` : id);
      // Bản 1080p chưa upsample xong → thử lại bản gốc.
      if (!r.ok && upsampled) r = await tryOne(id);
      return Object.assign({ id }, r);
    } catch (e) {
      return { id, ok: false, error: e.message };
    }
  }

  // Tải 1 video, KIÊN NHẪN thử lại khi video chưa sẵn sàng (server trả HTML/JSON
  //   hoặc file rỗng lúc chưa render xong). Mặc định 5 lần, cách nhau 8s — "chờ
  //   bằng được" thay vì bấm 1 phát rồi báo lỗi.
  async function fetchBlobDownloadWithRetry(mediaId, upsampled, downloadName, attempts = 5, delayMs = 8000) {
    let r = null;
    for (let att = 1; att <= attempts; att++) {
      r = await fetchBlobDownloadOne(mediaId, upsampled, downloadName);
      if (r.ok) return r;
      // Chỉ thử lại khi lỗi kiểu "chưa sẵn sàng"; lỗi mạng thật để background lo.
      const retriable = r.notVideo || r.tooSmall || (r.status && r.status >= 400);
      if (!retriable || att === attempts) return r;
      logUI(`⏳ Video ${String(r.id).slice(0, 8)}… chưa sẵn sàng (lần ${att}/${attempts}) — chờ ${Math.round(delayMs / 1000)}s thử lại…`, 'info');
      await new Promise((res) => setTimeout(res, delayMs));
    }
    return r;
  }

  // Tải nhiều video. Ưu tiên fetch-blob same-origin; nếu lỗi mạng/CORS thì thử lại
  //   qua background (chrome.downloads) như phương án dự phòng.
  async function apiDownloadMediaIds(ids, upsampled = true, waitComplete = false, downloadBaseName = '', explicitNames = []) {
    const list = (Array.isArray(ids) ? ids : [ids]).filter(Boolean);
    if (!list.length) return { success: false, error: 'no-media-id' };
    const results = [];
    const bgFallback = [];
    for (let index = 0; index < list.length; index++) {
      const raw = list[index];
      const downloadName = explicitNames[index] || numberedDownloadName(downloadBaseName, index);
      const r = await fetchBlobDownloadWithRetry(raw, upsampled, downloadName);
      if (r.ok) {
        logUI(`⬇️ Đã tải ${String(r.id).slice(0, 8)}… (${Math.round((r.bytes || 0) / 1048576)}MB) ✅`, 'success');
      } else {
        const why = r.notVideo ? `HTTP ${r.status} không phải video (${r.ct || '?'})` : r.tooSmall ? `file rỗng` : (r.error || `HTTP ${r.status || '?'}`);
        logUI(`⬇️ Lỗi tải ${String(r.id).slice(0, 8)}…: ${why} — thử lại qua background`, 'warning');
        bgFallback.push({ id: r.id, downloadName });
      }
      results.push(r);
    }
    // Phương án dự phòng: những id fetch-blob lỗi → nhờ background chrome.downloads.
    if (bgFallback.length) {
      const bgResp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'DOWNLOAD_FLOW_MEDIA', mediaIds: bgFallback.map((item) => item.id), fileNames: bgFallback.map((item) => item.downloadName), upsampled, waitComplete }, (resp) => {
          resolve(chrome.runtime.lastError ? null : resp);
        });
      });
      if (bgResp && Array.isArray(bgResp.results)) {
        for (const br of bgResp.results) {
          const idx = results.findIndex((x) => x.id === br.id && !x.ok);
          if (idx !== -1) results[idx] = Object.assign({}, br, { viaBackground: true });
        }
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    return { success: okCount > 0, okCount, total: results.length, results };
  }

  // Chất lượng tải đã chọn: '720' | '1080' | '4k'. Tương thích cấu hình cũ
  //   (download1080p boolean) nếu bản sidepanel chưa gửi downloadQuality.
  function selectedDownloadQuality() {
    const q = String(cfg.downloadQuality || '').toLowerCase();
    if (q === '720' || q === '1080' || q === '4k') return q;
    return cfg.download1080p ? '1080' : '720';
  }

  async function autoDownload(downloadIndex = 0) {
    notify('DOWNLOADING');
    await wait(2);
    const downloadName = numberedDownloadName(cfg.downloadBaseName || 'Clip', downloadIndex);
    const quality = selectedDownloadQuality();

    // 1) Chờ MEDIA_ID của video mới xuất hiện trên trang (thẻ <video> có thể vào
    //    DOM trễ hơn lúc card kết quả hiện) — tối đa 60s.
    let mediaId = currentVideoMediaId();
    for (let t = 0; t < 30 && !mediaId; t++) { await wait(2); mediaId = currentVideoMediaId(); }

    if (mediaId) {
      // 2) CHỜ BẰNG ĐƯỢC video render xong (poll API trạng thái tới khi SUCCESSFUL)
      //    rồi mới tải — đây là chỗ trước kia chỉ chờ 2s nên hay "không tải được".
      const pid = getProjectIdFromUrl() || '';
      if (pid) {
        const waitMs = Math.max(5, cfg.timeout || 10) * 60 * 1000;
        logUI(`⏳ Chờ video render xong rồi mới tải (${quality === '4k' ? '4K' : quality + 'p'})…`, 'info');
        await waitVideosReadyViaInject([mediaId], pid, waitMs);
      }
      if (quality === '1080' || quality === '4k') {
        // 1080p/4K: pipeline upsample → chờ xử lý xong → tự tải (inject báo về).
        const data = await new Promise((res) => chrome.storage.local.get(['afGeneratedVideos'], res));
        const rich = Array.isArray(data.afGeneratedVideos) ? data.afGeneratedVideos : [];
        const meta = rich.find((v) => v && v.id === mediaId) || {};
        const started = startUpsampleDownload(
          [{ mediaId, workflowId: meta.workflowId || '', aspectRatio: meta.aspectRatio || '', downloadName }],
          '', quality
        );
        if (started) {
          logUI(`⬇️ Đã gửi upsample ${quality === '4k' ? '4K' : '1080p'} cho ${mediaId.slice(0, 8)}… — sẽ tự tải khi xử lý xong.`, 'info');
          notify('DOWNLOADED');
          return true;
        }
        logUI('⬇️ Không chạy được pipeline upscale — tải bản 720p thay thế.', 'warning');
      }
      const r = await apiDownloadMediaIds([mediaId], false, false, '', [downloadName]);
      if (r && r.success) {
        logUI(`⬇️ Tải video qua API (720p): ${mediaId.slice(0, 8)}… ✅`, 'success');
        notify('DOWNLOADED');
        return true;
      }
      logUI(`⬇️ API tải video lỗi (${r && r.error || '?'}) — chuyển sang bấm nút tải.`, 'warning');
    } else {
      logUI('⬇️ Không tìm thấy media id sau 60s — chuyển sang bấm nút tải trên trang.', 'warning');
    }
    const btns = DOM.getDownloadButtons();
    if (btns.length > 0) {
      btns[btns.length - 1].click();
      await wait(2);
      notify('DOWNLOADED');
      return true;
    }
    const videos = document.querySelectorAll('video');
    if (videos.length > 0) {
      const src = videos[videos.length - 1].src || videos[videos.length - 1].querySelector('source')?.src;
      if (src) {
        chrome.runtime.sendMessage({ action: 'DOWNLOAD_FILE', url: src, filename: downloadName });
        notify('DOWNLOADED');
        return true;
      }
    }
    return false;
  }

  // ========================
  // IMAGE UPLOAD — Storyboard support
  // ========================

  // Attach an image DIRECTLY into the prompt bar (drag-drop onto the prompt
  // input) so it becomes a reference for THIS generation — not just uploaded to
  // the library. Returns true if the drop dispatched.
  // Tìm OVERLAY "Thả nội dung nghe nhìn lên / Drop" mà Flow bật lên khi đang kéo
  // file vào — vùng nhận thả THẬT nằm ở overlay này (quét cả div/span, không chỉ nút).
  function findDropOverlay() {
    const wants = ['thả nội dung', 'nghe nhìn', 'thả tệp', 'kéo thả', 'drop file', 'drop media', 'thả vào'];
    const els = document.querySelectorAll('div, span, p, section');
    for (const el of els) {
      if (!isVisible(el)) continue;
      const t = (el.textContent || '').trim().toLowerCase();
      if (!t || t.length > 60) continue;
      if (wants.some((w) => t.includes(w))) return el;
    }
    return null;
  }

  async function attachImageToPrompt(imageDataUrl, fileName) {
    const editor = DOM.getPromptInput() ||
      document.querySelector('[data-slate-editor="true"], [contenteditable="true"], textarea, [class*="prompt"]');
    if (!editor) { logWarn('Thả ảnh: không thấy ô prompt'); return false; }
    try {
      const blob = await dataUrlToBlob(imageDataUrl);
      const file = new File([blob], fileName || 'frame.png', { type: blob.type });
      const mk = (type, target) => {
        const r = target.getBoundingClientRect();
        const dt = new DataTransfer();
        dt.items.add(file);
        return new DragEvent(type, {
          bubbles: true, cancelable: true, composed: true,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, dataTransfer: dt,
        });
      };
      // 1) dragenter/over trên ô prompt → Flow thường bật overlay "Thả nội dung..."
      editor.dispatchEvent(mk('dragenter', editor));
      editor.dispatchEvent(mk('dragover', editor));
      await sleep(450);
      // 2) Nếu có overlay vùng thả → thả TRÚNG overlay; nếu không → thả vào ô prompt.
      const overlay = findDropOverlay();
      const dropTarget = overlay ? (overlay.closest('div') || overlay) : editor;
      if (overlay) log('Thả ảnh: thấy overlay vùng thả → thả vào overlay');
      dropTarget.dispatchEvent(mk('dragenter', dropTarget));
      dropTarget.dispatchEvent(mk('dragover', dropTarget));
      await sleep(150);
      dropTarget.dispatchEvent(mk('drop', dropTarget));
      log(`Đã thả ảnh "${fileName || ''}" (đích: ${overlay ? 'overlay' : 'ô prompt'})`);
      return true;
    } catch (e) {
      logWarn(`attachImageToPrompt failed: ${e.message}`);
      return false;
    }
  }

  // Poll until an image/thumbnail appears attached near the prompt bar.
  async function waitForPromptImage(timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (countPromptImages() > 0) return true;
      await sleep(400);
    }
    return false;
  }

  // Tìm <input type=file> nhận ảnh GẦN ô prompt Flow nhất (input file thường ẩn
  // nên đo theo phần tử cha có kích thước). Đây là cách các extension nổi tiếng
  // dùng để nạp ảnh — KHÔNG cần kéo-thả, KHÔNG cần nút "+".
  function findFlowFileInput() {
    const inputs = [...document.querySelectorAll('input[type="file"]')]
      .filter((i) => !i.accept || /image|\*|video/i.test(i.accept));
    if (!inputs.length) return null;
    const pi = DOM.getPromptInput();
    if (pi) {
      const pr = pi.getBoundingClientRect();
      const pc = { x: pr.left + pr.width / 2, y: pr.top + pr.height / 2 };
      let best = null, bestD = Infinity;
      for (const inp of inputs) {
        let host = inp, r = inp.getBoundingClientRect(), hop = 0;
        while ((r.width === 0 || r.height === 0) && host.parentElement && hop < 5) { host = host.parentElement; r = host.getBoundingClientRect(); hop++; }
        const d = Math.hypot((r.left + r.width / 2) - pc.x, (r.top + r.height / 2) - pc.y);
        if (d < bestD) { bestD = d; best = inp; }
      }
      if (best) return best;
    }
    return inputs[inputs.length - 1];
  }

  // NẠP NHIỀU ẢNH qua input[type=file] (đặt .files bằng native setter — cách React
  // an toàn, giống các extension nổi tiếng). Đây là đường CHÍNH để đưa ảnh tham
  // chiếu (storyboard + sản phẩm + nhân vật) vào câu lệnh, không kéo-thả/popup.
  async function attachImagesViaFileInput(items) {
    const input = findFlowFileInput();
    if (!input) { logWarn('Không thấy input[type=file] để nạp ảnh'); return false; }
    try {
      const dt = new DataTransfer();
      for (const it of items) {
        const blob = await dataUrlToBlob(it.data);
        dt.items.add(new File([blob], it.name || 'image.png', { type: blob.type }));
      }
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files').set;
      setter.call(input, dt.files);
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      log(`Đã nạp ${items.length} ảnh qua input[type=file]: ${items.map((f) => f.name).join(', ')}`);
      return true;
    } catch (e) { logWarn(`attachImagesViaFileInput lỗi: ${e.message}`); return false; }
  }

  // Đếm số ẢNH đính kèm trong thanh prompt. Đếm <img> là chính xác nhất: thanh
  // prompt khi trống có 0 <img> (các nút dùng icon-font, không phải <img>), mỗi
  // ảnh tham chiếu = 1 <img>. Luôn so với mốc (baseline) nên dù có 1 <img> cố
  // định thì delta vẫn đúng.
  function countPromptImages() {
    const scope = getPromptScope();
    if (!scope) return 0;
    const imgs = scope.querySelectorAll('img').length;
    const chips = scope.querySelectorAll('[class*="thumb"], [class*="chip"], [class*="attachment"]').length;
    return Math.max(imgs, chips);
  }

  // Chờ tới khi số ảnh đính kèm trong ô prompt VƯỢT mốc `baseline`.
  async function waitCountAbove(baseline, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (countPromptImages() > baseline) return true;
      await sleep(400);
    }
    return false;
  }

  // Chờ tới khi số ảnh đính kèm đạt ÍT NHẤT `target`.
  async function waitCountAtLeast(target, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (countPromptImages() >= target) return true;
      await sleep(400);
    }
    return false;
  }

  // Thả NHIỀU ảnh CÙNG MỘT LÚC trong 1 thao tác kéo-thả (1 DataTransfer chứa nhiều
  // File). Vì kéo-thả 1 ảnh (storyboard) đã chạy tốt, thả GỘP tất cả ảnh tham chiếu
  // trong 1 lần là cách đơn giản & chắc nhất để đưa CẢ nhân vật/sản phẩm vào —
  // tránh hẳn lỗi "cú thả thứ 2 bị Flow bỏ qua".
  async function attachImagesViaDrop(items) {
    const target = DOM.getPromptInput() ||
      document.querySelector('[data-slate-editor="true"], [contenteditable="true"], textarea, [class*="prompt"]');
    if (!target || !items || !items.length) return false;
    try {
      const dt = new DataTransfer();
      for (const it of items) {
        const blob = await dataUrlToBlob(it.data);
        dt.items.add(new File([blob], it.name || 'image.png', { type: blob.type }));
      }
      const rect = target.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer: dt };
      target.dispatchEvent(new DragEvent('dragenter', opts));
      await sleep(150);
      target.dispatchEvent(new DragEvent('dragover', opts));
      await sleep(150);
      target.dispatchEvent(new DragEvent('drop', opts));
      log(`Đã thả ${items.length} ảnh CÙNG LÚC vào ô prompt: ${items.map((f) => f.name).join(', ')}`);
      return true;
    } catch (e) {
      logWarn(`attachImagesViaDrop lỗi: ${e.message}`);
      return false;
    }
  }

  // Chờ tới khi hàm `fn()` trả về giá trị đúng (true) hoặc hết `timeoutMs`.
  async function waitUntil(fn, timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try { if (fn()) return true; } catch (e) {}
      await sleep(300);
    }
    return false;
  }

  // Đính kèm MỘT ảnh vào câu lệnh rồi CHỜ tới khi ảnh thật sự hiện (số ảnh tăng
  // so với mốc đo ngay trước đó). Hai cách:
  //   • KÉO-THẢ ảnh thẳng vào ô prompt — chạy tốt cho ảnh ĐẦU TIÊN của cảnh (storyboard).
  //   • Nút "+" Ở Ô PROMPT → mở KHO ẢNH (gallery) → tải ảnh lên → "Thêm vào câu lệnh"
  //     — cần cho ảnh THỨ 2 trở đi (sản phẩm, nhân vật), vì Flow hay bỏ qua cú
  //     kéo-thả thứ hai. Mỗi cách là phương án dự phòng cho cách kia.
  async function attachAndWait(imageDataUrl, fileName, label, timeoutMs) {
    const before = countPromptImages();
    const limit = timeoutMs || 12000;
    // Ảnh đầu tiên (chưa có ảnh nào) → ưu tiên kéo-thả; ảnh sau → ưu tiên nút "+".
    const order = before === 0 ? ['drop', 'plus'] : ['plus', 'drop'];

    for (let k = 0; k < order.length; k++) {
      const method = order[k];
      const waitMs = k === 0 ? limit : 8000;
      if (method === 'drop') {
        log(`${label}: thả ảnh "${fileName || 'image'}" vào ô prompt...`);
        await attachImageToPrompt(imageDataUrl, fileName);
      } else {
        log(`${label}: dùng dấu "+" ở ô prompt → kho ảnh → "Thêm vào câu lệnh"...`);
        await addImageViaPlusPanel(imageDataUrl, fileName, label);
      }
      if (await waitCountAbove(before, waitMs)) {
        log(`✅ ${label}: ảnh đã vào câu lệnh (${method === 'drop' ? 'kéo-thả' : 'nút +'}) — chờ ổn định...`);
        await sleep(1800);
        return true;
      }
      logWarn(`${label}: cách "${method === 'drop' ? 'kéo-thả' : 'nút +'}" chưa vào — thử cách còn lại...`);
    }
    logWarn(`⚠️ ${label}: ảnh chưa hiện sau khi thử CẢ kéo-thả lẫn nút "+". Hãy dạy lại nút "+" (đúng dấu + mở kho ảnh) rồi thử lại.`);
    return false;
  }

  // True if `prompt` mentions `name` as a whole word — Unicode-aware so Vietnamese
  // names match and a short name like "An" doesn't match inside "Anna". Falls back
  // to a plain substring test on older engines.
  function promptMentions(prompt, name) {
    const n = (name || '').trim();
    if (n.length < 2 || !prompt) return false;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return new RegExp('(^|[^\\p{L}\\p{N}])' + esc + '($|[^\\p{L}\\p{N}])', 'iu').test(prompt);
    } catch (e) {
      return prompt.toLowerCase().includes(n.toLowerCase());
    }
  }

  // Cơ chế CHÍNH THỨC của Google Flow để giữ nhân vật nhất quán: gõ @TênNhânVật
  // trong prompt → Flow tham chiếu đúng "nhân vật" (asset) đã tạo, thay vì vẽ lại
  // ngẫu nhiên. (Nguồn: Google Flow Help + hướng dẫn cộng đồng.) Vì vậy nhân vật
  // ĐÃ ĐẶT TÊN sẽ được chèn @tên vào prompt, KHÔNG thả lại ảnh (vừa đỡ đụng giới
  // hạn ~3 ảnh/câu lệnh, vừa đúng cách Flow dùng). Nếu prompt nhắc tên ai → chỉ @
  // người đó; nếu không nhắc → @ tất cả nhân vật có tên.
  function buildPromptWithMentions(prompt) {
    const named = (cfg.charImages || []).filter((c) => c && (c.name || '').trim());
    if (!named.length) return prompt;
    const mentioned = named.filter((c) => promptMentions(prompt, c.name));
    const apply = mentioned.length ? mentioned : named;
    const tags = [];
    apply.forEach((c) => {
      // @tag là MỘT từ (không dấu cách) theo quy ước Flow.
      const tag = '@' + c.name.trim().replace(/\s+/g, '');
      if (!tags.includes(tag) && !prompt.includes(tag)) tags.push(tag);
    });
    if (!tags.length) return prompt;
    log(`Tham chiếu nhân vật bằng tên: ${tags.join(' ')} (nhân vật phải đã "Nạp vào Flow" trước)`);
    return `${tags.join(' ')} ${prompt}`;
  }

  // CORRECT Flow flow: upload to library → open the "+" panel → pick the most
  // recent image → click "Thêm vào câu lệnh" so it attaches to THIS prompt.
  // Set a React-controlled input's value so the framework registers it.
  function setNativeValue(el, value) {
    try {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, value);
    } catch (e) { el.value = value; }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function getAssetSearchInput() {
    return document.querySelector('input[placeholder*="Tìm kiếm thành phần"], input[placeholder*="thành phần"], input[placeholder*="Search"]');
  }
  function getAssetPanel() {
    const s = getAssetSearchInput();
    return s ? (s.closest('[role="dialog"],[data-radix-popper-content-wrapper],[class*="popover"],[class*="dialog"]') || s.closest('div').parentElement) : null;
  }
  function clickAddToPrompt() {
    const btn = findByText(['Thêm vào câu lệnh', 'Add to prompt']) ||
      findMapped('addToPrompt') ||
      findByTextLoose(['thêm vào câu lệnh', 'add to prompt']);
    if (btn) { simulateRadixClick(btn); log('Bấm "Thêm vào câu lệnh"'); return true; }
    logWarn('Không thấy nút "Thêm vào câu lệnh"');
    return false;
  }

  // Tìm phần tử bấm được theo CHỨA chuỗi (không cần khớp tuyệt đối) — dùng cho các
  // nhãn dài/ có icon kèm chữ như "Thêm vào câu lệnh", "Tải nội dung nghe nhìn lên".
  function findByTextLoose(subs) {
    const wants = subs.map((s) => s.toLowerCase());
    const els = document.querySelectorAll('button, [role="button"], label, a, input');
    for (const el of els) {
      if (!isVisible(el)) continue;
      const ph = (el.getAttribute && (el.getAttribute('placeholder') || '')) || '';
      const t = `${el.textContent || ''} ${ph}`.trim().toLowerCase();
      if (!t || t.length > 60) continue;
      if (wants.some((w) => t.includes(w))) return el;
    }
    return null;
  }

  // Một phần tử có ĐÁNG là dấu "+" mở kho ảnh không? — phải KHÔNG dính chữ
  // "Tạo/Create/Gửi/Submit" (để không bấm nhầm gây tạo video) và gần như KHÔNG có
  // chữ (dấu + chỉ là icon). Loại bỏ lỗi cũ "add_2Tạo" (bắt nhầm cụm chứa nút Tạo).
  function isGoodPlus(el) {
    if (!el || !isVisible(el)) return false;
    const t = (el.textContent || '').trim().toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();
    const bad = /tạo|create|gửi|send|submit|generate|arrow_forward|arrow_upward/;
    if (bad.test(t) || bad.test(aria)) return false;
    if (t.length > 6 && t !== 'add_2') return false; // "+" hầu như không có chữ
    return true;
  }

  // Tự dò DẤU "+" Ở KHU VỰC NHẬP PROMPT (nút tròn bên trái nút "Tác nhân"). Đây là
  // dấu cộng để MỞ KHO ẢNH (gallery) và thêm ảnh vào câu lệnh — KHÔNG phải nút tạo
  // nhân vật, KHÔNG phải nút gửi/menu tài khoản.
  function findPromptPlus() {
    const scope = getPromptScope();
    // 1) Nút / role=button có icon "add" SẠCH (không dính chữ Tạo).
    const btns = scope.querySelectorAll('button, [role="button"]');
    for (const b of btns) {
      if (!isGoodPlus(b)) continue;
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const txt = (b.textContent || '').trim().toLowerCase();
      const iconPlus = txt === 'add' || txt === 'add_2' || txt === '+';
      const ariaPlus = aria.includes('add') || aria.includes('thêm') || aria.includes('attach') ||
        aria.includes('phương tiện') || aria.includes('media') || aria.includes('tải');
      if (iconPlus || ariaPlus) return b;
    }
    // 2) Không thấy nút sạch → tìm ICON span/i có chữ ligature "add"/"add_2"/"+" rồi
    //    lấy nút bao quanh; nếu nút bao quanh lại là cụm "Tạo" thì bấm THẲNG vào icon.
    const icons = scope.querySelectorAll('span, i');
    for (const ic of icons) {
      if (!isVisible(ic)) continue;
      const t = (ic.textContent || '').trim().toLowerCase();
      if (t !== 'add' && t !== 'add_2' && t !== '+') continue;
      const wrap = ic.closest('button, [role="button"]');
      if (wrap && isGoodPlus(wrap)) return wrap;
      return ic; // icon nằm trong cụm "add_2Tạo" → bấm thẳng vào icon "+"
    }
    return null;
  }

  // Lấy nút "+" CHẮC CHẮN: ưu tiên mapping đã teach NHƯNG chỉ khi nó hợp lệ (không
  // dính "Tạo"); nếu mapping trỏ nhầm (lỗi add_2Tạo) thì bỏ qua và tự dò.
  function getPromptPlusButton() {
    const taught = findMapped('promptPlus');
    if (taught && isGoodPlus(taught)) return taught;
    if (taught) logWarn('Nút "+" đã teach trỏ NHẦM (dính "Tạo"/quá dài) → tự dò lại. Hãy bấm 3 lần dòng "Dấu +" để xoá rồi teach lại CHỈ vào dấu +.');
    return findPromptPlus();
  }

  function isAssetPanelOpen() {
    const s = getAssetSearchInput();
    return !!(s && isVisible(s));
  }

  // Kho ảnh ("+" panel) đã mở chưa? — chỉ dùng TÍN HIỆU MẠNH: ô tìm kiếm thành
  // phần hoặc nút "Thêm vào câu lệnh". (Không dùng "Tải nội dung nghe nhìn lên" vì
  // nút này có thể luôn hiển thị → dễ báo nhầm là đã mở.)
  function isPlusPanelOpen() {
    if (isAssetPanelOpen()) return true;
    return !!findByTextLoose(['thêm vào câu lệnh', 'add to prompt']);
  }

  // Khung chứa kho ảnh đang mở (để tìm input tải ảnh / ảnh trong đó).
  function getOpenPanelContainer() {
    const anchor = findByTextLoose([
      'thêm vào câu lệnh', 'tải nội dung nghe nhìn lên', 'tìm kiếm thành phần',
    ]);
    if (anchor) {
      return anchor.closest('[role="dialog"],[data-radix-popper-content-wrapper],[class*="popover"],[class*="dialog"],[class*="panel"]') ||
        anchor.parentElement?.parentElement || document.body;
    }
    return document.querySelector('[role="dialog"],[data-radix-popper-content-wrapper]') || document.body;
  }

  // Ô <input type=file> để tải ảnh lên trong kho ảnh (gán file thẳng, bỏ qua hộp
  // thoại chọn file của hệ điều hành mà ta không điều khiển được).
  function findUploadInputInPanel() {
    const panel = getOpenPanelContainer();
    const inPanel = panel.querySelector('input[type="file"]');
    if (inPanel) return inPanel;
    const all = [...document.querySelectorAll('input[type="file"]')]
      .filter((i) => !i.accept || /image|\*|video/i.test(i.accept));
    return all.length ? all[all.length - 1] : null;
  }

  // CÁCH "+" (đúng ý người dùng): bấm dấu "+" ở ô prompt → mở KHO ẢNH → tải ảnh lên
  // qua "Tải nội dung nghe nhìn lên" → bấm "Thêm vào câu lệnh". Trả về true nếu đã
  // bấm được "Thêm vào câu lệnh".
  async function addImageViaPlusPanel(imageDataUrl, fileName, label) {
    // QUAN TRỌNG (đúng chẩn đoán của người dùng): các bước phải LẦN LƯỢT, không
    // được đè nhau. "Thêm vào câu lệnh" chỉ xuất hiện SAU khi bấm "+" và ảnh đã tải
    // xong — nên giữa mỗi bước phải CHỜ và XÁC NHẬN bước trước hoàn tất.

    // (1) Mở kho ảnh bằng dấu "+" ở ô prompt (nếu chưa mở), rồi CHỜ panel mở hẳn.
    if (!isPlusPanelOpen()) {
      const plus = getPromptPlusButton();
      if (!plus) { logWarn(`${label}: không thấy dấu "+" ở ô prompt — hãy Teach "Dấu + ở ô prompt" (CHỈ bấm vào dấu +)`); return false; }
      const how = (findMapped('promptPlus') && isGoodPlus(findMapped('promptPlus'))) ? 'đã teach' : 'tự dò';
      log(`${label}: bấm dấu "+" ở ô prompt (${how}: <${plus.tagName.toLowerCase()}> "${(plus.textContent || '').trim().slice(0, 12)}") để mở kho ảnh`);
      simulateRadixClick(plus);
      // Chờ panel mở (poll tới 5s) thay vì sleep cứng — tránh làm bước sau quá sớm.
      const opened = await waitUntil(() => isPlusPanelOpen() || !!findUploadInputInPanel(), 5000);
      log(`${label}: kho ảnh ${opened ? 'đã mở' : 'CHƯA chắc mở'} (chờ ${opened ? 'xong' : 'hết 5s'})`);
      await sleep(600); // đệm thêm cho panel vẽ xong
    }

    // (2) Tải ảnh lên kho qua input file (không bật hộp thoại OS).
    const fileInput = findUploadInputInPanel();
    if (!fileInput) { logWarn(`${label}: kho ảnh đã mở nhưng không thấy ô tải ảnh`); return false; }
    try {
      const blob = await dataUrlToBlob(imageDataUrl);
      const file = new File([blob], fileName || 'image.png', { type: blob.type });
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      log(`${label}: đã tải ảnh vào kho, chờ xử lý...`);
    } catch (e) { logWarn(`${label}: tải ảnh lỗi: ${e.message}`); return false; }

    // (3) CHỜ ảnh hiện trong kho (poll tới 8s) rồi mới bấm "Thêm vào câu lệnh" —
    //     bước này tách hẳn khỏi bước bấm "+" nên không bị đè nhau.
    await waitUntil(() => {
      const p = getOpenPanelContainer();
      return p && p.querySelector('img');
    }, 8000);
    await sleep(1200); // để ảnh xử lý/được chọn xong
    let added = clickAddToPrompt();
    if (!added) {
      const panel = getOpenPanelContainer();
      const im = panel.querySelector('img');
      if (im) {
        simulateRadixClick(im.closest('button,[role="option"],li,div') || im);
        await sleep(1200);
        added = clickAddToPrompt();
      }
    }
    if (added) await sleep(1500); // để Flow đính ảnh vào câu lệnh xong

    // (4) Đóng kho ảnh nếu còn mở để không che ô prompt.
    await sleep(1200);
    if (isPlusPanelOpen()) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await sleep(500);
    }
    return added;
  }

  // Open the asset panel. PREFER auto-detecting the "+" by its icon (reliable,
  // independent of any wrong taught mapping); fall back to the taught mapping.
  // Verify the panel actually opened (search box appears) after each attempt.
  async function openAssetPanel() {
    if (isAssetPanelOpen()) return true;

    const plus = getPromptPlusButton();
    if (plus) {
      log(`Mở panel: bấm nút "+" → <${plus.tagName.toLowerCase()}> "${(plus.textContent || plus.getAttribute('aria-label') || '').trim().slice(0, 15)}"`);
      simulateRadixClick(plus);
      await sleep(1500);
      if (isAssetPanelOpen()) return true;
    }

    logWarn('❌ Không mở được kho ảnh. Bấm 3 lần dòng "Dấu +" để xoá mapping nhầm rồi Teach lại CHỈ vào dấu +, HOẶC bấm 🔍 Quét UI gửi dev.');
    return false;
  }

  // Open the "+" panel, find an asset by NAME (search box), click its row,
  // then click "Thêm vào câu lệnh". If no name, picks the most-recent row.
  async function addAssetByName(name) {
    if (!(await openAssetPanel())) return false;

    // filter by name
    const search = getAssetSearchInput();
    if (search && name) {
      setNativeValue(search, name);
      await sleep(1600);
    }

    const panel = getAssetPanel() || document.querySelector('[role="dialog"],[data-radix-popper-content-wrapper]') || document.body;

    // click the first asset ROW (prefer one whose TÊN khớp — qua text HOẶC alt/title
    // của ảnh, vì Flow đặt nhãn ô trong kho theo tên file).
    let target = null;
    const nameLC = (name || '').toLowerCase();
    const rows = panel.querySelectorAll('[role="option"], li, [class*="item"], [class*="row"], [class*="card"], [class*="tile"], button, figure');
    for (const el of rows) {
      if (!isVisible(el)) continue;
      if (name) {
        const t = (el.textContent || '').trim().toLowerCase();
        let labels = t;
        el.querySelectorAll('img').forEach((im) => {
          labels += ' ' + (im.getAttribute('alt') || '') + ' ' + (im.getAttribute('title') || '');
        });
        if (labels.toLowerCase().includes(nameLC)) { target = el; break; }
      } else if (el.querySelector('img')) { target = el; break; }
    }
    // fallback: first visible thumbnail in the panel
    if (!target) {
      const im = panel.querySelector('img');
      if (im) target = im.closest('[role="option"], li, button, div') || im;
    }
    if (target) { simulateRadixClick(target); log(`Panel: chọn "${(target.textContent || '').trim().slice(0, 25) || 'ảnh'}"`); }
    else { logWarn(`Panel: không thấy mục "${name || ''}"`); }
    await sleep(1000);

    const ok = clickAddToPrompt();
    await sleep(1800);
    return ok;
  }

  // Đính ảnh NHÂN VẬT/SẢN PHẨM THEO TÊN (đúng ý người dùng đề xuất): tìm asset
  // trong KHO theo TÊN ở mục hiển thị → "Thêm vào câu lệnh". Nếu chưa có trong kho
  // → tải ảnh lên (đặt tên file = tên) rồi thêm. Cùng đường → kéo-thả. Mỗi bước
  // xác nhận bằng SỐ ẢNH trong câu lệnh tăng lên. KHÔNG cần AI: khớp bằng tên là đủ.
  async function attachNamedAsset(name, imageData, label) {
    const before = countPromptImages();
    const nm = (name || '').trim();

    // 1) CÁCH NGƯỜI DÙNG ĐÃ XÁC NHẬN (ảnh chụp): rê vào CARD nhân vật trong dự án
    //    (vd card "Hoà") → bấm "⋮" → "Thêm vào câu lệnh".
    if (nm) {
      log(`${label}: rê vào card "${nm}" → ⋮ → "Thêm vào câu lệnh"...`);
      await addViaCardMenu(nm);
      if (await waitCountAbove(before, 7000)) { log(`✅ ${label}: đã thêm từ card ⋮`); await sleep(1500); return true; }

      // 2) Nếu card không thấy → mở kho ("+"), TÌM THEO TÊN rồi "Thêm vào câu lệnh"
      log(`${label}: card không thấy — mở kho ảnh, tìm "${nm}" theo tên...`);
      await addAssetByName(nm);
      if (await waitCountAbove(before, 8000)) { log(`✅ ${label}: đã thêm theo tên từ kho`); await sleep(1500); return true; }
      logWarn(`${label}: chưa thấy "${nm}" trong kho — TẢI LÊN (tên file = "${nm}") rồi thêm`);
    }

    // 3) Chưa có trong kho → tải ảnh lên (tên = tên nhân vật/sản phẩm) rồi thêm
    if (imageData) {
      await addImageViaPlusPanel(imageData, `${nm || 'asset'}.png`, label);
      if (await waitCountAbove(before, 12000)) { log(`✅ ${label}: đã tải lên + thêm vào câu lệnh`); await sleep(1500); return true; }
      // 3) cùng đường → kéo-thả thẳng
      logWarn(`${label}: thử kéo-thả thẳng...`);
      await attachImageToPrompt(imageData, `${nm || 'asset'}.png`);
      if (await waitCountAbove(before, 8000)) { log(`✅ ${label}: đã kéo-thả vào câu lệnh`); await sleep(1500); return true; }
    }

    logWarn(`⚠️ ${label}: KHÔNG đưa được vào câu lệnh (cả theo-tên, tải-lên lẫn kéo-thả). Kiểm tra "+"/kho ảnh.`);
    return false;
  }

  // Upload a local keyframe to the library, then attach it via the panel.
  async function addImageViaPanel(dataUrl, fileName) {
    await uploadImageToFlow(dataUrl, fileName);
    await sleep(2800); // let the upload register in the library
    // search by the file's base name (strip extension) to find it in the list
    const base = (fileName || '').replace(/\.[a-z0-9]+$/i, '').slice(0, 20);
    return await addAssetByName(base || null);
  }

  // SIMPLE flow the user confirmed: hover a gallery card → its "⋮" appears →
  // click it → click "Thêm vào câu lệnh" in the menu. `name` matches the card's
  // label (filename or character name); else uses the first/most-recent card.
  async function addViaCardMenu(name) {
    // 1) find the card (has an <img> and, if name given, matching text)
    const cards = document.querySelectorAll('[class*="card"], [class*="tile"], [class*="item"], li, figure, [role="listitem"]');
    let card = null;
    for (const c of cards) {
      if (!isVisible(c) || !c.querySelector('img')) continue;
      const t = (c.textContent || '').trim().toLowerCase();
      if (name && t.includes(name.toLowerCase())) { card = c; break; }
    }
    if (!card && !name) {
      for (const c of cards) { if (isVisible(c) && c.querySelector('img')) { card = c; break; } }
    }
    if (!card) { logWarn(`Card: không thấy ảnh "${name || ''}"`); return false; }

    // 2) hover to reveal the "⋮"
    const img = card.querySelector('img');
    [card, img].forEach((el) => {
      if (!el) return;
      ['pointerover', 'mouseover', 'mouseenter', 'mousemove'].forEach((ev) =>
        el.dispatchEvent(new MouseEvent(ev, { bubbles: true })));
    });
    await sleep(700);

    // 3) find the "⋮" inside the card (icon "more_vert" / aria), else taught
    let dot = null;
    card.querySelectorAll('button, [role="button"]').forEach((b) => {
      if (!isVisible(b)) return;
      const t = (b.textContent || '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      if (t === 'more_vert' || t === '⋮' || t === 'more' ||
          aria.includes('more') || aria.includes('tùy chọn') || aria.includes('option') || aria.includes('thêm')) {
        dot = b;
      }
    });
    if (!dot) dot = findMapped('galleryMenu');
    if (!dot) { logWarn('Card: không thấy nút ⋮ (rê chuột vào ảnh) — Teach "Menu 3 chấm trên card"'); return false; }
    simulateRadixClick(dot);
    await sleep(900);

    // 4) click "Thêm vào câu lệnh" in the opened menu
    const add = findByText(['Thêm vào câu lệnh', 'Add to prompt']) || findMapped('addToPrompt');
    if (add) {
      simulateRadixClick(add);
      log(`Card: đã "Thêm vào câu lệnh" cho "${name || 'ảnh'}"`);
      await sleep(1500);
      return true;
    }
    logWarn('Card: mở menu nhưng không thấy "Thêm vào câu lệnh"');
    return false;
  }

  async function uploadImageToFlow(imageDataUrl, fileName) {
    if (!imageDataUrl) return false;
    log(`Uploading image: ${fileName || 'image'}`);

    // Strategy 1: Find file input and inject via DataTransfer
    const fileInput = DOM.getFileUploadInput();
    if (fileInput && fileInput.tagName === 'INPUT' && fileInput.type === 'file') {
      try {
        const blob = await dataUrlToBlob(imageDataUrl);
        const file = new File([blob], fileName || 'storyboard.png', { type: blob.type });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(1500);
        log('Image uploaded via file input');
        return true;
      } catch (e) {
        logWarn(`File input upload failed: ${e.message}`);
      }
    }

    // (Strategy 2 — drag-drop — đã GỠ: nó bật overlay "Thả nội dung nghe nhìn"
    //  gây loạn giao diện. Chỉ dùng file input + nút upload.)

    // Strategy 3: Click upload button/trigger
    const uploadBtn = DOM.getFileUploadInput();
    if (uploadBtn && uploadBtn.tagName !== 'INPUT') {
      simulateRadixClick(uploadBtn);
      await sleep(1000);
      // After click, look for the file input that appeared
      const newInput = document.querySelector('input[type="file"]');
      if (newInput) {
        try {
          const blob = await dataUrlToBlob(imageDataUrl);
          const file = new File([blob], fileName || 'storyboard.png', { type: blob.type });
          const dt = new DataTransfer();
          dt.items.add(file);
          newInput.files = dt.files;
          newInput.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(1500);
          log('Image uploaded via triggered file input');
          return true;
        } catch (e) {
          logWarn(`Triggered file input failed: ${e.message}`);
        }
      }
    }

    // Strategy 4: Use gallery "Add to prompt" flow
    // This requires the image to already be in the gallery
    logWarn('Direct image upload not available — image may need to be in gallery first');
    return false;
  }

  // Convert data URL to Blob
  function dataUrlToBlob(dataUrl) {
    return new Promise((resolve, reject) => {
      try {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        resolve(new Blob([u8arr], { type: mime }));
      } catch (e) {
        reject(e);
      }
    });
  }

  // ========================
  // MAIN QUEUE LOOP
  // ========================
  async function processQueue() {
    log(`=== QUEUE START: ${queue.length} prompts ===`);
    await applySettings();

    for (let i = currentIndex; i < queue.length; i++) {
      if (state === 'idle') return;
      while (state === 'paused') { await wait(1); if (state === 'idle') return; }

      currentIndex = i;
      const prompt = queue[i].trim();
      if (!prompt) { notify('SKIPPED', { reason: 'Empty', index: i }); continue; }

      log(`--- Prompt ${i + 1}/${queue.length}: "${prompt.substring(0, 50)}" ---`);
      notify('PROGRESS', { current: i + 1, total: queue.length, promptText: prompt });

      // Clear old prompt chip (Flow 2026 keeps old prompt after Create)
      await DOM.clearPromptBar();
      await sleep(500);

      // === NẠP ẢNH QUA input[type=file] (cách của các extension nổi tiếng) ===
      // Gom storyboard + sản phẩm + nhân-vật-có-ảnh (tối đa 3) rồi đặt .files của
      // input file MỘT lần → Flow nhận tất cả làm ảnh tham chiếu. KHÔNG kéo-thả,
      // KHÔNG popup, KHÔNG cần dạy DOM. Nếu input file lỗi → dự phòng kéo-thả.
      let attachedAny = false;
      const MAX_IMG = 3;
      const imgs = [];
      if (cfg.storyboard && cfg.storyboard[i]) {
        const sb = cfg.storyboard[i];
        if (sb.imageDataUrl) imgs.push({ data: sb.imageDataUrl, name: sb.fileName || `scene${i + 1}.png` });
        (Array.isArray(sb.extraImages) ? sb.extraImages : []).forEach((image, imageIndex) => {
          const data = image && (image.imageDataUrl || image.data);
          if (data) imgs.push({ data, name: image.fileName || image.name || `scene${i + 1}-${imageIndex + 2}.png` });
        });
      }
      (Array.isArray(cfg.productImages) ? cfg.productImages : []).forEach((ref, refIndex) => {
        if (!ref || !ref.data) return;
        const refName = String(ref.name || `reference ${refIndex + 1}.png`).trim();
        imgs.push({ data: ref.data, name: /\.[a-z0-9]+$/i.test(refName) ? refName : `${refName}.png` });
      });
      // nhân vật CÓ ẢNH (ưu tiên người được nhắc tên trong prompt)
      const charsImg = (cfg.charImages || []).filter((c) => c && c.data);
      const namedImg = charsImg.filter((c) => (c.name || '').trim());
      const mentionedImg = namedImg.filter((c) => promptMentions(prompt, c.name));
      [...(mentionedImg.length ? mentionedImg : namedImg), ...charsImg.filter((c) => !(c.name || '').trim())]
        .forEach((c) => imgs.push({ data: c.data, name: `${(c.name || 'character').trim()}.png` }));

      const useImgs = imgs.slice(0, MAX_IMG);
      if (useImgs.length) {
        const before = countPromptImages();
        logUI(`📎 Nạp ${useImgs.length} ảnh tham chiếu: ${useImgs.map((f) => f.name).join(', ')}`);
        await attachImagesViaFileInput(useImgs);
        let ok = await waitCountAtLeast(before + useImgs.length, 12000);
        if (!ok) {
          // dự phòng: kéo-thả gộp (1 lần) nếu input file không ăn
          logUI('Input file chưa ăn — thử kéo-thả gộp...', 'warning');
          await attachImagesViaDrop(useImgs);
          ok = await waitCountAtLeast(before + 1, 12000);
        }
        const got = countPromptImages() - before;
        attachedAny = got > 0;
        logUI(`${got > 0 ? '✅' : '⚠️'} Ảnh vào câu lệnh: ${got}/${useImgs.length}`, got > 0 ? 'success' : 'warning');
        const settleMs = Math.max(3000, (cfg.imageSettle || 5) * 1000);
        await sleep(settleMs);
      }

      // Nhân vật CÓ TÊN: chèn thêm @Tên vào prompt (Flow dùng asset theo tên) — bổ
      // trợ cho ảnh, giữ nhân vật nhất quán. Không đụng popup.
      const finalPrompt = buildPromptWithMentions(prompt);
      const namedC = (cfg.charImages || []).filter((c) => c && (c.name || '').trim());
      if (namedC.length) {
        logUI(`👤 Thêm tham chiếu tên: ${namedC.map((c) => '@' + c.name.trim().replace(/\s+/g, '')).join(' ')}`, 'info');
      }

      let injected = await injectPromptText(finalPrompt);
      if (!injected) {
        logUI('✍️ Gõ prompt lần 1 chưa ăn — thử lại sau 1.5s...', 'warning');
        await sleep(1500);
        injected = await injectPromptText(finalPrompt);
      }
      if (!injected) {
        notify('ERROR', { message: 'Cannot inject prompt text', index: i });
        continue;
      }
      logUI('✅ Đã gõ prompt vào ô', 'success');
      await sleep(1000);

      const submitted = await clickSubmit();
      if (!submitted) {
        notify('ERROR', { message: 'Cannot click submit', index: i });
        continue;
      }

      // Wait for generation
      notify('WAITING');
      const result = await waitForCompletion();
      if (result === 'stopped') return;
      if (result === 'timeout') {
        notify('ERROR', { message: 'Timeout', index: i });
        if (cfg.autoRetry) { notify('RETRYING'); await wait(cfg.retryDelay || 30); i--; continue; }
        continue;
      }

      notify('PROMPT_DONE', { index: i });
      if (cfg.autoDownload) await autoDownload(i);

      if (i < queue.length - 1 && cfg.delay > 0) {
        log(`Delay ${cfg.delay}s...`);
        for (let d = 0; d < cfg.delay; d++) {
          if (state === 'idle') return;
          while (state === 'paused') await wait(1);
          await wait(1);
        }
      }
    }

    state = 'idle';
    notify('QUEUE_DONE');
    log('=== QUEUE COMPLETED ===');
  }

  // ========================
  // MESSAGE LISTENER
  // ========================
  // ===== OMNI CHARACTER CREATION =====
  // Find a clickable element by its visible text (Vietnamese/English labels) —
  // lets the extension work WITHOUT teaching, since it can read the page text.
  // STRICT: only real buttons whose trimmed text EXACTLY equals a wanted label.
  // (Loose matching on span/div previously clicked random things — never again.)
  function findByText(texts) {
    if (!texts || !texts.length) return null;
    const wants = texts.map((s) => s.trim().toLowerCase());
    const els = document.querySelectorAll('button, [role="button"]');
    for (const el of els) {
      if (!isVisible(el)) continue;
      const t = (el.textContent || '').trim().toLowerCase();
      if (!t || t.length > 28) continue;
      if (wants.includes(t)) return el;
    }
    return null;
  }

  function findClickableByText(texts, opts = {}) {
    if (!texts || !texts.length) return null;
    const wants = texts.map((s) => s.trim().toLowerCase()).filter(Boolean);
    const exact = opts.exact !== false;
    const maxLen = opts.maxLen || 80;
    const els = document.querySelectorAll('button, [role="button"], [role="tab"], a, [tabindex], div, span, li');
    const preferLeft = !!opts.preferLeft;
    let fallback = null;
    for (const el of els) {
      if (!isVisible(el)) continue;
      const parts = [
        el.textContent || '',
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || ''
      ];
      const txt = parts.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!txt || txt.length > maxLen) continue;
      const ok = exact ? wants.includes(txt) : wants.some((w) => txt.includes(w));
      if (!ok) continue;
      const clickable = nearestClickable(el);
      if (!preferLeft) return clickable;
      const r = clickable.getBoundingClientRect();
      if (r.left < Math.max(260, window.innerWidth * 0.24)) return clickable;
      if (!fallback) fallback = clickable;
    }
    return fallback;
  }

  function textOf(el) {
    return `${(el && el.textContent) || ''} ${(el && el.getAttribute && el.getAttribute('aria-label')) || ''} ${(el && el.getAttribute && el.getAttribute('title')) || ''}`.replace(/\s+/g, ' ').trim();
  }

  function nearestClickable(el, opts = {}) {
    let n = el;
    for (let i = 0; i < 6 && n && n !== document.body; i++, n = n.parentElement) {
      const role = (n.getAttribute && n.getAttribute('role')) || '';
      const tag = n.tagName || '';
      const tabIndex = n.getAttribute && n.getAttribute('tabindex');
      const txt = textOf(n);
      const r = n.getBoundingClientRect();
      if (opts.compact && (txt.length > (opts.maxText || 120) || r.height > (opts.maxHeight || 90) || r.width > (opts.maxWidth || 360))) continue;
      let cursor = '';
      try { cursor = getComputedStyle(n).cursor || ''; } catch (e) {}
      if (tag === 'BUTTON' || tag === 'A' || role === 'button' || role === 'tab' || tabIndex === '0' || cursor === 'pointer' || typeof n.onclick === 'function') {
        return n;
      }
    }
    return el;
  }

  function hasVisibleText(texts) {
    return !!findClickableByText(texts, { exact: false, maxLen: 160 });
  }

  function leftSideCandidates() {
    const rows = [];
    document.querySelectorAll('button, [role="button"], [role="tab"], a, [tabindex], div, span, li').forEach((el) => {
      if (!isVisible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.left > Math.max(320, window.innerWidth * 0.28) || r.width < 20 || r.height < 12) return;
      const txt = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.replace(/\s+/g, ' ').trim();
      if (!txt || txt.length > 80) return;
      rows.push(describeEl ? describeEl(el) : txt.slice(0, 80));
    });
    return [...new Set(rows)].slice(0, 18);
  }

  async function waitForElement(getter, timeout = 12000, step = 300) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const el = getter();
      if (el && (!el.nodeType || isVisible(el))) return el;
      await sleep(step);
    }
    return null;
  }

  async function openCharacterLibrary() {
    // CHUẨN DUY NHẤT để coi là "đang ở mục Nhân vật": URL kết thúc bằng /characters.
    //   KHÔNG dựa vào việc thấy chữ "Nhân vật mới" — trang gốc "Tất cả nội dung" cũng có
    //   ô đó nên từng đánh lừa extension (bấm ô từ trang gốc không mở màn tạo nhân vật).
    const onCharacters = () => /\/characters(?:[/?#]|$)/.test(location.pathname);

    // Đang mở 1 nhân vật cụ thể → bấm nút back thật để thoát ra trước.
    if (/\/character\/[^/?#]+/.test(location.pathname)) {
      const back = findFlowBackButton();
      if (back) { simulateRadixClick(back); await sleep(1600); }
    }

    // Vào /characters bằng NHIỀU CÁCH leo thang (click giả có thể không ăn với link SPA):
    //   1) Link <a href="…/characters"> → click NATIVE (chắc nhất).
    //   2) Mục sidebar "Nhân vật" → click giả Radix.
    //   3) Mục sidebar → click native .click().
    //   4) pushState + popstate tới …/characters (Next.js router nghe popstate).
    const findCharactersLink = () => {
      for (const a of document.querySelectorAll('a[href]')) {
        if (!isVisible(a)) continue;
        if (/\/project\/[^/]+\/characters(?:[/?#]|$)/.test(a.getAttribute('href') || '')) return a;
      }
      return null;
    };
    const strategies = ['link', 'radix', 'native', 'pushstate'];
    for (const how of strategies) {
      if (onCharacters()) break;
      if (how === 'link') {
        const a = findCharactersLink();
        if (!a) { logUI('👤 (điều hướng) không thấy link /characters — thử cách khác…', 'info'); continue; }
        logUI('👤 (điều hướng) click NATIVE link /characters…', 'info');
        try { a.click(); } catch (e) {}
      } else if (how === 'radix' || how === 'native') {
        const nav = findSidebarItem(['Nhân vật', 'Characters']);
        if (!nav) { logUI(`👤 (điều hướng) không thấy mục "Nhân vật" sidebar. Bên trái: ${leftSideCandidates().join(' | ') || '(trống)'}`, 'warning'); continue; }
        logUI(`👤 (điều hướng) click ${how} mục "${(nav.textContent || '').trim().slice(0, 24)}"…`, 'info');
        try { how === 'radix' ? simulateRadixClick(nav) : nav.click(); } catch (e) {}
      } else {
        const m = location.pathname.match(/^(.*\/project\/[^/]+)/);
        if (!m) continue;
        logUI('👤 (điều hướng) pushState → /characters…', 'info');
        try {
          history.pushState({}, '', m[1] + '/characters');
          window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
        } catch (e) {}
      }
      await waitForElement(() => (onCharacters() ? document.body : null), 4500, 300);
    }
    if (!onCharacters()) {
      logUI(`👤 Đã thử 4 cách nhưng URL vẫn chưa vào /characters (đang ở …/${location.pathname.split('/').slice(-1)[0]}).`, 'warning');
      return false;
    }
    logUI('👤 Đã vào đúng mục Nhân vật (URL /characters) ✅', 'success');
    // Đã ở đúng mục Nhân vật → chờ ô "Nhân vật mới" render.
    const opened = await waitForElement(() => findClickableByText(['Nhân vật mới', 'New character'], { exact: false, maxLen: 160 }), 7000, 350);
    if (opened) return true;
    logUI('👤 Đang ở /characters nhưng chưa thấy ô "Nhân vật mới" — chờ thêm rồi thử lại.', 'warning');
    return false;
  }

  function findFlowBackButton() {
    const candidates = document.querySelectorAll('button, [role="button"], a, [tabindex]');
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left > 80 || r.top > 80 || r.width > 70 || r.height > 70) continue;
      const txt = textOf(el).toLowerCase();
      if (/back|quay lại|trở lại|arrow_back|←/.test(txt) || txt.length <= 4) return el;
    }
    return null;
  }

  function findSidebarItem(labels) {
    const wants = labels.map((s) => s.toLowerCase());
    const candidates = [];
    document.querySelectorAll('button, [role="button"], [role="tab"], a, [tabindex], div, span, li').forEach((el) => {
      if (!isVisible(el)) return;
      const r = el.getBoundingClientRect();
      if (r.left > Math.max(260, window.innerWidth * 0.23) || r.top < 60 || r.width < 20 || r.height < 12 || r.height > 80) return;
      const own = textOf(el).toLowerCase();
      if (!own || own.length > 80) return;
      const exact = wants.includes(own);
      const loose = wants.some((w) => new RegExp(`(^|\\s)${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i').test(own));
      if (!exact && !loose) return;
      const clickable = nearestClickable(el, { compact: true, maxText: 120, maxHeight: 90, maxWidth: 360 });
      const cr = clickable.getBoundingClientRect();
      if (cr.left > Math.max(280, window.innerWidth * 0.25) || cr.height > 100 || textOf(clickable).length > 140) return;
      candidates.push({ el: clickable, exact, top: cr.top, textLen: textOf(clickable).length });
    });
    candidates.sort((a, b) => (b.exact - a.exact) || (a.textLen - b.textLen) || (a.top - b.top));
    return candidates[0] && candidates[0].el;
  }

  // Click: ALWAYS prefer the taught mapping (precise); text is only a strict fallback.
  function clickSmart(key, texts) {
    const el = findMapped(key) || findByText(texts || []) || findClickableByText(texts || [], { exact: false, maxLen: 120 });
    if (!el) { logWarn(`Char: không tìm thấy "${key}" (hãy Teach lại nút này)`); return false; }
    log(`Char: click "${key}" → "${(el.textContent || '').trim().substring(0, 20)}"`);
    simulateRadixClick(el);
    return true;
  }

  // Upload the portrait without opening the OS file picker: set files on an
  // existing hidden input if Flow exposes one; otherwise simulate drag/drop.
  async function setFilesOnInput(input, dataUrl, fileName) {
    if (!input) return false;
    try {
      const blob = await dataUrlToBlob(dataUrl);
      const file = new File([blob], fileName || 'char.png', { type: blob.type });
      const dt = new DataTransfer();
      dt.items.add(file);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files').set;
      setter.call(input, dt.files);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      log('Char: đã nạp ảnh qua input[type=file] ẩn');
      return true;
    } catch (e) {
      logWarn(`Char input upload failed: ${e.message}`);
      return false;
    }
  }

  function findCharacterUploadTrigger() {
    return findMapped('charUpload') ||
      findClickableByText(['Tải lên', 'Upload'], { exact: true, maxLen: 50 }) ||
      findClickableByText(['Tải lên', 'Upload'], { exact: false, maxLen: 90 });
  }

  function findCharacterAddFromProjectTrigger() {
    return findClickableByText(['Thêm từ dự án', 'Add from project'], { exact: true, maxLen: 80 }) ||
      findClickableByText(['Thêm từ dự án', 'Add from project'], { exact: false, maxLen: 120 });
  }

  function isInsidePromptScope(el) {
    const scope = getPromptScope && getPromptScope();
    return !!(scope && el && (scope === el || scope.contains(el)));
  }

  function rectDistance(a, b) {
    const ac = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
    const bc = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    return Math.hypot(ac.x - bc.x, ac.y - bc.y);
  }

  function findCharacterFileInput(trigger) {
    const inputs = [...document.querySelectorAll('input[type="file"]')]
      .filter((i) => !i.accept || /image|\*|jpeg|jpg|png|webp/i.test(i.accept));
    if (!inputs.length) return null;
    if (!trigger) return null;
    const tr = trigger.getBoundingClientRect();
    let best = null, bestD = Infinity;
    for (const input of inputs) {
      if (isInsidePromptScope(input)) continue;
      let host = input, r = input.getBoundingClientRect(), hop = 0;
      while ((r.width === 0 || r.height === 0) && host.parentElement && hop < 7) {
        host = host.parentElement;
        r = host.getBoundingClientRect();
        hop++;
      }
      if (isInsidePromptScope(host)) continue;
      const d = rectDistance(r, tr);
      if (d > 420 && !trigger.contains(input) && !(host.contains && host.contains(trigger)) && !(trigger.contains && trigger.contains(input))) continue;
      if (d < bestD) { best = input; bestD = d; }
    }
    return best;
  }

  function findCharacterDropTargets(trigger) {
    const targets = [];
    const add = (el) => {
      if (!el || !isVisible(el) || isInsidePromptScope(el)) return;
      const r = el.getBoundingClientRect();
      if (r.width < 80 || r.height < 30) return;
      const txt = textOf(el).toLowerCase();
      const isCharacterArea = /tải lên|upload|tạo và sử dụng|mô tả nhân vật|nhân vật mới|create and reuse|describe your character/.test(txt);
      const nearTrigger = trigger && rectDistance(r, trigger.getBoundingClientRect()) < 520;
      if (isCharacterArea || nearTrigger) targets.push(el);
    };
    add(trigger);
    if (trigger) {
      add(trigger.closest('button, [role="button"], [tabindex]'));
      add(trigger.closest('label'));
      add(trigger.closest('section'));
      add(trigger.closest('main'));
      let n = trigger.parentElement;
      for (let i = 0; i < 5 && n; i++, n = n.parentElement) add(n);
    }
    document.querySelectorAll('main section, main div, [role="main"] div').forEach((el) => {
      const txt = textOf(el).toLowerCase();
      if (/tải lên|upload|thả|drop|mô tả nhân vật|describe your character/.test(txt)) add(el);
    });
    return [...new Set(targets)].slice(0, 8);
  }

  function isCharacterImageMissing() {
    return hasVisibleText([
      'Tạo hoặc thêm hình ảnh nhân vật',
      'Create or add character images',
      'Add character images',
      'Thêm hình ảnh nhân vật'
    ]);
  }

  function hasLikelyCharacterMediaPreview() {
    const nodes = document.querySelectorAll('main img, main video, [role="main"] img, [role="main"] video');
    for (const el of nodes) {
      if (!isVisible(el) || isInsidePromptScope(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width >= 140 && r.height >= 100 && r.left > 250 && r.top > 80) return true;
    }
    return false;
  }

  async function waitForCharacterPortraitAccepted(timeout = 45000) {
    const accepted = await waitForElement(() => {
      // TÍN HIỆU CHẮC NHẤT: Flow chuyển sang trang chi tiết /character/<id> sau khi nhận ảnh.
      if (/\/character\/[0-9a-f-]{16,}/i.test(location.pathname)) return document.body;
      if (hasLikelyCharacterMediaPreview() && !isCharacterImageMissing()) return document.body;
      if (!isCharacterImageMissing() && isCharacterDetailPage()) return document.body;
      return null;
    }, timeout, 700);
    return !!accepted;
  }

  async function dropCharImage(dataUrl, fileName, trigger) {
    try {
      const blob = await dataUrlToBlob(dataUrl);
      const file = new File([blob], fileName || 'char.png', { type: blob.type });
      const dt = new DataTransfer();
      dt.items.add(file);
      // CHỈ thả vào 1 vùng tốt nhất và chờ ĐỦ LÂU (upload thật mất ~10-15s). Mỗi cú thả
      //   là 1 lần upload tạo entity — thả nhiều vùng liên tiếp từng sinh 5 nhân vật rác.
      const targets = findCharacterDropTargets(trigger).slice(0, 1);
      for (const target of targets) {
        const r = target.getBoundingClientRect();
        const opts = {
          bubbles: true,
          cancelable: true,
          composed: true,
          clientX: r.left + Math.max(4, r.width / 2),
          clientY: r.top + Math.max(4, r.height / 2),
          dataTransfer: dt
        };
        target.dispatchEvent(new DragEvent('dragenter', opts));
        await sleep(120);
        target.dispatchEvent(new DragEvent('dragover', opts));
        await sleep(120);
        target.dispatchEvent(new DragEvent('drop', opts));
        if (await waitForCharacterPortraitAccepted(30000)) {
          log('Char: ảnh đã vào qua kéo-thả ẩn');
          return true;
        }
      }
      logWarn('Char: kéo-thả ẩn chưa làm Flow chuyển sang trang chi tiết');
      return false;
    } catch (e) {
      logWarn(`Char drop upload failed: ${e.message}`);
      return false;
    }
  }

  // Mọi input[type=file] nhận ảnh trên trang (không lọc theo khoảng cách) — dùng khi
  //   không tìm được input gần trigger (hay gặp ở nhân vật thứ 2: Flow render lại,
  //   input cũ biến mất/đổi chỗ). Thử lần lượt từng cái.
  function allCharacterImageInputs() {
    return [...document.querySelectorAll('input[type="file"]')]
      .filter((i) => !isInsidePromptScope(i) && (!i.accept || /image|\*|jpeg|jpg|png|webp/i.test(i.accept)));
  }

  // ĐƯỜNG CỨU: về lưới Nhân vật, bấm vào tile "Nhân vật chưa có tên"/"Untitled Character"
  //   (ảnh đã upload tạo entity nhưng Flow không tự mở trang chi tiết) → vào /character/<id>
  //   để đặt tên/voice tiếp như bình thường.
  async function openUntitledCharacterTile() {
    const inLib = await openCharacterLibrary();
    if (!inLib) return false;
    await sleep(800);
    const tile = findClickableByText(['Nhân vật chưa có tên', 'Untitled Character'], { exact: false, maxLen: 90 });
    if (!tile) { logUI('👤 Không thấy "Nhân vật chưa có tên" nào trong lưới.', 'warning'); return false; }
    simulateRadixClick(tile);
    let ok = await waitForElement(() => (/\/character\/[0-9a-f-]{16,}/i.test(location.pathname) ? document.body : null), 8000, 300);
    if (!ok) { try { tile.click(); } catch (e) {} ok = await waitForElement(() => (/\/character\/[0-9a-f-]{16,}/i.test(location.pathname) ? document.body : null), 6000, 300); }
    return !!ok;
  }

  async function uploadCharImage(dataUrl, fileName) {
    if (!dataUrl) return false;
    // CHỐT AN TOÀN: chỉ đưa ảnh khi ĐANG ở màn tạo/chi tiết nhân vật thật. Sai màn →
    //   từ chối ngay, không thả ảnh bừa (tránh sinh "Nhân vật chưa có tên" rác).
    if (!isCharacterImageMissing() && !isNewCharacterCreationPage() && !isCharacterDetailPage()) {
      logUI('🛑 Không ở màn tạo nhân vật — từ chối đưa ảnh để tránh tạo nhân vật rác.', 'warning');
      return false;
    }
    log('Char: thử nạp ảnh vào đúng màn Nhân vật của Flow');
    // MỖI CÁCH CHỈ THỬ 1 LẦN, chờ đủ lâu (upload thật ~10-15s). Không lặp vòng — mỗi lần
    //   đưa ảnh là 1 lần upload tạo entity, lặp 4 vòng từng sinh 5 "Nhân vật chưa có tên".
    const trigger = findCharacterUploadTrigger();

    // 1) Set file lên input gần nút "Tải lên" (giống người chọn file — chuẩn nhất).
    const nearInput = findCharacterFileInput(trigger);
    if (nearInput && await setFilesOnInput(nearInput, dataUrl, fileName)) {
      if (await waitForCharacterPortraitAccepted(30000)) return true;
      logWarn('Char: input gần "Tải lên" đã nhận file nhưng chưa thấy trang chi tiết.');
      return false; // ảnh có thể đã upload — để đường CỨU xử lý, không đổ thêm ảnh.
    }

    // 2) Không có input → kéo-thả ẩn vào 1 vùng tốt nhất.
    if (await dropCharImage(dataUrl, fileName, trigger)) return true;

    // 3) Cuối cùng: 1 input ảnh bất kỳ trên trang (1 cái duy nhất).
    const anyInput = allCharacterImageInputs()[0];
    if (anyInput && anyInput !== nearInput && await setFilesOnInput(anyInput, dataUrl, fileName)) {
      if (await waitForCharacterPortraitAccepted(30000)) return true;
    }
    return false;
  }

  async function addCharacterImageFromProject(name) {
    const addFromProject = findCharacterAddFromProjectTrigger();
    if (!addFromProject) return false;
    log('Char: thử lấy ảnh từ mục "Thêm từ dự án"');
    simulateRadixClick(addFromProject);
    await sleep(1800);

    const panel = document.querySelector('[role="dialog"], [role="listbox"], [data-radix-popper-content-wrapper], [class*="Dialog"], [class*="modal"]') || document.body;
    const want = String(name || '').trim().toLowerCase();
    let target = null;
    const items = panel.querySelectorAll('[role="option"], [role="gridcell"], [role="listitem"], li, button, figure, [class*="card"], [class*="tile"], [class*="item"]');
    for (const item of items) {
      if (!isVisible(item) || !item.querySelector('img, video')) continue;
      const label = [
        item.textContent || '',
        ...[...item.querySelectorAll('img')].map((im) => `${im.getAttribute('alt') || ''} ${im.getAttribute('title') || ''}`)
      ].join(' ').toLowerCase();
      if (want && label.includes(want)) { target = item; break; }
      if (!target) target = item;
    }
    if (!target) {
      const img = panel.querySelector('img, video');
      if (img) target = img.closest('[role="option"], [role="gridcell"], [role="listitem"], li, button, figure, div') || img;
    }
    if (!target) {
      logWarn('Char: mở "Thêm từ dự án" nhưng không thấy ảnh nào để chọn');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    }

    simulateRadixClick(target);
    await sleep(1000);
    const confirm = findByText(['Thêm vào nhân vật', 'Add to character', 'Chọn', 'Select', 'Done', 'Xong']);
    if (confirm) {
      simulateRadixClick(confirm);
      await sleep(1200);
    }
    const ok = await waitForCharacterPortraitAccepted(30000);
    if (ok) {
      log('Char: đã thêm ảnh nhân vật từ dự án');
      return true;
    }
    logWarn('Char: đã chọn ảnh từ dự án nhưng Flow chưa gắn vào nhân vật');
    return false;
  }

  // Set the character name — ONLY the taught name field. Selection is scoped to
  // that element (never document-wide selectAll, which highlighted the page).
  function setEditableValue(el, value) {
    if (!el) return false;
    try {
      el.focus();
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        try { el.blur(); } catch (e) {}
        return true;
      }
      if (el.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.getAttribute('role') === 'textbox') {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        sel.removeAllRanges();
        sel.addRange(range);
        const ok = document.execCommand && document.execCommand('insertText', false, value);
        if (!ok || (el.textContent || '').trim() !== value) el.textContent = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        sel.removeAllRanges();
        try { el.blur(); } catch (e) {}
        return true;
      }
    } catch (e) {
      logWarn(`Set editable failed: ${e.message}`);
    }
    return false;
  }

  function findUntitledCharacterTitle() {
    const els = document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"], h1, h2, [class*="title"], [class*="Title"]');
    for (const el of els) {
      if (!isVisible(el)) continue;
      const txt = ((el.value || el.textContent || '') + ' ' + (el.getAttribute('aria-label') || '')).trim().toLowerCase();
      if (/nhân vật chưa có tên|tên nhân vật|untitled character|unnamed character|new character|character name/.test(txt)) return el;
    }
    return null;
  }

  function findEditButtonNear(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const buttons = document.querySelectorAll('button, [role="button"]');
    let best = null;
    let bestDist = Infinity;
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      const br = b.getBoundingClientRect();
      if (br.top < r.top - 30 || br.top > r.bottom + 40) continue;
      if (br.left < r.left || br.left > r.right + 120) continue;
      const label = `${b.textContent || ''} ${b.getAttribute('aria-label') || ''} ${b.getAttribute('title') || ''}`.toLowerCase();
      const looksEdit = /edit|rename|sửa|đổi tên|pencil|chỉnh/.test(label) || br.width <= 48;
      if (!looksEdit) continue;
      const dist = Math.abs(br.left - r.right) + Math.abs(br.top - r.top);
      if (dist < bestDist) { best = b; bestDist = dist; }
    }
    return best;
  }

  async function setCharacterName(name) {
    const el = findMapped('charName'); // taught only — guessing the name field is unsafe
    if (!el) {
      const title = findUntitledCharacterTitle();
      if (setEditableValue(title, name)) {
        log('Char: đã đặt tên trực tiếp trên tiêu đề');
        return true;
      }
      const edit = findEditButtonNear(title);
      if (edit) {
        simulateRadixClick(edit);
        await sleep(500);
        const active = document.activeElement;
        if (setEditableValue(active, name)) {
          log('Char: đã đặt tên qua nút bút chì');
          return true;
        }
        const input = document.querySelector('input:focus, textarea:focus, [contenteditable="true"]:focus, [role="textbox"]:focus');
        if (setEditableValue(input, name)) {
          log('Char: đã đặt tên qua ô edit đang focus');
          return true;
        }
      }
      logWarn('Char: không tự tìm được ô TÊN/tiêu đề để đặt tên');
      return false;
    }
    try {
      await sleep(150);
      return setEditableValue(el, name);
    } catch (e) {
      logWarn(`Char name set failed: ${e.message}`);
      return false;
    }
  }

  function findCharacterVoiceControl() {
    const taught = findMapped('charVoice');
    if (taught && isVisible(taught)) return taught;
    const wants = ['voice', 'giọng', 'giọng nói'];
    const els = document.querySelectorAll('button, [role="button"], [role="combobox"], select, input, [aria-haspopup]');
    for (const el of els) {
      if (!isVisible(el)) continue;
      const txt = [
        el.textContent || '',
        el.getAttribute('aria-label') || '',
        el.getAttribute('placeholder') || '',
        el.getAttribute('name') || '',
        el.id || '',
      ].join(' ').toLowerCase();
      if (wants.some((w) => txt.includes(w))) return el;
    }
    return null;
  }

  function findVoiceOption(voice) {
    const name = String((voice && voice.name) || voice || '').trim().toLowerCase();
    const id = String((voice && voice.id) || '').trim().toLowerCase();
    if (!name || id === 'auto') return null;
    const groups = [
      document.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"], button, li'),
      document.querySelectorAll('div, span')
    ];
    for (const items of groups) {
      for (const item of items) {
        if (!isVisible(item)) continue;
        const raw = (item.textContent || '').trim();
        if (!raw || raw.length > 80) continue;
        const txt = raw.toLowerCase();
        const aria = (item.getAttribute && (item.getAttribute('aria-label') || '')).toLowerCase();
        const label = `${txt} ${aria}`;
        if (label.includes(name) || (id && label.includes(id))) return item;
      }
    }
    return null;
  }

  async function setCharacterVoice(voice) {
    if (!voice || voice.id === 'auto') {
      log('Char: voice Auto — bỏ qua chọn voice trong form');
      return true;
    }
    const control = findCharacterVoiceControl();
    if (!control) {
      logWarn('Char: chưa thấy dropdown Voice. Nếu Flow có voice, hãy Teach "Dropdown Voice nhân vật".');
      return false;
    }
    try {
      if (control.tagName === 'SELECT') {
        const opts = [...control.options];
        const found = opts.find((o) => (o.textContent || '').toLowerCase().includes(String(voice.name || '').toLowerCase()) ||
          (o.value || '').toLowerCase().includes(String(voice.id || '').toLowerCase()));
        if (found) {
          control.value = found.value;
          control.dispatchEvent(new Event('change', { bubbles: true }));
          log(`Char: đã chọn voice "${voice.name}" qua select`);
          return true;
        }
      }
      simulateRadixClick(control);
      await sleep(800);
      const option = findVoiceOption(voice);
      if (option) {
        simulateRadixClick(option);
        log(`Char: đã chọn voice "${voice.name}"`);
        await sleep(700);
        const addVoice = await waitForElement(() => findByText(['Thêm vào nhân vật', 'Add to character', 'Add voice to character']), 3000, 250);
        if (addVoice) {
          simulateRadixClick(addVoice);
          log('Char: đã bấm "Thêm vào nhân vật" cho voice');
          await sleep(900);
        }
        return true;
      }
      logWarn(`Char: mở voice dropdown nhưng không thấy option "${voice.name}"`);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return false;
    } catch (e) {
      logWarn(`Char voice set failed: ${e.message}`);
      return false;
    }
  }

  function isNewCharacterCreationPage() {
    const upload = findClickableByText(['Tải lên', 'Upload'], { exact: true, maxLen: 40 }) ||
      findClickableByText(['Tải lên', 'Upload'], { exact: false, maxLen: 80 });
    if (!upload) return false;
    return hasVisibleText([
      'Tạo và sử dụng lại các nhân vật',
      'Mô tả nhân vật',
      'Thêm từ dự án',
      'Create and reuse characters',
      'Describe your character',
      'Add from project'
    ]);
  }

  function isCharacterDetailPage() {
    return !!(findUntitledCharacterTitle() || findCharacterVoiceControl() || findByText(['Xong', 'Done', 'Hoàn tất']));
  }

  // Create characters in Flow: for each, open new-char → upload image → name → voice → Done.
  async function setupCharacters(characters) {
    if (!Array.isArray(characters) || !characters.length) {
      notify('ERROR', { message: 'Không có nhân vật để nạp' });
      return;
    }
    try { window.getSelection().removeAllRanges(); } catch (e) {} // clear any stray selection
    const createdEntities = [];
    const readCurrentCharacterEntityId = () => {
      const values = [location.pathname, location.href];
      try {
        document.querySelectorAll('a[href*="/character/"]').forEach((a) => values.push(a.href || ''));
      } catch (e) {}
      for (const value of values) {
        const m = /\/character\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(String(value || ''));
        if (m) return m[1];
      }
      return '';
    };
    for (let i = 0; i < characters.length; i++) {
      const c = characters[i];
      notify('CHAR_PROGRESS', { current: i + 1, total: characters.length, name: c.name || '', voice: c.voice?.name || 'Auto' });
      log(`--- Nhân vật ${i + 1}/${characters.length}: ${c.name || '(chưa tên)'} | voice ${c.voice?.name || 'Auto'} ---`);

      if (i === 0) logUI('🏷️ Quy trình nhân vật bản 2026-07-11G (nếu không thấy dòng này = code cũ, hãy Reload extension + F5).', 'info');
      // MỌI nhân vật đi CÙNG 1 quy trình (đúng như nhân vật 1 đã chạy tốt):
      //   về lưới Nhân vật → bấm ô "Nhân vật mới" → CHỜ ĐÚNG màn "Tạo hoặc thêm hình ảnh
      //   nhân vật" mở ra → mới đưa ảnh. Nếu màn không mở → thử lại; vẫn không → DỪNG,
      //   TUYỆT ĐỐI không đổ ảnh bừa (tránh sinh "Nhân vật chưa có tên" vô định).
      logUI(`🔎 [${i + 1}] Bắt đầu — path=…/${location.pathname.split('/').slice(-2).join('/')}`, 'info');
      let creationReady = false;
      for (let attempt = 1; attempt <= 3 && !creationReady; attempt++) {
        const inLibrary = await openCharacterLibrary();
        logUI(`🔎 [${i + 1}] (lần ${attempt}) openCharacterLibrary=${inLibrary} · path=…/${location.pathname.split('/').slice(-2).join('/')}`, 'info');
        if (!inLibrary) { await sleep(1200); continue; }
        await sleep(800);
        const clicked = clickSmart('charNew', ['Nhân vật mới', 'New character']);
        logUI(`🔎 [${i + 1}] (lần ${attempt}) Bấm ô "Nhân vật mới"=${clicked}`, 'info');
        if (!clicked) { await sleep(1200); continue; }
        // CHỜ NGHIÊM NGẶT: chỉ chấp nhận màn "thêm ảnh nhân vật" hoặc trang tạo/chi tiết
        //   nhân vật thật — KHÔNG chấp nhận "có input ảnh đâu đó trên trang" như trước.
        creationReady = !!(await waitForElement(() => isCharacterImageMissing() || isNewCharacterCreationPage() || isCharacterDetailPage(), 10000, 400));
        logUI(`🔎 [${i + 1}] (lần ${attempt}) Màn tạo nhân vật mở=${creationReady} · cần ảnh=${isCharacterImageMissing()} · path=…/${location.pathname.split('/').slice(-2).join('/')}`, creationReady ? 'success' : 'warning');
      }
      if (!creationReady) {
        logUI(`👤 [${i + 1}] Màn tạo nhân vật không mở sau 3 lần — DỪNG, không đưa ảnh để tránh tạo nhân vật rác.`, 'error');
        notify('ERROR', { message: 'Không mở được màn tạo nhân vật mới' });
        return;
      }
      await sleep(800);

      // Upload the face image. Flow can show the character detail shell before
      // the portrait exists, so check the portrait state separately.
      const needsPortrait = isCharacterImageMissing() || !hasLikelyCharacterMediaPreview();
      logUI(`🔎 [${i + 1}] Cần đưa ảnh=${needsPortrait} — bắt đầu đưa ảnh…`, 'info');
      if (needsPortrait) {
        const uploaded = await uploadCharImage(c.imageDataUrl, c.fileName || `${c.name || 'char'}.png`) ||
          await addCharacterImageFromProject(c.name || '');
        logUI(`🔎 [${i + 1}] Kết quả đưa ảnh=${uploaded}`, uploaded ? 'success' : 'warning');
        if (uploaded) {
          await waitForElement(() => findUntitledCharacterTitle() || findCharacterVoiceControl() || findByText(['Xong', 'Done', 'Hoàn tất']), 45000, 800);
          await sleep(1200); // wait for Flow to settle after the portrait
        }
      }
      if (!isCharacterDetailPage()) {
        // ĐƯỜNG CỨU: ảnh thường ĐÃ upload thành công (Flow tạo "Nhân vật chưa có tên")
        //   nhưng không tự mở trang chi tiết. Về lưới, bấm vào chính nhân vật chưa có
        //   tên đó để vào trang chi tiết rồi đặt tên/voice như bình thường.
        logUI(`👤 [${i + 1}] Trang chi tiết chưa mở — tìm "Nhân vật chưa có tên" trong lưới để đặt tên/voice…`, 'warning');
        const rescued = await openUntitledCharacterTile();
        logUI(`🔎 [${i + 1}] Mở "Nhân vật chưa có tên"=${rescued} · path=…/${location.pathname.split('/').slice(-2).join('/')}`, rescued ? 'success' : 'error');
        if (!rescued) {
          notify('ERROR', { message: 'Chưa mở được trang chi tiết nhân vật để gán tên/voice' });
          return;
        }
        await sleep(1000);
      }

      if (c.name) {
        const named = await setCharacterName(c.name);
        if (!named) logUI(`👤 Chưa đặt được tên nhân vật "${c.name}".`, 'warning');
        await sleep(600);
      }

      if (c.voice && c.voice.id && c.voice.id !== 'auto') {
        const voiced = await setCharacterVoice(c.voice);
        if (!voiced) logUI(`👤 Chưa gán được voice "${c.voice.name || c.voice.id}" cho nhân vật.`, 'warning');
        await sleep(600);
      }

      const entityId = readCurrentCharacterEntityId();
      if (entityId) {
        createdEntities.push({
          entityId,
          name: c.name || '',
          voiceId: c.voice?.id || '',
          voiceName: c.voice?.name || '',
        });
        logUI(`👤 Đã ghi entityId nhân vật "${c.name || ''}" → ${entityId.slice(0, 8)}…`, 'success');
      } else {
        logUI('👤 Chưa đọc được entityId từ URL nhân vật; video entity có thể cần bắt lại API entity.', 'warning');
      }

      // "Xong" chỉ để THOÁT màn — nhân vật đã lưu (ảnh + tên + voice). Không thấy nút thì
      //   tự điều hướng về lưới, KHÔNG dừng cả quy trình (tránh kẹt ở nhân vật thứ 2).
      if (!clickSmart('charDone', ['Xong', 'Done', 'Hoàn tất'])) {
        logUI('👤 Không thấy nút "Xong" — tự thoát về danh sách Nhân vật để làm tiếp.', 'warning');
        try { const t = location.href.replace(/\/character\/[^/?#]+/, '/characters'); if (t !== location.href) { history.pushState({}, '', t); window.dispatchEvent(new PopStateEvent('popstate', { state: history.state })); } } catch (e) {}
      }
      await sleep(2000);
    }
    notify('CHAR_DONE', { count: characters.length, entities: createdEntities });
    log('✅ Đã nạp xong nhân vật');
  }

  function setupCharactersByApi(characters) {
    if (!Array.isArray(characters) || !characters.length) {
      notify('ERROR', { message: 'Không có nhân vật để nạp' });
      return;
    }
    chrome.storage.local.get(['afCharacterTemplate', 'afSessionTemplate', 'afApiTemplate', 'afUploadTemplate', 'afPollTemplate', 'afLatestProjectId'], (data) => {
      let template = data.afCharacterTemplate;
      const urlPid = getProjectIdFromUrl();
      const stored = latestProjectIdFromStore(data);
      const pid = urlPid || stored.id;
      if (template && isUploadApiUrl(template.url)) {
        chrome.storage.local.remove('afCharacterTemplate');
        template = null;
        logUI('👤 Mẫu nhân vật cũ là API tải ảnh nên mình bỏ qua; sẽ dùng luồng entity trực tiếp.', 'warning');
      }
      if (template && !looksLikeCharacterPayload(template)) {
        chrome.storage.local.remove('afCharacterTemplate');
        template = null;
        logUI('👤 Mẫu nhân vật cũ bị học nhầm nên mình bỏ qua; sẽ dùng cấu trúc entity đã bắt từ trace mới.', 'warning');
      }
      if (!pid) {
        logUI('👤 Chưa có projectId. Mở đúng project Flow rồi thử lại.', 'warning');
        notify('ERROR', { message: 'Chưa có projectId để nạp nhân vật' });
        return;
      }
      logUI(`👤 Nạp ${characters.length} nhân vật bằng API ẩn · project ${pid.slice(0, 8)}…`, 'info');
      window.postMessage({ __afCreateCharacters: true, projectId: pid, template: template || {}, characters }, '*');
    });
  }

  // Đọc entityId nhân vật ĐANG mở từ URL / link /character/<uuid> trên trang.
  function readCharacterEntityIdFromDom() {
    const values = [location.pathname, location.href];
    try { document.querySelectorAll('a[href*="/character/"]').forEach((a) => values.push(a.href || '')); } catch (e) {}
    for (const value of values) {
      const m = /\/character\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(String(value || ''));
      if (m) return m[1];
    }
    return '';
  }

  // Cầu nối chờ inject gắn ảnh + voice cho 1 entity (attachCharacterViaApi → 'charAttachResult').
  let _afCharAttachWaiter = null;
  function attachCharacterViaApiBridge(entityId, character, projectId, timeoutMs = 90000) {
    return new Promise((resolve) => {
      if (_afCharAttachWaiter) { _afCharAttachWaiter({ ok: false, error: 'huỷ do yêu cầu mới' }); }
      const timer = setTimeout(() => { _afCharAttachWaiter = null; resolve({ ok: false, error: 'timeout' }); }, timeoutMs);
      _afCharAttachWaiter = (res) => { clearTimeout(timer); _afCharAttachWaiter = null; resolve(res); };
      window.postMessage({ __afAttachCharacter: true, projectId, entityId, character }, '*');
    });
  }

  // KẾT HỢP DOM + API: bấm nút "Nhân vật mới" THẬT (Flow tạo entity + cho entityId thật)
  //   → đọc entityId → API gắn ảnh + tên/voice vào entity đó (không kéo-thả ảnh nữa nên
  //   không kẹt ở nhân vật thứ 2). Nếu API gắn ảnh lỗi → lùi về upload ảnh kiểu DOM.
  // Nút "+" trên thanh header (ENTRY_POINT=HEADER_ADD_MENU) → mở menu → chọn "Nhân vật".
  //   Nút icon không có nhãn ổn định nên: THỬ LẦN LƯỢT các nút icon ở góc phải trên, nút
  //   nào bấm ra menu CÓ mục "Nhân vật" thì đúng là "+". Xác minh bằng kết quả, không đoán.
  function pickCharacterMenuItem() {
    // CHỈ tìm trong MENU POPUP đang mở (radix popper/role=menu) — tuyệt đối không đụng
    //   sidebar trái hay các nút khác trên trang.
    const popups = document.querySelectorAll('[data-radix-popper-content-wrapper], [role="menu"], [role="listbox"], [data-state="open"][role="dialog"]');
    for (const popup of popups) {
      if (!isVisible(popup)) continue;
      const items = popup.querySelectorAll('[role="menuitem"], [role="option"], button, a, [data-radix-collection-item]');
      for (const el of items) {
        if (!isVisible(el)) continue;
        const t = (el.textContent || '').trim().toLowerCase();
        if (!t || t.length > 40) continue;
        if (/(nhân vật|nhan vat|character)/.test(t) && !/(tất cả|all|xoá|xóa|delete)/.test(t)) return el;
      }
    }
    return null;
  }
  async function clickHeaderAddCharacter() {
    // TUYỆT ĐỐI KHÔNG bấm thử bừa. Nút "+" của Flow là icon Material ligature: text icon
    //   là "add" (dấu "?" là "help"). Tìm ĐÍCH DANH nút có icon "add" ở thanh trên cùng.
    let plus = null;
    for (const el of document.querySelectorAll('button, [role="button"]')) {
      if (!isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top > 100 || r.width > 90 || r.height > 90) continue; // chỉ thanh header
      const txt = (el.textContent || '').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      // Icon ligature "add"/"add_2"/"add_circle" hoặc aria-label thêm/tạo mới.
      if (/^(add|add_2|add_circle)$/.test(txt) || /^\+$/.test(txt) || /(^|\s)(add|thêm|them|tạo mới|tao moi|create|new)(\s|$)/.test(aria)) { plus = el; break; }
    }
    if (!plus) { logUI('👤 Không tìm thấy nút "+" (icon "add") trên header — không bấm gì.', 'warning'); return false; }
    logUI('👤 Bấm nút "+" (icon add) trên header…', 'info');
    simulateRadixClick(plus);
    await sleep(1000);
    // Menu "+" mở ra → chọn đúng mục "Nhân vật" TRONG MENU (không đụng sidebar).
    const item = pickCharacterMenuItem();
    if (!item) {
      logUI('👤 Menu "+" không có mục "Nhân vật" — đóng menu, không bấm gì thêm.', 'warning');
      try { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true })); } catch (e) {}
      return false;
    }
    simulateRadixClick(item);
    await sleep(1100);
    logUI('👤 Đã chọn "Nhân vật" trong menu "+" → mở màn tạo nhân vật mới.', 'success');
    return true;
  }

  async function setupCharactersHybrid(characters) {
    if (!Array.isArray(characters) || !characters.length) {
      notify('ERROR', { message: 'Không có nhân vật để nạp' });
      return;
    }
    const data = await new Promise((res) => chrome.storage.local.get(['afLatestProjectId', 'afApiTemplate', 'afUploadTemplate', 'afSessionTemplate', 'afPollTemplate'], res));
    const pid = getProjectIdFromUrl() || (latestProjectIdFromStore(data) || {}).id || '';
    if (!pid) { logUI('👤 Chưa có projectId. Mở đúng project Flow rồi thử lại.', 'warning'); notify('ERROR', { message: 'Chưa có projectId để nạp nhân vật' }); return; }
    const createdEntities = [];
    let prevEntityId = '';
    for (let i = 0; i < characters.length; i++) {
      const c = characters[i];
      notify('CHAR_PROGRESS', { current: i + 1, total: characters.length, name: c.name || '', voice: c.voice?.name || 'Auto' });
      log(`--- Nhân vật ${i + 1}/${characters.length}: ${c.name || '(chưa tên)'} ---`);

      // 1) Về mục Nhân vật (openCharacterLibrary tự THOÁT khỏi nhân vật đang mở về lưới),
      //    rồi LUÔN bấm "Nhân vật mới" (bỏ điều kiện skip cũ khiến nhân vật 2 kẹt ở nhân vật 1).
      const inLib = await openCharacterLibrary();
      if (!inLib) { notify('ERROR', { message: 'Không mở được mục Nhân vật trên Flow' }); return; }
      await sleep(700);
      let opened = clickSmart('charNew', ['Nhân vật mới', 'New character']);
      if (!opened) {
        // Thử nút "+" ở thanh trên (kế dấu ?) → menu → chọn Nhân vật.
        opened = await clickHeaderAddCharacter();
      }
      if (!opened) {
        notify('ERROR', { message: 'Không tìm thấy nút tạo "Nhân vật mới"/"+" (Teach hoặc kiểm tra UI)' });
        return;
      }
      // 2) Chờ Flow cấp entityId MỚI (khác nhân vật trước) trên URL. Nếu chưa có ngay,
      //    thử đưa ảnh kiểu DOM (upload sẽ khiến Flow tạo entity + hiện /character/<id>).
      await waitForElement(() => { const id = readCharacterEntityIdFromDom(); return (id && id !== prevEntityId) ? id : null; }, 12000, 400);
      let entityId = readCharacterEntityIdFromDom();
      if (!entityId || entityId === prevEntityId) {
        logUI(`👤 [${i + 1}] Chưa có entityId mới trên URL — đưa ảnh kiểu DOM để Flow tạo nhân vật…`, 'warning');
        const up = await uploadCharImage(c.imageDataUrl, c.fileName || `${c.name || 'char'}.png`) || await addCharacterImageFromProject(c.name || '');
        if (up) { await waitForElement(() => { const id = readCharacterEntityIdFromDom(); return (id && id !== prevEntityId) ? id : null; }, 30000, 600); }
        entityId = readCharacterEntityIdFromDom();
      }
      if (!entityId || entityId === prevEntityId) {
        logUI(`👤 [${i + 1}] Vẫn chưa mở được nhân vật MỚI (${String(prevEntityId).slice(0, 8)}…) — dừng để tránh gắn nhầm.`, 'error');
        notify('ERROR', { message: 'Chưa mở được nhân vật mới (entityId không đổi)' });
        return;
      }
      prevEntityId = entityId;

      // 3) Có entityId thật → API gắn ảnh + tên/voice.
      let attached = false;
      if (entityId) {
        logUI(`👤 [${i + 1}] Flow đã mở nhân vật ${entityId.slice(0, 8)}… — gắn ảnh + voice qua API…`, 'info');
        const res = await attachCharacterViaApiBridge(entityId, c, pid);
        attached = !!(res && res.ok);
        if (!attached) logUI(`👤 [${i + 1}] Gắn ảnh/voice API lỗi (${res && res.error || '?'}) — thử đưa ảnh kiểu DOM…`, 'warning');
      } else {
        logUI(`👤 [${i + 1}] Chưa đọc được entityId sau khi bấm "Nhân vật mới" — thử đưa ảnh kiểu DOM để Flow tạo entity…`, 'warning');
      }

      // 4) Fallback DOM: đưa ảnh vào màn nhân vật (Flow tạo/hoàn tất entity), rồi đặt tên/voice.
      if (!attached) {
        const uploaded = await uploadCharImage(c.imageDataUrl, c.fileName || `${c.name || 'char'}.png`) ||
          await addCharacterImageFromProject(c.name || '');
        if (!uploaded) {
          logUI('👤 Chưa đưa được ảnh vào nhân vật (cả API lẫn DOM).', 'error');
          notify('ERROR', { message: 'Chưa tạo được nhân vật: chưa đưa được ảnh vào' });
          return;
        }
        await waitForElement(() => findUntitledCharacterTitle() || findCharacterVoiceControl() || findByText(['Xong', 'Done', 'Hoàn tất']), 45000, 800);
        await sleep(1000);
        entityId = readCharacterEntityIdFromDom() || entityId;
        if (c.name) { await setCharacterName(c.name); await sleep(400); }
        if (c.voice && c.voice.id && c.voice.id !== 'auto') { await setCharacterVoice(c.voice); await sleep(400); }
      }

      if (entityId) {
        createdEntities.push({ entityId, name: c.name || '', voiceId: c.voice?.id || '', voiceName: c.voice?.name || '' });
        logUI(`👤 [${i + 1}] Đã tạo nhân vật "${c.name || ''}" (${entityId.slice(0, 8)}…) ✅`, 'success');
      } else {
        logUI(`👤 [${i + 1}] Đã đưa ảnh nhưng chưa đọc được entityId; video vẫn có thể dùng @Tên.`, 'warning');
      }

      // 5) Bấm "Xong" (hoặc quay về danh sách) để chuẩn bị nhân vật kế.
      if (!clickSmart('charDone', ['Xong', 'Done', 'Hoàn tất'])) {
        try { const t = location.href.replace(/\/character\/[^/?#]+/, '/characters'); history.pushState({}, '', t); window.dispatchEvent(new PopStateEvent('popstate', { state: history.state })); } catch (e) {}
      }
      await sleep(1800);
    }
    notify('CHAR_DONE', { count: characters.length, entities: createdEntities });
    log('✅ Đã nạp xong nhân vật (hybrid)');
  }

  // ===== DIAGNOSTIC: dump the live DOM so we can write exact selectors =====
  function describeEl(el) {
    const tag = el.tagName ? el.tagName.toLowerCase() : '?';
    const role = el.getAttribute && el.getAttribute('role') ? ' role=' + el.getAttribute('role') : '';
    const ph = el.getAttribute && el.getAttribute('placeholder') ? ' ph="' + el.getAttribute('placeholder') + '"' : '';
    const aria = el.getAttribute && el.getAttribute('aria-label') ? ' aria="' + el.getAttribute('aria-label') + '"' : '';
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 45);
    return `<${tag}${role}${ph}${aria}> "${txt}"`;
  }
  function scanUI() {
    const out = [];
    out.push(`=== content_script v${EXT_VERSION} === (nếu số này CŨ hơn bản đã cài → BẤM F5 trang Flow!)`);
    const panels = document.querySelectorAll('[role="dialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper],[class*="popover"],[class*="Dialog"],[class*="modal"]');
    out.push(`=== PANELS/POPUPS đang mở: ${panels.length} ===`);
    panels.forEach((p, i) => {
      if (!isVisible(p)) return;
      out.push(`--- Panel #${i} ---`);
      p.querySelectorAll('button,[role="button"],[role="option"],[role="menuitem"]').forEach(b => {
        if (isVisible(b)) out.push('  BTN ' + describeEl(b));
      });
      p.querySelectorAll('input,textarea').forEach(inp => out.push('  INPUT ' + describeEl(inp)));
      out.push(`  IMG trong panel: ${p.querySelectorAll('img').length}`);
    });
    out.push('=== MỤC BÊN TRÁI FLOW ===');
    const left = leftSideCandidates();
    out.push(left.length ? left.map((x) => '  ' + x).join('\n') : '  (không thấy mục nào)');
    const pi = DOM.getPromptInput && DOM.getPromptInput();
    out.push('=== Ô PROMPT: ' + (pi ? describeEl(pi) : 'KHÔNG TÌM THẤY') + ' ===');
    out.push('  ô gõ hợp lệ? ' + (pi && isEditableInput(pi) ? 'CÓ (gõ/đính ảnh được)' : 'KHÔNG — đang trỏ nhầm (vd thẻ <p> placeholder)'));
    const taughtPI = findMapped('promptInput');
    if (taughtPI) out.push('  promptInput đã teach → ' + describeEl(taughtPI) + (isEditableInput(taughtPI) ? ' [HỢP LỆ]' : ' [NHẦM → bỏ qua]'));
    const scope = getPromptScope();
    if (scope) {
      out.push('NÚT TRONG THANH PROMPT (getPromptScope):');
      scope.querySelectorAll('button,[role="button"]').forEach(b => { if (isVisible(b)) out.push('  ' + describeEl(b)); });
      out.push(`Ảnh đính trong thanh prompt: ${scope.querySelectorAll('img, [class*="thumb"], [class*="chip"], [class*="attachment"]').length}`);
    }
    // Chẩn đoán nút "+" : extension sẽ bấm vào cái nào, mapping đã teach ra sao.
    out.push('=== NÚT "+" (mở kho ảnh) ===');
    const chosen = getPromptPlusButton();
    out.push('  SẼ BẤM (getPromptPlusButton): ' + (chosen ? describeEl(chosen) : 'KHÔNG TÌM THẤY'));
    const autoPlus = findPromptPlus();
    out.push('  tự dò findPromptPlus(): ' + (autoPlus ? describeEl(autoPlus) : 'KHÔNG TÌM THẤY'));
    const taughtPlus = findMapped('promptPlus');
    out.push('  đã teach promptPlus → : ' + (taughtPlus ? describeEl(taughtPlus) + (isGoodPlus(taughtPlus) ? ' [HỢP LỆ]' : ' [NHẦM → bỏ qua]') : '(chưa teach hoặc không khớp)'));
    out.push('  kho ảnh đang mở? ' + (isPlusPanelOpen() ? 'CÓ' : 'không'));
    const upInput = findUploadInputInPanel();
    out.push('  ô tải ảnh trong kho: ' + (upInput ? describeEl(upInput) : 'KHÔNG TÌM THẤY'));
    out.push('=== VOICE NHÂN VẬT ===');
    const voiceControl = findCharacterVoiceControl();
    out.push('  control voice sẽ bấm: ' + (voiceControl ? describeEl(voiceControl) : 'KHÔNG TÌM THẤY'));
    const taughtVoice = findMapped('charVoice');
    out.push('  đã teach charVoice → ' + (taughtVoice ? describeEl(taughtVoice) : '(chưa teach)'));
    const voiceOptions = [];
    document.querySelectorAll('[role="option"], [role="menuitem"], [role="menuitemradio"], button, li').forEach((el) => {
      if (!isVisible(el)) return;
      const t = (el.textContent || '').trim();
      if (/achernar|achird|aoede|puck|charon|fenrir|leda|orus|sulafat|vindemiatrix|voice|giọng/i.test(t)) {
        voiceOptions.push(describeEl(el));
      }
    });
    out.push('  option voice thấy được: ' + (voiceOptions.slice(0, 12).join(' | ') || '(chưa mở dropdown voice hoặc không thấy option)'));
    return out.join('\n');
  }

  // Lấy projectId từ URL trang Flow ĐANG MỞ (…/tools/flow/project/<uuid>) — để tạo
  // vào ĐÚNG project hiện tại, không dùng project cũ đã lưu.
  function getProjectIdFromUrl() {
    try {
      const u = location.href;
      const m = /\/project\/([0-9a-fA-F-]{36})/.exec(u);
      if (m) return m[1];
      const m2 = /\/project\/([^/?#]+)/.exec(u);
      if (m2) return normalizeProjectId(decodeURIComponent(m2[1]));
      const q = /[?&](?:projectId|project)=([^&#]+)/.exec(u);
      if (q) return normalizeProjectId(decodeURIComponent(q[1]));
    } catch (e) {}
    return '';
  }

  function normalizeProjectId(value) {
    let s = String(value || '').trim();
    if (!s) return '';
    const m = /projects\/([^/?#"'\\\s]+)/.exec(s);
    if (m) s = m[1];
    return s.replace(/^projects\//, '').trim();
  }

  function extractProjectIdFromValue(value, depth = 0) {
    if (!value || depth > 8) return '';
    if (typeof value === 'string') {
      const direct = /projects\/([^/?#"'\\\s]+)/.exec(value);
      if (direct) return normalizeProjectId(direct[1]);
      return '';
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = extractProjectIdFromValue(item, depth + 1);
        if (found) return found;
      }
      return '';
    }
    if (typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        const lk = key.toLowerCase();
        if ((lk === 'projectid' || lk === 'project' || lk.endsWith('projectid')) && typeof val === 'string') {
          const direct = normalizeProjectId(val);
          if (direct) return direct;
        }
        const found = extractProjectIdFromValue(val, depth + 1);
        if (found) return found;
      }
    }
    return '';
  }

  function extractProjectIdFromBody(body) {
    if (!body || typeof body !== 'string') return '';
    try {
      const parsed = JSON.parse(body);
      const found = extractProjectIdFromValue(parsed);
      if (found) return found;
    } catch (e) {}
    return extractProjectIdFromValue(body);
  }

  function latestProjectIdFromStore(data) {
    const latest = data.afLatestProjectId;
    const latestId = normalizeProjectId(latest && (latest.id || latest));
    if (latestId) return { id: latestId, source: (latest && latest.source) || 'request mới đã bắt' };
    const templates = [data.afApiTemplate, data.afUploadTemplate, data.afSessionTemplate, data.afPollTemplate];
    for (const t of templates) {
      const id = extractProjectIdFromBody(t && t.body);
      if (id) return { id, source: t.kind || 'request đã lưu' };
    }
    return { id: '', source: '' };
  }

  function isUploadApiUrl(url) {
    return /uploadimage|uploadmedia|:upload\b|media:upload/.test(String(url || '').toLowerCase());
  }

  function isKnownNonCharacterApi(d) {
    const url = String(d && d.url || '').toLowerCase();
    const kind = String(d && d.kind || '').toLowerCase();
    if (/\/g\/collect|googletagmanager|google-analytics|analytics|telemetry/.test(url)) return true;
    if (isUploadApiUrl(url) || kind === 'upload') return true;
    if (/streamchat|creationagent[:/](generate|run)|batchasyncgeneratevideo|generatevideo|generateimage|:generate\b|runvideo/.test(url) || kind === 'generate') return true;
    if (/creationagent\/sessions|createsession|\/sessions\b/.test(url) || kind === 'session') return true;
    if (/\/v1\/flow\/projects\b|createproject|deleteproject|listprojects|getproject|checkappavailability/.test(url) || kind === 'project') return true;
    if (/batchcheckasyncvideo|checkasyncvideogeneration|video:batchcheck|generationstatus|:fetchoperation|operations\b/.test(url) || kind === 'poll') return true;
    if (/batchlogfrontendevents|fetchuserrecommendations|frontendevent|analytics|telemetry|\/log\b/.test(url)) return true;
    return false;
  }

  function collectCharacterApiSignals(value, depth = 0, signals = { charish: 0, voice: 0, media: 0, name: 0, project: 0 }) {
    if (!value || depth > 8) return signals;
    if (Array.isArray(value)) {
      value.forEach((item) => collectCharacterApiSignals(item, depth + 1, signals));
      return signals;
    }
    if (typeof value !== 'object') return signals;
    for (const [key, val] of Object.entries(value)) {
      const lk = key.toLowerCase();
      if (/character|persona|subject|actor|cast|entity|entityinfo|entitytype/.test(lk)) signals.charish++;
      if (/voice|speaker/.test(lk)) signals.voice++;
      if (/avatar|portrait|image|media|asset|workflowid/.test(lk)) signals.media++;
      if (/displayname|charactername|title|nickname|^name$/.test(lk)) signals.name++;
      if (/projectid|^project$/.test(lk)) signals.project++;
      collectCharacterApiSignals(val, depth + 1, signals);
    }
    return signals;
  }

  function hasStrongCharacterApiShape(body) {
    try {
      const signals = collectCharacterApiSignals(JSON.parse(body || '{}'));
      return (
        (signals.charish > 0 && signals.media > 0 && (signals.voice > 0 || signals.name > 0 || signals.project > 0)) ||
        (signals.voice > 0 && signals.media > 0 && signals.name > 0)
      );
    } catch (e) {
      return false;
    }
  }

  function looksLikeCharacterPayload(d) {
    const url = String(d.url || '').toLowerCase();
    if (isKnownNonCharacterApi(d)) return false;
    if (/\/v1\/flow\/entities\b|character|persona|subject|actor|cast|speaker|voice|avatar|portrait/.test(url)) return true;
    return hasStrongCharacterApiShape(d.body);
  }

  function looksLikeCharacterCandidate(d) {
    if (!d || !d.body || isUploadApiUrl(d.url) || isKnownNonCharacterApi(d)) return false;
    if (looksLikeCharacterPayload(d)) return true;
    try {
      const signals = collectCharacterApiSignals(JSON.parse(d.body || '{}'));
      return signals.charish > 0 || (signals.voice > 0 && (signals.media > 0 || signals.name > 0));
    } catch (e) {
      return false;
    }
  }

  function effectiveApiKind(d) {
    if (isUploadApiUrl(d && d.url) || d.kind === 'upload') return 'upload';
    if (looksLikeCharacterPayload(d)) return 'character';
    return d.kind || '';
  }

  function parseApiBody(body) {
    if (!body || typeof body !== 'string') return null;
    try { return JSON.parse(body); } catch (e) { return null; }
  }

  function apiTemplateStoragePlan(d, apiKind) {
    const url = String(d && d.url || '').toLowerCase();
    const method = String(d && d.method || 'POST').toUpperCase();
    const bodyObj = parseApiBody(d && d.body);
    const plan = { keys: [], label: '📥 API', detailKind: apiKind || '' };

    if (apiKind === 'generate') {
      if (url.includes('batchasyncgeneratevideoupsamplevideo')) {
        plan.keys.push('afGenerateUpsampleTemplate');
        plan.label = '🔎 API UPSCALE VIDEO';
        plan.detailKind = 'generateUpsample';
      } else if (url.includes('batchasyncgeneratevideoreferenceimages')) {
        plan.keys.push('afApiTemplate', 'afGenerateReferenceTemplate');
        plan.label = '🎯 API TẠO VIDEO REF';
        plan.detailKind = 'generateReferenceImages';
      } else if (url.includes('batchasyncgeneratevideotext')) {
        plan.keys.push('afApiTemplate', 'afGenerateTextTemplate');
        plan.label = '🎯 API TẠO VIDEO TEXT';
        plan.detailKind = 'generateText';
      } else if (url.includes('batchasyncgeneratevideostartandendimage')) {
        plan.keys.push('afApiTemplate', 'afGenerateStartEndTemplate');
        plan.label = '🎯 API TẠO VIDEO START+END';
        plan.detailKind = 'generateStartEnd';
      } else if (url.includes('batchasyncgeneratevideostartimage')) {
        plan.keys.push('afApiTemplate', 'afGenerateStartImageTemplate');
        plan.label = '🎯 API TẠO VIDEO START';
        plan.detailKind = 'generateStartImage';
      } else {
        plan.keys.push('afApiTemplate', 'afGenerateOtherTemplate');
        plan.label = '🎯 API TẠO';
        plan.detailKind = 'generateOther';
      }
      return plan;
    }

    if (apiKind === 'upload') {
      plan.keys.push('afUploadTemplate');
      if (bodyObj && bodyObj.mediaGenerationContext && bodyObj.mediaGenerationContext.entityContext) {
        plan.keys.push('afUploadCharacterEntityTemplate');
        plan.label = '👤 API TẢI ẢNH ENTITY';
        plan.detailKind = 'uploadCharacterEntity';
      } else {
        plan.keys.push('afUploadStoryboardTemplate');
        plan.label = '🖼️ API TẢI ẢNH/STORYBOARD';
        plan.detailKind = 'uploadStoryboard';
      }
      return plan;
    }

    if (apiKind === 'session') {
      plan.keys.push('afSessionTemplate');
      plan.label = '🗂️ API SESSION';
      return plan;
    }

    if (apiKind === 'project') {
      plan.keys.push('afProjectTemplate');
      if (method === 'POST' && /createproject|projects\b|project:create/.test(url)) {
        plan.keys.push('afCreateProjectTemplate');
        plan.label = '📁 API TẠO DỰ ÁN';
        plan.detailKind = 'createProject';
      } else {
        plan.label = '📁 API DỰ ÁN';
      }
      return plan;
    }

    if (apiKind === 'poll') {
      plan.keys.push('afPollTemplate');
      plan.label = '⏳ API POLL';
      return plan;
    }

    if (apiKind === 'character') {
      plan.keys.push('afCharacterTemplate');
      if (method === 'PATCH' && /\/v1\/flow\/entities\b/.test(url)) {
        plan.keys.push('afPatchEntityTemplate');
        plan.label = '👤 API PATCH ENTITY/VOICE';
        plan.detailKind = 'patchEntity';
      } else {
        plan.label = '👤 API NHÂN VẬT/VOICE';
      }
      return plan;
    }

    return plan;
  }

  function summarizeVideoGenerateSettings(d) {
    const body = parseApiBody(d && d.body);
    const req = body && Array.isArray(body.requests) ? body.requests[0] : null;
    if (!req) return null;
    const modelKey = req.videoModelKey || '';
    const durationMatch = /_(\d+)s\b/.exec(modelKey);
    return {
      at: Date.now(),
      url: d.url,
      mode: String(d.url || '').toLowerCase().includes('referenceimages') ? 'reference'
        : String(d.url || '').toLowerCase().includes('startandendimage') ? 'start_end_frame'
        : String(d.url || '').toLowerCase().includes('startimage') ? 'start_frame'
        : 'text',
      aspectRatio: req.aspectRatio || '',
      aspect: req.aspectRatio === 'VIDEO_ASPECT_RATIO_PORTRAIT' ? '9:16'
        : req.aspectRatio === 'VIDEO_ASPECT_RATIO_LANDSCAPE' ? '16:9'
        : '',
      videoModelKey: modelKey,
      duration: durationMatch ? Number(durationMatch[1]) : 8,
      requestCount: Array.isArray(body.requests) ? body.requests.length : 1,
      referenceImageCount: Array.isArray(req.referenceImages) ? req.referenceImages.length : 0,
      referenceEntityCount: Array.isArray(req.referenceEntities) ? req.referenceEntities.length : 0,
      hasAudioFailurePreference: !!(body.mediaGenerationContext && body.mediaGenerationContext.audioFailurePreference),
      useV2ModelConfig: !!body.useV2ModelConfig,
    };
  }

  function rememberProjectId(pid, source) {
    const id = normalizeProjectId(pid);
    if (!id) return;
    chrome.storage.local.set({ afLatestProjectId: { id, source, at: Date.now() } });
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    log(`MSG: ${msg.action}`);
    switch (msg.action) {
      case 'SCAN_UI':
        try { sendResponse({ report: scanUI() }); }
        catch (e) { sendResponse({ report: 'scan error: ' + e.message }); }
        break;
      case 'DOWNLOAD_VIDEO_API': {
        // Tải video đang hiển thị. upsampled=true → pipeline 1080p; false → 720p thẳng.
        const id = currentVideoMediaId();
        if (!id) { logUI('⬇️ Không tìm thấy media id của video trên trang — mở/chọn 1 video rồi thử lại.', 'warning'); sendResponse({ success: false, error: 'no-media-id' }); break; }
        if (msg.upsampled !== false) {
          chrome.storage.local.get(['afGeneratedVideos'], (data) => {
            const rich = Array.isArray(data.afGeneratedVideos) ? data.afGeneratedVideos : [];
            const meta = rich.find((v) => v && v.id === id) || { id };
            startUpsampleDownload([{ mediaId: id, workflowId: meta.workflowId || '', aspectRatio: meta.aspectRatio || '' }], msg.downloadBaseName || 'Clip', msg.quality === '4k' ? '4k' : '1080');
            sendResponse({ success: true, started: true });
          });
          return true;
        }
        logUI(`⬇️ Đang tải video 720p qua API: ${id.slice(0, 8)}…`, 'info');
        apiDownloadMediaIds([id], false, false, msg.downloadBaseName || 'Clip').then((r) => {
          logUI(r && r.success ? `⬇️ Đã tải ✅ (${id.slice(0, 8)}…)` : `⬇️ Tải lỗi: ${r && r.error || '?'}`, r && r.success ? 'success' : 'error');
          sendResponse(r);
        });
        return true;
      }
      case 'DOWNLOAD_ALL_VIDEOS_API': {
        // Tải HÀNG LOẠT: mọi video có trên trang (720p thẳng, nhanh).
        const ids = allVideoMediaIds();
        if (!ids.length) { logUI('⬇️ Không thấy video nào trên trang để tải.', 'warning'); sendResponse({ success: false, error: 'no-videos' }); break; }
        logUI(`⬇️ Đang tải ${ids.length} video (720p) qua API…`, 'info');
        apiDownloadMediaIds(ids, false, false, msg.downloadBaseName || 'Clip').then((r) => {
          logUI(r && r.success ? `⬇️ Đã tải ${r.okCount}/${r.total} video ✅` : `⬇️ Tải lỗi: ${r && r.error || '?'}`, r && r.success ? 'success' : 'error');
          sendResponse(r);
        });
        return true;
      }
      case 'CLEAR_GENERATED_VIDEOS': {
        // Xoá danh sách video đã thu (gọi trước khi chạy 1 dự án để chỉ tải video của dự án đó).
        clearHarvestedVideos().then(() => sendResponse({ success: true }));
        return true;
      }
      case 'DOWNLOAD_GENERATED_AND_WAIT': {
        // Dùng cho CHUỖI DỰ ÁN: chờ video render xong → tải hết → CHỜ tải xong hẳn →
        //   mới trả lời. Sidepanel/background await cái này trước khi sang dự án kế.
        const pid = getProjectIdFromUrl() || '';
        const chainContext = msg.chainRunId && msg.projectRunId ? {
          chainRunId: msg.chainRunId,
          projectRunId: msg.projectRunId,
          chainIndex: msg.chainIndex,
          projectKey: msg.projectKey,
        } : null;
        if (chainContext) {
          chrome.storage.local.set({ afChainDownloadAccepted: { ...chainContext, acceptedAt: Date.now() } });
        }
        let downloadResponseSent = false;
        const finishDownload = async (result) => {
          if (downloadResponseSent) return;
          downloadResponseSent = true;
          const finalResult = { ...(result || { success: false }), ...(chainContext || {}) };
          if (chainContext) {
            // Ghi storage trước rồi mới broadcast: nếu background bị ngủ đúng lúc này,
            // lần thức kế tiếp vẫn đọc được kết quả và chuyển sang dự án tiếp theo.
            await chrome.storage.local.set({ afChainDownloadResult: finalResult });
            notify('CHAIN_DOWNLOAD_DONE', finalResult);
          }
          sendResponse(finalResult);
        };
        (async () => {
          // Chờ thu media id (id chỉ về sau khi Flow poll) — không bỏ cuộc sau 1 lần đọc.
          const { rich, ids: idList } = await waitHarvestedVideos(msg.expect || 0, 10 * 60 * 1000);
          if (!idList.length) { logUI('⬇️ Chuỗi: sau 10 phút vẫn chưa thu được video nào để tải.', 'warning'); await finishDownload({ success: false, error: 'no-media-ids' }); return; }
          const quality = msg.quality === '4k' ? '4k' : (msg.quality === '1080' || msg.upsampled ? '1080' : '720');
          logUI(`⏳ Chuỗi: chờ ${idList.length} video render xong…`, 'info');
          const ready = pid ? await waitVideosReadyViaInject(idList, pid) : idList;
          if (!ready.length) { logUI('⬇️ Chuỗi: không video nào sẵn sàng sau thời gian chờ.', 'warning'); await finishDownload({ success: false, error: 'not-ready' }); return; }
          if (quality !== '720') {
            // 1080p/4K: chạy upsample THẬT rồi chờ inject báo từng video xong + tải xong
            //   hết mới trả lời (trước kia chỉ "thử tải _upsampled" và rơi thầm về 720p).
            const readySet = new Set(ready);
            const items = (rich.length ? rich : ready.map((id) => ({ id })))
              .filter((v) => readySet.has(v.id))
              .map((v, index) => ({ mediaId: v.id, workflowId: v.workflowId || '', aspectRatio: v.aspectRatio || '', downloadName: numberedDownloadName(msg.downloadBaseName || 'Clip', index) }));
            logUI(`⬇️ Chuỗi: upscale ${quality === '4k' ? '4K' : '1080p'} ${items.length} video & chờ tải xong…`, 'info');
            const allDone = new Promise((resolve) => {
              _afUpsampleBatchWaiter = { pending: new Set(items.map((it) => it.mediaId)), resolve };
              setTimeout(() => { if (_afUpsampleBatchWaiter) { _afUpsampleBatchWaiter = null; resolve(); } }, 25 * 60 * 1000);
            });
            const started = startUpsampleDownload(items, msg.downloadBaseName || 'Clip', quality);
            if (!started) { _afUpsampleBatchWaiter = null; await finishDownload({ success: false, error: 'upsample-not-started' }); return; }
            await allDone;
            logUI(`⬇️ Chuỗi: xong lượt upscale + tải ${items.length} video ✅`, 'success');
            await finishDownload({ success: true, okCount: items.length, total: idList.length });
            return;
          }
          logUI(`⬇️ Chuỗi: tải ${ready.length} video (720p) & chờ tải xong…`, 'info');
          const r = await apiDownloadMediaIds(ready, false, true, msg.downloadBaseName || 'Clip');
          logUI(r && r.success ? `⬇️ Chuỗi: đã tải xong ${r.okCount}/${r.total} video ✅` : `⬇️ Chuỗi: tải lỗi (${r && r.error || '?'})`, r && r.success ? 'success' : 'error');
          await finishDownload(r || { success: false });
        })().catch(async (e) => {
          logUI(`⬇️ Chuỗi: lỗi tải không mong đợi (${e.message})`, 'error');
          await finishDownload({ success: false, error: e.message || 'download-error' });
        });
        return true;
      }
      case 'DOWNLOAD_GENERATED_VIDEOS_API': {
        // Tải HÀNG LOẠT theo video đã thu từ poll/generate (kể cả video không hiển thị).
        //   upsampled=true (mặc định) → pipeline 1080p; false → 720p thẳng.
        chrome.storage.local.get(['afGeneratedVideos', 'afGeneratedMediaIds'], (data) => {
          // Chỉ tải video của DỰ ÁN FLOW ĐANG MỞ — loại video đã gắn pid dự án khác
          //   để nút tải thủ công cũng không kéo nhầm/tải lại video dự án trước.
          const curPid = getProjectIdFromUrl() || '';
          let rich = Array.isArray(data.afGeneratedVideos) ? data.afGeneratedVideos : [];
          if (curPid) rich = rich.filter((v) => v && (!v.pid || v.pid === curPid));
          const ids = rich.length ? rich.map((v) => v.id) : (Array.isArray(data.afGeneratedMediaIds) ? data.afGeneratedMediaIds : []);
          if (!rich.length && !ids.length) { logUI('⬇️ Chưa thu được video nào — hãy tạo/mở video để bắt poll trước.', 'warning'); sendResponse({ success: false, error: 'no-media-ids' }); return; }
          if (msg.upsampled !== false) {
            const q = msg.quality === '4k' ? '4k' : '1080';
            const items = (rich.length ? rich : ids.map((id) => ({ id }))).map((v) => ({ mediaId: v.id, workflowId: v.workflowId || '', aspectRatio: v.aspectRatio || '' }));
            logUI(`⬇️ Đang tải ${q === '4k' ? '4K' : '1080p'} ${items.length} video (upsample → chờ → tải)…`, 'info');
            startUpsampleDownload(items, msg.downloadBaseName || 'Clip', q);
            sendResponse({ success: true, started: true, count: items.length });
            return;
          }
          // 720p thẳng: PHẢI chờ từng video render xong (MEDIA_GENERATION_STATUS_SUCCESSFUL)
          //   rồi mới tải — nếu tải ngay khi video chưa xong sẽ nhận file rỗng/HTML và
          //   sau đó không tự quay lại tải nữa. waitVideosReadyViaInject poll tới khi xong.
          const pid = getProjectIdFromUrl() || '';
          const waitIds = rich.length ? rich.map((v) => v.id) : ids;
          (async () => {
            logUI(`⏳ Chờ ${waitIds.length} video render xong rồi mới tải 720p…`, 'info');
            const ready = pid ? await waitVideosReadyViaInject(waitIds, pid) : waitIds;
            if (!ready.length) { logUI('⬇️ Không video nào sẵn sàng sau thời gian chờ — thử lại sau khi video xong.', 'warning'); sendResponse({ success: false, error: 'not-ready' }); return; }
            logUI(`⬇️ Đang tải 720p ${ready.length} video…`, 'info');
            const r = await apiDownloadMediaIds(ready, false, false, msg.downloadBaseName || 'Clip');
            logUI(r && r.success ? `⬇️ Đã tải ${r.okCount}/${r.total} video ✅` : `⬇️ Tải lỗi: ${r && r.error || '?'}`, r && r.success ? 'success' : 'error');
            sendResponse(r);
          })();
        });
        return true;
      }
      case 'REPLAY_API_TEST':
        // Đọc mẫu API TẠO đã bắt (đủ headers + body + token) và nhờ inject.js (MAIN
        // world) phát lại NGUYÊN VĂN để xem token/recaptcha còn hiệu lực không.
        chrome.storage.local.get(['afApiTemplate'], (data) => {
          const t = data.afApiTemplate;
          if (!t || !t.url || !t.body) { logUI('🧪 Chưa có mẫu API TẠO để phát lại — hãy tạo 1 video tay trước.', 'warning'); return; }
          logUI(`🧪 Đang phát lại (mint reCAPTCHA mới): ${String(t.url).split('?')[0].replace(/^https?:\/\/[^/]+/, '')} …`, 'info');
          window.postMessage({ __afReplay: true, freshRecaptcha: true, url: t.url, headers: t.headers || {}, body: t.body }, '*');
        });
        sendResponse({ success: true });
        break;
      case 'GEN_TEST':
        // Dựng request video:batchAsyncGenerateVideoText (giống TurboFlow) và gửi thẳng.
        chrome.storage.local.get(['afSessionTemplate', 'afApiTemplate', 'afUploadTemplate', 'afPollTemplate', 'afLatestProjectId'], (data) => {
          let pid = getProjectIdFromUrl();
          if (!pid) { try { pid = (JSON.parse((data.afSessionTemplate || {}).body || '{}').projectId) || ''; } catch (e) {} }
          if (!pid) pid = latestProjectIdFromStore(data).id;
          if (!pid) { logUI('🎬 Chưa mở project nào — mở 1 project trên Flow rồi thử lại.', 'warning'); return; }
          logUI(`🎬 Đang TẠO thử 1 video qua API cổ điển: "${(msg.prompt || '').slice(0, 40)}…"`, 'info');
          window.postMessage({ __afGen: true, projectId: pid, prompt: msg.prompt || 'a cat walking in the rain, cinematic', mode: 'text', model: msg.model || 'lite', aspect: msg.aspect || 'landscape', voice: msg.voice || null, duration: msg.duration || 8 }, '*');
        });
        sendResponse({ success: true });
        break;
      case 'GEN_NANO_IMAGES': {
        // Nano Flow M3: tạo ảnh Nano Banana cho từng shot (grounded từ trace thật).
        const nanoPid = getProjectIdFromUrl();
        logUI(`📥 content_script nhận lệnh tạo ${Array.isArray(msg.items) ? msg.items.length : 0} ảnh · project=${String(nanoPid || 'KHÔNG CÓ').slice(0, 8)} · hook trang=${afNetSeen ? 'SỐNG' : 'CHƯA'}`, 'info');
        if (!nanoPid) { logUI('🍌 Chưa mở project Flow nào — mở 1 project rồi thử lại.', 'warning'); sendResponse({ success: false, reason: 'no-project', url: location.href, injectSeen: afNetSeen }); return true; }
        if (msg.flowProjectId && String(msg.flowProjectId) !== String(nanoPid)) {
          logUI('🛡️ Từ chối lệnh ảnh vì Flow project hiện tại không khớp phiên đã khóa.', 'warning');
          sendResponse({ success: false, reason: 'flow-project-mismatch', pid: nanoPid });
          return true;
        }
        const postImages = () => { window.postMessage({
          __afNanoImages: true,
          projectId: nanoPid,
          items: Array.isArray(msg.items) ? msg.items : [],
          aspect: msg.aspect || 'landscape',
          model: msg.model || 'GEM_PIX_2',
          sceneHint: msg.sceneHint || '',
          delayMs: msg.delayMs || 1500,
          thumbnailPrompt: msg.thumbnailPrompt || '',
          thumbnailAspect: msg.thumbnailAspect || '',
          thumbnailTitle: msg.thumbnailTitle || '',
          videoKeyframeAspect: msg.videoKeyframeAspect || 'IMAGE_ASPECT_RATIO_LANDSCAPE',
          projectFingerprint: msg.projectFingerprint || '',
          runId: msg.runId || '',
          generationEpoch: Number(msg.generationEpoch) || 0,
          flowProjectId: msg.flowProjectId || nanoPid,
        }, '*'); logUI('📤 Đã chuyển lệnh vào trang Flow (chờ dòng "▶️ Trang Flow nhận lệnh…")…', 'info'); };
        // Report back DIRECTLY (not via the notify/relay chain) so the side panel
        // always sees whether we found a project and whether inject.js is loaded.
        if (afNetSeen) { postImages(); sendResponse({ success: true, pid: nanoPid, injectSeen: true }); return true; }
        // MAIN-world hook not loaded (typically right after an extension update) →
        // force-inject it, wait until it's alive, THEN post — no manual F5 needed.
        logUI('🩹 Đang nạp lại hook trang (inject.js) vào Flow — không cần F5…', 'info');
        waitForInject(4500).then(async (alive) => {
          // The freshly-injected fetch hook needs a beat to capture a Bearer from
          // Flow's ongoing requests before generation runs, else it would bail.
          if (alive) await sleep(1500);
          postImages();
          logUI(alive ? '✅ Hook trang đã sẵn sàng — đã gửi lệnh tạo ảnh.' : '⚠️ Vẫn chưa thấy hook trang; nếu không có ảnh, hãy F5 tab Flow 1 lần rồi thử lại.', alive ? 'info' : 'warning');
          try { sendResponse({ success: true, pid: nanoPid, injectSeen: alive }); } catch (e) {}
        });
        return true; // async sendResponse
      }
      case 'GEN_NANO_VIDEOS': {
        // Nano Flow M5: dựng video 10s từ keyframe đã tạo (keyframe = first frame).
        const nvPid = getProjectIdFromUrl();
        if (!nvPid) { logUI('🎬 Chưa mở project Flow nào — mở 1 project rồi thử lại.', 'warning'); sendResponse({ success: false }); return true; }
        if (msg.flowProjectId && String(msg.flowProjectId) !== String(nvPid)) {
          logUI('🛡️ Từ chối lệnh video vì Flow project hiện tại không khớp phiên đã khóa.', 'warning');
          sendResponse({ success: false, reason: 'flow-project-mismatch', pid: nvPid });
          return true;
        }
        const postVideos = () => window.postMessage({
          __afNanoVideos: true,
          projectId: nvPid,
          items: Array.isArray(msg.items) ? msg.items : [],
          aspect: msg.aspect || 'landscape',
          model: msg.model || 'lite',
          duration: msg.duration || 8,
          delayMs: msg.delayMs || 1800,
          projectFingerprint: msg.projectFingerprint || '',
          runId: msg.runId || '',
          generationEpoch: Number(msg.generationEpoch) || 0,
          flowProjectId: msg.flowProjectId || nvPid,
        }, '*');
        if (afNetSeen) { postVideos(); sendResponse({ success: true, injectSeen: true }); return true; }
        logUI('🩹 Đang nạp lại hook trang (inject.js) vào Flow — không cần F5…', 'info');
        waitForInject(4500).then(async (alive) => {
          if (alive) await sleep(1500); // let the fetch hook capture a Bearer first
          postVideos();
          try { sendResponse({ success: true, injectSeen: alive }); } catch (e) {}
        });
        return true; // async sendResponse
      }
      case 'GEN_NANO_THUMB': {
        // Nano Flow — sinh 1 ẢNH THUMBNAIL giật tít từ project.thumbnail_prompt,
        // đính sheet nhân vật (đã tạo) làm ref khóa mặt.
        const ntPid = getProjectIdFromUrl();
        if (!ntPid) { logUI('🖼️ Chưa mở project Flow nào — mở 1 project rồi thử lại.', 'warning'); sendResponse({ success: false, reason: 'no-project', url: location.href }); return true; }
        if (msg.flowProjectId && String(msg.flowProjectId) !== String(ntPid)) {
          logUI('🛡️ Từ chối thumbnail vì Flow project hiện tại không khớp phiên đã khóa.', 'warning');
          sendResponse({ success: false, reason: 'flow-project-mismatch', pid: ntPid });
          return true;
        }
        const postThumb = () => { window.postMessage({
          __afNanoThumb: true,
          projectId: ntPid,
          prompt: msg.prompt || '',
          sheetMediaIds: Array.isArray(msg.sheetMediaIds) ? msg.sheetMediaIds : [],
          characterRefs: Array.isArray(msg.characterRefs) ? msg.characterRefs : [],
          productRefs: Array.isArray(msg.productRefs) ? msg.productRefs : [],
          aspect: msg.aspect || '',
          model: msg.model || 'GEM_PIX_2',
          title: msg.title || '',
          projectFingerprint: msg.projectFingerprint || '',
          runId: msg.runId || '',
          generationEpoch: Number(msg.generationEpoch) || 0,
          flowProjectId: msg.flowProjectId || ntPid,
        }, '*'); logUI('📤 Đã chuyển lệnh tạo thumbnail vào trang Flow…', 'info'); };
        if (afNetSeen) { postThumb(); sendResponse({ success: true, pid: ntPid, injectSeen: true }); return true; }
        logUI('🩹 Đang nạp lại hook trang (inject.js) vào Flow — không cần F5…', 'info');
        waitForInject(4500).then(async (alive) => {
          if (alive) await sleep(1500); // let the fetch hook capture a Bearer first
          postThumb();
          try { sendResponse({ success: true, pid: ntPid, injectSeen: alive }); } catch (e) {}
        });
        return true; // async sendResponse
      }
      case 'GEN_BULK':
        // Tạo HÀNG LOẠT: dùng API cổ điển đã chốt với Claude/TurboFlow.
        activeBulkChainContext = msg.chainRunId && msg.projectRunId ? {
          chainRunId: msg.chainRunId,
          projectRunId: msg.projectRunId,
          chainIndex: msg.chainIndex,
          projectKey: msg.projectKey,
        } : null;
        if (activeBulkChainContext) {
          chrome.storage.local.set({ afChainBulkAccepted: { ...activeBulkChainContext, acceptedAt: Date.now() } });
        }
        chrome.storage.local.get(['afSessionTemplate', 'afApiTemplate', 'afUploadTemplate', 'afPollTemplate', 'afLatestProjectId'], async (data) => {
          const urlPid = getProjectIdFromUrl();
          const stored = latestProjectIdFromStore(data);
          let pid = urlPid;
          if (!pid) { try { pid = (JSON.parse((data.afSessionTemplate || {}).body || '{}').projectId) || ''; } catch (e) {} }
          if (!pid) pid = stored.id;
          if (!pid) { logUI('🚀 Chưa mở project nào — mở 1 project trên Flow rồi thử lại.', 'warning'); return; }
          logUI(`📁 Tạo vào project ${urlPid ? 'từ URL hiện tại' : 'theo session/template 9.20'}: ${pid.slice(0, 8)}…`, 'info');
          // items = mỗi prompt kèm ảnh RIÊNG (nếu có); fallback: prompts thường.
          const items = Array.isArray(msg.items) && msg.items.length
            ? msg.items.filter((it) => it && String(it.prompt || '').trim())
            : (msg.prompts || []).map((p) => ({ prompt: p, image: null }));
          if (!items.length) { logUI('🚀 Chưa có prompt nào — nhập prompt (mỗi dòng 1 cái).', 'warning'); return; }
          logUI(`🚀 Đang tạo hàng loạt ${items.length} video qua API cổ điển${items.some((it) => it.image) ? ' kèm ảnh storyboard' : ''}…`, 'info');
          // Xoá danh sách video đã thu để chỉ tự động tải video của lượt này; ghi nhớ
          //   chất lượng tải đã chọn ('720' | '1080' | '4k').
          // Background đã gọi CLEAR_GENERATED_VIDEOS, nhưng vẫn xếp lần xoá bảo vệ
          // này chung hàng đợi để nó không thể chạy sau một lượt harvest mới.
          await clearHarvestedVideos();
          pendingAutoDownload = msg.autoDownload
            ? {
                quality: msg.downloadQuality || (msg.downloadUpsampled ? '1080' : '720'),
                downloadBaseName: msg.downloadBaseName || 'Clip',
                // số video kỳ vọng = số prompt × số video/prompt — để vòng tải biết chờ đủ
                expect: items.length * Math.max(1, msg.count || 1)
              }
            : null;
          window.postMessage({
            __afBulk: true,
            projectId: pid,
            items,
            characterImages: msg.images || msg.characterImages || [],
            mode: 'text',
            model: msg.model || 'lite',
            aspect: msg.aspect || 'landscape',
            count: msg.count || 1,
            characterMode: msg.characterMode || 'ref',
            characterRefs: msg.characterRefs || [],
            preloadedCharacterRefs: msg.preloadedCharacterRefs || [],
            characterEntities: msg.characterEntities || [],
            voice: msg.voice || null,
            duration: msg.duration || 8
          }, '*');
        });
        sendResponse({ success: true });
        break;
      case 'TRACE_CONTROL':
        apiTraceRecording = !!msg.recording;
        if (msg.clear) {
          apiTraceBuffer.length = 0;
          chrome.storage.local.set({ afApiTrace: [] });
        }
        chrome.storage.local.set({ afTraceRecording: apiTraceRecording });
        logUI(apiTraceRecording ? '⏺️ Đang ghi API thao tác tay.' : '⏹️ Đã dừng ghi API thao tác tay.', apiTraceRecording ? 'success' : 'info');
        sendResponse({ success: true });
        break;
      case 'SETUP_CHARACTERS':
      case 'SETUP_CHARACTER_ENTITIES':
        // DOM THUẦN như thao tác người thật (đáng tin nhất): mỗi nhân vật → về lưới Nhân vật
        //   → mở "Nhân vật mới" (hoặc nút "+" header) → đưa ảnh vào → đặt tên/voice → Xong.
        //   Mỗi lần đều mở nhân vật MỚI nên không kẹt/gắn nhầm ở nhân vật thứ 2.
        logUI('👤 Nạp nhân vật: mỗi người mở "Nhân vật mới" riêng → đưa ảnh → đặt tên/voice → Xong.', 'info');
        setupCharacters(msg.characters || []);
        sendResponse({ success: true });
        break;
      case 'SETUP_CHARACTER_REFS': {
        const chars = Array.isArray(msg.characters) ? msg.characters.filter((c) => c && c.imageDataUrl) : [];
        const tags = chars.map((c) => (c.name || '').trim()).filter(Boolean).map((n) => '@' + n.replace(/\s+/g, ''));
        chrome.storage.local.get(['afSessionTemplate', 'afApiTemplate', 'afUploadTemplate', 'afPollTemplate', 'afLatestProjectId'], (data) => {
          const urlPid = getProjectIdFromUrl();
          const stored = latestProjectIdFromStore(data);
          const pid = urlPid || stored.id;
          if (!pid) {
            logUI('📎 Chưa có projectId để tải ảnh ref. Mở đúng project Flow rồi thử lại.', 'warning');
            notify('ERROR', { message: 'Chưa có projectId để tải ảnh ref' });
            return;
          }
          logUI(`📎 Tải ${chars.length} ảnh ref nhân vật lên Flow${tags.length ? ' · ' + tags.join(' ') : ''}. Khi chạy hàng đợi vẫn tự kèm ảnh + @Tên.`, 'info');
          window.postMessage({ __afUploadCharacterRefs: true, projectId: pid, characters: chars }, '*');
        });
        sendResponse({ success: true });
        break;
      }
      case 'START_QUEUE':
        queue = msg.prompts || [];
        cfg = msg.settings || {};
        cfg.storyboard = msg.storyboard || null; // image data for storyboard mode
        cfg.charNames = msg.charNames || [];     // character names for @-references
        cfg.charImages = msg.charImages || [];   // character images to drag into prompt
        cfg.productImages = Array.isArray(msg.productImages)
          ? msg.productImages
          : (msg.productImage ? [msg.productImage] : []); // nhiều ảnh ref chung gắn vào mọi prompt
        cfg.downloadBaseName = msg.downloadBaseName || 'Clip';
        totalPrompts = queue.length;
        currentIndex = msg.resumeFrom || 0;
        state = 'running';
        processQueue();
        sendResponse({ success: true });
        break;
      case 'PAUSE_QUEUE': state = 'paused'; sendResponse({ success: true }); break;
      case 'RESUME_QUEUE': state = 'running'; sendResponse({ success: true }); break;
      case 'STOP_QUEUE': state = 'idle'; queue = []; currentIndex = 0; stopTeaching(); sendResponse({ success: true }); break;
      case 'PING':
        const pi = DOM.getPromptInput();
        const sb = DOM.getSubmitButton();
        sendResponse({
          alive: true, state, version: EXT_VERSION,
          current: currentIndex + 1, total: totalPrompts,
          mappingCount: Object.keys(elementMap).length,
          mappedKeys: Object.keys(elementMap),
          scan: {
            promptInput: pi ? `<${pi.tagName}> role=${pi.getAttribute('role')} editable=${pi.isContentEditable}` : false,
            submitButton: sb ? `<${sb.tagName}> "${(sb.textContent || '').trim().substring(0, 20)}"` : false,
            settingsToggle: !!DOM.getSettingsToggle()
          }
        });
        break;
      case 'CREATE_NEW_FLOW_PROJECT': {
        // Luồng đúng theo trace thao tác tay: ở /tools/flow, bấm nút
        // "Create with Google Flow" để chính Flow sinh projectId + session mới.
        const labelOf = (el) => `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`
          .trim().replace(/\s+/g, ' ').toLowerCase();
        const scoreCreateButton = (el) => {
          const label = labelOf(el);
          let score = 0;
          if (label === 'create with google flow' || label === 'tạo bằng google flow' || label === 'tạo với google flow') score = 100;
          else if (/^create (a )?new project$|^tạo (một )?dự án mới$/.test(label)) score = 95;
          else if (/create with google flow|create (a )?(new )?project|new project|tạo (một )?dự án|dự án mới|tạo (bằng|với) google flow/.test(label)) score = 80;
          if (el.tagName === 'BUTTON') score += 5;
          if (el.tagName === 'A' && /\/tools\/flow\/project\//.test(el.getAttribute('href') || '')) score += 3;
          return score;
        };
        // Flow đôi lúc dựng ô "+ Dự án mới" bằng card có tabindex thay vì <button>.
        const candidates = [...new Set(document.querySelectorAll('button, a, [role="button"], [tabindex="0"]'))]
          .filter((el) => isVisible(el) && scoreCreateButton(el) > 0)
          .sort((a, b) => scoreCreateButton(b) - scoreCreateButton(a));
        // Khi có nhiều node lồng nhau cùng chứa chữ "Create", trước đây code rơi
        // sang DOM.getSubmitButton() và bấm nhầm nút gửi prompt. Luôn chọn ứng viên
        // tạo project có điểm cao nhất, không dùng nút submit làm fallback.
        const button = candidates[0] || null;
        if (!button || !isVisible(button)) {
          logUI('🆕 Không tìm thấy nút tạo dự án trên trang danh sách Flow.', 'warning');
          sendResponse({ success: false, error: 'create-project-button-not-found' });
          break;
        }
        const label = `${button.textContent || ''} ${button.getAttribute('aria-label') || ''}`.trim().replace(/\s+/g, ' ').slice(0, 100);
        logUI(`🆕 Bấm nút tạo dự án thật của Flow: "${label || 'Create'}"…`, 'info');
        // Trả ACK trước vì thao tác click sẽ điều hướng và huỷ content script hiện tại.
        sendResponse({ success: true, label });
        setTimeout(() => {
          try { simulateRadixClick(button); }
          catch (e) { try { button.click(); } catch (e2) {} }
        }, 80);
        break;
      }
      case 'TEACH': if (msg.target) { startTeaching(msg.target); sendResponse({ success: true }); } else sendResponse({ success: false }); break;
      case 'STOP_TEACH': stopTeaching(); sendResponse({ success: true }); break;
      case 'GET_MAPPINGS': sendResponse({ elementMap }); break;
      case 'CLEAR_MAPPINGS': elementMap = {}; chrome.storage.local.set({ elementMap: {} }); sendResponse({ success: true }); break;
      case 'CLEAR_MAPPING':
        if (msg.target) { delete elementMap[msg.target]; chrome.storage.local.set({ elementMap }); }
        sendResponse({ success: true });
        break;
      default: sendResponse({ error: 'Unknown' });
    }
    return true;
  });

  // ========================
  // NET HOOK — nhận request API thật mà inject.js (MAIN world) bắt được, để HỌC
  // giao thức Flow rồi (bước sau) PHÁT LẠI với prompt của người dùng.
  // ========================
  let lastApiTemplate = null;
  const _seenApi = new Set();
  const _seenCharCandidate = new Set();
  const _seenCharTraceLog = new Set();
  let apiTraceRecording = false;
  const apiTraceBuffer = [];

  chrome.storage.local.get(['afTraceRecording', 'afApiTrace'], (data) => {
    apiTraceRecording = !!data.afTraceRecording;
    if (Array.isArray(data.afApiTrace)) apiTraceBuffer.push(...data.afApiTrace.slice(-160));
  });

  function redactTraceValue(value, parentKey = '') {
    if (Array.isArray(value)) return value.map((v) => redactTraceValue(v, parentKey));
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
        out[key] = redactTraceValue(v, lk);
      } else {
        out[key] = v;
      }
    }
    return out;
  }

  function compactTraceBody(body) {
    if (!body || typeof body !== 'string') return body || '';
    try {
      return JSON.stringify(redactTraceValue(JSON.parse(body)), null, 2).slice(0, 12000);
    } catch (e) {
      return body.length > 3000 ? body.slice(0, 3000) + `… [cắt ${body.length} ký tự]` : body;
    }
  }

  function traceLooksCharacterRelated(d) {
    const url = String(d && d.url || '').toLowerCase();
    const body = String(d && d.body || '');
    const text = String(d && d.text || '');
    const onCharactersPage = /\/characters(?:[/?#]|$)/.test(location.href);
    if (!/aisandbox|googleapis|labs\.google|clients6\.google/.test(url)) return false;
    if (/fetchuserrecommendations|\/g\/collect|analytics/.test(url)) return false;
    if (/\/v1\/flow\/entities\b|character|persona|voice|speaker|avatar|portrait|asset|uploadimage|batchdeleteassets/.test(url)) return true;
    if (/CHARACTER_|characterSlot|entityContext|entityInfo|presetVoiceId|workflowId|voice|speaker|portrait|avatar|batchDeleteAssets/i.test(body + ' ' + text)) return true;
    if (onCharactersPage && /\/v1\/flow|flowcreationagent|uploadimage|batchlogfrontendevents/.test(url)) return true;
    return false;
  }

  function traceRecord(d) {
    const safeHeaders = {};
    for (const k in (d.headers || {})) {
      safeHeaders[k] = /authorization|cookie|api-?key|token|sapisid|secret|auth/i.test(k) ? '***ĐÃ CHE***' : d.headers[k];
    }
    return {
      at: Date.now(),
      time: new Date().toLocaleTimeString(),
      page: location.pathname,
      via: d.via,
      kind: d.kind || '',
      respKind: d.respKind || '',
      method: d.method || '',
      status: d.status,
      ok: d.ok,
      url: d.url,
      bodyType: d.bodyType || '',
      headers: Object.keys(safeHeaders).length ? safeHeaders : undefined,
      body: compactTraceBody(d.body),
      response: d.text ? compactTraceBody(d.text) : ''
    };
  }

  function appendApiTrace(d) {
    if (!apiTraceRecording) return;
    const rec = d.kind === 'log'
      ? { at: Date.now(), time: new Date().toLocaleTimeString(), via: 'log', message: d.message || '' }
      : traceRecord(d);
    apiTraceBuffer.push(rec);
    while (apiTraceBuffer.length > 200) apiTraceBuffer.shift();
    try { chrome.storage.local.set({ afApiTrace: apiTraceBuffer }); } catch (e) {}
  }

  function rememberCharacterTrace(d) {
    if (!traceLooksCharacterRelated(d)) return;
    const rec = traceRecord(d);
    chrome.storage.local.get(['afCharacterTrace'], (data) => {
      const arr = Array.isArray(data.afCharacterTrace) ? data.afCharacterTrace : [];
      arr.push(rec);
      while (arr.length > 80) arr.shift();
      chrome.storage.local.set({ afCharacterTrace: arr });
    });
    const tail = String(d.url || '').split('?')[0].replace(/^https?:\/\/[^/]+/, '').slice(0, 80);
    if (!_seenCharTraceLog.has(tail)) {
      _seenCharTraceLog.add(tail);
      logUI(`🧭 Trace nhân vật: ${tail} ${d.status ? '→ HTTP ' + d.status : ''} — đã lưu`, 'info');
    }
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || d.source !== 'AF_NET') return;
    afNetSeen = true; // inject.js (MAIN world) is alive on this page
    appendApiTrace(d);
    if (d.via === 'init') { logUI('🔌 Net hook đã cài — đang lắng nghe API Flow. Hãy TẠO 1 video tay để bắt giao thức.', 'info'); return; }
    if (d.kind === 'log') { logUI(d.message || '', 'info'); return; }
    if (d.kind === 'nanoImagesDone') { notify('NANO_IMAGES_DONE', { results: d.results || [], projectFingerprint: d.projectFingerprint || '', runId: d.runId || '', generationEpoch: Number(d.generationEpoch) || 0, flowProjectId: d.flowProjectId || '' }); return; }
    if (d.kind === 'nanoVideosDone') { notify('NANO_VIDEOS_DONE', { results: d.results || [], projectFingerprint: d.projectFingerprint || '', runId: d.runId || '', generationEpoch: Number(d.generationEpoch) || 0, flowProjectId: d.flowProjectId || '' }); return; }
    if (d.kind === 'nanoThumbDone') { notify('NANO_THUMB_DONE', { result: d.result || null, projectFingerprint: d.projectFingerprint || '', runId: d.runId || '', generationEpoch: Number(d.generationEpoch) || 0, flowProjectId: d.flowProjectId || '' }); return; }
    if (d.kind === 'genResult') {
      const resultLabel = d.agent ? 'FLOW AGENT' : 'API cổ điển';
      logUI(`🎬 TẠO VIDEO (${resultLabel}) → HTTP ${d.status} ${d.ok ? '✅ ĐƯỢC RỒI!' : '❌'}`, d.ok ? 'success' : 'error');
      if (d.text) logUI(`↳ phản hồi: ${d.text.slice(0, 220)}`, d.ok ? 'success' : 'info');
      if (d.bulk) {
        const chainContext = activeBulkChainContext;
        activeBulkChainContext = null;
        const bulkResult = {
          ok: !!d.ok,
          text: d.text || '',
          results: d.results || [],
          requestedCount: Number(d.requestedCount) || 0,
          submittedCount: Number(d.submittedCount) || 0,
          harvestedIdCount: Number(d.harvestedIdCount) || 0,
          failedCount: Number(d.failedCount) || 0,
          ...(chainContext || {}),
        };
        // Chỉ báo BULK_DONE sau khi toàn bộ media id của response cuối đã ghi xong.
        // Nếu báo sớm, background chuyển sang tải trong lúc storage mới có 1/N clip
        // và dự án đầu sẽ đứng chờ rất lâu, không bao giờ tới bước thoát project.
        harvestedVideoWriteQueue.then(() => {
          if (chainContext) {
            // Checkpoint trước khi broadcast để service worker MV3 có ngủ cũng nối lại được.
            chrome.storage.local.set({ afChainBulkResult: bulkResult }, () => {
              notify('BULK_DONE', bulkResult);
            });
          } else {
            notify('BULK_DONE', bulkResult);
          }
        });
        // TỰ ĐỘNG TẢI: tạo xong hàng loạt → nếu bật, tự chờ render + tải hết (không bấm tay).
        //   Đợi 1 nhịp để các resp generate được harvest vào afGeneratedVideos.
        if (d.ok && pendingAutoDownload) {
          const pref = pendingAutoDownload; pendingAutoDownload = null;
          logUI('⬇️ Tự động tải: sẽ chờ thu đủ video rồi tải (không cần bấm)…', 'info');
          setTimeout(() => { autoDownloadGeneratedVideos(pref.quality || '720', pref.downloadBaseName || 'Clip', pref.expect || 0); }, 1500);
        }
      }
      return;
    }
    if (d.kind === 'charRefResult') {
      logUI(`📎 ẢNH REF NHÂN VẬT → ${d.ok ? '✅' : '❌'} ${d.text || ''}`, d.ok ? 'success' : 'error');
      notify('CHAR_REF_DONE', { ok: !!d.ok, text: d.text || '', refs: d.refs || [] });
      return;
    }
    if (d.kind === 'charApiFailure') {
      const failure = {
        at: Date.now(),
        status: d.status,
        invalidTemplate: !!d.invalidTemplate,
        url: d.url,
        templateUrl: d.templateUrl,
        response: d.response || '',
        requestBody: d.requestBody || ''
      };
      try { chrome.storage.local.set({ afLastCharFailure: failure }); } catch (e) {}
      if (d.invalidTemplate) {
        try { chrome.storage.local.remove('afCharacterTemplate'); } catch (e) {}
        logUI('👤 Flow báo payload nhân vật không hợp lệ nên mình đã xoá template nhân vật đang sai. Hãy bắt lại API mẫu rồi bấm "Sao chép API đã bắt" gửi mình nếu còn lỗi.', 'warning');
      }
      return;
    }
    if (d.kind === 'charApiResult') {
      if (d.invalidTemplate) {
        try { chrome.storage.local.remove('afCharacterTemplate'); } catch (e) {}
        logUI('👤 Template nhân vật vừa dùng không hợp lệ, mình đã bỏ nó để tránh lặp lại lỗi 400.', 'warning');
      }
      logUI(`👤 NẠP NHÂN VẬT (API) → ${d.ok ? '✅' : '❌'} ${d.text || ''}`, d.ok ? 'success' : 'error');
      if (d.ok) {
        const m = /(\d+)\s+thành công/i.exec(d.text || '');
        notify('CHAR_DONE', { count: m ? Number(m[1]) : 1, entities: Array.isArray(d.entities) ? d.entities : [] });
      } else {
        notify('ERROR', { message: d.text || 'Nạp nhân vật API lỗi' });
      }
      return;
    }
    if (d.kind === 'harvestVideos') {
      // inject bóc media id TRỰC TIẾP từ response tạo (không cần nghe lỏm trang poll).
      storeHarvestedVideos(d.videos);
      return;
    }
    if (d.kind === 'videosReady') {
      const cb = _afReadyWaiters.get(d.reqId);
      if (cb) cb(Array.isArray(d.ready) ? d.ready : []);
      return;
    }
    if (d.kind === 'charAttachResult') {
      if (_afCharAttachWaiter) _afCharAttachWaiter({ ok: !!d.ok, entityId: d.entityId, workflowId: d.workflowId, error: d.error });
      return;
    }
    if (d.kind === 'upsampleReady') {
      // inject báo video "<id>_upsampled" đã SUCCESSFUL (hoặc hết giờ chờ).
      const resLabel = d.resolution === '4k' ? '4K' : '1080p';
      if (d.ok && d.mediaId) {
        apiDownloadMediaIds([d.mediaId], true, false, '', [d.downloadName || 'Clip 1.mp4']).then((r) => {
          logUI(r && r.success ? `⬇️ Đã tải ${resLabel} ✅ (${String(d.mediaId).slice(0, 8)}…)` : `⬇️ Tải ${resLabel} lỗi: ${r && r.error || '?'}`, r && r.success ? 'success' : 'error');
        }).finally(() => _afNotifyUpsampleBatch(d.mediaId));
      } else if (d.mediaId) {
        // Upscale không xong sau thời gian chờ → vẫn đảm bảo người dùng CÓ video:
        //   tải bản gốc 720p thay vì bỏ trống.
        logUI(`⬇️ ${resLabel} chưa xong sau thời gian chờ (${String(d.mediaId).slice(0, 8)}…) — tải bản 720p gốc thay thế.`, 'warning');
        apiDownloadMediaIds([d.mediaId], false, false, '', [d.downloadName || 'Clip 1.mp4']).then((r) => {
          logUI(r && r.success ? `⬇️ Đã tải 720p (thay thế) ✅ (${String(d.mediaId).slice(0, 8)}…)` : `⬇️ Tải 720p thay thế lỗi: ${r && r.error || '?'}`, r && r.success ? 'success' : 'error');
        }).finally(() => _afNotifyUpsampleBatch(d.mediaId));
      } else {
        _afNotifyUpsampleBatch(d.mediaId);
      }
      return;
    }
    if (d.kind === 'resp') {
      rememberCharacterTrace(d);
      // Thu media id VIDEO từ response poll/generate (luôn bật, không cần đang GHI)
      //   để tải hàng loạt qua API. Chỉ lấy media có ".video" (loại ảnh).
      //   Lưu ý: inject gửi nội dung ở field `text` (không phải `response`).
      if (d.respKind === 'poll' || d.respKind === 'generate') harvestGeneratedMediaIds(d.text || d.response || '');
      if (!d.respKind) return;
      const tl = String(d.url || '').split('?')[0].replace(/^https?:\/\/[^/]+/, '');
      const label = { generate: '🎯 TẠO', upload: '🖼️ TẢI ẢNH', session: '🗂️ SESSION', poll: '⏳ POLL', download: '⬇️ TẢI VIDEO', project: '📁 DỰ ÁN' }[d.respKind] || d.respKind;
      logUI(`📶 KẾT QUẢ ${label}: ${tl} → HTTP ${d.status}${d.ok ? ' ✅' : ' ❌'}`, d.ok ? 'success' : 'error');
      return;
    }
    if (d.kind === 'replayResult') {
      const level = d.ok ? 'success' : 'error';
      logUI(`🧪 PHÁT LẠI API → HTTP ${d.status} ${d.ok ? '(✅ 200 — reCAPTCHA mới OK! API replay khả thi)' : '(lỗi — xem phản hồi)'}`, level);
      if (d.text) logUI(`↳ phản hồi: ${d.text.slice(0, 160)}`, 'info');
      return;
    }

    const tail = String(d.url || '').split('?')[0].replace(/^https?:\/\/[^/]+/, '');
    const body = d.body || '';
    const caughtProjectId = extractProjectIdFromBody(body) || extractProjectIdFromValue(d.url || '');
    if (caughtProjectId) rememberProjectId(caughtProjectId, d.kind || d.via || 'flow request');
    rememberCharacterTrace(d);

    const apiKind = effectiveApiKind(d);
    const charCandidate = apiKind !== 'character' && looksLikeCharacterCandidate(d);

    if (apiKind) {
      // Lưu mẫu theo LOẠI: generate (tạo) / upload (ảnh) / session — để phát lại.
      const plan = apiTemplateStoragePlan(d, apiKind);
      const tmpl = { url: d.url, method: d.method || 'POST', headers: d.headers, body: d.body, bodyType: d.bodyType, via: d.via, kind: apiKind, detailKind: plan.detailKind, at: Date.now() };
      if (apiKind === 'generate') lastApiTemplate = tmpl;
      try {
        const save = {};
        for (const key of plan.keys) save[key] = tmpl;
        const videoSettings = apiKind === 'generate' && plan.detailKind !== 'generateUpsample'
          ? summarizeVideoGenerateSettings(d)
          : null;
        if (videoSettings) save.afLastVideoRequestSettings = videoSettings;
        if (Object.keys(save).length) chrome.storage.local.set(save);
      } catch (e) {}
      logUI(`${plan.label}: ${tail} | body=${d.bodyType}(${body.length}) — đã lưu${plan.keys.length ? ' [' + plan.keys.join(', ') + ']' : ''}`, 'success');
    } else {
      // Backend POST khác — log MỖI URL 1 lần để thấy Flow gọi gì (đỡ nhiễu).
      const k = tail.slice(0, 60);
      if (!_seenApi.has(k)) {
        _seenApi.add(k);
        logUI(`📡 Flow gọi: ${tail.slice(0, 72)} [${d.bodyType}]`, 'info');
      }
    }
    if (charCandidate) {
      const tmpl = { url: d.url, method: d.method || 'POST', headers: d.headers, body: d.body, bodyType: d.bodyType, via: d.via, kind: 'characterCandidate', originalKind: d.kind || '', at: Date.now() };
      try { chrome.storage.local.set({ afCharacterCandidateTemplate: tmpl }); } catch (e) {}
      const ck = tail.slice(0, 72);
      if (!_seenCharCandidate.has(ck)) {
        _seenCharCandidate.add(ck);
        logUI(`🔎 Ứng viên API nhân vật/voice: ${ck} | body=${d.bodyType}(${body.length}) — đã lưu để gửi dev`, 'info');
      }
    }
  });

  // ========================
  // INIT
  // ========================
  chrome.storage.local.get(['elementMap'], data => {
    if (data.elementMap) elementMap = data.elementMap;
    log(`🟢 content_script v${EXT_VERSION} ĐÃ NẠP | ${Object.keys(elementMap).length} mappings | ${window.location.href}`);
    setTimeout(() => {
      const pi = DOM.getPromptInput();
      const sb = DOM.getSubmitButton();
      log(`Auto-scan: prompt=${pi ? `<${pi.tagName}>[role=${pi.getAttribute('role')}]` : 'NOT FOUND'}, submit=${sb ? 'FOUND' : 'NOT FOUND'}`);
    }, 3000);
  });

  notify('CONNECTION', { connected: true });

  // SELF-HEAL ON LOAD: if the MAIN-world hook (inject.js) didn't auto-inject —
  // which is exactly what happens right after an extension UPDATE, when Chrome
  // will not re-inject world:MAIN scripts into an already-open tab — force it in
  // so the panel works WITHOUT a manual F5. Give the declarative document_start
  // injection a moment first, then retry a few times only while it's still absent.
  (function selfHealInjectOnLoad() {
    let tries = 0;
    const tick = () => {
      if (afNetSeen || tries >= 3) return;
      tries++;
      ensureInjectLoaded();
      setTimeout(tick, 2000);
    };
    setTimeout(tick, 1500);
  })();

  const badge = document.createElement('div');
  badge.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:2147483647;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;padding:8px 16px;border-radius:24px;font:600 12px -apple-system,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);pointer-events:none;opacity:1;transition:opacity 0.5s;';
  badge.textContent = `✅ AutoFlow v${EXT_VERSION}`;
  document.body.appendChild(badge);
  setTimeout(() => badge.style.opacity = '0', 3000);
  setTimeout(() => badge.remove(), 4000);
})();
