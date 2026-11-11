import { RuleTester } from 'eslint'
import vueParser from 'vue-eslint-parser'
import { describe, it } from 'vitest'
import iconButtonLabel from './icon-button-label.mjs'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const tester = new RuleTester({
  languageOptions: {
    parser: vueParser,
    ecmaVersion: 'latest',
    sourceType: 'module'
  }
})

// Wraps markup in a component's template
const vue = markup => `<template>${markup}</template>`

const missing = name => [{
  messageId: 'missing',
  data: { name }
}]

const icon = '<Icon name="plus" />'

tester.run('icon-button-label', iconButtonLabel, {
  valid: [
    // Labels, plain or bound
    ...[
      'aria-label="Add"',
      ':aria-label="label"',
      'v-bind:aria-label="label"',
      'aria-labelledby="add"',
      ':aria-labelledby="id"'
    ].flatMap(label => [
      `<button ${label}>${icon}</button>`,
      `<a href="#" ${label}>${icon}</a>`,
      `<RouterLink to="/" ${label}>${icon}</RouterLink>`
    ]),

    // Text or interpolation next to the icon
    `<button>${icon} Add</button>`,
    `<a href="#">Add ${icon}</a>`,
    `<RouterLink to="/">${icon}{{ label }}</RouterLink>`,

    // A titled icon names itself
    '<button><Icon name="plus" title="Add" /></button>',
    '<button><Icon name="plus" :title="t" /></button>',
    '<a href="#"><icon name="plus" title="Add" /></a>',

    // Any other element counts as a name
    `<button>${icon}<span>3</span></button>`,

    // A v-if branch with text might be what renders
    '<button><Icon v-if="on" name="check" />'
      + '<span v-else>Save</span></button>',
    '<button><Icon v-if="a" name="check" />'
      + '<template v-else-if="b">Save</template>'
      + '</button>',

    // Not an element the rule checks
    `<div>${icon}</div>`,
    '<button>Save</button>',
    '<button></button>'
  ].map(vue),

  invalid: [
    {
      code: vue(`<button>${icon}</button>`),
      errors: missing('button')
    },
    {
      code: vue(`<a href="#">${icon}</a>`),
      errors: missing('a')
    },
    {
      code: vue(`<RouterLink to="/">${icon}</RouterLink>`),
      errors: missing('RouterLink')
    },
    {
      code: vue(`<router-link to="/">${icon}</router-link>`),
      errors: missing('router-link')
    },
    // Lowercase icon, whitespace and a comment
    {
      code: vue('<button>\n  <!-- add -->\n'
        + '  <icon name="plus" />\n</button>'),
      errors: missing('button')
    },
    // Every branch is an icon
    {
      code: vue('<button><Icon v-if="on" name="check" />'
        + '<Icon v-else name="plus" /></button>'),
      errors: missing('button')
    },
    // Neither a spread nor a dynamic argument counts
    {
      code: vue(`<button v-bind="attrs">${icon}</button>`),
      errors: missing('button')
    },
    {
      code: vue(`<button :[key]="label">${icon}</button>`),
      errors: missing('button')
    },
    // A title on the button isn't a title on the icon
    {
      code: vue(`<button title="Add">${icon}</button>`),
      errors: missing('button')
    }
  ]
})
