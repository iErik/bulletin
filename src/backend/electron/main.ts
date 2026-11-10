import { join } from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme
} from 'electron'
import {
  openDatabase,
  openErrorMessage
} from '../storage/database'
import { storagePaths } from '../storage/paths'
import { guardNavigation } from './navigation'
import {
  handleWindowControls,
  INITIAL_COLOURS
} from './window-controls'
import {
  windowFrameOptions,
  windowSizeOptions
} from './window-options'

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
    ...windowSizeOptions(),
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

/**
 * Opens and migrates the database. On failure, reports
 * the error and quits: the app never opens without its
 * data.
 */
function startStorage(): boolean {
  try {
    openDatabase(storagePaths({
      packaged: app.isPackaged,
      userData: app.getPath('userData'),
      appPath: app.getAppPath(),
      resourcesPath: process.resourcesPath
    }))
    return true
  } catch (error) {
    console.error('Could not open the database:', error)
    dialog.showErrorBox(
      'Bulletin could not open its data',
      openErrorMessage(error)
    )
    app.exit(1)
    return false
  }
}

void app.whenReady().then(() => {
  if (!startStorage()) return
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
