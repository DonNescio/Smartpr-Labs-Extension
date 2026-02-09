/* Smart.pr Helper - Content Script (V2 React App) */

// ========== Frame Context Detection ==========
const isBeePluginFrame = window.location.hostname.includes('getbee.io');
const isTopFrame = window === window.top;

// ========== Utilities ==========
// Get the top-level document (sidebar lives there, not in iframes)
// In BeePlugin frame, falls back to current document (cross-origin)
const getTopDocument = () => {
  try {
    return window.top.document;
  } catch (e) {
    // Cross-origin (BeePlugin iframe), fall back to current document
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
let editorObserver = null;
let scanThrottleTimer = null;
let selectionUpdateTimer = null;
let subjectFieldUpdateTimer = null;
let iconVisibilityTimer = null;
let paragraphIconDocs = new Set();

// Floating icon overlay state (keeps icons outside React's DOM tree)
let iconOverlayContainer = null;
let elementToIconMap = new WeakMap(); // Maps editor elements to their icon elements
let iconPositionUpdateTimer = null;

// ========== Paragraph Coach - V2 TipTap Editor Detection ==========
// Find TipTap/ProseMirror editors in the V2 React app

// Track the editor iframe and its observer
let editorIframe = null;
let editorIframeObserver = null;
let dialogObserver = null;

// Pro editor (BeePlugin/TinyMCE) state
let proEditorObserver = null;

function findTipTapEditors(doc = document) {
  // Find all TipTap editor elements (ProseMirror-based)
  let editors = Array.from(doc.querySelectorAll('.tiptap.ProseMirror[contenteditable="true"]'));

  // Fallback: try without contenteditable check
  if (editors.length === 0) {
    editors = Array.from(doc.querySelectorAll('.tiptap.ProseMirror'));
  }

  return editors;
}

// Find heading/subheading input fields in V2
function findHeadingInputs(doc = document) {
  // H1 and H2 blocks use <input> elements instead of TipTap
  const h1Inputs = Array.from(doc.querySelectorAll('.block-wrapper h1 > input'));
  const h2Inputs = Array.from(doc.querySelectorAll('.block-wrapper h2 > input'));
  return [...h1Inputs, ...h2Inputs];
}

// Find all editable blocks (both TipTap editors and heading inputs)
function findAllEditableBlocks(doc = document) {
  const tipTapEditors = findTipTapEditors(doc).map(editor => ({
    element: editor,
    type: 'tiptap',
    doc
  }));

  const headingInputs = findHeadingInputs(doc).map(input => ({
    element: input,
    type: 'heading',
    doc
  }));

  return [...tipTapEditors, ...headingInputs];
}

// ========== Pro Editor (BeePlugin/TinyMCE) Detection ==========

// Find TinyMCE editors in the pro editor
function findTinyMCEEditors(doc = document) {
  return Array.from(doc.querySelectorAll('.mce-content-body[contenteditable="true"]'));
}

// Find all editable blocks in the pro editor
function findProEditorBlocks(doc = document) {
  const editors = findTinyMCEEditors(doc);
  return editors.map(element => ({
    element,
    type: 'tiptap', // Use tiptap behavior (selection-based icon visibility) since they're contenteditable
    doc
  }));
}

// Get the pro editor container for a TinyMCE element
function getProEditorContainer(editor) {
  return editor.closest('.module-box') || editor.closest('[data-tiny-wrapper]') || editor.parentElement;
}

// Get block type from a pro editor module-box container
function getProBlockType(container) {
  if (!container) return 'text';
  if (container.classList?.contains('module-box--heading')) return 'heading';
  if (container.classList?.contains('module-box--paragraph')) return 'paragraph';
  if (container.classList?.contains('module-box--text')) return 'paragraph';
  return 'text';
}

// ========== Classic Editor (TipTap/ProseMirror) Detection ==========

// Find the blob iframe that contains the V2 editor
function findEditorIframe() {
  // V2 uses blob: URLs for the editor iframe
  const iframes = $$('iframe[src^="blob:"]');

  // Also check for iframes with sandbox that might be the editor
  if (iframes.length === 0) {
    const sandboxedIframes = $$('iframe[sandbox*="allow-same-origin"]');
    for (const iframe of sandboxedIframes) {
      if (iframe.src && iframe.src.startsWith('blob:')) {
        return iframe;
      }
    }
  }

  return iframes[0] || null;
}

// Get all editable blocks from inside the blob iframe
function findEditorsInBlobIframe() {
  const iframe = findEditorIframe();
  if (!iframe) {
    console.log('[Smart.pr Helper] No editor iframe found');
    return [];
  }

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      console.log('[Smart.pr Helper] Could not access iframe document');
      return [];
    }

    console.log('[Smart.pr Helper] Scanning iframe for editors...');
    console.log('[Smart.pr Helper] iframe body children:', iframeDoc.body?.children?.length);

    // Debug: Log what we find
    const tipTapEditors = iframeDoc.querySelectorAll('.tiptap.ProseMirror');
    const blockWrappers = iframeDoc.querySelectorAll('.block-wrapper');
    console.log('[Smart.pr Helper] Found .tiptap.ProseMirror:', tipTapEditors.length);
    console.log('[Smart.pr Helper] Found .block-wrapper:', blockWrappers.length);

    const blocks = findAllEditableBlocks(iframeDoc);
    return blocks.map(block => ({
      element: block.element,
      type: block.type,
      iframeDoc,
      iframe
    }));
  } catch (e) {
    console.warn('[Smart.pr Helper] Error accessing iframe:', e);
    return [];
  }
}

