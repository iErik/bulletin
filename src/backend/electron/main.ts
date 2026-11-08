import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow } from 'electron'

// Set by electron-vite while running `pnpm dev`.
const devUrl = app.isPackaged
  ? undefined
  : process.env.ELECTRON_RENDERER_URL
const indexHtml = join(__dirname, '../renderer/index.html')

/** Whether `url` belongs to the app's own renderer. */
function isAppUrl(url: string): boolean {
  const target = new URL(url)
  if (devUrl) return target.origin === new URL(devUrl).origin
  const index = pathToFileURL(indexHtml)
  return target.protocol === 'file:'
    && target.pathname === index.pathname
}

// Keep every window on the app: no navigating away,
// no new windows.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault()
  })
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
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
