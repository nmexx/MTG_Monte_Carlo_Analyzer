/**
 * simulationCore.js
 *
 * Public re-export surface for the simulation sub-modules.
 * All implementation has been split into focused files for maintainability:
 *
 *   simHelpers.js  – shared constants (SUBTYPE_TO_COLOR, PAIN_LAND_ACTIVE_TURNS, …)
 *                    and pure helpers (parseColorPips, getAllSpells)
 *   landUtils.js   – doesLandEnterTapped, selectBestLand, findBestLandToFetch, playLand,
 *                    matchesRampFilter
 *   manaUtils.js   – tapManaSources, calculateManaAvailability, calculateCostDiscount,
 *                    solveColorPips, canPlayCard
 *   castSpells.js  – castSpells (all 4 casting phases + _runCastingLoop)
 *
 * This file retains shuffle, calculateBattlefieldDamage, and enforceHandSizeLimit,
 * and re-exports everything else so existing callers (monteCarlo.js, tests) are
 * unaffected without any import-path changes.
 */

import { PAIN_LAND_ACTIVE_TURNS } from './simHelpers.js';

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports — backward-compat public API for monteCarlo.js and test files
// ─────────────────────────────────────────────────────────────────────────────

export {
  matchesRampFilter,
  doesLandEnterTapped,
  selectBestLand,
  findBestLandToFetch,
  playLand,
} from './landUtils.js';

export {
  tapManaSources,
  calculateManaAvailability,
  calculateCostDiscount,
  solveColorPips,
  canPlayCard,
} from './manaUtils.js';

export { castSpells } from './castSpells.js';

// ─────────────────────────────────────────────────────────────────────────────
// shuffle
// ─────────────────────────────────────────────────────────────────────────────

export const shuffle = array => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// ─────────────────────────────────────────────────────────────────────────────
// calculateBattlefieldDamage
//   Returns the total life loss from self-damaging permanents for a given turn,
//   plus a breakdown array for action-log messages.
//   `turn` is 0-based (matches the monteCarlo loop variable).
// ─────────────────────────────────────────────────────────────────────────────
export const calculateBattlefieldDamage = (battlefield, turn) => {
  const breakdown = [];
  let total = 0;

  // Mana Crypt (50% coin-flip = 1.5 avg per copy)
  const cryptCount = battlefield.filter(
    p => p.card.isManaArtifact && p.card.name?.toLowerCase() === 'mana crypt'
  ).length;
  if (cryptCount > 0) {
    const dmg = cryptCount * 1.5;
    total += dmg;
    breakdown.push(`Mana Crypt damage: -${dmg} life (avg)`);
  }

  // Ancient Tomb
  const tombDmg = battlefield
    .filter(p => p.card.isLand && p.card.isAncientTomb)
    .reduce((s, p) => s + (p.card.lifeloss ?? 2), 0);
  if (tombDmg > 0) {
    total += tombDmg;
    breakdown.push(`Ancient Tomb damage: -${tombDmg} life`);
  }

  // Pain Lands & Starting Town (only active during early turns)
  if (turn <= PAIN_LAND_ACTIVE_TURNS) {
    const painDmg = battlefield
      .filter(p => p.card.isLand && (p.card.isPainLand || p.card.name === 'starting town'))
      .reduce((s, p) => s + (p.card.lifeloss ?? 1), 0);
    if (painDmg > 0) {
      total += painDmg;
      breakdown.push(`Pain Land damage: -${painDmg} life`);
    }

    // Horizon Lands (Pay 1 life to produce colored mana — no colorless opt-out)
    const horizonDmg = battlefield
      .filter(p => p.card.isLand && p.card.isHorizonLand)
      .reduce((s, p) => s + (p.card.lifeloss ?? 1), 0);
    if (horizonDmg > 0) {
      total += horizonDmg;
      breakdown.push(`Horizon Land damage: -${horizonDmg} life`);
    }

    // Talismans (1 damage per talisman tapped for colored mana)
    const taliDmg = battlefield
      .filter(p => p.card.isTalisman)
      .reduce((s, p) => s + (p.card.lifeloss ?? 1), 0);
    if (taliDmg > 0) {
      total += taliDmg;
      breakdown.push(`Talisman damage: -${taliDmg} life`);
    }
  }

  // 5-Color Pain Lands (only when tapped)
  const fiveDmg = battlefield
    .filter(p => p.card.isLand && p.card.isFiveColorPainLand && p.tapped)
    .reduce((s, p) => s + (p.card.lifeloss ?? 1), 0);
  if (fiveDmg > 0) {
    total += fiveDmg;
    breakdown.push(`5-Color Pain Land damage: -${fiveDmg} life`);
  }

  return { total, breakdown };
};

// ─────────────────────────────────────────────────────────────────────────────
// enforceHandSizeLimit
//   Discards cards from `hand` down to `maxHandSize` at end of turn.
//   · If `battlefield` has >= `floodNLands` lands → the player is flooded:
//     prefer discarding lands from hand (tapped-entering ones first).
//   · Otherwise → prefer discarding the highest-CMC non-land spells (mana
//     screw or normal discard).
//   Discarded cards are moved to `graveyard`; each discard is logged.
// ─────────────────────────────────────────────────────────────────────────────
export const enforceHandSizeLimit = (
  hand,
  graveyard,
  maxHandSize,
  battlefield,
  floodNLands = 5,
  turnLog = null
) => {
  if (hand.length <= maxHandSize) return;

  const landCountOnBF = battlefield.filter(p => p.card.isLand).length;
  const isFlooded = landCountOnBF >= floodNLands;

  while (hand.length > maxHandSize) {
    let toDiscard = null;

    if (isFlooded) {
      // Flooded: discard a land from hand, preferring tapped-entering basics
      const landsInHand = hand.filter(c => c.isLand);
      if (landsInHand.length > 0) {
        toDiscard =
          landsInHand.find(l => l.entersTappedAlways && l.isBasic) ??
          landsInHand.find(l => l.entersTappedAlways) ??
          landsInHand[0];
      }
    }

    if (!toDiscard) {
      // Not flooded, or no lands in hand: discard highest-CMC non-land
      const nonLands = hand.filter(c => !c.isLand);
      if (nonLands.length > 0) {
        toDiscard = nonLands.reduce(
          (best, c) => ((c.cmc ?? 0) >= (best.cmc ?? 0) ? c : best),
          nonLands[0]
        );
      } else {
        // Only lands in hand — discard one
        const basics = hand.filter(c => c.isBasic);
        toDiscard = basics[0] ?? hand[0];
      }
    }

    hand.splice(hand.indexOf(toDiscard), 1);
    graveyard.push(toDiscard);
    if (turnLog) {
      const reason = isFlooded && toDiscard.isLand ? ' (flood discard)' : ' (hand size limit)';
      turnLog.actions.push(`Discarded: ${toDiscard.name}${reason}`);
    }
  }
};
