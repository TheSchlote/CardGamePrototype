import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import type { DeckList } from "../types";

const prepDeck: DeckList = {
  id: "prep",
  name: "Prep Deck",
  size: 10,
  cards: [
    { id: "tactic_trade", count: 2 },
    { id: "creature_goblin", count: 8 }
  ]
};

describe("prepare phase", () => {
  it("lets a player open a chain with a prepare tactic and resolves after opponent passes", () => {
    const order = [
      "tactic_trade",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin"
    ];
    const engine = new GameEngine({
      decks: [prepDeck, prepDeck],
      deckOrders: { A: order, B: [...order] }
    });

    engine.playTactic("A", "tactic_trade", [
      { params: { cardId: "creature_goblin" } },
      { params: { cardId: "creature_goblin" } }
    ]);
    expect(engine.state.chain?.plays).toHaveLength(1);
    engine.pass("B"); // resolves chain

    expect(engine.state.chain).toBeNull();
    expect(engine.state.players.A.hand.length).toBe(5); // played tactic, drew 1, discarded 1
    expect(engine.state.activePlayer).toBe("A"); // B passed on chain so A keeps turn
  });
});
