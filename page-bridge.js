(() => {
  const REQUEST = 'SPR_FEEDBACK_GET_HTML';
  const RESPONSE = 'SPR_FEEDBACK_HTML';
  const READY = 'SPR_FEEDBACK_BRIDGE_READY';
  const PING = 'SPR_FEEDBACK_BRIDGE_PING';
  const PARAGRAPH_STATUS_EVENT = 'SPR_PARAGRAPH_STATUS';
  const PARAGRAPH_PLACEHOLDER_TEXT = "I'm a new paragraph block.";
  const RESPONSE_TIMEOUT = 6000;

  let latestApi = null;
  let hookInterval = null;
  const pending = new Map();
  let paragraphMonitor = null;

  function log(...args) {
    try {
      console.debug('[Smartpr Labs][Bridge]', ...args);
    } catch {
      // ignore logging failures
    }
  }

  function post(message) {
    try {
      window.postMessage(message, '*');
    } catch (err) {
      console.error('[SPR Bridge] postMessage failed', err);
    }
  }

  function normalizeHtml(payload) {
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object') {
      if (typeof payload.html === 'string') return payload.html;
      if (typeof payload.content === 'string') return payload.content;
      if (Array.isArray(payload.blocks)) return payload.blocks.join('\n');
    }
    return '';
  }

  function isApiCandidate(value) {
    if (!value || typeof value !== 'object') return false;
    return typeof value.getHtml === 'function'
      || typeof value.getHTML === 'function'
      || typeof value.getTemplate === 'function'
      || typeof value.exportHtml === 'function'
      || typeof value.exportHTML === 'function';
  }

  function describeApi(api) {
    if (!api || typeof api !== 'object') return {};
    return {
      getHtml: typeof api.getHtml === 'function',
      getHTML: typeof api.getHTML === 'function',
      getTemplate: typeof api.getTemplate === 'function',
      exportHtml: typeof api.exportHtml === 'function',
      exportHTML: typeof api.exportHTML === 'function'
    };
  }

  function setLatestApi(api) {
    if (!isApiCandidate(api)) return;
    latestApi = api;
    log('Captured mailing API', describeApi(api));
    notifyReady();
    for (const id of Array.from(pending.keys())) {
      fulfill(id);
    }
    initParagraphMonitor(api);
  }

  function reply(id, html) {
    const entry = pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timeout);
    pending.delete(id);
    const normalized = normalizeHtml(html || '');
    log('Replying with HTML', { id, length: normalized.length });
    post({ type: RESPONSE, id, html: normalized });
  }

  async function fetchHtmlFromApi() {
    if (!latestApi) return '';
    const api = latestApi;
    return new Promise(resolve => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(normalizeHtml(value));
      };

      function runExport(fn, mapper) {
        try {
          const result = fn.call(api, mapper || finish);
          if (typeof result === 'string') finish(result);
          else if (result && typeof result.then === 'function') {
            result.then(res => finish(mapper ? mapper(res) : res)).catch(() => finish(''));
          } else if (!mapper && result !== undefined) {
            finish(result);
          }
        } catch (err) {
          log('Error invoking API method', err?.message || err);
          finish('');
        }
      }

      if (typeof api.getHtml === 'function') {
        runExport(api.getHtml);
      } else if (typeof api.getHTML === 'function') {
        runExport(api.getHTML);
      } else if (typeof api.getTemplate === 'function') {
        runExport(api.getTemplate, res => res?.html ?? '');
      } else if (typeof api.exportHtml === 'function') {
        runExport(api.exportHtml, res => res?.html ?? res);
      } else if (typeof api.exportHTML === 'function') {
        runExport(api.exportHTML, res => res?.html ?? res);
      } else {
        finish('');
      }

      setTimeout(() => finish(''), RESPONSE_TIMEOUT);
    });
  }

  function readHtmlFromAngularScope() {
    if (!window.angular) return '';
    try {
      const node = document.querySelector('publisher-mailing-html, .publisher-mailing-html__root');
      if (!node) return '';
      const ngEl = window.angular.element(node);
      if (!ngEl) return '';
      const iso = typeof ngEl.isolateScope === 'function' ? ngEl.isolateScope() : null;
      const scope = typeof ngEl.scope === 'function' ? ngEl.scope() : null;
      const candidates = [
        iso,
        scope,
        iso?.vm,
        scope?.vm,
        iso?.$ctrl,
        scope?.$ctrl
      ];
      for (const ctx of candidates) {
        if (!ctx) continue;
        const html = ctx.html || ctx.previewHtml || ctx.mailingHtml || ctx.templateHtml;
        if (typeof html === 'string' && html.trim()) {
          log('Read HTML from Angular scope');
          return html.trim();
        }
      }
    } catch (err) {
      log('Angular scope inspection failed', err?.message || err);
    }
    return '';
  }

  function readHtmlFromPreviewIframe() {
    const frame = document.querySelector('.publisher-mailing-html__root iframe.mailing-html__iframe, .publisher-mailing-html__root iframe');
    if (!frame) return '';
    try {
      const doc = frame.contentDocument || frame.contentWindow?.document;
      if (!doc) return '';
      const html = doc.documentElement?.outerHTML || doc.body?.outerHTML || '';
      if (html && html.trim()) {
        log('Read HTML from preview iframe');
        return html.trim();
      }
    } catch (err) {
      log('Preview iframe access failed', err?.message || err);
    }
    return '';
  }

  async function resolveHtml() {
    let html = '';
    if (latestApi) {
      html = await fetchHtmlFromApi();
      if (html) return html;
      log('API returned empty HTML, trying fallbacks');
    }

    html = readHtmlFromAngularScope();
    if (html) return html;

    html = readHtmlFromPreviewIframe();
    if (html) return html;

    return '';
  }

  async function fulfill(id) {
    if (!pending.has(id)) return;
    const html = await resolveHtml();
    reply(id, html);
  }

  function notifyReady() {
    post({ type: READY, hasApi: !!latestApi });
  }

  function wrapGlobalRegisterFunctions() {
    const names = [
      'handleRegisterApi',
      'registerBeeMailingApi',
      'registerMailingApi',
      'onBeeApiReady',
      'onRegisterApi'
    ];
    names.forEach(name => {
      const fn = window[name];
      if (typeof fn === 'function' && !fn.__sprBridgeWrapped) {
        window[name] = function (...args) {
          if (args && args[0]) setLatestApi(args[0]);
          return fn.apply(this, args);
        };
        window[name].__sprBridgeWrapped = true;
        log('Wrapped global register function', name);
      }
    });
  }

  function wrapAngularRegisterCallbacks() {
    if (!window.angular) return;
    const nodes = document.querySelectorAll('[on-register-api], editor-step-edit-bee-mailing__root');
    nodes.forEach(node => {
      try {
        const ngEl = window.angular.element(node);
        if (!ngEl) return;
        const scopes = [];
        if (typeof ngEl.scope === 'function') scopes.push(ngEl.scope());
        if (typeof ngEl.isolateScope === 'function') scopes.push(ngEl.isolateScope());
        scopes.push(scopes[0]?.vm, scopes[1]?.vm, scopes[0]?.$ctrl, scopes[1]?.$ctrl);
        scopes.forEach(ctx => {
          if (!ctx || typeof ctx !== 'object') return;
          ['handleRegisterApi', 'onRegisterApi', 'registerApi'].forEach(prop => {
            const fn = ctx[prop];
            if (typeof fn === 'function' && !fn.__sprBridgeWrapped) {
              ctx[prop] = function (...args) {
                if (args && args[0]) setLatestApi(args[0]);
                return fn.apply(this, args);
              };
              ctx[prop].__sprBridgeWrapped = true;
              log('Wrapped Angular register callback', prop);
            }
          });
          ['api', 'beeApi', 'mailingApi'].forEach(prop => {
            if (isApiCandidate(ctx[prop])) {
              setLatestApi(ctx[prop]);
            }
          });
        });
      } catch (err) {
        log('Error wiring Angular register callback', err?.message || err);
      }
    });
  }

  function captureApiFromGlobals() {
    const candidates = [
      window.editorStepEditBeeMailingApi,
      window.editBeeMailingApi,
      window.beeMailingApi,
      window.currentBeeApi,
      window.latestBeeMailingApi
    ];
    candidates.forEach(obj => {
      if (isApiCandidate(obj)) setLatestApi(obj);
    });
  }

  function initParagraphMonitor(api) {
    if (!api) return;
    if (paragraphMonitor && typeof paragraphMonitor.dispose === 'function') {
      try { paragraphMonitor.dispose(); } catch { /* ignore */ }
    }
    paragraphMonitor = createParagraphMonitor(api);
  }

  function createParagraphMonitor(api) {
    const state = {
      api,
      selectedBlockId: null,
      timer: null,
      disposed: false,
      lastSignature: '',
      unsubscribes: [],
    };

    const schedule = (delay = 160) => {
      if (state.disposed) return;
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        state.timer = null;
        if (state.disposed) return;
        evaluateParagraphState(state);
      }, delay);
    };

    const selectionHandler = payload => {
      const id = extractBlockId(payload);
      if (id) state.selectedBlockId = id;
      schedule(120);
    };

    const changeHandler = () => schedule(200);

    subscribeToParagraphEvents(api, selectionHandler, changeHandler, state);
    schedule(0);

    return {
      dispose() {
        state.disposed = true;
        if (state.timer) clearTimeout(state.timer);
        state.unsubscribes.forEach(fn => {
          try { fn(); } catch { /* ignore */ }
        });
        state.unsubscribes.length = 0;
      }
    };
  }

  function subscribeToParagraphEvents(api, onSelection, onChange, state) {
    const addUnsub = fn => { if (typeof fn === 'function') state.unsubscribes.push(fn); };
    const selectionEvents = ['selection:changed', 'block:select', 'content:select', 'row:select', 'column:select'];
    const changeEvents = ['content:changed', 'block:changed', 'editor:change', 'apply:history', 'undo', 'redo'];

    if (api && typeof api.on === 'function') {
      selectionEvents.forEach(evt => {
        try {
          api.on(evt, onSelection);
          addUnsub(() => { try { api.off?.(evt, onSelection); } catch { /* ignore */ } });
        } catch { /* ignore subscribe errors */ }
      });
      changeEvents.forEach(evt => {
        try {
          api.on(evt, onChange);
          addUnsub(() => { try { api.off?.(evt, onChange); } catch { /* ignore */ } });
        } catch { /* ignore subscribe errors */ }
      });
    }

    if (api && typeof api.addEventListener === 'function') {
      selectionEvents.forEach(evt => {
        try {
          api.addEventListener(evt, onSelection);
          addUnsub(() => { try { api.removeEventListener?.(evt, onSelection); } catch { /* ignore */ } });
        } catch { /* ignore */ }
      });
      changeEvents.forEach(evt => {
        try {
          api.addEventListener(evt, onChange);
          addUnsub(() => { try { api.removeEventListener?.(evt, onChange); } catch { /* ignore */ } });
        } catch { /* ignore */ }
      });
    }

    const editor = api && (api.editor || (typeof api.getEditor === 'function' ? api.getEditor() : null));
    const editorEvents = ['NodeChange', 'SelectionChange', 'Change', 'KeyUp', 'SetContent'];
    if (editor && typeof editor.on === 'function') {
      editorEvents.forEach(evt => {
        try {
          editor.on(evt, onChange);
          addUnsub(() => {
            try { editor.off?.(evt, onChange); } catch { /* ignore */ }
          });
        } catch { /* ignore */ }
      });
    }
  }

  async function evaluateParagraphState(state) {
    try {
      const json = await requestBeeJson(state.api);
      if (!json) return;
      let block = null;
      if (state.selectedBlockId) {
        block = findBlockById(json, state.selectedBlockId);
      }
      if (!block) {
        block = findSelectedTextBlock(json);
      }
      if (!block) {
        post({ type: PARAGRAPH_STATUS_EVENT, status: { blockId: null, blockType: '', isText: false, isEmpty: false, version: Date.now(), source: 'api' } });
        return;
      }
      const blockId = getBlockId(block);
      const blockType = block.type || block.content?.type || block.category || '';
      const isText = isTextBlock(block);
      const isEmpty = isBlockEmpty(block);
      const signature = `${blockId ?? ''}|${isText ? 1 : 0}|${isEmpty ? 1 : 0}`;
      if (signature === state.lastSignature) return;
      state.lastSignature = signature;
      post({
        type: PARAGRAPH_STATUS_EVENT,
        status: {
          blockId,
          blockType,
          isText,
          isEmpty,
          version: Date.now(),
          source: 'api'
        }
      });
    } catch (err) {
      log('Paragraph monitor evaluation failed', err?.message || err);
    }
  }

  function extractBlockId(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.blockId === 'string') return payload.blockId;
    if (typeof payload.id === 'string') return payload.id;
    if (payload.block && typeof payload.block.id === 'string') return payload.block.id;
    if (payload.content && typeof payload.content.id === 'string') return payload.content.id;
    if (typeof payload.uid === 'string') return payload.uid;
    if (typeof payload.cid === 'string') return payload.cid;
    return null;
  }

  function requestBeeJson(api) {
    return new Promise(resolve => {
      if (!api || typeof api.getJson !== 'function') {
        resolve(null);
        return;
      }
      try {
        const result = api.getJson(json => resolve(json || null));
        if (result && typeof result.then === 'function') {
          result.then(json => resolve(json || null)).catch(() => resolve(null));
        } else if (result && typeof result === 'object') {
          resolve(result);
        }
      } catch (err) {
        log('getJson failed', err?.message || err);
        resolve(null);
      }
      setTimeout(() => resolve(null), 4000);
    });
  }

  function findBlockById(node, id) {
    if (!node || !id || typeof node !== 'object') return null;
    if (getBlockId(node) === id) return node;
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (!value) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          const found = findBlockById(item, id);
          if (found) return found;
        }
      } else if (typeof value === 'object') {
        const found = findBlockById(value, id);
        if (found) return found;
      }
    }
    return null;
  }

  function findSelectedTextBlock(node) {
    let match = null;
    const visit = current => {
      if (!current || typeof current !== 'object' || match) return;
      if (isTextBlock(current) && (current.selected || current.isSelected || current.focused || current.active)) {
        match = current;
        return;
      }
      for (const key of Object.keys(current)) {
        const value = current[key];
        if (!value) continue;
        if (Array.isArray(value)) {
          value.forEach(visit);
        } else if (typeof value === 'object') {
          visit(value);
        }
      }
    };
    visit(node);
    return match;
  }

  function getBlockId(block) {
    if (!block || typeof block !== 'object') return null;
    return block.id || block.blockId || block.uid || block.cid || null;
  }

  function isTextBlock(block) {
    if (!block || typeof block !== 'object') return false;
    const type = (block.type || block.content?.type || block.category || '').toString().toLowerCase();
    if (!type) return false;
    return type.includes('text') || type.includes('paragraph') || type.includes('body') || type.includes('copy');
  }

  function stripHtml(html) {
    return (html || '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isBlockEmpty(block) {
    if (!block || typeof block !== 'object') return false;
    const content = block.content || block.values || {};
    let html = '';
    if (typeof content.html === 'string') html = content.html;
    else if (typeof content.text === 'string') html = content.text;
    else if (typeof block.html === 'string') html = block.html;
    const text = stripHtml(html);
    if (!text) return true;
    return text.toLowerCase() === PARAGRAPH_PLACEHOLDER_TEXT.toLowerCase();
  }

  window.addEventListener('message', event => {
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;
    const { type, id } = event.data;
    if (type === REQUEST && id) {
      log('Received HTML request', { id, hasApi: !!latestApi });
      if (!pending.has(id)) {
        const timeout = setTimeout(() => {
          pending.delete(id);
          log('Request timed out before resolution', { id });
          reply(id, '');
        }, RESPONSE_TIMEOUT);
        pending.set(id, { timeout });
      }
      fulfill(id);
    } else if (type === PING) {
      log('Received bridge ping');
      notifyReady();
    }
  }, false);

  wrapGlobalRegisterFunctions();
  wrapAngularRegisterCallbacks();
  captureApiFromGlobals();
  notifyReady();
  log('Bridge initialized');

  if (!hookInterval) {
    hookInterval = setInterval(() => {
      wrapGlobalRegisterFunctions();
      wrapAngularRegisterCallbacks();
      captureApiFromGlobals();
    }, 1500);
  }
})();
