import { AFFINITIES, FIELD_SLOTS, Phase } from "./constants";
import { createRng, type Rng, seedNumber } from "./rng";
import { expandDeck, loadCardLibrary, loadDecks } from "./library";
import { opponentOf, payEnergyCost, sum } from "./utils";
import type {
  CardDefinition,
  CardLibrary,
  ChainState,
  CreatureCard,
  CreatureInPlay,
  DeckList,
  EffectDefinition,
  GameState,
  PlayerId,
  PlayerState,
  TargetSelector,
  TacticCard
} from "./types";

interface EngineOptions {
  seed?: number | string;
  firstPlayer?: PlayerId;
  decks?: DeckList[];
  library?: CardLibrary;
  deckOrders?: Partial<Record<PlayerId, string[]>>;
}

interface TargetRef {
  player: PlayerId;
  card?: CreatureInPlay;
  slot?: number;
}

export class GameEngine {
  state: GameState;
  private rng: Rng;
  private instanceCounter = 1;
  private options: EngineOptions;

  constructor(options?: EngineOptions) {
    this.options = options ?? {};
    const baseSeed = options?.seed ?? 42;
    this.rng = createRng(baseSeed);
    const library = options?.library ?? loadCardLibrary();
    const decks = options?.decks ?? loadDecks();
    const deckA = decks[0];
    const deckB = decks[1] ?? decks[0];
    this.state = {
      phase: "Start",
      firstPlayer: options?.firstPlayer ?? "A",
      activePlayer: options?.firstPlayer ?? "A",
      players: {
        A: this.buildPlayer("A", deckA, library),
        B: this.buildPlayer("B", deckB, library)
      },
      cardLibrary: library,
      decklists: { A: deckA, B: deckB },
      round: 1,
      matchScore: { A: 0, B: 0 },
      chain: null,
      consecutivePasses: 0,
      triggerQueue: [],
      rngSeed: seedNumber(baseSeed),
      log: []
    };
    this.startRound();
  }

  get playerA() {
    return this.state.players.A;
  }

  get playerB() {
    return this.state.players.B;
  }

  buildPlayer(id: PlayerId, deck: DeckList, library: CardLibrary): PlayerState {
    const presetOrder = this.options.deckOrders?.[id];
    const deckOrder = presetOrder ? [...presetOrder] : this.rng.shuffle(expandDeck(deck));
    deckOrder.forEach((cardId) => {
      if (!library.cards[cardId]) throw new Error(`Deck references unknown card ${cardId}`);
    });
    return {
      id,
      deck: deckOrder,
      hand: [],
      trash: [],
      field: new Array(FIELD_SLOTS).fill(null),
      energy: Object.fromEntries(AFFINITIES.map((a) => [a, 0])) as PlayerState["energy"],
      tempEffects: [],
      triggers: []
    };
  }

  private resetPlayers(): void {
    this.state.players.A = this.buildPlayer("A", this.state.decklists.A, this.state.cardLibrary);
    this.state.players.B = this.buildPlayer("B", this.state.decklists.B, this.state.cardLibrary);
  }

  startNextRound(): void {
    if (!this.state.roundResult) {
      throw new Error("Current round not finished");
    }
    if (this.state.matchScore.A >= 2 || this.state.matchScore.B >= 2) {
      throw new Error("Match already decided");
    }
    this.state.round += 1;
    this.startRound();
  }

  startRound(): void {
    this.state.chain = null;
    this.state.consecutivePasses = 0;
    this.state.roundResult = undefined;
    this.resetPlayers();
    this.state.phase = "Start";
    this.state.log.push(`Round ${this.state.round} start`);
    this.runStartPhase();
    this.runDrawPhase();
    this.state.phase = "Prepare";
    this.state.activePlayer = this.state.firstPlayer;
    this.state.log.push("Enter Prepare phase");
  }

