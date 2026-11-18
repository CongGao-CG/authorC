# authorC — Reviewer test instructions

## Text for the Test instructions field

authorC displays an automatic on-page ranking of the article’s authors by total career citations reported by OpenAlex.

1. Install version 0.2.0, open Settings, review the data-use notice, and click **Agree and enable automatic lookups**. Automatic lookups start disabled. Then open an ordinary publisher HTML article page with DOI metadata. If that tab was already open before installation, reload it.
2. Example target: https://www.nature.com/articles/s41561-026-02139-2. Publisher availability and OpenAlex indexing are external dependencies; this URL is a test target, not a hardcoded work mapping.
3. The panel appears in the bottom-right corner after matching the work. Check that it shows a work title, an OpenAlex work link, a ranked author list, and the highest available total labeled Author C. Counts are author career totals, not the article’s own citations.
4. Click the OpenAlex work link and an author link to inspect the corresponding records. Counts may change as OpenAlex updates.
5. Minimize the panel. The compact pill shows the leading author’s name and citation count. Click it, or the toolbar icon, to reopen the panel.
6. Use the panel’s refresh control to bypass the cache. Settings can clear the local cache or save/remove an optional personal OpenAlex API key. Pause automatic lookups to stop detection and requests and clear cached results; enable again to resume.

The extension has no authorC account, login, payment, or subscription flow. No test credentials are needed for its own features. OpenAlex may impose anonymous request limits; if a limit is reached, the panel explains the failure. A reviewer may use their own OpenAlex API key if needed. No shared secret is embedded in this package.

Article matching prefers the exact DOI. Without a DOI, a scholarly title is accepted only with matching author evidence and, when available, publication year; ambiguous results are rejected. Missing author counts remain unavailable rather than zero. Tied leaders share the label. An incomplete or truncated author list is disclosed in the panel.

All executable code is packaged locally. The only automatic network endpoint is https://api.openalex.org/. OpenAlex JSON is data, not downloaded code. Broad HTTP/HTTPS page access supports automatic detection across publisher domains; unrelated pages do not trigger article lookups unless they expose qualifying article metadata.

## Internal verification record — do not paste as completed testing

A user supplied a screenshot of a working compact panel in the development conversation. It showed the original brand label and a citation total; the compact label was subsequently changed to the author’s name. That screenshot does not verify the release package, all publisher sites, the full author list, or current counts.

Automated tests cover matching, ranking, missing data, UI state, cache handling, and consent behavior. The development environment could not launch Chrome or make live API requests. Before submission, extract `dist/authorC-0.2.0.zip`, load it in a fresh Chrome profile, confirm that no OpenAlex request occurs before enabling, and perform the steps above against live records. This final browser check remains pending.

`npm run store:screenshots` captures the actual UI code with clearly labeled fictional example data for listing images. It is not a live OpenAlex test, and its PNG outputs are still pending because the sandbox could not launch the browser.
