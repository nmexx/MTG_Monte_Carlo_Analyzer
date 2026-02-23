/**
 * ComparisonResultsPanel.jsx
 *
 * Renders side-by-side overlay charts for two simulated decklists (A/B mode).
 * Each chart plots both decks on the same axes so differences are immediately
 * visible.  Solid lines = Deck A, dashed lines = Deck B.
 *
 * Props:
 *   chartDataA           – object returned by prepareChartData() for Deck A
 *   chartDataB           – object returned by prepareChartData() for Deck B
 *   simulationResultsA   – raw monteCarlo() result for Deck A
 *   simulationResultsB   – raw monteCarlo() result for Deck B
 *   iterations           – number (shared)
 *   enableMulligans      – boolean (shared)
 *   selectedKeyCardsA    – Set<string>
 *   selectedKeyCardsB    – Set<string>
 *   commanderNameA       – string (auto-tracked commander for Deck A)
 *   commanderNameB       – string (auto-tracked commander for Deck B)
 *   labelA               – string (default "Deck A")
 *   labelB               – string (default "Deck B")
 *   exportResultsAsPNG   – () => void
 *   exportResultsAsCSV   – () => void
 */

import React, { useState } from 'react';
import {
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ── Colour palette ─────────────────────────────────────────────────────────────
// Deck A: cool blues/greens   Deck B: warm amber/reds
const DECK_A = {
  primary: '#667eea',
  secondary: '#22c55e',
};
const DECK_B = {
  primary: '#f59e0b',
  secondary: '#f87171',
};

const KEY_PALETTE_A = ['#667eea', '#22c55e', '#60a5fa', '#4ade80', '#a78bfa'];
const KEY_PALETTE_B = ['#f59e0b', '#f87171', '#fb923c', '#fbbf24', '#e879f9'];

// ── Tooltip helper ─────────────────────────────────────────────────────────────
const SimpleTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'rgba(30,30,40,0.92)',
        border: '1px solid #555',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 13,
        color: '#e5e7eb',
      }}
    >
      <p style={{ margin: '0 0 6px', fontWeight: 600, color: '#cbd5e1' }}>Turn {label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ margin: '2px 0', color: p.color || '#e5e7eb' }}>
          <span style={{ fontWeight: 500 }}>{p.name}:</span>{' '}
          {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  );
};

// ── Delta helpers (module-level) ─────────────────────────────────────────────
const delta = (a, b, higherIsBetter = true) => {
  const diff = b - a;
  if (Math.abs(diff) < 0.01) return null;
  const better = higherIsBetter ? diff > 0 : diff < 0;
  return { diff: diff.toFixed(2), better };
};

const DeltaBadge = ({ a, b, higherIsBetter = true, labelB }) => {
  const d = delta(a, b, higherIsBetter);
  if (!d) return <span className="delta-neutral">≈ equal</span>;
  const label = `${d.diff > 0 ? '+' : ''}${d.diff}`;
  return (
    <span className={d.better ? 'delta-better' : 'delta-worse'}>
      {labelB} {d.better ? '▲' : '▼'} {label}
    </span>
  );
};

// ── Collapsible panel header ─────────────────────────────────────────────────
const ColHdr = ({ id, collapsed, toggle, children }) => (
  <button className="panel-collapse-btn" onClick={() => toggle(id)} aria-expanded={!collapsed[id]}>
    <span className="panel-collapse-icon">{collapsed[id] ? '▶' : '▼'}</span>
    {children}
  </button>
);

