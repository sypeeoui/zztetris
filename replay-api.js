// TETR.IO replay API access for the replay viewer.
//
// TETRA CHANNEL only allows CORS from https://tetr.io, so the browser cannot
// call it directly. Requests go through the Tetra Stats bridge first and the
// same-origin PHP proxy (tetrio-proxy.php) as a fallback. Replay files come
// from the bridge, the proxy, or inoue.szy.lol, in that order.
(function (root) {
	'use strict';

	const BRIDGE = 'https://ts.dan63.by/oskware_bridge.php';
	const INOUE = 'https://inoue.szy.lol/api/replay/';
	const PROXY = 'tetrio-proxy.php';
	const USER_TTL = 5 * 60 * 1000;
	const RECORDS_TTL = 10 * 60 * 1000;
	const CACHE_PREFIX = 'zztetris_replay_api_';
	const GAMEMODES = new Set(['league', '40l', 'blitz']);

	function cacheKey(parts) {
		return CACHE_PREFIX + parts.join(':');
	}

	function cacheGet(key, ttl) {
		try {
			const raw = sessionStorage.getItem(key);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (!parsed || typeof parsed.ts !== 'number') return null;
			if (Date.now() - parsed.ts > ttl) {
				sessionStorage.removeItem(key);
				return null;
			}
			return parsed.data;
		} catch (error) {
			return null;
		}
	}

	function cacheSet(key, data) {
		try {
			sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
		} catch (error) {
			// Storage can be unavailable; the in-memory result still works.
		}
	}

	async function fetchText(url, timeoutMs = 20000) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetch(url, {
				signal: controller.signal,
				cache: 'no-store',
			});
			const text = await response.text();
			return { ok: response.ok, status: response.status, text };
		} finally {
			clearTimeout(timer);
		}
	}

	function parseJson(text) {
		try {
			return JSON.parse(text);
		} catch (error) {
			return null;
		}
	}

	function bridgeUrl(params) {
		const url = new URL(BRIDGE);
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}
		return url.toString();
	}

	function proxyUrl(params) {
		const url = new URL(PROXY, location.href);
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}
		return url.toString();
	}

	async function requestJson(primaryUrl, fallbackUrl) {
		const errors = [];
		let sawJson = false;
		for (const url of [primaryUrl, fallbackUrl]) {
			if (!url) continue;
			try {
				const { status, text } = await fetchText(url);
				const data = parseJson(text);
				if (data && typeof data === 'object') {
					sawJson = true;
					if (data.success === false) {
						const message =
							data.error?.msg ||
							(typeof data.error === 'string' ? data.error : '') ||
							'Request failed.';
						const error = new Error(String(message));
						error.status = status;
						error.api = true;
						// A 5xx from the bridge is worth retrying through the
						// proxy; a 4xx means the user or mode really is invalid.
						if (status >= 500) {
							errors.push(error.message);
							continue;
						}
						throw error;
					}
					return data;
				}
				errors.push(status >= 400 ? `HTTP ${status}` : 'unavailable');
			} catch (error) {
				if (error.api) throw error;
				errors.push(error.message || String(error));
			}
		}
		if (!sawJson) {
			throw new Error(
				'Could not reach the TETRA CHANNEL API. Check your connection and try again.'
			);
		}
		throw new Error(errors.join(' / ') || 'Request failed.');
	}

	async function getUser(username) {
		const name = String(username || '').trim().toLowerCase();
		if (!name) throw new Error('Enter a TETR.IO username.');
		const key = cacheKey(['user', name]);
		const cached = cacheGet(key, USER_TTL);
		if (cached) return cached;
		const data = await requestJson(
			bridgeUrl({ endpoint: 'tetrioUser', user: name }),
			proxyUrl({ action: 'user', user: name })
		);
		const user = data.data || data;
		if (!user || !user._id) throw new Error('User not found.');
		cacheSet(key, user);
		return user;
	}

	async function getRecent(username, gamemode) {
		const name = String(username || '').trim().toLowerCase();
		const mode = String(gamemode || '').toLowerCase();
		if (!GAMEMODES.has(mode)) throw new Error('Unsupported gamemode.');
		const key = cacheKey(['records', name, mode]);
		const cached = cacheGet(key, RECORDS_TTL);
		if (cached) return cached;
		const data = await requestJson(
			bridgeUrl({
				endpoint: 'singleplayerStream',
				user: name,
				stream: `${mode}/recent`,
			}),
			proxyUrl({ action: 'records', user: name, gamemode: mode })
		);
		const entries = Array.isArray(data.data?.entries) ? data.data.entries : [];
		// Stub records are old enough that TETR.IO usually no longer has the
		// replay file, so hide them instead of offering a dead link.
		const usable = entries.filter(
			(entry) => entry && entry.replayid && !entry.stub
		);
		cacheSet(key, usable);
		return usable;
	}

	async function getReplay(replayId) {
		const id = String(replayId || '').trim().toLowerCase();
		if (!/^[0-9a-f]{12,24}$/.test(id)) {
			throw new Error('Invalid replay ID.');
		}
		const urls = [
			bridgeUrl({ endpoint: 'tetrioReplay', replayid: id }),
			proxyUrl({ action: 'replay', id }),
			`${INOUE}${encodeURIComponent(id)}`,
		];
		const errors = [];
		for (const url of urls) {
			try {
				const { status, text } = await fetchText(url);
				const trimmed = text.trim();
				const parsed = parseJson(trimmed);
				if (parsed && (parsed.replay || parsed.data || parsed.id)) {
					return trimmed;
				}
				errors.push(`HTTP ${status}`);
			} catch (error) {
				errors.push(error.message || String(error));
			}
		}
		throw new Error(
			'Replay expired or unavailable. Try a more recent one.'
		);
	}

	function parseReplayId(input) {
		const text = String(input || '').trim();
		if (!text) return null;
		const match = text.match(/(?:[Rr]:)?([0-9a-f]{12,24})/i);
		return match ? match[1].toLowerCase() : null;
	}

	root.ZZReplayApi = {
		getUser,
		getRecent,
		getReplay,
		parseReplayId,
		GAMEMODES,
	};
})(typeof globalThis !== 'undefined' ? globalThis : this);
