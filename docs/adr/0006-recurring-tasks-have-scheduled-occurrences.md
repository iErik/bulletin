---
status: accepted
---

# Recurring Tasks have scheduled Occurrences

A Recurring Task is stored as a rule, not as copies.
It appears as an Occurrence on every day its schedule
names, past and future, so This Week can show the
week's Gym sessions before they happen. Each
Occurrence is done or not on its own, and moving,
editing or skipping one stores only that change
against the rule. A missed Occurrence stays on its
day, undone, but is never Overdue; only one-off
Tasks are.

## Considered Options

- **One open Occurrence at a time.** Completing it
  creates the next, counted from the schedule. Simple
  to store, but future Occurrences can't be shown, and
  This Week's design shows them.
- **Missed Occurrences become Overdue.** A daily Task
  left for two weeks would pile fourteen items into
  Overdue, burying the one-off Tasks it's meant to
  surface.

## Consequences

- Reading a span of days means expanding each rule
  over it and applying its stored changes; nothing is
  generated ahead of time.
- Stopping a rule ends it from the next Occurrence;
  past Occurrences and their changes are kept.
- Completion statistics count Occurrences like
  one-off Tasks, missed ones as not done.
