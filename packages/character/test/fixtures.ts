import { readFileSync } from 'node:fs';
import type { GurpsCharacter } from '@gurps-sheet/character';

const example = (name: string): GurpsCharacter => JSON.parse(readFileSync(new URL(`../examples/${name}.json`, import.meta.url), 'utf8'));

export const rurik = example('rurik');
export const jotun = example('jotun');
