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
let currentSidebarMode = 'subject'; // 'subject', 'paragraph', or 'kb'
let editorObserver = null;
let scanThrottleTimer = null;
let selectionUpdateTimer = null;
let subjectFieldUpdateTimer = null;
let iconVisibilityTimer = null;
let paragraphIconDocs = new Set();

// Undo state for text replacement
let undoState = null; // { editor, editorDoc, originalText, selection, isInput }
let undoToastTimer = null;

// Knowledge Base state
let kbConversation = [];        // [{ role: 'user'|'assistant', text, citations? }]
let kbConversationId = null;    // OpenAI conversation ID for follow-ups
let kbBusy = false;

// Progressive loading message timer
let loadingMessageTimer = null;

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
let proStageObserver = null;

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

// Find all editable blocks (TipTap editors, heading inputs, and TinyMCE editors)
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

  const tinyMCEEditors = findTinyMCEEditors(doc).map(editor => ({
    element: editor,
    type: 'tiptap',
    doc
  }));

  return [...tipTapEditors, ...headingInputs, ...tinyMCEEditors];
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
  // Only clear icons managed by document selectionchange (TipTap), not input-managed (headings)
  paragraphIconDocs.forEach((doc) => {
    doc.querySelectorAll('.sph-block-icon.sph-visible:not([data-input-managed])').forEach((icon) => {
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
    // Heading icons are managed by input events, not document selectionchange
    iconBtn.dataset.inputManaged = 'true';
    // For heading inputs, show icon only when text is selected (like TipTap blocks)
    const checkInputSelection = () => {
      const hasSelection = element.selectionStart !== element.selectionEnd;
      setParagraphIconVisible(element, hasSelection);
    };
    element.addEventListener('select', checkInputSelection);
    element.addEventListener('keyup', checkInputSelection);
    element.addEventListener('mouseup', checkInputSelection);
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

  // Add scroll listener to update icon positions (guard against duplicates)
  const iframeWin = iframeDoc.defaultView;
  if (iframeWin && !iframeWin._sphListenersAttached) {
    iframeWin.addEventListener('scroll', updateAllIconPositions, { passive: true });
    iframeWin.addEventListener('resize', updateAllIconPositions, { passive: true });
    iframeWin._sphListenersAttached = true;
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
  // Clear any pending scan throttle so it doesn't fire on stale DOM
  if (scanThrottleTimer) {
    clearTimeout(scanThrottleTimer);
    scanThrottleTimer = null;
  }

  // Clean up editor iframe watching (classic editor)
  if (editorIframeObserver) {
    editorIframeObserver.disconnect();
    editorIframeObserver = null;
  }
  editorIframe = null;

  // Clean up pro editor watching
  if (proStageObserver) {
    proStageObserver.disconnect();
    proStageObserver = null;
  }
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

  // Close sidebar if it was in paragraph/editor mode (editor is gone)
  if (currentSidebarMode === 'paragraph') {
    closeSidebar();
  }

  // Reset listener flag — the DOM element may have been recreated by React
  subjectListenersAttached = false;

  // Re-detect subject field (it may still be in the DOM behind the closed dialog)
  const field = findSubjectField();
  if (field) {
    subjectField = field;
    subjectField.addEventListener('focus', handleSubjectFocus);
    subjectField.addEventListener('input', handleSubjectInput);
    subjectListenersAttached = true;
    lastSubjectValue = subjectField.value;
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
  if (proStageObserver) {
    proStageObserver.disconnect();
  }
  proStageObserver = new MutationObserver(() => {
    const stage = document.querySelector('#sdk-stage');
    if (stage) {
      proStageObserver.disconnect();
      proStageObserver = null;
      watchProEditorStage(stage);
    }
  });

  proStageObserver.observe(document.body || document.documentElement, {
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
    showNudge(getNudgeMessage('empty'), 'empty');
  } else {
    showNudge(getNudgeMessage('filled'), 'filled');
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
      <div class="sph-header-left">
        <button class="sph-back" title="Back to Ask me anything"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8,1 3,6 8,11"/></svg></button>
        <h2 class="sph-title">Subject Line Helper</h2>
      </div>
      <button class="sph-close"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/></svg></button>
    </div>
    <div class="sph-content" id="sph-content">
      <!-- Content will be dynamically inserted -->
    </div>
    <div class="sph-footer" id="sph-footer">
      <button class="sph-feedback-link" id="sph-feedback-btn">Feedback</button>
    </div>
  `;

  topDoc.body.appendChild(sidebar);

  // Close button
  const closeBtn = sidebar.querySelector('.sph-close');
  closeBtn.addEventListener('click', closeSidebar);

  // Back button — returns to Knowledge Base
  const backBtn = sidebar.querySelector('.sph-back');
  backBtn.addEventListener('click', () => {
    stopSelectionTracking();
    stopSubjectFieldTracking();
    openKnowledgeBaseSidebar();
  });

  // Feedback button
  initSidebarFeedback();

  // Initially hide back button (KB is default home)
  updateBackButton();

  return sidebar;
}

function updateBackButton() {
  if (!sidebar) return;
  const backBtn = sidebar.querySelector('.sph-back');
  if (backBtn) {
    backBtn.style.display = currentSidebarMode === 'kb' ? 'none' : 'flex';
  }
}

function initSidebarFeedback() {
  const footer = sidebar.querySelector('#sph-footer');
  const feedbackBtn = footer.querySelector('#sph-feedback-btn');

  feedbackBtn.addEventListener('click', () => {
    showSidebarFeedbackForm(footer);
  });
}

function showSidebarFeedbackForm(footer) {
  footer.innerHTML = `
    <div class="sph-feedback-form">
      <textarea class="sph-feedback-textarea" id="sph-feedback-text" rows="2" placeholder="Tell us what you think..."></textarea>
      <div class="sph-feedback-actions">
        <button class="sph-feedback-send" id="sph-feedback-send">Send</button>
        <button class="sph-feedback-cancel" id="sph-feedback-cancel">Cancel</button>
      </div>
    </div>
  `;

  const textarea = footer.querySelector('#sph-feedback-text');
  textarea.focus();

  footer.querySelector('#sph-feedback-cancel').addEventListener('click', () => {
    resetSidebarFeedback(footer);
  });

  footer.querySelector('#sph-feedback-send').addEventListener('click', async () => {
    const text = textarea.value.trim();
    if (!text) return;

    const sendBtn = footer.querySelector('#sph-feedback-send');
    sendBtn.textContent = 'Sending...';
    sendBtn.disabled = true;

    try {
      await window.SmartPRAPI.submitFeedback(text);
      triggerSparkle(sendBtn);
      showToast('\u2713 Feedback sent!');
      resetSidebarFeedback(footer);
    } catch (error) {
      sendBtn.textContent = 'Send';
      sendBtn.disabled = false;
      const errorMsg = window.SmartPRAPI.getErrorMessage(error);
      showToast('Failed to send feedback');
      console.error('[Smart.pr Helper] Feedback error:', errorMsg);
    }
  });
}

function resetSidebarFeedback(footer) {
  footer.innerHTML = `
    <button class="sph-feedback-link" id="sph-feedback-btn">Feedback</button>
  `;
  footer.querySelector('#sph-feedback-btn').addEventListener('click', () => {
    showSidebarFeedbackForm(footer);
  });
}

function openSidebar(type) {
  if (extensionDisabled) return;
  if (!sidebar) {
    createSidebar();
  }

  currentSidebarMode = 'subject';
  updateBackButton();

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

  // Check for pro editor (BeePlugin iframe) — editors run inside it, not in a blob iframe
  const beeIframes = document.querySelectorAll('iframe[src*="getbee.io"]');
  if (beeIframes.length > 0) {
    openEditorContextSidebar();
    return;
  }

  // Check if subject field is actually present and connected in the DOM
  const activeSubjectField = subjectField && subjectField.isConnected ? subjectField : findSubjectField();
  if (activeSubjectField) {
    subjectField = activeSubjectField;
    const currentValue = subjectField.value.trim();
    if (currentValue === '') {
      openSidebar('empty');
    } else {
      openSidebar('filled');
    }
  } else {
    // No editor and no subject field in the DOM — show feature overview
    openOverviewSidebar();
  }
}

function openOverviewSidebar() {
  if (extensionDisabled) return;
  // Overview goes straight into KB mode
  openKnowledgeBaseSidebar();
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
  updateBackButton();

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
  updateBackButton();

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
          Highlight text in any heading or paragraph block to get AI-powered suggestions.
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

  // Watch for text selection while sidebar is open
  startEditorSelectionWatcher();
}

// ========== Knowledge Base Sidebar ==========
function openKnowledgeBaseSidebar() {
  if (extensionDisabled) return;
  if (!sidebar) {
    createSidebar();
  }

  currentSidebarMode = 'kb';
  updateBackButton();

  const title = sidebar.querySelector('.sph-title');
  if (title) {
    title.textContent = 'Ask me anything';
  }

  sidebar.classList.add('open');
  updateFloatingIcon(true);
  hideIconBadge();

  // Reset conversation state for fresh session
  kbConversation = [];
  kbConversationId = null;

  showKBEmptyState();
}

async function showKBEmptyState() {
  await setContentWithTransition(`
    <div class="sph-section">
      <div class="sph-empty" style="padding: 24px;">
        <div class="sph-empty-icon"><img src="${chrome.runtime.getURL('logo-smart.png')}" alt="Smart.pr" style="width:48px;height:48px;object-fit:contain;display:block;margin:0 auto;"></div>
        <div class="sph-empty-text">
          <strong>I know Smart.pr inside out</strong>
          <p style="margin-top: 8px; color: #6b7280; font-size: 13px;">
            Platform questions, PR tips, how-tos — just ask.
          </p>
        </div>
      </div>
    </div>
    <div class="sph-section sph-kb-input-section">
      <div class="sph-kb-input-row">
        <input type="text" id="kb-question-input" class="sph-input sph-kb-input" placeholder="What do you need help with?">
        <button class="sph-kb-ask-btn" id="kb-ask-btn">Ask</button>
      </div>
    </div>
    <div class="sph-section">
      <span class="sph-label">Try asking</span>
      <div class="sph-kb-suggestions">
        <button class="sph-kb-suggestion-btn sph-cascade-item" style="animation-delay: 0ms" data-q="How do I schedule a mailing?">How do I schedule a mailing?</button>
        <button class="sph-kb-suggestion-btn sph-cascade-item" style="animation-delay: 60ms" data-q="What makes a good press release subject line?">What makes a good PR subject line?</button>
        <button class="sph-kb-suggestion-btn sph-cascade-item" style="animation-delay: 120ms" data-q="How do I import contacts?">How do I import contacts?</button>
      </div>
    </div>
    <div class="sph-section" style="margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(232, 181, 232, 0.15);">
      <span class="sph-label">Also available in mailings</span>
      <div style="font-size: 12px; color: var(--text-muted); line-height: 1.7;">
        <div>✉️ <strong>Subject Line Coach</strong> — click the subject field</div>
        <div>✨ <strong>Paragraph Coach</strong> — select text in the editor</div>
      </div>
    </div>
  `);

  $$('.sph-kb-suggestion-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handleKBQuestion(btn.dataset.q);
    });
  });

  const input = $('#kb-question-input');
  const askBtn = $('#kb-ask-btn');

  askBtn.addEventListener('click', () => {
    const q = input.value.trim();
    if (q) handleKBQuestion(q);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = input.value.trim();
      if (q) handleKBQuestion(q);
    }
  });

  input.focus();
}

async function handleKBQuestion(question) {
  if (kbBusy) return;
  kbBusy = true;

  // Add user message to conversation
  kbConversation.push({ role: 'user', text: question });

  // Show loading state with conversation history
  showKBConversation(true);

  try {
    const result = await window.SmartPRAPI.askKnowledgeBase(question, kbConversationId);

    // Store conversation_id for follow-ups
    kbConversationId = result.conversationId;

    // Add assistant response to conversation
    kbConversation.push({
      role: 'assistant',
      text: result.answer,
      citations: result.citations || []
    });

    showKBConversation(false);

  } catch (error) {
    // Remove the user message that failed
    kbConversation.pop();
    const errorMessage = window.SmartPRAPI.getErrorMessage(error);
    showKBConversation(false, errorMessage);
  } finally {
    kbBusy = false;
  }
}

async function showKBConversation(isLoading, errorMessage) {
  const messagesHTML = kbConversation.map((msg, i) => {
    if (msg.role === 'user') {
      return `
        <div class="sph-kb-message sph-kb-user sph-cascade-item" style="animation-delay: ${i * 40}ms">
          <div class="sph-kb-message-text">${escapeHTML(msg.text)}</div>
        </div>
      `;
    } else {
      return `
        <div class="sph-kb-message sph-kb-assistant sph-cascade-item" style="animation-delay: ${i * 40}ms">
          <div class="sph-kb-message-text">${renderKBMarkup(msg.text)}</div>
        </div>
      `;
    }
  }).join('');

  let loadingHTML = '';
  if (isLoading) {
    const kbMessages = PROGRESSIVE_MESSAGES.kb;
    loadingHTML = `
      <div class="sph-kb-message sph-kb-assistant">
        <div class="sph-kb-typing">
          <span class="sph-kb-typing-dot"></span>
          <span class="sph-kb-typing-dot"></span>
          <span class="sph-kb-typing-dot"></span>
        </div>
        <div class="sph-kb-loading-text">${kbMessages[0]}</div>
      </div>
    `;

    // Clear any previous timer
    if (loadingMessageTimer) {
      clearInterval(loadingMessageTimer);
      loadingMessageTimer = null;
    }

    // Cycle through progressive messages
    let msgIndex = 1;
    loadingMessageTimer = setInterval(() => {
      const el = getTopDocument().querySelector('.sph-kb-loading-text');
      if (el && msgIndex < kbMessages.length) {
        el.style.opacity = '0';
        setTimeout(() => {
          el.textContent = kbMessages[msgIndex];
          el.style.opacity = '1';
          msgIndex++;
        }, 200);
      }
      if (msgIndex >= kbMessages.length) {
        clearInterval(loadingMessageTimer);
        loadingMessageTimer = null;
      }
    }, 2500);
  } else {
    // Clear timer when loading ends
    if (loadingMessageTimer) {
      clearInterval(loadingMessageTimer);
      loadingMessageTimer = null;
    }
  }

  let errorHTML = '';
  if (errorMessage) {
    errorHTML = `
      <div class="sph-error" style="margin-bottom: 12px;">
        <div class="sph-error-text">${escapeHTML(errorMessage)}</div>
      </div>
    `;
  }

  await setContentWithTransition(`
    <div class="sph-kb-conversation" id="kb-conversation">
      ${messagesHTML}
      ${loadingHTML}
      ${errorHTML}
    </div>
    <div class="sph-section sph-kb-input-section">
      <div class="sph-kb-input-row">
        <input type="text" id="kb-question-input" class="sph-input sph-kb-input" placeholder="Ask a follow-up..." ${isLoading ? 'disabled' : ''}>
        <button class="sph-kb-ask-btn" id="kb-ask-btn" ${isLoading ? 'disabled' : ''}>Ask</button>
      </div>
      <div class="sph-kb-actions-row">
        <button class="sph-kb-new-btn" id="kb-new-btn">New conversation</button>
      </div>
    </div>
  `);

  // Scroll conversation to bottom
  const convoEl = $('#kb-conversation');
  if (convoEl) {
    convoEl.scrollTop = convoEl.scrollHeight;
  }

  const input = $('#kb-question-input');
  const askBtn = $('#kb-ask-btn');
  const newBtn = $('#kb-new-btn');

  if (!isLoading) {
    askBtn.addEventListener('click', () => {
      const q = input.value.trim();
      if (q) handleKBQuestion(q);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = input.value.trim();
        if (q) handleKBQuestion(q);
      }
    });

    input.focus();
  }

  newBtn.addEventListener('click', () => {
    kbConversation = [];
    kbConversationId = null;
    showKBEmptyState();
  });
}

function renderKBMarkup(text) {
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
    if (!trimmed) {
      closeList();
      continue;
    }
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

function startEditorSelectionWatcher() {
  stopSelectionTracking(); // Clear any existing

  try {
    const iframeDoc = editorIframe?.contentDocument || editorIframe?.contentWindow?.document;
    const iframeWin = editorIframe?.contentWindow;
    if (!iframeDoc || !iframeWin) return;

    const handleSelection = () => {
      if (selectionUpdateTimer) clearTimeout(selectionUpdateTimer);
      selectionUpdateTimer = setTimeout(() => {
        if (currentSidebarMode !== 'paragraph') return;
        const selection = iframeWin.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

        const anchorNode = selection.anchorNode;
        const anchorElement = anchorNode && anchorNode.nodeType === 1
          ? anchorNode : anchorNode?.parentElement;
        const editor = anchorElement?.closest('.tiptap.ProseMirror') || anchorElement?.closest('.mce-content-body');
        if (!editor) return;

        selectedText = selection.toString().trim();
        selectedEditor = editor;
        selectedEditorDoc = iframeDoc;
        currentSelection = selection.getRangeAt(0).cloneRange();
        showParagraphCoachContent();
        startSelectionTracking();
      }, 200);
    };

    iframeDoc.addEventListener('selectionchange', handleSelection);
    iframeDoc._sphSelectionHandler = handleSelection;

    // Also watch heading inputs — they don't fire selectionchange
    const headingInputs = findHeadingInputs(iframeDoc);
    const headingHandler = (e) => {
      const input = e.target;
      if (!input.value?.trim()) return;
      if (selectionUpdateTimer) clearTimeout(selectionUpdateTimer);
      selectionUpdateTimer = setTimeout(() => {
        if (currentSidebarMode !== 'paragraph') return;
        selectedText = input.value.trim();
        selectedEditor = input;
        selectedEditorDoc = iframeDoc;
        currentSelection = null;
        showParagraphCoachContent();
        startSelectionTracking();
      }, 200);
    };
    headingInputs.forEach(input => {
      input.addEventListener('focus', headingHandler);
    });
    iframeDoc._sphHeadingInputs = headingInputs;
    iframeDoc._sphHeadingHandler = headingHandler;
  } catch (e) {
    console.warn('[Smart.pr Helper] Could not set up editor selection watcher:', e);
  }
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

  // Listen for selection changes (covers TipTap/contenteditable blocks)
  editorDoc.addEventListener('selectionchange', handleSelectionChange);
  editorDoc._sphSelectionHandler = handleSelectionChange;

  // Also watch heading inputs — they don't fire selectionchange on the document
  const headingInputs = findHeadingInputs(editorDoc);
  const headingHandler = (e) => {
    const input = e.target;
    if (input !== selectedEditor) {
      selectedEditor = input;
      selectedEditorDoc = editorDoc;
    }
    if (selectionUpdateTimer) clearTimeout(selectionUpdateTimer);
    selectionUpdateTimer = setTimeout(() => {
      updateSelectedTextFromEditor();
    }, 150);
  };

  headingInputs.forEach(input => {
    input.addEventListener('focus', headingHandler);
    input.addEventListener('select', headingHandler);
    input.addEventListener('keyup', headingHandler);
  });
  editorDoc._sphHeadingInputs = headingInputs;
  editorDoc._sphHeadingHandler = headingHandler;
}

function stopSelectionTracking() {
  if (selectionUpdateTimer) {
    clearTimeout(selectionUpdateTimer);
    selectionUpdateTimer = null;
  }

  // Clean up selectionchange listener
  if (selectedEditorDoc && selectedEditorDoc._sphSelectionHandler) {
    selectedEditorDoc.removeEventListener('selectionchange', selectedEditorDoc._sphSelectionHandler);
    delete selectedEditorDoc._sphSelectionHandler;
  }

  // Clean up heading input listeners
  if (selectedEditorDoc && selectedEditorDoc._sphHeadingInputs && selectedEditorDoc._sphHeadingHandler) {
    selectedEditorDoc._sphHeadingInputs.forEach(input => {
      input.removeEventListener('focus', selectedEditorDoc._sphHeadingHandler);
      input.removeEventListener('select', selectedEditorDoc._sphHeadingHandler);
      input.removeEventListener('keyup', selectedEditorDoc._sphHeadingHandler);
    });
    delete selectedEditorDoc._sphHeadingInputs;
    delete selectedEditorDoc._sphHeadingHandler;
  }
}

function updateSelectedTextFromEditor() {
  if (!selectedEditor || currentSidebarMode !== 'paragraph') return;

  const editorDoc = selectedEditorDoc || selectedEditor.ownerDocument || document;
  const editorWin = editorDoc.defaultView || window;
  let newText = '';

  // Check if focus/selection has moved to a different block
  const activeElement = editorDoc.activeElement;
  const selection = editorWin?.getSelection();
  const anchorNode = selection?.anchorNode;
  const anchorElement = anchorNode && anchorNode.nodeType === 1
    ? anchorNode : anchorNode?.parentElement;

  // Detect if we've moved into a heading input
  const isHeadingInput = activeElement?.tagName === 'INPUT' &&
    activeElement.closest('.block-wrapper') &&
    (activeElement.closest('h1') || activeElement.closest('h2'));

  if (isHeadingInput && activeElement !== selectedEditor) {
    // Switched to a heading input
    selectedEditor = activeElement;
    selectedEditorDoc = editorDoc;
  }

  // Detect if we've moved into a different TipTap/TinyMCE block
  const activeContentEditor = anchorElement?.closest('.tiptap.ProseMirror') || anchorElement?.closest('.mce-content-body');
  if (activeContentEditor && activeContentEditor !== selectedEditor) {
    selectedEditor = activeContentEditor;
    selectedEditorDoc = activeContentEditor.ownerDocument || selectedEditorDoc;
  }

  // Now read text from whichever editor is current
  const isInputElement = selectedEditor.tagName === 'INPUT';

  if (isInputElement) {
    const selStart = selectedEditor.selectionStart;
    const selEnd = selectedEditor.selectionEnd;
    if (selStart !== selEnd) {
      newText = selectedEditor.value.substring(selStart, selEnd).trim();
    } else {
      newText = selectedEditor.value?.trim() || '';
    }
    currentSelection = null;
  } else {
    if (selection && !selection.isCollapsed && selectedEditor.contains(selection.anchorNode)) {
      newText = selection.toString().trim();
      currentSelection = selection.getRangeAt(0).cloneRange();
    } else {
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

  // Also update the block type label when switching between blocks
  const label = selectedTextDisplay.previousElementSibling;
  if (label && label.classList.contains('sph-label')) {
    const container = selectedEditor ? selectedEditor.closest('.block-wrapper') : null;
    const blockType = container ? getBlockType(container) : 'text';
    const typeLabel = blockType === 'heading' ? 'Heading' : blockType === 'subheading' ? 'Subheading' : 'Text';
    label.textContent = `Selected ${typeLabel}`;
  }
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

async function showParagraphCoachContent() {
  if (extensionDisabled) return;

  // V2: Get block type from the editor's .block-wrapper container
  const container = selectedEditor ? selectedEditor.closest('.block-wrapper') : null;
  const blockType = container ? getBlockType(container) : 'text';
  const typeLabel = blockType === 'heading' ? 'Heading' : blockType === 'subheading' ? 'Subheading' : 'Text';

  // Truncate long text for display
  const displayText = selectedText.length > 200
    ? selectedText.substring(0, 200) + '...'
    : selectedText;

  await setContentWithTransition(`
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
  `);

  // Attach event listeners
  $('#action-grammar').addEventListener('click', () => handleParagraphAction('grammar'));
  $('#action-rephrase').addEventListener('click', () => showToneSelector());
  $('#action-synonyms').addEventListener('click', () => handleParagraphAction('synonyms'));
  $('#action-translate').addEventListener('click', () => showTranslateOptions());
  $('#action-shorter').addEventListener('click', () => handleParagraphAction('shorter'));
}

async function showToneSelector() {
  const displayText = selectedText.length > 150
    ? selectedText.substring(0, 150) + '...'
    : selectedText;

  await setContentWithTransition(`
    <div class="sph-section">
      <span class="sph-label">Selected Text</span>
      <div class="sph-current-subject">${escapeHTML(displayText)}</div>
    </div>
    <div class="sph-section">
      <button class="sph-button" id="rephrase-no-tone-btn">
        Rephrase
      </button>
    </div>
    <div class="sph-section">
      <span class="sph-label">Or pick a tone</span>
      <div class="sph-tone-buttons">
        <button class="sph-tone-btn" data-tone="formal">Formal</button>
        <button class="sph-tone-btn" data-tone="friendly">Friendly</button>
        <button class="sph-tone-btn" data-tone="persuasive">Persuasive</button>
        <button class="sph-tone-btn" data-tone="concise">Concise</button>
      </div>
    </div>
    <div class="sph-section">
      <button class="sph-button sph-button-secondary" id="back-to-actions-btn">
        ← Back
      </button>
    </div>
  `);

  $('#rephrase-no-tone-btn').addEventListener('click', () => {
    handleParagraphAction('rephrase');
  });

  $$('.sph-tone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      handleParagraphAction('rephrase', { tone: btn.dataset.tone });
    });
  });

  $('#back-to-actions-btn').addEventListener('click', () => {
    showParagraphCoachContent();
  });
}

async function showTranslateOptions() {
  const displayText = selectedText.length > 150
    ? selectedText.substring(0, 150) + '...'
    : selectedText;

  await setContentWithTransition(`
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
  `);

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

    showLoadingState(loadingMessage, action);

    // Gather surrounding text as language context for the API
    if (selectedEditor && !options.context) {
      try {
        const doc = selectedEditorDoc || selectedEditor.ownerDocument || document;
        const blocks = findAllEditableBlocks(doc);
        const contextParts = blocks.map(b =>
          b.element.value !== undefined ? b.element.value : b.element.innerText
        ).filter(t => t && t.trim());
        const context = contextParts.join('\n').trim();
        if (context && context !== text) {
          options.context = context.substring(0, 500);
        }
      } catch (e) { /* context is best-effort */ }
    }

    const result = await window.SmartPRAPI.processParagraph(text, action, options);

    // Stop progressive loading messages
    if (loadingMessageTimer) {
      clearInterval(loadingMessageTimer);
      loadingMessageTimer = null;
    }

    if (action === 'synonyms') {
      showSynonymResult(result);
    } else if (action === 'rephrase') {
      showRephraseResult(result);
    } else if (action === 'grammar') {
      showGrammarResult(result);
    } else if (action === 'shorter') {
      showShorterResult(result);
    } else {
      showParagraphResult(result.text, action, options);
    }
    showToast('✨ Done!');

  } catch (error) {
    if (loadingMessageTimer) {
      clearInterval(loadingMessageTimer);
      loadingMessageTimer = null;
    }
    console.error('[Smart.pr Helper] Paragraph action error:', error);
    const errorMessage = window.SmartPRAPI.getErrorMessage(error);
    showParagraphError(errorMessage, action, options);
  }
}

async function showParagraphResult(resultText, action, options = {}) {
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

  await setContentWithTransition(`
    <div class="sph-section">
      <span class="sph-label">Original</span>
      <div class="sph-original-text">${escapeHTML(originalDisplay)}</div>
    </div>
    <div class="sph-section">
      <span class="sph-label">${escapeHTML(actionLabel)}</span>
      <div class="sph-result-text" id="paragraph-result-text"></div>
    </div>
    <div class="sph-section sph-result-actions">
      <button class="sph-button" id="replace-text-btn" disabled>
        Replace in Editor
      </button>
      <button class="sph-button sph-button-secondary" id="copy-result-btn" disabled>
        Copy to Clipboard
      </button>
      <button class="sph-button sph-button-secondary" id="try-another-btn">
        ← Try Another Action
      </button>
    </div>
  `);

  // Typewriter effect
  const resultEl = $('#paragraph-result-text');
  const replaceBtn = $('#replace-text-btn');
  const copyBtn = $('#copy-result-btn');

  typewriterEffect(resultEl, resultText).then(() => {
    replaceBtn.disabled = false;
    copyBtn.disabled = false;
  });

  // Replace button
  replaceBtn.addEventListener('click', () => {
    replaceTextInEditor(resultText);
  });

  // Copy button
  copyBtn.addEventListener('click', async () => {
    await copyToClipboard(resultText);
    triggerSparkle(copyBtn);
    copyBtn.textContent = '✓ Copied';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = 'Copy';
      copyBtn.classList.remove('copied');
    }, 2000);
  });

  // Back button
  $('#try-another-btn').addEventListener('click', () => {
    showParagraphCoachContent();
  });
}

function parseSynonymsFromText(text) {
  const suggestions = [];
  const lines = text.split('\n').filter(l => l.trim());

  for (const line of lines) {
    // Handle "original → syn1, syn2, syn3" format
    if (line.includes('\u2192') || line.includes('->')) {
      const arrowParts = line.split(/\u2192|->/).map(s => s.trim());
      if (arrowParts.length >= 2) {
        const syns = arrowParts[1].split(',').map(s => s.trim()).filter(Boolean);
        suggestions.push(...syns);
        continue;
      }
    }

    // Handle numbered list "1. suggestion" or "- suggestion"
    const listMatch = line.match(/^(?:\d+[.)]\s*|-\s*|\*\s*)(.+)/);
    if (listMatch) {
      suggestions.push(listMatch[1].trim());
      continue;
    }
  }

  // If nothing parsed, try comma separation on the whole text
  if (suggestions.length === 0) {
    const commaList = text.split(',').map(s => s.trim()).filter(Boolean);
    if (commaList.length > 1) {
      suggestions.push(...commaList);
    }
  }

  // Last resort: return the whole text as a single suggestion
  if (suggestions.length === 0 && text.trim()) {
    suggestions.push(text.trim());
  }

  return suggestions;
}

async function showSynonymResult(result) {
  const content = $('#sph-content');

  // Prefer structured synonyms array from API, fall back to text parsing
  const suggestions = result.synonyms || parseSynonymsFromText(result.text);

  const originalDisplay = selectedText.length > 100
    ? selectedText.substring(0, 100) + '...'
    : selectedText;

  const synonymOptionsHTML = suggestions.map((syn, i) => `
    <div class="sph-synonym-option sph-cascade-item" style="animation-delay: ${i * 60}ms">
      <span class="sph-synonym-text">${escapeHTML(syn)}</span>
      <div class="sph-synonym-actions">
        <button class="sph-synonym-btn sph-synonym-copy" data-index="${i}" title="Copy to clipboard">
          Copy
        </button>
        <button class="sph-synonym-btn sph-synonym-inject" data-index="${i}" title="Replace in editor">
          Inject
        </button>
      </div>
    </div>
  `).join('');

  await setContentWithTransition(`
    <div class="sph-section">
      <span class="sph-label">Original</span>
      <div class="sph-original-text">${escapeHTML(originalDisplay)}</div>
    </div>
    <div class="sph-section">
      <span class="sph-label">Synonym Suggestions</span>
      <div class="sph-synonym-list">
        ${synonymOptionsHTML}
      </div>
    </div>
    <div class="sph-section sph-result-actions">
      <button class="sph-button sph-button-secondary" id="try-another-btn">
        \u2190 Try Another Action
      </button>
    </div>
  `);

  // Attach event listeners for each synonym option
  content.querySelectorAll('.sph-synonym-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index);
      await copyToClipboard(suggestions[index]);
      triggerSparkle(btn);
      btn.textContent = '\u2713';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });

  content.querySelectorAll('.sph-synonym-inject').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      triggerSparkle(btn);
      replaceTextInEditor(suggestions[index]);
    });
  });

  // Back button
  $('#try-another-btn').addEventListener('click', () => {
    showParagraphCoachContent();
  });
}

function parseRephraseFromText(text) {
  const options = [];
  const lines = text.split('\n').filter(l => l.trim());

  for (const line of lines) {
    // Handle numbered list "1. option" or "- option"
    const listMatch = line.match(/^(?:\d+[.)]\s*|-\s*|\*\s*)(.+)/);
    if (listMatch) {
      options.push(listMatch[1].trim());
      continue;
    }
  }

  // If no list format found, treat whole text as a single option
  if (options.length === 0 && text.trim()) {
    options.push(text.trim());
  }

  return options;
}

async function showRephraseResult(result) {
  const content = $('#sph-content');

  const options = result.rephraseOptions || parseRephraseFromText(result.text);

  const originalDisplay = selectedText.length > 100
    ? selectedText.substring(0, 100) + '...'
    : selectedText;

  const optionsHTML = options.map((opt, i) => `
    <div class="sph-synonym-option sph-rephrase-option sph-cascade-item" style="animation-delay: ${i * 60}ms">
      <span class="sph-synonym-text">${escapeHTML(opt)}</span>
      <div class="sph-synonym-actions">
        <button class="sph-synonym-btn sph-synonym-copy" data-index="${i}" title="Copy to clipboard">
          Copy
        </button>
        <button class="sph-synonym-btn sph-synonym-inject" data-index="${i}" title="Replace in editor">
          Inject
        </button>
      </div>
    </div>
  `).join('');

  await setContentWithTransition(`
    <div class="sph-section">
      <span class="sph-label">Original</span>
      <div class="sph-original-text">${escapeHTML(originalDisplay)}</div>
    </div>
    <div class="sph-section">
      <span class="sph-label">Rephrase Options</span>
      <div class="sph-synonym-list">
        ${optionsHTML}
      </div>
    </div>
    <div class="sph-section sph-result-actions">
      <button class="sph-button sph-button-secondary" id="try-another-btn">
        \u2190 Try Another Action
      </button>
    </div>
  `);

  content.querySelectorAll('.sph-synonym-copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const index = parseInt(btn.dataset.index);
      await copyToClipboard(options[index]);
      triggerSparkle(btn);
      btn.textContent = '\u2713';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });

  content.querySelectorAll('.sph-synonym-inject').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      triggerSparkle(btn);
      replaceTextInEditor(options[index]);
    });
  });

  $('#try-another-btn').addEventListener('click', () => {
    showParagraphCoachContent();
  });
}

async function showGrammarResult(result) {
  const originalDisplay = selectedText.length > 100
    ? selectedText.substring(0, 100) + '...'
    : selectedText;

  // Build diff-highlighted HTML for corrected text
  const diff = diffWords(selectedText, result.text);
  const diffHTML = renderDiffHTML(diff);

  let changesHTML = '';
  if (result.changes && result.changes.length > 0) {
    const items = result.changes.map((c, i) => `<li class="sph-change-item sph-cascade-item" style="animation-delay: ${i * 60}ms">${escapeHTML(c)}</li>`).join('');
    changesHTML = `
      <div class="sph-section">
        <span class="sph-label">Changes Made</span>
        <ul class="sph-changes-list">${items}</ul>
      </div>
    `;
  }

  await setContentWithTransition(`
    <div class="sph-section">
      <span class="sph-label">Original</span>
      <div class="sph-original-text">${escapeHTML(originalDisplay)}</div>
    </div>
    <div class="sph-section">
      <span class="sph-label">Corrected Text</span>
      <div class="sph-result-text" id="grammar-result-text">${diffHTML}</div>
    </div>
    ${changesHTML}
    <div class="sph-section sph-result-actions">
      <button class="sph-button" id="replace-text-btn" disabled>
        Replace in Editor
      </button>
      <button class="sph-button sph-button-secondary" id="copy-result-btn" disabled>
        Copy to Clipboard
      </button>
      <button class="sph-button sph-button-secondary" id="try-another-btn">
        \u2190 Try Another Action
      </button>
    </div>
  `);

  // Typewriter effect on the result text
  const resultEl = $('#grammar-result-text');
  const replaceBtn = $('#replace-text-btn');
  const copyBtn = $('#copy-result-btn');

  typewriterEffect(resultEl, result.text).then(() => {
    // After typewriter completes, swap in the diff-highlighted version
    resultEl.innerHTML = diffHTML;
    replaceBtn.disabled = false;
    copyBtn.disabled = false;
  });

  replaceBtn.addEventListener('click', () => {
    replaceTextInEditor(result.text);
  });

  copyBtn.addEventListener('click', async () => {
    await copyToClipboard(result.text);
    triggerSparkle(copyBtn);
    copyBtn.textContent = '\u2713 Copied';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = 'Copy to Clipboard';
      copyBtn.classList.remove('copied');
    }, 2000);
  });

  $('#try-another-btn').addEventListener('click', () => {
    showParagraphCoachContent();
  });
}

async function showShorterResult(result) {
  const originalDisplay = selectedText.length > 100
    ? selectedText.substring(0, 100) + '...'
    : selectedText;

  const originalWordCount = selectedText.trim().split(/\s+/).filter(Boolean).length;
  const newWordCount = result.text.trim().split(/\s+/).filter(Boolean).length;

  await setContentWithTransition(`
    <div class="sph-section">
      <span class="sph-label">Original</span>
      <div class="sph-original-text">${escapeHTML(originalDisplay)}</div>
    </div>
    <div class="sph-section">
      <span class="sph-label">Shortened Text</span>
      <div class="sph-word-count-badge">${originalWordCount} \u2192 ${newWordCount} words</div>
      <div class="sph-result-text" id="shorter-result-text"></div>
    </div>
    <div class="sph-section sph-result-actions">
      <button class="sph-button" id="replace-text-btn" disabled>
        Replace in Editor
      </button>
      <button class="sph-button sph-button-secondary" id="copy-result-btn" disabled>
        Copy to Clipboard
      </button>
      <button class="sph-button sph-button-secondary" id="try-another-btn">
        \u2190 Try Another Action
      </button>
    </div>
  `);

  // Typewriter effect
  const resultEl = $('#shorter-result-text');
  const replaceBtn = $('#replace-text-btn');
  const copyBtn = $('#copy-result-btn');

  typewriterEffect(resultEl, result.text).then(() => {
    replaceBtn.disabled = false;
    copyBtn.disabled = false;
  });

  replaceBtn.addEventListener('click', () => {
    replaceTextInEditor(result.text);
  });

  copyBtn.addEventListener('click', async () => {
    await copyToClipboard(result.text);
    triggerSparkle(copyBtn);
    copyBtn.textContent = '\u2713 Copied';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = 'Copy to Clipboard';
      copyBtn.classList.remove('copied');
    }, 2000);
  });

  $('#try-another-btn').addEventListener('click', () => {
    showParagraphCoachContent();
  });
}

async function showParagraphError(message, action, options) {
  await setContentWithTransition(`
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
  `);

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

    // Save undo state before replacing
    undoState = {
      editor: selectedEditor,
      editorDoc: selectedEditorDoc || selectedEditor.ownerDocument || document,
      originalText: isInputElement ? selectedEditor.value : selectedText,
      newText: newText,
      isInput: isInputElement
    };

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

    // Sparkle from the replace button that triggered this
    const replaceBtn = $('#replace-text-btn');
    if (replaceBtn) triggerSparkle(replaceBtn);

    // Show undo toast instead of regular toast
    showUndoToast();

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

function showUndoToast() {
  if (extensionDisabled) return;
  const topDoc = getTopDocument();

  // Remove any existing undo toast
  const existing = topDoc.querySelector('.sph-undo-toast');
  if (existing) existing.remove();
  if (undoToastTimer) clearTimeout(undoToastTimer);

  const toast = topDoc.createElement('div');
  toast.className = 'sph-toast sph-undo-toast';
  toast.innerHTML = `
    <span>✓ Text replaced</span>
    <button class="sph-undo-btn">Undo</button>
  `;
  topDoc.body.appendChild(toast);

  toast.querySelector('.sph-undo-btn').addEventListener('click', () => {
    performUndo();
    toast.remove();
  });

  undoToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
    undoState = null;
  }, 5000);
}

function performUndo() {
  if (!undoState) return;
  const { editor, editorDoc, originalText, newText, isInput } = undoState;

  try {
    if (isInput) {
      editor.focus();
      editor.value = originalText;
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const editorWin = editorDoc.defaultView || window;
      editor.focus();

      // Find the newText in the editor DOM and select it, then replace with original
      const range = findTextRange(editor, newText, editorDoc);
      if (range) {
        const sel = editorWin.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        editorDoc.execCommand('insertText', false, originalText);
      } else {
        showToast('Could not find text to undo.');
        undoState = null;
        return;
      }
    }
    showToast('↩ Undone!');
  } catch (e) {
    console.error('[Smart.pr Helper] Undo error:', e);
    showToast('Undo failed.');
  }
  undoState = null;
  if (undoToastTimer) clearTimeout(undoToastTimer);
}

// Walk text nodes to find a string and return a DOM Range spanning it
function findTextRange(rootNode, searchText, doc) {
  const walker = doc.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let fullText = '';

  while (walker.nextNode()) {
    textNodes.push({ node: walker.currentNode, offset: fullText.length });
    fullText += walker.currentNode.textContent;
  }

  const idx = fullText.indexOf(searchText);
  if (idx === -1) return null;

  const endIdx = idx + searchText.length;
  const range = doc.createRange();

  for (const { node, offset } of textNodes) {
    const nodeEnd = offset + node.textContent.length;
    if (offset <= idx && idx < nodeEnd) {
      range.setStart(node, idx - offset);
      break;
    }
  }

  for (const { node, offset } of textNodes) {
    const nodeEnd = offset + node.textContent.length;
    if (offset < endIdx && endIdx <= nodeEnd) {
      range.setEnd(node, endIdx - offset);
      break;
    }
  }

  return range;
}

// ========== Subject Line Sidebar States ==========
async function showEmptyState() {
  if (extensionDisabled) return;
  await setContentWithTransition(`
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
  `);

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

async function showFilledState(currentSubject) {
  if (extensionDisabled) return;
  await setContentWithTransition(`
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
  `);

  const feedbackBtn = $('#get-feedback-btn');
  feedbackBtn.addEventListener('click', () => getFeedback(currentSubject));

  const altBtn = $('#generate-alternatives-btn');
  altBtn.addEventListener('click', () => generateSubjectSuggestions(currentSubject));
}

const PROGRESSIVE_MESSAGES = {
  grammar: [
    'Checking spelling & grammar...',
    'Scanning for typos...',
    'Polishing your prose...',
    'Almost there...'
  ],
  rephrase: [
    'Rephrasing paragraph...',
    'Exploring different angles...',
    'Crafting alternatives...',
    'Putting finishing touches...'
  ],
  synonyms: [
    'Finding synonyms...',
    'Searching the thesaurus...',
    'Picking the best words...',
    'Almost ready...'
  ],
  translate: [
    'Translating text...',
    'Finding the right words...',
    'Preserving meaning...',
    'Wrapping up...'
  ],
  shorter: [
    'Making text shorter...',
    'Trimming the excess...',
    'Keeping what matters...',
    'Nearly done...'
  ],
  kb: [
    'Let me look that up...',
    'Going through the details...',
    'Putting together an answer...',
    'One moment...'
  ],
  default: [
    'Processing...',
    'Working on it...',
    'Hang tight...',
    'Almost there...'
  ]
};

function showLoadingState(message = 'Generating suggestions...', action = null) {
  const content = $('#sph-content');
  let skeletonHTML = '';

  // Clear any previous loading message timer
  if (loadingMessageTimer) {
    clearInterval(loadingMessageTimer);
    loadingMessageTimer = null;
  }

  if (action === 'synonyms' || action === 'rephrase') {
    skeletonHTML = `
      <div class="sph-skeleton sph-skeleton-label"></div>
      <div class="sph-skeleton sph-skeleton-card sph-cascade-item" style="animation-delay: 0ms"></div>
      <div class="sph-skeleton sph-skeleton-card sph-cascade-item" style="animation-delay: 100ms"></div>
      <div class="sph-skeleton sph-skeleton-card sph-cascade-item" style="animation-delay: 200ms"></div>
    `;
  } else if (action === 'grammar' || action === 'translate' || action === 'shorter') {
    skeletonHTML = `
      <div class="sph-skeleton sph-skeleton-label"></div>
      <div class="sph-skeleton sph-skeleton-text"></div>
    `;
  }

  content.innerHTML = `
    <div class="sph-loading">
      ${skeletonHTML || '<div class="sph-spinner"></div>'}
      <div class="sph-loading-text">${message}</div>
    </div>
  `;

  // Start cycling through progressive messages
  const messages = PROGRESSIVE_MESSAGES[action] || PROGRESSIVE_MESSAGES.default;
  let msgIndex = 1; // Start at 1 since initial message is already shown
  loadingMessageTimer = setInterval(() => {
    const loadingTextEl = content.querySelector('.sph-loading-text');
    if (loadingTextEl && msgIndex < messages.length) {
      loadingTextEl.style.opacity = '0';
      loadingTextEl.style.transition = 'opacity 0.2s ease';
      setTimeout(() => {
        loadingTextEl.textContent = messages[msgIndex];
        loadingTextEl.style.opacity = '1';
        msgIndex++;
      }, 200);
    }
    if (msgIndex >= messages.length) {
      clearInterval(loadingMessageTimer);
      loadingMessageTimer = null;
    }
  }, 2500);
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

async function showSuggestions(suggestions, originalSubject = null) {
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
          <div class="sph-suggestion-item sph-cascade-item" style="animation-delay: ${i * 60}ms">
            <div class="sph-suggestion-text">${escapeHTML(suggestion)}</div>
            <div class="sph-suggestion-actions">
              <button class="sph-use-button" data-text="${escapeHTML(suggestion)}">
                Use
              </button>
              <button class="sph-copy-button" data-text="${escapeHTML(suggestion)}">
                Copy
              </button>
            </div>
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

  await setContentWithTransition(html);

  // Add "Use" (inject) button handlers
  $$('.sph-use-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.text;
      if (subjectField) {
        // Set the value using React-compatible event dispatching
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(subjectField, text);
        subjectField.dispatchEvent(new Event('input', { bubbles: true }));
        subjectField.dispatchEvent(new Event('change', { bubbles: true }));
        lastSubjectValue = text;
        triggerSparkle(btn);
        btn.textContent = '✓ Done';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Use';
          btn.classList.remove('copied');
        }, 2000);
      }
    });
  });

  // Add copy button handlers
  $$('.sph-copy-button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const text = btn.dataset.text;
      await copyToClipboard(text);
      triggerSparkle(btn);

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

// ========== Magic UX Utilities ==========

// #12 View Transitions
function setContentWithTransition(html) {
  return new Promise((resolve) => {
    const content = $('#sph-content');
    content.style.opacity = '0';
    content.style.transition = 'opacity 0.1s ease';
    setTimeout(() => {
      content.innerHTML = html;
      content.style.opacity = '';
      content.style.transition = '';
      content.classList.remove('sph-view-enter');
      void content.offsetWidth; // force reflow
      content.classList.add('sph-view-enter');
      resolve();
    }, 100);
  });
}

// #4 Sparkle Burst
function triggerSparkle(buttonElement) {
  if (!buttonElement) return;
  const rect = buttonElement.getBoundingClientRect();
  const topDoc = getTopDocument();
  const colors = ['#FFD580', '#FFBC7F', '#FFB0C0', '#E8B5E8', '#D4A5F5', '#34D399'];

  for (let i = 0; i < 7; i++) {
    const spark = topDoc.createElement('div');
    spark.className = 'sph-sparkle';
    const angle = (i / 7) * Math.PI * 2;
    const distance = 20 + Math.random() * 25;
    spark.style.setProperty('--sx', `${Math.cos(angle) * distance}px`);
    spark.style.setProperty('--sy', `${Math.sin(angle) * distance}px`);
    spark.style.left = `${rect.left + rect.width / 2 - 3}px`;
    spark.style.top = `${rect.top + rect.height / 2 - 3}px`;
    spark.style.position = 'fixed';
    spark.style.background = colors[i % colors.length];
    topDoc.body.appendChild(spark);
    setTimeout(() => spark.remove(), 550);
  }
}

// #11 Typewriter Effect
function typewriterEffect(element, text, speed = 18) {
  return new Promise((resolve) => {
    const words = text.split(/(\s+)/); // preserve whitespace
    let i = 0;
    element.textContent = '';
    const cursor = document.createElement('span');
    cursor.className = 'sph-typing-cursor';
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

// #6 Word-Level Diff
function diffWords(original, corrected) {
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
    // Check if this word matches the original at roughly the same position
    if (oi < origWords.length && origWords[oi] === word) {
      result.push({ text: word, changed: false });
      oi++;
    } else {
      // Skip whitespace in original
      while (oi < origWords.length && !origWords[oi].trim()) oi++;
      if (oi < origWords.length && origWords[oi] === word) {
        result.push({ text: word, changed: false });
        oi++;
      } else {
        result.push({ text: word, changed: true });
        // Try to advance original past the changed word
        if (oi < origWords.length) oi++;
      }
    }
  }
  return result;
}

function renderDiffHTML(diffResult) {
  return diffResult.map(seg =>
    seg.changed
      ? `<span class="sph-diff-highlight">${escapeHTML(seg.text)}</span>`
      : escapeHTML(seg.text)
  ).join('');
}

// #5 Smart Contextual Greetings
function getNudgeMessage(type) {
  const hour = new Date().getHours();
  let greeting;
  if (hour >= 5 && hour < 12) {
    greeting = 'Good morning!';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Hey there!';
  } else {
    greeting = 'Still working?';
  }

  if (type === 'empty') {
    return `${greeting} Need help writing a subject line?`;
  }
  return `${greeting} Want feedback on your subject line?`;
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

// ========== Message Handler for Popup ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle messages in the top frame (not blob iframes or BeePlugin)
  if (!isTopFrame) return false;

  if (message.type === 'getContext') {
    sendResponse(detectCurrentContext());
    return true;
  }

  if (message.type === 'setSubjectValue') {
    const field = subjectField || findSubjectField();
    if (field) {
      field.focus();
      field.value = message.value;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
    return true;
  }

  if (message.type === 'captureEditorSelection') {
    // Capture the current selection so it can be replaced later
    if (!editorIframe) { sendResponse({ success: false }); return true; }
    try {
      const iframeDoc = editorIframe.contentDocument || editorIframe.contentWindow?.document;
      const iframeWin = editorIframe.contentWindow;
      const selection = iframeWin?.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim()) {
        const anchorElement = (selection.anchorNode?.nodeType === 1
          ? selection.anchorNode
          : selection.anchorNode?.parentElement);
        const editor = anchorElement?.closest('.tiptap.ProseMirror') || anchorElement?.closest('.mce-content-body');
        if (editor) {
          selectedText = selection.toString().trim();
          selectedEditor = editor;
          selectedEditorDoc = iframeDoc;
          currentSelection = selection.getRangeAt(0).cloneRange();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
      } else {
        sendResponse({ success: false });
      }
    } catch (e) {
      sendResponse({ success: false });
    }
    return true;
  }

  if (message.type === 'replaceEditorText') {
    if (selectedEditor) {
      replaceTextInEditor(message.value);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
    return true;
  }
});

function getEditorSelectionText(iframe) {
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    const iframeWin = iframe.contentWindow;
    if (!iframeDoc || !iframeWin) return '';
    const selection = iframeWin.getSelection();
    if (selection && !selection.isCollapsed) {
      const text = selection.toString().trim();
      if (text) return text;
    }
  } catch (e) {
    // Cross-origin or other access error
  }
  return '';
}

function detectCurrentContext() {
  if (extensionDisabled) return { mode: 'disabled', onSmartPr: true };

  // Only use tracked state set by the dialog watcher (not broad DOM searches
  // which can match unrelated inputs on the page)

  // Check for editor first (highest priority — when the editor is open,
  // the paragraph coach is the main tool the user needs)

  // Check for classic editor (only if already tracked and still in DOM)
  if (editorIframe && editorIframe.isConnected) {
    const selText = getEditorSelectionText(editorIframe);
    return { mode: 'editor', selectedText: selText || '', onSmartPr: true };
  }

  // Check for pro editor (BeePlugin iframe)
  const beeIframes = document.querySelectorAll('iframe[src*="getbee.io"]');
  if (beeIframes.length > 0) {
    return { mode: 'editor', selectedText: '', onSmartPr: true };
  }

  // Check for subject field (only if already detected and still in DOM)
  if (subjectField && subjectField.isConnected && !subjectField.disabled && !subjectField.readOnly) {
    return { mode: 'subject', value: subjectField.value.trim(), onSmartPr: true };
  }

  return { mode: 'none', onSmartPr: true };
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
