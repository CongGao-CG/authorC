import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, copyFile, cp, rename, rm, stat, utimes } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv[2] ?? 'chrome';
if (!['chrome', 'safari'].includes(target)) throw new Error('Expected target chrome or safari.');
const safari = target === 'safari';
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (manifest.version !== pkg.version) throw new Error('manifest.json and package.json versions must match.');
if (manifest.manifest_version !== 3) throw new Error('Expected Manifest V3.');

const files = [
  'manifest.json',
  'src/background.js', 'src/content.js', 'src/detection.js', 'src/openalex.js', 'src/private-storage.js',
  'options.html', 'options.js', 'options.css',
  'privacy.html', 'privacy.css',
  ...new Set(Object.values(manifest.icons)),
];
if (!safari) {
  for (const file of ['privacy.html', 'privacy.css']) {
    await copyFile(path.join(root, file), path.join(root, 'docs', file));
  }
}

const output = safari ? path.join(root, 'dist', 'safari') : path.join(root, 'dist');
await mkdir(output, { recursive: true });
const name = `authorC-${safari ? 'safari-' : ''}${manifest.version}.zip`;
const staging = await mkdtemp(path.join(output, '.package-'));
const temporary = path.join(staging, name);
const destination = path.join(output, name);
try {
  if (safari) {
    for (const file of files) {
      await cp(path.join(root, file), path.join(staging, file), { preserveTimestamps: true });
    }
    delete manifest.minimum_chrome_version;
    manifest.browser_specific_settings = { safari: { strict_min_version: '16.4' } };
    manifest.permissions = manifest.permissions.filter(permission => permission !== 'storage');
    const manifestPath = path.join(staging, 'manifest.json');
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const { mtime } = await stat(path.join(root, 'manifest.json'));
    await utimes(manifestPath, mtime, mtime);
  }
  const packed = spawnSync('zip', ['-q', '-X', temporary, ...files], { cwd: safari ? staging : root, encoding: 'utf8' });
  if (packed.status !== 0) throw new Error(packed.stderr || 'Could not create ZIP; a zip command is required.');
  const listed = spawnSync('unzip', ['-Z1', temporary], { encoding: 'utf8' });
  if (listed.status !== 0) throw new Error('Could not verify the ZIP directory.');
  const actual = listed.stdout.trim().split('\n').sort();
  if (JSON.stringify(actual) !== JSON.stringify([...files].sort())) throw new Error('ZIP contains unexpected files.');
  await rename(temporary, destination);
} finally {
  await rm(staging, { recursive: true, force: true });
}
const bytes = await readFile(destination);
const sha256 = createHash('sha256').update(bytes).digest('hex');
const metadata = { version: manifest.version, archive: name, bytes: bytes.length, sha256, files };
await writeFile(path.join(output, 'release.json'), `${JSON.stringify(metadata, null, 2)}\n`);
await writeFile(path.join(output, 'SHA256SUMS'), `${sha256}  ${name}\n`);
console.log(`Created ${path.relative(root, destination)} (${bytes.length.toLocaleString()} bytes; ${files.length} runtime files).`);
console.log(`SHA-256: ${sha256}`);
