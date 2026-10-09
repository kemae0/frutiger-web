'use strict';
const picker = document.getElementById('preview-theme');
const initial = new URLSearchParams(location.search).get('theme');
document.body.dataset.previewView = new URLSearchParams(location.search).get('view') || 'feed';
if (['frutiger', 'dorfic', 'off'].includes(initial)) picker.value = initial;
function apply() {
  const theme = picker.value;
  const root = document.documentElement;
  if (theme === 'off') {
    root.removeAttribute('data-ig-theme');
    root.removeAttribute('data-frutiger-theme');
    root.style.removeProperty('--frutiger-scene');
  } else {
    root.setAttribute('data-ig-theme', theme);
    root.setAttribute('data-frutiger-theme', theme);
    const scene = new URL('../../assets/' + (theme === 'frutiger' ? 'aero' : 'dorfic') + '-scene.webp', location.href).href;
    root.style.setProperty('--frutiger-scene', 'url("' + scene + '")');
  }
}
picker.addEventListener('change', apply);
apply();
