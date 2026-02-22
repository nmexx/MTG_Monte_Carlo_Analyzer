// Ramp spell behavioral data for the MTG Monte Carlo Simulator.
// Each entry maps a lowercase spell name → search/land-placement parameters.
//
// fetchFilter values:
//   'any'     – any land card
//   'basic'   – basic land cards only
//   'subtype' – land must have at least one of fetchSubtypes (basic OR non-basic dual)
//   'snow'    – snow land cards
//
// Fields:
//   landsToAdd     – number of lands put onto the battlefield
//   landsTapped    – whether the fetched land(s) enter tapped
//   landsToHand    – number of lands put into hand (e.g. Cultivate)
//   sacrificeLand  – true if a land must be sacrificed to cast (e.g. Harrow)
//   fetchFilter    – search restriction type (see above)
//   fetchSubtypes  – required basic land subtypes (only used when fetchFilter = 'subtype')

export const RAMP_SPELL_DATA = new Map([
  // ── 2-CMC: fetch 1 Forest subtype (untapped) ─────────────────────────────
  [
    "nature's lore",
    {
      landsToAdd: 1,
      landsTapped: false,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Forest'],
    },
  ],
  [
    'three visits',
    {
      landsToAdd: 1,
      landsTapped: false,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Forest'],
    },
  ],

  // ── 2-CMC: Farseek – Plains/Island/Swamp/Mountain subtypes (tapped) ──────
  [
    'farseek',
    {
      landsToAdd: 1,
      landsTapped: true,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Plains', 'Island', 'Swamp', 'Mountain'],
    },
  ],

  // ── 2-CMC: basic land only (tapped) ──────────────────────────────────────
  [
    'rampant growth',
    {
      landsToAdd: 1,
      landsTapped: true,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'basic',
    },
  ],
  [
    'edge of autumn',
    {
      landsToAdd: 1,
      landsTapped: true,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'basic',
    },
  ],

  // ── 2-CMC: snow land ─────────────────────────────────────────────────────
  [
    'into the north',
    { landsToAdd: 1, landsTapped: true, landsToHand: 0, sacrificeLand: false, fetchFilter: 'snow' },
  ],

  // ── 2-CMC: any land, scalable X spell (treated as 2 for default) ─────────
  [
    'open the way',
    { landsToAdd: 2, landsTapped: true, landsToHand: 0, sacrificeLand: false, fetchFilter: 'any' },
  ],

  // ── 3-CMC: basic to battlefield (tapped) + basic to hand ─────────────────
  [
    'cultivate',
    {
      landsToAdd: 1,
      landsTapped: true,
      landsToHand: 1,
      sacrificeLand: false,
      fetchFilter: 'basic',
    },
  ],
  [
    "kodama's reach",
    {
      landsToAdd: 1,
      landsTapped: true,
      landsToHand: 1,
      sacrificeLand: false,
      fetchFilter: 'basic',
    },
  ],

  // ── 3-CMC: sacrifice a land, fetch 2 basics ───────────────────────────────
  [
    'harrow',
    {
      landsToAdd: 2,
      landsTapped: false,
      landsToHand: 0,
      sacrificeLand: true,
      fetchFilter: 'basic',
    },
  ],
  [
    'roiling regrowth',
    { landsToAdd: 2, landsTapped: true, landsToHand: 0, sacrificeLand: true, fetchFilter: 'basic' },
  ],
  [
    'entish restoration',
    { landsToAdd: 2, landsTapped: true, landsToHand: 0, sacrificeLand: true, fetchFilter: 'basic' },
  ],

  // ── 3-CMC: Archdruid's Charm – fetch any Forest subtype (tapped) ─────────
  [
    "archdruid's charm",
    {
      landsToAdd: 1,
      landsTapped: true,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Forest'],
    },
  ],

  // ── 4-CMC: Skyshroud Claim – 2 Forest subtypes (untapped) ────────────────
  [
    'skyshroud claim',
    {
      landsToAdd: 2,
      landsTapped: false,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Forest'],
    },
  ],

  // ── 4-CMC: 2 basic lands (tapped) ────────────────────────────────────────
  [
    'explosive vegetation',
    {
      landsToAdd: 2,
      landsTapped: true,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'basic',
    },
  ],
  [
    'migration path',
    {
      landsToAdd: 2,
      landsTapped: true,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'basic',
    },
  ],

  // ── 5-CMC: any 2 lands (tapped) ──────────────────────────────────────────
  [
    'hour of promise',
    { landsToAdd: 2, landsTapped: true, landsToHand: 0, sacrificeLand: false, fetchFilter: 'any' },
  ],

  // ── 5-CMC: Traverse the Outlands – basics (X = greatest power, floor 3) ──
  [
    'traverse the outlands',
    {
      landsToAdd: 3,
      landsTapped: true,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'basic',
    },
  ],

  // ── 7-CMC: Boundless Realms – basics ──────────────────────────────────────
  [
    'boundless realms',
    {
      landsToAdd: 4,
      landsTapped: true,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'basic',
    },
  ],

  // ── 9-CMC: Reshape the Earth – any 10 land cards ─────────────────────────
  [
    'reshape the earth',
    { landsToAdd: 10, landsTapped: true, landsToHand: 0, sacrificeLand: false, fetchFilter: 'any' },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // White catch-up ramp
  // These cards are typically played as soon as available since they help
  // catch up on lands when behind. fetchSubtypes: ['Plains'] means they can
  // fetch any land with the Plains subtype (basics + duals/shocks with Plains).
  // ─────────────────────────────────────────────────────────────────────────

  // ── 1-CMC: Tithe – Plains to hand (instant, catches opponent land lead) ──
  [
    'tithe',
    {
      landsToAdd: 0,
      landsTapped: false,
      landsToHand: 1,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Plains'],
    },
  ],

  // ── 1-CMC: Land Tax – up to 3 basics to hand each upkeep ─────────────────
  // Modelled as a one-shot fetch of 3 basics on the turn it enters.
  [
    'land tax',
    {
      landsToAdd: 0,
      landsTapped: false,
      landsToHand: 3,
      sacrificeLand: false,
      fetchFilter: 'basic',
      staysOnBattlefield: true,
    },
  ],

  // ── 1-CMC: Weathered Wayfarer – any land to hand (activated ability {W}) ─
  // Activation cost modelled as 1 additional generic mana (simplified from {W}).
  [
    'weathered wayfarer',
    {
      landsToAdd: 0,
      landsTapped: false,
      landsToHand: 1,
      sacrificeLand: false,
      fetchFilter: 'any',
      staysOnBattlefield: true,
      activationCost: 1,
    },
  ],

  // ── 2-CMC: Gift of Estates – up to 3 Plains to hand ─────────────────────
  [
    'gift of estates',
    {
      landsToAdd: 0,
      landsTapped: false,
      landsToHand: 3,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Plains'],
    },
  ],

  // ── 2-CMC: Knight of the White Orchid – Plains to battlefield untapped ───
  // Creature; uses staysOnBattlefield since it doesn't go to the graveyard.
  [
    'knight of the white orchid',
    {
      landsToAdd: 1,
      landsTapped: false,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Plains'],
      staysOnBattlefield: true,
    },
  ],

  // ── 2-CMC: Loyal Warhound – Plains to battlefield untapped (ETB) ─────────
  [
    'loyal warhound',
    {
      landsToAdd: 1,
      landsTapped: false,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Plains'],
      staysOnBattlefield: true,
    },
  ],

  // ── 2-CMC: Oreskos Explorer – Plains to hand equal to land gap ───────────
  // In a 4-player game the gap is often 2; modelled as 2 Plains to hand.
  [
    'oreskos explorer',
    {
      landsToAdd: 0,
      landsTapped: false,
      landsToHand: 2,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Plains'],
      staysOnBattlefield: true,
    },
  ],

  // ── 2-CMC: Boreas Charger – Plains to hand equal to land gap ─────────────
  [
    'boreas charger',
    {
      landsToAdd: 0,
      landsTapped: false,
      landsToHand: 2,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Plains'],
      staysOnBattlefield: true,
    },
  ],

  // ── 4-CMC: Archaeomancer's Map – 2 Plains to hand (ETB), stays on field ──
  [
    "archaeomancer's map",
    {
      landsToAdd: 0,
      landsTapped: false,
      landsToHand: 2,
      sacrificeLand: false,
      fetchFilter: 'subtype',
      fetchSubtypes: ['Plains'],
      staysOnBattlefield: true,
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // Colorless ramp
  // These cards cost no colored mana to cast and fit in any deck.
  // ─────────────────────────────────────────────────────────────────────────

  // ── 1-CMC: Wayfarer's Bauble – basic land tapped (activated ability {2}) ─
  // The activation cost of {2} + tap + sacrifice is checked before using it.
  // Total mana needed = cast {1} + activate {2} = 3 generic mana.
  [
    "wayfarer's bauble",
    {
      landsToAdd: 1,
      landsTapped: true,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'basic',
      activationCost: 2,
    },
  ],

  // ── 4-CMC: Solemn Simulacrum – basic land tapped (ETB), creature stays ───
  [
    'solemn simulacrum',
    {
      landsToAdd: 1,
      landsTapped: true,
      landsToHand: 0,
      sacrificeLand: false,
      fetchFilter: 'basic',
      staysOnBattlefield: true,
    },
  ],
]);
