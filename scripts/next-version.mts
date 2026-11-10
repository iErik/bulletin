// Picks the version of the next release, and bumps
// package.json to it afterwards. package.json's `version`
// is the last version released, and the next release
// takes the next number on its line, after the highest
// existing tag:
//
//   0.1.0        (line 0.1)        -> 0.1.1, 0.1.2, ...
//   1.0.0-beta.3 (line 1.0.0-beta) -> 1.0.0-beta.4, ...
//
// Moving to a new line is a manual edit to its first
// version (0.2.0, 1.0.0-rc.1), which is released as is.
// Ported from Tidder's scripts/next-version.mjs.
//
// Run by the release workflow, which reads its outputs
// from $GITHUB_OUTPUT. Without it, prints them:
//
//   node scripts/next-version.mts      version=, prerelease=
//   node scripts/next-version.mts bump <version>  bumped=
//
// No dependencies: Node 24 runs it as is, stripping the
// types, so it uses only erasable TypeScript. `.mts`
// makes it an ES module, as package.json has no `type`.

import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  readFileSync,
  writeFileSync
} from 'node:fs'

const escape = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// X.Y.Z, or X.Y.Z-<word>.N
const STABLE = /^(\d+\.\d+)\.(\d+)$/
const PRERELEASE =
  /^(\d+\.\d+\.\d+-[0-9A-Za-z-]+)\.(\d+)$/

// `0.1.2` -> { line: '0.1', number: 2 }
// `1.0.0-beta.3` -> { line: '1.0.0-beta', number: 3 }
export function parseVersion(
  version: string
): { line: string, number: number } {
  const match =
    STABLE.exec(version) ?? PRERELEASE.exec(version)

  if (!match)
    throw new Error(
      `"${version}" isn't a release version: use ` +
      'X.Y.Z or X.Y.Z-<word>.N, e.g. 0.2.0 or ' +
      '1.0.0-beta.1'
    )

  return { line: match[1], number: Number(match[2]) }
}

// The version to release after `version`. `tags` are
// tag names (`v0.1.3`); ones that aren't on the
// version's line are ignored.
export function nextVersion(
  version: string,
  tags: readonly string[]
): string {
  const { line, number } = parseVersion(version)

  const pattern = new RegExp(`^v${escape(line)}\\.(\\d+)$`)
  const tagged = tags
    .map(tag => pattern.exec(tag))
    .filter(match => match !== null)
    .map(match => Number(match[1]) + 1)

  // An untagged version (a new line, or a release whose
  // bump never landed) is released as is
  return `${line}.${Math.max(number, ...tagged)}`
}

export const isPrerelease = (version: string): boolean =>
  version.includes('-')

// Whether package.json should move from `current` to
// `released`. Only moves forward on the same line, so a
// late run never takes package.json back, or off a line
// changed by hand.
export function shouldBump(
  current: string,
  released: string
): boolean {
  const from = parseVersion(current)
  const to = parseVersion(released)

  return from.line === to.line && to.number > from.number
}

// Replaces package.json's top-level `version` and
// nothing else, keeping the file's formatting.
export function setVersion(
  text: string,
  version: string
): string {
  const pattern = /^ {2}"version": "[^"]*"/gm
  const matches = text.match(pattern) ?? []

  if (matches.length !== 1)
    throw new Error(
      'Expected one top-level "version" in ' +
      `package.json, found ${matches.length}`
    )

  return text.replace(pattern, `  "version": "${version}"`)
}

function remoteTags(): string[] {
  const output = execFileSync(
    'git',
    ['ls-remote', '--tags', '--refs', 'origin'],
    { encoding: 'utf8' }
  )

  return output
    .split('\n')
    .filter(Boolean)
    .map(row =>
      row.split('\t')[1].replace('refs/tags/', '')
    )
}

function report(output: string): void {
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, output)
  else
    process.stdout.write(output)
}

if (import.meta.main) {
  const file = new URL('../package.json', import.meta.url)
  const text = readFileSync(file, 'utf8')
  const current: string = JSON.parse(text).version
  const [command, released] = process.argv.slice(2)

  if (command === 'bump') {
    const bumped = shouldBump(current, released)
    if (bumped)
      writeFileSync(file, setVersion(text, released))

    report(`bumped=${bumped}\n`)
  } else {
    const version = nextVersion(current, remoteTags())

    report(
      `version=${version}\n` +
      `prerelease=${isPrerelease(version)}\n`
    )
  }
}
