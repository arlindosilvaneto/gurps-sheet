# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A POC web version of the Brazilian-Portuguese GURPS 4e character sheet `Planilha Personagem Editavel v2.12 GURPS 4ed.pdf` (an Adobe LiveCycle/XFA form that only works in Adobe Reader). The web app keeps the PDF's exact layout, reproduces its point-cost/derived-stat scripts, and exports a filled PDF for game sessions. UI text is pt-BR. It is a static site with no backend; state lives in `localStorage` (key `gurps-sheet:v1`), and users can save/load `.json` files.

## Commands

```bash
npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # static build -> dist/
npm test             # node:test (built-in runner; Vitest 5 needs Node 22, this targets Node 20.19+)
node --test test/rules.test.js                         # one file
node --test --test-name-pattern="skill cost" test/     # one test by name
GURPS_PDF_OUT=/tmp/out.pdf node --test test/pdf.test.js  # also write a sample export to inspect
```

Regenerate the derived assets (only needed if the source PDF or extraction logic changes):

```bash
python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
.venv/bin/python scripts/extract_assets.py
```

## Architecture

The source PDF is the single source of truth for layout. `scripts/extract_assets.py` reads it once and produces committed artifacts, so the app never parses the original PDF at runtime:

- `src/labels.json`: printed label text with rects, per line and per word (targets for the help tooltips).
- `src/layout.json`: every visible form field (`id`, `page`, `x/y/w/h` in PDF points with a **top-left origin relative to the crop box**, `kind`, `align`, `size`, `print`, `tip`). Field metadata (numeric vs. text, alignment, font size, tooltip, `relevant="-print"`) comes from the XFA `<template>` packet; geometry comes from the AcroForm widgets.
- `public/template.pdf`: the original pages with widgets, annotations, XFA/AcroForm, and usage-rights signature removed (43 MB → ~75 KB).
- `public/bg/page-{1,2}.svg`: vector renders of the blank pages, used as the on-screen background.
- `public/img/`: images embedded in the PDF (GURPS logos, SJG pyramid; the pyramid is a 1-bit stencil mask converted to black-on-transparent).

At runtime the same `layout.json` drives both outputs, which keeps screen and PDF aligned:

- `src/main.js` absolutely positions one `<input>` per field over the SVG background. All geometry is in PDF points, scaled by the CSS variable `--pt` (px per pt; set by `fitToWidth()`).
- `src/pdf.js` (`buildPdf(templateBytes, layout, textFor)`) uses pdf-lib to draw each printable field's text onto `template.pdf` with Helvetica, shrinking text to fit. Coordinates go through `page.getCropBox()` because the template's crop box is offset inside its media box. WinAnsi-unencodable characters become `?`. `main.js` loads it with a dynamic `import()` because pdf-lib makes up most of the bundle.
- Help tooltips ("Ajuda imediata" toolbar toggle, saved in `localStorage` key `gurps-sheet:help`, default off). `src/help.js` holds one pt-BR message per printed title. `resolveHelp()` matches each entry to a rect in `src/labels.json`, which the extractor writes from the blank PDF's text lines and words. Use words (`w: true`) where one PDF line merges several column headers. `main.js` places a `.label-help` hotspot over each title and shows a custom tooltip instantly instead of using the native `title`. Field tooltips (XFA tips) also need the toggle, but validation errors (skill cost below minimum, over budget) always show. `test/help.test.js` fails if an entry doesn't resolve or a printed title has no help. `NOT_TITLES` lists table data and the copyright notice, which are excluded on purpose.
- `src/rules.js` is pure and DOM-free. It contains all the game math, and both the UI and the tests use it.

### Rules / state model

