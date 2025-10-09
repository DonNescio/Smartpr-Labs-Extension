/* content.js — Smart.pr Labs: Angle Assistant (MV3)
 * - Injects a "Generate angles" button next to Smart.pr "Create content"
 * - Mirrors disabled state of the native Create content button
 * - Modal with Subject (prefilled), optional Short description
 * - Generate concise angles (1-sentence perspectives)
 * - Press release generator from any generated angle
 * - Uses chrome.storage.sync for OpenAI key (set in options page)
 */

// ---------- Utilities ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function deepQuerySelectorAll(selector, roots = [document]) {
  const results = new Set();
  const queue = [...roots];
  const visited = new Set();

  while (queue.length) {
    const root = queue.shift();
    if (!root || visited.has(root)) continue;
    visited.add(root);

    if (typeof root.querySelectorAll === 'function') {
      let matches = [];
      try { matches = root.querySelectorAll(selector); } catch { matches = []; }
      matches.forEach(el => results.add(el));
      let frames = [];
      try { frames = root.querySelectorAll('iframe'); } catch { frames = []; }
      frames.forEach(frame => {
        try {
          const doc = frame.contentDocument || frame.contentWindow?.document;
          if (doc) queue.push(doc);
        } catch {
          // Ignore cross-origin frames.
        }
      });

      let elements = [];
      try { elements = root.querySelectorAll('*'); } catch { elements = []; }
      elements.forEach(el => {
        if (el.shadowRoot) queue.push(el.shadowRoot);
      });
    }
  }

  return Array.from(results);
}

const storage = {
  get: (k, d = null) => new Promise(r => chrome.storage.sync.get([k], v => r(v[k] ?? d))),
  set: (k, v) => new Promise(r => chrome.storage.sync.set({ [k]: v }, r)),
};

const localStore = {
  get: (k, d = null) => new Promise(r => chrome.storage.local.get([k], v => r(v[k] ?? d))),
  set: (k, v) => new Promise(r => chrome.storage.local.set({ [k]: v }, r)),
};

const FEATURE_KEYS = {
  angleAssistant: 'feature_angle_assistant',
  prFeedback: 'feature_pr_feedback',
  paragraphWriter: 'feature_paragraph_writer',
};
const LABS_DISABLED_KEY = 'labs_disabled';

const DEFAULT_FEATURE_FLAGS = {
  angleAssistant: true,
  prFeedback: true,
  paragraphWriter: true,
};

const STORAGE_KEYS = [...Object.values(FEATURE_KEYS), LABS_DISABLED_KEY];

const PARAGRAPH_PLACEHOLDER_TEXT = "I'm a new paragraph block.";
const BEE_FRAME_ORIGIN = 'https://app.getbee.io';
const PARAGRAPH_STATUS_EVENT = 'SPR_PARAGRAPH_STATUS';
const PARAGRAPH_FRAME_STATUS_EVENT = 'SPR_PARAGRAPH_FRAME_STATUS';
const PARAGRAPH_APPLY_EVENT = 'SPR_PARAGRAPH_APPLY';
const PARAGRAPH_APPLY_RESULT_EVENT = 'SPR_PARAGRAPH_APPLY_RESULT';

let featureFlags = { ...DEFAULT_FEATURE_FLAGS };
let featuresReady = false;
let extensionDisabled = false;

const normalizeFeatureValue = (value, fallback = true) => (typeof value === 'boolean' ? value : fallback);

function loadFeatureFlags() {
  return new Promise(resolve => {
    chrome.storage.sync.get(STORAGE_KEYS, stored => {
      extensionDisabled = Boolean(stored[LABS_DISABLED_KEY]);
      featureFlags = {
        angleAssistant: normalizeFeatureValue(stored[FEATURE_KEYS.angleAssistant], DEFAULT_FEATURE_FLAGS.angleAssistant),
        prFeedback: normalizeFeatureValue(stored[FEATURE_KEYS.prFeedback], DEFAULT_FEATURE_FLAGS.prFeedback),
        paragraphWriter: normalizeFeatureValue(stored[FEATURE_KEYS.paragraphWriter], DEFAULT_FEATURE_FLAGS.paragraphWriter),
      };
      featuresReady = true;
      resolve(featureFlags);
    });
  });
}

function applyFeatureUpdates(partialFlags = {}) {
  let changed = false;
  const next = { ...featureFlags };
  for (const key of Object.keys(partialFlags)) {
    if (key in next && partialFlags[key] !== undefined && next[key] !== partialFlags[key]) {
      next[key] = partialFlags[key];
      changed = true;
    }
  }
  if (!changed) return;
  featureFlags = next;
  if (!featureFlags.angleAssistant) teardownAngleAssistant();
  if (!featureFlags.prFeedback) teardownPRFeedback();
  if (!featureFlags.paragraphWriter) teardownParagraphWriter();
  runInjections();
}

const USAGE_KEY = 'sase_usage';

async function recordUsage(usage = {}) {
  try {
    const current = await localStore.get(USAGE_KEY, {
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      lastUpdated: 0,
    });
    const next = {
      requests: (current.requests || 0) + 1,
      promptTokens: (current.promptTokens || 0) + (usage.prompt_tokens || 0),
      completionTokens: (current.completionTokens || 0) + (usage.completion_tokens || 0),
      totalTokens: (current.totalTokens || 0) + (usage.total_tokens || ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0))),
      lastUpdated: Date.now(),
    };
    await localStore.set(USAGE_KEY, next);
  } catch (err) {
    console.debug('[Smartpr Labs] Failed to record usage', err);
  }
}

function escapeHTML(s) {
  return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return escapeHTML(s).replace(/\n/g, ' ');
}
function safeParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}
async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
}
function toast(msg) {
  const el = document.createElement('div');
  el.textContent = msg;
  Object.assign(el.style, {
    position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)',
    background: '#0f2c36', color: '#e7f3f7', padding: '10px 14px', borderRadius: '10px',
    border: '1px solid #2a5563', zIndex: 1000000,
    font: '13px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial'
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1800);
}

function getSubjectField() {
  // Common selectors for the Subject input on the Smart.pr form
  return $('input[placeholder="Please type your subject"], input[name="subject"], input[aria-label="Subject"]');
}

function getSenderField() {
  return $('input[name="sender__label"], input[name="sender_label"], input[aria-label="Sender"], input[placeholder="Search sender..."]');
}

// ---------- API key handling ----------
async function getApiKey() {
  const key = await storage.get('sase_api', '');
  if (!key) {
    if (confirm('OpenAI API key not set. Open extension settings now?')) {
      chrome.runtime.sendMessage({ action: 'openOverviewPage' });
    }
    throw new Error('Missing API key');
  }
  return key;
}

