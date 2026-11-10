import { RuleTester } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, it } from 'vitest'
import importLength from './import-length.mjs'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  }
})

const max = [{ max: 30 }]

tester.run('import-length', importLength, {
  valid: [
    // 60 characters: the default limit
    'import { first, second, third }'
      + " from './a-long-module-names'",
    { code: "import { a, b } from './x'", options: max },
    // Already wrapped
    {
      code: "import {\n  alpha,\n  beta\n} from './module-x'",
      options: max
    },
    // No named imports: wrapping can't shorten them
    {
      code: "import something from './a-long-module-x'",
      options: max
    },
    {
      code: "import * as everything from './module-x'",
      options: max
    },
    {
      code: "import './a-module-imported-for-effects'",
      options: max
    }
  ],
  invalid: [
    {
      code: "import { alpha, beta } from './module-x'",
      options: max,
      output: "import {\n  alpha,\n  beta\n} from './module-x'",
      errors: [{ messageId: 'tooLong', data: { length: 40 } }]
    },
    // 61 characters, past the default limit
    {
      code: 'import { first, second, third }'
        + " from './a-longer-module-name'",
      output: 'import {\n  first,\n  second,\n  third\n}'
        + " from './a-longer-module-name'",
      errors: [{ messageId: 'tooLong', data: { length: 61 } }]
    },
    // A default import stays on the first line
    {
      code: "import main, { alpha, beta } from './x'",
      options: max,
      output: "import main, {\n  alpha,\n  beta\n} from './x'",
      errors: [{ messageId: 'tooLong' }]
    },
    // Type imports and aliases keep their text
    {
      code: "import { type A, b as c } from './mod'",
      options: max,
      output: "import {\n  type A,\n  b as c\n} from './mod'",
      errors: [{ messageId: 'tooLong' }],
      languageOptions: { parser: tseslint.parser }
    }
  ]
})
