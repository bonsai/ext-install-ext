const params = new URLSearchParams(location.search);
const repo = params.get('repo');

const repoEl = document.getElementById('repo');
const commandEl = document.getElementById('command');
const statusEl = document.getElementById('status');
const copy = document.getElementById('copy');
const open = document.getElementById('open');

function normalizeRepository(value) {
  if (!value) return null;
  const raw = value.trim().replace(/\.git\/?$/, '').replace(/\/$/, '');
  const match = raw.match(/^(?:https?:\/\/github\.com\/)?([^/\s]+)\/([^/\s]+)$/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.dataset.state = error ? 'error' : 'ok';
  console.log(`[Ext Install] ${message}`);
}

function setTarget(repository) {
  if (!repository) {
    repoEl.textContent = 'No GitHub repository detected';
    commandEl.textContent = '';
    open.hidden = true;
    copy.disabled = true;
    setStatus('Open a GitHub repository page first.', true);
    return null;
  }

  const command = `ext-install ${repository} edge`;
  repoEl.textContent = repository;
  commandEl.textContent = command;
  open.href = `https://github.com/${repository}`;
  open.hidden = false;
  copy.disabled = false;
  setStatus('Ready. Run the Skill CLI to clone, inspect, and load the extension.');
  return command;
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) throw new Error('No active tab found');
  return tab;
}

async function detectRepository() {
  const tab = await currentTab();
  const target = repo || tab.url || '';
  const match = target.match(/github\.com\/([^/]+\/[^/#?]+)/i);
  return normalizeRepository(match ? match[1] : target);
}

async function copyCommand() {
  const repository = normalizeRepository(repoEl.textContent);
  if (!repository) return;

  const command = `ext-install ${repository} edge`;
  try {
    await navigator.clipboard.writeText(command);
    setStatus('CLI command copied. Run it in PowerShell or WSL.');
  } catch (error) {
    console.error('[Ext Install] copy failed', error);
    setStatus(`Copy failed: ${error?.message || error}`, true);
  }
}

(async () => {
  try {
    const repository = await detectRepository();
    setTarget(repository);
    console.log('[Ext Install] popup ready', {
      extensionId: chrome.runtime.id,
      repository
    });
  } catch (error) {
    console.error('[Ext Install] popup init failed', error);
    setStatus(`Popup init failed: ${error?.message || error}`, true);
  }
})();

copy.addEventListener('click', copyCommand);
