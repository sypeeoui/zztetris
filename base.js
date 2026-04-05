const print = console.log;
const LS = localStorage; // client side data storage

function ctrlsPopup() { // opens a popup window with keybinds

	const p = window.open('controls.html', 'popup', 'width=1200,height=800');
	var reloading = false;

	setInterval(() => {
		// event onbeforeunload wont work and idk why so i gotta use this
		if (p.closed && !reloading) {
			location.reload();
			reloading = true;
		}
	}, 100);

}

function aboutPopup() {
	window.alert(`START BY ADJUSTING KEYBINDS AND SETTINGS
zztetris
a tetris client with a name that starts with zz so you can type zz and have it autocomplete
forked from aznguy's schoolteto, a number of features added
inspired by fio's four-tris
---
Import/Export works through your clipboard. Doesn't work on Firefox.
Undo/redo is a thing. It keeps track of your board state history.
*Full* fumen import/export sets your board state history as the fumen pages and vice versa.
Drawing on the board is a thing.`);
}

// Array.prototype.getRand = function () {
// 	return this[Math.floor(Math.random() * this.length)];
// };
// Array.prototype.shuffle = function () {
//     let i = this.length, j, temp;
//     if (i == 0) return this;
//     while ( --i ) {
//         j = Math.floor( Math.random() * ( i + 1 ) );
//         temp = this[i];
//         this[i] = this[j];
//         this[j] = temp;
//     }
//     return this;
// };


//! Use Object.defineProperty instead of directly modifying Array.prototype
//! https://stackoverflow.com/a/35518127

Object.defineProperty(Array.prototype, 'getRand', { // returns random element from array

	//? this function is unused, delete? - g3ner1c

    value: function() {
		return this[Math.floor(Math.random() * (this.length + 1))];
	}

});

Object.defineProperty(Array.prototype, 'shuffle', {

	value: function() { // shuffles array

		let i = this.length, j, temp;

		if (i == 0) return this; // array length 0

		while (--i) {
			j = Math.floor(Math.random() * (i + 1));
			temp = this[i];
			this[i] = this[j];
			this[j] = temp;
		}
		return this;
	}
});

var ctrl = { // default controls

	//? should probably add handling settings in here - g3ner1c

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

const flags = {
	HD: 1,
	R: 2,
	L: 4,
	SD: 8,
	HL: 16,
	CW: 32,
	CCW: 64,
	R180: 128,
	UNDO: 256,
	REDO: 512,
	RE: 1024,
};

const color = { // piece colors
	Z: '#F00',
	L: '#F80',
	O: '#FF0',
	S: '#0F0',
	I: '#0BF',
	J: '#05F',
	T: '#C3F',
	A: '#2A2A2A',
	X: '#999999',
};

const reversed = { // mirrored pieces
	Z: 'S',
	L: 'J',
	O: 'O',
	S: 'Z',
	I: 'I',
	J: 'L',
	T: 'T',
	A: 'A',
	X: 'X',
	'|': '|',
};

var imgs = { // piece images
	grid: './assets/pieceSprite/grid.png',
	Z: './assets/pieceSprite/z.png',
	L: './assets/pieceSprite/l.png',
	O: './assets/pieceSprite/o.png',
	S: './assets/pieceSprite/s.png',
	I: './assets/pieceSprite/i.png',
	J: './assets/pieceSprite/j.png',
	T: './assets/pieceSprite/t.png',
};

// default settings
var cellSize = 20; // pixels
var boardSize = [10, 40];
var hiddenRows = 20; // starts from the top

var DAS = 160;
var ARR = 30;
var SDR = 15;
var audiolevel = 100;

//* client side config storage

//? Sketchy settings processing probably could be simplified
//? Should probably add handling settings in here in the future - g3ner1c

if (LS.config && LS.version == '2023-05-02a') {

	// Load saved config from LocalStorage

	const CTRLS = JSON.parse(LS.config);

	let codes = Object.values(ctrl); // Action codes

	ctrl = {};
	for (let i = 0; i < 11; i++) {
		ctrl[CTRLS[i]] = codes[i];
	}
	DAS = parseInt(CTRLS[11]);
	ARR = parseInt(CTRLS[12]);
	SDR = parseInt(CTRLS[13]);
	cellSize = parseInt(CTRLS[14]);
    audiolevel = parseInt(CTRLS[15]);
    console.log("Loaded Vars");

} else {

	// No config found or outdated version, make new
    console.log("No Config Found");
	let codes = Object.keys(ctrl); // Deafult keys
	codes.push('160', '30', '15', '20','100'); // Handling settings
	LS.config = JSON.stringify(codes);
	aboutPopup();

}

const notf = $('#notif');

const names = 'ZLOSIJT'.split(''); // piece names

const spawn = [Math.round(boardSize[0] / 2) - 2, hiddenRows - 3];
const a = { t: 0, c: '' }; // t:0 = nothing   t:1 = heap mino   t:2 = current mino   t:3 = ghost mino
//? ^^ ??? - g3ner1c

var aRow = function () {
    // var instead of const because aRow varies across modes
	return '.'
		.repeat(boardSize[0])
		.split('')
		.map(() => {
			return a;
		});
};
const rotDir = {
	CW: 1,
	CCW: 3,
	R180: 2,
};

var sfxCache = {};
var board = [];
var queue = [];
var piece = '';
var holdP = '';
var held = false;
var Ldn = (Rdn = false);
var rot = 0;
var oldcombo = 0;
var oldb2b = 0;
var combo = -1;
var b2b = 0;
var dasID = 0;
var sdINT = (dasINT = null);
var xPOS = spawn[0];
var yPOS = spawn[1];
var xGHO = spawn[0];
var yGHO = spawn[1];
var lastAction = '';
var hist = [];
var histPos = 0;
var ctx = document.getElementById('b').getContext('2d');
var ctxH = document.getElementById('h').getContext('2d');
var ctxN = document.getElementById('n').getContext('2d');
var gridCvs = document.createElement('canvas');
gridCvs.height = cellSize;
gridCvs.width = cellSize;
var gridCtx = gridCvs.getContext('2d');
gridCtx.fillStyle = '#000000';
gridCtx.fillRect(0, 0, cellSize, cellSize);
gridCtx.strokeStyle = '#3A3A3A';
gridCtx.strokeRect(0, 0, cellSize, cellSize);
var pattern = ctx.createPattern(gridCvs, 'repeat');
const enginePieceToChar = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const charToEnginePiece = {
	I: 0,
	O: 1,
	T: 2,
	S: 3,
	Z: 4,
	J: 5,
	L: 6,
};
const pieceBaseCoords = {
	I: [
		[-1, 0],
		[0, 0],
		[1, 0],
		[2, 0],
	],
	O: [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1],
	],
	T: [
		[-1, 0],
		[0, 0],
		[1, 0],
		[0, 1],
	],
	L: [
		[-1, 0],
		[0, 0],
		[1, 0],
		[1, 1],
	],
	J: [
		[-1, 0],
		[0, 0],
		[1, 0],
		[-1, 1],
	],
	S: [
		[-1, 0],
		[0, 0],
		[0, 1],
		[1, 1],
	],
	Z: [
		[-1, 1],
		[0, 1],
		[0, 0],
		[1, 0],
	],
};
var evalUiReady = false;
var evalState = {
	enabled: false,
	optionsHidden: true,
	inFlight: false,
	playbackInFlight: false,
	lastRequestAt: 0,
	lastAppliedHash: '',
	selectedRouteKey: 'best_pv',
	routeFollowMode: 'pv',
	hoverRouteKey: '',
	reachabilityMode: 'relaxed',
	playbackInputsPerSecond: 2,
	latestData: null,
	overlayCells: [],
};
var evalControlApi = null;
for (let i = 0; i < boardSize[1]; i++) {
	board.push(aRow());
}
document.getElementById('b').height = (boardSize[1] - hiddenRows + 2) * cellSize;
document.getElementById('b').width = boardSize[0] * cellSize;

