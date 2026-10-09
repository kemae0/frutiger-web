const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, 'Frutiger Web');
assert.deepEqual(manifest.permissions, ['storage']);
assert.ok(!manifest.host_permissions && !manifest.background, 'No extra access or background required');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'registry.js'), 'utf8'), context);
const registry = context.FRUTIGER_WEB;
assert.ok(registry.themes.length >= 2 && registry.sites.length >= 2);
const required = new Set([manifest.action.default_popup, 'registry.js', 'content.js']);
for (const site of registry.sites) {
  const script = manifest.content_scripts.find(entry => entry.matches.includes(`https://${site.hosts[0]}/*`));
  assert.ok(script, `Missing content script for ${site.id}`);
  assert.equal(script.run_at, 'document_start');
  assert.deepEqual(script.js, ['registry.js', 'content.js', ...(site.id === 'instagram' ? ['apps/instagram/decorate.js'] : [])]);
  assert.deepEqual([...script.matches].sort(), Array.from(site.hosts, host => `https://${host}/*`).sort());
  assert.ok(script.css.includes('wallpaper.css'));
  assert.ok(script.css.includes('fonts.css'));
  assert.ok(script.css.includes('fonts/extension.css'));
  for (const file of [...script.css, ...script.js]) required.add(file);
  for (const theme of registry.themes) {
    const file = `apps/${site.id}/theme-${theme.id}.css`;
    assert.ok(script.css.includes(file), `Missing theme stylesheet ${file}`);
    required.add(file);
    const css = fs.readFileSync(path.join(root, file), 'utf8');
    assert.ok(css.includes(`html[${site.attribute}="${theme.id}"]`));
    assert.ok(!/@import\s|url\(\s*['"]?https?:/i.test(css), 'No remote stylesheet dependencies');
    assert.ok(!/\bfilter:\s*(?:invert|hue-rotate)/i.test(css), 'Do not recolor footage');
  }
}
assert.equal(manifest.content_scripts.length, registry.sites.length);
const expectedHosts = Array.from(registry.sites).flatMap(site => Array.from(site.hosts, host => `https://${host}/*`)).sort();
const resources = manifest.web_accessible_resources;
assert.equal(resources.length, 1);
assert.deepEqual([...resources[0].matches].sort(), expectedHosts);
for (const theme of registry.themes) {
  if (theme.wallpaper) {
    assert.ok(resources[0].resources.includes(theme.wallpaper), `Wallpaper must be accessible: ${theme.wallpaper}`);
    required.add(theme.wallpaper);
  }
}
for (const font of ['Exo2', 'Oxanium']) {
  const file = `fonts/${font}.ttf`;
  assert.ok(resources[0].resources.includes(file), `Font must be accessible: ${file}`);
  required.add(file);
  required.add(`fonts/${font}-OFL.txt`);
  const bytes = fs.readFileSync(path.join(root, file));
  assert.equal(bytes.readUInt32BE(0), 0x00010000, 'Packaged font must be valid TrueType');
  assert.match(fs.readFileSync(path.join(root, `fonts/${font}-OFL.txt`), 'utf8'), /SIL OPEN FONT LICENSE/);
  assert.ok(fs.readFileSync(path.join(root, 'fonts/extension.css'), 'utf8').includes(file));
}
for (const size of ['16', '32', '48', '128']) {
  const file = manifest.icons[size];
  assert.ok(file, `Missing ${size}px icon`);
  required.add(file);
  const png = fs.readFileSync(path.join(root, file));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), Number(size));
  assert.equal(png.readUInt32BE(20), Number(size));
}
for (const file of Object.values(manifest.action.default_icon)) required.add(file);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.git' || entry.name === '.qa' || entry.name === 'node_modules') return [];
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}
for (const file of walk(root)) {
  if (/\.(?:c?js|mjs)$/.test(file)) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  if (file.endsWith('.html')) {
    const html = fs.readFileSync(file, 'utf8');
    if (file === path.join(root, manifest.action.default_popup)) {
      assert.ok(!/<script\b[^>]*>\s*[^<\s]/i.test(html), 'Popup JS must be external');
      assert.ok(!/\son\w+\s*=/i.test(html), 'No inline popup handlers');
    }
    for (const match of html.matchAll(/(?:src|href)=["']([^"'#]+)["']/g)) {
      if (/^[a-z]+:|^\/\//i.test(match[1])) continue;
      const target = path.resolve(path.dirname(file), match[1].split(/[?#]/)[0]);
      assert.ok(target.startsWith(root + path.sep), 'Relative file must remain inside package');
      assert.ok(fs.existsSync(target), `Missing ${match[1]} in ${path.relative(root, file)}`);
    }
  }
}
for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), `Missing ${file}`);
assert.ok(fs.existsSync(path.join(root, 'README.md')));
console.log(`PASS Frutiger Web: MV3 manifest, ${registry.sites.length} sites × ${registry.themes.length} themes, references, JS syntax, icon sizes`);
