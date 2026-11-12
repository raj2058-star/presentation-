/* AppleLab — on-screen keyboard / drum pads, computer "musical typing" and Web MIDI input */
window.AL = window.AL || {};

AL.keyboard = (() => {
  const store = AL.store;
  const { el, noteName, isBlack } = AL.util;
  const KEYMAP = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16, "'": 17 };
  const DRUMKEYS = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];
  let octave = 4; // base C4 = 60
  let velocity = 0.85;
  let panel, keysWrap, octLbl, velInput, midiLbl;
  const active = new Map(); // id -> {handle, midi, trackId}
  const keyEls = new Map();

  function targetTrack() {
    const t = store.getTrack(store.state.selection.trackId);
    if (t && t.type !== 'audio') return t;
    const armed = store.project.tracks.find((x) => x.armed && x.type !== 'audio');
    return armed || store.project.tracks.find((x) => x.type !== 'audio') || null;
  }

  function init() {
    panel = document.getElementById('panel-keys');
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', allOff);
  }

  function render() {
    if (!panel) return;
    panel.innerHTML = '';
    const tr = targetTrack();
    octLbl = el('span', { class: 'field', text: 'Octave C' + (octave) });
    velInput = el('input', { type: 'range', min: 0.1, max: 1, step: 0.01, value: velocity });
    velInput.addEventListener('input', () => (velocity = +velInput.value));
    const typing = el('input', { type: 'checkbox', checked: AL.ui.view.musicalTyping });
    typing.addEventListener('change', () => (AL.ui.view.musicalTyping = typing.checked));
    midiLbl = el('span', { class: 'field', text: midiStatus });
    const toolbar = el('div', { class: 'kb-toolbar' }, [
      el('b', { text: tr ? `${AL.ui.TYPE_ICON[tr.type]} Playing: ${tr.name}` : 'Add an instrument or drum track to play' }),
      el('button', { class: 'btn small', text: 'Oct −', title: 'Z', onclick: () => setOct(octave - 1) }),
      octLbl,
      el('button', { class: 'btn small', text: 'Oct +', title: 'X', onclick: () => setOct(octave + 1) }),
      el('label', { class: 'field' }, ['Velocity', velInput]),
      el('label', { class: 'field' }, [typing, 'Computer keyboard (A–L, W E T Y U O P)']),
      el('button', { class: 'btn small', text: 'Connect MIDI keyboard', onclick: connectMidi }),
      midiLbl,
    ]);
    keysWrap = el('div', { class: 'kb-wrap' });
    keyEls.clear();
    if (tr && tr.type === 'drums') {
      const pads = el('div', { class: 'pads' });
      AL.instruments.drumPads.forEach((pad, i) => {
        const b = el('button', {}, [pad.name, el('small', { text: `key ${DRUMKEYS[i].toUpperCase()}` })]);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); press('pad' + i, pad.key); setTimeout(() => release('pad' + i), 120); });
        keyEls.set(pad.key, b);
        pads.appendChild(b);
      });
      keysWrap.appendChild(pads);
    } else {
      const kb = el('div', { class: 'kb' });
      const lo = octave * 12, hi = lo + 36; // one octave below the typing octave up to two above
      let whiteIndex = 0;
      const inv = Object.fromEntries(Object.entries(KEYMAP).map(([k, v]) => [v, k]));
      for (let m = lo; m <= hi; m++) {
        const label = (m - (octave + 1) * 12 >= 0 && inv[m - (octave + 1) * 12] !== undefined) ? inv[m - (octave + 1) * 12].toUpperCase() : (m % 12 === 0 ? noteName(m) : '');
        if (!isBlack(m)) {
          const k = el('div', { class: 'wkey', text: label });
          bindKey(k, m);
          kb.appendChild(k);
          keyEls.set(m, k);
          whiteIndex++;
        } else {
          const k = el('div', { class: 'bkey', text: label, style: { left: whiteIndex * 38 - 12 + 'px' } });
          bindKey(k, m);
          kb.appendChild(k);
          keyEls.set(m, k);
        }
      }
      keysWrap.appendChild(kb);
    }
    panel.append(toolbar, keysWrap);
  }

  function bindKey(k, m) {
    k.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      k.setPointerCapture(e.pointerId);
      press('ptr' + e.pointerId, m);
      const up = () => { release('ptr' + e.pointerId); k.removeEventListener('pointerup', up); k.removeEventListener('pointercancel', up); };
      k.addEventListener('pointerup', up);
      k.addEventListener('pointercancel', up);
    });
  }

  function setOct(o) {
    octave = Math.max(1, Math.min(7, o));
    if (octLbl) render();
  }

  function press(id, midi, vel = velocity) {
    if (active.has(id)) return;
    const tr = targetTrack();
    if (!tr) return;
    const handle = AL.engine.liveNoteOn(tr.id, midi, vel);
    active.set(id, { handle, midi, trackId: tr.id });
    keyEls.get(midi)?.classList.add('down');
    AL.recorder.noteEvent(tr.id, midi, vel, true);
  }
  function release(id) {
    const a = active.get(id);
    if (!a) return;
    active.delete(id);
    if (a.handle && a.handle.release && AL.engine.ctx) a.handle.release(AL.engine.ctx.currentTime);
    keyEls.get(a.midi)?.classList.remove('down');
    AL.recorder.noteEvent(a.trackId, a.midi, 0, false);
  }
  function allOff() { [...active.keys()].forEach(release); }

  function onKeyDown(e) {
    if (!AL.ui.view.musicalTyping || e.ctrlKey || e.metaKey || e.altKey || AL.ui.isTyping(e)) return;
    if (document.querySelector('.modal-bg')) return;
    const key = e.key.toLowerCase();
    const tr = targetTrack();
    if (!tr) return;
    if (key === 'z') { setOct(octave - 1); e.preventDefault(); return; }
    if (key === 'x') { setOct(octave + 1); e.preventDefault(); return; }
    if (key === 'c') { velocity = Math.max(0.1, velocity - 0.1); if (velInput) velInput.value = velocity; e.preventDefault(); return; }
    if (key === 'v') { velocity = Math.min(1, velocity + 0.1); if (velInput) velInput.value = velocity; e.preventDefault(); return; }
    let midi = null;
    if (tr.type === 'drums') {
      const i = DRUMKEYS.indexOf(key);
      if (i >= 0) midi = AL.instruments.drumPads[i].key;
    } else if (KEYMAP[key] !== undefined) midi = (octave + 1) * 12 + KEYMAP[key];
    if (midi === null) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    press('key' + key, midi);
  }
  function onKeyUp(e) {
    const key = e.key.toLowerCase();
    if (active.has('key' + key)) release('key' + key);
  }
  function consumes(e) {
    if (!AL.ui.view.musicalTyping || e.ctrlKey || e.metaKey || e.altKey) return false;
    const tr = targetTrack();
    if (!tr) return false;
    const key = e.key.toLowerCase();
    if ('zxcv'.includes(key) && key.length === 1) return true;
    return tr.type === 'drums' ? DRUMKEYS.includes(key) : KEYMAP[key] !== undefined;
  }

  // ---- Web MIDI ----
  let midiStatus = '';
  async function connectMidi() {
    if (!navigator.requestMIDIAccess) { AL.ui.toast('Web MIDI is not supported in this browser'); return; }
    try {
      const access = await navigator.requestMIDIAccess();
      const hook = () => {
        let n = 0;
        access.inputs.forEach((inp) => { inp.onmidimessage = onMidi; n++; });
        midiStatus = n ? `${n} MIDI input${n > 1 ? 's' : ''} connected` : 'No MIDI devices found';
        if (midiLbl) midiLbl.textContent = midiStatus;
      };
      hook();
      access.onstatechange = hook;
      AL.ui.toast(midiStatus);
    } catch (err) {
      AL.ui.toast('MIDI access was denied');
    }
  }
  function onMidi(msg) {
    const [st, d1, d2] = msg.data;
    const cmd = st & 0xf0;
    if (cmd === 0x90 && d2 > 0) press('midi' + d1, d1, d2 / 127);
    else if (cmd === 0x80 || (cmd === 0x90 && d2 === 0)) release('midi' + d1);
  }

  return { init, render, consumes, allOff };
})();
