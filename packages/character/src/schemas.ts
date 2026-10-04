// The bundled schemas, typed. The relative paths resolve the same from src/ and dist/.
import schemaJson from '../schema/gurps-character.schema.json' with { type: 'json' };
import vocabularyJson from '../schema/x-gurps-vocabulary.schema.json' with { type: 'json' };
import type { CharacterSchema, SchemaNode } from './schema-types.js';

/** The JSON Schema (draft 2020-12) with x-gurps annotations and rule tables. */
export const schema = schemaJson as unknown as CharacterSchema;

/** Meta-schema of the x-gurps annotation vocabulary. */
export const vocabulary = vocabularyJson as unknown as SchemaNode & { $defs: { annotation: SchemaNode; tables: SchemaNode } };
