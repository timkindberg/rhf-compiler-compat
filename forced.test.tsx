/**
 * Forces the React Compiler to MEMOIZE components that call useForm().watch()
 * by importing useForm from a re-export module the compiler doesn't recognize
 * as react-hook-form. If these pass WITH the compiler, it proves v8's watch()
 * is safe under full memoization and the compiler's hardcoded bailout is
 * unnecessary for v8 (i.e. it's leaving optimization on the table).
 *
 *   With compiler:  bun test --preload ./compiler-plugin.ts forced.test.tsx
 */
import { test, expect } from 'bun:test'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// NOTE: imported from the re-export, NOT 'react-hook-form' directly.
import { useForm } from './rhf-reexport'

test('FORCED-MEMO: useForm().watch(field) works even when compiled', async () => {
  function WatchField() {
    const form = useForm({ defaultValues: { name: '' } })
    const name = form.watch('name')
    return (
      <form>
        <input data-testid="fm-input" {...form.register('name')} />
        <span data-testid="fm-watch">{name}</span>
      </form>
    )
  }
  render(<WatchField />)
  await userEvent.type(screen.getByTestId('fm-input'), 'hello')
  await waitFor(() => {
    expect(screen.getByTestId('fm-watch').textContent).toBe('hello')
  })
})

test('FORCED-MEMO: conditional fields via useForm().watch() works when compiled', async () => {
  function Conditional() {
    const form = useForm({ defaultValues: { type: '' } })
    const type = form.watch('type')
    return (
      <form>
        <select data-testid="fm-select" {...form.register('type')}>
          <option value="">--</option>
          <option value="text">text</option>
        </select>
        {type === 'text' && <input data-testid="fm-extra" {...form.register('extra')} />}
      </form>
    )
  }
  render(<Conditional />)
  expect(screen.queryByTestId('fm-extra')).toBeNull()
  await userEvent.selectOptions(screen.getByTestId('fm-select'), 'text')
  await waitFor(() => {
    expect(screen.getByTestId('fm-extra')).not.toBeNull()
  })
})
