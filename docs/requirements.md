CardGame (DW3-Inspired) — Requirements & Repository README

A browser-based, deterministic, turn-based card battle game inspired by the Digimon World 3 Card Battle mini-game—rebuilt with original, non-IP fantasy content and designed to run entirely on GitHub Pages (static hosting).

This document is the source of truth for implementation.

Implementation status (Dec 2025)

- Engine implements 7-phase round loop, best-of-3 match flow, seeded RNG, chain system, energy costs, swarm merge, trigger queue, and deterministic AI (see `src/engine` tests at ~91% coverage).
- Data ships as non-IP fantasy cards/decks (`src/data/cards.json`, `src/data/decks.json`); baseline starter input is stored at `docs/starterDeck.json`.
- React UI renders DW3-style layout with hand, board, energy, deck/trash, chain indicator, action buttons, and log; playable against AI.
- Build is static (Vite) and configured for GitHub Pages; no backend required.

Goals
MVP must:

Run fully in the browser (no backend).

Be deterministic (seeded randomness only).

Support Human vs AI and a full Best-of-3 Match.

Load two prebuilt 40-card decks from JSON.

Implement a 7-phase Round state machine.

Provide a minimum visual UI (DW3-like board layout).

Be test-driven with high rules coverage.

IP & Content Rules (Mandatory)

No Digimon names, images, or trademarked terms are allowed in shipping content.

The provided baseline starter deck is used only as a mechanical template and must be converted:

Digimon names → simple fantasy creature names (e.g., “Goblin”, “Hawk”, “Wisp”).

Colors → our 8 Affinities (see below).

The repo must ship with converted JSON, not Digimon-named card data.

Baseline deck contains tactic lines and a Name, Color, Cost, AP, HP creature table. 

StarterDeck

Technology & Deployment
Requirements

Must run on GitHub Pages as static files (index.html + bundled JS + assets).

Implementation language: TypeScript or modern JavaScript (ES6+).

Build: Vite preferred (or equivalent) producing /dist.

Testing: Vitest preferred (or Jest acceptable).

Rules engine must have zero external dependencies (pure TS/JS).

CI

PRs / main pushes must run:

npm test

coverage report

build

Game Concepts
Affinities (8)

Nature, Fire, Water, Earth, Energy, Dark, Light, Neutral

Baseline mapping rule (for importing DW3-style decks)

White → Light (explicit requirement)

Blue → Water

Green → Nature

Red → Fire

Brown → Earth

Black → Dark
Energy exists as a first-class affinity even if not present in the starter list.

Core Model
Zones (per player)

Deck: ordered, face-down.

Hand: default max size 6.

Field: 6 creature slots (positions 1–6, left → right).

Trash: discard pile (ordering irrelevant unless effect says “top”).

Energy Pool: numeric counters per affinity.

Temporary Effects Store: internal tracking for durations (e.g., UntilEndOfRound).

The engine must expose stable identifiers for zones so effects/tests can reference them consistently.

Cards
CreatureCard
type CreatureCard = {
  id: string;
  name: string;        // simple non-IP name
  affinity: Affinity;
  stage?: Stage;       // optional for baseline import (see Stage rule)
  cost: number;
  atk: number;         // internal name
  hp: number;
  keywords?: string[];
}

AP vs ATK (DW3 compatibility)

Baseline uses AP/HP; loader must map:

AP → atk (internal)

HP → hp

Baseline creature rows include Cost/AP/HP values. 

StarterDeck

TacticCard
type TacticCard = {
  id: string;
  name: string;                 // simple non-IP name
  affinity: Affinity;
  timing: Phase[];              // Prepare | Summon | Action (see below)
  effects: EffectDefinition[];
  chainable: boolean;
  tags?: string[];              // e.g., "draw", "buff", "offense"
}

Timing must include Summon

Baseline has tactics that explicitly summon creatures during the compile/summon phase (e.g., “Summon Goburimon… Compile Phase”, “Summon Hagurumon… Compile Phase”). 

StarterDeck


Therefore Tactic timing must support: Prepare, Summon, Action.

Stages
enum Stage { Common=0, Uncommon=1, Rare=2, Epic=3, Mythic=4 }

Stage rule for baseline import

Baseline deck list does not provide stage explicitly. 

StarterDeck


For MVP import:

default stage = clamp(cost, 0..4) unless overridden in converted JSON.

Match & Round Rules
Match

Best 2 out of 3 Rounds.

Between Rounds:

reset decks to starting contents and shuffle using a seed

clear fields

reset energy

Round has 7 phases

Start

Draw

Prepare

Summon

Action

Battle

End

Phase Details
1) Start Phase

Determine first player (deterministic: Player A starts unless overridden).

Reset chain and temporary effect lists.

Trigger event: OnStartPhase.

2) Draw Phase

Both players draw exactly 6 cards.

For each drawn card where affinity != Neutral, gain +1 energy of that card’s affinity (includes Light).

If a player has < 6 cards available when drawing, they lose the Round immediately.

Trigger event: OnDrawCard per card.

3) Prepare Phase

Players alternate actions starting with first player.

Allowed:

play a Tactic with timing including Prepare

Pass

Ends when both players pass consecutively.

4) Summon Phase

Players alternate actions starting with first player.

Allowed:

Summon Creature from hand by paying energy cost (see Energy rules)

Play a Tactic with timing including Summon (required by baseline)

Pass

Ends when both players pass consecutively.

Max 6 creatures per field.

Trigger event: OnSummon.

5) Action Phase

Players alternate playing Tactics with timing including Action.

