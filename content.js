/* content.js — Smart.pr Labs Helper (MV3)
 * - Floating helper icon on *.smart.pr
 * - Nudges when subject line is filled
 * - Offers ChatGPT suggestions without injecting into page fields
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
  subjectGenerator: 'feature_subject_generator',
};
const LABS_DISABLED_KEY = 'labs_disabled';

const DEFAULT_FEATURE_FLAGS = {
  angleAssistant: true,
  prFeedback: true,
  paragraphWriter: true,
  subjectGenerator: true,
};

const STORAGE_KEYS = [...Object.values(FEATURE_KEYS), LABS_DISABLED_KEY];

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
        subjectGenerator: normalizeFeatureValue(stored[FEATURE_KEYS.subjectGenerator], DEFAULT_FEATURE_FLAGS.subjectGenerator),
      };
      featuresReady = true;
      resolve(featureFlags);
    });
  });
}

function anyFeatureEnabled() {
  return Object.values(featureFlags).some(Boolean);
}

const USAGE_KEY = 'sase_usage';
const NUDGE_HISTORY_KEY = 'sase_nudge_history';

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

function safeParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

function extractJSON(str) {
  if (!str) return null;
  const match = str.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return safeParseJSON(match[0]);
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
  return $('input[placeholder="Please type your subject"], input[name="subject"], input[aria-label="Subject"]');
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

// ---------- Prompts ----------
const SUBJECT_SUGGESTIONS_SYSTEM_PROMPT = `
You are an award-winning PR subject line strategist helping a Smart.pr user improve their mailing.
You receive the raw HTML of the mailing plus their current subject line (if any).

Write 3 to 5 compelling subject line alternatives that maximize opens without sounding spammy.

Rules:
1. Detect the dominant language (Dutch or English) and write the subjects in that language.
2. Keep each subject <= 70 characters and factual to the mailing content.
3. Avoid ALL CAPS, excessive punctuation, emoji, or clickbait.
4. Highlight the strongest news hook or benefit while staying true to the story.

Return JSON only in this format: {"subjects":["...", "...", "..."]} with no extra text.
`;

const ANGLE_SYSTEM_PROMPT = `You are a senior PR strategist. Produce concise, one-sentence "angles" (perspectives) on the topic.
Return JSON only: {"angles":[ "...", "...", ... ]} with 1-5 items (never more than five). Each item <= 30 words, crisp, distinct.
Determine the dominant language of the subject line and write every angle in that language. Do not translate into English unless the subject itself is in English.`;

const PR_FEEDBACK_SYSTEM_PROMPT = `
Act as a senior PR editor and email deliverability coach.
You receive raw HTML of a press-release mailing.

Your job: deliver clear, concise editorial feedback that helps the sender make their mailing more professional, engaging, and correct.

Review checklist
1. Strip all HTML and read only the text.
2. Detect the dominant language (Dutch or English) and respond entirely in that language, including all headings.
3. Evaluate:
   - Clarity and structure
   - Tone and storytelling
   - Grammar, spelling, and punctuation (list specific typos if any)
   - Readability and sentence flow
   - Call-to-action clarity (ignore standard unsubscribe links added automatically by email software)

Write your response in plain text with the following three sections, using headings in the same language as the text:
Strengths (or Sterktes if Dutch)
Areas for improvement (or Verbeterpunten if Dutch)
Action plan (or Aanpak if Dutch)

Style guidelines
- Be professional, pragmatic, and concise.
- Avoid Markdown syntax like # or backticks.
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
4. Provide exactly one new paragraph (2-4 sentences) that adds new information, insight, or value.
5. Avoid repeating existing sentences, avoid greetings or farewells, and do not include unsubscribe or legal boilerplate.

Return plain text only.
`;

// ---------- Bridge / Bee HTML collection ----------
const BRIDGE_SCRIPT_ID = 'spr-pr-feedback-bridge';
const BRIDGE_REQUEST = 'SPR_FEEDBACK_GET_HTML';
const BRIDGE_RESPONSE = 'SPR_FEEDBACK_HTML';
const BRIDGE_READY = 'SPR_FEEDBACK_BRIDGE_READY';
const BRIDGE_PING = 'SPR_FEEDBACK_BRIDGE_PING';
const PARAGRAPH_STATUS_EVENT = 'SPR_PARAGRAPH_STATUS';
const PARAGRAPH_FRAME_STATUS_EVENT = 'SPR_PARAGRAPH_FRAME_STATUS';

let bridgeReady = false;
let bridgeReadyWaiters = [];
const bridgeHtmlRequests = new Map();

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
      resolve(false);
    }, timeout);
    const onReady = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      bridgeReadyWaiters = bridgeReadyWaiters.filter(fn => fn !== onReady);
      resolve(true);
    };
    bridgeReadyWaiters.push(onReady);
    try { window.postMessage({ type: BRIDGE_PING }, '*'); } catch { /* ignore */ }
  });
}

