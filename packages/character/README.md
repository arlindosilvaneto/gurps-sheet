# @gurps-sheet/character

Load, validate, verify and update GURPS 4th Edition characters saved by the GURPS sheet editor, in the engine-neutral **`gurps-character`** JSON format (v1.3). Built for combat engines, VTT bridges and any other tool that needs to use exported sheets.

- **Written in TypeScript, shipped as ES modules** (`dist/`, with declarations and source maps). Runs in Node ≥ 20.19 and in browsers via any bundler.
- **One dependency** (Ajv, for schema validation). The rule evaluator in `@gurps-sheet/character/formula` has none.
- **Typed end to end.** Document types are generated from the schema; the API types come from the source.

## Quick start (a combat engine)

```js
import { parseCharacter, combatStats, applyDamage, spendFatigue, serializeCharacter, CharacterError } from '@gurps-sheet/character';

let hero;
try {
  const { character, report } = parseCharacter(jsonText); // format, version, schema + independent rule check
  if (!report.rulesCompliant) console.warn('sheet deviates from the rules', report.deviations, report.issues);
  hero = character;
} catch (err) {
  if (err instanceof CharacterError) console.error(err.code, err.message, err.details); // e.g. 'schema', { errors }
  throw err;
}

const stats = combatStats(hero); // hp/fp pools, dodge, parry, block, damage, move by encumbrance, DR, skills, weapons
hero = applyDamage(hero, 7); // returns a NEW document; the original is never modified
hero = spendFatigue(hero, 2);
saveSomewhere(serializeCharacter(hero)); // refuses to write an invalid document
```

## API