function getEditorContainer(editor) {
  // Pro editor: Walk up to find .module-box
  const moduleBox = editor.closest('.module-box');
  if (moduleBox) return moduleBox;

  // Classic editor: Walk up to find .block-wrapper
  const blockWrapper = editor.closest('.block-wrapper');
  if (blockWrapper) return blockWrapper;

  // Fallback: return direct parent
  return editor.parentElement;
}

function getBlockType(container) {
  if (!container) return 'text';

  // Pro editor: Check module-box type classes
  if (container.classList?.contains('module-box')) {
    return getProBlockType(container);
  }

  // Classic editor: Check for heading/subheading inputs inside block-wrapper
  if (container.classList?.contains('block-wrapper')) {
    // Check for h1 with input (heading block)
    if (container.querySelector('h1 > input')) return 'heading';
    // Check for h2 with input (subheading block)
    if (container.querySelector('h2 > input')) return 'subheading';
    // Check block-label for type hint
    const blockLabel = container.querySelector('.block-label');
    if (blockLabel) {
      const labelText = blockLabel.textContent?.trim().toLowerCase();
      if (labelText === 'text' || labelText === 'paragraph') return 'paragraph';
    }
    // Has TipTap editor = text block
    if (container.querySelector('.tiptap.ProseMirror')) return 'paragraph';
  }

  return 'text';
}

function getActiveEditorFromSelection(doc) {
  const selection = doc.getSelection?.();
  if (!selection || selection.isCollapsed) return null;
  const selectionText = selection.toString();
  if (!selectionText || !selectionText.trim()) return null;

  const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  const node = range?.commonAncestorContainer || selection.anchorNode || selection.focusNode;
  const element = node && node.nodeType === 1 ? node : node?.parentElement;
  // Find TipTap editor (classic) or TinyMCE editor (pro)
  return element?.closest('.tiptap.ProseMirror') || element?.closest('.mce-content-body') || null;
}

function setParagraphIconVisible(editor, isVisible) {
  // Look up icon from our map (icons are in overlay, not in React's DOM)
  const icon = elementToIconMap.get(editor);
  if (!icon) return;
  icon.classList.toggle('sph-visible', isVisible);
}

function clearVisibleParagraphIcons() {
  // Only clear selection-managed icons (TipTap), not focus-managed icons (headings)
  paragraphIconDocs.forEach((doc) => {
    doc.querySelectorAll('.sph-block-icon.sph-visible:not([data-focus-managed])').forEach((icon) => {
      icon.classList.remove('sph-visible');
    });
  });
}

