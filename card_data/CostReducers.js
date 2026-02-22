/**
 * CostReducers.js
 *
 * Cards that reduce the mana cost of other spells without producing mana
 * themselves (Medallion cycle, Electromancer effects, etc.).
 *
 * Fields
 * ──────
 *   reducesColor   – 'W'|'U'|'B'|'R'|'G'|null
 *                    null = applies to every spell regardless of color
 *                    'G'  = only reduces spells that contain {G} in their cost
 *
 *   reducesAmount  – integer, how many generic mana the cost is reduced by
 *
 *   reducesType    – null | 'instant_or_sorcery' | 'creature'
 *                    null = all non-land spells
 *
 *   entersTapped   – boolean (default false if omitted)
 */

export const COST_REDUCER_DATA = new Map([
  // ── Medallion cycle ──────────────────────────────────────────────────────
  ['pearl medallion', { reducesColor: 'W', reducesAmount: 1, reducesType: null }],
  ['sapphire medallion', { reducesColor: 'U', reducesAmount: 1, reducesType: null }],
  ['jet medallion', { reducesColor: 'B', reducesAmount: 1, reducesType: null }],
  ['ruby medallion', { reducesColor: 'R', reducesAmount: 1, reducesType: null }],
  ['emerald medallion', { reducesColor: 'G', reducesAmount: 1, reducesType: null }],

  // ── Crystal cycle (same effect as Medallions) ─────────────────────────────
  ['the earth crystal', { reducesColor: 'G', reducesAmount: 1, reducesType: null }],
  ['the water crystal', { reducesColor: 'U', reducesAmount: 1, reducesType: null }],
  ['the fire crystal', { reducesColor: 'R', reducesAmount: 1, reducesType: null }],
  ['the wind crystal', { reducesColor: 'W', reducesAmount: 1, reducesType: null }],
  ['the dark crystal', { reducesColor: 'B', reducesAmount: 1, reducesType: null }],

  // ── Generic (any spell) reducers ─────────────────────────────────────────
  ['helm of awakening', { reducesColor: null, reducesAmount: 1, reducesType: null }],
  ['semblance anvil', { reducesColor: null, reducesAmount: 2, reducesType: null }],

  // ── Instant / Sorcery reducers ───────────────────────────────────────────
  [
    'goblin electromancer',
    { reducesColor: null, reducesAmount: 1, reducesType: 'instant_or_sorcery' },
  ],
  [
    'baral, chief of compliance',
    { reducesColor: null, reducesAmount: 1, reducesType: 'instant_or_sorcery' },
  ],
  ["jace's sanctum", { reducesColor: null, reducesAmount: 1, reducesType: 'instant_or_sorcery' }],
  ['arcane melee', { reducesColor: null, reducesAmount: 2, reducesType: 'instant_or_sorcery' }],
  ['primal amulet', { reducesColor: null, reducesAmount: 1, reducesType: 'instant_or_sorcery' }],
  [
    'archmage emeritus',
    { reducesColor: null, reducesAmount: 1, reducesType: 'instant_or_sorcery' },
  ],
  ['river of tears', { reducesColor: null, reducesAmount: 1, reducesType: 'instant_or_sorcery' }],

  // ── Creature reducers ────────────────────────────────────────────────────
  ["urza's incubator", { reducesColor: null, reducesAmount: 2, reducesType: 'creature' }],
  ['gauntlet of power', { reducesColor: null, reducesAmount: 1, reducesType: 'creature' }],
]);