// ---------- OpenAI call ----------
async function openAIChat(apiKey, systemPrompt, userPrompt, temperature = 0.8) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature
    })
  });
  if (!resp.ok) {
    let raw = '';
    let message = '';
    let code = '';
    try {
      raw = await resp.text();
      try {
        const parsed = JSON.parse(raw);
        message = parsed?.error?.message || parsed?.message || '';
        code = parsed?.error?.code || parsed?.error?.type || '';
      } catch {
        message = raw;
      }
    } catch {
      message = '';
    }
    const error = new Error(message || `OpenAI request failed (${resp.status})`);
    error.status = resp.status;
    error.raw = raw;
    if (!code) {
      if (/insufficient_quota|exceeded.+quota/i.test(message)) code = 'quota_exceeded';
      else code = `http_${resp.status}`;
    }
    error.code = code;
    if (/insufficient_quota|exceeded.+quota/i.test(message)) {
      error.code = 'quota_exceeded';
    }
    throw error;
  }
  const data = await resp.json();
  recordUsage(data?.usage || {}).catch(() => {});
  return data.choices?.[0]?.message?.content ?? '';
}

function getOpenAIErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  const rawMessage = typeof err.message === 'string' ? err.message : '';
  const lower = rawMessage.toLowerCase();
  const code = typeof err.code === 'string' ? err.code.toLowerCase() : '';

  if (code === 'quota_exceeded' || /insufficient_quota|exceeded.+quota/.test(lower)) {
    return 'OpenAI quota exceeded. Add credits or use a different API key.';
  }
  if (err.status === 401 || /invalid api key|incorrect api key/.test(lower)) {
    return 'OpenAI API key looks invalid. Please update it in the extension settings.';
  }
  if (err.status === 429 || /rate limit/.test(lower)) {
    return 'OpenAI rate limit reached. Wait a moment and try again.';
  }
  return fallback;
}

const PR_FEEDBACK_SYSTEM_PROMPT = `
Act as a **senior PR editor and email deliverability coach**.
You receive raw HTML of a press-release mailing.

Your job: deliver clear, concise editorial feedback that helps the sender make their mailing more professional, engaging, and correct.

### Review checklist
1. Strip all HTML and read only the text.
2. Detect the dominant language (Dutch or English) and respond **entirely in that language**, including all headings.
3. Evaluate:
   - Clarity and structure
   - Tone and storytelling
   - Grammar, spelling, and punctuation (list specific typos if any)
   - Readability and sentence flow
   - Call-to-action clarity **(ignore standard unsubscribe links added automatically by email software)**

### Write your response in plain text with the following three sections, using headings in the same language as the text:
**Sterktes** (if Dutch) / **Strengths** (if English)  
Summarize 3–5 clear positives (e.g. human quotes, news angle, tone, flow).

**Verbeterpunten** (if Dutch) / **Areas for improvement** (if English)  
Point out concrete issues — including grammar or spelling errors — and explain briefly why they matter.

**Aanpak** (if Dutch) / **Action plan** (if English)  
List practical next steps or short rewrite examples showing how to fix the problems. Use bullet points or short paragraphs, not code blocks or Markdown symbols.

### Style guidelines
- Be professional, pragmatic, and concise.
- Avoid Markdown syntax like #, ####, or triple backticks.
- Never restate the whole text; focus only on insights.
- Do not include raw HTML.
`;

const PARAGRAPH_WRITER_SYSTEM_PROMPT = `
You are a senior email copywriter assisting a Smart.pr user while they draft a mailing.
You receive the raw HTML of the entire mailing that is currently being edited.

Your job: write the next paragraph that continues the story naturally.

Guidelines:
1. Strip all HTML and read only the text.
2. Detect the dominant language (Dutch or English) and respond entirely in that language.
3. Match the existing tone, voice, and level of formality.
4. Provide exactly one new paragraph (2–4 sentences) that adds new information, insight, or value.
5. Avoid repeating existing sentences, avoid greetings or farewells, and do not include unsubscribe or legal boilerplate.

Return plain text only — no quotation marks, markdown, bullets, or HTML.
`;




const BRIDGE_SCRIPT_ID = 'spr-pr-feedback-bridge';
const BRIDGE_REQUEST = 'SPR_FEEDBACK_GET_HTML';
const BRIDGE_RESPONSE = 'SPR_FEEDBACK_HTML';
const BRIDGE_READY = 'SPR_FEEDBACK_BRIDGE_READY';
const BRIDGE_PING = 'SPR_FEEDBACK_BRIDGE_PING';

let bridgeReady = false;
let bridgeReadyWaiters = [];
const bridgeHtmlRequests = new Map();
let lastFeedbackInput = '';
let inputModal = null;

function logFeedback(...args) {
  try {
    console.debug('[Smartpr Labs][Feedback]', ...args);
  } catch {
    // ignore logging errors
  }
}

function markdownToHtml(md) {
  if (!md) return '';
  const escaped = escapeHTML(md);
  const withLists = escaped.replace(/(^|\n)(- .+(?:\n- .+)*)/g, (match, prefix, listBlock) => {
    const items = listBlock.trim().split('\n')
      .map(line => line.replace(/^- /, '').trim())
      .filter(Boolean)
      .map(item => `<li>${item}</li>`)
      .join('');
    return `${prefix}<ul>${items}</ul>`;
  });

  let html = withLists
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/(?:\r?\n){2,}/g, '</p><p>');
  html = html.replace(/(?:\r?\n)/g, '<br>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p>(\s*<ul>)/g, '$1').replace(/(<\/ul>)\s*<\/p>/g, '$1');
  html = html.replace(/<p>(\s*<h[1-6]>)/g, '$1').replace(/(<\/h[1-6]>)\s*<\/p>/g, '$1');
  return html;
}

function ensureFeedbackInputModal() {
  if (inputModal && document.body.contains(inputModal)) return inputModal;
  const modal = document.createElement('div');
  modal.id = 'spr-feedback-input-modal';
  modal.innerHTML = `
    <div class="spr-feedback-input-card">
      <div class="spr-feedback-input-header">
        <strong>Input sent to ChatGPT</strong>
        <button type="button" class="spr-feedback-action" data-feedback-input-close title="Close">✕</button>
      </div>
      <textarea readonly class="spr-feedback-input-text"></textarea>
    </div>
  `;
  document.body.appendChild(modal);
  const closeBtn = modal.querySelector('[data-feedback-input-close]');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  inputModal = modal;
  return modal;
}

function showFeedbackInputModal() {
  if (!lastFeedbackInput) {
    toast('No input captured yet.');
    return;
  }
  const modal = ensureFeedbackInputModal();
  const textarea = modal.querySelector('.spr-feedback-input-text');
  if (textarea) {
    textarea.value = lastFeedbackInput;
    textarea.scrollTop = 0;
  }
  modal.style.display = 'flex';
}

