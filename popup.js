const params = new URLSearchParams(location.search);
const repoParam = params.get('repo');

const repoEl = document.getElementById('repo');
const statusEl = document.getElementById('status');
const detect = document.getElementById('detect');
const install = document.getElementById('install');
const open = document.getElementById('open');

function normalizeRepository(value) {
  if (!value) return null;
  const raw = value.trim().replace(/\.git\/?$/, '').replace(/\/$/, '');
  const match = raw.match(/^(?:https?:\/\/github\.com\/)?([^/\s]+)\/([^/\s]+)$/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

function browserTarget() {
  return /Edg\//i.test(navigator.userAgent) ? 'edge' : 'chrome';
}

function setStatus(message, state = 'ok') {
  statusEl.textContent = message;
  statusEl.dataset.state = state;
  console.log(`[Ext Install] ${message}`);
}

function setTarget(repository) {
  if (!repository) {
    repoEl.textContent = 'No GitHub repository detected';
    open.hidden = true;
    install.disabled = true;
    setStatus('Open a GitHub repository and try again.', 'error');
    return null;
  }

  repoEl.textContent = repository;
  open.href = `https://github.com/${repository}`;
  open.hidden = false;
  install.disabled = false;
  setStatus('Ready — install or update from the GUI.');
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
    setTarget(await detectRepository());
  } catch (error) {
    console.error('[Ext Install] detect failed', error);
    setStatus(`Detect failed: ${error?.message || error}`, 'error');
  } finally {
    detect.disabled = false;
  }
}

async function installTarget() {
  const repository = normalizeRepository(repoEl.textContent);
  if (!repository) return;

  install.disabled = true;
  detect.disabled = true;
  const browser = browserTarget();
  setStatus(`Installing / updating ${repository} on ${browser}…`);

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'install_extension',
      repository,
      browser
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Native host install failed');
    }

    setStatus(response.message || `Installed / updated ${repository}.`, 'success');
  } catch (error) {
    console.error('[Ext Install] install failed', error);
    const message = error?.message || String(error);
    setStatus(
      message.includes('Receiving end does not exist') || message.includes('Native host')
        ? 'Native host is not available. Run the one-time host setup, then reload this extension.'
        : `Install failed: ${message}`,
      'error'
    );
  } finally {
    install.disabled = false;
    detect.disabled = false;
  }
}

detect.addEventListener('click', detectTarget);
install.addEventListener('click', installTarget);
detectTarget();
