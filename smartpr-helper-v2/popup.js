// Popup script - Context-aware popup for Smart.pr Assistant

const mainContent = document.getElementById('main-content');
const extensionToggle = document.getElementById('toggle-extension');
const extensionStatus = document.getElementById('extension-status');
const openOptionsButton = document.getElementById('open-options');

const EXTENSION_DISABLED_KEY = 'smartpr_helper_disabled';

// Track current context for "back" navigation
let currentContext = null;

// ========== Toggle & Settings ==========
function renderExtensionToggle(disabled) {
  if (!extensionToggle || !extensionStatus) return;
  extensionToggle.checked = !disabled;
  extensionStatus.textContent = disabled ? 'Extension is off' : 'Extension is on';
}

chrome.storage.sync.get([EXTENSION_DISABLED_KEY], (result) => {
  renderExtensionToggle(Boolean(result[EXTENSION_DISABLED_KEY]));
});

if (extensionToggle) {
  extensionToggle.addEventListener('change', () => {
    const disabled = !extensionToggle.checked;
    chrome.storage.sync.set({ [EXTENSION_DISABLED_KEY]: disabled });
    renderExtensionToggle(disabled);
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  if (EXTENSION_DISABLED_KEY in changes) {
    renderExtensionToggle(Boolean(changes[EXTENSION_DISABLED_KEY].newValue));
  }
});

openOptionsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// ========== Context Detection ==========
async function detectContext() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return { mode: 'none' };

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'getContext' });
    return response || { mode: 'none' };
  } catch {
    // Content script not available (not on Smart.pr page)
    return { mode: 'none' };
  }
}

// ========== Helpers ==========
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderFeedbackMarkup(text) {
  if (!text) return '';
  const escaped = escapeHTML(text);
  const lines = escaped.split(/\r?\n/);
  const parts = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { parts.push('</ol>'); inList = false; }
      continue;
    }
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (!inList) { parts.push('<ol>'); inList = true; }
      parts.push(`<li>${orderedMatch[1]}</li>`);
      continue;
    }
    if (inList) { parts.push('</ol>'); inList = false; }
    parts.push(`<p>${trimmed}</p>`);
  }

  if (inList) parts.push('</ol>');
  return parts.join('').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

async function setSubjectOnPage(value) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'setSubjectValue', value });
    }
  } catch {
    // Silently fail - user can copy instead
  }
}

// ========== Loading & Error States ==========
function showPopupLoading(message = 'Generating...') {
  mainContent.innerHTML = `
    <div class="popup-loading">
      <div class="popup-spinner"></div>
      <span class="popup-loading-text">${escapeHTML(message)}</span>
    </div>
  `;
}

function showPopupError(message) {
  mainContent.innerHTML = `
    <div class="popup-error">${escapeHTML(message)}</div>
    <button class="btn btn-secondary" id="back-btn">Back</button>
  `;

  document.getElementById('back-btn').addEventListener('click', () => {
    renderForContext(currentContext);
  });
}

// ========== Subject Line Helper ==========
function renderSubjectHelper(subjectValue) {
  if (subjectValue) {
    renderFilledSubjectHelper(subjectValue);
  } else {
    renderEmptySubjectHelper();
  }
}

function renderEmptySubjectHelper() {
  mainContent.innerHTML = `
    <div class="section">
      <span class="section-label">Subject Line Helper</span>
      <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin-bottom: 10px;">
        Describe your press release and I'll generate compelling subject lines.
      </p>
      <textarea
        id="pr-description"
        class="popup-textarea"
        placeholder="e.g., We're launching a new AI-powered analytics platform..."
        rows="3"
      ></textarea>
      <button class="btn btn-primary" id="generate-btn">
        Generate Subject Lines
      </button>
    </div>
  `;

  const btn = document.getElementById('generate-btn');
  const textarea = document.getElementById('pr-description');

  btn.addEventListener('click', () => {
    const desc = textarea.value.trim();
    generateSubjects('', desc);
  });

  textarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') btn.click();
  });
}

