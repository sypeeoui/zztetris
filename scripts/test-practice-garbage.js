// Standalone checks for 4W/3W practice garbage. Run with:
//   node scripts/test-practice-garbage.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function loadPracticeGarbage() {
	const source = fs.readFileSync(path.join(__dirname, '..', 'utils.js'), 'utf8');
	const start = source.indexOf('let lastHoleCol = -1;');
	const end = source.indexOf('// Update messiness value display');
	assert(start !== -1 && end !== -1, 'could not locate addPracticeGarbage in utils.js');
	const sandbox = {
		board: [],
		boardSize: [10, 40],
		mode: '4w',
		spawn: [3, 17],
		aRow: () => Array.from({ length: 10 }, () => ({ t: 0, c: '' })),
		updateGhost: () => {},
		updateHistory: () => {},
	};
	vm.runInNewContext(source.slice(start, end), sandbox);
	return sandbox;
}

function loadInfiniteGarbage() {
	const source = fs.readFileSync(path.join(__dirname, '..', 'zztetris.js'), 'utf8');
	const start = source.indexOf('function preserveWalls(');
	const end = source.indexOf('function PC(');
	assert(start !== -1 && end !== -1, 'could not locate addInfiniteGarbage in zztetris.js');
	const sandbox = {
		board: [],
		boardSize: [10, 40],
		mode: '4w',
		spawn: [3, 17],
		updateGhost: () => {},
	};
	vm.runInNewContext(source.slice(start, end), sandbox);
	return sandbox;
}

function emptyRow() {
	return Array.from({ length: 10 }, () => ({ t: 0, c: '' }));
}

function make4wBoard() {
	const board = [];
	for (let i = 0; i < 40; i++) {
		board.push([
			{ t: 1, c: 'X' },
			{ t: 1, c: 'X' },
			{ t: 1, c: 'X' },
			{ t: 0, c: '' },
			{ t: 0, c: '' },
			{ t: 0, c: '' },
			{ t: 0, c: '' },
			{ t: 1, c: 'X' },
			{ t: 1, c: 'X' },
			{ t: 1, c: 'X' },
		]);
	}
	return board;
}

function make3wBoard() {
	const board = [];
	for (let i = 0; i < 40; i++) {
		board.push([
			{ t: 1, c: 'X' },
			{ t: 1, c: 'X' },
			{ t: 1, c: 'X' },
			{ t: 0, c: '' },
			{ t: 0, c: '' },
			{ t: 0, c: '' },
			{ t: 1, c: 'X' },
			{ t: 1, c: 'X' },
			{ t: 1, c: 'X' },
			{ t: 1, c: 'X' },
		]);
	}
	return board;
}

function wellCells(row, start = 3, width = 4) {
	return row.slice(start, start + width);
}

function wellString(row, start = 3, width = 4) {
	return wellCells(row, start, width)
		.map((cell) => (cell.t === 1 ? 'X' : '.'))
		.join('');
}

function nonEmptyWellRows(board, start = 3, width = 4) {
	const empty = '.'.repeat(width);
	return board.filter((row) => wellString(row, start, width) !== empty).length;
}

function hasWalls(row, start = 3, width = 4) {
	return (
		row.slice(0, start).every((cell) => cell.t === 1) &&
		row.slice(start + width).every((cell) => cell.t === 1)
	);
}

function clearFullRows(board) {
	let cleared = 0;
	const next = board.filter((row) => {
		if (row.every((cell) => cell.t === 1)) {
			cleared++;
			return false;
		}
		return true;
	});
	while (next.length < 40) next.unshift(emptyRow());
	return { board: next, cleared };
}

// Permanent garbage in 4W keeps its hole inside the well and the walls.
{
	const sandbox = loadPracticeGarbage();
	sandbox.board = make4wBoard();
	sandbox.mode = '4w';
	sandbox.addPracticeGarbage(1, 0, true);
	const bottom = sandbox.board[39];
	const hole = wellCells(bottom).findIndex((cell) => cell.t === 0);
	assert(hole >= 0 && hole < 4, '4W permanent garbage hole is inside the well');
	assert(hasWalls(bottom), '4W permanent garbage keeps the side walls');
	assert(
		wellCells(bottom)
			.filter((cell) => cell.t === 1)
			.every((cell) => cell.permanent),
		'4W permanent garbage cells are marked permanent'
	);
}

