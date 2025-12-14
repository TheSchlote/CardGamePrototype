import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import type { DeckList } from "../types";

const actionDeck: DeckList = {
  id: "action",
  name: "Action Deck",
  size: 12,
  cards: [
    { id: "tactic_assault", count: 2 },
    { id: "tactic_protect", count: 2 },
    { id: "creature_goblin", count: 8 }
  ]
};

describe("action phase and chain", () => {
  it("resolves chain plays in LIFO order and applies buffs", () => {
    const orderA = [
      "tactic_assault",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin"
    ];
    const orderB = [
      "tactic_protect",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin"
    ];
    const engine = new GameEngine({
      decks: [actionDeck, actionDeck],
      deckOrders: { A: orderA, B: orderB }
    });

    engine.pass("A");
    engine.pass("B"); // Summon phase
    engine.summonCreature("A", "creature_goblin");
    engine.summonCreature("B", "creature_goblin");
    engine.pass("A");
    engine.pass("B"); // Action phase

    engine.playTactic("A", "tactic_assault");
    engine.playTactic("B", "tactic_protect");
    engine.pass("A"); // resolve chain

    const goblin = engine.state.players.A.field[0]!;
    const opponentGoblin = engine.state.players.B.field[0]!;
    expect(goblin.currentHp).toBe(1);
    expect(goblin.currentAtk).toBe(12);
    expect(opponentGoblin.currentHp).toBe(11);
  });
});
