# React Hook Form + React Compiler: Test Results

**Date:** 2026-02-17
**Test Suite:** `rhf-compat.test.tsx` (26 tests)
**React Compiler:** `babel-plugin-react-compiler@19.1.0-rc.3`
**React Hook Form:** `^7.42.1`
**React:** `18.3.1`

---

## Executive Summary

| Metric | Baseline | With Compiler | Delta |
|--------|----------|---------------|-------|
| **Tests Pass** | 26 | 14 | **-12** ❌ |
| **Tests Fail** | 0 | 12 | **+12** ❌ |
| **Success Rate** | 100% | 54% | **-46%** |

**Conclusion:** React Compiler breaks **12 out of 26** react-hook-form patterns (46% failure rate).

---

## ❌ Tests FAILING with Compiler (12 total)

### Core Broken APIs (7)

| # | Test Name | API | Impact |
|---|-----------|-----|--------|
| 1 | `form.watch('field')` updates when input changes | `form.watch()` | **CRITICAL** |
| 2 | `form.watch()` (no args) triggers re-render | `form.watch()` | **HIGH** |
| 6 | `useFormContext()` propagates updates to children | `useFormContext()` | **CRITICAL** |
| 7 | `<Controller>` updates on input change | `<Controller>` | **HIGH** |
| 8 | `useController` updates on input change | `useController` | **HIGH** |
| 12 | `getValues()` in render returns fresh values | `form.getValues()` | **MEDIUM** |
| 14 | `reset()` clears form values and state | `form.reset()` | **MEDIUM** |

### Critical Real-World Patterns (5)

| # | Test Name | Pattern | Impact |
|---|-----------|---------|--------|
| 18 | `reset()` with new defaultValues updates form values | Dynamic defaults | **MEDIUM** |
| 20 | watch in useEffect dependency array triggers effect | Data fetching | **HIGH** |
| 21 | Conditional fields render based on watched value | Show/hide fields | **CRITICAL** ⚠️ |
| 22 | Nested watch paths update on nested field changes | Deep objects | **HIGH** |
| 24 | useFieldArray with watch reflects array changes | Dynamic arrays | **CRITICAL** ⚠️ |

---

## ✅ Tests PASSING with Compiler (14 total)

### formState APIs (surprisingly safe!)

| # | Test Name | API | Notes |
|---|-----------|-----|-------|
| 3 | formState.errors appears after invalid submit | `formState.errors` | ✅ Works |
| 4 | formState.isDirty updates after typing | `formState.isDirty` | ✅ Works |
| 5 | formState.isSubmitting is true during async submission | `formState.isSubmitting` | ✅ Works |
| 15 | formState.touchedFields updates when field is touched | `formState.touchedFields` | ✅ Works |
| 16 | formState.submitCount increments on each submit | `formState.submitCount` | ✅ Works |
| 17 | formState.isValidating is true during async validation | `formState.isValidating` | ✅ Works |
| 25 | formState destructuring reflects changes | Destructuring | ✅ Works |

### Hook-Based Alternatives (safe)

| # | Test Name | API | Notes |
|---|-----------|-----|-------|
| 9 | useWatch with explicit control prop | `useWatch({ control })` | ✅ Works |
| 10 | useWatch via context updates | `useWatch()` (context) | ✅ Works |
| 11 | useFormState propagates errors | `useFormState()` | ✅ Works |

### Edge Cases (safe)

| # | Test Name | Pattern | Notes |
|---|-----------|---------|-------|
| 13 | getFieldState in render returns fresh state | `getFieldState()` | ✅ Works |
| 19 | watch with callback is invoked on form changes | Callback pattern | ✅ Works |
| 23 | setValue then immediate watch returns updated value | Race condition | ✅ Works |
| 26 | getValues with array argument returns fresh subset | Array syntax | ✅ Works |

---

## 🔴 Critical Real-World Patterns That Break

### 1. Conditional Fields Based on Watch (Test 21) - CRITICAL

**Pattern:**
```tsx
const type = form.watch('fieldType')
return (
  <>
    {type === 'option1' && <OptionOneFields />}
    {type === 'option2' && <OptionTwoFields />}
  </>
)
```

**Impact:** Conditional form sections never appear when user changes selection. The `watch` result is cached by the compiler, so changing the select doesn't trigger re-render of the conditional sections.

**Workaround:** Add `'use no memo'` to the component.

---

### 2. useFieldArray + watch (Test 24) - CRITICAL

**Pattern:**
```tsx
const { fields, append } = useFieldArray({ name: 'items' })
const itemsArray = form.watch('items')
return fields.map((field, i) => <ItemRow item={itemsArray[i]} />)
```

**Impact:** Adding new array items doesn't update the watched array. New items appear as undefined or empty in the UI.

