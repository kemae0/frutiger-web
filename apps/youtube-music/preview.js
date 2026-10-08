'use strict';
const picker = document.getElementById('preview-theme');
const initial = new URLSearchParams(location.search).get('theme');
if (['frutiger', 'dorfic', 'off'].includes(initial)) picker.value = initial;
function apply() {
  const theme = picker.value;
  const root = document.documentElement;
  if (theme === 'off') {
    root.removeAttribute('data-yt-music-theme');
    root.removeAttribute('data-frutiger-theme');
    root.style.removeProperty('--frutiger-scene');
  } else {
    root.setAttribute('data-yt-music-theme', theme);
    root.setAttribute('data-frutiger-theme', theme);
    const imageURL = new URL('../../assets/' + (theme === 'frutiger' ? 'aero' : 'dorfic') + '-scene.webp', location.href).href;
    root.style.setProperty('--frutiger-scene', 'url("' + imageURL + '")');
  }
}
picker.addEventListener('change', apply);
apply();
// Fixture-only native guide state; extension styles never open a hidden guide.
const fixtureApp = document.querySelector('ytmusic-app');
const fixtureGuideMode = new URLSearchParams(location.search).get('guide');
const fixtureGuideMedia = matchMedia('(max-width: 670px)');
function applyFixtureGuide() {
  fixtureApp.toggleAttribute('guide-collapsed', fixtureGuideMode === 'compact' || (fixtureGuideMode !== 'expanded' && fixtureGuideMedia.matches));
  document.getElementById('guide-toggle').setAttribute('aria-expanded', String(!fixtureApp.hasAttribute('guide-collapsed')));
}
applyFixtureGuide();
fixtureGuideMedia.addEventListener('change', applyFixtureGuide);
document.getElementById('guide-toggle').addEventListener('click', () => {
  fixtureApp.toggleAttribute('guide-collapsed');
  document.getElementById('guide-toggle').setAttribute('aria-expanded', String(!fixtureApp.hasAttribute('guide-collapsed')));
});
fixtureApp.toggleAttribute('fixture-fullscreen', new URLSearchParams(location.search).get('fullscreen') === '1');
