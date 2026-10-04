/**
 * Every failure the library reports. `code` is stable (switch on it, translate it); `message` is English;
 * `details` carries the data needed to build a localized message.
 *
 * Codes: tooLarge, invalidJson, notAnObject, legacyFormat, wrongFormat, unsupportedVersion, newerVersion,
 * schema, notUpdatable, invalidValue, outOfBounds, invalidAmount.
 */
export class CharacterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CharacterError';
    this.code = code;
    this.details = details;
  }
}
