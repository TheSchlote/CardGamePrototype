import type { CreatureCard, PlayerId, TacticCard } from "./types";
import { GameEngine } from "./gameEngine";
import { opponentOf, payEnergyCost } from "./utils";

const cloneEnergy = (energy: Record<string, number>) => ({ ...energy });

const pickSummonTarget = (engine: GameEngine, playerId: PlayerId): string | null => {
  const player = engine.state.players[playerId];
  const creatures = player.hand
    .map((id) => engine.state.cardLibrary.cards[id])
    .filter((c): c is CreatureCard => c.type === "Creature");
  const affordable = creatures.filter((card) => {
    const copy = cloneEnergy(player.energy);
    return payEnergyCost(copy as any, card.affinity, card.cost);
  });
  if (!affordable.length) return null;
  affordable.sort((a, b) => {
    if (b.atk !== a.atk) return b.atk - a.atk;
    const stageA = a.stage ?? a.cost;
    const stageB = b.stage ?? b.cost;
    if (stageB !== stageA) return stageB - stageA;
    if (a.cost !== b.cost) return a.cost - b.cost;
    return 0;
  });
  return affordable[0].id;
};

const pickTactic = (
  engine: GameEngine,
  playerId: PlayerId,
  tags: string[]
): string | null => {
  const phase = engine.state.phase;
  if (phase !== "Prepare" && phase !== "Summon" && phase !== "Action") return null;
  const player = engine.state.players[playerId];
  const tactics = player.hand
    .map((id) => engine.state.cardLibrary.cards[id])
    .filter((c): c is TacticCard => c.type === "Tactic" && c.timing.includes(phase));
  const prioritized = tactics
    .filter((t) => tags.some((tag) => t.tags?.includes(tag)))
    .concat(tactics.filter((t) => !tags.some((tag) => t.tags?.includes(tag))));
  return prioritized.length ? prioritized[0].id : null;
};

const strongestOpponentCreature = (engine: GameEngine, playerId: PlayerId) => {
  const opponent = engine.state.players[opponentOf(playerId)];
  const creatures = opponent.field
    .map((c, idx) => ({ creature: c, slot: idx }))
    .filter((c) => c.creature !== null) as { creature: any; slot: number }[];
  creatures.sort((a, b) => {
    if (b.creature.currentAtk !== a.creature.currentAtk) return b.creature.currentAtk - a.creature.currentAtk;
    const stageA = a.creature.card.stage ?? a.creature.card.cost;
    const stageB = b.creature.card.stage ?? b.creature.card.cost;
    if (stageB !== stageA) return stageB - stageA;
    return a.slot - b.slot;
  });
  return creatures[0]?.creature ?? null;
};

const playTacticWithDefaults = (engine: GameEngine, playerId: PlayerId, cardId: string): boolean => {
  if (cardId === "tactic_trade") {
    const player = engine.state.players[playerId];
    const discardId = player.hand.find((id) => id !== "tactic_trade");
    const deckPick = player.deck[0] ?? player.hand.find((id) => id !== discardId) ?? discardId;
    if (!discardId) return false;
    engine.playTactic(playerId, cardId, [
      { params: { cardId: discardId } },
      { params: { cardId: deckPick } }
    ]);
    return true;
  }
  engine.playTactic(playerId, cardId);
  return true;
};

export const runAiStep = (engine: GameEngine, playerId: PlayerId): boolean => {
  if (engine.state.activePlayer !== playerId) return false;

  // Chain handling: try to respond with any chainable tactic, otherwise pass.
  if (engine.state.chain && engine.state.chain.expectedResponder === playerId) {
    const chainTactic = pickTactic(engine, playerId, ["offense", "buff"]);
    if (chainTactic) {
      try {
        return playTacticWithDefaults(engine, playerId, chainTactic);
      } catch {
        // ignore and fall through to pass
      }
    }
    engine.pass(playerId);
    return true;
  }

  switch (engine.state.phase) {
    case "Prepare": {
      const cardId = pickTactic(engine, playerId, ["buff", "draw"]);
      if (cardId) {
        playTacticWithDefaults(engine, playerId, cardId);
        return true;
      }
      engine.pass(playerId);
      return true;
    }
    case "Summon": {
      const summonId = pickSummonTarget(engine, playerId);
      if (summonId) {
        try {
          engine.summonCreature(playerId, summonId);
          return true;
        } catch {
          // if energy changed from previous plays just pass
        }
      }
      // fallback: chainable summon tactic if allowed
      const tacticId = pickTactic(engine, playerId, ["summon"]);
      if (tacticId) {
        playTacticWithDefaults(engine, playerId, tacticId);
        return true;
      }
      engine.pass(playerId);
      return true;
    }
    case "Action": {
      const cardId = pickTactic(engine, playerId, ["offense", "buff"]);
      if (cardId) {
        playTacticWithDefaults(engine, playerId, cardId);
        return true;
      }
      engine.pass(playerId);
      return true;
    }
    default:
      engine.pass(playerId);
      return true;
  }
};
