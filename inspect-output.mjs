import { transformSync } from '@babel/core'

const samples = {
  'watch-direct (form.watch)': `
    import { useForm } from 'react-hook-form'
    export function WatchDirect() {
      const form = useForm({ defaultValues: { name: '' } })
      const name = form.watch('name')
      return <div><input {...form.register('name')} /><span>{name}</span></div>
    }
  `,
  'usewatch (migrated)': `
    import { useForm, useWatch } from 'react-hook-form'
    export function UseWatchMigrated() {
      const form = useForm({ defaultValues: { name: '' } })
      const name = useWatch({ control: form.control, name: 'name' })
      return <div><input {...form.register('name')} /><span>{name}</span></div>
    }
  `,
  'reset-register': `
    import { useForm } from 'react-hook-form'
    export function ResetRegister() {
      const form = useForm({ defaultValues: { title: 'x' } })
      return <form><input {...form.register('title')} /><button onClick={() => form.reset()}>r</button></form>
    }
  `,
}

for (const [label, code] of Object.entries(samples)) {
  const result = transformSync(code, {
    filename: `${label}.tsx`,
    presets: [
      ['@babel/preset-react', { runtime: 'automatic' }],
      ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
    ],
    plugins: [['babel-plugin-react-compiler', { target: '19' }]],
  })
  const code_out = result.code
  const memoized = code_out.includes('useMemoCache') || code_out.includes('_c(')
  console.log(`\n===== ${label} =====`)
  console.log(`MEMOIZED BY COMPILER: ${memoized ? 'YES' : 'NO (bailed out)'}`)
  console.log(code_out)
}