  private runStartPhase() {
    this.state.chain = null;
    this.state.triggerQueue = [];
    this.state.players.A.tempEffects = [];
    this.state.players.B.tempEffects = [];
    // enqueueTriggers already includes both players' triggers; call once to avoid double firing
    this.enqueueTriggers("OnStartPhase", "A");
    this.runTriggerQueue();
  }

  private drawCards(playerId: PlayerId, count: number): void {
    const player = this.state.players[playerId];
    if (player.deck.length < count) {
      this.setRoundWinner(opponentOf(playerId), "Deck exhaustion");
      return;
    }
    for (let i = 0; i < count; i += 1) {
      const cardId = player.deck.shift() as string;
      player.hand.push(cardId);
      const card = this.state.cardLibrary.cards[cardId];
      if (card.affinity !== "Neutral") {
        player.energy[card.affinity] += 1;
      }
      this.state.log.push(`${playerId} draws ${card.name}`);
      this.enqueueTriggers("OnDrawCard", playerId, cardId);
    }
  }

  private runDrawPhase() {
    this.state.phase = "Draw";
    this.drawCards("A", 6);
    this.drawCards("B", 6);
    this.runTriggerQueue();
  }

  private ensurePhaseActionAllowed(expected: Phase) {
    if (this.state.phase !== expected) {
      throw new Error(`Action only allowed during ${expected} phase`);
    }
  }

  private ensureActivePlayer(playerId: PlayerId) {
    if (this.state.activePlayer !== playerId) {
      throw new Error(`It is not ${playerId}'s turn`);
    }
  }

  summonCreature(playerId: PlayerId, cardId: string): void {
    if (this.state.roundResult) throw new Error("Round already finished");
    this.ensurePhaseActionAllowed("Summon");
    this.ensureActivePlayer(playerId);
    if (this.state.chain) throw new Error("Resolve chain before summoning");
    const player = this.state.players[playerId];
    const card = this.requireCard(cardId, "Creature") as CreatureCard;
    const handIndex = player.hand.indexOf(cardId);
    if (handIndex === -1) throw new Error("Card not in hand");
    const emptySlot = player.field.findIndex((c) => c === null);
    if (emptySlot === -1) throw new Error("No empty slots to summon");
    const paid = payEnergyCost(player.energy, card.affinity, card.cost);
    if (!paid) throw new Error("Insufficient energy");
    player.hand.splice(handIndex, 1);
    const instance: CreatureInPlay = {
      instanceId: `creature_${this.instanceCounter++}`,
      card,
      currentAtk: card.atk,
      currentHp: card.hp
    };
    player.field[emptySlot] = instance;
    this.state.log.push(`${playerId} summons ${card.name} to slot ${emptySlot + 1}`);
    this.enqueueTriggers("OnSummon", playerId, card.id);
    this.runTriggerQueue();
    this.finishAction(playerId);
  }

  private withEffectOverrides(card: TacticCard, overrides?: Partial<EffectDefinition>[]): TacticCard {
    if (!overrides || overrides.length === 0) return card;
    return {
      ...card,
      effects: card.effects.map((effect, idx) => {
        const override = overrides[idx];
        if (!override) return effect;
        return {
          ...effect,
          ...override,
          params: { ...effect.params, ...(override.params ?? {}) }
        };
      })
    };
  }

