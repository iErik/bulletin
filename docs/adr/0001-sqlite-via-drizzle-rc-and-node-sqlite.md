---
status: accepted
---

# SQLite via Drizzle 1.0 rc and node:sqlite

Tracker data lives in one SQLite file in the main process,
accessed through Drizzle ORM. We use Drizzle's 1.0 release
candidate with Node's built-in `node:sqlite` driver, pinned
to exact versions, rather than the stable Drizzle 0.45 with
`better-sqlite3`.

Both work in Electron 44. We picked the release candidates
because they avoid a native module, and because starting on
0.x would guarantee a later move to 1.0's new migration
format (`drizzle-kit up`). The app is unreleased, so this is
the cheapest time to absorb any breaking changes before
Drizzle 1.0 and `node:sqlite` go stable.

## Consequences

- Upgrade Drizzle deliberately: read the release notes, since
  the rc's API and migration format may still change.
- Drizzle tracks migrations in its `__drizzle_migrations`
  table, not in SQLite's `user_version`.
- The migrations folder ships as a plain folder next to the
  app, so packaging must copy it into the app's resources.
- If the release candidates prove unstable, the fallback is
  Drizzle 0.45 with `better-sqlite3` 13. Its Node-API
  prebuilds need no `electron-rebuild`.
