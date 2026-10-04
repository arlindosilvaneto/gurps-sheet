// @gurps-sheet/character — load, validate, verify and update GURPS 4e characters exported by the sheet editor.
//
//   import { parseCharacter, verifyCharacter, applyDamage, serializeCharacter } from '@gurps-sheet/character';
//
// Light-weight subpath for engines that only need the rule formulas (no Ajv):
//   import { recompute, deviations, evaluate } from '@gurps-sheet/character/formula';

import schema from '../schema/gurps-character.schema.json' with { type: 'json' };
import vocabulary from '../schema/x-gurps-vocabulary.schema.json' with { type: 'json' };

export { schema, vocabulary };
export { CharacterError } from './errors.js';
export { validateCharacter } from './validate.js';
export { verifyCharacter } from './verify.js';
export { parseCharacter, serializeCharacter, checkEnvelope, FORMAT, LATEST_VERSION, SUPPORTED_MINOR, MAX_DOCUMENT_BYTES } from './load.js';
export { getUpdatableFields, updateCharacter, getPool, applyDamage, heal, spendFatigue, recoverFatigue } from './update.js';
export { combatStats } from './stats.js';
export { evaluate, parse as parseFormula, recompute, deviations, parseDice, roundUp, resolveSchemaRef } from './formula.js';