  playTactic(playerId: PlayerId, cardId: string, effectOverrides?: Partial<EffectDefinition>[]): void {
    if (this.state.roundResult) throw new Error("Round already finished");
    const baseCard = this.requireCard(cardId, "Tactic") as TacticCard;
    const card = this.withEffectOverrides(baseCard, effectOverrides);
    if (!card.timing.includes(this.state.phase as any)) {
      throw new Error(`Tactic ${card.name} cannot be played in ${this.state.phase}`);
    }
    this.ensureActivePlayer(playerId);
    const player = this.state.players[playerId];
    const handIndex = player.hand.indexOf(cardId);
    if (handIndex === -1) throw new Error("Card not in hand");
    player.hand.splice(handIndex, 1);
    if (!this.state.chain) {
      this.state.chain = {
        starter: playerId,
        plays: [{ player: playerId, card }],
        expectedResponder: opponentOf(playerId)
      };
      this.state.activePlayer = this.state.chain.expectedResponder ?? opponentOf(playerId);
      this.state.log.push(`${playerId} opens a chain with ${card.name}`);
      this.enqueueTriggers("OnTacticPlayed", playerId, card.id);
      return;
    }

    const chain = this.state.chain;
    if (chain.expectedResponder !== playerId) {
      throw new Error("Not allowed to respond in this chain position");
    }
    if (chain.plays.length >= 3) throw new Error("Chain is full");
    if (chain.plays.length === 1 && !card.chainable) {
      throw new Error("Responder tactic must be chainable");
    }
    if (chain.plays.length === 2 && !card.chainable) {
      throw new Error("Final chain play must be chainable");
    }
    chain.plays.push({ player: playerId, card });
    this.state.log.push(`${playerId} chains ${card.name}`);
    this.enqueueTriggers("OnTacticPlayed", playerId, card.id);
    chain.expectedResponder = chain.plays.length === 2 ? chain.starter : null;
    this.state.activePlayer = chain.expectedResponder ?? this.state.activePlayer;
    if (chain.plays.length === 3) {
      this.resolveChain();
      this.finishAction(playerId);
    }
  }

  pass(playerId: PlayerId): void {
    if (this.state.roundResult) return;
    this.ensureActivePlayer(playerId);
    if (this.state.chain) {
      this.state.log.push(`${playerId} passes on the chain`);
      this.resolveChain();
      this.finishAction(playerId);
      return;
    }
    this.state.consecutivePasses += 1;
    this.state.log.push(`${playerId} passes`);
    this.state.activePlayer = opponentOf(playerId);
    if (this.state.consecutivePasses >= 2) {
      this.advancePhase();
    }
  }

  private resolveChain() {
    const chain = this.state.chain;
    if (!chain) return;
    const reversed = [...chain.plays].reverse();
    reversed.forEach((play) => {
      play.card.effects.forEach((effect) => this.applyEffect(effect, play.player));
    });
    this.state.chain = null;
    this.state.activePlayer = opponentOf(chain.starter);
    this.state.consecutivePasses = 0;
    this.runTriggerQueue();
  }

  private finishAction(playerId: PlayerId) {
    this.state.activePlayer = opponentOf(playerId);
    this.state.consecutivePasses = 0;
  }

  private advancePhase() {
    const order: Phase[] = ["Prepare", "Summon", "Action", "Battle", "End"];
    const idx = order.indexOf(this.state.phase);
    const next = order[idx + 1];
    if (!next) return;
    this.state.consecutivePasses = 0;
    this.state.activePlayer = this.state.firstPlayer;
    this.state.log.push(`Advance to ${next} phase`);
    this.state.phase = next;
    if (next === "Battle") {
      this.runBattle();
      this.advancePhase(); // move to End
    } else if (next === "End") {
      this.runEndPhase();
    }
  }

  private runBattle() {
    if (this.state.roundResult) return;
    const totals = (player: PlayerState) => ({
      atk: sum(player.field.filter(Boolean).map((c) => (c as CreatureInPlay).currentAtk)),
      hp: sum(player.field.filter(Boolean).map((c) => (c as CreatureInPlay).currentHp))
    });
    const totalA = totals(this.state.players.A);
    const totalB = totals(this.state.players.B);
    const hpAfterA = totalA.hp - totalB.atk;
    const hpAfterB = totalB.hp - totalA.atk;
    this.applyIncomingDamage("A", totalB.atk);
    this.applyIncomingDamage("B", totalA.atk);
    this.mergeSwarm("A");
    this.mergeSwarm("B");
    let winner: PlayerId;
    if (hpAfterA > hpAfterB) winner = "A";
    else if (hpAfterB > hpAfterA) winner = "B";
    else winner = opponentOf(this.state.firstPlayer);
    this.setRoundWinner(winner, "Battle resolved");
    this.state.log.push(`Battle resolved. Winner: ${winner}`);
  }

