/* AppleLab — project state, undo/redo, persistence (IndexedDB + .applelab files) */
window.AL = window.AL || {};

AL.store = (() => {
  const { uid } = AL.util;
  const listeners = new Set();
  const audio = new Map(); // audioId -> AudioBuffer

  const TRACK_COLORS = ['#7ed957', '#4fc3f7', '#ffb74d', '#f06292', '#ba68c8', '#4db6ac', '#ffd54f', '#90a4ae', '#e57373', '#aed581'];

  const state = {
    project: null,
    selection: { trackId: null, clipId: null },
    undo: [],
    redo: [],
    lastMergeKey: null,
    lastMergeTime: 0,
    dirty: false,
  };

  function defaultEffects() {
    return { eqLow: 0, eqMid: 0, eqHigh: 0, comp: false, drive: 0, reverb: 0.12, delay: 0 };
  }

  function makeTrack(type, name) {
    const p = state.project;
    const idx = p ? p.tracks.length : 0;
    return {
      id: uid('trk'),
      type,
      name: name || ({ audio: 'Audio', instrument: 'Instrument', drums: 'Drums' }[type] + ' ' + (idx + 1)),
      color: TRACK_COLORS[idx % TRACK_COLORS.length],
      volume: 0.8,
      pan: 0,
      mute: false,
      solo: false,
      armed: false,
      preset: type === 'instrument' ? 'keys' : undefined,
      kit: type === 'drums' ? 'classic' : undefined,
      fx: defaultEffects(),
      clips: [],
    };
  }

  function emptyPattern(steps = 16) {
    return { steps, rows: Array.from({ length: 8 }, () => new Array(steps).fill(0)) };
  }

  function blankProject(name = 'Untitled Song') {
    return {
      id: uid('prj'),
      name,
      bpm: 110,
      beatsPerBar: 4,
      masterVolume: 0.9,
      loop: { enabled: false, start: 0, end: 16 },
      metronome: false,
      created: Date.now(),
      updated: Date.now(),
      tracks: [],
    };
  }

  function demoProject() {
    const p = blankProject('My First Beat');
    state.project = p; // so makeTrack picks colors by index
    const drums = makeTrack('drums', 'Drums');
    const pat = emptyPattern(16);
    [0, 6, 8, 11].forEach((s) => (pat.rows[0][s] = 1));
    [4, 12].forEach((s) => (pat.rows[1][s] = 1));
    [12].forEach((s) => (pat.rows[2][s] = 0.6));
    for (let s = 0; s < 16; s += 2) pat.rows[3][s] = s % 4 === 0 ? 0.9 : 0.55;
    pat.rows[4][14] = 0.6;
    drums.clips.push({ id: uid('clp'), name: 'Beat', start: 0, length: 16, pattern: pat });
    p.tracks.push(drums);

    const keys = makeTrack('instrument', 'Chords');
    keys.preset = 'epiano';
    const chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
    const notes = [];
    chords.forEach((ch, i) => ch.forEach((n) => notes.push({ p: n, s: i * 4, l: 3.75, v: 0.7 })));
    keys.clips.push({ id: uid('clp'), name: 'Chords', start: 0, length: 16, notes });
    p.tracks.push(keys);

    const bass = makeTrack('instrument', 'Bass');
    bass.preset = 'bass';
    bass.fx.reverb = 0;
    const bnotes = [];
    [45, 41, 36, 43].forEach((n, i) => {
      bnotes.push({ p: n, s: i * 4, l: 1.5, v: 0.85 });
      bnotes.push({ p: n, s: i * 4 + 2, l: 0.5, v: 0.7 });
      bnotes.push({ p: n + 12, s: i * 4 + 3, l: 0.5, v: 0.6 });
    });
    bass.clips.push({ id: uid('clp'), name: 'Bassline', start: 0, length: 16, notes: bnotes });
    p.tracks.push(bass);

    const vox = makeTrack('audio', 'Vocals');
    p.tracks.push(vox);
    return p;
  }

  // ---------- events ----------
  function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  function emit(kind = 'structure', detail) { listeners.forEach((fn) => { try { fn(kind, detail); } catch (e) { console.error(e); } }); }

  // ---------- mutations with undo ----------
  function snapshot() { return JSON.stringify(state.project); }

  /**
   * commit(fn, opts): mutate the project inside fn. opts.kind: 'structure' | 'params'.
   * opts.mergeKey: consecutive commits with same key within 1.2s collapse into one undo step.
   */
  function commit(fn, opts = {}) {
    const kind = opts.kind || 'structure';
    const now = Date.now();
    const merge = opts.mergeKey && opts.mergeKey === state.lastMergeKey && now - state.lastMergeTime < 1200;
    if (!merge && !opts.noUndo) {
      state.undo.push(snapshot());
      if (state.undo.length > 150) state.undo.shift();
      state.redo = [];
    }
    state.lastMergeKey = opts.mergeKey || null;
    state.lastMergeTime = now;
    fn(state.project);
    state.project.updated = Date.now();
    state.dirty = true;
    emit(kind, opts.detail);
    scheduleAutosave();
  }

  function undo() {
    if (!state.undo.length) return false;
    state.redo.push(snapshot());
    state.project = JSON.parse(state.undo.pop());
    state.lastMergeKey = null;
    validateSelection();
    emit('structure');
    scheduleAutosave();
    return true;
  }
  function redo() {
    if (!state.redo.length) return false;
    state.undo.push(snapshot());
    state.project = JSON.parse(state.redo.pop());
    state.lastMergeKey = null;
    validateSelection();
    emit('structure');
    scheduleAutosave();
    return true;
  }

  function validateSelection() {
    const s = state.selection;
    if (s.trackId && !getTrack(s.trackId)) s.trackId = state.project.tracks[0]?.id || null;
    if (s.clipId && !findClip(s.clipId)) s.clipId = null;
  }

  function select(trackId, clipId) {
    state.selection.trackId = trackId ?? state.selection.trackId;
    state.selection.clipId = clipId === undefined ? state.selection.clipId : clipId;
    emit('selection');
  }

  function getTrack(id) { return state.project.tracks.find((t) => t.id === id) || null; }
  function findClip(clipId) {
    for (const t of state.project.tracks) {
      const c = t.clips.find((c) => c.id === clipId);
      if (c) return { track: t, clip: c };
    }
    return null;
  }

  function songEndBeat() {
    let end = 0;
    for (const t of state.project.tracks) for (const c of t.clips) end = Math.max(end, c.start + c.length);
    return end;
  }

  function setProject(p) {
    state.project = p;
    state.undo = [];
    state.redo = [];
    state.selection = { trackId: p.tracks[0]?.id || null, clipId: null };
    state.dirty = false;
    emit('structure');
    emit('project');
  }

  function cloneClip(clip) {
    const c = JSON.parse(JSON.stringify(clip));
    c.id = uid('clp');
    return c;
  }

  // ---------- IndexedDB ----------
  let dbPromise = null;
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('applelab', 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  function tx(storeName, mode, fn) {
    return db().then((d) => new Promise((resolve, reject) => {
      const t = d.transaction(storeName, mode);
      const s = t.objectStore(storeName);
      let result;
      Promise.resolve(fn(s)).then((r) => (result = r));
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }
  const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  const savedAudioIds = new Set();

  function referencedAudioIds(p = state.project) {
    const ids = new Set();
    p.tracks.forEach((t) => t.clips.forEach((c) => c.audioId && ids.add(c.audioId)));
    return ids;
  }

  async function saveToBrowser() {
    const p = state.project;
    const ids = referencedAudioIds();
    // also keep audio referenced by undo history in memory, but only persist current refs
    for (const id of ids) {
      if (savedAudioIds.has(id)) continue;
      const buf = audio.get(id);
      if (!buf) continue;
      await tx('audio', 'readwrite', (s) => s.put({ id, data: AL.util.bufferToData(buf) }));
      savedAudioIds.add(id);
    }
    await tx('projects', 'readwrite', (s) => s.put({ id: p.id, name: p.name, updated: p.updated, json: JSON.stringify(p), audioIds: [...ids] }));
    await tx('meta', 'readwrite', (s) => s.put({ key: 'lastProject', value: p.id }));
    state.dirty = false;
    emit('saved');
  }

  const scheduleAutosave = AL.util.debounce(() => {
    saveToBrowser().catch((e) => console.warn('Autosave failed', e));
  }, 1500);

  async function listProjects() {
    const rows = await tx('projects', 'readonly', (s) => reqP(s.getAll()));
    return (rows || []).map((r) => ({ id: r.id, name: r.name, updated: r.updated })).sort((a, b) => b.updated - a.updated);
  }

  async function loadFromBrowser(id) {
    const row = await tx('projects', 'readonly', (s) => reqP(s.get(id)));
    if (!row) throw new Error('Project not found');
    const p = JSON.parse(row.json);
    for (const aid of row.audioIds || []) {
      if (audio.has(aid)) continue;
      const a = await tx('audio', 'readonly', (s) => reqP(s.get(aid)));
      if (a) { audio.set(aid, AL.util.dataToBuffer(a.data)); savedAudioIds.add(aid); }
    }
    setProject(p);
    return p;
  }

  async function deleteFromBrowser(id) {
    const row = await tx('projects', 'readonly', (s) => reqP(s.get(id)));
    await tx('projects', 'readwrite', (s) => s.delete(id));
    // garbage-collect audio not used by other projects
    if (row && row.audioIds) {
      const others = await tx('projects', 'readonly', (s) => reqP(s.getAll()));
      const used = new Set();
      others.forEach((o) => (o.audioIds || []).forEach((a) => used.add(a)));
      for (const aid of row.audioIds) if (!used.has(aid)) { await tx('audio', 'readwrite', (s) => s.delete(aid)); savedAudioIds.delete(aid); }
    }
  }

  async function lastProjectId() {
    try {
      const r = await tx('meta', 'readonly', (s) => reqP(s.get('lastProject')));
      return r ? r.value : null;
    } catch (_) { return null; }
  }

  // ---------- .applelab file ----------
  function exportProjectFile() {
    const p = state.project;
    const audioOut = {};
    for (const id of referencedAudioIds()) {
      const buf = audio.get(id);
      if (!buf) continue;
      const chans = [];
      for (let c = 0; c < buf.numberOfChannels; c++) chans.push(AL.util.f32ToBase64(buf.getChannelData(c)));
      audioOut[id] = { sampleRate: buf.sampleRate, length: buf.length, channels: chans };
    }
    const data = { format: 'applelab-project', version: 1, project: p, audio: audioOut };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    AL.util.download(blob, AL.util.safeFileName(p.name) + '.applelab');
  }

  async function importProjectFile(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.format !== 'applelab-project' || !data.project) throw new Error('Not an AppleLab project file');
    for (const [id, a] of Object.entries(data.audio || {})) {
      const chans = a.channels.map((b64) => AL.util.base64ToF32(b64));
      audio.set(id, AL.util.dataToBuffer({ sampleRate: a.sampleRate, length: a.length, channels: chans }));
    }
    const p = data.project;
    p.id = uid('prj'); // import as a new copy
    setProject(p);
    scheduleAutosave();
    return p;
  }

  function addAudioBuffer(buffer) {
    const id = uid('aud');
    audio.set(id, buffer);
    return id;
  }

  return {
    state, audio, on, emit, commit, undo, redo, select, getTrack, findClip, songEndBeat,
    makeTrack, emptyPattern, blankProject, demoProject, setProject, cloneClip, defaultEffects,
    saveToBrowser, listProjects, loadFromBrowser, deleteFromBrowser, lastProjectId,
    exportProjectFile, importProjectFile, addAudioBuffer, TRACK_COLORS,
    get project() { return state.project; },
  };
})();
