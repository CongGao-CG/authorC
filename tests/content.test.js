import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/content.js', import.meta.url), 'utf8');
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

class Element {
  constructor(tag) { this.tag = tag; this.nodeType = 1; this.children = []; this.attributes = {}; this.listeners = {}; }
  get isConnected() { return this.tag === 'html' || Boolean(this.parentElement?.isConnected); }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.text = value; this.children = []; }
  set innerHTML(_value) { throw new Error('The panel must not parse fetched content as HTML.'); }
  setAttribute(name, value) { this.attributes[name] = value; }
  append(...nodes) { nodes.forEach(node => { node.parentElement = this; this.children.push(node); }); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this); this.parentElement = null; }
  attachShadow() { this.shadow = new Element('shadow'); this.shadow.parentElement = this; return this.shadow; }
  matches(selector) { return selector.split(',').some(value => { value = value.trim(); return value === this.tag || (value.startsWith('.') && this.className === value.slice(1)) || (value === 'script[type="application/ld+json"]' && this.tag === 'script' && this.attributes.type === 'application/ld+json'); }); }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelector(selector) { for (const child of this.children) { if (child.matches(selector)) return child; const nested = child.querySelector(selector); if (nested) return nested; } return null; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  dispatch(name, event = {}) { for (const listener of this.listeners[name] || []) listener(event); }
  focus() {}
}

function article(doi) { return {doi, title: doi, authorNames: ['Author'], source: 'metadata'}; }
function result(title) { return {ok: true, data: {work: {title, url: 'https://openalex.org/works/W1'}, authors: [], fetchedAt: '2026-11-18T12:00:00Z', matchMethod: 'doi'}}; }

async function controller(initialArticle = article('10.1000/first'), options = {}) {
  const documentElement = new Element('html');
  const head = new Element('head');
  const body = new Element('body');
  documentElement.append(head, body);
  const listeners = new Map();
  const intervals = new Map();
  const timeouts = new Map();
  const requests = [];
  const location = {href: 'https://journal.example/articles/first'};
  let candidate = initialArticle;
  let timerId = 0;
  let observer;
  let enabled = options.enabled ?? true;
  let messageListener;
  let detectionCalls = 0;
  let optionsOpened = 0;
  const statusRequests = [];
  const addEventListener = (name, listener) => {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(listener);
  };
  const context = {
    console, URL, Intl, location, Node: {ELEMENT_NODE: 1},
    window: {addEventListener},
    document: {documentElement, hidden: false, createElement: tag => new Element(tag), addEventListener},
    AuthorCDetection: {detectArticle: (_doc, pageUrl) => { detectionCalls += 1; return candidate && {...candidate, pageUrl}; }},
    MutationObserver: class {
      constructor(callback) { this.callback = callback; observer = this; }
      observe() { this.active = true; }
      disconnect() { this.active = false; }
    },
    chrome: {runtime: {
      sendMessage: message => {
        if (message.type === 'AUTHORC_GET_STATUS') {
          statusRequests.push(message);
          return options.statusHandler ? options.statusHandler() : Promise.resolve({ok: true, enabled});
        }
        if (message.type === 'AUTHORC_OPEN_OPTIONS') { optionsOpened += 1; return Promise.resolve({ok: true}); }
        return new Promise((resolve, reject) => requests.push({message, resolve, reject}));
      },
      onMessage: {addListener(listener) { messageListener = listener; }},
    }},
    setTimeout: callback => { timeouts.set(++timerId, callback); return timerId; },
    clearTimeout: id => timeouts.delete(id),
    setInterval: callback => { intervals.set(++timerId, callback); return timerId; },
    clearInterval: id => intervals.delete(id),
  };
  vm.runInNewContext(source, context);
  await flushPromises();
  return {
    requests, location, head, body, intervals,
    statusRequests,
    detectionCalls: () => detectionCalls,
    optionsOpened: () => optionsOpened,
    setStatus: value => { enabled = value; },
    setEnabled: async value => { enabled = value; messageListener({type: 'AUTHORC_STATUS_CHANGED'}); await flushPromises(); },
    message: async value => { messageListener(value); await flushPromises(); },
    isObserving: () => observer.active === true,
    setCandidate: value => { candidate = value; },
    panel: () => documentElement.querySelector('authorc-panel')?.shadow,
    event: (name, event = {}) => { for (const listener of listeners.get(name) || []) listener(event); },
    tick: () => { for (const callback of [...intervals.values()]) callback(); },
    flush: () => { const pending = [...timeouts.values()]; timeouts.clear(); pending.forEach(callback => callback()); },
    mutate: ({target = head, addedNodes = [], removedNodes = []} = {}) => { if (observer.active) observer.callback([{target, addedNodes, removedNodes}]); },
  };
}

