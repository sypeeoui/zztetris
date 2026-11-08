// TETR.IO match replay viewer.
(function () {
	'use strict';

	const C = window.ZZReplayCommon;
	const state = {
		replay: null,
		fileName: '',
		roundIndex: 0,
		entries: [],
		keyframes: [],
		currentFrame: 0,
		maxFrame: 0,
		playing: false,
		speed: 1,
		lastTime: 0,
		accumulator: 0,
		statsConfig: C.loadReplayStatsConfig(),
		statsScope: 'all',
		cards: new Map(),
		lastStatsUpdate: 0,
	};

	const els = {
		dropZone: document.getElementById('dropZone'),
		replayView: document.getElementById('replayView'),
		fileInput: document.getElementById('fileInput'),
		chooseFileBtn: document.getElementById('chooseFileBtn'),
		pasteReplayBtn: document.getElementById('pasteReplayBtn'),
		loadReplayBtn: document.getElementById('loadReplayBtn'),
		statsSettingsBtn: document.getElementById('statsSettingsBtn'),
		statsSettings: document.getElementById('statsSettings'),
		statsCloseBtn: document.getElementById('statsCloseBtn'),
		statsScope: document.getElementById('statsScope'),
		statsCheckboxes: document.getElementById('statsCheckboxes'),
		statsSelectAllBtn: document.getElementById('statsSelectAllBtn'),
		statsClearBtn: document.getElementById('statsClearBtn'),
		statsResetBtn: document.getElementById('statsResetBtn'),
		matchHeader: document.getElementById('matchHeader'),
		roundTabs: document.getElementById('roundTabs'),
		playerGrid: document.getElementById('playerGrid'),
		playPauseBtn: document.getElementById('playPauseBtn'),
		stepBackSecBtn: document.getElementById('stepBackSecBtn'),
		stepBackBtn: document.getElementById('stepBackBtn'),
		stepForwardBtn: document.getElementById('stepForwardBtn'),
		stepForwardSecBtn: document.getElementById('stepForwardSecBtn'),
		seekSlider: document.getElementById('seekSlider'),
		timeDisplay: document.getElementById('timeDisplay'),
		speedSelect: document.getElementById('speedSelect'),
		frameDisplay: document.getElementById('frameDisplay'),
		roundDisplay: document.getElementById('roundDisplay'),
		replayError: document.getElementById('replayError'),
	};

	function init() {
		bindEvents();
		requestAnimationFrame(loop);
		const params = new URLSearchParams(location.search);
		const url = params.get('replay');
		if (url) {
			fetch(url)
				.then((response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.text();
				})
				.then((text) => loadReplayText(text, url.split('/').pop() || 'replay.ttrm'))
				.catch((error) => showError(`Could not load replay URL: ${error.message}`));
		}
	}

	function bindEvents() {
		els.chooseFileBtn.addEventListener('click', () => els.fileInput.click());
		els.loadReplayBtn.addEventListener('click', () => els.fileInput.click());
		els.fileInput.addEventListener('change', async () => {
			const file = els.fileInput.files && els.fileInput.files[0];
			if (!file) return;
			const text = await file.text();
			loadReplayText(text, file.name);
			els.fileInput.value = '';
		});
		els.pasteReplayBtn.addEventListener('click', async () => {
			try {
				const text = await navigator.clipboard.readText();
				loadReplayText(text, 'pasted.ttrm');
			} catch (error) {
				const text = prompt('Paste replay JSON');
				if (text) loadReplayText(text, 'pasted.ttrm');
			}
		});

		document.addEventListener('dragover', (event) => {
			event.preventDefault();
		});
		document.addEventListener('drop', async (event) => {
			event.preventDefault();
			const file = event.dataTransfer?.files?.[0];
			if (!file) return;
			const text = await file.text();
			loadReplayText(text, file.name);
		});

		els.playPauseBtn.addEventListener('click', togglePlay);
		els.stepBackBtn.addEventListener('click', () => {
			pause();
			seek(state.currentFrame - 1);
		});
		els.stepForwardBtn.addEventListener('click', () => {
			pause();
			seek(state.currentFrame + 1);
		});
		els.stepBackSecBtn.addEventListener('click', () => {
			pause();
			seek(state.currentFrame - 60);
		});
		els.stepForwardSecBtn.addEventListener('click', () => {
			pause();
			seek(state.currentFrame + 60);
		});
		els.seekSlider.addEventListener('input', () => {
			pause();
			seek(Number(els.seekSlider.value));
		});
		els.speedSelect.addEventListener('change', () => {
			state.speed = Number(els.speedSelect.value) || 1;
		});

		els.statsSettingsBtn.addEventListener('click', openStatsSettings);
		els.statsCloseBtn.addEventListener('click', closeStatsSettings);
		els.statsSettings.addEventListener('click', (event) => {
			if (event.target === els.statsSettings) closeStatsSettings();
		});
		els.statsScope.addEventListener('change', () => {
			state.statsScope = els.statsScope.value;
			renderStatsSettings();
		});
		els.statsSelectAllBtn.addEventListener('click', () => {
			const list = getScopeList();
			list.length = 0;
			for (const def of window.ZZStatsConfig.STAT_DEFS) list.push(def.id);
			saveStatsConfig();
			renderStatsSettings();
			applyStatsConfig();
		});
		els.statsClearBtn.addEventListener('click', () => {
			const list = getScopeList();
			list.length = 0;
			saveStatsConfig();
			renderStatsSettings();
			applyStatsConfig();
		});
		els.statsResetBtn.addEventListener('click', () => {
			state.statsConfig.global = window.ZZStatsConfig.loadConfig().visibleStats.slice();
			state.statsConfig.players = {};
			saveStatsConfig();
			renderStatsSettings();
			applyStatsConfig();
		});

		window.addEventListener('keydown', handleKeydown);
	}

	function handleKeydown(event) {
		const tag = event.target?.tagName;
		if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
		if (!state.replay) return;
		if (event.code === 'Space') {
			event.preventDefault();
			togglePlay();
		} else if (event.code === 'ArrowLeft') {
			event.preventDefault();
			pause();
			seek(state.currentFrame - (event.shiftKey ? 60 : 1));
		} else if (event.code === 'ArrowRight') {
			event.preventDefault();
			pause();
			seek(state.currentFrame + (event.shiftKey ? 60 : 1));
		} else if (event.code === 'Home') {
			event.preventDefault();
			pause();
			seek(0);
		} else if (event.code === 'End') {
			event.preventDefault();
			pause();
			seek(state.maxFrame);
		} else if (event.code === 'BracketLeft') {
			event.preventDefault();
			changeSpeed(-1);
		} else if (event.code === 'BracketRight') {
			event.preventDefault();
			changeSpeed(1);
		} else if (event.code === 'Escape') {
			closeStatsSettings();
		}
	}

	function changeSpeed(direction) {
		const speeds = [0.25, 0.5, 1, 2, 4, 8];
		let index = speeds.indexOf(state.speed);
		if (index === -1) index = 2;
		index = Math.max(0, Math.min(speeds.length - 1, index + direction));
		state.speed = speeds[index];
		els.speedSelect.value = String(state.speed);
	}

	function showError(message) {
		closeStatsSettings();
		els.replayError.textContent = message;
		els.replayError.hidden = false;
		els.dropZone.hidden = false;
		els.replayView.hidden = true;
	}

	function loadReplayText(text, name) {
		try {
			const replay = C.parseReplay(text);
			state.replay = replay;
			state.fileName = name || 'replay.ttrm';
			state.statsConfig = C.loadReplayStatsConfig();
			state.statsScope = 'all';
			els.replayError.hidden = true;
			els.dropZone.hidden = true;
			els.replayView.hidden = false;
			buildMatchHeader();
			buildRoundTabs();
			selectRound(0);
		} catch (error) {
			showError(error.message);
		}
	}

	function soloGameLabel(gametype, customtype) {
		const labels = {
			'40l': '40 Lines',
			blitz: 'Blitz',
			custom: 'Custom',
			league: 'Tetra League',
		};
		const label = labels[gametype] || 'Solo';
		return customtype ? `${label} (${customtype})` : label;
	}

	function buildMatchHeader() {
		const replay = state.replay;
		els.matchHeader.innerHTML = '';
		const title = document.createElement('div');
		title.className = 'replay-match-title';
		title.textContent = state.fileName;
		const meta = document.createElement('div');
		meta.className = 'replay-match-meta';
		const mode =
			replay.kind === 'solo'
				? soloGameLabel(replay.gamemode, replay.customtype)
				: replay.gamemode === 'league'
					? 'Tetra League'
					: 'Match';
		const date = replay.ts ? new Date(replay.ts).toLocaleString() : '';
		meta.textContent = [mode, date].filter(Boolean).join(' · ');
		const score = document.createElement('div');
		score.className = 'replay-match-score';
		if (replay.kind === 'solo') {
			const player = replay.rounds[0]?.players[0];
			const final = player?.finalStats;
			const parts = [player?.username || 'Player'];
			if (final) {
				parts.push(C.formatTime((final.finalTimeMs || 0) / 1000));
				if (final.lines) parts.push(`${final.lines} lines`);
			}
			score.textContent = parts.join('  —  ');
		} else {
			const leaderboard = replay.leaderboard || [];
			if (leaderboard.length) {
				score.textContent = leaderboard
					.map((entry) => `${entry.username} ${entry.wins ?? 0}`)
					.join('  —  ');
			}
		}
		els.matchHeader.appendChild(title);
		els.matchHeader.appendChild(meta);
		if (score.textContent) els.matchHeader.appendChild(score);
	}

	function buildRoundTabs() {
		els.roundTabs.innerHTML = '';
		if (state.replay.kind === 'solo') {
			els.roundTabs.hidden = true;
			return;
		}
		els.roundTabs.hidden = false;
		state.replay.rounds.forEach((round, index) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'button replay-round-tab';
			button.dataset.round = String(index);
			const label = document.createElement('span');
			label.textContent = `Round ${index + 1}`;
			button.appendChild(label);
			if (round.winner) {
				const winner = document.createElement('span');
				winner.className = 'replay-round-winner';
				winner.textContent = round.winner.username;
				button.appendChild(winner);
			}
			button.addEventListener('click', () => selectRound(index));
			els.roundTabs.appendChild(button);
		});
	}

	function updateRoundTabs() {
		for (const button of els.roundTabs.children) {
			button.classList.toggle(
				'active',
				Number(button.dataset.round) === state.roundIndex
			);
		}
	}

	function selectRound(index) {
		if (!state.replay || !state.replay.rounds[index]) return;
		pause();
		destroyEntries();
		state.roundIndex = index;
		const round = state.replay.rounds[index];
		state.entries = C.createRoundEngines(round);
		state.maxFrame = round.maxFrame;
		state.keyframes = [];
		state.currentFrame = 0;
		buildPlayerGrid();
		for (const entry of state.entries) C.tickPlayer(entry, 0);
		state.keyframes.push(C.buildKeyframe(state.entries, 0));
		state.lastStatsUpdate = 0;
		updateRoundTabs();
		updatePlaybackUi();
		renderAll();
	}

	function destroyEntries() {
		for (const entry of state.entries) entry.tracker.destroy();
		state.entries = [];
		state.cards.clear();
		els.playerGrid.innerHTML = '';
	}

	function buildPlayerGrid() {
		els.playerGrid.innerHTML = '';
		state.cards.clear();
		const cellSize = 20;
		for (const entry of state.entries) {
			const player = entry.player;
			const card = document.createElement('div');
			card.className = 'replay-player-card';
			card.dataset.playerId = player.id;

			const header = document.createElement('div');
			header.className = 'replay-player-header';
			const name = document.createElement('span');
			name.className = 'replay-player-name';
			name.textContent = player.username;
			const result = document.createElement('span');
			result.className = 'replay-player-result';
			const reason = player.results?.gameoverreason;
			result.textContent =
				reason === 'winner'
					? 'Winner'
					: reason === 'topout'
						? 'Top out'
						: reason === 'garbagesmash'
							? 'Garbage smash'
							: player.alive
								? 'Alive'
								: 'Out';
			result.classList.toggle('winner', reason === 'winner');
			const practice = document.createElement('button');
			practice.type = 'button';
			practice.className = 'button replay-practice-btn';
			practice.textContent = 'Practice this state';
			practice.addEventListener('click', () => practicePlayer(player.id));
			header.appendChild(name);
			header.appendChild(result);
			header.appendChild(practice);

			const body = document.createElement('div');
			body.className = 'replay-player-body';

			// Left column: hold on top, session stats underneath.
			const left = document.createElement('div');
			left.className = 'left-column replay-left-column';
			const holdWrap = document.createElement('div');
			holdWrap.className = 'queue';
			holdWrap.innerHTML = 'HOLD<hr />';
			const hold = document.createElement('canvas');
			hold.width = 90;
			hold.height = 60;
			holdWrap.appendChild(hold);
			left.appendChild(holdWrap);

			const sessionPanel = document.createElement('div');
			sessionPanel.className = 'session-panel';
			const statsPanel = new C.StatsPanel(sessionPanel, {
				showHeader: true,
				showChain: true,
				showAttack: true,
			});
			statsPanel.setVisibleStats(
				C.getVisibleStats(state.statsConfig, player.id)
			);
			left.appendChild(sessionPanel);

			// Garbage meter immediately left of the board.
			const boardStack = document.createElement('div');
			boardStack.className = 'replay-board-stack';
			const meter = document.createElement('div');
			meter.className = 'replay-garbage-meter';
			meter.title = 'Pending garbage';
			const meterFill = document.createElement('div');
			meterFill.className = 'replay-garbage-fill';
			const meterCount = document.createElement('span');
			meterCount.className = 'replay-garbage-count';
			meterCount.textContent = '0';
			meter.appendChild(meterFill);
			meter.appendChild(meterCount);

			const boardColumn = document.createElement('div');
			boardColumn.className = 'replay-board-column';
			const board = document.createElement('canvas');
			board.className = 'replay-board';
			boardColumn.appendChild(board);
			boardStack.appendChild(meter);
			boardStack.appendChild(boardColumn);

			// Right column: next queue.
			const right = document.createElement('div');
			right.className = 'queue replay-right-column';
			right.innerHTML = 'NEXT<hr />';
			const queue = document.createElement('canvas');
			queue.width = 90;
			queue.height = 360;
			right.appendChild(queue);

			body.appendChild(left);
			body.appendChild(boardStack);
			body.appendChild(right);
			card.appendChild(header);
			card.appendChild(body);
			els.playerGrid.appendChild(card);

			state.cards.set(player.id, {
				cellSize,
				board,
				hold,
				queue,
				meterFill,
				meterCount,
				statsPanel,
			});
		}
	}

	function stepOneFrame() {
		if (state.currentFrame >= state.maxFrame) {
			pause();
			return;
		}
		state.currentFrame++;
		for (const entry of state.entries) {
			C.tickPlayer(entry, state.currentFrame);
		}
		if (
			state.currentFrame % C.KEYFRAME_INTERVAL === 0 &&
			!state.keyframes.some((keyframe) => keyframe.frame === state.currentFrame)
		) {
			state.keyframes.push(
				C.buildKeyframe(state.entries, state.currentFrame)
			);
			state.keyframes.sort((a, b) => a.frame - b.frame);
		}
		updatePlaybackUi();
	}

	function seek(frame) {
		if (!state.replay) return;
		const target = Math.max(
			0,
			Math.min(state.maxFrame, Math.floor(Number(frame) || 0))
		);
		if (target === state.currentFrame) {
			renderAll();
			return;
		}
		if (target < state.currentFrame) {
			const keyframe = C.findKeyframe(state.keyframes, target);
			if (keyframe) {
				C.restoreKeyframe(state.entries, keyframe);
				state.currentFrame = keyframe.frame;
			} else {
				selectRound(state.roundIndex);
			}
		}
		while (state.currentFrame < target) stepOneFrame();
		state.lastStatsUpdate = 0;
		renderAll();
	}

	function play() {
		if (!state.replay) return;
		if (state.currentFrame >= state.maxFrame) {
			seek(0);
		}
		state.playing = true;
		state.lastTime = performance.now();
		state.accumulator = 0;
		updatePlayPauseButton();
	}

	function pause() {
		state.playing = false;
		updatePlayPauseButton();
	}

	function togglePlay() {
		if (state.playing) pause();
		else play();
	}

	function updatePlayPauseButton() {
		els.playPauseBtn.textContent = state.playing ? 'Pause' : 'Play';
	}

	function loop(now) {
		if (state.playing) {
			const delta = now - state.lastTime;
			state.accumulator += delta * state.speed;
			let ticks = 0;
			while (state.accumulator >= C.FRAME_MS && ticks < 16) {
				stepOneFrame();
				state.accumulator -= C.FRAME_MS;
				ticks++;
				if (state.currentFrame >= state.maxFrame) {
					pause();
					break;
				}
			}
			if (state.accumulator > C.FRAME_MS * 16) state.accumulator = 0;
		}
		state.lastTime = now;
		renderAll();
		requestAnimationFrame(loop);
	}

	function renderAll() {
		if (!state.replay) return;
		const now = performance.now();
		const updateStats = now - state.lastStatsUpdate > 100;
		if (updateStats) state.lastStatsUpdate = now;
		for (const entry of state.entries) {
			const card = state.cards.get(entry.player.id);
			if (!card) continue;
			C.renderBoard(card.board, entry.engine, { cellSize: card.cellSize });
			C.renderQueue(card.queue, entry.engine, 6, 20, 90);
			C.renderHold(card.hold, entry.engine, 20, 90, 60);
			const pending = entry.engine.garbageQueue.size;
			const maxLines = entry.engine.board.height + 3;
			const lines = Math.min(pending, maxLines);
			card.meterFill.style.height = `${(lines / maxLines) * 100}%`;
			card.meterCount.textContent = String(pending);
			if (updateStats) {
				const isFinal = state.currentFrame >= entry.player.frames;
				card.statsPanel.update(
					entry.tracker,
					entry.engine,
					entry.player.finalStats,
					isFinal
				);
			}
		}
		updatePlaybackUi();
	}

	function updatePlaybackUi() {
		if (!state.replay) return;
		els.seekSlider.max = String(state.maxFrame);
		els.seekSlider.value = String(state.currentFrame);
		els.timeDisplay.textContent = `${C.formatTime(
			state.currentFrame / 60
		)} / ${C.formatTime(state.maxFrame / 60)}`;
		els.frameDisplay.textContent = `Frame ${state.currentFrame} / ${state.maxFrame}`;
		els.roundDisplay.textContent =
			state.replay.kind === 'solo'
				? soloGameLabel(state.replay.gamemode, state.replay.customtype)
				: `Round ${state.roundIndex + 1} / ${state.replay.rounds.length}`;
		updatePlayPauseButton();
	}

	function practicePlayer(playerId) {
		const entry = state.entries.find(
			(candidate) => candidate.player.id === playerId
		);
		if (!entry) return;
		const source = {
			fileName: state.fileName,
			roundIndex: state.roundIndex,
			playerId: entry.player.id,
			playerName: entry.player.username,
			frame: state.currentFrame,
			timeMs: (state.currentFrame / 60) * 1000,
		};
		const practiceState = C.capturePracticeState(
			entry.engine,
			entry.tracker,
			source
		);
		C.savePracticeState(practiceState);
		const opened = window.open('index.html?replayPractice=1', '_blank');
		if (!opened) window.location.href = 'index.html?replayPractice=1';
	}

	function openStatsSettings() {
		els.statsSettings.hidden = false;
		renderStatsSettings();
	}

	function closeStatsSettings() {
		els.statsSettings.hidden = true;
	}

	function getScopeList() {
		if (state.statsScope === 'all') return state.statsConfig.global;
		if (!state.statsConfig.players[state.statsScope]) {
			state.statsConfig.players[state.statsScope] =
				state.statsConfig.global.slice();
		}
		return state.statsConfig.players[state.statsScope];
	}

	function saveStatsConfig() {
		C.saveReplayStatsConfig(state.statsConfig);
	}

	function applyStatsConfig() {
		for (const entry of state.entries) {
			const card = state.cards.get(entry.player.id);
			if (!card) continue;
			card.statsPanel.setVisibleStats(
				C.getVisibleStats(state.statsConfig, entry.player.id)
			);
		}
	}

	function renderStatsSettings() {
		els.statsScope.innerHTML = '';
		const allOption = document.createElement('option');
		allOption.value = 'all';
		allOption.textContent = 'All players';
		els.statsScope.appendChild(allOption);
		for (const entry of state.entries) {
			const option = document.createElement('option');
			option.value = entry.player.id;
			option.textContent = entry.player.username;
			els.statsScope.appendChild(option);
		}
		if (
			state.statsScope !== 'all' &&
			!state.entries.some((entry) => entry.player.id === state.statsScope)
		) {
			state.statsScope = 'all';
		}
		els.statsScope.value = state.statsScope;

		const selected = new Set(getScopeList());
		els.statsCheckboxes.innerHTML = '';
		const groups = new Map();
		for (const def of window.ZZStatsConfig.STAT_DEFS) {
			if (!groups.has(def.group)) groups.set(def.group, []);
			groups.get(def.group).push(def);
		}
		for (const [group, defs] of groups) {
			const groupEl = document.createElement('div');
			groupEl.className = 'replay-settings-group';
			const title = document.createElement('h3');
			title.textContent = group;
			groupEl.appendChild(title);
			for (const def of defs) {
				const label = document.createElement('label');
				label.className = 'replay-settings-check';
				const checkbox = document.createElement('input');
				checkbox.type = 'checkbox';
				checkbox.checked = selected.has(def.id);
				checkbox.addEventListener('change', () => {
					const list = getScopeList();
					const index = list.indexOf(def.id);
					if (checkbox.checked && index === -1) list.push(def.id);
					if (!checkbox.checked && index !== -1) list.splice(index, 1);
					saveStatsConfig();
					applyStatsConfig();
				});
				const text = document.createElement('span');
				text.textContent = def.label;
				label.appendChild(checkbox);
				label.appendChild(text);
				groupEl.appendChild(label);
			}
			els.statsCheckboxes.appendChild(groupEl);
		}
	}

	init();
})();