var keys = Object.keys(imgs);
keys.map((k, idx) => {
	var i = new Image();
	i.onload = () => {
		imgs[k] = i;
		if (idx + 1 == keys.length)
			setTimeout(() => {
				game();
			}, 250); // Load images first, then load game after
	};
	i.src = imgs[k];
});

// Keys
var keysDown;
var lastKeys;

// mouse stuff for drawing

mouseY = 0; // which cell on the board the mouse is over
mouseX = 0;
mouseDown = false;
drawMode = true;
movingCoordinates = false;

document.getElementById('b').onmousemove = function mousemove(e) {
	rect = document.getElementById('b').getBoundingClientRect();
	y = Math.floor((e.clientY - rect.top - 18) / cellSize);
	x = Math.floor((e.clientX - rect.left - 18) / cellSize);

	if (inRange(x, 0, 9) && inRange(y, 0, 21)) {
		movingCoordinates = y != mouseY || x != mouseX;

		mouseY = y;
		mouseX = x;

		if (mouseDown && movingCoordinates) {
			if (!drawMode) {
				board[boardSize[1] + mouseY - hiddenRows - 2][mouseX] = { t: 0, c: '' };
			} else {
				board[boardSize[1] + mouseY - hiddenRows - 2][mouseX] = { t: 1, c: paintbucketColor() };
			}
			updateGhost();
		}
	}
};

document.getElementById('b').onmousedown = function mousedown(e) {
	rect = document.getElementById('b').getBoundingClientRect();
	mouseY = Math.floor((e.clientY - rect.top - 18) / cellSize);
	mouseX = Math.floor((e.clientX - rect.left - 18) / cellSize);

	if (inRange(mouseX, 0, 9) && inRange(mouseY, 0, 21)) {
		if (!mouseDown) {
			movingCoordinates = false;
			drawMode = e.button != 0 || board[boardSize[1] + mouseY - hiddenRows - 2][mouseX]['t'] == 1;
			if (drawMode) {
				board[boardSize[1] + mouseY - hiddenRows - 2][mouseX] = { t: 0, c: '' };
			} else {
				board[boardSize[1] + mouseY - hiddenRows - 2][mouseX] = { t: 1, c: paintbucketColor() };
			}
			updateGhost();
		}
		mouseDown = true;
		drawMode = board[boardSize[1] + mouseY - hiddenRows - 2][mouseX]['t'] == 1;
	}
};

document.onmouseup = function mouseup() {
	mouseDown = false;

	if (drawMode) {
		// compare board with hist[histPos]['board'] and attempt to autocolor
		drawn = [];
		erased = [];
		oldBoard = JSON.parse(hist[histPos]['board']);
		board.map((r, i) => {
			r.map((c, ii) => {
				if (c.t == 1 && c.c != oldBoard[i][ii].c) drawn.push({ y: i, x: ii });
				if (c.t == 0 && 1 == oldBoard[i][ii].t) erased.push({ y: i, x: ii });
			});
		});
		if (drawn.length == 4 && document.getElementById('autocolor').checked) {
			// try to determine which tetramino was drawn
			// first entry should be the topleft one

			names.forEach((name) => {
				// jesus christ this is a large number of nested loops
				checkPiece = pieces[name];
				checkPiece.forEach((rot) => {
					for (y = 0; y <= 2; y++) {
						for (x = 0; x <= 2; x++) {
							matches = 0;
							for (row = 0; row < 4; row++) {
								for (col = 0; col < 4; col++) {
									if (rot[row][col] == 1) {
										checkY = row + drawn[0].y - y;
										checkX = col + drawn[0].x - x;
										drawn.forEach((coordinate) => {
											if (coordinate.x == checkX && coordinate.y == checkY) {
												matches++;
											}
										});
									}
								}
							}
							if (matches == 4) {
								// that's a match; color it
								drawn.forEach((coordinate) => {
									board[coordinate.y][coordinate.x].c = name;
								});
							}
						}
					}
				});
			});
		}
		if (drawn.length != 0 || erased.length != 0) updateHistory();
	}
};

function paintbucketColor() {
	for (i = 0; i < document.paintbucket.length; i++) {
		if (document.paintbucket[i].checked) {
			return document.paintbucket[i].id;
		}
	}
}

// queue
document.getElementById('n').addEventListener('click', (event) => {
	let QueueInput = prompt('Queue', piece + queue.join('')).toUpperCase();
	// ok there's probably a regex way to do this but...
	temp = [];
	for (i = 0; i < QueueInput.length; i++) {
		//sanitization
		if ('SZLJIOT'.includes(QueueInput[i])) temp.push(QueueInput[i]);
	}
	if (temp.length > 0) {
		temp.push('|'); // could probably insert one every 7 pieces but am too lazy
		queue = temp;
		newPiece();
	}
	updateHistory();
});

// hold
document.getElementById('h').addEventListener('click', (event) => {
	let HoldInput = prompt('Hold', holdP).toUpperCase();
	if (HoldInput.length == 0) {
		holdP = '';
		updateQueue();
		return;
	}
	HoldInput = HoldInput[0]; // make sure it's just 1 character
	//sanitization
	if ('SZLJIOT'.includes(HoldInput)) {
		holdP = HoldInput;
		updateQueue();
	}
});

// Mobile buttons
const ua = navigator.userAgent;
if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
	console.log('why do you even have a tablet');
	document.getElementById('tcc').style.display = 'inline-block';
} else if (
	/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)
) {
	console.log('mobile is bad and you should feel bad');
	document.getElementById('tcc').style.display = 'inline-block';
} // else document.getElementById("tcc").style.display = 'none';

function updateHistory() {
	histPos++;
	hist[histPos] = {
		board: JSON.stringify(board),
		queue: JSON.stringify(queue),
		hold: holdP,
		piece: piece,
	};
	if (histPos > 500) {
		// just in case hist is taking up too much memory
		hist.splice(0, 100);
		histPos -= 100;
	}
	while (histPos < hist.length - 1) {
		// remove future history if it exists
		hist.pop();
	}
}

function updateGhost() {
	// updateGhost() must ALWAYS be before setShape()
	xGHO = xPOS;
	yGHO = yPOS;
	while (canMove(pieces[piece][rot], xGHO, yGHO + 1)) {
		yGHO++;
	}
}

function canMove(p, x, y) {
	var free = 0;
	for (let row = 0; row < 4; row++) {
		for (let cell = 0; cell < 4; cell++) {
			if (p[row][cell] == 1) {
				if (board[y + row] && board[y + row][x + cell] && board[y + row][x + cell].t != 1) {
					free++;
				}
			}
		}
	}
	return free >= 4;
}

function checkTopOut() {
	p = pieces[piece][rot];
	for (r = 0; r < p.length; r++) {
		for (c = 0; c < p[0].length; c++) {
			if (p[r][c] != 0) {
				if (board[r + yPOS][c + xPOS].t == 1) {
					notify('TOP OUT');
				}
			}
		}
	}
}

function setShape(hd) {
	var p = pieces[piece][rot];
	p.map((r, i) => {
		r.map((c, ii) => {
			var rowG = board[i + yGHO];
			if (c == 1 && rowG && rowG[ii + xGHO]) rowG[ii + xGHO] = { t: 3, c: piece };
			var rowP = board[i + yPOS];
			if (c == 1 && rowP && rowP[ii + xPOS]) rowP[ii + xPOS] = { t: hd ? 1 : 2, c: piece };
		});
	});
	//render()
}

