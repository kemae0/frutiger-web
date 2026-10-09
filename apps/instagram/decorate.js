/* Instagram changes its generated class names frequently. Mark existing text,
   controls and reading surfaces without creating elements or moving content. */
(() => {
  'use strict';
  const attrs = ['data-fw-ig-text', 'data-fw-ig-control', 'data-fw-ig-canvas',
    'data-fw-ig-comments', 'data-fw-ig-comment-layer', 'data-fw-ig-panel',
    'data-fw-ig-action', 'data-fw-ig-bare', 'data-fw-ig-action-part',
    'data-fw-ig-action-row', 'data-fw-ig-nav-inner', 'data-fw-ig-tile'];
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
    // SVG <title> is accessibility text, not a visible label or action count.
    const visibleText = element => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let value = '', node;
      while ((node = walker.nextNode())) if (!node.parentElement.closest(ignored)) value += node.nodeValue;
      return value.trim();
    };
    const label = element => [element.getAttribute('aria-label'), ...[...element.querySelectorAll('svg[aria-label]')].map(svg => svg.getAttribute('aria-label'))].filter(Boolean).join(' ');
    const bare = (element, kind) => { set(next, element, attrs[7], kind); next.get(element)?.delete(attrs[1]); };
    for (const element of document.body.querySelectorAll('button, [role="button"], [role="link"], [role="menuitem"], [role="tab"], a')) {
      if (element.closest(ignored) || element.querySelector('video, canvas')) continue;
      const isLink = element.tagName === 'A' || element.getAttribute('role') === 'link';
      const image = element.querySelector('img');
      const icon = element.querySelector('svg');
      // A profile-grid thumbnail is media, even when it contains a Clip SVG.
      if (isLink && image && /\/(?:p|reel)\/[^/]+/.test(element.getAttribute('href') || '')) {
        set(next, element, attrs[11]);
        bare(element, 'tile');
        continue;
      }
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
      if (!inNav(element) && (/more options/i.test(label(element)) || /^(?:\.{3}|…)?\s*more$/i.test(visibleText(element)))) bare(element, 'menu');
      if (!inNav(element) && /^(reply|(?:view|hide) (?:all )?(?:\d+ )?replies|[\d,.]+ likes?)$/i.test(visibleText(element))) bare(element, 'comment');
      if (inNav(element)) {
        const nav = [...navigation].find(nav => nav.contains(element));
        const compact = nav.getBoundingClientRect().width <= 110;
        set(next, element, attrs[1], compact ? 'nav-compact' : 'nav');
        // Native navigation adds padding on inner DIVs as well as the link.
        // Reset only those wrappers, preserving absolute notification badges.
        for (const inner of element.querySelectorAll('div, span')) {
          if (inner.querySelector('svg, img') && !inner.matches('[role="button"], [role="link"]')) set(next, inner, attrs[10], compact ? 'compact' : 'expanded');
        }
      }
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

    // Native actions can be grouped, or be alternating icon/count siblings in
    // one row. Join sibling halves visually without reparenting React nodes.
    const isCount = element => /^\d[\d.,]*(?:[kmb])?$/i.test(visibleText(element).replace(/\s/g, ''));
    for (const control of controls) {
      if (inNav(control) || next.get(control)?.has(attrs[7]) || !control.querySelector('svg')) continue;
      if (!/like|comment|repost|share|send/i.test(label(control))) continue;
      for (let group = control, depth = 0; group && depth < 9; group = group.parentElement, depth++) {
        if (group.matches('article, main, header, [role="main"]') || group.querySelector('video, canvas, input, textarea')) break;
        const icons = group.querySelectorAll('svg');
        if (icons.length > 1) {
          let branch = control;
          while (branch.parentElement !== group && branch.parentElement) branch = branch.parentElement;
          const count = branch.nextElementSibling;
          if (count && !count.querySelector('svg, img') && isCount(count)) {
            set(next, group, attrs[9]);
            set(next, branch, attrs[8], 'icon');
            set(next, count, attrs[8], 'count');
            for (const inner of controls) if (branch.contains(inner) || count.contains(inner)) bare(inner, 'action');
          }
          break;
        }
        if (icons.length !== 1 || !isCount(group)) continue;
        set(next, group, attrs[6]);
        for (const inner of controls) if (inner !== group && group.contains(inner)) bare(inner, 'action');
        next.get(group)?.delete(attrs[1]);
        break;
      }
    }
    // Real profile statistics often use href="#", not /followers links.
    // Find the common header of the avatar, identity and both statistics.
    const profiles = new Set();
    for (const heading of document.body.querySelectorAll('main :is(h1,h2,header), [role="main"] :is(h1,h2,header)')) {
      let panel;
      for (let parent = heading, depth = 0; parent && depth < 14; parent = parent.parentElement, depth++) {
        if (parent.matches('main, [role="main"], article') || parent.querySelector('video, article, [role="tablist"], a[href*="/reel/"], a[href*="/p/"]')) break;
        const text = visibleText(parent);
        if (parent.querySelector('img[alt*="profile picture" i]') && /followers/i.test(text) && /following/i.test(text)) {
          // Include biography, links and edit actions outside the identity row,
          // but do not frame redundant route wrappers around the same content.
          if (!panel || text !== visibleText(panel) || parent.tagName === 'HEADER' || parent.querySelectorAll('img').length > panel.querySelectorAll('img').length) panel = parent;
        }
      }
      if (panel) profiles.add(panel);
    }
    for (const panel of profiles) {
      if ([...profiles].some(other => other !== panel && other.contains(panel))) continue;
      set(next, panel, attrs[5], 'profile');
      for (const control of controls) if (panel.contains(control)) bare(control, 'info');
    }
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
    const comments = new Set([...document.body.querySelectorAll('[aria-label="Comments" i], section[aria-label*="comments" i], aside[aria-label*="comments" i], ul:has(li time), ul:has(li a[href*="/c/"])')].filter(element => !element.matches('svg, [role="img"], button, [role="button"], [role="link"], a')));
    for (const unit of textUnits) {
      if (unit.textContent.trim().toLowerCase() !== 'comments') continue;
      let panel;
      for (let parent = unit.parentElement, depth = 0; parent && depth < 12; parent = parent.parentElement, depth++) {
        if (parent.matches('main, body, article, [role="main"]') || parent.querySelector('video, canvas')) break;
        if (parent.querySelector('form, [role="menu"], [role="log"], [role="dialog"]')) break;
        if ([...parent.querySelectorAll('img')].some(img => !/profile picture/i.test(img.alt) && img.getBoundingClientRect().width > 96)) break;
        const replies = [...parent.querySelectorAll('button, [role="button"]')].filter(control => /^reply$/i.test(visibleText(control)));
        if (parent.querySelector('ul, [role="list"], textarea, [contenteditable="true"], input') || replies.length >= 2) panel = parent;
        if (panel && parent.querySelector('textarea, [contenteditable="true"], input')) break;
        if (parent.matches('[role="dialog"]')) break;
      }
      if (panel) comments.add(panel);
    }
    for (const panel of comments) {
      if ([...comments].some(other => other !== panel && other.contains(panel))) continue;
      set(next, panel, attrs[3]);
      for (const control of panel.querySelectorAll('a, button, [role="button"], [role="link"]')) bare(control, 'comment');
      for (const [element, values] of next) if (panel.contains(element)) {
        values.delete(attrs[6]); values.delete(attrs[8]); values.delete(attrs[9]);
      }
      for (const layer of panel.querySelectorAll('div, section, ul, li')) {
        if (layer.matches('[role="button"]') || layer.closest('svg') || layer.querySelector('video, canvas, img:not([alt*="profile picture" i])')) continue;
        const color = getComputedStyle(layer).backgroundColor.match(/[\d.]+/g)?.map(Number);
        // Retain a classified dark layer after our CSS lightens it; otherwise
        // subsequent scans would remove and re-add its marker.
        if (layer.hasAttribute(attrs[4]) || (color && (color[3] ?? 1) > 0 && Math.max(...color.slice(0, 3)) < 235)) {
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
    attributeFilter: ['data-ig-theme', 'aria-label', 'role', 'href', 'class', 'style', 'hidden', 'aria-expanded']
  });
  addEventListener('popstate', schedule);
  addEventListener('resize', schedule);
  document.addEventListener('loadedmetadata', schedule, true);
  schedule();
})();
