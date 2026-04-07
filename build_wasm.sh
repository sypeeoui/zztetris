#!/bin/bash
set -e

# This script builds the Rust engines to WASM and copies them to the zztetris/wasm folder.
# Requires wasm-pack: https://rustwasm.github.io/wasm-pack/installer/

mkdir -p wasm

# getrandom 0.3+ requires explicit backend selection for wasm32-unknown-unknown
export RUSTFLAGS='--cfg getrandom_backend="wasm_js"'

echo "Building Fusion engine..."
cd engines/fusion
wasm-pack build --target web --out-dir pkg_wasm -- --no-default-features --features wasm
cd ../..
# Keep original names so the glue code JS can find the WASM binary
cp engines/fusion/pkg_wasm/direct_cobra_copy.js wasm/direct_cobra_copy.js
cp engines/fusion/pkg_wasm/direct_cobra_copy_bg.wasm wasm/direct_cobra_copy_bg.wasm

echo "Building Falcon-2 engine..."
cd engines/falcon-2
wasm-pack build --target web --out-dir pkg_wasm -- --no-default-features --features wasm
cd ../..
cp engines/falcon-2/pkg_wasm/falcon_2.js wasm/falcon_2.js
cp engines/falcon-2/pkg_wasm/falcon_2_bg.wasm wasm/falcon_2_bg.wasm

echo "Building Cold Clear 2 engine..."
cd engines/cold-clear-2
wasm-pack build --target web --out-dir pkg_wasm -- --no-default-features --features wasm
cd ../..
cp engines/cold-clear-2/pkg_wasm/cold_clear_2.js wasm/cold_clear_2.js
cp engines/cold-clear-2/pkg_wasm/cold_clear_2_bg.wasm wasm/cold_clear_2_bg.wasm

echo "WASM engines built successfully in zztetris/wasm/"
