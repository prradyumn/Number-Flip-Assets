/* Number Flip V2: content only. Every line, card and step here comes from "Number flip - Game V2 (2)" (the LXD sheet, 19 Nov);
   the instructions before the game come from "Number flip - Sheet6". Row numbers in the comments are the sheet's SNo. No game logic lives in this file. */
(function () {
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ev = s => { try { return Function('"use strict";return (' + s.replace(/×/g, '*') + ')')(); } catch (e) { return null; } };

  /* Sheet6: "Both players begin with 7 cards each." */
  const START_CARDS = 7;

  /* deal = [learner, computer] cards when the part starts (after the FLIP). Part 2 follows the gameplay rule (7 each); Part 6 makes
     row 54 "computer has only two cards" and row 55 "one card left" come out right. Parts 3 to 5 have no deal here: the game deals
     each player one card per play plus a few spare (Part 4 row 54 sets "learner four, computer two" itself before the Swap). */
  const PARTS = [
    { key: 'commutative', name: 'Commutative', color: '#2F7CF6', title: 'COMMUTATIVE PROPERTY', card: 'cd-front-commutative', medal: 'rewards/medal-commutative-unlocked', deal: [7, 7],
      teach: 'Match the same numbers in a different order. Changing the order in addition or multiplication does not change the answer.',
      rule: ['a + b = b + a', 'a × b = b × a'],
      find: 'Look for the same numbers in a different order.', ex: ['4 + 6', '6 + 4'] },
    { key: 'associative', name: 'Associative', color: '#13A46B', title: 'ASSOCIATIVE PROPERTY', card: 'cd-front-associative', medal: 'rewards/medal-associative-unlocked',
      teach: 'Changing the grouping of numbers in addition or multiplication does not change the answer.',
      how: 'Changing the grouping of numbers does not change the answer.', demo: 'associative',                                 // row 22 OST + animation
      rule: ['(a + b) + c = a + (b + c)', '(a × b) × c = a × (b × c)'],
      find: 'Look for the same three numbers with the brackets moved.', ex: ['(2 + 3) + 5', '2 + (3 + 5)'] },
    { key: 'distributive', name: 'Distributive', color: '#F06A2B', title: 'DISTRIBUTIVE PROPERTY', card: 'cd-front-distributive', medal: 'rewards/medal-distributive-unlocked',
      teach: 'Multiplying a number by a sum is the same as multiplying each part separately and then adding the results.',
      how: 'Multiply each part separately and add the answers.', demo: 'distributive',                                          // row 44 OST + animation
      rule: ['a × (b + c) = (a × b) + (a × c)'],
      find: 'Multiply the outside number by each number in the brackets, then add.', ex: ['3 × (4 + 2)', '(3 × 4) + (3 × 2)'] },
    { key: 'identity', name: 'Identity', color: '#8B5CF6', title: 'IDENTITY PROPERTY', card: 'cd-front-identity', medal: 'rewards/medal-identity-unlocked', spare: 3,
      teach: 'Adding 0 or multiplying by 1 keeps the number unchanged.',
      how: 'Adding 0 or multiplying by 1 keeps the number unchanged.', demo: 'identity',                                        // row 66 OST + animation
      rule: ['a + 0 = a', 'a × 1 = a'],
      find: 'Find the number that keeps the answer the same: + 0 or × 1.', ex: ['15 + ___ = 15', '0'] },
    { key: 'final', name: 'Final Flip', color: '#E8384F', title: 'FINAL FLIP', card: 'cd-front-last-card', medal: 'ui/ui-trophy', deal: [1, 3], tag: 'Game rule',
      teach: 'When you have only one card left, call FINAL FLIP before playing your last card.',
      rule: ['1 card left → FINAL FLIP!'],
      find: 'With one card left, tap FINAL FLIP first, then play your last card.', ex: ['14 × ___ = 14', '1'] }
  ];

  /* ---------- Part 1: game hook and how to play, in the order of "Number flip - Sheet6" ---------- */
  const HOOK = { welcome: 'Welcome to the Number Card Challenge!',                                                                        // Sheet6 line 1
    vo: 'Look at these colourful number cards! Each card brings a new challenge, and every flip brings a surprise!' };                     // line 2
  const SETUP = { vo: 'Two players, one challenge!', ost: 'Two players, one challenge!',                                                     // line 3
    vo2: 'Match the cards correctly and clear your hand.', ost2: 'Match the cards. Clear your hand.',                                      // line 4
    deal: 'Both players begin with 7 cards each.', dealOst: '7 CARDS EACH',                                                                // line 5
    win: 'The player who finishes all their cards first wins!', winOst: 'CLEAR YOUR HAND TO WIN!',                                         // line 6
    idle: 'Tap NEXT!', idle2: 'Tap PLAY to begin!' };
  const HOW = {
    /* line 7: Skip, Reverse, Swap and Flip; tap each card to see what it does */
    actions: { vo: 'Use special cards to Skip, Reverse, Swap and Flip!', ost: 'SKIP • REVERSE • SWAP • FLIP',
      idle: 'Tap a special card to see what it does!',
      each: { skip: 'Skip misses a turn.', reverse: 'Reverse changes direction.', swap: 'Swap changes player hands!', flip: 'FLIP! A new number trick starts!' } },
    draw: { vo: 'No matching card? Draw one from the pile!', ost: 'DRAW 1 CARD', idle: 'Tap the draw pile!' },                              // line 8
    hint: { vo: 'Need help? Tap the Hint icon to check the rules.', idle: 'Tap the ? button!', close: 'Tap BACK TO GAME!' },  // line 9
    /* line 10: the cards are reshuffled and dealt again, a centre card is placed, then one worked example */
    ready: { vo: 'The cards are shuffled, the players are set. Match the card placed in the centre.', vo2: 'Not sure how to match it? Let me show you an example!' },
    match: { centre: '2 + 3', right: '3 + 2', wrongs: ['2 + 4', '1 + 3'], ost: '2 + 3 = 3 + 2' },
    go: { vo: "Now, ready to play? Let's begin!" }                                                                                       // line 11
  };
  /* the Hint panel: the game rules, always available (Sheet6 "Rules for Learner Support" and "Hint Icon") */
  const RULES = {
    intro: { title: 'MATCHING', find: 'Find the card in your hand that matches the centre card.', ex: ['2 + 3', '3 + 2'] },
    list: ['2 players. 7 cards each.', 'Take turns: match the centre card.', 'No match? Draw one from the pile.', 'First to clear the hand wins!'],
    specials: [['skip', 'Skip misses a turn.'], ['reverse', 'Reverse changes direction.'], ['swap', 'Swap changes player hands.'], ['flip', 'FLIP! A new number trick.']]
  };
  /* Sheet6 "Game Completion" */
  const RESULT = { win: 'YOU WIN!', lose: 'COMPUTER WINS!', loseSub: 'TRY AGAIN!', loseVo: 'The computer cleared its hand first. Try again!' };

  /* ---------- shared lines ---------- */
  const WRONG1 = 'Check the numbers again.';
  /* Sheet5 rows 21 and 19: none of the learner's cards match; draw one card, it joins the options and glows */
  const NOMATCH = { vo: 'Oops! No match yet! Draw one card!', ost: 'DRAW 1 CARD', ok: 'One more card in the options!', idle: 'Tap the draw pile!' };
  /* rows 39, 61, 82: "Draw When Stuck" after three misses on Practice 6; the retry (rows 40, 62, 83) has its own success and inactivity lines */
  const STUCK = { vo: "Oops! Let's draw one card and try again!", ost: 'DRAW 1 CARD!', ok: 'One more card! Try the match again!', idle: 'Tap the draw pile!', ridle: 'Tap the glowing matching card!' };

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
  /* the computer's own turn: it gets its own centre card and three cards (all given by the sheet), checks them one by one
     and plays the match; the equation panel shows its working. */
  const CPU = (centre, right, wrongs, vo = "Computer's turn!", ok, extra = {}) =>
    ({ t: 'cpu', centre, right, wrongs, vo, ost: "COMPUTER'S TURN", ok: ok || `Computer's match! Both equal ${ev(centre)}!`, ...extra });
  const CDS = (centre, right, wrongs, vo, extra = {}) => {
    const [x, y] = right.match(/\([^)]*\)/g).map(ev);
    return CPU(centre, right, wrongs, vo, null, { val: `${x} + ${y} = ${x + y}`, dup: true, ...extra });
  };
  const CID = (centre, right, wrongs, fill, vo, extra = {}) =>
    CPU(centre, right, wrongs, vo, `Computer's match! ${fill}!`, { fill, v: +fill.split(' = ').pop(), badge: false, ...extra });
  const CPUACT = (act, vo, ost, ok, extra = {}) => ({ t: 'cpuAct', act, vo, ost, ok, ...extra });
  const GIVE = (act, vo, ost, ok, idle, extra = {}) => ({ t: 'give', act, vo, ost, ok, idle, ...extra });
  /* FLIP: Part 2 row 27 lands on the centre pile; Parts 3 and 4 (rows 43, 65) appear in the learner's hand */
  const FLIP = (vo, hand = false) => ({ t: 'flip', vo, ost: 'FLIP THE CARDS!', ok: 'New rule unlocked!', idle: 'Tap the FLIP card!', hand });

  /* ---------- Part 2: Commutative (2 players), in the order of "Number flip - Sheet5" ---------- */
  const PART2 = [
    { t: 'teach', part: 0 },
    M('4 + 6', '6 + 4', ['4 + 5', '7 + 2'], "Look! 4 + 6 makes 10. Switch the numbers, and it's still 10! This is Commutative Property. Changing the order does not change the answer. Now find the matching card.", 'Great! Both make 10!', 'Switching 4 and 6 keeps the answer 10.', 'Find the card with 6 and 4!', { guided: true }), // 9
    CPU('5 + 8', '8 + 5', ['5 + 7', '8 + 2'], "Computer's turn! Let's see its move!", 'Nice match! Both make 13!', { vo2: 'Find the matching card!' }),               // 10
    GIVE('skip', "A Skip card! Oh! The computer's turn is missed. Your turn again!", 'SKIP CARD!', 'SKIP! Computer misses its turn!', 'Tap the Skip card!'),           // 12
    M('3 × 7', '7 × 3', ['3 × 6', '7 + 3'], 'Your turn again! Find the match!', 'Perfect! Both make 21!', '3 × 7 and 7 × 3 both make 21.', 'Find the same factors, switched!', { confetti: true }), // 13
    CPUACT('reverse', "REVERSE! Oh! Your turn is missed. Computer's turn again!", 'REVERSE!', 'Computer gets another turn!', { pre: "Computer's turn!", preOst: 'COMPUTER PLAYS' }), // 14 + 16
    CPU('9 + 4', '4 + 9', ['9 + 5', '4 + 8'], 'Find the next match!', 'Great! Both make 13!', { ost: 'Find the matching card!' }),                                      // 15
    M('12 + 7', '7 + 12', ['8 + 12', '12 + 8', '7 + 11'], 'Find the matching card!', 'Great match! Both make 19!', '12 + 7 and 7 + 12 both make 19.', 'Look for 7 and 12!', { nomatch: true }), // 21, 19, 21
    CPU('6 × 5', '5 × 6', ['6 × 4', '5 + 6'], "Computer's turn!", 'Yes! Both make 30!', { ost: 'COMPUTER PLAYS', vo2: 'Find the matching card!' }),                 // 20 + 18
    M('8 × 4', '4 × 8', ['8 × 5', '4 + 8'], 'Your turn again! Find the match!', 'Perfect! Both make 32!', '8 × 4 and 4 × 8 both make 32.', 'Find the matching factors!', { ost: 'YOUR TURN' }), // 23
    CPUACT('skip', 'Oh no! Computer played Skip! Your turn is missed!', "YOU'RE SKIPPED!", 'Computer plays again!'),                                                    // 24
    CPU('15 + 6', '6 + 15', ['15 + 7', '6 + 14'], 'Find the matching card!', 'Awesome! Both make 21!', { ost: 'Find the matching card!' }),                            // 26
    FLIP('FLIP! New cards, new trick!')                                                                                                                               // 27
  ];

  /* ---------- property explanations (GOT IT panels) ---------- */
  const EXPLAIN = {
    /* ost: the sheet's on-screen text, shown as the caption when GOT IT appears */
    associative: {                                                                                                                                                     // Part 3 row 23
      lines: ['Look! First we add 2 and 3, then 5. We get 10!', 'Now group 3 and 5 first. Still 10!', 'This is the Associative Property. Changing the groups keeps the answer the same.'],
      ost: '(2 + 3) + 5 = 10; 2 + (3 + 5) = 10',
      a: '(2 + 3) + 5', b: '2 + (3 + 5)', val: 10, ma: '(2 × 3) × 4', mb: '2 × (3 × 4)', mval: 24,
      ok: "Let's match the groups!", idle: 'Tap GOT IT to play!' },
    distributive: {                                                                                                                                                    // Part 4 row 45
      ost: '3 × (4 + 2) = (3 × 4) + (3 × 2) = 18',
      lines: ['Look! 3 times 6 makes 18.', 'Now split 6 into 4 and 2. Multiply 3 by 4 to get 12, and 3 by 2 to get 6.', "Add them together, and it's still 18!", 'This is the Distributive Property.', 'We multiply each part and add the answers!'],
      eqs: ['3 × (4 + 2)', '3 × 6 = 18', '3 × 4 = 12', '3 × 2 = 6', '12 + 6 = 18'], rows: 3, cols: 6, split: 4,
      ok: "Let's match the split cards!", idle: 'Tap GOT IT to play!' },
    identity: {                                                                                                                                                        // Part 5 row 67
      lines: ["Look! Add 0 to 8, and it's still 8!", "Multiply 8 by 1, and it's still 8!", 'But multiplying by 0 gives 0!', 'This is the Identity Property.'],
      rows: ['8 + 0 = 8', '8 × 1 = 8', '8 × 0 = 0'], ost: '8 + 0 = 8; 8 × 1 = 8; 8 × 0 = 0',
      ok: "Let's keep the numbers the same!", idle: 'Tap GOT IT to play!' }
  };

  /* ---------- Part 3: Associative (2 players), new V2 sheet rows 22 to 43 ---------- */
  const PART3 = [
    { t: 'teach', part: 1 },                                                                                                                                          // 22
    { t: 'explain', key: 'associative' },                                                                                                                             // 23
    M('(2 + 3) + 5', '2 + (3 + 5)', ['(2 + 4) + 5', '3 + (2 + 4)'], 'Look! Grouping 2 and 3 first gives 10. Now group 3 and 5 first. The answer is still 10! Find the matching card!', 'Nice match! Both equal 10!', 'Grouping 2 and 3 or 3 and 5 gives the same total, 10.', 'Find the same numbers in a different group!', { guided: true }), // 24
    CPU('(3 + 4) + 6', '3 + (4 + 6)', ['(3 + 5) + 6', '4 + (3 + 5)'], "Computer's turn! Let's see its move! Find the matching card!", 'Great match! Both equal 13!'),         // 25
    M('(4 + 6) + 2', '4 + (6 + 2)', ['(4 + 5) + 2', '6 + (4 + 3)'], 'Your turn! Find the matching card!', 'Nice match! Both equal 12!', 'Grouping 4 and 6 or 6 and 2 gives the same total, 12.', 'Look for the same numbers in a new group!'), // 26
    CPUACT('reverse', 'REVERSE! Oh! Your turn is missed. Computer plays again!', 'REVERSE! COMPUTER PLAYS AGAIN!', 'Computer gets another turn!'),                      // 27
    CPU('(5 × 2) × 4', '5 × (2 × 4)', ['(5 × 3) × 4', '2 × (5 × 3)'], 'Computer plays again! Find the matching card!', 'Perfect! Both equal 40!'),                       // 28
    M('(3 × 2) × 5', '3 × (2 × 5)', ['(3 × 4) × 5', '2 × (3 × 6)'], 'Find the matching card!', 'Perfect match! Both equal 30!', 'Multiplying 3 and 2 first or 2 and 5 first gives the same answer, 30.', 'Find the matching group!', { confetti: true }), // 29
    GIVE('reverse', 'A Reverse card! Play it and take another turn!', 'REVERSE! PLAY AGAIN!', 'Nice reverse! Your turn again!', 'Tap the Reverse card!'),              // 30
    M('(7 + 3) + 8', '7 + (3 + 8)', ['7 + (4 + 8)', '3 + (7 + 9)'], 'Your turn again! Find the matching card!', 'Great! Both equal 18!', 'Adding 7 and 3 first or 3 and 8 first gives the same total, 18.', 'Look for the same three numbers!'), // 31
    CPU('(6 + 2) + 5', '6 + (2 + 5)', ['(6 + 3) + 5', '2 + (6 + 4)'], "Computer's turn! Find the matching card!", 'Nice match! Both equal 13!'),                           // 32
    M('(5 + 5) + 9', '5 + (5 + 9)', ['(5 + 6) + 9', '9 + (5 + 6)'], 'Find the matching card!', 'Nice match! Both equal 19!', 'Grouping the first two 5s or grouping 5 and 9 keeps the total 19.', 'Find the card with different brackets!'), // 33
    GIVE('mystery', 'A Mystery Card! Flip it!', 'MYSTERY CARD!', 'Lucky you! Drop one extra card!', 'Tap the Mystery Card!', { reveal: 'DROP 1', img: 'cd-mystery-reveal-associative' }), // 34
    M('(4 × 5) × 2', '4 × (5 × 2)', ['(4 × 6) × 2', '5 × (4 × 3)'], 'Your bonus turn! Find the matching card!', 'Perfect! Both equal 40!', 'Multiplying 4 and 5 first or 5 and 2 first gives the same answer, 40.', 'Look for the matching multiplication group!'), // 35
    CPUACT('skip', 'Oh no! Computer played Skip! Your turn is missed!', "YOU'RE SKIPPED!", 'Computer plays again!'),                                                    // 36
    CPU('(8 × 2) × 3', '8 × (2 × 3)', ['(8 × 4) × 3', '2 × (8 × 4)'], 'Computer plays again! Find the matching card!', 'Great match! Both equal 48!'),                   // 37
    M('(6 + 4) + 7', '6 + (4 + 7)', ['(6 + 5) + 7', '4 + (6 + 8)'], 'Find the matching card!', 'Great match! Both equal 17!', 'Adding 6 and 4 first or 4 and 7 first gives the same total, 17.', 'Find the matching group!', { stuck: true, rok: 'Yes! Both equal 17!' }), // 38, 39, 40
    CPU('(9 + 3) + 4', '9 + (3 + 4)', ['(9 + 5) + 4', '3 + (9 + 6)'], "Computer's turn! Find the matching card!", 'Perfect match! Both equal 16!'),                        // 41
    M('(2 × 6) × 5', '2 × (6 × 5)', ['(2 × 5) × 7', '2 × (6 × 4)'], 'Find the matching card!', 'Awesome! Both equal 60!', 'Multiplying 2 and 6 first or 6 and 5 first gives the same answer, 60.', 'Find the final matching group!', { confetti: true }), // 42
    FLIP('FLIP THE CARDS! New cards, new trick!', true)                                                                                                               // 43
  ];

  /* ---------- Part 4: Distributive (2 players), new V2 sheet rows 44 to 65 ---------- */
  const PART4 = [
    { t: 'teach', part: 2 },                                                                                                                                          // 44
    { t: 'explain', key: 'distributive' },                                                                                                                            // 45
    DS('3 × (4 + 2)', '(3 × 4) + (3 × 2)', ['3 × (4 × 2)', '(3 + 4) × 2'], 'Nice match! Both equal 18!', 'Multiply 3 by both 4 and 2, then add 12 and 6 to get 18.', 'Find the card with both multiplication parts!', { guided: true, vo: 'Look! Multiply 3 by both 4 and 2. Add the answers to get 18! Find the matching card!' }), // 46
    CDS('2 × (5 + 3)', '(2 × 5) + (2 × 3)', ['2 × (5 × 3)', '(2 + 5) × 3'], "Computer's turn! Let's see its move! Find the matching card!", { ok: 'Great match! Both equal 16!' }), // 47
    DS('4 × (5 + 2)', '(4 × 5) + (4 × 2)', ['(4 + 5) × 2', '4 × (5 × 2)'], 'Great match! Both equal 28!', 'Multiply 4 by 5 and 2 separately. Then add 20 and 8 to get 28.', 'Look for 4 multiplied by both numbers!'), // 48
    GIVE('skip', 'A Skip card! Play it and take another turn!', 'SKIP! PLAY AGAIN!', 'SKIP! Computer misses its turn!', 'Tap the Skip card!'),                         // 49
    DS('5 × (6 + 3)', '(5 × 6) + (5 × 3)', ['5 × (6 × 3)', '(5 + 6) × 3'], 'Perfect! Both equal 45!', 'Multiply 5 by both 6 and 3. Adding 30 and 15 gives 45.', 'Find the card with 5 multiplied by both parts!', { confetti: true, vo: 'Your turn again! Find the matching card!' }), // 50
    CPUACT('mystery', "Computer played a Mystery Card! Let's see what's inside!", 'MYSTERY CARD!', 'Lucky computer! Drop one extra card!', { reveal: 'DROP 1', img: 'cd-mystery-reveal-distributive' }), // 51
    CDS('6 × (3 + 2)', '(6 × 3) + (6 × 2)', ['6 × (3 × 2)', '(6 + 3) × 2'], "Computer's bonus turn! Find the matching card!", { ok: 'Nice match! Both equal 30!' }),   // 52
    DS('6 × (10 + 2)', '(6 × 10) + (6 × 2)', ['6 × (10 × 2)', '(6 + 10) × 2'], 'Nice match! Both equal 72!', 'Multiply 6 by both 10 and 2. Adding 60 and 12 gives 72.', 'Look for the two multiplication parts!'), // 53
    GIVE('swap', 'Whoa! A Swap Hands card! Play it!', 'SWAP HANDS!', "SWAP! You got the computer's cards!", 'Tap the Swap Hands card!', { before: [4, 2] }),         // 54
    CDS('3 × (7 + 2)', '(3 × 7) + (3 × 2)', ['3 × (7 × 2)', '(3 + 7) × 2'], "Computer's turn! Find the matching card!", { ok: 'Perfect match! Both equal 27!' }),     // 55
    DS('7 × (4 + 3)', '(7 × 4) + (7 × 3)', ['(7 + 4) × 3', '7 × (4 × 3)'], 'Great! Both equal 49!', 'Multiply 7 by 4 and 3 separately. Then add 28 and 21 to get 49.', 'Find the matching multiplication parts!'), // 56
    GIVE('reverse', 'A Reverse card! Play it!', 'REVERSE! PLAY AGAIN!', 'Nice reverse! Your turn again!', 'Tap the Reverse card!'),                                    // 57
    DS('8 × (5 + 2)', '(8 × 5) + (8 × 2)', ['8 × (5 × 2)', '(8 + 5) × 2'], 'Perfect match! Both equal 56!', 'Multiply 8 by both 5 and 2. Adding 40 and 16 gives 56.', 'Look for 8 multiplied by both numbers!', { vo: 'Your turn again! Find the matching card!' }), // 58
    CDS('4 × (6 + 3)', '(4 × 6) + (4 × 3)', ['(4 + 6) × 3', '4 × (6 × 3)'], "Computer's turn! Find the matching card!", { ok: 'Great! Both equal 36!' }),             // 59
    DS('9 × (3 + 4)', '(9 × 3) + (9 × 4)', ['(9 + 3) × 4', '9 × (3 × 4)'], 'Nice match! Both equal 63!', 'Multiply 9 by both 3 and 4. Adding 27 and 36 gives 63.', 'Find the split with 9 multiplying both parts!', { stuck: true, rok: 'Yes! Both equal 63!' }), // 60, 61, 62
    CDS('5 × (4 + 3)', '(5 × 4) + (5 × 3)', ['5 × (4 × 3)', '(5 + 4) × 3'], "Computer's turn! Find the matching card!", { ok: 'Nice match! Both equal 35!' }),         // 63
    DS('4 × (10 + 5)', '(4 × 10) + (4 × 5)', ['4 × (10 × 5)', '(4 + 10) × 5'], 'Awesome! Both equal 60!', 'Multiply 4 by both 10 and 5. Adding 40 and 20 gives 60.', 'Find the final matching split!', { confetti: true }), // 64
    FLIP('FLIP THE CARDS! New cards, new trick!', true)                                                                                                               // 65
  ];

  /* ---------- Part 5: Identity, new V2 sheet rows 66 to 88 ---------- */
  const PART5 = [
    { t: 'teach', part: 3 },                                                                                                                                          // 66
    { t: 'explain', key: 'identity' },                                                                                                                                // 67
    M('8 → ?', '+0', ['×0'], 'Look! Adding 0 or multiplying by 1 keeps 8 unchanged. Find the matching card!', 'Nice match! 8 stays 8!', 'Adding 0 or multiplying by 1 keeps 8 unchanged.', 'Find the card that keeps 8 the same!',
      { rights: ['+0', '×1'], eqB: { '+0': '8 + 0 = 8', '×1': '8 × 1 = 8' }, v: 8, w3: 'Find +0 or ×1!', badge: false, guided: true }),                              // 68
    CID('11 + ___ = 11', '0', ['1', '3'], '11 + 0 = 11', "Computer's turn! Let's see its move! Find the matching card!", { ok: 'Great match! Still 11!' }),             // 69
    ID('15 + ___ = 15', '0', ['1', '5'], '15 + 0 = 15', 'Great match! Still 15!', 'Adding 0 to 15 keeps the answer 15.', 'Find the 0 card!', 'Find the number that keeps 15 unchanged!'), // 70
    GIVE('skip', 'A Skip card! Play it!', 'SKIP! PLAY AGAIN!', 'SKIP! Computer misses its turn!', 'Tap the Skip card!'),                                                // 71
    ID('12 × ___ = 12', '1', ['0', '2'], '12 × 1 = 12', 'Perfect! Still 12!', 'Multiplying 12 by 1 keeps the answer 12.', 'Find the 1 card!', 'Which number keeps 12 the same?', { vo: 'Your turn again! Find the matching card!' }), // 72
    CID('16 × ___ = 16', '1', ['0', '4'], '16 × 1 = 16', "Computer's turn! Find the matching card!", { ok: 'Nice match! Still 16!' }),                                 // 73
    ID('9 × 0 = ?', '0', ['9', '1'], '9 × 0 = 0', 'Yes! The answer is 0!', 'Multiplying 9 by 0 gives 0, not 9.', 'Find the 0 card!', 'Look at the multiplication by 0!'), // 74
    GIVE('mystery', 'A Mystery Card! Flip it!', 'MYSTERY CARD!', 'Lucky you! Bonus turn!', 'Tap the Mystery Card!', { reveal: 'EXTRA TURN', img: 'cd-mystery-reveal-commutative', bonus: true }), // 75
    ID('24 + ___ = 24', '0', ['1', '4'], '24 + 0 = 24', 'Nice match! Still 24!', 'Adding 0 to 24 keeps the answer 24.', 'Find the 0 card!', 'Keep 24 unchanged!', { vo: 'Your bonus turn! Find the matching card!' }), // 76
    CID('21 + ___ = 21', '0', ['1', '2'], '21 + 0 = 21', "Computer's turn! Find the matching card!", { ok: 'Great match! Still 21!' }),                                // 77
    GIVE('reverse', 'A Reverse card! Play it!', 'REVERSE! PLAY AGAIN!', 'Nice reverse! Your turn again!', 'Tap the Reverse card!'),                                    // 78
    ID('18 × ___ = 18', '1', ['0', '3'], '18 × 1 = 18', 'Great match! Still 18!', 'Multiplying 18 by 1 keeps the answer 18.', 'Find the 1 card!', 'Which card keeps 18 unchanged?', { vo: 'Your turn again! Find the matching card!' }), // 79
    CID('27 × ___ = 27', '1', ['0', '7'], '27 × 1 = 27', "Computer's turn! Find the matching card!", { ok: 'Perfect! Still 27!' }),                                    // 80
    ID('35 + ___ = 35', '0', ['1', '5'], '35 + 0 = 35', 'Perfect! Still 35!', 'Adding 0 to 35 keeps the answer 35.', 'Find the 0 card!', 'Find the number that keeps 35 unchanged!', { stuck: true, rok: 'Yes! Still 35!' }), // 81, 82, 83
    CID('32 + ___ = 32', '0', ['1', '2'], '32 + 0 = 32', "Computer's turn! Find the matching card!", { ok: 'Nice match! Still 32!' }),                                 // 84
    CPUACT('skip', 'Oh no! Computer played Skip! Your turn is missed!', "YOU'RE SKIPPED!", 'Computer plays again!'),                                                    // 85
    CID('14 × ___ = 14', '1', ['0', '4'], '14 × 1 = 14', 'Computer plays again! Find the matching card!', { ok: 'Great match! Still 14!' }),                           // 86
    ID('42 × ___ = 42', '1', ['0', '2'], '42 × 1 = 42', 'Awesome! Still 42!', 'Multiplying 42 by 1 keeps the answer 42.', 'Find the 1 card!', 'Find the final matching card!', { confetti: true }), // 87
    { t: 'complete', vo: 'Amazing! Adding 0 or multiplying by 1 keeps the number unchanged!', ost: 'IDENTITY COMPLETE!', ok: 'All four properties cleared!' }          // 88
  ];

  /* ---------- Part 6: FINAL FLIP finish, rows 54 to 57 ---------- */
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
    draw: { img: 'cd-mystery-reveal-distributive', label: 'DRAW', face: '+2' }, flip: { img: 'cd-flip', label: 'FLIP' }
  };

  /* the learner's other cards (the hand is always face up). One pool per part; none has the value of that part's centre cards */
  const FILLER = [
    ['3 + 9', '7 × 2', '8 + 6', '5 × 4', '2 + 11', '9 × 3', '6 + 7', '4 × 3', '9 + 5'],
    ['(1 + 4) + 6', '8 + (2 + 5)', '5 × (2 × 2)', '(3 + 3) + 7', '(2 × 2) × 6', '(6 + 1) + 7', '3 × (3 × 3)', '(4 + 4) + 8', '(1 × 7) × 3'],
    ['2 × (3 + 5)', '(6 × 2) + (6 × 3)', '3 × (7 + 1)', '(5 × 4) + (5 × 1)', '2 × (6 + 4)', '(7 × 2) + (7 × 1)', '4 × (2 + 1)', '(3 × 5) + (3 × 3)', '5 × (1 + 1)'],
    ['2', '6', '8', '9', '3', '5', '7', '4', '10'],
    ['1']
  ];

  const PLAY = [PART2, PART3, PART4, PART5, PART6];
  window.NF_CONTENT = { START_CARDS, PARTS, HOOK, SETUP, HOW, RULES, RESULT, WRONG1, STUCK, NOMATCH, PLAY, EXPLAIN, ACTIONS, FILLER, util: { shuffle, ev } };
})();
