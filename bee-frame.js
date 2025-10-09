(() => {
  const PLACEHOLDER = "I'm a new paragraph block.";
  const STATUS_EVENT = 'SPR_PARAGRAPH_FRAME_STATUS';
  const APPLY_EVENT = 'SPR_PARAGRAPH_APPLY';
  const APPLY_RESULT_EVENT = 'SPR_PARAGRAPH_APPLY_RESULT';
  const parentOrigin = (() => {
    try {
      const ref = document.referrer ? new URL(document.referrer).origin : '*';
      return ref || '*';
    } catch {
      return '*';
    }
  })();

  const instrumentedEditors = typeof WeakSet === 'function' ? new WeakSet() : null;

  function postToParent(payload) {
    try {
      window.parent.postMessage(payload, parentOrigin);
    } catch (err) {
      console.debug('[Smartpr Labs][BeeFrame] postMessage failed', err);
    }
  }

  function stripText(value) {
    return (value || '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getActiveEditor() {
    if (window.tinymce && window.tinymce.activeEditor) {
      return window.tinymce.activeEditor;
    }
    if (window.tinymce && Array.isArray(window.tinymce.editors)) {
      return window.tinymce.editors.find(ed => ed && ed.mode === 'design' && ed.hasFocus && ed.hasFocus());
    }
    return null;
  }

  function getActiveBody() {
    const editor = getActiveEditor();
    if (editor && typeof editor.getBody === 'function') {
      try { return editor.getBody(); } catch { /* ignore */ }
    }
    return document.querySelector('.mce-content-body.mce-edit-focus, .mce-content-body.mce-edit-focus-inline');
  }

  function evaluateEditorState() {
    try {
      const editor = getActiveEditor();
      const body = getActiveBody();
      if (!editor && !body) {
        postToParent({
          type: STATUS_EVENT,
          text: '',
          isEmpty: false,
          editorId: null,
          blockType: '',
          source: 'frame',
          rect: null
        });
        return;
      }
      const html = editor && typeof editor.getContent === 'function'
        ? editor.getContent({ format: 'html' })
        : (body ? body.innerHTML : '');
      const text = editor && typeof editor.getContent === 'function'
        ? editor.getContent({ format: 'text' })
        : (body ? body.textContent || '' : '');
      const normalized = stripText(text || html);
      const isEmpty = !normalized || normalized.toLowerCase() === PLACEHOLDER.toLowerCase();
      const editorId = editor?.id || body?.id || null;
      const rect = body ? getBodyRect(body) : null;
      postToParent({
        type: STATUS_EVENT,
        text: normalized,
        isEmpty,
        editorId,
        blockType: 'text',
        source: 'frame',
        rect
      });
    } catch (err) {
      console.debug('[Smartpr Labs][BeeFrame] evaluate failed', err);
    }
  }

  function hookEditor(editor) {
    if (!editor) return;
    if (instrumentedEditors && instrumentedEditors.has(editor)) return;
    const handler = () => evaluateEditorState();
    const events = ['focus', 'blur', 'change', 'SetContent', 'KeyUp', 'NodeChange', 'SelectionChange'];
    events.forEach(evt => {
      try { editor.on(evt, handler); } catch { /* ignore */ }
    });
    if (instrumentedEditors) instrumentedEditors.add(editor);
  }

  function watchTinymce() {
    if (!window.tinymce) return;
    try {
      if (Array.isArray(window.tinymce.editors)) {
        window.tinymce.editors.forEach(hookEditor);
      }
      if (typeof window.tinymce.on === 'function') {
        window.tinymce.on('AddEditor', e => hookEditor(e?.editor));
      }
    } catch (err) {
      console.debug('[Smartpr Labs][BeeFrame] tinymce hook failed', err);
    }
  }

  function applyParagraph(html) {
    let success = false;
    const editor = getActiveEditor();
    if (editor && typeof editor.setContent === 'function') {
      try {
        editor.focus();
        editor.setContent(html);
        editor.fire('change');
        success = true;
      } catch (err) {
        console.debug('[Smartpr Labs][BeeFrame] editor setContent failed', err);
      }
    }
    if (!success) {
      const body = getActiveBody();
      if (body) {
        body.innerHTML = html;
        try {
          body.dispatchEvent(new Event('input', { bubbles: true }));
        } catch { /* ignore */ }
        success = true;
      }
    }
    evaluateEditorState();
    postToParent({ type: APPLY_RESULT_EVENT, success });
  }

  function getBodyRect(body) {
    try {
      const rect = body.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      };
    } catch {
      return null;
    }
  }

  window.addEventListener('message', event => {
    if (!event || !event.data || typeof event.data !== 'object') return;
    if (event.data.type === APPLY_EVENT) {
      const html = event.data.html || '';
      applyParagraph(typeof html === 'string' ? html : '');
    }
  }, false);

  const observer = new MutationObserver(() => evaluateEditorState());
  try {
    observer.observe(document.body, { childList: true, subtree: true });
  } catch { /* ignore */ }

  if (window.tinymce) {
    watchTinymce();
  } else {
    const waitForTiny = setInterval(() => {
      if (window.tinymce) {
        clearInterval(waitForTiny);
        watchTinymce();
        evaluateEditorState();
      }
    }, 400);
  }
  evaluateEditorState();
})();
