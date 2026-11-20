/* Number Flip V2: game flow, rendering and motion (GSAP). Content lives in js/content.js.
   The game is a fixed script (the V2 LXD sheet, "Number flip - Game V2 (2)"): Hook → Setup → How to Play 1-4 → Part 2 Commutative → FLIP → Part 3 Associative → FLIP →
   Part 4 Distributive → FLIP → Part 5 Identity → Identity Complete → Part 6 FINAL FLIP → Victory. */
(() => {
'use strict';
const { START_CARDS, PARTS, HOOK, SETUP, HOW, RULES, RESULT, WRONG1, STUCK, NOMATCH, PLAY, EXPLAIN, ACTIONS, FILLER, util: { shuffle, ev } } = window.NF_CONTENT;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const A = p => `assets/${p}.webp`;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const MATCHES = PLAY.map(s => s.filter(x => x.t === 'match').length);
const NP = PLAY.length;
/* cards dealt when a part starts: the sheet's deal where it names one, otherwise one card per play plus spares, so the
   last match still has three cards to choose from (special cards arrive on top of the hand) */
const DEALS = PLAY.map((steps, p) => PARTS[p].deal || [
  2 + steps.filter(s => s.t === 'match' || (s.t === 'give' && s.act === 'mystery' && !s.bonus)).length,
  (PARTS[p].spare ?? 2) + steps.filter(s => s.t === 'cpu' || s.t === 'cpuAct').length + steps.filter(s => s.t === 'cpuAct' && s.act === 'mystery').length]);

/* ---------- stage fit ---------- */
const stage = $('#stage');
function fit() {
  const vw = innerWidth, vh = innerHeight, s = Math.min(vw / 1920, vh / 1080);
  stage.style.transform = `translate(${(vw - 1920 * s) / 2}px,${(vh - 1080 * s) / 2}px) scale(${s})`;
}
addEventListener('resize', fit); fit();

/* ---------- preload every image so pose swaps never flash ---------- */
const PRELOAD = [
  ...['idle', 'talking', 'cheering', 'pointing', 'thinking', 'oops'].map(p => 'characters/ch-flippy-' + p),
  ...['idle', 'thinking', 'playing', 'laughing', 'dizzy', 'sad'].map(p => 'characters/ch-robo-' + p),
  ...PARTS.map(p => 'cards/' + p.card), ...PARTS.map(p => p.medal), 'ui/ui-last-card-button', ...['commutative', 'associative', 'distributive', 'identity'].map(k => 'ui/ui-icon-' + k), 'cards/cd-back', 'cards/cd-flip', 'cards/cd-skip', 'cards/cd-reverse', 'cards/cd-swap-hands', 'cards/cd-mystery',
  'cards/cd-mystery-reveal-associative', 'cards/cd-mystery-reveal-distributive', 'cards/cd-mystery-reveal-commutative',
  'fx/fx-star-burst', 'fx/fx-hint-glow', 'fx/fx-card-glow', 'fx/fx-skip-smoke', 'fx/fx-reverse-arrows', 'fx/fx-mystery-swirl', 'fx/fx-card-trail', 'fx/fx-win-rays',
  ...['robo', 'flippy'].flatMap(w => ['grip-back', 'grip-front-fingers', 'open', 'release', 'ext'].map(k => `hands/arm-${w}-${k}`).concat(`characters/body-${w}-throw`)), 'ui/ui-stamp-badge'];
PRELOAD.forEach(p => { const i = new Image(); i.src = A(p); });

/* ---------- time: every wait is a GSAP delayed call, so Pause freezes the whole game ---------- */
let GID = 0;
const STALE = 'stale';
/* keep = reading time: never shortened by reduced motion */
const wait = (ms, keep) => { const g = GID; return new Promise((res, rej) => gsap.delayedCall((RM && !keep ? Math.min(ms, 350) : ms) / 1000, () => g === GID ? res() : rej(STALE))); };
const guard = g => { if (g !== GID) throw STALE; };
const D = s => RM ? Math.min(s, .12) : s;

/* ---------- sound ---------- */
const opts = { sound: true, voice: false };
let actx = null;
function audioInit() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { } }
function tone(f, t, d, type = 'triangle', v = .14, f2) {
  const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .015); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + .02);
}
function swish(t, d, v = .12, hz = 2500) {
  const n = actx.createBuffer(1, Math.ceil(actx.sampleRate * d), actx.sampleRate), ch = n.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  const s = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain(); s.buffer = n; f.type = 'bandpass'; f.frequency.value = hz; f.Q.value = .8;
  g.gain.value = v; s.connect(f).connect(g).connect(actx.destination); s.start(t);
}
/* recorded SFX (assets/audio, mp3 + ogg); any cue without a file falls back to the small synth above */
const AUDIO = { deal: ['card-deal', .9], flip: ['card-land', .55], land: ['card-land', 1], good: ['star-ding', .8], bad: ['gentle-wrong', .8], stamp: ['card-land', 1],
  whoosh: ['throw-whoosh', .85], magic: ['star-ding', .6, 1.35], pop: ['button-click', .8], win: ['win-jingle', .9], streak: ['streak', .9], levelup: ['level-up-fanfare', .95], star: ['star-ding', .55, 1.2] };
const abuf = {};
(function loadAudio() {
  const ext = document.createElement('audio').canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'mp3';
  [...new Set(Object.values(AUDIO).map(a => a[0]))].forEach(n => { const a = new Audio(`assets/audio/${n}.${ext}`); a.preload = 'auto'; abuf[n] = a; });
})();
function sfx(k) {
  if (!opts.sound) return; const a = AUDIO[k];
  if (a && abuf[a[0]]) { try { const n = abuf[a[0]].cloneNode(); n.volume = a[1]; n.playbackRate = a[2] || 1; n.preservesPitch = false; n.play().catch(() => { }); } catch (e) { } return; }
  if (!actx) return; const t = actx.currentTime;
  if (k === 'robo') [420, 640, 520].forEach((f, i) => tone(f, t + i * .06, .07, 'square', .03));
  else if (k === 'whoosh') swish(t, .5, .14, 1400);
}
/* browser voice for the VO lines (until recorded VO arrives); resolves when the line has been spoken */
function speak(text) {
  if (!opts.voice || !('speechSynthesis' in window)) return Promise.resolve();
  return new Promise(res => {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/_+/g, ' blank ').replace(/×/g, ' times ').replace(/→/g, ', ').replace(/•/g, ', '));
      const vs = speechSynthesis.getVoices(); const v = vs.find(v => /en-IN/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)); if (v) u.voice = v;
      u.rate = 1.02; u.pitch = 1.15; u.onend = u.onerror = () => res(); speechSynthesis.speak(u); setTimeout(res, 15000);
    } catch (e) { res(); }
  });
}

