/* AppleLab — audio engine: mixer graph, effects, transport scheduler, offline mixdown */
window.AL = window.AL || {};

AL.engine = (() => {
  const store = AL.store;
  const inst = AL.instruments;
  const { dbToGain, clamp } = AL.util;

  const LOOKAHEAD = 0.15; // seconds scheduled ahead
  const TICK_MS = 25;

  let ctx = null;
  let graph = null;
  let timer = null;

  const transport = {
    playing: false,
    recording: false,
    position: 0, // beat when stopped
    anchors: [], // [{time, beat}]
    nextBeat: 0,
    segStart: true,
    handles: new Set(), // voices / sources currently scheduled
  };

  // ---------- helpers ----------
  function distortionCurve(amount) {
    const n = 2048;
    const curve = new Float32Array(n);
    const k = amount * 60;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = k === 0 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }
  const curveCache = new Map();
  function getCurve(amount) {
    const key = Math.round(amount * 50);
    if (!curveCache.has(key)) curveCache.set(key, distortionCurve(key / 50));
    return curveCache.get(key);
  }

  function impulse(c, seconds = 2.4, decay = 3) {
    const len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ---------- graph ----------
  function buildGraph(c, project) {
    const g = { ctx: c, tracks: new Map() };
    g.master = c.createGain();
    g.limiter = c.createDynamicsCompressor();
    g.limiter.threshold.value = -3;
    g.limiter.knee.value = 0;
    g.limiter.ratio.value = 20;
    g.limiter.attack.value = 0.002;
    g.limiter.release.value = 0.1;
    g.masterAnalyser = c.createAnalyser();
    g.masterAnalyser.fftSize = 1024;
    g.master.connect(g.limiter).connect(g.masterAnalyser).connect(c.destination);

    // shared reverb bus
    g.reverbIn = c.createGain();
    g.reverb = c.createConvolver();
    g.reverb.buffer = impulse(c);
    const revOut = c.createGain();
    revOut.gain.value = 0.9;
    g.reverbIn.connect(g.reverb).connect(revOut).connect(g.master);

    // shared tempo-synced delay bus
    g.delayIn = c.createGain();
    g.delay = c.createDelay(4);
    g.delayFb = c.createGain();
    g.delayFb.gain.value = 0.38;
    const dlp = c.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 3500;
    g.delayIn.connect(g.delay);
    g.delay.connect(dlp).connect(g.delayFb).connect(g.delay);
    g.delay.connect(g.master);

    // metronome bus (never exported)
    g.click = c.createGain();
    g.click.connect(c.destination);

    syncGraph(g, project);
    return g;
  }

  function makeChannel(c, g) {
    const ch = {};
    ch.input = c.createGain();
    ch.drive = c.createWaveShaper();
    ch.drive.oversample = '2x';
    ch.eqLow = c.createBiquadFilter(); ch.eqLow.type = 'lowshelf'; ch.eqLow.frequency.value = 220;
    ch.eqMid = c.createBiquadFilter(); ch.eqMid.type = 'peaking'; ch.eqMid.frequency.value = 1200; ch.eqMid.Q.value = 0.8;
    ch.eqHigh = c.createBiquadFilter(); ch.eqHigh.type = 'highshelf'; ch.eqHigh.frequency.value = 5000;
    ch.comp = c.createDynamicsCompressor();
    ch.pan = c.createStereoPanner();
    ch.fader = c.createGain();
    ch.mute = c.createGain();
    ch.analyser = c.createAnalyser();
    ch.analyser.fftSize = 512;
    ch.sendRev = c.createGain();
    ch.sendDel = c.createGain();
    ch.input.connect(ch.drive).connect(ch.eqLow).connect(ch.eqMid).connect(ch.eqHigh).connect(ch.comp)
      .connect(ch.pan).connect(ch.fader).connect(ch.mute);
    ch.mute.connect(g.master);
    ch.mute.connect(ch.analyser);
    ch.mute.connect(ch.sendRev).connect(g.reverbIn);
    ch.mute.connect(ch.sendDel).connect(g.delayIn);
    return ch;
  }

  function disposeChannel(ch) {
    Object.values(ch).forEach((n) => { try { n.disconnect(); } catch (_) {} });
  }

  function syncGraph(g, project) {
    const c = g.ctx;
    const t = c.currentTime;
    const ids = new Set(project.tracks.map((tr) => tr.id));
    for (const [id, ch] of g.tracks) if (!ids.has(id)) { disposeChannel(ch); g.tracks.delete(id); }
    const anySolo = project.tracks.some((tr) => tr.solo);
    for (const tr of project.tracks) {
      let ch = g.tracks.get(tr.id);
      if (!ch) { ch = makeChannel(c, g); g.tracks.set(tr.id, ch); }
      const fx = tr.fx || store.defaultEffects();
      const audible = !tr.mute && (!anySolo || tr.solo);
      ch.mute.gain.setTargetAtTime(audible ? 1 : 0, t, 0.01);
      ch.fader.gain.setTargetAtTime(tr.volume, t, 0.01);
      ch.pan.pan.setTargetAtTime(clamp(tr.pan, -1, 1), t, 0.01);
      ch.eqLow.gain.setTargetAtTime(fx.eqLow, t, 0.01);
      ch.eqMid.gain.setTargetAtTime(fx.eqMid, t, 0.01);
      ch.eqHigh.gain.setTargetAtTime(fx.eqHigh, t, 0.01);
      ch.drive.curve = getCurve(fx.drive || 0);
      ch.input.gain.setTargetAtTime(fx.drive ? 1 / (1 + fx.drive * 1.5) + fx.drive * 0.3 : 1, t, 0.01);
      if (fx.comp) {
        ch.comp.threshold.setValueAtTime(-24, t); ch.comp.ratio.setValueAtTime(4, t);
        ch.comp.attack.setValueAtTime(0.005, t); ch.comp.release.setValueAtTime(0.15, t); ch.comp.knee.setValueAtTime(6, t);
      } else {
        ch.comp.threshold.setValueAtTime(0, t); ch.comp.ratio.setValueAtTime(1, t);
      }
      ch.sendRev.gain.setTargetAtTime(fx.reverb || 0, t, 0.01);
      ch.sendDel.gain.setTargetAtTime(fx.delay || 0, t, 0.01);
    }
    g.master.gain.setTargetAtTime(project.masterVolume, t, 0.01);
    g.delay.delayTime.setTargetAtTime(Math.min(3.9, (60 / project.bpm) * 0.75), t, 0.02);
  }

  // ---------- scheduling (shared between realtime and offline) ----------
  /**
   * env: { ctx, graph, project, beatToTime(beat), register(handle), metronome }
   */
  function scheduleRange(env, b0, b1, segStart) {
    const { ctx: c, graph: g, project: p } = env;
    const spb = 60 / p.bpm;
    if (env.metronome) {
      for (let b = Math.ceil(b0 - 1e-9); b < b1; b++) {
        inst.metronomeClick(c, g.click, env.beatToTime(b), b % p.beatsPerBar === 0);
      }
    }
    for (const tr of p.tracks) {
      const ch = g.tracks.get(tr.id);
      if (!ch) continue;
      for (const clip of tr.clips) {
        const cs = clip.start, ce = clip.start + clip.length;
        if (ce <= b0 || cs >= b1) continue;
        if (tr.type === 'instrument' && clip.notes) {
          for (const n of clip.notes) {
            if (n.s >= clip.length || n.s < 0) continue;
            const abs = cs + n.s;
            if (abs >= b0 && abs < b1) {
              const dur = Math.min(n.l, clip.length - n.s) * spb;
              env.register(inst.playNote(c, ch.input, tr.preset, n.p, env.beatToTime(abs), dur, n.v));
            }
          }
        } else if (tr.type === 'drums' && clip.pattern) {
          const pat = clip.pattern;
          const stepLen = 0.25;
          const from = Math.max(b0, cs);
          const to = Math.min(b1, ce);
          let k = Math.ceil((from - cs) / stepLen - 1e-9);
          for (let abs = cs + k * stepLen; abs < to - 1e-9; k++, abs = cs + k * stepLen) {
            const si = k % pat.steps;
            for (let r = 0; r < pat.rows.length; r++) {
              const v = pat.rows[r][si];
              if (v > 0) inst.playDrum(c, ch.input, r, env.beatToTime(abs), v, tr.kit);
            }
          }
        } else if (tr.type === 'audio' && clip.audioId) {
          const buf = store.audio.get(clip.audioId);
          if (!buf) continue;
          let startBeat = null, offset = clip.offset || 0;
          if (cs >= b0 && cs < b1) startBeat = cs;
          else if (segStart && cs < b0 && ce > b0) { startBeat = b0; offset += (b0 - cs) * spb; }
          if (startBeat === null) continue;
          const dur = (ce - startBeat) * spb;
          if (offset >= buf.duration) continue;
          const when = env.beatToTime(startBeat);
          env.register(playBuffer(c, ch.input, buf, when, offset, dur, clip.gain ?? 1));
        }
      }
    }
  }

  function playBuffer(c, dest, buf, when, offset, dur, gain) {
    const src = c.createBufferSource();
    src.buffer = buf;
    const gn = c.createGain();
    const t = Math.max(when, c.currentTime);
    const playDur = Math.min(dur, buf.duration - offset);
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(gain, t + 0.004);
    gn.gain.setValueAtTime(gain, t + Math.max(0.005, playDur - 0.006));
    gn.gain.linearRampToValueAtTime(0, t + playDur);
    src.connect(gn).connect(dest);
    src.start(t, offset, playDur);
    const h = {
      endTime: t + playDur,
      stop() { try { src.stop(); } catch (_) {} h.endTime = 0; },
    };
    return h;
  }

  // ---------- realtime ----------
  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      graph = buildGraph(ctx, store.project);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function spb() { return 60 / store.project.bpm; }

  function currentAnchor(time) {
    const a = transport.anchors;
    for (let i = a.length - 1; i >= 0; i--) if (a[i].time <= time) return a[i];
    return a[0];
  }

  function rawBeat() {
    if (!transport.playing || !ctx) return transport.position;
    const now = ctx.currentTime;
    const a = currentAnchor(now);
    return a.beat + (now - a.time) / spb();
  }
  function currentBeat() { return Math.max(0, rawBeat()); }

  function click(time, accent) {
    ensure();
    inst.metronomeClick(ctx, graph.click, time, accent);
  }

  function tick() {
    if (!transport.playing) return;
    const p = store.project;
    const lookEnd = ctx.currentTime + LOOKAHEAD;
    const env = realtimeEnv();
    let guard = 0;
    while (guard++ < 8) {
      const a = transport.anchors[transport.anchors.length - 1];
      const endBeat = a.beat + (lookEnd - a.time) / spb();
      const L = p.loop;
      const loopOk = L.enabled && !transport.recording && L.end - L.start >= 0.25;
      if (loopOk && transport.nextBeat < L.end && endBeat >= L.end) {
        scheduleRange(env, transport.nextBeat, L.end, transport.segStart);
        const t = a.time + (L.end - a.beat) * spb();
        transport.anchors.push({ time: t, beat: L.start });
        transport.nextBeat = L.start;
        transport.segStart = true;
        continue;
      }
      if (endBeat > transport.nextBeat) {
        scheduleRange(env, transport.nextBeat, endBeat, transport.segStart);
        transport.segStart = false;
        transport.nextBeat = endBeat;
      }
      break;
    }
    // prune old anchors and finished handles
    const now = ctx.currentTime;
    while (transport.anchors.length > 1 && transport.anchors[1].time <= now) transport.anchors.shift();
    for (const h of transport.handles) if (h.endTime < now - 0.5) transport.handles.delete(h);
  }

  function realtimeEnv() {
    return {
      ctx, graph, project: store.project,
      metronome: store.project.metronome || transport.forceClick,
      beatToTime: (b) => {
        const a = transport.anchors[transport.anchors.length - 1];
        return a.time + (b - a.beat) * spb();
      },
      register: (h) => h && transport.handles.add(h),
    };
  }

  function play(fromBeat) {
    ensure();
    syncGraph(graph, store.project);
    if (transport.playing) stopVoices();
    const start = fromBeat ?? transport.position;
    transport.anchors = [{ time: ctx.currentTime + 0.06, beat: start }];
    transport.nextBeat = start;
    transport.segStart = true;
    transport.playing = true;
    clearInterval(timer);
    tick();
    timer = setInterval(tick, TICK_MS);
    store.emit('transport');
    return transport.anchors[0].time;
  }

  function stopVoices() {
    for (const h of transport.handles) { try { h.stop(); } catch (_) {} }
    transport.handles.clear();
  }

  function stop(resetTo) {
    if (transport.playing) transport.position = currentBeat();
    transport.playing = false;
    clearInterval(timer);
    timer = null;
    stopVoices();
    if (resetTo !== undefined) transport.position = resetTo;
    store.emit('transport');
  }

  function seek(beat) {
    beat = Math.max(0, beat);
    if (transport.playing) play(beat);
    else { transport.position = beat; store.emit('transport'); }
  }

  // live playing (on-screen / computer / MIDI keyboard)
  function liveNoteOn(trackId, midi, velocity = 0.85) {
    ensure();
    syncGraph(graph, store.project);
    const tr = store.getTrack(trackId);
    if (!tr) return null;
    const ch = graph.tracks.get(tr.id);
    if (tr.type === 'drums') {
      const pads = inst.drumPads;
      let idx = pads.findIndex((pd) => pd.key === midi);
      if (idx < 0) idx = ((midi % 8) + 8) % 8;
      inst.playDrum(ctx, ch.input, idx, ctx.currentTime, velocity, tr.kit);
      return { release() {}, stop() {}, drum: idx };
    }
    if (tr.type === 'instrument') return inst.noteOn(ctx, ch.input, tr.preset, midi, ctx.currentTime, velocity);
    return null;
  }

  function previewDrum(trackId, padIndex, velocity = 0.9) {
    ensure();
    syncGraph(graph, store.project);
    const tr = store.getTrack(trackId);
    const ch = tr && graph.tracks.get(tr.id);
    if (!ch) return;
    inst.playDrum(ctx, ch.input, padIndex, ctx.currentTime, velocity, tr.kit);
  }

  function previewNote(trackId, midi, dur = 0.4) {
    const h = liveNoteOn(trackId, midi, 0.8);
    if (h && h.release) h.release(ctx.currentTime + dur);
  }

  function meterLevel(trackId) {
    if (!graph) return 0;
    const an = trackId === 'master' ? graph.masterAnalyser : graph.tracks.get(trackId)?.analyser;
    if (!an) return 0;
    const data = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(data);
    let peak = 0;
    for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; }
    return peak;
  }

  // ---------- offline mixdown ----------
  async function renderMixdown(opts = {}) {
    const p = JSON.parse(JSON.stringify(store.project));
    const endBeat = opts.endBeat ?? store.songEndBeat();
    if (endBeat <= 0) throw new Error('The project is empty — add some clips first.');
    const startBeat = opts.startBeat ?? 0;
    const secPerBeat = 60 / p.bpm;
    const tail = 2.5;
    const sr = 44100;
    const length = Math.ceil(((endBeat - startBeat) * secPerBeat + tail) * sr);
    const off = new OfflineAudioContext(2, length, sr);
    const g = buildGraph(off, p);
    const env = {
      ctx: off, graph: g, project: p, metronome: false,
      beatToTime: (b) => (b - startBeat) * secPerBeat,
      register: () => {},
    };
    // schedule in chunks (keeps node count creation spread, same result)
    scheduleRange(env, startBeat, endBeat, true);
    return off.startRendering();
  }

  // re-sync parameters whenever the project changes
  store.on((kind) => {
    if (!graph) return;
    if (kind === 'structure' || kind === 'params' || kind === 'project') syncGraph(graph, store.project);
    if (kind === 'project' && transport.playing) stop(0);
  });

  return {
    transport, ensure, play, stop, seek, currentBeat, rawBeat, click, liveNoteOn, previewDrum, previewNote, meterLevel,
    renderMixdown,
    get ctx() { return ctx; },
    restartIfPlaying() { if (transport.playing) play(currentBeat()); },
  };
})();