function renderFilledSubjectHelper(value) {
  mainContent.innerHTML = `
    <div class="section">
      <span class="section-label">Current Subject</span>
      <div class="subject-value">${escapeHTML(value)}</div>
    </div>
    <div class="section">
      <div class="btn-row">
        <button class="btn btn-primary" id="feedback-btn">Get Feedback</button>
        <button class="btn btn-secondary" id="alternatives-btn">Alternatives</button>
      </div>
    </div>
  `;

  document.getElementById('feedback-btn').addEventListener('click', () => getFeedback(value));
  document.getElementById('alternatives-btn').addEventListener('click', () => generateSubjects(value));
}

async function generateSubjects(currentSubject = '', description = '') {
  showPopupLoading('Generating subject lines...');

  try {
    let userPrompt = '';
    const languageInstruction = currentSubject
      ? 'All output must stay in the same language as the subject line. Do not translate.'
      : description
        ? 'Write all output in the same language as the description. Do not translate.'
        : '';
    const languageSuffix = languageInstruction ? `\n\n${languageInstruction}` : '';

    if (currentSubject) {
      userPrompt = `Generate improved alternatives for this subject line:\n\n"${currentSubject}"\n\nProvide 3-5 alternatives that are more compelling.${languageSuffix}`;
    } else if (description) {
      userPrompt = `Generate 3-5 compelling subject lines for a press release about:\n\n${description}\n\nMake them professional, newsworthy, and engaging.${languageSuffix}`;
    } else {
      userPrompt = `Generate 3-5 compelling subject lines for a press release email.${languageSuffix}`;
    }

    const result = await window.SmartPRAPI.generateSubjectLines(userPrompt, {
      currentSubject: currentSubject || undefined
    });

    renderSuggestions(result.subjects, currentSubject);
  } catch (error) {
    const errorMessage = window.SmartPRAPI.getErrorMessage(error);
    showPopupError(errorMessage);
  }
}

async function getFeedback(subject) {
  showPopupLoading('Analyzing subject line...');

  try {
    const result = await window.SmartPRAPI.getSubjectFeedback(subject, {
      keepLanguage: true
    });

    mainContent.innerHTML = `
      <div class="section">
        <span class="section-label">Your Subject</span>
        <div class="subject-value">${escapeHTML(subject)}</div>
      </div>
      <div class="section">
        <span class="section-label">Feedback</span>
        <div class="feedback-box">${renderFeedbackMarkup(result.feedback)}</div>
      </div>
      <div class="section">
        <button class="btn btn-primary" id="gen-better-btn">Generate Better Alternatives</button>
        <button class="btn btn-secondary" id="back-btn">Back</button>
      </div>
    `;

    document.getElementById('gen-better-btn').addEventListener('click', () => generateSubjects(subject));
    document.getElementById('back-btn').addEventListener('click', () => renderForContext(currentContext));
  } catch (error) {
    const errorMessage = window.SmartPRAPI.getErrorMessage(error);
    showPopupError(errorMessage);
  }
}

