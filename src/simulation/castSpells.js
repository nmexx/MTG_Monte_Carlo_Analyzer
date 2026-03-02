/**
 * castSpells.js
 *
 * The `castSpells` turn function: casts cost reducers, mana producers,
 * ramp spells, draw spells, and treasure generators in priority order.
 * Extracted from simulationCore.js for maintainability.
 *
 * Exports:
 *   castSpells – mutates gameState, returns { cardsDrawn, treasuresProduced }
 */

import {
  SIMPLIFY_MOX_CONDITIONS,
  MOX_PRIORITY_ARTIFACTS,
  BURST_MANA_SOURCES,
} from '../../card_data/Artifacts.js';
import {
  tapManaSources,
  calculateManaAvailability,
  calculateCostDiscount,
  canPlayCard,
} from './manaUtils.js';
import { matchesRampFilter } from './landUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
// _runCastingLoop  (private)
//
// Repeatedly scans a candidate list until no additional cast is possible.
// Recomputes mana availability after each successful cast because every cast
// changes the battlefield.
//
// @param {object[]} battlefield - current battlefield permanents (mutated)
// @param {number}   turn        - current turn (0-based)
// @param {Function} getCandidates(manaAvailable) - returns sorted spell array
// @param {Function} tryCast(spell, manaAvailable, discount)
//   Should mutate state and return `true` on a successful cast, or `false` to
//   skip this candidate due to a secondary constraint (e.g. ETB cost unpayable).
// ─────────────────────────────────────────────────────────────────────────────
const _runCastingLoop = (battlefield, turn, getCandidates, tryCast) => {
  let changed = true;
  while (changed) {
    changed = false;
    const manaAvailable = calculateManaAvailability(battlefield, turn);
    for (const spell of getCandidates(manaAvailable)) {
      const discount = calculateCostDiscount(spell, battlefield);
      if (!canPlayCard(spell, manaAvailable, discount)) continue;
      if (tryCast(spell, manaAvailable, discount)) {
        changed = true;
        break;
      }
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// castSpells
//   gameState  = { hand, battlefield, graveyard, library, turnLog }
//   simConfig  = { includeRampSpells, disabledRampSpells, includeCostReducers,
//                  disabledCostReducers, includeDrawSpells, disabledDrawSpells,
//                  includeTreasures, disabledTreasures, ... }
// ─────────────────────────────────────────────────────────────────────────────
export const castSpells = (
  { hand, battlefield, graveyard, library, turnLog = null },
  turn = 999,
  simConfig = {}
) => {
  const {
    includeRampSpells = true,
    disabledRampSpells = new Set(),
    includeCostReducers = true,
    disabledCostReducers = new Set(),
    includeDrawSpells = true,
    disabledDrawSpells = new Set(),
    includeTreasures = true,
    disabledTreasures = new Set(),
  } = simConfig;

  let _cardsDrawn = 0;
  let _treasuresProduced = 0;

  // Phase 0: cost reducers — cast before mana producers so their discount
  // applies to everything cast on the same turn.
  if (includeCostReducers) {
    _runCastingLoop(
      battlefield,
      turn,
      () =>
        hand
          .filter(c => c.isCostReducer && !disabledCostReducers.has(c.name))
          .sort((a, b) => a.cmc - b.cmc),
      reducer => {
        hand.splice(hand.indexOf(reducer), 1);
        battlefield.push({
          card: reducer,
          tapped: reducer.entersTapped || false,
          summoningSick: reducer.isCreature ?? false,
          enteredOnTurn: turn,
        });
        tapManaSources(reducer, battlefield);
        if (turnLog) {
          const scopeLabel = reducer.reducesColor
            ? `{${reducer.reducesColor}} spells`
            : reducer.reducesType === 'instant_or_sorcery'
              ? 'instants/sorceries'
              : reducer.reducesType === 'creature'
                ? 'creatures'
                : 'all spells';
          turnLog.actions.push(
            `Cast cost reducer: ${reducer.name} (-${reducer.reducesAmount} to ${scopeLabel})`
          );
        }
        return true;
      }
    );
  }

  // Phase 1: mana-producing permanents
  _runCastingLoop(
    battlefield,
    turn,
    () => {
      const creatures = hand.filter(c => c.isManaCreature);
      const exploration = hand.filter(c => c.isExploration);
      const artifacts = hand.filter(
        c => c.isManaArtifact && !BURST_MANA_SOURCES.has(c.name?.toLowerCase())
      );
      return [...creatures, ...exploration, ...artifacts].sort((a, b) => {
        const aPrio = MOX_PRIORITY_ARTIFACTS.has(a.name?.toLowerCase()) ? -1 : a.cmc;
        const bPrio = MOX_PRIORITY_ARTIFACTS.has(b.name?.toLowerCase()) ? -1 : b.cmc;
        return aPrio - bPrio;
      });
    },
    (spell, _mana, spellDiscount) => {
      let etbNote = '';

      if (spell.etbCost === 'discardLand' || spell.isMoxDiamond) {
        const landsInHand = hand.filter(c => c.isLand);
        if (landsInHand.length === 0) return false;
        const landToDiscard = landsInHand.find(l => l.entersTappedAlways) || landsInHand[0];
        etbNote = ` (discarded ${landToDiscard.name})`;
        hand.splice(hand.indexOf(landToDiscard), 1);
        graveyard.push(landToDiscard);
      } else if (spell.etbCost === 'imprintNonland' || spell.isChromeMox) {
        const nonLandsInHand = hand.filter(c => !c.isLand);
        if (nonLandsInHand.length === 0) return false;
        const cardToImprint = nonLandsInHand[0];
        etbNote = ` (imprinted ${cardToImprint.name})`;
        hand.splice(hand.indexOf(cardToImprint), 1);
      } else if (spell.etbCost === 'discardHand') {
        const handNames = hand.filter(c => c !== spell).map(c => c.name);
        if (handNames.length > 0) {
          etbNote = ` (discarded hand: ${handNames.join(', ')})`;
          const rest = hand.filter(c => c !== spell);
          rest.forEach(c => graveyard.push(c));
          hand.length = 0;
          hand.push(spell);
        } else {
          etbNote = ' (discarded empty hand)';
        }
      } else if (spell.etbCost === 'sacrifice') {
        etbNote = ' (sacrifice for mana)';
      }

      if (spell.condition === 'metalcraft' && !(SIMPLIFY_MOX_CONDITIONS && turn >= 2)) {
        const artCount = battlefield.filter(
          p => p.card.type?.includes('artifact') || p.card.isManaArtifact
        ).length;
        if (artCount < 2) etbNote += ' ⚠ metalcraft not yet active';
      }
      if (spell.condition === 'legendary' && !(SIMPLIFY_MOX_CONDITIONS && turn >= 2)) {
        const hasLegendary = battlefield.some(
          p => p.card.type?.includes('Legendary') || p.card.oracleText?.includes('Legendary')
        );
        if (!hasLegendary) etbNote += ' ⚠ no legendary — no mana produced';
      }

      hand.splice(hand.indexOf(spell), 1);
      battlefield.push({
        card: spell,
        tapped: spell.entersTapped || false,
        summoningSick: spell.isManaCreature || spell.isExploration,
        enteredOnTurn: turn,
      });
      tapManaSources(spell, battlefield, spellDiscount);

      if (turnLog) {
        let type = 'permanent';
        if (spell.isManaArtifact) type = 'artifact';
        else if (spell.isManaCreature) type = 'creature';
        else if (spell.isExploration)
          type = spell.isCreature ? 'creature' : spell.isArtifact ? 'artifact' : 'permanent';
        const explorationSuffix = spell.isExploration ? ' (Exploration effect)' : '';
        const tappedSuffix = spell.entersTapped ? ' (enters tapped)' : '';
        turnLog.actions.push(
          `Cast ${type}: ${spell.name}${explorationSuffix}${tappedSuffix}${etbNote}`
        );
      }
      return true;
    }
  );

  // Phase 2: ramp spells
  if (includeRampSpells) {
    _runCastingLoop(
      battlefield,
      turn,
      () =>
        hand
          .filter(c => c.isRampSpell && !disabledRampSpells.has(c.name))
          .sort((a, b) => a.cmc - b.cmc),
      (rampSpell, manaAvailable, rampDiscount) => {
        // For cards with an activated ability (e.g. Wayfarer's Bauble), also verify
        // that the activation cost can be paid on top of the cast cost.
        if (rampSpell.activationCost > 0) {
          const castCost = Math.max(0, rampSpell.cmc - rampDiscount);
          if (castCost + rampSpell.activationCost > manaAvailable.total) return false;
        }

        // Determine how many eligible lands must exist in the library before we
        // bother casting (avoids wasting a spell when the library is nearly dry).
        const fieldNeeded = rampSpell.landsToAdd > 0 ? 1 : 0;
        const handNeeded = rampSpell.landsToHand > 0 ? 1 : 0;
        const minNeeded = Math.max(1, fieldNeeded + handNeeded);
        const eligibleInLibrary = library.filter(c => matchesRampFilter(c, rampSpell));
        if (eligibleInLibrary.length < minNeeded) return false;

        // Move the card out of hand: permanents stay on the battlefield,
        // one-shot spells (sorceries / instants) go to the graveyard.
        hand.splice(hand.indexOf(rampSpell), 1);
        if (rampSpell.staysOnBattlefield) {
          battlefield.push({
            card: rampSpell,
            tapped: false,
            summoningSick: false,
            enteredOnTurn: turn,
          });
        } else {
          graveyard.push(rampSpell);
        }

        // Tap sources for the cast cost, then tap additional sources for any
        // activation cost (e.g. Wayfarer's Bauble pays {2} to activate).
        tapManaSources(rampSpell, battlefield, rampDiscount);
        if (rampSpell.activationCost > 0) {
          let remaining = rampSpell.activationCost;
          const untapped = battlefield.filter(
            p => !p.tapped && p.card.produces?.length > 0 && (!p.summoningSick || p.card.isLand)
          );
          for (const source of untapped) {
            if (remaining <= 0) break;
            source.tapped = true;
            remaining -= source.card.manaAmount || 1;
          }
        }

        let sacrificedLandName = null;
        if (rampSpell.sacrificeLand) {
          const candidates = battlefield.filter(p => p.card.isLand && !p.card.isFetch);
          const basics = candidates.filter(p => p.card.isBasic);
          const duals = candidates.filter(p => !p.card.isBasic && !p.card.isBounce);
          const bounces = candidates.filter(p => p.card.isBounce);
          const toSacrifice = basics[0] ?? duals[0] ?? bounces[0] ?? null;
          if (toSacrifice) {
            sacrificedLandName = toSacrifice.card.name;
            battlefield.splice(battlefield.indexOf(toSacrifice), 1);
            graveyard.push(toSacrifice.card);
          }
        }

        const landsToFieldNames = [];
        const target = rampSpell.landsToAdd;
        for (let li = 0; li < library.length && landsToFieldNames.length < target; li++) {
          if (matchesRampFilter(library[li], rampSpell)) {
            const [fetchedCard] = library.splice(li, 1);
            li--;
            battlefield.push({
              card: fetchedCard,
              tapped: rampSpell.landsTapped,
              enteredTapped: rampSpell.landsTapped,
            });
            landsToFieldNames.push(fetchedCard.name);
          }
        }

        const landsToHandNames = [];
        if (rampSpell.landsToHand > 0) {
          for (
            let li = 0;
            li < library.length && landsToHandNames.length < rampSpell.landsToHand;
            li++
          ) {
            if (matchesRampFilter(library[li], rampSpell)) {
              const [card] = library.splice(li, 1);
              li--;
              hand.push(card);
              landsToHandNames.push(card.name);
            }
          }
        }

        if (turnLog) {
          const tappedNote = rampSpell.landsTapped ? 'tapped' : 'untapped';
          const sacNote = sacrificedLandName ? `, sac'd ${sacrificedLandName}` : '';
          const fieldNote =
            landsToFieldNames.length > 0
              ? ` → ${landsToFieldNames.join(', ')} (${tappedNote})`
              : rampSpell.landsToAdd > 0
                ? ' → no land found'
                : '';
          const handNote =
            landsToHandNames.length > 0 ? `; ${landsToHandNames.join(', ')} to hand` : '';
          const actionVerb = rampSpell.staysOnBattlefield ? 'Cast permanent' : 'Cast ramp spell';
          const activationNote =
            rampSpell.activationCost > 0 ? ` (activated for {${rampSpell.activationCost}})` : '';
          turnLog.actions.push(
            `${actionVerb}: ${rampSpell.name}${activationNote}${sacNote}${fieldNote}${handNote}`
          );
        }
        return true;
      }
    );
  }

  // Phase 3: draw spells — cast after ramp spells; lowest priority.
  // One-shot draw spells (instants/sorceries) are put in the graveyard and
  // immediately draw their cards.  Permanent draw spells enter the battlefield
  // and will produce cards every upkeep (handled in monteCarlo.js).
  if (includeDrawSpells) {
    _runCastingLoop(
      battlefield,
      turn,
      () =>
        hand
          .filter(c => c.isDrawSpell && !disabledDrawSpells.has(c.name))
          .sort((a, b) => a.cmc - b.cmc),
      (drawSpell, _mana, drawDiscount) => {
        hand.splice(hand.indexOf(drawSpell), 1);
        if (drawSpell.staysOnBattlefield) {
          battlefield.push({
            card: drawSpell,
            tapped: false,
            summoningSick: false,
            enteredOnTurn: turn,
          });
        } else {
          graveyard.push(drawSpell);
        }
        tapManaSources(drawSpell, battlefield, drawDiscount);

        // One-shot draw: immediately draw cards into hand
        // Supports scaling override: cards drawn = base + turn * growth (turn is 0-indexed)
        let cardsDrawn = 0;
        const drawnCardNames = [];
        if (drawSpell.isOneTimeDraw) {
          const scaledCards =
            drawSpell.drawScaling?.type === 'onetime'
              ? Math.max(0, drawSpell.drawScaling.base + turn * drawSpell.drawScaling.growth)
              : (drawSpell.netCardsDrawn ?? 0);
          const toDraw = Math.min(Math.round(scaledCards), library.length);
          for (let d = 0; d < toDraw; d++) {
            const drawnCard = library.shift();
            hand.push(drawnCard);
            drawnCardNames.push(drawnCard.name);
          }
          cardsDrawn = toDraw;
          _cardsDrawn += cardsDrawn;
        }

        if (turnLog) {
          const verb = drawSpell.staysOnBattlefield ? 'Cast draw permanent' : 'Cast draw spell';
          const drawnList = drawnCardNames.length > 0 ? `: ${drawnCardNames.join(', ')}` : '';
          const drawNote = drawSpell.isOneTimeDraw
            ? ` → drew ${cardsDrawn} card${cardsDrawn !== 1 ? 's' : ''}${drawnList}`
            : ' → draws each turn';
          turnLog.actions.push(`${verb}: ${drawSpell.name}${drawNote}`);
        }
        return true;
      }
    );
  }

  // Phase 4: treasure-generating cards — cast last (lowest priority of all).
  // One-time generators (isOneTreasure: true) produce `treasuresProduced` tokens
  // immediately via simConfig.treasureTracker.  Recurring permanents enter the
  // battlefield and are handled by the upkeep loop in monteCarlo.js.
  if (includeTreasures) {
    _runCastingLoop(
      battlefield,
      turn,
      () =>
        hand
          .filter(c => c.isTreasureCard && !disabledTreasures.has(c.name))
          .sort((a, b) => a.cmc - b.cmc),
      (tc, _mana, tcDiscount) => {
        hand.splice(hand.indexOf(tc), 1);
        if (tc.staysOnBattlefield) {
          battlefield.push({
            card: tc,
            tapped: false,
            summoningSick: tc.type === 'creature',
            enteredOnTurn: turn,
          });
        } else {
          graveyard.push(tc);
        }
        tapManaSources(tc, battlefield, tcDiscount);

        // One-time treasure generation: immediately credit the tracker
        let treasuresCreated = 0;
        if (tc.isOneTreasure && tc.treasuresProduced > 0) {
          treasuresCreated = tc.treasuresProduced;
          _treasuresProduced += treasuresCreated;
        }

        if (turnLog) {
          const verb = tc.staysOnBattlefield ? 'Cast treasure permanent' : 'Cast treasure spell';
          const note = tc.isOneTreasure
            ? ` → created ${treasuresCreated} treasure${treasuresCreated !== 1 ? 's' : ''}`
            : ' → generates treasures each turn';
          turnLog.actions.push(`${verb}: ${tc.name}${note}`);
        }
        return true;
      }
    );
  }

  return { cardsDrawn: _cardsDrawn, treasuresProduced: _treasuresProduced };
};
