# MTG Monte Carlo Analyzer — Planned Improvements

> **Complexity key** (unimplemented items only)
> `[Low]` — isolated change, ≤ ~50 lines, no new data structures
> `[Medium]` — touches 2–4 files, new logic or UI component required
> `[High]` — cross-cutting change, new architecture or significant new state
> `[Very High]` — multi-session effort, requires new subsystem or major refactor

---

## Performance / Architecture

1. **Move simulation to a Web Worker** --------DONE (v3.2.0)
   - The `monteCarlo` loop now runs in a dedicated ES-module Web Worker (`src/simulation/simulationWorker.js`).
   - Sets in the config are serialised to arrays before `postMessage` and rehydrated inside the Worker.
   - The Worker posts `PROGRESS` messages every 250 iterations; `App.jsx` updates a `simProgress` state variable, driving a live percentage and animated progress bar in the overlay.
   - In comparison mode, Deck A fills 0→50% and Deck B fills 50→100%.
   - The `flushSync` + `setTimeout(0)` workaround has been removed; the Worker unblocks the main thread entirely so the overlay renders immediately.

2. **Split App.jsx into modules** --------DONE
   - The file is 4000+ lines and mixes simulation engine, data processing, and UI.
   - Extract: `SimulationEngine.js`, `DeckParser.js`, and separate panel components (`LandsPanel`, `ResultsPanel`, `SequencesPanel`, etc.)

3. **`useMemo`/`useCallback` for expensive recalculations** --------DONE (v3.1.5)
   - `prepareChartData()` is memoized with `useMemo` in `App.jsx`.
   - `handleParseDeck`, `handleShareUrl`, `exportResultsAsPNG`, and `exportResultsAsCSV` are wrapped in `useCallback`.
   - `DeckPanels` and `ComparisonPanelGrid` use `useMemo(() => makeSlotSetter(setSlot), [setSlot])` so setter functions are stable across re-renders.
   - **Architecture** (v3.1.5): `App.jsx` refactored 1648 → 777 lines by extracting:
     - `src/hooks/useDeckSlot.js` — all per-deck mutable state + `defaultDeckSlot` / `serializeDeckSlot` / `makeSlotSetter`
     - `src/hooks/useCardLookup.js` — file upload, Scryfall API fallback, rate-limit counters
     - `src/components/DeckPanels.jsx` — the full single-deck panel stack (Lands → Key Cards)
     - `src/components/ComparisonPanelGrid.jsx` — all `ComparisonRow` instances for comparison mode
   - `buildPersistableState()` helper consolidates the previously duplicated localStorage / URL-hash payload.
   - Duplicate `💎` emoji on Cost Reducers section header replaced with `⚗️`.

3b. **`simulationCore.js` internal refactor** --------DONE (v3.1.6)
   - **`parseColorPips(manaCost)`** private helper — single source of truth for extracting colored-pip arrays from mana cost strings; previously the same `/\{([^}]+)\}/g` regex + filter was copy-pasted in `tapManaSources`, `canPlayCard`, `findBestLandToFetch`, and `playLand`.
   - **`getAllSpells(parsedDeck)`** private helper — canonical flat-array of all non-land cards across the three deck buckets; replaces inline spread-and-concat in `findBestLandToFetch` and Thriving Land ETB logic in `playLand`.
   - **`PAIN_LAND_ACTIVE_TURNS = 5`** module constant — documents and centralises the `turn <= 5` cutoff used by `calculateBattlefieldDamage` for pain lands, horizon lands, and talismans.
   - **`selectBestLand` signature tightened** — removed the `_library` and `_turn` parameters; both were prefixed `_` because they were never read inside the function body. Call sites in `monteCarlo.js` updated accordingly.
   - **`castSpells` gameState object** — signature changed from nine positional args to `castSpells({ hand, battlefield, graveyard, library, turnLog }, turn, simConfig)`. The two previously unused positional args (`keyCardNames`, `parsedDeck`) were removed. All call sites in `monteCarlo.js` and the full test suite updated.
   - **`castSpells` consolidated `simConfig` destructure** — `includeTreasures` / `disabledTreasures` are now extracted at the top of the function alongside the other five include/disabled pairs, eliminating the duplicate destructure that was buried inside Phase 4.
   - **`_runCastingLoop` private helper** — the `while (changed) { … for (spell of candidates) { … break; } }` skeleton was identical across all five `castSpells` phases. The shared loop is now a named helper; each phase contributes only its own candidate filter and cast callback, recovering ~100 lines of structural duplication.
   - **`calculateManaAvailability` named inner functions** — the Shadowmoor and Odyssey filter-land second passes are extracted as named inner functions `_applyFilterLands()` and `_applyOdysseyFilterLands()`, making the main function body a readable orchestrator.
   - **`doesLandEnterTapped` / `playLand` contract clarified** — JSDoc updated to document the two-step shock/MDFC land contract: `doesLandEnterTapped` returns the *default* tapped state before life-payment override; `playLand` is the sole authority that decides whether to pay life and force the land in untapped.

