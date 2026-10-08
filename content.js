(() => {
  'use strict';
  const registry = globalThis.FRUTIGER_WEB;
  const site = registry.sites.find((entry) => entry.hosts.includes(location.hostname));
  if (!site) return;
  const validThemes = new Set(registry.themes.map((theme) => theme.id));
  let settings;
  let initialized = false;
  const pending = {};
  const normalize = (value) => ({
    enabled: value.enabled !== false,
    theme: validThemes.has(value.theme) ? value.theme : registry.themes[0].id,
    apps: Object.fromEntries(registry.sites.map((entry) => [entry.id, value.apps?.[entry.id] !== false]))
  });
  const defaults = { enabled: true, theme: registry.themes[0].id, apps: Object.fromEntries(registry.sites.map((entry) => [entry.id, true])) };
  const apply = () => {
    const root = document.documentElement;
    if (!root || !settings) return;
    if (settings.enabled && settings.apps[site.id]) {
      const theme = registry.themes.find((entry) => entry.id === settings.theme);
      root.setAttribute(site.attribute, settings.theme);
      root.setAttribute('data-frutiger-theme', settings.theme);
      if (theme.wallpaper) root.style.setProperty('--frutiger-scene', `url("${chrome.runtime.getURL(theme.wallpaper)}")`);
      else root.style.removeProperty('--frutiger-scene');
    } else {
      root.removeAttribute(site.attribute);
      root.removeAttribute('data-frutiger-theme');
      root.style.removeProperty('--frutiger-scene');
    }
  };
  // Wait for saved settings before changing appearance, including on disabled pages.
  // Root observation covers document_start before the parser creates <html>.
  if (!document.documentElement) {
    const observer = new MutationObserver(() => {
      if (document.documentElement) { apply(); observer.disconnect(); }
    });
    observer.observe(document, { childList: true });
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !['enabled', 'theme', 'apps'].some((key) => key in changes)) return;
    const next = {};
    for (const key of ['enabled', 'theme', 'apps']) {
      if (key in changes) next[key] = changes[key].newValue;
    }
    if (!initialized) {
      Object.assign(pending, next);
      return;
    }
    settings = normalize({ ...settings, ...next });
    apply();
  });
  chrome.storage.local.get(defaults, (stored) => {
    const failed = Boolean(chrome.runtime.lastError);
    // Merge events received while storage was loading. An unrelated event must
    // never replace a saved site preference or theme with the defaults.
    settings = normalize({ ...(failed ? { ...defaults, enabled: false } : stored), ...pending });
    initialized = true;
    apply();
  });
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'frutiger-web-status') respond({
      site: site.id,
      siteName: site.name,
      initialized,
      enabled: settings ? settings.enabled && settings.apps[site.id] : false,
      theme: settings?.theme ?? null,
      activeTheme: document.documentElement?.getAttribute(site.attribute) ?? null
    });
  });
})();
