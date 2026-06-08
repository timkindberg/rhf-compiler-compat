import { transformSync } from '@babel/core'

// Representative RHF v8 usage patterns. We compile each one and report
// whether React Compiler SUCCESSFULLY memoized it, SKIPPED (bailed out),
// or ERRORED. A "Skip"/"Bailout" means the component gets zero compiler
// optimization even though it still "works" -- the key nuance behind the
// "compatible out of the box" claim.

const samples = {
  'watch-direct': `
    import { useForm } from 'react-hook-form'
    export function WatchDirect() {
      const form = useForm({ defaultValues: { name: '' } })
      const name = form.watch('name')
      return <div><input {...form.register('name')} /><span>{name}</span></div>
    }
  `,
  'watch-all': `
    import { useForm } from 'react-hook-form'
    export function WatchAll() {
      const form = useForm({ defaultValues: { a: '', b: '' } })
      const all = form.watch()
      return <div><input {...form.register('a')} /><span>{all.a}{all.b}</span></div>
    }
  `,
  'formstate-proxy': `
    import { useForm } from 'react-hook-form'
    export function FormStateProxy() {
      const form = useForm({ defaultValues: { email: '' } })
      const { errors, isDirty } = form.formState
      return <div><input {...form.register('email')} />{isDirty?'d':'c'}{errors.email?.message}</div>
    }
  `,
  'getvalues-render': `
    import { useForm } from 'react-hook-form'
    export function GetValuesRender() {
      const form = useForm({ defaultValues: { m: '' } })
      form.watch()
      const v = form.getValues()
      return <div><input {...form.register('m')} /><span>{v.m}</span></div>
    }
  `,
  'context-child': `
    import { useFormContext } from 'react-hook-form'
    export function ContextChild() {
      const form = useFormContext()
      const name = form.watch('name')
      return <span>{name}</span>
    }
  `,
  'usewatch-hook': `
    import { useWatch } from 'react-hook-form'
    export function UseWatchHook({ control }) {
      const city = useWatch({ control, name: 'city' })
      return <span>{city}</span>
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
  const events = []
  transformSync(code, {
    filename: `${label}.tsx`,
    presets: [
      ['@babel/preset-react', { runtime: 'automatic' }],
      ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
    ],
    plugins: [
      [
        'babel-plugin-react-compiler',
        {
          target: '19',
          logger: {
            logEvent(_filename, event) {
              events.push(event)
            },
          },
        },
      ],
    ],
  })
  const summary = events
    .map((e) => {
      const fn = e.fnLoc ? '' : ''
      if (e.kind === 'CompileSuccess') return `SUCCESS(${e.fnName ?? '?'})`
      if (e.kind === 'CompileSkip') return `SKIP(${e.reason ?? '?'})`
      if (e.kind === 'CompileError')
        return `ERROR(${e.detail?.reason ?? e.detail?.severity ?? '?'})`
      if (e.kind === 'CompileDiagnostic')
        return `DIAG(${e.detail?.reason ?? '?'})`
      return e.kind
    })
    .join(', ')
  console.log(`${label.padEnd(20)} -> ${summary || '(no events)'}`)
}
