'use strict';
const registry = globalThis.FRUTIGER_WEB;
const toggle = document.getElementById('enabled');
const picker = document.getElementById('theme');
const status = document.getElementById('status');
const siteInputs = new Map();
for (const theme of registry.themes) {
  const option = document.createElement('option');
  option.value = theme.id;
  option.textContent = theme.name;
  picker.append(option);
}
for (const site of registry.sites) {
  const label = document.createElement('label');
  label.className = 'site-setting';
  const name = document.createElement('span');
  name.textContent = site.name;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('aria-label', `Enable theme on ${site.name}`);
  const visual = document.createElement('span');
  visual.className = 'switch';
  visual.setAttribute('aria-hidden', 'true');
  label.append(name, input, visual);
  document.getElementById('sites').append(label);
  siteInputs.set(site.id, input);
  input.addEventListener('change', save);
}
const controls = [toggle, picker, ...siteInputs.values()];
controls.forEach((control) => { control.disabled = true; });
function updateAppearance() {
  const theme = registry.themes.find((item) => item.id === picker.value) || registry.themes[0];
  document.body.dataset.theme = theme.id;
}
async function showStatus() {
  if (!toggle.checked) {
    status.textContent = 'Off';
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');
    const reply = await chrome.tabs.sendMessage(tab.id, { type: 'frutiger-web-status' });
    if (!reply.initialized) {
      status.textContent = 'Loading…';
    } else if (!siteInputs.get(reply.site)?.checked) {
      status.textContent = `Off · ${reply.siteName}`;
    } else {
      status.textContent = reply.activeTheme === picker.value
        ? `On · ${reply.siteName}`
        : 'Reload this tab.';
    }
  } catch {
    status.textContent = 'Open a supported site. Reload it if already open.';
  }
}
chrome.storage.local.get({ enabled: true, theme: registry.themes[0].id, apps: {} }).then((settings) => {
  toggle.checked = settings.enabled !== false;
  picker.value = registry.themes.some((theme) => theme.id === settings.theme) ? settings.theme : registry.themes[0].id;
  for (const [id, input] of siteInputs) input.checked = settings.apps?.[id] !== false;
  updateAppearance();
  controls.forEach((control) => { control.disabled = false; });
  showStatus();
}).catch(() => { status.textContent = 'Could not load. Reopen this popup.'; });
async function save() {
  controls.forEach((control) => { control.disabled = true; });
  updateAppearance();
  try {
    await chrome.storage.local.set({
      enabled: toggle.checked,
      theme: picker.value,
      apps: Object.fromEntries([...siteInputs].map(([id, input]) => [id, input.checked]))
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    await showStatus();
  } catch {
    status.textContent = 'Could not save. Try again.';
  } finally { controls.forEach((control) => { control.disabled = false; }); }
}
toggle.addEventListener('change', save);
picker.addEventListener('change', save);
