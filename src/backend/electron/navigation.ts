import { pathToFileURL } from 'node:url'
import type { WindowOpenHandlerResponse } from 'electron'

/** Where the app's own renderer page is loaded from. */
export interface AppPages {
  /** The dev server's URL, set only while developing. */
  readonly devUrl: string | undefined
  /** Absolute path of the built `index.html`. */
  readonly indexHtml: string
}

/**
 * The part of Electron's `WebContents` the guards use,
 * so tests can pass a fake.
 */
export interface GuardedContents {
  on(
    event: 'will-navigate',
    listener: (
      event: { preventDefault(): void },
      url: string
    ) => void
  ): unknown
  setWindowOpenHandler(
    handler: () => WindowOpenHandlerResponse
  ): void
}

/**
 * Whether `url` belongs to the app's own renderer.
 * Malformed URLs are not app URLs.
 */
export function isAppUrl(
  url: string,
  pages: AppPages
): boolean {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return false
  }
  if (pages.devUrl) {
    return target.origin === new URL(pages.devUrl).origin
  }
  const index = pathToFileURL(pages.indexHtml)
  return target.protocol === 'file:'
    && target.pathname === index.pathname
}

/**
 * Keeps `contents` on the app: blocks navigation to
 * non-app URLs and denies every new window.
 */
export function guardNavigation(
  contents: GuardedContents,
  pages: AppPages
): void {
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url, pages)) event.preventDefault()
  })
  contents.setWindowOpenHandler(
    () => ({ action: 'deny' })
  )
}