async function requestBeeHtmlViaBridge(timeout = 6000) {
  injectBeeBridge();
  await waitForBridgeReady(timeout);

  const id = `spr-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      bridgeHtmlRequests.delete(id);
      resolve('');
    }, timeout);
    bridgeHtmlRequests.set(id, { resolve, timeout: timer });
    try {
      window.postMessage({ type: BRIDGE_REQUEST, id }, '*');
    } catch {
      clearTimeout(timer);
      bridgeHtmlRequests.delete(id);
      resolve('');
    }
  });
}

const MAILING_PRIMARY_SELECTOR = '.publisher-mailing-html__root';
const MAILING_SECONDARY_SELECTORS = [
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
const MAILING_PRESENCE_SELECTOR = [MAILING_PRIMARY_SELECTOR, ...MAILING_SECONDARY_SELECTORS].join(', ');

async function collectMailingHTML() {
  const secondarySelectors = MAILING_SECONDARY_SELECTORS;

  const beeHtml = await requestBeeHtmlViaBridge();
  if (beeHtml) return beeHtml;

  const primaryNodes = deepQuerySelectorAll(MAILING_PRIMARY_SELECTOR).filter(Boolean);
  if (primaryNodes.length) {
    const htmlChunks = primaryNodes
      .map(node => (node.outerHTML || '').trim())
      .filter(Boolean);
    if (htmlChunks.length) return htmlChunks.join('\n\n');
  }

  for (const selector of secondarySelectors) {
    const candidates = deepQuerySelectorAll(selector).filter(Boolean);
    if (candidates.length) {
      const htmlChunks = candidates
        .map(node => (node.outerHTML || '').trim())
        .filter(Boolean);
      if (htmlChunks.length) return htmlChunks.join('\n\n');
    }
  }

  return '';
}

function detectMailingPresence() {
  try {
    if (document.querySelector(MAILING_PRESENCE_SELECTOR)) return true;
    return deepQuerySelectorAll(MAILING_PRESENCE_SELECTOR).length > 0;
  } catch {
    return false;
  }
}

function scheduleMailingCheck() {
  if (helperState.mailingCheckTimer || helperState.mailingCheckInFlight) return;
  helperState.mailingCheckTimer = setTimeout(async () => {
    helperState.mailingCheckTimer = null;
    helperState.mailingCheckInFlight = true;
    let ready = detectMailingPresence();
    if (!ready) {
      try { ready = !!(await requestBeeHtmlViaBridge(1500)); } catch { ready = false; }
    }
    helperState.mailingCheckInFlight = false;
    if (helperState.mailingReady !== ready) {
      helperState.mailingReady = ready;
      updateCardStatuses();
      refreshHelperUI();
    }
  }, 300);
}

// ---------- Paragraph status ----------
let paragraphWriterInfo = {
  isEmpty: false,
  isText: false,
};

function updateParagraphEligibility(nextInfo) {
  paragraphWriterInfo = { ...paragraphWriterInfo, ...nextInfo };
  helperState.paragraphEligible = !!(paragraphWriterInfo.isText && paragraphWriterInfo.isEmpty);
  updateCardStatuses();
  refreshHelperUI();
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

function isTextualBlockType(type) {
  if (!type || typeof type !== 'string') return false;
  return /text|paragraph|body|copy|content/i.test(type);
}

function onParagraphStatus(payload) {
  if (!featureFlags.paragraphWriter) return;
  const status = payload?.status && typeof payload.status === 'object' ? payload.status : payload;
  if (!status || typeof status !== 'object') return;
  const blockType = status.blockType || status.type || '';
  const isText = status.isText !== undefined ? !!status.isText : isTextualBlockType(blockType);
  updateParagraphEligibility({
    isEmpty: !!status.isEmpty,
    isText,
    rect: normalizeParagraphRect(status.rect) || null,
  });
}

function onParagraphFrameStatus(payload) {
  if (!featureFlags.paragraphWriter || !payload || typeof payload !== 'object') return;
  updateParagraphEligibility({
    isEmpty: !!payload.isEmpty,
    isText: true,
    rect: normalizeParagraphRect(payload.rect) || null,
  });
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
    } else if (type === BRIDGE_RESPONSE && id) {
      const pending = bridgeHtmlRequests.get(id);
      if (!pending) return;
      bridgeHtmlRequests.delete(id);
      clearTimeout(pending.timeout);
      pending.resolve(typeof html === 'string' ? html.trim() : '');
    } else if (type === PARAGRAPH_STATUS_EVENT) {
      onParagraphStatus(event.data);
    }
  } else if (typeof event.origin === 'string' && event.origin.includes('app.getbee.io')) {
    if (type === PARAGRAPH_FRAME_STATUS_EVENT) {
      onParagraphFrameStatus(event.data);
    }
  }
}

if (!window.__sprHelperBridgeListenerAttached) {
  window.addEventListener('message', handleBridgeMessage, false);
  window.__sprHelperBridgeListenerAttached = true;
}

// ---------- Helper UI ----------
const helperState = {
  subject: '',
  panelOpen: false,
  nudgeId: '',
  nudgeDismissedUntil: 0,
  lastNudgedSubject: '',
  nudgeTimer: null,
  nudgePendingText: '',
  nudgePhase: 'idle',
  nudgeSubject: '',
  activeContext: '',
  nudgeHistory: {},
  mailingId: '',
  lastPath: '',
  paragraphEligible: false,
  mailingReady: false,
  mailingCheckTimer: null,
  mailingCheckInFlight: false,
  results: {
    subject: [],
    angles: [],
    feedback: '',
    paragraph: '',
  },
  busy: {
    subject: false,
    angles: false,
    feedback: false,
    paragraph: false,
  },
  lastAutoSubject: '',
};

const helperEls = {
  root: null,
  button: null,
  bubbles: null,
  bubble: null,
  bubbleThinking: null,
  bubbleIdeas: null,
  bubbleText: null,
  bubbleDismiss: null,
  panel: null,
  close: null,
  emptyState: null,
  cards: {},
};

function ensureHelperShell() {
  if (helperEls.root && document.body.contains(helperEls.root)) return helperEls.root;
  if (!document.body) return null;

  const root = document.createElement('div');
  root.id = 'spr-helper';
  root.innerHTML = `
    <button type="button" class="spr-helper-button" id="spr-helper-button" aria-label="Open helper">
      <span class="spr-helper-pulse" aria-hidden="true"></span>
      <img class="spr-helper-icon" alt="Smartpr helper" />
    </button>
    <div class="spr-helper-bubbles" id="spr-helper-bubbles" aria-live="polite">
      <div class="spr-helper-bubble" id="spr-helper-bubble" role="button" tabindex="0">
        <span class="spr-helper-bubble-text" id="spr-helper-bubble-text"></span>
        <button type="button" class="spr-helper-bubble-dismiss" id="spr-helper-bubble-dismiss" aria-label="Dismiss">x</button>
      </div>
      <div class="spr-helper-bubble is-muted" id="spr-helper-bubble-thinking">
        <span class="spr-helper-bubble-text">Thinking...</span>
      </div>
      <button type="button" class="spr-helper-bubble is-action" id="spr-helper-bubble-ideas">
        <span class="spr-helper-bubble-text">Click to see my ideas</span>
      </button>
    </div>
    <div class="spr-helper-panel" id="spr-helper-panel" aria-hidden="true">
      <div class="spr-helper-panel-header">
        <div>
          <div class="spr-helper-panel-title">Smart.pr Helper</div>
          <div class="spr-helper-panel-subtitle">Quiet until needed</div>
        </div>
        <button type="button" class="spr-helper-icon-button" id="spr-helper-close" aria-label="Close">x</button>
      </div>
      <div class="spr-helper-panel-body">
        <div class="spr-helper-empty-state" id="spr-helper-empty-state">
          Nothing to help with yet. Add a subject line or open a mailing.
        </div>
        <div class="spr-helper-card" data-card="subject">
          <div class="spr-helper-card-header">
            <div>
              <div class="spr-helper-card-title">Subject suggestions</div>
              <div class="spr-helper-card-status" id="spr-helper-subject-status">Waiting for subject line</div>
            </div>
            <button type="button" class="spr-helper-btn" data-action="subject-generate">Generate</button>
          </div>
          <div class="spr-helper-card-body" id="spr-helper-subject-body"></div>
        </div>
        <div class="spr-helper-card" data-card="angles">
          <div class="spr-helper-card-header">
            <div>
              <div class="spr-helper-card-title">Angle ideas</div>
              <div class="spr-helper-card-status" id="spr-helper-angles-status">Waiting for subject line</div>
            </div>
            <button type="button" class="spr-helper-btn" data-action="angles-generate">Generate</button>
          </div>
          <div class="spr-helper-card-body" id="spr-helper-angles-body"></div>
        </div>
        <div class="spr-helper-card" data-card="feedback">
          <div class="spr-helper-card-header">
            <div>
              <div class="spr-helper-card-title">PR feedback</div>
              <div class="spr-helper-card-status" id="spr-helper-feedback-status">Open a mailing to enable</div>
            </div>
            <button type="button" class="spr-helper-btn" data-action="feedback-generate">Generate</button>
          </div>
          <div class="spr-helper-card-body" id="spr-helper-feedback-body"></div>
          <div class="spr-helper-card-footer">
            <button type="button" class="spr-helper-btn secondary" data-action="feedback-copy" style="display:none">Copy</button>
          </div>
        </div>
        <div class="spr-helper-card" data-card="paragraph">
          <div class="spr-helper-card-header">
            <div>
              <div class="spr-helper-card-title">Paragraph draft</div>
              <div class="spr-helper-card-status" id="spr-helper-paragraph-status">Place cursor in empty paragraph</div>
            </div>
            <button type="button" class="spr-helper-btn" data-action="paragraph-generate">Generate</button>
          </div>
          <div class="spr-helper-card-body" id="spr-helper-paragraph-body"></div>
          <div class="spr-helper-card-footer">
            <button type="button" class="spr-helper-btn secondary" data-action="paragraph-copy" style="display:none">Copy</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  helperEls.root = root;
  helperEls.button = $('#spr-helper-button', root);
  helperEls.bubbles = $('#spr-helper-bubbles', root);
  helperEls.bubble = $('#spr-helper-bubble', root);
  helperEls.bubbleThinking = $('#spr-helper-bubble-thinking', root);
  helperEls.bubbleIdeas = $('#spr-helper-bubble-ideas', root);
  helperEls.bubbleText = $('#spr-helper-bubble-text', root);
  helperEls.bubbleDismiss = $('#spr-helper-bubble-dismiss', root);
  helperEls.panel = $('#spr-helper-panel', root);
  helperEls.close = $('#spr-helper-close', root);
  helperEls.emptyState = $('#spr-helper-empty-state', root);

  const icon = root.querySelector('.spr-helper-icon');
  if (icon) icon.src = chrome.runtime.getURL('icon.png');

  helperEls.cards = {
    subject: {
      card: root.querySelector('[data-card="subject"]'),
      status: $('#spr-helper-subject-status', root),
      body: $('#spr-helper-subject-body', root),
      generate: root.querySelector('[data-action="subject-generate"]'),
    },
    angles: {
      card: root.querySelector('[data-card="angles"]'),
      status: $('#spr-helper-angles-status', root),
      body: $('#spr-helper-angles-body', root),
      generate: root.querySelector('[data-action="angles-generate"]'),
    },
    feedback: {
      card: root.querySelector('[data-card="feedback"]'),
      status: $('#spr-helper-feedback-status', root),
      body: $('#spr-helper-feedback-body', root),
      generate: root.querySelector('[data-action="feedback-generate"]'),
      copy: root.querySelector('[data-action="feedback-copy"]'),
    },
    paragraph: {
      card: root.querySelector('[data-card="paragraph"]'),
      status: $('#spr-helper-paragraph-status', root),
      body: $('#spr-helper-paragraph-body', root),
      generate: root.querySelector('[data-action="paragraph-generate"]'),
      copy: root.querySelector('[data-action="paragraph-copy"]'),
    },
  };

  bindHelperEvents();
  return root;
}

