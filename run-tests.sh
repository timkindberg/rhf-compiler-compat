#!/bin/bash
echo "=== Running WITHOUT React Compiler (baseline) ==="
bun test 2>&1 | tee /tmp/rhf-no-compiler.txt
echo ""
echo "=== Running WITH React Compiler ==="
bun test --preload ./compiler-plugin.ts 2>&1 | tee /tmp/rhf-with-compiler.txt
echo ""
echo "=== COMPARISON ==="
echo "Baseline (no compiler):  $(grep -c '✓' /tmp/rhf-no-compiler.txt) passed, $(grep -c '✗' /tmp/rhf-no-compiler.txt) failed"
echo "With compiler:           $(grep -c '✓' /tmp/rhf-with-compiler.txt) passed, $(grep -c '✗' /tmp/rhf-with-compiler.txt) failed"
