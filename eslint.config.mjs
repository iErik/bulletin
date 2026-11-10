// ESLint flat config. Formatting comes from @stylistic,
// with no Prettier: it would rejoin lines wrapped by
// hand. Rules that presets set to 'warn' stay warnings,
// and `pnpm lint`'s --max-warnings 0 fails on them too.

import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import { defineConfig } from 'eslint/config'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

import importLength from './eslint-rules/import-length.mjs'

// list-style checks these lists too, but it's only wanted
// for function parameters and imported names
const unlisted = [
  'ArrayExpression',
  'ArrayPattern',
  'CallExpression',
  'ExportNamedDeclaration',
  'IfStatement',
  'ImportAttributes',
  'JSONArrayExpression',
  'JSONObjectExpression',
  'NewExpression',
  'ObjectExpression',
  'ObjectPattern',
  'TSEnumBody',
  'TSInterfaceBody',
  'TSTupleType',
  'TSTypeLiteral',
  'TSTypeParameterDeclaration',
  'TSTypeParameterInstantiation'
]

// Long URLs, strings, template literals and regexes
// can't be wrapped, so they may pass the limit
const maxLen = {
  code: 80,
  comments: 80,
  ignoreUrls: true,
  ignoreStrings: true,
  ignoreTemplateLiterals: true,
  ignoreRegExpLiterals: true
}

const app = ['src/**/*.{ts,vue}', 'scripts/**/*.{ts,mts}']

const vueFiles = ['src/**/*.vue']

const typed = config => ({ ...config, files: app })
const vueOnly = config => ({ ...config, files: vueFiles })

export default defineConfig(
  { ignores: ['out/', 'release/', 'coverage/'] },
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' }
  },

  // Formatting, for every linted file
  {
    files: ['**/*.{ts,mts,js,mjs,vue}'],
    plugins: {
      '@stylistic': stylistic,
      local: { rules: { 'import-length': importLength } }
    },
    rules: {
      ...stylistic.configs.customize({
        indent: 2,
        quotes: 'single',
        semi: false,
        commaDangle: 'only-multiline',
        braceStyle: '1tbs',
        arrowParens: false,
        jsx: false
      }).rules,
      '@stylistic/quotes': ['error', 'single', {
        allowTemplateLiterals: 'always',
        avoidEscape: true
      }],
      '@stylistic/arrow-parens': ['error', 'as-needed'],
      // Operators start wrapped lines, but `=` ends them
      '@stylistic/operator-linebreak': ['error', 'before', {
        overrides: { '=': 'after' }
      }],
      // Wrapped operands are indented by hand, often to
      // line up with what they continue
      '@stylistic/indent-binary-ops': 'off',
      '@stylistic/quote-props': ['error', 'as-needed'],
      // The same for interface and type literal members
      '@stylistic/member-delimiter-style': ['error', {
        multiline: { delimiter: 'none' },
        singleline: { delimiter: 'semi', requireLast: false }
      }],
      curly: ['error', 'multi-or-nest'],
      // Parameters and imported names either share their
      // line, or each one gets a line of its own
      '@stylistic/exp-list-style': ['error', {
        overrides: Object.fromEntries(
          unlisted.map(type => [type, 'off']))
      }],
      '@stylistic/max-len': ['error', maxLen],
      // Imports have no reason to go past the 60 target
      'local/import-length': ['error', { max: 60 }]
    }
  },

  // App source, with type information
  ...tseslint.configs.recommendedTypeChecked.map(typed),
  ...vue.configs['flat/recommended'].map(vueOnly),
  {
    files: app,
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue']
      }
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true
        }
      ],
      // `async` without `await` is how a function turns
      // its throws into rejections
      '@typescript-eslint/require-await': 'off'
    }
  },
  {
    // `expect(mock.method)` is how Vitest checks a call
    files: ['**/*.test.ts'],
    rules: { '@typescript-eslint/unbound-method': 'off' }
  },
  {
    files: vueFiles,
    rules: {
      // Components are named after the domain: Widget
      'vue/multi-word-component-names': 'off',
      // vue/max-len covers .vue files, templates included
      '@stylistic/max-len': 'off',
      'vue/block-order': ['error', {
        order: ['script', 'template', 'style']
      }],
      'vue/max-len': ['error', maxLen],
      // Once a tag's attributes wrap, each one gets its own
      // line, the first included, and the tag closes on a
      // line of its own, aligned with its opening
      // Short tags keep their attributes on one line
      'vue/max-attributes-per-line': ['error', {
        singleline: { max: Infinity },
        multiline: { max: 1 }
      }],
      'vue/first-attribute-linebreak': ['error', {
        multiline: 'below'
      }],
      'vue/html-closing-bracket-newline': ['error', {
        multiline: 'always'
      }]
    }
  },

  // Root config files: formatting only
  {
    files: ['*.{ts,mts}'],
    languageOptions: { parser: tseslint.parser }
  },

  // Local rules and the lint configs
  {
    ...js.configs.recommended,
    files: ['eslint-rules/**/*.mjs', '*.mjs'],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  }
)
