import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import type { DeckList } from "../types";

const goblinDeck: DeckList = {
  id: "goblin",
  name: "Goblin Rush",
  size: 10,
  cards: [{ id: "creature_goblin", count: 10 }]
};

describe("start phase", () => {
  it("resets chain, temp effects, and awards energy on draw", () => {
    const order = Array(6).fill("creature_goblin");
    const engine = new GameEngine({
      seed: 1,
      decks: [goblinDeck, goblinDeck],
      deckOrders: { A: order, B: order }
    });

    expect(engine.state.phase).toBe("Prepare");
    expect(engine.state.chain).toBeNull();
    expect(engine.state.players.A.tempEffects).toHaveLength(0);
    expect(engine.state.players.A.energy.Fire).toBe(6);
    expect(engine.state.players.A.hand).toHaveLength(6);
  });
});
