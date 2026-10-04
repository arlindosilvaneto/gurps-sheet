import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../schema/gurps-character.schema.json' with { type: 'json' };
import vocabulary from '../schema/x-gurps-vocabulary.schema.json' with { type: 'json' };

let compiled;
/** Compiles once, on first use (strict mode; x-gurps annotations are checked against the vocabulary). */
function validator() {
  if (!compiled) {
    const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
    addFormats(ajv);
    ajv.addKeyword({ keyword: 'x-gurps', metaSchema: vocabulary.$defs.annotation });
    ajv.addKeyword({ keyword: 'x-gurps-tables', metaSchema: vocabulary.$defs.tables });
    compiled = ajv.compile(schema);
  }
  return compiled;
}

/**
 * @typedef {object} ValidationError
 * @property {string} pointer JSON Pointer of the offending value ('' = document root)
 * @property {string} keyword JSON Schema keyword that failed (required, type, enum, ...)
 * @property {object} params keyword details (missingProperty, allowedValues, limit, ...)
 * @property {string} [propertyName] offending key, for invalid property names
 * @property {string} message English description
 */

/**
 * Validates a document against the gurps-character schema (structure only; rule compliance is verifyCharacter()).
 * @returns {{ valid: boolean, errors: ValidationError[] }}
 */
export function validateCharacter(doc) {
  const validate = validator();
  if (validate(doc)) return { valid: true, errors: [] };
  const errors = validate.errors
    .filter((e) => e.keyword !== 'propertyNames' && e.keyword !== 'if') // the specific child error is reported too
    .map((e) => {
      const at = e.instancePath || '(root)';
      const message = e.propertyName !== undefined ? `${at}: invalid key "${e.propertyName}"`
        : e.keyword === 'additionalProperties' ? `${at}: unknown property "${e.params.additionalProperty}"`
          : `${at}: ${e.message}`;
      return { pointer: e.instancePath ?? '', keyword: e.keyword, params: e.params ?? {}, ...(e.propertyName !== undefined ? { propertyName: e.propertyName } : {}), message };
    });
  return { valid: false, errors };
}
