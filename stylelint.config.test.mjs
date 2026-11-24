import { fileURLToPath } from 'node:url'
import stylelint from 'stylelint'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('.', import.meta.url))
const configFile = fileURLToPath(
  new URL('./stylelint.config.mjs', import.meta.url)
)
const RULE = 'declaration-property-value-disallowed-list'

const lint = (code, name) => stylelint.lint({
  code,
  codeFilename: fileURLToPath(new URL(name, import.meta.url)),
  configFile,
  cwd: root
})

const violations = result =>
  result.results.flatMap(file => file.warnings)
    .filter(warning => warning.rule === RULE)

describe('the native-scrollbar guard', () => {
  it.each([
    'overflow',
    'overflow-x',
    'overflow-y'
  ])('rejects %s: auto or scroll in scss and vue',
    async property => {
      for (const value of ['auto', 'scroll']) {
        for (const name of ['probe.scss', 'probe.vue']) {
          const body = `.box { ${property}: ${value}; }`
          const code = name.endsWith('.vue')
            ? `<style>\n${body}\n</style>\n`
            : `${body}\n`
          const found = violations(await lint(code, name))

          expect(found).toHaveLength(1)
          expect(found[0].text).toContain(
            'scroller mixin'
          )
          expect(found[0].text).toContain('OverlayScrollbar')
          expect(found[0].text).toContain(
            `${property}: ${value}`
          )
        }
      }
    })

  it('allows overflow: hidden', async () => {
    for (const name of ['probe.scss', 'probe.vue']) {
      const body = '.box { overflow: hidden; }'
      const code = name.endsWith('.vue')
        ? `<style>\n${body}\n</style>\n`
        : `${body}\n`
      expect(violations(await lint(code, name))).toEqual([])
    }
  })

  it('allows the scroller mixin', async () => {
    const result = await stylelint.lint({
      files: 'src/frontend/styles/utils/_mixins.scss',
      configFile,
      cwd: root
    })

    expect(result.errored).toBe(false)
    expect(violations(result)).toEqual([])
  })
})
