import test from "node:test";
import assert from "node:assert/strict";
import { lookupArticle, OpenAlexError } from "../src/openalex.js";

const article = { doi: "10.1038/s41561-026-02139-2", title: "Hurricanes in a changing climate" };
const authorship = (id, name) => ({ author: { id: id ? `https://openalex.org/${id}` : null, display_name: name }, raw_author_name: name });
const profile = (id, citations, name = id) => ({ id: `https://openalex.org/${id}`, display_name: name, cited_by_count: citations, works_count: 25 });
const work = (authorships = [], extra = {}) => ({
  id: "https://openalex.org/W4415084259", title: article.title,
  doi: `https://doi.org/${article.doi}`, publication_year: 2026,
  authorships, ...extra,
});

function mockFetch(responses) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: new URL(url), options });
    assert.ok(responses.length, "No unexpected API requests");
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return new Response(JSON.stringify(response.body ?? response), { status: response.status ?? 200 });
  };
  return { calls, fetchImpl };
}

test("resolves the DOI and ranks career totals, not work citations", async () => {
  const { fetchImpl, calls } = mockFetch([
    work([authorship("A5000000001", "First"), authorship("A5000000002", "Second")], { cited_by_count: 3 }),
    { results: [profile("A5000000001", 180, "First"), profile("A5000000002", 42000, "Second")] },
  ]);
  const result = await lookupArticle(article, { fetchImpl, apiKey: "test-key" });
  assert.equal(result.work.url, "https://openalex.org/works/W4415084259");
  assert.equal(result.matchMethod, "doi");
  assert.equal(result.authors[0].name, "Second");
  assert.equal(result.authors[0].citationCount, 42000);
  assert.equal(result.authors[0].isAuthorC, true);
  assert.equal(result.authors[1].isAuthorC, false);
  assert.equal(result.missingCount, 0);
  assert.equal(calls[0].url.origin, "https://api.openalex.org");
  assert.equal(decodeURIComponent(calls[0].url.pathname), `/works/doi:${article.doi}`);
  assert.equal(calls[1].url.searchParams.get("filter"), "openalex_id:A5000000001|A5000000002");
  assert.equal(calls[0].url.searchParams.get("api_key"), "test-key");
  assert.equal(calls[0].url.searchParams.get("select"), "id,doi,title,publication_year,authorships");
  assert.equal(calls[0].options.credentials, "omit");
  assert.ok(!JSON.stringify(result).includes("test-key"));
});

test("retains all tied leaders with byline order as deterministic tie-break", async () => {
  const { fetchImpl } = mockFetch([
    work([authorship("A5000000002", "Zed"), authorship("A5000000001", "Ada"), authorship("A5000000003", "Last")]),
    { results: [profile("A5000000001", 99, "Ada"), profile("A5000000003", 8, "Last"), profile("A5000000002", 99, "Zed")] },
  ]);
  const result = await lookupArticle(article, { fetchImpl });
  assert.deepEqual(result.authors.map(author => [author.name, author.isAuthorC]), [["Zed", true], ["Ada", true], ["Last", false]]);
});

test("distinguishes real zero from missing, invalid, and special author counts", async () => {
  const { fetchImpl, calls } = mockFetch([
    work([
      authorship("A5000000001", "Zero"), authorship("A5000000002", "Missing"),
      authorship("A9999999999", "Unresolved one"), authorship("A9999999999", "Unresolved two"),
      authorship("A5317838346", "Deleted"), authorship(null, "No ID"), authorship("A5000000003", "Negative"),
    ]),
    { results: [profile("A5000000001", 0), profile("A5000000003", -5)] },
  ]);
  const result = await lookupArticle(article, { fetchImpl });
  assert.equal(result.authorCount, 7);
  assert.equal(result.missingCount, 6);
  assert.equal(result.authors[0].citationCount, 0);
  assert.equal(result.authors[0].isAuthorC, true);
  assert.ok(result.authors.slice(1).every(author => author.citationCount === null && !author.isAuthorC));
  assert.ok(!calls[1].url.searchParams.get("filter").includes("A9999999999"));
  assert.ok(result.warnings.some(warning => warning.includes("6 authors")));
});

