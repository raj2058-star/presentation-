/* AppleLab — shared UI state and small widgets (modal, toast, context menu) */
window.AL = window.AL || {};

AL.ui = (() => {
  const { el } = AL.util;
  const view = {
    ppb: 40, // pixels per beat in the arrangement
    snap: 0.25,
    clipboard: null,
    musicalTyping: true,
    activeTab: 'editor',
  };

  function snapBeat(b, snap = view.snap) {
    if (!snap) return Math.max(0, b);
    return Math.max(0, Math.round(b / snap) * snap);
  }

  let toastTimer;
  function toast(msg, ms = 2200) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  function modal(title, body, actions = []) {
    const root = document.getElementById('modal-root');
    const bg = el('div', { class: 'modal-bg' });
    const close = () => { bg.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    const btns = actions.map((a) => el('button', {
      class: 'btn ' + (a.class || ''),
      text: a.label,
      onclick: async () => { const r = a.onClick ? await a.onClick() : undefined; if (r !== false) close(); },
    }));
    const m = el('div', { class: 'modal', role: 'dialog', 'aria-label': title }, [
      el('h2', { text: title }), body, btns.length ? el('div', { class: 'actions' }, btns) : null,
    ]);
    bg.appendChild(m);
    bg.addEventListener('pointerdown', (e) => { if (e.target === bg) close(); });
    root.appendChild(bg);
    return { close, el: m };
  }

  function confirmDialog(title, text, okLabel = 'OK') {
    return new Promise((resolve) => {
      let done = false;
      const m = modal(title, el('p', { text }), [
        { label: 'Cancel', onClick: () => { done = true; resolve(false); } },
        { label: okLabel, class: 'accent', onClick: () => { done = true; resolve(true); } },
      ]);
      const obs = new MutationObserver(() => { if (!m.el.isConnected) { obs.disconnect(); if (!done) resolve(false); } });
      obs.observe(document.getElementById('modal-root'), { childList: true });
    });
  }

  function prompt(title, value = '') {
    return new Promise((resolve) => {
      const input = el('input', { type: 'text', value });
      let done = false;
      const m = modal(title, input, [
        { label: 'Cancel', onClick: () => { done = true; resolve(null); } },
        { label: 'OK', class: 'accent', onClick: () => { done = true; resolve(input.value); } },
      ]);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { done = true; resolve(input.value); m.close(); } });
      setTimeout(() => { input.focus(); input.select(); }, 0);
      const obs = new MutationObserver(() => { if (!m.el.isConnected) { obs.disconnect(); if (!done) resolve(null); } });
      obs.observe(document.getElementById('modal-root'), { childList: true });
    });
  }

  function contextMenu(x, y, items) {
    const m = document.getElementById('ctxmenu');
    m.innerHTML = '';
    items.forEach((it) => {
      if (it === '-') { m.appendChild(el('hr')); return; }
      m.appendChild(el('button', { text: it.label, onclick: () => { hide(); it.onClick(); } }));
    });
    m.classList.remove('hidden');
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 6) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 6) + 'px';
    function hide() { m.classList.add('hidden'); document.removeEventListener('pointerdown', outside, true); }
    function outside(e) { if (!m.contains(e.target)) hide(); }
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  }

  function isTyping(e) {
    const t = e.target;
    if (!t || !t.tagName) return false;
    if (t.tagName === 'TEXTAREA' || t.isContentEditable) return true;
    if (t.tagName === 'INPUT') return !['range', 'checkbox', 'button', 'radio'].includes(t.type);
    if (t.tagName === 'SELECT') return true;
    return false;
  }

  const TYPE_ICON = { audio: '🎤', instrument: '🎹', drums: '🥁' };

  return { view, snapBeat, toast, modal, confirmDialog, prompt, contextMenu, isTyping, TYPE_ICON };
})();
