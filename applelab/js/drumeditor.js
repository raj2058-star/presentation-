/* AppleLab — step sequencer for drum clips */
window.AL = window.AL || {};

AL.drumEditor = (() => {
  const store = AL.store;
  const { el } = AL.util;
  let root, gridEl, clipId, trackId, stepBtns = [], lastStep = -1;
  let paintValue = null;

  function clipObj() { return store.findClip(clipId); }

  function mount(container, track, clip) {
    clipId = clip.id;
    trackId = track.id;
    lastStep = -1;
    container.innerHTML = '';
    const pat = clip.pattern;

    const stepsSel = el('select', { title: 'Pattern length' }, [16, 32, 48, 64].map((n) => el('option', { value: n, text: `${n / 16} bar${n > 16 ? 's' : ''} (${n} steps)`, selected: n === pat.steps })));
    stepsSel.addEventListener('change', () => {
      const n = +stepsSel.value;
      store.commit(() => {
        const f = clipObj();
        const old = f.clip.pattern;
        f.clip.pattern = { steps: n, rows: old.rows.map((r) => Array.from({ length: n }, (_, i) => r[i % old.steps] || 0)) };
        if (f.clip.length < n / 4) f.clip.length = n / 4;
      });
    });
    const lenBars = el('input', { type: 'number', min: 1, max: 256, step: 1, value: Math.max(1, Math.round(clip.length / 4)), title: 'Clip length in bars (pattern repeats)', style: { width: '56px' } });
    lenBars.addEventListener('change', () => {
      const bars = Math.max(1, Math.min(256, Math.round(+lenBars.value || 1)));
      store.commit(() => { const f = clipObj(); if (f) f.clip.length = bars * store.project.beatsPerBar; });
    });
    const btn = (label, title, fn) => el('button', { class: 'btn small', text: label, title, onclick: fn });
    const toolbar = el('div', { class: 'ed-toolbar' }, [
      el('b', { text: '🥁 ' + (clip.name || 'Pattern') }),
      el('span', { class: 'sep' }),
      el('label', { class: 'field' }, ['Pattern', stepsSel]),
      el('label', { class: 'field' }, ['Clip bars', lenBars]),
      el('span', { class: 'sep' }),
      btn('Clear', 'Clear all steps', () => mutate((pt) => pt.rows.forEach((r) => r.fill(0)))),
      btn('Four on the floor', 'Kick on every beat', () => mutate((pt) => { for (let i = 0; i < pt.steps; i++) pt.rows[0][i] = i % 4 === 0 ? 1 : 0; })),
      btn('Hats 8ths', 'Closed hats on every 8th', () => mutate((pt) => { for (let i = 0; i < pt.steps; i++) pt.rows[3][i] = i % 2 === 0 ? (i % 4 === 0 ? 0.9 : 0.55) : 0; })),
      btn('Backbeat', 'Snare on 2 and 4', () => mutate((pt) => { for (let i = 0; i < pt.steps; i++) pt.rows[1][i] = i % 8 === 4 ? 1 : 0; })),
      btn('Randomize', 'Generate a random groove', randomize),
      el('span', { class: 'field', text: 'Click: toggle · Shift-click: soft hit · Drag to paint' }),
    ]);

    gridEl = el('div', { class: 'dr-grid' });
    gridEl.style.gridTemplateColumns = `110px repeat(${pat.steps}, minmax(22px, 1fr))`;
    stepBtns = [];
    AL.instruments.drumPads.forEach((pad, r) => {
      gridEl.appendChild(el('button', { class: 'dr-pad', text: pad.name, title: 'Preview', onpointerdown: () => AL.engine.previewDrum(trackId, r) }));
      stepBtns[r] = [];
      for (let s = 0; s < pat.steps; s++) {
        const b = el('button', { class: 'dr-step' + (Math.floor(s / 4) % 2 === 0 ? ' beat' : ''), 'aria-label': `${pad.name} step ${s + 1}` });
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const f = clipObj();
          const cur = f.clip.pattern.rows[r][s];
          paintValue = cur > 0 ? 0 : e.shiftKey ? 0.5 : 1;
          setStep(r, s, paintValue);
          if (paintValue) AL.engine.previewDrum(trackId, r, paintValue);
          const up = () => { paintValue = null; window.removeEventListener('pointerup', up); };
          window.addEventListener('pointerup', up);
        });
        b.addEventListener('pointerenter', () => { if (paintValue !== null) setStep(r, s, paintValue); });
        stepBtns[r][s] = b;
        gridEl.appendChild(b);
      }
    });
    root = el('div', { class: 'ed-wrap' }, [toolbar, el('div', { class: 'dr-body' }, [gridEl])]);
    container.appendChild(root);
    paint();
  }

  function setStep(r, s, v) {
    const f = clipObj();
    if (!f || f.clip.pattern.rows[r][s] === v) return;
    store.commit(() => { clipObj().clip.pattern.rows[r][s] = v; }, { mergeKey: 'paint' + clipId, detail: { from: 'drums' } });
  }

  function mutate(fn) {
    store.commit(() => fn(clipObj().clip.pattern));
  }

  function randomize() {
    mutate((pt) => {
      const prob = [[0.9, 0, 0, 0.1, 0.5, 0, 0.35, 0.1], [0, 0, 0, 0, 0.95, 0, 0, 0.1], [0, 0, 0, 0, 0.2, 0, 0, 0], [0.7, 0.3, 0.7, 0.3, 0.7, 0.3, 0.7, 0.4],
        [0, 0, 0, 0, 0, 0, 0.25, 0], [0.05, 0, 0, 0.05, 0, 0, 0.05, 0.1], [0, 0.05, 0, 0, 0, 0.05, 0, 0], [0, 0.08, 0, 0.08, 0, 0.08, 0, 0.08]];
      for (let r = 0; r < 8; r++) for (let s = 0; s < pt.steps; s++) {
        const pr = prob[r][s % 8];
        pt.rows[r][s] = Math.random() < pr ? (Math.random() < 0.3 ? 0.55 : 1) : 0;
      }
    });
  }

  function paint() {
    const f = clipObj();
    if (!f) return;
    const pat = f.clip.pattern;
    stepBtns.forEach((row, r) => row.forEach((b, s) => {
      const v = pat.rows[r][s];
      b.classList.toggle('on', v > 0);
      b.classList.toggle('soft', v > 0 && v < 0.75);
    }));
  }

  function update(track, clip) {
    if (!gridEl || clip.pattern.steps !== stepBtns[0]?.length) { mount(root.parentElement, track, clip); return; }
    paint();
  }

  function onFrame(beat) {
    const f = clipObj();
    if (!f || !stepBtns.length) return;
    let step = -1;
    const rel = beat - f.clip.start;
    if (AL.engine.transport.playing && rel >= 0 && rel < f.clip.length) step = Math.floor(rel / 0.25) % f.clip.pattern.steps;
    if (step === lastStep) return;
    stepBtns.forEach((row) => { if (row[lastStep]) row[lastStep].classList.remove('now'); if (row[step]) row[step].classList.add('now'); });
    lastStep = step;
  }

  return { mount, update, onFrame, handleKey: () => false, get clipId() { return clipId; } };
})();
