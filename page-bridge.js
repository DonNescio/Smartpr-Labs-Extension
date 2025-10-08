(() => {
  const REQUEST = 'SPR_FEEDBACK_GET_HTML';
  const RESPONSE = 'SPR_FEEDBACK_HTML';
  const READY = 'SPR_FEEDBACK_BRIDGE_READY';
  const PING = 'SPR_FEEDBACK_BRIDGE_PING';
  const RESPONSE_TIMEOUT = 6000;

  let latestApi = null;
  let hookInterval = null;
  const pending = new Map();

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
