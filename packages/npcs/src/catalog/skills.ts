// Basic Set skills (pp. 174-228) and sample spells (pp. 242-253) used by the NPC library.
import type { Attribute, Difficulty, SkillDef } from './types.js';

type AttrDiff = `${Attribute}/${Difficulty}`;

function skill(base: string, attrDiff: AttrDiff, reference: string, specialty?: string, prereqs?: SkillDef['prereqs']): SkillDef {
  const [attribute, difficulty] = attrDiff.split('/') as [Attribute, Difficulty];
  return Object.freeze({
    name: specialty ? `${base} (${specialty})` : base, base, ...(specialty ? { specialty } : {}),
    attribute, difficulty, reference, kind: 'skill' as const, ...(prereqs ? { prereqs } : {}),
  });
}

function spell(name: string, difficulty: 'H' | 'VH', college: string, prereqs?: SkillDef['prereqs']): SkillDef {
  return Object.freeze({ name, base: name, attribute: 'iq' as const, difficulty, reference: 'B242-253', kind: 'spell' as const, college, ...(prereqs ? { prereqs } : {}) });
}

/** Skills whose specialty is free text (a place, a religion, a social group...). */
export const SKILL_FAMILIES = {
  areaKnowledge: (area: string) => skill('Area Knowledge', 'iq/E', 'B176', area),
  currentAffairs: (subject: string) => skill('Current Affairs', 'iq/E', 'B186', subject),
  hiddenLore: (subject: string) => skill('Hidden Lore', 'iq/A', 'B199', subject),
  history: (field: string) => skill('History', 'iq/H', 'B200', field),
  law: (field: string) => skill('Law', 'iq/H', 'B204', field),
  religiousRitual: (religion: string) => skill('Religious Ritual', 'iq/H', 'B217', religion),
  savoirFaire: (group: string) => skill('Savoir-Faire', 'iq/E', 'B218', group),
  theology: (religion: string) => skill('Theology', 'iq/H', 'B226', religion),
} as const;

