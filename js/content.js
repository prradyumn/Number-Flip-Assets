/* Number Flip V2: content only. Every line, card and step here comes from "Number flip - Game V2" (the LXD sheet).
   Row numbers in the comments are the sheet's SNo. No game logic lives in this file. */
(function () {
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ev = s => { try { return Function('"use strict";return (' + s.replace(/×/g, '*') + ')')(); } catch (e) { return null; } };

  /* Gameplay rules (sheet header): learner and computer start with 8 cards each. */
  const START_CARDS = 8;

  /* deal = [learner, computer] cards when the part starts (after the FLIP). Chosen so the counts the sheet names come out right:
     Part 4 row 40 "learner has four cards and computer has two", Part 6 row 54 "computer has only two cards", row 55 "one card left". */
  const PARTS = [
    { key: 'commutative', name: 'Commutative', color: '#2F7CF6', title: 'COMMUTATIVE PROPERTY', card: 'cd-front-commutative', medal: 'rewards/medal-commutative-unlocked', deal: [8, 8],
      teach: 'Match the same numbers in a different order. Changing the order in addition or multiplication does not change the answer.',
      rule: ['a + b = b + a', 'a × b = b × a'] },
    { key: 'associative', name: 'Associative', color: '#13A46B', title: 'ASSOCIATIVE PROPERTY', card: 'cd-front-associative', medal: 'rewards/medal-associative-unlocked', deal: [9, 8],
      teach: 'Changing the grouping of numbers in addition or multiplication does not change the answer.',
      rule: ['(a + b) + c = a + (b + c)', '(a × b) × c = a × (b × c)'] },
    { key: 'distributive', name: 'Distributive', color: '#F06A2B', title: 'DISTRIBUTIVE PROPERTY', card: 'cd-front-distributive', medal: 'rewards/medal-distributive-unlocked', deal: [7, 5],
      teach: 'Multiplying a number by a sum is the same as multiplying each part separately and then adding the results.',
      rule: ['a × (b + c) = (a × b) + (a × c)'] },
    { key: 'identity', name: 'Identity', color: '#8B5CF6', title: 'IDENTITY PROPERTY', card: 'cd-front-identity', medal: 'rewards/medal-identity-unlocked', deal: [9, 5],
      teach: 'Adding 0 or multiplying by 1 keeps the number unchanged.',
      rule: ['a + 0 = a', 'a × 1 = a'] },
    { key: 'final', name: 'Final Flip', color: '#E8384F', title: 'FINAL FLIP', card: 'cd-front-last-card', medal: 'ui/ui-trophy', deal: [1, 3], tag: 'Game rule',
      teach: 'When you have only one card left, call FINAL FLIP before playing your last card.',
      rule: ['1 card left → FINAL FLIP!'] }
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
  const STUCK = { vo: 'Oops! No match yet! Draw one card!', ost: 'DRAW 1 CARD!', ok: 'One more card! Try the match again!', idle: 'Tap the draw pile!' }; // rows 19, 36, 50, 69

  /* step builders */
  const M = (centre, right, wrongs, vo, ok, w2, idle, extra = {}) => ({ t: 'match', centre, right, wrongs, vo, ost: 'Find the matching card!', ok, w2, w3: `Find ${right}!`, idle, ...extra });
  /* distributive: the equation panel ends with the two products added, e.g. "12 + 6 = 18"; the outside number moves to both parts (dup) */
  const DS = (centre, right, wrongs, ok, w2, idle, extra = {}) => {
    const [x, y] = right.match(/\([^)]*\)/g).map(ev);
    return M(centre, right, wrongs, 'Find the matching card!', ok, w2, idle, { val: `${x} + ${y} = ${x + y}`, dup: true, ...extra });
  };
  /* identity: the chosen card fills the blank, e.g. "15 + ___ = 15" becomes "15 + 0 = 15" */
  const ID = (centre, right, wrongs, fill, ok, w2, w3, idle, extra = {}) =>
    M(centre, right, wrongs, 'Find the matching card!', ok, w2, idle, { fill, w3, v: +fill.split(' = ').pop(), badge: false, ...extra });
  const CPU = (vo, ost, ok) => ({ t: 'cpu', vo, ost, ok });
  const CPUACT = (act, vo, ost, ok, extra = {}) => ({ t: 'cpuAct', act, vo, ost, ok, ...extra });
  const GIVE = (act, vo, ost, ok, idle, extra = {}) => ({ t: 'give', act, vo, ost, ok, idle, ...extra });
  const FLIP = vo => ({ t: 'flip', vo, ost: 'FLIP THE CARDS!', ok: 'New rule unlocked!', idle: 'Tap the FLIP card!' });
  const SKIP_LEARNER = GIVE('skip', 'A Skip card! Play it!', 'SKIP!', "Oh! You skipped the computer's turn! Your turn again!", 'Tap the Skip card!');

  /* ---------- Part 2: Commutative (2 players) ---------- */
  const PART2 = [
    { t: 'teach', part: 0 },
    M('4 + 6', '6 + 4', ['4 + 5', '7 + 2'], "Look! 4 + 6 makes 10. Switch the numbers, and it's still 10! This is Commutative Property. Changing the order does not change the answer. Now find the matching card.", 'Great! Both make 10!', 'Switching 4 and 6 keeps the answer 10.', 'Find the card with 6 and 4!', { guided: true }), // 9
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
    FLIP('FLIP! New cards, new trick!')                                                                                                                               // 27
  ];

  /* ---------- property explanations (GOT IT panels) ---------- */
  const EXPLAIN = {
    associative: {                                                                                                                                                     // Part 3 row 20
      lines: ['Look! First we add 2 and 3, then 5. We get 10!', 'Now group 3 and 5 first. Still 10!', 'This is the Associative Property. Changing the groups keeps the answer the same.', 'It works for multiplication too!'],
      a: '(2 + 3) + 5', b: '2 + (3 + 5)', val: 10, ma: '(2 × 3) × 4', mb: '2 × (3 × 4)', mval: 24,
      ok: "Let's match the groups!", idle: 'Tap GOT IT to play!' },
    distributive: {                                                                                                                                                    // Part 4 row 34
      lines: ['Look! 3 times 6 makes 18.', 'Now split 6 into 4 and 2. Multiply 3 by 4 to get 12, and 3 by 2 to get 6.', "Add them together, and it's still 18!", 'This is the Distributive Property.', 'We multiply each part and add the answers!'],
      eqs: ['3 × (4 + 2)', '3 × 6 = 18', '3 × 4 = 12', '3 × 2 = 6', '12 + 6 = 18'], rows: 3, cols: 6, split: 4,
      ok: "Let's match the split cards!", idle: 'Tap GOT IT to play!' },
    identity: {                                                                                                                                                        // Part 5 row 55
      lines: ["Look, add 0 to 8, and it's still 8!", "Multiply 8 by 1, and it's still 8!", 'But multiplying by 0 gives 0!', 'This is the Identity Property.'],
      rows: ['8 + 0 = 8', '8 × 1 = 8', '8 × 0 = 0'], ost: 'IDENTITY PROPERTY',
      ok: "Let's keep the numbers the same!", idle: 'Tap GOT IT to play!' }
  };

  /* ---------- Part 3: Associative (2 players) ---------- */
  const PART3 = [
    { t: 'teach', part: 1 },
    { t: 'explain', key: 'associative' },
    M('(2 + 3) + 5', '2 + (3 + 5)', ['(2 + 4) + 5', '3 + (2 + 4)'], 'Find the matching card!', 'Nice match! Both equal 10!', 'Changing the group from (2 + 3) to (3 + 5) keeps the answer 10.', 'Find the card with the same numbers in a different group!', { guided: true }), // 21
    CPU("Computer's turn! Let's see its move!", "COMPUTER'S TURN", 'Match played!'),                                                                                   // 22
    M('(4 + 6) + 2', '4 + (6 + 2)', ['(4 + 5) + 2', '6 + (4 + 3)'], 'Find the matching card!', 'Nice match! Both equal 12!', 'Grouping 4 and 6 or grouping 6 and 2 gives the same total, 12.', 'Look for the same numbers in a new group!'), // 23
    CPUACT('reverse', 'REVERSE! Oh! Your turn is missed. Computer plays again!', 'REVERSE! COMPUTER PLAYS AGAIN', 'Computer gets another turn!'),                       // 24
    CPU('Computer plays again! Your turn is next!', "COMPUTER'S TURN", 'Your turn!'),                                                                                 // 25
    M('(3 × 2) × 5', '3 × (2 × 5)', ['(3 × 4) × 5', '2 × (3 × 6)'], 'Find the matching card!', 'Perfect match! Both equal 30!', 'Multiplying 3 and 2 first or 2 and 5 first gives the same answer, 30.', 'Find the matching group!', { confetti: true }), // 26
    GIVE('reverse', 'A Reverse card! Play it!', 'REVERSE!', 'Nice reverse! Your turn again!', 'Tap the Reverse card!'),                                               // 27
    M('(7 + 3) + 8', '7 + (3 + 8)', ['7 + (4 + 8)', '3 + (7 + 9)'], 'Find the matching card!', 'Great! Both equal 18!', 'Adding 7 and 3 first or 3 and 8 first gives the same total, 18.', 'Look for the same three numbers!'), // 28
    CPU("Computer's turn!", "COMPUTER'S TURN", 'Match played!'),                                                                                                      // 29
    M('(5 + 5) + 9', '5 + (5 + 9)', ['(5 + 6) + 9', '9 + (5 + 6)'], 'Find the matching card!', 'Nice match! Both equal 19!', 'Grouping the first two 5s or grouping 5 and 9 keeps the total 19.', 'Find the card with different brackets!'), // 30
    GIVE('mystery', 'A Mystery Card! Flip it!', 'MYSTERY CARD!', 'Lucky you! Drop one extra card!', 'Tap the Mystery Card!', { reveal: 'DROP 1', img: 'cd-mystery-reveal-associative' }), // 31
    M('(4 × 5) × 2', '4 × (5 × 2)', ['(4 × 6) × 2', '5 × (4 × 3)'], 'Find the matching card!', 'Perfect! Both equal 40!', 'Multiplying 4 and 5 first or 5 and 2 first gives the same answer, 40.', 'Look for the matching multiplication group!'), // 32
    CPUACT('skip', 'Oh no! Computer played Skip! Your turn is missed!', "YOU'RE SKIPPED!", 'Computer plays again!'),                                                    // 33
    CPU('Computer plays again! Watch out!', 'COMPUTER PLAYS', 'Your turn now!'),                                                                                      // 34
    M('(6 + 4) + 7', '6 + (4 + 7)', ['(6 + 5) + 7', '4 + (6 + 8)'], 'Find the matching card!', 'Great match! Both equal 17!', 'Adding 6 and 4 first or 4 and 7 first gives the same total, 17.', 'Find the matching group!'), // 35
    CPU("Computer's turn!", "COMPUTER'S TURN", 'Match played!'),                                                                                                      // 37
    M('(2 × 6) × 5', '2 × (6 × 5)', ['(2 × 5) × 6', '2 × (6 × 4)'], 'Find the matching card!', 'Awesome! Both equal 60!', 'Multiplying 2 and 6 first or 6 and 5 first gives the same answer, 60.', 'Find the final matching group!', { confetti: true }), // 38
    FLIP('FLIP THE CARDS! New cards, new trick!')                                                                                                                     // 39
  ];

  /* ---------- Part 4: Distributive (2 players) ---------- */
  const PART4 = [
    { t: 'teach', part: 2 },
    { t: 'explain', key: 'distributive' },                                                                                                                            // 34
    DS('3 × (4 + 2)', '(3 × 4) + (3 × 2)', ['3 × (4 × 2)', '(3 + 4) × 2'], 'Nice match! Both equal 18!', 'Multiply 3 by both 4 and 2, then add 12 and 6 to get 18.', 'Find the card with both multiplication parts!', { guided: true }), // 35
    CPU("Computer's turn!", "COMPUTER'S TURN", 'Match played!'),                                                                                                      // 36
    DS('4 × (5 + 2)', '(4 × 5) + (4 × 2)', ['(4 + 5) × 2', '4 × (5 × 2)'], 'Great match! Both equal 28!', 'Multiply 4 by 5 and 2 separately. Then add 20 and 8 to get 28.', 'Look for 4 multiplied by both numbers!'), // 37
    SKIP_LEARNER,                                                                                                                                                     // 38
    DS('5 × (6 + 3)', '(5 × 6) + (5 × 3)', ['5 × (6 × 3)', '(5 + 6) × 3'], 'Perfect! Both equal 45!', 'Multiply 5 by both 6 and 3. Adding 30 and 15 gives 45.', 'Find the card with 5 multiplied by both parts!', { confetti: true }), // 40
    CPUACT('mystery', 'Mystery Card', 'MYSTERY CARD!', null, { reveal: 'DROP 1', img: 'cd-mystery-reveal-distributive' }),                                            // 41
    GIVE('swap', 'Whoa! A Swap Hands card! Play it!', 'SWAP HANDS!', "SWAP! You got the computer's cards!", 'Tap the Swap Hands card!', { before: [4, 2] }),         // 40 (swap)
    { t: 'swapResult', vo: 'Wow! Just two cards left!', ost: '2 CARDS LEFT!', ok: 'Nice swap!' },                                                                     // 41 (swap result)
    DS('6 × (10 + 2)', '(6 × 10) + (6 × 2)', ['6 × (10 × 2)', '(6 + 10) × 2'], 'Nice match! Both equal 72!', 'Multiply 6 by both 10 and 2. Adding 60 and 12 gives 72.', 'Look for the two multiplication parts!'), // 43
    SKIP_LEARNER,                                                                                                                                                     // 38 (second Skip)
    CPU("Computer's turn!", "COMPUTER'S TURN", 'Match played!'),                                                                                                      // 44
    DS('7 × (4 + 3)', '(7 × 4) + (7 × 3)', ['(7 + 4) × 3', '7 × (4 × 3)'], 'Great! Both equal 49!', 'Multiply 7 by 4 and 3 separately. Then add 28 and 21 to get 49.', 'Find the matching multiplication parts!'), // 45
    GIVE('reverse', 'A Reverse card! Play it!', 'REVERSE!', 'Oh! You reversed the turn! Play again!', 'Tap the Reverse card!'),                                       // 46
    DS('8 × (5 + 2)', '(8 × 5) + (8 × 2)', ['8 × (5 × 2)', '(8 + 5) × 2'], 'Perfect match! Both equal 56!', 'Multiply 8 by both 5 and 2. Adding 40 and 16 gives 56.', 'Look for 8 multiplied by both numbers!'), // 47
    CPU("Computer's turn!", "COMPUTER'S TURN", 'Match played!'),                                                                                                      // 48
    DS('9 × (3 + 4)', '(9 × 3) + (9 × 4)', ['(9 + 3) × 4', '9 × (3 × 4)'], 'Nice match! Both equal 63!', 'Multiply 9 by both 3 and 4. Adding 27 and 36 gives 63.', 'Find the split with 9 multiplying both parts!'), // 49
    CPU("Computer's turn!", "COMPUTER'S TURN", 'Match played!'),                                                                                                      // 51
    DS('4 × (10 + 5)', '(4 × 10) + (4 × 5)', ['4 × (10 × 5)', '(4 + 10) × 5'], 'Awesome! Both equal 60!', 'Multiply 4 by both 10 and 5. Adding 40 and 20 gives 60.', 'Find the final matching split!', { confetti: true }), // 52
    FLIP('FLIP THE CARDS! New cards, new trick!')                                                                                                                     // 39 (Part 4 FLIP)
  ];

  /* ---------- Part 5: Identity ---------- */
  const PART5 = [
    { t: 'teach', part: 3 },
    { t: 'explain', key: 'identity' },                                                                                                                                // 55
    M('8 → ?', '+0', ['×0'], 'Find the matching card!', 'Nice match! 8 stays 8!', 'Adding 0 or multiplying by 1 keeps 8 unchanged.', 'Find the card that keeps 8 the same!',
      { rights: ['+0', '×1'], eqB: { '+0': '8 + 0 = 8', '×1': '8 × 1 = 8' }, v: 8, w3: 'Find +0 or ×1!', badge: false, guided: true }),                              // 56
    CPU("Computer's turn!", "COMPUTER'S TURN", 'Match played!'),                                                                                                      // 57
    ID('15 + ___ = 15', '0', ['1', '5'], '15 + 0 = 15', 'Great match! Still 15!', 'Adding 0 to 15 keeps the answer 15.', 'Find the 0 card!', 'Find the number that keeps 15 unchanged!'), // 58
    SKIP_LEARNER,                                                                                                                                                     // 59
    ID('12 × ___ = 12', '1', ['0', '2'], '12 × 1 = 12', 'Perfect! Still 12!', 'Multiplying 12 by 1 keeps the answer 12.', 'Find the 1 card!', 'Which number keeps 12 the same?'), // 60
    CPU("Computer's turn!", 'COMPUTER PLAYS', 'Match played!'),                                                                                                       // 61
    ID('9 × 0 = ?', '0', ['9', '1'], '9 × 0 = 0', 'Yes! The answer is 0!', 'Multiplying 9 by 0 gives 0, not 9.', 'Find the 0 card!', 'Look at the multiplication by 0!'), // 62
    GIVE('mystery', 'A Mystery Card! Flip it!', 'MYSTERY CARD!', 'Lucky you! Bonus turn!', 'Tap the Mystery Card!', { reveal: 'EXTRA CHANCE', img: 'cd-mystery-reveal-commutative', bonus: true }), // 63
    ID('24 + ___ = 24', '0', ['1', '4'], '24 + 0 = 24', 'Nice match! Still 24!', 'Adding 0 to 24 keeps the answer 24.', 'Find the 0 card!', 'Keep 24 unchanged!'),     // 64
    GIVE('reverse', 'A Reverse card! Play it!', 'REVERSE!', 'Oh! You reversed the turn! Your turn again!', 'Tap the Reverse card!'),                                  // 65
    ID('18 × ___ = 18', '1', ['0', '3'], '18 × 1 = 18', 'Great match! Still 18!', 'Multiplying 18 by 1 keeps the answer 18.', 'Find the 1 card!', 'Which card keeps 18 unchanged?'), // 66
    CPU("Computer's turn!", 'COMPUTER PLAYS', 'Match played!'),                                                                                                       // 67
    ID('35 + ___ = 35', '0', ['1', '5'], '35 + 0 = 35', 'Perfect! Still 35!', 'Adding 0 to 35 keeps the answer 35.', 'Find the 0 card!', 'Find the number that keeps 35 unchanged!'), // 68
    SKIP_LEARNER,                                                                                                                                                     // 70
    ID('42 × ___ = 42', '1', ['0', '2'], '42 × 1 = 42', 'Awesome! Still 42!', 'Multiplying 42 by 1 keeps the answer 42.', 'Find the 1 card!', 'Find the final matching card!', { confetti: true }), // 71
    { t: 'complete', vo: 'Amazing! Adding 0 or multiplying by 1 keeps the number unchanged!', ost: 'IDENTITY COMPLETE!', ok: 'All four properties cleared!' }          // 72
  ];

  /* ---------- Part 6: FINAL FLIP finish ---------- */
  const PART6 = [
    { t: 'teach', part: 4 },
    { t: 'warn', vo: 'Watch out! The computer has only two cards!', ost: 'COMPUTER: 2', ok: "It's a close game!", comp: 2 },                                          // 54
    { t: 'finalCall', vo: 'Only one card left! Call FINAL FLIP!', ost: 'FINAL FLIP!', ok: 'FINAL FLIP!', centre: '14 × ___ = 14', card: '1',                          // 55
      w1: 'Call FINAL FLIP first!', w2: 'Tap the big button!', w3: 'The glowing button says FINAL FLIP!', idle: 'Tap FINAL FLIP!' },
    ID('14 × ___ = 14', '1', [], '14 × 1 = 14', 'Nice match! You cleared your hand!', 'Multiplying 14 by 1 leaves 14 unchanged.', 'Choose 1.', 'Look at the glowing part. Pick the match!', { ost: '14 × ___ = 14', last: true }), // 56
    { t: 'victory', vo: 'All cards cleared! You are a FINAL FLIP Star!', ost: 'FINAL FLIP STAR!', ok: 'Amazing work!' }                                               // 57
  ];

  const ACTIONS = {
    skip: { img: 'cd-skip', label: 'SKIP' }, reverse: { img: 'cd-reverse', label: 'REVERSE' },
    swap: { img: 'cd-swap-hands', label: 'SWAP' }, mystery: { img: 'cd-mystery', label: 'MYSTERY' },
    draw: { img: 'cd-mystery-reveal-distributive', label: 'DRAW', face: '+2' }
  };

  /* filler faces for the learner's other cards (shown when the hand is turned face up: Mystery drop, Swap, FLIP), one list per part */
  const FILLER = [
    ['3 + 9', '7 × 2', '8 + 6', '5 × 4', '2 + 11', '9 × 3'],
    ['(1 + 4) + 6', '(2 × 3) × 3', '8 + (2 + 5)', '(3 + 3) + 4', '5 × (2 × 2)', '(9 + 1) + 2'],
    ['2 × (3 + 5)', '(6 × 2) + (6 × 3)', '3 × (7 + 1)', '(5 × 4) + (5 × 1)', '2 × (6 + 4)', '(7 × 2) + (7 × 5)'],
    ['7 + 0', '9 × 1', '0', '1', '16 + 0', '5 × 1'],
    ['1']
  ];

  const PLAY = [PART2, PART3, PART4, PART5, PART6];
  window.NF_CONTENT = { START_CARDS, PARTS, HOOK, SETUP, HOW, WRONG1, STUCK, PLAY, EXPLAIN, ACTIONS, FILLER, util: { shuffle, ev } };
})();
