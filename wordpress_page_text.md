# MTG Monte Carlo Mana Analyzer — How It Works

## What Is This Tool?

The MTG Monte Carlo Mana Analyzer is a statistical simulation engine for Magic: The Gathering decks. You paste in a decklist, configure a few options, and the tool runs thousands of randomized games to tell you exactly how reliably your mana base performs — turn by turn — including average lands in play, untapped mana, color availability, life-loss from pain sources, and how consistently you can cast specific key cards on curve.

---

## How the Simulation Works

Each "iteration" is a full simulated game from opening hand through a chosen number of turns (configurable, default 7). The engine runs up to **10,000 iterations** by default, making every reported percentage statistically robust.

### A Single Game, Step by Step

Each turn of each simulated game follows this exact sequence:

1. **Untap** — all permanents on the battlefield (lands, mana rocks, creatures) untap. Summoning sickness is removed.
2. **Upkeep** — Mana Vault damage is applied if it is still tapped.
3. **Draw** — one card is drawn (or skipped on Turn 1 unless Commander Mode is enabled).
4. **Play a Land** — the best available land from hand is selected and played (see Land Priority below).
5. **Cast Exploration Effects** — if Exploration-type permanents can be cast with available mana, they are played immediately.
6. **Additional Land Drops** — if an Exploration effect is in play, extra land drops are taken up to the maximum allowed.
7. **Activate Fetch Lands** — fetch lands already on the battlefield are cracked, and the best possible land is retrieved from the library (see Fetch Priority below).
8. **Cast Spells** — mana-producing permanents and ramp spells are cast from hand (see Spell Casting Priority below).
9. **Life-loss accounting** — Ancient Tomb, Mana Crypt (averaged), Starting Town, and shock-land payments are tracked.

---

## Card Categories

The analyzer recognizes the following categories of cards and handles each with dedicated logic:

| Category | Examples | Role in Simulation |
|---|---|---|
| **Lands** | Basic lands, dual lands, fetches, shocks, checks, bounces | Primary mana sources; enter tapped or untapped based on board state |
| **Mana Artifacts (Rocks)** | Sol Ring, Arcane Signet, Mox Diamond, Mana Vault | Played in Phase 1 of spell-casting; produce mana from Turn 1 |
| **Mana Creatures (Dorks)** | Llanowar Elves, Birds of Paradise, Selvala | Played in Phase 1; affected by summoning sickness (produce mana the turn *after* they are cast) |
| **Exploration Effects** | Exploration, Burgeoning, Azusa, Oracle of Mul Daya | Allow extra land drops per turn; cast immediately after first land |
| **Ramp Spells** | Cultivate, Kodama's Reach, Farseek, Harrow | Fetch additional lands from the library directly to the battlefield or hand |
| **Rituals** | Dark Ritual, Cabal Ritual, Pyretic Ritual | Provide "burst" mana that counts toward key-card playability in the same turn |

Each category can be individually **included or excluded** from the simulation, and individual cards within a category can be toggled off.

---

## Land Handling — Detailed Logic

### Which Land Gets Played Each Turn?

The engine uses the following priority order when choosing a land from hand:

