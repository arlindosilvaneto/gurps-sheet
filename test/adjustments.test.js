import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as lib from '@gurps-sheet/character';
import { compute, SKILL_BONUSES, JUSTIFICATIONS } from '../src/rules.js';
import { sheetDeviations } from '../src/integrity.js';
import { toCharacter, fromCharacter, checkSchema } from '../src/character.js';
import { deviations } from '@gurps-sheet/character/formula';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const layout = read('../src/layout.json');
const { schema } = lib;
const validate = (doc, labels) => checkSchema(lib, doc, labels);
const now = new Date('2026-10-04T12:00:00Z');

const artist = {
  Nome: 'Artista', DX: '12', IQ: '11',
  Vantagem1: 'Talento (Artista) 2', Custo_Vantagem_1: '10',
  Pericia1: 'Briga', NH_Relativo_1A: 'DX', NH_Relativo_1B: '0', Tipo_1: 'F',
  Pericia2: 'Pintura', NH_Relativo_2A: 'IQ', NH_Relativo_2B: '-1', Tipo_2: 'D',
  Aparar2: 'Pintura',
  [SKILL_BONUSES]: { 2: [{ name: 'Talento Artista', amount: 2 }] },
};

test('NH bonuses raise NH (and what depends on it) without changing the skill cost', () => {
  const { out, skills } = compute(artist);
  assert.equal(out.NH2, '12'); // IQ 11 − 1 + 2
  assert.equal(out.Custo_Pericia_2, '2'); // Hard at −1 still costs 2: the Talent is paid in Vantagens
  assert.equal(out.Aparar, '9'); // floor(12 / 2) + 3 follows the boosted NH
  assert.deepEqual(skills[2].bonuses, [{ name: 'Talento Artista', amount: 2 }]);
  assert.deepEqual(sheetDeviations(artist, out), []); // explained bonus = within the rules
});

test('bonus NH is rules-compliant for the engine check too, and survives save/load', () => {
  const { doc, problems } = toCharacter(artist, layout, { schema, now });
  assert.deepEqual(problems, []);
  assert.deepEqual(validate(doc), { valid: true, problems: [] });
  assert.deepEqual(doc.skills[1].bonuses, [{ name: 'Talento Artista', amount: 2 }]);
  assert.equal(doc.skills[1].level, 12);
  assert.equal(doc.integrity.rulesCompliant, true);
  assert.deepEqual(deviations(schema, doc), []);
  assert.deepEqual(fromCharacter(doc, layout).values, artist);
});

test('bonuses follow packed rows on load (row 4 on the sheet becomes row 2 in the file and back)', () => {
  const sparse = {
    DX: '12', Pericia1: 'Briga', NH_Relativo_1A: 'DX', NH_Relativo_1B: '0', Tipo_1: 'F',
    Pericia4: 'Pintura', NH_Relativo_4A: 'DX', NH_Relativo_4B: '0', Tipo_4: 'F',
    [SKILL_BONUSES]: { 4: [{ name: 'Talento', amount: 1 }] },
  };
  const { values } = fromCharacter(toCharacter(sparse, layout, { schema, now }).doc, layout);
  assert.equal(values.Pericia2, 'Pintura');
  assert.deepEqual(values[SKILL_BONUSES], { 2: [{ name: 'Talento', amount: 1 }] });
  assert.equal(compute(values).out.NH2, '13');
});

test('a manual NH without a bonus is still a deviation', () => {
  const cheat = { ...artist, NH1: '18' };
  assert.deepEqual(sheetDeviations(cheat, compute(cheat).out).map((d) => d.id), ['NH1']);
});

test('justifications travel with their deviations; they document intent but do not make the sheet compliant', () => {
  const values = { ...artist, Esquiva: '12', [JUSTIFICATIONS]: { Esquiva: 'Bênção de Odin (aprovado pelo mestre)' } };
  const devs = sheetDeviations(values, compute(values).out);
  assert.deepEqual(devs.map((d) => [d.id, d.justification]), [['Esquiva', 'Bênção de Odin (aprovado pelo mestre)']]);
  const { doc } = toCharacter(values, layout, { schema, now });
  assert.deepEqual(validate(doc), { valid: true, problems: [] });
  assert.equal(doc.integrity.rulesCompliant, false);
  assert.equal(doc.integrity.deviations[0].justification, 'Bênção de Odin (aprovado pelo mestre)');
  const back = fromCharacter(doc, layout);
  assert.deepEqual(back.warnings, []);
  assert.deepEqual(back.values, values);
});

test('justifications from other writers match by pointer; stale ones are reported, not silently dropped', () => {
  const values = { ...artist, Esquiva: '12' };
  const { doc } = toCharacter(values, layout, { schema, now });
  const foreign = structuredClone(doc);
  foreign.integrity.deviations = [
    { pointer: '/defenses/dodge/value', expected: 9, actual: 12, justification: 'Item mágico' }, // no sheetField
    { pointer: '/defenses/block/value', expected: null, actual: 15, justification: 'Escudo encantado', label: 'Bloqueio' }, // not deviating
  ];
  const { values: back, warnings } = fromCharacter(foreign, layout);
  assert.deepEqual(back[JUSTIFICATIONS], { Esquiva: 'Item mágico' });
  assert.deepEqual(warnings, ['Justificativa "Escudo encantado" ignorada: Bloqueio não está fora das regras nesta ficha.']);
});
