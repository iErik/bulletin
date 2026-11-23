---
status: accepted
---

# Nights, Naps and Wake-ups are derived from Periods

The Sleep Page reports nights, naps and wake-ups, but
the only Sleep Entry is a Period, and a day can hold
several. Rather than asking the user to tag Periods,
we derive them: Periods separated by a gap of an hour
or less are one stretch of sleep, joined by Wake-ups.
A stretch belongs to the day it ends on, the day its
last Period ends. A day's longest stretch is its
Night, and every other stretch is a Nap. A Night's
length counts time asleep only.

Filing a stretch under its wake day keeps one Night
per day however the bedtime drifts: bed at 23:30 on
Monday and bed at 00:30 on Tuesday both wake on
Tuesday, so both are Tuesday's Night. This is how
common sleep trackers file sleep too.

On the Timeline, a Period still belongs to its Head's
calendar day (ADR 0003). Only Nights and Naps are
filed by wake day.

## Considered Options

- **A Night is everything a calendar day holds.**
  Simplest, but naps inflate "hours per night" and
  there are no Wake-ups to count.
- **A Nap is any Period starting between 10:00 and
  20:00.** Breaks for anyone who sleeps by day.
- **A stretch belongs to the day it starts on.**
  Matches the Timeline, but a bedtime that moves
  across midnight puts two Nights on one day and
  none on the next, where a Nap is promoted to Night.
- **A stretch belongs to the noon-to-noon window
  holding its start.** Also keeps one Night per day,
  but brings back the noon boundary ADR 0003 dropped,
  and pairing a Night with the next day's Mood would
  still need its own rule.

## Consequences

- The one-hour threshold is fixed for now. Changing
  it reclassifies past Naps and Nights, so every
  stat built on them shifts.
- A day's Night is the sleep that ended that morning,
  so the Schedule's row for a day shows the night
  before it, and Sleep & Mood pairs a Night with its
  own day's Mood.
- A late-evening nap that ends after midnight is
  filed under the next day.
