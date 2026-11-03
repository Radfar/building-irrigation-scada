/* ================================================================
   ZONE 01 — Modbus TCP HMI client
   Browser -> REST API -> Node.js Modbus TCP driver -> Python simulator
================================================================ */
(() => {
  "use strict";
  const API = "http://localhost:3000";
  const $ = id => document.getElementById(id);
  let snapshot = null;
  let pending = false;

  const fmt = (value, digits = 1, unit = "") =>
    Number.isFinite(Number(value)) ? Number(value).toFixed(digits) + unit : "--";

  function renderUnavailable() {
    snapshot = null;
    const status = $("z1-status");
    if (status) { status.textContent = "NO DATA"; status.className = "status alarm"; }
    ["z1-tank", "z1-flow", "z1-valve", "z1-frequency", "z1-pump", "z1-mode"]
      .forEach(id => { if ($(id)) $(id).textContent = "--"; });
    ["z1-btn-start", "z1-btn-stop", "z1-btn-mode", "z1-btn-reset", "z1-btn-reenable"]
      .forEach(id => { if ($(id)) $(id).disabled = true; });
    if ($("z1-bar")) $("z1-bar").style.width = "0%";
  }

  function render(data) {
    if (!data || data.quality !== "GOOD") { renderUnavailable(); return; }
    snapshot = data;
    const v = data.values;
    const running = Boolean(v.running);
    const fault = Boolean(v.fault);
    const auto = Boolean(v.auto);
    const status = $("z1-status");
    if (status) {
      status.textContent = fault ? "FAULT" : running ? "RUNNING" : "STANDBY";
      status.className = "status " + (fault ? "alarm" : running ? "ok" : "warn");
    }
    $("z1-tank").textContent = fmt(v.tankLevel, 1, "%");
    $("z1-flow").textContent = fmt(v.flow, 1, " L/min");
    $("z1-valve").textContent = fmt(v.valvePosition, 0, "%");
    $("z1-frequency").textContent = fmt(v.pumpFrequency, 1, " Hz");
    $("z1-pump").textContent = fault ? "FAULT" : running ? "RUNNING" : "STOPPED";
    $("z1-mode").textContent = auto ? "AUTO" : "MANUAL";
    $("z1-bar").style.width = Math.max(0, Math.min(100, Number(v.tankLevel) || 0)) + "%";
    $("z1-btn-start").disabled = pending || auto || running || fault || !v.permissive;
    $("z1-btn-stop").disabled = pending || !running;
    $("z1-btn-mode").disabled = pending;
    $("z1-btn-mode").textContent = auto ? "AUTO" : "MANUAL";
    $("z1-btn-reset").disabled = pending || !fault;
  }

  async function refresh() {
    try {
      const response = await fetch(API + "/api/zone01");
      if (!response.ok) throw new Error("HTTP " + response.status);
      render(await response.json());
    } catch (error) {
      renderUnavailable();
      console.warn("[zone01] refresh failed:", error.message);
    }
  }

  async function command(name) {
    if (pending) return;
    pending = true;
    ["z1-btn-start", "z1-btn-stop", "z1-btn-mode", "z1-btn-reset"]
      .forEach(id => { if ($(id)) $(id).disabled = true; });
    try {
      const response = await fetch(API + "/api/zone01/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: name })
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Command rejected");
      if (typeof showOperatorMessage === "function") {
        showOperatorMessage("Zone 01: " + name.toUpperCase() + " request accepted by Modbus driver", "success");
      }
    } catch (error) {
      if (typeof showOperatorMessage === "function") {
        showOperatorMessage("Zone 01 command failed: " + error.message, "error");
      }
    } finally {
      pending = false;
      await refresh();
    }
  }

  window.zone1Command = command;
  window.zone1ToggleMode = () => {
    if (snapshot) command(snapshot.values.auto ? "manual" : "auto");
  };

  document.addEventListener("DOMContentLoaded", refresh);
  window.setInterval(refresh, 1000);
})();