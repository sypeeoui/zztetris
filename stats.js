// Session stats panel, finesse tracking, reset actions and finesse-fault sound.
// Game logic calls into window.ZZStats at a few well-defined points.
(function (root) {
	'use strict';

	const configApi = root.ZZStatsConfig;
	const core = root.ZZStatsCore;
	if (!configApi || !core) return;

	let config = configApi.loadConfig();
	let state = core.createState(Date.now());
	let finesseTable = null;
	const soundCache = {};

	function buildFinesseTable() {
		try {
			if (typeof pieces === 'undefined' || typeof kicksets === 'undefined') return null;
			const spawnX = typeof spawn !== 'undefined' ? spawn[0] : 3;
			return core.buildFinesseTable(pieces, kicksets, spawnX, 'SRS+');
		} catch (error) {
			console.warn('finesse table unavailable:', error);
			return null;
		}
	}

	function playFinesseSound() {
		if (!config.finesseSound) return;
		const name = config.finesseSoundName || 'FinesseFault';
		try {
			const sound = soundCache[name] || (soundCache[name] = new Audio('assets/sfx/' + name + '.wav'));
			sound.currentTime = 0;
			sound.volume = (typeof audiolevel === 'number' ? audiolevel : 100) / 100;
			const promise = sound.play();
			if (promise && typeof promise.catch === 'function') promise.catch(() => {});
		} catch (error) {
			// Audio can be blocked before the first user gesture; ignore.
		}
	}

	function buildPanel() {
		const panel = document.getElementById('sessionPanel');
		if (!panel) return;
		panel.style.display = config.showPanel ? '' : 'none';

		const statsEl = document.getElementById('sessionStats');
		if (!statsEl) return;
		statsEl.innerHTML = '';

		const visible = new Set(config.visibleStats);
		for (const def of configApi.STAT_DEFS) {
			if (!visible.has(def.id)) continue;
			const row = document.createElement('div');
			row.className = 'session-stat';
			row.dataset.statId = def.id;

			const label = document.createElement('span');
			label.className = 'session-stat-label';
			label.textContent = def.label;

			const value = document.createElement('span');
			value.className = 'session-stat-value';
			value.textContent = '—';

			row.appendChild(label);
			row.appendChild(value);
			statsEl.appendChild(row);
		}

		if (!statsEl.children.length) {
			const empty = document.createElement('div');
			empty.className = 'session-stat-empty';
			empty.textContent = 'No stats selected';
			statsEl.appendChild(empty);
		}

	}

	function updatePanel() {
		const comboEl = document.getElementById('sessionCombo');
		const b2bEl = document.getElementById('sessionB2B');
		const comboValue = Math.max(0, typeof combo === 'number' ? combo : 0);
		const b2bValue = Math.max(0, typeof b2b === 'number' ? b2b : 0);

		if (comboEl) {
			comboEl.textContent = String(comboValue);
			comboEl.classList.toggle('session-chain-value--active', comboValue > 0);
		}
		if (b2bEl) {
			b2bEl.textContent = String(b2bValue);
			b2bEl.classList.toggle('session-chain-value--active', b2bValue > 0);
		}

		const statsEl = document.getElementById('sessionStats');
		if (!statsEl) return;
		const now = Date.now();
		for (const row of statsEl.children) {
			const id = row.dataset.statId;
			if (!id) continue;
			const valueEl = row.querySelector('.session-stat-value');
			if (!valueEl) continue;
			const value = core.getStatValue(state, id, now, { combo: comboValue, b2b: b2bValue });
			const text = core.formatStat(id, value, configApi.STAT_DEFS);
			if (valueEl.textContent !== text) valueEl.textContent = text;
		}
	}

	function onNewPiece(piece) {
		state.currentPiece = piece;
		state.currentInputs = 0;
		state.softDropExempt = false;
	}

	const GAMEPLAY_KEYS = new Set(['L', 'R', 'SD', 'HD', 'HL', 'CW', 'CCW', 'R180']);
	const FINESSE_KEYS = new Set(['L', 'R', 'CW', 'CCW']);

	function onKeyDown(action) {
		if (!GAMEPLAY_KEYS.has(action)) return;
		state.keys += 1;
		if (FINESSE_KEYS.has(action)) {
			state.currentInputs += 1;
		} else if (action === 'R180') {
			// TETR.IO counts a 180 as two inputs, the same as two 90° rotations.
			state.currentInputs += 2;
		}
	}

	function onKeyUp(action) {
		// TETR.IO exempts a piece from finesse scoring when soft drop is
		// released while that piece is falling.
		if (action === 'SD') state.softDropExempt = true;
	}

	function onHold() {
		state.holds += 1;
		// The incoming piece starts a fresh finesse count and soft-drop state.
		state.currentInputs = 0;
		state.softDropExempt = false;
	}

	function onPlacement(info) {
		const shapeKey =
			typeof pieces !== 'undefined'
				? core.shapeKeyForPlacement(pieces, info.piece, info.rot, info.x, info.y)
				: null;
		const skipFinesse =
			typeof evalState !== 'undefined' && !!evalState && !!evalState.playbackInFlight;
		const isSpin = !!(info.tspin || info.allspinMini);
		const result = core.applyPlacement(
			state,
			Object.assign({}, info, {
				shapeKey,
				skipFinesse,
				isSpin,
				exemptSpins: config.exemptSpins,
			}),
			finesseTable
		);
		if (result.fault) playFinesseSound();
		updatePanel();
	}

	const TRANSIENT_STATE_KEYS = new Set([
		'startTime',
		'currentInputs',
		'currentPiece',
		'softDropExempt',
		'lastFinesseFault',
	]);

	// A history snapshot keeps the session counters but not the transient
	// per-piece state or the session start time.
	function snapshot() {
		const copy = {};
		for (const key of Object.keys(state)) {
			if (TRANSIENT_STATE_KEYS.has(key)) continue;
			copy[key] = state[key];
		}
		return copy;
	}

	function restore(saved) {
		if (!saved) return;
		for (const key of Object.keys(saved)) {
			if (key in state) state[key] = saved[key];
		}
		state.currentInputs = 0;
		state.softDropExempt = false;
		state.lastFinesseFault = false;
		updatePanel();
	}

	function resetSession() {
		core.resetState(state, Date.now());
		// The chain is part of the session, so reset it too.
		if (typeof combo !== 'undefined') {
			combo = -1;
			oldcombo = -1;
		}
		if (typeof b2b !== 'undefined') {
			b2b = 0;
			oldb2b = 0;
		}
		if (typeof syncEvalChainInputsFromGame === 'function') syncEvalChainInputsFromGame();
		updatePanel();
	}

	function onRestart() {
		resetSession();
	}

	function resetQueue() {
		if (typeof shuffleQueue === 'function') shuffleQueue();
	}

	function resetQueueHold() {
		if (typeof shuffleQueuePlusHold === 'function') shuffleQueuePlusHold();
	}

	function addGarbageReceived(lines) {
		const amount = Math.max(0, Math.floor(Number(lines) || 0));
		if (amount > 0) state.garbageReceived += amount;
	}

	function installGarbageHooks() {
		if (typeof root.garbage === 'function' && !root.garbage.__zzStatsWrapped) {
			const original = root.garbage;
			const wrapped = function (column, amount = 1) {
				addGarbageReceived(amount);
				return original.apply(this, arguments);
			};
			wrapped.__zzStatsWrapped = true;
			root.garbage = wrapped;
		}

		if (typeof root.addPracticeGarbageUI === 'function' && !root.addPracticeGarbageUI.__zzStatsWrapped) {
			const original = root.addPracticeGarbageUI;
			const wrapped = function () {
				const input = document.getElementById('practiceLayers');
				addGarbageReceived(input ? parseInt(input.value, 10) || 1 : 1);
				return original.apply(this, arguments);
			};
			wrapped.__zzStatsWrapped = true;
			root.addPracticeGarbageUI = wrapped;
		}
	}

	function wireResetButtons() {
		const bindings = [
			['resetSessionBtn', resetSession],
			['resetQueueBtn', resetQueue],
			['resetQueueHoldBtn', resetQueueHold],
		];
		for (const [id, handler] of bindings) {
			const button = document.getElementById(id);
			if (!button) continue;
			button.addEventListener('click', () => {
				button.blur();
				handler();
			});
		}
	}

	function refreshConfig() {
		config = configApi.loadConfig();
		buildPanel();
		updatePanel();
	}

	function init() {
		finesseTable = buildFinesseTable();
		buildPanel();
		wireResetButtons();
		installGarbageHooks();
		updatePanel();
		setInterval(updatePanel, 100);
	}

	root.ZZStats = {
		onNewPiece,
		onKeyDown,
		onKeyUp,
		onHold,
		onPlacement,
		onRestart,
		snapshot,
		restore,
		resetSession,
		resetQueue,
		resetQueueHold,
		refreshConfig,
		getState: () => state,
		getFinesseTable: () => finesseTable,
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})(typeof globalThis !== 'undefined' ? globalThis : this);
