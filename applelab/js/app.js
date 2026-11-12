/* AppleLab — application controller: menus, transport, actions, shortcuts, editor host */
window.AL = window.AL || {};

AL.app = (() => {
  const store = AL.store;
  const engine = AL.engine;
  const ui = AL.ui;
  const { el, uid } = AL.util;
  const $ = (id) => document.getElementById(id);

  ui.view.countIn = false;

  // ---------------- editor host ----------------
  let currentEditor = null;
  function renderEditor() {
    const panel = $('panel-editor');
    const sel = store.state.selection;
    const found = sel.clipId ? store.findClip(sel.clipId) : null;
    if (!found) {
      currentEditor = null;
      panel.innerHTML = '';
      const tr = store.getTrack(sel.trackId);
      const msg = el('div', { class: 'editor-empty' });
      if (!tr) msg.append(el('p', { text: 'Select or add a track to start making music.' }), el('button', { class: 'btn accent', text: '+ Add track', onclick: addTrackDialog }));
      else if (tr.type === 'audio') {
        msg.append(el('p', { text: `"${tr.name}" is an audio track. Arm it (●) and press Record to capture your microphone, or import an audio file.` }),
          el('button', { class: 'btn', text: 'Import audio…', onclick: () => importAudioDialog(tr.id, engine.currentBeat()) }), ' ',
          el('button', { class: 'btn accent', text: '● Record', onclick: () => toggleRecord() }));
      } else {
        msg.append(el('p', { text: `Double-click on the "${tr.name}" lane to create a ${tr.type === 'drums' ? 'beat' : 'MIDI'} clip, or select an existing clip to edit it.` }),
          el('button', { class: 'btn accent', text: 'Create clip at playhead', onclick: () => createClip(tr.id, Math.floor(engine.currentBeat() / 4) * 4) }));
      }
      panel.appendChild(msg);
      $('dock-title').textContent = '';
      return;
    }
    const ed = found.track.type === 'instrument' ? AL.pianoRoll : found.track.type === 'drums' ? AL.drumEditor : AL.audioEditor;
    $('dock-title').textContent = `${found.track.name} › ${found.clip.name || 'Clip'}`;
    if (currentEditor === ed && ed.clipId === found.clip.id && panel.firstChild && panel.firstChild.classList?.contains('ed-wrap')) ed.update(found.track, found.clip);
    else { ed.mount(panel, found.track, found.clip); currentEditor = ed; }
  }

  function showTab(tab) {
    ui.view.activeTab = tab;
    document.querySelectorAll('.dtab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.dpanel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + tab));
    $('dock').classList.remove('collapsed');
    if (tab === 'editor') renderEditor();
    if (tab === 'mixer') AL.mixer.render();
    if (tab === 'keys') AL.keyboard.render();
    if (tab === 'editor' && currentEditor === AL.audioEditor) AL.audioEditor.redraw();
  }

  // ---------------- transport UI ----------------
  function refreshTransport() {
    const p = store.project;
    $('btn-play').textContent = engine.transport.playing ? '❚❚' : '▶';
    $('btn-play').classList.toggle('on', engine.transport.playing && !engine.transport.recording);
    $('btn-rec').classList.toggle('on', AL.recorder.active);
    $('btn-loop').classList.toggle('on', p.loop.enabled);
    $('btn-metro').classList.toggle('on', p.metronome);
    if (document.activeElement !== $('bpm')) $('bpm').value = p.bpm;
    if (document.activeElement !== $('master-vol')) $('master-vol').value = p.masterVolume;
    if (document.activeElement !== $('project-name')) $('project-name').value = p.name;
    document.title = `${p.name} — AppleLab`;
  }

  function togglePlay() {
    if (AL.recorder.active) { AL.recorder.stop(); return; }
    if (engine.transport.playing) engine.stop();
    else engine.play();
  }
  function toggleRecord() {
    if (AL.recorder.active) AL.recorder.stop();
    else AL.recorder.start();
  }

  // ---------------- tracks & clips ----------------
  function addTrack(type) {
    let id;
    store.commit((p) => {
      const t = store.makeTrack(type);
      if (type === 'audio') t.name = 'Voice ' + (p.tracks.filter((x) => x.type === 'audio').length + 1);
      p.tracks.push(t);
      id = t.id;
    });
    store.select(id, null);
    return id;
  }

  function addTrackDialog() {
    const choice = (type, icon, title, sub) => el('button', { class: 'choice', onclick: () => { addTrack(type); m.close(); } }, [el('span', { class: 'ic', text: icon }), title, el('small', { text: sub })]);
    const m = ui.modal('Add a track', el('div', { class: 'choice-grid' }, [
      choice('instrument', '🎹', 'Instrument', 'Synths, keys, bass, pads — play or draw notes'),
      choice('drums', '🥁', 'Drum machine', 'Program beats on a step sequencer'),
      choice('audio', '🎤', 'Voice / Audio', 'Record a microphone or import audio files'),
    ]), [{ label: 'Cancel' }]);
  }

  async function deleteTrack(id) {
    const t = store.getTrack(id);
    if (!t) return;
    if (t.clips.length && !(await ui.confirmDialog('Delete track', `Delete "${t.name}" and its ${t.clips.length} clip(s)? You can undo this.`, 'Delete'))) return;
    store.commit((p) => { p.tracks = p.tracks.filter((x) => x.id !== id); });
    if (store.state.selection.trackId === id) store.select(store.project.tracks[0]?.id || null, null);
  }

  function createClip(trackId, beat) {
    const t = store.getTrack(trackId);
    if (!t) return;
    if (t.type === 'audio') { importAudioDialog(trackId, beat); return; }
    const clip = t.type === 'drums'
      ? { id: uid('clp'), name: 'Beat', start: beat, length: 4, pattern: store.emptyPattern(16) }
      : { id: uid('clp'), name: 'Melody', start: beat, length: 8, notes: [] };
    store.commit(() => store.getTrack(trackId).clips.push(clip));
    store.select(trackId, clip.id);
    showTab('editor');
  }

  function selectedClip() {
    const id = store.state.selection.clipId;
    return id ? store.findClip(id) : null;
  }

  function deleteClip() {
    const f = selectedClip();
    if (!f) return;
    store.commit(() => { const ff = store.findClip(f.clip.id); ff.track.clips = ff.track.clips.filter((c) => c.id !== f.clip.id); });
    store.select(f.track.id, null);
  }

  function duplicateClip() {
    const f = selectedClip();
    if (!f) return;
    const c = store.cloneClip(f.clip);
    c.start = f.clip.start + f.clip.length;
    store.commit(() => store.getTrack(f.track.id).clips.push(c));
    store.select(f.track.id, c.id);
  }

  function copyClip() {
    const f = selectedClip();
    if (!f) return;
    ui.view.clipboard = { type: f.track.type, clip: JSON.parse(JSON.stringify(f.clip)) };
    ui.toast('Clip copied');
  }

  function pasteClip(trackId, beat) {
    const cb = ui.view.clipboard;
    if (!cb) return;
    let t = store.getTrack(trackId || store.state.selection.trackId);
    if (!t || t.type !== cb.type) t = store.project.tracks.find((x) => x.type === cb.type);
    if (!t) { ui.toast(`Paste needs a ${cb.type} track`); return; }
    const c = store.cloneClip(cb.clip);
    c.start = ui.snapBeat(beat ?? engine.currentBeat());
    store.commit(() => store.getTrack(t.id).clips.push(c));
    store.select(t.id, c.id);
  }

  function splitClip() {
    const beat = engine.currentBeat();
    let f = selectedClip();
    if (!f || beat <= f.clip.start || beat >= f.clip.start + f.clip.length) {
      const tr = store.getTrack(store.state.selection.trackId);
      const c = tr && tr.clips.find((c) => beat > c.start && beat < c.start + c.length);
      f = c ? { track: tr, clip: c } : null;
    }
    if (!f) { ui.toast('Place the playhead over a clip to split it'); return; }
    const spb = 60 / store.project.bpm;
    const rel = beat - f.clip.start;
    let rightId;
    store.commit(() => {
      const ff = store.findClip(f.clip.id);
      const left = ff.clip;
      const right = store.cloneClip(left);
      rightId = right.id;
      right.start = beat;
      right.length = left.length - rel;
      left.length = rel;
      if (ff.track.type === 'audio') right.offset = (left.offset || 0) + rel * spb;
      if (ff.track.type === 'instrument') {
        right.notes = left.notes.filter((n) => n.s >= rel).map((n) => ({ ...n, s: n.s - rel }));
        left.notes = left.notes.filter((n) => n.s < rel).map((n) => ({ ...n, l: Math.min(n.l, rel - n.s) }));
      }
      if (ff.track.type === 'drums') {
        const pat = right.pattern;
        const shift = Math.round(rel / 0.25) % pat.steps;
        pat.rows = pat.rows.map((r) => r.slice(shift).concat(r.slice(0, shift)));
      }
      ff.track.clips.push(right);
    });
    store.select(f.track.id, rightId);
  }

  // ---------------- audio import ----------------
  async function importAudioDialog(trackId, beat) {
    const files = await AL.util.pickFile('audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac,.webm', true);
    if (files.length) await importAudioFiles(files, trackId, beat);
  }

  async function importAudioFiles(files, trackId, beat) {
    const ctx = engine.ensure();
    let t = trackId ? store.getTrack(trackId) : null;
    if (!t || t.type !== 'audio') {
      const selT = store.getTrack(store.state.selection.trackId);
      t = selT && selT.type === 'audio' && !trackId ? selT : null;
    }
    let pos = beat ?? engine.currentBeat();
    const spb = 60 / store.project.bpm;
    const results = [];
    for (const file of files) {
      try {
        const ab = await file.arrayBuffer();
        const buf = await ctx.decodeAudioData(ab);
        const id = store.addAudioBuffer(buf);
        results.push({ id, buf, name: file.name.replace(/\.[^.]+$/, '') });
      } catch (err) {
        ui.toast(`Could not read ${file.name} (unsupported format?)`, 3500);
      }
    }
    if (!results.length) return;
    let targetId = t ? t.id : null;
    let lastClip;
    store.commit((p) => {
      if (!targetId) {
        const nt = store.makeTrack('audio', results[0].name.slice(0, 24));
        p.tracks.push(nt);
        targetId = nt.id;
      }
      const tr = store.getTrack(targetId);
      for (const r of results) {
        lastClip = { id: uid('clp'), name: r.name, start: pos, length: r.buf.duration / spb, offset: 0, audioId: r.id, gain: 1 };
        tr.clips.push(lastClip);
        pos += lastClip.length;
      }
    });
    store.select(targetId, lastClip.id);
    ui.toast(`Imported ${results.length} file${results.length > 1 ? 's' : ''}`);
  }

  // ---------------- export ----------------
  async function exportWav() {
    if (store.songEndBeat() <= 0) { ui.toast('Nothing to export yet — add some clips first.'); return; }
    engine.stop();
    const status = el('p', { text: 'Rendering your song…' });
    const m = ui.modal('Export mixdown', el('div', {}, [status, el('div', { class: 'progress' }, [el('i')])]), []);
    try {
      const t0 = performance.now();
      const buf = await engine.renderMixdown();
      const wav = AL.util.encodeWav(buf);
      AL.util.download(new Blob([wav], { type: 'audio/wav' }), AL.util.safeFileName(store.project.name) + '.wav');
      m.close();
      ui.toast(`Exported ${buf.duration.toFixed(1)} s WAV in ${((performance.now() - t0) / 1000).toFixed(1)} s`, 3500);
    } catch (err) {
      console.error(err);
      status.textContent = 'Export failed: ' + err.message;
    }
  }

  // ---------------- projects ----------------
  function newProjectDialog() {
    const name = el('input', { type: 'text', value: 'Untitled Song' });
    const pick = (demo) => {
      engine.stop(0);
      const p = demo ? store.demoProject() : store.blankProject();
      if (!demo || name.value.trim() !== 'Untitled Song') p.name = name.value.trim() || p.name;
      store.setProject(p);
      store.saveToBrowser().catch(() => {});
      m.close();
      ui.toast('New project created');
    };
    const m = ui.modal('New project', el('div', {}, [
      el('label', { class: 'field', style: { marginBottom: '12px', display: 'block' } }, ['Name', name]),
      el('div', { class: 'choice-grid', style: { gridTemplateColumns: '1fr 1fr' } }, [
        el('button', { class: 'choice', onclick: () => pick(false) }, [el('span', { class: 'ic', text: '📄' }), 'Blank project', el('small', { text: 'Start from scratch' })]),
        el('button', { class: 'choice', onclick: () => pick(true) }, [el('span', { class: 'ic', text: '🎶' }), 'Starter song', el('small', { text: 'Drums, chords and bass ready to remix' })]),
      ]),
    ]), [{ label: 'Cancel' }]);
  }

  async function openDialog() {
    const list = el('div', { class: 'proj-list' }, [el('p', { text: 'Loading…' })]);
    const m = ui.modal('Open project', list, [
      { label: 'Open .applelab file…', onClick: async () => { await importProjectDialog(); } },
      { label: 'Close' },
    ]);
    const projects = await store.listProjects().catch(() => []);
    list.innerHTML = '';
    if (!projects.length) list.appendChild(el('p', { text: 'No saved projects yet.' }));
    for (const pr of projects) {
      const item = el('div', { class: 'proj-item' }, [
        el('span', { class: 'nm', text: pr.name }),
        el('span', { class: 'dt', text: new Date(pr.updated).toLocaleString() }),
        el('button', { class: 'btn small accent', text: 'Open', onclick: async () => {
          engine.stop(0);
          if (store.state.dirty) await store.saveToBrowser().catch(() => {});
          await store.loadFromBrowser(pr.id);
          m.close();
          ui.toast(`Opened "${pr.name}"`);
        } }),
        el('button', { class: 'btn small danger', text: 'Delete', disabled: pr.id === store.project.id, onclick: async () => {
          if (!(await ui.confirmDialog('Delete project', `Permanently delete "${pr.name}"?`, 'Delete'))) return;
          await store.deleteFromBrowser(pr.id);
          item.remove();
        } }),
      ]);
      list.appendChild(item);
    }
  }

  async function importProjectDialog() {
    const [file] = await AL.util.pickFile('.applelab,application/json');
    if (!file) return;
    try {
      engine.stop(0);
      await store.importProjectFile(file);
      ui.toast('Project opened');
    } catch (err) { ui.toast('Could not open file: ' + err.message, 3500); }
  }

  async function save() {
    try { await store.saveToBrowser(); ui.toast('Saved'); } catch (err) { ui.toast('Save failed: ' + err.message, 3500); }
  }

  function shortcutsDialog() {
    const rows = [
      ['Space', 'Play / pause'], ['R', 'Record'], ['Enter / Home', 'Return to start'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo'],
      ['Ctrl+S', 'Save'], ['Ctrl+C / Ctrl+V', 'Copy / paste clip'], ['Ctrl+D', 'Duplicate clip'], ['Ctrl+E', 'Split at playhead'],
      ['Del', 'Delete clip (or selected notes in the piano roll)'], ['Alt+drag', 'Copy a clip while dragging'], ['Ctrl+L', 'Toggle loop'],
      ['Ctrl+M', 'Toggle metronome'], ['Ctrl + / Ctrl −', 'Zoom timeline'], ['A W S E D F T G Y H U J K', 'Play notes (musical typing)'],
      ['Z / X', 'Octave down / up'], ['C / V', 'Velocity down / up'], ['Drag on ruler', 'Set loop region'], ['Double-click lane', 'Create clip'],
    ];
    ui.modal('Keyboard shortcuts', el('table', { class: 'shortcuts' }, rows.map(([k, d]) => el('tr', {}, [el('td', { text: k }), el('td', { text: d })]))), [{ label: 'Close', class: 'accent' }]);
  }

  function aboutDialog() {
    ui.modal('About AppleLab', el('div', {}, [
      el('p', { text: 'AppleLab is a free, open music studio that runs in your browser and on Windows.' }),
      el('p', { text: 'Record vocals and instruments, program beats, play synths, edit in the piano roll, mix with EQ, compression, drive, reverb and delay, and export your song as a WAV file. Projects are saved automatically on this device.' }),
      el('p', { style: { color: 'var(--muted)' }, text: 'Version 1.0.0' + (window.applelabDesktop ? ' · Desktop edition' : ' · Web edition') }),
    ]), [{ label: 'Close', class: 'accent' }]);
  }

  // ---------------- action dispatch ----------------
  const actions = {
    new: newProjectDialog, open: openDialog, save, 'import-project': importProjectDialog, 'export-project': () => store.exportProjectFile(),
    'import-audio': () => importAudioDialog(null, engine.currentBeat()), 'export-wav': exportWav,
    undo: () => { if (!store.undo()) ui.toast('Nothing to undo'); }, redo: () => { if (!store.redo()) ui.toast('Nothing to redo'); },
    copy: copyClip, paste: () => pasteClip(), duplicate: duplicateClip, split: splitClip, delete: deleteClip,
    'add-instrument': () => addTrack('instrument'), 'add-drums': () => addTrack('drums'), 'add-audio': () => addTrack('audio'),
    shortcuts: shortcutsDialog, about: aboutDialog,
  };

  function bindUI() {
    // menus
    document.querySelectorAll('.menu-item').forEach((mi) => {
      mi.addEventListener('click', (e) => {
        if (e.target.closest('.dropdown')) return;
        const open = mi.classList.contains('open');
        document.querySelectorAll('.menu-item.open').forEach((x) => x.classList.remove('open'));
        if (!open) mi.classList.add('open');
      });
      mi.addEventListener('mouseenter', () => {
        if (document.querySelector('.menu-item.open') && !mi.classList.contains('open')) {
          document.querySelectorAll('.menu-item.open').forEach((x) => x.classList.remove('open'));
          mi.classList.add('open');
        }
      });
    });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.menu')) document.querySelectorAll('.menu-item.open').forEach((x) => x.classList.remove('open')); });
    document.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll('.menu-item.open').forEach((x) => x.classList.remove('open'));
      const fn = actions[b.dataset.action];
      if (fn) fn();
    }));

    // transport
    $('btn-play').addEventListener('click', togglePlay);
    $('btn-stop').addEventListener('click', () => { if (AL.recorder.active) AL.recorder.stop(); else if (engine.transport.playing) engine.stop(); else engine.seek(0); });
    $('btn-home').addEventListener('click', () => engine.seek(store.project.loop.enabled ? store.project.loop.start : 0));
    $('btn-rec').addEventListener('click', toggleRecord);
    $('btn-loop').addEventListener('click', toggleLoop);
    $('btn-metro').addEventListener('click', () => store.commit((p) => (p.metronome = !p.metronome), { kind: 'params', noUndo: true }));
    $('bpm').addEventListener('change', () => {
      const v = Math.max(30, Math.min(300, Math.round(+$('bpm').value || 120)));
      store.commit((p) => (p.bpm = v));
      engine.restartIfPlaying();
    });
    $('master-vol').addEventListener('input', () => store.commit((p) => (p.masterVolume = +$('master-vol').value), { kind: 'params', mergeKey: 'master' }));
    $('snap').addEventListener('change', () => (ui.view.snap = +$('snap').value));
    $('zoom').addEventListener('input', () => setZoom(+$('zoom').value));
    $('project-name').addEventListener('change', () => store.commit((p) => (p.name = $('project-name').value.trim() || 'Untitled Song'), { kind: 'params' }));
    $('project-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
    $('btn-add-track').addEventListener('click', addTrackDialog);

    // dock
    document.querySelectorAll('.dtab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('dock-toggle').addEventListener('click', () => {
      const d = $('dock');
      d.classList.toggle('collapsed');
      $('dock-toggle').textContent = d.classList.contains('collapsed') ? '▴' : '▾';
    });
    // resize dock by dragging its top edge
    const resizer = el('div', { class: 'dock-resizer', title: 'Drag to resize' });
    $('dock').prepend(resizer);
    resizer.addEventListener('pointerdown', (e) => {
      resizer.setPointerCapture(e.pointerId);
      const startY = e.clientY, startH = $('dock').offsetHeight;
      const mv = (ev) => { $('dock').style.height = Math.max(120, Math.min(innerHeight - 220, startH - (ev.clientY - startY))) + 'px'; };
      const up = () => { resizer.removeEventListener('pointermove', mv); resizer.removeEventListener('pointerup', up); if (currentEditor === AL.audioEditor) AL.audioEditor.redraw(); };
      resizer.addEventListener('pointermove', mv);
      resizer.addEventListener('pointerup', up);
    });

    document.addEventListener('keydown', onKey);
    // keep keyboard shortcuts working after clicking buttons / choosing from dropdowns
    document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });
    document.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') e.target.blur(); });
    window.addEventListener('beforeunload', () => { if (store.state.dirty) store.saveToBrowser(); });
    document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input,textarea')) e.preventDefault(); });
  }

  function toggleLoop() {
    store.commit((p) => {
      p.loop.enabled = !p.loop.enabled;
      if (p.loop.enabled && p.loop.end <= p.loop.start) { p.loop.start = 0; p.loop.end = 16; }
    }, { kind: 'params', noUndo: true });
  }

  function setZoom(v) {
    const sc = $('arrange-scroll');
    const centerBeat = (sc.scrollLeft + sc.clientWidth / 2 - 232) / ui.view.ppb;
    ui.view.ppb = Math.max(8, Math.min(160, v));
    $('zoom').value = ui.view.ppb;
    AL.timeline.render();
    sc.scrollLeft = Math.max(0, centerBeat * ui.view.ppb - sc.clientWidth / 2 + 232);
  }

  function onKey(e) {
    if (document.querySelector('.modal-bg')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (ctrl && k === 's') { e.preventDefault(); save(); return; }
    if (ui.isTyping(e)) return;
    if (currentEditor && currentEditor.handleKey(e)) { e.preventDefault(); return; }
    if (ctrl && k === 'z' && !e.shiftKey) { e.preventDefault(); actions.undo(); return; }
    if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); actions.redo(); return; }
    if (ctrl && k === 'c') { e.preventDefault(); copyClip(); return; }
    if (ctrl && k === 'v') { e.preventDefault(); pasteClip(); return; }
    if (ctrl && k === 'd') { e.preventDefault(); duplicateClip(); return; }
    if (ctrl && k === 'e') { e.preventDefault(); splitClip(); return; }
    if (ctrl && k === 'l') { e.preventDefault(); toggleLoop(); return; }
    if (ctrl && k === 'm') { e.preventDefault(); $('btn-metro').click(); return; }
    if (ctrl && (k === '=' || k === '+')) { e.preventDefault(); setZoom(ui.view.ppb * 1.25); return; }
    if (ctrl && k === '-') { e.preventDefault(); setZoom(ui.view.ppb / 1.25); return; }
    if (ctrl) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); return; }
    if (AL.keyboard.consumes(e)) return; // musical typing handles it
    if (k === 'r') { e.preventDefault(); toggleRecord(); return; }
    if (k === 'enter' || k === 'home') { e.preventDefault(); engine.seek(0); return; }
    if (k === 'delete' || k === 'backspace') { e.preventDefault(); deleteClip(); return; }
  }

  // ---------------- render loop ----------------
  let lastMeters = 0;
  function frame(t) {
    const beat = engine.currentBeat();
    AL.timeline.updatePlayhead(beat);
    $('lcd-bbt').textContent = AL.util.formatBBT(beat, store.project.beatsPerBar);
    $('lcd-time').textContent = AL.util.formatClock(beat * 60 / store.project.bpm);
    if (AL.recorder.active) AL.timeline.updateRecording(beat);
    if (currentEditor && ui.view.activeTab === 'editor') currentEditor.onFrame(beat);
    if (t - lastMeters > 50) {
      lastMeters = t;
      AL.timeline.updateMeters();
      AL.mixer.updateMeters();
      AL.mixer.drawMeter($('master-meter'), engine.meterLevel('master'));
    }
    requestAnimationFrame(frame);
  }

  // ---------------- store listener ----------------
  function onStore(kind, detail) {
    if (kind === 'structure' || kind === 'project') {
      AL.timeline.render();
      if (ui.view.activeTab === 'mixer') AL.mixer.render();
      if (ui.view.activeTab === 'keys') AL.keyboard.render();
      if (!(detail && detail.from === 'pianoroll' && currentEditor === AL.pianoRoll)) renderEditor();
      else AL.timeline.refreshSelection();
      refreshTransport();
      setSaveStatus(store.state.dirty ? 'Saving…' : 'All changes saved');
    } else if (kind === 'params') {
      AL.timeline.refreshValues();
      AL.mixer.refreshValues();
      refreshTransport();
      setSaveStatus(store.state.dirty ? 'Saving…' : 'All changes saved');
    } else if (kind === 'selection') {
      AL.timeline.refreshSelection();
      renderEditor();
      if (ui.view.activeTab === 'keys') AL.keyboard.render();
    } else if (kind === 'transport') {
      refreshTransport();
    } else if (kind === 'saved') {
      setSaveStatus('All changes saved');
    }
  }
  function setSaveStatus(t) { $('save-status').textContent = t; }

  async function boot() {
    AL.timeline.init();
    AL.mixer.init();
    AL.keyboard.init();
    bindUI();
    store.on(onStore);
    let loaded = false;
    try {
      const last = await store.lastProjectId();
      if (last) { await store.loadFromBrowser(last); loaded = true; }
    } catch (err) { console.warn('Could not restore last project', err); }
    if (!loaded) store.setProject(store.demoProject());
    refreshTransport();
    showTab('editor');
    requestAnimationFrame(frame);
    // unlock audio on first interaction (browser autoplay policy)
    const unlock = () => { engine.ensure(); window.removeEventListener('pointerdown', unlock, true); window.removeEventListener('keydown', unlock, true); };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/localhost|127\.0\.0\.1/.test(location.hostname)) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', boot);

  return {
    showTab, refreshTransport, addTrack, addTrackDialog, deleteTrack, createClip, deleteClip, duplicateClip, copyClip, pasteClip,
    splitClip, importAudioDialog, importAudioFiles, exportWav, actions,
  };
})();
