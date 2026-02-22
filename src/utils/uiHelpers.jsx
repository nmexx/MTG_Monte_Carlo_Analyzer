/**
 * uiHelpers.jsx
 *
 * Shared UI utilities: mana-symbol rendering, fetch badge symbols,
 * the reusable sequence body JSX, a text-file downloader, and the
 * chart-data preparation function (depends only on simulationResults
 * and the turns setting — no React state is imported here).
 *
 * Components that need these should import them individually.
 */

import React from 'react';
import { safeToFixed } from './math.js';
import CardTooltip from '../components/CardTooltip.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Mana symbols
// ─────────────────────────────────────────────────────────────────────────────
export const getManaSymbol = color => {
  const symbols = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌿', C: '◇' };
  return symbols[color] || '';
};

const MANA_TITLES = {
  W: 'White mana',
  U: 'Blue mana',
  B: 'Black mana',
  R: 'Red mana',
  G: 'Green mana',
  C: 'Colorless mana',
};
export const getManaTitle = color => MANA_TITLES[color] || color;

export const parseManaSymbols = manaCost => {
  if (!manaCost) return [];
  return (manaCost.match(/\{([^}]+)\}/g) || []).map(s => s.replace(/[{}]/g, ''));
};

const MANA_COST_TITLES = {
  W: 'White mana',
  U: 'Blue mana',
  B: 'Black mana',
  R: 'Red mana',
  G: 'Green mana',
  C: 'Colorless mana',
};

