import { describe, expect, it } from "vitest";
import { payEnergyCost } from "../utils";
import { AFFINITIES } from "../constants";
import { createRng } from "../rng";
import { loadCardLibrary, loadDecks, expandDeck } from "../library";
import { GameEngine } from "../gameEngine";
import { runAiStep } from "../ai";
import type { CreatureCard, DeckList, TacticCard } from "../types";

const makePool = (values: Partial<Record<string, number>>) =>
  Object.fromEntries(AFFINITIES.map((a) => [a, values[a] ?? 0]));

describe("engine helpers", () => {
  it("pays neutral costs from any affinity pool", () => {
    const pool = makePool({ Fire: 1, Water: 2 });
    const result = payEnergyCost(pool as any, "Neutral", 2);
    expect(result).toBe(true);
    expect(pool.Fire + pool.Water).toBe(1);
  });

  it("rng produces deterministic sequences", () => {
    const a = createRng("seed");
    const b = createRng("seed");
    expect(a.next()).toBeCloseTo(b.next());
    const arr = [1, 2, 3, 4];
    expect(a.shuffle(arr)).toEqual(b.shuffle(arr));
  });

  it("library clamps stages when missing", () => {
    const library = loadCardLibrary();
    const gear = library.cards["creature_gear"] as CreatureCard;
    expect(gear.type).toBe("Creature");
    expect(gear.stage).toBeGreaterThanOrEqual(0);
  });

  it("expands deck counts exactly", () => {
    const decks = loadDecks();
    const expanded = expandDeck(decks[0]);
    const expected = decks[0].cards.reduce((acc, c) => acc + c.count, 0);
    expect(expanded.length).toBe(expected);
  });

  it("ai responds to an open chain when it is the expected responder", () => {
    const deck: DeckList = {
      id: "aiChain",
      name: "AI Chain",
      size: 6,
      cards: [
        { id: "tactic_assault", count: 2 },
        { id: "creature_goblin", count: 4 }
      ]
    };
    const order = [
      "tactic_assault",
      "tactic_assault",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin"
    ];
    const engine = new GameEngine({
      decks: [deck, deck],
      deckOrders: { A: order, B: order }
    });

    engine.state.chain = {
      starter: "A",
      plays: [{ player: "A", card: engine.state.cardLibrary.cards["tactic_assault"] as TacticCard }],
      expectedResponder: "B"
    };
    engine.state.activePlayer = "B";
    engine.state.phase = "Action";
    const acted = runAiStep(engine, "B");
    expect(acted).toBe(true);
    expect(engine.state.chain?.plays.length).toBe(2);
  });
});
