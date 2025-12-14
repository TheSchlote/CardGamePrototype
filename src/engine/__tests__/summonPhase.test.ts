import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import type { DeckList } from "../types";

const summonDeck: DeckList = {
  id: "summon",
  name: "Summon Deck",
  size: 10,
  cards: [{ id: "creature_drake", count: 6 }, { id: "creature_goblin", count: 4 }]
};

describe("summon phase", () => {
  it("pays energy and fills the leftmost empty slot", () => {
    const order = ["creature_drake", "creature_goblin", "creature_goblin", "creature_goblin", "creature_goblin", "creature_goblin"];
    const engine = new GameEngine({
      decks: [summonDeck, summonDeck],
      deckOrders: { A: order, B: order }
    });

    engine.pass("A");
    engine.pass("B"); // advance to Summon

    const beforeEnergy = engine.state.players.A.energy.Fire;
    engine.summonCreature("A", "creature_drake");
    expect(engine.state.players.A.field[0]?.card.id).toBe("creature_drake");
    expect(engine.state.players.A.energy.Fire).toBe(beforeEnergy - 1);
    expect(engine.state.players.A.hand.includes("creature_drake")).toBe(false);
  });
});
