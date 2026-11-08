// Shared session-stat definitions and persisted configuration.
// Loaded by both the game (index.html) and the settings popup (controls.html).
(function (root, factory) {
	'use strict';
	const api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	root.ZZStatsConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
	'use strict';

	const STORAGE_KEY = 'zztetris_stats_config';

	// `format` is interpreted by stats-core.js:
	//   time     -> m:ss / h:mm:ss
	//   int      -> integer
	//   float2   -> two decimals
	//   float3   -> three decimals
	//   percent2 -> two decimals with a % suffix
	const STAT_DEFS = [
		{ id: 'time', label: 'Time', group: 'General', format: 'time' },
		{ id: 'pieces', label: 'Pieces', group: 'General', format: 'int' },
		{ id: 'lines', label: 'Lines', group: 'General', format: 'int' },
		{ id: 'attack', label: 'Attack', group: 'General', format: 'int' },
		{ id: 'holds', label: 'Holds', group: 'General', format: 'int' },
		{ id: 'keys', label: 'Keys', group: 'General', format: 'int' },

		{ id: 'pps', label: 'PPS', group: 'Speed', format: 'float2' },
		{ id: 'lpm', label: 'LPM', group: 'Speed', format: 'float2' },
		{ id: 'kpp', label: 'KPP', group: 'Speed', format: 'float2' },

		{ id: 'apm', label: 'APM', group: 'Attack', format: 'float2' },
		{ id: 'vs', label: 'VS', group: 'Attack', format: 'float2' },
		{ id: 'app', label: 'APP', group: 'Attack', format: 'float2' },
		{ id: 'surge', label: 'Surge', group: 'Attack', format: 'int' },

		// TETR.IO / Tetra Stats garbage and downstack metrics.
		{ id: 'garbageSent', label: 'Garbage Sent', group: 'Garbage', format: 'int' },
		{ id: 'garbageReceived', label: 'Garbage Received', group: 'Garbage', format: 'int' },
		{ id: 'garbageCleared', label: 'Garbage Cleared', group: 'Garbage', format: 'int' },
		{ id: 'downstackPerSecond', label: 'DS/S (Downstack/sec)', group: 'Garbage', format: 'float2' },
		{ id: 'downstackPerPiece', label: 'DS/P (Downstack/piece)', group: 'Garbage', format: 'float2' },
		{ id: 'garbageEfficiency', label: 'GbE (Garbage Eff.)', group: 'Garbage', format: 'float2' },
		{ id: 'cheeseIndex', label: 'Cheese Index', group: 'Garbage', format: 'float2' },
		{ id: 'vsApm', label: 'VS/APM', group: 'Garbage', format: 'float2' },
		{ id: 'appDsP', label: 'APP + DS/P', group: 'Garbage', format: 'float2' },
		{ id: 'wapp', label: 'wAPP', group: 'Garbage', format: 'float2' },

		{ id: 'finesse', label: 'Finesse', group: 'Finesse', format: 'percent2' },
		{ id: 'finesseFaults', label: 'Faults', group: 'Finesse', format: 'int' },
		{ id: 'faultsPerPiece', label: 'Faults/Piece', group: 'Finesse', format: 'float3' },
		{ id: 'perfectPieces', label: 'Perfect Pieces', group: 'Finesse', format: 'int' },
		{ id: 'faultyPieces', label: 'Faulty Pieces', group: 'Finesse', format: 'int' },

		{ id: 'combo', label: 'Combo', group: 'Chain', format: 'int' },
		{ id: 'b2b', label: 'B2B', group: 'Chain', format: 'int' },
		{ id: 'maxCombo', label: 'Max Combo', group: 'Chain', format: 'int' },
		{ id: 'maxB2B', label: 'Max B2B', group: 'Chain', format: 'int' },

		{ id: 'singles', label: 'Singles', group: 'Clears', format: 'int' },
		{ id: 'doubles', label: 'Doubles', group: 'Clears', format: 'int' },
		{ id: 'triples', label: 'Triples', group: 'Clears', format: 'int' },
		{ id: 'quads', label: 'Quads', group: 'Clears', format: 'int' },
		{ id: 'tspins', label: 'T-Spins', group: 'Clears', format: 'int' },
		{ id: 'miniTspins', label: 'Mini T-Spins', group: 'Clears', format: 'int' },
		{ id: 'allspins', label: 'All-Spins', group: 'Clears', format: 'int' },
		{ id: 'perfectClears', label: 'Perfect Clears', group: 'Clears', format: 'int' },

		{ id: 'tspinEfficiency', label: 'T-Spin Eff.', group: 'Efficiency', format: 'percent2' },
		{ id: 'allspinEfficiency', label: 'All-Spin Eff.', group: 'Efficiency', format: 'percent2' },
		{ id: 'quadEfficiency', label: 'Quad Eff.', group: 'Efficiency', format: 'percent2' },
		{ id: 'b2bEfficiency', label: 'B2B Share', group: 'Efficiency', format: 'percent2' },
		{ id: 'comboEfficiency', label: 'Combo Share', group: 'Efficiency', format: 'percent2' },
		{ id: 'pcEfficiency', label: 'PC Share', group: 'Efficiency', format: 'percent2' },
		{ id: 'surgeEfficiency', label: 'Surge Share', group: 'Efficiency', format: 'percent2' },
		{ id: 'clearEfficiency', label: 'Lines/Piece', group: 'Efficiency', format: 'float2' },
		{ id: 'piecesPerLine', label: 'Pieces/Line', group: 'Efficiency', format: 'float2' },
		{ id: 'holdsPerPiece', label: 'Holds/Piece', group: 'Efficiency', format: 'float2' },
		{ id: 'area', label: 'Area (Tetra Stats)', group: 'Efficiency', format: 'float2' },
	];

	const DEFAULT_VISIBLE = [
		'time',
		'pieces',
		'lines',
		'pps',
		'apm',
		'vs',
		'app',
		'finesse',
		'finesseFaults',
		'maxCombo',
		'maxB2B',
		'attack',
		'quads',
		'tspins',
		'perfectClears',
	];

	const DEFAULT_CONFIG = {
		showPanel: true,
		finesseSound: true,
		finesseSoundName: 'FinesseFault',
		exemptSpins: false,
		visibleStats: DEFAULT_VISIBLE.slice(),
	};

	const SOUND_OPTIONS = [
		{ value: 'FinesseFault', label: 'Finesse Fault (soft blip)' },
		{ value: 'SoftDrop', label: 'Soft Drop' },
		{ value: 'Move', label: 'Move' },
		{ value: 'GarbageLight', label: 'Garbage Light' },
		{ value: 'SlowDown', label: 'Slow Down' },
		{ value: 'Rotate', label: 'Rotate' },
		{ value: 'Hold', label: 'Hold' },
		{ value: 'TSpin1', label: 'T-Spin' },
	];

	function knownStatIds() {
		return STAT_DEFS.map((def) => def.id);
	}

	function loadConfig() {
		let stored = {};
		try {
			stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
		} catch (error) {
			stored = {};
		}

		const config = Object.assign({}, DEFAULT_CONFIG, stored);
		if (!Array.isArray(config.visibleStats)) {
			config.visibleStats = DEFAULT_VISIBLE.slice();
		}
		const known = new Set(knownStatIds());
		config.visibleStats = config.visibleStats.filter((id) => known.has(id));
		if (!config.finesseSoundName) config.finesseSoundName = DEFAULT_CONFIG.finesseSoundName;
		config.showPanel = config.showPanel !== false;
		config.finesseSound = config.finesseSound !== false;
		config.exemptSpins = config.exemptSpins === true;
		return config;
	}

	function saveConfig(config) {
		const payload = {
			showPanel: config.showPanel !== false,
			finesseSound: config.finesseSound !== false,
			finesseSoundName: config.finesseSoundName || DEFAULT_CONFIG.finesseSoundName,
			exemptSpins: config.exemptSpins === true,
			visibleStats: Array.isArray(config.visibleStats)
				? config.visibleStats.filter((id) => knownStatIds().includes(id))
				: DEFAULT_VISIBLE.slice(),
		};
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
		} catch (error) {
			// Storage can be unavailable (private mode); the in-memory config still works.
		}
		return payload;
	}

	return {
		STORAGE_KEY,
		STAT_DEFS,
		DEFAULT_VISIBLE,
		DEFAULT_CONFIG,
		SOUND_OPTIONS,
		knownStatIds,
		loadConfig,
		saveConfig,
	};
});
