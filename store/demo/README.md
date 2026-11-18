# Actual-interface demo and screenshot capture

This original demonstration page uses **the current `src/detection.js` and `src/content.js` files**. Chrome extension messages are replaced with clearly labeled example responses; no publisher content, real author citation claims, personal data, or API key is used. The top banner and article both disclose the example data.

Capture both the expanded panel and the compact author-name pill:

```sh
node scripts/capture-screenshots.mjs
```

The script uses an installed Playwright module and Chrome/Chromium. It does not download browsers or install packages. On this Mac it can find the existing Playwright-Go driver and installed Google Chrome. On another machine, set `PLAYWRIGHT_MODULE` to an existing Playwright module and, if needed, `CHROME_PATH` to the browser executable.

Successful output:

- `store/screenshots/01-panel.png` — expanded panel, 1280 × 800.
- `store/screenshots/02-compact.png` — minimized pill, 1280 × 800.

The browser uses a temporary context and every request is fulfilled from the local fixture map or blocked. It never uses your Chrome profile or contacts OpenAlex. Source scripts keep their actual closed shadow root and rendering behavior; the harness retains a reference solely to activate controls and verify the output.

For a manual preview:

```sh
node scripts/capture-screenshots.mjs --serve
```

Open the printed localhost address. Disable any installed copy of authorC for localhost while viewing this demo, to avoid running two separate copies. This manual preview cannot intercept network requests made by another installed extension.

The development sandbox could not launch Chrome during initial capture. If PNG files are absent, the capture is still pending: run the command in a normal local terminal, inspect both images, and use those files as listing screenshots. Do not substitute a promotional tile for the required screenshot.
