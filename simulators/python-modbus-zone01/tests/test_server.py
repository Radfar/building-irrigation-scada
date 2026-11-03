"""Tests for the Zone 01 Modbus device configuration."""

import unittest

from pymodbus.simulator import SimDevice

from src.modbus_server import build_device
from src.register_map import (
    MODBUS_UNIT_ID,
    CoilAddress,
    DiscreteInputAddress,
    HoldingRegisterAddress,
    InputRegisterAddress,
)


class DeviceConfigurationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.device = build_device()

    def test_build_device_returns_pymodbus_sim_device(self) -> None:
        self.assertIsInstance(self.device, SimDevice)

    def test_device_uses_documented_unit_id(self) -> None:
        self.assertEqual(self.device.id, MODBUS_UNIT_ID)

    def test_all_four_address_spaces_start_at_zero(self) -> None:
        for address_space in self.device.simdata:
            with self.subTest(address_space=address_space):
                self.assertEqual(address_space[0].address, 0)

    def test_address_space_sizes_match_register_map(self) -> None:
        coils, discrete_inputs, holding_registers, input_registers = self.device.simdata
        self.assertEqual(len(coils[0].values), max(CoilAddress) + 1)
        self.assertEqual(
            len(discrete_inputs[0].values),
            max(DiscreteInputAddress) + 1,
        )
        self.assertEqual(
            len(holding_registers[0].values),
            max(HoldingRegisterAddress) + 1,
        )
        self.assertEqual(
            len(input_registers[0].values),
            max(InputRegisterAddress) + 1,
        )

    def test_initial_setpoints_and_tank_level(self) -> None:
        _, _, holding_registers, input_registers = self.device.simdata
        self.assertEqual(
            holding_registers[0].values,
            [450, 1000, 50, 200, 900],
        )
        self.assertEqual(input_registers[0].values[0], 750)

    def test_permissive_is_initially_true_and_outputs_are_stopped(self) -> None:
        coils, discrete_inputs, _, _ = self.device.simdata
        self.assertEqual(coils[0].values, [False] * 5)
        self.assertTrue(discrete_inputs[0].values[3])

    def test_discrete_inputs_are_read_only(self) -> None:
        _, discrete_inputs, _, _ = self.device.simdata
        self.assertTrue(discrete_inputs[0].readonly)

    def test_input_registers_are_read_only(self) -> None:
        _, _, _, input_registers = self.device.simdata
        self.assertTrue(input_registers[0].readonly)


if __name__ == "__main__":
    unittest.main()
