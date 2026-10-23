# Number Flip: playable build

Open `index.html` in Chrome, or run a local server from this folder (`npx serve .`) and open the link it prints.

## What's here

| Path | What it holds |
| --- | --- |
| `index.html` | The page: stage, screens and buttons |
| `css/style.css` | Layout on a fixed 1920 × 1080 stage that scales to any screen |
| `js/content.js` | All questions, scripted events and character lines. Edit content here. |
| `js/game.js` | Game flow, rendering, sound and every GSAP animation |
| `vendor/gsap.min.js` | GSAP 3.12.5 |
| `assets/` | Only the art the game uses (WebP): cards, characters (idle + throw poses), hands, rewards, feedback, tutorial, effects sheets, audio (mp3 + ogg) |

## How it plays

- 4 rounds: Commutative, Associative, Distributive, Identity. Each round has 4 matches. A FLIP card takes the game to the next round.
- The game ends with a race to empty your hand. The learner taps **LAST CARD!** before playing their final card; forgetting costs 1 card.
- Action cards arrive at the moments the concept doc sets (Skip, Reverse, Mystery, Swap Hands). The learner chooses when to play them.
- Wrong answers get help that builds up: an explanation, then a glowing hint, then Draw 1 with a guided retry.
- Optional **Catch Robo cheating** mode: Robo sometimes plays a wrong match, and the learner decides whether to challenge it.
- **Play again** deals random questions; the first game follows the concept doc's script.

## Tester shortcuts

- **Q**: jump menu (any round, the final round, the win screen)
- **Esc**: pause

## Still to add

- Recorded voice-over. "Read lines aloud" uses the browser voice for now.

## Game feel (added)

- **Throwing:** Flippy and Robo swap to their throw pose, an arm slides out of the shoulder, grips the card and flicks it onto the table (`handThrow` in `js/game.js`). Flippy deals penalty cards and action cards; Robo throws its own plays and Mystery Draw 2.
- **Progress:** XP bar and rank (bronze, silver, gold, diamond), a streak flame with a ×2 / ×3 XP multiplier, 1 to 3 stars per round, medals that unlock in the top bar, and six achievements on the win screen. Best XP is kept in `localStorage` (`nf-best`).
- **Clarity:** "MATCH THIS" label, a play-here slot, avatars with live card counts, a whose-turn arrow, a hint bulb, and a first-time How to play screen (`nf-how` in `localStorage`).
- **Effects and sound:** sprite-sheet effects in `assets/effects` (`sheet()`), recorded sounds in `assets/audio` (`AUDIO` map in `sfx()`; cues without a file fall back to the small synth). Reduced-motion turns the sheet effects off.
