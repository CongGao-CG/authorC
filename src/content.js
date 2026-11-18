(() => {
  if (globalThis.__authorCActive) return;
  globalThis.__authorCActive = true;

  const { detectArticle } = globalThis.AuthorCDetection;
  const formatNumber = new Intl.NumberFormat();
  let host;
  let root;
  let body;
  let panel;
  let launcher;
  let article = null;
  let identity = '';
  let pageUrl = null;
  let requestNumber = 0;
  let minimized = false;
  let scanTimer;
  let currentData;
  let navigationTimer;
  let lastArticleIdentity = '';
  let lastArticlePage = '';
  let enabled = false;
  let pageActive = true;
  let statusRequest = 0;
  let lookupPending = false;

  function navigationKey(url) {
    const value = new URL(url);
    value.hash = '';
    return value.href;
  }

  const css = `
    :host { all: initial !important; position: fixed !important; right: 20px !important; bottom: 20px !important; z-index: 2147483646 !important; color-scheme: light !important; }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    .panel, .launcher { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; line-height: 1.45; color: #203b36; background: #fcfbf7; border: 1px solid #d7dfd7; box-shadow: 0 12px 48px #15352a26, 0 2px 8px #15352a12; }
    .panel { width: 364px; max-width: calc(100vw - 24px); border-radius: 16px; overflow: hidden; }
    header { display: flex; align-items: center; padding: 15px 17px; gap: 10px; border-bottom: 1px solid #e7e9df; }
    .mark { display: grid; place-items: center; width: 32px; height: 32px; background: #254e42; color: #f6f0d8; border-radius: 9px; font: 600 22px Georgia, serif; }
    .brand { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -.5px; }
    .brand span { color: #63846d; }
    .subtitle { font-size: 10px; color: #68776e; letter-spacing: .6px; }
    .spacer { flex: 1; }
    button, a { -webkit-tap-highlight-color: transparent; }
    button { cursor: pointer; font: inherit; }
    button:focus-visible, a:focus-visible { outline: 2px solid #34816b; outline-offset: 3px; }
    button:disabled { cursor: wait; opacity: .55; }
    .icon { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 6px; background: transparent; color: #63776c; font-size: 18px; }
    .icon:hover { background: #e9eee5; color: #203b36; }
    .body { max-height: min(560px, calc(100dvh - 114px)); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin; }
    .paper { padding: 16px 18px 12px; }
    .paper-title { margin: 0 0 8px; font-size: 13px; line-height: 1.5; font-weight: 500; color: #47594d; overflow-wrap: anywhere; }
    a { color: #25624e; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .work-link { font-size: 12px; font-weight: 600; }
    .hero { margin: 0 16px 15px; padding: 16px; background: #eaf0e5; border: 1px solid #dce5d4; border-radius: 10px; }
    .eyebrow { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #62735e; margin-bottom: 5px; }
    .winner { margin: 0; font-size: 18px; font-weight: 650; line-height: 1.35; overflow-wrap: anywhere; }
    .winner + .winner { margin-top: 5px; }
    .total { margin: 10px 0 0; font-size: 30px; font-weight: 650; line-height: 1.15; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
    .caption { color: #60715e; font-size: 11px; margin-top: 3px; }
    .list-heading { display: flex; justify-content: space-between; gap: 8px; padding: 0 18px 8px; font-size: 11px; color: #68776e; }
    .list-heading strong { color: #384f41; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    td { padding: 10px 6px; border-top: 1px solid #ebede6; vertical-align: top; }
    td:first-child { width: 34px; padding-left: 18px; color: #849183; font-size: 10px; padding-top: 12px; }
    td:last-child { padding-right: 18px; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .author-name { overflow-wrap: anywhere; }
    .top-row { background: #f1f4eb; }
    .tag { display: inline-block; margin-left: 5px; padding: 1px 4px; border-radius: 3px; font-size: 9px; font-weight: 700; background: #dfe9d6; color: #446340; vertical-align: 1px; }
    .unavailable { color: #899188; font-size: 10px; }
    .notice { margin: 0 16px 12px; padding: 10px 12px; border-radius: 7px; background: #f6efdc; color: #76603a; font-size: 11px; line-height: 1.5; }
    footer { padding: 12px 18px; border-top: 1px solid #e7e9df; font-size: 10px; line-height: 1.6; color: #7a8578; }
    .state { padding: 24px 20px; }
    .state h3 { margin: 0 0 8px; font-size: 16px; }
    .state p { margin: 0 0 14px; color: #6a776b; font-size: 12px; line-height: 1.6; }
    .state p:last-child { margin-bottom: 0; }
    .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
    .button { border: 1px solid #d6dfd2; border-radius: 7px; padding: 7px 12px; background: #edf2e8; color: #315742; font-size: 12px; }
    .loading { width: 21px; height: 21px; margin-bottom: 14px; border: 2px solid #dbe5d3; border-top-color: #537a58; border-radius: 50%; animation: spin 1s linear infinite; }
    .launcher { display: flex; align-items: center; gap: 9px; max-width: min(364px, calc(100vw - 24px)); border-radius: 30px; padding: 9px 14px 9px 9px; font-weight: 650; }
    .launcher .mark { flex: 0 0 25px; width: 25px; height: 25px; border-radius: 50%; font-size: 17px; }
    .launcher-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .launcher-count { flex-shrink: 0; color: #677b65; font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .loading { animation: none; } }
    @media (max-width: 440px) { :host { right: 12px !important; bottom: 12px !important; } .panel { width: calc(100vw - 24px); } }
  `;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, text, className, action) {
    const node = element('button', className, text);
    node.type = 'button';
    node.title = label;
    node.setAttribute('aria-label', label);
    node.addEventListener('click', action);
    return node;
  }

  function safeLink(text, url, className = '') {
    const node = element('a', className, text);
    if (/^https:\/\/openalex\.org\/(?:works\/W\d+|authors\/A\d+|[AW]\d+)$/i.test(url || '')) {
      node.href = url;
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
    }
    return node;
  }

  function setMinimized(value, focus = false) {
    minimized = value;
    panel.hidden = value;
    launcher.hidden = !value;
    if (focus) (value ? launcher : panel.querySelector('button')).focus();
  }

  function openOptions() {
    chrome.runtime.sendMessage({ type: 'AUTHORC_OPEN_OPTIONS' }).catch(() => {});
  }

  function updateLauncher(winners = []) {
    const name = winners.map(author => author.name).join(' · ') || 'authorC';
    launcher.querySelector('.launcher-name').textContent = name;
    launcher.querySelector('.launcher-count')?.remove();
    const count = winners.length ? formatNumber.format(winners[0].citationCount) : '';
    const label = count ? `Expand authorC: ${name}, ${count} career citations${winners.length > 1 ? ' each' : ''}` : 'Expand authorC';
    launcher.title = label;
    launcher.setAttribute('aria-label', label);
    if (count) launcher.append(element('span', 'launcher-count', count));
  }

  function ensurePanel() {
    if (host?.isConnected) return;
    host = document.createElement('authorc-panel');
    root = host.attachShadow({ mode: 'closed' });
    const style = element('style');
    style.textContent = css;
    panel = element('section', 'panel');
    panel.setAttribute('aria-label', 'authorC citation rankings');
    const header = element('header');
    const name = element('div');
    const brand = element('h2', 'brand', 'author');
    brand.append(element('span', '', 'C'));
    name.append(brand, element('div', 'subtitle', 'AUTHOR CITATIONS · OPENALEX'));
    header.append(
      element('div', 'mark', 'C'), name, element('div', 'spacer'),
      button('Refresh citation counts', '↻', 'icon', () => article && loadArticle(true)),
      button('authorC settings', '⚙', 'icon', openOptions),
      button('Minimize authorC', '−', 'icon', () => setMinimized(true, true)),
    );
    body = element('div', 'body');
    panel.append(header, body);
    launcher = button('Expand authorC', '', 'launcher', () => setMinimized(false, true));
    launcher.append(element('span', 'mark', 'C'), element('span', 'launcher-name', 'authorC'));
    root.append(style, panel, launcher);
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !minimized) {
        event.stopPropagation();
        setMinimized(true, true);
      }
    });
    document.documentElement.append(host);
    setMinimized(minimized);
  }

  function renderState(title, message, { loading = false, retry = false } = {}) {
    ensurePanel();
    const state = element('div', 'state');
    state.setAttribute('role', loading ? 'status' : 'region');
    state.setAttribute('aria-live', 'polite');
    if (loading) state.append(element('div', 'loading'));
    state.append(element('h3', '', title), element('p', '', message));
    if (retry) {
      const buttons = element('div', 'buttons');
      buttons.append(
        button('Retry OpenAlex lookup', 'Try again', 'button', () => loadArticle(true)),
        button('Open authorC settings', 'Settings', 'button', openOptions),
      );
      state.append(buttons);
    }
    body.replaceChildren(state);
    updateLauncher();
    panel.querySelector('button').disabled = loading || !article;
  }

  function renderResults(data) {
    ensurePanel();
    currentData = data;
    panel.querySelector('button').disabled = false;
    const paper = element('div', 'paper');
    paper.append(element('p', 'paper-title', data.work.title || article.title || article.doi));
    paper.append(safeLink('OpenAlex work ↗', data.work.url, 'work-link'));
    const children = [paper];
    const winners = data.authors.filter(author => author.isAuthorC);
    if (winners.length) {
      const hero = element('div', 'hero');
      hero.append(element('div', 'eyebrow', winners.length > 1 ? 'Author C · tied' : 'Author C'));
      for (const author of winners) {
        const name = element('h3', 'winner');
        name.append(safeLink(author.name, author.url));
        hero.append(name);
      }
      hero.append(element('div', 'total', formatNumber.format(winners[0].citationCount)));
      hero.append(element('div', 'caption', `total career citations${winners.length > 1 ? ' each' : ''}`));
      if (data.missingCount || data.truncated) hero.append(element('div', 'caption', 'Highest available total · incomplete author data'));
      children.push(hero);
    }
    for (const warning of data.warnings || []) children.push(element('div', 'notice', warning));
    if (data.authors.length) {
      const heading = element('div', 'list-heading');
      heading.append(element('strong', '', `${data.authors.length} ${data.authors.length === 1 ? 'author' : 'authors'}`), element('span', '', 'Career citations'));
      const table = element('table');
      table.setAttribute('aria-label', 'Authors ranked by total career citations');
      const caption = element('caption', 'sr-only', 'Author, citation rank, and total career citations in OpenAlex');
      const thead = element('thead', 'sr-only');
      const columnNames = element('tr');
      for (const title of ['Rank', 'Author', 'Career citations']) {
        const th = element('th', '', title);
        th.scope = 'col';
        columnNames.append(th);
      }
      thead.append(columnNames);
      const rows = element('tbody');
      let rank = 0;
      let previousCount = null;
      data.authors.forEach((author, index) => {
        if (author.citationCount !== previousCount || index === 0) rank = index + 1;
        previousCount = author.citationCount;
        const row = element('tr', author.isAuthorC ? 'top-row' : '');
        const name = element('td', 'author-name');
        name.append(safeLink(author.name, author.url));
        if (author.isAuthorC) name.append(element('span', 'tag', 'C'));
        const known = Number.isFinite(author.citationCount);
        row.append(element('td', '', known ? String(rank) : '—'), name, element('td', known ? '' : 'unavailable', known ? formatNumber.format(author.citationCount) : 'Unavailable'));
        rows.append(row);
      });
      table.append(caption, thead, rows);
      children.push(heading, table);
    }
    const footer = element('footer');
    const date = new Date(data.fetchedAt);
    const time = Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    footer.append(element('div', '', 'Career totals reported by OpenAlex; coverage may vary.'));
    footer.append(element('div', '', `${data.cached ? 'Cached' : 'Updated'}${time ? ` ${time}` : ''}${data.matchMethod === 'title' ? ' · matched by title and author' : ' · matched by DOI'}`));
    children.push(footer);
    body.replaceChildren(...children);
    updateLauncher(winners);
  }

  async function loadArticle(force = false) {
    if (!enabled || !pageActive || !article) return;
    const token = ++requestNumber;
    lookupPending = true;
    const requestedArticle = article;
    currentData = null;
    renderState('Finding Author C…', 'Matching this article in OpenAlex and collecting its authors’ career citation totals.', { loading: true });
    try {
      const result = await chrome.runtime.sendMessage({ type: 'AUTHORC_LOOKUP', article: requestedArticle, force });
      if (token !== requestNumber) return;
      if (navigationKey(location.href) !== navigationKey(pageUrl)) { scan(); return; }
      if (result?.error?.code === 'CONSENT_REQUIRED') { setEnabled(false); return; }
      if (!result?.ok) {
        renderState('Unable to load this article', result?.error?.message || 'OpenAlex did not return a result. Please try again.', { retry: true });
        return;
      }
      renderResults(result.data);
    } catch (error) {
      if (token !== requestNumber) return;
      if (navigationKey(location.href) !== navigationKey(pageUrl)) { scan(); return; }
      const message = /context invalidated/i.test(error.message || '')
        ? 'authorC was updated. Reload this page to reconnect the extension.'
        : 'The extension could not connect. Reload this page or try again.';
      renderState('Connection interrupted', message, { retry: true });
    } finally {
      if (token === requestNumber) lookupPending = false;
    }
  }

  function reset() {
    requestNumber += 1;
    article = null;
    identity = '';
    currentData = null;
    host?.remove();
    host = null;
    minimized = false;
  }

  function scan() {
    if (!enabled || !pageActive) return;
    clearTimeout(scanTimer);
    scanTimer = undefined;
    if (pageUrl && navigationKey(location.href) !== navigationKey(pageUrl)) {
      reset();
    }
    pageUrl = location.href;
    let candidate;
    try { candidate = detectArticle(document, pageUrl); } catch { return; }
    if (!candidate) {
      if (article) reset();
      return;
    }
    const nextIdentity = candidate.doi?.toLowerCase() || JSON.stringify([candidate.title, candidate.year, candidate.authorNames]);
    if (nextIdentity === identity) return;
    // A SPA can change its URL before replacing the previous article's metadata.
    if (nextIdentity === lastArticleIdentity && navigationKey(pageUrl) !== lastArticlePage && candidate.source !== 'url') return;
    article = candidate;
    identity = nextIdentity;
    lastArticleIdentity = nextIdentity;
    lastArticlePage = navigationKey(pageUrl);
    loadArticle();
  }

  function scheduleScan() {
    if (!enabled || !pageActive) return;
    if (!scanTimer) scanTimer = setTimeout(scan, 400);
  }

  const observer = new MutationObserver(records => {
    if (!enabled || !pageActive) return;
    if (records.some(record => {
      if (record.target === host || host?.contains(record.target)) return false;
      const target = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
      if (target?.closest('head, meta, script[type="application/ld+json"]')) return true;
      return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE && (node.matches('meta, script[type="application/ld+json"]') || node.querySelector('meta, script[type="application/ld+json"]')));
    })) scheduleScan();
  });
  function startMonitoring() {
    if (!enabled || !pageActive || navigationTimer !== undefined) return;
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['content', 'href', 'name', 'property', 'type', 'rel'], characterData: true });
    // The isolated content script cannot intercept a publisher's history.pushState.
    navigationTimer = setInterval(() => { if (!document.hidden && location.href !== pageUrl) scheduleScan(); }, 1000);
  }

  function stopMonitoring() {
    clearInterval(navigationTimer);
    navigationTimer = undefined;
    clearTimeout(scanTimer);
    scanTimer = undefined;
    observer.disconnect();
    requestNumber += 1;
    lookupPending = false;
  }

  function setEnabled(value) {
    enabled = value === true;
    if (!enabled) {
      stopMonitoring();
      reset();
      pageUrl = null;
      lastArticleIdentity = '';
      lastArticlePage = '';
      return;
    }
    if (!pageActive) return;
    startMonitoring();
    scan();
    if (article && !currentData && !lookupPending) loadArticle();
  }

  async function refreshStatus() {
    const token = ++statusRequest;
    try {
      const status = await chrome.runtime.sendMessage({ type: 'AUTHORC_GET_STATUS' });
      if (token === statusRequest) setEnabled(status?.ok && status.enabled === true);
    } catch {
      if (token === statusRequest) setEnabled(false);
    }
  }

  window.addEventListener('popstate', scheduleScan);
  window.addEventListener('hashchange', scheduleScan);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleScan(); });
  window.addEventListener('pagehide', () => {
    pageActive = false;
    statusRequest += 1;
    stopMonitoring();
  });
  window.addEventListener('pageshow', () => {
    pageActive = true;
    refreshStatus();
  });
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'AUTHORC_STATUS_CHANGED') { refreshStatus(); return; }
    if (message?.type !== 'AUTHORC_SHOW') return;
    refreshStatus().then(() => {
      if (!enabled) { openOptions(); return; }
      if (!article) renderState('Open a research article', 'Visit an article on its publisher’s website. authorC appears automatically when it finds article metadata. If you just installed authorC, reload the page.');
      else if (currentData) renderResults(currentData);
      ensurePanel();
      setMinimized(false, true);
    });
  });
  refreshStatus();
})();
