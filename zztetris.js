const urlParams = new URLSearchParams(window.location.search);
const mode = urlParams.get('mode') || 'practice';

// Hide the generic analyzer controls before the game finishes loading in 4W
// modes; the dedicated combo panel takes over.
if (mode === '4w' || mode === '4w4res' || mode === '4w5res' || mode === '4w6res') {
	document.getElementById('evalPanel')?.classList.add('eval-panel--fourw');
}

function restart() {
	if (window.ZZReplayPractice?.restart()) return;
	if (board.length > 0 && board[board.length - 1].filter((c) => c.t != 1).length == boardSize[0]) {
		// lazy check, will have false positives, but whatever
		if (queue[6] == '|' && holdP == '') {
			// if they reset after resetting, just restart hist
			hist = [
				{
					board: JSON.stringify(board),
					queue: JSON.stringify(queue),
					hold: holdP,
					piece: piece,
					stats: window.ZZStats?.snapshot(),
				},
			];
			histPos = 0;
		}
	}
	board = [];
	for (let i = 0; i < boardSize[1]; i++) {
		board.push(aRow());
	}

	// Mode-specific restart logic
	if (mode === 'cheese') {
		curCol = Math.floor(Math.random() * 10);
		while (garbageHeight() < 10) {
			let nextCol = Math.floor(Math.random() * 10);
			while (nextCol == lastCol) {
				nextCol = Math.floor(Math.random() * 10);
			}
			garbage(nextCol);
			lastCol = nextCol;
		}
	} else if (mode === '4w') {
		for (let i = 0; i < boardSize[1]; i++) {
			board[i] = [ {t:1, c:'X'}, {t:1, c:'X'}, {t:1, c:'X'}, {t:0, c:''}, {t:0, c:''}, {t:0, c:''}, {t:0, c:''}, {t:1, c:'X'}, {t:1, c:'X'}, {t:1, c:'X'} ];
		}
		let initRes = res_3[Math.floor(Math.random() * res_3.length)];
		for (let row = 0; row < 3; row++) {
			for (let col = 0; col < 4; col++) {
				if (initRes[row][col] == 1) {
					board[37 + row][col + 3] = {t:1, c:'X'};
				}
			}
		}
	} else if (mode === '4w4res') {
		for (let i = 0; i < boardSize[1]; i++) {
			board[i] = [ {t:1, c:'X'}, {t:1, c:'X'}, {t:1, c:'X'}, {t:0, c:''}, {t:0, c:''}, {t:0, c:''}, {t:0, c:''}, {t:1, c:'X'}, {t:1, c:'X'}, {t:1, c:'X'} ];
		}
		let initRes = res_4[Math.floor(Math.random() * res_4.length)];
		for (let row = 0; row < 4; row++) {
			for (let col = 0; col < 4; col++) {
				if (initRes[row][col] == 1) {
					board[36 + row][col + 3] = {t:1, c:'X'};
				}
			}
		}
	} else if (mode === '4w5res') {
		for (let i = 0; i < boardSize[1]; i++) {
			board[i] = [ {t:1, c:'X'}, {t:1, c:'X'}, {t:1, c:'X'}, {t:0, c:''}, {t:0, c:''}, {t:0, c:''}, {t:0, c:''}, {t:1, c:'X'}, {t:1, c:'X'}, {t:1, c:'X'} ];
		}
		let initRes = res_5[Math.floor(Math.random() * res_5.length)];
		for (let row = 0; row < 4; row++) {
			for (let col = 0; col < 4; col++) {
				if (initRes[row][col] == 1) {
					board[36 + row][col + 3] = {t:1, c:'X'};
				}
			}
		}
	} else if (mode === '4w6res') {
		for (let i = 0; i < boardSize[1]; i++) {
			board[i] = [ {t:1, c:'X'}, {t:1, c:'X'}, {t:1, c:'X'}, {t:0, c:''}, {t:0, c:''}, {t:0, c:''}, {t:0, c:''}, {t:1, c:'X'}, {t:1, c:'X'}, {t:1, c:'X'} ];
		}
		let initRes = res_6[Math.floor(Math.random() * res_6.length)];
		for (let row = 0; row < 4; row++) {
			for (let col = 0; col < 4; col++) {
				if (initRes[row][col] == 1) {
					board[36 + row][col + 3] = {t:1, c:'X'};
				}
			}
		}
	} else if (mode === '3w') {
		for (let i = 20; i < boardSize[1]; i++) {
			board[i] = [ {t:1, c:'X'}, {t:1, c:'X'}, {t:1, c:'X'}, {t:0, c:''}, {t:0, c:''}, {t:0, c:''}, {t:1, c:'X'}, {t:1, c:'X'}, {t:1, c:'X'}, {t:1, c:'X'} ];
		}
	}

	// Practice permanent initial garbage
	if (document.getElementById('practicePermanent') && document.getElementById('practicePermanent').checked) {
		const layers = parseInt(document.getElementById('practiceLayers').value) || 1;
		const messiness = parseInt(document.getElementById('practiceMessiness').value) || 0;
		if (typeof addPracticeGarbage === 'function') {
			addPracticeGarbage(layers, messiness, true);
		}
	}

	queue = [];
	rot = 0;
	piece = '';
	holdP = '';
	held = false;
	xPOS = spawn[0];
	yPOS = spawn[1];
	xGHO = spawn[0];
	yGHO = spawn[1];
    oldcombo = combo;
	combo = -1;
    oldb2b = b2b;
	b2b = -1;
	topOutSoundPlayed = false;
	newPiece();
	window.ZZStats?.onRestart();
	window.ZZAttackSim?.onRestart();
	if (hist[histPos]) {
		hist[histPos].stats = window.ZZStats?.snapshot();
		hist[histPos].combo = combo;
		hist[histPos].b2b = b2b;
		hist[histPos].oldcombo = oldcombo;
		hist[histPos].oldb2b = oldb2b;
		hist[histPos].attackDisplay = window.ZZStats?.getAttackDisplay?.();
	}
}

