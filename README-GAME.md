# Number Flip: playable build (V2)

Open `index.html` in Chrome, or run a local server from this folder (`npx serve .`) and open the link it prints.

## What's here

| Path | What it holds |
| --- | --- |
| `index.html` | The page: stage, screens and buttons |
| `css/style.css` | Layout on a fixed 1920 × 1080 stage that scales to any screen |
| `js/content.js` | Every line, card and step from the V2 sheet ("Number flip - Game V2 (2)", 19 Nov) and the pre-game instructions from "Number flip - Sheet6", with the sheet's row numbers in comments. Edit content here. |
| `js/game.js` | Game flow (a step runner that plays the sheet row by row), rendering, sound and every GSAP animation |
| `vendor/gsap.min.js` | GSAP 3.12.5 |

## How it plays (V2 sheet, 19 Nov version)

The game follows the sheet row by row, including every computer turn and its sums. Usually the learner and the computer take turns.
After the learner's own Skip, Reverse or Mystery card the learner plays again straight away, and after the computer's Reverse, Skip
or Mystery the computer plays again. On the computer's turn its three cards turn face up beside it ("COMPUTER'S CARDS"); it checks
them one by one, puts back the ones that don't match, plays the match, and the equation panel shows its working.

Each part opens on its rule screen (the table blurs behind it); the learner taps LET'S PLAY when ready. In Parts 3 to 5 the rule
screen shows the sheet's short rule plus a small animation (brackets shifting; 3 × (4 + 2) as blocks that split; 8 with +0 and ×1),
then the property name glows. Sound and "Read lines aloud" are in the pause menu.

Screen layout (Sheet6):
- **Dialogue box** across the top of the table: every line Flippy says. A **YOUR TURN / COMPUTER'S TURN** tag sits on its top edge and turns over when the turn changes (struck through on Skip, spins on Reverse). The on-screen text sits on its bottom edge, only when it adds something.
- **Your hand**: every card face up in a row at the bottom; more than 7 wait in a small "+N" pile beside the row. Each turn the sheet's cards for that turn appear in the hand; any card can be tapped. The computer's cards stay face down beside it.
- **Card counts** for both players all game long; the **DRAW PILE** is labelled on the table.
- **Hint (?)** beside pause: opens this part's rule, how to find the match and the game rules; the game is paused underneath and BACK TO GAME returns to the same turn.
- **Inactivity**: a hand points at the card, pile or button to use (it never taps for the learner).
- **Game end**: YOU WIN! with confetti when the learner plays the last card; COMPUTER WINS! TRY AGAIN! (with a replay button) if the computer ever runs out of cards first.

1. **Hook** (Sheet6 lines 1–2): "Welcome to the Number Card Challenge!", then cards fly in, shuffle into a deck, the title glows.
2. **Setup** (lines 3–6): "Two players, one challenge!", "Match the cards correctly and clear your hand.", 7 cards dealt to each player (yours face up, the computer's face down), "The player who finishes all their cards first wins!", tap NEXT.
3. **How to Play** (lines 7–11): tap each special card (Skip / Reverse / Swap / FLIP) to see it; draw one card from the pile; tap the Hint (?) button and close it; the cards are reshuffled (7 each) and a centre card placed; Flippy's hand shows one example (2 + 3 → 3 + 2, both make 5); "Now, ready to play? Let's begin!", tap PLAY.
4. **Part 2: Commutative** (rows 9 to 27): guided tutorial, then turns with the computer, your Skip, the computer's Reverse and Skip, one "no match" turn where you draw a card (12 + 7), then the FLIP card on the centre pile.
5. **Part 3: Associative** (rows 22 to 43): rule, the 2 · 3 · 5 bracket explanation (GOT IT), guided tutorial, 7 practice matches, 5 computer turns, your Reverse and Mystery (DROP 1, then a bonus turn), the computer's Reverse and Skip, then the FLIP card in your hand.
6. **Part 4: Distributive** (rows 44 to 65): rule, the 3 × (4 + 2) block explanation (GOT IT), guided tutorial, 7 practice matches, 5 computer turns plus the computer's Mystery (DROP 1) and bonus turn, your Skip and Reverse, Swap Hands after Practice 3 (4 cards ↔ 2 cards, the new hand is shown), then the FLIP card in your hand.
7. **Part 5: Identity** (rows 66 to 88): rule, the 8 + 0 / 8 × 1 / 8 × 0 explanation (GOT IT), guided tutorial with two correct cards (+0 or ×1), 7 fill-the-blank matches, 6 computer turns, your Skip, Mystery (EXTRA TURN, bonus turn) and Reverse, the computer's Skip before the last practice, then **Identity Complete**: the examples combine into the Identity card and the four property badges appear.
8. **Part 6: FINAL FLIP** (rows 54 to 57): the computer is down to two cards, you call FINAL FLIP (the last card stays locked until you do), play the last card, then **Victory**: the four property cards form a trophy.

Feedback on every match follows the sheet:
- Miss 1: "Check the numbers again." The card shakes and returns.
- Miss 2: the explanation line; the numbers swap (or the brackets move) in the equation panel.
- Miss 3 on most matches: "Find …!" The correct card glows and pulses; after the learner taps it, one penalty card slides from the draw pile into the hand.
- Miss 3 on Practice 6 in Parts 3 to 5 (rows 39, 61, 82): "Oops! Let's draw one card and try again!" The draw pile glows; the learner taps it, takes 1 penalty card, then retries with the correct card glowing ("Tap the glowing matching card!", success line "Yes! Both equal …!").
- Correct: the card goes to the centre pile, the numbers swap / brackets jump / the outside number splits to both parts / the card fills the blank, and the answer shows.
- Inactivity: the sheet's inactivity line and animation after 8 s, then every 12 s, with the pointing hand.

## Tester shortcuts

- **Q**: jump menu (Hook, How to play, Parts 2 to 6, Identity complete, Victory, Computer wins). It is no longer shown in the pause menu.
- **Esc**: pause (closes the hint panel if it is open)
- Deep links: `index.html#how`, `#part2` … `#part6`, `#complete` (Identity complete), `#victory`, `#lose` (computer wins)

## Still to add

- Recorded voice-over. "Read lines aloud" uses the browser voice for now.
