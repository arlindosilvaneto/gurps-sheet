// The @gurps-sheet/npcs library must load into the sheet editor and save back unchanged: no warnings, no problems,
// every list within the sheet's rows, every notation re-parsed to the same structured fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as lib from '@gurps-sheet/character';
import { toCharacter, fromCharacter } from '../src/character.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const layout = read('../src/layout.json');
const index = read('../packages/npcs/data/index.json');
const now = new Date('2026-10-05T12:00:00Z');

test('every library NPC round-trips through the sheet editor unchanged', () => {
  assert.ok(index.npcs.length >= 24);
  for (const entry of index.npcs) {
    const npc = read(`../packages/npcs/data/${entry.file}`);
    const { values, warnings, context, createdAt } = fromCharacter(npc, layout);
    assert.deepEqual(warnings, [], entry.id);
    const { doc, problems } = toCharacter(values, layout, { schema: lib.schema, now, context, createdAt, generator: npc.meta.generator });
    assert.deepEqual(problems, [], entry.id);
    assert.deepEqual(doc, { ...npc, meta: { ...npc.meta, updatedAt: now.toISOString() } }, entry.id);
  }
});
