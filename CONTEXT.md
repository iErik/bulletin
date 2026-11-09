# Bulletin

A desktop bullet-journal app for tracking daily life (sleep, mood,
habits, weight, expenses, tasks and notes) from one dashboard.

## Language

### Appearance

**Theme**:
A named visual identity for the app, such as "Default". Every
Theme has exactly one Palette per Scheme.
_Avoid_: Skin, style

**Scheme**:
The light or dark variant of a Theme: `dark` or `light`. The
user's preference may also be `system`, which follows the OS.
_Avoid_: Mode, appearance, color mode

**Palette**:
The concrete set of color values for one Theme in one Scheme.
_Avoid_: Color scheme, colors

### Dashboard

**Tracker**:
A kind of thing the user logs: Sleep, Mood, Habits, Weight or
Expenses. Each Tracker holds its own Entries.
_Avoid_: Module, category

**Entry**:
One logged record in a Tracker, such as one night's sleep, one
day's mood or one expense. An Entry is never dated in the
future.
_Avoid_: Record, log, item

**Dashboard**:
The home page. It shows one Widget per Tracker, focused on the
Selected Date.
_Avoid_: Home, overview

**Widget**:
A Tracker's panel on the Dashboard. Each Widget decides how the
Selected Date maps to the range of Entries it shows.
_Avoid_: Card, tile, panel

**Selected Date**:
The day the Dashboard is focused on. It opens on today, is
never in the future, and is not remembered between launches.
Only the date header changes it; Widgets read it but never set
it.
_Avoid_: Current date, active date
