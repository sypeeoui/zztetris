// Standalone checks for the 4W combo engine. Run with:
//   node scripts/test-fourwide.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Engine = require('../fourwide-core.js');

function patternToRows(pattern) {
	const rows = [];
	for (let r = pattern.length - 1; r >= 0; r--) {
		let mask = 0;
		for (let c = 0; c < 4; c++) if (pattern[r][c]) mask |= 1 << c;
		rows.push(mask);
	}
	while (rows.length < 8) rows.push(0);
	return rows;
}

function loadResiduals() {
	const source = fs.readFileSync(path.join(__dirname, '..', 'rotationSystem.js'), 'utf8');
	const out = {};
	for (const name of ['res_3', 'res_4', 'res_5', 'res_6']) {
		const match = source.match(new RegExp(name + ' = (\\[[\\s\\S]*?\\]);'));
		assert(match, `missing ${name}`);
		out[name] = eval(match[1]);
	}
	return out;
}

// Every piece has legal placements on an empty well.
for (let piece = 0; piece < 7; piece++) {
	const locks = Engine.placements([0, 0, 0, 0, 0, 0, 0, 0], piece);
	assert(locks.length > 0, `no placements for piece ${piece}`);
	for (const lock of locks) {
		assert(
			lock.cells.every((c) => c.x >= 0 && c.x < 4 && c.y >= 0 && c.y < 8),
			`piece ${piece} produced an out-of-bounds cell`
		);
	}
}

// Residual transitions are deterministic and include clearing moves.
const key = Engine.residualKeyFromRows([0b1001, 0b1001, 0, 0, 0, 0, 0, 0]);
const transitions = Engine.getTransitions(key, 2);
assert(transitions.length > 0, 'no T transitions');
assert(transitions.some((t) => t.cleared > 0), 'no clearing T transition');

// Analyze the first pattern of each residual mode.
const residuals = loadResiduals();
const queue = [0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6];
for (const [name, patterns] of Object.entries(residuals)) {
	const rows = patternToRows(patterns[0]);
	const result = Engine.analyze({
		rows,
		piece: 2,
		hold: null,
		queue,
		lookahead: 28,
		tieBreak: 'board',
	});
	assert(result.best, `${name}: no best move`);
	assert(result.knownLength === 29, `${name}: known length ${result.knownLength}`);
	assert(
		result.best.cells.every((c) => c.x >= 3 && c.x <= 6),
		`${name}: move outside the well`
	);
	assert(result.elapsedMs < 1000, `${name}: too slow (${result.elapsedMs} ms)`);
}

// A longer real queue cannot reduce the best survival depth.
const rows = patternToRows(residuals.res_6[0]);
let previous = 0;
for (const lookahead of [0, 7, 14, 21, 28]) {
	const result = Engine.analyze({
		rows,
		piece: 2,
		hold: null,
		queue,
		lookahead,
		tieBreak: 'board',
	});
	assert(result.best, `lookahead ${lookahead}: no best move`);
	assert(
		result.best.survival >= previous,
		`lookahead ${lookahead}: survival decreased from ${previous} to ${result.best.survival}`
	);
	previous = result.best.survival;
}

// Holding the current piece and playing the next piece is a root move even
// when the hold slot is empty.
const holdRows = [0b0111, 0b0111, 0, 0, 0, 0, 0, 0];
const holdQueue = [0, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6];
const holdResult = Engine.analyze({
	rows: holdRows,
	piece: 1, // O
	hold: null,
	queue: holdQueue,
	lookahead: 28,
	tieBreak: 'board',
});
assert(holdResult.best, 'empty hold: no best move');
assert(holdResult.best.holdUsed, 'empty hold: best move does not use hold');
assert.strictEqual(holdResult.best.piece, 0, 'empty hold: best move is not the next piece');
assert(holdResult.best.cleared > 0, 'empty hold: best move does not clear');
assert.strictEqual(holdResult.best.nextIndex, 2, 'empty hold: survival starts at the wrong queue index');
assert.strictEqual(holdResult.best.route[0].piece, 0, 'empty hold: route does not start with the next piece');
assert.strictEqual(holdResult.best.route[0].holdUsed, true, 'empty hold: route does not mark hold');

// The hold root is considered even when the current piece can clear.
const holdClearRows = [0b0111, 0, 0, 0, 0, 0, 0, 0];
const holdClearResult = Engine.analyze({
	rows: holdClearRows,
	piece: 2, // T
	hold: null,
	queue: holdQueue,
	lookahead: 28,
	tieBreak: 'board',
});
assert(
	holdClearResult.candidates.some((c) => c.holdUsed && c.cleared > 0),
	'empty hold: no hold candidate with a clear'
);

console.log('fourwide-core tests passed');
