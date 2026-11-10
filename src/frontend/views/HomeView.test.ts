import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import {
  fakeBulletin,
  stubBulletin
} from '@/testing/bulletin'
import HomeView from './HomeView.vue'

const platformText = (): string =>
  mount(HomeView, {
    global: { plugins: [createPinia()] }
  }).get('[data-test="platform"]').text()

describe('HomeView', () => {
  it('shows the platform from the preload API', () => {
    expect(platformText()).toBe(fakeBulletin().platform)
  })

  it('shows an overridden platform', () => {
    stubBulletin({ platform: 'otheros' })

    expect(platformText()).toBe('otheros')
  })
})
