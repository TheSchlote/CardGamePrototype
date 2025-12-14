# How to Play

## Objective
Win a best-of-3 match by taking two rounds. Each round is decided after the Battle phase; the player with higher remaining HP wins (ties go to the non-starting player).

## Controls (UI)
- **Select a card:** Click any card in your hand to highlight it.
- **Play Tactic:** With a Tactic selected and the phase allowing it (Prepare, Summon, or Action as listed on the card), click **Play Tactic**.
- **Summon Creature:** With a Creature selected during the Summon phase, click **Summon**. You must have energy equal to its affinity cost and an empty field slot.
- **Pass:** Click **Pass** to end your turn in the current phase. Two consecutive passes advance to the next phase.
- **Start Next Round:** After a round ends, click **Start Next Round** to continue the match.

## Round Flow
1. **Start:** Cleanup and triggers reset.
2. **Draw:** Both players draw 6; each non-Neutral draw grants +1 energy of that affinity.
3. **Prepare:** Alternate playing eligible Tactics or passing.
4. **Summon:** Alternate summoning creatures or playing Summon-phase Tactics.
5. **Action:** Alternate playing Action-phase Tactics; chain responses resolve last-in, first-out.
6. **Battle:** Totals compute; damage distributes across board slots; swarms of 3+ identical creatures merge.
7. **End:** Temporary effects clear; round result recorded. Match ends at 2 round wins.

## Additional Rules (high level)
- **Energy:** Per-affinity pools; creature costs must be paid with matching affinity (Neutral costs are flexible). Energy resets between rounds.
- **Chains:** A Tactic can start a chain; the opponent may respond with a chainable Tactic, then the starter may respond once. The chain resolves LIFO and all used Tactics go to trash.
- **AI:** Player B auto-plays when it is active; turns advance after its actions.

## Local play
```bash
npm install
npm run dev
```
Open the printed localhost URL. Use the buttons on the Hand panel to act with the selected card.
