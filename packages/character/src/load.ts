import type { GurpsCharacter } from './character.generated.js';
import { CharacterError } from './errors.js';
import { validateCharacter } from './validate.js';
import { verifyCharacter, type VerificationReport } from './verify.js';

import { FORMAT, LATEST_VERSION, SUPPORTED_MINOR, MAX_DOCUMENT_BYTES } from './constants.js';

export { FORMAT, LATEST_VERSION, SUPPORTED_MINOR, MAX_DOCUMENT_BYTES };

/** Line/column of a JSON.parse failure, when the engine reports a position. */
function jsonPosition(err: unknown, text: string): { line: number; column: number } | { truncated: boolean } {
  const msg = String((err as Error | undefined)?.message ?? '');
  const line = Number(/line (\d+)/.exec(msg)?.[1]);
  const column = Number(/column (\d+)/.exec(msg)?.[1]);
  if (line) return { line, column };
  const position = /position (\d+)/.exec(msg)?.[1];
  if (position === undefined) return { truncated: /end of (json|data)|unterminated/i.test(msg) };
  const before = text.slice(0, Number(position)).split('\n');
  return { line: before.length, column: (before.at(-1) ?? '').length + 1 };
}

/** Checks format and version (throws CharacterError); does not validate the schema. */
export function checkEnvelope(doc: unknown): { major: 1; minor: number } {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new CharacterError('notAnObject', 'A gurps-character document must be a JSON object.');
  }
  const { format, formatVersion } = doc as { format?: unknown; formatVersion?: unknown };
  if (format === 'gurps-sheet') {
    throw new CharacterError('legacyFormat', 'This is the legacy flat "gurps-sheet" format, which is not supported.', { format });
  }
  if (format !== FORMAT) {
    throw new CharacterError('wrongFormat', `"format" must be "${FORMAT}".`, { format: format ?? null });
  }
  const version = /^(\d+)\.(\d+)\.\d+$/.exec(typeof formatVersion === 'string' ? formatVersion : '');
  if (!version || version[1] !== '1') {
    throw new CharacterError('unsupportedVersion', `Unsupported formatVersion ${JSON.stringify(formatVersion ?? null)}; this library reads 1.0 to ${LATEST_VERSION}.`,
      { formatVersion: formatVersion ?? null, supported: `1.${SUPPORTED_MINOR}` });
  }
  if (Number(version[2]) > SUPPORTED_MINOR) {
    throw new CharacterError('newerVersion', `formatVersion ${String(formatVersion)} is newer than ${LATEST_VERSION}; update the library to read it.`,
      { formatVersion, supported: `1.${SUPPORTED_MINOR}` });
  }
  return { major: 1, minor: Number(version[2]) };
}

/**
 * Loads a character: JSON text (or an already-parsed object) -> validated document + independent rule report.
 * @throws {CharacterError} tooLarge | invalidJson | notAnObject | legacyFormat | wrongFormat | unsupportedVersion | newerVersion | schema
 */
export function parseCharacter(input: unknown, { maxBytes = MAX_DOCUMENT_BYTES }: { maxBytes?: number } = {}): { character: GurpsCharacter; report: VerificationReport } {
  let doc = input;
  if (typeof input === 'string') {
    if (input.length > maxBytes) {
      throw new CharacterError('tooLarge', `Document is ${input.length} bytes; the limit is ${maxBytes}.`, { size: input.length, limit: maxBytes });
    }
    try {
      doc = JSON.parse(input);
    } catch (err) {
      throw new CharacterError('invalidJson', `Invalid JSON: ${(err as Error).message}`, jsonPosition(err, input));
    }
  }
  checkEnvelope(doc);
  const { valid, errors } = validateCharacter(doc);
  if (!valid) throw new CharacterError('schema', `Document does not match the gurps-character schema (${errors.length} error(s)).`, { errors });
  const character = doc as GurpsCharacter; // the schema validated it
  return { character, report: verifyCharacter(character) };
}

/**
 * Serializes a character to JSON text, refusing to write an invalid document.
 * @throws {CharacterError} schema
 */
export function serializeCharacter(doc: GurpsCharacter, { space = 2 }: { space?: number } = {}): string {
  checkEnvelope(doc);
  const { valid, errors } = validateCharacter(doc);
  if (!valid) throw new CharacterError('schema', `Refusing to serialize an invalid document (${errors.length} error(s)).`, { errors });
  return `${JSON.stringify(doc, null, space)}\n`;
}