- `values` is a flat `{ fieldId: string }` map holding only what the user typed.
- Every attribute has a free default: ST/DX/IQ/HT default to 10 (`ATTR_DEFAULT`), and PV/Vont/Per/PF/Basic Speed/Basic Move default from them. A blank sheet is therefore a valid 0-point character. The cost field stays blank at the default and only fills in once the value differs.
- `compute(values)` returns `{ out, errors }` for every id in `COMPUTED`. `display(id, values, out)` decides what a field shows.
- Computed fields can be overridden, mirroring XFA `calculate override="warning"`. If a computed field has a non-empty user value, that value wins, and downstream rules use it through `eff()` (e.g. bought-up Per affects Per-based skills, and an overridden NH affects Parry). Clearing the field, or typing the computed value back in, restores the formula. `READ_ONLY` ids (totals, page-2 name mirror) can never be overridden.
- Field ids are the XFA names. Duplicate names keep their index (`AlcanceArma1CC[2]`). Page 2's copy of `Nome` is `Nome_p2`.
- Skill rows use hidden-in-print helper columns: `NH_Relativo_nA` (attribute ST/DX/IQ/HT/Vont/Per), `NH_Relativo_nB` (relative level), `Tipo_n` (difficulty F/M/D/MD, also E/A/H/VH; `print:false`). Parry/Block find their skill by matching the name typed in `Aparar2`/`Bloqueio2` against `Pericia1..25`.
- `Total_Pontos` is points **spent**: attributes + advantages/languages/TL/cultures + disadvantages + skills + "Outros" (`Resumo_Pontos5` on page 2). `Pontos_Gastar` is the campaign **budget** (plain input, not added to the total). When spent > budget, `Total_Pontos` gets an error highlight and a tooltip showing the overrun. This changes the original PDF, which added `Pontos_Gastar` into the total; the owner chose this meaning.

### Interchange schema (`schema/`)

`schema/gurps-character.schema.json` (JSON Schema 2020-12) is the engine-neutral character format, specified in `schema/README.md`. Its keys are English. Each parameter carries an `x-gurps` annotation (role, formula, unit, cost, Basic Set page, original `sheetField`, pt-BR label), and rule tables live in `x-gurps-tables`. `schema/formula.js` is the reference evaluator for those formulas.

The schema and `src/rules.js` encode the same rules twice. `test/schema.test.js` keeps them in sync: tables are checked against `damage()`/`skillCost()`, and the example character is recomputed through both. When a rule changes, update both.

**Save/load** (`src/character.js`, pure; `src/validate.js` wraps Ajv and is loaded on demand). The goal is that sheet → file → sheet returns exactly the same values, and nothing is ever silently dropped. `test/character.test.js` round-trips a deliberately messy sheet to enforce this.
- **Files:** `gurps-character` 1.0 to 1.3 are read (`SUPPORTED_MINOR`). The schema is closed (`additionalProperties: false`), so a newer minor version gets an "update the reader" message rather than a misleading schema error.
  - Files are written at the lowest version they need (`lowestVersion()`): 1.1 base (integrity), 1.2 with cost modifiers or SM ≥ 1, 1.3 with NH bonuses or justifications.
  - Pre-1.2 files with SM ≥ 1 have their ST/HP costs recalculated with the Size discount, with a warning, instead of becoming deviations.
  - The old flat `gurps-sheet` format is rejected and never converted.
- **Saving:** `toCharacter()` returns `{ doc, problems, labels }`.
  - Every numeric field goes through `numField()`. Text in a number field, a non-integer where the schema wants an integer, or an out-of-range value becomes a problem named by sheet row ("Desvantagens, linha 1 (Teimosia) › custo: …"), never a silent 0. Rows with problems are left out.
  - `main.js` runs Ajv only once there are no problems, passing `labels` (JSON pointer → sheet row) so schema errors also name sheet rows. Any problem blocks the download.
