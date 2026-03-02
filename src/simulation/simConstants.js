/**
 * simConstants.js
 *
 * Shared constants used across the simulation pipeline and UI.
 * This file MUST remain free of React imports so it can be safely imported
 * by both the main thread (App.jsx) and the simulation Web Worker
 * (simulationWorker.js).
 */

/**
 * Names of all config fields whose values are JavaScript Sets.
 *
 * Sets cannot be cloned via the browser's structured-clone algorithm (used by
 * postMessage), so they must be serialised to plain Arrays before the message
 * is sent and rehydrated back to Sets on receipt inside the worker.
 *
 * This constant is the single source of truth shared by:
 *   App.jsx              — serializeConfig()
 *   simulationWorker.js  — rehydration on message receipt
 */
export const SIM_SET_FIELDS = [
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
