/* Instagram changes its generated class names frequently. Mark existing text,
   controls and reading surfaces without creating elements or moving content. */
(() => {
  'use strict';
  const attrs = ['data-fw-ig-text', 'data-fw-ig-control', 'data-fw-ig-canvas',
    'data-fw-ig-comments', 'data-fw-ig-comment-layer', 'data-fw-ig-panel',
    'data-fw-ig-action', 'data-fw-ig-bare'];
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
    const navigation = new Set(document.body.querySelectorAll('nav, [role="navigation"]'));
    const navLink = element => {
      try { return ['/', '/explore/', '/reels/', '/direct/inbox/'].includes(new URL(element.href, location.href).pathname); }
      catch { return false; }
    };
    // Some desktop sidebar experiments use DIV containers rather than a nav.
    for (const link of [...document.body.querySelectorAll('a[href]')].filter(navLink)) {
      for (let parent = link.parentElement, depth = 0; parent && parent !== document.body && depth < 7; parent = parent.parentElement, depth++) {
        if (parent.matches('main, article') || parent.querySelector('main, article, video')) break;
        if ([...parent.querySelectorAll('a[href]')].filter(navLink).length >= 3) { navigation.add(parent); break; }
      }
    }
    const inNav = element => [...navigation].some(nav => nav.contains(element));
    const label = element => [element.getAttribute('aria-label'), ...[...element.querySelectorAll('svg[aria-label]')].map(svg => svg.getAttribute('aria-label'))].filter(Boolean).join(' ');
    const bare = (element, kind) => { set(next, element, attrs[7], kind); next.get(element)?.delete(attrs[1]); };
    for (const element of document.body.querySelectorAll('button, [role="button"], [role="link"], [role="menuitem"], [role="tab"], a')) {
      if (element.closest(ignored) || element.querySelector('video, canvas')) continue;
      const isLink = element.tagName === 'A' || element.getAttribute('role') === 'link';
      const image = element.querySelector('img');
      const icon = element.querySelector('svg');
      if (isLink && !icon && !image && !element.closest('nav, [role="navigation"]')) continue;
      if (image && !icon) {
        const rect = element.getBoundingClientRect();
        if (element.textContent.trim() || rect.width > 96 || rect.height > 96) {
          if (!inNav(element)) continue;
          set(next, element, attrs[1], 'nav');
        } else set(next, element, attrs[1], 'avatar');
      } else {
        if (element.querySelector('button, [role="button"]')) continue; // Decorate the actual control, not its outer wrapper.
        set(next, element, attrs[1], inNav(element) ? 'nav' : icon ? 'icon' : 'label');
      }
      controls.add(element);
      if (/^(next|previous|go back|go forward|back|right|left)(?:$|\s)|chevron/i.test(label(element))) bare(element, 'arrow');
      if (element.closest('[role="tablist"]')) bare(element, 'tab');
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
    const textCounts = new WeakMap();
    for (const element of textUnits) {
      set(next, element, attrs[0]);
      for (let parent = element.parentElement, depth = 0; parent && depth < 10; parent = parent.parentElement, depth++) {
        textCounts.set(parent, (textCounts.get(parent) || 0) + 1);
      }
    }

    // Paint the existing parent containing an icon and its separate count.
    // Both original click targets and the native row/column layout remain intact.
    for (const control of controls) {
      if (inNav(control) || next.get(control)?.has(attrs[7]) || !control.querySelector('svg')) continue;
      for (let group = control.parentElement, depth = 0; group && depth < 3; group = group.parentElement, depth++) {
        if (group.matches('article, main, header') || group.querySelector('video, canvas, input, textarea') || group.querySelectorAll('svg').length !== 1) break;
        const count = group.textContent.replace(/\s/g, '');
        if (!/^\d[\d.,]*(?:[kmb])?$/i.test(count) || control.textContent.replace(/\s/g, '') === count) continue;
        set(next, group, attrs[6]);
        for (const inner of controls) if (group.contains(inner)) bare(inner, 'action');
        break;
      }
    }
    // Profile statistics locate the complete header, including non-semantic DIVs.
    const profiles = new Set(document.body.querySelectorAll('main > header, main header:has(a[href*="/followers"]), [role="main"] > header, [role="main"] header:has(a[href*="/followers"])'));
    for (const link of document.body.querySelectorAll('main a[href*="/followers"], [role="main"] a[href*="/followers"]')) {
      for (let parent = link.parentElement, depth = 0; parent && depth < 7; parent = parent.parentElement, depth++) {
        if (parent.matches('main, [role="main"], article') || parent.querySelector('video, article')) break;
        if (parent.querySelector('a[href*="/following"]') && parent.querySelector('img, [role="img"]')) { profiles.add(parent); break; }
      }
    }
    for (const panel of profiles) set(next, panel, attrs[5], 'profile');
    // Profile post tabs share a single bar rather than individual icon bubbles.
    const tabs = [...controls].filter(control => !inNav(control) && /^(posts|reels|saved|tagged|reposts)$/i.test(label(control).trim()));
    for (const control of tabs) {
      for (let parent = control.parentElement, depth = 0; parent && depth < 5; parent = parent.parentElement, depth++) {
        if (parent.matches('main, article') || parent.querySelector('video, img')) break;
        if (tabs.filter(tab => parent.contains(tab)).length >= 3) {
          set(next, parent, attrs[5], 'tabs');
          for (const tab of tabs) if (parent.contains(tab)) bare(tab, 'tab');
          break;
        }
      }
    }
    // Locate the existing bottom overlay enclosing both author and caption.
    for (const video of document.body.querySelectorAll('video')) {
      const rect = video.getBoundingClientRect();
      if (!rect.width || !rect.height || video.closest('[role="dialog"]')) continue;
      const candidates = new Set();
      for (const unit of textUnits) {
        const box = unit.getBoundingClientRect();
        if (!box.width || box.left < rect.left - 8 || box.right > rect.right + 8 || box.top < rect.top + rect.height * .5 || box.bottom > rect.bottom + 8) continue;
        for (let parent = unit.parentElement, depth = 0; parent && depth < 5; parent = parent.parentElement, depth++) {
          if (parent.contains(video) || parent.matches('main, article, [role="dialog"]') || parent.querySelector('video, canvas')) break;
          const bounds = parent.getBoundingClientRect();
          if (bounds.width > rect.width + 16 || bounds.height > 240 || bounds.top < rect.top + rect.height * .5) break;
          if ((textCounts.get(parent) || 0) >= 2) candidates.add(parent);
        }
      }
      for (const panel of candidates) if (![...candidates].some(other => other !== panel && other.contains(panel))) {
        set(next, panel, attrs[5], 'reel');
        for (const control of controls) if (panel.contains(control)) bare(control, 'info');
      }
    }

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
      if (/comments/i.test(panel.getAttribute('aria-label') || '') || panel.querySelector('ul li time')) {
        for (const control of controls) if (panel.contains(control)) bare(control, 'comment');
      }
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
