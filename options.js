// options.js — Smart.pr Labs overview logic
const $ = (sel) => document.querySelector(sel);

const keyField = $('#key');
const revealBtn = $('#reveal');
const saveBtn = $('#save');
const testBtn = $('#test');
const clearBtn = $('#clear');
const changelogBtn = document.getElementById('open-changelog');

const FEATURE_KEYS = {
  angleAssistant: 'feature_angle_assistant',
  prFeedback: 'feature_pr_feedback',
  paragraphWriter: 'feature_paragraph_writer',
  subjectGenerator: 'feature_subject_generator',
};

const DEFAULT_FEATURE_STATE = {
  angleAssistant: true,
  prFeedback: true,
  paragraphWriter: true,
  subjectGenerator: true,
};

let featureState = { ...DEFAULT_FEATURE_STATE };

const usageEls = {
  requests: $('#usage-requests'),
  prompt: $('#usage-prompt'),
  completion: $('#usage-completion'),
  total: $('#usage-total'),
  updated: $('#usage-updated'),
};

const usageCostEls = {
  prompt: $('#cost-prompt'),
  completion: $('#cost-completion'),
  total: $('#cost-total'),
};

const featureButtons = {
  angleAssistant: $('#toggle-angle'),
  prFeedback: $('#toggle-feedback'),
  paragraphWriter: $('#toggle-paragraph'),
  subjectGenerator: $('#toggle-subject'),
};

const featureStatus = {
  angleAssistant: $('#status-angle'),
  prFeedback: $('#status-feedback'),
  paragraphWriter: $('#status-paragraph'),
  subjectGenerator: $('#status-subject'),
};

const RATE_PROMPT = 0.00015; // USD per 1K tokens
const RATE_COMPLETION = 0.0006; // USD per 1K tokens

