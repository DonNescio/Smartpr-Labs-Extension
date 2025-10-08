// background.js
chrome.runtime.onMessage.addListener((msg, sender) => {
  console.debug('[Smartpr Labs][SW] Message received', msg, sender?.tab?.url);
  if (msg.action === 'openOptionsPage') {
    chrome.runtime.openOptionsPage();
    console.debug('[Smartpr Labs][SW] Opening options page');
  }
});
