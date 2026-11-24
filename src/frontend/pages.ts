import type { Component } from 'vue'
import DashboardView
  from './views/DashboardView/DashboardView.vue'
import ExpensesView
  from './views/ExpensesView/ExpensesView.vue'
import MoodView from './views/MoodView/MoodView.vue'
import SleepView from './views/SleepView/SleepView.vue'
import TasksView from './views/TasksView/TasksView.vue'

/** A top-level screen, with its Sidebar button. */
export interface Page {
  /** The route's name. */
  name: string
  path: string
  /** The Page's name, shown to the user. */
  label: string
  /** The Sidebar icon's file name in `icons/`. */
  icon: string
  /**
   * The Page's view. Without one the route shows the
   * "Coming soon" placeholder.
   */
  view?: Component
}

/**
 * Every Page, in the Figma Sidebar's order. The
 * router and the Sidebar both read this list, so a
 * Page is added in one place.
 */
export const PAGES: readonly Page[] = [
  {
    name: 'dashboard',
    path: '/',
    label: 'Dashboard',
    icon: 'home',
    view: DashboardView
  },
  {
    name: 'sleep',
    path: '/sleep',
    label: 'Sleep',
    icon: 'moon',
    view: SleepView
  },
  {
    name: 'expenses',
    path: '/expenses',
    label: 'Expenses',
    icon: 'dollar',
    view: ExpensesView
  },
  {
    name: 'habits',
    path: '/habits',
    label: 'Habits',
    icon: 'weight'
  },
  {
    name: 'mood',
    path: '/mood',
    label: 'Mood',
    icon: 'mood',
    view: MoodView
  },
  {
    name: 'tasks',
    path: '/tasks',
    label: 'Tasks',
    icon: 'checklist',
    view: TasksView
  },
  {
    name: 'notes',
    path: '/notes',
    label: 'Notes',
    icon: 'book'
  }
]

/**
 * Whether `path` belongs to `page`. The Dashboard owns
 * only `/`; any other Page also owns the paths nested
 * under its own.
 */
export const isPageActive = (
  page: Page,
  path: string
): boolean =>
  page.path === '/'
    ? path === '/'
    : path === page.path
      || path.startsWith(`${page.path}/`)