test('ignores an old lookup after navigation and renders only the new article', async () => {
  const page = await controller();
  page.location.href = 'https://journal.example/articles/second';
  page.setCandidate(article('10.1000/second'));
  page.tick();
  page.flush();
  assert.equal(page.requests.length, 2);
  page.requests[0].resolve(result('Old article result'));
  await flushPromises();
  assert.ok(!page.panel().textContent.includes('Old article result'));
  page.requests[1].resolve(result('New article result'));
  await flushPromises();
  assert.ok(page.panel().textContent.includes('New article result'));
});

test('waits for changed metadata after an SPA URL changes', async () => {
  const page = await controller();
  page.requests[0].resolve(result('First article'));
  await flushPromises();
  page.location.href = 'https://journal.example/articles/second';
  page.tick();
  page.flush();
  assert.equal(page.requests.length, 1);
  assert.equal(page.panel(), undefined);
  page.setCandidate(article('10.1000/second'));
  page.mutate();
  page.flush();
  assert.equal(page.requests.length, 2);
  assert.equal(page.requests[1].message.article.doi, '10.1000/second');
});

test('hash-only navigation retains the result without another request', async () => {
  const page = await controller();
  page.requests[0].resolve(result('Current article'));
  await flushPromises();
  page.location.href += '#references';
  page.event('hashchange');
  page.flush();
  assert.equal(page.requests.length, 1);
  assert.ok(page.panel().textContent.includes('Current article'));
});

test('rescans JSON-LD text changes and removals in the document body', async () => {
  const page = await controller(null);
  const script = new Element('script');
  script.setAttribute('type', 'application/ld+json');
  page.body.append(script);
  page.setCandidate(article('10.1000/json'));
  page.mutate({target: {nodeType: 3, parentElement: script}});
  page.flush();
  assert.equal(page.requests.length, 1);
  page.setCandidate(null);
  script.remove();
  page.mutate({target: page.body, removedNodes: [script]});
  page.flush();
  assert.equal(page.panel(), undefined);
});

test('resumes mutation detection and navigation polling after a BFCache restore', async () => {
  const page = await controller();
  page.requests[0].resolve(result('Current article'));
  await flushPromises();
  page.event('pagehide', {persisted: true});
  assert.equal(page.intervals.size, 0);
  page.event('pageshow', {persisted: true});
  await flushPromises();
  assert.equal(page.intervals.size, 1);
  assert.equal(page.requests.length, 1);
  page.setCandidate(article('10.1000/updated'));
  page.mutate();
  page.flush();
  assert.equal(page.requests.length, 2);
  page.event('pagehide', {persisted: true});
  page.event('pageshow', {persisted: true});
  await flushPromises();
  assert.equal(page.intervals.size, 1);
});

test('restarts an unfinished lookup after a BFCache restore', async () => {
  const page = await controller();
  page.event('pagehide', {persisted: true});
  page.event('pageshow', {persisted: true});
  await flushPromises();
  assert.equal(page.requests.length, 2);
  page.requests[0].resolve(result('Expired lookup'));
  await flushPromises();
  assert.ok(!page.panel().textContent.includes('Expired lookup'));
  page.requests[1].resolve(result('Restored lookup'));
  await flushPromises();
  assert.ok(page.panel().textContent.includes('Restored lookup'));
});

test('does not render a rejected old lookup on a newly navigated page', async () => {
  const page = await controller();
  page.location.href = 'https://journal.example/articles/second';
  page.requests[0].reject(new Error('Network error'));
  await flushPromises();
  assert.equal(page.panel(), undefined);
  assert.equal(page.requests.length, 1);
});

