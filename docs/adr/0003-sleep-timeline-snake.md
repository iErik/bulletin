---
status: accepted
---

# Sleep Timeline is Figma's snake, with calendar days

ADR 0002's noon-to-noon rows filed a Period under the day
whose noon-to-noon window held its Head. That made a daytime
sleep awkward: 6:00 to 15:00 on November 7 started on the row
labelled November 6, so it had to be clicked across two rows,
and typing "6:00" on November 7's row meant 6:00 on the 8th,
which was refused as a future date. So we follow Figma's snake
after all, with calendar days.

- **The snake:** one continuous line, two rows per day. The AM
  row holds 1:00 to noon, left to right. The right curve holds
  noon to 13:00. The PM row holds 13:00 to midnight, right to
  left. The left curve holds 0:00 to 1:00, into the next day's
  AM row. Each row is 11 hours and each curve one, so an hour
  is a row's length divided by 11 at whatever width the Widget
  has.
- **Days run midnight to midnight,** local time.
- **A Period belongs to its Head's calendar day.** Storage lists
  Periods by the calendar day of their Head, and the Timeline
  draws each one from its Head along the snake to its Tail,
  round the curves and into the next day's rows if it runs on.
- **A Period is still at most 24 hours.**

## Consequences

- A Period can start, end or run along a curve, so the
  Timeline's geometry maps time along the curves' arcs too.
- Until the Timeline is rebuilt as the snake, its noon-to-noon
  rows group Periods differently from storage. A Period whose
  Head is between midnight and noon on the 1st of the earliest
  loaded month can land on a row that isn't loaded.