test("deduplicates repeated and merged author IDs", async () => {
  const { fetchImpl } = mockFetch([
    work([authorship("A5000000001", "Old"), authorship("A5000000001", "Repeated"), authorship("A5000000002", "Current")]),
    { meta: { merged_ids: [{ id: "https://openalex.org/A5000000001", merge_into_id: "https://openalex.org/A5000000002" }] }, results: [profile("A5000000002", 200, "Current")] },
  ]);
  const result = await lookupArticle(article, { fetchImpl });
  assert.equal(result.authors.length, 1);
  assert.equal(result.authors[0].id, "A5000000002");
  assert.equal(result.authors[0].citationCount, 200);
});

test("batches more than 100 authors and includes the final author in ranking", async () => {
  const records = Array.from({ length: 205 }, (_, index) => profile(`A${5000000000 + index}`, index));
  const { fetchImpl, calls } = mockFetch([
    work(records.map(author => authorship(author.id.split("/").at(-1), author.display_name))),
    { results: records.slice(0, 100) }, { results: records.slice(100, 200) }, { results: records.slice(200) },
  ]);
  const result = await lookupArticle(article, { fetchImpl });
  assert.equal(result.authorCount, 205);
  assert.equal(result.authors[0].citationCount, 204);
  assert.equal(calls.length, 4);
  assert.equal(calls[3].url.searchParams.get("filter").split("|").length, 5);
});

test("accepts singleton responses without author-count or truncation fields", async () => {
  const singleton = work([authorship("A5000000001", "Available")]);
  assert.ok(!Object.hasOwn(singleton, "authors_count"));
  assert.ok(!Object.hasOwn(singleton, "is_authors_truncated"));
  const { fetchImpl } = mockFetch([singleton, { results: [profile("A5000000001", 123)] }]);
  const result = await lookupArticle(article, { fetchImpl });
  assert.equal(result.truncated, false);
  assert.equal(result.authorCount, 1);
  assert.deepEqual(result.warnings, []);
});

test("honors a truncation marker if an API response happens to supply one", async () => {
  const { fetchImpl } = mockFetch([
    work([authorship("A5000000001", "Available")], { authors_count: 500, is_authors_truncated: true }),
    { results: [profile("A5000000001", 123)] },
  ]);
  const result = await lookupArticle(article, { fetchImpl });
  assert.equal(result.truncated, true);
  assert.ok(result.warnings.some(warning => warning.includes("full author list")));
});

test("warns at the documented 5,000-authorship cap without optional counter fields", async () => {
  const { fetchImpl } = mockFetch([work(Array.from({ length: 5000 }, (_, index) => authorship(null, `Author ${index}`)))]);
  const result = await lookupArticle(article, { fetchImpl });
  assert.equal(result.truncated, true);
  assert.ok(result.warnings.some(warning => warning.includes("full author list")));
});

test("keeps the work link and unavailable author rows when author requests fail", async () => {
  const { fetchImpl } = mockFetch([
    work([authorship("A5000000001", "First"), authorship("A5000000002", "Second")]),
    { status: 429, body: { error: "limit" } },
  ]);
  const result = await lookupArticle(article, { fetchImpl });
  assert.equal(result.missingCount, 2);
  assert.ok(result.authors.every(author => !author.isAuthorC));
  assert.ok(result.work.url);
  assert.ok(result.warnings.some(warning => warning.includes("limit")));
});

test("preserves earlier citation batches when a later batch fails", async () => {
  const records = Array.from({ length: 101 }, (_, index) => profile(`A${5000000000 + index}`, index));
  const { fetchImpl } = mockFetch([
    work(records.map(author => authorship(author.id.split("/").at(-1), author.display_name))),
    { results: records.slice(0, 100) }, new TypeError("Network disconnected"),
  ]);
  const result = await lookupArticle(article, { fetchImpl });
  assert.equal(result.authorCount, 101);
  assert.equal(result.missingCount, 1);
  assert.equal(result.authors[0].citationCount, 99);
  assert.equal(result.authors.at(-1).citationCount, null);
  assert.ok(result.warnings.some(warning => warning.includes("retrieved counts")));
});

test("matches title only with author and year evidence and hydrates full authorships", async () => {
  const candidate = work([authorship("A5000000001", "Jane Smith")]);
  const { fetchImpl, calls } = mockFetch([
    { meta: { count: 1 }, results: [candidate] }, candidate,
    { results: [profile("A5000000001", 200, "Jane Smith")] },
  ]);
  const result = await lookupArticle({ title: "HURRICANES: in a changing climate", authorNames: ["Smith, Jane"], year: 2026 }, { fetchImpl });
  assert.equal(result.matchMethod, "title");
  assert.equal(calls[1].url.pathname, "/works/W4415084259");
});

