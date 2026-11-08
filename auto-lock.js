// TETR.IO-style automatic piece locking.
//
// This follows the TETR.IO lock rules as implemented by the @haelp/teto
// engine (the TETR.IO replay simulator used by replay.js):
//
//   - A grounded piece locks once its accumulated ground time passes the lock
//     delay (TETR.IO's "Lock delay" handling option, 500 ms by default).
//   - Every successful move or rotation adds one lock reset. While resets
//     remain, the ground timer is cleared. Once they run out the piece locks
//     on the next grounded frame, no matter how fast the player keeps
//     spinning/rotating. TETR.IO also force-falls such a piece at 20G.
//   - The reset counter is cleared only when the piece reaches a row lower
//     than any it has reached before. A rotation kick that lifts the piece
//     off the floor does NOT clear it.
//   - "Infinite movement" (TETR.IO's handling option) removes the reset
//     limit: every move/rotation refreshes the timer, so the piece can be
//     kept alive indefinitely by moving.
//
// TETR.IO measures the delay in 60 Hz frames (30 frames = 500 ms) and keeps
// the counters on the falling piece; base.js owns the actual lock routine
// (window.ZZLockPiece).
(function (root) {
	'use strict';

	const STORAGE_KEY = 'zztetris_auto_lock_v1';
	const TICK_MS = 16; // TETR.IO advances its lock timer once per 60 Hz frame.
	const DEFAULTS = {
		enabled: false,
		delayMs: 500,
		resets: 15,
		infinite: false,
	};

	let enabled = DEFAULTS.enabled;
	let delayMs = DEFAULTS.delayMs;
	let resetLimit = DEFAULTS.resets;
	let infiniteMovement = DEFAULTS.infinite;

	let intervalId = null;
	let lastTickAt = 0;
	let paused = false;

	// Per-piece state, mirroring Tetromino.locking / lockResets / highestY.
	let lockingMs = 0;
	let lockResets = 0;
	let lowestRow = 0;
	let touchedDown = false;

	function $(id) {
		return document.getElementById(id);
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function readSettings() {
		return {
			enabled: !!$('autoLockEnabled')?.checked,
			delayMs: clamp(Number($('autoLockDelay')?.value) || 0, 0, 2000),
			resets: clamp(Number($('autoLockResets')?.value) || 0, 0, 100),
			infinite: !!$('autoLockInfinite')?.checked,
		};
	}

	function loadSettings() {
		let saved = {};
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) saved = JSON.parse(raw) || {};
		} catch (error) {
			saved = {};
		}
		const delay =
			saved.delayMs === undefined ? DEFAULTS.delayMs : Number(saved.delayMs);
		const resets =
			saved.resets === undefined ? DEFAULTS.resets : Number(saved.resets);
		return {
			enabled: saved.enabled === true,
			delayMs: clamp(
				Number.isFinite(delay) ? delay : DEFAULTS.delayMs,
				0,
				2000
			),
			resets: clamp(
				Number.isFinite(resets) ? resets : DEFAULTS.resets,
				0,
				100
			),
			infinite: saved.infinite === true,
		};
	}

	function saveSettings() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(readSettings()));
		} catch (error) {
			// Storage can be unavailable in private mode.
		}
	}

	function applySettingsToUi(settings) {
		const setValue = (id, value) => {
			const el = $(id);
			if (el) el.value = String(value);
		};
		const setChecked = (id, value) => {
			const el = $(id);
			if (el) el.checked = !!value;
		};
		setChecked('autoLockEnabled', settings.enabled);
		setValue('autoLockDelay', settings.delayMs);
		setValue('autoLockResets', settings.resets);
		setChecked('autoLockInfinite', settings.infinite);
	}

	function currentTime() {
		return typeof performance !== 'undefined' && performance.now
			? performance.now()
			: Date.now();
	}

	function pieceReady() {
		return (
			typeof piece !== 'undefined' &&
			!!piece &&
			typeof pieces !== 'undefined' &&
			!!pieces[piece] &&
			typeof rot === 'number' &&
			!!pieces[piece][rot] &&
			typeof xPOS === 'number' &&
			typeof yPOS === 'number' &&
			typeof canMove === 'function'
		);
	}

	function isGrounded() {
		if (!pieceReady()) return false;
		return !canMove(pieces[piece][rot], xPOS, yPOS + 1);
	}

	// TETR.IO's #shouldLock(): once the reset budget is spent the piece is
	// deadlocked and locks on the next grounded frame.
	function shouldLock() {
		return !infiniteMovement && lockResets >= resetLimit;
	}

	function resetPieceState() {
		lockingMs = 0;
		lockResets = 0;
		touchedDown = false;
		lowestRow = typeof yPOS === 'number' ? yPOS : 0;
	}

	function lockNow() {
		if (typeof root.ZZLockPiece === 'function') root.ZZLockPiece();
	}

	// A gravity or soft-drop step moved the piece down. Reaching a row lower
	// than any before grants a fresh set of lock resets (TETR.IO's highestY).
	function onFall() {
		if (!pieceReady()) return;
		if (yPOS > lowestRow) {
			lowestRow = yPOS;
			lockResets = 0;
		}
	}

	// A successful horizontal move or rotation. TETR.IO counts any shift or
	// rotation, whether or not the piece is touching the floor.
	function onMove() {
		if (!enabled || !pieceReady()) return;
		if (lockResets < 31) lockResets += 1;
		if (!shouldLock()) lockingMs = 0;
	}

	function tick() {
		const time = currentTime();
		let delta = time - lastTickAt;
		lastTickAt = time;

		if (!enabled || paused || !pieceReady()) return;
		// Timers are throttled in background tabs; don't burn the whole lock
		// delay in one step when the player comes back.
		if (!(delta >= 0) || delta > 250) delta = TICK_MS;

		const grounded = isGrounded();
		if (grounded) touchedDown = true;

		if (shouldLock()) {
			if (grounded) {
				lockNow();
				return;
			}
			// TETR.IO force-falls a deadlocked piece at 20G and locks it on
			// contact. A spin kick can lift it, so drop it to its landing row.
			if (touchedDown && typeof yGHO === 'number' && yPOS < yGHO) {
				yPOS = yGHO;
				if (typeof clearActive === 'function') clearActive();
				if (typeof setShape === 'function') setShape();
				lockNow();
			}
			return;
		}

		if (!grounded) return;
		lockingMs += delta;
		if (lockingMs > delayMs) lockNow();
	}

	function startInterval() {
		if (intervalId !== null) return;
		lastTickAt = currentTime();
		intervalId = setInterval(tick, TICK_MS);
	}

	function stopInterval() {
		if (intervalId === null) return;
		clearInterval(intervalId);
		intervalId = null;
	}

	function syncInterval() {
		if (enabled && !paused) startInterval();
		else stopInterval();
	}

	function onNewPiece() {
		resetPieceState();
	}

	function onLock() {
		resetPieceState();
	}

	function onPause(value) {
		paused = !!value;
		if (!paused) lastTickAt = currentTime();
		syncInterval();
	}

	function applySettings() {
		const settings = readSettings();
		enabled = settings.enabled;
		delayMs = settings.delayMs;
		resetLimit = settings.resets;
		infiniteMovement = settings.infinite;
		resetPieceState();
		syncInterval();
	}

	function bindUi() {
		for (const id of [
			'autoLockEnabled',
			'autoLockDelay',
			'autoLockResets',
			'autoLockInfinite',
		]) {
			const el = $(id);
			if (!el) continue;
			el.addEventListener('change', () => {
				saveSettings();
				applySettings();
			});
		}
	}

	function init() {
		const saved = loadSettings();
		applySettingsToUi(saved);
		bindUi();
		applySettings();
	}

	root.ZZAutoLock = {
		onNewPiece,
		onFall,
		onMove,
		onLock,
		onPause,
		isEnabled: () => enabled,
		getState: () => ({
			enabled,
			delayMs,
			resetLimit,
			infiniteMovement,
			timer: intervalId !== null,
			lockingMs,
			lockResets,
			lowestRow,
			touchedDown,
			grounded: isGrounded(),
		}),
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})(typeof globalThis !== 'undefined' ? globalThis : this);
