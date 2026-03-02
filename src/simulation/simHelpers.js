/**
 * simHelpers.js
 *
 * Low-level constants and pure helper functions shared across the simulation
 * sub-modules.  This file has NO imports from other simulation files so it
 * can be safely imported by any of them without creating circular dependencies.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Module-level lookup tables
// ─────────────────────────────────────────────────────────────────────────────

/** Maps a basic-land subtype to its color symbol (used by fetch logic). */
export const SUBTYPE_TO_COLOR = {
  Plains: 'W',
  Island: 'U',
  Swamp: 'B',
  Mountain: 'R',
  Forest: 'G',
};

/** Maps a color symbol to its basic-land subtype name (used by check-land logic). */
export const COLOR_TO_SUBTYPE = {
  W: 'Plains',
  U: 'Island',
  B: 'Swamp',
  R: 'Mountain',
  G: 'Forest',
};

/**
 * Pain lands, horizon lands, and talismans only deal damage during the early
 * turns of the game.  Turns beyond this threshold are ignored.
 */
export const PAIN_LAND_ACTIVE_TURNS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Shared pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts all colored-pip symbols from a mana cost string and returns them
 * as a plain string array.  e.g. '{2}{G}{U}' → ['G', 'U'].
 * Used wherever the same /\{([^}]+)\}/g + filter pattern was duplicated.
 */
export const parseColorPips = manaCost =>
  (manaCost?.match(/\{([^}]+)\}/g) ?? [])
    .map(s => s.replace(/[{}]/g, ''))
    .filter(c => ['W', 'U', 'B', 'R', 'G'].includes(c));

/**
 * Returns a flat array of every non-land card across the three spell buckets
 * of a parsed deck.  Single canonical definition consumed by fetchland scoring,
 * Thriving Land pip analysis, and any future caller.
 */
export const getAllSpells = parsedDeck => [
  ...(parsedDeck?.spells ?? []),
  ...(parsedDeck?.creatures ?? []),
  ...(parsedDeck?.artifacts ?? []),
];