- **Loading:** `parseCharacterFile()` checks, in order: file size, JSON syntax (translated to pt-BR with line and column), `format`, version, schema. It then calls `fromCharacter()`, which returns `{ values, warnings, createdAt, context }`.
  - Lists longer than the sheet's rows raise a `SheetFileError`; nothing is ever truncated.
  - Anything that won't survive a re-save unchanged becomes a `warning`: trait level/notes, a 1-point advantage saved as a perk, reaction sources on the generic lines, structured weapon fields that don't match their notation, extensions.
  - `context` (locale, currency) is kept in the draft and passed back to `toCharacter()`, so re-saving doesn't overwrite them.
  - Overrides of every kind (secondaries, costs, encumbrance rows, damage, NH, defenses) are restored only where the document differs from what `rules.js` computes, group by group in dependency order. Numbers are written without rounding.
  - `main.js` shows every failure in the `#problems` dialog and leaves the current sheet untouched.
- **Free-text conventions:**
  - DR "4 (2 contra contusão)" ↔ `{ dr: 4, notes: "(2 contra contusão)" }`.
  - A reaction modifier needs an explicit sign ("+1 Herói", "+0 Comum"); "10 anos de serviço" stays text.
  - Weapon damage keeps its notation, and a type that is only in the structured fields is appended to the text.
- **Page-2 tables:** these field ids are irregular (`Preço14` is ranged row 1, two armour rows are named `ArmaCD8[1]`/`ArmaCD9[1]`). `sheetTables()` therefore groups rows by position (anchor column + an asymmetric y window), not by name.
- **Extractor clean-up:** the extractor drops the PDF's stacked duplicate ranged-ST widgets (`STArmaCD{n}[1]`) and the meaningless `totalPosição` box.
- **Perks and quirks:** the sheet only has advantage and disadvantage lists, so on export a 1-point advantage becomes `perk` and a −1-point disadvantage becomes `quirk`.
- **Row counts:** `ROWS` in `rules.js` is the single source for how many rows each list has; both the rules and the mapping use it.
- **Browser autosave:** `localStorage` key `gurps-sheet:v1` holds the internal draft `{ values, createdAt, context }`, deliberately not the schema, so half-typed values never fail validation.
- **Dev server:** `vite.config.js` pre-bundles pdf-lib and Ajv. Without that, Vite discovers them on first use and reloads the page in the middle of an export or file open.

### Rule integrity (anti-cheat)

`src/integrity.js` (pure) splits the overridable calculated fields into two groups:
- **`PAID_OVERRIDES`:** ST/DX/IQ/HT, PV, Vont, Per, PF, Basic Speed and Basic Move. A cost formula prices the change, so they are freely editable.
- **`STRICT_FIELDS`:** every other non-read-only calculated field (costs, NH, Dodge/Parry/Block, damage, Basic Lift and the encumbrance rows). No cost backs an override.

How the editor treats strict fields (`main.js`):
- **Locked by default:** a strict field is read-only until the first edit attempt (keydown, paste, double-click, or a second tap) is confirmed in the `#confirm` dialog. The unlock lasts for the session; clearing the override locks the field again.
- **Experimental mode:** the toolbar toggle (`flags.experimental` in the draft and in files) skips the confirmations.
- **Integrity panel:** `sheetDeviations()` (a strict field whose typed value ≠ the computed one; a blank cost counts as 0) and `sheetIssues()` (over budget, skill below minimum) feed the `#integrity` panel and the magenta `.deviation` field style.

How files carry it (schema 1.1):
- `toCharacter()` requires `opts.schema` and writes `integrity { experimental, rulesCompliant, deviations[{pointer, expected, actual, sheetField, label, justification?}], issues[] }`.
  - The deviation list is produced by the engine-side `deviations()` on the document itself, so the file can't disagree with an engine.
  - An `inconsistent` derived value (the mapping lost something) blocks the save as an internal error.
  - Manual NH/cost or bonuses on an empty skill row are reported as problems.
  - Totals are summed from exact values, never from the 2-decimal display strings.
