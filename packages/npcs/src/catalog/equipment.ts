// Basic Set weapons (pp. 271-281), armor and shields (pp. 282-287) and gear (pp. 288-289) used by the NPC library.
// Stats are the tables' own: pounds and yards (the builder converts to the metric sheet: 1 lb = 0.5 kg, 1 yd = 1 m).
import { SKILLS } from './skills.js';
import type { ArmorDef, GearDef, MeleeWeaponDef, RangedWeaponDef } from './types.js';

const melee = (w: MeleeWeaponDef): MeleeWeaponDef => Object.freeze(w);
const ranged = (w: RangedWeaponDef): RangedWeaponDef => Object.freeze(w);
const armor = (a: ArmorDef): ArmorDef => Object.freeze(a);
const gear = (g: GearDef): GearDef => Object.freeze(g);

export const MELEE_WEAPONS = {
  baton: melee({ name: 'Baton', reference: 'B273', techLevel: 0, skill: SKILLS.shortsword, damage: ['sw cr', 'thr cr'], reach: '1', parry: '0', minST: '6', cost: 20, weightLb: 1 }),
  brassKnuckles: melee({ name: 'Brass Knuckles', reference: 'B271', techLevel: 1, skill: SKILLS.brawling, damage: ['thr cr'], reach: 'C', parry: '0', cost: 10, weightLb: 0.25 }),
  broadsword: melee({ name: 'Broadsword', reference: 'B271', techLevel: 2, skill: SKILLS.broadsword, damage: ['sw+1 cut', 'thr+1 cr'], reach: '1', parry: '0', minST: '10', cost: 500, weightLb: 3 }),
  cutlass: melee({ name: 'Cutlass', reference: 'B273', techLevel: 4, skill: SKILLS.shortsword, damage: ['sw cut', 'thr imp'], reach: '1', parry: '0', minST: '8', cost: 300, weightLb: 2 }),
  dagger: melee({ name: 'Dagger', reference: 'B272', techLevel: 1, skill: SKILLS.knife, damage: ['thr-1 imp'], reach: 'C', parry: '-1', minST: '5', cost: 20, weightLb: 0.25 }),
  hatchet: melee({ name: 'Hatchet', reference: 'B271', techLevel: 0, skill: SKILLS.axeMace, damage: ['sw cut'], reach: '1', parry: '0', minST: '8', cost: 40, weightLb: 2 }),
  lance: melee({ name: 'Lance', reference: 'B272', techLevel: 2, skill: SKILLS.lance, damage: ['thr+3 imp'], reach: '4', parry: 'No', minST: '12', cost: 60, weightLb: 6 }),
  largeKnife: melee({ name: 'Large Knife', reference: 'B272', techLevel: 0, skill: SKILLS.knife, damage: ['sw-2 cut', 'thr imp'], reach: 'C,1', parry: '-1', minST: '6', cost: 40, weightLb: 1 }),
  lightClub: melee({ name: 'Light Club', reference: 'B271', techLevel: 0, skill: SKILLS.broadsword, damage: ['sw+1 cr', 'thr+1 cr'], reach: '1', parry: '0', minST: '10', cost: 5, weightLb: 3 }),
  quarterstaff: melee({ name: 'Quarterstaff', reference: 'B273', techLevel: 0, skill: SKILLS.staff, damage: ['sw+2 cr', 'thr+2 cr'], reach: '1,2', parry: '+2', minST: '7†', cost: 10, weightLb: 4 }),
  rapier: melee({ name: 'Rapier', reference: 'B273', techLevel: 4, skill: SKILLS.rapier, damage: ['thr+1 imp'], reach: '1,2', parry: '0F', minST: '9', cost: 500, weightLb: 2.75 }),
  saber: melee({ name: 'Saber', reference: 'B273', techLevel: 4, skill: SKILLS.saber, damage: ['sw-1 cut', 'thr+1 imp'], reach: '1', parry: '0F', minST: '8', cost: 700, weightLb: 2 }),
  shortsword: melee({ name: 'Shortsword', reference: 'B273', techLevel: 2, skill: SKILLS.shortsword, damage: ['sw cut', 'thr imp'], reach: '1', parry: '0', minST: '8', cost: 400, weightLb: 2 }),
  smallKnife: melee({ name: 'Small Knife', reference: 'B272', techLevel: 0, skill: SKILLS.knife, damage: ['sw-3 cut', 'thr-1 imp'], reach: 'C,1', parry: '-1', minST: '5', cost: 30, weightLb: 0.5 }),
  smallsword: melee({ name: 'Smallsword', reference: 'B273', techLevel: 4, skill: SKILLS.smallsword, damage: ['thr+1 imp'], reach: '1', parry: '0F', minST: '5', cost: 400, weightLb: 1.5 }),
  spear: melee({ name: 'Spear', reference: 'B273', techLevel: 0, skill: SKILLS.spear, damage: ['thr+2 imp'], reach: '1*', parry: '0', minST: '9', cost: 40, weightLb: 4 }),
  /** Armor divisor (0.5): the notation is kept as text. */
  woodenStake: melee({ name: 'Wooden Stake', reference: 'B272', techLevel: 0, skill: SKILLS.knife, damage: ['thr(0.5) imp'], reach: 'C', parry: '-1', minST: '5', cost: 4, weightLb: 0.5 }),
} as const;

