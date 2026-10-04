// Browser-side schema validator. Loaded on demand (Ajv is large) when a sheet is saved or opened.
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../schema/gurps-character.schema.json';
import vocabulary from '../schema/x-gurps-vocabulary.schema.json';
import { createValidator } from './character.js';

export const validateCharacter = createValidator(Ajv2020, addFormats, schema, vocabulary);
