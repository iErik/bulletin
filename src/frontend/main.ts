import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useThemeStore } from './stores/theme'
// Figma's fonts, bundled so they work offline and
// within the Content Security Policy. Martian Mono
// keeps its width axis, so the default width (100, as
// in Figma) is the one drawn.
import '@fontsource-variable/ubuntu-sans/wght.css'
import '@fontsource-variable/martian-mono/standard.css'
import './styles/main.scss'

const app = createApp(App).use(createPinia())

// Apply the stored Theme before the first render.
useThemeStore()

app.use(router).mount('#app')
