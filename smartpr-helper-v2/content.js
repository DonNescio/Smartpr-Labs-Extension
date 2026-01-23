/* Smart.pr Helper - Content Script */

// ========== Utilities ==========
// Get the top-level document (sidebar lives there, not in iframes)
const getTopDocument = () => {
  try {
    return window.top.document;
  } catch (e) {
    // Cross-origin, fall back to current document
    return document;
  }
};

const $ = (sel, root = null) => (root || getTopDocument()).querySelector(sel);
const $$ = (sel, root = null) => Array.from((root || getTopDocument()).querySelectorAll(sel));

// Note: storage is defined in api-client.js which loads first
// We can use the storage object from api-client.js

const EXTENSION_DISABLED_KEY = 'smartpr_helper_disabled';

// ========== State ==========
let floatingIcon = null;
let sidebar = null;
let currentNudge = null;
let subjectField = null;
let subjectFieldObserver = null;
let lastSubjectValue = '';
let userEmail = '';
let extensionDisabled = false;
let subjectListenersAttached = false;
let subjectWatchTimer = null;

// Paragraph Coach state
let currentSelection = null;
let selectedText = '';
let selectedEditor = null;
let selectedEditorDoc = null; // The document the editor lives in (for iframe support)
let currentSidebarMode = 'subject'; // 'subject' or 'paragraph'
let paragraphIconsAdded = new WeakSet();
let editorObserver = null;
let scanThrottleTimer = null;
let selectionUpdateTimer = null;
let subjectFieldUpdateTimer = null;

// ========== Paragraph Coach - Classic Editor Detection ==========
// Find Quill editors and their parent containers

function findQuillEditors() {
  // Find all Quill editor elements - try multiple selectors
  let editors = $$('.ql-editor[contenteditable="true"]');

  // Fallback: try without the attribute selector
  if (editors.length === 0) {
    editors = $$('.ql-editor[contenteditable]');
  }

  // Another fallback: any ql-editor
  if (editors.length === 0) {
    editors = $$('.ql-editor');
  }

  // Filter out clipboard elements (they also have ql-editor class sometimes)
  editors = editors.filter(el => !el.classList.contains('ql-clipboard'));

  return editors;
}

// Search for editors inside nested iframes (for about:blank iframes)
function findEditorsInNestedIframes() {
  const allEditors = [];

  // Find all iframes in current document
  const iframes = $$('iframe');

  for (const iframe of iframes) {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) continue;

      // Search for editors in this iframe
      let editors = Array.from(iframeDoc.querySelectorAll('.ql-editor[contenteditable="true"]'));
      if (editors.length === 0) {
        editors = Array.from(iframeDoc.querySelectorAll('.ql-editor'));
      }
      editors = editors.filter(el => !el.classList.contains('ql-clipboard'));

      if (editors.length > 0) {
        allEditors.push(...editors.map(editor => ({ editor, iframeDoc, iframe })));
      }

      // Also check for iframes inside this iframe (deeper nesting)
      const nestedIframes = Array.from(iframeDoc.querySelectorAll('iframe'));
      for (const nestedIframe of nestedIframes) {
        try {
          const nestedDoc = nestedIframe.contentDocument || nestedIframe.contentWindow?.document;
          if (!nestedDoc) continue;

          let nestedEditors = Array.from(nestedDoc.querySelectorAll('.ql-editor[contenteditable="true"]'));
          if (nestedEditors.length === 0) {
            nestedEditors = Array.from(nestedDoc.querySelectorAll('.ql-editor'));
          }
          nestedEditors = nestedEditors.filter(el => !el.classList.contains('ql-clipboard'));

          if (nestedEditors.length > 0) {
            allEditors.push(...nestedEditors.map(editor => ({ editor, iframeDoc: nestedDoc, iframe: nestedIframe })));
          }
        } catch (e) {
          // Cross-origin iframe, skip
        }
      }
    } catch (e) {
      // Cross-origin iframe, skip
    }
  }

  return allEditors;
}

function getEditorContainer(editor) {
  // Walk up to find a container with data-is attribute or preview-container
  let node = editor.parentElement;
  while (node && node !== document.body) {
    if (node.hasAttribute('data-is') || node.tagName.toLowerCase() === 'preview-container') {
      return node;
    }
    // Also check for .ql-container's parent
    if (node.classList.contains('ql-container')) {
      const parent = node.parentElement;
      if (parent && (parent.hasAttribute('data-is') || parent.tagName.toLowerCase() === 'preview-container')) {
        return parent;
      }
    }
    node = node.parentElement;
  }
  // Fallback: return the ql-container or editor's direct parent
  return editor.closest('.ql-container')?.parentElement || editor.parentElement;
}

