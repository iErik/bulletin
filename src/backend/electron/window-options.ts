import type {
  BrowserWindowConstructorOptions
} from 'electron'
import type { WindowControlsColours } from '@shared/bridge'
import {
  TITLE_BAR_HEIGHT,
  TRAFFIC_LIGHTS
} from '@shared/title-bar'

/**
 * The frame options for the main window on `platform`
 * (as Node's `process.platform`). Every platform hides
 * the native title bar; the app draws its own Title Bar.
 *
 * - macOS keeps the native traffic lights, moved onto
 *   the Title Bar's centre line.
 * - Linux and Windows get Electron's window controls
 *   overlay, as tall as the Title Bar and coloured with
 *   `colours` until the renderer sends the Theme's.
 */
export const windowFrameOptions = (
  platform: string,
  colours: WindowControlsColours
): BrowserWindowConstructorOptions => {
  if (platform === 'darwin') {
    return {
      titleBarStyle: 'hidden',
      trafficLightPosition: { ...TRAFFIC_LIGHTS }
    }
  }
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: colours.background,
      symbolColor: colours.symbol,
      height: TITLE_BAR_HEIGHT
    }
  }
}

/**
 * The Figma "App Window" frame's size, in CSS pixels.
 * The main window opens at it and can't shrink below.
 */
const MIN_WINDOW_SIZE = {
  width: 1228,
  height: 834
} as const

/** The main window's initial and minimum size. */
export const windowSizeOptions =
  (): BrowserWindowConstructorOptions => ({
    width: MIN_WINDOW_SIZE.width,
    height: MIN_WINDOW_SIZE.height,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height
  })