function bindHelperEvents() {
  if (!helperEls.root) return;

  if (helperEls.button) {
    helperEls.button.addEventListener('click', () => {
      if (helperState.panelOpen) closeHelperPanel();
      else openHelperPanel({ autoGenerate: 'subject' });
    });
  }

  if (helperEls.close) {
    helperEls.close.addEventListener('click', closeHelperPanel);
  }

  if (helperEls.bubble) {
    helperEls.bubble.addEventListener('click', () => startNudgeFlow());
    helperEls.bubble.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        startNudgeFlow();
      }
    });
  }

  if (helperEls.bubbleIdeas) {
    helperEls.bubbleIdeas.addEventListener('click', () => {
      recordNudgeUsed('subject');
      openHelperPanel({ context: 'subject' });
    });
  }

  if (helperEls.bubbleDismiss) {
    helperEls.bubbleDismiss.addEventListener('click', (event) => {
      event.stopPropagation();
      dismissNudge();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && helperState.panelOpen) {
      closeHelperPanel();
    }
  });

  if (helperEls.cards.subject.generate) {
    helperEls.cards.subject.generate.addEventListener('click', () => {
      helperState.activeContext = 'subject';
      generateSubjectSuggestions(false);
    });
  }
  if (helperEls.cards.angles.generate) {
    helperEls.cards.angles.generate.addEventListener('click', () => {
      helperState.activeContext = 'angles';
      generateAngles(false);
    });
  }
  if (helperEls.cards.feedback.generate) {
    helperEls.cards.feedback.generate.addEventListener('click', () => {
      helperState.activeContext = 'feedback';
      requestPRFeedback(false);
    });
  }
  if (helperEls.cards.paragraph.generate) {
    helperEls.cards.paragraph.generate.addEventListener('click', () => {
      helperState.activeContext = 'paragraph';
      generateParagraph(false);
    });
  }
  if (helperEls.cards.feedback.copy) {
    helperEls.cards.feedback.copy.addEventListener('click', async () => {
      if (!helperState.results.feedback) return;
      await copyToClipboard(helperState.results.feedback);
      toast('Feedback copied.');
    });
  }
  if (helperEls.cards.paragraph.copy) {
    helperEls.cards.paragraph.copy.addEventListener('click', async () => {
      if (!helperState.results.paragraph) return;
      await copyToClipboard(helperState.results.paragraph);
      toast('Paragraph copied.');
    });
  }
}

