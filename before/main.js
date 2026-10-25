(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const audio = $('audio'), play = $('play'), lineEl = $('line'), bar = $('bar');
  const toggle = $('toggle'), track = $('track'), fill = $('fill'), timeEl = $('time');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const SECTIONS = window.BEFORE_LYRICS;
  const TIMING = window.BEFORE_TIMING;

  if (coarse) $('hint').textContent = 'Tap to listen';

  // Full lyrics below the fold.
  const lyricNodes = [];
  const lyricsSection = $('lyrics');
  SECTIONS.forEach((s, si) => {
    if (!s.lines.length) return;
    const block = document.createElement('div');
    block.className = 'block';
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = s.tag;
    const p = document.createElement('p');
    s.lines.forEach((text, li) => {
      const span = document.createElement('span');
      span.textContent = text;
      p.appendChild(span);
      if (li < s.lines.length - 1) p.appendChild(document.createElement('br'));
      lyricNodes.push({ si, li, span });
    });
    block.append(tag, p);
    lyricsSection.appendChild(block);
  });

  // Live line, cross-faded between two stacked spans.
  const slots = lineEl.querySelectorAll('span');
  let slot = 0, shown = null;
  function showLine(text) {
    if (text === shown) return;
    shown = text;
    slots[slot].classList.remove('on');
    slot = 1 - slot;
    slots[slot].textContent = text || '';
    if (text) slots[slot].classList.add('on');
  }

  function current(t) {
    if (!TIMING) return { level: SECTIONS[0].level, text: null, key: null };
    let si = 0;
    for (let i = 0; i < TIMING.sections.length; i++) if (t >= TIMING.sections[i]) si = i;
    let text = null, key = null;
    TIMING.lines.forEach((pairs, s) => pairs.forEach(([a, b], l) => {
      if (t >= a && t < b) { text = SECTIONS[s].lines[l]; key = s + ':' + l; }
    }));
    (TIMING.echoes || []).forEach(([a, b, line]) => { if (t >= a && t < b) text = line; });
    return { level: SECTIONS[si].level, text, key };
  }

  let highlighted = null;
  function highlight(key) {
    if (key === highlighted) return;
    highlighted = key;
    lyricNodes.forEach((n) => n.span.classList.toggle('now', key === n.si + ':' + n.li));
  }

  // Audio graph is created on the first click (browsers block it before that).
  let ctx = null, analyser = null, bins = null;
  function ensureAudioGraph() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const src = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    bins = new Uint8Array(analyser.frequencyBinCount);
    ctx.addEventListener('statechange', () => {
      if (ctx.state !== 'running' && !audio.paused) ctx.resume();
    });
  }

  function fmt(s) {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + String(r).padStart(2, '0');
  }

  function start() {
    ensureAudioGraph();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    audio.play().then(() => {
      document.body.classList.add('is-started');
      bar.hidden = false;
      play.setAttribute('aria-label', 'Before is playing');
      play.tabIndex = -1;
    }).catch(() => {});
  }
  play.addEventListener('click', () => { if (!document.body.classList.contains('is-started')) start(); });
  document.querySelectorAll('.links a').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
  }));
  toggle.addEventListener('click', () => {
    if (audio.paused) { if (ctx) ctx.resume(); audio.play(); } else audio.pause();
  });
  audio.addEventListener('play', () => { toggle.textContent = 'Pause'; });
  audio.addEventListener('pause', () => { toggle.textContent = 'Play'; });
  audio.addEventListener('ended', () => { toggle.textContent = 'Replay'; showLine(null); highlight(null); });

  function seekTo(clientX) {
    const r = track.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    if (isFinite(audio.duration)) audio.currentTime = f * audio.duration;
  }
  track.addEventListener('pointerdown', (e) => {
    seekTo(e.clientX);
    track.setPointerCapture(e.pointerId);
    const move = (ev) => seekTo(ev.clientX);
    const up = () => { track.removeEventListener('pointermove', move); track.removeEventListener('pointerup', up); };
    track.addEventListener('pointermove', move);
    track.addEventListener('pointerup', up);
  });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
    if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
  });

  // Paint.
  const canvas = $('paint');
  const img = new Image();
  img.src = 'cover.jpg';
  img.decode().then(() => {
    let fluid = null;
    try { fluid = window.BeforeFluid.create(canvas, img); } catch (e) { fluid = null; }
    if (!fluid) { document.body.classList.add('no-gl'); return; }
    run(fluid);
  }).catch(() => document.body.classList.add('no-gl'));

  function run(fluid) {
    const queue = [];
    let last = null;
    function push(clientX, clientY, force) {
      const x = clientX / innerWidth, y = 1 - clientY / innerHeight;
      if (last) {
        const aspect = innerWidth / innerHeight;
        let dx = x - last.x, dy = y - last.y;
        if (aspect < 1) dx *= aspect;
        if (aspect > 1) dy /= aspect;
        if (Math.abs(dx) + Math.abs(dy) > 0) queue.push([x, y, dx * force, dy * force, 0.32]);
      }
      last = { x, y };
    }
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') push(e.clientX, e.clientY, 5200);
    }, { passive: true });
    window.addEventListener('touchstart', (e) => { last = null; push(e.touches[0].clientX, e.touches[0].clientY, 4500); }, { passive: true });
    window.addEventListener('touchmove', (e) => { push(e.touches[0].clientX, e.touches[0].clientY, 4500); }, { passive: true });
    window.addEventListener('touchend', () => { last = null; }, { passive: true });
    window.addEventListener('pointerleave', () => { last = null; });

    let prev = performance.now(), nextAmbient = 0, bassAvg = 0, glow = 0, lastOnset = 0, energy = 0, clock = 0;
    const calm = reduced ? 0.4 : 1;
    // Two invisible currents wander across the canvas and drag the paint along.
    const drifters = [
      { a: 0.23, b: 0.19, c: 0.71, d: 0.53, p: 0 },
      { a: 0.17, b: 0.29, c: 0.61, d: 0.37, p: 2.1 },
    ];
    function drift(dt, strength) {
      drifters.forEach((d, i) => {
        if (i === 1 && strength < 30) return;
        const t = clock + d.p;
        const x = 0.5 + 0.32 * Math.sin(t * d.a) + 0.08 * Math.sin(t * d.c);
        const y = 0.5 + 0.28 * Math.cos(t * d.b) + 0.1 * Math.sin(t * d.d);
        if (d.x !== undefined) {
          const vx = x - d.x, vy = y - d.y, len = Math.hypot(vx, vy) || 1;
          queue.push([x, y, (vx / len) * strength * dt * 60, (vy / len) * strength * dt * 60, 1.4]);
        }
        d.x = x; d.y = y;
      });
    }
    let intensity = 0.48, hover = 0;
    play.addEventListener('pointerenter', () => { hover = 1; });
    play.addEventListener('pointerleave', () => { hover = 0; });

    function ambient(force) {
      const a = Math.random() * Math.PI * 2;
      const x = 0.15 + Math.random() * 0.7, y = 0.15 + Math.random() * 0.7;
      queue.push([x, y, Math.cos(a) * force, Math.sin(a) * force, 0.6]);
    }

    function frame(now) {
      const dt = Math.min((now - prev) / 1000, 1 / 30);
      prev = now;
      const playing = !audio.paused && !audio.ended;
      const t = audio.currentTime;

      let level = 0.48 + hover * 0.12;
      if (playing || t > 0) {
        const c = current(t);
        level = c.level;
        if (playing) { showLine(c.text); highlight(c.key); }
      }

      if (playing && analyser) {
        analyser.getByteFrequencyData(bins);
        let b = 0;
        for (let i = 1; i <= 4; i++) b += bins[i];
        b /= 4 * 255;
        bassAvg += (b - bassAvg) * Math.min(1, dt * 1.5);
        let e = 0;
        for (let i = 1; i < 96; i++) e += bins[i];
        energy += (e / (95 * 255) - energy) * Math.min(1, dt * 4);
        glow += (Math.max(0, b - bassAvg) * 3 - glow) * Math.min(1, dt * 8);
        if (!reduced && b - bassAvg > 0.1 && now - lastOnset > 380) {
          lastOnset = now;
          ambient(350 + 2200 * (b - bassAvg));
        }
      } else {
        glow += (0 - glow) * Math.min(1, dt * 3);
        energy += (0 - energy) * Math.min(1, dt * 2);
      }

      clock += dt * (playing ? 1 + energy * 2.5 : 0.6);
      drift(dt, calm * (playing ? 9 + 40 * energy : 8));
      fluid.cfg.heal = playing ? 0.35 : 0.45;

      if (now > nextAmbient) {
        ambient(calm * (playing ? 420 : 260));
        nextAmbient = now + (playing ? 1100 : 1800) + Math.random() * 1400;
      }

      intensity += (level - intensity) * Math.min(1, dt * 0.9);
      while (queue.length) fluid.splat(...queue.shift());
      fluid.frame(dt, intensity, Math.min(glow, 1));

      if (isFinite(audio.duration) && audio.duration > 0) {
        fill.style.width = (t / audio.duration) * 100 + '%';
        track.setAttribute('aria-valuenow', Math.round((t / audio.duration) * 100));
        timeEl.textContent = fmt(t);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();
