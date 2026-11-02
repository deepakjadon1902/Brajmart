const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

test('the development runner reloads changed .env settings without a manual restart', { timeout: 60_000 }, async () => {
  const backend = path.resolve(__dirname, '..');
  const script = require('../package.json').scripts.dev;
  const args = [...script.matchAll(/"([^"]*)"|(\S+)/g)].map(match => match[1] ?? match[2]);
  assert.equal(args.shift(), 'nodemon');
  const temporaryRoot = path.resolve(os.tmpdir());
  const fixture = fs.mkdtempSync(path.join(temporaryRoot, 'brajmart-env-watch-'));
  fs.mkdirSync(path.join(fixture, 'src'));
  fs.writeFileSync(path.join(fixture, '.env'), 'RAZORPAY_MODE=test\n');
  fs.writeFileSync(path.join(fixture, 'src/index.ts'), [
    `require(${JSON.stringify(require.resolve('dotenv'))}).config();`,
    "console.log('BRAJMART_ENV_WATCH=' + process.env.RAZORPAY_MODE);",
    'setInterval(() => {}, 1000);',
  ].join('\n'));
  const env = {
    ...process.env,
    NODE_PATH: [path.join(backend, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
    TS_NODE_PROJECT: path.join(backend, 'tsconfig.json'),
    TS_NODE_TRANSPILE_ONLY: 'true',
  };
  delete env.RAZORPAY_MODE;
  // The real dev command runs a tiny isolated fixture: no server, database,
  // gateway, application credentials, workers or customer data are involved.
  const child = spawn(process.execPath, [require.resolve('nodemon/bin/nodemon.js'), ...args], {
    cwd: fixture, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const waitFor = (expected) => new Promise((resolve, reject) => {
    const check = () => { if (output.includes(expected)) { cleanup(); resolve(); } };
    const failed = error => { cleanup(); reject(error); };
    const exited = () => failed(new Error(`Development runner exited before ${expected}`));
    const timer = setTimeout(() => failed(new Error(`Development runner did not reload ${expected}. Output: ${output}`)), 25_000);
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off('data', check);
      child.stderr.off('data', check);
      child.off('error', failed);
      child.off('exit', exited);
    };
    child.stdout.on('data', check);
    child.stderr.on('data', check);
    child.once('error', failed);
    child.once('exit', exited);
    check();
  });
  try {
    await waitFor('BRAJMART_ENV_WATCH=test');
    fs.writeFileSync(path.join(fixture, '.env'), 'RAZORPAY_MODE=live\n');
    await waitFor('BRAJMART_ENV_WATCH=live');
  } finally {
    // Stop only the test process tree we created, including nodemon's child.
    if (child.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else child.kill('SIGTERM');
      if (child.exitCode === null) await new Promise(resolve => {
        const timer = setTimeout(resolve, 2000);
        child.once('exit', () => { clearTimeout(timer); resolve(); });
      });
    }
    const cleanupTarget = path.resolve(fixture);
    assert.ok(cleanupTarget.startsWith(temporaryRoot + path.sep) && path.basename(cleanupTarget).startsWith('brajmart-env-watch-'));
    fs.rmSync(cleanupTarget, { recursive: true, force: true });
  }
});