/* ---------- characters ---------- */
const POSES = {
  flippy: { idle: 'idle', talk: 'talking', cheer: 'cheering', point: 'pointing', think: 'thinking', oops: 'oops' },
  robo: { idle: 'idle', think: 'thinking', play: 'playing', laugh: 'laughing', dizzy: 'dizzy', sad: 'sad' }
};
const poseTok = { flippy: 0, robo: 0 };
function pose(who, name, holdMs) {
  const el = $('#' + who), tok = ++poseTok[who];
  el.src = A(`characters/ch-${who}-${POSES[who][name]}`);
  gsap.fromTo(el, { scaleY: .9, scaleX: 1.06 }, { scaleY: 1, scaleX: 1, duration: D(.45), ease: 'elastic.out(1,.45)', overwrite: 'auto' });
  if (holdMs) gsap.delayedCall(holdMs / 1000, () => { if (poseTok[who] === tok) pose(who, 'idle'); });
}
function breathe() {
  gsap.to('#flippyWrap', { scaleY: 1.025, y: -3, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 100%' });
  gsap.to('#roboWrap', { y: -6, duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tokClass = w => /\d|^[+×=]$|^\(|\)$/.test(w) ? 'm' : (/^[A-Z][A-Z!'’]{2,}[!.,]?$/.test(w) ? 'k' : '');
/* Flippy voices every VO line in the speech bubble */
function say(text, holdPose) {
  saidNow = text; dedupeOst();
  const p = $('#bubbleText'), words = text.split(' '); p.style.fontSize = text.length > 105 ? '25px' : text.length > 78 ? '28px' : '';
  p.innerHTML = words.map(w => `<span class="w ${tokClass(w)}">${esc(w)}</span>`).join(' ');
  gsap.fromTo('#bubble', { scale: .92, autoAlpha: .4 }, { scale: 1, autoAlpha: 1, duration: D(.35), ease: 'back.out(2.4)', overwrite: true });
  if (!RM) gsap.from(p.querySelectorAll('.w'), { autoAlpha: 0, y: 10, duration: .22, stagger: Math.min(.045, 1.1 / words.length), ease: 'power2.out' });
  if (!holdPose) pose('flippy', 'talk', Math.min(2600, 400 + text.length * 32));
  return speak(text);
}
/* say a line and wait until it has been read (or spoken) */
async function talk(text, holdPose) {
  const p = say(text, holdPose);
  await wait(Math.min(8500, 900 + text.length * 52), true);
  await Promise.race([p, wait(7000, true)]);
}

/* ---------- layout (stage px) ---------- */
const L = {
  pile: { x: 575, y: 430, w: 230, h: 326 },
  centre: { x: 845, y: 430, w: 230, h: 326 },
  played: { x: 1115, y: 430, w: 230, h: 326 },
  hand: { cx: 960, y: 808, w: 150, h: 213, gap: 12 },
  stack: { x: 1160, y: 866, w: 104, h: 148 },
  act: { x: 1547, y: 814, w: 140, h: 199 },
  fan: { x: 1410, y: 316, w: 80, h: 114 },
  big: { x: 820, y: 250, w: 280, h: 398 }
};
/* the computer's three cards during its turn (matches #cpuRow in style.css) */
const CPUROW = { x: 1384, y: 566, w: 130, h: 185, gap: 14 };
const rectOf = el => { let x = 0, y = 0, e = el; while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
const frontImg = p => PARTS[p].card;
const faceText = t => t.length <= 12 ? t : t.includes(') + (') ? t.replace(') + (', ') +<br>(') : t.includes(' = ') ? t.replace(/ = (?=[^=]*$)/, '<br>= ') : t;
function fs(t, w) { const n = Math.max(...t.split('<br>').map(l => l.replace(/<[^>]+>/g, '').length)); const k = n <= 3 ? .34 : n <= 6 ? .25 : n <= 9 ? .185 : n <= 13 ? .15 : .13; return Math.round(w * k); }
function cardInner(img, text, w, cls = '') { if (text != null) text = faceText(String(text)); return `<img src="${A('cards/' + img)}" alt="" draggable="false">${text != null ? `<span class="face ${cls}" style="font-size:${fs(text, w)}px">${text}</span>` : ''}`; }
const actInner = (type, w) => cardInner(ACTIONS[type].img, ACTIONS[type].face ?? null, w, 'actface');
function place(el, r, rot = 0) { el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; el.style.width = r.w + 'px'; el.style.height = r.h + 'px'; gsap.set(el, { rotation: rot }); }

/* ---------- effects ---------- */
function fx(name, cx, cy, size, vars = {}) {
  const im = document.createElement('img'); im.className = 'fx'; im.src = A('fx/' + name); im.alt = '';
  im.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`;
  $('#fxLayer').appendChild(im);
  const r0 = vars.r0 ?? 0;
  return gsap.fromTo(im, { scale: vars.from ?? .3, autoAlpha: 1, rotation: r0 }, { scale: vars.to ?? 1.2, rotation: r0 + (vars.rot ?? 30), autoAlpha: 0, duration: D(vars.dur ?? .9), ease: vars.ease ?? 'power2.out', onComplete: () => im.remove() });
}
function shake(px = 10) { if (RM) return; gsap.fromTo('#world', { x: 0 }, { keyframes: { x: [px, -px, px * .6, -px * .4, 0] }, duration: .35, ease: 'none' }); }
async function fly(from, to, html, { rot = ri(-9, 9), dur = .5, trail = false, scaleTo, r0 = 0 } = {}) {
  const g = GID; const c = document.createElement('div'); c.className = 'flycard'; c.innerHTML = html;
  c.style.cssText = `left:${from.x}px;top:${from.y}px;width:${from.w}px;height:${from.h}px`;
  $('#fxLayer').appendChild(c);
  const dx = (to.x + to.w / 2) - (from.x + from.w / 2), dy = (to.y + to.h / 2) - (from.y + from.h / 2);
  if (trail && !RM) fx('fx-card-trail', from.x + from.w / 2 + dx / 2, from.y + from.h / 2 + dy / 2, Math.hypot(dx, dy) + 200, { from: 1, to: 1, rot: 0, r0: Math.atan2(dy, dx) * 180 / Math.PI + 45, dur: .5 });
  gsap.set(c, { rotation: r0 });
  await gsap.to(c, { x: dx, y: dy, scale: scaleTo ?? to.w / from.w, rotation: rot, duration: D(dur), ease: 'power3.out' });
  c.remove(); guard(g);
}
/* animated one-shot effects from sprite sheets (assets/effects): [cols, rows, frames, fps, frameW, frameH] */
const SHEET = { 'throw-trail': [4, 2, 8, 24, 512, 512], 'impact-ring': [4, 2, 8, 24, 512, 512], 'level-up-burst': [4, 3, 12, 30, 512, 512],
  confetti: [4, 2, 8, 20, 512, 512], 'screen-edge-good': [3, 2, 6, 24, 1920, 1080], 'screen-edge-bad': [3, 2, 6, 24, 1920, 1080] };
function sheet(name, cx, cy, size, { rot = 0 } = {}) {
  if (RM) return Promise.resolve();
  const [cols, rows, n, fps, fw, fh] = SHEET[name], el = document.createElement('div'), w = size, h = size * fh / fw, P = { f: 0 };
  el.className = 'fx sheet'; el.style.cssText = `left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;background-image:url(${A('effects/' + name + '-sheet')});background-size:${cols * 100}% ${rows * 100}%;transform:rotate(${rot}deg)`;
  $('#fxLayer').appendChild(el);
  const set = i => { el.style.backgroundPosition = `${cols > 1 ? (i % cols) * 100 / (cols - 1) : 0}% ${rows > 1 ? Math.floor(i / cols) * 100 / (rows - 1) : 0}%`; }; set(0);
  return gsap.to(P, { f: n - 1, duration: n / fps, ease: 'none', onUpdate: () => set(Math.round(P.f)), onComplete: () => el.remove() });
}
function sparkles(cx, cy, n = 8, spread = 160) {
  if (RM) return;
  for (let i = 0; i < n; i++) {
    const st = document.createElement('img'); st.className = 'fxstar'; st.src = A('effects/star-particle'); st.alt = ''; st.style.cssText = `left:${cx - 22}px;top:${cy - 22}px`; $('#fxLayer').appendChild(st);
    gsap.timeline().fromTo(st, { scale: .2 }, { x: ri(-spread, spread), y: ri(-spread, spread * .5), scale: ri(6, 12) / 10, rotation: ri(-90, 90), duration: .55, ease: 'power2.out' }).to(st, { autoAlpha: 0, duration: .35, onComplete: () => st.remove() }, '-=.1');
  }
}

/* Throwing rig. The character swaps to its throw-pose body (arm removed at the shoulder socket) and a stretchy arm slides out of the socket,
   aims at the target, winds up and releases the card. Art: 1100 x 420 arm, wrist at (700,210), card pinched at the grip rect; facing right.
   The arm is mirrored for Robo (who throws from the right). A plain slice of the forearm is stretched to reach any distance. */
const ARM = { w: 1100, h: 420, wx: 700, wy: 210, card: { x: 850, y: 65, w: 165, h: 235, rot: -8 } };
const BODY = { flippy: { w: 478, h: 700, sx: 427, sy: 278, mirror: false, wrap: '#flippyWrap', img: '#flippy' }, robo: { w: 362, h: 700, sx: 255, sy: 322, mirror: true, wrap: '#roboWrap', img: '#robo' } };
async function handThrow(who, html, to) {
  const g = GID, B = BODY[who], mir = B.mirror, side = mir ? -1 : 1, layer = $('#fxLayer');
  const T = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const wr = rectOf($(B.wrap)), sc = wr.h / B.h, bw = B.w * sc, bl = wr.x + (wr.w - bw) / 2;
  const S0 = { x: bl + (mir ? B.w - B.sx : B.sx) * sc, y: wr.y + B.sy * sc };
  const cOff = { x: ARM.card.x + ARM.card.w / 2 - ARM.wx, y: ARM.card.y + ARM.card.h / 2 - ARM.wy };
  const norm = v => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
  const toT = { x: T.x - S0.x, y: T.y - S0.y }, a0 = Math.max(-.35, Math.min(.9, Math.atan2(toT.y, Math.abs(toT.x) + 1)));
  let u = { x: Math.cos(a0) * side, y: Math.sin(a0) }, n = { x: -u.y * (mir ? -1 : 1), y: u.x * (mir ? -1 : 1) };
  const reach = Math.max(620, Math.min(900, Math.hypot(toT.x, toT.y) * .72)), Hc = { x: S0.x + u.x * reach, y: S0.y + u.y * reach };
  const Wp = { x: Hc.x - cOff.x * u.x - cOff.y * n.x, y: Hc.y - cOff.x * u.y - cOff.y * n.y };
  u = norm({ x: Wp.x - S0.x, y: Wp.y - S0.y }); n = { x: -u.y * (mir ? -1 : 1), y: u.x * (mir ? -1 : 1) };
  const inset = 40, S1 = { x: S0.x - u.x * inset, y: S0.y - u.y * inset }, Dist = Math.hypot(Wp.x - S0.x, Wp.y - S0.y) + inset;
  const ang = Math.atan2(u.y, mir ? -u.x : u.x) * 180 / Math.PI, rot0 = mir ? -ang : ang;
  const clip = document.createElement('div'); clip.className = 'armclip'; clip.style.cssText = `left:${S1.x}px;top:${S1.y - ARM.wy}px`;
  const rig = document.createElement('div'); rig.className = 'armrig'; rig.style.left = -ARM.wx + 'px';
  const im = k => `<img class="hl" src="${A('hands/arm-' + who + '-' + k)}" alt="">`;
  rig.innerHTML = `<div class="armext" style="background-image:url(${A('hands/arm-' + who + '-ext')})"></div>${im('grip-back')}<div class="flycard hcard" style="left:${ARM.card.x}px;top:${ARM.card.y}px;width:${ARM.card.w}px;height:${ARM.card.h}px;transform:rotate(${ARM.card.rot}deg) scaleX(${side})">${html}</div>${im('grip-front-fingers')}`;
  clip.appendChild(rig); layer.appendChild(clip);
  const body = document.createElement('img'); body.className = 'fxbody'; body.src = A(`characters/body-${who}-throw`); body.alt = '';
  body.style.cssText = `left:${bl}px;top:${wr.y}px;width:${bw}px;height:${wr.h}px${mir ? ';transform:scaleX(-1)' : ''}`; layer.appendChild(body);
  const joint = document.createElement('div'); joint.className = 'armjoint ' + who; joint.style.cssText = `left:${S0.x - 42}px;top:${S0.y - 42}px`; layer.appendChild(joint);
  const real = $(B.img); real.style.visibility = 'hidden';
  const P = { t: 0 }, put = () => gsap.set(rig, { x: P.t }), restore = () => { real.style.visibility = ''; body.remove(); clip.remove(); joint.remove(); };
  gsap.set(clip, { transformOrigin: `0px ${ARM.wy}px`, rotation: rot0 - 14 * side, scaleX: side }); gsap.set(rig, { transformOrigin: `${ARM.wx}px ${ARM.wy}px`, scaleY: .72 }); gsap.fromTo(joint, { scale: .5 }, { scale: 1, duration: D(.3), ease: 'back.out(3)' }); put();
  sfx('whoosh');
  await gsap.timeline()
    .to(P, { t: Dist * .95, duration: D(.62), ease: 'power2.out', onUpdate: put })
    .to(rig, { scaleY: 1, duration: D(.62), ease: 'power2.out' }, '<')
    .to(clip, { rotation: rot0, duration: D(.62), ease: 'power2.out' }, '<')
    .to(P, { t: Dist * .82, duration: D(.18), ease: 'sine.inOut', onUpdate: put })
    .to(rig, { scaleY: 1.06, duration: D(.18), ease: 'sine.inOut' }, '<')
    .to(clip, { rotation: rot0 - 9 * side, duration: D(.17), ease: 'power1.inOut' }, '<')
    .to(P, { t: Dist, duration: D(.12), ease: 'power2.in', onUpdate: put })
    .to(rig, { scaleY: .9, duration: D(.12), ease: 'power2.in' }, '<')
    .to(clip, { rotation: rot0 + 7 * side, duration: D(.1), ease: 'power2.in' }, '<');
  if (g !== GID) { restore(); throw STALE; }
  const card = rig.querySelector('.hcard'), r = card.getBoundingClientRect(), sr = stage.getBoundingClientRect(), k = sr.width / 1920;
  const mx = (r.left + r.width / 2 - sr.left) / k, my = (r.top + r.height / 2 - sr.top) / k;
  card.remove(); rig.querySelector('img:last-child').style.display = 'none'; rig.querySelector('img').src = A(`hands/arm-${who}-release`);
  sfx('land'); sheet('throw-trail', mx, my, 520, { rot: Math.atan2(T.y - my, T.x - mx) * 180 / Math.PI });
  gsap.timeline().to(clip, { rotation: `+=${-6 * side}`, duration: D(.1) }).to(P, { t: 0, duration: D(.5), ease: 'power2.inOut', onUpdate: put }, '+=.1').to(rig, { scaleY: .75, duration: D(.5), ease: 'power2.inOut' }, '<').add(restore);
  await fly({ x: mx - 82, y: my - 117, w: 165, h: 235 }, to, html, { dur: .55, rot: ri(-10, 10), r0: ARM.card.rot * side, scaleTo: to.w / 165, trail: true });
  sheet('impact-ring', T.x, T.y, Math.max(320, to.w * 2)); fx('fx-star-burst', T.x, T.y, Math.max(240, to.w * 1.5), { from: .3, to: 1.1, rot: 30, dur: .6 });
  guard(g);
}
async function stamp(text, color = '#FFC83D', hold = .65) {
  const g = GID, el = $('#stamp'); el.querySelector('span').textContent = text; el.style.setProperty('--sc', color);
  sfx('stamp');
  await gsap.timeline()
    .set(el, { autoAlpha: 1 })
    .fromTo(el, { scale: 2.3, rotation: -14 }, { scale: 1, rotation: -6, duration: D(.28), ease: 'back.out(2.4)' })
    .add(() => shake(12), D(.18))
    .to(el, { autoAlpha: 0, scale: .9, duration: D(.22) }, `+=${RM ? .5 : hold}`);
  guard(g);
}
/* small stamp over one spot (e.g. a red SKIP over the computer's cards) */
function miniStamp(text, color, cx, cy, hold = 1.3) {
  const el = document.createElement('div'); el.className = 'ministamp'; el.style.cssText = `left:${cx - 170}px;top:${cy - 64}px;--sc:${color}`;
  el.innerHTML = `<img src="${A('ui/ui-stamp-badge')}" alt=""><span>${text}</span>`; $('#fxLayer').appendChild(el); sfx('stamp');
  gsap.timeline().fromTo(el, { scale: 2, rotation: -16, autoAlpha: 0 }, { scale: 1, rotation: -7, autoAlpha: 1, duration: D(.28), ease: 'back.out(2.4)' }).to(el, { autoAlpha: 0, duration: D(.25), delay: hold, onComplete: () => el.remove() });
}
function confetti(n = 70, cx = 960, cy = 420) {
  const cols = ['#2F7CF6', '#13A46B', '#F06A2B', '#8B5CF6', '#E8384F', '#FFC83D'];
  for (let i = 0; i < (RM ? 0 : n); i++) {
    const d = document.createElement('div'); const s = ri(12, 22);
    d.style.cssText = `position:absolute;left:${cx + ri(-80, 80)}px;top:${cy + ri(-40, 40)}px;width:${s}px;height:${s * .55}px;background:${cols[i % cols.length]};border-radius:3px;pointer-events:none`;
    $('#fxLayer').appendChild(d);
    gsap.to(d, { x: ri(-900, 900), y: ri(-420, -120), rotation: ri(-360, 360), duration: .7, ease: 'power2.out' });
    gsap.to(d, { y: '+=' + ri(700, 1000), rotation: '+=' + ri(180, 720), duration: ri(16, 26) / 10, delay: .7, ease: 'power1.in', onComplete: () => d.remove() });
  }
}
function badge(kind, cx, cy, size = 150, hold = .7) {
  const im = document.createElement('img'); im.className = 'fxicon'; im.src = A('feedback/feedback-' + kind); im.alt = '';
  im.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`; $('#fxLayer').appendChild(im);
  gsap.timeline().fromTo(im, { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: D(.35), ease: 'back.out(3)' }).to(im, { autoAlpha: 0, y: -24, duration: D(.3), delay: hold, onComplete: () => im.remove() });
}
/* a lightbulb pops over the computer when it finds the match */
function bulb() {
  const w = rectOf($('#roboWrap')), im = document.createElement('img'); im.className = 'fxicon'; im.src = A('feedback/hint-lightbulb-glowing'); im.alt = '';
  im.style.cssText = `left:${w.x + w.w / 2 - 55}px;top:${w.y - 70}px;width:110px;height:110px`; $('#fxLayer').appendChild(im);
  gsap.timeline().fromTo(im, { scale: 0, y: 20 }, { scale: 1, y: 0, duration: D(.35), ease: 'back.out(3)' }).to(im, { autoAlpha: 0, y: -20, duration: D(.3), delay: .8, onComplete: () => im.remove() });
}
/* a pulsing glow behind a rect; returns a function that removes it */
function glowAt(r, scale = 1.5) {
  const im = document.createElement('img'); im.className = 'fx hintglow'; im.src = A('fx/fx-hint-glow'); im.alt = '';
  const s = Math.max(r.w, r.h) * scale; im.style.cssText = `left:${r.x + r.w / 2 - s / 2}px;top:${r.y + r.h / 2 - s / 2}px;width:${s}px;height:${s}px`;
  $('#fxLayer').appendChild(im);
  const t = gsap.fromTo(im, { autoAlpha: .55, scale: .95 }, { autoAlpha: 1, scale: 1.05, duration: .8, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  return () => { t.kill(); im.remove(); };
}
const pulse = (el, n = 3, s = 1.08) => el && gsap.fromTo(el, { scale: 1 }, { scale: s, duration: .28, yoyo: true, repeat: n * 2 - 1, ease: 'sine.inOut', overwrite: 'auto' });
const bounce = el => el && gsap.fromTo(el, { y: 0 }, { keyframes: { y: [-34, 0, -16, 0] }, duration: .8, ease: 'power1.out', overwrite: 'auto' });

/* ---------- equations: tokens that move ("numbers swap", "brackets jump") ---------- */
const TOK = s => s.match(/\(|\)|\d+|_+|[+×=?→]/g) || [];
const spans = s => TOK(s).map(t => `<span class="t ${/\d/.test(t) ? 'n' : /[()]/.test(t) ? 'b' : /[_?]/.test(t) ? 'q' : 'o'}">${t}</span>`).join('');
function relPos(el, box) { let x = 0, y = 0, e = el; while (e && e !== box) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y }; }
/* move copies of tokens A into the places of tokens B (same number goes to the same number, brackets jump to their new place) */
function morph(box, Aels, Bels, { dur = .85, keepA = true, glow = false, dup = false } = {}) {
  const ta = Aels.map(e => e.textContent), used = new Set(), tl = gsap.timeline();
  Bels.forEach((be, j) => {
    be.style.visibility = 'hidden';
    let i = ta.findIndex((t, k) => !used.has(k) && t === be.textContent); const bp = relPos(be, box);
    if (i < 0 && dup) i = ta.findIndex(t => t === be.textContent);
    if (i < 0) { tl.fromTo(be, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.3) }, D(dur) * .7); return; }
    used.add(i);
    const ae = Aels[i], ap = relPos(ae, box), c = ae.cloneNode(true), isB = /[()]/.test(c.textContent), isN = /\d/.test(c.textContent);
    c.classList.add('fly'); if (glow && isN) c.classList.add('glow');
    c.style.cssText = `position:absolute;left:${ap.x}px;top:${ap.y}px;margin:0;visibility:visible`;
    box.appendChild(c); if (!keepA) ae.style.visibility = 'hidden';
    const dx = bp.x - ap.x, dy = bp.y - ap.y, lift = isB ? -64 : isN ? -40 : -8;
    tl.to(c, { keyframes: { x: [0, dx / 2, dx], y: [0, dy / 2 + lift, dy] }, duration: D(dur), ease: 'power1.inOut' }, j * .05)
      .add(() => { be.style.visibility = 'visible'; if (glow && isN) be.classList.add('glow'); c.remove(); });
  });
  return tl;
}
/* the equation panel beside the centre pile. q = { a, b, val, fill, dup }:
   swap / group / split: A, then "= B" built from A's own numbers, then the value line;
   fill (identity): B is drawn over A and the card's number drops into the blank. */
async function eqShow(q, { glow = false } = {}) {
  const g = GID, box = $('#equation'), fill = !!q.fill;
  gsap.killTweensOf(box);
  box.innerHTML = `<div class="eq-stack${fill ? ' fill' : ''}"><div class="eq-row ra">${spans(q.a)}</div><div class="eq-row rb">${fill ? '' : '<span class="t o eqs">=</span>'}${spans(q.b)}</div></div>${q.val ? `<div class="eq-val">${q.val}</div>` : ''}`;
  box.classList.toggle('hint', glow);
  const Ael = [...box.querySelectorAll('.ra .t')], Bel = [...box.querySelectorAll('.rb .t:not(.eqs)')], eqs = box.querySelector('.eqs'), v = box.querySelector('.eq-val');
  if (eqs || v) gsap.set([eqs, v].filter(Boolean), { autoAlpha: 0 }); Bel.forEach(e => e.style.visibility = 'hidden');
  await gsap.fromTo(box, { autoAlpha: 0, scale: .7 }, { autoAlpha: 1, scale: 1, duration: D(.35), ease: 'back.out(2)' });
  if (glow) Ael.filter(e => e.classList.contains('n')).forEach(e => e.classList.add('glow'));
  if (eqs) gsap.to(eqs, { autoAlpha: 1, duration: .2 });
  if (fill) gsap.to(Ael.filter(e => !/\d/.test(e.textContent)), { autoAlpha: 0, duration: D(.3), delay: D(.3) });
  await morph(box, Ael, Bel, { glow, dup: q.dup, keepA: !fill });
  if (fill) { const res = TOK(q.b).pop(); Bel.filter(e => e.textContent === res).forEach(e => e.classList.add('glow')); }
  if (v) await gsap.to(v, { autoAlpha: 1, duration: D(.3) });
  guard(g);
}
/* the equation for a match step and the chosen card */
function eqOf(st, pick) {
  if (st.fill || st.eqB) return { a: st.centre, b: st.eqB ? st.eqB[pick] : st.fill, fill: true };
  const v = ev(st.centre); return { a: st.centre, b: pick, val: st.val ?? `${v} = ${v}`, dup: st.dup };
}
/* what the completion screen lists for a solved match */
function pairOf(st, pick, v) {
  const q = eqOf(st, pick);
  if (!q.fill) return { a: q.a, b: q.b, v };
  const k = q.b.lastIndexOf(' = '), a = q.b.slice(0, k);
  return { a, b: q.b.slice(k + 3), zero: / × 0$/.test(a) };
}
function eqClear() { gsap.to('#equation', { autoAlpha: 0, duration: .2, overwrite: true }); }

/* ---------- state ---------- */
let S = null;
function fresh() {
  S = { part: 0, done: PARTS.map(() => 0), hand: START_CARDS, comp: START_CARDS, cards: [], centre: null, played: null, view: 'wait', special: null, intro: false, wantHint: false,
    turn: 'learner', over: false, pairs: PARTS.map(() => []), lock: 0,
    stats: { correct: 0, wrong: 0, drawn: 0, start: Date.now() } };
}

/* ---------- rendering ---------- */
function renderProgress() {
  const el = $('#progress'), i = S.part, p = PARTS[i];
  el.style.setProperty('--pc', p.color);
  el.innerHTML = `<span class="pn">${p.name}</span>` +
    `<span class="dots">${Array.from({ length: MATCHES[i] }, (_, d) => `<i class="${d < S.done[i] ? 'on' : ''}"></i>`).join('')}</span>`;
}
function renderFan() {
  const f = $('#roboFan'), n = Math.min(S.comp, 4); f.innerHTML = '';
  for (let i = 0; i < n; i++) { const im = document.createElement('img'); im.src = A('cards/cd-back'); im.alt = ''; f.appendChild(im); gsap.set(im, { rotation: (i - (n - 1) / 2) * 7, x: (i - (n - 1) / 2) * 13 }); }
  $('#cntCpu b').textContent = S.comp;
}
function renderCentre(flipIn = false) {
  const box = $('#centre'); box.innerHTML = '';
  if (S.centre) {
    const c = document.createElement(S.centre.flip ? 'button' : 'div'); c.className = 'card'; c.id = 'centreCard';
    c.innerHTML = S.centre.flip ? cardInner('cd-flip', null, L.centre.w) : cardInner(frontImg(S.centre.p), S.centre.text, L.centre.w);
    place(c, L.centre); box.appendChild(c);
    if (S.centre.flip) { c.setAttribute('aria-label', 'Play the FLIP card'); c.classList.add('tappable'); c.onclick = () => tap({ kind: 'centre' }); }
    if (flipIn) { sfx('flip'); gsap.fromTo(c, { rotationY: 90, y: -20 }, { rotationY: 0, y: 0, duration: D(.45), ease: 'back.out(1.6)' }); }
  }
  if (S.played) {
    const pc = document.createElement('div'); pc.className = 'card'; pc.id = 'playedCard';
    pc.innerHTML = S.played.act ? actInner(S.played.act, L.played.w) : cardInner(frontImg(S.played.p), S.played.text, L.played.w);
    place(pc, L.played, 3); box.appendChild(pc);
  }
 
}
let glowKill = [];
function clearGlow() { glowKill.forEach(k => k()); glowKill = []; }
/* ---------- the learner's hand (Sheet6: every card face up at the bottom; the computer's stay face down) ----------
   S.cards holds the faces; S.hand is the count. Up to VIS cards show in a row, any more wait in a small "+N" pile. */
const VIS = 7;
let cid = 0;
const mk = (text, extra = {}) => ({ id: ++cid, text, ...extra });
/* a card from this part's pool that is not already in the hand */
function filler(avoid = []) {
  const pool = FILLER[S.part], have = new Set([...S.cards.map(c => c.text), ...avoid]), free = pool.filter(t => !have.has(t));
  return (free.length ? free : pool)[ri(0, (free.length ? free : pool).length - 1)];
}
function syncCards() {
  while (S.cards.length < S.hand) S.cards.push(mk(filler()));
  while (S.cards.length > S.hand) { let i = -1; S.cards.forEach((c, k) => { if (!c.opt) i = k; }); S.cards.splice(i >= 0 ? i : S.cards.length - 1, 1); }
}
function handLayout(n, special = !!S.special) {
  const W = L.hand.w, G = L.hand.gap, total = n ? n * W + (n - 1) * G : 0, x0 = L.hand.cx - total / 2;
  const slots = Array.from({ length: n }, (_, i) => ({ x: x0 + i * (W + G), y: L.hand.y, w: W, h: L.hand.h }));
  return { slots, act: { ...L.act, x: x0 + total + 26 }, stack: { ...L.stack, x: x0 - 26 - L.stack.w, y: L.hand.y + 40 } };
}
/* where a card drawn from the pile lands: the next place in the row, or the "+N" pile when the row is full */
function drawTarget() { const n = S.cards.length; return n < VIS ? handLayout(n + 1).slots[n] : handLayout(VIS).stack; }
/* the cards of this turn: options replace cards in the visible row (a card already showing that face is reused);
   any other card with the centre's value is swapped for a pool card, so only the sheet's options can match. Returns the new card ids */
function dealOptions(opts, v) {
  S.cards.forEach(c => { c.opt = false; c.correct = false; c.glow = false; });
  while (S.cards.length < opts.length) S.cards.push(mk(filler()));
  S.hand = S.cards.length;
  const texts = opts.map(o => o.text), fresh = [], n = Math.min(S.cards.length, VIS);
  const free = shuffle([...Array(n).keys()]);
  opts.forEach(o => {
    const k = S.cards.findIndex((c, i) => i < n && c.text === o.text && !c.opt);
    if (k >= 0) { Object.assign(S.cards[k], { opt: true, correct: o.correct }); free.splice(free.indexOf(k), 1); }
  });
  opts.forEach(o => {
    if (S.cards.some(c => c.opt && c.text === o.text)) return;
    const k = free.find(i => !S.cards[i].opt); free.splice(free.indexOf(k), 1);
    S.cards[k] = mk(o.text, { opt: true, correct: o.correct }); fresh.push(S.cards[k].id);
  });
  S.cards.forEach((c, i) => {
    if (c.opt) return;
    if ((v != null && ev(c.text) === v) || texts.includes(c.text)) { S.cards[i] = mk(filler(texts)); fresh.push(S.cards[i].id); }
  });
  return fresh;
}
const handEl = i => $(`#hand [data-opt="${i}"]`);
const rightEls = () => S.cards.slice(0, VIS).map((c, i) => c.correct ? handEl(i) : null).filter(Boolean);
/* cards that just changed turn over to show their new faces */
function turnOver(ids) {
  const els = ids.map(id => $(`#hand [data-id="${id}"]`)).filter(Boolean); if (!els.length) return;
  sfx('flip'); gsap.fromTo(els, { rotationY: 90 }, { rotationY: 0, duration: D(.35), stagger: .08, ease: 'back.out(1.6)' });
}
/* view: wait (face up, resting) · match / drop (every card can be tapped) · special (a special card to play) */
function renderHand({ deal = false } = {}) {
  clearGlow(); syncCards();
  const h = $('#hand'), old = {}; $$('#hand [data-id]').forEach(b => old[b.dataset.id] = b.offsetLeft);
  h.innerHTML = '';
  const v = S.view, live = v === 'match' || v === 'drop', mine = S.turn === 'learner' || v === 'special';
  const vis = S.cards.slice(0, VIS), extra = S.cards.length - vis.length, { slots, act, stack } = handLayout(vis.length);
  L.act = act;
  const cards = [];
  vis.forEach((c, i) => {
    const r = slots[i], b = document.createElement('button'); b.className = 'card' + (live ? ' playable' : mine ? '' : ' waiting');
    b.dataset.opt = i; b.dataset.id = c.id; b.disabled = !live; b.setAttribute('aria-label', (live ? 'Play ' : 'Your card: ') + c.text);
    b.innerHTML = `<span class="lift">${cardInner(frontImg(c.p ?? S.part), c.text, r.w)}</span>`;
    if (c.glow) b.dataset.glow = '1';
    place(b, r, vis.length > 1 ? (i - (vis.length - 1) / 2) * 1.2 : 0); h.appendChild(b); cards.push(b);
    if (!deal && old[c.id] != null && old[c.id] !== r.x) gsap.from(b, { x: old[c.id] - r.x, duration: D(.3), ease: 'power2.out' });
  });
  if (extra) {
    const d = document.createElement('div'); d.className = 'hstack'; d.setAttribute('aria-label', extra + ' more cards');
    d.innerHTML = cardInner('cd-back', null, stack.w) + `<b>+${extra}</b>`; place(d, stack, -4); h.appendChild(d);
  }
  if (S.special) {
    const b = document.createElement('button'); b.className = 'card special' + (v === 'special' ? ' playable' : ''); b.dataset.act = S.special; b.disabled = v !== 'special';
    b.setAttribute('aria-label', 'Play the ' + ACTIONS[S.special].label + ' card');
    b.innerHTML = `<span class="lift">${actInner(S.special, act.w)}</span><span class="act-lbl">${ACTIONS[S.special].label}</span>`;
    place(b, act, 2); h.appendChild(b); cards.push(b); if (v === 'special') b.dataset.glow = '1';
  }
  $('#cntYou b').textContent = S.cards.length + (S.special ? 1 : 0);
  if (deal && cards.length) { sfx('deal'); gsap.from(cards, { y: 140, autoAlpha: 0, rotation: '-=12', duration: D(.45), stagger: .05, ease: 'back.out(1.5)' }); }
  const g = GID;
  gsap.delayedCall(deal ? .55 : 0, () => { if (g === GID) $$('#hand [data-glow]').forEach(b => glowKill.push(glowAt(rectOf(b)))); });
}
function renderAll() { renderProgress(); renderFan(); renderCentre(); renderHand(); updateTint(false); }
function updateTint() { $('#table').style.setProperty('--pc', PARTS[S.part].color); }

/* on-screen text (the sheet's OST column) */
const norm = t => (t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
let saidNow = '';
/* the pill only shows when it adds something the bubble does not already say */
function dedupeOst() { const o = $('#ost'), t = norm(o.textContent); if (t && (norm(saidNow).includes(t) || norm($('#turnTag').textContent) === t)) o.classList.add('dup'); }
function ost(t) {
  const o = $('#ost'); gsap.killTweensOf(o); o.classList.remove('dup');
  if (!t) { gsap.to(o, { autoAlpha: 0, duration: .2 }); return; }
  o.textContent = t; dedupeOst(); gsap.fromTo(o, { autoAlpha: 0, scale: .8 }, { autoAlpha: 1, scale: 1, duration: D(.3), ease: 'back.out(2.4)' });
}
/* Sheet6 "Turn Indicator": YOUR TURN / COMPUTER'S TURN in the dialogue box; the tag turns over when the turn changes */
function tagSet(who) { const t = $('#turnTag'); t.textContent = who === 'learner' ? 'YOUR TURN' : "COMPUTER'S TURN"; t.classList.toggle('cpu', who !== 'learner'); t.classList.remove('struck'); dedupeOst(); }
async function setTurn(who, instant = false) {
  const changed = S.turn !== who, t = $('#turnTag'); S.turn = who; t.hidden = false;
  $('#cntYou').classList.toggle('on', who === 'learner'); $('#cntCpu').classList.toggle('on', who !== 'learner');
  if (instant || !changed) { tagSet(who); return; }
  sfx('whoosh');
  await gsap.to(t, { rotationX: 90, duration: D(.2), ease: 'power2.in' }); tagSet(who);
  await gsap.to(t, { rotationX: 0, duration: D(.35), ease: 'back.out(2.5)' });
}
/* Skip: the skipped player's tag is struck through; Reverse: the tag spins round */
function tagSkip() { const t = $('#turnTag'); t.classList.add('struck'); gsap.fromTo(t, { x: 0 }, { keyframes: { x: [-12, 12, -8, 5, 0] }, duration: D(.45) }); }
const tagSpin = () => gsap.fromTo('#turnTag', { rotationY: 0 }, { rotationY: 360, duration: D(.8), ease: 'power2.inOut' });
const dimHand = on => gsap.to('#hand', { autoAlpha: on ? .35 : 1, duration: .25 });
const dimFan = on => gsap.to('#roboFan', { autoAlpha: on ? .3 : 1, duration: .25 });
function valueBadges(v) {
  ['#centreCard', '#playedCard'].forEach((s, i) => {
    const c = $(s); if (!c) return; const b = document.createElement('b'); b.className = 'vbadge'; b.textContent = '= ' + v; c.appendChild(b);
    gsap.fromTo(b, { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: D(.35), delay: i * .15, ease: 'back.out(3)' });
  });
}

/* ---------- input: every interactive step awaits one tap ---------- */
let tapRes = null;
const nextTap = () => new Promise(r => { tapRes = r; });
function tap(e) { audioInit(); if (!tapRes || paused) return; const r = tapRes; tapRes = null; r(e); }
$('#hand').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.opt != null) tap({ kind: 'opt', i: +b.dataset.opt, el: b }); else if (b.dataset.act) tap({ kind: 'act', el: b });
});
$('#pile').addEventListener('click', () => tap({ kind: 'pile' }));
$('#btnGo').addEventListener('click', () => { sfx('pop'); tap({ kind: 'go' }); });
$$('#scrExplain .go, #scrTeach .go').forEach(b => b.addEventListener('click', () => { sfx('pop'); tap({ kind: 'go' }); }));
$('#btnFinal').addEventListener('click', () => tap({ kind: 'final' }));
/* inactivity: the sheet's Inactivity VO + animation, after 8 s and then every 12 s. Sheet6: a hand points at the card, pile or
   button to use (it never taps for the learner) */
let idleT = null;
function idle(vo, anim, target) {
  idleOff(); const g = GID;
  const run = () => { if (g !== GID) return; pose('flippy', 'point', 2400); say(vo, true); if (anim) anim(); nudge(target); idleT = gsap.delayedCall(12, run); };
  idleT = gsap.delayedCall(8, run);
}
function idleOff() { if (idleT) idleT.kill(); idleT = null; nudgeOff(); }
let nudgeTl = null;
function nudgeOff() { if (nudgeTl) nudgeTl.kill(); nudgeTl = null; gsap.set('#nudge', { autoAlpha: 0 }); }
/* the hand slides in, its fingertip on the target, and taps the air three times; demo: it presses the target once (the example in How to Play) */
function nudge(target, demo = false) {
  const el = typeof target === 'function' ? target() : typeof target === 'string' ? $(target) : target;
  if (!el) return Promise.resolve(); nudgeOff();
  const r = rectOf(el), n = $('#nudge'), x = r.x + r.w * .55 - 22, y = r.y + r.h * (r.h > 150 ? .8 : .62) - 4;
  gsap.set(n, { x, y, scale: 1, rotation: 0 });
  nudgeTl = gsap.timeline()
    .fromTo(n, { autoAlpha: 0, x: x + 90, y: y + 120 }, { autoAlpha: 1, x, y, duration: D(.5), ease: 'power2.out' })
    .to(n, { keyframes: { y: [y, y + 14, y], scale: [1, .9, 1] }, duration: D(.4), repeat: demo ? 0 : 4, repeatDelay: .25 });
  if (!demo) nudgeTl.to(n, { autoAlpha: 0, duration: .3 }, '+=1.4');
  return nudgeTl.then();
}
async function waitFor(kind) { const g = GID; for (;;) { const e = await nextTap(); guard(g); if (e.kind === kind) return e; } }
function showGo(label, where = 'mid') {
  const b = $('#btnGo'); b.querySelector('span').textContent = label; b.className = 'imgbtn ' + where; b.hidden = false;
  gsap.fromTo(b, { scale: 0 }, { scale: 1, duration: D(.4), ease: 'back.out(2.5)' });
  gsap.to(b, { scale: 1.06, duration: .55, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: .4 });
  gsap.delayedCall(.1, () => b.focus());
}
function hideGo() { const b = $('#btnGo'); gsap.killTweensOf(b); b.hidden = true; }

/* ======================================================================
   PART 1: hook, setup, how to play
   ====================================================================== */
const HOOK_CARDS = [['cd-front-commutative', '7'], ['cd-skip'], ['cd-front-associative', '+'], ['cd-flip'], ['cd-front-distributive', '3 + 4'], ['cd-reverse'], ['cd-front-identity', '×'], ['cd-mystery'], ['cd-front-commutative', '9']];
async function hook() {
  resetMotion(); fresh(); S.hand = 0; S.comp = 0; renderAll(); ost(''); hideGo(); $('#setupOpts').hidden = true; $('#turnTag').hidden = true;
  const g = GID, t = $('#scrTitle'); t.hidden = false; gsap.set(t, { autoAlpha: 1 });
  SCREENS.filter(s => s !== '#scrTitle').forEach(s => $(s).hidden = true);
  const box = $('#hookCards'); box.innerHTML = HOOK_CARDS.map(([img, txt]) => `<div class="hc">${cardInner(img, txt ?? null, 150)}</div>`).join('');
  const cards = [...box.children], n = cards.length;
  const sub = $('#scrTitle .subtitle'); sub.textContent = HOOK.welcome;
  gsap.to('.t-flippy', { y: -16, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('.t-robo', { y: -10, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  try {
    /* Sheet6 line 1: "Welcome to the Number Card Challenge!", then line 2 as the colourful cards fly in, shuffle and form a deck */
    say(HOOK.welcome);
    await gsap.timeline()
      .from('#scrTitle .title-plaque', { y: -400, duration: D(.8), ease: 'bounce.out' })
      .from('#scrTitle .w2 i', { scale: 0, rotation: -40, stagger: .07, duration: D(.4), ease: 'back.out(3)' }, '-=.2')
      .from('.t-flippy', { x: -500, duration: D(.7), ease: 'back.out(1.3)' }, .2)
      .from('.t-robo', { x: 500, duration: D(.7), ease: 'back.out(1.3)' }, .2)
      .from(sub, { autoAlpha: 0, y: 20, duration: D(.4) }, .6)
      .to(sub, { autoAlpha: 0, duration: D(.2) }, 2.7)
      .add(() => { sub.textContent = HOOK.vo; say(HOOK.vo); })
      .to(sub, { autoAlpha: 1, duration: D(.3) })
      .fromTo(cards, { x: i => (i % 2 ? 1 : -1) * ri(900, 1200), y: () => ri(-500, 300), rotation: () => ri(-200, 200), autoAlpha: 1 },
        { x: i => (i - (n - 1) / 2) * 120, y: i => Math.abs(i - (n - 1) / 2) * 14, rotation: i => (i - (n - 1) / 2) * 9, duration: D(.7), stagger: .12, ease: 'back.out(1.4)', onStart: () => sfx('deal') }, '<')
      .to(cards, { x: 0, y: 0, rotation: () => ri(-4, 4), duration: D(.45), stagger: .04, ease: 'power3.in' }, '+=.9')
      .to(cards, { x: i => i % 2 ? 130 : -130, rotation: i => i % 2 ? 8 : -8, duration: D(.25), ease: 'power2.out', onStart: () => sfx('flip') })
      .to(cards, { x: 0, y: i => -i * 2, rotation: 0, duration: D(.3), stagger: .03, ease: 'power2.in', onComplete: () => sfx('land') })
      .add(() => { sfx('magic'); sheet('level-up-burst', 960, 236, 900); for (let k = 0; k < 4; k++) fx('fx-star-burst', ri(560, 1360), ri(120, 360), 220, { dur: .8 }); })
      .fromTo('#scrTitle .title-plaque', { filter: 'drop-shadow(0 0 0 rgba(255,214,90,0))' }, { filter: 'drop-shadow(0 0 40px rgba(255,214,90,.95))', duration: D(.5), yoyo: true, repeat: 3 });
    guard(g);
    await wait(1600, true);
    setup();
  } catch (e) { if (e !== STALE) console.error(e); }
}
$('#btnSkipHook').addEventListener('click', () => { audioInit(); sfx('pop'); setup(); });

async function setup() {
  resetMotion(); const g = GID;
  gsap.to('#scrTitle', { autoAlpha: 0, duration: D(.35), onComplete: () => { $('#scrTitle').hidden = true; } });
  fresh(); S.hand = 0; S.comp = 0; S.intro = true; renderAll(); breathe(); pose('flippy', 'idle'); pose('robo', 'idle');
  await setTurn('learner', true);
  gsap.from('#flippyWrap', { x: -360, duration: D(.6), ease: 'back.out(1.4)' });
  gsap.from('#roboWrap', { x: 360, duration: D(.6), ease: 'back.out(1.4)' });
  try {
    /* line 3 "Two players, one challenge!": both players and their card counts light up */
    say(SETUP.vo); ost(SETUP.ost);
    gsap.fromTo(['#cntYou', '#cntCpu'], { scale: 0 }, { scale: 1, duration: D(.4), stagger: .2, ease: 'back.out(2.5)', delay: .3 });
    await wait(rt(SETUP.vo), true);
    /* line 4 */
    say(SETUP.vo2); ost(SETUP.ost2); await wait(rt(SETUP.vo2), true);
    /* line 5: 7 cards to each player; the learner's land face up, the computer's stay face down */
    say(SETUP.deal); ost(SETUP.dealOst);
    for (let i = 0; i < START_CARDS; i++) {
      sfx('deal');
      fly(L.pile, L.fan, cardInner('cd-back', null, L.pile.w), { dur: .32, rot: 0 }).then(() => { S.comp++; renderFan(); }).catch(() => { });
      await fly(L.pile, drawTarget(), cardInner('cd-back', null, L.pile.w), { dur: .32, rot: ri(-6, 6) });
      S.hand++; renderHand(); const c = $$('#hand .card').pop(); if (c) gsap.fromTo(c, { rotationY: 90 }, { rotationY: 0, duration: D(.25), ease: 'back.out(2)' });
    }
    await wait(300); S.comp = START_CARDS; renderFan();
    pulse($('#cntYou'), 1, 1.15); pulse($('#cntCpu'), 1, 1.15); await wait(Math.max(600, rt(SETUP.deal) - 3200), true);
    /* line 6: whoever clears their hand first wins */
    say(SETUP.win); ost(SETUP.winOst);
    bounce($('#cntYou')); gsap.delayedCall(.3, () => bounce($('#cntCpu')));
    fx('fx-star-burst', 960, 300, 300, { dur: .9 }); sfx('star');
    await wait(rt(SETUP.win), true);
    showGo('NEXT'); $('#setupOpts').hidden = false; syncOpts();
    idle(SETUP.idle, () => pulse($('#btnGo'), 2, 1.15), '#btnGo');
    await waitFor('go'); idleOff(); hideGo(); $('#setupOpts').hidden = true; ost('');
    await howTo();
  } catch (e) { if (e !== STALE) console.error(e); }
}

async function howTo() {
  const g = GID; S.intro = true;
  /* line 7: Skip, Reverse, Swap and Flip float over the deck; tap each one to see what it does */
  {
    const H = HOW.actions, types = ['skip', 'reverse', 'swap', 'flip'], seen = new Set(), x0 = 960 - (types.length * 195 - 25) / 2;
    S.centre = null; S.played = null; renderCentre(); eqClear(); ost(H.ost); say(H.vo);
    const row = document.createElement('div'); row.id = 'preview'; $('#world').appendChild(row);
    row.innerHTML = types.map((t, i) => `<button class="pv" data-t="${t}" style="left:${x0 + i * 195}px" aria-label="Preview ${ACTIONS[t].label}"><span class="lift">${actInner(t, 170)}</span><span class="act-lbl">${ACTIONS[t].label}</span><img class="tick" src="${A('ui/ui-icon-check')}" alt=""></button>`).join('');
    const pv = [...row.children], next = () => pv.find(b => !seen.has(b.dataset.t));
    gsap.from(pv, { y: 200, autoAlpha: 0, stagger: .1, duration: D(.45), ease: 'back.out(1.6)' });
    pv.forEach((b, i) => { gsap.to(b.querySelector('.lift'), { y: -10, duration: 1 + i * .1, yoyo: true, repeat: -1, ease: 'sine.inOut' }); b.onclick = () => tap({ kind: 'prev', t: b.dataset.t, el: b }); });
    const nudgeAll = () => pv.filter(b => !seen.has(b.dataset.t)).forEach((b, i) => gsap.delayedCall(i * .45, () => pulse(b, 1, 1.12)));
    idle(H.idle, nudgeAll, next);
    while (seen.size < types.length) {
      const e = await waitFor('prev'); idleOff(); sfx('pop'); bounce(e.el);
      say(H.each[e.t]);
      await preview(e.t);
      seen.add(e.t); gsap.to(e.el.querySelector('.tick'), { autoAlpha: 1, scale: 1, duration: D(.3), ease: 'back.out(3)' });
      idle(H.idle, nudgeAll, next);
    }
    /* every special card previewed: the icons bounce */
    idleOff(); pose('flippy', 'cheer', 1600); sfx('star');
    gsap.to(pv, { keyframes: { y: [-40, 0, -14, 0] }, stagger: .08, duration: .7 }); await wait(1600, true);
    await gsap.to(pv, { y: 220, autoAlpha: 0, stagger: .06, duration: D(.35), ease: 'power2.in' }); row.remove(); guard(g);
  }
  /* line 8: no match? draw one card from the pile */
  {
    const H = HOW.draw, pile = $('#pile'); ost(H.ost); say(H.vo);
    pile.classList.add('live'); const gk = glowAt(L.pile, 1.5);
    idle(H.idle, () => pulse(pile, 2, 1.08), '#pile');
    try { await waitFor('pile'); } finally { idleOff(); gk(); pile.classList.remove('live'); }
    sfx('deal'); await fly(L.pile, drawTarget(), cardInner('cd-back', null, L.pile.w), { dur: .5, rot: 0 });
    S.hand++; renderHand(); const c = $$('#hand .card').pop(); sfx('flip'); gsap.fromTo(c, { rotationY: 90 }, { rotationY: 0, duration: D(.3), ease: 'back.out(2)' });
    pulse($('#cntYou'), 1, 1.15); await wait(1300, true); guard(g);
  }
  /* line 9: the Hint button; the learner opens the rules and closes them again */
  {
    const H = HOW.hint, b = $('#btnHint'); ost(''); say(H.vo);
    pulse(b, 3, 1.2); S.wantHint = true;
    idle(H.idle, () => pulse(b, 3, 1.2), b);
    try { await waitFor('hint'); idleOff(); await waitFor('hintclose'); } finally { S.wantHint = false; idleOff(); }
    await wait(500); guard(g);
  }
  /* line 10: the cards are shuffled and dealt again, a centre card is placed, then one worked example */
  {
    const H = HOW.match; ost(''); say(HOW.ready.vo);
    await reshuffle(); await newCentre(H.centre); await wait(Math.max(400, rt(HOW.ready.vo) - 3600), true);
    say(HOW.ready.vo2);
    const ids = dealOptions([{ text: H.right, correct: true }, ...H.wrongs.map(t => ({ text: t, correct: false }))], 5);
    S.view = 'wait'; renderHand(); turnOver(ids); await wait(rt(HOW.ready.vo2) - 600, true);
    /* the hand points at the matching card and presses it; the card goes to the centre pile and both show 5 */
    const i = S.cards.findIndex(c => c.correct); S.cards[i].glow = true; renderHand();
    await nudge(() => handEl(i), true); guard(g);
    const card = handEl(i), r = rectOf(card); card.style.visibility = 'hidden'; nudgeOff(); clearGlow(); sfx('good');
    await fly(r, L.played, cardInner(frontImg(0), H.right, r.w), { rot: 6, trail: true });
    S.played = { text: H.right, p: 0 }; renderCentre(); handEl(i).style.visibility = 'hidden';
    ost(H.ost); badge('correct', L.played.x + L.played.w - 20, L.played.y + 30, 130); sparkles(L.played.x + 105, L.played.y + 140, 6, 110);
    pose('flippy', 'cheer', 1600); valueBadges(5); await wait(2600, true);
    /* the example card goes back into the hand: both players still have 7 cards */
    const back = $('#playedCard'); S.played = null; back.style.visibility = 'hidden';
    await fly(rectOf(back), r, cardInner(frontImg(0), H.right, r.w), { rot: 0, dur: .45 }).finally(() => back.remove()); guard(g);
    S.cards.forEach(c => { c.glow = false; c.opt = false; c.correct = false; }); renderHand();
    const old = $$('#centre .card'); await gsap.to(old, { autoAlpha: 0, scale: .85, y: -30, duration: D(.25), ease: 'power2.in' }); S.centre = null; renderCentre(); ost(''); guard(g);
  }
  /* line 11: ready to play */
  say(HOW.go.vo);
  showGo('PLAY'); idle(SETUP.idle2, () => pulse($('#btnGo'), 2, 1.15), '#btnGo');
  await waitFor('go'); idleOff(); hideGo();
  await playGame(0);
}
/* rotate every card on the table (hand, computer's cards, draw pile, plus an extra element) and swap faces halfway */
async function allFlip(swap, extra) {
  const g = GID, sel = () => [...$$('#hand .card, #roboFan img, #pile img, #centre .card'), ...(extra ? [extra] : [])];
  sfx('flip');
  await gsap.to(sel(), { rotationY: 90, duration: D(.28), ease: 'power2.in' }); guard(g);
  swap();
  await gsap.fromTo(sel(), { rotationY: -90 }, { rotationY: 0, duration: D(.32), ease: 'power2.out' }); guard(g);
}
/* the How to Play 3 previews */
async function preview(t) {
  if (t === 'skip') {
    /* Skip dims the next player */
    await setTurn('computer'); tagSkip(); dimFan(true); miniStamp('SKIP', '#FF5A6E', 1450, 372); fx('fx-skip-smoke', 1450, 372, 420, { from: .4, to: 1.4, rot: 10, dur: 1.2 }); pose('robo', 'dizzy', 1800);
    await wait(1500); dimFan(false); await setTurn('learner');
  } else if (t === 'reverse') {
    /* Reverse: the arrows spin and the turn tag turns round */
    sfx('whoosh'); fx('fx-reverse-arrows', 960, 615, 460, { from: .6, to: 1.1, rot: 360, dur: .9, ease: 'power2.inOut' });
    await setTurn('computer'); tagSpin(); await wait(1100); await setTurn('learner');
  } else if (t === 'flip') {
    /* FLIP: every card turns over to a new number trick, then back */
    const keep = S.cards; await wait(300);
    sfx('whoosh'); sheet('level-up-burst', 960, 615, 700); sparkles(960, 615, 12, 220);
    await allFlip(() => { S.cards = FILLER[1].slice(0, keep.length).map(t => mk(t, { p: 1 })); renderHand(); }); await wait(1300);
    await allFlip(() => { S.cards = keep; renderHand(); });
  } else {
    /* Swap exchanges hands */
    const fan = rectOf($('#roboFan')), hand = { x: 780, y: 800, w: 136, h: 194 }, f = [];
    sfx('whoosh');
    for (let k = 0; k < 4; k++) f.push(fly({ ...hand, x: hand.x + k * 40 }, { x: fan.x + 180, y: fan.y + 40, w: 96, h: 136 }, cardInner('cd-back', null, 136), { dur: .7 }));
    for (let k = 0; k < 4; k++) f.push(fly({ x: fan.x + 160 + k * 20, y: fan.y + 40, w: 96, h: 136 }, { ...hand, x: hand.x + k * 40 }, cardInner('cd-back', null, 96), { dur: .7 }));
    const mine = S.hand, theirs = S.comp; gsap.set(['#hand', '#roboFan'], { autoAlpha: 0 });
    await Promise.all(f); S.hand = theirs; S.comp = mine; S.cards = []; renderHand(); renderFan(); gsap.set(['#hand', '#roboFan'], { autoAlpha: 1 });
    sfx('flip'); gsap.fromTo('#hand .card', { rotationY: 90 }, { rotationY: 0, duration: D(.3), stagger: .05, ease: 'back.out(1.6)' }); await wait(800);
  }
}
/* "The cards are shuffled, the players are set": every card returns to the deck and 7 are dealt to each player */
async function reshuffle() {
  const g = GID; S.view = 'wait'; S.centre = null; S.played = null; renderCentre(); eqClear();
  const back = cardInner('cd-back', null, 136);
  const f = [fly({ x: 740, y: 820, w: 136, h: 194 }, L.pile, back, { dur: .45 }), fly(rectOf($('#roboFan')), L.pile, back, { dur: .45 })];
  S.hand = 0; S.comp = 0; S.cards = []; renderHand(); renderFan(); await Promise.all(f);
  sfx('deal'); await gsap.to('#pile img', { keyframes: { x: [0, -40, 40, -20, 0], rotation: [0, -8, 8, -4, 0] }, stagger: .05, duration: D(.6) }); guard(g);
  S.hand = START_CARDS; S.comp = START_CARDS; renderHand({ deal: true }); renderFan(); gsap.from('#roboFan img', { y: 80, autoAlpha: 0, stagger: .04, duration: D(.35) });
  await wait(700);
}

/* ======================================================================
   PARTS 2 to 6: the scripted game
   ====================================================================== */
async function playGame(from = 0) {
  S.intro = false;
  for (let p = from; p < NP; p++) { S.part = p; renderProgress(); updateTint(); await runSteps(PLAY[p]); }
}
async function runSteps(steps) { for (let i = 0; i < steps.length; i++) await STEP[steps[i].t](steps[i], steps, i); }

const rt = t => Math.min(8500, 900 + t.length * 52);
const STEP = {
  /* Teaching: the game rule (learner observes) */
  async teach(st) {
    const g = GID, P = PARTS[st.part], scr = $('#scrTeach'), pan = scr.querySelector('.panel');
    S.view = 'wait'; renderHand(); ost(''); eqClear();
    const go = pan.querySelector('.go'), rule = pan.querySelector('.rule'); go.hidden = true;
    pan.style.setProperty('--pc', P.color); pan.querySelector('.medal').src = A(P.medal);
    const h2 = pan.querySelector('h2'); h2.textContent = P.title; h2.classList.remove('lit'); pan.querySelector('.how').textContent = P.how || P.teach;
    rule.classList.toggle('hasdemo', !!P.demo); rule.innerHTML = P.demo ? '<div class="demo"></div>' : P.rule.join('<br>');
    scr.hidden = false; sfx('magic');
    /* title first, then the explanation, then the rule itself pops in and glows */
    await gsap.timeline().fromTo(scr, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.25) }).fromTo(pan, { y: 120, scale: .85 }, { y: 0, scale: 1, duration: D(.5), ease: 'back.out(1.6)' }, '<')
      .fromTo(pan.querySelector('.medal'), { scale: 0, rotation: -180 }, { scale: 1, rotation: 0, duration: D(.6), ease: 'back.out(2)' }, '-=.2')
      .fromTo(pan.querySelector('.how'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: D(.4) }, '-=.3')
      .fromTo(rule, { autoAlpha: 0, scale: .7 }, { autoAlpha: 1, scale: 1, duration: D(.5), ease: 'back.out(2.2)' }, '+=.2')
      .fromTo(rule, { boxShadow: '0 0 0 0px rgba(255,200,61,0)' }, { boxShadow: '0 0 0 10px rgba(255,200,61,.55)', duration: D(.4), yoyo: true, repeat: 1 });
    guard(g);
    /* Parts 3 to 5 (rows 22, 44, 66): the rule is shown with a short animation while Flippy reads it, then the property name glows */
    const demo = P.demo ? DEMOS[P.demo](rule.querySelector('.demo')).catch(() => { }) : null;
    await talk(P.teach);
    if (demo) { await demo; guard(g); h2.classList.add('lit'); sparkles(960, 330, 12, 280); sfx('magic'); await wait(900); }
    go.hidden = false; gsap.fromTo(go, { scale: 0 }, { scale: 1, duration: D(.4), ease: 'back.out(2.5)' });
    const bob = gsap.to(go, { scale: 1.06, duration: .55, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: .4 }); gsap.delayedCall(.1, () => go.focus());
    try { await waitFor('go'); } finally { bob.kill(); }
    go.hidden = true;
    await gsap.to(scr, { autoAlpha: 0, duration: D(.3) }); scr.hidden = true; guard(g);
  },

  /* property explanation panels (Part 3 row 20, Part 4 row 34, Part 5 row 55), then GOT IT */
  async explain(st) {
    const g = GID, E = EXPLAIN[st.key], P = PARTS[S.part], scr = $('#scrExplain'), pan = scr.querySelector('.panel'), go = pan.querySelector('.go'), xd = pan.querySelector('.xd');
    S.view = 'wait'; renderHand(); eqClear(); ost('');
    pan.style.setProperty('--pc', P.color); pan.querySelector('.medal').src = A(P.medal);
    const name = pan.querySelector('.pname'); name.textContent = P.title; name.classList.remove('lit');
    const assoc = st.key === 'associative'; pan.querySelectorAll('.xrow').forEach(r => r.hidden = !assoc); xd.hidden = assoc; xd.innerHTML = '';
    go.hidden = true; pan.querySelector('.xcap').textContent = '';
    if (assoc) prepAssoc(E, pan);
    scr.hidden = false;
    await gsap.timeline().fromTo(scr, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.25) }).fromTo(pan, { y: 120, scale: .85 }, { y: 0, scale: 1, duration: D(.5), ease: 'back.out(1.6)' }, '<'); guard(g);
    /* the panel covers Flippy's bubble, so the VO line is captioned inside the panel too */
    const cap = pan.querySelector('.xcap'), line = t => { cap.textContent = t; gsap.fromTo(cap, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: D(.3) }); return say(t); };
    const lit = async t => { line(t); name.classList.add('lit'); sparkles(960, 330, 10, 260); sfx('magic'); await wait(rt(t), true); };
    await EXPLAINERS[st.key](E, pan, line, lit); guard(g);
    go.hidden = false; gsap.fromTo(go, { scale: 0 }, { scale: 1, duration: D(.4), ease: 'back.out(2.5)' }); go.focus();
    cap.textContent = E.ost ? E.ost.replace(/; /g, '   ·   ') : '';
    idle(E.idle, () => { line(E.idle); pulse(go, 2, 1.12); }, go);
    await waitFor('go'); idleOff(); go.hidden = true;
    line(E.ok); pose('flippy', 'cheer', 1600); sparkles(960, 330, 14, 300); sfx('magic'); await wait(1600, true);
    await gsap.to(scr, { autoAlpha: 0, duration: D(.3) }); scr.hidden = true; ost(''); guard(g);
  },

  /* a matching challenge: three cards (two correct in the Identity tutorial; one card at the very end) */
  async match(st) {
    const g = GID, P = S.part, rights = st.rights || [st.right], v = st.v ?? ev(st.centre);
    S.view = 'wait'; renderHand(); await setTurn('learner'); eqClear(); dimHand(false);
    if (!S.centre || S.centre.text !== st.centre) await newCentre(st.centre);
    /* the sheet's cards for this turn join the learner's face-up hand */
    const ids = dealOptions([...(st.nomatch ? [] : rights.map(t => ({ text: t, correct: true }))), ...st.wrongs.map(t => ({ text: t, correct: false }))], v);
    if (st.guided) S.cards.forEach(c => c.glow = !!c.correct);
    S.view = 'match'; renderHand(); turnOver(ids);
    ost(st.ost); say(st.vo);
    if (st.nomatch) {
      /* Sheet5 row 21: none of the three cards matches. The learner looks (a tapped card just shakes), then row 19: draw one card */
      const e0 = await tapOrWait('opt', 4500);
      if (e0) { sfx('bad'); gsap.fromTo(e0.el, { x: 0 }, { keyframes: { x: [-16, 16, -12, 10, -6, 0] }, duration: D(.45), ease: 'none' }); await wait(500); }
      await noMatchDraw(rights[0]); guard(g); ost(st.ost);
    }
    const glowRight = () => { S.cards.forEach(c => c.glow = !!c.correct); renderHand(); };
    const pulseRight = () => { rightEls().forEach(b => pulse(b, 2, 1.07)); if (st.last) pulse($('#centreCard'), 2, 1.05); };
    const first = () => rightEls()[0];
    idle(st.idle, pulseRight, first);
    let wrong = 0, stuck = false, guided = false, e;
    for (;;) {
      e = await waitFor('opt');
      if (Date.now() < S.lock) continue;
      if (S.cards[e.i]?.correct) break;
      /* wrong: the card shakes and returns */
      S.lock = Date.now() + 700; wrong++; S.stats.wrong++; sfx('bad'); pose('flippy', 'oops', 1500);
      { const r = rectOf(e.el); badge('wrong', r.x + r.w / 2, r.y + r.h / 2, 110, .4); }
      gsap.fromTo(e.el, { x: 0 }, { keyframes: { x: [-16, 16, -12, 10, -6, 0] }, duration: D(.45), ease: 'none' });
      if (stuck || guided) { say(st.w3, true); pulseRight(); continue; }
      if (wrong === 1) say(WRONG1, true);
      else if (wrong === 2) { say(st.w2, true); eqShow(eqOf(st, rights[0]), { glow: true }).catch(() => { }); }
      else if (st.stuck) {
        /* Practice 6 (rows 39, 61, 82): the draw pile glows, the learner draws one penalty card, then retries with the correct card glowing */
        stuck = true; idleOff(); eqClear(); await drawStuck(); guard(g);
        glowRight(); ost(st.ost); pose('flippy', 'point', 2400); say(`${STUCK.ok} ${st.w3}`, true);
        idle(STUCK.ridle, pulseRight, first);
      } else {
        /* every other match: the correct card glows and pulses; after the guided pick the learner draws one penalty card */
        guided = !st.last; idleOff(); eqClear(); glowRight(); pose('flippy', 'point', 2400); say(st.w3, true); pulseRight();
        idle(st.idle, pulseRight, first);
        if (st.last) stuck = true;
      }
    }
    idleOff(); clearGlow();
    /* correct: the card moves to the centre pile, the numbers swap / brackets move / parts split / the blank fills, both sides reveal the answer */
    const pick = S.cards[e.i].text;
    sfx('good'); const r = rectOf(e.el); e.el.style.visibility = 'hidden';
    await fly(r, L.played, cardInner(frontImg(P), pick, r.w), { rot: 6, trail: true });
    /* the played card leaves the hand; the other cards of this turn stay in it */
    S.cards.splice(e.i, 1); S.cards.forEach(c => { c.opt = false; c.correct = false; c.glow = false; });
    if (!st.last && !S.cards.length) S.cards.push(mk(filler()));
    S.hand = S.cards.length; S.done[P]++; S.stats.correct++;
    S.played = { text: pick, p: P }; S.view = 'wait'; S.pairs[P].push(pairOf(st, pick, v));
    renderCentre(); renderHand(); renderProgress();
    gsap.fromTo('#playedCard', { scale: 1.12 }, { scale: 1, duration: D(.3), ease: 'back.out(3)' });
    badge('correct', L.played.x + L.played.w - 20, L.played.y + 30, 130); sparkles(L.played.x + 105, L.played.y + 150, 8, 130);
    if (st.confetti) confetti(24, L.played.x + 105, L.played.y + 100);
    pose('flippy', 'cheer', 1800); say(stuck && st.rok ? st.rok : st.ok, true);
    await eqShow(eqOf(st, pick)); if (st.badge !== false) valueBadges(v);
    await wait(1900, true);
    if (guided) await penaltyDraw();
  },

  /* the computer's own turn: a centre card is dealt, the computer's three cards turn face up, it checks them one by one,
     puts back the ones that do not match and plays the match; the equation panel shows its working (Sheet5 rows 10, 15, 18, 26) */
  async cpu(st) {
    const g = GID, P = S.part, v = st.v ?? ev(st.centre), row = $('#cpuRow');
    S.view = 'wait'; renderHand(); eqClear(); dimHand(false); dimFan(false);
    await setTurn('computer'); ost(st.ost); say(st.vo); pose('robo', 'think');
    await newCentre(st.centre);
    const opts = shuffle([{ text: st.right, correct: true }, ...st.wrongs.map(t => ({ text: t, correct: false }))]);
    if (opts[0].correct) [opts[0], opts[1]] = [opts[1], opts[0]];
    const W = CPUROW.w, H = CPUROW.h;
    row.innerHTML = `<p class="lbl">COMPUTER'S CARDS</p>` + opts.map((o, k) => `<div class="card" style="left:${k * (W + CPUROW.gap)}px;width:${W}px;height:${H}px">${cardInner(frontImg(P), o.text, W)}</div>`).join('');
    const cards = [...row.querySelectorAll('.card')], lbl = row.querySelector('.lbl'), fan = rectOf($('#roboFan'));
    sfx('deal');
    await gsap.timeline()
      .from(cards, { x: k => fan.x + 70 - CPUROW.x - k * (W + CPUROW.gap), y: fan.y - CPUROW.y, scale: .6, rotationY: 90, autoAlpha: 0, duration: D(.45), stagger: .1, ease: 'back.out(1.4)' })
      .from(lbl, { autoAlpha: 0, duration: D(.25) }, '<');
    guard(g);
    if (st.vo2) say(st.vo2);
    await wait(700);
    let pick = 0;
    for (let k = 0; k < cards.length; k++) {
      const c = cards[k]; sfx('flip');
      c.classList.add('look'); await gsap.to(c, { y: -16, scale: 1.06, duration: D(.25), ease: 'power2.out' }); await wait(700);
      if (opts[k].correct) { pick = k; break; }
      /* not a match: it goes back down */
      c.classList.remove('look');
      gsap.to(c, { keyframes: { x: [-8, 8, -5, 0] }, duration: D(.3) });
      await gsap.to(c, { y: 0, scale: 1, autoAlpha: .45, duration: D(.3) }); guard(g);
    }
    /* found it: a lightbulb over the computer, then it plays the card */
    bulb(); pose('robo', 'play', 1600); sfx('good');
    const c = cards[pick], r = rectOf(c); r.y -= 16; c.style.visibility = 'hidden';
    gsap.to(cards.filter(x => x !== c), { x: '+=40', y: fan.y - CPUROW.y, scale: .5, autoAlpha: 0, duration: D(.4), stagger: .05, ease: 'power2.in' });
    gsap.to(lbl, { autoAlpha: 0, duration: D(.2) });
    await fly(r, L.played, cardInner(frontImg(P), opts[pick].text, r.w), { rot: -6, trail: true });
    row.innerHTML = '';
    S.played = { text: opts[pick].text, p: P }; renderCentre(); await cpuLoses(1);
    gsap.fromTo('#playedCard', { scale: 1.12 }, { scale: 1, duration: D(.3), ease: 'back.out(3)' });
    badge('correct', L.played.x + L.played.w - 20, L.played.y + 30, 110); sparkles(L.played.x + 105, L.played.y + 150, 6, 110);
    say(st.ok, true); pose('flippy', 'cheer', 1400);
    await eqShow(eqOf(st, opts[pick].text)); if (st.badge !== false) valueBadges(v);
    await wait(1800, true);
  },

  /* the computer plays Reverse or Skip (the learner's turn is missed) or a Mystery card */
  async cpuAct(st) {
    const g = GID; S.view = 'wait'; renderHand(); await setTurn('computer'); eqClear();
    if (st.pre) { ost(st.preOst); say(st.pre); pose('robo', 'think'); await wait(1500, true); }
    ost(st.ost); pose('robo', 'play', 1400);
    await handThrow('robo', actInner(st.act, 150), L.played);
    S.played = { act: st.act }; renderCentre(); await cpuLoses(1);
    pose('robo', 'laugh', 2600); say(st.vo);
    if (st.act === 'mystery') {
      /* Part 4 row 41: the Mystery card flips; it shows DROP 1 and the computer drops one extra card */
      await wait(600); await revealCard(st.img, st.reveal, L.played); guard(g);
      sparkles(L.played.x + 105, L.played.y + 150, 10, 160); sfx('good');
      const fan = rectOf($('#roboFan'));
      await fly({ x: fan.x + 70, y: fan.y + 10, w: 80, h: 114 }, L.pile, cardInner('cd-back', null, 80), { dur: .55, rot: -20 });
      pulse($('#cntCpu'), 1, 1.12); await cpuLoses(1);
      if (st.ok) await talk(st.ok); else await wait(1200, true);
      guard(g); return;
    }
    const blue = '#5AB0FF', red = '#FF5A6E';
    if (st.act === 'reverse') { sfx('whoosh'); fx('fx-reverse-arrows', L.played.x + 105, L.played.y + 150, 460, { from: .6, to: 1.1, rot: -360, dur: .9, ease: 'power2.inOut' }); sheet('screen-edge-good', 960, 540, 1920); await stamp('REVERSE!', blue, .5); }
    else { fx('fx-skip-smoke', 960, 920, 620, { from: .4, to: 1.4, rot: 10, dur: 1.2 }); sheet('screen-edge-bad', 960, 540, 1920); await stamp('SKIP!', red, .5); }
    /* the learner's cards dim and the turn arrow returns to the computer */
    await setTurn('learner'); dimHand(true);
    if (st.act === 'skip') { miniStamp('SKIP', red, 960, 900); tagSkip(); } else tagSpin();
    await wait(1600, true);
    await setTurn('computer'); dimHand(false);
    await talk(st.ok); guard(g);
  },

  /* a special card appears in the learner's hand and the learner plays it */
  async give(st) {
    const g = GID; await setTurn('learner'); eqClear(); dimHand(false);
    if (st.before) { [S.hand, S.comp] = st.before; S.view = 'wait'; renderHand(); renderFan(); }
    S.view = 'special';
    ost(st.ost); pose('flippy', 'point', 2400); say(st.vo, true);
    renderHand(); sfx('deal'); await handThrow('flippy', actInner(st.act, 150), L.act);
    S.special = st.act; renderHand();
    const el = () => $('#hand [data-act]');
    idle(st.idle, () => st.act === 'reverse' ? gsap.fromTo(el(), { rotation: 2 }, { rotation: 362, duration: 1, ease: 'power1.inOut' }) : st.act === 'skip' ? bounce(el()) : pulse(el(), 2, 1.1), el);
    const e = await waitFor('act'); idleOff(); clearGlow();
    const r = rectOf(e.el); e.el.style.visibility = 'hidden';
    await fly(r, L.played, actInner(st.act, r.w), { rot: st.act === 'reverse' ? 368 : 8, trail: true, dur: .6 });
    S.special = null; S.played = { act: st.act }; S.view = 'wait'; renderCentre(); renderHand();
    const cx = L.played.x + 105, cy = L.played.y + 150;
    if (st.act === 'skip') {
      /* computer's cards dim with a red SKIP stamp; the turn arrow returns to the learner */
      sheet('impact-ring', cx, cy, 460); fx('fx-skip-smoke', 1450, 372, 460, { from: .4, to: 1.4, rot: 10, dur: 1.2 }); sparkles(cx, cy, 8, 140);
      await setTurn('computer'); tagSkip(); dimFan(true); miniStamp('SKIP', '#FF5A6E', 1450, 372); pose('robo', 'dizzy', 2400);
      say(st.ok, true); pose('flippy', 'cheer', 1800); await wait(1800, true);
      await setTurn('learner'); dimFan(false); await stamp('PLAY AGAIN!', '#FF5A6E', .5); await wait(600, true);
    } else if (st.act === 'reverse') {
      /* arrow spins back towards the learner; the computer's turn is skipped */
      sfx('whoosh'); fx('fx-reverse-arrows', cx, cy, 460, { from: .6, to: 1.1, rot: 360, dur: .9, ease: 'power2.inOut' }); sparkles(cx, cy, 10, 160);
      await setTurn('computer'); tagSpin(); await wait(900); await setTurn('learner');
      say(st.ok, true); pose('flippy', 'cheer', 1800); await stamp('PLAY AGAIN!', '#5AB0FF', .6); await wait(1200, true);
    } else if (st.act === 'swap') {
      /* Part 4 row 40: the remaining hands exchange places */
      sheet('impact-ring', cx, cy, 460); sparkles(cx, cy, 10, 160); sfx('whoosh');
      const fan = rectOf($('#roboFan')), mine = S.hand, theirs = S.comp, f = [], hx = L.hand.cx - 160;
      for (let k = 0; k < mine; k++) f.push(fly({ x: hx + k * 60, y: L.hand.y, w: 136, h: 194 }, { x: fan.x + 70, y: fan.y + 10, w: 80, h: 114 }, cardInner('cd-back', null, 136), { dur: .8 }));
      for (let k = 0; k < theirs; k++) f.push(fly({ x: fan.x + 50 + k * 30, y: fan.y + 10, w: 80, h: 114 }, { x: hx + 60 + k * 120, y: L.hand.y, w: 136, h: 194 }, cardInner('cd-back', null, 80), { dur: .8 }));
      gsap.set(['#hand', '#roboFan'], { autoAlpha: 0 });
      await Promise.all(f); guard(g);
      S.hand = theirs; S.comp = mine; S.cards = []; renderHand(); renderFan(); gsap.set(['#hand', '#roboFan'], { autoAlpha: 1 });
      sheet('screen-edge-good', 960, 540, 1920); pose('robo', 'dizzy', 2000); pose('flippy', 'cheer', 1800); say(st.ok, true);
      await stamp('SWAP!', '#B57BFF', .6); await wait(800, true);
      /* row 54: the new hand is displayed before the next turn */
      const shown = $$('#hand .card'); sfx('flip');
      await gsap.fromTo(shown, { rotationY: 90 }, { rotationY: 0, duration: D(.35), stagger: .15, ease: 'back.out(1.6)' }); guard(g);
      gsap.to(shown, { keyframes: { y: [-30, 0, -12, 0] }, stagger: .1, duration: .7 });
      shown.forEach(c => { const q = rectOf(c); sparkles(q.x + q.w / 2, q.y + q.h / 2, 6, 110); });
      pulse($('#cntYou'), 1, 1.15); await wait(1800, true);
      guard(g);
    } else {
      /* Mystery: flips to reveal DROP 1 (Part 3: discard one more card) or EXTRA TURN (Part 5: bonus turn) */
      await revealCard(st.img, st.reveal, L.played); guard(g);
      S.played = { act: 'mystery' }; renderCentre();
      sparkles(960, 450, 14, 260); fx('fx-star-burst', 960, 450, 600, { dur: 1 }); sfx('good');
      pose('flippy', 'cheer', 1800); say(st.ok, true);
      if (st.bonus) {
        /* row 75: golden BONUS TURN burst; the computer's cards dim and the turn arrow stays with the learner */
        sheet('level-up-burst', 960, 520, 800); dimFan(true);
        await stamp('BONUS TURN!', '#FFC83D', .7); await wait(1000, true); dimFan(false);
        return;
      }
      /* DROP 1: the learner picks any card from the hand and it goes back under the draw pile */
      S.view = 'drop'; renderHand();
      idle(st.ok, () => gsap.to('#hand [data-opt]', { rotation: '+=3', duration: .15, yoyo: true, repeat: 5 }), () => handEl(0));
      const d = await waitFor('opt'); idleOff();
      const dr = rectOf(d.el), dt = S.cards[d.i].text; d.el.style.visibility = 'hidden';
      await fly(dr, L.pile, cardInner(frontImg(S.part), dt, dr.w), { rot: -20, dur: .5 });
      S.cards.splice(d.i, 1); S.hand = S.cards.length; S.view = 'wait'; renderHand();
      sparkles(L.pile.x + 105, L.pile.y + 150, 10, 160); sfx('magic'); await wait(1200, true);
    }
  },

  /* FLIP: Part 2 row 27 lands on the centre pile; Parts 3 and 4 (rows 43, 65) appear in the learner's hand.
     Then every card flips to the next property's side */
  async flip(st) {
    const g = GID, from = S.part, to = from + 1; S.view = 'wait'; renderHand(); await setTurn('learner'); eqClear(); ost(st.ost); dimHand(false);
    if (st.hand) {
      S.view = 'special'; say(st.vo, true); pose('flippy', 'point', 2400);
      renderHand(); sfx('deal'); await handThrow('flippy', actInner('flip', 150), L.act);
      S.special = 'flip'; renderHand();
      idle(st.idle, () => pulse($('#hand [data-act]'), 2, 1.1), '#hand [data-act]');
      const e = await waitFor('act'); idleOff(); clearGlow();
      const r = rectOf(e.el); e.el.style.visibility = 'hidden';
      sfx('whoosh'); await fly(r, L.centre, cardInner('cd-flip', null, r.w), { rot: 0, trail: true, dur: .6 });
      S.special = null; S.view = 'wait'; S.centre = { flip: true }; S.played = null; renderCentre(); renderHand(); guard(g);
    } else {
      sfx('whoosh'); await fly(L.pile, L.centre, cardInner('cd-flip', null, L.pile.w), { dur: .6, rot: 0, trail: true });
      S.centre = { flip: true }; S.played = null; renderCentre();
      say(st.vo); pose('flippy', 'point', 2000);
      const c = $('#centreCard'), gk = glowAt(rectOf(c), 1.6), wob = gsap.to(c, { scale: 1.05, duration: .6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      idle(st.idle, () => pulse($('#centreCard'), 2, 1.12), '#centreCard');
      await waitFor('centre'); idleOff(); gk(); wob.kill();
    }
    /* learner's cards, computer's cards and the draw pile flip together; new cards appear */
    sfx('magic'); sheet('level-up-burst', 960, 615, 900); fx('fx-star-burst', 960, 615, 800, { dur: 1 }); sparkles(960, 615, 16, 300); shake(8);
    await wait(300);
    await allFlip(() => {
      S.part = to; [S.hand, S.comp] = DEALS[to]; S.cards = []; S.centre = null;
      renderHand(); renderFan(); renderCentre(); renderProgress(); updateTint();
    });
    say(st.ok, true); pose('flippy', 'cheer', 1800); await stamp('FLIP!', '#FFC83D', .5); await wait(1200, true);
    S.view = 'wait'; renderHand(); guard(g);
  },

  /* Part 5 row 88: all the Identity examples; +0 and ×1 glow, ×0 appears separately; they combine into the Identity card; all four property badges appear */
  async complete(st) {
    const g = GID, P = PARTS[S.part]; S.view = 'wait'; renderHand(); ost(st.ost); eqClear(); idleOff();
    const scr = $('#scrWin'), ring = scr.querySelector('.ring');
    let pairs = S.pairs[S.part].length ? S.pairs[S.part] : PLAY[S.part].filter(s => s.t === 'match').map(s => pairOf(s, (s.rights || [s.right])[0], s.v));
    pairs = [...pairs.filter(p => !p.zero), ...pairs.filter(p => p.zero)];
    scr.querySelector('h2').textContent = st.ost;
    scr.querySelector('.pcard img').src = A('cards/' + P.card); scr.querySelector('.pcard span').innerHTML = P.rule.join('<br>');
    ring.innerHTML = pairs.map((p, i) => `<div class="pair${p.zero ? ' zero' : ''}" style="left:${i < 4 ? 70 : 1250}px;top:${200 + (i % 4) * 118 + (p.zero ? 26 : 0)}px"><span class="pa">${spans(p.a)}</span><span class="t o">=</span><span class="pb">${spans(p.b)}</span>${p.v != null ? `<small>${p.v}</small>` : ''}</div>`).join('');
    const medals = scr.querySelector('.medals');
    medals.innerHTML = PARTS.slice(0, 4).map(q => `<div class="md" style="--pc:${q.color}"><img src="${A(q.medal)}" alt=""><span>${q.name}</span></div>`).join('');
    scr.hidden = false; sfx('levelup'); pose('robo', 'sad');
    const chips = [...ring.children];
    gsap.set(chips, { autoAlpha: 0 }); gsap.set(medals.children, { autoAlpha: 0 });
    await gsap.timeline().fromTo(scr, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.4) })
      .fromTo(scr.querySelector('h2'), { scale: 0 }, { scale: 1, duration: D(.5), ease: 'back.out(2)' })
      .fromTo(scr.querySelector('.pcard'), { scale: 0, rotationY: 180 }, { scale: 1, rotationY: 0, duration: D(.6), ease: 'back.out(1.6)' }, '-=.2');
    guard(g);
    say(st.vo, true); gsap.to('#scrWin .rays', { rotation: 360, duration: 24, repeat: -1, ease: 'none' });
    for (const c of chips) {
      const Ael = [...c.querySelectorAll('.pa .t')], Bel = [...c.querySelectorAll('.pb .t')];
      Bel.forEach(e => e.style.visibility = 'hidden');
      if (!c.classList.contains('zero')) Ael.slice(-2).forEach(e => e.classList.add('glow'));
      gsap.fromTo(c, { autoAlpha: 0, scale: .6 }, { autoAlpha: 1, scale: 1, duration: D(.3), ease: 'back.out(2.4)' }); sfx(c.classList.contains('zero') ? 'bad' : 'star');
      await wait(250); morph(c, Ael, Bel, { dur: .6 }); await wait(420);
    }
    guard(g); await wait(1600, true);
    /* row 88: the Identity examples flip and combine into the Identity Property card */
    const pc = rectOf(scr.querySelector('.pcard')), cx = pc.x + pc.w / 2, cy = pc.y + pc.h / 2; sfx('whoosh');
    await gsap.to(chips, { x: i => cx - (chips[i].offsetLeft + chips[i].offsetWidth / 2), y: i => cy - (chips[i].offsetTop + chips[i].offsetHeight / 2),
      rotationY: 180, scale: .15, autoAlpha: 0, stagger: .06, duration: D(.6), ease: 'power2.in' }); guard(g);
    gsap.fromTo(scr.querySelector('.pcard'), { scale: 1.12 }, { scale: 1, duration: D(.4), ease: 'back.out(3)' });
    /* the Identity card glows; all four property badges appear; level-complete confetti */
    scr.querySelector('.pcard').classList.add('lit'); sfx('win'); confetti(90); sheet('confetti', 700, 420, 1200); sheet('confetti', 1220, 420, 1200); sheet('screen-edge-good', 960, 540, 1920);
    sparkles(960, 440, 16, 300); say(st.ok, true); pose('flippy', 'cheer');
    await gsap.fromTo(medals.children, { autoAlpha: 0, scale: 0, rotation: -90 }, { autoAlpha: 1, scale: 1, rotation: 0, stagger: .25, duration: D(.45), ease: 'back.out(2.5)', onStart: () => sfx('star') }); guard(g);
    await wait(3200, true);
    await gsap.to(scr, { autoAlpha: 0, duration: D(.4) }); scr.hidden = true; scr.querySelector('.pcard').classList.remove('lit'); ost(''); guard(g);
  },

  /* Part 6 row 54: the computer is close to winning */
  async warn(st) {
    const g = GID; S.view = 'wait'; renderHand(); eqClear();
    await setTurn('computer'); dimFan(false);
    S.comp = st.comp; renderFan(); ost(st.ost); say(st.vo); pose('robo', 'laugh', 2600);
    gsap.fromTo('#roboFan img', { y: 0 }, { keyframes: { y: [-30, 0, -14, 0] }, stagger: .12, duration: .8 });
    miniStamp('WATCH OUT!', '#FF9F1C', 1450, 372, 1.6); pulse($('#cntCpu'), 3, 1.15);
    await wait(rt(st.vo), true);
    await talk(st.ok); guard(g);
  },

  /* Part 6 row 55: one card left; the learner must call FINAL FLIP before the last card unlocks */
  async finalCall(st) {
    const g = GID; await setTurn('learner'); eqClear(); dimHand(false); dimFan(false);
    S.hand = 1; S.view = 'wait'; renderHand(); await newCentre(st.centre);
    const ids = dealOptions([{ text: st.card, correct: true }], null); S.view = 'match'; renderHand(); turnOver(ids);
    $('#hand').classList.add('callfirst');
    ost(st.ost); pose('flippy', 'point', 2400); say(st.vo, true);
    const b = $('#btnFinal'); b.hidden = false; b.classList.remove('on');
    gsap.fromTo(b, { scale: 0 }, { scale: 1, duration: D(.45), ease: 'back.out(2.5)' });
    const pulseB = () => pulse(b, 2, 1.1);
    idle(st.idle, pulseB, b);
    let wrong = 0, gk = null;
    try {
      for (;;) {
        const e = await nextTap(); guard(g);
        if (e.kind === 'final') break;
        if (e.kind !== 'opt' || Date.now() < S.lock) continue;
        /* the last card stays locked until the button is tapped */
        S.lock = Date.now() + 700; wrong++; sfx('bad'); pose('flippy', 'oops', 1500);
        gsap.fromTo(e.el, { x: 0 }, { keyframes: { x: [-16, 16, -12, 10, -6, 0] }, duration: D(.45), ease: 'none' });
        if (wrong === 1) say(st.w1, true);
        else if (wrong === 2) { say(st.w2, true); gsap.fromTo(b, { filter: 'brightness(1)' }, { filter: 'brightness(1.9)', duration: .14, yoyo: true, repeat: 7 }); }
        else { say(st.w3, true); pose('flippy', 'point', 2400); pulseB(); if (!gk) gk = glowAt(rectOf(b), 1.25); }
      }
    } finally { idleOff(); if (gk) gk(); $('#hand').classList.remove('callfirst'); }
    /* the button springs up and lights green */
    sfx('good'); b.classList.add('on');
    gsap.fromTo(b, { y: 0 }, { keyframes: { y: [-34, 0], scale: [1.22, 1] }, duration: D(.5), ease: 'back.out(2)' });
    const r = rectOf(b); sparkles(r.x + r.w / 2, r.y + r.h / 2, 12, 200);
    say(st.ok, true); pose('flippy', 'cheer', 1800); await wait(1800, true);
    await gsap.to(b, { autoAlpha: 0, scale: .6, duration: D(.3) }); b.hidden = true; gsap.set(b, { clearProps: 'all' }); guard(g);
  },

  /* Part 6 row 57: the four property cards rise, flip and form a trophy; the names light one by one */
  async victory(st) {
    const g = GID; S.over = true; S.view = 'wait'; renderHand(); ost(st.ost); eqClear(); idleOff();
    $('#scrStar h2').textContent = RESULT.win; $('#scrStar .sub').textContent = st.ost;
    const scr = $('#scrStar'), tc = scr.querySelector('.tcards'), names = scr.querySelector('.names'), trophy = scr.querySelector('.trophy'), P4 = PARTS.slice(0, 4);
    tc.innerHTML = P4.map(() => `<div class="tcard">${cardInner('cd-back', null, 170)}</div>`).join('');
    names.innerHTML = P4.map(q => `<span style="--pc:${q.color}">${q.name}</span>`).join('');
    const acc = S.stats.correct + S.stats.wrong ? S.stats.correct / (S.stats.correct + S.stats.wrong) : 1, stars = acc >= .9 ? 3 : acc >= .7 ? 2 : 1;
    scr.querySelector('.rating').innerHTML = [0, 1, 2].map(i => `<img class="st ${i === 1 ? 'mid' : ''}" src="${A('rewards/star-' + (i < stars ? 'filled' : 'empty'))}" alt="">`).join('');
    const cards = [...tc.children];
    gsap.set([trophy, '#btnAgain', '#btnHome', scr.querySelector('.rating')], { autoAlpha: 0 });
    scr.hidden = false; sfx('levelup'); pose('robo', 'sad');
    await gsap.timeline().fromTo(scr, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.4) })
      .fromTo(scr.querySelector('h2'), { scale: 0 }, { scale: 1, duration: D(.5), ease: 'back.out(2)' })
      .fromTo(scr.querySelector('.sub'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: D(.3) });
    guard(g);
    confetti(60); sfx('win'); say(st.vo, true); gsap.to('#scrStar .rays', { rotation: 360, duration: 24, repeat: -1, ease: 'none' });
    /* rise */
    await gsap.fromTo(cards, { x: i => (i - 1.5) * 230, y: 700 }, { y: 0, duration: D(.6), stagger: .12, ease: 'back.out(1.4)', onStart: () => sfx('deal') }); guard(g);
    /* flip, one by one */
    for (let i = 0; i < 4; i++) {
      const c = cards[i]; sfx('flip');
      await gsap.to(c, { rotationY: 90, duration: D(.16), ease: 'power2.in' });
      c.innerHTML = `<img src="${A('cards/' + P4[i].card)}" alt=""><img class="tico" src="${A('ui/ui-icon-' + P4[i].key)}" alt="">`;
      await gsap.to(c, { rotationY: 0, duration: D(.22), ease: 'back.out(2)' }); guard(g);
    }
    /* form the trophy: the cards fan behind it */
    await gsap.to(cards, { x: 0, y: -40, rotation: i => (i - 1.5) * 24, duration: D(.55), ease: 'power3.inOut' }); guard(g);
    sfx('magic'); sheet('level-up-burst', 960, 420, 900);
    await gsap.fromTo(trophy, { autoAlpha: 1, scale: 0 }, { scale: 1, duration: D(.5), ease: 'back.out(2)' }); guard(g);
    gsap.fromTo(trophy, { rotationY: 0 }, { rotationY: 720, duration: D(1.6), ease: 'power2.inOut' });
    for (const n of names.children) { n.classList.add('on'); sfx('star'); gsap.fromTo(n, { scale: .6 }, { scale: 1, duration: D(.35), ease: 'back.out(3)' }); await wait(380); }
    guard(g);
    sfx('win'); confetti(140); sheet('confetti', 500, 400, 1300); sheet('confetti', 1420, 400, 1300); sheet('confetti', 960, 300, 1500); sheet('screen-edge-good', 960, 540, 1920);
    sparkles(960, 400, 20, 360); pose('flippy', 'cheer'); await wait(1400, true); say(st.ok, true);
    gsap.to(scr.querySelector('.rating'), { autoAlpha: 1, duration: .3 }); gsap.from(scr.querySelectorAll('.rating img'), { scale: 0, rotation: -90, stagger: .1, duration: D(.4), ease: 'back.out(2.5)' });
    gsap.fromTo(['#btnAgain', '#btnHome'], { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, stagger: .1, duration: D(.35), ease: 'back.out(2.5)', delay: .6 });
  }
};

/* the GOT IT panels' animations */
function prepAssoc(E, pan) {
  const [big, small] = pan.querySelectorAll('.xrow');
  const fill = (row, a, b, v) => { row.querySelector('.xa').innerHTML = `<span class="lay la">${spans(a)}</span><span class="lay lb">${spans(b)}</span>`; row.querySelector('.xval').textContent = '= ' + v; };
  fill(big, E.a, E.b, E.val); fill(small, E.ma, E.mb, E.mval);
  gsap.set([big.querySelector('.xval'), small], { autoAlpha: 0 });
}
const EXPLAINERS = {
  /* Part 3 row 20: three number cards, brackets move, the answer stays 10 */
  async associative(E, pan, line, lit) {
    const g = GID, [big, small] = pan.querySelectorAll('.xrow');
    const parts = row => [[...row.querySelectorAll('.la .t')], [...row.querySelectorAll('.lb .t')]];
    const [bA, bB] = parts(big); bB.forEach(e => e.style.visibility = 'hidden');
    line(E.lines[0]);
    await gsap.timeline().from(bA.filter(e => e.classList.contains('n')), { y: -160, autoAlpha: 0, rotation: -20, stagger: .15, duration: D(.4), ease: 'back.out(1.8)', onStart: () => sfx('deal') })
      .from(bA.filter(e => !e.classList.contains('n')), { scale: 0, stagger: .08, duration: D(.3), ease: 'back.out(3)' }); guard(g);
    await wait(1400, true); await gsap.to(big.querySelector('.xval'), { autoAlpha: 1, duration: D(.3) }); sfx('good'); await wait(2000, true);
    line(E.lines[1]); gsap.to(big.querySelector('.xval'), { autoAlpha: .25, duration: .2 });
    await morph(big.querySelector('.xa'), bA, bB, { keepA: false, glow: true, dur: 1 }); guard(g);
    sfx('good'); await gsap.fromTo(big.querySelector('.xval'), { autoAlpha: .25, scale: 1.4 }, { autoAlpha: 1, scale: 1, duration: D(.4), ease: 'back.out(3)' }); await wait(2600, true);
    await lit(E.lines[2]);
    /* "A multiplication example briefly demonstrates the same rule" (no VO line for it) */
    const [sA, sB] = parts(small); sB.forEach(e => e.style.visibility = 'hidden'); gsap.set(small.querySelector('.xval'), { autoAlpha: 0 });
    await gsap.to(small, { autoAlpha: 1, duration: D(.3) }); await wait(600);
    await morph(small.querySelector('.xa'), sA, sB, { keepA: false, glow: true, dur: .9 }); await gsap.to(small.querySelector('.xval'), { autoAlpha: 1, duration: D(.3) }); guard(g);
    await wait(1500, true);
  },
  /* Part 4 row 34: 3 rows of 6 blocks; a glowing line splits each row into 4 and 2; 12 and 6 combine to 18 */
  async distributive(E, pan, line, lit) {
    const g = GID, xd = pan.querySelector('.xd'), STEP_ = 58, GAP = 40, R = E.rows, C = E.cols, K = E.split;
    let html = '<div class="grid">';
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) html += `<i class="blk ${c < K ? 'pa' : 'pb'}" style="left:${c * STEP_}px;top:${r * STEP_}px"></i>`;
    const gw = C * STEP_ - 8, gh = R * STEP_ - 8, aw = K * STEP_ - 8, bx = K * STEP_ + GAP, bw = (C - K) * STEP_ - 8;
    html += `<div class="cut" style="left:${K * STEP_ - 4 + GAP / 2}px;height:${gh + 40}px"></div>`;
    html += `<b class="glab g6" style="left:0;width:${gw}px;top:${gh + 12}px">${C}</b><b class="glab g4" style="left:0;width:${aw}px;top:${gh + 12}px">${K}</b><b class="glab g2" style="left:${bx}px;width:${bw}px;top:${gh + 12}px">${C - K}</b>`;
    html += `<b class="rlab" style="left:-60px;top:${gh / 2 - 22}px">${R}</b></div>`;
    html += `<div class="xeq">${E.eqs.map((e, i) => `<div class="xe e${i}" style="top:${i * 56}px">${spans(e)}</div>`).join('')}</div>`;
    xd.innerHTML = html;
    const blk = [...xd.querySelectorAll('.blk')], pb = [...xd.querySelectorAll('.blk.pb')], cut = xd.querySelector('.cut'), xe = i => xd.querySelector('.e' + i);
    gsap.set([...blk, cut, ...xd.querySelectorAll('.glab, .rlab'), xe(1), xe(2), xe(3), xe(4)], { autoAlpha: 0 });
    /* 1: 3 times 6 makes 18 */
    line(E.lines[0]);
    await gsap.fromTo(blk, { scale: 0 }, { autoAlpha: 1, scale: 1, duration: D(.25), stagger: .035, ease: 'back.out(2.5)', onStart: () => sfx('deal') }); guard(g);
    gsap.to(xd.querySelectorAll('.g6, .rlab'), { autoAlpha: 1, duration: D(.3) });
    await gsap.fromTo(xe(1), { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: D(.35) }); sfx('good'); await wait(rt(E.lines[0]), true);
    /* 2: split 6 into 4 and 2 */
    line(E.lines[1]);
    await gsap.fromTo(cut, { autoAlpha: 1, scaleY: 0 }, { scaleY: 1, duration: D(.45), ease: 'power2.out' }); sfx('whoosh');
    gsap.to(pb, { x: GAP, duration: D(.5), ease: 'back.out(1.6)' }); gsap.to(xd.querySelector('.g6'), { autoAlpha: 0, duration: .2 });
    blk.forEach(el => el.classList.add('split'));
    await gsap.to(xd.querySelectorAll('.g4, .g2'), { autoAlpha: 1, duration: D(.3), delay: .3 }); guard(g);
    gsap.to(xe(1), { autoAlpha: .35, duration: .3 });
    await gsap.fromTo(xe(2), { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: D(.35) }); await wait(1600, true);
    await gsap.fromTo(xe(3), { autoAlpha: 0, x: 40 }, { autoAlpha: 1, x: 0, duration: D(.35) }); await wait(Math.max(1000, rt(E.lines[1]) - 2400), true); guard(g);
    /* 3: add them together: still 18 */
    line(E.lines[2]);
    await gsap.fromTo(xe(4), { autoAlpha: 0, scale: 1.4 }, { autoAlpha: 1, scale: 1, duration: D(.4), ease: 'back.out(3)' });
    [...xe(4).querySelectorAll('.t.n')].pop().classList.add('glow'); sfx('good');
    gsap.to(blk, { keyframes: { y: [-10, 0] }, stagger: .02, duration: .35 }); await wait(rt(E.lines[2]), true); guard(g);
    /* 4: the property name glows; 5: multiply each part and add */
    await lit(E.lines[3]);
    line(E.lines[4]); await wait(rt(E.lines[4]), true); guard(g);
  },
  /* Part 5 row 55: 8 + 0 = 8, 8 × 1 = 8, then 8 × 0 = 0 as a contrast */
  async identity(E, pan, line, lit) {
    const g = GID, xd = pan.querySelector('.xd');
    xd.innerHTML = E.rows.map((r, i) => `<div class="xi${i === 2 ? ' zero' : ''}" style="top:${i * 92 + (i === 2 ? 14 : 0)}px">${spans(r)}</div>`).join('');
    const rows = [...xd.children]; rows.forEach(r => gsap.set(r.children, { autoAlpha: 0 }));
    for (let i = 0; i < 3; i++) {
      line(E.lines[i]); const t = [...rows[i].children];
      await gsap.fromTo(t[0], { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: D(.35), ease: 'back.out(2.5)', onStart: () => sfx('deal') });
      await gsap.fromTo(t.slice(1, 3), { autoAlpha: 0, x: 120 }, { autoAlpha: 1, x: 0, duration: D(.45), stagger: .08, ease: 'back.out(1.6)' });
      await wait(500);
      await gsap.fromTo(t.slice(3), { autoAlpha: 0, scale: 1.5 }, { autoAlpha: 1, scale: 1, duration: D(.35), ease: 'back.out(3)' }); guard(g);
      t[4].classList.add('glow');
      if (i === 2) { sfx('bad'); gsap.fromTo(rows[i], { x: 0 }, { keyframes: { x: [-12, 12, -8, 0] }, duration: .4 }); } else { sfx('good'); t.slice(1, 3).forEach(e => e.classList.add('glow')); }
      await wait(rt(E.lines[i]), true); guard(g);
    }
    await lit(E.lines[3]);
  }
};

/* resolve with the next tap of a kind, or with null after ms */
function tapOrWait(kind, ms) {
  const g = GID;
  return new Promise((res, rej) => {
    let done = false;
    const t = gsap.delayedCall(ms / 1000, () => { done = true; tapRes = null; g === GID ? res(null) : rej(STALE); });
    waitFor(kind).then(e => { if (!done) { t.kill(); res(e); } }, e => { if (!done) { t.kill(); rej(e); } });
  });
}
/* every turn gets its own centre card: last turn's cards slide away, a card is dealt from the draw pile and flips face up */
async function newCentre(text) {
  const g = GID, old = $$('#centre .card');
  if (old.length) { await gsap.to(old, { autoAlpha: 0, scale: .85, y: -30, duration: D(.25), stagger: .05, ease: 'power2.in' }); guard(g); }
  S.centre = null; S.played = null; renderCentre();
  sfx('deal'); await fly(L.pile, L.centre, cardInner('cd-back', null, L.pile.w), { dur: .4, rot: 0 });
  S.centre = { text, p: S.part }; renderCentre(true); await wait(350);
}
/* Sheet5 row 19: no card matches. The draw pile glows; the drawn card joins the options face up */
async function noMatchDraw(text) {
  const g = GID, pile = $('#pile'), hand = $('#hand');
  hand.classList.add('locked'); ost(NOMATCH.ost); pose('flippy', 'oops', 2000); say(NOMATCH.vo, true);
  pile.classList.add('live'); const gk = glowAt(L.pile, 1.5);
  idle(NOMATCH.idle, () => pulse(pile, 2, 1.08), '#pile');
  try { await waitFor('pile'); } finally { idleOff(); gk(); pile.classList.remove('live'); }
  /* the drawn card is the match: it lands in the row (the last place if the row is full) face up and glowing */
  const at = Math.min(S.cards.length, VIS - 1), to = handLayout(Math.min(S.cards.length + 1, VIS)).slots[at];
  sfx('deal'); await fly(L.pile, to, cardInner('cd-back', null, L.pile.w), { dur: .5, rot: 0 });
  S.cards.splice(at, 0, mk(text, { opt: true, correct: true, glow: true })); S.hand = S.cards.length; S.stats.drawn++;
  hand.classList.remove('locked'); renderHand();
  const c = handEl(at); sfx('flip');
  gsap.fromTo(c, { rotationY: 90 }, { rotationY: 0, duration: D(.35), ease: 'back.out(1.6)' });
  sparkles(to.x + to.w / 2, to.y + to.h / 2, 8, 120);
  pose('flippy', 'point', 2400); say(NOMATCH.ok, true); await wait(1400, true); guard(g);
}
/* "After guided selection, draw one penalty card": the pile glows and one card slides into the learner's hand */
async function penaltyDraw() {
  const g = GID, gk = glowAt(L.pile, 1.4); sfx('deal');
  try { await fly(L.pile, drawTarget(), cardInner('cd-back', null, L.pile.w), { dur: .55, rot: 0 }); } finally { gk(); }
  sfx('pop'); S.hand++; S.stats.drawn++; renderHand(); pulse($('#cntYou'), 1, 1.15); await wait(700); guard(g);
}
/* the rule screen animations: Part 3 row 22, Part 4 row 44, Part 5 row 66 */
const DEMOS = {
  /* three number cards appear; brackets group the first two numbers, then shift to the last two */
  async associative(box) {
    const g = GID;
    box.innerHTML = `<div class="dm"><span class="lay la">${spans('(2 + 3) + 5')}</span><span class="lay lb">${spans('2 + (3 + 5)')}</span></div>`;
    const dm = box.firstChild, A_ = [...dm.querySelectorAll('.la .t')], B_ = [...dm.querySelectorAll('.lb .t')];
    B_.forEach(e => e.style.visibility = 'hidden');
    const has = c => A_.filter(e => e.classList.contains(c));
    gsap.set(has('b'), { autoAlpha: 0 });
    await gsap.timeline().from(has('n'), { y: -120, autoAlpha: 0, rotation: -20, stagger: .15, duration: D(.4), ease: 'back.out(1.8)', onStart: () => sfx('deal') })
      .from(has('o'), { scale: 0, autoAlpha: 0, duration: D(.25) })
      .fromTo(has('b'), { autoAlpha: 0, scale: 1.6 }, { autoAlpha: 1, scale: 1, duration: D(.35), ease: 'back.out(2.5)' }, '+=.3'); guard(g);
    await wait(1200, true);
    await morph(dm, A_, B_, { keepA: false, glow: true, dur: 1 }); guard(g); sfx('good');
  },
  /* 3 × (4 + 2): three rows of six blocks form, then split into groups of four and two */
  async distributive(box) {
    const g = GID, S_ = 40, K = 4, GAP = 26;
    let html = `<div class="dd"><div class="dx">${spans('3 × (4 + 2)')}</div><div class="dg">`;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) html += `<i class="blk ${c < K ? 'pa' : 'pb'}" style="left:${c * S_}px;top:${r * S_}px"></i>`;
    html += `<b class="gl" style="left:0;width:${K * S_ - 6}px">4</b><b class="gl" style="left:${K * S_ + GAP}px;width:${2 * S_ - 6}px">2</b></div></div>`;
    box.innerHTML = html;
    const ex = [...box.querySelectorAll('.dx .t')], blk = [...box.querySelectorAll('.blk')], pb = blk.filter(b => b.classList.contains('pb')), gl = [...box.querySelectorAll('.gl')];
    gsap.set([...blk, ...gl], { autoAlpha: 0 });
    await gsap.from(ex, { autoAlpha: 0, y: -30, stagger: .06, duration: D(.3) }); guard(g);
    await gsap.fromTo(blk, { scale: 0 }, { autoAlpha: 1, scale: 1, stagger: .03, duration: D(.22), ease: 'back.out(2.5)', onStart: () => sfx('deal') }); guard(g);
    await wait(900, true);
    sfx('whoosh'); blk.forEach(b => b.classList.add('split'));
    await gsap.to(pb, { x: GAP, duration: D(.5), ease: 'back.out(1.6)' }); guard(g);
    await gsap.to(gl, { autoAlpha: 1, duration: D(.3) }); sfx('good');
  },
  /* the number 8 appears; a +0 card and a ×1 card join it; both show 8 stays 8 */
  async identity(box) {
    const g = GID;
    box.innerHTML = `<div class="di">${['8 + 0 = 8', '8 × 1 = 8'].map(r => `<div class="ir">${spans(r)}</div>`).join('')}</div>`;
    const rows = [...box.querySelectorAll('.ir')].map(r => [...r.children]);
    gsap.set(rows.flat(), { autoAlpha: 0 });
    await gsap.fromTo([rows[0][0], rows[1][0]], { scale: 0 }, { autoAlpha: 1, scale: 1, duration: D(.4), ease: 'back.out(2.5)', onStart: () => sfx('deal') }); guard(g);
    await wait(500);
    for (const t of rows) { await gsap.fromTo(t.slice(1, 3), { x: 90 }, { autoAlpha: 1, x: 0, duration: D(.4), stagger: .08, ease: 'back.out(1.6)' }); guard(g); }
    await wait(400);
    for (const t of rows) { await gsap.fromTo(t.slice(3), { scale: 1.5 }, { autoAlpha: 1, scale: 1, duration: D(.35), ease: 'back.out(3)' }); t[4].classList.add('ok'); sfx('good'); guard(g); }
  }
};
/* "Draw When Stuck": after three misses the draw pile glows; the learner taps it and draws one penalty card */
async function drawStuck() {
  const g = GID, pile = $('#pile'), hand = $('#hand');
  hand.classList.add('locked'); ost(STUCK.ost); sheet('screen-edge-bad', 960, 540, 1920); pose('flippy', 'oops', 2000); say(STUCK.vo, true);
  pile.classList.add('live'); const gk = glowAt(L.pile, 1.5);
  idle(STUCK.idle, () => pulse(pile, 2, 1.08), '#pile');
  try { await waitFor('pile'); } finally { idleOff(); gk(); pile.classList.remove('live'); }
  sfx('deal'); await fly(L.pile, drawTarget(), cardInner('cd-back', null, L.pile.w), { dur: .5, rot: 0 });
  sfx('pop'); S.hand++; S.stats.drawn++; hand.classList.remove('locked'); renderHand(); pulse($('#cntYou'), 1, 1.15); guard(g);
}
async function revealCard(img, text, from) {
  const g = GID, c = document.createElement('div'); c.className = 'flycard';
  c.innerHTML = cardInner('cd-mystery', null, L.big.w); c.style.cssText = `left:${L.big.x}px;top:${L.big.y}px;width:${L.big.w}px;height:${L.big.h}px`;
  $('#fxLayer').appendChild(c);
  const sw = fx('fx-mystery-swirl', L.big.x + L.big.w / 2, L.big.y + L.big.h / 2, 760, { from: .3, to: 1.2, rot: 220, dur: 1.8 });
  sfx('magic');
  await gsap.timeline()
    .from(c, { x: from.x - L.big.x, y: from.y - L.big.y, scale: from.w / L.big.w, duration: D(.4), ease: 'power3.out' })
    .to(c, { keyframes: { rotation: [-6, 6, -4, 4, 0] }, duration: D(.35) })
    .to(c, { rotationY: 90, duration: D(.18), ease: 'power2.in' })
    .add(() => { c.innerHTML = cardInner(img, null, L.big.w) + `<span class="face gold">${text}</span>`; sfx('pop'); })
    .to(c, { rotationY: 0, duration: D(.25), ease: 'back.out(2)' });
  guard(g);
  sparkles(L.big.x + L.big.w / 2, L.big.y + L.big.h / 2, 12, 240);
  await wait(1300, true);
  await gsap.to(c, { scale: .3, autoAlpha: 0, y: 160, duration: D(.35), ease: 'power2.in' }); c.remove(); sw.kill(); guard(g);
}

