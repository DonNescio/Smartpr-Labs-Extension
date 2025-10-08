/* content.js — Story Angle Suggestion Engine (MV3)
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

const storage = {
  get: (k, d = null) => new Promise(r => chrome.storage.sync.get([k], v => r(v[k] ?? d))),
  set: (k, v) => new Promise(r => chrome.storage.sync.set({ [k]: v }, r)),
};

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
      chrome.runtime.sendMessage({ action: 'openOptionsPage' });
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
    const err = await resp.text();
    throw new Error(`OpenAI error: ${resp.status} ${err}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ---------- Modal UI ----------
function ensureModal() {
  if ($('#sase-modal')) return;

  const wrap = document.createElement('div');
  wrap.id = 'sase-modal';
  wrap.innerHTML = `
    <div class="sase-card">
      <div class="sase-row">
        <strong>Story Angle Suggestion Engine</strong>
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
  $('#sase-settings').onclick = () => chrome.runtime.sendMessage({ action: 'openOptionsPage' });
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
    toast('Error generating angles.');
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
    toast('Error writing press release.');
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

// Initial injection & observe SPA updates
ensureInjected();
new MutationObserver(() => ensureInjected()).observe(document.documentElement, { childList: true, subtree: true });

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
