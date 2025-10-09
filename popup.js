// popup.js — Smart.pr Labs action popup
const FEATURE_KEYS = {
  angleAssistant: 'feature_angle_assistant',
  prFeedback: 'feature_pr_feedback',
  paragraphWriter: 'feature_paragraph_writer',
};

const statusEls = {
  angleAssistant: document.getElementById('popup-status-angle'),
  prFeedback: document.getElementById('popup-status-feedback'),
  paragraphWriter: document.getElementById('popup-status-paragraph'),
};

const normalizeFeatureValue = (value, fallback = true) => (typeof value === 'boolean' ? value : fallback);

function renderStatuses(data = {}) {
  const angleEnabled = normalizeFeatureValue(data[FEATURE_KEYS.angleAssistant], true);
  const feedbackEnabled = normalizeFeatureValue(data[FEATURE_KEYS.prFeedback], true);
  const paragraphEnabled = normalizeFeatureValue(data[FEATURE_KEYS.paragraphWriter], true);

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

  chrome.storage.sync.get(Object.values(FEATURE_KEYS), renderStatuses);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const keys = Object.values(FEATURE_KEYS);
    if (keys.some(key => key in changes)) {
      chrome.storage.sync.get(keys, renderStatuses);
    }
  });
}

init();