function openHelperPanel(options = {}) {
  if (!ensureHelperShell()) return;
  const nextContext = options.context || chooseHelperContext();
  helperState.activeContext = nextContext;
  helperState.panelOpen = true;
  helperEls.panel.style.display = 'flex';
  helperEls.panel.setAttribute('aria-hidden', 'false');
  helperEls.root.classList.add('is-open');
  hideNudge();
  scheduleMailingCheck();
  refreshHelperUI();

  if (options.autoGenerate === 'subject') {
    maybeAutoGenerateSubject();
  }
}

function closeHelperPanel() {
  if (!helperEls.panel) return;
  helperState.panelOpen = false;
  helperEls.panel.style.display = 'none';
  helperEls.panel.setAttribute('aria-hidden', 'true');
  helperEls.root.classList.remove('is-open');
  maybeShowNudge();
}

function chooseHelperContext() {
  if (featureFlags.subjectGenerator && helperState.subject) return 'subject';
  if (featureFlags.angleAssistant && helperState.subject) return 'angles';
  if (featureFlags.paragraphWriter && helperState.paragraphEligible) return 'paragraph';
  if (featureFlags.prFeedback && helperState.mailingReady) return 'feedback';
  return '';
}

function setCardVisibility(cardKey, visible) {
  const card = helperEls.cards[cardKey]?.card;
  if (!card) return;
  card.style.display = visible ? '' : 'none';
}

