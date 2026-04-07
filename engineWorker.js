// engineWorker.js -- Background worker for running WASM engines without blocking UI

let engines = {
    fusion: { module: null, ready: false },
    falcon: { module: null, ready: false },
    coldClear: { module: null, ready: false }
};

self.onmessage = async function(e) {
    const { type, engineType, payload } = e.data;

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
            self.postMessage({ type: 'result', result });
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }
};

async function initEngine(engineType, baseUrl) {
    if (engines[engineType]?.ready) return;

    if (engineType === 'fusion') {
        const mod = await import(baseUrl + 'wasm/direct_cobra_copy.js');
        await mod.default();
        mod.init();
        engines.fusion.module = mod;
        engines.fusion.ready = true;
    } else if (engineType === 'falcon') {
        const mod = await import(baseUrl + 'wasm/falcon_2.js');
        await mod.default();
        mod.init_panic_hook();
        engines.falcon.module = mod;
        engines.falcon.ready = true;
    } else if (engineType === 'coldClear') {
        const mod = await import(baseUrl + 'wasm/cold_clear_2.js');
        await mod.default();
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
        const frame = { queue, hold: holdId };
        const res = find_best_move(board, pieceId, frame);
        return res ? {
            best_move: res,
            score: res.score,
            hold_used: res.hold_used,
            pv: [res]
        } : null;
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
