/**
 * deckParser.js — Unit Tests
 *
 * Covers parseDeckList (the only export):
 *   · Empty / blank input
 *   · Local mode with no cardLookupMap
 *   · Line parsing: quantities, "Nx" syntax, blank lines, section headers
 *   · Unknown card → error recorded, card skipped
 *   · Correct categorisation of lands, artifacts, creatures, exploration,
 *     ramp spells, rituals, and generic spells
 *   · MDFC with a land face (land + spell entries)
 *   · quantity / totalCards / landCount aggregation
 *   · result shape
 *
 * Run:  npm test
 */

import { describe, it, expect } from 'vitest';
import { parseDeckList } from '../src/parser/deckParser.js';

// ─────────────────────────────────────────────────────────────────────────────
// Minimal Scryfall-shaped card factories
// The shapes must satisfy processCardData's routing conditions:
//   · land:        type_line includes "Land"
//   · artifact:    type_line includes "Artifact", oracle_text has tap-add
//   · creature:    type_line includes "Creature", oracle_text has tap-add
//   · ramp spell:  name matches RAMP_SPELL_DATA key
//   · ritual:      name matches RITUAL_DATA key
//   · exploration: name matches EXPLORATION_EFFECTS key
//   · spell:       everything else
// ─────────────────────────────────────────────────────────────────────────────
const scryfallLand = (name, subtypes = 'Forest', produces = '{G}', extras = {}) => ({
  name,
  type_line: `Basic Land — ${subtypes}`,
  oracle_text: `({T}: Add ${produces}.)`,
  mana_cost: '',
  cmc: 0,
  layout: 'normal',
  ...extras,
});

const scryfallCreature = (name, oracleText, manaCost, cmc, extras = {}) => ({
  name,
  type_line: 'Creature — Elf Druid',
  oracle_text: oracleText,
  mana_cost: manaCost,
  cmc,
  layout: 'normal',
  ...extras,
});

const scryfallArtifact = (name, oracleText, manaCost, cmc, extras = {}) => ({
  name,
  type_line: 'Artifact',
  oracle_text: oracleText,
  mana_cost: manaCost,
  cmc,
  layout: 'normal',
  ...extras,
});

const scryfallSorcery = (name, manaCost, cmc, extras = {}) => ({
  name,
  type_line: 'Sorcery',
  oracle_text: '',
  mana_cost: manaCost,
  cmc,
  layout: 'normal',
  ...extras,
});

const scryfallInstant = (name, manaCost, cmc, extras = {}) => ({
  name,
  type_line: 'Instant',
  oracle_text: '',
  mana_cost: manaCost,
  cmc,
  layout: 'normal',
  ...extras,
});

// ── Standard card fixtures using real names so archive lookups work ───────

const FOREST_DATA        = scryfallLand('Forest', 'Forest', '{G}');
const ISLAND_DATA        = scryfallLand('Island', 'Island', '{U}');
const SWAMP_DATA         = scryfallLand('Swamp',  'Swamp',  '{B}');

const LLANOWAR_DATA      = scryfallCreature(
  'Llanowar Elves', '{T}: Add {G}.', '{G}', 1
);
const SOL_RING_DATA      = scryfallArtifact(
  'Sol Ring', '{T}: Add {C}{C}.', '{1}', 1
);
const CULTIVATE_DATA     = scryfallSorcery('Cultivate',     '{2}{G}', 3);
const DARK_RITUAL_DATA   = scryfallInstant('Dark Ritual',   '{B}',    1);
const EXPLORATION_DATA   = {
  name: 'Exploration',
  type_line: 'Enchantment',
  oracle_text: 'You may play an additional land on each of your turns.',
  mana_cost: '{G}',
  cmc: 1,
  layout: 'normal',
};
const COUNTERSPELL_DATA  = scryfallInstant('Counterspell',  '{U}{U}', 2);

