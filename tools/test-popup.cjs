const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.listeners = {}; this.attrs = {}; this.dataset = {}; this.value = ''; }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(event, handler) { this.listeners[event] = handler; }
  async change() { await this.listeners.change(); }
}
async function create(initial = {}, options = {}) {
  const elements = Object.fromEntries(['enabled', 'theme', 'status', 'sites', 'theme-description'].map(id => [id, new Element()]));
  const body = new Element('body');
  let stored = { enabled: true, theme: 'frutiger', apps: {}, ...initial };
  const writes = [];
  const chrome = {
    storage: { local: {
      async get() { if (options.readFailure) throw new Error('Storage unavailable'); return stored; },
      async set(value) { if (options.writeFailure) throw new Error('Storage unavailable'); stored = value; writes.push(JSON.parse(JSON.stringify(value))); }
    } },
    tabs: {
      async query() { return [{ id: 7 }]; },
      async sendMessage(_id, message) {
        assert.equal(message.type, 'frutiger-web-status');
        if (options.unsupported) throw new Error('No content script');
        const site = options.site || 'youtube';
        const active = stored.enabled !== false && stored.apps[site] !== false;
        return { initialized: true, site, siteName: site === 'instagram' ? 'Instagram' : 'YouTube', activeTheme: active ? stored.theme : null };
      }
    }
  };
  const context = vm.createContext({
    document: { getElementById: id => elements[id], createElement: tag => new Element(tag), body },
    chrome, setTimeout: callback => callback()
  });
  for (const file of ['registry.js', 'popup.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  const siteInput = id => elements.sites.children.find(label => label.children[1].attrs['aria-label'] === `Enable theme on ${id}`)?.children[1];
  return { elements, body, writes, siteInput };
}
test('Popup populates themes/sites and shows saved choice', async () => {
  const app = await create({ theme: 'dorfic', apps: { 'youtube-music': false } });
  assert.deepEqual(app.elements.theme.children.map(option => option.value), ['frutiger', 'dorfic']);
  assert.equal(app.elements.theme.value, 'dorfic');
  assert.equal(app.body.dataset.theme, 'dorfic');
  assert.equal(app.siteInput('YouTube').checked, true);
  assert.equal(app.siteInput('YouTube Music').checked, false);
  assert.equal(app.siteInput('Instagram').checked, true);
  assert.equal(app.elements.status.textContent, 'On · YouTube');
});
test('Theme and site changes preserve other preferences', async () => {
  const app = await create({ apps: { 'youtube-music': false } });
  app.elements.theme.value = 'dorfic';
  await app.elements.theme.change();
  assert.deepEqual(app.writes[0], { enabled: true, theme: 'dorfic', apps: { youtube: true, 'youtube-music': false, instagram: true } });
  app.siteInput('YouTube').checked = false;
  await app.siteInput('YouTube').change();
  assert.equal(app.writes[1].apps.youtube, false);
  assert.equal(app.writes[1].theme, 'dorfic');
  assert.equal(app.elements.status.textContent, 'Off · YouTube');
  assert.equal(app.elements.theme.disabled, false);
});
test('Master off retains theme and site preferences', async () => {
  const app = await create({ theme: 'dorfic', apps: { 'youtube-music': false } });
  app.elements.enabled.checked = false;
  await app.elements.enabled.change();
  assert.deepEqual(app.writes[0], { enabled: false, theme: 'dorfic', apps: { youtube: true, 'youtube-music': false, instagram: true } });
  assert.equal(app.elements.status.textContent, 'Off');
});
test('Instagram switch and status preserve existing site preferences', async () => {
  const app = await create({ apps: { youtube: false } }, { site: 'instagram' });
  assert.equal(app.elements.status.textContent, 'On · Instagram');
  app.siteInput('Instagram').checked = false;
  await app.siteInput('Instagram').change();
  assert.equal(app.writes[0].apps.instagram, false);
  assert.equal(app.writes[0].apps.youtube, false);
  assert.equal(app.writes[0].apps['youtube-music'], true);
  assert.equal(app.elements.status.textContent, 'Off · Instagram');
});
test('Unsupported tab offers installation/reload guidance', async () => {
  const app = await create({}, { unsupported: true });
  assert.match(app.elements.status.textContent, /Open a supported site/);
  assert.match(app.elements.status.textContent, /Reload/);
});
test('Storage read failure prevents overwriting saved preferences', async () => {
  const app = await create({}, { readFailure: true });
  assert.equal(app.elements.theme.disabled, true);
  assert.equal(app.elements.enabled.disabled, true);
  assert.match(app.elements.status.textContent, /Could not load/);
  assert.equal(app.writes.length, 0);
});
test('Storage write failure reports error and allows retry', async () => {
  const app = await create({}, { writeFailure: true });
  await app.elements.enabled.change();
  assert.match(app.elements.status.textContent, /Could not save/);
  assert.equal(app.elements.enabled.disabled, false);
  assert.equal(app.writes.length, 0);
});