function clearActive() {
	board.map((r, i) => {
		r.map((c, ii) => {
			if (c.t == 2 || (c.t == 3 && board[i][ii])) {
				board[i][ii].t = 0;
				board[i][ii].c = '';
			}
		});
	});
}

function newPiece() {
	while (queue.length < 10) {
		var shuf = names.shuffle();
		shuf.map((p) => queue.push(p));
		queue.push('|');
	}
	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	if (queue[0] == '|') queue.shift();
	piece = queue.shift();
	checkTopOut();
	updateQueue();
	updateGhost();
	setShape();

	if (keysDown & flags.L) {
		lastKeys = keysDown;
	} else if (keysDown & flags.R) {
		lastKeys = keysDown;
	}
}

function notify(text) {
	const inANIM = 'animate__animated animate__bounceIn';
	const outANIM = 'animate__animated animate__fadeOutDown';
	notf.removeClass(inANIM);
	notf.removeClass(outANIM);
	notf.html(text);
	notf.addClass(inANIM);
	setTimeout(() => {
		notf.removeClass(inANIM);
		notf.addClass(outANIM);
	}, 1000);
}

function undo() {
	if (histPos > 0) {
		histPos--;
		board = JSON.parse(hist[histPos]['board']);
		queue = JSON.parse(hist[histPos]['queue']);
		holdP = hist[histPos]['hold'];
		piece = hist[histPos]['piece'];
        if (combo >= 1)
        {
            combo-=1;
        }
        else
        {
            combo=oldcombo;
        }
		if(b2b >= 1 && (tspin || mini || cleared == 4))
        {   
            b2b-=1;
        }
        else
        {
            b2b = oldb2b;        
        }
		xPOS = spawn[0];
		yPOS = spawn[1];
		rot = 0;
		clearActive();
		updateGhost();
		setShape();
		updateQueue();
		syncEvalChainInputsFromGame();
	}
}

function redo() {
	if (histPos < hist.length - 1) {
		board = JSON.parse(hist[histPos + 1]['board']);
		queue = JSON.parse(hist[histPos + 1]['queue']);
		holdP = hist[histPos + 1]['hold'];
		piece = hist[histPos + 1]['piece'];
		histPos++;

		xPOS = spawn[0];
		yPOS = spawn[1];
		rot = 0;
		clearActive();
		updateGhost();
		setShape();
		updateQueue();
		syncEvalChainInputsFromGame();
	}
}

function rotateCoordForEngine(rotation, x, y) {
	switch (rotation % 4) {
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

function getMoveCells(moveObj) {
	const pieceChar = enginePieceToChar[moveObj.piece];
	const base = pieceBaseCoords[pieceChar];
	if (!base) return [];

	return base.map((coord) => {
		const rotated = rotateCoordForEngine(moveObj.rotation, coord[0], coord[1]);
		return {
			x: moveObj.x + rotated.x,
			y: moveObj.y + rotated.y,
			piece: pieceChar,
		};
	});
}

function boardRowsForEngine() {
	const rows = new Array(40).fill(0);
	for (let i = 0; i < boardSize[1]; i++) {
		for (let x = 0; x < boardSize[0]; x++) {
			if (board[i][x].t == 1) {
				const engineY = boardSize[1] - 1 - i;
				rows[engineY] |= 1 << x;
			}
		}
	}
	return rows;
}

function queueForEngine(maxLen = 14) {
	const clean = queue.filter((p) => p != '|').slice(0, maxLen);
	return clean.map((p) => charToEnginePiece[p]).filter((v) => v !== undefined);
}

function getEvaluationStateHash() {
	const rows = boardRowsForEngine();
	const queueIds = queueForEngine();
	return JSON.stringify({
		rows,
		piece,
		holdP,
		queue: queueIds,
	});
}

function getEvalElement(id) {
	return document.getElementById(id);
}

function getDefaultEvalApiBase() {
	const origin = (window.location?.origin || '').trim();
	if (origin && origin != 'null') {
		return origin.replace(/\/$/, '');
	}
	return '';
}

function setEvalStatus(text, isError = false) {
	const statusEl = getEvalElement('evalStatus');
	if (!statusEl) return;
	statusEl.textContent = text;
	statusEl.style.color = isError ? '#ff8f8f' : '#bdbdbd';
}

function formatEvalNumber(v) {
	return typeof v == 'number' ? v.toFixed(3) : '-';
}

function getReachabilityButtonText() {
	return `Reachability: ${evalState.reachabilityMode}`;
}

function getPlaybackInputRate() {
	const inputEl = getEvalElement('evalInputRate');
	const raw = inputEl ? parseFloat(inputEl.value) : evalState.playbackInputsPerSecond;
	if (Number.isFinite(raw) && raw > 0) {
		evalState.playbackInputsPerSecond = raw;
		return raw;
	}
	return evalState.playbackInputsPerSecond || 2;
}

function currentComboForEngine() {
	if (typeof combo != 'number') return 0;
	return Math.max(0, Math.floor(combo));
}

function currentB2BForEngine() {
	if (typeof b2b != 'number') return 0;
	return Math.max(0, Math.floor(b2b));
}

function syncEvalChainInputsFromGame() {
	const comboEl = getEvalElement('evalCurrentCombo');
	const b2bEl = getEvalElement('evalCurrentB2b');

	if (comboEl) {
		comboEl.value = String(currentComboForEngine());
	}
	if (b2bEl) {
		b2bEl.value = String(currentB2BForEngine());
	}
}

function applyEvalChainInputsToGame() {
	const comboEl = getEvalElement('evalCurrentCombo');
	const b2bEl = getEvalElement('evalCurrentB2b');

	if (comboEl) {
		const parsedCombo = Math.floor(parseFloat(comboEl.value));
		if (Number.isFinite(parsedCombo) && parsedCombo >= 0) {
			combo = parsedCombo;
			oldcombo = combo;
		}
	}

	if (b2bEl) {
		const parsedB2b = Math.floor(parseFloat(b2bEl.value));
		if (Number.isFinite(parsedB2b) && parsedB2b >= 0) {
			b2b = parsedB2b;
			oldb2b = b2b;
		}
	}

	syncEvalChainInputsFromGame();
}

function sleepMs(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function readNumberInput(id, fallback, minValue = null) {
	const el = getEvalElement(id);
	if (!el) return fallback;
	const value = parseFloat(el.value);
	if (!Number.isFinite(value)) return fallback;
	if (minValue !== null && value < minValue) return fallback;
	return value;
}

function getSearchOverridesFromUi() {
	return {
		beam_width: Math.floor(readNumberInput('evalBeamWidth', 800, 1)),
		depth: Math.floor(readNumberInput('evalDepth', 14, 1)),
		futility_delta: readNumberInput('evalFutilityDelta', 15.0, 0),
		time_budget_ms: Math.floor(readNumberInput('evalTimeBudgetMs', 50, 1)),
		use_tt: !!getEvalElement('evalUseTt')?.checked,
		extend_queue_7bag: !!getEvalElement('evalExtendQueue')?.checked,
		attack_weight: readNumberInput('evalAttackWeight', 0.5, 0),
		chain_weight: readNumberInput('evalChainWeight', 1.0, 0),
		context_weight: readNumberInput('evalContextWeight', 0.1, 0),
		board_weight: readNumberInput('evalBoardWeight', 1.0, 0),
		quiescence_max_extensions: Math.floor(readNumberInput('evalQMaxExtensions', 3, 0)),
		quiescence_beam_fraction: readNumberInput('evalQBeamFraction', 0.15, 0),
	};
}

function hexToRgba(hex, alpha) {
	let cleaned = (hex || '').replace('#', '');
	if (cleaned.length == 3) {
		cleaned = cleaned
			.split('')
			.map((c) => c + c)
			.join('');
	}
	if (cleaned.length != 6) {
		return `rgba(255,255,255,${alpha})`;
	}
	const r = parseInt(cleaned.slice(0, 2), 16);
	const g = parseInt(cleaned.slice(2, 4), 16);
	const b = parseInt(cleaned.slice(4, 6), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}

function applyCompactOptionsVisibility() {
	const panel = document.querySelector('.board-settings');
	const toggleBtn = getEvalElement('evalToggleOptionsBtn');
	if (!panel || !toggleBtn) return;

	if (evalState.enabled) {
		toggleBtn.disabled = false;
		if (evalState.optionsHidden) {
			panel.classList.add('board-settings--compact');
			toggleBtn.textContent = 'Show Options';
		} else {
			panel.classList.remove('board-settings--compact');
			toggleBtn.textContent = 'Hide Options';
		}
	} else {
		panel.classList.remove('board-settings--compact');
		toggleBtn.disabled = true;
		toggleBtn.textContent = 'Show Options';
	}
}

function buildEvaluationRoutes(data) {
	const routes = [];
	const bestPv = data.pv && data.pv.length > 0 ? data.pv : data.best_move ? [data.best_move] : [];
	if (bestPv.length > 0) {
		routes.push({
			key: 'best_pv',
			label: 'Best PV',
			moves: bestPv,
			score: data.score,
			probability: null,
			hold_used: data.hold_used,
		});
	}

	if (Array.isArray(data.candidates)) {
		data.candidates.forEach((candidate, idx) => {
			const pct = typeof candidate.probability == 'number' ? ` ${(candidate.probability * 100).toFixed(1)}%` : '';
			routes.push({
				key: `candidate_${idx}`,
				label: `Candidate ${idx + 1}${pct}`,
				moves: [candidate],
				score: candidate.score,
				probability: candidate.probability,
				hold_used: candidate.hold_used,
			});
		});
	}

	return routes;
}

function preferredRouteKeyForMode(routes) {
	if (!routes || !routes.length) return '';

	if (evalState.routeFollowMode == 'candidate1') {
		const candidate1 = routes.find((r) => r.key == 'candidate_0');
		if (candidate1) return candidate1.key;
	}

	const bestPv = routes.find((r) => r.key == 'best_pv');
	if (bestPv) return bestPv.key;

	return routes[0].key;
}

function setRouteFollowModeFromSelection(routeKey) {
	if (routeKey == 'best_pv') {
		evalState.routeFollowMode = 'pv';
		LS.evalRouteFollowMode = 'pv';
		return;
	}

	evalState.routeFollowMode = 'candidate1';
	LS.evalRouteFollowMode = 'candidate1';
}

function moveToInputRequest(moveObj) {
	return {
		piece: moveObj.piece,
		rotation: moveObj.rotation,
		x: moveObj.x,
		y: moveObj.y,
		spin: moveObj.spin,
	};
}

async function getInputCountForMove(apiBase, rows, moveObj, force) {
	const res = await fetch(`${apiBase}/v1/get_input_sequence`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			board_rows: rows,
			mv: moveToInputRequest(moveObj),
			use_finesse: false,
			force,
		}),
	});

	if (!res.ok) return -1;
	const data = await res.json();
	if (typeof data.input_count == 'number') return data.input_count;
	if (Array.isArray(data.inputs)) return data.inputs.length;
	return -1;
}

async function getInputSequenceForMove(apiBase, rows, moveObj, force) {
	const res = await fetch(`${apiBase}/v1/get_input_sequence`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			board_rows: rows,
			mv: moveToInputRequest(moveObj),
			use_finesse: false,
			force,
		}),
	});

	if (!res.ok) return [];
	const data = await res.json();
	return Array.isArray(data.inputs) ? data.inputs : [];
}

