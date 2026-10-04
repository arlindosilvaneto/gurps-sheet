import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compute, damage, skillCost, basicLift, num, fmt, display, COMPUTED } from '../src/rules.js';

const layout = JSON.parse(readFileSync(new URL('../src/layout.json', import.meta.url)));
const ids = new Set(layout.fields.map((f) => f.id));

test('every computed field and every id the rules read exists in layout.json', () => {
  for (const id of COMPUTED) assert.ok(ids.has(id), `missing computed field ${id}`);
  const src = readFileSync(new URL('../src/rules.js', import.meta.url), 'utf8');
  for (const id of ['Custo_NT', 'Custo_FC3', 'Custo_Vantagem_12', 'Custo_lingua_5', 'Custo_desvantagem_13',
    'Preço49', 'Peso49', 'Pericia25', 'Aparar2', 'Bloqueio2', 'Resumo_Pontos5', 'Pontos_Gastar',
    'NH_Relativo_25A', 'NH_Relativo_25B', 'Tipo_25']) {
    assert.ok(ids.has(id), `missing input field ${id}`);
  }
  assert.ok(src.length > 0);
});

test('num/fmt handle pt-BR decimals', () => {
  assert.equal(num('5,25'), 5.25);
  assert.equal(num('+2'), 2);
  assert.equal(num(''), null);
  assert.equal(num('abc'), null);
  assert.equal(fmt(5.25), '5,25');
  assert.equal(fmt(-10), '-10');
});

test('attribute costs', () => {
  const { out } = compute({ ST: '12', DX: '13', IQ: '9', HT: '10' });
  assert.equal(out.Custo_ST, '20');
  assert.equal(out.Custo_DX, '60');
  assert.equal(out.Custo_IQ, '-20');
  assert.equal(out.Custo_HT, ''); // 10 is the free default
});

test('blank sheet uses free defaults: attributes 10 and everything derived from them', () => {
  const values = {};
  const { out } = compute(values);
  for (const a of ['ST', 'DX', 'IQ', 'HT', 'PV', 'Vont', 'Per', 'PF']) {
    assert.equal(display(a, values, out), '10', a);
    assert.equal(out[`Custo_${a}`], '', `Custo_${a}`);
  }
  assert.equal(out.Vel_Basica, '5');
  assert.equal(out.Desl_Basico, '5');
  assert.equal(out.Esquiva, '8');
  assert.equal(out.Base_Carga, '10');
  assert.equal(out.Dano_GdP, '1d-2');
  assert.equal(out.Dano_GeB, '1d');
  assert.equal(out.Total_Pontos, '');
  // A typed attribute overrides the default and the secondaries follow it.
  const typed = compute({ ST: '12' }).out;
  assert.equal(typed.Custo_ST, '20');
  assert.equal(typed.PV, '12');
  assert.equal(compute({ IQ: '12', NH_Relativo_1A: 'IQ', NH_Relativo_1B: '0' }).out.NH1, '12');
  assert.equal(compute({ NH_Relativo_1A: 'DX', NH_Relativo_1B: '-1' }).out.NH1, '9');
});

test('secondary characteristics default from attributes and cost when bought', () => {
  let { out } = compute({ ST: '12', DX: '12', IQ: '10', HT: '11' });
  assert.equal(out.PV, '12');
  assert.equal(out.Vont, '10');
  assert.equal(out.PF, '11');
  assert.equal(out.Vel_Basica, '5,75');
  assert.equal(out.Desl_Basico, '5');
  assert.equal(out.Custo_PV, '');
  ({ out } = compute({ ST: '12', DX: '12', IQ: '10', HT: '11', PV: '14', Per: '12', PF: '10', Vel_Basica: '6', Desl_Basico: '7' }));
  assert.equal(out.Custo_PV, '4');
  assert.equal(out.Custo_Per, '10');
  assert.equal(out.Custo_PF, '-3');
  assert.equal(out.Custo_Vel_Basica, '5'); // +0.25 speed
  assert.equal(out.Custo_Desl_Basico, '5'); // floor(6)=6 -> 7
  assert.equal(out.Resumo_Pontos1, String(20 + 40 + 0 + 10 + 4 + 10 - 3 + 5 + 5));
});

test('encumbrance, dodge and move', () => {
  const { out } = compute({ ST: '12', DX: '12', HT: '12' }); // speed 6, move 6
  assert.equal(out.Base_Carga, '14'); // 144/10 = 14.4 -> 14
  assert.equal(out.Base_Carga_Mto_Pesada, '140');
  assert.equal(out.DB_Leve, '4'); // floor(4.8)
  assert.equal(out.DB_Mto_Pesada, '1');
  assert.equal(out.Esquiva, '9');
  assert.equal(out['Esquiva-4'], '5');
  // Buying Basic Move does not raise Dodge (Dodge uses Basic Speed).
  assert.equal(compute({ DX: '12', HT: '12', Desl_Basico: '8' }).out.Esquiva, '9');
  assert.equal(basicLift(8), 6.4);
});

