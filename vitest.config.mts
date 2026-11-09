import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import svgLoader from 'vite-svg-loader'

const src = (path: string): string =>
  fileURLToPath(new URL(`./src/${path}`, import.meta.url))

export default defineConfig({
  plugins: [vue(), svgLoader()],
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