3c. **`monteCarlo.js` internal refactor** --------DONE (v3.1.7)
   - **`cumulativeTreasures` scope fixed** — the variable was declared *inside* the turn loop, resetting to 0 every turn. Moved to the same scope as `cumulativeLifeLoss` so it correctly accumulates across the simulation.
   - **`allPlayableCards` completeness fix** — `costReducers`, `rituals`, and `treasureCards` were missing from the array used to build `keyCardMap`. Any key card in those categories would show 0% playability. All three category arrays now included.
   - **Phase 2 exploration cost discount** — `calculateCostDiscount` was not called for exploration cards during Phase 2 casting. Cost-reducer permanents already on the battlefield were therefore ignored when determining whether an exploration spell could be played. Now calls `calculateCostDiscount(expl, battlefield)` and passes the result to both `canPlayCard` and `tapManaSources`.
   - **Flatten `buildCompleteDeck` override chain** — the four `applyXOverrides()` calls were nested four levels deep. Refactored to sequential `let d = …; d = …; return …;` assignments for readability.
   - **`appendLifeLoss` helper** — the identical three-line life-loss log suffix block (`if (ll > 0) { last.includes('Cannot play') … }`) was copy-pasted in Phase 1 and Phase 4 of the main turn loop. Extracted to a named top-level helper.
   - **`emptyPerTurn` helper** — `Array(n).fill(null).map(() => [])` appeared 6× in the `results` initialisation object. Replaced with a one-line `emptyPerTurn(n)` helper.
   - **`castSpells` return value** — `castSpells` now returns `{ cardsDrawn, treasuresProduced }` instead of mutating `simConfig.drawTracker` / `simConfig.treasureTracker` side-channel objects. `monteCarlo.js` destructures the return value directly; the tracker setup lines have been removed.
   - **Guard burst mana computation** — the burst-mana block (filter hand for `BURST_MANA_SOURCES`, reduce rituals, build `burstColorBonus`, construct `manaWithBurst`) ran unconditionally on every turn of every iteration even when the deck contained no burst cards (`results.hasBurstCards = false`). Wrapped in `if (results.hasBurstCards) { … }` with `burstInHand`, `ritualsInHand`, and `manaWithBurst` declared outside so the key-card playability block retains access.
   - **Remove redundant flood/screw length guards** — `results.landsPerTurn[floodTurnIdx].length > 0` was checked before computing flood/screw rates, but `landsPerTurn[t]` is always populated (one entry per iteration) after the main loop completes. Guards removed.

3d. **`cardProcessors.js` internal refactor** --------DONE (v3.1.8)
   - **`extractManaProduction` uses `Set`** — the `!produces.includes(color)` dedup guard inside a `forEach` was O(n²). Replaced the array accumulator with a `Set`; the `any color` early-return is also hoisted before the regex so it short-circuits immediately.
   - **`processLand` mana production delegates to `extractManaProduction`** — the `{T}: Add` block inside `processLand` duplicated the same regex + `any color` logic already encapsulated in `extractManaProduction`. Replaced the ~10-line inline block with a single `extractManaProduction(oracleText)` call.
   - **Remove 7 dead `entersTappedAlways` branches in `processLand`** — `PAIN_LANDS`, `FIVE_COLOR_PAIN_LANDS`, `FILTER_LANDS`, `HORIZON_LANDS`, `UTILITY_LANDS_UNTAPPED`, `ODYSSEY_FILTER_LANDS`, and `MDFC_LANDS` all assigned `entersTappedAlways = false`, which is already the variable's initial value. Removed all seven no-op branches (18-arm chain → 11 arms); added a comment explaining that those land types are handled dynamically by `doesLandEnterTapped` / `playLand`.
   - **`processExploration` Azusa check fixed** — `cardName.includes('azusa')` was a substring match that would mis-fire for any future card containing "azusa" in its name. Changed to an exact equality check: `cardName === 'azusa, lost but seeking'`.
   - **`resolveCardFaceFields` helper extracted** — the identical 6-line block that patches `cmc`, `manaCost`, `oracleText`, `typeLine` from `card_faces[0]` was copy-pasted in both `processCostReducer` and `processSpell`. Extracted to a single private `resolveCardFaceFields(data)` helper; both functions now destructure its return value.
   - **`processCardData` hoists `resolvedOracle` / `resolvedTypeLine`** — `data.type_line || frontFace.type_line` was computed twice (for `isCreature` and `isArtifact`) and then repeated again at the bottom for the oracle-fallback block. Both values are now declared once after the land early-return and reused throughout the function.

---

## Missing Features

4. **Deck Comparison Mode (A/B)** --------DONE
   - Multiple `// comparison mode` placeholder comments already exist throughout the file.
   - Run two decks side-by-side with diff'd charts — the largest incomplete feature.

