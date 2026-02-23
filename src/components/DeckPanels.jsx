/**
 * DeckPanels — renders all per-deck configuration panels in single-deck mode.
 *
 * Each section is wrapped in a <details> element so the user can collapse/expand
 * individual categories independently. Visibility of category sections is driven
 * by the parsed deck contents (e.g. Artifacts panel only appears when the deck
 * contains at least one mana artifact).
 *
 * Props
 * ─────
 *   parsedDeck        object  — result of parseDeckList
 *   slot              object  — current deck slot state (from useDeckSlot)
 *   setSlot           fn      — React setState setter for this slot
 *   getManaSymbol     fn      — from uiHelpers
 *   getFetchSymbol    fn      — from uiHelpers
 *   renderManaCost    fn      — from uiHelpers
 */

import React, { useMemo } from 'react';
import { makeSlotSetter } from '../hooks/useDeckSlot.js';

import LandsPanel from './LandsPanel.jsx';
import ArtifactsPanel from './ArtifactsPanel.jsx';
import CreaturesPanel from './CreaturesPanel.jsx';
import ExplorationPanel from './ExplorationPanel.jsx';
import RampSpellsPanel from './RampSpellsPanel.jsx';
import RitualsPanel from './RitualsPanel.jsx';
import CostReducersPanel from './CostReducersPanel.jsx';
import DrawSpellsPanel from './DrawSpellsPanel.jsx';
import TreasuresPanel from './TreasuresPanel.jsx';
import SpellsPanel from './SpellsPanel.jsx';
import DeckStatisticsPanel from './DeckStatisticsPanel.jsx';

// True when a deck has any non-land spells that the simulator can track.
const hasCastables = deck =>
  deck &&
  (deck.spells.length > 0 ||
    deck.creatures.length > 0 ||
    deck.artifacts.length > 0 ||
    deck.rituals?.length > 0 ||
    deck.rampSpells?.length > 0 ||
    deck.drawSpells?.length > 0 ||
    deck.exploration?.length > 0);