// ── MDFC: Turntimber Symbiosis // Turntimber, Serpentine Wood ─────────────
const TURNTIMBER_DATA = {
  name: 'Turntimber Symbiosis',
  type_line: 'Sorcery',
  oracle_text: '',
  mana_cost: null,
  cmc: 7,
  layout: 'modal_dfc',
  card_faces: [
    {
      name: 'Turntimber Symbiosis',
      type_line: 'Sorcery',
      oracle_text: 'Look at the top seven cards of your library...',
      mana_cost: '{4}{G}{G}{G}',
      cmc: 7,
    },
    {
      name: 'Turntimber, Serpentine Wood',
      type_line: 'Land — Forest',
      oracle_text: '({T}: Add {G}.)',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper – builds a lookupCard function from a name→data map
// ─────────────────────────────────────────────────────────────────────────────
const makeLookup = (map) => async (name) => map.get(name) ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// parseDeckList — guard conditions
// ─────────────────────────────────────────────────────────────────────────────
describe('parseDeckList — guard conditions', () => {
  it('returns an error result for blank deck text', async () => {
    const ctx = { cardLookupMap: new Map([['x', {}]]), apiMode: 'local', lookupCard: makeLookup(new Map()) };
    const result = await parseDeckList('   ', ctx);
    expect(result.errors).toContain('Please enter a deck list');
    expect(result.totalCards).toBe(0);
  });

  it('returns an error result when cardLookupMap is empty in local mode', async () => {
    const ctx = { cardLookupMap: new Map(), apiMode: 'local', lookupCard: makeLookup(new Map()) };
    const result = await parseDeckList('1 Forest', ctx);
    expect(result.errors).toContain('Please upload cards.json file first');
    expect(result.totalCards).toBe(0);
  });

  it('returns null when the deck text contains no parseable lines', async () => {
    const ctx = { cardLookupMap: new Map([['x', {}]]), apiMode: 'scryfall', lookupCard: makeLookup(new Map()) };
    const result = await parseDeckList('// comments only\n\n', ctx);
    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseDeckList — line parsing
// ─────────────────────────────────────────────────────────────────────────────
describe('parseDeckList — line parsing', () => {
  const ctx = (lookup) => ({
    cardLookupMap: new Map([['Forest', FOREST_DATA]]),
    apiMode: 'scryfall',
    lookupCard: lookup,
  });

  it('parses "1 Forest" (plain quantity)', async () => {
    const lookup = makeLookup(new Map([['Forest', FOREST_DATA]]));
    const result = await parseDeckList('1 Forest', ctx(lookup));
    expect(result.lands).toHaveLength(1);
    expect(result.lands[0].name).toBe('Forest');
    expect(result.lands[0].quantity).toBe(1);
  });

  it('parses "4x Forest" (Nx syntax)', async () => {
    const lookup = makeLookup(new Map([['Forest', FOREST_DATA]]));
    const result = await parseDeckList('4x Forest', ctx(lookup));
    expect(result.lands[0].quantity).toBe(4);
  });

  it('accumulates duplicate entries', async () => {
    const lookup = makeLookup(new Map([['Forest', FOREST_DATA]]));
    const result = await parseDeckList('2 Forest\n3 Forest', ctx(lookup));
    expect(result.lands[0].quantity).toBe(5);
    expect(result.lands).toHaveLength(1);
  });

  it('ignores blank lines', async () => {
    const lookup = makeLookup(new Map([['Forest', FOREST_DATA]]));
    const result = await parseDeckList('\n\n1 Forest\n\n', ctx(lookup));
    expect(result.lands).toHaveLength(1);
  });

  it('ignores "Deck" section header', async () => {
    const lookup = makeLookup(new Map([['Forest', FOREST_DATA]]));
    const result = await parseDeckList('Deck\n1 Forest', ctx(lookup));
    expect(result.lands).toHaveLength(1);
  });

  it('ignores "Sideboard" section header', async () => {
    const lookup = makeLookup(new Map([['Forest', FOREST_DATA]]));
    const result = await parseDeckList('1 Forest\nSideboard\n', ctx(lookup));
    expect(result.lands).toHaveLength(1);
  });

  it('ignores "Commander" section header', async () => {
    const lookup = makeLookup(new Map([['Forest', FOREST_DATA]]));
    const result = await parseDeckList('Commander\n1 Forest', ctx(lookup));
    expect(result.lands).toHaveLength(1);
  });

  it('is case-insensitive for section headers', async () => {
    const lookup = makeLookup(new Map([['Forest', FOREST_DATA]]));
    const result = await parseDeckList('DECK\n1 Forest\nSIDEBOARD', ctx(lookup));
    expect(result.lands).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseDeckList — unknown cards
// ─────────────────────────────────────────────────────────────────────────────
describe('parseDeckList — unknown cards', () => {
  it('records an error for a card not in the lookup', async () => {
    const lookup = makeLookup(new Map()); // nothing in the map
    const ctx    = { cardLookupMap: new Map([['x', {}]]), apiMode: 'scryfall', lookupCard: lookup };
    const result = await parseDeckList('1 Nonexistent Card XYZ', ctx);
    expect(result.errors.some(e => e.includes('Nonexistent Card XYZ'))).toBe(true);
  });

  it('skips the unknown card but still processes known ones', async () => {
    const lookup = makeLookup(new Map([['Forest', FOREST_DATA]]));
    const ctx    = { cardLookupMap: new Map([['x', {}]]), apiMode: 'scryfall', lookupCard: lookup };
    const result = await parseDeckList('1 Forest\n1 Ghost Card', ctx);
    expect(result.lands).toHaveLength(1);
    expect(result.errors.some(e => e.includes('Ghost Card'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseDeckList — card categorisation
// ─────────────────────────────────────────────────────────────────────────────
describe('parseDeckList — card categorisation', () => {
  const cardMap = new Map([
    ['Forest',          FOREST_DATA],
    ['Island',          ISLAND_DATA],
    ['Llanowar Elves',  LLANOWAR_DATA],
    ['Sol Ring',        SOL_RING_DATA],
    ['Cultivate',       CULTIVATE_DATA],
    ['Dark Ritual',     DARK_RITUAL_DATA],
    ['Exploration',     EXPLORATION_DATA],
    ['Counterspell',    COUNTERSPELL_DATA],
  ]);

  const ctx = {
    cardLookupMap: new Map([['x', {}]]),
    apiMode: 'scryfall',
    lookupCard: makeLookup(cardMap),
  };

  it('routes a basic land to lands[]', async () => {
    const result = await parseDeckList('1 Forest', ctx);
    expect(result.lands).toHaveLength(1);
    expect(result.lands[0].isLand).toBe(true);
  });

  it('routes a mana creature to creatures[]', async () => {
    const result = await parseDeckList('1 Forest\n1 Llanowar Elves', ctx);
    expect(result.creatures).toHaveLength(1);
    expect(result.creatures[0].name).toBe('Llanowar Elves');
    expect(result.creatures[0].isManaCreature).toBe(true);
  });

  it('routes a mana artifact to artifacts[]', async () => {
    const result = await parseDeckList('1 Sol Ring', ctx);
    expect(result.artifacts).toHaveLength(1);
    expect(result.artifacts[0].name).toBe('Sol Ring');
    expect(result.artifacts[0].isManaArtifact).toBe(true);
  });

  it('routes a ramp spell to rampSpells[]', async () => {
    const result = await parseDeckList('1 Cultivate', ctx);
    expect(result.rampSpells).toHaveLength(1);
    expect(result.rampSpells[0].name).toBe('Cultivate');
    expect(result.rampSpells[0].isRampSpell).toBe(true);
  });

  it('routes a ritual to rituals[]', async () => {
    const result = await parseDeckList('1 Dark Ritual', ctx);
    expect(result.rituals).toHaveLength(1);
    expect(result.rituals[0].name).toBe('Dark Ritual');
    expect(result.rituals[0].isRitual).toBe(true);
  });

  it('routes an exploration effect to exploration[]', async () => {
    const result = await parseDeckList('1 Forest\n1 Exploration', ctx);
    expect(result.exploration).toHaveLength(1);
    expect(result.exploration[0].name).toBe('Exploration');
    expect(result.exploration[0].isExploration).toBe(true);
  });

  it('routes a generic spell to spells[]', async () => {
    const result = await parseDeckList('1 Counterspell', ctx);
    expect(result.spells).toHaveLength(1);
    expect(result.spells[0].name).toBe('Counterspell');
  });

  it('handles a mixed deck correctly', async () => {
    const deckText = [
      '2 Forest',
      '1 Island',
      '1 Llanowar Elves',
      '1 Sol Ring',
      '1 Cultivate',
      '1 Dark Ritual',
      '1 Exploration',
      '1 Counterspell',
    ].join('\n');

    const result = await parseDeckList(deckText, ctx);
    expect(result.lands).toHaveLength(2);           // Forest + Island
    expect(result.creatures).toHaveLength(1);
    expect(result.artifacts).toHaveLength(1);
    expect(result.rampSpells).toHaveLength(1);
    expect(result.rituals).toHaveLength(1);
    expect(result.exploration).toHaveLength(1);
    expect(result.spells).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseDeckList — MDFC with a land face
// ─────────────────────────────────────────────────────────────────────────────
describe('parseDeckList — MDFC with a land face', () => {
  it('adds the MDFC to lands[] and also adds a spell-side entry to spells[]', async () => {
    const cardMap = new Map([['Turntimber Symbiosis', TURNTIMBER_DATA]]);
    const ctx = {
      cardLookupMap: new Map([['x', {}]]),
      apiMode: 'scryfall',
      lookupCard: makeLookup(cardMap),
    };
    const result = await parseDeckList('1 Turntimber Symbiosis', ctx);
    expect(result.lands).toHaveLength(1);
    expect(result.spells.some(s => s.isMDFCSpellSide)).toBe(true);
  });

  it('MDFC spell-side entry preserves the card name', async () => {
    const cardMap = new Map([['Turntimber Symbiosis', TURNTIMBER_DATA]]);
    const ctx = {
      cardLookupMap: new Map([['x', {}]]),
      apiMode: 'scryfall',
      lookupCard: makeLookup(cardMap),
    };
    const result = await parseDeckList('2 Turntimber Symbiosis', ctx);
    const spellSide = result.spells.find(s => s.isMDFCSpellSide);
    expect(spellSide.name).toBe('Turntimber Symbiosis');
    expect(spellSide.quantity).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseDeckList — totalCards / landCount
// ─────────────────────────────────────────────────────────────────────────────
describe('parseDeckList — totalCards and landCount', () => {
  const cardMap = new Map([
    ['Forest', FOREST_DATA],
    ['Island', ISLAND_DATA],
    ['Sol Ring', SOL_RING_DATA],
    ['Counterspell', COUNTERSPELL_DATA],
  ]);
  const ctx = {
    cardLookupMap: new Map([['x', {}]]),
    apiMode: 'scryfall',
    lookupCard: makeLookup(cardMap),
  };

  it('totalCards sums quantities across all categories', async () => {
    const result = await parseDeckList('3 Forest\n2 Sol Ring\n1 Counterspell', ctx);
    expect(result.totalCards).toBe(6);
  });

  it('landCount counts only land quantities', async () => {
    const result = await parseDeckList('3 Forest\n2 Island\n1 Sol Ring', ctx);
    expect(result.landCount).toBe(5);
  });

  it('landCount is 0 when no lands are present', async () => {
    const result = await parseDeckList('1 Sol Ring\n1 Counterspell', ctx);
    expect(result.landCount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseDeckList — result shape
// ─────────────────────────────────────────────────────────────────────────────
describe('parseDeckList — result shape', () => {
  it('always includes all required keys', async () => {
    const lookup = makeLookup(new Map([['Forest', FOREST_DATA]]));
    const ctx = { cardLookupMap: new Map([['x', {}]]), apiMode: 'scryfall', lookupCard: lookup };
    const result = await parseDeckList('1 Forest', ctx);
    ['lands', 'artifacts', 'creatures', 'exploration', 'rituals', 'rampSpells', 'spells',
     'totalCards', 'landCount', 'errors'].forEach(key => {
      expect(result).toHaveProperty(key);
    });
  });

  it('errors is an empty array for a fully valid deck', async () => {
    const lookup = makeLookup(new Map([['Forest', FOREST_DATA]]));
    const ctx = { cardLookupMap: new Map([['x', {}]]), apiMode: 'scryfall', lookupCard: lookup };
    const result = await parseDeckList('4 Forest', ctx);
    expect(result.errors).toEqual([]);
  });

  it('returned card objects carry the correct quantity on each entry', async () => {
    const lookup = makeLookup(new Map([
      ['Forest', FOREST_DATA],
      ['Island', ISLAND_DATA],
    ]));
    const ctx = { cardLookupMap: new Map([['x', {}]]), apiMode: 'scryfall', lookupCard: lookup };
    const result = await parseDeckList('3 Forest\n2 Island', ctx);
    const forest = result.lands.find(c => c.name === 'Forest');
    const island = result.lands.find(c => c.name === 'Island');
    expect(forest.quantity).toBe(3);
    expect(island.quantity).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseDeckList — transform-land back face (null from processCardData)
// ─────────────────────────────────────────────────────────────────────────────
describe('parseDeckList — transform land (processCardData returns null)', () => {
  it('skips the card silently when processCardData returns null', async () => {
    // processLand returns null when the top-level type_line includes 'Land'
    // but the front face is NOT a land and the back face IS a land (transform layout).
    // The top-level type_line must include 'Land' so processCardData calls processLand.
    const transformCard = {
      name: 'Arguel\'s Blood Fast',
      type_line: 'Land',          // ← makes processCardData call processLand
      oracle_text: '',
      mana_cost: '',
      cmc: 0,
      layout: 'transform',
      card_faces: [
        { type_line: 'Enchantment', oracle_text: '' },  // front: not a land
        { type_line: 'Land',        oracle_text: '{T}: Add {B}.' },  // back: land
      ],
    };
    const cardMap = new Map([["Arguel's Blood Fast", transformCard]]);
    const ctx = {
      cardLookupMap: new Map([['x', {}]]),
      apiMode: 'scryfall',
      lookupCard: makeLookup(cardMap),
    };
    const result = await parseDeckList("1 Arguel's Blood Fast", ctx);
    // processCardData → processLand → returns null → card silently skipped
    expect(result.lands).toHaveLength(0);
    expect(result.spells).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
