// Pure session-stat logic: finesse table, attack math, stat values and formatting.
// Kept free of DOM/audio so it can be exercised from Node.
//
// Finesse follows TETR.IO's rule:
//   - the player's cost is +1 per left/right keydown, +1 per CW/CCW, +2 per 180;
//     DAS movement is one input, not one per cell;
//   - the target is the fewest inputs that reach the same final cells on an
//     empty board from spawn, using tap (1), DAS-to-wall (1), CW/CCW (1) and
//     180 (2);
//   - placements are keyed by shape (absolute columns, rows relative to the
//     lowest cell), so symmetric orientations are the same placement;
//   - a piece that soft-dropped when it locked, or whose cells no empty-board
//     path reaches, is not scored and counts as perfect.
(function (root, factory) {
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	root.ZZStatsCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
	'use strict';

	const BOARD_WIDTH = 10;

	// TETRA LEAGUE (Season 2) base attack by line count.
	const NORMAL_ATTACK = [0, 0, 1, 2, 4, 5];
	const TSPIN_ATTACK = [0, 2, 4, 6, 10, 12];
	const MINI_ATTACK = [0, 0, 1, 2, 4, 6];
	const PERFECT_CLEAR_ATTACK = 5;
	const B2B_BONUS = 1;
	const COMBO_BONUS = 0.25;
	const COMBO_FLOOR_SCALE = 1.25;

	function isValidX(pieces, piece, rot, x) {
		const matrix = pieces[piece] && pieces[piece][rot];
		if (!matrix) return false;
		for (let row = 0; row < 4; row++) {
			for (let col = 0; col < 4; col++) {
				if (matrix[row][col] == 1) {
					const boardCol = x + col;
					if (boardCol < 0 || boardCol >= BOARD_WIDTH) return false;
				}
			}
		}
		return true;
	}

	// Absolute columns, rows relative to the lowest cell, sorted. This is the
	// placement identity: two orientations covering the same cells are equal.
	function shapeKeyForPlacement(pieces, piece, rot, x, y) {
		const matrix = pieces[piece] && pieces[piece][rot];
		if (!matrix) return null;
		const cells = [];
		let minRow = Infinity;
		for (let row = 0; row < 4; row++) {
			for (let col = 0; col < 4; col++) {
				if (matrix[row][col] == 1) {
					const absX = x + col;
					const absY = y + row;
					cells.push([absX, absY]);
					if (absY < minRow) minRow = absY;
				}
			}
		}
		if (!cells.length) return null;
		return cells
			.map(([cellX, cellY]) => cellX + ':' + (cellY - minRow))
			.sort()
			.join(' ');
	}

	function firstValidKick(pieces, piece, kickTable, rot, newRot, x) {
		const key = (piece === 'I' ? 'I' : 'N') + rot + '-' + newRot;
		const kicks = kickTable[key] || [[0, 0]];
		for (const kick of kicks) {
			const nextX = x + kick[0];
			if (isValidX(pieces, piece, newRot, nextX)) return nextX;
		}
		return null;
	}

	// Dijkstra over (rotation, column) on an empty board. The result maps each
	// reachable shape to its minimum keypress cost.
	function buildFinesseTable(pieces, kicksets, spawnX = 3, kickName = 'SRS+') {
		const kickTable = (kicksets && kicksets[kickName]) || {};
		const table = {};

		for (const piece of Object.keys(pieces)) {
			const distances = new Map();
			const states = new Map();
			const startKey = '0,' + spawnX;
			distances.set(startKey, 0);
			states.set(startKey, { rot: 0, x: spawnX });
			const queue = [{ cost: 0, seq: 0, key: startKey }];
			let seq = 1;

			while (queue.length) {
				queue.sort((a, b) => a.cost - b.cost || a.seq - b.seq);
				const current = queue.shift();
				if (current.cost > distances.get(current.key)) continue;
				const state = states.get(current.key);
				const moves = [];

				// Taps.
				if (isValidX(pieces, piece, state.rot, state.x - 1)) {
					moves.push({ rot: state.rot, x: state.x - 1, cost: 1 });
				}
				if (isValidX(pieces, piece, state.rot, state.x + 1)) {
					moves.push({ rot: state.rot, x: state.x + 1, cost: 1 });
				}

				// DAS to the wall: one keypress regardless of distance.
				let left = state.x;
				while (isValidX(pieces, piece, state.rot, left - 1)) left--;
				if (left !== state.x) moves.push({ rot: state.rot, x: left, cost: 1 });

				let right = state.x;
				while (isValidX(pieces, piece, state.rot, right + 1)) right++;
				if (right !== state.x) moves.push({ rot: state.rot, x: right, cost: 1 });

				// Rotations. 180 costs two inputs, matching TETR.IO.
				const rotations = [
					{ newRot: (state.rot + 1) % 4, cost: 1 },
					{ newRot: (state.rot + 3) % 4, cost: 1 },
					{ newRot: (state.rot + 2) % 4, cost: 2 },
				];
				for (const rotation of rotations) {
					const nextX = firstValidKick(
						pieces,
						piece,
						kickTable,
						state.rot,
						rotation.newRot,
						state.x
					);
					if (nextX !== null) {
						moves.push({ rot: rotation.newRot, x: nextX, cost: rotation.cost });
					}
				}

				for (const move of moves) {
					const key = move.rot + ',' + move.x;
					const nextCost = current.cost + move.cost;
					if (!distances.has(key) || nextCost < distances.get(key)) {
						distances.set(key, nextCost);
						states.set(key, { rot: move.rot, x: move.x });
						queue.push({ cost: nextCost, seq: seq++, key });
					}
				}
			}

			const shapeTable = {};
			for (const [key, state] of states) {
				const cost = distances.get(key);
				const shape = shapeKeyForPlacement(pieces, piece, state.rot, state.x, 0);
				if (!shape) continue;
				if (!(shape in shapeTable) || cost < shapeTable[shape]) {
					shapeTable[shape] = cost;
				}
			}
			table[piece] = shapeTable;
		}

		return table;
	}

	function getTargetCost(table, piece, shapeKey) {
		const pieceTable = table && table[piece];
		if (!pieceTable || !shapeKey) return null;
		const cost = pieceTable[shapeKey];
		return typeof cost === 'number' ? cost : null;
	}

	function baseAttack(lines, spin) {
		if (spin === 'full') {
			if (lines <= 5) return TSPIN_ATTACK[lines] || 0;
			return TSPIN_ATTACK[5] + 2 * (lines - 5);
		}
		if (spin === 'mini') {
			if (lines <= 5) return MINI_ATTACK[lines] || 0;
			return MINI_ATTACK[5] + 2 * (lines - 5);
		}
		if (lines <= 5) return NORMAL_ATTACK[lines] || 0;
		return NORMAL_ATTACK[5] + (lines - 5);
	}

	// TETR.IO's default "multiplier" combo table. `combo` is the game's
	// post-clear combo count: 0 for the first clear, 1 for the second, ...
	// The multiplier is linear, but from the third clear the log floor takes
	// over, which is why singles scale logarithmically.
	function applyCombo(attack, combo) {
		if (!Number.isFinite(combo) || combo <= 0) return attack;
		let result = attack * (1 + COMBO_BONUS * combo);
		if (combo > 1) {
			result = Math.max(Math.log1p(combo * COMBO_FLOOR_SCALE), result);
		}
		return result;
	}

	// TETRA LEAGUE attack, matching engines/fusion/src/attack.rs (s2_attack)
	// and TETR.IO's client: flat +1 B2B from the second B2B clear, the
	// multiplier combo table, a separate 5-line all-clear event, and the
	// surge release when a non-difficult clear breaks a 4+ B2B chain.
	function computeAttack(info) {
		const cleared = Math.max(0, Math.min(5, Math.floor(info.cleared || 0)));
		if (cleared === 0) {
			return {
				total: 0,
				rawTotal: 0,
				base: 0,
				tspin: 0,
				allspin: 0,
				quad: 0,
				b2b: 0,
				combo: 0,
				pc: 0,
				surge: 0,
			};
		}

		const spin = info.tspin ? (info.mini ? 'mini' : 'full') : info.allspinMini ? 'mini' : 'none';
		const base = baseAttack(cleared, spin);

		// The game's b2b is 1 for the first B2B clear, 2 for the second, ...
		// TETR.IO's flat B2B bonus starts on the second B2B clear.
		const b2bAfter = Math.max(0, Math.floor(Number(info.b2b) || 0));
		const b2bBonus = b2bAfter > 1 ? B2B_BONUS : 0;

		// The game's combo is 0 for the first clear, 1 for the second, ...
		const combo = Math.floor(Number(info.combo) || 0);
		const main = applyCombo(base + b2bBonus, combo);

		// TETRA LEAGUE's all-clear bonus is a separate 5-line event.
		const pc = info.pc ? PERFECT_CLEAR_ATTACK : 0;

		// Surge release: a non-difficult clear breaks a B2B chain of 4+.
		const difficult = spin !== 'none' || cleared >= 4;
		const b2bBefore = Math.max(0, Math.floor(Number(info.b2bBefore) || 0));
		const preB2bSigned = b2bBefore > 0 ? b2bBefore - 1 : -1;
		const surge = !info.pc && !difficult && preB2bSigned >= 4 ? preB2bSigned : 0;

		return {
			total: Math.floor(main) + surge + pc,
			rawTotal: main + surge + pc,
			base,
			tspin: info.tspin ? base : 0,
			allspin: info.allspinMini ? base : 0,
			quad: cleared === 4 ? base : 0,
			b2b: b2bBonus,
			combo: main - (base + b2bBonus),
			pc,
			surge,
		};
	}

	function createState(now = Date.now()) {
		return {
			startTime: now,
			pieces: 0,
			lines: 0,
			attack: 0,
			attackRaw: 0,
			attackTspin: 0,
			attackAllspin: 0,
			attackQuad: 0,
			attackB2B: 0,
			attackCombo: 0,
			attackPC: 0,
			attackSurge: 0,
			singles: 0,
			doubles: 0,
			triples: 0,
			quads: 0,
			tspins: 0,
			miniTspins: 0,
			allspins: 0,
			perfectClears: 0,
			// Tetra Stats placement-efficiency counters.
			iPieces: 0,
			tPieces: 0,
			allPieces: 0,
			tspinSingles: 0,
			tspinDoubles: 0,
			tspinTriples: 0,
			quadClears: 0,
			holds: 0,
			keys: 0,
			perfectPieces: 0,
			faultyPieces: 0,
			finesseFaults: 0,
			maxCombo: 0,
			maxB2B: 0,
			garbageReceived: 0,
			currentInputs: 0,
			currentPiece: '',
			softDropExempt: false,
			lastFinesseFault: false,
		};
	}

	function resetState(state, now = Date.now()) {
		const fresh = createState(now);
		for (const key of Object.keys(fresh)) state[key] = fresh[key];
		return state;
	}

	function applyPlacement(state, info, finesseTable) {
		state.pieces += 1;

		const cleared = Math.max(0, Math.min(4, Math.floor(info.cleared || 0)));
		state.lines += cleared;
		if (cleared === 1) state.singles += 1;
		else if (cleared === 2) state.doubles += 1;
		else if (cleared === 3) state.triples += 1;
		else if (cleared === 4) state.quads += 1;

		if (info.tspin) {
			if (info.mini) state.miniTspins += 1;
			else state.tspins += 1;
		}
		if (info.pc) state.perfectClears += 1;

		// Exact Tetra Stats / Minomuncher placement counters. `allPieces` is
		// not the total piece count: it is the L/J/S/Z pieces that cleared at
		// least one line. This is why all-spin efficiency can exceed 100% when
		// an I-spin or a mini T-spin single is counted in `allspins`.
		if (info.piece === 'I') state.iPieces += 1;
		else if (info.piece === 'T') state.tPieces += 1;
		else if (info.piece !== 'O' && cleared > 0) state.allPieces += 1;

		// Tetra Stats clear classification: a perfect clear is its own type, a
		// 4+ line clear is a quad, a mini T-spin single is an all-spin, and
		// T-spin doubles/triples count as T-spins even when mini.
		if (cleared > 0 && !info.pc) {
			if (cleared >= 4) {
				// Exact Tetra Stats: every non-PC 4+ line clear is a quad,
				// regardless of the piece. A T-spin quad therefore counts here
				// but not in iPieces, so quad efficiency can exceed 100%.
				state.quadClears += 1;
			} else if (info.tspin || info.allspinMini) {
				if (info.piece === 'T') {
					if (cleared === 1) {
						if (info.mini) state.allspins += 1;
						else state.tspinSingles += 1;
					} else if (cleared === 2) {
						state.tspinDoubles += 1;
					} else if (cleared === 3) {
						state.tspinTriples += 1;
					}
				} else {
					state.allspins += 1;
				}
			}
		}

		const attack = computeAttack(info);
		state.attack += attack.total;
		state.attackRaw += attack.rawTotal;
		state.attackTspin += attack.tspin;
		state.attackAllspin += attack.allspin;
		state.attackQuad += attack.quad;
		state.attackB2B += attack.b2b;
		state.attackCombo += attack.combo;
		state.attackPC += attack.pc;
		state.attackSurge += attack.surge;

		state.maxCombo = Math.max(state.maxCombo, Number(info.combo) || 0);
		state.maxB2B = Math.max(state.maxB2B, Number(info.b2b) || 0);

		let excess = 0;
		let scored = false;
		if (
			finesseTable &&
			!state.softDropExempt &&
			!info.skipFinesse &&
			!(info.exemptSpins && info.isSpin)
		) {
			const target = getTargetCost(finesseTable, info.piece, info.shapeKey);
			if (target !== null) {
				scored = true;
				excess = Math.max(0, state.currentInputs - target);
			}
		}

		if (!scored || excess === 0) {
			state.perfectPieces += 1;
		} else {
			state.faultyPieces += 1;
			state.finesseFaults += excess;
		}
		state.lastFinesseFault = scored && excess > 0;
		state.currentInputs = 0;

		return { attack, fault: scored && excess > 0, excess, scored };
	}

	function getStatValue(state, id, now = Date.now(), extra = {}) {
		const seconds = Math.max(0, (now - state.startTime) / 1000);
		const minutes = seconds / 60;
		const pieces = state.pieces;
		const lines = state.lines;
		const attack = state.attack;
		const rawAttack = state.attackRaw;

		switch (id) {
			case 'time':
				return seconds;
			case 'pieces':
				return pieces;
			case 'lines':
				return lines;
			case 'attack':
				return attack;
			case 'holds':
				return state.holds;
			case 'keys':
				return state.keys;
			case 'pps':
				return seconds > 0 ? pieces / seconds : 0;
			case 'lpm':
				return minutes > 0 ? lines / minutes : 0;
			case 'kpp':
				return pieces > 0 ? state.keys / pieces : 0;
			case 'apm':
				return minutes > 0 ? attack / minutes : 0;
			case 'vs':
				return seconds > 0 ? (attack * 100) / seconds : 0;
			case 'app':
				return pieces > 0 ? attack / pieces : 0;
			case 'garbageReceived':
				return state.garbageReceived;
			case 'finesse':
				return pieces > 0 ? (state.perfectPieces / pieces) * 100 : null;
			case 'finesseFaults':
				return state.finesseFaults;
			case 'faultsPerPiece':
				return pieces > 0 ? state.finesseFaults / pieces : 0;
			case 'perfectPieces':
				return state.perfectPieces;
			case 'faultyPieces':
				return state.faultyPieces;
			case 'combo':
				return Math.max(0, Number(extra.combo) || 0);
			case 'b2b':
				return Math.max(0, Number(extra.b2b) || 0);
			case 'maxCombo':
				return state.maxCombo;
			case 'maxB2B':
				return state.maxB2B;
			case 'singles':
				return state.singles;
			case 'doubles':
				return state.doubles;
			case 'triples':
				return state.triples;
			case 'quads':
				return state.quads;
			case 'tspins':
				return state.tspins;
			case 'miniTspins':
				return state.miniTspins;
			case 'allspins':
				return state.allspins;
			case 'perfectClears':
				return state.perfectClears;
			case 'surge':
				return state.attackSurge;
			// Exact Tetra Stats placement efficiencies.
			case 'quadEfficiency':
				return state.iPieces > 0 ? (state.quadClears / state.iPieces) * 100 : null;
			case 'tspinEfficiency':
				return state.tPieces > 0
					? ((state.tspinSingles + state.tspinDoubles + state.tspinTriples) / state.tPieces) * 100
					: null;
			case 'allspinEfficiency':
				return state.allPieces > 0 ? (state.allspins / state.allPieces) * 100 : null;
			// Attack-share extras (not Tetra Stats stats).
			case 'b2bEfficiency':
				return rawAttack > 0 ? (state.attackB2B / rawAttack) * 100 : null;
			case 'comboEfficiency':
				return rawAttack > 0 ? (state.attackCombo / rawAttack) * 100 : null;
			case 'pcEfficiency':
				return rawAttack > 0 ? (state.attackPC / rawAttack) * 100 : null;
			case 'surgeEfficiency':
				return rawAttack > 0 ? (state.attackSurge / rawAttack) * 100 : null;
			case 'clearEfficiency':
				return pieces > 0 ? lines / pieces : 0;
			case 'piecesPerLine':
				return lines > 0 ? pieces / lines : 0;
			case 'holdsPerPiece':
				return pieces > 0 ? state.holds / pieces : 0;
			default:
				return null;
		}
	}

	function formatTime(seconds) {
		const total = Math.max(0, Math.floor(seconds));
		const hours = Math.floor(total / 3600);
		const minutes = Math.floor((total % 3600) / 60);
		const secs = total % 60;
		if (hours > 0) {
			return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
		}
		return minutes + ':' + String(secs).padStart(2, '0');
	}

	function formatStat(id, value, defs) {
		if (value === null || value === undefined || Number.isNaN(value)) return '—';
		const def = defs && defs.find((entry) => entry.id === id);
		const format = def ? def.format : 'float2';
		if (format === 'time') return formatTime(value);
		if (format === 'int') return String(Math.floor(value));
		if (format === 'percent2') return value.toFixed(2) + '%';
		if (format === 'float3') return value.toFixed(3);
		if (format === 'float2') return value.toFixed(2);
		return String(value);
	}

	return {
		BOARD_WIDTH,
		NORMAL_ATTACK,
		TSPIN_ATTACK,
		MINI_ATTACK,
		PERFECT_CLEAR_ATTACK,
		B2B_BONUS,
		COMBO_BONUS,
		COMBO_FLOOR_SCALE,
		baseAttack,
		applyCombo,
		isValidX,
		shapeKeyForPlacement,
		buildFinesseTable,
		getTargetCost,
		computeAttack,
		createState,
		resetState,
		applyPlacement,
		getStatValue,
		formatTime,
		formatStat,
	};
});
