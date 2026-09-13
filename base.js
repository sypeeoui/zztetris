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
Made by sypeeoui and forked from zztetris to add analizer features with different open source engines.
---
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

const spawn = [3, hiddenRows - 2];
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
var lastKick = 0;
var lastRotationType = 0; // 90 or 180
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
const engineToFrontendOffset = {
	I: { x: -1, y: -1 },
	O: { x: -1, y: -1 },
	T: { x: -1, y: -2 },
	S: { x: -1, y: -2 },
	Z: { x: -1, y: -2 },
	J: { x: -1, y: -2 },
	L: { x: -1, y: -2 },
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
var evalConfigLoadPromise = null;
var evalServerConfig = {
	fusionApiBase: 'http://127.0.0.1:8787',
	falconApiBase: 'http://127.0.0.1:8888',
};
var evalServerDefaultApiBase = '';
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
	reachabilityMode: 'off',
	playbackInputsPerSecond: 2,
	latestData: null,
	overlayCells: [],
	pcSetupPlan: null,
};
var evalControlApi = null;

const wasmHelper = {
	worker: null,
	initPromise: null,
	pendingRequest: null,
	currentRequestId: 0,

	getBaseUrl() {
		return window.location.origin + window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/')) + '/';
	},

	async ensureWorker() {
		if (this.worker) return;
		this.worker = new Worker('./engineWorker.js?v=6');
		this.worker.onmessage = (e) => {
			const { type, result, error, requestId } = e.data;
			if (type === 'result' || type === 'error') {
				if (this.pendingRequest && this.pendingRequest.id === requestId) {
					if (type === 'error') this.pendingRequest.reject(new Error(error));
					else this.pendingRequest.resolve(result);
					this.pendingRequest = null;
				}
			}
		};
	},

	async initEngine(engineType) {
		await this.ensureWorker();
		return new Promise((resolve, reject) => {
			const handler = (e) => {
				if (e.data.type === 'init_ok' && e.data.engineType === engineType) {
					this.worker.removeEventListener('message', handler);
					resolve();
				} else if (e.data.type === 'error' && !e.data.requestId) {
					// Only handle global/init errors here
					this.worker.removeEventListener('message', handler);
					reject(new Error(e.data.error));
				}
			};
			this.worker.addEventListener('message', handler);
			this.worker.postMessage({
				type: 'init',
				engineType,
				payload: { baseUrl: this.getBaseUrl() }
			});
		});
	},

	async findBestMove(engineType, payload) {
		await this.initEngine(engineType === 'cold-clear' ? 'coldClear' : engineType);
		
		const requestId = ++this.currentRequestId;
		if (this.pendingRequest) {
			this.pendingRequest.reject(new Error('Aborted by new request'));
		}
		
		return new Promise((resolve, reject) => {
			this.pendingRequest = { resolve, reject, id: requestId };
			this.worker.postMessage({
				type: 'find_best_move',
				engineType: engineType === 'cold-clear' ? 'coldClear' : engineType,
				payload,
				requestId
			});
		});
	}
};
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
document.getElementById('n').addEventListener('click', () => openPieceEditor('queue'));

// hold
document.getElementById('h').addEventListener('click', () => openPieceEditor('hold'));

var pieceEditorEl = null;

function ensurePieceEditor() {
	if (pieceEditorEl) return pieceEditorEl;

	const overlay = document.createElement('div');
	overlay.className = 'piece-editor-overlay';
	overlay.style.display = 'none';
	overlay.innerHTML = `
		<div class="piece-editor">
			<h3 class="piece-editor-title"></h3>
			<input type="text" class="piece-editor-input" autocomplete="off" spellcheck="false" />
			<div class="piece-editor-hint"></div>
			<div class="piece-editor-pieces"></div>
			<div class="piece-editor-actions">
				<button type="button" class="button piece-editor-apply">Apply</button>
				<button type="button" class="button piece-editor-clear">Clear</button>
				<button type="button" class="button piece-editor-cancel">Cancel</button>
			</div>
		</div>`;
	document.body.appendChild(overlay);

	const piecesEl = overlay.querySelector('.piece-editor-pieces');
	['I', 'J', 'L', 'O', 'S', 'T', 'Z'].forEach((p) => {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'piece-editor-piece';
		btn.textContent = p;
		btn.dataset.piece = p;
		btn.style.color = color[p] || '#fff';
		piecesEl.appendChild(btn);
	});

	overlay.addEventListener('mousedown', (e) => {
		if (e.target === overlay) closePieceEditor();
	});

	pieceEditorEl = overlay;
	return overlay;
}

function closePieceEditor() {
	if (pieceEditorEl) pieceEditorEl.style.display = 'none';
}

function openPieceEditor(kind) {
	const overlay = ensurePieceEditor();
	const input = overlay.querySelector('.piece-editor-input');
	const title = overlay.querySelector('.piece-editor-title');
	const hint = overlay.querySelector('.piece-editor-hint');
	const isHold = kind === 'hold';

	overlay.dataset.kind = kind;
	title.textContent = isHold ? 'Edit Hold' : 'Edit Queue';
	hint.textContent = isHold
		? 'Enter a single piece (or leave empty).'
		: 'Pieces I J L O S T Z; use | to mark bag boundaries.';
	input.value = isHold ? holdP || '' : (piece || '') + queue.join('');
	overlay.style.display = 'flex';

	input.onkeydown = (e) => {
		if (e.key == 'Enter') {
			e.preventDefault();
			applyPieceEditor();
		} else if (e.key == 'Escape') {
			e.preventDefault();
			closePieceEditor();
		}
	};

	overlay.querySelector('.piece-editor-apply').onclick = applyPieceEditor;
	overlay.querySelector('.piece-editor-clear').onclick = () => {
		input.value = '';
		input.focus();
	};
	overlay.querySelector('.piece-editor-cancel').onclick = closePieceEditor;
	overlay.querySelectorAll('.piece-editor-piece').forEach((btn) => {
		btn.onclick = () => {
			if (isHold) input.value = btn.dataset.piece;
			else input.value += btn.dataset.piece;
			input.focus();
		};
	});

	setTimeout(() => input.focus(), 0);
}

function applyPieceEditor() {
	if (!pieceEditorEl) return;
	const kind = pieceEditorEl.dataset.kind;
	const raw = (pieceEditorEl.querySelector('.piece-editor-input').value || '').toUpperCase();

	if (kind == 'hold') {
		const ch = raw.split('').find((c) => 'SZLJIOT'.includes(c));
		holdP = ch || '';
		updateQueue();
	} else {
		const cleaned = raw.split('').filter((ch) => 'SZLJIOT|'.includes(ch));
		const hasPiece = cleaned.some((ch) => ch != '|');
		if (hasPiece) {
			queue = cleaned;
			newPiece();
		}
		updateHistory();
	}
	closePieceEditor();
}

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

function isImmobile(p, x, y) {
	var currentP = pieces[piece][rot];
	function isBlocked(nx, ny) {
		for (let r = 0; r < 4; r++) {
			for (let c = 0; c < 4; c++) {
				if (p[r][c] == 1) {
					var tx = nx + c;
					var ty = ny + r;
					if (tx < 0 || tx >= 10 || ty < 0 || ty >= 40) return true;
					if (board[ty] && board[ty][tx] && board[ty][tx].t == 1) {
						var isSelf =
							tx >= x &&
							tx < x + 4 &&
							ty >= y &&
							ty < y + 4 &&
							currentP[ty - y][tx - x] == 1;
						if (!isSelf) return true;
					}
				}
			}
		}
		return false;
	}
	return isBlocked(x, y - 1) && isBlocked(x - 1, y) && isBlocked(x + 1, y);
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
	const overrides = getSearchOverridesFromUi();
	const sentB2b = currentB2BForEngine();
	const sentCombo = currentComboForEngine();
	const sentPending = Math.floor(readNumberInput('evalPendingGarbage', 0, 0));

	return JSON.stringify({
		rows,
		piece,
		holdP,
		queue: queueIds,
		b2b: sentB2b,
		combo: sentCombo,
		pending: sentPending,
		overrides,
	});
}

function getEvalElement(id) {
	return document.getElementById(id);
}

function normalizeEvalApiBase(rawValue) {
	return (rawValue || '').trim().replace(/\/+$/, '');
}

function applyConfiguredEvalApiBaseToInput() {
	const apiBaseInput = getEvalElement('evalApiBase');
	if (!apiBaseInput || LS.evalApiBase) return;

	const originDefault = normalizeEvalApiBase(window.location?.origin || '');
	const currentValue = normalizeEvalApiBase(apiBaseInput.value);
	if (!currentValue || currentValue == originDefault) {
		apiBaseInput.value = getDefaultEvalApiBase();
	}
}

function loadEvalServerConfig() {
	if (evalConfigLoadPromise) return evalConfigLoadPromise;

	evalConfigLoadPromise = fetch('./engine.config.json', {
		cache: 'no-store',
	})
		.then((res) => {
			if (!res.ok) return null;
			return res.json();
		})
		.then((config) => {
			if (!config || typeof config != 'object') return;

			if (config.fusionApiBase) evalServerConfig.fusionApiBase = normalizeEvalApiBase(config.fusionApiBase);
			if (config.falconApiBase) evalServerConfig.falconApiBase = normalizeEvalApiBase(config.falconApiBase);

			const configuredApiBase = normalizeEvalApiBase(
				config.engineApiBase || config.defaultEngineUrl || config.evalApiBase
			);
			if (configuredApiBase) {
				evalServerDefaultApiBase = configuredApiBase;
				applyConfiguredEvalApiBaseToInput();
			}
		})
		.catch(() => {
			// Config file is optional; fallback will be used.
		});

	return evalConfigLoadPromise;
}

