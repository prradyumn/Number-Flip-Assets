# Number Flip: playable build (V2)

Open `index.html` in Chrome, or run a local server from this folder (`npx serve .`) and open the link it prints.

## What's here

| Path | What it holds |
| --- | --- |
| `index.html` | The page: stage, screens and buttons |
| `css/style.css` | Layout on a fixed 1920 × 1080 stage that scales to any screen |
| `js/content.js` | Every line, card and step from the V2 sheet ("Number flip - Game V2"), with the sheet's row numbers in comments. Edit content here. |
| `js/game.js` | Game flow (a step runner that plays the sheet row by row), rendering, sound and every GSAP animation |
| `vendor/gsap.min.js` | GSAP 3.12.5 |

## How it plays (V2 sheet)

1. **Hook** (row 1): cards fly in, shuffle into a deck, the title glows.
2. **Setup** (row 2): 8 cards dealt to each player (computer's face down), tap PLAY.
3. **How to Play 1-4** (rows 3-6): match the glowing card, follow the turn arrow (NEXT), preview Skip / Reverse / Draw / Swap, tap FLIP. Then "Ready to play?".
4. **Part 2: Commutative** (2 players): teaching rule, guided tutorial, 7 practice matches, computer turns, learner Skip and Reverse, computer Reverse and Skip, then the FLIP card.
5. **Part 3: Associative** (2 players): teaching rule, the 2 · 3 · 5 bracket explanation (GOT IT), guided tutorial, 7 practice matches, computer turns, learner Reverse, Mystery (DROP 1), then the FLIP card.
6. **Part 4: Distributive** (2 players): teaching rule, the 3 × (4 + 2) block explanation (3 rows of 6 blocks split into 4 and 2; GOT IT), guided tutorial, 7 practice matches, learner Skip (twice) and Reverse, computer Mystery (DROP 1), Swap Hands (4 cards ↔ 2 cards), then the FLIP card.
7. **Part 5: Identity**: teaching rule, the 8 + 0 / 8 × 1 / 8 × 0 explanation (GOT IT), guided tutorial with two correct cards (+0 or ×1), 7 fill-the-blank matches, learner Skip (twice), Reverse and Mystery (EXTRA CHANCE, bonus turn), then **Identity Complete** with all eight examples and the four property badges.
8. **Part 6: FINAL FLIP**: the computer is down to two cards, the learner calls FINAL FLIP (the last card stays locked until they do), plays the last card, then **Victory**: the four property cards form a trophy.

Feedback on every match follows the sheet:
- Miss 1: "Check the numbers again." The card shakes and returns.
- Miss 2: the explanation line; the numbers swap (or the brackets move) in the equation panel.
- Miss 3: "Oops! No match yet! Draw one card!" The draw pile glows; the learner taps it, takes 1 penalty card, then the correct card glows with "Find …!".
- Correct: the card goes to the centre pile, the numbers swap / brackets jump / the outside number splits to both parts / the card fills the blank, and the answer shows.
- Inactivity: the sheet's inactivity line and animation after 8 s, then every 12 s.

## Tester shortcuts

- **Q**: jump menu (Hook, How to play, Parts 2 to 6, Identity complete, Victory)
- **Esc**: pause
- Deep links: `index.html#how`, `#part2` … `#part6`, `#complete` (Identity complete), `#victory`

## Still to add

- Recorded voice-over. "Read lines aloud" uses the browser voice for now.