function getBlockType(container) {
  if (!container) return 'text';
  const dataIs = container.getAttribute?.('data-is');
  if (dataIs === 'preview-line') {
    const editor = container.querySelector('.ql-editor');
    if (editor) {
      if (editor.querySelector('h1')) return 'heading';
      if (editor.querySelector('h2')) return 'subheading';
    }
    return 'heading';
  }
  if (dataIs === 'preview-richtext') {
    return 'paragraph';
  }
  return 'text';
}

function addParagraphIcon(editor, iframeDoc = null) {
  if (paragraphIconsAdded.has(editor)) return;

  // Get or create a container for positioning
  const container = getEditorContainer(editor);
  if (!container) return;

  // Determine which document to use for creating elements
  const doc = iframeDoc || editor.ownerDocument || document;

  // Create a wrapper that will hold the container and icon side by side
  const wrapper = doc.createElement('div');
  wrapper.className = 'sph-block-wrapper';

  // Create the icon button
  const iconBtn = doc.createElement('button');
  iconBtn.className = 'sph-block-icon';
  iconBtn.innerHTML = '✨';
  iconBtn.title = 'Improve with AI';

  // Insert wrapper before container, then move container inside wrapper
  container.parentNode.insertBefore(wrapper, container);
  wrapper.appendChild(container);
  wrapper.appendChild(iconBtn);

  // Inject styles if in iframe and not already injected
  if (iframeDoc && !iframeDoc.getElementById('sph-injected-styles')) {
    injectStylesIntoIframe(iframeDoc);
  }

  paragraphIconsAdded.add(editor);


  // Click handler
  iconBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Get selected text or full content - use the iframe's window for selection if applicable
    const win = iframeDoc ? iframeDoc.defaultView : window;
    const selection = win?.getSelection();
    let text = '';

    if (selection && !selection.isCollapsed && editor.contains(selection.anchorNode)) {
      text = selection.toString().trim();
      currentSelection = selection.getRangeAt(0).cloneRange();
    } else {
      // Use full editor content
      text = editor.innerText.trim();
      currentSelection = null;
    }

    if (!text) {
      console.log('[Smart.pr Helper] No text to improve');
      return;
    }

    selectedText = text;
    selectedEditor = editor;
    selectedEditorDoc = iframeDoc; // Store the document context for later

    openParagraphCoachSidebar();
  });
}

// Inject minimal styles into iframe for the icon
function injectStylesIntoIframe(iframeDoc) {
  const style = iframeDoc.createElement('style');
  style.id = 'sph-injected-styles';
  style.textContent = `
    .sph-block-wrapper {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      position: relative;
    }
    .sph-block-wrapper > *:first-child {
      flex: 1;
      min-width: 0;
    }
    .sph-block-icon {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, #FFD580 0%, #FFBC7F 50%, #E8B5E8 100%);
      color: white;
      font-size: 16px;
      cursor: pointer;
      opacity: 0;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(212, 165, 245, 0.3);
      margin-top: 4px;
    }
    .sph-block-icon:hover {
      transform: scale(1.1);
      opacity: 1 !important;
      box-shadow: 0 4px 12px rgba(212, 165, 245, 0.5);
    }
    .sph-block-wrapper:hover .sph-block-icon,
    .sph-block-icon:focus {
      opacity: 1;
    }
  `;
  iframeDoc.head.appendChild(style);
}

function scanAndAddIcons() {
  // Scan editors in current document
  const editors = findQuillEditors();
  editors.forEach(editor => addParagraphIcon(editor, null));

  // Also scan editors in nested iframes (for about:blank iframes)
  const nestedEditors = findEditorsInNestedIframes();
  nestedEditors.forEach(({ editor, iframeDoc }) => addParagraphIcon(editor, iframeDoc));

  return editors.length + nestedEditors.length;
}

