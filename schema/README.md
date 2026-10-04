# gurps-character schema (v1.3.0)

An engine-neutral document format for GURPS 4th Edition characters. It is designed to be read by combat engines, VTT bridges or any other tool without knowing anything about the PDF sheet or this web app.

| File | Purpose |
|---|---|
| `gurps-character.schema.json` | The schema (JSON Schema draft 2020-12), with rule tables in `x-gurps-tables` |
| `x-gurps-vocabulary.schema.json` | Meta-schema for the `x-gurps` / `x-gurps-tables` annotation keywords |
| `formula.js` | Dependency-free reference evaluator for the formulas (ES module) |
| `examples/rurik.json` | A complete, valid character (1.1: no optional features) |
| `examples/jotun.json` | A 1.3 character: Size discount, a cost limitation, an NH bonus, a justified deviation |

## Why JSON Schema

- **Validators everywhere:** JS (Ajv), Python (`jsonschema`), Go, Rust, C#, Java, and editor support (VS Code validates and autocompletes through `"$schema"`).
- **Room for metadata:** the standard allows custom annotation keywords. Each parameter carries `x-gurps` metadata next to its type, which is what makes the document usable by engines rather than just parseable.
- **YAML for free:** YAML 1.2 is a superset of JSON, so the same schema validates hand-written YAML characters.
- **Alternatives rejected:** XML/XSD (verbose, weak JS/engine tooling); Protobuf/Avro (binary-first, not self-describing for people editing a character).

Schema keys are English (camelCase; GURPS abbreviations lowercased: `st`, `dx`, `iq`, `ht`, `hp`, `fp`, `will`, `per`). Free text such as names and notes stays in the player's language, declared in `meta.locale`. Localized labels live in `x-gurps.label`.

## Document shape

```text
format, formatVersion, ruleset{system, edition, units, currency}, meta{locale, createdAt, updatedAt, generator}
profile{name, player, height, weight, age, sizeModifier, appearance}
points{budget, spent, unspent, breakdown{attributes, advantages, disadvantages, skills, other}}
attributes{st, dx, iq, ht}            -> {value, points, costModifiers?[]}
secondary{hp, will, per, fp, basicSpeed, basicMove} -> {value, base, points, costModifiers?[][, current]}
encumbrance{basicLift, levels[5]{level, id, maxLoad, move, dodge}}
damage{thrust, swing}                 -> dice {notation, dice, adds}
defenses{dodge{value}, parry{skill, value}, block{skill, value}}
damageResistance[], reactionModifiers[], techLevel{level, points}, languages[], culturalFamiliarities[]
traits[]{name, type: advantage|perk|disadvantage|quirk, points, level?, notes?}
skills[]{name, attribute, difficulty: E|A|H|VH, relativeLevel, level, points, bonuses?[{name, amount}]}
weapons{melee[]{damage[≤2]…}, ranged[]}, equipment[], possessionsTotal{cost, weight}, notes[]
integrity{experimental, rulesCompliant, deviations[], issues[]}   // since 1.1, optional
extensions{"<reverse.dns.namespace>": {...}}   // engine-specific data, never collides
```

Every object uses `additionalProperties: false`. Unknown data belongs in `extensions`.

## Parameter metadata (`x-gurps`)

| Key | Meaning |
|---|---|
| `role` | `input` (player-entered) · `derived` (always equals `formula`: totals, bases) · `overridable` (`formula` is the default; a different stored value is a deliberate override, e.g. bought-up HP, a Size Modifier discount on ST cost, a talent-discounted skill) · `state` (changes in play: current HP/FP) |
| `override` | For `overridable` values: `paid` (a sibling `points` formula prices the difference — bought-up HP, Will, Per, FP, Basic Speed/Move) or `unpaid` (nothing pays for it — a hand-edited Dodge, NH, damage, encumbrance row or cost is a rule deviation) |
| `formula` | Expression that computes the value (below) |
| `unit` | `points`, `kg`, `m`, `m/s`, `currency` |
| `default`, `costPerLevel` | Default value; points per level above/below base |
| `reference` | Basic Set page (`B16`) |
| `sheetField` | Original PDF/web-app field id(s); `{n}` = row number |
| `label` | Localized labels, e.g. `{"pt-BR": "Vontade"}` |

An engine can trust the stored values, or recompute any `derived`/`overridable` value after changing inputs. For example, a combat engine can adjust `attributes.st.value` and recompute `damage.swing`, encumbrance and point totals.

## Formula language

```text
expr    := add (( '==' | '!=' | '<' | '<=' | '>' | '>=' ) add)?
add     := mul (( '+' | '-' ) mul)*
mul     := unary (( '*' | '/' ) unary)*
unary   := '-' unary | primary
primary := number | 'string' | call | path | '(' expr ')'
call    := name '(' [expr (',' expr)*] ')'
path    := ('$' | name) ( '.' name | '[' name ('=' | '!=') value ('|' value)* ']' )*
```

- **Path roots:** `$` is the document root (`$.attributes.st.value`). A bare first name refers to a sibling property of the object that owns the formula (`(value - base) * 2` inside `secondary.hp`).
- **Arrays:** stepping into an array projects over its items, and `[field=a|b]` filters them: `sum($.traits[type=advantage|perk].points)`.
- **Nulls:** a missing value is `null`. Arithmetic with `null` gives `null`, and `sum` ignores nulls.
- **Functions:**
  - math: `floor`, `ceil` (ignores float noise below 1e-9, so 40 × 0.8 gives 32), `round(x, digits=0)` (half up), `abs`, `min`, `max`;
  - control and aggregation: `if(cond, a, b)`, `sum(array)`, `coalesce(a, b, …)` (first non-null);
  - rules: `lookup(table, key)`, `attr(id)` (current value of `st|dx|iq|ht|will|per`), `skillLevel(name)` (level of the skill with that name, case-insensitive).
