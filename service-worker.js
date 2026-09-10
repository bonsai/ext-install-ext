const ACTIONS = new Set(['open_url', 'navigate', 'focus_tab']);

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'browser_action') return;

  const action = message.action || {};
  if (!ACTIONS.has(action.type)) {
    sendResponse({ ok: false, error: 'unsupported_action' });
    return;
  }

  (async () => {
    const url = action.url ? validHttpUrl(action.url) : null;
    if ((action.type === 'open_url' || action.type === 'navigate') && !url) {
      return { ok: false, error: 'invalid_url' };
    }

    if (action.type === 'open_url') {
      const tab = await chrome.tabs.create({ url });
      return { ok: true, action: action.type, tab_id: tab.id, url };
    }

    if (action.type === 'navigate') {
      const tabId = action.tab_id ?? sender.tab?.id;
      if (tabId == null) return { ok: false, error: 'missing_tab_id' };
      const tab = await chrome.tabs.update(tabId, { url });
      return { ok: true, action: action.type, tab_id: tab.id, url };
    }

    const tabId = action.tab_id ?? sender.tab?.id;
    if (tabId == null) return { ok: false, error: 'missing_tab_id' };
    await chrome.tabs.update(tabId, { active: true });
    return { ok: true, action: action.type, tab_id: tabId };
  })()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
