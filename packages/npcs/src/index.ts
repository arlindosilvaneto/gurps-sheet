// @gurps-sheet/npcs — ready-made NPCs in the gurps-character format, grouped by adventure style.
//
//   import { listNpcs, getNpc } from '@gurps-sheet/npcs';
//   const guard = getNpc('fantasy-town-guard');                       // a fresh, valid, rules-compliant document
//   const shooters = listNpcs({ tag: 'firearms', threat: 'boss' });   // summaries, for picking test fixtures
//
// The same documents are in data/<style>/<id>.json for tools in other languages.
import type { GurpsCharacter } from '@gurps-sheet/character';
import { buildNpc, summarize, type NpcSummary, type NpcTag } from './build.js';
import type { AdventureStyle, NpcDefinition, Threat } from './define.js';
import { DEFINITIONS, STYLES, type StyleInfo } from './styles/index.js';

export type { AdventureStyle, NpcDefinition, NpcSummary, NpcTag, StyleInfo, Threat };
export { STYLES, DEFINITIONS as NPC_DEFINITIONS };
// For writing more NPCs the same way (the catalog is at '@gurps-sheet/npcs/catalog').
export { buildNpc, summarize } from './build.js';
export { npc, learn, nativeLanguage, language } from './define.js';

const built = new Map<string, { doc: GurpsCharacter; summary: NpcSummary }>();
function entry(def: NpcDefinition) {
  let e = built.get(def.id);
  if (!e) {
    const doc = buildNpc(def);
    e = { doc, summary: summarize(def, doc) };
    built.set(def.id, e);
  }
  return e;
}

export interface NpcFilter {
  readonly style?: AdventureStyle;
  readonly threat?: Threat;
  /** Every listed tag must be present. */
  readonly tag?: NpcTag | ReadonlyArray<NpcTag>;
}

/** Summaries of the NPCs matching `filter`, in library order. */
export function listNpcs(filter: NpcFilter = {}): NpcSummary[] {
  const tags: ReadonlyArray<NpcTag> = filter.tag === undefined ? [] : typeof filter.tag === 'string' ? [filter.tag] : filter.tag;
  return DEFINITIONS.map((d) => entry(d).summary)
    .filter((s) => (!filter.style || s.style === filter.style) && (!filter.threat || s.threat === filter.threat) && tags.every((t) => s.tags.includes(t)));
}

/** The NPC as a gurps-character document. Each call returns a new copy, so tests can change it freely. */
export function getNpc(id: string): GurpsCharacter {
  const def = DEFINITIONS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown NPC "${id}". Known: ${DEFINITIONS.map((d) => d.id).join(', ')}.`);
  return structuredClone(entry(def).doc);
}

/** Every NPC of one adventure style, as documents (copies). */
export function npcsByStyle(style: AdventureStyle): GurpsCharacter[] {
  return DEFINITIONS.filter((d) => d.style === style).map((d) => getNpc(d.id));
}