// ── Component ──────────────────────────────────────────────────────────────────
const ComparisonResultsPanel = ({
  chartDataA,
  chartDataB,
  simulationResultsA,
  simulationResultsB,
  iterations,
  enableMulligans,
  selectedKeyCardsA,
  selectedKeyCardsB,
  commanderNameA = '',
  commanderNameB = '',
  labelA = 'Deck A',
  labelB = 'Deck B',
  exportResultsAsPNG,
  exportResultsAsCSV,
}) => {
  // Collapsed state for each panel section (hooks must come before any early return)
  const [collapsed, setCollapsed] = useState({});
  const toggle = id => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  if (!chartDataA || !chartDataB) return null;

  const numTurns = Math.min(chartDataA.landsData.length, chartDataB.landsData.length);

  // ── Merge per-turn data for each chart ───────────────────────────────────────
  const landsCompare = Array.from({ length: numTurns }, (_, i) => ({
    turn: chartDataA.landsData[i].turn,
    [`${labelA}: Total Lands`]: chartDataA.landsData[i]['Total Lands'],
    [`${labelB}: Total Lands`]: chartDataB.landsData[i]['Total Lands'],
    [`${labelA}: Untapped Lands`]: chartDataA.landsData[i]['Untapped Lands'],
    [`${labelB}: Untapped Lands`]: chartDataB.landsData[i]['Untapped Lands'],
    [`${labelA}: Total Lands Lo`]: chartDataA.landsData[i]['Total Lands Lo'],
    [`${labelA}: Total Lands Hi`]: chartDataA.landsData[i]['Total Lands Hi'],
    [`${labelB}: Total Lands Lo`]: chartDataB.landsData[i]['Total Lands Lo'],
    [`${labelB}: Total Lands Hi`]: chartDataB.landsData[i]['Total Lands Hi'],
    [`${labelA}: Untapped Lands Lo`]: chartDataA.landsData[i]['Untapped Lands Lo'],
    [`${labelA}: Untapped Lands Hi`]: chartDataA.landsData[i]['Untapped Lands Hi'],
    [`${labelB}: Untapped Lands Lo`]: chartDataB.landsData[i]['Untapped Lands Lo'],
    [`${labelB}: Untapped Lands Hi`]: chartDataB.landsData[i]['Untapped Lands Hi'],
  }));

  const manaCompare = Array.from({ length: numTurns }, (_, i) => ({
    turn: chartDataA.manaByColorData[i].turn,
    [`${labelA}: Total Mana`]: chartDataA.manaByColorData[i]['Total Mana'],
    [`${labelB}: Total Mana`]: chartDataB.manaByColorData[i]['Total Mana'],
    [`${labelA}: Total Mana Lo`]: chartDataA.manaByColorData[i]['Total Mana Lo'],
    [`${labelA}: Total Mana Hi`]: chartDataA.manaByColorData[i]['Total Mana Hi'],
    [`${labelB}: Total Mana Lo`]: chartDataB.manaByColorData[i]['Total Mana Lo'],
    [`${labelB}: Total Mana Hi`]: chartDataB.manaByColorData[i]['Total Mana Hi'],
  }));

  const lifeCompare = Array.from({ length: numTurns }, (_, i) => ({
    turn: chartDataA.lifeLossData[i].turn,
    [`${labelA}: Life Loss`]: chartDataA.lifeLossData[i]['Life Loss'],
    [`${labelB}: Life Loss`]: chartDataB.lifeLossData[i]['Life Loss'],
    [`${labelA}: Life Loss Lo`]: chartDataA.lifeLossData[i]['Life Loss Lo'],
    [`${labelA}: Life Loss Hi`]: chartDataA.lifeLossData[i]['Life Loss Hi'],
    [`${labelB}: Life Loss Lo`]: chartDataB.lifeLossData[i]['Life Loss Lo'],
    [`${labelB}: Life Loss Hi`]: chartDataB.lifeLossData[i]['Life Loss Hi'],
  }));

  const drawnCompare = Array.from({ length: numTurns }, (_, i) => ({
    turn: chartDataA.cardsDrawnData[i].turn,
    [`${labelA}: Cards Drawn`]: chartDataA.cardsDrawnData[i]['Cards Drawn'],
    [`${labelB}: Cards Drawn`]: chartDataB.cardsDrawnData[i]['Cards Drawn'],
    [`${labelA}: Cards Drawn Lo`]: chartDataA.cardsDrawnData[i]['Cards Drawn Lo'],
    [`${labelA}: Cards Drawn Hi`]: chartDataA.cardsDrawnData[i]['Cards Drawn Hi'],
    [`${labelB}: Cards Drawn Lo`]: chartDataB.cardsDrawnData[i]['Cards Drawn Lo'],
    [`${labelB}: Cards Drawn Hi`]: chartDataB.cardsDrawnData[i]['Cards Drawn Hi'],
  }));

  const treasureCompare = Array.from({ length: numTurns }, (_, i) => ({
    turn: chartDataA.treasureData[i]?.turn ?? i + 1,
    [`${labelA}: Treasure Pool`]: chartDataA.treasureData[i]?.['Treasure Pool'] ?? 0,
    [`${labelB}: Treasure Pool`]: chartDataB.treasureData[i]?.['Treasure Pool'] ?? 0,
    [`${labelA}: Treasure Pool Lo`]: chartDataA.treasureData[i]?.['Treasure Pool Lo'] ?? 0,
    [`${labelA}: Treasure Pool Hi`]: chartDataA.treasureData[i]?.['Treasure Pool Hi'] ?? 0,
    [`${labelB}: Treasure Pool Lo`]: chartDataB.treasureData[i]?.['Treasure Pool Lo'] ?? 0,
    [`${labelB}: Treasure Pool Hi`]: chartDataB.treasureData[i]?.['Treasure Pool Hi'] ?? 0,
  }));

  // ── Key card playability — union of both sets + both commanders ─────────────
  const cmdA = commanderNameA?.trim();
  const cmdB = commanderNameB?.trim();
  const effectiveA =
    cmdA && !selectedKeyCardsA.has(cmdA)
      ? new Set([...selectedKeyCardsA, cmdA])
      : selectedKeyCardsA;
  const effectiveB =
    cmdB && !selectedKeyCardsB.has(cmdB)
      ? new Set([...selectedKeyCardsB, cmdB])
      : selectedKeyCardsB;
  const allKeyCards = new Set([...effectiveA, ...effectiveB]);
  const keyCompare = Array.from({ length: numTurns }, (_, i) => {
    const row = { turn: chartDataA.keyCardsData[i]?.turn ?? i + 1 };
    for (const card of allKeyCards) {
      if (effectiveA.has(card) && chartDataA.keyCardsData[i]?.[card] !== undefined)
        row[`${labelA}: ${card}`] = chartDataA.keyCardsData[i][card];
      if (effectiveB.has(card) && chartDataB.keyCardsData[i]?.[card] !== undefined)
        row[`${labelB}: ${card}`] = chartDataB.keyCardsData[i][card];
    }
    return row;
  });

  // ── Delta helpers for summary ────────────────────────────────────────────────
  const finalLandA = chartDataA.landsData.at(-1)?.['Total Lands'] ?? 0;
  const finalLandB = chartDataB.landsData.at(-1)?.['Total Lands'] ?? 0;
  const finalManaA = chartDataA.manaByColorData.at(-1)?.['Total Mana'] ?? 0;
  const finalManaB = chartDataB.manaByColorData.at(-1)?.['Total Mana'] ?? 0;
  const finalLifeA = chartDataA.lifeLossData.at(-1)?.['Life Loss'] ?? 0;
  const finalLifeB = chartDataB.lifeLossData.at(-1)?.['Life Loss'] ?? 0;
  const finalTreasureA = chartDataA.treasureData.at(-1)?.['Treasure Pool'] ?? 0;
  const finalTreasureB = chartDataB.treasureData.at(-1)?.['Treasure Pool'] ?? 0;
  const hasTreasures = finalTreasureA > 0 || finalTreasureB > 0;

  return (
    <div id="results-section">
      {/* ── Summary ─────────────────────────────────────────────────────────── */}
      <div className="panel">
        <ColHdr id="summary" collapsed={collapsed} toggle={toggle}>
          📊 Comparison Results
        </ColHdr>
        {!collapsed.summary && (
          <>
            <div className="comparison-summary-grid">
              {[
                {
                  label: labelA,
                  res: simulationResultsA,
                  finalLand: finalLandA,
                  finalMana: finalManaA,
                  finalLife: finalLifeA,
                },
                {
                  label: labelB,
                  res: simulationResultsB,
                  finalLand: finalLandB,
                  finalMana: finalManaB,
                  finalLife: finalLifeB,
                },
              ].map(({ label, res, finalLand, finalMana, finalLife }) => (
                <div key={label} className="comparison-summary-col">
                  <h4 className={label === labelA ? 'deck-label-a' : 'deck-label-b'}>{label}</h4>
                  <p>
                    Hands kept: <strong>{res.handsKept.toLocaleString()}</strong>
                  </p>
                  {enableMulligans && (
                    <p>
                      Mulligan rate:{' '}
                      <strong>{((res.mulligans / iterations) * 100).toFixed(1)}%</strong>
                    </p>
                  )}
                  <p>
                    Lands by final turn: <strong>{finalLand.toFixed(2)}</strong>
                  </p>
                  <p>
                    Mana by final turn: <strong>{finalMana.toFixed(2)}</strong>
                  </p>
                  <p>
                    Life loss by final turn: <strong>{finalLife.toFixed(2)}</strong>
                  </p>
                  {hasTreasures && (
                    <p>
                      Treasures by final turn:{' '}
                      <strong>
                        {(label === labelA ? finalTreasureA : finalTreasureB).toFixed(2)}
                      </strong>
                    </p>
                  )}
                </div>
              ))}
              <div className="comparison-summary-col comparison-summary-col--delta">
                <h4>Δ Difference (B vs A)</h4>
                <p>
                  Lands:{' '}
                  <DeltaBadge a={finalLandA} b={finalLandB} higherIsBetter={true} labelB={labelB} />
                </p>
                <p>
                  Mana:{' '}
                  <DeltaBadge a={finalManaA} b={finalManaB} higherIsBetter={true} labelB={labelB} />
                </p>
                <p>
                  Life loss:{' '}
                  <DeltaBadge
                    a={finalLifeA}
                    b={finalLifeB}
                    higherIsBetter={false}
                    labelB={labelB}
                  />
                </p>
                {hasTreasures && (
                  <p>
                    Treasures:{' '}
                    <DeltaBadge
                      a={finalTreasureA}
                      b={finalTreasureB}
                      higherIsBetter={true}
                      labelB={labelB}
                    />
                  </p>
                )}
              </div>
            </div>
            <div className="export-buttons" style={{ marginTop: '1rem' }}>
              <button onClick={exportResultsAsPNG} className="btn-success">
                📸 Export Results as PNG
              </button>
              <button onClick={exportResultsAsCSV} className="btn-success">
                📄 Export Results as CSV
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Lands per Turn ───────────────────────────────────────────────────────── */}
      <div className="panel">
        <ColHdr id="lands" collapsed={collapsed} toggle={toggle}>
          Lands per Turn
        </ColHdr>
        {!collapsed.lands && (
          <>
            <p className="card-meta">
              Solid = Total Lands · Dashed = Untapped Lands · Blue = {labelA} · Amber = {labelB}.
              Shaded bands = ±1σ.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={landsCompare}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="turn"
                  label={{ value: 'Turn', position: 'insideBottom', offset: -5 }}
                />
                <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={SimpleTooltip} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey={d => [d[`${labelA}: Total Lands Lo`], d[`${labelA}: Total Lands Hi`]]}
                  fill="rgba(102,126,234,0.18)"
                  stroke="none"
                  name={`_${labelA}_lands_band`}
                  legendType="none"
                  activeDot={false}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey={d => [d[`${labelB}: Total Lands Lo`], d[`${labelB}: Total Lands Hi`]]}
                  fill="rgba(245,158,11,0.18)"
                  stroke="none"
                  name={`_${labelB}_lands_band`}
                  legendType="none"
                  activeDot={false}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey={d => [
                    d[`${labelA}: Untapped Lands Lo`],
                    d[`${labelA}: Untapped Lands Hi`],
                  ]}
                  fill="rgba(34,197,94,0.15)"
                  stroke="none"
                  name={`_${labelA}_untapped_band`}
                  legendType="none"
                  activeDot={false}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey={d => [
                    d[`${labelB}: Untapped Lands Lo`],
                    d[`${labelB}: Untapped Lands Hi`],
                  ]}
                  fill="rgba(248,113,113,0.15)"
                  stroke="none"
                  name={`_${labelB}_untapped_band`}
                  legendType="none"
                  activeDot={false}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={`${labelA}: Total Lands`}
                  stroke={DECK_A.primary}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={`${labelB}: Total Lands`}
                  stroke={DECK_B.primary}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={`${labelA}: Untapped Lands`}
                  stroke={DECK_A.secondary}
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="6 3"
                />
                <Line
                  type="monotone"
                  dataKey={`${labelB}: Untapped Lands`}
                  stroke={DECK_B.secondary}
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="6 3"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* ── Total Mana per Turn ───────────────────────────────────────────────────── */}
      <div className="panel">
        <ColHdr id="mana" collapsed={collapsed} toggle={toggle}>
          Available Mana per Turn
        </ColHdr>
        {!collapsed.mana && (
          <>
            <p className="card-meta">
              Blue = {labelA} · Amber = {labelB}. Shaded bands = ±1σ.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={manaCompare}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="turn"
                  label={{ value: 'Turn', position: 'insideBottom', offset: -5 }}
                />
                <YAxis label={{ value: 'Mana', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={SimpleTooltip} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey={d => [d[`${labelA}: Total Mana Lo`], d[`${labelA}: Total Mana Hi`]]}
                  fill="rgba(102,126,234,0.18)"
                  stroke="none"
                  name={`_${labelA}_mana_band`}
                  legendType="none"
                  activeDot={false}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey={d => [d[`${labelB}: Total Mana Lo`], d[`${labelB}: Total Mana Hi`]]}
                  fill="rgba(245,158,11,0.18)"
                  stroke="none"
                  name={`_${labelB}_mana_band`}
                  legendType="none"
                  activeDot={false}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={`${labelA}: Total Mana`}
                  stroke={DECK_A.primary}
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={`${labelB}: Total Mana`}
                  stroke={DECK_B.primary}
                  strokeWidth={3}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* ── Cumulative Life Loss ───────────────────────────────────────────────────── */}
      <div className="panel">
        <ColHdr id="life" collapsed={collapsed} toggle={toggle}>
          Cumulative Life Loss
        </ColHdr>
        {!collapsed.life && (
          <>
            <p className="card-meta">
              Blue = {labelA} · Amber = {labelB}. Shaded bands = ±1σ.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={lifeCompare}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="turn"
                  label={{ value: 'Turn', position: 'insideBottom', offset: -5 }}
                />
                <YAxis label={{ value: 'Life Loss', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={SimpleTooltip} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey={d => [d[`${labelA}: Life Loss Lo`], d[`${labelA}: Life Loss Hi`]]}
                  fill="rgba(102,126,234,0.18)"
                  stroke="none"
                  name={`_${labelA}_life_band`}
                  legendType="none"
                  activeDot={false}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey={d => [d[`${labelB}: Life Loss Lo`], d[`${labelB}: Life Loss Hi`]]}
                  fill="rgba(245,158,11,0.18)"
                  stroke="none"
                  name={`_${labelB}_life_band`}
                  legendType="none"
                  activeDot={false}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={`${labelA}: Life Loss`}
                  stroke={DECK_A.primary}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={`${labelB}: Life Loss`}
                  stroke={DECK_B.primary}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* ── Cards Drawn per Turn ───────────────────────────────────────────────────── */}
      <div className="panel">
        <ColHdr id="draw" collapsed={collapsed} toggle={toggle}>
          Cards Drawn per Turn
        </ColHdr>
        {!collapsed.draw && (
          <>
            <p className="card-meta">
              Blue = {labelA} · Amber = {labelB}. Shaded bands = ±1σ.
            </p>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={drawnCompare}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="turn"
                  label={{ value: 'Turn', position: 'insideBottom', offset: -5 }}
                />
                <YAxis label={{ value: 'Cards', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={SimpleTooltip} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey={d => [d[`${labelA}: Cards Drawn Lo`], d[`${labelA}: Cards Drawn Hi`]]}
                  fill="rgba(102,126,234,0.18)"
                  stroke="none"
                  name={`_${labelA}_drawn_band`}
                  legendType="none"
                  activeDot={false}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey={d => [d[`${labelB}: Cards Drawn Lo`], d[`${labelB}: Cards Drawn Hi`]]}
                  fill="rgba(245,158,11,0.18)"
                  stroke="none"
                  name={`_${labelB}_drawn_band`}
                  legendType="none"
                  activeDot={false}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={`${labelA}: Cards Drawn`}
                  stroke={DECK_A.primary}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={`${labelB}: Cards Drawn`}
                  stroke={DECK_B.primary}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* ── Treasure Pool per Turn ───────────────────────────────────────────── */}
      {hasTreasures && (
        <div className="panel">
          <ColHdr id="treasure" collapsed={collapsed} toggle={toggle}>
            💎 Treasures Generated per Turn
          </ColHdr>
          {!collapsed.treasure && (
            <>
              <p className="card-meta">
                Treasure tokens created per turn. Blue = {labelA} · Amber = {labelB}. Shaded bands =
                ±1σ.
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={treasureCompare}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="turn"
                    label={{ value: 'Turn', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis label={{ value: 'Treasures', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={SimpleTooltip} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey={d => [
                      d[`${labelA}: Treasure Pool Lo`],
                      d[`${labelA}: Treasure Pool Hi`],
                    ]}
                    fill="rgba(102,126,234,0.18)"
                    stroke="none"
                    name={`_${labelA}_treasure_band`}
                    legendType="none"
                    activeDot={false}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey={d => [
                      d[`${labelB}: Treasure Pool Lo`],
                      d[`${labelB}: Treasure Pool Hi`],
                    ]}
                    fill="rgba(245,158,11,0.18)"
                    stroke="none"
                    name={`_${labelB}_treasure_band`}
                    legendType="none"
                    activeDot={false}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey={`${labelA}: Treasure Pool`}
                    stroke={DECK_A.primary}
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey={`${labelB}: Treasure Pool`}
                    stroke={DECK_B.primary}
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}

      {/* ── Key Card Playability ───────────────────────────────────────────────────── */}
      {allKeyCards.size > 0 && (
        <div className="panel">
          <ColHdr id="keycards" collapsed={collapsed} toggle={toggle}>
            Key Cards Playability (%)
          </ColHdr>
          {!collapsed.keycards && (
            <>
              <p className="card-meta">
                Solid = {labelA} key cards · Dashed = {labelB} key cards
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={keyCompare}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="turn"
                    label={{ value: 'Turn', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis label={{ value: 'Playable (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip content={SimpleTooltip} />
                  <Legend />
                  {(() => {
                    const lines = [];
                    let idxA = 0;
                    let idxB = 0;
                    for (const card of allKeyCards) {
                      if (effectiveA.has(card))
                        lines.push(
                          <Line
                            key={`A-${card}`}
                            type="monotone"
                            dataKey={`${labelA}: ${card}`}
                            stroke={KEY_PALETTE_A[idxA++ % KEY_PALETTE_A.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        );
                      if (effectiveB.has(card))
                        lines.push(
                          <Line
                            key={`B-${card}`}
                            type="monotone"
                            dataKey={`${labelB}: ${card}`}
                            stroke={KEY_PALETTE_B[idxB++ % KEY_PALETTE_B.length]}
                            strokeWidth={2}
                            dot={false}
                            strokeDasharray="6 3"
                          />
                        );
                    }
                    return lines;
                  })()}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ComparisonResultsPanel;
