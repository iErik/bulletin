import type {
  BrowserWindow,
  IpcMain,
  WebContents
} from 'electron'
import type { WindowControlsColours } from '@shared/bridge'
import { WINDOW_CONTROLS_CHANNEL } from '@shared/bridge'
import { TITLE_BAR_HEIGHT } from '@shared/title-bar'

/**
 * Overlay colours used until the renderer sends the
 * Theme's, by whether the OS prefers dark colours.
 */
export const INITIAL_COLOURS: Readonly<
  Record<'dark' | 'light', WindowControlsColours>
> = {
  dark: { background: '#000000', symbol: '#ffffff' },
  light: { background: '#ffffff', symbol: '#000000' }
}

// Hex (#rgb, #rgba, #rrggbb, #rrggbbaa) or a
// functional rgb()/rgba()/hsl()/hsla() notation.
const HEX = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i
const FUNC = /^(?:rgba?|hsla?)\(\s*[\d.%,\s/+-]+\)$/i

const isColour = (value: unknown): value is string =>
  typeof value === 'string'
  && (HEX.test(value) || FUNC.test(value))

/**
 * `value` as window-controls colours, or `null` if it
 * isn't an object with two valid CSS colour strings.
 */
export const parseColours = (
  value: unknown
): WindowControlsColours | null => {
  if (typeof value !== 'object' || value === null)
    return null
  const { background, symbol } =
    value as Record<string, unknown>
  return isColour(background) && isColour(symbol)
    ? { background, symbol }
    : null
}

type Overlay = Pick<BrowserWindow, 'setTitleBarOverlay'>

/**
 * Recolours `win`'s window controls overlay. Ignores
 * invalid colours, and macOS, which has no overlay.
 * Returns whether the colours were applied.
 */
export const applyColours = (
  win: Overlay,
  platform: string,
  value: unknown
): boolean => {
  if (platform === 'darwin') return false
  const colours = parseColours(value)
  if (!colours) return false
  win.setTitleBarOverlay({
    color: colours.background,
    symbolColor: colours.symbol,
    height: TITLE_BAR_HEIGHT
  })
  return true
}

/**
 * Applies colours the renderer sends on the
 * window-controls channel to the sender's window.
 */
export const handleWindowControls = (
  ipc: Pick<IpcMain, 'on'>,
  windowOf: (sender: WebContents) => Overlay | null,
  platform: string
): void => {
  ipc.on(WINDOW_CONTROLS_CHANNEL, (event, value) => {
    const win = windowOf(event.sender)
    if (win) applyColours(win, platform, value)
  })
}