// A cleared permanent row respawns without growing the well stack.
{
	const sandbox = loadPracticeGarbage();
	sandbox.board = make4wBoard();
	sandbox.mode = '4w';
	for (let row = 37; row < 40; row++) {
		for (let col = 3; col < 7; col++) {
			if ((row + col) % 2 === 0) sandbox.board[row][col] = { t: 1, c: 'X' };
		}
	}
	sandbox.addPracticeGarbage(1, 0, true);
	const before = nonEmptyWellRows(sandbox.board);
	const bottom = sandbox.board[39];
	const hole = wellCells(bottom).findIndex((cell) => cell.t === 0);
	bottom[3 + hole] = { t: 1, c: 'X' };
	const cleared = clearFullRows(sandbox.board);
	assert.strictEqual(cleared.cleared, 1, 'one permanent row cleared');
	sandbox.board = cleared.board;
	sandbox.addPracticeGarbage(1, 0, true);
	const infinite = loadInfiniteGarbage();
	infinite.board = sandbox.board;
	infinite.mode = '4w';
	infinite.addInfiniteGarbage(1, false);
	assert.strictEqual(
		nonEmptyWellRows(infinite.board),
		before,
		'permanent respawn keeps the well stack height'
	);
	assert(hasWalls(infinite.board[0]), 'top row keeps its side walls after a permanent clear');
}

// A cleared garbage line is not replaced automatically.
{
	const sandbox = loadPracticeGarbage();
	sandbox.board = make4wBoard();
	sandbox.mode = '4w';
	sandbox.addPracticeGarbage(1, 0, false);
	const before = nonEmptyWellRows(sandbox.board);
	const bottom = sandbox.board[39];
	const hole = wellCells(bottom).findIndex((cell) => cell.t === 0);
	bottom[3 + hole] = { t: 1, c: 'X' };
	const cleared = clearFullRows(sandbox.board);
	assert.strictEqual(cleared.cleared, 1, 'one garbage row cleared');
	const infinite = loadInfiniteGarbage();
	infinite.board = cleared.board;
	infinite.mode = '4w';
	infinite.addInfiniteGarbage(cleared.cleared, false);
	assert.strictEqual(
		nonEmptyWellRows(infinite.board),
		before - 1,
		'cleared garbage line is not replaced'
	);
	assert(hasWalls(infinite.board[0]), 'top row keeps its side walls after a garbage clear');
}

// 3W permanent garbage uses the 3-wide well.
{
	const sandbox = loadPracticeGarbage();
	sandbox.board = make3wBoard();
	sandbox.mode = '3w';
	sandbox.addPracticeGarbage(1, 0, true);
	const bottom = sandbox.board[39];
	const hole = wellCells(bottom, 3, 3).findIndex((cell) => cell.t === 0);
	assert(hole >= 0 && hole < 3, '3W permanent garbage hole is inside the well');
	assert(hasWalls(bottom, 3, 3), '3W permanent garbage keeps the side walls');
}

// Removing a permanent layer keeps the walls.
{
	const sandbox = loadPracticeGarbage();
	sandbox.board = make4wBoard();
	sandbox.mode = '4w';
	sandbox.addPracticeGarbage(2, 0, true);
	const before = nonEmptyWellRows(sandbox.board);
	sandbox.addPracticeGarbage(1, 0, true, true);
	assert.strictEqual(
		nonEmptyWellRows(sandbox.board),
		before - 1,
		'removing a permanent layer removes one row'
	);
	assert(hasWalls(sandbox.board[0]), 'top row keeps its side walls after removing a layer');
}

// Non-4W modes keep the original 10-wide behavior.
{
	const sandbox = loadPracticeGarbage();
	sandbox.board = Array.from({ length: 40 }, emptyRow);
	sandbox.mode = 'practice';
	sandbox.addPracticeGarbage(1, 0, true);
	const bottom = sandbox.board[39];
	const hole = bottom.findIndex((cell) => cell.t === 0);
	assert(hole >= 0 && hole < 10, 'normal mode hole is in columns 0-9');
	assert(
		bottom.filter((cell) => cell.t === 1).every((cell) => cell.permanent),
		'normal mode garbage is permanent'
	);
}

console.log('practice garbage tests passed');
