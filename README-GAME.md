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
5. **Part 3: Associative** (2 players): teaching rule, the 2 · 3 · 5 bracket explanation (GOT IT), guided tutorial, 7 practice matches, computer turns, learner Reverse, Mystery (DROP 1), then **Associative Complete** with all 8 pairs.

Feedback on every match follows the sheet:
- Miss 1: "Check the numbers again." The card shakes and returns.
- Miss 2: the explanation line; the numbers swap (or the brackets move) in the equation panel.
- Miss 3: "Oops! No match yet! Draw one card!" The draw pile glows; the learner taps it, takes 1 penalty card, then the correct card glows with "Find …!".
- Correct: the card goes to the centre pile, the numbers swap / brackets jump, and both cards show the answer.
- Inactivity: the sheet's inactivity line and animation after 8 s, then every 12 s.

## Tester shortcuts

- **Q**: jump menu (Hook, How to play, Part 2, Part 3, Complete)
- **Esc**: pause
- Deep links: `index.html#how`, `#part2`, `#part3`, `#complete`

## Still to add

- Recorded voice-over. "Read lines aloud" uses the browser voice for now.
