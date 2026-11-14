import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type DOMWrapper,
  type VueWrapper
} from '@vue/test-utils'
import type { WeightApi } from '@shared/weight'
import {
  fakeBulletin,
  stubBulletin
} from '@/testing/bulletin'
import { today, useFixedToday } from '@/testing/clock'
import WeightForm from './WeightForm.vue'

const DAY = new Date(2026, 7, 12)

const stubWeight = (
  overrides: Partial<WeightApi> = {}
): WeightApi =>
  stubBulletin({
    weight: { ...fakeBulletin().weight, ...overrides }
  }).weight

const mountForm = (): VueWrapper =>
  mount(WeightForm, {
    attachTo: document.body,
    props: { day: DAY, today }
  })

const save = (
  form: VueWrapper
): DOMWrapper<HTMLButtonElement> =>
  form.find<HTMLButtonElement>(
    'button[aria-label="Save weight"]'
  )

const value = (
  form: VueWrapper
): DOMWrapper<HTMLInputElement> =>
  form.find<HTMLInputElement>('input')

describe('WeightForm', () => {
  useFixedToday()
  enableAutoUnmount(afterEach)

  it('opens on the day, focused on the value', () => {
    stubWeight()
    const form = mountForm()

    expect(form.get('.title').text())
      .toBe('Add new entry')
    expect(document.activeElement)
      .toBe(value(form).element)
    const selected = (label: string): string =>
      (form.get(`[aria-label="${label}"]`)
        .element as HTMLSelectElement).value
    expect(selected('Day')).toBe('12')
    expect(selected('Month')).toBe('7')
    // No day after today is offered.
    expect(form.findAll('[aria-label="Month"] option'))
      .toHaveLength(11)
  })

  it.each(['', '63,45', '19.9', '300,1', 'abc'])(
    'disables ✓ for "%s"',
    async text => {
      stubWeight()
      const form = mountForm()

      await value(form).setValue(text)

      expect(save(form).element.disabled).toBe(true)
    }
  )

  it.each(['63,4', '63.4'])(
    'saves "%s" as 63 400 g',
    async text => {
      const weight = stubWeight()
      const form = mountForm()

      await value(form).setValue(text)
      await save(form).trigger('click')
      await flushPromises()

      const entry = { date: '2026-08-12', grams: 63_400 }
      expect(weight.create)
        .toHaveBeenCalledExactlyOnceWith(entry)
      expect(form.emitted('saved')).toEqual([[entry]])
    }
  )

  it('saves on Enter and closes on Escape', async () => {
    const weight = stubWeight()
    const form = mountForm()
    await value(form).setValue('70')

    await value(form).trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(weight.create).toHaveBeenCalledOnce()

    await value(form).trigger('keydown', { key: 'Escape' })
    expect(form.emitted('close')).toHaveLength(1)
  })

  it('closes on ×, saving nothing', async () => {
    const weight = stubWeight()
    const form = mountForm()
    await value(form).setValue('70')

    await form.get('button[aria-label="Cancel"]')
      .trigger('click')

    expect(form.emitted('close')).toHaveLength(1)
    expect(weight.create).not.toHaveBeenCalled()
  })

  it('says when the day\'s Entry is replaced', async () => {
    const weight = stubWeight({
      list: vi.fn<WeightApi['list']>(async ({ from }) => ({
        ok: true as const,
        value: from === '2026-08-03'
          ? [{ date: from, grams: 63_400 }]
          : []
      }))
    })
    const form = mountForm()
    await flushPromises()
    expect(form.find('.message').exists()).toBe(false)

    await form.get('[aria-label="Day"]').setValue('3')
    await flushPromises()

    expect(weight.list).toHaveBeenLastCalledWith({
      from: '2026-08-03',
      to: '2026-08-03'
    })
    expect(form.get('.message').text())
      .toBe('Replaces 63.4 kg logged on this day')
  })

  it('keeps the input and shows a storage error', async () => {
    stubWeight({
      create: async () => ({
        ok: false,
        error: { code: 'future-date' }
      })
    })
    const form = mountForm()
    await value(form).setValue('70')

    await save(form).trigger('click')
    await flushPromises()

    expect(form.get('[role="alert"]').text())
      .toBe('A future day can\'t have a weight.')
    expect(form.emitted('saved')).toBeUndefined()
    expect(value(form).element.value).toBe('70')
  })

  it('writes once while a save is pending', async () => {
    let finish = (): void => {}
    const weight = stubWeight({
      create: vi.fn<WeightApi['create']>(entry =>
        new Promise(resolve => {
          finish = () => resolve({ ok: true, value: entry })
        }))
    })
    const form = mountForm()
    await value(form).setValue('70')

    await value(form).trigger('keydown', { key: 'Enter' })
    await value(form).trigger('keydown', { key: 'Enter' })
    await value(form).trigger('keydown', { key: 'Escape' })
    finish()
    await flushPromises()

    expect(weight.create).toHaveBeenCalledOnce()
    expect(form.emitted('close')).toBeUndefined()
    expect(form.emitted('saved')).toHaveLength(1)
  })
})
