import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import type { DeckList } from "../types";

const summonTacticDeck: DeckList = {
  id: "effect",
  name: "Effect Deck",
  size: 12,
  cards: [
    { id: "tactic_summon_gear_pair", count: 2 },
    { id: "creature_gear", count: 6 },
    { id: "creature_goblin", count: 4 }
  ]
};

describe("effect resolver", () => {
  it("summons specific cards from hand into leftmost empty slots", () => {
    const order = [
      "tactic_summon_gear_pair",
      "creature_gear",
      "creature_gear",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin"
    ];
    const engine = new GameEngine({
      decks: [summonTacticDeck, summonTacticDeck],
      deckOrders: { A: order, B: order }
    });

    engine.pass("A");
    engine.pass("B"); // Summon phase
    engine.playTactic("A", "tactic_summon_gear_pair");
    engine.pass("B"); // resolve chain

    expect(engine.state.players.A.field[0]?.card.id).toBe("creature_gear");
    expect(engine.state.players.A.field[1]?.card.id).toBe("creature_gear");
  });
});