| Function | Purpose |
|---|---|
| `parseCharacter(input, { maxBytes? })` | JSON text or object → `{ character, report }`. Checks size, JSON, format, version and schema, and attaches `verifyCharacter()`'s report. Throws `CharacterError`. |
| `validateCharacter(doc)` | Schema validation only → `{ valid, errors: [{ pointer, keyword, params, message }] }` |
| `verifyCharacter(doc)` | Independent rule check (never trusts the file's own `integrity`) → `{ rulesCompliant, experimental, declaredCompliant, claimConsistent, deviations, inconsistencies, issues }` |
| `combatStats(doc)` | Read-only copy of what combat needs |
| `getUpdatableFields()` | What an engine may change (from the schema): `[{ pointer, type, title, description, labels, bounds }]` |
| `updateCharacter(doc, changes, { now? })` | Applies in-play changes to a copy. All-or-nothing, strict: throws on anything else. Sets `meta.updatedAt`. |
| `getPool(doc, 'hp'\|'fp')` | `{ current, max }`. An absent `current` means full. |
| `applyDamage` / `heal` / `spendFatigue` / `recoverFatigue` `(doc, amount, { now? })` | Relative pool changes, **clamped** to the bounds. Each returns a new document. |
| `serializeCharacter(doc, { space? })` | JSON text of a valid document |
| `checkEnvelope(doc)` | Format/version check only |
| `schema`, `vocabulary`, `FORMAT`, `LATEST_VERSION`, `SUPPORTED_MINOR`, `MAX_DOCUMENT_BYTES` | Constants |
| `recompute`, `deviations`, `evaluate`, `parseFormula`, `parseDice`, `roundUp`, `resolveSchemaRef` | The rule evaluator (also at `@gurps-sheet/character/formula`, without Ajv) |

Subpath exports: `@gurps-sheet/character/formula`, `@gurps-sheet/character/constants`, `@gurps-sheet/character/schema` (the JSON Schema file), `@gurps-sheet/character/vocabulary`.

### Errors

Every failure is a `CharacterError` with a stable `code`, an English `message` and `details` for building your own (localized) message:

| Code | When | `details` |
|---|---|---|
| `tooLarge` | input text over `maxBytes` | `{ size, limit }` |
| `invalidJson` | JSON syntax error | `{ line, column }` or `{ truncated }` |
| `notAnObject`, `wrongFormat`, `legacyFormat` | not a `gurps-character` object | `{ format }` |
| `unsupportedVersion`, `newerVersion` | major ≠ 1, or minor newer than the library | `{ formatVersion, supported }` |
| `schema` | schema violations | `{ errors: ValidationError[] }` |
| `notUpdatable` | update of a field that isn't in-play state | `{ pointer, updatable }` |
| `invalidValue`, `outOfBounds` | wrong type / outside the bounds | `{ pointer, value, min?, max? }` |
| `invalidAmount` | helper amount not a non-negative integer | `{ amount }` |

### What engines may update

The **schema** decides, not the library code. Every value annotated `x-gurps.role: "state"` is updatable, within its `x-gurps.bounds`. Bounds are formulas evaluated against the value's parent object.

| Pointer | Bounds | Basic Set |
|---|---|---|
| `/secondary/hp/current` | `-10 × HP` … `HP` | B419: death at −5×HP, total bodily destruction at −10×HP |
| `/secondary/fp/current` | `-1 × FP` … `FP` | B426: unconscious at −1×FP; further fatigue comes off HP |

Everything else (attributes, costs, skills, totals, the maximum HP/FP themselves) is character creation, owned by the sheet editor. `updateCharacter()` rejects it with `notUpdatable`. In-play state never affects rule compliance.

The bounds keep values inside what the rules allow. Rule consequences, such as death checks below 0 HP or HP loss when FP drops below 0, are the engine's job.

### TypeScript

```ts
import { parseCharacter, type GurpsCharacter, type VerificationReport } from '@gurps-sheet/character';
```

Document types (`GurpsCharacter` and its parts) are generated from the schema into `src/character.generated.ts` (`npm run types`); `npm test` fails when that file is stale. Everything else is typed in the source itself.

### Developing the package

| Command | What it does |
|---|---|
| `npm run build` | Cleans and compiles `src/*.ts` to `dist/` (`tsconfig.build.json`). Also runs on `npm install` (`prepare`). |
| `npm run typecheck` | Strict type check of sources and tests (`tsconfig.json`). |
| `npm run test:unit` | `node:test` on `test/*.test.ts`, run from source through `tsx`. |
| `npm run test:dist` | Builds, then checks the package as an outside consumer sees it: `test/consumer/usage.ts` type-checks against `dist/*.d.ts`, and `test/consumer/smoke.mjs` runs `dist/` on plain Node. |
| `npm test` | All of the above, plus the generated-types freshness check. |

The `exports` map has a custom `@gurps-sheet/source` condition pointing at `src/*.ts`. Tools in this repository enable it (the tests with `node --conditions`, the type check with `customConditions`, the sheet editor's Vite config), so they always run the current source and never a stale build. Consumers that don't set it get `dist/`.

---

# The `gurps-character` format (v1.3)

| File | Purpose |
|---|---|
| `schema/gurps-character.schema.json` | The schema (JSON Schema draft 2020-12), with rule tables in `x-gurps-tables` |
| `schema/x-gurps-vocabulary.schema.json` | Meta-schema for the `x-gurps` / `x-gurps-tables` annotation keywords |
| `src/formula.ts` | Dependency-free reference evaluator for the formulas (`@gurps-sheet/character/formula`) |
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
| `role` | `input` (player-entered) · `derived` (always equals `formula`: totals, bases) · `overridable` (`formula` is the default; a different stored value is a deliberate override, e.g. bought-up HP or a hand-edited Dodge) · `state` (changes in play: current HP/FP; the only values engines may update) |
| `override` | For `overridable` values: `paid` (a sibling `points` formula prices the difference — bought-up HP, Will, Per, FP, Basic Speed/Move) or `unpaid` (nothing pays for it — a hand-edited Dodge, NH, damage, encumbrance row or cost is a rule deviation) |
| `bounds` | For `state` values: `{min, max}` formulas evaluated against the value's parent object |
| `formula` | Expression that computes the value (below) |
| `unit` | `points`, `kg`, `m`, `m/s`, `currency` |
| `default`, `costPerLevel` | Default value; points per level above/below base |
| `reference` | Basic Set page (`B16`) |
| `sheetField` | Original PDF/web-app field id(s); `{n}` = row number |
| `label` | Localized labels, e.g. `{"pt-BR": "Vontade"}` |

An engine can trust the stored values, or recompute any `derived`/`overridable` value with `recompute()`.

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

```js
import { recompute, evaluate } from '@gurps-sheet/character/formula';
const results = recompute(schema, character); // [{ pointer, role, override, formula, stored, computed }]
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

The Size discount is not listed in `costModifiers`: it is derived from `profile.sizeModifier`, so it can never be counted twice. A modified cost is formula-backed. It is not a deviation, and the verification treats it like any other value.

## Skill bonuses (since 1.3)

`skills[].bonuses: [{name, amount}]` records named NH bonuses, typically a Talent (B89: +1 per level to a group of skills). The level formula is `attr(attribute) + relativeLevel + sum(bonuses.amount)`. The bonus doesn't change the skill's point cost; the trait that grants it is paid in `traits[]`. A bonus-explained NH is formula-backed and not a deviation.

## Rule integrity (since 1.1)

`integrity` is the editor's self-report:

- `experimental` — the player switched rule validations off on purpose (experimentation, quick game setup). Treat such characters as sandbox material.
- `deviations[]` — every unpaid override: `{pointer, expected, actual, sheetField?, label?, justification?}`. A `justification` (since 1.3) is the player's reason, e.g. "aprovado pelo mestre". It documents intent only: the character is still not `rulesCompliant`, and accepting it is up to the GM or engine.
- `issues[]` — rule violations that are not single-value drift (`overBudget`).
- `rulesCompliant` — `true` when both lists are empty.

The block is written by a client, so it is a convenience, not a guarantee. `verifyCharacter()` (or the lower-level `deviations(schema, doc)`) recomputes every value from the rule formulas and ignores `integrity`:

- **Unpaid overrides:** reported as deviations (`reason: "override"`).
- **Hand-edited derived values:** a total that doesn't match its formula is an inconsistency (`reason: "inconsistent"`).
- **Paid overrides:** legitimate, never reported.

`claimConsistent` tells you whether the file's own claim matches the recomputation. For a document written by the sheet editor, the unpaid overrides found are exactly `integrity.deviations`.

## Validation in other languages

Any JSON Schema 2020-12 validator works with `schema/gurps-character.schema.json`. In strict validators, either register the `x-gurps` / `x-gurps-tables` keywords with the meta-schemas in `x-gurps-vocabulary.schema.json` (as this library does with Ajv), or run in non-strict mode so the annotations are ignored.

## Versioning

`formatVersion` is semver. History:
- **1.0:** initial format.
- **1.1:** optional `integrity` block and `x-gurps.override`.
- **1.2:** optional `costModifiers` (with the Size discount in the cost formulas) and `coalesce()`.
- **1.3:** skill `bonuses` and deviation `justification`.

Minor versions only add optional properties; breaking changes bump the major version and the `$id` (`urn:gurps-sheet:schema:gurps-character:<version>`). Annotation-only changes, such as `x-gurps.bounds`, don't change the format version.

Objects are closed (`additionalProperties: false`), so a document written for a newer minor version can contain properties an older schema rejects. Rules for readers and writers:
- **Readers:** accept documents up to the minor version of the schema they ship (this library: up to 1.3), and reject newer minors with a clear "update the reader" message (`newerVersion`) rather than misreport them as invalid.
- **Writers:** emit the lowest version whose features they use. The sheet editor writes 1.1 by default, 1.2 when a character uses cost modifiers or has Size Modifier ≥ 1, and 1.3 when it uses NH bonuses or justifications.
- **Old Size documents:** a document older than 1.2 with Size Modifier ≥ 1 has ST/HP costs computed without the discount. Apply the current rule when reading it.
