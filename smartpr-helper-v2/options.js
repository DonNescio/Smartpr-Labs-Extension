// Options page script

const emailInput = document.getElementById('user-email');
const saveButton = document.getElementById('save-button');
const successMessage = document.getElementById('success-message');
const errorMessage = document.getElementById('error-message');

// Email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Load saved settings
chrome.storage.sync.get(['smartpr_user_email'], (result) => {
  if (result.smartpr_user_email) {
    emailInput.value = result.smartpr_user_email;
  }
});

// Hide messages
function hideMessages() {
  successMessage.classList.remove('show');
  errorMessage.classList.remove('show');
  errorMessage.textContent = '';
}

// Show error message
function showError(message) {
  hideMessages();
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
}

// Show success message
function showSuccess() {
  hideMessages();
  successMessage.classList.add('show');
}

// Save settings
saveButton.addEventListener('click', async () => {
  const email = emailInput.value.trim();

  if (!email) {
    showError('Please enter your email address');
    return;
  }

  // Validate email format
  if (!emailRegex.test(email)) {
    showError('Please enter a valid email address');
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';
  hideMessages();

  try {
    // Save email to storage
    await chrome.storage.sync.set({ smartpr_user_email: email });

    // Show success
    showSuccess();
    saveButton.textContent = 'Saved!';

    setTimeout(() => {
      successMessage.classList.remove('show');
      saveButton.textContent = 'Save Settings';
      saveButton.disabled = false;
    }, 2000);

  } catch (error) {
    showError('Failed to save settings: ' + error.message);
    saveButton.textContent = 'Save Settings';
    saveButton.disabled = false;
  }
});

// Save on Enter key
emailInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveButton.click();
  }
});

// Clear messages when typing
emailInput.addEventListener('input', () => {
  hideMessages();
});
