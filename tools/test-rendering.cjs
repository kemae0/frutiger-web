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
const allSites = ['youtube', 'youtube-music', 'instagram'];
const selectedSite = process.argv.find(arg => arg.startsWith('--site='))?.slice(7);
assert.ok(!selectedSite || allSites.includes(selectedSite), 'Unknown preview site');
const width = Number(process.argv.find(arg => arg.startsWith('--width='))?.slice(8) || 1440);
assert.ok(Number.isInteger(width) && width >= 480 && width <= 2560, 'Preview width must be 480–2560 pixels');
const guideMode = process.argv.find(arg => arg.startsWith('--guide='))?.slice(8);
const view = process.argv.find(arg => arg.startsWith('--view='))?.slice(7);
assert.ok(!view || ['reels', 'profile'].includes(view), 'Unknown Instagram preview view');
assert.ok(!guideMode || ['compact', 'expanded', 'fullscreen'].includes(guideMode), 'Unknown Music guide mode');
for (const site of selectedSite ? [selectedSite] : allSites) {
  for (const theme of ['frutiger', 'dorfic', 'off']) {
    const profile = fs.mkdtempSync(path.join(qa, 'render-'));
    const url = pathToFileURL(path.join(root, 'apps', site, 'preview.html'));
    url.search = `theme=${theme}&menu=1&verify=1`;
    if (site === 'instagram' && view) url.searchParams.set('view', view);
    if (site === 'youtube-music' && guideMode) {
      if (guideMode === 'fullscreen') url.searchParams.set('fullscreen', '1');
      else url.searchParams.set('guide', guideMode);
    }
    const screenshotArgs = screenshots && theme !== 'off'
      ? [`--screenshot=${path.join(root, 'docs', 'previews', `${site === 'youtube' ? 'tube' : site === 'youtube-music' ? 'music' : view ? `instagram-${view}` : 'instagram'}-${theme === 'frutiger' ? 'aero' : 'dorfic'}.png`)}`]
      : [];
    const result = spawnSync(browser, [
      '--headless', '--disable-gpu', '--no-first-run', '--disable-background-networking',
      `--user-data-dir=${profile}`, `--window-size=${width},${site === 'youtube' ? '1800' : '1200'}`, '--virtual-time-budget=3500',
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
