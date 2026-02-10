// Popup script - Context-aware popup for Smart.pr Assistant

const mainContent = document.getElementById('main-content');
const extensionToggle = document.getElementById('toggle-extension');
const extensionStatus = document.getElementById('extension-status');
const openOptionsButton = document.getElementById('open-options');

const EXTENSION_DISABLED_KEY = 'smartpr_helper_disabled';

// Track current context for "back" navigation
let currentContext = null;
let popupLoadingMessageTimer = null;
let popupBusy = false; // Prevents double-clicks firing concurrent API calls

// Knowledge Base state
let popupKBConversation = [];
let popupKBConversationId = null;

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

// ========== Feedback ==========
const popupFeedbackArea = document.getElementById('popup-feedback-area');

function initPopupFeedback() {
  const btn = document.getElementById('popup-feedback-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      showPopupFeedbackForm();
    });
  }
}

function showPopupFeedbackForm() {
  popupFeedbackArea.innerHTML = `
    <div class="popup-feedback-form">
      <textarea class="popup-feedback-textarea" id="popup-feedback-text" rows="2" placeholder="Tell us what you think..."></textarea>
      <div class="popup-feedback-actions">
        <button class="popup-feedback-send" id="popup-feedback-send">Send</button>
        <button class="popup-feedback-cancel" id="popup-feedback-cancel">Cancel</button>
      </div>
    </div>
  `;

  const textarea = document.getElementById('popup-feedback-text');
  textarea.focus();

  document.getElementById('popup-feedback-cancel').addEventListener('click', () => {
    resetPopupFeedback();
  });

  document.getElementById('popup-feedback-send').addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;

    const sendBtn = document.getElementById('popup-feedback-send');
    sendBtn.textContent = 'Sending...';
    sendBtn.disabled = true;

    try {
      await window.SmartPRAPI.submitFeedback(text);
      resetPopupFeedback();
      // Brief visual confirmation
      const area = document.getElementById('popup-feedback-area');
      const origHTML = area.innerHTML;
      area.innerHTML = '<span style="font-size: 11px; color: #059669; font-weight: 600;">\u2713 Feedback sent!</span>';
      setTimeout(() => { resetPopupFeedback(); }, 2000);
    } catch (error) {
      sendBtn.textContent = 'Send';
      sendBtn.disabled = false;
      console.error('[Popup] Feedback error:', error);
    }
  });
}

function resetPopupFeedback() {
  popupFeedbackArea.innerHTML = '<button class="settings-link" id="popup-feedback-btn">Feedback</button>';
  initPopupFeedback();
}

initPopupFeedback();

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

// Magic UX: View Transitions
function setPopupContentWithTransition(html) {
  return new Promise((resolve) => {
    mainContent.style.opacity = '0';
    mainContent.style.transition = 'opacity 0.1s ease';
    setTimeout(() => {
      mainContent.innerHTML = html;
      mainContent.style.opacity = '';
      mainContent.style.transition = '';
      mainContent.classList.remove('popup-view-enter');
      void mainContent.offsetWidth;
      mainContent.classList.add('popup-view-enter');
      resolve();
    }, 100);
  });
}

// Magic UX: Typewriter Effect
function popupTypewriterEffect(element, text, speed = 15) {
  return new Promise((resolve) => {
    const words = text.split(/(\s+)/);
    let i = 0;
    element.textContent = '';
    const cursor = document.createElement('span');
    cursor.className = 'popup-typing-cursor';
    cursor.textContent = '|';
    element.appendChild(cursor);

    const interval = setInterval(() => {
      if (i < words.length) {
        cursor.before(document.createTextNode(words[i]));
        i++;
      } else {
        clearInterval(interval);
        cursor.remove();
        resolve();
      }
    }, speed);
  });
}