function handleParagraphSelectionChange(doc) {
  if (iconVisibilityTimer) clearTimeout(iconVisibilityTimer);
  iconVisibilityTimer = setTimeout(() => {
    clearVisibleParagraphIcons();
    const editor = getActiveEditorFromSelection(doc);
    if (editor) {
      setParagraphIconVisible(editor, true);
    }
  }, 100);
}

function registerParagraphSelectionListener(doc) {
  if (!doc || doc._sphParagraphIconSelectionHandler) return;
  const handler = () => handleParagraphSelectionChange(doc);
  doc.addEventListener('selectionchange', handler);
  doc._sphParagraphIconSelectionHandler = handler;
  paragraphIconDocs.add(doc);
}

// Create or get the overlay container for floating icons (outside React's DOM)
function getOrCreateIconOverlay(iframeDoc) {
  if (iconOverlayContainer && iconOverlayContainer.ownerDocument === iframeDoc) {
    return iconOverlayContainer;
  }

  console.log('[Smart.pr Helper] Creating icon overlay container');

  // Create new overlay container (use fixed positioning for reliability)
  iconOverlayContainer = iframeDoc.createElement('div');
  iconOverlayContainer.id = 'sph-icon-overlay';
  iconOverlayContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999;';
  iframeDoc.body.appendChild(iconOverlayContainer);

  // Inject styles if not already done
  if (!iframeDoc.getElementById('sph-injected-styles')) {
    injectStylesIntoIframe(iframeDoc);
  }

  return iconOverlayContainer;
}

// Update icon position to match its target element
function updateIconPosition(icon, element) {
  const container = getEditorContainer(element);
  if (!container) return;

  // Use viewport-relative coordinates (for fixed positioning)
  const rect = container.getBoundingClientRect();

  // Position icon inside the block (top-right corner)
  icon.style.top = `${rect.top + 4}px`;
  icon.style.left = `${rect.right - 40}px`; // Inside the block, 40px from right edge
}

// Update all icon positions (called on scroll/resize)
function updateAllIconPositions() {
  if (iconPositionUpdateTimer) return;
  iconPositionUpdateTimer = requestAnimationFrame(() => {
    iconPositionUpdateTimer = null;
    if (!iconOverlayContainer) return;

    const icons = iconOverlayContainer.querySelectorAll('.sph-block-icon');
    icons.forEach(icon => {
      const element = icon._targetElement;
      if (element && element.isConnected) {
        updateIconPosition(icon, element);
      } else {
        // Element was removed, clean up icon
        icon.remove();
        if (element) elementToIconMap.delete(element);
      }
    });
  });
}

function addParagraphIcon(element, iframeDoc = null, elementType = 'tiptap') {
  // Check if we already have an icon for this element
  if (elementToIconMap.has(element)) return;

  // Get the block-wrapper container
  const container = getEditorContainer(element);
  if (!container) return;

  // Determine which document to use
  const doc = iframeDoc || element.ownerDocument || document;

  // Get or create the overlay container (OUTSIDE React's DOM)
  const overlay = getOrCreateIconOverlay(doc);

  // Create floating icon
  const iconBtn = doc.createElement('button');
  iconBtn.className = 'sph-block-icon';
  iconBtn.innerHTML = `<img src="${chrome.runtime.getURL('logo-white.png')}" alt="Smart.pr" style="width:24px;height:24px;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(45,27,78,0.2))" />`;
  iconBtn.title = 'Improve with AI';
  iconBtn._targetElement = element; // Store reference for position updates

  // Add to overlay (not to React's DOM!)
  overlay.appendChild(iconBtn);

  // Position icon next to the element
  updateIconPosition(iconBtn, element);
  console.log('[Smart.pr Helper] Added icon for', elementType, 'at', iconBtn.style.top, iconBtn.style.left);

  // Store in our map
  elementToIconMap.set(element, iconBtn);

  // For TipTap editors, register selection listener for icon visibility
  if (elementType === 'tiptap') {
    registerParagraphSelectionListener(doc);
    handleParagraphSelectionChange(doc);
  } else {
    // Mark as focus-managed so clearVisibleParagraphIcons() won't clear it
    iconBtn.dataset.focusManaged = 'true';
    // For heading inputs, show icon on focus instead of selection
    element.addEventListener('focus', () => setParagraphIconVisible(element, true));
    element.addEventListener('blur', () => {
      // Delay hiding to allow click on icon
      setTimeout(() => setParagraphIconVisible(element, false), 200);
    });
  }

  // Click handler
  iconBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    let text = '';

    if (elementType === 'heading') {
      // For heading inputs, get value from input
      text = element.value?.trim() || '';
      currentSelection = null;
    } else {
      // For TipTap editors, check for selection first
      const win = iframeDoc ? iframeDoc.defaultView : window;
      const selection = win?.getSelection();

      if (selection && !selection.isCollapsed && element.contains(selection.anchorNode)) {
        text = selection.toString().trim();
        currentSelection = selection.getRangeAt(0).cloneRange();
      } else {
        // Use full editor content
        text = element.innerText.trim();
        currentSelection = null;
      }
    }

    if (!text) {
      console.log('[Smart.pr Helper] No text to improve');
      return;
    }

    selectedText = text;
    selectedEditor = element;
    selectedEditorDoc = iframeDoc; // Store reference for later

    openParagraphCoachSidebar();
  });
}

