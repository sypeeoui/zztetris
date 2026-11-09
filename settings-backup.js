// Group-based settings backup for the settings popup.
//
// A backup contains only the groups the user selected. Importing a backup
// applies only the groups the user checks, and keeps fields that are absent
// from the file (or belong to other groups) untouched.
(function (root) {
	'use strict';

	const CONFIG_VERSION = '2023-05-02a';
	const TYPE = 'zztetris-settings';
	const VERSION = 1;

	// Layout: 11 keybinds, 5 handling values, 3 reset keybinds.
	const DEFAULT_CONFIG = [
		'ArrowLeft',
		'ArrowRight',
		'ArrowDown',
		'Space',
		'ShiftLeft',
		'KeyX',
		'KeyZ',
		'KeyC',
		'KeyR',
		'KeyT',
		'KeyY',
		'160',
		'30',
		'15',
		'20',
		'100',
		'KeyO',
		'KeyU',
		'KeyI',
	];

	const GROUPS = [
		{ id: 'controls', label: 'Controls', description: 'Keyboard shortcuts' },
		{
			id: 'handling',
			label: 'Handling & Audio',
			description: 'DAS, ARR, SDR, cell size and audio level',
		},
		{
			id: 'sessionStats',
			label: 'Session Stats',
			description: 'Session panel, visible stats and finesse options',
		},
		{
			id: 'practiceGarbage',
			label: 'Practice Garbage',
			description: 'Garbage layers and the attack simulator',
		},
		{
			id: 'practiceGravity',
			label: 'Practice Gravity',
			description: 'Gravity, lock hold and auto lock',
		},
	];

	const DEFAULT_ATTACK_SIM = {
		enabled: false,
		apm: 30,
		messiness: 0,
		timeRandom: 0,
		sizeRandom: 0,
		holeMessiness: 0,
	};

	const DEFAULT_AUTO_LOCK = {
		enabled: false,
		delayMs: 500,
		resets: 15,
		infinite: false,
	};

	const HANDLING_FIELDS = [
		['das', 11, 0, 750],
		['arr', 12, 0, 500],
		['sdr', 13, 0, 250],
		['cellSize', 14, 3, 100],
		['audioLevel', 15, 0, 100],
	];

	function isObject(value) {
		return !!value && typeof value === 'object' && !Array.isArray(value);
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function validNumber(value, min, max) {
		const number = Number(value);
		if (!Number.isFinite(number)) return undefined;
		return clamp(number, min, max);
	}

	function validBoolean(value) {
		if (value === true || value === false) return value;
		return undefined;
	}

	function sanitizeBinding(value) {
		if (typeof value !== 'string') return undefined;
		const trimmed = value.trim();
		if (!trimmed || trimmed.length > 80) return undefined;
		if (root.ZZKeybinds) {
			const parsed = root.ZZKeybinds.parse(trimmed);
			return parsed || undefined;
		}
		return trimmed;
	}

	function sanitizeBindingList(value, length, seen) {
		if (!Array.isArray(value)) return undefined;
		const result = [];
		let valid = false;
		for (let i = 0; i < length; i++) {
			const binding = sanitizeBinding(value[i]);
			if (!binding || (seen && seen.has(binding))) {
				result.push(null);
				continue;
			}
			if (seen) seen.add(binding);
			result.push(binding);
			valid = true;
		}
		return valid ? result : undefined;
	}

	function readStoredJson(key) {
		try {
			const raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : null;
		} catch (error) {
			return null;
		}
	}

	function writeStoredJson(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch (error) {
			// Storage can be unavailable in private mode.
		}
	}

	// Read the effective config. A config with an outdated version is ignored
	// by the game, so defaults are the effective values in that case.
	function getConfigArray() {
		const config = DEFAULT_CONFIG.slice();
		try {
			if (localStorage.getItem('version') !== CONFIG_VERSION) return config;
			const stored = JSON.parse(localStorage.getItem('config') || 'null');
			if (!Array.isArray(stored)) return config;
			for (let i = 0; i < config.length; i++) {
				if (stored[i] !== undefined && stored[i] !== null && stored[i] !== '') {
					config[i] = stored[i];
				}
			}
		} catch (error) {
			// Use defaults.
		}
		return config;
	}

	function writeConfigArray(config) {
		try {
			localStorage.setItem('config', JSON.stringify(config));
			localStorage.setItem('version', CONFIG_VERSION);
		} catch (error) {
			// Storage can be unavailable in private mode.
		}
	}

	function readHoldLock() {
		try {
			return localStorage.getItem(root.ZZPracticeSettings?.STORAGE_KEYS?.holdLock || 'zztetris_hold_lock_v1') === '1';
		} catch (error) {
			return false;
		}
	}

	function writeHoldLock(value) {
		try {
			localStorage.setItem(
				root.ZZPracticeSettings?.STORAGE_KEYS?.holdLock || 'zztetris_hold_lock_v1',
				value ? '1' : '0'
			);
		} catch (error) {
			// Storage can be unavailable in private mode.
		}
	}

	function normalizeAttackSimulator(value, complete = false) {
		const saved = isObject(value) ? value : {};
		const result = {};
		const booleanFields = ['enabled'];
		const numberFields = [
			['apm', 0, 300],
			['messiness', 0, 100],
			['timeRandom', 0, 100],
			['sizeRandom', 0, 100],
			['holeMessiness', 0, 100],
		];

		for (const field of booleanFields) {
			const parsed = validBoolean(saved[field]);
			if (parsed !== undefined) result[field] = parsed;
			else if (complete) result[field] = DEFAULT_ATTACK_SIM[field];
		}
		for (const [field, min, max] of numberFields) {
			const parsed = validNumber(saved[field], min, max);
			if (parsed !== undefined) result[field] = parsed;
			else if (complete) result[field] = DEFAULT_ATTACK_SIM[field];
		}
		if (!complete) return Object.keys(result).length ? result : undefined;
		return Object.assign({}, DEFAULT_ATTACK_SIM, result);
	}

	function normalizeAutoLock(value, complete = false) {
		const saved = isObject(value) ? value : {};
		const result = {};
		const booleanFields = ['enabled', 'infinite'];
		const numberFields = [
			['delayMs', 0, 2000],
			['resets', 0, 100],
		];

		for (const field of booleanFields) {
			const parsed = validBoolean(saved[field]);
			if (parsed !== undefined) result[field] = parsed;
			else if (complete) result[field] = DEFAULT_AUTO_LOCK[field];
		}
		for (const [field, min, max] of numberFields) {
			const parsed = validNumber(saved[field], min, max);
			if (parsed !== undefined) result[field] = parsed;
			else if (complete) result[field] = DEFAULT_AUTO_LOCK[field];
		}
		if (!complete) return Object.keys(result).length ? result : undefined;
		return Object.assign({}, DEFAULT_AUTO_LOCK, result);
	}

	function collectControls() {
		const config = getConfigArray();
		const keybinds = [];
		const reset = [];
		for (let i = 0; i < 11; i++) {
			keybinds.push(sanitizeBinding(config[i]) || DEFAULT_CONFIG[i]);
		}
		for (let i = 16; i < 19; i++) {
			reset.push(sanitizeBinding(config[i]) || DEFAULT_CONFIG[i]);
		}
		return { keybinds, reset };
	}

	function collectHandling() {
		const config = getConfigArray();
		const result = {};
		for (const [field, index, min, max] of HANDLING_FIELDS) {
			const fallback = Number(DEFAULT_CONFIG[index]);
			const parsed = validNumber(config[index], min, max);
			result[field] = parsed === undefined ? fallback : Math.round(parsed);
		}
		return result;
	}

	function collectSessionStats() {
		const config = root.ZZStatsConfig.loadConfig();
		return {
			showPanel: !!config.showPanel,
			finesseSound: !!config.finesseSound,
			finesseSoundName: String(config.finesseSoundName || 'FinesseFault'),
			exemptSpins: !!config.exemptSpins,
			visibleStats: config.visibleStats.slice(),
		};
	}

	function collectPracticeGarbage() {
		const settings = root.ZZPracticeSettings.loadGarbage();
		const attackSim = normalizeAttackSimulator(
			readStoredJson(root.ZZPracticeSettings.STORAGE_KEYS.attackSim),
			true
		);
		return {
			layers: settings.layers,
			messiness: settings.messiness,
			permanent: settings.permanent,
			attackSimulator: attackSim,
		};
	}

	function collectPracticeGravity() {
		const settings = root.ZZPracticeSettings.loadGravity();
		const autoLock = normalizeAutoLock(
			readStoredJson(root.ZZPracticeSettings.STORAGE_KEYS.autoLock),
			true
		);
		return {
			gravityMs: settings.gravityMs,
			holdLock: readHoldLock(),
			autoLock,
		};
	}

	const COLLECTORS = {
		controls: collectControls,
		handling: collectHandling,
		sessionStats: collectSessionStats,
		practiceGarbage: collectPracticeGarbage,
		practiceGravity: collectPracticeGravity,
	};

	function sanitizeControls(value) {
		const seen = new Set();
		if (Array.isArray(value)) {
			const keybinds = sanitizeBindingList(value.slice(0, 11), 11, seen);
			const reset = sanitizeBindingList(value.slice(16, 19), 3, seen);
			if (!keybinds && !reset) return undefined;
			return { keybinds, reset };
		}
		if (!isObject(value)) return undefined;
		const keybinds = sanitizeBindingList(value.keybinds, 11, seen);
		const reset = sanitizeBindingList(value.reset, 3, seen);
		if (!keybinds && !reset) return undefined;
		return { keybinds, reset };
	}

	function sanitizeHandling(value) {
		const result = {};
		if (Array.isArray(value)) {
			for (const [field, index, min, max] of HANDLING_FIELDS) {
				const parsed = validNumber(value[index], min, max);
				if (parsed !== undefined) result[field] = Math.round(parsed);
			}
		} else if (isObject(value)) {
			for (const [field, , min, max] of HANDLING_FIELDS) {
				const parsed = validNumber(value[field], min, max);
				if (parsed !== undefined) result[field] = Math.round(parsed);
			}
		}
		return Object.keys(result).length ? result : undefined;
	}

	function sanitizeSessionStats(value) {
		if (!isObject(value)) return undefined;
		const result = {};
		for (const field of ['showPanel', 'finesseSound', 'exemptSpins']) {
			const parsed = validBoolean(value[field]);
			if (parsed !== undefined) result[field] = parsed;
		}
		if (typeof value.finesseSoundName === 'string') {
			const allowed = new Set(root.ZZStatsConfig.SOUND_OPTIONS.map((option) => option.value));
			if (allowed.has(value.finesseSoundName)) {
				result.finesseSoundName = value.finesseSoundName;
			}
		}
		if (Array.isArray(value.visibleStats)) {
			const known = new Set(root.ZZStatsConfig.knownStatIds());
			const seen = new Set();
			result.visibleStats = [];
			for (const id of value.visibleStats) {
				if (typeof id !== 'string' || !known.has(id) || seen.has(id)) continue;
				seen.add(id);
				result.visibleStats.push(id);
				if (result.visibleStats.length >= 200) break;
			}
		}
		return Object.keys(result).length ? result : undefined;
	}

	function sanitizePracticeGarbage(value) {
		if (!isObject(value)) return undefined;
		const result = {};
		const layers = validNumber(value.layers, 1, 20);
		if (layers !== undefined) result.layers = Math.round(layers);
		const messiness = validNumber(value.messiness, 0, 100);
		if (messiness !== undefined) result.messiness = Math.round(messiness);
		const permanent = validBoolean(value.permanent);
		if (permanent !== undefined) result.permanent = permanent;
		const attackSim = normalizeAttackSimulator(value.attackSimulator);
		if (attackSim) result.attackSimulator = attackSim;
		return Object.keys(result).length ? result : undefined;
	}

	function sanitizePracticeGravity(value) {
		if (!isObject(value)) return undefined;
		const result = {};
		const gravityMs = validNumber(value.gravityMs, 0, 10000);
		if (gravityMs !== undefined) result.gravityMs = Math.round(gravityMs);
		const holdLock = validBoolean(value.holdLock);
		if (holdLock !== undefined) result.holdLock = holdLock;
		const autoLock = normalizeAutoLock(value.autoLock);
		if (autoLock) result.autoLock = autoLock;
		return Object.keys(result).length ? result : undefined;
	}

	const SANITIZERS = {
		controls: sanitizeControls,
		handling: sanitizeHandling,
		sessionStats: sanitizeSessionStats,
		practiceGarbage: sanitizePracticeGarbage,
		practiceGravity: sanitizePracticeGravity,
	};

	function buildBackup(groupIds) {
		const groups = {};
		const selected = new Set(groupIds);
		for (const definition of GROUPS) {
			if (!selected.has(definition.id)) continue;
			if (COLLECTORS[definition.id]) groups[definition.id] = COLLECTORS[definition.id]();
		}
		if (!Object.keys(groups).length) {
			throw new Error('Select at least one settings group to export.');
		}
		return {
			app: 'zztetris',
			type: TYPE,
			version: VERSION,
			exportedAt: new Date().toISOString(),
			groups,
		};
	}

	function inspectBackup(input) {
		let data = input;
		if (typeof input === 'string') {
			try {
				data = JSON.parse(input);
			} catch (error) {
				return { error: 'That text is not valid JSON.' };
			}
		}
		if (!isObject(data)) {
			return { error: 'That backup does not contain a settings object.' };
		}

		const source = isObject(data.groups) ? data.groups : data;
		const groups = [];
		const invalid = [];
		for (const definition of GROUPS) {
			if (!Object.prototype.hasOwnProperty.call(source, definition.id)) continue;
			const sanitizer = SANITIZERS[definition.id];
			let payload;
			try {
				payload = sanitizer ? sanitizer(source[definition.id]) : undefined;
			} catch (error) {
				payload = undefined;
			}
			if (!payload) {
				invalid.push(definition.label);
				continue;
			}
			groups.push({ id: definition.id, label: definition.label, payload });
		}

		if (!groups.length) {
			return {
				error: 'No supported settings groups were found in that backup.',
				invalid,
			};
		}
		return { groups, invalid };
	}

	function applyControls(payload) {
		const config = getConfigArray();
		if (payload.keybinds) {
			for (let i = 0; i < 11; i++) {
				if (payload.keybinds[i]) config[i] = payload.keybinds[i];
			}
		}
		if (payload.reset) {
			for (let i = 0; i < 3; i++) {
				if (payload.reset[i]) config[16 + i] = payload.reset[i];
			}
		}
		writeConfigArray(config);
	}

	function applyHandling(payload) {
		const config = getConfigArray();
		for (const [field, index] of HANDLING_FIELDS) {
			if (payload[field] !== undefined) config[index] = String(payload[field]);
		}
		writeConfigArray(config);
	}

	function applySessionStats(payload) {
		const current = root.ZZStatsConfig.loadConfig();
		const merged = {
			showPanel: payload.showPanel !== undefined ? payload.showPanel : current.showPanel,
			finesseSound:
				payload.finesseSound !== undefined ? payload.finesseSound : current.finesseSound,
			finesseSoundName:
				payload.finesseSoundName !== undefined
					? payload.finesseSoundName
					: current.finesseSoundName,
			exemptSpins:
				payload.exemptSpins !== undefined ? payload.exemptSpins : current.exemptSpins,
			visibleStats:
				payload.visibleStats !== undefined ? payload.visibleStats : current.visibleStats,
		};
		root.ZZStatsConfig.saveConfig(merged);
	}

	function applyPracticeGarbage(payload) {
		const settings = root.ZZPracticeSettings;
		const current = settings.loadGarbage();
		settings.saveGarbage({
			layers: payload.layers !== undefined ? payload.layers : current.layers,
			messiness: payload.messiness !== undefined ? payload.messiness : current.messiness,
			permanent: payload.permanent !== undefined ? payload.permanent : current.permanent,
		});

		if (payload.attackSimulator) {
			const key = settings.STORAGE_KEYS.attackSim;
			const currentAttack = normalizeAttackSimulator(readStoredJson(key), true);
			writeStoredJson(
				key,
				Object.assign({}, currentAttack, payload.attackSimulator)
			);
		}
	}

	function applyPracticeGravity(payload) {
		const settings = root.ZZPracticeSettings;
		if (payload.gravityMs !== undefined) {
			settings.saveGravity({ gravityMs: payload.gravityMs });
		}
		if (payload.holdLock !== undefined) writeHoldLock(payload.holdLock);
		if (payload.autoLock) {
			const key = settings.STORAGE_KEYS.autoLock;
			const current = normalizeAutoLock(readStoredJson(key), true);
			writeStoredJson(key, Object.assign({}, current, payload.autoLock));
		}
	}

	const APPLIERS = {
		controls: applyControls,
		handling: applyHandling,
		sessionStats: applySessionStats,
		practiceGarbage: applyPracticeGarbage,
		practiceGravity: applyPracticeGravity,
	};

	function applyBackup(groups, selectedIds) {
		const selected = new Set(selectedIds);
		const applied = [];
		const errors = [];
		for (const group of groups) {
			if (!selected.has(group.id) || !APPLIERS[group.id]) continue;
			try {
				APPLIERS[group.id](group.payload);
				applied.push(group.label);
			} catch (error) {
				errors.push(`${group.label}: ${error.message || error}`);
			}
		}
		return { applied, errors };
	}

	function resetAll() {
		const settings = root.ZZPracticeSettings;
		const keys = [
			'config',
			'version',
			root.ZZStatsConfig.STORAGE_KEY,
			settings.STORAGE_KEYS.garbage,
			settings.STORAGE_KEYS.attackSim,
			settings.STORAGE_KEYS.gravity,
			settings.STORAGE_KEYS.autoLock,
			settings.STORAGE_KEYS.holdLock,
		];
		for (const key of keys) {
			try {
				localStorage.removeItem(key);
			} catch (error) {
				// Storage can be unavailable in private mode.
			}
		}
	}

	root.ZZSettingsBackup = {
		GROUPS,
		buildBackup,
		inspectBackup,
		applyBackup,
		resetAll,
	};
})(typeof globalThis !== 'undefined' ? globalThis : this);
