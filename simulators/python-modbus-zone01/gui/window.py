"""Main PySide6 window for the Zone 01 Python Modbus simulator."""

import os
import sys
from pathlib import Path

from PySide6.QtCore import Qt, QProcess, QThread, Signal
from PySide6.QtGui import QFont
from PySide6.QtWidgets import (
    QCheckBox, QDoubleSpinBox, QFormLayout, QGridLayout, QGroupBox,
    QHBoxLayout, QLabel, QMainWindow, QMessageBox, QPushButton,
    QPlainTextEdit, QVBoxLayout, QWidget,
)

from .modbus_worker import ModbusWorker
from .widgets import ProcessGraphic

SIMULATOR_ROOT = Path(__file__).resolve().parents[1]


class SimulatorWindow(QMainWindow):
    command_coil = Signal(int, bool)
    command_register = Signal(int, int)
    shutdown_worker = Signal()

    def __init__(self):
        super().__init__()
        self.setWindowTitle("Industrial Water Management | Zone 01 Simulator")
        self.resize(1120, 790)
        self.server_process = QProcess(self)
        self.server_process.setWorkingDirectory(str(SIMULATOR_ROOT))
        self.server_process.readyReadStandardOutput.connect(self._read_stdout)
        self.server_process.readyReadStandardError.connect(self._read_stderr)
        self.server_process.started.connect(self._server_started)
        self.server_process.finished.connect(self._server_finished)
        self.server_process.errorOccurred.connect(self._server_error)

        self.worker_thread = QThread(self)
        self.worker = ModbusWorker()
        self.worker.moveToThread(self.worker_thread)
        self.worker_thread.started.connect(self.worker.start)
        self.worker.snapshot.connect(self._update_snapshot)
        self.worker.connection_changed.connect(self._connection_changed)
        self.worker.log_message.connect(self._append_log)
        self.command_coil.connect(self.worker.write_coil)
        self.command_register.connect(self.worker.write_register)
        self.shutdown_worker.connect(self.worker.stop)
        self.worker_thread.start()

        self._build_ui()
        self._append_log("GUI initialized. Start the simulator to begin monitoring.")

    def _build_ui(self):
        root = QWidget()
        root.setObjectName("root")
        layout = QVBoxLayout(root)
        layout.setContentsMargins(20, 18, 20, 18)
        layout.setSpacing(14)

        header = QHBoxLayout()
        title = QLabel("ZONE 01  |  WATER TANK SIMULATOR")
        title.setObjectName("pageTitle")
        header.addWidget(title)
        header.addStretch(1)
        self.server_status = QLabel("SIMULATOR STOPPED")
        self.server_status.setObjectName("statusOffline")
        header.addWidget(self.server_status)
        layout.addLayout(header)

        toolbar = QHBoxLayout()
        self.start_button = QPushButton("Start Simulator")
        self.start_button.setObjectName("primaryButton")
        self.start_button.clicked.connect(self.start_simulator)
        self.stop_button = QPushButton("Stop Simulator")
        self.stop_button.clicked.connect(self.stop_simulator)
        self.stop_button.setEnabled(False)
        toolbar.addWidget(self.start_button)
        toolbar.addWidget(self.stop_button)
        toolbar.addStretch(1)
        self.connection_status = QLabel("MODBUS OFFLINE  |  127.0.0.1:1502  |  UNIT ID 1")
        self.connection_status.setObjectName("statusOffline")
        toolbar.addWidget(self.connection_status)
        layout.addLayout(toolbar)

        self.graphic = ProcessGraphic()
        graphic_box = QGroupBox("LIVE PROCESS OVERVIEW")
        graphic_layout = QVBoxLayout(graphic_box)
        graphic_layout.addWidget(self.graphic)
        layout.addWidget(graphic_box)

        grid = QGridLayout()
        grid.setSpacing(12)
        self.value_labels = {}
        measurement_box = QGroupBox("PROCESS MEASUREMENTS")
        measurement_grid = QGridLayout(measurement_box)
        measurements = [("Tank level", "tank", "%"), ("Flow rate", "flow", "L/min"), ("Pump frequency", "frequency", "Hz"), ("Pump speed", "speed", "%"), ("Pump current", "current", "A"), ("Valve position", "valve", "%")]
        for index, (label, key, unit) in enumerate(measurements):
            cell = QVBoxLayout()
            name = QLabel(label.upper())
            name.setObjectName("metricLabel")
            value = QLabel("--")
            value.setObjectName("metricValue")
            unit_label = QLabel(unit)
            unit_label.setObjectName("mutedLabel")
            cell.addWidget(name)
            cell.addWidget(value)
            cell.addWidget(unit_label)
            measurement_grid.addLayout(cell, index // 3, index % 3)
            self.value_labels[key] = value
        grid.addWidget(measurement_box, 0, 0)

        status_box = QGroupBox("CONTROLLER STATUS")
        status_layout = QFormLayout(status_box)
        self.status_labels = {}
        for key, label in [("running", "Pump running"), ("mode", "Operating mode"), ("permissive", "Process permissive"), ("fault", "Zone fault"), ("low_flow", "Low-flow trip"), ("stop_latched", "Operator STOP latch"), ("process_ok", "Process healthy")]:
            value = QLabel("NO DATA")
            value.setObjectName("stateUnknown")
            status_layout.addRow(label, value)
            self.status_labels[key] = value
        grid.addWidget(status_box, 0, 1)
        layout.addLayout(grid)

        bottom = QGridLayout()
        control_box = QGroupBox("OPERATOR COMMANDS")
        control_layout = QGridLayout(control_box)
        self.auto_check = QCheckBox("AUTO mode (unchecked = MANUAL)")
        self.auto_check.toggled.connect(lambda checked: self.command_coil.emit(0, checked))
        control_layout.addWidget(self.auto_check, 0, 0, 1, 2)
        command_specs = [("START", 1), ("STOP", 2), ("FAULT RESET", 3), ("RE-ENABLE", 4)]
        for index, (label, address) in enumerate(command_specs):
            button = QPushButton(label)
            button.clicked.connect(lambda _checked=False, a=address: self.command_coil.emit(a, True))
            control_layout.addWidget(button, 1 + index // 2, index % 2)
        bottom.addWidget(control_box, 0, 0)

        setpoint_box = QGroupBox("PROCESS SETPOINTS  |  WRITE TO HOLDING REGISTERS")
        setpoint_layout = QFormLayout(setpoint_box)
        self.setpoint_controls = []
        for label, address, maximum, suffix in [("Pump frequency", 0, 50.0, " Hz"), ("Valve position", 1, 100.0, " %"), ("Low-flow threshold", 2, 100.0, " L/min"), ("Tank low threshold", 3, 100.0, " %"), ("Tank high threshold", 4, 100.0, " %")]:
            spin = QDoubleSpinBox()
            spin.setRange(0.0, maximum)
            spin.setDecimals(1)
            spin.setSingleStep(1.0)
            spin.setSuffix(suffix)
            apply_button = QPushButton("Write")
            apply_button.setMaximumWidth(70)
            apply_button.clicked.connect(lambda _checked=False, a=address, s=spin: self.command_register.emit(a, round(s.value() * 10)))
            row = QHBoxLayout()
            row.addWidget(spin)
            row.addWidget(apply_button)
            setpoint_layout.addRow(label, row)
            self.setpoint_controls.append(spin)
        bottom.addWidget(setpoint_box, 0, 1)
        layout.addLayout(bottom)

        log_box = QGroupBox("SIMULATOR / COMMUNICATION EVENT LOG")
        log_layout = QVBoxLayout(log_box)
        self.log = QPlainTextEdit()
        self.log.setReadOnly(True)
        self.log.setMaximumBlockCount(500)
        self.log.setMaximumHeight(130)
        log_layout.addWidget(self.log)
        layout.addWidget(log_box)

        self.setCentralWidget(root)
        self.setStyleSheet("""
            QWidget#root { background: #0b1220; color: #e5edf7; font-family: 'Segoe UI'; }
            QLabel#pageTitle { color: #f8fafc; font-size: 21px; font-weight: 700; }
            QGroupBox { border: 1px solid #334155; border-radius: 9px; margin-top: 10px; padding: 12px; font-weight: 700; color: #cbd5e1; }
            QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 5px; }
            QLabel#metricLabel, QLabel#mutedLabel { color: #94a3b8; font-size: 10px; font-weight: 600; }
            QLabel#metricValue { color: #f8fafc; font-size: 23px; font-weight: 700; }
            QLabel#statusOnline { color: #4ade80; font-weight: 700; }
            QLabel#statusOffline { color: #f87171; font-weight: 700; }
            QLabel#stateGood { color: #4ade80; font-weight: 700; }
            QLabel#stateBad { color: #f87171; font-weight: 700; }
            QLabel#stateUnknown { color: #94a3b8; font-weight: 600; }
            QPushButton { background: #263449; border: 1px solid #475569; border-radius: 6px; padding: 8px 13px; color: #f8fafc; font-weight: 600; }
            QPushButton:hover { background: #334b68; }
            QPushButton:disabled { color: #64748b; background: #172033; }
            QPushButton#primaryButton { background: #087e8b; border-color: #0e9aa7; }
            QDoubleSpinBox { background: #111c2e; border: 1px solid #475569; border-radius: 5px; padding: 5px; color: #f8fafc; }
            QPlainTextEdit { background: #080e19; border: 1px solid #263449; border-radius: 6px; color: #a7f3d0; font-family: Consolas; font-size: 11px; }
            QCheckBox { color: #e2e8f0; font-weight: 600; }
        """)

    def start_simulator(self):
        if self.server_process.state() != QProcess.ProcessState.NotRunning:
            return
        program = sys.executable
        self.server_process.setProgram(program)
        self.server_process.setArguments(["-m", "src.main"])
        self.server_process.start()
        self._append_log("Starting Python Modbus TCP simulator process...")
        self.start_button.setEnabled(False)

    def stop_simulator(self):
        if self.server_process.state() == QProcess.ProcessState.NotRunning:
            return
        self._append_log("Stopping simulator process...")
        self.server_process.terminate()
        if not self.server_process.waitForFinished(2500):
            self.server_process.kill()

    def _server_started(self):
        self.server_status.setText("SIMULATOR PROCESS RUNNING")
        self.server_status.setObjectName("statusOnline")
        self.server_status.style().unpolish(self.server_status)
        self.server_status.style().polish(self.server_status)
        self.stop_button.setEnabled(True)
        self._append_log("Python simulator process started.")

    def _server_finished(self, exit_code, exit_status):
        self.start_button.setEnabled(True)
        self.stop_button.setEnabled(False)
        self.server_status.setText("SIMULATOR STOPPED")
        self.server_status.setObjectName("statusOffline")
        self.server_status.style().unpolish(self.server_status)
        self.server_status.style().polish(self.server_status)
        self._append_log(f"Simulator process exited (code {exit_code}).")

    def _server_error(self, error):
        self.start_button.setEnabled(True)
        self._append_log(f"Simulator process error: {error}")

    def _read_stdout(self):
        data = bytes(self.server_process.readAllStandardOutput()).decode(errors="replace").strip()
        if data:
            for line in data.splitlines():
                self._append_log(f"[SIM] {line}")

    def _read_stderr(self):
        data = bytes(self.server_process.readAllStandardError()).decode(errors="replace").strip()
        if data:
            for line in data.splitlines():
                self._append_log(f"[SIM ERROR] {line}")

    def _connection_changed(self, connected, message):
        self.connection_status.setText(("MODBUS ONLINE  |  " if connected else "MODBUS OFFLINE  |  ") + message)
        self.connection_status.setObjectName("statusOnline" if connected else "statusOffline")
        self.connection_status.style().unpolish(self.connection_status)
        self.connection_status.style().polish(self.connection_status)
        if not connected:
            self.graphic.set_process(0, 0, False, False, 0, False)
            for label in self.value_labels.values():
                label.setText("--")
            for label in self.status_labels.values():
                label.setText("NO DATA")
                label.setObjectName("stateUnknown")
                label.style().unpolish(label)
                label.style().polish(label)

    def _update_snapshot(self, data):
        di = data["discrete_inputs"]
        hr = data["holding_registers"]
        ir = data["input_registers"]
        tank, flow, frequency, speed, valve, current = [value / 10 for value in ir]
        self.value_labels["tank"].setText(f"{tank:.1f}")
        self.value_labels["flow"].setText(f"{flow:.1f}")
        self.value_labels["frequency"].setText(f"{frequency:.1f}")
        self.value_labels["speed"].setText(f"{speed:.1f}")
        self.value_labels["valve"].setText(f"{valve:.1f}")
        self.value_labels["current"].setText(f"{current:.1f}")
        self.graphic.set_process(tank, flow, di[1], di[2], valve, True)

        states = {
            "running": (di[1], "RUNNING" if di[1] else "STOPPED"),
            "mode": (True, "AUTO" if di[5] else "MANUAL"),
            "permissive": (di[3], "AVAILABLE" if di[3] else "NOT AVAILABLE"),
            "fault": (not di[2], "FAULT" if di[2] else "HEALTHY"),
            "low_flow": (not di[7], "TRIPPED" if di[7] else "NORMAL"),
            "stop_latched": (not di[13], "LATCHED" if di[13] else "RELEASED"),
            "process_ok": (di[8], "HEALTHY" if di[8] else "NOT HEALTHY"),
        }
        for key, (good, text) in states.items():
            label = self.status_labels[key]
            label.setText(text)
            label.setObjectName("stateGood" if good else "stateBad")
            label.style().unpolish(label)
            label.style().polish(label)

        if not self.auto_check.hasFocus() and self.auto_check.isChecked() != bool(data["coils"][0]):
            self.auto_check.blockSignals(True)
            self.auto_check.setChecked(bool(data["coils"][0]))
            self.auto_check.blockSignals(False)
        for index, spin in enumerate(self.setpoint_controls):
            if not spin.hasFocus():
                value = hr[index] / 10
                if abs(spin.value() - value) > 0.04:
                    spin.blockSignals(True)
                    spin.setValue(value)
                    spin.blockSignals(False)

    def _append_log(self, message):
        from datetime import datetime
        self.log.appendPlainText(f"{datetime.now().strftime('%H:%M:%S')}  {message}")

    def closeEvent(self, event):
        if self.server_process.state() != QProcess.ProcessState.NotRunning:
            self.server_process.terminate()
            if not self.server_process.waitForFinished(2000):
                self.server_process.kill()
        self.shutdown_worker.emit()
        self.worker_thread.quit()
        self.worker_thread.wait(2000)
        event.accept()
