"""Unit tests for the Zone 01 command processor."""

import unittest

from src.command_processor import (
    CommandProcessor,
    ControlCommands,
    ControlSetpoints,
)


class CommandProcessorTests(unittest.TestCase):
    def setUp(self):
        self.processor = CommandProcessor()
        self.setpoints = ControlSetpoints()
        self.base = {
            "permissive": True,
            "tank_level_percent": 50.0,
            "flow_lpm": 10.0,
            "elapsed_seconds": 0.5,
        }

    def update(self, commands=None, **overrides):
        values = dict(self.base)
        values.update(overrides)
        return self.processor.update(
            commands or ControlCommands(), self.setpoints, **values
        )

    def test_initial_state_is_manual_and_stopped(self):
        state = self.update()
        self.assertTrue(state.manual)
        self.assertFalse(state.auto_active)
        self.assertFalse(state.running)
        self.assertTrue(state.process_ok)

    def test_manual_start_latches_run_request(self):
        state = self.update(ControlCommands(start_request=True))
        self.assertTrue(state.running)
        self.assertTrue(state.manual)

    def test_start_request_is_edge_triggered(self):
        self.update(ControlCommands(start_request=True))
        state = self.update(ControlCommands(start_request=True))
        self.assertTrue(state.running)

    def test_manual_stop_clears_run_request(self):
        self.update(ControlCommands(start_request=True))
        state = self.update(ControlCommands(stop_request=True))
        self.assertFalse(state.running)

    def test_stop_has_priority_over_start(self):
        state = self.update(
            ControlCommands(start_request=True, stop_request=True)
        )
        self.assertFalse(state.running)

    def test_stop_latches_in_manual_until_explicit_reenable(self):
        self.update(ControlCommands(start_request=True))
        state = self.update(ControlCommands(stop_request=True))
        self.assertFalse(state.running)
        self.assertTrue(state.operator_stop_latched)
        state = self.update(ControlCommands(start_request=True))
        self.assertFalse(state.running)
        state = self.update(ControlCommands(reenable_request=True))
        self.assertFalse(state.running)
        self.assertFalse(state.operator_stop_latched)
        self.update(ControlCommands())
        self.assertTrue(self.update(ControlCommands(start_request=True)).running)

    def test_stop_latch_blocks_auto_until_reenabled_and_level_recovers(self):
        self.update(ControlCommands(auto_selected=True), tank_level_percent=10.0)
        state = self.update(ControlCommands(auto_selected=True, stop_request=True), tank_level_percent=10.0)
        self.assertFalse(state.running)
        self.assertTrue(state.operator_stop_latched)
        self.assertFalse(self.update(ControlCommands(auto_selected=True), tank_level_percent=10.0).running)
        state = self.update(ControlCommands(auto_selected=True, reenable_request=True), tank_level_percent=10.0)
        self.assertFalse(state.running)
        self.assertFalse(state.operator_stop_latched)
        self.assertFalse(self.update(ControlCommands(auto_selected=True), tank_level_percent=10.0).running)
        self.update(ControlCommands(auto_selected=True), tank_level_percent=21.0)
        self.assertTrue(self.update(ControlCommands(auto_selected=True), tank_level_percent=10.0).running)

    def test_stop_has_priority_over_reenable(self):
        state = self.update(ControlCommands(stop_request=True, reenable_request=True))
        self.assertTrue(state.operator_stop_latched)
        self.assertFalse(state.running)

    def test_fault_reset_does_not_clear_operator_stop_latch(self):
        self.update(ControlCommands(stop_request=True))
        state = self.update(ControlCommands(fault_reset_request=True))
        self.assertTrue(state.operator_stop_latched)
        self.assertFalse(state.running)

    def test_manual_start_does_not_start_without_permissive(self):
        state = self.update(
            ControlCommands(start_request=True), permissive=False
        )
        self.assertFalse(state.running)
        self.assertFalse(state.process_ok)

    def test_auto_starts_at_or_below_low_level_setpoint(self):
        state = self.update(
            ControlCommands(auto_selected=True), tank_level_percent=20.0
        )
        self.assertTrue(state.auto_active)
        self.assertTrue(state.running)
        self.assertTrue(state.tank_low)

    def test_auto_stops_at_or_above_high_level_setpoint(self):
        self.update(
            ControlCommands(auto_selected=True), tank_level_percent=10.0
        )
        state = self.update(
            ControlCommands(auto_selected=True), tank_level_percent=90.0
        )
        self.assertFalse(state.running)
        self.assertTrue(state.tank_high)

    def test_auto_hysteresis_retains_state_between_thresholds(self):
        self.update(
            ControlCommands(auto_selected=True), tank_level_percent=10.0
        )
        state = self.update(
            ControlCommands(auto_selected=True), tank_level_percent=55.0
        )
        self.assertTrue(state.running)

    def test_auto_does_not_start_in_middle_band(self):
        state = self.update(
            ControlCommands(auto_selected=True), tank_level_percent=55.0
        )
        self.assertFalse(state.running)


    def test_auto_stop_at_low_level_requires_reenable_and_level_recovery(self):
        state = self.update(
            ControlCommands(auto_selected=True), tank_level_percent=10.0
        )
        self.assertTrue(state.running)

        state = self.update(
            ControlCommands(auto_selected=True, stop_request=True),
            tank_level_percent=10.0,
        )
        self.assertFalse(state.running)
        self.assertTrue(state.operator_stop_latched)

        # Tank recovery alone must not clear the operator STOP latch.
        state = self.update(
            ControlCommands(auto_selected=True), tank_level_percent=21.0
        )
        self.assertFalse(state.running)
        self.assertTrue(state.operator_stop_latched)

        # RE-ENABLE clears the latch but does not immediately restart the pump.
        state = self.update(
            ControlCommands(auto_selected=True, reenable_request=True),
            tank_level_percent=21.0,
        )
        self.assertFalse(state.running)
        self.assertFalse(state.operator_stop_latched)

        # A fresh low-level condition is required for automatic restart.
        state = self.update(
            ControlCommands(auto_selected=True), tank_level_percent=10.0
        )
        self.assertTrue(state.running)

    def test_mode_change_to_manual_clears_auto_demand(self):
        self.update(
            ControlCommands(auto_selected=True), tank_level_percent=10.0
        )
        state = self.update(ControlCommands(auto_selected=False))
        self.assertFalse(state.running)
        self.assertTrue(state.manual)

    def test_loss_of_permissive_stops_pump(self):
        self.update(ControlCommands(start_request=True))
        state = self.update(permissive=False)
        self.assertFalse(state.running)

    def test_high_tank_level_blocks_manual_start(self):
        state = self.update(
            ControlCommands(start_request=True), tank_level_percent=95.0
        )
        self.assertFalse(state.running)

    def test_low_flow_trip_latches_after_three_seconds(self):
        self.update(ControlCommands(start_request=True), flow_lpm=0.0)
        self.update(flow_lpm=0.0, elapsed_seconds=1.0)
        self.update(flow_lpm=0.0, elapsed_seconds=1.0)
        state = self.update(flow_lpm=0.0, elapsed_seconds=1.0)
        self.assertFalse(state.running)
        self.assertTrue(state.fault)
        self.assertTrue(state.low_flow)

    def test_low_flow_fault_can_be_reset_while_pump_is_stopped(self):
        self.update(ControlCommands(start_request=True), flow_lpm=0.0)
        self.update(flow_lpm=0.0, elapsed_seconds=3.0)
        state = self.update(
            ControlCommands(fault_reset_request=True), flow_lpm=0.0
        )
        self.assertFalse(state.fault)
        self.assertFalse(state.running)

    def test_low_flow_fault_can_be_reset_after_flow_recovers(self):
        self.update(ControlCommands(start_request=True), flow_lpm=0.0)
        self.update(flow_lpm=0.0, elapsed_seconds=3.0)
        state = self.update(
            ControlCommands(fault_reset_request=True), flow_lpm=10.0
        )
        self.assertFalse(state.fault)
        self.assertFalse(state.low_flow)
        self.assertFalse(state.running)

    def test_external_pump_fault_is_latched(self):
        state = self.update(pump_fault_condition=True)
        self.assertTrue(state.fault)
        self.assertTrue(state.pump_fault)
        state = self.update(pump_fault_condition=False)
        self.assertTrue(state.fault)

    def test_external_pump_fault_reset_after_condition_clears(self):
        self.update(pump_fault_condition=True)
        state = self.update(
            ControlCommands(fault_reset_request=True),
            pump_fault_condition=False,
        )
        self.assertFalse(state.fault)
        self.assertFalse(state.pump_fault)

    def test_held_reset_is_not_retriggered(self):
        self.update(pump_fault_condition=True)
        self.update(
            ControlCommands(fault_reset_request=True),
            pump_fault_condition=False,
        )
        # A new fault while RESET remains held cannot be cleared without
        # releasing RESET and generating another rising edge.
        state = self.update(
            ControlCommands(fault_reset_request=True),
            pump_fault_condition=True,
        )
        self.assertTrue(state.fault)
        state = self.update(
            ControlCommands(fault_reset_request=True),
            pump_fault_condition=False,
        )
        self.assertTrue(state.fault)

    def test_invalid_tank_level_is_rejected(self):
        with self.assertRaises(ValueError):
            self.update(tank_level_percent=101.0)

    def test_invalid_setpoint_order_is_rejected(self):
        bad_setpoints = ControlSetpoints(
            tank_level_low_percent=95.0,
            tank_level_high_percent=90.0,
        )
        with self.assertRaises(ValueError):
            self.processor.update(
                ControlCommands(),
                bad_setpoints,
                **self.base,
            )

    def test_invalid_elapsed_time_is_rejected(self):
        with self.assertRaises(ValueError):
            self.update(elapsed_seconds=61.0)


if __name__ == "__main__":
    unittest.main()
