// Wild West (TL5, 1870s): gunslingers, marshals, outlaws, card sharps and frontier scouts.
import { ARMOR, GEAR, MELEE_WEAPONS as M, RANGED_WEAPONS as R } from '../catalog/equipment.js';
import { SKILL_FAMILIES as F, SKILLS as S } from '../catalog/skills.js';
import { ADVANTAGES as A, DISADVANTAGES as D, quirk } from '../catalog/traits.js';
import { learn, nativeLanguage, npc } from '../define.js';

const english = (written: 'native' | 'none' = 'native') => nativeLanguage('English', written);

export const western = [
  npc({
    id: 'western-gunslinger', style: 'western', name: '"Dead-Eye" Dalton Pike', role: 'Gunslinger', threat: 'boss', budget: 150, techLevel: 5,
    profile: { age: '33', height: '1.83 m', weight: '75 kg', appearance: 'Duster coat, two low-slung holsters, cold gray eyes' },
    attributes: { st: 11, dx: 14, iq: 11, ht: 12 },
    traits: [A.combatReflexes, A.fearlessness(2), D.badTemper(), D.bloodlust(), D.overconfidence(), quirk('Notches his gun belt')],
    languages: [english()],
    skills: [
      learn(S.gunsPistol, 3), learn(S.fastDrawPistol, 2), learn(S.gunsRifle, 1), learn(S.ridingHorse, 1), learn(S.gambling, 0),
      learn(S.intimidation, 1), learn(S.brawling, 0), learn(S.knife, 1),
    ],
    parry: S.brawling,
    melee: [M.largeKnife],
    ranged: [R.revolver36, R.revolver36, R.leverActionCarbine],
    armor: [ARMOR.boots],
    gear: [GEAR.holsterBelt, GEAR.holsterBelt, GEAR.saddleAndTack],
    notes: ['Fast-draws and fires before anyone else moves; never backs down from a showdown.'],
  }),
  npc({
    id: 'western-marshal', style: 'western', name: 'Marshal Ezra Holloway', role: 'Town marshal', threat: 'standard', budget: 125, techLevel: 5,
    profile: { age: '45', height: '1.80 m', weight: '84 kg', appearance: 'Tin star, gray mustache, steady hands' },
    attributes: { st: 12, dx: 13, iq: 11, ht: 12 },
    traits: [
      A.combatReflexes, A.legalEnforcementPowers(5, 'town marshal'), D.duty('the town of Red Mesa', 12), D.honesty(),
      D.senseOfDuty('the townsfolk', 'large group'), D.stubbornness,
    ],
    languages: [english()],
    skills: [
      learn(S.gunsRifle, 2), learn(S.gunsPistol, 1), learn(S.ridingHorse, 0), learn(S.tracking, 0), learn(S.leadership, 0),
      learn(S.intimidation, 0), learn(F.law('Territorial'), -2), learn(S.brawling, 1), learn(S.fastDrawPistol, 0), learn(S.interrogation, -1),
      learn(S.gunsShotgun, 0),
    ],
    parry: S.brawling,
    ranged: [R.leverActionCarbine, R.revolver36, R.doubleShotgun],
    armor: [ARMOR.boots],
    gear: [GEAR.handcuffs, GEAR.holsterBelt, GEAR.saddleAndTack],
    notes: ['Talks first, deputizes the townsfolk if he must, and keeps the shotgun for the jailhouse door.'],
  }),
  npc({
    id: 'western-outlaw', style: 'western', name: 'Black Tom Slade', role: 'Outlaw', threat: 'mook', budget: 75, techLevel: 5,
    profile: { age: '29', height: '1.75 m', weight: '80 kg', appearance: 'Bandana over the face, stained hat' },
    attributes: { st: 13, dx: 12, iq: 10, ht: 12 },
    traits: [A.hardToKill(1), D.greed(), D.socialStigmaCriminalRecord, D.alcoholism],
    languages: [english('none')],
    skills: [
      learn(S.gunsShotgun, 2), learn(S.gunsPistol, 0), learn(S.ridingHorse, 1), learn(S.lasso, 0), learn(S.animalHandlingEquines, -1),
      learn(S.brawling, 2), learn(S.knife, 0), learn(S.stealth, -1), learn(S.survivalDesert, -1), learn(S.intimidation, 0),
    ],
    parry: S.brawling,
    melee: [M.largeKnife],
    ranged: [R.doubleShotgun, R.revolver36],
    gear: [GEAR.saddleAndTack, GEAR.personalBasics],
    notes: ['Rides with a gang of four like him; opens with both barrels.'],
  }),
  npc({
    id: 'western-gambler', style: 'western', name: 'Lucien "Lucky" Beaumont', role: 'Riverboat gambler', threat: 'non-combatant', budget: 100, techLevel: 5,
    profile: { age: '37', height: '1.78 m', weight: '70 kg', appearance: 'Silk vest, pocket watch, well-trimmed beard' },
    attributes: { st: 10, dx: 12, iq: 12, ht: 10 },
    traits: [A.luck, A.attractive, D.compulsiveGambling(), D.overconfidence(), D.secret('cheats at cards', 'serious embarrassment')],
    languages: [english()],
    skills: [
      learn(S.gambling, 1), learn(S.sleightOfHand, -1), learn(S.fastTalk, 0), learn(S.detectLies, -1), learn(F.savoirFaire('High Society'), 0),
      learn(S.carousing, 0), learn(S.gunsPistol, 0), learn(S.holdout, 0), learn(S.fastDrawPistol, 0),
    ],
    ranged: [R.derringer],
    gear: [GEAR.personalBasics],
    notes: ['Talks his way out of trouble; the derringer up his sleeve is the last resort.'],
  }),
  npc({
    id: 'western-scout', style: 'western', name: 'Abigail Thorne', role: 'Frontier scout', threat: 'standard', budget: 100, techLevel: 5,
    profile: { age: '28', height: '1.68 m', weight: '60 kg', appearance: 'Buckskin jacket, long rifle, sunburned face' },
    attributes: { st: 11, dx: 12, iq: 11, ht: 12 },
    secondary: { per: 12 },
    traits: [A.absoluteDirection, D.loner(), D.stubbornness, D.senseOfDuty('the wagon trains she guides', 'small group')],
    languages: [english()],
    skills: [
      learn(S.gunsRifle, 2), learn(S.tracking, 0), learn(S.survivalPlains, 0), learn(S.ridingHorse, 0), learn(S.stealth, 0),
      learn(S.navigationLand, -1), learn(S.knife, 0), learn(S.firstAid, 0),
    ],
    parry: S.knife,
    melee: [M.largeKnife],
    ranged: [R.cartridgeRifle],
    gear: [GEAR.saddleAndTack, GEAR.blanket, GEAR.travelersRations],
    notes: ['Never lost; picks off pursuers at long range with the rifle.'],
  }),
];
