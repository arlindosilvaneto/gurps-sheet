// Swashbuckling (TL4, 17th century): musketeers, pirates, spies of the Cardinal, highwaymen.
import { ARMOR, GEAR, MELEE_WEAPONS as M, RANGED_WEAPONS as R } from '../catalog/equipment.js';
import { SKILL_FAMILIES as F, SKILLS as S } from '../catalog/skills.js';
import { ADVANTAGES as A, DISADVANTAGES as D, quirk } from '../catalog/traits.js';
import { language, learn, nativeLanguage, npc } from '../define.js';

export const swashbuckling = [
  npc({
    id: 'swashbuckling-musketeer', style: 'swashbuckling', name: 'Henri de Valcourt', role: "King's Musketeer", threat: 'standard', budget: 125, techLevel: 4,
    profile: { age: '26', height: '1.80 m', weight: '74 kg', appearance: 'Blue tabard with silver cross, magnificent mustache' },
    attributes: { st: 11, dx: 14, iq: 10, ht: 11 },
    secondary: { per: 11 },
    traits: [
      A.combatReflexes, A.attractive, A.status(1, 'Gentleman'), D.codeOfHonor("Gentleman's"), D.duty("the King's Musketeers", 12),
      D.overconfidence(), quirk('Duels anyone who mocks his hat'),
    ],
    languages: [nativeLanguage('French')],
    skills: [
      learn(S.rapier, 3), learn(S.knife, 1), learn(S.gunsPistol, 1), learn(S.ridingHorse, 0), learn(F.savoirFaire('High Society'), 0),
      learn(S.carousing, 0), learn(S.fastDrawSword, 0), learn(S.brawling, 0),
    ],
    parry: S.rapier,
    melee: [M.rapier, M.dagger],
    ranged: [R.flintlockPistol],
    armor: [ARMOR.buffCoat, ARMOR.boots],
    gear: [GEAR.personalBasics],
    notes: ['Fires his pistol once, then closes with the rapier; always fights for the honor of the regiment.'],
  }),
  npc({
    id: 'swashbuckling-pirate-captain', style: 'swashbuckling', name: 'Captain Bess Harrow', role: 'Pirate captain', threat: 'boss', budget: 150, techLevel: 4,
    profile: { age: '34', height: '1.73 m', weight: '66 kg', appearance: 'Red coat, a brace of pistols, gold earring' },
    attributes: { st: 12, dx: 13, iq: 12, ht: 12 },
    traits: [A.combatReflexes, A.charisma(1), D.codeOfHonor("Pirate's"), D.greed(), D.badTemper(), quirk('Keeps a journal of every prize taken')],
    languages: [nativeLanguage('English'), language('Spanish', 'broken', 'none')],
    skills: [
      learn(S.shortsword, 2), learn(S.gunsPistol, 0), learn(S.leadership, 1), learn(S.seamanship, 1), learn(S.navigationSea, -1),
      learn(S.intimidation, 0), learn(S.brawling, 0), learn(S.knife, 0),
    ],
    parry: S.shortsword,
    melee: [M.cutlass, M.largeKnife],
    ranged: [R.flintlockPistol, R.flintlockPistol],
    armor: [ARMOR.leatherJacket, ARMOR.boots],
    gear: [GEAR.personalBasics],
    notes: ['Two loaded pistols for the boarding; leads from the front with the cutlass.'],
  }),
  npc({
    id: 'swashbuckling-bosun', style: 'swashbuckling', name: 'Grogan "Ironhand" Mace', role: "Ship's bosun", threat: 'standard', budget: 75, techLevel: 4,
    profile: { age: '41', height: '1.90 m', weight: '110 kg', appearance: 'Bald, tattooed forearms, missing two teeth' },
    attributes: { st: 14, dx: 11, iq: 9, ht: 12 },
    secondary: { hp: 16 },
    traits: [A.highPainThreshold, A.hardToKill(2), D.bully(), D.odiousPersonalHabit('spits and swears constantly', 1)],
    languages: [nativeLanguage('English', 'none')],
    skills: [
      learn(S.brawling, 2), learn(S.broadsword, 1), learn(S.seamanship, 0), learn(S.intimidation, 1), learn(S.wrestling, -1),
      learn(S.knife, 0),
    ],
    parry: S.brawling,
    melee: [M.lightClub, M.brassKnuckles, M.largeKnife],
    gear: [GEAR.personalBasics],
    notes: ['Fights with a belaying pin (light club); grapples anyone who gets close.'],
  }),
  npc({
    id: 'swashbuckling-cardinals-spy', style: 'swashbuckling', name: 'Madame Corvina Lestrange', role: "The Cardinal's spy", threat: 'standard', budget: 125, techLevel: 4,
    profile: { age: '29', height: '1.65 m', weight: '54 kg', appearance: 'Black lace, a fan, a smile that never reaches her eyes' },
    attributes: { st: 9, dx: 12, iq: 13, ht: 10 },
    secondary: { per: 14 },
    traits: [A.attractive, A.eideticMemory, A.voice, D.secret("agent of the Cardinal", 'possible death'), D.selfish()],
    languages: [nativeLanguage('French'), language('English', 'accented', 'accented')],
    skills: [
      learn(S.smallsword, 2), learn(S.acting, 1), learn(S.disguise, 1), learn(S.holdout, 0), learn(F.savoirFaire('High Society'), 1),
      learn(S.fastTalk, 1), learn(S.sexAppeal, 1), learn(S.poisons, 0), learn(S.stealth, 1), learn(S.lockpicking, -1),
      learn(S.detectLies, 0), learn(S.knife, 0),
    ],
    parry: S.smallsword,
    melee: [M.smallsword, M.dagger],
    gear: [GEAR.lockpicks, GEAR.pouchSmall, GEAR.personalBasics],
    notes: ['Prefers poison and blackmail to steel; carries a smallsword hidden in a walking cane.'],
  }),
  npc({
    id: 'swashbuckling-highwayman', style: 'swashbuckling', name: 'Jack Ravensworth', role: 'Highwayman', threat: 'standard', budget: 100, techLevel: 4,
    profile: { age: '24', height: '1.78 m', weight: '72 kg', appearance: 'Black mask, tricorn hat, roguish grin' },
    attributes: { st: 11, dx: 12, iq: 11, ht: 11 },
    traits: [A.daredevil, D.impulsiveness(), D.overconfidence(), D.socialStigmaCriminalRecord],
    languages: [nativeLanguage('English')],
    skills: [
      learn(S.ridingHorse, 1), learn(S.gunsPistol, 3), learn(S.saber, 1), learn(S.fastDrawPistol, 1), learn(S.intimidation, 0),
      learn(S.animalHandlingEquines, -1), learn(S.stealth, 0), learn(F.areaKnowledge('the King\'s Road'), 0), learn(S.carousing, 0),
    ],
    parry: S.saber,
    melee: [M.saber],
    ranged: [R.flintlockPistol],
    gear: [GEAR.saddleAndTack, GEAR.personalBasics],
    notes: ['"Stand and deliver!" Robs coaches at dusk and escapes on horseback rather than fight.'],
  }),
];
