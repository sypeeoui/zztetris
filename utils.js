function mirror() {
	for (row = 0; row < board.length; row++) {
		board[row].reverse();
		for (i = 0; i < board[row].length; i++) {
			if (board[row][i].t == 1) board[row][i].c = reversed[board[row][i].c];
		}
	}
	for (i = 0; i < queue.length; i++) {
		queue[i] = reversed[queue[i]];
	}
	holdP = reversed[holdP];
	piece = reversed[piece];

	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	clearActive();
	updateGhost();
	updateQueue();
	setShape();
	updateHistory();
}

function fullMirror() {
	for (i = 0; i < hist.length; i++) {
		tempBoard = JSON.parse(hist[i]['board']);
		for (row = 0; row < tempBoard.length; row++) {
			tempBoard[row].reverse();
			for (j = 0; j < tempBoard[row].length; j++) {
				if (tempBoard[row][j].t == 1) tempBoard[row][j].c = reversed[tempBoard[row][j].c];
			}
		}
		hist[i]['board'] = JSON.stringify(tempBoard);
		tempQueue = JSON.parse(hist[i]['queue']);
		for (j = 0; j < tempQueue.length; j++) {
			tempQueue[j] = reversed[tempQueue[j]];
		}
		hist[i]['queue'] = JSON.stringify(tempQueue);

		hist[i]['hold'] = reversed[hist[i]['hold']];
		hist[i]['piece'] = reversed[hist[i]['piece']];
	}
	board = tempBoard;
	queue = tempQueue;
	holdP = reversed[holdP];
	xPOS = spawn[0];
	yPOS = spawn[1];
	rot = 0;
	updateQueue();
	clearActive();
	updateGhost();
	setShape();
}

function garbage(column, amount = 1) {
	for (i = 0; i < amount; i++) {
		garbageRow = new Array(10).fill({ t: 1, c: 'X' });
		garbageRow[column] = { t: 0, c: '' };
		board.shift();
		board.push(garbageRow);
	}
	xPOS = spawn[0];
	yPOS = spawn[1];
	updateGhost();
}

// Add garbage rows with a hole of `size` columns at `column`. Used by the
// replay practice pending-garbage queue; unlike garbage(), it creates fresh
// cell objects for every row.
function addGarbageRows(column, amount = 1, size = 1) {
	for (let i = 0; i < amount; i++) {
		const row = [];
		for (let c = 0; c < boardSize[0]; c++) {
			row.push(
				c >= column && c < column + size
					? { t: 0, c: '' }
					: { t: 1, c: 'X' }
			);
		}
		board.shift();
		board.push(row);
	}
	xPOS = spawn[0];
	yPOS = spawn[1];
	updateGhost();
}

// Shared pending-garbage meter used by replay practice and the attack
// simulator. `blocks` is the queue's entry list; each entry becomes one
// visible segment so block divisions stay readable.
function updateGarbageMeterDisplay(blocks) {
	const container = document.getElementById('garbageMeterBlocks');
	const count = document.getElementById('garbageCount');
	if (!container || !count) return;
	const entries = Array.isArray(blocks) ? blocks : [{ amount: blocks }];
	const amounts = entries.map((entry) =>
		Math.max(0, Math.floor(Number(entry?.amount) || 0))
	);
	const total = amounts.reduce((sum, amount) => sum + amount, 0);
	const maxLines = boardSize[1] - hiddenRows + 3;
	const scale = total > maxLines ? maxLines / total : 1;
	container.innerHTML = '';
	for (const amount of amounts) {
		if (amount <= 0) continue;
		const block = document.createElement('div');
		block.className = 'garbage-meter-block';
		block.style.height = `${(amount * scale / maxLines) * 100}%`;
		block.title = `${amount} line${amount === 1 ? '' : 's'}`;
		container.appendChild(block);
	}
	count.textContent = String(total);
}

function addPracticeGarbageUI() {
	const layers = parseInt(document.getElementById('practiceLayers').value) || 1;
	const messiness = parseInt(document.getElementById('practiceMessiness').value) || 0;
	const permanent = document.getElementById('practicePermanent').checked;
	// Rerandomize if permanent is enabled and we already have permanent rows
	const hasPermanent = board.some(row => row.some(cell => cell.permanent));
	addPracticeGarbage(layers, messiness, permanent, permanent && hasPermanent);
}

let lastHoleCol = -1;

function addPracticeGarbage(layers, messiness, permanent, rerandomize = false) {
	if (lastHoleCol === -1) lastHoleCol = Math.floor(Math.random() * 10);
	
	if (rerandomize) {
		// Keep the number of permanent garbage rows in sync with the layer
		// input. Adding layers pushes the stack up; removing layers lets the
		// stack above fall down.
		const existing = board.filter((row) => row.some((cell) => cell.permanent)).length;
		if (layers > existing) {
			for (let i = existing; i < layers; i++) {
				if (Math.random() * 100 < messiness || lastHoleCol === -1) {
					let nextCol = Math.floor(Math.random() * 10);
					if (messiness > 0) {
						while (nextCol === lastHoleCol) nextCol = Math.floor(Math.random() * 10);
					}
					lastHoleCol = nextCol;
				}

				let garbageRow = [];
				for (let c = 0; c < 10; c++) {
					if (c === lastHoleCol) {
						garbageRow.push({ t: 0, c: '' });
					} else {
						garbageRow.push({ t: 1, c: 'X', permanent: true });
					}
				}

				board.shift();
				board.push(garbageRow);
			}
		} else if (layers < existing) {
			for (let i = existing; i > layers; i--) {
				const index = board.findIndex((row) => row.some((cell) => cell.permanent));
				if (index === -1) break;
				board.splice(index, 1);
				board.unshift(aRow());
			}
		}

		// Rerandomize all remaining permanent lines.
		board.forEach((row, rowIndex) => {
			if (row.some(cell => cell.permanent)) {
				// Randomize hole for this row
				if (Math.random() * 100 < messiness) {
					let nextCol = Math.floor(Math.random() * 10);
					if (messiness > 0) {
						while (nextCol === lastHoleCol) nextCol = Math.floor(Math.random() * 10);
					}
					lastHoleCol = nextCol;
				}
				
				let newRow = [];
				for (let c = 0; c < 10; c++) {
					if (c === lastHoleCol) {
						newRow.push({ t: 0, c: '' });
					} else {
						newRow.push({ t: 1, c: 'X', permanent: true });
					}
				}
				board[rowIndex] = newRow;
			}
		});
	} else {
		// Add new lines
		for (let i = 0; i < layers; i++) {
			if (Math.random() * 100 < messiness || i === 0 && lastHoleCol === -1) {
				let nextCol = Math.floor(Math.random() * 10);
				if (messiness > 0) {
					while (nextCol === lastHoleCol) nextCol = Math.floor(Math.random() * 10);
				}
				lastHoleCol = nextCol;
			}
			
			let garbageRow = [];
			for (let c = 0; c < 10; c++) {
				if (c === lastHoleCol) {
					garbageRow.push({ t: 0, c: '' });
				} else {
					let cell = { t: 1, c: 'X' };
					if (permanent) cell.permanent = true;
					garbageRow.push(cell);
				}
			}
			
			board.shift();
			board.push(garbageRow);
		}
	}
	
	xPOS = spawn[0];
	yPOS = spawn[1];
	updateGhost();
	if (typeof updateHistory === 'function') updateHistory();
}

// Update messiness value display
$(document).on('input', '#practiceMessiness', function() {
    $('#messinessVal').text($(this).val() + '%');
});
