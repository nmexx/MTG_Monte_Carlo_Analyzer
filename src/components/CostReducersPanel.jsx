/**
 * CostReducersPanel.jsx
 *
 * Displays cost-reducer cards (Medallion cycle, Goblin Electromancer, etc.)
 * with enable/disable toggles.  Cost reducers reduce the generic portion of
 * spell costs rather than producing mana themselves.
 *
 * Props:
 *   parsedDeck             – parsed deck object
 *   includeCostReducers    – boolean (master toggle)
 *   setIncludeCostReducers – setter
 *   disabledCostReducers   – Set<string>
 *   setDisabledCostReducers – setter
 *   renderManaCost         – (manaCost: string) => JSX
 */

import React from 'react';
import CardTooltip from './CardTooltip';

// Human-readable scope label for a cost-reducer card
const scopeLabel = reducer => {
  if (reducer.reducesColor) {
    const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' };
    return `${colorNames[reducer.reducesColor] ?? reducer.reducesColor} spells`;
  }
  if (reducer.reducesType === 'instant_or_sorcery') return 'instants & sorceries';
  if (reducer.reducesType === 'creature') return 'creature spells';
  return 'all spells';
};

const CostReducersPanel = ({
  parsedDeck,
  includeCostReducers,
  setIncludeCostReducers,
  disabledCostReducers,
  setDisabledCostReducers,
  renderManaCost,
}) => {
  if (!parsedDeck?.costReducers?.length) return null;

  return (
    <div className="panel">
      <h3>💎 Cost Reducers</h3>
      <p className="card-meta card-meta--spaced">
        These permanents reduce the generic mana cost of spells by the listed amount. Colored pip
        requirements are unaffected.
      </p>
      <label className="enable-all-label">
        <input
          type="checkbox"
          checked={includeCostReducers}
          onChange={e => {
            setIncludeCostReducers(e.target.checked);
            if (e.target.checked) {
              setDisabledCostReducers(new Set());
            } else {
              setDisabledCostReducers(new Set(parsedDeck.costReducers.map(c => c.name)));
            }
          }}
        />
        <span className="checkbox-text">Enable All Cost Reducers</span>
      </label>

      {parsedDeck.costReducers.map((reducer, idx) => (
        <div key={idx} className="card-row">
          <label className="card-row-label">
            <input
              type="checkbox"
              checked={includeCostReducers && !disabledCostReducers.has(reducer.name)}
              onChange={e => {
                const newSet = new Set(disabledCostReducers);
                if (e.target.checked) newSet.delete(reducer.name);
                else newSet.add(reducer.name);
                setDisabledCostReducers(newSet);
              }}
            />
            <CardTooltip name={reducer.name}>
              <span className="card-name">
                {reducer.quantity}x {reducer.name}
              </span>
            </CardTooltip>
            <span className="card-meta">
              &minus;{reducer.reducesAmount} to {scopeLabel(reducer)}&nbsp;&nbsp;{'· CMC '}
              {reducer.cmc}
            </span>
          </label>
          <div className="mana-cost-container">{renderManaCost(reducer.manaCost)}</div>
        </div>
      ))}
    </div>
  );
};

export default CostReducersPanel;
