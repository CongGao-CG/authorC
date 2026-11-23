# authorC for Safari on macOS

The Safari manifest requires 16.4 or later because the background worker uses ES modules. This is the API minimum. Initial WebKit testing used the version installed with Safari 27.2. [WebKit’s Safari 16.4 release notes](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)

## Install a local build

1. From the repository root, run `npm run package:safari` with Node.js 20 or later. For version 0.2.0 the output is `dist/safari/authorC-safari-0.2.0.zip`.
2. In Safari settings, open **Advanced** and turn on **Show features for web developers**.
3. Open **Developer → Add Temporary Extension…**, authenticate if prompted, and select the ZIP. Under **Extensions**, enable authorC for the profile you want to use. Safari removes temporary extensions when you quit or after 24 hours. [Apple’s installation guide](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
4. Open the [Nature example article](https://www.nature.com/articles/nclimate1389). Grant authorC website access for the publisher and access to `api.openalex.org` if Safari prompts. For a first-run test, do the paused and key-isolation checks below first. Then open **Safari → Settings → Extensions → authorC → Settings**, read the disclosure, select **Agree and enable automatic lookups**, and reload the article.

## Verify the Safari build

Use a clean installation and record the Safari version, macOS version, and results. These are expected outcomes for a release test.

| Check | Expected result |
| --- | --- |
| Before enabling automatic lookups | After granting website access, reload the article. It shows no authorC panel. In the extension background inspector’s Network tab, there are no requests to `api.openalex.org`. Open the inspector from Safari’s **Develop → Web Extension Background Content** menu. |
| Optional key isolation | While lookups are paused, save a dummy key in authorC settings. Confirm the settings page can retrieve it after reload. Safari stores settings in IndexedDB under the extension’s origin. From authorC’s content-script context in the publisher tab, confirm `chrome.runtime.sendMessage({ type: 'AUTHORC_GET_SETTINGS' })` returns no settings. Confirm the publisher origin cannot see the extension’s database. Remove the dummy key before making a lookup. |
| Article ranking | After enabling lookups, the panel matches DOI `10.1038/nclimate1389`, links to the work, ranks the authors by career citations, and highlights the highest available total. The exact counts change over time. Minimize the panel and use the toolbar button to reopen it. |
| Cache and pause | Reload a complete result and look for **Cached**. Use the panel’s refresh button and check for **Updated**. Clear cached results in Settings and reload to fetch again. Pause automatic lookups, reload, and check that the panel and further requests stop. |
| Website access | With lookups enabled, revoke publisher access in Safari and reload. The panel should stay absent. Grant access again and reload to restore it. |
| Packaged app | Install the macOS build through TestFlight, open the containing app once, enable authorC in Safari, and repeat the checks. Quit and reopen Safari and verify that the saved preference still takes effect. |

## Package for TestFlight and the Mac App Store

1. With an Apple Developer Program membership, create a **macOS** app record for authorC under **Apps** in App Store Connect. The publisher chooses the app’s bundle identifier and SKU.
2. Open **Users and Access → Xcode Cloud → Safari Web Extension Packager → Upload**. Choose the macOS app record and the tested Safari ZIP. Review the packaging results, then select the processed build in TestFlight. [Apple’s web packager guide](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)
3. Capture the expanded ranking and minimized panel in macOS Safari for the listing. In the review notes, give the Nature URL, explain how to grant website access and enable automatic lookups, and identify the expected career-citation ranking.
4. Verify the public privacy policy covers the submitted build. For App Privacy, account for local settings and cache, the DOI or title and record IDs sent to OpenAlex, the optional user-supplied key, and OpenAlex receiving the request’s IP address. Select the tested build and complete the product page before submitting it for review. [authorC privacy policy](https://conggao-cg.github.io/authorC/privacy.html) · [Apple’s App Privacy definitions](https://developer.apple.com/app-store/app-privacy-details/)