// Magic UX: Word-Level Diff
function popupDiffWords(original, corrected) {
  const origWords = original.split(/(\s+)/);
  const corrWords = corrected.split(/(\s+)/);
  const result = [];
  let oi = 0;
  for (let ci = 0; ci < corrWords.length; ci++) {
    const word = corrWords[ci];
    if (!word.trim()) {
      result.push({ text: word, changed: false });
      continue;
    }
    if (oi < origWords.length && origWords[oi] === word) {
      result.push({ text: word, changed: false });
      oi++;
    } else {
      while (oi < origWords.length && !origWords[oi].trim()) oi++;
      if (oi < origWords.length && origWords[oi] === word) {
        result.push({ text: word, changed: false });
        oi++;
      } else {
        result.push({ text: word, changed: true });
        if (oi < origWords.length) oi++;
      }
    }
  }
  return result;
}

function popupRenderDiffHTML(diffResult) {
  return diffResult.map(seg =>
    seg.changed
      ? `<span class="popup-diff-highlight">${escapeHTML(seg.text)}</span>`
      : escapeHTML(seg.text)
  ).join('');
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
const POPUP_PROGRESSIVE_MESSAGES = {
  grammar: ['Checking spelling & grammar...', 'Scanning for typos...', 'Polishing your prose...', 'Almost there...'],
  rephrase: ['Rephrasing...', 'Exploring angles...', 'Crafting alternatives...', 'Finishing up...'],
  synonyms: ['Finding synonyms...', 'Searching the thesaurus...', 'Picking the best words...', 'Almost ready...'],
  translate: ['Translating text...', 'Finding the right words...', 'Preserving meaning...', 'Wrapping up...'],
  shorter: ['Making text shorter...', 'Trimming the excess...', 'Keeping what matters...', 'Nearly done...'],
  default: ['Processing...', 'Working on it...', 'Hang tight...', 'Almost there...']
};

function showPopupLoading(message = 'Generating...', action = null) {
  if (popupLoadingMessageTimer) {
    clearInterval(popupLoadingMessageTimer);
    popupLoadingMessageTimer = null;
  }

  let skeletonHTML = '';
  if (action === 'synonyms' || action === 'rephrase') {
    skeletonHTML = `
      <div class="popup-skeleton popup-skeleton-label"></div>
      <div class="popup-skeleton popup-skeleton-card cascade-item" style="animation-delay: 0ms"></div>
      <div class="popup-skeleton popup-skeleton-card cascade-item" style="animation-delay: 100ms"></div>
      <div class="popup-skeleton popup-skeleton-card cascade-item" style="animation-delay: 200ms"></div>
    `;
  } else if (action === 'grammar' || action === 'translate' || action === 'shorter') {
    skeletonHTML = `
      <div class="popup-skeleton popup-skeleton-label"></div>
      <div class="popup-skeleton popup-skeleton-text"></div>
    `;
  }
  mainContent.innerHTML = `
    <div class="popup-loading">
      ${skeletonHTML || '<div class="popup-spinner"></div>'}
      <span class="popup-loading-text">${escapeHTML(message)}</span>
    </div>
  `;

  const messages = POPUP_PROGRESSIVE_MESSAGES[action] || POPUP_PROGRESSIVE_MESSAGES.default;
  let msgIndex = 1;
  popupLoadingMessageTimer = setInterval(() => {
    const el = mainContent.querySelector('.popup-loading-text');
    if (el && msgIndex < messages.length) {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.2s ease';
      setTimeout(() => {
        el.textContent = messages[msgIndex];
        el.style.opacity = '1';
        msgIndex++;
      }, 200);
    }
    if (msgIndex >= messages.length) {
      clearInterval(popupLoadingMessageTimer);
      popupLoadingMessageTimer = null;
    }
  }, 2500);
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
  if (popupBusy) return;
  popupBusy = true;
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
  } finally {
    popupBusy = false;
  }
}

async function getFeedback(subject) {
  if (popupBusy) return;
  popupBusy = true;
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
  } finally {
    popupBusy = false;
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
        <div class="suggestion-item cascade-item" style="animation-delay: ${i * 60}ms">
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
      } else if (action === 'rephrase') {
        renderToneSelector();
      } else {
        handlePopupParagraphAction(action);
      }
    });
  });
}

