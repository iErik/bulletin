import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { svgIcons } from './svg-icons'

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
    // Vue Devtools' overlay runs on the dev server only.
    plugins: [vue(), svgIcons(), vueDevTools()],
    build: {
      // Never inline fonts as data: URLs, which the
      // Content Security Policy blocks.
      assetsInlineLimit: (file: string) =>
        file.endsWith('.woff2') ? false : undefined,
      rolldownOptions: {
        input: src('frontend/index.html')
      }
    }
  }
})
