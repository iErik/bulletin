---
status: accepted
---

# Nights, Naps and Wake-ups are derived from Periods

The Sleep Page reports nights, naps and wake-ups, but
the only Sleep Entry is a Period, and a day can hold
several. Rather than asking the user to tag Periods,
we derive them: Periods separated by a gap of an hour
or less are one stretch of sleep, joined by Wake-ups.
A day's longest stretch is its Night, every other
stretch is a Nap, and a Night belongs to its first
Period's day, as a Period does (ADR 0003). A Night's
length counts time asleep only.

## Considered Options

- **A Night is everything a calendar day holds.**
  Simplest, but naps inflate "hours per night" and
  there are no Wake-ups to count.
- **A Nap is any Period starting between 10:00 and
  20:00.** Breaks for anyone who sleeps by day.

## Consequences

- The one-hour threshold is fixed for now. Changing
  it reclassifies past Naps and Nights, so every
  stat built on them shifts.
- A stretch that starts late on one day and another
  early the next, within an hour, is one Night of the
  first day.
