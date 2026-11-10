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

### Testing

Vitest, with a `renderer` and a `main` project, a
shared `window.bulletin` fake and written conventions.
See `docs/agents/testing.md`.

### Releases

Merging to `master` releases the app, and the release
workflow owns `package.json`'s `version`: change it
only to start a new version line. See
`docs/agents/releases.md`.
