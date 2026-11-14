// GOALWORKS â€” service worker (offline cache for the installed web app).
//
// NETWORK FIRST: when the phone is online it always fetches the newest files
// (so a new build shows up on the next open) and keeps a copy; when offline
// it plays from that copy.
//
// VERSION is stamped automatically by publish.ps1 on every publish. A new
// version makes the phone install this worker fresh and throw away old copies.
//
// This game imports the shared series engine from ../../core/, which sits
// outside this folder. Requests from the game page still pass through this
// worker, so the engine files are cached too.
const VERSION = '20261114-185422';
const CACHE = 'goalworks-' + VERSION;

// The page itself + manifest + icons, so the app opens offline straight away.
const CORE = ['./', './index.html', './manifest.webmanifest', './styles/app.css',
  './assets/branding/pwa/icon-192.png', './assets/branding/pwa/icon-512.png'];
// Every code file (game + shared engine) â€” filled in by publish.ps1 so the whole
// game's code is saved on the very first visit. Art is cached the first time the
// game loads it. (Empty when run locally.)
const PRECACHE = ['./app.js', './styles/app.css', './assets/img_opt/players/player_gk01.webp', './assets/img_opt/players/player_df01.webp', './assets/img_opt/players/player_mf01.webp', './assets/img_opt/players/player_wg01.webp', './assets/img_opt/players/player_fw01.webp', './assets/img_opt/facilities/facility_f01.webp', './assets/img_opt/facilities/facility_f02.webp', './assets/img_opt/facilities/facility_f03.webp', './assets/img_opt/facilities/facility_f04.webp', './assets/img_opt/facilities/facility_f05.webp', './assets/img_opt/facilities/facility_f06.webp', './assets/img_opt/facilities/facility_f07.webp', './assets/img_opt/facilities/facility_f08.webp', './assets/img_opt/facilities/facility_f09.webp', './assets/img_opt/facilities/facility_f10.webp', './assets/img_opt/facilities/facility_f11.webp', './assets/img_opt/facilities/facility_f12.webp', './assets/img_opt/facilities/facility_f13.webp', './assets/img_opt/facilities/facility_f14.webp', './assets/img_opt/facilities/facility_f15.webp', './assets/img_opt/facilities/facility_f16.webp', './assets/img_opt/facilities/facility_f17.webp', './assets/img_opt/facilities/facility_f18.webp', './assets/img_opt/facilities/facility_f19.webp', './assets/img_opt/facilities/facility_f20.webp', './assets/img_opt/facilities/facility_f21.webp', './assets/img_opt/facilities/facility_f22.webp', './assets/img_opt/facilities/facility_f23.webp', './assets/img_opt/facilities/facility_f24.webp', './assets/img_opt/facilities/facility_f25.webp', './assets/img_opt/facilities/facility_f26.webp', './assets/img_opt/facilities/facility_f27.webp', './assets/img_opt/facilities/facility_f28.webp', './assets/img_opt/facilities/facility_f29.webp', './assets/img_opt/facilities/facility_f30.webp', './assets/img_opt/facilities/facility_f31.webp', './assets/img_opt/facilities/facility_f32.webp', './assets/img_opt/facilities/facility_f33.webp', './assets/img_opt/facilities/facility_f34.webp', './assets/img_opt/facilities/facility_f35.webp', './assets/img_opt/props/prop_01.webp', './assets/img_opt/props/prop_02.webp', './assets/img_opt/props/prop_03.webp', './assets/img_opt/props/prop_11.webp', './assets/img_opt/props/prop_12.webp', './assets/img_opt/props/prop_25.webp', './assets/img_opt/props/prop_04.webp', './assets/img_opt/props/prop_05.webp', './assets/img_opt/match/match_14.webp', './assets/img_opt/props/prop_06.webp', './assets/img_opt/props/prop_07.webp', './assets/img_opt/props/prop_08.webp', './assets/img_opt/props/prop_09.webp', './assets/img_opt/props/prop_10.webp', './assets/img_opt/props/prop_13.webp', './assets/img_opt/props/prop_14.webp', './assets/img_opt/props/prop_16.webp', './assets/img_opt/props/prop_15.webp', './assets/img_opt/props/prop_17.webp', './assets/img_opt/props/prop_18.webp', './assets/img_opt/props/prop_19.webp', './assets/img_opt/props/prop_24.webp', './assets/img_opt/props/prop_20.webp', './assets/img_opt/props/prop_21.webp', './assets/img_opt/props/prop_22.webp', './assets/img_opt/props/prop_23.webp', './assets/img_opt/stages/club_stage_01.webp', './assets/img_opt/stages/club_stage_02.webp', './assets/img_opt/stages/club_stage_03.webp', './assets/img_opt/stages/club_stage_04.webp', './assets/img_opt/stages/club_stage_05.webp', './assets/img_opt/ui/ui_04.webp', './assets/img_opt/ui/ui_30.webp', './assets/img_opt/tournaments/tournament_c02.webp', './assets/img_opt/tournaments/tournament_c03.webp', './assets/img_opt/tournaments/tournament_c05.webp', './assets/img_opt/tournaments/tournament_c06.webp', './assets/img_opt/tournaments/tournament_c07.webp', './assets/img_opt/tournaments/tournament_c04.webp', './assets/img_opt/ui/ui_20.webp', './assets/img_opt/ui/ui_21.webp', './assets/img_opt/ui/ui_01.webp', './assets/img_opt/ui/ui_08.webp', './assets/img_opt/ui/ui_07.webp', './assets/img_opt/ui/ui_02.webp', './assets/img_opt/ui/ui_12.webp', './assets/img_opt/ui/ui_10.webp', './assets/img_opt/ui/ui_29.webp', './assets/img_opt/ui/ui_27.webp', './assets/img_opt/ui/ui_35.webp', './assets/img_opt/ui/ui_24.webp', './assets/img_opt/ui/ui_25.webp', './assets/img_opt/ui/ui_03.webp', './assets/img_opt/ui/ui_26.webp', './assets/img_opt/ui/ui_34.webp', './assets/img_opt/ui/ui_28.webp', './assets/img_opt/ui/ui_05.webp'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // One file failing must not block the rest.
      .then((c) => Promise.allSettled(CORE.concat(PRECACHE).map((u) =>
        c.add(new Request(u, { cache: 'reload' })))))
      .catch(() => { /* offline during install: runtime caching will fill in */ })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('goalworks-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});

// (13 Nov, Aaron's rule 2) a tapped notification: hand it to the open game (it loads the club's slot and opens the
// screen), or open the game on it. Phone browsers show notifications only through the service worker.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((all) => {
      const page = all[0];
      if (page) {
        page.postMessage({ type: 'notify:open', data });
        return page.focus();
      }
      const open = data.open && data.open.screen ? '?open=' + encodeURIComponent(data.open.screen) + '&slot=' + (data.open.slot | 0) : '';
      return self.clients.openWindow('./index.html' + open);
    })
  );
});
