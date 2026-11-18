import { createServer } from 'node:http';
import { readFile, mkdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'store', 'screenshots');
const demoUrl = 'https://authorc-demo.test/article';
const files = new Map([
  ['/article', ['store/demo/index.html', 'text/html; charset=utf-8']],
  ['/', ['store/demo/index.html', 'text/html; charset=utf-8']],
  ['/demo.js', ['store/demo/demo.js', 'application/javascript; charset=utf-8']],
  ['/src/detection.js', ['src/detection.js', 'application/javascript; charset=utf-8']],
  ['/src/content.js', ['src/content.js', 'application/javascript; charset=utf-8']],
]);

async function responseFor(pathname) {
  const entry = files.get(pathname);
  if (!entry) return null;
  return { body: await readFile(join(root, entry[0])), contentType: entry[1] };
}

async function serveDemo() {
  const port = Number(process.env.AUTHORC_DEMO_PORT || 8877);
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      const page = await responseFor(path);
      response.writeHead(page ? 200 : 404, { 'Content-Type': page?.contentType || 'text/plain; charset=utf-8' });
      response.end(page?.body || 'Not found');
    } catch {
      response.writeHead(500);
      response.end('Could not load demonstration files.');
    }
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Demo preview: http://127.0.0.1:${port}/article`);
    console.log('Uses clearly labeled example data. Disable any installed copy of authorC on localhost before previewing.');
    console.log('Press Ctrl+C to stop.');
  });
  server.on('error', error => { console.error(`Demo server: ${error.message}`); process.exitCode = 1; });
}

async function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    'playwright',
    'playwright-core',
    '/Users/cg6622/Library/Caches/ms-playwright-go/1.57.0/package',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const imported = require(candidate);
      if (imported.chromium) return imported;
    } catch (error) {
      if (!['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(error.code)) throw error;
    }
  }
  throw new Error('No installed Playwright module was found. Set PLAYWRIGHT_MODULE to an existing module path; this script does not install packages.');
}

async function capture() {
  const { chromium } = await loadPlaywright();
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  let executablePath = process.env.CHROME_PATH;
  if (!executablePath) {
    try { await access(macChrome); executablePath = macChrome; } catch {}
  }
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      const page = url.origin === new URL(demoUrl).origin ? await responseFor(url.pathname) : null;
      if (page) await route.fulfill({ status: 200, contentType: page.contentType, body: page.body });
      else await route.abort();
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(demoUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => globalThis.__authorCDemoRoot?.querySelector('.winner')?.textContent === 'Jordan Ellis');
    await page.evaluate(() => document.fonts.ready);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: join(output, '01-panel.png'), animations: 'disabled' });
    await page.evaluate(() => {
      const minimize = [...globalThis.__authorCDemoRoot.querySelectorAll('button')].find(node => node.getAttribute('aria-label') === 'Minimize authorC');
      if (!minimize) throw new Error('The actual extension minimize control was not found.');
      minimize.click();
    });
    await page.waitForFunction(() => globalThis.__authorCDemoRoot.querySelector('.launcher').hidden === false && globalThis.__authorCDemoRoot.querySelector('.launcher-name').textContent === 'Jordan Ellis');
    await page.screenshot({ path: join(output, '02-compact.png'), animations: 'disabled' });
    if (pageErrors.length) throw new Error(`The demo reported browser errors: ${pageErrors.join('; ')}`);
    console.log('Captured store/screenshots/01-panel.png and 02-compact.png at 1280×800 using the current extension renderer and clearly labeled example data.');
  } finally {
    await browser.close();
  }
}

if (process.argv.includes('--serve')) {
  await serveDemo();
} else {
  try {
    await capture();
  } catch (error) {
    const details = error.message.split('\n').slice(0, 2).join(' ');
    console.error(`Screenshot capture failed: ${details}`);
    console.error('Run this command from a normal local terminal with an installed Chrome/Chromium and Playwright. Set CHROME_PATH and PLAYWRIGHT_MODULE if needed.');
    console.error('To inspect the demo manually: node scripts/capture-screenshots.mjs --serve');
    process.exitCode = 1;
  }
}
