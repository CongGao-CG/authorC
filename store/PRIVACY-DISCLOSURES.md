# authorC — Privacy practices fields

Prepared from the source on 18 November 2026. These are submission drafts, not certifications already made. The publisher must verify that the shipped package, public privacy policy, and dashboard declarations agree. Chrome requires disclosure even for data handled only on the device. [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).

## Single purpose — paste into the dashboard

Identify the scholarly article open on a publisher’s website and display its authors ranked by total career citations from OpenAlex, highlighting the highest available total and linking to the matching OpenAlex records.

## Publisher and first-use disclosure

Publisher: **Cong Gao**. Public support contact: **cnggao@gmail.com**.

Version 0.2.0 starts with automatic lookups disabled. Settings presents the data-use notice and **Agree and enable automatic lookups** action before OpenAlex requests are allowed. **Pause automatic lookups** stops detection, cancels pending requests, and clears cached article results. The optional saved API key remains until the user removes it or uninstalls the extension. A bundled privacy-policy link is available in Settings.

## Storage permission — paste into the dashboard

Local extension storage saves the user’s automatic-lookup choice, optional OpenAlex API key, and complete article/author results, reducing repeat API requests. Cached results are reused for up to 24 hours and are bounded and pruned when new results are stored. Users can pause lookups, clear the cache, and remove the key in Settings. Chrome Sync is not used. Access to this storage is restricted to trusted extension contexts so the content script cannot read the key.

## Host access — paste into the dashboard

The extension connects to https://api.openalex.org/ to resolve a detected DOI or search an article title and retrieve work and author citation records. Requests use HTTPS. Only article identifiers/search titles, OpenAlex entity IDs, and an optional user-provided OpenAlex API key are sent by the extension. Publisher cookies and the full article text are not sent.

The HTTP and HTTPS content-script match patterns allow automatic detection across publisher websites, whose domains cannot be exhaustively listed. The script checks page-level scholarly metadata and the current URL locally, then inserts the citation panel only when it finds an article candidate. Access is necessary for this automatic cross-publisher feature; it is not used for advertising or a browsing-history database. The script does not run in subframes or on OpenAlex pages.

Chrome asks for the narrowest permissions consistent with the feature and an explanation for each requested permission. Broad site access can receive additional scrutiny; the explanation does not guarantee acceptance. [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy).

## Remote code

Select **No**. All executable JavaScript and styles ship in the extension package. OpenAlex returns JSON records used as data; the extension does not download or execute remote scripts, use `eval`, or load remote executable modules.

## Data-use categories

The following is a conservative mapping of the present implementation to the dashboard fields. These are interpretations of the code and Google’s definitions; the publisher should check the wording shown in their dashboard before certifying.

| Category | Proposed disclosure | Scope in authorC |
| --- | --- | --- |
| Website content | **Yes** | Page-level DOI/title/author/year metadata and matching OpenAlex records. No full-article upload. |
| Web history | **Yes** | The current URL is used locally for article detection. A DOI or title sent to OpenAlex identifies a viewed article. No complete browsing history is requested, and no separate visit log is kept. Cached work results can nevertheless reveal previously looked-up articles. |
| Authentication information | **Yes** | An optional OpenAlex API key is stored locally and sent to OpenAlex to authenticate requests. It is never included in the panel or the packaged code. |
| Personally identifiable information | **Review; conservative disclosure is Yes** | Public author names and author-profile identifiers are processed and cached. authorC does not request the browser user’s name or email. If the dashboard limits this field to the extension user’s own identity, explain the distinction rather than implying that author metadata identifies that user. |
| Location | **Review against the dashboard’s IP-address definition** | No geolocation feature or location inference is implemented. OpenAlex necessarily receives the request’s source IP; the extension does not separately read, store, or send a location value. Disclose this recipient-side exposure in the policy. |
| Financial/payment information, health information, personal communications | **No dedicated collection or use** | No such forms, APIs, account integrations, or features exist. A scholarly article’s subject is not treated as the browser user’s health or financial information. |
| User activity | **No tracking/analytics collection** | No click, keystroke, scrolling, mouse-position, or usage log is kept or transmitted. Local URL/metadata-change detection supports the panel; disclose the current-page handling under Web history and Website content. |

Do not choose a blanket “no user data handled” answer. Google’s definition includes current-page resources, web content, credentials, and local processing. [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).

## Limited-use confirmations

The current code has no data sale, advertising, profiling, creditworthiness, or lending functionality. The only automatic third-party transfer is to OpenAlex to provide the citation feature. There is no authorC analytics or backend service. Review each dashboard certification against the current code and the publisher’s actual practices before selecting it; this file does not make those declarations on the publisher’s behalf.

## Retention and controls

- A complete cached result can be reused for less than 24 hours. Expired records are pruned during later cache writes, not by a guaranteed deletion timer. The cache keeps at most 60 records and is also constrained by an approximate storage-size budget.
- **Clear cached results** removes the local result cache. Saving a changed API key also clears it.
- **Pause automatic lookups** stops detection, cancels pending requests, and clears article results, while keeping the optional key until it is removed separately.
- Clear the API-key field and save to remove the saved credential value; settings otherwise persist locally.
- Removing the extension removes its local extension storage. Clearing local data does not remove logs retained independently by OpenAlex.
- No API key, private account detail, or working test credential belongs in the store listing, screenshots, ZIP, or public policy.

## Privacy policy URL

**PENDING — public hosting.** The finalized local policy is [privacy.html](../privacy.html). `npm run package` copies it into `docs/` for GitHub Pages. The public `authorC` repository on branch `main` is authorized; it has not been created or verified remotely from this environment. Run `npm run publish:github` in a normal terminal, then verify the public privacy URL before entering it in the dashboard. A planned Pages address is not proof that the policy is public. [Privacy policy field](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy#set-a-privacy-policy).
