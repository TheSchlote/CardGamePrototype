import cardsFile from "@data/cards.json";
import decksFile from "@data/decks.json";
import { AFFINITIES, Stage } from "./constants";
import type { CardDefinition, CardLibrary, CreatureCard, DeckList, TacticCard } from "./types";

interface CardsFileShape {
  schemaVersion: number;
  affinities: string[];
  cards: CardDefinition[];
}

interface DecksFileShape {
  schemaVersion: number;
  decks: DeckList[];
}

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

const normalizeCreature = (card: CardDefinition): CreatureCard => {
  const creature = card as CreatureCard;
  const stage = typeof creature.stage === "number" ? clamp(creature.stage, 0, 4) : clamp(creature.cost, 0, 4);
  return { ...creature, stage };
};

const normalizeCard = (card: CardDefinition): CardDefinition => {
  if (card.type === "Creature") {
    return normalizeCreature(card);
  }
  const tactic = card as TacticCard;
  const timing = Array.from(new Set(tactic.timing));
  return { ...tactic, timing };
};

export const loadCardLibrary = (): CardLibrary => {
  const data = cardsFile as CardsFileShape;
  if (data.schemaVersion !== 1) {
    throw new Error(`Unsupported cards schema ${data.schemaVersion}`);
  }
  data.affinities.forEach((affinity) => {
    if (!AFFINITIES.includes(affinity as any)) {
      throw new Error(`Unknown affinity in data: ${affinity}`);
    }
  });
  const cards = data.cards.map(normalizeCard);
  const dictionary: Record<string, CardDefinition> = {};
  cards.forEach((card) => {
    dictionary[card.id] = card;
  });
  return { cards: dictionary };
};

export const loadDecks = (): DeckList[] => {
  const data = decksFile as DecksFileShape;
  if (data.schemaVersion !== 1) {
    throw new Error(`Unsupported decks schema ${data.schemaVersion}`);
  }
  return data.decks;
};

export const expandDeck = (deck: DeckList): string[] => {
  const cards: string[] = [];
  deck.cards.forEach((item) => {
    for (let i = 0; i < item.count; i += 1) {
      cards.push(item.id);
    }
  });
  return cards;
};
