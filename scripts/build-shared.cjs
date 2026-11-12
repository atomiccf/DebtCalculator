const { execFileSync } = require('node:child_process');
const path = require('node:path');

const sharedDirectory = path.resolve(__dirname, '../shared');
const compiler = require.resolve('typescript/bin/tsc', { paths: [sharedDirectory] });

// Also used as a dev-server preload: compile before importing the shared package.
execFileSync(process.execPath, [compiler, '--project', sharedDirectory, '--noEmitOnError'], {
  stdio: 'inherit',
  windowsHide: true,
});
