// Service worker for the ZZTetris mobile PWA.
//
// Bump CACHE_VERSION whenever the shell or wasm changes so installed clients
// pick up the new files. The 23 MB legal-boards database and the research
// pc_data.json are deliberately not precached; the mobile shell does not use
// the analyzer.
const CACHE_VERSION = 'zztetris-mobile-v15';

const ASSETS = [
	'./index.html?mobile=1',
	'./manifest.webmanifest',
	'./styles/mobile.css?v=7',
	'./styles/zztetris.css?v=7',
	'./styles/paint_bucket.css',
	'./styles/import_export.css',
	'./styles/board_settings.css',
	'./mobile.js?v=14',
	'./base.js?v=25',
	'./zztetris.js',
	'./stats-config.js',
	'./stats-core.js',
	'./stats.js',
	'./rotationSystem.js',
	'./io.js',
	'./utils.js',
	'./tetris-fumen.js',
	'./tetrio.js',
	'./engineWorker.js?v=8',
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
	'./wasm/fusion_engine_bg.wasm?v=4',
	'./wasm/falcon_2.js',
	'./wasm/falcon_2_bg.wasm?v=4',
	'./wasm/cold_clear_2.js',
	'./wasm/cold_clear_2_bg.wasm?v=4',
	'./assets/sfx/ClearSpin.wav',
	'./assets/sfx/ClearTetra.wav',
	'./assets/sfx/CountdownFinish.wav',
	'./assets/sfx/Countdown.wav',
	'./assets/sfx/FinesseFault.wav',
	'./assets/sfx/Finish.wav',
	'./assets/sfx/GarbageLarge.wav',
	'./assets/sfx/GarbageLight.wav',
	'./assets/sfx/GarbageMed.wav',
	'./assets/sfx/HardDrop.wav',
	'./assets/sfx/Hold.wav',
	'./assets/sfx/IncomingLarge.wav',
	'./assets/sfx/IncomingLight.wav',
	'./assets/sfx/IncomingMed.wav',
	'./assets/sfx/LockDelay.wav',
	'./assets/sfx/Move.wav',
	'./assets/sfx/PerfectClear.wav',
	'./assets/sfx/Rotate.wav',
	'./assets/sfx/SlowDown.wav',
	'./assets/sfx/SoftDrop.wav',
	'./assets/sfx/TopOut.wav',
	'./assets/sfx/TSpin1.wav',
	'./assets/sfx/Woosh1.wav',
	'./assets/sfx/Woosh3.wav',
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

	// Navigations are network-first so an online launch always sees a new
	// index.html and its versioned assets. Cached shell is the offline fallback.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((response) => {
					if (response && response.ok) {
						const copy = response.clone();
						caches.open(CACHE_VERSION).then((cache) => {
							cache.put('./index.html?mobile=1', copy);
						});
					}
					return response;
				})
				.catch(() =>
					caches
						.match(request)
						.then((cached) => cached || caches.match('./index.html?mobile=1'))
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
