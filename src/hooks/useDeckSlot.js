/**
 * useDeckSlot — custom hook encapsulating all per-deck mutable state.
 *
 * Exports:
 *   defaultDeckSlot(saved)   — creates an initial slot object from persisted data
 *   serializeDeckSlot(slot)  — converts a slot to a JSON-safe object for persistence
 *   makeSlotSetter(setSlot)  — factory: (key) => (valOrFn) => void
 *   useDeckSlot(saved)       — React hook: returns { slot, setSlot, set }
 */

import { useState } from 'react';

// =============================================================================
// Slot initialiser
// =============================================================================
export const defaultDeckSlot = (saved = {}) => ({
  deckText: saved.deckText ?? '',
  parsedDeck: null,
  selectedKeyCards: new Set(saved.selectedKeyCards ?? []),
  includeArtifacts: saved.includeArtifacts ?? true,
  disabledArtifacts: new Set(saved.disabledArtifacts ?? []),
  includeCreatures: saved.includeCreatures ?? true,
  disabledCreatures: new Set(saved.disabledCreatures ?? []),
  manaOverrides: saved.manaOverrides ?? {},
  includeExploration: saved.includeExploration ?? true,
  disabledExploration: new Set(saved.disabledExploration ?? []),
  includeRampSpells: saved.includeRampSpells ?? true,
  disabledRampSpells: new Set(saved.disabledRampSpells ?? []),
  includeRituals: saved.includeRituals ?? true,
  disabledRituals: new Set(saved.disabledRituals ?? []),
  includeCostReducers: saved.includeCostReducers ?? true,
  disabledCostReducers: new Set(saved.disabledCostReducers ?? []),
  includeDrawSpells: saved.includeDrawSpells ?? true,
  disabledDrawSpells: new Set(saved.disabledDrawSpells ?? []),
  drawOverrides: saved.drawOverrides ?? {},
  includeTreasures: saved.includeTreasures ?? true,
  disabledTreasures: new Set(saved.disabledTreasures ?? []),
  treasureOverrides: saved.treasureOverrides ?? {},
  ritualOverrides: saved.ritualOverrides ?? {},
  simulationResults: null,
});

// =============================================================================
// Serialiser — strips non-JSON-safe types (Set → Array, drops runtime fields)
// =============================================================================
export const serializeDeckSlot = slot => ({
  deckText: slot.deckText,
  selectedKeyCards: [...slot.selectedKeyCards],
  includeArtifacts: slot.includeArtifacts,
  disabledArtifacts: [...slot.disabledArtifacts],
  includeCreatures: slot.includeCreatures,
  disabledCreatures: [...slot.disabledCreatures],
  manaOverrides: slot.manaOverrides,
  includeExploration: slot.includeExploration,
  disabledExploration: [...slot.disabledExploration],
  includeRampSpells: slot.includeRampSpells,
  disabledRampSpells: [...slot.disabledRampSpells],
  includeRituals: slot.includeRituals,
  disabledRituals: [...slot.disabledRituals],
  includeCostReducers: slot.includeCostReducers,
  disabledCostReducers: [...slot.disabledCostReducers],
  includeDrawSpells: slot.includeDrawSpells,
  disabledDrawSpells: [...slot.disabledDrawSpells],
  drawOverrides: slot.drawOverrides,
  includeTreasures: slot.includeTreasures,
  disabledTreasures: [...slot.disabledTreasures],
  treasureOverrides: slot.treasureOverrides,
  ritualOverrides: slot.ritualOverrides,
});

// =============================================================================
// Setter factory — creates a key → value/fn updater for any slot field
// =============================================================================
export const makeSlotSetter = setSlot => key => valOrFn =>
  setSlot(prev => ({
    ...prev,
    [key]: typeof valOrFn === 'function' ? valOrFn(prev[key]) : valOrFn,
  }));

// =============================================================================
// Hook
// =============================================================================
/**
 * @param {object} saved - Persisted slot data (from localStorage or URL hash).
 * @returns {{ slot: object, setSlot: Function, set: Function }}
 *   `set` is a curried setter: set('fieldName')(newValue | updaterFn)
 */
export const useDeckSlot = (saved = {}) => {
  const [slot, setSlot] = useState(() => defaultDeckSlot(saved));
  const set = makeSlotSetter(setSlot);
  return { slot, setSlot, set };
};