// =============================================================================
const DeckPanels = ({
  parsedDeck,
  slot,
  setSlot,
  getManaSymbol,
  getFetchSymbol,
  renderManaCost,
}) => {
  // Stable setter factory — only recreated when setSlot reference changes (never in practice)
  const set = useMemo(() => makeSlotSetter(setSlot), [setSlot]);

  if (!parsedDeck) return null;

  const {
    selectedKeyCards,
    includeArtifacts,
    disabledArtifacts,
    includeCreatures,
    disabledCreatures,
    manaOverrides,
    includeExploration,
    disabledExploration,
    includeRampSpells,
    disabledRampSpells,
    includeRituals,
    disabledRituals,
    ritualOverrides,
    includeCostReducers,
    disabledCostReducers,
    includeDrawSpells,
    disabledDrawSpells,
    drawOverrides,
    includeTreasures,
    disabledTreasures,
    treasureOverrides,
  } = slot;

  return (
    <div>
      <DeckStatisticsPanel parsedDeck={parsedDeck} />

      {/* Lands — always shown */}
      <details className="section-details" open>
        <summary className="section-summary">
          🗺️ Lands
          <span className="section-summary__chevron">▾</span>
        </summary>
        <div className="panel-grid">
          <LandsPanel
            parsedDeck={parsedDeck}
            getManaSymbol={getManaSymbol}
            getFetchSymbol={getFetchSymbol}
          />
        </div>
      </details>

      {parsedDeck.artifacts.length > 0 && (
        <details className="section-details" open>
          <summary className="section-summary">
            🏺 Artifacts &amp; Mana Rocks
            <span className="section-summary__chevron">▾</span>
          </summary>
          <div className="panel-grid">
            <ArtifactsPanel
              parsedDeck={parsedDeck}
              includeArtifacts={includeArtifacts}
              setIncludeArtifacts={set('includeArtifacts')}
              disabledArtifacts={disabledArtifacts}
              setDisabledArtifacts={set('disabledArtifacts')}
              getManaSymbol={getManaSymbol}
              manaOverrides={manaOverrides}
              setManaOverrides={set('manaOverrides')}
            />
          </div>
        </details>
      )}

      {parsedDeck.creatures.length > 0 && (
        <details className="section-details" open>
          <summary className="section-summary">
            🐉 Creatures &amp; Mana Dorks
            <span className="section-summary__chevron">▾</span>
          </summary>
          <div className="panel-grid">
            <CreaturesPanel
              parsedDeck={parsedDeck}
              includeCreatures={includeCreatures}
              setIncludeCreatures={set('includeCreatures')}
              disabledCreatures={disabledCreatures}
              setDisabledCreatures={set('disabledCreatures')}
              getManaSymbol={getManaSymbol}
              manaOverrides={manaOverrides}
              setManaOverrides={set('manaOverrides')}
            />
          </div>
        </details>
      )}

      {parsedDeck.exploration?.length > 0 && (
        <details className="section-details" open>
          <summary className="section-summary">
            🧭 Exploration Effects
            <span className="section-summary__chevron">▾</span>
          </summary>
          <div className="panel-grid">
            <ExplorationPanel
              parsedDeck={parsedDeck}
              includeExploration={includeExploration}
              setIncludeExploration={set('includeExploration')}
              disabledExploration={disabledExploration}
              setDisabledExploration={set('disabledExploration')}
            />
          </div>
        </details>
      )}

      {parsedDeck.rampSpells?.length > 0 && (
        <details className="section-details" open>
          <summary className="section-summary">
            🌿 Ramp Spells
            <span className="section-summary__chevron">▾</span>
          </summary>
          <div className="panel-grid">
            <RampSpellsPanel
              parsedDeck={parsedDeck}
              includeRampSpells={includeRampSpells}
              setIncludeRampSpells={set('includeRampSpells')}
              disabledRampSpells={disabledRampSpells}
              setDisabledRampSpells={set('disabledRampSpells')}
              renderManaCost={renderManaCost}
            />
          </div>
        </details>
      )}

      {parsedDeck.rituals?.length > 0 && (
        <details className="section-details" open>
          <summary className="section-summary">
            ⚡ Rituals
            <span className="section-summary__chevron">▾</span>
          </summary>
          <div className="panel-grid">
            <RitualsPanel
              parsedDeck={parsedDeck}
              includeRituals={includeRituals}
              setIncludeRituals={set('includeRituals')}
              disabledRituals={disabledRituals}
              setDisabledRituals={set('disabledRituals')}
              renderManaCost={renderManaCost}
              ritualOverrides={ritualOverrides}
              setRitualOverrides={set('ritualOverrides')}
            />
          </div>
        </details>
      )}

      {parsedDeck.costReducers?.length > 0 && (
        <details className="section-details" open>
          <summary className="section-summary">
            ⚗️ Cost Reducers
            <span className="section-summary__chevron">▾</span>
          </summary>
          <div className="panel-grid">
            <CostReducersPanel
              parsedDeck={parsedDeck}
              includeCostReducers={includeCostReducers}
              setIncludeCostReducers={set('includeCostReducers')}
              disabledCostReducers={disabledCostReducers}
              setDisabledCostReducers={set('disabledCostReducers')}
              renderManaCost={renderManaCost}
            />
          </div>
        </details>
      )}

      {parsedDeck.drawSpells?.length > 0 && (
        <details className="section-details" open>
          <summary className="section-summary">
            📖 Draw Spells
            <span className="section-summary__chevron">▾</span>
          </summary>
          <div className="panel-grid">
            <DrawSpellsPanel
              parsedDeck={parsedDeck}
              includeDrawSpells={includeDrawSpells}
              setIncludeDrawSpells={set('includeDrawSpells')}
              disabledDrawSpells={disabledDrawSpells}
              setDisabledDrawSpells={set('disabledDrawSpells')}
              renderManaCost={renderManaCost}
              drawOverrides={drawOverrides}
              setDrawOverrides={set('drawOverrides')}
            />
          </div>
        </details>
      )}

      {parsedDeck.treasureCards?.length > 0 && (
        <details className="section-details" open>
          <summary className="section-summary">
            💰 Treasure Generators
            <span className="section-summary__chevron">▾</span>
          </summary>
          <div className="panel-grid">
            <TreasuresPanel
              parsedDeck={parsedDeck}
              includeTreasures={includeTreasures}
              setIncludeTreasures={set('includeTreasures')}
              disabledTreasures={disabledTreasures}
              setDisabledTreasures={set('disabledTreasures')}
              renderManaCost={renderManaCost}
              treasureOverrides={treasureOverrides}
              setTreasureOverrides={set('treasureOverrides')}
            />
          </div>
        </details>
      )}

      {hasCastables(parsedDeck) && (
        <details className="section-details" open>
          <summary className="section-summary">
            🎯 Key Cards (Spells)
            <span className="section-summary__chevron">▾</span>
          </summary>
          <SpellsPanel
            parsedDeck={parsedDeck}
            selectedKeyCards={selectedKeyCards}
            setSelectedKeyCards={set('selectedKeyCards')}
            renderManaCost={renderManaCost}
          />
        </details>
      )}
    </div>
  );
};

export default DeckPanels;
