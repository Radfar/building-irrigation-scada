"""Launch the Zone 01 simulator desktop GUI."""

import sys
from PySide6.QtWidgets import QApplication

from .window import SimulatorWindow


def main() -> int:
    app = QApplication(sys.argv)
    app.setApplicationName("Industrial Water - Zone 01 Simulator")
    app.setOrganizationName("Industrial Water Management")
    window = SimulatorWindow()
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
