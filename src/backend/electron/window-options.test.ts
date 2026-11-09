import { describe, expect, it } from 'vitest'
import { windowFrameOptions } from './window-options'

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
