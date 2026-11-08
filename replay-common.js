// Shared replay parsing, simulation, stats and rendering helpers.
// Loaded by replay.html and index.html (replay practice) after replay-engine.js,
// stats-config.js, stats-core.js and rotationSystem.js.
(function (root) {
	'use strict';

	const FRAME_MS = 1000 / 60;
	const KEYFRAME_INTERVAL = 300;
	const PRACTICE_STORAGE_KEY = 'zztetris_replay_practice';
	const REPLAY_STATS_KEY = 'zztetris_replay_stats_config';

	// Same palette as the main game (base.js).
	const COLORS = {
		i: '#0BF',
		j: '#05F',
		l: '#F80',
		o: '#FF0',
		s: '#0F0',
		t: '#C3F',
		z: '#F00',
		gb: '#999999',
		bomb: '#F80',
	};
	const GREY = '#2A2A2A';
	const GRID = '#3A3A3A';
	const BG = '#111';

	const ACTION_TO_KEY = {
		L: 'moveLeft',
		R: 'moveRight',
		SD: 'softDrop',
		HD: 'hardDrop',
		HL: 'hold',
		CW: 'rotateCW',
		CCW: 'rotateCCW',
		R180: 'rotate180',
	};
	const KEY_TO_ACTION = {
		moveLeft: 'L',
		moveRight: 'R',
		softDrop: 'SD',
		hardDrop: 'HD',
		hold: 'HL',
		rotateCW: 'CW',
		rotateCCW: 'CCW',
		rotate180: 'R180',
	};
	const DEFAULT_CTRL = {
		ArrowLeft: 'L',
		ArrowRight: 'R',
		ArrowDown: 'SD',
		Space: 'HD',
		ShiftLeft: 'HL',
		KeyX: 'CW',
		KeyZ: 'CCW',
		KeyC: 'R180',
		KeyR: 'RE',
		KeyT: 'UNDO',
		KeyY: 'REDO',
	};

	function deepCopy(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function normalizeBagType(value) {
		const key = String(value || '').toLowerCase();
		const map = {
			'7bag': '7-bag',
			'7-bag': '7-bag',
			'14bag': '14-bag',
			'14-bag': '14-bag',
			classic: 'classic',
			pairs: 'pairs',
			'total mayhem': 'total mayhem',
			'7+1-bag': '7+1-bag',
			'7+2-bag': '7+2-bag',
			'7+x-bag': '7+x-bag',
		};
		return map[key] || '7-bag';
	}

	function normalizeKickTable(value) {
		const supported = new Set([
			'SRS',
			'SRS+',
			'SRS-X',
			'TETRA-X',
			'NRS',
			'ARS',
			'ASC',
			'none',
		]);
		return supported.has(value) ? value : 'SRS+';
	}

	function normalizeSpinBonuses(value) {
		const supported = new Set([
			'all',
			'all+',
			'all-mini',
			'all-mini+',
			'mini-only',
			'handheld',
			'T-spins',
			'T-spins+',
			'none',
			'stupid',
		]);
		return supported.has(value) ? value : 'all-mini+';
	}

	function normalizeComboTable(value) {
		const supported = new Set(['multiplier', 'classic', 'none']);
		return supported.has(value) ? value : 'multiplier';
	}

	function normalizeGarbageBlocking(value) {
		const supported = new Set(['combo blocking', 'limited blocking', 'none']);
		return supported.has(value) ? value : 'combo blocking';
	}

	function buildEngineConfig(player, round, replay) {
		const o = player.options || {};
		const opponents = round
			.filter((entry) => entry !== player)
			.map((entry) => entry.gameid)
			.filter((id) => Number.isFinite(id));
		const date = replay.ts ? new Date(replay.ts) : new Date();
		return {
			board: {
				width: o.boardwidth ?? 10,
				height: o.boardheight ?? 20,
				buffer: o.boardbuffer ?? 20,
			},
			kickTable: normalizeKickTable(o.kickset),
			options: {
				comboTable: normalizeComboTable(o.combotable),
				garbageBlocking: normalizeGarbageBlocking(o.garbageblocking),
				clutch: o.clutch ?? true,
				garbageTargetBonus: o.garbagetargetbonus ?? 'none',
				spinBonuses: normalizeSpinBonuses(o.spinbonuses),
				stock: o.stock ?? 0,
			},
			queue: {
				minLength: 10,
				seed: o.seed,
				type: normalizeBagType(o.bagtype),
			},
			garbage: {
				bombs: o.usebombs ?? false,
				cap: {
					absolute: o.garbageabsolutecap ?? 0,
					increase: o.garbagecapincrease ?? 0,
					max: o.garbagecapmax ?? 40,
					value: o.garbagecap ?? 8,
					marginTime: o.garbagecapmargin ?? 0,
				},
				boardWidth: o.boardwidth ?? 10,
				garbage: {
					speed: o.garbagespeed ?? 20,
					holeSize: o.garbageholesize ?? 1,
				},
				messiness: {
					change: o.messiness_change ?? 1,
					nosame: o.messiness_nosame ?? false,
					timeout: o.messiness_timeout ?? 0,
					within: o.messiness_inner ?? 0,
					center: o.messiness_center ?? false,
				},
				multiplier: {
					value: o.garbagemultiplier ?? 1,
					increase: o.garbageincrease ?? 0.008,
					marginTime: o.garbagemargin ?? 10800,
				},
				specialBonus: o.garbagespecialbonus ?? false,
				openerPhase: o.openerphase ?? 0,
				seed: o.seed,
				rounding: o.roundmode ?? 'down',
			},
			gravity: {
				value: o.g ?? 0.02,
				increase: o.gincrease ?? 0,
				marginTime: o.gmargin ?? 0,
			},
			handling: {
				arr: o.handling?.arr ?? 0,
				das: o.handling?.das ?? 6,
				dcd: o.handling?.dcd ?? 0,
				sdf: o.handling?.sdf ?? 41,
				safelock: o.handling?.safelock ?? false,
				cancel: o.handling?.cancel ?? false,
				may20g: o.handling?.may20g ?? true,
				irs: o.handling?.irs ?? 'tap',
				ihs: o.handling?.ihs ?? 'tap',
			},
			b2b: {
				chaining: !o.b2bcharging,
				charging: o.b2bcharging
					? { at: o.b2bcharge_at ?? 4, base: o.b2bcharge_base ?? 3 }
					: false,
			},
			pc: {
				b2b: o.allclear_b2b ?? 0,
				garbage: o.allclear_garbage ?? 0,
			},
			misc: {
				allowed: {
					hardDrop: o.allow_harddrop ?? true,
					spin180: o.allow180 ?? true,
					hold: o.display_hold ?? true,
					retry: false,
					undo: false,
				},
				infiniteHold: o.infinite_hold ?? false,
				movement: {
					infinite: false,
					lockResets: o.lockresets ?? 15,
					lockTime: o.locktime ?? 30,
					may20G: o.gravitymay20g ?? true,
				},
				username: o.username,
				stride: o.stride ?? false,
				date,
			},
			multiplayer: {
				opponents,
				passthrough: o.passthrough ?? 'zero',
			},
		};
	}

	function normalizeFinalStats(stats) {
		const clears = stats.clears || {};
		const garbage = stats.garbage || {};
		const finesse = stats.finesse || {};
		const pieces = Number(stats.piecesplaced) || 0;
		const perfectPieces = Number(finesse.perfectpieces) || 0;
		return {
			pieces,
			lines: Number(stats.lines) || 0,
			attack: Number(garbage.attack) || 0,
			garbageSent: Number(garbage.sent) || 0,
			garbageReceived: Number(garbage.received) || 0,
			garbageCleared: Number(garbage.cleared) || 0,
			combo: Number(stats.combo) || 0,
			b2b: Number(stats.btb) || 0,
			// The replay's topcombo/topbtb are 1-based; the live tracker and
			// the game's session stats use 0-based maxima.
			maxCombo: Math.max(0, (Number(stats.topcombo) || 0) - 1),
			maxB2B: Math.max(0, (Number(stats.topbtb) || 0) - 1),
			singles: Number(clears.singles) || 0,
			doubles: Number(clears.doubles) || 0,
			triples: Number(clears.triples) || 0,
			quads: Number(clears.quads) || 0,
			tspins: Number(stats.tspins) || 0,
			miniTspins: Number(clears.minitspins) || 0,
			perfectClears: Number(clears.allclear) || 0,
			holds: Number(stats.holds) || 0,
			keys: Number(stats.inputs) || 0,
			perfectPieces,
			faultyPieces: Math.max(0, pieces - perfectPieces),
			finesseFaults: Number(finesse.faults) || 0,
			finalTimeMs: Number(stats.finaltime) || 0,
		};
	}

	function parseReplay(text) {
		let data;
		try {
			data = JSON.parse(text);
		} catch (error) {
			throw new Error('Not valid JSON.');
		}
		if (data && data.replay && Array.isArray(data.replay.rounds)) {
			return parseVersusReplay(data);
		}
		if (data && data.data && Array.isArray(data.data.events)) {
			return parseSoloReplay(data);
		}
		throw new Error('Not a TETR.IO match replay (.ttrm).');
	}

	function parseVersusReplay(data) {
		const users = Array.isArray(data.users) ? data.users : [];
		const userById = new Map(users.map((user) => [user.id, user]));
		const rounds = data.replay.rounds.map((round, roundIndex) => {
			const players = round.map((entry, playerIndex) => {
				const options = entry.replay?.options || {};
				const events = Array.isArray(entry.replay?.events)
					? entry.replay.events
					: [];
				const frames = Number(entry.replay?.frames) || 0;
				const results = entry.replay?.results || {};
				const user = userById.get(entry.id);
				const player = {
					id: entry.id,
					username:
						entry.username ||
						user?.username ||
						`Player ${playerIndex + 1}`,
					gameid: options.gameid,
					naturalorder: entry.naturalorder ?? playerIndex,
					alive: entry.alive !== false,
					lifetime: entry.lifetime ?? 0,
					options,
					events,
					frames,
					results,
					finalStats: normalizeFinalStats(results.stats || {}),
				};
				player.engineConfig = buildEngineConfig(player, round, data);
				return player;
			});
			const maxFrame = players.reduce(
				(max, player) => Math.max(max, player.frames),
				0
			);
			const winner =
				players.find(
					(player) => player.results?.gameoverreason === 'winner'
				) || null;
			return { index: roundIndex, players, maxFrame, winner };
		});
		return {
			kind: 'versus',
			id: data.id,
			gamemode: data.gamemode,
			ts: data.ts,
			users,
			leaderboard: data.replay.leaderboard || [],
			rounds,
			raw: data,
		};
	}

	function normalizeSoloStats(stats) {
		const clears = stats.clears || {};
		const garbage = stats.garbage || {};
		const finesse = stats.finesse || {};
		const pieces = Number(stats.piecesplaced) || 0;
		const perfectPieces = Number(finesse.perfectpieces) || 0;
		return {
			pieces,
			lines: Number(stats.lines) || 0,
			attack: Number(garbage.attack) || 0,
			garbageSent: Number(garbage.sent) || 0,
			garbageReceived: Number(garbage.received) || 0,
			garbageCleared: Number(garbage.cleared) || 0,
			combo: Number(stats.combo) || 0,
			b2b: Number(stats.btb) || 0,
			maxCombo: Math.max(0, (Number(stats.topcombo) || 0) - 1),
			maxB2B: Math.max(0, (Number(stats.topbtb) || 0) - 1),
			singles: Number(clears.singles) || 0,
			doubles: Number(clears.doubles) || 0,
			triples: Number(clears.triples) || 0,
			quads: Number(clears.quads) || 0,
			tspins: Number(stats.tspins) || 0,
			miniTspins: Number(clears.minitspins) || 0,
			perfectClears: Number(clears.allclear) || 0,
			holds: Number(stats.holds) || 0,
			keys: Number(stats.inputs) || 0,
			perfectPieces,
			faultyPieces: Math.max(0, pieces - perfectPieces),
			finesseFaults: Number(finesse.faults) || 0,
			finalTimeMs: Number(stats.finalTime) || 0,
		};
	}

	function buildSoloEngineConfig(player, data) {
		const o = player.options || {};
		const date = data.ts ? new Date(data.ts) : new Date();
		return {
			board: {
				width: o.boardwidth ?? 10,
				height: o.boardheight ?? 20,
				buffer: o.boardbuffer ?? 20,
			},
			kickTable: normalizeKickTable(o.kickset),
			options: {
				comboTable: normalizeComboTable(o.combotable),
				garbageBlocking: normalizeGarbageBlocking(o.garbageblocking),
				clutch: o.clutch ?? true,
				garbageTargetBonus: o.garbagetargetbonus ?? 'none',
				spinBonuses: normalizeSpinBonuses(o.spinbonuses),
				stock: o.stock ?? 0,
			},
			queue: {
				minLength: 10,
				seed: o.seed,
				type: normalizeBagType(o.bagtype),
			},
			garbage: {
				bombs: o.usebombs ?? false,
				cap: {
					absolute: o.garbageabsolutecap ?? 0,
					increase: o.garbagecapincrease ?? 0,
					max: o.garbagecapmax ?? 40,
					value: o.garbagecap ?? 8,
					marginTime: o.garbagecapmargin ?? 0,
				},
				boardWidth: o.boardwidth ?? 10,
				garbage: {
					speed: o.garbagespeed ?? 20,
					holeSize: o.garbageholesize ?? 1,
				},
				messiness: {
					change: o.messiness_change ?? 1,
					nosame: o.messiness_nosame ?? false,
					timeout: o.messiness_timeout ?? 0,
					within: o.messiness_inner ?? 0,
					center: o.messiness_center ?? false,
				},
				multiplier: {
					value: o.garbagemultiplier ?? 1,
					increase: o.garbageincrease ?? 0.008,
					marginTime: o.garbagemargin ?? 10800,
				},
				specialBonus: o.garbagespecialbonus ?? false,
				openerPhase: o.openerphase ?? 0,
				seed: o.seed,
				rounding: o.roundmode ?? 'down',
			},
			gravity: {
				value: o.g ?? 0.02,
				increase: o.gincrease ?? 0,
				marginTime: o.gmargin ?? 0,
			},
			handling: {
				arr: o.handling?.arr ?? 0,
				das: o.handling?.das ?? 6,
				dcd: o.handling?.dcd ?? 0,
				sdf: o.handling?.sdf ?? 41,
				safelock: o.handling?.safelock ?? false,
				cancel: o.handling?.cancel ?? false,
				may20g: o.handling?.may20g ?? true,
				irs: o.handling?.irs ?? 'tap',
				ihs: o.handling?.ihs ?? 'tap',
			},
			b2b: {
				chaining: !o.b2bcharging,
				charging: o.b2bcharging
					? { at: o.b2bcharge_at ?? 4, base: o.b2bcharge_base ?? 3 }
					: false,
			},
			pc: {
				b2b: o.allclear_b2b ?? 0,
				garbage: o.allclear_garbage ?? 0,
			},
			misc: {
				allowed: {
					hardDrop: o.allow_harddrop ?? true,
					spin180: o.allow180 ?? true,
					hold: o.display_hold ?? true,
					retry: false,
					undo: false,
				},
				infiniteHold: o.infinite_hold ?? false,
				movement: {
					infinite: false,
					lockResets: o.lockresets ?? 15,
					lockTime: o.locktime ?? 30,
					may20G: o.gravitymay20g ?? true,
				},
				username: o.username,
				stride: o.stride ?? false,
				date,
			},
		};
	}

	function parseSoloReplay(data) {
		const events = Array.isArray(data.data?.events) ? data.data.events : [];
		const full = events.find((event) => event.type === 'full');
		if (!full || !full.data) {
			throw new Error('Solo replay is missing its initial full event.');
		}
		const options = full.data.options || {};
		const frames = Number(data.data?.frames) || 0;
		const endcontext = data.endcontext || {};
		const user = data.user || {};
		const player = {
			id: user._id || data._id || 'solo',
			username: user.username || 'Player',
			gameid: 0,
			naturalorder: 0,
			alive: true,
			lifetime: (frames * 1000) / 60,
			options,
			events,
			frames,
			results: {
				gameoverreason: 'winner',
				stats: normalizeSoloStats(endcontext),
			},
			finalStats: normalizeSoloStats(endcontext),
			solo: {
				full,
				gametype: data.gametype || 'custom',
				customtype: data.customtype || null,
				endcontext,
			},
		};
		player.engineConfig = buildSoloEngineConfig(player, data);
		const round = {
			index: 0,
			players: [player],
			maxFrame: frames,
			winner: player,
		};
		return {
			kind: 'solo',
			id: data._id || data.shortid || null,
			gamemode: data.gametype || 'custom',
			customtype: data.customtype || null,
			ts: data.ts,
			users: [user],
			leaderboard: [],
			rounds: [round],
			raw: data,
		};
	}

	function convertSoloBoard(rows) {
		if (!Array.isArray(rows) || !rows.length) return null;
		const height = rows.length;
		const width = rows[0]?.length || 10;
		const board = [];
		for (let y = 0; y < height; y++) {
			const row = [];
			for (let x = 0; x < width; x++) {
				const cell = rows[height - 1 - y]?.[x];
				row.push(
					cell ? { mino: String(cell).toLowerCase(), connections: 0 } : null
				);
			}
			board.push(row);
		}
		return board;
	}

	function applySoloInitialState(engine, player) {
		const full = player.solo?.full;
		if (!full || !full.data) return;
		const game = full.data.game || {};
		const stats = full.data.stats || {};
		if (Array.isArray(game.board)) {
			const board = convertSoloBoard(game.board);
			if (board) engine.board.state = board;
		}
		if (Array.isArray(game.bag) && game.bag.length) {
			const bag = game.bag.map((mino) => String(mino).toLowerCase());
			const active = bag[0];
			if (active) engine.initiatePiece(active, true, false);
			const queue = bag.slice(1);
			if (queue.length) engine.queue.splice(0, engine.queue.length, ...queue);
		}
		if (game.hold) {
			engine.held = game.hold.piece
				? String(game.hold.piece).toLowerCase()
				: null;
			engine.holdLocked = !!game.hold.locked;
		}
		if (game.falling) {
			const falling = game.falling;
			const symbol = String(falling.type || '').toLowerCase();
			if (symbol) {
				engine.initiatePiece(symbol, true, false);
				if (engine.falling) {
					engine.falling.location = [
						Number(falling.x) || 0,
						Number(falling.y) || 0,
					];
					engine.falling.rotation = Number(falling.r) || 0;
					engine.falling.locking = Number(falling.locking) || 0;
					engine.falling.lockResets = Number(falling.lockresets) || 0;
					engine.falling.rotResets = Number(falling.rotresets) || 0;
					engine.falling.safeLock = Number(falling.safelock) || 0;
					engine.falling.highestY = Number(falling.hy) || 0;
					engine.falling.irs = Number(falling.irs) || 0;
					engine.falling.keys = Number(falling.keys) || 0;
				}
			}
		}
		if (stats) {
			engine.stats.pieces = Number(stats.piecesplaced) || 0;
			engine.stats.lines = Number(stats.lines) || 0;
			engine.stats.combo = (Number(stats.combo) || 0) - 1;
			engine.stats.b2b = (Number(stats.btb) || 0) - 1;
			const garbage = stats.garbage || {};
			engine.stats.garbage.sent = Number(garbage.sent) || 0;
			engine.stats.garbage.attack = Number(garbage.attack) || 0;
			engine.stats.garbage.receive = Number(garbage.received) || 0;
			engine.stats.garbage.cleared = Number(garbage.cleared) || 0;
			if (stats.time && Number.isFinite(Number(stats.time.frameoffset))) {
				engine.time.frameOffset = Number(stats.time.frameoffset);
			}
		}
	}

	function soloLevel(lines, levelspeed) {
		const speed = Number(levelspeed) || 0;
		if (speed <= 0) return 1;
		let level = 1;
		let needed = 0;
		while (lines >= needed + Math.ceil(5 * speed * level)) {
			needed += Math.ceil(5 * speed * level);
			level++;
		}
		return level;
	}

	function soloGravityValue(options, lines) {
		if (!options) return null;
		if (!options.levels) return Number(options.g ?? 0.02);
		if (options.levelstatic) return Number(options.g ?? 0.02);
		const level = soloLevel(lines, options.levelspeed);
		const base = Number(options.gbase);
		const speed =
			Number(options.gspeed) || Number(options.levelspeed) || 0;
		if (!Number.isFinite(base)) return Number(options.g ?? 0.02);
		return Math.max(0.0001, (base + speed * (level - 1)) * 0.02);
	}

	function applySoloSurvival(engine, player, frame) {
		const options = player.options || {};
		const mode = options.survivalmode;
		if (!mode || mode === 'none') return;
		const interval = Number(options.survival_timer_itv) || 0;
		if (mode !== 'timer' || interval <= 0) return;
		if (frame <= 0 || frame % interval !== 0) return;
		const cap = Number(options.survival_cap) || 0;
		if (cap > 0 && engine.garbageQueue.size >= cap) return;
		const max = Number(options.survival_layer_amt) || 1;
		const min = Number(options.survival_layer_min) || max;
		const amount = options.survival_layer_non
			? Math.max(1, min + Math.floor(Math.random() * (max - min + 1)))
			: max;
		engine.receiveGarbage({
			frame,
			amount,
			size: 1,
			cid: frame,
			gameid: 0,
			confirmed: true,
		});
	}

	function splitFrames(events, totalFrames) {
		const maxFrame = Math.max(0, Number(totalFrames) || 0);
		const frames = new Array(maxFrame + 1);
		for (let i = 0; i <= maxFrame; i++) frames[i] = [];
		for (const event of events) {
			const frame = Number(event.frame);
			if (!Number.isFinite(frame) || frame < 0 || frame > maxFrame) continue;
			frames[frame].push(event);
		}
		return { frames, maxFrame };
	}

	function normalizeY(cells) {
		let minY = Infinity;
		for (const [, y] of cells) if (y < minY) minY = y;
		return cells
			.map(([x, y]) => [x, y - minY])
			.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	}

	function sameCells(a, b) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
		}
		return true;
	}

	// Find the zztetris rotation/column that produces the same shape as the
	// engine's falling piece. The vertical offset is irrelevant for finesse.
	function findZztetrisPlacement(piece, engineCells) {
		if (typeof pieces === 'undefined' || !pieces[piece]) return null;
		if (!engineCells || !engineCells.length) return null;
		const target = normalizeY(engineCells);
		for (let rot = 0; rot < 4; rot++) {
			const matrix = pieces[piece][rot];
			if (!matrix) continue;
			const base = [];
			for (let row = 0; row < 4; row++) {
				for (let col = 0; col < 4; col++) {
					if (matrix[row][col] == 1) base.push([col, -row]);
				}
			}
			const shape = normalizeY(base);
			for (let x = 0; x < 10; x++) {
				const shifted = shape.map(([cx, cy]) => [cx + x, cy]);
				if (sameCells(shifted, target)) {
					return { rot, x, y: 0 };
				}
			}
		}
		return null;
	}

	function findZztetrisPlacementOnBoard(piece, engineCells, boardHeight = 40) {
		if (typeof pieces === 'undefined' || !pieces[piece]) return null;
		if (!engineCells || !engineCells.length) return null;
		const target = engineCells
			.map(([x, y]) => [x, boardHeight - 1 - y])
			.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
		for (let rot = 0; rot < 4; rot++) {
			const matrix = pieces[piece][rot];
			if (!matrix) continue;
			for (let x = 0; x < 10; x++) {
				for (let y = 0; y < boardHeight; y++) {
					const cells = [];
					for (let row = 0; row < 4; row++) {
						for (let col = 0; col < 4; col++) {
							if (matrix[row][col] == 1) {
								cells.push([x + col, y + row]);
							}
						}
					}
					cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
					if (sameCells(cells, target)) return { rot, x, y };
				}
			}
		}
		return null;
	}

	function buildFinesseTable() {
		try {
			if (typeof pieces === 'undefined' || typeof kicksets === 'undefined') {
				return null;
			}
			return root.ZZStatsCore.buildFinesseTable(
				pieces,
				kicksets,
				3,
				'SRS+'
			);
		} catch (error) {
			console.warn('replay finesse table unavailable:', error);
			return null;
		}
	}

	class StatsTracker {
		constructor(engine) {
			this.engine = engine;
			this.state = root.ZZStatsCore.createState(0);
			this.state.lastAttack = 0;
			this.finesseTable = null;
			this.lastPlacement = null;
			this.prevB2B = -1;
			this.prevCombo = -1;
			this.lockInputs = 0;
			this.lockSoftDropExempt = false;
			this.handlers = {
				fallingNew: (event) => this.onFallingNew(event),
				lockPre: () => this.onLockPre(),
				lock: (res) => this.onLock(res),
				garbageTank: () => this.onGarbageChange(),
				garbageCancel: (event) => {
					this.onGarbageChange();
					this.onGarbageCancel(event);
				},
			};
			engine.events.on('falling.new', this.handlers.fallingNew);
			engine.events.on('falling.lock.pre', this.handlers.lockPre);
			engine.events.on('falling.lock', this.handlers.lock);
			engine.events.on('garbage.tank', this.handlers.garbageTank);
			engine.events.on('garbage.cancel', this.handlers.garbageCancel);
		}

		destroy() {
			const events = this.engine.events;
			events.off('falling.new', this.handlers.fallingNew);
			events.off('falling.lock.pre', this.handlers.lockPre);
			events.off('falling.lock', this.handlers.lock);
			events.off('garbage.tank', this.handlers.garbageTank);
			events.off('garbage.cancel', this.handlers.garbageCancel);
		}

		onFallingNew({ piece, isHold }) {
			this.state.currentPiece = String(piece || '').toUpperCase();
			this.state.currentInputs = 0;
			this.state.softDropExempt = false;
			this.prevB2B = this.engine.stats.b2b;
			this.prevCombo = this.engine.stats.combo;
			if (isHold) this.state.holds += 1;
		}

		onLockPre() {
			// The engine emits falling.lock after nextPiece(), which resets the
			// per-piece input counters. Capture them here, before the reset.
			this.lockInputs = this.state.currentInputs;
			this.lockSoftDropExempt = this.state.softDropExempt;
			const falling = this.engine.falling;
			if (!falling) {
				this.lastPlacement = null;
				return;
			}
			this.lastPlacement = {
				symbol: falling.symbol,
				cells: falling.absoluteBlocks.map(([x, y]) => [x, y]),
			};
		}

		onLock(res) {
			const placement = this.lastPlacement;
			this.lastPlacement = null;
			const piece = String(res.mino || '').toUpperCase();
			const cleared = Number(res.lines) || 0;
			const spin = res.spin || 'none';
			const tspin = spin !== 'none' && piece === 'T';
			const mini = spin === 'mini' && piece === 'T';
			const allspinMini = spin !== 'none' && piece !== 'T';
			const pc = !!this.engine.board.perfectClear;
			const b2b = Math.max(0, Number(res.stats?.b2b) || 0);
			const combo = Math.max(0, Number(res.stats?.combo) || 0);
			const b2bBefore = Math.max(0, Number(this.prevB2B) || 0);
			const comboBefore = Math.max(0, Number(this.prevCombo) || 0);
			let rot = 0;
			let x = 0;
			let y = 0;
			let shapeKey = null;
			if (placement) {
				const found = findZztetrisPlacement(piece, placement.cells);
				if (found) {
					rot = found.rot;
					x = found.x;
					y = found.y;
					if (typeof pieces !== 'undefined') {
						shapeKey = root.ZZStatsCore.shapeKeyForPlacement(
							pieces,
							piece,
							rot,
							x,
							y
						);
					}
				}
			}
			const info = {
				piece,
				rot,
				x,
				y,
				cleared,
				tspin,
				mini,
				allspinMini,
				pc,
				b2b,
				combo,
				b2bBefore,
				comboBefore,
				garbageCleared: Number(res.garbageCleared) || 0,
				shapeKey,
				skipFinesse: !shapeKey,
				isSpin: tspin || allspinMini,
				exemptSpins: false,
			};
			this.state.currentInputs = this.lockInputs;
			this.state.softDropExempt = this.lockSoftDropExempt;
			root.ZZStatsCore.applyPlacement(this.state, info, this.finesseTable);
			this.state.softDropExempt = false;
			const stats = res.stats || {};
			const garbage = stats.garbage || {};
			this.state.lastAttack = (res.rawGarbage || []).reduce(
				(sum, value) => sum + value,
				0
			);
			this.state.pieces = Number(stats.pieces) || this.state.pieces;
			this.state.lines = Number(stats.lines) || this.state.lines;
			this.state.attack = Number(garbage.attack) || 0;
			this.state.garbageSent = Number(garbage.sent) || 0;
			this.state.garbageReceived = Number(garbage.receive) || 0;
			this.state.garbageCleared = Number(garbage.cleared) || 0;
			this.state.maxCombo = Math.max(this.state.maxCombo, combo);
			this.state.maxB2B = Math.max(this.state.maxB2B, b2b);
			this.prevB2B = stats.b2b;
			this.prevCombo = stats.combo;
		}

		applyInitialStats(stats) {
			if (!stats) return;
			const clears = stats.clears || {};
			const garbage = stats.garbage || {};
			const finesse = stats.finesse || {};
			const pieces = Number(stats.piecesplaced) || 0;
			const perfectPieces = Number(finesse.perfectpieces) || 0;
			this.state.pieces = pieces;
			this.state.lines = Number(stats.lines) || 0;
			this.state.attack = Number(garbage.attack) || 0;
			this.state.garbageSent = Number(garbage.sent) || 0;
			this.state.garbageReceived = Number(garbage.received) || 0;
			this.state.garbageCleared = Number(garbage.cleared) || 0;
			this.state.maxCombo = Math.max(
				0,
				(Number(stats.topcombo) || 0) - 1
			);
			this.state.maxB2B = Math.max(0, (Number(stats.topbtb) || 0) - 1);
			this.state.singles = Number(clears.singles) || 0;
			this.state.doubles = Number(clears.doubles) || 0;
			this.state.triples = Number(clears.triples) || 0;
			this.state.quads = Number(clears.quads) || 0;
			this.state.tspins = Number(stats.tspins) || 0;
			this.state.miniTspins = Number(clears.minitspins) || 0;
			this.state.perfectClears = Number(clears.allclear) || 0;
			this.state.holds = Number(stats.holds) || 0;
			this.state.keys = Number(stats.inputs) || 0;
			this.state.perfectPieces = perfectPieces;
			this.state.faultyPieces = Math.max(0, pieces - perfectPieces);
			this.state.finesseFaults = Number(finesse.faults) || 0;
		}

		onGarbageChange() {
			// The pending garbage display reads engine.garbageQueue.size directly.
		}

		onGarbageCancel(event) {
			const amount = Math.max(
				0,
				Math.floor(Number(event?.amount) || 0)
			);
			if (amount > 0) this.state.garbageCanceled += amount;
		}

		onKeyEvent(event) {
			if (!event || !event.data) return;
			const key = event.data.key;
			if (event.type === 'keydown') {
				if (KEY_TO_ACTION[key]) this.state.keys += 1;
				if (
					key === 'moveLeft' ||
					key === 'moveRight' ||
					key === 'rotateCW' ||
					key === 'rotateCCW'
				) {
					this.state.currentInputs += 1;
				} else if (key === 'rotate180') {
					this.state.currentInputs += 2;
				}
			} else if (event.type === 'keyup' && key === 'softDrop') {
				this.state.softDropExempt = true;
			}
		}

		snapshot() {
			return deepCopy(this.state);
		}

		restore(snapshot) {
			if (!snapshot) return;
			// Copy every field, including replay-only fields such as
			// garbageSent that are not part of ZZStatsCore.createState().
			for (const key of Object.keys(snapshot)) {
				this.state[key] = snapshot[key];
			}
		}

		getStatValue(id, now, extra) {
			if (id === 'garbageSent') {
				return this.state.garbageSent ?? this.state.attack;
			}
			return root.ZZStatsCore.getStatValue(this.state, id, now, extra);
		}
	}

	function createRoundEngines(round) {
		return round.players.map((player) => {
			const engine = new root.ZZReplayEngine.Engine(player.engineConfig);
			if (player.solo) {
				applySoloInitialState(engine, player);
				if (
					player.options?.survivalmode &&
					player.options.survivalmode !== 'none'
				) {
					const messiness =
						Math.max(
							0,
							Math.min(100, Number(player.options.survival_messiness) || 0)
						) / 100;
					engine.garbageQueue.options.messiness.change = messiness;
					engine.garbageQueue.options.messiness.within = messiness;
				}
			}
			const tracker = new StatsTracker(engine);
			if (player.solo?.full?.data?.stats) {
				tracker.applyInitialStats(player.solo.full.data.stats);
			}
			tracker.finesseTable = buildFinesseTable();
			const { frames, maxFrame } = splitFrames(player.events, player.frames);
			const soloGravity = player.solo
				? (lines) => soloGravityValue(player.options, lines)
				: null;
			const soloSurvival = player.solo
				? (eng, frame) => applySoloSurvival(eng, player, frame)
				: null;
			return {
				player,
				engine,
				tracker,
				frames,
				maxFrame,
				soloGravity,
				soloSurvival,
			};
		});
	}

	function tickPlayer(entry, targetFrame) {
		const { engine, tracker, frames, maxFrame, soloGravity, soloSurvival } =
			entry;
		while (engine.frame <= targetFrame && engine.frame <= maxFrame) {
			if (soloGravity) {
				const value = soloGravity(engine.stats.lines);
				if (value !== null) engine.dynamic.gravity.set(value);
			}
			if (soloSurvival) soloSurvival(engine, engine.frame);
			const frameEvents = frames[engine.frame] || [];
			for (const event of frameEvents) tracker.onKeyEvent(event);
			engine.tick(frameEvents);
		}
	}

	function stripPractice(snapshot) {
		if (!snapshot) return snapshot;
		snapshot.practice = {
			retry: false,
			retryIter: 0,
			lastPiece: null,
			undo: [],
			redo: [],
		};
		return snapshot;
	}

	function buildKeyframe(entries, frame) {
		return {
			frame,
			engines: entries.map((entry) =>
				stripPractice(entry.engine.snapshot())
			),
			trackers: entries.map((entry) => entry.tracker.snapshot()),
		};
	}

	function restoreKeyframe(entries, keyframe) {
		for (let i = 0; i < entries.length; i++) {
			entries[i].engine.fromSnapshot(keyframe.engines[i]);
			entries[i].tracker.restore(keyframe.trackers[i]);
		}
	}

	function findKeyframe(keyframes, frame) {
		let best = null;
		for (const keyframe of keyframes) {
			if (keyframe.frame <= frame && (!best || keyframe.frame > best.frame)) {
				best = keyframe;
			}
		}
		return best;
	}

	function capturePracticeState(engine, tracker, source) {
		const snapshot = stripPractice(engine.snapshot());
		const config = deepCopy(engine.initializer);
		config.multiplayer = undefined;
		config.misc.allowed.undo = false;
		config.misc.allowed.retry = false;
		return {
			version: 1,
			source,
			config,
			snapshot,
			tracker: tracker.snapshot(),
			elapsedMs: (engine.frame / 60) * 1000,
		};
	}

	function savePracticeState(state) {
		sessionStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(state));
	}

	function readPracticeState() {
		try {
			const raw = sessionStorage.getItem(PRACTICE_STORAGE_KEY);
			if (!raw) return null;
			return JSON.parse(raw);
		} catch (error) {
			return null;
		}
	}

	function clearHeldInputs(engine) {
		if (!engine || !engine.input) return;
		engine.input.lShift.held = false;
		engine.input.rShift.held = false;
		engine.input.keys.softDrop = false;
		engine.input.keys.hold = false;
		engine.input.keys.rotateCW = false;
		engine.input.keys.rotateCCW = false;
		engine.input.keys.rotate180 = false;
		engine.input.lastShift = -1;
		engine.input.firstInputTime = -1;
		engine.input.time = { start: 0, zero: true, locked: false, prev: 0 };
		engine.input.lastPieceTime = 0;
		engine.state = 0;
		resetInputTimers(engine);
	}

	function resetInputTimers(engine) {
		if (!engine || !engine.input) return;
		engine.input.lShift.das = 0;
		engine.input.lShift.arr = 0;
		engine.input.rShift.das = 0;
		engine.input.rShift.arr = 0;
	}

	function createPracticeEngine(state) {
		const config = deepCopy(state.config);
		if (config.misc && config.misc.date) {
			config.misc.date = new Date(config.misc.date);
		}
		config.multiplayer = undefined;
		config.misc.allowed.undo = false;
		config.misc.allowed.retry = false;
		const engine = new root.ZZReplayEngine.Engine(config);
		engine.fromSnapshot(state.snapshot);
		clearHeldInputs(engine);
		const tracker = new StatsTracker(engine);
		tracker.restore(state.tracker);
		tracker.finesseTable = buildFinesseTable();
		return { engine, tracker, config };
	}

	function getUserConfig() {
		const defaults = {
			das: 160,
			arr: 30,
			sdr: 15,
			ctrl: Object.assign({}, DEFAULT_CTRL),
		};
		try {
			if (localStorage.getItem('version') !== '2023-05-02a') {
				return defaults;
			}
			const raw = localStorage.getItem('config');
			if (!raw) return defaults;
			const stored = JSON.parse(raw);
			if (!Array.isArray(stored)) return defaults;
			const codes = [
				'L',
				'R',
				'SD',
				'HD',
				'HL',
				'CW',
				'CCW',
				'R180',
				'RE',
				'UNDO',
				'REDO',
			];
			const ctrl = {};
			for (let i = 0; i < 11; i++) {
				if (stored[i]) ctrl[stored[i]] = codes[i];
			}
			ctrl[stored[16] || 'KeyO'] = 'RESET_SESSION';
			ctrl[stored[17] || 'KeyU'] = 'RESET_QUEUE';
			ctrl[stored[18] || 'KeyI'] = 'RESET_QUEUE_HOLD';
			const das = parseInt(stored[11], 10);
			const arr = parseInt(stored[12], 10);
			const sdr = parseInt(stored[13], 10);
			return {
				das: Number.isFinite(das) ? das : defaults.das,
				arr: Number.isFinite(arr) ? arr : defaults.arr,
				sdr: Number.isFinite(sdr) ? sdr : defaults.sdr,
				ctrl,
			};
		} catch (error) {
			return defaults;
		}
	}

	function getUserKeyMap(userConfig) {
		const map = {};
		const ctrl = userConfig?.ctrl || DEFAULT_CTRL;
		for (const [code, action] of Object.entries(ctrl)) {
			const key = ACTION_TO_KEY[action];
			if (key) map[code] = key;
		}
		return map;
	}

	function applyUserHandling(engine, userConfig) {
		if (!engine || !userConfig) return;
		engine.handling = Object.assign({}, engine.handling, {
			das: userConfig.das / FRAME_MS,
			arr: userConfig.arr / FRAME_MS,
			sdf: userConfig.sdr / FRAME_MS,
			dcd: 0,
		});
		resetInputTimers(engine);
	}

	function applyReplayHandling(engine, config) {
		if (!engine || !config) return;
		engine.handling = Object.assign({}, config.handling);
		resetInputTimers(engine);
	}

	function drawCell(ctx, x, y, size, color) {
		ctx.fillStyle = color;
		ctx.fillRect(x * size + 1, y + 1, size - 2, size - 2);
	}

	function drawGhostCell(ctx, x, y, size, color) {
		ctx.strokeStyle = color;
		ctx.globalAlpha = 0.5;
		ctx.strokeRect(x * size + 1.5, y + 1.5, size - 3, size - 3);
		ctx.globalAlpha = 1;
	}

	function canPlace(engine, cells) {
		for (const [x, y] of cells) {
			if (
				x < 0 ||
				x >= engine.board.width ||
				y < 0 ||
				y >= engine.board.fullHeight
			) {
				return false;
			}
			if (engine.board.state[y]?.[x]) return false;
		}
		return true;
	}

	function findGhostY(engine) {
		if (!engine.falling) return null;
		let y = engine.falling.y;
		while (y > 0) {
			const cells = engine.falling.absoluteAt({ y: y - 1 });
			if (!canPlace(engine, cells)) break;
			y--;
		}
		return y;
	}

	function renderBoard(canvas, engine, options = {}) {
		if (!canvas || !engine) return;
		const cellSize = options.cellSize || 20;
		const width = engine.board.width;
		const height = engine.board.height;
		const visibleRows = height + 3;
		const canvasWidth = width * cellSize;
		const canvasHeight = visibleRows * cellSize;
		if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
		if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, canvasWidth, canvasHeight);
		ctx.fillStyle = BG;
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);

		ctx.strokeStyle = GRID;
		ctx.lineWidth = 1;
		for (let x = 0; x <= width; x++) {
			ctx.beginPath();
			ctx.moveTo(x * cellSize + 0.5, 0);
			ctx.lineTo(x * cellSize + 0.5, canvasHeight);
			ctx.stroke();
		}
		for (let y = 0; y <= visibleRows; y++) {
			ctx.beginPath();
			ctx.moveTo(0, y * cellSize + 0.5);
			ctx.lineTo(canvasWidth, y * cellSize + 0.5);
			ctx.stroke();
		}

		for (let y = 0; y < visibleRows; y++) {
			const canvasY = (visibleRows - 1 - y) * cellSize;
			for (let x = 0; x < width; x++) {
				const cell = engine.board.state[y]?.[x];
				if (cell) {
					drawCell(
						ctx,
						x,
						canvasY,
						cellSize,
						COLORS[cell.mino] || COLORS.gb
					);
				} else if (y >= height) {
					drawCell(ctx, x, canvasY, cellSize, GREY);
				}
			}
		}

		if (options.showGhost !== false && engine.falling) {
			const ghostY = findGhostY(engine);
			if (ghostY !== null) {
				const cells = engine.falling.absoluteAt({ y: ghostY });
				for (const [x, y] of cells) {
					if (y < 0 || y >= visibleRows) continue;
					const canvasY = (visibleRows - 1 - y) * cellSize;
					drawGhostCell(
						ctx,
						x,
						canvasY,
						cellSize,
						COLORS[engine.falling.symbol] || '#fff'
					);
				}
			}
		}

		if (engine.falling) {
			const cells = engine.falling.absoluteBlocks;
			for (const [x, y] of cells) {
				if (y < 0 || y >= visibleRows) continue;
				const canvasY = (visibleRows - 1 - y) * cellSize;
				drawCell(
					ctx,
					x,
					canvasY,
					cellSize,
					COLORS[engine.falling.symbol] || '#fff'
				);
			}
		}
	}

	function renderQueue(canvas, engine, count = 5, cellSize = 16, width = cellSize * 4) {
		if (!canvas || !engine) return;
		const slotHeight = cellSize * 3;
		const height = slotHeight * count;
		if (canvas.width !== width) canvas.width = width;
		if (canvas.height !== height) canvas.height = height;
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, width, height);
		const queue = engine.queue.slice(0, count);
		for (let i = 0; i < queue.length; i++) {
			const piece = queue[i];
			const preview = engine.getPreview(piece);
			if (!preview) continue;
			const offsetX = (width - preview.w * cellSize) / 2;
			const offsetY =
				i * slotHeight + (slotHeight - preview.h * cellSize) / 2;
			for (const [x, y] of preview.data) {
				drawCell(
					ctx,
					x + offsetX / cellSize,
					offsetY + y * cellSize,
					cellSize,
					COLORS[piece] || '#fff'
				);
			}
		}
	}

	function renderHold(canvas, engine, cellSize = 16, width = cellSize * 4, height = cellSize * 3) {
		if (!canvas || !engine) return;
		if (canvas.width !== width) canvas.width = width;
		if (canvas.height !== height) canvas.height = height;
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, width, height);
		if (!engine.held) return;
		const preview = engine.getPreview(engine.held);
		if (!preview) return;
		const offsetX = (width - preview.w * cellSize) / 2;
		const offsetY = (height - preview.h * cellSize) / 2;
		for (const [x, y] of preview.data) {
			drawCell(
				ctx,
				x + offsetX / cellSize,
				offsetY + y * cellSize,
				cellSize,
				COLORS[engine.held] || '#fff'
			);
		}
	}

	function renderGarbageBar(canvas, engine, cellSize = 20) {
		if (!canvas || !engine) return;
		const width = cellSize;
		const height = (engine.board.height + 3) * cellSize;
		if (canvas.width !== width) canvas.width = width;
		if (canvas.height !== height) canvas.height = height;
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, width, height);
		const pending = engine.garbageQueue.size;
		const maxLines = engine.board.height + 3;
		const lines = Math.min(pending, maxLines);
		ctx.fillStyle = '#c33';
		ctx.fillRect(0, height - lines * cellSize, width, lines * cellSize);
		ctx.strokeStyle = '#f66';
		ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
	}

	class StatsPanel {
		constructor(container, options = {}) {
			this.container = container;
			this.options = options;
			this.visible = [];
			this.rows = new Map();
			this.chain = null;
			this.attack = null;
		}

		createChainItem(label) {
			const item = document.createElement('div');
			item.className = 'session-chain-item';
			const labelEl = document.createElement('span');
			labelEl.className = 'session-chain-label';
			labelEl.textContent = label;
			const value = document.createElement('span');
			value.className = 'session-chain-value';
			value.textContent = '0';
			item.appendChild(labelEl);
			item.appendChild(value);
			return { item, value };
		}

		createAttackItem(label) {
			const item = document.createElement('div');
			item.className = 'session-attack-item';
			const labelEl = document.createElement('span');
			labelEl.className = 'session-attack-label';
			labelEl.textContent = label;
			const value = document.createElement('span');
			value.className = 'session-attack-value';
			value.textContent = '0';
			item.appendChild(labelEl);
			item.appendChild(value);
			return { item, value };
		}

		setVisibleStats(ids) {
			this.visible = Array.isArray(ids) ? ids.slice() : [];
			this.container.innerHTML = '';
			this.rows.clear();
			this.chain = null;
			this.attack = null;
			if (this.options.showHeader !== false) {
				const header = document.createElement('div');
				header.className = 'session-header';
				header.textContent = 'SESSION';
				this.container.appendChild(header);
			}
			if (this.options.showChain !== false) {
				const chain = document.createElement('div');
				chain.className = 'session-chain';
				const b2b = this.createChainItem('B2B');
				const combo = this.createChainItem('COMBO');
				chain.appendChild(b2b.item);
				chain.appendChild(combo.item);
				this.container.appendChild(chain);
				this.chain = { b2b: b2b.value, combo: combo.value };
			}
			if (this.options.showAttack !== false) {
				const attack = document.createElement('div');
				attack.className = 'session-attack';
				const damage = this.createAttackItem('DAMAGE');
				const spike = this.createAttackItem('SPIKE');
				attack.appendChild(damage.item);
				attack.appendChild(spike.item);
				this.container.appendChild(attack);
				this.attack = { damage: damage.value, spike: spike.value };
			}
			const stats = document.createElement('div');
			stats.className = 'session-stats';
			this.container.appendChild(stats);
			if (!this.visible.length) {
				const empty = document.createElement('div');
				empty.className = 'session-stat-empty';
				empty.textContent = 'No stats selected';
				stats.appendChild(empty);
				return;
			}
			for (const id of this.visible) {
				const def = root.ZZStatsConfig.STAT_DEFS.find(
					(entry) => entry.id === id
				);
				if (!def) continue;
				const row = document.createElement('div');
				row.className = 'session-stat';
				const label = document.createElement('span');
				label.className = 'session-stat-label';
				label.textContent = def.label;
				const value = document.createElement('span');
				value.className = 'session-stat-value';
				value.textContent = '—';
				row.appendChild(label);
				row.appendChild(value);
				stats.appendChild(row);
				this.rows.set(id, value);
			}
		}

		update(tracker, engine, finalStats, isFinal) {
			const state = isFinal
				? Object.assign({}, tracker.state, finalStats)
				: tracker.state;
			const now = isFinal
				? finalStats.finalTimeMs || 0
				: (engine.frame / 60) * 1000;
			const extra = isFinal
				? { combo: finalStats.combo || 0, b2b: finalStats.b2b || 0 }
				: {
						combo: Math.max(0, engine.stats.combo),
						b2b: Math.max(0, engine.stats.b2b),
					};
			if (this.chain) {
				this.chain.b2b.textContent = String(extra.b2b);
				this.chain.combo.textContent = String(extra.combo);
				this.chain.b2b.classList.toggle(
					'session-chain-value--active',
					extra.b2b > 0
				);
				this.chain.combo.classList.toggle(
					'session-chain-value--active',
					extra.combo > 0
				);
			}
			if (this.attack) {
				this.attack.damage.textContent = String(
					Math.max(0, Math.floor(Number(state.lastAttack) || 0))
				);
				this.attack.spike.textContent = String(
					Math.max(0, Math.floor(Number(engine.spike?.count) || 0))
				);
			}
			for (const [id, valueEl] of this.rows) {
				let value;
				if (id === 'garbageSent') {
					value = state.garbageSent ?? state.attack;
				} else {
					value = root.ZZStatsCore.getStatValue(state, id, now, extra);
				}
				const text = root.ZZStatsCore.formatStat(
					id,
					value,
					root.ZZStatsConfig.STAT_DEFS
				);
				if (valueEl.textContent !== text) valueEl.textContent = text;
			}
		}
	}

	function loadReplayStatsConfig() {
		const defaults = {
			global: root.ZZStatsConfig.loadConfig().visibleStats.slice(),
			players: {},
		};
		try {
			const raw = localStorage.getItem(REPLAY_STATS_KEY);
			if (!raw) return defaults;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed !== 'object') return defaults;
			const known = new Set(
				root.ZZStatsConfig.STAT_DEFS.map((entry) => entry.id)
			);
			const global = Array.isArray(parsed.global)
				? parsed.global.filter((id) => known.has(id))
				: defaults.global;
			const players = {};
			if (parsed.players && typeof parsed.players === 'object') {
				for (const [id, list] of Object.entries(parsed.players)) {
					if (Array.isArray(list)) {
						players[id] = list.filter((stat) => known.has(stat));
					}
				}
			}
			return { global, players };
		} catch (error) {
			return defaults;
		}
	}

	function saveReplayStatsConfig(config) {
		try {
			localStorage.setItem(REPLAY_STATS_KEY, JSON.stringify(config));
		} catch (error) {
			// Storage can be unavailable; the in-memory config still works.
		}
	}

	function getVisibleStats(config, playerId) {
		return config.players[playerId] ?? config.global;
	}

	function formatTime(seconds) {
		const total = Math.max(0, seconds);
		const minutes = Math.floor(total / 60);
		const secs = total - minutes * 60;
		return `${minutes}:${secs.toFixed(3).padStart(6, '0')}`;
	}

	root.ZZReplayCommon = {
		FRAME_MS,
		KEYFRAME_INTERVAL,
		PRACTICE_STORAGE_KEY,
		REPLAY_STATS_KEY,
		COLORS,
		parseReplay,
		parseSoloReplay,
		buildEngineConfig,
		buildSoloEngineConfig,
		normalizeFinalStats,
		normalizeSoloStats,
		convertSoloBoard,
		applySoloInitialState,
		soloGravityValue,
		applySoloSurvival,
		splitFrames,
		findZztetrisPlacement,
		findZztetrisPlacementOnBoard,
		buildFinesseTable,
		StatsTracker,
		createRoundEngines,
		tickPlayer,
		stripPractice,
		buildKeyframe,
		restoreKeyframe,
		findKeyframe,
		capturePracticeState,
		savePracticeState,
		readPracticeState,
		createPracticeEngine,
		clearHeldInputs,
		getUserConfig,
		getUserKeyMap,
		applyUserHandling,
		applyReplayHandling,
		renderBoard,
		renderQueue,
		renderHold,
		renderGarbageBar,
		StatsPanel,
		loadReplayStatsConfig,
		saveReplayStatsConfig,
		getVisibleStats,
		formatTime,
	};
})(typeof globalThis !== 'undefined' ? globalThis : this);