function reachabilityMoveVariants(moveObj) {
	if (!moveObj) return [];

	const variants = [];
	const seen = new Set();
	let allowedSpins;
	if (moveObj.piece == 2) {
		// T piece: NoSpin/Mini/Full are all valid labels.
		allowedSpins = [0, 1, 2];
	} else if (moveObj.piece == 1) {
		// O piece: no spin classification.
		allowedSpins = [0];
	} else {
		// I/J/L/S/Z: no-spin or all-spin mini only.
		allowedSpins = [0, 1];
	}

	const preferredSpin = Number.isInteger(moveObj.spin) ? moveObj.spin : 0;
	const spins = [preferredSpin, ...allowedSpins].filter((v) => allowedSpins.includes(v));

	for (const spin of spins) {
		const variant = {
			piece: moveObj.piece,
			rotation: moveObj.rotation,
			x: moveObj.x,
			y: moveObj.y,
			spin,
		};
		const key = `${variant.piece}:${variant.rotation}:${variant.x}:${variant.y}:${variant.spin}`;
		if (seen.has(key)) continue;
		seen.add(key);
		variants.push(variant);
	}

	return variants;
}

function applyEngineInputCode(code) {
	if (!evalControlApi) return false;

	switch (code) {
		case 1:
			evalControlApi.moveLeft();
			return true;
		case 2:
			evalControlApi.moveRight();
			return true;
		case 3:
				evalControlApi.moveLeft();
			return true;
		case 4:
				evalControlApi.moveRight();
			return true;
		case 5:
			evalControlApi.rotateCw();
			return true;
		case 6:
			evalControlApi.rotateCcw();
			return true;
		case 7:
			evalControlApi.rotateFlip();
			return true;
		case 8:
			evalControlApi.softDrop();
			return true;
		case 9:
			evalControlApi.hardDrop();
			return true;
		default:
			return false;
	}
}

async function playRoute(route) {
	if (!route || !route.moves?.length) return;
	if (!evalControlApi) {
		setEvalStatus('Playback unavailable before game init.', true);
		return;
	}
	if (evalState.playbackInFlight) {
		setEvalStatus('Playback already running.');
		return;
	}

	const apiBaseInput = getEvalElement('evalApiBase');
	const apiBase = (apiBaseInput?.value || getDefaultEvalApiBase()).trim().replace(/\/$/, '');
	const ips = getPlaybackInputRate();
	const stepDelayMs = 1000 / Math.max(ips, 0.1);
	const gravEl = document.getElementById('grav');
	const gravWasChecked = gravEl ? gravEl.checked : false;
	if (gravEl) gravEl.checked = false;

	evalState.playbackInFlight = true;
	setEvalStatus(`Playing route at ${ips.toFixed(1)} input/s...`);

	try {
		if (route.hold_used && evalControlApi.hold) {
			evalControlApi.hold();
			await sleepMs(stepDelayMs);
		}

		const moveObj = route.moves[0];
		const rows = boardRowsForEngine();
		let inputs = await getInputSequenceForMove(apiBase, rows, moveObj, false);
		if (!inputs.length) {
			inputs = await getInputSequenceForMove(apiBase, rows, moveObj, true);
		}

		if (!inputs.length) {
			setEvalStatus('Playback stopped: no input sequence for selected move.', true);
			return;
		}

		for (const code of inputs) {
			applyEngineInputCode(code);
			await sleepMs(stepDelayMs);
		}

		setEvalStatus('Move playback complete.');
	} catch (error) {
		setEvalStatus(`Playback failed: ${error.message}`, true);
	} finally {
		if (gravEl) gravEl.checked = gravWasChecked;
		evalState.playbackInFlight = false;
	}
}