function initParagraphCoach() {
  if (extensionDisabled) return;


  // Function to scan and report
  const doScan = () => {
    // Scan editors in current document
    const editors = findQuillEditors();
    editors.forEach(editor => addParagraphIcon(editor, null));

    // Also scan editors in nested iframes (for about:blank iframes)
    const nestedEditors = findEditorsInNestedIframes();
    nestedEditors.forEach(({ editor, iframeDoc }) => addParagraphIcon(editor, iframeDoc));

    return editors.length + nestedEditors.length;
  };

  // Initial scan
  let found = doScan();

  // Retry with longer delays (editors may load very late, especially in iframes)
  const retryDelays = [500, 1000, 2000, 3000, 5000, 8000, 12000];
  retryDelays.forEach((delay) => {
    setTimeout(() => {
      const count = doScan();
      if (count > 0 && found === 0) {
        found = count;
      }
    }, delay);
  });

  // Watch for new blocks being added (including iframes loading)
  // Throttle to avoid excessive scanning
  if (!editorObserver) {
    editorObserver = new MutationObserver(() => {
      if (scanThrottleTimer) return;
      scanThrottleTimer = setTimeout(() => {
        scanThrottleTimer = null;
        doScan();
      }, 500);
    });

    editorObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

}

function teardownParagraphCoach() {
  // Remove all icons
  $$('.sph-block-icon').forEach(icon => icon.remove());
  paragraphIconsAdded = new WeakSet();

  if (editorObserver) {
    editorObserver.disconnect();
    editorObserver = null;
  }
}

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
  if (extensionDisabled) return;
  subjectField = findSubjectField();

  if (!subjectField) {
    subjectWatchTimer = setTimeout(watchSubjectField, 1000);
    return;
  }

  console.log('[Smart.pr Helper] Subject field found');

  // Watch for focus
  if (!subjectListenersAttached) {
    subjectField.addEventListener('focus', handleSubjectFocus);

    // Watch for value changes
    subjectField.addEventListener('input', handleSubjectInput);
    subjectListenersAttached = true;
  }

  // Initial check
  lastSubjectValue = subjectField.value;
}

function handleSubjectFocus() {
  if (extensionDisabled) return;
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
  if (extensionDisabled) return;
  const newValue = subjectField.value;

  // If value changed significantly, hide any existing nudge
  if (Math.abs(newValue.length - lastSubjectValue.length) > 5) {
    hideNudge();
  }

  lastSubjectValue = newValue;
}

// ========== Nudge System ==========
function showNudge(message, type) {
  if (extensionDisabled) return;
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
  if (extensionDisabled) return null;
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
  const topDoc = getTopDocument();
  sidebar = topDoc.createElement('div');
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

  topDoc.body.appendChild(sidebar);

  // Close button
  const closeBtn = sidebar.querySelector('.sph-close');
  closeBtn.addEventListener('click', closeSidebar);

  return sidebar;
}