function setCardStatus(cardKey, message) {
  const node = helperEls.cards[cardKey]?.status;
  if (node) node.textContent = message;
}

function setCardBody(cardKey, contentNode) {
  const body = helperEls.cards[cardKey]?.body;
  if (!body) return;
  body.innerHTML = '';
  if (contentNode) body.appendChild(contentNode);
}

function renderListItems(items, label) {
  const wrap = document.createElement('div');
  wrap.className = 'spr-helper-list';

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'spr-helper-empty';
    empty.textContent = `No ${label} yet.`;
    wrap.appendChild(empty);
    return wrap;
  }

  items.forEach(text => {
    const row = document.createElement('div');
    row.className = 'spr-helper-item';

    const value = document.createElement('div');
    value.className = 'spr-helper-item-text';
    value.textContent = text;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'spr-helper-btn secondary';
    btn.textContent = 'Copy';
    btn.addEventListener('click', async () => {
      await copyToClipboard(text);
      toast(`${label} copied.`);
    });

    row.appendChild(value);
    row.appendChild(btn);
    wrap.appendChild(row);
  });

  return wrap;
}

function renderFeedbackContent(text) {
  const wrap = document.createElement('div');
  wrap.className = 'spr-helper-text';
  if (!text) {
    wrap.textContent = 'No feedback yet.';
    return wrap;
  }
  wrap.innerHTML = markdownToHtml(text);
  return wrap;
}

function renderParagraphContent(text) {
  const wrap = document.createElement('div');
  wrap.className = 'spr-helper-text';
  wrap.textContent = text || 'No paragraph yet.';
  return wrap;
}

function setBusy(cardKey, busy) {
  helperState.busy[cardKey] = !!busy;
  const button = helperEls.cards[cardKey]?.generate;
  if (!button) return;
  if (!button.dataset.label) button.dataset.label = button.textContent || 'Generate';
  button.disabled = busy;
  button.textContent = busy ? 'Working...' : button.dataset.label;
}

function updateCardStatuses() {
  if (!helperEls.root) return;

  const subjectReady = !!helperState.subject;
  setCardStatus('subject', subjectReady ? 'Ready' : 'Waiting for subject line');
  setCardStatus('angles', subjectReady ? 'Ready' : 'Waiting for subject line');
  setCardStatus('feedback', helperState.mailingReady ? 'Ready' : 'Open a mailing to enable');
  setCardStatus('paragraph', helperState.paragraphEligible ? 'Ready' : 'Place cursor in empty paragraph');
}

function refreshHelperUI() {
  if (!featuresReady || !helperEls.root) return;

  const subjectReady = !!helperState.subject;
  const paragraphReady = !!helperState.paragraphEligible;
  const mailingReady = !!helperState.mailingReady;
  const activeContext = helperState.activeContext || chooseHelperContext();

  const showSubject = featureFlags.subjectGenerator && subjectReady && activeContext === 'subject';
  const showAngles = featureFlags.angleAssistant && subjectReady && activeContext === 'angles';
  const showFeedback = featureFlags.prFeedback && mailingReady && activeContext === 'feedback';
  const showParagraph = featureFlags.paragraphWriter && paragraphReady && activeContext === 'paragraph';

  setCardVisibility('subject', showSubject);
  setCardVisibility('angles', showAngles);
  setCardVisibility('feedback', showFeedback);
  setCardVisibility('paragraph', showParagraph);

  if (helperEls.emptyState) {
    const hasVisibleCards = showSubject || showAngles || showFeedback || showParagraph;
    helperEls.emptyState.style.display = hasVisibleCards ? 'none' : '';
    if (!hasVisibleCards) {
      switch (activeContext) {
        case 'subject':
          helperEls.emptyState.textContent = 'Add a subject line to get ideas.';
          break;
        case 'angles':
          helperEls.emptyState.textContent = 'Add a subject line to get angle ideas.';
          break;
        case 'feedback':
          helperEls.emptyState.textContent = 'Open a mailing to get feedback.';
          break;
        case 'paragraph':
          helperEls.emptyState.textContent = 'Place the cursor in an empty paragraph.';
          break;
        default:
          helperEls.emptyState.textContent = 'Nothing to help with yet.';
      }
    }
  }

  updateCardStatuses();

  const subjectList = renderListItems(helperState.results.subject, 'subject line');
  setCardBody('subject', subjectList);

  const angleList = renderListItems(helperState.results.angles, 'angle');
  setCardBody('angles', angleList);

  const feedbackNode = renderFeedbackContent(helperState.results.feedback);
  setCardBody('feedback', feedbackNode);
  if (helperEls.cards.feedback.copy) {
    helperEls.cards.feedback.copy.style.display = helperState.results.feedback ? '' : 'none';
  }

  const paragraphNode = renderParagraphContent(helperState.results.paragraph);
  setCardBody('paragraph', paragraphNode);
  if (helperEls.cards.paragraph.copy) {
    helperEls.cards.paragraph.copy.style.display = helperState.results.paragraph ? '' : 'none';
  }
}

