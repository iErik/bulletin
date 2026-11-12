# Design

The Figma design is the visual contract. Build every
Page, Widget and state to match its frame exactly:
not "close enough", and not "in the spirit of" it.
The ticket says what the UI does; Figma says what it
looks like.

## The Figma file

- [Bullet Journal](https://www.figma.com/design/FKW1cUwBij734ZhSw6mFxn/Bullet-Journal)
  (file key `FKW1cUwBij734ZhSw6mFxn`).
- Each UI ticket links the frames it covers, in its
  description or its brief. A sub-issue without
  frames of its own uses its parent's.

## What has to match

Everything Figma specifies, including:

- font family, weight, size, line height, letter
  spacing and text case;
- colours and opacity, of text, fills, borders and
  icons;
- spacing, sizes, alignment and layout;
- corner radii, borders, shadows, glows and blurs;
- icons and other assets, from the same set Figma
  uses;
- copy: labels, placeholders and their wording.

Don't substitute: no other font, icon set or colour
because it's already installed, easier, or looks
similar. If a design value can't be used, ask.

## What can override Figma

Two things can, and only where they say so
explicitly:

- **A ticket or its brief,** as BLT-2's comment
  replacing the TYPE column with DATE did.
- **An accepted ADR** in `docs/adr/`. For example, an
  ADR that lays out a Widget differently from its
  frame wins over the frame until it's superseded.

Everything they don't override follows Figma. If a
ticket's Figma work contradicts an accepted ADR,
don't override the ADR silently: flag it, as
`docs/agents/domain.md` asks.

## States without a frame

Figma doesn't draw every state: inputs while
editing, popovers, errors, empty and loading states.

- If the ticket describes the state, build it from
  the nearest frame's values (fonts, colours, radii,
  spacing, effects) and list it in the PR under
  "Departures from Figma".
- If neither the ticket nor Figma covers it, don't
  invent it. Ask, as for any ambiguity in
  [Picking up a ticket][picking-up].

[picking-up]: issue-tracker.md#picking-up-a-ticket

## Before planning

Read every frame the ticket links, through the Figma
plugin (MCP):

1. Load the `figma-design-to-code` skill. The plugin
   requires it before `get_design_context`.
2. If the Figma server offers `create_session`, call
   it first, with the file key and a short
   description of the task: when it's offered, the
   server's instructions ask for it before any file
   tool, reads included. Pass its session ID only to
   later calls that accept one. Without it, go
   straight to step 3.
3. Call `get_design_context` for each linked node,
   with the file key, the node ID and its
   screenshot. If no screenshot comes back, call
   `get_screenshot` for it.
4. Don't build from a sparse response. Match its
   child node IDs to the screenshot, then request
   the visible children's design context in one
   parallel batch, and build from those.
5. Call `get_variable_defs` for the frames, and reuse
   a theme token wherever one matches a variable.

The plan comment lists the frames read and the
values that matter: fonts, colours, sizes and icons.

## While building

- Take values from `get_design_context`, not from
  the screenshot or memory.
- Its code is a React and Tailwind reference.
  Translate it to Vue, the SCSS in
  `src/frontend/styles/` and the theme tokens.
  Rebuild its absolute positioning with flex or grid
  so it still matches the frame, unless the design
  can only be expressed with fixed positioning.
- Reuse the theme tokens and existing components
  that match the design.

## Design check before review

Before moving a ticket to In Review:

1. Run the app (`pnpm dev`) and compare each Page,
   Widget and state you changed with its frame, side
   by side.
2. Fix every difference the ticket or an ADR doesn't
   explain. A difference from Figma is a bug, like a
   failing test.
3. Add a **Design check** section to the PR
   description:
   - each frame checked, by name and link, and the
     result;
   - screenshots of the app next to the frame, when
     you can attach them;
   - "Departures from Figma": each one, why, and the
     ticket line or ADR that allows it.

If you can't run the app or compare it, say so in
the Design check section. The maintainer then checks
it before merging. Don't leave it to a "for the
maintainer to verify" list without saying the check
wasn't done.

## Reviewing

Review UI changes against the frames, not only the
ticket text. A PR whose UI doesn't match its frames,
with no departure a ticket or an accepted ADR
allows, isn't ready.