/* ---------- screens, restart, pause ---------- */
function resetMotion() {
  GID++; const r = tapRes; tapRes = null; if (r) r({ kind: 'stale' }); idleOff(); clearGlow();
  gsap.globalTimeline.getChildren(true, true, true).forEach(t => t.kill());
  gsap.globalTimeline.resume(); paused = false;
  $('#fxLayer').innerHTML = ''; $('#preview')?.remove(); $('#flipPreview')?.remove(); hideGo(); $('#btnFinal').hidden = true; gsap.set('#btnFinal', { clearProps: 'all' });
  gsap.set(['#stamp', '#nudge'], { autoAlpha: 0 }); gsap.set(['#world', '#centre', '#hand', '#bubble', '#roboFan', '#turnTag', '#equation', '#ost', '#cntYou', '#cntCpu'], { clearProps: 'all' });
  $('#scrHint').hidden = true; hintOpen = false;
  $('#hand').classList.remove('locked', 'callfirst'); $('#pile').classList.remove('live'); $('#equation').innerHTML = ''; $('#cpuRow').innerHTML = '';
  try { speechSynthesis.cancel(); } catch (e) { }
}
const SCREENS = ['#scrTitle', '#scrTeach', '#scrExplain', '#scrPause', '#scrWin', '#scrStar', '#scrLose', '#scrHint', '#qa'];
/* table state for jumping straight into a part (tester jumps, Play again) */
function jumpState(p) { fresh(); S.part = p; [S.hand, S.comp] = DEALS[p]; for (let k = 0; k < p; k++) S.done[k] = MATCHES[k]; }
async function boot(p, run) {
  resetMotion(); SCREENS.forEach(s => $(s).hidden = true);
  jumpState(p); renderAll(); breathe(); pose('flippy', 'idle'); pose('robo', 'idle'); ost('');
  await setTurn('learner', true);
  try { await run(); } catch (e) { if (e !== STALE) console.error(e); }
}
/* start a part directly (Play again, tester jumps) */
const startPart = p => boot(p, () => playGame(p));
const jumpHow = () => boot(0, howTo);
/* Part 5 row 72, then Part 6 */
const jumpComplete = () => boot(3, async () => { S.done[3] = MATCHES[3]; S.hand = 1; renderAll(); await STEP.complete(PLAY[3][PLAY[3].length - 1]); await playGame(4); });
const jumpVictory = () => boot(4, () => { S.done = [...MATCHES]; S.hand = 0; renderAll(); return STEP.victory(PLAY[4][PLAY[4].length - 1]); });
const jumpLose = () => boot(1, async () => { S.comp = 1; renderFan(); await cpuLoses(1); });

