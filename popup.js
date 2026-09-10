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

function setTarget(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) {
    statusEl.textContent = 'No supported HTTP(S) URL found.';
    open.hidden = true;
    return null;
  }
  repoEl.textContent = normalized;
  statusEl.textContent = 'URL is ready for browser action.';
  open.href = normalized;
  open.hidden = false;
  return normalized;
}

async function currentTabUrl() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.url || null;
}

async function inspectTarget() {
  inspect.disabled = true;
  try {
    const target = repo ? `https://github.com/${repo}` : await currentTabUrl();
    const url = setTarget(target);
    if (!url) return;

    await chrome.runtime.sendMessage({
      type: 'browser_action',
      action: { type: 'open_url', url }
    });
    statusEl.textContent = 'Sent to browser action: open_url.';
  } catch (error) {
    statusEl.textContent = `Browser action failed: ${error.message}`;
  } finally {
    inspect.disabled = false;
  }
}

(async () => {
  setTarget(repo ? `https://github.com/${repo}` : await currentTabUrl());
})();

inspect.addEventListener('click', inspectTarget);
