import { pathToFileURL } from 'node:url'
import { describe, expect, it, vi, type Mock } from 'vitest'
import {
  guardNavigation,
  isAppUrl,
  type AppPages,
  type GuardedContents
} from './navigation'

const indexHtml = '/app/out/renderer/index.html'
const dev: AppPages = {
  devUrl: 'http://localhost:5173',
  indexHtml
}
const prod: AppPages = { devUrl: undefined, indexHtml }

const fileUrl = (path: string): string =>
  pathToFileURL(path).href

describe('isAppUrl', () => {
  it('accepts the dev server origin in dev', () => {
    expect(isAppUrl('http://localhost:5173/#/x', dev))
      .toBe(true)
  })

  it('rejects other origins in dev', () => {
    expect(isAppUrl('http://localhost:5174/', dev))
      .toBe(false)
    expect(isAppUrl('https://example.com/', dev))
      .toBe(false)
  })

  it('accepts the index page in production', () => {
    const url = `${fileUrl(indexHtml)}#/today`

    expect(isAppUrl(url, prod)).toBe(true)
  })

  it('rejects other file paths in production', () => {
    const other = fileUrl('/app/out/renderer/other.html')

    expect(isAppUrl(other, prod)).toBe(false)
  })

  it('rejects http(s) URLs in production', () => {
    expect(isAppUrl('http://localhost:5173/', prod))
      .toBe(false)
    expect(isAppUrl('https://example.com/', prod))
      .toBe(false)
  })

  it('rejects malformed URLs without throwing', () => {
    expect(isAppUrl('not a url', dev)).toBe(false)
    expect(isAppUrl('not a url', prod)).toBe(false)
  })
})

type Navigate = Parameters<GuardedContents['on']>[1]
type OpenHandler =
  Parameters<GuardedContents['setWindowOpenHandler']>[0]

interface FakeContents {
  contents: GuardedContents
  navigate: (url: string) => { preventDefault: Mock }
  open: () => ReturnType<OpenHandler> | undefined
}

/** A fake web contents that records the guards. */
const fakeContents = (): FakeContents => {
  let navigate: Navigate | undefined
  let openHandler: OpenHandler | undefined
  const contents: GuardedContents = {
    on: (_event, listener) => {
      navigate = listener
    },
    setWindowOpenHandler: handler => {
      openHandler = handler
    }
  }
  return {
    contents,
    /** Fires `will-navigate`; returns the event. */
    navigate: (url: string) => {
      const event = { preventDefault: vi.fn() }
      navigate?.(event, url)
      return event
    },
    open: () => openHandler?.()
  }
}

describe('guardNavigation', () => {
  it('allows navigating to an app URL', () => {
    const fake = fakeContents()
    guardNavigation(fake.contents, dev)

    const event = fake.navigate('http://localhost:5173/x')

    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('prevents navigating to an external URL', () => {
    const fake = fakeContents()
    guardNavigation(fake.contents, dev)

    const event = fake.navigate('https://example.com/')

    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it('denies every window.open', () => {
    const fake = fakeContents()
    guardNavigation(fake.contents, dev)

    expect(fake.open()).toEqual({ action: 'deny' })
  })
})
