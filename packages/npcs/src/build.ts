// Turns an NpcDefinition into a complete gurps-character document. Inputs come from the definition and the Basic
// Set catalog; every derived value (costs, levels, defenses, encumbrance, totals) is computed from the schema's own
// formulas until it settles, so a built NPC is rules-compliant by construction.
//
// Notations are parsed with the same rules as the sheet editor (src/character.js at the repository root), so an NPC
// loaded into the editor and saved again comes back unchanged.
import { schema, recompute, type GurpsCharacter } from '@gurps-sheet/character';
import type { ArmorDef, HitLocation, MeleeWeaponDef, RangedWeaponDef, ReactionSource, TraitDef } from './catalog/types.js';
import type { AdventureStyle, NpcDefinition, Threat } from './define.js';

/** Fixed timestamps keep the generated files reproducible. */
export const CREATED_AT = '2026-10-04T12:00:00Z';
export const GENERATOR = { name: '@gurps-sheet/npcs', version: '0.1.0' } as const;

/** 1 lb = 0.5 kg (B9, metric conversion), rounded to grams. */
const kg = (lb: number) => Math.round(lb * 500) / 1000;
const decimal = (x: number) => String(Math.round(x * 100) / 100);

// ---------------- notations (same rules as the sheet editor) ----------------
const DAMAGE = /^(thr|sw|(\d+)d)\s*([+-]\d+)?\s*([a-z+-]+)?$/i;
const DAMAGE_TYPES = new Set(['cr', 'cut', 'imp', 'pi-', 'pi', 'pi+', 'pi++', 'burn', 'cor', 'fat', 'tox', 'tbb', 'aff', 'spec']);

type WeaponDamage = { notation: string; base?: 'thrust' | 'swing' | 'fixed'; dice?: number; adds?: number; type?: string };

/** "sw+1 cut" -> structured parts; notations the sheet can't structure ("3d(2) burn") stay text only. */
export function weaponDamage(notation: string): WeaponDamage {
  const m = DAMAGE.exec(notation.replace(/\s+/g, ' '));
  if (!m) return { notation };
  const head = (m[1] as string).toLowerCase();
  const out: WeaponDamage = { notation, base: head === 'thr' ? 'thrust' : head === 'sw' ? 'swing' : 'fixed' };
  if (out.base === 'fixed') out.dice = Number(m[2]);
  out.adds = Number(m[3] ?? 0);
  const type = m[4]?.toLowerCase();
  if (type && DAMAGE_TYPES.has(type)) out.type = type;
  return out;
}

/** "0", "-1", "+2", "0U" (unbalanced), "0F" (fencing), "No". */
export function parryOf(notation: string): { notation: string; modifier?: number | null; unbalanced?: boolean } {
  if (/^no$/i.test(notation)) return { notation, modifier: null };
  const m = /^([+-]?\d+)\s*([udf])?$/i.exec(notation);
  return m ? { notation, modifier: Number(m[1]), unbalanced: /[ud]/i.test(m[2] ?? '') } : { notation };
}

/** Table range for this NPC: ST multiples ("x15/x20") become yards/meters; "a/b" also gets structured parts. */
export function rangeOf(spec: string, st: number): { notation: string; halfDamage?: number; max?: number } {
  const muscle = /^x([\d.]+)(?:\/x([\d.]+))?$/.exec(spec);
  const notation = muscle ? [muscle[1], muscle[2]].filter((f): f is string => f !== undefined).map((f) => decimal(st * Number(f))).join('/') : spec;
  const m = /^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(notation);
  return m ? { notation, halfDamage: Number(m[1]), max: Number(m[2]) } : { notation };
}

// ---------------- pieces of the document ----------------
const COMPREHENSION_COST = { none: 0, broken: 1, accented: 2, native: 3 } as const;
const LOCATIONS: Array<[HitLocation, string]> = [['head', 'Head'], ['torso', 'Torso'], ['arms', 'Arms'], ['hands', 'Hands'], ['legs', 'Legs'], ['feet', 'Feet']];
const REACTION_ORDER: ReactionSource[] = ['appearance', 'status', 'reputation', 'other'];
const ENCUMBRANCE_IDS = ['none', 'light', 'medium', 'heavy', 'extraHeavy'] as const;

function traitType(t: TraitDef) {
  if (t.points === 0) throw new Error(`Trait "${t.name}" costs 0 points.`);
  return t.points > 0 ? (t.points === 1 ? 'perk' : 'advantage') : (t.points === -1 ? 'quirk' : 'disadvantage');
}

/** DR per location: the best piece covering it (layering is not modeled). */
function damageResistance(armor: ReadonlyArray<ArmorDef>) {
  return LOCATIONS.flatMap(([id, label]) => {
    const best = armor.filter((a) => (a.dr[id] ?? 0) > 0).sort((a, b) => (b.dr[id] ?? 0) - (a.dr[id] ?? 0))[0];
    if (!best) return [];
    return [{ location: label, locationId: id, dr: best.dr[id] as number, ...(best.drNotes ? { notes: best.drNotes } : {}) }];
  });
}

