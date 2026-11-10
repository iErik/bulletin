// Only for ESLint's type-aware rules, which read .ts
// files with plain TypeScript (see tsconfig.eslint.json).
// vue-tsc never loads it, so a .vue import that doesn't
// resolve still fails `pnpm typecheck`.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent
  export default component
}
