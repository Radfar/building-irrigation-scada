"""Manual Modbus TCP communication check for the Zone 01 simulator."""

from pymodbus.client import ModbusTcpClient

from .register_map import MODBUS_TCP_PORT, MODBUS_UNIT_ID

HOST = "127.0.0.1"


def main() -> None:
    """Connect, read all data areas, and verify representative writes."""
    client = ModbusTcpClient(HOST, port=MODBUS_TCP_PORT, timeout=3)

    try:
        if not client.connect():
            raise ConnectionError(
                f"Could not connect to Modbus TCP server at {HOST}:{MODBUS_TCP_PORT}"
            )

        print(f"Connected to {HOST}:{MODBUS_TCP_PORT}, Unit ID {MODBUS_UNIT_ID}")

        reads = (
            ("Coils", client.read_coils(0, count=5, device_id=MODBUS_UNIT_ID)),
            (
                "Discrete inputs",
                client.read_discrete_inputs(0, count=14, device_id=MODBUS_UNIT_ID),
            ),
            (
                "Holding registers",
                client.read_holding_registers(0, count=5, device_id=MODBUS_UNIT_ID),
            ),
            (
                "Input registers",
                client.read_input_registers(0, count=6, device_id=MODBUS_UNIT_ID),
            ),
        )

        for label, response in reads:
            if response.isError():
                raise RuntimeError(f"{label} read failed: {response}")

        print(f"Coils (offsets 0-4): {reads[0][1].bits[:5]}")
        print(f"Discrete inputs (offsets 0-13): {reads[1][1].bits[:14]}")
        print(f"Holding registers (offsets 0-4): {reads[2][1].registers}")
        print(f"Input registers (offsets 0-5): {reads[3][1].registers}")

        # Toggle AUTO briefly, verify the read-back, then restore the original value.
        original_auto = bool(reads[0][1].bits[0])
        response = client.write_coil(
            0, not original_auto, device_id=MODBUS_UNIT_ID
        )
        if response.isError():
            raise RuntimeError(f"Auto coil write failed: {response}")
        verify = client.read_coils(0, count=1, device_id=MODBUS_UNIT_ID)
        if verify.isError() or bool(verify.bits[0]) != (not original_auto):
            raise RuntimeError("Auto coil write/read-back verification failed")
        response = client.write_coil(
            0, original_auto, device_id=MODBUS_UNIT_ID
        )
        if response.isError():
            raise RuntimeError(f"Could not restore Auto coil: {response}")
        print("Coil write/read-back/restore: PASS")

        # Change pump-speed setpoint by 0.1 Hz, verify it, then restore it.
        original_setpoint = reads[2][1].registers[0]
        test_setpoint = original_setpoint + 1
        response = client.write_register(
            0, test_setpoint, device_id=MODBUS_UNIT_ID
        )
        if response.isError():
            raise RuntimeError(f"Holding-register write failed: {response}")
        verify = client.read_holding_registers(
            0, count=1, device_id=MODBUS_UNIT_ID
        )
        if verify.isError() or verify.registers[0] != test_setpoint:
            raise RuntimeError("Holding-register write/read-back verification failed")
        response = client.write_register(
            0, original_setpoint, device_id=MODBUS_UNIT_ID
        )
        if response.isError():
            raise RuntimeError(f"Could not restore holding register: {response}")
        print("Holding-register write/read-back/restore: PASS")
        print("Modbus TCP communication check: PASS")

    finally:
        client.close()


if __name__ == "__main__":
    main()
