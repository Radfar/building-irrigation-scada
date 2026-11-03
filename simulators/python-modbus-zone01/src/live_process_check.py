"""Live Modbus TCP process check for the Zone 01 simulator.

Run the server in one terminal, then run:
    python -m src.live_process_check
"""

import time

from pymodbus.client import ModbusTcpClient

from .register_map import (
    MODBUS_TCP_PORT,
    MODBUS_UNIT_ID,
    CoilAddress,
    DiscreteInputAddress,
    InputRegisterAddress,
)

HOST = "127.0.0.1"


def _read(client, method, address, count):
    response = method(address, count=count, device_id=MODBUS_UNIT_ID)
    if response.isError():
        raise RuntimeError(f"Modbus read failed at offset {address}: {response}")
    return response


def main() -> None:
    client = ModbusTcpClient(HOST, port=MODBUS_TCP_PORT, timeout=3)
    original_auto = False
    auto_was_read = False

    try:
        if not client.connect():
            raise ConnectionError(
                f"Could not connect to Modbus TCP server at {HOST}:{MODBUS_TCP_PORT}"
            )

        coils = _read(client, client.read_coils, 0, 5).bits[:5]
        di = _read(client, client.read_discrete_inputs, 0, 14).bits[:14]
        if di[DiscreteInputAddress.Z01_OPERATOR_STOP_LATCHED]:
            response = client.write_coil(CoilAddress.Z01_REENABLE, True, device_id=MODBUS_UNIT_ID)
            if response.isError():
                raise RuntimeError(f"Could not clear previous operator-stop latch: {response}")
            time.sleep(0.8)
            di = _read(client, client.read_discrete_inputs, 0, 14).bits[:14]
        ir = _read(client, client.read_input_registers, 0, 6).registers

        original_auto = bool(coils[CoilAddress.Z01_AUTO])
        auto_was_read = True
        tank_level = ir[InputRegisterAddress.Z01_TANK_LEVEL] / 10.0

        print(f"Connected to {HOST}:{MODBUS_TCP_PORT}, Unit ID {MODBUS_UNIT_ID}")
        print(f"Initial tank level: {tank_level:.1f}%")

        if not di[DiscreteInputAddress.Z01_PERMISSIVE]:
            raise RuntimeError("External permissive is false; START test cannot proceed")
        if di[DiscreteInputAddress.Z01_FAULT]:
            raise RuntimeError("A zone fault is active; reset/investigate before testing")
        if tank_level >= 90.0:
            raise RuntimeError("Tank is at/above the default high threshold; test aborted")

        # Select Manual and clear any stale momentary requests.
        for address in (CoilAddress.Z01_START, CoilAddress.Z01_STOP):
            response = client.write_coil(address, False, device_id=MODBUS_UNIT_ID)
            if response.isError():
                raise RuntimeError(f"Could not clear command coil {address}: {response}")

        response = client.write_coil(
            CoilAddress.Z01_AUTO, False, device_id=MODBUS_UNIT_ID
        )
        if response.isError():
            raise RuntimeError(f"Could not select Manual mode: {response}")

        response = client.write_coil(
            CoilAddress.Z01_START, True, device_id=MODBUS_UNIT_ID
        )
        if response.isError():
            raise RuntimeError(f"START write failed: {response}")

        time.sleep(0.8)
        run_di = _read(client, client.read_discrete_inputs, 0, 14).bits[:14]
        run_ir = _read(client, client.read_input_registers, 0, 6).registers

        running = bool(run_di[DiscreteInputAddress.Z01_RUNNING])
        feedback = bool(run_di[DiscreteInputAddress.Z01_RUN_FEEDBACK])
        flow = run_ir[InputRegisterAddress.Z01_FLOW] / 10.0
        frequency = run_ir[InputRegisterAddress.Z01_PUMP_FREQUENCY] / 10.0
        print(
            f"After START: RUNNING={running}, RUN_FEEDBACK={feedback}, "
            f"FLOW={flow:.1f} L/min, FREQUENCY={frequency:.1f} Hz"
        )

        if not (running and feedback and flow > 0.0 and frequency > 0.0):
            raise RuntimeError("START was written, but expected running feedback/flow was not observed")
        print("Live START/process response: PASS")

        response = client.write_coil(
            CoilAddress.Z01_STOP, True, device_id=MODBUS_UNIT_ID
        )
        if response.isError():
            raise RuntimeError(f"STOP write failed: {response}")

        time.sleep(0.8)
        stop_di = _read(client, client.read_discrete_inputs, 0, 14).bits[:14]
        stop_ir = _read(client, client.read_input_registers, 0, 6).registers

        stopped = not bool(stop_di[DiscreteInputAddress.Z01_RUNNING])
        feedback_off = not bool(stop_di[DiscreteInputAddress.Z01_RUN_FEEDBACK])
        flow_zero = stop_ir[InputRegisterAddress.Z01_FLOW] == 0
        frequency_zero = stop_ir[InputRegisterAddress.Z01_PUMP_FREQUENCY] == 0

        print(
            f"After STOP: RUNNING={not stopped}, "
            f"RUN_FEEDBACK={not feedback_off}, "
            f"FLOW={stop_ir[InputRegisterAddress.Z01_FLOW] / 10.0:.1f} L/min, "
            f"FREQUENCY={stop_ir[InputRegisterAddress.Z01_PUMP_FREQUENCY] / 10.0:.1f} Hz"
        )

        if not (stopped and feedback_off and flow_zero and frequency_zero):
            raise RuntimeError("STOP was written, but the process did not reach the stopped state")
        if not stop_di[DiscreteInputAddress.Z01_OPERATOR_STOP_LATCHED]:
            raise RuntimeError("STOP did not set the operator-stop latch")
        print("Live STOP/process response and operator-stop latch: PASS")

        response = client.write_coil(CoilAddress.Z01_START, True, device_id=MODBUS_UNIT_ID)
        if response.isError():
            raise RuntimeError(f"Blocked START write failed: {response}")
        time.sleep(0.8)
        blocked_di = _read(client, client.read_discrete_inputs, 0, 14).bits[:14]
        if blocked_di[DiscreteInputAddress.Z01_RUNNING]:
            raise RuntimeError("START unexpectedly ran while operator-stop latch was set")

        response = client.write_coil(CoilAddress.Z01_REENABLE, True, device_id=MODBUS_UNIT_ID)
        if response.isError():
            raise RuntimeError(f"RE-ENABLE write failed: {response}")
        time.sleep(0.8)
        enabled_di = _read(client, client.read_discrete_inputs, 0, 14).bits[:14]
        if enabled_di[DiscreteInputAddress.Z01_OPERATOR_STOP_LATCHED]:
            raise RuntimeError("RE-ENABLE did not clear the operator-stop latch")
        if enabled_di[DiscreteInputAddress.Z01_RUNNING]:
            raise RuntimeError("RE-ENABLE unexpectedly started the pump")
        print("RE-ENABLE clears latch without starting: PASS")

        response = client.write_coil(CoilAddress.Z01_START, True, device_id=MODBUS_UNIT_ID)
        if response.isError():
            raise RuntimeError(f"Fresh START after RE-ENABLE failed: {response}")
        time.sleep(0.8)
        restarted_di = _read(client, client.read_discrete_inputs, 0, 14).bits[:14]
        if not restarted_di[DiscreteInputAddress.Z01_RUNNING]:
            raise RuntimeError("Fresh START after RE-ENABLE did not run the pump")
        print("Fresh START after RE-ENABLE: PASS")

        response = client.write_coil(CoilAddress.Z01_STOP, True, device_id=MODBUS_UNIT_ID)
        if response.isError():
            raise RuntimeError(f"Final STOP write failed: {response}")
        time.sleep(0.8)
        print("Live Modbus TCP process check: PASS")

    finally:
        # Best-effort safe cleanup if the test exits early.
        if client.connected:
            client.write_coil(
                CoilAddress.Z01_STOP, True, device_id=MODBUS_UNIT_ID
            )
            time.sleep(0.6)
            if auto_was_read:
                client.write_coil(
                    CoilAddress.Z01_AUTO,
                    original_auto,
                    device_id=MODBUS_UNIT_ID,
                )
        client.close()


if __name__ == "__main__":
    main()
