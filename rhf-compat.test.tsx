/**
 * react-hook-form + React Compiler Compatibility Test Suite
 *
 * This file tests 27 react-hook-form APIs and patterns to determine which
 * ones break when React Compiler is enabled. The compiler auto-memoizes
 * component renders, but react-hook-form relies on interior mutability
 * (objects that change internal state without changing their reference).
 * The compiler can't detect these changes, causing watched values to go stale.
 *
 * Run modes:
 *   - Baseline (no compiler):  bun test rhf-compat.test.tsx
 *   - With compiler:           bun test --preload ./compiler-plugin.ts rhf-compat.test.tsx
 *
 * All 27 tests should PASS without the compiler. Failures with the
 * compiler enabled indicate a confirmed incompatibility.
 *
 * See: https://github.com/react-hook-form/react-hook-form/issues/12298
 */

import { describe, test, expect } from 'bun:test'
import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  useForm,
  useFormContext,
  useWatch,
  useController,
  useFormState,
  useFieldArray,
  Controller,
  FormProvider,
} from 'react-hook-form'

// ---------------------------------------------------------------------------
// Test 1: form.watch('field') updates when input changes
// ---------------------------------------------------------------------------
// The most commonly reported issue. form.watch() returns changing values
// from a stable object reference. The compiler caches the result because
// the form reference never changes, so the watched value is stale.
// See: https://github.com/react-hook-form/react-hook-form/issues/11910

test("form.watch('field') updates when input changes", async () => {
  function WatchFieldComponent() {
    const form = useForm({ defaultValues: { name: '' } })
    const nameValue = form.watch('name')

    return (
      <form>
        <input data-testid="name-input" {...form.register('name')} />
        <span data-testid="watched-value">{nameValue}</span>
      </form>
    )
  }

  render(<WatchFieldComponent />)
  const input = screen.getByTestId('name-input')
  await userEvent.type(input, 'hello')

  await waitFor(() => {
    expect(screen.getByTestId('watched-value').textContent).toBe('hello')
  })
})

// Workaround: Use useWatch instead of form.watch().
// useWatch uses a subscription model that properly triggers re-renders with the compiler.
test("form.watch('field') updates when input changes (workaround)", async () => {
  function WatchFieldComponent() {
    const form = useForm({ defaultValues: { name: '' } })
    const nameValue = useWatch({ name: 'name', control: form.control })

    return (
      <form>
        <input data-testid="name-input-w" {...form.register('name')} />
        <span data-testid="watched-value-w">{nameValue}</span>
      </form>
    )
  }

  render(<WatchFieldComponent />)
  const input = screen.getByTestId('name-input-w')
  await userEvent.type(input, 'hello')

  await waitFor(() => {
    expect(screen.getByTestId('watched-value-w').textContent).toBe('hello')
  })
})

// ---------------------------------------------------------------------------
// Test 2: form.watch() (no args) triggers re-render on any field change
// ---------------------------------------------------------------------------
// Calling watch() with no arguments subscribes to ALL field changes.
// Used as a "force re-render on any change" pattern. The compiler
// eliminates the re-render since it sees the same form reference.
// See: https://github.com/react-hook-form/react-hook-form/issues/12598

test('form.watch() (no args) triggers re-render on any field change', async () => {
  function WatchAllComponent() {
    const form = useForm({ defaultValues: { firstName: '', lastName: '' } })
    const allValues = form.watch()

    return (
      <form>
        <input data-testid="first-input" {...form.register('firstName')} />
        <input data-testid="last-input" {...form.register('lastName')} />
        <span data-testid="all-values">
          {allValues.firstName},{allValues.lastName}
        </span>
      </form>
    )
  }

  render(<WatchAllComponent />)

  await userEvent.type(screen.getByTestId('first-input'), 'John')
  await waitFor(() => {
    expect(screen.getByTestId('all-values').textContent).toBe('John,')
  })

  await userEvent.type(screen.getByTestId('last-input'), 'Doe')
  await waitFor(() => {
    expect(screen.getByTestId('all-values').textContent).toBe('John,Doe')
  })
})

// Workaround: Use useWatch instead of form.watch().
// This uses a subscription model that properly triggers re-renders with the compiler.
test('form.watch() (no args) triggers re-render on any field change (workaround)', async () => {
  function WatchAllComponent() {
    const form = useForm({ defaultValues: { firstName: '', lastName: '' } })
    const allValues = useWatch({ control: form.control })

    return (
      <form>
        <input data-testid="first-input-w" {...form.register('firstName')} />
        <input data-testid="last-input-w" {...form.register('lastName')} />
        <span data-testid="all-values-w">
          {allValues.firstName},{allValues.lastName}
        </span>
      </form>
    )
  }

  render(<WatchAllComponent />)

  await userEvent.type(screen.getByTestId('first-input-w'), 'John')
  await waitFor(() => {
    expect(screen.getByTestId('all-values-w').textContent).toBe('John,')
  })

  await userEvent.type(screen.getByTestId('last-input-w'), 'Doe')
  await waitFor(() => {
    expect(screen.getByTestId('all-values-w').textContent).toBe('John,Doe')
  })
})

// ---------------------------------------------------------------------------
// Test 3: formState.errors appears after invalid submit
// ---------------------------------------------------------------------------
// formState is a proxy object with interior mutability. The compiler
// memoizes access to formState.errors because the formState reference
// doesn't change, so validation errors never appear in the UI.
// See: https://github.com/react-hook-form/react-hook-form/issues/12298

test('formState.errors appears after invalid submit', async () => {
  function ErrorsComponent() {
    const form = useForm({ defaultValues: { email: '' } })
    const { errors } = form.formState

    const onSubmit = form.handleSubmit(() => {
      // no-op: this should not be called when validation fails
    })

    return (
      <form onSubmit={onSubmit}>
        <input
          data-testid="email-input"
          {...form.register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: 'Invalid email format',
            },
          })}
        />
        {errors.email && (
          <span data-testid="error-message">{errors.email.message}</span>
        )}
        <button data-testid="submit-btn" type="submit">
          Submit
        </button>
      </form>
    )
  }

  render(<ErrorsComponent />)

  // Submit without filling in the required field
  await userEvent.click(screen.getByTestId('submit-btn'))

  await waitFor(() => {
    expect(screen.getByTestId('error-message').textContent).toBe(
      'Email is required'
    )
  })
})

