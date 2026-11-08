// Entry point for the vendored TETR.IO replay engine bundle.
// The bundle is built by scripts/build-replay-engine.mjs and committed as
// replay-engine.js so the site needs no build step at runtime.
export { Engine, Mino, Board, Queue, GarbageQueue } from '@haelp/teto/engine';
