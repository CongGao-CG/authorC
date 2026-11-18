# authorC — Reviewer test instructions

## Text for the Test instructions field

authorC displays an automatic on-page ranking of the article’s authors by total career citations reported by OpenAlex.

1. Install version 0.2.0, open Settings, review the data-use notice, and click **Agree and enable automatic lookups**. Automatic lookups start disabled. Then open an ordinary publisher HTML article page with DOI metadata. If that tab was already open before installation, reload it.
2. Example target: https://www.nature.com/articles/nclimate1389 — “Physically based assessment of hurricane surge threat under climate change” (2012), DOI `10.1038/nclimate1389`. Publisher availability and OpenAlex indexing are external dependencies; this URL is a test target, not a hardcoded work mapping.
3. The panel appears in the bottom-right corner after matching the work. Check that it shows a work title, an OpenAlex work link, a ranked author list, and the highest available total labeled Author C. Counts are author career totals, not the article’s own citations.
4. Click the OpenAlex work link and an author link to inspect the corresponding records. Counts may change as OpenAlex updates.
5. Minimize the panel. The compact pill shows the leading author’s name and citation count. Click it, or the toolbar icon, to reopen the panel.
6. Use the panel’s refresh control to bypass the cache. Settings can clear the local cache or save/remove an optional personal OpenAlex API key. Pause automatic lookups to stop detection and requests and clear cached results; enable again to resume.

The extension has no authorC account, login, payment, or subscription flow. No test credentials are needed for its own features. OpenAlex may impose anonymous request limits; if a limit is reached, the panel explains the failure. A reviewer may use their own OpenAlex API key if needed. No shared secret is embedded in this package.

Article matching prefers the exact DOI. Without a DOI, a scholarly title is accepted only with matching author evidence and, when available, publication year; ambiguous results are rejected. Missing author counts remain unavailable rather than zero. Tied leaders share the label. An incomplete or truncated author list is disclosed in the panel.

All executable code is packaged locally. The only automatic network endpoint is https://api.openalex.org/. OpenAlex JSON is data, not downloaded code. Broad HTTP/HTTPS page access supports automatic detection across publisher domains; unrelated pages do not trigger article lookups unless they expose qualifying article metadata.

## Internal verification record — do not paste as completed testing

The two manually saved listing screenshots show the Nature example article with the expanded four-author ranking and the compact author-name pill. Both were checked at 1280 × 800 with square edges and readable UI. They do not independently verify installation, consent behavior, other publisher sites, or later changes to citation totals.

Automated tests cover matching, ranking, missing data, UI state, cache handling, and consent behavior. The development environment could not launch Chrome or make live API requests. Before submission, extract `dist/authorC-0.2.0.zip`, load it in a fresh Chrome profile, confirm that no OpenAlex request occurs before enabling, and perform the steps above against live records. This final browser check remains pending.

Listing screenshots are saved manually from the installed extension on the Nature example article.
