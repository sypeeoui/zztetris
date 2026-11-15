// Service worker for the ZZTetris mobile PWA.
//
// Bump CACHE_VERSION whenever the shell or wasm changes so installed clients
// pick up the new files. The 23 MB legal-boards database and the research
// pc_data.json are deliberately not precached; the mobile shell does not use
// the analyzer.
const CACHE_VERSION = 'zztetris-mobile-d8c329c4';

const ASSETS = [
	'./index.html?mobile=1',
	'./manifest.webmanifest',
	'./styles/mobile.css?v=5b179213',
	'./styles/zztetris.css?v=f428c787',
	'./styles/replay.css?v=b7d0e65f',
	'./styles/replay-mobile.css?v=e844a62b',
	'./replay.html',
	'./replay.js?v=a991c57a',
	'./replay-api.js?v=b9cad92a',
	'./sound-pack.js?v=45cb7b6a',
	'./replay-audio.js?v=86555a50',
	'./replay-practice.js?v=ff40dac7',
	'./replay-common.js?v=3aefa415',
	'./replay-engine.js?v=db2dd99e',
	'./styles/paint_bucket.css',
	'./styles/import_export.css',
	'./styles/board_settings.css',
	'./mobile.js?v=3d3a9e63',
	'./base.js?v=d0a25af6',
	'./zztetris.js?v=c0ea6561',
	'./stats-config.js?v=294eb553',
	'./stats-core.js?v=b55729b4',
	'./stats.js?v=5c0de463',
	'./keybinds.js?v=d3dc5230',
	'./practice-settings.js?v=43a1be04',
	'./attack-sim.js?v=93cca4e3',
	'./auto-lock.js?v=355903c7',
	'./rotationSystem.js',
	'./io.js',
	'./utils.js?v=0f473dcb',
	'./tetris-fumen.js',
	'./tetrio.js',
	'./engineWorker.js?v=3df45535',
	'./assets/vendor/jquery.min.js',
	'./assets/vendor/animate.min.css',
	'./assets/icons/dark.svg',
	'./assets/icons/icon-192.png',
	'./assets/icons/icon-512.png',
	'./assets/icons/icon-maskable-512.png',
	'./assets/fonts/Muroslant.otf',
	'./assets/fonts/Sunmoreslantfree-DOMDx.ttf',
	'./assets/fonts/MikadoMedium.ttf',
	'./assets/pieceSprite/grid.png',
	'./assets/pieceSprite/i.png',
	'./assets/pieceSprite/j.png',
	'./assets/pieceSprite/l.png',
	'./assets/pieceSprite/o.png',
	'./assets/pieceSprite/s.png',
	'./assets/pieceSprite/t.png',
	'./assets/pieceSprite/z.png',
	'./wasm/fusion_engine.js',
	'./wasm/fusion_engine_bg.wasm?v=ca5a1172',
	'./wasm/falcon_2.js',
	'./wasm/falcon_2_bg.wasm?v=c98578a1',
	'./wasm/cold_clear_2.js',
	'./wasm/cold_clear_2_bg.wasm?v=871c7ba8',
	'./assets/sfx/ClearSpin.wav?v=27fcad1f',
	'./assets/sfx/ClearTetra.wav?v=f48380fa',
	'./assets/sfx/CountdownFinish.wav?v=78e15176',
	'./assets/sfx/Countdown.wav?v=4b4c0c01',
	'./assets/sfx/FinesseFault.wav?v=a260b135',
	'./assets/sfx/Finish.wav?v=1b4aa530',
	'./assets/sfx/GarbageLarge.wav?v=6166f662',
	'./assets/sfx/GarbageLight.wav?v=c3273188',
	'./assets/sfx/GarbageMed.wav?v=184bbae6',
	'./assets/sfx/HardDrop.wav?v=1952b7d9',
	'./assets/sfx/Hold.wav?v=38c3a6d1',
	'./assets/sfx/IncomingLarge.wav?v=c2bc21e0',
	'./assets/sfx/IncomingLight.wav?v=33fbdab9',
	'./assets/sfx/IncomingMed.wav?v=7d82d4ee',
	'./assets/sfx/LockDelay.wav?v=361b2858',
	'./assets/sfx/Move.wav?v=7a06b53c',
	'./assets/sfx/PerfectClear.wav?v=62fb36cf',
	'./assets/sfx/Rotate.wav?v=abc17339',
	'./assets/sfx/SlowDown.wav?v=65a72722',
	'./assets/sfx/SoftDrop.wav?v=d65a283f',
	'./assets/sfx/TopOut.wav?v=b82c31c6',
	'./assets/sfx/TSpin1.wav?v=0173cf5f',
	'./assets/sfx/Woosh1.wav?v=25969f54',
	'./assets/sfx/Woosh3.wav?v=18b13b7d',
	'./assets/sfx/tetrio/move.mp3?v=6f7f3eb7',
	'./assets/sfx/tetrio/rotate.mp3?v=438377dc',
	'./assets/sfx/tetrio/hold.mp3?v=8c5670b7',
	'./assets/sfx/tetrio/harddrop.mp3?v=26055198',
	'./assets/sfx/tetrio/softdrop.mp3?v=66b5b2e2',
	'./assets/sfx/tetrio/floor.mp3?v=38eed2b9',
	'./assets/sfx/tetrio/clearline.mp3?v=d3eb5bd6',
	'./assets/sfx/tetrio/clearquad.mp3?v=b7a006ce',
	'./assets/sfx/tetrio/clearspin.mp3?v=2babd381',
	'./assets/sfx/tetrio/clearbtb.mp3?v=f88f3f3b',
	'./assets/sfx/tetrio/allclear.mp3?v=d1e67418',
	'./assets/sfx/tetrio/combo_1.mp3?v=27eb45ab',
	'./assets/sfx/tetrio/combo_2.mp3?v=addf47e5',
	'./assets/sfx/tetrio/combo_3.mp3?v=1b4458b6',
	'./assets/sfx/tetrio/combo_4.mp3?v=10257f00',
	'./assets/sfx/tetrio/combo_5.mp3?v=0ad3e1b6',
	'./assets/sfx/tetrio/combo_6.mp3?v=b03c4aea',
	'./assets/sfx/tetrio/combo_7.mp3?v=6372daa0',
	'./assets/sfx/tetrio/combo_8.mp3?v=1a59e190',
	'./assets/sfx/tetrio/combo_9.mp3?v=dc096911',
	'./assets/sfx/tetrio/combo_10.mp3?v=9a4c7dfa',
	'./assets/sfx/tetrio/combo_11.mp3?v=b6d33526',
	'./assets/sfx/tetrio/combo_12.mp3?v=a6fd62bc',
	'./assets/sfx/tetrio/combo_13.mp3?v=3c17533d',
	'./assets/sfx/tetrio/combo_14.mp3?v=daade62f',
	'./assets/sfx/tetrio/combo_15.mp3?v=573b5333',
	'./assets/sfx/tetrio/combo_16.mp3?v=3f01795c',
	'./assets/sfx/tetrio/btb_1.mp3?v=c8044757',
	'./assets/sfx/tetrio/btb_2.mp3?v=6d3f6fe7',
	'./assets/sfx/tetrio/btb_3.mp3?v=867ff346',
	'./assets/sfx/tetrio/btb_break.mp3?v=7a3f199d',
	'./assets/sfx/tetrio/damage_small.mp3?v=da86caa7',
	'./assets/sfx/tetrio/damage_medium.mp3?v=cff535df',
	'./assets/sfx/tetrio/damage_large.mp3?v=ec6844df',
	'./assets/sfx/tetrio/damage_alert.mp3?v=8f8dda58',
	'./assets/sfx/tetrio/warning.mp3?v=08d0f26f',
	'./assets/sfx/tetrio/hyperalert.mp3?v=f2e2789e',
	'./assets/sfx/tetrio/finessefault.mp3?v=75e81557',
	'./assets/sfx/tetrio/gameover.mp3?v=9e383ed8',
	'./assets/sfx/tetrio/finish.mp3?v=3c90bbec',
	'./assets/sfx/tetrio/topout.mp3?v=dae53c68',
	'./assets/sfx/tetrio/combobreak.mp3?v=66a9f69c',
	'./assets/sfx/tetrio/hit.mp3?v=154c68a1',
	'./assets/sfx/tetrio/undo.mp3?v=e5b4cb84',
	'./assets/sfx/tetrio/redo.mp3?v=85b98fae',
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE_VERSION)
			.then((cache) => Promise.allSettled(ASSETS.map((url) => cache.add(url))))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
			)
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	if (url.pathname.endsWith('.leb128') || url.pathname.endsWith('pc_data.json')) return;
	// The replay proxy has its own TTL cache; the service worker must not
	// freeze its responses forever.
	if (url.pathname.endsWith('tetrio-proxy.php')) return;

	// Navigations are network-first so an online launch always sees a new
	// index.html and its versioned assets. Cached shell is the offline fallback.
	if (request.mode === 'navigate') {
		const isReplay =
			url.pathname.endsWith('/replay.html') ||
			url.pathname.endsWith('replay.html');
		const cacheKey = isReplay ? './replay.html' : './index.html?mobile=1';
		event.respondWith(
			fetch(request)
				.then((response) => {
					if (response && response.ok) {
						const copy = response.clone();
						caches.open(CACHE_VERSION).then((cache) => {
							cache.put(cacheKey, copy);
						});
					}
					return response;
				})
				.catch(() =>
					caches
						.match(request)
						.then((cached) => cached || caches.match(cacheKey))
				)
		);
		return;
	}

	event.respondWith(
		caches.match(request).then((cached) => {
			if (cached) return cached;
			return fetch(request)
				.then((response) => {
					if (response && response.ok) {
						const copy = response.clone();
						caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
					}
					return response;
				})
				.catch(() => new Response('', { status: 504, statusText: 'Offline' }));
		})
	);
});
