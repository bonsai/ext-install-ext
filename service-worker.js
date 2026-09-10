const ACTIONS = new Set(['open_url', 'navigate', 'focus_tab']);
const NATIVE_HOST = 'com.bonsai.ext_install';

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function validRepository(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

function validBrowser(value) {
  return ['edge', 'chrome', 'auto'].includes(value) ? value : 'auto';
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Ext Install] service worker installed', chrome.runtime.id);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'install_extension') {
    const repository = validRepository(message.repository);
    if (!repository) {
      sendResponse({ ok: false, error: 'invalid_repository' });
      return false;
    }

    const browser = validBrowser(message.browser);
    chrome.runtime.sendNativeMessage(
      NATIVE_HOST,
      { action: 'install', repository, browser },
      (response) => {
        const runtimeError = chrome.runtime.lastError;
        if (runtimeError) {
          sendResponse({ ok: false, error: runtimeError.message });
          return;
        }
        sendResponse(response || { ok: false, error: 'empty_native_response' });
      }
    );
    return true;
  }

  if (message?.type !== 'browser_action') return;

  const action = message.action || {};
  console.log('[Ext Install] browser_action received', action, 'from', sender?.tab?.id);

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
    .then((result) => {
      console.log('[Ext Install] browser_action result', result);
      sendResponse(result);
    })
    .catch((error) => {
      console.error('[Ext Install] browser_action error', error);
      sendResponse({ ok: false, error: error?.message || String(error) });
    });

  return true;
});
