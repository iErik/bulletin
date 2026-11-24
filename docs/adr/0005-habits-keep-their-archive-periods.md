---
status: accepted
---

# Habits keep their Archive Periods

The Habits Page counts misses: a day a Habit counted
but wasn't done lowers its Completion Rate and breaks
its Streak. An archived Habit was only a flag, so
nothing said when it was archived, and its past could
not be shown or counted fairly. We keep every Archive
Period instead: archiving starts one on that day and
restoring ends it the day before, so the days in
between are never counted as missed.

## Considered Options

- **Keep the flag.** An archived Habit's whole past
  would vanish from the Page, or count as missed
  until today.
- **One archive date, cleared on restore.** Simple,
  but once restored, the days it spent archived
  count as misses.

## Consequences

- Habits archived before this change have no record
  of when. Each gets one open Archive Period starting
  the day after its last Entry, or on the day it was
  created if it has none.
- "Is it archived?" now means "does it have an Archive
  Period with no end?".