async function isMoveReachable(apiBase, rows, moveObj, mode) {
	if (!moveObj) return false;

	if (mode == 'strict') {
		const strictVariant = {
			piece: moveObj.piece,
			rotation: moveObj.rotation,
			x: moveObj.x,
			y: moveObj.y,
			spin: Number.isInteger(moveObj.spin) ? moveObj.spin : 0,
		};
		const strictCount = await getInputCountForMove(apiBase, rows, strictVariant, false);
		return strictCount > 0;
	}

	const variants = reachabilityMoveVariants(moveObj);
	if (!variants.length) return false;

	for (const variant of variants) {
		const strictCount = await getInputCountForMove(apiBase, rows, variant, false);
		if (strictCount > 0) return true;
	}

	for (const variant of variants) {
		const forcedCount = await getInputCountForMove(apiBase, rows, variant, true);
		if (forcedCount > 0) return true;
	}

	return false;
}

async function filterRoutesByReachability(apiBase, rows, routes, mode) {
	if (!routes.length) return { routes: [], failedChecks: 0, relaxed: false };
	if (mode == 'off') return { routes, failedChecks: 0, relaxed: false };

	const checks = await Promise.all(
		routes.map(async (route) => {
			try {
				const reachable = await isMoveReachable(apiBase, rows, route.moves?.[0], mode);
				return { route, reachable, failed: false };
			} catch (error) {
				return { route, reachable: false, failed: true };
			}
		})
	);

	let failedChecks = 0;
	const filtered = checks
		.filter((entry) => {
			if (entry.failed) failedChecks++;
			return entry.reachable;
		})
		.map((entry) => entry.route);

	if (mode == 'relaxed' && !filtered.length && routes.length) {
		return { routes, failedChecks, relaxed: true };
	}

	return { routes: filtered, failedChecks, relaxed: false };
}

function renderRoutesList() {
	const listEl = getEvalElement('evalRoutesList');
	if (!listEl) return;

	const routes = evalState.latestData?.routes || [];
	listEl.innerHTML = '';

	if (!routes.length) {
		listEl.textContent = 'No routes yet';
		evalState.selectedRouteKey = '';
		evalState.hoverRouteKey = '';
		return;
	}

	const preferredKey = preferredRouteKeyForMode(routes);
	if (preferredKey && evalState.selectedRouteKey != preferredKey) {
		evalState.selectedRouteKey = preferredKey;
	}

	if (!routes.some((r) => r.key == evalState.selectedRouteKey)) {
		evalState.selectedRouteKey = preferredKey || routes[0].key;
	}

	routes.forEach((route) => {
		const item = document.createElement('div');
		item.className = 'eval-route-item';
		item.title = 'Double-click to play this route';
		if (route.key == evalState.selectedRouteKey) {
			item.classList.add('eval-route-item--active');
		}
		const scoreText = `score ${formatEvalNumber(route.score)}`;
		const probText = typeof route.probability == 'number' ? `, p ${(route.probability * 100).toFixed(1)}%` : '';
		item.textContent = `${route.label} | ${scoreText}${probText}`;

		item.addEventListener('mouseenter', () => {
			evalState.hoverRouteKey = route.key;
			rebuildEvaluationOverlay();
		});

		item.addEventListener('mouseleave', () => {
			evalState.hoverRouteKey = '';
			rebuildEvaluationOverlay();
		});

		item.addEventListener('click', () => {
			setRouteFollowModeFromSelection(route.key);
			evalState.selectedRouteKey = preferredRouteKeyForMode(routes);
			evalState.hoverRouteKey = evalState.selectedRouteKey;
			renderRoutesList();
			rebuildEvaluationOverlay();
		});

		item.addEventListener('dblclick', () => {
			setRouteFollowModeFromSelection(route.key);
			evalState.selectedRouteKey = preferredRouteKeyForMode(routes);
			evalState.hoverRouteKey = evalState.selectedRouteKey;
			renderRoutesList();
			rebuildEvaluationOverlay();
			const selectedRoute = routes.find((r) => r.key == evalState.selectedRouteKey) || route;
			playRoute(selectedRoute);
		});

		listEl.appendChild(item);
	});
}

function simulateOverlayForRoute(routeMoves, baseRows) {
	let rows = baseRows.slice();
	const overlay = [];
	let visualClearLift = 0;

	routeMoves.forEach((moveObj, stepIndex) => {
		const cells = getMoveCells(moveObj);
		if (!cells.length) return;

		const legal = cells.every(
			(cell) => inRange(cell.x, 0, 9) && inRange(cell.y, 0, 39) && (rows[cell.y] & (1 << cell.x)) == 0
		);
		if (!legal) return;

		cells.forEach((cell) => {
			rows[cell.y] |= 1 << cell.x;
			overlay.push({
				x: cell.x,
				y: cell.y + visualClearLift,
				piece: cell.piece,
				step: stepIndex,
			});
		});

		const nextRows = [];
		for (let y = 0; y < 40; y++) {
			if (rows[y] !== 0x3ff) {
				nextRows.push(rows[y]);
			}
		}
		const clearedLines = 40 - nextRows.length;
		visualClearLift += clearedLines;

		while (nextRows.length < 40) {
			nextRows.push(0);
		}

		rows = nextRows;
	});

	return overlay;
}

function updateEvaluationText() {
	const scoreEl = getEvalElement('evalScores');
	const pvEl = getEvalElement('evalPv');
	if (!scoreEl || !pvEl) return;

	const data = evalState.latestData;
	if (!data || !data.routes?.length) {
		scoreEl.textContent = '';
		pvEl.textContent = '';
		return;
	}

	const selectedRoute = data.routes.find((r) => r.key == evalState.selectedRouteKey) || data.routes[0];
	const scoreLine = [
		`Best: ${formatEvalNumber(data.score)}`,
		`Selected: ${formatEvalNumber(selectedRoute.score)}`,
		`Hold used: ${selectedRoute.hold_used ? 'yes' : 'no'}`,
	];
	scoreEl.textContent = scoreLine.join('\n');

	const pvSummary = selectedRoute.moves
		.map((m) => {
			const p = enginePieceToChar[m.piece] || '?';
			return `${p}@x${m.x},y${m.y},r${m.rotation}`;
		})
		.join(' -> ');
	pvEl.textContent = pvSummary ? `Route: ${pvSummary}` : '';
}

function rebuildEvaluationOverlay() {
	const data = evalState.latestData;
	if (!data || !data.routes?.length) {
		evalState.overlayCells = [];
		updateEvaluationText();
		return;
	}

	const activeRouteKey = evalState.hoverRouteKey || evalState.selectedRouteKey;
	const selectedRoute = data.routes.find((r) => r.key == activeRouteKey) || data.routes[0];
	evalState.overlayCells = simulateOverlayForRoute(selectedRoute.moves, boardRowsForEngine());
	updateEvaluationText();
}

