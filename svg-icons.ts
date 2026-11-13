import svgLoader from 'vite-svg-loader'

/**
 * Loads SVGs as Vue components for the renderer and its
 * tests. SVGO's default preset drops the viewBox of an
 * SVG that has a width and height, which draws its icon
 * unscaled in the top-left corner of its box, so it's
 * kept.
 */
export const svgIcons = (): ReturnType<typeof svgLoader> =>
  svgLoader({
    svgoConfig: {
      plugins: [{
        name: 'preset-default',
        params: { overrides: { removeViewBox: false } }
      }]
    }
  })
