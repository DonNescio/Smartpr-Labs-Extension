/* Smart.pr Helper - Content Script */

// ========== Utilities ==========
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Note: storage is defined in api-client.js which loads first
// We can use the storage object from api-client.js

// ========== State ==========
let floatingIcon = null;
let sidebar = null;
let currentNudge = null;
let subjectField = null;
let subjectFieldObserver = null;
let lastSubjectValue = '';
let userEmail = '';

// ========== Subject Field Detection ==========
function findSubjectField() {
  const selectors = [
    'input[placeholder="Please type your subject"]',
    'input[name="subject"]',
    'input[aria-label="Subject"]',
    'input[placeholder*="subject" i]',
    'input[placeholder*="onderwerp" i]'
  ];

  for (const selector of selectors) {
    const field = $(selector);
    if (field) return field;
  }

  return null;
}

function watchSubjectField() {
  subjectField = findSubjectField();

  if (!subjectField) {
    setTimeout(watchSubjectField, 1000);
    return;
  }

  console.log('[Smart.pr Helper] Subject field found');

  // Watch for focus
  subjectField.addEventListener('focus', handleSubjectFocus);

  // Watch for value changes
  subjectField.addEventListener('input', handleSubjectInput);

  // Initial check
  lastSubjectValue = subjectField.value;
}

function handleSubjectFocus() {
  const currentValue = subjectField.value.trim();

  // Don't show nudge if sidebar is already open
  if (sidebar && sidebar.classList.contains('open')) {
    return;
  }

  // Show appropriate nudge based on whether field is empty
  if (currentValue === '') {
    showNudge('Need help writing a subject line?', 'empty');
  } else {
    showNudge('Want feedback on your subject line?', 'filled');
  }
}

function handleSubjectInput() {
  const newValue = subjectField.value;

  // If value changed significantly, hide any existing nudge
  if (Math.abs(newValue.length - lastSubjectValue.length) > 5) {
    hideNudge();
  }

  lastSubjectValue = newValue;
}

// ========== Nudge System ==========
function showNudge(message, type) {
  // Don't show if already showing
  if (currentNudge) return;

  // Calculate position relative to subject field
  const rect = subjectField.getBoundingClientRect();

  currentNudge = document.createElement('div');
  currentNudge.className = 'sph-nudge';
  currentNudge.dataset.type = type;
  currentNudge.style.top = `${rect.bottom + window.scrollY + 12}px`;
  currentNudge.style.left = `${rect.left + window.scrollX}px`;

  currentNudge.innerHTML = `
    <span class="sph-nudge-icon">✨</span>
    <span class="sph-nudge-text">${message}</span>
    <button class="sph-nudge-close">×</button>
  `;

  document.body.appendChild(currentNudge);

  // Click to open sidebar
  currentNudge.addEventListener('click', (e) => {
    if (!e.target.classList.contains('sph-nudge-close')) {
      openSidebar(type);
      hideNudge();
    }
  });

  // Close button
  const closeBtn = currentNudge.querySelector('.sph-nudge-close');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    hideNudge();
  });

  // Auto-hide after 8 seconds
  setTimeout(() => {
    if (currentNudge) {
      hideNudge();
    }
  }, 8000);
}

function hideNudge() {
  if (currentNudge) {
    currentNudge.remove();
    currentNudge = null;
  }
}

// ========== Floating Icon ==========
function createFloatingIcon() {
  floatingIcon = document.createElement('div');
  floatingIcon.id = 'smartpr-helper-icon';

  const logoUrl = chrome.runtime.getURL('logo-white.png');

  floatingIcon.innerHTML = `
    <div class="sph-icon-inner">
      <img src="${logoUrl}" alt="Smart.pr Helper" class="sph-icon-logo" />
    </div>
    <div class="sph-icon-badge"></div>
  `;

  document.body.appendChild(floatingIcon);

  // Click to toggle sidebar
  floatingIcon.addEventListener('click', () => {
    if (sidebar && sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebarFromIcon();
    }
  });

  return floatingIcon;
}