/* ---------- Sheet6 "Game Completion": the computer plays its last card first ---------- */
async function cpuLoses(n) {
  S.comp -= n; renderFan(); if (S.comp > 0) return;
  idleOff(); S.over = true; S.view = 'wait'; renderHand(); ost('');
  const scr = $('#scrLose'); $('#scrLose h2').textContent = RESULT.lose; $('#scrLose .sub').textContent = RESULT.loseSub;
  scr.hidden = false; pose('robo', 'laugh'); pose('flippy', 'oops'); sfx('bad');
  await gsap.timeline().fromTo(scr, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.4) })
    .fromTo(scr.querySelector('h2'), { scale: 0 }, { scale: 1, duration: D(.5), ease: 'back.out(2)' })
    .fromTo(scr.querySelector('.sub'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: D(.3) })
    .fromTo(scr.querySelector('.lrobo'), { y: 300, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: D(.5), ease: 'back.out(1.6)' }, '<')
    .fromTo('#btnRetry', { scale: 0 }, { scale: 1, duration: D(.35), ease: 'back.out(2.5)' });
  say(RESULT.loseVo, true);
  throw STALE;
}
$('#btnRetry').addEventListener('click', () => { sfx('pop'); startPart(S.part); });

/* ---------- Sheet6 "Hint Icon": the rules for this part and the game rules, over the same turn ---------- */
let hintOpen = false;
const miniCard = (t, p) => `<div class="hcard">${cardInner(frontImg(p), t, 140)}</div>`;
function fillHint() {
  const pan = $('#scrHint .panel'), P = PARTS[S.part], R = S.intro ? RULES.intro : P;
  pan.style.setProperty('--pc', S.intro ? '#FFC83D' : P.color);
  pan.querySelector('.hpn').textContent = S.intro ? RULES.intro.title : P.title;
  const rule = pan.querySelector('.hrule'); rule.hidden = S.intro; rule.innerHTML = S.intro ? '' : P.rule.join('<br>');
  pan.querySelector('.hfind').textContent = R.find;
  pan.querySelector('.hex').innerHTML = miniCard(R.ex[0], S.intro ? 0 : S.part) + '<span class="harr">→</span>' + miniCard(R.ex[1], S.intro ? 0 : S.part);
  pan.querySelector('.hlist').innerHTML = RULES.list.map(t => `<li>${esc(t)}</li>`).join('');
  pan.querySelector('.hspec').innerHTML = RULES.specials.map(([k, t]) => `<div class="hs"><div class="hsc">${actInner(k, 78)}</div><span>${esc(t)}</span></div>`).join('');
}
function openHint() {
  if (!S || S.over || hintOpen || paused || !$('#scrTitle').hidden) return;
  fillHint(); hintOpen = true; paused = true; nudgeOff();
  gsap.globalTimeline.pause(); try { speechSynthesis.pause(); } catch (e) { }
  const h = $('#scrHint'); h.hidden = false; h.style.opacity = 1; h.style.visibility = 'visible';
  setTimeout(() => h.querySelector('.hback').focus(), 50);
}
function closeHint() {
  if (!hintOpen) return; hintOpen = false; paused = false; $('#scrHint').hidden = true;
  gsap.globalTimeline.resume(); try { speechSynthesis.resume(); } catch (e) { }
  tap({ kind: 'hintclose' }); $('#btnHint').focus();
}
$('#btnHint').addEventListener('click', () => { audioInit(); sfx('pop'); tap({ kind: 'hint' }); openHint(); });
$$('#scrHint .hback, #scrHint .hclose').forEach(b => b.addEventListener('click', () => { sfx('pop'); closeHint(); }));

