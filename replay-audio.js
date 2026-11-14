// Replay sound engine.
//
// Uses the existing assets/sfx WAVs for basic actions and garbage, and adds
// synthesized TETR.IO-style layers for clears, combos, B2B, surge, danger and
// perfect clears. The AudioContext is created lazily on the first gesture.
(function (root) {
	'use strict';

	const STORAGE_KEY = 'zztetris_replay_audio';
	const ASSET_BASE = 'assets/sfx/';
	const ASSETS = {
		Move: 'Move.wav',
		Rotate: 'Rotate.wav',
		Hold: 'Hold.wav',
		HardDrop: 'HardDrop.wav',
		SoftDrop: 'SoftDrop.wav',
		LockDelay: 'LockDelay.wav',
		ClearTetra: 'ClearTetra.wav',
		ClearSpin: 'ClearSpin.wav',
		TSpin1: 'TSpin1.wav',
		PerfectClear: 'PerfectClear.wav',
		GarbageLight: 'GarbageLight.wav',
		GarbageMed: 'GarbageMed.wav',
		GarbageLarge: 'GarbageLarge.wav',
		IncomingLight: 'IncomingLight.wav',
		IncomingMed: 'IncomingMed.wav',
		IncomingLarge: 'IncomingLarge.wav',
		TopOut: 'TopOut.wav',
		Finish: 'Finish.wav',
		Woosh1: 'Woosh1.wav',
		Woosh3: 'Woosh3.wav',
	};

	class ReplayAudio {
		constructor() {
			this.ctx = null;
			this.master = null;
			this.compressor = null;
			this.delay = null;
			this.delaySend = null;
			this.noiseBuffer = null;
			this.buffers = new Map();
			this.loading = new Map();
			this.settings = this.loadSettings();
			this.suppressed = false;
			this.suppressDepth = 0;
			this.voices = 0;
			this.maxVoices = 18;
			this.lastAction = new Map();
			this.danger = new Map();
			this.preloaded = false;
		}

		loadSettings() {
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
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
				localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
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
			this.applyMasterGain();
		}

		setVolume(volume) {
			const value = Number(volume);
			if (!Number.isFinite(value)) return;
			this.settings.volume = Math.max(0, Math.min(1, value));
			this.saveSettings();
			this.applyMasterGain();
		}

		applyMasterGain() {
			if (!this.master || !this.ctx) return;
			const target = this.settings.muted ? 0 : this.settings.volume;
			this.master.gain.setTargetAtTime(
				target,
				this.ctx.currentTime,
				0.02
			);
		}

		async resume() {
			if (!this.ctx) this.init();
			if (!this.ctx) return;
			if (this.ctx.state === 'suspended') {
				try {
					await this.ctx.resume();
				} catch (error) {
					// The browser may still block audio until a later gesture.
				}
			}
			if (!this.preloaded) {
				this.preloaded = true;
				this.preload();
			}
		}

		init() {
			if (this.ctx) return;
			const Ctx = root.AudioContext || root.webkitAudioContext;
			if (!Ctx) return;
			this.ctx = new Ctx();
			this.master = this.ctx.createGain();
			this.compressor = this.ctx.createDynamicsCompressor();
			this.compressor.threshold.value = -18;
			this.compressor.knee.value = 20;
			this.compressor.ratio.value = 6;
			this.compressor.attack.value = 0.003;
			this.compressor.release.value = 0.25;
			this.master.connect(this.compressor);
			this.compressor.connect(this.ctx.destination);

			// A short feedback delay adds depth to clears and surges.
			this.delay = this.ctx.createDelay(0.5);
			this.delay.delayTime.value = 0.08;
			this.delaySend = this.ctx.createGain();
			this.delaySend.gain.value = 0.16;
			this.delay.connect(this.delaySend);
			this.delaySend.connect(this.delay);
			this.delaySend.connect(this.master);

			this.applyMasterGain();
		}

		async preload() {
			if (!this.ctx) return;
			await Promise.allSettled(
				Object.keys(ASSETS).map((name) => this.loadAsset(name))
			);
		}

		async loadAsset(name) {
			if (!this.ctx || !ASSETS[name]) return null;
			if (this.buffers.has(name)) return this.buffers.get(name);
			if (this.loading.has(name)) return this.loading.get(name);
			const promise = fetch(ASSET_BASE + ASSETS[name])
				.then((response) => {
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					return response.arrayBuffer();
				})
				.then((data) => this.ctx.decodeAudioData(data))
				.then((buffer) => {
					this.buffers.set(name, buffer);
					return buffer;
				})
				.catch(() => null)
				.finally(() => this.loading.delete(name));
			this.loading.set(name, promise);
			return promise;
		}

		canPlay() {
			return (
				!!this.ctx &&
				!this.suppressed &&
				!this.settings.muted &&
				this.voices < this.maxVoices
			);
		}

		trackVoice(source) {
			this.voices += 1;
			source.onended = () => {
				this.voices = Math.max(0, this.voices - 1);
			};
		}

		connectNode(node, pan, delaySend) {
			const panner = this.ctx.createStereoPanner
				? this.ctx.createStereoPanner()
				: null;
			if (panner) {
				panner.pan.value = Math.max(-1, Math.min(1, pan || 0));
				node.connect(panner);
				panner.connect(this.master);
			} else {
				node.connect(this.master);
			}
			if (delaySend > 0) {
				const send = this.ctx.createGain();
				send.gain.value = delaySend;
				node.connect(send);
				send.connect(this.delay);
			}
		}

		playAsset(name, options = {}) {
			if (!this.canPlay()) return;
			const buffer = this.buffers.get(name);
			if (!buffer) {
				this.loadAsset(name);
				return;
			}
			const source = this.ctx.createBufferSource();
			source.buffer = buffer;
			source.playbackRate.value = options.rate || 1;
			const gain = this.ctx.createGain();
			gain.gain.value = options.volume ?? 1;
			source.connect(gain);
			this.connectNode(gain, options.pan || 0, options.delay || 0);
			const start = this.ctx.currentTime + (options.startDelay || 0);
			source.start(start);
			this.trackVoice(source);
		}

		tone(options = {}) {
			if (!this.canPlay()) return;
			const {
				freq = 440,
				endFreq = freq,
				type = 'sine',
				duration = 0.15,
				volume = 0.2,
				pan = 0,
				delay = 0,
				attack = 0.005,
				delaySend = 0,
			} = options;
			const now = this.ctx.currentTime + delay;
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = type;
			osc.frequency.setValueAtTime(Math.max(1, freq), now);
			if (endFreq && endFreq !== freq) {
				osc.frequency.exponentialRampToValueAtTime(
					Math.max(1, endFreq),
					now + duration
				);
			}
			gain.gain.setValueAtTime(0.0001, now);
			gain.gain.linearRampToValueAtTime(
				Math.max(0.0001, volume),
				now + Math.max(0.001, attack)
			);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
			osc.connect(gain);
			this.connectNode(gain, pan, delaySend);
			osc.start(now);
			osc.stop(now + duration + 0.03);
			this.trackVoice(osc);
		}

		getNoiseBuffer() {
			if (this.noiseBuffer) return this.noiseBuffer;
			const length = Math.max(1, Math.floor(this.ctx.sampleRate));
			const buffer = this.ctx.createBuffer(
				1,
				length,
				this.ctx.sampleRate
			);
			const data = buffer.getChannelData(0);
			for (let i = 0; i < length; i++) {
				data[i] = Math.random() * 2 - 1;
			}
			this.noiseBuffer = buffer;
			return buffer;
		}

		noise(options = {}) {
			if (!this.canPlay()) return;
			const {
				duration = 0.1,
				volume = 0.1,
				pan = 0,
				filterFreq = 2000,
				filterType = 'highpass',
				delay = 0,
				delaySend = 0,
			} = options;
			const now = this.ctx.currentTime + delay;
			const source = this.ctx.createBufferSource();
			source.buffer = this.getNoiseBuffer();
			const filter = this.ctx.createBiquadFilter();
			filter.type = filterType;
			filter.frequency.value = filterFreq;
			const gain = this.ctx.createGain();
			gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
			source.connect(filter);
			filter.connect(gain);
			this.connectNode(gain, pan, delaySend);
			source.start(now, Math.random() * 0.4, duration);
			this.trackVoice(source);
		}

		playAction(pan, action) {
			if (!this.canPlay()) return;
			const now = performance.now();
			const key = `${pan}:${action}`;
			const last = this.lastAction.get(key) || 0;
			if (now - last < 25) return;
			this.lastAction.set(key, now);
			switch (action) {
				case 'move':
					this.playAsset('Move', {
						volume: 0.32,
						pan,
						rate: 0.95 + Math.random() * 0.1,
					});
					break;
				case 'rotate':
					this.playAsset('Rotate', {
						volume: 0.38,
						pan,
						rate: 0.95 + Math.random() * 0.1,
					});
					break;
				case 'hold':
					this.playAsset('Hold', { volume: 0.42, pan });
					break;
				case 'harddrop':
					this.playAsset('HardDrop', { volume: 0.5, pan });
					this.tone({
						freq: 95,
						endFreq: 55,
						type: 'sine',
						duration: 0.12,
						volume: 0.16,
						pan,
					});
					break;
				case 'softdrop':
					this.playAsset('SoftDrop', { volume: 0.18, pan });
					break;
				case 'lock':
					this.playAsset('LockDelay', { volume: 0.22, pan });
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
			const surge = Math.max(0, Number(attack?.surge) || 0);
			const total = Math.max(0, Number(attack?.total) || 0);
			const intensity = Math.min(1.6, 0.6 + total / 20);

			// Every lock gets a soft thud.
			this.tone({
				freq: 120,
				endFreq: 70,
				type: 'sine',
				duration: 0.08,
				volume: 0.1,
				pan,
			});

			if (cleared === 0 && !pc) return;

			const clearAsset = spin ? 'ClearSpin' : 'ClearTetra';
			this.playAsset(clearAsset, {
				volume: 0.48 * intensity,
				pan,
				rate: 0.95 + cleared * 0.03,
				delay: 0.08,
			});

			this.tone({
				freq: 90 + cleared * 12,
				endFreq: 55,
				type: 'sine',
				duration: 0.18 + cleared * 0.03,
				volume: 0.16 * intensity,
				pan,
			});
			this.noise({
				duration: 0.08 + cleared * 0.02,
				volume: 0.07 * intensity,
				pan,
				filterFreq: 1800 + cleared * 400,
				filterType: 'highpass',
			});

			if (spin) {
				this.playAsset('TSpin1', {
					volume: 0.32 * intensity,
					pan,
				});
				this.tone({
					freq: 900 + cleared * 80,
					endFreq: 1200,
					type: 'triangle',
					duration: 0.12,
					volume: 0.07,
					pan,
				});
			}

			if (b2b > 1) {
				this.tone({
					freq: 60,
					endFreq: 45,
					type: 'sine',
					duration: 0.3,
					volume: 0.15,
					pan,
					delay: 0.02,
				});
				this.playAsset('Woosh1', {
					volume: 0.18,
					pan,
					startDelay: 0.04,
				});
			}

			if (combo > 0) {
				const freq = 420 + Math.min(12, combo) * 55;
				this.tone({
					freq,
					endFreq: freq * 1.25,
					type: 'triangle',
					duration: 0.09,
					volume: 0.11,
					pan,
					delay: 0.03,
				});
				this.tone({
					freq: freq * 2,
					endFreq: freq * 2.2,
					type: 'sine',
					duration: 0.06,
					volume: 0.045,
					pan,
					delay: 0.03,
				});
			}

			if (surge > 0) {
				const amount = Math.min(10, surge);
				this.tone({
					freq: 180,
					endFreq: 900 + amount * 80,
					type: 'sawtooth',
					duration: 0.32,
					volume: 0.1 + amount * 0.01,
					pan,
					attack: 0.02,
					delaySend: 0.2,
				});
				this.noise({
					duration: 0.3,
					volume: 0.09,
					pan,
					filterFreq: 1200,
					filterType: 'bandpass',
				});
				this.tone({
					freq: 70,
					endFreq: 40,
					type: 'sine',
					duration: 0.35,
					volume: 0.18,
					pan,
					delay: 0.18,
				});
				this.playAsset('Woosh3', {
					volume: 0.28,
					pan,
					startDelay: 0.04,
				});
			}

			if (pc) {
				this.playAsset('PerfectClear', { volume: 0.55, pan });
				const chord = [523.25, 659.25, 783.99, 1046.5];
				chord.forEach((freq, index) => {
					this.tone({
						freq,
						type: 'sine',
						duration: 0.5,
						volume: 0.07,
						pan,
						delay: index * 0.03,
						attack: 0.01,
						delaySend: 0.25,
					});
				});
			}
		}

		playGarbage(pan, type, event) {
			if (!this.canPlay()) return;
			const amount = Math.max(1, Math.floor(Number(event?.amount) || 1));
			if (type === 'receive') {
				const asset =
					amount >= 6
						? 'IncomingLarge'
						: amount >= 3
							? 'IncomingMed'
							: 'IncomingLight';
				this.playAsset(asset, { volume: 0.38, pan });
				this.tone({
					freq: 80,
					endFreq: 55,
					type: 'sine',
					duration: 0.25,
					volume: 0.1,
					pan,
				});
			} else if (type === 'tank') {
				const asset =
					amount >= 6
						? 'GarbageLarge'
						: amount >= 3
							? 'GarbageMed'
							: 'GarbageLight';
				this.playAsset(asset, { volume: 0.42, pan });
				this.tone({
					freq: 70,
					endFreq: 45,
					type: 'sine',
					duration: 0.2,
					volume: 0.12,
					pan,
				});
			} else if (type === 'cancel') {
				this.tone({
					freq: 600,
					endFreq: 900,
					type: 'triangle',
					duration: 0.06,
					volume: 0.05,
					pan,
				});
			}
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
			if (!this.ctx || this.suppressed || this.settings.muted) return;
			if (!active) return;
			const now = performance.now();
			const last = this.danger.get(key) || 0;
			if (now - last < 1500) return;
			const height = this.stackHeight(engine);
			const dangerLine = Math.max(1, engine.board.height - 4);
			if (height < dangerLine) return;
			this.danger.set(key, now);
			this.tone({
				freq: 220,
				endFreq: 180,
				type: 'square',
				duration: 0.18,
				volume: 0.055,
				pan,
				attack: 0.02,
			});
			this.tone({
				freq: 165,
				endFreq: 140,
				type: 'square',
				duration: 0.18,
				volume: 0.045,
				pan,
				delay: 0.2,
				attack: 0.02,
			});
			this.noise({
				duration: 0.35,
				volume: 0.025,
				pan,
				filterFreq: 400,
				filterType: 'lowpass',
			});
		}

		setSuppressed(value) {
			if (value) {
				this.suppressDepth = (this.suppressDepth || 0) + 1;
			} else {
				this.suppressDepth = Math.max(
					0,
					(this.suppressDepth || 0) - 1
				);
			}
			this.suppressed = this.suppressDepth > 0;
		}
	}

	root.ZZReplayAudio = ReplayAudio;
})(typeof globalThis !== 'undefined' ? globalThis : this);
