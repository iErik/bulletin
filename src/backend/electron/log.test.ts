import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'

type Format = (params: { message: object }) => string[]

interface FakeTransport {
  level: unknown
  format?: Format
}

const transport = (): FakeTransport => ({
  level: 'silly'
})
const fake = {
  transports: {
    console: transport(),
    file: transport(),
    ipc: transport()
  },
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}

vi.mock('electron-log/main', () => ({ default: fake }))

const { logError, startLog } = await import('./log')

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'bulletin-log-'))
  vi.resetAllMocks()
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const options = {
  version: '1.2.3',
  platform: 'darwin',
  arch: 'arm64',
  dev: false,
  now: new Date('2026-11-13T04:30:00Z')
}

describe('startLog', () => {
  it('writes the startup line to the run file', () => {
    const file = join(
      dir,
      'logs',
      'main-2026-11-13T04-30-00.log'
    )
    fake.info.mockImplementation(() => {
      mkdirSync(join(dir, 'logs'), { recursive: true })
      writeFileSync(file, '')
    })

    expect(startLog({ ...options, userData: dir }))
      .toBe(file)
    expect(fake.info)
      .toHaveBeenCalledWith('Bulletin 1.2.3 on darwin arm64')
    expect(fake.transports).toMatchObject({
      file: { level: 'info', maxSize: 0 },
      console: { level: false },
      ipc: { level: false }
    })
  })

  it('formats entries as plain text', () => {
    startLog({ ...options, userData: dir })
    const message = {
      date: options.now,
      level: 'warn',
      data: ['Careful', 2]
    }

    expect(fake.transports.file.format!({ message }))
      .toEqual(['2026-11-13T04:30:00.000Z [warn] Careful 2'])
  })

  it('logs to the console in development', () => {
    startLog({ ...options, userData: dir, dev: true })

    expect(fake.transports.console.level).toBe('info')
  })

  it('returns no path when nothing was written', () => {
    expect(startLog({ ...options, userData: dir }))
      .toBeUndefined()
  })

  it('never throws', () => {
    fake.info.mockImplementation(() => {
      throw new Error('EACCES')
    })

    expect(startLog({ ...options, userData: dir }))
      .toBeUndefined()
  })
})

describe('logError', () => {
  it('passes the error on whole', () => {
    const error = new Error('boom')

    logError('Failed:', error)

    expect(fake.error).toHaveBeenCalledWith('Failed:', error)
  })
})
