// Background worker for the 4-wide combo engine. The engine is pure JS; the
// worker keeps the survival DP off the main thread.
importScripts('./fourwide-core.js?v=d44e9dcc');

self.onmessage = function (event) {
	const data = event.data || {};
	if (data.type !== 'analyze') return;
	try {
		const result = self.FourWideEngine.analyze(data.payload || {});
		self.postMessage({ type: 'result', result, requestId: data.requestId });
	} catch (error) {
		self.postMessage({
			type: 'error',
			error: error && error.message ? error.message : String(error),
			requestId: data.requestId,
		});
	}
};
