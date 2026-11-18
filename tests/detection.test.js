import assert from "node:assert/strict";
import test from "node:test";
import "../src/detection.js";

const {detectArticle, normalizeDoi} = globalThis.AuthorCDetection;

function documentFixture({url = "https://journal.example/papers/123", meta = [], canonical, json = [], body = ""} = {}) {
  const node = attrs => ({getAttribute: name => attrs[name] ?? null});
  return {
    location: {href: url},
    body: {textContent: body},
    querySelector: selector => selector === 'link[rel~="canonical"]' && canonical ? node({href: canonical}) : null,
    querySelectorAll: selector => selector === "meta" ? meta.map(attrs => node(attrs))
      : selector === 'script[type="application/ld+json"]' ? json.map(value => ({textContent: typeof value === "string" ? value : JSON.stringify(value)})) : [],
  };
}

test("normalizes DOI labels, resolver URLs, encoded punctuation and case", () => {
  assert.equal(normalizeDoi(" DOI: 10.1038/ABC-123 "), "10.1038/abc-123");
  assert.equal(normalizeDoi("https://doi.org/10.1002/(SICI)1097-4571;2-0?utm_source=a#fig1"), "10.1002/(sici)1097-4571;2-0");
  assert.equal(normalizeDoi("https://dx.doi.org/10.1002/%28SICI%29test"), "10.1002/(sici)test");
  assert.equal(normalizeDoi("10.1000/has;semicolon"), "10.1000/has;semicolon");
  assert.equal(normalizeDoi("10.1000/path/to/doi"), "10.1000/path/to/doi");
  assert.equal(normalizeDoi("https://example.com/10.1000/wrong"), null);
  assert.equal(normalizeDoi("A citation 10.1000/anything"), null);
  assert.equal(normalizeDoi("10.1/invalid"), null);
  assert.equal(normalizeDoi(null), null);
});

test("extracts publisher citation metadata with full author list and publication year", () => {
  const doc = documentFixture({meta: [
    {name: "citation_doi", content: "10.1038/s41561-026-02139-2"},
    {name: "citation_title", content: "  A study\n of hurricanes  "},
    {name: "citation_author", content: "Cong Gao"},
    {name: "citation_author", content: "Jane Doe"},
    {name: "citation_author", content: "Cong Gao"},
    {name: "citation_publication_date", content: "2026/11/18"},
  ]});
  assert.deepEqual(detectArticle(doc), {
    doi: "10.1038/s41561-026-02139-2", title: "A study of hurricanes", authorNames: ["Cong Gao", "Jane Doe"],
    year: 2026, pageUrl: doc.location.href, source: "metadata",
  });
});

test("supports mixed-case Dublin Core and PRISM metadata", () => {
  assert.equal(detectArticle(documentFixture({meta: [
    {name: "DC.Identifier", content: "doi:10.1000/ABC"},
  ]})).doi, "10.1000/abc");
  assert.equal(detectArticle(documentFixture({meta: [
    {property: "prism.doi", content: "10.1000/ABC"},
  ]})).doi, "10.1000/abc");
});

test("detects the supplied Nature article even without metadata", () => {
  const result = detectArticle(documentFixture({url: "https://www.nature.com/articles/s41561-026-02139-2?utm_source=news#Fig1"}));
  assert.equal(result.doi, "10.1038/s41561-026-02139-2");
  assert.equal(result.source, "url");
});

test("recognizes publisher DOI routes without scanning arbitrary URLs", () => {
  for (const url of [
    "https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2025GL123456",
    "https://link.springer.com/article/10.1007/s12345-026-00123-4",
    "https://www.science.org/doi/10.1126/science.abc1234",
    "https://journals.example/doi/abs/10.1000/(ABC);123",
    "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.1234567",
  ]) assert.ok(detectArticle(documentFixture({url}))?.doi, url);
  assert.equal(detectArticle(documentFixture({url: "https://example.com/search?q=10.1000/not-an-article"})), null);
  assert.equal(detectArticle(documentFixture({url: "https://example.com/articles/unrelated"})), null);
});