let paused = false;
function openPause() {
  if (!S || S.over || paused || hintOpen || !$('#scrTitle').hidden) return; paused = true; syncOpts();
  gsap.globalTimeline.pause(); try { speechSynthesis.pause(); } catch (e) { }
  const p = $('#scrPause'); p.hidden = false; gsap.set(p, { autoAlpha: 1 });
}
function closePause() { paused = false; $('#scrPause').hidden = true; gsap.globalTimeline.resume(); try { speechSynthesis.resume(); } catch (e) { } }
$('#btnPause').addEventListener('click', () => { audioInit(); sfx('pop'); openPause(); });
$('#btnResume').addEventListener('click', () => { sfx('pop'); closePause(); });
$('#btnRestart').addEventListener('click', () => { startPart(0); });
$('#optSound').addEventListener('change', e => { audioInit(); opts.sound = e.target.checked; sfx('pop'); });
$('#btnAgain').addEventListener('click', () => { sfx('pop'); startPart(0); });
$('#btnHome').addEventListener('click', () => { sfx('pop'); hook(); });
function syncOpts() { ['#optVoice', '#optVoice2'].forEach(s => $(s).checked = opts.voice); $('#optSound').checked = opts.sound; }
['#optVoice', '#optVoice2'].forEach(s => $(s).addEventListener('change', e => { opts.voice = e.target.checked; syncOpts(); if (!opts.voice) try { speechSynthesis.cancel(); } catch (_) { } }));
document.addEventListener('pointerdown', audioInit, { once: true });

