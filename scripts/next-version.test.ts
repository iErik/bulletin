import { describe, expect, it } from 'vitest'
import {
  isPrerelease,
  nextVersion,
  setVersion,
  shouldBump
} from './next-version.mjs'

// A stable line with a few releases, and a beta line
const TAGS = [
  'v0.1.0', 'v0.1.1', 'v0.1.2',
  'v1.0.0-beta.1', 'v1.0.0-beta.2', 'v1.0.0-beta.3'
]

describe('nextVersion', () => {
  it('releases the first version as is', () => {
    expect(nextVersion('0.1.0', [])).toBe('0.1.0')
  })

  it('follows the highest patch on a stable line', () => {
    expect(nextVersion('0.1.2', TAGS)).toBe('0.1.3')
  })

  it('follows the highest tag on a pre-release line', () => {
    expect(nextVersion('1.0.0-beta.3', TAGS))
      .toBe('1.0.0-beta.4')
  })

  it('follows the highest tag past package.json', () => {
    expect(nextVersion('0.1.0', TAGS)).toBe('0.1.3')
    expect(nextVersion('1.0.0-beta.1', TAGS))
      .toBe('1.0.0-beta.4')
  })

  it('releases a version whose bump never landed', () => {
    expect(nextVersion('0.1.3', [...TAGS, 'v0.1.3']))
      .toBe('0.1.4')
    expect(nextVersion('0.1.3', TAGS)).toBe('0.1.3')
  })

  it('compares numbers, not strings', () => {
    const tags = ['v0.1.9', 'v0.1.10']
    expect(nextVersion('0.1.9', tags)).toBe('0.1.11')
  })

  it('ignores tag order and gaps', () => {
    const tags = ['v0.1.7', 'v0.1.2']
    expect(nextVersion('0.1.2', tags)).toBe('0.1.8')
  })

  it('releases the first version of a new line as is', () => {
    expect(nextVersion('0.2.0', TAGS)).toBe('0.2.0')
    expect(nextVersion('1.0.0-rc.1', TAGS))
      .toBe('1.0.0-rc.1')
  })

  it('ignores tags from other lines', () => {
    const tags = [
      'v0.10.4', 'v0.1.2.1', 'v0.1.2-beta.1', 'v10.1.5',
      '0.1.6', 'v1.0.0-beta1', 'v1.0.0-betaX.5',
      'v2.0.0-beta.6'
    ]

    expect(nextVersion('0.1.0', tags)).toBe('0.1.0')
    expect(nextVersion('1.0.0-beta.1', tags))
      .toBe('1.0.0-beta.1')
  })

  it('rejects anything but a full release version', () => {
    const invalid = [
      '', '0.1', 'v0.1.0', '0.1.0-beta',
      '1.0.0-beta.2.1', '0.1.0+build.1'
    ]

    for (const version of invalid) {
      expect(() => nextVersion(version, TAGS))
        .toThrow(/release version/)
    }
  })
})

describe('shouldBump', () => {
  it('moves forward on the same line', () => {
    expect(shouldBump('0.1.0', '0.1.1')).toBe(true)
    expect(shouldBump('1.0.0-beta.3', '1.0.0-beta.4'))
      .toBe(true)
  })

  it('never moves back or stays put', () => {
    expect(shouldBump('0.1.4', '0.1.4')).toBe(false)
    expect(shouldBump('0.1.5', '0.1.4')).toBe(false)
  })

  it('leaves a line changed by hand alone', () => {
    expect(shouldBump('0.2.0', '0.1.4')).toBe(false)
    expect(shouldBump('1.0.0-rc.1', '1.0.0-beta.4'))
      .toBe(false)
  })
})

describe('setVersion', () => {
  const pkg = [
    '{',
    '  "name": "bulletin",',
    '  "version": "0.1.0",',
    '  "build": {',
    '    "version": "untouched"',
    '  }',
    '}',
    ''
  ].join('\n')

  it('replaces only the top-level version', () => {
    expect(setVersion(pkg, '0.1.1'))
      .toBe(pkg.replace('0.1.0', '0.1.1'))
  })

  it('needs exactly one top-level version', () => {
    expect(() => setVersion('{\n}\n', '0.1.1'))
      .toThrow(/found 0/)

    const twice =
      pkg.replace('{', '{\n  "version": "0.0.1",')
    expect(() => setVersion(twice, '0.1.1'))
      .toThrow(/found 2/)
  })
})

describe('isPrerelease', () => {
  it('is true only with a pre-release part', () => {
    expect(isPrerelease('1.0.0-beta.4')).toBe(true)
    expect(isPrerelease('0.1.1')).toBe(false)
  })
})
