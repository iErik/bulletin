import { describe, expect, it } from 'vitest'
import { placeBeside } from './popover-position'

const PANEL = { width: 316, height: 260 }
const VIEW = { width: 900, height: 600 }

describe('placeBeside', () => {
  it('places to the right of the anchor when it fits', () => {
    expect(placeBeside(
      { left: 40, right: 200, top: 100 }, PANEL, VIEW
    )).toEqual({ left: 208, top: 100 })
  })

  it('flips left when the right side overflows', () => {
    expect(placeBeside(
      { left: 600, right: 860, top: 100 }, PANEL, VIEW
    )).toEqual({ left: 276, top: 100 })
  })

  it('clamps inside the viewport when neither side fits',
    () => {
      const narrow = { width: 400, height: 600 }
      expect(placeBeside(
        { left: 100, right: 200, top: 50 }, PANEL, narrow
      )).toEqual({ left: 76, top: 50 })
    })

  it('clamps vertically to stay inside the viewport', () => {
    expect(placeBeside(
      { left: 40, right: 200, top: 500 }, PANEL, VIEW
    )).toEqual({ left: 208, top: 332 })
    expect(placeBeside(
      { left: 40, right: 200, top: -20 }, PANEL, VIEW
    )).toEqual({ left: 208, top: 8 })
  })

  it('centers inside the viewport without an anchor', () => {
    expect(placeBeside(null, PANEL, VIEW)).toEqual({
      left: 292, top: 170
    })
  })
})
