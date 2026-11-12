# Design

The Figma design is the visual contract. Build every
screen, Widget and state to match its frame exactly:
not "close enough", and not "in the spirit of" it.
The ticket says what the UI does; Figma says what it
looks like.

## The Figma file

- [Bullet Journal](https://www.figma.com/design/FKW1cUwBij734ZhSw6mFxn/Bullet-Journal)
  (file key `FKW1cUwBij734ZhSw6mFxn`).
- Each UI ticket links the frames it covers, in its
  description or its brief. A ticket's sub-issues
  use their parent's frames.

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

## What a ticket can override

A ticket or its brief overrides Figma only where it
says so explicitly, as BLT-2's comment replacing the
TYPE column with DATE did. Everything it doesn't
override follows Figma.

## States without a frame

Figma doesn't draw every state: inputs while
editing, popovers, errors, empty and loading states.

- If the ticket describes the state, build it from
  the nearest frame's values (fonts, colours, radii,
  spacing, effects) and list it in the PR under
  "Departures from Figma".
- If neither the ticket nor Figma covers it, don't
  invent it. Ask, as for any ambiguity in
  [Picking up a ticket](issue-tracker.md#picking-up-a-ticket).

## Before planning

Read every frame the ticket links, through the Figma
plugin (MCP):

1. Load the `figma-design-to-code` skill. The plugin
   requires it before `get_design_context`.
2. Call `create_session` with the file key, and pass
   its session ID to every later call.
3. Call `get_design_context` for each linked node,
   with its screenshot. If a response is sparse, read
   its visible child nodes too.
4. Call `get_variable_defs` for the frames, and map
   each variable to a theme token. Add a token when
   none matches, rather than hard-coding the value.

The plan comment lists the frames read and the
values that matter: fonts, colours, sizes and icons.

## While building

- Take values from `get_design_context`, not from
  the screenshot or memory.
- Its code is a React and Tailwind reference.
  Translate it to Vue, the SCSS in
  `src/frontend/styles/` and the theme tokens. Don't
  copy its absolute positioning: rebuild the layout
  with flex or grid so it still matches the frame.
- Reuse the theme tokens and existing components
  that match the design.

## Design check before review

Before moving a ticket to In Review:

1. Run the app (`pnpm dev`) and compare each screen
   and state you changed with its frame, side by
   side.
2. Fix every difference the ticket doesn't explain.
   A difference from Figma is a bug, like a failing
   test.
3. Add a **Design check** section to the PR
   description:
   - each frame checked, by name and link, and the
     result;
   - screenshots of the app next to the frame, when
     you can attach them;
   - "Departures from Figma": each one, why, and the
     ticket line that allows it.

If you can't run the app or compare it, say so in
the Design check section. The maintainer then checks
it before merging. Don't leave it to a "for the
maintainer to verify" list without saying the check
wasn't done.

## Reviewing

Review UI changes against the frames, not only the
ticket text. A PR whose UI doesn't match its frames,
with no departure the ticket allows, isn't ready.
