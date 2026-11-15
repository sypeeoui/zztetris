// Service worker for the ZZTetris mobile PWA.
//
// Bump CACHE_VERSION whenever the shell or wasm changes so installed clients
// pick up the new files. The 23 MB legal-boards database and the research
// pc_data.json are deliberately not precached; the mobile shell does not use
// the analyzer.
const CACHE_VERSION = 'zztetris-mobile-d51eb311';

const ASSETS = [
	'./index.html?mobile=1',
	'./manifest.webmanifest',
	'./styles/mobile.css?v=7b0bc79e',
	'./styles/zztetris.css?v=bfe3074a',
	'./styles/replay.css?v=b7d0e65f',
	'./styles/replay-mobile.css?v=8282d2f7',
	'./replay.html',
	'./replay.js?v=b8b8dd04',
	'./replay-api.js?v=b9cad92a',
	'./sound-pack.js?v=2d5fce9a',
	'./replay-audio.js?v=f8546c48',
	'./replay-practice.js?v=ff40dac7',
	'./replay-common.js?v=25242f8b',
	'./replay-engine.js?v=db2dd99e',
	'./styles/paint_bucket.css',
	'./styles/import_export.css',
	'./styles/board_settings.css',
	'./mobile.js?v=85074542',
	'./base.js?v=ddc921b4',
	'./zztetris.js?v=aa6bc516',
	'./stats-config.js?v=87260c9e',
	'./stats-core.js?v=c13feafa',
	'./stats.js?v=e29c2d2f',
	'./keybinds.js?v=d3dc5230',
	'./practice-settings.js?v=43a1be04',
	'./attack-sim.js?v=1f90ace9',
	'./auto-lock.js?v=355903c7',
	'./rotationSystem.js',
	'./io.js',
	'./utils.js?v=0f473dcb',
	'./tetris-fumen.js',
	'./tetrio.js',
	'./engineWorker.js?v=3df45535',
	'./fourwide-core.js?v=d44e9dcc',
	'./fourwideWorker.js?v=61ffb8b9',
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
	'./assets/sfx/tetrio/move.mp3?v=ff8fad9e',
	'./assets/sfx/tetrio/rotate.mp3?v=7adb458d',
	'./assets/sfx/tetrio/hold.mp3?v=af73861e',
	'./assets/sfx/tetrio/harddrop.mp3?v=b9250e6a',
	'./assets/sfx/tetrio/softdrop.mp3?v=7c0bf0cc',
	'./assets/sfx/tetrio/floor.mp3?v=c10964fc',
	'./assets/sfx/tetrio/clearline.mp3?v=6793f12c',
	'./assets/sfx/tetrio/clearquad.mp3?v=4f4ededd',
	'./assets/sfx/tetrio/clearspin.mp3?v=d5c70c1f',
	'./assets/sfx/tetrio/clearbtb.mp3?v=93512e78',
	'./assets/sfx/tetrio/allclear.mp3?v=4b9fed1f',
	'./assets/sfx/tetrio/combo_1.mp3?v=393e0248',
	'./assets/sfx/tetrio/combo_2.mp3?v=94723731',
	'./assets/sfx/tetrio/combo_3.mp3?v=84cfb376',
	'./assets/sfx/tetrio/combo_4.mp3?v=4d1964b2',
	'./assets/sfx/tetrio/combo_5.mp3?v=f193f621',
	'./assets/sfx/tetrio/combo_6.mp3?v=f8ca0576',
	'./assets/sfx/tetrio/combo_7.mp3?v=45e2818e',
	'./assets/sfx/tetrio/combo_8.mp3?v=2914251e',
	'./assets/sfx/tetrio/combo_9.mp3?v=31df1808',
	'./assets/sfx/tetrio/combo_10.mp3?v=f0930c71',
	'./assets/sfx/tetrio/combo_11.mp3?v=f697b4fc',
	'./assets/sfx/tetrio/combo_12.mp3?v=baa6b16a',
	'./assets/sfx/tetrio/combo_13.mp3?v=5daebd6d',
	'./assets/sfx/tetrio/combo_14.mp3?v=a402bafe',
	'./assets/sfx/tetrio/combo_15.mp3?v=37502dd9',
	'./assets/sfx/tetrio/combo_16.mp3?v=0be906ff',
	'./assets/sfx/tetrio/btb_1.mp3?v=f5e696e2',
	'./assets/sfx/tetrio/btb_2.mp3?v=cc1f6c19',
	'./assets/sfx/tetrio/btb_3.mp3?v=403ab8ef',
	'./assets/sfx/tetrio/btb_break.mp3?v=e1d850cd',
	'./assets/sfx/tetrio/damage_small.mp3?v=eab17ad5',
	'./assets/sfx/tetrio/damage_medium.mp3?v=eb64afad',
	'./assets/sfx/tetrio/damage_large.mp3?v=ad499f81',
	'./assets/sfx/tetrio/damage_alert.mp3?v=09eef0a5',
	'./assets/sfx/tetrio/warning.mp3?v=613bb538',
	'./assets/sfx/tetrio/hyperalert.mp3?v=64289af1',
	'./assets/sfx/tetrio/finessefault.mp3?v=d578a061',
	'./assets/sfx/tetrio/gameover.mp3?v=a2633036',
	'./assets/sfx/tetrio/finish.mp3?v=11a99a18',
	'./assets/sfx/tetrio/topout.mp3?v=00675c33',
	'./assets/sfx/tetrio/combobreak.mp3?v=e40a77eb',
	'./assets/sfx/tetrio/hit.mp3?v=f04cdcb0',
	'./assets/sfx/tetrio/undo.mp3?v=bb3a6442',
	'./assets/sfx/tetrio/redo.mp3?v=8aa002a1',
	'./assets/sfx/tetrio/spin.mp3?v=ecf529e1',
	'./assets/sfx/tetrio/spinend.mp3?v=9072cca3',
	'./assets/sfx/tetrio/b2bcharge_start.mp3?v=a33a0f32',
	'./assets/sfx/tetrio/b2bcharge_1.mp3?v=b72aa295',
	'./assets/sfx/tetrio/b2bcharge_2.mp3?v=0a176289',
	'./assets/sfx/tetrio/b2bcharge_3.mp3?v=7cc90c59',
	'./assets/sfx/tetrio/b2bcharge_4.mp3?v=71cec0ec',
	'./assets/sfx/tetrio/b2bcharge_distance_1.mp3?v=5408e746',
	'./assets/sfx/tetrio/b2bcharge_distance_2.mp3?v=88f1dfe8',
	'./assets/sfx/tetrio/b2bcharge_distance_3.mp3?v=ee4a2f1e',
	'./assets/sfx/tetrio/b2bcharge_blast_1.mp3?v=ac2083dd',
	'./assets/sfx/tetrio/b2bcharge_blast_2.mp3?v=e6b53f2a',
	'./assets/sfx/tetrio/b2bcharge_blast_3.mp3?v=a6f46418',
	'./assets/sfx/tetrio/b2bcharge_blast_4.mp3?v=28ad7755',
	'./assets/sfx/tetrio/b2bcharge_danger.mp3?v=5b4b310a',
	'./assets/sfx/tetrio/garbage_out_small.mp3?v=eb69ea05',
	'./assets/sfx/tetrio/garbage_out_medium.mp3?v=5dd6c1a2',
	'./assets/sfx/tetrio/garbage_out_large.mp3?v=383e69fd',
	'./assets/sfx/tetrio/garbage_in_small.mp3?v=c59bb7c0',
	'./assets/sfx/tetrio/garbage_in_medium.mp3?v=00251c8d',
	'./assets/sfx/tetrio/garbage_in_large.mp3?v=e044c69e',
	'./assets/sfx/tetrio/garbagewindup_1.mp3?v=51daa93b',
	'./assets/sfx/tetrio/garbagewindup_2.mp3?v=ab1ed989',
	'./assets/sfx/tetrio/garbagewindup_3.mp3?v=02a4394c',
	'./assets/sfx/tetrio/garbagewindup_4.mp3?v=095cfd64',
	'./assets/sfx/tetrio/garbagerise.mp3?v=3d0a38b7',
	'./assets/sfx/tetrio/garbagesmash.mp3?v=9d4c59e3',
	'./assets/sfx/tetrio/counter.mp3?v=ffb3aabe',
	'./assets/sfx/tetrio/impact.mp3?v=8b1aaf2e',
	'./assets/sfx/tetrio/exchange.mp3?v=51775a3c',
	'./assets/sfx/tetrio/offset.mp3?v=4de2a465',
	'./assets/sfx/tetrio/protected_small.mp3?v=00c744e9',
	'./assets/sfx/tetrio/protected_medium.mp3?v=394d5331',
	'./assets/sfx/tetrio/protected_large.mp3?v=67ca8a06',
	'./assets/sfx/tetrio/death.mp3?v=daedb593',
	'./assets/sfx/tetrio/victory.mp3?v=551b9ef4',
	'./assets/sfx/tetrio/losestock.mp3?v=b28ece6e',
	'./assets/sfx/tetrio/levelup.mp3?v=2e2a5209',
	'./assets/sfx/tetrio/level10.mp3?v=2786499f',
	'./assets/sfx/tetrio/level100.mp3?v=d69c5e4e',
	'./assets/sfx/tetrio/level500.mp3?v=d337e598',
	'./assets/sfx/tetrio/ratingraise.mp3?v=d3b6ee73',
	'./assets/sfx/tetrio/ratinglower.mp3?v=aec99e0c',
	'./assets/sfx/tetrio/rankraise.mp3?v=76275f8c',
	'./assets/sfx/tetrio/ranklower.mp3?v=5c67d844',
	'./assets/sfx/tetrio/personalbest.mp3?v=29341a8f',
	'./assets/sfx/tetrio/worldrecord.mp3?v=8888be08',
	'./assets/sfx/tetrio/achievement_1.mp3?v=3165108e',
	'./assets/sfx/tetrio/achievement_2.mp3?v=e8d1853b',
	'./assets/sfx/tetrio/achievement_3.mp3?v=6c62ca62',
	'./assets/sfx/tetrio/supporter.mp3?v=0c2c1d76',
	'./assets/sfx/tetrio/purchase_start.mp3?v=145ba9e6',
	'./assets/sfx/tetrio/showscore.mp3?v=e57388e2',
	'./assets/sfx/tetrio/scoreslide_in.mp3?v=a2113a25',
	'./assets/sfx/tetrio/scoreslide_out.mp3?v=1a6e0d7d',
	'./assets/sfx/tetrio/matchintro.mp3?v=40765fe6',
	'./assets/sfx/tetrio/countdown1.mp3?v=fbb15daa',
	'./assets/sfx/tetrio/countdown2.mp3?v=c05b86c6',
	'./assets/sfx/tetrio/countdown3.mp3?v=d01b1a32',
	'./assets/sfx/tetrio/countdown4.mp3?v=56ee57ff',
	'./assets/sfx/tetrio/countdown5.mp3?v=9702d691',
	'./assets/sfx/tetrio/go.mp3?v=ac36e8ba',
	'./assets/sfx/tetrio/elim.mp3?v=e593f043',
	'./assets/sfx/tetrio/applause.mp3?v=ce060e04',
	'./assets/sfx/tetrio/party_ready.mp3?v=2170405f',
	'./assets/sfx/tetrio/userjoin.mp3?v=a256cf0a',
	'./assets/sfx/tetrio/userleave.mp3?v=74ae4775',
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
