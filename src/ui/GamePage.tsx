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
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const forceUpdate = () => setTick((t) => t + 1);
  const state = engine.state;
  const cardPool = state.cardLibrary.cards;

  const activeHand = state.players.A.hand.map((id: string) => cardPool[id] as CardDefinition);

  const handleSummon = () => {
    if (!selectedCardId) return;
    try {
      engine.summonCreature("A", selectedCardId);
      setMessage("");
      forceUpdate();
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  const handlePlayTactic = () => {
    if (!selectedCardId) return;
    try {
      engine.playTactic("A", selectedCardId);
      setMessage("");
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
      setSelectedCardId(null);
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
    selectedCardId &&
    cardPool[selectedCardId]?.type === "Creature" &&
    state.phase === "Summon" &&
    state.activePlayer === "A" &&
    !state.roundResult;

  const canPlayTactic =
    selectedCardId &&
    cardPool[selectedCardId]?.type === "Tactic" &&
    (cardPool[selectedCardId] as TacticCard).timing.includes(state.phase as any) &&
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
      </div>
    );

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
              Summon
            </button>
            <button className="ghost" onClick={handlePass} disabled={!!state.roundResult}>
              Pass
            </button>
          </div>
        </div>
        <div className="hand-cards">
          {activeHand.map((card, idx) => {
            const isSelected = selectedCardId === card.id;
            return (
              <div
                key={`hand-${idx}-${card.id}`}
                className={`hand-card ${isSelected ? "selected" : ""}`}
                style={{ borderColor: affinityColors[card.affinity] }}
                onClick={() => setSelectedCardId(card.id)}
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
    </div>
  );
};

export default GamePage;