function meleeRow(w: MeleeWeaponDef) {
  return {
    name: w.name,
    damage: w.damage.map(weaponDamage),
    reach: w.reach,
    parry: parryOf(w.parry),
    ...(w.minST ? { notes: `ST ${w.minST}` } : {}),
    cost: w.cost,
    weight: kg(w.weightLb),
  };
}

function rangedRow(w: RangedWeaponDef, st: number) {
  return {
    name: w.name,
    damage: weaponDamage(w.damage),
    accuracy: w.accuracy,
    range: rangeOf(w.range, st),
    rateOfFire: w.rateOfFire,
    shots: w.shots,
    ...(w.minST ? { minST: w.minST } : {}),
    bulk: w.bulk,
    recoil: w.recoil,
    legalityClass: w.legalityClass,
    cost: w.cost,
    weight: kg(w.weightLb),
  };
}

// ---------------- settling derived values ----------------
function setAt(doc: Record<string, unknown>, pointer: string, value: unknown) {
  const path = pointer.slice(1).split('/');
  const owner = path.slice(0, -1).reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, doc);
  owner[path.at(-1) as string] = value;
}
function getAt(doc: Record<string, unknown>, pointer: string): unknown {
  return pointer.slice(1).split('/').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], doc);
}

/** Recomputes until nothing changes. Paid values the definition sets (bought-up HP...) are kept as inputs. */
function settle(doc: Record<string, unknown>, keep: Set<string>) {
  for (let pass = 0; pass < 20; pass++) {
    let changed = false;
    for (const r of recompute(schema, doc as unknown as GurpsCharacter)) {
      if (r.role !== 'derived' && r.role !== 'overridable') continue;
      if (keep.has(r.pointer)) continue;
      if (JSON.stringify(getAt(doc, r.pointer)) !== JSON.stringify(r.computed)) {
        setAt(doc, r.pointer, r.computed);
        changed = true;
      }
    }
    if (!changed) return;
  }
  throw new Error('Derived values did not settle.');
}

// ---------------- the document ----------------
export function buildNpc(def: NpcDefinition): GurpsCharacter {
  const { st, dx, iq, ht } = def.attributes;
  const traits = [...def.traits].sort((a, b) => Number(b.points > 0) - Number(a.points > 0)); // the sheet lists advantages first
  const skillNames = new Set(def.skills.map((s) => s.skill.name));
  for (const used of [def.parry, def.block]) {
    if (used && !skillNames.has(used.name)) throw new Error(`${def.id}: defense skill "${used.name}" is not among the NPC's skills.`);
  }

  const skills = def.skills.map(({ skill, relativeLevel }) => {
    const bonuses = traits.flatMap((t) => (t.skillBonuses ?? []).filter((b) => b.appliesTo(skill)).map((b) => ({ name: t.name, amount: b.amount })));
    return {
      name: skill.name, attribute: skill.attribute, difficulty: skill.difficulty, relativeLevel, level: 0, points: 0,
      ...(bonuses.length ? { bonuses } : {}),
    };
  });

  const reactionModifiers = traits.filter((t) => t.reaction)
    .map((t) => t.reaction as NonNullable<TraitDef['reaction']>)
    .sort((a, b) => REACTION_ORDER.indexOf(a.source) - REACTION_ORDER.indexOf(b.source))
    .map(({ source, modifier, description }) => ({ source, modifier, description }));

  const characteristic = (value: number) => ({ value, points: 0 });
  const secondary = (value = 0, current = false) => ({ value, base: 0, points: 0, ...(current ? { current: 0 } : {}) });
  const s = def.secondary ?? {};
  const keep = new Set(Object.keys(s).map((k) => `/secondary/${k}/value`));

  const doc = {
    format: 'gurps-character',
    formatVersion: '1.1.0',
    ruleset: { system: 'GURPS', edition: 4, units: 'metric', currency: '$' },
    meta: { locale: 'en-US', createdAt: CREATED_AT, updatedAt: CREATED_AT, generator: { ...GENERATOR } },
    profile: {
      name: def.name,
      ...(def.profile?.height ? { height: def.profile.height } : {}),
      ...(def.profile?.weight ? { weight: def.profile.weight } : {}),
      ...(def.profile?.age ? { age: def.profile.age } : {}),
      sizeModifier: 0,
      ...(def.profile?.appearance ? { appearance: def.profile.appearance } : {}),
    },
    points: { budget: def.budget, spent: 0, unspent: 0, breakdown: { attributes: 0, advantages: 0, disadvantages: 0, skills: 0, other: 0 } },
    attributes: { st: characteristic(st), dx: characteristic(dx), iq: characteristic(iq), ht: characteristic(ht) },
    secondary: {
      hp: secondary(s.hp, true), will: secondary(s.will), per: secondary(s.per), fp: secondary(s.fp, true),
      basicSpeed: secondary(s.basicSpeed), basicMove: secondary(s.basicMove),
    },
    encumbrance: { basicLift: 0, levels: ENCUMBRANCE_IDS.map((id, level) => ({ level, id, maxLoad: 0, move: 0, dodge: 0 })) },
    damage: { thrust: { notation: '1d', dice: 1, adds: 0 }, swing: { notation: '1d', dice: 1, adds: 0 } },
    defenses: {
      dodge: { value: 0 },
      parry: { skill: def.parry?.name ?? null, value: null },
      block: { skill: def.block?.name ?? null, value: null },
    },
    damageResistance: damageResistance(def.armor ?? []),
    reactionModifiers,
    techLevel: { level: def.techLevel, points: 0 },
    languages: def.languages.map((l) => ({
      name: l.name, spoken: l.spoken, written: l.written,
      points: COMPREHENSION_COST[l.spoken] + COMPREHENSION_COST[l.written] - (l.native ? 6 : 0),
    })),
    culturalFamiliarities: [],
    traits: traits.map((t) => ({ name: t.name, type: traitType(t), points: t.points })),
    skills,
    weapons: { melee: (def.melee ?? []).map(meleeRow), ranged: (def.ranged ?? []).map((w) => rangedRow(w, st)) },
    equipment: [
      ...(def.armor ?? []).map((a) => ({ name: a.name, location: a.location, cost: a.cost, weight: kg(a.weightLb) })),
      ...(def.gear ?? []).map((g) => ({ name: g.name, ...(g.location ? { location: g.location } : {}), cost: g.cost, weight: kg(g.weightLb) })),
    ],
    possessionsTotal: { cost: 0, weight: 0 },
    notes: [...(def.notes ?? [])],
    integrity: { experimental: false, rulesCompliant: true, deviations: [], issues: [] },
  };

  settle(doc as unknown as Record<string, unknown>, keep);
  doc.secondary.hp.current = doc.secondary.hp.value; // built unhurt and rested
  doc.secondary.fp.current = doc.secondary.fp.value;
  if (skills.some((k) => k.bonuses)) doc.formatVersion = '1.3.0'; // skill bonuses arrived in 1.3

  for (const k of skills) {
    if (k.points === null) throw new Error(`${def.id}: "${k.name}" at relative level ${k.relativeLevel} is below the minimum for its difficulty.`);
  }
  if (doc.points.spent > def.budget) throw new Error(`${def.id}: spends ${doc.points.spent} points, over its ${def.budget}-point budget.`);
  return doc as unknown as GurpsCharacter;
}

