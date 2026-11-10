import type { WeightApi } from './weight'

/**
 * Colours of the window controls on Linux and Windows,
 * as CSS colour strings.
 */
export interface WindowControlsColours {
  /** The controls' background (the Title Bar's). */
  readonly background: string
  /** The minimize, maximize and close symbols. */
  readonly symbol: string
}

/**
 * The API the preload script exposes to the renderer
 * through `contextBridge`, as `window[BRIDGE_KEY]`.
 */
export interface BulletinApi {
  /** The OS platform, as Node's `process.platform`. */
  readonly platform: string
  /**
   * Recolours the window controls overlay to match the
   * Title Bar. Does nothing on macOS, whose traffic
   * lights keep their native colours.
   */
  setWindowControlsColours(
    colours: WindowControlsColours
  ): void
  /** The Weight Tracker's Entries. */
  readonly weight: WeightApi
}

export const BRIDGE_KEY = 'bulletin'

/** IPC channel behind `setWindowControlsColours`. */
export const WINDOW_CONTROLS_CHANNEL =
  'window-controls:set-colours'

declare global {
  interface Window {
    readonly bulletin: BulletinApi
  }
}
