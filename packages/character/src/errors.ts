export type CharacterErrorCode =
  | 'tooLarge' | 'invalidJson' | 'notAnObject' | 'legacyFormat' | 'wrongFormat'
  | 'unsupportedVersion' | 'newerVersion' | 'schema'
  | 'notUpdatable' | 'invalidValue' | 'outOfBounds' | 'invalidAmount';

/**
 * Every failure the library reports. `code` is stable (switch on it, translate it); `message` is English;
 * `details` carries the data needed to build a localized message (e.g. { line, column } for invalidJson,
 * { errors } for schema).
 */
export class CharacterError extends Error {
  override readonly name = 'CharacterError';
  readonly code: CharacterErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: CharacterErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}