Chain rules apply (below).

6) Battle Phase

Compute totals:

totalAtk = sum(atk of creatures)

totalHp = sum(current hp of creatures)

Simultaneous resolution:

hpAfterA = totalHpA - totalAtkB

hpAfterB = totalHpB - totalAtkA

Damage distribution:

Apply incoming damage across creatures in slot order (1→6), subtracting HP until damage exhausted.

Destroy creatures with HP ≤ 0 → Trash.

Combo (swarm merge) rule

If player has ≥ 3 identical creatures (same id) on field:

merge into the leftmost occupied slot:

mergedAtk = sum(atk)

mergedHp = sum(current hp)

other copies go to Trash

If player had > 4 identical before merge:

after merging, apply +10% atk and hp (round down)

Round winner

Higher hpAfterX wins.

If tied: first player loses.

7) End Phase

Clear UntilEndOfRound effects.

Revert any temporary controller changes.

Trigger OnEndPhase.

Update Match score; if a player reaches 2 Round wins → Match ends.

Chain System (Tactics)

A chain begins when a Tactic is played in Prepare/Action/Summon (as allowed).

Sequence:

starter plays a Tactic

opponent may respond with a chainable Tactic

starter may respond once more

chain ends

Resolve effects LIFO (last in, first out).

All Tactics used in the chain go to Trash after resolution.

Triggers during chains

Trigger events generated inside a chain are queued.

After chain resolves, trigger queue runs FIFO.

Triggers do not start new chains in MVP.

Energy System

Each player has an energy pool per affinity.

Energy is gained primarily during Draw Phase from non-neutral draws.

Energy is persistent within a Round and resets between rounds.

Paying costs

Creature summon cost must be paid fully.

Affinity-locked payments:

Fire energy pays Fire costs, etc.

Neutral-cost creatures may be paid with any affinity (design choice retained).

Tactic costs

MVP: Tactics are free unless specified in JSON (future extension).

Effects System
EffectDefinition
type EffectDefinition = {
  kind: string;
  target: TargetSelector;
  params: Record<string, unknown>;
  duration?: "Instant" | "UntilEndOfRound";
}

TargetSelector
type TargetSelector = {
  owner: "self" | "opponent" | "both";
  zone?: "Field" | "Hand" | "Deck" | "Trash" | "Energy";
  cardType?: "Creature" | "Tactic";
  affinity?: Affinity | `non-${Affinity}`;
  id?: string;
  count?: number;
  random?: boolean;      // must use seeded RNG
  position?: number[];   // field slots
}

Minimum supported effect kinds (MVP)

Stat:

ModifyStats (atkDelta, hpDelta) — baseline includes AP+10 and HP+10 style buffs. 

StarterDeck

Hand/Deck:

DrawCards

DiscardFromHand (player choice; if random=true then use seed)

Summoning helpers (required by baseline “Summon X” tactics):

SummonSpecificFromHand { cardId, count, ignoreCost?: boolean }

summons into leftmost empty slots

if insufficient copies in hand or insufficient space, summon as many as possible

(Additional effect kinds can be added later, but the above must fully support the starter decks.)

Triggers (MVP-ready framework)

Supported events:

OnStartPhase, OnEndPhase

OnDrawCard

OnSummon

OnTacticPlayed

optional: OnCreatureDestroyed

Triggers have:

event

optional condition

effects

duration (OneShot or UntilEndOfRound)

AI (Deterministic)

No randomness (unless a rule forces seeded random choices).

Summon Phase:

summon the highest atk creature it can afford

tie-breakers: higher stage → lower cost → earliest in hand

Prepare Phase:

prefers tactics tagged buff then draw

Action Phase:

prefers tactics tagged offense / destroy

targets opponent creature with highest atk (tie: stage, then slot)

Data & JSON Requirements
Repository must include

cards.json — all card definitions (creatures + tactics, non-IP names)

decks.json — decklists referencing card ids, exactly 40 cards each

Conversion pipeline (baseline → normalized)

Because the baseline file includes tactic text lines and a creature table 

StarterDeck

, the project must provide either:

a one-time conversion script (recommended), or

a loader that can import baseline format directly and emit normalized JSON

Name mapping

A mapping table/file must exist to convert baseline names → non-IP names (simple names).

Minimal Visual UI (DW3-style MVP)

UI must be playable and visually structured (not just console logs).

Must show

Both players:

AP/Energy counters per affinity

total HP

deck count and trash count

6 field slots with each creature displaying AP/HP (atk/hp)

Player hand (up to 6 visible cards)

Buttons/controls: Play Tactic, Summon, Pass

Action log (phase changes, plays, results)

Style constraints

No animations required.

Simple CSS is fine.

Layout must work at 16:9 desktop resolutions (e.g., 1280×720).

Testing Requirements

Engine development is test-first (rules before UI).

≥ 90% coverage for rules modules.

Required test suites:

startPhase.test

drawPhase.test

preparePhase.test

summonPhase.test

actionPhase.test

battlePhase.test

endPhase.test

matchFlow.test

effectResolver.test

aiBehavior.test

Deliverables (Acceptance)

MVP is complete when:

All tests pass with ≥90% rules coverage.

Full Best-of-3 match simulates deterministically.

Both starter decks load from JSON and play without errors.

UI is playable and shows board/hand/AP/HP/deck/trash/log.

GitHub Pages build runs and loads successfully.

Out of Scope (MVP)

Multiplayer

Deck builder/editor UI

Animations, sound, advanced AI

Complex triggered combos beyond the trigger queue framework
