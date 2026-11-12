/* AppleLab — recording: microphone/line-in to audio tracks, keyboard/MIDI to instrument & drum tracks */
window.AL = window.AL || {};

AL.recorder = (() => {
  const store = AL.store;
  const engine = AL.engine;
  const ui = AL.ui;

  let session = null;
  let micStream = null;

  async function getMic() {
    if (micStream && micStream.active) return micStream;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Microphone recording is not supported here.');
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 2 },
    });
    return micStream;
  }

  function pickMime() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }

  async function start() {
    if (session) return;
    const p = store.project;
    let armed = p.tracks.filter((t) => t.armed);
    if (!armed.length) {
      const sel = store.getTrack(store.state.selection.trackId) || p.tracks[0];
      if (!sel) { ui.toast('Add a track first, then press record.'); return; }
      store.commit(() => { store.getTrack(sel.id).armed = true; }, { kind: 'params', noUndo: true });
      armed = [store.getTrack(sel.id)];
      ui.toast(`Recording on "${sel.name}"`);
    }
    const audioTracks = armed.filter((t) => t.type === 'audio');
    const midiTracks = armed.filter((t) => t.type !== 'audio');
    engine.ensure();
    if (engine.transport.playing) engine.stop();

    const startBeat = engine.currentBeat();
    const spb = 60 / p.bpm;
    const countIn = ui.view.countIn ? p.beatsPerBar : 0;

    let mr = null, chunks = [], mrStartCtx = 0;
    if (audioTracks.length) {
      try {
        const stream = await getMic();
        const mime = pickMime();
        mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        mr.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
        await new Promise((res) => { mr.onstart = res; mr.start(250); });
        mrStartCtx = engine.ctx.currentTime;
      } catch (err) {
        console.error(err);
        ui.toast('Could not access the microphone: ' + (err.message || err.name), 4000);
        if (!midiTracks.length) return;
        mr = null;
      }
    }

    engine.transport.recording = true;
    const t0 = engine.play(startBeat - countIn);
    for (let i = 0; i < countIn; i++) engine.click(t0 + i * spb, i === 0);
    const recStartTime = t0 + countIn * spb;

    session = { startBeat, recStartTime, mr, chunks, mrStartCtx, audioTracks, midiTracks, held: new Map(), notes: new Map() };
    midiTracks.forEach((t) => session.notes.set(t.id, []));
    AL.timeline.setRecording(armed.map((t) => t.id), startBeat);
    store.emit('transport');
  }

  async function stop() {
    if (!session) return;
    const s = session;
    session = null;
    const endBeat = engine.rawBeat();
    engine.transport.recording = false;
    engine.stop();
    AL.timeline.setRecording(null);
    const p = store.project;
    const spb = 60 / p.bpm;
    const bpb = p.beatsPerBar;

    // close held notes
    s.held.forEach((h, key) => {
      const [trackId, midi] = key.split('|');
      s.notes.get(trackId)?.push({ p: +midi, s: h.beat, l: Math.max(0.0625, endBeat - h.beat), v: h.vel });
    });

    const newClips = [];
    for (const t of s.midiTracks) {
      const raw = (s.notes.get(t.id) || []).filter((n) => n.s + n.l > s.startBeat && n.s < endBeat);
      if (!raw.length) continue;
      const clipStart = Math.floor(s.startBeat / bpb) * bpb;
      const length = Math.max(bpb, Math.ceil((endBeat - clipStart) / bpb) * bpb);
      if (t.type === 'instrument') {
        const notes = raw.map((n) => {
          const st = Math.max(n.s, s.startBeat);
          return { p: n.p, s: +(st - clipStart).toFixed(4), l: +Math.max(0.0625, n.l - (st - n.s)).toFixed(4), v: n.v };
        });
        newClips.push({ trackId: t.id, clip: { id: AL.util.uid('clp'), name: 'Recording', start: clipStart, length, notes } });
      } else {
        const steps = Math.round(length / 0.25);
        const pattern = { steps, rows: Array.from({ length: 8 }, () => new Array(steps).fill(0)) };
        raw.forEach((n) => {
          let pad = AL.instruments.drumPads.findIndex((d) => d.key === n.p);
          if (pad < 0) pad = ((n.p % 8) + 8) % 8;
          const step = Math.round((n.s - clipStart) / 0.25);
          if (step >= 0 && step < steps) pattern.rows[pad][step] = Math.max(pattern.rows[pad][step], n.v);
        });
        newClips.push({ trackId: t.id, clip: { id: AL.util.uid('clp'), name: 'Recorded beat', start: clipStart, length, pattern } });
      }
    }

    if (s.mr) {
      const done = new Promise((res) => (s.mr.onstop = res));
      s.mr.stop();
      await done;
      try {
        const blob = new Blob(s.chunks, { type: s.mr.mimeType || 'audio/webm' });
        const ab = await blob.arrayBuffer();
        const buf = await engine.ctx.decodeAudioData(ab);
        const latency = (engine.ctx.outputLatency || 0) + (engine.ctx.baseLatency || 0);
        const offset = Math.max(0, s.recStartTime - s.mrStartCtx + latency);
        const length = (buf.duration - offset) / spb;
        if (length > 0.05) {
          const id = store.addAudioBuffer(buf);
          s.audioTracks.forEach((t) => newClips.push({ trackId: t.id, clip: { id: AL.util.uid('clp'), name: 'Take ' + (countTakes(t) + 1), start: s.startBeat, length, offset, audioId: id, gain: 1 } }));
        }
      } catch (err) {
        console.error(err);
        ui.toast('Recording could not be decoded: ' + err.message, 4000);
      }
    }

    if (newClips.length) {
      store.commit(() => {
        newClips.forEach(({ trackId, clip }) => store.getTrack(trackId)?.clips.push(clip));
        store.state.selection = { trackId: newClips[0].trackId, clipId: newClips[0].clip.id };
      });
      ui.toast(`Recorded ${newClips.length} clip${newClips.length > 1 ? 's' : ''}`);
    } else {
      ui.toast('Nothing was recorded');
    }
    engine.seek(s.startBeat);
  }

  function countTakes(t) { return t.clips.filter((c) => (c.name || '').startsWith('Take')).length; }

  function noteEvent(trackId, midi, vel, on) {
    if (!session || !session.notes.has(trackId)) return;
    const beat = engine.rawBeat();
    const key = trackId + '|' + midi;
    if (on) session.held.set(key, { beat, vel });
    else {
      const h = session.held.get(key);
      if (!h) return;
      session.held.delete(key);
      session.notes.get(trackId).push({ p: midi, s: h.beat, l: Math.max(0.0625, beat - h.beat), v: h.vel });
    }
  }

  return { start, stop, noteEvent, get active() { return !!session; } };
})();