5. **Mana Curve Chart** --------DONE
   - No CMC distribution chart exists.
   - Show spells grouped by CMC (standard deckbuilding metric); trivially added with existing Recharts infrastructure.

6. **"First playable by turn X" summary table** --------DONE
   - Table below the Key Cards chart showing the earliest turn each card crosses 50%, 80%, and 95% cumulative playability.
   - Pure display addition; reads directly from the existing `keyCardPlayability` per-turn arrays.

7. **Standard deviation bands on charts** --------DONE
   - Only averages are currently reported.
   - Adding ± std. deviation to the lands/mana charts would show consistency vs. raw average.

8. **On-Play vs. On-Draw toggle** `[Low]`
   - Non-commander mode already skips the draw on turn 0 (on the play).
   - An explicit toggle would let users measure the concrete impact of going second.

9. **LocalStorage deck persistence** --------DONE
   - The deck text and all settings are lost on page refresh.
   - Saving to `localStorage` is a quick, high-value UX improvement.

---

## Simulation Accuracy

10. **Color pip reliability analysis** --------DONE
    - `canPlayCard` checks total mana and single-pip counts but doesn't account for competing demands across the same mana sources (e.g. needing `{U}{U}` and `{B}` from the same Watery Grave).
    - A proper color-availability solver would improve accuracy for multicolor decks.

11. **Scry / cantrip modeling** `[Medium]`
    - Cards like Brainstorm, Ponder, Serum Visions meaningfully improve land-hit rates.
    - Even a simplified "look at top N cards, keep best land" heuristic would improve fidelity for blue decks.

12. **Threshold-aware `selectBestLand` ordering** `[Medium]`
    - Fast lands currently prioritize untapped without checking if you're about to exceed the 2-land threshold.
    - Check/reveal lands similarly don't verify whether the required type is already in hand.
    - The land selection heuristic should be made threshold- and hand-state-aware.

---

## UX / Export

13. **CSV / JSON data export** --------DONE
    - Only PNG export exists.
    - A CSV of the per-turn averages would let users do their own further analysis in spreadsheet tools.

14. **Card image hover preview** --------DONE
    - Add a Scryfall image tooltip on card names using:
      `https://api.scryfall.com/cards/named?exact=CARDNAME&format=image`
    - Makes the interface significantly more informative without any major layout changes.

15. **Extract inline styles to CSS** --------DONE
    - Every element uses inline `style={}` objects, making theming impossible and bloating render output with object allocations.
    - Migrate to CSS modules or a dedicated `styles.css` file.

---

## New — Simulation Accuracy