export const renderManaCost = manaCost => {
  const colorSymbols = { W: '☀️', U: '💧', B: '💀', R: '🔥', G: '🌿', C: '◇' };
  return parseManaSymbols(manaCost).map((symbol, idx) => {
    if (colorSymbols[symbol])
      return (
        <span key={idx} className="mana-cost-symbol" title={MANA_COST_TITLES[symbol]}>
          {colorSymbols[symbol]}
        </span>
      );
    return (
      <span key={idx} className="mana-cost-generic" title={`Generic mana (${symbol})`}>
        {symbol}
      </span>
    );
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Fetch type badge
// ─────────────────────────────────────────────────────────────────────────────
export const getFetchSymbol = fetchType => {
  const symbols = { classic: '⚡', slow: '🐌', mana_cost: '💰', free_slow: '🆓' };
  return symbols[fetchType] || '';
};

export const getFetchTitle = fetchType => {
  const titles = {
    classic:
      '⚡ Classic fetch — pay 1 life, search your library for a matching land, put it on the battlefield',
    slow: '🐌 Slow fetch — enters tapped; sacrifice at the start of your next upkeep to search for a land',
    mana_cost: '💰 Paid fetch — tap and pay mana to search your library for a basic land',
    free_slow:
      '🆓 Free slow fetch — no life cost; enters tapped, sacrifice it to search for a basic land',
    auto_sacrifice: 'Auto-sacrifice fetch — sacrifices itself automatically to search for a land',
    trigger: 'Triggered fetch — searches for a land when a specific condition is met',
    saga_any: 'Saga fetch — searches for any land as part of a saga chapter ability',
  };
  return titles[fetchType] || 'Fetch land — searches your library for a land card';
};

// ─────────────────────────────────────────────────────────────────────────────
// buildActionSegments
//   Parses a turnLog action string into an array of {text, isCard} segments
//   so the renderer can wrap card names with CardTooltip.
//
//   Handles every action pattern emitted by simulationCore.js / monteCarlo.js:
//     "Drew: <name>"
//     "Discarded: <name> (<reason>)"
//     "Played <name> (<state>)"  [incl. bounce, fetch]
//     "Sacrificed <name> (<reason>)"
//     "Cannot play <name> (<reason>)"
//     "Cast <type>: <name>[etb/sac/imprint notes][ → land list; land to hand]"
//     "Cast draw spell: <name> → drew N cards: <n1>, <n2>"
//     "<name>: created N treasure(s)"
// ─────────────────────────────────────────────────────────────────────────────
export const buildActionSegments = action => {
  const p = t => ({ text: t, isCard: false }); // plain text segment
  const c = t => ({ text: t.trim(), isCard: true }); // card name segment

  // Split a comma-separated name list into alternating [card, plain(', '), card...] segs
  const fromList = listStr =>
    listStr
      .split(', ')
      .flatMap((name, i, arr) => (i < arr.length - 1 ? [c(name), p(', ')] : [c(name)]));

  // ── "Drew: <name>" ─────────────────────────────────────────────────────────
  if (action.startsWith('Drew: ')) {
    return [p('Drew: '), ...fromList(action.slice('Drew: '.length))];
  }

  // ── "Discarded: <name> (<reason>)" ────────────────────────────────────────
  const discM = action.match(/^(Discarded: )(.+?)( \([^)]+\))$/);
  if (discM) return [p(discM[1]), c(discM[2]), p(discM[3])];

  // ── "<name>: created N treasure(s)" [upkeep treasure entries] ─────────────
  const treasM = action.match(/^(.+?)(: created \d+ treasures?)$/);
  if (treasM) return [c(treasM[1]), p(treasM[2])];

  // ── "Sacrificed <name> (<reason>)" ────────────────────────────────────────
  const sacM = action.match(/^(Sacrificed )(.+?)( \([^)]+\))$/);
  if (sacM) return [p(sacM[1]), c(sacM[2]), p(sacM[3])];

  // ── "Cannot play <name> (<reason>)" ───────────────────────────────────────
  const cantM = action.match(/^(Cannot play )(.+?)( \([^)]+\))$/);
  if (cantM) return [p(cantM[1]), c(cantM[2]), p(cantM[3])];

  // ── "Played …" ─────────────────────────────────────────────────────────────
  if (action.startsWith('Played ')) {
    const rest = action.slice('Played '.length);

    // "Played <name>, sacrificed it to fetch <fetched> (state)"
    const fetchM = rest.match(/^(.+?), (sacrificed it to fetch )(.+?)( \([^)]+\))$/);
    if (fetchM) {
      return [p('Played '), c(fetchM[1]), p(', '), p(fetchM[2]), c(fetchM[3]), p(fetchM[4])];
    }

    // "Played <name> (<state>), bounced <bounce> (<state>)"
    const bounceM = rest.match(/^(.+?)( \([^)]+\), bounced )(.+?)( \([^)]+\))$/);
    if (bounceM) {
      return [p('Played '), c(bounceM[1]), p(bounceM[2]), c(bounceM[3]), p(bounceM[4])];
    }

    // "Played <name> (<state>)" — standard
    const stdM = rest.match(/^(.+?)( \([^)]+\))$/);
    if (stdM) return [p('Played '), c(stdM[1]), p(stdM[2])];

    // Fallback (no parenthesis)
    return [p('Played '), c(rest)];
  }

  // ── Cast <type>: <name>[...] ───────────────────────────────────────────────
  const CAST_PREFIX_RX =
    /^(Cast (?:artifact|creature|permanent|ramp spell|draw permanent|draw spell|treasure permanent|treasure spell|cost reducer): )/;
  const castPrefixM = action.match(CAST_PREFIX_RX);
  if (castPrefixM) {
    const prefix = castPrefixM[1];
    const rest = action.slice(prefix.length);

    // Card name ends at: " (" · " →" · "," · end-of-string
    // Note: use explicit chars to avoid unintended Unicode range in char class
    const mainNameEnd = rest.search(/ [(→]|,/);
    const mainName = rest.slice(0, mainNameEnd >= 0 ? mainNameEnd : rest.length);
    const afterName = mainNameEnd >= 0 ? rest.slice(mainNameEnd) : '';

    const segs = [p(prefix), c(mainName)];

    // ETB note: "(discarded <name>)"  or  "(discarded hand: <n1>, <n2>)"
    const discETB = afterName.match(/\(discarded ([^)]+)\)/);
    if (discETB) {
      const inner = discETB[1];
      const beforeDisc = afterName.slice(
        0,
        afterName.indexOf('(discarded ') + '(discarded '.length
      );
      const afterDisc = afterName.slice(
        afterName.indexOf('(discarded ') + '(discarded '.length + inner.length + 1
      );
      if (inner.startsWith('hand: ')) {
        segs.push(
          p(beforeDisc),
          p('hand: '),
          ...fromList(inner.slice('hand: '.length)),
          p(afterDisc)
        );
      } else {
        segs.push(p(beforeDisc), c(inner), p(afterDisc));
      }
    }
    // ETB note: "(imprinted <name>)"
    else if (afterName.includes('(imprinted ')) {
      const impM = afterName.match(/^(.*\(imprinted )([^)]+)(\).*)$/);
      if (impM) segs.push(p(impM[1]), c(impM[2]), p(impM[3]));
      else segs.push(p(afterName));
    }
    // Ramp: optional "sac'd <name>" in afterName before "→"
    else if (afterName.includes("sac'd ")) {
      const sacdM = afterName.match(/^(.*?, sac'd )([^,→;(]+?)((?:,? →|;|$).*)$/s);
      if (sacdM) {
        const tail = sacdM[3];
        // Push the sac'd card then continue with the arrow / hand segments
        const preArrowSegs = [p(sacdM[1]), c(sacdM[2].trim())];
        // tail may contain "→ land1, land2 (state); land3 to hand"
        const arrowSegs = buildArrowSegments(tail);
        segs.push(...preArrowSegs, ...arrowSegs);
      } else {
        segs.push(p(afterName));
      }
    }
    // Arrow portion "→ ..."  (ramp land list or draw card list)
    else if (afterName.includes(' → ')) {
      segs.push(...buildArrowSegments(afterName));
    } else {
      segs.push(p(afterName));
    }

    return segs;
  }

  // ── No pattern matched ──────────────────────────────────────────────────────
  return [p(action)];
};

