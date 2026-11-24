---
status: accepted
---

# Widgets reload on Data Source signals

Several Widgets on a Page can show data backed by the
same stored slice (for example, Sleep Timeline, Sleep
Summary and Sleep Goal). Rather than Widgets notifying
each other or sharing a store per Tracker, preload
signals a named **Data Source** after any bridge write
resolves with `{ ok: true }`. Widgets subscribe via
`useDataVersion` and reload when their source ticks.

Signaling from the bridge write, not the Widget, means
a writer can never forget to notify siblings and failed
writes (`{ ok: false }`) stay silent. Listeners live in
preload within the single window: Bulletin has one
window, so bouncing signals through main would add IPC
plumbing for no gain, while `onDataChange` stays ready
to forward main-pushed signals if multi-window arrives.
`DATA_SOURCE_WRITES` is exhaustively typed against
`BulletinApi`, so adding a namespace or method fails to
compile until classified as a read (`null`) or write.

## Considered Options

- **Widgets emit events or share a Pinia store.**
  Couples sibling Widgets or mirrors SQLite in memory.
- **Main broadcasts changes over IPC.** Extra plumbing
  and round-trip for a single-window app.
- **Untyped event strings per write.** New bridge
  methods could silently miss signaling.

## Consequences

- Widgets stay independent and reload from storage.
- Every new `BulletinApi` namespace or method must be
  classified in `src/shared/data-sources.ts`.
- Preload catches listener errors so one failing Widget
  never blocks others.

## How to use it

```ts
const version = useDataVersion('sleep', 'sleepGoal')
watch([() => selectedDate.value, version], load, {
  immediate: true
})
```

In renderer tests, `fakeBulletin` / `stubBulletin`
signals `onDataChange` on successful writes (including
overrides), so calling the write and `flushPromises()`
exercises cross-Widget reloads directly.
