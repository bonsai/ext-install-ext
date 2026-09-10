const params = new URLSearchParams(location.search);
const repo = params.get('repo');

const repoEl = document.getElementById('repo');
const statusEl = document.getElementById('status');
const inspect = document.getElementById('inspect');
const open = document.getElementById('open');

function normalizeUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function setStatus(message, error = false) {
  statusEl.textContent = message;
  statusEl.dataset.state = error ? 'error' : 'ok';
  console.log(`[Ext Install] ${message}`);
}

function setTarget(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    repoEl.textContent = 'No HTTP(S) target';
    setStatus('No supported HTTP(S) URL found.', true);
    open.hidden = true;
    return null;
  }
  repoEl.textContent = normalized;
  setStatus('URL is ready for browser action.');
  open.href = normalized;
  open.hidden = false;
  return normalized;
}

async function currentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) throw new Error('No active tab found');
  console.log('[Ext Install] active tab', tab);
  return tab;
}

async function inspectTarget() {
  inspect.disabled = true;
  try {
    const tab = await currentTab();
    const target = repo ? `https://github.com/${repo}` : tab.url;
    const url = setTarget(target);
    if (!url) return;

    setStatus('Sending browser_action → service worker…');
    const response = await chrome.runtime.sendMessage({
      type: 'browser_action',
      action: { type: 'open_url', url }
    });

    console.log('[Ext Install] service worker response', response);
    if (!response?.ok) {
      throw new Error(response?.error || 'No successful response from service worker');
    }
    setStatus(`Opened tab ${response.tab_id}: ${response.url}`);
  } catch (error) {
    console.error('[Ext Install] browser action failed', error);
    setStatus(`Browser action failed: ${error?.message || error}`, true);
  } finally {
    inspect.disabled = false;
  }
}

(async () => {
  try {
    const tab = await currentTab();
    setTarget(repo ? `https://github.com/${repo}` : tab.url);
    console.log('[Ext Install] popup ready', {
      extensionId: chrome.runtime.id,
      repo,
      tabId: tab.id,
      tabUrl: tab.url
    });
  } catch (error) {
    console.error('[Ext Install] popup init failed', error);
    setStatus(`Popup init failed: ${error?.message || error}`, true);
  }
})();

inspect.addEventListener('click', inspectTarget);
