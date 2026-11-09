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

**Locale**:
The language and region that decide how dates, numbers and
money are written, and which day starts the week. It follows
the operating system; a user setting will be able to override
it. The app's own text stays English regardless.
_Avoid_: Language, region, culture

### Dashboard

**Tracker**:
A kind of thing the user logs: Sleep, Mood, Habits, Weight or
Expenses. Each Tracker holds its own Entries.
_Avoid_: Module, category

**Entry**:
One logged record in a Tracker, such as one sleep Period, one
day's mood or one expense. An Entry is never dated in the
future.
_Avoid_: Record, log, item

**Page**:
A top-level screen of the app, one per Sidebar button:
Dashboard, Sleep, Mood, Tasks, Expenses and Notes.
_Avoid_: Screen, view, tab

**Title Bar**:
The full-width strip at the top of the window, part of the
app's own layout rather than a native bar. It holds the window
controls and the date header, and the window is dragged by its
empty areas.
_Avoid_: Header bar, top bar, toolbar

**Sidebar**:
The vertical strip of Page buttons on the left of the app. It
highlights the current Page.
_Avoid_: Nav bar, menu

**Dashboard**:
The home Page. It shows one Widget per Tracker, focused on the
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

### Trackers

**Period**:
A Sleep Entry: one stretch of sleep, from its Head (start) to
its Tail (end). A day can have several Periods (naps, broken
sleep), a Period can cross midnight, and Periods never overlap.
A Period belongs to the day its Head falls on.
_Avoid_: Night, session

**Mood**:
One of a fixed set of feelings a day can be marked with. A
Mood Entry assigns one Mood to one day, or the day has none.
The set can't be edited yet.

**Month Grid**:
A calendar-shaped view of one month's days, with weeks as rows
starting on the Locale's first day of the week. The Mood and
Habits Widgets use it.
_Avoid_: Calendar, heatmap

**Day Pill**:
One day's cell in a Month Grid.
_Avoid_: Cell, tile, dot

**Habit**:
Something the user wants to do regularly, tracked day by day
in the Habits Tracker. It has a name, unique among all Habits
including archived ones, and an icon. Deleting a Habit archives it: it leaves
the list, but its Entries are kept. Creating a Habit with an
archived Habit's name restores that Habit.
_Avoid_: Goal, routine

**Category**:
A user-defined label grouping Transactions, such as
"Food" or "Cats". The user creates new ones by typing a name
that doesn't exist yet.
_Avoid_: Tag

**Transaction**:
An Expenses Entry: a dated, described, categorised amount of
money. Its sign says what it is: positive is Income, negative
is an Expense, and zero is neither.
_Avoid_: Payment, movement, type

**Income**:
A Transaction with a positive amount.

**Expense**:
A Transaction with a negative amount.

**Budget**:
How much the user plans to spend in a month, compared against
that month's Expenses. Not an Entry. A month without its own
Budget uses the most recent earlier month's.
