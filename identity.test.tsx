import { test, expect } from 'bun:test'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'

// Determines whether useForm() returns a stable or fresh object reference
// across renders, and whether form.watch / form.control / form.formState are
// stable. This explains WHY the compiler's reference-keyed memo cache does or
// does not invalidate for react-hook-form.
test('IDENTITY: does useForm() return a fresh reference across renders?', async () => {
  const refs: any[] = []
  const watchRefs: any[] = []
  const controlRefs: any[] = []

  function Probe() {
    const form = useForm({ defaultValues: { name: '' } })
    refs.push(form)
    watchRefs.push(form.watch)
    controlRefs.push(form.control)
    const name = form.watch('name')
    return (
      <form>
        <input data-testid="probe-input" {...form.register('name')} />
        <span data-testid="probe-name">{name}</span>
      </form>
    )
  }

  render(<Probe />)
  await userEvent.type(screen.getByTestId('probe-input'), 'hi')
  await waitFor(() => {
    expect(screen.getByTestId('probe-name').textContent).toBe('hi')
  })

  const uniqueForm = new Set(refs).size
  const uniqueWatch = new Set(watchRefs).size
  const uniqueControl = new Set(controlRefs).size
  console.log(
    `renders=${refs.length} uniqueForm=${uniqueForm} uniqueWatch=${uniqueWatch} uniqueControl=${uniqueControl}`
  )
  // Report-only assertion: we just need the log line above.
  expect(refs.length).toBeGreaterThan(1)
})
