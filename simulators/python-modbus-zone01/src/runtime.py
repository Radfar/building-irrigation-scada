"""Zone 01 runtime: connect control logic, process model, and Modbus memory."""

import asyncio
import math

from .command_processor import CommandProcessor, ControlCommands, ControlSetpoints
from .process_model import WaterProcessModel
from .register_map import (
    CoilAddress,
    DiscreteInputAddress,
    HoldingRegisterAddress,
    InputRegisterAddress,
    decode_scaled,
    encode_scaled,
)


class _BitRegisterView:
    """List-like view over PyModbus' packed 16-bit coil/discrete-input memory."""

    def __init__(self, block) -> None:
        start_address, register_count, registers, _flags = block
        self._start_bit = start_address * 16
        self._register_count = register_count
        self._registers = registers

    def __len__(self) -> int:
        return self._register_count * 16 - self._start_bit

    def __getitem__(self, address: int) -> bool:
        bit_address = address - self._start_bit
        if not 0 <= bit_address < self._register_count * 16:
            raise IndexError(address)
        register_index, bit_offset = divmod(bit_address, 16)
        return bool(self._registers[register_index] & (1 << bit_offset))

    def __setitem__(self, address: int, value: bool) -> None:
        if not isinstance(value, bool):
            raise TypeError("bit value must be bool")
        bit_address = address - self._start_bit
        if not 0 <= bit_address < self._register_count * 16:
            raise IndexError(address)
        register_index, bit_offset = divmod(bit_address, 16)
        mask = 1 << bit_offset
        if value:
            self._registers[register_index] |= mask
        else:
            self._registers[register_index] &= ~mask


class _RegisterView:
    """List-like view over a PyModbus register block."""

    def __init__(self, block) -> None:
        start_address, _count, registers, _flags = block
        self._start_address = start_address
        self._registers = registers

    def __len__(self) -> int:
        return len(self._registers)

    def __getitem__(self, address: int) -> int:
        return self._registers[address - self._start_address]

    def __setitem__(self, address: int, value: int) -> None:
        self._registers[address - self._start_address] = value


