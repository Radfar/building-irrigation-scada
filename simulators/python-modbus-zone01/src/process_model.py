"""Time-based physical process model for the Zone 01 water system.

This module is independent of Modbus and controller command handling.
It models pump output, valve position, flow, and tank-level dynamics.
"""

from dataclasses import dataclass
import math


@dataclass(frozen=True)
class ProcessModelConfig:
    """Engineering parameters for the simplified water-process model."""

    tank_capacity_litres: float = 10_000.0
    maximum_flow_lpm: float = 100.0
    maximum_pump_frequency_hz: float = 50.0
    rated_pump_current_a: float = 10.0


@dataclass(frozen=True)
class ProcessMeasurements:
    """Latest simulated process measurements in engineering units."""

    tank_level_percent: float
    flow_lpm: float
    pump_frequency_hz: float
    pump_speed_percent: float
    valve_position_percent: float
    pump_current_a: float


class WaterProcessModel:
    """Simulate a pump transferring water into a storage tank.

    The model assumes a constant nominal pump-flow relationship and an
    instantaneous valve actuator. It is intended for control-system
    development, not equipment selection or hydraulic design.
    """

    def __init__(
        self,
        initial_tank_level_percent: float = 75.0,
        config: ProcessModelConfig | None = None,
    ) -> None:
        self.config = config or ProcessModelConfig()
        self._validate_config(self.config)
        self._validate_range(
            "initial_tank_level_percent", initial_tank_level_percent, 0.0, 100.0
        )
        self._tank_level_percent = float(initial_tank_level_percent)
        self._measurements = ProcessMeasurements(
            tank_level_percent=self._tank_level_percent,
            flow_lpm=0.0,
            pump_frequency_hz=0.0,
            pump_speed_percent=0.0,
            valve_position_percent=0.0,
            pump_current_a=0.0,
        )

    @staticmethod
    def _validate_range(
        name: str, value: float, minimum: float, maximum: float
    ) -> None:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError(f"{name} must be an int or float, not bool")
        if not math.isfinite(value):
            raise ValueError(f"{name} must be finite")
        if not minimum <= value <= maximum:
            raise ValueError(f"{name} must be between {minimum} and {maximum}")

    @staticmethod
    def _validate_config(config: ProcessModelConfig) -> None:
        positive_values = {
            "tank_capacity_litres": config.tank_capacity_litres,
            "maximum_flow_lpm": config.maximum_flow_lpm,
            "maximum_pump_frequency_hz": config.maximum_pump_frequency_hz,
            "rated_pump_current_a": config.rated_pump_current_a,
        }
        for name, value in positive_values.items():
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise TypeError(f"{name} must be an int or float")
            if not math.isfinite(value) or value <= 0:
                raise ValueError(f"{name} must be finite and greater than zero")

    @property
    def measurements(self) -> ProcessMeasurements:
        """Return the latest immutable measurement snapshot."""
        return self._measurements

    def step(
        self,
        *,
        pump_running: bool,
        pump_frequency_setpoint_hz: float,
        valve_position_setpoint_percent: float,
        elapsed_seconds: float,
    ) -> ProcessMeasurements:
        """Advance the process simulation by one time step."""
        if not isinstance(pump_running, bool):
            raise TypeError("pump_running must be bool")

        self._validate_range(
            "pump_frequency_setpoint_hz",
            pump_frequency_setpoint_hz,
            0.0,
            self.config.maximum_pump_frequency_hz,
        )
        self._validate_range(
            "valve_position_setpoint_percent",
            valve_position_setpoint_percent,
            0.0,
            100.0,
        )
        self._validate_range("elapsed_seconds", elapsed_seconds, 0.0, 60.0)

        valve_position = float(valve_position_setpoint_percent)
        if pump_running:
            frequency = float(pump_frequency_setpoint_hz)
            speed_percent = (
                frequency / self.config.maximum_pump_frequency_hz
            ) * 100.0
            flow = (
                self.config.maximum_flow_lpm
                * frequency
                / self.config.maximum_pump_frequency_hz
                * valve_position
                / 100.0
            )
            current = (
                self.config.rated_pump_current_a
                * frequency
                / self.config.maximum_pump_frequency_hz
            )
        else:
            frequency = speed_percent = flow = current = 0.0

        added_litres = flow * elapsed_seconds / 60.0
        level_increase_percent = (
            added_litres / self.config.tank_capacity_litres
        ) * 100.0
        self._tank_level_percent = min(
            100.0, max(0.0, self._tank_level_percent + level_increase_percent)
        )

        self._measurements = ProcessMeasurements(
            tank_level_percent=self._tank_level_percent,
            flow_lpm=flow,
            pump_frequency_hz=frequency,
            pump_speed_percent=speed_percent,
            valve_position_percent=valve_position,
            pump_current_a=current,
        )
        return self._measurements
