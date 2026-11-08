import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

const src = (path: string): string =>
  resolve(__dirname, 'src', path)

const alias = { '@shared': src('shared') }

export default defineConfig({
  main: {
    resolve: { alias },
    build: {
      rolldownOptions: {
        input: { index: src('backend/electron/main.ts') }
      }
    }
  },
  preload: {
    resolve: { alias },
    build: {
      rolldownOptions: {
        input: {
          index: src('backend/electron/preload.ts')
        }
      }
    }
  },
  renderer: {
    root: src('frontend'),
    resolve: {
      alias: { ...alias, '@': src('frontend') }
    },
    plugins: [vue()],
    build: {
      rolldownOptions: {
        input: src('frontend/index.html')
      }
    }
  }
})
