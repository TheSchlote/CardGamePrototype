import { describe, expect, it } from "vitest";
import { GameEngine } from "../gameEngine";
import { runAiStep } from "../ai";
import type { DeckList } from "../types";

const aiDeck: DeckList = {
  id: "ai",
  name: "AI Deck",
  size: 12,
  cards: [
    { id: "creature_drake", count: 2 },
    { id: "creature_goblin", count: 6 },
    { id: "tactic_assault", count: 2 },
    { id: "tactic_trade", count: 2 }
  ]
};

describe("ai behavior", () => {
  it("summons the highest attack creature it can afford", () => {
    const orderB = [
      "creature_drake",
      "creature_goblin",
      "creature_wasp",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin"
    ];
    const engine = new GameEngine({
      firstPlayer: "B",
      decks: [aiDeck, aiDeck],
      deckOrders: { A: orderB, B: orderB }
    });

    engine.state.phase = "Summon";
    engine.state.activePlayer = "B";
    const acted = runAiStep(engine, "B");
    expect(acted).toBe(true);
    expect(engine.state.players.B.field[0]?.card.id).toBe("creature_drake");
  });

  it("opens a chain in prepare phase with a draw-tag tactic", () => {
    const order = [
      "tactic_trade",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin"
    ];
    const engine = new GameEngine({
      firstPlayer: "B",
      decks: [aiDeck, aiDeck],
      deckOrders: { A: order, B: order }
    });

    engine.state.phase = "Prepare";
    engine.state.activePlayer = "B";
    runAiStep(engine, "B");
    expect(engine.state.chain?.plays[0].card.id).toBe("tactic_trade");
  });

  it("passes a chain if no chainable response exists", () => {
    const order = [
      "tactic_trade",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin"
    ];
    const engine = new GameEngine({
      firstPlayer: "B",
      decks: [aiDeck, aiDeck],
      deckOrders: { A: order, B: order }
    });
    engine.state.chain = {
      starter: "A",
      plays: [
        {
          player: "A",
          card: engine.state.cardLibrary.cards["tactic_trade"] as any
        }
      ],
      expectedResponder: "B"
    };
    engine.state.activePlayer = "B";
    engine.state.phase = "Action";
    engine.state.players.B.hand = []; // no cards

    runAiStep(engine, "B");
    expect(engine.state.chain).toBeNull();
  });

  it("plays an action tactic when available", () => {
    const order = [
      "tactic_assault",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin",
      "creature_goblin"
    ];
    const engine = new GameEngine({
      firstPlayer: "B",
      decks: [aiDeck, aiDeck],
      deckOrders: { A: order, B: order }
    });
    engine.state.phase = "Action";
    engine.state.activePlayer = "B";
    runAiStep(engine, "B");
    expect(engine.state.chain?.plays[0].card.id).toBe("tactic_assault");
  });

  it("passes during non-actionable phases", () => {
    const engine = new GameEngine({ firstPlayer: "B", decks: [aiDeck, aiDeck] });
    engine.state.phase = "Start";
    engine.state.activePlayer = "B";
    runAiStep(engine, "B");
    expect(engine.state.chain).toBeNull();
  });
});
