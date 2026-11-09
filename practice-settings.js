// Persisted practice settings and the gravity controls.
//
// Practice Garbage and Practice Gravity used to reset on reload. They now
// live in their own localStorage keys so they survive reloads and can be
// exported/imported independently of the controls/handling config.
(function (root) {
	'use strict';

	const STORAGE_KEYS = {
		garbage: 'zztetris_practice_garbage_v1',
		gravity: 'zztetris_practice_gravity_v1',
		attackSim: 'zztetris_attack_sim_v1',
		autoLock: 'zztetris_auto_lock_v1',
		holdLock: 'zztetris_hold_lock_v1',
	};

	const GARBAGE_DEFAULTS = {
		layers: 1,
		messiness: 0,
		permanent: false,
	};

	const GRAVITY_DEFAULTS = {
		gravityMs: 700,
	};

	let gravityUiBound = false;
	let garbageUiBound = false;
	let gravityBase = GRAVITY_DEFAULTS.gravityMs;

	function $(id) {
		return document.getElementById(id);
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function finiteNumber(value, fallback) {
		const number = Number(value);
		return Number.isFinite(number) ? number : fallback;
	}

	function readJson(key) {
		try {
			const raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : null;
		} catch (error) {
			return null;
		}
	}

	function writeJson(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch (error) {
			// Storage can be unavailable in private mode; the values still work
			// for the current session.
		}
	}

	function normalizeGarbage(value) {
		const saved = value && typeof value === 'object' ? value : {};
		const layers = finiteNumber(saved.layers, GARBAGE_DEFAULTS.layers);
		const messiness = finiteNumber(saved.messiness, GARBAGE_DEFAULTS.messiness);
		return {
			layers: Math.round(clamp(layers, 1, 20)),
			messiness: Math.round(clamp(messiness, 0, 100)),
			permanent: saved.permanent === true,
		};
	}

	function normalizeGravity(value) {
		const saved = value && typeof value === 'object' ? value : {};
		const gravityMs = finiteNumber(saved.gravityMs, GRAVITY_DEFAULTS.gravityMs);
		return {
			gravityMs: Math.round(clamp(gravityMs, 0, 10000)),
		};
	}

	function loadGarbage() {
		return normalizeGarbage(readJson(STORAGE_KEYS.garbage));
	}

	function saveGarbage(value) {
		const normalized = normalizeGarbage(value);
		writeJson(STORAGE_KEYS.garbage, normalized);
		return normalized;
	}

	function loadGravity() {
		return normalizeGravity(readJson(STORAGE_KEYS.gravity));
	}

	function saveGravity(value) {
		const normalized = normalizeGravity(value);
		writeJson(STORAGE_KEYS.gravity, normalized);
		return normalized;
	}

	function isReplayPracticeMode() {
		try {
			return new URLSearchParams(location.search).get('replayPractice') === '1';
		} catch (error) {
			return false;
		}
	}

	function isGravMode() {
		try {
			return typeof mode !== 'undefined' && mode === 'grav';
		} catch (error) {
			return false;
		}
	}

	function setEffectiveGravity(value) {
		// base.js declares zzGravityMs. This module can run before base.js, so
		// only assign it when the binding already exists. gravityBase stays
		// the unmultiplied value so repeatedly moving the speed slider does
		// not compound the multiplier.
		if (typeof zzGravityMs !== 'undefined') zzGravityMs = value;
	}

	function updateGravityUi(multiplier = 1) {
		const slider = $('practiceGravityMultiplier');
		const input = $('practiceGravityMs');
		const label = $('practiceGravityValue');
		if (input) input.value = String(Math.round(gravityBase));
		if (slider) slider.value = String(multiplier);
		if (label) label.textContent = `${multiplier}×`;
	}

	function applyGarbageToUi(settings) {
		const layers = $('practiceLayers');
		const messiness = $('practiceMessiness');
		const permanent = $('practicePermanent');
		const label = $('messinessVal');
		if (layers) layers.value = String(settings.layers);
		if (messiness) messiness.value = String(settings.messiness);
		if (permanent) permanent.checked = !!settings.permanent;
		if (label) label.textContent = `${settings.messiness}%`;
	}

	function readGarbageFromUi() {
		return {
			layers: $('practiceLayers')?.value,
			messiness: $('practiceMessiness')?.value,
			permanent: !!$('practicePermanent')?.checked,
		};
	}

	function bindGarbageUi() {
		if (garbageUiBound || !$('practiceLayers')) return;
		garbageUiBound = true;
		applyGarbageToUi(loadGarbage());

		const layers = $('practiceLayers');
		const messiness = $('practiceMessiness');
		const permanent = $('practicePermanent');
		layers?.addEventListener('change', () => saveGarbage(readGarbageFromUi()));
		messiness?.addEventListener('input', () => {
			const label = $('messinessVal');
			if (label) label.textContent = `${messiness.value}%`;
			saveGarbage(readGarbageFromUi());
		});
		permanent?.addEventListener('change', () => saveGarbage(readGarbageFromUi()));
	}

	function bindGravityUi() {
		// Replay practice owns its gravity controls; a replay's gravity must not
		// overwrite the user's practice setting.
		if (gravityUiBound || isReplayPracticeMode() || !$('practiceGravityMs')) return;
		gravityUiBound = true;

		const slider = $('practiceGravityMultiplier');
		const input = $('practiceGravityMs');
		const label = $('practiceGravityValue');
		gravityBase = loadGravity().gravityMs;
		updateGravityUi(1);

		slider?.addEventListener('input', () => {
			const multiplier = Math.max(0.1, finiteNumber(slider.value, 1));
			const effective = Math.max(0, gravityBase / multiplier);
			setEffectiveGravity(effective);
			if (input) input.value = String(Math.round(effective));
			if (label) label.textContent = `${multiplier}×`;
			saveGravity({ gravityMs: effective });
		});

		input?.addEventListener('change', () => {
			gravityBase = Math.max(0, finiteNumber(input.value, gravityBase));
			setEffectiveGravity(gravityBase);
			if (slider) slider.value = '1';
			if (label) label.textContent = '1×';
			saveGravity({ gravityMs: gravityBase });
		});
	}

	// Called by base.js after callback() seeds zzGravityMs. Mode-specific
	// gravity (Grav mode and replay practice) is intentionally left alone.
	function applyGravity() {
		if (isReplayPracticeMode() || isGravMode()) return;
		const saved = loadGravity();
		gravityBase = saved.gravityMs;
		setEffectiveGravity(saved.gravityMs);
		updateGravityUi(1);
	}

	function init() {
		bindGarbageUi();
		bindGravityUi();
		window.addEventListener('storage', (event) => {
			if (event.key === STORAGE_KEYS.garbage || event.key === null) {
				applyGarbageToUi(loadGarbage());
			}
			if (event.key === STORAGE_KEYS.gravity || event.key === null) {
				if (!isReplayPracticeMode() && !isGravMode()) {
					const saved = loadGravity();
					gravityBase = saved.gravityMs;
					setEffectiveGravity(saved.gravityMs);
					updateGravityUi(1);
					if (!gravityUiBound) bindGravityUi();
				}
			}
		});
	}

	root.ZZPracticeSettings = {
		STORAGE_KEYS,
		GARBAGE_DEFAULTS,
		GRAVITY_DEFAULTS,
		normalizeGarbage,
		normalizeGravity,
		loadGarbage,
		saveGarbage,
		loadGravity,
		saveGravity,
		applyGravity,
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})(typeof globalThis !== 'undefined' ? globalThis : this);