// ─────────────────────────────────────────────────────────────────────────────
// buildArrowSegments
//   Parses the " → …" tail of a Cast action:
//     " → land1, land2 (tapped); land3, land4 to hand"
//     " → drew N cards: name1, name2"
//     " → draws each turn"
//     " → no land found"
// ─────────────────────────────────────────────────────────────────────────────
const buildArrowSegments = tail => {
  const p = t => ({ text: t, isCard: false });
  const fromList = listStr =>
    listStr
      .split(', ')
      .flatMap((name, i, arr) =>
        i < arr.length - 1
          ? [{ text: name.trim(), isCard: true }, p(', ')]
          : [{ text: name.trim(), isCard: true }]
      );

  const segs = [];

  // "→ drew N cards: name1, name2"
  const drewM = tail.match(/^( → drew \d+ cards?: )(.+)$/);
  if (drewM) {
    segs.push(p(drewM[1]), ...fromList(drewM[2]));
    return segs;
  }

  // "→ drew N card" (0 drawn or just 1 without names)
  if (/ → drew \d+ card/.test(tail)) {
    segs.push(p(tail));
    return segs;
  }

  // "→ draws each turn"
  if (tail.includes('→ draws each turn') || tail.includes('→ no land found')) {
    segs.push(p(tail));
    return segs;
  }

  // "→ land1, land2 (state)[; land3, land4 to hand]"
  const arrowM = tail.match(/^( → )(.+?)( \([^)]+\))(.*)?$/);
  if (arrowM) {
    const landList = arrowM[2];
    const stateNote = arrowM[3];
    const rest2 = arrowM[4] || '';

    segs.push(p(arrowM[1]), ...fromList(landList), p(stateNote));

    // "; land3, land4 to hand"
    const toHandM = rest2.match(/^(; )(.+?)( to hand)(.*)$/);
    if (toHandM) {
      segs.push(p(toHandM[1]), ...fromList(toHandM[2]), p(toHandM[3]));
      if (toHandM[4]) segs.push(p(toHandM[4]));
    } else if (rest2) {
      segs.push(p(rest2));
    }
    return segs;
  }

  segs.push(p(tail));
  return segs;
};