const noLC = null;
export const RANGED_WEAPONS = {
  // ---- muscle-powered (B275-276): range in multiples of ST ----
  longbow: ranged({ name: 'Longbow', reference: 'B275', techLevel: 0, skill: SKILLS.bow, damage: 'thr+2 imp', accuracy: '3', range: 'x15/x20', rateOfFire: '1', shots: '1(2)', minST: '11†', bulk: -8, recoil: null, legalityClass: noLC, cost: 200, weightLb: 3 }),
  thrownDagger: ranged({ name: 'Dagger (thrown)', reference: 'B272', techLevel: 1, skill: SKILLS.thrownWeaponKnife, damage: 'thr-1 imp', accuracy: '0', range: 'x0.5/x1', rateOfFire: '1', shots: 'T(1)', minST: '5', bulk: -1, recoil: null, legalityClass: noLC, cost: 20, weightLb: 0.25 }),
  // ---- grenades (B277): thrown with Throwing ----
  fragGrenade: ranged({ name: 'Hand Grenade, Fragmentation', reference: 'B277', techLevel: 7, skill: SKILLS.throwing, damage: '8d cr ex [3d cut]', accuracy: '0', range: 'x3.5', rateOfFire: '1', shots: '1', bulk: null, recoil: null, legalityClass: 2, cost: 40, weightLb: 1 }),
  // ---- firearms (B278-279) ----
  flintlockPistol: ranged({ name: 'Flintlock Pistol, .51', reference: 'B278', techLevel: 4, skill: SKILLS.gunsPistol, damage: '2d-1 pi+', accuracy: '1', range: '75/450', rateOfFire: '1', shots: '1(20)', minST: '10', bulk: -3, recoil: 2, legalityClass: 3, cost: 200, weightLb: 3 }),
  derringer: ranged({ name: 'Derringer, .41', reference: 'B278', techLevel: 5, skill: SKILLS.gunsPistol, damage: '1d pi+', accuracy: '1', range: '80/650', rateOfFire: '1', shots: '2(3i)', minST: '9', bulk: -1, recoil: 2, legalityClass: 3, cost: 100, weightLb: 0.5 }),
  revolver36: ranged({ name: 'Revolver, .36', reference: 'B278', techLevel: 5, skill: SKILLS.gunsPistol, damage: '2d-1 pi', accuracy: '1', range: '120/1300', rateOfFire: '1', shots: '6(3i)', minST: '10', bulk: -2, recoil: 2, legalityClass: 3, cost: 150, weightLb: 2.5 }),
  cartridgeRifle: ranged({ name: 'Cartridge Rifle, .45', reference: 'B279', techLevel: 5, skill: SKILLS.gunsRifle, damage: '5d pi+', accuracy: '3', range: '600/2000', rateOfFire: '1', shots: '1(4)', minST: '10†', bulk: -6, recoil: 3, legalityClass: 3, cost: 200, weightLb: 6 }),
  leverActionCarbine: ranged({ name: 'Lever-Action Carbine, .30', reference: 'B279', techLevel: 5, skill: SKILLS.gunsRifle, damage: '5d pi', accuracy: '4', range: '450/3000', rateOfFire: '1', shots: '6+1(3i)', minST: '10†', bulk: -4, recoil: 2, legalityClass: 3, cost: 300, weightLb: 7 }),
  doubleShotgun: ranged({ name: 'Double Shotgun, 10G', reference: 'B279', techLevel: 5, skill: SKILLS.gunsShotgun, damage: '1d+2 pi', accuracy: '3', range: '50/125', rateOfFire: '2x9', shots: '2(3i)', minST: '11†', bulk: -5, recoil: 1, legalityClass: noLC, cost: 450, weightLb: 10 }),
  autoPistol45: ranged({ name: 'Auto Pistol, .45', reference: 'B278', techLevel: 6, skill: SKILLS.gunsPistol, damage: '2d pi+', accuracy: '2', range: '175/1700', rateOfFire: '3', shots: '7+1(3)', minST: '10', bulk: -2, recoil: 3, legalityClass: 3, cost: 300, weightLb: 3 }),
  revolver38: ranged({ name: 'Revolver, .38', reference: 'B278', techLevel: 6, skill: SKILLS.gunsPistol, damage: '2d-1 pi', accuracy: '2', range: '120/1500', rateOfFire: '3', shots: '6(3i)', minST: '8', bulk: -2, recoil: 2, legalityClass: 3, cost: 400, weightLb: 2 }),
  snubRevolver38: ranged({ name: 'Snub Revolver, .38', reference: 'B278', techLevel: 6, skill: SKILLS.gunsPistol, damage: '1d+2 pi', accuracy: '1', range: '120/1250', rateOfFire: '3', shots: '5(3i)', minST: '8', bulk: -1, recoil: 3, legalityClass: 3, cost: 250, weightLb: 1.5 }),
  pumpShotgun: ranged({ name: 'Pump Shotgun, 12G', reference: 'B279', techLevel: 6, skill: SKILLS.gunsShotgun, damage: '1d+1 pi', accuracy: '3', range: '50/125', rateOfFire: '2x9', shots: '5(3i)', minST: '10†', bulk: -5, recoil: 1, legalityClass: noLC, cost: 240, weightLb: 8 }),
  autoPistol9mm: ranged({ name: 'Auto Pistol, 9mm', reference: 'B278', techLevel: 7, skill: SKILLS.gunsPistol, damage: '2d+2 pi', accuracy: '2', range: '150/1850', rateOfFire: '3', shots: '15+1(3)', minST: '9', bulk: -2, recoil: 2, legalityClass: 3, cost: 600, weightLb: 2.6 }),
  holdoutPistol: ranged({ name: 'Holdout Pistol, .380', reference: 'B278', techLevel: 7, skill: SKILLS.gunsPistol, damage: '2d pi', accuracy: '1', range: '125/1500', rateOfFire: '3', shots: '5+1(3)', minST: '8', bulk: -1, recoil: 3, legalityClass: 3, cost: 300, weightLb: 1.3 }),
  revolver357: ranged({ name: 'Revolver, .357M', reference: 'B278', techLevel: 7, skill: SKILLS.gunsPistol, damage: '3d-1 pi', accuracy: '2', range: '185/2000', rateOfFire: '3', shots: '6(3i)', minST: '10', bulk: -2, recoil: 3, legalityClass: 3, cost: 500, weightLb: 3 }),
  smg9mm: ranged({ name: 'SMG, 9mm', reference: 'B278', techLevel: 7, skill: SKILLS.gunsSmg, damage: '3d-1 pi', accuracy: '4', range: '160/1900', rateOfFire: '13', shots: '30+1(3)', minST: '10†', bulk: -4, recoil: 2, legalityClass: 2, cost: 1200, weightLb: 7.5 }),
  autoPistol40: ranged({ name: 'Auto Pistol, .40', reference: 'B278', techLevel: 8, skill: SKILLS.gunsPistol, damage: '2d pi+', accuracy: '2', range: '150/1900', rateOfFire: '3', shots: '15+1(3)', minST: '9', bulk: -2, recoil: 2, legalityClass: 3, cost: 640, weightLb: 2.1 }),
  assaultCarbine: ranged({ name: 'Assault Carbine, 5.56mm', reference: 'B279', techLevel: 8, skill: SKILLS.gunsRifle, damage: '4d+2 pi', accuracy: '4', range: '400/3000', rateOfFire: '15', shots: '30+1(3)', minST: '9†', bulk: -3, recoil: 2, legalityClass: 2, cost: 900, weightLb: 7.3 }),
  // ---- ultra-tech beam weapons (B280): armor divisors keep the notation as text, except the electrolaser ----
  electrolaserPistol: ranged({ name: 'Electrolaser Pistol', reference: 'B280', techLevel: 9, skill: SKILLS.beamWeaponsPistol, damage: '1d-3 burn', accuracy: '4', range: '40/80', rateOfFire: '3', shots: '180(3)', minST: '4', bulk: -2, recoil: 1, legalityClass: noLC, cost: 1800, weightLb: 2.2 }),
  laserPistol: ranged({ name: 'Laser Pistol', reference: 'B280', techLevel: 10, skill: SKILLS.beamWeaponsPistol, damage: '3d(2) burn', accuracy: '6', range: '250/750', rateOfFire: '10', shots: '400(3)', minST: '6', bulk: -2, recoil: 1, legalityClass: 3, cost: 2800, weightLb: 3.3 }),
  blasterPistol: ranged({ name: 'Blaster Pistol', reference: 'B280', techLevel: 11, skill: SKILLS.beamWeaponsPistol, damage: '3d(5) burn', accuracy: '5', range: '300/900', rateOfFire: '3', shots: '200(3)', minST: '4', bulk: -2, recoil: 1, legalityClass: 3, cost: 2200, weightLb: 1.6 }),
  blasterRifle: ranged({ name: 'Blaster Rifle', reference: 'B280', techLevel: 11, skill: SKILLS.beamWeaponsRifle, damage: '6d(5) burn', accuracy: '10+2', range: '700/2100', rateOfFire: '3', shots: '50(3)', minST: '7†', bulk: -4, recoil: 1, legalityClass: 2, cost: 18000, weightLb: 10 }),
} as const;