1. **Fetch lands first** — if there are enough untapped mana sources to pay the fetch cost, a fetch is preferred so the library is thinned and the best possible land enters play.
2. **Untapped non-bounce lands** — any land that enters the battlefield untapped (and isn't a bounce land) is next in priority.
3. **Bounce lands** — lands like Azorius Chancery that return another land to hand; only played if a non-bounce land is already on the battlefield to return.
4. **Any remaining land** — tapped lands are played last as a fallback.

### When Does a Land Enter Tapped?

The simulation models conditional "enters tapped" rules for every major land cycle:

| Land Type | Tapped Condition |
|---|---|
| **Shock lands** (e.g., Hallowed Fountain) | Always enter tapped *unless* you pay 2 life — the sim always pays to untap them on turns 1–6 |
| **Check lands** (e.g., Glacial Fortress) | Enter tapped if no matching basic land subtype is already on the battlefield |
| **Fast lands** (e.g., Seachrome Coast) | Enter tapped if you already control more than 2 lands |
| **Battle lands** (e.g., Prairie Stream) | Enter tapped if you control fewer than 2 basic lands |
| **Bounce lands** (e.g., Azorius Chancery) | Always enter tapped |
| **Crowd lands** (e.g., Spire of Industry) | Enter tapped in non-Commander mode, untapped in Commander mode |
| **Filter lands, Pain lands, Utility lands** | Always enter untapped |
| **Hideaway fetch lands** | Enter tapped; immediately sacrificed to put a basic land into play tapped |
| **City of Traitors** | Sacrificed automatically when the next land is played |

### Fetch Land Targeting — Smart Land Selection

When a fetch land is cracked, the engine scores every eligible land in the library and picks the best target using this logic:

- **+300 points** for producing a color that key cards need but the current mana base doesn't yet provide.
- **+1,000 points** for a dual land on turns 1–2 (maximizing early colour fixing).
- **+100 points** for producing two or more colors.
- **+250 points per additional missing color** the land covers.
- **−100 points** for shock lands on turn 6 or later (avoid life loss when ahead on mana).

---

## Spell Casting Priority

The casting phase runs in two separate passes each turn:

### Pass 1 — Mana-Producing Permanents

Mana rocks, mana creatures, and exploration effects are cast first, in this priority:

1. **Mox-priority artifacts** (zero-cost rocks like Mox Diamond, Chrome Mox, Mox Opal) are cast before anything else, regardless of CMC.
2. The remaining castable permanents are sorted **cheapest CMC first** so the engine maximizes the number of permanents deployed.
3. The engine loops until no more castable permanents remain in hand.

**ETB costs are handled automatically:**
- *Mox Diamond* — the engine discards a land from hand (preferring a tapped land first).
- *Chrome Mox* — the engine imprints the first non-land card in hand.
- *Channel / Necropotence style effects* (discard hand) — the remaining hand is sent to the graveyard.
- *Metalcraft conditions* — only produces mana once 3 artifacts are in play (simplified after turn 2).
- *Mox Amber* — only produces mana if a legendary permanent is on the battlefield.

### Pass 2 — Ramp Spells

After all mana-producing permanents have been deployed, ramp spells are cast cheapest-first:

- The engine verifies the library contains at least one valid target land before spending resources.
- Lands found by ramp spells enter tapped or untapped as specified by the spell (e.g., Cultivate lands enter tapped; Harrow lands enter untapped).
- Spells that sacrifice a land (Harrow, Reap and Sow) preferentially sacrifice a basic land, then a non-bounce dual, then a bounce land.

---

## Mulligan Logic

Mulligans can be enabled with two rule sets (**London** or **Vancouver**) and four strategies:

| Strategy | Behaviour |
|---|---|
| **Conservative** | Mulligans only 0-land or 7-land hands |
| **Balanced** | Mulligans 0 or 7 land hands; also mulligans hands with < 2 or > 5 lands if they contain no playable 2-drops |
| **Aggressive** | Mulligans any hand with fewer than 2 or more than 4 lands |
| **Custom** | Fully configurable thresholds — set minimum/maximum land counts, whether to mulligan hands with no plays by a certain turn, etc. |

Under the **London Mulligan**, 7 cards are always drawn, then cards are cut from the top. The engine automatically keeps lands when the hand has too few, or removes lands when the hand has too many, to make sensible bottom choices.

---

## Key Card Playability

You can mark any spell in your deck as a "key card." The simulation then tracks, for each turn, in what percentage of games you have enough mana — of the right colors — to cast that card.

Two numbers are reported:
- **Sustained mana** — mana available from untapped lands and permanents that will still be in play (does not count single-use burst sources).
- **Burst mana** — counts ritual effects, sacrifice abilities, and other one-shot mana spikes, representing the absolute maximum mana available in that turn.

---

## Life Loss Tracking

The simulation tracks cumulative life loss from every source:

- **Shock lands** — 2 life each time the engine pays to untap one.
- **Fetch lands (classic)** — 1 life per activation.
- **Ancient Tomb** — 2 life per upkeep (every turn it is on the battlefield).
- **Mana Crypt** — 1.5 life per turn (statistical average of the coin-flip effect).
- **Starting Town** — 1 life per upkeep.
- **Mana Vault** — 1 damage per upkeep when tapped.

---

## Commander Mode

Enabling Commander Mode changes two things:
1. **You draw a card on Turn 1** (reflecting the Commander format's rule that the starting player draws).
2. **Crowd lands** (e.g., Spire of Industry, Mana Confluence) enter the battlefield untapped, since multiplayer games reliably satisfy their "two or more opponents" condition.

---

## Key Assumptions & Limitations

Understanding what the simulation does *not* model is just as important as knowing what it does:

- **No opponent interaction.** Counterspells, hand disruption, land destruction, and permanent removal are not simulated. All permanents you play stay in play.
- **No combat.** Creatures are treated purely as mana sources. Their power, toughness, and combat abilities are irrelevant.
- **Greedy optimal play.** The engine always plays the best land and the cheapest mana-positive spell available. It never "sandbags" a spell for political or strategic reasons.
- **No card draw spells modeled.** Sorceries and instants that draw cards are not cast. Only permanents that produce mana are deployed.
- **Rituals are single-use.** Ritual mana counts toward key card playability in the turn the ritual is cast, but it does not accumulate — it is spent immediately.
- **No graveyard recursion.** Once a card is in the graveyard it stays there.
- **Opening hand is 7 cards** (adjustable). The simulation does not model game-start effects like free spells or special opening hand rules beyond the mulligan settings.
- **Color requirements are checked strictly.** A card requiring {W}{W} will only register as castable if the mana base produces at least two white sources that turn.

---

*Built with JavaScript + React + Vite. Simulation engine is fully deterministic-seeded per iteration, making results reproducible across runs with the same settings.*
