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
import { SIM_SET_FIELDS } from './simConstants.js';

/** Fields whose values are serialised as Arrays in the message payload.
 * Imported from simConstants.js — the single source of truth shared with App.jsx.
 */
// SIM_SET_FIELDS imported above

self.onmessage = ({ data }) => {
  if (data.type !== 'RUN') return;

  const { deckId, deckToParse, config } = data;

  // Rehydrate arrays → Sets so monteCarlo receives the expected types.
  const rehydrated = { ...config };
  SIM_SET_FIELDS.forEach(field => {
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