function renderSuggestions(suggestions, originalSubject) {
  let html = '';

  if (originalSubject) {
    html += `
      <div class="section">
        <span class="section-label">Original</span>
        <div class="subject-value">${escapeHTML(originalSubject)}</div>
      </div>
    `;
  }

  html += `
    <div class="section">
      <span class="section-label">Suggestions</span>
      ${suggestions.map((s, i) => `
        <div class="suggestion-item">
          <div class="suggestion-text">${escapeHTML(s)}</div>
          <div class="suggestion-actions">
            <button class="btn-icon btn-use" data-index="${i}" title="Apply to subject field">Use</button>
            <button class="btn-icon" data-copy="${i}" title="Copy to clipboard">Copy</button>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="section">
      <button class="btn btn-secondary" id="more-btn">Generate More</button>
    </div>
  `;

  mainContent.innerHTML = html;

  // Use buttons - apply suggestion to the subject field on the page
  mainContent.querySelectorAll('.btn-use').forEach((btn, i) => {
    btn.addEventListener('click', async () => {
      const text = suggestions[i];
      await setSubjectOnPage(text);
      btn.textContent = '\u2713';
      btn.classList.add('used');
      setTimeout(() => {
        btn.textContent = 'Use';
        btn.classList.remove('used');
      }, 2000);
    });
  });

  // Copy buttons
  mainContent.querySelectorAll('[data-copy]').forEach((btn, i) => {
    btn.addEventListener('click', async () => {
      const text = suggestions[i];
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback: noop in popup context
      }
      btn.textContent = '\u2713';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'Copy';
        btn.classList.remove('copied');
      }, 2000);
    });
  });

  // Generate more button
  document.getElementById('more-btn').addEventListener('click', () => {
    generateSubjects(originalSubject || '');
  });
}

// ========== Paragraph Coach View ==========
let popupSelectedText = '';
let selectionPollTimer = null;

function stopSelectionPolling() {
  if (selectionPollTimer) {
    clearInterval(selectionPollTimer);
    selectionPollTimer = null;
  }
}

function startSelectionPolling() {
  stopSelectionPolling();
  selectionPollTimer = setInterval(async () => {
    const context = await detectContext();
    if (context.mode === 'editor' && context.selectedText) {
      stopSelectionPolling();
      popupSelectedText = context.selectedText;
      captureEditorSelection();
      renderParagraphCoachActive(context.selectedText);
    }
  }, 500);
}

function renderParagraphCoach(selectedText) {
  stopSelectionPolling();
  if (selectedText) {
    popupSelectedText = selectedText;
    captureEditorSelection();
    renderParagraphCoachActive(selectedText);
  } else {
    popupSelectedText = '';
    renderParagraphCoachIdle();
  }
}

function renderParagraphCoachIdle() {
  startSelectionPolling();
  mainContent.innerHTML = `
    <div class="section">
      <div class="editor-status">
        <span>\u2713</span>
        <span>Paragraph Coach is ready</span>
      </div>
    </div>
    <div class="section">
      <span class="section-label">How to use</span>
      <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin-bottom: 10px;">
        Select text in any editor block, then click the icon that appears next to it.
      </p>
    </div>
    <div class="section">
      <span class="section-label">Available Actions</span>
      <div class="action-list">
        <div class="action-list-item"><span class="action-list-icon">\u2713</span> Fix Spelling & Grammar</div>
        <div class="action-list-item"><span class="action-list-icon">\uD83D\uDD04</span> Rephrase Paragraph</div>
        <div class="action-list-item"><span class="action-list-icon">\uD83D\uDCA1</span> Suggest Synonyms</div>
        <div class="action-list-item"><span class="action-list-icon">\uD83C\uDF10</span> Translate</div>
        <div class="action-list-item"><span class="action-list-icon">\uD83D\uDCDD</span> Make Shorter</div>
      </div>
    </div>
  `;
}

function renderParagraphCoachActive(text) {
  const displayText = text.length > 200 ? text.substring(0, 200) + '...' : text;

  mainContent.innerHTML = `
    <div class="section">
      <span class="section-label">Selected Text</span>
      <div class="subject-value">${escapeHTML(displayText)}</div>
    </div>
    <div class="section">
      <span class="section-label">What would you like to do?</span>
      <div class="action-grid">
        <button class="action-grid-btn" data-action="grammar">
          <span class="action-grid-icon">\u2713</span>
          <span class="action-grid-label">Fix Spelling & Grammar</span>
        </button>
        <button class="action-grid-btn" data-action="rephrase">
          <span class="action-grid-icon">\uD83D\uDD04</span>
          <span class="action-grid-label">Rephrase</span>
        </button>
        <button class="action-grid-btn" data-action="synonyms">
          <span class="action-grid-icon">\uD83D\uDCA1</span>
          <span class="action-grid-label">Synonyms</span>
        </button>
        <button class="action-grid-btn" data-action="translate">
          <span class="action-grid-icon">\uD83C\uDF10</span>
          <span class="action-grid-label">Translate</span>
        </button>
        <button class="action-grid-btn" data-action="shorter">
          <span class="action-grid-icon">\uD83D\uDCDD</span>
          <span class="action-grid-label">Make Shorter</span>
        </button>
      </div>
    </div>
  `;

  mainContent.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'translate') {
        renderTranslateOptions();
      } else {
        handlePopupParagraphAction(action);
      }
    });
  });
}

function renderTranslateOptions() {
  const displayText = popupSelectedText.length > 100 ? popupSelectedText.substring(0, 100) + '...' : popupSelectedText;

  mainContent.innerHTML = `
    <div class="section">
      <span class="section-label">Selected Text</span>
      <div class="subject-value">${escapeHTML(displayText)}</div>
    </div>
    <div class="section">
      <span class="section-label">Translate to</span>
      <div class="btn-row">
        <button class="btn btn-secondary lang-btn" data-lang="English">EN</button>
        <button class="btn btn-secondary lang-btn" data-lang="Dutch">NL</button>
        <button class="btn btn-secondary lang-btn" data-lang="German">DE</button>
        <button class="btn btn-secondary lang-btn" data-lang="French">FR</button>
      </div>
      <div style="display: flex; gap: 6px; margin-top: 6px;">
        <input type="text" id="other-lang" class="popup-textarea" placeholder="Other language..." style="min-height: auto; padding: 8px 12px; margin-bottom: 0; flex: 1;">
        <button class="btn btn-primary" id="translate-other" style="width: auto; padding: 8px 14px; margin-bottom: 0;">Go</button>
      </div>
    </div>
    <div class="section">
      <button class="btn btn-secondary" id="back-to-actions">\u2190 Back</button>
    </div>
  `;

  mainContent.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handlePopupParagraphAction('translate', { targetLanguage: btn.dataset.lang });
    });
  });

  document.getElementById('translate-other').addEventListener('click', () => {
    const lang = document.getElementById('other-lang').value.trim();
    if (lang) handlePopupParagraphAction('translate', { targetLanguage: lang });
  });

  document.getElementById('other-lang').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('translate-other').click();
    }
  });

  document.getElementById('back-to-actions').addEventListener('click', () => {
    renderParagraphCoachActive(popupSelectedText);
  });
}

async function handlePopupParagraphAction(action, options = {}) {
  const text = popupSelectedText;
  if (!text) return;

  let loadingMessage = 'Processing...';
  switch (action) {
    case 'grammar': loadingMessage = 'Checking spelling & grammar...'; break;
    case 'rephrase': loadingMessage = 'Rephrasing...'; break;
    case 'synonyms': loadingMessage = 'Finding synonyms...'; break;
    case 'translate': loadingMessage = `Translating to ${options.targetLanguage}...`; break;
    case 'shorter': loadingMessage = 'Making text shorter...'; break;
  }

  showPopupLoading(loadingMessage);

  try {
    const result = await window.SmartPRAPI.processParagraph(text, action, options);
    renderParagraphResult(result.text, action, options);
  } catch (error) {
    const errorMessage = window.SmartPRAPI.getErrorMessage(error);
    mainContent.innerHTML = `
      <div class="popup-error">${escapeHTML(errorMessage)}</div>
      <div class="section">
        <button class="btn btn-primary" id="retry-btn">Try Again</button>
        <button class="btn btn-secondary" id="back-btn">\u2190 Back</button>
      </div>
    `;
    document.getElementById('retry-btn').addEventListener('click', () => handlePopupParagraphAction(action, options));
    document.getElementById('back-btn').addEventListener('click', () => renderParagraphCoachActive(popupSelectedText));
  }
}

function renderParagraphResult(resultText, action, options) {
  let actionLabel = 'Result';
  switch (action) {
    case 'grammar': actionLabel = 'Corrected Text'; break;
    case 'rephrase': actionLabel = 'Rephrased Text'; break;
    case 'synonyms': actionLabel = 'Synonym Suggestions'; break;
    case 'translate': actionLabel = `Translated to ${options.targetLanguage}`; break;
    case 'shorter': actionLabel = 'Shortened Text'; break;
  }

  const originalDisplay = popupSelectedText.length > 100 ? popupSelectedText.substring(0, 100) + '...' : popupSelectedText;

  mainContent.innerHTML = `
    <div class="section">
      <span class="section-label">Original</span>
      <div class="subject-value" style="font-size: 12px; opacity: 0.8;">${escapeHTML(originalDisplay)}</div>
    </div>
    <div class="section">
      <span class="section-label">${escapeHTML(actionLabel)}</span>
      <div class="result-box">${escapeHTML(resultText)}</div>
    </div>
    <div class="section">
      <button class="btn btn-primary" id="replace-btn">Replace in Editor</button>
      <button class="btn btn-secondary" id="copy-result-btn">Copy to Clipboard</button>
      <button class="btn btn-secondary" id="another-action-btn">\u2190 Try Another Action</button>
    </div>
  `;

  document.getElementById('replace-btn').addEventListener('click', async () => {
    await replaceEditorText(resultText);
    const btn = document.getElementById('replace-btn');
    btn.textContent = '\u2713 Replaced!';
    btn.disabled = true;
  });

  document.getElementById('copy-result-btn').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(resultText); } catch {}
    const btn = document.getElementById('copy-result-btn');
    btn.textContent = '\u2713 Copied';
    setTimeout(() => { btn.textContent = 'Copy to Clipboard'; }, 2000);
  });

  document.getElementById('another-action-btn').addEventListener('click', () => {
    renderParagraphCoachActive(popupSelectedText);
  });
}

async function captureEditorSelection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'captureEditorSelection' });
    }
  } catch {}
}

async function replaceEditorText(value) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'replaceEditorText', value });
    }
  } catch {}
}

// ========== Overview Page ==========
function renderOverview(onSmartPr) {
  const ctaText = onSmartPr
    ? 'Open a mailing to get started with these features.'
    : 'Visit <strong>smart.pr</strong> and open a mailing to use these features.';

  mainContent.innerHTML = `
    <div class="section">
      <p class="overview-intro">
        AI-powered writing assistant for Smart.pr mailings.
      </p>
    </div>
    <div class="section">
      <span class="section-label">Features</span>
      <div class="feature-card">
        <div class="feature-icon">\u2709\uFE0F</div>
        <div class="feature-title">Subject Line Helper</div>
        <div class="feature-desc">Generate compelling subject lines or get feedback on your current one.</div>
        <div class="feature-how">\u2192 Click the subject field in any mailing</div>
      </div>
      <div class="feature-card">
        <div class="feature-icon">\u2728</div>
        <div class="feature-title">Paragraph Coach</div>
        <div class="feature-desc">Fix grammar, rephrase text, translate, find synonyms, or shorten your content.</div>
        <div class="feature-how">\u2192 Select text in the editor and click the icon</div>
      </div>
    </div>
    <div class="cta-text">
      <p>${ctaText}</p>
    </div>
  `;
}

// ========== Main Rendering ==========
function renderForContext(context) {
  switch (context.mode) {
    case 'subject':
      renderSubjectHelper(context.value);
      break;
    case 'editor':
      renderParagraphCoach(context.selectedText);
      break;
    case 'disabled':
      renderOverview(true);
      break;
    default:
      renderOverview(context.onSmartPr || false);
      break;
  }
}

// ========== Init ==========
async function initPopup() {
  currentContext = await detectContext();
  renderForContext(currentContext);
}

initPopup();
