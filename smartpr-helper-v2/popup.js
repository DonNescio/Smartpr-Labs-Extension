// Popup script - Simplified popup for Smart.pr Assistant

const extensionToggle = document.getElementById('toggle-extension');
const extensionStatus = document.getElementById('extension-status');
const emailDisplay = document.getElementById('email-display');
const popupFeedbackArea = document.getElementById('popup-feedback-area');

const EXTENSION_DISABLED_KEY = 'smartpr_helper_disabled';
const EMAIL_KEY = 'smartpr_user_email';
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ========== Toggle ==========
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

// ========== Email ==========
let savedEmail = '';

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderEmailDisplay() {
  if (savedEmail) {
    emailDisplay.innerHTML = `
      <div class="email-row">
        <span class="email-value">${escapeHTML(savedEmail)}</span>
        <button class="email-edit-btn" id="email-edit-btn">Edit</button>
      </div>
    `;
    document.getElementById('email-edit-btn').addEventListener('click', renderEmailForm);
  } else {
    emailDisplay.innerHTML = `
      <div class="email-row">
        <span class="email-value empty">No email set</span>
        <button class="email-edit-btn" id="email-edit-btn">Set up</button>
      </div>
    `;
    document.getElementById('email-edit-btn').addEventListener('click', renderEmailForm);
  }
}

function renderEmailForm() {
  emailDisplay.innerHTML = `
    <div class="email-form">
      <input type="email" class="email-input" id="email-input" placeholder="you@company.com" value="${escapeHTML(savedEmail)}">
      <button class="email-save-btn" id="email-save-btn">Save</button>
      ${savedEmail ? '<button class="email-cancel-btn" id="email-cancel-btn">Cancel</button>' : ''}
    </div>
    <div id="email-message"></div>
  `;

  const input = document.getElementById('email-input');
  const saveBtn = document.getElementById('email-save-btn');
  const cancelBtn = document.getElementById('email-cancel-btn');
  const messageEl = document.getElementById('email-message');

  input.focus();
  input.select();

  saveBtn.addEventListener('click', () => saveEmail(input, messageEl));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveEmail(input, messageEl);
    if (e.key === 'Escape' && savedEmail) renderEmailDisplay();
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', renderEmailDisplay);
  }
}

async function saveEmail(input, messageEl) {
  const email = input.value.trim();

  if (!email) {
    messageEl.innerHTML = '<div class="email-error">Please enter an email address</div>';
    return;
  }

  if (!emailRegex.test(email)) {
    messageEl.innerHTML = '<div class="email-error">Please enter a valid email address</div>';
    return;
  }

  try {
    await chrome.storage.sync.set({ [EMAIL_KEY]: email });
    savedEmail = email;
    renderEmailDisplay();
    // Brief success flash
    const row = emailDisplay.querySelector('.email-row');
    if (row) {
      row.style.borderColor = 'rgba(52,211,153,0.5)';
      row.style.background = 'linear-gradient(135deg, rgba(134,239,172,0.12), rgba(52,211,153,0.12))';
      setTimeout(() => {
        row.style.borderColor = '';
        row.style.background = '';
      }, 1500);
    }
  } catch (error) {
    messageEl.innerHTML = '<div class="email-error">Failed to save. Please try again.</div>';
  }
}

chrome.storage.sync.get([EMAIL_KEY], (result) => {
  savedEmail = result[EMAIL_KEY] || '';
  renderEmailDisplay();
});

// ========== Feedback ==========
function initPopupFeedback() {
  const btn = document.getElementById('popup-feedback-btn');
  if (btn) {
    btn.addEventListener('click', showPopupFeedbackForm);
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

  document.getElementById('popup-feedback-cancel').addEventListener('click', resetPopupFeedback);

  document.getElementById('popup-feedback-send').addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;

    const sendBtn = document.getElementById('popup-feedback-send');
    sendBtn.textContent = 'Sending...';
    sendBtn.disabled = true;

    try {
      await window.SmartPRAPI.submitFeedback(text);
      resetPopupFeedback();
      popupFeedbackArea.innerHTML = '<span style="font-size: 11px; color: #059669; font-weight: 600;">\u2713 Feedback sent!</span>';
      setTimeout(resetPopupFeedback, 2000);
    } catch (error) {
      sendBtn.textContent = 'Send';
      sendBtn.disabled = false;
      console.error('[Popup] Feedback error:', error);
    }
  });
}

function resetPopupFeedback() {
  popupFeedbackArea.innerHTML = '';
}

initPopupFeedback();
