(() => {
  const listeners = [];
  const authors = [
    { id: 'A0', name: 'Jordan Ellis', citationCount: 18420, worksCount: 145, url: 'https://openalex.org/authors/A0', isAuthorC: true },
    { id: 'A1', name: 'Maya Rivera', citationCount: 7420, worksCount: 82, url: 'https://openalex.org/authors/A1', isAuthorC: false },
    { id: 'A2', name: 'Alex Chen', citationCount: 2310, worksCount: 39, url: 'https://openalex.org/authors/A2', isAuthorC: false },
  ];
  const result = {
    work: { id: 'W0', title: 'How coastal communities adapt to changing storm risk', doi: '10.0000/authorc.demo', url: 'https://openalex.org/works/W0', publicationYear: 2026 },
    authors,
    authorCount: authors.length,
    missingCount: 0,
    truncated: false,
    warnings: [],
    fetchedAt: '2026-11-18T15:00:00Z',
    matchMethod: 'doi',
    cached: false,
  };

  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (options) {
    const root = originalAttachShadow.call(this, options);
    if (this.localName === 'authorc-panel') globalThis.__authorCDemoRoot = root;
    return root;
  };

  globalThis.chrome = {
    runtime: {
      id: 'authorc-local-demo',
      async sendMessage(message) {
        if (message.type === 'AUTHORC_GET_STATUS') return { ok: true, enabled: true };
        if (message.type === 'AUTHORC_LOOKUP') return { ok: true, data: structuredClone(result) };
        if (message.type === 'AUTHORC_OPEN_OPTIONS') return { ok: true };
        throw new Error(`Unexpected demo message: ${message.type}`);
      },
      onMessage: { addListener(listener) { listeners.push(listener); } },
    },
  };
  globalThis.__authorCDemoShow = () => listeners.forEach(listener => listener({ type: 'AUTHORC_SHOW' }));
})();