// ---------------- catalog entry ----------------
export type NpcTag =
  | 'melee' | 'ranged' | 'firearms' | 'beam-weapons' | 'muscle-powered' | 'grenades' | 'unarmed-combat' | 'no-weapons'
  | 'shield' | 'armored' | 'mounted' | 'spellcaster' | 'skill-bonuses' | 'text-only-damage' | 'illiterate';

export interface NpcSummary {
  readonly id: string;
  readonly style: AdventureStyle;
  readonly name: string;
  readonly role: string;
  readonly threat: Threat;
  readonly points: number;
  readonly budget: number;
  readonly techLevel: number;
  /** Capabilities and data features, for picking fixtures: "firearms", "spellcaster", "text-only-damage"... */
  readonly tags: ReadonlyArray<NpcTag>;
}

/** What an engine test usually filters on, derived from the built document. */
export function summarize(def: NpcDefinition, doc: GurpsCharacter): NpcSummary {
  const skillBases = new Set(def.skills.map((s) => s.skill.base));
  const ranged = def.ranged ?? [];
  const damages = [...doc.weapons?.melee?.flatMap((w) => w.damage ?? []) ?? [], ...doc.weapons?.ranged?.flatMap((w) => (w.damage ? [w.damage] : [])) ?? []];
  const tags: NpcTag[] = [];
  const tag = (t: NpcTag, when: boolean) => when && tags.push(t);
  tag('melee', (def.melee ?? []).length > 0);
  tag('ranged', ranged.length > 0);
  tag('firearms', ranged.some((w) => w.skill.base === 'Guns'));
  tag('beam-weapons', ranged.some((w) => w.skill.base === 'Beam Weapons'));
  tag('muscle-powered', ranged.some((w) => ['Bow', 'Crossbow', 'Thrown Weapon'].includes(w.skill.base)));
  tag('grenades', ranged.some((w) => w.skill.base === 'Throwing'));
  tag('unarmed-combat', ['Brawling', 'Boxing', 'Karate', 'Judo', 'Wrestling'].some((b) => skillBases.has(b)));
  tag('no-weapons', (def.melee ?? []).length === 0 && ranged.length === 0);
  tag('shield', def.block !== undefined);
  tag('armored', (doc.damageResistance ?? []).length > 0);
  tag('mounted', skillBases.has('Riding'));
  tag('spellcaster', def.skills.some((s) => s.skill.kind === 'spell'));
  tag('skill-bonuses', doc.skills.some((k) => k.bonuses?.length));
  tag('text-only-damage', damages.some((d) => d.base === undefined));
  tag('illiterate', def.languages.some((l) => l.native && l.written === 'none'));
  return {
    id: def.id, style: def.style, name: def.name, role: def.role, threat: def.threat,
    points: doc.points.spent, budget: def.budget, techLevel: def.techLevel, tags,
  };
}
