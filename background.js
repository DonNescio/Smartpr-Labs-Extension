// background.js
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action === 'openOptionsPage') {
    chrome.runtime.openOptionsPage();
  }
});
