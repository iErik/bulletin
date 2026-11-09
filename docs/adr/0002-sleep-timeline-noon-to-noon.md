---
status: accepted
---

# Sleep Timeline runs noon to noon, one row per day

The Figma design draws the Sleep Timeline as a snake: two rows
per day (AM left to right, then PM right to left with reversed
labels), joined by curves into one continuous line. We build a
straight row per day instead, running left to right from noon
to noon the next day. It's easier to read, there's one axis
with no reversed labels, and a normal night stays a single
segment in the middle of its row.

This is a first attempt. The concern is space: one row per day
must fit 24 hours in the Widget's width and still leave room
to click and drag precisely. If it proves too cramped, we fall
back to Figma's snake.

## Consequences

- A Period belongs to the day whose noon-to-noon window
  contains its Head (the "night of" convention), not the
  calendar day of its Head. Storage lists Periods by this rule.
- Switching back to the snake means midnight-to-midnight rows.
  The day rule would then need revisiting, along with the
  storage queries that use it.
