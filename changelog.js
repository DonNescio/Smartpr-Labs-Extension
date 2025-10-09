// changelog.js — Smart.pr Labs changelog interactions
(function () {
  const openOverviewBtn = document.getElementById('open-overview');
  if (openOverviewBtn) {
    openOverviewBtn.addEventListener('click', () => {
      const target = chrome?.runtime?.getURL
        ? chrome.runtime.getURL('options.html')
        : 'options.html';
      window.location.href = target;
    });
  }

  const shareFeedbackBtn = document.getElementById('share-feedback');
  if (shareFeedbackBtn) {
    shareFeedbackBtn.addEventListener('click', () => {
      window.location.href = 'mailto:don@smart.pr?subject=Smart.pr%20Labs%20feedback';
    });
  }
})();
