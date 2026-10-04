// Basic Set advantages (pp. 32-100) and disadvantages (pp. 119-165) used by the NPC library. Traits that raise
// skills say so in `skillBonuses`; the NPC builder applies them as NH bonuses, so levels always match the rules.
import type { SkillDef, TraitDef, TraitSkillBonus } from './types.js';

const trait = (name: string, points: number, reference: string, extra: Partial<TraitDef> = {}): TraitDef =>
  Object.freeze({ name, points, reference, ...extra });

/** Bonus to skills whose base name is one of `bases` (specialties included). */
const toSkills = (amount: number, ...bases: string[]): TraitSkillBonus => ({ amount, appliesTo: (s: SkillDef) => bases.includes(s.base) });
/** Bonus to specific specialties, e.g. "Navigation (Land)". */
const toNames = (amount: number, ...names: string[]): TraitSkillBonus => ({ amount, appliesTo: (s: SkillDef) => names.includes(s.name) });

/** Self-control number multiplier (B120): resists on 6 ×2, 9 ×1.5, 12 ×1, 15 ×0.5. */
const SELF_CONTROL = { 6: 2, 9: 1.5, 12: 1, 15: 0.5 } as const;
type SelfControl = keyof typeof SELF_CONTROL;
const selfControl = (name: string, base: number, reference: string, cr: SelfControl = 12) =>
  trait(`${name} (${cr})`, Math.round(base * SELF_CONTROL[cr]), reference);

const HEALER_SKILLS = ['Diagnosis', 'Esoteric Medicine', 'First Aid', 'Pharmacy', 'Physician', 'Physiology', 'Psychology', 'Surgery', 'Veterinary'];
const ARTIFICER_SKILLS = ['Armoury', 'Carpentry', 'Electrician', 'Electronics Repair', 'Engineer', 'Machinist', 'Masonry', 'Mechanic', 'Smith'];

export const ADVANTAGES = {
  absoluteDirection: trait('Absolute Direction', 5, 'B34', {
    skillBonuses: [toSkills(3, 'Body Sense'), toNames(3, 'Navigation (Air)', 'Navigation (Land)', 'Navigation (Sea)')],
  }),
  /** With the 3D Spatial Sense enhancement (+5 points). */
  absoluteDirection3D: trait('Absolute Direction (3D Spatial Sense)', 10, 'B34', {
    skillBonuses: [
      toSkills(3, 'Body Sense'), toNames(3, 'Navigation (Air)', 'Navigation (Land)', 'Navigation (Sea)'),
      toSkills(1, 'Piloting'), toSkills(2, 'Aerobatics', 'Free Fall'), toNames(2, 'Navigation (Hyperspace)', 'Navigation (Space)'),
    ],
  }),
  acuteVision: (level: number) => trait(`Acute Vision ${level}`, 2 * level, 'B35'),
  attractive: trait('Appearance (Attractive)', 4, 'B21', { reaction: { source: 'appearance', modifier: 1, description: 'Attractive' } }),
  artificer: (level: number) => trait(`Artificer ${level}`, 10 * level, 'B90', { skillBonuses: [toSkills(level, ...ARTIFICER_SKILLS)] }),
  charisma: (level: number) => trait(`Charisma ${level}`, 5 * level, 'B41', {
    skillBonuses: [toSkills(level, 'Fortune-Telling', 'Leadership', 'Panhandling', 'Public Speaking')],
  }),
  clericalInvestment: trait('Clerical Investment', 5, 'B43'),
  combatReflexes: trait('Combat Reflexes', 15, 'B43', { skillBonuses: [toSkills(1, 'Fast-Draw')] }),
  comfortableWealth: trait('Wealth (Comfortable)', 10, 'B25'),
  dangerSense: trait('Danger Sense', 15, 'B47'),
  daredevil: trait('Daredevil', 15, 'B47'),
  eideticMemory: trait('Eidetic Memory', 5, 'B51'),
  empathy: trait('Empathy', 15, 'B51', { skillBonuses: [toSkills(3, 'Detect Lies', 'Fortune-Telling', 'Psychology')] }),
  empathySensitive: trait('Empathy (Sensitive)', 5, 'B51', { skillBonuses: [toSkills(1, 'Detect Lies', 'Fortune-Telling', 'Psychology')] }),
  fearlessness: (level: number) => trait(`Fearlessness ${level}`, 2 * level, 'B55'),
  fit: trait('Fit', 5, 'B55'),
  hardToKill: (level: number) => trait(`Hard to Kill ${level}`, 2 * level, 'B58'),
  healer: (level: number) => trait(`Healer ${level}`, 10 * level, 'B90', { skillBonuses: [toSkills(level, ...HEALER_SKILLS)] }),
  highPainThreshold: trait('High Pain Threshold', 10, 'B59'),
  /** B65: 5 points (local jurisdiction, limited powers), 10 (national, or local with broad powers), 15 (federal or international). */
  legalEnforcementPowers: (points: 5 | 10 | 15, scope: string) => trait(`Legal Enforcement Powers (${scope})`, points, 'B65'),
  lightningCalculator: trait('Lightning Calculator', 2, 'B66'),
  luck: trait('Luck', 15, 'B66'),
  magery: (level: number) => trait(`Magery ${level}`, 5 + 10 * level, 'B66', {
    skillBonuses: [{ amount: level, appliesTo: (s) => s.kind === 'spell' }, toSkills(level, 'Thaumatology')],
  }),
  medium: trait('Medium', 10, 'B68'),
  nightVision: (level: number) => trait(`Night Vision ${level}`, level, 'B71'),
  singleMinded: trait('Single-Minded', 5, 'B85'),
  status: (level: number, title: string) => trait(`Status ${level}`, 5 * level, 'B28', { reaction: { source: 'status', modifier: level, description: title } }),
  unfazeable: trait('Unfazeable', 15, 'B95'),
  veryFit: trait('Very Fit', 15, 'B55'),
  voice: trait('Voice', 10, 'B97', {
    skillBonuses: [toSkills(2, 'Diplomacy', 'Fast-Talk', 'Mimicry', 'Performance', 'Politics', 'Public Speaking', 'Sex Appeal', 'Singing')],
  }),
} as const;

