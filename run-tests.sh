#!/bin/bash
# Scoped to the canonical suite. The other *.test.tsx files share a single
# happy-dom global when Bun runs files concurrently, so they must be run on
# their own (see test:holes / test:forced).
mkdir -p ./tmp
echo "=== Running WITHOUT React Compiler (baseline) ==="
bun test rhf-compat.test.tsx 2>&1 | tee ./tmp/rhf-no-compiler.txt
echo ""
echo "=== Running WITH React Compiler ==="
bun test --preload ./compiler-plugin.ts rhf-compat.test.tsx 2>&1 | tee ./tmp/rhf-with-compiler.txt
echo ""
echo "=== COMPARISON ==="
echo "Baseline (no compiler):  $(grep -E '^[[:space:]]+[0-9]+ pass' ./tmp/rhf-no-compiler.txt | awk '{print $1}') passed, $(grep -E '^[[:space:]]+[0-9]+ fail' ./tmp/rhf-no-compiler.txt | awk '{print $1}') failed"
echo "With compiler:           $(grep -E '^[[:space:]]+[0-9]+ pass' ./tmp/rhf-with-compiler.txt | awk '{print $1}') passed, $(grep -E '^[[:space:]]+[0-9]+ fail' ./tmp/rhf-with-compiler.txt | awk '{print $1}') failed"
