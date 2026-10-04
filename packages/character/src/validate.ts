import { Ajv2020, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { schema, vocabulary } from './schemas.js';

// ajv-formats is CommonJS with only a default export; under Node ESM (and TS nodenext) the default import is
// module.exports, whose `.default` is the plugin itself.
const addFormats = addFormatsModule.default;

let compiled: ValidateFunction | undefined;
/** Compiles once, on first use (strict mode; x-gurps annotations are checked against the vocabulary). */
function validator(): ValidateFunction {
  if (!compiled) {
    const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true });
    addFormats(ajv);
    ajv.addKeyword({ keyword: 'x-gurps', metaSchema: vocabulary.$defs.annotation });
    ajv.addKeyword({ keyword: 'x-gurps-tables', metaSchema: vocabulary.$defs.tables });
    compiled = ajv.compile(schema);
  }
  return compiled;
}

export interface ValidationError {
  /** JSON Pointer of the offending value ('' = document root). */
  pointer: string;
  /** JSON Schema keyword that failed (required, type, enum, ...). */
  keyword: string;
  /** Keyword details (missingProperty, allowedValues, limit, ...). */
  params: Record<string, unknown>;
  /** Offending key, for invalid property names. */
  propertyName?: string;
  /** English description. */
  message: string;
}

/** Validates a document against the gurps-character schema (structure only; rule compliance is verifyCharacter()). */
export function validateCharacter(doc: unknown): { valid: boolean; errors: ValidationError[] } {
  const validate = validator();
  if (validate(doc)) return { valid: true, errors: [] };
  const errors = (validate.errors ?? [])
    .filter((e) => e.keyword !== 'propertyNames' && e.keyword !== 'if') // the specific child error is reported too
    .map((e): ValidationError => {
      const at = e.instancePath || '(root)';
      const message = e.propertyName !== undefined ? `${at}: invalid key "${e.propertyName}"`
        : e.keyword === 'additionalProperties' ? `${at}: unknown property "${String(e.params.additionalProperty)}"`
          : `${at}: ${e.message}`;
      return { pointer: e.instancePath ?? '', keyword: e.keyword, params: e.params ?? {}, ...(e.propertyName !== undefined ? { propertyName: e.propertyName } : {}), message };
    });
  return { valid: false, errors };
}
