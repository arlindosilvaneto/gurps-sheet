// Runs the built package on plain Node, as an external consumer would (no TypeScript, no custom conditions).
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { verifyCharacter } from '@gurps-sheet/character';
import { getNpc, listNpcs } from '@gurps-sheet/npcs';
import { SKILLS } from '@gurps-sheet/npcs/catalog';

const resolved = fileURLToPath(import.meta.resolve('@gurps-sheet/npcs'));
assert.match(resolved, /[/\\]dist[/\\]index\.js$/, `expected the built entry point, got ${resolved}`);
assert.equal(listNpcs().length, 32);
assert.equal(verifyCharacter(getNpc('science-fiction-space-marine')).rulesCompliant, true);
assert.equal(SKILLS.broadsword.reference, 'B208');
console.log(`dist smoke test passed (${resolved}).`);
