/* AppleLab — audio clip editor (gain, normalize, reverse, fades) */
window.AL = window.AL || {};

AL.audioEditor = (() => {
  const store = AL.store;
  const { el } = AL.util;
  let root, canvas, clipId, trackId, phEl;

  function clipObj() { return store.findClip(clipId); }

  function mount(container, track, clip) {
    clipId = clip.id;
    trackId = track.id;
    container.innerHTML = '';
    const buf = store.audio.get(clip.audioId);
    const gain = el('input', { type: 'range', min: 0, max: 2, step: 0.01, value: clip.gain ?? 1, title: 'Clip gain' });
    const gainVal = el('span', { class: 'field', text: fmtDb(clip.gain ?? 1) });
    gain.addEventListener('input', () => {
      gainVal.textContent = fmtDb(+gain.value);
      store.commit(() => { clipObj().clip.gain = +gain.value; }, { kind: 'params', mergeKey: 'cg' + clipId });
    });
    const btn = (label, title, fn) => el('button', { class: 'btn small', text: label, title, onclick: fn });
    const toolbar = el('div', { class: 'ed-toolbar' }, [
      el('b', { text: '🎤 ' + (clip.name || 'Audio') }),
      el('span', { class: 'sep' }),
      el('label', { class: 'field' }, ['Clip gain', gain]), gainVal,
      el('span', { class: 'sep' }),
      btn('Normalize', 'Raise level so the loudest peak hits -0.5 dB', () => processAudio('normalize')),
      btn('Reverse', 'Play the clip backwards', () => processAudio('reverse')),
      btn('Fade in', 'Apply a fade-in to the visible region', () => processAudio('fadein')),
      btn('Fade out', 'Apply a fade-out to the visible region', () => processAudio('fadeout')),
      btn('Export clip WAV', 'Download this clip as a WAV file', exportClip),
      el('span', { class: 'field', text: buf ? `${buf.duration.toFixed(2)} s · ${buf.sampleRate} Hz · ${buf.numberOfChannels === 1 ? 'mono' : 'stereo'}` : 'Audio missing' }),
    ]);
    canvas = el('canvas');
    phEl = el('div', { style: { position: 'absolute', top: '10px', bottom: '10px', width: '2px', background: '#fff', display: 'none' } });
    const body = el('div', { class: 'au-body', style: { position: 'relative' } }, [canvas, phEl]);
    root = el('div', { class: 'ed-wrap' }, [toolbar, body]);
    container.appendChild(root);
    requestAnimationFrame(draw);
  }

  function fmtDb(g) { return (g <= 0.001 ? '-∞' : (20 * Math.log10(g)).toFixed(1)) + ' dB'; }

  function draw() {
    const f = clipObj();
    if (!f || !canvas.isConnected) return;
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(100, Math.round(r.width));
    canvas.height = Math.max(40, Math.round(r.height));
    const buf = store.audio.get(f.clip.audioId);
    AL.util.drawWaveform(canvas, buf, f.clip.offset || 0, f.clip.length * (60 / store.project.bpm), f.track.color);
  }

  function regionSamples(f, buf) {
    const spb = 60 / store.project.bpm;
    const s0 = Math.max(0, Math.floor((f.clip.offset || 0) * buf.sampleRate));
    const s1 = Math.min(buf.length, Math.floor(((f.clip.offset || 0) + f.clip.length * spb) * buf.sampleRate));
    return [s0, s1];
  }

  function processAudio(op) {
    const f = clipObj();
    const src = f && store.audio.get(f.clip.audioId);
    if (!src) return;
    const out = new AudioBuffer({ numberOfChannels: src.numberOfChannels, length: src.length, sampleRate: src.sampleRate });
    const [s0, s1] = regionSamples(f, src);
    let peak = 0;
    for (let c = 0; c < src.numberOfChannels; c++) {
      const d = src.getChannelData(c);
      for (let i = s0; i < s1; i++) peak = Math.max(peak, Math.abs(d[i]));
    }
    for (let c = 0; c < src.numberOfChannels; c++) {
      const d = new Float32Array(src.getChannelData(c));
      if (op === 'normalize' && peak > 0) { const k = 0.944 / peak; for (let i = 0; i < d.length; i++) d[i] *= k; }
      if (op === 'reverse') d.reverse();
      const fadeLen = Math.min(s1 - s0, Math.floor(src.sampleRate * Math.min(2, ((s1 - s0) / src.sampleRate) / 3)));
      if (op === 'fadein') for (let i = 0; i < fadeLen; i++) d[s0 + i] *= i / fadeLen;
      if (op === 'fadeout') for (let i = 0; i < fadeLen; i++) d[s1 - 1 - i] *= i / fadeLen;
      out.copyToChannel(d, c);
    }
    const id = store.addAudioBuffer(out);
    store.commit(() => {
      const ff = clipObj();
      ff.clip.audioId = id;
      if (op === 'reverse') {
        const spb = 60 / store.project.bpm;
        ff.clip.offset = Math.max(0, src.duration - ((ff.clip.offset || 0) + ff.clip.length * spb));
      }
    });
    AL.ui.toast({ normalize: 'Normalized', reverse: 'Reversed', fadein: 'Fade in applied', fadeout: 'Fade out applied' }[op]);
  }

  function exportClip() {
    const f = clipObj();
    const src = f && store.audio.get(f.clip.audioId);
    if (!src) return;
    const [s0, s1] = regionSamples(f, src);
    const out = new AudioBuffer({ numberOfChannels: src.numberOfChannels, length: Math.max(1, s1 - s0), sampleRate: src.sampleRate });
    for (let c = 0; c < src.numberOfChannels; c++) out.copyToChannel(src.getChannelData(c).subarray(s0, s1), c);
    AL.util.download(new Blob([AL.util.encodeWav(out)], { type: 'audio/wav' }), AL.util.safeFileName(f.clip.name || 'clip') + '.wav');
  }

  function update(track, clip) { mount(root.parentElement, track, clip); }

  function onFrame(beat) {
    const f = clipObj();
    if (!f || !phEl) return;
    const rel = beat - f.clip.start;
    if (AL.engine.transport.playing && rel >= 0 && rel <= f.clip.length) {
      phEl.style.display = 'block';
      phEl.style.left = 10 + (rel / f.clip.length) * (canvas.clientWidth) + 'px';
    } else phEl.style.display = 'none';
  }

  window.addEventListener('resize', () => root && root.isConnected && draw());

  return { mount, update, onFrame, handleKey: () => false, redraw: draw, get clipId() { return clipId; } };
})();