// Inject minimal styles into iframe for the floating icons
function injectStylesIntoIframe(iframeDoc) {
  const style = iframeDoc.createElement('style');
  style.id = 'sph-injected-styles';
  style.textContent = `
    #sph-icon-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
    }
    .sph-block-icon {
      position: absolute;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 50%;
      background: linear-gradient(135deg, #FFD580 0%, #FFBC7F 50%, #E8B5E8 100%);
      color: white;
      font-size: 16px;
      cursor: pointer;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(212, 165, 245, 0.3);
    }
    .sph-block-icon.sph-visible {
      opacity: 1;
      pointer-events: auto;
    }
    .sph-block-icon:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(212, 165, 245, 0.5);
    }
  `;
  iframeDoc.head.appendChild(style);

  // Add scroll listener to update icon positions
  const iframeWin = iframeDoc.defaultView;
  if (iframeWin) {
    iframeWin.addEventListener('scroll', updateAllIconPositions, { passive: true });
    iframeWin.addEventListener('resize', updateAllIconPositions, { passive: true });
  }
}

function scanAndAddIcons() {
  let count = 0;

  if (isBeePluginFrame) {
    // Pro editor: Scan TinyMCE editors in the current document
    const proBlocks = findProEditorBlocks(document);
    proBlocks.forEach(({ element, type }) => {
      addParagraphIcon(element, null, type);
    });
    count = proBlocks.length;
  } else {
    // Classic editor: Scan all editable blocks inside the blob iframe
    const iframeBlocks = findEditorsInBlobIframe();
    iframeBlocks.forEach(({ element, type, iframeDoc }) => {
      addParagraphIcon(element, iframeDoc, type);
    });
    count = iframeBlocks.length;
  }

  return count;
}

// Watch the blob iframe for content changes
function watchEditorIframe(iframe) {
  if (editorIframe === iframe && editorIframeObserver) return; // Already watching

  // Clean up previous observer
  if (editorIframeObserver) {
    editorIframeObserver.disconnect();
    editorIframeObserver = null;
  }

  editorIframe = iframe;

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc || !iframeDoc.body) {
      // Not ready yet, wait for load
      console.log('[Smart.pr Helper] Iframe not ready, waiting for load...');
      iframe.addEventListener('load', () => watchEditorIframe(iframe), { once: true });
      return;
    }

    console.log('[Smart.pr Helper] Watching editor iframe for changes');

    // Wait a moment for React to render content, then do initial scan
    setTimeout(() => {
      const count = scanAndAddIcons();
      console.log(`[Smart.pr Helper] Initial scan found ${count} editors`);

      // If no editors found, try again after a delay (React might still be rendering)
      if (count === 0) {
        setTimeout(() => {
          const retryCount = scanAndAddIcons();
          console.log(`[Smart.pr Helper] Retry scan found ${retryCount} editors`);
        }, 500);
      }
    }, 200);

    // Watch for new blocks being added inside the iframe
    editorIframeObserver = new MutationObserver(() => {
      if (scanThrottleTimer) return;
      scanThrottleTimer = setTimeout(() => {
        scanThrottleTimer = null;
        scanAndAddIcons();
        updateAllIconPositions(); // Update positions when DOM changes
      }, 300);
    });

    editorIframeObserver.observe(iframeDoc.body, {
      childList: true,
      subtree: true
    });

    // Also register selection listener in the iframe
    registerParagraphSelectionListener(iframeDoc);

  } catch (e) {
    console.warn('[Smart.pr Helper] Could not access iframe:', e);
  }
}

