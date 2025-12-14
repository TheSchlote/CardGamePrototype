import { useEffect, useMemo, useRef, useState } from "react";
import {
  AFFINITIES,
  GameEngine,
  runAiStep,
  type Affinity,
  type CardDefinition,
  type CreatureCard,
  type CreatureInPlay,
  type PlayerId,
  type TacticCard
} from "@engine";
import { payEnergyCost } from "@engine/utils";

const affinityColors: Record<string, string> = {
  Nature: "#67d67a",
  Fire: "#ff6b6b",
  Water: "#67b7ff",
  Earth: "#c89b6c",
  Energy: "#f5c542",
  Dark: "#9b7bff",
  Light: "#f2f2f2",
  Neutral: "#8892b0"
};

const StatPill = ({ label, value, color }: { label: string; value: number; color?: string }) => (
  <div className="pill" style={{ borderColor: color ?? "#6c7b92" }}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const CardBadge = ({ card }: { card: CreatureCard }) => (
  <div
    className="card-badge"
    style={{
      borderColor: affinityColors[card.affinity],
      background: "rgba(17,24,39,0.75)"
    }}
  >
    <div className="card-title">{card.name}</div>
    <div className="card-stats">
      <span>AP {card.atk}</span>
      <span>HP {card.hp}</span>
    </div>
  </div>
);

const FieldSlot = ({ card }: { card: CreatureCard | null }) => {
  if (!card) {
    return <div className="slot empty" />;
  }
  return (
    <div className="slot">
      <CardBadge card={card} />
    </div>
  );
};

const GamePage = () => {
  const engineRef = useRef<GameEngine>();
  if (!engineRef.current) {
    engineRef.current = new GameEngine({ seed: 2024 });
  }
  const engine = engineRef.current;
  const [, setTick] = useState(0);
  const [message, setMessage] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [tradeModal, setTradeModal] = useState<{
    tacticKey: string;
    discardKey?: string;
    deckChoice?: string;
  } | null>(null);

  const forceUpdate = () => setTick((t) => t + 1);
  const state = engine.state;
  const cardPool = state.cardLibrary.cards;

  const handEntries = state.players.A.hand.map((id: string, idx: number) => ({
    key: `${idx}-${id}`,
    id,
    card: cardPool[id] as CardDefinition
  }));

  const selectedTacticEntry = handEntries.find(
    (h) => selectedKeys.includes(h.key) && h.card.type === "Tactic"
  );
  const selectedSummonEntries = handEntries.filter(
    (h) => selectedKeys.includes(h.key) && h.card.type === "Creature"
  );

  const clearSelection = () => setSelectedKeys([]);

  const handleSummon = () => {
    if (!selectedSummonEntries.length) return;
    let summoned = 0;
    let firstError: string | null = null;
    const idsToSummon = selectedSummonEntries.map((e) => e.id);
    for (const cardId of idsToSummon) {
      try {
        engine.state.activePlayer = "A";
        engine.summonCreature("A", cardId);
        summoned += 1;
      } catch (err: any) {
        firstError = firstError ?? err.message;
      }
    }
    engine.state.activePlayer = "A";
    setMessage(firstError ?? "");
    clearSelection();
    forceUpdate();
  };

  const handlePlayTactic = () => {
    const tactic = selectedTacticEntry;
    if (!tactic) return;
    if (tactic.id === "tactic_trade" && state.activePlayer === "A") {
      const discardable = handEntries.filter((h) => h.key !== tactic.key);
      if (!discardable.length) {
        setMessage("No other cards to trade.");
        return;
      }
      setTradeModal({ tacticKey: tactic.key });
      return;
    }
    try {
      engine.playTactic("A", tactic.id);
      setMessage("");
      clearSelection();
      forceUpdate();
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handlePass = () => {
    engine.pass("A");
    setMessage("");
    forceUpdate();
  };

  const startNextRound = () => {
    try {
      engine.startNextRound();
      clearSelection();
      setMessage("");
      forceUpdate();
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  useEffect(() => {
    if (state.roundResult || state.activePlayer !== "B") return;
    const id = setTimeout(() => {
      try {
        runAiStep(engine, "B");
        setMessage("");
      } catch (err: any) {
        setMessage(err.message);
      }
      forceUpdate();
    }, 260);
    return () => clearTimeout(id);
  }, [state.activePlayer, state.phase, state.chain, state.roundResult]);

  const renderFieldRow = (playerId: PlayerId) => {
    const player = state.players[playerId];
    return (
      <div className="field-row">
        {player.field.map((creature: CreatureInPlay | null, idx: number) => (
          <FieldSlot key={`${playerId}-${idx}`} card={creature?.card ?? null} />
        ))}
      </div>
    );
  };

  const totalStats = useMemo(() => {
    const compute = (playerId: PlayerId) => {
      const field = state.players[playerId].field;
      const atk = field.reduce<number>((acc, c) => acc + (c?.currentAtk ?? 0), 0);
      const hp = field.reduce<number>((acc, c) => acc + (c?.currentHp ?? 0), 0);
      return { atk, hp };
    };
    return { A: compute("A"), B: compute("B") };
  }, [state.players.A.field, state.players.B.field]);

  const canSummon =
    selectedSummonEntries.length > 0 &&
    state.phase === "Summon" &&
    state.activePlayer === "A" &&
    !state.roundResult &&
    !state.chain;

  const canPlayTactic =
    !!selectedTacticEntry &&
    (selectedTacticEntry.card as TacticCard).timing.includes(state.phase as any) &&
    state.activePlayer === "A" &&
    !state.roundResult;

  const roundBanner =
    state.roundResult && (
      <div className="banner">
        <strong>Round {state.round} winner: {state.roundResult.winner}</strong>
        {Math.max(state.matchScore.A, state.matchScore.B) < 2 && (
          <button className="cta" onClick={startNextRound}>
            Start Next Round
          </button>
        )}
        {Math.max(state.matchScore.A, state.matchScore.B) >= 2 && (
          <button
            className="ghost"
            onClick={() => {
              engineRef.current = new GameEngine({ seed: 2024 });
              clearSelection();
              setTradeModal(null);
              setMessage("");
              forceUpdate();
            }}
          >
            Restart Match
          </button>
        )}
      </div>
    );

  const playableClassForCard = (card: CardDefinition) => {
    if (card.type !== "Tactic") return "";
    const allowed =
      card.timing.includes(state.phase as any) && state.activePlayer === "A" && !state.roundResult && !state.chain;
    return allowed ? "playable" : "";
  };

  const handleCardClick = (entryKey: string) => {
    const entry = handEntries.find((h) => h.key === entryKey);
    if (!entry) return;
    if (
      state.phase === "Summon" &&
      entry.card.type === "Creature" &&
      state.activePlayer === "A" &&
      !state.roundResult
    ) {
      setSelectedKeys((prev) => (prev.includes(entryKey) ? prev.filter((k) => k !== entryKey) : [...prev, entryKey]));
    } else {
      setSelectedKeys([entryKey]);
    }
  };

  const discardOptions = tradeModal
    ? handEntries.filter((h) => h.key !== tradeModal.tacticKey)
    : [];
  const deckOptions = tradeModal
    ? state.players.A.deck.map((id, idx) => ({ key: `deck-${idx}-${id}`, id, card: cardPool[id] }))
    : [];

  const handleConfirmTrade = () => {
    if (!tradeModal?.discardKey || !tradeModal.deckChoice) return;
    const discardEntry = handEntries.find((h) => h.key === tradeModal.discardKey);
    const tactic = handEntries.find((h) => h.key === tradeModal.tacticKey);
    if (!discardEntry || !tactic) {
      setTradeModal(null);
      return;
    }
    try {
      engine.playTactic("A", tactic.id, [
        { params: { cardId: discardEntry.id } },
        { params: { cardId: tradeModal.deckChoice } }
      ]);
      setMessage("");
      setTradeModal(null);
      clearSelection();
      forceUpdate();
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  // Auto-pass when it's Player A's turn and no legal actions exist
  useEffect(() => {
    if (state.roundResult) return;
    if (state.activePlayer !== "A") return;

    const phase = state.phase;
    const hasEmptySlot = state.players.A.field.some((slot) => slot === null);

    const hasSummonAvailable =
      phase === "Summon" &&
      hasEmptySlot &&
      handEntries.some((h) => {
        if (h.card.type !== "Creature") return false;
        const energyCopy = { ...state.players.A.energy };
        return payEnergyCost(energyCopy as any, (h.card as CreatureCard).affinity, (h.card as CreatureCard).cost);
      });

    const chain = state.chain;
    const canRespondInChain =
      !!chain &&
      chain.expectedResponder === "A" &&
      handEntries.some((h) => {
        if (h.card.type !== "Tactic") return false;
        if (!(h.card as TacticCard).timing.includes(phase as any)) return false;
        const chainLen = chain.plays.length;
        if (chainLen === 0) return true;
        if (chainLen === 1 || chainLen === 2) return h.card.chainable;
        return false;
      });

    const canStartTactic =
      !chain &&
      ["Prepare", "Summon", "Action"].includes(phase) &&
      handEntries.some((h) => h.card.type === "Tactic" && (h.card as TacticCard).timing.includes(phase as any));

    const hasAction = chain ? canRespondInChain : hasSummonAvailable || canStartTactic;

    if (!hasAction) {
      engine.pass("A");
      setMessage("");
      forceUpdate();
    }
  }, [
    engine,
    forceUpdate,
    handEntries,
    state.activePlayer,
    state.chain,
    state.phase,
    state.players.A.energy,
    state.players.A.field,
    state.roundResult
  ]);

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <div className="eyebrow">Round</div>
          <div className="headline">{state.round}</div>
        </div>
        <div className="score">
          <span className="label">Match</span>
          <span className="value">
            A {state.matchScore.A} : {state.matchScore.B} B
          </span>
        </div>
        <div className="phase">
          <span>Phase</span>
          <strong>{state.phase}</strong>
        </div>
      </header>

      {roundBanner}
      {message && <div className="toast">{message}</div>}

      <section className="board">
        <div className="player-row">
          <div className="info">
            <div className="label">Player B</div>
            <div className="metrics">
              <StatPill label="AP" value={totalStats.B.atk} color="#91a7ff" />
              <StatPill label="HP" value={totalStats.B.hp} color="#b197fc" />
              <StatPill label="Deck" value={state.players.B.deck.length} />
              <StatPill label="Trash" value={state.players.B.trash.length} />
            </div>
          </div>
          <div className="energy">
            {AFFINITIES.map((a: Affinity) => (
              <StatPill
                key={`energy-b-${a}`}
                label={a.slice(0, 2)}
                value={state.players.B.energy[a]}
                color={affinityColors[a]}
              />
            ))}
          </div>
        </div>
        {renderFieldRow("B")}
        <div className="center-rail">
          <div className="chain">
            <span>Active Player: {state.activePlayer}</span>
            {state.chain ? (
              <span>Chain: {state.chain.plays.map((p) => p.card.name).join(" → ")}</span>
            ) : (
              <span>No chain</span>
            )}
          </div>
        </div>
        {renderFieldRow("A")}
        <div className="player-row">
          <div className="info">
            <div className="label">Player A (You)</div>
            <div className="metrics">
              <StatPill label="AP" value={totalStats.A.atk} color="#4dd4ac" />
              <StatPill label="HP" value={totalStats.A.hp} color="#64dfdf" />
              <StatPill label="Deck" value={state.players.A.deck.length} />
              <StatPill label="Trash" value={state.players.A.trash.length} />
            </div>
          </div>
          <div className="energy">
            {AFFINITIES.map((a: Affinity) => (
              <StatPill
                key={`energy-a-${a}`}
                label={a.slice(0, 2)}
                value={state.players.A.energy[a]}
                color={affinityColors[a]}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="hand">
        <div className="hand-header">
          <span>Hand</span>
          <div className="actions">
            <button className="cta" disabled={!canPlayTactic} onClick={handlePlayTactic}>
              Play Tactic
            </button>
            <button className="cta" disabled={!canSummon} onClick={handleSummon}>
              Summon Selected
            </button>
            <button className="ghost" onClick={handlePass} disabled={!!state.roundResult}>
              Pass
            </button>
          </div>
        </div>
        <div className="hand-cards">
          {handEntries.map((entry, idx) => {
            const isSelected = selectedKeys.includes(entry.key);
            const card = entry.card;
            return (
              <div
                key={`hand-${idx}-${entry.id}`}
                className={`hand-card ${isSelected ? "selected" : ""} ${playableClassForCard(card)}`}
                style={{ borderColor: affinityColors[card.affinity] }}
                onClick={() => handleCardClick(entry.key)}
              >
                <div className="card-header">
                  <span className="affinity" style={{ color: affinityColors[card.affinity] }}>
                    {card.affinity}
                  </span>
                  <span className="card-name">{card.name}</span>
                </div>
                {card.type === "Creature" ? (
                  <div className="card-body">
                    <div>Cost {card.cost}</div>
                    <div>
                      AP {card.atk} / HP {card.hp}
                    </div>
                  </div>
                ) : (
                  <div className="card-body">
                    <div>{(card as TacticCard).timing.join(", ")}</div>
                    <div>{(card as TacticCard).tags?.join(", ") ?? "Tactic"}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="log">
        <div className="log-title">Log</div>
        <ul>
          {[...state.log].slice(-10).reverse().map((entry, idx) => (
            <li key={idx}>{entry}</li>
          ))}
        </ul>
      </section>

      {tradeModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Trade</h3>
            <div className="modal-section">
              <div className="modal-label">1) Discard</div>
              <div className="modal-grid">
                {discardOptions.map((opt) => {
                  const active = tradeModal.discardKey === opt.key;
                  const card = opt.card;
                  const tint = affinityColors[card.affinity];
                  return (
                    <button
                      key={opt.key}
                      className={`chip ${active ? "active" : ""}`}
                      style={{
                        borderColor: tint,
                        color: tint,
                        background: `${tint}22`
                      }}
                      onClick={() => setTradeModal({ ...tradeModal, discardKey: opt.key })}
                    >
                      {card.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="modal-section">
              <div className="modal-label">2) Take from deck</div>
              <div className="modal-grid">
                {deckOptions.map((opt) => {
    const card = opt.card;
    const active = tradeModal.deckChoice === opt.id;
    const tint = affinityColors[card.affinity];
                  return (
                    <button
                      key={opt.key}
                      className={`chip ${active ? "active" : ""}`}
                      style={{
                        borderColor: tint,
                        color: tint,
                        background: `${tint}22`
                      }}
                      onClick={() => setTradeModal({ ...tradeModal, deckChoice: opt.id })}
                    >
                      {card.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="modal-actions">
              <button className="ghost" onClick={() => setTradeModal(null)}>
                Cancel
              </button>
              <button
                className="cta"
                disabled={!tradeModal.discardKey || !tradeModal.deckChoice}
                onClick={handleConfirmTrade}
              >
                Confirm Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamePage;
