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
 *   ritualOverrides    – { [cardNameLower]: number | { mode, value?, base?, growth? } }
 *   setRitualOverrides – setter
 *
 * Override modes (ritualOverrides values):
 *   number (legacy) / { mode: 'fixed', value }    – fixed net-gain override
 *   { mode: 'scaling', base, growth }              – net gain = base + turn * growth
 */

import React from 'react';
import CardTooltip from './CardTooltip';

const netLabel = n => (n > 0 ? `+${n} net` : n === 0 ? 'neutral' : `${n} net`);

/** Normalize any stored override value to a canonical object form. */
const normalizeOverride = raw => {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return { mode: 'fixed', value: raw };
  return raw;
};

/** Compute the effective net-gain displayed in the badge (uses base for scaling). */
const effectiveGain = (ritual, overrideRaw) => {
  const ov = normalizeOverride(overrideRaw);
  if (!ov) return ritual.netGain;
  if (ov.mode === 'scaling') return ov.base ?? 0;
  return ov.value ?? ritual.netGain;
};

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

  const setOverride = (cardName, patch) => {
    const key = cardName.toLowerCase();
    if (patch === null) {
      const next = { ...ritualOverrides };
      delete next[key];
      setRitualOverrides(next);
    } else {
      setRitualOverrides(prev => {
        const current = normalizeOverride(prev[key]) ?? { mode: 'fixed', value: 0 };
        return { ...prev, [key]: { ...current, ...patch } };
      });
    }
  };

  const setMode = (cardName, ritual, mode) => {
    const key = cardName.toLowerCase();
    if (mode === 'default') {
      const next = { ...ritualOverrides };
      delete next[key];
      setRitualOverrides(next);
    } else if (mode === 'fixed') {
      const current = normalizeOverride(ritualOverrides[key]);
      const value = current?.value ?? current?.base ?? ritual.netGain;
      setRitualOverrides(prev => ({ ...prev, [key]: { mode: 'fixed', value } }));
    } else if (mode === 'scaling') {
      const current = normalizeOverride(ritualOverrides[key]);
      const base = current?.value ?? current?.base ?? ritual.netGain;
      const growth = current?.growth ?? 0;
      setRitualOverrides(prev => ({ ...prev, [key]: { mode: 'scaling', base, growth } }));
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
        const overrideRaw = ritualOverrides[key];
        const override = normalizeOverride(overrideRaw);
        const mode = override?.mode ?? 'default';
        const displayGain = effectiveGain(ritual, overrideRaw);

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
                title={`Net mana gain: ${netLabel(displayGain)}${mode === 'scaling' ? ` (scaling +${override?.growth ?? 0}/turn)` : ''}`}
              >
                <span>⚡</span>
                <span>
                  {netLabel(displayGain)}
                  {mode === 'scaling' && (
                    <span className="scaling-badge"> +{override?.growth ?? 0}/turn</span>
                  )}
                </span>
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

            {/* Row 2: net gain override controls */}
            <div className="mana-override-row">
              <span className="mana-override-label">Net gain:</span>
              <select
                className="mana-override-select"
                value={mode}
                onChange={e => setMode(ritual.name, ritual, e.target.value)}
                title="Override the net mana gain used in the simulation"
              >
                <option value="default">Default ({netLabel(ritual.netGain)})</option>
                <option value="fixed">Fixed value</option>
                <option value="scaling">Scaling per turn</option>
              </select>

              {mode === 'fixed' && (
                <input
                  type="number"
                  className="mana-override-input"
                  min="-10"
                  max="20"
                  step="1"
                  value={override?.value ?? ritual.netGain}
                  onChange={e =>
                    setOverride(ritual.name, { value: parseInt(e.target.value, 10) || 0 })
                  }
                  title="Fixed net mana gain for the simulation"
                />
              )}

              {mode === 'scaling' && (
                <>
                  <input
                    type="number"
                    className="mana-override-input"
                    min="-10"
                    max="20"
                    step="1"
                    value={override?.base ?? ritual.netGain}
                    onChange={e =>
                      setOverride(ritual.name, { base: parseInt(e.target.value, 10) || 0 })
                    }
                    title="Base net gain on Turn 1"
                  />
                  <span className="mana-override-label" style={{ marginLeft: 4 }}>
                    +
                  </span>
                  <input
                    type="number"
                    className="mana-override-input"
                    min="0"
                    max="10"
                    step="1"
                    value={override?.growth ?? 0}
                    onChange={e =>
                      setOverride(ritual.name, {
                        growth: Math.max(0, parseInt(e.target.value, 10) || 0),
                      })
                    }
                    title="Additional net gain added each turn"
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

export default RitualsPanel;
