import { lookupArticle, OpenAlexError } from './openalex.js';

const CACHE_PREFIX = 'article:';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const pending = new Map();
let generation = 0;
let cacheMutations = Promise.resolve();

class UserFacingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.userMessage = message;
  }
}

// Publisher content scripts must never have access to the saved API key.
const storageReady = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });

async function automaticLookupEnabled() {
  await storageReady;
  const settings = await chrome.storage.local.get('automaticLookupEnabled');
  return settings.automaticLookupEnabled === true;
}

async function notifyStatusChanged() {
  const tabs = await chrome.tabs.query({});
  await Promise.allSettled(tabs.filter(tab => tab.id).map(tab =>
    chrome.tabs.sendMessage(tab.id, { type: 'AUTHORC_STATUS_CHANGED' })));
}

function validateArticle(input, sender) {
  if (!input || !sender.tab || sender.frameId !== 0 || !/^https?:\/\//i.test(sender.url || '')) {
    throw new UserFacingError('INVALID_PAGE', 'Open a publisher’s article page to use authorC.');
  }
  const doi = typeof input.doi === 'string' ? input.doi.trim() : null;
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 1000) : null;
  if (doi && (doi.length > 2048 || !/^10\.\d{4,9}\/\S+$/i.test(doi))) {
    throw new UserFacingError('INVALID_ARTICLE', 'The page contains an invalid DOI.');
  }
  const authorNames = Array.isArray(input.authorNames)
    ? input.authorNames.filter(name => typeof name === 'string').slice(0, 100).map(name => name.slice(0, 200))
    : [];
  if (!doi && (!title || !authorNames.length)) {
    throw new UserFacingError('NO_IDENTIFIER', 'No article identifier was found on this page.');
  }
  return {
    doi,
    title,
    authorNames,
    year: Number.isInteger(input.year) ? input.year : null,
    pageUrl: sender.url,
    source: typeof input.source === 'string' ? input.source.slice(0, 80) : 'metadata',
  };
}

async function cacheKey(article) {
  const identity = article.doi
    ? `doi:${article.doi.toLowerCase()}`
    : JSON.stringify([article.title.toLowerCase(), article.year, article.authorNames.map(name => name.toLowerCase()).sort()]);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  return CACHE_PREFIX + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function trimCache() {
  const saved = await chrome.storage.local.get(null);
  const entries = Object.entries(saved).filter(([key]) => key.startsWith(CACHE_PREFIX));
  entries.sort((a, b) => (b[1]?.savedAt || 0) - (a[1]?.savedAt || 0));
  let bytes = 0;
  const remove = [];
  for (const [index, [key, entry]] of entries.entries()) {
    bytes += JSON.stringify(entry).length * 2;
    if (index >= 60 || bytes > 3_500_000 || !isFreshCache(entry)) remove.push(key);
  }
  if (remove.length) await chrome.storage.local.remove(remove);
}

function isFreshCache(entry) {
  const age = Date.now() - entry?.savedAt;
  return Number.isFinite(age) && age >= 0 && age < CACHE_TTL &&
    Array.isArray(entry?.data?.authors) && entry.data.authors.length > 0 &&
    !entry.data.missingCount && !entry.data.truncated;
}

function mutateCache(operation) {
  const task = cacheMutations.then(operation);
  cacheMutations = task.catch(() => {});
  return task;
}

async function clearCache() {
  generation += 1;
  for (const task of pending.values()) task.controller.abort();
  pending.clear();
  await storageReady;
  await mutateCache(async () => {
    const saved = await chrome.storage.local.get(null);
    const keys = Object.keys(saved).filter(key => key.startsWith(CACHE_PREFIX));
    if (keys.length) await chrome.storage.local.remove(keys);
  });
}

async function lookup(input, sender, force) {
  if (!await automaticLookupEnabled()) {
    throw new UserFacingError('CONSENT_REQUIRED', 'Enable automatic lookups in authorC settings first.');
  }
  const article = validateArticle(input, sender);
  const key = await cacheKey(article);
  let saved;
  let startedAtGeneration;
  do {
    await cacheMutations;
    startedAtGeneration = generation;
    saved = await chrome.storage.local.get([key, 'apiKey', 'automaticLookupEnabled']);
  } while (startedAtGeneration !== generation);
  if (saved.automaticLookupEnabled !== true) {
    throw new UserFacingError('CONSENT_REQUIRED', 'Automatic lookups are paused. Enable them in authorC settings.');
  }
  const cached = saved[key];
  if (!force && isFreshCache(cached)) {
    return { ...cached.data, cached: true };
  }
  if (pending.has(key)) return pending.get(key).promise;
  const controller = new AbortController();
  const task = { controller, promise: null };
  task.promise = (async () => {
    const apiKey = typeof saved.apiKey === 'string' ? saved.apiKey : '';
    const data = await lookupArticle(article, { apiKey, signal: controller.signal });
    if (generation === startedAtGeneration && data.authors.length > 0 && !data.missingCount && !data.truncated) {
      try {
        await mutateCache(async () => {
          if (generation !== startedAtGeneration) return;
          await chrome.storage.local.set({ [key]: { savedAt: Date.now(), data } });
          await trimCache();
        });
      } catch {
        // A full local cache must not hide successfully fetched results.
      }
    }
    if (generation !== startedAtGeneration) {
      throw new UserFacingError('SETTINGS_CHANGED', 'Settings or cached results changed during this lookup. Try again.');
    }
    return { ...data, cached: false };
  })();
  pending.set(key, task);
  try {
    return await task.promise;
  } finally {
    if (pending.get(key) === task) pending.delete(key);
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (Object.hasOwn(changes, 'apiKey') || Object.hasOwn(changes, 'automaticLookupEnabled')) clearCache().catch(() => {});
  if (Object.hasOwn(changes, 'automaticLookupEnabled')) notifyStatusChanged().catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !message) return false;
  if (message.type === 'AUTHORC_GET_STATUS') {
    automaticLookupEnabled().then(
      enabled => respond({ ok: true, enabled }),
      () => respond({ ok: false, enabled: false }),
    );
    return true;
  }
  if (message.type === 'AUTHORC_OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage().then(
      () => respond({ ok: true }),
      () => respond({ ok: false, error: { message: 'Could not open settings. Open Options from the Chrome extensions page.' } }),
    );
    return true;
  }
  if (message.type === 'AUTHORC_CLEAR_CACHE' && sender.url?.startsWith(chrome.runtime.getURL(''))) {
    clearCache().then(() => respond({ ok: true }), () => respond({ ok: false, error: { message: 'Could not clear the cache.' } }));
    return true;
  }
  if (message.type !== 'AUTHORC_LOOKUP') return false;
  lookup(message.article, sender, message.force === true).then(
    data => respond({ ok: true, data }),
    error => {
      const known = error instanceof UserFacingError || error instanceof OpenAlexError;
      respond({ ok: false, error: {
        code: known ? error.code : 'LOOKUP_FAILED',
        message: known ? error.userMessage : 'The lookup could not be completed. Reload the page and try again.',
      } });
    },
  );
  return true;
});

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try {
    if (!await automaticLookupEnabled()) {
      await chrome.runtime.openOptionsPage();
      return;
    }
    await chrome.tabs.sendMessage(tab.id, { type: 'AUTHORC_SHOW' });
  } catch {
    await chrome.runtime.openOptionsPage().catch(() => {});
  }
});

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') chrome.runtime.openOptionsPage().catch(() => {});
});
