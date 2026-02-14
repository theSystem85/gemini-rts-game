import { spawnSync } from 'node:child_process';

const status = spawnSync('git', ['status', '--short'], { encoding: 'utf8' });

if (status.status !== 0) {
  process.stderr.write(status.stderr || 'Failed to read git status.\n');
  process.exit(status.status ?? 1);
}

const changedFiles = status.stdout
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => {
    const entry = line.slice(3).trim();

    if (entry.includes(' -> ')) {
      return entry.split(' -> ').at(-1)?.trim();
    }

    return entry;
  })
  .filter((file) => {
    if (!file) {
      return false;
    }

    const isJavaScriptFile = /\.(cjs|js|mjs)$/u.test(file);
    const isRootJavaScriptFile = isJavaScriptFile && !file.includes('/');
    const isSrcOrTestJavaScriptFile =
      isJavaScriptFile && /^(src|tests)\//u.test(file);

    return isRootJavaScriptFile || isSrcOrTestJavaScriptFile;
  });

const uniqueFiles = [...new Set(changedFiles)];

if (uniqueFiles.length === 0) {
  console.log('No changed lintable files detected.');
  process.exit(0);
}

const lintResult = spawnSync('npx', ['eslint', '--fix', ...uniqueFiles], {
  encoding: 'utf8',
  stdio: 'inherit'
});

if (lintResult.error) {
  process.stderr.write(`${lintResult.error.message}\n`);
  process.exit(1);
}

process.exit(lintResult.status ?? 1);
