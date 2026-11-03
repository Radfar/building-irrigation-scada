"""Unit tests for the initial Modbus register map."""

import unittest

from src.register_map import (
    CoilAddress,
    DiscreteInputAddress,
    HoldingRegisterAddress,
    InputRegisterAddress,
    decode_scaled,
    encode_scaled,
)


class RegisterAddressTests(unittest.TestCase):
    def test_each_address_space_starts_at_zero(self):
        self.assertEqual(int(CoilAddress.Z01_AUTO), 0)
        self.assertEqual(int(DiscreteInputAddress.Z01_RUN_FEEDBACK), 0)
        self.assertEqual(int(HoldingRegisterAddress.Z01_PUMP_SPEED_SP), 0)
        self.assertEqual(int(InputRegisterAddress.Z01_TANK_LEVEL), 0)

    def test_addresses_are_unique_within_each_space(self):
        address_spaces = (
            CoilAddress,
            DiscreteInputAddress,
            HoldingRegisterAddress,
            InputRegisterAddress,
        )
        for address_space in address_spaces:
            values = [int(item) for item in address_space]
            self.assertEqual(len(values), len(set(values)))


class RegisterScalingTests(unittest.TestCase):
    def test_encode_scaled_value(self):
        self.assertEqual(encode_scaled(56.7), 567)

    def test_decode_scaled_value(self):
        self.assertAlmostEqual(decode_scaled(567), 56.7)

    def test_round_trip(self):
        value = 23.4
        self.assertAlmostEqual(decode_scaled(encode_scaled(value)), value)

    def test_rejects_negative_value(self):
        with self.assertRaises(ValueError):
            encode_scaled(-0.1)

    def test_rejects_value_outside_uint16_range(self):
        with self.assertRaises(ValueError):
            encode_scaled(6553.6)

    def test_rejects_boolean_as_numeric_value(self):
        with self.assertRaises(TypeError):
            encode_scaled(True)

    def test_supports_alternate_scale(self):
        self.assertEqual(encode_scaled(12.34, scale=100), 1234)
        self.assertAlmostEqual(decode_scaled(1234, scale=100), 12.34)


if __name__ == "__main__":
    unittest.main()
