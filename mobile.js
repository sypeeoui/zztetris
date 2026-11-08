// Mobile shell for ZZTetris.
//
// The desktop game stays in base.js. This file only builds the mobile UI,
// translates gestures/buttons into window.ZZInput calls, and owns the mobile
// settings, pause menu and PWA wiring.
(function () {
	'use strict';

	const root = document.documentElement;
	if (!root.classList.contains('mobile')) return;

	const STORAGE_KEY = 'zztetris_mobile_v1';
	const params = new URLSearchParams(location.search);

	// The shell version comes from this script's own ?v= query. It doubles as
	// the service-worker script URL so a new release is never fetched from an
	// old CDN cache. Keep it in sync with mobile.js?v= in index.html.
	const SHELL_VERSION = (() => {
		try {
			const src = (document.currentScript && document.currentScript.src) || '';
			return new URL(src, location.href).searchParams.get('v') || '10';
		} catch (error) {
			return '10';
		}
	})();

	// Also put the SW cache version in the registration URL. The CDN caches
	// sw.js by full URL for hours, so the pair must never be reused with new
	// content. Keep this in sync with CACHE_VERSION in sw.js.
	const SW_CACHE_VERSION = 'zztetris-mobile-fc6f30f4';

	const ACTIONS = [
		{ value: '', label: 'None' },
		{ value: 'L', label: 'Move Left' },
		{ value: 'R', label: 'Move Right' },
		{ value: 'SD', label: 'Soft Drop' },
		{ value: 'HD', label: 'Hard Drop' },
		{ value: 'HL', label: 'Hold' },
		{ value: 'CW', label: 'Rotate CW' },
		{ value: 'CCW', label: 'Rotate CCW' },
		{ value: 'R180', label: 'Rotate 180' },
		{ value: 'UNDO', label: 'Undo' },
		{ value: 'REDO', label: 'Redo' },
		{ value: 'RE', label: 'Restart' },
		{ value: 'RESET_SESSION', label: 'Reset Session' },
		{ value: 'RESET_QUEUE', label: 'Reset Queue' },
		{ value: 'RESET_QUEUE_HOLD', label: 'Reset Queue + Hold' },
	];

	const ACTION_ICONS = {
		L: 's-back',
		R: 's-forward',
		SD: 's-down',
		HD: 's-harddrop',
		HL: 's-hold',
		CW: 's-cw',
		CCW: 's-ccw',
		R180: 's-r180',
		UNDO: 's-un',
		REDO: 's-reload',
		RE: 's-reload',
		RESET_SESSION: 's-reload',
		RESET_QUEUE: 's-reload',
		RESET_QUEUE_HOLD: 's-reload',
	};

	const HOLD_ACTIONS = new Set(['L', 'R', 'SD']);

	// Portrait clusters can use either a 3-row "wide, pair, wide" shape or a
	// 2x2 grid. The wide shape on the right puts hold on top and hard drop on
	// the bottom wide button, with the rotations in the middle row.
	const PORTRAIT_SHAPES = {
		wide: {
			left: {
				SD: { cluster: 'left', col: 1, row: 1, span: 2 },
				L: { cluster: 'left', col: 1, row: 2 },
				R: { cluster: 'left', col: 2, row: 2 },
				R180: { cluster: 'left', col: 1, row: 3, span: 2 },
			},
			right: {
				HL: { cluster: 'right', col: 1, row: 1, span: 2 },
				CCW: { cluster: 'right', col: 1, row: 2 },
				CW: { cluster: 'right', col: 2, row: 2 },
				HD: { cluster: 'right', col: 1, row: 3, span: 2 },
			},
		},
		grid: {
			left: {
				SD: { cluster: 'left', col: 1, row: 1 },
				L: { cluster: 'left', col: 2, row: 1 },
				R: { cluster: 'left', col: 1, row: 2 },
				R180: { cluster: 'left', col: 2, row: 2 },
			},
			right: {
				CCW: { cluster: 'right', col: 1, row: 1 },
				CW: { cluster: 'right', col: 2, row: 1 },
				HD: { cluster: 'right', col: 1, row: 2 },
				HL: { cluster: 'right', col: 2, row: 2 },
			},
		},
	};

	const PORTRAIT_SLOT_ORDER = ['SD', 'L', 'R', 'R180', 'CCW', 'CW', 'HD', 'HL'];

	function defaultLandscapeButtons(preset) {
		const buttons = [
			{ id: 'L', x: 5, y: 89, action: 'L', icon: 's-back', hold: true },
			{ id: 'R', x: 14, y: 89, action: 'R', icon: 's-forward', hold: true },
			{ id: 'SD', x: 9.5, y: 67, action: 'SD', icon: 's-down', hold: true },
			{ id: 'CCW', x: 87, y: 51, action: 'CCW', icon: 's-ccw', hold: false },
			{ id: 'CW', x: 95, y: 51, action: 'CW', icon: 's-cw', hold: false },
			{ id: 'HD', x: 91, y: 70, action: 'HD', icon: 's-harddrop', hold: false },
			{ id: 'HL', x: 87, y: 88, action: 'HL', icon: 's-hold', hold: false },
			{ id: 'R180', x: 95, y: 88, action: 'R180', icon: 's-r180', hold: false },
		];
		if (preset === 'left-handed') {
			for (const button of buttons) button.x = 100 - button.x;
		}
		return buttons;
	}

	function defaultPortraitButtons() {
		return [
			{ slot: 'SD', action: 'SD', icon: 's-down', hold: true },
			{ slot: 'L', action: 'L', icon: 's-back', hold: true },
			{ slot: 'R', action: 'R', icon: 's-forward', hold: true },
			{ slot: 'R180', action: 'R180', icon: 's-r180', hold: false },
			{ slot: 'CCW', action: 'CCW', icon: 's-ccw', hold: false },
			{ slot: 'CW', action: 'CW', icon: 's-cw', hold: false },
			{ slot: 'HD', action: 'HD', icon: 's-harddrop', hold: false },
			{ slot: 'HL', action: 'HL', icon: 's-hold', hold: false },
		];
	}

	function portraitSlot(slot) {
		const left = PORTRAIT_SHAPES[config.portrait.leftShape] || PORTRAIT_SHAPES.wide;
		const right = PORTRAIT_SHAPES[config.portrait.rightShape] || PORTRAIT_SHAPES.wide;
		return left.left[slot] || right.right[slot] || null;
	}

	const DEFAULT_CONFIG = {
		version: 3,
		portrait: {
			split: 0.5,
			inputMode: 'gesture',
			size: 64,
			leftShape: 'wide',
			rightShape: 'wide',
			left: {
				tap: 'HL',
				longPress: null,
				swipeLeft: 'CCW',
				swipeRight: 'CW',
				swipeUp: 'R180',
				swipeDown: null,
				dragHorizontal: null,
				dragDown: null,
			},
			right: {
				tap: 'HD',
				longPress: null,
				swipeLeft: null,
				swipeRight: null,
				swipeUp: null,
				swipeDown: null,
				dragHorizontal: 'MOVE',
				dragDown: 'SD',
			},
			thresholds: {
				swipe: 24,
				tapMax: 220,
				longPress: 300,
				deadZone: 10,
			},
			buttons: defaultPortraitButtons(),
		},
		landscape: {
			preset: 'techmino',
			inputMode: 'buttons',
			size: 64,
			opacity: 55,
			haptics: true,
			buttons: defaultLandscapeButtons('techmino'),
		},
		display: {
			showHold: true,
			showNext: true,
			showStats: true,
			extraStat: 'finesse',
		},
		buttons: {
			slide: true,
		},
		pauseCorner: 'top-right',
	};

	function clone(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function mergeDeep(base, extra) {
		if (!extra || typeof extra !== 'object') return base;
		if (Array.isArray(base) || Array.isArray(extra)) return extra;
		const out = Object.assign({}, base);
		for (const key of Object.keys(extra)) {
			if (
				extra[key] &&
				typeof extra[key] === 'object' &&
				!Array.isArray(extra[key]) &&
				base[key] &&
				typeof base[key] === 'object' &&
				!Array.isArray(base[key])
			) {
				out[key] = mergeDeep(base[key], extra[key]);
			} else {
				out[key] = extra[key];
			}
		}
		return out;
	}

	function loadConfig() {
		let stored = null;
		try {
			stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
		} catch (error) {
			stored = null;
		}
		const merged = mergeDeep(clone(DEFAULT_CONFIG), stored);
		if (!stored || stored.version !== 3) {
			merged.version = 3;
			// v1 hid the hold/next strips by default. Show them once on upgrade;
			// the user can still hide them again in Settings.
			if (!stored || stored.version < 2) {
				merged.display = {
					showHold: true,
					showNext: true,
					showStats: true,
					extraStat: 'finesse',
				};
			}
			if (!merged.display) {
				merged.display = {
					showHold: true,
					showNext: true,
					showStats: true,
					extraStat: 'finesse',
				};
			}
			if (!merged.display.extraStat) merged.display.extraStat = 'finesse';
			if (typeof merged.display.showStats !== 'boolean') merged.display.showStats = true;
			if (!merged.portrait.inputMode) merged.portrait.inputMode = 'gesture';
			if (!merged.landscape.inputMode) merged.landscape.inputMode = 'buttons';
		}
		return merged;
	}

	let config = loadConfig();
	normalizeConfig();

	function normalizeConfig() {
		if (!PORTRAIT_SHAPES[config.portrait.leftShape]) config.portrait.leftShape = 'wide';
		if (!PORTRAIT_SHAPES[config.portrait.rightShape]) config.portrait.rightShape = 'wide';
		const portraitSize = Number(config.portrait.size);
		config.portrait.size = Number.isFinite(portraitSize)
			? Math.min(96, Math.max(44, portraitSize))
			: 64;
		if (!config.buttons || typeof config.buttons !== 'object') config.buttons = {};
		if (typeof config.buttons.slide !== 'boolean') config.buttons.slide = true;
		const landscapeDefaults = defaultLandscapeButtons('techmino');
		const byId = {};
		for (const button of landscapeDefaults) byId[button.id] = button;
		if (!Array.isArray(config.landscape.buttons) || !config.landscape.buttons.length) {
			config.landscape.buttons = defaultLandscapeButtons(
				config.landscape.preset === 'left-handed' ? 'left-handed' : 'techmino'
			);
		} else {
			for (const button of config.landscape.buttons) {
				const fallback = byId[button.id];
				if (!fallback) continue;
				if (!button.icon) button.icon = fallback.icon;
				if (typeof button.hold !== 'boolean') button.hold = fallback.hold;
				if (typeof button.x !== 'number') button.x = fallback.x;
				if (typeof button.y !== 'number') button.y = fallback.y;
			}
		}

		const portraitDefaults = defaultPortraitButtons();
		const bySlot = {};
		for (const button of portraitDefaults) bySlot[button.slot] = button;
		if (!Array.isArray(config.portrait.buttons) || !config.portrait.buttons.length) {
			config.portrait.buttons = defaultPortraitButtons();
		} else {
			for (const button of config.portrait.buttons) {
				const fallback = bySlot[button.slot];
				if (!fallback) continue;
				if (!button.icon) button.icon = fallback.icon;
				if (typeof button.hold !== 'boolean') button.hold = fallback.hold;
			}
		}
	}

	function saveConfig() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
		} catch (error) {
			// Storage can be unavailable in private mode; the session still works.
		}
	}

	let orientation = 'portrait';
	let paused = false;
	let deferredPrompt = null;
	let subSheetParent = null;

	const buttonByElement = new WeakMap();
	const buttonSessions = new Map();
	const heldRefs = new Map();

	function $(id) {
		return document.getElementById(id);
	}

	function show(id) {
		const element = $(id);
		if (element) element.hidden = false;
	}

	function hide(id) {
		const element = $(id);
		if (element) element.hidden = true;
	}

	function openSubSheet(id, parent) {
		subSheetParent = parent || null;
		if (parent) hide(parent);
		show(id);
	}

	function closeSubSheet(id) {
		hide(id);
		if (subSheetParent) {
			show(subSheetParent);
			subSheetParent = null;
		}
	}

	// The notification lives inside the hidden left column on desktop. Move it
	// to the body so it can float over the mobile board.
	const notif = $('notif');
	if (notif) document.body.appendChild(notif);

	buildHud();
	buildStatsMini();
	buildPauseButton();
	buildPortraitControls();
	buildPortraitButtons();
	buildLandscapeControls();
	buildPauseMenu();
	buildSettings();
	buildBoardSheet();
	buildQueueSheet();
	buildModeMenu();
	buildLayoutEditor();
	setupBoardDrawing();

	updateOrientation();
	window.addEventListener('resize', updateOrientation);
	window.addEventListener('orientationchange', () => setTimeout(updateOrientation, 120));

	setInterval(drawHud, 120);

	// The game API is created inside callback() after the piece images load.
	// Apply the current pause state as soon as it exists.
	const syncPause = setInterval(() => {
		if (window.ZZInput) {
			window.ZZInput.setPaused(paused);
			clearInterval(syncPause);
		}
	}, 100);

	if (params.get('menu') === '1') {
		setTimeout(openModeMenu, 300);
	}

	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		deferredPrompt = event;
		const install = $('zzInstallBtn');
		if (install) install.hidden = false;
	});

	if ('serviceWorker' in navigator) {
		// Reload once when a newer worker takes control, so an update does not
		// need the user to close and reopen the installed app.
		const hadController = !!navigator.serviceWorker.controller;
		let reloading = false;
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			if (!hadController || reloading) return;
			reloading = true;
			location.reload();
		});
	}

	if (!params.get('nosw') && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
		window.addEventListener('load', () => {
			navigator.serviceWorker
				.register(
					'sw.js?v=' +
						encodeURIComponent(SHELL_VERSION) +
						'&c=' +
						encodeURIComponent(SW_CACHE_VERSION),
					{ updateViaCache: 'none' }
				)
				.then((registration) => {
					const check = () => registration.update().catch(() => {});
					document.addEventListener('visibilitychange', () => {
						if (!document.hidden) check();
					});
					window.addEventListener('online', check);
					setInterval(check, 15 * 60 * 1000);
				})
				.catch(() => {});
		});
	}

	async function clearShellCacheAndReload() {
		try {
			if ('serviceWorker' in navigator) {
				const registrations = await navigator.serviceWorker.getRegistrations();
				await Promise.all(registrations.map((registration) => registration.unregister()));
			}
			if ('caches' in window) {
				const keys = await caches.keys();
				await Promise.all(keys.map((key) => caches.delete(key)));
			}
		} catch (error) {
			// Reload anyway; the versioned URL still bypasses an old shell.
		}
		location.replace('./index.html?mobile=1&refresh=' + Date.now());
	}

	document.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape') return;
		const overlays = [
			'zzLayoutEditor',
			'zzSettingsSheet',
			'zzBoardSheet',
			'zzQueueSheet',
			'zzModeMenu',
			'zzPauseMenu',
		];
		for (const id of overlays) {
			const element = $(id);
			if (!element || element.hidden) continue;
			if (id === 'zzPauseMenu') closePause();
			else if (id === 'zzModeMenu') {
				hide(id);
				setPaused(false);
			} else if (id === 'zzLayoutEditor') {
				closeLayoutEditor();
			} else {
				closeSubSheet(id);
			}
			event.preventDefault();
			return;
		}
	});

	// ---------------------------------------------------------------------
	// Orientation and board sizing
	// ---------------------------------------------------------------------

	function updateOrientation() {
		orientation = window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape';
		root.dataset.mobileOrientation = orientation;
		applyInputModes();
		applyPauseCorner();
		rebuildLandscapeButtons();
		requestAnimationFrame(resizeBoard);
	}

	function applyInputModes() {
		root.dataset.inputMode = config.portrait.inputMode || 'gesture';
		root.dataset.landscapeInputMode = config.landscape.inputMode || 'buttons';
		updateControlsHeight();
		updateHudVisibility();
		requestAnimationFrame(resizeBoard);
	}

	// Portrait buttons have their own size so changing the landscape size
	// cannot push the two clusters past the screen edges. The configured size
	// is additionally capped by the available width and height.
	function portraitButtonSize() {
		const configured = Math.min(96, Math.max(44, Number(config.portrait.size) || 64));
		const width = window.innerWidth || root.clientWidth || 390;
		const height = window.innerHeight || root.clientHeight || 844;
		const widthFit = Math.max(44, Math.floor((width - 40) / 4));
		const heightFit = Math.max(44, Math.floor((height * 0.4 - 32) / 3));
		return Math.min(configured, widthFit, heightFit);
	}

	function updateControlsHeight() {
		const portraitSize = portraitButtonSize();
		root.style.setProperty('--zz-portrait-btn-size', portraitSize + 'px');
		let height;
		if (orientation === 'portrait') {
			height =
				config.portrait.inputMode === 'buttons'
					? portraitSize * 3 + 32
					: Math.min(Math.max(window.innerHeight * 0.24, 120), 200);
		} else {
			height = 120;
		}
		root.style.setProperty('--zz-controls-height', Math.round(height) + 'px');
	}

	function resizeBoard() {
		const wrap = document.querySelector('.board-wrap');
		const board = $('b');
		if (!wrap || !board) return;
		const rect = wrap.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		const aspect = 200 / 440;
		let height = rect.height;
		let width = height * aspect;
		if (width > rect.width) {
			width = rect.width;
			height = width / aspect;
		}
		board.style.width = Math.floor(width) + 'px';
		board.style.height = Math.floor(height) + 'px';
	}

	// ---------------------------------------------------------------------
	// HUD
	// ---------------------------------------------------------------------

	function buildHud() {
		const hud = document.createElement('div');
		hud.id = 'zzMobileHud';
		hud.innerHTML =
			'<canvas id="zzHoldMini" width="52" height="35" title="Hold — open board settings"></canvas>' +
			'<canvas id="zzNextMini" width="52" height="175" title="Next queue — open queue settings"></canvas>';
		document.body.appendChild(hud);
		const hold = $('zzHoldMini');
		const next = $('zzNextMini');
		if (hold) {
			hold.addEventListener('click', () => {
				setPaused(true);
				openSubSheet('zzBoardSheet', 'zzPauseMenu');
			});
		}
		if (next) {
			next.addEventListener('click', () => {
				setPaused(true);
				openQueueSheet('zzPauseMenu');
			});
		}
		updateHudVisibility();
	}

	function updateHudVisibility() {
		const hud = $('zzMobileHud');
		if (!hud) return;
		const showHud = config.display.showHold || config.display.showNext;
		hud.hidden = !showHud;
		const hold = $('zzHoldMini');
		const next = $('zzNextMini');
		if (hold) hold.hidden = !config.display.showHold;
		if (next) next.hidden = !config.display.showNext;
		const stats = $('zzStatsMini');
		if (stats) {
			stats.hidden = !config.display.showStats;
			const holdTop = config.pauseCorner === 'top-left' ? 56 : 6;
			stats.style.top = config.display.showHold
				? 'calc(' + (holdTop + 42) + 'px + env(safe-area-inset-top))'
				: 'calc(6px + env(safe-area-inset-top))';
		}
	}

	function drawHud() {
		const hold = $('zzHoldMini');
		const next = $('zzNextMini');
		if (hold && !hold.hidden) {
			const ctx = hold.getContext('2d');
			ctx.clearRect(0, 0, hold.width, hold.height);
			if (typeof holdP !== 'undefined' && holdP && typeof imgs !== 'undefined' && imgs[holdP]) {
				ctx.drawImage(imgs[holdP], 0, 0, hold.width, hold.height);
			}
		}
		if (next && !next.hidden) {
			const ctx = next.getContext('2d');
			ctx.clearRect(0, 0, next.width, next.height);
			if (typeof queue !== 'undefined' && typeof imgs !== 'undefined') {
				let y = 0;
				let count = 0;
				for (const piece of queue) {
					if (piece === '|') continue;
					if (!imgs[piece]) continue;
					ctx.drawImage(imgs[piece], 0, y, 52, 35);
					y += 35;
					count++;
					if (count >= 5) break;
				}
			}
		}
		updateStatsMini();
	}

	function buildStatsMini() {
		const stats = document.createElement('div');
		stats.id = 'zzStatsMini';
		stats.innerHTML =
			'<div class="zzStatRow"><span>B2B</span><b id="zzStatB2B">0</b></div>' +
			'<div class="zzStatRow"><span>CMB</span><b id="zzStatCombo">0</b></div>' +
			'<div class="zzStatRow" id="zzStatDamageRow"><span>DMG</span><b id="zzStatDamage">0</b></div>' +
			'<div class="zzStatRow" id="zzStatSpikeRow"><span>SPK</span><b id="zzStatSpike">0</b></div>' +
			'<div class="zzStatRow"><span>PPS</span><b id="zzStatPps">0.00</b></div>' +
			'<div class="zzStatRow"><span>APM</span><b id="zzStatApm">0.0</b></div>' +
			'<div class="zzStatRow"><span>VS</span><b id="zzStatVs">0.0</b></div>' +
			'<div class="zzStatRow"><span id="zzStatExtraLabel">FIN</span><b id="zzStatExtra">—</b></div>';
		document.body.appendChild(stats);
		updateStatsMini();
		setInterval(updateStatsMini, 100);
	}

	function updateStatsMini() {
		const stats = $('zzStatsMini');
		if (!stats || stats.hidden) return;
		const core = window.ZZStatsCore;
		const configApi = window.ZZStatsConfig;
		const api = window.ZZStats;
		if (!core || !configApi || !api) return;
		const state = api.getState();
		if (!state) return;
		const now = Date.now();
		const comboValue = Math.max(0, typeof combo === 'number' ? combo : 0);
		const b2bValue = Math.max(0, typeof b2b === 'number' ? b2b : 0);
		const extra = { combo: comboValue, b2b: b2bValue };
		const set = (id, statId) => {
			const element = $(id);
			if (!element) return;
			const value = core.getStatValue(state, statId, now, extra);
			element.textContent = core.formatStat(statId, value, configApi.STAT_DEFS);
		};
		set('zzStatB2B', 'b2b');
		set('zzStatCombo', 'combo');
		set('zzStatPps', 'pps');
		set('zzStatApm', 'apm');
		set('zzStatVs', 'vs');

		const attack = api.getAttackDisplay ? api.getAttackDisplay() : { damage: 0, spike: 0 };
		const damageValue = $('zzStatDamage');
		const spikeValue = $('zzStatSpike');
		if (damageValue) damageValue.textContent = String(attack.damage);
		if (spikeValue) spikeValue.textContent = String(attack.spike);

		const extraId = config.display.extraStat || 'finesse';
		const def = configApi.STAT_DEFS.find((entry) => entry.id === extraId);
		const label = $('zzStatExtraLabel');
		if (label) label.textContent = shortStatLabel(def);
		set('zzStatExtra', extraId);
	}

	function shortStatLabel(def) {
		if (!def) return 'EXT';
		const map = {
			b2b: 'B2B',
			combo: 'CMB',
			pps: 'PPS',
			apm: 'APM',
			vs: 'VS',
			finesse: 'FIN',
			lines: 'LIN',
			pieces: 'PCS',
			attack: 'ATK',
			holds: 'HLD',
			keys: 'KEY',
			lpm: 'LPM',
			kpp: 'KPP',
			app: 'APP',
			garbageSent: 'GST',
			garbageReceived: 'GRC',
			garbageCleared: 'GCL',
			downstackPerSecond: 'DS/S',
			downstackPerPiece: 'DS/P',
			garbageEfficiency: 'GbE',
			cheeseIndex: 'CHS',
			vsApm: 'VS/A',
			appDsP: 'A+DS',
			wapp: 'wAPP',
			area: 'AREA',
			surge: 'SRG',
			finesseFaults: 'FLT',
			faultsPerPiece: 'F/P',
			perfectPieces: 'PRF',
			faultyPieces: 'FLT',
			maxCombo: 'MXC',
			maxB2B: 'MXB',
			singles: 'SGL',
			doubles: 'DBL',
			triples: 'TRP',
			quads: 'QUD',
			tspins: 'TSP',
			miniTspins: 'MTS',
			allspins: 'ASP',
			perfectClears: 'PC',
			tspinEfficiency: 'TSE',
			allspinEfficiency: 'ASE',
			quadEfficiency: 'QE',
			b2bEfficiency: 'B2BE',
			comboEfficiency: 'CMBE',
			pcEfficiency: 'PCE',
			surgeEfficiency: 'SRGE',
			clearEfficiency: 'CLE',
			piecesPerLine: 'P/L',
			holdsPerPiece: 'H/P',
		};
		return map[def.id] || def.label.slice(0, 4).toUpperCase();
	}

	// ---------------------------------------------------------------------
	// Pause button and pause menu
	// ---------------------------------------------------------------------

	function buildPauseButton() {
		const button = document.createElement('button');
		button.id = 'zzPauseBtn';
		button.type = 'button';
		button.setAttribute('aria-label', 'Pause');
		button.innerHTML =
			'<svg viewBox="0 0 24 24" aria-hidden="true">' +
			'<rect x="6" y="4" width="4" height="16" rx="1"></rect>' +
			'<rect x="14" y="4" width="4" height="16" rx="1"></rect>' +
			'</svg>';
		button.addEventListener('click', openPause);
		document.body.appendChild(button);
		applyPauseCorner();
	}

	function applyPauseCorner() {
		const button = $('zzPauseBtn');
		if (!button) return;
		const corner = config.pauseCorner || 'top-right';
		button.style.top = corner.startsWith('top') ? 'calc(6px + env(safe-area-inset-top))' : 'auto';
		button.style.bottom = corner.startsWith('bottom')
			? 'calc(6px + env(safe-area-inset-bottom))'
			: 'auto';
		button.style.left = corner.endsWith('left') ? 'calc(8px + env(safe-area-inset-left))' : 'auto';
		button.style.right = corner.endsWith('right') ? 'calc(8px + env(safe-area-inset-right))' : 'auto';

		// Keep the hold/next strips clear of the pause button.
		const hold = $('zzHoldMini');
		const next = $('zzNextMini');
		if (hold) {
			hold.style.top =
				corner === 'top-left'
					? 'calc(56px + env(safe-area-inset-top))'
					: 'calc(6px + env(safe-area-inset-top))';
		}
		if (next) {
			const nextTop =
				orientation === 'portrait' && corner === 'top-right'
					? 'calc(56px + env(safe-area-inset-top))'
					: 'calc(6px + env(safe-area-inset-top))';
			next.style.top = nextTop;
		}
		updateHudVisibility();
	}

	function setPaused(value) {
		paused = !!value;
		if (paused) clearButtonSessions();
		window.ZZInput?.setPaused(paused);
	}

	function openPause() {
		setPaused(true);
		show('zzPauseMenu');
	}

	function closePause() {
		hide('zzPauseMenu');
		setPaused(false);
	}

	function buildPauseMenu() {
		const overlay = document.createElement('div');
		overlay.id = 'zzPauseMenu';
		overlay.className = 'zzOverlay';
		overlay.hidden = true;
		overlay.innerHTML =
			'<div class="zzSheet">' +
			'<div class="zzSheetHeader"><h2>Paused</h2><button class="zzClose" data-close>×</button></div>' +
			'<button class="zzSheetBtn" data-action="resume">Resume</button>' +
			'<button class="zzSheetBtn" data-action="restart">Reset Board</button>' +
			'<button class="zzSheetBtn" data-action="board">Board</button>' +
			'<button class="zzSheetBtn" data-action="queue">Queue</button>' +
			'<button class="zzSheetBtn" data-action="settings">Settings</button>' +
			'<button class="zzSheetBtn zzSheetBtn--danger" data-action="exit">Exit to menu</button>' +
			'</div>';
		document.body.appendChild(overlay);
		overlay.querySelector('[data-close]').addEventListener('click', closePause);
		overlay.querySelector('[data-action="resume"]').addEventListener('click', closePause);
		overlay.querySelector('[data-action="restart"]').addEventListener('click', () => {
			closePause();
			if (typeof restart === 'function') restart();
		});
		overlay
			.querySelector('[data-action="board"]')
			.addEventListener('click', () => openSubSheet('zzBoardSheet', 'zzPauseMenu'));
		overlay
			.querySelector('[data-action="queue"]')
			.addEventListener('click', () => openQueueSheet('zzPauseMenu'));
		overlay
			.querySelector('[data-action="settings"]')
			.addEventListener('click', () => openSubSheet('zzSettingsSheet', 'zzPauseMenu'));
		overlay.querySelector('[data-action="exit"]').addEventListener('click', () => {
			location.href = 'index.html?mobile=1&menu=1';
		});
	}

	// ---------------------------------------------------------------------
	// Portrait gesture pads
	// ---------------------------------------------------------------------

	function buildPortraitControls() {
		const wrap = document.createElement('div');
		wrap.id = 'zzPortraitControls';
		wrap.innerHTML =
			'<div class="zzPad" id="zzLeftPad" data-hint="↶  ↷\n⤒\nTAP HOLD"></div>' +
			'<div class="zzPad" id="zzRightPad" data-hint="←  →\n↓\nTAP DROP"></div>';
		document.body.appendChild(wrap);
		setupPad($('zzLeftPad'), config.portrait.left, 'left');
		setupPad($('zzRightPad'), config.portrait.right, 'right');
		applyPortraitSplit();
		setTimeout(() => wrap.classList.add('zz-hints-hidden'), 4500);
	}

	function buildPortraitButtons() {
		const wrap = document.createElement('div');
		wrap.id = 'zzPortraitButtons';
		wrap.innerHTML =
			'<div class="zzCluster" id="zzPortraitLeftCluster"></div>' +
			'<div class="zzCluster" id="zzPortraitRightCluster"></div>';
		document.body.appendChild(wrap);
		rebuildPortraitButtons();
	}

	function rebuildPortraitButtons() {
		const left = $('zzPortraitLeftCluster');
		const right = $('zzPortraitRightCluster');
		if (!left || !right) return;
		left.innerHTML = '';
		right.innerHTML = '';
		for (const button of config.portrait.buttons) {
			const slot = portraitSlot(button.slot);
			if (!slot) continue;
			const element = createActionButton(button, false);
			element.classList.toggle('zzBtn--wide', !!slot.span);
			element.style.gridColumn = slot.span ? '1 / span 2' : String(slot.col);
			element.style.gridRow = String(slot.row);
			(slot.cluster === 'left' ? left : right).appendChild(element);
		}
	}

	function applyPortraitSplit() {
		const left = $('zzLeftPad');
		const right = $('zzRightPad');
		if (!left || !right) return;
		const split = Math.min(0.7, Math.max(0.3, Number(config.portrait.split) || 0.5));
		left.style.flex = '0 0 ' + split * 100 + '%';
		right.style.flex = '1 1 auto';
	}

	function setupPad(element, padConfig, side) {
		if (!element) return;
		let pointerId = null;
		let startX = 0;
		let startY = 0;
		let startTime = 0;
		let moved = false;
		let mode = null;
		let heldAction = null;
		let longPressTimer = null;
		let gestureFired = false;

		function clearLongPress() {
			if (longPressTimer) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
		}

		function releaseHeld() {
			if (heldAction) {
				window.ZZInput?.release(heldAction);
				heldAction = null;
			}
		}

		function reset() {
			clearLongPress();
			releaseHeld();
			pointerId = null;
			moved = false;
			mode = null;
			gestureFired = false;
			element.classList.remove('zz-touching');
		}

		element.addEventListener('pointerdown', (event) => {
			if (paused || pointerId !== null) return;
			pointerId = event.pointerId;
			try {
				element.setPointerCapture(pointerId);
			} catch (error) {
				// Pointer capture is best-effort.
			}
			startX = event.clientX;
			startY = event.clientY;
			startTime = performance.now();
			moved = false;
			mode = null;
			gestureFired = false;
			element.classList.add('zz-touching');
			if (padConfig.longPress) {
				longPressTimer = setTimeout(() => {
					if (!moved && !paused) {
						window.ZZInput?.tap(padConfig.longPress);
						gestureFired = true;
					}
				}, config.portrait.thresholds.longPress);
			}
			event.preventDefault();
		});

		element.addEventListener('pointermove', (event) => {
			if (event.pointerId !== pointerId || paused) return;
			const dx = event.clientX - startX;
			const dy = event.clientY - startY;
			const adx = Math.abs(dx);
			const ady = Math.abs(dy);
			const thresholds = config.portrait.thresholds;

			if (!moved && Math.max(adx, ady) > thresholds.deadZone) {
				moved = true;
				clearLongPress();
				mode = adx >= ady ? 'horizontal' : 'vertical';
			}
			if (!moved) return;

			if (mode === 'horizontal') {
				if (padConfig.dragHorizontal === 'MOVE') {
					const direction = dx < 0 ? 'L' : 'R';
					if (heldAction !== direction) {
						releaseHeld();
						heldAction = direction;
						window.ZZInput?.press(direction);
					}
				} else if (!gestureFired) {
					const action = dx < 0 ? padConfig.swipeLeft : padConfig.swipeRight;
					if (action && adx >= thresholds.swipe) {
						window.ZZInput?.tap(action);
						gestureFired = true;
					}
				}
			} else if (mode === 'vertical') {
				if (padConfig.dragDown === 'SD') {
					if (dy > thresholds.deadZone) {
						if (heldAction !== 'SD') {
							releaseHeld();
							heldAction = 'SD';
							window.ZZInput?.press('SD');
						}
					} else if (heldAction === 'SD') {
						releaseHeld();
					}
				} else if (!gestureFired) {
					const action = dy < 0 ? padConfig.swipeUp : padConfig.swipeDown;
					if (action && ady >= thresholds.swipe) {
						window.ZZInput?.tap(action);
						gestureFired = true;
					}
				}
			}
			event.preventDefault();
		});

		function finish(event, cancelled) {
			if (event.pointerId !== pointerId) return;
			const dx = event.clientX - startX;
			const dy = event.clientY - startY;
			const adx = Math.abs(dx);
			const ady = Math.abs(dy);
			const duration = performance.now() - startTime;
			const thresholds = config.portrait.thresholds;

			if (!cancelled && !gestureFired) {
				const maxDistance = Math.max(adx, ady);
				const isTap =
					duration <= thresholds.tapMax && maxDistance < thresholds.swipe && !heldAction;
				if (isTap) {
					if (padConfig.tap) window.ZZInput?.tap(padConfig.tap);
				} else if (moved && !heldAction) {
					if (mode === 'horizontal' && padConfig.dragHorizontal !== 'MOVE') {
						const action = dx < 0 ? padConfig.swipeLeft : padConfig.swipeRight;
						if (action && adx >= thresholds.swipe) window.ZZInput?.tap(action);
					} else if (mode === 'vertical' && padConfig.dragDown !== 'SD') {
						const action = dy < 0 ? padConfig.swipeUp : padConfig.swipeDown;
						if (action && ady >= thresholds.swipe) window.ZZInput?.tap(action);
					}
				}
			}
			reset();
			event.preventDefault();
		}

		element.addEventListener('pointerup', (event) => finish(event, false));
		element.addEventListener('pointercancel', (event) => finish(event, true));
	}

	// ---------------------------------------------------------------------
	// Landscape buttons
	// ---------------------------------------------------------------------

	function buildLandscapeControls() {
		const wrap = document.createElement('div');
		wrap.id = 'zzLandscapeControls';
		document.body.appendChild(wrap);
		applyLandscapeVars();
	}

	function applyLandscapeVars() {
		root.style.setProperty('--zz-btn-size', config.landscape.size + 'px');
		root.style.setProperty('--zz-btn-opacity', (config.landscape.opacity / 100).toFixed(2));
		updateControlsHeight();
		rebuildLandscapeButtons();
		requestAnimationFrame(resizeBoard);
	}

	function landscapePositionBounds() {
		const size = Math.min(96, Math.max(44, Number(config.landscape.size) || 64));
		const halfX = ((size / 2 + 4) / Math.max(1, window.innerWidth)) * 100;
		const halfY = ((size / 2 + 4) / Math.max(1, window.innerHeight)) * 100;
		return {
			minX: Math.min(50, halfX),
			maxX: Math.max(50, 100 - halfX),
			minY: Math.min(50, halfY),
			maxY: Math.max(50, 100 - halfY),
		};
	}

	function clampLandscapePosition(x, y) {
		const bounds = landscapePositionBounds();
		const nextX = Number(x);
		const nextY = Number(y);
		return {
			x: Math.min(bounds.maxX, Math.max(bounds.minX, Number.isFinite(nextX) ? nextX : 50)),
			y: Math.min(bounds.maxY, Math.max(bounds.minY, Number.isFinite(nextY) ? nextY : 50)),
		};
	}

	function rebuildLandscapeButtons() {
		const wrap = $('zzLandscapeControls');
		if (!wrap) return;
		wrap.innerHTML = '';
		for (const button of config.landscape.buttons) {
			const element = createActionButton(button, true);
			const position = clampLandscapePosition(button.x, button.y);
			element.style.left = position.x + '%';
			element.style.top = position.y + '%';
			wrap.appendChild(element);
		}
	}

	function pressHeld(action) {
		const count = heldRefs.get(action) || 0;
		heldRefs.set(action, count + 1);
		if (count === 0) window.ZZInput?.press(action);
	}

	function releaseHeld(action) {
		const count = heldRefs.get(action) || 0;
		if (count <= 1) {
			heldRefs.delete(action);
			if (count === 1) window.ZZInput?.release(action);
		} else {
			heldRefs.set(action, count - 1);
		}
	}

	function buttonElementAt(x, y) {
		if (typeof document.elementsFromPoint !== 'function') return null;
		const stack = document.elementsFromPoint(x, y);
		for (const item of stack) {
			const element = item.closest && item.closest('.zzBtn');
			if (element && buttonByElement.has(element)) return element;
		}
		return null;
	}

	function activateSlideButton(session, element, button) {
		if (!button.action) return;
		session.actions.add(button.action);
		session.elements.add(element);
		element.classList.add('zz-active');
		if (button.hold) {
			// A hold action stays pressed for the whole slide session. Sliding
			// back onto it should not release and re-press it.
			if (!session.held.has(button.action)) {
				session.held.add(button.action);
				pressHeld(button.action);
			}
		} else {
			// Tap actions fire every time the finger enters the button, even
			// if the same button was already used earlier in this slide.
			window.ZZInput?.tap(button.action);
		}
		haptic();
	}

	function endButtonSession(event) {
		const session = buttonSessions.get(event.pointerId);
		if (!session) return;
		buttonSessions.delete(event.pointerId);
		for (const element of session.elements) element.classList.remove('zz-active');
		for (const action of session.held) releaseHeld(action);
	}

	function clearButtonSessions() {
		for (const session of buttonSessions.values()) {
			for (const element of session.elements) element.classList.remove('zz-active');
			for (const action of session.held) releaseHeld(action);
		}
		buttonSessions.clear();
	}

	window.addEventListener('pointerup', endButtonSession, true);
	window.addEventListener('pointercancel', endButtonSession, true);

	function createActionButton(button, free) {
		const element = document.createElement('button');
		element.type = 'button';
		element.className = 'zzBtn' + (free ? ' zzBtn--free' : '');
		element.dataset.action = button.action;
		element.innerHTML =
			'<svg aria-hidden="true"><use href="./assets/icons/dark.svg#' + button.icon + '"></use></svg>';
		buttonByElement.set(element, button);
		element.addEventListener('pointerdown', (event) => {
			event.preventDefault();
			if (paused) return;
			try {
				element.setPointerCapture(event.pointerId);
			} catch (error) {
				// Pointer capture is best-effort.
			}
			if (config.buttons.slide) {
				const session = {
					pointerId: event.pointerId,
					actions: new Set(),
					held: new Set(),
					elements: new Set(),
					lastElement: element,
				};
				buttonSessions.set(event.pointerId, session);
				activateSlideButton(session, element, button);
				return;
			}
			element.classList.add('zz-active');
			if (button.hold) pressHeld(button.action);
			else window.ZZInput?.tap(button.action);
			haptic();
		});
		element.addEventListener('pointermove', (event) => {
			const session = buttonSessions.get(event.pointerId);
			if (!session) return;
			const target = buttonElementAt(event.clientX, event.clientY);
			const targetButton = target && buttonByElement.get(target);
			if (!targetButton) {
				session.lastElement = null;
				return;
			}
			if (target === session.lastElement) return;
			session.lastElement = target;
			activateSlideButton(session, target, targetButton);
		});
		const release = (event) => {
			if (buttonSessions.has(event.pointerId)) {
				endButtonSession(event);
				return;
			}
			if (config.buttons.slide) return;
			element.classList.remove('zz-active');
			if (button.hold) releaseHeld(button.action);
		};
		element.addEventListener('pointerup', release);
		element.addEventListener('pointercancel', release);
		element.addEventListener('pointerleave', (event) => {
			if (!config.buttons.slide) release(event);
		});
		return element;
	}

	function haptic() {
		if (config.landscape.haptics && navigator.vibrate) {
			try {
				navigator.vibrate(8);
			} catch (error) {
				// Vibration is optional.
			}
		}
	}

	// ---------------------------------------------------------------------
	// Settings
	// ---------------------------------------------------------------------

	function buildSettings() {
		const overlay = document.createElement('div');
		overlay.id = 'zzSettingsSheet';
		overlay.className = 'zzOverlay';
		overlay.hidden = true;
		overlay.innerHTML =
			'<div class="zzSheet">' +
			'<div class="zzSheetHeader"><h2>Settings</h2><button class="zzClose" data-close>×</button></div>' +
			'<div class="zzTabs">' +
			'<button class="zzTab zz-active" data-tab="handling">Handling</button>' +
			'<button class="zzTab" data-tab="portrait">Portrait</button>' +
			'<button class="zzTab" data-tab="landscape">Landscape</button>' +
			'<button class="zzTab" data-tab="app">App</button>' +
			'</div>' +
			'<div class="zzTabPanel zz-active" data-panel="handling">' +
			'<div class="zzSheetRow"><label>DAS</label><input type="range" id="zzDas" min="0" max="750" step="1"><input type="number" class="zzNum" id="zzDasNum" min="0" max="750" step="1" inputmode="numeric"></div>' +
			'<div class="zzSheetRow"><label>ARR</label><input type="range" id="zzArr" min="0" max="500" step="1"><input type="number" class="zzNum" id="zzArrNum" min="0" max="500" step="1" inputmode="numeric"></div>' +
			'<div class="zzSheetRow"><label>SDR</label><input type="range" id="zzSdr" min="0" max="250" step="1"><input type="number" class="zzNum" id="zzSdrNum" min="0" max="250" step="1" inputmode="numeric"></div>' +
			'<div class="zzSheetRow"><label>Slide across buttons</label><input type="checkbox" id="zzButtonSlide"></div>' +
			'<p class="zzHint">DAS is the delay before auto-repeat, ARR is the repeat rate, SDR is the soft-drop rate. With slide enabled, hold a button and move onto another to press it without releasing the first; lift your finger to release all.</p>' +
			'</div>' +
			'<div class="zzTabPanel" data-panel="portrait">' +
			'<div class="zzSheetRow"><label>Input mode</label><select id="zzPortraitInputMode"><option value="gesture">Gestures</option><option value="buttons">Buttons</option></select></div>' +
			'<div class="zzSheetRow"><label>Button size</label><input type="range" id="zzPortraitSize" min="44" max="96" step="1"><input type="number" class="zzNum" id="zzPortraitSizeNum" min="44" max="96" step="1" inputmode="numeric"></div>' +
			'<div class="zzSheetRow"><label>Left shape</label><select id="zzPortraitLeftShape"><option value="wide">Wide / pair / wide</option><option value="grid">2 × 2 grid</option></select></div>' +
			'<div class="zzSheetRow"><label>Right shape</label><select id="zzPortraitRightShape"><option value="wide">Wide / pair / wide</option><option value="grid">2 × 2 grid</option></select></div>' +
			'<p class="zzHint">Both clusters use the 3-row wide shape by default. Switch either side to a 2 × 2 grid; use Edit layout to assign actions. The button size is capped automatically so both clusters stay on screen.</p>' +
			'<div class="zzMapGrid"><div class="zzMapCard" id="zzLeftMap"></div><div class="zzMapCard" id="zzRightMap"></div></div>' +
			'<div class="zzSheetRow"><label>Swipe distance</label><input type="range" id="zzSwipe" min="12" max="60" step="1"><input type="number" class="zzNum" id="zzSwipeNum" min="12" max="60" step="1" inputmode="numeric"></div>' +
			'<div class="zzSheetRow"><label>Tap max</label><input type="range" id="zzTapMax" min="80" max="400" step="1"><input type="number" class="zzNum" id="zzTapMaxNum" min="80" max="400" step="1" inputmode="numeric"></div>' +
			'<div class="zzSheetRow"><label>Long press</label><input type="range" id="zzLongPress" min="150" max="600" step="1"><input type="number" class="zzNum" id="zzLongPressNum" min="150" max="600" step="1" inputmode="numeric"></div>' +
			'<div class="zzSheetRow"><label>Dead zone</label><input type="range" id="zzDeadZone" min="2" max="24" step="1"><input type="number" class="zzNum" id="zzDeadZoneNum" min="2" max="24" step="1" inputmode="numeric"></div>' +
			'<div class="zzSheetRow"><label>Pad split</label><input type="range" id="zzPadSplit" min="30" max="70" step="1"><input type="number" class="zzNum" id="zzPadSplitNum" min="30" max="70" step="1" inputmode="numeric"></div>' +
			'<button class="zzSheetBtn" id="zzEditPortraitLayout">Edit layout (buttons)</button>' +
			'</div>' +
			'<div class="zzTabPanel" data-panel="landscape">' +
			'<div class="zzSheetRow"><label>Input mode</label><select id="zzLandscapeInputMode"><option value="buttons">Buttons</option><option value="gesture">Gestures</option></select></div>' +
			'<div class="zzSheetRow"><label>Preset</label><select id="zzLandscapePreset"><option value="techmino">Techmino</option><option value="left-handed">Left-handed</option><option value="custom">Custom</option></select></div>' +
			'<div class="zzSheetRow"><label>Button size</label><input type="range" id="zzBtnSize" min="44" max="96" step="1"><input type="number" class="zzNum" id="zzBtnSizeNum" min="44" max="96" step="1" inputmode="numeric"></div>' +
			'<div class="zzSheetRow"><label>Opacity</label><input type="range" id="zzBtnOpacity" min="20" max="100" step="1"><input type="number" class="zzNum" id="zzBtnOpacityNum" min="20" max="100" step="1" inputmode="numeric"></div>' +
			'<div class="zzSheetRow"><label>Haptics</label><input type="checkbox" id="zzHaptics"></div>' +
			'<button class="zzSheetBtn" id="zzEditLayout">Edit layout (buttons)</button>' +
			'</div>' +
			'<div class="zzTabPanel" data-panel="app">' +
			'<button class="zzSheetBtn" id="zzInstallBtn" hidden>Install app</button>' +
			'<button class="zzSheetBtn" id="zzFullscreenBtn">Enter fullscreen</button>' +
			'<button class="zzSheetBtn" id="zzClearCache">Clear cache and update</button>' +
			'<div class="zzSheetRow"><label>Pause button</label><select id="zzPauseCorner"><option value="top-right">Top right</option><option value="top-left">Top left</option><option value="bottom-right">Bottom right</option><option value="bottom-left">Bottom left</option></select></div>' +
			'<div class="zzSheetRow"><label>Show hold</label><input type="checkbox" id="zzShowHold"></div>' +
			'<div class="zzSheetRow"><label>Show next</label><input type="checkbox" id="zzShowNext"></div>' +
			'<div class="zzSheetRow"><label>Show stats</label><input type="checkbox" id="zzShowStats"></div>' +
			'<div class="zzSheetRow"><label>Extra stat</label><select id="zzExtraStat"></select></div>' +
			'<button class="zzSheetBtn zzSheetBtn--danger" id="zzResetSettings">Reset mobile settings</button>' +
			'<p class="zzHint">ZZTetris mobile · shell v' +
			SHELL_VERSION +
			' · gesture and button controls</p>' +
			'</div>' +
			'</div>';
		document.body.appendChild(overlay);

		overlay.querySelector('[data-close]').addEventListener('click', () => closeSubSheet('zzSettingsSheet'));

		const tabs = overlay.querySelectorAll('.zzTab');
		const panels = overlay.querySelectorAll('.zzTabPanel');
		for (const tab of tabs) {
			tab.addEventListener('click', () => {
				for (const other of tabs) other.classList.remove('zz-active');
				for (const panel of panels) panel.classList.remove('zz-active');
				tab.classList.add('zz-active');
				const panel = overlay.querySelector('[data-panel="' + tab.dataset.tab + '"]');
				if (panel) panel.classList.add('zz-active');
			});
		}

		setupHandling();
		buildMapCard($('zzLeftMap'), config.portrait.left, 'left');
		buildMapCard($('zzRightMap'), config.portrait.right, 'right');
		setupThresholds();
		setupPortraitLayout();
		setupPortraitSize();
		setupPortraitShapes();
		setupPortraitInputMode();
		setupLandscape();
		setupLandscapeInputMode();
		setupLayoutEditor();
		setupDisplay();
		setupPauseCorner();
		setupApp();
	}

	function setupHandling() {
		const das = $('zzDas');
		const arr = $('zzArr');
		const sdr = $('zzSdr');
		const dasNum = $('zzDasNum');
		const arrNum = $('zzArrNum');
		const sdrNum = $('zzSdrNum');
		if (!das || !arr || !sdr || !dasNum || !arrNum || !sdrNum) return;

		function sync() {
			das.value = DAS;
			arr.value = ARR;
			sdr.value = SDR;
			dasNum.value = DAS;
			arrNum.value = ARR;
			sdrNum.value = SDR;
		}

		function updateFromSlider() {
			DAS = parseInt(das.value, 10);
			ARR = parseInt(arr.value, 10);
			SDR = parseInt(sdr.value, 10);
			dasNum.value = DAS;
			arrNum.value = ARR;
			sdrNum.value = SDR;
			saveHandling();
		}

		function updateFromNumber() {
			const dasValue = parseInt(dasNum.value, 10);
			const arrValue = parseInt(arrNum.value, 10);
			const sdrValue = parseInt(sdrNum.value, 10);
			if (Number.isFinite(dasValue)) DAS = Math.min(750, Math.max(0, dasValue));
			if (Number.isFinite(arrValue)) ARR = Math.min(500, Math.max(0, arrValue));
			if (Number.isFinite(sdrValue)) SDR = Math.min(250, Math.max(0, sdrValue));
			das.value = DAS;
			arr.value = ARR;
			sdr.value = SDR;
			saveHandling();
		}

		function clampNumbers() {
			dasNum.value = DAS;
			arrNum.value = ARR;
			sdrNum.value = SDR;
		}

		das.addEventListener('input', updateFromSlider);
		arr.addEventListener('input', updateFromSlider);
		sdr.addEventListener('input', updateFromSlider);
		dasNum.addEventListener('input', updateFromNumber);
		arrNum.addEventListener('input', updateFromNumber);
		sdrNum.addEventListener('input', updateFromNumber);
		dasNum.addEventListener('change', clampNumbers);
		arrNum.addEventListener('change', clampNumbers);
		sdrNum.addEventListener('change', clampNumbers);

		const slide = $('zzButtonSlide');
		if (slide) {
			slide.checked = config.buttons.slide !== false;
			slide.addEventListener('change', () => {
				config.buttons.slide = slide.checked;
				saveConfig();
			});
		}
		sync();
	}

	function saveHandling() {
		let values;
		try {
			values = JSON.parse(LS.config || '[]');
		} catch (error) {
			values = [];
		}
		if (!Array.isArray(values)) values = [];
		values[11] = String(DAS);
		values[12] = String(ARR);
		values[13] = String(SDR);
		LS.config = JSON.stringify(values);
		LS.version = '2023-05-02a';
	}

	function buildMapCard(container, padConfig, side) {
		if (!container) return;
		const rows = [
			['tap', 'Tap'],
			['longPress', 'Long press'],
			['swipeLeft', 'Swipe left'],
			['swipeRight', 'Swipe right'],
			['swipeUp', 'Swipe up'],
			['swipeDown', 'Swipe down'],
		];
		if (side === 'right') {
			rows.push(['dragHorizontal', 'Horizontal drag']);
			rows.push(['dragDown', 'Vertical drag']);
		}
		container.innerHTML = '<h4>' + (side === 'left' ? 'Left pad' : 'Right pad') + '</h4>';
		for (const [key, label] of rows) {
			const row = document.createElement('div');
			row.className = 'zzMapRow';
			const name = document.createElement('label');
			name.textContent = label;
			const select = document.createElement('select');
			const options =
				key === 'dragHorizontal'
					? [
							{ value: '', label: 'None' },
							{ value: 'MOVE', label: 'Move left/right' },
					  ]
					: key === 'dragDown'
					? [
							{ value: '', label: 'None' },
							{ value: 'SD', label: 'Soft drop' },
					  ]
					: ACTIONS;
			for (const option of options) {
				const item = document.createElement('option');
				item.value = option.value;
				item.textContent = option.label;
				select.appendChild(item);
			}
			select.value = padConfig[key] || '';
			select.addEventListener('change', () => {
				padConfig[key] = select.value || null;
				saveConfig();
			});
			row.appendChild(name);
			row.appendChild(select);
			container.appendChild(row);
		}
	}

	function setupThresholds() {
		const thresholds = config.portrait.thresholds;
		const swipe = $('zzSwipe');
		const tapMax = $('zzTapMax');
		const longPress = $('zzLongPress');
		const deadZone = $('zzDeadZone');
		const swipeNum = $('zzSwipeNum');
		const tapMaxNum = $('zzTapMaxNum');
		const longPressNum = $('zzLongPressNum');
		const deadZoneNum = $('zzDeadZoneNum');
		if (!swipe || !tapMax || !longPress || !deadZone) return;

		function sync() {
			swipe.value = thresholds.swipe;
			tapMax.value = thresholds.tapMax;
			longPress.value = thresholds.longPress;
			deadZone.value = thresholds.deadZone;
			swipeNum.value = thresholds.swipe;
			tapMaxNum.value = thresholds.tapMax;
			longPressNum.value = thresholds.longPress;
			deadZoneNum.value = thresholds.deadZone;
		}

		function updateFromSlider() {
			thresholds.swipe = parseInt(swipe.value, 10);
			thresholds.tapMax = parseInt(tapMax.value, 10);
			thresholds.longPress = parseInt(longPress.value, 10);
			thresholds.deadZone = parseInt(deadZone.value, 10);
			swipeNum.value = thresholds.swipe;
			tapMaxNum.value = thresholds.tapMax;
			longPressNum.value = thresholds.longPress;
			deadZoneNum.value = thresholds.deadZone;
			saveConfig();
		}

		function updateFromNumber() {
			const swipeValue = parseInt(swipeNum.value, 10);
			const tapMaxValue = parseInt(tapMaxNum.value, 10);
			const longPressValue = parseInt(longPressNum.value, 10);
			const deadZoneValue = parseInt(deadZoneNum.value, 10);
			if (Number.isFinite(swipeValue)) thresholds.swipe = Math.min(60, Math.max(12, swipeValue));
			if (Number.isFinite(tapMaxValue)) thresholds.tapMax = Math.min(400, Math.max(80, tapMaxValue));
			if (Number.isFinite(longPressValue))
				thresholds.longPress = Math.min(600, Math.max(150, longPressValue));
			if (Number.isFinite(deadZoneValue))
				thresholds.deadZone = Math.min(24, Math.max(2, deadZoneValue));
			swipe.value = thresholds.swipe;
			tapMax.value = thresholds.tapMax;
			longPress.value = thresholds.longPress;
			deadZone.value = thresholds.deadZone;
			saveConfig();
		}

		function clampNumbers() {
			swipeNum.value = thresholds.swipe;
			tapMaxNum.value = thresholds.tapMax;
			longPressNum.value = thresholds.longPress;
			deadZoneNum.value = thresholds.deadZone;
		}

		swipe.addEventListener('input', updateFromSlider);
		tapMax.addEventListener('input', updateFromSlider);
		longPress.addEventListener('input', updateFromSlider);
		deadZone.addEventListener('input', updateFromSlider);
		swipeNum.addEventListener('input', updateFromNumber);
		tapMaxNum.addEventListener('input', updateFromNumber);
		longPressNum.addEventListener('input', updateFromNumber);
		deadZoneNum.addEventListener('input', updateFromNumber);
		swipeNum.addEventListener('change', clampNumbers);
		tapMaxNum.addEventListener('change', clampNumbers);
		longPressNum.addEventListener('change', clampNumbers);
		deadZoneNum.addEventListener('change', clampNumbers);
		sync();
	}

	function setupPortraitLayout() {
		const split = $('zzPadSplit');
		const splitNum = $('zzPadSplitNum');
		if (!split || !splitNum) return;
		const initial = Math.round((config.portrait.split || 0.5) * 100);
		split.value = initial;
		splitNum.value = initial;

		function updateFromSlider() {
			const value = parseInt(split.value, 10);
			config.portrait.split = value / 100;
			splitNum.value = value;
			applyPortraitSplit();
			saveConfig();
		}

		function updateFromNumber() {
			const value = parseInt(splitNum.value, 10);
			if (!Number.isFinite(value)) return;
			const clamped = Math.min(70, Math.max(30, value));
			config.portrait.split = clamped / 100;
			split.value = clamped;
			applyPortraitSplit();
			saveConfig();
		}

		split.addEventListener('input', updateFromSlider);
		splitNum.addEventListener('input', updateFromNumber);
		splitNum.addEventListener('change', () => {
			splitNum.value = Math.round((config.portrait.split || 0.5) * 100);
		});
	}

	function setupPortraitSize() {
		const size = $('zzPortraitSize');
		const sizeNum = $('zzPortraitSizeNum');
		if (!size || !sizeNum) return;

		function sync() {
			size.value = config.portrait.size;
			sizeNum.value = config.portrait.size;
		}

		function apply(value) {
			config.portrait.size = Math.min(96, Math.max(44, value));
			size.value = config.portrait.size;
			sizeNum.value = config.portrait.size;
			saveConfig();
			updateControlsHeight();
			requestAnimationFrame(resizeBoard);
		}

		function updateFromSlider() {
			apply(parseInt(size.value, 10));
		}

		function updateFromNumber() {
			const value = parseInt(sizeNum.value, 10);
			if (Number.isFinite(value)) apply(value);
		}

		size.addEventListener('input', updateFromSlider);
		sizeNum.addEventListener('input', updateFromNumber);
		sizeNum.addEventListener('change', sync);
		sync();
	}

	function setupPortraitShapes() {
		const left = $('zzPortraitLeftShape');
		const right = $('zzPortraitRightShape');
		if (!left || !right) return;
		left.value = config.portrait.leftShape || 'wide';
		right.value = config.portrait.rightShape || 'wide';
		const apply = () => {
			config.portrait.leftShape = left.value;
			config.portrait.rightShape = right.value;
			saveConfig();
			rebuildPortraitButtons();
			updateControlsHeight();
			requestAnimationFrame(resizeBoard);
		};
		left.addEventListener('change', apply);
		right.addEventListener('change', apply);
	}

	function setupPortraitInputMode() {
		const select = $('zzPortraitInputMode');
		if (!select) return;
		select.value = config.portrait.inputMode || 'gesture';
		select.addEventListener('change', () => {
			config.portrait.inputMode = select.value;
			saveConfig();
			applyInputModes();
		});
	}

	function setupLandscape() {
		const preset = $('zzLandscapePreset');
		const size = $('zzBtnSize');
		const opacity = $('zzBtnOpacity');
		const haptics = $('zzHaptics');
		const sizeNum = $('zzBtnSizeNum');
		const opacityNum = $('zzBtnOpacityNum');
		if (!preset || !size || !opacity || !haptics) return;

		preset.value = config.landscape.preset;
		size.value = config.landscape.size;
		opacity.value = config.landscape.opacity;
		haptics.checked = config.landscape.haptics;
		sizeNum.value = config.landscape.size;
		opacityNum.value = config.landscape.opacity;

		preset.addEventListener('change', () => applyPreset(preset.value));

		function updateSizeFromSlider() {
			config.landscape.size = parseInt(size.value, 10);
			sizeNum.value = config.landscape.size;
			applyLandscapeVars();
			saveConfig();
		}

		function updateSizeFromNumber() {
			const value = parseInt(sizeNum.value, 10);
			if (!Number.isFinite(value)) return;
			config.landscape.size = Math.min(96, Math.max(44, value));
			size.value = config.landscape.size;
			applyLandscapeVars();
			saveConfig();
		}

		function updateOpacityFromSlider() {
			config.landscape.opacity = parseInt(opacity.value, 10);
			opacityNum.value = config.landscape.opacity;
			applyLandscapeVars();
			saveConfig();
		}

		function updateOpacityFromNumber() {
			const value = parseInt(opacityNum.value, 10);
			if (!Number.isFinite(value)) return;
			config.landscape.opacity = Math.min(100, Math.max(20, value));
			opacity.value = config.landscape.opacity;
			applyLandscapeVars();
			saveConfig();
		}

		size.addEventListener('input', updateSizeFromSlider);
		opacity.addEventListener('input', updateOpacityFromSlider);
		sizeNum.addEventListener('input', updateSizeFromNumber);
		opacityNum.addEventListener('input', updateOpacityFromNumber);
		sizeNum.addEventListener('change', () => {
			sizeNum.value = config.landscape.size;
		});
		opacityNum.addEventListener('change', () => {
			opacityNum.value = config.landscape.opacity;
		});
		haptics.addEventListener('change', () => {
			config.landscape.haptics = haptics.checked;
			saveConfig();
		});
	}

	function applyPreset(name) {
		config.landscape.preset = name;
		if (name === 'techmino' || name === 'left-handed') {
			config.landscape.buttons = defaultLandscapeButtons(name);
		}
		saveConfig();
		rebuildLandscapeButtons();
	}

	function setupLandscapeInputMode() {
		const select = $('zzLandscapeInputMode');
		if (!select) return;
		select.value = config.landscape.inputMode || 'buttons';
		select.addEventListener('change', () => {
			config.landscape.inputMode = select.value;
			saveConfig();
			applyInputModes();
		});
	}

	function setupLayoutEditor() {
		const landscape = $('zzEditLayout');
		if (landscape) landscape.addEventListener('click', () => openLayoutEditor('landscape'));
		const portrait = $('zzEditPortraitLayout');
		if (portrait) portrait.addEventListener('click', () => openLayoutEditor('portrait'));
	}

	let layoutMode = 'landscape';
	let layoutSelected = null;

	function layoutButtons() {
		return layoutMode === 'portrait' ? config.portrait.buttons : config.landscape.buttons;
	}

	function layoutButtonId(button) {
		return layoutMode === 'portrait' ? button.slot : button.id;
	}

	function nextFreePortraitSlot() {
		const used = new Set(config.portrait.buttons.map((button) => button.slot));
		for (const slot of PORTRAIT_SLOT_ORDER) {
			if (!used.has(slot)) return slot;
		}
		return null;
	}

	function rebuildLayoutButtons() {
		rebuildPortraitButtons();
		rebuildLandscapeButtons();
	}

	function buildLayoutEditor() {
		const overlay = document.createElement('div');
		overlay.id = 'zzLayoutEditor';
		overlay.className = 'zzOverlay zzLayoutOverlay';
		overlay.hidden = true;
		overlay.innerHTML =
			'<div class="zzLayoutBar">' +
			'<button class="zzSheetBtn" id="zzLayoutDone">Done</button>' +
			'<button class="zzSheetBtn" id="zzLayoutAdd">Add</button>' +
			'<button class="zzSheetBtn" id="zzLayoutReset">Reset</button>' +
			'</div>' +
			'<div class="zzLayoutActionBar">' +
			'<label for="zzLayoutAction">Action</label>' +
			'<select id="zzLayoutAction"></select>' +
			'<span class="zzLayoutSelection" id="zzLayoutSelection">No button selected</span>' +
			'</div>' +
			'<div id="zzLayoutCanvas"></div>' +
			'<p class="zzHint zzLayoutHint"></p>';
		document.body.appendChild(overlay);
		const actionSelect = $('zzLayoutAction');
		for (const option of ACTIONS) {
			const item = document.createElement('option');
			item.value = option.value;
			item.textContent = option.label;
			actionSelect.appendChild(item);
		}
		actionSelect.addEventListener('change', () => {
			if (!layoutSelected) return;
			layoutSelected.action = actionSelect.value;
			layoutSelected.icon = ACTION_ICONS[actionSelect.value] || 's-plus';
			layoutSelected.hold = HOLD_ACTIONS.has(actionSelect.value);
			if (layoutMode === 'landscape') {
				config.landscape.preset = 'custom';
				const preset = $('zzLandscapePreset');
				if (preset) preset.value = 'custom';
			}
			saveConfig();
			rebuildLayoutButtons();
			rebuildLayoutEditor();
		});
		$('zzLayoutDone').addEventListener('click', closeLayoutEditor);
		$('zzLayoutAdd').addEventListener('click', addLayoutButton);
		$('zzLayoutReset').addEventListener('click', resetLayout);
	}

	function openLayoutEditor(mode) {
		layoutMode = mode === 'portrait' ? 'portrait' : 'landscape';
		setPaused(true);
		hide('zzSettingsSheet');
		layoutSelected = layoutButtons()[0] || null;
		rebuildLayoutEditor();
		show('zzLayoutEditor');
	}

	function closeLayoutEditor() {
		hide('zzLayoutEditor');
		show('zzSettingsSheet');
		saveConfig();
		rebuildLayoutButtons();
	}

	function rebuildLayoutEditor() {
		const canvas = $('zzLayoutCanvas');
		const overlay = $('zzLayoutEditor');
		if (!canvas || !overlay) return;
		canvas.innerHTML = '';
		canvas.className = layoutMode === 'portrait' ? 'zzLayoutCanvas--portrait' : '';
		overlay.dataset.layoutMode = layoutMode;
		if (layoutMode === 'portrait') {
			const left = document.createElement('div');
			left.className = 'zzLayoutCluster zzLayoutCluster--left';
			const right = document.createElement('div');
			right.className = 'zzLayoutCluster zzLayoutCluster--right';
			for (const button of config.portrait.buttons) {
				const slot = portraitSlot(button.slot);
				if (!slot) continue;
				const element = makeEditorButton(button);
				element.classList.toggle('zzBtn--wide', !!slot.span);
				element.style.gridColumn = slot.span ? '1 / span 2' : String(slot.col);
				element.style.gridRow = String(slot.row);
				(slot.cluster === 'left' ? left : right).appendChild(element);
			}
			canvas.appendChild(left);
			canvas.appendChild(right);
		} else {
			for (const button of config.landscape.buttons) {
				canvas.appendChild(makeEditorButton(button));
			}
		}
		const actionSelect = $('zzLayoutAction');
		const selection = $('zzLayoutSelection');
		const add = $('zzLayoutAdd');
		const hint = overlay.querySelector('.zzLayoutHint');
		if (actionSelect) {
			actionSelect.disabled = !layoutSelected;
			actionSelect.value = layoutSelected ? layoutSelected.action : '';
		}
		if (selection) {
			selection.textContent = layoutSelected ? layoutButtonId(layoutSelected) : 'No button selected';
		}
		if (add) {
			add.disabled = layoutMode === 'portrait' && !nextFreePortraitSlot();
		}
		if (hint) {
			hint.textContent =
				layoutMode === 'portrait'
					? 'Portrait layout: tap to edit, drag one button onto another to swap slots, × to delete.'
					: 'Landscape layout: drag to move, tap to edit the action, × to delete.';
		}
	}

	function makeEditorButton(button) {
		const element = document.createElement('button');
		element.type = 'button';
		element.className =
			'zzBtn zzBtn--edit' +
			(layoutMode === 'landscape' ? ' zzBtn--free' : '') +
			(layoutSelected === button ? ' zz-selected' : '');
		element.dataset.buttonId = layoutButtonId(button);
		if (layoutMode === 'landscape') {
			const position = clampLandscapePosition(button.x, button.y);
			element.style.left = position.x + '%';
			element.style.top = position.y + '%';
		}
		element.innerHTML =
			'<svg aria-hidden="true"><use href="./assets/icons/dark.svg#' +
			button.icon +
			'"></use></svg>' +
			'<span class="zzBtnLabel">' +
			(button.action || 'NEW') +
			'</span>' +
			'<span class="zzDeleteBadge">×</span>';

		let drag = null;
		element.addEventListener('pointerdown', (event) => {
			if (event.target.closest('.zzDeleteBadge')) return;
			event.preventDefault();
			try {
				element.setPointerCapture(event.pointerId);
			} catch (error) {
				// Pointer capture is best-effort.
			}
			drag = {
				id: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				x: button.x || 50,
				y: button.y || 50,
				moved: false,
			};
		});
		element.addEventListener('pointermove', (event) => {
			if (!drag || drag.id !== event.pointerId) return;
			event.preventDefault();
			const dxPx = event.clientX - drag.startX;
			const dyPx = event.clientY - drag.startY;
			if (!drag.moved && Math.abs(dxPx) + Math.abs(dyPx) < 4) return;
			drag.moved = true;
			if (layoutMode === 'portrait') {
				element.style.transform = 'translate(' + dxPx + 'px, ' + dyPx + 'px)';
				element.classList.add('zz-dragging');
				return;
			}
			const dx = (dxPx / window.innerWidth) * 100;
			const dy = (dyPx / window.innerHeight) * 100;
			const position = clampLandscapePosition(drag.x + dx, drag.y + dy);
			button.x = position.x;
			button.y = position.y;
			element.style.left = button.x + '%';
			element.style.top = button.y + '%';
		});
		const end = (event) => {
			if (!drag || drag.id !== event.pointerId) return;
			const moved = drag.moved;
			drag = null;
			if (!moved) {
				layoutSelected = button;
				rebuildLayoutEditor();
				return;
			}
			if (layoutMode === 'landscape') {
				saveConfig();
				return;
			}
			element.classList.remove('zz-dragging');
			element.style.transform = '';
			const stack =
				typeof document.elementsFromPoint === 'function'
					? document.elementsFromPoint(event.clientX, event.clientY)
					: [];
			const target = stack
				.map((item) => item.closest && item.closest('.zzBtn--edit'))
				.find((item) => item && item !== element);
			const targetId = target && target.dataset.buttonId;
			const other = targetId
				? config.portrait.buttons.find((item) => item.slot === targetId)
				: null;
			if (other && other !== button) {
				const slot = button.slot;
				button.slot = other.slot;
				other.slot = slot;
				layoutSelected = button;
				saveConfig();
				rebuildPortraitButtons();
			}
			rebuildLayoutEditor();
		};
		element.addEventListener('pointerup', end);
		element.addEventListener('pointercancel', end);
		element.querySelector('.zzDeleteBadge').addEventListener('click', (event) => {
			event.stopPropagation();
			const buttons = layoutButtons();
			const index = buttons.indexOf(button);
			if (index < 0) return;
			if (layoutSelected === button) {
				layoutSelected = buttons[index + 1] || buttons[index - 1] || null;
			}
			buttons.splice(index, 1);
			if (layoutMode === 'landscape') config.landscape.preset = 'custom';
			saveConfig();
			rebuildLayoutEditor();
			if (layoutMode === 'portrait') rebuildPortraitButtons();
			else rebuildLandscapeButtons();
		});
		return element;
	}

	function addLayoutButton() {
		if (layoutMode === 'portrait') {
			const slot = nextFreePortraitSlot();
			if (!slot) return;
			const fallback =
				defaultPortraitButtons().find((button) => button.slot === slot) || {};
			const button = {
				slot,
				action: fallback.action || '',
				icon: fallback.icon || 's-plus',
				hold: !!fallback.hold,
			};
			config.portrait.buttons.push(button);
			layoutSelected = button;
			saveConfig();
			rebuildPortraitButtons();
			rebuildLayoutEditor();
			return;
		}
		const button = {
			id: 'CUSTOM' + Date.now(),
			x: 50,
			y: 50,
			action: '',
			icon: 's-plus',
			hold: false,
		};
		config.landscape.buttons.push(button);
		config.landscape.preset = 'custom';
		layoutSelected = button;
		saveConfig();
		rebuildLayoutEditor();
	}

	function resetLayout() {
		if (layoutMode === 'portrait') {
			config.portrait.buttons = defaultPortraitButtons();
			layoutSelected = config.portrait.buttons[0] || null;
			saveConfig();
			rebuildPortraitButtons();
			rebuildLayoutEditor();
			return;
		}
		config.landscape.buttons = defaultLandscapeButtons('techmino');
		config.landscape.preset = 'techmino';
		layoutSelected = config.landscape.buttons[0] || null;
		const preset = $('zzLandscapePreset');
		if (preset) preset.value = 'techmino';
		saveConfig();
		rebuildLayoutEditor();
		rebuildLandscapeButtons();
	}

	function setupDisplay() {
		const showHold = $('zzShowHold');
		const showNext = $('zzShowNext');
		const showStats = $('zzShowStats');
		const extraStat = $('zzExtraStat');
		if (!showHold || !showNext) return;
		showHold.checked = config.display.showHold;
		showNext.checked = config.display.showNext;
		if (showStats) showStats.checked = config.display.showStats;
		if (extraStat && window.ZZStatsConfig) {
			for (const def of window.ZZStatsConfig.STAT_DEFS) {
				const option = document.createElement('option');
				option.value = def.id;
				option.textContent = def.label;
				extraStat.appendChild(option);
			}
			extraStat.value = config.display.extraStat || 'finesse';
			extraStat.addEventListener('change', () => {
				config.display.extraStat = extraStat.value;
				saveConfig();
				updateStatsMini();
			});
		}
		showHold.addEventListener('change', () => {
			config.display.showHold = showHold.checked;
			saveConfig();
			updateHudVisibility();
		});
		showNext.addEventListener('change', () => {
			config.display.showNext = showNext.checked;
			saveConfig();
			updateHudVisibility();
		});
		if (showStats) {
			showStats.addEventListener('change', () => {
				config.display.showStats = showStats.checked;
				saveConfig();
				updateHudVisibility();
			});
		}
	}

	function setupPauseCorner() {
		const select = $('zzPauseCorner');
		if (!select) return;
		select.value = config.pauseCorner;
		select.addEventListener('change', () => {
			config.pauseCorner = select.value;
			saveConfig();
			applyPauseCorner();
		});
	}

	function setupApp() {
		const install = $('zzInstallBtn');
		const fullscreen = $('zzFullscreenBtn');
		const reset = $('zzResetSettings');
		const clear = $('zzClearCache');
		if (clear) {
			clear.addEventListener('click', async () => {
				clear.disabled = true;
				clear.textContent = 'Clearing cache…';
				await clearShellCacheAndReload();
			});
		}
		if (install) {
			install.hidden = !deferredPrompt;
			install.addEventListener('click', async () => {
				if (!deferredPrompt) return;
				deferredPrompt.prompt();
				await deferredPrompt.userChoice;
				deferredPrompt = null;
				install.hidden = true;
			});
		}
		if (fullscreen) {
			fullscreen.addEventListener('click', async () => {
				try {
					if (document.fullscreenElement) await document.exitFullscreen();
					else await document.documentElement.requestFullscreen();
				} catch (error) {
					// Fullscreen can be blocked outside a user gesture.
				}
				updateFullscreenLabel();
			});
			document.addEventListener('fullscreenchange', updateFullscreenLabel);
			updateFullscreenLabel();
		}
		if (reset) {
			reset.addEventListener('click', () => {
				localStorage.removeItem(STORAGE_KEY);
				location.reload();
			});
		}
	}

	function updateFullscreenLabel() {
		const button = $('zzFullscreenBtn');
		if (button) button.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen';
	}

	// ---------------------------------------------------------------------
	// Board, queue and mode sheets
	// ---------------------------------------------------------------------

	function buildBoardSheet() {
		const overlay = document.createElement('div');
		overlay.id = 'zzBoardSheet';
		overlay.className = 'zzOverlay';
		overlay.hidden = true;
		overlay.innerHTML =
			'<div class="zzSheet">' +
			'<div class="zzSheetHeader"><h2>Board</h2><button class="zzClose" data-close>×</button></div>' +
			'<button class="zzSheetBtn zzSheetBtn--danger" id="zzResetBoard">Reset Board</button>' +
			'<div id="zzBoardBody"></div>' +
			'</div>';
		document.body.appendChild(overlay);
		overlay.querySelector('[data-close]').addEventListener('click', () => closeSubSheet('zzBoardSheet'));
		$('zzResetBoard').addEventListener('click', () => {
			if (typeof restart === 'function') restart();
		});

		const body = $('zzBoardBody');
		const boardOptions = $('boardOptionsContent');
		if (body && boardOptions) body.appendChild(boardOptions);
		const practice = $('practiceLayers')?.closest('.nav-section');
		if (body && practice) body.appendChild(practice);
	}

	function buildQueueSheet() {
		const overlay = document.createElement('div');
		overlay.id = 'zzQueueSheet';
		overlay.className = 'zzOverlay';
		overlay.hidden = true;
		overlay.innerHTML =
			'<div class="zzSheet">' +
			'<div class="zzSheetHeader"><h2>Queue</h2><button class="zzClose" data-close>×</button></div>' +
			'<button class="zzSheetBtn" id="zzShuffleQueue">Shuffle Queue</button>' +
			'<button class="zzSheetBtn" id="zzShuffleQueueHold">Shuffle Queue + Hold</button>' +
			'<button class="zzSheetBtn" id="zzResetQueue">Reset Queue</button>' +
			'<button class="zzSheetBtn" id="zzResetQueueHold">Reset Queue + Hold</button>' +
			'<div class="zzQueueEditor">' +
			'<label for="zzQueueInput">Queue sequence</label>' +
			'<input id="zzQueueInput" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text">' +
			'<button class="zzSheetBtn" id="zzApplyQueue">Apply Queue</button>' +
			'<div class="zzHint" id="zzQueueStatus"></div>' +
			'</div>' +
			'</div>';
		document.body.appendChild(overlay);
		overlay.querySelector('[data-close]').addEventListener('click', () => closeSubSheet('zzQueueSheet'));
		$('zzShuffleQueue').addEventListener('click', () => {
			if (typeof shuffleQueue === 'function') shuffleQueue();
			refreshQueueEditor(true);
		});
		$('zzShuffleQueueHold').addEventListener('click', () => {
			if (typeof shuffleQueuePlusHold === 'function') shuffleQueuePlusHold();
			refreshQueueEditor(true);
		});
		$('zzResetQueue').addEventListener('click', () => {
			window.ZZStats?.resetQueue();
			refreshQueueEditor(true);
		});
		$('zzResetQueueHold').addEventListener('click', () => {
			window.ZZStats?.resetQueueHold();
			refreshQueueEditor(true);
		});
		$('zzApplyQueue').addEventListener('click', applyQueueString);
		$('zzQueueInput').addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				applyQueueString();
			}
		});
	}

	function openQueueSheet(parent) {
		refreshQueueEditor(true);
		openSubSheet('zzQueueSheet', parent);
	}

	function refreshQueueEditor(clearStatus) {
		const input = $('zzQueueInput');
		if (input) input.value = typeof queue !== 'undefined' ? queue.join('') : '';
		if (clearStatus) {
			const status = $('zzQueueStatus');
			if (status) status.textContent = '';
		}
	}

	function applyQueueString() {
		const input = $('zzQueueInput');
		const status = $('zzQueueStatus');
		if (!input) return;
		const raw = input.value.toUpperCase().replace(/[^SZLJIOT|]/g, '');
		if (!/[SZLJIOT]/.test(raw)) {
			if (status) status.textContent = 'Enter at least one piece (S, Z, L, J, I, O, T).';
			return;
		}
		queue = raw.split('');
		// updateQueue() draws seven slots; pad a short custom queue so it does
		// not try to draw missing pieces. newPiece() tops up the bag later.
		while (queue.length < 7) {
			queue.push('ZLOSIJT'[Math.floor(Math.random() * 7)]);
		}
		if (typeof updateQueue === 'function') updateQueue();
		if (typeof updateHistory === 'function') updateHistory();
		refreshQueueEditor(false);
		if (status) status.textContent = 'Queue applied.';
	}

	function buildModeMenu() {
		const overlay = document.createElement('div');
		overlay.id = 'zzModeMenu';
		overlay.className = 'zzOverlay';
		overlay.hidden = true;
		const current = params.get('mode') || 'practice';
		const modes = [
			['practice', 'Practice'],
			['cheese', 'Cheese'],
			['4w', '4W'],
			['4w4res', '4W 4Res'],
			['4w5res', '4W 5Res'],
			['4w6res', '4W 6Res'],
			['3w', '3W'],
			['grav', 'Grav'],
			['pc', 'PC'],
		];
		overlay.innerHTML =
			'<div class="zzSheet">' +
			'<div class="zzSheetHeader"><h2>ZZTetris</h2><button class="zzClose" data-close>×</button></div>' +
			'<div class="zzModeGrid">' +
			modes
				.map(
					([id, label]) =>
						'<a class="zzSheetBtn' +
						(id === current ? ' zzSheetBtn--active' : '') +
						'" href="index.html?mobile=1&mode=' +
						id +
						'">' +
						label +
						'</a>'
				)
				.join('') +
			'</div>' +
			'<button class="zzSheetBtn" data-action="settings">Settings</button>' +
			'<p class="zzHint">Choose a mode. The game is paused while this menu is open.</p>' +
			'</div>';
		document.body.appendChild(overlay);
		overlay.querySelector('[data-close]').addEventListener('click', () => {
			hide('zzModeMenu');
			setPaused(false);
		});
		overlay
			.querySelector('[data-action="settings"]')
			.addEventListener('click', () => openSubSheet('zzSettingsSheet', 'zzModeMenu'));
	}

	function openModeMenu() {
		setPaused(true);
		show('zzModeMenu');
	}

	// ---------------------------------------------------------------------
	// Board drawing
	// ---------------------------------------------------------------------

	function setupBoardDrawing() {
		const canvas = $('b');
		if (!canvas) return;

		// The desktop mouse handlers assume the unscaled canvas and its 18px
		// padding. Replace them with pointer handlers that use the displayed
		// cell size so drawing works on a scaled mobile board.
		canvas.onmousedown = null;
		canvas.onmousemove = null;

		let drawing = false;
		let drawMode = false;

		function cellFromEvent(event) {
			const rect = canvas.getBoundingClientRect();
			const x = Math.floor((event.clientX - rect.left) / (rect.width / 10));
			const y = Math.floor((event.clientY - rect.top) / (rect.height / 22));
			return { x, y };
		}

		function applyCell(x, y, first) {
			if (x < 0 || x > 9 || y < 0 || y > 21) return;
			const row = boardSize[1] + y - hiddenRows - 2;
			if (row < 0 || row >= board.length) return;
			if (first) drawMode = board[row][x].t != 1;
			board[row][x] = drawMode ? { t: 1, c: paintbucketColor() } : { t: 0, c: '' };
			updateGhost();
		}

		canvas.addEventListener('pointerdown', (event) => {
			if (paused) return;
			event.preventDefault();
			try {
				canvas.setPointerCapture(event.pointerId);
			} catch (error) {
				// Pointer capture is best-effort.
			}
			drawing = true;
			const { x, y } = cellFromEvent(event);
			applyCell(x, y, true);
		});

		canvas.addEventListener('pointermove', (event) => {
			if (!drawing) return;
			event.preventDefault();
			const { x, y } = cellFromEvent(event);
			applyCell(x, y, false);
		});

		const stop = (event) => {
			drawing = false;
			if (event) event.preventDefault();
		};
		canvas.addEventListener('pointerup', stop);
		canvas.addEventListener('pointercancel', stop);
	}
})();
