// background.js
chrome.runtime.onMessage.addListener((msg, sender) => {
  console.debug('[Smartpr Labs][SW] Message received', msg, sender?.tab?.url);
  if (msg.action === 'openOptionsPage' || msg.action === 'openOverviewPage') {
    chrome.runtime.openOptionsPage();
    console.debug('[Smartpr Labs][SW] Opening options page');
  }
});
