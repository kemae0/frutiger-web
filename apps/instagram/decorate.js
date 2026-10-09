/* Instagram changes its generated class names frequently. Mark existing text,
   controls and reading surfaces without creating elements or moving content. */
(() => {
  'use strict';
  const attrs = ['data-fw-ig-text', 'data-fw-ig-control', 'data-fw-ig-canvas',
    'data-fw-ig-comments', 'data-fw-ig-comment-layer'];
  const ignored = 'script, style, noscript, template, svg, video, canvas, textarea, input, select, [hidden], [contenteditable="true"], [contenteditable="plaintext-only"]';
  const inlineTags = new Set(['SPAN', 'A', 'STRONG', 'B', 'EM', 'I', 'SMALL', 'TIME',
    'BR', 'S', 'U', 'SUP', 'SUB', 'MARK', 'ABBR', 'BDI', 'BDO', 'CODE']);
  let marked = new Map();
  let timer;
  const set = (map, element, attr, value = '') => {
    if (!map.has(element)) map.set(element, new Map());
    map.get(element).set(attr, value);
  };
  const reconcile = (next) => {
    for (const [element, previous] of marked) {
      for (const attr of previous.keys()) if (!next.get(element)?.has(attr)) element.removeAttribute(attr);
    }
    for (const [element, values] of next) {
      for (const [attr, value] of values) {
        if (element.getAttribute(attr) !== value) element.setAttribute(attr, value);
      }
    }
    marked = next;
  };
  const scan = () => {
    timer = undefined;
    const root = document.documentElement;
    if (!root || !root.hasAttribute('data-ig-theme') || !document.body) {
      reconcile(new Map());
      root?.removeAttribute('data-fw-ig-page');
      return;
    }
    const fixtureReels = location.protocol === 'file:' && new URLSearchParams(location.search).get('view') === 'reels';
    const reels = /^\/reels?(?:\/|$)/.test(location.pathname) || fixtureReels;
    root.setAttribute('data-fw-ig-page', reels ? 'reels' : 'other');
    const next = new Map();
    const controls = new Set();
    for (const element of document.body.querySelectorAll('button, [role="button"], [role="link"], [role="menuitem"], [role="tab"], a')) {
      if (element.closest(ignored) || element.querySelector('video, canvas')) continue;
      const isLink = element.tagName === 'A' || element.getAttribute('role') === 'link';
      const image = element.querySelector('img');
      const icon = element.querySelector('svg');
      if (isLink && !icon && !image && !element.closest('nav, [role="navigation"]')) continue;
      if (image && !icon) {
        const rect = element.getBoundingClientRect();
        if (element.textContent.trim() || rect.width > 96 || rect.height > 96) continue;
        set(next, element, attrs[1], 'avatar');
      } else {
        if (element.querySelector('button, [role="button"]')) continue; // Decorate the actual control, not its outer wrapper.
        set(next, element, attrs[1], icon ? 'icon' : 'label');
      }
      controls.add(element);
    }
    const pureCache = new WeakMap();
    const pureText = (element) => {
      if (pureCache.has(element)) return pureCache.get(element);
      const result = [...element.children].every(child => inlineTags.has(child.tagName) && pureText(child));
      pureCache.set(element, result);
      return result;
    };
    const textUnits = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text;
    while ((text = walker.nextNode())) {
      if (!text.nodeValue.trim()) continue;
      let element = text.parentElement;
      if (!element || element.closest(ignored)) continue;
      let controlParent = element;
      while (controlParent && !controls.has(controlParent)) controlParent = controlParent.parentElement;
      if (controlParent) continue; // A control already supplies a readable box for its label/badge.
      if (!pureText(element) && element.tagName !== 'LABEL') continue;
      for (let depth = 0; depth < 8 && inlineTags.has(element.tagName); depth++) {
        const parent = element.parentElement;
        if (!parent || !pureText(parent) || parent === document.body || parent === root) break;
        element = parent;
      }
      if (element === document.body || element === root) continue;
      textUnits.add(element);
    }
    for (const element of textUnits) set(next, element, attrs[0]);

    /* Reels uses opaque intermediate DIVs, not just <main>. Clear the wide
       route layers around videos, retaining the video-sized player backdrop. */
    for (const video of document.body.querySelectorAll('video')) {
      if (video.closest('[role="dialog"]')) continue;
      const videoRect = video.getBoundingClientRect();
      if (!videoRect.width || !videoRect.height) continue;
      for (let element = video.parentElement; element && element !== document.body; element = element.parentElement) {
        if (element.matches('article, [role="dialog"], form') || element.closest('article, [role="dialog"], form')) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width > videoRect.width + 64 || rect.height > videoRect.height + 160) {
          set(next, element, attrs[2]);
        }
      }
    }

    /* Both modal and docked comments get bright paper. A docked pane can be
       identified by its native heading and comment list/composer, not classes. */
    const comments = new Set(document.body.querySelectorAll('[role="dialog"], section[aria-label*="comments" i], aside[aria-label*="comments" i], ul:has(li time), ul:has(li a[href*="/c/"])'));
    for (const unit of textUnits) {
      if (unit.textContent.trim().toLowerCase() !== 'comments') continue;
      for (let parent = unit.parentElement, depth = 0; parent && depth < 7; parent = parent.parentElement, depth++) {
        if (parent.matches('main, body, article')) break;
        if (parent.querySelector('ul, [role="list"], textarea, [contenteditable="true"], input')) {
          comments.add(parent);
          break;
        }
      }
    }
    for (const panel of comments) {
      if ([...comments].some(other => other !== panel && other.contains(panel))) continue;
      set(next, panel, attrs[3]);
      for (const layer of panel.querySelectorAll('div, section, ul, li')) {
        if (layer.matches('[role="button"]') || layer.closest('svg') || layer.querySelector('video, canvas, img:not([alt*="profile picture" i])')) continue;
        const color = getComputedStyle(layer).backgroundColor.match(/[\d.]+/g)?.map(Number);
        // Retain a classified dark layer after our CSS lightens it; otherwise
        // subsequent scans would remove and re-add its marker.
        if (layer.hasAttribute(attrs[4]) || (color && (color[3] ?? 1) > 0 && Math.max(...color.slice(0, 3)) < 100)) {
          set(next, layer, attrs[4]);
        }
      }
    }
    reconcile(next);
  };
  const schedule = () => {
    if (timer === undefined) timer = setTimeout(scan, 60);
  };
  new MutationObserver(schedule).observe(document, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['data-ig-theme', 'aria-label', 'role', 'href']
  });
  addEventListener('popstate', schedule);
  addEventListener('resize', schedule);
  document.addEventListener('loadedmetadata', schedule, true);
  schedule();
})();