- **Tables (`x-gurps-tables`):**
  - `map` tables use an exact key.
  - `step` tables return the value of the largest key ≤ the lookup key, or `null` below the first key.
  - `extrapolate {from, every, add}` extends a table linearly beyond `from`. Example: skill cost is 1, 2, 4, 8, then +4 per level; damage gains +1d per 10 ST above 100.
  - `valueType: "dice"` makes a lookup return `{notation, dice, adds}`.

Usage of the reference evaluator:

```js
import { recompute, evaluate } from './schema/formula.js';
const results = recompute(schema, character); // [{ pointer, role, formula, stored, computed }]
```

## Cost modifiers (since 1.2)

A characteristic purchase (ST, DX, IQ, HT, HP, Will, Per, FP, Basic Speed, Basic Move) can carry enhancements and limitations: `costModifiers: [{name, percent}]`. The `points` formula applies the Basic Set rules:

```text
raw  = (value - base) * costPerLevel
cost = raw > 0 ? ceil(raw * max(0.2, 1 + (Σ percent + size) / 100)) : raw
size = -10 × profile.sizeModifier for ST and HP when sizeModifier >= 1, else 0
```

- Modifiers never reduce a cost by more than 80%.
- Costs round up.
- Selling a characteristic below its base is not modified.

The Size discount is not listed in `costModifiers`: it is derived from `profile.sizeModifier`, so it can never be counted twice. A modified cost is formula-backed. It is not a deviation, and `deviations()` verifies it like any other value.

## Skill bonuses (since 1.3)

`skills[].bonuses: [{name, amount}]` records named NH bonuses, typically a Talent (B89: +1 per level to a group of skills). The level formula is `attr(attribute) + relativeLevel + sum(bonuses.amount)`. The bonus doesn't change the skill's point cost; the trait that grants it is paid in `traits[]`. A bonus-explained NH is formula-backed and not a deviation.

## Rule integrity (since 1.1)

`integrity` is the editor's self-report:

- `experimental` — the player switched rule validations off on purpose (experimentation, quick game setup). Treat such characters as sandbox material.
- `deviations[]` — every unpaid override: `{pointer, expected, actual, sheetField?, label?, justification?}`. A `justification` (since 1.3) is the player's reason, e.g. "aprovado pelo mestre". It documents intent only: the character is still not `rulesCompliant`, and accepting it is up to the GM or engine.
- `issues[]` — rule violations that are not single-value drift (`overBudget`).
- `rulesCompliant` — `true` when both lists are empty.

The block is written by a client, so it is a convenience, not a guarantee. To verify a character yourself, use `deviations(schema, doc)` from `formula.js`. It recomputes every value from the rule formulas and ignores `integrity`. It reports unpaid overrides as `reason: "override"`, and derived values that don't match their formula (a hand-edited total) as `reason: "inconsistent"`. Paid overrides are legitimate and are not reported. For a document written by this app, the unpaid overrides it finds are exactly `integrity.deviations`.

## Validating

```js
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const ajv = new Ajv2020({ strict: true, allowUnionTypes: true });
addFormats(ajv);
ajv.addKeyword({ keyword: 'x-gurps', metaSchema: vocabulary.$defs.annotation });
ajv.addKeyword({ keyword: 'x-gurps-tables', metaSchema: vocabulary.$defs.tables });
const valid = ajv.compile(schema)(character);
```

Validators that don't know the `x-gurps*` keywords may simply ignore them (non-strict mode).

## Versioning

`formatVersion` is semver. History: 1.0 initial; 1.1 added the optional `integrity` block and `x-gurps.override`; 1.2 added optional `costModifiers` (with the Size discount in the cost formulas) and `coalesce()`; 1.3 added skill `bonuses` and deviation `justification`. Minor versions only add optional properties; breaking changes bump the major version and the `$id` (`urn:gurps-sheet:schema:gurps-character:<version>`).

Objects are closed (`additionalProperties: false`), so a document written for a newer minor version can contain properties an older schema rejects. **A reader accepts documents up to the minor version of the schema it ships** (this app: up to 1.3) and must reject newer minors with a clear "update the reader" message rather than misreport them as invalid. Writers should emit the lowest version whose features they use. This app does: 1.1 by default, 1.2 when a character uses cost modifiers or has Size Modifier ≥ 1 (1.2 put the Size discount into the ST/HP cost formulas), and 1.3 when it uses NH bonuses or justifications. When reading an older document with Size Modifier ≥ 1, apply the current rule: its ST/HP costs were computed without the discount.

## Mapping from the web app's v1 save file

The app's original save (`{"format": "gurps-sheet", "version": 1, "values": {...}}`) is a flat map of PDF field ids holding strings. It maps like this:

| v1 (flat, strings) | gurps-character |
|---|---|
| `"ST": "14"` | `attributes.st = {value: 14, points: 40}` |
| `"Vantagem1": "coco voador", "Custo_Vantagem_1": ""` | `traits[] += {name: "coco voador", type: "advantage", points: 0}` |
| `"Desvantagem1": "coco mole", "Custo_desvantagem_1": "-5"` | `traits[] += {name: "coco mole", type: "disadvantage", points: -5}` |
| `"Pericia1"`, `"NH_Relativo_1A": "DX"`, `"NH_Relativo_1B": "+1"`, `"Tipo_1": "M"` | `skills[] += {name, attribute: "dx", relativeLevel: 1, difficulty: "A", level, points}` |
| `"Pontos_Gastar": "100"` | `points.budget = 100` |

Each original field id is recorded in `x-gurps.sheetField`.