export const ARMOR = {
  ballisticHelmet: armor({ name: 'Ballistic Helmet', reference: 'B285', techLevel: 8, dr: { head: 12 }, location: 'Head', cost: 250, weightLb: 3 }),
  ballisticVest: armor({ name: 'Ballistic Vest', reference: 'B284', techLevel: 8, dr: { torso: 8 }, location: 'Torso', cost: 400, weightLb: 2 }),
  ballisticVestTL10: armor({ name: 'Ballistic Vest', reference: 'B284', techLevel: 10, dr: { torso: 16 }, location: 'Torso', cost: 400, weightLb: 2 }),
  boots: armor({ name: 'Boots', reference: 'B284', techLevel: 2, dr: { feet: 2 }, location: 'Feet', cost: 80, weightLb: 3 }),
  buffCoat: armor({ name: 'Buff Coat', reference: 'B283', techLevel: 4, dr: { torso: 2, arms: 2, legs: 2 }, location: 'Body', cost: 210, weightLb: 16 }),
  gauntlets: armor({ name: 'Gauntlets', reference: 'B284', techLevel: 2, dr: { hands: 4 }, location: 'Hands', cost: 100, weightLb: 2 }),
  greathelm: armor({ name: 'Greathelm', reference: 'B284', techLevel: 3, dr: { head: 7 }, location: 'Head', cost: 340, weightLb: 10 }),
  leatherArmor: armor({ name: 'Leather Armor', reference: 'B283', techLevel: 1, dr: { torso: 2 }, location: 'Torso', cost: 100, weightLb: 10 }),
  leatherJacket: armor({ name: 'Leather Jacket', reference: 'B283', techLevel: 1, dr: { torso: 1, arms: 1 }, location: 'Torso', cost: 50, weightLb: 4 }),
  leatherPants: armor({ name: 'Leather Pants', reference: 'B283', techLevel: 1, dr: { legs: 1 }, location: 'Legs', cost: 40, weightLb: 3 }),
  mailHauberk: armor({ name: 'Mail Hauberk', reference: 'B283', techLevel: 2, dr: { torso: 4 }, drNotes: '(2 vs. crushing)', location: 'Torso', cost: 230, weightLb: 25 }),
  mailLeggings: armor({ name: 'Mail Leggings', reference: 'B283', techLevel: 2, dr: { legs: 4 }, drNotes: '(2 vs. crushing)', location: 'Legs', cost: 110, weightLb: 15 }),
  mailSleeves: armor({ name: 'Mail Sleeves', reference: 'B283', techLevel: 2, dr: { arms: 4 }, drNotes: '(2 vs. crushing)', location: 'Arms', cost: 70, weightLb: 9 }),
  potHelm: armor({ name: 'Pot-Helm', reference: 'B284', techLevel: 3, dr: { head: 4 }, location: 'Head', cost: 100, weightLb: 5 }),
  reinforcedBoots: armor({ name: 'Reinforced Boots', reference: 'B284', techLevel: 7, dr: { feet: 2 }, location: 'Feet', cost: 75, weightLb: 3 }),
  tacticalSuitTL11: armor({ name: 'Tactical Suit', reference: 'B284', techLevel: 11, dr: { head: 40, torso: 40, arms: 40, hands: 40, legs: 40, feet: 40 }, location: 'Body', cost: 3000, weightLb: 15 }),
  tacticalVest: armor({ name: 'Tactical Vest', reference: 'B284', techLevel: 8, dr: { torso: 12 }, location: 'Torso', cost: 900, weightLb: 9 }),
} as const;

