"""Modbus TCP server for the Zone 01 simulated water device."""

import asyncio

from pymodbus.server import ModbusTcpServer
from pymodbus.simulator import DataType, SimData, SimDevice

from .runtime import Zone01Runtime

from .register_map import (
    MODBUS_TCP_PORT,
    MODBUS_UNIT_ID,
    CoilAddress,
    DiscreteInputAddress,
    HoldingRegisterAddress,
    InputRegisterAddress,
)


def build_device() -> SimDevice:
    """Build the Zone 01 device with the documented four address spaces."""
    coils = [False] * (max(CoilAddress) + 1)
    discrete_inputs = [False] * (max(DiscreteInputAddress) + 1)
    holding_registers = [0] * (max(HoldingRegisterAddress) + 1)
    input_registers = [0] * (max(InputRegisterAddress) + 1)

    # Initial simulated conditions and operator setpoints.
    discrete_inputs[DiscreteInputAddress.Z01_PERMISSIVE] = True

    holding_registers[HoldingRegisterAddress.Z01_PUMP_SPEED_SP] = 450
    holding_registers[HoldingRegisterAddress.Z01_VALVE_POSITION_SP] = 1000
    holding_registers[HoldingRegisterAddress.Z01_FLOW_LOW_SP] = 50
    holding_registers[HoldingRegisterAddress.Z01_TANK_LEVEL_LOW_SP] = 200
    holding_registers[HoldingRegisterAddress.Z01_TANK_LEVEL_HIGH_SP] = 900

    input_registers[InputRegisterAddress.Z01_TANK_LEVEL] = 750

    return SimDevice(
        id=MODBUS_UNIT_ID,
        simdata=(
            [
                SimData(
                    address=0,
                    values=coils,
                    datatype=DataType.BITS,
                )
            ],
            [
                SimData(
                    address=0,
                    values=discrete_inputs,
                    datatype=DataType.BITS,
                    readonly=True,
                )
            ],
            [
                SimData(
                    address=0,
                    values=holding_registers,
                    datatype=DataType.REGISTERS,
                )
            ],
            [
                SimData(
                    address=0,
                    values=input_registers,
                    datatype=DataType.REGISTERS,
                    readonly=True,
                )
            ],
        ),
    )


async def run_server(host: str = "127.0.0.1", port: int = MODBUS_TCP_PORT) -> None:
    """Run the Modbus TCP server until the process is interrupted."""
    device = build_device()
    server = ModbusTcpServer(
        context=[device],
        address=(host, port),
    )

    print("Industrial Water Modbus Simulator")
    print("----------------------------------")
    print(f"Modbus TCP server listening on {host}:{port}")
    print(f"Unit ID: {MODBUS_UNIT_ID}")
    print("Press Ctrl+C to stop the server.")

    # PyModbus compiles SimData into its active simulator memory at server
    # construction. Bind the process runtime to that live memory, not the
    # original SimData.values lists.
    active_device_memory = server.context.devices[MODBUS_UNIT_ID]
    runtime = Zone01Runtime(device, datastore=active_device_memory)
    runtime_task = asyncio.create_task(runtime.run())
    print("Zone 01 process simulation running (500 ms nominal scan).")

    try:
        await server.serve_forever()
    finally:
        runtime_task.cancel()
        try:
            await runtime_task
        except asyncio.CancelledError:
            pass


def main() -> None:
    """Start the asynchronous Modbus TCP server."""
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        print("\nModbus TCP server stopped.")


if __name__ == "__main__":
    main()
