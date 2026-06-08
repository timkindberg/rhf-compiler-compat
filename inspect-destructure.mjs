import { transformSync } from '@babel/core'

const samples = {
  'member form.watch()': `
    import { useForm } from 'react-hook-form'
    export function A() {
      const form = useForm({ defaultValues: { name: '' } })
      const name = form.watch('name')
      return <span>{name}</span>
    }
  `,
  'destructured { watch } from useForm': `
    import { useForm } from 'react-hook-form'
    export function B() {
      const { watch, register } = useForm({ defaultValues: { name: '' } })
      const name = watch('name')
      return <span>{name}</span>
    }
  `,
  'destructured { watch } from useFormContext': `
    import { useFormContext } from 'react-hook-form'
    export function C() {
      const { watch } = useFormContext()
      const name = watch('name')
      return <span>{name}</span>
    }
  `,
}

for (const [label, code] of Object.entries(samples)) {
  const events = []
  const result = transformSync(code, {
    filename: `${label}.tsx`,
    presets: [
      ['@babel/preset-react', { runtime: 'automatic' }],
      ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
    ],
    plugins: [
      ['babel-plugin-react-compiler', {
        target: '19',
        logger: { logEvent(_f, e) { events.push(e) } },
      }],
    ],
  })
  const memoized = result.code.includes('react/compiler-runtime')
  const ev = events.map((e) => e.kind === 'CompileError' ? `ERROR(${e.detail?.reason ?? '?'})` : e.kind).join(',')
  console.log(`${label.padEnd(42)} -> memoized=${memoized ? 'YES' : 'no '}  [${ev}]`)
}
