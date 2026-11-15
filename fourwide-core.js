// 4-wide combo engine: residual-state graph + exact survival DP.
//
// The well is four columns wide. Only the top four rows of the well (the
// "residual") matter for future line clears, so the search state is a 4x4
// bitboard plus the hold piece and the queue index. The queue is a fixed real
// sequence, which makes the DP linear in the queue length instead of
// exponential: equivalent (residual, hold, index) states are memoized.
(function (global) {
	'use strict';

	const W = 4;
	const FULL = (1 << W) - 1;
	const WELL_START = 3;
	const PIECE_CHARS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

	// Same base coordinates as base.js pieceBaseCoords (y=0 is the bottom).
	const BASE_COORDS = [
		[[-1, 0], [0, 0], [1, 0], [2, 0]], // I
		[[0, 0], [1, 0], [0, 1], [1, 1]], // O
		[[-1, 0], [0, 0], [1, 0], [0, 1]], // T
		[[-1, 0], [0, 0], [0, 1], [1, 1]], // S
		[[-1, 1], [0, 1], [0, 0], [1, 0]], // Z
		[[-1, 0], [0, 0], [1, 0], [-1, 1]], // J
		[[-1, 0], [0, 0], [1, 0], [1, 1]], // L
	];

	// SRS+ kicks, copied from rotationSystem.js. Coordinates are in the
	// engine's y-up convention: x + dx, y + dy.
	const KICKS = {
		'N0-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
		'N1-0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
		'N1-2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
		'N2-1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
		'N2-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
		'N3-2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
		'N3-0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
		'N0-3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
		'N0-2': [[0, 0], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]],
		'N1-3': [[0, 0], [1, 0], [1, 2], [1, 1], [0, 2], [0, 1]],
		'N2-0': [[0, 0], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]],
		'N3-1': [[0, 0], [-1, 0], [-1, 2], [-1, 1], [0, 2], [0, 1]],
		'I0-1': [[0, 0], [1, 0], [-2, 0], [-2, -1], [1, 2]],
		'I1-0': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
		'I1-2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
		'I2-1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
		'I2-3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
		'I3-2': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
		'I3-0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
		'I0-3': [[0, 0], [-1, 0], [2, 0], [2, -1], [-1, 2]],
		'I0-2': [[0, 0], [0, 1]],
		'I1-3': [[0, 0], [1, 0]],
		'I2-0': [[0, 0], [0, -1]],
		'I3-1': [[0, 0], [-1, 0]],
	};

	function rotateCoord(rot, x, y) {
		switch (rot & 3) {
			case 1:
				return { x: y, y: -x };
			case 2:
				return { x: -x, y: -y };
			case 3:
				return { x: -y, y: x };
			default:
				return { x, y };
		}
	}

	const SHAPES = BASE_COORDS.map((base) => {
		const rotations = [];
		for (let rot = 0; rot < 4; rot++) {
			rotations.push(base.map(([x, y]) => rotateCoord(rot, x, y)));
		}
		return rotations;
	});

	function cellsOf(piece, x, y, rot) {
		return SHAPES[piece][rot & 3].map((c) => ({ x: x + c.x, y: y + c.y }));
	}

	function fits(rows, piece, x, y, rot) {
		const shape = SHAPES[piece][rot & 3];
		for (let i = 0; i < shape.length; i++) {
			const ax = x + shape[i].x;
			const ay = y + shape[i].y;
			if (ax < 0 || ax >= W) return false;
			if (ay < 0) return false;
			if (ay < rows.length && (rows[ay] & (1 << ax))) return false;
		}
		return true;
	}

	function tryRotate(rows, piece, x, y, rot, dir) {
		if (piece === 1) return null; // O never kicks
		const to = dir === 'CW' ? (rot + 1) & 3 : dir === 'CCW' ? (rot + 3) & 3 : (rot + 2) & 3;
		const key = (piece === 0 ? 'I' : 'N') + rot + '-' + to;
		const kicks = KICKS[key];
		if (!kicks) return null;
		for (let i = 0; i < kicks.length; i++) {
			const nx = x + kicks[i][0];
			const ny = y + kicks[i][1];
			if (fits(rows, piece, nx, ny, to)) return { x: nx, y: ny, rot: to };
		}
		return null;
	}

	function place(rows, cells) {
		const out = rows.slice();
		for (let i = 0; i < cells.length; i++) {
			out[cells[i].y] |= 1 << cells[i].x;
		}
		return out;
	}

	function clearRows(rows) {
		const out = [];
		let cleared = 0;
		for (let y = 0; y < rows.length; y++) {
			if (rows[y] === FULL) cleared++;
			else out.push(rows[y]);
		}
		while (out.length < rows.length) out.push(0);
		return { rows: out, cleared };
	}

	function buildPath(seen, key) {
		const moves = [];
		let k = key;
		while (k) {
			const entry = seen.get(k);
			if (!entry || !entry.move) break;
			moves.push(entry.move);
			k = entry.prev;
		}
		moves.reverse();
		const out = [];
		for (let i = 0; i < moves.length; i++) {
			const move = moves[i];
			if (move === 'D' && out[out.length - 1] === 'D') continue;
			out.push(move);
		}
		while (out[out.length - 1] === 'D') out.pop();
		return out.join(' ');
	}

	// Enumerate every reachable lock position from spawn, including tucks and
	// spins. The board is y=0 bottom; cells above the top are allowed while
	// falling, but a lock with a cell above the top is a lockout.
	function placements(rows, piece, lockHeight) {
		const spawnX = 1;
		const spawnY = rows.length - 2;
		const maxLockY = lockHeight === undefined ? rows.length : lockHeight;
		if (!fits(rows, piece, spawnX, spawnY, 0)) return [];

		const seen = new Map();
		const queue = [{ x: spawnX, y: spawnY, rot: 0 }];
		seen.set(spawnX + ',' + spawnY + ',0', { prev: null, move: null });
		const locks = new Map();

		while (queue.length) {
			const state = queue.shift();
			const stateKey = state.x + ',' + state.y + ',' + state.rot;

			if (!fits(rows, piece, state.x, state.y - 1, state.rot)) {
				const cells = cellsOf(piece, state.x, state.y, state.rot);
				let lockout = false;
				for (let i = 0; i < cells.length; i++) {
					if (cells[i].y >= maxLockY) {
						lockout = true;
						break;
					}
				}
				if (!lockout) {
					const lockKey = cells
						.map((c) => c.x + ':' + c.y)
						.sort()
						.join('|');
					if (!locks.has(lockKey)) {
						const placed = place(rows, cells);
						const cleared = clearRows(placed);
						locks.set(lockKey, {
							piece,
							x: state.x,
							y: state.y,
							rot: state.rot,
							cells,
							rows: cleared.rows,
							cleared: cleared.cleared,
							path: buildPath(seen, stateKey),
						});
					}
				}
			}

			const candidates = [];
			const cw = tryRotate(rows, piece, state.x, state.y, state.rot, 'CW');
			if (cw) candidates.push(['CW', cw]);
			const ccw = tryRotate(rows, piece, state.x, state.y, state.rot, 'CCW');
			if (ccw) candidates.push(['CCW', ccw]);
			const flip = tryRotate(rows, piece, state.x, state.y, state.rot, 'F');
			if (flip) candidates.push(['F', flip]);
			if (fits(rows, piece, state.x - 1, state.y, state.rot)) {
				candidates.push(['L', { x: state.x - 1, y: state.y, rot: state.rot }]);
			}
			if (fits(rows, piece, state.x + 1, state.y, state.rot)) {
				candidates.push(['R', { x: state.x + 1, y: state.y, rot: state.rot }]);
			}
			if (fits(rows, piece, state.x, state.y - 1, state.rot)) {
				candidates.push(['D', { x: state.x, y: state.y - 1, rot: state.rot }]);
			}

			for (let i = 0; i < candidates.length; i++) {
				const move = candidates[i][0];
				const next = candidates[i][1];
				const nextKey = next.x + ',' + next.y + ',' + next.rot;
				if (!seen.has(nextKey)) {
					seen.set(nextKey, { prev: stateKey, move });
					queue.push(next);
				}
			}
		}

		return Array.from(locks.values());
	}

	function trimRows(rows) {
		let top = rows.length - 1;
		while (top >= 0 && rows[top] === 0) top--;
		const stack = rows.slice(0, top + 1);
		const board = stack.slice();
		while (board.length < stack.length + 4) board.push(0);
		return {
			stack,
			board,
			stackHeight: top + 1,
			// The padded rows above the stack are spawn space, not part of the
			// real board. A lock above the real board is a lockout.
			boardHeight: Math.min(rows.length, stack.length + 4),
		};
	}

	function residualKeyFromRows(rows) {
		let top = rows.length - 1;
		while (top >= 0 && rows[top] === 0) top--;
		const stack = rows.slice(0, top + 1);
		const top4 = stack.slice(-4);
		while (top4.length < 4) top4.push(0);
		return top4[0] | (top4[1] << 4) | (top4[2] << 8) | (top4[3] << 12);
	}

	function stateRows(key) {
		return [key & 0xf, (key >> 4) & 0xf, (key >> 8) & 0xf, (key >> 12) & 0xf];
	}

	function popcount(value) {
		let x = value >>> 0;
		x = x - ((x >> 1) & 0x55555555);
		x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
		x = (x + (x >> 4)) & 0x0f0f0f0f;
		return (x * 0x01010101) >>> 24;
	}

	function columnHeights(key) {
		const rows = stateRows(key);
		const heights = [0, 0, 0, 0];
		for (let x = 0; x < W; x++) {
			for (let y = 3; y >= 0; y--) {
				if ((rows[y] >> x) & 1) {
					heights[x] = y + 1;
					break;
				}
			}
		}
		return heights;
	}

	function maxHeight(key) {
		const heights = columnHeights(key);
		return Math.max(heights[0], heights[1], heights[2], heights[3]);
	}

	function holes(key) {
		const rows = stateRows(key);
		const heights = columnHeights(key);
		let count = 0;
		for (let x = 0; x < W; x++) {
			for (let y = 0; y < heights[x]; y++) {
				if (!((rows[y] >> x) & 1)) count++;
			}
		}
		return count;
	}

	function bumpiness(key) {
		const heights = columnHeights(key);
		let count = 0;
		for (let x = 0; x < W - 1; x++) count += Math.abs(heights[x] - heights[x + 1]);
		return count;
	}

	const evalCache = new Map();
	function evalState(key) {
		let value = evalCache.get(key);
		if (value !== undefined) return value;
		const h = holes(key);
		const b = bumpiness(key);
		const m = maxHeight(key);
		value = -h * 120 - b * 8 - m * 6;
		evalCache.set(key, value);
		return value;
	}

	const transitionCache = new Map();
	function getTransitions(key, piece) {
		const cacheKey = key + '|' + piece;
		let transitions = transitionCache.get(cacheKey);
		if (transitions) return transitions;

		const rows = stateRows(key);
		while (rows.length < 8) rows.push(0);
		const locks = placements(rows, piece, 4);
		transitions = locks.map((lock) => {
			const nextKey = residualKeyFromRows(lock.rows);
			const cells = lock.cells.map((c) => ({
				x: c.x + WELL_START,
				y: c.y,
				piece: PIECE_CHARS[piece],
			}));
			return {
				nextKey,
				cleared: lock.cleared,
				move: {
					piece,
					x: lock.x + WELL_START,
					y: lock.y,
					rotation: lock.rot,
					cells,
					path: lock.path,
					cleared: lock.cleared,
				},
			};
		});
		transitionCache.set(cacheKey, transitions);
		return transitions;
	}

	const clearingCache = new Map();
	function getClearingTransitions(key, piece) {
		const cacheKey = key + '|' + piece;
		let transitions = clearingCache.get(cacheKey);
		if (transitions) return transitions;
		transitions = getTransitions(key, piece).filter((t) => t.cleared > 0);
		clearingCache.set(cacheKey, transitions);
		return transitions;
	}

	const clearabilityCache = new Map();
	function clearability(key) {
		let value = clearabilityCache.get(key);
		if (value !== undefined) return value;
		value = 0;
		for (let piece = 0; piece < 7; piece++) {
			if (getClearingTransitions(key, piece).length) value++;
		}
		clearabilityCache.set(key, value);
		return value;
	}

	function survival(key, hold, queue, index, limit, memo, budget, canHold, freeHold) {
		if (index >= limit) return { depth: 0, score: 0, path: [] };
		const memoKey =
			key +
			'|' +
			(hold === null || hold === undefined ? 7 : hold) +
			'|' +
			index +
			'|' +
			(canHold ? 1 : 0);
		const cached = memo.get(memoKey);
		if (cached) return cached;
		if (budget.nodes++ > budget.maxNodes) {
			budget.partial = true;
			return { depth: 0, score: 0, path: [] };
		}

		let best = { depth: 0, score: 0, path: [] };
		const options = [
			{ piece: queue[index], nextHold: hold, holdUsed: false, nextCanHold: true },
		];
		if (canHold && hold !== null && hold !== undefined) {
			options.push({
				piece: hold,
				nextHold: queue[index],
				holdUsed: true,
				nextCanHold: !!freeHold,
			});
		}

		for (let o = 0; o < options.length; o++) {
			const option = options[o];
			const transitions = getClearingTransitions(key, option.piece);
			for (let t = 0; t < transitions.length; t++) {
				const transition = transitions[t];
				const sub = survival(
					transition.nextKey,
					option.nextHold,
					queue,
					index + 1,
					limit,
					memo,
					budget,
					option.nextCanHold,
					freeHold
				);
				const depth = 1 + sub.depth;
				const score =
					evalState(transition.nextKey) +
					clearability(transition.nextKey) * 10 +
					sub.score;
				if (depth > best.depth || (depth === best.depth && score > best.score)) {
					const move = Object.assign({}, transition.move, {
						holdUsed: option.holdUsed,
					});
					best = {
						depth,
						score,
						path: [move].concat(sub.path),
					};
				}
			}
		}

		memo.set(memoKey, best);
		return best;
	}

	function compareCandidates(tieBreak) {
		return function (a, b) {
			if (b.survival !== a.survival) return b.survival - a.survival;
			if (b.knownSurvival !== a.knownSurvival) return b.knownSurvival - a.knownSurvival;
			if (tieBreak === 'flex') {
				if (b.clearability !== a.clearability) return b.clearability - a.clearability;
				if (b.eval !== a.eval) return b.eval - a.eval;
			} else if (tieBreak === 'low') {
				if (a.height !== b.height) return a.height - b.height;
				if (b.eval !== a.eval) return b.eval - a.eval;
			} else {
				if (b.eval !== a.eval) return b.eval - a.eval;
				if (b.clearability !== a.clearability) return b.clearability - a.clearability;
			}
			if (a.holdUsed !== b.holdUsed) return a.holdUsed ? 1 : -1;
			return (a.path || '').length - (b.path || '').length;
		};
	}

	function makeCandidate(move, nextKey, nextHold, cleared, queue, analysisLength, tieBreak) {
		const candidate = {
			key: '',
			piece: move.piece,
			x: move.x,
			y: move.y,
			rotation: move.rotation,
			cells: move.cells,
			holdUsed: !!move.holdUsed,
			path: move.path || '',
			survival: 0,
			knownSurvival: 0,
			eval: evalState(nextKey),
			clearability: clearability(nextKey),
			height: maxHeight(nextKey),
			holes: holes(nextKey),
			bumpiness: bumpiness(nextKey),
			status: 'danger',
			breakPiece: null,
			route: [move],
			cleared,
			nextKey,
			nextHold,
		};
		return candidate;
	}

	function analyze(payload) {
		const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
		const rows = payload.rows || [];
		const piece = payload.piece;
		const hold = payload.hold === undefined ? null : payload.hold;
		const queue = payload.queue || [];
		const lookahead = Math.max(0, Math.min(28, Math.floor(payload.lookahead || 0)));
		const tieBreak = payload.tieBreak || 'board';
		const freeHold = payload.freeHold !== false;

		const trimmed = trimRows(rows);
		const board = trimmed.board;
		const stackHeight = trimmed.stackHeight;
		const boardHeight = trimmed.boardHeight;
		const residualKey = residualKeyFromRows(trimmed.stack);
		const residualCount = popcount(residualKey);

		const analysisQueue = [piece].concat(queue.slice(0, lookahead));
		const knownLength = analysisQueue.length;
		const analysisLength = knownLength;

		const memo = new Map();
		const budget = { nodes: 0, maxNodes: 500000, partial: false };
		const candidates = [];

		function addRoot(pieceId, holdUsed, nextHold, nextCanHold) {
			const locks = placements(board, pieceId, boardHeight);
			for (let i = 0; i < locks.length; i++) {
				const lock = locks[i];
				const nextKey = residualKeyFromRows(lock.rows);
				const move = {
					piece: pieceId,
					x: lock.x + WELL_START,
					y: lock.y,
					rotation: lock.rot,
					cells: lock.cells.map((c) => ({
						x: c.x + WELL_START,
						y: c.y,
						piece: PIECE_CHARS[pieceId],
					})),
					path: lock.path,
					holdUsed,
					cleared: lock.cleared,
				};
				const candidate = makeCandidate(
					move,
					nextKey,
					nextHold,
					lock.cleared,
					analysisQueue,
					analysisLength,
					tieBreak
				);
				if (lock.cleared > 0) {
					const dp = survival(
						nextKey,
						nextHold,
						analysisQueue,
						1,
						analysisLength,
						memo,
						budget,
						nextCanHold,
						freeHold
					);
					candidate.survival = 1 + dp.depth;
					candidate.knownSurvival = Math.min(candidate.survival, knownLength);
					candidate.route = [move].concat(dp.path);
					candidate.breakPiece =
						candidate.survival < analysisLength
							? analysisQueue[candidate.survival]
							: null;
					candidate.status =
						candidate.survival >= knownLength
							? 'safe'
							: candidate.survival > 0
								? 'warning'
								: 'danger';
				}
				candidates.push(candidate);
			}
		}

		addRoot(piece, false, hold, true);
		if (hold !== null && hold !== undefined) {
			addRoot(hold, true, piece, freeHold);
		}

		let clearing = candidates.filter((c) => c.cleared > 0);
		let best = null;
		let route = [];

		if (clearing.length) {
			clearing.sort(compareCandidates(tieBreak));
			clearing.forEach((c, i) => {
				c.key = 'c' + i;
			});
			best = clearing[0];
			route = best.route;
			candidates.length = 0;
			Array.prototype.push.apply(candidates, clearing);
		} else {
			// No clearing move: find the placement that best sets up the next
			// clear. This is a shallow recovery search, not a combo path.
			const recovery = [];
			const rootOptions = [];
			for (let i = 0; i < candidates.length; i++) {
				rootOptions.push({ candidate: candidates[i], nextIndex: 1 });
			}
			// Holding the current piece and playing the next piece is a valid
			// recovery option when the hold slot is empty.
			if ((hold === null || hold === undefined) && analysisQueue.length > 1) {
				const nextPiece = analysisQueue[1];
				const locks = placements(board, nextPiece, boardHeight);
				for (let i = 0; i < locks.length; i++) {
					const lock = locks[i];
					const nextKey = residualKeyFromRows(lock.rows);
					const move = {
						piece: nextPiece,
						x: lock.x + WELL_START,
						y: lock.y,
						rotation: lock.rot,
						cells: lock.cells.map((c) => ({
							x: c.x + WELL_START,
							y: c.y,
							piece: PIECE_CHARS[nextPiece],
						})),
						path: lock.path,
						holdUsed: true,
						cleared: lock.cleared,
					};
					const candidate = makeCandidate(
						move,
						nextKey,
						piece,
						lock.cleared,
						analysisQueue,
						analysisLength,
						tieBreak
					);
					rootOptions.push({ candidate, nextIndex: 2 });
				}
			}

			for (let i = 0; i < rootOptions.length; i++) {
				const option = rootOptions[i];
				const candidate = option.candidate;
				const nextIndex = option.nextIndex;
				let nextClear = 0;
				let nextEval = candidate.eval;
				let nextClearability = candidate.clearability;
				if (nextIndex < analysisLength) {
					const nextPiece = analysisQueue[nextIndex];
					const transitions = getClearingTransitions(candidate.nextKey, nextPiece);
					if (transitions.length) {
						nextClear = 1;
						for (let t = 0; t < transitions.length; t++) {
							const transition = transitions[t];
							const value = evalState(transition.nextKey);
							const flex = clearability(transition.nextKey);
							if (value > nextEval) nextEval = value;
							if (flex > nextClearability) nextClearability = flex;
						}
					}
				}
				candidate.survival = 0;
				candidate.knownSurvival = 0;
				candidate.status = 'danger';
				candidate.breakPiece = analysisQueue.length > 1 ? analysisQueue[1] : null;
				candidate.eval = nextEval;
				candidate.clearability = nextClearability;
				candidate.recoveryScore = nextClear * 1000 + nextClearability * 10 + nextEval;
				recovery.push(candidate);
			}

			recovery.sort((a, b) => {
				if (b.recoveryScore !== a.recoveryScore) return b.recoveryScore - a.recoveryScore;
				if (b.eval !== a.eval) return b.eval - a.eval;
				return (a.path || '').length - (b.path || '').length;
			});
			recovery.forEach((c, i) => {
				c.key = 'r' + i;
			});
			best = recovery[0] || null;
			route = best ? [best.route[0]] : [];
			candidates.length = 0;
			Array.prototype.push.apply(candidates, recovery);
		}

		const elapsedMs =
			(typeof performance !== 'undefined' ? performance.now() : Date.now()) - start;
		return {
			best,
			candidates,
			route,
			knownLength,
			analysisLength,
			breakPiece: best ? best.breakPiece : null,
			stackHeight,
			residualCount,
			approximate: stackHeight > 4,
			partial: budget.partial,
			elapsedMs,
		};
	}

	const Engine = {
		W,
		FULL,
		WELL_START,
		PIECE_CHARS,
		SHAPES,
		placements,
		clearRows,
		residualKeyFromRows,
		stateRows,
		evalState,
		clearability,
		getTransitions,
		getClearingTransitions,
		survival,
		analyze,
	};
	if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
	else global.FourWideEngine = Engine;
})(typeof self !== 'undefined' ? self : globalThis);