function openSidebar(type) {
  if (extensionDisabled) return;
  if (!sidebar) {
    createSidebar();
  }

  currentSidebarMode = 'subject';

  // Update sidebar title for subject line mode
  const title = sidebar.querySelector('.sph-title');
  if (title) {
    title.textContent = 'Subject Line Coach';
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

  // Start listening for subject field changes
  startSubjectFieldTracking();
}

function openSidebarFromIcon() {
  if (extensionDisabled) return;
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
  stopSelectionTracking();
  stopSubjectFieldTracking();
}

// ========== Paragraph Coach Sidebar ==========
function openParagraphCoachSidebar() {
  if (extensionDisabled) return;
  if (!sidebar) {
    createSidebar();
  }

  currentSidebarMode = 'paragraph';

  // Update sidebar title
  const title = sidebar.querySelector('.sph-title');
  if (title) {
    title.textContent = 'Paragraph Coach';
  }

  sidebar.classList.add('open');
  updateFloatingIcon(true);
  hideIconBadge();

  // Show paragraph coach content
  showParagraphCoachContent();

  // Start listening for selection changes in the editor
  startSelectionTracking();
}

function startSelectionTracking() {
  stopSelectionTracking(); // Clear any existing listeners

  if (!selectedEditor) return;

  const editorDoc = selectedEditorDoc || selectedEditor.ownerDocument || document;

  const handleSelectionChange = () => {
    // Debounce updates
    if (selectionUpdateTimer) clearTimeout(selectionUpdateTimer);
    selectionUpdateTimer = setTimeout(() => {
      updateSelectedTextFromEditor();
    }, 150);
  };

  // Listen for selection changes
  editorDoc.addEventListener('selectionchange', handleSelectionChange);

  // Store cleanup function
  editorDoc._sphSelectionHandler = handleSelectionChange;
}

function stopSelectionTracking() {
  if (selectionUpdateTimer) {
    clearTimeout(selectionUpdateTimer);
    selectionUpdateTimer = null;
  }

  // Clean up listener from stored editor doc
  if (selectedEditorDoc && selectedEditorDoc._sphSelectionHandler) {
    selectedEditorDoc.removeEventListener('selectionchange', selectedEditorDoc._sphSelectionHandler);
    delete selectedEditorDoc._sphSelectionHandler;
  }
}

function updateSelectedTextFromEditor() {
  if (!selectedEditor || currentSidebarMode !== 'paragraph') return;

  const editorDoc = selectedEditorDoc || selectedEditor.ownerDocument || document;
  const editorWin = editorDoc.defaultView || window;
  const selection = editorWin?.getSelection();

  let newText = '';

  if (selection && !selection.isCollapsed && selectedEditor.contains(selection.anchorNode)) {
    newText = selection.toString().trim();
    currentSelection = selection.getRangeAt(0).cloneRange();
  } else {
    // Use full editor content if no selection
    newText = selectedEditor.innerText.trim();
    currentSelection = null;
  }

  // Only update if text changed
  if (newText && newText !== selectedText) {
    selectedText = newText;
    updateSelectedTextDisplay();
  }
}

function updateSelectedTextDisplay() {
  // Only update if we're on the main paragraph coach view (not translate options or results)
  const selectedTextDisplay = $('#sph-content .sph-current-subject');
  if (!selectedTextDisplay) return;

  // Check if we're in the main action view (has action buttons)
  const actionButtons = $('#sph-content .sph-action-buttons');
  if (!actionButtons) return;

  const displayText = selectedText.length > 200
    ? selectedText.substring(0, 200) + '...'
    : selectedText;

  selectedTextDisplay.innerHTML = escapeHTML(displayText);
}

// ========== Subject Field Live Tracking ==========
function startSubjectFieldTracking() {
  stopSubjectFieldTracking(); // Clear any existing

  if (!subjectField) return;

  const handleSubjectChange = () => {
    if (subjectFieldUpdateTimer) clearTimeout(subjectFieldUpdateTimer);
    subjectFieldUpdateTimer = setTimeout(() => {
      updateSubjectFieldDisplay();
    }, 150);
  };

  subjectField.addEventListener('input', handleSubjectChange);
  subjectField._sphChangeHandler = handleSubjectChange;
}

function stopSubjectFieldTracking() {
  if (subjectFieldUpdateTimer) {
    clearTimeout(subjectFieldUpdateTimer);
    subjectFieldUpdateTimer = null;
  }

  if (subjectField && subjectField._sphChangeHandler) {
    subjectField.removeEventListener('input', subjectField._sphChangeHandler);
    delete subjectField._sphChangeHandler;
  }
}

function updateSubjectFieldDisplay() {
  if (currentSidebarMode !== 'subject') return;

  const currentValue = subjectField ? subjectField.value.trim() : '';
  const subjectDisplay = $('#sph-content .sph-current-subject');

  // Check if we're in the filled state view (has feedback/alternatives buttons)
  const feedbackBtn = $('#get-feedback-btn');
  const altBtn = $('#generate-alternatives-btn');

  if (subjectDisplay && (feedbackBtn || altBtn)) {
    // Update the display text
    subjectDisplay.innerHTML = escapeHTML(currentValue || '(empty)');

    // Update button handlers to use new value
    if (feedbackBtn) {
      const newFeedbackBtn = feedbackBtn.cloneNode(true);
      feedbackBtn.parentNode.replaceChild(newFeedbackBtn, feedbackBtn);
      newFeedbackBtn.addEventListener('click', () => getFeedback(currentValue));
    }

    if (altBtn) {
      const newAltBtn = altBtn.cloneNode(true);
      altBtn.parentNode.replaceChild(newAltBtn, altBtn);
      newAltBtn.addEventListener('click', () => generateSubjectSuggestions(currentValue));
    }
  }
}

function showParagraphCoachContent() {
  if (extensionDisabled) return;
  const content = $('#sph-content');

  // Get block type from the editor's container
  const container = selectedEditor ? selectedEditor.closest('preview-container') : null;
  const blockType = container ? getBlockType(container) : 'text';
  const typeLabel = blockType === 'heading' ? 'Heading' : blockType === 'subheading' ? 'Subheading' : 'Text';

  // Truncate long text for display
  const displayText = selectedText.length > 200
    ? selectedText.substring(0, 200) + '...'
    : selectedText;

  content.innerHTML = `
    <div class="sph-section">
      <span class="sph-label">Selected ${typeLabel}</span>
      <div class="sph-current-subject">${escapeHTML(displayText)}</div>
    </div>
    <div class="sph-section">
      <span class="sph-label">What would you like to do?</span>
      <div class="sph-action-buttons">
        <button class="sph-action-btn" id="action-grammar">
          <span class="sph-action-icon">✓</span>
          <span class="sph-action-label">Fix Spelling & Grammar</span>
        </button>
        <button class="sph-action-btn" id="action-translate">
          <span class="sph-action-icon">🌐</span>
          <span class="sph-action-label">Translate</span>
        </button>
        <button class="sph-action-btn" id="action-shorter">
          <span class="sph-action-icon">📝</span>
          <span class="sph-action-label">Make Shorter</span>
        </button>
        <button class="sph-action-btn" id="action-longer">
          <span class="sph-action-icon">📄</span>
          <span class="sph-action-label">Make Longer</span>
        </button>
      </div>
    </div>
  `;

  // Attach event listeners
  $('#action-grammar').addEventListener('click', () => handleParagraphAction('grammar'));
  $('#action-translate').addEventListener('click', () => showTranslateOptions());
  $('#action-shorter').addEventListener('click', () => handleParagraphAction('shorter'));
  $('#action-longer').addEventListener('click', () => handleParagraphAction('longer'));
}

function showTranslateOptions() {
  const content = $('#sph-content');

  const displayText = selectedText.length > 150
    ? selectedText.substring(0, 150) + '...'
    : selectedText;

  content.innerHTML = `
    <div class="sph-section">
      <span class="sph-label">Selected Text</span>
      <div class="sph-current-subject">${escapeHTML(displayText)}</div>
    </div>
    <div class="sph-section">
      <span class="sph-label">Translate to</span>
      <div class="sph-language-buttons">
        <button class="sph-lang-btn" data-lang="English">EN</button>
        <button class="sph-lang-btn" data-lang="Dutch">NL</button>
        <button class="sph-lang-btn" data-lang="German">DE</button>
        <button class="sph-lang-btn" data-lang="French">FR</button>
      </div>
      <div class="sph-other-lang">
        <input type="text" id="other-language-input" class="sph-input" placeholder="Other language (e.g., Spanish)">
        <button class="sph-button sph-button-secondary" id="translate-other-btn">Translate</button>
      </div>
    </div>
    <div class="sph-section">
      <button class="sph-button sph-button-secondary" id="back-to-actions-btn">
        ← Back
      </button>
    </div>
  `;

  // Language button handlers
  $$('.sph-lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const lang = btn.dataset.lang;
      handleParagraphAction('translate', { targetLanguage: lang });
    });
  });

  // Other language handler
  const otherLangInput = $('#other-language-input');
  const translateOtherHandler = () => {
    const lang = otherLangInput.value.trim();
    if (lang) {
      handleParagraphAction('translate', { targetLanguage: lang });
    }
  };

  $('#translate-other-btn').addEventListener('click', translateOtherHandler);

  // Also trigger on Enter key
  otherLangInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      translateOtherHandler();
    }
  });

  // Back button
  $('#back-to-actions-btn').addEventListener('click', () => {
    showParagraphCoachContent();
  });
}

