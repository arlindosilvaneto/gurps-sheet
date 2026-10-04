// Generates types/character.d.ts (the document types) from schema/gurps-character.schema.json.
//   node scripts/generate-types.mjs          write the file
//   node scripts/generate-types.mjs --check  fail if the committed file is out of date (run by `npm test`)
import { readFileSync, writeFileSync } from 'node:fs';
import { compile } from 'json-schema-to-typescript';

const root = new URL('../', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('schema/gurps-character.schema.json', root)));
const target = new URL('types/character.d.ts', root);

const banner = '// Generated from schema/gurps-character.schema.json by scripts/generate-types.mjs — do not edit by hand.\n';
const ts = await compile(schema, 'GurpsCharacter', { bannerComment: '', additionalProperties: false, unknownAny: true, format: true });
const output = banner + ts.replace(/\bGURPS4ThEditionCharacter\b/g, 'GurpsCharacter');

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch { /* missing counts as stale */ }
  if (current !== output) {
    console.error('types/character.d.ts is out of date with the schema: run `npm run types -w @gurps-sheet/character`.');
    process.exit(1);
  }
  console.log('types/character.d.ts is up to date.');
} else {
  writeFileSync(target, output);
  console.log('wrote types/character.d.ts');
}
