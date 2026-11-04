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

  function syncTankPageUnavailable() {
    ["wt-tank-level", "wt-flow", "wt-valve", "wt-frequency", "wt-pump", "wt-mode", "wt-permissive", "wt-fault", "wt-latch", "wt-quality"]
      .forEach(id => { if ($(id)) $(id).textContent = "--"; });
    const status = $("wt-status");
    const comm = $("wt-comm");
    if (status) { status.textContent = "NO DATA"; status.className = "status no-data"; }
    if (comm) { comm.textContent = "COMMUNICATION: NO DATA"; comm.className = "status no-data"; }
    if ($("wt-tank-bar")) $("wt-tank-bar").style.width = "0%";
    ["wt-btn-start", "wt-btn-stop", "wt-btn-mode", "wt-btn-reset", "wt-btn-reenable"]
      .forEach(id => { if ($(id)) $(id).disabled = true; });
  }

  function syncTankPage(data) {
    const v = data.values;
    const running = Boolean(v.running);
    const fault = Boolean(v.fault);
    const auto = Boolean(v.auto);
    const stopLatched = Boolean(v.operatorStopLatched);
    const level = Number(v.tankLevel);
    const status = $("wt-status");
    const comm = $("wt-comm");
    const stateText = fault ? "FAULT" : running ? "RUNNING" : "STANDBY";
    if (status) {
      status.textContent = stateText;
      status.className = "status " + (fault ? "alarm" : running ? "ok" : "warn");
    }
    if (comm) {
      comm.textContent = "COMMUNICATION: GOOD";
      comm.className = "status ok";
    }
    const values = {
      "wt-tank-level": fmt(level, 1),
      "wt-flow": fmt(v.flow, 1, " L/min"),
      "wt-valve": fmt(v.valvePosition, 0, "%"),
      "wt-frequency": fmt(v.pumpFrequency, 1, " Hz"),
      "wt-pump": fault ? "FAULT" : running ? "RUNNING" : "STOPPED",
      "wt-mode": auto ? "AUTO" : "MANUAL",
      "wt-permissive": v.permissive ? "SATISFIED" : "NOT SATISFIED",
      "wt-fault": fault ? "ACTIVE" : "CLEAR",
      "wt-latch": stopLatched ? "ACTIVE" : "CLEAR",
      "wt-quality": data.quality || "UNKNOWN"
    };
    Object.entries(values).forEach(([id, value]) => { if ($(id)) $(id).textContent = value; });
    if ($("wt-tank-bar")) $("wt-tank-bar").style.width = Math.max(0, Math.min(100, Number.isFinite(level) ? level : 0)) + "%";
    const enabled = {
      "wt-btn-start": !(pending || auto || running || fault || !v.permissive || stopLatched),
      "wt-btn-stop": !pending,
      "wt-btn-mode": !pending,
      "wt-btn-reset": !(pending || !fault),
      "wt-btn-reenable": !(pending || !stopLatched)
    };
    Object.entries(enabled).forEach(([id, value]) => { if ($(id)) $(id).disabled = !value; });
    if ($("wt-btn-mode")) $("wt-btn-mode").textContent = auto ? "AUTO" : "MANUAL";
  }

  function renderUnavailable() {
    snapshot = null;
    syncTankPageUnavailable();
    const status = $("z1-status");
    if (status) { status.textContent = "NO DATA"; status.className = "status no-data"; }
    ["z1-tank", "z1-flow", "z1-valve", "z1-frequency", "z1-pump", "z1-mode", "z1-latch"]
      .forEach(id => { if ($(id)) $(id).textContent = "--"; });
    ["z1-btn-start", "z1-btn-stop", "z1-btn-mode", "z1-btn-reset", "z1-btn-reenable"]
      .forEach(id => { if ($(id)) $(id).disabled = true; });
    if ($("z1-bar")) $("z1-bar").style.width = "0%";
  }

  function render(data) {
    if (!data || data.quality !== "GOOD") { renderUnavailable(); return; }
    snapshot = data;
    syncTankPage(data);
    const v = data.values;
    const running = Boolean(v.running);
    const fault = Boolean(v.fault);
    const auto = Boolean(v.auto);
    const stopLatched = Boolean(v.operatorStopLatched);
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
    $("z1-latch").textContent = stopLatched ? "ACTIVE" : "CLEAR";
    $("z1-bar").style.width = Math.max(0, Math.min(100, Number(v.tankLevel) || 0)) + "%";
    $("z1-btn-start").disabled = pending || auto || running || fault || !v.permissive || stopLatched;
    $("z1-btn-stop").disabled = pending;
    $("z1-btn-mode").disabled = pending;
    $("z1-btn-mode").textContent = auto ? "AUTO" : "MANUAL";
    $("z1-btn-reset").disabled = pending || !fault;
    $("z1-btn-reenable").disabled = pending || !stopLatched;
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
    ["z1-btn-start", "z1-btn-stop", "z1-btn-mode", "z1-btn-reset", "z1-btn-reenable"]
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