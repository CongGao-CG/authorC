# authorC

A Chrome extension that automatically shows an author panel on publisher article pages. It matches the article to OpenAlex, ranks its authors by **total career citations**, and labels the highest-cited author **Author C**. The panel also links to the OpenAlex work and available author profiles.

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `authorC` folder.
4. Read the data-use notice in the settings page and click **Agree and enable**. Settings opens on first installation; you can also open **Options** from the extension menu.
5. Open an article page, or refresh an article tab that was already open.

No build step, package installation, or account is needed to load the extension. After editing the extension, click its **Reload** button on `chrome://extensions`, then refresh the article page. Chrome documents this workflow in [Load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked).

## Use

After you enable automatic lookups once, the panel appears at the bottom right when authorC detects scholarly article metadata or a supported article URL. For example, open the [Nature article](https://www.nature.com/articles/s41561-026-02139-2) from this project’s initial use case.

- Authors are sorted by their career citation totals in OpenAlex, highest first.
- **Author C** marks the highest available total. Tied authors share the label.
- Click the **OpenAlex work** link to visit the matching work.
- Collapse the panel to show the leading author’s name and citation count; click the compact pill or extension icon to reopen it.
- An unavailable citation count stays unavailable; it is never treated as zero. The panel discloses incomplete or truncated author data.
- **Pause automatic lookups** in Options stops detection and requests and clears cached results. The optional key remains until you remove it.

The citation count comes from each author’s `cited_by_count`, not the article’s citation count. It reflects OpenAlex’s indexed records and author disambiguation, so it can differ from other services. See [OpenAlex author data](https://help.openalex.org/data/authors/).

## Optional API key

Open the extension’s **Options** page from `chrome://extensions` or its Chrome toolbar context menu. You can save a personal OpenAlex API key there, or clear the field and save to remove it. A key is stored locally in this browser’s extension storage, never in Chrome Sync.

Basic OpenAlex queries work without a key; a verified key increases the available request budget. If a lookup reaches a limit, the panel reports the error. See [OpenAlex authentication and rate limits](https://help.openalex.org/api/authentication/) and [your OpenAlex API settings](https://openalex.org/settings/api).

Results are cached locally for up to **24 hours**. Use the panel’s **↻** button to fetch fresh counts, or **Clear cached results** in Options and refresh the article page. Changing the API key also invalidates saved results. Incomplete rankings are not cached.

## Matching and limits

authorC prefers an article’s DOI and requests that exact work. It does not scan reference lists for a DOI. If no DOI is available, scholarly title and author metadata may support a title lookup; ambiguous matches are rejected. A failed DOI lookup is not replaced with a guessed title match.

Detection depends on the publisher’s metadata and URL. Some pages do not expose enough information, and new articles may not yet be in OpenAlex. The extension does not run on Chrome’s internal pages or inside its built-in PDF viewer. OpenAlex may omit an author, lack their citation count, or truncate a large author list; the panel reports the available data and its limitations.

## Permissions and privacy

Automatic detection needs permission to inspect ordinary web pages. It starts only after the in-extension notice and explicit enable action. The content script looks for article metadata locally; it does not send the full article, a complete browsing history, or cookies. Only a detected DOI or scholarly article title, followed by matching OpenAlex work and author IDs, is sent to `api.openalex.org`. These identifiers reveal which article is being looked up. Author names used to check a title match stay local. OpenAlex sees these requests, their network address, and an optional API key. There is no analytics service or separate authorC server. See the [privacy policy](privacy.html).

The optional API key stays in the extension’s trusted settings and background contexts. The page panel receives results, not the key. Cached results are pruned as new results are saved; **Clear cached results** removes them immediately. Settings remain locally until changed or the extension is removed. Requests to OpenAlex run in the background service worker, following Chrome’s [cross-origin request model](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).

## Development

The extension uses Manifest V3 and plain JavaScript. Run its automated checks with Node.js:

```sh
npm test
npm run check
```

No runtime dependencies or bundler are required. API tests use controlled responses so they can check matching, missing data, ties, and error handling without consuming OpenAlex requests.

Automated tests use controlled fixtures. The compact panel was observed working in a user-provided screenshot; the packaged 0.2.0 release still needs a live Chrome check because browser launch and live API access are unavailable in the development sandbox. The example’s work ID and citation counts are not hardcoded into the extension.

## Chrome Web Store release

The submission materials are in [`store/`](store/SUBMISSION-CHECKLIST.md): listing copy, privacy disclosures, reviewer notes, and artwork. Publisher: **Cong Gao**; support: **cnggao@gmail.com**.

```sh
npm run package
npm run store:screenshots
```

The first command creates `dist/authorC-0.2.0.zip` with runtime files only and synchronizes the public policy into `docs/`. The second captures the actual panel renderer over a clearly labeled example article at 1280 × 800. It uses an existing Chrome and Playwright installation; it installs nothing. Run screenshot capture from a normal terminal if the sandbox cannot launch Chrome. See [demo instructions](store/demo/README.md).

The authorized repository visibility is **public**, with **main** as its branch. Repository creation and policy hosting are pending while GitHub access is unavailable in this workspace. From a normal terminal authenticated with GitHub CLI:

```sh
npm run publish:github
```

That command creates a new public `authorC` repository under the authenticated GitHub account, pushes `main`, and enables GitHub Pages from `main` → `/docs`. It refuses to overwrite an existing repository. Verify the printed privacy URL after Pages builds, then enter it in the store dashboard. See [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

The Chrome Web Store account, registration fee, contact verification, publisher declarations, dashboard certifications, and final submission remain account-owner actions. No Chrome Web Store item has been submitted or published by this preparation.