function getDefaultEvalApiBase() {
	const engineType = getEvalElement('evalEngineType')?.value || 'fusion';
	if (engineType === 'falcon' && evalServerConfig.falconApiBase) {
		return evalServerConfig.falconApiBase;
	}
	if (engineType === 'fusion' && evalServerConfig.fusionApiBase) {
		return evalServerConfig.fusionApiBase;
	}

	if (evalServerDefaultApiBase) {
		return evalServerDefaultApiBase;
	}

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
	const engineType = getEvalElement('evalEngineType')?.value || 'fusion';
	if (engineType === 'cold-clear') {
		return {
			nodes: Math.floor(readNumberInput('coldClearNodes', 500, 1)),
		};
	}
	if (engineType === 'falcon') {
		return {
			depth: Math.floor(readNumberInput('evalDepth', 10, 1)),
			beam_width: Math.floor(readNumberInput('evalBeamWidth', 2000, 1)),
			weights: {
				height: Math.floor(readNumberInput('falconWeight_height', -50)),
				upper_half_height: Math.floor(readNumberInput('falconWeight_upper_half_height', -150)),
				upper_quarter_height: Math.floor(readNumberInput('falconWeight_upper_quarter_height', -300)),
				center_height: Math.floor(readNumberInput('falconWeight_center_height', -100)),
				extra_wells: Math.floor(readNumberInput('falconWeight_extra_wells', -100)),
				clear_none: Math.floor(readNumberInput('falconWeight_clear_none', -70)),
				clear_mini: Math.floor(readNumberInput('falconWeight_clear_mini', 70)),
				clear_normal: Math.floor(readNumberInput('falconWeight_clear_normal', 140)),
				sent: Math.floor(readNumberInput('falconWeight_sent', 0)),
				b2b: Math.floor(readNumberInput('falconWeight_b2b', 80)),
				combo: Math.floor(readNumberInput('falconWeight_combo', 30)),
				holes: Math.floor(readNumberInput('falconWeight_holes', -15)),
				covered_holes: Math.floor(readNumberInput('falconWeight_covered_holes', -60)),
				overstacked_holes: Math.floor(readNumberInput('falconWeight_overstacked_holes', -40)),
				unevenness: Math.floor(readNumberInput('falconWeight_unevenness', -30)),
			},
		};
	}
	return {
		beam_width: Math.floor(readNumberInput('evalBeamWidth', 800, 1)),
		depth: Math.floor(readNumberInput('evalDepth', 14, 1)),
		futility_delta: readNumberInput('evalFutilityDelta', 15.0, 0),
		time_budget_ms: Math.floor(readNumberInput('evalTimeBudgetMs', 50, 1)),
		use_tt: !!getEvalElement('evalUseTt')?.checked,
		extend_queue_7bag: !!getEvalElement('evalExtendQueue')?.checked,
		attack_weight: readNumberInput('evalAttackWeight', 0.5, 0),
		chain_weight: readNumberInput('evalChainWeight', 1.0, 0),
		context_weight: readNumberInput('evalContextWeight', 0.25, 0),
		b2b_weight: readNumberInput('evalB2bWeight', 1.0, 0),
		downstack_weight: readNumberInput('evalDownstackWeight', 0.20, 0),
		downstack_avg_height_weight: readNumberInput('evalDownstackAvgHeightWeight', 0.0),
		downstack_min_height_weight: readNumberInput('evalDownstackMinHeightWeight', -5.0),
		path_decay: readNumberInput('evalPathDecay', 1.0, 0),
		pc_mode: !!getEvalElement('evalPcMode')?.checked,
		spin_full_weight: readNumberInput('evalSpinFullWeight', 8.0, 0),
		spin_mini_weight: readNumberInput('evalSpinMiniWeight', 2.0, 0),
		board_weight: readNumberInput('evalBoardWeight', 1.0, 0),
		quiescence_max_extensions: Math.floor(readNumberInput('evalQMaxExtensions', 3, 0)),
		quiescence_beam_fraction: readNumberInput('evalQBeamFraction', 0.15, 0),
		pc_garbage: Math.floor(readNumberInput('evalPcGarbage', 5, 0)),
		pc_b2b: Math.floor(readNumberInput('evalPcB2b', 2, 0)),
		b2b_chaining: !!getEvalElement('evalB2bChaining')?.checked,
		b2b_bonus: Math.floor(readNumberInput('evalB2bBonus', 1, 0)),
		base_attack: getEvalElement('evalBaseAttack')?.value || "0,0,1,2,4",
		mini_spin_attack: getEvalElement('evalMiniSpinAttack')?.value || "0,0,1,2,10",
		spin_attack: getEvalElement('evalSpinAttack')?.value || "0,2,4,6,10",
		combo_table: parseInt(getEvalElement('evalComboTable')?.value || "0"),
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
			input_sequence: data.input_sequence,
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
				input_sequence: candidate.input_sequence,
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

function isPcModeEnabled() {
	return !!getEvalElement('evalPcMode')?.checked;
}

function currentBoardHeight() {
	for (let i = 0; i < boardSize[1]; i++) {
		if (board[i].some((cell) => cell.t == 1)) {
			return boardSize[1] - i;
		}
	}
	return 0;
}

var pcSetupData = null;
var pcSetupDataPromise = null;

function loadPcSetupData() {
	if (pcSetupData) return Promise.resolve(pcSetupData);
	if (pcSetupDataPromise) return pcSetupDataPromise;

	pcSetupDataPromise = fetch('./pc_setups.json', { cache: 'no-store' })
		.then((res) => (res.ok ? res.json() : null))
		.then((data) => {
			pcSetupData = data || {};
			return pcSetupData;
		})
		.catch(() => {
			pcSetupData = {};
			return pcSetupData;
		});

	return pcSetupDataPromise;
}

function currentBagPieces() {
	// Remaining pieces in the current bag, active piece first. Bag separators
	// ('|') delimit the current bag in the queue.
	const bag = [];
	if (piece) bag.push(piece);
	for (let i = 0; i < queue.length; i++) {
		if (queue[i] == '|') break;
		bag.push(queue[i]);
	}
	return bag;
}

function pcSetupCountForBag(bagPieces) {
	// The best-chance-field tables are indexed by the PC number in a PC loop,
	// not by raw pieces left in the bag. zztetris's PC(n) helper (zztetris.js)
	// builds the current bag for the nth PC with (10 - 3n) % 7 pieces, so the
	// inverse is n = (2 * available) % 7 + 1. `available` counts the current
	// bag plus the held piece, since a carried-over hold is part of the same
	// window the tables were generated for (e.g. 3 in bag + 1 hold == PC 2).
	const available = Math.max(1, Math.min(7, bagPieces.length + (holdP ? 1 : 0)));
	return (2 * available) % 7 + 1;
}

function setupBoardToCells(boardStr) {
	// boardStr is 4 rows x 10 cols, row 0 is the top row. Engine y=0 is the
	// bottom, so the top row maps to y=3.
	const cells = [];
	if (!boardStr) return cells;
	for (let r = 0; r < 4; r++) {
		for (let c = 0; c < 10; c++) {
			const ch = boardStr[r * 10 + c];
			if (!ch || ch == '_') continue;
			cells.push({ x: c, y: 3 - r, piece: ch });
		}
	}
	return cells;
}

function partitionPieceCells(pieceChar, cells) {
	// Exact-cover the cells with copies of the given tetromino. A letter may
	// appear several times (e.g. "IIII"), and pieces can interlock, so a greedy
	// peel is not enough; backtrack on the first uncovered cell.
	const base = pieceBaseCoords[pieceChar];
	if (!base) return null;
	if (cells.length == 0) return [];
	if (cells.length % base.length != 0) return null;

	const first = cells[0];
	for (let rotation = 0; rotation < 4; rotation++) {
		const rotated = base.map(([x, y]) => rotateCoordForEngine(rotation, x, y));
		for (const rc of rotated) {
			const dx = first.x - rc.x;
			const dy = first.y - rc.y;
			const matched = [];
			let ok = true;
			for (const rcell of rotated) {
				const cell = cells.find(
					(c) => c.x == rcell.x + dx && c.y == rcell.y + dy && !matched.includes(c)
				);
				if (!cell) {
					ok = false;
					break;
				}
				matched.push(cell);
			}
			if (!ok) continue;

			const remaining = cells.filter((c) => !matched.includes(c));
			const rest = partitionPieceCells(pieceChar, remaining);
			if (rest) {
				return [
					{ move: { piece: charToEnginePiece[pieceChar], rotation, x: dx, y: dy }, cells: matched },
					...rest,
				];
			}
		}
	}
	return null;
}

function setupBoardToMoves(boardStr) {
	const pools = {};
	for (const cell of setupBoardToCells(boardStr)) {
		(pools[cell.piece] = pools[cell.piece] || []).push(cell);
	}

	const moves = [];
	for (const ch of Object.keys(pools)) {
		const parts = partitionPieceCells(ch, pools[ch]);
		if (!parts) return [];
		for (const part of parts) moves.push(part.move);
	}
	// Place bottom rows first so the overlay simulation never floats a piece.
	moves.sort((a, b) => a.y - b.y || a.x - b.x);
	return moves;
}

function pcSetupPlacementOrderFromMoves(moves, queuePieces, allowHold, holdPiece) {
	// A setup field is only useful if its 4 pieces can actually be placed in
	// an order the queue allows. Model one hold slot and gravity: a piece can
	// be dropped into its final cells only when they are free and the piece is
	// supported from below.
	//
	// Returns the order in which the moves (indices into `moves`) can be
	// played with the given queue, or null if the setup is not buildable. The
	// order is what the overlay must follow so the highlighted piece is the
	// one the player can actually place next.
	//
	// `holdPiece` seeds the hold slot with the piece already sitting there, so
	// a setup that needs the held piece first is accepted (the user just presses
	// hold). It is a piece character or null/undefined.
	if (!Array.isArray(moves) || moves.length !== 4) return null;

	const targets = moves.map((mv) => ({
		piece: enginePieceToChar[mv.piece],
		cells: getMoveCells(mv),
	}));
	const targetKeys = targets.map((t) => t.cells.map((c) => c.y * 10 + c.x));
	const fullMask = (1 << targets.length) - 1;

	const occupiedForMask = (mask) => {
		const occ = new Set();
		for (let i = 0; i < targets.length; i++) {
			if (mask & (1 << i)) {
				for (const k of targetKeys[i]) occ.add(k);
			}
		}
		return occ;
	};

	const canPlace = (target, occ) => {
		for (const c of target.cells) {
			if (occ.has(c.y * 10 + c.x)) return false;
		}
		for (const c of target.cells) {
			if (c.y === 0 || occ.has((c.y - 1) * 10 + c.x)) return true;
		}
		return false;
	};

	const seen = new Set();
	const stack = [{ queue: queuePieces.slice(), hold: holdPiece || null, mask: 0, order: [] }];
	while (stack.length) {
		const st = stack.pop();
		const key = st.queue.join('') + '|' + (st.hold || '_') + '|' + st.mask;
		if (seen.has(key)) continue;
		seen.add(key);
		if (st.mask === fullMask) return st.order;

		const occ = occupiedForMask(st.mask);
		const current = st.queue.length ? st.queue[0] : null;

		// Push the hold swap first so direct placements (pushed after, and
		// therefore popped first) are preferred; holding is only used when the
		// setup genuinely needs it.
		if (allowHold && current) {
			const nq = st.queue.slice(1);
			const nh = current;
			if (st.hold != null) nq.unshift(st.hold);
			stack.push({ queue: nq, hold: nh, mask: st.mask, order: st.order });
		}

		if (current) {
			for (let i = targets.length - 1; i >= 0; i--) {
				if ((st.mask & (1 << i)) === 0 && targets[i].piece === current && canPlace(targets[i], occ)) {
					stack.push({
						queue: st.queue.slice(1),
						hold: st.hold,
						mask: st.mask | (1 << i),
						order: st.order.concat(i),
					});
				}
			}
		}
	}
	return null;
}

function pcSetupIsBuildableFromMoves(moves, queuePieces, allowHold, holdPiece) {
	return pcSetupPlacementOrderFromMoves(moves, queuePieces, allowHold, holdPiece) !== null;
}

function pcSetupIsBuildable(boardStr, queuePieces, allowHold, holdPiece) {
	return pcSetupIsBuildableFromMoves(setupBoardToMoves(boardStr), queuePieces, allowHold, holdPiece);
}

function buildPcSetupRoutes(pcCount) {
	const pcSet = (pcSetupData || {})[String(pcCount)] || {};
	const bagPieces = currentBagPieces();

	// The first five available pieces (active piece first), crossing into the
	// next bag if the current bag is short.
	const available = [];
	if (piece) available.push(piece);
	for (const p of queue) {
		if (p == '|') continue;
		available.push(p);
		if (available.length >= 5) break;
	}
	const firstFive = available.slice(0, 5);

	// The held piece is available too, so a setup may use it instead of one of
	// the five upcoming pieces. Enumerate 4-subsets of the full pool.
	const pool = holdP ? [holdP, ...firstFive] : firstFive;
	const combos = new Set();
	for (let a = 0; a < pool.length; a++) {
		for (let b = a + 1; b < pool.length; b++) {
			for (let c = b + 1; c < pool.length; c++) {
				for (let d = c + 1; d < pool.length; d++) {
					combos.add([pool[a], pool[b], pool[c], pool[d]].sort().join(''));
				}
			}
		}
	}

	const routes = [];
	let idx = 0;
	for (const combo of combos) {
		const setups = pcSet[combo];
		if (!Array.isArray(setups)) continue;
		for (const setup of setups) {
			const moves = setupBoardToMoves(setup.board || '');
			if (!moves.length) continue;
			const order = pcSetupPlacementOrderFromMoves(moves, firstFive, true, holdP);
			if (!order) continue;
			const prob = parseFloat(String(setup.prob || '').replace('%', '').trim());
			routes.push({
				key: `pc_setup_${idx++}`,
				label: `PC ${combo}${Number.isFinite(prob) ? ` ${prob.toFixed(1)}%` : ''}`,
				moves,
				// Playable order (indices into `moves`) so the overlay can show
				// the piece the queue actually allows next.
				orderedMoves: order.map((i) => moves[i]),
				score: Number.isFinite(prob) ? prob : 0,
				probability: Number.isFinite(prob) ? prob / 100 : null,
				hold_used: false,
				setup: { combo, board: setup.board, prob },
			});
		}
	}

	routes.sort((a, b) => b.score - a.score);
	return { routes: routes.slice(0, 12), bagPieces, pcCount, firstFive };
}

function consumeQueuePieces(usedPieces) {
	const seq = [];
	if (piece) seq.push(piece);
	for (const p of queue) seq.push(p);

	for (const p of usedPieces) {
		const i = seq.indexOf(p);
		if (i >= 0) seq.splice(i, 1);
	}

	while (seq.length < 10) {
		const shuf = names.shuffle();
		for (const p of shuf) seq.push(p);
		seq.push('|');
	}
	if (seq[0] == '|') seq.shift();
	piece = seq.shift();
	queue = seq;
}

function applyPcSetup(route) {
	if (!route || !route.setup) return false;
	const cells = setupBoardToCells(route.setup.board);
	if (!cells.length) return false;

	for (let i = 0; i < boardSize[1]; i++) {
		for (let x = 0; x < boardSize[0]; x++) {
			board[i][x] = { t: 0, c: '' };
		}
	}
	for (const cell of cells) {
		const row = boardSize[1] - 1 - cell.y;
		if (row < 0 || row >= boardSize[1]) continue;
		board[row][cell.x] = { t: 1, c: cell.piece };
	}

	consumeQueuePieces(route.setup.combo.split(''));
	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	clearActive();
	checkTopOut();
	updateGhost();
	setShape();
	updateQueue();
	updateHistory();

	setEvalStatus(`Applied PC setup ${route.setup.combo}.`);
	if (evalState.enabled) analyzeWithEngine(true);
	return true;
}

function boardRowsEqual(a, b) {
	for (let y = 0; y < 40; y++) {
		if (a[y] !== b[y]) return false;
	}
	return true;
}

// Simulate the setup in the order the queue allows, including gravity and line
// clears, starting from the board the plan was armed on. Returns whether the
// live board still matches some point of the route, and the overlay for the
// moves still to come (the next one is `step: 0`).
function simulatePcSetupPlan(plan) {
	const ordered = plan.orderedMoves || plan.moves;
	if (!Array.isArray(ordered) || !ordered.length) {
		return { matched: false, overlay: [] };
	}

	const start = plan.startRows || boardRowsForEngine();
	const current = boardRowsForEngine();
	let rows = start.slice();
	let visualClearLift = 0;
	let matchedStep = boardRowsEqual(rows, current) ? 0 : -1;
	const stepCells = [];

	for (const move of ordered) {
		const cells = getMoveCells(move);
		if (!cells.length) continue;
		if (!cells.every((cell) => (rows[cell.y] & (1 << cell.x)) === 0)) break;

		const placed = [];
		for (const cell of cells) {
			rows[cell.y] |= 1 << cell.x;
			// Draw at the pre-clear position so the overlay lines up with the
			// board, which is not visually cleared while the route is followed.
			placed.push({ x: cell.x, y: cell.y + visualClearLift, piece: cell.piece });
		}
		stepCells.push(placed);

		const nextRows = [];
		for (let y = 0; y < 40; y++) {
			if (rows[y] !== 0x3ff) nextRows.push(rows[y]);
		}
		visualClearLift += 40 - nextRows.length;
		while (nextRows.length < 40) nextRows.push(0);
		rows = nextRows;

		if (boardRowsEqual(rows, current)) matchedStep = stepCells.length;
	}

	if (matchedStep < 0) return { matched: false, overlay: [] };

	const overlay = [];
	for (let s = matchedStep; s < stepCells.length; s++) {
		for (const cell of stepCells[s]) {
			overlay.push({ ...cell, step: s - matchedStep });
		}
	}
	return { matched: true, overlay };
}

function pcSetupPlanMatchesBoard(plan) {
	if (!plan || !plan.cells || !plan.cells.length) return false;
	return simulatePcSetupPlan(plan).matched;
}

function computePcSetupPlanOverlay(plan) {
	return simulatePcSetupPlan(plan).overlay;
}

function armPcSetupPlan(route) {
	if (!route || !route.setup) return;
	const cells = setupBoardToCells(route.setup.board);
	if (!cells.length) return;
	evalState.pcSetupPlan = {
		combo: route.setup.combo,
		board: route.setup.board,
		cells,
		moves: route.moves,
		orderedMoves: route.orderedMoves || route.moves,
		startRows: boardRowsForEngine(),
	};
}

function clearPcSetupPlan() {
	evalState.pcSetupPlan = null;
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

function engineInputName(code) {
	switch (code) {
		case 0:
			return 'NoInput';
		case 1:
			return 'ShiftRight';
		case 2:
			return 'ShiftLeft';
		case 3:
			return 'DasRight';
		case 4:
			return 'DasLeft';
		case 5:
			return 'RotateCw';
		case 6:
			return 'RotateCcw';
		case 7:
			return 'RotateFlip';
		case 8:
			return 'SoftDrop';
		case 9:
			return 'HardDrop';
		default:
			return `Unknown(${code})`;
	}
}

function analyzeInputSequenceHeuristics(inputs) {
	const arr = Array.isArray(inputs) ? inputs : [];
	const rotationCodes = new Set([5, 6, 7]);
	const shiftCodes = new Set([1, 2, 3, 4]);
	const softDropCode = 8;

	let rotationCount = 0;
	let shiftCount = 0;
	let softDropCount = 0;

	for (const code of arr) {
		if (rotationCodes.has(code)) rotationCount++;
		if (shiftCodes.has(code)) shiftCount++;
		if (code == softDropCode) softDropCount++;
	}

	const suspiciousNoShiftRotationHeavy = shiftCount == 0 && rotationCount >= 4;
	const suspiciousSoftDropThenRotationSpam = softDropCount >= 2 && rotationCount >= 5;

	return {
		length: arr.length,
		rotation_count: rotationCount,
		shift_count: shiftCount,
		softdrop_count: softDropCount,
		suspicious_no_shift_rotation_heavy: suspiciousNoShiftRotationHeavy,
		suspicious_softdrop_then_rotation_spam: suspiciousSoftDropThenRotationSpam,
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
			use_finesse: true,
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
	const useWasm = !!getEvalElement('evalUseWasm')?.checked;
	if (useWasm) {
		// WASM engine results usually have input_sequence attached to the route.
		// If we are here, it means we don't have it.
		// For Fusion WASM, we might need to expose pathfinder if it's critical.
		return [];
	}

	const res = await fetch(`${apiBase}/v1/get_input_sequence`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			board_rows: rows,
			mv: moveToInputRequest(moveObj),
			use_finesse: true,
			force,
		}),
	});

	if (!res.ok) return [];
	const data = await res.json();
	return Array.isArray(data.inputs) ? data.inputs : [];
}

async function isMoveInEngineMovegen(apiBase, rows, pieceId, moveObj) {
	if (pieceId === undefined || pieceId === null || !moveObj) return null;

	const useWasm = !!getEvalElement('evalUseWasm')?.checked;
	const engineType = getEvalElement('evalEngineType')?.value || 'fusion';

	try {
		let moves = [];
		if (useWasm) {
			if (engineType === 'fusion' && wasmHelper.fusion.ready) {
				const { JsBoard, get_all_moves } = wasmHelper.fusion.module;
				const board = JsBoard.from_rows(new BigUint64Array(rows.map(BigInt)));
				moves = get_all_moves(board, pieceId) || [];
			} else if (engineType === 'falcon') {
				// Falcon currently doesn't expose get_all_moves in WASM, 
				// assume it's valid if found by search
				return true;
			}
		} else {
			const res = await fetch(`${apiBase}/v1/get_all_moves`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					board_rows: rows,
					current_piece: pieceId,
				}),
			});

			if (!res.ok) return null;
			const data = await res.json();
			moves = Array.isArray(data?.moves) ? data.moves : [];
		}

		return moves.some(
			(m) =>
				m?.piece == moveObj.piece &&
				m?.rotation == moveObj.rotation &&
				m?.x == moveObj.x &&
				m?.y == moveObj.y &&
				m?.spin == moveObj.spin
		);
	} catch (error) {
		return null;
	}
}

