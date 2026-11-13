import {
  mkdtempSync,
  readdirSync,
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
  it
} from 'vitest'
import {
  formatEntry,
  logFileName,
  pruneLogs
} from './log-files'

describe('logFileName', () => {
  it('names the run by its start, in UTC', () => {
    const start = new Date('2026-11-13T04:30:00.123Z')

    expect(logFileName(start))
      .toBe('main-2026-11-13T04-30-00.log')
  })
})

describe('pruneLogs', () => {
  let dir: string
  const run = (day: number): string =>
    logFileName(new Date(Date.UTC(2026, 10, day)))
  const touch = (...names: string[]): void => {
    for (const name of names)
      writeFileSync(join(dir, name), '')
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'bulletin-logs-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('keeps this run and the 4 before it', () => {
    touch(run(1), run(2), run(3), run(4), run(5))

    pruneLogs(dir, run(6))

    expect(readdirSync(dir).sort())
      .toEqual([run(2), run(3), run(4), run(5)])
  })

  it('counts this run when it exists', () => {
    touch(run(1), run(2), run(3), run(4), run(5), run(6))

    pruneLogs(dir, run(6))

    expect(readdirSync(dir)).toHaveLength(5)
    expect(readdirSync(dir)).not.toContain(run(1))
  })

  it('leaves other files and few runs alone', () => {
    touch(run(1), 'notes.txt', 'main.log')

    pruneLogs(dir, run(2))

    expect(readdirSync(dir).sort())
      .toEqual([run(1), 'main.log', 'notes.txt'])
  })

  it('ignores a missing folder', () => {
    expect(() => pruneLogs(join(dir, 'none'), run(1)))
      .not.toThrow()
  })
})

describe('formatEntry', () => {
  const date = new Date('2026-11-13T04:30:00.000Z')

  it('starts with the time and level', () => {
    expect(formatEntry(date, 'info', ['Started', 1]))
      .toBe('2026-11-13T04:30:00.000Z [info] Started 1')
  })

  it('prints the whole error', () => {
    const cause = Object.assign(new Error('inner'), {
      sql: 'CREATE TABLE x'
    })
    const error = new Error('outer', { cause })

    const entry = formatEntry(date, 'error', [
      'Failed:',
      error
    ])

    expect(entry.split('\n')[0]).toBe(
      '2026-11-13T04:30:00.000Z [error] Failed: Error: outer'
    )
    expect(entry).toContain('at ')
    expect(entry).toContain('[cause]: Error: inner')
    expect(entry).toContain('CREATE TABLE x')
  })
})
