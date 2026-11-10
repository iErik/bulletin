import { describe, expect, it } from 'vitest'
import {
  windowFrameOptions,
  windowSizeOptions
} from './window-options'

const colours = { background: '#111111', symbol: '#eeeeee' }

describe('windowFrameOptions', () => {
  it('moves the traffic lights on macOS', () => {
    expect(windowFrameOptions('darwin', colours))
      .toEqual({
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 15, y: 15 }
      })
  })

  it.each(['linux', 'win32'])(
    'uses a coloured overlay on %s',
    platform => {
      expect(windowFrameOptions(platform, colours))
        .toEqual({
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: '#111111',
            symbolColor: '#eeeeee',
            height: 44
          }
        })
    }
  )
})

describe('windowSizeOptions', () => {
  it('opens at and keeps the Figma frame size', () => {
    expect(windowSizeOptions()).toEqual({
      width: 1228,
      height: 834,
      minWidth: 1228,
      minHeight: 834
    })
  })
})
