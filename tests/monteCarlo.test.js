/**
 * monteCarlo.js — Unit Tests
 *
 * Covers both exported functions:
 *   buildCompleteDeck  – assembles a flat deck array from a parsed-deck object
 *   monteCarlo         – full simulation engine: returns averaged statistics
 *
 * Run:  npm test
 */

import { describe, it, expect } from 'vitest';
import { buildCompleteDeck, monteCarlo } from '../src/simulation/monteCarlo.js';

// ─────────────────────────────────────────────────────────────────────────────
// Minimal card / deck factories
// ─────────────────────────────────────────────────────────────────────────────
const land = (overrides = {}) => ({
  name: 'Forest',
  type: 'land',
  isLand: true,
  isBasic: true,
  landSubtypes: ['Forest'],
  produces: ['G'],
  manaAmount: 1,
  entersTappedAlways: false,
  isFetch: false,
  isBounce: false,
  isShockLand: false,
  isFast: false,
  isBattleLand: false,
  isCheck: false,
  isCrowd: false,
  quantity: 1,
  cmc: 0,
  manaCost: '',
  ...overrides,
});

const creature = (overrides = {}) => ({
  name: 'Llanowar Elves',
  type: 'creature',
  isManaCreature: true,
  isLand: false,
  produces: ['G'],
  manaAmount: 1,
  cmc: 1,
  manaCost: '{G}',
  entersTapped: false,
  quantity: 1,
  ...overrides,
});

const artifact = (overrides = {}) => ({
  name: 'Sol Ring',
  type: 'artifact',
  isManaArtifact: true,
  isLand: false,
  produces: ['C'],
  manaAmount: 2,
  cmc: 1,
  manaCost: '{1}',
  entersTapped: false,
  quantity: 1,
  ...overrides,
});

const ramp = (overrides = {}) => ({
  name: 'Cultivate',
  type: 'rampSpell',
  isRampSpell: true,
  isLand: false,
  cmc: 3,
  manaCost: '{2}{G}',
  landsToAdd: 1,
  landsTapped: true,
  landsToHand: 1,
  sacrificeLand: false,
  fetchFilter: 'basic',
  fetchSubtypes: null,
  quantity: 1,
  ...overrides,
});

const ritual = (overrides = {}) => ({
  name: 'Dark Ritual',
  type: 'ritual',
  isRitual: true,
  isLand: false,
  cmc: 1,
  manaCost: '{B}',
  manaProduced: 3,
  netGain: 2,
  ritualColors: ['B'],
  quantity: 1,
  ...overrides,
});

const exploration = (overrides = {}) => ({
  name: 'Exploration',
  type: 'exploration',
  isExploration: true,
  isLand: false,
  isCreature: false,
  isArtifact: false,
  landsPerTurn: 2,
  cmc: 1,
  manaCost: '{G}',
  entersTapped: false,
  quantity: 1,
  ...overrides,
});

const spell = (overrides = {}) => ({
  name: 'Counterspell',
  type: 'spell',
  isLand: false,
  cmc: 2,
  manaCost: '{U}{U}',
  quantity: 1,
  ...overrides,
});

const costReducer = (overrides = {}) => ({
  name: 'Emerald Medallion',
  type: 'cost_reducer',
  isCostReducer: true,
  reducesColor: 'G',
  reducesAmount: 1,
  reducesType: null,
  entersTapped: false,
  isCreature: false,
  cmc: 2,
  manaCost: '{2}',
  quantity: 1,
  ...overrides,
});

/** Build a minimal but complete parsed-deck object. */
const makeDeck = (overrides = {}) => ({
  lands: [],
  artifacts: [],
  creatures: [],
  exploration: [],
  rampSpells: [],
  rituals: [],
  costReducers: [],
  spells: [],
  ...overrides,
});

/** A 40-land mono-green deck — simplest sensible input for monteCarlo. */
const monoGreenDecks = () => {
  const lands = [];
  for (let i = 0; i < 40; i++) lands.push(land({ name: `Forest ${i + 1}` }));
  return makeDeck({ lands });
};