// Watch for the mailing dialog and editor iframe to appear
function initDialogWatcher() {
  if (dialogObserver) return; // Already watching

  console.log('[Smart.pr Helper] Starting dialog watcher');

  const checkForEditorIframe = () => {
    const iframe = findEditorIframe();
    if (iframe && iframe !== editorIframe) {
      console.log('[Smart.pr Helper] Editor iframe detected');
      watchEditorIframe(iframe);
    }
  };

  const checkForSubjectField = () => {
    const field = findSubjectField();
    if (field && field !== subjectField) {
      console.log('[Smart.pr Helper] Subject field detected');
      subjectField = field;
      if (!subjectListenersAttached) {
        subjectField.addEventListener('focus', handleSubjectFocus);
        subjectField.addEventListener('input', handleSubjectInput);
        subjectListenersAttached = true;
      }
      lastSubjectValue = subjectField.value;
    }
  };

  // Initial checks
  checkForEditorIframe();
  checkForSubjectField();

  // Watch for dialogs appearing/disappearing
  dialogObserver = new MutationObserver((mutations) => {
    // Check if any relevant elements were added
    let shouldCheckIframe = false;
    let shouldCheckSubject = false;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // Check for iframe being added
        if (node.tagName === 'IFRAME' || node.querySelector?.('iframe')) {
          shouldCheckIframe = true;
        }

        // Check for dialog/form being added (contains subject field)
        if (node.querySelector?.('input[name="subject"]') ||
            node.matches?.('.Dialog') ||
            node.querySelector?.('.Dialog')) {
          shouldCheckSubject = true;
        }
      }

      // Check for removals (dialog closed)
      for (const node of mutation.removedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // If dialog was removed, reset state
        if (node.matches?.('.Dialog') || node.querySelector?.('.Dialog')) {
          console.log('[Smart.pr Helper] Dialog closed, resetting state');
          resetDetectionState();
        }
      }
    }

    if (shouldCheckIframe) {
      // Debounce iframe checks
      setTimeout(checkForEditorIframe, 100);
    }

    if (shouldCheckSubject) {
      // Debounce subject field checks
      setTimeout(checkForSubjectField, 100);
    }
  });

  dialogObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Reset editor-related state when editor dialog closes
function resetDetectionState() {
  // Clean up editor iframe watching (classic editor)
  if (editorIframeObserver) {
    editorIframeObserver.disconnect();
    editorIframeObserver = null;
  }
  editorIframe = null;

  // Clean up pro editor watching
  if (proEditorObserver) {
    proEditorObserver.disconnect();
    proEditorObserver = null;
  }

  // Clean up floating icon overlay (it's safe, it's outside React's DOM)
  if (iconOverlayContainer) {
    iconOverlayContainer.remove();
    iconOverlayContainer = null;
  }
  elementToIconMap = new WeakMap();

  // Clean up paragraph coach state
  selectedEditor = null;
  selectedEditorDoc = null;
  selectedText = '';
  currentSelection = null;

  // Re-detect subject field (it may still be in the DOM behind the closed dialog)
  const field = findSubjectField();
  if (field && field !== subjectField) {
    subjectField = field;
    if (!subjectListenersAttached) {
      subjectField.addEventListener('focus', handleSubjectFocus);
      subjectField.addEventListener('input', handleSubjectInput);
      subjectListenersAttached = true;
    }
    lastSubjectValue = subjectField.value;
  } else if (field && field === subjectField && !subjectListenersAttached) {
    // Same field but listeners were lost — reattach
    subjectField.addEventListener('focus', handleSubjectFocus);
    subjectField.addEventListener('input', handleSubjectInput);
    subjectListenersAttached = true;
  }
}

