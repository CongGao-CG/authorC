const API_ORIGIN = "https://api.openalex.org";
const WORK_FIELDS = "id,doi,title,publication_year,authorships";
const AUTHOR_FIELDS = "id,display_name,cited_by_count,works_count";
const SPECIAL_AUTHORS = new Set(["A9999999999", "A5317838346"]);
const BATCH_SIZE = 100;

export class OpenAlexError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OpenAlexError";
    this.code = code;
    this.userMessage = message;
  }
}

function entityId(value, prefix) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(?:https?:\/\/openalex\.org\/(?:authors\/|works\/)?)?([AW]\d+)\/?$/i);
  return match?.[1]?.[0].toUpperCase() === prefix ? match[1].toUpperCase() : null;
}

function normalizeText(value) {
  return String(value ?? "").normalize("NFKD").replace(/\p{M}/gu, "")
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function normalizeName(value) {
  const pieces = String(value ?? "").split(",");
  return normalizeText(pieces.length === 2 ? `${pieces[1]} ${pieces[0]}` : value);
}

function normalizeDoi(value) {
  if (typeof value !== "string") return null;
  const doi = value.trim().replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, "");
  return /^10\.\d{4,9}\/\S+$/i.test(doi) && doi.length <= 2048 ? doi.toLowerCase() : null;
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new OpenAlexError("CANCELLED", "The lookup was cancelled. Try again."));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}

function responseError(status) {
  if (status === 404) return new OpenAlexError("NOT_FOUND", "This article is not available in OpenAlex yet.");
  if (status === 401 || status === 403) {
    return new OpenAlexError("AUTH", "OpenAlex rejected access. Add or check your API key in authorC settings.");
  }
  if (status === 429) {
    return new OpenAlexError("RATE_LIMIT", "OpenAlex's request limit was reached. Try again later, or add your API key in settings.");
  }
  return new OpenAlexError("API_ERROR", "OpenAlex is temporarily unavailable. Try again shortly.");
}

function makeClient({ apiKey, fetchImpl, signal }) {
  return async (path, params = {}) => {
    const url = new URL(path, API_ORIGIN);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (apiKey) url.searchParams.set("api_key", apiKey);
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const abort = () => controller.abort();
      const timer = setTimeout(abort, 12000);
      if (signal?.aborted) controller.abort();
      else signal?.addEventListener("abort", abort, { once: true });
      try {
        const response = await fetchImpl(url.href, {
          signal: controller.signal,
          credentials: "omit",
          referrerPolicy: "no-referrer",
          headers: { Accept: "application/json" },
        });
        if (response.status >= 500 && attempt === 0) {
          await delay(600, signal);
          continue;
        }
        if (!response.ok) throw responseError(response.status);
        const data = await response.json();
        if (!data || typeof data !== "object") {
          throw new OpenAlexError("INVALID_RESPONSE", "OpenAlex returned an unreadable response. Try again.");
        }
        return data;
      } catch (error) {
        if (error instanceof OpenAlexError) throw error;
        if (signal?.aborted) throw new OpenAlexError("CANCELLED", "The lookup took too long or was cancelled. Try again.");
        if (controller.signal.aborted) throw new OpenAlexError("TIMEOUT", "OpenAlex took too long to respond. Try again.");
        if (error instanceof SyntaxError) {
          throw new OpenAlexError("INVALID_RESPONSE", "OpenAlex returned an unreadable response. Try again.");
        }
        throw new OpenAlexError("NETWORK", "Cannot reach OpenAlex. Check your connection and try again.");
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    }
  };
}

async function findWork(article, request) {
  if (article.doi) {
    const doi = normalizeDoi(article.doi);
    if (!doi) throw new OpenAlexError("INVALID_ARTICLE", "The article's DOI could not be read.");
    return {
      work: await request(`/works/doi:${encodeURIComponent(doi)}`, { select: WORK_FIELDS }),
      matchMethod: "doi",
    };
  }

  const title = normalizeText(article.title);
  const names = new Set((Array.isArray(article.authorNames) ? article.authorNames : []).map(normalizeName).filter(Boolean));
  if (title.length < 15 || !names.size) {
    throw new OpenAlexError("NO_IDENTIFIER", "This page does not provide enough article metadata for a reliable OpenAlex match.");
  }
  const data = await request("/works", { search: String(article.title).slice(0, 1000), per_page: 100, select: WORK_FIELDS });
  if (!Array.isArray(data.results)) {
    throw new OpenAlexError("INVALID_RESPONSE", "OpenAlex returned an unreadable search result. Try again.");
  }
  const candidates = data.results.filter(work => {
    if (normalizeText(work.title) !== title) return false;
    if (article.year && work.publication_year !== article.year) return false;
    return work.authorships?.some(authorship =>
      names.has(normalizeName(authorship.raw_author_name)) ||
      names.has(normalizeName(authorship.author?.display_name)));
  });
  const unique = [...new Map(candidates.map(work => [entityId(work.id, "W"), work])).values()];
  if (unique.length !== 1 || Number(data.meta?.count) > 100) {
    throw new OpenAlexError(unique.length || Number(data.meta?.count) > 100 ? "AMBIGUOUS_MATCH" : "NOT_FOUND",
      unique.length || Number(data.meta?.count) > 100
        ? "The title does not identify a unique OpenAlex work. A DOI is needed for a reliable match."
        : "No OpenAlex work matched this article's title and author metadata.");
  }
  const id = entityId(unique[0].id, "W");
  if (!id) throw new OpenAlexError("INVALID_RESPONSE", "OpenAlex returned an invalid work identifier.");
  // Search results cap authorships at 100; always hydrate the chosen work.
  return { work: await request(`/works/${id}`, { select: WORK_FIELDS }), matchMethod: "title" };
}

