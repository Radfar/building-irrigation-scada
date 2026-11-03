"""Controller command and status logic for the Zone 01 water system.

This module is independent of Modbus and the physical process model. Call
CommandProcessor.update() once per simulation/control scan and provide the
current commands, process measurements, permissive, and setpoints.
"""

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class ControlCommands:
    """Commands sampled for the current scan.

    AUTO is a maintained mode selection. START, STOP, and FAULT_RESET are
    momentary requests; this processor detects their rising edges.
    """

    auto_selected: bool = False
    start_request: bool = False
    stop_request: bool = False
    fault_reset_request: bool = False
    reenable_request: bool = False
    clear_manual_request: bool = False


@dataclass(frozen=True)
class ControlSetpoints:
    """Controller thresholds in engineering units."""

    tank_level_low_percent: float = 20.0
    tank_level_high_percent: float = 90.0
    flow_low_lpm: float = 5.0


@dataclass(frozen=True)
class ControlState:
    """Controller status and diagnostic outputs after one update."""

    manual: bool
    auto_active: bool
    running: bool
    permissive: bool
    fault: bool
    pump_fault: bool
    low_flow: bool
    tank_low: bool
    tank_high: bool
    flow_ok: bool
    process_ok: bool
    operator_stop_latched: bool


class CommandProcessor:
    """Apply manual/automatic requests, permissives, and latched fault logic.

    Control philosophy:
    - Manual START latches a run request; STOP clears it.
    - In Auto, tank low starts and tank high stops the pump (hysteresis).
    - STOP has priority over START in the same scan.
    - Loss of permissive, high tank level, or any latched fault stops the pump.
    - Low flow while running for the configured delay latches a low-flow fault.
    - Fault reset is accepted only after the active fault conditions clear.
    """

    def __init__(self, low_flow_trip_delay_seconds: float = 3.0) -> None:
        self._validate_number(
            "low_flow_trip_delay_seconds",
            low_flow_trip_delay_seconds,
            minimum=0.0,
        )
        self.low_flow_trip_delay_seconds = float(low_flow_trip_delay_seconds)
        self._manual_run_request = False
        self._auto_run_request = False
        self._auto_start_inhibited = False
        self._low_flow_elapsed = 0.0
        self._low_flow_fault_latched = False
        self._pump_fault_latched = False
        self._previous_start = False
        self._previous_stop = False
        self._previous_reset = False
        self._previous_reenable = False
        self._operator_stop_latched = False

    @staticmethod
    def _validate_number(name: str, value: float, minimum: float = 0.0) -> None:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError(f"{name} must be an int or float, not bool")
        if not math.isfinite(value) or value < minimum:
            raise ValueError(f"{name} must be finite and >= {minimum}")

    @staticmethod
    def _validate_bool(name: str, value: bool) -> None:
        if not isinstance(value, bool):
            raise TypeError(f"{name} must be bool")

    @classmethod
    def _validate_inputs(
        cls,
        commands: ControlCommands,
        setpoints: ControlSetpoints,
        *,
        permissive: bool,
        tank_level_percent: float,
        flow_lpm: float,
        pump_fault_condition: bool,
        elapsed_seconds: float,
    ) -> None:
        if not isinstance(commands, ControlCommands):
            raise TypeError("commands must be ControlCommands")
        if not isinstance(setpoints, ControlSetpoints):
            raise TypeError("setpoints must be ControlSetpoints")

        for name in ("auto_selected", "start_request", "stop_request",
                     "fault_reset_request", "reenable_request", "clear_manual_request"):
            cls._validate_bool(f"commands.{name}", getattr(commands, name))
        cls._validate_bool("permissive", permissive)
        cls._validate_bool("pump_fault_condition", pump_fault_condition)

        cls._validate_number("tank_level_percent", tank_level_percent)
        if tank_level_percent > 100.0:
            raise ValueError("tank_level_percent must be <= 100")
        cls._validate_number("flow_lpm", flow_lpm)
        cls._validate_number("elapsed_seconds", elapsed_seconds)
        if elapsed_seconds > 60.0:
            raise ValueError("elapsed_seconds must be <= 60")

        cls._validate_number(
            "tank_level_low_percent", setpoints.tank_level_low_percent
        )
        cls._validate_number(
            "tank_level_high_percent", setpoints.tank_level_high_percent
        )
        cls._validate_number("flow_low_lpm", setpoints.flow_low_lpm)
        if setpoints.tank_level_low_percent >= setpoints.tank_level_high_percent:
            raise ValueError("tank low setpoint must be below tank high setpoint")

    def update(
        self,
        commands: ControlCommands,
        setpoints: ControlSetpoints,
        *,
        permissive: bool,
        tank_level_percent: float,
        flow_lpm: float,
        pump_fault_condition: bool = False,
        elapsed_seconds: float = 0.5,
    ) -> ControlState:
        """Evaluate one control scan and return the resulting controller state."""
        self._validate_inputs(
            commands,
            setpoints,
            permissive=permissive,
            tank_level_percent=tank_level_percent,
            flow_lpm=flow_lpm,
            pump_fault_condition=pump_fault_condition,
            elapsed_seconds=elapsed_seconds,
        )

        start_edge = commands.start_request and not self._previous_start
        stop_edge = commands.stop_request and not self._previous_stop
        reset_edge = commands.fault_reset_request and not self._previous_reset
        reenable_edge = commands.reenable_request and not self._previous_reenable
        auto_selected = commands.auto_selected

        self._previous_start = commands.start_request
        self._previous_stop = commands.stop_request
        self._previous_reset = commands.fault_reset_request
        self._previous_reenable = commands.reenable_request

        tank_low = tank_level_percent <= setpoints.tank_level_low_percent
        tank_high = tank_level_percent >= setpoints.tank_level_high_percent

        # Track external pump fault as a latched diagnostic.
        if pump_fault_condition:
            self._pump_fault_latched = True

        # Mode change clears the demand belonging to the mode being left.
        if auto_selected:
            self._manual_run_request = False
            if not tank_low:
                self._auto_start_inhibited = False
            if tank_low and not self._auto_start_inhibited:
                self._auto_run_request = True
            elif tank_high:
                self._auto_run_request = False
        else:
            self._auto_run_request = False
            if commands.clear_manual_request:
                self._manual_run_request = False
            elif start_edge and not self._operator_stop_latched:
                self._manual_run_request = True

        if reenable_edge:
            self._operator_stop_latched = False
            self._manual_run_request = False
            self._auto_run_request = False
            if auto_selected and tank_low:
                self._auto_start_inhibited = True

        # STOP has priority over START and RE-ENABLE in the same scan.
        if stop_edge:
            self._operator_stop_latched = True
            self._manual_run_request = False
            self._auto_run_request = False
            if auto_selected and tank_low:
                self._auto_start_inhibited = True

        active_fault_condition = pump_fault_condition
        if reset_edge and not active_fault_condition:
            self._low_flow_fault_latched = False
            self._pump_fault_latched = False
            # Reset must not cause an immediate automatic/manual restart.
            self._manual_run_request = False
            self._auto_run_request = False

        fault = self._low_flow_fault_latched or self._pump_fault_latched
        if fault or self._operator_stop_latched:
            self._manual_run_request = False
            self._auto_run_request = False
        demand = self._auto_run_request if auto_selected else self._manual_run_request
        running = bool(demand and permissive and not tank_high and not fault)

        # Low-flow protection is evaluated only while the pump is commanded
        # to run. A stopped pump clears the timer but not an already latched trip.
        if running and flow_lpm < setpoints.flow_low_lpm:
            self._low_flow_elapsed += float(elapsed_seconds)
            if self._low_flow_elapsed >= self.low_flow_trip_delay_seconds:
                self._low_flow_fault_latched = True
                running = False
        else:
            self._low_flow_elapsed = 0.0

        fault = self._low_flow_fault_latched or self._pump_fault_latched
        auto_active = auto_selected and permissive and not fault and not self._operator_stop_latched
        flow_ok = running and flow_lpm >= setpoints.flow_low_lpm
        process_ok = permissive and not fault and not tank_high

        return ControlState(
            manual=not auto_selected,
            auto_active=auto_active,
            running=running,
            permissive=permissive,
            fault=fault,
            pump_fault=self._pump_fault_latched,
            low_flow=self._low_flow_fault_latched,
            tank_low=tank_low,
            tank_high=tank_high,
            flow_ok=flow_ok,
            process_ok=process_ok,
            operator_stop_latched=self._operator_stop_latched,
        )
