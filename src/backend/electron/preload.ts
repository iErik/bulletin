import { contextBridge, ipcRenderer } from 'electron'
import {
  BRIDGE_KEY,
  WINDOW_CONTROLS_CHANNEL,
  type BulletinApi
} from '@shared/bridge'
import {
  WEIGHT_CHANNELS,
  type WeightApi
} from '@shared/weight'

/**
 * A bridge namespace whose methods invoke `channels`,
 * passing their one payload argument through.
 */
const invoker = <T>(
  channels: Readonly<Record<keyof T, string>>
): T =>
  Object.fromEntries(
    Object.entries<string>(channels).map(
      ([method, channel]) => [
        method,
        (payload: unknown) =>
          ipcRenderer.invoke(channel, payload)
      ]
    )
  ) as T

const api: BulletinApi = {
  platform: process.platform,
  setWindowControlsColours: colours =>
    ipcRenderer.send(WINDOW_CONTROLS_CHANNEL, colours),
  weight: invoker<WeightApi>(WEIGHT_CHANNELS)
}

contextBridge.exposeInMainWorld(BRIDGE_KEY, api)
