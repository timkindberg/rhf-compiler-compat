import { test, expect } from 'bun:test'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, useFormContext, FormProvider } from 'react-hook-form'

// Measures whether a React.memo child that merely consumes useFormContext()
// (without reading any changing value) re-renders when the OWNER of useForm()
// re-renders for an unrelated reason. If useForm() returns a fresh object each
// render, <FormProvider {...form}> publishes a new context value every render,
// forcing all consumers to re-render even when memoized.
test('CONTEXT-COST: memoized useFormContext child re-renders on unrelated parent renders', async () => {
  let childRenders = 0

  const StaticChild = React.memo(function StaticChild() {
    useFormContext() // consume context, but read nothing that changes
    childRenders++
    return <span data-testid="cc-child">static</span>
  })

  function Parent() {
    const form = useForm({ defaultValues: { a: '' } })
    const [count, setCount] = React.useState(0)
    return (
      <FormProvider {...form}>
        <div data-testid="cc-count">{count}</div>
        <button data-testid="cc-bump" type="button" onClick={() => setCount((c) => c + 1)}>
          bump
        </button>
        <StaticChild />
      </FormProvider>
    )
  }

  render(<Parent />)
  const initial = childRenders
  // Three unrelated parent state updates that have nothing to do with the form.
  await userEvent.click(screen.getByTestId('cc-bump'))
  await userEvent.click(screen.getByTestId('cc-bump'))
  await userEvent.click(screen.getByTestId('cc-bump'))
  await waitFor(() => {
    expect(screen.getByTestId('cc-count').textContent).toBe('3')
  })
  const extra = childRenders - initial
  console.log(`childRenders initial=${initial} extraAfter3UnrelatedBumps=${extra}`)
  expect(childRenders).toBeGreaterThan(0)
})