- In the schema, every `overridable` node carries `x-gurps.override: "paid" | "unpaid"`. `PAID_OVERRIDES` must match the paid nodes, and a test checks this.
- `schema/formula.js` `deviations(schema, doc)` is the engine-side check, which never trusts `integrity`. `test/integrity.test.js` asserts that the app's reported deviations equal what `deviations()` finds.
- On load, `fromCharacter()` recomputes once. It warns when a file claims `rulesCompliant: true` despite deviations or issues (e.g. over budget), and when its totals differ from the calculated ones.
- Examples: `schema/examples/rurik.json` (1.1, plain) and `jotun.json` (1.3: Size, a cost limitation, an NH bonus, a justified deviation).

### Rule-backed adjustments: cost modifiers, NH bonuses, justifications

Purchases of the 10 `COSTED` characteristics cost `⌈raw × max(20%, 1 + Σ%)⌉`. This is `modifiedCost()` in `rules.js`, and the identical formula is in the schema.
- **Which modifiers apply:** `costModifiers(id, values)` returns the automatic Size discount (−10% per +1 Mod. de Tamanho, ST and PV only, never stored) plus the player's own, kept in `values.costModifiers` (`COST_MODS`, the only non-string key in `values`).
- **When they apply:** only to purchases. Selling below base is unmodified.
- **Breakdown for the UI:** `compute()` also returns `costs[id]` (raw cost, modifiers, multiplier, final cost).
- **UI:** the adjust dialog (`#adjust`) is what cost fields open, by double-click, by an edit attempt on a locked cost, or from a cost deviation in the panel. A modifier keeps the sheet within the rules, and "Valor manual" is the flagged escape hatch.
- **In files:** `costModifiers` is exported per characteristic (schema 1.2). `test/costs.test.js` checks the app against the schema formulas over a grid of ST, SM and modifiers.
- **NH bonuses (schema 1.3):** `values.skillBonuses` (`SKILL_BONUSES`) is keyed by sheet skill row. NH = attribute + relative level + Σ bonuses, and `compute()` returns `skills[row]` for the UI. Bonuses follow packed rows on save/load, and they never change the skill's point cost.
- **The adjust dialog (`#adjust`):** one dialog serves both costs and NH through `adjusterFor(fieldId)`. Each field type supplies its title, breakdown, items, validation and result text. Adjusted fields get the green `.adjusted` underline.
- **Justifications (schema 1.3):** `values.justifications` (`JUSTIFICATIONS`) maps a field to the player's reason for a manual value. They are edited from the panel ("Justificar") in `#justify`, exported as `integrity.deviations[].justification`, and dropped when the manual value is cleared. They don't make the sheet compliant. On load they are matched by `sheetField`, else by pointer; a stale one becomes a warning.
- `values` therefore has three non-string keys: `costModifiers`, `skillBonuses` and `justifications`.

### Deliberate deviations from the original XFA scripts

**Policy (owner's decision): when the PDF's scripts diverge from the GURPS 4e Basic Set (Módulo Básico), follow the Basic Set.** Keep these fixes, and don't "restore" PDF behavior when comparing against the original:

- `Custo_PV` never computed (it assigned to `rawvalue`, lowercase).
- Hard (`D`) skills never computed a cost (it assigned to `rawValuee`). Row 6 wrote its cost into row 1, and `NH6` used row 1's level for ST.
- `Custo_Vel_Basica` was counted in both the attributes and advantages subtotals.
- Dodge used Basic Move. Per the Basic Set it now uses `floor(Basic Speed) + 3`, so buying Move does not raise Dodge.
- Damage above ST 100 was undefined/inconsistent; it now adds +1d per full 10 ST (thrust 11d, swing 13d at 100).
- Basic Lift (`ST²/10` kg, the pt-BR sheet's rule) rounds to whole kg at ≥10.
- Blank primary attributes count as 10 (free) instead of leaving everything derived blank, and their cost is blank rather than `0` at the default.
