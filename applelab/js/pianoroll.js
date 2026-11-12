/* AppleLab — piano roll editor for instrument clips */
window.AL = window.AL || {};

AL.pianoRoll = (() => {
  const store = AL.store;
  const { el, clamp, noteName, isBlack } = AL.util;

  const LOW = 24, HIGH = 108; // C1..C8
  const ROW = 14;
  const KEYW = 54;

  let root, body, keysCv, gridCv, phEl, clipId, trackId;
  let ppb = 72;
  let snap = 0.25;
  let noteLen = 1;
  let velocity = 0.8;
  let notes = []; // working copy
  let selected = new Set();
  let drag = null;

  function rowsH() { return (HIGH - LOW + 1) * ROW; }
  function clipObj() { return store.findClip(clipId); }

  function mount(container, track, clip) {
    trackId = track.id;
    clipId = clip.id;
    notes = JSON.parse(JSON.stringify(clip.notes || []));
    selected = new Set();
    container.innerHTML = '';

    const snapSel = el('select', { title: 'Grid' }, [['1', '1/4'], ['0.5', '1/8'], ['0.25', '1/16'], ['0.125', '1/32']]
      .map(([v, t]) => el('option', { value: v, text: t, selected: +v === snap })));
    snapSel.addEventListener('change', () => { snap = +snapSel.value; noteLen = Math.max(snap, noteLen); draw(); });
    const lenSel = el('select', { title: 'New note length' }, [['4', '1 bar'], ['2', '1/2'], ['1', '1/4'], ['0.5', '1/8'], ['0.25', '1/16'], ['0.125', '1/32']]
      .map(([v, t]) => el('option', { value: v, text: t, selected: +v === noteLen })));
    lenSel.addEventListener('change', () => (noteLen = +lenSel.value));
    const vel = el('input', { type: 'range', min: 0.05, max: 1, step: 0.01, value: velocity, title: 'Velocity (new / selected notes)' });
    vel.addEventListener('input', () => {
      velocity = +vel.value;
      if (selected.size) { notes.forEach((n, i) => selected.has(i) && (n.v = velocity)); draw(); commitNotes('vel'); }
    });
    const zoom = el('input', { type: 'range', min: 24, max: 220, value: ppb, title: 'Zoom' });
    zoom.addEventListener('input', () => { ppb = +zoom.value; resize(); draw(); });
    const lenBars = el('input', { type: 'number', min: 1, max: 256, step: 1, value: Math.max(1, Math.round(clip.length / 4)), title: 'Clip length (bars)', style: { width: '56px' } });
    lenBars.addEventListener('change', () => {
      const bars = clamp(Math.round(+lenBars.value || 1), 1, 256);
      store.commit(() => { const f = clipObj(); if (f) f.clip.length = bars * store.project.beatsPerBar; });
    });

    const btn = (label, title, fn) => el('button', { class: 'btn small', text: label, title, onclick: fn });
    const toolbar = el('div', { class: 'ed-toolbar' }, [
      el('b', { text: '🎹 ' + (clip.name || 'Clip') }),
      el('span', { class: 'sep' }),
      el('label', { class: 'field' }, ['Grid', snapSel]),
      el('label', { class: 'field' }, ['Length', lenSel]),
      el('label', { class: 'field' }, ['Velocity', vel]),
      el('span', { class: 'sep' }),
      btn('Quantize', 'Snap selected (or all) notes to the grid', quantize),
      btn('−12', 'Transpose down an octave', () => transpose(-12)),
      btn('−1', 'Transpose down a semitone', () => transpose(-1)),
      btn('+1', 'Transpose up a semitone', () => transpose(1)),
      btn('+12', 'Transpose up an octave', () => transpose(12)),
      btn('Select all', 'Ctrl+A', () => { selected = new Set(notes.map((_, i) => i)); draw(); }),
      btn('Delete', 'Delete selected notes (Del)', deleteSelected),
      el('span', { class: 'sep' }),
      el('label', { class: 'field' }, ['Bars', lenBars]),
      el('label', { class: 'field' }, ['Zoom', zoom]),
      el('span', { class: 'field', text: 'Click: add · Drag: move/resize · Right-click: delete · Shift-drag: select' }),
    ]);

    body = el('div', { class: 'pr-body', tabindex: '0' });
    const inner = el('div', { style: { display: 'flex', position: 'relative', width: 'max-content' } });
    keysCv = el('canvas', { style: { position: 'sticky', left: '0', zIndex: '2' } });
    gridCv = el('canvas');
    phEl = el('div', { style: { position: 'absolute', top: '0', width: '2px', background: '#fff', pointerEvents: 'none', display: 'none', zIndex: '1' } });
    inner.append(keysCv, gridCv, phEl);
    body.appendChild(inner);
    root = el('div', { class: 'ed-wrap' }, [toolbar, body]);
    container.appendChild(root);

    keysCv.addEventListener('pointerdown', onKeysDown);
    gridCv.addEventListener('pointerdown', onGridDown);
    gridCv.addEventListener('contextmenu', (e) => e.preventDefault());
    gridCv.addEventListener('pointermove', onHover);
    resize();
    draw();
    // center on the notes (or middle C)
    const center = notes.length ? notes.reduce((a, n) => a + n.p, 0) / notes.length : 60;
    body.scrollTop = (HIGH - center) * ROW - body.clientHeight / 2;
  }

  function update(track, clip) {
    if (drag) return;
    notes = JSON.parse(JSON.stringify(clip.notes || []));
    selected = new Set([...selected].filter((i) => i < notes.length));
    resize();
    draw();
  }

  function resize() {
    const f = clipObj();
    if (!f) return;
    const w = Math.max(f.clip.length * ppb, 200);
    const h = rowsH();
    const dpr = window.devicePixelRatio || 1;
    for (const [cv, cw] of [[keysCv, KEYW], [gridCv, w]]) {
      cv.width = Math.round(cw * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = cw + 'px';
      cv.style.height = h + 'px';
      cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    phEl.style.height = h + 'px';
  }

  function draw() {
    const f = clipObj();
    if (!f) return;
    const clip = f.clip;
    // keys
    const k = keysCv.getContext('2d');
    k.clearRect(0, 0, KEYW, rowsH());
    for (let m = HIGH; m >= LOW; m--) {
      const y = (HIGH - m) * ROW;
      k.fillStyle = isBlack(m) ? '#20262e' : '#dfe4ea';
      k.fillRect(0, y, KEYW, ROW);
      k.fillStyle = '#0f1318';
      k.fillRect(0, y + ROW - 1, KEYW, 1);
      if (m % 12 === 0) { k.fillStyle = '#444'; k.font = '10px sans-serif'; k.fillText(noteName(m), 4, y + ROW - 3); }
    }
    // grid
    const g = gridCv.getContext('2d');
    const W = parseFloat(gridCv.style.width), H = rowsH();
    g.fillStyle = '#141920';
    g.fillRect(0, 0, W, H);
    for (let m = HIGH; m >= LOW; m--) {
      const y = (HIGH - m) * ROW;
      if (isBlack(m)) { g.fillStyle = '#10141a'; g.fillRect(0, y, W, ROW); }
      g.fillStyle = m % 12 === 0 ? '#2b3440' : '#1a2028';
      g.fillRect(0, y + ROW - 1, W, 1);
    }
    const bpb = store.project.beatsPerBar;
    for (let b = 0; b <= clip.length + 1e-6; b += snap) {
      const x = Math.round(b * ppb);
      const isBar = Math.abs(b % bpb) < 1e-6, isBeat = Math.abs(b % 1) < 1e-6;
      g.fillStyle = isBar ? '#3d4856' : isBeat ? '#28313c' : '#1c232c';
      g.fillRect(x, 0, 1, H);
    }
    if (W > clip.length * ppb) { g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(clip.length * ppb, 0, W - clip.length * ppb, H); }
    // notes
    const color = f.track.color;
    notes.forEach((n, i) => {
      const x = n.s * ppb, y = (HIGH - n.p) * ROW, w = Math.max(3, n.l * ppb - 1);
      g.globalAlpha = 0.45 + 0.55 * n.v;
      g.fillStyle = selected.has(i) ? '#ffffff' : color;
      g.fillRect(x + 0.5, y + 1, w, ROW - 2);
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(0,0,0,.6)';
      g.strokeRect(x + 0.5, y + 1, w, ROW - 2);
      if (w > 28) { g.fillStyle = 'rgba(0,0,0,.75)'; g.font = '9px sans-serif'; g.fillText(noteName(n.p), x + 3, y + ROW - 4); }
    });
    if (drag && drag.type === 'box') {
      g.strokeStyle = '#fff'; g.setLineDash([4, 3]);
      const { x0, y0, x1, y1 } = drag;
      g.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      g.setLineDash([]);
    }
  }

  function pos(e) {
    const r = gridCv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    return { x, y, beat: x / ppb, pitch: HIGH - Math.floor(y / ROW) };
  }
  function hit(x, y) {
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      const nx = n.s * ppb, ny = (HIGH - n.p) * ROW, nw = Math.max(3, n.l * ppb);
      if (x >= nx && x <= nx + nw && y >= ny && y < ny + ROW) return { i, edge: x > nx + nw - 6 };
    }
    return null;
  }
  const snapB = (b) => (snap ? Math.round(b / snap) * snap : b);
  const floorB = (b) => (snap ? Math.floor(b / snap) * snap : b);

  function onHover(e) {
    if (drag) return;
    const p = pos(e);
    const h = hit(p.x, p.y);
    gridCv.style.cursor = h ? (h.edge ? 'ew-resize' : 'move') : 'crosshair';
  }

  function onGridDown(e) {
    body.focus({ preventScroll: true });
    const f = clipObj();
    if (!f) return;
    const p = pos(e);
    const h = hit(p.x, p.y);
    if (e.button === 2) {
      if (h) { notes.splice(h.i, 1); selected.clear(); draw(); commitNotes(); }
      return;
    }
    if (e.button !== 0) return;
    gridCv.setPointerCapture(e.pointerId);
    if (h) {
      if (e.shiftKey) { selected.has(h.i) ? selected.delete(h.i) : selected.add(h.i); draw(); return; }
      if (!selected.has(h.i)) selected = new Set([h.i]);
      const orig = new Map([...selected].map((i) => [i, { ...notes[i] }]));
      drag = { type: h.edge ? 'resize' : 'move', start: p, orig, lead: h.i, moved: false };
      if (!h.edge) AL.engine.previewNote(trackId, notes[h.i].p, 0.25);
    } else if (e.shiftKey) {
      drag = { type: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    } else {
      if (p.pitch < LOW || p.pitch > HIGH || p.beat >= f.clip.length) return;
      const n = { p: p.pitch, s: Math.max(0, floorB(p.beat)), l: noteLen, v: velocity };
      n.l = Math.min(n.l, f.clip.length - n.s);
      notes.push(n);
      const i = notes.length - 1;
      selected = new Set([i]);
      drag = { type: 'resize', start: p, orig: new Map([[i, { ...n }]]), lead: i, moved: true, created: true };
      AL.engine.previewNote(trackId, n.p, 0.25);
    }
    draw();
    const move = (ev) => onDragMove(ev);
    const up = () => {
      gridCv.removeEventListener('pointermove', move);
      gridCv.removeEventListener('pointerup', up);
      gridCv.removeEventListener('pointercancel', up);
      const d = drag;
      drag = null;
      if (d && d.type === 'box') { draw(); return; }
      if (d && d.moved) commitNotes();
      else draw();
    };
    gridCv.addEventListener('pointermove', move);
    gridCv.addEventListener('pointerup', up);
    gridCv.addEventListener('pointercancel', up);
  }

  function onDragMove(e) {
    if (!drag) return;
    const f = clipObj();
    const p = pos(e);
    if (drag.type === 'box') {
      drag.x1 = p.x; drag.y1 = p.y;
      const bx0 = Math.min(drag.x0, drag.x1), bx1 = Math.max(drag.x0, drag.x1);
      const by0 = Math.min(drag.y0, drag.y1), by1 = Math.max(drag.y0, drag.y1);
      selected = new Set();
      notes.forEach((n, i) => {
        const nx = n.s * ppb, ny = (HIGH - n.p) * ROW;
        if (nx + n.l * ppb >= bx0 && nx <= bx1 && ny + ROW >= by0 && ny <= by1) selected.add(i);
      });
      draw();
      return;
    }
    const db = p.beat - drag.start.beat;
    const dp = p.pitch - drag.start.pitch;
    if (!drag.moved && Math.abs(p.x - drag.start.x) < 3 && Math.abs(p.y - drag.start.y) < 3) return;
    drag.moved = true;
    if (drag.type === 'move') {
      const lead = drag.orig.get(drag.lead);
      const newLeadS = Math.max(0, snapB(lead.s + db));
      const ds = newLeadS - lead.s;
      let minS = Infinity, minP = 127, maxP = 0;
      drag.orig.forEach((o) => { minS = Math.min(minS, o.s); minP = Math.min(minP, o.p); maxP = Math.max(maxP, o.p); });
      const dsC = Math.max(-minS, ds);
      const dpC = clamp(dp, LOW - minP, HIGH - maxP);
      let pitchChanged = false;
      drag.orig.forEach((o, i) => {
        const np = o.p + dpC;
        if (i === drag.lead && notes[i].p !== np) pitchChanged = true;
        notes[i].s = Math.min(o.s + dsC, f.clip.length - 0.0625);
        notes[i].p = np;
      });
      if (pitchChanged) AL.engine.previewNote(trackId, notes[drag.lead].p, 0.2);
    } else if (drag.type === 'resize') {
      const lead = drag.orig.get(drag.lead);
      const minL = snap || 0.0625;
      drag.orig.forEach((o, i) => {
        const newEnd = snapB(o.s + o.l + db);
        notes[i].l = clamp(newEnd - o.s, minL, f.clip.length - o.s);
      });
      if (drag.created) noteLen = notes[drag.lead].l || lead.l;
    }
    draw();
  }

  function onKeysDown(e) {
    const r = keysCv.getBoundingClientRect();
    const m = HIGH - Math.floor((e.clientY - r.top) / ROW);
    if (m >= LOW && m <= HIGH) AL.engine.previewNote(trackId, m, 0.5);
  }

  function commitNotes(mergeKey) {
    const snapshotNotes = notes.map((n) => ({ ...n }));
    store.commit(() => {
      const f = clipObj();
      if (f) f.clip.notes = snapshotNotes;
    }, { kind: 'structure', mergeKey: mergeKey ? mergeKey + clipId : undefined, detail: { from: 'pianoroll' } });
  }

  function deleteSelected() {
    if (!selected.size) return;
    notes = notes.filter((_, i) => !selected.has(i));
    selected.clear();
    draw();
    commitNotes();
  }
  function quantize() {
    const idx = selected.size ? [...selected] : notes.map((_, i) => i);
    const q = snap || 0.25;
    idx.forEach((i) => { notes[i].s = Math.round(notes[i].s / q) * q; notes[i].l = Math.max(q, Math.round(notes[i].l / q) * q); });
    draw();
    commitNotes();
  }
  function transpose(d) {
    const idx = selected.size ? [...selected] : notes.map((_, i) => i);
    idx.forEach((i) => (notes[i].p = clamp(notes[i].p + d, LOW, HIGH)));
    draw();
    commitNotes();
  }
  function nudge(d) {
    const f = clipObj();
    [...selected].forEach((i) => (notes[i].s = clamp(notes[i].s + d, 0, f.clip.length - 0.0625)));
    draw();
    commitNotes('nudge');
  }

  function handleKey(e) {
    if (!root || !root.isConnected) return false;
    const focused = root.contains(document.activeElement);
    if (!focused) return false;
    if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return true; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { selected = new Set(notes.map((_, i) => i)); draw(); return true; }
    if (!selected.size) return false;
    if (e.key === 'ArrowUp') { transpose(e.shiftKey ? 12 : 1); return true; }
    if (e.key === 'ArrowDown') { transpose(e.shiftKey ? -12 : -1); return true; }
    if (e.key === 'ArrowLeft') { nudge(-(snap || 0.25)); return true; }
    if (e.key === 'ArrowRight') { nudge(snap || 0.25); return true; }
    return false;
  }

  function onFrame(beat) {
    const f = clipObj();
    if (!f || !phEl) return;
    const rel = beat - f.clip.start;
    if (AL.engine.transport.playing && rel >= 0 && rel <= f.clip.length) {
      phEl.style.display = 'block';
      phEl.style.left = KEYW + rel * ppb + 'px';
    } else phEl.style.display = 'none';
  }

  return { mount, update, handleKey, onFrame, get clipId() { return clipId; } };
})();
