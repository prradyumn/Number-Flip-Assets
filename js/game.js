/* Number Flip — game flow, rendering and motion (GSAP). Content lives in js/content.js. */
(() => {
'use strict';
const { PHASES, SCRIPT, GEN, LEARNER_EVENTS, ROBO_EVENTS, ACTIONS, LINES, util: { ri, shuffle, ev } } = window.NF_CONTENT;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const A = p => `assets/${p}.webp`;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pick = a => a[Math.floor(Math.random() * a.length)];

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
  ...['idle', 'thinking', 'playing', 'laughing', 'dizzy', 'last-card', 'sad'].map(p => 'characters/ch-robo-' + p),
  ...PHASES.map(p => 'cards/cd-front-' + p.key), 'cards/cd-back', 'cards/cd-flip', 'cards/cd-skip', 'cards/cd-reverse', 'cards/cd-swap-hands', 'cards/cd-mystery',
  'cards/cd-mystery-reveal-commutative', 'cards/cd-mystery-reveal-associative', 'cards/cd-mystery-reveal-distributive',
  'fx/fx-star-burst', 'fx/fx-hint-glow', 'fx/fx-card-glow', 'fx/fx-skip-smoke', 'fx/fx-reverse-arrows', 'fx/fx-mystery-swirl', 'fx/fx-card-trail', 'fx/fx-confetti', 'fx/fx-win-rays',
  ...['robo', 'flippy'].flatMap(w => ['grip-back', 'grip-front-fingers', 'open', 'release', 'ext'].map(k => `hands/arm-${w}-${k}`).concat(`characters/body-${w}-throw`)), 'bg/bg-victory', 'ui/ui-trophy', 'ui/ui-icon-check', 'ui/ui-icon-draw-two', 'ui/ui-icon-sound-off'];
PRELOAD.forEach(p => { const i = new Image(); i.src = A(p); });

/* ---------- time: every wait is a GSAP delayed call, so Pause freezes the whole game ---------- */
let GID = 0;
const STALE = 'stale';
const wait = ms => { const g = GID; return new Promise((res, rej) => gsap.delayedCall((RM ? Math.min(ms, 350) : ms) / 1000, () => g === GID ? res() : rej(STALE))); };
const guard = g => { if (g !== GID) throw STALE; };
const D = s => RM ? Math.min(s, .12) : s;

/* ---------- sound: small Web Audio synth (swap for recorded SFX later) ---------- */
const opts = { sound: true, voice: false, challenge: false };
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
/* HTMLAudio (not fetch/decodeAudioData) so the game also works when index.html is opened straight from disk */
const abuf = {}; let aload = false;
function loadAudio() {
  if (aload) return; aload = true;
  const ext = document.createElement('audio').canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'mp3';
  [...new Set(Object.values(AUDIO).map(a => a[0]))].forEach(n => { const a = new Audio(`assets/audio/${n}.${ext}`); a.preload = 'auto'; abuf[n] = a; });
}
loadAudio();
function sfx(k) {
  if (!opts.sound) return; const a = AUDIO[k];
  if (a && abuf[a[0]]) { try { const n = abuf[a[0]].cloneNode(); n.volume = a[1]; n.playbackRate = a[2] || 1; n.preservesPitch = false; n.play().catch(() => { }); } catch (e) { } return; }
  if (!actx) return; const t = actx.currentTime;
  switch (k) {
    case 'deal': swish(t, .16, .1, 3200); break;
    case 'flip': swish(t, .1, .12, 4200); tone(1200, t + .03, .05, 'square', .02); break;
    case 'good': [660, 880, 1320].forEach((f, i) => tone(f, t + i * .08, .22, 'triangle', .13)); break;
    case 'bad': tone(240, t, .22, 'sine', .16, 170); tone(200, t + .12, .25, 'sine', .12, 150); break;
    case 'stamp': tone(110, t, .18, 'sine', .3, 60); swish(t, .12, .16, 900); tone(520, t + .1, .16, 'triangle', .06, 760); break;
    case 'whoosh': swish(t, .5, .14, 1400); break;
    case 'magic': [988, 1175, 1480, 1976].forEach((f, i) => tone(f, t + i * .07, .3, 'sine', .07)); break;
    case 'pop': tone(700, t, .08, 'sine', .1, 1100); break;
    case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * .12, .4, 'triangle', .12)); break;
    case 'robo': [420, 640, 520].forEach((f, i) => tone(f, t + i * .06, .07, 'square', .03)); break;
  }
}
function speak(text, who) {
  if (!opts.voice || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/×/g, ' times ').replace(/___/g, ' blank ').replace(/−/g, ' minus '));
    const vs = speechSynthesis.getVoices(); const v = vs.find(v => /en-IN/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)); if (v) u.voice = v;
    u.rate = 1.04; u.pitch = who === 'robo' ? .7 : 1.2; speechSynthesis.speak(u);
  } catch (e) { }
}

