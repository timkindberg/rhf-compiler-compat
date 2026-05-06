# react-hook-form + React Compiler Compatibility Tests

A standalone test harness that verifies which `react-hook-form` APIs work correctly under [React Compiler](https://react.dev/learn/react-compiler). Each test renders a minimal component, interacts with it, and asserts expected behavior -- first without the compiler (baseline), then with it enabled, producing a clear pass/fail compatibility matrix.

## Why this exists

React Compiler automatically memoizes components based on reference identity. `react-hook-form` uses **interior mutability** -- its form object stays the same reference but returns different values from methods like `.watch()` and `.formState`. The compiler can't detect these internal changes, so it caches stale results.

This is a [known, documented incompatibility](https://react.dev/reference/eslint-plugin-react-hooks/lints/incompatible-library). This test suite provides **empirical evidence** of exactly which APIs break, rather than relying solely on GitHub issue reports.

The React Compiler 1.0 GA recognises many `react-hook-form` access patterns and bails out of memoization automatically -- but only when the form object is obtained directly from `useForm()` in the same component. When the form object is read via `useFormContext()` in a child component, the auto-bailout no longer applies and the interior-mutability issue still manifests.

## Prerequisites

- [Bun](https://bun.sh/) v1.3 or later (tested with **v1.3.13**, pinned in `package.json`'s `packageManager` field)

## Installation

```bash
bun install
```

## Usage

### Run tests WITHOUT compiler (baseline)

All 40 tests should pass. This confirms the test scenarios themselves are correct.

```bash
bun test
```

### Run tests WITH React Compiler

```bash
bun test --preload ./compiler-plugin.ts
```

### Run both and compare

Runs both modes and prints a summary showing how many tests pass/fail in each mode.

```bash
bun run test:both
```

This executes `run-tests.sh`, which outputs:

```
=== Running WITHOUT React Compiler (baseline) ===
...test output...

=== Running WITH React Compiler ===
...test output...

=== COMPARISON ===
Baseline (no compiler):  42 passed, 0 failed
With compiler:           39 passed, 3 failed
```

## What it tests

42 test scenarios organized into two groups:

### Core API tests (28 tests)

These test every major `react-hook-form` API used during render:

| #   | API Under Test                           | What the test checks                                               |
| --- | ---------------------------------------- | ------------------------------------------------------------------ |
| 1   | `form.watch('field')`                    | Type in input, assert watched value updates in DOM                 |
| 2   | `form.watch()` (no args)                 | Type in input, assert component re-renders with all values         |
| 3   | `formState.errors`                       | Submit empty required field, assert error message appears          |
| 4   | `formState.isDirty`                      | Type in field, assert isDirty text updates                         |
| 5   | `formState.isSubmitting`                 | Submit with async handler, assert "submitting" text shown          |
| 6   | `useFormContext()`                       | Child component reads watched value from context                   |
| 7   | `<Controller>`                           | Render controlled input, type, assert value shown                  |
| 8   | `useController`                          | Hook-based controlled input, type, assert value shown              |
| 9   | `useWatch({ control })`                  | Watch with explicit control prop, assert updates                   |
| 10  | `useWatch()` (context)                   | Watch without control (via FormProvider), assert updates           |
| 11  | `useFormState()`                         | Submit empty required field, assert error via hook                 |
| 12  | `getValues()` in render                  | Read value in render after user types, assert fresh                |
| 13  | `getFieldState()` in render              | Touch field, assert fieldState reflects it                         |
| 14  | `reset()`                                | Fill form, click reset button, assert values cleared               |
| 15  | `formState.touchedFields`                | Touch field, assert touchedFields updates                          |
| 16  | `formState.submitCount`                  | Submit form multiple times, assert count increments                |
| 17  | `formState.isValidating`                 | Submit with async validator, assert isValidating shown             |
| 18  | `reset()` with new defaults              | Reset with new defaultValues, assert form updates                  |
| 19  | `watch()` with callback                  | Subscribe via callback, assert callback fires on change            |
| 20  | `watch` in useEffect deps                | Watch value in useEffect dependency array, assert effect fires     |
| 21  | Conditional fields via watch             | Show/hide fields based on watched select value                     |
| 22  | Nested watch paths                       | Watch `user.address.city`, assert deep changes propagate           |
| 23  | `setValue` then `watch`                  | Call setValue programmatically, assert watch returns updated value |
| 24  | `useFieldArray` + `watch`                | Append items to field array, assert watched array updates          |
| 25  | `formState` destructuring                | Destructure formState, assert fields reflect changes               |
| 26  | `formState.isDirty` via `useFormContext` | Child reads isDirty from context, assert updates after typing      |
| 27  | `getValues()` with array arg             | Call getValues(['a', 'b']), assert fresh subset returned           |
| 28  | `useForm({ values })` (register)         | Change external state, assert register-bound input updates in DOM  |

### Workaround tests (14 tests)

For each core API that fails under the compiler, there is a corresponding workaround test that demonstrates a safe alternative -- typically a hook-based subscription (`useWatch`, `useFormState`) or `'use no memo'` when no alternative exists.

## Actual results

Tested with `babel-plugin-react-compiler@1.0.0` (GA), `react-hook-form@^7.75.0`, `react@19.2.5`, `babel-plugin-react-compiler` `target: '19'`:

| API                              | Without Compiler | With Compiler | Notes                                                                                                                                                                                                                                                            |
| -------------------------------- | ---------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `form.watch('field')`            | PASS             | PASS          | Auto-bailed-out by RC 1.0 when called on a `useForm()` return value in the same component                                                                                                                                                                        |
| `form.watch()` (no args)         | PASS             | PASS          | Same as above                                                                                                                                                                                                                                                    |
| `formState.errors`               | PASS             | PASS          | Proxy subscription triggers re-render                                                                                                                                                                                                                            |
| `formState.isDirty`              | PASS             | PASS          | Proxy subscription triggers re-render                                                                                                                                                                                                                            |
| `formState.isSubmitting`         | PASS             | PASS          | Proxy subscription triggers re-render                                                                                                                                                                                                                            |
| `formState.touchedFields`        | PASS             | PASS          | Proxy subscription triggers re-render                                                                                                                                                                                                                            |
| `formState.submitCount`          | PASS             | PASS          | Proxy subscription triggers re-render                                                                                                                                                                                                                            |
| `formState.isValidating`         | PASS             | PASS          | Proxy subscription triggers re-render                                                                                                                                                                                                                            |
| `formState` destructuring        | PASS             | PASS          | Destructuring accesses the proxy correctly                                                                                                                                                                                                                       |
| `useFormContext()` + watch       | PASS             | **FAIL** ❌   | Auto-bailout doesn't apply through the context boundary -- [#12618](https://github.com/react-hook-form/react-hook-form/issues/12618)                                                                                                                             |
| `<Controller>`                   | PASS             | PASS          | Internal `useController` subscribes independently                                                                                                                                                                                                                |
| `useController`                  | PASS             | PASS          | Hook-based subscription works                                                                                                                                                                                                                                    |
| `useWatch({ control })`          | PASS             | PASS          | Hook-based subscription works                                                                                                                                                                                                                                    |
| `useWatch()` (context)           | PASS             | PASS          | Hook-based subscription works                                                                                                                                                                                                                                    |
| `useFormState()`                 | PASS             | PASS          | Hook-based subscription works                                                                                                                                                                                                                                    |
| `getValues()` in render          | PASS             | PASS          | Auto-bailed-out when called on a `useForm()` return value                                                                                                                                                                                                        |
| `getValues(['a','b'])`           | PASS             | PASS          | Array variant works                                                                                                                                                                                                                                              |
| `getFieldState()` in render      | PASS             | PASS          | Works                                                                                                                                                                                                                                                            |
| `reset()`                        | PASS             | PASS          | Works (test asserts DOM `input.value` after reset)                                                                                                                                                                                                               |
| `reset()` with new defaults      | PASS             | PASS          | Works                                                                                                                                                                                                                                                            |
| `watch()` with callback          | PASS             | PASS          | Callback-based subscription works                                                                                                                                                                                                                                |
| `watch` in useEffect deps        | PASS             | PASS          | Effect re-runs when the watched value changes                                                                                                                                                                                                                    |
| Conditional fields via watch     | PASS             | PASS          | Conditional sections render and hide as expected                                                                                                                                                                                                                 |
| Nested watch paths               | PASS             | PASS          | Deep property updates propagate                                                                                                                                                                                                                                  |
| `setValue` + `watch`             | PASS             | PASS          | Programmatic setValue triggers re-render                                                                                                                                                                                                                         |
| `useFieldArray` + `watch`        | PASS             | PASS          | Watched array updates after append                                                                                                                                                                                                                               |
| `formState.isDirty` via context  | PASS             | **FAIL** ❌   | Auto-bailout doesn't apply through the context boundary                                                                                                                                                                                                          |
| `useForm({ values })` (register) | PASS             | **FAIL** ❌   | External `values` prop change does not propagate to register-bound DOM inputs. Internal `_reset(values, { keepFieldsRef: true })` iterates `_names.mount`, but compiler caching of `register(name)` leaves the mount set out of sync. Use `<Controller>` instead |

**Summary: 3 of 28 core tests fail** under the compiler -- two involve `useFormContext()` in a child component reading interior-mutable values, and one is the `useForm({ values })` + register edit-form pattern. All 14 workaround tests pass.

## Workarounds

The remaining failure modes group into two patterns: `useFormContext()` in a child component, and `useForm({ values })` injecting external state into a register-bound input.

| Breaking API                                     | Recommended Workaround                                                                                                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useFormContext()` + `form.watch(...)` in child  | Replace with `useWatch({ name, control })`. Pass `control` from `useFormContext()` or as a prop. The hook-based subscription is the supported, compiler-safe pattern                       |
| `useFormContext()` + `form.formState.X` in child | Replace with `useFormState({ control })`. Same idea: a hook-based subscription rather than reading the proxy through the context value                                                     |
| `useForm({ values })` + register                 | Bind the field with `<Controller>` instead of `register`. Controller's internal `useController` subscribes independently of the parent's render path and tracks `values` updates correctly |

If none of the alternatives are acceptable, fall back to `'use no memo'` on the affected component. See the [`'use no memo'` section](#the-workaround-use-no-memo).

### Surprising findings

`formState` proxy access (in the same component) is robust under the compiler. The proxy subscription mechanism integrates cleanly with React rendering even when the rest of the form object is interior-mutable.

Two sharp edges remain:

- **The `useFormContext()` boundary.** As soon as you cross `<FormProvider>` and read `form.watch(...)` or `form.formState` in a compiled child, the compiler memoizes the child's render based on the (stable) form reference, and interior changes don't trigger updates. The `useWatch`/`useFormState` hooks subscribe explicitly and therefore stay correct.
- **`useForm({ values })` + register.** Note that `reset()` and `reset({ ... })` (Tests 14 and 18) both pass under the compiler. The `values` prop, however, is implemented as a `useEffect` that calls `_reset(values, { keepFieldsRef: true })`, which iterates `_names.mount` and re-applies values via `setValue`. Compiler caching of the `register(name)` call site means `_names.mount` is not re-populated after the first render, so the loop becomes empty on subsequent `values` changes and the DOM stays stale. Switching to `<Controller>` sidesteps the mount-set entirely.

## How it works

The test harness uses a **Bun plugin** (`compiler-plugin.ts`) that intercepts `.tsx` file imports and transforms them through `@babel/core` with `babel-plugin-react-compiler` before Bun processes them. This simulates what Next.js (or any other build tool) does at build time when the compiler is enabled.

Key details:

- The plugin only transforms files in the project directory, not `node_modules`
- It targets React 19 (`{ target: '19' }`)
- Without the `--preload` flag, Bun processes `.tsx` files normally (no compiler transform)
- The same test file runs in both modes, so any difference in behavior is caused by the compiler

### File structure

```
rhf-compiler-compat/
  package.json              # Dependencies and npm scripts
  bunfig.toml               # Bun config (happy-dom test environment)
  happydom.ts               # happy-dom global registrator
  compiler-plugin.ts        # Bun plugin applying babel-plugin-react-compiler
  rhf-compat.test.tsx       # All 40 test scenarios
  run-tests.sh              # Runs both modes and prints comparison
  FINAL-TEST-RESULTS.md     # Detailed test results and analysis
  README.md                 # This file
```

## The workaround: `'use no memo'`

If you encounter an incompatibility (today, that means context-based access patterns), you can opt out of memoization for the affected component:

```tsx
function ChildReadingForm() {
  'use no memo' // Opt out of React Compiler -- react-hook-form interior mutability via context
  const { watch, formState } = useFormContext()
  const value = watch('field')
  // ...
}
```

It must be added to **each** component that reads interior-mutable values from the form during render. **Prefer hook-based alternatives (`useWatch({ control })`, `useFormState({ control })`) when available** -- they don't sacrifice the compiler's optimizations elsewhere in the file.

## Contributing

Contributions are welcome. To add a new test scenario:

1. Add a new `test()` block in `rhf-compat.test.tsx`
2. Follow the existing pattern: render a minimal component, interact with it via `@testing-library/user-event`, assert the expected DOM state
3. Make sure the test passes without the compiler (`bun test`)
4. Run with compiler (`bun run test:compiler`) and document whether it passes or fails
5. If the test fails under the compiler, add a corresponding workaround test using a safe alternative API (`useWatch`, `useFormState`) or `'use no memo'` if no alternative exists
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

- React Compiler 1.0 GA + react-hook-form 7.7x cover the majority of common access patterns. Most APIs work without any compiler hint.
- The remaining `useFormContext()` boundary issues are likely fixable either in the compiler (extending the auto-bailout list) or in react-hook-form (changing how `useFormContext()` returns interior-mutable values). Track [#12618](https://github.com/react-hook-form/react-hook-form/issues/12618) for progress.
- For new code, prefer `useWatch({ control })` and `useFormState({ control })` over `form.watch()` / `form.formState` when crossing component boundaries -- they are explicit subscription APIs and are robust to compiler changes.

## License

MIT