// ========== Pro Editor (BeePlugin) Initialization ==========

function initProEditor() {
  if (extensionDisabled) return;

  console.log('[Smart.pr Helper] Initializing pro editor support (BeePlugin frame)');

  const stage = document.querySelector('#sdk-stage');
  if (stage) {
    watchProEditorStage(stage);
    return;
  }

  // Wait for #sdk-stage to appear
  const stageObserver = new MutationObserver(() => {
    const stage = document.querySelector('#sdk-stage');
    if (stage) {
      stageObserver.disconnect();
      watchProEditorStage(stage);
    }
  });

  stageObserver.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
}

function watchProEditorStage(stage) {
  if (proEditorObserver) return; // Already watching

  console.log('[Smart.pr Helper] Watching pro editor stage for TinyMCE editors');

  // Initial scan with retry
  setTimeout(() => {
    const count = scanAndAddIcons();
    console.log(`[Smart.pr Helper] Pro editor initial scan found ${count} editors`);

    if (count === 0) {
      setTimeout(() => {
        const retryCount = scanAndAddIcons();
        console.log(`[Smart.pr Helper] Pro editor retry scan found ${retryCount} editors`);
      }, 500);
    }
  }, 200);

  // Watch for new modules being added
  proEditorObserver = new MutationObserver(() => {
    if (scanThrottleTimer) return;
    scanThrottleTimer = setTimeout(() => {
      scanThrottleTimer = null;
      scanAndAddIcons();
      updateAllIconPositions();
    }, 300);
  });

  proEditorObserver.observe(stage, {
    childList: true,
    subtree: true
  });

  // Register selection listener on the document
  registerParagraphSelectionListener(document);
}

function teardownProEditor() {
  if (proEditorObserver) {
    proEditorObserver.disconnect();
    proEditorObserver = null;
  }

  if (iconOverlayContainer) {
    iconOverlayContainer.remove();
    iconOverlayContainer = null;
  }
  elementToIconMap = new WeakMap();
}

// ========== Classic Editor Initialization ==========

function initParagraphCoach() {
  if (extensionDisabled) return;

  // V2: Use dialog-aware detection instead of polling
  initDialogWatcher();
}

function teardownParagraphCoach() {
  // Remove the floating icon overlay (it's outside React's DOM, safe to remove)
  if (iconOverlayContainer) {
    iconOverlayContainer.remove();
    iconOverlayContainer = null;
  }
  elementToIconMap = new WeakMap();

  // V2: Clean up dialog observer
  if (dialogObserver) {
    dialogObserver.disconnect();
    dialogObserver = null;
  }

  // Clean up iframe observer (classic editor)
  if (editorIframeObserver) {
    editorIframeObserver.disconnect();
    editorIframeObserver = null;
  }
  editorIframe = null;

  // Clean up pro editor observer
  if (proEditorObserver) {
    proEditorObserver.disconnect();
    proEditorObserver = null;
  }

  if (editorObserver) {
    editorObserver.disconnect();
    editorObserver = null;
  }

  if (iconVisibilityTimer) {
    clearTimeout(iconVisibilityTimer);
    iconVisibilityTimer = null;
  }

  paragraphIconDocs.forEach((doc) => {
    if (doc._sphParagraphIconSelectionHandler) {
      doc.removeEventListener('selectionchange', doc._sphParagraphIconSelectionHandler);
      delete doc._sphParagraphIconSelectionHandler;
    }
  });
  paragraphIconDocs.clear();
}

// ========== Subject Field Detection (V2) ==========
function findSubjectField() {
  // V2 React app selectors - prioritized list
  const selectors = [
    'input[name="subject"]',                      // V2 primary selector
    'input[placeholder="Type your subject"]',     // V2 placeholder
    'input[placeholder*="subject" i]',            // Fallback: any subject placeholder
    'input[placeholder*="onderwerp" i]'           // Dutch fallback
  ];

  for (const selector of selectors) {
    const field = $(selector);
    if (field) return field;
  }

  return null;
}

// Note: watchSubjectField is no longer used in V2
// Subject field detection is handled by initDialogWatcher()
function watchSubjectField() {
  // V2: This is now handled by the dialog watcher
  // Keeping for backwards compatibility but it just calls the dialog watcher
  if (extensionDisabled) return;
  initDialogWatcher();
}

