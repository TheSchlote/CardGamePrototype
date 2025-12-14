import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import type { DeckList } from "../types";

const shortDeck: DeckList = {
  id: "short",
  name: "Short Deck",
  size: 5,
  cards: [{ id: "creature_goblin", count: 5 }]
};

const fullDeck: DeckList = {
  id: "full",
  name: "Full Deck",
  size: 10,
  cards: [{ id: "creature_goblin", count: 10 }]
};

describe("match flow", () => {
  it("tracks best-of-three wins across rounds", () => {
    const engine = new GameEngine({
      decks: [shortDeck, fullDeck],
      deckOrders: { A: ["creature_goblin", "creature_goblin"], B: Array(6).fill("creature_goblin") }
    });

    expect(engine.state.roundResult?.winner).toBe("B");
    expect(engine.state.matchScore.B).toBe(1);

    engine.startNextRound();
    expect(engine.state.round).toBe(2);
    expect(engine.state.matchScore.B).toBe(2);
    expect(() => engine.startNextRound()).toThrow();
  });
});
