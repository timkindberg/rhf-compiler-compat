import { test, expect } from 'bun:test'
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm, useFormContext, FormProvider } from 'react-hook-form'

// Confirms the model: a useFormContext() consumer that watches a field gets a
// FRESH `form` reference each time it re-renders due to a form-state change.
// That fresh identity is exactly what busts the React Compiler's reference-keyed
// memo cache for the context path (so compiled context children read fresh
// values on v8).
test('CONTEXT-IDENTITY: child form ref changes as the watched field changes', async () => {
  const childForms: any[] = []

  function Child() {
    const form = useFormContext()
    childForms.push(form)
    const name = form.watch('name')
    return <span data-testid="ci-name">{name}</span>
  }

  function Parent() {
    const form = useForm({ defaultValues: { name: '' } })
    return (
      <FormProvider {...form}>
        <input data-testid="ci-input" {...form.register('name')} />
        <Child />
      </FormProvider>
    )
  }

  render(<Parent />)
  await userEvent.type(screen.getByTestId('ci-input'), 'abc')
  await waitFor(() => {
    expect(screen.getByTestId('ci-name').textContent).toBe('abc')
  })

  console.log(
    `child renders=${childForms.length} uniqueChildForm=${new Set(childForms).size}`
  )
  expect(screen.getByTestId('ci-name').textContent).toBe('abc')
})
