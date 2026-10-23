/* Number Flip — content only: rounds, questions, generators, scripted events and lines. No game logic. */
(function () {
  const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const ev = s => { try { if (/_|\?/.test(s)) return null; return Function('"use strict";return (' + s.replace(/×/g, '*').replace(/−/g, '-') + ')')(); } catch (e) { return null; } };

  /* One entry per round. key = asset suffix (cards, icons). */
  const PHASES = [
    { key: 'commutative', name: 'Commutative', short: 'Swap', color: '#2F7CF6', ost: 'COMMUTATIVE PROPERTY',
      how: 'Swap the order. The answer stays the same.', rule: ['a + b = b + a', 'a × b = b × a'],
      reveal: 'Great! You switched the numbers and kept the answer the same!', flip: 'FLIP! New cards, new trick!',
      praise: 'Same two numbers, swapped. Same answer!', hintq: 'Which card keeps the SAME two numbers and the same sign, just swapped?', counter: 'Careful: 5 − 3 ≠ 3 − 5. Subtraction cannot be swapped.' },
    { key: 'associative', name: 'Associative', short: 'Group', color: '#13A46B', ost: 'ASSOCIATIVE PROPERTY',
      how: 'Move the brackets. The answer stays the same.', rule: ['(a + b) + c = a + (b + c)', '(a × b) × c = a × (b × c)'],
      reveal: 'Different groups, same answer!', flip: "FLIP! Let's see what's next!",
      praise: 'Same numbers, brackets moved. Same answer!', hintq: 'Which card keeps the same numbers and signs in the same order, with only the brackets moved?', counter: 'Careful: (8 − 4) − 2 ≠ 8 − (4 − 2). Brackets matter for −.' },
    { key: 'distributive', name: 'Distributive', short: 'Split', color: '#F06A2B', ost: 'DISTRIBUTIVE PROPERTY',
      how: 'Multiply each part, then add.', rule: ['a × (b + c) = (a × b) + (a × c)'],
      reveal: 'Great! You broke the numbers into smaller parts!', flip: 'FLIP! Can you keep the number the same?',
      praise: 'Each part got multiplied, then added. Same answer!', hintq: 'Which card multiplies the first number by EACH part inside the brackets?', counter: 'Careful: 3 × (4 + 2) ≠ (3 × 4) + 2. Multiply BOTH parts.' },
    { key: 'identity', name: 'Identity', short: 'Same', color: '#8B5CF6', ost: 'IDENTITY PROPERTY',
      how: 'Adding 0 or multiplying by 1 keeps a number the same.', rule: ['a + 0 = a', 'a × 1 = a'],
      reveal: 'Adding 0 or multiplying by 1 keeps the number the same!', note: 'Watch out: × 0 always gives 0. That is the zero property.',
      praise: 'Nothing changed. Adding 0 or × 1 keeps it the same!', hintq: 'Which card leaves the number exactly the same?' },
    { key: 'last-card', name: 'Last Card', short: 'Final', color: '#E8384F', icon: 'star' }
  ];

  const C = (centre, rights, wrongs, reveal, val, vo, extra = {}) => ({ centre, rights, wrongs, reveal, val, vo, ...extra });

  /* The concept doc's scripted questions: tutorial + 3 practice per round. */
  const SCRIPT = [
    [C('4 + 6', ['6 + 4'], ['4 + 5', '7 + 2'], '4 + 6 = 6 + 4', '10 = 10', 'Find the card with the same numbers, but switched!'),
     C('5 + 8', ['8 + 5'], ['6 + 7', '8 + 2'], '5 + 8 = 8 + 5', '13 = 13', 'Find a matching card!'),
     C('3 × 7', ['7 × 3'], ['3 × 6', '7 + 3'], '3 × 7 = 7 × 3', '21 = 21', 'Play the matching card!'),
     C('9 + 4', ['4 + 9'], ['6 + 7', '4 + 8'], '9 + 4 = 4 + 9', '13 = 13', 'Find the next match!')],
    [C('(2 + 3) + 5', ['2 + (3 + 5)'], ['(2 + 4) + 5', '3 + (2 + 4)'], '(2 + 3) + 5 = 2 + (3 + 5)', '10 = 10', 'Same numbers! Find a different group!'),
     C('(4 + 6) + 2', ['4 + (6 + 2)'], ['(4 + 6) + 3', '5 + (5 + 2)'], '(4 + 6) + 2 = 4 + (6 + 2)', '12 = 12', 'Find the matching group!'),
     C('(3 × 2) × 5', ['3 × (2 × 5)'], ['(3 + 2) × 5', '3 × (2 + 5)'], '(3 × 2) × 5 = 3 × (2 × 5)', '30 = 30', 'Match the groups!'),
     C('(7 + 3) + 8', ['7 + (3 + 8)'], ['6 + (4 + 8)', '(7 + 3) + 9'], '(7 + 3) + 8 = 7 + (3 + 8)', '18 = 18', 'One more matching group!')],
    [C('3 × (4 + 2)', ['(3 × 4) + (3 × 2)'], ['(3 × 4) + 2', '(3 + 4) × (3 + 2)'], '3 × (4 + 2) = 12 + 6', '18 = 18', 'This card can split! Find its matching pair!'),
     C('4 × (5 + 2)', ['(4 × 5) + (4 × 2)'], ['(4 × 5) + 2', '(4 + 5) × 2'], '4 × (5 + 2) = 20 + 8', '28 = 28', 'Find the matching split!'),
     C('5 × (6 + 3)', ['(5 × 6) + (5 × 3)'], ['(5 × 6) + 3', '(5 × 6) × (5 × 3)'], '5 × (6 + 3) = 30 + 15', '45 = 45', 'Find the matching pair!'),
     C('6 × (10 + 2)', ['(6 × 10) + (6 × 2)'], ['(6 × 10) + 2', '(6 + 10) × (6 + 2)'], '6 × (10 + 2) = 60 + 12', '72 = 72', 'One last split!')],
    [C('8', ['+ 0', '× 1'], ['× 0'], '8 + 0 = 8 · 8 × 1 = 8', 'Still 8!', 'Keep 8 unchanged! Pick a card!', { sub: 'Keep it 8', target: 8 }),
     C('15 + ___', ['0'], ['1', '5'], '15 + 0 = 15', 'Still 15!', "Don't change 15!", { sub: '= 15', target: 15 }),
     C('12 × ___', ['1'], ['0', '12'], '12 × 1 = 12', 'Still 12!', 'Keep 12 the same!', { sub: '= 12', target: 12 }),
     C('9 × 0 = ?', ['0'], ['9', '1'], '9 × 0 = 0', 'Anything × 0 is 0', 'Surprise! What happens with this card?')]
  ];

  /* a card with the SAME value that breaks the rule (not a swap / not a regroup): adding both sides is not enough to find the match */
  function sameValueSwapDecoy(a, b, mul, op) {
    const v = mul ? a * b : a + b, hi = mul ? 12 : 16, out = [];
    for (let x = 2; x <= hi; x++) { const y = mul ? v / x : v - x; if (!Number.isInteger(y) || y < 2 || y > hi || x > y || x === y) continue; if ((x === a && y === b) || (x === b && y === a)) continue; out.push([x, y]); }
    if (!out.length) return null; const [x, y] = shuffle(out)[0]; return Math.random() < .5 ? `${x} ${op} ${y}` : `${y} ${op} ${x}`;
  }
  function pickWrongs(cands, bad, n = 2) { const out = []; for (const c of shuffle(cands)) { const v = ev(c); if (v === null || v === bad || out.includes(c)) continue; out.push(c); if (out.length >= n) break; } return out; }
  function genComm() { const mul = Math.random() < .35, m = mul ? 9 : 15; let a = ri(2, m), b = ri(2, m); while (b === a) b = ri(2, m); const op = mul ? '×' : '+', op2 = mul ? '+' : '×';
    const centre = `${a} ${op} ${b}`, v = ev(centre);
    const dec = sameValueSwapDecoy(a, b, mul, op), wr = pickWrongs([`${b} ${op} ${a + 1}`, `${a} ${op} ${b + 1}`, `${b} ${op2} ${a}`, `${a} ${op} ${b - 1}`, `${b + 1} ${op} ${a}`], v);
    return C(centre, [`${b} ${op} ${a}`], dec ? [dec, wr[0]] : wr, `${centre} = ${b} ${op} ${a}`, `${v} = ${v}`, 'Find the card with the same numbers, switched!'); }
  function genAssoc() { const mul = Math.random() < .3, m = mul ? 5 : 9; const a = ri(2, m), b = ri(2, m), c = ri(2, m); const op = mul ? '×' : '+', op2 = mul ? '+' : '×';
    const centre = `(${a} ${op} ${b}) ${op} ${c}`, v = ev(centre);
    const dec = !mul && b > 2 ? `${a + 1} ${op} (${b - 1} ${op} ${c})` : mul && b % 2 === 0 ? `${a * 2} ${op} (${b / 2} ${op} ${c})` : null, wr = pickWrongs([`(${a} ${op} ${b}) ${op} ${c + 1}`, `${a} ${op} (${b} ${op2} ${c})`, `${a} ${op} (${b + 1} ${op} ${c})`, `(${a} ${op2} ${b}) ${op} ${c}`], v);
    return C(centre, [`${a} ${op} (${b} ${op} ${c})`], dec ? [dec, wr[0]] : wr, `${centre} = ${a} ${op} (${b} ${op} ${c})`, `${v} = ${v}`, 'Same numbers, new groups. Find the match!'); }
  function genDist() { const a = ri(2, 9), b = ri(2, 10); let c = ri(1, 9); while (c === b) c = ri(1, 9); const centre = `${a} × (${b} + ${c})`, v = ev(centre);
    return C(centre, [`(${a} × ${b}) + (${a} × ${c})`], pickWrongs([`(${a} × ${b}) + ${c}`, `(${a} + ${b}) × (${a} + ${c})`, `(${a} × ${b}) × (${a} × ${c})`, `${a} + (${b} × ${c})`], v), `${centre} = ${a * b} + ${a * c}`, `${v} = ${v}`, 'Find the correct split!'); }
  function genIdent(forRobo) { const n = ri(3, 20), r = Math.random(), t = forRobo ? 0 : r < .3 ? 0 : r < .6 ? 1 : r < .9 ? 2 : 3;
    if (t === 0) { const r = Math.random() < .5 ? '+ 0' : '× 1'; return C(`${n}`, [r], shuffle(['× 0', '+ 1', '× 2']).slice(0, 2), `${n} ${r} = ${n}`, `Still ${n}!`, `Keep ${n} unchanged! Pick a card!`, { sub: `Keep it ${n}`, target: n }); }
    if (t === 1) return C(`${n} + ___`, ['0'], ['1', `${n}`], `${n} + 0 = ${n}`, `Still ${n}!`, `Don't change ${n}!`, { sub: `= ${n}`, target: n });
    if (t === 2) return C(`${n} × ___`, ['1'], ['0', `${n}`], `${n} × 1 = ${n}`, `Still ${n}!`, `Keep ${n} the same!`, { sub: `= ${n}`, target: n });
    return C(`${n} × 0 = ?`, ['0'], [`${n}`, '1'], `${n} × 0 = 0`, 'Anything × 0 is 0', 'What happens with this card?'); }
  const GEN = [genComm, genAssoc, genDist, genIdent];

  /* Scripted moments from the concept doc. Key = "round-matches". */
  const LEARNER_EVENTS = {
    '0-1': { give: 'skip', vo: 'You got a SKIP card! Play it whenever you like, and Robo misses a turn.' },
    '1-2': { give: 'reverse', vo: 'A REVERSE card! With two players, that means you go again.' },
    '1-3': { give: 'mystery', outcome: 'drop', vo: 'Whoa! A Mystery Card! Tap it to reveal!' },
    '2-2': { give: 'swap', vo: 'A Swap Hands card! Trade hands with Robo when it helps you.' },
    '3-3': { give: 'mystery', outcome: 'bonus', vo: 'Another Mystery Card! Tap it to reveal!' }
  };
  const ROBO_EVENTS = { '0-3': 'skip', '1-2': 'reverse', '2-3': 'mystery', '3-2': 'skip' };

  const ACTIONS = {
    skip: { img: 'cd-skip', label: 'SKIP' }, reverse: { img: 'cd-reverse', label: 'REVERSE' },
    swap: { img: 'cd-swap-hands', label: 'SWAP HANDS' }, mystery: { img: 'cd-mystery', label: 'MYSTERY' }
  };

  /* Character lines: a little cheeky, never mean. */
  const LINES = {
    praise: ['Nice match! Same answer!', 'Yes! Same answer!', 'Perfect match!', 'You got it!', 'Brilliant!'],
    roboPlay: ['Beep boop. My move!', 'Calculating… done!', 'Robo plays a card!', 'Easy peasy, beep!'],
    roboTaunt: ['Ha-ha! Beep!', 'Bzzt! Sorry, not sorry!', 'Robo is on fire! Well… warm.'],
    roboOuch: ['Bzzzt… my circuits!', 'Error 404: turn not found!', 'Whoa, everything is spinning!'],
    roboDraw: ['Hmm, no match. Robo draws.', 'Beep… I need another card.'],
    idle: ['Need a hand? Look at the numbers on the middle card.', 'Take your time. Which card gives the same answer?']
  };

  window.NF_CONTENT = { PHASES, SCRIPT, GEN, LEARNER_EVENTS, ROBO_EVENTS, ACTIONS, LINES, util: { ri, shuffle, ev } };
})();