function garbageHeight() {
	for (let row = 0; row < board.length; row++) {
		for (let col = 0; col < board[0].length; col++) {
			if (board[row][col].c == 'X') return board.length - row;
		}
	}
	return 0;
}

// Restore the side walls above the current wall stack without moving the
// well stack. Used when endless garbage is off: the cleared rows fall away
// normally, but the mode must not turn into a 10-wide board.
function preserveWalls(lines, well) {
	if (!lines) return;
	let topWall = board.length;
	for (let row = 0; row < board.length; row++) {
		let hasWall = false;
		for (let col = 0; col < boardSize[0]; col++) {
			if (col >= well.start && col < well.start + well.width) continue;
			if (board[row][col] && board[row][col].t === 1) {
				hasWall = true;
				break;
			}
		}
		if (hasWall) {
			topWall = row;
			break;
		}
	}
	const start = Math.max(0, topWall - lines);
	for (let row = start; row < topWall; row++) {
		for (let col = 0; col < boardSize[0]; col++) {
			if (col >= well.start && col < well.start + well.width) continue;
			board[row][col] = { t: 1, c: 'X' };
		}
	}
}

// 4W and 3W practice modes always keep their side walls. When `addGarbage`
// is true, each line is also replaced by a fresh garbage line at the bottom
// of the well (used by the attack simulator); when false, only the side
// walls are restored and the well stack can run out.
function addInfiniteGarbage(lines, addGarbage = true) {
	if (!lines) return;
	const wells = {
		'4w': { start: 3, width: 4 },
		'4w4res': { start: 3, width: 4 },
		'4w5res': { start: 3, width: 4 },
		'4w6res': { start: 3, width: 4 },
		'3w': { start: 3, width: 3 },
	};
	const well = wells[mode];
	if (!well) return;

	if (!addGarbage) {
		preserveWalls(lines, well);
	} else {
		for (let i = 0; i < lines; i++) {
			const hole = well.start + Math.floor(Math.random() * well.width);
			const row = [];
			for (let col = 0; col < boardSize[0]; col++) {
				if (col >= well.start && col < well.start + well.width) {
					row.push(col === hole ? { t: 0, c: '' } : { t: 1, c: 'X' });
				} else {
					row.push({ t: 1, c: 'X' });
				}
			}
			board.shift();
			board.push(row);
		}
	}

	xPOS = spawn[0];
	yPOS = spawn[1];
	updateGhost();
}

function PC(PC_num) {
    restart();
    var currBag = ('ZLOSIJT'.split('').shuffle().slice(0, (10 - 3*PC_num) % 7));
    if (PC_num == 8) {
        currBag = 'ZLOSIJT'.split('').shuffle();
        currBag.splice(Math.ceil(Math.random()*6), 1, currBag[0]);
    } else if (PC_num == 9) {
        var ninths = ["TLI", "TJI", "TLS", "TJS", "TLO", "TJO", "TLZ", "TJZ"];
        currBag = (ninths[Math.floor(Math.random() * 8)]).split('').shuffle();
        currBag.unshift("T");
    }
    currBag.push('|');
    queue = currBag;
    newPiece();
}

function game() {
	if (mode === 'cheese') {
		callback(undefined, true, true);
	} else if (mode === 'grav') {
		callback(gravity = 4);
	} else if (mode === '4w' || mode === '4w4res' || mode === '4w5res' || mode === '4w6res' || mode === '3w') {
		callback(undefined, true);
	} else if (mode === 'pc') {
		document.addEventListener('keyup', (e) => {
			if (e.keyCode >= 49 && e.keyCode <= 57) {
				e.preventDefault();
				if (document.activeElement && document.activeElement.blur) {
					document.activeElement.blur();
				}
				PC(e.keyCode - 48);
			}
		}, false);
		callback();
	} else {
		callback();
	}
}
