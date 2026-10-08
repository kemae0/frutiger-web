'use strict';
const picker = document.getElementById('preview-theme');
const initial = new URLSearchParams(location.search).get('theme');
if (['frutiger', 'dorfic', 'off'].includes(initial)) picker.value = initial;
function apply() {
  const theme = picker.value;
  const root = document.documentElement;
  if (theme === 'off') {
    root.removeAttribute('data-yt-tube-theme');
    root.removeAttribute('data-frutiger-theme');
    root.style.removeProperty('--frutiger-scene');
  } else {
    root.setAttribute('data-yt-tube-theme', theme);
    root.setAttribute('data-frutiger-theme', theme);
    const imageURL = new URL('../../assets/' + (theme === 'frutiger' ? 'aero' : 'dorfic') + '-scene.webp', location.href).href;
    root.style.setProperty('--frutiger-scene', 'url("' + imageURL + '")');
  }
}
picker.addEventListener('change', apply);
apply();
const menu = document.getElementById('fixture-menu');
for (const trigger of document.querySelectorAll('[data-menu-toggle]')) {
  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });
}
document.addEventListener('click', (event) => {
  if (!menu.contains(event.target)) menu.hidden = true;
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') menu.hidden = true;
});
if (new URLSearchParams(location.search).get('menu') === '1') menu.hidden = false;