async function handleParagraphAction(action, options = {}) {
  if (extensionDisabled) return;

  const text = selectedText;
  if (!text) {
    showError('No text selected. Please select text and try again.');
    return;
  }

  try {
    let loadingMessage = 'Processing...';
    switch (action) {
      case 'grammar':
        loadingMessage = 'Checking spelling & grammar...';
        break;
      case 'translate':
        loadingMessage = `Translating to ${options.targetLanguage}...`;
        break;
      case 'shorter':
        loadingMessage = 'Making text shorter...';
        break;
      case 'longer':
        loadingMessage = 'Expanding text...';
        break;
    }

    showLoadingState(loadingMessage);

    const result = await window.SmartPRAPI.processParagraph(text, action, options);

    showParagraphResult(result.text, action, options);
    showToast('✨ Done!');

  } catch (error) {
    console.error('[Smart.pr Helper] Paragraph action error:', error);
    const errorMessage = window.SmartPRAPI.getErrorMessage(error);
    showParagraphError(errorMessage, action, options);
  }
}

function showParagraphResult(resultText, action, options = {}) {
  const content = $('#sph-content');

  let actionLabel = 'Result';
  switch (action) {
    case 'grammar':
      actionLabel = 'Corrected Text';
      break;
    case 'translate':
      actionLabel = `Translated to ${options.targetLanguage}`;
      break;
    case 'shorter':
      actionLabel = 'Shortened Text';
      break;
    case 'longer':
      actionLabel = 'Expanded Text';
      break;
  }

  const originalDisplay = selectedText.length > 100
    ? selectedText.substring(0, 100) + '...'
    : selectedText;

  content.innerHTML = `
    <div class="sph-section">
      <span class="sph-label">Original</span>
      <div class="sph-original-text">${escapeHTML(originalDisplay)}</div>
    </div>
    <div class="sph-section">
      <span class="sph-label">${escapeHTML(actionLabel)}</span>
      <div class="sph-result-text">${escapeHTML(resultText)}</div>
    </div>
    <div class="sph-section sph-result-actions">
      <button class="sph-button" id="replace-text-btn">
        Replace in Editor
      </button>
      <button class="sph-button sph-button-secondary" id="copy-result-btn">
        Copy to Clipboard
      </button>
      <button class="sph-button sph-button-secondary" id="try-another-btn">
        ← Try Another Action
      </button>
    </div>
  `;

  // Replace button
  $('#replace-text-btn').addEventListener('click', () => {
    replaceTextInEditor(resultText);
  });

  // Copy button
  $('#copy-result-btn').addEventListener('click', async () => {
    await copyToClipboard(resultText);
    const btn = $('#copy-result-btn');
    btn.textContent = '✓ Copied';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = 'Copy';
      btn.classList.remove('copied');
    }, 2000);
  });

  // Back button
  $('#try-another-btn').addEventListener('click', () => {
    showParagraphCoachContent();
  });
}

