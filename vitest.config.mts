import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const src = (path: string): string =>
  fileURLToPath(new URL(`./src/${path}`, import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': src('frontend'),
      '@shared': src('shared')
    }
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts']
  }
})
