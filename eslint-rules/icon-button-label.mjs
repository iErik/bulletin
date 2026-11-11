// Reports a <button>, <a> or <RouterLink> in a Vue
// template whose only content is <Icon> elements and that
// has no aria-label or aria-labelledby: icons are
// aria-hidden, so screen readers would announce it as
// just "button". An <Icon> with a title names itself.
// Ported from Tidder's JSX rule.

// What a piece of content gives the element: nothing
// (whitespace), only icons, or a name of some kind
// (text, {{ }}, a titled icon, any other element)
const NOTHING = 0
const ICON = 1
const NAME = 2

const LABELS = ['aria-label', 'aria-labelledby']

const TARGETS = ['button', 'a', 'RouterLink', 'router-link']

const ICONS = ['Icon', 'icon']

// The attribute's name, written plainly or bound with
// `:` or `v-bind:`. Other directives, a dynamic argument
// and a `v-bind="…"` spread give none: the rule can't
// see what they hold
function attributeName(attr) {
  if (!attr.directive) return attr.key.name
  const { name, argument } = attr.key
  if (name.name !== 'bind') return null
  return argument?.type === 'VIdentifier'
    ? argument.rawName
    : null
}

function hasAttribute(node, names) {
  return node.startTag.attributes.some(attr =>
    names.includes(attributeName(attr)))
}

// The strongest of the parts: a name anywhere wins
const combine = parts => Math.max(NOTHING, ...parts)

// Elements with v-if, v-else-if or v-else count like any
// other: each branch might be the one that renders
function content(node) {
  switch (node.type) {
    case 'VText':
      return node.value.trim() ? NAME : NOTHING
    case 'VElement':
      if (!ICONS.includes(node.rawName)) return NAME
      return hasAttribute(node, ['title']) ? NAME : ICON
    default:
      return NAME
  }
}

export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      missing: 'This <{{name}}> only shows an icon. Give it'
        + ' an aria-label that describes its action.'
    }
  },

  create(context) {
    const services = context.sourceCode.parserServices
    // Not a Vue file: there's no template to check
    if (!services?.defineTemplateBodyVisitor) return {}

    return services.defineTemplateBodyVisitor({
      VElement(node) {
        const name = node.rawName
        if (!TARGETS.includes(name)) return
        if (hasAttribute(node, LABELS)) return

        const children = combine(node.children.map(content))
        if (children !== ICON) return

        context.report({
          node: node.startTag,
          messageId: 'missing',
          data: { name }
        })
      }
    })
  }
}
