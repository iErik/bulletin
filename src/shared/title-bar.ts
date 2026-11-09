/**
 * Geometry of the Title Bar, shared by main (window
 * options) and the renderer (layout). Values come from
 * the Figma "App Window" frames.
 */

/** The Title Bar's height, in CSS pixels. */
export const TITLE_BAR_HEIGHT = 44

/**
 * Top-left corner of the macOS traffic lights. 15 + 14/2
 * puts their centre on the Title Bar's centre line.
 */
export const TRAFFIC_LIGHTS = { x: 15, y: 15 } as const

/** Width of the three traffic lights, in Figma. */
const TRAFFIC_LIGHTS_WIDTH = 58

/** Which edge of the Title Bar holds the controls. */
export type ControlsSide = 'left' | 'right'

/**
 * Where the window controls sit on `platform` (as
 * Node's `process.platform`).
 */
export const controlsSide = (
  platform: string
): ControlsSide =>
  platform === 'darwin' ? 'left' : 'right'

/**
 * Space the Title Bar keeps clear for the traffic
 * lights: their width plus the same margin each side.
 */
export const MAC_CONTROLS_INSET =
  TRAFFIC_LIGHTS.x * 2 + TRAFFIC_LIGHTS_WIDTH