const DUTY_FREQUENCY = { 6: -2, 9: -5, 12: -10, 15: -15 } as const;
const SENSE_OF_DUTY = { individual: -2, 'small group': -5, 'large group': -10, 'entire race': -15, 'every living being': -20 } as const;
const SECRET = { 'serious embarrassment': -5, 'utter rejection': -10, imprisonment: -20, 'possible death': -30 } as const;

export const DISADVANTAGES = {
  alcoholism: trait('Alcoholism', -15, 'B122'),
  /** Corrected by glasses or contacts at TL5+ (B123). */
  badSightNearsightedCorrected: trait('Bad Sight (Nearsighted, corrected)', -10, 'B123'),
  badTemper: (cr?: SelfControl) => selfControl('Bad Temper', -10, 'B124', cr),
  bloodlust: (cr?: SelfControl) => selfControl('Bloodlust', -10, 'B125', cr),
  bully: (cr?: SelfControl) => selfControl('Bully', -10, 'B125', cr),
  callous: trait('Callous', -5, 'B125', { skillBonuses: [toSkills(-3, 'Psychology', 'Teaching')] }),
  codeOfHonor: (kind: 'Chivalry' | "Gentleman's" | "Pirate's" | 'Professional' | "Soldier's") =>
    trait(`Code of Honor (${kind})`, { Chivalry: -15, "Gentleman's": -10, "Pirate's": -5, Professional: -5, "Soldier's": -10 }[kind], 'B127'),
  compulsiveGambling: (cr?: SelfControl) => selfControl('Compulsive Gambling', -5, 'B128', cr),
  curious: (cr?: SelfControl) => selfControl('Curious', -5, 'B129', cr),
  duty: (to: string, frequency: keyof typeof DUTY_FREQUENCY, extremelyHazardous = false) =>
    trait(`Duty (${to}, ${frequency} or less${extremelyHazardous ? ', extremely hazardous' : ''})`, DUTY_FREQUENCY[frequency] - (extremelyHazardous ? 5 : 0), 'B133'),
  fanaticism: (cause: string) => trait(`Fanaticism (${cause})`, -15, 'B136'),
  gluttony: (cr?: SelfControl) => selfControl('Gluttony', -5, 'B137', cr),
  greed: (cr?: SelfControl) => selfControl('Greed', -15, 'B137', cr),
  honesty: (cr?: SelfControl) => selfControl('Honesty', -10, 'B138', cr),
  impulsiveness: (cr?: SelfControl) => selfControl('Impulsiveness', -10, 'B139', cr),
  insomniacMild: trait('Insomniac (Mild)', -10, 'B140'),
  laziness: trait('Laziness', -10, 'B142'),
  intolerance: (of: string) => trait(`Intolerance (${of})`, -5, 'B140'),
  lecherousness: (cr?: SelfControl) => selfControl('Lecherousness', -15, 'B142', cr),
  loner: (cr?: SelfControl) => selfControl('Loner', -5, 'B142', cr),
  megalomania: trait('Megalomania', -10, 'B144'),
  nightmares: (cr?: SelfControl) => selfControl('Nightmares', -5, 'B144', cr),
  obsession: (goal: string, term: 'short-term' | 'long-term', cr: SelfControl = 12) =>
    trait(`Obsession (${goal}) (${cr})`, Math.round((term === 'short-term' ? -5 : -10) * SELF_CONTROL[cr]), 'B146'),
  odiousPersonalHabit: (habit: string, level: 1 | 2 | 3) => trait(`Odious Personal Habit (${habit})`, -5 * level, 'B22'),
  overconfidence: (cr?: SelfControl) => selfControl('Overconfidence', -5, 'B148', cr),
  pacifismCannotHarmInnocents: trait('Pacifism (Cannot Harm Innocents)', -10, 'B148'),
  pacifismReluctantKiller: trait('Pacifism (Reluctant Killer)', -5, 'B148'),
  sadism: (cr?: SelfControl) => selfControl('Sadism', -15, 'B152', cr),
  secret: (what: string, consequence: keyof typeof SECRET) => trait(`Secret (${what})`, SECRET[consequence], 'B152'),
  selfish: (cr?: SelfControl) => selfControl('Selfish', -5, 'B153', cr),
  senseOfDuty: (to: string, scope: keyof typeof SENSE_OF_DUTY) => trait(`Sense of Duty (${to})`, SENSE_OF_DUTY[scope], 'B153'),
  socialStigmaCriminalRecord: trait('Social Stigma (Criminal Record)', -5, 'B155'),
  stubbornness: trait('Stubbornness', -5, 'B157'),
  vow: (what: string, level: 'minor' | 'major' | 'great') => trait(`Vow (${what})`, { minor: -5, major: -10, great: -15 }[level], 'B160'),
  workaholic: trait('Workaholic', -5, 'B162'),
} as const;

/** A quirk (B162): a minor, player-defined trait worth -1 point. */
export const quirk = (description: string): TraitDef => trait(description, -1, 'B162');