test("can use a canonical article URL", () => {
  const result = detectArticle(documentFixture({canonical: "https://journal.example/doi/10.1000/main"}));
  assert.equal(result.doi, "10.1000/main");
});

test("does not activate for a citation or generic news metadata", () => {
  assert.equal(detectArticle(documentFixture({body: "References: https://doi.org/10.1000/reference"})), null);
  assert.equal(detectArticle(documentFixture({meta: [
    {property: "og:title", content: "A news story"},
    {name: "author", content: "News Reporter"},
  ], json: [{"@type": "NewsArticle", headline: "A news story", identifier: "10.1000/reference"}]})), null);
});

test("requires scholarly title and authors for title-only fallback", () => {
  assert.equal(detectArticle(documentFixture({meta: [{name: "citation_title", content: "Missing authors"}]})), null);
  const result = detectArticle(documentFixture({meta: [
    {name: "citation_title", content: "Article without DOI"},
    {name: "citation_author", content: "A. Author"},
  ]}));
  assert.equal(result.doi, null);
  assert.equal(result.title, "Article without DOI");
});

test("extracts a scholarly JSON-LD main entity, ignoring its references", () => {
  const result = detectArticle(documentFixture({json: [{"@type": "WebPage", mainEntity: {
    "@type": "ScholarlyArticle", headline: "Storm surge", datePublished: "2026-10-01",
    identifier: {"@type": "PropertyValue", propertyID: "doi", value: "10.1000/main"},
    author: [{"@type": "Person", name: "First Author"}, {givenName: "Second", familyName: "Author"}],
    citation: [{"@type": "ScholarlyArticle", identifier: "10.1000/reference"}],
  }}]}));
  assert.equal(result.doi, "10.1000/main");
  assert.deepEqual(result.authorNames, ["First Author", "Second Author"]);
  assert.equal(result.year, 2026);
});

test("does not treat nested JSON-LD references or unrelated graph entities as this article", () => {
  assert.equal(detectArticle(documentFixture({json: [{"@type": "Article", citation: {
    "@type": "ScholarlyArticle", identifier: "10.1000/reference",
  }}]})), null);
  assert.equal(detectArticle(documentFixture({json: [{"@graph": [
    {"@type": "ScholarlyArticle", url: "https://journal.example/papers/something-else", identifier: "10.1000/other"},
  ]}]})), null);
  assert.equal(detectArticle(documentFixture({json: [{"@graph": [
    {"@type": "ScholarlyArticle", identifier: "10.1000/one"},
    {"@type": "ScholarlyArticle", identifier: "10.1000/two"},
  ]}]})), null);
});

test("handles malformed JSON-LD without losing metadata", () => {
  const result = detectArticle(documentFixture({meta: [{name: "citation_doi", content: "10.1000/main"}], json: ["{broken"]}));
  assert.equal(result.doi, "10.1000/main");
  assert.equal(detectArticle(documentFixture({json: [{"@graph": null}, {"@graph": {"@type": "ScholarlyArticle", identifier: "10.1000/graph"}}]})).doi, "10.1000/graph");
});

test("rejects ambiguous DOI metadata", () => {
  assert.equal(detectArticle(documentFixture({meta: [
    {name: "citation_doi", content: "10.1000/one"}, {name: "citation_doi", content: "10.1000/two"},
  ]})), null);
});

test("current article URL overrides visibly stale SPA metadata", () => {
  const result = detectArticle(documentFixture({
    url: "https://www.nature.com/articles/s41561-026-02139-2",
    canonical: "https://www.nature.com/articles/s41561-026-00000-1",
    meta: [{name: "citation_doi", content: "10.1038/s41561-026-00000-1"},
      {name: "citation_title", content: "Old page title"}, {name: "citation_author", content: "Old Author"}],
  }));
  assert.equal(result.doi, "10.1038/s41561-026-02139-2");
  assert.equal(result.title, null);
  assert.deepEqual(result.authorNames, []);
});

test("ignores browser-internal URLs", () => {
  assert.equal(detectArticle(documentFixture({url: "chrome://extensions/"})), null);
});
