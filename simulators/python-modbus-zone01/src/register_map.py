"""Modbus address definitions for the Zone 01 water-process simulator.

All addresses are zero-based Modbus PDU offsets. See docs/modbus-register-map.md
for conventional reference numbers, units, scaling, and signal semantics.
"""

from enum import IntEnum
import math


MODBUS_TCP_PORT = 1502
MODBUS_UNIT_ID = 1
UINT16_MAX = 65_535
DEFAULT_REGISTER_SCALE = 10


class CoilAddress(IntEnum):
    """Read/write command and mode coils (0xxxx)."""

    Z01_AUTO = 0
    Z01_START = 1
    Z01_STOP = 2
    Z01_FAULT_RESET = 3
    Z01_REENABLE = 4


class DiscreteInputAddress(IntEnum):
    """Read-only status and feedback bits (1xxxx)."""

    Z01_RUN_FEEDBACK = 0
    Z01_RUNNING = 1
    Z01_FAULT = 2
    Z01_PERMISSIVE = 3
    Z01_MANUAL = 4
    Z01_AUTO_ACTIVE = 5
    Z01_FLOW_OK = 6
    Z01_LOW_FLOW = 7
    Z01_PROCESS_OK = 8
    Z01_PUMP_FAULT = 9
    Z01_TANK_LOW = 10
    Z01_TANK_HIGH = 11
    Z01_VALVE_OPEN_FB = 12
    Z01_OPERATOR_STOP_LATCHED = 13


class HoldingRegisterAddress(IntEnum):
    """Read/write setpoints (4xxxx). Values use unsigned 16-bit encoding."""

    Z01_PUMP_SPEED_SP = 0
    Z01_VALVE_POSITION_SP = 1
    Z01_FLOW_LOW_SP = 2
    Z01_TANK_LEVEL_LOW_SP = 3
    Z01_TANK_LEVEL_HIGH_SP = 4


class InputRegisterAddress(IntEnum):
    """Read-only process measurements (3xxxx). Values use unsigned 16-bit encoding."""

    Z01_TANK_LEVEL = 0
    Z01_FLOW = 1
    Z01_PUMP_FREQUENCY = 2
    Z01_PUMP_SPEED = 3
    Z01_VALVE = 4
    Z01_PUMP_CURRENT = 5


def encode_scaled(value: float, scale: int = DEFAULT_REGISTER_SCALE) -> int:
    """Convert a non-negative engineering value to an unsigned 16-bit register.

    For example, 56.7 percent with scale 10 is encoded as integer 567.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise TypeError("value must be an int or float, not bool")
    if not math.isfinite(value):
        raise ValueError("value must be finite")
    if isinstance(scale, bool) or not isinstance(scale, int) or scale <= 0:
        raise ValueError("scale must be a positive integer")

    raw_value = round(value * scale)
    if raw_value < 0 or raw_value > UINT16_MAX:
        raise ValueError(f"scaled value must be between 0 and {UINT16_MAX}")
    return raw_value


def decode_scaled(raw_value: int, scale: int = DEFAULT_REGISTER_SCALE) -> float:
    """Convert an unsigned 16-bit register value to an engineering value."""
    if isinstance(raw_value, bool) or not isinstance(raw_value, int):
        raise TypeError("raw_value must be an integer, not bool")
    if raw_value < 0 or raw_value > UINT16_MAX:
        raise ValueError(f"raw_value must be between 0 and {UINT16_MAX}")
    if isinstance(scale, bool) or not isinstance(scale, int) or scale <= 0:
        raise ValueError("scale must be a positive integer")

    return raw_value / scale