class Zone01Runtime:
    """Execute one control/process scan and publish it to Modbus data areas.

    When attached to a live PyModbus server, the runtime uses views over the
    server's active simulator memory. PyModbus builds that memory from SimData
    during server initialization, so mutating SimData.values afterwards would
    not update the live Modbus data model. The process model and command
    processor remain independent of PyModbus.
    """

    def __init__(
        self,
        device,
        *,
        datastore=None,
        scan_period_seconds: float = 0.5,
        command_processor: CommandProcessor | None = None,
        process_model: WaterProcessModel | None = None,
    ) -> None:
        if (
            isinstance(scan_period_seconds, bool)
            or not isinstance(scan_period_seconds, (int, float))
            or not math.isfinite(scan_period_seconds)
            or scan_period_seconds <= 0
        ):
            raise ValueError("scan_period_seconds must be finite and greater than zero")

        self.scan_period_seconds = float(scan_period_seconds)
        self.command_processor = command_processor or CommandProcessor()
        self.process_model = process_model or WaterProcessModel()

        if datastore is None:
            coils, discrete_inputs, holding_registers, input_registers = device.simdata
            self.coils = coils[0].values
            self.discrete_inputs = discrete_inputs[0].values
            self.holding_registers = holding_registers[0].values
            self.input_registers = input_registers[0].values
        else:
            self.coils = _BitRegisterView(datastore.block["c"])
            self.discrete_inputs = _BitRegisterView(datastore.block["d"])
            self.holding_registers = _RegisterView(datastore.block["h"])
            self.input_registers = _RegisterView(datastore.block["i"])

        self.state = None
        self.measurements = self.process_model.measurements

    @staticmethod
    def _engineering_value(registers, address) -> float:
        return decode_scaled(registers[address])

    def _read_setpoints(self):
        """Read and validate operator setpoints; invalid values fail safe."""
        frequency = self._engineering_value(
            self.holding_registers, HoldingRegisterAddress.Z01_PUMP_SPEED_SP
        )
        valve = self._engineering_value(
            self.holding_registers, HoldingRegisterAddress.Z01_VALVE_POSITION_SP
        )
        flow_low = self._engineering_value(
            self.holding_registers, HoldingRegisterAddress.Z01_FLOW_LOW_SP
        )
        tank_low = self._engineering_value(
            self.holding_registers, HoldingRegisterAddress.Z01_TANK_LEVEL_LOW_SP
        )
        tank_high = self._engineering_value(
            self.holding_registers, HoldingRegisterAddress.Z01_TANK_LEVEL_HIGH_SP
        )

        valid = (
            0.0 <= frequency <= 50.0
            and 0.0 <= valve <= 100.0
            and 0.0 <= flow_low <= 100.0
            and 0.0 <= tank_low < tank_high <= 100.0
        )
        if not valid:
            # Keep the controller inputs valid while removing the effective
            # permissive. The process output is forced to zero in scan().
            return False, 0.0, 0.0, ControlSetpoints()

        return True, frequency, valve, ControlSetpoints(
            tank_level_low_percent=tank_low,
            tank_level_high_percent=tank_high,
            flow_low_lpm=flow_low,
        )

    def scan(self, elapsed_seconds: float | None = None):
        """Run one deterministic control and process scan."""
        elapsed = (
            self.scan_period_seconds
            if elapsed_seconds is None
            else float(elapsed_seconds)
        )
        if not 0.0 < elapsed <= 60.0:
            raise ValueError("elapsed_seconds must be greater than zero and <= 60")

        setpoints_valid, frequency_sp, valve_sp, setpoints = self._read_setpoints()

        commands = ControlCommands(
            auto_selected=bool(self.coils[CoilAddress.Z01_AUTO]),
            start_request=bool(self.coils[CoilAddress.Z01_START]),
            # In Manual, invalid setpoints clear the latched manual request,
            # requiring a fresh START after correction. Auto retains its
            # level-based demand and remains governed by its hysteresis logic.
            stop_request=bool(self.coils[CoilAddress.Z01_STOP]),
            fault_reset_request=bool(self.coils[CoilAddress.Z01_FAULT_RESET]),
            reenable_request=bool(self.coils[CoilAddress.Z01_REENABLE]),
            clear_manual_request=(not setpoints_valid and not bool(self.coils[CoilAddress.Z01_AUTO])),
        )

        # Momentary requests are consumed once sampled. AUTO remains maintained.
        self.coils[CoilAddress.Z01_START] = False
        self.coils[CoilAddress.Z01_STOP] = False
        self.coils[CoilAddress.Z01_FAULT_RESET] = False
        self.coils[CoilAddress.Z01_REENABLE] = False
        external_permissive = bool(
            self.discrete_inputs[DiscreteInputAddress.Z01_PERMISSIVE]
        )
        effective_permissive = external_permissive and setpoints_valid

        state = self.command_processor.update(
            commands,
            setpoints,
            permissive=effective_permissive,
            tank_level_percent=self.measurements.tank_level_percent,
            flow_lpm=self.measurements.flow_lpm,
            pump_fault_condition=False,
            elapsed_seconds=elapsed,
        )

        self.measurements = self.process_model.step(
            pump_running=state.running and setpoints_valid,
            pump_frequency_setpoint_hz=frequency_sp if setpoints_valid else 0.0,
            valve_position_setpoint_percent=valve_sp if setpoints_valid else 0.0,
            elapsed_seconds=elapsed,
        )
        self.state = state
        self._publish_status(state)
        self._publish_measurements()
        return state

    def _publish_status(self, state) -> None:
        di = self.discrete_inputs
        m = self.measurements
        di[DiscreteInputAddress.Z01_RUN_FEEDBACK] = m.pump_frequency_hz > 0.0
        di[DiscreteInputAddress.Z01_RUNNING] = state.running
        di[DiscreteInputAddress.Z01_FAULT] = state.fault
        # PERMISSIVE is an external input/status point. Do not overwrite it
        # with setpoint-validation state; doing so could latch it false.
        di[DiscreteInputAddress.Z01_MANUAL] = state.manual
        di[DiscreteInputAddress.Z01_AUTO_ACTIVE] = state.auto_active
        di[DiscreteInputAddress.Z01_FLOW_OK] = state.flow_ok
        di[DiscreteInputAddress.Z01_LOW_FLOW] = state.low_flow
        di[DiscreteInputAddress.Z01_PROCESS_OK] = state.process_ok
        di[DiscreteInputAddress.Z01_PUMP_FAULT] = state.pump_fault
        di[DiscreteInputAddress.Z01_TANK_LOW] = state.tank_low
        di[DiscreteInputAddress.Z01_TANK_HIGH] = state.tank_high
        di[DiscreteInputAddress.Z01_OPERATOR_STOP_LATCHED] = state.operator_stop_latched
        di[DiscreteInputAddress.Z01_VALVE_OPEN_FB] = (
            m.valve_position_percent > 0.0
        )

    def _publish_measurements(self) -> None:
        m = self.measurements
        ir = self.input_registers
        ir[InputRegisterAddress.Z01_TANK_LEVEL] = encode_scaled(
            m.tank_level_percent
        )
        ir[InputRegisterAddress.Z01_FLOW] = encode_scaled(m.flow_lpm)
        ir[InputRegisterAddress.Z01_PUMP_FREQUENCY] = encode_scaled(
            m.pump_frequency_hz
        )
        ir[InputRegisterAddress.Z01_PUMP_SPEED] = encode_scaled(
            m.pump_speed_percent
        )
        ir[InputRegisterAddress.Z01_VALVE] = encode_scaled(
            m.valve_position_percent
        )
        ir[InputRegisterAddress.Z01_PUMP_CURRENT] = encode_scaled(
            m.pump_current_a
        )

    async def run(self) -> None:
        """Run scans against a monotonic clock at the configured scan period."""
        loop = asyncio.get_running_loop()
        previous = loop.time()
        deadline = previous
        while True:
            now = loop.time()
            elapsed = max(0.001, now - previous)
            previous = now
            self.scan(elapsed)
            deadline += self.scan_period_seconds
            await asyncio.sleep(max(0.0, deadline - loop.time()))
