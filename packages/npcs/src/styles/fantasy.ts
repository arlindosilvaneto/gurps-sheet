// Medieval fantasy (TL3): walled towns, mercenary companies, court magic.
import { ARMOR, GEAR, MELEE_WEAPONS as M, RANGED_WEAPONS as R, SHIELDS } from '../catalog/equipment.js';
import { SKILL_FAMILIES as F, SKILLS as S, SPELLS } from '../catalog/skills.js';
import { ADVANTAGES as A, DISADVANTAGES as D, quirk } from '../catalog/traits.js';
import { learn, nativeLanguage, npc } from '../define.js';

const common = (written: 'native' | 'none' = 'native') => nativeLanguage('Common', written);

export const fantasy = [
  npc({
    id: 'fantasy-town-guard', style: 'fantasy', name: 'Aldric Brenn', role: 'Town watchman', threat: 'mook', budget: 50, techLevel: 3,
    profile: { age: '27', height: '1.76 m', weight: '78 kg', appearance: 'Dented pot-helm, watch tabard over leather' },
    attributes: { st: 11, dx: 11, iq: 10, ht: 12 },
    traits: [A.fit, D.duty('Town Watch', 12), D.laziness, quirk('Gossips with every innkeeper')],
    languages: [common('none')],
    skills: [
      learn(S.spear, 2), learn(S.shield, 2), learn(S.brawling, 1), learn(S.knife, 0),
      learn(S.observation, 0), learn(F.areaKnowledge('Millbrook'), 0), learn(S.intimidation, -1),
    ],
    parry: S.spear, block: S.shield,
    melee: [M.spear, M.largeKnife],
    armor: [ARMOR.leatherArmor, ARMOR.potHelm, ARMOR.boots],
    gear: [SHIELDS.mediumShield, GEAR.personalBasics],
    notes: ['Works in pairs; blows a whistle and falls back to the gatehouse when outnumbered.'],
  }),
  npc({
    id: 'fantasy-mercenary-knight', style: 'fantasy', name: 'Ser Gareth of Highmoor', role: 'Mercenary knight', threat: 'boss', budget: 150, techLevel: 3,
    profile: { age: '38', height: '1.85 m', weight: '95 kg', appearance: 'Scarred face, faded heraldry of a dead lord' },
    attributes: { st: 13, dx: 13, iq: 10, ht: 12 },
    secondary: { hp: 15 },
    traits: [A.combatReflexes, A.highPainThreshold, A.status(1, 'Knight'), D.greed(), D.overconfidence(), D.stubbornness],
    languages: [common()],
    skills: [
      learn(S.broadsword, 3), learn(S.shield, 2), learn(S.ridingHorse, 1), learn(S.lance, 0), learn(S.leadership, 0),
      learn(S.tactics, 0), learn(F.savoirFaire('Military'), 0), learn(S.brawling, 0), learn(S.knife, 0),
    ],
    parry: S.broadsword, block: S.shield,
    melee: [M.broadsword, M.lance, M.dagger],
    armor: [ARMOR.mailHauberk, ARMOR.mailSleeves, ARMOR.mailLeggings, ARMOR.greathelm, ARMOR.gauntlets, ARMOR.boots],
    gear: [SHIELDS.mediumShield, GEAR.saddleAndTack, GEAR.personalBasics],
    notes: ['Sells his sword to the highest bidder, but never breaks a contract mid-battle.', 'Opens with a lance charge when mounted.'],
  }),
  npc({
    id: 'fantasy-court-wizard', style: 'fantasy', name: 'Magister Ilsabet Vonn', role: 'Court wizard', threat: 'boss', budget: 150, techLevel: 3,
    profile: { age: '46', height: '1.62 m', weight: '55 kg', appearance: 'Ink-stained fingers, silver-threaded robes' },
    attributes: { st: 9, dx: 10, iq: 14, ht: 10 },
    secondary: { will: 15, fp: 13 },
    traits: [A.magery(2), A.status(1, 'Court magister'), D.curious(), D.stubbornness, quirk('Talks to her cat as if it were a colleague')],
    languages: [common()],
    skills: [
      learn(SPELLS.igniteFire, 0), learn(SPELLS.createFire, -1), learn(SPELLS.shapeFire, -1), learn(SPELLS.fireball, 1),
      learn(SPELLS.light, -2), learn(SPELLS.continualLight, -2), learn(SPELLS.detectMagic, 0), learn(SPELLS.apportation, 0),
      learn(SPELLS.shield, 0), learn(S.thaumatology, -1), learn(S.occultism, 1), learn(S.research, 0), learn(S.staff, 1),
      learn(S.diplomacy, -1), learn(F.savoirFaire('High Society'), 0),
    ],
    parry: S.staff,
    melee: [M.quarterstaff],
    gear: [GEAR.personalBasics, GEAR.pouchSmall],
    notes: ['Casts Shield on herself first, then Fireball from behind the guards.'],
  }),
  npc({
    id: 'fantasy-forest-ranger', style: 'fantasy', name: 'Wren Ashdown', role: 'Forest ranger', threat: 'standard', budget: 100, techLevel: 3,
    profile: { age: '31', height: '1.70 m', weight: '62 kg', appearance: 'Green-brown cloak, quiet as moss' },
    attributes: { st: 11, dx: 12, iq: 11, ht: 11 },
    secondary: { per: 12 },
    traits: [A.acuteVision(1), A.absoluteDirection, D.loner(), D.senseOfDuty('the forest villages', 'small group'), quirk('Never sleeps under a roof')],
    languages: [common()],
    skills: [
      learn(S.bow, 1), learn(S.stealth, 0), learn(S.survivalWoodlands, 0), learn(S.tracking, 0), learn(S.camouflage, 0),
      learn(S.knife, 1), learn(S.shortsword, 0), learn(S.observation, 0), learn(S.climbing, -1), learn(S.fastDrawArrow, 0),
    ],
    parry: S.shortsword,
    melee: [M.shortsword, M.largeKnife],
    ranged: [R.longbow],
    armor: [ARMOR.leatherJacket, ARMOR.leatherPants, ARMOR.boots],
    gear: [GEAR.shoulderQuiver, GEAR.backpackSmall, GEAR.blanket, GEAR.travelersRations],
    notes: ['Shoots from cover at long range, then relocates; avoids melee.'],
  }),
  npc({
    id: 'fantasy-thief', style: 'fantasy', name: 'Nim "Quickfingers" Darrow', role: 'Guild cutpurse', threat: 'mook', budget: 75, techLevel: 3,
    profile: { age: '19', height: '1.58 m', weight: '50 kg', appearance: 'Wiry, too-big coat with many pockets' },
    attributes: { st: 10, dx: 13, iq: 11, ht: 10 },
    traits: [A.nightVision(1), D.greed(), D.socialStigmaCriminalRecord, D.overconfidence()],
    languages: [common()],
    skills: [
      learn(S.knife, 1), learn(S.thrownWeaponKnife, 0), learn(S.stealth, 0), learn(S.pickpocket, 0), learn(S.lockpicking, 0),
      learn(S.streetwise, 0), learn(S.climbing, 0), learn(S.filch, 0), learn(S.fastTalk, -1), learn(S.acrobatics, -2),
    ],
    parry: S.knife,
    melee: [M.dagger],
    ranged: [R.thrownDagger],
    armor: [ARMOR.leatherJacket],
    gear: [GEAR.lockpicks, GEAR.pouchSmall, GEAR.personalBasics],
    notes: ['Runs at the first sign of a fair fight; throws a dagger to cover the escape.'],
  }),
  npc({
    id: 'fantasy-temple-priest', style: 'fantasy', name: 'Brother Osric', role: 'Temple priest and healer', threat: 'non-combatant', budget: 75, techLevel: 3,
    profile: { age: '52', height: '1.72 m', weight: '70 kg', appearance: 'Shaven head, sun-bleached robes' },
    attributes: { st: 10, dx: 10, iq: 13, ht: 11 },
    traits: [
      A.clericalInvestment, A.healer(1), D.vow('celibacy', 'major'), D.honesty(), D.senseOfDuty('his congregation', 'small group'),
      D.pacifismReluctantKiller,
    ],
    languages: [common()],
    skills: [
      learn(F.theology('Church of the Dawn'), 0), learn(F.religiousRitual('Church of the Dawn'), 0), learn(S.firstAid, 0),
      learn(S.physician, -1), learn(S.diagnosis, -1), learn(S.staff, 0), learn(S.diplomacy, -1), learn(S.publicSpeaking, 0),
      learn(S.teaching, -1),
    ],
    parry: S.staff,
    melee: [M.quarterstaff],
    gear: [GEAR.firstAidKit, GEAR.personalBasics],
    notes: ['Tends the wounded of any side; only fights to protect the helpless.'],
  }),
];
