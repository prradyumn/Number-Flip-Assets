/* Number Flip V2: content only. Every line, card and step here comes from "Number flip - Game V2" (the LXD sheet).
   Row numbers in the comments are the sheet's SNo. No game logic lives in this file. */
(function () {
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ev = s => { try { return Function('"use strict";return (' + s.replace(/×/g, '*') + ')')(); } catch (e) { return null; } };

  /* Gameplay rules (sheet header): learner and computer start with 8 cards each. */
  const START_CARDS = 8;

  const PARTS = [
    { key: 'commutative', name: 'Commutative', color: '#2F7CF6', title: 'COMMUTATIVE PROPERTY',
      teach: 'Match the same numbers in a different order. Changing the order in addition or multiplication does not change the answer.',
      rule: ['a + b = b + a', 'a × b = b × a'] },
    { key: 'associative', name: 'Associative', color: '#13A46B', title: 'ASSOCIATIVE PROPERTY',
      teach: 'Changing the grouping of numbers in addition or multiplication does not change the answer.',
      rule: ['(a + b) + c = a + (b + c)', '(a × b) × c = a × (b × c)'] }
  ];

  /* ---------- Part 1: game hook and how to play ---------- */
  const HOOK = { vo: 'Whoa! Look at these colourful number cards! Each card brings a new challenge, and every flip brings a surprise!' };      // row 1
  const SETUP = { vo: 'Match the cards, clear your hand, and watch out for the special cards!', ok: "Let's play!", idle: 'Tap PLAY to start!' }; // row 2
  const HOW = {
    match: { vo: 'Look at the centre card. Tap a card that follows the matching rule.', ost: 'CENTRE CARD → MATCH', ok: "That's a match!", idle: 'Tap the glowing card!',
      centre: '2 + 3', right: '3 + 2', wrongs: ['2 + 4', '1 + 3'] },                                                                                    // row 3
    turns: { vo: 'After you play, the next player gets a turn. Follow the arrow!', ost: 'YOUR TURN → COMPUTER → YOU', ok: 'Here we go!', idle: 'Tap NEXT!' }, // row 4
    actions: { vo: 'Skip misses a turn. Reverse changes direction. Draw adds cards. Swap changes hands!', ost: 'SKIP • REVERSE • DRAW • SWAP',
      ok: 'Cards can change the game!', idle: 'Tap a special card to see what it does!',
      each: { skip: 'Skip misses a turn.', reverse: 'Reverse changes direction.', draw: 'Draw adds cards.', swap: 'Swap changes hands!' } },               // row 5
    flip: { vo: 'Tap FLIP when it appears. A new number trick starts!', ost: 'FLIP = NEW RULE', ok: 'New rule unlocked!', idle: 'Tap FLIP!' },          // row 6
    ready: { vo: 'The cards are shuffled, the players are set. Ready to play?' }
  };

  /* ---------- shared lines ---------- */
  const WRONG1 = 'Check the numbers again.';
  const STUCK = { vo: 'Oops! No match yet! Draw one card!', ost: 'DRAW 1 CARD!', ok: 'One more card! Try the match again!', idle: 'Tap the draw pile!' }; // rows 19, 36

  /* step builders */
  const M = (centre, right, wrongs, vo, ok, w2, idle, extra = {}) => ({ t: 'match', centre, right, wrongs, vo, ost: 'Find the matching card!', ok, w2, w3: `Find ${right}!`, idle, ...extra });
  const CPU = (vo, ost, ok) => ({ t: 'cpu', vo, ost, ok });
  const CPUACT = (act, vo, ost, ok) => ({ t: 'cpuAct', act, vo, ost, ok });
  const GIVE = (act, vo, ost, ok, idle) => ({ t: 'give', act, vo, ost, ok, idle });

  /* ---------- Part 2: Commutative (2 players) ---------- */
  const PART2 = [
    { t: 'teach', part: 0 },
    M('4 + 6', '6 + 4', ['4 + 5', '7 + 2'], "Look! 4 + 6 makes 10. Switch the numbers, and it's still 10! Now find the matching card.", 'Great! Both make 10!', 'Switching 4 and 6 keeps the answer 10.', 'Find the card with 6 and 4!', { guided: true }), // 9
    CPU("Computer's turn! Let's see its move!", "COMPUTER'S TURN", 'Match played!'),                                                                                  // 10
    M('5 + 8', '8 + 5', ['5 + 7', '8 + 2'], 'Find the matching card!', 'Nice match! Both make 13!', '5 + 8 and 8 + 5 both make 13.', 'Look for the same numbers, switched!'), // 11
    GIVE('skip', "A Skip card! Oh! The computer's turn is missed. Your turn again!", 'SKIP CARD!', 'SKIP! Computer misses its turn!', 'Tap the Skip card!'),           // 12
    M('3 × 7', '7 × 3', ['3 × 6', '7 + 3'], 'Your turn again! Find the match!', 'Perfect! Both make 21!', '3 × 7 and 7 × 3 both make 21.', 'Find the same factors, switched!', { confetti: true }), // 13
    CPU("Computer's turn!", 'COMPUTER PLAYS', 'Match played!'),                                                                                                       // 14
    M('9 + 4', '4 + 9', ['9 + 5', '4 + 8'], 'Find the next match!', 'Great! Both make 13!', '9 + 4 and 4 + 9 both make 13.', 'Look for the switched numbers!'),      // 15
    CPUACT('reverse', "REVERSE! Oh! Your turn is missed. Computer's turn again!", 'REVERSE!', 'Computer gets another turn!'),                                            // 16
    CPU('Computer plays again!', 'COMPUTER PLAYS', 'Your turn!'),                                                                                                     // 17
    M('6 × 5', '5 × 6', ['6 × 4', '5 + 6'], 'Find the matching card!', 'Yes! Both make 30!', '6 × 5 and 5 × 6 both make 30.', 'Find the matching multiplication!'),  // 18
    CPU("Computer's turn!", 'COMPUTER PLAYS', 'Match played!'),                                                                                                       // 20
    M('12 + 7', '7 + 12', ['12 + 8', '7 + 11'], 'Find the matching card!', 'Great match! Both make 19!', '12 + 7 and 7 + 12 both make 19.', 'Look for 7 and 12!'),    // 21
    GIVE('reverse', 'A Reverse card! Play it!', 'REVERSE!', 'Nice reverse! Your turn again!', 'Tap the Reverse card!'),                                               // 22
    M('8 × 4', '4 × 8', ['8 × 5', '4 + 8'], 'Your turn again! Find the match!', 'Perfect! Both make 32!', '8 × 4 and 4 × 8 both make 32.', 'Find the matching factors!', { ost: 'YOUR TURN' }), // 23
    CPUACT('skip', 'Oh no! Computer played Skip! Your turn is missed!', "YOU'RE SKIPPED!", 'Computer plays again!'),                                                    // 24
    CPU('Computer plays again! Watch out!', 'COMPUTER PLAYS AGAIN', 'Your turn now!'),                                                                                // 25
    M('15 + 6', '6 + 15', ['15 + 7', '6 + 14'], 'Find the matching card!', 'Awesome! Both make 21!', '15 + 6 and 6 + 15 both make 21.', 'Find the final matching card!', { confetti: true }), // 26
    { t: 'flip', vo: 'FLIP! New cards, new trick!', ost: 'FLIP THE CARDS!', ok: 'New rule unlocked!', idle: 'Tap the FLIP card!' }                                      // 27
  ];

  /* ---------- Part 3: Associative (2 players) ---------- */
  const EXPLAIN = {                                                                                                                                                    // 20 (Part 3)
    lines: ['Look! First we add 2 and 3, then 5. We get 10!', 'Now group 3 and 5 first. Still 10!', 'Changing the groups keeps the answer the same. This is the Associative Property.', 'It works for multiplication too!'],
    a: '(2 + 3) + 5', b: '2 + (3 + 5)', val: 10, ma: '(2 × 3) × 4', mb: '2 × (3 × 4)', mval: 24,
    ok: "Let's match the groups!", idle: 'Tap GOT IT to play!'
  };
  const PART3 = [
    { t: 'teach', part: 1 },
    { t: 'explain' },
    M('(2 + 3) + 5', '2 + (3 + 5)', ['(2 + 4) + 5', '3 + (2 + 4)'], 'Find the matching card!', 'Nice match! Both equal 10!', 'Changing the group from (2 + 3) to (3 + 5) keeps the answer 10.', 'Find the card with the same numbers in a different group!', { guided: true }), // 21
    CPU("Computer's turn! Let's see its move!", "COMPUTER'S TURN", 'Match played!'),                                                                                   // 22
    M('(4 + 6) + 2', '4 + (6 + 2)', ['(4 + 5) + 2', '6 + (4 + 3)'], 'Find the matching card!', 'Nice match! Both equal 12!', 'Grouping 4 and 6 or grouping 6 and 2 gives the same total, 12.', 'Look for the same numbers in a new group!'), // 23
    CPUACT('reverse', 'REVERSE! Oh! Your turn is missed. Computer plays again!', 'REVERSE! COMPUTER PLAYS AGAIN', 'Computer gets another turn!'),                       // 24
    CPU('Computer plays again! Your turn is next!', 'COMPUTER PLAYS', 'Your turn!'),                                                                                  // 25
    M('(3 × 2) × 5', '3 × (2 × 5)', ['(3 × 4) × 5', '2 × (3 × 6)'], 'Find the matching card!', 'Perfect match! Both equal 30!', 'Multiplying 3 and 2 first or 2 and 5 first gives the same answer, 30.', 'Find the matching group!', { confetti: true }), // 26
    GIVE('reverse', 'A Reverse card! Play it!', 'REVERSE!', 'Nice reverse! Your turn again!', 'Tap the Reverse card!'),                                               // 27
    M('(7 + 3) + 8', '7 + (3 + 8)', ['7 + (4 + 8)', '3 + (7 + 9)'], 'Find the matching card!', 'Great! Both equal 18!', 'Adding 7 and 3 first or 3 and 8 first gives the same total, 18.', 'Look for the same three numbers!'), // 28
    CPU("Computer's turn!", 'COMPUTER PLAYS', 'Match played!'),                                                                                                       // 29
    M('(5 + 5) + 9', '5 + (5 + 9)', ['(5 + 6) + 9', '9 + (5 + 6)'], 'Find the matching card!', 'Nice match! Both equal 19!', 'Grouping the first two 5s or grouping 5 and 9 keeps the total 19.', 'Find the card with different brackets!'), // 30
    GIVE('mystery', 'A Mystery Card! Flip it!', 'MYSTERY CARD!', 'Lucky you! Drop one extra card!', 'Tap the Mystery Card!'),                                         // 31
    M('(4 × 5) × 2', '4 × (5 × 2)', ['(4 × 6) × 2', '5 × (4 × 3)'], 'Find the matching card!', 'Perfect! Both equal 40!', 'Multiplying 4 and 5 first or 5 and 2 first gives the same answer, 40.', 'Look for the matching multiplication group!'), // 32
    CPUACT('skip', 'Oh no! Computer played Skip! Your turn is missed!', "YOU'RE SKIPPED!", 'Computer plays again!'),                                                    // 33
    CPU('Computer plays again! Watch out!', 'COMPUTER PLAYS', 'Your turn now!'),                                                                                      // 34
    M('(6 + 4) + 7', '6 + (4 + 7)', ['(6 + 5) + 7', '4 + (6 + 8)'], 'Find the matching card!', 'Great match! Both equal 17!', 'Adding 6 and 4 first or 4 and 7 first gives the same total, 17.', 'Find the matching group!'), // 35
    CPU("Computer's turn!", 'COMPUTER PLAYS', 'Match played!'),                                                                                                       // 37
    M('(2 × 6) × 5', '2 × (6 × 5)', ['(2 × 5) × 6', '2 × (6 × 4)'], 'Find the matching card!', 'Awesome! Both equal 60!', 'Multiplying 2 and 6 first or 6 and 5 first gives the same answer, 60.', 'Find the final matching group!', { confetti: true }), // 38
    { t: 'complete', vo: 'Amazing! You changed the groups, but the answers stayed the same!', ost: 'ASSOCIATIVE COMPLETE!', ok: 'All matches cleared!' }               // 39
  ];

  const ACTIONS = {
    skip: { img: 'cd-skip', label: 'SKIP' }, reverse: { img: 'cd-reverse', label: 'REVERSE' },
    swap: { img: 'cd-swap-hands', label: 'SWAP' }, mystery: { img: 'cd-mystery', label: 'MYSTERY' },
    draw: { img: 'cd-mystery-reveal-distributive', label: 'DRAW', face: '+2' }
  };

  /* filler faces for the learner's other cards (shown when the hand is turned face up: Mystery drop, FLIP) */
  const FILLER = [
    ['3 + 9', '7 × 2', '8 + 6', '5 × 4', '2 + 11', '9 × 3'],
    ['(1 + 4) + 6', '(2 × 3) × 3', '8 + (2 + 5)', '(3 + 3) + 4', '5 × (2 × 2)', '(9 + 1) + 2']
  ];

  window.NF_CONTENT = { START_CARDS, PARTS, HOOK, SETUP, HOW, WRONG1, STUCK, PART2, PART3, EXPLAIN, ACTIONS, FILLER, util: { shuffle, ev } };
})();
