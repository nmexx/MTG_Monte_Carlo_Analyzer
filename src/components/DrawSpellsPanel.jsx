/**
 * DrawSpellsPanel.jsx
 *
 * Displays draw-spell cards with enable/disable toggles and per-card draw
 * amount overrides.
 *
 * Cards are classified as:
 *   · One-time draw — instants/sorceries (or ETB effects) that draw cards
 *     immediately when cast and then go to the graveyard.
 *   · Per-turn draw — permanents (enchantments, artifacts, creatures) that
 *     stay on the battlefield and draw cards each upkeep.
 *
 * Override modes (drawOverrides):
 *   'default'          – use the value from CARD_DRAW_DATA
 *   'onetime'          – override as a one-time draw with a fixed card count
 *   'perturn'          – override as a per-turn draw with a fixed cards-per-turn value
 *   'scaling-onetime'  – one-time draw that grows: cards = base + turn * growth
 *   'scaling-perturn'  – per-turn draw that grows: cards/turn = base + turn * growth
 *
 * Props:
 *   parsedDeck           – parsed deck object
 *   includeDrawSpells    – boolean
 *   setIncludeDrawSpells – setter
 *   disabledDrawSpells   – Set<string>
 *   setDisabledDrawSpells– setter
 *   renderManaCost       – (manaCostString) => ReactNode
 *   drawOverrides        – { [cardNameLower]: { mode, amount } }
 *   setDrawOverrides     – setter for drawOverrides
 */

import React from 'react';
import CardTooltip from './CardTooltip';

/** Human-readable trigger-type label. */
const TRIGGER_LABELS = {
  cast: 'On cast',
  etb: 'ETB',
  upkeep: 'Each upkeep',
  opponent_cast: 'Opponent casts',
  on_draw: 'On draw',
  activated: 'Activated',
  combat: 'Combat',
  dies: 'On death',
  enchantment_cast: 'Enchantment cast',
  creature_etb: 'Creature ETB',
  land_etb: 'Land ETB',
  historic_cast: 'Historic cast',
  instant_sorcery: 'Instant/Sorcery',
  lifegain: 'On lifegain',
  counter: 'On counter',
};

/** Pick the default amount and label for a card (no override). */
const getDefaultDisplay = card => {
  if (card.isOneTimeDraw) {
    const n = card.netCardsDrawn ?? 1;
    return { label: `+${n} card${n !== 1 ? 's' : ''}`, badge: `+${n}` };
  }
  const n = card.avgCardsPerTurn ?? 1;
  const label = n % 1 === 0 ? `+${n}/turn` : `+${n.toFixed(1)}/turn`;
  return { label, badge: label };
};

/** Pick the display for the current override mode. */
const getOverrideDisplay = (card, override) => {
  if (!override || override.mode === 'default') return getDefaultDisplay(card);
  const n = override.amount ?? override.base ?? 1;
  const g = override.growth ?? 0;
  if (override.mode === 'onetime') return { label: `+${n} (one-time)`, badge: `+${n}` };
  if (override.mode === 'perturn') return { label: `+${n}/turn`, badge: `+${n}/turn` };
  if (override.mode === 'scaling-onetime')
    return { label: `+${n}${g > 0 ? `+${g}/turn` : ''} (scaling)`, badge: `+${n}+${g}/t ↑` };
  if (override.mode === 'scaling-perturn')
    return { label: `+${n}/t${g > 0 ? ` +${g}/turn` : ''} (scaling)`, badge: `+${n}/t+${g} ↑` };
  return getDefaultDisplay(card);
};

