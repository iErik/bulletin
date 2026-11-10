import { contextBridge, ipcRenderer } from 'electron'
import {
  BRIDGE_KEY,
  WINDOW_CONTROLS_CHANNEL,
  type BulletinApi
} from '@shared/bridge'

const api: BulletinApi = {
  platform: process.platform,
  setWindowControlsColours: colours =>
    ipcRenderer.send(WINDOW_CONTROLS_CHANNEL, colours)
}

contextBridge.exposeInMainWorld(BRIDGE_KEY, api)
