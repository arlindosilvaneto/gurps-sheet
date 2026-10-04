import type { AdventureStyle, NpcDefinition } from '../define.js';
import { fantasy } from './fantasy.js';
import { horror } from './horror.js';
import { modern } from './modern.js';
import { scienceFiction } from './science-fiction.js';
import { swashbuckling } from './swashbuckling.js';
import { western } from './western.js';

export interface StyleInfo {
  readonly id: AdventureStyle;
  readonly title: string;
  /** Usual tech level of the setting. */
  readonly techLevel: number;
  readonly description: string;
}

export const STYLES: ReadonlyArray<StyleInfo> = [
  { id: 'fantasy', title: 'Medieval fantasy', techLevel: 3, description: 'Walled towns, mercenary knights, guild thieves and court wizards; swords, bows and Basic Set spells.' },
  { id: 'swashbuckling', title: 'Swashbuckling', techLevel: 4, description: '17th-century intrigue and piracy: rapiers, cutlasses and flintlock pistols.' },
  { id: 'western', title: 'Wild West', techLevel: 5, description: 'Frontier towns of the 1870s: revolvers, lever-action rifles, shotguns and horses.' },
  { id: 'modern', title: 'Modern action', techLevel: 8, description: 'Street crime, police, special forces, spies and hackers with contemporary firearms and body armor.' },
  { id: 'horror', title: '1920s horror', techLevel: 6, description: 'Occult investigation in the Jazz Age: cultists, monster hunters, sinister doctors and mediums.' },
  { id: 'science-fiction', title: 'Science fiction', techLevel: 10, description: 'Starship crews, space marines and smugglers with beam weapons and ultra-tech armor.' },
];

export const DEFINITIONS: ReadonlyArray<NpcDefinition> = [...fantasy, ...swashbuckling, ...western, ...modern, ...horror, ...scienceFiction];
