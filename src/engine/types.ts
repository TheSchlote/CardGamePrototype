import { AFFINITIES, FIELD_SLOTS, Phase, Stage, type Affinity } from "./constants";

export type PlayerId = "A" | "B";

export type PhaseTiming = Exclude<Phase, "Start" | "Draw" | "Battle" | "End">;

export type CardType = "Creature" | "Tactic";

export interface CardBase {
  id: string;
  name: string;
  affinity: Affinity;
}

export interface CreatureCard extends CardBase {
  type: "Creature";
  stage?: Stage;
  cost: number;
  atk: number;
  hp: number;
  keywords?: string[];
}

export interface TacticCard extends CardBase {
  type: "Tactic";
  timing: PhaseTiming[];
  effects: EffectDefinition[];
  chainable: boolean;
  tags?: string[];
}

export type CardDefinition = CreatureCard | TacticCard;

export interface DeckListItem {
  id: string;
  count: number;
}

export interface DeckList {
  id: string;
  name: string;
  size: number;
  cards: DeckListItem[];
}

export interface EffectDefinition {
  kind:
    | "ModifyStats"
    | "DrawCards"
    | "DiscardFromHand"
    | "DiscardSpecificFromHand"
    | "SummonSpecificFromHand"
    | "SummonSpecificFromDeck"
    | "SummonSpecific"
    | "TutorFromDeck";
  target: TargetSelector;
  params: Record<string, unknown>;
  duration?: "Instant" | "UntilEndOfRound";
}

export interface TargetSelector {
  owner: "self" | "opponent" | "both";
  zone?: "Field" | "Hand" | "Deck" | "Trash" | "Energy";
  cardType?: CardType;
  affinity?: Affinity | `non-${Affinity}`;
  id?: string;
  count?: number;
  random?: boolean;
  position?: number[];
}

export type TriggerEvent =
  | "OnStartPhase"
  | "OnEndPhase"
  | "OnDrawCard"
  | "OnSummon"
  | "OnTacticPlayed"
  | "OnCreatureDestroyed";

export interface Trigger {
  owner: PlayerId;
  event: TriggerEvent;
  condition?: (ctx: TriggerContext) => boolean;
  effects: EffectDefinition[];
  duration: "OneShot" | "UntilEndOfRound";
}

export interface TriggerContext {
  player: PlayerState;
  opponent: PlayerState;
  cardId?: string;
}

export interface TemporaryEffect {
  instanceId: string;
  atkDelta?: number;
  hpDelta?: number;
  expires: "EndOfRound";
}

export interface CreatureInPlay {
  instanceId: string;
  card: CreatureCard;
  currentAtk: number;
  currentHp: number;
}

export type EnergyPool = Record<Affinity, number>;

export interface PlayerState {
  id: PlayerId;
  deck: string[];
  hand: string[];
  trash: string[];
  field: (CreatureInPlay | null)[];
  energy: EnergyPool;
  tempEffects: TemporaryEffect[];
  triggers: Trigger[];
}

export interface CardLibrary {
  cards: Record<string, CardDefinition>;
}

export interface ChainPlay {
  player: PlayerId;
  card: TacticCard;
}

export interface ChainState {
  starter: PlayerId;
  plays: ChainPlay[];
  expectedResponder: PlayerId | null;
}

export interface RoundResult {
  winner: PlayerId | null;
  reason: string;
}

export interface GameState {
  phase: Phase;
  firstPlayer: PlayerId;
  activePlayer: PlayerId;
  players: Record<PlayerId, PlayerState>;
  cardLibrary: CardLibrary;
  decklists: Record<PlayerId, DeckList>;
  round: number;
  matchScore: Record<PlayerId, number>;
  chain: ChainState | null;
  consecutivePasses: number;
  triggerQueue: Trigger[];
  rngSeed: number;
  log: string[];
  roundResult?: RoundResult;
}

export const emptyEnergy = (): EnergyPool =>
  Object.fromEntries(AFFINITIES.map((a) => [a, 0])) as EnergyPool;

export const emptyField = (): (CreatureInPlay | null)[] => new Array(FIELD_SLOTS).fill(null);
