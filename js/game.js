/* Number Flip V2: game flow, rendering and motion (GSAP). Content lives in js/content.js.
   The game is a fixed script (the V2 LXD sheet): Hook → Setup → How to Play 1-4 → Part 2 (Commutative) → FLIP → Part 3 (Associative) → Complete. */
(() => {
'use strict';
const { START_CARDS, PARTS, HOOK, SETUP, HOW, WRONG1, STUCK, PART2, PART3, EXPLAIN, ACTIONS, FILLER, util: { shuffle, ev } } = window.NF_CONTENT;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const A = p => `assets/${p}.webp`;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const MATCHES = [PART2, PART3].map(s => s.filter(x => x.t === 'match').length);

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
  ...PARTS.map(p => 'cards/cd-front-' + p.key), 'cards/cd-front-distributive', 'cards/cd-front-identity', 'cards/cd-back', 'cards/cd-flip', 'cards/cd-skip', 'cards/cd-reverse', 'cards/cd-swap-hands', 'cards/cd-mystery',
  'cards/cd-mystery-reveal-associative', 'cards/cd-mystery-reveal-distributive',
  'fx/fx-star-burst', 'fx/fx-hint-glow', 'fx/fx-card-glow', 'fx/fx-skip-smoke', 'fx/fx-reverse-arrows', 'fx/fx-mystery-swirl', 'fx/fx-card-trail', 'fx/fx-win-rays',
  ...['robo', 'flippy'].flatMap(w => ['grip-back', 'grip-front-fingers', 'open', 'release', 'ext'].map(k => `hands/arm-${w}-${k}`).concat(`characters/body-${w}-throw`)), 'bg/bg-victory', 'ui/ui-icon-sound-off', 'ui/ui-stamp-badge'];
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
      const u = new SpeechSynthesisUtterance(text.replace(/×/g, ' times ').replace(/→/g, ', ').replace(/•/g, ', '));
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
  pile: { x: 605, y: 468, w: 210, h: 298 },
  centre: { x: 855, y: 468, w: 210, h: 298 },
  played: { x: 1105, y: 468, w: 210, h: 298 },
  hand: { cx: 830, y: 790, w: 176, h: 250, gap: 32 },
  stack: { x: 1160, y: 866, w: 120, h: 172 },
  act: { x: 1360, y: 846, w: 136, h: 194 },
  fan: { x: 1410, y: 316, w: 80, h: 114 },
  big: { x: 820, y: 250, w: 280, h: 398 }
};
const rectOf = el => { let x = 0, y = 0, e = el; while (e && e !== stage) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y, w: el.offsetWidth, h: el.offsetHeight }; };
const frontImg = p => 'cd-front-' + PARTS[Math.min(p, 1)].key;
function fs(t, w) { const n = t.replace(/<[^>]+>/g, '').length; const k = n <= 3 ? .34 : n <= 6 ? .25 : n <= 9 ? .185 : n <= 13 ? .15 : .13; return Math.round(w * k); }
function cardInner(img, text, w, cls = '') { return `<img src="${A('cards/' + img)}" alt="" draggable="false">${text != null ? `<span class="face ${cls}" style="font-size:${fs(text, w)}px">${text}</span>` : ''}`; }
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
const TOK = s => s.match(/\(|\)|\d+|[+×=]/g) || [];
const spans = s => TOK(s).map(t => `<span class="t ${/\d/.test(t) ? 'n' : /[()]/.test(t) ? 'b' : 'o'}">${t}</span>`).join('');
function relPos(el, box) { let x = 0, y = 0, e = el; while (e && e !== box) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return { x, y }; }
/* move copies of tokens A into the places of tokens B (same number goes to the same number, brackets jump to their new place) */
function morph(box, Aels, Bels, { dur = .85, keepA = true, glow = false } = {}) {
  const ta = Aels.map(e => e.textContent), used = new Set(), tl = gsap.timeline();
  Bels.forEach((be, j) => {
    be.style.visibility = 'hidden';
    const i = ta.findIndex((t, k) => !used.has(k) && t === be.textContent), bp = relPos(be, box);
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
/* the equation panel beside the centre pile: A, then "= B" built from A's own numbers, then the value on both sides */
async function eqShow(a, b, val, { glow = false } = {}) {
  const g = GID, box = $('#equation');
  gsap.killTweensOf(box);
  box.innerHTML = `<div class="eq-row ra">${spans(a)}</div><div class="eq-row rb"><span class="t o eqs">=</span>${spans(b)}</div><div class="eq-val">${val} = ${val}</div>`;
  box.classList.toggle('hint', glow);
  const Ael = [...box.querySelectorAll('.ra .t')], Bel = [...box.querySelectorAll('.rb .t:not(.eqs)')], eqs = box.querySelector('.eqs'), v = box.querySelector('.eq-val');
  gsap.set([eqs, v], { autoAlpha: 0 }); Bel.forEach(e => e.style.visibility = 'hidden');
  await gsap.fromTo(box, { autoAlpha: 0, scale: .7 }, { autoAlpha: 1, scale: 1, duration: D(.35), ease: 'back.out(2)' });
  if (glow) Ael.filter(e => e.classList.contains('n')).forEach(e => e.classList.add('glow'));
  gsap.to(eqs, { autoAlpha: 1, duration: .2 });
  await morph(box, Ael, Bel, { glow });
  await gsap.to(v, { autoAlpha: 1, duration: D(.3) });
  guard(g);
}
function eqClear() { gsap.to('#equation', { autoAlpha: 0, duration: .2, overwrite: true }); }

/* ---------- state ---------- */
let S = null;
function fresh() {
  S = { part: 0, done: [0, 0], hand: START_CARDS, comp: START_CARDS, centre: null, played: null, view: 'wait', opts: [], drop: [], glow: -1, special: null,
    turn: 'learner', over: false, pairs: [[], []], lock: 0,
    stats: { correct: 0, wrong: 0, drawn: 0, start: Date.now() } };
}

/* ---------- rendering ---------- */
function renderProgress() {
  const el = $('#progress'), i = Math.min(S.part, 1), p = PARTS[i];
  el.innerHTML = `<img class="ic" src="${A('rewards/medal-' + p.key + '-unlocked')}" alt=""><span class="pn">${p.name}</span>` +
    `<span class="dots">${Array.from({ length: MATCHES[i] }, (_, d) => `<i class="${d < S.done[i] ? 'on' : ''}"></i>`).join('')}</span><span class="pp">${i + 1}/2</span>`;
}
function renderFan() {
  const f = $('#roboFan'), n = Math.min(S.comp, 6); f.innerHTML = '';
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
/* the learner's hand. view: wait (cards face down) · match (3 options face up) · special (a special card to play) · drop / show (cards face up) */
function renderHand({ deal = false } = {}) {
  clearGlow();
  const h = $('#hand'); h.innerHTML = '';
  const v = S.view, faces = v === 'match' ? S.opts.map(o => o.text) : (v === 'drop' || v === 'show') ? S.drop : null;
  const live = v === 'match' || v === 'drop', mine = S.turn === 'learner';
  const n = faces ? faces.length : Math.min(3, S.hand);
  const W = L.hand.w, total = n ? n * W + (n - 1) * L.hand.gap : 0, x0 = L.hand.cx - total / 2;
  L.stack.x = Math.max(x0 + total + 28, 640);
  const cards = [];
  for (let i = 0; i < n; i++) {
    const r = { x: x0 + i * (W + L.hand.gap), y: L.hand.y, w: W, h: L.hand.h }, rot = n > 1 ? (i - (n - 1) / 2) * 2 : 0;
    const b = document.createElement('button'); b.className = 'card' + (live ? ' playable' : mine ? '' : ' waiting');
    if (faces) {
      b.dataset.opt = i; b.setAttribute('aria-label', 'Play ' + faces[i]); b.disabled = !live;
      b.innerHTML = `<span class="lift">${cardInner(frontImg(S.part), faces[i], W)}</span>`;
      if (i === S.glow) b.dataset.glow = '1';
    } else { b.disabled = true; b.innerHTML = `<span class="lift">${cardInner('cd-back', null, W)}</span>`; }
    place(b, r, rot); h.appendChild(b); cards.push(b);
  }
  const stack = Math.max(0, S.hand - n);
  if (stack) {
    const s = document.createElement('button'); s.className = 'card' + (mine ? '' : ' waiting'); s.disabled = true; s.setAttribute('aria-label', stack + ' more cards');
    s.innerHTML = `<span class="lift">${cardInner('cd-back', null, L.stack.w)}<span class="plus">+${stack}</span></span>`; place(s, L.stack); h.appendChild(s); cards.push(s);
  }
  if (S.special) {
    const b = document.createElement('button'); b.className = 'card special' + (v === 'special' ? ' playable' : ''); b.dataset.act = S.special; b.disabled = v !== 'special';
    b.setAttribute('aria-label', 'Play the ' + ACTIONS[S.special].label + ' card');
    b.innerHTML = `<span class="lift">${actInner(S.special, L.act.w)}</span><span class="act-lbl">${ACTIONS[S.special].label}</span>`;
    place(b, L.act, 2); h.appendChild(b); cards.push(b); if (v === 'special') b.dataset.glow = '1';
  }
  $('#cntYou b').textContent = S.hand + (S.special ? 1 : 0);
  if (deal && cards.length) { sfx('deal'); gsap.from(cards, { y: 140, autoAlpha: 0, rotation: '-=12', duration: D(.45), stagger: .07, ease: 'back.out(1.5)' }); }
  const g = GID;
  gsap.delayedCall(deal ? .55 : 0, () => { if (g === GID) $$('#hand [data-glow]').forEach(b => glowKill.push(glowAt(rectOf(b)))); });
}
function renderAll() { renderProgress(); renderFan(); renderCentre(); renderHand(); updateTint(false); }
function updateTint(animate = true) { gsap.to('#tint', { background: `radial-gradient(closest-side, ${PARTS[Math.min(S.part, 1)].color}, transparent)`, duration: animate ? D(.6) : 0 }); }

/* on-screen text (the sheet's OST column) */
function ost(t) {
  const o = $('#ost'); gsap.killTweensOf(o);
  if (!t) { gsap.to(o, { autoAlpha: 0, duration: .2 }); return; }
  o.textContent = t; gsap.fromTo(o, { autoAlpha: 0, scale: .8 }, { autoAlpha: 1, scale: 1, duration: D(.3), ease: 'back.out(2.4)' });
}
/* the turn pointer travels between the two players */
function ptrAt(who) { const c = $(who === 'learner' ? '#cntYou' : '#cntCpu'); return { left: c.offsetLeft - 66, top: c.offsetTop + c.offsetHeight / 2 - 28 }; }
let bob = null;
async function setTurn(who, instant = false) {
  const changed = S.turn !== who; S.turn = who; const a = $('#turnPtr'), p = ptrAt(who);
  if (bob) bob.kill(); gsap.set(a, { x: 0, rotation: -90, autoAlpha: 1 }); $('#cntYou').classList.toggle('on', who === 'learner'); $('#cntCpu').classList.toggle('on', who !== 'learner');
  if (instant || !changed) gsap.set(a, p);
  else { sfx('whoosh'); await gsap.to(a, { ...p, duration: D(.7), ease: 'power2.inOut' });  }
  bob = gsap.to(a, { x: 10, duration: .5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
}
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
$('#scrExplain .go').addEventListener('click', () => { sfx('pop'); tap({ kind: 'go' }); });
/* inactivity: the sheet's Inactivity VO + animation, after 8 s and then every 12 s */
let idleT = null;
function idle(vo, anim) {
  idleOff(); const g = GID;
  const run = () => { if (g !== GID) return; pose('flippy', 'point', 2400); say(vo, true); if (anim) anim(); idleT = gsap.delayedCall(12, run); };
  idleT = gsap.delayedCall(8, run);
}
function idleOff() { if (idleT) idleT.kill(); idleT = null; }
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
  resetMotion(); fresh(); renderAll(); ost(''); hideGo(); $('#setupOpts').hidden = true; $('#turnPtr').style.opacity = 0;
  const g = GID, t = $('#scrTitle'); t.hidden = false; gsap.set(t, { autoAlpha: 1 });
  ['#scrTeach', '#scrExplain', '#scrPause', '#scrWin', '#qa'].forEach(s => $(s).hidden = true);
  const box = $('#hookCards'); box.innerHTML = HOOK_CARDS.map(([img, txt]) => `<div class="hc">${cardInner(img, txt ?? null, 150)}</div>`).join('');
  const cards = [...box.children], n = cards.length;
  $('#scrTitle .subtitle').textContent = HOOK.vo;
  gsap.to('#scrTitle .rays', { rotation: 360, duration: 30, repeat: -1, ease: 'none' });
  gsap.to('.t-flippy', { y: -16, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('.t-robo', { y: -10, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  try {
    say(HOOK.vo);
    /* colourful cards fly onto the screen, then shuffle and form a deck; the title glows with sparkles */
    await gsap.timeline()
      .from('#scrTitle .title-plaque', { y: -400, duration: D(.8), ease: 'bounce.out' })
      .from('#scrTitle .w2 i', { scale: 0, rotation: -40, stagger: .07, duration: D(.4), ease: 'back.out(3)' }, '-=.2')
      .from('.t-flippy', { x: -500, duration: D(.7), ease: 'back.out(1.3)' }, .2)
      .from('.t-robo', { x: 500, duration: D(.7), ease: 'back.out(1.3)' }, .2)
      .fromTo(cards, { x: i => (i % 2 ? 1 : -1) * ri(900, 1200), y: () => ri(-500, 300), rotation: () => ri(-200, 200), autoAlpha: 1 },
        { x: i => (i - (n - 1) / 2) * 120, y: i => Math.abs(i - (n - 1) / 2) * 14, rotation: i => (i - (n - 1) / 2) * 9, duration: D(.7), stagger: .12, ease: 'back.out(1.4)', onStart: () => sfx('deal') }, .5)
      .from('#scrTitle .subtitle', { autoAlpha: 0, y: 20, duration: D(.4) }, '-=.6')
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
  fresh(); S.hand = 0; S.comp = 0; renderAll(); breathe(); pose('flippy', 'idle'); pose('robo', 'idle'); $('#turnPtr').style.opacity = '';
  await setTurn('learner', true);
  gsap.from('#flippyWrap', { x: -360, duration: D(.6), ease: 'back.out(1.4)' });
  gsap.from('#roboWrap', { x: 360, duration: D(.6), ease: 'back.out(1.4)' });
  try {
    say(SETUP.vo);
    await wait(500);
    /* cards are dealt to each player; the computer's cards stay face down */
    for (let i = 0; i < START_CARDS; i++) {
      sfx('deal');
      fly(L.pile, L.fan, cardInner('cd-back', null, L.pile.w), { dur: .32, rot: 0 }).then(() => { S.comp++; renderFan(); }).catch(() => { });
      await fly(L.pile, { x: L.hand.cx - 88, y: L.hand.y, w: L.hand.w, h: L.hand.h }, cardInner('cd-back', null, L.pile.w), { dur: .32, rot: ri(-6, 6) });
      S.hand++; renderHand();
    }
    await wait(300); S.comp = START_CARDS; renderFan();
    showGo('PLAY'); $('#setupOpts').hidden = false; syncOpts();
    idle(SETUP.idle, () => pulse($('#btnGo'), 2, 1.15));
    await waitFor('go'); idleOff(); hideGo(); $('#setupOpts').hidden = true;
    await talk(SETUP.ok);
    await howTo();
  } catch (e) { if (e !== STALE) console.error(e); }
}

async function howTo() {
  const g = GID;
  /* How to Play 1: centre card + three learner options, a glowing sample card */
  {
    const H = HOW.match; await setTurn('learner'); ost(H.ost);
    S.centre = { text: H.centre, p: 0 }; S.played = null; renderCentre(true);
    S.opts = shuffle([{ text: H.right, correct: true }, ...H.wrongs.map(t => ({ text: t, correct: false }))]); const ci = S.opts.findIndex(o => o.correct);
    S.view = 'match'; S.glow = ci; renderHand({ deal: true }); renderCentre();
    say(H.vo); idle(H.idle, () => pulse($(`#hand [data-opt="${ci}"]`)));
    let e; for (;;) { e = await waitFor('opt'); if (S.opts[e.i].correct) break; gsap.fromTo(e.el, { x: 0 }, { keyframes: { x: [-12, 12, -8, 0] }, duration: .35 }); pulse($(`#hand [data-opt="${ci}"]`), 2); }
    idleOff(); clearGlow(); sfx('good');
    const r = rectOf(e.el); e.el.style.visibility = 'hidden';
    await fly(r, L.played, cardInner(frontImg(0), H.right, r.w), { rot: 6, trail: true });
    S.hand--; S.played = { text: H.right, p: 0 }; S.view = 'wait'; S.glow = -1; renderCentre(); renderHand();
    badge('correct', L.played.x + L.played.w - 20, L.played.y + 30, 130); sparkles(L.played.x + 105, L.played.y + 140, 6, 110);
    pose('flippy', 'cheer', 1600); await talk(H.ok, true);
  }
  /* How to Play 2: the turn order arrow */
  {
    const H = HOW.turns; ost(H.ost); say(H.vo);
    showGo('NEXT', 'side'); idle(H.idle, () => pulse($('#btnGo'), 2, 1.15));
    await waitFor('go'); idleOff(); hideGo();
    say(H.ok); await setTurn('computer'); await wait(500); await setTurn('learner');
    fx('fx-star-burst', ptrAt('learner').left + 28, ptrAt('learner').top + 28, 160, { dur: .6 }); await wait(1200, true);
  }
  /* How to Play 3: special cards float over the deck; tap each to preview */
  {
    const H = HOW.actions, types = ['skip', 'reverse', 'draw', 'swap'], seen = new Set();
    S.centre = null; S.played = null; renderCentre(); eqClear(); ost(H.ost); say(H.vo);
    const row = document.createElement('div'); row.id = 'preview'; $('#world').appendChild(row);
    row.innerHTML = types.map((t, i) => `<button class="pv" data-t="${t}" style="left:${560 + i * 205}px" aria-label="Preview ${ACTIONS[t].label}"><span class="lift">${actInner(t, 170)}</span><span class="act-lbl">${ACTIONS[t].label}</span><img class="tick" src="${A('ui/ui-icon-check')}" alt=""></button>`).join('');
    const pv = [...row.children];
    gsap.from(pv, { y: 200, autoAlpha: 0, stagger: .1, duration: D(.45), ease: 'back.out(1.6)' });
    pv.forEach((b, i) => { gsap.to(b.querySelector('.lift'), { y: -10, duration: 1 + i * .1, yoyo: true, repeat: -1, ease: 'sine.inOut' }); b.onclick = () => tap({ kind: 'prev', t: b.dataset.t, el: b }); });
    idle(H.idle, () => pv.filter(b => !seen.has(b.dataset.t)).forEach((b, i) => gsap.delayedCall(i * .45, () => pulse(b, 1, 1.12))));
    while (seen.size < types.length) {
      const e = await waitFor('prev'); idleOff(); sfx('pop'); bounce(e.el);
      say(H.each[e.t]);
      await preview(e.t);
      seen.add(e.t); gsap.to(e.el.querySelector('.tick'), { autoAlpha: 1, scale: 1, duration: D(.3), ease: 'back.out(3)' });
      idle(H.idle, () => pv.filter(b => !seen.has(b.dataset.t)).forEach((b, i) => gsap.delayedCall(i * .45, () => pulse(b, 1, 1.12))));
    }
    idleOff(); say(H.ok); pose('flippy', 'cheer', 1600);
    gsap.to(pv, { keyframes: { y: [-40, 0, -14, 0] }, stagger: .08, duration: .7 }); await wait(2200, true);
    await gsap.to(pv, { y: 220, autoAlpha: 0, stagger: .06, duration: D(.35), ease: 'power2.in' }); row.remove(); guard(g);
  }
  /* How to Play 4: the FLIP preview card */
  {
    const H = HOW.flip; ost(H.ost); say(H.vo);
    const c = document.createElement('button'); c.id = 'flipPreview'; c.className = 'card tappable'; c.setAttribute('aria-label', 'Tap FLIP'); c.innerHTML = cardInner('cd-flip', null, 230);
    place(c, { x: 845, y: 452, w: 230, h: 327 }); $('#world').appendChild(c); c.onclick = () => tap({ kind: 'flipprev' });
    gsap.from(c, { scale: 0, rotation: -30, duration: D(.5), ease: 'back.out(2)' });
    const wob = gsap.to(c, { rotationY: 25, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    S.drop = FILLER[0].slice(0, 3); S.view = 'show'; renderHand({ deal: true });
    idle(H.idle, () => pulse(c, 2, 1.1));
    await waitFor('flipprev'); idleOff(); wob.kill();
    sfx('whoosh'); sheet('level-up-burst', 960, 615, 700); sparkles(960, 615, 12, 220);
    await allFlip(() => { S.drop = FILLER[1].slice(0, 3); renderHand(); }, c);
    say(H.ok); pose('flippy', 'cheer', 1600); await wait(1800, true);
    /* return to start state */
    await allFlip(() => { S.view = 'wait'; renderHand(); }, c);
    await gsap.to(c, { scale: 0, autoAlpha: 0, duration: D(.3) }); c.remove(); guard(g);
  }
  /* Ready? */
  ost(''); say(HOW.ready.vo);
  await reshuffle();
  showGo('PLAY'); idle(SETUP.idle, () => pulse($('#btnGo'), 2, 1.15));
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
    await setTurn('computer'); dimFan(true); miniStamp('SKIP', '#FF5A6E', 1450, 372); fx('fx-skip-smoke', 1450, 372, 420, { from: .4, to: 1.4, rot: 10, dur: 1.2 }); pose('robo', 'dizzy', 1800);
    await wait(1500); dimFan(false); await setTurn('learner');
  } else if (t === 'reverse') {
    /* Reverse turns the arrow */
    sfx('whoosh'); fx('fx-reverse-arrows', 960, 615, 460, { from: .6, to: 1.1, rot: 360, dur: .9, ease: 'power2.inOut' });
    await gsap.to('#turnPtr', { rotation: '+=180', duration: D(.45), ease: 'back.out(2)' }); await wait(700);
    await gsap.to('#turnPtr', { rotation: '+=180', duration: D(.45), ease: 'back.out(2)' }); gsap.set('#turnPtr', { rotation: -90 });
  } else if (t === 'draw') {
    /* Draw adds cards */
    for (let k = 0; k < 2; k++) { sfx('deal'); await fly(L.pile, L.stack, cardInner('cd-back', null, L.pile.w), { dur: .4, rot: 0 }); S.hand++; renderHand(); }
    pulse($('#cntYou'), 1, 1.12); await wait(700);
  } else {
    /* Swap exchanges hands */
    const fan = rectOf($('#roboFan')), hand = { x: 780, y: 800, w: 136, h: 194 }, f = [];
    sfx('whoosh');
    for (let k = 0; k < 4; k++) f.push(fly({ ...hand, x: hand.x + k * 40 }, { x: fan.x + 180, y: fan.y + 40, w: 96, h: 136 }, cardInner('cd-back', null, 136), { dur: .7 }));
    for (let k = 0; k < 4; k++) f.push(fly({ x: fan.x + 160 + k * 20, y: fan.y + 40, w: 96, h: 136 }, { ...hand, x: hand.x + k * 40 }, cardInner('cd-back', null, 96), { dur: .7 }));
    const mine = S.hand, theirs = S.comp; gsap.set(['#hand', '#roboFan'], { autoAlpha: 0 });
    await Promise.all(f); S.hand = theirs; S.comp = mine; renderHand(); renderFan(); gsap.set(['#hand', '#roboFan'], { autoAlpha: 1 }); await wait(500);
  }
}
/* "The cards are shuffled, the players are set": every card returns to the deck and 8 are dealt to each player */
async function reshuffle() {
  const g = GID; S.view = 'wait'; S.centre = null; S.played = null; renderCentre(); eqClear();
  const back = cardInner('cd-back', null, 136);
  const f = [fly({ x: 740, y: 820, w: 136, h: 194 }, L.pile, back, { dur: .45 }), fly(rectOf($('#roboFan')), L.pile, back, { dur: .45 })];
  S.hand = 0; S.comp = 0; renderHand(); renderFan(); await Promise.all(f);
  sfx('deal'); await gsap.to('#pile img', { keyframes: { x: [0, -40, 40, -20, 0], rotation: [0, -8, 8, -4, 0] }, stagger: .05, duration: D(.6) }); guard(g);
  S.hand = START_CARDS; S.comp = START_CARDS; renderHand({ deal: true }); renderFan(); gsap.from('#roboFan img', { y: 80, autoAlpha: 0, stagger: .04, duration: D(.35) });
  await wait(700);
}

/* ======================================================================
   PARTS 2 and 3: the scripted game
   ====================================================================== */
async function playGame(from = 0) {
  const parts = [PART2, PART3];
  for (let p = from; p < 2; p++) { S.part = p; renderProgress(); updateTint(); await runSteps(parts[p]); }
}
async function runSteps(steps) { for (let i = 0; i < steps.length; i++) await STEP[steps[i].t](steps[i], steps, i); }

const STEP = {
  /* Teaching: the game rule (learner observes) */
  async teach(st) {
    const g = GID, P = PARTS[st.part], scr = $('#scrTeach'), pan = scr.querySelector('.panel');
    S.view = 'wait'; renderHand(); ost(''); eqClear();
    pan.style.setProperty('--pc', P.color); pan.querySelector('.medal').src = A('rewards/medal-' + P.key + '-unlocked');
    pan.querySelector('h2').textContent = P.title; pan.querySelector('.how').textContent = P.teach; pan.querySelector('.rule').innerHTML = P.rule.join('<br>');
    scr.hidden = false; sfx('magic');
    await gsap.timeline().fromTo(scr, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.25) }).fromTo(pan, { y: 120, scale: .85 }, { y: 0, scale: 1, duration: D(.5), ease: 'back.out(1.6)' }, '<')
      .fromTo(pan.querySelector('.medal'), { scale: 0, rotation: -180 }, { scale: 1, rotation: 0, duration: D(.6), ease: 'back.out(2)' }, '-=.2');
    guard(g);
    await talk(P.teach); await wait(1200, true);
    await gsap.to(scr, { autoAlpha: 0, duration: D(.3) }); scr.hidden = true; guard(g);
  },

  /* Part 3 row 20: three number cards, brackets move, the answer stays 10 */
  async explain() {
    const g = GID, E = EXPLAIN, scr = $('#scrExplain'), pan = scr.querySelector('.panel'), [big, small] = pan.querySelectorAll('.xrow'), go = pan.querySelector('.go');
    S.view = 'wait'; renderHand(); ost('');
    const fill = (row, a, b, v) => { row.querySelector('.xa').innerHTML = `<span class="lay la">${spans(a)}</span><span class="lay lb">${spans(b)}</span>`; row.querySelector('.xval').textContent = '= ' + v; };
    fill(big, E.a, E.b, E.val); fill(small, E.ma, E.mb, E.mval); go.hidden = true; pan.querySelector('.xcap').textContent = '';
    gsap.set([big.querySelector('.xval'), small], { autoAlpha: 0 }); pan.querySelector('.pname').classList.remove('lit');
    scr.hidden = false;
    await gsap.timeline().fromTo(scr, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.25) }).fromTo(pan, { y: 120, scale: .85 }, { y: 0, scale: 1, duration: D(.5), ease: 'back.out(1.6)' }, '<'); guard(g);
    const parts = row => [[...row.querySelectorAll('.la .t')], [...row.querySelectorAll('.lb .t')]];
    /* the panel covers Flippy's bubble, so the VO line is captioned inside the panel too */
    const cap = pan.querySelector('.xcap'), line = t => { cap.textContent = t; gsap.fromTo(cap, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: D(.3) }); return say(t); };
    const [bA, bB] = parts(big); bB.forEach(e => e.style.visibility = 'hidden');
    /* 1: (2 + 3) + 5 = 10 */
    line(E.lines[0]);
    await gsap.timeline().from(bA.filter(e => e.classList.contains('n')), { y: -160, autoAlpha: 0, rotation: -20, stagger: .15, duration: D(.4), ease: 'back.out(1.8)', onStart: () => sfx('deal') })
      .from(bA.filter(e => !e.classList.contains('n')), { scale: 0, stagger: .08, duration: D(.3), ease: 'back.out(3)' }); guard(g);
    await wait(1400, true); await gsap.to(big.querySelector('.xval'), { autoAlpha: 1, duration: D(.3) }); sfx('good'); await wait(2000, true);
    /* 2: brackets shift to 3 and 5: still 10 */
    line(E.lines[1]); gsap.to(big.querySelector('.xval'), { autoAlpha: .25, duration: .2 });
    await morph(big.querySelector('.xa'), bA, bB, { keepA: false, glow: true, dur: 1 }); guard(g);
    sfx('good'); await gsap.fromTo(big.querySelector('.xval'), { autoAlpha: .25, scale: 1.4 }, { autoAlpha: 1, scale: 1, duration: D(.4), ease: 'back.out(3)' }); await wait(2600, true);
    /* 3: the property name glows */
    line(E.lines[2]); pan.querySelector('.pname').classList.add('lit'); sparkles(960, 330, 10, 260); sfx('magic'); await wait(4200, true);
    /* 4: it works for multiplication too */
    line(E.lines[3]);
    const [sA, sB] = parts(small); sB.forEach(e => e.style.visibility = 'hidden'); gsap.set(small.querySelector('.xval'), { autoAlpha: 0 });
    await gsap.to(small, { autoAlpha: 1, duration: D(.3) }); await wait(600);
    await morph(small.querySelector('.xa'), sA, sB, { keepA: false, glow: true, dur: .9 }); await gsap.to(small.querySelector('.xval'), { autoAlpha: 1, duration: D(.3) }); guard(g);
    await wait(1500, true);
    go.hidden = false; gsap.fromTo(go, { scale: 0 }, { scale: 1, duration: D(.4), ease: 'back.out(2.5)' }); go.focus();
    cap.textContent = '';
    idle(E.idle, () => { line(E.idle); pulse(go, 2, 1.12); });
    await waitFor('go'); idleOff(); go.hidden = true;
    line(E.ok); pose('flippy', 'cheer', 1600); sparkles(960, 330, 14, 300); sfx('magic'); await wait(1600, true);
    await gsap.to(scr, { autoAlpha: 0, duration: D(.3) }); scr.hidden = true; guard(g);
  },

  /* a matching challenge: three cards, one is the property match */
  async match(st) {
    const g = GID, P = S.part, v = ev(st.centre);
    await setTurn('learner'); eqClear(); dimHand(false);
    if (!S.centre || S.centre.text !== st.centre) { S.centre = { text: st.centre, p: P }; S.played = null; renderCentre(true); await wait(350); }
    S.opts = shuffle([{ text: st.right, correct: true }, ...st.wrongs.map(t => ({ text: t, correct: false }))]); const ci = S.opts.findIndex(o => o.correct);
    S.view = 'match'; S.glow = st.guided ? ci : -1; renderHand({ deal: true });
    ost(st.ost); say(st.vo);
    const pulseRight = () => pulse($(`#hand [data-opt="${ci}"]`), 2, 1.07);
    idle(st.idle, pulseRight);
    let wrong = 0, stuck = false, e;
    for (;;) {
      e = await waitFor('opt');
      if (Date.now() < S.lock) continue;
      if (S.opts[e.i].correct) break;
      /* wrong: the card shakes and returns */
      S.lock = Date.now() + 700; wrong++; S.stats.wrong++; sfx('bad'); pose('flippy', 'oops', 1500);
      { const r = rectOf(e.el); badge('wrong', r.x + r.w / 2, r.y + r.h / 2, 110, .4); }
      gsap.fromTo(e.el, { x: 0 }, { keyframes: { x: [-16, 16, -12, 10, -6, 0] }, duration: D(.45), ease: 'none' });
      if (stuck) { say(st.w3, true); pulseRight(); continue; }
      if (wrong === 1) say(WRONG1, true);
      else if (wrong === 2) { say(st.w2, true); eqShow(st.centre, st.right, v, { glow: true }).catch(() => { }); }
      else {
        /* third miss: draw one card from the glowing pile, then the correct card glows for a guided retry */
        stuck = true; idleOff(); eqClear(); await drawStuck(); guard(g);
        S.glow = ci; renderHand(); ost(st.ost); pose('flippy', 'point', 2400); say(`${STUCK.ok} ${st.w3}`, true);
        idle(st.idle, pulseRight);
      }
    }
    idleOff(); clearGlow();
    /* correct: the card moves to the centre pile, the numbers swap / the brackets move, both sides reveal the answer */
    sfx('good'); const r = rectOf(e.el); e.el.style.visibility = 'hidden';
    await fly(r, L.played, cardInner(frontImg(P), st.right, r.w), { rot: 6, trail: true });
    S.hand = Math.max(0, S.hand - 1); S.done[P]++; S.stats.correct++;
    S.played = { text: st.right, p: P }; S.view = 'wait'; S.opts = []; S.glow = -1; S.pairs[P].push({ a: st.centre, b: st.right, v });
    renderCentre(); renderHand(); renderProgress();
    gsap.fromTo('#playedCard', { scale: 1.12 }, { scale: 1, duration: D(.3), ease: 'back.out(3)' });
    badge('correct', L.played.x + L.played.w - 20, L.played.y + 30, 130); sparkles(L.played.x + 105, L.played.y + 150, 8, 130);
    if (st.confetti) confetti(24, L.played.x + 105, L.played.y + 100);
    pose('flippy', 'cheer', 1800); say(st.ok, true);
    await eqShow(st.centre, st.right, v); valueBadges(v);
    await wait(1900, true);
  },

  /* the computer plays a number card onto the centre pile: it becomes the learner's next card to match */
  async cpu(st, steps, i) {
    const g = GID, next = steps.slice(i + 1).find(s => s.t === 'match'), card = next ? next.centre : '2 + 2';
    S.view = 'wait'; renderHand(); await setTurn('computer'); dimFan(false);
    ost(st.ost); say(st.vo); pose('robo', 'think'); await wait(1500, true);
    pose('robo', 'play', 1400);
    await handThrow('robo', cardInner(frontImg(S.part), card, 150), L.centre);
    S.comp = Math.max(0, S.comp - 1); S.centre = { text: card, p: S.part }; S.played = null; eqClear(); renderCentre(); renderFan();
    sparkles(L.centre.x + 105, L.centre.y + 150, 6, 110);
    await talk(st.ok); guard(g);
  },

  /* the computer plays Reverse or Skip: the learner's turn is missed */
  async cpuAct(st) {
    const g = GID; S.view = 'wait'; renderHand(); await setTurn('computer'); eqClear();
    ost(st.ost); pose('robo', 'play', 1400);
    await handThrow('robo', actInner(st.act, 150), L.played);
    S.comp = Math.max(0, S.comp - 1); S.played = { act: st.act }; renderCentre(); renderFan();
    pose('robo', 'laugh', 2600); say(st.vo);
    const blue = '#5AB0FF', red = '#FF5A6E';
    if (st.act === 'reverse') { sfx('whoosh'); fx('fx-reverse-arrows', L.played.x + 105, L.played.y + 150, 460, { from: .6, to: 1.1, rot: -360, dur: .9, ease: 'power2.inOut' }); sheet('screen-edge-good', 960, 540, 1920); await stamp('REVERSE!', blue, .5); }
    else { fx('fx-skip-smoke', 960, 920, 620, { from: .4, to: 1.4, rot: 10, dur: 1.2 }); sheet('screen-edge-bad', 960, 540, 1920); await stamp('SKIP!', red, .5); }
    /* the learner's cards dim and the turn arrow returns to the computer */
    await setTurn('learner'); dimHand(true);
    if (st.act === 'skip') miniStamp('SKIP', red, 830, 900); else gsap.to('#turnPtr', { rotation: '+=360', duration: D(.6), ease: 'power2.inOut', onComplete: () => gsap.set('#turnPtr', { rotation: -90 }) });
    await wait(1600, true);
    await setTurn('computer'); dimHand(false);
    await talk(st.ok); guard(g);
  },

  /* a special card appears in the learner's hand and the learner plays it */
  async give(st) {
    const g = GID; await setTurn('learner'); eqClear(); S.view = 'special';
    ost(st.ost); pose('flippy', 'point', 2400); say(st.vo, true);
    sfx('deal'); await handThrow('flippy', actInner(st.act, 150), L.act);
    S.special = st.act; renderHand();
    const el = () => $('#hand [data-act]');
    idle(st.idle, () => st.act === 'reverse' ? gsap.fromTo(el(), { rotation: 2 }, { rotation: 362, duration: 1, ease: 'power1.inOut' }) : st.act === 'skip' ? bounce(el()) : pulse(el(), 2, 1.1));
    const e = await waitFor('act'); idleOff(); clearGlow();
    const r = rectOf(e.el); e.el.style.visibility = 'hidden';
    await fly(r, L.played, actInner(st.act, r.w), { rot: st.act === 'reverse' ? 368 : 8, trail: true, dur: .6 });
    S.special = null; S.played = { act: st.act }; S.view = 'wait'; renderCentre(); renderHand();
    const cx = L.played.x + 105, cy = L.played.y + 150;
    if (st.act === 'skip') {
      /* computer's cards dim with a red SKIP stamp; the turn arrow returns to the learner */
      sheet('impact-ring', cx, cy, 460); fx('fx-skip-smoke', 1450, 372, 460, { from: .4, to: 1.4, rot: 10, dur: 1.2 }); sparkles(cx, cy, 8, 140);
      await setTurn('computer'); dimFan(true); miniStamp('SKIP', '#FF5A6E', 1450, 372); pose('robo', 'dizzy', 2400);
      say(st.ok, true); pose('flippy', 'cheer', 1800); await wait(1800, true);
      await setTurn('learner'); dimFan(false); await wait(900, true);
    } else if (st.act === 'reverse') {
      /* arrow spins back towards the learner; the computer's turn is skipped */
      sfx('whoosh'); fx('fx-reverse-arrows', cx, cy, 460, { from: .6, to: 1.1, rot: 360, dur: .9, ease: 'power2.inOut' }); sparkles(cx, cy, 10, 160);
      await setTurn('computer'); await gsap.to('#turnPtr', { rotation: '+=360', duration: D(.5) }); gsap.set('#turnPtr', { rotation: -90 }); await setTurn('learner');
      say(st.ok, true); pose('flippy', 'cheer', 1800); await stamp('PLAY AGAIN!', '#5AB0FF', .6); await wait(1200, true);
    } else {
      /* Mystery: flips to reveal a golden DROP 1; the learner discards one more card */
      await revealCard('cd-mystery-reveal-associative', 'DROP 1', L.played); guard(g);
      S.played = { act: 'mystery' }; renderCentre();
      sparkles(960, 450, 14, 260); fx('fx-star-burst', 960, 450, 600, { dur: 1 }); sfx('good');
      pose('flippy', 'cheer', 1800); say(st.ok, true);
      S.drop = shuffle(FILLER[1]).slice(0, 3); S.view = 'drop'; renderHand({ deal: true });
      idle(st.ok, () => gsap.to('#hand [data-opt]', { rotation: '+=3', duration: .15, yoyo: true, repeat: 5 }));
      const d = await waitFor('opt'); idleOff();
      const dr = rectOf(d.el); d.el.style.visibility = 'hidden';
      await fly(dr, L.pile, cardInner(frontImg(S.part), S.drop[d.i], dr.w), { rot: -20, dur: .5 });
      S.hand = Math.max(0, S.hand - 1); S.drop = []; S.view = 'wait'; renderHand();
      sparkles(L.pile.x + 105, L.pile.y + 150, 10, 160); sfx('magic'); await wait(1200, true);
    }
  },

  /* FLIP: the card lands on the centre pile, every card flips to the bracket side */
  async flip(st) {
    const g = GID; S.view = 'wait'; renderHand(); await setTurn('learner'); eqClear(); ost(st.ost);
    sfx('whoosh'); await fly(L.pile, L.centre, cardInner('cd-flip', null, L.pile.w), { dur: .6, rot: 0, trail: true });
    S.centre = { flip: true }; S.played = null; renderCentre();
    say(st.vo); pose('flippy', 'point', 2000);
    const c = $('#centreCard'), gk = glowAt(rectOf(c), 1.6), wob = gsap.to(c, { scale: 1.05, duration: .6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    idle(st.idle, () => pulse($('#centreCard'), 2, 1.12));
    await waitFor('centre'); idleOff(); gk(); wob.kill();
    /* new cards with brackets: a fresh hand of 9 (8 matches + the Mystery drop), the computer back to 8 */
    sfx('magic'); sheet('level-up-burst', 960, 615, 900); fx('fx-star-burst', 960, 615, 800, { dur: 1 }); sparkles(960, 615, 16, 300); shake(8);
    S.drop = FILLER[0].slice(0, 3); S.view = 'show'; renderHand(); await wait(300);
    await allFlip(() => {
      S.part = 1; S.hand += 9; S.comp = START_CARDS; S.drop = FILLER[1].slice(0, 3); S.centre = null;
      renderHand(); renderFan(); renderCentre(); renderProgress(); updateTint();
    });
    say(st.ok, true); pose('flippy', 'cheer', 1800); await stamp('FLIP!', '#FFC83D', .5); await wait(1200, true);
    S.view = 'wait'; renderHand(); guard(g);
  },

  /* Part 3 row 39: all eight pairs around the centre pile */
  async complete(st) {
    const g = GID; S.over = true; S.view = 'wait'; renderHand(); ost(st.ost); eqClear(); idleOff();
    const scr = $('#scrWin'), ring = scr.querySelector('.ring'), pairs = S.pairs[1].length ? S.pairs[1] : PART3.filter(s => s.t === 'match').map(s => ({ a: s.centre, b: s.right, v: ev(s.centre) }));
    ring.innerHTML = pairs.map((p, i) => `<div class="pair" style="left:${i < 4 ? 70 : 1250}px;top:${200 + (i % 4) * 118}px"><span class="pa">${spans(p.a)}</span><span class="t o">=</span><span class="pb">${spans(p.b)}</span><small>${p.v}</small></div>`).join('');
    const acc = S.stats.correct + S.stats.wrong ? S.stats.correct / (S.stats.correct + S.stats.wrong) : 1, stars = acc >= .9 ? 3 : acc >= .7 ? 2 : 1;
    scr.querySelector('.rating').innerHTML = [0, 1, 2].map(i => `<img class="st ${i === 1 ? 'mid' : ''}" src="${A('rewards/star-' + (i < stars ? 'filled' : 'empty'))}" alt="">`).join('');
    scr.hidden = false; sfx('levelup'); pose('robo', 'sad');
    const chips = [...ring.children];
    gsap.set(chips, { autoAlpha: 0 }); gsap.set(['#btnAgain', '#btnHome', scr.querySelector('.rating')], { autoAlpha: 0 });
    await gsap.timeline().fromTo(scr, { autoAlpha: 0 }, { autoAlpha: 1, duration: D(.4) })
      .fromTo(scr.querySelector('h2'), { scale: 0 }, { scale: 1, duration: D(.5), ease: 'back.out(2)' })
      .fromTo(scr.querySelector('.pcard'), { scale: 0, rotation: -20 }, { scale: 1, rotation: 0, duration: D(.5), ease: 'back.out(2)' }, '-=.2');
    guard(g);
    say(st.vo, true); gsap.to('#scrWin .rays', { rotation: 360, duration: 24, repeat: -1, ease: 'none' });
    /* correct pairs animate one after another; brackets jump between the numbers */
    for (const c of chips) {
      const Ael = [...c.querySelectorAll('.pa .t')], Bel = [...c.querySelectorAll('.pb .t')];
      Bel.forEach(e => e.style.visibility = 'hidden');
      gsap.fromTo(c, { autoAlpha: 0, scale: .6 }, { autoAlpha: 1, scale: 1, duration: D(.3), ease: 'back.out(2.4)' }); sfx('star');
      await wait(250); morph(c, Ael, Bel, { dur: .6 }); await wait(420);
    }
    guard(g);
    /* the Associative Property card glows; level-complete confetti */
    scr.querySelector('.pcard').classList.add('lit'); sfx('win'); confetti(90); sheet('confetti', 700, 420, 1200); sheet('confetti', 1220, 420, 1200); sheet('screen-edge-good', 960, 540, 1920);
    sparkles(960, 440, 16, 300); say(st.ok, true); pose('flippy', 'cheer');
    gsap.to(scr.querySelector('.rating'), { autoAlpha: 1, duration: .3 }); gsap.from(scr.querySelectorAll('.rating img'), { scale: 0, rotation: -90, stagger: .1, duration: D(.4), ease: 'back.out(2.5)' });
    gsap.fromTo(['#btnAgain', '#btnHome'], { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, stagger: .1, duration: D(.35), ease: 'back.out(2.5)', delay: .6 });
  }
};

/* "Draw When Stuck": after three misses the draw pile glows; the learner taps it and draws one penalty card */
async function drawStuck() {
  const g = GID, pile = $('#pile'), hand = $('#hand');
  hand.classList.add('locked'); ost(STUCK.ost); sheet('screen-edge-bad', 960, 540, 1920); pose('flippy', 'oops', 2000); say(STUCK.vo, true);
  pile.classList.add('live'); const gk = glowAt(L.pile, 1.5);
  idle(STUCK.idle, () => pulse(pile, 2, 1.08));
  try { await waitFor('pile'); } finally { idleOff(); gk(); pile.classList.remove('live'); }
  sfx('deal'); await fly(L.pile, L.stack, cardInner('cd-back', null, L.pile.w), { dur: .5, rot: 0 });
  sfx('pop'); S.hand++; S.stats.drawn++; hand.classList.remove('locked'); guard(g);
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
  $('#fxLayer').innerHTML = ''; $('#preview')?.remove(); $('#flipPreview')?.remove(); hideGo();
  gsap.set('#stamp', { autoAlpha: 0 }); gsap.set(['#world', '#centre', '#hand', '#bubble', '#roboFan', '#turnPtr', '#equation', '#ost'], { clearProps: 'all' });
  $('#hand').classList.remove('locked'); $('#pile').classList.remove('live'); $('#equation').innerHTML = '';
  try { speechSynthesis.cancel(); } catch (e) { }
}
/* start a part directly (Play again, tester jumps) */
async function startPart(p) {
  resetMotion();
  ['#scrTitle', '#scrTeach', '#scrExplain', '#scrPause', '#scrWin', '#qa'].forEach(s => $(s).hidden = true);
  fresh(); S.part = p; if (p === 1) { S.hand = 9; S.done[0] = MATCHES[0]; }
  renderAll(); breathe(); pose('flippy', 'idle'); pose('robo', 'idle'); ost('');
  await setTurn('learner', true); $('#turnPtr').style.opacity = '';
  try { await playGame(p); } catch (e) { if (e !== STALE) console.error(e); }
}
async function jumpHow() {
  resetMotion(); ['#scrTitle', '#scrTeach', '#scrExplain', '#scrPause', '#scrWin', '#qa'].forEach(s => $(s).hidden = true);
  fresh(); renderAll(); breathe(); await setTurn('learner', true); $('#turnPtr').style.opacity = '';
  try { await howTo(); } catch (e) { if (e !== STALE) console.error(e); }
}
async function jumpComplete() {
  resetMotion(); ['#scrTitle', '#scrTeach', '#scrExplain', '#scrPause', '#qa'].forEach(s => $(s).hidden = true);
  fresh(); S.part = 1; S.done = [...MATCHES]; S.hand = 0; renderAll(); breathe();
  try { await STEP.complete(PART3[PART3.length - 1]); } catch (e) { if (e !== STALE) console.error(e); }
}

let paused = false;
function openPause() {
  if (!S || S.over || paused || !$('#scrTitle').hidden) return; paused = true; syncOpts();
  gsap.globalTimeline.pause(); try { speechSynthesis.pause(); } catch (e) { }
  const p = $('#scrPause'); p.hidden = false; gsap.set(p, { autoAlpha: 1 });
}
function closePause() { paused = false; $('#scrPause').hidden = true; gsap.globalTimeline.resume(); try { speechSynthesis.resume(); } catch (e) { } }
$('#btnPause').addEventListener('click', () => { audioInit(); sfx('pop'); openPause(); });
$('#btnResume').addEventListener('click', () => { sfx('pop'); closePause(); });
$('#btnRestart').addEventListener('click', () => { startPart(0); });
$('#btnSound').addEventListener('click', () => { audioInit(); opts.sound = !opts.sound; $('#btnSound img').src = A('ui/ui-icon-sound-' + (opts.sound ? 'on' : 'off')); sfx('pop'); });
$('#btnAgain').addEventListener('click', () => { sfx('pop'); startPart(0); });
$('#btnHome').addEventListener('click', () => { sfx('pop'); hook(); });
function syncOpts() { ['#optVoice', '#optVoice2'].forEach(s => $(s).checked = opts.voice); }
['#optVoice', '#optVoice2'].forEach(s => $(s).addEventListener('change', e => { opts.voice = e.target.checked; syncOpts(); if (!opts.voice) try { speechSynthesis.cancel(); } catch (_) { } }));
document.addEventListener('pointerdown', audioInit, { once: true });

/* QA jump menu (press Q) */
const JUMPS = [['Hook', '#F06A2B', hook], ['How to play', '#8B5CF6', jumpHow], ['Part 2 · Commutative', PARTS[0].color, () => startPart(0)], ['Part 3 · Associative', PARTS[1].color, () => startPart(1)], ['Complete', '#555', jumpComplete]];
function buildJump(el) {
  el.innerHTML = JUMPS.map(([n, c], i) => `<button style="--pc:${c}" data-j="${i}">${n}</button>`).join('');
  el.onclick = e => { const b = e.target.closest('[data-j]'); if (!b) return; audioInit(); JUMPS[+b.dataset.j][2](); };
}
$$('.jump').forEach(buildJump);
document.addEventListener('keydown', e => {
  if (e.key === 'q' || e.key === 'Q') { const q = $('#qa'); q.hidden = !q.hidden; }
  if (e.key === 'Escape') { if (paused) closePause(); else openPause(); }
});
/* tester deep links: index.html#part2, #part3, #how, #complete */
const deep = { '#how': jumpHow, '#part2': () => startPart(0), '#part3': () => startPart(1), '#complete': jumpComplete }[location.hash];

window.claude?.hot?.snapshot?.(() => ({}));
window.NF_DEBUG = { get S() { return S; }, tap };

if (deep) deep(); else hook();
})();
