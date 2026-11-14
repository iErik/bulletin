import {
  createRouter,
  createWebHashHistory,
  type RouteRecordRaw
} from 'vue-router'
import { PAGES } from './pages'
import PlaceholderView
  from './views/PlaceholderView/PlaceholderView.vue'

/** One route per Page, from the Page list. */
export const routes: RouteRecordRaw[] = PAGES.map(
  page => page.view
    ? {
        path: page.path,
        name: page.name,
        component: page.view
      }
    : {
        path: page.path,
        name: page.name,
        component: PlaceholderView,
        props: { page: page.label }
      }
)

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