const DrawSpellsPanel = ({
  parsedDeck,
  includeDrawSpells,
  setIncludeDrawSpells,
  disabledDrawSpells,
  setDisabledDrawSpells,
  renderManaCost,
  drawOverrides = {},
  setDrawOverrides,
}) => {
  if (!parsedDeck || !parsedDeck.drawSpells || parsedDeck.drawSpells.length === 0) return null;

  const updateOverride = (cardName, patch) => {
    const key = cardName.toLowerCase();
    setDrawOverrides(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { mode: 'default', amount: 1 }), ...patch },
    }));
  };

  const setMode = (cardName, card, mode) => {
    const key = cardName.toLowerCase();
    if (mode === 'default') {
      const next = { ...drawOverrides };
      delete next[key];
      setDrawOverrides(next);
    } else if (mode === 'onetime') {
      const amount =
        drawOverrides[key]?.amount ?? drawOverrides[key]?.base ?? card.netCardsDrawn ?? 1;
      setDrawOverrides(prev => ({ ...prev, [key]: { mode: 'onetime', amount } }));
    } else if (mode === 'perturn') {
      const amount =
        drawOverrides[key]?.amount ?? drawOverrides[key]?.base ?? card.avgCardsPerTurn ?? 1;
      setDrawOverrides(prev => ({ ...prev, [key]: { mode: 'perturn', amount } }));
    } else if (mode === 'scaling-onetime') {
      const base =
        drawOverrides[key]?.base ?? drawOverrides[key]?.amount ?? card.netCardsDrawn ?? 1;
      const growth = drawOverrides[key]?.growth ?? 0;
      setDrawOverrides(prev => ({ ...prev, [key]: { mode: 'scaling-onetime', base, growth } }));
    } else if (mode === 'scaling-perturn') {
      const base =
        drawOverrides[key]?.base ?? drawOverrides[key]?.amount ?? card.avgCardsPerTurn ?? 1;
      const growth = drawOverrides[key]?.growth ?? 0;
      setDrawOverrides(prev => ({ ...prev, [key]: { mode: 'scaling-perturn', base, growth } }));
    }
  };

  return (
    <div className="panel">
      <h3>📖 Draw Spells</h3>
      <label className="enable-all-label">
        <input
          type="checkbox"
          checked={includeDrawSpells}
          onChange={e => {
            setIncludeDrawSpells(e.target.checked);
            if (e.target.checked) {
              setDisabledDrawSpells(new Set());
            } else {
              setDisabledDrawSpells(new Set(parsedDeck.drawSpells.map(c => c.name)));
            }
          }}
        />
        <span className="checkbox-text">Enable All Draw Spells</span>
      </label>

      {parsedDeck.drawSpells.map((card, idx) => {
        const key = card.name.toLowerCase();
        const override = drawOverrides[key];
        const mode = override?.mode ?? 'default';
        const { label: displayLabel, badge } = getOverrideDisplay(card, override);
        const defaultLabel = getDefaultDisplay(card).label;
        const triggerLabel = TRIGGER_LABELS[card.triggerType] ?? card.triggerType ?? '—';
        const typeIcon = card.staysOnBattlefield ? '🔮' : '⚡';

        return (
          <div key={idx} className="card-row card-row--with-override">
            {/* Row 1: checkbox + name + meta + draw badge */}
            <div className="card-row-main">
              <label className="card-row-label">
                <input
                  type="checkbox"
                  checked={includeDrawSpells && !disabledDrawSpells.has(card.name)}
                  onChange={e => {
                    const newSet = new Set(disabledDrawSpells);
                    if (e.target.checked) newSet.delete(card.name);
                    else newSet.add(card.name);
                    setDisabledDrawSpells(newSet);
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

            {/* Row 1b: trigger type + mana cost */}
            <div className="draw-spell-meta">
              <span className="draw-trigger-label" title={`Trigger: ${triggerLabel}`}>
                {triggerLabel}
              </span>
              {renderManaCost && card.manaCost ? (
                <span className="card-mana-cost">{renderManaCost(card.manaCost)}</span>
              ) : null}
            </div>

            {/* Row 2: draw amount override controls */}
            <div className="mana-override-row">
              <span className="mana-override-label">Draw:</span>
              <select
                className="mana-override-select"
                value={mode}
                onChange={e => setMode(card.name, card, e.target.value)}
                title="How draw is counted for this card"
              >
                <option value="default">Default ({defaultLabel})</option>
                <option value="onetime">One-time draw</option>
                <option value="perturn">Per-turn draw</option>
                <option value="scaling-onetime">Scaling one-time</option>
                <option value="scaling-perturn">Scaling per-turn</option>
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
                      ? 'Cards drawn immediately on cast'
                      : 'Cards drawn per upkeep'
                  }
                />
              )}

              {(mode === 'scaling-onetime' || mode === 'scaling-perturn') && (
                <>
                  <input
                    type="number"
                    className="mana-override-input"
                    min="0"
                    max="20"
                    step="0.5"
                    value={override?.base ?? 1}
                    onChange={e =>
                      updateOverride(card.name, {
                        base: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    title="Base cards on Turn 1"
                  />
                  <span className="mana-override-label" style={{ marginLeft: 4 }}>
                    +
                  </span>
                  <input
                    type="number"
                    className="mana-override-input"
                    min="0"
                    max="10"
                    step="0.5"
                    value={override?.growth ?? 0}
                    onChange={e =>
                      updateOverride(card.name, {
                        growth: Math.max(0, parseFloat(e.target.value) || 0),
                      })
                    }
                    title="Additional cards added each subsequent turn"
                  />
                  <span className="mana-override-label" style={{ marginLeft: 2 }}>
                    /turn
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DrawSpellsPanel;