test('encumbrance rows follow the Base de Carga field, including a typed override', () => {
  const { out } = compute({ ST: '1', Base_Carga: '012' });
  assert.deepEqual(
    ['Nenhuma', 'Leve', 'Media', 'Pesada', 'Mto_Pesada'].map((n) => out[`Base_Carga_${n}`]),
    ['12', '24', '36', '72', '120'],
  );
  assert.equal(compute({ Base_Carga: '7,5' }).out.Base_Carga_Leve, '15');
});

test('damage table', () => {
  assert.deepEqual(damage(10), ['1d-2', '1d']);
  assert.deepEqual(damage(13), ['1d', '2d-1']);
  assert.deepEqual(damage(40), ['4d+1', '7d-1']);
  assert.deepEqual(damage(47), ['5d', '7d+1']);
  assert.deepEqual(damage(100), ['11d', '13d']);
  assert.deepEqual(damage(120), ['13d', '15d']);
  assert.deepEqual(damage(null), ['', '']);
});

test('skill cost per difficulty (1, 2, 4, 8, 12...)', () => {
  const c = (rel, t) => skillCost(rel, t).cost;
  assert.deepEqual([0, 1, 2, 3, 4].map((r) => c(r, 'F')), [1, 2, 4, 8, 12]);
  assert.deepEqual([-1, 0, 1, 2].map((r) => c(r, 'M')), [1, 2, 4, 8]);
  assert.deepEqual([-2, -1, 0, 1].map((r) => c(r, 'D')), [1, 2, 4, 8]);
  assert.deepEqual([-3, -2, -1, 0].map((r) => c(r, 'MD')), [1, 2, 4, 8]);
  assert.equal(c(1, 'md'), 12);
  assert.equal(c(0, ''), null);
  assert.ok(skillCost(-2, 'F').error);
});

test('skills, parry and block', () => {
  const { out, errors } = compute({
    DX: '12', IQ: '11', Per: '13',
    Pericia1: 'Espada Larga', NH_Relativo_1A: 'DX', NH_Relativo_1B: '+1', Tipo_1: 'M',
    Pericia6: 'Escudo', NH_Relativo_6A: 'dx', NH_Relativo_6B: '0', Tipo_6: 'F',
    Pericia7: 'Observação', NH_Relativo_7A: 'Per', NH_Relativo_7B: '-1', Tipo_7: 'M',
    Pericia8: 'Física', NH_Relativo_8A: 'IQ', NH_Relativo_8B: '-3', Tipo_8: 'D',
    Aparar2: 'espada larga', Bloqueio2: 'Escudo',
  });
  assert.equal(out.NH1, '13');
  assert.equal(out.Custo_Pericia_1, '4');
  assert.equal(out.NH6, '12');
  assert.equal(out.Custo_Pericia_6, '1');
  assert.equal(out.NH7, '12'); // uses overridden Per (13), not IQ
  assert.equal(out.Custo_Pericia_8, '');
  assert.ok(errors.Custo_Pericia_8);
  assert.equal(out.Aparar, '9'); // floor(13/2)+3
  assert.equal(out.Bloqueio, '9'); // floor(12/2)+3
  assert.equal(out.Resumo_Pontos4, '6'); // 4 + 1 + 1; the invalid skill adds nothing
});

test('point total is the sum of spent points; the budget is not added and only flags overspending', () => {
  const { out, errors } = compute({
    ST: '11', Custo_Vantagem_1: '15', Custo_lingua_1: '6', Custo_NT: '5', Custo_FC1: '1',
    Custo_desvantagem_1: '-10', Custo_desvantagem_2: '-1', Resumo_Pontos5: '3', Pontos_Gastar: '20',
    Vel_Basica: '', DX: '10', HT: '10',
  });
  assert.equal(out.Resumo_Pontos1, '10');
  assert.equal(out.Resumo_Pontos2, '27');
  assert.equal(out.Resumo_Pontos3, '-11');
  assert.equal(out.Total_Pontos, String(10 + 27 - 11 + 3)); // 29 spent; budget 20 not added
  assert.match(errors.Total_Pontos, /excedem o orçamento \(20\) em 9/);
  const within = compute({ ST: '11', Pontos_Gastar: '100' });
  assert.equal(within.out.Total_Pontos, '10');
  assert.equal(within.errors.Total_Pontos, undefined);
});

test('equipment totals and page-2 name mirror', () => {
  const { out } = compute({ Nome: 'Rurik', 'Preço1': '100', 'Preço49': '2,5', Peso1: '1,5', Peso2: '3' });
  assert.equal(out.Nome_p2, 'Rurik');
  assert.equal(out['Preço_Total'], '102,5');
  assert.equal(out.Peso_Total, '4,5');
});

test('display prefers overrides except for read-only totals', () => {
  const values = { ST: '10', PV: '15', Total_Pontos: '999' };
  const { out } = compute(values);
  assert.equal(display('PV', values, out), '15');
  assert.equal(display('Total_Pontos', values, out), out.Total_Pontos);
  assert.equal(display('ST', values, out), '10');
});
