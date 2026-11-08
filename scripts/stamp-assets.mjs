#!/usr/bin/env node
// Content-hash cache busting for the ZZTetris shell.
//
// Replaces every local `file.ext?v=...` reference with a short hash of the
// referenced file, then derives the service-worker cache version from the
// precached shell. It hashes the working tree, so run it after editing the
// files you are about to commit:
//
//   node scripts/stamp-assets.mjs
//
// Use --check to verify without writing (exits 1 when stamping is needed).

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');

// Files that can contain versioned references. Add new entry points here.
const SCAN_FILES = [
	'index.html',
	'sw.js',
	'mobile.js',
	'base.js',
	'base_3w.js',
	'cancellingsickness.html',
	'cancellingsickness.js',
	'controls.html',
	'engineWorker.js',
	'replay.html',
	'replay.js',
	'replay-practice.js',
	'replay-common.js',
	'attack-sim.js',
];

// Match local file references such as `base.js?v=32` or `./wasm/x.wasm?v=4`.
// The value stops at quotes, whitespace, and common JS/HTML delimiters so a
// trailing `;`, `)`, or `#fragment` is not swallowed.
const VERSION_RE =
	/(?<![\w:/])((?:\.{0,2}\/)?[\w./-]+\.(?:js|css|wasm|html|webmanifest|json|png|svg|woff2?|ttf|otf|wav|mp3))\?v=([^"'&\s);,}\]>#]+)/g;

const virtual = new Map();

function abs(rel) {
	return path.join(ROOT, rel);
}

function readVirtual(rel) {
	if (!virtual.has(rel)) virtual.set(rel, readFileSync(abs(rel), 'utf8'));
	return virtual.get(rel);
}

function writeVirtual(rel, content) {
	virtual.set(rel, content);
}

function hashText(text) {
	return createHash('sha256').update(text).digest('hex').slice(0, 8);
}

function hashFile(rel) {
	if (virtual.has(rel)) return hashText(virtual.get(rel));
	return createHash('sha256').update(readFileSync(abs(rel))).digest('hex').slice(0, 8);
}

function normalizeRel(fromRel, ref) {
	const target = path.resolve(path.dirname(abs(fromRel)), ref);
	const rel = path.relative(ROOT, target);
	if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
	return rel.split(path.sep).join('/');
}

function stampReferences() {
	for (let pass = 0; pass < 12; pass++) {
		let changed = false;
		for (const rel of SCAN_FILES) {
			if (!existsSync(abs(rel))) continue;
			const before = readVirtual(rel);
			const after = before.replace(VERSION_RE, (match, ref, old) => {
				const targetRel = normalizeRel(rel, ref);
				if (!targetRel || !existsSync(abs(targetRel)) || !statSync(abs(targetRel)).isFile()) {
					return match;
				}
				const hash = hashFile(targetRel);
				if (hash === old) return match;
				changed = true;
				return `${ref}?v=${hash}`;
			});
			if (after !== before) {
				writeVirtual(rel, after);
				changed = true;
			}
		}
		if (!changed) return;
	}
	throw new Error('version stamping did not converge');
}

function readAssets() {
	const sw = readVirtual('sw.js');
	const match = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
	if (!match) throw new Error('could not find ASSETS in sw.js');
	return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

function normalizeForCacheVersion(rel, content) {
	let out = content;
	if (rel === 'mobile.js') {
		out = out.replace(
			/const SW_CACHE_VERSION = '[^']*';/,
			"const SW_CACHE_VERSION = '__CACHE_VERSION__';"
		);
	}
	if (rel === 'sw.js') {
		out = out.replace(
			/const CACHE_VERSION = '[^']*';/,
			"const CACHE_VERSION = '__CACHE_VERSION__';"
		);
		out = out.replace(/((?:\.\/)?mobile\.js\?v=)[^'"\s]+/g, '$1__MOBILE_VERSION__');
	}
	if (rel === 'index.html') {
		out = out.replace(/((?:\.\/)?mobile\.js\?v=)[^'"\s]+/g, '$1__MOBILE_VERSION__');
	}
	return out;
}

function computeCacheVersion() {
	const parts = [];
	const missing = [];
	for (const url of readAssets()) {
		const clean = url.split('?')[0];
		const rel = path.posix.normalize(clean.replace(/^\.\//, ''));
		if (!existsSync(abs(rel))) {
			missing.push(rel);
			parts.push(`${rel}:missing`);
			continue;
		}
		if (rel === 'mobile.js' || rel === 'index.html') {
			parts.push(`${rel}:${hashText(normalizeForCacheVersion(rel, readVirtual(rel)))}`);
		} else if (virtual.has(rel)) {
			parts.push(`${rel}:${hashText(virtual.get(rel))}`);
		} else {
			parts.push(`${rel}:${createHash('sha256').update(readFileSync(abs(rel))).digest('hex')}`);
		}
	}
	const sw = normalizeForCacheVersion('sw.js', readVirtual('sw.js'));
	parts.push(`sw.js:${hashText(sw)}`);
	if (missing.length) {
		console.warn(`warning: precached files missing locally: ${missing.join(', ')}`);
	}
	return `zztetris-mobile-${hashText(parts.join('\n'))}`;
}

function setCacheVersion(version) {
	const sw = readVirtual('sw.js').replace(
		/const CACHE_VERSION = '[^']*';/,
		`const CACHE_VERSION = '${version}';`
	);
	writeVirtual('sw.js', sw);
	const mobile = readVirtual('mobile.js').replace(
		/const SW_CACHE_VERSION = '[^']*';/,
		`const SW_CACHE_VERSION = '${version}';`
	);
	writeVirtual('mobile.js', mobile);
}

stampReferences();
let version = computeCacheVersion();
setCacheVersion(version);
stampReferences();
const nextVersion = computeCacheVersion();
if (nextVersion !== version) {
	version = nextVersion;
	setCacheVersion(version);
	stampReferences();
	if (computeCacheVersion() !== version) {
		throw new Error('cache version did not converge');
	}
}

const changed = [];
for (const rel of SCAN_FILES) {
	if (!existsSync(abs(rel))) continue;
	const disk = readFileSync(abs(rel), 'utf8');
	const next = readVirtual(rel);
	if (next !== disk) changed.push(rel);
}

if (CHECK) {
	if (changed.length) {
		console.error(`Cache-busting versions are stale in: ${changed.join(', ')}`);
		console.error('Run: node scripts/stamp-assets.mjs');
		process.exit(1);
	}
	console.log(`Cache-busting versions are up to date (${version}).`);
	process.exit(0);
}

for (const rel of changed) {
	writeFileSync(abs(rel), readVirtual(rel));
}
console.log(
	changed.length
		? `Stamped ${changed.length} file(s): ${changed.join(', ')} (cache ${version})`
		: `Already up to date (cache ${version}).`
);
