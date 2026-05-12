# react-hook-form + React Compiler Compatibility Tests

A standalone test harness that empirically verifies which `react-hook-form` APIs work correctly under [React Compiler](https://react.dev/learn/react-compiler).

Each `babel-plugin-react-compiler` release is documented as its own report so teams on either stack can find the guidance they need.

## Reports

- [`babel-plugin-react-compiler@19.1.0-rc.3`](./REPORT-compiler-19.1.0-rc.3.md) — original report. React 18 + `react-hook-form@^7.42.1`. **13 of 27 core tests fail** under the compiler.
- [`babel-plugin-react-compiler@1.0.0` (GA)](./REPORT-compiler-1.0.0.md) — latest report. React 19 + `react-hook-form@^7.75.0`. **5 of 28 core tests fail** under the compiler; most previously broken APIs now work.

## Quick start

```bash
bun install
bun run test:both
```

This runs the suite both with and without the compiler and prints a side-by-side pass/fail summary. See either report above for the per-API breakdown and recommended workarounds.

## License

MIT