function handleSubjectFocus() {
  console.log('[Smart.pr Helper] Subject field focused');
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
  console.log('[Smart.pr Helper] showNudge called:', message, type);
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

  // Detect context: Are we in editor mode or subject line mode?
  const hasEditorIframe = editorIframe !== null;

  if (hasEditorIframe) {
    // We're in editor mode - check for text selection
    try {
      const iframeDoc = editorIframe.contentDocument || editorIframe.contentWindow?.document;
      const iframeWin = editorIframe.contentWindow;

      if (iframeDoc && iframeWin) {
        const selection = iframeWin.getSelection();
        const hasSelection = selection && !selection.isCollapsed && selection.toString().trim();

        if (hasSelection) {
          // User has text selected - find which editor it's in
          const anchorNode = selection.anchorNode;
          const anchorElement = anchorNode && anchorNode.nodeType === 1
            ? anchorNode
            : anchorNode?.parentElement;

          // Check for TipTap editor
          let editor = anchorElement?.closest('.tiptap.ProseMirror');

          // Also check for heading input (selection in input)
          if (!editor && anchorElement?.tagName === 'INPUT') {
            const blockWrapper = anchorElement.closest('.block-wrapper');
            if (blockWrapper && (blockWrapper.querySelector('h1 > input') || blockWrapper.querySelector('h2 > input'))) {
              editor = anchorElement;
            }
          }

          if (editor) {
            selectedText = selection.toString().trim();
            selectedEditor = editor;
            selectedEditorDoc = iframeDoc;
            currentSelection = selection.getRangeAt(0).cloneRange();
            openParagraphCoachSidebar();
            return;
          }
        }

        // No selection - show editor context prompt
        openEditorContextSidebar();
        return;
      }
    } catch (e) {
      console.warn('[Smart.pr Helper] Could not access editor iframe:', e);
    }
  }

  // Fallback to subject line mode
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

// Show sidebar when in editor context but no text selected
function openEditorContextSidebar() {
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

  // Show helpful prompt to select text
  const content = $('#sph-content');
  content.innerHTML = `
    <div class="sph-empty">
      <div class="sph-empty-icon">✨</div>
      <div class="sph-empty-text">
        <strong>Select text to improve</strong>
        <p style="margin-top: 8px; color: #6b7280; font-size: 13px;">
          Highlight text in any heading or paragraph block, then click the ✨ icon that appears to get AI-powered suggestions.
        </p>
      </div>
    </div>
    <div class="sph-section" style="margin-top: 16px;">
      <span class="sph-label">What you can do</span>
      <div class="sph-help-list" style="font-size: 13px; color: #374151; line-height: 1.6;">
        <div style="margin-bottom: 8px;">✓ Fix spelling & grammar</div>
        <div style="margin-bottom: 8px;">🔄 Rephrase paragraph</div>
        <div style="margin-bottom: 8px;">💡 Suggest synonyms</div>
        <div style="margin-bottom: 8px;">🌐 Translate to other languages</div>
        <div style="margin-bottom: 8px;">📝 Make text shorter</div>
      </div>
    </div>
  `;
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

  // Check if this is a heading input
  const isInputElement = selectedEditor.tagName === 'INPUT';

  let newText = '';

  if (isInputElement) {
    // For heading inputs, just get the current value
    newText = selectedEditor.value?.trim() || '';
    currentSelection = null;
  } else {
    // For TipTap editors, check for selection
    const editorDoc = selectedEditorDoc || selectedEditor.ownerDocument || document;
    const editorWin = editorDoc.defaultView || window;
    const selection = editorWin?.getSelection();
    const anchorNode = selection?.anchorNode;
    const anchorElement = anchorNode && anchorNode.nodeType === 1
      ? anchorNode
      : anchorNode?.parentElement;
    // Find TipTap editor (classic) or TinyMCE editor (pro)
    const activeEditor = anchorElement?.closest('.tiptap.ProseMirror') || anchorElement?.closest('.mce-content-body');

    if (activeEditor && activeEditor !== selectedEditor) {
      selectedEditor = activeEditor;
      selectedEditorDoc = activeEditor.ownerDocument || selectedEditorDoc;
    }

    if (selection && !selection.isCollapsed && selectedEditor.contains(selection.anchorNode)) {
      newText = selection.toString().trim();
      currentSelection = selection.getRangeAt(0).cloneRange();
    } else {
      // Use full editor content if no selection
      newText = selectedEditor.innerText.trim();
      currentSelection = null;
    }
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

  // V2: Get block type from the editor's .block-wrapper container
  const container = selectedEditor ? selectedEditor.closest('.block-wrapper') : null;
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
        <button class="sph-action-btn" id="action-rephrase">
          <span class="sph-action-icon">🔄</span>
          <span class="sph-action-label">Rephrase Paragraph</span>
        </button>
        <button class="sph-action-btn" id="action-synonyms">
          <span class="sph-action-icon">💡</span>
          <span class="sph-action-label">Suggest Synonyms</span>
        </button>
        <button class="sph-action-btn" id="action-translate">
          <span class="sph-action-icon">🌐</span>
          <span class="sph-action-label">Translate</span>
        </button>
        <button class="sph-action-btn" id="action-shorter">
          <span class="sph-action-icon">📝</span>
          <span class="sph-action-label">Make Shorter</span>
        </button>
      </div>
    </div>
  `;

  // Attach event listeners
  $('#action-grammar').addEventListener('click', () => handleParagraphAction('grammar'));
  $('#action-rephrase').addEventListener('click', () => handleParagraphAction('rephrase'));
  $('#action-synonyms').addEventListener('click', () => handleParagraphAction('synonyms'));
  $('#action-translate').addEventListener('click', () => showTranslateOptions());
  $('#action-shorter').addEventListener('click', () => handleParagraphAction('shorter'));
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
      case 'rephrase':
        loadingMessage = 'Rephrasing paragraph...';
        break;
      case 'synonyms':
        loadingMessage = 'Finding synonyms...';
        break;
      case 'translate':
        loadingMessage = `Translating to ${options.targetLanguage}...`;
        break;
      case 'shorter':
        loadingMessage = 'Making text shorter...';
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
    case 'rephrase':
      actionLabel = 'Rephrased Text';
      break;
    case 'synonyms':
      actionLabel = 'Synonym Suggestions';
      break;
    case 'translate':
      actionLabel = `Translated to ${options.targetLanguage}`;
      break;
    case 'shorter':
      actionLabel = 'Shortened Text';
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
    // Check if this is a heading input (not a TipTap editor)
    const isInputElement = selectedEditor.tagName === 'INPUT';

    if (isInputElement) {
      // For heading inputs, directly set the value
      selectedEditor.focus();
      selectedEditor.value = newText;

      // Dispatch input event to notify React of the change
      const inputEvent = new Event('input', { bubbles: true });
      selectedEditor.dispatchEvent(inputEvent);

      // Also dispatch change event for good measure
      const changeEvent = new Event('change', { bubbles: true });
      selectedEditor.dispatchEvent(changeEvent);
    } else {
      // For TipTap editors, use selection-based replacement
      const editorDoc = selectedEditorDoc || selectedEditor.ownerDocument || document;
      const editorWin = editorDoc.defaultView || window;

      // Focus the editor
      selectedEditor.focus();

      if (currentSelection) {
        // We have a saved selection range - restore it
        const selection = editorWin.getSelection();
        selection.removeAllRanges();
        selection.addRange(currentSelection);

        // Use execCommand on the correct document (works with TipTap's undo stack)
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
    if (isBeePluginFrame) {
      teardownProEditor();
    } else {
      teardownExtensionUI();
    }
    return;
  }

  if (isBeePluginFrame) {
    // Pro editor: Run paragraph coach inside the BeePlugin iframe
    initProEditor();
  } else if (isTopFrame) {
    // Top frame on smart.pr: Run floating icon, subject line helper, dialog watcher
    if (!floatingIcon) {
      createFloatingIcon();
    }

    // Single dialog watcher handles both subject field and editor detection
    initDialogWatcher();
  }
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
