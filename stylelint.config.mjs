// Stylelint, for SCSS files and the SCSS in .vue files.
// Formatting comes from @stylistic/stylelint-plugin.

/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard-scss'],
  plugins: ['@stylistic/stylelint-plugin'],
  overrides: [
    { files: ['**/*.vue'], customSyntax: 'postcss-html' }
  ],
  ignoreFiles: ['out/**', 'release/**', 'coverage/**'],
  reportNeedlessDisables: true,
  rules: {
    '@stylistic/indentation': 2,
    '@stylistic/string-quotes': 'single',
    '@stylistic/max-line-length': 80,
    // @include sits among a block's declarations
    'at-rule-empty-line-before': ['always', {
      except: ['blockless-after-same-name-blockless'],
      ignore: ['after-comment', 'inside-block']
    }],
    // Blank lines group related variables
    'scss/dollar-variable-empty-line-before': null,
    // A long value may start on the next line
    'scss/dollar-variable-colon-space-after': null,
    // Capitalized words are font names: Roboto, Arial
    'value-keyword-case': ['lower', {
      camelCaseSvgKeywords: true,
      ignoreKeywords: [/^[A-Z][a-z]+$/]
    }],
    // Chromium still reads the prefixed name
    'property-no-vendor-prefix': [true, {
      ignoreProperties: ['-webkit-text-size-adjust']
    }],
    // RSCSS: kebab-case components and elements, and
    // variants with a leading dash, such as `.-active`
    'selector-class-pattern': [
      '^-?[a-z][a-z0-9]*(-[a-z0-9]+)*$',
      { message: 'Expected an RSCSS class name' }
    ]
  }
}
