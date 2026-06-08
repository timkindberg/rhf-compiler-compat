# react-hook-form + React Compiler Compatibility Tests — `react-hook-form@8.0.0-beta.2`

> _This report covers `react-hook-form@8.0.0-beta.2` + React 19 + `babel-plugin-react-compiler@1.0.0` (GA). For earlier results see [REPORT-compiler-1.0.0.md](./REPORT-compiler-1.0.0.md) (RHF 7.75.0) and [REPORT-compiler-19.1.0-rc.3.md](./REPORT-compiler-19.1.0-rc.3.md) (RHF 7.42.1, React 18)._

React Hook Form v8 beta claims **first-class React Compiler support — "compatible out of the box, no additional configuration required"** ([migration guide](https://react-hook-form.com/migrate-v7-to-v8), [#12298](https://github.com/react-hook-form/react-hook-form/issues/12298)). This report verifies that claim and — going **beyond pass/fail** — inspects what the React Compiler *actually emits* for RHF code, so the claim can be qualified precisely.

## TL;DR

- **Correctness: the claim holds.** Every pattern that broke under the compiler on v7.75 now works on v8 beta. The canonical suite goes from **37/42 → 42/42** with the compiler enabled, and a 10-test "hole-hunting" suite targeting the memoized paths finds **zero** regressions.
- **But "compatible" ≠ "optimized."** The React Compiler still **bails out of memoizing any component that calls `useForm().watch()`** — it emits those components unchanged (no memo cache). They work, but get *no* compiler benefit. The migration guide doesn't mention this.
- **That bailout is now obsolete.** We proved v8's `watch()` is genuinely memoization-safe (it works even when we *force* the compiler to memoize it). The bailout is a hardcoded, version-agnostic entry inside `babel-plugin-react-compiler` that v8 no longer needs.
- **Root cause of the fix:** v8's `useForm()` returns a **fresh `form` object and a fresh `watch` function on every render** (while keeping `control` stable). Fresh identity busts the compiler's reference-keyed memo cache, so `watch()` re-runs each render instead of serving a stale cached value.

## Versions

| | |
| --- | --- |
| `react-hook-form` | `8.0.0-beta.2` |
| `react` / `react-dom` | `19.2.5` |
| `babel-plugin-react-compiler` | `1.0.0` (GA), `target: '19'` |
| Bun | `1.3.x` |

The compiler version is identical to [REPORT-compiler-1.0.0.md](./REPORT-compiler-1.0.0.md); **the only variable in this report is the RHF version** (7.75.0 → 8.0.0-beta.2). That isolation is what makes the before/after attributable to RHF and not the compiler.

## How to run

```bash
bun install

# Canonical suite (42 tests), baseline then compiler:
bun run test:both

# Aggressive regression tests on the paths the compiler DOES memoize:
bun test holes.test.tsx
bun test --preload ./compiler-plugin.ts holes.test.tsx

# Force the compiler to memoize useForm().watch() (defeats the bailout):
bun test --preload ./compiler-plugin.ts forced.test.tsx

# Inspect what the compiler emits (success / skip / bailout, memoized or not):
bun inspect-compile.mjs      # per-pattern compile vs bailout diagnostics
bun inspect-output.mjs       # prints emitted code; flags memoized vs untouched
bun inspect-destructure.mjs  # whether the bailout tracks `watch` through destructuring

# Identity probes that explain the mechanism:
bun test identity.test.tsx          # useForm() reference stability across renders
bun test context-identity.test.tsx  # context child form identity across renders
bun test context-cost.test.tsx      # does the fresh ref cascade re-renders? (no)
```

> ⚠️ Run the extra `*.test.tsx` files **individually**. Bun executes test files concurrently against a single shared happy-dom global; running them all together causes `data-testid` collisions across files (a harness artifact, not an RHF/compiler issue). The canonical `rhf-compat.test.tsx` is self-contained and is the authoritative comparison.

## Results — canonical suite (42 tests)

| Stack | Without compiler | With compiler |
| --- | --- | --- |
| RHF 7.75.0 (prior report) | 42 pass | **37 pass / 5 fail** |
| **RHF 8.0.0-beta.2 (this report)** | 42 pass | **42 pass / 0 fail** ✅ |

The five patterns that failed under the compiler on v7.75 — and now pass on v8:

| # | Pattern | v7.75 + compiler | v8 + compiler |
| --- | --- | --- | --- |
| 6 | `useFormContext()` + `watch` in child | ❌ FAIL | ✅ PASS |
| 14 | `reset()` with `register`-bound fields | ❌ FAIL | ✅ PASS |
| 18 | `reset({...})` new defaults, `register` | ❌ FAIL | ✅ PASS |
| 26 | `formState.isDirty` via `useFormContext` | ❌ FAIL | ✅ PASS |
| 28 | `useForm({ values })` with `register` | ❌ FAIL | ✅ PASS |

The two v8 breaking changes that touch the suite were migrated: `watch((data) => …)` callback → `subscribe({ formState: { values: true }, callback })`, and `useFieldArray` `field.id` → `field.key`.

## Beyond pass/fail — what the compiler actually emits

A green test only proves *behavior*. It does **not** prove the component was optimized. The compiler can make a component "work" simply by **refusing to compile it**. So we inspected the emitted output for representative patterns.

### 1. The compiler hard-codes a bailout for `useForm().watch()`

`babel-plugin-react-compiler@1.0.0` ships a `defaultModuleTypeProvider` that special-cases `react-hook-form` by import-source string:

```js
// node_modules/babel-plugin-react-compiler/dist/index.js
function defaultModuleTypeProvider(moduleName) {
  switch (moduleName) {
    case "react-hook-form": {
      return { kind: "object", properties: { useForm: { kind: "hook",
        returnType: { kind: "object", properties: {
          // Only the `watch()` function returned by react-hook-form's `useForm()` API is incompatible
          watch: { /* ... */ returnValueKind: "mutable",
            knownIncompatible: `React Hook Form's \`useForm()\` API returns a \`watch()\` function which cannot be memoized safely.` }
        } } } } };
    }
    // @tanstack/react-table, @tanstack/react-virtual ...
  }
}
```

When the compiler sees `useForm().watch()` it raises **`Use of incompatible library`** and emits the **entire component unchanged**.

`bun inspect-compile.mjs` (compile outcome per pattern):

```
watch-direct     -> ERROR(Use of incompatible library)   # form.watch('name')
watch-all        -> ERROR(Use of incompatible library)   # form.watch()
getvalues-render -> ERROR(Use of incompatible library)   # form.watch() + getValues()
formstate-proxy  -> SUCCESS                                # form.formState.{errors,isDirty}
context-child    -> SUCCESS                                # useFormContext().watch('name')
usewatch-hook    -> SUCCESS                                # useWatch({ control })
reset-register   -> SUCCESS                                # register + reset()
```

`bun inspect-output.mjs` (is a memo cache actually emitted?):

```
watch-direct (form.watch)  -> MEMOIZED BY COMPILER: NO (bailed out)
usewatch (migrated)        -> MEMOIZED BY COMPILER: YES   (_c(12) cache slots)
reset-register             -> MEMOIZED BY COMPILER: YES
```

The bailout tracks `watch` through destructuring too, but **only from `useForm()`** — not from `useFormContext()` (`bun inspect-destructure.mjs`):

```
member  form.watch()                       -> memoized=no   [ERROR(Use of incompatible library)]
destructured { watch } from useForm        -> memoized=no   [ERROR(Use of incompatible library)]
destructured { watch } from useFormContext -> memoized=YES  [CompileSuccess]
```

**Implication:** in a real v8 codebase, every component that does `const x = form.watch('field')` — the single most common RHF pattern — is silently excluded from compilation. It is *correct*, but receives *none* of the compiler's optimization. To actually get those components memoized you must migrate `form.watch()` → `useWatch({ control })`, which the migration guide does not mention.

### 2. The bailout is now unnecessary — v8's `watch()` is memoization-safe

Because the bailout keys on the import-source string, re-exporting `useForm` through a local module (`rhf-reexport.ts`) hides it from the type provider and **forces** the compiler to memoize `useForm().watch()`. `forced.test.tsx` does exactly that:

| Forced-memoization of `useForm().watch()` (+ conditional fields) | Result |
| --- | --- |
| v7.75 + compiler | **0 pass / 2 fail** |
| **v8 beta + compiler** | **2 pass / 0 fail** ✅ |

Same compiler, same forced memoization, only the RHF runtime differs. v8's `watch()` works under full memoization; v7's did not. The hardcoded bailout protects against a v7-era hazard that v8 has fixed.

## Root cause — why v8 is compiler-safe

The compiler **does** cache `form.watch("name")`, keyed on the `form` reference (`inspect-output.mjs`, forced path):

```js
let t1;
if ($[1] !== form) {        // cache key is the `form` reference
  t1 = form.watch("name");
  $[1] = form;
  $[2] = t1;
} else {
  t1 = $[2];                // stale value reused while `form` identity is stable
}
const name = t1;
```

So the cache only invalidates when `form`'s identity changes. `identity.test.tsx` measures that identity across renders:

| | `form` (4 renders) | `watch` | `control` |
| --- | --- | --- | --- |
| RHF 7.75.0 | **1** (stable) | **1** (stable) | 1 (stable) |
| **RHF 8.0.0-beta.2** | **4** (fresh each render) | **4** (fresh each render) | 1 (stable) |

**v8 returns a brand-new `form` object and a brand-new `watch` function on every render**, while keeping `control` stable. Fresh identity → `$[1] !== form` is always true → `watch()` is re-invoked every render → fresh value. On v7 the stable identity meant the cache never invalidated → stale value → the 5 failures.

The same mechanism explains the `useFormContext()` path. `context-identity.test.tsx`: a context child that watches a field gets a **fresh `form` reference every time it re-renders due to a form-state change** (v8: `child renders=5, uniqueChildForm=5`, pass; v7.75 + compiler: fail). And `context-cost.test.tsx` confirms this fresh identity does **not** cause a re-render storm — a memoized `useFormContext()` child does **not** re-render on unrelated parent renders on either version (`extraAfter3UnrelatedBumps=0`). `<FormProvider>` publishes a context value whose identity changes on form-state changes but is stable otherwise.

## Hole-hunting — no regressions on the memoized paths

A green canonical suite isn't enough, because most of it is either bailed-out (`form.watch()`) or hook-based. `holes.test.tsx` adds 10 tests that deliberately exercise patterns the compiler **does** memoize, where a real regression would hide. All pass with and without the compiler:

| # | Pattern (all compiled/memoized) | With compiler |
| --- | --- | --- |
| H1 | `formState.errors` via `useFormContext` child | ✅ |
| H2 | conditional fields via `useWatch` in child | ✅ |
| H3 | `useFieldArray` `remove` updates rows | ✅ |
| H4 | `useFieldArray` `swap` reorders values | ✅ |
| H5 | `useMemo` derived from `useWatch` | ✅ |
| H6 | `Controller` inside `useFieldArray` rows | ✅ |
| H7 | `setValue` → `useWatch` child | ✅ |
| H8 | scoped `useFormState({ control, name })` | ✅ |
| H9 | nested `useWatch` path via context | ✅ |
| H10 | `reset({...})` updates `register` input **and** `useWatch` | ✅ |

## Feedback for the maintainers

1. **Coordinate with the React Compiler team to retire (or version-gate) the `react-hook-form` entry in `defaultModuleTypeProvider`.** v8's `watch()` is memoization-safe (proven above), yet the hardcoded bailout still excludes every `form.watch()` component from compilation. Until that lands, the "compatible out of the box" claim is true for *correctness* but those components are never *optimized*.

2. **Document the `watch()` optimization gap in the migration guide.** "No configuration required" is accurate for correctness; it should add that `form.watch()` components are skipped by the compiler's bailout, and that migrating `form.watch()` → `useWatch({ control })` is what unlocks memoization. Same applies to `getValues()` used alongside `watch()`.

3. **Fix the `subscribe` example in the migration guide.** The guide shows `subscribe({ formValues: true }, ({ values }) => …)`, but the shipped beta.2 type/runtime is a single payload: `subscribe({ formState: { values: true }, callback: ({ values }) => … })`. The guide snippet does not type-check against beta.2.

4. **Consider documenting the fresh-identity contract.** v8 now returns a fresh `form`/`watch` each render (with stable `control`). This is the right call for the compiler, but it is a behavioral change for anyone relying on `form`/`watch` referential stability (e.g. as `useEffect`/`useMemo` deps or `React.memo` props). Worth an explicit note that `control` is the stable handle to pass around.

## File structure

```
rhf-compiler-compat/
  rhf-compat.test.tsx          # canonical 42-test suite (migrated to v8 APIs)
  holes.test.tsx               # 10 regression tests on memoized paths
  forced.test.tsx              # forces memoization of useForm().watch()
  rhf-reexport.ts              # re-export that defeats the compiler's source-string bailout
  identity.test.tsx            # useForm() reference-stability probe
  context-identity.test.tsx    # context-child form-identity probe
  context-cost.test.tsx        # re-render cascade probe
  inspect-compile.mjs          # compile vs skip vs bailout, per pattern
  inspect-output.mjs           # prints emitted code; memoized vs untouched
  inspect-destructure.mjs      # bailout tracking through destructuring
  compiler-plugin.ts           # Bun loader applying babel-plugin-react-compiler
  run-tests.sh                 # canonical suite, baseline vs compiler
  REPORT-rhf-8.0.0-beta.2.md   # this report
  REPORT-compiler-1.0.0.md     # RHF 7.75.0 + React 19 + compiler 1.0 GA
  REPORT-compiler-19.1.0-rc.3.md # RHF 7.42.1 + React 18 + compiler RC
```

## License

MIT
