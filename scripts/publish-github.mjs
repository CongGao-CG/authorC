import { writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const repositoryName = 'authorC';

function run(command, args, { optional = false } = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', env: { ...process.env, GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' } });
  if (result.status !== 0 && !optional) {
    throw new Error(`${command} failed. ${result.stderr?.trim() || result.error?.message || 'Check your local GitHub authentication and network connection.'}`);
  }
  return result;
}

async function publish() {
  const user = JSON.parse(run('gh', ['api', 'user']).stdout);
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(user.login)) throw new Error('GitHub returned an invalid account name.');
  const repository = `${user.login}/${repositoryName}`;
  const existing = run('gh', ['api', `repos/${repository}`], { optional: true });
  if (existing.status === 0) throw new Error(`${repository} already exists. Nothing was overwritten; inspect that repository before publishing.`);
  if (!/HTTP 404/.test(existing.stderr || '')) throw new Error('Could not check whether the repository exists. Fix GitHub connectivity first.');

  try { await access(path.join(root, '.git')); }
  catch { run('git', ['init', '-b', 'main']); }
  const branch = run('git', ['symbolic-ref', '--short', 'HEAD']).stdout.trim();
  if (branch !== 'main') throw new Error(`Current branch is ${branch}; this release requires main. No branch was renamed.`);
  if (run('git', ['remote']).stdout.trim()) throw new Error('A Git remote already exists. Inspect it before creating a new public repository.');
  if (run('git', ['rev-parse', '--verify', 'HEAD'], { optional: true }).status === 0) {
    throw new Error('This repository already has commits. Review its history and publish it with the normal Git workflow. Nothing was pushed.');
  }
  if (run('git', ['diff', '--cached', '--name-only']).stdout.trim()) {
    throw new Error('Files are already staged. Review or unstage them before using this initial-publication script. Nothing was pushed.');
  }

  run('node', ['scripts/package.mjs']);
  const files = [
    '.gitignore', 'README.md', 'manifest.json', 'package.json',
    'src', 'options.html', 'options.js', 'options.css',
    'privacy.html', 'privacy.css', 'assets', 'docs', 'scripts', 'store', 'tests',
  ];
  run('git', ['add', '--', ...files]);
  const staged = run('git', ['diff', '--cached', '--name-only']).stdout.trim().split('\n').filter(Boolean);
  if (staged.some(file => /(^|\/)(\.env(?:\.|$)|node_modules|dist|\.DS_Store)/.test(file))) {
    throw new Error('Unexpected private or generated files are staged. Inspect git diff --cached --name-only before proceeding.');
  }
  if (staged.length) {
    run('git', ['-c', 'user.name=Cong Gao', '-c', `user.email=${user.id}+${user.login}@users.noreply.github.com`,
      'commit', '-m', 'Prepare authorC Chrome Web Store release']);
  }
  console.log(`Creating public repository ${repository} from main…`);
  const created = run('gh', ['repo', 'create', repository, '--public', '--source', root, '--remote', 'origin', '--push',
    '--description', 'Chrome extension that ranks research article authors by career citations in OpenAlex.']);
  console.log(created.stdout.trim());
  run('gh', ['repo', 'edit', repository, '--default-branch', 'main']);
  console.log(`Repository: https://github.com/${repository}`);

  const pages = run('gh', ['api', '--method', 'POST', `repos/${repository}/pages`,
    '-f', 'source[branch]=main', '-f', 'source[path]=/docs'], { optional: true });
  if (pages.status !== 0) {
    console.log('Repository created. GitHub Pages was not enabled by the API.');
    console.log(`Open https://github.com/${repository}/settings/pages and choose Deploy from a branch → main → /docs.`);
    return;
  }
  const site = JSON.parse(pages.stdout);
  const privacyUrl = new URL('privacy.html', `${site.html_url.replace(/\/$/, '')}/`).href;
  console.log(`GitHub Pages configured. Privacy URL (wait for the build): ${privacyUrl}`);
  const statusPath = path.join(root, 'store', 'PUBLISHING-STATUS.md');
  await writeFile(statusPath, `# Publishing status\n\nRepository: https://github.com/${repository}\n\nBranch: main\n\nPrivacy URL: ${privacyUrl}\n\nGitHub Pages is configured. Verify that the privacy URL loads without login before entering it in the Chrome Web Store dashboard. The Chrome Web Store item has not been submitted by this script.\n`);
}

if (process.argv.includes('--help')) {
  console.log('Creates the authorized public authorC GitHub repository from main and enables GitHub Pages from /docs.');
  console.log('Requires git, an authenticated gh CLI, Node.js, and network access. Never overwrites an existing repository.');
  console.log('Does not submit an item to the Chrome Web Store. Usage: npm run publish:github');
} else {
  try { await publish(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
