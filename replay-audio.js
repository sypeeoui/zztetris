// Replay sound layer.
//
// The actual samples and the shared mixer live in sound-pack.js. This file
// maps replay events to sound names and keeps the replay's own volume/mute
// settings (localStorage key zztetris_replay_audio).
(function (root) {
	'use strict';

	const STORAGE_KEY = 'zztetris_replay_audio';

	class ReplayAudio {
		constructor() {
			this.settings = this.loadSettings();
			this.lastAction = new Map();
		}

		loadSettings() {
			try {
				const raw = root.localStorage.getItem(STORAGE_KEY);
				if (!raw) return { muted: false, volume: 0.7 };
				const parsed = JSON.parse(raw);
				return {
					muted: !!parsed.muted,
					volume: Math.max(
						0,
						Math.min(1, Number(parsed.volume) || 0.7)
					),
				};
			} catch (error) {
				return { muted: false, volume: 0.7 };
			}
		}

		saveSettings() {
			try {
				root.localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify(this.settings)
				);
			} catch (error) {
				// Storage can be unavailable; the in-memory settings still work.
			}
		}

		getSettings() {
			return { ...this.settings };
		}

		setMuted(muted) {
			this.settings.muted = !!muted;
			this.saveSettings();
		}

		setVolume(volume) {
			const value = Number(volume);
			if (!Number.isFinite(value)) return;
			this.settings.volume = Math.max(0, Math.min(1, value));
			this.saveSettings();
		}

		volume() {
			return this.settings.muted ? 0 : this.settings.volume;
		}

		canPlay() {
			return (
				!!root.ZZSoundPack &&
				!this.settings.muted &&
				this.settings.volume > 0
			);
		}

		async resume() {
			await root.ZZSoundPack?.resume();
		}

		play(name, options = {}) {
			root.ZZSoundPack?.play(name, options);
		}

		playCue(name, options = {}) {
			root.ZZSoundPack?.playCue(name, options);
		}

		playAction(pan, action) {
			if (!this.canPlay()) return;
			const now = performance.now();
			const key = `${pan}:${action}`;
			const last = this.lastAction.get(key) || 0;
			if (now - last < 25) return;
			this.lastAction.set(key, now);
			const volume = this.volume();
			switch (action) {
				case 'move':
					this.play('Move', {
						volume,
						pan,
						rate: 0.95 + Math.random() * 0.1,
					});
					break;
				case 'rotate':
					this.play('Rotate', {
						volume,
						pan,
						rate: 0.95 + Math.random() * 0.1,
					});
					break;
				case 'spin':
					this.play('Spin', {
						volume,
						pan,
						category: 'spin',
					});
					break;
				case 'hold':
					this.play('Hold', { volume, pan });
					break;
				case 'harddrop':
					this.play('HardDrop', { volume, pan });
					break;
				case 'softdrop':
					this.play('SoftDrop', { volume: volume * 0.6, pan });
					break;
				case 'lock':
					this.play('LockDelay', { volume: volume * 0.7, pan });
					break;
				default:
					break;
			}
		}

		playClear(pan, info, attack) {
			if (!this.canPlay()) return;
			const cleared = Math.max(0, Number(info?.cleared) || 0);
			const spin = !!(info?.tspin || info?.allspinMini);
			const pc = !!info?.pc;
			const b2b = Math.max(0, Number(info?.b2b) || 0);
			const combo = Math.max(0, Number(info?.combo) || 0);
			const surge = Math.max(
				0,
				Number(info?.surge ?? attack?.surge) || 0
			);
			const sent = Math.max(0, Number(info?.sent) || 0);
			const b2bBefore = Math.max(0, Number(info?.b2bBefore) || 0);
			const volume = this.volume();

			if (info?.isSpin) {
				this.play('SpinEnd', {
					volume,
					pan,
					category: 'spin',
				});
			}

			if (sent > 0) {
				const size =
					sent >= 6 ? 'Large' : sent >= 3 ? 'Med' : 'Light';
				this.play('GarbageOut' + size, {
					volume,
					pan,
					category: 'garbage',
				});
			}

			if (surge > 0) {
				const level =
					b2bBefore >= 24
						? 4
						: b2bBefore >= 12
							? 3
							: b2bBefore >= 8
								? 2
								: 1;
				this.playCue('B2BChargeBlast' + level, {
					volume,
					pan,
					category: 'b2b',
				});
			}

			if (cleared === 0 && !pc) return;

			if (pc) {
				this.play('PerfectClear', {
					volume,
					pan,
					category: 'clear',
				});
			} else if (spin) {
				this.play('ClearSpin', {
					volume,
					pan,
					category: 'clear',
				});
			} else if (cleared === 4) {
				this.play(b2b > 1 ? 'ClearB2B' : 'ClearQuad', {
					volume,
					pan,
					category: 'clear',
				});
			} else {
				this.play('ClearLine', {
					volume,
					pan,
					category: 'clear',
				});
			}

			if (combo > 0) {
				this.playCue('Combo' + Math.min(16, combo), {
					volume,
					pan,
					category: 'combo',
				});
			}
		}

		playGarbage(pan, type, event) {
			if (!this.canPlay()) return;
			const amount = Math.max(
				1,
				Math.floor(Number(event?.amount) || 1)
			);
			const volume = this.volume();
			const size = amount >= 6 ? 'Large' : amount >= 3 ? 'Med' : 'Light';
			if (type === 'receive') {
				this.play('GarbageIn' + size, {
					volume,
					pan,
					category: 'garbage',
				});
			} else if (type === 'tank') {
				this.play('Garbage' + size, {
					volume,
					pan,
					category: 'garbage',
				});
			} else if (type === 'cancel') {
				this.play('Counter', {
					volume: volume * 0.7,
					pan,
					category: 'garbage',
				});
			} else if (type === 'confirm') {
				this.play('Impact', {
					volume: volume * 0.5,
					pan,
					category: 'garbage',
				});
			}
		}

		playTopOut(pan) {
			if (!this.canPlay()) return;
			this.play('TopOut', { volume: this.volume(), pan });
		}

		playFinish(pan) {
			if (!this.canPlay()) return;
			this.play('Finish', { volume: this.volume(), pan });
		}

		stackHeight(engine) {
			const state = engine?.board?.state;
			const height = engine?.board?.height;
			if (!Array.isArray(state) || !height) return 0;
			const top = Math.min(height, state.length) - 1;
			for (let y = top; y >= 0; y--) {
				if (state[y]?.some(Boolean)) return y + 1;
			}
			return 0;
		}

		updateDanger(key, pan, engine, active) {
			if (!this.canPlay() || !active) return;
			const height = this.stackHeight(engine);
			const dangerLine = Math.max(1, engine.board.height - 4);
			if (height < dangerLine) return;
			root.ZZSoundPack?.playDanger(
				key,
				height >= dangerLine + 2 ? 'hyper' : 'normal',
				{ volume: this.volume(), pan }
			);
		}

		setSuppressed(value) {
			root.ZZSoundPack?.setSuppressed(value);
		}
	}

	root.ZZReplayAudio = ReplayAudio;
})(typeof globalThis !== 'undefined' ? globalThis : this);
