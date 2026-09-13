// engineWorker.js -- Background worker for running WASM engines without blocking UI

let engines = {
    fusion: { module: null, ready: false },
    falcon: { module: null, ready: false },
    coldClear: { module: null, ready: false }
};

self.onmessage = async function(e) {
    const { type, engineType, payload, requestId } = e.data;

    if (type === 'init') {
        try {
            await initEngine(engineType, payload.baseUrl);
            self.postMessage({ type: 'init_ok', engineType });
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
        return;
    }

    if (type === 'find_best_move') {
        try {
            const result = await findBestMove(engineType, payload);
            self.postMessage({ type: 'result', result, requestId });
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message, requestId });
        }
        return;
    }

    if (type === 'load_legal_boards') {
        try {
            const count = await loadLegalBoards(payload.baseUrl, payload.url);
            self.postMessage({ type: 'legal_boards_loaded', count });
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }
};

let legalBoardsPromise = null;

// Fetch the precomputed perfect-clear database once and hand it to the engine.
// The table is only used to prune the PC search, so it is safe to load lazily.
async function loadLegalBoards(baseUrl, url) {
    if (legalBoardsPromise) return legalBoardsPromise;
    legalBoardsPromise = (async () => {
        await initEngine('fusion', baseUrl);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`failed to load legal boards: ${response.status}`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        return engines.fusion.module.load_legal_boards(bytes);
    })();
    try {
        return await legalBoardsPromise;
    } catch (err) {
        legalBoardsPromise = null;
        throw err;
    }
}

async function initEngine(engineType, baseUrl) {
    if (engines[engineType]?.ready) return;

    if (engineType === 'fusion') {
        const mod = await import(baseUrl + 'wasm/fusion_engine.js');
        // Pass an explicit, versioned wasm URL so a previously cached binary
        // cannot be paired with this updated glue/worker.
        await mod.default(baseUrl + 'wasm/fusion_engine_bg.wasm?v=2');
        mod.init();
        engines.fusion.module = mod;
        engines.fusion.ready = true;
    } else if (engineType === 'falcon') {
        const mod = await import(baseUrl + 'wasm/falcon_2.js');
        await mod.default(baseUrl + 'wasm/falcon_2_bg.wasm?v=4');
        mod.init_panic_hook();
        engines.falcon.module = mod;
        engines.falcon.ready = true;
    } else if (engineType === 'coldClear') {
        const mod = await import(baseUrl + 'wasm/cold_clear_2.js');
        await mod.default(baseUrl + 'wasm/cold_clear_2_bg.wasm?v=4');
        mod.init_panic_hook();
        engines.coldClear.module = mod;
        engines.coldClear.ready = true;
    }
}

async function findBestMove(engineType, payload) {
    const { rows, pieceId, queue, holdId, overrides } = payload;

    if (engineType === 'fusion') {
        const { JsBoard, find_best_move } = engines.fusion.module;
        const board = JsBoard.from_rows(new BigUint64Array(rows.map(BigInt)));
        const frame = { 
            queue, 
            hold: holdId,
            b2b: overrides.b2b,
            combo: overrides.combo,
            pending_garbage: overrides.pending_garbage,
            search: overrides
        };
        const res = find_best_move(board, pieceId, frame);
        // Fusion now returns { best_move, pv, score, hold_used } so the full
        // principal variation (the whole PC route in pc_mode) reaches the UI.
        return res || null;
    } 
    
    if (engineType === 'falcon') {
        const { find_best_move } = engines.falcon.module;
        const res = find_best_move(
            new BigUint64Array(rows.map(BigInt)),
            pieceId,
            new Uint8Array(queue),
            holdId === null ? undefined : holdId,
            overrides.b2b,
            overrides.combo,
            overrides.depth,
            overrides.beam_width,
            overrides.weights
        );
        return res;
    }

    if (engineType === 'coldClear') {
        const { find_best_move } = engines.coldClear.module;
        const res = find_best_move(
            new BigUint64Array(rows.map(BigInt)),
            pieceId,
            new Uint8Array(queue),
            holdId === null ? undefined : holdId,
            overrides.b2b > 0,
            Math.max(0, overrides.combo),
            overrides.nodes || 500
        );
        return res;
    }

    throw new Error(`Unknown engine type: ${engineType}`);
}
