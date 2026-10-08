const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const candidates = [process.env.FRUTIGER_TEST_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
const browser = candidates.find(file => fs.existsSync(file));
assert.ok(browser, 'Chrome or Edge is required; set FRUTIGER_TEST_BROWSER to its executable');
const qa = path.join(root, '.qa');
fs.mkdirSync(qa, { recursive: true });
let checks = 0;
const failures = [];
const screenshots = process.argv.includes('--screenshots');
for (const site of ['youtube', 'youtube-music', 'instagram']) {
  for (const theme of ['frutiger', 'dorfic', 'off']) {
    const profile = fs.mkdtempSync(path.join(qa, 'render-'));
    const url = pathToFileURL(path.join(root, 'apps', site, 'preview.html'));
    url.search = `theme=${theme}&menu=1&verify=1`;
    const screenshotArgs = screenshots && theme !== 'off'
      ? [`--screenshot=${path.join(root, 'docs', 'previews', `${site === 'youtube' ? 'tube' : site === 'youtube-music' ? 'music' : 'instagram'}-${theme === 'frutiger' ? 'aero' : 'dorfic'}.png`)}`]
      : [];
    const result = spawnSync(browser, [
      '--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking',
      `--user-data-dir=${profile}`, `--window-size=1440,${site === 'youtube' ? '1800' : '1200'}`, '--virtual-time-budget=3500',
      ...screenshotArgs,
      '--dump-dom', url.href
    ], { encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    const match = result.stdout?.match(/<pre id="browser-test-result" hidden="">([^<]+)<\/pre>/);
    if (!match) {
      failures.push(`${site}/${theme}: no browser result (${result.error?.message || result.status})`);
      fs.writeFileSync(path.join(qa, `${site}-${theme}-error.log`), result.stderr || 'No browser output');
      continue;
    }
    const report = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&').replaceAll('&gt;', '>').replaceAll('&lt;', '<'));
    fs.writeFileSync(path.join(qa, `${site}-${theme}.json`), JSON.stringify(report, null, 2));
    checks += report.count;
    for (const failure of report.failures) failures.push(`${site}/${theme}: ${failure}`);
    console.log(`${report.failures.length ? 'FAIL' : 'PASS'} ${site}/${theme}: ${report.count} browser checks`);
    // Each profile belongs exclusively to this completed test process.
    const resolved = fs.realpathSync(profile);
    assert.ok(resolved.startsWith(fs.realpathSync(qa) + path.sep));
    if (!result.error) fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
assert.deepEqual(failures, [], failures.join('\n'));
console.log(`PASS ${checks} computed-style checks: contrast, typefaces, geometry, shadows, media and off state`);