// ---------------------------------------------------------------------------
// Test 4: formState.isDirty updates after typing
// ---------------------------------------------------------------------------
// isDirty is a property on the formState proxy. The compiler caches its
// value because formState reference is stable. After typing, isDirty
// should become true but the compiler may serve the stale `false` value.
// See: https://github.com/react-hook-form/react-hook-form/issues/12298

test('formState.isDirty updates after typing', async () => {
  function IsDirtyComponent() {
    const form = useForm({ defaultValues: { username: '' } })
    const { isDirty } = form.formState

    return (
      <form>
        <input data-testid="username-input" {...form.register('username')} />
        <span data-testid="dirty-status">{isDirty ? 'dirty' : 'clean'}</span>
      </form>
    )
  }

  render(<IsDirtyComponent />)

  // Initially should be clean
  expect(screen.getByTestId('dirty-status').textContent).toBe('clean')

  // Type something to make the form dirty
  await userEvent.type(screen.getByTestId('username-input'), 'a')

  await waitFor(() => {
    expect(screen.getByTestId('dirty-status').textContent).toBe('dirty')
  })
})

// ---------------------------------------------------------------------------
// Test 5: formState.isSubmitting is true during async submission
// ---------------------------------------------------------------------------
// isSubmitting should be true while the submit handler is running.
// The compiler may cache the initial false value since formState
// reference is stable.
// See: https://github.com/react-hook-form/react-hook-form/issues/12298

