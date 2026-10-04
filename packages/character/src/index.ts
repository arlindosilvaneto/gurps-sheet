// @gurps-sheet/character — load, validate, verify and update GURPS 4e characters exported by the sheet editor.
//
//   import { parseCharacter, verifyCharacter, applyDamage, serializeCharacter } from '@gurps-sheet/character';
//
// Light-weight subpath for engines that only need the rule formulas (no Ajv):
//   import { recompute, deviations, evaluate } from '@gurps-sheet/character/formula';

export type * from './character.generated.js';
export type * from './schema-types.js';
export { schema, vocabulary } from './schemas.js';
export { CharacterError, type CharacterErrorCode } from './errors.js';
export { validateCharacter, type ValidationError } from './validate.js';
export { verifyCharacter, type VerificationReport, type ReportedDeviation, type Inconsistency, type RuleIssue } from './verify.js';
export { parseCharacter, serializeCharacter, checkEnvelope, FORMAT, LATEST_VERSION, SUPPORTED_MINOR, MAX_DOCUMENT_BYTES } from './load.js';
export {
  getUpdatableFields, updateCharacter, getPool, applyDamage, heal, spendFatigue, recoverFatigue,
  type UpdatableField, type Changes, type Pool, type PoolName,
} from './update.js';
export { combatStats, type CombatStats } from './stats.js';
export {
  evaluate, parse as parseFormula, recompute, deviations, parseDice, roundUp, resolveSchemaRef, plainValue,
  type DiceValue, type FormulaValue, type FormulaNode, type Scalar, type EvaluationContext, type RecomputeResult, type RuleDeviation,
} from './formula.js';
