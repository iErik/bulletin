/**
 * The API the preload script exposes to the renderer
 * through `contextBridge`, as `window[BRIDGE_KEY]`.
 */
export interface BulletinApi {
  /** The OS platform, as Node's `process.platform`. */
  readonly platform: string
}

export const BRIDGE_KEY = 'bulletin'

declare global {
  interface Window {
    readonly bulletin: BulletinApi
  }
}
