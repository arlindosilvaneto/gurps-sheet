import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  toCharacter, fromCharacter, parseCharacterFile, createValidator, sheetTables, parseWeaponDamage, SheetFileError,
} from '../src/character.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const layout = read('../src/layout.json');
const schema = read('../schema/gurps-character.schema.json');
const validate = createValidator(Ajv2020, addFormats, schema, read('../schema/x-gurps-vocabulary.schema.json'));
const rurik = read('../schema/examples/rurik.json');
const now = new Date('2026-10-04T12:00:00Z');

const loadError = (text) => {
  try {
    parseCharacterFile(text, validate, layout);
  } catch (err) {
    assert.ok(err instanceof SheetFileError, `expected SheetFileError, got ${err}`);
    return err;
  }
  assert.fail('file was accepted');
};

/** Saves sheet values to a document (asserting it is clean and valid) and loads it back. */
function roundTrip(values, opts = {}) {
  const { doc, problems, labels } = toCharacter(values, layout, { now, ...opts });
  assert.deepEqual(problems, []);
  assert.deepEqual(validate(doc, labels), { valid: true, problems: [] });
  return { doc, ...fromCharacter(doc, layout) };
}

test('page-2 tables resolve to complete rows (every price/weight field used exactly once)', () => {
  const t = sheetTables(layout);
  assert.equal(t.melee.length, 5);
  assert.equal(t.ranged.length, 10);
  assert.equal(t.equipment.length, 34);
  for (const r of t.melee) assert.equal(r.damage.length, 2, r.name);
  for (const r of t.ranged) {
    assert.equal(r.damage.length, 1, r.name);
    assert.equal(r.minST.length, 1, `${r.name}: duplicate ST widgets must be dropped by the extractor`);
  }
  const money = [...t.melee, ...t.ranged, ...t.equipment].flatMap((r) => [...r.cost, ...r.weight]);
  assert.equal(money.length, 98);
  assert.equal(new Set(money).size, 98);
});

test('document -> sheet -> document is lossless for the example (DR notes included)', () => {
  const { values, warnings, context } = fromCharacter(rurik, layout);
  assert.deepEqual(warnings, []);
  assert.deepEqual(context, { locale: 'pt-BR', currency: '$' });
  const { doc, problems } = toCharacter(values, layout, { now, context, createdAt: rurik.meta.createdAt, generator: rurik.meta.generator });
  assert.deepEqual(problems, []);
  const expected = structuredClone(rurik);
  delete expected.$schema;
  expected.meta.updatedAt = now.toISOString();
  assert.deepEqual(doc, expected);
});

test('sheet -> document -> sheet returns exactly the same values, including overrides and free text', () => {
  const values = {
    Nome: 'Teste', Pontos_Gastar: '150', ST: '12', PV: '14', PV_Atual: '10', NT: '3',
    Custo_ST: '18', // Size Modifier discount: overridden cost
    Base_Carga_Leve: '30', DB_Leve: '5', 'Esquiva-2': '9', // overridden encumbrance rows
    Pericia1: 'Espada', NH_Relativo_1A: 'DX', NH_Relativo_1B: '+1', Tipo_1: 'F', Custo_Pericia_1: '1', // talent-discounted
    Vantagem1: 'Visão Noturna', Custo_Vantagem_1: '5', Desvantagem1: 'Teimosia', Custo_desvantagem_1: '-5',
    Lingua1: 'Nórdico', Falada1: 'Nativo', Escrita1: 'Nativo', Custo_lingua_1: '0',
    RD1a: 'Tronco', RD1b: '4 (2 contra contusão)',
    Status: '10 anos de serviço', Reputação1: '+1 Herói local', Reputação2: '-2 Procurado',
    Arma1CC: 'Espada', DanoArma1ACC: 'GeB+1 cort', DanoArma1BCC: 'GdP+2 perf', ApararArma1CC: '0',
    ArmaCD1: 'Arco', STArmaCD1: '9', MagnitudeCD1: '-6',
    Armadura1: 'Corda', 'Preço16': '12,345', Peso16: '0,125',
    Anotações1: 'Nota livre',
  };
  const { values: back, warnings, doc } = roundTrip(values);
  assert.deepEqual(warnings, []);
  assert.deepEqual(back, values);
  assert.equal(doc.attributes.st.points, 18);
  assert.deepEqual(doc.damageResistance[0], { location: 'Tronco', locationId: 'torso', dr: 4, notes: '(2 contra contusão)' });
  assert.deepEqual(doc.reactionModifiers.find((r) => r.source === 'status'), { source: 'status', modifier: null, description: '10 anos de serviço' });
  assert.equal(doc.weapons.ranged[0].minST, '9');
  assert.equal(doc.equipment[0].weight, 0.125);
});

test('a blank sheet exports a valid 0-point character with free defaults', () => {
  const { doc } = roundTrip({});
  assert.equal(doc.attributes.st.value, 10);
  assert.equal(doc.points.spent, 0);
  assert.equal(doc.points.budget, null);
  assert.deepEqual(doc.damage.swing, { notation: '1d', dice: 1, adds: 0 });
});

