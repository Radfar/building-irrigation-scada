(*
===============================================================================
SOURCE REFERENCE CAPTURE — NOT YET POPULATED
===============================================================================
Zone:                 Zone 03 — Irrigation
Platform:             CODESYS
Native project:       IrrigationPLC.project
POU / function block: FB_IrrigationZone
Source capture date:  NOT RECORDED
CODESYS version:      NOT RECORDED
Capture method:       TO BE RECORDED (direct export / copied from IDE)
Source revision:      NOT RECORDED
Review status:        UNVERIFIED

INSTRUCTIONS:
Replace this entire placeholder with the complete current FB_IrrigationZone
source from the native CODESYS project. Include both the declaration and
implementation. Preserve the source exactly; do not correct or refactor it
during capture.

This file is a review snapshot. The native CODESYS project remains the
working implementation unless the project explicitly changes its source-of-
truth policy.

===============================================================================
PASTE THE COMPLETE CURRENT FUNCTION BLOCK BELOW THIS HEADER
===============================================================================
// =============================================================
// 1. COMMAND EDGE DETECTION
// =============================================================
rtStart(CLK := xCmdStart);
rtStop(CLK := xCmdStop);
rtFaultReset(CLK := xCmdFaultReset);


// =============================================================
// 2. STATUS MIRRORS
// =============================================================
xSimActive := xSimEnable;
xCommOK    := NOT xSimCommFault;


// =============================================================
// 3. FAULT GENERATION / RESET
// =============================================================
IF xSimActuatorFault OR xSimSensorFault THEN
    xFaultLatch := TRUE;
END_IF;

IF rtFaultReset.Q THEN
    IF NOT xSimActuatorFault AND NOT xSimSensorFault THEN
        xFaultLatch := FALSE;
    END_IF;
END_IF;


// =============================================================
// 4. PERMISSIVE
//    NOTE: requires xSimEnable = TRUE. If nothing is running and
//    everything else looks correctly wired, check this input first.
// =============================================================
xPermissive :=
    NOT xFaultLatch
    AND NOT xSimActuatorFault
    AND NOT xSimSensorFault
    AND xCommOK
    AND xSimEnable;


// =============================================================
// 5. AUTO DEMAND (hysteresis on moisture, does not touch xRunning directly)
// =============================================================
IF rMoisture <= rMoistureLowSP THEN
    xAutoDemand := TRUE;
ELSIF rMoisture >= rMoistureHighSP THEN
    xAutoDemand := FALSE;
END_IF;
// else: holds previous state — this is the intended dead-band behavior


// =============================================================
// 6. RUNNING DECISION
//    Fix: Stop always wins, even in Auto mode, for the scan it's pressed.
// =============================================================
xAutoActive := FALSE;

IF xAuto AND xPermissive THEN
    xAutoActive := TRUE;
    xRunning    := xAutoDemand;
ELSIF xPermissive THEN
    IF rtStart.Q THEN
        xRunning := TRUE;
    END_IF;
END_IF;

// Manual/safety Stop — always evaluated last, always wins this scan,
// regardless of Auto/Manual mode.
IF rtStop.Q THEN
    xRunning    := FALSE;
    xAutoDemand := FALSE;
END_IF;


// =============================================================
// 7. FAULT / COMMUNICATION / ENABLE SAFETY
// =============================================================
IF xFaultLatch THEN
    xRunning := FALSE;
END_IF;

IF NOT xCommOK THEN
    xRunning := FALSE;
END_IF;

IF NOT xSimEnable THEN
    xRunning := FALSE;
END_IF;


// =============================================================
// 8. PROCESS COMMAND
// =============================================================
xCommanded := xRunning AND xPermissive;


// =============================================================
// 9. 100 ms SIMULATION TICK
// =============================================================
fbTick(IN := TRUE, PT := T#100MS);

IF fbTick.Q THEN
    fbTick(IN := FALSE);   // retrigger for next 100 ms interval

    // ---- Valve ----
    IF xCommanded THEN
        rValvePosition := 100.0;
    ELSE
        rValvePosition := 0.0;
    END_IF;

    // ---- Flow target ----
    IF xCommanded THEN
        rFlowTarget := rSimFlowTarget;
        IF xSimRestriction THEN
            rFlowTarget := rFlowTarget * 0.25;
        END_IF;
    ELSE
        rFlowTarget := 0.0;
    END_IF;

    // ---- Flow ramp ----
    rFlowError := rFlowTarget - rFlow;
    rFlowStep  := ABS(rSimFlowRate) * 0.1;
    IF rFlowStep < 0.1 THEN
        rFlowStep := 0.1;
    END_IF;

    IF rFlowError > rFlowStep THEN
        rFlow := rFlow + rFlowStep;
    ELSIF rFlowError < -rFlowStep THEN
        rFlow := rFlow - rFlowStep;
    ELSE
        rFlow := rFlowTarget;
    END_IF;

    IF rFlow < 0.0 THEN
        rFlow := 0.0;
    END_IF;

    IF xSimSensorFault THEN
        rFlow := 0.0;   // sensor fault -> invalid/zero feedback
    END_IF;

    // ---- Moisture process ----
    IF xCommanded AND (rFlow > 0.0) THEN
        rMoistureStep := ABS(rSimMoistureRate) * 0.1;
        rMoisture     := rMoisture + rMoistureStep;
    ELSE
        rMoistureStep := ABS(rSimDryRate) * 0.1;
        rMoisture     := rMoisture - rMoistureStep;
    END_IF;

    IF rMoisture > 100.0 THEN rMoisture := 100.0; END_IF;
    IF rMoisture < 0.0   THEN rMoisture := 0.0;   END_IF;

    // ---- Flow quality ----
    xFlowOK := TRUE;
    IF xCommanded AND (rFlow < rSimLowFlowLimit) THEN
        xFlowOK := FALSE;
    END_IF;

    xLowFlow    := xCommanded AND NOT xFlowOK;
    xProcessOK  := xPermissive AND xFlowOK;

    // ---- Runtime accumulation ----
    IF xRunning THEN
        uiRuntimeTicks := uiRuntimeTicks + 1;
        IF uiRuntimeTicks >= 10 THEN   // 10 x 100ms = 1s
            udiTotalRuntimeSec := udiTotalRuntimeSec + 1;
            uiRuntimeTicks := 0;
        END_IF;
    END_IF;
END_IF;


// =============================================================
// 10. OUTPUT MAPPING
// =============================================================
xRunFeedback := xRunning;
xFault       := xFaultLatch;
xManual      := NOT xAuto;


// =============================================================
// 11. COMMAND CONSUMPTION
//     Momentary PLC-side commands are cleared by the CALLING program
//     (the GVL write-back happens where this FB is instantiated —
//     see the wiring example below), not inside the FB itself, so the
//     FB stays reusable and doesn't reach into a specific GVL.
// =============================================================
