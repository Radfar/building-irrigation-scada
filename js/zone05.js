/* ================================================================
   ZONE 05 — BACnet/IP HMI
   Browser -> REST API -> BACnet client -> independent BACnet device
================================================================ */

(() => {
    const API = 'http://localhost:3000';
    let zone5 = null;
    let pending = false;

    const $ = id => document.getElementById(id);
    const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
    const display = (value, digits = 1, unit = '') => {
        const n = number(value);
        return n === null ? '--' : n.toFixed(digits) + unit;
    };

    function setStatus(text, kind) {
        const el = $('z5-status');
        if (!el) return;
        el.textContent = text;
        el.className = 'status ' + kind;
    }

    function renderUnavailable() {
        zone5 = null;
        setStatus('NO DATA', 'no-data');
        ['z5-moisture', 'z5-flow', 'z5-valve', 'z5-tank', 'z5-pump', 'z5-mode']
            .forEach(id => { if ($(id)) $(id).textContent = '--'; });
        if ($('z5-bar')) $('z5-bar').style.width = '0%';
        ['z5-btn-start', 'z5-btn-stop', 'z5-btn-mode'].forEach(id => {
            if ($(id)) $(id).disabled = true;
        });
        if ($('z5-btn-reset')) $('z5-btn-reset').style.display = 'none';
    }

    function render(observations) {
        const values = Object.fromEntries(observations.map(item => [item.tagName, item.value]));
        const bad = observations.some(item => item.quality !== 'GOOD');
        if (bad) {
            renderUnavailable();
            return;
        }

        zone5 = values;
        const running = Number(values.Z05_RUNNING) === 1;
        const fault = Number(values.Z05_FAULT) === 1;
        const auto = Number(values.Z05_AUTO) === 1;
        const moisture = number(values.Z05_MOISTURE);

        $('z5-moisture').textContent = display(values.Z05_MOISTURE, 1, '%');
        $('z5-flow').textContent = display(values.Z05_FLOW, 2, ' gpm');
        $('z5-valve').textContent = display(values.Z05_VALVE, 0, '%');
        $('z5-tank').textContent = display(values.Z05_TANK_LEVEL, 1, '%');
        $('z5-pump').textContent = fault ? 'FAULT' : running ? 'RUNNING' : 'STOPPED';
        $('z5-mode').textContent = auto ? 'AUTO' : 'MANUAL';
        $('z5-bar').style.width = Math.max(0, Math.min(100, moisture || 0)) + '%';

        if (fault) setStatus('FAULT', 'alarm');
        else if (running) setStatus('RUNNING', 'ok');
        else setStatus('STANDBY', 'ok');

        $('z5-btn-start').disabled = pending || auto || running || fault;
        $('z5-btn-stop').disabled = pending || !running;
        $('z5-btn-mode').disabled = pending;
        $('z5-btn-mode').textContent = auto ? 'AUTO' : 'MANUAL';
        $('z5-btn-reset').style.display = fault ? '' : 'none';
    }

    async function refresh() {
        try {
            const response = await fetch(API + '/api/zone05');
            if (!response.ok) throw new Error('HTTP ' + response.status);
            render(await response.json());
        } catch (error) {
            renderUnavailable();
            console.warn('[zone05] refresh failed:', error.message);
        }
    }

    async function send(command) {
        if (pending) return;
        pending = true;
        ['z5-btn-start', 'z5-btn-stop', 'z5-btn-mode', 'z5-btn-reset'].forEach(id => {
            if ($(id)) $(id).disabled = true;
        });
        try {
            const response = await fetch(API + '/api/zone05/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });
            const result = await response.json();
            if (!response.ok || !result.ok) {
                throw new Error(result.error || 'Command rejected');
            }
            if (typeof showOperatorMessage === 'function') {
                showOperatorMessage('Zone 05: ' + command.toUpperCase() + ' write accepted by BACnet device', 'success');
            }
        } catch (error) {
            if (typeof showOperatorMessage === 'function') {
                showOperatorMessage('Zone 05 command failed: ' + error.message, 'error');
            }
        } finally {
            pending = false;
            await refresh();
        }
    }

    window.zone5Command = send;
    window.zone5ToggleMode = () => {
        if (!zone5) return;
        send(Number(zone5.Z05_AUTO) === 1 ? 'manual' : 'auto');
    };

    document.addEventListener('DOMContentLoaded', refresh);
    setInterval(refresh, 1000);
})();
