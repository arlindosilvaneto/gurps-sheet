// Science fiction (TL10-11): starship crews, space marines, smugglers.
import { ARMOR, GEAR, MELEE_WEAPONS as M, RANGED_WEAPONS as R } from '../catalog/equipment.js';
import { SKILL_FAMILIES as F, SKILLS as S } from '../catalog/skills.js';
import { ADVANTAGES as A, DISADVANTAGES as D, quirk } from '../catalog/traits.js';
import { learn, nativeLanguage, npc } from '../define.js';

const standard = () => nativeLanguage('Galactic Standard');

export const scienceFiction = [
  npc({
    id: 'science-fiction-starship-pilot', style: 'science-fiction', name: 'Lt. Kira Valez', role: 'Starfighter pilot', threat: 'standard', budget: 150, techLevel: 10,
    profile: { age: '27', height: '1.66 m', weight: '57 kg', appearance: 'Flight suit covered in squadron patches' },
    attributes: { st: 10, dx: 14, iq: 12, ht: 11 },
    traits: [A.combatReflexes, A.absoluteDirection3D, D.duty('the Fleet', 15, true), D.overconfidence(), D.impulsiveness()],
    languages: [standard()],
    skills: [
      learn(S.pilotingHighPerformanceSpacecraft, 3), learn(S.freeFall, 0), learn(S.navigationSpace, 0), learn(S.gunnerBeams, 1),
      learn(S.beamWeaponsPistol, 2), learn(S.electronicsOperationSensors, 0), learn(S.vaccSuit, 0), learn(S.tactics, -1),
      learn(S.mechanicHighPerformanceSpacecraft, -1), learn(F.savoirFaire('Military'), 0),
    ],
    ranged: [R.laserPistol],
    armor: [ARMOR.ballisticVestTL10],
    gear: [GEAR.personalBasics],
    notes: ['Deadly in a cockpit, merely competent outside one.'],
  }),
  npc({
    id: 'science-fiction-space-marine', style: 'science-fiction', name: 'Cpl. Dax Brenner', role: 'Space marine', threat: 'boss', budget: 200, techLevel: 11,
    profile: { age: '29', height: '1.92 m', weight: '102 kg', appearance: 'Shaved head, unit tattoo, tactical suit' },
    attributes: { st: 13, dx: 14, iq: 10, ht: 14 },
    secondary: { hp: 15 },
    traits: [
      A.combatReflexes, A.highPainThreshold, A.veryFit, D.duty('the Marine Corps', 15, true), D.codeOfHonor("Soldier's"),
      D.bloodlust(), D.senseOfDuty('his squad', 'small group'),
    ],
    languages: [standard()],
    skills: [
      learn(S.beamWeaponsRifle, 3), learn(S.beamWeaponsPistol, 1), learn(S.battlesuit, 2), learn(S.soldier, 2), learn(S.tactics, 1),
      learn(S.freeFall, 0), learn(S.vaccSuit, 0), learn(S.knife, 2), learn(S.brawling, 2), learn(S.throwing, 0),
      learn(S.explosivesDemolition, 0), learn(S.firstAid, 0),
    ],
    parry: S.knife,
    melee: [M.largeKnife],
    ranged: [R.blasterRifle, R.blasterPistol],
    armor: [ARMOR.tacticalSuitTL11],
    gear: [GEAR.radioHeadset, GEAR.firstAidKit],
    notes: ['DR 40 everywhere: low-tech weapons barely scratch him.'],
  }),
  npc({
    id: 'science-fiction-ship-doctor', style: 'science-fiction', name: 'Dr. Amara Osei', role: "Ship's doctor", threat: 'non-combatant', budget: 100, techLevel: 10,
    profile: { age: '44', height: '1.68 m', weight: '63 kg', appearance: 'Medical scanner on her wrist, tired kind eyes' },
    attributes: { st: 9, dx: 11, iq: 14, ht: 10 },
    traits: [A.healer(1), A.empathySensitive, D.pacifismCannotHarmInnocents, D.honesty(), D.senseOfDuty('her patients', 'large group')],
    languages: [standard()],
    skills: [
      learn(S.physician, 1), learn(S.surgery, -1), learn(S.diagnosis, 0), learn(S.firstAid, 1), learn(S.pharmacySynthetic, -2),
      learn(S.electronicsOperationMedical, 0), learn(S.psychology, -2), learn(S.freeFall, -1), learn(S.vaccSuit, -1),
      learn(S.beamWeaponsPistol, 0),
    ],
    ranged: [R.electrolaserPistol],
    gear: [GEAR.firstAidKit, GEAR.personalBasics],
    notes: ['Carries an electrolaser to stun, never to kill.'],
  }),
  npc({
    id: 'science-fiction-smuggler', style: 'science-fiction', name: 'Jonah "Slick" Mercer', role: 'Smuggler captain', threat: 'standard', budget: 125, techLevel: 11,
    profile: { age: '36', height: '1.81 m', weight: '78 kg', appearance: 'Worn spacer jacket, easy smile, quick hands' },
    attributes: { st: 10, dx: 13, iq: 12, ht: 11 },
    traits: [A.luck, D.greed(), D.socialStigmaCriminalRecord, D.overconfidence(), quirk('Names every ship he flies "Lucky"')],
    languages: [standard()],
    skills: [
      learn(S.pilotingLowPerformanceSpacecraft, 1), learn(S.beamWeaponsPistol, 2), learn(S.fastTalk, 1), learn(S.smuggling, 1),
      learn(S.merchant, 0), learn(S.streetwise, 0), learn(S.gambling, -1), learn(S.freeFall, 0), learn(S.navigationSpace, -1),
      learn(S.fastDrawPistol, 0), learn(S.brawling, 0),
    ],
    parry: S.brawling,
    ranged: [R.blasterPistol],
    armor: [ARMOR.ballisticVestTL10],
    gear: [GEAR.holsterBelt, GEAR.personalBasics],
    notes: ['Shoots first when cornered, but would much rather make a deal.'],
  }),
  npc({
    id: 'science-fiction-engineer', style: 'science-fiction', name: 'Chief Tomas Rourke', role: 'Chief engineer', threat: 'non-combatant', budget: 100, techLevel: 10,
    profile: { age: '50', height: '1.79 m', weight: '92 kg', appearance: 'Grease-stained coveralls, a heavy spanner on his belt' },
    attributes: { st: 12, dx: 10, iq: 13, ht: 11 },
    traits: [A.artificer(1), D.stubbornness, D.workaholic, D.badTemper()],
    languages: [standard()],
    skills: [
      learn(S.mechanicFusionReactor, 1), learn(S.electronicsRepairSensors, 1), learn(S.armourySmallArms, 0), learn(S.freeFall, 0),
      learn(S.vaccSuit, 0), learn(S.beamWeaponsPistol, 0), learn(S.mechanicHighPerformanceSpacecraft, 0), learn(S.brawling, 0),
      learn(S.broadsword, 0),
    ],
    parry: S.broadsword,
    melee: [M.lightClub],
    ranged: [R.laserPistol],
    gear: [GEAR.toolKitElectronics, GEAR.toolKitMechanic],
    notes: ['Defends his engine room with a heavy spanner (light club); knows every crawlway aboard.'],
  }),
];
