// Horror (TL6, 1920s): occult investigators, cultists, monster hunters, sinister doctors and mediums.
import { ARMOR, GEAR, MELEE_WEAPONS as M, RANGED_WEAPONS as R } from '../catalog/equipment.js';
import { SKILL_FAMILIES as F, SKILLS as S } from '../catalog/skills.js';
import { ADVANTAGES as A, DISADVANTAGES as D, quirk } from '../catalog/traits.js';
import { language, learn, nativeLanguage, npc } from '../define.js';

const english = () => nativeLanguage('English');

export const horror = [
  npc({
    id: 'horror-occult-investigator', style: 'horror', name: 'Professor Edmund Hale', role: 'Occult investigator', threat: 'standard', budget: 125, techLevel: 6,
    profile: { age: '58', height: '1.75 m', weight: '70 kg', appearance: 'Tweed jacket, round spectacles, nervous hands' },
    attributes: { st: 9, dx: 10, iq: 15, ht: 11 },
    traits: [
      A.eideticMemory, A.fearlessness(2), D.curious(), D.obsession('unmask the Yellow Sign cult', 'long-term'),
      D.badSightNearsightedCorrected, D.nightmares(),
    ],
    languages: [english(), language('Latin', 'broken', 'native')],
    skills: [
      learn(S.occultism, 3), learn(F.hiddenLore('Demon Lore'), 1), learn(S.research, 2), learn(F.history('Ancient'), 1),
      learn(S.archaeology, 0), learn(S.gunsPistol, 1), learn(S.teaching, 0), learn(S.writing, 0),
    ],
    ranged: [R.revolver38],
    gear: [GEAR.flashlightHeavy, GEAR.camera35mm, GEAR.personalBasics],
    notes: ['Knows the right ritual, the right book and the right question; terrible with a gun.'],
  }),
  npc({
    id: 'horror-cultist', style: 'horror', name: 'Brother Silas', role: 'Cult acolyte', threat: 'mook', budget: 50, techLevel: 6,
    profile: { age: '33', height: '1.72 m', weight: '68 kg', appearance: 'Hooded yellow robe over a dock worker\'s clothes' },
    attributes: { st: 11, dx: 11, iq: 10, ht: 10 },
    secondary: { will: 12 },
    traits: [A.unfazeable, D.fanaticism('the Yellow Sign'), D.intolerance('unbelievers'), quirk('Hums a tuneless hymn')],
    languages: [english()],
    skills: [
      learn(S.knife, 2), learn(F.religiousRitual('the Yellow Sign'), 0), learn(S.occultism, 0), learn(S.stealth, 0),
      learn(S.intimidation, 0), learn(S.brawling, 0), learn(S.gunsPistol, 0),
    ],
    parry: S.knife,
    melee: [M.dagger],
    ranged: [R.snubRevolver38],
    notes: ['Fights to the death in front of the altar; never flees, never talks.'],
  }),
  npc({
    id: 'horror-monster-hunter', style: 'horror', name: 'Margaret "Mags" Calloway', role: 'Monster hunter', threat: 'boss', budget: 150, techLevel: 6,
    profile: { age: '40', height: '1.71 m', weight: '67 kg', appearance: 'Trench coat with sawn-off sleeves, scar across the throat' },
    attributes: { st: 12, dx: 13, iq: 11, ht: 12 },
    traits: [
      A.combatReflexes, A.unfazeable, A.highPainThreshold, D.obsession('destroy the thing that killed her husband', 'long-term'),
      D.bloodlust(), D.loner(), D.nightmares(),
    ],
    languages: [english()],
    skills: [
      learn(S.gunsShotgun, 2), learn(S.gunsPistol, 1), learn(F.hiddenLore('Spirit Lore'), 0), learn(S.occultism, 0), learn(S.knife, 1),
      learn(S.tracking, 1), learn(S.stealth, 0), learn(S.axeMace, 0),
    ],
    parry: S.axeMace,
    melee: [M.hatchet, M.woodenStake],
    ranged: [R.pumpShotgun, R.autoPistol45],
    armor: [ARMOR.leatherJacket],
    gear: [GEAR.flashlightHeavy, GEAR.holsterShoulder],
    notes: ['Shotgun first, stake and hatchet to finish; has seen too much to be frightened.'],
  }),
  npc({
    id: 'horror-asylum-doctor', style: 'horror', name: 'Dr. Viktor Strand', role: 'Asylum director', threat: 'non-combatant', budget: 100, techLevel: 6,
    profile: { age: '55', height: '1.82 m', weight: '76 kg', appearance: 'Immaculate white coat, gold pince-nez' },
    attributes: { st: 10, dx: 10, iq: 14, ht: 10 },
    traits: [
      A.status(1, 'Respected physician'), A.comfortableWealth, D.sadism(), D.megalomania,
      D.secret('experiments on his patients', 'imprisonment'),
    ],
    languages: [english(), language('German', 'native', 'native')],
    skills: [
      learn(S.physician, 1), learn(S.psychology, 2), learn(S.hypnotism, 1), learn(S.pharmacySynthetic, -1), learn(S.diagnosis, 0),
      learn(S.surgery, -2), learn(S.poisons, -1), learn(F.savoirFaire('High Society'), 0), learn(S.interrogation, 0),
      learn(S.detectLies, -1), learn(S.knife, 0),
    ],
    melee: [M.smallKnife],
    gear: [GEAR.firstAidKit, GEAR.personalBasics],
    notes: ['Never fights in person: orderlies, sedatives and hypnotic suggestion do it for him.'],
  }),
  npc({
    id: 'horror-spirit-medium', style: 'horror', name: 'Madame Odette Fairweather', role: 'Spirit medium', threat: 'non-combatant', budget: 75, techLevel: 6,
    profile: { age: '48', height: '1.60 m', weight: '72 kg', appearance: 'Shawls, rings on every finger, faraway look' },
    attributes: { st: 9, dx: 10, iq: 12, ht: 10 },
    secondary: { will: 14 },
    traits: [A.medium, A.empathy, D.secret('fakes séances when the spirits are silent', 'serious embarrassment'), D.nightmares(), D.gluttony()],
    languages: [english()],
    skills: [
      learn(S.fastTalk, 1), learn(S.occultism, 1), learn(S.acting, 1), learn(S.bodyLanguage, 0), learn(S.detectLies, 0),
      learn(F.hiddenLore('Spirit Lore'), 0), learn(F.savoirFaire('High Society'), 0), learn(S.psychology, -1), learn(S.exorcism, -2), learn(S.gunsPistol, 0),
    ],
    ranged: [R.derringer],
    gear: [GEAR.personalBasics],
    notes: ['Really does hear the dead, sometimes; Empathy makes her very hard to lie to.'],
  }),
];
