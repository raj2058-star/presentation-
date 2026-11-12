/* AppleLab — synthesized instruments and drum kits (no samples required) */
window.AL = window.AL || {};

AL.instruments = (() => {
  const { midiToFreq } = AL.util;

  // Each preset: oscillators, amp envelope (seconds / sustain level), filter with envelope.
  const presets = {
    keys: {
      name: 'Studio Keys',
      osc: [{ type: 'triangle', gain: 0.55 }, { type: 'sine', gain: 0.35, octave: 1 }, { type: 'sine', gain: 0.12, octave: 2 }],
      env: { a: 0.004, d: 1.6, s: 0.0, r: 0.35 },
      filter: { type: 'lowpass', freq: 1800, q: 0.6, env: 3500, decay: 0.6, keytrack: 0.5 },
      level: 0.5,
    },
    epiano: {
      name: 'Electric Piano',
      osc: [{ type: 'sine', gain: 0.6 }, { type: 'sine', gain: 0.18, ratio: 14.0, decay: 0.08 }, { type: 'triangle', gain: 0.18, octave: 1 }],
      env: { a: 0.003, d: 2.2, s: 0.15, r: 0.4 },
      filter: { type: 'lowpass', freq: 3000, q: 0.4, env: 1500, decay: 0.4, keytrack: 0.3 },
      level: 0.55,
    },
    lead: {
      name: 'Saw Lead',
      osc: [{ type: 'sawtooth', gain: 0.4, detune: -7 }, { type: 'sawtooth', gain: 0.4, detune: 7 }, { type: 'square', gain: 0.15, octave: -1 }],
      env: { a: 0.01, d: 0.25, s: 0.7, r: 0.18 },
      filter: { type: 'lowpass', freq: 1200, q: 4, env: 3000, decay: 0.3, keytrack: 0.4 },
      level: 0.32,
      glide: 0,
    },
    bass: {
      name: 'Sub Bass',
      osc: [{ type: 'square', gain: 0.35 }, { type: 'sine', gain: 0.6, octave: -1 }],
      env: { a: 0.005, d: 0.3, s: 0.75, r: 0.12 },
      filter: { type: 'lowpass', freq: 380, q: 3, env: 900, decay: 0.18, keytrack: 0.1 },
      level: 0.55,
    },
    pad: {
      name: 'Warm Pad',
      osc: [{ type: 'sawtooth', gain: 0.25, detune: -12 }, { type: 'sawtooth', gain: 0.25, detune: 12 }, { type: 'triangle', gain: 0.3, octave: -1 }],
      env: { a: 0.6, d: 1.0, s: 0.8, r: 1.4 },
      filter: { type: 'lowpass', freq: 900, q: 1, env: 600, decay: 1.5, keytrack: 0.3 },
      level: 0.3,
    },
    pluck: {
      name: 'Pluck',
      osc: [{ type: 'sawtooth', gain: 0.45 }, { type: 'square', gain: 0.2, octave: 1, detune: 5 }],
      env: { a: 0.002, d: 0.35, s: 0.0, r: 0.15 },
      filter: { type: 'lowpass', freq: 500, q: 6, env: 5000, decay: 0.12, keytrack: 0.5 },
      level: 0.4,
    },
    organ: {
      name: 'Tone Organ',
      osc: [{ type: 'sine', gain: 0.4 }, { type: 'sine', gain: 0.3, octave: 1 }, { type: 'sine', gain: 0.2, ratio: 3 }, { type: 'sine', gain: 0.15, octave: 2 }],
      env: { a: 0.01, d: 0.1, s: 1.0, r: 0.08 },
      filter: { type: 'lowpass', freq: 6000, q: 0.3, env: 0, decay: 0.1, keytrack: 0 },
      level: 0.32,
    },
    strings: {
      name: 'String Section',
      osc: [{ type: 'sawtooth', gain: 0.22, detune: -9 }, { type: 'sawtooth', gain: 0.22, detune: 0 }, { type: 'sawtooth', gain: 0.22, detune: 9 }],
      env: { a: 0.25, d: 0.6, s: 0.85, r: 0.7 },
      filter: { type: 'lowpass', freq: 2200, q: 0.5, env: 400, decay: 0.8, keytrack: 0.4 },
      level: 0.3,
      vibrato: { rate: 5.2, depth: 6 },
    },
    bell: {
      name: 'Glass Bell',
      osc: [{ type: 'sine', gain: 0.5 }, { type: 'sine', gain: 0.25, ratio: 3.5, decay: 0.6 }, { type: 'sine', gain: 0.15, ratio: 7.1, decay: 0.25 }],
      env: { a: 0.002, d: 2.8, s: 0.0, r: 1.2 },
      filter: { type: 'highpass', freq: 200, q: 0.5, env: 0, decay: 0.1, keytrack: 0 },
      level: 0.4,
    },
  };

  /**
   * Start a voice. Returns a handle with release(time) and stop().
   */
  function noteOn(ctx, dest, presetId, midi, time, velocity = 0.8) {
    const p = presets[presetId] || presets.keys;
    const t = Math.max(time, ctx.currentTime);
    const freq = midiToFreq(midi);
    const vel = Math.max(0.05, Math.min(1, velocity));

    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = p.filter.type;
    filter.Q.value = p.filter.q;
    const keyFactor = Math.pow(freq / 261.63, p.filter.keytrack || 0);
    const baseF = Math.min(18000, p.filter.freq * keyFactor);
    const peakF = Math.min(18000, baseF + p.filter.env * vel);
    filter.frequency.setValueAtTime(peakF, t);
    filter.frequency.setTargetAtTime(baseF, t + 0.001, Math.max(0.01, p.filter.decay / 3));

    const peak = p.level * vel;
    const e = p.env;
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(peak, t + e.a);
    amp.gain.setTargetAtTime(peak * e.s, t + e.a, Math.max(0.01, e.d / 3));

    filter.connect(amp);
    amp.connect(dest);

    const sources = [];
    let vib = null;
    if (p.vibrato) {
      vib = ctx.createOscillator();
      vib.frequency.value = p.vibrato.rate;
      const vg = ctx.createGain();
      vg.gain.setValueAtTime(0, t);
      vg.gain.linearRampToValueAtTime(p.vibrato.depth, t + 0.6);
      vib.connect(vg);
      vib._depth = vg;
      vib.start(t);
      sources.push(vib);
    }
    for (const o of p.osc) {
      const osc = ctx.createOscillator();
      osc.type = o.type;
      let f = freq * Math.pow(2, o.octave || 0) * (o.ratio || 1);
      osc.frequency.setValueAtTime(Math.min(f, 20000), t);
      if (o.detune) osc.detune.setValueAtTime(o.detune, t);
      if (vib) vib._depth.connect(osc.detune);
      const g = ctx.createGain();
      g.gain.setValueAtTime(o.gain, t);
      if (o.decay) g.gain.setTargetAtTime(0, t, o.decay / 3);
      osc.connect(g);
      g.connect(filter);
      osc.start(t);
      sources.push(osc);
    }

    let released = false;
    const handle = {
      endTime: Infinity,
      release(rt) {
        if (released) return;
        released = true;
        rt = Math.max(rt, ctx.currentTime);
        if (amp.gain.cancelAndHoldAtTime) amp.gain.cancelAndHoldAtTime(rt);
        else amp.gain.cancelScheduledValues(rt);
        amp.gain.setTargetAtTime(0, rt, Math.max(0.005, e.r / 4));
        const stopAt = rt + e.r * 1.6 + 0.05;
        handle.endTime = stopAt;
        sources.forEach((s) => { try { s.stop(stopAt); } catch (_) {} });
      },
      stop() {
        const now = ctx.currentTime;
        try {
          amp.gain.cancelScheduledValues(now);
          amp.gain.setValueAtTime(amp.gain.value, now);
          amp.gain.linearRampToValueAtTime(0, now + 0.02);
        } catch (_) {}
        sources.forEach((s) => { try { s.stop(now + 0.03); } catch (_) {} });
        handle.endTime = now;
      },
    };
    return handle;
  }

  function playNote(ctx, dest, presetId, midi, time, duration, velocity) {
    const h = noteOn(ctx, dest, presetId, midi, time, velocity);
    h.release(time + Math.max(0.02, duration));
    return h;
  }

  // ---------------- Drums ----------------
  const drumPads = [
    { id: 'kick', name: 'Kick', key: 36 },
    { id: 'snare', name: 'Snare', key: 38 },
    { id: 'clap', name: 'Clap', key: 39 },
    { id: 'chh', name: 'Closed Hat', key: 42 },
    { id: 'ohh', name: 'Open Hat', key: 46 },
    { id: 'tomL', name: 'Low Tom', key: 45 },
    { id: 'tomH', name: 'High Tom', key: 48 },
    { id: 'perc', name: 'Cowbell', key: 56 },
  ];

  const kits = {
    classic: { name: 'Classic Kit', pitch: 1, decay: 1, tone: 1, crush: 0 },
    deep: { name: 'Deep Boom Kit', pitch: 0.78, decay: 1.9, tone: 0.8, crush: 0 },
    tight: { name: 'Tight Kit', pitch: 1.2, decay: 0.6, tone: 1.3, crush: 0 },
    lofi: { name: 'Lo-Fi Kit', pitch: 0.92, decay: 1.1, tone: 0.55, crush: 1 },
  };

  const noiseCache = new WeakMap();
  function noiseBuffer(ctx) {
    let b = noiseCache.get(ctx);
    if (b) return b;
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.5), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
    return b;
  }

  function envGain(ctx, t, peak, decay, attack = 0.001) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + attack + decay);
    return g;
  }

  function noiseSrc(ctx, t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
    return s;
  }

  function playDrum(ctx, dest, padIndex, time, velocity = 0.9, kitId = 'classic') {
    const k = kits[kitId] || kits.classic;
    const t = Math.max(time, ctx.currentTime);
    const v = Math.max(0.05, Math.min(1, velocity));
    let out = dest;
    if (k.crush) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 4200;
      lp.connect(dest);
      out = lp;
    }
    const pad = drumPads[padIndex];
    if (!pad) return;
    switch (pad.id) {
      case 'kick': {
        const dec = 0.45 * k.decay;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(160 * k.pitch, t);
        o.frequency.exponentialRampToValueAtTime(42 * k.pitch, t + 0.12);
        const g = envGain(ctx, t, 1.0 * v, dec);
        o.connect(g).connect(out);
        o.start(t); o.stop(t + dec + 0.05);
        // click
        const c = noiseSrc(ctx, t, 0.02);
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2000;
        const cg = envGain(ctx, t, 0.25 * v * k.tone, 0.012);
        c.connect(hp).connect(cg).connect(out);
        break;
      }
      case 'snare': {
        const dec = 0.2 * k.decay;
        const n = noiseSrc(ctx, t, dec);
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200 * k.tone;
        const ng = envGain(ctx, t, 0.6 * v, dec);
        n.connect(hp).connect(ng).connect(out);
        const o = ctx.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(220 * k.pitch, t);
        o.frequency.exponentialRampToValueAtTime(160 * k.pitch, t + 0.08);
        const og = envGain(ctx, t, 0.5 * v, 0.1 * k.decay);
        o.connect(og).connect(out);
        o.start(t); o.stop(t + 0.2 * k.decay + 0.05);
        break;
      }
      case 'clap': {
        const dec = 0.22 * k.decay;
        const n = noiseSrc(ctx, t, dec + 0.05);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400 * k.tone; bp.Q.value = 1.2;
        const g = ctx.createGain();
        const pk = 0.8 * v;
        g.gain.setValueAtTime(0, t);
        [0, 0.012, 0.024].forEach((o) => {
          g.gain.linearRampToValueAtTime(pk, t + o + 0.001);
          g.gain.exponentialRampToValueAtTime(pk * 0.2, t + o + 0.01);
        });
        g.gain.linearRampToValueAtTime(pk * 0.7, t + 0.036);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.036 + dec);
        n.connect(bp).connect(g).connect(out);
        break;
      }
      case 'chh':
      case 'ohh': {
        const dec = (pad.id === 'chh' ? 0.05 : 0.38) * k.decay;
        const n = noiseSrc(ctx, t, dec);
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000 * k.tone;
        const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 10000; bp.gain.value = 6;
        const g = envGain(ctx, t, 0.38 * v, dec);
        n.connect(hp).connect(bp).connect(g).connect(out);
        break;
      }
      case 'tomL':
      case 'tomH': {
        const base = (pad.id === 'tomL' ? 110 : 190) * k.pitch;
        const dec = (pad.id === 'tomL' ? 0.42 : 0.32) * k.decay;
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(base * 1.6, t);
        o.frequency.exponentialRampToValueAtTime(base, t + 0.08);
        const g = envGain(ctx, t, 0.75 * v, dec);
        o.connect(g).connect(out);
        o.start(t); o.stop(t + dec + 0.05);
        break;
      }
      case 'perc': {
        const dec = 0.18 * k.decay;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900 * k.pitch; bp.Q.value = 2;
        const g = envGain(ctx, t, 0.35 * v, dec);
        bp.connect(g).connect(out);
        [545, 815].forEach((f) => {
          const o = ctx.createOscillator(); o.type = 'square';
          o.frequency.value = f * k.pitch;
          o.connect(bp);
          o.start(t); o.stop(t + dec + 0.05);
        });
        break;
      }
    }
  }

  function metronomeClick(ctx, dest, time, accent) {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = accent ? 1800 : 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(accent ? 0.35 : 0.22, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0005, time + 0.05);
    o.connect(g).connect(dest);
    o.start(time);
    o.stop(time + 0.06);
  }

  return { presets, noteOn, playNote, drumPads, kits, playDrum, metronomeClick, noiseBuffer };
})();
