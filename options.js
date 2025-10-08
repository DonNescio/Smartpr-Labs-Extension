// options.js — Settings page logic for Story Angle Suggestion Engine
const $ = (s) => document.querySelector(s);

// Load saved key on open
chrome.storage.sync.get(['sase_api'], ({ sase_api }) => {
  if (sase_api) $('#key').value = sase_api;
});

// Save key
$('#save').onclick = () => {
  const v = $('#key').value.trim();
  if (!v) return alert('Please paste your OpenAI API key (sk-...).');
  // Basic shape check (don’t over-validate; keys can change format)
  if (!/^sk-/.test(v)) {
    if (!confirm('This does not look like an sk- key. Save anyway?')) return;
  }
  chrome.storage.sync.set({ sase_api: v }, () => alert('Saved ✅'));
};

// Show/Hide
$('#reveal').onclick = () => {
  const el = $('#key');
  el.type = el.type === 'password' ? 'text' : 'password';
  $('#reveal').textContent = el.type === 'password' ? 'Show' : 'Hide';
};

// Test key with a tiny request (fast + cheap)
$('#test').onclick = async () => {
  const key = $('#key').value.trim();
  if (!key) return alert('Enter your key first.');
  try {
    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`${resp.status}: ${txt}`);
    }
    alert('Key looks valid ✅');
  } catch (e) {
    console.error(e);
    alert('Key test failed ❌\n' + e.message);
  }
};

// Clear key
$('#clear').onclick = () => {
  if (!confirm('Remove the saved API key from this browser profile?')) return;
  chrome.storage.sync.remove('sase_api', () => {
    $('#key').value = '';
    alert('Removed ✅');
  });
};