function handleBridgeMessage(event) {
  if (!event || !event.data || typeof event.data !== 'object') return;
  const { type, html, id } = event.data;
  if (!type) return;

  if (event.source === window) {
    if (type === BRIDGE_READY) {
      bridgeReady = true;
      const waiters = bridgeReadyWaiters.slice();
      bridgeReadyWaiters = [];
      waiters.forEach(fn => { try { fn(); } catch { /* ignore */ } });
      logFeedback('Bridge reported ready');
    } else if (type === BRIDGE_RESPONSE && id) {
      const pending = bridgeHtmlRequests.get(id);
      if (!pending) return;
      bridgeHtmlRequests.delete(id);
      clearTimeout(pending.timeout);
      pending.resolve(typeof html === 'string' ? html.trim() : '');
      logFeedback('Received HTML from bridge', { id, length: html ? html.length : 0 });
    } else if (type === PARAGRAPH_STATUS_EVENT) {
      onParagraphStatus(event.data);
    }
  } else if (typeof event.origin === 'string' && event.origin.includes('app.getbee.io')) {
    if (type === PARAGRAPH_FRAME_STATUS_EVENT) {
      onParagraphFrameStatus(event.data);
    } else if (type === PARAGRAPH_APPLY_RESULT_EVENT) {
      onParagraphApplyResult(event.data);
    }
  }
}

if (!window.__sprFeedbackBridgeListenerAttached) {
  window.addEventListener('message', handleBridgeMessage, false);
  window.__sprFeedbackBridgeListenerAttached = true;
}

function injectBeeBridge() {
  if (document.getElementById(BRIDGE_SCRIPT_ID)) return;
  const script = document.createElement('script');
  script.id = BRIDGE_SCRIPT_ID;
  script.src = chrome.runtime.getURL('page-bridge.js');
  script.async = false;
  script.onload = () => {
    setTimeout(() => {
      if (script.parentNode) script.parentNode.removeChild(script);
    }, 0);
  };
  (document.head || document.documentElement).appendChild(script);
  logFeedback('Injected page bridge');
}

function waitForBridgeReady(timeout = 6000) {
  if (bridgeReady) return Promise.resolve(true);
  injectBeeBridge();
  return new Promise(resolve => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      bridgeReadyWaiters = bridgeReadyWaiters.filter(fn => fn !== onReady);
      logFeedback('Bridge ready wait timed out after', timeout, 'ms');
      resolve(false);
    }, timeout);
    const onReady = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      bridgeReadyWaiters = bridgeReadyWaiters.filter(fn => fn !== onReady);
      logFeedback('Bridge ready wait resolved');
      resolve(true);
    };
    bridgeReadyWaiters.push(onReady);
    try { window.postMessage({ type: BRIDGE_PING }, '*'); } catch { /* ignore */ }
  });
}

