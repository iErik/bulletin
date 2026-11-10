# Releases

`.github/workflows/release.yml` packages Bulletin for
macOS, Linux and Windows and publishes a GitHub
Release. Nobody runs a release by hand: merging to
`master` does it.

## When a release runs

- **On a push to `master`**, merges included, that
  changes what ships in the app: `src/**`,
  `resources/**`, `package.json`, `pnpm-lock.yaml`,
  `electron.vite.config.ts` or `electron-builder.yml`.
  A push touching only docs, `.claude/` or the
  workflows releases nothing.
- **By hand**, from the Actions tab (Release, then Run
  workflow), or with
  `gh workflow run release.yml -f dry_run=true`. A dry
  run packages and checks the files, and stops there:
  no tag, no release. A run that isn't a dry run only
  publishes from `master`.

Releases run one at a time. A newer run waits for the
current one, and replaces any run already waiting.

## What a release does

The jobs, in order: checks, version (picked by
`scripts/next-version.mts`), package (one per OS, with
the version injected into the packaged app), files
(exactly the seven expected), release (the tag, then
the GitHub Release; a failed release deletes its tag)
and bump. `release.yml`'s comments explain each one.

## Versions

`package.json`'s `version` is the last version
released. The next release takes the next number on
its line, after the highest `v*` tag on that line:

| `version`      | Line         | Next releases           |
|----------------|--------------|-------------------------|
| `0.1.0`        | `0.1`        | `0.1.1`, `0.1.2`, …     |
| `1.0.0-beta.3` | `1.0.0-beta` | `1.0.0-beta.4`, `.5`, … |

Only `X.Y.Z` and `X.Y.Z-<word>.N` are accepted. An
untagged `version` is released as is, like `0.1.0`,
the first release. The bump job owns `version`.

### Starting a new line

Set `version` to the line's first version, for example
`0.2.0`, `1.0.0-beta.1` or `1.0.0`, in a PR. Merging it
releases that version as is, then `0.2.1` and so on.
The bump job never moves `version` off a line changed
by hand.

## The release App

The bump job pushes to `master` as a GitHub App,
because `master`'s ruleset requires the checks and
blocks other direct pushes. The repository needs:

- the **variable** `RELEASE_APP_CLIENT_ID`: the App's
  client ID;
- the **secret** `RELEASE_APP_PRIVATE_KEY`: a private
  key of the App.

The App needs read and write access to contents, an
installation on the repo, and a place in the `master`
ruleset's bypass list, which a future "require a pull
request" rule also needs. Without the variable or the
secret, the bump job fails saying so, and the release
still stands.

## Signing, later

The builds aren't signed: the release notes tell
people how to get past the macOS and Windows warnings.
Signing would take these secrets, which
electron-builder reads from the environment:

- **macOS signing**: `CSC_LINK` (the Developer ID
  Application certificate, a base64 `.p12`) and
  `CSC_KEY_PASSWORD`.
- **macOS notarization**: `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID`,
  or an App Store Connect API key (`APPLE_API_KEY`,
  `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`).
- **Windows signing**: `WIN_CSC_LINK` and
  `WIN_CSC_KEY_PASSWORD`, or a cloud signing service
  such as Azure Trusted Signing.

`electron-builder.yml` would then drop the ad-hoc
`identity: '-'`, and turn the hardened runtime on for
notarization.