/** Shields add their Defense Bonus (DB) to active defenses; carried as equipment. */
export const SHIELDS = {
  mediumShield: gear({ name: 'Medium Shield (DB 2)', reference: 'B287', techLevel: 1, cost: 60, weightLb: 15, location: 'Left arm' }),
} as const;

export const GEAR = {
  backpackSmall: gear({ name: 'Backpack, Small', reference: 'B288', techLevel: 1, cost: 60, weightLb: 3, location: 'Back' }),
  blanket: gear({ name: 'Blanket', reference: 'B288', techLevel: 1, cost: 20, weightLb: 4, location: 'Back' }),
  camera35mm: gear({ name: 'Camera, 35mm', reference: 'B289', techLevel: 6, cost: 50, weightLb: 3 }),
  cellPhone: gear({ name: 'Cell Phone', reference: 'B288', techLevel: 8, cost: 250, weightLb: 0.25, location: 'Pocket' }),
  firstAidKit: gear({ name: 'First Aid Kit', reference: 'B289', techLevel: 0, cost: 50, weightLb: 2 }),
  flashlightHeavy: gear({ name: 'Flashlight, Heavy', reference: 'B288', techLevel: 6, cost: 20, weightLb: 1, location: 'Belt' }),
  handcuffs: gear({ name: 'Handcuffs', reference: 'B289', techLevel: 5, cost: 40, weightLb: 0.5, location: 'Belt' }),
  holsterBelt: gear({ name: 'Holster, Belt', reference: 'B289', techLevel: 5, cost: 25, weightLb: 0.5, location: 'Belt' }),
  holsterShoulder: gear({ name: 'Holster, Shoulder', reference: 'B289', techLevel: 5, cost: 50, weightLb: 1, location: 'Shoulder' }),
  laptop: gear({ name: 'Computer, Laptop', reference: 'B288', techLevel: 8, cost: 1500, weightLb: 3 }),
  lockpicks: gear({ name: 'Lockpicks', reference: 'B289', techLevel: 3, cost: 50, weightLb: 0 }),
  nightVisionGoggles: gear({ name: 'Night Vision Goggles', reference: 'B289', techLevel: 8, cost: 600, weightLb: 2, location: 'Head' }),
  personalBasics: gear({ name: 'Personal Basics', reference: 'B288', techLevel: 0, cost: 5, weightLb: 1 }),
  pouchSmall: gear({ name: 'Pouch, Small', reference: 'B288', techLevel: 1, cost: 10, weightLb: 0.5, location: 'Belt' }),
  radioHand: gear({ name: 'Radio, Hand', reference: 'B288', techLevel: 7, cost: 100, weightLb: 1, location: 'Belt' }),
  radioHeadset: gear({ name: 'Radio, Headset', reference: 'B288', techLevel: 8, cost: 500, weightLb: 0.5, location: 'Head' }),
  saddleAndTack: gear({ name: 'Saddle and Tack', reference: 'B289', techLevel: 2, cost: 150, weightLb: 15, location: 'Horse' }),
  shoulderQuiver: gear({ name: 'Shoulder Quiver', reference: 'B289', techLevel: 0, cost: 10, weightLb: 0.5, location: 'Back' }),
  toolKitElectronics: gear({ name: 'Portable Tool Kit, Electronics Repair', reference: 'B289', techLevel: 6, cost: 1200, weightLb: 10 }),
  toolKitMechanic: gear({ name: 'Portable Tool Kit, Mechanic', reference: 'B289', techLevel: 5, cost: 600, weightLb: 20 }),
  travelersRations: gear({ name: "Traveler's Rations", reference: 'B288', techLevel: 0, cost: 2, weightLb: 0.5 }),
} as const;
