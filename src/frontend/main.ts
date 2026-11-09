import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useThemeStore } from './stores/theme'
import './styles/main.scss'

const app = createApp(App).use(createPinia())

// Apply the stored Theme before the first render.
useThemeStore()

app.use(router).mount('#app')