test('formState.isSubmitting is true during async submission', async () => {
  let resolveSubmit: () => void

  function IsSubmittingComponent() {
    const form = useForm({ defaultValues: { field: 'value' } })
    const { isSubmitting } = form.formState

    const onSubmit = form.handleSubmit(async () => {
      // Wait for external resolution so we can observe isSubmitting
      await new Promise<void>((resolve) => {
        resolveSubmit = resolve
      })
    })

    return (
      <form onSubmit={onSubmit}>
        <input data-testid="field-input" {...form.register('field')} />
        <span data-testid="submitting-status">
          {isSubmitting ? 'submitting' : 'idle'}
        </span>
        <button data-testid="submit-btn" type="submit">
          Submit
        </button>
      </form>
    )
  }

  render(<IsSubmittingComponent />)

  // Initially idle
  expect(screen.getByTestId('submitting-status').textContent).toBe('idle')

  // Start submission
  await userEvent.click(screen.getByTestId('submit-btn'))

  // Should be submitting while the async handler is pending
  await waitFor(() => {
    expect(screen.getByTestId('submitting-status').textContent).toBe(
      'submitting'
    )
  })

  // Resolve the submission
  await act(async () => {
    resolveSubmit!()
  })

  // Should be back to idle
  await waitFor(() => {
    expect(screen.getByTestId('submitting-status').textContent).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// Test 6: useFormContext() propagates updates to child components
// ---------------------------------------------------------------------------
// useFormContext() returns the same mutable form object from React context.
// Components consuming context don't re-render when form state changes
// because the context value reference is stable. The compiler makes this
// worse by also memoizing the child component's render output.
// See: https://github.com/react-hook-form/react-hook-form/issues/12618

test('useFormContext() propagates updates to children', async () => {
  // Child component that reads from form context
  function ChildDisplay() {
    const form = useFormContext()
    const watchedName = form.watch('name')
    return <span data-testid="context-value">{watchedName}</span>
  }

  function ParentForm() {
    const form = useForm({ defaultValues: { name: '' } })

    return (
      <FormProvider {...form}>
        <form>
          <input data-testid="name-input" {...form.register('name')} />
          <ChildDisplay />
        </form>
      </FormProvider>
    )
  }

  render(<ParentForm />)
  await userEvent.type(screen.getByTestId('name-input'), 'context-test')

  await waitFor(() => {
    expect(screen.getByTestId('context-value').textContent).toBe(
      'context-test'
    )
  })
})

// Workaround: 'use no memo' is needed for useFormContext() as there's no
// safe alternative. The child component must disable memoization or use
// useWatch with control passed as a prop from parent.
test('useFormContext() propagates updates to children (workaround)', async () => {
  function ChildDisplay() {
    'use no memo'
    const form = useFormContext()
    const watchedName = form.watch('name')
    return <span data-testid="context-value-w">{watchedName}</span>
  }

  function ParentForm() {
    'use no memo'
    const form = useForm({ defaultValues: { name: '' } })

    return (
      <FormProvider {...form}>
        <form>
          <input data-testid="name-input-w6" {...form.register('name')} />
          <ChildDisplay />
        </form>
      </FormProvider>
    )
  }

  render(<ParentForm />)
  await userEvent.type(screen.getByTestId('name-input-w6'), 'context-test')

  await waitFor(() => {
    expect(screen.getByTestId('context-value-w').textContent).toBe(
      'context-test'
    )
  })
})

// ---------------------------------------------------------------------------
// Test 7: <Controller> updates on input change
// ---------------------------------------------------------------------------
// Controller receives the `control` prop which never changes reference.
// The compiler memoizes Controller, so field.onChange stops triggering
// re-renders of the controlled input.
// See: https://github.com/react-hook-form/react-hook-form/issues/12298

test('<Controller> updates on input change', async () => {
  function ControllerComponent() {
    const form = useForm({ defaultValues: { color: '' } })

    return (
      <form>
        <Controller
          name="color"
          control={form.control}
          render={({ field }) => (
            <input data-testid="controller-input" {...field} />
          )}
        />
        <span data-testid="controller-value">{form.watch('color')}</span>
      </form>
    )
  }

  render(<ControllerComponent />)
  await userEvent.type(screen.getByTestId('controller-input'), 'blue')

  await waitFor(() => {
    expect(screen.getByTestId('controller-value').textContent).toBe('blue')
  })
})

// Workaround: 'use no memo' is needed for <Controller> as there's no safe
// alternative to the Controller component itself. However, we can use useWatch
// for the watched value display.
test('<Controller> updates on input change (workaround)', async () => {
  function ControllerComponent() {
    'use no memo'
    const form = useForm({ defaultValues: { color: '' } })
    const colorValue = useWatch({ name: 'color', control: form.control })

    return (
      <form>
        <Controller
          name="color"
          control={form.control}
          render={({ field }) => (
            <input data-testid="controller-input-w" {...field} />
          )}
        />
        <span data-testid="controller-value-w">{colorValue}</span>
      </form>
    )
  }

  render(<ControllerComponent />)
  await userEvent.type(screen.getByTestId('controller-input-w'), 'blue')

  await waitFor(() => {
    expect(screen.getByTestId('controller-value-w').textContent).toBe('blue')
  })
})

// ---------------------------------------------------------------------------
// Test 8: useController updates on input change
// ---------------------------------------------------------------------------
// Same as Controller but using the hook API directly. The control object
// has the same interior mutability problem.
// See: https://github.com/react-hook-form/react-hook-form/issues/12298

test('useController updates on input change', async () => {
  function ControlledInput({
    control,
    name,
  }: {
    control: any
    name: string
  }) {
    const { field } = useController({ name, control })
    return <input data-testid="usecontroller-input" {...field} />
  }

  function UseControllerComponent() {
    const form = useForm({ defaultValues: { fruit: '' } })

    return (
      <form>
        <ControlledInput control={form.control} name="fruit" />
        <span data-testid="usecontroller-value">{form.watch('fruit')}</span>
      </form>
    )
  }

  render(<UseControllerComponent />)
  await userEvent.type(screen.getByTestId('usecontroller-input'), 'apple')

  await waitFor(() => {
    expect(screen.getByTestId('usecontroller-value').textContent).toBe('apple')
  })
})

// Workaround: 'use no memo' is needed for useController as there's no safe
// alternative to the useController hook itself. However, we can use useWatch
// for the watched value display.
test('useController updates on input change (workaround)', async () => {
  function ControlledInput({
    control,
    name,
  }: {
    control: any
    name: string
  }) {
    'use no memo'
    const { field } = useController({ name, control })
    return <input data-testid="usecontroller-input-w" {...field} />
  }

  function UseControllerComponent() {
    'use no memo'
    const form = useForm({ defaultValues: { fruit: '' } })
    const fruitValue = useWatch({ name: 'fruit', control: form.control })

    return (
      <form>
        <ControlledInput control={form.control} name="fruit" />
        <span data-testid="usecontroller-value-w">{fruitValue}</span>
      </form>
    )
  }

  render(<UseControllerComponent />)
  await userEvent.type(screen.getByTestId('usecontroller-input-w'), 'apple')

  await waitFor(() => {
    expect(screen.getByTestId('usecontroller-value-w').textContent).toBe('apple')
  })
})

// ---------------------------------------------------------------------------
// Test 9: useWatch({ control }) updates on field change
// ---------------------------------------------------------------------------
// useWatch is a hook-based subscription API. When given an explicit
// `control` prop, it should trigger re-renders properly because it uses
// a subscription model rather than reading from a mutable reference.
// This is expected to work WITH the compiler (probably safe).

test('useWatch({ control }) updates on field change', async () => {
  function WatchDisplay({ control }: { control: any }) {
    const city = useWatch({ control, name: 'city' })
    return <span data-testid="usewatch-value">{city}</span>
  }

  function UseWatchControlComponent() {
    const form = useForm({ defaultValues: { city: '' } })

    return (
      <form>
        <input data-testid="city-input" {...form.register('city')} />
        <WatchDisplay control={form.control} />
      </form>
    )
  }

  render(<UseWatchControlComponent />)
  await userEvent.type(screen.getByTestId('city-input'), 'Paris')

  await waitFor(() => {
    expect(screen.getByTestId('usewatch-value').textContent).toBe('Paris')
  })
})

// ---------------------------------------------------------------------------
// Test 10: useWatch() via context (no control prop) updates on field change
// ---------------------------------------------------------------------------
// When useWatch is called without a control prop, it falls back to
// useFormContext() internally. Since useFormContext() itself is broken
// under the compiler (#12618), this may inherit the same issue.
// Status: uncertain -- no explicit reports yet.

test('useWatch() via context updates on field change', async () => {
  function ContextWatchDisplay() {
    const country = useWatch({ name: 'country' })
    return <span data-testid="context-watch-value">{country}</span>
  }

  function UseWatchContextComponent() {
    const form = useForm({ defaultValues: { country: '' } })

    return (
      <FormProvider {...form}>
        <form>
          <input data-testid="country-input" {...form.register('country')} />
          <ContextWatchDisplay />
        </form>
      </FormProvider>
    )
  }

  render(<UseWatchContextComponent />)
  await userEvent.type(screen.getByTestId('country-input'), 'France')

  await waitFor(() => {
    expect(screen.getByTestId('context-watch-value').textContent).toBe(
      'France'
    )
  })
})

// ---------------------------------------------------------------------------
// Test 11: useFormState() propagates errors after invalid submit
// ---------------------------------------------------------------------------
// useFormState is a hook-based subscription to form state. It should
// properly trigger re-renders because it uses React's subscription model.
// This is expected to work WITH the compiler (probably safe).

test('useFormState() propagates errors after invalid submit', async () => {
  function ErrorDisplay({ control }: { control: any }) {
    const { errors } = useFormState({ control })
    return (
      <span data-testid="formstate-error">
        {errors.age?.message as string}
      </span>
    )
  }

  function UseFormStateComponent() {
    const form = useForm({ defaultValues: { age: '' } })

    const onSubmit = form.handleSubmit(() => {
      // no-op
    })

    return (
      <form onSubmit={onSubmit}>
        <input
          data-testid="age-input"
          {...form.register('age', {
            required: 'Age is required',
          })}
        />
        <ErrorDisplay control={form.control} />
        <button data-testid="submit-btn" type="submit">
          Submit
        </button>
      </form>
    )
  }

  render(<UseFormStateComponent />)

  // Submit without filling in the required field
  await userEvent.click(screen.getByTestId('submit-btn'))

  await waitFor(() => {
    expect(screen.getByTestId('formstate-error').textContent).toBe(
      'Age is required'
    )
  })
})

// ---------------------------------------------------------------------------
// Test 12: getValues() in render returns fresh values after typing
// ---------------------------------------------------------------------------
// form.getValues() returns a snapshot of the current values. When called
// during render, the compiler may cache the result because the form
// reference is stable. The returned values will be stale.
// See: https://github.com/react-hook-form/react-hook-form/issues/12298

test('getValues() in render returns fresh values after typing', async () => {
  function GetValuesComponent() {
    const form = useForm({ defaultValues: { message: '' } })

    // Force re-render by watching all values, so getValues() has a chance
    // to return the latest. Without watch(), the component wouldn't
    // re-render at all (getValues alone doesn't subscribe).
    form.watch()

    const currentValues = form.getValues()

    return (
      <form>
        <input data-testid="message-input" {...form.register('message')} />
        <span data-testid="getvalues-result">{currentValues.message}</span>
      </form>
    )
  }

  render(<GetValuesComponent />)
  await userEvent.type(screen.getByTestId('message-input'), 'test-msg')

  await waitFor(() => {
    expect(screen.getByTestId('getvalues-result').textContent).toBe('test-msg')
  })
})

// Workaround: Use useWatch instead of getValues() in render.
// This uses a subscription model that works with the compiler.
test('getValues() in render returns fresh values after typing (workaround)', async () => {
  function GetValuesComponent() {
    const form = useForm({ defaultValues: { message: '' } })
    const messageValue = useWatch({ name: 'message', control: form.control })

    return (
      <form>
        <input data-testid="message-input-w" {...form.register('message')} />
        <span data-testid="getvalues-result-w">{messageValue}</span>
      </form>
    )
  }

  render(<GetValuesComponent />)
  await userEvent.type(screen.getByTestId('message-input-w'), 'test-msg')

  await waitFor(() => {
    expect(screen.getByTestId('getvalues-result-w').textContent).toBe('test-msg')
  })
})

// ---------------------------------------------------------------------------
// Test 13: getFieldState() in render returns fresh state after interaction
// ---------------------------------------------------------------------------
// form.getFieldState() returns the state of a specific field (isTouched,
// isDirty, error, etc.). Interior mutability means the compiler may
// cache these values.
// See: https://github.com/react-hook-form/react-hook-form/issues/12298

test('getFieldState() in render returns fresh state after interaction', async () => {
  function GetFieldStateComponent() {
    const form = useForm({ defaultValues: { nickname: '' } })

    // Subscribe to formState to enable field state tracking.
    // getFieldState requires formState to be read to activate the proxy.
    const formState = form.formState
    const fieldState = form.getFieldState('nickname', formState)

    return (
      <form>
        <input data-testid="nickname-input" {...form.register('nickname')} />
        <span data-testid="is-dirty">
          {fieldState.isDirty ? 'dirty' : 'pristine'}
        </span>
      </form>
    )
  }

  render(<GetFieldStateComponent />)

  // Initially pristine
  expect(screen.getByTestId('is-dirty').textContent).toBe('pristine')

  // Type to make the field dirty
  await userEvent.type(screen.getByTestId('nickname-input'), 'nick')

  await waitFor(() => {
    expect(screen.getByTestId('is-dirty').textContent).toBe('dirty')
  })
})

// ---------------------------------------------------------------------------
// Test 14: reset() clears form values and state
// ---------------------------------------------------------------------------
// form.reset() is a write operation but causes internal state changes.
// The compiler may cache the rendered output before reset, causing the
// UI not to reflect the cleared state.
// See: https://github.com/react-hook-form/react-hook-form/issues/12298

test('reset() clears form values and state', async () => {
  function ResetComponent() {
    const form = useForm({ defaultValues: { title: '', description: '' } })
    const { isDirty } = form.formState

    // Watch all fields so we can display current values
    const values = form.watch()

    const handleReset = () => {
      form.reset({ title: '', description: '' })
    }

    return (
      <form>
        <input data-testid="title-input" {...form.register('title')} />
        <input
          data-testid="description-input"
          {...form.register('description')}
        />
        <span data-testid="title-value">{values.title}</span>
        <span data-testid="description-value">{values.description}</span>
        <span data-testid="reset-dirty">
          {isDirty ? 'dirty' : 'clean'}
        </span>
        <button
          data-testid="reset-btn"
          type="button"
          onClick={handleReset}
        >
          Reset
        </button>
      </form>
    )
  }

  render(<ResetComponent />)

  // Fill in the form
  await userEvent.type(screen.getByTestId('title-input'), 'My Title')
  await userEvent.type(
    screen.getByTestId('description-input'),
    'A description'
  )

  // Verify values are set
  await waitFor(() => {
    expect(screen.getByTestId('title-value').textContent).toBe('My Title')
    expect(screen.getByTestId('description-value').textContent).toBe(
      'A description'
    )
    expect(screen.getByTestId('reset-dirty').textContent).toBe('dirty')
  })

  // Click reset
  await userEvent.click(screen.getByTestId('reset-btn'))

  // Verify values are cleared and form is clean
  await waitFor(() => {
    expect(screen.getByTestId('title-value').textContent).toBe('')
    expect(screen.getByTestId('description-value').textContent).toBe('')
    expect(screen.getByTestId('reset-dirty').textContent).toBe('clean')
  })

  // Also verify the actual input elements are cleared
  await waitFor(() => {
    expect(
      (screen.getByTestId('title-input') as HTMLInputElement).value
    ).toBe('')
    expect(
      (screen.getByTestId('description-input') as HTMLInputElement).value
    ).toBe('')
  })
})

// Workaround: Use 'use no memo' for reset() as there's no safe alternative.
// reset() is a mutating operation that needs the component to re-render to reflect changes.
test('reset() clears form values and state (workaround)', async () => {
  function ResetComponent() {
    'use no memo'
    const form = useForm({ defaultValues: { title: '', description: '' } })
    const { isDirty } = form.formState

    const values = form.watch()

    const handleReset = () => {
      form.reset({ title: '', description: '' })
    }

    return (
      <form>
        <input data-testid="title-input-w" {...form.register('title')} />
        <input
          data-testid="description-input-w"
          {...form.register('description')}
        />
        <span data-testid="title-value-w">{values.title}</span>
        <span data-testid="description-value-w">{values.description}</span>
        <span data-testid="reset-dirty-w">
          {isDirty ? 'dirty' : 'clean'}
        </span>
        <button
          data-testid="reset-btn-w"
          type="button"
          onClick={handleReset}
        >
          Reset
        </button>
      </form>
    )
  }

  render(<ResetComponent />)

  await userEvent.type(screen.getByTestId('title-input-w'), 'My Title')
  await userEvent.type(
    screen.getByTestId('description-input-w'),
    'A description'
  )

  await waitFor(() => {
    expect(screen.getByTestId('title-value-w').textContent).toBe('My Title')
    expect(screen.getByTestId('description-value-w').textContent).toBe(
      'A description'
    )
    expect(screen.getByTestId('reset-dirty-w').textContent).toBe('dirty')
  })

  await userEvent.click(screen.getByTestId('reset-btn-w'))

  await waitFor(() => {
    expect(screen.getByTestId('title-value-w').textContent).toBe('')
    expect(screen.getByTestId('description-value-w').textContent).toBe('')
    expect(screen.getByTestId('reset-dirty-w').textContent).toBe('clean')
  })

  await waitFor(() => {
    expect(
      (screen.getByTestId('title-input-w') as HTMLInputElement).value
    ).toBe('')
    expect(
      (screen.getByTestId('description-input-w') as HTMLInputElement).value
    ).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Test 15: formState.touchedFields updates when fields are touched
// ---------------------------------------------------------------------------
// formState is a proxy. touchedFields tracks which fields have been focused.
// Compiler may cache the proxy access, preventing updates from showing.

test('formState.touchedFields updates when field is touched', async () => {
  function TouchedFieldsComponent() {
    const form = useForm({ defaultValues: { email: '' } })
    const touched = form.formState.touchedFields.email

    return (
      <form>
        <input data-testid="email-input" {...form.register('email')} />
        <span data-testid="touched-status">{touched ? 'touched' : 'not-touched'}</span>
      </form>
    )
  }

  render(<TouchedFieldsComponent />)

  expect(screen.getByTestId('touched-status').textContent).toBe('not-touched')

  // Focus and blur the input to mark it as touched
  const input = screen.getByTestId('email-input')
  await userEvent.click(input)
  await userEvent.tab() // Blur by tabbing away

  await waitFor(() => {
    expect(screen.getByTestId('touched-status').textContent).toBe('touched')
  })
})

// ---------------------------------------------------------------------------
// Test 16: formState.submitCount increments on each submit
// ---------------------------------------------------------------------------
// submitCount is a counter in formState. Compiler may cache the initial value.

test('formState.submitCount increments on each submit', async () => {
  function SubmitCountComponent() {
    const form = useForm({ defaultValues: { name: '' } })
    const submitCount = form.formState.submitCount

    const onSubmit = (data: any) => {
      // Just submit, we're testing the counter
    }

    return (
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <input data-testid="name-input" {...form.register('name')} />
        <button data-testid="submit-btn" type="submit">Submit</button>
        <span data-testid="submit-count">{submitCount}</span>
      </form>
    )
  }

  render(<SubmitCountComponent />)

  expect(screen.getByTestId('submit-count').textContent).toBe('0')

  await userEvent.click(screen.getByTestId('submit-btn'))

  await waitFor(() => {
    expect(screen.getByTestId('submit-count').textContent).toBe('1')
  })

  await userEvent.click(screen.getByTestId('submit-btn'))

  await waitFor(() => {
    expect(screen.getByTestId('submit-count').textContent).toBe('2')
  })
})

// ---------------------------------------------------------------------------
// Test 17: formState.isValidating during async validation
// ---------------------------------------------------------------------------
// isValidating tracks async validation state. Compiler may not see state changes.

test('formState.isValidating is true during async validation', async () => {
  function AsyncValidationComponent() {
    const form = useForm({
      defaultValues: { username: '' },
      mode: 'onChange',
    })
    const isValidating = form.formState.isValidating

    return (
      <form>
        <input
          data-testid="username-input"
          {...form.register('username', {
            validate: async (value) => {
              // Simulate async validation (e.g., checking username availability)
              await new Promise(resolve => setTimeout(resolve, 100))
              return value.length >= 3 || 'Username too short'
            },
          })}
        />
        <span data-testid="validating-status">
          {isValidating ? 'validating' : 'idle'}
        </span>
      </form>
    )
  }

  render(<AsyncValidationComponent />)

  expect(screen.getByTestId('validating-status').textContent).toBe('idle')

  await userEvent.type(screen.getByTestId('username-input'), 'ab')

  // During validation, status should be 'validating'
  await waitFor(() => {
    expect(screen.getByTestId('validating-status').textContent).toBe('validating')
  }, { timeout: 50 })

  // After validation completes, back to 'idle'
  await waitFor(() => {
    expect(screen.getByTestId('validating-status').textContent).toBe('idle')
  }, { timeout: 500 })
})

// ---------------------------------------------------------------------------
// Test 18: reset() with new defaultValues
// ---------------------------------------------------------------------------
// Calling reset(newDefaults) should update form values. Compiler may cache old values.

test('reset() with new defaultValues updates form values', async () => {
  function ResetWithNewDefaultsComponent() {
    const form = useForm({ defaultValues: { city: 'NYC' } })
    const cityValue = form.watch('city')

    return (
      <form>
        <input data-testid="city-input" {...form.register('city')} />
        <span data-testid="city-value">{cityValue}</span>
        <button
          data-testid="reset-btn"
          type="button"
          onClick={() => form.reset({ city: 'LA' })}
        >
          Reset to LA
        </button>
      </form>
    )
  }

  render(<ResetWithNewDefaultsComponent />)

  expect(screen.getByTestId('city-value').textContent).toBe('NYC')

  await userEvent.click(screen.getByTestId('reset-btn'))

  await waitFor(() => {
    expect(screen.getByTestId('city-value').textContent).toBe('LA')
  })
})

// Workaround: Use 'use no memo' for reset() as there's no safe alternative.
// reset() is a mutating operation that needs the component to re-render to reflect changes.
// Note: We also use useWatch here instead of form.watch() for better practice, but
// 'use no memo' is still required for reset() to work properly.
test('reset() with new defaultValues updates form values (workaround)', async () => {
  function ResetWithNewDefaultsComponent() {
    'use no memo'
    const form = useForm({ defaultValues: { city: 'NYC' } })
    const cityValue = useWatch({ name: 'city', control: form.control })

    return (
      <form>
        <input data-testid="city-input-w18" {...form.register('city')} />
        <span data-testid="city-value-w18">{cityValue}</span>
        <button
          data-testid="reset-btn-w18"
          type="button"
          onClick={() => form.reset({ city: 'LA' })}
        >
          Reset to LA
        </button>
      </form>
    )
  }

  render(<ResetWithNewDefaultsComponent />)

  expect(screen.getByTestId('city-value-w18').textContent).toBe('NYC')

  await userEvent.click(screen.getByTestId('reset-btn-w18'))

  await waitFor(() => {
    expect(screen.getByTestId('city-value-w18').textContent).toBe('LA')
  })
})

// ---------------------------------------------------------------------------
// Test 19: watch() with callback function
// ---------------------------------------------------------------------------
// watch((data) => ...) subscribes to all changes with a callback.
// Compiler may not trigger the callback on form updates.

test('watch() with callback is invoked on form changes', async () => {
  function WatchCallbackComponent() {
    const form = useForm({ defaultValues: { message: '' } })
    const [lastValue, setLastValue] = React.useState('')

    // Subscribe to all form changes with callback
    React.useEffect(() => {
      const subscription = form.watch((data) => {
        setLastValue(data.message || '')
      })
      return () => subscription.unsubscribe()
    }, [form.watch])

    return (
      <form>
        <input data-testid="message-input" {...form.register('message')} />
        <span data-testid="callback-value">{lastValue}</span>
      </form>
    )
  }

  render(<WatchCallbackComponent />)

  await userEvent.type(screen.getByTestId('message-input'), 'hello')

  await waitFor(() => {
    expect(screen.getByTestId('callback-value').textContent).toBe('hello')
  })
})

// ---------------------------------------------------------------------------
// Test 20: watch in useEffect dependency array
// ---------------------------------------------------------------------------
// Common antipattern: using form.watch('x') in useEffect deps.
// Compiler caches watch result, so effect won't re-run on form changes.

test('watch in useEffect dependency array triggers effect', async () => {
  function WatchInEffectDepsComponent() {
    const form = useForm({ defaultValues: { query: '' } })
    const queryValue = form.watch('query')
    const [effectRuns, setEffectRuns] = React.useState(0)

    React.useEffect(() => {
      if (queryValue) {
        setEffectRuns(prev => prev + 1)
      }
    }, [queryValue]) // watch value as dependency

    return (
      <form>
        <input data-testid="query-input" {...form.register('query')} />
        <span data-testid="effect-runs">{effectRuns}</span>
      </form>
    )
  }

  render(<WatchInEffectDepsComponent />)

  expect(screen.getByTestId('effect-runs').textContent).toBe('0')

  await userEvent.type(screen.getByTestId('query-input'), 'test')

  await waitFor(() => {
    // Effect should run after typing (at least once)
    expect(parseInt(screen.getByTestId('effect-runs').textContent || '0')).toBeGreaterThan(0)
  })
})

// Workaround: Use useWatch instead of form.watch() in useEffect dependencies.
// This provides a proper reactive value that works with the compiler.
test('watch in useEffect dependency array triggers effect (workaround)', async () => {
  function WatchInEffectDepsComponent() {
    const form = useForm({ defaultValues: { query: '' } })
    const queryValue = useWatch({ name: 'query', control: form.control })
    const [effectRuns, setEffectRuns] = React.useState(0)

    React.useEffect(() => {
      if (queryValue) {
        setEffectRuns(prev => prev + 1)
      }
    }, [queryValue])

    return (
      <form>
        <input data-testid="query-input-w" {...form.register('query')} />
        <span data-testid="effect-runs-w">{effectRuns}</span>
      </form>
    )
  }

  render(<WatchInEffectDepsComponent />)

  expect(screen.getByTestId('effect-runs-w').textContent).toBe('0')

  await userEvent.type(screen.getByTestId('query-input-w'), 'test')

  await waitFor(() => {
    expect(parseInt(screen.getByTestId('effect-runs-w').textContent || '0')).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Test 21: Conditional fields based on watch (CRITICAL pattern)
// ---------------------------------------------------------------------------
// Extremely common: show/hide fields based on watched values.
// Compiler caches watch result, so conditional fields never appear.

test('Conditional fields render based on watched value', async () => {
  function ConditionalFieldsComponent() {
    const form = useForm({ defaultValues: { type: '', details: '' } })
    const typeValue = form.watch('type')

    return (
      <form>
        <select data-testid="type-select" {...form.register('type')}>
          <option value="">Select...</option>
          <option value="text">Text</option>
          <option value="number">Number</option>
        </select>

        {typeValue === 'text' && (
          <input
            data-testid="text-field"
            {...form.register('details')}
            placeholder="Enter text"
          />
        )}

        {typeValue === 'number' && (
          <input
            data-testid="number-field"
            {...form.register('details')}
            type="number"
            placeholder="Enter number"
          />
        )}
      </form>
    )
  }

  render(<ConditionalFieldsComponent />)

  // Initially no conditional field should be visible
  expect(screen.queryByTestId('text-field')).toBeNull()
  expect(screen.queryByTestId('number-field')).toBeNull()

  // Select 'text' option
  await userEvent.selectOptions(screen.getByTestId('type-select'), 'text')

  // Text field should appear
  await waitFor(() => {
    expect(screen.getByTestId('text-field')).not.toBeNull()
    expect(screen.queryByTestId('number-field')).toBeNull()
  })

  // Select 'number' option
  await userEvent.selectOptions(screen.getByTestId('type-select'), 'number')

  // Number field should appear, text field should disappear
  await waitFor(() => {
    expect(screen.queryByTestId('text-field')).toBeNull()
    expect(screen.getByTestId('number-field')).not.toBeNull()
  })
})

// Workaround: Use useWatch instead of form.watch() for conditional fields.
// This subscription-based API works with the compiler.
test('Conditional fields render based on watched value (workaround)', async () => {
  function ConditionalFieldsComponent() {
    const form = useForm({ defaultValues: { type: '', details: '' } })
    const typeValue = useWatch({ name: 'type', control: form.control })

    return (
      <form>
        <select data-testid="type-select-w" {...form.register('type')}>
          <option value="">Select...</option>
          <option value="text">Text</option>
          <option value="number">Number</option>
        </select>

        {typeValue === 'text' && (
          <input
            data-testid="text-field-w"
            {...form.register('details')}
            placeholder="Enter text"
          />
        )}

        {typeValue === 'number' && (
          <input
            data-testid="number-field-w"
            {...form.register('details')}
            type="number"
            placeholder="Enter number"
          />
        )}
      </form>
    )
  }

  render(<ConditionalFieldsComponent />)

  expect(screen.queryByTestId('text-field-w')).toBeNull()
  expect(screen.queryByTestId('number-field-w')).toBeNull()

  await userEvent.selectOptions(screen.getByTestId('type-select-w'), 'text')

  await waitFor(() => {
    expect(screen.getByTestId('text-field-w')).not.toBeNull()
    expect(screen.queryByTestId('number-field-w')).toBeNull()
  })

  await userEvent.selectOptions(screen.getByTestId('type-select-w'), 'number')

  await waitFor(() => {
    expect(screen.queryByTestId('text-field-w')).toBeNull()
    expect(screen.getByTestId('number-field-w')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Test 22: Nested watch paths
// ---------------------------------------------------------------------------
// Watching nested object paths like 'user.address.city'.
// Compiler caches the result, nested updates don't propagate.

test('Nested watch paths update on nested field changes', async () => {
  function NestedWatchComponent() {
    const form = useForm({
      defaultValues: { user: { address: { city: '' } } },
    })
    const cityValue = form.watch('user.address.city')

    return (
      <form>
        <input
          data-testid="city-input"
          {...form.register('user.address.city')}
        />
        <span data-testid="nested-value">{cityValue}</span>
      </form>
    )
  }

  render(<NestedWatchComponent />)

  expect(screen.getByTestId('nested-value').textContent).toBe('')

  await userEvent.type(screen.getByTestId('city-input'), 'Boston')

  await waitFor(() => {
    expect(screen.getByTestId('nested-value').textContent).toBe('Boston')
  })
})

// Workaround: Use useWatch instead of form.watch() for nested paths.
// This properly watches nested paths with the compiler.
test('Nested watch paths update on nested field changes (workaround)', async () => {
  function NestedWatchComponent() {
    const form = useForm({
      defaultValues: { user: { address: { city: '' } } },
    })
    const cityValue = useWatch({ name: 'user.address.city', control: form.control })

    return (
      <form>
        <input
          data-testid="city-input-w22"
          {...form.register('user.address.city')}
        />
        <span data-testid="nested-value-w">{cityValue}</span>
      </form>
    )
  }

  render(<NestedWatchComponent />)

  expect(screen.getByTestId('nested-value-w').textContent).toBe('')

  await userEvent.type(screen.getByTestId('city-input-w22'), 'Boston')

  await waitFor(() => {
    expect(screen.getByTestId('nested-value-w').textContent).toBe('Boston')
  })
})

// ---------------------------------------------------------------------------
// Test 23: setValue then immediately watch (race condition)
// ---------------------------------------------------------------------------
// setValue is async internally. Immediately watching after setValue
// might return stale value if compiler caches the watch result.

test('setValue then immediate watch returns updated value', async () => {
  function SetValueThenWatchComponent() {
    const form = useForm({ defaultValues: { status: '' } })
    const [displayValue, setDisplayValue] = React.useState('')

    const handleClick = () => {
      form.setValue('status', 'active')
      // Immediately read the value after setting
      const currentValue = form.watch('status')
      setDisplayValue(currentValue)
    }

    return (
      <form>
        <button data-testid="set-btn" type="button" onClick={handleClick}>
          Set Active
        </button>
        <span data-testid="display-value">{displayValue}</span>
      </form>
    )
  }

  render(<SetValueThenWatchComponent />)

  expect(screen.getByTestId('display-value').textContent).toBe('')

  await userEvent.click(screen.getByTestId('set-btn'))

  await waitFor(() => {
    expect(screen.getByTestId('display-value').textContent).toBe('active')
  })
})

// ---------------------------------------------------------------------------
// Test 24: useFieldArray + watch array (CRITICAL pattern)
// ---------------------------------------------------------------------------
// Dynamic form arrays with watch. Extremely common for rates, line items, etc.
// Compiler caches array watch, so new items don't appear.

test('useFieldArray with watch reflects array changes', async () => {
  function FieldArrayWithWatchComponent() {
    const form = useForm({
      defaultValues: { items: [{ name: 'Item 1' }] },
    })
    const { fields, append } = useFieldArray({
      control: form.control,
      name: 'items',
    })
    const itemsArray = form.watch('items')

    return (
      <form>
        <div data-testid="item-count">{itemsArray?.length || 0}</div>

        {fields.map((field, index) => (
          <input
            key={field.id}
            data-testid={`item-${index}`}
            {...form.register(`items.${index}.name` as const)}
          />
        ))}

        <button
          data-testid="add-btn"
          type="button"
          onClick={() => append({ name: 'New Item' })}
        >
          Add Item
        </button>
      </form>
    )
  }

  render(<FieldArrayWithWatchComponent />)

  expect(screen.getByTestId('item-count').textContent).toBe('1')

  await userEvent.click(screen.getByTestId('add-btn'))

  await waitFor(() => {
    expect(screen.getByTestId('item-count').textContent).toBe('2')
  })

  // Verify second item input exists
  expect(screen.getByTestId('item-1')).not.toBeNull()
})

// Workaround: Use useWatch instead of form.watch() for field arrays.
// This properly watches field array changes with the compiler.
test('useFieldArray with watch reflects array changes (workaround)', async () => {
  function FieldArrayWithWatchComponent() {
    const form = useForm({
      defaultValues: { items: [{ name: 'Item 1' }] },
    })
    const { fields, append } = useFieldArray({
      control: form.control,
      name: 'items',
    })
    const itemsArray = useWatch({ name: 'items', control: form.control })

    return (
      <form>
        <div data-testid="item-count-w">{itemsArray?.length || 0}</div>

        {fields.map((field, index) => (
          <input
            key={field.id}
            data-testid={`item-w-${index}`}
            {...form.register(`items.${index}.name` as const)}
          />
        ))}

        <button
          data-testid="add-btn-w"
          type="button"
          onClick={() => append({ name: 'New Item' })}
        >
          Add Item
        </button>
      </form>
    )
  }

  render(<FieldArrayWithWatchComponent />)

  expect(screen.getByTestId('item-count-w').textContent).toBe('1')

  await userEvent.click(screen.getByTestId('add-btn-w'))

  await waitFor(() => {
    expect(screen.getByTestId('item-count-w').textContent).toBe('2')
  })

  expect(screen.getByTestId('item-w-1')).not.toBeNull()
})

// ---------------------------------------------------------------------------
// Test 25: formState destructuring vs direct access
// ---------------------------------------------------------------------------
// Pattern: const { errors, isDirty } = form.formState
// Compiler may cache the destructured values differently than direct access.

test('formState destructuring reflects changes', async () => {
  function FormStateDestructuringComponent() {
    const form = useForm({
      mode: 'onSubmit',
      defaultValues: { email: '' }
    })
    // Destructure formState properties
    const { isDirty, errors } = form.formState

    return (
      <form onSubmit={form.handleSubmit(() => {})}>
        <input
          data-testid="email-input"
          {...form.register('email', { required: 'Required' })}
        />
        <span data-testid="dirty-status">{isDirty ? 'dirty' : 'clean'}</span>
        <span data-testid="error-status">{errors.email ? 'error' : 'no-error'}</span>
      </form>
    )
  }

  render(<FormStateDestructuringComponent />)

  expect(screen.getByTestId('dirty-status').textContent).toBe('clean')

  await userEvent.type(screen.getByTestId('email-input'), 'test')

  await waitFor(() => {
    expect(screen.getByTestId('dirty-status').textContent).toBe('dirty')
  })
})

// ---------------------------------------------------------------------------
// Test 26: formState.isDirty via useFormContext updates after typing
// ---------------------------------------------------------------------------
// When formState is accessed via useFormContext() in a child component,
// the compiler may cache the child's render output because the context
// value reference (the form object) is stable. This is the FormProvider
// variant of Test 4 (which uses local useForm and passes). The context
// indirection adds another layer where the compiler can skip re-renders.
// See: https://github.com/react-hook-form/react-hook-form/issues/12618

test('formState.isDirty via useFormContext updates after typing', async () => {
  function DirtyStatusDisplay() {
    const form = useFormContext()
    const { isDirty } = form.formState
    return (
      <span data-testid="context-dirty-status">
        {isDirty ? 'dirty' : 'clean'}
      </span>
    )
  }

  function ParentFormWithDirty() {
    const form = useForm({ defaultValues: { username: '' } })

    return (
      <FormProvider {...form}>
        <form>
          <input data-testid="username-input" {...form.register('username')} />
          <DirtyStatusDisplay />
        </form>
      </FormProvider>
    )
  }

  render(<ParentFormWithDirty />)

  // Initially should be clean
  expect(screen.getByTestId('context-dirty-status').textContent).toBe('clean')

  // Type something to make the form dirty
  await userEvent.type(screen.getByTestId('username-input'), 'a')

  await waitFor(() => {
    expect(screen.getByTestId('context-dirty-status').textContent).toBe('dirty')
  })
})

// Workaround: Child component should use useFormState({ control }) with control
// passed as prop from parent, providing a subscription-based API that works with the compiler.
test('formState.isDirty via useFormContext updates after typing (workaround)', async () => {
  function DirtyStatusDisplay({ control }: { control: any }) {
    const { isDirty } = useFormState({ control })
    return (
      <span data-testid="context-dirty-status-w">
        {isDirty ? 'dirty' : 'clean'}
      </span>
    )
  }

  function ParentFormWithDirty() {
    const form = useForm({ defaultValues: { username: '' } })

    return (
      <FormProvider {...form}>
        <form>
          <input data-testid="username-input-w26" {...form.register('username')} />
          <DirtyStatusDisplay control={form.control} />
        </form>
      </FormProvider>
    )
  }

  render(<ParentFormWithDirty />)

  // Initially should be clean
  expect(screen.getByTestId('context-dirty-status-w').textContent).toBe('clean')

  // Type something to make the form dirty
  await userEvent.type(screen.getByTestId('username-input-w26'), 'a')

  await waitFor(() => {
    expect(screen.getByTestId('context-dirty-status-w').textContent).toBe('dirty')
  })
})

// ---------------------------------------------------------------------------
// Test 27: getValues() with array syntax
// ---------------------------------------------------------------------------
// getValues(['field1', 'field2']) returns subset of values.
// Compiler may cache the result.

test('getValues() with array argument returns fresh subset', async () => {
  function GetValuesArrayComponent() {
    const form = useForm({
      defaultValues: { firstName: '', lastName: '', age: '' },
    })
    const [displayValues, setDisplayValues] = React.useState('')

    const handleCheck = () => {
      const values = form.getValues(['firstName', 'lastName'])
      setDisplayValues(`${values[0]},${values[1]}`)
    }

    return (
      <form>
        <input data-testid="first-input" {...form.register('firstName')} />
        <input data-testid="last-input" {...form.register('lastName')} />
        <input data-testid="age-input" {...form.register('age')} />
        <button data-testid="check-btn" type="button" onClick={handleCheck}>
          Check Names
        </button>
        <span data-testid="values-display">{displayValues}</span>
      </form>
    )
  }

  render(<GetValuesArrayComponent />)

  await userEvent.type(screen.getByTestId('first-input'), 'John')
  await userEvent.type(screen.getByTestId('last-input'), 'Doe')
  await userEvent.type(screen.getByTestId('age-input'), '30')

  await userEvent.click(screen.getByTestId('check-btn'))

  await waitFor(() => {
    expect(screen.getByTestId('values-display').textContent).toBe('John,Doe')
  })
})