test('anything the document cannot carry blocks the save, named by sheet row (never a silent 0)', () => {
  const { problems } = toCharacter({
    ST: '0', Vantagem1: 'Aliados', Custo_Vantagem_1: '15 (3 níveis)', Desvantagem1: 'Teimosia', Custo_desvantagem_1: '-2,5',
    Custo_Vantagem_3: '5', Armadura1: 'Corda', Peso16: '2 kg', 'Preço16': '$50', NT: '3+1',
    Pericia1: 'Espada', NH_Relativo_1A: 'DX', NH_Relativo_1B: 'abc', Tipo_1: 'M',
    Pericia2: 'Física', NH_Relativo_2A: 'IQ', NH_Relativo_2B: '-4', Tipo_2: 'D',
    Pericia3: 'Briga', NH_Relativo_3A: 'DX', NH_Relativo_3B: '0',
    Lingua1: 'Latim', Falada1: 'fluente', Escrita1: 'Nativo',
    ModificadorTamanho: 'grande', Pontos_Gastar: 'cem', PV_Atual: 'x', Custo_ST: 'dezoito',
    RD1a: 'Tronco', RD1b: '4,5', RD2a: 'Pés', Vel_Basica: '5,1', ArmaCD1: 'Arco', MagnitudeCD1: 'muito',
  }, layout, { now });
  assert.deepEqual(problems, [
    'Mod. de Tamanho: "grande" não é um número.',
    'Pontos p/ Gastar: "cem" não é um número.',
    'Vantagens, linha 1 (Aliados) › custo: "15 (3 níveis)" não é um número.',
    'Vantagens, linha 3: tem custo mas não tem nome.',
    'Desvantagens, linha 1 (Teimosia) › custo: "-2,5" deve ser um número inteiro.',
    'Perícias, linha 1 (Espada) › NH relativo: "abc" não é um número.',
    'Perícias, linha 2 (Física): O Valor do NH Relativo é menor que o permitido.',
    'Perícias, linha 3 (Briga): dificuldade ausente (use F, M, D ou MD).',
    'Línguas, linha 1 (Latim): nível falado "fluente" não reconhecido (use Nenhum, Rudimentar, Sotaque ou Nativo).',
    'RD, linha 1 (Tronco): "4,5" deve começar com um número inteiro (ex.: 4 ou "4 (2 contra contusão)").',
    'RD, linha 2 (Pés): falta o valor de RD.',
    'Armas à distância, linha 1 (Arco) › Magnitude: "muito" não é um número.',
    'Armadura & posses, linha 1 (Corda) › custo: "$50" não é um número.',
    'Armadura & posses, linha 1 (Corda) › peso: "2 kg" não é um número.',
    'NT: "3+1" não é um número.',
    'ST › custo: "dezoito" não é um número.',
    'PV atual: "x" não é um número.',
    'Velocidade Básica: "5,1" deve variar em passos de 0,25.',
    'Dano GdP: com ST 0 não há dano na tabela; a ST precisa ser pelo menos 1.',
    'Dano GeB: com ST 0 não há dano na tabela; a ST precisa ser pelo menos 1.',
  ]);
});

test('schema errors on save are reported by sheet row, not by document path', () => {
  const { doc, labels } = toCharacter({ Vantagem1: 'A', Custo_Vantagem_1: '5', Desvantagem1: 'Teimosia', Custo_desvantagem_1: '-5' }, layout, { now });
  doc.traits[1].points = 2.5; // a value the sheet checks would have refused
  assert.deepEqual(validate(doc, labels).problems, ['Desvantagens, linha 1 (Teimosia) › custo: deveria ser um número inteiro.']);
});

test('a loaded file keeps its locale, currency and structured damage on re-save', () => {
  const foreign = structuredClone(rurik);
  foreign.ruleset.currency = 'R$';
  foreign.meta.locale = 'en';
  foreign.weapons.melee[0].damage = [{ notation: 'sw+2', base: 'swing', adds: 2, type: 'cut' }]; // type not in the text
  const { values, warnings, context } = fromCharacter(foreign, layout);
  assert.deepEqual(warnings, []);
  assert.equal(values.DanoArma1ACC, 'sw+2 cut'); // type made explicit so re-parsing keeps it
  const { doc } = toCharacter(values, layout, { now, context });
  assert.equal(doc.ruleset.currency, 'R$');
  assert.equal(doc.meta.locale, 'en');
  assert.equal(doc.weapons.melee[0].damage[0].type, 'cut');
});

