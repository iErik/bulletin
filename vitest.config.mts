import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import svgLoader from 'vite-svg-loader'

const src = (path: string): string =>
  fileURLToPath(new URL(`./src/${path}`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': src('frontend'),
      '@shared': src('shared')
    }
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [vue(), svgLoader()],
        test: {
          name: 'renderer',
          environment: 'happy-dom',
          include: ['src/frontend/**/*.test.ts'],
          setupFiles: ['src/frontend/testing/setup.ts'],
          unstubGlobals: true
        }
      },
      {
        // Node only: shared code tested here proves it
        // doesn't touch the DOM.
        extends: true,
        test: {
          name: 'main',
          environment: 'node',
          include: [
            'src/backend/**/*.test.ts',
            'src/shared/**/*.test.ts'
          ]
        }
      }
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/frontend/testing/**'
      ]
    }
  }
})
