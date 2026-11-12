/* AppleLab — arrangement view: ruler, track headers, lanes and clips */
window.AL = window.AL || {};

AL.timeline = (() => {
  const store = AL.store;
  const ui = AL.ui;
  const view = ui.view;
  const { el, clamp } = AL.util;

  let scrollEl, tracksEl, rulerEl, loopBand, playheadEl, emptyHint;
  const headerRefs = new Map(); // trackId -> refs
  let recOverlay = null; // {trackIds, startBeat}
  const recEls = new Map();

  function spb() { return 60 / store.project.bpm; }
  function totalBeats() {
    const p = store.project;
    const visible = scrollEl ? Math.ceil((scrollEl.clientWidth - 232) / view.ppb) : 64;
    const end = Math.max(store.songEndBeat(), p.loop.end, AL.engine.currentBeat());
    const bars = Math.ceil((Math.max(end + p.beatsPerBar * 8, visible + p.beatsPerBar * 2)) / p.beatsPerBar);
    return bars * p.beatsPerBar;
  }

  function init() {
    scrollEl = document.getElementById('arrange-scroll');
    tracksEl = document.getElementById('tracks');
    rulerEl = document.getElementById('ruler');
    loopBand = document.getElementById('loop-band');
    playheadEl = document.getElementById('playhead');
    emptyHint = document.getElementById('empty-hint');
    rulerEl.addEventListener('pointerdown', onRulerDown);
    window.addEventListener('resize', AL.util.debounce(render, 150));

    // drop audio files anywhere in arrangement
    const arrange = document.getElementById('arrange');
    arrange.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    arrange.addEventListener('drop', async (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      const lane = e.target.closest && e.target.closest('.lane');
      const beat = lane ? ui.snapBeat(xToBeat(e.clientX, lane)) : AL.engine.currentBeat();
      const trackId = lane ? lane.dataset.track : null;
      await AL.app.importAudioFiles(Array.from(e.dataTransfer.files), trackId, beat);
    });
  }
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');

  function xToBeat(clientX, laneEl) {
    const r = laneEl.getBoundingClientRect();
    return (clientX - r.left) / view.ppb;
  }

  // ---------------- render ----------------
  function render() {
    const p = store.project;
    if (!p || !tracksEl) return;
    const beats = totalBeats();
    const width = beats * view.ppb;
    const barPx = p.beatsPerBar * view.ppb;
    document.documentElement.style.setProperty('--grid',
      `repeating-linear-gradient(90deg, #303945 0 1px, transparent 1px ${barPx}px),` +
      (view.ppb >= 14 ? `repeating-linear-gradient(90deg, #1b222b 0 1px, transparent 1px ${view.ppb}px)` : 'none'));

    // ruler
    rulerEl.style.width = width + 'px';
    rulerEl.querySelectorAll('.mark').forEach((m) => m.remove());
    const labelEvery = barPx < 40 ? Math.ceil(40 / barPx) : 1;
    const frag = document.createDocumentFragment();
    for (let b = 0; b < beats; b++) {
      const isBar = b % p.beatsPerBar === 0;
      const barNo = b / p.beatsPerBar;
      if (isBar && barNo % labelEvery === 0) frag.appendChild(el('div', { class: 'mark', style: { left: b * view.ppb + 'px' }, text: String(barNo + 1) }));
      else if (view.ppb >= 14 || isBar) frag.appendChild(el('div', { class: 'mark minor', style: { left: b * view.ppb + 'px' } }));
    }
    rulerEl.appendChild(frag);
    renderLoop();

    // tracks
    tracksEl.innerHTML = '';
    headerRefs.clear();
    recEls.clear();
    for (const tr of p.tracks) tracksEl.appendChild(renderTrack(tr, width));
    emptyHint.classList.toggle('hidden', p.tracks.length > 0);
    playheadEl.style.height = Math.max(scrollEl.clientHeight, tracksEl.offsetHeight + 28) + 'px';
    updatePlayhead(AL.engine.currentBeat());
  }

  function renderLoop() {
    const L = store.project.loop;
    loopBand.style.left = L.start * view.ppb + 'px';
    loopBand.style.width = Math.max(0, (L.end - L.start) * view.ppb) + 'px';
    loopBand.classList.toggle('off', !L.enabled);
  }

  function renderTrack(tr, width) {
    const sel = store.state.selection;
    const row = el('div', { class: 'track-row' + (sel.trackId === tr.id ? ' selected' : ''), 'data-track': tr.id });

    // ---- header ----
    const name = el('input', { class: 'th-name', value: tr.name, spellcheck: 'false', title: 'Rename track' });
    name.addEventListener('change', () => store.commit((p) => { store.getTrack(tr.id).name = name.value.trim() || tr.name; }));
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); e.stopPropagation(); });

    const mk = (cls, label, title, prop) => {
      const b = el('button', { class: `mini ${cls}` + (tr[prop] ? ' on' : ''), text: label, title });
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        store.commit((p) => { const t = store.getTrack(tr.id); t[prop] = !t[prop]; }, { kind: 'params' });
      });
      return b;
    };
    const mBtn = mk('m', 'M', 'Mute', 'mute');
    const sBtn = mk('s', 'S', 'Solo', 'solo');
    const rBtn = mk('r', '●', tr.type === 'audio' ? 'Arm for recording (microphone)' : 'Arm for recording (keyboard / MIDI)', 'armed');
    const xBtn = el('button', { class: 'mini x', text: '✕', title: 'Delete track', onclick: (e) => { e.stopPropagation(); AL.app.deleteTrack(tr.id); } });

    const vol = el('input', { type: 'range', min: 0, max: 1.25, step: 0.01, value: tr.volume, title: 'Volume' });
    vol.addEventListener('input', () => store.commit((p) => { store.getTrack(tr.id).volume = +vol.value; }, { kind: 'params', mergeKey: 'vol' + tr.id }));
    const pan = el('input', { type: 'range', min: -1, max: 1, step: 0.01, value: tr.pan, title: 'Pan' });
    pan.addEventListener('input', () => store.commit((p) => { store.getTrack(tr.id).pan = +pan.value; }, { kind: 'params', mergeKey: 'pan' + tr.id }));
    pan.addEventListener('dblclick', () => store.commit((p) => { store.getTrack(tr.id).pan = 0; }, { kind: 'params' }));

    let soundSel = null;
    if (tr.type === 'instrument') {
      soundSel = el('select', { title: 'Instrument sound' },
        Object.entries(AL.instruments.presets).map(([id, pr]) => el('option', { value: id, text: pr.name, selected: id === tr.preset })));
      soundSel.addEventListener('change', () => store.commit((p) => { store.getTrack(tr.id).preset = soundSel.value; }));
    } else if (tr.type === 'drums') {
      soundSel = el('select', { title: 'Drum kit' },
        Object.entries(AL.instruments.kits).map(([id, k]) => el('option', { value: id, text: k.name, selected: id === tr.kit })));
      soundSel.addEventListener('change', () => store.commit((p) => { store.getTrack(tr.id).kit = soundSel.value; }));
    } else {
      soundSel = el('span', { class: 'lbl', style: { width: 'auto' }, text: 'Voice / audio' });
    }
    [soundSel].forEach((s) => s.addEventListener('pointerdown', (e) => e.stopPropagation()));

    const meter = el('div', { class: 'th-meter' }, [el('i')]);
    const header = el('div', { class: 'track-header' }, [
      el('div', { class: 'track-color', style: { background: tr.color } }),
      el('div', { class: 'th-body' }, [
        el('div', { class: 'th-top' }, [el('span', { class: 'th-icon', text: ui.TYPE_ICON[tr.type] }), name,
          el('div', { class: 'th-btns' }, [mBtn, sBtn, rBtn, xBtn])]),
        el('div', { class: 'th-bottom' }, [el('span', { class: 'lbl', text: 'Vol' }), vol, el('span', { class: 'lbl', text: 'Pan' }), pan]),
        el('div', { class: 'th-bottom' }, [soundSel]),
        meter,
      ]),
    ]);
    header.addEventListener('pointerdown', () => { if (store.state.selection.trackId !== tr.id) store.select(tr.id, null); });
    header.addEventListener('contextmenu', (e) => { e.preventDefault(); trackMenu(tr, e.clientX, e.clientY); });
    headerRefs.set(tr.id, { vol, pan, mBtn, sBtn, rBtn, meter: meter.firstChild, row });

    // ---- lane ----
    const lane = el('div', { class: 'lane', 'data-track': tr.id, style: { width: width + 'px' } });
    lane.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target !== lane) return;
      store.select(tr.id, null);
    });
    lane.addEventListener('dblclick', (e) => {
      if (e.target !== lane) return;
      const beat = Math.floor(xToBeat(e.clientX, lane) / store.project.beatsPerBar) * store.project.beatsPerBar;
      AL.app.createClip(tr.id, beat);
    });
    lane.addEventListener('dragenter', (e) => { if (hasFiles(e)) lane.classList.add('drop'); });
    lane.addEventListener('dragleave', () => lane.classList.remove('drop'));
    lane.addEventListener('drop', () => lane.classList.remove('drop'));
    lane.addEventListener('contextmenu', (e) => {
      if (e.target !== lane) return;
      e.preventDefault();
      const beat = ui.snapBeat(xToBeat(e.clientX, lane));
      const items = [];
      if (tr.type !== 'audio') items.push({ label: 'Create clip here', onClick: () => AL.app.createClip(tr.id, Math.floor(beat / 4) * 4) });
      else items.push({ label: 'Import audio here…', onClick: () => AL.app.importAudioDialog(tr.id, beat) });
      if (view.clipboard) items.push({ label: 'Paste clip here', onClick: () => AL.app.pasteClip(tr.id, beat) });
      items.push({ label: 'Move playhead here', onClick: () => AL.engine.seek(beat) });
      ui.contextMenu(e.clientX, e.clientY, items);
    });

    for (const clip of tr.clips) lane.appendChild(renderClip(tr, clip));
    row.append(header, lane);
    return row;
  }

  function renderClip(tr, clip) {
    const sel = store.state.selection.clipId === clip.id;
    const w = Math.max(4, clip.length * view.ppb);
    const c = el('div', {
      class: 'clip' + (sel ? ' selected' : ''), 'data-clip': clip.id,
      style: { left: clip.start * view.ppb + 'px', width: w + 'px', background: tr.color },
      title: clip.name || '',
    });
    c.appendChild(el('div', { class: 'clip-name', text: clip.name || '' }));
    const canvas = el('canvas', { width: Math.min(Math.round(w), 4096), height: Math.max(20, 76 - 8 - 16 - 2) });
    c.appendChild(canvas);
    drawClip(canvas, tr, clip);
    if (tr.type !== 'drums') c.appendChild(el('div', { class: 'handle l', 'data-h': 'l' }));
    c.appendChild(el('div', { class: 'handle r', 'data-h': 'r' }));
    c.addEventListener('pointerdown', (e) => onClipDown(e, tr, clip, c));
    c.addEventListener('dblclick', (e) => { e.stopPropagation(); store.select(tr.id, clip.id); AL.app.showTab('editor'); });
    c.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); store.select(tr.id, clip.id); clipMenu(tr, clip, e.clientX, e.clientY); });
    return c;
  }

  function drawClip(canvas, tr, clip) {
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, W, H);
    if (tr.type === 'audio') {
      const buf = store.audio.get(clip.audioId);
      AL.util.drawWaveform(canvas, buf, clip.offset || 0, clip.length * spb(), 'rgba(10,15,20,0.75)');
      if (!buf) { g.fillStyle = 'rgba(0,0,0,.6)'; g.font = '11px sans-serif'; g.fillText('missing audio', 6, 14); }
    } else if (tr.type === 'instrument') {
      const notes = clip.notes || [];
      if (!notes.length) return;
      let lo = 127, hi = 0;
      notes.forEach((n) => { lo = Math.min(lo, n.p); hi = Math.max(hi, n.p); });
      lo -= 2; hi += 2;
      const rowH = H / (hi - lo + 1);
      g.fillStyle = 'rgba(10,15,20,0.8)';
      const px = W / clip.length;
      notes.forEach((n) => {
        if (n.s >= clip.length) return;
        const x = n.s * px, wd = Math.max(2, Math.min(n.l, clip.length - n.s) * px - 1);
        g.fillRect(x, (hi - n.p) * rowH, wd, Math.max(2, rowH - 1));
      });
    } else if (tr.type === 'drums' && clip.pattern) {
      const pat = clip.pattern;
      const stepPx = (W / clip.length) * 0.25;
      const rowH = H / 8;
      g.fillStyle = 'rgba(10,15,20,0.8)';
      const totalSteps = Math.round(clip.length / 0.25);
      for (let k = 0; k < totalSteps; k++) {
        const si = k % pat.steps;
        for (let r = 0; r < 8; r++) if (pat.rows[r][si] > 0) g.fillRect(k * stepPx + 1, r * rowH + 1, Math.max(2, stepPx - 2), Math.max(2, rowH - 2));
      }
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let k = pat.steps; k < totalSteps; k += pat.steps) g.fillRect(k * stepPx, 0, 1, H);
    }
  }

  // ---------------- clip interactions ----------------
  function onClipDown(e, tr, clip, elx) {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (store.state.selection.clipId !== clip.id) {
      store.state.selection.trackId = tr.id;
      store.state.selection.clipId = clip.id;
      document.querySelectorAll('.clip.selected').forEach((n) => n.classList.remove('selected'));
      elx.classList.add('selected');
      document.querySelectorAll('.track-row.selected').forEach((n) => n.classList.remove('selected'));
      elx.closest('.track-row')?.classList.add('selected');
      store.emit('selection');
    }
    const mode = e.target.dataset.h === 'l' ? 'l' : e.target.dataset.h === 'r' ? 'r' : 'move';
    const copy = e.altKey && mode === 'move';
    const startX = e.clientX;
    const orig = { start: clip.start, length: clip.length, offset: clip.offset || 0 };
    const minLen = view.snap || 0.25;
    let moved = false;
    let targetTrackId = tr.id;
    let cur = { ...orig };
    const buf = tr.type === 'audio' ? store.audio.get(clip.audioId) : null;
    elx.setPointerCapture(e.pointerId);

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) < 3 && mode !== 'move') return;
      if (!moved && Math.abs(dx) < 3 && Math.abs(ev.clientY - e.clientY) < 3) return;
      moved = true;
      const db = dx / view.ppb;
      if (mode === 'move') {
        cur.start = ui.snapBeat(orig.start + db);
        elx.style.left = cur.start * view.ppb + 'px';
        // vertical move to another compatible track
        const under = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.classList && n.classList.contains('lane'));
        if (under && under.dataset.track !== targetTrackId) {
          const t2 = store.getTrack(under.dataset.track);
          if (t2 && t2.type === tr.type) { targetTrackId = t2.id; under.appendChild(elx); }
        }
      } else if (mode === 'r') {
        let end = ui.snapBeat(orig.start + orig.length + db);
        let len = Math.max(minLen, end - orig.start);
        if (buf) len = Math.min(len, (buf.duration - orig.offset) / spb());
        cur.length = len;
        elx.style.width = len * view.ppb + 'px';
      } else if (mode === 'l') {
        const end = orig.start + orig.length;
        let s = Math.min(end - minLen, ui.snapBeat(orig.start + db));
        s = Math.max(0, s);
        if (buf) s = Math.max(s, orig.start - orig.offset / spb());
        cur.start = s;
        cur.length = end - s;
        cur.offset = orig.offset + (s - orig.start) * spb();
        elx.style.left = s * view.ppb + 'px';
        elx.style.width = cur.length * view.ppb + 'px';
      }
    };
    const onUp = () => {
      elx.removeEventListener('pointermove', onMove);
      elx.removeEventListener('pointerup', onUp);
      elx.removeEventListener('pointercancel', onUp);
      if (!moved) return;
      store.commit(() => {
        const found = store.findClip(clip.id);
        if (!found) return;
        let c = found.clip;
        if (copy) {
          c = store.cloneClip(found.clip);
          store.getTrack(targetTrackId).clips.push(c);
          c.start = cur.start;
          store.state.selection.clipId = c.id;
          return;
        }
        if (mode === 'l' && found.track.type === 'instrument') {
          const shift = cur.start - orig.start;
          c.notes = c.notes.map((n) => ({ ...n, s: n.s - shift })).filter((n) => n.s + n.l > 0)
            .map((n) => (n.s < 0 ? { ...n, l: n.l + n.s, s: 0 } : n));
        }
        c.start = cur.start;
        c.length = cur.length;
        if (found.track.type === 'audio') c.offset = cur.offset;
        if (targetTrackId !== found.track.id) {
          found.track.clips = found.track.clips.filter((x) => x.id !== c.id);
          store.getTrack(targetTrackId).clips.push(c);
          store.state.selection.trackId = targetTrackId;
        }
      });
    };
    elx.addEventListener('pointermove', onMove);
    elx.addEventListener('pointerup', onUp);
    elx.addEventListener('pointercancel', onUp);
  }

  function clipMenu(tr, clip, x, y) {
    ui.contextMenu(x, y, [
      { label: 'Open in editor', onClick: () => AL.app.showTab('editor') },
      { label: 'Rename…', onClick: async () => {
        const n = await ui.prompt('Rename clip', clip.name || '');
        if (n !== null) store.commit(() => { const f = store.findClip(clip.id); if (f) f.clip.name = n; });
      } },
      { label: 'Duplicate', onClick: () => AL.app.duplicateClip() },
      { label: 'Copy', onClick: () => AL.app.copyClip() },
      { label: 'Split at playhead', onClick: () => AL.app.splitClip() },
      { label: 'Delete', onClick: () => AL.app.deleteClip() },
    ]);
  }

  function trackMenu(tr, x, y) {
    const p = store.project;
    const idx = p.tracks.findIndex((t) => t.id === tr.id);
    ui.contextMenu(x, y, [
      { label: 'Move up', onClick: () => store.commit((p) => { if (idx > 0) { const [t] = p.tracks.splice(idx, 1); p.tracks.splice(idx - 1, 0, t); } }) },
      { label: 'Move down', onClick: () => store.commit((p) => { if (idx < p.tracks.length - 1) { const [t] = p.tracks.splice(idx, 1); p.tracks.splice(idx + 1, 0, t); } }) },
      { label: 'Duplicate track', onClick: () => store.commit((p) => {
        const t = JSON.parse(JSON.stringify(tr));
        t.id = AL.util.uid('trk'); t.name = tr.name + ' copy'; t.armed = false;
        t.clips.forEach((c) => (c.id = AL.util.uid('clp')));
        p.tracks.splice(idx + 1, 0, t);
      }) },
      { label: 'Change color', onClick: () => store.commit(() => {
        const colors = store.TRACK_COLORS;
        const t = store.getTrack(tr.id);
        t.color = colors[(colors.indexOf(t.color) + 1) % colors.length];
      }) },
      { label: 'Delete track', onClick: () => AL.app.deleteTrack(tr.id) },
    ]);
  }

  // ---------------- ruler (seek + loop) ----------------
  function onRulerDown(e) {
    if (e.button !== 0) return;
    const r = rulerEl.getBoundingClientRect();
    const b0 = (e.clientX - r.left) / view.ppb;
    let dragging = false;
    rulerEl.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const b1 = (ev.clientX - r.left) / view.ppb;
      if (!dragging && Math.abs(ev.clientX - e.clientX) < 6) return;
      dragging = true;
      const snap = view.snap || 0.25;
      const a = ui.snapBeat(Math.min(b0, b1), snap), z = ui.snapBeat(Math.max(b0, b1), snap);
      const L = store.project.loop;
      L.start = a; L.end = Math.max(a + snap, z); L.enabled = true;
      renderLoop();
    };
    const up = (ev) => {
      rulerEl.removeEventListener('pointermove', move);
      rulerEl.removeEventListener('pointerup', up);
      if (dragging) {
        const L = { ...store.project.loop };
        store.commit((p) => { p.loop = L; }, { kind: 'params' });
        AL.app.refreshTransport();
      } else {
        AL.engine.seek(ui.snapBeat((ev.clientX - r.left) / view.ppb, view.snap ? Math.min(view.snap, 1) : 0));
      }
    };
    rulerEl.addEventListener('pointermove', move);
    rulerEl.addEventListener('pointerup', up);
  }

  // ---------------- per-frame updates ----------------
  let lastFollow = 0;
  function updatePlayhead(beat) {
    if (!playheadEl) return;
    const x = 232 + beat * view.ppb;
    const hw = getComputedStyle(document.documentElement).getPropertyValue('--header-w');
    const headerW = parseInt(hw, 10) || 232;
    const px = headerW + beat * view.ppb;
    playheadEl.style.left = px + 'px';
    if (AL.engine.transport.playing) {
      const viewL = scrollEl.scrollLeft, viewR = viewL + scrollEl.clientWidth;
      if ((px > viewR - 40 || px < viewL + headerW) && performance.now() - lastFollow > 200) {
        scrollEl.scrollLeft = Math.max(0, px - headerW - 60);
        lastFollow = performance.now();
      }
      if (beat * view.ppb > tracksEl.offsetWidth - headerW - 200) render();
    }
    return x;
  }

  function updateMeters() {
    for (const [id, refs] of headerRefs) {
      const lvl = AL.engine.meterLevel(id);
      refs.meter.style.width = Math.min(100, lvl * 100) + '%';
    }
  }

  function refreshValues() {
    for (const tr of store.project.tracks) {
      const r = headerRefs.get(tr.id);
      if (!r) continue;
      if (document.activeElement !== r.vol) r.vol.value = tr.volume;
      if (document.activeElement !== r.pan) r.pan.value = tr.pan;
      r.mBtn.classList.toggle('on', tr.mute);
      r.sBtn.classList.toggle('on', tr.solo);
      r.rBtn.classList.toggle('on', tr.armed);
    }
    renderLoop();
  }

  function refreshSelection() {
    const sel = store.state.selection;
    document.querySelectorAll('.track-row').forEach((r) => r.classList.toggle('selected', r.dataset.track === sel.trackId));
    document.querySelectorAll('.clip').forEach((c) => c.classList.toggle('selected', c.dataset.clip === sel.clipId));
  }

  // recording overlay (red growing clips)
  function setRecording(trackIds, startBeat) {
    recOverlay = trackIds ? { trackIds, startBeat } : null;
    recEls.forEach((e) => e.remove());
    recEls.clear();
    if (!recOverlay) return;
    for (const id of trackIds) {
      const lane = tracksEl.querySelector(`.lane[data-track="${id}"]`);
      if (!lane) continue;
      const d = el('div', { class: 'clip recording', style: { left: startBeat * view.ppb + 'px', width: '2px' } }, [el('div', { class: 'clip-name', text: 'Recording…' })]);
      lane.appendChild(d);
      recEls.set(id, d);
    }
  }
  function updateRecording(beat) {
    if (!recOverlay) return;
    recEls.forEach((d) => {
      if (!d.isConnected) return;
      d.style.width = Math.max(2, (beat - recOverlay.startBeat) * view.ppb) + 'px';
    });
  }

  function redrawClip(clipId) {
    const f = store.findClip(clipId);
    const node = tracksEl.querySelector(`.clip[data-clip="${clipId}"]`);
    if (!f || !node) return;
    const cv = node.querySelector('canvas');
    if (cv) drawClip(cv, f.track, f.clip);
  }

  return { init, render, updatePlayhead, updateMeters, refreshValues, refreshSelection, setRecording, updateRecording, redrawClip, renderLoop };
})();
