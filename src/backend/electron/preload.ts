import { contextBridge } from 'electron'
import { BRIDGE_KEY, type BulletinApi } from '@shared/bridge'

const api: BulletinApi = {
  platform: process.platform
}

contextBridge.exposeInMainWorld(BRIDGE_KEY, api)
