// Writes every NPC to data/<style>/<id>.json plus data/index.json (summaries), for tools in any language.
//   npm run generate -w @gurps-sheet/npcs             write the files
//   npm run generate -w @gurps-sheet/npcs -- --check  fail if the committed files differ (run by `npm test`)
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getNpc, listNpcs, STYLES } from '../src/index.js';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const files = new Map<string, string>();
const npcs = listNpcs().map((s) => {
  const file = `${s.style}/${s.id}.json`;
  files.set(file, json(getNpc(s.id)));
  return { ...s, file };
});
files.set('index.json', json({ description: 'NPCs built from GURPS Basic Set material; see the @gurps-sheet/npcs README.', styles: STYLES, npcs }));

const existing = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? existing(join(dir, e.name)) : [relative(dataDir, join(dir, e.name))]));
let current: string[] = [];
try {
  current = existing(dataDir).filter((f) => f.endsWith('.json'));
} catch { /* no data dir yet */ }

if (process.argv.includes('--check')) {
  const stale = [...files].filter(([file, text]) => {
    try {
      return readFileSync(join(dataDir, file), 'utf8') !== text;
    } catch {
      return true;
    }
  }).map(([file]) => file);
  const extra = current.filter((f) => !files.has(f));
  if (stale.length || extra.length) {
    console.error(`data/ is out of date (${[...stale.map((f) => `changed: ${f}`), ...extra.map((f) => `extra: ${f}`)].join(', ')}): run \`npm run generate -w @gurps-sheet/npcs\`.`);
    process.exit(1);
  }
  console.log(`data/ is up to date (${npcs.length} NPCs).`);
} else {
  for (const f of current.filter((f) => !files.has(f))) rmSync(join(dataDir, f));
  for (const [file, text] of files) {
    mkdirSync(dirname(join(dataDir, file)), { recursive: true });
    writeFileSync(join(dataDir, file), text);
  }
  console.log(`wrote ${npcs.length} NPCs to data/.`);
}