  private applyIncomingDamage(playerId: PlayerId, damage: number) {
    const player = this.state.players[playerId];
    let remaining = damage;
    player.field.forEach((creature, index) => {
      if (!creature || remaining <= 0) return;
      const dealt = Math.min(remaining, creature.currentHp);
      creature.currentHp -= dealt;
      remaining -= dealt;
      if (creature.currentHp <= 0) {
        this.state.log.push(`${playerId} loses ${creature.card.name} from slot ${index + 1}`);
        player.trash.push(creature.card.id);
        player.field[index] = null;
        this.enqueueTriggers("OnCreatureDestroyed", playerId, creature.card.id);
      }
    });
  }

  private mergeSwarm(playerId: PlayerId) {
    const player = this.state.players[playerId];
    const counts: Record<string, CreatureInPlay[]> = {};
    player.field.forEach((creature, idx) => {
      if (!creature) return;
      const list = counts[creature.card.id] ?? [];
      list.push(creature);
      counts[creature.card.id] = list;
    });
    Object.entries(counts).forEach(([cardId, list]) => {
      if (list.length < 3) return;
      const firstSlot = player.field.findIndex((c) => c?.card.id === cardId);
      if (firstSlot === -1) return;
      const mergedAtk = Math.floor(list.reduce((acc, c) => acc + c.currentAtk, 0));
      const mergedHp = Math.floor(list.reduce((acc, c) => acc + c.currentHp, 0));
      const merged: CreatureInPlay = {
        instanceId: list[0].instanceId,
        card: list[0].card,
        currentAtk: mergedAtk,
        currentHp: mergedHp
      };
      if (list.length > 4) {
        merged.currentAtk = Math.floor(merged.currentAtk * 1.1);
        merged.currentHp = Math.floor(merged.currentHp * 1.1);
      }
      player.field = player.field.map((c, idx) => {
        if (idx === firstSlot) return merged;
        if (c?.card.id === cardId && idx !== firstSlot) {
          player.trash.push(c.card.id);
          return null;
        }
        return c;
      });
      this.state.log.push(`${playerId} merges ${list.length} copies of ${list[0].card.name}`);
    });
  }

  private runEndPhase() {
    this.state.phase = "End";
    this.clearTemporaryEffects(this.state.players.A);
    this.clearTemporaryEffects(this.state.players.B);
    this.runTriggerQueue();
    this.state.log.push("End phase cleanup");
    if (this.state.roundResult && this.state.matchScore[this.state.roundResult.winner!] >= 2) {
      this.state.log.push(`Match winner: ${this.state.roundResult.winner}`);
    }
    this.enqueueTriggers("OnEndPhase", "A");
    this.enqueueTriggers("OnEndPhase", "B");
    this.runTriggerQueue();
  }

  private clearTemporaryEffects(player: PlayerState) {
    player.tempEffects.forEach((effect) => {
      player.field.forEach((creature) => {
        if (creature && creature.instanceId === effect.instanceId) {
          creature.currentAtk -= effect.atkDelta ?? 0;
          creature.currentHp -= effect.hpDelta ?? 0;
        }
      });
    });
    player.tempEffects = [];
  }

  private applyEffect(effect: EffectDefinition, actor: PlayerId) {
    switch (effect.kind) {
      case "ModifyStats":
        this.applyModifyStats(effect, actor);
        break;
      case "DrawCards":
        this.applyDrawCards(effect, actor);
        break;
      case "DiscardFromHand":
        this.applyDiscardFromHand(effect, actor);
        break;
      case "DiscardSpecificFromHand":
        this.applyDiscardSpecificFromHand(effect, actor);
        break;
      case "SummonSpecific":
      case "SummonSpecificFromHand":
      case "SummonSpecificFromDeck":
        this.applySummon(effect, actor);
        break;
      case "TutorFromDeck":
        this.applyTutorFromDeck(effect, actor);
        break;
      default:
        throw new Error(`Unsupported effect ${effect.kind}`);
    }
  }