const formatNumber = (value) => {
  const intVal = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US').format(intVal);
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const smallCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const formatCurrency = (value) => {
  if (!Number.isFinite(value) || value <= 0) return currencyFormatter.format(0);
  if (value < 0.01) return smallCurrencyFormatter.format(value);
  return currencyFormatter.format(value);
};

const formatUpdated = (timestamp) => {
  if (!timestamp) return 'never';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'never';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const normalizeFeatureValue = (value, fallback = true) => (typeof value === 'boolean' ? value : fallback);

function loadKey() {
  chrome.storage.sync.get(['sase_api'], ({ sase_api }) => {
    if (!keyField) return;
    keyField.value = sase_api || '';
    if (revealBtn) {
      keyField.type = 'password';
      revealBtn.textContent = 'Show';
    }
  });
}

function toggleReveal() {
  if (!keyField || !revealBtn) return;
  keyField.type = keyField.type === 'password' ? 'text' : 'password';
  revealBtn.textContent = keyField.type === 'password' ? 'Show' : 'Hide';
}

function refreshUsage() {
  if (!usageEls.requests) return;
  chrome.storage.local.get(['sase_usage'], ({ sase_usage }) => {
    const usage = sase_usage || {
      requests: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      lastUpdated: 0,
    };
    usageEls.requests.textContent = formatNumber(usage.requests || 0);
    usageEls.prompt.textContent = formatNumber(usage.promptTokens || 0);
    usageEls.completion.textContent = formatNumber(usage.completionTokens || 0);
    usageEls.total.textContent = formatNumber(usage.totalTokens || 0);
    usageEls.updated.textContent = formatUpdated(usage.lastUpdated || 0);

    const promptTokens = usage.promptTokens || 0;
    const completionTokens = usage.completionTokens || 0;
    const promptCost = (promptTokens / 1000) * RATE_PROMPT;
    const completionCost = (completionTokens / 1000) * RATE_COMPLETION;
    const totalCost = promptCost + completionCost;

    if (usageCostEls.prompt) usageCostEls.prompt.textContent = formatCurrency(promptCost);
    if (usageCostEls.completion) usageCostEls.completion.textContent = formatCurrency(completionCost);
    if (usageCostEls.total) usageCostEls.total.textContent = formatCurrency(totalCost);
  });
}

function updateFeatureUI() {
  Object.entries(featureButtons).forEach(([key, btn]) => {
    const enabled = featureState[key];
    if (!btn) return;
    btn.textContent = enabled ? 'Turn off' : 'Turn on';
    btn.classList.toggle('secondary', enabled);
  });

  Object.entries(featureStatus).forEach(([key, node]) => {
    const enabled = featureState[key];
    if (!node) return;
    node.textContent = enabled ? 'On' : 'Off';
    node.classList.toggle('is-off', !enabled);
  });
}

function loadFeatures() {
  chrome.storage.sync.get(Object.values(FEATURE_KEYS), (stored) => {
    featureState = {
      angleAssistant: normalizeFeatureValue(stored[FEATURE_KEYS.angleAssistant], DEFAULT_FEATURE_STATE.angleAssistant),
      prFeedback: normalizeFeatureValue(stored[FEATURE_KEYS.prFeedback], DEFAULT_FEATURE_STATE.prFeedback),
      paragraphWriter: normalizeFeatureValue(stored[FEATURE_KEYS.paragraphWriter], DEFAULT_FEATURE_STATE.paragraphWriter),
      subjectGenerator: normalizeFeatureValue(stored[FEATURE_KEYS.subjectGenerator], DEFAULT_FEATURE_STATE.subjectGenerator),
    };
    updateFeatureUI();
  });
}

function wireFeatureHandlers() {
  Object.entries(featureButtons).forEach(([feature, btn]) => {
    if (!btn) return;
    btn.onclick = () => {
      const next = !featureState[feature];
      featureState[feature] = next;
      updateFeatureUI();
      chrome.storage.sync.set({ [FEATURE_KEYS[feature]]: next });
    };
  });
}

function wireKeyHandlers() {
  if (saveBtn) {
    saveBtn.onclick = () => {
      const value = (keyField?.value || '').trim();
      if (!value) return alert('Please paste your OpenAI API key (sk-...).');
      if (!/^sk-/.test(value)) {
        const proceed = confirm('This does not look like an sk- key. Save anyway?');
        if (!proceed) return;
      }
      chrome.storage.sync.set({ sase_api: value }, () => alert('Saved ✅'));
    };
  }

  if (revealBtn) revealBtn.onclick = toggleReveal;

  if (testBtn) {
    testBtn.onclick = async () => {
      const key = (keyField?.value || '').trim();
      if (!key) return alert('Enter your key first.');
      try {
        const resp = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${key}` },
        });
        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`${resp.status}: ${txt}`);
        }
        alert('Key looks valid ✅');
      } catch (err) {
        console.error(err);
        alert('Key test failed ❌\n' + err.message);
      }
    };
  }

  if (clearBtn) {
    clearBtn.onclick = () => {
      const confirmClear = confirm('Remove the saved API key from this browser profile?');
      if (!confirmClear) return;
      chrome.storage.sync.remove('sase_api', () => {
        if (keyField) keyField.value = '';
        alert('Removed ✅');
      });
    };
  }
}

function wireChangelogLink() {
  if (!changelogBtn) return;
  changelogBtn.onclick = () => {
    const changelogUrl = chrome?.runtime?.getURL
      ? chrome.runtime.getURL('changelog.html')
      : 'changelog.html';
    window.open(changelogUrl, '_blank');
  };
}

function init() {
  loadFeatures();
  loadKey();
  refreshUsage();
  wireFeatureHandlers();
  wireKeyHandlers();
  wireChangelogLink();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.sase_usage) refreshUsage();
    if (area === 'sync') {
      if (changes.sase_api) loadKey();
      let dirty = false;
      const nextState = { ...featureState };
      if (changes[FEATURE_KEYS.angleAssistant]) {
        nextState.angleAssistant = normalizeFeatureValue(changes[FEATURE_KEYS.angleAssistant].newValue, DEFAULT_FEATURE_STATE.angleAssistant);
        dirty = true;
      }
      if (changes[FEATURE_KEYS.prFeedback]) {
        nextState.prFeedback = normalizeFeatureValue(changes[FEATURE_KEYS.prFeedback].newValue, DEFAULT_FEATURE_STATE.prFeedback);
        dirty = true;
      }
      if (changes[FEATURE_KEYS.paragraphWriter]) {
        nextState.paragraphWriter = normalizeFeatureValue(changes[FEATURE_KEYS.paragraphWriter].newValue, DEFAULT_FEATURE_STATE.paragraphWriter);
        dirty = true;
      }
      if (dirty) {
        featureState = nextState;
        updateFeatureUI();
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
