"""Punto de entrada del motor empaquetado (lo usa PyInstaller)."""

import sys

from molino_engine.__main__ import main

if __name__ == "__main__":
    sys.exit(main())
