import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HELP, NOT_TITLES, resolveHelp } from '../src/help.js';

const labels = JSON.parse(readFileSync(new URL('../src/labels.json', import.meta.url)));
const resolved = resolveHelp(labels);

test('every help entry resolves to a printed label', () => {
  const missing = resolved.filter((r) => r.help === null).map((r) => `p${r.entry.p} "${r.entry.t}" #${r.entry.n}`);
  assert.deepEqual(missing, []);
});

test('no two help entries target the same label', () => {
  const keys = resolved.map((r) => `${r.page}:${r.x}:${r.y}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('every printed title has help (a line is covered by a line entry or by word entries for all its words)', () => {
  const hit = (r) => `${r.page}:${r.x}:${r.y}:${r.w}`;
  const covered = new Set(resolved.map(hit));
  const key = ([p, , x, y, w]) => `${p}:${x}:${y}:${w}`;
  const inside = (word, line) => word[0] === line[0] && word[2] >= line[2] - 0.5 && word[2] + word[4] <= line[2] + line[4] + 0.5
    && Math.abs(word[3] - line[3]) < 2;
  const uncovered = labels.lines.filter((line) => {
    if (NOT_TITLES.some((re) => re.test(line[1]))) return false;
    if (covered.has(key(line))) return false;
    const words = labels.words.filter((w) => inside(w, line));
    return !(words.length && words.every((w) => covered.has(key(w))));
  });
  assert.deepEqual(uncovered.map((l) => `p${l[0]} "${l[1]}"`), []);
  assert.ok(HELP.length > 50);
});
