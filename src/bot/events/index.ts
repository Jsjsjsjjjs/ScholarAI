import * as interactionCreate from './interactionCreate.js';
import * as ready from './ready.js';

export const allEvents: any[] = [
  interactionCreate.default || interactionCreate,
  ready.default || ready,
];
