import fs from "fs";
import path from "path";

const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

const readJsonWithComments = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const stripped = raw
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//")) return "";
      return line;
    })
    .join("\n");
  return JSON.parse(stripped);
};

const normalizeCard = (card) => {
  if (card.type === "Creature") {
    return {
      ...card,
      stage: Number.isFinite(card.stage) ? clamp(card.stage, 0, 4) : clamp(card.cost, 0, 4)
    };
  }
  if (card.type === "Tactic") {
    return {
      ...card,
      timing: Array.from(new Set(card.timing)),
      effects: card.effects.map((effect) => {
        if (effect.kind === "SummonFromHandById") {
          return { ...effect, kind: "SummonSpecificFromHand" };
        }
        return effect;
      })
    };
  }
  return card;
};

const main = () => {
  const sourcePath = path.resolve("starterDeck.json");
  const data = readJsonWithComments(sourcePath);
  const cards = data.cards.map(normalizeCard);
  const outDir = path.resolve("generated");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }
  fs.writeFileSync(
    path.join(outDir, "cards.json"),
    JSON.stringify({ schemaVersion: 1, affinities: data.affinities, cards }, null, 2)
  );
  fs.writeFileSync(
    path.join(outDir, "decks.json"),
    JSON.stringify({ schemaVersion: 1, decks: data.decks }, null, 2)
  );
  console.log("Converted starterDeck.json into generated/cards.json and generated/decks.json");
};

main();