**Workaround:** Add `'use no memo'` to the component or migrate to `useWatch({ name: 'items', control })`.

---

### 3. useFormContext (Test 6) - AFFECTS SHARED FORM CONTEXTS

**Pattern:**
```tsx
// Parent
<FormProvider {...form}>
  <ChildComponent />
</FormProvider>

// Child
const form = useFormContext()
const value = form.watch('field') // Cached by compiler
```

**Impact:** Child components don't re-render when form state changes. Common in form component libraries that wrap `useFormContext`.

**Workaround:** Add `'use no memo'` to child components that use `useFormContext` + watch/getValues.

---

### 4. watch in useEffect Dependencies (Test 20) - DATA FETCHING PATTERN

**Pattern:**
```tsx
const selectedId = form.watch('selectedId')
useEffect(() => {
  if (selectedId) {
    fetchData(selectedId)
  }
}, [selectedId])
```

**Impact:** Effect doesn't re-run when watched value changes because compiler caches the watch result.

**Workaround:** Use `useWatch` instead of `form.watch`, or add `'use no memo'` to the component.

---

### 5. Nested Watch Paths (Test 22)

**Pattern:**
```tsx
const city = form.watch('user.address.city')
```

**Impact:** Deep property updates don't propagate to the watched value.

**Workaround:** Add `'use no memo'` or use `useWatch`.

---

## Surprising Positives

The **formState** APIs all work despite being listed as broken in GitHub issues:
- `formState.errors` ✅
- `formState.isDirty` ✅
- `formState.isSubmitting` ✅
- `formState.touchedFields` ✅
- `formState.submitCount` ✅
- `formState.isValidating` ✅

This suggests the compiler handles the formState proxy object better than expected. However, **do not rely on this** - future compiler versions may change this behavior.

---

## Recommended Actions

### 1. Use `'use no memo'` Directive

Add the directive to components using broken patterns:

```tsx
function MyComponent() {
  'use no memo' // Disable React Compiler — form.watch() uses interior mutability
  const form = useFormContext()
  const value = form.watch('field')
  // ...
}
```

**Apply to:**
- Components using `form.watch()` in render
- Components using `useFormContext()` + watch/getValues
- Components with conditional fields based on watch
- Components using useFieldArray + watch

### 2. Migrate to Safer Patterns

**Instead of `form.watch()`:**
```tsx
// Before (broken)
const value = form.watch('field')

// After (safe)
const value = useWatch({ name: 'field', control: form.control })
```

**Instead of `form.formState`:**
```tsx
// Before (works but fragile)
const { errors, isDirty } = form.formState

// After (more future-proof)
const { errors, isDirty } = useFormState({ control: form.control })
```

### 3. Compiler Configuration

Disable compiler for form-heavy files if needed:

```js
// next.config.js
reactCompiler: {
  target: '18',
  sources: (filename) => {
    // Disable for specific directories
    if (filename.includes('components/forms')) return false
    return true
  }
}
```

---

## Test Files Generated

- `rhf-compat.test.tsx` - All 26 tests in one file
- `/tmp/rhf-no-compiler.txt` - Baseline test output (26 pass)
- `/tmp/rhf-with-compiler.txt` - Compiler test output (14 pass, 12 fail)
- `test-results-both-runs.txt` - Combined output from both runs

---

## How to Run Tests

```bash
cd rhf-compiler-compat

# Install dependencies
bun install

# Run baseline tests (should show 26 pass, 0 fail)
bun test rhf-compat.test.tsx

# Run with React Compiler (should show 14 pass, 12 fail)
bun test --preload ./compiler-plugin.ts rhf-compat.test.tsx

# Run both and compare
bun run test:both
```

---

## Sharing with Community

This test suite provides empirical evidence for the react-hook-form maintainers. Consider:

1. Opening a GitHub issue with this test suite attached
2. Contributing tests upstream to RHF's own test suite
3. Sharing with React Compiler team to improve auto-detection

---

## Related Issues

- [#11910](https://github.com/react-hook-form/react-hook-form/issues/11910) - watch doesn't work
- [#12298](https://github.com/react-hook-form/react-hook-form/issues/12298) - 35 of 871 RHF tests fail
- [#12598](https://github.com/react-hook-form/react-hook-form/issues/12598) - watch() does not update
- [#12618](https://github.com/react-hook-form/react-hook-form/issues/12618) - useFormContext breaks
- [Discussion #12524](https://github.com/orgs/react-hook-form/discussions/12524) - React Compiler support
- [facebook/react#29174](https://github.com/facebook/react/issues/29174) - Compiler bug about RHF
- [React Docs](https://react.dev/reference/eslint-plugin-react-hooks/lints/incompatible-library) - Incompatible libraries