function showParagraphError(message, action, options) {
  const content = $('#sph-content');

  content.innerHTML = `
    <div class="sph-error">
      <div class="sph-error-text">${escapeHTML(message)}</div>
    </div>
    <div class="sph-section">
      <button class="sph-button" id="retry-action-btn">
        Try Again
      </button>
      <button class="sph-button sph-button-secondary" id="back-to-actions-btn">
        ← Back
      </button>
    </div>
  `;

  $('#retry-action-btn').addEventListener('click', () => {
    handleParagraphAction(action, options);
  });

  $('#back-to-actions-btn').addEventListener('click', () => {
    showParagraphCoachContent();
  });
}

function replaceTextInEditor(newText) {
  if (!selectedEditor) {
    showToast('Unable to replace text. Please select text again.');
    return;
  }

  try {
    // Determine the correct window and document for the editor (iframe support)
    const editorDoc = selectedEditorDoc || selectedEditor.ownerDocument || document;
    const editorWin = editorDoc.defaultView || window;

    // Focus the editor
    selectedEditor.focus();

    if (currentSelection) {
      // We have a saved selection range - restore it
      const selection = editorWin.getSelection();
      selection.removeAllRanges();
      selection.addRange(currentSelection);

      // Use execCommand on the correct document (works with Quill's undo stack)
      editorDoc.execCommand('insertText', false, newText);
    } else {
      // No saved selection - replace entire content
      // Select all content in the editor first
      const selection = editorWin.getSelection();
      const range = editorDoc.createRange();
      range.selectNodeContents(selectedEditor);
      selection.removeAllRanges();
      selection.addRange(range);

      // Replace with new text
      editorDoc.execCommand('insertText', false, newText);
    }

    showToast('✓ Text replaced!');

    // Clear selection state
    currentSelection = null;
    selectedText = '';
    selectedEditorDoc = null;

    // Close sidebar after a brief delay
    setTimeout(() => {
      closeSidebar();
    }, 1000);

  } catch (error) {
    console.error('[Smart.pr Helper] Replace error:', error);
    showToast('Replace failed. Try copying instead.');
  }
}

