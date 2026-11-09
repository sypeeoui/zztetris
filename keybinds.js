// Shared keyboard shortcut parsing for the game and the settings popup.
//
// Bindings are stored as canonical strings:
//   - a plain key uses its KeyboardEvent.code, e.g. "KeyZ", "ArrowLeft";
//   - a chord adds modifiers in Ctrl+Alt+Shift+Meta order, e.g. "Ctrl+KeyZ".
// A bare modifier key is stored as its left/right code, e.g. "ShiftLeft".
(function (root) {
	'use strict';

	const MODIFIER_ORDER = ['Ctrl', 'Alt', 'Shift', 'Meta'];
	const MODIFIER_CODES = new Set([
		'ControlLeft',
		'ControlRight',
		'ShiftLeft',
		'ShiftRight',
		'AltLeft',
		'AltRight',
		'MetaLeft',
		'MetaRight',
		'OSLeft',
		'OSRight',
	]);

	const CODE_DISPLAY = {
		ArrowLeft: '←',
		ArrowRight: '→',
		ArrowUp: '↑',
		ArrowDown: '↓',
		Space: 'Space',
		Enter: 'Enter',
		NumpadEnter: 'Num Enter',
		Escape: 'Esc',
		Tab: 'Tab',
		Backspace: 'Backspace',
		Delete: 'Delete',
		Insert: 'Insert',
		Home: 'Home',
		End: 'End',
		PageUp: 'PageUp',
		PageDown: 'PageDown',
		Minus: '-',
		Equal: '=',
		Comma: ',',
		Period: '.',
		Slash: '/',
		Semicolon: ';',
		Quote: "'",
		Backquote: '`',
		BracketLeft: '[',
		BracketRight: ']',
		Backslash: '\\',
		ShiftLeft: 'Shift L',
		ShiftRight: 'Shift R',
		ControlLeft: 'Ctrl L',
		ControlRight: 'Ctrl R',
		AltLeft: 'Alt L',
		AltRight: 'Alt R',
		MetaLeft: 'Meta L',
		MetaRight: 'Meta R',
		OSLeft: 'Meta L',
		OSRight: 'Meta R',
	};

	const KEY_ALIASES = {
		shift: 'ShiftLeft',
		control: 'ControlLeft',
		ctrl: 'ControlLeft',
		alt: 'AltLeft',
		option: 'AltLeft',
		meta: 'MetaLeft',
		cmd: 'MetaLeft',
		command: 'MetaLeft',
		win: 'MetaLeft',
		super: 'MetaLeft',
		space: 'Space',
		spacebar: 'Space',
		esc: 'Escape',
		escape: 'Escape',
		enter: 'Enter',
		return: 'Enter',
		tab: 'Tab',
		backspace: 'Backspace',
		del: 'Delete',
		delete: 'Delete',
		insert: 'Insert',
		home: 'Home',
		end: 'End',
		pageup: 'PageUp',
		pagedown: 'PageDown',
		up: 'ArrowUp',
		down: 'ArrowDown',
		left: 'ArrowLeft',
		right: 'ArrowRight',
		arrowup: 'ArrowUp',
		arrowdown: 'ArrowDown',
		arrowleft: 'ArrowLeft',
		arrowright: 'ArrowRight',
	};

	function modifierFromToken(token) {
		switch (String(token || '').toLowerCase()) {
			case 'ctrl':
			case 'control':
				return 'Ctrl';
			case 'alt':
			case 'option':
			case 'opt':
				return 'Alt';
			case 'shift':
				return 'Shift';
			case 'meta':
			case 'cmd':
			case 'command':
			case 'win':
			case 'super':
			case 'os':
				return 'Meta';
			default:
				return '';
		}
	}

	function normalizeBaseKey(value) {
		if (typeof value !== 'string') return '';
		const raw = value.trim();
		if (!raw) return '';
		const lower = raw.toLowerCase();
		if (KEY_ALIASES[lower]) return KEY_ALIASES[lower];

		// A single printable character is accepted for older configs.
		if (/^[a-z]$/.test(lower)) return 'Key' + lower.toUpperCase();
		if (/^[0-9]$/.test(lower)) return 'Digit' + lower;

		// Normalize code-like strings without changing their meaning.
		if (/^key[a-z]$/i.test(raw)) return 'Key' + raw.slice(3).toUpperCase();
		if (/^digit[0-9]$/i.test(raw)) return 'Digit' + raw.slice(5);
		if (/^numpad[0-9]$/i.test(raw)) return 'Numpad' + raw.slice(6);
		if (/^arrow(up|down|left|right)$/i.test(raw)) {
			return 'Arrow' + raw.slice(5).replace(/^./, (c) => c.toUpperCase());
		}
		if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(raw)) return raw.toUpperCase();
		if (/^(control|shift|alt|meta|os)(left|right)$/i.test(raw)) {
			const match = raw.match(/^(control|shift|alt|meta|os)(left|right)$/i);
			const base = match[1].toLowerCase();
			const side = match[2].toLowerCase();
			if (base === 'control') return 'Control' + (side === 'left' ? 'Left' : 'Right');
			if (base === 'os') return 'Meta' + (side === 'left' ? 'Left' : 'Right');
			return base.charAt(0).toUpperCase() + base.slice(1) + (side === 'left' ? 'Left' : 'Right');
		}
		return raw;
	}

	function parseParts(binding) {
		if (typeof binding !== 'string') return null;
		const raw = binding.trim();
		if (!raw) return null;
		const tokens = raw.split('+').map((part) => part.trim()).filter(Boolean);
		if (!tokens.length) return null;

		const mods = new Set();
		for (let i = 0; i < tokens.length - 1; i++) {
			const modifier = modifierFromToken(tokens[i]);
			if (!modifier) return null;
			mods.add(modifier);
		}

		// The last token is always the base key. "Ctrl+Shift" therefore means
		// holding Ctrl and pressing the Shift key, while "Shift" alone binds
		// the Shift key itself.
		const base = normalizeBaseKey(tokens[tokens.length - 1]);
		if (!base) return null;
		return { mods, base };
	}

	function parse(binding) {
		const parts = parseParts(binding);
		if (!parts) return '';
		const ordered = MODIFIER_ORDER.filter((modifier) => parts.mods.has(modifier));
		return ordered.concat(parts.base).join('+');
	}

	function isModifierCode(code) {
		return MODIFIER_CODES.has(code);
	}

	function fromEvent(event) {
		if (!event) return '';
		const code = normalizeBaseKey(event.code || '');
		if (!code) return '';
		const mods = [];
		if (event.ctrlKey && !/^Control(Left|Right)$/.test(code)) mods.push('Ctrl');
		if (event.altKey && !/^Alt(Left|Right)$/.test(code)) mods.push('Alt');
		if (event.shiftKey && !/^Shift(Left|Right)$/.test(code)) mods.push('Shift');
		if (event.metaKey && !/^(Meta|OS)(Left|Right)$/.test(code)) mods.push('Meta');
		return mods.concat(code).join('+');
	}

	function modifiersSatisfied(binding, event) {
		const parts = parseParts(binding);
		if (!parts || !event) return false;
		const code = event.code || '';
		// Treat the modifier key currently being released as no longer down.
		// Some browsers keep the flag set on the keyup event of that key.
		const ctrlDown = /^Control(Left|Right)$/.test(code) ? false : !!event.ctrlKey;
		const altDown = /^Alt(Left|Right)$/.test(code) ? false : !!event.altKey;
		const shiftDown = /^Shift(Left|Right)$/.test(code) ? false : !!event.shiftKey;
		const metaDown = /^(Meta|OS)(Left|Right)$/.test(code) ? false : !!event.metaKey;
		return (
			parts.mods.has('Ctrl') === ctrlDown &&
			parts.mods.has('Alt') === altDown &&
			parts.mods.has('Shift') === shiftDown &&
			parts.mods.has('Meta') === metaDown
		);
	}

	function matches(binding, event) {
		const canonical = parse(binding);
		return !!canonical && canonical === fromEvent(event);
	}

	function formatCode(code) {
		if (CODE_DISPLAY[code]) return CODE_DISPLAY[code];
		if (/^Key[A-Z]$/.test(code)) return code.slice(3);
		if (/^Digit[0-9]$/.test(code)) return code.slice(5);
		if (/^Numpad[0-9]$/.test(code)) return 'Num ' + code.slice(6);
		return code;
	}

	function format(binding) {
		const parts = parseParts(binding);
		if (!parts) return typeof binding === 'string' ? binding : '';
		const modifiers = MODIFIER_ORDER.filter((modifier) => parts.mods.has(modifier));
		return modifiers.concat(formatCode(parts.base)).join('+');
	}

	root.ZZKeybinds = {
		MODIFIER_ORDER,
		parse,
		fromEvent,
		matches,
		format,
		isModifierCode,
		modifiersSatisfied,
		normalizeBaseKey,
	};
})(typeof globalThis !== 'undefined' ? globalThis : this);
