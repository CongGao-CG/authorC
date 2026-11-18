import test from 'node:test';
import assert from 'node:assert/strict';

const ARTICLE = {
  doi: '10.1038/s41561-026-02139-2',
  title: 'A study of tropical cyclones',
  authorNames: ['Alex Researcher'],
  year: 2026,
};
const PAGE = { id: 'authorc-test', tab: { id: 1 }, frameId: 0, url: 'https://www.nature.com/articles/s41561-026-02139-2' };
const OPTIONS = { id: 'authorc-test', url: 'chrome-extension://authorc-test/options.html' };
let instance = 0;

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function response(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function work(extra = {}) {
  return {
    id: 'https://openalex.org/W4415084259',
    title: ARTICLE.title,
    doi: `https://doi.org/${ARTICLE.doi}`,
    publication_year: 2026,
    authors_count: 1,
    authorships: [{ author: { id: 'https://openalex.org/A1234', display_name: 'Alex Researcher' } }],
    ...extra,
  };
}

async function setup(t, options = {}) {
  const previousChrome = globalThis.chrome;
  const previousFetch = globalThis.fetch;
  const stored = structuredClone({ automaticLookupEnabled: true, ...options.initial });
  const fetches = [];
  const accessLevels = [];
  let listener;
  let storageListener;
  let toolbarListener;
  let installedListener;
  let optionsOpened = 0;
  const tabMessages = [];
  const local = {
    async setAccessLevel(value) { accessLevels.push(value); },
    async get(keys) {
      await options.getHook?.(keys, stored);
      if (keys === null) return structuredClone(stored);
      const names = Array.isArray(keys) ? keys : [keys];
      return structuredClone(Object.fromEntries(names.filter(key => Object.hasOwn(stored, key)).map(key => [key, stored[key]])));
    },
    async set(values) {
      await options.setHook?.(values, stored);
      const changes = {};
      for (const [key, value] of Object.entries(values)) {
        changes[key] = { oldValue: stored[key], newValue: value };
        stored[key] = structuredClone(value);
      }
      storageListener?.(changes, 'local');
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete stored[key];
    },
  };
  globalThis.chrome = {
    storage: { local, onChanged: { addListener(fn) { storageListener = fn; } } },
    runtime: {
      id: 'authorc-test',
      getURL(path) { return `chrome-extension://authorc-test/${path}`; },
      async openOptionsPage() { optionsOpened += 1; return options.openOptions?.(); },
      onMessage: { addListener(fn) { listener = fn; } },
      onInstalled: { addListener(fn) { installedListener = fn; } },
    },
    action: { onClicked: { addListener(fn) { toolbarListener = fn; } } },
    tabs: {
      async query() { return [{ id: 1 }, { id: 2 }]; },
      async sendMessage(tabId, message) { tabMessages.push({ tabId, message }); return options.sendTabMessage?.(); },
    },
  };
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(url);
    fetches.push({ url: parsed, init });
    if (options.fetchHandler) return options.fetchHandler(parsed, init, fetches.length);
    if (parsed.pathname.startsWith('/works/')) return response(work());
    return response({ results: [{ id: 'https://openalex.org/A1234', display_name: 'Alex Researcher', cited_by_count: 1250, works_count: 18 }] });
  };
  await import(`../src/background.js?test=${++instance}`);
  t.after(() => {
    globalThis.chrome = previousChrome;
    globalThis.fetch = previousFetch;
  });
  function message(payload, sender = PAGE) {
    return new Promise(resolve => {
      if (!listener(payload, sender, resolve)) resolve(undefined);
    });
  }
  return {
    stored, fetches, accessLevels, local, message, tabMessages,
    optionsOpened: () => optionsOpened,
    installed: reason => installedListener({ reason }),
    lookup: (extra = {}, sender = PAGE) => message({ type: 'AUTHORC_LOOKUP', article: ARTICLE, ...extra }, sender),
    clear: () => message({ type: 'AUTHORC_CLEAR_CACHE' }, OPTIONS),
    cacheKeys: () => Object.keys(stored).filter(key => key.startsWith('article:')),
    toolbar: tab => toolbarListener(tab),
  };
}