/* QA jump menu (press Q) */
const JUMPS = [['Hook', '#555', hook], ['How to play', '#555', jumpHow], ...PARTS.map((q, i) => [`Part ${i + 2} · ${q.name}`, q.color, () => startPart(i)]),
  ['Identity complete', '#555', jumpComplete], ['Victory', '#555', jumpVictory], ['Computer wins', '#555', jumpLose]];
function buildJump(el) {
  el.innerHTML = JUMPS.map(([n, c], i) => `<button style="--pc:${c}" data-j="${i}">${n}</button>`).join('');
  el.onclick = e => { const b = e.target.closest('[data-j]'); if (!b) return; audioInit(); JUMPS[+b.dataset.j][2](); };
}
$$('.jump').forEach(buildJump);
document.addEventListener('keydown', e => {
  if (e.key === 'q' || e.key === 'Q') { const q = $('#qa'); q.hidden = !q.hidden; }
  if (e.key === 'Escape') { if (hintOpen) closeHint(); else if (paused) closePause(); else openPause(); }
});
/* tester deep links: index.html#how, #part2 … #part6, #complete (Identity complete), #victory, #lose (computer wins) */
const deep = { '#how': jumpHow, ...Object.fromEntries(PARTS.map((q, i) => ['#part' + (i + 2), () => startPart(i)])), '#complete': jumpComplete, '#victory': jumpVictory, '#lose': jumpLose }[location.hash];

window.claude?.hot?.snapshot?.(() => ({}));
window.NF_DEBUG = { get S() { return S; }, tap, eqShow, eqOf };

if (deep) deep(); else hook();
})();
