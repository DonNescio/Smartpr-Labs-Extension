// popup.js — Smart.pr Labs action popup
const FEATURE_KEYS = {
  angleAssistant: 'feature_angle_assistant',
  prFeedback: 'feature_pr_feedback',
  paragraphWriter: 'feature_paragraph_writer',
};
const LABS_DISABLED_KEY = 'labs_disabled';

const statusEls = {
  angleAssistant: document.getElementById('popup-status-angle'),
  prFeedback: document.getElementById('popup-status-feedback'),
  paragraphWriter: document.getElementById('popup-status-paragraph'),
};
const extensionToggle = document.getElementById('toggle-extension');
const extensionStatus = document.getElementById('popup-extension-status');

const STORAGE_KEYS = [...Object.values(FEATURE_KEYS), LABS_DISABLED_KEY];

const normalizeFeatureValue = (value, fallback = true) => (typeof value === 'boolean' ? value : fallback);

function renderExtensionToggle(disabled) {
  if (!extensionToggle) return;
  extensionToggle.checked = !disabled;
  if (extensionStatus) {
    extensionStatus.textContent = disabled ? 'Extension is off.' : 'Extension is on.';
    extensionStatus.classList.toggle('is-off', disabled);
  }
}

function renderStatuses(data = {}) {
  const extensionDisabled = Boolean(data[LABS_DISABLED_KEY]);
  renderExtensionToggle(extensionDisabled);

  const angleEnabled = extensionDisabled
    ? false
    : normalizeFeatureValue(data[FEATURE_KEYS.angleAssistant], true);
  const feedbackEnabled = extensionDisabled
    ? false
    : normalizeFeatureValue(data[FEATURE_KEYS.prFeedback], true);
  const paragraphEnabled = extensionDisabled
    ? false
    : normalizeFeatureValue(data[FEATURE_KEYS.paragraphWriter], true);

  const render = (el, enabled) => {
    if (!el) return;
    el.textContent = enabled ? 'On' : 'Off';
    el.classList.toggle('is-off', !enabled);
  };

  render(statusEls.angleAssistant, angleEnabled);
  render(statusEls.prFeedback, feedbackEnabled);
  render(statusEls.paragraphWriter, paragraphEnabled);
}

function init() {
  const btn = document.getElementById('open-overview');
  if (btn) {
    btn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
  }

  if (extensionToggle) {
    extensionToggle.addEventListener('change', () => {
      const disabled = !extensionToggle.checked;
      chrome.storage.sync.set({ [LABS_DISABLED_KEY]: disabled });
    });
  }

  chrome.storage.sync.get(STORAGE_KEYS, renderStatuses);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const keys = STORAGE_KEYS;
    if (keys.some(key => key in changes)) {
      chrome.storage.sync.get(keys, renderStatuses);
    }
  });
}

init();
