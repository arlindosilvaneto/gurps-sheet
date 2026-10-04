// Modern action and espionage (TL8): street crime, police, special forces, spies and hackers.
import { ARMOR, GEAR, MELEE_WEAPONS as M, RANGED_WEAPONS as R } from '../catalog/equipment.js';
import { SKILL_FAMILIES as F, SKILLS as S } from '../catalog/skills.js';
import { ADVANTAGES as A, DISADVANTAGES as D, quirk } from '../catalog/traits.js';
import { language, learn, nativeLanguage, npc } from '../define.js';

const english = () => nativeLanguage('English');

export const modern = [
  npc({
    id: 'modern-street-thug', style: 'modern', name: 'Rico Vance', role: 'Street thug', threat: 'mook', budget: 25, techLevel: 8,
    profile: { age: '22', height: '1.77 m', weight: '76 kg', appearance: 'Hoodie, gold chain, knuckle tattoos' },
    attributes: { st: 11, dx: 11, iq: 9, ht: 12 },
    traits: [D.bully(), D.socialStigmaCriminalRecord],
    languages: [english()],
    skills: [
      learn(S.brawling, 1), learn(S.knife, 1), learn(S.gunsPistol, 0), learn(S.streetwise, 0), learn(S.intimidation, 0),
      learn(S.drivingAutomobile, -1),
    ],
    parry: S.knife,
    melee: [M.largeKnife, M.brassKnuckles],
    ranged: [R.holdoutPistol],
    gear: [GEAR.cellPhone],
    notes: ['Brave in a crowd, runs when the first friend goes down.'],
  }),
  npc({
    id: 'modern-police-officer', style: 'modern', name: 'Officer Dana Kowalski', role: 'Patrol officer', threat: 'standard', budget: 75, techLevel: 8,
    profile: { age: '31', height: '1.70 m', weight: '65 kg', appearance: 'Uniform, body armor, radio on the shoulder' },
    attributes: { st: 11, dx: 12, iq: 11, ht: 11 },
    traits: [A.legalEnforcementPowers(5, 'city police'), D.duty('Metro PD', 15), D.honesty(), D.senseOfDuty('her partner', 'individual')],
    languages: [english()],
    skills: [
      learn(S.gunsPistol, 2), learn(S.shortsword, 0), learn(S.brawling, 1), learn(S.drivingAutomobile, 0), learn(S.criminology, 0),
      learn(F.law('Police'), -2), learn(S.observation, 0), learn(S.firstAid, 0), learn(S.fastDrawPistol, 0),
    ],
    parry: S.shortsword,
    melee: [M.baton],
    ranged: [R.autoPistol40],
    armor: [ARMOR.ballisticVest],
    gear: [GEAR.handcuffs, GEAR.holsterBelt, GEAR.radioHand, GEAR.flashlightHeavy],
    notes: ['Calls for backup, then gives a verbal warning; draws only when lives are at stake.'],
  }),
  npc({
    id: 'modern-special-forces', style: 'modern', name: 'Sgt. Marcus Okafor', role: 'Special forces soldier', threat: 'boss', budget: 150, techLevel: 8,
    profile: { age: '30', height: '1.86 m', weight: '88 kg', appearance: 'Plate carrier, night-vision mount, calm voice' },
    attributes: { st: 12, dx: 13, iq: 11, ht: 12 },
    secondary: { per: 12 },
    traits: [
      A.combatReflexes, A.fit, A.highPainThreshold, D.duty('the Army', 15, true), D.codeOfHonor("Soldier's"),
      D.senseOfDuty('his squad', 'small group'),
    ],
    languages: [english()],
    skills: [
      learn(S.gunsRifle, 3), learn(S.gunsPistol, 1), learn(S.soldier, 1), learn(S.tactics, 0), learn(S.knife, 1), learn(S.brawling, 1),
      learn(S.stealth, 0), learn(S.throwing, 0), learn(S.explosivesDemolition, -1), learn(S.firstAid, 0), learn(S.navigationLand, -1),
      learn(S.electronicsOperationCommunications, -1),
    ],
    parry: S.knife,
    melee: [M.largeKnife],
    ranged: [R.assaultCarbine, R.autoPistol9mm, R.fragGrenade],
    armor: [ARMOR.tacticalVest, ARMOR.ballisticHelmet, ARMOR.reinforcedBoots],
    gear: [GEAR.radioHeadset, GEAR.nightVisionGoggles, GEAR.firstAidKit, GEAR.backpackSmall],
    notes: ['Moves in bounds with his fire team; uses grenades on fortified positions.'],
  }),
  npc({
    id: 'modern-spy', style: 'modern', name: 'Natalia Reyes', role: 'Intelligence officer', threat: 'boss', budget: 200, techLevel: 8,
    profile: { age: '35', height: '1.69 m', weight: '58 kg', appearance: 'Elegant, forgettable when she wants to be' },
    attributes: { st: 10, dx: 14, iq: 13, ht: 11 },
    secondary: { per: 14 },
    traits: [
      A.combatReflexes, A.attractive, A.dangerSense, D.duty('the Agency', 12), D.secret('double agent', 'possible death'),
      quirk('Always sits facing the door'),
    ],
    languages: [english(), language('Russian', 'accented', 'accented')],
    skills: [
      learn(S.gunsPistol, 3), learn(S.karate, 1), learn(S.stealth, 2), learn(S.acting, 2), learn(F.savoirFaire('High Society'), 0),
      learn(S.electronicsOperationSecurity, 0), learn(S.lockpicking, 0), learn(S.holdout, 0), learn(S.drivingAutomobile, 0),
      learn(S.disguise, 0), learn(S.fastDrawPistol, 0), learn(S.shadowing, 0), learn(S.observation, 0),
    ],
    parry: S.karate,
    ranged: [R.autoPistol40],
    gear: [GEAR.holsterShoulder, GEAR.cellPhone, GEAR.lockpicks],
    notes: ['Avoids fights she cannot finish in seconds; Karate for close quarters, the pistol for everything else.'],
  }),
  npc({
    id: 'modern-hacker', style: 'modern', name: 'Theo "Null" Park', role: 'Hacker', threat: 'non-combatant', budget: 75, techLevel: 8,
    profile: { age: '24', height: '1.74 m', weight: '61 kg', appearance: 'Headphones, energy drinks, three-day stubble' },
    attributes: { st: 9, dx: 10, iq: 14, ht: 10 },
    traits: [A.lightningCalculator, A.singleMinded, D.curious(), D.overconfidence(), D.insomniacMild],
    languages: [english()],
    skills: [
      learn(S.computerHacking, -1), learn(S.computerProgramming, 0), learn(S.computerOperation, 1),
      learn(S.electronicsOperationCommunications, -1), learn(S.electronicsRepairComputers, 0), learn(S.research, 0),
      learn(F.currentAffairs('Science & Technology'), 0), learn(S.cryptography, -1),
    ],
    gear: [GEAR.laptop, GEAR.cellPhone, GEAR.backpackSmall],
    notes: ['Unarmed; surrenders at once and then tries to bargain with what he knows.'],
  }),
  npc({
    id: 'modern-mob-enforcer', style: 'modern', name: 'Vincent "The Ox" Moretti', role: 'Mob enforcer', threat: 'standard', budget: 100, techLevel: 8,
    profile: { age: '39', height: '1.88 m', weight: '115 kg', appearance: 'Tailored suit stretched over a boxer\'s build' },
    attributes: { st: 14, dx: 11, iq: 10, ht: 12 },
    secondary: { hp: 16 },
    traits: [A.highPainThreshold, D.callous, D.bully(), D.socialStigmaCriminalRecord],
    languages: [english()],
    skills: [
      learn(S.gunsSmg, 1), learn(S.gunsPistol, 1), learn(S.brawling, 2), learn(S.intimidation, 2), learn(S.streetwise, 1),
      learn(S.drivingAutomobile, 0), learn(S.broadsword, 0), learn(F.savoirFaire('Mafia'), 0), learn(S.interrogation, -1),
    ],
    parry: S.brawling,
    melee: [M.lightClub],
    ranged: [R.smg9mm, R.revolver357],
    gear: [GEAR.holsterShoulder, GEAR.cellPhone],
    notes: ['Breaks knees with a baseball bat (light club); the SMG comes out for real business.'],
  }),
];
