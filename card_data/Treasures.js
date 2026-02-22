// Treasure-token generator data for the MTG Monte Carlo Simulator.
// These cards produce Treasure tokens that accumulate into a colorless mana pool
// usable for key-card casting (modelled alongside the burst mana pool).
//
// Fields (TREASURE_DATA):
//   staysOnBattlefield  – true  = permanent (creature/enchantment/artifact);
//                         false = instant or sorcery (goes to graveyard)
//   isOneTreasure       – true  = one-time effect (ETB or on-cast), generates
//                                  `treasuresProduced` tokens then stops;
//                         false = recurring engine, generates `avgTreasuresPerTurn`
//                                  per upkeep while on the battlefield.
//   treasuresProduced   – tokens produced immediately on cast/ETB (one-time cards)
//   avgTreasuresPerTurn – average tokens produced each turn cycle (recurring cards);
//                         may be fractional (Bernoulli trial used in the sim)
//   colors              – color identity array for display/filtering
//
// Default values are calibrated for 4-player Commander games.
// Users can override any card's amount in the Treasures panel.

export const TREASURE_DATA = new Map([
  // ── Per-Turn Enchantments ─────────────────────────────────────────────────
  // Generates a treasure each time an opponent draws a card (minus those who pay {1}).
  // In a 4-player game with ~2 draws per opponent each turn, ~50% pay → avg ≈ 2.5.
  [
    'smothering tithe',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 2.5,
      colors: ['W'],
    },
  ],

  // Creates a treasure whenever any non-token permanent an opponent controls
  // is put into a graveyard; roughly 1–2 per turn in active games.
  [
    'revel in riches',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['B'],
    },
  ],

  // Each connected land can tap for a treasure instead of mana each turn.
  // With a typical 7–8 lands by mid-game, controlled usage averages ~3/turn.
  [
    "bootleggers' stash",
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 3.0,
      colors: ['B', 'G'],
    },
  ],

  // Opponent's second spell each turn → 1 treasure; with 3 opponents casting ≥2
  // spells about half the time, averages ≈ 1.5/turn.
  [
    'monologue tax',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.5,
      colors: ['W'],
    },
  ],

  // Creates a treasure every time a nontoken creature an opponent controls dies.
  [
    'pitiless plunderer',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['B'],
    },
  ],

  // ── Per-Turn Creatures ────────────────────────────────────────────────────
  // Whenever you cast an instant or sorcery, creates a treasure.
  // In a typical spellslinger turn, ~1–2 spells → avg ≈ 1.5/turn.
  [
    'storm-kiln artist',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.5,
      colors: ['R'],
    },
  ],

  // End-step trigger: creates N treasures equal to the number of creatures
  // that died that turn. Generous estimate of ~1/turn.
  [
    'mahadi, emporium master',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['B', 'R'],
    },
  ],

  // Creates a treasure whenever it attacks or is targeted by a spell.
  // Counting one attack plus occasional targeting → avg ≈ 1/turn.
  [
    'goldspan dragon',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['R'],
    },
  ],

  // Whenever it deals combat damage to a player, creates a treasure.
  // Assuming it connects once per turn cycle → 1/turn.
  [
    'professional face-breaker',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['R'],
    },
  ],

  // Creates a treasure whenever a land enters the battlefield under your control.
  // Counts one land drop per turn → 1/turn.
  [
    'tireless provisioner',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['G'],
    },
  ],

  // Deals combat damage → exiles top card and creates a treasure.
  // Aggressive early creature; averages 1 hit per turn cycle → 1/turn.
  [
    'ragavan, nimble pilferer',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['R'],
    },
  ],

  // Tapping a Dwarf creates a treasure. In Dwarf-heavy decks ≥1/turn;
  // in generic decks often just 1 (Magda herself) → 1/turn default.
  [
    'magda, brazen outlaw',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['R'],
    },
  ],

  // Attacks and may loot; average generated via combat → 1/turn.
  [
    'hoarding ogre',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['R'],
    },
  ],

  // Whenever a nontoken artifact is put into a graveyard, creates a treasure.
  // Sparse artifact death → 1/turn conservative.
  [
    'gadrak, the crown-scourge',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['R'],
    },
  ],

  // Ninjutsu; when it deals combat damage creates a treasure.
  [
    'hoard robber',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['U', 'B'],
    },
  ],

  // ── Per-Turn Enchantment Auras ────────────────────────────────────────────
  // Whenever enchanted creature attacks, defending player creates a treasure
  // and the creature gets a bounty counter; roughly 1/turn when active.
  [
    'shiny impetus',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['R'],
    },
  ],

  // Whenever enchanted creature deals combat damage, you draw a card and
  // create a treasure; ~1/turn when the aura is live.
  [
    'sticky fingers',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['U', 'R'],
    },
  ],

  // ── Per-Turn Artifacts ────────────────────────────────────────────────────
  // Whenever you create one or more tokens, additionally create a Food, Treasure,
  // and Clue. At minimum doubles every treasure source → model as +1.5/turn bonus.
  [
    'academy manufactor',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.5,
      colors: [],
    },
  ],

  // Whenever you create a treasure, create an additional one.
  // Models as +1/turn (needs other treasure generators to be meaningful).
  [
    'xorn',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['R'],
    },
  ],

  // Scrys then after 3 activations transforms into a land that makes treasures;
  // modeled as 0.75/turn (delayed engine).
  [
    'treasure map // treasure cove',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 0.75,
      colors: [],
    },
  ],

  // ── Per-Turn Misc ─────────────────────────────────────────────────────────
  // End-step: create a treasure for each different mana value among creatures
  // you control that died. Averaged across board states → 1/turn.
  [
    'ziatora, the incinerator',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['B', 'R', 'G'],
    },
  ],

  // Pirate synergy; each pirate you cast creates a treasure.
  // In Pirate tribal → 2/turn; otherwise 0. Model at 1/turn (generic use).
  [
    'corsair captain',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['U', 'B'],
    },
  ],

  // Activatable: sac a creature to put +1/+1 counters or create a treasure.
  [
    'fain, the broker',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['B'],
    },
  ],

  // Activated ability: {1},{T}: create a treasure.
  [
    'jan jansen, chaos crafter',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['U', 'B', 'R'],
    },
  ],

  // Whenever an artifact enters the battlefield under your control,
  // create a treasure → ~1/turn in artifact-heavy decks.
  [
    'gleaming geardrake',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['U', 'R'],
    },
  ],

  // Whenever a player casts their second spell each turn, create a treasure.
  // In 4-player games this fires roughly 2/turn.
  [
    'trouble in pairs',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 2.0,
      colors: ['U'],
    },
  ],

  // Impulsive Pilferer: creature R. When it dies, creates a treasure.
  // When cast from hand, creates a treasure too. Models as 1 on ETB + 1 on death.
  // Conservative: 1.0 total over its lifetime → 0.5/turn averaged across 2 turns.
  [
    'impulsive pilferer',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 0.5,
      colors: ['R'],
    },
  ],

  // Whenever you sacrifice a permanent, create a treasure.
  // In sacrifice decks very high; generic → 0.5/turn.
  [
    'mayhem devil',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 0.5,
      colors: ['B', 'R'],
    },
  ],

  // For each opponent who attacks another opponent, create a treasure.
  // In multi-player this is reliable → 1.5/turn.
  [
    'disrupt decorum',
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 3,
      avgTreasuresPerTurn: 0,
      colors: ['R'],
    },
  ],

  // ── One-Time ETB Permanents ───────────────────────────────────────────────
  // ETB: create a treasure for each artifact and enchantment your opponents control.
  // Average: ~5 (conservative, opponents have ~2–3 each).
  [
    'dockside extortionist',
    {
      staysOnBattlefield: true,
      isOneTreasure: true,
      treasuresProduced: 5,
      avgTreasuresPerTurn: 0,
      colors: ['R'],
    },
  ],

  // ETB: create 1 treasure.
  [
    'kalain, reclusive painter',
    {
      staysOnBattlefield: true,
      isOneTreasure: true,
      treasuresProduced: 1,
      avgTreasuresPerTurn: 0,
      colors: ['B', 'R'],
    },
  ],

  // ETB: create 1 treasure (when entering, scry 1 and make a treasure).
  [
    'cursed mirror',
    {
      staysOnBattlefield: true,
      isOneTreasure: true,
      treasuresProduced: 1,
      avgTreasuresPerTurn: 0,
      colors: [],
    },
  ],

  // ETB: create 1 treasure.
  [
    "proft's eidolon",
    {
      staysOnBattlefield: true,
      isOneTreasure: true,
      treasuresProduced: 1,
      avgTreasuresPerTurn: 0,
      colors: ['W', 'U'],
    },
  ],

  // ETB and activate: scry, then transform into Treasure Cove which makes treasures.
  // Modeled as one-time 3 (after flipping, modeled separately above as per-turn).
  [
    'glittering stockpile',
    {
      staysOnBattlefield: true,
      isOneTreasure: true,
      treasuresProduced: 1,
      avgTreasuresPerTurn: 0,
      colors: ['R'],
    },
  ],

  // ── One-Time Instants & Sorceries ────────────────────────────────────────
  // Draw 2 cards and create 2 Treasures. Net 2 treasures.
  [
    'deadly dispute',
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 2,
      avgTreasuresPerTurn: 0,
      colors: ['B'],
    },
  ],

  // Discard 2 cards, then draw 2 cards and create 2 Treasures.
  [
    "pirate's pillage",
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 2,
      avgTreasuresPerTurn: 0,
      colors: ['R'],
    },
  ],

  // Create a Treasure for each land you control. With 7 lands by mid-game → 7.
  // Using a conservative 7 as default.
  [
    "brass's bounty",
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 7,
      avgTreasuresPerTurn: 0,
      colors: ['R'],
    },
  ],

  // Draw 2 cards and create 2 Treasures.
  [
    "pirate's prize",
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 2,
      avgTreasuresPerTurn: 0,
      colors: ['U'],
    },
  ],

  // Counter target spell. Create X Treasure tokens, where X is that spell's mana value.
  // Average countered spell CMC ~4–5 → model as 4.
  [
    'spell swindle',
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 4,
      avgTreasuresPerTurn: 0,
      colors: ['U'],
    },
  ],

  // Draw 2 discard 2 create 2 treasures (net 2 treasures).
  [
    'unexpected windfall',
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 2,
      avgTreasuresPerTurn: 0,
      colors: ['R'],
    },
  ],

  // Discard then draw equal + 2 treasures.
  [
    'seize the spoils',
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 2,
      avgTreasuresPerTurn: 0,
      colors: ['R'],
    },
  ],

  // Create 3 Treasures. Simple.
  [
    'inspired tinkering',
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 3,
      avgTreasuresPerTurn: 0,
      colors: ['R'],
    },
  ],

  // Draw 2, choose creature/land to leave in library, rest to graveyard, then create 2 treasures.
  [
    'plunder the graves',
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 2,
      avgTreasuresPerTurn: 0,
      colors: ['B', 'G'],
    },
  ],

  // Create 2 treasures and draw a card.
  [
    'you find some cash',
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 2,
      avgTreasuresPerTurn: 0,
      colors: ['R'],
    },
  ],

  // Whenever a player casts an instant or sorcery, put a verse counter on this,
  // then create that many treasures when it leaves. Model as cumulative but simplified:
  // ETB 0 + delayed ~3 total over 3 turns → model as one-time ETB 3 for simplicity.
  [
    'goldvein hydra',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['C'],
    },
  ],

  // Exile top X cards where X is the number of players that have drawn a card this turn.
  // Creates 2 treasures as part of effect. Model as 2.
  [
    'confiscation coup',
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 2,
      avgTreasuresPerTurn: 0,
      colors: ['U'],
    },
  ],

  // Sorcery: each opponent creates 3 treasures. You get nothing directly.
  // Not a treasure generator for you → skip. Replace with:
  // Shimmer Dragon — no
  // Vault of the Archangel — no

  // Whenever a land you control is put into a graveyard, create a Treasure.
  // Fetchlands trigger this; ~1/turn with fetches.
  [
    'titania, protector of argoth',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 0.5,
      colors: ['G'],
    },
  ],

  // Storm: creates X treasures = storm count. In storm decks ~5; conservative = 3.
  [
    'loot the store',
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 3,
      avgTreasuresPerTurn: 0,
      colors: ['R'],
    },
  ],

  // Creates 3 treasures and creates a token that makes more treasure.
  [
    'crime // punishment',
    {
      staysOnBattlefield: false,
      isOneTreasure: true,
      treasuresProduced: 3,
      avgTreasuresPerTurn: 0,
      colors: ['B', 'G'],
    },
  ],

  // Gala Greeters: whenever an opponent's creature or planeswalker enters,
  // you may create a treasure. ~1/turn in multiplayer.
  [
    'gala greeters',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['G'],
    },
  ],

  // Whenever you cast a spell with mana value ≥ 5, create 2 treasures.
  // ~1 big spell per turn in high-CMC decks → 2/turn; conservative 1/turn.
  [
    'marionette master',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['B'],
    },
  ],

  // Whenever an opponent draws a card, you may pay {1}. If you don't, each
  // opponent creates a clue. (Not treasure for you directly.) Replace:
  // Captain Lannery Storm: creature RR, whenever it attacks create a treasure.
  [
    'captain lannery storm',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.0,
      colors: ['R'],
    },
  ],

  // Whenever a spell or ability an opponent controls targets you or a permanent
  // you control, create a Treasure. ~1/turn in interactive pods.
  [
    'hullbreacher',
    {
      staysOnBattlefield: true,
      isOneTreasure: false,
      treasuresProduced: 0,
      avgTreasuresPerTurn: 1.5,
      colors: ['U'],
    },
  ],
]);