async function analyzeWithEngine(forceRefresh = false) {
	if (evalState.inFlight) return;

	const apiBaseInput = getEvalElement('evalApiBase');
	const apiBase = (apiBaseInput?.value || getDefaultEvalApiBase()).trim().replace(/\/$/, '');
	if (!apiBase) {
		setEvalStatus('Engine API address is empty.', true);
		return;
	}
	LS.evalApiBase = apiBase;

	const stateHash = getEvaluationStateHash();
	if (!forceRefresh && stateHash == evalState.lastAppliedHash) {
		return;
	}

	const rows = boardRowsForEngine();
	const pieceId = charToEnginePiece[piece];
	if (pieceId === undefined) {
		setEvalStatus('No active piece to analyze.', true);
		return;
	}

	evalState.inFlight = true;
	evalState.lastRequestAt = Date.now();
	setEvalStatus('Analyzing position...');

	try {
		const sentB2b = currentB2BForEngine();
		const sentCombo = currentComboForEngine();
		const sentPending = Math.floor(readNumberInput('evalPendingGarbage', 0, 0));
		const payload = {
			board_rows: rows,
			current_piece: pieceId,
			queue: queueForEngine(),
			hold: holdP ? charToEnginePiece[holdP] : null,
			b2b: sentB2b,
			combo: sentCombo,
			pending_garbage: sentPending,
			include_candidates: true,
			candidate_limit: 8,
			candidate_temperature: 1.0,
			search: getSearchOverridesFromUi(),
		};

		const res = await fetch(`${apiBase}/v1/find_best_move`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
			},
			body: JSON.stringify(payload),
		});

		if (!res.ok) {
			let msg = `HTTP ${res.status}`;
			try {
				const body = await res.json();
				if (body?.error) msg = body.error;
			} catch (error) {
				// noop
			}
			throw new Error(msg);
		}

		const data = await res.json();
		const rawRoutes = buildEvaluationRoutes(data);
		const filtered = await filterRoutesByReachability(apiBase, rows, rawRoutes, evalState.reachabilityMode);
		const finalRoutes = filtered.routes;

		evalState.latestData = {
			raw: data,
			routes: finalRoutes,
			score: data.score,
		};
		evalState.lastAppliedHash = stateHash;

		renderRoutesList();
		rebuildEvaluationOverlay();
		if (!finalRoutes.length) {
			setEvalStatus(
				`No reachable route (sent: b2b=${sentB2b}, combo=${sentCombo}, pending=${sentPending}).`,
				true
			);
		} else if (evalState.reachabilityMode == 'off') {
			setEvalStatus(
				`Evaluation updated (${finalRoutes.length} routes, reachability off, sent b2b=${sentB2b}, combo=${sentCombo}).`
			);
		} else if (filtered.relaxed) {
			setEvalStatus(
				`Evaluation updated (${finalRoutes.length} routes, relaxed, sent b2b=${sentB2b}, combo=${sentCombo}).`
			);
		} else if (filtered.failedChecks > 0) {
			setEvalStatus(
				`Evaluation updated (${finalRoutes.length} reachable, ${filtered.failedChecks} unchecked, sent b2b=${sentB2b}, combo=${sentCombo}).`
			);
		} else {
			setEvalStatus(
				`Evaluation updated (${finalRoutes.length} reachable, sent b2b=${sentB2b}, combo=${sentCombo}, pending=${sentPending}).`
			);
		}
	} catch (error) {
		evalState.overlayCells = [];
		setEvalStatus(`Evaluation failed: ${error.message}`, true);
	} finally {
		evalState.inFlight = false;
	}
}

function setEvaluationMode(enabled) {
	evalState.enabled = enabled;
	evalState.optionsHidden = enabled;
	if (!enabled) {
		evalState.overlayCells = [];
		evalState.hoverRouteKey = '';
		setEvalStatus('Evaluation is disabled.');
	}
	applyCompactOptionsVisibility();
	if (enabled) {
		analyzeWithEngine(true);
	}
}

function initEvaluationUi() {
	if (evalUiReady) return;

	const modeToggle = getEvalElement('evalModeToggle');
	const analyzeBtn = getEvalElement('evalAnalyzeBtn');
	const routeList = getEvalElement('evalRoutesList');
	const toggleOptionsBtn = getEvalElement('evalToggleOptionsBtn');
	const reachabilityBtn = getEvalElement('evalReachabilityBtn');
	const apiBaseInput = getEvalElement('evalApiBase');
	const inputRateEl = getEvalElement('evalInputRate');
	const comboInput = getEvalElement('evalCurrentCombo');
	const b2bInput = getEvalElement('evalCurrentB2b');
	if (!modeToggle || !analyzeBtn || !routeList || !toggleOptionsBtn || !apiBaseInput || !reachabilityBtn || !inputRateEl) {
		return;
	}

	if (LS.evalApiBase) {
		apiBaseInput.value = LS.evalApiBase;
	} else {
		apiBaseInput.value = getDefaultEvalApiBase();
	}

	if (LS.evalReachabilityMode && ['strict', 'relaxed', 'off'].includes(LS.evalReachabilityMode)) {
		evalState.reachabilityMode = LS.evalReachabilityMode;
	}

	if (LS.evalRouteFollowMode && ['pv', 'candidate1'].includes(LS.evalRouteFollowMode)) {
		evalState.routeFollowMode = LS.evalRouteFollowMode;
	}

	if (LS.evalPlaybackInputsPerSecond) {
		const v = parseFloat(LS.evalPlaybackInputsPerSecond);
		if (Number.isFinite(v) && v > 0) {
			evalState.playbackInputsPerSecond = v;
			inputRateEl.value = String(v);
		}
	}

	reachabilityBtn.textContent = getReachabilityButtonText();

	modeToggle.addEventListener('change', () => {
		setEvaluationMode(modeToggle.checked);
	});

	analyzeBtn.addEventListener('click', () => {
		analyzeWithEngine(true);
	});

	reachabilityBtn.addEventListener('click', () => {
		const modes = ['strict', 'relaxed', 'off'];
		const idx = modes.indexOf(evalState.reachabilityMode);
		evalState.reachabilityMode = modes[(idx + 1) % modes.length];
		LS.evalReachabilityMode = evalState.reachabilityMode;
		reachabilityBtn.textContent = getReachabilityButtonText();
		if (evalState.enabled) {
			analyzeWithEngine(true);
		}
	});

	inputRateEl.addEventListener('change', () => {
		const rate = getPlaybackInputRate();
		inputRateEl.value = String(rate);
		LS.evalPlaybackInputsPerSecond = String(rate);
	});

	if (comboInput) {
		comboInput.addEventListener('change', () => {
			applyEvalChainInputsToGame();
		});
	}

	if (b2bInput) {
		b2bInput.addEventListener('change', () => {
			applyEvalChainInputsToGame();
		});
	}

	toggleOptionsBtn.addEventListener('click', () => {
		evalState.optionsHidden = !evalState.optionsHidden;
		applyCompactOptionsVisibility();
	});

	applyCompactOptionsVisibility();
	syncEvalChainInputsFromGame();
	setEvalStatus('Evaluation is disabled.');
	evalUiReady = true;
}

function drawEvaluationOverlay() {
	if (!evalState.enabled || !evalState.overlayCells.length) return;

	for (const cell of evalState.overlayCells) {
		const boardRowIndex = boardSize[1] - 1 - cell.y;
		const drawY = boardRowIndex - hiddenRows + 2;
		if (!inRange(drawY, 0, boardSize[1])) continue;

		const fade = Math.pow(0.58, cell.step);
		const fillAlpha = Math.max(0.03, 0.34 * fade);
		const strokeAlpha = Math.max(0.08, 0.86 * fade);
		const pieceHex = color[cell.piece] || '#ffffff';
		ctx.fillStyle = hexToRgba(pieceHex, fillAlpha);
		ctx.fillRect(cell.x * cellSize + 1, drawY * cellSize + 1, cellSize - 2, cellSize - 2);

		ctx.strokeStyle = hexToRgba(pieceHex, strokeAlpha);
		ctx.lineWidth = 1.5;
		ctx.strokeRect(cell.x * cellSize + 2, drawY * cellSize + 2, cellSize - 4, cellSize - 4);
	}
}

