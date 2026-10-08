/* Runs only in the local preview when ?verify=1 is supplied. */
(async () => {
  const query = new URLSearchParams(location.search);
  if (query.get('verify') !== '1') return;
  if (document.readyState === 'loading') {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }
  const failures = [];
  const observations = {};
  let count = 0;
  const assert = (condition, message) => {
    count++;
    if (!condition) failures.push(message);
  };
  const node = (id) => document.querySelector(`[data-testid="${id}"]`);
  const rgb = (color) => color.startsWith('#')
    ? [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16))
    : (color.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const alpha = (color) => {
    if (color === 'transparent') return 0;
    if (color.startsWith('#')) return color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
    const values = color.match(/[\d.]+/g) || [];
    return values.length > 3 ? Number(values[3]) : 1;
  };
  const luminance = (color) => rgb(color).map(value => {
    value /= 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const contrast = (a, b) => {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + .05) / (values[1] + .05);
  };
  const inspect = (id) => {
    const element = node(id);
    assert(Boolean(element), `Missing regression element ${id}`);
    if (!element) return null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    observations[id] = {
      color: style.color, opacity: style.opacity, font: style.fontFamily, shadow: style.boxShadow,
      radius: style.borderRadius, height: rect.height, width: rect.width,
      background: style.backgroundColor, backgroundImage: style.backgroundImage,
      textShadow: style.textShadow, display: style.display, hidden: element.hidden
    };
    return { element, style, rect };
  };
  const dark = (id) => {
    const item = inspect(id);
    if (item) assert(contrast(item.style.color, '#e4edf3') >= 4.5,
      `${id}: text must contrast with the light panel (${item.style.color})`);
  };
  const white = (id) => {
    const item = inspect(id);
    if (item) assert(contrast(item.style.color, '#171717') >= 4.5,
      `${id}: media overlay must remain readable on dark video`);
  };
  const solid = (id) => {
    const item = inspect(id);
    if (item) {
      assert(alpha(item.style.backgroundColor) === 1,
        `${id}: panel must have a fully opaque background (${item.style.backgroundColor})`);
      assert(Number(item.style.opacity) === 1, `${id}: the panel itself must not fade over wallpaper`);
    }
    return item;
  };
  const nestedDark = (id) => {
    dark(id);
    const element = node(id);
    if (!element) return;
    for (const child of element.querySelectorAll('a, span, yt-formatted-string')) {
      const style = getComputedStyle(child);
      assert(contrast(style.color, '#e4edf3') >= 4.5,
        `${id}: nested ${child.tagName.toLowerCase()} must stay readable on its light surface`);
      assert(Number(style.opacity) === 1, `${id}: nested text must not be faded`);
    }
    assert(Number(getComputedStyle(element).opacity) === 1, `${id}: label opacity must be restored`);
  };
  const replies = () => {
    const panel = node('watch-replies-panel');
    const trigger = document.querySelector('[data-replies-toggle]');
    const menu = document.getElementById('fixture-menu');
    const menuWasHidden = menu?.hidden;
    assert(Boolean(panel && trigger), 'Watch replies fixture and toggle must exist');
    if (!panel || !trigger) return;
    assert(panel.hidden && getComputedStyle(panel).display === 'none' && panel.getBoundingClientRect().height === 0,
      'Replies must initially remain collapsed under themed CSS');
    trigger.click();
    assert(!panel.hidden && getComputedStyle(panel).display !== 'none' && panel.getBoundingClientRect().height > 0,
      'Reply toggle must open the native replies container');
    trigger.click();
    assert(panel.hidden && getComputedStyle(panel).display === 'none' && panel.getBoundingClientRect().height === 0,
      'Reply toggle must collapse replies again');
    // The fixture's document click handler closes menus; preserve the caller's screenshot state.
    if (menu) menu.hidden = menuWasHidden;
  };
  const shadow = (selector) => {
    const element = document.querySelector(selector);
    assert(Boolean(element), `Missing shadow target ${selector}`);
    if (element) assert(getComputedStyle(element).boxShadow !== 'none',
      `${selector}: expected card shadow`);
  };
  try {
    const theme = query.get('theme') || 'frutiger';
    const music = location.pathname.includes('youtube-music');
    const instagram = location.pathname.includes('instagram');
    const attr = instagram ? 'data-ig-theme' : music ? 'data-yt-music-theme' : 'data-yt-tube-theme';
    if (theme === 'off') {
      assert(!document.documentElement.hasAttribute(attr), 'Off removes site theme');
      assert(!document.documentElement.hasAttribute('data-frutiger-theme'), 'Off removes shared theme');
      assert(!document.documentElement.style.getPropertyValue('--frutiger-scene'), 'Off removes scenery');
      const id = instagram ? 'ig-title' : music ? 'music-queue-title' : 'nav-text';
      const item = inspect(id);
      if (item) assert(luminance(item.style.color) > .8, 'Off restores native white labels');
    } else {
      const family = theme === 'dorfic' ? 'Frutiger Oxanium' : 'Frutiger Exo 2';
      const faces = await document.fonts.load(`400 16px "${family}"`);
      await document.fonts.ready;
      assert(faces.length > 0 && faces.every(face => face.status === 'loaded'), `${family} must load from the package`);
      const probe = inspect(instagram ? 'ig-title' : music ? 'music-queue-title' : 'card-title');
      if (probe) assert(probe.style.fontFamily.includes(family), `${family} must be applied to native text`);
      assert(getComputedStyle(document.documentElement).backgroundImage.includes(theme === 'dorfic' ? 'dorfic-scene.webp' : 'aero-scene.webp'), 'Selected wallpaper is visible');
      if (instagram) {
        for (const id of ['ig-title', 'ig-byline', 'ig-comment', 'ig-dialog-text', 'ig-input']) nestedDark(id);
        for (const id of ['ig-post', 'ig-dialog', 'ig-nav', 'ig-login']) solid(id);
        white('ig-reel-text');
        const input = node('ig-input');
        if (input) {
          assert(input.matches('input, textarea, [contenteditable="true"]') && !input.disabled,
            'Instagram fields must remain editable native controls');
          assert(input.getBoundingClientRect().width > 0 && input.getBoundingClientRect().height > 0,
            'Instagram input must retain its visible native layout');
        }
        const login = solid('ig-modern-login');
        if (login) {
          assert(luminance(login.style.color) > .8 && contrast(login.style.color, login.style.backgroundColor) >= 4.5,
            'Native Instagram DIV login button must retain a white label with strong accent-background contrast');
          assert(login.element.getAttribute('role') === 'button' && login.element.tabIndex >= 0,
            'Instagram login must retain its native keyboard-operable button semantics');
        }
        const form = node('ig-login');
        if (form) {
          const fields = [...form.querySelectorAll('input')];
          assert(fields.length >= 2, 'Instagram login form must retain username and password fields');
          for (const field of fields) {
            const rect = field.getBoundingClientRect();
            assert(rect.width > 0 && rect.height > 0 && !field.disabled,
              `Instagram ${field.name || field.type} input must remain visible and editable`);
          }
        }
        const palette = getComputedStyle(document.documentElement);
        for (const token of ['--ig-primary-text', '--ig-primary-background', '--ig-secondary-background',
          '--ig-colors-button-primary-background', '--ig-colors-button-secondary-background',
          '--ig-colors-button-secondary-text', '--ig-colors-button-borderless-text', '--ig-colors-link-text']) {
          const value = palette.getPropertyValue(token).trim();
          assert(Boolean(value) && CSS.supports('color', `rgb(${value})`),
            `${token}: native Instagram RGB triplet must produce a valid color`);
        }
      } else if (music) {
        for (const id of ['music-browse-title', 'music-video-title', 'music-queue-title', 'music-queue-byline',
          'music-autoplay', 'music-tab', 'music-menu-item', 'music-lyrics', 'music-dialog-text']) dark(id);
        const chip = inspect('music-chip');
        if (chip) assert(chip.rect.height >= 30 && chip.rect.height <= 40, 'Music filters must remain compact');
        if (chip) {
          for (const inner of ['.gradient-box', 'a[role="tab"]']) {
            assert(chip.element.querySelector(inner).getBoundingClientRect().height <= 34,
              `Music chip ${inner} must not stretch`);
          }
          assert(contrast(getComputedStyle(chip.element.querySelector('.text')).color, '#d4ebb9') >= 4.5,
            'Selected chip label must be readable');
        }
        const browseLink = node('music-browse-title').querySelector('a');
        assert(contrast(getComputedStyle(browseLink).color, '#e4edf3') >= 4.5,
          'Native white browse-title links must be dark on cards');
        const cover = inspect('music-album-art');
        if (cover) assert(cover.style.borderTopLeftRadius === '50%', 'Square browse album covers must be circular');
        const video = inspect('music-video-art');
        if (video) {
          assert(video.style.borderTopLeftRadius === '4px', 'Browse videos must keep rectangular artwork');
          assert(video.rect.width / video.rect.height >= 1.7, 'Widescreen thumbnails must keep their native proportions');
        }
        const header = inspect('music-shelf-title');
        if (header) assert(parseFloat(header.style.fontSize) <= 26, 'Music shelf headings must keep restrained scale');
        white('music-overlay-glyph');
        shadow('ytmusic-two-row-item-renderer');
        shadow('ytmusic-player-queue-item');
        shadow('ytmusic-responsive-list-item-renderer');
        const quickPick = document.querySelector('ytmusic-responsive-list-item-renderer');
        assert(getComputedStyle(quickPick).backgroundColor !== 'rgba(0, 0, 0, 0)',
          'Quick pick text needs an opaque surface above the wallpaper');
        for (const id of ['music-genre-button', 'music-episode-card', 'music-related-mini-card',
          'music-related-cover-card']) solid(id);
        for (const id of ['music-genre-title', 'music-episode-title', 'music-episode-byline',
          'music-episode-subtitle', 'music-episode-progress', 'music-related-mini-title',
          'music-related-mini-byline']) nestedDark(id);
        const genre = node('music-genre-button');
        if (genre) {
          const stripe = getComputedStyle(genre);
          assert(parseFloat(stripe.borderLeftWidth) >= 4 && stripe.borderLeftColor === 'rgb(245, 124, 0)',
            'Genre buttons must preserve their native colored genre stripe');
        }
        const related = inspect('music-related-header');
        if (related) {
          const rail = related.element.closest('ytmusic-carousel-shelf-basic-header-renderer');
          assert(Boolean(rail) && getComputedStyle(rail).backgroundImage !== 'none',
            'Related heading must keep its opaque colored chrome rail');
          assert(theme === 'frutiger' ? luminance(related.style.color) > .8 : luminance(related.style.color) < .15,
            'Related heading must use white Aero text or dark DORFic text');
          assert(contrast(related.style.color, theme === 'frutiger' ? '#065498' : '#ff9b3c') >= 4.5,
            'Related heading must contrast with the center of its theme rail');
        }
        const tab = inspect('music-tab');
        if (tab) {
          const tabs = tab.element.closest('tp-yt-paper-tabs');
          assert(Boolean(tabs) && Math.abs(tabs.getBoundingClientRect().height - 48) <= 1,
            'Music side-panel tabs must retain the native 48px rail');
          assert(tab.rect.height >= 47 && tab.rect.height <= 49, 'Music tab labels must retain their 48px hit target');
        }
      } else {
        for (const id of ['nav-text', 'card-title', 'channel-title', 'channel-metadata', 'channel-tab',
          'channel-button', 'shelf-title', 'shorts-title', 'modern-shorts-title',
          'modern-shorts-metadata', 'menu-text']) dark(id);
        white('player-white');
        white('modern-player-white');
        white('overlay-white');
        shadow('ytd-rich-grid-media');
        shadow('ytd-reel-item-renderer');
        shadow('ytm-shorts-lockup-view-model-v2');
        const menu = inspect('menu-panel');
        if (menu) assert(menu.rect.width > 0 && menu.style.backgroundColor !== 'rgba(0, 0, 0, 0)', 'Menu must retain an opaque framed surface');
        for (const id of ['watch-metadata-panel', 'watch-owner-panel', 'watch-like-panel',
          'watch-description-panel', 'watch-comments-panel', 'watch-comments-header-panel',
          'watch-editor-panel', 'watch-thread-panel', 'watch-replies-panel', 'watch-related-panel']) solid(id);
        for (const id of ['watch-title', 'watch-owner-text', 'watch-like-text', 'watch-action-text',
          'watch-description-text', 'watch-description-link', 'watch-comments-heading', 'watch-editor-text',
          'watch-comment-author', 'watch-comment-text', 'watch-comment-action', 'watch-reply-text',
          'watch-related-text']) nestedDark(id);
        white('watch-player-white');
        white('watch-overlay-white');
        const player = inspect('watch-player-panel');
        if (player) {
          const native = player.element.closest('ytd-player');
          assert(Boolean(native), 'Watch footage must remain inside its native player');
          if (native) {
            const style = getComputedStyle(native);
            const base = style.getPropertyValue('--yt-spec-base-background').trim();
            assert(Boolean(base) && luminance(base) < .1,
              'Native watch player must retain dark surface tokens');
            assert(style.colorScheme.includes('dark'), 'Native player must retain its dark control color scheme');
          }
          assert(player.style.backgroundImage !== 'none', 'The theme must preserve native footage artwork');
        }
        for (const id of ['shorts-playback-title', 'shorts-playback-owner', 'shorts-playback-description',
          'shorts-playback-action', 'shorts-playback-count']) {
          white(id);
          const item = node(id);
          if (item) assert(getComputedStyle(item).textShadow !== 'none', `${id}: playback overlay needs a dark text shadow`);
        }
        for (const id of ['modern-shorts-playback-owner', 'modern-shorts-playback-title',
          'modern-shorts-playback-count', 'modern-shorts-playback-action']) {
          white(id);
          const item = node(id);
          if (item) {
            const style = getComputedStyle(item);
            assert(luminance(style.color) > .8, `${id}: modern footage labels must remain white`);
            assert(style.textShadow !== 'none' && style.textShadow.includes('0, 0, 0'),
              `${id}: modern playback text needs its dark readability shadow`);
          }
        }
        const subscribe = solid('modern-shorts-subscribe-button');
        const subscribeText = inspect('modern-shorts-subscribe-text');
        if (subscribe && subscribeText) {
          assert(luminance(subscribe.style.backgroundColor) > .8,
            'Modern Shorts Subscribe must preserve its native white filled button');
          assert(luminance(subscribeText.style.color) < .1 &&
            contrast(subscribeText.style.color, subscribe.style.backgroundColor) >= 4.5,
            'White filled Shorts Subscribe must retain a dark readable label');
          assert(subscribeText.style.textShadow === 'none',
            'Filled Subscribe labels must not inherit footage text shadows');
        }
        solid('modern-shorts-description-panel');
        nestedDark('modern-shorts-description-text');
      }
      assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Page must not overflow horizontally');
    }
    if (!music && !instagram) replies();
  } catch (error) {
    failures.push(error.message);
  }
  const output = document.createElement('pre');
  output.id = 'browser-test-result';
  output.hidden = true;
  output.textContent = JSON.stringify({ count, failures, observations });
  document.body.append(output);
})();
