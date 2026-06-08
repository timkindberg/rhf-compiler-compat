# react-hook-form + React Compiler Compatibility Tests

A standalone test harness that empirically verifies which `react-hook-form` APIs work correctly under [React Compiler](https://react.dev/learn/react-compiler).

Each stack (a `react-hook-form` × `babel-plugin-react-compiler` combination) is documented as its own report so teams can find the guidance that matches their versions.

## Reports

- [`react-hook-form@8.0.0-beta.2`](./REPORT-rhf-8.0.0-beta.2.md) — **latest.** React 19 + compiler `1.0.0` GA. **0 of 28 core tests fail** — v8's "React Compiler compatible out of the box" claim holds for correctness. Goes **beyond pass/fail** to inspect the emitted code: `useForm().watch()` is still **bailed out (never memoized)** by a hardcoded compiler rule, even though v8's `watch()` is now provably memoization-safe. Includes the root-cause mechanism (v8 returns a fresh `form`/`watch` reference each render).
- [`babel-plugin-react-compiler@1.0.0` (GA)](./REPORT-compiler-1.0.0.md) — React 19 + `react-hook-form@^7.75.0`. **5 of 28 core tests fail** under the compiler; most previously broken APIs now work.
- [`babel-plugin-react-compiler@19.1.0-rc.3`](./REPORT-compiler-19.1.0-rc.3.md) — original report. React 18 + `react-hook-form@^7.42.1`. **13 of 27 core tests fail** under the compiler.

The working tree currently targets `react-hook-form@8.0.0-beta.2`; the v7.x reports are point-in-time snapshots (check out the relevant commit to reproduce them).

## Quick start

```bash
bun install
bun run test:both
```

This runs the canonical suite both with and without the compiler and prints a side-by-side pass/fail summary. See any report above for the per-API breakdown and recommended workarounds. The v8 report additionally documents the compiler-output inspection scripts (`bun inspect-compile.mjs`, `bun inspect-output.mjs`) and the forced-memoization experiment.

## License

MIT
