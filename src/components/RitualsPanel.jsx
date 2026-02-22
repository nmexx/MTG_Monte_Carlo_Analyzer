/**
 * RitualsPanel.jsx
 *
 * Displays ritual / burst-mana spells with toggles and per-card net-gain overrides.
 *
 * Props:
 *   parsedDeck         – parsed deck object
 *   includeRituals     – boolean
 *   setIncludeRituals  – setter
 *   disabledRituals    – Set<string>
 *   setDisabledRituals – setter
 *   renderManaCost     – (manaCost: string) => JSX
 *   ritualOverrides    – { [cardNameLower]: number }  (net mana gain override)
 *   setRitualOverrides – setter
 */

import React from 'react';
import CardTooltip from './CardTooltip';

const netLabel = n => (n > 0 ? `+${n} net` : n === 0 ? 'neutral' : `${n} net`);

const RitualsPanel = ({
  parsedDeck,
  includeRituals,
  setIncludeRituals,
  disabledRituals,
  setDisabledRituals,
  renderManaCost,
  ritualOverrides = {},
  setRitualOverrides,
}) => {
  if (!parsedDeck?.rituals?.length) return null;

  const setOverride = (cardName, value) => {
    const key = cardName.toLowerCase();
    if (value === null) {
      const next = { ...ritualOverrides };
      delete next[key];
      setRitualOverrides(next);
    } else {
      setRitualOverrides(prev => ({ ...prev, [key]: value }));
    }
  };

  return (
    <div className="panel">
      <h3>⚡ Ritual Spells (Burst Mana)</h3>
      <p className="card-meta card-meta--spaced">
        Rituals contribute their net mana gain to the &ldquo;with burst&rdquo; key-card line.
        Override the net gain for cards with variable output (X-cost, kicker, threshold).
      </p>
      <label className="enable-all-label">
        <input
          type="checkbox"
          checked={includeRituals}
          onChange={e => {
            setIncludeRituals(e.target.checked);
            if (e.target.checked) {
              setDisabledRituals(new Set());
            } else {
              setDisabledRituals(new Set(parsedDeck.rituals.map(c => c.name)));
            }
          }}
        />
        <span className="checkbox-text">Enable All Rituals</span>
      </label>

      {parsedDeck.rituals.map((ritual, idx) => {
        const key = ritual.name.toLowerCase();
        const hasOverride = ritualOverrides[key] !== undefined;
        const effectiveNetGain = hasOverride ? ritualOverrides[key] : ritual.netGain;

        return (
          <div key={idx} className="card-row card-row--with-override">
            {/* Row 1: checkbox + name + stats */}
            <div className="card-row-main">
              <label className="card-row-label">
                <input
                  type="checkbox"
                  checked={includeRituals && !disabledRituals.has(ritual.name)}
                  onChange={e => {
                    const newSet = new Set(disabledRituals);
                    if (e.target.checked) newSet.delete(ritual.name);
                    else newSet.add(ritual.name);
                    setDisabledRituals(newSet);
                  }}
                />
                <CardTooltip name={ritual.name}>
                  <span className="card-name">
                    {ritual.quantity}x {ritual.name}
                  </span>
                </CardTooltip>
                <span className="card-meta">CMC {ritual.cmc}</span>
              </label>
              <span
                className="mana-amount-badge"
                title={`Net mana gain: ${netLabel(effectiveNetGain)}`}
              >
                <span>⚡</span>
                <span>{netLabel(effectiveNetGain)}</span>
              </span>
            </div>

            {/* Row 1b: produced / net info + mana cost */}
            <div className="draw-spell-meta">
              <span className="draw-trigger-label">
                {ritual.manaProduced} mana produced · default {netLabel(ritual.netGain)}
              </span>
              {renderManaCost && ritual.manaCost ? (
                <span className="card-mana-cost">{renderManaCost(ritual.manaCost)}</span>
              ) : null}
            </div>

            {/* Row 2: net gain override */}
            <div className="mana-override-row">
              <span className="mana-override-label">Net gain:</span>
              <select
                className="mana-override-select"
                value={hasOverride ? 'custom' : 'default'}
                onChange={e => {
                  if (e.target.value === 'default') setOverride(ritual.name, null);
                  else setOverride(ritual.name, ritual.netGain);
                }}
                title="Override the net mana gain used in the simulation"
              >
                <option value="default">Default ({netLabel(ritual.netGain)})</option>
                <option value="custom">Custom fixed value</option>
              </select>

              {hasOverride && (
                <input
                  type="number"
                  className="mana-override-input"
                  min="-10"
                  max="20"
                  step="1"
                  value={ritualOverrides[key]}
                  onChange={e => setOverride(ritual.name, parseInt(e.target.value, 10) || 0)}
                  title="Fixed net mana gain for the simulation"
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RitualsPanel;
