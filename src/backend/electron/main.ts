import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  ipcMain,
  nativeTheme
} from 'electron'
import { guardNavigation } from './navigation'
import {
  handleWindowControls,
  INITIAL_COLOURS
} from './window-controls'
import { windowFrameOptions } from './window-options'

// Set by electron-vite while running `pnpm dev`.
const devUrl = app.isPackaged
  ? undefined
  : process.env.ELECTRON_RENDERER_URL
const indexHtml = join(__dirname, '../renderer/index.html')

// Keep every window on the app: no navigating away,
// no new windows.
app.on('web-contents-created', (_event, contents) => {
  guardNavigation(contents, { devUrl, indexHtml })
})

function createWindow(): void {
  const scheme = nativeTheme.shouldUseDarkColors
    ? 'dark'
    : 'light'
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    ...windowFrameOptions(
      process.platform,
      INITIAL_COLOURS[scheme]
    ),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(indexHtml)
}

handleWindowControls(
  ipcMain,
  sender => BrowserWindow.fromWebContents(sender),
  process.platform
)

void app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
