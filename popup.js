const params = new URLSearchParams(location.search);
const repoParam = params.get('repo');

const repoEl = document.getElementById('repo');
const commandEl = document.getElementById('command');
const statusEl = document.getElementById('status');
const detect = document.getElementById('detect');
const install = document.getElementById('install');
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
    install.disabled = true;
    copy.disabled = true;
    setStatus('Active tab is not a GitHub repository.', true);
    return null;
  }

  const command = `ext-install ${repository} edge`;
  repoEl.textContent = repository;
  commandEl.textContent = command;
  open.href = `https://github.com/${repository}`;
  open.hidden = false;
  install.disabled = false;
  copy.disabled = false;
  setStatus('Repository detected. Ready to install or update.');
  return repository;
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) throw new Error('No active tab found');
  return tabs[0];
}

async function detectRepository() {
  const tab = await currentTab();
  const source = repoParam || tab.url || '';
  const match = source.match(/^https?:\/\/github\.com\/([^/#?]+\/[^/#?]+)/i);
  return normalizeRepository(match ? match[1] : source);
}

async function detectTarget() {
  detect.disabled = true;
  try {
    setStatus('Detecting active GitHub repository…');
    const repository = await detectRepository();
    setTarget(repository);
  } catch (error) {
    console.error('[Ext Install] detect failed', error);
    setStatus(`Detect failed: ${error?.message || error}`, true);
  } finally {
    detect.disabled = false;
  }
}

async function installTarget() {
  const repository = normalizeRepository(repoEl.textContent);
  if (!repository) return;

  install.disabled = true;
  detect.disabled = true;
  copy.disabled = true;
  setStatus(`Installing / updating ${repository}…`);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'install_extension',
      repository,
      browser: 'edge'
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Native install failed');
    }

    setStatus(response.message || `Installed / updated ${repository}.`);
  } catch (error) {
    console.error('[Ext Install] install failed', error);
    setStatus(`Install failed: ${error?.message || error}`, true);
  } finally {
    install.disabled = false;
    detect.disabled = false;
    copy.disabled = false;
  }
}

async function copyCommand() {
  const repository = normalizeRepository(repoEl.textContent);
  if (!repository) return;
  try {
    await navigator.clipboard.writeText(`ext-install ${repository} edge`);
    setStatus('CLI command copied.');
  } catch (error) {
    console.error('[Ext Install] copy failed', error);
    setStatus(`Copy failed: ${error?.message || error}`, true);
  }
}

detect.addEventListener('click', detectTarget);
install.addEventListener('click', installTarget);
copy.addEventListener('click', copyCommand);

detectTarget();
