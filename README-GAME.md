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

## How it plays (V2 sheet + Sheet5 turn flow)

Turns alternate: **you solve, the computer solves, you solve**. Every turn gets its own centre card from the draw pile.
On the computer's turn its three cards turn face up beside it ("COMPUTER'S CARDS"); it checks them one by one, puts back the
ones that don't match, plays the match, and the equation panel shows its working. Skip, Reverse and the Mystery bonus turn are
the only times one player goes twice.

1. **Hook** (row 1): cards fly in, shuffle into a deck, the title glows.
2. **Setup** (Sheet5 row 2): "Two players, one challenge." 8 cards dealt to each player (computer's face down), tap PLAY.
3. **How to Play** (Sheet5 order): preview the special cards (Skip / Reverse / Draw / Swap / FLIP), match the glowing sample card, then "Ready to play?".
4. **Part 2: Commutative** (Sheet5): guided tutorial, then you and the computer take turns (4 matches each), your Skip, the computer's Reverse and Skip, one "no match" turn where you draw a card (12 + 7), then the FLIP card.
5. **Part 3: Associative**: teaching rule, the 2 · 3 · 5 bracket explanation (GOT IT), guided tutorial, 7 practice matches with computer turns between them, your Reverse and Mystery (DROP 1), the computer's Reverse and Skip, then the FLIP card.
6. **Part 4: Distributive**: teaching rule, the 3 × (4 + 2) block explanation (GOT IT), guided tutorial, 7 practice matches with computer turns between them, your Skip and Reverse, the computer's Mystery (DROP 1) and Skip, Swap Hands (4 cards ↔ 2 cards), then the FLIP card.
7. **Part 5: Identity**: teaching rule, the 8 + 0 / 8 × 1 / 8 × 0 explanation (GOT IT), guided tutorial with two correct cards (+0 or ×1), 7 fill-the-blank matches with computer turns between them, your Skip (twice), Reverse and Mystery (EXTRA CHANCE, bonus turn), then **Identity Complete** with all eight examples and the four property badges.
8. **Part 6: FINAL FLIP**: the computer plays down to two cards, you call FINAL FLIP (the last card stays locked until you do), play the last card, then **Victory**: the four property cards form a trophy.

Computer turns marked `// added` in `js/content.js` are not in the sheets; they keep the turn order in Parts 3 to 6.

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