function dismissNudge() {
  helperState.nudgeDismissedUntil = Date.now() + (10 * 60 * 1000);
  helperState.nudgeId = '';
  helperState.nudgePhase = 'idle';
  hideNudge();
}

const NUDGE_DELAY_MS = 650;
const NUDGE_PROMPT_COOLDOWN_MS = 20 * 60 * 1000;
const NUDGE_USED_COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function loadNudgeHistory() {
  helperState.nudgeHistory = await localStore.get(NUDGE_HISTORY_KEY, {});
}

function getMailingIdFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/\/mailings\/([^/]+)/i);
  return match ? match[1] : '';
}

function refreshMailingContext() {
  const path = window.location.pathname;
  if (helperState.lastPath === path) return;
  helperState.lastPath = path;
  helperState.mailingId = getMailingIdFromPath(path);
}

function getNudgeEntry(type) {
  const mailingId = helperState.mailingId;
  if (!mailingId) return null;
  if (!helperState.nudgeHistory[mailingId]) helperState.nudgeHistory[mailingId] = {};
  if (!helperState.nudgeHistory[mailingId][type]) {
    helperState.nudgeHistory[mailingId][type] = { promptedAt: 0, usedAt: 0 };
  }
  return helperState.nudgeHistory[mailingId][type];
}

function canPromptForType(type) {
  const entry = getNudgeEntry(type);
  if (!entry) return true;
  const now = Date.now();
  if (entry.usedAt && now - entry.usedAt < NUDGE_USED_COOLDOWN_MS) return false;
  if (entry.promptedAt && now - entry.promptedAt < NUDGE_PROMPT_COOLDOWN_MS) return false;
  return true;
}

function recordNudgePrompt(type) {
  const entry = getNudgeEntry(type);
  if (!entry) return;
  entry.promptedAt = Date.now();
  localStore.set(NUDGE_HISTORY_KEY, helperState.nudgeHistory);
}

function recordNudgeUsed(type) {
  const entry = getNudgeEntry(type);
  if (!entry) return;
  entry.usedAt = Date.now();
  localStore.set(NUDGE_HISTORY_KEY, helperState.nudgeHistory);
}

function shouldShowNudge() {
  if (!featuresReady || extensionDisabled || !anyFeatureEnabled()) return false;
  if (helperState.panelOpen) return false;
  if (!featureFlags.subjectGenerator) return false;
  if (!helperState.subject) return false;
  if (!canPromptForType('subject')) return false;
  if (Date.now() < helperState.nudgeDismissedUntil) return false;
  return true;
}

function showNudge(text) {
  if (!helperEls.bubble || !helperEls.bubbleText) return;
  helperEls.bubbleText.textContent = text;
  helperEls.bubble.style.display = 'flex';
  if (helperEls.bubbleThinking) helperEls.bubbleThinking.style.display = 'none';
  if (helperEls.bubbleIdeas) helperEls.bubbleIdeas.style.display = 'none';
  if (helperEls.bubbles) helperEls.bubbles.style.display = 'flex';
  recordNudgePrompt('subject');
}

function hideNudge() {
  if (helperState.nudgeTimer) {
    clearTimeout(helperState.nudgeTimer);
    helperState.nudgeTimer = null;
  }
  if (helperEls.bubble) helperEls.bubble.style.display = 'none';
  if (helperEls.bubbleThinking) helperEls.bubbleThinking.style.display = 'none';
  if (helperEls.bubbleIdeas) helperEls.bubbleIdeas.style.display = 'none';
  if (helperEls.bubbles) helperEls.bubbles.style.display = 'none';
}

function scheduleNudge(text) {
  if (!helperEls.bubble || !helperEls.bubbleText) return;
  if (helperState.nudgeTimer) clearTimeout(helperState.nudgeTimer);
  helperState.nudgePendingText = text;
  helperState.nudgeTimer = setTimeout(() => {
    helperState.nudgeTimer = null;
    if (!shouldShowNudge()) return;
    helperState.nudgePhase = 'prompt';
    showNudge(text);
  }, NUDGE_DELAY_MS);
}