function renderToneSelector() {
  const displayText = popupSelectedText.length > 100 ? popupSelectedText.substring(0, 100) + '...' : popupSelectedText;

  mainContent.innerHTML = `
    <div class="section">
      <span class="section-label">Selected Text</span>
      <div class="subject-value" style="font-size: 12px; opacity: 0.8;">${escapeHTML(displayText)}</div>
    </div>
    <div class="section">
      <button class="btn btn-primary" id="rephrase-no-tone">Rephrase</button>
    </div>
    <div class="section">
      <span class="section-label">Or pick a tone</span>
      <div class="popup-tone-buttons">
        <button class="popup-tone-btn" data-tone="formal">Formal</button>
        <button class="popup-tone-btn" data-tone="friendly">Friendly</button>
        <button class="popup-tone-btn" data-tone="persuasive">Persuasive</button>
        <button class="popup-tone-btn" data-tone="concise">Concise</button>
      </div>
    </div>
    <div class="section">
      <button class="btn btn-secondary" id="back-to-actions">\u2190 Back</button>
    </div>
  `;

  document.getElementById('rephrase-no-tone').addEventListener('click', () => {
    handlePopupParagraphAction('rephrase');
  });

  mainContent.querySelectorAll('.popup-tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handlePopupParagraphAction('rephrase', { tone: btn.dataset.tone });
    });
  });

  document.getElementById('back-to-actions').addEventListener('click', () => {
    renderParagraphCoachActive(popupSelectedText);
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
  if (popupBusy) return;
  const text = popupSelectedText;
  if (!text) return;
  popupBusy = true;

  let loadingMessage = 'Processing...';
  switch (action) {
    case 'grammar': loadingMessage = 'Checking spelling & grammar...'; break;
    case 'rephrase': loadingMessage = 'Rephrasing...'; break;
    case 'synonyms': loadingMessage = 'Finding synonyms...'; break;
    case 'translate': loadingMessage = `Translating to ${options.targetLanguage}...`; break;
    case 'shorter': loadingMessage = 'Making text shorter...'; break;
  }

  showPopupLoading(loadingMessage, action);

  try {
    const result = await window.SmartPRAPI.processParagraph(text, action, options);
    if (popupLoadingMessageTimer) {
      clearInterval(popupLoadingMessageTimer);
      popupLoadingMessageTimer = null;
    }
    if (action === 'synonyms') {
      renderSynonymResult(result);
    } else if (action === 'rephrase') {
      renderRephraseResult(result);
    } else if (action === 'grammar') {
      renderGrammarResult(result);
    } else if (action === 'shorter') {
      renderShorterResult(result);
    } else {
      renderParagraphResult(result.text, action, options);
    }
  } catch (error) {
    if (popupLoadingMessageTimer) {
      clearInterval(popupLoadingMessageTimer);
      popupLoadingMessageTimer = null;
    }
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
  } finally {
    popupBusy = false;
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
      <div class="result-box" id="popup-paragraph-result"></div>
    </div>
    <div class="section">
      <button class="btn btn-primary" id="replace-btn" disabled>Replace in Editor</button>
      <button class="btn btn-secondary" id="copy-result-btn" disabled>Copy to Clipboard</button>
      <button class="btn btn-secondary" id="another-action-btn">\u2190 Try Another Action</button>
    </div>
  `;

  const resultElement = document.getElementById('popup-paragraph-result');
  const replaceBtn = document.getElementById('replace-btn');
  const copyBtn = document.getElementById('copy-result-btn');

  popupTypewriterEffect(resultElement, resultText).then(() => {
    replaceBtn.disabled = false;
    copyBtn.disabled = false;
  });

  replaceBtn.addEventListener('click', async () => {
    await replaceEditorText(resultText);
    replaceBtn.textContent = '\u2713 Replaced!';
    replaceBtn.disabled = true;
  });

  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(resultText); } catch {}
    copyBtn.textContent = '\u2713 Copied';
    setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
  });

  document.getElementById('another-action-btn').addEventListener('click', () => {
    renderParagraphCoachActive(popupSelectedText);
  });
}

function popupParseSynonymsFromText(text) {
  const suggestions = [];
  const lines = text.split('\n').filter(l => l.trim());

  for (const line of lines) {
    if (line.includes('\u2192') || line.includes('->')) {
      const arrowParts = line.split(/\u2192|->/).map(s => s.trim());
      if (arrowParts.length >= 2) {
        const syns = arrowParts[1].split(',').map(s => s.trim()).filter(Boolean);
        suggestions.push(...syns);
        continue;
      }
    }

    const listMatch = line.match(/^(?:\d+[.)]\s*|-\s*|\*\s*)(.+)/);
    if (listMatch) {
      suggestions.push(listMatch[1].trim());
      continue;
    }
  }

  if (suggestions.length === 0) {
    const commaList = text.split(',').map(s => s.trim()).filter(Boolean);
    if (commaList.length > 1) {
      suggestions.push(...commaList);
    }
  }

  if (suggestions.length === 0 && text.trim()) {
    suggestions.push(text.trim());
  }

  return suggestions;
}

function renderSynonymResult(result) {
  const suggestions = result.synonyms || popupParseSynonymsFromText(result.text);

  const originalDisplay = popupSelectedText.length > 100
    ? popupSelectedText.substring(0, 100) + '...'
    : popupSelectedText;

  const synonymOptionsHTML = suggestions.map((syn, i) => `
    <div class="synonym-option cascade-item" style="animation-delay: ${i * 60}ms">
      <span class="synonym-text">${escapeHTML(syn)}</span>
      <div class="synonym-actions">
        <button class="synonym-btn synonym-copy" data-index="${i}" title="Copy to clipboard">Copy</button>
        <button class="synonym-btn synonym-inject" data-index="${i}" title="Replace in editor">Inject</button>
      </div>
    </div>
  `).join('');

  mainContent.innerHTML = `
    <div class="section">
      <span class="section-label">Original</span>
      <div class="subject-value" style="font-size: 12px; opacity: 0.8;">${escapeHTML(originalDisplay)}</div>
    </div>
    <div class="section">
      <span class="section-label">Synonym Suggestions</span>
      <div class="synonym-list">
        ${synonymOptionsHTML}
      </div>
    </div>
    <div class="section">
      <button class="btn btn-secondary" id="another-action-btn">\u2190 Try Another Action</button>
    </div>
  `;

  document.querySelectorAll('.synonym-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index);
      try { await navigator.clipboard.writeText(suggestions[index]); } catch {}
      btn.textContent = '\u2713';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });

  document.querySelectorAll('.synonym-inject').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index);
      await replaceEditorText(suggestions[index]);
      btn.textContent = '\u2713';
      setTimeout(() => { btn.textContent = 'Inject'; }, 2000);
    });
  });

  document.getElementById('another-action-btn').addEventListener('click', () => {
    renderParagraphCoachActive(popupSelectedText);
  });
}

function popupParseRephraseFromText(text) {
  const options = [];
  const lines = text.split('\n').filter(l => l.trim());

  for (const line of lines) {
    const listMatch = line.match(/^(?:\d+[.)]\s*|-\s*|\*\s*)(.+)/);
    if (listMatch) {
      options.push(listMatch[1].trim());
      continue;
    }
  }

  if (options.length === 0 && text.trim()) {
    options.push(text.trim());
  }

  return options;
}

function renderRephraseResult(result) {
  const options = result.rephraseOptions || popupParseRephraseFromText(result.text);

  const originalDisplay = popupSelectedText.length > 100
    ? popupSelectedText.substring(0, 100) + '...'
    : popupSelectedText;

  const optionsHTML = options.map((opt, i) => `
    <div class="synonym-option rephrase-option cascade-item" style="animation-delay: ${i * 60}ms">
      <span class="synonym-text">${escapeHTML(opt)}</span>
      <div class="synonym-actions">
        <button class="synonym-btn synonym-copy" data-index="${i}" title="Copy to clipboard">Copy</button>
        <button class="synonym-btn synonym-inject" data-index="${i}" title="Replace in editor">Inject</button>
      </div>
    </div>
  `).join('');

  mainContent.innerHTML = `
    <div class="section">
      <span class="section-label">Original</span>
      <div class="subject-value" style="font-size: 12px; opacity: 0.8;">${escapeHTML(originalDisplay)}</div>
    </div>
    <div class="section">
      <span class="section-label">Rephrase Options</span>
      <div class="synonym-list">
        ${optionsHTML}
      </div>
    </div>
    <div class="section">
      <button class="btn btn-secondary" id="another-action-btn">\u2190 Try Another Action</button>
    </div>
  `;

  document.querySelectorAll('.synonym-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index);
      try { await navigator.clipboard.writeText(options[index]); } catch {}
      btn.textContent = '\u2713';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });

  document.querySelectorAll('.synonym-inject').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index);
      await replaceEditorText(options[index]);
      btn.textContent = '\u2713';
      setTimeout(() => { btn.textContent = 'Inject'; }, 2000);
    });
  });

  document.getElementById('another-action-btn').addEventListener('click', () => {
    renderParagraphCoachActive(popupSelectedText);
  });
}

function renderGrammarResult(result) {
  const originalDisplay = popupSelectedText.length > 100
    ? popupSelectedText.substring(0, 100) + '...'
    : popupSelectedText;

  const diffResult = popupDiffWords(popupSelectedText, result.text);
  const diffHTML = popupRenderDiffHTML(diffResult);

  let changesHTML = '';
  if (result.changes && result.changes.length > 0) {
    const items = result.changes.map((c, i) => `<li class="change-item cascade-item" style="animation-delay: ${i * 60}ms">${escapeHTML(c)}</li>`).join('');
    changesHTML = `
      <div class="section">
        <span class="section-label">Changes Made</span>
        <ul class="changes-list">${items}</ul>
      </div>
    `;
  }

  mainContent.innerHTML = `
    <div class="section">
      <span class="section-label">Original</span>
      <div class="subject-value" style="font-size: 12px; opacity: 0.8;">${escapeHTML(originalDisplay)}</div>
    </div>
    <div class="section">
      <span class="section-label">Corrected Text</span>
      <div class="result-box" id="popup-grammar-result"></div>
    </div>
    ${changesHTML}
    <div class="section">
      <button class="btn btn-primary" id="replace-btn" disabled>Replace in Editor</button>
      <button class="btn btn-secondary" id="copy-result-btn" disabled>Copy to Clipboard</button>
      <button class="btn btn-secondary" id="another-action-btn">\u2190 Try Another Action</button>
    </div>
  `;

  const resultElement = document.getElementById('popup-grammar-result');
  const replaceBtn = document.getElementById('replace-btn');
  const copyBtn = document.getElementById('copy-result-btn');

  popupTypewriterEffect(resultElement, result.text).then(() => {
    resultElement.innerHTML = diffHTML;
    replaceBtn.disabled = false;
    copyBtn.disabled = false;
  });

  replaceBtn.addEventListener('click', async () => {
    await replaceEditorText(result.text);
    replaceBtn.textContent = '\u2713 Replaced!';
    replaceBtn.disabled = true;
  });

  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(result.text); } catch {}
    copyBtn.textContent = '\u2713 Copied';
    setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
  });

  document.getElementById('another-action-btn').addEventListener('click', () => {
    renderParagraphCoachActive(popupSelectedText);
  });
}

function renderShorterResult(result) {
  const originalDisplay = popupSelectedText.length > 100
    ? popupSelectedText.substring(0, 100) + '...'
    : popupSelectedText;

  const originalWordCount = popupSelectedText.trim().split(/\s+/).filter(Boolean).length;
  const newWordCount = result.text.trim().split(/\s+/).filter(Boolean).length;

  mainContent.innerHTML = `
    <div class="section">
      <span class="section-label">Original</span>
      <div class="subject-value" style="font-size: 12px; opacity: 0.8;">${escapeHTML(originalDisplay)}</div>
    </div>
    <div class="section">
      <span class="section-label">Shortened Text</span>
      <div class="word-count-badge">${originalWordCount} \u2192 ${newWordCount} words</div>
      <div class="result-box" id="popup-shorter-result"></div>
    </div>
    <div class="section">
      <button class="btn btn-primary" id="replace-btn" disabled>Replace in Editor</button>
      <button class="btn btn-secondary" id="copy-result-btn" disabled>Copy to Clipboard</button>
      <button class="btn btn-secondary" id="another-action-btn">\u2190 Try Another Action</button>
    </div>
  `;

  const resultElement = document.getElementById('popup-shorter-result');
  const replaceBtn = document.getElementById('replace-btn');
  const copyBtn = document.getElementById('copy-result-btn');

  popupTypewriterEffect(resultElement, result.text).then(() => {
    replaceBtn.disabled = false;
    copyBtn.disabled = false;
  });

  replaceBtn.addEventListener('click', async () => {
    await replaceEditorText(result.text);
    replaceBtn.textContent = '\u2713 Replaced!';
    replaceBtn.disabled = true;
  });

  copyBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(result.text); } catch {}
    copyBtn.textContent = '\u2713 Copied';
    setTimeout(() => { copyBtn.textContent = 'Copy to Clipboard'; }, 2000);
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
  // Overview leads with Knowledge Base as the primary action
  popupKBConversation = [];
  popupKBConversationId = null;
  renderPopupKBEmpty();
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

// ========== Knowledge Base ==========
async function renderPopupKBEmpty() {
  await setPopupContentWithTransition(`
    <div class="section">
      <div style="text-align: center; padding: 16px 0;">
        <div style="font-size: 36px; margin-bottom: 8px;">📚</div>
        <strong>Ask anything about Smart.pr</strong>
        <p style="margin-top: 6px; color: #6b7280; font-size: 13px;">
          Get help with the platform or PR writing best practices.
        </p>
      </div>
    </div>
    <div class="section">
      <span class="section-label">Suggested Questions</span>
      <div class="popup-kb-suggestions">
        <button class="popup-kb-suggestion-btn cascade-item" style="animation-delay: 0ms" data-q="How do I schedule a mailing?">How do I schedule a mailing?</button>
        <button class="popup-kb-suggestion-btn cascade-item" style="animation-delay: 60ms" data-q="What makes a good press release subject line?">What makes a good PR subject line?</button>
        <button class="popup-kb-suggestion-btn cascade-item" style="animation-delay: 120ms" data-q="How do I import contacts?">How do I import contacts?</button>
      </div>
    </div>
    <div class="section popup-kb-input-section">
      <div class="popup-kb-input-row">
        <input type="text" id="popup-kb-input" class="popup-textarea popup-kb-input" placeholder="Ask a question..." style="min-height: auto; resize: none;">
        <button class="popup-kb-ask-btn" id="popup-kb-ask-btn">Ask</button>
      </div>
    </div>
    <div class="section" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(232,181,232,0.15);">
      <span class="section-label">Also available in mailings</span>
      <div style="font-size: 11px; color: #9B8FB8; line-height: 1.7;">
        <div>\u2709\uFE0F <strong>Subject Line Coach</strong> \u2014 click the subject field</div>
        <div>\u2728 <strong>Paragraph Coach</strong> \u2014 select text in the editor</div>
      </div>
    </div>
  `);

  document.querySelectorAll('.popup-kb-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handlePopupKBQuestion(btn.dataset.q);
    });
  });

  const input = document.getElementById('popup-kb-input');
  const askBtn = document.getElementById('popup-kb-ask-btn');

  askBtn.addEventListener('click', () => {
    const q = input.value.trim();
    if (q) handlePopupKBQuestion(q);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = input.value.trim();
      if (q) handlePopupKBQuestion(q);
    }
  });

  input.focus();
}

async function handlePopupKBQuestion(question) {
  if (popupBusy) return;
  popupBusy = true;

  popupKBConversation.push({ role: 'user', text: question });
  renderPopupKBConversation(true);

  try {
    const result = await window.SmartPRAPI.askKnowledgeBase(question, popupKBConversationId);
    popupKBConversationId = result.conversationId;

    popupKBConversation.push({
      role: 'assistant',
      text: result.answer,
      citations: result.citations || []
    });

    renderPopupKBConversation(false);
  } catch (error) {
    popupKBConversation.pop();
    const errorMessage = window.SmartPRAPI.getErrorMessage(error);
    renderPopupKBConversation(false, errorMessage);
  } finally {
    popupBusy = false;
  }
}

async function renderPopupKBConversation(isLoading, errorMessage) {
  const messagesHTML = popupKBConversation.map((msg, i) => {
    if (msg.role === 'user') {
      return `
        <div class="popup-kb-message popup-kb-user cascade-item" style="animation-delay: ${i * 40}ms">
          ${escapeHTML(msg.text)}
        </div>
      `;
    } else {
      return `
        <div class="popup-kb-message popup-kb-assistant cascade-item" style="animation-delay: ${i * 40}ms">
          ${renderPopupKBMarkup(msg.text)}
        </div>
      `;
    }
  }).join('');

  let loadingHTML = '';
  if (isLoading) {
    loadingHTML = `
      <div class="popup-kb-message popup-kb-assistant">
        <div class="popup-kb-typing">
          <span class="popup-kb-typing-dot"></span>
          <span class="popup-kb-typing-dot"></span>
          <span class="popup-kb-typing-dot"></span>
        </div>
      </div>
    `;
  }

  let errorHTML = '';
  if (errorMessage) {
    errorHTML = `<div class="error-message" style="margin-bottom: 8px;">${escapeHTML(errorMessage)}</div>`;
  }

  await setPopupContentWithTransition(`
    <div class="popup-kb-conversation" id="popup-kb-conversation">
      ${messagesHTML}
      ${loadingHTML}
      ${errorHTML}
    </div>
    <div class="section popup-kb-input-section">
      <div class="popup-kb-input-row">
        <input type="text" id="popup-kb-input" class="popup-textarea popup-kb-input" placeholder="Ask a follow-up..." style="min-height: auto; resize: none;" ${isLoading ? 'disabled' : ''}>
        <button class="popup-kb-ask-btn" id="popup-kb-ask-btn" ${isLoading ? 'disabled' : ''}>Ask</button>
      </div>
      <div class="popup-kb-actions-row">
        <button class="popup-kb-new-btn" id="popup-kb-new-btn">New conversation</button>
      </div>
    </div>
  `);

  const convoEl = document.getElementById('popup-kb-conversation');
  if (convoEl) convoEl.scrollTop = convoEl.scrollHeight;

  const input = document.getElementById('popup-kb-input');
  const askBtn = document.getElementById('popup-kb-ask-btn');
  const newBtn = document.getElementById('popup-kb-new-btn');

  if (!isLoading) {
    askBtn.addEventListener('click', () => {
      const q = input.value.trim();
      if (q) handlePopupKBQuestion(q);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = input.value.trim();
        if (q) handlePopupKBQuestion(q);
      }
    });

    input.focus();
  }

  newBtn.addEventListener('click', () => {
    popupKBConversation = [];
    popupKBConversationId = null;
    renderPopupKBEmpty();
  });
}

function renderPopupKBMarkup(text) {
  if (!text) return '';
  const escaped = escapeHTML(text);
  const lines = escaped.split(/\r?\n/);
  const parts = [];
  let inList = false;
  let listType = null;

  const closeList = () => {
    if (!inList) return;
    parts.push(listType === 'ul' ? '</ul>' : '</ol>');
    inList = false;
    listType = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { closeList(); continue; }
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (bulletMatch) {
      if (!inList || listType !== 'ul') { closeList(); parts.push('<ul>'); inList = true; listType = 'ul'; }
      parts.push(`<li>${bulletMatch[1]}</li>`);
      continue;
    }
    if (orderedMatch) {
      if (!inList || listType !== 'ol') { closeList(); parts.push('<ol>'); inList = true; listType = 'ol'; }
      parts.push(`<li>${orderedMatch[1]}</li>`);
      continue;
    }
    closeList();
    parts.push(`<p>${trimmed}</p>`);
  }

  closeList();
  return parts.join('')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

// ========== Cleanup on popup close ==========
window.addEventListener('unload', () => {
  if (popupLoadingMessageTimer) {
    clearInterval(popupLoadingMessageTimer);
    popupLoadingMessageTimer = null;
  }
  if (selectionPollTimer) {
    clearInterval(selectionPollTimer);
    selectionPollTimer = null;
  }
});

// ========== Init ==========
async function initPopup() {
  currentContext = await detectContext();
  renderForContext(currentContext);
}

initPopup();