test('background restricts credential storage and rejects foreign or embedded requests', async t => {
  const app = await setup(t);
  assert.deepEqual(app.accessLevels, [{ accessLevel: 'TRUSTED_CONTEXTS' }]);
  assert.equal(await app.lookup({}, { ...PAGE, id: 'another-extension' }), undefined);
  assert.equal((await app.lookup({}, { ...PAGE, frameId: 2 })).error.code, 'INVALID_PAGE');
  assert.equal((await app.lookup({ article: { doi: 'https://arbitrary.example/private' } })).error.code, 'INVALID_ARTICLE');
  assert.equal((await app.lookup({ article: {} })).error.code, 'NO_IDENTIFIER');
  assert.equal(app.fetches.length, 0);
});

test('complete results cache for 24 hours and force refresh bypasses cache', async t => {
  const app = await setup(t, { initial: { apiKey: 'private-test-key' } });
  const first = await app.lookup();
  assert.equal(first.ok, true);
  assert.equal(first.data.cached, false);
  assert.equal(first.data.authors[0].citationCount, 1250);
  assert.equal(app.fetches.length, 2);
  assert.ok(app.fetches.every(({ url }) => url.origin === 'https://api.openalex.org' && url.searchParams.get('api_key') === 'private-test-key'));
  assert.ok(app.fetches.every(({ init }) => init.credentials === 'omit'));
  assert.ok(!JSON.stringify(first).includes('private-test-key'));
  assert.ok(!JSON.stringify(app.stored[app.cacheKeys()[0]]).includes('private-test-key'));

  assert.equal((await app.lookup()).data.cached, true);
  assert.equal(app.fetches.length, 2);
  assert.equal((await app.lookup({ force: true })).data.cached, false);
  assert.equal(app.fetches.length, 4);

  app.stored[app.cacheKeys()[0]].savedAt = Date.now() - 24 * 60 * 60 * 1000 - 1;
  assert.equal((await app.lookup()).data.cached, false);
  assert.equal(app.fetches.length, 6);
});

test('simultaneous lookups share one request sequence', async t => {
  const started = deferred();
  const release = deferred();
  const app = await setup(t, {
    async fetchHandler(url) {
      if (url.pathname.startsWith('/works/')) {
        started.resolve();
        await release.promise;
        return response(work());
      }
      return response({ results: [{ id: 'https://openalex.org/A1234', cited_by_count: 12 }] });
    },
  });
  const first = app.lookup();
  await started.promise;
  const second = app.lookup();
  await new Promise(resolve => setTimeout(resolve, 20));
  release.resolve();
  const results = await Promise.all([first, second]);
  assert.ok(results.every(result => result.ok && result.data.authors[0].citationCount === 12));
  assert.equal(app.fetches.length, 2);
});

test('missing counts, truncated lists, and works with no authors are never cached', async t => {
  let truncated = false;
  let noAuthors = false;
  const app = await setup(t, {
    async fetchHandler(url) {
      if (url.pathname.startsWith('/works/')) {
        return response(noAuthors ? work({ authorships: [], authors_count: 0 }) : work({ is_authors_truncated: truncated }));
      }
      return response({ results: truncated ? [{ id: 'https://openalex.org/A1234', cited_by_count: 12 }] : [] });
    },
  });
  const incomplete = await app.lookup();
  assert.equal(incomplete.data.missingCount, 1);
  assert.deepEqual(app.cacheKeys(), []);
  truncated = true;
  const partialList = await app.lookup();
  assert.equal(partialList.data.truncated, true);
  assert.deepEqual(app.cacheKeys(), []);
  noAuthors = true;
  const emptyList = await app.lookup();
  assert.equal(emptyList.ok, true);
  assert.deepEqual(emptyList.data.authors, []);
  assert.deepEqual(app.cacheKeys(), []);
});

