/**
 * manaUtils.js
 *
 * Mana accounting: tapping sources, computing availability, cost discounts,
 * pip-matching, and castability checks.
 * Extracted from simulationCore.js for maintainability.
 *
 * Exports:
 *   tapManaSources            – marks battlefield sources tapped to pay for a spell
 *   calculateManaAvailability – total + per-color mana pool from the battlefield
 *   calculateCostDiscount     – generic-mana discount from cost-reducer permanents
 *   solveColorPips            – bipartite-matching pip feasibility solver
 *   canPlayCard               – returns true when mana can pay for a card
 */

import { SIMPLIFY_MOX_CONDITIONS } from '../../card_data/Artifacts.js';
import { parseColorPips } from './simHelpers.js';

// ─────────────────────────────────────────────────────────────────────────────
// tapManaSources
// ─────────────────────────────────────────────────────────────────────────────
export const tapManaSources = (spell, battlefield, discount = 0) => {
  const colorPips = parseColorPips(spell.manaCost);
  const colorNeeds = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  colorPips.forEach(c => colorNeeds[c]++);
  let totalNeeded = colorPips.length;
  (spell.manaCost?.match(/\{([^}]+)\}/g) ?? []).forEach(symbol => {
    const clean = symbol.replace(/[{}]/g, '');
    if (!isNaN(parseInt(clean))) totalNeeded += parseInt(clean);
  });

  // Apply cost discount — never reduce below the total colored-pip requirement
  if (discount > 0) {
    const colorPipTotal = Object.values(colorNeeds).reduce((s, v) => s + v, 0);
    totalNeeded = Math.max(colorPipTotal, totalNeeded - discount);
  }

  ['W', 'U', 'B', 'R', 'G'].forEach(color => {
    let needed = colorNeeds[color];
    if (needed === 0) return;
    const sources = battlefield.filter(
      p => !p.tapped && p.card.produces?.includes(color) && (!p.summoningSick || p.card.isLand)
    );
    for (const source of sources) {
      if (needed <= 0) break;
      source.tapped = true;
      needed--;
      totalNeeded--;
    }
  });

  // Only tap permanents that actually produce mana (excludes cost reducers, tokens, etc.)
  const untappedSources = battlefield.filter(
    p => !p.tapped && p.card.produces?.length > 0 && (!p.summoningSick || p.card.isLand)
  );
  for (const source of untappedSources) {
    if (totalNeeded <= 0) break;
    source.tapped = true;
    totalNeeded -= source.card.manaAmount || 1;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// calculateManaAvailability
// ─────────────────────────────────────────────────────────────────────────────
export const calculateManaAvailability = (battlefield, turn = 999) => {
  const colors = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  let total = 0;
  // sources: one entry per mana unit available for bipartite pip-matching
  const sources = [];
  const moxSimpleTurn = 2;

  const addManaSource = (produces, amt) => {
    total += amt;
    produces.forEach(color => {
      colors[color] = (colors[color] || 0) + amt;
    });
    for (let i = 0; i < amt; i++) sources.push({ produces: [...produces] });
  };

  // Filter lands require a specific payment to produce coloured mana.
  // Collect them here and process in a second pass after all other mana is tallied.
  // filterLandsToProcess    – Shadowmoor cycle: cost = {A} or {B} (one of its own colors)
  // odysseyFilterLandsToProcess – Odyssey/Fallout: cost = {1} (any generic mana)
  const filterLandsToProcess = [];
  const odysseyFilterLandsToProcess = [];

  battlefield
    .filter(p => !p.tapped)
    .forEach(permanent => {
      const card = permanent.card;
      if (card.isLand) {
        // ── Filter lands: defer to second pass ──────────────────────────────
        if (card.isFilterLand) {
          filterLandsToProcess.push(card);
          return;
        }
        if (card.isOdysseyFilterLand) {
          odysseyFilterLandsToProcess.push(card);
          return;
        }

        // ── Verge lands: secondary color requires matching land type ─────────
        // Primary is always available; secondary only when the required subtype
        // is already on the battlefield.
        if (card.isVerge) {
          const hasRequiredType = card.vergeSecondaryCheck
            ? battlefield.some(
                p => p.card.isLand && p.card.landSubtypes?.includes(card.vergeSecondaryCheck)
              )
            : false;
          const vergeProduces = hasRequiredType
            ? card.produces
            : [card.vergePrimary ?? card.produces[0]];
          addManaSource(vergeProduces, 1);
          return;
        }

        let amt;
        if (card.scalesWithSwamps) {
          // Cabal Coffers: {2},{T} → {B} for each Swamp you control. Net = swampCount - 2.
          const swampCount = battlefield.filter(
            p => p.card.isLand && p.card.landSubtypes?.includes('Swamp')
          ).length;
          amt = Math.max(0, swampCount - 2);
        } else if (card.scalesWithBasicSwamps) {
          // Cabal Stronghold: {2},{T} → {B} for each basic Swamp. Net = basicSwampCount - 2.
          const basicSwampCount = battlefield.filter(
            p => p.card.isLand && p.card.isBasic && p.card.landSubtypes?.includes('Swamp')
          ).length;
          amt = Math.max(0, basicSwampCount - 2);
        } else if (card.isPhyrexianTower) {
          // Phyrexian Tower: {T}={C} normally, or {T}+sac creature={B}{B}.
          // If a creature is on the battlefield, produce 2 {B}; otherwise 1 {C}.
          const hasCreature = battlefield.some(
            p =>
              (p.card.isManaCreature || p.card.type?.toLowerCase().includes('creature')) &&
              !p.summoningSick
          );
          if (hasCreature) {
            addManaSource(['B'], 2); // sac a creature for {B}{B}
          } else {
            addManaSource(['C'], 1); // {T} for {C}
          }
          return; // handled inline above
        } else if (card.isTempleOfFalseGod) {
          // Temple of the False God: only produces {C}{C} with 5+ lands.
          const landCount = battlefield.filter(p => p.card.isLand).length;
          if (landCount >= 5) {
            amt = 2;
          } else {
            return; // no mana produced
          }
        } else if (card.simplifiedMana === 'turn-1') {
          // Simplified scaling lands (Gaea's Cradle, Nykthos, etc.): mana = max(floor, turn-1).
          amt = Math.max(card.manaFloor ?? 1, turn - 1);
        } else {
          amt = card.manaAmount || 1;
        }
        if (amt > 0) addManaSource(card.produces, amt);
      } else if (card.isManaArtifact) {
        if (card.isMoxOpal && !(SIMPLIFY_MOX_CONDITIONS && turn >= moxSimpleTurn)) {
          const artCount = battlefield.filter(
            p => p.card.type?.includes('artifact') || p.card.isManaArtifact
          ).length;
          if (artCount < 3) return;
        }
        if (card.isMoxAmber && !(SIMPLIFY_MOX_CONDITIONS && turn >= moxSimpleTurn)) {
          const legendaries = battlefield.filter(
            p => p.card.oracleText?.includes('Legendary') || p.card.type?.includes('Legendary')
          );
          if (legendaries.length === 0) return;
        }
        if (card.manaScaling) {
          const turnsActive = Math.max(0, turn - (permanent.enteredOnTurn ?? turn));
          addManaSource(
            card.produces,
            card.manaScaling.base + card.manaScaling.growth * turnsActive
          );
        } else {
          addManaSource(card.produces, card.manaAmount || 1);
        }
      } else if (card.isManaCreature && !permanent.summoningSick) {
        if (card.manaScaling) {
          // subtract 1 because the creature missed the turn it entered (summoning sickness)
          const turnsActive = Math.max(0, turn - (permanent.enteredOnTurn ?? turn) - 1);
          addManaSource(
            card.produces,
            card.manaScaling.base + card.manaScaling.growth * turnsActive
          );
        } else {
          addManaSource(card.produces, card.manaAmount || 1);
        }
      }
    });

  // ── Second pass A: Shadowmoor Filter Lands ───────────────────────────────
  // Mode 1: {T} → {C} (no cost, always available).
  // Mode 2: {A} or {B}, {T} → {A}{A}/{A}{B}/{B}{B}.
  // Activation requires one mana source that produces A or B (the land's own
  // colors). Generic colorless ({C}) cannot pay this cost.
  const _applyFilterLands = () => {
    filterLandsToProcess.forEach(card => {
      const coloredIdx = sources.findIndex(s => s.produces.some(c => card.produces.includes(c)));
      if (coloredIdx >= 0) {
        const [removed] = sources.splice(coloredIdx, 1);
        total--;
        removed.produces.forEach(c => {
          if (c in colors) colors[c] = Math.max(0, colors[c] - 1);
        });
        addManaSource(card.produces, 2);
      } else {
        addManaSource(['C'], 1);
      }
    });
  };

  // ── Second pass B: Odyssey / Fallout Filter Lands ─────────────────────────
  // Mode 1: {T} → {C} (no cost, always available).
  // Mode 2: {1}, {T} → {A}{A}/{A}{B}/{B}{B}.
  // Activation costs any 1 generic mana — colorless ({C}) qualifies.
  // Prefer consuming a colorless source to avoid spending a coloured pip.
  const _applyOdysseyFilterLands = () => {
    odysseyFilterLandsToProcess.forEach(card => {
      if (total >= 1) {
        const cIdx = sources.findIndex(s => s.produces.includes('C'));
        const removeIdx = cIdx >= 0 ? cIdx : 0;
        const [removed] = sources.splice(removeIdx, 1);
        total--;
        removed.produces.forEach(c => {
          if (c in colors) colors[c] = Math.max(0, colors[c] - 1);
        });
        addManaSource(card.produces, 2);
      } else {
        addManaSource(['C'], 1);
      }
    });
  };

  _applyFilterLands();
  _applyOdysseyFilterLands();

  return { total, colors, sources };
};

// ─────────────────────────────────────────────────────────────────────────────
// calculateCostDiscount
//   Returns the total generic-mana discount applicable to `card` based on
//   cost-reducer permanents currently on the battlefield.
//   Only the generic portion is discounted; colored pip requirements stay fixed.
// ─────────────────────────────────────────────────────────────────────────────
export const calculateCostDiscount = (card, battlefield) => {
  let discount = 0;
  for (const p of battlefield) {
    const r = p.card;
    if (!r.isCostReducer) continue;
    // Color restriction: reducer only applies to spells containing that pip
    if (r.reducesColor && !card.manaCost?.includes(`{${r.reducesColor}}`)) continue;
    // Type restriction
    if (r.reducesType === 'instant_or_sorcery') {
      const tl = card.typeLine || card.type || '';
      if (!/instant|sorcery/i.test(tl)) continue;
    } else if (r.reducesType === 'creature') {
      const tl = card.typeLine || card.type || '';
      if (!/creature/i.test(tl)) continue;
    }
    discount += r.reducesAmount ?? 1;
  }
  return discount;
};

// ─────────────────────────────────────────────────────────────────────────────
// solveColorPips  –  bipartite-matching pip feasibility solver
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns true when every colored pip in `pips` can be assigned to a
 * distinct source in `sources`, meaning no two pips compete for the same
 * physical mana source (e.g. a single Watery Grave cannot satisfy both
 * {U} and {B} simultaneously).
 *
 * Algorithm: augmenting-path bipartite matching (Hopcroft-Karp-style DFS).
 *
 * @param {string[]}                 pips    – e.g. ['U','U','B']
 * @param {Array<{produces:string[]}>} sources – one entry per mana unit
 * @returns {boolean}
 */
export const solveColorPips = (pips, sources) => {
  // matchOf[srcIdx] = pipIdx currently matched to that source (-1 = free)
  const matchOf = new Array(sources.length).fill(-1);

  const dfs = (pipIdx, visited) => {
    for (let s = 0; s < sources.length; s++) {
      if (visited[s]) continue;
      const src = sources[s];
      // A source satisfies a pip when it produces that exact color or any color ('*')
      if (!src.produces.includes(pips[pipIdx]) && !src.produces.includes('*')) continue;
      visited[s] = true;
      if (matchOf[s] === -1 || dfs(matchOf[s], visited)) {
        matchOf[s] = pipIdx;
        return true;
      }
    }
    return false;
  };

  let matched = 0;
  for (let i = 0; i < pips.length; i++) {
    if (dfs(i, new Array(sources.length).fill(false))) matched++;
  }
  return matched === pips.length;
};

// ─────────────────────────────────────────────────────────────────────────────
// canPlayCard
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Returns true when the available mana can pay for `card`.
 *
 * When `manaAvailable.sources` is present (populated by
 * calculateManaAvailability) an exact bipartite-matching check is used so
 * that dual-colored mana sources (e.g. Watery Grave producing {U} or {B})
 * are never double-counted across competing pip requirements.
 *
 * When `sources` is absent the function falls back to the original
 * per-color aggregate check, preserving backward-compatibility with
 * callers that supply a hand-crafted manaAvailable object.
 */
export const canPlayCard = (card, manaAvailable, discount = 0) => {
  const effectiveCmc = Math.max(0, card.cmc - discount);
  if (effectiveCmc > manaAvailable.total) return false;

  const colorPips = parseColorPips(card.manaCost);
  if (colorPips.length === 0) return true;

  // Precise path: bipartite matching prevents double-counting shared sources
  if (manaAvailable.sources) {
    return solveColorPips(colorPips, manaAvailable.sources);
  }

  // Fallback: original per-color aggregate check
  const colorRequirements = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  colorPips.forEach(c => colorRequirements[c]++);
  for (const color in colorRequirements) {
    if (
      colorRequirements[color] > 0 &&
      (manaAvailable.colors[color] || 0) < colorRequirements[color]
    )
      return false;
  }
  return true;
};
