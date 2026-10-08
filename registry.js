// Extending supported sites: add the site and theme metadata here, add scoped
// stylesheets in apps/<site>/, and add an exact-host content_scripts entry.
globalThis.FRUTIGER_WEB = Object.freeze({
  themes: Object.freeze([
    { id: 'frutiger', name: 'Frutiger Aero', wallpaper: 'assets/aero-scene.webp' },
    { id: 'dorfic', name: 'DORFic', wallpaper: 'assets/dorfic-scene.webp' }
  ]),
  sites: Object.freeze([
    { id: 'youtube', name: 'YouTube', hosts: ['www.youtube.com', 'youtube.com'], attribute: 'data-yt-tube-theme' },
    { id: 'youtube-music', name: 'YouTube Music', hosts: ['music.youtube.com'], attribute: 'data-yt-music-theme' }
  ])
});
