// TETR.IO match replay viewer.
(function () {
	'use strict';

	const C = window.ZZReplayCommon;
	const API = window.ZZReplayApi;
	const audio = window.ZZReplayAudio
		? new window.ZZReplayAudio()
		: {
				resume() {},
				setMuted() {},
				setVolume() {},
				getSettings() {
					return { muted: false, volume: 0.7 };
				},
				playClear() {},
				playGarbage() {},
				playAction() {},
				updateDanger() {},
				setSuppressed() {},
			};
	const state = {
		replay: null,
		fileName: '',
		source: null,
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
		activePlayerId: null,
		layout: {
			mobile: false,
			portrait: false,
			cellSize: 20,
			holdCell: 20,
			queueCount: 6,
			queueCell: 20,
		},
		search: {
			user: null,
			gamemode: 'league',
			entries: [],
			loading: false,
			requestId: 0,
		},
		immersive: false,
		statsOpen: false,
		immersiveControlsVisible: false,
		immersiveHideTimer: null,
		finishPlayed: false,
		dirty: true,
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
		roundSelect: null,
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
		userSearchForm: document.getElementById('userSearchForm'),
		userSearchInput: document.getElementById('userSearchInput'),
		userSearchBtn: document.getElementById('userSearchBtn'),
		userSearchStatus: document.getElementById('userSearchStatus'),
		userSearchResult: document.getElementById('userSearchResult'),
		gamemodeTabs: document.getElementById('gamemodeTabs'),
		recentReplays: document.getElementById('recentReplays'),
		replayIdForm: document.getElementById('replayIdForm'),
		replayIdInput: document.getElementById('replayIdInput'),
		replayIdBtn: document.getElementById('replayIdBtn'),
		muteBtn: document.getElementById('muteBtn'),
		fullscreenBtn: document.getElementById('fullscreenBtn'),
		replaySidePreview: document.getElementById('replaySidePreview'),
		replaySideName: document.getElementById('replaySideName'),
		replaySideResult: document.getElementById('replaySideResult'),
		replaySideBoard: document.getElementById('replaySideBoard'),
		replaySideHold: document.getElementById('replaySideHold'),
		replaySideNext: document.getElementById('replaySideNext'),
		replaySideGarbage: document.getElementById('replaySideGarbage'),
		replayImmersiveControls: document.getElementById('replayImmersiveControls'),
		immersiveExitBtn: document.getElementById('immersiveExitBtn'),
		immersivePlayBtn: document.getElementById('immersivePlayBtn'),
		immersiveSeek: document.getElementById('immersiveSeek'),
		immersiveMuteBtn: document.getElementById('immersiveMuteBtn'),
		replayVolume: document.getElementById('replayVolume'),
		replayMute: document.getElementById('replayMute'),
		replaySoundPack: document.getElementById('replaySoundPack'),
		replayCues: document.getElementById('replayCues'),
		replaySoundPackImport: document.getElementById('replaySoundPackImport'),
		replaySoundPackFiles: document.getElementById('replaySoundPackFiles'),
		replaySoundPackClear: document.getElementById('replaySoundPackClear'),
		replaySoundPackStatus: document.getElementById('replaySoundPackStatus'),
	};

	const portraitQuery = window.matchMedia('(orientation: portrait)');

	function init() {
		computeLayout();
		bindEvents();
		syncAudioSettings();
		refreshSoundPacks();
		const resumeAudio = () => audio.resume();
		window.addEventListener('pointerdown', resumeAudio, { once: true });
		window.addEventListener('keydown', resumeAudio, { once: true });
		requestAnimationFrame(loop);
		if (document.documentElement.classList.contains('mobile')) {
			const back = document.querySelector('.replay-back');
			if (back) back.href = 'index.html?mobile=1&menu=1';
		}
		const params = new URLSearchParams(location.search);
		const replayUrl = params.get('replay');
		const replayId = params.get('replayId');
		const user = params.get('user');
		const mode = params.get('gamemode');
		if (replayUrl) {
			fetch(replayUrl)
				.then((response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.text();
				})
				.then((text) =>
					loadReplayText(text, replayUrl.split('/').pop() || 'replay.ttrm', {
						type: 'url',
						url: replayUrl,
					})
				)
				.catch((error) => showError(`Could not load replay URL: ${error.message}`));
		} else if (replayId) {
			loadReplayById(replayId);
		} else if (user) {
			els.userSearchInput.value = user;
			searchUser(user, mode);
		}
	}

	function bindEvents() {
		els.chooseFileBtn.addEventListener('click', () => els.fileInput.click());
		els.loadReplayBtn.addEventListener('click', () => els.fileInput.click());
		els.fileInput.addEventListener('change', async () => {
			const file = els.fileInput.files && els.fileInput.files[0];
			if (!file) return;
			const text = await file.text();
			loadReplayText(text, file.name, { type: 'file', name: file.name });
			els.fileInput.value = '';
		});
		els.pasteReplayBtn.addEventListener('click', async () => {
			try {
				const text = await navigator.clipboard.readText();
				loadReplayText(text, 'pasted.ttrm', { type: 'paste' });
			} catch (error) {
				const text = prompt('Paste replay JSON');
				if (text) loadReplayText(text, 'pasted.ttrm', { type: 'paste' });
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
			loadReplayText(text, file.name, { type: 'file', name: file.name });
		});

		els.userSearchForm.addEventListener('submit', (event) => {
			event.preventDefault();
			searchUser(els.userSearchInput.value);
		});
		for (const button of els.gamemodeTabs.querySelectorAll('button')) {
			button.addEventListener('click', () => {
				if (state.search.loading) return;
				state.search.gamemode = button.dataset.mode;
				updateGamemodeTabs();
				loadRecent();
			});
		}
		els.replayIdForm.addEventListener('submit', (event) => {
			event.preventDefault();
			loadReplayById(els.replayIdInput.value);
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

		els.replaySidePreview.addEventListener('click', switchPlayer);
		els.replaySidePreview.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				switchPlayer();
			}
		});
		els.muteBtn.addEventListener('click', () => {
			audio.setMuted(!audio.getSettings().muted);
			updateMuteButtons();
		});
		els.fullscreenBtn.addEventListener('click', toggleImmersive);
		els.immersiveExitBtn.addEventListener('click', exitImmersive);
		els.immersivePlayBtn.addEventListener('click', () => {
			audio.resume();
			togglePlay();
			showImmersiveControls();
		});
		els.immersiveSeek.addEventListener('input', () => {
			pause();
			seek(Number(els.immersiveSeek.value));
			showImmersiveControls();
		});
		els.immersiveMuteBtn.addEventListener('click', () => {
			audio.setMuted(!audio.getSettings().muted);
			updateMuteButtons();
			showImmersiveControls();
		});
		els.replayVolume.addEventListener('input', () => {
			audio.setVolume(Number(els.replayVolume.value) / 100);
			updateMuteButtons();
		});
		els.replayMute.addEventListener('change', () => {
			audio.setMuted(els.replayMute.checked);
			updateMuteButtons();
		});
		if (els.replaySoundPack) {
			els.replaySoundPack.addEventListener('change', () => {
				window.ZZSoundPack?.setPack(els.replaySoundPack.value);
			});
		}
		if (els.replayCues) {
			els.replayCues.addEventListener('change', () => {
				window.ZZSoundPack?.setCues(els.replayCues.checked);
			});
		}
		if (els.replaySoundPackImport && els.replaySoundPackFiles) {
			els.replaySoundPackImport.addEventListener('click', () => {
				els.replaySoundPackFiles.click();
			});
			els.replaySoundPackFiles.addEventListener('change', async () => {
				const files = els.replaySoundPackFiles.files;
				if (!files || !files.length) return;
				try {
					const result = await window.ZZSoundPack.importFiles(files);
					els.replaySoundPackStatus.textContent = `Loaded ${result.loaded} sounds.`;
				} catch (error) {
					els.replaySoundPackStatus.textContent = error.message;
				}
				els.replaySoundPackFiles.value = '';
				refreshSoundPacks();
			});
		}
		if (els.replaySoundPackClear) {
			els.replaySoundPackClear.addEventListener('click', async () => {
				await window.ZZSoundPack?.clearCustom();
				refreshSoundPacks();
			});
		}
		window.ZZSoundPack?.onChange(refreshSoundPacks);
		els.replayView.addEventListener('click', (event) => {
			if (!state.immersive) return;
			if (
				event.target.closest(
					'button, input, select, .replay-side-preview'
				)
			) {
				return;
			}
			toggleImmersiveControls();
		});
		document.addEventListener('fullscreenchange', () => {
			if (!document.fullscreenElement && state.immersive) {
				exitImmersive({ skipFullscreen: true });
			}
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
		window.addEventListener('resize', handleResize);
		if (portraitQuery.addEventListener) {
			portraitQuery.addEventListener('change', handleResize);
		} else if (portraitQuery.addListener) {
			portraitQuery.addListener(handleResize);
		}
	}

	function handleResize() {
		computeLayout();
		updatePlayerLayout();
		state.dirty = true;
		renderAll();
		state.dirty = false;
	}

	function computeLayout() {
		const mobile = document.documentElement.classList.contains('mobile');
		const portrait = mobile && portraitQuery.matches;
		const immersive = state.immersive;
		const vw = window.innerWidth;
		const vh = window.innerHeight;
		let cellSize = 24;
		let holdCell = 20;
		let queueCount = 6;
		let queueCell = 20;
		let queueOrientation = 'vertical';
		let sidePreview = false;
		let sidePreviewWidth = 0;
		if (mobile) {
			if (portrait) {
				sidePreview = state.entries.length > 1;
				sidePreviewWidth = sidePreview ? 80 : 0;
				holdCell = 12;
				queueCount = 3;
				queueCell = 12;
				queueOrientation = 'horizontal';
				if (vw < 350) {
					holdCell = 10;
					queueCount = 2;
					queueCell = 10;
				}
				const statsHeight = state.statsOpen ? 36 : 0;
				const reservedHeight = immersive ? 96 : 300 + statsHeight;
				const reservedWidth = sidePreviewWidth + 6 + 12 + 17;
				const heightCells = Math.floor((vh - reservedHeight) / 23);
				const widthCells = Math.floor((vw - reservedWidth) / 10);
				cellSize = Math.max(
					8,
					Math.min(immersive ? 28 : 22, heightCells, widthCells)
				);
			} else {
				holdCell = 8;
				queueCount = 4;
				queueCell = 8;
				queueOrientation = 'vertical';
				const headerH =
					document.querySelector('.replay-header')?.offsetHeight || 50;
				const matchH =
					document.querySelector('.replay-match-header')?.offsetHeight ||
					24;
				const tabsH =
					document.querySelector('.replay-round-tabs')?.offsetHeight || 0;
				const dockH =
					document.querySelector('.replay-bottom-dock')?.offsetHeight ||
					66;
				const playerHeaderH =
					document.querySelector('.replay-player-header')
						?.offsetHeight || 31;
				const cardChrome = playerHeaderH + 4 + 2 + 8 + 2;
				const reservedHeight = immersive
					? 44
					: headerH + matchH + tabsH + dockH + cardChrome + 6;
				const heightCells = Math.floor((vh - reservedHeight) / 23);
				const widthCells = Math.floor((vw / 2 - 17 - 12) / 10);
				cellSize = Math.max(
					4,
					Math.min(immersive ? 16 : 12, heightCells, widthCells)
				);
			}
		} else {
			cellSize = immersive ? 28 : 24;
			holdCell = 20;
			queueCount = 6;
			queueCell = 20;
			queueOrientation = 'vertical';
		}
		state.layout = {
			mobile,
			portrait,
			immersive,
			cellSize,
			holdCell,
			queueCount,
			queueCell,
			queueOrientation,
			sidePreview,
			sidePreviewWidth,
		};
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
			if (state.immersive) {
				exitImmersive();
			} else {
				closeStatsSettings();
			}
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

	function setSearchStatus(message, kind) {
		const el = els.userSearchStatus;
		if (!el) return;
		if (!message) {
			el.hidden = true;
			el.textContent = '';
			el.dataset.kind = '';
			return;
		}
		el.hidden = false;
		el.textContent = message;
		el.dataset.kind = kind || '';
	}

	function setSearchLoading(loading) {
		state.search.loading = loading;
		if (els.userSearchBtn) els.userSearchBtn.disabled = loading;
		if (els.userSearchInput) els.userSearchInput.disabled = loading;
		if (els.gamemodeTabs) {
			for (const button of els.gamemodeTabs.querySelectorAll('button')) {
				button.disabled = loading;
			}
		}
	}

	async function searchUser(name, mode) {
		const query = String(name || '').trim();
		if (!query) {
			setSearchStatus('Enter a TETR.IO username.', 'error');
			return;
		}
		const requestId = ++state.search.requestId;
		state.search.gamemode =
			mode && API.GAMEMODES.has(mode) ? mode : 'league';
		setSearchLoading(true);
		setSearchStatus('Looking up player…', 'loading');
		try {
			const user = await API.getUser(query);
			if (requestId !== state.search.requestId) return;
			state.search.user = user;
			renderUserCard(user);
			els.gamemodeTabs.hidden = false;
			updateGamemodeTabs();
			await loadRecent();
		} catch (error) {
			if (requestId !== state.search.requestId) return;
			state.search.user = null;
			els.userSearchResult.hidden = true;
			els.gamemodeTabs.hidden = true;
			els.recentReplays.hidden = true;
			setSearchStatus(
				error.message || 'Could not find that player.',
				'error'
			);
		} finally {
			if (requestId === state.search.requestId) setSearchLoading(false);
		}
	}

	function renderUserCard(user) {
		els.userSearchResult.hidden = false;
		els.userSearchResult.innerHTML = '';
		const name = document.createElement('span');
		name.className = 'replay-user-name';
		name.textContent = user.username || user._id;
		const meta = document.createElement('span');
		meta.className = 'replay-user-meta';
		meta.textContent = 'Recent replays';
		els.userSearchResult.appendChild(name);
		els.userSearchResult.appendChild(meta);
	}

	function updateGamemodeTabs() {
		for (const button of els.gamemodeTabs.querySelectorAll('button')) {
			button.classList.toggle(
				'active',
				button.dataset.mode === state.search.gamemode
			);
		}
	}

	async function loadRecent() {
		if (!state.search.user) return;
		const requestId = ++state.search.requestId;
		setSearchLoading(true);
		setSearchStatus('Loading recent replays…', 'loading');
		els.recentReplays.hidden = true;
		try {
			const entries = await API.getRecent(
				state.search.user.username || state.search.user._id,
				state.search.gamemode
			);
			if (requestId !== state.search.requestId) return;
			state.search.entries = entries;
			renderRecentList(entries);
			setSearchStatus(
				entries.length
					? ''
					: `No recent ${gamemodeLabel(
							state.search.gamemode
						)} replays found.`,
				entries.length ? '' : 'empty'
			);
		} catch (error) {
			if (requestId !== state.search.requestId) return;
			state.search.entries = [];
			els.recentReplays.hidden = true;
			setSearchStatus(
				error.message || 'Could not load recent replays.',
				'error'
			);
		} finally {
			if (requestId === state.search.requestId) setSearchLoading(false);
		}
	}

	function renderRecentList(entries) {
		els.recentReplays.innerHTML = '';
		if (!entries.length) {
			els.recentReplays.hidden = true;
			return;
		}
		els.recentReplays.hidden = false;
		for (const entry of entries.slice(0, 20)) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'replay-recent-item';
			button.dataset.replayId = entry.replayid;
			const mode = document.createElement('span');
			mode.className = 'replay-recent-mode';
			mode.textContent = gamemodeLabel(
				entry.gamemode || state.search.gamemode
			);
			const date = document.createElement('span');
			date.className = 'replay-recent-date';
			date.textContent = formatReplayDate(entry.ts);
			const detail = document.createElement('span');
			detail.className = 'replay-recent-detail';
			detail.textContent = replayEntryDetail(entry);
			const action = document.createElement('span');
			action.className = 'replay-recent-action';
			action.textContent = 'Load';
			button.appendChild(mode);
			button.appendChild(date);
			button.appendChild(detail);
			button.appendChild(action);
			button.addEventListener('click', () =>
				loadReplayById(entry.replayid, button)
			);
			els.recentReplays.appendChild(button);
		}
	}

	function gamemodeLabel(mode) {
		return (
			{ league: 'League', '40l': '40L', blitz: 'Blitz' }[mode] || 'Replay'
		);
	}

	function formatReplayDate(ts) {
		if (!ts) return '';
		const date = new Date(ts);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	function replayEntryDetail(entry) {
		if (entry.gamemode === 'league') {
			const opponent = entry.otherusers?.[0]?.username || 'Unknown';
			const board = entry.results?.leaderboard || [];
			const me = board.find((player) => player.id === state.search.user?._id);
			const them = board.find(
				(player) => player.id !== state.search.user?._id
			);
			if (me && them) {
				return `vs ${them.username || opponent} · ${me.wins ?? 0}–${
					them.wins ?? 0
				}`;
			}
			return `vs ${opponent}`;
		}
		const stats = entry.results?.stats || {};
		const parts = [];
		if (entry.gamemode === '40l') {
			const time = Number(stats.finaltime) || 0;
			if (time) parts.push(C.formatTime(time / 1000));
			if (stats.lines) parts.push(`${stats.lines} lines`);
		} else {
			if (stats.score) {
				parts.push(`${Math.round(stats.score).toLocaleString()} pts`);
			}
			if (stats.lines) parts.push(`${stats.lines} lines`);
		}
		return parts.join(' · ') || 'Solo game';
	}

	async function loadReplayById(replayId, button) {
		const id = API.parseReplayId(replayId);
		if (!id) {
			setSearchStatus('Invalid replay ID.', 'error');
			return;
		}
		if (button) {
			button.disabled = true;
			button.classList.add('loading');
		}
		setSearchStatus('Downloading replay…', 'loading');
		try {
			const text = await API.getReplay(id);
			loadReplayText(text, `${id}.ttrm`, { type: 'id', id });
			setSearchStatus('', '');
		} catch (error) {
			setSearchStatus(
				error.message || 'Could not load that replay.',
				'error'
			);
		} finally {
			if (button) {
				button.disabled = false;
				button.classList.remove('loading');
			}
		}
	}

	function loadReplayText(text, name, source) {
		try {
			const replay = C.parseReplay(text);
			state.replay = replay;
			state.fileName = name || 'replay.ttrm';
			state.source = source || null;
			state.statsConfig = C.loadReplayStatsConfig();
			state.statsScope = 'all';
			state.activePlayerId = null;
			state.statsOpen = false;
			els.replayError.hidden = true;
			els.dropZone.hidden = true;
			els.replayView.hidden = false;
			updateReplayUrl(source);
			buildMatchHeader();
			buildRoundTabs();
			selectRound(0);
		} catch (error) {
			showError(error.message);
		}
	}

	function updateReplayUrl(source) {
		const url = new URL(location.href);
		url.searchParams.delete('replay');
		url.searchParams.delete('replayId');
		url.searchParams.delete('user');
		url.searchParams.delete('gamemode');
		if (source?.type === 'id') {
			url.searchParams.set('replayId', source.id);
		} else if (source?.type === 'url') {
			url.searchParams.set('replay', source.url);
		}
		history.replaceState(null, '', url);
	}

	function replayReturnUrl() {
		const url = new URL('replay.html', location.href);
		if (document.documentElement.classList.contains('mobile')) {
			url.searchParams.set('mobile', '1');
		}
		if (state.source?.type === 'id') {
			url.searchParams.set('replayId', state.source.id);
		} else if (state.source?.type === 'url') {
			url.searchParams.set('replay', state.source.url);
		}
		return url.toString();
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

	function replayTitle() {
		const replay = state.replay;
		if (replay.kind === 'solo') {
			const player = replay.rounds[0]?.players[0];
			return `${player?.username || 'Player'} · ${soloGameLabel(
				replay.gamemode,
				replay.customtype
			)}`;
		}
		const players = replay.rounds[0]?.players || [];
		const names = players.map((player) => player.username).filter(Boolean);
		return names.length ? names.join(' vs ') : state.fileName;
	}

	function buildMatchHeader() {
		const replay = state.replay;
		els.matchHeader.innerHTML = '';
		const title = document.createElement('div');
		title.className = 'replay-match-title';
		title.textContent = replayTitle();
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
		if (els.roundSelect) {
			els.roundSelect.remove();
			els.roundSelect = null;
		}
		if (state.replay.kind === 'solo') {
			els.roundTabs.hidden = true;
			return;
		}
		els.roundTabs.hidden = false;
		const select = document.createElement('select');
		select.className = 'replay-round-select';
		select.setAttribute('aria-label', 'Round');
		state.replay.rounds.forEach((round, index) => {
			const option = document.createElement('option');
			option.value = String(index);
			option.textContent = `Round ${index + 1}${
				round.winner ? ` · ${round.winner.username}` : ''
			}`;
			select.appendChild(option);
		});
		select.addEventListener('change', () => {
			selectRound(Number(select.value));
		});
		els.matchHeader.appendChild(select);
		els.roundSelect = select;
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
		if (els.roundSelect) {
			els.roundSelect.value = String(state.roundIndex);
		}
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
		state.entries = C.createRoundEngines(round, {
			onClear: handleClear,
			onGarbage: handleGarbage,
			onAction: handleAction,
		});
		state.maxFrame = round.maxFrame;
		state.keyframes = [];
		state.currentFrame = 0;
		state.finishPlayed = false;
		computeLayout();
		buildPlayerGrid();
		audio.setSuppressed(true);
		try {
			for (const entry of state.entries) C.tickPlayer(entry, 0);
		} finally {
			audio.setSuppressed(false);
		}
		state.keyframes.push(C.buildKeyframe(state.entries, 0));
		state.lastStatsUpdate = 0;
		updateRoundTabs();
		updatePlaybackUi();
		state.dirty = true;
		renderAll();
		state.dirty = false;
	}

	function destroyEntries() {
		for (const entry of state.entries) entry.tracker.destroy();
		state.entries = [];
		state.cards.clear();
		els.playerGrid.innerHTML = '';
		if (els.replaySidePreview) els.replaySidePreview.hidden = true;
	}

	function playerResultLabel(player) {
		const reason = player.results?.gameoverreason;
		if (state.replay?.kind === 'solo') {
			return reason === 'clear' ? 'Complete' : 'Finished';
		}
		if (reason === 'winner') return 'Winner';
		if (reason === 'topout') return 'Top out';
		if (reason === 'garbagesmash') return 'Garbage smash';
		return player.alive ? 'Alive' : 'Out';
	}

	function buildPlayerGrid() {
		els.playerGrid.innerHTML = '';
		state.cards.clear();
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
			result.textContent = playerResultLabel(player);
			result.classList.toggle(
				'winner',
				player.results?.gameoverreason === 'winner'
			);
			const statsToggle = document.createElement('button');
			statsToggle.type = 'button';
			statsToggle.className = 'button replay-stats-btn';
			statsToggle.textContent = 'Stats';
			statsToggle.addEventListener('click', (event) => {
				event.stopPropagation();
				toggleStats();
			});
			const practice = document.createElement('button');
			practice.type = 'button';
			practice.className = 'button replay-practice-btn';
			practice.textContent = 'Practice';
			practice.addEventListener('click', (event) => {
				event.stopPropagation();
				practicePlayer(player.id);
			});
			header.appendChild(name);
			header.appendChild(result);
			header.appendChild(statsToggle);
			header.appendChild(practice);

			const body = document.createElement('div');
			body.className = 'replay-player-body';

			// Left column: hold on top, session stats underneath.
			const left = document.createElement('div');
			left.className = 'left-column replay-left-column';
			const holdWrap = document.createElement('div');
			holdWrap.className = 'queue replay-hold-wrap';
			holdWrap.innerHTML = 'HOLD<hr />';
			const hold = document.createElement('canvas');
			hold.width = 90;
			hold.height = 60;
			holdWrap.appendChild(hold);
			left.appendChild(holdWrap);

			const sessionPanel = document.createElement('div');
			sessionPanel.className = 'session-panel replay-session-panel';
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
			const meterBlocks = document.createElement('div');
			meterBlocks.className = 'replay-garbage-blocks';
			const meterCount = document.createElement('span');
			meterCount.className = 'replay-garbage-count';
			meterCount.textContent = '0';
			meter.appendChild(meterBlocks);
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

			// Compact stats strip for mobile.
			const compactWrap = document.createElement('div');
			compactWrap.className = 'replay-compact-stats';
			const compactStats = new C.StatsPanel(compactWrap, {
				showHeader: false,
				showChain: true,
				showAttack: false,
				compact: true,
				maxStats: 6,
			});
			compactStats.setVisibleStats(
				C.getVisibleStats(state.statsConfig, player.id)
			);

			card.appendChild(header);
			card.appendChild(body);
			card.appendChild(compactWrap);
			els.playerGrid.appendChild(card);

			state.cards.set(player.id, {
				element: card,
				board,
				hold,
				queue,
				meterBlocks,
				meterCount,
				meterSignature: '',
				statsPanel,
				compactStats,
				practice,
			});
		}
		if (
			!state.activePlayerId ||
			!state.cards.has(state.activePlayerId)
		) {
			state.activePlayerId = state.entries[0]?.player.id || null;
		}
		updatePlayerLayout();
	}

	function updatePlayerLayout() {
		const { mobile, portrait, sidePreview } = state.layout;
		const showSide =
			mobile && portrait && sidePreview && state.entries.length > 1;
		for (const [id, card] of state.cards) {
			const active = id === state.activePlayerId;
			card.element.classList.toggle(
				'replay-player-card--active',
				showSide && active
			);
			card.element.classList.toggle(
				'replay-player-card--mini',
				showSide && !active
			);
			card.element.classList.toggle(
				'replay-stats-open',
				state.statsOpen && active
			);
		}
		if (els.replaySidePreview) {
			els.replaySidePreview.hidden = !showSide;
		}
		updateSidePreview();
	}

	function updateSidePreview() {
		if (!els.replaySidePreview || els.replaySidePreview.hidden) return;
		const inactive = state.entries.find(
			(entry) => entry.player.id !== state.activePlayerId
		);
		if (!inactive) {
			els.replaySidePreview.hidden = true;
			return;
		}
		els.replaySideName.textContent = inactive.player.username;
		els.replaySideResult.textContent = playerResultLabel(inactive.player);
		C.renderBoard(els.replaySideBoard, inactive.engine, {
			cellSize: 6,
			showGhost: false,
			showGrid: false,
		});
		C.renderHold(els.replaySideHold, inactive.engine, 6, 24, 18);
		C.renderQueue(els.replaySideNext, inactive.engine, 2, 6, 24, 'vertical');
		const blocks = inactive.engine.garbageQueue.queue;
		const total = blocks.reduce((sum, block) => sum + block.amount, 0);
		els.replaySideGarbage.textContent = String(total);
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
			!state.keyframes.some(
				(keyframe) => keyframe.frame === state.currentFrame
			)
		) {
			state.keyframes.push(
				C.buildKeyframe(state.entries, state.currentFrame)
			);
			state.keyframes.sort((a, b) => a.frame - b.frame);
		}
		state.dirty = true;
		updatePlaybackUi();
	}

	function seek(frame) {
		if (!state.replay) return;
		const target = Math.max(
			0,
			Math.min(state.maxFrame, Math.floor(Number(frame) || 0))
		);
		if (target === state.currentFrame) {
			state.dirty = true;
			renderAll();
			state.dirty = false;
			return;
		}
		audio.setSuppressed(true);
		try {
			if (target < state.currentFrame) {
				state.finishPlayed = false;
				for (const entry of state.entries) {
					entry.topOutPlayed = false;
				}
				const keyframe = C.findKeyframe(state.keyframes, target);
				if (keyframe) {
					C.restoreKeyframe(state.entries, keyframe);
					state.currentFrame = keyframe.frame;
				} else {
					selectRound(state.roundIndex);
				}
			}
			while (state.currentFrame < target) stepOneFrame();
		} finally {
			audio.setSuppressed(false);
		}
		state.lastStatsUpdate = 0;
		state.dirty = true;
		renderAll();
		state.dirty = false;
	}

	function play() {
		if (!state.replay) return;
		audio.resume();
		if (state.currentFrame >= state.maxFrame) {
			seek(0);
		}
		state.playing = true;
		state.lastTime = performance.now();
		state.accumulator = 0;
		state.dirty = true;
		updatePlayPauseButton();
		if (state.immersive) scheduleImmersiveHide();
	}

	function pause() {
		state.playing = false;
		state.dirty = true;
		updatePlayPauseButton();
		if (state.immersive) showImmersiveControls({ keepVisible: true });
	}

	function togglePlay() {
		if (state.playing) pause();
		else play();
	}

	function updatePlayPauseButton() {
		els.playPauseBtn.textContent = state.playing ? 'Pause' : 'Play';
		if (els.immersivePlayBtn) {
			els.immersivePlayBtn.textContent = state.playing ? '⏸' : '▶';
			els.immersivePlayBtn.setAttribute(
				'aria-label',
				state.playing ? 'Pause' : 'Play'
			);
		}
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
		if (state.playing || state.dirty) {
			renderAll();
			state.dirty = false;
		}
		requestAnimationFrame(loop);
	}

	function renderAll() {
		if (!state.replay) return;
		const now = performance.now();
		const updateStats = now - state.lastStatsUpdate > 100;
		if (updateStats) state.lastStatsUpdate = now;
		const {
			mobile,
			portrait,
			cellSize,
			holdCell,
			queueCount,
			queueCell,
			queueOrientation,
		} = state.layout;
		for (const entry of state.entries) {
			const card = state.cards.get(entry.player.id);
			if (!card) continue;
			const isActive =
				!mobile || !portrait || entry.player.id === state.activePlayerId;
			if (!isActive) continue;
			C.renderBoard(card.board, entry.engine, { cellSize });
			if (state.playing && !entry.player.alive && !entry.topOutPlayed) {
				entry.topOutPlayed = true;
				audio.playTopOut(playerPan(entry.player));
			}
			const queueWidth = mobile ? queueCell * 4 : 90;
			const holdWidth = mobile ? holdCell * 4 : 90;
			C.renderQueue(
				card.queue,
				entry.engine,
				queueCount,
				queueCell,
				queueWidth,
				queueOrientation
			);
			C.renderHold(
				card.hold,
				entry.engine,
				holdCell,
				holdWidth,
				holdCell * 3
			);
			const blocks = entry.engine.garbageQueue.queue;
			const total = blocks.reduce((sum, block) => sum + block.amount, 0);
			const signature = blocks.map((block) => block.amount).join(',');
			if (signature !== card.meterSignature) {
				card.meterSignature = signature;
				const maxLines = entry.engine.board.height + 3;
				const scale = total > maxLines ? maxLines / total : 1;
				card.meterBlocks.innerHTML = '';
				for (const block of blocks) {
					if (block.amount <= 0) continue;
					const segment = document.createElement('div');
					segment.className = 'replay-garbage-block';
					segment.style.height = `${
						((block.amount * scale) / maxLines) * 100
					}%`;
					segment.title = `${block.amount} line${
						block.amount === 1 ? '' : 's'
					}`;
					card.meterBlocks.appendChild(segment);
				}
				card.meterCount.textContent = String(total);
			}
			if (updateStats) {
				const isFinal = state.currentFrame >= entry.player.frames;
				if (mobile) {
					if (state.statsOpen) {
						card.compactStats.update(
							entry.tracker,
							entry.engine,
							entry.player.finalStats,
							isFinal
						);
					}
				} else {
					card.statsPanel.update(
						entry.tracker,
						entry.engine,
						entry.player.finalStats,
						isFinal
					);
				}
			}
			if (state.playing) {
				audio.updateDanger(
					entry.player.id,
					playerPan(entry.player),
					entry.engine,
					isActive && entry.player.alive
				);
			}
		}
		if (
			state.playing &&
			state.currentFrame >= state.maxFrame &&
			!state.finishPlayed
		) {
			state.finishPlayed = true;
			audio.playFinish(0);
		}
		updateSidePreview();
		updatePlaybackUi();
	}

	function updatePlaybackUi() {
		if (!state.replay) return;
		els.seekSlider.max = String(state.maxFrame);
		els.seekSlider.value = String(state.currentFrame);
		if (els.immersiveSeek) {
			els.immersiveSeek.max = String(state.maxFrame);
			els.immersiveSeek.value = String(state.currentFrame);
		}
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
		try {
			sessionStorage.setItem('zztetris_replay_return', replayReturnUrl());
		} catch (error) {
			// Storage can be unavailable; the back button still works.
		}
		if (document.documentElement.classList.contains('mobile')) {
			location.href = 'index.html?mobile=1&replayPractice=1';
			return;
		}
		const opened = window.open('index.html?replayPractice=1', '_blank');
		if (!opened) window.location.href = 'index.html?replayPractice=1';
	}

	function openStatsSettings() {
		syncAudioSettings();
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
			const visible = C.getVisibleStats(
				state.statsConfig,
				entry.player.id
			);
			card.statsPanel.setVisibleStats(visible);
			card.compactStats.setVisibleStats(visible);
		}
		state.dirty = true;
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

	function switchPlayer() {
		const inactive = state.entries.find(
			(entry) => entry.player.id !== state.activePlayerId
		);
		if (!inactive) return;
		state.activePlayerId = inactive.player.id;
		state.lastStatsUpdate = 0;
		updatePlayerLayout();
		state.dirty = true;
		renderAll();
		state.dirty = false;
	}

	function playerPan(player) {
		if (state.replay?.kind === 'solo') return 0;
		if (state.layout.mobile && state.layout.portrait) {
			return player.id === state.activePlayerId ? 0 : 0.35;
		}
		const index = state.entries.findIndex(
			(entry) => entry.player.id === player.id
		);
		return index === 0 ? -0.35 : 0.35;
	}

	function handleClear(player, info, attack) {
		audio.playClear(playerPan(player), info, attack);
	}

	function handleGarbage(player, type, event) {
		audio.playGarbage(playerPan(player), type, event);
	}

	function handleAction(player, action) {
		audio.playAction(playerPan(player), action);
	}

	function toggleStats() {
		state.statsOpen = !state.statsOpen;
		computeLayout();
		updatePlayerLayout();
		state.dirty = true;
		renderAll();
		state.dirty = false;
	}

	function toggleImmersive() {
		if (state.immersive) exitImmersive();
		else enterImmersive();
	}

	function enterImmersive() {
		state.immersive = true;
		document.documentElement.classList.add('replay-immersive');
		els.replayImmersiveControls.hidden = false;
		computeLayout();
		updatePlayerLayout();
		state.dirty = true;
		renderAll();
		state.dirty = false;
		showImmersiveControls();
		if (
			document.documentElement.requestFullscreen &&
			!document.fullscreenElement
		) {
			document.documentElement.requestFullscreen().catch(() => {});
		}
	}

	function exitImmersive(options = {}) {
		state.immersive = false;
		document.documentElement.classList.remove('replay-immersive');
		els.replayImmersiveControls.hidden = true;
		if (state.immersiveHideTimer) {
			clearTimeout(state.immersiveHideTimer);
			state.immersiveHideTimer = null;
		}
		computeLayout();
		updatePlayerLayout();
		state.dirty = true;
		renderAll();
		state.dirty = false;
		if (!options.skipFullscreen && document.fullscreenElement) {
			document.exitFullscreen().catch(() => {});
		}
	}

	function showImmersiveControls(options = {}) {
		if (!state.immersive) return;
		els.replayImmersiveControls.classList.add('visible');
		state.immersiveControlsVisible = true;
		if (state.immersiveHideTimer) {
			clearTimeout(state.immersiveHideTimer);
			state.immersiveHideTimer = null;
		}
		if (!options.keepVisible && state.playing) {
			scheduleImmersiveHide();
		}
	}

	function hideImmersiveControls() {
		if (!state.immersive) return;
		els.replayImmersiveControls.classList.remove('visible');
		state.immersiveControlsVisible = false;
	}

	function scheduleImmersiveHide() {
		if (state.immersiveHideTimer) clearTimeout(state.immersiveHideTimer);
		state.immersiveHideTimer = setTimeout(() => {
			state.immersiveHideTimer = null;
			if (state.immersive && state.playing) hideImmersiveControls();
		}, 3000);
	}

	function toggleImmersiveControls() {
		if (state.immersiveControlsVisible) hideImmersiveControls();
		else showImmersiveControls();
	}

	function updateMuteButtons() {
		const settings = audio.getSettings();
		const icon = settings.muted ? '🔇' : '🔊';
		if (els.muteBtn) {
			els.muteBtn.textContent = icon;
			els.muteBtn.setAttribute(
				'aria-label',
				settings.muted ? 'Unmute replay sounds' : 'Mute replay sounds'
			);
		}
		if (els.immersiveMuteBtn) {
			els.immersiveMuteBtn.textContent = icon;
			els.immersiveMuteBtn.setAttribute(
				'aria-label',
				settings.muted ? 'Unmute' : 'Mute'
			);
		}
		if (els.replayMute) els.replayMute.checked = settings.muted;
	}

	function syncAudioSettings() {
		const settings = audio.getSettings();
		if (els.replayVolume) {
			els.replayVolume.value = String(
				Math.round(settings.volume * 100)
			);
		}
		if (els.replayMute) els.replayMute.checked = settings.muted;
		updateMuteButtons();
	}

	function refreshSoundPacks() {
		const pack = window.ZZSoundPack;
		if (!pack) return;
		const settings = pack.getSettings();
		if (els.replaySoundPack) {
			const current = settings.pack;
			els.replaySoundPack.innerHTML = '';
			for (const item of pack.listPacks()) {
				const option = document.createElement('option');
				option.value = item.id;
				option.textContent = item.label;
				els.replaySoundPack.appendChild(option);
			}
			els.replaySoundPack.value = current;
		}
		if (els.replayCues) {
			const selected = pack
				.listPacks()
				.find((item) => item.id === settings.pack);
			els.replayCues.checked =
				settings.cues && (!selected || selected.cues);
			els.replayCues.disabled = !selected || !selected.cues;
		}
		if (els.replaySoundPackStatus) {
			const status = pack.getCustomStatus();
			els.replaySoundPackStatus.textContent = status.count
				? `${status.count} custom sounds loaded.`
				: 'No custom pack loaded.';
		}
		if (els.replaySoundPackClear) {
			els.replaySoundPackClear.disabled =
				pack.getCustomStatus().count === 0;
		}
	}

	init();
})();
