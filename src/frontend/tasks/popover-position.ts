/**
 * Pure placement for a teleported popover beside an
 * anchor element: prefers the right side, flips left
 * when there isn't room, and clamps inside the view.
 */

export interface AnchorRect {
  readonly left: number
  readonly right: number
  readonly top: number
}

export interface BoxSize {
  readonly width: number
  readonly height: number
}

export interface Point {
  readonly left: number
  readonly top: number
}

const clamp = (n: number, min: number, max: number): number =>
  Math.min(Math.max(n, min), max)

/**
 * Computes fixed viewport coordinates for `panel`
 * beside `anchor`, keeping `margin` px from each edge.
 */
export const placeBeside = (
  anchor: AnchorRect | null,
  panel: BoxSize,
  viewport: BoxSize,
  gap = 8,
  margin = 8
): Point => {
  const maxX = Math.max(margin, viewport.width - margin - panel.width)
  const maxY = Math.max(margin, viewport.height - margin - panel.height)
  if (!anchor) {
    return {
      left: clamp((viewport.width - panel.width) / 2, margin, maxX),
      top: clamp((viewport.height - panel.height) / 2, margin, maxY)
    }
  }
  const right = anchor.right + gap
  const left = anchor.left - gap - panel.width
  const x = right + panel.width <= viewport.width - margin
    ? right
    : left >= margin
      ? left
      : clamp(right, margin, maxX)
  return {
    left: clamp(x, margin, maxX),
    top: clamp(anchor.top, margin, maxY)
  }
}
