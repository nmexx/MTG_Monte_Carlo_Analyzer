/**
 * CreaturesPanel.jsx
 *
 * Displays mana-creature cards with enable/disable toggles and
 * per-card mana-amount overrides (fixed value or scaling per turn).
 *
 * Props:
 *   parsedDeck           – parsed deck object
 *   includeCreatures     – boolean
 *   setIncludeCreatures  – setter
 *   disabledCreatures    – Set<string>
 *   setDisabledCreatures – setter
 *   getManaSymbol        – (color) => emoji
 *   manaOverrides        – { [cardNameLower]: { mode, fixed, base, growth } }
 *   setManaOverrides     – setter for manaOverrides
 */

import React from 'react';
import CardTooltip from './CardTooltip';

/** Emoji summary for a produces array: all-5-color → ✦, single → that symbol. */
const ProducesSymbols = ({ produces, getManaSymbol }) => {
  const allColors = ['W', 'U', 'B', 'R', 'G'];
  const isAnyColor = allColors.every(c => produces.includes(c));
  if (isAnyColor)
    return (
      <span className="mana-symbol" title="Any color">
        ✦
      </span>
    );
  return produces.map(color => (
    <span key={color} className="mana-symbol">
      {getManaSymbol(color)}
    </span>
  ));
};

const getDisplayAmount = (card, override) => {
  if (!override || override.mode === 'default') return card.manaAmount;
  if (override.mode === 'fixed') return override.fixed ?? card.manaAmount;
  return null; // scaling shown separately
};

const CreaturesPanel = ({
  parsedDeck,
  includeCreatures,
  setIncludeCreatures,
  disabledCreatures,
  setDisabledCreatures,
  getManaSymbol,
  manaOverrides = {},
  setManaOverrides,
}) => {
  if (!parsedDeck || parsedDeck.creatures.length === 0) return null;

  const updateOverride = (cardName, patch) => {
    const key = cardName.toLowerCase();
    setManaOverrides(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { mode: 'default' }), ...patch },
    }));
  };

  const setMode = (cardName, defaultAmount, mode) => {
    const key = cardName.toLowerCase();
    const current = manaOverrides[key] ?? {};
    if (mode === 'default') {
      const next = { ...manaOverrides };
      delete next[key];
      setManaOverrides(next);
    } else if (mode === 'fixed') {
      setManaOverrides(prev => ({
        ...prev,
        [key]: { mode: 'fixed', fixed: current.fixed ?? defaultAmount },
      }));
    } else if (mode === 'scaling') {
      setManaOverrides(prev => ({
        ...prev,
        [key]: {
          mode: 'scaling',
          base: current.base ?? defaultAmount,
          growth: current.growth ?? 1,
        },
      }));
    }
  };

  return (
    <div className="panel">
      <h3>🌱 Mana Creatures</h3>
      <label className="enable-all-label">
        <input
          type="checkbox"
          checked={includeCreatures}
          onChange={e => {
            setIncludeCreatures(e.target.checked);
            if (e.target.checked) {
              setDisabledCreatures(new Set());
            } else {
              setDisabledCreatures(new Set(parsedDeck.creatures.map(c => c.name)));
            }
          }}
        />
        <span className="checkbox-text">Enable All Creatures</span>
      </label>

      {parsedDeck.creatures.map((creature, idx) => {
        const key = creature.name.toLowerCase();
        const override = manaOverrides[key];
        const mode = override?.mode ?? 'default';
        const displayAmt = getDisplayAmount(creature, override);

        return (
          <div key={idx} className="card-row card-row--with-override">
            {/* Row 1: checkbox + name + cmc + mana badge */}
            <div className="card-row-main">
              <label className="card-row-label">
                <input
                  type="checkbox"
                  checked={includeCreatures && !disabledCreatures.has(creature.name)}
                  onChange={e => {
                    const newSet = new Set(disabledCreatures);
                    if (e.target.checked) newSet.delete(creature.name);
                    else newSet.add(creature.name);
                    setDisabledCreatures(newSet);
                  }}
                />
                <CardTooltip name={creature.name}>
                  <span className="card-name">
                    {creature.quantity}x {creature.name}
                  </span>
                </CardTooltip>
                <span className="card-meta">CMC {creature.cmc}</span>
              </label>
              <span className="mana-amount-badge">
                {mode === 'scaling' ? (
                  <>
                    <span title="Base mana (first turn it can tap)">
                      +{override.base ?? creature.manaAmount}
                    </span>
                    <span className="mana-scaling-label">+{override.growth ?? 1}/T</span>
                  </>
                ) : (
                  <span>+{displayAmt}</span>
                )}
                <ProducesSymbols produces={creature.produces} getManaSymbol={getManaSymbol} />
              </span>
            </div>

            {/* Row 2: mana override controls */}
            <div className="mana-override-row">
              <span className="mana-override-label">Mana:</span>
              <select
                className="mana-override-select"
                value={mode}
                onChange={e => setMode(creature.name, creature.manaAmount, e.target.value)}
                title="Choose how mana is counted for this creature"
              >
                <option value="default">Default ({creature.manaAmount})</option>
                <option value="fixed">Fixed</option>
                <option value="scaling">Scaling (per turn)</option>
              </select>

              {mode === 'fixed' && (
                <input
                  type="number"
                  className="mana-override-input"
                  min="1"
                  max="20"
                  value={override?.fixed ?? creature.manaAmount}
                  onChange={e =>
                    updateOverride(creature.name, {
                      fixed: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  title="Mana produced per tap"
                />
              )}

              {mode === 'scaling' && (
                <>
                  <input
                    type="number"
                    className="mana-override-input mana-override-input--small"
                    min="1"
                    max="20"
                    value={override?.base ?? creature.manaAmount}
                    onChange={e =>
                      updateOverride(creature.name, {
                        base: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    title="Base mana on first turn able to tap (turn after entering)"
                  />
                  <span className="mana-override-sep">+</span>
                  <input
                    type="number"
                    className="mana-override-input mana-override-input--small"
                    min="0"
                    max="20"
                    value={override?.growth ?? 1}
                    onChange={e =>
                      updateOverride(creature.name, {
                        growth: Math.max(0, parseInt(e.target.value) || 0),
                      })
                    }
                    title="Extra mana per additional turn on the battlefield"
                  />
                  <span className="mana-override-unit">/turn</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CreaturesPanel;
