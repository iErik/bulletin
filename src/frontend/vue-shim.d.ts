// For ESLint's type-aware rules, which read .ts files
// with plain TypeScript. vue-tsc and Vite resolve .vue
// imports to the real components, not to this.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent
  export default component
}