async function requestBeeHtmlViaBridge(timeout = 6000) {
  injectBeeBridge();
  await waitForBridgeReady(6000);

  const id = `spr-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      bridgeHtmlRequests.delete(id);
      logFeedback('Bridge request timed out', { id, timeout });
      resolve('');
    }, timeout);
    bridgeHtmlRequests.set(id, { resolve, timeout: timer });
    try {
      window.postMessage({ type: BRIDGE_REQUEST, id }, '*');
      logFeedback('Requested HTML from bridge', { id });
    } catch {
      clearTimeout(timer);
      bridgeHtmlRequests.delete(id);
      logFeedback('Failed to post request to bridge', { id });
      resolve('');
    }
  });
}

// ---------- Modal UI ----------
function ensureModal() {
  if ($('#sase-modal')) return;

  const wrap = document.createElement('div');
  wrap.id = 'sase-modal';
  wrap.innerHTML = `
    <div class="sase-card">
      <div class="sase-row">
        <strong>Smart.pr Labs — Angle Assistant</strong>
        <button class="sase-btn secondary" id="sase-settings" title="Open settings">⚙️</button>
        <button class="sase-close" title="Close" id="sase-close">✕</button>
      </div>

      <div class="sase-row">
        <input id="sase-subject" type="text" placeholder="Subject line (prefilled from the form)" />
      </div>

      <div class="sase-row">
        <input id="sase-sender" type="text" placeholder="Sender (prefilled from the form)" />
      </div>

      <div class="sase-row">
        <textarea id="sase-desc" rows="3" placeholder="Optional: short description / context (e.g., what’s new, data points, launch details)"></textarea>
      </div>

      <div class="sase-row">
        <button id="sase-gen-angles" class="sase-btn">✨ Generate angles</button>
        <button id="sase-clear" class="sase-btn secondary">Clear</button>
      </div>

      <div class="sase-row sase-small">
        Angles are one-sentence perspectives you can take on the story. Use any of them to draft a press release.
      </div>

      <div class="sase-row"><strong>Angles</strong></div>
      <div id="sase-angles" class="sase-list"></div>
    </div>
  `;
  document.body.appendChild(wrap);

  // Wire controls
  $('#sase-close').onclick = () => $('#sase-modal').style.display = 'none';
  $('#sase-clear').onclick = () => { $('#sase-angles').innerHTML = ''; };
  $('#sase-settings').onclick = () => chrome.runtime.sendMessage({ action: 'openOverviewPage' });
  $('#sase-gen-angles').onclick = onGenerateAngles;
}

function setBusy(btnId, busy) {
  const btn = $(btnId);
  if (!btn) return;
  btn.disabled = busy;
  const orig = btn.dataset.label || btn.textContent;
  if (!btn.dataset.label) btn.dataset.label = orig;
  btn.textContent = busy ? 'Working…' : btn.dataset.label;
}

// ---------- Generators ----------
async function onGenerateAngles() {
  const subject = $('#sase-subject').value.trim();
  const desc = $('#sase-desc').value.trim();
  if (!subject) return toast('Please enter a subject.');

  let key; try { key = await getApiKey(); } catch { return; }

  const sys = `You are a senior PR strategist. Produce concise, one-sentence "angles" (perspectives) on the topic.
Return JSON only: {"angles":[ "…", "…", ... ]} with 1–5 items (never more than five). Each item <= 30 words, crisp, distinct.
Determine the dominant language of the subject line and write every angle in that language. Do not translate into English unless the subject itself is in English.`;
  const user = `Subject line: ${subject}
${desc ? `Short description: ${desc}` : ''}
All output must stay in the same language as the subject line.`;

  setBusy('#sase-gen-angles', true);
  try {
    const json = await openAIChat(key, sys, user, 0.7);
    const parsed = safeParseJSON(json);
    renderAngles(parsed?.angles || []);
  } catch (e) {
    console.error('[SASE] angles error', e);
    toast(getOpenAIErrorMessage(e, 'Error generating angles.'));
  } finally {
    setBusy('#sase-gen-angles', false);
  }
}

// ---------- Renderers ----------
function renderAngles(angles) {
  const box = $('#sase-angles');
  box.innerHTML = '';
  const trimmed = (angles || []).map(a => typeof a === 'string' ? a.trim() : '').filter(Boolean).slice(0, 5);
  if (!trimmed.length) {
    box.innerHTML = '<div class="sase-small">No angles generated.</div>';
    return;
  }

  trimmed.forEach((angle, idx) => {
    const div = document.createElement('div');
    div.className = 'sase-item';
    div.innerHTML = `
      <h4>Angle #${idx + 1}</h4>
      <div class="sase-small">${escapeHTML(angle)}</div>

      <div class="sase-actions" style="margin-top:8px">
        <button class="sase-btn" data-copy-angle="${escapeAttr(angle)}">Copy angle</button>
        <button class="sase-btn secondary" data-pressrelease-angle="${escapeAttr(angle)}">Write press release</button>
        <button class="sase-btn secondary" data-copy-pr style="display:none">Copy press release</button>
      </div>

      <pre class="sase-mono sase-small" style="white-space:pre-wrap; display:none"></pre>
    `;
    box.appendChild(div);

    div.querySelector('[data-copy-angle]').onclick = async (e) => {
      await copyToClipboard(e.target.getAttribute('data-copy-angle'));
      toast('Angle copied.');
    };

    div.querySelector('[data-pressrelease-angle]').onclick = async (e) => {
      const ang = e.target.getAttribute('data-pressrelease-angle');
      await writePressReleaseFromAngle(div, ang);
    };

    const copyPrBtn = div.querySelector('[data-copy-pr]');
    if (copyPrBtn) {
      copyPrBtn.onclick = async () => {
        const pre = div.querySelector('pre');
        if (!pre?.textContent?.trim()) return toast('No press release yet.');
        await copyToClipboard(pre.textContent);
        toast('Press release copied.');
      };
    }
  });
}

// ---------- Press release writers ----------
async function writePressReleaseFromAngle(container, angle) {
  let key; try { key = await getApiKey(); } catch { return; }
  const subject = $('#sase-subject').value.trim();
  const desc = $('#sase-desc').value.trim();
  const sender = $('#sase-sender')?.value.trim();

  const sys = `You are a PR copywriter. Based on the provided one-sentence angle and context, craft a compelling press release with your own strong headline.
Length ≈300–350 words. 
Structure:
- Headline (you create)
- Dek (1 sentence)
- City, Date —
- Body with two quotes (one CEO/founder, one external expert)
- Boilerplate
- Media contact (use the provided sender details verbatim when available; otherwise create a brief placeholder)
Tone: clear, factual, newsworthy. Avoid fluff.
Determine the dominant language of the provided angle or subject and write the entire press release in that language. Only default to English if the language cannot be determined.`;
  const user = `Angle: ${angle}
Subject line: ${subject}
${desc ? `Context: ${desc}` : ''}
${sender ? `Sender contact (use verbatim for the Media contact line): ${sender}` : 'Sender contact: Not provided; create a short placeholder.'}
Language requirement: Match the language used in the angle/subject.`;

  try {
    setPressReleaseBusy(container, true);
    const text = await openAIChat(key, sys, user, 0.7);
    showPR(container, text);
  } catch (e) {
    console.error('[SASE] PR from angle error', e);
    toast(getOpenAIErrorMessage(e, 'Error writing press release.'));
    resetPressRelease(container);
  } finally {
    setPressReleaseBusy(container, false);
  }
}

function showPR(container, text) {
  const pre = container.querySelector('pre');
  pre.textContent = text.trim();
  pre.style.display = 'block';
  const actionRow = container.querySelector('.sase-actions');
  const copyBtn = actionRow?.querySelector('[data-copy-pr]');
  if (copyBtn) {
    copyBtn.style.display = '';
    copyBtn.disabled = false;
  }
}

function setPressReleaseBusy(container, busy) {
  const btn = container.querySelector('[data-pressrelease-angle]');
  if (!btn) return;
  const copyBtn = container.querySelector('[data-copy-pr]');
  const pre = container.querySelector('pre');
  if (busy) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.textContent = 'Generating…';
    btn.disabled = true;
    if (copyBtn) {
      copyBtn.style.display = 'none';
      copyBtn.disabled = true;
    }
    if (pre) {
      pre.textContent = 'Generating press release…';
      pre.style.display = 'block';
    }
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.textContent = btn.dataset.label;
  }
}

function resetPressRelease(container) {
  const pre = container.querySelector('pre');
  if (pre) {
    pre.textContent = '';
    pre.style.display = 'none';
  }
  const copyBtn = container.querySelector('[data-copy-pr]');
  if (copyBtn) {
    copyBtn.style.display = 'none';
    copyBtn.disabled = false;
  }
}

// ---------- Button injection & state mirroring ----------
let mirrorInterval = null;

function ensureInjected() {
  if (!featureFlags.angleAssistant) return;
  // Match your Angular markup
  const candidates = $$('button.form-mailing-edit__button, button[ng-click="onDesignClick();"]');
  const createBtn = candidates.find(b => (b.textContent || '').trim().toLowerCase() === 'create content');
  if (!createBtn) return;

  // Avoid duplicate injection
  if (!createBtn.dataset.saseInjected) {
    const genBtn = document.createElement('button');
    genBtn.type = 'button';
    genBtn.className = 'form-mailing-edit__button ui-button__root ui-button__root--default ui-button__root--big sase-generate-btn';
    genBtn.textContent = '✨ Generate angles';
    createBtn.insertAdjacentElement('afterend', genBtn);
    createBtn.dataset.saseInjected = '1';

    // Build modal once
    ensureModal();

    // Open modal + prefill Subject from the real field
    genBtn.addEventListener('click', () => {
      const subjField = getSubjectField();
      const modalSubj = $('#sase-subject');
      if (modalSubj) modalSubj.value = subjField && subjField.value ? subjField.value.trim() : '';
      const senderField = getSenderField();
      const modalSender = $('#sase-sender');
      if (modalSender) modalSender.value = senderField && senderField.value ? senderField.value.trim() : '';
      $('#sase-modal').style.display = 'flex';
    });
  }

  // Mirror disabled state onto our button
  const ourBtn = createBtn.nextElementSibling && createBtn.nextElementSibling.classList.contains('sase-generate-btn')
    ? createBtn.nextElementSibling
    : null;
  if (!ourBtn) return;

  const mirror = () => {
    const isDisabled = createBtn.hasAttribute('disabled') || createBtn.disabled || createBtn.classList.contains('ui-button__root--disabled');
    ourBtn.disabled = !!isDisabled;
    // Optional: style parity (grey out)
    if (isDisabled) {
      ourBtn.style.opacity = '0.6';
      ourBtn.style.pointerEvents = 'none';
    } else {
      ourBtn.style.opacity = '';
      ourBtn.style.pointerEvents = '';
    }
  };
  mirror();

  // Watch attribute changes to keep in sync
  const attrObs = new MutationObserver(mirror);
  attrObs.observe(createBtn, { attributes: true, attributeFilter: ['disabled', 'class', 'aria-disabled'] });
  if (createBtn._saseObserver) {
    try { createBtn._saseObserver.disconnect(); } catch { /* ignore */ }
  }
  createBtn._saseObserver = attrObs;

  // Also poll lightly in case Angular swaps the node
  if (mirrorInterval) clearInterval(mirrorInterval);
  mirrorInterval = setInterval(() => {
    if (!document.body.contains(createBtn)) {
      clearInterval(mirrorInterval);
      return;
    }
    mirror();
  }, 800);
}

function teardownAngleAssistant() {
  if (mirrorInterval) {
    clearInterval(mirrorInterval);
    mirrorInterval = null;
  }
  $$('.sase-generate-btn').forEach(btn => btn.remove());
  const modal = $('#sase-modal');
  if (modal) modal.remove();
  $$('[data-sase-injected]').forEach(btn => {
    if (btn._saseObserver) {
      try { btn._saseObserver.disconnect(); } catch { /* ignore */ }
      delete btn._saseObserver;
    }
    btn.removeAttribute('data-sase-injected');
  });
}

// ---------- Paragraph Writer ----------
let paragraphOverlayEl = null;
let paragraphOverlayButton = null;
let paragraphOverlayVisible = false;
let paragraphOverlayBusy = false;
let paragraphOverlayInitialized = false;
let paragraphOverlayListenersAttached = false;
let paragraphOverlayHint = null;
const PARAGRAPH_OVERLAY_HINT_DEFAULT = 'Draft the next lines with AI.';
let paragraphWriterInfo = {
  blockId: null,
  blockType: '',
  isEmpty: false,
  isText: false,
  version: 0,
  source: '',
  timestamp: 0,
  rect: null,
};
let lastGeneratedParagraph = '';
let paragraphApplyTimeout = null;

function initParagraphWriter() {
  if (!featureFlags.paragraphWriter) return;
  ensureParagraphOverlay();
  attachParagraphOverlayListeners();
  paragraphOverlayInitialized = true;
}

function ensureParagraphOverlay() {
  if (paragraphOverlayEl) return paragraphOverlayEl;
  const overlay = document.createElement('div');
  overlay.id = 'spr-paragraph-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    zIndex: '1000001',
    display: 'none',
    alignItems: 'center',
    gap: '12px',
    background: 'linear-gradient(130deg, rgba(20,196,163,0.92), rgba(15,123,255,0.9))',
    color: '#071821',
    padding: '12px 16px',
    borderRadius: '16px',
    border: '1px solid rgba(7,24,33,0.18)',
    boxShadow: '0 16px 32px rgba(7,24,33,0.28)',
    backdropFilter: 'blur(10px)'
  });

  const contentWrap = document.createElement('div');
  Object.assign(contentWrap.style, {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  });

  const label = document.createElement('span');
  label.textContent = 'Paragraph Writer';
  Object.assign(label.style, {
    font: '600 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
    letterSpacing: '0.02em',
    textTransform: 'uppercase'
  });

  const hint = document.createElement('span');
  hint.textContent = PARAGRAPH_OVERLAY_HINT_DEFAULT;
  Object.assign(hint.style, {
    font: '12px/1.3 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
    color: '#032030',
    opacity: '0.85'
  });
  paragraphOverlayHint = hint;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'spr-paragraph-overlay-btn';
  button.textContent = '✨ Write paragraph';
  Object.assign(button.style, {
    font: '600 13px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif',
    padding: '8px 12px',
    borderRadius: '12px',
    border: '1px solid rgba(7,24,33,0.15)',
    background: '#ffffff',
    color: '#0b3544',
    cursor: 'pointer'
  });
  button.addEventListener('click', handleParagraphOverlayClick);
  button.addEventListener('mouseenter', () => button.style.background = '#f1f5ff');
  button.addEventListener('mouseleave', () => button.style.background = '#ffffff');
  button.addEventListener('mousedown', evt => {
    evt.preventDefault();
  });
  button.tabIndex = -1;

  contentWrap.appendChild(label);
  contentWrap.appendChild(hint);

  overlay.appendChild(contentWrap);
  overlay.appendChild(button);
  document.body.appendChild(overlay);

  paragraphOverlayEl = overlay;
  paragraphOverlayButton = button;
  return overlay;
}

function attachParagraphOverlayListeners() {
  if (paragraphOverlayListenersAttached) return;
  const reposition = () => positionParagraphOverlay();
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition, true);
  paragraphOverlayListenersAttached = true;
}

function detachParagraphOverlayListeners() {
  if (!paragraphOverlayListenersAttached) return;
  window.removeEventListener('scroll', positionParagraphOverlay, true);
  window.removeEventListener('resize', positionParagraphOverlay, true);
  paragraphOverlayListenersAttached = false;
}

function positionParagraphOverlay() {
  if (!paragraphOverlayEl || paragraphOverlayEl.style.display === 'none') return;
  const frame = getBeeIframe();
  if (!frame) {
    hideParagraphOverlay(true);
    return;
  }
  const frameRect = frame.getBoundingClientRect();
  if (!frameRect || frameRect.width <= 0 || frameRect.height <= 0) {
    hideParagraphOverlay(true);
    return;
  }
  const overlayWidth = paragraphOverlayEl.offsetWidth || 220;
  const overlayHeight = paragraphOverlayEl.offsetHeight || 48;
  const offset = 12;

  const blockRect = paragraphWriterInfo.rect;
  if (blockRect && blockRect.width > 0 && blockRect.height > 0) {
    let left = frameRect.left + blockRect.left + blockRect.width - overlayWidth + offset;
    let top = frameRect.top + blockRect.top - overlayHeight - offset;
    if (left < frameRect.left + offset) left = frameRect.left + blockRect.left + offset;
    if (top < frameRect.top + offset) {
      top = frameRect.top + blockRect.top + blockRect.height + offset;
    }
    paragraphOverlayEl.style.left = `${Math.max(left, 12)}px`;
    paragraphOverlayEl.style.top = `${Math.max(top, 12)}px`;
    return;
  }

  const leftFallback = frameRect.right - overlayWidth - offset;
  const topFallback = frameRect.bottom - overlayHeight - offset;
  paragraphOverlayEl.style.left = `${Math.max(leftFallback, frameRect.left + offset, 12)}px`;
  paragraphOverlayEl.style.top = `${Math.max(topFallback, frameRect.top + offset, 12)}px`;
}

function getBeeIframe() {
  return document.querySelector('iframe[src*="app.getbee.io"]');
}

function showParagraphOverlay() {
  if (!featureFlags.paragraphWriter) return;
  const overlay = ensureParagraphOverlay();
  overlay.style.display = 'flex';
  paragraphOverlayVisible = true;
  setParagraphOverlayBusy(paragraphOverlayBusy);
  positionParagraphOverlay();
}

function hideParagraphOverlay(force = false) {
  if (!paragraphOverlayEl) return;
  if (paragraphOverlayBusy && !force) return;
  paragraphOverlayEl.style.display = 'none';
  paragraphOverlayVisible = false;
}

function setParagraphOverlayBusy(busy) {
  paragraphOverlayBusy = !!busy;
  if (!paragraphOverlayButton) ensureParagraphOverlay();
  if (!paragraphOverlayButton) return;
  paragraphOverlayButton.disabled = paragraphOverlayBusy;
  paragraphOverlayButton.textContent = paragraphOverlayBusy ? 'Writing…' : '✨ Write paragraph';
  paragraphOverlayButton.style.opacity = paragraphOverlayBusy ? '0.7' : '';
  paragraphOverlayButton.style.cursor = paragraphOverlayBusy ? 'default' : 'pointer';
  if (paragraphOverlayHint) {
    paragraphOverlayHint.textContent = paragraphOverlayBusy ? 'Drafting your next paragraph…' : PARAGRAPH_OVERLAY_HINT_DEFAULT;
  }
}

function refreshParagraphOverlayVisibility() {
  if (!featureFlags.paragraphWriter) {
    hideParagraphOverlay(true);
    return;
  }
  const eligible = paragraphWriterInfo.isText && paragraphWriterInfo.isEmpty;
  if (eligible) {
    showParagraphOverlay();
  } else {
    hideParagraphOverlay();
  }
  if (paragraphOverlayVisible) {
    positionParagraphOverlay();
  }
}

function onParagraphStatus(payload) {
  if (!featureFlags.paragraphWriter) return;
  const status = payload?.status && typeof payload.status === 'object' ? payload.status : payload;
  if (!status || typeof status !== 'object') {
    if (!paragraphOverlayBusy) hideParagraphOverlay();
    return;
  }
  const blockType = status.blockType || status.type || paragraphWriterInfo.blockType || '';
  const isText = status.isText !== undefined ? !!status.isText : isTextualBlockType(blockType);
  paragraphWriterInfo = {
    blockId: status.blockId ?? paragraphWriterInfo.blockId ?? null,
    blockType,
    isEmpty: !!status.isEmpty,
    isText,
    version: typeof status.version === 'number' ? status.version : (paragraphWriterInfo.version + 1),
    source: status.source || 'api',
    timestamp: Date.now(),
    rect: normalizeParagraphRect(status.rect) ?? paragraphWriterInfo.rect ?? null,
  };
  if (!paragraphOverlayBusy) {
    refreshParagraphOverlayVisibility();
  }
  positionParagraphOverlay();
}

function onParagraphFrameStatus(payload) {
  if (!featureFlags.paragraphWriter || !payload || typeof payload !== 'object') return;
  const text = normalizeParagraphString(payload.text || '');
  const isEmpty = payload.isEmpty !== undefined
    ? !!payload.isEmpty
    : !text || text.toLowerCase() === PARAGRAPH_PLACEHOLDER_TEXT.toLowerCase();
  paragraphWriterInfo = {
    blockId: payload.editorId ?? paragraphWriterInfo.blockId ?? null,
    blockType: payload.blockType || paragraphWriterInfo.blockType || 'text',
    isEmpty,
    isText: true,
    version: paragraphWriterInfo.version + 1,
    source: 'frame',
    timestamp: Date.now(),
    rect: normalizeParagraphRect(payload.rect),
  };
  if (!paragraphOverlayBusy) {
    refreshParagraphOverlayVisibility();
  }
  positionParagraphOverlay();
}

async function handleParagraphOverlayClick() {
  if (paragraphOverlayBusy) return;
  setParagraphOverlayBusy(true);
  try {
    const mailingHTML = await collectMailingHTML();
    if (!mailingHTML) {
      toast('Could not detect the mailing content.');
      setParagraphOverlayBusy(false);
      return;
    }
    let apiKey;
    try {
      apiKey = await getApiKey();
    } catch {
      setParagraphOverlayBusy(false);
      return;
    }
    const userPrompt = `Here is the full HTML of the mailing currently open in Smart.pr:\n\n${mailingHTML}\n\nWrite the very next paragraph that should follow, using the dominant language of the mailing.`;
    const result = await openAIChat(apiKey, PARAGRAPH_WRITER_SYSTEM_PROMPT, userPrompt, 0.7);
    const paragraph = (result || '').trim();
    if (!paragraph) {
      toast('ChatGPT did not return a paragraph. Try again.');
      setParagraphOverlayBusy(false);
      return;
    }
    lastGeneratedParagraph = paragraph;
    const html = buildParagraphHtml(paragraph);
    if (!html) {
      toast('Generated paragraph was empty.');
      setParagraphOverlayBusy(false);
      return;
    }
    if (dispatchParagraphToBee(html)) {
      clearParagraphApplyTimeout();
      paragraphApplyTimeout = setTimeout(() => {
        setParagraphOverlayBusy(false);
        refreshParagraphOverlayVisibility();
      }, 4000);
    } else {
      const appliedLocally = applyParagraphFallback(html);
      setParagraphOverlayBusy(false);
      if (appliedLocally) {
        paragraphWriterInfo.isEmpty = false;
        toast('Paragraph drafted!');
        refreshParagraphOverlayVisibility();
      } else {
        await copyToClipboard(paragraph);
        toast('Paragraph copied to clipboard.');
      }
      lastGeneratedParagraph = '';
    }
  } catch (err) {
    console.error('[Smartpr Labs][ParagraphWriter] Failed to write paragraph', err);
    toast(getOpenAIErrorMessage(err, 'Could not generate a paragraph. Please try again.'));
    lastGeneratedParagraph = '';
    setParagraphOverlayBusy(false);
  }
}

function dispatchParagraphToBee(html) {
  const frame = getBeeIframe();
  if (!frame || !frame.contentWindow) return false;
  try {
    frame.contentWindow.postMessage({
      type: PARAGRAPH_APPLY_EVENT,
      html,
      blockId: paragraphWriterInfo.blockId,
      source: 'smartpr-labs',
      placeholder: PARAGRAPH_PLACEHOLDER_TEXT
    }, BEE_FRAME_ORIGIN);
    return true;
  } catch (err) {
    console.warn('[Smartpr Labs][ParagraphWriter] Failed to post message to BEE iframe', err);
    return false;
  }
}

function onParagraphApplyResult(payload) {
  clearParagraphApplyTimeout();
  setParagraphOverlayBusy(false);
  if (payload?.success) {
    paragraphWriterInfo.isEmpty = false;
    toast('Paragraph drafted!');
  } else if (lastGeneratedParagraph) {
    copyToClipboard(lastGeneratedParagraph).then(() => {
      toast('Paragraph copied to clipboard.');
    }).catch(() => {
      toast('Paragraph copied to clipboard.');
    });
  }
  lastGeneratedParagraph = '';
  refreshParagraphOverlayVisibility();
}

function clearParagraphApplyTimeout() {
  if (paragraphApplyTimeout) {
    clearTimeout(paragraphApplyTimeout);
    paragraphApplyTimeout = null;
  }
}

function buildParagraphHtml(text) {
  if (!text) return '';
  const escaped = escapeHTML(text.trim());
  if (!escaped) return '';
  const parts = escaped.split(/\n{2,}/).map(block => {
    const withBreaks = block.replace(/\n/g, '<br>');
    return `<p>${withBreaks}</p>`;
  });
  return parts.join('') || `<p>${escaped}</p>`;
}

function normalizeParagraphString(text) {
  return (text || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTextualBlockType(type) {
  if (!type || typeof type !== 'string') return false;
  return /text|paragraph|body|copy|content/i.test(type);
}

function teardownParagraphWriter() {
  clearParagraphApplyTimeout();
  hideParagraphOverlay(true);
  detachParagraphOverlayListeners();
  if (paragraphOverlayEl) {
    try { paragraphOverlayEl.remove(); } catch { /* ignore */ }
  }
  paragraphOverlayEl = null;
  paragraphOverlayButton = null;
  paragraphOverlayVisible = false;
  paragraphOverlayBusy = false;
  paragraphOverlayInitialized = false;
  paragraphWriterInfo = {
    blockId: null,
    blockType: '',
    isEmpty: false,
    isText: false,
    version: 0,
    source: '',
    timestamp: 0,
    rect: null,
  };
  lastGeneratedParagraph = '';
}

function normalizeParagraphRect(rect) {
  if (!rect || typeof rect !== 'object') return null;
  const top = Number(rect.top);
  const left = Number(rect.left);
  const width = Number(rect.width);
  const height = Number(rect.height);
  if (!Number.isFinite(top) || !Number.isFinite(left) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  return { top, left, width, height };
}

function applyParagraphFallback(html) {
  const editorCandidates = [
    document.querySelector('.content-labels--paragraph .module--selected .mce-content-body'),
    document.querySelector('.module--selected.content-labels--paragraph .mce-content-body'),
    document.querySelector('.mce-content-body.mce-edit-focus'),
    document.querySelector('[data-qa="tinyeditor-root-element"].mce-content-body')
  ].filter(Boolean);
  const editorEl = editorCandidates.find(el => el && el.isConnected);
  if (!editorEl) return false;

  let applied = false;
  if (typeof window !== 'undefined' && window.tinymce && typeof editorEl.id === 'string' && editorEl.id) {
    try {
      const instance = window.tinymce.get(editorEl.id);
      if (instance) {
        instance.focus();
        instance.setContent(html);
        instance.fire('change');
        applied = true;
      }
    } catch (err) {
      console.debug('[Smartpr Labs][ParagraphWriter] TinyMCE fallback failed', err?.message || err);
    }
  }

  if (!applied) {
    editorEl.innerHTML = html;
    try {
      editorEl.dispatchEvent(new Event('input', { bubbles: true }));
    } catch { /* ignore */ }
    applied = true;
  }

  if (applied) {
    try { editorEl.focus(); } catch { /* ignore */ }
  }
  return applied;
}


// ---------- PR Feedback Assistant ----------
function ensurePRFeedbackPanel() {
  if (!document.body) return null;
  let panel = $('#spr-feedback-panel');
  if (panel) return panel;

  panel = document.createElement('div');
  panel.id = 'spr-feedback-panel';
  panel.innerHTML = `
    <div class="spr-feedback-header">
      <strong>PR Feedback</strong>
      <button type="button" class="spr-feedback-action" data-feedback-view-input style="display:none">View input</button>
      <button type="button" class="spr-feedback-action" data-feedback-copy style="display:none">Copy</button>
      <button type="button" class="spr-feedback-close" data-feedback-close title="Close">✕</button>
    </div>
    <div id="spr-feedback-status" class="spr-feedback-status"></div>
    <div id="spr-feedback-content" class="spr-feedback-content"></div>
  `;
  document.body.appendChild(panel);

  const closeBtn = panel.querySelector('[data-feedback-close]');
  if (closeBtn) closeBtn.addEventListener('click', hideFeedbackPanel);

  const copyBtn = panel.querySelector('[data-feedback-copy]');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const contentEl = panel.querySelector('#spr-feedback-content');
      const content = contentEl?.dataset?.raw ?? contentEl?.textContent ?? '';
      if (!content.trim()) {
        toast('Nothing to copy yet.');
        return;
      }
      await copyToClipboard(content);
      toast('Feedback copied.');
    });
  }

  const viewInputBtn = panel.querySelector('[data-feedback-view-input]');
  if (viewInputBtn) {
    viewInputBtn.addEventListener('click', () => showFeedbackInputModal());
  }

  return panel;
}

function showFeedbackPanel() {
  const panel = ensurePRFeedbackPanel();
  if (!panel) return null;
  panel.style.display = 'flex';
  return panel;
}

function hideFeedbackPanel() {
  const panel = $('#spr-feedback-panel');
  if (panel) panel.style.display = 'none';
}

function setFeedbackPanelState(state, message = '') {
  const panel = ensurePRFeedbackPanel();
  if (!panel) return;
  const statusEl = panel.querySelector('#spr-feedback-status');
  const contentEl = panel.querySelector('#spr-feedback-content');
  const copyBtn = panel.querySelector('[data-feedback-copy]');
  const viewInputBtn = panel.querySelector('[data-feedback-view-input]');
  if (!statusEl || !contentEl || !copyBtn) return;

  statusEl.classList.remove('is-error');
  if (state === 'loading') {
    statusEl.textContent = message || 'Loading…';
    statusEl.style.display = '';
    contentEl.textContent = '';
    contentEl.dataset.raw = '';
   copyBtn.style.display = 'none';
   if (viewInputBtn) viewInputBtn.style.display = lastFeedbackInput ? '' : 'none';
 } else if (state === 'error') {
    statusEl.textContent = message || 'Something went wrong.';
    statusEl.style.display = '';
    statusEl.classList.add('is-error');
    contentEl.textContent = '';
    contentEl.dataset.raw = '';
   copyBtn.style.display = 'none';
   if (viewInputBtn) viewInputBtn.style.display = lastFeedbackInput ? '' : 'none';
 } else if (state === 'success') {
    statusEl.textContent = '';
    statusEl.style.display = 'none';
    contentEl.dataset.raw = message;
    contentEl.innerHTML = markdownToHtml(message);
   copyBtn.style.display = '';
   if (viewInputBtn) viewInputBtn.style.display = lastFeedbackInput ? '' : 'none';
 }
}

async function requestPRFeedback() {
  showFeedbackPanel();
  setFeedbackPanelState('loading', 'Collecting mailing content…');
  logFeedback('Feedback request started');

  const mailingHTML = await collectMailingHTML();
  if (!mailingHTML) {
    setFeedbackPanelState('error', 'Could not find the mailing content on this page.');
    logFeedback('No mailing HTML available');
    return;
  }
  logFeedback('Mailing HTML collected', { length: mailingHTML.length });
  lastFeedbackInput = mailingHTML;
  const viewBtn = $('#spr-feedback-panel [data-feedback-view-input]');
  if (viewBtn) viewBtn.style.display = lastFeedbackInput ? '' : 'none';

  let apiKey;
  try {
    apiKey = await getApiKey();
  } catch {
    setFeedbackPanelState('error', 'Add your OpenAI API key via the extension options to request feedback.');
    logFeedback('API key missing');
    return;
  }

  const userPrompt = `Here is the HTML of the mailing currently being edited in Smart.pr:\n\n${mailingHTML}`;

  try {
    setFeedbackPanelState('loading', 'Requesting PR feedback…');
    logFeedback('Calling OpenAI for feedback');
    const feedback = await openAIChat(apiKey, PR_FEEDBACK_SYSTEM_PROMPT, userPrompt, 0.4);
    setFeedbackPanelState('success', feedback.trim());
    logFeedback('Received feedback from OpenAI', { length: feedback ? feedback.length : 0 });
  } catch (err) {
    console.error('[SASE] PR feedback error', err);
    const friendly = getOpenAIErrorMessage(err, 'Could not fetch PR feedback. Please try again.');
    setFeedbackPanelState('error', friendly);
    logFeedback('OpenAI request failed', err?.message || err);
  }
}

async function collectMailingHTML() {
  const PRIMARY_SELECTOR = '.publisher-mailing-html__root';
  const secondarySelectors = [
    '.publisher-mailings-design-bee__body',
    '[mailing-id-selector="publisherMailingIdSelector"]',
    '.mailing-html__iframe',
    'publisher-mailing-html',
    'div.stageContent',
    'div.Stage_stageInner__M9-ST',
    'div.Stage_stageInner',
    'div.stageInner',
    '.stageInner',
    '.Stage_stageInner__M9-ST'
  ];

  const beeHtml = await requestBeeHtmlViaBridge();
  if (beeHtml) {
    logFeedback('Using HTML from bridge', { length: beeHtml.length });
    return beeHtml;
  }
  logFeedback('Bridge did not return HTML, falling back to DOM scraping');

  const primaryNodes = deepQuerySelectorAll(PRIMARY_SELECTOR).filter(Boolean);
  if (primaryNodes.length) {
    const htmlChunks = primaryNodes
      .map(node => (node.outerHTML || '').trim())
      .filter(Boolean);
    if (htmlChunks.length) {
      logFeedback('Collected HTML via primary selectors', { nodes: htmlChunks.length });
      return htmlChunks.join('\n\n');
    }
  }

  for (const selector of secondarySelectors) {
    const candidates = deepQuerySelectorAll(selector).filter(Boolean);
    if (candidates.length) {
      const htmlChunks = candidates
        .map(node => (node.outerHTML || '').trim())
        .filter(Boolean);
      if (htmlChunks.length) {
        logFeedback('Collected HTML via secondary selector', { selector, nodes: htmlChunks.length });
        return htmlChunks.join('\n\n');
      }
    }
  }

  logFeedback('Failed to collect mailing HTML');
  return '';
}

function ensurePRFeedbackButton() {
  if (!featureFlags.prFeedback) return;
  const buttons = $$('button.ui-button__root, button.publisher-mailings-design-bee__button');
  const saveBtn = buttons.find(btn => (btn.textContent || '').trim().toLowerCase() === 'save as template');
  if (!saveBtn || saveBtn.dataset.sprFeedbackAttached) return;
  logFeedback('Injecting PR Feedback button');

  const askBtn = document.createElement('button');
  askBtn.type = 'button';
  askBtn.className = 'publisher-mailings-design-bee__button ui-button__root ui-button__root--default ui-button__root--big spr-feedback-btn';
  askBtn.textContent = '✨ Ask feedback';
  askBtn.dataset.sprFeedbackBtn = '1';
  saveBtn.insertAdjacentElement('beforebegin', askBtn);
  saveBtn.dataset.sprFeedbackAttached = '1';

  askBtn.addEventListener('click', requestPRFeedback);

  const mirror = () => {
    const disabled = saveBtn.disabled
      || saveBtn.classList.contains('ui-button__root--disabled')
      || saveBtn.hasAttribute('disabled')
      || saveBtn.getAttribute('aria-disabled') === 'true';
    askBtn.disabled = !!disabled;
    askBtn.style.opacity = disabled ? '0.6' : '';
    askBtn.style.pointerEvents = disabled ? 'none' : '';
  };
  mirror();

  const observer = new MutationObserver(mirror);
  observer.observe(saveBtn, { attributes: true, attributeFilter: ['disabled', 'class', 'aria-disabled'] });
  askBtn._sprFeedbackObserver = observer;
}

function teardownPRFeedback() {
  const panel = $('#spr-feedback-panel');
  if (panel) panel.remove();
  $$('.spr-feedback-btn').forEach(btn => {
    if (btn._sprFeedbackObserver) {
      try { btn._sprFeedbackObserver.disconnect(); } catch { /* ignore */ }
      delete btn._sprFeedbackObserver;
    }
    btn.remove();
  });
  $$('[data-spr-feedback-attached]').forEach(btn => {
    btn.removeAttribute('data-spr-feedback-attached');
  });
  hideFeedbackPanel();
}

function teardownAllFeatures() {
  teardownAngleAssistant();
  teardownPRFeedback();
  teardownParagraphWriter();
}

// Initial injection & observe SPA updates
function runInjections() {
  if (!featuresReady) return;

  if (extensionDisabled) {
    teardownAllFeatures();
    return;
  }

  if (featureFlags.angleAssistant) {
    ensureInjected();
  } else {
    teardownAngleAssistant();
  }

  if (featureFlags.prFeedback) {
    ensurePRFeedbackButton();
    logFeedback('Ran injection pass');
  } else {
    teardownPRFeedback();
  }

  if (featureFlags.paragraphWriter) {
    initParagraphWriter();
  } else {
    teardownParagraphWriter();
  }
}

let injectionObserver = null;

async function initFeatures() {
  await loadFeatureFlags();
  runInjections();
  if (!injectionObserver) {
    injectionObserver = new MutationObserver(runInjections);
    injectionObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
}

initFeatures();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  const updates = {};
  if (FEATURE_KEYS.angleAssistant in changes) {
    updates.angleAssistant = normalizeFeatureValue(changes[FEATURE_KEYS.angleAssistant].newValue, DEFAULT_FEATURE_FLAGS.angleAssistant);
  }
  if (FEATURE_KEYS.prFeedback in changes) {
    updates.prFeedback = normalizeFeatureValue(changes[FEATURE_KEYS.prFeedback].newValue, DEFAULT_FEATURE_FLAGS.prFeedback);
  }
  if (FEATURE_KEYS.paragraphWriter in changes) {
    updates.paragraphWriter = normalizeFeatureValue(changes[FEATURE_KEYS.paragraphWriter].newValue, DEFAULT_FEATURE_FLAGS.paragraphWriter);
  }
  if (LABS_DISABLED_KEY in changes) {
    const nextDisabled = Boolean(changes[LABS_DISABLED_KEY].newValue);
    if (nextDisabled !== extensionDisabled) {
      extensionDisabled = nextDisabled;
      if (extensionDisabled) {
        teardownAllFeatures();
      }
      runInjections();
    }
  }
  applyFeatureUpdates(updates);
});

// Prefill modal subject whenever subject input changes
(function watchSubjectField() {
  const subj = getSubjectField();
  if (!subj) return;
  subj.addEventListener('input', () => {
    const modalSubj = $('#sase-subject');
    if (modalSubj && $('#sase-modal')?.style.display !== 'none') {
      modalSubj.value = subj.value;
    }
  });
})();

(function watchSenderField() {
  const sender = getSenderField();
  if (!sender) return;
  sender.addEventListener('input', () => {
    const modalSender = $('#sase-sender');
    if (modalSender && $('#sase-modal')?.style.display !== 'none') {
      modalSender.value = sender.value;
    }
  });
})();
