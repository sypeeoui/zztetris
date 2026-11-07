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

	function defaultButtons(preset) {
		const buttons = [
			{ id: 'L', cluster: 'left', col: 1, row: 2, action: 'L', icon: 's-back', hold: true },
			{ id: 'R', cluster: 'left', col: 2, row: 2, action: 'R', icon: 's-forward', hold: true },
			{ id: 'SD', cluster: 'left', col: 1, row: 1, span: 2, action: 'SD', icon: 's-down', hold: true },
			{ id: 'CCW', cluster: 'right', col: 1, row: 1, action: 'CCW', icon: 's-ccw', hold: false },
			{ id: 'CW', cluster: 'right', col: 2, row: 1, action: 'CW', icon: 's-cw', hold: false },
			{ id: 'HD', cluster: 'right', col: 1, row: 2, span: 2, action: 'HD', icon: 's-harddrop', hold: false },
			{ id: 'HL', cluster: 'right', col: 1, row: 3, action: 'HL', icon: 's-hold', hold: false },
			{ id: 'R180', cluster: 'right', col: 2, row: 3, action: 'R180', icon: 's-r180', hold: false },
		];
		if (preset === 'left-handed') {
			for (const button of buttons) {
				button.cluster = button.cluster === 'left' ? 'right' : 'left';
				if (!button.span) button.col = 3 - button.col;
			}
		}
		return buttons;
	}

	const DEFAULT_CONFIG = {
		version: 1,
		portrait: {
			split: 0.5,
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
		},
		landscape: {
			preset: 'techmino',
			size: 64,
			opacity: 55,
			haptics: true,
			buttons: defaultButtons('techmino'),
		},
		display: {
			showHold: false,
			showNext: false,
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
		return mergeDeep(clone(DEFAULT_CONFIG), stored);
	}

	let config = loadConfig();
	normalizeConfig();

	function normalizeConfig() {
		const defaults = defaultButtons('techmino');
		const byId = {};
		for (const button of defaults) byId[button.id] = button;
		if (!Array.isArray(config.landscape.buttons) || !config.landscape.buttons.length) {
			config.landscape.buttons = defaultButtons(
				config.landscape.preset === 'left-handed' ? 'left-handed' : 'techmino'
			);
			return;
		}
		for (const button of config.landscape.buttons) {
			const fallback = byId[button.id];
			if (!fallback) continue;
			if (!button.icon) button.icon = fallback.icon;
			if (typeof button.hold !== 'boolean') button.hold = fallback.hold;
			if (!button.cluster) button.cluster = fallback.cluster;
			if (!button.col) button.col = fallback.col;
			if (!button.row) button.row = fallback.row;
			if (fallback.span) button.span = fallback.span;
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
	buildPauseButton();
	buildPortraitControls();
	buildLandscapeControls();
	buildPauseMenu();
	buildSettings();
	buildBoardSheet();
	buildQueueSheet();
	buildModeMenu();

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

	if (!params.get('nosw') && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
		window.addEventListener('load', () => {
			navigator.serviceWorker.register('sw.js').catch(() => {});
		});
	}

	document.addEventListener('keydown', (event) => {
		if (event.key !== 'Escape') return;
		const overlays = ['zzSettingsSheet', 'zzBoardSheet', 'zzQueueSheet', 'zzModeMenu', 'zzPauseMenu'];
		for (const id of overlays) {
			const element = $(id);
			if (!element || element.hidden) continue;
			if (id === 'zzPauseMenu') closePause();
			else if (id === 'zzModeMenu') {
				hide(id);
				setPaused(false);
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
		const controlsHeight = Math.round(Math.min(Math.max(window.innerHeight * 0.24, 120), 200));
		root.style.setProperty('--zz-controls-height', controlsHeight + 'px');
		updateHudVisibility();
		requestAnimationFrame(resizeBoard);
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
			'<canvas id="zzHoldMini" width="60" height="40"></canvas>' +
			'<canvas id="zzNextMini" width="180" height="40"></canvas>';
		document.body.appendChild(hud);
		updateHudVisibility();
	}

	function updateHudVisibility() {
		const hud = $('zzMobileHud');
		if (!hud) return;
		const showHud =
			orientation === 'landscape' && (config.display.showHold || config.display.showNext);
		hud.hidden = !showHud;
		const hold = $('zzHoldMini');
		const next = $('zzNextMini');
		if (hold) hold.hidden = !(showHud && config.display.showHold);
		if (next) next.hidden = !(showHud && config.display.showNext);
	}

	function drawHud() {
		if (orientation !== 'landscape') return;
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
				let x = 0;
				let count = 0;
				for (const piece of queue) {
					if (piece === '|') continue;
					if (!imgs[piece]) continue;
					ctx.drawImage(imgs[piece], x, 0, 60, 40);
					x += 60;
					count++;
					if (count >= 3) break;
				}
			}
		}
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
	}

	function setPaused(value) {
		paused = !!value;
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
			'<button class="zzSheetBtn" data-action="restart">Restart</button>' +
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
			.addEventListener('click', () => openSubSheet('zzQueueSheet', 'zzPauseMenu'));
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
		wrap.innerHTML =
			'<div class="zzCluster" id="zzLeftCluster"></div>' +
			'<div class="zzCluster" id="zzRightCluster"></div>';
		document.body.appendChild(wrap);
		applyLandscapeVars();
		rebuildLandscapeButtons();
	}

	function applyLandscapeVars() {
		root.style.setProperty('--zz-btn-size', config.landscape.size + 'px');
		root.style.setProperty('--zz-btn-opacity', (config.landscape.opacity / 100).toFixed(2));
		requestAnimationFrame(resizeBoard);
	}

	function rebuildLandscapeButtons() {
		const left = $('zzLeftCluster');
		const right = $('zzRightCluster');
		if (!left || !right) return;
		left.innerHTML = '';
		right.innerHTML = '';
		for (const button of config.landscape.buttons) {
			const element = document.createElement('button');
			element.type = 'button';
			element.className = 'zzBtn' + (button.span ? ' zzBtn--wide' : '');
			element.dataset.action = button.action;
			element.style.gridColumn = button.span ? '1 / span 2' : String(button.col);
			element.style.gridRow = String(button.row);
			element.innerHTML =
				'<svg aria-hidden="true"><use href="./assets/icons/dark.svg#' + button.icon + '"></use></svg>';
			element.addEventListener('pointerdown', (event) => {
				event.preventDefault();
				if (paused) return;
				try {
					element.setPointerCapture(event.pointerId);
				} catch (error) {
					// Pointer capture is best-effort.
				}
				element.classList.add('zz-active');
				if (button.hold) window.ZZInput?.press(button.action);
				else window.ZZInput?.tap(button.action);
				haptic();
			});
			const release = () => {
				element.classList.remove('zz-active');
				if (button.hold) window.ZZInput?.release(button.action);
			};
			element.addEventListener('pointerup', release);
			element.addEventListener('pointercancel', release);
			element.addEventListener('pointerleave', release);
			(button.cluster === 'left' ? left : right).appendChild(element);
		}
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
			'<div class="zzSheetRow"><label>DAS</label><input type="range" id="zzDas" min="0" max="750" step="10"><span class="zzVal" id="zzDasVal"></span></div>' +
			'<div class="zzSheetRow"><label>ARR</label><input type="range" id="zzArr" min="0" max="500" step="5"><span class="zzVal" id="zzArrVal"></span></div>' +
			'<div class="zzSheetRow"><label>SDR</label><input type="range" id="zzSdr" min="0" max="250" step="5"><span class="zzVal" id="zzSdrVal"></span></div>' +
			'<p class="zzHint">DAS is the delay before auto-repeat, ARR is the repeat rate, SDR is the soft-drop rate.</p>' +
			'</div>' +
			'<div class="zzTabPanel" data-panel="portrait">' +
			'<div class="zzMapGrid"><div class="zzMapCard" id="zzLeftMap"></div><div class="zzMapCard" id="zzRightMap"></div></div>' +
			'<div class="zzSheetRow"><label>Swipe distance</label><input type="range" id="zzSwipe" min="12" max="60" step="2"><span class="zzVal" id="zzSwipeVal"></span></div>' +
			'<div class="zzSheetRow"><label>Tap max</label><input type="range" id="zzTapMax" min="80" max="400" step="10"><span class="zzVal" id="zzTapMaxVal"></span></div>' +
			'<div class="zzSheetRow"><label>Long press</label><input type="range" id="zzLongPress" min="150" max="600" step="10"><span class="zzVal" id="zzLongPressVal"></span></div>' +
			'<div class="zzSheetRow"><label>Dead zone</label><input type="range" id="zzDeadZone" min="2" max="24" step="1"><span class="zzVal" id="zzDeadZoneVal"></span></div>' +
			'<div class="zzSheetRow"><label>Pad split</label><input type="range" id="zzPadSplit" min="30" max="70" step="1"><span class="zzVal" id="zzPadSplitVal"></span></div>' +
			'</div>' +
			'<div class="zzTabPanel" data-panel="landscape">' +
			'<div class="zzSheetRow"><label>Preset</label><select id="zzLandscapePreset"><option value="techmino">Techmino</option><option value="left-handed">Left-handed</option><option value="custom">Custom</option></select></div>' +
			'<div class="zzSheetRow"><label>Button size</label><input type="range" id="zzBtnSize" min="44" max="96" step="4"><span class="zzVal" id="zzBtnSizeVal"></span></div>' +
			'<div class="zzSheetRow"><label>Opacity</label><input type="range" id="zzBtnOpacity" min="20" max="100" step="5"><span class="zzVal" id="zzBtnOpacityVal"></span></div>' +
			'<div class="zzSheetRow"><label>Haptics</label><input type="checkbox" id="zzHaptics"></div>' +
			'<div class="zzMapCard" id="zzButtonMap"></div>' +
			'</div>' +
			'<div class="zzTabPanel" data-panel="app">' +
			'<button class="zzSheetBtn" id="zzInstallBtn" hidden>Install app</button>' +
			'<button class="zzSheetBtn" id="zzFullscreenBtn">Enter fullscreen</button>' +
			'<div class="zzSheetRow"><label>Pause button</label><select id="zzPauseCorner"><option value="top-right">Top right</option><option value="top-left">Top left</option><option value="bottom-right">Bottom right</option><option value="bottom-left">Bottom left</option></select></div>' +
			'<div class="zzSheetRow"><label>Show hold</label><input type="checkbox" id="zzShowHold"></div>' +
			'<div class="zzSheetRow"><label>Show next</label><input type="checkbox" id="zzShowNext"></div>' +
			'<button class="zzSheetBtn zzSheetBtn--danger" id="zzResetSettings">Reset mobile settings</button>' +
			'<p class="zzHint">ZZTetris mobile · gesture and button controls</p>' +
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
		setupLandscape();
		setupDisplay();
		setupPauseCorner();
		setupApp();
	}

	function setupHandling() {
		const das = $('zzDas');
		const arr = $('zzArr');
		const sdr = $('zzSdr');
		const dasVal = $('zzDasVal');
		const arrVal = $('zzArrVal');
		const sdrVal = $('zzSdrVal');
		if (!das || !arr || !sdr) return;

		function sync() {
			das.value = DAS;
			arr.value = ARR;
			sdr.value = SDR;
			dasVal.textContent = DAS + 'ms';
			arrVal.textContent = ARR + 'ms';
			sdrVal.textContent = SDR + 'ms';
		}

		function update() {
			DAS = parseInt(das.value, 10);
			ARR = parseInt(arr.value, 10);
			SDR = parseInt(sdr.value, 10);
			dasVal.textContent = DAS + 'ms';
			arrVal.textContent = ARR + 'ms';
			sdrVal.textContent = SDR + 'ms';
			saveHandling();
		}

		das.addEventListener('input', update);
		arr.addEventListener('input', update);
		sdr.addEventListener('input', update);
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
		const swipeVal = $('zzSwipeVal');
		const tapMaxVal = $('zzTapMaxVal');
		const longPressVal = $('zzLongPressVal');
		const deadZoneVal = $('zzDeadZoneVal');
		if (!swipe || !tapMax || !longPress || !deadZone) return;

		function sync() {
			swipe.value = thresholds.swipe;
			tapMax.value = thresholds.tapMax;
			longPress.value = thresholds.longPress;
			deadZone.value = thresholds.deadZone;
			swipeVal.textContent = thresholds.swipe + 'px';
			tapMaxVal.textContent = thresholds.tapMax + 'ms';
			longPressVal.textContent = thresholds.longPress + 'ms';
			deadZoneVal.textContent = thresholds.deadZone + 'px';
		}

		function update() {
			thresholds.swipe = parseInt(swipe.value, 10);
			thresholds.tapMax = parseInt(tapMax.value, 10);
			thresholds.longPress = parseInt(longPress.value, 10);
			thresholds.deadZone = parseInt(deadZone.value, 10);
			swipeVal.textContent = thresholds.swipe + 'px';
			tapMaxVal.textContent = thresholds.tapMax + 'ms';
			longPressVal.textContent = thresholds.longPress + 'ms';
			deadZoneVal.textContent = thresholds.deadZone + 'px';
			saveConfig();
		}

		swipe.addEventListener('input', update);
		tapMax.addEventListener('input', update);
		longPress.addEventListener('input', update);
		deadZone.addEventListener('input', update);
		sync();
	}

	function setupPortraitLayout() {
		const split = $('zzPadSplit');
		const splitVal = $('zzPadSplitVal');
		if (!split) return;
		split.value = Math.round((config.portrait.split || 0.5) * 100);
		splitVal.textContent = split.value + '%';
		split.addEventListener('input', () => {
			config.portrait.split = parseInt(split.value, 10) / 100;
			splitVal.textContent = split.value + '%';
			applyPortraitSplit();
			saveConfig();
		});
	}

	function setupLandscape() {
		const preset = $('zzLandscapePreset');
		const size = $('zzBtnSize');
		const opacity = $('zzBtnOpacity');
		const haptics = $('zzHaptics');
		const sizeVal = $('zzBtnSizeVal');
		const opacityVal = $('zzBtnOpacityVal');
		if (!preset || !size || !opacity || !haptics) return;

		preset.value = config.landscape.preset;
		size.value = config.landscape.size;
		opacity.value = config.landscape.opacity;
		haptics.checked = config.landscape.haptics;
		sizeVal.textContent = config.landscape.size + 'px';
		opacityVal.textContent = config.landscape.opacity + '%';

		preset.addEventListener('change', () => applyPreset(preset.value));
		size.addEventListener('input', () => {
			config.landscape.size = parseInt(size.value, 10);
			sizeVal.textContent = config.landscape.size + 'px';
			applyLandscapeVars();
			saveConfig();
		});
		opacity.addEventListener('input', () => {
			config.landscape.opacity = parseInt(opacity.value, 10);
			opacityVal.textContent = config.landscape.opacity + '%';
			applyLandscapeVars();
			saveConfig();
		});
		haptics.addEventListener('change', () => {
			config.landscape.haptics = haptics.checked;
			saveConfig();
		});
		buildButtonMap();
	}

	function applyPreset(name) {
		config.landscape.preset = name;
		if (name === 'techmino' || name === 'left-handed') {
			config.landscape.buttons = defaultButtons(name);
		}
		saveConfig();
		rebuildLandscapeButtons();
		buildButtonMap();
	}

	function buildButtonMap() {
		const container = $('zzButtonMap');
		if (!container) return;
		container.innerHTML = '<h4>Buttons</h4>';
		for (const button of config.landscape.buttons) {
			const row = document.createElement('div');
			row.className = 'zzMapRow';
			const name = document.createElement('label');
			name.textContent = button.id;
			const select = document.createElement('select');
			for (const option of ACTIONS) {
				const item = document.createElement('option');
				item.value = option.value;
				item.textContent = option.label;
				select.appendChild(item);
			}
			select.value = button.action;
			select.addEventListener('change', () => {
				button.action = select.value;
				config.landscape.preset = 'custom';
				const preset = $('zzLandscapePreset');
				if (preset) preset.value = 'custom';
				saveConfig();
				rebuildLandscapeButtons();
			});
			row.appendChild(name);
			row.appendChild(select);
			container.appendChild(row);
		}
	}

	function setupDisplay() {
		const showHold = $('zzShowHold');
		const showNext = $('zzShowNext');
		if (!showHold || !showNext) return;
		showHold.checked = config.display.showHold;
		showNext.checked = config.display.showNext;
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
			'<div id="zzBoardBody"></div>' +
			'</div>';
		document.body.appendChild(overlay);
		overlay.querySelector('[data-close]').addEventListener('click', () => closeSubSheet('zzBoardSheet'));

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
			'</div>';
		document.body.appendChild(overlay);
		overlay.querySelector('[data-close]').addEventListener('click', () => closeSubSheet('zzQueueSheet'));
		$('zzShuffleQueue').addEventListener('click', () => {
			if (typeof shuffleQueue === 'function') shuffleQueue();
		});
		$('zzShuffleQueueHold').addEventListener('click', () => {
			if (typeof shuffleQueuePlusHold === 'function') shuffleQueuePlusHold();
		});
		$('zzResetQueue').addEventListener('click', () => window.ZZStats?.resetQueue());
		$('zzResetQueueHold').addEventListener('click', () => window.ZZStats?.resetQueueHold());
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
})();
