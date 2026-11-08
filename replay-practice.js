// Loads a captured TETR.IO replay state into the main practice page.
// The viewer stores the state in sessionStorage and opens
// index.html?replayPractice=1. base.js calls loadFromSession() before its
// normal newPiece() initialization.
(function (root) {
	'use strict';

	const C = root.ZZReplayCommon;
	const STORAGE_KEY = 'zztetris_replay_practice';
	const FRAME_MS = 1000 / 60;

	let active = false;
	let state = null;
	let engine = null;
	let garbageQueue = null;
	let initial = null;
	let practiceStartTime = 0;
	let practiceStartFrame = 0;
	let gravityBase = 700;
	let dynamicTimer = null;

	function $(id) {
		return document.getElementById(id);
	}

	// Replay practice defaults to free hold. The replay's hold lock is only
	// applied when the user opts in, so they can hold the captured piece.
	function lockHoldEnabled() {
		return !!$('replayLockHold')?.checked;
	}

	function loadFromSession() {
		const params = new URLSearchParams(location.search);
		if (params.get('replayPractice') !== '1') return false;
		let raw;
		try {
			raw = sessionStorage.getItem(STORAGE_KEY);
		} catch (error) {
			raw = null;
		}
		if (!raw) return false;
		let saved;
		try {
			saved = JSON.parse(raw);
		} catch (error) {
			return false;
		}
		try {
			applyState(saved);
			return true;
		} catch (error) {
			console.error('replay practice load failed', error);
			return false;
		}
	}

	function applyState(saved) {
		state = saved;
		const config = JSON.parse(JSON.stringify(saved.config));
		if (config.misc && config.misc.date) {
			config.misc.date = new Date(config.misc.date);
		}
		config.multiplayer = undefined;
		config.misc.allowed.undo = false;
		config.misc.allowed.retry = false;
		engine = new root.ZZReplayEngine.Engine(config);
		engine.fromSnapshot(saved.snapshot);

		board = convertBoard(engine.board.state);
		piece = engine.falling.symbol.toUpperCase();
		const placement = C.findZztetrisPlacementOnBoard(
			piece,
			engine.falling.absoluteBlocks,
			boardSize[1]
		);
		if (placement) {
			xPOS = placement.x;
			yPOS = placement.y;
			rot = placement.rot;
		} else {
			xPOS = spawn[0];
			yPOS = spawn[1];
			rot = 0;
		}
		queue = convertQueue(engine.queue.raw());
		holdP = engine.held ? engine.held.toUpperCase() : '';
		held = false;
		replayFreeHold = !lockHoldEnabled();
		replayHoldLocked = !!engine.holdLocked && !replayFreeHold;

		combo = Number(engine.stats.combo);
		b2b = Math.max(0, Number(engine.stats.b2b));
		oldcombo = combo;
		oldb2b = b2b;

		const kickName = engine.kickTableName;
		if (typeof kicksets !== 'undefined' && kicksets[kickName]) {
			kicks = kicksets[kickName];
		}

		gravityBase = gravityFromEngine(engine);
		zzGravityMs = gravityBase;

		garbageQueue = new root.ZZReplayEngine.GarbageQueue(
			engine.garbageQueue.options
		);
		garbageQueue.fromSnapshot(engine.garbageQueue.snapshot());

		practiceStartTime = Date.now();
		practiceStartFrame = engine.frame;

		const trackerState = saved.tracker || {};
		if (root.ZZStats) {
			root.ZZStats.restore(trackerState);
			root.ZZStats.restoreAttackDisplay(
				trackerState.lastAttack || 0,
				engine.spike ? engine.spike.count : 0
			);
			const statsState = root.ZZStats.getState();
			if (statsState) {
				statsState.startTime = Date.now() - (engine.frame / 60) * 1000;
				statsState.garbageSent = Number(engine.stats.garbage.sent) || 0;
			}
		}

		hist = [
			{
				board: JSON.stringify(board),
				queue: JSON.stringify(queue),
				hold: holdP,
				piece: piece,
				stats: root.ZZStats?.snapshot(),
			},
		];
		histPos = 0;

		initial = {
			board: JSON.stringify(board),
			queue: JSON.stringify(queue),
			holdP,
			piece,
			xPOS,
			yPOS,
			rot,
			combo,
			b2b,
			oldcombo,
			oldb2b,
			gravity: gravityBase,
			garbage: garbageQueue.snapshot(),
			stats: root.ZZStats?.snapshot(),
			lastAttack: trackerState.lastAttack || 0,
			spike: engine.spike ? engine.spike.count : 0,
			frame: engine.frame,
			elapsedMs: (engine.frame / 60) * 1000,
		};

		clearActive();
		updateGhost();
		setShape();
		updateQueue();
		syncEvalChainInputsFromGame?.();
		active = true;
		document.body.classList.add('replay-practice');
		updateGravityControls();
		updateGarbageMeter();
		updateStatus();
		startDynamicTimer();
	}

	function convertBoard(engineBoard) {
		const height = engineBoard.length;
		const out = [];
		for (let y = 0; y < boardSize[1]; y++) {
			const engineY = height - 1 - y;
			const row = [];
			for (let x = 0; x < boardSize[0]; x++) {
				const cell = engineBoard[engineY]?.[x];
				if (!cell) {
					row.push({ t: 0, c: '' });
				} else if (cell.mino === 'gb' || cell.mino === 'bomb') {
					row.push({ t: 1, c: 'X' });
				} else {
					row.push({ t: 1, c: String(cell.mino).toUpperCase() });
				}
			}
			out.push(row);
		}
		return out;
	}

	function convertQueue(raw) {
		const out = [];
		for (let i = 0; i < raw.length; i++) {
			out.push(String(raw[i]).toUpperCase());
			if ((i + 1) % 7 === 0) out.push('|');
		}
		return out;
	}

	function gravityFromEngine(eng) {
		const value = eng.dynamic.gravity.get();
		if (!Number.isFinite(value) || value <= 0) return 1000;
		return Math.max(0, Math.min(2000, 1000 / (value * 60)));
	}

	function practiceFrame() {
		return (
			practiceStartFrame +
			Math.floor((Date.now() - practiceStartTime) / FRAME_MS)
		);
	}

	function afterLock(info) {
		if (!active || !garbageQueue) return;
		const cleared = Number(info?.cleared) || 0;
		const attack = Math.max(0, Math.floor(Number(info?.attack) || 0));
		const frame = practiceFrame();
		if (cleared > 0) {
			const multiplier = engine.dynamic.garbageMultiplier.get();
			const amount = Math.max(0, Math.floor(attack * multiplier));
			if (amount > 0) {
				const pieces = root.ZZStats?.getState()?.pieces || 0;
				const legacyOpener =
					(engine.misc.date ?? new Date()) < new Date(2025, 1, 16);
				garbageQueue.cancel(amount, pieces, {
					openerPhase: legacyOpener,
				});
			}
		} else {
			const cap = engine.dynamic.garbageCap.get();
			const rows = garbageQueue.tank(frame, cap, true);
			for (const row of rows) {
				addGarbageRows(row.column, row.amount, row.size);
			}
		}
		updateGarbageMeter();
	}

	function restart() {
		if (!active || !initial) return false;
		board = JSON.parse(initial.board);
		queue = JSON.parse(initial.queue);
		holdP = initial.holdP;
		held = false;
		replayFreeHold = !lockHoldEnabled();
		replayHoldLocked = !!engine.holdLocked && !replayFreeHold;
		piece = initial.piece;
		xPOS = initial.xPOS;
		yPOS = initial.yPOS;
		rot = initial.rot;
		combo = initial.combo;
		b2b = initial.b2b;
		oldcombo = initial.oldcombo;
		oldb2b = initial.oldb2b;
		zzGravityMs = initial.gravity;
		gravityBase = initial.gravity;
		garbageQueue.fromSnapshot(initial.garbage);
		if (root.ZZStats) {
			root.ZZStats.restore(initial.stats);
			root.ZZStats.restoreAttackDisplay(initial.lastAttack, initial.spike);
			const statsState = root.ZZStats.getState();
			if (statsState) {
				statsState.startTime = Date.now() - initial.elapsedMs;
				statsState.garbageSent = Number(engine.stats.garbage.sent) || 0;
			}
		}
		hist = [
			{
				board: JSON.stringify(board),
				queue: JSON.stringify(queue),
				hold: holdP,
				piece: piece,
				stats: root.ZZStats?.snapshot(),
			},
		];
		histPos = 0;
		practiceStartTime = Date.now();
		practiceStartFrame = initial.frame;
		clearActive();
		updateGhost();
		setShape();
		updateQueue();
		syncEvalChainInputsFromGame?.();
		updateGravityControls();
		updateGarbageMeter();
		updateStatus();
		return true;
	}

	function isActive() {
		return active;
	}

	function updateGarbageMeter() {
		updateGarbageMeterDisplay(garbageQueue ? garbageQueue.size : 0);
	}

	function updateStatus() {
		const status = $('replayPracticeStatus');
		const sourceEl = $('replayPracticeSource');
		if (!status || !sourceEl) return;
		if (!active || !state?.source) {
			status.hidden = true;
			return;
		}
		status.hidden = false;
		const source = state.source;
		const parts = [];
		if (source.playerName) parts.push(source.playerName);
		if (Number.isFinite(source.roundIndex)) {
			parts.push(`Round ${source.roundIndex + 1}`);
		}
		if (Number.isFinite(source.timeMs)) {
			parts.push(C.formatTime(source.timeMs / 1000));
		}
		sourceEl.textContent = `REPLAY · ${parts.join(' · ')}`;
	}

	function updateGravityControls() {
		const slider = $('practiceGravityMultiplier');
		const input = $('practiceGravityMs');
		const label = $('practiceGravityValue');
		if (input) input.value = String(Math.round(gravityBase));
		if (slider) slider.value = '1';
		if (label) label.textContent = '1×';
	}

	function bindGravityControls() {
		const slider = $('practiceGravityMultiplier');
		const input = $('practiceGravityMs');
		const label = $('practiceGravityValue');
		if (!slider || !input || !label) return;
		gravityBase = Number(zzGravityMs) || 700;
		input.value = String(Math.round(gravityBase));
		slider.addEventListener('input', () => {
			const multiplier = Number(slider.value) || 1;
			zzGravityMs = Math.max(0, gravityBase / multiplier);
			input.value = String(Math.round(zzGravityMs));
			label.textContent = `${multiplier}×`;
		});
		input.addEventListener('change', () => {
			const value = Number(input.value);
			if (!Number.isFinite(value)) return;
			zzGravityMs = Math.max(0, value);
			gravityBase = zzGravityMs;
			slider.value = '1';
			label.textContent = '1×';
		});
	}

	function startDynamicTimer() {
		if (dynamicTimer) clearInterval(dynamicTimer);
		dynamicTimer = setInterval(() => {
			if (!active || !engine) return;
			engine.dynamic.garbageMultiplier.tick();
			engine.dynamic.garbageCap.tick();
		}, FRAME_MS);
	}

	function bindStatusButtons() {
		const reset = $('replayPracticeResetBtn');
		if (reset) reset.addEventListener('click', () => restart());
		const exit = $('replayPracticeExitBtn');
		if (exit) {
			exit.addEventListener('click', (event) => {
				event.preventDefault();
				try {
					sessionStorage.removeItem(STORAGE_KEY);
				} catch (error) {
					// ignore
				}
				location.href = 'index.html';
			});
		}
		const lockHold = $('replayLockHold');
		if (lockHold) {
			lockHold.addEventListener('change', () => {
				if (!active) return;
				replayFreeHold = !lockHold.checked;
				replayHoldLocked = lockHold.checked && !!engine.holdLocked;
			});
		}
	}

	bindGravityControls();
	bindStatusButtons();

	root.ZZReplayPractice = {
		loadFromSession,
		afterLock,
		restart,
		isActive,
		updateGarbageMeter,
	};
})(typeof globalThis !== 'undefined' ? globalThis : this);
