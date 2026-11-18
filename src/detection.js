(() => {
  "use strict";

  function text(value) {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  }

  function decode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function normalizeDoi(value) {
    if (typeof value !== "string" || value.length > 2048) return null;
    let candidate = value.trim().replace(/^doi\s*:\s*/i, "");
    if (/^https?:\/\//i.test(candidate)) {
      try {
        const url = new URL(candidate);
        if (!/^(?:dx\.)?doi\.org$/i.test(url.hostname)) return null;
        candidate = url.pathname.slice(1);
      } catch {
        return null;
      }
    } else {
      candidate = candidate.split(/[?#]/, 1)[0];
    }
    candidate = decode(candidate);
    return /^10\.\d{4,9}\/[^\s"?#]+$/i.test(candidate) ? candidate.toLowerCase() : null;
  }

  function parseUrl(value, base) {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
      const url = new URL(value, base);
      return /^(https?:)$/.test(url.protocol) ? url : null;
    } catch {
      return null;
    }
  }

  function doiFromUrl(value) {
    const url = parseUrl(value);
    if (!url) return null;
    const resolverDoi = normalizeDoi(url.href);
    if (resolverDoi) return resolverDoi;
    const path = decode(url.pathname);
    if (/(^|\.)plos\.org$/i.test(url.hostname) && /\/article\/?$/.test(path)) {
      return normalizeDoi(url.searchParams.get("id"));
    }
    if (/(^|\.)nature\.com$/i.test(url.hostname)) {
      const match = path.match(/^\/articles\/(s\d{5}-\d{3}-\d{5}-[\dx]|[a-z]+\d+[a-z]?\d*)(?:\.pdf)?\/?$/i);
      if (match) return normalizeDoi(`10.1038/${match[1]}`);
    }
    // DOI routes are article identifiers; arbitrary links and reference text are never scanned.
    const route = path.match(/^\/(?:doi\/(?:abs\/|full\/|epdf\/|pdf\/|pdfplus\/)?|article\/|content\/|articles\/)(10\.\d{4,9}\/.+)$/i);
    if (route) return normalizeDoi(route[1]);
    return null;
  }

  function metadata(doc) {
    const values = new Map();
    for (const node of doc.querySelectorAll("meta")) {
      const name = text(node.getAttribute("name") || node.getAttribute("property")).toLowerCase();
      const content = text(node.getAttribute("content"));
      if (!name || !content) continue;
      if (!values.has(name)) values.set(name, []);
      values.get(name).push(content);
    }
    return values;
  }

  function first(meta, names) {
    for (const name of names) {
      if (meta.has(name)) return meta.get(name)[0];
    }
    return null;
  }

  function all(meta, names) {
    for (const name of names) {
      if (meta.has(name)) return [...new Set(meta.get(name))];
    }
    return [];
  }

  function yearOf(value) {
    const match = text(value).match(/\b(1[6-9]\d{2}|20\d{2}|21\d{2})\b/);
    return match ? Number(match[1]) : null;
  }

  function typesOf(node) {
    return [node?.["@type"]].flat().filter(value => typeof value === "string")
      .map(value => value.replace(/^https?:\/\/schema\.org\//, ""));
  }

  function samePage(a, b) {
    const left = parseUrl(a, b);
    const right = parseUrl(b);
    return Boolean(left && right && left.hostname.replace(/^www\./, "") === right.hostname.replace(/^www\./, "")
      && left.pathname.replace(/\/$/, "") === right.pathname.replace(/\/$/, ""));
  }

  function jsonCandidates(doc, pageUrl, canonical) {
    const candidates = [];
    const consider = node => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return;
      if (typesOf(node).includes("ScholarlyArticle")) candidates.push(node);
      if (typesOf(node).some(type => ["WebPage", "MedicalWebPage"].includes(type))) {
        for (const entity of [node.mainEntity].flat()) {
          if (typesOf(entity).includes("ScholarlyArticle")) candidates.push(entity);
        }
      }
    };
    for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
      if (!script.textContent || script.textContent.length > 1_000_000) continue;
      try {
        const parsed = JSON.parse(script.textContent);
        for (const node of [parsed].flat()) {
          consider(node);
          for (const member of [node?.["@graph"]].flat()) consider(member);
        }
      } catch {
        // A malformed publisher block must not disable other metadata.
      }
    }
    const eligible = candidates.filter(node => {
      const references = [node.mainEntityOfPage, node.url, node["@id"]].flat().map(value =>
        typeof value === "object" ? value?.["@id"] || value?.url : value)
        .filter(value => typeof value === "string" && parseUrl(value, pageUrl));
      const pageReferences = references.filter(value => !normalizeDoi(value));
      return !pageReferences.length || pageReferences.some(value => samePage(value, pageUrl)
        || (canonical && samePage(value, canonical)));
    });
    if (eligible.length === 1) return eligible[0];
    const matched = eligible.filter(node => [node.mainEntityOfPage, node.url, node["@id"]].flat()
      .some(value => samePage(typeof value === "object" ? value?.["@id"] || value?.url : value, pageUrl)));
    return matched.length === 1 ? matched[0] : null;
  }

  function jsonDoi(node) {
    if (!node) return null;
    const candidates = [];
    for (const value of [node.identifier, node.sameAs, node["@id"]].flat()) {
      if (typeof value === "string") candidates.push(normalizeDoi(value));
      else if (value && /^(doi|https?:\/\/(?:dx\.)?doi\.org\/?)$/i.test(value.propertyID || value.name || "")) {
        candidates.push(normalizeDoi(value.value));
      }
    }
    const distinct = [...new Set(candidates.filter(Boolean))];
    return distinct.length === 1 ? distinct[0] : null;
  }

  function jsonAuthors(node) {
    return [...new Set([node?.author].flat().map(author => {
      if (typeof author === "string") return text(author);
      return text(author?.name) || text([author?.givenName, author?.familyName].filter(Boolean).join(" "));
    }).filter(Boolean))];
  }

  function detectArticle(doc, pageUrl = doc.location?.href) {
    const page = parseUrl(pageUrl);
    if (!page || !doc.querySelectorAll) return null;
    const meta = metadata(doc);
    const canonicalNode = doc.querySelector('link[rel~="canonical"]');
    const canonical = parseUrl(canonicalNode?.getAttribute("href"), page.href)?.href || null;
    const currentDoi = doiFromUrl(page.href);
    const canonicalDoi = canonical && doiFromUrl(canonical);
    const json = jsonCandidates(doc, page.href, canonical);
    let doi = null;
    let source = null;
    for (const name of ["citation_doi", "dc.identifier", "dc.identifier.doi", "dcterms.identifier", "prism.doi", "bepress_citation_doi"]) {
      const candidates = [...new Set((meta.get(name) || []).map(normalizeDoi).filter(Boolean))];
      if (candidates.length > 1) return null;
      if (candidates.length === 1) {
        [doi] = candidates;
        source = "metadata";
        break;
      }
    }
    if (!doi) {
      doi = jsonDoi(json);
      if (doi) source = "json-ld";
    }
    if (currentDoi && ((doi && currentDoi !== doi) || (canonicalDoi && canonicalDoi !== currentDoi))) {
      return {doi: currentDoi, title: null, authorNames: [], year: null, pageUrl: page.href, source: "url"};
    }
    if (!doi) {
      doi = currentDoi || canonicalDoi;
      if (doi) source = "url";
    }
    const title = first(meta, ["citation_title", "bepress_citation_title", "prism.title", "dc.title", "dcterms.title"])
      || text(json?.headline || json?.name) || (doi && first(meta, ["og:title"])) || null;
    const authorNames = all(meta, ["citation_author", "bepress_citation_author", "dc.creator", "dcterms.creator"]);
    if (!authorNames.length) authorNames.push(...jsonAuthors(json));
    const year = yearOf(first(meta, ["citation_publication_date", "citation_date", "prism.publicationdate", "dc.date", "dc.issued", "dcterms.issued"]) || json?.datePublished);
    const scholarlyMeta = meta.has("citation_title") || meta.has("bepress_citation_title")
      || (meta.has("prism.title") && meta.has("prism.publicationname"));
    if (!doi && !(title && authorNames.length && (scholarlyMeta || json))) return null;
    return {doi, title, authorNames, year, pageUrl: page.href, source: source || (json ? "json-ld" : "metadata")};
  }

  globalThis.AuthorCDetection = Object.freeze({detectArticle, normalizeDoi});
})();
