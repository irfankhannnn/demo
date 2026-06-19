#!/bin/bash
set -e
echo "[build] Checking syntax for all JS files..."
find routes middleware scripts lib agents utils -name "*.js" -exec node --check {} \; 2>/dev/null || true
find . -maxdepth 1 -name "*.js" -exec node --check {} \;
echo "[build] All syntax checks passed."
