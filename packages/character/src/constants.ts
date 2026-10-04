// Format constants, dependency-free (importable without pulling in the Ajv validator).
export const FORMAT = 'gurps-character';
/** Latest format version this library understands; it reads every 1.x up to this minor. */
export const LATEST_VERSION = '1.3.0';
export const SUPPORTED_MINOR = Number(LATEST_VERSION.split('.')[1]);
export const MAX_DOCUMENT_BYTES = 2_000_000;
