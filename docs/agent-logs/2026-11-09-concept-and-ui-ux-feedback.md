# Concept and UI/UX feedback (2026-11-09)

Agent feedback on Bulletin's concept and on the UI/UX in its Figma
mockups. Recorded during a triage session, to come back to later.

**Sources reviewed:**

- Feature specs: BLT-1 to 5 (the widgets), BLT-9 (Dashboard page)
  and BLT-10 (Sidebar).
- Figma frames from the "Bullet Journal" file: both Dashboard
  "App Window" frames, the Sleep widget, and the Mood picker.
- Not every widget state was reviewed, so treat this as a first
  pass.

## Concept

### What works

- **One private desktop app for scattered self-tracking is a real
  need.** Seeing sleep, mood and spending side by side is where
  tracking starts to pay off, for example "bad sleep weeks line up
  with stress days and food spending".
- **The scope is personal.** The R$ values, the Cats and DAS
  categories, and the single meditation habit show it. You can
  design for exactly how you log.

### What to question

- **The name doesn't match the content.** A bullet journal is
  built on rapid logging: tasks, events, notes, and migrating
  unfinished items forward. This dashboard is a set of
  quantified-self charts. Tasks and notes, the core of a bullet
  journal, aren't on it. Either they belong on the home screen, or
  "bullet journal" is a style rather than the method. Decide
  which.
- **Logging effort will decide whether you keep using it.** There
  are five trackers to log daily, each with a different
  interaction:
  - a drag on a timeline;
  - a pill plus a picker;
  - a table row;
  - a "+" form.

  Trackers usually fail on input friction, not on chart quality. A
  single "log today" flow would do more for daily use than any one
  widget.
- **The date selector's meaning is undefined.** This is the
  biggest open design question. Each widget covers a different
  natural range:
  - Sleep: about a week of days;
  - Mood, Habits and Expenses: a month;
  - Weight: 11 months.

  Choosing "September 1st" means something different in each. The
  mockup already shows the conflict: the header says September 1st
  while the Sleep widget shows Jan 7 to 14. Picking a *day* also
  means little for the month-based widgets.

## UI/UX

### What works

- **A cohesive, distinctive look.** Near-black surfaces,
  monochrome, with glowing white for "done" or "asleep". Colour
  appears only where it carries meaning: mood colours, and green
  and red money. That restraint is the right call.
- **The Sleep timeline is the signature element**, and it's
  memorable.

### Problems, roughly by importance

1. **The Sleep timeline is hard to read.**
   - The second axis row runs backwards (PM 12:00 to 1:00), so
     reading a time means first working out which way the line is
     going.
   - Sleep that crosses midnight, the most common pattern, is
     exactly what forces the serpentine curve.
   - Suggestion: a **noon-to-noon** 24-hour row per night, the
     usual way sleep charts handle this. Each night stays one
     straight segment, with one axis, and the glow look still
     works.
   - If the serpentine stays, test it with real data before
     building: late nights, naps and split sleep.
2. **The Mood and Habits grids are hard to use.**
   - The pills have no day numbers, so finding the 14th means
     counting.
   - Mood is shown by colour alone, with no legend on the
     dashboard. That's a colour-blindness problem (green, blue and
     red), and the meanings only appear inside the picker.
   - The Habits spec says "two states: True, False or disabled",
     which is three. "False" and "not logged" need to look
     different.
   - Fix: hover tooltips with the date and label, plus a small
     legend.
3. **Low contrast.** Widget titles (SLEEP, MOOD), the "2:10 to
   11:10" captions and the axis labels look well below WCAG AA.
   Dark, glowing UIs drift into this easily.
4. **Expenses widget issues.**
   - The number formats are mixed: `R$24,000.00` in the cards
     versus `R$ 25.000,00` in the table.
   - The most useful insight, how much of the budget is spent,
     isn't shown. A progress bar under Budget would show it.
   - The Type column repeats the green and red value colour.
     Dropping it frees room, so text stops being cut off
     ("ENTERTAINM…", "Steam Ga…").
   - The mock repeats index 1 on row 6. It's a typo in the mock,
     not a design issue.
5. **The Weight chart is misleading.**
   - An area chart implies the value is measured from zero, but
     the axis starts at 40 kg, so the fill exaggerates changes. A
     plain line is more honest.
   - It's unclear what the glowing hotspot means.
6. **Navigation is inconsistent.**
   - The sidebar lists Sleep, Mood, Tasks, Expenses and Notes.
   - The dashboard shows Weight and Habits, which have no pages,
     and doesn't show Tasks or Notes, which do.
   - The sidebar icons have no labels, and the mood and expense
     icons are ambiguous. They need tooltips at least.
7. **Clicking edits data directly.** Clicking the Sleep line
   starts a selection, and clicking a pill changes it, so mistakes
   are easy. Undo, even just Cmd+Z for the last change, matters
   more here than in a typical form app.
8. **The date picker is awkward for the common case.** Three
   dropdowns (day, month, year) are clumsy for going back a week.
   Previous and next arrows plus a "Today" button would cover most
   navigation.
9. **No rules for other sizes or Schemes.**
   - The design is a fixed layout at about 1280×830, so a minimum
     window size or resizing rules are needed.
   - The theme system supports a **light** Scheme, but the glow
     look doesn't carry over to light backgrounds as is. A light
     design is still to do.

## Suggested follow-up

Settle points 1, 2, 6 and 8 and the date-range question while
triaging BLT-9 (Dashboard page), before triaging any widget. They
all affect the widget contract that BLT-1 to 5 and BLT-10 build on.
