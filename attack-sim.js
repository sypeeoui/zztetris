// Simulates an opponent sending garbage at a configurable rate.
//
// The generator feeds attacks into the same TETR.IO garbage queue used by
// replay practice. On a lock with no clear the pending garbage is tanked; on
// a clear the attack cancels pending garbage. Settings live under the
// Practice Garbage section and persist in localStorage.
(function (root) {
	'use strict';

	const STORAGE_KEY = 'zztetris_attack_sim_v1';
	const MAX_BLOCK = 10;
	const MAX_APM = 300;
	const MAX_PENDING = 100;
	// TETR.IO's standard garbage cap is 8 lines tanked per lock.
	const MAX_TANK = 8;
	const MIN_INTERVAL = 50;
	const FIRST_ATTACK_DELAY = 1000;
	const WELL_MODES = new Set(['4w', '4w4res', '4w5res', '4w6res', '3w']);
	const DEFAULT_SETTINGS = {
		enabled: false,
		apm: 30,
		messiness: 0,
		timeRandom: 0,
		sizeRandom: 0,
		holeMessiness: 0,
	};

	let enabled = false;
	let queue = null;
	let timer = null;
	let nextCid = 1;

	function $(id) {
		return document.getElementById(id);
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function readSettings() {
		return {
			enabled: !!$('simulateAttackEnabled')?.checked,
			apm: clamp(Number($('simulateAttackApm')?.value) || 0, 0, MAX_APM),
			messiness: clamp(
				Number($('simulateAttackMessiness')?.value) || 0,
				0,
				100
			),
			timeRandom: clamp(
				Number($('simulateAttackTimeRandom')?.value) || 0,
				0,
				100
			),
			sizeRandom: clamp(
				Number($('simulateAttackSizeRandom')?.value) || 0,
				0,
				100
			),
			holeMessiness: clamp(
				Number($('simulateAttackHoleMessiness')?.value) || 0,
				0,
				100
			),
		};
	}

	function loadSettings() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return null;
			const saved = JSON.parse(raw);
			return {
				enabled: !!saved.enabled,
				apm: clamp(Number(saved.apm) || 0, 0, MAX_APM),
				messiness: clamp(Number(saved.messiness) || 0, 0, 100),
				timeRandom: clamp(Number(saved.timeRandom) || 0, 0, 100),
				sizeRandom: clamp(Number(saved.sizeRandom) || 0, 0, 100),
				holeMessiness: clamp(Number(saved.holeMessiness) || 0, 0, 100),
			};
		} catch (error) {
			return null;
		}
	}

	function saveSettings() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(readSettings()));
		} catch (error) {
			// Storage can be unavailable in private mode; the simulator still
			// works for the current session.
		}
	}

	function applySettingsToUi(settings) {
		if (!settings) return;
		const setValue = (id, value) => {
			const el = $(id);
			if (el) el.value = String(value);
		};
		const setChecked = (id, value) => {
			const el = $(id);
			if (el) el.checked = !!value;
		};
		setChecked('simulateAttackEnabled', settings.enabled);
		setValue('simulateAttackApm', settings.apm);
		setValue('simulateAttackMessiness', settings.messiness);
		setValue('simulateAttackTimeRandom', settings.timeRandom);
		setValue('simulateAttackSizeRandom', settings.sizeRandom);
		setValue('simulateAttackHoleMessiness', settings.holeMessiness);
		updateValueDisplays();
	}

	// Apply settings that came from storage (initial load or an import in the
	// settings popup) without re-saving them.
	function applyLoadedSettings(settings) {
		const next = Object.assign({}, DEFAULT_SETTINGS, settings || {});
		applySettingsToUi(next);
		const wasEnabled = enabled;
		enabled = !!next.enabled;
		if (!queue) createQueue();
		applyHoleMessiness();
		if (enabled) {
			if (!wasEnabled) {
				queue.reset();
				nextCid = 1;
			}
			scheduleNext(wasEnabled ? 0 : FIRST_ATTACK_DELAY);
		} else {
			clearTimeout(timer);
			timer = null;
			if (queue) queue.reset();
		}
		updateValueDisplays();
		updateMeter();
	}

	function updateValueDisplays() {
		const pairs = [
			['simulateAttackMessiness', 'simulateAttackMessinessVal'],
			['simulateAttackTimeRandom', 'simulateAttackTimeRandomVal'],
			['simulateAttackSizeRandom', 'simulateAttackSizeRandomVal'],
			['simulateAttackHoleMessiness', 'simulateAttackHoleMessinessVal'],
		];
		for (const [inputId, labelId] of pairs) {
			const input = $(inputId);
			const label = $(labelId);
			if (input && label) label.textContent = `${input.value}%`;
		}
	}

	function baseSizeFor(messiness) {
		return 1 + (messiness / 100) * (MAX_BLOCK - 1);
	}

	function createQueue() {
		const settings = readSettings();
		queue = new root.ZZReplayEngine.GarbageQueue({
			boardWidth: 10,
			garbage: { speed: 0, holeSize: 1 },
			messiness: {
				// A block keeps one hole for all of its rows. Hole messiness
				// only decides whether the next block gets a new column.
				change: settings.holeMessiness / 100,
				within: 0,
				timeout: 0,
				nosame: false,
				center: false,
			},
			cap: { absolute: MAX_PENDING, max: MAX_TANK },
			seed: Math.floor(Math.random() * 2147483646) + 1,
			rounding: 'down',
			bombs: false,
			specialBonus: false,
			openerPhase: 0,
		});
	}

	function applyHoleMessiness() {
		if (!queue) return;
		queue.options.messiness.change = readSettings().holeMessiness / 100;
		queue.options.messiness.within = 0;
	}

	function updateMeter() {
		if (typeof root.updateGarbageMeterDisplay === 'function') {
			root.updateGarbageMeterDisplay(queue ? queue.queue : []);
		}
	}

	function replayPracticeActive() {
		return !!root.ZZReplayPractice?.isActive();
	}

	function scheduleNext(minDelay = 0) {
		clearTimeout(timer);
		timer = null;
		if (!enabled) return;
		const settings = readSettings();
		if (settings.apm <= 0) return;
		const baseSize = baseSizeFor(settings.messiness);
		const baseInterval = (60000 * baseSize) / settings.apm;
		const jitter = settings.timeRandom / 100;
		const delay = Math.max(
			MIN_INTERVAL,
			minDelay,
			baseInterval * (1 + jitter * (Math.random() * 2 - 1))
		);
		timer = setTimeout(tick, delay);
	}

	function tick() {
		timer = null;
		if (!enabled) return;
		if (root.zzPaused || replayPracticeActive()) {
			timer = setTimeout(tick, 100);
			return;
		}
		spawnAttack();
		scheduleNext();
	}

	function spawnAttack() {
		if (!queue) return;
		const settings = readSettings();
		const baseSize = baseSizeFor(settings.messiness);
		const sizeJitter = settings.sizeRandom / 100;
		const size = Math.max(
			1,
			Math.round(
				baseSize +
					sizeJitter * (Math.random() * 2 - 1) * (baseSize - 1)
			)
		);
		queue.receive({
			frame: Date.now(),
			amount: size,
			size: 1,
			cid: nextCid++,
			gameid: 0,
			confirmed: true,
		});
		updateMeter();
	}

	function tankRows(rows) {
		let total = 0;
		for (const row of rows) total += row.amount;
		if (total <= 0) return 0;
		const currentMode = typeof mode !== 'undefined' ? mode : '';
		if (
			WELL_MODES.has(currentMode) &&
			typeof root.addInfiniteGarbage === 'function'
		) {
			// 4W/3W boards have walls outside the well; reuse the mode's
			// wall-preserving garbage inserter.
			root.addInfiniteGarbage(total);
		} else {
			for (const row of rows) {
				root.addGarbageRows(row.column, row.amount, row.size);
			}
		}
		return total;
	}

	function afterLock(info) {
		if (!enabled || !queue) return;
		if (replayPracticeActive()) return;
		const cleared = Number(info?.cleared) || 0;
		const attack = Math.max(0, Math.floor(Number(info?.attack) || 0));
		if (cleared > 0) {
			const pieces = root.ZZStats?.getState()?.pieces || 0;
			const [, canceledRows] = queue.cancel(attack, pieces, {
				openerPhase: false,
			});
			const canceled = canceledRows.reduce(
				(sum, row) => sum + (Number(row?.amount) || 0),
				0
			);
			if (canceled > 0) {
				root.ZZStats?.addGarbageCanceled?.(canceled);
			}
		} else {
			const rows = queue.tank(Date.now(), MAX_TANK, true);
			const total = tankRows(rows);
			if (total > 0) {
				root.ZZStats?.addGarbageReceived?.(total);
			}
		}
		updateMeter();
	}

	function resetQueue() {
		if (queue) queue.reset();
		nextCid = 1;
		updateMeter();
		if (enabled) scheduleNext(FIRST_ATTACK_DELAY);
	}

	function setEnabled(value) {
		enabled = !!value;
		saveSettings();
		if (enabled) {
			if (!queue) createQueue();
			queue.reset();
			nextCid = 1;
			updateMeter();
			scheduleNext(FIRST_ATTACK_DELAY);
		} else {
			clearTimeout(timer);
			timer = null;
			if (queue) queue.reset();
			updateMeter();
		}
	}

	function onRestart() {
		if (!enabled) return;
		if (queue) queue.reset();
		nextCid = 1;
		updateMeter();
		scheduleNext(FIRST_ATTACK_DELAY);
	}

	function bindUi() {
		const enable = $('simulateAttackEnabled');
		if (enable) {
			enable.addEventListener('change', () => {
				setEnabled(enable.checked);
			});
		}

		const apm = $('simulateAttackApm');
		if (apm) {
			apm.addEventListener('change', () => {
				saveSettings();
				if (enabled) scheduleNext();
			});
		}

		const messiness = $('simulateAttackMessiness');
		if (messiness) {
			messiness.addEventListener('input', updateValueDisplays);
			messiness.addEventListener('change', () => {
				saveSettings();
				if (enabled) scheduleNext();
			});
		}

		const timeRandom = $('simulateAttackTimeRandom');
		if (timeRandom) {
			timeRandom.addEventListener('input', updateValueDisplays);
			timeRandom.addEventListener('change', () => {
				saveSettings();
				if (enabled) scheduleNext();
			});
		}

		const sizeRandom = $('simulateAttackSizeRandom');
		if (sizeRandom) {
			sizeRandom.addEventListener('input', updateValueDisplays);
			sizeRandom.addEventListener('change', saveSettings);
		}

		const holeMessiness = $('simulateAttackHoleMessiness');
		if (holeMessiness) {
			holeMessiness.addEventListener('input', updateValueDisplays);
			holeMessiness.addEventListener('change', () => {
				saveSettings();
				applyHoleMessiness();
			});
		}

		const reset = $('simulateAttackResetBtn');
		if (reset) {
			reset.addEventListener('click', () => {
				resetQueue();
			});
		}
	}

	function init() {
		if (!root.ZZReplayEngine?.GarbageQueue) {
			console.warn('attack simulator unavailable: replay engine missing');
			return;
		}
		if (typeof root.addGarbageRows !== 'function') {
			console.warn('attack simulator unavailable: addGarbageRows missing');
			return;
		}
		bindUi();
		createQueue();
		applyLoadedSettings(loadSettings() || DEFAULT_SETTINGS);
		window.addEventListener('storage', (event) => {
			if (event.key !== STORAGE_KEY && event.key !== null) return;
			applyLoadedSettings(loadSettings() || DEFAULT_SETTINGS);
		});
	}

	root.ZZAttackSim = {
		afterLock,
		onRestart,
		isActive: () => enabled,
		resetQueue,
		getPendingEntries: () =>
			queue
				? queue.queue.map((entry) => ({
						amount: entry.amount,
						frame: entry.frame,
						cid: entry.cid,
					}))
				: [],
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})(typeof globalThis !== 'undefined' ? globalThis : this);