function buildSimBoardFromEngineRows(rows) {
	const occ = Array.from({ length: 40 }, () => Array(10).fill(false));
	for (let y = 0; y < 40; y++) {
		const rowMask = rows[y] || 0;
		for (let x = 0; x < 10; x++) {
			if (rowMask & (1 << x)) occ[y][x] = true;
		}
	}
	return occ;
}

function simCanMove(occ, pieceChar, rot, x, y) {
	const base = pieceBaseCoords[pieceChar];
	if (!base) return false;

	for (const [dx, dy] of base) {
		const r = rotateCoordForEngine(rot, dx, dy);
		const bx = x + r.x;
		const by = y + r.y;
		if (bx < 0 || bx >= 10 || by < 0 || by >= 40) return false;
		if (occ[by][bx]) return false;
	}

	return true;
}

function simRotateState(occ, state, pieceChar, dir) {
	const nextRot = (state.rot + rotDir[dir]) % 4;
	const key = `${pieceChar == 'I' ? 'I' : 'N'}${state.rot}-${nextRot}`;
	const kickList = kicks[key] || [];

	for (const kick of kickList) {
		const nx = state.x + kick[0];
		const ny = state.y + kick[1];
		if (simCanMove(occ, pieceChar, nextRot, nx, ny)) {
			state.x = nx;
			state.y = ny;
			state.rot = nextRot;
			return true;
		}
	}

	return false;
}