test('renders career totals, the OpenAlex work link, and unavailable authors safely', async () => {
  const page = await controller();
  const data = result('Paper <script>alert(1)</script>');
  data.data.authors = [
    {name: 'Top Author <img src=x onerror=alert(1)>', url: 'https://openalex.org/authors/A1', citationCount: 12345, isAuthorC: true},
    {name: 'Missing Author', url: 'javascript:alert(1)', citationCount: null, isAuthorC: false},
  ];
  data.data.missingCount = 1;
  page.requests[0].resolve(data);
  await flushPromises();
  const root = page.panel();
  assert.equal(root.querySelector('.work-link').href, 'https://openalex.org/works/W1');
  assert.equal(root.querySelector('.work-link').target, '_blank');
  assert.equal(root.querySelector('.winner').textContent, 'Top Author <img src=x onerror=alert(1)>');
  assert.equal(root.querySelector('.total').textContent, new Intl.NumberFormat().format(12345));
  assert.ok(root.textContent.includes('total career citations'));
  assert.equal(root.querySelector('.unavailable').textContent, 'Unavailable');
  const rows = root.querySelector('tbody').children;
  assert.equal(rows[1].querySelector('a').href, undefined);
  assert.equal(root.querySelector('img'), null);
  assert.equal(root.querySelector('script'), null);
});

test('minimizes and reopens the panel without another lookup', async () => {
  const page = await controller();
  const data = result('Current article');
  data.data.authors = [{name: 'Top Author', url: 'https://openalex.org/authors/A1', citationCount: 42, isAuthorC: true}];
  page.requests[0].resolve(data);
  await flushPromises();
  const root = page.panel();
  const panel = root.querySelector('.panel');
  const launcher = root.querySelector('.launcher');
  const minimize = root.querySelector('header').children.find(node => node.attributes['aria-label'] === 'Minimize authorC');
  minimize.dispatch('click');
  assert.equal(panel.hidden, true);
  assert.equal(launcher.hidden, false);
  assert.equal(launcher.querySelector('.launcher-count').textContent, '42');
  launcher.dispatch('click');
  assert.equal(panel.hidden, false);
  assert.equal(launcher.hidden, true);
  assert.equal(page.requests.length, 1);
});

test('shows an empty-author warning once', async () => {
  const page = await controller();
  const data = result('Article without authors');
  data.data.warnings = ['OpenAlex has no authors for this work yet.'];
  page.requests[0].resolve(data);
  await flushPromises();
  assert.equal(page.panel().textContent.match(/OpenAlex has no authors/g)?.length, 1);
});

test('does not inspect article metadata or observe pages before explicit enable', async () => {
  const page = await controller(article('10.1000/private'), {enabled: false});
  page.event('popstate');
  page.event('visibilitychange');
  page.tick();
  page.flush();
  assert.equal(page.detectionCalls(), 0);
  assert.equal(page.requests.length, 0);
  assert.equal(page.intervals.size, 0);
  assert.equal(page.isObserving(), false);
  assert.equal(page.panel(), undefined);
  assert.equal(JSON.stringify(page.statusRequests), '[{"type":"AUTHORC_GET_STATUS"}]');
  await page.message({type: 'AUTHORC_SHOW'});
  assert.equal(page.optionsOpened(), 1);
  assert.equal(page.detectionCalls(), 0);
});

test('enabling starts detection and revoking removes the panel and ignores pending results', async () => {
  const page = await controller(article('10.1000/article'), {enabled: false});
  await page.setEnabled(true);
  assert.equal(page.detectionCalls(), 1);
  assert.equal(page.requests.length, 1);
  assert.equal(page.isObserving(), true);
  await page.setEnabled(false);
  assert.equal(page.panel(), undefined);
  assert.equal(page.isObserving(), false);
  assert.equal(page.intervals.size, 0);
  page.requests[0].resolve(result('Discarded after pause'));
  await flushPromises();
  assert.equal(page.panel(), undefined);
  const detections = page.detectionCalls();
  page.event('hashchange');
  page.flush();
  assert.equal(page.detectionCalls(), detections);
  await page.setEnabled(true);
  assert.equal(page.requests.length, 2);
});

test('rechecks consent after BFCache restore before reading metadata again', async () => {
  const page = await controller();
  page.event('pagehide', {persisted: true});
  page.setStatus(false);
  const detections = page.detectionCalls();
  page.event('pageshow', {persisted: true});
  await flushPromises();
  assert.equal(page.detectionCalls(), detections);
  assert.equal(page.panel(), undefined);
  assert.equal(page.isObserving(), false);
});

test('a failed consent status check leaves detection disabled', async () => {
  const page = await controller(article('10.1000/private'), {statusHandler: () => Promise.reject(new Error('Disconnected'))});
  assert.equal(page.detectionCalls(), 0);
  assert.equal(page.requests.length, 0);
  assert.equal(page.isObserving(), false);
});
