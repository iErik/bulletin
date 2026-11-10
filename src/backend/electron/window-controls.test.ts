import { describe, expect, it, vi, type Mock } from 'vitest'
import { WINDOW_CONTROLS_CHANNEL } from '@shared/bridge'
import {
  applyColours,
  handleWindowControls,
  parseColours
} from './window-controls'

const valid = { background: '#121419', symbol: '#f5f6f8' }

const fakeWindow = (): { setTitleBarOverlay: Mock } =>
  ({ setTitleBarOverlay: vi.fn() })

describe('parseColours', () => {
  it.each([
    '#fff',
    '#ffff',
    '#a1b2c3',
    '#a1b2c3d4',
    'rgb(1, 2, 3)',
    'rgba(1 2 3 / 50%)',
    'hsl(210, 10%, 8%)'
  ])('accepts %s', colour => {
    const value = { background: colour, symbol: colour }
    expect(parseColours(value)).toEqual(value)
  })

  it.each([
    null,
    'red',
    {},
    { background: '#fff' },
    { background: '#fff', symbol: 12 },
    { background: '#ggg', symbol: '#fff' },
    { background: 'url(x)', symbol: '#fff' },
    { background: 'red; x', symbol: '#fff' }
  ])('rejects %j', value => {
    expect(parseColours(value)).toBeNull()
  })

  it('drops extra fields', () => {
    expect(parseColours({ ...valid, height: 99 }))
      .toEqual(valid)
  })
})

describe('applyColours', () => {
  it.each(['linux', 'win32'])(
    'recolours the overlay on %s',
    platform => {
      const win = fakeWindow()

      expect(applyColours(win, platform, valid)).toBe(true)
      expect(win.setTitleBarOverlay).toHaveBeenCalledWith({
        color: '#121419',
        symbolColor: '#f5f6f8',
        height: 44
      })
    }
  )

  it('ignores macOS', () => {
    const win = fakeWindow()

    expect(applyColours(win, 'darwin', valid)).toBe(false)
    expect(win.setTitleBarOverlay).not.toHaveBeenCalled()
  })

  it('ignores invalid colours', () => {
    const win = fakeWindow()

    expect(applyColours(win, 'linux', { background: 1 }))
      .toBe(false)
    expect(win.setTitleBarOverlay).not.toHaveBeenCalled()
  })
})

describe('handleWindowControls', () => {
  type Listener = (event: object, value: unknown) => void

  const setup = (win: object | null) => {
    let listener: Listener = () => {}
    const ipc = {
      on: vi.fn((channel: string, fn: Listener) => {
        expect(channel).toBe(WINDOW_CONTROLS_CHANNEL)
        listener = fn
      })
    }
    handleWindowControls(
      ipc as never,
      () => win as never,
      'linux'
    )
    return (value: unknown) =>
      listener({ sender: {} }, value)
  }

  it("applies colours to the sender's window", () => {
    const win = fakeWindow()
    const send = setup(win)

    send(valid)

    expect(win.setTitleBarOverlay).toHaveBeenCalledOnce()
  })

  it('ignores senders without a window', () => {
    const send = setup(null)

    expect(() => send(valid)).not.toThrow()
  })
})