function maybeShowNudge() {
  if (!shouldShowNudge()) {
    hideNudge();
    return;
  }
  if (helperState.nudgePhase === 'thinking') {
    showNudge('Need help improving the subject line?');
    if (helperEls.bubbleThinking) helperEls.bubbleThinking.style.display = 'flex';
    if (helperEls.bubbleIdeas) helperEls.bubbleIdeas.style.display = 'none';
    return;
  }
  if (helperState.nudgePhase === 'ready' && helperState.results.subject.length) {
    showNudge('Need help improving the subject line?');
    if (helperEls.bubbleIdeas) helperEls.bubbleIdeas.style.display = 'flex';
    if (helperEls.bubbleThinking) helperEls.bubbleThinking.style.display = 'none';
    return;
  }
  if (helperState.lastNudgedSubject === helperState.subject) {
    scheduleNudge('Need help improving the subject line?');
    return;
  }
  helperState.lastNudgedSubject = helperState.subject;
  scheduleNudge('Need help improving the subject line?');
}

async function startNudgeFlow() {
  if (!shouldShowNudge()) return;
  if (helperState.nudgePhase === 'thinking') return;
  const subjectAtStart = helperState.subject;
  helperState.activeContext = 'subject';
  helperState.nudgePhase = 'thinking';
  showNudge('Need help improving the subject line?');
  if (helperEls.bubbleThinking) helperEls.bubbleThinking.style.display = 'flex';
  if (helperEls.bubbleIdeas) helperEls.bubbleIdeas.style.display = 'none';
  try {
    await generateSubjectSuggestions(true);
  } finally {
    if (helperState.subject !== subjectAtStart) return;
    if (helperState.results.subject.length) {
      helperState.nudgePhase = 'ready';
      recordNudgeUsed('subject');
      if (helperEls.bubbleThinking) helperEls.bubbleThinking.style.display = 'none';
      if (helperEls.bubbleIdeas) helperEls.bubbleIdeas.style.display = 'flex';
    } else {
      helperState.nudgePhase = 'prompt';
      if (helperEls.bubbleThinking) helperEls.bubbleThinking.style.display = 'none';
    }
  }
}

function updateHelperVisibility() {
  if (!ensureHelperShell()) return;
  const hidden = extensionDisabled || !anyFeatureEnabled();
  helperEls.root.style.display = hidden ? 'none' : '';
  if (hidden) {
    hideNudge();
    closeHelperPanel();
  } else {
    scheduleMailingCheck();
    maybeShowNudge();
  }
}

function updateSubjectValue(value) {
  const next = (value || '').trim();
  if (helperState.subject === next) return;
  helperState.subject = next;
  helperState.nudgePhase = 'idle';
  helperState.nudgeSubject = next;
  refreshMailingContext();
  updateCardStatuses();
  if (!next) {
    helperState.results.subject = [];
    helperState.results.angles = [];
    helperState.lastAutoSubject = '';
  }
  refreshHelperUI();
  maybeShowNudge();
}

function maybeAutoGenerateSubject() {
  if (!featureFlags.subjectGenerator) return;
  if (!helperState.subject) return;
  if (helperState.lastAutoSubject === helperState.subject) return;
  helperState.lastAutoSubject = helperState.subject;
  generateSubjectSuggestions(true);
}

