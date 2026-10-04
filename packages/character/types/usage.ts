// Compile-only check of the public type declarations (`npm run typecheck`); never executed.
import {
  parseCharacter, verifyCharacter, applyDamage, heal, updateCharacter, getUpdatableFields, combatStats,
  serializeCharacter, CharacterError, type GurpsCharacter, type VerificationReport, type CombatStats,
} from '@gurps-sheet/character';
import { recompute, deviations, evaluate } from '@gurps-sheet/character/formula';

declare const text: string;

const { character, report }: { character: GurpsCharacter; report: VerificationReport } = parseCharacter(text);
const ok: boolean = report.rulesCompliant && verifyCharacter(character).claimConsistent;
const hurt: GurpsCharacter = applyDamage(character, 5);
const healed: GurpsCharacter = heal(hurt, 2, { now: new Date() });
const set: GurpsCharacter = updateCharacter(healed, { '/secondary/fp/current': 3 });
const pointers: string[] = getUpdatableFields().map((f) => f.pointer);
const stats: CombatStats = combatStats(set);
const hp: number = stats.hp.current;
const swing: string = stats.damage.swing.notation;
const json: string = serializeCharacter(set);
const st: number = character.attributes.st.value;
const skillName: string | undefined = character.skills[0]?.name;
const formulas = recompute({}, character).map((r) => r.pointer);
const flagged = deviations({}, character).filter((d) => d.reason === 'override');
const value = evaluate('1 + 2', { root: character, tables: {} });

try {
  updateCharacter(character, { '/attributes/st/value': 20 });
} catch (err) {
  if (err instanceof CharacterError && err.code === 'notUpdatable') console.log(err.details);
}

export { ok, pointers, hp, swing, json, st, skillName, formulas, flagged, value };
