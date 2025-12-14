import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import type { DeckList } from "../types";

const endDeck: DeckList = {
  id: "end",
  name: "End Deck",
  size: 10,
  cards: [{ id: "creature_goblin", count: 10 }]
};

describe("end phase", () => {
  it("removes until-end-of-round stat buffs", () => {
    const order = Array(6).fill("creature_goblin");
    const engine = new GameEngine({
      decks: [endDeck, endDeck],
      deckOrders: { A: order, B: order }
    });

    engine.pass("A");
    engine.pass("B"); // Summon
    engine.summonCreature("A", "creature_goblin");
    const creature = engine.state.players.A.field[0]!;
    creature.currentAtk += 5;
    engine.state.players.A.tempEffects.push({
      instanceId: creature.instanceId,
      atkDelta: 5,
      hpDelta: 0,
      expires: "EndOfRound"
    });

    engine.pass("B");
    engine.pass("A"); // Action
    engine.pass("A");
    engine.pass("B"); // Battle -> End

    expect(engine.state.players.A.field[0]?.currentAtk).toBe(2); // back to base
    expect(engine.state.players.A.tempEffects.length).toBe(0);
  });
});