function parseListFromResponse(response, key) {
  if (!response) return [];
  let parsed = safeParseJSON(response);
  if (!parsed) parsed = extractJSON(response);
  if (parsed && Array.isArray(parsed[key])) {
    return parsed[key].map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
  }

  return response
    .split(/\n|\r/)
    .map(line => line.replace(/^[-*\d.\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

async function generateSubjectSuggestions(isAuto) {
  if (!featureFlags.subjectGenerator) return;
  if (!helperState.subject) {
    toast('Add a subject line first.');
    return;
  }

  setBusy('subject', true);
  try {
    let apiKey;
    try { apiKey = await getApiKey(); } catch { return; }

    let mailingHTML = '';
    try { mailingHTML = await collectMailingHTML(); } catch { mailingHTML = ''; }

    const MAX_MAILING_CHARS = 20000;
    let trimmedMailingHTML = mailingHTML;
    let truncationNote = '';
    if (trimmedMailingHTML && trimmedMailingHTML.length > MAX_MAILING_CHARS) {
      trimmedMailingHTML = trimmedMailingHTML.slice(0, MAX_MAILING_CHARS);
      truncationNote = `\n\nNote: Mailing HTML truncated to first ${MAX_MAILING_CHARS} characters.`;
    }

    const userPrompt = `Current subject line: ${helperState.subject}\n\nMailing HTML:\n${trimmedMailingHTML || '(not available)'}${truncationNote}`;
    const response = await openAIChat(apiKey, SUBJECT_SUGGESTIONS_SYSTEM_PROMPT, userPrompt, 0.6);
    const items = parseListFromResponse(response, 'subjects');

    helperState.results.subject = items.slice(0, 5);
    refreshHelperUI();
  } catch (err) {
    console.error('[Smartpr Labs][Helper] Subject suggestions failed', err);
    const msg = getOpenAIErrorMessage(err, 'Could not generate subject suggestions.');
    toast(msg);
  } finally {
    setBusy('subject', false);
  }
}

async function generateAngles() {
  if (!featureFlags.angleAssistant) return;
  if (!helperState.subject) {
    toast('Add a subject line first.');
    return;
  }

  setBusy('angles', true);
  try {
    let apiKey;
    try { apiKey = await getApiKey(); } catch { return; }

    const userPrompt = `Subject line: ${helperState.subject}\n\nAll output must stay in the same language as the subject line.`;
    const response = await openAIChat(apiKey, ANGLE_SYSTEM_PROMPT, userPrompt, 0.7);
    const items = parseListFromResponse(response, 'angles');

    helperState.results.angles = items.slice(0, 5);
    refreshHelperUI();
  } catch (err) {
    console.error('[Smartpr Labs][Helper] Angle suggestions failed', err);
    const msg = getOpenAIErrorMessage(err, 'Could not generate angles.');
    toast(msg);
  } finally {
    setBusy('angles', false);
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

async function requestPRFeedback() {
  if (!featureFlags.prFeedback) return;

  setBusy('feedback', true);
  try {
    let apiKey;
    try { apiKey = await getApiKey(); } catch { return; }

    const mailingHTML = await collectMailingHTML();
    if (!mailingHTML) {
      toast('Could not find the mailing content on this page.');
      return;
    }

    const userPrompt = `Here is the HTML of the mailing currently being edited in Smart.pr:\n\n${mailingHTML}`;
    const feedback = await openAIChat(apiKey, PR_FEEDBACK_SYSTEM_PROMPT, userPrompt, 0.4);
    helperState.results.feedback = (feedback || '').trim();
    refreshHelperUI();
  } catch (err) {
    console.error('[Smartpr Labs][Helper] PR feedback failed', err);
    const msg = getOpenAIErrorMessage(err, 'Could not fetch PR feedback.');
    toast(msg);
  } finally {
    setBusy('feedback', false);
  }
}

async function generateParagraph() {
  if (!featureFlags.paragraphWriter) return;
  if (!helperState.paragraphEligible) {
    toast('Place the cursor in an empty paragraph first.');
    return;
  }

  setBusy('paragraph', true);
  try {
    let apiKey;
    try { apiKey = await getApiKey(); } catch { return; }

    const mailingHTML = await collectMailingHTML();
    if (!mailingHTML) {
      toast('Could not detect the mailing content.');
      return;
    }

    const userPrompt = `Here is the full HTML of the mailing currently open in Smart.pr:\n\n${mailingHTML}\n\nWrite the very next paragraph that should follow, using the dominant language of the mailing.`;
    const result = await openAIChat(apiKey, PARAGRAPH_WRITER_SYSTEM_PROMPT, userPrompt, 0.7);
    helperState.results.paragraph = (result || '').trim();
    refreshHelperUI();
  } catch (err) {
    console.error('[Smartpr Labs][Helper] Paragraph draft failed', err);
    const msg = getOpenAIErrorMessage(err, 'Could not generate a paragraph.');
    toast(msg);
  } finally {
    setBusy('paragraph', false);
  }
}

// ---------- Subject watching ----------
let subjectField = null;

function onSubjectInput(event) {
  updateSubjectValue(event.target?.value || '');
}

function bindSubjectField() {
  const field = getSubjectField();
  if (field && field !== subjectField) {
    if (subjectField) {
      subjectField.removeEventListener('input', onSubjectInput);
    }
    subjectField = field;
    subjectField.addEventListener('input', onSubjectInput);
    updateSubjectValue(subjectField.value || '');
  } else if (!field && subjectField && !document.contains(subjectField)) {
    subjectField.removeEventListener('input', onSubjectInput);
    subjectField = null;
    updateSubjectValue('');
  }
}

// ---------- Feature control ----------
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
  if (featureFlags.paragraphWriter) {
    injectBeeBridge();
  }
  refreshHelperUI();
  updateHelperVisibility();
}

let pageObserver = null;

async function initHelper() {
  await loadFeatureFlags();
  await loadNudgeHistory();
  refreshMailingContext();
  ensureHelperShell();
  refreshHelperUI();
  updateHelperVisibility();
  bindSubjectField();
  scheduleMailingCheck();
  if (featureFlags.paragraphWriter) {
    injectBeeBridge();
  }

  if (!pageObserver) {
    pageObserver = new MutationObserver(() => {
      bindSubjectField();
      refreshMailingContext();
      scheduleMailingCheck();
    });
    pageObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
}

initHelper();

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
  if (FEATURE_KEYS.subjectGenerator in changes) {
    updates.subjectGenerator = normalizeFeatureValue(changes[FEATURE_KEYS.subjectGenerator].newValue, DEFAULT_FEATURE_FLAGS.subjectGenerator);
  }
  if (LABS_DISABLED_KEY in changes) {
    const nextDisabled = Boolean(changes[LABS_DISABLED_KEY].newValue);
    if (nextDisabled !== extensionDisabled) {
      extensionDisabled = nextDisabled;
      updateHelperVisibility();
    }
  }
  applyFeatureUpdates(updates);
});
