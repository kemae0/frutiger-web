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
      radius: style.borderRadius, height: rect.height, width: rect.width
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
  const shadow = (selector) => {
    const element = document.querySelector(selector);
    assert(Boolean(element), `Missing shadow target ${selector}`);
    if (element) assert(getComputedStyle(element).boxShadow !== 'none',
      `${selector}: expected card shadow`);
  };
  try {
    const theme = query.get('theme') || 'frutiger';
    const music = location.pathname.includes('youtube-music');
    const attr = music ? 'data-yt-music-theme' : 'data-yt-tube-theme';
    if (theme === 'off') {
      assert(!document.documentElement.hasAttribute(attr), 'Off removes site theme');
      assert(!document.documentElement.hasAttribute('data-frutiger-theme'), 'Off removes shared theme');
      assert(!document.documentElement.style.getPropertyValue('--frutiger-scene'), 'Off removes scenery');
      const id = music ? 'music-queue-title' : 'nav-text';
      const item = inspect(id);
      if (item) assert(luminance(item.style.color) > .8, 'Off restores native white labels');
    } else {
      const family = theme === 'dorfic' ? 'Frutiger Oxanium' : 'Frutiger Exo 2';
      const faces = await document.fonts.load(`400 16px "${family}"`);
      await document.fonts.ready;
      assert(faces.length > 0 && faces.every(face => face.status === 'loaded'), `${family} must load from the package`);
      const probe = node(music ? 'music-queue-title' : 'card-title');
      assert(getComputedStyle(probe).fontFamily.includes(family), `${family} must be applied to native text`);
      assert(getComputedStyle(document.documentElement).backgroundImage.includes(theme === 'dorfic' ? 'dorfic-scene.webp' : 'aero-scene.webp'), 'Selected wallpaper is visible');
      if (music) {
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
      }
      assert(document.documentElement.scrollWidth <= innerWidth + 1, 'Page must not overflow horizontally');
    }
  } catch (error) {
    failures.push(error.message);
  }
  const output = document.createElement('pre');
  output.id = 'browser-test-result';
  output.hidden = true;
  output.textContent = JSON.stringify({ count, failures, observations });
  document.body.append(output);
})();
