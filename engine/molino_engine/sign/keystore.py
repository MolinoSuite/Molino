"""Los certificados del sistema para firmar, en cada sistema: Windows (``winstore``) o Linux (``linuxstore``).

Una sola forma para quien los usa (el intermediario y, sin aislamiento, el
propio motor): listar, cargar uno con su cadena, firmar un resumen y leer las
autoridades de confianza.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from typing import Any

from . import winstore

WINDOWS = sys.platform == "win32"


@dataclass(frozen=True, repr=False)
class Listed:
    der: bytes
    hardware: bool | None
    extras: dict[str, Any]

    def __repr__(self) -> str:
        return "<Listed>"


@dataclass(frozen=True, repr=False)
class Loaded:
    der: bytes
    thumbprint: str
    chain: tuple[bytes, ...]
    untrusted: bool
    handle: Any  # lo que necesita ``sign_digest`` para encontrar la clave

    def __repr__(self) -> str:
        return "<Loaded>"


def list_certificates() -> list[Listed]:
    if WINDOWS:
        return [Listed(item.der, item.hardware, {}) for item in winstore.list_certificates()]
    from . import linuxstore

    return [Listed(item.der, item.hardware, item.extras()) for item in linuxstore.list_certificates()]


def load_certificate(thumbprint: str) -> Loaded:
    if WINDOWS:
        certificate = winstore.load_certificate(thumbprint)
        untrusted = bool(certificate.chain_errors is not None and certificate.chain_errors & winstore.CHAIN_NOT_TRUSTED_MASK)
        return Loaded(certificate.der, certificate.thumbprint, tuple(certificate.chain), untrusted, certificate.thumbprint)
    from . import linuxstore

    loaded = linuxstore.load_certificate(thumbprint)
    return Loaded(loaded.der, loaded.thumbprint, loaded.chain, loaded.untrusted, loaded.item)


def sign_digest(
    loaded: Loaded, digest: bytes, *, hash_name: str, key_kind: str, hwnd: int | None = None, pin: bytearray | None = None
) -> bytes:
    """Firma tal como la da el algoritmo: PKCS#1 v1.5 en RSA y ``r || s`` en ECDSA."""
    if WINDOWS:
        return winstore.sign_digest(loaded.handle, digest, hash_name=hash_name, key_kind=key_kind, hwnd=hwnd)
    from . import linuxstore

    return linuxstore.sign_digest(loaded.handle, digest, hash_name=hash_name, key_kind=key_kind, pin=pin)


def trust_material() -> winstore.TrustMaterial:
    if WINDOWS:
        return winstore.trust_material()
    from . import linuxstore

    return linuxstore.trust_material()