test('loading warns about everything that will not survive a re-save unchanged', () => {
  const doc = structuredClone(rurik);
  doc.traits.push({ name: 'Bom senso', type: 'advantage', points: 1, notes: 'x' });
  doc.reactionModifiers.push({ source: 'reputation', description: 'Covarde', modifier: -2 });
  doc.weapons.melee[0].parry = { notation: '0', modifier: -1 };
  doc.extensions = { 'com.example.combat': {} };
  const { warnings } = fromCharacter(doc, layout);
  assert.deepEqual(warnings, [
    '"Bom senso": nível/notas não têm lugar na planilha.',
    '"Bom senso" (1 pts) será salvo como qualidade: a planilha decide pelo custo.',
    'Modificador de reação "Covarde": as linhas extras não guardam a origem (reputation); será salvo como "other".',
    'Aparar de "Machado" "0": os campos estruturados não correspondem ao texto e serão recalculados a partir dele ao salvar.',
    'Dados de extensões (com.example.combat) não são exibidos na planilha e não serão mantidos.',
  ]);
});

test('1-point advantages export as perks and -1-point disadvantages as quirks', () => {
  const { doc } = toCharacter({ Vantagem1: 'Ambidestria leve', Custo_Vantagem_1: '1', Desvantagem1: 'Ronca', Custo_desvantagem_1: '-1' }, layout, { now });
  assert.deepEqual(doc.traits.map((t) => t.type), ['perk', 'quirk']);
});

test('weapon damage text is structured when recognised (pt-BR and English)', () => {
  assert.deepEqual(parseWeaponDamage('GeB+2 cort'), { notation: 'GeB+2 cort', base: 'swing', adds: 2, type: 'cut' });
  assert.deepEqual(parseWeaponDamage('2d+1 pa'), { notation: '2d+1 pa', base: 'fixed', dice: 2, adds: 1, type: 'pi' });
  assert.deepEqual(parseWeaponDamage('especial'), { notation: 'especial' });
});

test('loading a valid file returns sheet values, creation date and file context', () => {
  const { values, createdAt, context } = parseCharacterFile(JSON.stringify(rurik), validate, layout);
  assert.equal(values.Nome, 'Rurik Bjornsson');
  assert.equal(values.PV, '15'); // bought-up HP restored as an override
  assert.equal(values.Tipo_2, 'F');
  assert.equal(values.RD2b, '4 Cota de malha (2 contra contusão)');
  assert.equal(createdAt, rurik.meta.createdAt);
  assert.deepEqual(context, { locale: 'pt-BR', currency: '$' });
});

test('load errors: old format, bad JSON, wrong format, versions, schema violations, size, overflow', () => {
  let err = loadError(JSON.stringify({ format: 'gurps-sheet', version: 1, values: { ST: '14', Vantagem1: 'coco voador' } }));
  assert.equal(err.title, 'Formato antigo não suportado.');

  err = loadError('{ "format": "gurps-character", ');
  assert.equal(err.title, 'O arquivo não é um JSON válido.');
  assert.deepEqual(err.problems, ['Erro de sintaxe JSON na linha 1, coluna 32.']);
  assert.deepEqual(loadError('{"format":').problems, ['O arquivo termina antes do fim do JSON (está incompleto).']);

  assert.equal(loadError('[1, 2]').title, 'Este arquivo não é uma ficha GURPS.');
  assert.equal(loadError(JSON.stringify({ format: 'gcs' })).title, 'Este arquivo não é uma ficha GURPS.');
  assert.equal(loadError(JSON.stringify({ ...rurik, formatVersion: '2.0.0' })).title, 'Versão da ficha não suportada.');
  const newer = loadError(JSON.stringify({ ...rurik, formatVersion: '1.1.0', profile: { ...rurik.profile, gender: 'm' } }));
  assert.equal(newer.title, 'Ficha criada por uma versão mais nova.'); // not misreported as a schema error

  const bad = structuredClone(rurik);
  bad.attributes.st.value = '13';
  bad.skills[1].difficulty = 'M';
  bad.Vantagem1 = 'x';
  bad.extensions = { combat: {} };
  err = loadError(JSON.stringify(bad));
  assert.equal(err.title, 'A ficha não segue o esquema gurps-character.');
  assert.deepEqual(err.problems, [
    'raiz do arquivo: campo desconhecido "Vantagem1".',
    'attributes › st › value: deveria ser um número inteiro.',
    'skills › #2 › difficulty: valor inválido; use um de: E, A, H, VH.',
    'extensions: nome de chave "combat" inválido.',
  ]);

  assert.equal(loadError(' '.repeat(2_000_001)).title, 'Arquivo grande demais.');

  const crowded = structuredClone(rurik);
  crowded.traits = Array.from({ length: 14 }, (_, i) => ({ name: `Vantagem ${i}`, type: 'advantage', points: 5 }));
  err = loadError(JSON.stringify(crowded));
  assert.equal(err.title, 'A ficha não cabe na planilha.');
  assert.deepEqual(err.problems, ['Vantagens e qualidades: a ficha tem 14, a planilha comporta 12.']);
});

test('loading never mutates the parsed document', () => {
  const doc = structuredClone(rurik);
  const before = JSON.stringify(doc);
  fromCharacter(doc, layout);
  assert.equal(JSON.stringify(doc), before);
});
