/**
 * landUtils.js
 *
 * Land selection, entry-state evaluation, fetch targeting, and land play.
 * Extracted from simulationCore.js for maintainability.
 *
 * Exports:
 *   matchesRampFilter    – checks whether a library land satisfies a ramp spell's filter
 *   doesLandEnterTapped  – returns the default tapped-entry state of a land
 *   selectBestLand       – chooses the best land to play from hand this turn
 *   findBestLandToFetch  – chooses the best land to pull from a fetch activation
 *   playLand             – moves a land from hand → battlefield (mutates game state)
 */

import { BOUNCE_LANDS } from './landData.js';
import { SUBTYPE_TO_COLOR, COLOR_TO_SUBTYPE, parseColorPips, getAllSpells } from './simHelpers.js';

// ─────────────────────────────────────────────────────────────────────────────
// matchesRampFilter
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true when a land in the library satisfies a ramp spell's search restriction. */
export const matchesRampFilter = (land, rampSpell) => {
  if (!land.isLand) return false;
  switch (rampSpell.fetchFilter) {
    case 'any':
      return true;
    case 'basic':
      return !!land.isBasic;
    case 'subtype':
      return !!(
        rampSpell.fetchSubtypes &&
        land.landSubtypes &&
        rampSpell.fetchSubtypes.some(t => land.landSubtypes.includes(t))
      );
    case 'snow':
      return !!(land.name && land.name.toLowerCase().includes('snow'));
    default:
      return !!land.isBasic;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// doesLandEnterTapped
//   Returns the *default* tapped-entry state for a land before any life-payment
//   override is applied.  Shock lands and MDFC lands return `true` here because
//   their base rule is "enters tapped" — `playLand` is the sole authority that
//   decides whether to pay the life cost and force the land in untapped.
//   No caller outside of `playLand` should use this return value for shock/MDFC
//   lands without understanding that contract.
// ─────────────────────────────────────────────────────────────────────────────
export const doesLandEnterTapped = (land, battlefield, turn, commanderMode) => {
  if (land.isShockLand) return true; // playLand may override by paying 2 life
  if (land.isMDFCLand) return true; // playLand may override by paying 3 life

  if (land.isFast) {
    return battlefield.filter(p => p.card.isLand).length > 2;
  }
  if (land.isSlowLand) {
    return battlefield.filter(p => p.card.isLand).length < 2;
  }
  if (land.isBattleLand) {
    return battlefield.filter(p => p.card.isLand && p.card.isBasic).length < 2;
  }
  if (land.isCheck) {
    const needsTypes = land.checkTypes?.length ? [...land.checkTypes] : [];
    if (needsTypes.length === 0) {
      land.produces.forEach(c => {
        if (COLOR_TO_SUBTYPE[c]) needsTypes.push(COLOR_TO_SUBTYPE[c]);
      });
    }
    if (needsTypes.length === 0) return false;
    return !battlefield.some(
      p =>
        p.card.isLand &&
        p.card.landSubtypes &&
        p.card.landSubtypes.some(t => needsTypes.includes(t))
    );
  }
  if (land.isCrowd) {
    return !commanderMode;
  }
  if (land.entersTappedAlways === true) return true;
  // All other flags have been checked above; default is untapped.
  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// selectBestLand
//
// Picks the best land to play from hand this turn.
//
// `turn` and `commanderMode` are forwarded to `doesLandEnterTapped` so that
// shock lands, MDFC lands, check lands, slow lands, etc. are evaluated with
// their real entry-state instead of the static `entersTappedAlways` flag,
// which these land types do NOT set.
//
// Both params default to safe fallback values so existing call sites that
// omit them (e.g. unit tests) continue to work without modification.
// ─────────────────────────────────────────────────────────────────────────────
export const selectBestLand = (hand, battlefield, turn = 0, commanderMode = false) => {
  const lands = hand.filter(c => c.isLand);
  if (lands.length === 0) return null;

  const landsWithBouncability = lands.map(land => {
    const isBounceCard = land.isBounce || BOUNCE_LANDS.has(land.name.toLowerCase());
    if (!isBounceCard) return { land, canPlay: true };
    const nonBounceLandsToReturn = battlefield.filter(
      p => p.card.isLand && !p.card.isBounce && !BOUNCE_LANDS.has(p.card.name.toLowerCase())
    );
    return { land, canPlay: nonBounceLandsToReturn.length > 0 };
  });

  const playableLands = landsWithBouncability.filter(i => i.canPlay).map(i => i.land);
  if (playableLands.length === 0) return null;

  const fetches = playableLands.filter(l => l.isFetch && l.fetchType !== 'mana_cost');
  const untappedSources = battlefield.filter(d => d.card.isLand && !d.tapped);
  if (fetches.length > 0 && untappedSources.length >= fetches[0].fetchcost) return fetches[0];

  // Use doesLandEnterTapped for the untapped preference check so that shock
  // lands, check lands, slow/fast lands, etc. are evaluated dynamically
  // rather than relying on the static entersTappedAlways flag.
  const untappedNonBounce = playableLands.filter(
    l =>
      !doesLandEnterTapped(l, battlefield, turn, commanderMode) &&
      !l.isBounce &&
      !BOUNCE_LANDS.has(l.name.toLowerCase())
  );
  if (untappedNonBounce.length > 0) return untappedNonBounce[0];

  const bouncelands = playableLands.filter(
    l => l.isBounce || BOUNCE_LANDS.has(l.name.toLowerCase())
  );
  if (bouncelands.length > 0) return bouncelands[0];
  return playableLands[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// findBestLandToFetch
// ─────────────────────────────────────────────────────────────────────────────
export const findBestLandToFetch = (
  fetchLand,
  library,
  battlefield,
  keyCardNames,
  parsedDeck,
  turn
) => {
  const onlyBasics = fetchLand.isHideawayFetch || fetchLand.fetchesOnlyBasics;

  const eligibleLands = library.filter(card => {
    if (!card.isLand) return false;
    if (onlyBasics && !card.isBasic) return false;
    const landTypes = card.landSubtypes || [];
    const fetchColors = fetchLand.fetchColors || [];
    return landTypes.some(type => fetchColors.includes(SUBTYPE_TO_COLOR[type]));
  });

  if (eligibleLands.length === 0) return null;

  const neededColors = new Set();
  if (keyCardNames && keyCardNames.length > 0 && parsedDeck) {
    const allSpells = getAllSpells(parsedDeck);
    const keyCards = keyCardNames
      .map(name => allSpells.find(c => c.name === name))
      .filter(Boolean)
      .sort((a, b) => a.cmc - b.cmc);
    keyCards.forEach(card => {
      parseColorPips(card.manaCost).forEach(c => neededColors.add(c));
    });
  }

  const currentColors = new Set();
  battlefield.forEach(permanent => {
    if (
      permanent.card.isLand ||
      permanent.card.isManaArtifact ||
      (permanent.card.isManaCreature && !permanent.summoningSick)
    ) {
      (permanent.card.produces || []).forEach(color => {
        if (['W', 'U', 'B', 'R', 'G'].includes(color)) currentColors.add(color);
      });
    }
  });

  const missingColors = new Set([...neededColors].filter(c => !currentColors.has(c)));

  const scoredLands = eligibleLands.map(land => {
    let score = 0;
    const producesNeededColor = (land.produces || []).some(c => missingColors.has(c));
    if (producesNeededColor) score += 300;
    if (turn <= 2 && (land.produces || []).length > 2) score += 1000;
    if (turn >= 6 && land.isShockLand) score -= 100;
    if ((land.produces || []).length >= 2) score += 100;
    score += (land.produces || []).filter(c => missingColors.has(c)).length * 250;
    return { land, score };
  });
  scoredLands.sort((a, b) => b.score - a.score);
  return scoredLands[0].land;
};

// ─────────────────────────────────────────────────────────────────────────────
// playLand
//   `commanderMode` is an explicit parameter (was a closure over state)
// ─────────────────────────────────────────────────────────────────────────────
export const playLand = (
  land,
  hand,
  battlefield,
  library,
  graveyard,
  turn,
  turnLog,
  keyCardNames,
  parsedDeck,
  commanderMode
) => {
  const index = hand.indexOf(land);
  hand.splice(index, 1);
  let lifeLoss = 0;

  // Thriving Land: choose best second color from key cards on ETB
  if (land.isThriving && keyCardNames && keyCardNames.length > 0 && parsedDeck) {
    const primaryColor = land.produces[0] ?? null;
    if (primaryColor) {
      const allCards = getAllSpells(parsedDeck);
      const freq = {};
      keyCardNames.forEach(cardName => {
        const kc = allCards.find(c => c.name === cardName);
        if (kc) {
          parseColorPips(kc.manaCost)
            .filter(c => c !== primaryColor)
            .forEach(c => {
              freq[c] = (freq[c] || 0) + 1;
            });
        }
      });
      const ranked = Object.entries(freq).sort((a, b) => b[1] - a[1]);
      if (ranked.length > 0) {
        land.produces = [primaryColor, ranked[0][0]];
        if (turnLog) turnLog.actions.push(`Thriving Land chose second color: ${ranked[0][0]}`);
      }
    }
  }

  // City of Traitors: sacrifice when another land is played
  const cityOfTraitorsInPlay = battlefield.filter(p => p.card.isLand && p.card.isCityOfTraitors);
  if (cityOfTraitorsInPlay.length > 0 && !land.isCityOfTraitors) {
    cityOfTraitorsInPlay.forEach(city => {
      const cityIndex = battlefield.indexOf(city);
      battlefield.splice(cityIndex, 1);
      graveyard.push(city.card);
      if (turnLog) turnLog.actions.push(`Sacrificed ${city.card.name} (another land played)`);
    });
  }

  if (land.isFetch) {
    if (land.isHideawayFetch) {
      const fetchedLand = findBestLandToFetch(
        land,
        library,
        battlefield,
        keyCardNames,
        parsedDeck,
        turn
      );
      if (fetchedLand) {
        library.splice(library.indexOf(fetchedLand), 1);
        battlefield.push({ card: fetchedLand, tapped: true, enteredTapped: true });
        graveyard.push(land);
        if (turnLog)
          turnLog.actions.push(
            `Played ${land.name}, sacrificed it to fetch ${fetchedLand.name} (tapped)`
          );
      } else {
        battlefield.push({ card: land, tapped: true, enteredTapped: true });
        if (turnLog) turnLog.actions.push(`Played ${land.name} (tapped, no fetch targets)`);
      }
    } else {
      const entersTapped = doesLandEnterTapped(land, battlefield, turn, commanderMode);
      battlefield.push({ card: land, tapped: entersTapped, enteredTapped: entersTapped });
      if (turnLog) {
        const finalState = battlefield[battlefield.length - 1]?.tapped ? 'tapped' : 'untapped';
        turnLog.actions.push(`Played ${land.name} (fetch land, ${finalState})`);
      }
    }
  } else {
    const entersTapped = doesLandEnterTapped(land, battlefield, turn, commanderMode);
    const isBounceCard = land.isBounce || BOUNCE_LANDS.has(land.name.toLowerCase());

    if (isBounceCard) {
      const landsToBounce = battlefield.filter(
        p => p.card.isLand && !p.card.isBounce && !BOUNCE_LANDS.has(p.card.name.toLowerCase())
      );
      if (landsToBounce.length === 0) {
        if (turnLog)
          turnLog.actions.push(`Cannot play ${land.name} (no non-bounce lands to bounce)`);
        return 0;
      }
    }

    battlefield.push({ card: land, tapped: entersTapped, enteredTapped: entersTapped });

    // Shock land: pay 2 life to enter untapped (turns 1–6)
    if (land.isShockLand && turn <= 6 && entersTapped) {
      battlefield[battlefield.length - 1].tapped = false;
      battlefield[battlefield.length - 1].enteredTapped = false;
      lifeLoss += land.lifeloss ?? 2;
    }

    // MDFC land: pay 3 life to enter untapped (turns 1–4); tapped with no cost from turn 5
    if (land.isMDFCLand && turn <= 4 && entersTapped) {
      battlefield[battlefield.length - 1].tapped = false;
      battlefield[battlefield.length - 1].enteredTapped = false;
      lifeLoss += land.lifeloss ?? 3;
    }

    if (isBounceCard) {
      const bounceLandIndex = battlefield.length - 1;
      const finalState = battlefield[bounceLandIndex]?.tapped ? 'tapped' : 'untapped';
      const landsToBounce = battlefield.filter(
        p => p.card.isLand && !p.card.isBounce && !BOUNCE_LANDS.has(p.card.name.toLowerCase())
      );
      const tappedLands = landsToBounce.filter(p => p.tapped);
      const toBounce = tappedLands.length > 0 ? tappedLands[0] : landsToBounce[0];
      const bouncedState = toBounce.tapped ? 'tapped' : 'untapped';
      battlefield.splice(battlefield.indexOf(toBounce), 1);
      hand.push(toBounce.card);
      if (turnLog)
        turnLog.actions.push(
          `Played ${land.name} (${finalState}), bounced ${toBounce.card.name} (${bouncedState})`
        );
    } else {
      if (turnLog) {
        const finalState = battlefield[battlefield.length - 1]?.tapped ? 'tapped' : 'untapped';
        turnLog.actions.push(`Played ${land.name} (${finalState})`);
      }
    }
  }

  return lifeLoss;
};
