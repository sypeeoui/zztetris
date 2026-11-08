#!/usr/bin/env node
// Builds the vendored TETR.IO replay engine bundle.
//
//   npm install
//   npm run build:replay-engine
//
// The output, replay-engine.js, is committed so the deployed site does not
// need Node or a build step. Re-run this after updating @haelp/teto.

import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
	entryPoints: [path.join(ROOT, 'scripts/replay-engine-entry.js')],
	bundle: true,
	format: 'iife',
	globalName: 'ZZReplayEngine',
	platform: 'browser',
	target: ['es2020'],
	minify: true,
	sourcemap: false,
	alias: { chalk: path.join(ROOT, 'scripts/chalk-stub.js') },
	outfile: path.join(ROOT, 'replay-engine.js'),
	banner: {
		js: '/*! @haelp/teto v4.2.8 (MIT) - https://github.com/halp1/triangle - bundled for ZZTetris replay playback. */',
	},
});

console.log('Built replay-engine.js');
