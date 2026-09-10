(() => {
  const marker = 'data-ext-install-ext';

  function repoFromUrl() {
    const match = location.pathname.match(/^\/([^/]+)\/([^/]+)(?:\/|$)/);
    if (!match || ['issues', 'pulls', 'settings', 'marketplace'].includes(match[2])) return null;
    return `${match[1]}/${match[2].replace(/\.git$/, '')}`;
  }

  function createButton(repo) {
    if (document.querySelector(`[${marker}]`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Ext Install';
    button.setAttribute(marker, 'true');
    button.className = 'btn btn-sm';
    button.title = `Inspect ${repo} as an extension repository`;
    button.addEventListener('click', () => {
      const url = chrome.runtime.getURL(`popup.html?repo=${encodeURIComponent(repo)}`);
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    const candidates = [
      document.querySelector('.pagehead-actions'),
      document.querySelector('[data-component="PH_Actions"]')
    ].filter(Boolean);
    if (candidates[0]) candidates[0].prepend(button);
  }

  function render() {
    const repo = repoFromUrl();
    if (repo) createButton(repo);
  }

  render();
  new MutationObserver(render).observe(document.documentElement, { childList: true, subtree: true });
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      document.querySelector(`[${marker}]`)?.remove();
      render();
    }
  }, 500);
})();
