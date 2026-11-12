/* AppleLab — mixer: channel strips with EQ, compressor, drive, reverb & delay sends, meters */
window.AL = window.AL || {};

AL.mixer = (() => {
  const store = AL.store;
  const { el } = AL.util;
  let panel;
  const refs = new Map(); // trackId -> {inputs, meter}

  function init() { panel = document.getElementById('panel-mixer'); }

  function slider(min, max, step, value, onInput, fmt) {
    const input = el('input', { type: 'range', min, max, step, value });
    const val = el('span', { class: 'val', text: fmt(value) });
    input.addEventListener('input', () => { val.textContent = fmt(+input.value); onInput(+input.value); });
    return { input, val, fmt };
  }

  function render() {
    if (!panel) return;
    panel.innerHTML = '';
    refs.clear();
    const p = store.project;
    for (const tr of p.tracks) panel.appendChild(strip(tr));
    panel.appendChild(masterStrip());
    if (!p.tracks.length) panel.prepend(el('div', { class: 'editor-empty', text: 'Add tracks to see them in the mixer.' }));
  }

  function setTrack(id, fn, key) {
    store.commit(() => fn(store.getTrack(id)), { kind: 'params', mergeKey: key + id });
  }

  function strip(tr) {
    const id = tr.id;
    const pct = (v) => Math.round(v * 100) + '';
    const db = (v) => (v > 0 ? '+' : '') + v.toFixed(0);
    const rows = {};
    const row = (label, s) => el('div', { class: 'row' }, [el('label', { text: label }), s.input, s.val]);
    rows.eqHigh = slider(-12, 12, 0.5, tr.fx.eqHigh, (v) => setTrack(id, (t) => (t.fx.eqHigh = v), 'eh'), db);
    rows.eqMid = slider(-12, 12, 0.5, tr.fx.eqMid, (v) => setTrack(id, (t) => (t.fx.eqMid = v), 'em'), db);
    rows.eqLow = slider(-12, 12, 0.5, tr.fx.eqLow, (v) => setTrack(id, (t) => (t.fx.eqLow = v), 'el'), db);
    rows.drive = slider(0, 1, 0.01, tr.fx.drive, (v) => setTrack(id, (t) => (t.fx.drive = v), 'dr'), pct);
    rows.reverb = slider(0, 1, 0.01, tr.fx.reverb, (v) => setTrack(id, (t) => (t.fx.reverb = v), 'rv'), pct);
    rows.delay = slider(0, 1, 0.01, tr.fx.delay, (v) => setTrack(id, (t) => (t.fx.delay = v), 'dl'), pct);
    rows.pan = slider(-1, 1, 0.01, tr.pan, (v) => setTrack(id, (t) => (t.pan = v), 'pan'), (v) => (Math.abs(v) < 0.01 ? 'C' : (v < 0 ? 'L' : 'R') + Math.round(Math.abs(v) * 100)));
    const comp = el('input', { type: 'checkbox', checked: tr.fx.comp });
    comp.addEventListener('change', () => setTrack(id, (t) => (t.fx.comp = comp.checked), 'cp'));
    const fader = el('input', { type: 'range', class: 'vfader', min: 0, max: 1.25, step: 0.01, value: tr.volume, title: 'Volume' });
    fader.addEventListener('input', () => setTrack(id, (t) => (t.volume = +fader.value), 'vol'));
    const meter = el('canvas', { class: 'vmeter', width: 10, height: 100 });
    const mute = el('button', { class: 'mini m' + (tr.mute ? ' on' : ''), text: 'M', title: 'Mute', onclick: () => setTrack(id, (t) => (t.mute = !t.mute), 'mu' + Math.random()) });
    const solo = el('button', { class: 'mini s' + (tr.solo ? ' on' : ''), text: 'S', title: 'Solo', onclick: () => setTrack(id, (t) => (t.solo = !t.solo), 'so' + Math.random()) });
    const reset = el('button', { class: 'mini', text: '↺', title: 'Reset effects', onclick: () => store.commit(() => { store.getTrack(id).fx = store.defaultEffects(); }) });
    refs.set(id, { rows, comp, fader, meter, mute, solo });
    return el('div', { class: 'strip' }, [
      el('div', { class: 'strip-name', style: { borderColor: tr.color }, text: tr.name }),
      el('div', { class: 'row' }, [mute, solo, reset, el('span', { class: 'chk', style: { marginLeft: 'auto' } }, [comp, 'Comp'])]),
      row('High', rows.eqHigh), row('Mid', rows.eqMid), row('Low', rows.eqLow),
      row('Drive', rows.drive), row('Verb', rows.reverb), row('Delay', rows.delay), row('Pan', rows.pan),
      el('div', { class: 'fader-area' }, [fader, meter]),
    ]);
  }

  function masterStrip() {
    const p = store.project;
    const fader = el('input', { type: 'range', class: 'vfader', min: 0, max: 1.25, step: 0.01, value: p.masterVolume, title: 'Master volume' });
    fader.addEventListener('input', () => store.commit((pp) => (pp.masterVolume = +fader.value), { kind: 'params', mergeKey: 'master' }));
    const meter = el('canvas', { class: 'vmeter', width: 10, height: 100 });
    refs.set('master', { fader, meter });
    return el('div', { class: 'strip master' }, [
      el('div', { class: 'strip-name', style: { borderColor: 'var(--accent)' }, text: 'Master' }),
      el('div', { class: 'row', style: { color: 'var(--muted)' }, text: 'Limiter on' }),
      el('div', { class: 'fader-area' }, [fader, meter]),
    ]);
  }

  function refreshValues() {
    const p = store.project;
    for (const tr of p.tracks) {
      const r = refs.get(tr.id);
      if (!r) continue;
      const set = (s, v) => { if (document.activeElement !== s.input) { s.input.value = v; s.val.textContent = s.fmt(v); } };
      set(r.rows.eqHigh, tr.fx.eqHigh); set(r.rows.eqMid, tr.fx.eqMid); set(r.rows.eqLow, tr.fx.eqLow);
      set(r.rows.drive, tr.fx.drive); set(r.rows.reverb, tr.fx.reverb); set(r.rows.delay, tr.fx.delay); set(r.rows.pan, tr.pan);
      r.comp.checked = tr.fx.comp;
      if (document.activeElement !== r.fader) r.fader.value = tr.volume;
      r.mute.classList.toggle('on', tr.mute);
      r.solo.classList.toggle('on', tr.solo);
    }
    const m = refs.get('master');
    if (m && document.activeElement !== m.fader) m.fader.value = p.masterVolume;
  }

  function drawMeter(cv, level) {
    const g = cv.getContext('2d');
    const horizontal = cv.width > cv.height && cv.clientWidth > cv.clientHeight;
    if (!horizontal) { const h = cv.clientHeight || 100; if (cv.height !== h) cv.height = h; }
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const db = 20 * Math.log10(Math.max(level, 1e-5));
    const frac = Math.max(0, Math.min(1, (db + 48) / 51));
    const grad = horizontal ? g.createLinearGradient(0, 0, W, 0) : g.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0, '#7ed957'); grad.addColorStop(0.75, '#e8f05a'); grad.addColorStop(1, '#ff6b6b');
    g.fillStyle = grad;
    if (horizontal) g.fillRect(0, 0, W * frac, H);
    else g.fillRect(0, H * (1 - frac), W, H * frac);
  }

  function updateMeters() {
    if (!panel || !panel.classList.contains('active')) return;
    for (const [id, r] of refs) drawMeter(r.meter, AL.engine.meterLevel(id));
  }

  return { init, render, refreshValues, updateMeters, drawMeter };
})();
