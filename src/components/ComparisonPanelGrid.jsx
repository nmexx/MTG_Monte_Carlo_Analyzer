/**
 * ComparisonPanelGrid — renders paired slot panels inside ComparisonRow containers.
 *
 * Each category (Lands, Artifacts, Creatures, …) is shown as a side-by-side row
 * so users can compare both decks simultaneously.  A category row is hidden when
 * *neither* deck contains any relevant cards for it.
 *
 * Props
 * ─────
 *   parsedDeckA / parsedDeckB   object | null — parsed deck for each slot
 *   slotA / slotB               object        — deck slot state (from useDeckSlot)
 *   setSlotA / setSlotB         fn            — React setState setters
 *   getManaSymbol               fn            — from uiHelpers
 *   getFetchSymbol              fn            — from uiHelpers
 *   renderManaCost              fn            — from uiHelpers
 */

import React, { useMemo } from 'react';
import { makeSlotSetter } from '../hooks/useDeckSlot.js';

import ComparisonRow from './ComparisonRow.jsx';
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
const ComparisonPanelGrid = ({
  parsedDeckA,
  parsedDeckB,
  slotA,
  setSlotA,
  slotB,
  setSlotB,
  getManaSymbol,
  getFetchSymbol,
  renderManaCost,
}) => {
  const setA = useMemo(() => makeSlotSetter(setSlotA), [setSlotA]);
  const setB = useMemo(() => makeSlotSetter(setSlotB), [setSlotB]);

  return (
    <>
      {/* Lands — always shown when either deck is parsed */}
      <details className="section-details" open>
        <summary className="section-summary">
          🗺️ Lands
          <span className="section-summary__chevron">▾</span>
        </summary>
        <ComparisonRow
          left={
            parsedDeckA ? (
              <LandsPanel
                parsedDeck={parsedDeckA}
                getManaSymbol={getManaSymbol}
                getFetchSymbol={getFetchSymbol}
              />
            ) : null
          }
          right={
            parsedDeckB ? (
              <LandsPanel
                parsedDeck={parsedDeckB}
                getManaSymbol={getManaSymbol}
                getFetchSymbol={getFetchSymbol}
              />
            ) : null
          }
        />
      </details>

      {/* Artifacts */}
      {(parsedDeckA?.artifacts?.length > 0 || parsedDeckB?.artifacts?.length > 0) && (
        <details className="section-details" open>
          <summary className="section-summary">
            🏺 Artifacts &amp; Mana Rocks
            <span className="section-summary__chevron">▾</span>
          </summary>
          <ComparisonRow
            left={
              parsedDeckA?.artifacts?.length > 0 ? (
                <ArtifactsPanel
                  parsedDeck={parsedDeckA}
                  includeArtifacts={slotA.includeArtifacts}
                  setIncludeArtifacts={setA('includeArtifacts')}
                  disabledArtifacts={slotA.disabledArtifacts}
                  setDisabledArtifacts={setA('disabledArtifacts')}
                  getManaSymbol={getManaSymbol}
                  manaOverrides={slotA.manaOverrides}
                  setManaOverrides={setA('manaOverrides')}
                />
              ) : null
            }
            right={
              parsedDeckB?.artifacts?.length > 0 ? (
                <ArtifactsPanel
                  parsedDeck={parsedDeckB}
                  includeArtifacts={slotB.includeArtifacts}
                  setIncludeArtifacts={setB('includeArtifacts')}
                  disabledArtifacts={slotB.disabledArtifacts}
                  setDisabledArtifacts={setB('disabledArtifacts')}
                  getManaSymbol={getManaSymbol}
                  manaOverrides={slotB.manaOverrides}
                  setManaOverrides={setB('manaOverrides')}
                />
              ) : null
            }
          />
        </details>
      )}

      {/* Creatures */}
      {(parsedDeckA?.creatures?.length > 0 || parsedDeckB?.creatures?.length > 0) && (
        <details className="section-details" open>
          <summary className="section-summary">
            🐉 Creatures &amp; Mana Dorks
            <span className="section-summary__chevron">▾</span>
          </summary>
          <ComparisonRow
            left={
              parsedDeckA?.creatures?.length > 0 ? (
                <CreaturesPanel
                  parsedDeck={parsedDeckA}
                  includeCreatures={slotA.includeCreatures}
                  setIncludeCreatures={setA('includeCreatures')}
                  disabledCreatures={slotA.disabledCreatures}
                  setDisabledCreatures={setA('disabledCreatures')}
                  getManaSymbol={getManaSymbol}
                  manaOverrides={slotA.manaOverrides}
                  setManaOverrides={setA('manaOverrides')}
                />
              ) : null
            }
            right={
              parsedDeckB?.creatures?.length > 0 ? (
                <CreaturesPanel
                  parsedDeck={parsedDeckB}
                  includeCreatures={slotB.includeCreatures}
                  setIncludeCreatures={setB('includeCreatures')}
                  disabledCreatures={slotB.disabledCreatures}
                  setDisabledCreatures={setB('disabledCreatures')}
                  getManaSymbol={getManaSymbol}
                  manaOverrides={slotB.manaOverrides}
                  setManaOverrides={setB('manaOverrides')}
                />
              ) : null
            }
          />
        </details>
      )}

      {/* Exploration */}
      {(parsedDeckA?.exploration?.length > 0 || parsedDeckB?.exploration?.length > 0) && (
        <details className="section-details" open>
          <summary className="section-summary">
            🧭 Exploration Effects
            <span className="section-summary__chevron">▾</span>
          </summary>
          <ComparisonRow
            left={
              parsedDeckA?.exploration?.length > 0 ? (
                <ExplorationPanel
                  parsedDeck={parsedDeckA}
                  includeExploration={slotA.includeExploration}
                  setIncludeExploration={setA('includeExploration')}
                  disabledExploration={slotA.disabledExploration}
                  setDisabledExploration={setA('disabledExploration')}
                />
              ) : null
            }
            right={
              parsedDeckB?.exploration?.length > 0 ? (
                <ExplorationPanel
                  parsedDeck={parsedDeckB}
                  includeExploration={slotB.includeExploration}
                  setIncludeExploration={setB('includeExploration')}
                  disabledExploration={slotB.disabledExploration}
                  setDisabledExploration={setB('disabledExploration')}
                />
              ) : null
            }
          />
        </details>
      )}

      {/* Ramp Spells */}
      {(parsedDeckA?.rampSpells?.length > 0 || parsedDeckB?.rampSpells?.length > 0) && (
        <details className="section-details" open>
          <summary className="section-summary">
            🌿 Ramp Spells
            <span className="section-summary__chevron">▾</span>
          </summary>
          <ComparisonRow
            left={
              parsedDeckA?.rampSpells?.length > 0 ? (
                <RampSpellsPanel
                  parsedDeck={parsedDeckA}
                  includeRampSpells={slotA.includeRampSpells}
                  setIncludeRampSpells={setA('includeRampSpells')}
                  disabledRampSpells={slotA.disabledRampSpells}
                  setDisabledRampSpells={setA('disabledRampSpells')}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
            right={
              parsedDeckB?.rampSpells?.length > 0 ? (
                <RampSpellsPanel
                  parsedDeck={parsedDeckB}
                  includeRampSpells={slotB.includeRampSpells}
                  setIncludeRampSpells={setB('includeRampSpells')}
                  disabledRampSpells={slotB.disabledRampSpells}
                  setDisabledRampSpells={setB('disabledRampSpells')}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
          />
        </details>
      )}

      {/* Rituals */}
      {(parsedDeckA?.rituals?.length > 0 || parsedDeckB?.rituals?.length > 0) && (
        <details className="section-details" open>
          <summary className="section-summary">
            ⚡ Rituals
            <span className="section-summary__chevron">▾</span>
          </summary>
          <ComparisonRow
            left={
              parsedDeckA?.rituals?.length > 0 ? (
                <RitualsPanel
                  parsedDeck={parsedDeckA}
                  includeRituals={slotA.includeRituals}
                  setIncludeRituals={setA('includeRituals')}
                  disabledRituals={slotA.disabledRituals}
                  setDisabledRituals={setA('disabledRituals')}
                  renderManaCost={renderManaCost}
                  ritualOverrides={slotA.ritualOverrides}
                  setRitualOverrides={setA('ritualOverrides')}
                />
              ) : null
            }
            right={
              parsedDeckB?.rituals?.length > 0 ? (
                <RitualsPanel
                  parsedDeck={parsedDeckB}
                  includeRituals={slotB.includeRituals}
                  setIncludeRituals={setB('includeRituals')}
                  disabledRituals={slotB.disabledRituals}
                  setDisabledRituals={setB('disabledRituals')}
                  renderManaCost={renderManaCost}
                  ritualOverrides={slotB.ritualOverrides}
                  setRitualOverrides={setB('ritualOverrides')}
                />
              ) : null
            }
          />
        </details>
      )}

      {/* Cost Reducers */}
      {(parsedDeckA?.costReducers?.length > 0 || parsedDeckB?.costReducers?.length > 0) && (
        <details className="section-details" open>
          <summary className="section-summary">
            ⚗️ Cost Reducers
            <span className="section-summary__chevron">▾</span>
          </summary>
          <ComparisonRow
            left={
              parsedDeckA?.costReducers?.length > 0 ? (
                <CostReducersPanel
                  parsedDeck={parsedDeckA}
                  includeCostReducers={slotA.includeCostReducers}
                  setIncludeCostReducers={setA('includeCostReducers')}
                  disabledCostReducers={slotA.disabledCostReducers}
                  setDisabledCostReducers={setA('disabledCostReducers')}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
            right={
              parsedDeckB?.costReducers?.length > 0 ? (
                <CostReducersPanel
                  parsedDeck={parsedDeckB}
                  includeCostReducers={slotB.includeCostReducers}
                  setIncludeCostReducers={setB('includeCostReducers')}
                  disabledCostReducers={slotB.disabledCostReducers}
                  setDisabledCostReducers={setB('disabledCostReducers')}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
          />
        </details>
      )}

      {/* Draw Spells */}
      {(parsedDeckA?.drawSpells?.length > 0 || parsedDeckB?.drawSpells?.length > 0) && (
        <details className="section-details" open>
          <summary className="section-summary">
            📖 Draw Spells
            <span className="section-summary__chevron">▾</span>
          </summary>
          <ComparisonRow
            left={
              parsedDeckA?.drawSpells?.length > 0 ? (
                <DrawSpellsPanel
                  parsedDeck={parsedDeckA}
                  includeDrawSpells={slotA.includeDrawSpells}
                  setIncludeDrawSpells={setA('includeDrawSpells')}
                  disabledDrawSpells={slotA.disabledDrawSpells}
                  setDisabledDrawSpells={setA('disabledDrawSpells')}
                  renderManaCost={renderManaCost}
                  drawOverrides={slotA.drawOverrides}
                  setDrawOverrides={setA('drawOverrides')}
                />
              ) : null
            }
            right={
              parsedDeckB?.drawSpells?.length > 0 ? (
                <DrawSpellsPanel
                  parsedDeck={parsedDeckB}
                  includeDrawSpells={slotB.includeDrawSpells}
                  setIncludeDrawSpells={setB('includeDrawSpells')}
                  disabledDrawSpells={slotB.disabledDrawSpells}
                  setDisabledDrawSpells={setB('disabledDrawSpells')}
                  renderManaCost={renderManaCost}
                  drawOverrides={slotB.drawOverrides}
                  setDrawOverrides={setB('drawOverrides')}
                />
              ) : null
            }
          />
        </details>
      )}

      {/* Treasure Generators */}
      {(parsedDeckA?.treasureCards?.length > 0 || parsedDeckB?.treasureCards?.length > 0) && (
        <details className="section-details" open>
          <summary className="section-summary">
            💎 Treasure Generators
            <span className="section-summary__chevron">▾</span>
          </summary>
          <ComparisonRow
            left={
              parsedDeckA?.treasureCards?.length > 0 ? (
                <TreasuresPanel
                  parsedDeck={parsedDeckA}
                  includeTreasures={slotA.includeTreasures}
                  setIncludeTreasures={setA('includeTreasures')}
                  disabledTreasures={slotA.disabledTreasures}
                  setDisabledTreasures={setA('disabledTreasures')}
                  renderManaCost={renderManaCost}
                  treasureOverrides={slotA.treasureOverrides}
                  setTreasureOverrides={setA('treasureOverrides')}
                />
              ) : null
            }
            right={
              parsedDeckB?.treasureCards?.length > 0 ? (
                <TreasuresPanel
                  parsedDeck={parsedDeckB}
                  includeTreasures={slotB.includeTreasures}
                  setIncludeTreasures={setB('includeTreasures')}
                  disabledTreasures={slotB.disabledTreasures}
                  setDisabledTreasures={setB('disabledTreasures')}
                  renderManaCost={renderManaCost}
                  treasureOverrides={slotB.treasureOverrides}
                  setTreasureOverrides={setB('treasureOverrides')}
                />
              ) : null
            }
          />
        </details>
      )}

      {/* Key Cards / Spells */}
      {(hasCastables(parsedDeckA) || hasCastables(parsedDeckB)) && (
        <details className="section-details" open>
          <summary className="section-summary">
            🎯 Key Cards
            <span className="section-summary__chevron">▾</span>
          </summary>
          <ComparisonRow
            left={
              hasCastables(parsedDeckA) ? (
                <SpellsPanel
                  parsedDeck={parsedDeckA}
                  selectedKeyCards={slotA.selectedKeyCards}
                  setSelectedKeyCards={setA('selectedKeyCards')}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
            right={
              hasCastables(parsedDeckB) ? (
                <SpellsPanel
                  parsedDeck={parsedDeckB}
                  selectedKeyCards={slotB.selectedKeyCards}
                  setSelectedKeyCards={setB('selectedKeyCards')}
                  renderManaCost={renderManaCost}
                />
              ) : null
            }
          />
        </details>
      )}
    </>
  );
};

export default ComparisonPanelGrid;