function updateFloatingIcon(isOpen) {
  if (!floatingIcon) return;

  if (isOpen) {
    floatingIcon.classList.add('sidebar-open');
  } else {
    floatingIcon.classList.remove('sidebar-open');
  }
}

function showIconBadge() {
  if (!floatingIcon) return;
  const badge = floatingIcon.querySelector('.sph-icon-badge');
  if (badge) {
    badge.classList.add('show');
  }
}

function hideIconBadge() {
  if (!floatingIcon) return;
  const badge = floatingIcon.querySelector('.sph-icon-badge');
  if (badge) {
    badge.classList.remove('show');
  }
}

// ========== Sidebar ==========
function createSidebar() {
  sidebar = document.createElement('div');
  sidebar.id = 'smartpr-helper-sidebar';
  sidebar.innerHTML = `
    <div class="sph-header">
      <h2 class="sph-title">Subject Line Helper</h2>
      <button class="sph-close">×</button>
    </div>
    <div class="sph-content" id="sph-content">
      <!-- Content will be dynamically inserted -->
    </div>
  `;

  document.body.appendChild(sidebar);

  // Close button
  const closeBtn = sidebar.querySelector('.sph-close');
  closeBtn.addEventListener('click', closeSidebar);

  return sidebar;
}

function openSidebar(type) {
  if (!sidebar) {
    createSidebar();
  }

  sidebar.classList.add('open');
  updateFloatingIcon(true);
  hideIconBadge();

  // Update content based on type
  const currentValue = subjectField ? subjectField.value.trim() : '';

  if (type === 'empty' || currentValue === '') {
    showEmptyState();
  } else {
    showFilledState(currentValue);
  }
}

function openSidebarFromIcon() {
  // When opened from floating icon (not from nudge), detect context
  const currentValue = subjectField ? subjectField.value.trim() : '';

  if (currentValue === '') {
    openSidebar('empty');
  } else {
    openSidebar('filled');
  }
}

function closeSidebar() {
  if (sidebar) {
    sidebar.classList.remove('open');
    updateFloatingIcon(false);
  }
}

function showEmptyState() {
  const content = $('#sph-content');
  content.innerHTML = `
    <div class="sph-section">
      <p class="sph-description">
        Tell me about your press release and I'll generate compelling subject lines for you.
      </p>
      <span class="sph-label">Describe Your Press Release</span>
      <textarea
        id="pr-description-input"
        class="sph-textarea"
        placeholder="e.g., We're launching a new AI-powered analytics platform that helps companies reduce costs by 40%..."
        rows="4"
      ></textarea>
      <button class="sph-button" id="generate-subject-btn">
        Generate Subject Lines
      </button>
    </div>
    <div class="sph-empty">
      <div class="sph-empty-icon">✨</div>
      <div class="sph-empty-text">
        The more details you provide, the better the suggestions!
      </div>
    </div>
  `;

  const btn = $('#generate-subject-btn');
  const textarea = $('#pr-description-input');

  btn.addEventListener('click', () => {
    const description = textarea.value.trim();
    generateSubjectSuggestions('', description);
  });

  // Also trigger on Enter+Cmd/Ctrl
  textarea.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      btn.click();
    }
  });
}

function showFilledState(currentSubject) {
  const content = $('#sph-content');
  content.innerHTML = `
    <div class="sph-section">
      <span class="sph-label">Current Subject</span>
      <div class="sph-current-subject">${escapeHTML(currentSubject)}</div>
    </div>
    <div class="sph-section">
      <button class="sph-button" id="get-feedback-btn">
        Get Feedback
      </button>
      <button class="sph-button sph-button-secondary" id="generate-alternatives-btn">
        Generate Alternatives
      </button>
    </div>
  `;

  const feedbackBtn = $('#get-feedback-btn');
  feedbackBtn.addEventListener('click', () => getFeedback(currentSubject));

  const altBtn = $('#generate-alternatives-btn');
  altBtn.addEventListener('click', () => generateSubjectSuggestions(currentSubject));
}

