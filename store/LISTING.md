# authorC — Chrome Web Store listing

Prepared from the extension source on 18 November 2026. Copy only the text under each dashboard field; the surrounding notes are for the publisher.

## Name

authorC

## Short description

Find a paper in OpenAlex and highlight its most-cited author by total career citations.

This matches `manifest.json`; the store obtains the name and short description from the uploaded package.

## Detailed description

See a paper’s authors ranked by their total career citations while you read the article on its publisher’s website.

authorC detects article metadata, finds the matching OpenAlex work, and displays a compact panel alongside the page. The author with the highest available career citation total is highlighted as Author C.

On first use, review the data-use notice and enable automatic OpenAlex lookups in Settings. After that, the panel loads automatically on supported article pages. Pause automatic lookups in Settings whenever you want.

What you can do:

- Compare the available authors’ career citation totals in one ranked list.
- Open the matched OpenAlex work or an available author profile.
- Minimize the panel to a pill showing the leading author’s name and citation count.
- Expand the panel again or refresh the citation counts.
- See ties and unavailable counts explicitly.

Citation totals come from each author’s OpenAlex profile across their indexed publications. They are not the citation count of the article you are reading. Coverage and author identification depend on OpenAlex.

How it works and what it reads:

authorC checks article metadata and the current page URL locally so it can activate automatically across publisher websites. For a detected article, it sends the DOI—or the article title when there is no DOI—to OpenAlex, then requests the matching work and author records. An optional API key is sent only to OpenAlex. The extension does not upload the article’s full text, use analytics, or send requests to a separate authorC server.

Complete results are reused locally for up to 24 hours. You can refresh a result or clear the cache in Settings. An optional personal OpenAlex API key can be saved locally for API access when needed.

Some publishers do not expose enough metadata, and an article or author may be missing from OpenAlex. Chrome’s internal pages and built-in PDF viewer are not supported.

authorC is an independent extension and is not affiliated with OpenAlex or any article publisher.

## Publisher choices

| Dashboard field | Prepared value or decision |
| --- | --- |
| Language | English |
| Category | Choose **Workflow & Planning** for the reading workflow, or **Tools** for a general research utility. These are suggestions, not a submitted choice. |
| Publisher display name | Cong Gao |
| Contact email | cnggao@gmail.com — verification in the developer dashboard remains to be completed. |
| Privacy policy URL | https://conggao-cg.github.io/authorC/privacy.html — verify public access before submission. |
| Homepage/support URL | https://github.com/CongGao-CG/authorC |
| Pricing | Current build has no paid authorC features. Set the dashboard’s pricing field consistently. |

The current category names and their meanings are documented in [Chrome’s category guidance](https://developer.chrome.com/docs/webstore/best-practices#choose-your-extensions-category-well). The [listing guide](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) covers product details, images, and optional links.

## Screenshot plan

Capture the release interface without an API key, account details, or invented real-author statistics:

1. Expanded panel showing the matched paper, Author C, career total, and ranked authors.
2. Minimized pill showing the leading author’s name and count beside the article.
3. Settings, with the API-key field empty, if an additional screenshot is useful.

**Example article:** [Physically based assessment of hurricane surge threat under climate change](https://www.nature.com/articles/nclimate1389), DOI `10.1038/nclimate1389`. Take screenshots manually with authorC installed in Chrome. Save the expanded panel as `store/screenshots/01-nclimate1389-panel.png` and the compact view as `02-nclimate1389-compact.png`, both 1280 × 800. See [screenshot notes](screenshots/README.md).

Chrome requires at least one screenshot. Inspect the manually saved images before uploading them. [Chrome screenshot requirements](https://developer.chrome.com/docs/webstore/images#screenshots).
