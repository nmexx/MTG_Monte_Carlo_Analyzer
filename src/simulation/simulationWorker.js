/**
 * simulationWorker.js
 *
 * ES-module Web Worker for the Monte Carlo simulation engine.
 *
 * Message protocol
 * ────────────────
 * Incoming  { type: 'RUN', deckId, deckToParse, config }
 *   config.selectedKeyCards / disabled* are plain arrays (Sets cannot be
 *   cloned via structured clone), rehydrated to Sets on arrival.
 *
 * Outgoing
 *   { type: 'PROGRESS', deckId, completed, total }   — every ~250 iterations
 *   { type: 'RESULT',   deckId, results }             — on success
 *   { type: 'ERROR',    deckId, message }             — on failure
 */

import { monteCarlo } from './monteCarlo.js';

/** Fields whose values are serialised as Arrays in the message payload. */
const SET_FIELDS = [
  'selectedKeyCards',
  'disabledExploration',
  'disabledRampSpells',
  'disabledArtifacts',
  'disabledCreatures',
  'disabledRituals',
  'disabledCostReducers',
  'disabledDrawSpells',
  'disabledTreasures',
];

self.onmessage = ({ data }) => {
  if (data.type !== 'RUN') return;

  const { deckId, deckToParse, config } = data;

  // Rehydrate arrays → Sets so monteCarlo receives the expected types.
  const rehydrated = { ...config };
  SET_FIELDS.forEach(field => {
    rehydrated[field] = new Set(config[field] ?? []);
  });

  try {
    const results = monteCarlo(deckToParse, rehydrated, (completed, total) => {
      self.postMessage({ type: 'PROGRESS', deckId, completed, total });
    });
    self.postMessage({ type: 'RESULT', deckId, results });
  } catch (err) {
    self.postMessage({ type: 'ERROR', deckId, message: err.message ?? String(err) });
  }
};
