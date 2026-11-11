import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  createMemoryHistory,
  createRouter,
  type Router
} from 'vue-router'
import { routes } from '@/router'
import Sidebar from './Sidebar.vue'

const LABELS = [
  'Dashboard',
  'Sleep',
  'Mood',
  'Tasks',
  'Expenses',
  'Notes'
]

// The app's routes, plus a catch-all so nested paths
// such as `/sleep/x` resolve without a warning.
const makeRouter = (): Router =>
  createRouter({
    history: createMemoryHistory(),
    routes: [
      ...routes,
      { path: '/:rest(.*)*', component: { render: () => null } }
    ]
  })

const mountAt = async (
  path: string
): Promise<{ sidebar: VueWrapper; router: Router }> => {
  const router = makeRouter()
  await router.push(path)
  await router.isReady()
  const sidebar = mount(Sidebar, {
    global: { plugins: [router] }
  })
  return { sidebar, router }
}

const current = (sidebar: VueWrapper): string[] =>
  sidebar
    .findAll('a[aria-current="page"]')
    .map(link => link.attributes('aria-label') ?? '')

describe('Sidebar', () => {
  it('is a nav named "Pages"', async () => {
    const { sidebar } = await mountAt('/')

    const nav = sidebar.get('nav')
    expect(nav.attributes('aria-label')).toBe('Pages')
  })

  it('labels each Page link, in order', async () => {
    const { sidebar } = await mountAt('/')

    const links = sidebar.findAll('nav a')
    expect(links.map(l => l.attributes('aria-label')))
      .toEqual(LABELS)
    expect(links.map(l => l.attributes('href'))).toEqual([
      '/',
      '/sleep',
      '/mood',
      '/tasks',
      '/expenses',
      '/notes'
    ])
  })

  it('keeps each icon decorative', async () => {
    const { sidebar } = await mountAt('/')

    const icons = sidebar.findAll('nav a > svg')
    expect(icons).toHaveLength(6)
    for (const icon of icons)
      expect(icon.attributes('aria-hidden')).toBe('true')
  })

  it.each([
    ['/', 'Dashboard'],
    ['/sleep', 'Sleep'],
    ['/sleep/x', 'Sleep'],
    ['/mood', 'Mood'],
    ['/tasks/a/b', 'Tasks'],
    ['/expenses', 'Expenses'],
    ['/notes/x', 'Notes']
  ])('marks only %s\'s Page current', async (path, label) => {
    const { sidebar } = await mountAt(path)

    expect(current(sidebar)).toEqual([label])
  })

  it('marks no Page current elsewhere', async () => {
    const { sidebar } = await mountAt('/elsewhere')

    expect(current(sidebar)).toEqual([])
  })

  it('navigates when a link is clicked', async () => {
    const { sidebar, router } = await mountAt('/')

    await sidebar.get('a[aria-label="Mood"]').trigger('click')
    await router.isReady()
    await new Promise(resolve => setTimeout(resolve))

    expect(router.currentRoute.value.path).toBe('/mood')
    expect(current(sidebar)).toEqual(['Mood'])
  })

  it('gives each link a tooltip', async () => {
    const { sidebar } = await mountAt('/')

    expect(sidebar.findAll('.app-tooltip > a'))
      .toHaveLength(6)
  })
})