test("rejects title collisions rather than choosing the most cited match", async () => {
  const candidate = work([authorship("A5000000001", "Jane Smith")]);
  const { fetchImpl } = mockFetch([{ meta: { count: 2 }, results: [candidate, { ...candidate, id: "https://openalex.org/W4000000000" }] }]);
  await assert.rejects(lookupArticle({ title: article.title, authorNames: ["Jane Smith"] }, { fetchImpl }), { code: "AMBIGUOUS_MATCH" });
});

test("declines title matching when unexamined search results could hide a collision", async () => {
  const { fetchImpl } = mockFetch([{ meta: { count: 101 }, results: [work([authorship("A5000000001", "Jane Smith")])] }]);
  await assert.rejects(lookupArticle({ title: article.title, authorNames: ["Jane Smith"] }, { fetchImpl }), { code: "AMBIGUOUS_MATCH" });
});

test("rejects title-only guesses and mismatched author/year metadata", async () => {
  await assert.rejects(lookupArticle({ title: article.title }, { fetchImpl: () => assert.fail("No request without author evidence") }), { code: "NO_IDENTIFIER" });
  const { fetchImpl } = mockFetch([{ meta: { count: 1 }, results: [work([authorship("A5000000001", "Someone Else")])] }]);
  await assert.rejects(lookupArticle({ title: article.title, authorNames: ["Jane Smith"] }, { fetchImpl }), { code: "NOT_FOUND" });
  const otherYear = mockFetch([{ meta: { count: 1 }, results: [work([authorship("A5000000001", "Jane Smith")])] }]);
  await assert.rejects(lookupArticle({ title: article.title, authorNames: ["Jane Smith"], year: 2020 }, otherYear), { code: "NOT_FOUND" });
});

test("does not fall back to title when a DOI is not indexed", async () => {
  const { fetchImpl, calls } = mockFetch([{ status: 404, body: {} }]);
  await assert.rejects(lookupArticle({ ...article, authorNames: ["Jane Smith"] }, { fetchImpl }), { code: "NOT_FOUND" });
  assert.equal(calls.length, 1);
});

test("rejects malformed DOI metadata without outbound requests", async () => {
  await assert.rejects(lookupArticle({ doi: "https://evil.example/path" }, { fetchImpl: () => assert.fail("No request") }), { code: "INVALID_ARTICLE" });
});

test("reports actionable authentication and network errors without leaking credentials", async () => {
  const { fetchImpl } = mockFetch([{ status: 403, body: { message: "Sensitive server diagnostic" } }]);
  await assert.rejects(lookupArticle(article, { fetchImpl, apiKey: "secret" }), error => {
    assert.ok(error instanceof OpenAlexError);
    assert.equal(error.code, "AUTH");
    assert.ok(!error.message.includes("secret"));
    return true;
  });
  const offline = mockFetch([new TypeError("Failed to fetch https://api.openalex.org?api_key=secret")]);
  await assert.rejects(lookupArticle(article, offline), { code: "NETWORK" });
});

test("retries a temporary server error once", async () => {
  const { fetchImpl, calls } = mockFetch([{ status: 503, body: {} }, work([])]);
  const result = await lookupArticle(article, { fetchImpl });
  assert.equal(calls.length, 2);
  assert.equal(result.authorCount, 0);
  assert.ok(result.warnings.some(warning => warning.includes("no authors")));
});

test("rejects invalid API JSON and invalid work identifiers", async () => {
  await assert.rejects(lookupArticle(article, { fetchImpl: async () => new Response("not JSON") }), { code: "INVALID_RESPONSE" });
  const { fetchImpl } = mockFetch([work([], { id: "https://evil.example/W123" })]);
  await assert.rejects(lookupArticle(article, { fetchImpl }), { code: "INVALID_RESPONSE" });
});

test("propagates cancellation before resolving a work", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(lookupArticle(article, {
    signal: controller.signal,
    fetchImpl: async (_url, options) => {
      options.signal.throwIfAborted();
    },
  }), { code: "CANCELLED" });
});
