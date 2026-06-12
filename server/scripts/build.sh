#!/bin/bash
set -e
echo "[build] Checking syntax for all JS files..."
find routes middleware scripts lib -name "*.js" -exec node --check {} \;
echo "[build] All syntax checks passed."
