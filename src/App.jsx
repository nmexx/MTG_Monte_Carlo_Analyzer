import React, { useState, useEffect, useMemo, useCallback } from 'react';
import LZString from 'lz-string';

// ─── Simulation & Parsing ─────────────────────────────────────────────────────────────────────────────
import { parseDeckList } from './parser/deckParser.js';

// ─── UI Utilities ─────────────────────────────────────────────────────────────
import {
  getManaSymbol,
  renderManaCost,
  getFetchSymbol,
  renderSequenceBody,
  prepareChartData,
} from './utils/uiHelpers.jsx';

// ─── Hooks ────────────────────────────────────────────────────────────────────
import { useDeckSlot, serializeDeckSlot } from './hooks/useDeckSlot.js';
import { useCardLookup, SCRYFALL_SOFT_LIMIT, SCRYFALL_HARD_LIMIT } from './hooks/useCardLookup.js';

// ─── Panel Components ─────────────────────────────────────────────────────────
import SimulationSettingsPanel from './components/SimulationSettingsPanel.jsx';
import ResultsPanel from './components/ResultsPanel.jsx';
import ComparisonResultsPanel from './components/ComparisonResultsPanel.jsx';
import DeckPanels from './components/DeckPanels.jsx';
import ComparisonPanelGrid from './components/ComparisonPanelGrid.jsx';

import html2canvas from 'html2canvas';

// =============================================================================
// localStorage persistence helpers
// =============================================================================
const STORAGE_KEY = 'mtg_mca_state';

const getSaved = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// =============================================================================
// Shareable URL — encode / decode the full app state via the URL hash
// =============================================================================

/** Compress a plain JS object into a URL-safe hash string. */
const encodeStateToHash = obj => LZString.compressToEncodedURIComponent(JSON.stringify(obj));