  private applyModifyStats(effect: EffectDefinition, actor: PlayerId) {
    const targets = this.selectTargets(effect.target, actor);
    targets.forEach((t) => {
      if (!t.card) return;
      const atkDelta = Number((effect.params as any).atkDelta ?? 0);
      const hpDelta = Number((effect.params as any).hpDelta ?? 0);
      t.card.currentAtk += atkDelta;
      t.card.currentHp += hpDelta;
      if (effect.duration === "UntilEndOfRound") {
        const temp = this.state.players[t.player].tempEffects;
        temp.push({
          instanceId: t.card.instanceId,
          atkDelta,
          hpDelta,
          expires: "EndOfRound"
        });
      }
      this.state.log.push(
        `${actor} buffs ${t.card.card.name} ${atkDelta ? `ATK ${atkDelta}` : ""} ${
          hpDelta ? `HP ${hpDelta}` : ""
        }`
      );
    });
  }

  private applyDrawCards(effect: EffectDefinition, actor: PlayerId) {
    const count = Number((effect.params as any).count ?? 1);
    const targets = this.selectTargets(effect.target, actor);
    targets.forEach((t) => {
      this.drawCards(t.player, count);
    });
  }

  private applyDiscardFromHand(effect: EffectDefinition, actor: PlayerId) {
    const count = Number((effect.params as any).count ?? 1);
    const random = Boolean((effect.params as any).random);
    const targets = this.selectTargets(effect.target, actor);
    targets.forEach((t) => {
      const player = this.state.players[t.player];
      const pool = [...player.hand];
      if (random) {
        this.rng.shuffle(pool)
          .slice(0, count)
          .forEach((cardId) => {
            player.hand.splice(player.hand.indexOf(cardId), 1);
            player.trash.push(cardId);
            this.state.log.push(`${t.player} discards ${cardId}`);
          });
      } else {
        for (let i = 0; i < count && player.hand.length; i += 1) {
          const cardId = player.hand.shift() as string;
          player.trash.push(cardId);
          this.state.log.push(`${t.player} discards ${cardId}`);
        }
      }
    });
  }

  private applyDiscardSpecificFromHand(effect: EffectDefinition, actor: PlayerId) {
    const params = effect.params as { cardId?: string; count?: number };
    const count = params.count ?? 1;
    const targets = this.selectTargets(effect.target, actor);
    targets.forEach((t) => {
      const player = this.state.players[t.player];
      for (let i = 0; i < count; i += 1) {
        const cardId = params.cardId ?? player.hand[0];
        if (!cardId) return;
        const handIndex = player.hand.indexOf(cardId);
        if (handIndex === -1) return;
        player.hand.splice(handIndex, 1);
        player.trash.push(cardId);
        this.state.log.push(`${t.player} discards ${cardId}`);
      }
    });
  }

  private applySummon(effect: EffectDefinition, actor: PlayerId) {
    const params = effect.params as { cardId: string; count?: number; ignoreCost?: boolean };
    const count = params.count ?? 1;
    const targets = this.selectTargets(effect.target, actor);
    targets.forEach((t) => {
      const player = this.state.players[t.player];
      let remaining = count;
      const fieldSlots = player.field;
      for (let slot = 0; slot < fieldSlots.length && remaining > 0; slot += 1) {
        if (fieldSlots[slot] !== null) continue;
        const creature = this.requireCard(params.cardId, "Creature") as CreatureCard;
        if (!params.ignoreCost && !payEnergyCost(player.energy, creature.affinity, creature.cost)) {
          break;
        }
        fieldSlots[slot] = {
          instanceId: `creature_${this.instanceCounter++}`,
          card: creature,
          currentAtk: creature.atk,
          currentHp: creature.hp
        };
        remaining -= 1;
        this.state.log.push(`${t.player} summons ${creature.name} by effect to slot ${slot + 1}`);
      }
    });
  }