function authorEntries(authorships) {
  const seen = new Set();
  return authorships.flatMap((authorship, index) => {
    const rawId = entityId(authorship?.author?.id, "A");
    const id = SPECIAL_AUTHORS.has(rawId) ? null : rawId;
    if (id && seen.has(id)) return [];
    if (id) seen.add(id);
    return [{
      id,
      name: String(authorship?.raw_author_name || authorship?.author?.display_name || `Author ${index + 1}`),
      citationCount: null,
      worksCount: null,
      url: id ? `https://openalex.org/authors/${id}` : null,
      isAuthorC: false,
      order: index,
    }];
  });
}

async function hydrateAuthors(entries, request, signal) {
  const ids = entries.map(author => author.id).filter(Boolean);
  const records = new Map();
  const aliases = new Map();
  const warnings = [];
  for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
    try {
      if (offset) await delay(150, signal);
      const data = await request("/authors", {
        filter: `openalex_id:${ids.slice(offset, offset + BATCH_SIZE).join("|")}`,
        per_page: BATCH_SIZE,
        select: AUTHOR_FIELDS,
      });
      if (!Array.isArray(data.results)) {
        throw new OpenAlexError("INVALID_RESPONSE", "OpenAlex returned an unreadable author response.");
      }
      for (const author of data.results) {
        const id = entityId(author.id, "A");
        if (id && !SPECIAL_AUTHORS.has(id)) records.set(id, author);
      }
      for (const merged of data.meta?.merged_ids ?? []) {
        const oldId = entityId(merged.id, "A");
        const newId = entityId(merged.merge_into_id, "A");
        if (oldId && newId) aliases.set(oldId, newId);
      }
    } catch (error) {
      warnings.push(error.userMessage || "Some author citation counts could not be retrieved. Try again.");
      break;
    }
  }

  const seen = new Set();
  const authors = entries.flatMap(entry => {
    let id = entry.id;
    const visited = new Set();
    while (aliases.has(id) && !visited.has(id)) {
      visited.add(id);
      id = aliases.get(id);
    }
    if (SPECIAL_AUTHORS.has(id)) id = null;
    if (id && seen.has(id)) return [];
    if (id) seen.add(id);
    const record = records.get(id);
    return [{
      ...entry,
      id,
      name: record?.display_name || entry.name,
      citationCount: count(record?.cited_by_count),
      worksCount: count(record?.works_count),
      url: id ? `https://openalex.org/authors/${id}` : null,
    }];
  });
  authors.sort((left, right) => {
    if (left.citationCount === null && right.citationCount !== null) return 1;
    if (right.citationCount === null && left.citationCount !== null) return -1;
    return (right.citationCount ?? 0) - (left.citationCount ?? 0) || left.order - right.order;
  });
  const maximum = authors[0]?.citationCount ?? null;
  return {
    authors: authors.map(({ order, ...author }) => ({
      ...author,
      isAuthorC: maximum !== null && author.citationCount === maximum,
    })),
    warnings,
  };
}

export async function lookupArticle(article, { apiKey = "", fetchImpl = fetch, signal } = {}) {
  if (!article || typeof article !== "object") {
    throw new OpenAlexError("INVALID_ARTICLE", "This page does not provide readable article metadata.");
  }
  const deadline = new AbortController();
  const abort = () => deadline.abort();
  const timer = setTimeout(abort, 60000);
  if (signal?.aborted) deadline.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  try {
    const request = makeClient({ apiKey, fetchImpl, signal: deadline.signal });
    const { work, matchMethod } = await findWork(article, request);
    const id = entityId(work.id, "W");
    if (!id || !Array.isArray(work.authorships)) {
      throw new OpenAlexError("INVALID_RESPONSE", "OpenAlex returned incomplete article metadata. Try again.");
    }
    const { authors, warnings } = await hydrateAuthors(authorEntries(work.authorships), request, deadline.signal);
    const truncated = Boolean(work.is_authors_truncated) ||
      (count(work.authors_count) ?? 0) > work.authorships.length || work.authorships.length >= 5000;
    const missingCount = authors.filter(author => author.citationCount === null).length;
    if (truncated) warnings.push("OpenAlex may not include the full author list. Author C is based on the available authors.");
    if (missingCount) warnings.push(`${missingCount} author${missingCount === 1 ? " has" : "s have"} no available citation count. Author C is based on retrieved counts.`);
    if (!authors.length) warnings.push("OpenAlex has no authors for this work yet.");
    return {
      work: {
        id,
        title: String(work.title || article.title || "Untitled article"),
        doi: normalizeDoi(work.doi),
        url: `https://openalex.org/works/${id}`,
        publicationYear: count(work.publication_year),
      },
      authors,
      authorCount: authors.length,
      missingCount,
      truncated,
      warnings,
      fetchedAt: new Date().toISOString(),
      matchMethod,
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
