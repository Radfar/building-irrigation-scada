"""Background Modbus TCP polling and command execution for the GUI."""

from PySide6.QtCore import QObject, QTimer, Signal, Slot
from pymodbus.client import ModbusTcpClient


class ModbusWorker(QObject):
    snapshot = Signal(dict)
    connection_changed = Signal(bool, str)
    log_message = Signal(str)

    def __init__(self, host: str = "127.0.0.1", port: int = 1502, unit_id: int = 1):
        super().__init__()
        self.host = host
        self.port = port
        self.unit_id = unit_id
        self.client = None
        self.timer = None
        self.connected = False

    @Slot()
    def start(self):
        self.timer = QTimer(self)
        self.timer.setInterval(500)
        self.timer.timeout.connect(self.poll)
        self.timer.start()
        self.poll()

    @Slot()
    def stop(self):
        if self.timer:
            self.timer.stop()
        self._disconnect("Monitoring stopped")

    def _disconnect(self, reason: str):
        if self.client:
            self.client.close()
            self.client = None
        if self.connected:
            self.connected = False
            self.connection_changed.emit(False, reason)

    @Slot()
    def poll(self):
        try:
            if self.client is None:
                self.client = ModbusTcpClient(self.host, port=self.port, timeout=0.6)
            if not self.client.connected and not self.client.connect():
                self._disconnect("Waiting for Modbus TCP server")
                return

            responses = {
                "coils": self.client.read_coils(0, count=5, device_id=self.unit_id),
                "discrete_inputs": self.client.read_discrete_inputs(0, count=14, device_id=self.unit_id),
                "holding_registers": self.client.read_holding_registers(0, count=5, device_id=self.unit_id),
                "input_registers": self.client.read_input_registers(0, count=6, device_id=self.unit_id),
            }
            for name, response in responses.items():
                if response.isError():
                    raise RuntimeError(f"{name} read failed: {response}")

            if not self.connected:
                self.connected = True
                self.connection_changed.emit(True, f"Connected to {self.host}:{self.port} · Unit ID {self.unit_id}")
                self.log_message.emit("Modbus TCP communication established.")

            self.snapshot.emit({
                "coils": responses["coils"].bits[:5],
                "discrete_inputs": responses["discrete_inputs"].bits[:14],
                "holding_registers": responses["holding_registers"].registers[:5],
                "input_registers": responses["input_registers"].registers[:6],
            })
        except Exception as exc:
            self._disconnect(f"Communication error: {exc}")

    @Slot(int, bool)
    def write_coil(self, address: int, value: bool):
        self._write(lambda: self.client.write_coil(address, value, device_id=self.unit_id), f"Coil {address} = {int(value)}")

    @Slot(int, int)
    def write_register(self, address: int, value: int):
        self._write(lambda: self.client.write_register(address, value, device_id=self.unit_id), f"Holding register {address} = {value}")

    def _write(self, operation, description: str):
        if not self.connected or not self.client:
            self.log_message.emit("Command not sent: Modbus server is not connected.")
            return
        try:
            response = operation()
            if response.isError():
                raise RuntimeError(str(response))
            self.log_message.emit(f"Write accepted by Modbus server: {description}")
            self.poll()
        except Exception as exc:
            self._disconnect(f"Write failed: {exc}")
            self.log_message.emit(f"Modbus write failed: {exc}")