16. **Multi-card combo tracking** `[Medium]`
    - Key cards are currently tracked independently.
    - Add a "require all of" combo group: report the % of games where *all* selected cards in a group are simultaneously castable on the same turn.
    - High value for combo decks (e.g. Thassa's Oracle + Demonic Consultation both available by turn 3).

17. **"On-curve" playability** --------DONE
    - Added `keyCardOnCurvePlayability` and `keyCardOnCurveCMC` to `monteCarlo.js` results.
    - Tracks per-iteration whether each key card is castable on exactly the turn equal to its CMC.
    - Displayed as a summary table below the Key Cards chart in `ResultsPanel.jsx`, colour-coded green/amber/red.

18. **Land flood / screw rate tracking** --------DONE
    - Configurable thresholds (default: flood ≥5 lands by T5, screw ≤2 lands by T3) exposed in the settings panel.
    - `monteCarlo.js` computes `floodRate` / `screwRate` from the raw per-iteration land arrays before averaging.
    - Displayed as colour-coded rate badges (blue / orange) inside the Lands per Turn panel.

19. **Opening hand land distribution histogram** --------DONE (v3.2.1)
    - Bar chart of how often kept hands contain exactly 0–7 lands after mulligans.
    - `monteCarlo.js`: `openingHandLandCounts: Array(8).fill(0)` added to `results`; bucket is incremented right after `handsKept++`; normalised to percentages during post-processing.
    - `ResultsPanel.jsx`: new `<BarChart>` panel below the summary stats; bars are colour-coded (red 0–1, amber 2, green 3–4, purple 5–7) with a colour legend.
    - 6 new Vitest tests covering length, percentage sum, and pure-land-deck concentration.

20. **Card draw / cantrip land-thinning** --------DONE
    - Spells with a `drawsCards: N` flag (Night's Whisper, Sign in Blood, Harmonize, Wheel of Fortune, Rhystic Study, Phyrexian Arena, Brainstorm, etc.) are now modelled by the `CARD_DRAW_DATA` library (115+ supported cards).
    - Draw permanents enter the battlefield and produce card draw each upkeep; one-shot instants/sorceries draw immediately when cast (Phase 3 of `castSpells`).
    - A per-card override UI in the Draw Spells panel lets users set a custom draw amount (one-time or per-turn) for conditional effects (e.g. reducing Rhystic Study's value when opponents pay `{1}`).
    - `disabledDrawSpells` and `includeDrawSpells` flags exposed in Simulation Settings.

---

## New — UX

21. **Shareable URL** --------DONE

22. **Named simulation presets** `[Medium]`
    - Extend LocalStorage persistence (item 9) to allow saving and loading named configs.
    - Example presets: "cEDH 33-land", "Aggro 20-land 60-card", "Budget Midrange".
    - Restores both card selections and all simulation settings at once.

23. **Deck health warnings panel** `[Medium]`
    - Post-simulation, surface plain-language alerts based on thresholds, e.g.:
      - *"Average green mana by turn 2 is 0.2 — [Noble Hierarch] is only 18% castable on curve."*
      - *"Cumulative life loss exceeds 10 by turn 4 in 60% of games."*
      - *"Land screw rate (≤2 lands by turn 3) is 12%."*
    - Low implementation cost; high communication value for less experienced users.

---

## New — Performance / Architecture

24. **Web Worker with real progress bar** --------DONE (v3.2.0)
    - `monteCarlo` now accepts an optional `onProgress(completed, total)` third argument; the engine calls it every 250 iterations and once at completion.
    - `src/simulation/simulationWorker.js` (new ES-module Worker): receives serialised config (Sets→Arrays), rehydrates, runs `monteCarlo` with the progress callback, posts `PROGRESS` / `RESULT` / `ERROR` messages.
    - `App.jsx`: `runSimulation` creates a Worker per run, serialises Sets via `serializeConfig`, handles the three message types, and tears down the Worker on completion or error.
    - Progress bar (`sim-progress-track` / `sim-progress-bar`) displayed in the overlay with a CSS transition; percentage shown next to iteration count.
    - In comparison mode Deck A drives 0→50%, Deck B 50→100%.
    - `flushSync` import removed from `App.jsx`; direct `monteCarlo` import removed.
    - **Files changed**: `src/simulation/monteCarlo.js`, `src/simulation/simulationWorker.js` *(new)*, `src/App.jsx`, `src/index.css`
    - **Tests**: 5 new tests in `monteCarlo — onProgress callback` describe block in `monteCarlo.test.js`.

25. **Batch / ranked deck comparison (N variants)** `[Very High]`
    - Extend the current A/B mode to support N named deck slots.
    - Run all variants and display a sortable summary table ranked by a chosen metric (e.g. key-card T3 playability, average mana T4, life loss T5).
    - Useful for iterating 20 vs 22 vs 24 land counts, or comparing different ramp packages.

---

## Bug Fixes (Completed)

- **Deck label removed from single-deck input** — the redundant "Deck" label above the deck textarea in single-deck mode has been removed.

- **No-quantity lines default to 1** — lines without a leading number (e.g. `Lightning Bolt` instead of `1 Lightning Bolt`) now parse as a single copy instead of being silently ignored.

- **MDFC double-count in Total Cards** — Modal double-faced land cards (e.g. `Hengegate Pathway // Mistgate Pathway`) were stored in both `lands[]` and `spells[]` (the spell face is needed for key-card selection), causing them to be counted twice in `totalCards`. The `isMDFCSpellSide` flag is now excluded from the total.

---

## New — Simulation Accuracy (Code-Audit Findings)

26. **Hand size limit not enforced** --------DONE
    - The simulation never discards down to 7 cards at end of turn.
    - Ramp spells that put lands into hand (`landsToHand`) and normal draws can push hand size above 7 indefinitely, inflating key-card playability probabilities on longer-turn runs.
    - Fix: after casting spells and calculating battlefield damage each turn, `enforceHandSizeLimit` discards excess cards (lands first if flooded, highest-CMC spells first otherwise). Hand size is configurable in Simulation Settings.

27. **Chrome Mox / Mox Diamond imprint/discard ignores key cards** `[Low]`
    - `castSpells` always imprints `nonLandsInHand[0]` and discards the first available land for Mox Diamond with no awareness of which cards are tracked key cards.
    - A real player never imprints/discards a key card when a lower-value card is available.
    - Fix: sort imprint/discard candidates to deprioritize cards in `selectedKeyCards`.

28. **Mana Vault upkeep payment never modeled** `[Medium]`
    - Once Mana Vault is tapped, the simulator applies its damage every upkeep indefinitely.
    - A real player pays {4} to untap it when spare mana is available (typically turns 3+), eliminating ongoing damage.
    - Fix: in the upkeep phase, check if `manaAvailable.total >= 4` after untap and, if so, untap the Vault and skip the damage for that turn.

29. **Pain land damage is unconditional** `[Low]`
    - `calculateBattlefieldDamage` deals damage from all pain lands on every turn 1–5 regardless of whether they were actually tapped for colored mana.
    - Real pain lands only deal damage when tapped for a colored pip; tapping for {C} or sitting untapped is free.
    - Fix: track a `tappedForColor` flag when `tapManaSources` taps a pain land for a colored pip, and only count those in `calculateBattlefieldDamage`.

30. **Shock land payment threshold is hardcoded** `[Low]`
    - `playLand` always pays 2 life to bring a shock land in untapped if `turn <= 6`, unconditionally.
    - A configurable strategy (e.g. "only shock turns 1–3", "never shock below 5 life") would better reflect real play and is a direct accuracy lever for life-total analysis.
    - Fix: add a `shockStrategy` config option (`always` / `early_only` / `never`) respected by `playLand` and exposed in the UI settings panel.

31. **Fetch→shock tapped-state check uses pre-fetch battlefield** `[Medium]`
    - When a fetch land is activated in Phase 5 and retrieves a shock land, `doesLandEnterTapped` evaluates the shock using the battlefield state *before* the fetch resolved.
    - This means the land-count and subtype checks that govern shock/check/battle land conditions are slightly wrong for the turn the fetch fires.
    - Fix: call `doesLandEnterTapped` after splicing the fetch out of the battlefield but before pushing the fetched land, so the snapshot accurately reflects the post-fetch board state.

32. **Per-card mana-amount overrides (fixed & scaling)** --------DONE
    - Mana dorks and mana artifacts whose actual output varies (e.g. Marwyn the Nurturer, Priest of Titania, Mana Vault) were all modelled at a fixed conservative floor, with no way for the user to adjust the assumed value.
    - Each card in the Mana Artifacts and Mana Creatures panels now shows a "Mana:" selector with three modes:
      - **Default** — uses the built-in `manaAmount` from `Mana_Dorks.js` / `Artifacts.js`
      - **Fixed** — user enters a static number; the card always taps for that amount
      - **Scaling (per turn)** — user sets `base` and `growth`; the card produces `base + growth × turnsActive` where `turnsActive` accounts for summoning sickness (creatures skip the turn they enter)
    - Overrides are stored in the `manaOverrides` map on each deck slot, serialised into localStorage and the shareable URL hash.
    - `applyManaOverrides()` in `monteCarlo.js` stamps each deck copy with either `manaAmount` (fixed) or `manaScaling: { base, growth }` (scaling) before the iteration loop.
    - `calculateManaAvailability()` in `simulationCore.js` reads `permanent.enteredOnTurn` (tracked when each permanent enters the battlefield) and computes the appropriate amount when `card.manaScaling` is set.
    - Mana-symbol display on both panels was also fixed: the full `produces` array is now rendered as a compact inline badge (any-color cards show `✦`), and the `+N Mana` text reflects the active override.

33. **Cost reducer cards (Medallion cycle, Electromancer effects)** --------DONE
    - Cards like Emerald Medallion and Goblin Electromancer reduce the generic-mana portion of spell costs, accelerating key-card deployment without producing mana themselves.
    - New data file `card_data/CostReducers.js` defines the 19 supported reducers with fields:
      - `reducesColor` — `'W'|'U'|'B'|'R'|'G'|null` (null = any spell)
      - `reducesAmount` — generic discount integer (stacks)
      - `reducesType` — `null | 'instant_or_sorcery' | 'creature'`
    - `processCostReducer()` added to `cardProcessors.js`; `processCardData` router routes known reducer names before the ramp-spell check.
    - `parseDeckList` in `deckParser.js` now populates a `costReducers: []` array alongside the existing card categories.
    - Three new exports in `simulationCore.js`:
      - `calculateCostDiscount(card, battlefield)` — sums applicable discounts from `isCostReducer` permanents, respecting color and type restrictions
      - `canPlayCard` now accepts an optional `discount` parameter; `effectiveCmc = max(0, cmc - discount)`
      - `tapManaSources` now accepts an optional `discount` parameter; `totalNeeded = max(colorPipTotal, totalNeeded - discount)` ensures colored pips are always fully paid
    - **Phase 0** added to `castSpells` — cost reducers are cast before mana producers so their discount applies to everything else cast on the same turn (including Phase 1 creatures/artifacts, Phase 2 ramp spells, and key-card checks)
    - `buildCompleteDeck` in `monteCarlo.js` includes cost reducers with `includeCostReducers` / `disabledCostReducers` toggles; key-card playability checks now compute per-card discounts via `calculateCostDiscount`
    - New `CostReducersPanel.jsx` component mirrors the Rituals panel pattern — shows each reducer with a toggle and a human-readable scope label (e.g. "−1 to Green spells")
    - `App.jsx` — `includeCostReducers` + `disabledCostReducers` state added to both deck slots (A and B), persisted in localStorage/URL, passed to `buildSimConfig`, and rendered in both single-deck and comparison views
    - 32 new tests added across three files (`cardProcessors`, `simulationCore`, `monteCarlo`); total suite: 507 tests.

34. **Cards Drawn per Turn chart** --------DONE
    - New per-turn statistic tracking how many cards enter the player's hand each turn from all sources: natural draw (1/turn in non-Commander; 1/turn from turn 1 in Commander mode), upkeep triggers from draw-engine permanents (Rhystic Study, Phyrexian Arena, etc.), and one-shot draw spells cast that turn (Brainstorm, Night's Whisper, Harmonize, etc.). The opening hand is excluded.
    - **`simulationCore.js`** — `castSpells` Phase 3 increments `simConfig.drawTracker.count` after resolving each one-shot draw spell.
    - **`monteCarlo.js`** — `cardsDrawnPerTurn` array added to the `results` object; `cardsDrawnThisTurn` counter reset each turn and accumulated from upkeep draws, the natural draw, and `simConfig.drawTracker` after `castSpells`; standard deviation and average collapse follow the same pattern as `lifeLossPerTurn`.
    - **`uiHelpers.jsx`** — `prepareChartData` builds a `cardsDrawnData` array with avg, `lo`, `hi`, and `_drawnSd` fields.
    - **`ResultsPanel.jsx`** — new cyan `ComposedChart` panel (±1σ shaded band + average line) inserted after the Life Loss chart.
    - **`ComparisonResultsPanel.jsx`** — `drawnCompare` merged array + overlay line chart added after the Life Loss comparison panel, enabling direct A vs B card-flow comparison.

35. **Treasure token generation simulation** --------DONE
    - 50 most-played Commander treasure-producing cards catalogued in `card_data/Treasures.js` (33 per-turn permanents like Smothering Tithe and Bootleggers' Stash; 17 one-shot generators like Dockside Extortionist and Brass's Bounty).
    - Card model mirrors draw spells: `isOneTreasure` (one-shot vs recurring), `treasuresProduced` (immediate ETB/cast count), `avgTreasuresPerTurn` (upkeep generation rate, fractional allowed), `staysOnBattlefield`.
    - Override UI in `TreasuresPanel.jsx` lets users set a custom treasure count (one-time or per-turn) per card — identical UX to DrawSpellsPanel.
    - **`cardProcessors.js`** — `processTreasureCard()` added; router entry placed before RITUAL_DATA so treasure cards take priority.
    - **`deckParser.js`** — `treasureCards: []` array added throughout; categoriser branches to `isTreasureCard`.
    - **`simulationCore.js`** — Phase 4 (lowest priority, cast last) casts treasure generators from hand; one-shot cards credit `simConfig.treasureTracker.produced`; permanents enter the battlefield for upkeep triggers next turn.
    - **`monteCarlo.js`** — `applyTreasureOverrides()` mirrors `applyDrawOverrides()`; `buildCompleteDeck` includes treasure cards; per-turn upkeep loop fires Bernoulli trial for fractional `avgTreasuresPerTurn`; `cumulativeTreasures` counter persists across turns (tokens don't disappear); treasure pool added to `burstTotal` for key-card playability; `treasurePerTurn` stat + stddev/average collapse follow existing pattern.
    - **`uiHelpers.jsx`** — `prepareChartData` builds a `treasureData` array with avg, `lo`, `hi`, and `_treasureSd` fields.
    - **`ResultsPanel.jsx`** — new amber/gold `ComposedChart` panel (±1σ band + average line) inserted after the Cards Drawn chart; only shown when `hasBurstCards` is true.
    - **`ComparisonResultsPanel.jsx`** — `treasureCompare` merged array + overlay line chart after Cards Drawn comparison; delta summary row added to the summary table.
36. **Deck statistics counts + ritual net-gain overrides** --------DONE
    - **`DeckStatisticsPanel.jsx`** — two new counters appear below the Ramp & Acceleration line after parsing:
      - *Card Draw Spells: N* — total copies from `parsedDeck.drawSpells` (conditional, hidden when zero)
      - *Treasure Generators: N* — total copies from `parsedDeck.treasureCards` (conditional, hidden when zero)
      - Both card categories were also added to the `NON_LAND_KEYS` array so their CMC is included when computing average spell CMC.
    - **`RitualsPanel.jsx`** — each ritual card row now has a **Net gain** override row below its cost info:
      - A dropdown selects *Default* (uses the built-in `netGain` from `Rituals.js`) or *Custom fixed value*.
      - Choosing Custom reveals a number input (−10 to +20, integer) that sets the exact `netGain` used by the simulation.
      - Useful for cards with variable output: set a lower value for Seething Song in non-storm decks, a higher value for a kicked Cabal Ritual, etc.
    - **`monteCarlo.js`** — new `applyRitualOverrides(deck, ritualOverrides)` function applied last in the `buildCompleteDeck` return chain; only affects cards with `isRitual = true`; clamps to minimum −20; accepts `ritualOverrides = {}` in the config destructure.
    - **`App.jsx`** — `ritualOverrides` added to `defaultDeckSlot`, `serializeDeckSlot`, slot A/B setters and destructures, `buildSimConfig`, and all three `<RitualsPanel>` render sites. Persisted in localStorage and the shareable URL hash.
    - **Tests** — 7 new tests in `buildCompleteDeck — ritualOverrides` describe block in `monteCarlo.test.js`; total suite: 524 tests.
37. **Oracle-text fallback detection for treasure & draw cards** --------DONE
    - **`cardProcessors.js`** — two new exported helpers inserted after `hasManaTapAbility`:
      - `detectTreasureFromOracle(oracleText, typeLine)` — returns a `TREASURE_DATA`-shaped object (or `null`) by scanning oracle text for "treasure token". Parses creation amount from word/digit/X patterns; detects recurring vs one-time from permanent type + Whenever/At-the-beginning-of triggers.
      - `detectDrawFromOracle(oracleText, typeLine)` — returns a `CARD_DRAW_DATA`-shaped object (or `null`) by matching either the classic `draw a/N card(s)` pattern **or** the impulse-draw pattern `"exile the top N cards of your library … you may play/cast"`  (including the singular "exile the top card of your library" form). Excludes symmetrical draw effects. X-cost cards default to 2. Infers `cardType` from the type line; sets `triggerType` to `'upkeep'` for recurring effects.
    - **`processCardData` router** — oracle fallback block inserted just before `return processSpell(data)`, after all name-map checks. Uses `resolvedOracle` / `resolvedTypeLine` so MDFCs are handled correctly via the already-resolved `frontFace`.
    - **`processTreasureCard` / `processDrawSpell`** — both now accept an optional second argument (`tdOverride` / `drawDataOverride`) picked up with `??` (not `||`) so zero-valued properties are preserved. When the argument is present it takes priority over the name-map lookup.
    - **Tests** — 23 new tests in `cardProcessors.test.js`: 8 for `detectTreasureFromOracle`, 13 for `detectDrawFromOracle` (includes 4 impulse-draw cases), 2 new `processCardData` routing tests for the oracle fallback; total suite: 547 tests.

38. **Play Sequence: drawn/discarded card names + CardTooltip on all card refs** --------DONE
    - **`simulationCore.js`** — draw spell phase now collects drawn card names into `drawnCardNames[]` and appends them to the log entry: `Cast draw spell: Night's Whisper → drew 2 cards: Counterspell, Forest`. Discard already logged card names via `enforceHandSizeLimit` in a prior version.
    - **`uiHelpers.jsx`** — two new exported helpers:
      - `buildActionSegments(action)` — parses any turn-log action string into an array of `{ text, isCard }` segments. Handles all patterns: `Drew:`, `Discarded:`, `Played`, `Sacrificed`, `Cannot play`, `Cast <type>:` (including cast arrow tails for ramp land lists, draw card lists, sac'd land notes, imprint ETB, discarded-hand ETB), and recurring treasure upkeep entries.
      - `renderSequenceBody` — updated to wrap each card ref with `<CardTooltip>` via `buildActionSegments`, and to render the Opening Hand cards as individual `<CardTooltip>`-wrapped names.
    - **`CardTooltip`** import added to `uiHelpers.jsx`.
    - **Tests** — 15 new tests in `uiHelpers.test.js` (`buildActionSegments` describe block covering: `Drew:`, `Discarded:`, `Played`, fetch-sacrifice, bounce-land, `Sacrificed`, `Cannot play`, `Cast artifact:`, draw spell with named cards, draw spell with 0 drawn, draw permanent, ramp spell with land list, ramp spell with sac'd land, recurring treasure upkeep, unrecognised-pattern fallback); total suite: 562 tests.

39. **Scaling per turn for ritual spells and draw spells** --------DONE
    - **`monteCarlo.js` — `applyRitualOverrides`** — override format extended to support `{ mode: 'fixed', value }` (plain-number legacy still accepted) and `{ mode: 'scaling', base, growth }`. Scaling sets `ritualScaling: { base, growth }` on the card and leaves `netGain = base` as fallback.
    - **`monteCarlo.js` — burst-mana calculation** — `ritualGainAt(c)` helper applies turn-scaling when `c.ritualScaling` is set: effective net gain = `base + turn × growth` (turn is 0-indexed, so Turn 1 gives `base`). Used for both `burstFromRit` total and the per-color bonus.
    - **`monteCarlo.js` — `applyDrawOverrides`** — two new modes added:
      - `'scaling-onetime'` — sets `drawScaling: { type: 'onetime', base, growth }`, `isOneTimeDraw: true`, `staysOnBattlefield: false`.
      - `'scaling-perturn'` — sets `drawScaling: { type: 'perturn', base, growth }`, `isOneTimeDraw: false`, `staysOnBattlefield: true`.
    - **`monteCarlo.js` — upkeep per-turn draw** — when a draw permanent has `drawScaling.type === 'perturn'`, `perTurn = base + turn × growth` instead of fixed `avgCardsPerTurn`.
    - **`simulationCore.js` — one-shot draw** — when a draw spell has `drawScaling.type === 'onetime'`, cards drawn = `round(base + turn × growth)` instead of fixed `netCardsDrawn`.
    - **`RitualsPanel.jsx`** — dropdown now has three modes: *Default*, *Fixed value*, and *Scaling per turn*. The scaling mode shows two number inputs (base and growth).
    - **`DrawSpellsPanel.jsx`** — dropdown now has five modes: *Default*, *One-time draw*, *Per-turn draw*, *Scaling one-time*, and *Scaling per-turn*. The two scaling modes show base + growth inputs.
    - **Tests** — 9 new tests in `monteCarlo.test.js`: 4 for ritual scaling (`{ mode: 'fixed' }` object, scaling sets `ritualScaling`, growth clamped to 0, backward-compat number) + 5 for draw scaling (`scaling-onetime`, `scaling-perturn`, growth clamp, base clamp, fixed modes leave `drawScaling` undefined); total suite: `562 → 571`.

40. **Named drawn cards in upkeep per-turn draw action log** --------DONE
    - **`monteCarlo.js` — upkeep draw loop** — card names are now collected while drawing (`drawnNames` array) and appended to the log entry as `: name1, name2`, giving format `<cardName>: drew N card(s): name1, name2` (mirrors the existing `simulationCore.js` one-shot draw format).
    - **`uiHelpers.jsx` — `buildActionSegments`** — two new parse branches added before the treasure pattern:
      - `<name>: drew N card(s): drawn1, drawn2` — renders the source card name as a tooltip link and each drawn card name as a tooltip link.
      - `<name>: drew N card(s)` (no names) — renders the source card name as a tooltip link (edge-case guard).
    - **Tests** — 2 new tests in `uiHelpers.test.js` (upkeep draw with single drawn card; upkeep draw with multiple drawn cards); total suite: `571 → 573`.
41. **Opening hand land distribution histogram + Commander card input** --------DONE (v3.2.1)

    **Histogram:**
    - `monteCarlo.js`: `openingHandLandCounts: Array(8).fill(0)` added to `results`; land count in the kept hand is bucketed right after `handsKept++` (`Math.min(7, landCount)`) and normalised to percentages during post-processing.
    - `ResultsPanel.jsx`: new `<BarChart>` panel appears between the summary stats and the Lands per Turn chart. Bars are colour-coded: red (0–1 lands), amber (2), green (3–4, ideal), purple (5–7, flood risk). A colour legend is shown below the chart.
    - 6 new Vitest tests: array length 8, percentage sum ≈ 100 (with and without mulligans), non-negative values, and pure-land-deck concentration in the high buckets.

    **Commander card input:**
    - `SimulationSettingsPanel.jsx`: a text input (placeholder *"e.g. Kenrith, the Returned King"*) is shown below the Commander mode checkbox when `commanderMode` is true. The input accepts any card name and is labelled "Commander card" with a hint "Always tracked as a key card (command zone — always available)."
    - `App.jsx`: `commanderName` state (`useState('')`) added; persisted in `buildPersistableState` (localStorage + shareable URL), tracked in the `useEffect` dep array and `handleShareUrl` dep array, and forwarded to both `buildSimConfig` and `simSettingsProps`.
    - `monteCarlo.js`: `commanderName` destructured from config. If set and not already in `selectedKeyCards`, it is pushed onto `keyCardNames` so the existing key-card playability machinery tracks it automatically. If the card is not found in `allPlayableCards` (because it lives in the command zone, not the deck), a stub `{ name, cmc: 0, colors: [] }` is registered in `keyCardMap` — this ensures a CMC-0 always-castable fallback so results still appear.
    - `index.css`: `.commander-name-field` and `.commander-name-hint` helper classes added.
    - 4 new Vitest tests: commander auto-added to `keyCardPlayability`, playability array length matches `turns`, unknown commander stub passes at 100% (CMC 0), no duplicate key when already in `selectedKeyCards`; total suite: 587.

42. **Commander card input moved to Deck List panel** --------DONE (v3.2.2)

    - `App.jsx`: commander name text input (labelled "🎩 Commander card") moved from `SimulationSettingsPanel` into the **Deck List** panel in single-deck mode, appearing below the Parse Deck button when `commanderMode` is active. Comparison mode already had per-deck commander inputs in the deck column panels — they are unchanged. `commanderName`, `setCommanderName`, and `comparisonMode` removed from `simSettingsProps`.
    - `SimulationSettingsPanel.jsx`: `commanderName`, `setCommanderName`, and `comparisonMode` props removed. The `{commanderMode && !comparisonMode && (...)}` input block removed entirely — the component now only owns the Commander Mode checkbox and the multiplayer hint text.
    - 1 new App integration test: verifies the commander name input renders in the Deck List panel (by `id="commander-name-input"`) when Commander Mode is toggled on, and that the input is controllable; total suite: 588.
