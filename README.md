# react-hook-form + React Compiler Compatibility Tests

A standalone test harness that verifies which `react-hook-form` APIs work correctly under [React Compiler](https://react.dev/learn/react-compiler). Each test renders a minimal component, interacts with it, and asserts expected behavior -- first without the compiler (baseline), then with it enabled, producing a clear pass/fail compatibility matrix.

## Why this exists

React Compiler automatically memoizes components based on reference identity. `react-hook-form` uses **interior mutability** -- its form object stays the same reference but returns different values from methods like `.watch()` and `.formState`. The compiler can't detect these internal changes, so it caches stale results.

This is a [known, documented incompatibility](https://react.dev/reference/eslint-plugin-react-hooks/lints/incompatible-library). This test suite provides **empirical evidence** of exactly which APIs break, rather than relying solely on GitHub issue reports.

## Prerequisites

- [Bun](https://bun.sh/) v1.0 or later

## Installation

```bash
bun install
```

## Usage

### Run tests WITHOUT compiler (baseline)

All 39 tests should pass. This confirms the test scenarios themselves are correct.

```bash
bun test
```

### Run tests WITH React Compiler

This shows which APIs break under the compiler. Failures here indicate incompatible APIs. The 12 workaround tests (which use `'use no memo'`) should still pass.

```bash
bun test --preload ./compiler-plugin.ts
```

### Run both and compare

Runs both modes and prints a summary showing how many tests pass/fail in each mode.

```bash
bun run test:both
```

This executes `run-tests.sh`, which outputs something like:

```
=== Running WITHOUT React Compiler (baseline) ===
...test output...

=== Running WITH React Compiler ===
...test output...

=== COMPARISON ===
Baseline (no compiler):  39 passed, 0 failed
With compiler:           27 passed, 12 failed
```

## What it tests

39 test scenarios organized into three groups:

### Core API tests (27 tests)

These test every major `react-hook-form` API used during render:

| # | API Under Test | What the test checks |
|---|----------------|----------------------|
| 1 | `form.watch('field')` | Type in input, assert watched value updates in DOM |
| 2 | `form.watch()` (no args) | Type in input, assert component re-renders with all values |
| 3 | `formState.errors` | Submit empty required field, assert error message appears |
| 4 | `formState.isDirty` | Type in field, assert isDirty text updates |
| 5 | `formState.isSubmitting` | Submit with async handler, assert "submitting" text shown |
| 6 | `useFormContext()` | Child component reads watched value from context |
| 7 | `<Controller>` | Render controlled input, type, assert value shown |
| 8 | `useController` | Hook-based controlled input, type, assert value shown |
| 9 | `useWatch({ control })` | Watch with explicit control prop, assert updates |
| 10 | `useWatch()` (context) | Watch without control (via FormProvider), assert updates |
| 11 | `useFormState()` | Submit empty required field, assert error via hook |
| 12 | `getValues()` in render | Read value in render after user types, assert fresh |
| 13 | `getFieldState()` in render | Touch field, assert fieldState reflects it |
| 14 | `reset()` | Fill form, click reset button, assert values cleared |
| 15 | `formState.touchedFields` | Touch field, assert touchedFields updates |
| 16 | `formState.submitCount` | Submit form multiple times, assert count increments |
| 17 | `formState.isValidating` | Submit with async validator, assert isValidating shown |
| 18 | `reset()` with new defaults | Reset with new defaultValues, assert form updates |
| 19 | `watch()` with callback | Subscribe via callback, assert callback fires on change |
| 20 | `watch` in useEffect deps | Watch value in useEffect dependency array, assert effect fires |
| 21 | Conditional fields via watch | Show/hide fields based on watched select value |
| 22 | Nested watch paths | Watch `user.address.city`, assert deep changes propagate |
| 23 | `setValue` then `watch` | Call setValue programmatically, assert watch returns updated value |
| 24 | `useFieldArray` + `watch` | Append items to field array, assert watched array updates |
| 25 | `formState` destructuring | Destructure formState, assert fields reflect changes |
| 26 | `formState.isDirty` via `useFormContext` | Child reads isDirty from context, assert updates after typing |
| 27 | `getValues()` with array arg | Call getValues(['a', 'b']), assert fresh subset returned |

### Workaround tests (12 tests)

For each core API that **fails** under the compiler, there is a corresponding workaround test that adds `'use no memo'` to the component. These verify that opting out of memoization fixes the problem:

**Note:** While these tests use `'use no memo'`, the recommended approach is to use safe alternative APIs like `useWatch()` and `useFormState()` where available (see the Workarounds section below).

| Core test that fails | Workaround test |
|---------------------|-----------------|
| `form.watch('field')` | Same test with `'use no memo'` |
| `form.watch()` (no args) | Same test with `'use no memo'` |
| `useFormContext()` | Same test with `'use no memo'` |
| `<Controller>` | Same test with `'use no memo'` |
| `useController` | Same test with `'use no memo'` |
| `getValues()` in render | Same test with `'use no memo'` |
| `reset()` | Same test with `'use no memo'` |
| `reset()` with new defaults | Same test with `'use no memo'` |
| `watch` in useEffect deps | Same test with `'use no memo'` |
| Conditional fields via watch | Same test with `'use no memo'` |
| Nested watch paths | Same test with `'use no memo'` |
| `useFieldArray` + `watch` | Same test with `'use no memo'` |

## Actual results

Tested with `babel-plugin-react-compiler@19.1.0-rc.3`, `react-hook-form@^7.42.1`, `react@18.3.1`:

| API | Without Compiler | With Compiler | Notes |
|-----|-----------------|---------------|-------|
| `form.watch('field')` | PASS | **FAIL** | Confirmed -- [#11910](https://github.com/react-hook-form/react-hook-form/issues/11910), [#12598](https://github.com/react-hook-form/react-hook-form/issues/12598) |
| `form.watch()` (no args) | PASS | **FAIL** | Same interior mutability issue |
| `formState.errors` | PASS | PASS | Works -- proxy subscription triggers re-render |
| `formState.isDirty` | PASS | PASS | Works -- proxy subscription triggers re-render |
| `formState.isSubmitting` | PASS | PASS | Works -- proxy subscription triggers re-render |
| `formState.touchedFields` | PASS | PASS | Works -- proxy subscription triggers re-render |
| `formState.submitCount` | PASS | PASS | Works -- proxy subscription triggers re-render |
| `formState.isValidating` | PASS | PASS | Works -- proxy subscription triggers re-render |
| `formState` destructuring | PASS | PASS | Works -- destructuring accesses proxy correctly |
| `useFormContext()` + watch | PASS | **FAIL** | Confirmed -- [#12618](https://github.com/react-hook-form/react-hook-form/issues/12618) |
| `<Controller>` | PASS | **FAIL** | Confirmed -- [#12298](https://github.com/react-hook-form/react-hook-form/issues/12298) |
| `useController` | PASS | **FAIL** | Same as Controller |
| `useWatch({ control })` | PASS | PASS | Hook-based subscription works |
| `useWatch()` (context) | PASS | PASS | Hook-based subscription works |
| `useFormState()` | PASS | PASS | Hook-based subscription works |
| `getValues()` in render | PASS | **FAIL** | Interior mutability -- cached by compiler |
| `getValues(['a','b'])` | PASS | PASS | Array variant works (different code path) |
| `getFieldState()` in render | PASS | PASS | Works in our tests |
| `reset()` | PASS | **FAIL** | Compiler caches stale post-reset state |
| `reset()` with new defaults | PASS | **FAIL** | Same issue as reset() |
| `watch()` with callback | PASS | PASS | Callback-based subscription works |
| `watch` in useEffect deps | PASS | **FAIL** | Effect never re-runs with stale watch value |
| Conditional fields via watch | PASS | **FAIL** | Conditional sections never appear |
| Nested watch paths | PASS | **FAIL** | Deep property updates don't propagate |
| `setValue` + `watch` | PASS | PASS | Programmatic setValue triggers re-render |
| `useFieldArray` + `watch` | PASS | **FAIL** | Watched array stays stale after append |
| `formState.isDirty` via context | PASS | PASS | Works via useFormContext |

**Summary: 12 of 27 core tests fail** under the compiler (44% failure rate). All 12 workaround tests pass, confirming `'use no memo'` is an effective fix.

## Workarounds

For each breaking API, here are the recommended workarounds:

| Breaking API | Recommended Workaround | Notes |
|--------------|------------------------|-------|
| `form.watch('field')` | Replace with `useWatch({ name: 'field', control })` | Hook-based subscription, triggers re-renders properly |
| `form.watch()` (no args) | Replace with `useWatch({ control })` | Watches all fields via hook subscription |
| `useFormContext()` + watch | **No alternative** -- Use `'use no memo'` | Context consumers are memoized by compiler |
| `<Controller>` | **No alternative** -- Use `'use no memo'` | Control object interior mutability |
| `useController` | **No alternative** -- Use `'use no memo'` | Control object interior mutability |
| `getValues()` in render | Replace with `useWatch({ name: 'field', control })` for specific fields, OR move `getValues()` to callbacks/effects | Avoid calling during render; use hooks for reactive values |
| `reset()` | **No alternative** -- Use `'use no memo'` | Reset behavior breaks under memoization |
| `reset()` with new defaults | **No alternative** -- Use `'use no memo'` | Same as reset() |
| `watch` in useEffect deps | Replace watched value with `useWatch({ name: 'field', control })` | Effect deps need reactive values from hooks |
| Conditional fields via watch | Replace `form.watch('type')` with `useWatch({ name: 'type', control })` | Conditional rendering needs reactive hook values |
| Nested watch paths | Replace `form.watch('user.address.city')` with `useWatch({ name: 'user.address.city', control })` | Deep paths work with useWatch |
| `useFieldArray` + `watch` | Replace `form.watch('items')` with `useWatch({ name: 'items', control })` | Array watching needs hook subscription |
| `formState.isDirty` via context | Child should use `useFormState({ control })` with control passed as prop | Hook-based state access instead of context |

**Key principle:** Replace `form.watch()` with `useWatch()` and `form.formState` access via context with `useFormState()` wherever possible. Only use `'use no memo'` when no safe API alternative exists (Controller, useController, direct context usage, reset operations).

### Surprising findings

The **formState** APIs (`errors`, `isDirty`, `isSubmitting`, `touchedFields`, `submitCount`, `isValidating`) all **pass** despite initial expectations. The proxy-based subscription mechanism in react-hook-form triggers re-renders even under the compiler.

The **hook-based alternatives** (`useWatch`, `useFormState`) all pass, confirming they are the safer pattern.

## How it works

The test harness uses a **Bun plugin** (`compiler-plugin.ts`) that intercepts `.tsx` file imports and transforms them through `@babel/core` with `babel-plugin-react-compiler` before Bun processes them. This simulates what Next.js (or any other build tool) does at build time when the compiler is enabled.

Key details:
- The plugin only transforms files in the project directory, not `node_modules`
- It targets React 18 (`{ target: '18' }`) to match the most common production setup
- Without the `--preload` flag, Bun processes `.tsx` files normally (no compiler transform)
- The same test file runs in both modes, so any difference in behavior is caused by the compiler

### File structure

```
rhf-compiler-compat/
  package.json              # Dependencies and npm scripts
  bunfig.toml               # Bun config (happy-dom test environment)
  happydom.ts               # happy-dom global registrator
  compiler-plugin.ts        # Bun plugin applying babel-plugin-react-compiler
  rhf-compat.test.tsx       # All 39 test scenarios
  run-tests.sh              # Runs both modes and prints comparison
  FINAL-TEST-RESULTS.md     # Detailed test results and analysis
  README.md                 # This file
```

## The workaround: `'use no memo'`

If you encounter these incompatibilities in your own codebase, the current fix is to add the `'use no memo'` directive to affected components:

```tsx
function MyFormComponent() {
  'use no memo' // Opt out of React Compiler -- react-hook-form uses interior mutability
  const { watch, formState } = useForm()
  const value = watch('field')
  // ...
}
```

This tells React Compiler to skip memoizing that specific function. It must be added to **each** component or hook that reads from the form during render.

**However, using `'use no memo'` should be a last resort.** See the [Workarounds section](#workarounds) for safe API alternatives that don't require opting out of the compiler.

## Contributing

Contributions are welcome. To add a new test scenario:

1. Add a new `test()` block in `rhf-compat.test.tsx`
2. Follow the existing pattern: render a minimal component, interact with it via `@testing-library/user-event`, assert the expected DOM state
3. Make sure the test passes without the compiler (`bun test`)
4. Run with compiler (`bun run test:compiler`) and document whether it passes or fails
5. If the test fails under the compiler, add a corresponding workaround test with `'use no memo'`
6. Update this README's test tables

## Related issues

- [react-hook-form#11910](https://github.com/react-hook-form/react-hook-form/issues/11910) -- `watch` doesn't work with React Compiler
- [react-hook-form#12298](https://github.com/react-hook-form/react-hook-form/issues/12298) -- 35 of 871 tests fail under React Compiler
- [react-hook-form#12598](https://github.com/react-hook-form/react-hook-form/issues/12598) -- `watch()` does not update with React Compiler
- [react-hook-form#12618](https://github.com/react-hook-form/react-hook-form/issues/12618) -- `useFormContext()` breaks under compiler
- [react-hook-form#12492](https://github.com/react-hook-form/react-hook-form/issues/12492) -- Form does not mutate on first render due to compiler
- [react-hook-form Discussion#12524](https://github.com/orgs/react-hook-form/discussions/12524) -- React Compiler support tracking
- [facebook/react#29174](https://github.com/facebook/react/issues/29174) -- Compiler bug filed about react-hook-form
- [React docs: Incompatible libraries](https://react.dev/reference/eslint-plugin-react-hooks/lints/incompatible-library)

## Long-term outlook

- **react-hook-form v8** (alpha) aims to address compiler compatibility. Once stable, these workarounds can be removed.
- Prefer `useWatch()` over `form.watch()` and `useFormState()` over `form.formState` -- the hook-based APIs subscribe properly and are more likely to be compiler-compatible.
- The React Compiler's auto-skip list currently only flags `watch()` from `useForm()`. All other react-hook-form APIs are not auto-skipped. Expanding this coverage is tracked upstream.

## License

MIT