/* ---------- characters ---------- */
const POSES = {
  flippy: { idle: 'idle', talk: 'talking', cheer: 'cheering', point: 'pointing', think: 'thinking', oops: 'oops' },
  robo: { idle: 'idle', think: 'thinking', play: 'playing', laugh: 'laughing', dizzy: 'dizzy', last: 'last-card', sad: 'sad' }
};
const poseTok = { flippy: 0, robo: 0 };
function pose(who, name, holdMs) {
  const el = $('#' + who), tok = ++poseTok[who];
  el.src = A(`characters/ch-${who}-${POSES[who][name]}`);
  gsap.fromTo(el, { scaleY: .9, scaleX: 1.06 }, { scaleY: 1, scaleX: 1, duration: D(.45), ease: 'elastic.out(1,.45)', overwrite: 'auto' });
  if (holdMs) gsap.delayedCall(holdMs / 1000, () => { if (poseTok[who] === tok) pose(who, restPose(who)); });
}
const restPose = who => (who === 'robo' && S && S.comp === 1 && !S.over) ? 'last' : 'idle';
function breathe() {
  gsap.to('#flippyWrap', { scaleY: 1.025, y: -3, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '50% 100%' });
  gsap.to('#roboWrap', { y: -6, duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
}
function say(text, who = 'flippy', holdPose) {
  if (who === 'robo') {
    const b = $('#roboBubble'); b.querySelector('p').innerHTML = text.split(' ').map(w => `<span class="w ${tokClass(w)}">${esc(w)}</span>`).join(' ');
    gsap.killTweensOf(b);
    gsap.timeline().fromTo(b, { autoAlpha: 0, scale: .7 }, { autoAlpha: 1, scale: 1, duration: D(.3), ease: 'back.out(2.2)' }).to(b, { autoAlpha: 0, duration: .25, delay: 2.6 });
    sfx('robo');
  } else {
    const p = $('#bubbleText'), words = text.split(' '); p.style.fontSize = text.length > 105 ? '25px' : text.length > 78 ? '28px' : '';
    p.innerHTML = words.map(w => `<span class="w ${tokClass(w)}">${esc(w)}</span>`).join(' ');
    gsap.fromTo('#bubble', { scale: .92, autoAlpha: .4 }, { scale: 1, autoAlpha: 1, duration: D(.35), ease: 'back.out(2.4)', overwrite: true });
    if (!RM) gsap.from(p.querySelectorAll('.w'), { autoAlpha: 0, y: 10, duration: .22, stagger: Math.min(.045, 1.1 / words.length), ease: 'power2.out' });
    if (!holdPose) pose('flippy', 'talk', Math.min(2600, 400 + text.length * 32));
  }
  speak(text, who);
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tokClass = w => /\d|^[+×=−]$|^\(|\)$|___/.test(w) ? 'm' : (/^[A-Z][A-Z!'’]{2,}[!.,]?$/.test(w) && w !== 'I' ? 'k' : '');

/* ---------- layout (stage px) ---------- */
const L = {
  pile: { x: 605, y: 468, w: 210, h: 298 },
  centre: { x: 855, y: 468, w: 210, h: 298 },
  played: { x: 1105, y: 468, w: 210, h: 298 },
  hand: { cx: 830, y: 790, w: 176, h: 250, gap: 32 },
  stack: { x: 1160, y: 846, w: 136, h: 194 },
  act: { x: 1360, y: 846, w: 136, h: 194, step: 90 },
  fan: { x: 1282, y: 372, w: 96, h: 136 },
  big: { x: 820, y: 250, w: 280, h: 398 }
};
const rectOf = el => { let x = 0, y = 0, e = el; while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
const frontImg = p => 'cd-front-' + PHASES[Math.min(p, 4)].key;
const revealImg = p => 'cd-mystery-reveal-' + ['commutative', 'associative', 'distributive'][p % 3];
function fs(t, w) { const L2 = t.replace(/<[^>]+>/g, '').length; const k = L2 <= 3 ? .34 : L2 <= 6 ? .25 : L2 <= 9 ? .185 : L2 <= 13 ? .15 : .13; return Math.round(w * k); }
function fmt(t) { let s = t; if (s.length > 13) s = s.replace(') + (', ')<br>+ (').replace(') × (', ')<br>× ('); return s.replace(/___/g, '<span class="blank"></span>'); }
function cardInner(img, text, w) { return `<img src="${A('cards/' + img)}" alt="" draggable="false">${text != null ? `<span class="face" style="font-size:${fs(text, w)}px">${fmt(text)}</span>` : ''}`; }
function place(el, r, rot = 0) { el.style.left = r.x + 'px'; el.style.top = r.y + 'px'; el.style.width = r.w + 'px'; el.style.height = r.h + 'px'; gsap.set(el, { rotation: rot }); }

/* ---------- effects ---------- */
function fx(name, cx, cy, size, vars = {}) {
  const im = document.createElement('img'); im.className = 'fx'; im.src = A('fx/' + name); im.alt = '';
  im.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`;
  $('#fxLayer').appendChild(im);
  const r0 = vars.r0 ?? 0; const t = gsap.fromTo(im, { scale: vars.from ?? .3, autoAlpha: 1, rotation: r0 }, { scale: vars.to ?? 1.2, rotation: r0 + (vars.rot ?? 30), autoAlpha: 0, duration: D(vars.dur ?? .9), ease: vars.ease ?? 'power2.out', onComplete: () => im.remove() });
  return t;
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
const SHEET = { 'throw-trail': [4, 2, 8, 24, 512, 512], 'impact-ring': [4, 2, 8, 24, 512, 512], 'star-fly': [4, 2, 8, 24, 512, 512], 'level-up-burst': [4, 3, 12, 30, 512, 512],
  confetti: [4, 2, 8, 20, 512, 512], 'screen-edge-good': [3, 2, 6, 24, 1920, 1080], 'screen-edge-bad': [3, 2, 6, 24, 1920, 1080] };
function sheet(name, cx, cy, size, { rot = 0 } = {}) {
  if (RM) return Promise.resolve();
  const [cols, rows, n, fps, fw, fh] = SHEET[name], el = document.createElement('div'), w = size, h = size * fh / fw, P = { f: 0 };
  el.className = 'fx sheet'; el.style.cssText = `left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;background-image:url(${A('effects/' + name + '-sheet')});background-size:${cols * 100}% ${rows * 100}%;transform:rotate(${rot}deg)`;
  $('#fxLayer').appendChild(el);
  const set = i => { el.style.backgroundPosition = `${cols > 1 ? (i % cols) * 100 / (cols - 1) : 0}% ${rows > 1 ? Math.floor(i / cols) * 100 / (rows - 1) : 0}%`; }; set(0);
  return gsap.to(P, { f: n - 1, duration: n / fps, ease: 'none', onUpdate: () => set(Math.round(P.f)), onComplete: () => el.remove() });
}

/* Throwing rig. The character swaps to its throw-pose body (arm removed at the shoulder socket) and a stretchy arm slides out of the socket,
   aims at the target, winds up and releases the card. Art: 1100 x 420 arm, wrist at (700,210), card pinched at the grip rect; facing right.
   The arm is mirrored for Robo (who throws from the right). A plain slice of the forearm is stretched to reach any distance. */
const ARM = { w: 1100, h: 420, wx: 700, wy: 210, card: { x: 850, y: 65, w: 165, h: 235, rot: -8 } };
const BODY = { flippy: { w: 478, h: 700, sx: 427, sy: 278, mirror: false, wrap: '#flippyWrap', img: '#flippy' }, robo: { w: 362, h: 700, sx: 255, sy: 322, mirror: true, wrap: '#roboWrap', img: '#robo' } };
async function handThrow(who, html, to) {
  const g = GID, B = BODY[who], mir = B.mirror, side = mir ? -1 : 1, layer = $('#fxLayer');
  const T = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  /* the throwing body, drawn over the arm so the arm appears to come out of the shoulder */
  const wr = rectOf($(B.wrap)), sc = wr.h / B.h, bw = B.w * sc, bl = wr.x + (wr.w - bw) / 2;
  const S0 = { x: bl + (mir ? B.w - B.sx : B.sx) * sc, y: wr.y + B.sy * sc };
  /* the arm leaves the shoulder at a natural diagonal (never straight down), reaches a hold point, then the card is thrown the rest of the way */
  const cOff = { x: ARM.card.x + ARM.card.w / 2 - ARM.wx, y: ARM.card.y + ARM.card.h / 2 - ARM.wy };
  const norm = v => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
  const toT = { x: T.x - S0.x, y: T.y - S0.y }, a0 = Math.max(-.35, Math.min(.9, Math.atan2(toT.y, Math.abs(toT.x) + 1)));
  let u = { x: Math.cos(a0) * side, y: Math.sin(a0) }, n = { x: -u.y * (mir ? -1 : 1), y: u.x * (mir ? -1 : 1) };
  const reach = Math.max(620, Math.min(900, Math.hypot(toT.x, toT.y) * .72)), Hc = { x: S0.x + u.x * reach, y: S0.y + u.y * reach };
  const Wp = { x: Hc.x - cOff.x * u.x - cOff.y * n.x, y: Hc.y - cOff.x * u.y - cOff.y * n.y };
  u = norm({ x: Wp.x - S0.x, y: Wp.y - S0.y }); n = { x: -u.y * (mir ? -1 : 1), y: u.x * (mir ? -1 : 1) };
  const inset = 40, S = { x: S0.x - u.x * inset, y: S0.y - u.y * inset }, Dist = Math.hypot(Wp.x - S0.x, Wp.y - S0.y) + inset;
  const ang = Math.atan2(u.y, mir ? -u.x : u.x) * 180 / Math.PI, rot0 = mir ? -ang : ang;
  const clip = document.createElement('div'); clip.className = 'armclip'; clip.style.cssText = `left:${S.x}px;top:${S.y - ARM.wy}px`;
  const rig = document.createElement('div'); rig.className = 'armrig'; rig.style.left = -ARM.wx + 'px';
  const im = k => `<img class="hl" src="${A('hands/arm-' + who + '-' + k)}" alt="">`;
  rig.innerHTML = `<div class="armext" style="background-image:url(${A('hands/arm-' + who + '-ext')})"></div>${im('grip-back')}<div class="flycard hcard" style="left:${ARM.card.x}px;top:${ARM.card.y}px;width:${ARM.card.w}px;height:${ARM.card.h}px;transform:rotate(${ARM.card.rot}deg) scaleX(${side})">${html}</div>${im('grip-front-fingers')}`;
  clip.appendChild(rig); layer.appendChild(clip);
  const body = document.createElement('img'); body.className = 'fxbody'; body.src = A(`characters/body-${who}-throw`); body.alt = '';
  body.style.cssText = `left:${bl}px;top:${wr.y}px;width:${bw}px;height:${wr.h}px${mir ? ';transform:scaleX(-1)' : ''}`; layer.appendChild(body);
  /* shoulder joint: a round cap over the socket hides the arm's cut end and makes the arm look attached */
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
  guard(g);
  /* release: the card leaves the fingers, the hand opens, the arm slides back into the shoulder */
  const card = rig.querySelector('.hcard'), r = card.getBoundingClientRect(), sr = stage.getBoundingClientRect(), k = sr.width / 1920;
  const mx = (r.left + r.width / 2 - sr.left) / k, my = (r.top + r.height / 2 - sr.top) / k, rd = gsap.getProperty(clip, 'rotation') + (mir ? 0 : 0);
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
function confetti(n = 70) {
  const cols = ['#2F7CF6', '#13A46B', '#F06A2B', '#8B5CF6', '#E8384F', '#FFC83D'];
  for (let i = 0; i < (RM ? 0 : n); i++) {
    const d = document.createElement('div'); const s = ri(12, 22);
    d.style.cssText = `position:absolute;left:${960 + ri(-80, 80)}px;top:${420 + ri(-40, 40)}px;width:${s}px;height:${s * .55}px;background:${pick(cols)};border-radius:3px;pointer-events:none`;
    $('#fxLayer').appendChild(d);
    gsap.to(d, { x: ri(-900, 900), y: ri(-420, -120), rotation: ri(-360, 360), duration: .7, ease: 'power2.out' });
    gsap.to(d, { y: '+=' + ri(700, 1000), rotation: '+=' + ri(180, 720), duration: ri(16, 26) / 10, delay: .7, ease: 'power1.in', onComplete: () => d.remove() });
  }
}

/* ---------- state ---------- */
let S = null, pending = null, useScript = true;
function fresh(phase = 0) {
  S = { phase, matches: 0, expr: 5, actions: [], comp: 5, turn: 'learner', ch: null, wrong: 0, hint: false, mode: null, called: false, over: false,
    busy: false, verdict: false, skipRobo: false, fired: {}, pairs: [[], [], [], []], centre: null, played: null, eq: null, idleDone: false,
    stats: { correct: 0, wrong: 0, drawn: 0, caught: 0, stars: 0, start: Date.now() },
    xp: 0, streak: 0, bestStreak: 0, hintsUsed: 0, peak: 5, roundWrong: 0, roundStars: [], perfectRounds: 0, tapLock: 0, lastAction: false };
  if (phase === 4) { S.expr = 3; S.comp = 2; }
}
const handTotal = () => S.expr + S.actions.length;
function makeCh(forRobo) {
  const p = S.phase < 4 ? S.phase : ri(0, 3);
  const ch = (!forRobo && useScript && S.phase < 4 && S.matches < 4) ? { ...SCRIPT[p][S.matches] } : (p === 3 ? GEN[3](forRobo) : GEN[p]());
  ch.p = p;
  ch.order = shuffle([...ch.rights.map(t => ({ text: t, correct: true })), ...ch.wrongs.map(t => ({ text: t, correct: false }))]);
  return ch;
}
function visibleOptions() {
  const ch = S.ch; if (!ch) return []; const n = Math.min(3, S.expr); if (n <= 0) return [];
  const first = ch.order.find(o => o.correct), rest = ch.order.filter(o => o !== first);
  const keep = [first, ...rest.slice(0, n - 1)]; return ch.order.filter(o => keep.includes(o));
}
function explain(ch, o) {
  const c = ch.centre, right = ch.rights[0];
  if (c.includes('___')) { const e = c.replace('___', o.text); return `${e} = ${ev(e)}, not ${ch.target}.`; }
  if (c.includes('= ?')) { const l = c.replace('= ?', '').trim(); return `${l} = ${ev(l)}, not ${o.text}.`; }
  if (/^[+×]/.test(o.text)) { const e = `${c} ${o.text}`; return `${e} = ${ev(e)}. That changes ${c}.`; }
  const a = ev(c), b = ev(o.text), same = a !== null && b !== null && a === b;
  const vals = a === null || b === null ? '' : same ? `${o.text} also makes ${b}, but ` : `${o.text} makes ${b}, but ${c} makes ${a}. `;
  if (ch.p === 0) return same ? `${vals}that is not a swap. A swap keeps the SAME two numbers: ${c} → ${right}.` : `${vals}A swap keeps the same two numbers and the same sign, only their order changes.`;
  if (ch.p === 1) return same ? `${vals}the numbers changed. Only the brackets may move: ${c} → ${right}.` : `${vals}Only the brackets move. Keep the same numbers and signs.`;
  if (ch.p === 2) { const m = c.match(/^(\d+) × \((\d+) \+ (\d+)\)$/); return m ? `${vals}${m[1]} must multiply BOTH parts: ${m[1]} × ${m[2]} and ${m[1]} × ${m[3]}.` : vals; }
  return vals;
}
/* what a robo "cheat" looks like on the equation line (a same-value cheat is not a swap, so never write ≠ between equal values) */
function notMatchLine(ch, card) { const a = ev(ch.centre), b = ev(card); return a !== null && a === b ? `${card} is not a ${ch.p === 0 ? 'swap' : 'regroup'} of ${ch.centre}` : `${ch.centre} ≠ ${card}`; }

/* ---------- rendering ---------- */
function renderProgress() {
  const el = $('#progress'); if (!el) return; el.innerHTML = '';
  PHASES.forEach((p, i) => {
    const now = i === S.phase, done = i < S.phase;
    const c = document.createElement('div'); c.className = `chip ${now ? 'now' : ''} ${done ? 'done' : ''}`;
    c.innerHTML = `<img class="ic" src="${A(i < 4 ? 'rewards/medal-' + p.key + (done || now ? '-unlocked' : '-locked') : 'ui/ui-icon-star')}" alt="${p.name}">` +
      (i < 4 ? `<span class="dots">${[0, 1, 2, 3].map(d => `<i class="${done || (now && d < S.matches) ? 'on' : ''}"></i>`).join('')}</span>` : `<span class="lbl">${p.short}</span>`);
    el.appendChild(c);
    if (now) gsap.fromTo(c, { scale: 1 }, { scale: 1.14, duration: D(.4), ease: 'back.out(3)' });
  });
}
function renderFan() {
  const f = $('#roboFan'), n = Math.min(S.comp, 8); f.innerHTML = '';
  for (let i = 0; i < n; i++) { const im = document.createElement('img'); im.src = A('cards/cd-back'); im.alt = ''; f.appendChild(im); gsap.set(im, { rotation: (i - (n - 1) / 2) * 9, x: (i - (n - 1) / 2) * 18 }); }
  const b = $('#roboCount'); b.querySelector('b').textContent = S.comp; b.querySelector('small').textContent = S.comp === 1 ? 'card' : 'cards';
  b.classList.toggle('warn', S.comp <= 2); $('#avRobo .av-n').textContent = S.comp;
}
function renderCentre(flipIn = false) {
  const box = $('#centre'); box.innerHTML = '';
  $('#slotPlay').style.display = S.played ? 'none' : '';
  if (!S.centre) return;
  const c = document.createElement('div'); c.className = 'card'; c.id = 'centreCard'; c.innerHTML = cardInner(frontImg(S.centre.p), S.centre.text, L.centre.w); place(c, L.centre); box.appendChild(c);
  if (S.centre.sub) { const s = document.createElement('div'); s.className = 'centre-sub'; s.textContent = S.centre.sub; s.style.cssText = `left:${L.centre.x - 40}px;top:${L.centre.y + L.centre.h + 4}px;width:${L.centre.w + 80}px`; box.appendChild(s); }
  if (S.played) {
    const pc = document.createElement('div'); pc.className = 'card'; pc.id = 'playedCard';
    pc.innerHTML = S.played.act ? cardInner(ACTIONS[S.played.act].img, null, L.played.w) : cardInner(frontImg(S.played.p), S.played.text, L.played.w);
    place(pc, L.played, 3); box.appendChild(pc);
  }
  if (flipIn) { sfx('flip'); gsap.fromTo(c, { rotationY: 90, y: -20 }, { rotationY: 0, y: 0, duration: D(.45), ease: 'back.out(1.6)' }); }
}
function renderEq() {
  const e = $('#equation'), l = e.querySelector('.eq-line'), v = e.querySelector('.eq-val');
  if (!S.eq) { l.textContent = ''; v.textContent = ''; return; }
  l.textContent = S.eq.line; l.classList.toggle('bad', !!S.eq.bad); v.textContent = S.eq.val || '';
  gsap.fromTo(e, { scale: .6, autoAlpha: 0, transformOrigin: '0% 50%' }, { scale: 1, autoAlpha: 1, duration: D(.45), ease: 'back.out(1.8)' });
}
function renderTurn() {
  const t = $('#turnChip'), me = S.turn === 'learner';
  t.textContent = S.over ? '' : me ? 'YOUR TURN' : "ROBO'S TURN"; t.classList.toggle('me', me);
  t.hidden = S.over; renderArrow();
}
let hintFx = [];
function clearHint() { hintFx.forEach(t => t.kill()); hintFx = []; $$('#fxLayer .hintglow').forEach(e => e.remove()); }
function renderHand({ deal = false } = {}) {
  clearHint();
  const h = $('#hand'); h.innerHTML = '';
  const myTurn = S.turn === 'learner' && !S.over && !S.verdict;
  $('#handCount').textContent = handTotal(); $('#avFlippy .av-n').textContent = handTotal(); S.peak = Math.max(S.peak || 0, handTotal());
  const vis = myTurn ? visibleOptions() : [];
  const n = myTurn ? vis.length : (S.verdict ? 0 : Math.min(3, S.expr));
  const W = L.hand.w, total = n ? n * W + (n - 1) * L.hand.gap : 0, x0 = L.hand.cx - total / 2;
  L.stack.x = Math.max(x0 + total + 28, 640); $('#pocket').style.display = S.actions.length ? 'block' : 'none';
  const cards = [];
  for (let i = 0; i < n; i++) {
    const r = { x: x0 + i * (W + L.hand.gap), y: L.hand.y, w: W, h: L.hand.h };
    const rot = n > 1 ? (i - (n - 1) / 2) * 2 : 0;
    const b = document.createElement('button'); b.className = 'card' + (myTurn ? ' playable' : ' waiting');
    if (myTurn) {
      const o = vis[i]; b.dataset.opt = i; b.setAttribute('aria-label', 'Play ' + o.text.replace(/___/g, 'blank'));
      b.innerHTML = `<span class="lift">${cardInner(frontImg(S.ch.p), o.text, W)}</span>`;
      if (o.correct && S.mode !== 'drop' && (S.hint || (useScript && S.phase < 4 && S.matches === 0))) b.dataset.glow = '1';
    } else { b.disabled = true; b.innerHTML = `<span class="lift">${cardInner('cd-back', null, W)}</span>`; }
    place(b, r, rot); h.appendChild(b); cards.push(b);
  }
  const stack = Math.max(0, S.expr - n);
  if (stack) {
    const s = document.createElement('button'); s.className = 'card'; s.dataset.stack = '1'; s.setAttribute('aria-label', stack + ' more number cards');
    s.innerHTML = `<span class="lift">${cardInner('cd-back', null, L.stack.w)}<span class="plus">+${stack}</span></span>`; place(s, L.stack, 0); h.appendChild(s); cards.push(s);
  }
  S.actions.forEach((a, i) => {
    const b = document.createElement('button'); b.className = 'card' + (myTurn ? ' playable' : ' waiting'); b.dataset.act = i; b.disabled = !myTurn;
    b.setAttribute('aria-label', 'Play ' + ACTIONS[a.type].label);
    b.innerHTML = `<span class="lift">${cardInner(ACTIONS[a.type].img, null, L.act.w)}</span><span class="act-lbl">${ACTIONS[a.type].label}</span>`;
    place(b, { x: L.act.x + i * L.act.step, y: L.act.y, w: L.act.w, h: L.act.h }, i * 2); h.appendChild(b); cards.push(b);
    if (a.glow && myTurn) b.dataset.glow = '1';
  });
  if (deal && cards.length) { sfx('deal'); gsap.from(cards, { y: 140, autoAlpha: 0, rotation: '-=12', duration: D(.45), stagger: .07, ease: 'back.out(1.5)' }); }
  hintFx.push(gsap.delayedCall(deal ? .5 : 0, () => {
    $$('#hand [data-glow]').forEach(b => {
      const r = rectOf(b), im = document.createElement('img'); im.className = 'fx hintglow'; im.src = A('fx/fx-hint-glow'); im.alt = '';
      const s = r.h * 1.5; im.style.cssText = `left:${r.x + r.w / 2 - s / 2}px;top:${r.y + r.h / 2 - s / 2}px;width:${s}px;height:${s}px`;
      $('#fxLayer').appendChild(im);
      hintFx.push(gsap.fromTo(im, { autoAlpha: .55, scale: .95 }, { autoAlpha: 1, scale: 1.05, duration: .8, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    });
  }));
  renderLast(); renderLabel();
}
function renderLast() {
  const b = $('#btnLast'), show = S.turn === 'learner' && !S.over && !S.busy && handTotal() === 1 && !S.called;
  if (show && b.hidden) { b.hidden = false; gsap.fromTo(b, { scale: 0 }, { scale: 1, duration: D(.4), ease: 'back.out(2.5)' }); gsap.to(b, { scale: 1.08, duration: .55, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: .4 }); }
  if (!show && !b.hidden) { gsap.killTweensOf(b); b.hidden = true; }
}
function renderAll() { renderProgress(); renderFan(); renderCentre(); renderEq(); renderTurn(); renderHand(); updateTint(false); renderHud(false); }
function updateTint(animate = true) {
  const c = PHASES[Math.min(S.phase, 4)].color;
  gsap.to('#tint', { background: `radial-gradient(closest-side, ${c}, transparent)`, duration: animate ? D(.6) : 0 });
}

/* ---------- gamification: XP, rank, streak, stars, hint ---------- */
const RANKS = [{ k: 'bronze', at: 0 }, { k: 'silver', at: 90 }, { k: 'gold', at: 200 }, { k: 'diamond', at: 340 }];
const rankOf = xp => RANKS.reduce((r, x, i) => xp >= x.at ? i : r, 0);
const mult = () => S.streak >= 5 ? 3 : S.streak >= 3 ? 2 : 1;
let lastStreak = 0;
function renderHud(anim = true) {
  const r = rankOf(S.xp), lo = RANKS[r].at, hi = RANKS[r + 1] ? RANKS[r + 1].at : null, f = hi ? (S.xp - lo) / (hi - lo) : 1;
  $('#rankImg').src = A('rewards/rank-' + RANKS[r].k);
  gsap.to('#xp .xp-clip', { width: 605 * Math.max(0, Math.min(1, f)), duration: anim ? D(.6) : 0, ease: 'power2.out', overwrite: true,
    onUpdate: () => { const cw = gsap.getProperty('#xp .xp-clip', 'width'); gsap.set('#xp .xp-tip', { left: 17 + cw - 48, autoAlpha: cw > 8 && cw < 596 ? .9 : 0 }); } });
  $('#xpText').textContent = hi ? `${S.xp} / ${hi} XP` : `${S.xp} XP`;
  const on = S.streak >= 2, st = $('#streak'); st.querySelector('b').innerHTML = S.streak + (mult() > 1 ? `<small>×${mult()}</small>` : '');
  gsap.to(st, { autoAlpha: on ? 1 : 0, duration: .25, overwrite: 'auto' });
  if (on && S.streak > lastStreak) gsap.fromTo(st, { scale: 1.5 }, { scale: 1, duration: D(.45), ease: 'back.out(3)' });
  lastStreak = S.streak;
}
function badge(kind, cx, cy, size = 150, hold = .7) {
  const im = document.createElement('img'); im.className = 'fxicon'; im.src = A('feedback/feedback-' + kind); im.alt = '';
  im.style.cssText = `left:${cx - size / 2}px;top:${cy - size / 2}px;width:${size}px;height:${size}px`; $('#fxLayer').appendChild(im);
  gsap.timeline().fromTo(im, { scale: 0, rotation: -25 }, { scale: 1, rotation: 0, duration: D(.35), ease: 'back.out(3)' }).to(im, { autoAlpha: 0, y: -24, duration: D(.3), delay: hold, onComplete: () => im.remove() });
}
function awardXp(n, pt = { x: 960, y: 450 }) {
  const before = rankOf(S.xp); S.xp += n;
  const t = document.createElement('div'); t.className = 'floaty'; t.textContent = `+${n} XP`; t.style.cssText = `left:${pt.x - 70}px;top:${pt.y - 40}px`; $('#fxLayer').appendChild(t);
  gsap.timeline().fromTo(t, { scale: .4, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: D(.3), ease: 'back.out(3)' }).to(t, { y: -80, autoAlpha: 0, duration: D(.5), delay: .45, onComplete: () => t.remove() });
  if (!RM) for (let i = 0; i < Math.min(6, 2 + n / 6 | 0); i++) {
    const st = document.createElement('img'); st.className = 'fxstar'; st.src = A('effects/star-particle'); st.alt = ''; st.style.cssText = `left:${pt.x - 22}px;top:${pt.y - 22}px`; $('#fxLayer').appendChild(st);
    gsap.timeline({ delay: .12 + i * .07 }).to(st, { x: ri(-90, 90), y: ri(-110, -30), duration: .3, ease: 'power2.out' }).to(st, { x: 1000 - pt.x, y: 62 - pt.y, scale: .5, duration: .55, ease: 'power2.in' })
      .add(() => { sfx('star'); gsap.fromTo('#xp', { scale: 1.05 }, { scale: 1, duration: .25 }); }).to(st, { autoAlpha: 0, duration: .1, onComplete: () => st.remove() });
  }
  gsap.delayedCall(.45, () => { if (S) renderHud(); });
  if (rankOf(S.xp) > before) gsap.delayedCall(.9, () => { if (S && !S.over) rankUp(); });
}
async function rankUp() {
  const r = rankOf(S.xp); sfx('levelup'); sheet('level-up-burst', 612, 58, 560); sheet('screen-edge-good', 960, 540, 1920);
  gsap.timeline().set('#rankRibbon', { autoAlpha: 1 }).fromTo('#rankRibbon', { scale: 0, y: -20 }, { scale: 1, y: 0, duration: D(.45), ease: 'back.out(3)' }).to('#rankRibbon', { autoAlpha: 0, y: 14, duration: D(.3), delay: 2 });
  gsap.fromTo('#rankImg', { scale: 1.6, rotation: -12 }, { scale: 1, rotation: 0, duration: D(.7), ease: 'elastic.out(1,.5)' });
  say(`Rank up! You are ${RANKS[r].k.toUpperCase()} now!`, 'flippy');
}
function multBurst() {
  const el = document.createElement('div'); el.className = 'multburst'; el.innerHTML = `<img src="${A('rewards/streak-multiplier-burst')}" alt=""><b>×${mult()} XP</b>`; $('#fxLayer').appendChild(el);
  sfx('streak'); gsap.timeline().fromTo(el, { scale: 0, rotation: -15 }, { scale: 1, rotation: 0, duration: D(.4), ease: 'back.out(3)' }).to(el, { autoAlpha: 0, scale: 1.2, duration: D(.3), delay: 1.0, onComplete: () => el.remove() });
}
/* called on every correct match */
function reward() {
  const m = mult(), pt = { x: L.played.x + L.played.w / 2, y: L.played.y + 60 };
  badge('correct', L.played.x + L.played.w - 20, L.played.y + 30, 130); sheet('impact-ring', pt.x, pt.y + 60, 420);
  if (S.streak === 3 || S.streak === 5) multBurst();
  awardXp(5 * m, pt); renderHud();
}
function renderLabel() {
  const show = S.turn === 'learner' && S.ch && !S.busy && !S.over && !S.verdict && S.mode !== 'drop';
  $('#matchLabel').style.visibility = show ? 'visible' : 'hidden';
  const b = $('#btnHint'); b.disabled = !show; b.querySelector('img').src = A('feedback/hint-lightbulb' + (S.hint ? '-glowing' : ''));
}
function renderArrow() {
  const a = $('#turnArrow'); if (!S || S.over) { a.style.display = 'none'; return; }
  const av = $(S.turn === 'learner' ? '#avFlippy' : '#avRobo'); a.style.display = '';
  a.style.left = av.offsetLeft + av.offsetWidth / 2 - 32 + 'px'; a.style.top = av.offsetTop - 62 + 'px';
  gsap.killTweensOf(a); gsap.fromTo(a, { y: 0 }, { y: 10, duration: .5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
}

/* ---------- input ---------- */
const waitInput = () => new Promise(r => pending = r);
function resolveInput(v) { const p = pending; pending = null; if (p) p(v); }
let idleCall = null;
function armIdle() {
  disarmIdle(); if (S.idleDone) return;
  idleCall = gsap.delayedCall(10, () => { if (S.turn === 'learner' && !S.busy && !S.over) { S.idleDone = true; pose('flippy', 'think', 3200); say(pick(LINES.idle), 'flippy', true); } });
}
function disarmIdle() { if (idleCall) idleCall.kill(); idleCall = null; }

$('#hand').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b || !S || S.turn !== 'learner' || S.busy || S.over || S.verdict) return;
  audioInit();
  try {
    if (b.dataset.stack) { say('Those are your other cards. Clear the ones in front first!'); gsap.fromTo(b, { rotation: -6 }, { keyframes: { rotation: [-14, 2, -10, -6] }, duration: .4 }); return; }
    if (b.dataset.opt != null) await onOption(+b.dataset.opt, b);
    else if (b.dataset.act != null) await onAction(+b.dataset.act, b);
  } catch (err) { if (err !== STALE) console.error(err); }
});
$('#btnLast').addEventListener('click', async () => {
  if (!S || S.busy) return; S.called = true; renderLast(); pose('flippy', 'cheer', 1800); say('LAST CARD! Now play it!', 'flippy', true);
  try { await stamp('LAST CARD!', '#FF5A6E', .5); } catch (e) { }
});

async function penaltyLast() {
  S.busy = true; sfx('bad'); pose('flippy', 'oops', 2000); say('You forgot to tap LAST CARD! first. Draw 1 card.', 'flippy', true);
  await stamp('DRAW 1', '#FF5A6E'); await drawCards(1, true, 'flippy', true); S.busy = false; renderHand();
}

async function onOption(i, el) {
  const o = visibleOptions()[i]; if (!o) return;
  if (Date.now() < (S.tapLock || 0)) return;   /* one tap = one attempt: ignore taps right after a wrong answer */
  if (S.mode === 'drop') {
    S.busy = true; S.lastAction = true; clearHint(); const r = rectOf(el); el.style.visibility = 'hidden';
    await fly(r, L.pile, cardInner(frontImg(S.ch.p), o.text, r.w), { rot: -20, dur: .45 });
    S.expr--; S.mode = null; say('Poof! Dropped. Now find the match.'); renderHand();
    const over = await afterCard(); S.busy = false; renderHand(); resolveInput(over ? 'over' : 'again'); return;
  }
  if (handTotal() === 1 && !S.called) { await penaltyLast(); return; }
  if (o.correct) {
    S.busy = true; S.lastAction = false; disarmIdle(); clearHint(); sfx('good');
    const r = rectOf(el); el.style.visibility = 'hidden';
    await fly(r, L.played, cardInner(frontImg(S.ch.p), o.text, r.w), { rot: 8, trail: true });
    const before = S.phase;
    S.expr--; S.played = { text: o.text, p: S.ch.p }; S.eq = { line: S.ch.reveal, val: S.ch.val };
    if (S.phase < 4) { S.matches++; S.pairs[S.phase].push({ line: S.ch.reveal, val: S.ch.val }); }
    S.stats.correct++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
    renderCentre(); gsap.fromTo('#playedCard', { scale: 1.12 }, { scale: 1, duration: D(.3), ease: 'back.out(3)' });
    fx('fx-star-burst', L.played.x + L.played.w / 2, L.played.y + L.played.h / 2, 520, { from: .3, to: 1.3, rot: 40, dur: 1 }); reward();
    renderEq(); pose('flippy', 'cheer', 1600); say((S.wrong >= 3 ? 'There you go! ' : pick(['Nice! ', 'Yes! ', 'Perfect! ', 'Brilliant! '])) + PHASES[Math.min(S.ch.p, 3)].praise, 'flippy', true);
    if (Math.random() < .35) { pose('robo', 'think', 1200); }
    S.ch = null; S.wrong = 0; S.hint = false; renderHand(); renderProgress();
    await wait(1600);
    const over = await afterCard();
    if (!over) S.turn = (S.phase !== before) ? 'learner' : 'robo';
    S.busy = false; renderHand(); resolveInput(over ? 'over' : 'done');
  } else {
    S.tapLock = Date.now() + 750; S.wrong++; S.stats.wrong++; sfx('bad'); S.streak = 0; S.roundWrong++; renderHud(); { const rr = rectOf(el); badge('wrong', rr.x + rr.w / 2, rr.y + rr.h / 2, 120, .5); }
    gsap.fromTo(el, { x: 0 }, { keyframes: { x: [-16, 16, -12, 10, -6, 0] }, duration: D(.45), ease: 'none' });
    pose('flippy', 'oops', 1500);
    const why = explain(S.ch, o);
    if (S.wrong === 1) say(`Not a match. ${why}`, 'flippy', true);
    else if (S.wrong === 2) say(`Think: ${PHASES[Math.min(S.ch.p, 3)].hintq}`, 'flippy', true);
    else if (S.wrong === 3) {
      S.busy = true; say('Oops! Three missed matches. Draw one card!', 'flippy', true); if (!S.hint) S.hintsUsed++; sheet('screen-edge-bad', 960, 540, 1920);
      await stamp('DRAW 1', '#FF5A6E'); await drawCards(1, true, 'flippy', true); S.hint = true; S.busy = false; renderHand();
      pose('flippy', 'point', 2500); say('Look at the glowing card. Try again!', 'flippy', true);
    } else say(`Not quite. ${why}`, 'flippy', true);
  }
}

async function onAction(i, el) {
  const a = S.actions[i]; if (!a || S.mode === 'drop') return;
  if (handTotal() === 1 && !S.called) { await penaltyLast(); return; }
  S.busy = true; S.lastAction = true; disarmIdle(); clearHint();
  const r = rectOf(el); el.style.visibility = 'hidden';
  await fly(r, L.played, cardInner(ACTIONS[a.type].img, null, r.w), { rot: 8, trail: true });
  S.actions.splice(i, 1); S.played = { act: a.type }; renderCentre(); renderHand();
  if (a.type === 'skip') {
    pose('robo', 'dizzy', 2200); fx('fx-skip-smoke', 1720, 250, 420, { from: .4, to: 1.4, rot: 10, dur: 1.2 });
    say(pick(LINES.roboOuch), 'robo'); await stamp('ROBO SKIPPED!', '#FF5A6E'); say('SKIP! Robo misses a turn. Your turn again!', 'flippy');
  } else if (a.type === 'reverse') {
    fx('fx-reverse-arrows', L.played.x + 105, L.played.y + 150, 460, { from: .6, to: 1.1, rot: 360, dur: .9, ease: 'power2.inOut' }); sfx('whoosh');
    await stamp('REVERSE!', '#FFC83D'); say('Nice reverse! Your turn again!', 'flippy');
  } else if (a.type === 'swap') {
    const mine = handTotal(), theirs = S.comp;
    sfx('whoosh'); await stamp('SWAP HANDS!', '#FF6FC0');
    const fan = rectOf($('#roboFan')), hand = { x: 780, y: 800, w: 136, h: 194 }, flights = [];
    for (let k = 0; k < Math.min(mine, 4); k++) flights.push(fly({ ...hand, x: hand.x + k * 40 }, { x: fan.x + 140, y: fan.y + 40, w: 96, h: 136 }, cardInner('cd-back', null, 136), { dur: .7 }));
    for (let k = 0; k < Math.min(theirs, 4); k++) flights.push(fly({ x: fan.x + 120 + k * 20, y: fan.y + 40, w: 96, h: 136 }, { ...hand, x: hand.x + k * 40 }, cardInner('cd-back', null, 96), { dur: .7 }));
    S.expr = 0; S.actions = []; S.comp = 0; renderFan(); renderHand();
    await Promise.all(flights);
    S.expr = theirs; S.comp = Math.max(1, mine); renderFan(); renderHand({ deal: true });
    if (theirs < mine) { pose('robo', 'dizzy', 2000); say(`Lucky you! Just ${theirs} card${theirs === 1 ? '' : 's'} left!`); say('Hey! Those were MY cards!', 'robo'); }
    else { pose('robo', 'laugh', 2000); say(`Hmm, now you have ${theirs} cards. Swaps can backfire!`); }
    await wait(1200);
  } else if (a.type === 'mystery') {
    const drop = a.outcome === 'drop' || (a.outcome !== 'bonus' && Math.random() < .5);
    await revealCard(revealImg(S.phase), drop ? 'BONUS!\nDROP 1' : 'BONUS\nTURN', L.played);
    if (drop && S.expr > 0) {
      S.mode = 'drop'; S.busy = false; pose('flippy', 'cheer', 1600); say('Lucky flip! Tap any number card to drop it.', 'flippy', true);
      renderHand(); gsap.to('#hand [data-opt]', { rotation: '+=3', duration: .15, yoyo: true, repeat: 5 }); return;
    }
    S.skipRobo = true; pose('flippy', 'cheer', 1600); say('Lucky you! Robo loses its next turn.', 'flippy', true);
  }
  const over = await afterCard(); S.busy = false; renderHand(); resolveInput(over ? 'over' : 'again');
}

async function revealCard(img, text, from) {
  const g = GID; const c = document.createElement('div'); c.className = 'flycard';
  c.innerHTML = cardInner('cd-mystery', null, L.big.w); c.style.cssText = `left:${L.big.x}px;top:${L.big.y}px;width:${L.big.w}px;height:${L.big.h}px`;
  $('#fxLayer').appendChild(c);
  const sw = fx('fx-mystery-swirl', L.big.x + L.big.w / 2, L.big.y + L.big.h / 2, 760, { from: .3, to: 1.2, rot: 220, dur: 1.8 });
  sfx('magic');
  await gsap.timeline()
    .from(c, { x: from.x - L.big.x, y: from.y - L.big.y, scale: from.w / L.big.w, duration: D(.4), ease: 'power3.out' })
    .to(c, { keyframes: { rotation: [-6, 6, -4, 4, 0] }, duration: D(.35) })
    .to(c, { rotationY: 90, duration: D(.18), ease: 'power2.in' })
    .add(() => { c.innerHTML = cardInner(img, null, L.big.w) + `<span class="face" style="font-size:52px;white-space:pre-line">${text}</span>`; sfx('pop'); })
    .to(c, { rotationY: 0, duration: D(.25), ease: 'back.out(2)' });
  guard(g);
  await wait(900);
  await gsap.to(c, { scale: .3, autoAlpha: 0, x: 0, y: 120, duration: D(.35), ease: 'power2.in' }); c.remove(); guard(g); sw.kill();
}

async function drawCards(n, toLearner = true, dealer = 'flippy', penalty = false) {
  for (let i = 0; i < n; i++) {
    sfx('deal');
    const to = toLearner ? L.stack : { x: 1282, y: 346, w: 96, h: 136 };
    if (toLearner) await handThrow(dealer, cardInner('cd-back', null, 150), to);
    else await fly(L.pile, to, cardInner('cd-back', null, L.pile.w), { dur: .4, rot: 0 });
    if (toLearner) { S.expr++; if (penalty) S.stats.drawn++; renderHand(); } else { S.comp++; renderFan(); }
  }
}
async function giveAction(type, outcome) {
  sfx('deal');
  await handThrow('flippy', cardInner(ACTIONS[type].img, null, 150), { x: L.act.x + S.actions.length * L.act.step, y: L.act.y, w: L.act.w, h: L.act.h });
  S.actions.forEach(a => a.glow = false);
  S.actions.push({ type, outcome, glow: true }); renderHand();
}

/* ---------- property reveal, FLIP, finale, win ---------- */
async function afterCard() {
  if (S.phase < 4 && S.matches >= 4) {
    await propertyReveal(S.phase); S.roundWrong = 0;
    if (S.phase < 3) await doFlip(S.phase + 1);
    else { S.phase = 4; renderProgress(); updateTint(); if (handTotal() > 0) await finaleIntro(); }
  }
  if (handTotal() === 0) {
    if (S.phase === 4) { await win(); return true; }
    if (S.lastAction) { say('Special card played! Here are 3 new cards to keep going.'); await drawCards(3); }
    else {
    S.stats.stars++; sfx('win'); confetti(30); sheet('confetti', 960, 400, 1100); sheet('screen-edge-good', 960, 540, 1920); awardXp(10, { x: 960, y: 430 });
    await stamp('HAND CLEARED ★', '#FFC83D', .8);
    say('You cleared your hand! Bonus star. Here are 3 new cards to keep going.'); await drawCards(3); }
  }
  return false;
}
function propertyReveal(p) {
  return new Promise(res => {
    const P = PHASES[p], scr = $('#scrReveal'), pan = scr.querySelector('.panel');
    pan.style.setProperty('--pc', P.color);
    pan.querySelector('.medal').src = A('rewards/medal-' + P.key + '-unlocked');
    const stars = S.roundWrong === 0 ? 3 : S.roundWrong <= 2 ? 2 : 1; S.roundStars[p] = stars; if (stars === 3) S.perfectRounds++;
    pan.querySelectorAll('.stars').forEach(e => e.remove());
    pan.insertAdjacentHTML('afterbegin', `<div class="stars">${[0, 1, 2].map(i => `<img src="${A('rewards/star-' + (i < stars ? 'filled' : 'empty'))}" alt="">`).join('')}</div>`);
    pan.querySelector('h2').textContent = P.ost;
    pan.querySelector('.how').textContent = P.how;
    pan.querySelector('.rule').innerHTML = P.rule.join('<br>');
    const pairs = S.pairs[p].slice(-4);
    pan.querySelector('.pairs').innerHTML = pairs.map(x => `<div class="pair"><span>${x.line}</span><small>${x.val}</small></div>`).join('');
    const rows = Math.ceil(pairs.length / 2);
    pan.querySelector('.note').textContent = P.note || P.counter || ''; pan.querySelector('.note').style.top = (420 + rows * 66 + 12) + 'px';
    pan.querySelector('.go span').textContent = p < 3 ? 'FLIP!' : 'FINAL ROUND';
    scr.hidden = false; sfx('win'); confetti(40); sheet('confetti', 960, 380, 1100);
    pose('flippy', 'cheer', 2600); say(P.reveal, 'flippy', true); awardXp(stars * 6 + (stars === 3 ? 10 : 0), { x: 960, y: 250 });
    gsap.timeline()
      .fromTo(scr, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.25) })
      .fromTo(pan, { y: 120, scale: .85 }, { y: 0, scale: 1, duration: D(.5), ease: 'back.out(1.6)' }, '<')
      .fromTo(pan.querySelector('.medal'), { scale: 0, rotation: -180 }, { scale: 1, rotation: 0, duration: D(.6), ease: 'back.out(2)' }, '-=.2')
      .from(pan.querySelectorAll('.pair'), { x: -40, autoAlpha: 0, stagger: .12, duration: D(.35) }, '-=.2')
      .fromTo(pan.querySelector('.go'), { scale: 0 }, { scale: 1, duration: D(.35), ease: 'back.out(3)' });
    const go = pan.querySelector('.go');
    go.onclick = () => { go.onclick = null; sfx('pop'); gsap.to(scr, { autoAlpha: 0, duration: D(.25), onComplete: () => { scr.hidden = true; gsap.set(scr, { clearProps: 'all' }); res(); } }); };
    gsap.delayedCall(.1, () => go.focus());
  });
}
async function doFlip(next) {
  const g = GID; sfx('whoosh');
  say(PHASES[next - 1].flip, 'flippy', true);
  const card = document.createElement('div'); card.className = 'flycard'; card.innerHTML = cardInner('cd-flip', null, L.big.w);
  card.style.cssText = `left:${L.big.x}px;top:${L.big.y}px;width:${L.big.w}px;height:${L.big.h}px`; $('#fxLayer').appendChild(card);
  await gsap.fromTo(card, { y: 260, scale: .4, autoAlpha: 0, rotation: -20 }, { y: 0, scale: 1, autoAlpha: 1, rotation: 0, duration: D(.5), ease: 'back.out(1.8)' });
  stamp('FLIP!', '#FFC83D', .4).catch(() => { });
  const olds = $$('#centre .card, #hand .card');
  await gsap.timeline().to(card, { rotationY: 720, duration: D(.8), ease: 'power2.inOut' }).to(olds, { rotationY: 90, duration: D(.28), ease: 'power2.in' }, 0);
  guard(g);
  S.phase = next; S.matches = 0; S.centre = null; S.played = null; S.eq = null;
  renderProgress(); renderCentre(); renderEq(); renderHand(); updateTint();
  const news = $$('#centre .card, #hand .card');
  await gsap.timeline().fromTo(news, { rotationY: -90 }, { rotationY: 0, duration: D(.32), ease: 'power2.out' }).to(card, { scale: .2, autoAlpha: 0, y: -200, duration: D(.35), ease: 'power2.in' }, 0);
  card.remove(); guard(g);
  await stamp(PHASES[next].name.toUpperCase(), PHASES[next].color === '#8B5CF6' ? '#B79CFF' : PHASES[next].color, .5);
}
async function finaleIntro() {
  S.comp = 2; S.centre = null; S.played = null; S.eq = null; renderCentre(); renderEq(); renderFan();
  pose('robo', 'laugh', 2200); say('Two cards left. Robo wins this!', 'robo');
  await stamp('FINAL ROUND', '#FF5A6E', .7);
  say('Watch out! Robo is almost out of cards. Clear your hand first! Cards from every round are back.', 'flippy');
  await wait(2400);
}
async function win() {
  S.over = true; renderTurn(); renderLast(); disarmIdle(); sfx('win');
  pose('robo', 'sad'); pose('flippy', 'cheer');
  await stamp('LAST CARD!', '#FF5A6E', .4);
  const st = S.stats, secs = Math.round((Date.now() - st.start) / 1000), acc = st.correct + st.wrong ? Math.round(100 * st.correct / (st.correct + st.wrong)) : 100;
  const scr = $('#scrWin');
  S.xp += 20; const rk = rankOf(S.xp), stars = acc >= 90 ? 3 : acc >= 70 ? 2 : 1;
  let best = 0; try { best = +localStorage.getItem('nf-best') || 0; if (S.xp > best) localStorage.setItem('nf-best', S.xp); } catch (e) { }
  const earned = { 'perfect-round': S.perfectRounds > 0, 'no-hints': S.hintsUsed === 0, 'robo-catcher': st.caught > 0, 'speed-flipper': S.roundStars.length === 4 && S.roundStars.every(x => x >= 2), 'five-streak': S.bestStreak >= 5, comeback: S.peak >= 8 };
  scr.querySelector('.rating').innerHTML = `<img class="rk" src="${A('rewards/rank-' + RANKS[rk].k)}" alt="Rank">` + [0, 1, 2].map(i => `<img class="st ${i === 1 ? 'mid' : ''}" src="${A('rewards/star-' + (i < stars ? 'filled' : 'empty'))}" alt="">`).join('') + (best > 0 && S.xp > best ? `<img class="rb" src="${A('rewards/ribbon-new-best')}" alt="New best">` : '');
  scr.querySelector('.achv').innerHTML = Object.keys(earned).map(k => `<img class="${earned[k] ? '' : 'off'}" src="${A('rewards/achievement-' + k)}" alt="${k}" title="${k}">`).join('');
  scr.querySelector('.stats').innerHTML = [[acc + '%', 'accuracy'], [st.correct, 'matches'], [st.drawn, 'penalty cards'], [`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, 'time'], [S.xp, 'XP']]
    .concat(opts.challenge ? [[st.caught, 'cheats caught']] : []).map(([b, s]) => `<div class="stat"><b>${b}</b><small>${s}</small></div>`).join('');
  scr.hidden = false; confetti(90); sheet('confetti', 700, 420, 1200); sheet('confetti', 1220, 420, 1200); sheet('level-up-burst', 960, 260, 900); sheet('screen-edge-good', 960, 540, 1920);
  say("LAST CARD! All cards cleared! You're a Number Flip Star!", 'flippy', true);
  gsap.timeline()
    .fromTo(scr, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.5) })
    .fromTo(scr.querySelector('.trophy'), { y: -400, rotation: -20 }, { y: 0, rotation: 0, duration: D(.8), ease: 'bounce.out' }, '<.1')
    .fromTo(scr.querySelector('h2'), { scale: 0 }, { scale: 1, duration: D(.5), ease: 'back.out(2)' }, '-=.3')
    .from(scr.querySelectorAll('.rating img, .achv img'), { scale: 0, rotation: -90, stagger: .08, duration: D(.4), ease: 'back.out(2.5)' }, '-=.1')
    .from(scr.querySelectorAll('.stat'), { y: 40, autoAlpha: 0, stagger: .08, duration: D(.35) }, '-=.2')
    .from(['#btnAgain', '#btnHome'], { scale: 0, stagger: .1, duration: D(.35), ease: 'back.out(2.5)' }, '-=.1')
    .from('.w-flippy', { x: -400, duration: D(.6), ease: 'back.out(1.4)' }, .3)
    .from('.w-robo', { x: 400, duration: D(.6), ease: 'back.out(1.4)' }, .3);
  gsap.to('#scrWin .rays', { rotation: 360, duration: 24, repeat: -1, ease: 'none' });
  gsap.to('#scrWin .w-flippy', { y: -24, duration: .5, yoyo: true, repeat: -1, ease: 'power1.inOut' });
}

/* ---------- turns ---------- */
const LEARNER_GIVE = LEARNER_EVENTS;
async function learnerTurn() {
  S.turn = 'learner'; renderTurn();
  const k = `${S.phase}-${S.matches}`;
  if (S.phase < 4 && LEARNER_GIVE[k] && !S.fired['L' + k]) {
    S.fired['L' + k] = 1; const e = LEARNER_GIVE[k];
    pose('flippy', 'point', 2600); say(e.vo, 'flippy', true); await giveAction(e.give, e.outcome); await wait(1500);
  }
  let isNew = false;
  if (!S.ch) {
    S.ch = makeCh(false); S.wrong = 0; S.hint = false; S.idleDone = false; isNew = true;
    S.centre = { text: S.ch.centre, p: S.ch.p, sub: S.ch.sub }; S.played = null; S.eq = null; renderCentre(true); renderEq();
  }
  renderHand({ deal: isNew });
  if (handTotal() === 1 && !S.called) { pose('flippy', 'point', 2600); say('One card left! Tap LAST CARD!, then play it.', 'flippy', true); }
  else if (isNew) say(S.ch.vo);
  armIdle();
  await waitInput();
  disarmIdle();
}

async function roboTurn() {
  S.turn = 'robo'; S.called = false; renderTurn(); renderHand(); renderLast();
  await wait(700);
  if (S.skipRobo) { S.skipRobo = false; pose('robo', 'dizzy', 2000); say(pick(LINES.roboOuch), 'robo'); await stamp('ROBO SKIPPED!', '#FF5A6E'); S.turn = 'learner'; return; }
  const k = `${S.phase}-${S.matches}`, ev2 = S.phase < 4 && ROBO_EVENTS[k] && !S.fired['R' + k] ? ROBO_EVENTS[k] : null;
  if (ev2) {
    S.fired['R' + k] = 1; S.comp = Math.max(1, S.comp - 1);
    pose('robo', 'play', 1500);
    await handThrow('robo', cardInner(ACTIONS[ev2].img, null, 150), L.played);
    S.played = { act: ev2 }; renderCentre(); renderFan();
    if (ev2 === 'skip') {
      pose('robo', 'laugh', 2200); say(pick(LINES.roboTaunt), 'robo');
      fx('fx-skip-smoke', 960, 940, 620, { from: .4, to: 1.4, rot: 10, dur: 1.2 });
      gsap.to('#hand', { autoAlpha: .45, duration: .2, yoyo: true, repeat: 1, repeatDelay: 1 });
      await stamp("YOU'RE SKIPPED!", '#FF5A6E'); say('Uh-oh! You have been skipped. Robo plays again!', 'flippy'); await wait(900);
    } else if (ev2 === 'reverse') {
      fx('fx-reverse-arrows', L.played.x + 105, L.played.y + 150, 460, { from: .6, to: 1.1, rot: -360, dur: .9, ease: 'power2.inOut' }); sfx('whoosh');
      pose('robo', 'laugh', 2000); say('REVERSE! Robo goes again!', 'robo'); await stamp('REVERSE!', '#FFC83D'); await wait(500);
    } else if (ev2 === 'mystery') {
      await revealCard(revealImg(S.phase), 'DRAW 2', rectOf($('#roboFan')));
      pose('robo', 'laugh', 2200); say('Mystery says… DRAW 2! Beep-hee-hee!', 'robo');
      await stamp('DRAW 2', '#B79CFF'); await drawCards(2, true, 'robo', true); say('Oh no! Mystery Draw 2!', 'flippy'); await wait(600);
      S.turn = 'learner'; return;
    }
  }
  await roboPlay();
  S.turn = 'learner';
}
async function roboPlay() {
  const floor = S.phase === 4 ? 1 : 2;
  if (S.comp <= floor) { pose('robo', 'think', 1600); say(pick(LINES.roboDraw), 'robo'); await drawCards(1, false); await wait(700); return; }
  const ch = makeCh(true);
  S.centre = { text: ch.centre, p: ch.p, sub: ch.sub }; S.played = null; S.eq = null; renderCentre(true); renderEq();
  pose('robo', 'think'); await wait(1000);
  const cheat = opts.challenge && ch.wrongs.length && Math.random() < .35;
  const card = cheat ? ch.wrongs[0] : ch.rights[0];
  pose('robo', 'play', 1400); say(pick(LINES.roboPlay), 'robo');
  await handThrow('robo', cardInner(frontImg(ch.p), card, 150), L.played);
  S.comp--; S.played = { text: card, p: ch.p }; renderCentre(); renderFan();
  if (opts.challenge) {
    const v = await verdict(ch, card);
    if (cheat && v === 'challenge') {
      S.stats.caught++; awardXp(10, { x: L.played.x + 100, y: L.played.y + 60 }); S.eq = { line: notMatchLine(ch, card), val: explain(ch, { text: card }), bad: true }; renderEq();
      pose('robo', 'dizzy', 2400); say('Bzzt! You caught me!', 'robo'); say('Caught it! Robo takes the card back and draws 2.'); await stamp('CAUGHT IT!', '#3DDC97'); S.comp++; S.played = null; renderCentre(); renderFan(); await drawCards(2, false); await wait(800);
    } else if (cheat) {
      S.eq = { line: notMatchLine(ch, card), val: explain(ch, { text: card }), bad: true }; renderEq();
      pose('robo', 'laugh', 2200); say('Hee-hee! Nobody noticed!', 'robo'); say('Sneaky! That was not a match, and Robo got away with it.'); await wait(2600);
    } else if (v === 'challenge') {
      S.eq = { line: ch.reveal, val: ch.val }; renderEq(); pose('robo', 'laugh', 2000); say('Fair and square! Beep!', 'robo');
      say('That was a fair match, so the challenge fails. You draw 1.'); await stamp('DRAW 1', '#FF5A6E'); await drawCards(1, true, 'flippy', true); await wait(600);
    } else { S.eq = { line: ch.reveal, val: ch.val }; renderEq(); say('Correct, that was a fair match!'); await wait(1200); }
  } else { S.eq = { line: ch.reveal, val: ch.val }; renderEq(); await wait(1700); }
  if (S.comp === 1) { pose('robo', 'last'); say('LAST CARD! Beep beep!', 'robo'); await stamp('ROBO: LAST CARD!', '#B79CFF', .5); }
}
function verdict(ch, card) {
  return new Promise(res => {
    S.verdict = true; renderHand();
    const v = $('#verdict'); v.hidden = false;
    v.querySelector('.verdict-q').innerHTML = `Robo played <b>${card}</b> on <b>${ch.centre}</b>. Fair match?`;
    gsap.from(v.querySelectorAll('.imgbtn'), { scale: 0, stagger: .1, duration: D(.35), ease: 'back.out(2.5)' });
    say('Is that a fair match? Check the RULE, not just the total, then decide.', 'flippy');
    v.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { audioInit(); sfx('pop'); v.hidden = true; S.verdict = false; res(b.dataset.v); });
  });
}

/* ---------- loop + screens ---------- */
async function loop() {
  try { while (!S.over) { if (S.turn === 'learner') await learnerTurn(); else await roboTurn(); } }
  catch (e) { if (e !== STALE) console.error(e); }
}
function resetMotion() {
  GID++; resolveInput('stale'); pending = null; disarmIdle(); clearHint();
  gsap.globalTimeline.getChildren(true, true, true).forEach(t => t.kill());
  gsap.globalTimeline.resume();
  $('#fxLayer').innerHTML = ''; gsap.set('#stamp', { autoAlpha: 0 }); gsap.set(['#world', '#centre', '#hand', '#bubble', '#roboBubble', '#btnLast'], { clearProps: 'transform' });
  try { speechSynthesis.cancel(); } catch (e) { }
}
async function start(phase = 0) {
  audioInit(); resetMotion();
  ['#scrTitle', '#scrReveal', '#scrPause', '#scrWin', '#qa'].forEach(s => $(s).hidden = true);
  gsap.set('#roboBubble', { autoAlpha: 0 });
  fresh(phase); renderAll(); breathe(); pose('flippy', 'idle'); pose('robo', phase === 4 ? 'last' : 'idle');
  const g = GID;
  gsap.from('#flippyWrap', { x: -360, duration: D(.6), ease: 'back.out(1.4)' });
  gsap.from('#roboWrap', { x: 360, duration: D(.6), ease: 'back.out(1.4)' });
  try {
    if (phase === 0) { say('Match the cards, clear your hand, and watch out for the special cards! Ready to flip?'); say('Beep! Good luck, human!', 'robo'); await wait(1400); await stamp('NUMBER FLIP!', '#FFC83D', .5); }
    else if (phase < 4) await stamp(PHASES[phase].name.toUpperCase(), PHASES[phase].color === '#8B5CF6' ? '#B79CFF' : PHASES[phase].color, .4);
    else await finaleIntro();
  } catch (e) { return; }
  if (g === GID) loop();
}
function showTitle() {
  resetMotion(); fresh(0); renderAll();
  const t = $('#scrTitle'); t.hidden = false; ['#scrReveal', '#scrPause', '#scrWin', '#qa', '#scrHow'].forEach(s => $(s).hidden = true);
  const fan = $$('.title-fan img'), n = fan.length;
  gsap.timeline()
    .from('#scrTitle .title-plaque', { y: -400, duration: D(.8), ease: 'bounce.out' })
    .from('#scrTitle .w2 i', { scale: 0, rotation: -40, stagger: .07, duration: D(.4), ease: 'back.out(3)' }, '-=.2')
    .from('#scrTitle .subtitle', { autoAlpha: 0, y: 20, duration: D(.3) }, '-=.1')
    .fromTo(fan, { rotation: 0, y: 300, autoAlpha: 0 }, { rotation: i => (i - (n - 1) / 2) * 11, y: 0, autoAlpha: 1, stagger: .05, duration: D(.5), ease: 'back.out(1.6)' }, .3)
    .from('.t-flippy', { x: -500, duration: D(.7), ease: 'back.out(1.3)' }, .4)
    .from('.t-robo', { x: 500, duration: D(.7), ease: 'back.out(1.3)' }, .4)
    .from('#btnPlay', { scale: 0, duration: D(.45), ease: 'back.out(2.5)' }, '-=.3')
    .from('.toggles .toggle', { y: 30, autoAlpha: 0, stagger: .08, duration: D(.3) }, '-=.2');
  gsap.to('#btnPlay', { scale: 1.05, duration: .7, yoyo: true, repeat: -1, ease: 'sine.inOut', delay: 2 });
  gsap.to('#scrTitle .rays', { rotation: 360, duration: 30, repeat: -1, ease: 'none' });
  gsap.to('.t-flippy', { y: -16, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('.t-robo', { y: -10, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
}

/* pause */
let paused = false;
function openPause() {
  if (!S || S.over || paused || !$('#scrTitle').hidden) return; paused = true; syncOpts();
  gsap.globalTimeline.pause(); try { speechSynthesis.pause(); } catch (e) { }
  const p = $('#scrPause'); p.hidden = false; gsap.set(p, { autoAlpha: 1 });
}
function closePause() { paused = false; $('#scrPause').hidden = true; gsap.globalTimeline.resume(); try { speechSynthesis.resume(); } catch (e) { } }
$('#btnPause').addEventListener('click', () => { audioInit(); sfx('pop'); openPause(); });
$('#btnResume').addEventListener('click', () => { sfx('pop'); closePause(); });
$('#btnRestart').addEventListener('click', () => { paused = false; useScript = true; start(0); });
$('#btnSound').addEventListener('click', () => { audioInit(); opts.sound = !opts.sound; $('#btnSound img').src = A('ui/ui-icon-sound-' + (opts.sound ? 'on' : 'off')); sfx('pop'); });
const howSeen = () => { try { return localStorage.getItem('nf-how') === '1'; } catch (e) { return true; } };
function openHow() { const h = $('#scrHow'); h.hidden = false; gsap.fromTo(h, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.25) }); gsap.from('#scrHow figure', { y: 80, autoAlpha: 0, stagger: .12, duration: D(.45), ease: 'back.out(1.6)' }); }
$('#btnPlay').addEventListener('click', () => { sfx('pop'); if (!howSeen()) openHow(); else start(0); });
$('#btnHow').addEventListener('click', () => { sfx('pop'); openHow(); });
$('#btnHowGo').addEventListener('click', () => { sfx('pop'); try { localStorage.setItem('nf-how', '1'); } catch (e) { } $('#scrHow').hidden = true; start(0); });
$('#btnHint').addEventListener('click', () => {
  audioInit(); if (!S || S.turn !== 'learner' || S.busy || S.over || S.verdict || !S.ch || S.mode === 'drop') return;
  if (!S.hint) { S.hint = true; S.hintsUsed++; } sfx('pop'); say('Look at the glowing card!', 'flippy'); renderHand();
});
$('#btnAgain').addEventListener('click', () => { useScript = false; start(0); });
$('#btnHome').addEventListener('click', () => { useScript = true; showTitle(); });
function syncOpts() { ['#optChallenge', '#optChallenge2'].forEach(s => $(s).checked = opts.challenge); ['#optVoice', '#optVoice2'].forEach(s => $(s).checked = opts.voice); }
['#optChallenge', '#optChallenge2'].forEach(s => $(s).addEventListener('change', e => { opts.challenge = e.target.checked; syncOpts(); }));
['#optVoice', '#optVoice2'].forEach(s => $(s).addEventListener('change', e => { opts.voice = e.target.checked; syncOpts(); if (!opts.voice) try { speechSynthesis.cancel(); } catch (_) { } }));
document.addEventListener('pointerdown', audioInit, { once: true });

/* QA jump menu (press Q), the same pattern as the team's other games */
function buildJump(el) {
  el.innerHTML = PHASES.map((p, i) => `<button style="--pc:${p.color}" data-j="${i}">${p.name}</button>`).join('') + '<button style="--pc:#555" data-j="win">Win screen</button>';
  el.onclick = e => {
    const b = e.target.closest('[data-j]'); if (!b) return; paused = false; useScript = true;
    if (b.dataset.j === 'win') { (async () => { audioInit(); resetMotion(); ['#scrTitle', '#scrReveal', '#scrPause', '#scrWin', '#qa'].forEach(x => $(x).hidden = true); fresh(4); S.expr = 0; renderAll(); breathe(); try { await win(); } catch (err) { } })(); }
    else start(+b.dataset.j);
  };
}
$$('.jump').forEach(buildJump);
document.addEventListener('keydown', e => {
  if (e.key === 'q' || e.key === 'Q') { const q = $('#qa'); q.hidden = !q.hidden; }
  if (e.key === 'Escape') { if (paused) closePause(); else openPause(); }
});

/* hot update support in the artifact viewer */
window.claude?.hot?.snapshot?.(() => ({}));

showTitle();
})();