function showLoadingState(message = 'Generating suggestions...') {
  const content = $('#sph-content');
  content.innerHTML = `
    <div class="sph-loading">
      <div class="sph-spinner"></div>
      <div class="sph-loading-text">${message}</div>
    </div>
  `;
}

function showError(message) {
  const content = $('#sph-content');
  const existingContent = content.innerHTML;

  const errorHTML = `
    <div class="sph-error">
      <div class="sph-error-text">${escapeHTML(message)}</div>
    </div>
  `;

  // Prepend error to existing content
  content.innerHTML = errorHTML + existingContent.replace(/<div class="sph-error">[\s\S]*?<\/div>/, '');
}

function showSuggestions(suggestions, originalSubject = null) {
  const content = $('#sph-content');

  let html = '';

  if (originalSubject) {
    html += `
      <div class="sph-section">
        <span class="sph-label">Original Subject</span>
        <div class="sph-current-subject">${escapeHTML(originalSubject)}</div>
      </div>
    `;
  }

  html += `
    <div class="sph-section">
      <span class="sph-label">Suggested Subject Lines</span>
      <div class="sph-suggestions">
        ${suggestions.map((suggestion, i) => `
          <div class="sph-suggestion-item">
            <div class="sph-suggestion-text">${escapeHTML(suggestion)}</div>
            <button class="sph-copy-button" data-text="${escapeHTML(suggestion)}">
              Copy
            </button>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="sph-section">
      <button class="sph-button sph-button-secondary" id="generate-more-btn">
        Generate More
      </button>
    </div>
  `;

  content.innerHTML = html;

  // Add copy button handlers
  $$('.sph-copy-button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.text;
      await copyToClipboard(text);

      // Visual feedback
      const originalText = btn.textContent;
      btn.textContent = '✓ Copied';
      btn.classList.add('copied');

      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('copied');
      }, 2000);
    });
  });

  // Generate more button
  const generateMoreBtn = $('#generate-more-btn');
  if (generateMoreBtn) {
    generateMoreBtn.addEventListener('click', () => {
      const current = originalSubject || (subjectField ? subjectField.value.trim() : '');
      generateSubjectSuggestions(current);
    });
  }
}

// ========== API Client Integration ==========
// Note: API client is loaded via api-client.js and available as window.SmartPRAPI

async function getUserEmail() {
  if (userEmail) return userEmail;

  userEmail = await storage.get('smartpr_user_email', '');

  if (!userEmail) {
    throw {
      code: 'INVALID_EMAIL',
      message: 'Please enter your email address in the extension settings.'
    };
  }

  return userEmail;
}

// ========== Subject Line Generation ==========
const SUBJECT_GENERATION_PROMPT = `You are an award-winning PR subject line strategist helping a Smart.pr user craft compelling email subject lines.

Your task: Generate 3 to 5 compelling subject line alternatives that maximize opens without sounding spammy.

Rules:
1. Detect the dominant language (Dutch or English) from the context and write subjects in that language
2. Keep each subject <= 70 characters and make them factual
3. Avoid ALL CAPS, excessive punctuation, emoji, or clickbait
4. Highlight the strongest news hook or benefit
5. Make each suggestion distinct with different angles or approaches

Return ONLY valid JSON in this exact format:
{"subjects": ["subject 1", "subject 2", "subject 3"]}

No additional text or explanation.`;

async function generateSubjectSuggestions(currentSubject = '', prDescription = '') {
  try {
    showLoadingState('Generating subject line suggestions...');

    let userPrompt = '';

    if (currentSubject) {
      // Improving an existing subject
      userPrompt = `Generate improved alternatives for this subject line:\n\n"${currentSubject}"\n\nProvide 3-5 alternatives that are more compelling.`;
    } else if (prDescription) {
      // Generating from description
      userPrompt = `Generate 3-5 compelling subject lines for a press release about:\n\n${prDescription}\n\nMake them professional, newsworthy, and engaging.`;
    } else {
      // Generic generation (fallback)
      userPrompt = `Generate 3-5 compelling subject lines for a press release email. Make them professional, newsworthy, and engaging.`;
    }

    // Call proxy API via API client
    const result = await window.SmartPRAPI.generateSubjectLines(userPrompt, {
      currentSubject: currentSubject || undefined,
      language: 'auto' // Let AI detect language
    });

    showSuggestions(result.subjects, currentSubject);
    showToast('✨ Suggestions generated!');

  } catch (error) {
    console.error('[Smart.pr Helper] Error generating suggestions:', error);

    // Get user-friendly error message
    const errorMessage = window.SmartPRAPI.getErrorMessage(error);
    showError(errorMessage);

    // Add button to open settings if email not configured
    if (error.code === 'INVALID_EMAIL' || error.code === 'USER_NOT_AUTHORIZED') {
      const content = $('#sph-content');
      const btn = document.createElement('button');
      btn.className = 'sph-button';
      btn.textContent = 'Open Settings';
      btn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
      content.appendChild(btn);
    } else {
      // Add retry button for other errors
      const currentValue = subjectField ? subjectField.value.trim() : '';
      setTimeout(() => {
        const existing = $('#sph-content').innerHTML;
        $('#sph-content').innerHTML = existing + `
          <div class="sph-section">
            <button class="sph-button sph-button-secondary" id="retry-btn">
              Try Again
            </button>
          </div>
        `;
        const retryBtn = $('#retry-btn');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => generateSubjectSuggestions(currentValue, prDescription));
        }
      }, 100);
    }
  }
}

// ========== Feedback ==========
const SUBJECT_FEEDBACK_PROMPT = `You are a PR and email marketing expert. Analyze the given subject line and provide constructive feedback.

Focus on:
- Clarity and impact
- Length (ideal is 40-60 characters)
- Presence of news hook or value proposition
- Language effectiveness
- Potential improvements

Keep your feedback concise (2-4 short bullet points) and actionable. Detect the language of the subject line and respond in that same language.

Format as plain text with bullet points.`;

async function getFeedback(subject) {
  try {
    showLoadingState('Analyzing your subject line...');

    // Call proxy API via API client
    const result = await window.SmartPRAPI.getSubjectFeedback(subject);

    // Display feedback
    const content = $('#sph-content');
    content.innerHTML = `
      <div class="sph-section">
        <span class="sph-label">Your Subject</span>
        <div class="sph-current-subject">${escapeHTML(subject)}</div>
      </div>
      <div class="sph-section">
        <span class="sph-label">Feedback</span>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #374151; white-space: pre-wrap;">${escapeHTML(result.feedback)}</div>
      </div>
      <div class="sph-section">
        <button class="sph-button" id="generate-alternatives-btn">
          Generate Better Alternatives
        </button>
      </div>
    `;

    $('#generate-alternatives-btn').addEventListener('click', () => {
      generateSubjectSuggestions(subject);
    });

    showToast('✓ Feedback ready!');

  } catch (error) {
    console.error('[Smart.pr Helper] Error getting feedback:', error);

    // Get user-friendly error message
    const errorMessage = window.SmartPRAPI.getErrorMessage(error);
    showError(errorMessage);

    // Add button to open settings if email not configured
    if (error.code === 'INVALID_EMAIL' || error.code === 'USER_NOT_AUTHORIZED') {
      const content = $('#sph-content');
      const btn = document.createElement('button');
      btn.className = 'sph-button';
      btn.textContent = 'Open Settings';
      btn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
      });
      content.appendChild(btn);
    }
  }
}

// ========== Helper Functions ==========
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('✓ Copied to clipboard');
  } catch (error) {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    showToast('✓ Copied to clipboard');
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'sph-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
}

// ========== Initialization ==========
function init() {
  console.log('[Smart.pr Helper] Initializing...');

  // Create floating icon immediately
  createFloatingIcon();

  // Watch for subject field
  watchSubjectField();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
