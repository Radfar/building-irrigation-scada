"""Custom graphical process overview widgets."""

from PySide6.QtCore import Qt, QRectF
from PySide6.QtGui import QColor, QPainter, QPen, QBrush, QFont
from PySide6.QtWidgets import QWidget


class ProcessGraphic(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.level = 75.0
        self.flow = 0.0
        self.pump_running = False
        self.fault = False
        self.valve = 0.0
        self.communication_ok = False
        self.setMinimumHeight(260)

    def set_process(self, level, flow, pump_running, fault, valve, communication_ok):
        self.level = max(0.0, min(100.0, float(level)))
        self.flow = float(flow)
        self.pump_running = bool(pump_running)
        self.fault = bool(fault)
        self.valve = float(valve)
        self.communication_ok = bool(communication_ok)
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)
        painter.fillRect(self.rect(), QColor("#111827") if self.palette().color(self.backgroundRole()).lightness() < 128 else QColor("#f4f7fb"))
        dark = self.palette().color(self.backgroundRole()).lightness() < 128
        foreground = QColor("#e5edf7") if dark else QColor("#243247")
        muted = QColor("#94a3b8") if dark else QColor("#64748b")
        pipe = QColor("#64748b")
        water = QColor("#2696d6")
        ok = QColor("#22c55e")
        alarm = QColor("#ef4444")

        painter.setPen(QPen(pipe, 8, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap, Qt.PenJoinStyle.RoundJoin))
        painter.drawLine(230, 145, 330, 145)
        painter.drawLine(420, 145, 535, 145)
        painter.drawLine(535, 145, 535, 85)
        painter.drawLine(535, 85, 620, 85)

        tank = QRectF(35, 45, 155, 185)
        painter.setPen(QPen(foreground, 3))
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawRoundedRect(tank, 12, 12)
        inner = QRectF(43, 53 + (165 * (1 - self.level / 100)), 139, 165 * self.level / 100)
        painter.setPen(Qt.PenStyle.NoPen)
        painter.setBrush(QBrush(water))
        painter.drawRoundedRect(inner, 7, 7)
        painter.setPen(QPen(foreground, 1))
        painter.setFont(QFont("Segoe UI", 11, QFont.Weight.Bold))
        painter.drawText(QRectF(35, 12, 155, 25), Qt.AlignmentFlag.AlignCenter, "T-01  STORAGE TANK")
        painter.setFont(QFont("Segoe UI", 16, QFont.Weight.Bold))
        painter.drawText(QRectF(35, 105, 155, 35), Qt.AlignmentFlag.AlignCenter, f"{self.level:.1f}%")

        pump_color = alarm if self.fault else (ok if self.pump_running else muted)
        painter.setPen(QPen(pump_color, 4))
        painter.setBrush(QBrush(QColor("#1f2937") if dark else QColor("#ffffff")))
        painter.drawEllipse(QRectF(330, 105, 90, 80))
        painter.setPen(QPen(foreground, 2))
        painter.drawLine(355, 125, 395, 165)
        painter.drawLine(395, 125, 355, 165)
        painter.setPen(QPen(foreground, 1))
        painter.setFont(QFont("Segoe UI", 10, QFont.Weight.Bold))
        painter.drawText(QRectF(320, 195, 110, 22), Qt.AlignmentFlag.AlignCenter, "P-01  PUMP")
        painter.setPen(QPen(pump_color, 1))
        painter.drawText(QRectF(310, 218, 130, 20), Qt.AlignmentFlag.AlignCenter, "FAULT" if self.fault else ("RUNNING" if self.pump_running else "STOPPED"))

        valve_color = ok if self.valve > 0 else muted
        painter.setPen(QPen(valve_color, 3))
        painter.setBrush(Qt.BrushStyle.NoBrush)
        painter.drawPolygon([(535, 70), (555, 85), (535, 100), (515, 85)])
        painter.drawLine(535, 70, 535, 100)
        painter.setPen(QPen(foreground, 1))
        painter.setFont(QFont("Segoe UI", 10, QFont.Weight.Bold))
        painter.drawText(QRectF(490, 112, 90, 22), Qt.AlignmentFlag.AlignCenter, "V-01 VALVE")
        painter.setPen(QPen(muted, 1))
        painter.drawText(QRectF(485, 132, 100, 20), Qt.AlignmentFlag.AlignCenter, f"{self.valve:.1f}%")
        painter.setFont(QFont("Segoe UI", 10))
        painter.setPen(QPen(foreground, 1))
        painter.drawText(QRectF(600, 65, 130, 25), Qt.AlignmentFlag.AlignCenter, f"FLOW  {self.flow:.1f} L/min")
        painter.setPen(QPen(ok if self.communication_ok else alarm, 1))
        painter.drawText(QRectF(600, 95, 130, 22), Qt.AlignmentFlag.AlignCenter, "MODBUS ONLINE" if self.communication_ok else "NO COMMUNICATION")
        painter.end()
