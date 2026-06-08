/**
 * Hole-hunting suite for the RHF v8 "React Compiler compatible out of the box"
 * claim. These target patterns the compiler ACTUALLY memoizes (context
 * boundaries, hook subscriptions, register+programmatic updates, field array
 * mutations) -- i.e. the paths where a real correctness regression would hide.
 * Anything that uses `useForm().watch()` is deliberately avoided here, because
 * the compiler bails that out (no memoization) and it can't regress.
 *
 *   With compiler:  bun test --preload ./compiler-plugin.ts holes.test.tsx
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
// Hole 1: formState.errors read via useFormContext in a (memoized) child
// ---------------------------------------------------------------------------
// The canonical suite tests isDirty-via-context. errors is a deeper proxy
// path; verify a compiled child shows validation errors after submit.
test('H1: errors via useFormContext child updates after invalid submit', async () => {
  function ErrorChild() {
    const { formState } = useFormContext()
    return (
      <span data-testid="h1-error">
        {(formState.errors.email?.message as string) || 'none'}
      </span>
    )
  }
  function Parent() {
    const form = useForm({ defaultValues: { email: '' } })
    return (
      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(() => {})}>
          <input {...form.register('email', { required: 'Required!' })} />
          <ErrorChild />
          <button data-testid="h1-submit" type="submit">Go</button>
        </form>
      </FormProvider>
    )
  }
  render(<Parent />)
  expect(screen.getByTestId('h1-error').textContent).toBe('none')
  await userEvent.click(screen.getByTestId('h1-submit'))
  await waitFor(() => {
    expect(screen.getByTestId('h1-error').textContent).toBe('Required!')
  })
})

// ---------------------------------------------------------------------------
// Hole 2: conditional rendering driven by useWatch in a memoized child
// ---------------------------------------------------------------------------
test('H2: conditional fields via useWatch in child', async () => {
  function Conditional() {
    const type = useWatch({ name: 'type' })
    return type === 'show' ? <span data-testid="h2-extra">extra</span> : null
  }
  function Parent() {
    const form = useForm({ defaultValues: { type: 'hide' } })
    return (
      <FormProvider {...form}>
        <form>
          <select data-testid="h2-select" {...form.register('type')}>
            <option value="hide">hide</option>
            <option value="show">show</option>
          </select>
          <Conditional />
        </form>
      </FormProvider>
    )
  }
  render(<Parent />)
  expect(screen.queryByTestId('h2-extra')).toBeNull()
  await userEvent.selectOptions(screen.getByTestId('h2-select'), 'show')
  await waitFor(() => {
    expect(screen.getByTestId('h2-extra')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Hole 3: useFieldArray remove reflects in DOM under compiler
// ---------------------------------------------------------------------------
test('H3: useFieldArray remove updates rendered rows', async () => {
  function Arr() {
    const form = useForm({ defaultValues: { items: [{ v: 'a' }, { v: 'b' }, { v: 'c' }] } })
    const { fields, remove } = useFieldArray({ control: form.control, name: 'items' })
    return (
      <form>
        <span data-testid="h3-count">{fields.length}</span>
        {fields.map((f, i) => (
          <div key={f.key}>
            <input data-testid={`h3-item-${i}`} {...form.register(`items.${i}.v` as const)} />
            <button data-testid={`h3-remove-${i}`} type="button" onClick={() => remove(i)}>x</button>
          </div>
        ))}
      </form>
    )
  }
  render(<Arr />)
  expect(screen.getByTestId('h3-count').textContent).toBe('3')
  await userEvent.click(screen.getByTestId('h3-remove-1'))
  await waitFor(() => {
    expect(screen.getByTestId('h3-count').textContent).toBe('2')
  })
  // Remaining inputs should be 'a' and 'c'
  expect((screen.getByTestId('h3-item-0') as HTMLInputElement).value).toBe('a')
  expect((screen.getByTestId('h3-item-1') as HTMLInputElement).value).toBe('c')
})

// ---------------------------------------------------------------------------
// Hole 4: useFieldArray swap reorders DOM values under compiler
// ---------------------------------------------------------------------------
test('H4: useFieldArray swap reorders values', async () => {
  function Arr() {
    const form = useForm({ defaultValues: { items: [{ v: 'first' }, { v: 'second' }] } })
    const { fields, swap } = useFieldArray({ control: form.control, name: 'items' })
    return (
      <form>
        {fields.map((f, i) => (
          <input key={f.key} data-testid={`h4-item-${i}`} {...form.register(`items.${i}.v` as const)} />
        ))}
        <button data-testid="h4-swap" type="button" onClick={() => swap(0, 1)}>swap</button>
      </form>
    )
  }
  render(<Arr />)
  expect((screen.getByTestId('h4-item-0') as HTMLInputElement).value).toBe('first')
  await userEvent.click(screen.getByTestId('h4-swap'))
  await waitFor(() => {
    expect((screen.getByTestId('h4-item-0') as HTMLInputElement).value).toBe('second')
    expect((screen.getByTestId('h4-item-1') as HTMLInputElement).value).toBe('first')
  })
})

// ---------------------------------------------------------------------------
// Hole 5: useWatch value consumed inside useMemo (derived state)
// ---------------------------------------------------------------------------
// The compiler may merge/relocate the useMemo; ensure derived value tracks.
test('H5: useMemo derived from useWatch stays in sync', async () => {
  function Derived() {
    const form = useForm({ defaultValues: { price: '' } })
    const price = useWatch({ control: form.control, name: 'price' })
    const doubled = React.useMemo(() => {
      const n = Number(price) || 0
      return n * 2
    }, [price])
    return (
      <form>
        <input data-testid="h5-price" {...form.register('price')} />
        <span data-testid="h5-doubled">{doubled}</span>
      </form>
    )
  }
  render(<Derived />)
  await userEvent.type(screen.getByTestId('h5-price'), '21')
  await waitFor(() => {
    expect(screen.getByTestId('h5-doubled').textContent).toBe('42')
  })
})

// ---------------------------------------------------------------------------
// Hole 6: Controller nested inside useFieldArray rows, with append
// ---------------------------------------------------------------------------
test('H6: Controller inside field array append + edit', async () => {
  function Arr() {
    const form = useForm({ defaultValues: { rows: [{ v: 'r0' }] } })
    const { fields, append } = useFieldArray({ control: form.control, name: 'rows' })
    return (
      <form>
        {fields.map((f, i) => (
          <Controller
            key={f.key}
            control={form.control}
            name={`rows.${i}.v` as const}
            render={({ field }) => <input data-testid={`h6-row-${i}`} {...field} />}
          />
        ))}
        <button data-testid="h6-add" type="button" onClick={() => append({ v: 'new' })}>add</button>
      </form>
    )
  }
  render(<Arr />)
  expect((screen.getByTestId('h6-row-0') as HTMLInputElement).value).toBe('r0')
  await userEvent.click(screen.getByTestId('h6-add'))
  await waitFor(() => {
    expect((screen.getByTestId('h6-row-1') as HTMLInputElement).value).toBe('new')
  })
  await userEvent.type(screen.getByTestId('h6-row-1'), '!')
  await waitFor(() => {
    expect((screen.getByTestId('h6-row-1') as HTMLInputElement).value).toBe('new!')
  })
})

// ---------------------------------------------------------------------------
// Hole 7: setValue updates a useWatch-bound display in a memoized child
// ---------------------------------------------------------------------------
test('H7: setValue propagates to useWatch child', async () => {
  function Display({ control }: { control: any }) {
    const status = useWatch({ control, name: 'status' })
    return <span data-testid="h7-status">{status}</span>
  }
  function Parent() {
    const form = useForm({ defaultValues: { status: 'idle' } })
    return (
      <form>
        <Display control={form.control} />
        <button data-testid="h7-set" type="button" onClick={() => form.setValue('status', 'active')}>set</button>
      </form>
    )
  }
  render(<Parent />)
  expect(screen.getByTestId('h7-status').textContent).toBe('idle')
  await userEvent.click(screen.getByTestId('h7-set'))
  await waitFor(() => {
    expect(screen.getByTestId('h7-status').textContent).toBe('active')
  })
})

// ---------------------------------------------------------------------------
// Hole 8: useFormState({ name }) scoped subscription in memoized child
// ---------------------------------------------------------------------------
test('H8: scoped useFormState in child tracks a single field error', async () => {
  function FieldError({ control }: { control: any }) {
    const { errors } = useFormState({ control, name: 'age' })
    return <span data-testid="h8-err">{(errors.age?.message as string) || 'ok'}</span>
  }
  function Parent() {
    const form = useForm({ defaultValues: { age: '' } })
    return (
      <form onSubmit={form.handleSubmit(() => {})}>
        <input {...form.register('age', { required: 'need age' })} />
        <FieldError control={form.control} />
        <button data-testid="h8-submit" type="submit">go</button>
      </form>
    )
  }
  render(<Parent />)
  expect(screen.getByTestId('h8-err').textContent).toBe('ok')
  await userEvent.click(screen.getByTestId('h8-submit'))
  await waitFor(() => {
    expect(screen.getByTestId('h8-err').textContent).toBe('need age')
  })
})

// ---------------------------------------------------------------------------
// Hole 9: deep nested useWatch path in a memoized child via context
// ---------------------------------------------------------------------------
test('H9: nested useWatch path via context updates', async () => {
  function DeepDisplay() {
    const city = useWatch({ name: 'user.address.city' })
    return <span data-testid="h9-city">{city}</span>
  }
  function Parent() {
    const form = useForm({ defaultValues: { user: { address: { city: '' } } } })
    return (
      <FormProvider {...form}>
        <form>
          <input data-testid="h9-input" {...form.register('user.address.city')} />
          <DeepDisplay />
        </form>
      </FormProvider>
    )
  }
  render(<Parent />)
  await userEvent.type(screen.getByTestId('h9-input'), 'Berlin')
  await waitFor(() => {
    expect(screen.getByTestId('h9-city').textContent).toBe('Berlin')
  })
})

// ---------------------------------------------------------------------------
// Hole 10: reset() updates a useWatch display + register input together
// ---------------------------------------------------------------------------
test('H10: reset with new values updates both register input and useWatch', async () => {
  function Parent() {
    const form = useForm({ defaultValues: { name: 'Ann' } })
    const watched = useWatch({ control: form.control, name: 'name' })
    return (
      <form>
        <input data-testid="h10-input" {...form.register('name')} />
        <span data-testid="h10-watch">{watched}</span>
        <button data-testid="h10-reset" type="button" onClick={() => form.reset({ name: 'Bob' })}>reset</button>
      </form>
    )
  }
  render(<Parent />)
  await waitFor(() => {
    expect((screen.getByTestId('h10-input') as HTMLInputElement).value).toBe('Ann')
  })
  await userEvent.click(screen.getByTestId('h10-reset'))
  await waitFor(() => {
    expect((screen.getByTestId('h10-input') as HTMLInputElement).value).toBe('Bob')
    expect(screen.getByTestId('h10-watch').textContent).toBe('Bob')
  })
})
