# GURPS Sheet

A web character sheet for **GURPS 4th Edition**, plus two npm packages that let other software use the characters it produces.

- **The editor** reproduces the Brazilian-Portuguese sheet *Planilha Personagem Editavel v2.12* in the browser. It keeps the original layout, computes every point cost and derived value by the Basic Set rules, and exports a filled PDF ready for the game table.
- **[`@gurps-sheet/character`](packages/character)** is the engine-facing library. It loads, validates, verifies and updates characters in the open **`gurps-character`** JSON format.
- **[`@gurps-sheet/npcs`](packages/npcs)** is a library of 32 ready-made NPCs in six adventure styles, built only from Basic Set material. They serve as examples and as test fixtures for engines.

## Goals

- **Play-ready sheets without Adobe Reader.** The original sheet is an XFA form that only works in Adobe Reader. The editor runs in any browser and prints the same layout.
- **Follow the rules.** Costs and derived values follow the GURPS 4e *Basic Set* (*Módulo Básico*). Where the original PDF's scripts disagreed with the book, the book wins.
- **Keep sheets honest, but allow experiments.** Values that break the rules are flagged rather than forbidden, and a sheet can be marked experimental. Saved files record any deviation, so a game engine can tell a by-the-book character from a house-ruled one.
- **Open, engine-friendly data.** Characters are saved as JSON described by a JSON Schema (draft 2020-12), with English keys. Every value carries metadata such as its formula, Basic Set page and label, so other tools can recompute and trust it instead of just parsing it.
- **Reusable building blocks.** Combat engines, VTT bridges and other tools can use the same libraries the editor uses.

## The editor

| Feature | |
|---|---|
| Original layout | Every field sits where the PDF has it, on a vector render of the original pages |
| Rules engine | Attribute, skill and advantage costs, secondary characteristics, damage, encumbrance, Dodge, Parry and Block |
| Rule integrity | Manual values the rules don't pay for are flagged and listed in an integrity panel, and can be given a justification. An "experimental" mode skips the confirmations |
| Cost modifiers and NH bonuses | Enhancements, limitations and Size discounts on attribute costs; trait bonuses on skill levels |
| Save and load | `.json` files in the `gurps-character` format; a browser draft is kept automatically |
| PDF export | Fills the original sheet, for printing or sharing |
| Instant help | An optional toolbar toggle shows a help tooltip on every printed title |

The interface is in Brazilian Portuguese, like the original sheet.

## Installation

You need **Node.js 20.19 or newer** and npm.

```bash
git clone git@github.com:arlindosilvaneto/gurps-sheet.git
cd gurps-sheet
npm install       # installs the app and both packages (npm workspaces)
npm run dev       # the editor at http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Starts the editor with live reload |
| `npm run build` | Builds the editor as a static site in `dist/`, deployable to any static host |
| `npm run preview` | Serves the built site locally |
| `npm test` | Runs the app tests, then each package's tests, type check and consumer checks |

## Using the packages

Both packages are published on npm under the `@gurps-sheet` organization.

```bash
npm install @gurps-sheet/character   # load, validate, verify and update characters
npm install @gurps-sheet/npcs        # ready-made NPCs (installs @gurps-sheet/character too)
```

They are ES modules with TypeScript types, and run in Node 20.19+ and in browsers through any bundler.

### `@gurps-sheet/character`: work with saved characters

```js
import { readFileSync } from 'node:fs';
import { parseCharacter, applyDamage, combatStats, serializeCharacter } from '@gurps-sheet/character';

// Load a file saved by the editor: format, version and schema are checked, and the rules are recomputed.
const { character, report } = parseCharacter(readFileSync('rurik.json', 'utf8'));
report.rulesCompliant; // true when every cost and derived value matches the rules

// Everything a combat engine usually needs, in one object.
const stats = combatStats(character); // HP, FP, Dodge, Parry, Block, damage, skills, weapons, DR...

// In-play updates return a new document; only fields the schema marks as "state" (current HP and FP) can change.
const hurt = applyDamage(character, 7);
const json = serializeCharacter(hurt); // refuses to write an invalid document
```

Failures throw a `CharacterError` with a stable `code` you can translate. A dependency-free subpath, `@gurps-sheet/character/formula`, gives you the rule formulas without the schema validator. The [package README](packages/character/README.md) documents the full API and the `gurps-character` format.

### `@gurps-sheet/npcs`: ready-made characters

```js
import { getNpc, listNpcs, npcsByStyle } from '@gurps-sheet/npcs';
import { combatStats } from '@gurps-sheet/character';

const knight = getNpc('fantasy-mercenary-knight');           // a new copy on every call
const gunfighters = listNpcs({ tag: 'firearms', threat: 'boss' }); // summaries for picking test fixtures
const western = npcsByStyle('western');                       // whole documents

combatStats(knight).dodge; // 9
```

| Style | TL | NPCs |
|---|---|---|
| `fantasy` | 3 | town watchman, mercenary knight, court wizard, forest ranger, guild cutpurse, temple priest |
| `swashbuckling` | 4 | musketeer, pirate captain, bosun, the Cardinal's spy, highwayman |
| `western` | 5 | gunslinger, town marshal, outlaw, riverboat gambler, frontier scout |
| `modern` | 8 | street thug, patrol officer, special forces soldier, intelligence officer, hacker, mob enforcer |
| `horror` | 6 | occult investigator, cult acolyte, monster hunter, asylum director, spirit medium |
| `science-fiction` | 10–11 | starfighter pilot, space marine, ship's doctor, smuggler, chief engineer |

Every NPC is valid, rules-compliant, spends exactly its point budget, and loads into the editor unchanged. Tools in other languages can read the same documents as plain JSON from [`packages/npcs/data/`](packages/npcs/data), or from `node_modules/@gurps-sheet/npcs/data/` after installing. The [package README](packages/npcs/README.md) explains the tags, conventions and the Basic Set catalog the NPCs are built from.

## Repository layout

```
index.html, src/        the editor (Vite + vanilla JS): layout, rules engine, PDF export, save/load
public/                 the sheet's template PDF, page backgrounds and images
packages/character/     @gurps-sheet/character: schema, formula evaluator, loading, verification, updates
packages/npcs/          @gurps-sheet/npcs: Basic Set catalog, NPC definitions, generated JSON in data/
test/                   editor tests (node:test)
scripts/release.mjs     release tooling used by CI
.github/workflows/      CI: tests and the build on every PR; package releases on main
```

[`CLAUDE.md`](CLAUDE.md) describes the architecture and conventions in detail.

## Contributing and releases

`main` only accepts pull requests. CI runs the tests and the editor build on every PR.

To release a package, bump its version in your PR, for example:

```bash
npm version patch -w @gurps-sheet/character --no-git-tag-version
```

When the PR is merged, CI publishes every package whose new version isn't on npm yet, with provenance, and creates a GitHub release such as `character-v0.1.2`. A PR that changes a package without bumping its version fails the release check.

## License and trademarks

No license has been chosen for this project yet, so all rights are reserved by the author.

GURPS is a trademark of Steve Jackson Games, and its rules and art are copyrighted by Steve Jackson Games. All rights are reserved by Steve Jackson Games. This is an unofficial fan project, not published, approved or endorsed by Steve Jackson Games. The original *Planilha Personagem Editavel* sheet belongs to its authors. The NPC library uses Basic Set game statistics only, with page references, and none of the book's text.