// ─────────────────────────────────────────────────────────────────────────────
// renderSequenceBody  –  opening hand + turn-by-turn actions block
// ─────────────────────────────────────────────────────────────────────────────
export const renderSequenceBody = (data, accentColor = '#667eea') => (
  <>
    <div className="seq-opening-hand">
      <p className="seq-opening-title">Opening Hand:</p>
      <div className="seq-opening-cards">
        {data.openingHand.map((name, i) => (
          <React.Fragment key={name + i}>
            {i > 0 && ', '}
            <CardTooltip name={name}>
              <span className="seq-card-ref">{name}</span>
            </CardTooltip>
          </React.Fragment>
        ))}
      </div>
    </div>
    <div>
      <p className="seq-turns-title">Turn-by-turn sequence:</p>
      {data.sequence &&
        data.sequence.map((turnLog, idx) => (
          <div key={idx} className="seq-turn-block" style={{ '--seq-accent': accentColor }}>
            <p className="seq-turn-title">Turn {turnLog.turn}:</p>
            {turnLog.actions.length > 0 ? (
              <ul className="seq-turn-actions">
                {turnLog.actions.map((action, ai) => {
                  const segs = buildActionSegments(action);
                  return (
                    <li key={ai}>
                      {segs.map((seg, si) =>
                        seg.isCard ? (
                          <CardTooltip key={si} name={seg.text}>
                            <span className="seq-card-ref">{seg.text}</span>
                          </CardTooltip>
                        ) : (
                          <React.Fragment key={si}>{seg.text}</React.Fragment>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="seq-no-actions">No actions</p>
            )}
            {turnLog.lifeLoss > 0 && (
              <p className="seq-life-loss">Life lost this turn: {turnLog.lifeLoss}</p>
            )}
          </div>
        ))}
    </div>
  </>
);

// ─────────────────────────────────────────────────────────────────────────────
// downloadTextFile
// ─────────────────────────────────────────────────────────────────────────────
export const downloadTextFile = (content, filename) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// prepareChartData
//   Pure function — receives simulationResults + turns count.
// ─────────────────────────────────────────────────────────────────────────────
export const prepareChartData = (simulationResults, turns) => {
  if (!simulationResults) return null;

  const landsData = [];
  const manaByColorData = [];
  const lifeLossData = [];
  const cardsDrawnData = [];
  const treasureData = [];
  const keyCardsData = [];

  for (let i = 0; i < turns; i++) {
    const landsAvg = simulationResults.landsPerTurn?.[i] || 0;
    const landsSd = simulationResults.landsPerTurnStdDev?.[i] || 0;
    const untappedAvg = simulationResults.untappedLandsPerTurn?.[i] || 0;
    const untappedSd = simulationResults.untappedLandsPerTurnStdDev?.[i] || 0;
    const manaAvg = simulationResults.totalManaPerTurn?.[i] || 0;
    const manaSd = simulationResults.totalManaPerTurnStdDev?.[i] || 0;

    landsData.push({
      turn: i + 1,
      'Total Lands': safeToFixed(landsAvg, 2),
      'Untapped Lands': safeToFixed(untappedAvg, 2),
      'Total Lands Lo': safeToFixed(Math.max(0, landsAvg - landsSd), 2),
      'Total Lands Hi': safeToFixed(landsAvg + landsSd, 2),
      'Untapped Lands Lo': safeToFixed(Math.max(0, untappedAvg - untappedSd), 2),
      'Untapped Lands Hi': safeToFixed(untappedAvg + untappedSd, 2),
      _landsSd: safeToFixed(landsSd, 2),
      _untappedSd: safeToFixed(untappedSd, 2),
    });

    manaByColorData.push({
      turn: i + 1,
      'Total Mana': safeToFixed(manaAvg, 2),
      'Total Mana Lo': safeToFixed(Math.max(0, manaAvg - manaSd), 2),
      'Total Mana Hi': safeToFixed(manaAvg + manaSd, 2),
      _manaSd: safeToFixed(manaSd, 2),
      W: safeToFixed(simulationResults.colorsByTurn?.[i]?.W, 2),
      U: safeToFixed(simulationResults.colorsByTurn?.[i]?.U, 2),
      B: safeToFixed(simulationResults.colorsByTurn?.[i]?.B, 2),
      R: safeToFixed(simulationResults.colorsByTurn?.[i]?.R, 2),
      G: safeToFixed(simulationResults.colorsByTurn?.[i]?.G, 2),
    });

    const lifeLossAvg = simulationResults.lifeLossPerTurn?.[i] || 0;
    const lifeLossSd = simulationResults.lifeLossPerTurnStdDev?.[i] || 0;
    lifeLossData.push({
      turn: i + 1,
      'Life Loss': safeToFixed(lifeLossAvg, 2),
      'Life Loss Lo': safeToFixed(Math.max(0, lifeLossAvg - lifeLossSd), 2),
      'Life Loss Hi': safeToFixed(lifeLossAvg + lifeLossSd, 2),
      _lifeLossSd: safeToFixed(lifeLossSd, 2),
    });

    const drawnAvg = simulationResults.cardsDrawnPerTurn?.[i] || 0;
    const drawnSd = simulationResults.cardsDrawnPerTurnStdDev?.[i] || 0;
    cardsDrawnData.push({
      turn: i + 1,
      'Cards Drawn': safeToFixed(drawnAvg, 2),
      'Cards Drawn Lo': safeToFixed(Math.max(0, drawnAvg - drawnSd), 2),
      'Cards Drawn Hi': safeToFixed(drawnAvg + drawnSd, 2),
      _drawnSd: safeToFixed(drawnSd, 2),
    });

    const treasureAvg = simulationResults.treasurePerTurn?.[i] || 0;
    const treasureSd = simulationResults.treasurePerTurnStdDev?.[i] || 0;
    treasureData.push({
      turn: i + 1,
      'Treasure Pool': safeToFixed(treasureAvg, 2),
      'Treasure Pool Lo': safeToFixed(Math.max(0, treasureAvg - treasureSd), 2),
      'Treasure Pool Hi': safeToFixed(treasureAvg + treasureSd, 2),
      _treasureSd: safeToFixed(treasureSd, 2),
    });

    const keyCardRow = { turn: i + 1 };
    if (simulationResults.keyCardPlayability) {
      Object.keys(simulationResults.keyCardPlayability).forEach(cardName => {
        keyCardRow[cardName] = safeToFixed(simulationResults.keyCardPlayability[cardName]?.[i], 1);
      });
    }
    if (simulationResults.hasBurstCards && simulationResults.keyCardPlayabilityBurst) {
      Object.keys(simulationResults.keyCardPlayabilityBurst).forEach(cardName => {
        keyCardRow[`${cardName} (+burst)`] = safeToFixed(
          simulationResults.keyCardPlayabilityBurst[cardName]?.[i],
          1
        );
      });
    }
    keyCardsData.push(keyCardRow);
  }

  return { landsData, manaByColorData, lifeLossData, cardsDrawnData, treasureData, keyCardsData };
};
