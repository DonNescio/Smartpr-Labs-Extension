// Popup script

const statusDiv = document.getElementById('status');
const openOptionsButton = document.getElementById('open-options');
const extensionToggle = document.getElementById('toggle-extension');
const extensionStatus = document.getElementById('extension-status');

const EXTENSION_DISABLED_KEY = 'smartpr_helper_disabled';

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Check if email is configured
chrome.storage.sync.get(['smartpr_user_email'], (result) => {
  const email = result.smartpr_user_email;

  if (email && email.trim() && emailRegex.test(email)) {
    statusDiv.textContent = `✓ Ready to help! (${email})`;
    statusDiv.classList.add('ready');
  } else {
    statusDiv.textContent = '⚠ Email not configured';
    statusDiv.classList.add('error');
  }
});

function renderExtensionToggle(disabled) {
  if (!extensionToggle || !extensionStatus) return;
  extensionToggle.checked = !disabled;
  extensionStatus.textContent = disabled ? 'Extension is off.' : 'Extension is on.';
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

// Open options page
openOptionsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
