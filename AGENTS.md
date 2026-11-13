## Agent skills

### Issue tracker

Issues are tracked in Linear (team Bulletin, prefix
`BLT`) via the Linear MCP. See
`docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info,
ready-for-agent, ready-for-human, wontfix. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at
the repo root. See `docs/agents/domain.md`.

### Design

The Figma design is the visual contract: UI matches
its frames exactly, and only a ticket or an accepted
ADR overrides Figma, where it says so. Read the
frames through the Figma plugin before planning UI
work, and check the app against them before review.
See `docs/agents/design.md`.

### Testing

Vitest, with a `renderer` and a `main` project, a
shared `window.bulletin` fake and written conventions,
including that every component lives in its own
folder with its unit tests.
See `docs/agents/testing.md`.

### Releases

Merging to `master` releases the app, and the release
workflow owns `package.json`'s `version`: change it
only to start a new version line. See
`docs/agents/releases.md`.