// ========== Subject Line Sidebar States ==========
function showEmptyState() {
  if (extensionDisabled) return;
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
  if (extensionDisabled) return;
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
  if (extensionDisabled) return;
  try {
    showLoadingState('Generating subject line suggestions...');

    let userPrompt = '';
    const languageInstruction = currentSubject
      ? 'All output must stay in the same language as the subject line. Do not translate.'
      : prDescription
        ? 'Write all output in the same language as the description. Do not translate.'
        : '';
    const languageSuffix = languageInstruction ? `\n\n${languageInstruction}` : '';

    if (currentSubject) {
      // Improving an existing subject
      userPrompt = `Generate improved alternatives for this subject line:\n\n"${currentSubject}"\n\nProvide 3-5 alternatives that are more compelling.${languageSuffix}`;
    } else if (prDescription) {
      // Generating from description
      userPrompt = `Generate 3-5 compelling subject lines for a press release about:\n\n${prDescription}\n\nMake them professional, newsworthy, and engaging.${languageSuffix}`;
    } else {
      // Generic generation (fallback)
      userPrompt = `Generate 3-5 compelling subject lines for a press release email. Make them professional, newsworthy, and engaging.${languageSuffix}`;
    }

    // Call proxy API via API client
    const result = await window.SmartPRAPI.generateSubjectLines(userPrompt, {
      currentSubject: currentSubject || undefined
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
  if (extensionDisabled) return;
  try {
    showLoadingState('Analyzing your subject line...');

    // Call proxy API via API client
    const result = await window.SmartPRAPI.getSubjectFeedback(subject, {
      keepLanguage: true
    });

    // Display feedback
    const content = $('#sph-content');
    content.innerHTML = `
      <div class="sph-section">
        <span class="sph-label">Your Subject</span>
        <div class="sph-current-subject">${escapeHTML(subject)}</div>
      </div>
      <div class="sph-section">
        <span class="sph-label">Feedback</span>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #374151;">${renderFeedbackMarkup(result.feedback)}</div>
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

function renderFeedbackMarkup(text) {
  if (!text) return '';
  const escaped = escapeHTML(text);
  const lines = escaped.split(/\r?\n/);
  const parts = [];
  let inList = false;

  const closeList = () => {
    if (!inList) return;
    parts.push('</ol>');
    inList = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      closeList();
      continue;
    }
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (!inList) {
        parts.push('<ol>');
        inList = true;
      }
      parts.push(`<li>${orderedMatch[1]}</li>`);
      continue;
    }
    closeList();
    parts.push(`<p>${trimmed}</p>`);
  }

  closeList();

  return parts.join('')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

async function copyToClipboard(text) {
  if (extensionDisabled) return;
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
  if (extensionDisabled) return;
  const topDoc = getTopDocument();
  const toast = topDoc.createElement('div');
  toast.className = 'sph-toast';
  toast.textContent = message;
  topDoc.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
}

// ========== Initialization ==========
function detachSubjectListeners() {
  if (subjectField && subjectListenersAttached) {
    subjectField.removeEventListener('focus', handleSubjectFocus);
    subjectField.removeEventListener('input', handleSubjectInput);
    subjectListenersAttached = false;
  }
}

function teardownExtensionUI() {
  hideNudge();
  teardownParagraphCoach();
  closeSidebar();
  if (sidebar) {
    sidebar.remove();
    sidebar = null;
  }
  if (floatingIcon) {
    floatingIcon.remove();
    floatingIcon = null;
  }
  detachSubjectListeners();
  if (subjectWatchTimer) {
    clearTimeout(subjectWatchTimer);
    subjectWatchTimer = null;
  }
}

function applyExtensionState(disabled) {
  extensionDisabled = Boolean(disabled);
  if (extensionDisabled) {
    teardownExtensionUI();
    return;
  }

  // Only create floating icon in the top frame, not in iframes
  const isTopFrame = window === window.top;

  if (isTopFrame) {
    if (!floatingIcon) {
      createFloatingIcon();
    }
    watchSubjectField();
  }

  // Paragraph Coach works in all frames (including iframes where editors live)
  initParagraphCoach();
}

function init() {
  console.log('[Smart.pr Helper] Initializing...');
  chrome.storage.sync.get([EXTENSION_DISABLED_KEY], (result) => {
    applyExtensionState(Boolean(result[EXTENSION_DISABLED_KEY]));
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (EXTENSION_DISABLED_KEY in changes) {
      applyExtensionState(Boolean(changes[EXTENSION_DISABLED_KEY].newValue));
    }
  });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
