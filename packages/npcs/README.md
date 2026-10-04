# @gurps-sheet/npcs

Ready-made GURPS 4th Edition NPCs in the [`gurps-character`](../character/README.md) format, grouped by adventure style. Each NPC is built only from **Basic Set** skills, advantages, disadvantages, spells, weapons, armor and gear. They serve as examples for GMs and as fixtures for engine tests (combat resolution, damage, defenses, skill rolls).

Every NPC is:
- **Valid:** it passes the schema.
- **Rules-compliant:** `verifyCharacter()` recomputes every cost, level, defense and total and finds nothing to report.
- **On budget:** it spends **exactly its point budget**.
- **Editor-ready:** it loads into the sheet editor and saves back byte-for-byte.

## The NPCs

| Style | TL | NPCs |
|---|---|---|
| `fantasy`: medieval fantasy | 3 | town watchman, mercenary knight, court wizard, forest ranger, guild cutpurse, temple priest |
| `swashbuckling`: 17th-century intrigue and piracy | 4 | musketeer, pirate captain, bosun, the Cardinal's spy, highwayman |
| `western`: the 1870s frontier | 5 | gunslinger, town marshal, outlaw, riverboat gambler, frontier scout |
| `modern`: action and espionage | 8 | street thug, patrol officer, special forces soldier, intelligence officer, hacker, mob enforcer |
| `horror`: 1920s occult | 6 | occult investigator, cult acolyte, monster hunter, asylum director, spirit medium |
| `science-fiction`: starships and marines | 10-11 | starfighter pilot, space marine, ship's doctor, smuggler, chief engineer |

Point values run from 25 (street thug) to 200 (spy, space marine). Each NPC has a `threat` rating:
- `non-combatant`
- `mook`
- `standard`
- `boss`

## Using them

```ts
import { getNpc, listNpcs, npcsByStyle } from '@gurps-sheet/npcs';
import { applyDamage, combatStats } from '@gurps-sheet/character';

const knight = getNpc('fantasy-mercenary-knight');        // a new copy on every call: mutate freely
const targets = listNpcs({ tag: ['firearms', 'armored'] }); // summaries: id, style, role, threat, points, tags
const wounded = applyDamage(knight, 8);
combatStats(wounded).hp; // { current: 7, max: 15 }
```

Tools in other languages can read the same documents from `data/<style>/<id>.json`, with an index (summaries and file paths) in `data/index.json`.

### Tags (for picking fixtures)

| Tag | Meaning |
|---|---|
| `melee`, `ranged` | Has weapons of that kind |
| `firearms`, `beam-weapons`, `muscle-powered`, `grenades` | Ranged weapon families |
| `unarmed-combat` | Knows Brawling, Boxing, Karate, Judo or Wrestling |
| `no-weapons` | Carries no weapon at all |
| `shield` | Has a Block skill |
| `armored` | Has DR somewhere |
| `mounted` | Knows Riding |
| `spellcaster` | Knows spells (with Magery bonuses) |
| `skill-bonuses` | Some skill levels include NH bonuses from traits (format 1.3) |
| `text-only-damage` | Some weapon damage has no structured fields: armor divisors such as `3d(5) burn`, explosions such as `8d cr ex [3d cut]`, `thr(0.5) imp` |
| `illiterate` | Can't read its native language (a −3 language entry) |

The tags cover edge cases an engine should handle:
- **No weapons:** the hacker.
- **Notation-only damage:** the beam weapons, the grenade, the wooden stake.
- **Parry "No":** the lance.
- **Fencing parry:** `0F` on the rapier, smallsword and saber.
- **Multiple NH bonuses on one skill:** the ship's doctor's Psychology.
- **A 1-point perk:** the thief's Night Vision 1.
- **DR 40 everywhere:** the space marine.

## How the library is built

```
src/catalog/      Basic Set reference data: skills, spells, traits, weapons, armor, gear (each with its page)
src/styles/*.ts   the NPCs, written compactly: attributes, traits, skills at relative levels, equipment
src/build.ts      definition -> full document
data/             generated JSON (committed)
```

`buildNpc()` takes inputs from the definition and the catalog. It then computes every derived value from the schema's own formulas, iterating until nothing changes:
- skill costs and levels;
- attribute and secondary costs;
- Dodge, Parry and Block;
- damage and encumbrance;
- totals.

Traits that raise skills add **NH bonuses automatically**:
- Magery adds to spells and Thaumatology.
- Combat Reflexes adds to Fast-Draw.
- Absolute Direction adds to Navigation.
- Talents add to their skill groups.
- Voice, Charisma and Empathy add to their listed skills.

Over-budget NPCs, skills below their minimum level, and Parry or Block with an unknown skill all fail the build.

### Conventions
- **Metric sheet:** weights are the Basic Set's pounds × 0.5 kg; ranges in yards are meters (B9). Muscle-powered ranges (`x15/x20`) are worked out from the NPC's ST.
- **Defenses follow the format:** Dodge = Basic Speed + 3, and Parry/Block = 3 + skill/2. Combat Reflexes' +1 and a shield's DB are **not** included, just as on the sheet, so engines must add them. Shields are listed as equipment with their DB in the name ("Medium Shield (DB 2)").
- **DR per location:** the best piece covering it, with no layering. Head means the skull. Flexible armor notes its crushing weakness ("(2 vs. crushing)").
- **Names:** English Basic Set names; the locale is `en-US`. Self-control numbers appear in trait names ("Bad Temper (12)"), and levels are part of the name ("Acute Vision 2", "Magery 2").

### Developing

```bash
npm run report   -w @gurps-sheet/npcs [-- <style>]   # points, defenses and skill levels per NPC (for tuning)
npm run generate -w @gurps-sheet/npcs                # rewrite data/ after changing a definition or the catalog
npm test         -w @gurps-sheet/npcs                # typecheck, tests, data freshness, dist smoke test
```

The tests check the following:
- 4 to 6 NPCs per style, each valid, compliant and exactly on budget;
- every part cites a Basic Set page, and no weapon is above the NPC's tech level;
- prerequisites (Magery level, required skills and spells) are met;
- every weapon's skill is known;
- NH bonuses come only from the NPC's own traits;
- `data/` matches the build.

Separately, the editor's test suite (`test/npcs.test.js` at the repository root) loads every NPC into the sheet and saves it back unchanged.

The catalog's stats were transcribed from the Basic Set tables and cross-checked against the Basic Set data in the GCS master library. The spell entries cite the Basic Set's magic chapter (B242-253) rather than individual pages.

## Releases

Published to npm from CI when a version bump is merged to `main`; each version has a GitHub release tagged `npcs-v<version>` with its changes.
