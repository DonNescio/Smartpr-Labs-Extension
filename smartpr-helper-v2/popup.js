// Popup script

const statusDiv = document.getElementById('status');
const openOptionsButton = document.getElementById('open-options');

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

// Open options page
openOptionsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
