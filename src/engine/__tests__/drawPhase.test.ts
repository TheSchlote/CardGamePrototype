import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import type { DeckList } from "../types";

const shortDeck: DeckList = {
  id: "short",
  name: "Too Short",
  size: 5,
  cards: [{ id: "creature_goblin", count: 5 }]
};

const okDeck: DeckList = {
  id: "ok",
  name: "Playable",
  size: 10,
  cards: [{ id: "creature_goblin", count: 10 }]
};

describe("draw phase", () => {
  it("gives a loss when a player cannot draw six cards", () => {
    const engine = new GameEngine({
      decks: [shortDeck, okDeck],
      deckOrders: { A: ["creature_goblin", "creature_goblin", "creature_goblin"], B: Array(6).fill("creature_goblin") }
    });

    expect(engine.state.roundResult?.winner).toBe("B");
    expect(engine.state.matchScore.B).toBe(1);
  });

  it("adds energy for each non-neutral draw", () => {
    const engine = new GameEngine({
      decks: [okDeck, okDeck],
      deckOrders: { A: Array(6).fill("creature_goblin"), B: Array(6).fill("creature_goblin") }
    });

    expect(engine.state.players.A.energy.Fire).toBe(6);
    expect(engine.state.players.B.energy.Fire).toBe(6);
  });
});
