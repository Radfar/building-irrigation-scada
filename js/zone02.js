  const API = 'http://localhost:3000';   // or reuse whatever base URL tags.js uses

(() => {
  const $ = id => document.getElementById(id);
  let z2 = {};   // latest values by tag name
  let u2 = {};   // units by tag, next to: let z2 = {};
  const fmt = (tag, d) => {
  const v = Number(z2[tag]); if (isNaN(v)) return '--';
  const u = u2[tag] || '';
  return v.toFixed(d) + (u === '%' ? '%' : u ? ' ' + u : '');
};
  function setStatus(text, cls) {
    const el = $('z2-status');
    el.textContent = text;
    el.className = 'status ' + cls;
  }

  function render(degraded) {
    const m = Number(z2.Z02_MOISTURE);
    fmt('Z02_MOISTURE', 1).textContent = isNaN(m) ? '--' : m.toFixed(1) + '%';
    fmt('Z02_FLOW', 1).textContent     = (Number(z2.Z02_FLOW) || 0).toFixed(1) + ' gpm';
    fmt('Z02_VALVE', 0).textContent    = (Number(z2.Z02_VALVE) || 0).toFixed(0) + '%';
    $('z2-bar').style.width      = Math.max(0, Math.min(100, m || 0)) + '%';

    if (degraded)             setStatus('NO DATA', 'warn');
    else if (z2.Z02_FAULT)    setStatus('FAULT', 'alarm');
    else if (z2.Z02_RUNNING)  setStatus('RUNNING', 'ok');
    else                      setStatus('STANDBY', 'ok');

    $('z2-btn-mode').textContent = z2.Z02_AUTO ? 'AUTO' : 'MANUAL';
    $('z2-btn-start').disabled   = degraded || z2.Z02_AUTO || !z2.Z02_PERMISSIVE;  // Start only works in Manual
    $('z2-btn-stop').disabled    = degraded;
    $('z2-btn-mode').disabled    = degraded;
    $('z2-btn-reset').style.display = z2.Z02_FAULT ? '' : 'none';
  }

  async function refresh() {
    try {
      const res = await fetch(API + '/api/zone02');
      if (!res.ok) throw new Error(res.status);
      const obs = await res.json();
      z2 = Object.fromEntries(obs.map(o => [o.tagName, o.value]));
      u2 = Object.fromEntries(obs.map(o => [o.tagName, o.engineeringUnit ?? '']));
      render(obs.some(o => o.quality !== 'GOOD'));
    } catch {
      setStatus('NO DATA', 'warn');
    }
  }

  async function send(tag, value) {
    const res = await fetch(API + '/api/zone02/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, value })
    });
    const j = await res.json();
    if (!j.ok) alert(`Zone 02: ${j.error}`);
    refresh();
  }

  window.zone2Command    = tag => send(tag, true);
  window.zone2ToggleMode = () => send('Z02_AUTO', !z2.Z02_AUTO);

  refresh();
  setInterval(refresh, 1000);
})();