export const SKILLS = {
  // ---- melee weapon skills (B208-209) and unarmed combat ----
  axeMace: skill('Axe/Mace', 'dx/A', 'B208'),
  brawling: skill('Brawling', 'dx/E', 'B182'),
  broadsword: skill('Broadsword', 'dx/A', 'B208'),
  karate: skill('Karate', 'dx/H', 'B203'),
  knife: skill('Knife', 'dx/E', 'B208'),
  lance: skill('Lance', 'dx/A', 'B204', undefined, { anyOf: [['Riding (Horse)']] }),
  rapier: skill('Rapier', 'dx/A', 'B208'),
  saber: skill('Saber', 'dx/A', 'B208'),
  shield: skill('Shield', 'dx/E', 'B220', 'Shield'),
  shortsword: skill('Shortsword', 'dx/A', 'B209'),
  smallsword: skill('Smallsword', 'dx/A', 'B208'),
  spear: skill('Spear', 'dx/A', 'B208'),
  staff: skill('Staff', 'dx/A', 'B208'),
  wrestling: skill('Wrestling', 'dx/A', 'B228'),

  // ---- ranged ----
  beamWeaponsPistol: skill('Beam Weapons', 'dx/E', 'B179', 'Pistol'),
  beamWeaponsRifle: skill('Beam Weapons', 'dx/E', 'B179', 'Rifle'),
  bow: skill('Bow', 'dx/A', 'B182'),
  fastDrawArrow: skill('Fast-Draw', 'dx/E', 'B194', 'Arrow'),
  fastDrawPistol: skill('Fast-Draw', 'dx/E', 'B194', 'Pistol'),
  fastDrawSword: skill('Fast-Draw', 'dx/E', 'B194', 'Sword'),
  gunnerBeams: skill('Gunner', 'dx/E', 'B198', 'Beams'),
  gunsPistol: skill('Guns', 'dx/E', 'B198', 'Pistol'),
  gunsRifle: skill('Guns', 'dx/E', 'B198', 'Rifle'),
  gunsShotgun: skill('Guns', 'dx/E', 'B198', 'Shotgun'),
  gunsSmg: skill('Guns', 'dx/E', 'B198', 'Submachine Gun'),
  throwing: skill('Throwing', 'dx/A', 'B226'),
  thrownWeaponKnife: skill('Thrown Weapon', 'dx/E', 'B226', 'Knife'),

  // ---- physical ----
  acrobatics: skill('Acrobatics', 'dx/H', 'B174'),
  battlesuit: skill('Battlesuit', 'dx/A', 'B192'),
  carousing: skill('Carousing', 'ht/E', 'B183'),
  climbing: skill('Climbing', 'dx/A', 'B183'),
  drivingAutomobile: skill('Driving', 'dx/A', 'B188', 'Automobile'),
  escape: skill('Escape', 'dx/H', 'B192'),
  filch: skill('Filch', 'dx/A', 'B195'),
  freeFall: skill('Free Fall', 'dx/A', 'B197'),
  lasso: skill('Lasso', 'dx/A', 'B204'),
  pickpocket: skill('Pickpocket', 'dx/H', 'B213'),
  pilotingHighPerformanceSpacecraft: skill('Piloting', 'dx/A', 'B214', 'High-Performance Spacecraft'),
  pilotingLowPerformanceSpacecraft: skill('Piloting', 'dx/A', 'B214', 'Low-Performance Spacecraft'),
  ridingHorse: skill('Riding', 'dx/A', 'B217', 'Horse'),
  sexAppeal: skill('Sex Appeal', 'ht/A', 'B219'),
  sleightOfHand: skill('Sleight of Hand', 'dx/H', 'B221'),
  stealth: skill('Stealth', 'dx/A', 'B222'),
  vaccSuit: skill('Vacc Suit', 'dx/A', 'B192'),

  // ---- perception ----
  bodyLanguage: skill('Body Language', 'per/A', 'B181'),
  detectLies: skill('Detect Lies', 'per/H', 'B187'),
  observation: skill('Observation', 'per/A', 'B211'),
  survivalDesert: skill('Survival', 'per/A', 'B223', 'Desert'),
  survivalPlains: skill('Survival', 'per/A', 'B223', 'Plains'),
  survivalWoodlands: skill('Survival', 'per/A', 'B223', 'Woodlands'),
  tracking: skill('Tracking', 'per/A', 'B226'),

  // ---- will ----
  exorcism: skill('Exorcism', 'will/H', 'B193'),
  intimidation: skill('Intimidation', 'will/A', 'B202'),

  // ---- mental ----
  acting: skill('Acting', 'iq/A', 'B174'),
  animalHandlingEquines: skill('Animal Handling', 'iq/A', 'B175', 'Equines'),
  archaeology: skill('Archaeology', 'iq/H', 'B176'),
  armourySmallArms: skill('Armoury', 'iq/A', 'B178', 'Small Arms'),
  camouflage: skill('Camouflage', 'iq/E', 'B183'),
  computerHacking: skill('Computer Hacking', 'iq/VH', 'B184', undefined, { anyOf: [['Computer Programming']] }),
  computerOperation: skill('Computer Operation', 'iq/E', 'B184'),
  computerProgramming: skill('Computer Programming', 'iq/H', 'B184'),
  criminology: skill('Criminology', 'iq/A', 'B186'),
  cryptography: skill('Cryptography', 'iq/H', 'B186'),
  diagnosis: skill('Diagnosis', 'iq/H', 'B187'),
  diplomacy: skill('Diplomacy', 'iq/H', 'B187'),
  disguise: skill('Disguise', 'iq/A', 'B187'),
  electronicsOperationCommunications: skill('Electronics Operation', 'iq/A', 'B189', 'Communications'),
  electronicsOperationMedical: skill('Electronics Operation', 'iq/A', 'B189', 'Medical'),
  electronicsOperationSecurity: skill('Electronics Operation', 'iq/A', 'B189', 'Security'),
  electronicsOperationSensors: skill('Electronics Operation', 'iq/A', 'B189', 'Sensors'),
  electronicsRepairComputers: skill('Electronics Repair', 'iq/A', 'B190', 'Computers'),
  electronicsRepairSensors: skill('Electronics Repair', 'iq/A', 'B190', 'Sensors'),
  explosivesDemolition: skill('Explosives', 'iq/A', 'B194', 'Demolition'),
  fastTalk: skill('Fast-Talk', 'iq/A', 'B195'),
  firstAid: skill('First Aid', 'iq/E', 'B195'),
  gambling: skill('Gambling', 'iq/A', 'B197'),
  holdout: skill('Holdout', 'iq/A', 'B200'),
  hypnotism: skill('Hypnotism', 'iq/H', 'B201'),
  interrogation: skill('Interrogation', 'iq/A', 'B202'),
  leadership: skill('Leadership', 'iq/A', 'B204'),
  lockpicking: skill('Lockpicking', 'iq/A', 'B206'),
  mechanicFusionReactor: skill('Mechanic', 'iq/A', 'B207', 'Fusion Reactor'),
  mechanicHighPerformanceSpacecraft: skill('Mechanic', 'iq/A', 'B207', 'High-Performance Spacecraft'),
  merchant: skill('Merchant', 'iq/A', 'B209'),
  navigationLand: skill('Navigation', 'iq/A', 'B211', 'Land'),
  navigationSea: skill('Navigation', 'iq/A', 'B211', 'Sea'),
  navigationSpace: skill('Navigation', 'iq/A', 'B211', 'Space'),
  occultism: skill('Occultism', 'iq/A', 'B212'),
  pharmacySynthetic: skill('Pharmacy', 'iq/H', 'B213', 'Synthetic'),
  physician: skill('Physician', 'iq/H', 'B213'),
  poisons: skill('Poisons', 'iq/H', 'B214'),
  psychology: skill('Psychology', 'iq/H', 'B216'),
  publicSpeaking: skill('Public Speaking', 'iq/A', 'B216'),
  research: skill('Research', 'iq/A', 'B217'),
  seamanship: skill('Seamanship', 'iq/E', 'B185'),
  shadowing: skill('Shadowing', 'iq/A', 'B219'),
  smuggling: skill('Smuggling', 'iq/A', 'B221'),
  soldier: skill('Soldier', 'iq/A', 'B221'),
  streetwise: skill('Streetwise', 'iq/A', 'B223'),
  surgery: skill('Surgery', 'iq/VH', 'B223', undefined, { anyOf: [['First Aid', 'Physician']] }),
  tactics: skill('Tactics', 'iq/H', 'B224'),
  teaching: skill('Teaching', 'iq/A', 'B224'),
  thaumatology: skill('Thaumatology', 'iq/VH', 'B225'),
  weatherSense: skill('Weather Sense', 'iq/A', 'B209'),
  writing: skill('Writing', 'iq/A', 'B228'),
} as const;

/** Sample spells from the Basic Set (pp. 242-253), with their prerequisites. */
export const SPELLS = {
  apportation: spell('Apportation', 'H', 'Movement', { magery: 1 }),
  continualLight: spell('Continual Light', 'H', 'Light and Darkness', { anyOf: [['Light']] }),
  createFire: spell('Create Fire', 'H', 'Fire', { anyOf: [['Ignite Fire']] }),
  detectMagic: spell('Detect Magic', 'H', 'Knowledge', { magery: 1 }),
  fireball: spell('Fireball', 'H', 'Fire', { magery: 1, anyOf: [['Create Fire'], ['Shape Fire']] }),
  igniteFire: spell('Ignite Fire', 'H', 'Fire'),
  light: spell('Light', 'H', 'Light and Darkness'),
  shapeFire: spell('Shape Fire', 'H', 'Fire', { anyOf: [['Ignite Fire']] }),
  shield: spell('Shield', 'H', 'Protection and Warning', { magery: 2 }),
} as const;