function simCurrentCellsEngine(state, pieceChar) {
	const base = pieceBaseCoords[pieceChar];
	if (!base) return [];

	const out = [];
	for (const [dx, dy] of base) {
		const r = rotateCoordForEngine(state.rot, dx, dy);
		const bx = state.x + r.x;
		const by = state.y + r.y;
		if (bx < 0 || bx >= 10 || by < 0 || by >= 40) continue;
		out.push({ x: bx, y: by, piece: pieceChar });
	}
	return out;
}

function sameCellSet(a, b) {
	if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
	const key = (c) => `${c.x},${c.y}`;
	const setA = new Set(a.map(key));
	for (const c of b) {
		if (!setA.has(key(c))) return false;
	}
	return true;
}

function simulateLocalInputSequence(rows, moveObj, inputs) {
	const pieceChar = enginePieceToChar[moveObj?.piece];
	if (!pieceChar || !Array.isArray(inputs)) {
		return { ok: false, reason: 'invalid move or inputs', match: false };
	}

	const occ = buildSimBoardFromEngineRows(rows);
	const state = {
		x: 4,
		y: 21,
		rot: 0,
	};

	if (!simCanMove(occ, pieceChar, state.rot, state.x, state.y)) {
		return { ok: false, reason: 'spawn blocked in local simulator', match: false };
	}

	for (const code of inputs) {
		switch (code) {
			case 0:
				break;
			case 1:
				if (simCanMove(occ, pieceChar, state.rot, state.x - 1, state.y)) state.x--;
				break;
			case 2:
				if (simCanMove(occ, pieceChar, state.rot, state.x + 1, state.y)) state.x++;
				break;
			case 3:
				while (simCanMove(occ, pieceChar, state.rot, state.x - 1, state.y)) state.x--;
				break;
			case 4:
				while (simCanMove(occ, pieceChar, state.rot, state.x + 1, state.y)) state.x++;
				break;
			case 5:
				simRotateState(occ, state, pieceChar, 'CW');
				break;
			case 6:
				simRotateState(occ, state, pieceChar, 'CCW');
				break;
			case 7:
				simRotateState(occ, state, pieceChar, 'R180');
				break;
			case 8:
				if (simCanMove(occ, pieceChar, state.rot, state.x, state.y - 1)) state.y--;
				break;
			case 9:
				while (simCanMove(occ, pieceChar, state.rot, state.x, state.y - 1)) state.y--;
				break;
			default:
				return { ok: false, reason: `unknown input code ${code}`, match: false };
		}
	}

	const targetCells = getMoveCells(moveObj);
	const finalCells = simCurrentCellsEngine(state, pieceChar);
	const match = sameCellSet(targetCells, finalCells);

	return {
		ok: true,
		match,
		final_state: { x: state.x, y: state.y, rotation: state.rot },
		final_cells: finalCells,
		target_cells: targetCells,
	};
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
		case 0:
		case 'none':
			// NoInput: explicit no-op to keep mapping total.
			return true;
		case 1:
		case 'moveRight':
			evalControlApi.moveRight();
			return true;
		case 2:
		case 'moveLeft':
			evalControlApi.moveLeft();
			return true;
		case 3:
		case 'dasRight':
			evalControlApi.dasRight();
			return true;
		case 4:
		case 'dasLeft':
			evalControlApi.dasLeft();
			return true;
		case 5:
		case 'rotateCW':
			evalControlApi.rotateCw();
			return true;
		case 6:
		case 'rotateCCW':
			evalControlApi.rotateCcw();
			return true;
		case 7:
		case 'rotate180':
			evalControlApi.rotateFlip();
			return true;
		case 8:
		case 'softDrop':
			evalControlApi.softDrop();
			return true;
		case 9:
		case 'hardDrop':
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
	const apiBase = normalizeEvalApiBase(apiBaseInput?.value || getDefaultEvalApiBase());
	const ips = getPlaybackInputRate();
	const stepDelayMs = 1000 / Math.max(ips, 0.1);
	const gravEl = document.getElementById('grav');
	const gravWasChecked = gravEl ? gravEl.checked : false;
	if (gravEl) gravEl.checked = false;

	evalState.playbackInFlight = true;
	setEvalStatus(`Playing route at ${ips.toFixed(1)} input/s...`);

	const moveObj = route.moves[0];

	// Reset piece to spawn position and type before playback
	piece = enginePieceToChar[moveObj.piece] || piece;
	const offset = engineToFrontendOffset[piece] || { x: 0, y: 0 };

	// Reset to engine spawn position (4, 21) mapped to frontend coords
	xPOS = 4 + offset.x;
	yPOS = (boardSize[1] - 1 - 21) + offset.y; // Engine y=21 is spawn_row
	rot = 0;
	clearActive();
	updateGhost();
	setShape();

	try {
		if (route.hold_used && evalControlApi.hold) {
			evalControlApi.hold();
			await sleepMs(stepDelayMs);
		}

		const rows = boardRowsForEngine();
		let inputs = route.input_sequence;
		if (!inputs) {
			inputs = await getInputSequenceForMove(apiBase, rows, moveObj, false);
		}

		if (!inputs || !inputs.length) {
			setEvalStatus('Playback stopped: no input sequence for selected move.', true);
			return;
		}

		// Optimized input playback: group repeated inputs to execute them faster.
		// "The repeated command (shift, rotation) should executed faster as one single input time."
		// "The SDR when executing the softdrop should be a non zero value."
		const SDR_DELAY_MS = 10; // Fast SDR for softdrop playback

		let lastX = xPOS, lastY = yPOS, lastRot = rot;

		for (let i = 0; i < inputs.length; i++) {
			const code = inputs[i];
			const nextCode = i < inputs.length - 1 ? inputs[i + 1] : null;

			if (code === 9) {
				// Hard drop is about to happen, capture the position it will land at
				lastX = xPOS;
				lastY = yGHO; // Hard drop lands at ghost
				lastRot = rot;
			}

			applyEngineInputCode(code);

			if (code !== 9) {
				// Capture current position for normal moves
				lastX = xPOS;
				lastY = yPOS;
				lastRot = rot;
			}

			// If next command is the same, and it's a "repeatable" command, don't wait or wait less.
			// Repeatable: ShiftLeft(1), ShiftRight(2), DasLeft(3), DasRight(4), RotateCw(5), RotateCcw(6), RotateFlip(7), SoftDrop(8)
			const isRepeatable = code >= 1 && code <= 8;
			const isSoftDrop = code === 8;

			if (nextCode === code && isRepeatable) {
				if (isSoftDrop) {
					await sleepMs(SDR_DELAY_MS);
				} else {
					// Execute identical shifts/rotations immediately (same frame)
					continue;
				}
			} else {
				await sleepMs(stepDelayMs);
			}
		}

		// Debug validation: check if final position matches target move
		const finalX = lastX - offset.x;
		const finalY = boardSize[1] - 1 - (lastY - offset.y);
		const finalRot = lastRot;

		if (finalX !== moveObj.x || finalY !== moveObj.y || finalRot !== moveObj.rotation) {
			console.error('Playback Position Mismatch!', {
				target: { x: moveObj.x, y: moveObj.y, rotation: moveObj.rotation },
				actual: { x: finalX, y: finalY, rotation: finalRot },
				inputs: inputs
			});
			setEvalStatus('Playback mismatch detected (see console).', true);
		} else {
			setEvalStatus('Move playback complete.');
		}
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

	return false;
}

async function filterRoutesByReachability(apiBase, rows, routes, mode) {
	if (!routes.length) return { routes: [], failedChecks: 0, relaxed: false };
	const useWasm = !!getEvalElement('evalUseWasm')?.checked;
	if (mode == 'off' || useWasm) return { routes, failedChecks: 0, relaxed: false };

	const checks = await Promise.all(
		routes.map(async (route) => {
			try {
				const reachable = await isMoveReachable(apiBase, rows, route.orderedMoves?.[0] || route.moves?.[0], mode);
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
		item.title = route.setup ? 'Double-click to apply this PC setup' : 'Double-click to play this route';
		if (route.key == evalState.selectedRouteKey) {
			item.classList.add('eval-route-item--active');
		}
		if (route.setup) {
			item.textContent = route.label;
		} else {
			const scoreText = `score ${formatEvalNumber(route.score)}`;
			const probText = typeof route.probability == 'number' ? `, p ${(route.probability * 100).toFixed(1)}%` : '';
			item.textContent = `${route.label} | ${scoreText}${probText}`;
		}

		item.addEventListener('mouseenter', () => {
			evalState.hoverRouteKey = route.key;
			rebuildEvaluationOverlay();
		});

		item.addEventListener('mouseleave', () => {
			evalState.hoverRouteKey = '';
			rebuildEvaluationOverlay();
		});

		item.addEventListener('click', () => {
			if (route.setup) armPcSetupPlan(route);
			else clearPcSetupPlan();
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
			if (selectedRoute.setup) {
				applyPcSetup(selectedRoute);
			} else {
				playRoute(selectedRoute);
			}
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
		if (!cells.length) {
			console.warn('simulateOverlayForRoute: getMoveCells returned no cells for move', moveObj);
			return;
		}

		const legal = cells.every((cell) => {
			const inBounds = inRange(cell.x, 0, 9) && inRange(cell.y, 0, 39);
			if (!inBounds) {
				console.warn(`simulateOverlayForRoute: cell out of bounds: x=${cell.x}, y=${cell.y} for piece ${cell.piece}`);
				return false;
			}
			const free = (rows[cell.y] & (1 << cell.x)) == 0;
			if (!free) {
				console.warn(`simulateOverlayForRoute: cell occupied at x=${cell.x}, y=${cell.y} for piece ${cell.piece}`);
				return false;
			}
			return true;
		});

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

	const pvSummary = (selectedRoute.orderedMoves || selectedRoute.moves)
		.map((m) => {
			const p = enginePieceToChar[m.piece] || '?';
			return `${p}@x${m.x},y${m.y},r${m.rotation}`;
		})
		.join(' -> ');
	const holdPrefix = selectedRoute.hold_used ? '[HOLD] ' : '';
	pvEl.textContent = pvSummary ? `Route: ${holdPrefix}${pvSummary}` : '';
}

function rebuildEvaluationOverlay() {
	// While the player follows a 4-piece PC setup, keep showing the pieces that
	// are still to come as shadows instead of dropping the overlay.
	if (evalState.pcSetupPlan) {
		if (pcSetupPlanMatchesBoard(evalState.pcSetupPlan)) {
			const planOverlay = computePcSetupPlanOverlay(evalState.pcSetupPlan);
			if (planOverlay.length) {
				evalState.overlayCells = planOverlay;
				updateEvaluationText();
				return;
			}
		}
		evalState.pcSetupPlan = null;
	}

	const data = evalState.latestData;
	if (!data || !data.routes?.length) {
		evalState.overlayCells = [];
		updateEvaluationText();
		return;
	}

	const activeRouteKey = evalState.hoverRouteKey || evalState.selectedRouteKey;
	const selectedRoute = data.routes.find((r) => r.key == activeRouteKey) || data.routes[0];
	// PC setup routes carry a queue-legal `orderedMoves`; use it so the first
	// piece shown is the one the queue actually allows, even before selecting.
	const routeMoves = selectedRoute.orderedMoves || selectedRoute.moves;
	evalState.overlayCells = simulateOverlayForRoute(routeMoves, boardRowsForEngine());
	updateEvaluationText();
}

async function analyzeWithEngine(forceRefresh = false) {
	if (evalState.inFlight) return;

	// A live 4-piece setup plan owns the overlay until the player deviates from
	// it or completes it, so don't overwrite the shadows with a fresh search.
	if (evalState.pcSetupPlan) {
		if (pcSetupPlanMatchesBoard(evalState.pcSetupPlan)) {
			const planOverlay = computePcSetupPlanOverlay(evalState.pcSetupPlan);
			if (planOverlay.length) {
				evalState.overlayCells = planOverlay;
				updateEvaluationText();
				return;
			}
		}
		evalState.pcSetupPlan = null;
	}

	const useWasm = !!getEvalElement('evalUseWasm')?.checked;
	const apiBaseInput = getEvalElement('evalApiBase');
	const apiBase = normalizeEvalApiBase(apiBaseInput?.value || getDefaultEvalApiBase());
	if (!apiBase && !useWasm) {
		setEvalStatus('Engine API address is empty.', true);
		return;
	}
	if (apiBase) LS.evalApiBase = apiBase;

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

	// On an empty board a generic PC search has nothing to bite on, so fall
	// back to the known high-probability PC setup list. The current bag (from
	// the queue separators) selects which opening table to consult.
	if (isPcModeEnabled() && currentBoardHeight() == 0) {
		evalState.inFlight = true;
		evalState.lastRequestAt = Date.now();
		setEvalStatus('Looking up PC setups for an empty board...');
		try {
			await loadPcSetupData();
			const bagPieces = currentBagPieces();
			const pcCount = pcSetupCountForBag(bagPieces);
			let result = buildPcSetupRoutes(pcCount);
			let usedCount = pcCount;

			if (!result.routes.length) {
				// Nothing for the derived count; scan every opening table.
				const all = [];
				for (let c = 1; c <= 8; c++) {
					const r = buildPcSetupRoutes(c);
					for (const route of r.routes) {
						route.label = `${route.label} (bag ${c})`;
						all.push(route);
					}
				}
				all.sort((a, b) => b.score - a.score);
				result = { routes: all.slice(0, 12), bagPieces, pcCount: null };
				usedCount = null;
			}

			const routes = result.routes;
			evalState.latestData = {
				raw: { pc_setups: true },
				routes,
				score: routes.length ? routes[0].score : null,
			};
			evalState.lastAppliedHash = stateHash;
			renderRoutesList();
			rebuildEvaluationOverlay();

			if (!routes.length) {
				setEvalStatus(
					`No PC setup found for the current bag (${bagPieces.length} piece(s) left: ${bagPieces.join('') || '-'}).`,
					true
				);
			} else {
				const where = usedCount ? `PC #${usedCount}` : 'all PC tables';
				setEvalStatus(
					`PC setup list: ${routes.length} option(s) for ${where}, ${bagPieces.length} piece(s) left in bag. Double-click a setup to apply it.`
				);
			}
		} catch (error) {
			evalState.overlayCells = [];
			evalState.latestData = null;
			renderRoutesList();
			rebuildEvaluationOverlay();
			setEvalStatus(`PC setup lookup failed: ${error.message}`, true);
		} finally {
			evalState.inFlight = false;
		}
		return;
	}

	evalState.inFlight = true;
	evalState.lastRequestAt = Date.now();
	setEvalStatus('Analyzing position...');

	try {
		const sentB2b = currentB2BForEngine();
		const sentCombo = currentComboForEngine();
		const sentPending = Math.floor(readNumberInput('evalPendingGarbage', 0, 0));
		const overrides = getSearchOverridesFromUi();
		const engineType = getEvalElement('evalEngineType')?.value || 'fusion';
		const useWasm = !!getEvalElement('evalUseWasm')?.checked;

		if (!useWasm && engineType === 'cold-clear') {
			throw new Error('Cold Clear 2 only supports WASM mode');
		}

		let data;
		if (useWasm) {
			const holdId = holdP ? charToEnginePiece[holdP] : null;
			const queueIds = queueForEngine();
			data = await wasmHelper.findBestMove(engineType, {
				rows,
				pieceId,
				queue: queueIds,
				holdId,
				overrides: {
					...overrides,
					b2b: sentB2b,
					combo: sentCombo,
					pending_garbage: sentPending,
				}
			});
			if (!data) throw new Error('WASM engine returned no result');
		} else {
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
				search: overrides,
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

			data = await res.json();
		}

		const rawRoutes = buildEvaluationRoutes(data);
		const holdId = holdP ? charToEnginePiece[holdP] : null;
		const queueIds = queueForEngine();
		const nextQueuePieceId = queueIds.length ? queueIds[0] : null;
		const contextRoutes = rawRoutes.filter((route) => {
			const check = validateRoutePieceContext(route, pieceId, holdId, nextQueuePieceId);
			return check.ok;
		});
		const filtered = await filterRoutesByReachability(apiBase, rows, contextRoutes, evalState.reachabilityMode);
		const finalRoutes = filtered.routes;

		evalState.latestData = {
			raw: data,
			routes: finalRoutes,
			score: data.score,
		};

		renderRoutesList();
		rebuildEvaluationOverlay();
		
		evalState.lastAppliedHash = stateHash;
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
		evalState.latestData = null;
		renderRoutesList();
		rebuildEvaluationOverlay();
		
		if (error.message.includes('no PC solution found') || error.message.includes('no result')) {
			const height = currentBoardHeight();
			if (height > 6) {
				setEvalStatus(`No PC solution: board is ${height} rows high, PC search only covers up to 6.`, true);
			} else {
				setEvalStatus(`No PC found for this board/queue (height ${height}). Try the PC preset or a longer time budget.`, true);
			}
		} else {
			setEvalStatus(`Evaluation failed: ${error.message}`, true);
		}
	} finally {
		evalState.inFlight = false;
	}
}

async function probeRouteMoveReachability(apiBase, rows, moveObj) {
	if (!moveObj) {
		return {
			ok: false,
			error: 'missing move object',
			variants: [],
		};
	}

	const variants = reachabilityMoveVariants(moveObj);
	const checks = [];

	for (const variant of variants) {
		let strictCount = -1;
		let forcedCount = -1;
		let strictInputs = [];
		let forcedInputs = [];

		try {
			strictCount = await getInputCountForMove(apiBase, rows, variant, false);
			if (strictCount > 0) {
				strictInputs = await getInputSequenceForMove(apiBase, rows, variant, false);
			}
		} catch (error) {
			strictCount = -1;
		}

		try {
			forcedCount = await getInputCountForMove(apiBase, rows, variant, true);
			if (forcedCount > 0) {
				forcedInputs = await getInputSequenceForMove(apiBase, rows, variant, true);
			}
		} catch (error) {
			forcedCount = -1;
		}

		checks.push({
			move: variant,
			cells: getMoveCells(variant),
			strict_count: strictCount,
			strict_inputs: strictInputs,
			strict_input_names: strictInputs.map((code) => engineInputName(code)),
			strict_input_heuristics: analyzeInputSequenceHeuristics(strictInputs),
			strict_local_simulation: strictInputs.length
				? simulateLocalInputSequence(rows, variant, strictInputs)
				: null,
			forced_count: forcedCount,
			forced_inputs: forcedInputs,
			forced_input_names: forcedInputs.map((code) => engineInputName(code)),
			forced_input_heuristics: analyzeInputSequenceHeuristics(forcedInputs),
			forced_local_simulation: forcedInputs.length
				? simulateLocalInputSequence(rows, variant, forcedInputs)
				: null,
		});
	}

	return {
		ok: true,
		variants: checks,
	};
}

function validateRoutePieceContext(route, currentPieceId, holdPieceId, nextQueuePieceId) {
	const firstMove = route?.moves?.[0] || null;
	if (!firstMove) {
		return {
			ok: false,
			reason: 'missing first move',
		};
	}

	if (route.hold_used) {
		if (holdPieceId !== null && holdPieceId !== undefined) {
			if (firstMove.piece !== holdPieceId) {
				return {
					ok: false,
					reason: `route marked hold_used, but move piece ${firstMove.piece} != hold piece ${holdPieceId}`,
				};
			}
			return {
				ok: true,
				reason: 'hold route piece matches hold piece',
			};
		}

		// Empty hold: first hold consumes current and plays queue[0].
		if (nextQueuePieceId === null || nextQueuePieceId === undefined) {
			return {
				ok: false,
				reason: 'route requires hold from empty hold, but queue is empty',
			};
		}
		if (firstMove.piece !== nextQueuePieceId) {
			return {
				ok: false,
				reason: `route marked hold_used from empty hold, but move piece ${firstMove.piece} != queue[0] ${nextQueuePieceId}`,
			};
		}
		return {
			ok: true,
			reason: 'hold route piece matches queue[0] for empty-hold swap',
		};
	}

	// Candidates may occasionally miss hold_used metadata; infer when possible.
	if (firstMove.piece !== currentPieceId) {
		if (holdPieceId !== null && holdPieceId !== undefined && firstMove.piece == holdPieceId) {
			return {
				ok: true,
				reason: 'inferred hold route: move piece matches hold piece',
			};
		}
		if ((holdPieceId === null || holdPieceId === undefined) && nextQueuePieceId !== null && nextQueuePieceId !== undefined && firstMove.piece == nextQueuePieceId) {
			return {
				ok: true,
				reason: 'inferred empty-hold swap route: move piece matches queue[0]',
			};
		}

		return {
			ok: false,
			reason: `route uses current piece path, but move piece ${firstMove.piece} != current piece ${currentPieceId}`,
		};
	}

	return {
		ok: true,
		reason: 'non-hold route piece matches current piece',
	};
}

window.evalDebugDump = async function evalDebugDump(options = {}) {
	const runFreshAnalyze = options.runFreshAnalyze !== false;
	if (runFreshAnalyze) {
		try {
			await analyzeWithEngine(true);
		} catch (error) {
			// Continue and include failure details in dump.
		}
	}

	const apiBaseInput = getEvalElement('evalApiBase');
	const apiBase = normalizeEvalApiBase(apiBaseInput?.value || getDefaultEvalApiBase());
	const rows = boardRowsForEngine();
	const pieceId = charToEnginePiece[piece];
	const queueIds = queueForEngine();
	const holdId = holdP ? charToEnginePiece[holdP] : null;
	const sentB2b = currentB2BForEngine();
	const sentCombo = currentComboForEngine();
	const sentPending = Math.floor(readNumberInput('evalPendingGarbage', 0, 0));

	const payload = {
		board_rows: rows,
		current_piece: pieceId,
		queue: queueIds,
		hold: holdId,
		b2b: sentB2b,
		combo: sentCombo,
		pending_garbage: sentPending,
		include_candidates: true,
		candidate_limit: 8,
		candidate_temperature: 1.0,
		search: getSearchOverridesFromUi(),
	};

	let findBestMoveStatus = null;
	let findBestMoveBody = null;
	let findBestMoveError = null;

	try {
		const res = await fetch(`${apiBase}/v1/find_best_move`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
			},
			body: JSON.stringify(payload),
		});
		findBestMoveStatus = res.status;
		findBestMoveBody = await res.json();
	} catch (error) {
		findBestMoveError = String(error?.message || error);
	}

	const rawRoutes = findBestMoveBody ? buildEvaluationRoutes(findBestMoveBody) : [];
	const routeProbes = [];
	for (const route of rawRoutes) {
		const firstMove = route.moves?.[0] || null;
		const probe = await probeRouteMoveReachability(apiBase, rows, firstMove);
		const movegenContains = await isMoveInEngineMovegen(apiBase, rows, pieceId, firstMove);
		const nextQueuePieceId = queueIds.length ? queueIds[0] : null;
		const contextCheck = validateRoutePieceContext(route, pieceId, holdId, nextQueuePieceId);
		routeProbes.push({
			key: route.key,
			label: route.label,
			score: route.score,
			first_move: firstMove,
			engine_movegen_contains_first_move: movegenContains,
			piece_context_check: contextCheck,
			reachability_probe: probe,
		});
	}

	const selectedRoute = evalState.latestData?.routes?.find((r) => r.key == evalState.selectedRouteKey) || null;
	const selectedMove = selectedRoute?.moves?.[0] || null;
	const selectedMoveProbe = await probeRouteMoveReachability(apiBase, rows, selectedMove);
	const selectedMoveInMovegen = await isMoveInEngineMovegen(apiBase, rows, pieceId, selectedMove);
	const customMoveProbe = options.probeMove
		? await probeRouteMoveReachability(apiBase, rows, options.probeMove)
		: null;
	const customMoveInMovegen = options.probeMove
		? await isMoveInEngineMovegen(apiBase, rows, pieceId, options.probeMove)
		: null;

	const dump = {
		timestamp: new Date().toISOString(),
		url: window.location?.href || '',
		api_base: apiBase,
		reachability_mode: evalState.reachabilityMode,
		selected_route_key: evalState.selectedRouteKey,
		hover_route_key: evalState.hoverRouteKey,
		state_hash: getEvaluationStateHash(),
		state: {
			piece_char: piece,
			piece_id: pieceId,
			hold_char: holdP || null,
			hold_id: holdId,
			queue_chars: queue.filter((p) => p != '|'),
			queue_ids: queueIds,
			b2b: sentB2b,
			combo: sentCombo,
			pending_garbage: sentPending,
			board_rows: rows,
		},
		request_payload: payload,
		find_best_move: {
			status: findBestMoveStatus,
			error: findBestMoveError,
			body: findBestMoveBody,
		},
		raw_routes: rawRoutes,
		route_probes: routeProbes,
		latest_data: evalState.latestData,
		selected_route_probe: {
			route: selectedRoute,
			engine_movegen_contains_first_move: selectedMoveInMovegen,
			probe: selectedMoveProbe,
		},
		custom_move_probe: {
			move: options.probeMove || null,
			engine_movegen_contains_move: customMoveInMovegen,
			probe: customMoveProbe,
		},
	};

	console.groupCollapsed('[evalDebugDump] Engine snapshot');
	console.log(dump);
	console.log('[evalDebugDump] Copy JSON:', JSON.stringify(dump));
	console.groupEnd();

	return dump;
};

function setEvaluationMode(enabled) {
	evalState.enabled = enabled;
	evalState.optionsHidden = enabled;
	if (!enabled) {
		evalState.overlayCells = [];
		evalState.hoverRouteKey = '';
		clearPcSetupPlan();
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
	const engineTypeSelect = getEvalElement('evalEngineType');
	const beamWidthInput = getEvalElement('evalBeamWidth');
	const depthInput = getEvalElement('evalDepth');
	const useWasmCheckbox = getEvalElement('evalUseWasm');
	const apiBaseContainer = getEvalElement('apiBaseContainer');

	const applyEngineVisibility = (type) => {
		document.querySelectorAll('.fusion-only').forEach((el) => {
			el.style.display = type === 'fusion' ? '' : 'none';
		});
		document.querySelectorAll('.falcon-only').forEach((el) => {
			el.style.display = type === 'falcon' ? '' : 'none';
		});
		document.querySelectorAll('.cold-clear-only').forEach((el) => {
			el.style.display = type === 'cold-clear' ? '' : 'none';
		});

		// Beam width / depth are hidden for Cold Clear.
		const beamRow = beamWidthInput?.closest('.eval-row');
		const depthRow = depthInput?.closest('.eval-row');
		if (beamRow) beamRow.style.display = type === 'cold-clear' ? 'none' : 'flex';
		if (depthRow) depthRow.style.display = type === 'cold-clear' ? 'none' : 'flex';
	};

	if (useWasmCheckbox && apiBaseContainer) {
		useWasmCheckbox.addEventListener('change', () => {
			apiBaseContainer.style.display = useWasmCheckbox.checked ? 'none' : 'grid';
			LS.evalUseWasm = useWasmCheckbox.checked ? '1' : '0';
		});
		if (LS.evalUseWasm === '0') {
			useWasmCheckbox.checked = false;
			apiBaseContainer.style.display = 'grid';
		}
	}

	if (engineTypeSelect) {
		engineTypeSelect.addEventListener('change', () => {
			const type = engineTypeSelect.value;
			applyEngineVisibility(type);

			if (type === 'falcon') {
				if (!apiBaseInput.value || apiBaseInput.value == evalServerConfig.fusionApiBase || apiBaseInput.value.includes('8787')) {
					apiBaseInput.value = evalServerConfig.falconApiBase;
				}
				if (beamWidthInput) beamWidthInput.value = '500';
				if (depthInput) depthInput.value = '8';
			} else if (type === 'fusion') {
				if (!apiBaseInput.value || apiBaseInput.value == evalServerConfig.falconApiBase || apiBaseInput.value.includes('8888')) {
					apiBaseInput.value = evalServerConfig.fusionApiBase;
				}
				if (beamWidthInput) beamWidthInput.value = '500';
				if (depthInput) depthInput.value = '12';
			}
		});
		applyEngineVisibility(engineTypeSelect.value);
	}

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
		loadEvalServerConfig();
	}

	if (LS.evalReachabilityMode && ['strict', 'relaxed', 'off'].includes(LS.evalReachabilityMode)) {
		evalState.reachabilityMode = LS.evalReachabilityMode == 'relaxed' ? 'strict' : LS.evalReachabilityMode;
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
		const modes = ['strict', 'off'];
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

	// Add listeners for all fusion parameters to trigger re-analysis
	[
		'evalBeamWidth',
		'evalDepth',
		'evalTimeBudgetMs',
		'evalFutilityDelta',
		'evalAttackWeight',
		'evalChainWeight',
		'evalContextWeight',
		'evalB2bWeight',
		'evalDownstackWeight',
		'evalPcMode',
		'evalSpinFullWeight',
		'evalSpinMiniWeight',
		'evalBoardWeight',
		'evalQMaxExtensions',
		'evalQBeamFraction',
		'evalUseTt',
		'evalExtendQueue',
		'evalPcGarbage',
		'evalPcB2b',
		'evalB2bChaining',
		'evalB2bBonus',
		'evalBaseAttack',
		'evalMiniSpinAttack',
		'evalSpinAttack',
		'evalComboTable',
		].forEach(id => {
		getEvalElement(id)?.addEventListener('change', () => {
			if (evalState.enabled) analyzeWithEngine(true);
		});
	});

	toggleOptionsBtn.addEventListener('click', () => {
		evalState.optionsHidden = !evalState.optionsHidden;
		applyCompactOptionsVisibility();
	});

	applyCompactOptionsVisibility();
	syncEvalChainInputsFromGame();
	initPresets();
	loadPcSetupData();
	setEvalStatus('Evaluation is disabled.');
	evalUiReady = true;
}

function drawEvaluationOverlay(phase = 'all') {
	if (!evalState.enabled || !evalState.overlayCells.length) return;

	const pcMode = isPcModeEnabled();
	const drawShadows = phase === 'all' || phase === 'shadows';
	const drawNext = phase === 'all' || phase === 'next';

	const drawOverlayCell = (cell, isNext) => {
		const boardRowIndex = boardSize[1] - 1 - cell.y;
		const drawY = boardRowIndex - hiddenRows + 2;
		if (!inRange(drawY, 0, boardSize[1])) return;

		const pieceHex = color[cell.piece] || '#ffffff';

		if (isNext) {
			// The placement to make right now: bright and clearly outlined.
			ctx.fillStyle = hexToRgba(pieceHex, 0.7);
			ctx.fillRect(cell.x * cellSize + 1, drawY * cellSize + 1, cellSize - 2, cellSize - 2);

			ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
			ctx.lineWidth = 2;
			ctx.strokeRect(cell.x * cellSize + 1.5, drawY * cellSize + 1.5, cellSize - 3, cellSize - 3);
		} else {
			// Follow-up pieces of the route: faint shadows that recede with
			// each step so the ordering stays readable.
			const fade = Math.pow(0.62, Math.max(0, cell.step - 1));
			ctx.fillStyle = hexToRgba(pieceHex, Math.max(0.04, 0.18 * fade));
			ctx.fillRect(cell.x * cellSize + 1, drawY * cellSize + 1, cellSize - 2, cellSize - 2);

			ctx.strokeStyle = hexToRgba(pieceHex, Math.max(0.1, 0.45 * fade));
			ctx.lineWidth = 1;
			ctx.strokeRect(cell.x * cellSize + 2, drawY * cellSize + 2, cellSize - 4, cellSize - 4);
		}
	};

	// In PC mode every piece of the route is shown; the follow-ups are drawn
	// as shadows behind the stack and the next placement on top of it. Outside
	// PC mode only the immediate move is shown.
	if (pcMode && drawShadows) {
		for (const cell of evalState.overlayCells) {
			if (cell.step !== 0) drawOverlayCell(cell, false);
		}
	}
	if (drawNext) {
		for (const cell of evalState.overlayCells) {
			if (cell.step === 0) drawOverlayCell(cell, true);
		}
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
		if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
			return;
		}
		const input = ctrl[e.code];
		if (input) {
			e.preventDefault();
			if (document.activeElement && document.activeElement.blur) {
				document.activeElement.blur();
			}
			keysDown |= flags[input]; //* sets key in keysDown
		}
		
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
		if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
			return;
		}
		const input = ctrl[e.code];
		if (input) {
			if (document.activeElement && document.activeElement.blur) {
				document.activeElement.blur();
			}
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
		lastRotationType = dir === 'R180' ? 180 : 90;

		var kickIndex = 0;
		for (const kick of kicks[`${piece == 'I' ? 'I' : 'N'}${rot}-${newRot}`]) {
			if (canMove(pieces[piece][newRot], xPOS + kick[0], yPOS - kick[1])) {
				// Y is inverted lol
				xPOS += kick[0];
				yPOS -= kick[1];
				rot = newRot;
				lastKick = kickIndex;
				playSnd('Rotate', true);
				lastAction = 'ROT';
				break;
			}
			kickIndex++;
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
				else if (board[corner[0]] && board[corner[0]][corner[1]] && board[corner[0]][corner[1]]['t'] == 1) filledCorners++;
			});
			tspin = filledCorners >= 3;

			if (tspin) {
				filledFacingCorners = 0;
				facingCorners.forEach((corner) => {
					if (corner[0] >= 40 || corner[1] < 0 || corner[1] >= 10) filledFacingCorners++;
					else if (board[corner[0]] && board[corner[0]][corner[1]] && board[corner[0]][corner[1]]['t'] == 1) filledFacingCorners++;
				});
				mini = filledFacingCorners < 2;

				// Kick shortcut: If the rotation succeeded using the last kick (Index 4),
				// it is automatically "upgraded" to a Regular T-Spin, even if it only satisfies the Mini criteria.
				// (Only for 90-degree rotations)
				if (mini && lastRotationType === 90 && lastKick === 4) {
					mini = false;
				}
			} else {
				// Immobile exception for T-piece: If it fails the 3-corner rule but is immobile,
				// it's awarded a T-spin Mini.
				if (isImmobile(pieces[piece][rot], xPOS, yPOS)) {
					tspin = true;
					mini = true;
				}
			}
		}

		// Non-T piece spin detection (L, J, S, Z, I)
		if (!tspin && piece != 'T' && piece != 'O' && lastAction == 'ROT') {
			if (isImmobile(pieces[piece][rot], xPOS, yPOS)) {
				mini = true;
				allspinMini = true;
			}
		}

		clearedIndexes = [];
		let permanentLinesCleared = 0;

		board = board.filter((r, i) => {
			let isFull = r.every((c) => c.t == 1);
			if (isFull) {
				clearedIndexes.push(i);
				if (r.some(c => c.permanent)) {
					permanentLinesCleared++;
				}
				return false;
			}
			return true;
		});
		var l = board.length;
		for (let i = 0; i < boardSize[1] - l; i++) {
			board.unshift(aRow());
		}

		if (permanentLinesCleared > 0) {
			// Respawn permanent garbage at the bottom
			// Use the current messiness/permanent settings from the UI if available, 
			// otherwise default to 0% messiness and permanent=true.
			const messiness = document.getElementById('practiceMessiness') ? parseInt(document.getElementById('practiceMessiness').value) : 0;
			addPracticeGarbage(permanentLinesCleared, messiness, true);
		}
		var cleared = clearedIndexes.length;

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
		// Route shadows go behind the stack, the next placement on top of it.
		drawEvaluationOverlay('shadows');

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

		drawEvaluationOverlay('next');
		window.requestAnimationFrame(render);
	}
	/*
	setInterval(() => {
		render();
	}, 0);
    */
	window.requestAnimationFrame(render);
}

function updateQueue() {
	temp = false;
	ctxN.clearRect(0, 0, 90, 360);
	ctxH.clearRect(0, 0, 90, 60);
	for (let i = 0; i < 7; i++) {
		if (queue[i] == '|') {
			ctxN.beginPath();
			ctxN.moveTo(0, i * 60);
			ctxN.lineTo(90, i * 60);
			ctxN.stroke();
			temp = true;
		} else {
			j = i;
			if (temp) j--;
			ctxN.drawImage(imgs[queue[i]], 0, j * 60);
		}
	}
	if (holdP) ctxH.drawImage(imgs[holdP], 0, 0);
}

function shuffleQueue() {
	// locate bag separator
	index = 0;
	while (index < queue.length && queue[index] != '|') index++;

	tempQueue = queue.slice(0, index).concat(piece).shuffle().concat('|');
	// the queue before the bag separator (the current bag), plus active piece; shuffle it; add bag separator to end
	piece = tempQueue.shift();
	queue = tempQueue;

	while (queue.length < 10) {
		var shuf = names.shuffle();
		shuf.map((p) => queue.push(p));
		queue.push('|');
	}
	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	clearActive();
	checkTopOut();
	updateQueue();
	updateGhost();
	setShape();
	updateHistory();
}

function shuffleQueuePlusHold() {
	if (!holdP) {
		shuffleQueue();
		return;
	}

	index = 0;
	while (index < queue.length && queue[index] != '|') index++;

	tempQueue = queue.slice(0, index).concat(piece, holdP).shuffle().concat('|');
	holdP = tempQueue.shift();
	piece = tempQueue.shift();
	queue = tempQueue;

	while (queue.length < 10) {
		var shuf = names.shuffle();
		shuf.map((p) => queue.push(p));
		queue.push('|');
	}
	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	clearActive();
	checkTopOut();
	updateQueue();
	updateGhost();
	setShape();
	updateHistory();
}

function updateKickTable() {
	kicks = kicksets[document.getElementById('kickset').value];
}

function saveCustomPreset() {
	const name = prompt('Enter preset name:');
	if (!name) return;

	const config = {
		beam_width: readNumberInput('evalBeamWidth', 800, 1),
		depth: readNumberInput('evalDepth', 14, 1),
		futility_delta: readNumberInput('evalFutilityDelta', 15.0, 0),
		time_budget_ms: readNumberInput('evalTimeBudgetMs', 50, 1),
		use_tt: !!getEvalElement('evalUseTt')?.checked,
		extend_queue_7bag: !!getEvalElement('evalExtendQueue')?.checked,
		attack_weight: readNumberInput('evalAttackWeight', 0.5, 0),
		chain_weight: readNumberInput('evalChainWeight', 1.0, 0),
		context_weight: readNumberInput('evalContextWeight', 0.25, 0),
		b2b_weight: readNumberInput('evalB2bWeight', 1.0, 0),
		downstack_weight: readNumberInput('evalDownstackWeight', 0.20, 0),
		downstack_avg_height_weight: readNumberInput('evalDownstackAvgHeightWeight', 0.0),
		downstack_min_height_weight: readNumberInput('evalDownstackMinHeightWeight', -5.0),
		path_decay: readNumberInput('evalPathDecay', 1.0, 0),
		pc_mode: !!getEvalElement('evalPcMode')?.checked,
		spin_full_weight: readNumberInput('evalSpinFullWeight', 8.0, 0),
		spin_mini_weight: readNumberInput('evalSpinMiniWeight', 2.0, 0),
		board_weight: readNumberInput('evalBoardWeight', 1.0, 0),
	};

	let custom = {};
	try {
		custom = JSON.parse(localStorage.getItem('zztetris_custom_presets') || '{}');
	} catch (e) {}
	custom[name] = config;
	localStorage.setItem('zztetris_custom_presets', JSON.stringify(custom));
	loadCustomPresets(name);
}

function loadCustomPresets(selectedName = null) {
	const select = getEvalElement('evalPreset');
	if (!select) return;

	// Keep built-in presets
	while (select.options.length > 3) {
		select.remove(3);
	}

	let custom = {};
	try {
		custom = JSON.parse(localStorage.getItem('zztetris_custom_presets') || '{}');
	} catch (e) {}

	for (const name in custom) {
		const opt = document.createElement('option');
		opt.value = 'custom_' + name;
		opt.textContent = name;
		select.appendChild(opt);
		if (selectedName === name) {
			select.value = opt.value;
		}
	}
}

function initPresets() {
	const select = getEvalElement('evalPreset');
	if (!select) return;

	loadCustomPresets();

	select.addEventListener('change', () => {
		const val = select.value;
		if (val === 'default') {
			getEvalElement('evalAttackWeight').value = 0.5;
			getEvalElement('evalChainWeight').value = 1.0;
			getEvalElement('evalB2bWeight').value = 1.0;
			getEvalElement('evalDownstackWeight').value = 0.20;
			getEvalElement('evalDownstackAvgHeightWeight').value = 0.0;
			getEvalElement('evalDownstackMinHeightWeight').value = -5.0;
			getEvalElement('evalPathDecay').value = 1.0;
			getEvalElement('evalPcMode').checked = false;
			getEvalElement('evalBoardWeight').value = 1.0;
		} else if (val === 'downstack') {
			getEvalElement('evalAttackWeight').value = 0;
			getEvalElement('evalChainWeight').value = 0;
			getEvalElement('evalB2bWeight').value = 0;
			getEvalElement('evalDownstackWeight').value = 1.0;
			getEvalElement('evalDownstackAvgHeightWeight').value = 0.0;
			getEvalElement('evalDownstackMinHeightWeight').value = -10.0;
			getEvalElement('evalPathDecay').value = 0.95;
			getEvalElement('evalPcMode').checked = false;
			getEvalElement('evalBoardWeight').value = 0.1;
		}
 else if (val === 'pc') {
			getEvalElement('evalAttackWeight').value = 0;
			getEvalElement('evalChainWeight').value = 0;
			getEvalElement('evalB2bWeight').value = 0;
			getEvalElement('evalDownstackWeight').value = 0;
			getEvalElement('evalPcMode').checked = true;
			getEvalElement('evalPathDecay').value = 1.0;
			getEvalElement('evalBoardWeight').value = 0;
			// PC search needs depth to cover the board/queue
			getEvalElement('evalDepth').value = 20;
			// The PC search is an explicit action, so it can afford a larger
			// budget than live evaluation. Iterative deepening returns the
			// smallest clear it can prove within this window.
			getEvalElement('evalTimeBudgetMs').value = 1000;
			}
 else if (val.startsWith('custom_')) {
			const name = val.replace('custom_', '');
			let custom = {};
			try {
				custom = JSON.parse(localStorage.getItem('zztetris_custom_presets') || '{}');
			} catch (e) {}
			const config = custom[name];
			if (config) {
				for (const key in config) {
					const el = getEvalElement('eval' + key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(''));
					if (el) {
						if (el.type === 'checkbox') el.checked = config[key];
						else el.value = config[key];
					}
				}
			}
		}

		if (evalState.enabled) analyzeWithEngine(true);
	});
}

function deleteCustomPreset() {
	const select = getEvalElement('evalPreset');
	if (!select) return;
	const val = select.value;
	if (!val.startsWith('custom_')) {
		alert('Cannot delete built-in presets.');
		return;
	}

	const name = val.replace('custom_', '');
	if (!confirm('Are you sure you want to delete the preset "' + name + '"?')) return;

	let custom = {};
	try {
		custom = JSON.parse(localStorage.getItem('zztetris_custom_presets') || '{}');
	} catch (e) {}
	
	delete custom[name];
	localStorage.setItem('zztetris_custom_presets', JSON.stringify(custom));
	
	select.value = 'default';
	loadCustomPresets();
	// Trigger default preset values
	const event = new Event('change');
	select.dispatchEvent(event);
}