  private applyTutorFromDeck(effect: EffectDefinition, actor: PlayerId) {
    const params = effect.params as { cardId?: string; count?: number };
    const count = params.count ?? 1;
    const targets = this.selectTargets(effect.target, actor);
    targets.forEach((t) => {
      const player = this.state.players[t.player];
      for (let i = 0; i < count; i += 1) {
        const cardId = params.cardId ?? player.deck[0];
        if (!cardId) return;
        const deckIndex = player.deck.indexOf(cardId);
        if (deckIndex === -1) throw new Error(`Card ${cardId} not in deck`);
        player.deck.splice(deckIndex, 1);
        player.hand.push(cardId);
        const card = this.state.cardLibrary.cards[cardId];
        if (card.affinity !== "Neutral") {
          player.energy[card.affinity] += 1;
        }
        this.state.log.push(`${t.player} adds ${card.name} to hand`);
      }
    });
  }

  private selectTargets(selector: TargetSelector, actor: PlayerId): TargetRef[] {
    const targets: TargetRef[] = [];
    const players: PlayerId[] =
      selector.owner === "both" ? ["A", "B"] : selector.owner === "self" ? [actor] : [opponentOf(actor)];

    players.forEach((pid) => {
      if (!selector.zone) {
        targets.push({ player: pid });
        return;
      }

      if (selector.zone === "Field") {
        const slots = this.state.players[pid].field;
        slots.forEach((creature, idx) => {
          if (!creature) return;
          if (selector.cardType && selector.cardType !== "Creature") return;
          if (selector.id && selector.id !== creature.card.id) return;
          if (selector.affinity) {
            if (
              selector.affinity.startsWith("non-") &&
              (selector.affinity as string).slice(4) === creature.card.affinity
            ) {
              return;
            }
            if (!selector.affinity.startsWith("non-") && selector.affinity !== creature.card.affinity) {
              return;
            }
          }
          if (selector.position && !selector.position.includes(idx + 1)) return;
          targets.push({ player: pid, card: creature, slot: idx });
        });
      } else if (selector.zone === "Hand") {
        targets.push({ player: pid });
      } else if (selector.zone === "Deck") {
        targets.push({ player: pid });
      }
    });

    const ordered = selector.random
      ? this.rng.shuffle(targets)
      : targets;
    return selector.count ? ordered.slice(0, selector.count) : ordered;
  }

  private requireCard(id: string, type: "Creature" | "Tactic"): CardDefinition {
    const card = this.state.cardLibrary.cards[id];
    if (!card || card.type !== type) {
      throw new Error(`Card ${id} not found as ${type}`);
    }
    return card;
  }

  private enqueueTriggers(event: any, owner: PlayerId, cardId?: string) {
    const triggers = this.state.players[owner].triggers.filter((t) => t.event === event);
    const opponentTriggers = this.state.players[opponentOf(owner)].triggers.filter(
      (t) => t.event === event
    );
    const maybeQueue = (list: typeof triggers) => {
      list.forEach((t) => {
        const ctx = {
          player: this.state.players[t.owner],
          opponent: this.state.players[opponentOf(t.owner)],
          cardId
        };
        if (!t.condition || t.condition(ctx)) {
          this.state.triggerQueue.push(t);
        }
      });
    };
    maybeQueue(triggers);
    maybeQueue(opponentTriggers);
  }

  private runTriggerQueue() {
    while (this.state.triggerQueue.length) {
      const trigger = this.state.triggerQueue.shift()!;
      trigger.effects.forEach((e) => this.applyEffect(e, trigger.owner));
      if (trigger.duration === "OneShot") {
        const ownerTriggers = this.state.players[trigger.owner].triggers;
        this.state.players[trigger.owner].triggers = ownerTriggers.filter((t) => t !== trigger);
      }
    }
  }

  private setRoundWinner(winner: PlayerId, reason: string) {
    if (this.state.roundResult) return;
    this.state.roundResult = { winner, reason };
    this.state.matchScore[winner] += 1;
  }
}
