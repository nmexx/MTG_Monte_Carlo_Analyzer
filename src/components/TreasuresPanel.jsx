/**
 * TreasuresPanel.jsx
 *
 * Displays treasure-generating cards with enable/disable toggles and per-card
 * Treasure amount overrides.
 *
 * Cards are classified as:
 *   · One-time generators — instants/sorceries (or ETB effects) that create
 *     Treasures immediately when cast and then go to the graveyard.
 *   · Per-turn generators — permanents (enchantments, artifacts, creatures)
 *     that stay on the battlefield and create Treasures each upkeep.
 *
 * Override modes (treasureOverrides):
 *   'default'  – use the value from Treasures.js
 *   'onetime'  – override as a one-time generator with a fixed treasure count
 *   'perturn'  – override as a per-turn generator with a fixed treasures/turn
 *
 * Props:
 *   parsedDeck              – parsed deck object
 *   includeTreasures        – boolean
 *   setIncludeTreasures     – setter
 *   disabledTreasures       – Set<string>
 *   setDisabledTreasures    – setter
 *   renderManaCost          – (manaCostString) => ReactNode
 *   treasureOverrides       – { [cardNameLower]: { mode, amount } }
 *   setTreasureOverrides    – setter for treasureOverrides
 */

import React from 'react';
import CardTooltip from './CardTooltip';

/** Pick the default amount and label for a card (no override). */
const getDefaultDisplay = card => {
  if (card.isOneTreasure) {
    const n = card.treasuresProduced ?? 1;
    return { label: `+${n} treasure${n !== 1 ? 's' : ''}`, badge: `+${n}` };
  }
  const n = card.avgTreasuresPerTurn ?? 1;
  const label = n % 1 === 0 ? `+${n}/turn` : `+${n.toFixed(1)}/turn`;
  return { label, badge: label };
};

/** Pick the display for the current override mode. */
const getOverrideDisplay = (card, override) => {
  if (!override || override.mode === 'default') return getDefaultDisplay(card);
  const n = override.amount ?? 1;
  if (override.mode === 'onetime') return { label: `+${n} (one-time)`, badge: `+${n}` };
  return { label: `+${n}/turn`, badge: `+${n}/turn` };
};

const TreasuresPanel = ({
  parsedDeck,
  includeTreasures,
  setIncludeTreasures,
  disabledTreasures,
  setDisabledTreasures,
  renderManaCost,
  treasureOverrides = {},
  setTreasureOverrides,
}) => {
  if (!parsedDeck || !parsedDeck.treasureCards || parsedDeck.treasureCards.length === 0)
    return null;

  const updateOverride = (cardName, patch) => {
    const key = cardName.toLowerCase();
    setTreasureOverrides(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { mode: 'default', amount: 1 }), ...patch },
    }));
  };

  const setMode = (cardName, card, mode) => {
    const key = cardName.toLowerCase();
    if (mode === 'default') {
      const next = { ...treasureOverrides };
      delete next[key];
      setTreasureOverrides(next);
    } else if (mode === 'onetime') {
      const amount = treasureOverrides[key]?.amount ?? card.treasuresProduced ?? 1;
      setTreasureOverrides(prev => ({ ...prev, [key]: { mode: 'onetime', amount } }));
    } else if (mode === 'perturn') {
      const amount = treasureOverrides[key]?.amount ?? card.avgTreasuresPerTurn ?? 1;
      setTreasureOverrides(prev => ({ ...prev, [key]: { mode: 'perturn', amount } }));
    }
  };

  return (
    <div className="panel">
      <h3>💎 Treasure Generators</h3>
      <label className="enable-all-label">
        <input
          type="checkbox"
          checked={includeTreasures}
          onChange={e => {
            setIncludeTreasures(e.target.checked);
            if (e.target.checked) {
              setDisabledTreasures(new Set());
            } else {
              setDisabledTreasures(new Set(parsedDeck.treasureCards.map(c => c.name)));
            }
          }}
        />
        <span className="checkbox-text">Enable All Treasure Generators</span>
      </label>

      {parsedDeck.treasureCards.map((card, idx) => {
        const key = card.name.toLowerCase();
        const override = treasureOverrides[key];
        const mode = override?.mode ?? 'default';
        const { label: displayLabel, badge } = getOverrideDisplay(card, override);
        const defaultLabel = getDefaultDisplay(card).label;
        // 💎 = permanent per-turn generator, ⚡ = one-shot instant/sorcery
        const typeIcon = card.staysOnBattlefield ? '💎' : '⚡';

        return (
          <div key={idx} className="card-row card-row--with-override">
            {/* Row 1: checkbox + name + meta + treasure badge */}
            <div className="card-row-main">
              <label className="card-row-label">
                <input
                  type="checkbox"
                  checked={includeTreasures && !disabledTreasures.has(card.name)}
                  onChange={e => {
                    const newSet = new Set(disabledTreasures);
                    if (e.target.checked) newSet.delete(card.name);
                    else newSet.add(card.name);
                    setDisabledTreasures(newSet);
                  }}
                />
                <CardTooltip name={card.name}>
                  <span className="card-name">
                    {card.quantity}x {card.name}
                  </span>
                </CardTooltip>
                <span className="card-meta">CMC {card.cmc}</span>
              </label>
              <span className="mana-amount-badge" title={displayLabel}>
                <span>{typeIcon}</span>
                <span>{badge}</span>
              </span>
            </div>

            {/* Row 1b: type label + mana cost */}
            <div className="draw-spell-meta">
              <span className="draw-trigger-label">
                {card.staysOnBattlefield ? 'Permanent' : 'Instant / Sorcery'}
              </span>
              {renderManaCost && card.manaCost ? (
                <span className="card-mana-cost">{renderManaCost(card.manaCost)}</span>
              ) : null}
            </div>

            {/* Row 2: treasure amount override controls */}
            <div className="mana-override-row">
              <span className="mana-override-label">Treasures:</span>
              <select
                className="mana-override-select"
                value={mode}
                onChange={e => setMode(card.name, card, e.target.value)}
                title="How treasure generation is counted for this card"
              >
                <option value="default">Default ({defaultLabel})</option>
                <option value="onetime">One-time creation</option>
                <option value="perturn">Per-turn creation</option>
              </select>

              {(mode === 'onetime' || mode === 'perturn') && (
                <input
                  type="number"
                  className="mana-override-input"
                  min="0"
                  max="20"
                  step="0.5"
                  value={override?.amount ?? 1}
                  onChange={e =>
                    updateOverride(card.name, {
                      amount: Math.max(0, parseFloat(e.target.value) || 0),
                    })
                  }
                  title={
                    mode === 'onetime'
                      ? 'Treasures created immediately on cast'
                      : 'Treasures created per upkeep'
                  }
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TreasuresPanel;
