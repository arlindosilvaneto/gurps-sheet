// Runs the built package on plain Node, as an external consumer would (no TypeScript, no custom conditions):
// catches a broken exports map or a JSON import that doesn't resolve from dist/.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCharacter, applyDamage, combatStats, schema } from '@gurps-sheet/character';
import { recompute } from '@gurps-sheet/character/formula';
import { LATEST_VERSION } from '@gurps-sheet/character/constants';

const resolved = fileURLToPath(import.meta.resolve('@gurps-sheet/character'));
assert.match(resolved, /[/\\]dist[/\\]index\.js$/, `expected the built entry point, got ${resolved}`);

const text = readFileSync(new URL('../../examples/jotun.json', import.meta.url), 'utf8');
const { character, report } = parseCharacter(text);
assert.equal(report.deviations.length, 1);
assert.equal(combatStats(applyDamage(character, 3)).hp.current, character.secondary.hp.value - 3);
assert.ok(recompute(schema, character).length > 30);
assert.equal(LATEST_VERSION, '1.3.0');
console.log(`dist smoke test passed (${resolved}).`);
