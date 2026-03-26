#!/bin/bash
# Build grid_solver.wasm from C source using Emscripten
#
# Setup (one-time):
#   cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest
#
# Usage: bash build.sh

set -e
cd "$(dirname "$0")"

# Source emsdk environment
export EMSDK="$HOME/emsdk"
export EM_CONFIG="$EMSDK/.emscripten"
export PATH="$EMSDK/upstream/emscripten:$EMSDK/node/22.16.0_64bit/bin:$EMSDK/python/3.13.3_64bit:$PATH"

python "$EMSDK/upstream/emscripten/emcc.py" grid_solver.c \
    -O3 -flto -msimd128 \
    --no-entry \
    -s INITIAL_MEMORY=4194304 \
    -o grid_solver.wasm

echo "Built grid_solver.wasm ($(wc -c < grid_solver.wasm) bytes)"