function callback(gravity=700, special_restart=false, cheese=false) {
	// pieces = SRSX.pieces;
	// kicks = SRSX.kicks;
	kicks = kicksets['SRS+'];
    lastCol = Math.floor(Math.random() * 10);
	initEvaluationUi();

	keysDown = 0;
	lastKeys = 0;

	document.getElementById('tc-un').addEventListener('touchstart', function (e) {
		input = 'UNDO';
		keysDown |= flags[input];
		undo();
	});

	document.getElementById('tc-re').addEventListener('touchstart', function (e) {
		input = 'RE';
		keysDown |= flags[input];
		restart();
	});

	document.getElementById('tc-hd').addEventListener('touchstart', function (e) {
		input = 'HD';
		keysDown |= flags[input];
		hardDrop();
	});

	document.getElementById('tc-h').addEventListener('touchstart', function (e) {
		input = 'HL';
		keysDown |= flags[input];
		hold();
	});

	document.getElementById('tc-dr').addEventListener('touchstart', function (e) {
		input = 'R180';
		keysDown |= flags[input];
		rotate('R180');
	});

	document.getElementById('tc-cc').addEventListener('touchstart', function (e) {
		input = 'CCW';
		keysDown |= flags[input];
		rotate('CCW');
	});

	document.getElementById('tc-c').addEventListener('touchstart', function (e) {
		input = 'CW';
		keysDown |= flags[input];
		rotate('CW');
	});

	document.getElementById('tc-d').addEventListener('touchstart', function (e) {
		input = 'SD';
		keysDown |= flags[input];
		softDrop();
	});

	document.getElementById('tc-d').addEventListener('touchend', function (e) {
		input = 'SD';
		if (keysDown & flags[input]) keysDown ^= flags[input];
	});

	document.getElementById('tc-r').addEventListener('touchstart', function (e) {
		input = 'R';
		keysDown |= flags[input];
	});

	document.getElementById('tc-r').addEventListener('touchend', function (e) {
		input = 'R';
		if (keysDown & flags[input]) keysDown ^= flags[input];
		if (!(keysDown & flags.L) && !(keysDown & flags.R)) {
			dasID++;
		}
	});

	document.getElementById('tc-l').addEventListener('touchstart', function (e) {
		input = 'L';
		keysDown |= flags[input];
	});

	document.getElementById('tc-l').addEventListener('touchend', function (e) {
		input = 'L';
		if (keysDown & flags[input]) keysDown ^= flags[input];
		if (!(keysDown & flags.L) && !(keysDown & flags.R)) {
			dasID++;
		}
	});


	//* keyboard input
	document.addEventListener('keydown', e => {
		const input = ctrl[e.code];
		if (input) keysDown |= flags[input]; //* sets key in keysDown
		if (e.repeat) return; //* if held down, do nothing
		if (input) {
			switch (input) {  // handles non-movement keys
				case 'SD':
					softDrop();
					break;
				case 'HD':
					hardDrop();
					break;
				case 'HL':
					hold();
					break;
				case 'CW':
					rotate('CW');
					break;
				case 'CCW':
					rotate('CCW');
					break;
				case 'R180':
					rotate('R180');
					break;
				case 'RE':
					restart();
					break;
				case 'UNDO':
					undo();
					break;
				case 'REDO':
					redo();
					break;
			}
		}
	});

	document.addEventListener('keyup', function (e) {
		const input = ctrl[e.code];
		if (input) {
			if (keysDown & flags[input]) keysDown ^= flags[input];
			// remove key from keysDown
			if (!(keysDown & flags.L) && !(keysDown & flags.R)) {
				dasID++;
			}
		}
	});

	newPiece();
	hist = [
		{
			board: JSON.stringify(board),
			queue: JSON.stringify(queue),
			hold: holdP,
			piece: piece,
		},
	];
	histPos = 0;
	combo = -1;
    oldcombo = -1;
    oldb2b = 0;
	b2b = 0;
	syncEvalChainInputsFromGame();

    if (special_restart) {
        restart();
    }

	fullQuery = window.location.search;
	if (fullQuery.length > 0 && fullQuery[0] == '?') {
		queries = fullQuery.slice(1).split('&');
		for (let query of queries) {
			if (query.length > 0) {
				if (query.slice(0, 6) == 'fumen=') {
					// waow lazy handling
					fumen = query.slice(6);
					try {
						result = fullDecode(fumen, hist[0]);
						hist = JSON.parse(JSON.stringify(result));
						histPos = 0;
						board = JSON.parse(hist[0]['board']);
						queue = JSON.parse(hist[0]['queue']);
						holdP = hist[0]['hold'];
						piece = hist[0]['piece'];
						xPOS = spawn[0];
						yPOS = spawn[1];
						rot = 0;
						clearActive();
						updateGhost();
						setShape();
						updateQueue();
					} catch (error) {
						console.log(error);
					}
				}
				if (query.slice(0, 4) == 'pos=') {
					pos = parseInt(query.slice(4));
					if (!isNaN(pos) && hist.length > pos) {
						histPos = pos;
                        board = JSON.parse(hist[pos]['board']);
                        queue = JSON.parse(hist[pos]['queue']);
						holdP = hist[pos]['hold'];
						piece = hist[pos]['piece'];
						POS = spawn[0];
						yPOS = spawn[1];
						rot = 0;
						clearActive();
						updateGhost();
						setShape();
					}
				}
			}
		}
	}

	setInterval(() => { //* gravity
		if (document.getElementById('grav').checked) move('SD');
	}, gravity);

	function playSnd(sfx, overlap) {
		const s = sfxCache[sfx] ??= new Audio(`assets/sfx/${sfx}.wav`);
		if (overlap) {
			s.currentTime = 0
		}
		s.volume = audiolevel/100;
		s.play()
	}


	function move(dir) {
		switch (dir) {
			case 'L':
				if (canMove(pieces[piece][rot], xPOS - 1, yPOS)) {
					xPOS--;
					updateGhost();
					playSnd('Move');
					lastAction = 'L';
				}
				break;
			case 'R':
				if (canMove(pieces[piece][rot], xPOS + 1, yPOS)) {
					xPOS++;
					updateGhost();
					playSnd('Move');
					lastAction = 'R';
				}
				break;
			case 'SD':
				if (canMove(pieces[piece][rot], xPOS, yPOS + 1)) {
					yPOS++;
					lastAction = 'SD';
				}
				break;
		}
		clearActive();
		setShape();
	}

	function rotate(dir) {
		var newRot = (rot + rotDir[dir]) % 4;

		for (const kick of kicks[`${piece == 'I' ? 'I' : 'N'}${rot}-${newRot}`]) {
			if (canMove(pieces[piece][newRot], xPOS + kick[0], yPOS - kick[1])) {
				// Y is inverted lol
				xPOS += kick[0];
				yPOS -= kick[1];
				rot = newRot;
				playSnd('Rotate', true);
				lastAction = 'ROT';
				break;
			}
		}

		clearActive();
		updateGhost();
		setShape();
	}

	function arr(dir) {
		let loop = setInterval(function () {
			if (shiftDir == dir && keysDown & flags[dir]) {
				move(dir);
			} else {
				clearInterval(loop);
			}
		}, ARR);
	}

	function das(dir, id) {
		move(dir);
		setTimeout(() => {
			if (dasID == id) { //* check if das is still valid
				arr(dir, id);
			}
		}, DAS);
	}

	function softDrop() {
		if (SDR) {
			let loop = setInterval(() => {
				if (keysDown & flags.SD) {
					move('SD');
				} else {
					clearInterval(loop);
				}
			}, SDR);
		} else {
			// SDR is 0ms = instant SD
			let loop = setInterval(() => {
				if (keysDown & flags.SD) {
					yPOS = yGHO;
					clearActive();
					setShape();
				} else {
					clearInterval(loop);
				}
			}, 0);
			if (yPOS != yGHO) lastAction = 'SD';
		}
	}

	var shiftDir; //* which direction key is on top

	function checkShift() {
		// moving left/right with DAS and whatever

		if (keysDown & flags.L && !(lastKeys & flags.L)) {
			// just pressed left
			das('L', dasID);
			shiftDir = 'L';
		} else if (!(keysDown & flags.R) && lastKeys & flags.R && keysDown & flags.L) {
			// just released right and holding left
			if (shiftDir != 'L') das('L', dasID);
			shiftDir = 'L';
		}
		if (keysDown & flags.R && !(lastKeys & flags.R)) {
			// just pressed right
			das('R', dasID);
			shiftDir = 'R';
		} else if (!(keysDown & flags.L) && lastKeys & flags.L && keysDown & flags.R) {
			// just released left and holding right
			if (shiftDir != 'R') das('R', dasID);
			shiftDir = 'R';
		} 
		
		if (lastKeys !== keysDown) {
			lastKeys = keysDown;
		}
	}

	function hardDrop() {
		if (yPOS != yGHO) lastAction = 'HD';
		yPOS = yGHO;
		held = false;
		playSnd('HardDrop', true);
		setShape(true);
		clearActive();
		
		cleared = checkLines();
		newPiece();

        if (cheese) {
            if (cleared == 0) {
                curCol = Math.floor(Math.random() * 10);
                while (garbageHeight() < 10) {
                    while (curCol == lastCol) {
                        curCol = Math.floor(Math.random() * 10);
                    }
                    garbage(curCol);
                    lastCol = curCol;
                }
            } else if (garbageHeight() < 3) {
                while (curCol == lastCol) {
                    curCol = Math.floor(Math.random() * 10);
                }
                garbage(curCol);
                lastCol = curCol;
		    }
        }

		updateHistory();
	}

	function hold() {
		//if(held) return;
		rot = 0;
		xPOS = spawn[0];
		yPOS = spawn[1];
		held = true;
		if (holdP) {
			holdP = [piece, (piece = holdP)][0];
		} else {
			holdP = piece;
			if (queue[0] == '|') queue.shift();
			piece = queue.shift();
		}
		playSnd('Hold');
		clearActive();
		checkTopOut();
		updateGhost();
		setShape();
		updateQueue();
		lastAction = 'HOLD';
	}

	evalControlApi = {
		moveLeft: () => move('L'),
		moveRight: () => move('R'),
		dasLeft: () => {
			for (let i = 0; i < 10; i++) {
				const before = xPOS;
				move('L');
				if (xPOS == before) break;
			}
		},
		dasRight: () => {
			for (let i = 0; i < 10; i++) {
				const before = xPOS;
				move('R');
				if (xPOS == before) break;
			}
		},
		rotateCw: () => rotate('CW'),
		rotateCcw: () => rotate('CCW'),
		rotateFlip: () => rotate('R180'),
		softDrop: () => move('SD'),
		hardDrop: () => hardDrop(),
		hold: () => hold(),
	};

	function checkLines() {
		tspin = false;
		mini = false;
		allspinMini = false;
		pc = false;
		spinText = '';
		if (piece == 'T' && lastAction == 'ROT') {
			corners = [
				[yPOS + 1, xPOS],
				[yPOS + 1, xPOS + 2],
				[yPOS + 3, xPOS + 2],
				[yPOS + 3, xPOS],
			];
			facingCorners = [corners[rot], corners[(rot + 1) % 4]];

			filledCorners = 0;
			corners.forEach((corner) => {
				if (corner[0] >= 40 || corner[1] < 0 || corner[1] >= 10) filledCorners++;
				else if (board[corner[0]][corner[1]]['t'] == 1) filledCorners++;
			});
			tspin = filledCorners >= 3;

			if (tspin) {
				filledFacingCorners = 0;
				facingCorners.forEach((corner) => {
					if (corner[0] >= 40 || corner[1] < 0 || corner[1] >= 10) filledFacingCorners++;
					else if (board[corner[0]][corner[1]]['t'] == 1) filledFacingCorners++;
				});
				mini = filledFacingCorners < 2; // no I'm not adding the "TST Kick and Fin Kick" exceptions. STSDs and Fins deserve to be mini
			}
		}

		clearedIndexes = [];

		board = board.filter((r, i) => {
			temp = !r
				.map((c) => {
					return c.t == 1;
				})
				.every((v) => v);
			if (!temp) clearedIndexes.push(i);
			return temp;
		});
		var l = board.length;
		for (let i = 0; i < boardSize[1] - l; i++) {
			board.unshift(aRow());
		}
		var cleared = clearedIndexes.length;

		if (!tspin && piece != 'T' && lastAction == 'ROT' && cleared > 0) {
			mini = true;
			allspinMini = true;
		}

		if (tspin) {
			spinText = mini ? 'T-SPIN MINI' : 'T-SPIN';
		} else if (allspinMini) {
			spinText = `${piece}-SPIN MINI`;
		}

		if (board[board.length - 1].filter((c) => c.t == 0).length == boardSize[0]) pc = true;

		if (cleared == 0) 
        {    
            if(combo >= 1)
            {
              oldcombo = combo;
            }
            if(b2b >= 1)
            {
                oldb2b = b2b;
            }
            combo = -1;
            console.log("nothing cleared");
        }
		else {
            combo += 1;
			oldcombo = combo;
		}

		b2bEligible = cleared > 0 && (tspin || mini || cleared == 4);

		if (cleared > 0) 
        {
			if (b2bEligible) 
            {
                b2b += 1;
                oldb2b = b2b;
            }
			else if (pc)
			{
				b2b += 1;
				oldb2b = b2b;
			}
			else if (!pc)
            {
                console.log("no b2b");
				b2b = 0;
            }
		}

		text = '';
		if (combo > 0) text += combo.toString() + '_COMBO\n';
		if (b2b > 0 && b2bEligible) text += 'B2B ';
		if (spinText) text += `${spinText} `;
		if (cleared > 4) cleared = 4; // nani
		if (cleared > 0) text += ['NULL', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'][cleared];
		if (pc) text += '\nPERFECT\nCLEAR!';
		if (b2b > 0 && b2bEligible) text += ' x' + b2b.toString();
		if (text != '') notify(text);
		if (b2bEligible) playSnd('ClearTetra', true);
		if (pc) playSnd('PerfectClear', 1);
		syncEvalChainInputsFromGame();

        return cleared;

	}

	function drawCell(x, y, piece, type) {
		if (type == 3) {
			// Ghost
			ctx.strokeStyle = '#CCC';
			ctx.strokeRect((x - 1) * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
		} else if (type !== 0) {
			// Current and Heap
			ctx.fillStyle = color[piece];
			ctx.fillRect((x - 1) * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
		}
	}

	function render() {
		checkShift();

		if (evalState.enabled) {
			const now = Date.now();
			if (!evalState.inFlight && now - evalState.lastRequestAt > 500) {
				analyzeWithEngine(false);
			}
		}

		ctx.clearRect(0, 0, boardSize[0] * cellSize, boardSize[1] * cellSize);
		ctx.fillStyle = pattern;
		ctx.fillRect(0, 0, boardSize[0] * cellSize, boardSize[1] * cellSize);
		drawEvaluationOverlay();

		board.map((y, i) => {
			y.map((x, ii) => {
				if (x.t !== 0) {
					drawCell(ii + 1, i - hiddenRows + 2, x.c, x.t);
				} else if (i <= spawn[1] + 2) {
					// render the top 2 rows as grey
					drawCell(ii + 1, i - hiddenRows + 2, 'A', 1);
				}
			});
		});
		window.requestAnimationFrame(render);
	}
	/*
	setInterval(() => {
		render();
	}, 0);
    */
	window.requestAnimationFrame(render);
}