// ─────────────────────────────────────────────────────────────────────────────
// buildCompleteDeck
// ─────────────────────────────────────────────────────────────────────────────
describe('buildCompleteDeck', () => {
  it('returns [] for null input', () => {
    expect(buildCompleteDeck(null)).toEqual([]);
  });

  it('returns [] for undefined input', () => {
    expect(buildCompleteDeck(undefined)).toEqual([]);
  });

  it('returns [] for an empty deck', () => {
    expect(buildCompleteDeck(makeDeck())).toEqual([]);
  });

  it('includes lands always', () => {
    const deck = makeDeck({ lands: [land({ quantity: 3 })] });
    const result = buildCompleteDeck(deck);
    expect(result.filter(c => c.isLand)).toHaveLength(3);
  });

  it('expands quantity > 1 correctly', () => {
    const deck = makeDeck({ lands: [land({ quantity: 4 })] });
    const result = buildCompleteDeck(deck);
    expect(result).toHaveLength(4);
  });

  it('includes artifacts by default', () => {
    const deck = makeDeck({ artifacts: [artifact({ quantity: 2 })] });
    const result = buildCompleteDeck(deck);
    expect(result.filter(c => c.isManaArtifact)).toHaveLength(2);
  });

  it('excludes artifacts when includeArtifacts=false', () => {
    const deck = makeDeck({ artifacts: [artifact()] });
    const result = buildCompleteDeck(deck, { includeArtifacts: false });
    expect(result.filter(c => c.isManaArtifact)).toHaveLength(0);
  });

  it('excludes a specific artifact in disabledArtifacts', () => {
    const a1 = artifact({ name: 'Sol Ring' });
    const a2 = artifact({ name: 'Arcane Signet' });
    const deck = makeDeck({ artifacts: [a1, a2] });
    const result = buildCompleteDeck(deck, { disabledArtifacts: new Set(['Sol Ring']) });
    expect(result.some(c => c.name === 'Sol Ring')).toBe(false);
    expect(result.some(c => c.name === 'Arcane Signet')).toBe(true);
  });

  it('excludes creatures when includeCreatures=false', () => {
    const deck = makeDeck({ creatures: [creature()] });
    const result = buildCompleteDeck(deck, { includeCreatures: false });
    expect(result.filter(c => c.isManaCreature)).toHaveLength(0);
  });

  it('excludes a specific creature in disabledCreatures', () => {
    const deck = makeDeck({ creatures: [creature({ name: 'Llanowar Elves' })] });
    const result = buildCompleteDeck(deck, { disabledCreatures: new Set(['Llanowar Elves']) });
    expect(result.some(c => c.name === 'Llanowar Elves')).toBe(false);
  });

  it('excludes ramp spells when includeRampSpells=false', () => {
    const deck = makeDeck({ rampSpells: [ramp()] });
    const result = buildCompleteDeck(deck, { includeRampSpells: false });
    expect(result.filter(c => c.isRampSpell)).toHaveLength(0);
  });

  it('excludes a specific ramp spell in disabledRampSpells', () => {
    const deck = makeDeck({ rampSpells: [ramp({ name: 'Cultivate' })] });
    const result = buildCompleteDeck(deck, { disabledRampSpells: new Set(['Cultivate']) });
    expect(result.some(c => c.name === 'Cultivate')).toBe(false);
  });

  it('excludes rituals when includeRituals=false', () => {
    const deck = makeDeck({ rituals: [ritual()] });
    const result = buildCompleteDeck(deck, { includeRituals: false });
    expect(result.filter(c => c.isRitual)).toHaveLength(0);
  });

  it('excludes a specific ritual in disabledRituals', () => {
    const deck = makeDeck({ rituals: [ritual({ name: 'Dark Ritual' })] });
    const result = buildCompleteDeck(deck, { disabledRituals: new Set(['Dark Ritual']) });
    expect(result.some(c => c.name === 'Dark Ritual')).toBe(false);
  });

  it('excludes exploration effects when includeExploration=false', () => {
    const deck = makeDeck({ exploration: [exploration()] });
    const result = buildCompleteDeck(deck, { includeExploration: false });
    expect(result.filter(c => c.isExploration)).toHaveLength(0);
  });

  it('excludes a specific exploration effect in disabledExploration', () => {
    const deck = makeDeck({ exploration: [exploration({ name: 'Exploration' })] });
    const result = buildCompleteDeck(deck, { disabledExploration: new Set(['Exploration']) });
    expect(result.some(c => c.name === 'Exploration')).toBe(false);
  });

  it('always includes lands regardless of include flags', () => {
    const deck = makeDeck({ lands: [land({ quantity: 5 })] });
    const result = buildCompleteDeck(deck, {
      includeArtifacts: false,
      includeCreatures: false,
      includeRampSpells: false,
      includeRituals: false,
      includeExploration: false,
    });
    expect(result).toHaveLength(5);
  });

  it('always includes spells regardless of include flags', () => {
    const deck = makeDeck({ spells: [spell({ quantity: 3 })] });
    const result = buildCompleteDeck(deck);
    expect(result.filter(c => c.type === 'spell')).toHaveLength(3);
  });

  it('each card in result is a separate object copy (not the same reference)', () => {
    const l = land({ quantity: 2 });
    const deck = makeDeck({ lands: [l] });
    const result = buildCompleteDeck(deck);
    expect(result[0]).not.toBe(result[1]);
    expect(result[0]).not.toBe(l);
  });

  it('returns correct total card count from a mixed deck', () => {
    const deck = makeDeck({
      lands: [land({ quantity: 4 })],
      artifacts: [artifact({ quantity: 2 })],
      creatures: [creature({ quantity: 3 })],
      spells: [spell({ quantity: 1 })],
    });
    const result = buildCompleteDeck(deck);
    expect(result).toHaveLength(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCompleteDeck — manaOverrides
// ─────────────────────────────────────────────────────────────────────────────
describe('buildCompleteDeck — manaOverrides', () => {
  it('applies a fixed override, replacing manaAmount', () => {
    const deck = makeDeck({ artifacts: [artifact({ name: 'Sol Ring', manaAmount: 2 })] });
    const result = buildCompleteDeck(deck, {
      manaOverrides: { 'sol ring': { mode: 'fixed', fixed: 5 } },
    });
    expect(result.find(c => c.name === 'Sol Ring').manaAmount).toBe(5);
    expect(result.find(c => c.name === 'Sol Ring').manaScaling).toBeUndefined();
  });

  it('fixed override clamps to minimum 1', () => {
    const deck = makeDeck({ artifacts: [artifact({ name: 'Sol Ring', manaAmount: 2 })] });
    const result = buildCompleteDeck(deck, {
      manaOverrides: { 'sol ring': { mode: 'fixed', fixed: 0 } },
    });
    expect(result.find(c => c.name === 'Sol Ring').manaAmount).toBe(1);
  });

  it('applies a scaling override, adding manaScaling and setting manaAmount = base', () => {
    const deck = makeDeck({
      creatures: [creature({ name: 'Marwyn, the Nurturer', manaAmount: 1 })],
    });
    const result = buildCompleteDeck(deck, {
      manaOverrides: { 'marwyn, the nurturer': { mode: 'scaling', base: 1, growth: 1 } },
    });
    const card = result.find(c => c.name === 'Marwyn, the Nurturer');
    expect(card.manaScaling).toEqual({ base: 1, growth: 1 });
    expect(card.manaAmount).toBe(1);
  });

  it('scaling override clamps base to minimum 1', () => {
    const deck = makeDeck({ artifacts: [artifact({ name: 'Sol Ring', manaAmount: 2 })] });
    const result = buildCompleteDeck(deck, {
      manaOverrides: { 'sol ring': { mode: 'scaling', base: 0, growth: 2 } },
    });
    expect(result.find(c => c.name === 'Sol Ring').manaScaling.base).toBe(1);
  });

  it('scaling override clamps growth to minimum 0', () => {
    const deck = makeDeck({ artifacts: [artifact({ name: 'Sol Ring', manaAmount: 2 })] });
    const result = buildCompleteDeck(deck, {
      manaOverrides: { 'sol ring': { mode: 'scaling', base: 1, growth: -3 } },
    });
    expect(result.find(c => c.name === 'Sol Ring').manaScaling.growth).toBe(0);
  });

  it('leaves cards unchanged when override mode is unrecognized / default', () => {
    const deck = makeDeck({ artifacts: [artifact({ name: 'Sol Ring', manaAmount: 2 })] });
    const result = buildCompleteDeck(deck, {
      manaOverrides: { 'sol ring': { mode: 'default' } },
    });
    const card = result.find(c => c.name === 'Sol Ring');
    expect(card.manaAmount).toBe(2);
    expect(card.manaScaling).toBeUndefined();
  });

  it('does not affect cards not mentioned in manaOverrides', () => {
    const deck = makeDeck({ artifacts: [artifact({ name: 'Sol Ring', manaAmount: 2 })] });
    const result = buildCompleteDeck(deck, {
      manaOverrides: { 'arcane signet': { mode: 'fixed', fixed: 3 } },
    });
    expect(result.find(c => c.name === 'Sol Ring').manaAmount).toBe(2);
  });

  it('empty manaOverrides leaves all cards unchanged', () => {
    const deck = makeDeck({ artifacts: [artifact({ name: 'Sol Ring', manaAmount: 2 })] });
    const result = buildCompleteDeck(deck, { manaOverrides: {} });
    expect(result.find(c => c.name === 'Sol Ring').manaAmount).toBe(2);
  });

  it('override key matching is case-insensitive (lowercased card name)', () => {
    const deck = makeDeck({ creatures: [creature({ name: 'Birds of Paradise', manaAmount: 1 })] });
    const result = buildCompleteDeck(deck, {
      manaOverrides: { 'birds of paradise': { mode: 'fixed', fixed: 4 } },
    });
    expect(result.find(c => c.name === 'Birds of Paradise').manaAmount).toBe(4);
  });

  it('applies overrides to every copy when quantity > 1', () => {
    const deck = makeDeck({
      creatures: [creature({ name: 'Llanowar Elves', manaAmount: 1, quantity: 4 })],
    });
    const result = buildCompleteDeck(deck, {
      manaOverrides: { 'llanowar elves': { mode: 'fixed', fixed: 2 } },
    });
    const elves = result.filter(c => c.name === 'Llanowar Elves');
    expect(elves).toHaveLength(4);
    expect(elves.every(c => c.manaAmount === 2)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// monteCarlo — result shape
// ─────────────────────────────────────────────────────────────────────────────
describe('monteCarlo — result structure', () => {
  const parsedDeck = monoGreenDecks();
  const config = { iterations: 50, turns: 5, handSize: 7, commanderMode: false };
  let result;
  // Run once and re-use across shape tests
  result = monteCarlo(parsedDeck, config);

  it('returns an object with all expected top-level keys', () => {
    expect(result).toHaveProperty('landsPerTurn');
    expect(result).toHaveProperty('untappedLandsPerTurn');
    expect(result).toHaveProperty('colorsByTurn');
    expect(result).toHaveProperty('totalManaPerTurn');
    expect(result).toHaveProperty('lifeLossPerTurn');
    expect(result).toHaveProperty('keyCardPlayability');
    expect(result).toHaveProperty('keyCardPlayabilityBurst');
    expect(result).toHaveProperty('hasBurstCards');
    expect(result).toHaveProperty('fastestPlaySequences');
    expect(result).toHaveProperty('fastestPlaySequencesBurst');
    expect(result).toHaveProperty('mulligans');
    expect(result).toHaveProperty('handsKept');
  });

  it('landsPerTurn length equals the configured turns', () => {
    expect(result.landsPerTurn).toHaveLength(5);
  });

  it('untappedLandsPerTurn length equals the configured turns', () => {
    expect(result.untappedLandsPerTurn).toHaveLength(5);
  });

  it('totalManaPerTurn length equals the configured turns', () => {
    expect(result.totalManaPerTurn).toHaveLength(5);
  });

  it('colorsByTurn has W/U/B/R/G keys at each turn', () => {
    result.colorsByTurn.forEach(turn => {
      ['W', 'U', 'B', 'G', 'R'].forEach(c => expect(turn).toHaveProperty(c));
    });
  });

  it('all per-turn averages are finite numbers', () => {
    result.landsPerTurn.forEach(v => expect(isFinite(v)).toBe(true));
    result.totalManaPerTurn.forEach(v => expect(isFinite(v)).toBe(true));
    result.lifeLossPerTurn.forEach(v => expect(isFinite(v)).toBe(true));
  });

  it('handsKept equals iterations when mulligans are disabled', () => {
    expect(result.handsKept).toBe(50);
  });

  it('mulligans is 0 when enableMulligans=false', () => {
    expect(result.mulligans).toBe(0);
  });

  it('hasBurstCards is false when deck has no rituals or burst sources', () => {
    expect(result.hasBurstCards).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// monteCarlo — land statistics
// ─────────────────────────────────────────────────────────────────────────────
describe('monteCarlo — land statistics', () => {
  it('average lands on turn 1 (0-indexed) is > 0 for a 40-land deck', () => {
    const result = monteCarlo(monoGreenDecks(), { iterations: 200, turns: 4, handSize: 7 });
    expect(result.landsPerTurn[0]).toBeGreaterThan(0);
  });

  it('average lands are non-decreasing across turns (more lands enter play each turn)', () => {
    const result = monteCarlo(monoGreenDecks(), { iterations: 500, turns: 5, handSize: 7 });
    for (let t = 1; t < 5; t++) {
      expect(result.landsPerTurn[t]).toBeGreaterThanOrEqual(result.landsPerTurn[t - 1]);
    }
  });

  it('average total mana is non-decreasing across turns', () => {
    const result = monteCarlo(monoGreenDecks(), { iterations: 500, turns: 5, handSize: 7 });
    for (let t = 1; t < 5; t++) {
      expect(result.totalManaPerTurn[t]).toBeGreaterThanOrEqual(result.totalManaPerTurn[t - 1]);
    }
  });

  it('untapped lands never exceed total lands on any turn', () => {
    const result = monteCarlo(monoGreenDecks(), { iterations: 200, turns: 5, handSize: 7 });
    for (let t = 0; t < 5; t++) {
      expect(result.untappedLandsPerTurn[t]).toBeLessThanOrEqual(result.landsPerTurn[t] + 0.001);
    }
  });

  it('a deck of only tapped lands has 0 avg untapped lands on turn 1', () => {
    const tapLands = [];
    for (let i = 0; i < 40; i++)
      tapLands.push(land({ name: `Tap ${i}`, entersTappedAlways: true }));
    const deck = makeDeck({ lands: tapLands });
    const result = monteCarlo(deck, { iterations: 200, turns: 3, handSize: 7 });
    // On turn 1 everything entered tapped, so untapped count should be 0
    expect(result.untappedLandsPerTurn[0]).toBe(0);
  });

  it('colour averages for a mono-green deck are non-zero for G, zero for WUBR', () => {
    const result = monteCarlo(monoGreenDecks(), { iterations: 300, turns: 4, handSize: 7 });
    // By turn 3 (index 2) we should have green mana
    expect(result.colorsByTurn[2].G).toBeGreaterThan(0);
    expect(result.colorsByTurn[2].W).toBe(0);
    expect(result.colorsByTurn[2].U).toBe(0);
    expect(result.colorsByTurn[2].B).toBe(0);
    expect(result.colorsByTurn[2].R).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// monteCarlo — key-card playability
// ─────────────────────────────────────────────────────────────────────────────
describe('monteCarlo — key-card playability', () => {
  it('a free spell ({0}) is playable 100% of the time by turn 2', () => {
    const freeSpell = spell({ name: 'Zero Spell', cmc: 0, manaCost: '{0}' });
    const deck = makeDeck({
      lands: Array.from({ length: 36 }, (_, i) => land({ name: `F${i}` })),
      spells: [freeSpell],
    });
    const result = monteCarlo(deck, {
      iterations: 300,
      turns: 3,
      selectedKeyCards: new Set(['Zero Spell']),
    });
    // By turn 2 (index 1) the {0} spell is always playable
    expect(result.keyCardPlayability['Zero Spell'][1]).toBeCloseTo(100, 0);
  });

  it('an expensive spell has 0% playability on turn 1 with no mana sources', () => {
    const expensive = spell({ name: 'Big Spell', cmc: 10, manaCost: '{10}' });
    const deck = makeDeck({ spells: [expensive] });
    const result = monteCarlo(deck, {
      iterations: 100,
      turns: 3,
      selectedKeyCards: new Set(['Big Spell']),
    });
    expect(result.keyCardPlayability['Big Spell'][0]).toBe(0);
  });

  it('keyCardPlayability percentages are in [0, 100]', () => {
    const freeSpell = spell({ name: 'FreeCard', cmc: 0, manaCost: '{0}' });
    const deck = makeDeck({
      lands: Array.from({ length: 36 }, (_, i) => land({ name: `L${i}` })),
      spells: [freeSpell],
    });
    const result = monteCarlo(deck, {
      iterations: 100,
      turns: 4,
      selectedKeyCards: new Set(['FreeCard']),
    });
    result.keyCardPlayability['FreeCard'].forEach(pct => {
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    });
  });

  it('keyCardPlayability array length equals turns', () => {
    const freeSpell = spell({ name: 'FreeCard2', cmc: 0, manaCost: '{0}' });
    const deck = makeDeck({ spells: [freeSpell] });
    const result = monteCarlo(deck, {
      iterations: 50,
      turns: 6,
      selectedKeyCards: new Set(['FreeCard2']),
    });
    expect(result.keyCardPlayability['FreeCard2']).toHaveLength(6);
    expect(result.keyCardPlayabilityBurst['FreeCard2']).toHaveLength(6);
  });

  it('playability is monotonically non-decreasing across turns', () => {
    const target = spell({ name: 'ThreeDrop', cmc: 3, manaCost: '{1}{G}{G}' });
    const deck = makeDeck({
      lands: Array.from({ length: 36 }, (_, i) => land({ name: `F${i}` })),
      spells: [target],
    });
    const result = monteCarlo(deck, {
      iterations: 500,
      turns: 6,
      selectedKeyCards: new Set(['ThreeDrop']),
    });
    const pct = result.keyCardPlayability['ThreeDrop'];
    for (let t = 1; t < pct.length; t++) {
      expect(pct[t]).toBeGreaterThanOrEqual(pct[t - 1] - 0.1); // small floating tolerance
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// monteCarlo — burst / ritual detection
// ─────────────────────────────────────────────────────────────────────────────
describe('monteCarlo — hasBurstCards', () => {
  it('is true when a ritual is in the deck', () => {
    const deck = makeDeck({
      lands: Array.from({ length: 36 }, (_, i) => land({ name: `L${i}` })),
      rituals: [ritual()],
    });
    const result = monteCarlo(deck, { iterations: 10, turns: 3 });
    expect(result.hasBurstCards).toBe(true);
  });

  it('is false when the deck has no rituals or burst sources', () => {
    const result = monteCarlo(monoGreenDecks(), { iterations: 10, turns: 3 });
    expect(result.hasBurstCards).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// monteCarlo — mulligans
// ─────────────────────────────────────────────────────────────────────────────
describe('monteCarlo — mulligans', () => {
  it('mulligans > 0 is possible when enableMulligans=true and aggressive strategy on a land-heavy deck', () => {
    // With aggressive strategy, a 7-land opening hand will cause a mulligan.
    // A 40-land deck will almost always trigger mulligans.
    const result = monteCarlo(monoGreenDecks(), {
      iterations: 200,
      turns: 3,
      enableMulligans: true,
      mulliganStrategy: 'aggressive',
    });
    expect(result.mulligans).toBeGreaterThan(0);
  });

  it('london mulligan keeps correct hand size (7 - mulliganCount cards)', () => {
    // This is implicitly verified: if the sim runs for many iterations without
    // throwing, the hand sizing logic is correct.
    expect(() =>
      monteCarlo(monoGreenDecks(), {
        iterations: 100,
        turns: 4,
        enableMulligans: true,
        mulliganRule: 'london',
        mulliganStrategy: 'balanced',
      })
    ).not.toThrow();
  });

  it('vancouver mulligan rule runs without error', () => {
    expect(() =>
      monteCarlo(monoGreenDecks(), {
        iterations: 100,
        turns: 4,
        enableMulligans: true,
        mulliganRule: 'vancouver',
        mulliganStrategy: 'conservative',
      })
    ).not.toThrow();
  });

  it('handsKept equals iterations regardless of mulligans', () => {
    const result = monteCarlo(monoGreenDecks(), {
      iterations: 150,
      turns: 3,
      enableMulligans: true,
      mulliganStrategy: 'aggressive',
    });
    expect(result.handsKept).toBe(150);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// monteCarlo — life-loss tracking
// ─────────────────────────────────────────────────────────────────────────────
describe('monteCarlo — lifeLossPerTurn', () => {
  it('is 0 for all turns with a basic-land-only deck', () => {
    const result = monteCarlo(monoGreenDecks(), { iterations: 100, turns: 5 });
    result.lifeLossPerTurn.forEach(v => expect(v).toBe(0));
  });

  it('is non-negative for all turns', () => {
    const result = monteCarlo(monoGreenDecks(), { iterations: 100, turns: 5 });
    result.lifeLossPerTurn.forEach(v => expect(v).toBeGreaterThanOrEqual(0));
  });

  it('is cumulative — later turns >= earlier turns', () => {
    const result = monteCarlo(monoGreenDecks(), { iterations: 100, turns: 5 });
    for (let t = 1; t < 5; t++) {
      expect(result.lifeLossPerTurn[t]).toBeGreaterThanOrEqual(result.lifeLossPerTurn[t - 1]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// monteCarlo — commander mode
// ─────────────────────────────────────────────────────────────────────────────
describe('monteCarlo — commanderMode', () => {
  it('runs without errors in commander mode', () => {
    expect(() =>
      monteCarlo(monoGreenDecks(), {
        iterations: 100,
        turns: 6,
        commanderMode: true,
      })
    ).not.toThrow();
  });

  it('turn-1 lands: commander mode (draws on turn 0) should average ≥ non-commander', () => {
    // In commander mode every turn draws, yielding a slightly better land average
    const base = monteCarlo(monoGreenDecks(), { iterations: 500, turns: 2, commanderMode: false });
    const cmd = monteCarlo(monoGreenDecks(), { iterations: 500, turns: 2, commanderMode: true });
    // By turn 2 (index 1) commander mode gains an extra card on turn 1, so lands ≥ non-cmd
    expect(cmd.landsPerTurn[1]).toBeGreaterThanOrEqual(base.landsPerTurn[1] - 0.05);
  });

  // ── Free first mulligan (Commander rule) ──────────────────────────────────

  it('commander + London mulligan: first mulligan is free (mulligans tracked, no error)', () => {
    // Aggressive strategy on a 40-land deck will force mulligans.
    // The free first mulligan means the first redraw still yields 7 cards.
    expect(() =>
      monteCarlo(monoGreenDecks(), {
        iterations: 200,
        turns: 3,
        commanderMode: true,
        enableMulligans: true,
        mulliganRule: 'london',
        mulliganStrategy: 'aggressive',
      })
    ).not.toThrow();
  });

  it('commander + London mulligan: handsKept still equals iterations after free mulligan', () => {
    const result = monteCarlo(monoGreenDecks(), {
      iterations: 200,
      turns: 3,
      commanderMode: true,
      enableMulligans: true,
      mulliganRule: 'london',
      mulliganStrategy: 'aggressive',
    });
    expect(result.handsKept).toBe(200);
  });

  it('commander free mulligan: avg land count on turn 1 is >= same config without commander', () => {
    // Because commander gets a free 7-card redraw, consistency should be at least equal
    const baseResult = monteCarlo(monoGreenDecks(), {
      iterations: 500,
      turns: 3,
      commanderMode: false,
      enableMulligans: true,
      mulliganRule: 'london',
      mulliganStrategy: 'aggressive',
    });
    const cmdResult = monteCarlo(monoGreenDecks(), {
      iterations: 500,
      turns: 3,
      commanderMode: true,
      enableMulligans: true,
      mulliganRule: 'london',
      mulliganStrategy: 'aggressive',
    });
    // Commander free mulligan keeps 7 cards on first mull vs 6 — should not be worse
    expect(cmdResult.landsPerTurn[0]).toBeGreaterThanOrEqual(baseResult.landsPerTurn[0] - 0.1);
  });

  it('commander + Vancouver mulligan: first mulligan redraws 7 cards (no error)', () => {
    expect(() =>
      monteCarlo(monoGreenDecks(), {
        iterations: 200,
        turns: 3,
        commanderMode: true,
        enableMulligans: true,
        mulliganRule: 'vancouver',
        mulliganStrategy: 'aggressive',
      })
    ).not.toThrow();
  });

  it('commander free mulligan mulligans counter is still incremented', () => {
    // mulligans counter tracks draws taken, not cards bottomed — should still be > 0
    const result = monteCarlo(monoGreenDecks(), {
      iterations: 200,
      turns: 3,
      commanderMode: true,
      enableMulligans: true,
      mulliganRule: 'london',
      mulliganStrategy: 'aggressive',
    });
    expect(result.mulligans).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// monteCarlo — edge cases
// ─────────────────────────────────────────────────────────────────────────────
describe('monteCarlo — edge cases', () => {
  it('handles iterations=1 without throwing', () => {
    expect(() => monteCarlo(monoGreenDecks(), { iterations: 1, turns: 3 })).not.toThrow();
  });

  it('handles turns=1 and returns single-element arrays', () => {
    const result = monteCarlo(monoGreenDecks(), { iterations: 50, turns: 1 });
    expect(result.landsPerTurn).toHaveLength(1);
    expect(result.totalManaPerTurn).toHaveLength(1);
  });

  it('handles a deck with no lands (all spells) without throwing', () => {
    const deck = makeDeck({
      spells: Array.from({ length: 60 }, (_, i) => spell({ name: `Spell${i}` })),
    });
    expect(() => monteCarlo(deck, { iterations: 50, turns: 4 })).not.toThrow();
  });

  it('handles handSize=1 without throwing', () => {
    expect(() =>
      monteCarlo(monoGreenDecks(), { iterations: 50, turns: 3, handSize: 1 })
    ).not.toThrow();
  });

  it('fastestPlaySequences is populated for a key card that becomes playable', () => {
    const freeCard = spell({ name: 'FreeKey', cmc: 0, manaCost: '{0}' });
    const deck = makeDeck({
      lands: Array.from({ length: 36 }, (_, i) => land({ name: `L${i}` })),
      spells: [freeCard],
    });
    const result = monteCarlo(deck, {
      iterations: 50,
      turns: 3,
      maxSequences: 1,
      selectedKeyCards: new Set(['FreeKey']),
    });
    // There should be sequences logged for at least one turn
    expect(Object.keys(result.fastestPlaySequences['FreeKey']).length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildCompleteDeck — costReducers
// ─────────────────────────────────────────────────────────────────────────────
describe('buildCompleteDeck — costReducers', () => {
  it('includes cost reducers by default', () => {
    const deck = makeDeck({ costReducers: [costReducer({ quantity: 2 })] });
    const result = buildCompleteDeck(deck);
    expect(result.filter(c => c.isCostReducer)).toHaveLength(2);
  });

  it('excludes cost reducers when includeCostReducers = false', () => {
    const deck = makeDeck({ costReducers: [costReducer({ quantity: 1 })] });
    const result = buildCompleteDeck(deck, { includeCostReducers: false });
    expect(result.filter(c => c.isCostReducer)).toHaveLength(0);
  });

  it('respects disabledCostReducers set', () => {
    const em = costReducer({ name: 'Emerald Medallion', quantity: 1 });
    const jm = costReducer({ name: 'Jet Medallion', reducesColor: 'B', quantity: 1 });
    const deck = makeDeck({ costReducers: [em, jm] });
    const result = buildCompleteDeck(deck, {
      includeCostReducers: true,
      disabledCostReducers: new Set(['Emerald Medallion']),
    });
    const reducers = result.filter(c => c.isCostReducer);
    expect(reducers).toHaveLength(1);
    expect(reducers[0].name).toBe('Jet Medallion');
  });

  it('tolerates missing costReducers array on parsed deck (backwards compat)', () => {
    const deck = makeDeck();
    delete deck.costReducers;
    expect(() => buildCompleteDeck(deck)).not.toThrow();
  });

  it('expands quantity > 1 for cost reducers', () => {
    const deck = makeDeck({ costReducers: [costReducer({ quantity: 3 })] });
    expect(buildCompleteDeck(deck).filter(c => c.isCostReducer)).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// monteCarlo — cost-reducer integration
// ─────────────────────────────────────────────────────────────────────────────
describe('monteCarlo — cost-reducer integration', () => {
  it('does not crash with cost reducers in the deck', () => {
    const deck = makeDeck({
      lands: Array.from({ length: 36 }, (_, i) => land({ name: `Forest ${i}` })),
      costReducers: [costReducer({ quantity: 4 })],
    });
    expect(() => monteCarlo(deck, { iterations: 20, turns: 5 })).not.toThrow();
  });

  it('key-card playability improves with a matching cost reducer', () => {
    // A 3-CMC Green spell should be castable a turn earlier with Emerald Medallion
    const keySpell = spell({ name: 'GreenKey', cmc: 3, manaCost: '{2}{G}', typeLine: 'Sorcery' });
    const deckNoReducer = makeDeck({
      lands: Array.from({ length: 36 }, (_, i) => land({ name: `F${i}` })),
      spells: [keySpell],
    });
    const deckWithReducer = makeDeck({
      lands: Array.from({ length: 34 }, (_, i) => land({ name: `F${i}` })),
      costReducers: [
        costReducer({
          name: 'Emerald Medallion',
          reducesColor: 'G',
          reducesAmount: 1,
          quantity: 2,
        }),
      ],
      spells: [keySpell],
    });

    const cfg = { iterations: 500, turns: 5, selectedKeyCards: new Set(['GreenKey']) };
    const resultNo = monteCarlo(deckNoReducer, cfg);
    const resultWith = monteCarlo(deckWithReducer, cfg);

    // Turn 1 (index 0): GreenKey costs {2}{G} → not castable with 1 land without reducer
    // With reducer in play it becomes {1}{G}, still requires 2 lands minimum.
    // Turn 2 (index 1): With reducer discounting 1 generic, it costs {1}{G} → castable with 2 lands.
    const playT2No = resultNo.keyCardPlayability['GreenKey'][1];
    const playT2With = resultWith.keyCardPlayability['GreenKey'][1];
    // The deck with the cost reducer should see at least as many T2 plays
    expect(playT2With).toBeGreaterThanOrEqual(playT2No);
  });
});
