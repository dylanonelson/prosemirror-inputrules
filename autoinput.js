import {BlockQuote, OrderedList, BulletList, CodeBlock, Heading} from "../model"
import {defineOption} from "../edit"
import {InputRule, addInputRule, removeInputRule} from "./inputrules"

// :: Object<InputRule>
// Base set of input rules, enabled by default when `autoInput` is set
// to `true`.
export const autoInputRules = Object.create(null)

// :: union<bool, [union<string, Object<?InputRule>>]> #path=autoInput #kind=option
// Controls the [input rules](#InputRule) initially active in the
// editor. Pass an array of sources, which can be either the string
// `"schema"`, to add rules [registered](#SchemaItem.register) on the
// schema items (under the namespace `"autoInput"`), or an object
// containing input rules. To remove previously included rules, you
// can add an object that maps their name to `null`.
//
// The value `false` (the default) is a shorthand for no input rules,
// and the value `true` for `["schema", autoInputRules]`.
defineOption("autoInput", false, function(pm, val) {
  if (pm.mod.autoInput) {
    pm.mod.autoInput.forEach(rule => removeInputRule(pm, rule))
    pm.mod.autoInput = null
  }
  if (val) {
    if (val === true) val = ["schema", autoInputRules]
    let rules = Object.create(null), list = pm.mod.autoInput = []
    val.forEach(spec => {
      if (spec === "schema") {
        pm.schema.registry("autoInput", (name, rule, type, typeName) => {
          let rname = typeName + ":" + name, handler = rule.handler
          if (handler.bind) handler = handler.bind(type)
          rules[rname] = new InputRule(rule.match, rule.filter, handler)
        })
      } else {
        for (let name in spec) {
          let val = spec[name]
          if (val == null) delete rules[name]
          else rules[name] = val
        }
      }
    })
    for (let name in rules) {
      addInputRule(pm, rules[name])
      list.push(rules[name])
    }
  }
})

autoInputRules.emDash = new InputRule(/--$/, "-", "—")

autoInputRules.openDoubleQuote = new InputRule(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(")$/, '"', "“")

autoInputRules.closeDoubleQuote = new InputRule(/"$/, '"', "”")

autoInputRules.openSingleQuote = new InputRule(/(?:^|[\s\{\[\(\<'"\u2018\u201C])(')$/, "'", "‘")

autoInputRules.closeSingleQuote = new InputRule(/'$/, "'", "’")

BlockQuote.register("autoInput", "startBlockQuote", new InputRule(
  /^\s*> $/, " ",
  function(pm, _, pos) { wrapAndJoin(pm, pos, this) }
))

OrderedList.register("autoInput", "startOrderedList", new InputRule(
  /^(\d+)\. $/, " ",
  function(pm, match, pos) {
    let order = +match[1]
    wrapAndJoin(pm, pos, this, {order: order || null},
                node => node.childCount + +node.attrs.order == order)
  }
))

BulletList.register("autoInput", "startBulletList", new InputRule(
  /^\s*([-+*]) $/, " ",
  function(pm, match, pos) {
    let bullet = match[1]
    wrapAndJoin(pm, pos, this, null, node => node.attrs.bullet == bullet)
  }
))

CodeBlock.register("autoInput", "startCodeBlock", new InputRule(
  /^```$/, "`",
  function(pm, _, pos) { setAs(pm, pos, this, {params: ""}) }
))

Heading.registerComputed("autoInput", "startHeading", type => {
  let re = new RegExp("^(#{1," + type.maxLevel + "}) $")
  return new InputRule(re, " ", function(pm, match, pos) {
    setAs(pm, pos, this, {level: match[1].length})
  })
})

function wrapAndJoin(pm, pos, type, attrs = null, predicate = null) {
  let rPos = pm.doc.resolve(pos), d1 = rPos.depth - 1
  let sibling = rPos.index(d1) > 0 && rPos.node(d1).child(rPos.index(d1) - 1)
  let join = sibling && sibling.type == type && (!predicate || predicate(sibling))
  let start = pos - rPos.parentOffset
  let tr = pm.tr.delete(start, pos).wrap(start, start, type, attrs)
  if (join) tr.join(rPos.before(rPos.depth))
  tr.apply()
}

function setAs(pm, pos, type, attrs) {
  let rPos = pm.doc.resolve(pos), start = pos - rPos.parentOffset
  pm.tr.delete(start, pos)
       .setBlockType(start, start, type, attrs)
       .apply()
}