/** Read + decompress the current URL hash; returns null when absent/invalid. */
const decodeHashToState = () => {
  try {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    const json = LZString.decompressFromEncodedURIComponent(hash);
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/**
 * Resolved once at module evaluation time so that every useState initialiser
 * can consume it directly without extra effects.
 */
const _urlState = decodeHashToState();

// Remove the hash from the address bar immediately so that subsequent
// localStorage saves are not confused by a stale hash.
if (_urlState) {
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

// =============================================================================
const MTGMonteCarloAnalyzer = () => {
  // URL hash state takes priority over localStorage, read once at startup.
  const [_s] = useState(() => _urlState ?? getSaved());

  // ── Data source ────────────────────────────────────────────────────────────
  const [apiMode, setApiMode] = useState(() => _s.apiMode ?? 'local');

  // ── Comparison mode ────────────────────────────────────────────────────────
  const [comparisonMode, setComparisonMode] = useState(() => _s.comparisonMode ?? false);
  const [labelA, setLabelA] = useState(() => _s.labelA ?? 'Deck A');
  const [labelB, setLabelB] = useState(() => _s.labelB ?? 'Deck B');

  // ── Deck slots ─────────────────────────────────────────────────────────────
  const { slot: deckSlotA, setSlot: setDeckSlotA } = useDeckSlot(_s.slotA ?? _s);
  const { slot: deckSlotB, setSlot: setDeckSlotB } = useDeckSlot(_s.slotB ?? {});

  const { parsedDeck, simulationResults } = deckSlotA;
  const { parsedDeck: parsedDeckB, simulationResults: simulationResultsB } = deckSlotB;

  // ── Card lookup (file upload + optional Scryfall API) ──────────────────────
  const [error, setError] = useState('');
  const { cardsDatabase, lookupCacheRef, scryfallCallCount, handleFileUpload, lookupCard } =
    useCardLookup(apiMode, setError);

  // ── Mulligan settings ──────────────────────────────────────────────────────
  const [enableMulligans, setEnableMulligans] = useState(() => _s.enableMulligans ?? false);
  const [mulliganRule, setMulliganRule] = useState(() => _s.mulliganRule ?? 'london');
  const [mulliganStrategy, setMulliganStrategy] = useState(() => _s.mulliganStrategy ?? 'balanced');
  const [customMulliganRules, setCustomMulliganRules] = useState(
    () =>
      _s.customMulliganRules ?? {
        mulligan0Lands: true,
        mulligan7Lands: true,
        mulliganNoPlaysByTurn: false,
        noPlaysTurnThreshold: 2,
        mulliganMinLands: false,
        minLandsThreshold: 1,
        mulliganMaxLands: false,
        maxLandsThreshold: 5,
      }
  );

  // ── Simulation settings ────────────────────────────────────────────────────
  const [iterations, setIterations] = useState(() => _s.iterations ?? 10000);
  const [turns, setTurns] = useState(() => _s.turns ?? 7);
  const [handSize, setHandSize] = useState(() => _s.handSize ?? 7);
  const [maxSequences, setMaxSequences] = useState(() => _s.maxSequences ?? 1);
  const [selectedTurnForSequences, setSelectedTurnForSequences] = useState(
    () => _s.selectedTurnForSequences ?? 3
  );
  const [commanderMode, setCommanderMode] = useState(() => _s.commanderMode ?? false);

  // ── Flood / screw thresholds ───────────────────────────────────────────────
  const [floodNLands, setFloodNLands] = useState(() => _s.floodNLands ?? 5);
  const [floodTurn, setFloodTurn] = useState(() => _s.floodTurn ?? 5);
  const [screwNLands, setScrewNLands] = useState(() => _s.screwNLands ?? 2);
  const [screwTurn, setScrewTurn] = useState(() => _s.screwTurn ?? 3);

  const [isSimulating, setIsSimulating] = useState(false);
  const [simProgress, setSimProgress] = useState(0);

  // ── Share URL ──────────────────────────────────────────────────────────────
  const [shareCopied, setShareCopied] = useState(false);

  // =============================================================================
  // buildPersistableState — single source of truth for localStorage + URL hash
  // =============================================================================
  const buildPersistableState = () => ({
    apiMode,
    comparisonMode,
    labelA,
    labelB,
    slotA: serializeDeckSlot(deckSlotA),
    slotB: serializeDeckSlot(deckSlotB),
    iterations,
    turns,
    handSize,
    maxSequences,
    selectedTurnForSequences,
    commanderMode,
    enableMulligans,
    mulliganRule,
    mulliganStrategy,
    customMulliganRules,
    floodNLands,
    floodTurn,
    screwNLands,
    screwTurn,
  });

  // ── Share URL handler ──────────────────────────────────────────────────────
  const handleShareUrl = useCallback(() => {
    const hash = encodeStateToHash(buildPersistableState());
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    apiMode,
    comparisonMode,
    labelA,
    labelB,
    deckSlotA,
    deckSlotB,
    iterations,
    turns,
    handSize,
    maxSequences,
    selectedTurnForSequences,
    commanderMode,
    enableMulligans,
    mulliganRule,
    mulliganStrategy,
    customMulliganRules,
    floodNLands,
    floodTurn,
    screwNLands,
    screwTurn,
  ]);

  // ── Derived chart data ─────────────────────────────────────────────────────
  const chartData = useMemo(
    () => (simulationResults ? prepareChartData(simulationResults, turns) : null),
    [simulationResults, turns]
  );
  const chartDataB = useMemo(
    () => (simulationResultsB ? prepareChartData(simulationResultsB, turns) : null),
    [simulationResultsB, turns]
  );

  // ── Persist to localStorage ────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistableState()));
    } catch (err) {
      console.warn('localStorage save failed:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    deckSlotA,
    deckSlotB,
    apiMode,
    comparisonMode,
    labelA,
    labelB,
    iterations,
    turns,
    handSize,
    maxSequences,
    selectedTurnForSequences,
    commanderMode,
    enableMulligans,
    mulliganRule,
    mulliganStrategy,
    customMulliganRules,
    floodNLands,
    floodTurn,
    screwNLands,
    screwTurn,
  ]);

  // =============================================================================
  // Parse deck — resolves card data via cache + optional Scryfall API
  // =============================================================================
  const handleParseDeck = useCallback(
    async (text, setSlot, label) => {
      const deck = await parseDeckList(text, {
        cardLookupMap: lookupCacheRef.current,
        apiMode,
        lookupCard,
      });
      if (deck) {
        setSlot(prev => ({ ...prev, parsedDeck: deck, selectedKeyCards: new Set() }));
        setError(deck.errors?.length > 0 ? deck.errors.join(', ') : '');
      } else {
        setSlot(prev => ({ ...prev, parsedDeck: null }));
        setError(label ? `Parsing failed (${label})` : 'Parsing failed');
      }
    },
    [apiMode, lookupCard, lookupCacheRef, setError]
  );

  // =============================================================================
  // serializeConfig — converts Set fields to Arrays for postMessage transfer
  // =============================================================================
  const SET_CONFIG_FIELDS = [
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
  const serializeConfig = config => {
    const out = { ...config };
    SET_CONFIG_FIELDS.forEach(f => {
      out[f] = [...(config[f] ?? [])];
    });
    return out;
  };

  // =============================================================================
  // buildSimConfig — assembles the monteCarlo config object for a given slot
  // =============================================================================
  const buildSimConfig = slot => ({
    iterations,
    turns,
    handSize,
    maxSequences,
    commanderMode,
    commanderName: slot.commanderName ?? '',
    enableMulligans,
    mulliganRule,
    mulliganStrategy,
    customMulliganRules,
    floodNLands,
    floodTurn,
    screwNLands,
    screwTurn,
    selectedKeyCards: slot.selectedKeyCards,
    includeExploration: slot.includeExploration,
    disabledExploration: slot.disabledExploration,
    includeRampSpells: slot.includeRampSpells,
    disabledRampSpells: slot.disabledRampSpells,
    includeArtifacts: slot.includeArtifacts,
    disabledArtifacts: slot.disabledArtifacts,
    includeCreatures: slot.includeCreatures,
    disabledCreatures: slot.disabledCreatures,
    includeRituals: slot.includeRituals,
    disabledRituals: slot.disabledRituals,
    manaOverrides: slot.manaOverrides,
    includeCostReducers: slot.includeCostReducers,
    disabledCostReducers: slot.disabledCostReducers,
    includeDrawSpells: slot.includeDrawSpells,
    disabledDrawSpells: slot.disabledDrawSpells,
    drawOverrides: slot.drawOverrides,
    includeTreasures: slot.includeTreasures,
    disabledTreasures: slot.disabledTreasures,
    treasureOverrides: slot.treasureOverrides,
    ritualOverrides: slot.ritualOverrides,
  });

  // =============================================================================
  // runSimulation — offloads monteCarlo to a Web Worker (improvement #24)
  // =============================================================================
  const runSimulation = () => {
    if (!parsedDeck) {
      setError('Please parse a deck first');
      return;
    }
    if (comparisonMode && !parsedDeckB) {
      setError('Please parse Deck B first');
      return;
    }

    setIsSimulating(true);
    setSimProgress(0);
    setError('');

    const worker = new Worker(new URL('./simulation/simulationWorker.js', import.meta.url), {
      type: 'module',
    });
    const totalDecks = comparisonMode ? 2 : 1;
    const configB = comparisonMode ? serializeConfig(buildSimConfig(deckSlotB)) : null;

    const finish = () => {
      worker.terminate();
      setIsSimulating(false);
    };

    worker.onerror = err => {
      setError('Simulation error: ' + (err.message ?? 'unknown'));
      finish();
    };

    worker.onmessage = ({ data }) => {
      if (data.type === 'PROGRESS') {
        // Deck A fills 0→100% (single) or 0→50% (comparison);
        // Deck B fills 50→100% in comparison mode.
        const offset = data.deckId === 'B' ? 50 : 0;
        const share = 100 / totalDecks;
        setSimProgress(Math.round(offset + (data.completed / data.total) * share));
      } else if (data.type === 'RESULT') {
        if (data.deckId === 'A') {
          setDeckSlotA(prev => ({ ...prev, simulationResults: data.results }));
          if (comparisonMode) {
            setSimProgress(50);
            worker.postMessage({
              type: 'RUN',
              deckId: 'B',
              deckToParse: parsedDeckB,
              config: configB,
            });
          } else {
            setSimProgress(100);
            finish();
          }
        } else {
          setDeckSlotB(prev => ({ ...prev, simulationResults: data.results }));
          setSimProgress(100);
          finish();
        }
      } else if (data.type === 'ERROR') {
        setError('Simulation error: ' + data.message);
        finish();
      }
    };

    worker.postMessage({
      type: 'RUN',
      deckId: 'A',
      deckToParse: parsedDeck,
      config: serializeConfig(buildSimConfig(deckSlotA)),
    });
  };

  // =============================================================================
  // Export results as PNG
  // =============================================================================
  const exportResultsAsPNG = useCallback(
    async event => {
      if (!simulationResults) return;
      const button = event?.target;
      const originalText = button?.textContent;
      try {
        const resultsSection = document.getElementById('results-section');
        if (!resultsSection) {
          alert('Results section not found');
          return;
        }
        if (button) {
          button.textContent = 'Capturing...';
          button.disabled = true;
        }

        const bgColor =
          getComputedStyle(document.documentElement).getPropertyValue('--clr-bg').trim() ||
          '#f9fafb';

        await new Promise(r => setTimeout(r, 300));

        const canvas = await html2canvas(resultsSection, {
          backgroundColor: bgColor,
          scale: 2,
          logging: false,
          useCORS: true,
        });

        canvas.toBlob(blob => {
          if (!blob) {
            alert('Failed to generate image. Please use your browser screenshot tool.');
            if (button) {
              button.textContent = originalText;
              button.disabled = false;
            }
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `mtg-simulation-results-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          if (button) {
            button.textContent = originalText;
            button.disabled = false;
          }
        });
      } catch (err) {
        console.error('Export error:', err);
        alert(
          'Failed to export. Please use your browser screenshot tool ' +
            '(Ctrl+Shift+S on Windows, Cmd+Shift+5 on Mac)'
        );
        if (button) {
          button.textContent = originalText;
          button.disabled = false;
        }
      }
    },
    [simulationResults]
  );

  // =============================================================================
  // Export results as CSV — comparison-aware
  // =============================================================================
  const exportResultsAsCSV = useCallback(() => {
    const buildRows = cd => {
      if (!cd) return [];
      const { landsData, manaByColorData, lifeLossData, keyCardsData } = cd;
      return Array.from({ length: landsData.length }, (_, i) => {
        const row = {
          Turn: landsData[i].turn,
          'Total Lands': landsData[i]['Total Lands'],
          'Untapped Lands': landsData[i]['Untapped Lands'],
          'Total Mana': manaByColorData[i]['Total Mana'],
          'W Mana': manaByColorData[i].W,
          'U Mana': manaByColorData[i].U,
          'B Mana': manaByColorData[i].B,
          'R Mana': manaByColorData[i].R,
          'G Mana': manaByColorData[i].G,
          'Life Loss': lifeLossData[i]['Life Loss'],
        };
        const keyRow = keyCardsData[i];
        Object.keys(keyRow).forEach(k => {
          if (k !== 'turn') row[k] = keyRow[k];
        });
        return row;
      });
    };

    const rowsA = buildRows(chartData);
    const rowsB = buildRows(chartDataB);
    if (!rowsA.length && !rowsB.length) return;

    let rows, headers;
    if (comparisonMode && rowsA.length && rowsB.length) {
      const headersA = Object.keys(rowsA[0]).map(k => (k === 'Turn' ? 'Turn' : `${labelA}: ${k}`));
      const headersB = Object.keys(rowsB[0])
        .filter(k => k !== 'Turn')
        .map(k => `${labelB}: ${k}`);
      headers = [...headersA, ...headersB];
      rows = rowsA.map((ra, i) => {
        const rb = rowsB[i] || {};
        const merged = {};
        Object.keys(ra).forEach((k, j) => {
          merged[headersA[j]] = ra[k];
        });
        Object.keys(rb)
          .filter(k => k !== 'Turn')
          .forEach(k => {
            merged[`${labelB}: ${k}`] = rb[k];
          });
        return merged;
      });
    } else {
      rows = rowsA.length ? rowsA : rowsB;
      headers = Object.keys(rows[0]);
    }

    const escape = v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const csv = [
      headers.map(escape).join(','),
      ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mtg-simulation-results-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [chartData, chartDataB, comparisonMode, labelA, labelB]);

  // =============================================================================
  // Simulation settings props — shared between single-deck and comparison modes
  // =============================================================================
  const simSettingsProps = {
    iterations,
    setIterations,
    turns,
    setTurns,
    handSize,
    setHandSize,
    maxSequences,
    setMaxSequences,
    selectedTurnForSequences,
    setSelectedTurnForSequences,
    commanderMode,
    setCommanderMode,
    enableMulligans,
    setEnableMulligans,
    mulliganRule,
    setMulliganRule,
    mulliganStrategy,
    setMulliganStrategy,
    customMulliganRules,
    setCustomMulliganRules,
    floodNLands,
    setFloodNLands,
    floodTurn,
    setFloodTurn,
    screwNLands,
    setScrewNLands,
    screwTurn,
    setScrewTurn,
    runSimulation,
    isSimulating,
  };

  // =============================================================================
  // Render
  // =============================================================================
  return (
    <div className="app-root">
      {/* Simulating overlay */}
      {isSimulating && (
        <div className="sim-overlay">
          <div className="sim-spinner" />
          <div className="sim-overlay__text">Simulating...</div>
          <div className="sim-overlay__sub">
            {iterations.toLocaleString()} iterations &middot; {simProgress}%
          </div>
          <div className="sim-progress-track">
            <div className="sim-progress-bar" style={{ width: `${simProgress}%` }} />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="app-header">
        <div className="app-header__titles">
          <h1>Commandertables presents: MTG Analyzer</h1>
          <p>Monte Carlo mana-base analyzer for Magic: The Gathering</p>
        </div>
      </div>

      {/* Utility toolbar */}
      <div className="app-toolbar">
        <div className="app-toolbar__left">
          <a
            className="toolbar-btn toolbar-btn--yt"
            href="https://www.youtube.com/@CommanderTables/videos"
            target="_blank"
            rel="noopener noreferrer"
            title="CommanderTables on YouTube"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.75 15.5V8.5l6.25 3.5-6.25 3.5z" />
            </svg>
            Watch on YouTube
          </a>
          <a className="toolbar-btn" href="./tutorial.html" title="How the simulator works">
            📖 Tutorial
          </a>
        </div>
        <div className="app-toolbar__right">
          <button
            className={`toolbar-btn${shareCopied ? ' toolbar-btn--copied' : ''}`}
            onClick={handleShareUrl}
            title="Copy a shareable link to this exact configuration"
          >
            {shareCopied ? '✓ Copied!' : '🔗 Share'}
          </button>
        </div>
      </div>

      {/* Data Source */}
      <div className="panel">
        <h3>⚙️ Data Source</h3>
        <div className="radio-group" style={{ marginBottom: 12 }}>
          <label className="radio-label">
            <input
              type="radio"
              checked={apiMode === 'local'}
              onChange={() => setApiMode('local')}
            />
            Local JSON File
          </label>
          <label className="radio-label">
            <input
              type="radio"
              checked={apiMode === 'scryfall'}
              onChange={() => setApiMode('scryfall')}
            />
            Scryfall API (Fallback)
          </label>
        </div>

        {/* Scryfall usage warnings */}
        {apiMode === 'scryfall' &&
          scryfallCallCount >= SCRYFALL_SOFT_LIMIT &&
          scryfallCallCount < SCRYFALL_HARD_LIMIT && (
            <div className="scryfall-usage-warning">
              You have made {scryfallCallCount} Scryfall API requests this session. For large or
              repeated imports, switch to the{' '}
              <button className="inline-link" onClick={() => setApiMode('local')}>
                Local JSON file
              </button>{' '}
              to avoid hitting rate limits.
            </div>
          )}
        {apiMode === 'scryfall' && scryfallCallCount >= SCRYFALL_HARD_LIMIT && (
          <div className="scryfall-usage-blocked">
            Scryfall API limit reached ({SCRYFALL_HARD_LIMIT} requests this session). Please{' '}
            <button className="inline-link" onClick={() => setApiMode('local')}>
              switch to Local JSON
            </button>{' '}
            for further lookups, or reload the page to reset the counter.{' '}
            <em>Tip: the local JSON file is faster and works offline.</em>
          </div>
        )}

        {apiMode === 'local' && (
          <div className="upload-section">
            <div className="upload-instructions">
              <p>📥 How to get cards.json:</p>
              <ol>
                <li>
                  Visit{' '}
                  <a
                    href="https://scryfall.com/docs/api/bulk-data"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Scryfall Bulk Data
                  </a>
                </li>
                <li>
                  Download <strong>&quot;Default Cards&quot;</strong> (not &quot;All Cards&quot; or
                  &quot;Oracle Cards&quot;)
                </li>
                <li>File size should be ~200-300 MB (compressed)</li>
                <li>Upload the JSON file below</li>
              </ol>
            </div>
            <input type="file" accept=".json" onChange={handleFileUpload} className="file-input" />
            {cardsDatabase && (
              <p className="loaded-success">
                ✓ Loaded {cardsDatabase.length.toLocaleString()} cards
              </p>
            )}
          </div>
        )}

        {/* Mode toggle */}
        <div style={{ marginTop: 16 }}>
          <div className="mode-toggle">
            <button
              className={`mode-toggle__btn${!comparisonMode ? ' mode-toggle__btn--active' : ''}`}
              onClick={() => setComparisonMode(false)}
            >
              🃏 Single Deck
            </button>
            <button
              className={`mode-toggle__btn${comparisonMode ? ' mode-toggle__btn--active' : ''}`}
              onClick={() => setComparisonMode(true)}
            >
              ⚔️ Compare Two Decks
            </button>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && <div className="error-banner">⚠️ {error}</div>}

      {/* Single-deck mode */}
      {!comparisonMode && (
        <>
          {/* Deck Input */}
          <div className="panel">
            <div className="panel-header-row">
              <h3>📝 Deck List</h3>
            </div>
            <textarea
              value={deckSlotA.deckText}
              onChange={e => setDeckSlotA(prev => ({ ...prev, deckText: e.target.value }))}
              placeholder={
                'Paste your deck list here (MTG Arena format)\nExample:\n4 Lightning Bolt\n4 Island\n3 Counterspell'
              }
              className="deck-textarea"
            />
            <button
              onClick={() => handleParseDeck(deckSlotA.deckText, setDeckSlotA)}
              className="btn-primary"
            >
              Parse Deck
            </button>
            {commanderMode && (
              <div className="commander-name-field" style={{ marginTop: 10 }}>
                <label className="settings-label" htmlFor="commander-name-input">
                  🎩 Commander card
                </label>
                <input
                  id="commander-name-input"
                  type="text"
                  className="settings-input"
                  placeholder="e.g. Kenrith, the Returned King"
                  value={deckSlotA.commanderName}
                  onChange={e => setDeckSlotA(prev => ({ ...prev, commanderName: e.target.value }))}
                />
                <div className="commander-name-hint">
                  Always tracked as a key card (command zone — always available).
                </div>
              </div>
            )}
          </div>

          {parsedDeck && (
            <>
              <DeckPanels
                parsedDeck={parsedDeck}
                slot={deckSlotA}
                setSlot={setDeckSlotA}
                getManaSymbol={getManaSymbol}
                getFetchSymbol={getFetchSymbol}
                renderManaCost={renderManaCost}
              />
              <SimulationSettingsPanel {...simSettingsProps} />
            </>
          )}

          {parsedDeck && !simulationResults && !isSimulating && (
            <div className="panel">
              <div className="empty-results">
                <span className="empty-results__icon">🎲</span>
                <p className="empty-results__text">Ready to simulate</p>
                <p className="empty-results__sub">
                  Configure settings above and click <strong>Start Simulation</strong> to see
                  results here.
                </p>
              </div>
            </div>
          )}

          <ResultsPanel
            simulationResults={simulationResults}
            chartData={chartData}
            iterations={iterations}
            enableMulligans={enableMulligans}
            selectedKeyCards={deckSlotA.selectedKeyCards}
            commanderName={deckSlotA.commanderName}
            selectedTurnForSequences={selectedTurnForSequences}
            exportResultsAsPNG={exportResultsAsPNG}
            exportResultsAsCSV={exportResultsAsCSV}
            renderSequenceBody={renderSequenceBody}
          />
        </>
      )}

      {/* Comparison mode */}
      {comparisonMode && (
        <>
          {/* Deck input row */}
          <div className="deck-columns">
            <div className="panel">
              <div className="deck-column-header deck-column-header--a">{labelA}</div>
              <input
                className="deck-label-input"
                value={labelA}
                onChange={e => setLabelA(e.target.value)}
                placeholder="Deck A name"
              />
              <textarea
                value={deckSlotA.deckText}
                onChange={e => setDeckSlotA(prev => ({ ...prev, deckText: e.target.value }))}
                placeholder="Paste deck list here (MTG Arena format)"
                className="deck-textarea"
                style={{ height: 180 }}
              />
              <button
                onClick={() => handleParseDeck(deckSlotA.deckText, setDeckSlotA)}
                className="btn-primary"
              >
                Parse Deck
              </button>
              {commanderMode && (
                <div className="commander-name-field" style={{ marginTop: 10 }}>
                  <label className="settings-label">🎩 Commander ({labelA})</label>
                  <input
                    type="text"
                    className="settings-input"
                    placeholder="e.g. Kenrith, the Returned King"
                    value={deckSlotA.commanderName}
                    onChange={e =>
                      setDeckSlotA(prev => ({ ...prev, commanderName: e.target.value }))
                    }
                  />
                  <div className="commander-name-hint">
                    Always tracked as a key card (command zone).
                  </div>
                </div>
              )}
            </div>
            <div className="panel">
              <div className="deck-column-header deck-column-header--b">{labelB}</div>
              <input
                className="deck-label-input"
                value={labelB}
                onChange={e => setLabelB(e.target.value)}
                placeholder="Deck B name"
              />
              <textarea
                value={deckSlotB.deckText}
                onChange={e => setDeckSlotB(prev => ({ ...prev, deckText: e.target.value }))}
                placeholder="Paste deck list here (MTG Arena format)"
                className="deck-textarea"
                style={{ height: 180 }}
              />
              <button
                onClick={() => handleParseDeck(deckSlotB.deckText, setDeckSlotB, 'Deck B')}
                className="btn-primary"
              >
                Parse Deck
              </button>
              {commanderMode && (
                <div className="commander-name-field" style={{ marginTop: 10 }}>
                  <label className="settings-label">🎩 Commander ({labelB})</label>
                  <input
                    type="text"
                    className="settings-input"
                    placeholder="e.g. Kenrith, the Returned King"
                    value={deckSlotB.commanderName}
                    onChange={e =>
                      setDeckSlotB(prev => ({ ...prev, commanderName: e.target.value }))
                    }
                  />
                  <div className="commander-name-hint">
                    Always tracked as a key card (command zone).
                  </div>
                </div>
              )}
            </div>
          </div>

          <ComparisonPanelGrid
            parsedDeckA={parsedDeck}
            parsedDeckB={parsedDeckB}
            slotA={deckSlotA}
            setSlotA={setDeckSlotA}
            slotB={deckSlotB}
            setSlotB={setDeckSlotB}
            getManaSymbol={getManaSymbol}
            getFetchSymbol={getFetchSymbol}
            renderManaCost={renderManaCost}
          />

          {(parsedDeck || parsedDeckB) && <SimulationSettingsPanel {...simSettingsProps} />}

          {chartData && chartDataB ? (
            <ComparisonResultsPanel
              chartDataA={chartData}
              chartDataB={chartDataB}
              simulationResultsA={simulationResults}
              simulationResultsB={simulationResultsB}
              iterations={iterations}
              enableMulligans={enableMulligans}
              selectedKeyCardsA={deckSlotA.selectedKeyCards}
              selectedKeyCardsB={deckSlotB.selectedKeyCards}
              commanderNameA={deckSlotA.commanderName}
              commanderNameB={deckSlotB.commanderName}
              labelA={labelA}
              labelB={labelB}
              exportResultsAsPNG={exportResultsAsPNG}
              exportResultsAsCSV={exportResultsAsCSV}
            />
          ) : chartData || chartDataB ? (
            <div className="panel">
              <p className="card-meta">
                {chartData
                  ? `${labelA} has results. Parse and simulate ${labelB} to see the comparison.`
                  : `${labelB} has results. Parse and simulate ${labelA} to see the comparison.`}
              </p>
            </div>
          ) : null}
        </>
      )}

      {/* Footer */}
      <div className="app-footer">
        <p>All card data &copy; Wizards of the Coast</p>
        <p className="app-version">v{__APP_VERSION__}</p>
      </div>
    </div>
  );
};

export default MTGMonteCarloAnalyzer;