test('clearing cache is restricted to extension pages and preserves settings', async t => {
  const app = await setup(t, { initial: { apiKey: 'keep-this-key', preference: 'keep-this-setting' } });
  await app.lookup();
  assert.equal(await app.message({ type: 'AUTHORC_CLEAR_CACHE' }), undefined);
  assert.equal(app.cacheKeys().length, 1);
  assert.deepEqual(await app.clear(), { ok: true });
  assert.deepEqual(app.cacheKeys(), []);
  assert.equal(app.stored.apiKey, 'keep-this-key');
  assert.equal(app.stored.preference, 'keep-this-setting');
});

test('clear waits for an outstanding cache write and prevents stale results from repopulating it', async t => {
  const writeStarted = deferred();
  const finishWrite = deferred();
  const app = await setup(t, {
    async setHook(values) {
      if (Object.keys(values).some(key => key.startsWith('article:'))) {
        writeStarted.resolve();
        await finishWrite.promise;
      }
    },
  });
  const lookup = app.lookup();
  await writeStarted.promise;
  const clear = app.clear();
  finishWrite.resolve();
  const [result, cleared] = await Promise.all([lookup, clear]);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'SETTINGS_CHANGED');
  assert.deepEqual(cleared, { ok: true });
  assert.deepEqual(app.cacheKeys(), []);
});

test('changing API key aborts old work and uses the new key without returning stale results', async t => {
  const started = deferred();
  const release = deferred();
  const app = await setup(t, {
    initial: { apiKey: 'old-key' },
    async fetchHandler(url, init) {
      if (url.pathname.startsWith('/works/')) {
        if (url.searchParams.get('api_key') === 'old-key') {
          started.resolve(init.signal);
          await release.promise;
        }
        return response(work());
      }
      return response({ results: [{ id: 'https://openalex.org/A1234', cited_by_count: 42 }] });
    },
  });
  const oldLookup = app.lookup();
  const signal = await started.promise;
  await app.local.set({ apiKey: 'new-key' });
  assert.equal(signal.aborted, true);
  const newLookup = app.lookup();
  release.resolve();
  const [oldResult, newResult] = await Promise.all([oldLookup, newLookup]);
  assert.equal(oldResult.ok, false);
  assert.equal(oldResult.error.code, 'SETTINGS_CHANGED');
  assert.equal(newResult.ok, true);
  assert.equal(newResult.data.authors[0].citationCount, 42);
  assert.equal(app.cacheKeys().length, 1);
  assert.equal(app.fetches.filter(({ url }) => url.pathname.startsWith('/works/') && url.searchParams.get('api_key') === 'new-key').length, 1);
  assert.equal((await app.lookup()).data.cached, true);
});

test('a settings change during storage read retries with current credentials', async t => {
  const readStarted = deferred();
  const finishRead = deferred();
  let intercepted = false;
  const app = await setup(t, {
    initial: { apiKey: 'old-key' },
    async getHook(keys) {
      if (!intercepted && Array.isArray(keys)) {
        intercepted = true;
        readStarted.resolve();
        await finishRead.promise;
      }
    },
  });
  const lookup = app.lookup();
  await readStarted.promise;
  await app.local.set({ apiKey: 'new-key' });
  finishRead.resolve();
  assert.equal((await lookup).ok, true);
  assert.ok(app.fetches.every(({ url }) => url.searchParams.get('api_key') === 'new-key'));
});

test('malformed and future-dated cache records are ignored', async t => {
  const app = await setup(t);
  await app.lookup();
  const key = app.cacheKeys()[0];
  app.stored[key].savedAt = Date.now() + 60_000;
  assert.equal((await app.lookup()).data.cached, false);
  app.stored[key] = null;
  app.stored['article:malformed'] = null;
  assert.equal((await app.lookup()).ok, true);
  assert.equal(app.fetches.length, 6);
  assert.ok(!Object.hasOwn(app.stored, 'article:malformed'));
});

