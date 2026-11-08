// TETR.IO-style automatic piece locking.
//
// When enabled, a grounded piece locks after the configured delay. A move or
// rotation refreshes the timer up to the configured number of resets. The
// module talks to base.js through the small ZZAutoLock hooks; base.js owns
// the actual lock routine (window.ZZLockPiece).
(function (root) {
	'use strict';

	const STORAGE_KEY = 'zztetris_auto_lock_v1';
	const DEFAULTS = {
		enabled: false,
		delayMs: 500,
		resets: 15,
		infinite: false,
	};

	let enabled = DEFAULTS.enabled;
	let delayMs = DEFAULTS.delayMs;
	let resetLimit = DEFAULTS.resets;
	let infiniteResets = DEFAULTS.infinite;
	let timer = null;
	let resetsUsed = 0;

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

	function isGrounded() {
		if (typeof piece === 'undefined' || !piece) return false;
		if (typeof pieces === 'undefined' || !pieces[piece]) return false;
		if (typeof canMove !== 'function') return false;
		return !canMove(pieces[piece][rot], xPOS, yPOS + 1);
	}

	function cancelTimer() {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function startTimer() {
		cancelTimer();
		if (!enabled || !isGrounded()) return;
		timer = setTimeout(onTimeout, Math.max(0, delayMs));
	}

	function onTimeout() {
		timer = null;
		if (!enabled) return;
		if (typeof zzPaused !== 'undefined' && zzPaused) {
			startTimer();
			return;
		}
		if (!isGrounded()) return;
		if (typeof root.ZZLockPiece === 'function') {
			root.ZZLockPiece();
		}
	}

	// Gravity just moved the piece (or tried to). Start the lock timer if the
	// piece is resting; do not count gravity as a lock reset.
	function onGravity() {
		if (!enabled) return;
		if (!isGrounded()) {
			cancelTimer();
			resetsUsed = 0;
			return;
		}
		if (timer === null) startTimer();
	}

	// A player move or rotation happened. Refresh the lock timer if the piece
	// is grounded and resets remain.
	function onMove() {
		if (!enabled) return;
		if (!isGrounded()) {
			cancelTimer();
			resetsUsed = 0;
			return;
		}
		if (timer === null) {
			startTimer();
			return;
		}
		if (infiniteResets || resetsUsed < resetLimit) {
			resetsUsed += 1;
			startTimer();
		}
	}

	function onNewPiece() {
		cancelTimer();
		resetsUsed = 0;
	}

	function onLock() {
		cancelTimer();
		resetsUsed = 0;
	}

	function onPause(paused) {
		if (paused) {
			cancelTimer();
		} else if (enabled && isGrounded()) {
			startTimer();
		}
	}

	function applySettings() {
		const settings = readSettings();
		enabled = settings.enabled;
		delayMs = settings.delayMs;
		resetLimit = settings.resets;
		infiniteResets = settings.infinite;
		if (!enabled) {
			cancelTimer();
			resetsUsed = 0;
		} else if (isGrounded()) {
			// Apply delay/reset changes immediately for a resting piece.
			startTimer();
		}
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
		onGravity,
		onMove,
		onLock,
		onPause,
		isEnabled: () => enabled,
		getState: () => ({
			enabled,
			delayMs,
			resetLimit,
			infiniteResets,
			timer: timer !== null,
			resetsUsed,
			grounded: isGrounded(),
		}),
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})(typeof globalThis !== 'undefined' ? globalThis : this);
