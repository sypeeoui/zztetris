// gomen PC solver worker.
//
// Vendored from wirelyre/tetra-tools (gomen 0.3.1, GPL-3.0-or-later):
// https://github.com/wirelyre/tetra-tools
//
// Loads the precomputed legal-board database once and answers solve queries.
// The database is the same file the fusion engine uses, served from the game
// root so both consumers share one copy.
importScripts('./pkg/gomen.js');

// The solver reports progress through this wasm import. The analyzer only
// runs short 4-row queries, so there is nothing to forward.
function progress(piece_count, stage, board_idx, board_total) {}

let solver = null;
let initPromise = null;

async function ensureInit() {
	if (initPromise) return initPromise;
	initPromise = (async () => {
		const response = await fetch('../legal-boards.leb128');
		if (!response.ok) {
			throw new Error('failed to load legal boards: ' + response.statusText);
		}
		const legalBoards = new Uint8Array(await response.arrayBuffer());
		await wasm_bindgen('./pkg/gomen_bg.wasm');
		solver = new wasm_bindgen.Solver(legalBoards);
		return solver;
	})();
	try {
		return await initPromise;
	} catch (err) {
		initPromise = null;
		throw err;
	}
}

function buildQueue(spec) {
	const queue = new wasm_bindgen.Queue();
	const bag = /([ILJOSTZ])|\[([ILJOSTZ]+)\](\d*)|(\*)(\d*)/g;
	for (const match of spec.matchAll(bag)) {
		if (match[2]) {
			queue.add_bag(match[2], parseInt(match[3], 10) || 1);
		} else if (match[4]) {
			queue.add_bag('IJLOSTZ', parseInt(match[5], 10) || 1);
		} else {
			queue.add_shape(match[1]);
		}
	}
	return queue;
}

self.onmessage = async (event) => {
	const { kind, id, garbage, queue, hold, physics } = event.data || {};
	if (kind !== 'solve') return;
	try {
		await ensureInit();
		const raw = solver.solve(buildQueue(queue), BigInt(garbage), !!hold, physics || 'TETRIO');
		const solutions = raw.split(',');
		const list = solutions.length === 1 && solutions[0] === '' ? [] : solutions;
		self.postMessage({ kind: 'solved', id, count: list.length, solutions: list.slice(0, 3) });
	} catch (err) {
		self.postMessage({ kind: 'error', id, error: err.message });
	}
};

ensureInit()
	.then(() => self.postMessage({ kind: 'ready' }))
	.catch((err) => self.postMessage({ kind: 'error', error: err.message }));
