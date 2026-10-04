// Prints each NPC's point breakdown, defenses and skill levels: a quick check while writing or tuning definitions.
//   npm run report -w @gurps-sheet/npcs [-- <style>]
import { verifyCharacter } from '@gurps-sheet/character';
import { buildNpc } from '../src/build.js';
import { DEFINITIONS } from '../src/styles/index.js';

const style = process.argv[2];
for (const def of DEFINITIONS.filter((d) => !style || d.style === style)) {
  try {
    const doc = buildNpc(def);
    const b = doc.points.breakdown;
    const d = doc.defenses;
    console.log(`${def.id.padEnd(36)} ${String(doc.points.spent).padStart(4)}/${def.budget}  attr ${b.attributes} adv ${b.advantages} dis ${b.disadvantages} sk ${b.skills}`
      + `  | dodge ${d.dodge.value} parry ${d.parry.value ?? '-'} block ${d.block.value ?? '-'}${verifyCharacter(doc).rulesCompliant ? '' : '  NOT COMPLIANT'}`);
    console.log(`    ${doc.skills.map((k) => `${k.name} ${k.level}`).join(', ')}`);
  } catch (err) {
    console.log(`${def.id.padEnd(36)} ERROR ${(err as Error).message}`);
  }
}