test('unexpected storage errors cannot leak credentials or raw exception text', async t => {
  const secret = 'do-not-leak-api-key';
  const app = await setup(t, {
    async getHook() {
      const error = new Error(`Storage failed with ${secret}`);
      error.userMessage = secret;
      throw error;
    },
  });
  const result = await app.lookup();
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'LOOKUP_FAILED');
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(app.fetches.length, 0);
});

test('cache storage failures do not discard successfully fetched citation counts', async t => {
  const app = await setup(t, {
    async setHook() { throw new Error('Storage quota exceeded'); },
  });
  const result = await app.lookup();
  assert.equal(result.ok, true);
  assert.equal(result.data.authors[0].citationCount, 1250);
  assert.deepEqual(app.cacheKeys(), []);
});

test('opening options handles Chrome failures without leaving a pending message', async t => {
  const app = await setup(t, {
    async openOptions() { throw new Error('Options unavailable'); },
    async sendTabMessage() { throw new Error('No content script'); },
  });
  const result = await app.message({ type: 'AUTHORC_OPEN_OPTIONS' });
  assert.equal(result.ok, false);
  assert.match(result.error.message, /Chrome extensions page/);
  await assert.doesNotReject(app.toolbar({ id: 1 }));
});

test('lookups require explicit consent and status never exposes settings', async t => {
  const app = await setup(t, { initial: { automaticLookupEnabled: false, apiKey: 'private-key' } });
  assert.deepEqual(await app.message({ type: 'AUTHORC_GET_STATUS' }), { ok: true, enabled: false });
  assert.equal((await app.lookup()).error.code, 'CONSENT_REQUIRED');
  delete app.stored.automaticLookupEnabled;
  assert.equal((await app.lookup()).error.code, 'CONSENT_REQUIRED');
  assert.equal(app.fetches.length, 0);
  assert.equal(await app.message({ type: 'AUTHORC_GET_STATUS' }, { ...PAGE, id: 'foreign' }), undefined);
  await app.toolbar({ id: 1 });
  assert.equal(app.optionsOpened(), 1);
  assert.equal(app.tabMessages.length, 0);
});

test('enable starts lookups and pause clears cached results and notifies tabs', async t => {
  const app = await setup(t, { initial: { automaticLookupEnabled: false } });
  await app.local.set({ automaticLookupEnabled: true });
  assert.deepEqual(await app.message({ type: 'AUTHORC_GET_STATUS' }), { ok: true, enabled: true });
  assert.equal((await app.lookup()).ok, true);
  assert.equal(app.cacheKeys().length, 1);
  await app.local.set({ automaticLookupEnabled: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(app.cacheKeys(), []);
  assert.equal((await app.lookup()).error.code, 'CONSENT_REQUIRED');
  assert.equal(app.fetches.length, 2);
  assert.ok(app.tabMessages.some(({ message }) => message.type === 'AUTHORC_STATUS_CHANGED'));
  assert.ok(app.tabMessages.every(({ message }) => Object.keys(message).join() === 'type'));
});

test('revoking consent aborts an in-flight lookup and prevents later author requests', async t => {
  const started = deferred();
  const release = deferred();
  const app = await setup(t, {
    async fetchHandler(_url, init) {
      started.resolve(init.signal);
      await release.promise;
      init.signal.throwIfAborted();
      return response(work());
    },
  });
  const lookup = app.lookup();
  const signal = await started.promise;
  await app.local.set({ automaticLookupEnabled: false });
  assert.equal(signal.aborted, true);
  release.resolve();
  assert.equal((await lookup).ok, false);
  assert.equal(app.fetches.length, 1);
  assert.deepEqual(app.cacheKeys(), []);
});

test('new installation opens disclosure settings without enabling lookups', async t => {
  const app = await setup(t, { initial: { automaticLookupEnabled: false } });
  app.installed('install');
  app.installed('update');
  assert.equal(app.optionsOpened(), 1);
  assert.equal(app.stored.automaticLookupEnabled, false);
});
