"""Unit tests for the Zone 01 water-process model."""

import unittest

from src.process_model import ProcessModelConfig, WaterProcessModel


class WaterProcessModelTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = WaterProcessModel()

    def test_initial_measurements(self) -> None:
        values = self.model.measurements
        self.assertEqual(values.tank_level_percent, 75.0)
        self.assertEqual(values.flow_lpm, 0.0)
        self.assertEqual(values.pump_frequency_hz, 0.0)
        self.assertEqual(values.pump_speed_percent, 0.0)
        self.assertEqual(values.pump_current_a, 0.0)

    def test_running_pump_calculates_process_measurements(self) -> None:
        values = self.model.step(
            pump_running=True, pump_frequency_setpoint_hz=45.0,
            valve_position_setpoint_percent=100.0, elapsed_seconds=0.5,
        )
        self.assertAlmostEqual(values.flow_lpm, 90.0)
        self.assertAlmostEqual(values.pump_frequency_hz, 45.0)
        self.assertAlmostEqual(values.pump_speed_percent, 90.0)
        self.assertAlmostEqual(values.pump_current_a, 9.0)

    def test_flow_is_proportional_to_valve_position(self) -> None:
        values = self.model.step(
            pump_running=True, pump_frequency_setpoint_hz=50.0,
            valve_position_setpoint_percent=50.0, elapsed_seconds=1.0,
        )
        self.assertAlmostEqual(values.flow_lpm, 50.0)
        self.assertEqual(values.valve_position_percent, 50.0)

    def test_stopped_pump_has_zero_output_measurements(self) -> None:
        values = self.model.step(
            pump_running=False, pump_frequency_setpoint_hz=45.0,
            valve_position_setpoint_percent=75.0, elapsed_seconds=0.5,
        )
        self.assertEqual(values.flow_lpm, 0.0)
        self.assertEqual(values.pump_frequency_hz, 0.0)
        self.assertEqual(values.pump_speed_percent, 0.0)
        self.assertEqual(values.pump_current_a, 0.0)
        self.assertEqual(values.valve_position_percent, 75.0)

    def test_tank_level_increases_by_flow_balance(self) -> None:
        values = self.model.step(
            pump_running=True, pump_frequency_setpoint_hz=50.0,
            valve_position_setpoint_percent=100.0, elapsed_seconds=60.0,
        )
        self.assertAlmostEqual(values.tank_level_percent, 76.0)

    def test_tank_level_is_clamped_at_100_percent(self) -> None:
        model = WaterProcessModel(initial_tank_level_percent=99.9)
        values = model.step(
            pump_running=True, pump_frequency_setpoint_hz=50.0,
            valve_position_setpoint_percent=100.0, elapsed_seconds=60.0,
        )
        self.assertEqual(values.tank_level_percent, 100.0)

    def test_zero_valve_position_produces_zero_flow(self) -> None:
        values = self.model.step(
            pump_running=True, pump_frequency_setpoint_hz=50.0,
            valve_position_setpoint_percent=0.0, elapsed_seconds=1.0,
        )
        self.assertEqual(values.flow_lpm, 0.0)

    def test_invalid_frequency_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.model.step(
                pump_running=True, pump_frequency_setpoint_hz=55.0,
                valve_position_setpoint_percent=100.0, elapsed_seconds=0.5,
            )

    def test_invalid_elapsed_time_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            self.model.step(
                pump_running=True, pump_frequency_setpoint_hz=45.0,
                valve_position_setpoint_percent=100.0, elapsed_seconds=61.0,
            )

    def test_invalid_configuration_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            WaterProcessModel(
                config=ProcessModelConfig(tank_capacity_litres=0.0)
            )


if __name__ == "__main__":
    unittest.main()
