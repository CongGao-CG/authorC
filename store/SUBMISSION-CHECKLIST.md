# authorC 0.2.0 — Submission checklist

## Prepared locally

| Item | Status and file |
| --- | --- |
| Manifest V3 extension | **Done:** icons, explicit first-use consent, pause control, bundled privacy link. |
| Release ZIP | **Done:** [authorC-0.2.0.zip](../dist/authorC-0.2.0.zip), 32,932 bytes and 14 runtime files; archive integrity verified. [Inventory](../dist/release.json) and [SHA-256 checksum](../dist/SHA256SUMS) accompany it. Upload this ZIP, not the project folder. |
| Automated checks | **Done:** 64 tests pass; syntax checks pass. Rebuild with `npm run package` after any source change. |
| Store icon | **Done:** [128 × 128 PNG](assets/store-icon-128.png). |
| Optional promotional images | **Done:** [440 × 280 tile](assets/promo-small-440x280.png) and [1400 × 560 marquee](assets/promo-marquee-1400x560.png). |
| Manual screenshots | **Done:** [expanded panel](screenshots/01-nclimate1389-panel.png) and [compact view](screenshots/02-nclimate1389-compact.png), both 1280 × 800; dimensions, square edges, and visible UI checked. |
| Listing / privacy declarations | **Done:** [LISTING.md](LISTING.md), [PRIVACY-DISCLOSURES.md](PRIVACY-DISCLOSURES.md). Final dashboard choices and certifications remain yours. |
| Reviewer instructions | **Done:** [REVIEWER-NOTES.md](REVIEWER-NOTES.md). Live release testing remains pending. |
| Privacy policy / project page | **Done locally:** [privacy policy](../privacy.html), [project page](../docs/index.html). `npm run package` also copies the policy into `docs/` for hosting. |

The store requires a 128 × 128 icon and at least one screenshot. Promotional images do not replace a screenshot. [Image requirements](https://developer.chrome.com/docs/webstore/images).

## Still needed before submission

- [ ] **Public privacy URL:** the public [GitHub repository](https://github.com/CongGao-CG/authorC), branch `main`, has been created and Pages configured. Verify the [privacy page](https://conggao-cg.github.io/authorC/privacy.html) without signing in, then paste its URL into the dashboard.
- [ ] **Live release check:** load the extracted ZIP in Chrome. Confirm first-use enable/pause, the work/DOI match, career totals, complete available ranking, compact author-name pill, links, refresh, and settings. See the reviewer notes.
- [ ] **Final local checks:** run `npm test`, `npm run check`, and `npm run package` after any further source edits.

## Publisher account

- [ ] Register the owning Google account in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) and pay the one-time fee shown there. The current [registration page](https://developer.chrome.com/docs/webstore/register) does not quote the amount.
- [ ] Enable [2-Step Verification](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification).
- [ ] Set publisher name **Cong Gao** and verify public contact **cnggao@gmail.com**. [Account setup](https://developer.chrome.com/docs/webstore/set-up-account).
- [ ] Make your own Trader/Non-Trader declaration and complete any required verification. Free distribution does not determine that status. [Trader FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq).

## Submit through the dashboard

Create a new item, upload the ZIP, and complete Store listing, Privacy practices, Distribution, and Test instructions using the prepared files. Review the privacy certifications against the final package and your actual practices. [Publication steps](https://developer.chrome.com/docs/webstore/publish).

Chrome Web Store visibility remains a separate choice from the already authorized public GitHub repository:

| Store visibility | Effect |
| --- | --- |
| Public | Discoverable in the store. |
| Unlisted | Installable by anyone with its store link. |
| Private | Restricted to selected testers. |

Choose regions as well; all visibility options require review. [Distribution settings](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution). At submission, choose automatic publication after approval or a later manual launch. [Deferred publishing](https://developer.chrome.com/docs/webstore/publish#submit-your-item).

No account payment, dashboard certification, review submission, or store publication has been performed.
