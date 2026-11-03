"""Integration tests for the Zone 01 control/process runtime."""

import unittest

from pymodbus.simulator.simcore import SimCore

from src.modbus_server import build_device
from src.process_model import WaterProcessModel
from src.register_map import (
    CoilAddress,
    DiscreteInputAddress,
    HoldingRegisterAddress,
    InputRegisterAddress,
)
from src.runtime import Zone01Runtime


class Zone01RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.device = build_device()
        self.runtime = Zone01Runtime(self.device)

    def test_first_scan_publishes_initial_process_state(self):
        state = self.runtime.scan()
        coils, di, hr, ir = self.device.simdata
        self.assertFalse(state.running)
        self.assertTrue(state.permissive)
        self.assertTrue(di[0].values[DiscreteInputAddress.Z01_MANUAL])
        self.assertFalse(di[0].values[DiscreteInputAddress.Z01_RUN_FEEDBACK])
        self.assertEqual(ir[0].values[InputRegisterAddress.Z01_TANK_LEVEL], 750)
        self.assertEqual(ir[0].values[InputRegisterAddress.Z01_FLOW], 0)

    def test_manual_start_runs_process_and_consumes_momentary_coil(self):
        coils = self.device.simdata[0][0].values
        coils[CoilAddress.Z01_START] = True

        state = self.runtime.scan()

        self.assertTrue(state.running)
        self.assertFalse(coils[CoilAddress.Z01_START])
        self.assertTrue(
            self.device.simdata[1][0].values[
                DiscreteInputAddress.Z01_RUN_FEEDBACK
            ]
        )
        self.assertEqual(
            self.device.simdata[3][0].values[InputRegisterAddress.Z01_FLOW],
            900,
        )
        self.assertEqual(
            self.device.simdata[3][0].values[
                InputRegisterAddress.Z01_PUMP_FREQUENCY
            ],
            450,
        )

    def test_manual_stop_stops_process_and_is_consumed(self):
        coils = self.device.simdata[0][0].values
        coils[CoilAddress.Z01_START] = True
        self.runtime.scan()
        coils[CoilAddress.Z01_STOP] = True

        state = self.runtime.scan()

        self.assertFalse(state.running)
        self.assertFalse(coils[CoilAddress.Z01_STOP])
        self.assertFalse(
            self.device.simdata[1][0].values[
                DiscreteInputAddress.Z01_RUN_FEEDBACK
            ]
        )
        self.assertEqual(
            self.device.simdata[3][0].values[InputRegisterAddress.Z01_FLOW],
            0,
        )

    def test_reenable_coil_is_consumed_and_stop_latch_is_published(self):
        coils = self.device.simdata[0][0].values
        discrete = self.device.simdata[1][0].values
        coils[CoilAddress.Z01_START] = True
        self.runtime.scan()
        coils[CoilAddress.Z01_STOP] = True
        state = self.runtime.scan()
        self.assertTrue(state.operator_stop_latched)
        self.assertTrue(discrete[DiscreteInputAddress.Z01_OPERATOR_STOP_LATCHED])
        coils[CoilAddress.Z01_REENABLE] = True
        state = self.runtime.scan()
        self.assertFalse(coils[CoilAddress.Z01_REENABLE])
        self.assertFalse(state.operator_stop_latched)
        self.assertFalse(discrete[DiscreteInputAddress.Z01_OPERATOR_STOP_LATCHED])
        self.assertFalse(state.running)

    def test_auto_mode_starts_when_tank_is_low(self):
        device = build_device()
        runtime = Zone01Runtime(
            device,
            process_model=WaterProcessModel(initial_tank_level_percent=10.0),
        )
        device.simdata[0][0].values[CoilAddress.Z01_AUTO] = True

        state = runtime.scan()

        self.assertTrue(state.auto_active)
        self.assertTrue(state.running)

    def test_invalid_setpoint_removes_effective_permissive(self):
        coils = self.device.simdata[0][0].values
        holding = self.device.simdata[2][0].values
        coils[CoilAddress.Z01_START] = True
        holding[HoldingRegisterAddress.Z01_PUMP_SPEED_SP] = 600

        state = self.runtime.scan()

        self.assertFalse(state.running)
        self.assertFalse(state.permissive)
        # The external permissive input remains true; setpoint validity is
        # an additional internal condition and does not overwrite that input.
        self.assertTrue(
            self.device.simdata[1][0].values[
                DiscreteInputAddress.Z01_PERMISSIVE
            ]
        )
        self.assertEqual(
            self.device.simdata[3][0].values[InputRegisterAddress.Z01_FLOW],
            0,
        )

        # Correcting the setpoint restores the effective permissive; the
        # external permissive input was not overwritten by the earlier fault.
        holding[HoldingRegisterAddress.Z01_PUMP_SPEED_SP] = 450
        recovered_state = self.runtime.scan()
        self.assertTrue(recovered_state.permissive)
        self.assertFalse(recovered_state.running)

    def test_runtime_uses_active_pymodbus_memory_when_attached(self):
        # SimCore represents the memory PyModbus actually serves. It builds
        # packed register arrays from SimData, rather than sharing its lists.
        active_device = SimCore([self.device]).devices[1]
        runtime = Zone01Runtime(self.device, datastore=active_device)

        runtime.scan()
        discrete_registers = active_device.block["d"][2]
        self.assertTrue(discrete_registers[0] & (1 << DiscreteInputAddress.Z01_MANUAL))

        runtime.coils[CoilAddress.Z01_START] = True
        state = runtime.scan()

        self.assertTrue(state.running)
        coil_registers = active_device.block["c"][2]
        self.assertFalse(coil_registers[0] & (1 << CoilAddress.Z01_START))
        self.assertTrue(
            discrete_registers[0] & (1 << DiscreteInputAddress.Z01_RUNNING)
        )
        input_registers = active_device.block["i"][2]
        self.assertEqual(
            input_registers[InputRegisterAddress.Z01_FLOW], 900
        )
        self.assertEqual(
            input_registers[InputRegisterAddress.Z01_PUMP_FREQUENCY], 450
        )

    def test_external_permissive_loss_blocks_start(self):
        di = self.device.simdata[1][0].values
        di[DiscreteInputAddress.Z01_PERMISSIVE] = False
        self.device.simdata[0][0].values[CoilAddress.Z01_START] = True

        state = self.runtime.scan()

        self.assertFalse(state.running)
        self.assertFalse(state.permissive)


if __name__ == "__main__":
    unittest.main()
