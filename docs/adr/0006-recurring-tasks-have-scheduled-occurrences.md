---
status: accepted
---

# Recurring Tasks have scheduled Occurrences

A Recurring Task is stored as a rule, not as copies.
It appears as an Occurrence on every day its schedule
names, past and future, so a week's Gym sessions can
be shown before they happen. Each Occurrence is done
or not on its own, and moving, editing or skipping
one stores only that change, against the rule and
the scheduled day. A missed Occurrence stays on its
day, undone, but is never Overdue; only Tasks that
don't recur are.

## Considered Options

- **One open Occurrence at a time.** Completing it
  creates the next, counted from the schedule. Simple
  to store, but future Occurrences can't be shown, and
  the Tasks Page's design shows them.
- **Missed Occurrences become Overdue.** A daily Task
  left for two weeks would pile fourteen items into
  Overdue, burying the Tasks it's meant to surface.

## Consequences

- Reading a span of days means expanding each rule
  over it and applying its stored changes; nothing is
  generated ahead of time.
- Stopping a rule ends it after today: Occurrences up
  to and including today, and their changes, are
  kept, and none come after.
- Completion statistics count Occurrences like other
  Tasks, missed ones as not done.
