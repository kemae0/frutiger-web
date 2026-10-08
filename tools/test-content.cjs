const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
function create(host = 'www.youtube.com', hasRoot = true) {
  const attrs = new Map();
  const styles = new Map();
  const element = {
    style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key) },
    setAttribute: (key, value) => attrs.set(key, value),
    removeAttribute: key => attrs.delete(key),
    getAttribute: key => attrs.get(key) ?? null
  };
  const document = { documentElement: hasRoot ? element : null };
  let getCallback, changesListener, messageListener, observerCallback, reads = 0;
  const runtime = { lastError: undefined, getURL: file => `chrome-extension://fixture/${file}`, onMessage: { addListener(listener) { messageListener = listener; } } };
  const chrome = { runtime, storage: {
    local: { get(_defaults, callback) { reads++; getCallback = callback; } },
    onChanged: { addListener(listener) { changesListener = listener; } }
  } };
  class MutationObserver {
    constructor(callback) { observerCallback = callback; }
    observe() {}
    disconnect() {}
  }
  const context = vm.createContext({ document, chrome, MutationObserver, location: { hostname: host } });
  for (const file of ['registry.js', 'content.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  return {
    attrs, styles, runtime,
    get reads() { return reads; },
    initialize(settings = { enabled: true, theme: 'frutiger', apps: {} }) { getCallback(settings); },
    change(changes, area = 'local') { changesListener(changes, area); },
    attachRoot() { document.documentElement = element; observerCallback(); },
    status() { let reply; messageListener({ type: 'frutiger-web-status' }, {}, value => { reply = value; }); return reply; }
  };
}
for (const [host, site, attr] of [
  ['www.youtube.com', 'youtube', 'data-yt-tube-theme'],
  ['youtube.com', 'youtube', 'data-yt-tube-theme'],
  ['music.youtube.com', 'youtube-music', 'data-yt-music-theme']
]) {
  test(`${host}: saved theme, live switching, site toggle, master toggle`, () => {
    const app = create(host);
    assert.equal(app.attrs.size, 0, 'Do not flash default theme before settings arrive');
    app.initialize({ enabled: true, theme: 'dorfic', apps: {} });
    assert.equal(app.attrs.get(attr), 'dorfic');
    assert.match(app.styles.get('--frutiger-scene'), /dorfic-scene\.webp/);
    assert.equal(app.status().site, site);
    app.change({ theme: { newValue: 'frutiger' } });
    assert.equal(app.attrs.get(attr), 'frutiger');
    assert.match(app.styles.get('--frutiger-scene'), /aero-scene\.webp/);
    app.change({ apps: { newValue: { [site]: false } } });
    assert.equal(app.attrs.size, 0);
    assert.equal(app.styles.size, 0, 'Site off removes scenery variable');
    app.change({ apps: { newValue: { [site]: true } } });
    assert.equal(app.attrs.get(attr), 'frutiger');
    app.change({ enabled: { newValue: false } });
    assert.equal(app.attrs.size, 0);
    app.change({ theme: { newValue: 'dorfic' } });
    assert.equal(app.attrs.size, 0, 'Changing theme must keep master disabled');
    app.change({ enabled: { newValue: true } });
    assert.equal(app.attrs.get(attr), 'dorfic');
    app.change({ theme: { newValue: 'frutiger' } }, 'sync');
    assert.equal(app.attrs.get(attr), 'dorfic', 'Ignore changes in unrelated storage');
  });
}
test('Disabled preferences produce no initial style changes', () => {
  const app = create();
  app.initialize({ enabled: false, theme: 'dorfic', apps: {} });
  assert.equal(app.attrs.size, 0);
});
test('Unknown stored theme falls back; removed preferences use defaults', () => {
  const app = create();
  app.initialize({ enabled: true, theme: 'future-or-corrupt', apps: { youtube: false } });
  assert.equal(app.attrs.size, 0);
  app.change({ apps: { newValue: undefined } });
  assert.equal(app.attrs.get('data-yt-tube-theme'), 'frutiger');
});
test('Unsupported hosts stay untouched', () => {
  const app = create('example.com');
  assert.equal(app.reads, 0);
  assert.equal(app.attrs.size, 0);
});
test('Root arriving after settings gets the saved theme', () => {
  const app = create('music.youtube.com', false);
  app.initialize({ enabled: true, theme: 'dorfic', apps: {} });
  app.attachRoot();
  assert.equal(app.attrs.get('data-yt-music-theme'), 'dorfic');
});
test('Root arriving before settings waits without a theme flash', () => {
  const app = create('music.youtube.com', false);
  app.attachRoot();
  assert.equal(app.attrs.size, 0);
  app.initialize({ enabled: true, theme: 'dorfic', apps: {} });
  assert.equal(app.attrs.get('data-yt-music-theme'), 'dorfic');
});
test('Storage failure leaves original appearance', () => {
  const app = create();
  app.runtime.lastError = { message: 'Storage unavailable' };
  app.initialize();
  assert.equal(app.attrs.size, 0);
});
test('Startup changes preserve unrelated saved preferences', () => {
  const app = create();
  app.change({ enabled: { newValue: true } });
  app.initialize({ enabled: false, theme: 'dorfic', apps: { youtube: false } });
  assert.equal(app.attrs.size, 0, 'Saved per-site disable must survive early master toggle');
  assert.equal(app.status().theme, 'dorfic', 'Saved theme must survive early master toggle');
  app.change({ apps: { newValue: { youtube: true } } });
  assert.equal(app.attrs.get('data-yt-tube-theme'), 'dorfic');
});
test('Startup changes override an older settings read', () => {
  const app = create();
  app.change({ theme: { newValue: 'dorfic' } });
  app.initialize({ enabled: true, theme: 'frutiger', apps: {} });
  assert.equal(app.attrs.get('data-yt-tube-theme'), 'dorfic');
});
