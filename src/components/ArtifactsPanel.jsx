/**
 * ArtifactsPanel.jsx
 *
 * Displays the mana-artifact cards with enable/disable toggles and
 * per-card mana-amount overrides (fixed value or scaling per turn).
 *
 * Props:
 *   parsedDeck           – parsed deck object
 *   includeArtifacts     – boolean
 *   setIncludeArtifacts  – setter
 *   disabledArtifacts    – Set<string>
 *   setDisabledArtifacts – setter
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

/** Return the display amount for a card given its override. */
const getDisplayAmount = (card, override) => {
  if (!override || override.mode === 'default') return card.manaAmount;
  if (override.mode === 'fixed') return override.fixed ?? card.manaAmount;
  // scaling: show "base+growth/T"
  return null; // rendered separately
};

const ArtifactsPanel = ({
  parsedDeck,
  includeArtifacts,
  setIncludeArtifacts,
  disabledArtifacts,
  setDisabledArtifacts,
  getManaSymbol,
  manaOverrides = {},
  setManaOverrides,
}) => {
  if (!parsedDeck || parsedDeck.artifacts.length === 0) return null;

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
      // Remove override entirely
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
      <h3>⚙️ Mana Artifacts</h3>
      <label className="enable-all-label">
        <input
          type="checkbox"
          checked={includeArtifacts}
          onChange={e => {
            setIncludeArtifacts(e.target.checked);
            if (e.target.checked) {
              setDisabledArtifacts(new Set());
            } else {
              setDisabledArtifacts(new Set(parsedDeck.artifacts.map(a => a.name)));
            }
          }}
        />
        <span className="checkbox-text">Enable All Artifacts</span>
      </label>

      {parsedDeck.artifacts.map((artifact, idx) => {
        const key = artifact.name.toLowerCase();
        const override = manaOverrides[key];
        const mode = override?.mode ?? 'default';
        const displayAmt = getDisplayAmount(artifact, override);

        return (
          <div key={idx} className="card-row card-row--with-override">
            {/* Row 1: checkbox + name + cmc + mana badge */}
            <div className="card-row-main">
              <label className="card-row-label">
                <input
                  type="checkbox"
                  checked={includeArtifacts && !disabledArtifacts.has(artifact.name)}
                  onChange={e => {
                    const newSet = new Set(disabledArtifacts);
                    if (e.target.checked) newSet.delete(artifact.name);
                    else newSet.add(artifact.name);
                    setDisabledArtifacts(newSet);
                  }}
                />
                <CardTooltip name={artifact.name}>
                  <span className="card-name">
                    {artifact.quantity}x {artifact.name}
                  </span>
                </CardTooltip>
                <span className="card-meta">CMC {artifact.cmc}</span>
              </label>
              <span className="mana-amount-badge">
                {mode === 'scaling' ? (
                  <>
                    <span title="Base mana (turn entered)">
                      +{override.base ?? artifact.manaAmount}
                    </span>
                    <span className="mana-scaling-label">+{override.growth ?? 1}/T</span>
                  </>
                ) : (
                  <span>+{displayAmt}</span>
                )}
                <ProducesSymbols produces={artifact.produces} getManaSymbol={getManaSymbol} />
              </span>
            </div>

            {/* Row 2: mana override controls */}
            <div className="mana-override-row">
              <span className="mana-override-label">Mana:</span>
              <select
                className="mana-override-select"
                value={mode}
                onChange={e => setMode(artifact.name, artifact.manaAmount, e.target.value)}
                title="Choose how mana is counted for this artifact"
              >
                <option value="default">Default ({artifact.manaAmount})</option>
                <option value="fixed">Fixed</option>
                <option value="scaling">Scaling (per turn)</option>
              </select>

              {mode === 'fixed' && (
                <input
                  type="number"
                  className="mana-override-input"
                  min="1"
                  max="20"
                  value={override?.fixed ?? artifact.manaAmount}
                  onChange={e =>
                    updateOverride(artifact.name, {
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
                    value={override?.base ?? artifact.manaAmount}
                    onChange={e =>
                      updateOverride(artifact.name, {
                        base: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    title="Base mana (turn it enters)"
                  />
                  <span className="mana-override-sep">+</span>
                  <input
                    type="number"
                    className="mana-override-input mana-override-input--small"
                    min="0"
                    max="20"
                    value={override?.growth ?? 1}
                    onChange={e =>
                      updateOverride(artifact.name, {
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

export default ArtifactsPanel;
