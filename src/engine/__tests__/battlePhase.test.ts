import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import type { DeckList } from "../types";

const battleDeck: DeckList = {
  id: "battle",
  name: "Battle Deck",
  size: 12,
  cards: [{ id: "creature_goblin", count: 12 }]
};

describe("battle phase", () => {
  it("awards tie to the non-first player when hpAfter is equal", () => {
    const order = Array(6).fill("creature_goblin");
    const engine = new GameEngine({
      decks: [battleDeck, battleDeck],
      deckOrders: { A: order, B: order }
    });

    engine.pass("A");
    engine.pass("B"); // Summon
    engine.summonCreature("A", "creature_goblin");
    engine.summonCreature("B", "creature_goblin");
    engine.pass("A");
    engine.pass("B"); // Action
    engine.pass("A");
    engine.pass("B"); // triggers battle

    expect(engine.state.roundResult?.winner).toBe("B");
    expect(engine.state.players.A.field[0]).toBeNull();
    expect(engine.state.players.B.field[0]).toBeNull();
  });

  it("merges three identical creatures into one slot with summed stats", () => {
    const order = ["creature_goblin", "creature_goblin", "creature_goblin", "creature_goblin", "creature_goblin", "creature_goblin"];
    const engine = new GameEngine({
      decks: [battleDeck, battleDeck],
      deckOrders: { A: order, B: order }
    });

    engine.pass("A");
    engine.pass("B"); // Summon
    engine.summonCreature("A", "creature_goblin");
    engine.state.activePlayer = "A";
    engine.summonCreature("A", "creature_goblin");
    engine.state.activePlayer = "A";
    engine.summonCreature("A", "creature_goblin");
    engine.pass("B");
    engine.pass("A"); // Action
    engine.pass("A");
    engine.pass("B"); // Battle + merge

    const creature = engine.state.players.A.field[0];
    expect(creature?.currentAtk).toBe(6);
    expect(creature?.currentHp).toBe(3);
    const trashCount = engine.state.players.A.trash.filter((id) => id === "creature_goblin").length;
    expect(trashCount).toBeGreaterThanOrEqual(2);
  });
});
