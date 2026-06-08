// Re-export react-hook-form under a different module specifier so the
// React Compiler's hardcoded `defaultModuleTypeProvider` (which keys on the
// literal source string "react-hook-form") does NOT recognize it and
// therefore does NOT bail out. This lets us force the compiler to actually
// MEMOIZE a component that calls `useForm().watch()` -- the exact pattern it
// normally refuses to compile -- so we can test whether v8's watch() is
// genuinely safe under full memoization.
export * from 'react-hook-form'
