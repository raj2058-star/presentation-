/* AppleLab — shared helpers */
window.AL = window.AL || {};

AL.util = (() => {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function uid(prefix = 'id') {
    return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const noteName = (m) => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const isBlack = (m) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
  const dbToGain = (db) => Math.pow(10, db / 20);
  const gainToDb = (g) => (g <= 0.00001 ? -100 : 20 * Math.log10(g));

  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c === null || c === undefined || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function formatClock(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = sec - m * 60;
    return String(m).padStart(2, '0') + ':' + s.toFixed(1).padStart(4, '0');
  }

  function formatBBT(beat, beatsPerBar = 4) {
    if (beat < 0) beat = 0;
    const bar = Math.floor(beat / beatsPerBar) + 1;
    const b = Math.floor(beat % beatsPerBar) + 1;
    const tick = Math.floor((beat % 1) * 4) + 1;
    return `${bar}.${b}.${tick}`;
  }

  // ---- WAV encoding (16-bit PCM, interleaved) ----
  function encodeWav(buffer) {
    const numCh = Math.min(2, buffer.numberOfChannels);
    const sr = buffer.sampleRate;
    const len = buffer.length;
    const bytesPerSample = 2;
    const dataSize = len * numCh * bytesPerSample;
    const ab = new ArrayBuffer(44 + dataSize);
    const dv = new DataView(ab);
    const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    dv.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true);
    dv.setUint16(22, numCh, true);
    dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * numCh * bytesPerSample, true);
    dv.setUint16(32, numCh * bytesPerSample, true);
    dv.setUint16(34, 16, true);
    writeStr(36, 'data');
    dv.setUint32(40, dataSize, true);
    const chans = [];
    for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < numCh; c++) {
        const s = clamp(chans[c][i], -1, 1);
        dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        o += 2;
      }
    }
    return ab;
  }

  // ---- AudioBuffer <-> plain data ----
  function bufferToData(buf) {
    const channels = [];
    for (let c = 0; c < buf.numberOfChannels; c++) channels.push(new Float32Array(buf.getChannelData(c)));
    return { sampleRate: buf.sampleRate, length: buf.length, channels };
  }
  function dataToBuffer(data) {
    const buf = new AudioBuffer({ numberOfChannels: data.channels.length, length: data.length, sampleRate: data.sampleRate });
    data.channels.forEach((ch, i) => buf.copyToChannel(ch instanceof Float32Array ? ch : new Float32Array(ch), i));
    return buf;
  }

  function f32ToBase64(f32) {
    const bytes = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(bin);
  }
  function base64ToF32(str) {
    const bin = atob(str);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Float32Array(bytes.buffer);
  }

  function download(blob, filename) {
    // Android app: hand the file to the native side, which saves it to Downloads/AppleLab
    if (window.AndroidBridge && window.AndroidBridge.saveFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = String(reader.result).split(',')[1] || '';
        const res = window.AndroidBridge.saveFile(b64, filename, blob.type || 'application/octet-stream');
        if (window.AL && AL.ui) AL.ui.toast(res.startsWith('ERROR') ? 'Save failed: ' + res.slice(7) : 'Saved to ' + res, 4000);
      };
      reader.readAsDataURL(blob);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function safeFileName(name) {
    return (name || 'untitled').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'untitled';
  }

  function pickFile(accept, multiple = false) {
    return new Promise((resolve) => {
      const input = el('input', { type: 'file', accept, multiple, style: { display: 'none' } });
      input.addEventListener('change', () => { resolve(Array.from(input.files || [])); input.remove(); });
      document.body.appendChild(input);
      input.click();
    });
  }

  // compute min/max peaks for waveform drawing (cached per buffer)
  const peakCache = new WeakMap();
  function getPeaks(buffer, buckets = 2000) {
    let entry = peakCache.get(buffer);
    if (entry && entry.buckets === buckets) return entry.peaks;
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
    const size = Math.max(1, Math.floor(buffer.length / buckets));
    const peaks = new Float32Array(buckets * 2);
    for (let b = 0; b < buckets; b++) {
      let min = 0, max = 0;
      const start = b * size;
      const end = Math.min(buffer.length, start + size);
      for (let i = start; i < end; i++) {
        const v = ch1 ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      peaks[b * 2] = min;
      peaks[b * 2 + 1] = max;
    }
    peakCache.set(buffer, { buckets, peaks });
    return peaks;
  }

  function drawWaveform(canvas, buffer, offsetSec, durationSec, color) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!buffer) return;
    const peaks = getPeaks(buffer);
    const buckets = peaks.length / 2;
    const secPerBucket = buffer.duration / buckets;
    ctx.fillStyle = color;
    const mid = h / 2;
    for (let x = 0; x < w; x++) {
      const t0 = offsetSec + (x / w) * durationSec;
      const t1 = offsetSec + ((x + 1) / w) * durationSec;
      let b0 = Math.floor(t0 / secPerBucket), b1 = Math.max(b0 + 1, Math.floor(t1 / secPerBucket));
      if (b0 >= buckets || t0 < 0) continue;
      let min = 0, max = 0;
      for (let b = b0; b < Math.min(b1, buckets); b++) {
        if (peaks[b * 2] < min) min = peaks[b * 2];
        if (peaks[b * 2 + 1] > max) max = peaks[b * 2 + 1];
      }
      const y0 = mid - max * mid * 0.95;
      const y1 = mid - min * mid * 0.95;
      ctx.fillRect(x, y0, 1, Math.max(1, y1 - y0));
    }
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  return {
    uid, clamp, midiToFreq, noteName, isBlack, dbToGain, gainToDb, el, formatClock, formatBBT,
    encodeWav, bufferToData, dataToBuffer, f32ToBase64, base64ToF32, download, safeFileName, pickFile,
    getPeaks, drawWaveform, debounce, NOTE_NAMES,
  };
})();
