"""Certificados con clave para firmar en Linux: tarjetas y dispositivos, y los almacenes de Firefox y Chrome.

Lo que en Windows hace su almacen de certificados (``winstore``), en Linux lo
hacen dos fuentes, las dos a traves de PKCS#11 (``p11``):

* **Tarjetas y dispositivos**: los modulos que el sistema tiene registrados en
  p11-kit (OpenSC, para el DNIe y la mayoria de tarjetas; los de otros
  fabricantes se registran igual), todos a la vez a traves de p11-kit-proxy.
  Sin p11-kit, OpenSC directamente.
* **Firefox y Chrome/Chromium**: sus bases de datos de NSS (cert9.db y
  key4.db), con la biblioteca de NSS del sistema y en solo lectura. Es donde
  queda, por ejemplo, el certificado de la FNMT pedido con Firefox.

Listar no abre ninguna clave ni pide el PIN: solo lee certificados, que son
publicos. Para firmar, el PIN (o la contrasena principal de Firefox) lo
escribe el usuario en Molino y llega solo a este proceso; si el lector tiene
teclado propio, se escribe en el lector. Con el DNIe, ademas, OpenSC pide
confirmar cada firma en su propia ventana (pinentry), como exige la Policia.

Las autoridades de confianza son las del sistema (el paquete de certificados
de la distribucion), igual que en Windows son las de Windows: el motor no
mantiene una lista propia.

Seguridad: las bibliotecas se cargan solo de las carpetas del sistema y solo
si son de root y nadie mas puede modificarlas (``p11.trusted_library``);
ninguna ruta de biblioteca llega de fuera. Lo que devuelven los modulos y las
bases de datos se trata como dato no fiable (tamanos y numero acotados).
"""

from __future__ import annotations

import configparser
import hashlib
import logging
import os
import platform
import re
import threading
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from cryptography import x509
from cryptography.x509.oid import ExtendedKeyUsageOID

from ..errors import EngineError, invalid, not_found, unsupported
from ..i18n import _
from . import p11
from .winstore import TrustMaterial, thumbprint_of

log = logging.getLogger("molino.engine.sign.linuxstore")

MAX_CERT_BYTES = 256 * 1024
MAX_CERTS_PER_TOKEN = 1000
MAX_PROFILES = 8
MAX_CHAIN = 12
MAX_PIN_BYTES = 64
MAX_BUNDLE_BYTES = 8 * 1024 * 1024
MAX_ROOTS = 3000

# Prefijo DigestInfo de PKCS#1 v1.5 para cada resumen (RFC 8017, 9.2, nota 1):
# la tarjeta solo anade el relleno y firma (CKM_RSA_PKCS).
_DIGEST_INFO = {
    "sha256": bytes.fromhex("3031300d060960864801650304020105000420"),
    "sha384": bytes.fromhex("3041300d060960864801650304020205000430"),
    "sha512": bytes.fromhex("3051300d060960864801650304020305000440"),
}
_DIGEST_SIZES = {"sha256": 32, "sha384": 48, "sha512": 64}

# Los paquetes de autoridades de confianza de las distribuciones: el primero
# que exista (Debian, Ubuntu, Arch, Alpine; Fedora y RHEL; openSUSE; otros).
_BUNDLES = (
    "/etc/ssl/certs/ca-certificates.crt",
    "/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem",
    "/etc/ssl/ca-bundle.pem",
    "/etc/pki/tls/certs/ca-bundle.crt",
    "/etc/ssl/cert.pem",
)
# Fedora y RHEL separan ademas las de correo firmado, el uso mas parecido a
# firmar documentos: se suman si estan.
_EXTRA_BUNDLES = ("/etc/pki/ca-trust/extracted/pem/email-ca-bundle.pem",)
_PEM = re.compile(rb"-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]{16,400000}?)-----END CERTIFICATE-----")

# Usos ampliados con los que una persona firma (si el certificado declara alguno).
_PERSONAL_USES = {
    ExtendedKeyUsageOID.CLIENT_AUTH,
    ExtendedKeyUsageOID.EMAIL_PROTECTION,
    ExtendedKeyUsageOID.ANY_EXTENDED_KEY_USAGE,
    x509.ObjectIdentifier("1.3.6.1.4.1.311.10.3.12"),  # firma de documentos (Microsoft)
    x509.ObjectIdentifier("1.3.6.1.5.5.7.3.36"),  # firma de documentos (RFC 9336)
}


# -------------------------------------------------------------------- fuentes


@dataclass(frozen=True)
class Source:
    kind: str  # "cards", "firefox" o "chrome"
    library: str
    reserved: bytes | None = None  # parametros de inicio de NSS (la carpeta de la base de datos)


@dataclass(frozen=True, repr=False)
class LinuxCertificate:
    """Certificado con clave en una tarjeta, un dispositivo o un almacen NSS (solo datos publicos)."""

    der: bytes
    thumbprint: str
    where: str  # "card", "device", "firefox" o "chrome"
    pin: str  # "required" (PIN o contrasena), "pinpad" (en el lector) o "none"
    pin_state: str | None  # "low", "final" o "locked"; None si nada que avisar
    source: Source
    token: tuple[str, str, str, str]  # etiqueta, fabricante, modelo y numero de serie del token
    key_id: bytes
    related: tuple[bytes, ...]  # certificados de autoridad del mismo token o almacen

    @property
    def hardware(self) -> bool:
        return self.where == "card"

    def extras(self) -> dict[str, str | None]:
        return {"where": self.where, "pin": self.pin, "pinState": self.pin_state}

    def __repr__(self) -> str:
        return "<LinuxCertificate>"


@dataclass(frozen=True, repr=False)
class LoadedCertificate:
    item: LinuxCertificate
    chain: tuple[bytes, ...]  # emisores, del mas cercano a la raiz; sin el propio certificado
    untrusted: bool

    @property
    def der(self) -> bytes:
        return self.item.der

    @property
    def thumbprint(self) -> str:
        return self.item.thumbprint

    def __repr__(self) -> str:
        return "<LoadedCertificate>"


def _library_dirs() -> list[Path]:
    machine = platform.machine().lower()
    triplet = {"x86_64": "x86_64-linux-gnu", "amd64": "x86_64-linux-gnu", "aarch64": "aarch64-linux-gnu", "arm64": "aarch64-linux-gnu"}.get(machine)
    folders = [f"/usr/lib/{triplet}", f"/lib/{triplet}"] if triplet else []
    return [Path(folder) for folder in (*folders, "/usr/lib64", "/usr/lib", "/lib64", "/lib")]


def system_library(*names: str) -> str | None:
    """Ruta de una biblioteca del sistema (de root y no modificable por otros), o None."""
    for folder in _library_dirs():
        for name in names:
            path = folder / name
            if p11.trusted_library(str(path)):
                return str(path)
    return None


def _cards_library() -> str | None:
    return system_library("p11-kit-proxy.so", "pkcs11/p11-kit-proxy.so") or system_library(
        "opensc-pkcs11.so", "pkcs11/opensc-pkcs11.so"
    )


def _nss_library() -> str | None:
    return system_library("libsoftokn3.so", "nss/libsoftokn3.so")


def nss_parameters(folder: Path) -> bytes:
    """Parametros de inicio del modulo de NSS para abrir una base de datos en solo lectura."""
    text = str(folder)
    if not folder.is_absolute() or any(ord(ch) < 32 or ord(ch) == 127 for ch in text):
        raise ValueError("carpeta no valida")
    escaped = text.replace("\\", "\\\\").replace("'", "\\'")
    return (
        f"configdir='sql:{escaped}' certPrefix='' keyPrefix='' secmod='secmod.db' flags='readOnly,noModDB'"
    ).encode("utf-8")


def _home() -> Path | None:
    raw = os.environ.get("HOME", "")
    return Path(raw) if raw and os.path.isabs(raw) else None


def firefox_profiles(home: Path) -> list[Path]:
    """Perfiles de Firefox con base de datos de certificados, el predeterminado primero.

    Firefox normal, el de Snap (Ubuntu), el de Flatpak y la carpeta XDG de las
    versiones recientes.
    """
    config = os.environ.get("XDG_CONFIG_HOME", "")
    config_home = Path(config) if config and os.path.isabs(config) else home / ".config"
    roots = (
        home / ".mozilla" / "firefox",
        home / "snap" / "firefox" / "common" / ".mozilla" / "firefox",
        home / ".var" / "app" / "org.mozilla.firefox" / ".mozilla" / "firefox",
        config_home / "mozilla" / "firefox",
    )
    found: list[tuple[bool, Path]] = []
    for root in roots:
        ini = root / "profiles.ini"
        try:
            if ini.stat().st_size > 256 * 1024:
                continue
            text = ini.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        parser = configparser.ConfigParser(interpolation=None, strict=False)
        try:
            parser.read_string(text)
        except configparser.Error:
            continue
        defaults = {parser[name].get("Default", "") for name in parser.sections() if name.startswith("Install")}
        for name in parser.sections():
            if not name.startswith("Profile"):
                continue
            raw = parser[name].get("Path", "")
            if not raw or len(raw) > 1024:
                continue
            relative = parser[name].get("IsRelative", "1").strip() != "0"
            folder = root / raw if relative else Path(raw)
            if not folder.is_absolute():
                continue
            default = raw in defaults or parser[name].get("Default", "").strip() == "1"
            if (folder / "cert9.db").is_file() and (folder / "key4.db").is_file():
                found.append((not default, folder))
    out: list[Path] = []
    seen: set[str] = set()
    for _later, folder in sorted(found, key=lambda pair: pair[0]):
        try:
            key = str(folder.resolve())
        except OSError:
            continue
        if key not in seen:
            seen.add(key)
            out.append(folder)
    return out[:MAX_PROFILES]


def sources() -> list[Source]:
    """De donde se leen los certificados: tarjetas primero, luego Firefox y Chrome."""
    out: list[Source] = []
    cards = _cards_library()
    if cards:
        out.append(Source("cards", cards))
    nss = _nss_library()
    home = _home()
    if nss and home is not None:
        for profile in firefox_profiles(home):
            try:
                out.append(Source("firefox", nss, nss_parameters(profile)))
            except ValueError:
                continue
        chrome = home / ".pki" / "nssdb"
        if (chrome / "cert9.db").is_file() and (chrome / "key4.db").is_file():
            try:
                out.append(Source("chrome", nss, nss_parameters(chrome)))
            except ValueError:
                pass
    return out


# ------------------------------------------------------------------- listar


def _parse(der: bytes) -> x509.Certificate | None:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return x509.load_der_x509_certificate(der)
    except Exception:  # noqa: BLE001 - certificado ilegible: se omite
        return None


def _is_ca(cert: x509.Certificate) -> bool:
    try:
        return bool(cert.extensions.get_extension_for_class(x509.BasicConstraints).value.ca)
    except x509.ExtensionNotFound:
        return False
    except Exception:  # noqa: BLE001
        return True  # extensiones ilegibles: no se ofrece para firmar


def _personal(cert: x509.Certificate) -> bool:
    """Si parece el certificado de una persona (para cuando las claves no se ven sin el PIN)."""
    try:
        uses = set(cert.extensions.get_extension_for_class(x509.ExtendedKeyUsage).value)
    except x509.ExtensionNotFound:
        uses = None
    except Exception:  # noqa: BLE001
        return False
    if uses is not None and not uses & _PERSONAL_USES:
        return False  # por ejemplo, el de un servidor web
    try:
        usage = cert.extensions.get_extension_for_class(x509.KeyUsage).value
        return bool(usage.digital_signature or usage.content_commitment)
    except x509.ExtensionNotFound:
        return True
    except Exception:  # noqa: BLE001
        return False


def _pin_mode(flags: int) -> str:
    if flags & p11.CKF_PROTECTED_AUTHENTICATION_PATH:
        return "pinpad"
    if flags & p11.CKF_LOGIN_REQUIRED:
        return "required"
    return "none"


def _pin_state(flags: int) -> str | None:
    if flags & p11.CKF_USER_PIN_LOCKED:
        return "locked"
    if flags & p11.CKF_USER_PIN_FINAL_TRY:
        return "final"
    if flags & p11.CKF_USER_PIN_COUNT_LOW:
        return "low"
    return None


def _token_certificates(
    lib: p11.Library, session: int, source: Source, slot: p11.SlotInfo, token: p11.TokenInfo
) -> list[LinuxCertificate]:
    handles = lib.find(session, {p11.CKA_CLASS: p11.CKO_CERTIFICATE, p11.CKA_CERTIFICATE_TYPE: p11.CKC_X_509})
    key_ids = {lib.attribute(session, handle, p11.CKA_ID) for handle in lib.find(session, {p11.CKA_CLASS: p11.CKO_PRIVATE_KEY})}
    key_ids.discard(None)
    key_ids.discard(b"")
    # Sin la sesion iniciada, muchos tokens no dejan ver sus claves: entonces se
    # ofrecen los certificados personales con identificador, y al firmar se
    # comprueba que la clave exista.
    hidden = bool(token.flags & p11.CKF_LOGIN_REQUIRED) and not key_ids
    if source.kind == "cards":
        where = "card" if slot.flags & (p11.CKF_HW_SLOT | p11.CKF_REMOVABLE_DEVICE) else "device"
    else:
        where = source.kind
    mine: list[tuple[bytes, bytes]] = []
    authorities: list[bytes] = []
    for handle in handles[:MAX_CERTS_PER_TOKEN]:
        der = lib.attribute(session, handle, p11.CKA_VALUE)
        if not der or len(der) > MAX_CERT_BYTES:
            continue
        cert = _parse(der)
        if cert is None:
            continue
        if _is_ca(cert):
            authorities.append(der)
            continue
        key_id = lib.attribute(session, handle, p11.CKA_ID) or b""
        if key_id in key_ids or (hidden and key_id and _personal(cert)):
            mine.append((der, key_id))
    related = tuple(authorities[:200])
    return [
        LinuxCertificate(
            der, thumbprint_of(der), where, _pin_mode(token.flags), _pin_state(token.flags), source, token.identity,
            key_id, related,
        )
        for der, key_id in mine
    ]


def _scan(source: Source) -> list[LinuxCertificate]:
    lib = p11.Library.load(source.library)
    out: list[LinuxCertificate] = []
    with lib.initialized(source.reserved):
        for slot in lib.slots():
            try:
                slot_info = lib.slot_info(slot)
                token = lib.token_info(slot)
                if token.model == "p11-kit-trust":
                    continue  # las autoridades del sistema, sin claves
                with lib.session(slot) as session:
                    out.extend(_token_certificates(lib, session, source, slot_info, token))
            except p11.P11Error as exc:
                log.info("no se pudo leer un token (%s 0x%08X)", exc.where, exc.rv)
    return out


_cache: dict[str, LinuxCertificate] = {}
_cache_lock = threading.Lock()


def list_certificates() -> list[LinuxCertificate]:
    """Certificados con clave (o que pueden tenerla tras el PIN), sin repetir, en orden de fuente."""
    found: list[LinuxCertificate] = []
    seen: set[str] = set()
    for source in sources():
        try:
            items = _scan(source)
        except (OSError, p11.P11Error) as exc:
            # Una fuente que falla no impide ver las demas.
            log.info("no se pudo leer una fuente de certificados (%s: %s)", source.kind, type(exc).__name__)
            continue
        for item in items:
            if item.thumbprint not in seen:
                seen.add(item.thumbprint)
                found.append(item)
    with _cache_lock:
        _cache.clear()
        _cache.update({item.thumbprint: item for item in found})
    return found


def _find(thumbprint: str) -> LinuxCertificate:
    with _cache_lock:
        item = _cache.get(thumbprint)
    if item is None:
        list_certificates()
        with _cache_lock:
            item = _cache.get(thumbprint)
    if item is None:
        raise not_found(_("El certificado ya no está disponible. Si está en una tarjeta, comprueba que sigue en el lector."))
    return item


# ---------------------------------------------------------------- confianza


_trust_lock = threading.Lock()
_trust_cache: tuple[tuple[tuple[str, int, int], ...], TrustMaterial] | None = None


def _bundle_paths() -> list[str]:
    main = next((path for path in _BUNDLES if os.path.isfile(path)), None)
    return [*([main] if main else []), *(path for path in _EXTRA_BUNDLES if os.path.isfile(path))]


def _read_bundle(path: str) -> list[bytes]:
    import base64

    try:
        with open(path, "rb") as handle:
            data = handle.read(MAX_BUNDLE_BYTES + 1)
    except OSError:
        return []
    if len(data) > MAX_BUNDLE_BYTES:
        log.warning("el paquete de autoridades del sistema es demasiado grande; se ignora")
        return []
    out: list[bytes] = []
    for match in _PEM.finditer(data):
        try:
            out.append(base64.b64decode(b"".join(match.group(1).split()), validate=True))
        except ValueError:
            continue
        if len(out) >= MAX_ROOTS:
            break
    return out


def trust_material() -> TrustMaterial:
    """Autoridades en las que confia el sistema (su paquete de certificados raiz), solo leidas.

    Se instalan con las herramientas de la distribucion (``update-ca-certificates``
    o ``update-ca-trust``), y lo que el sistema retira deja de valer aqui tambien.
    No hay intermedios: Linux no tiene un almacen de ellos; las firmas los llevan.
    """
    global _trust_cache
    paths = _bundle_paths()
    stamp: list[tuple[str, int, int]] = []
    for path in paths:
        try:
            info = os.stat(path)
            stamp.append((path, info.st_mtime_ns, info.st_size))
        except OSError:
            continue
    key = tuple(stamp)
    with _trust_lock:
        if _trust_cache is not None and _trust_cache[0] == key:
            return _trust_cache[1]
    seen: set[bytes] = set()
    roots: list[bytes] = []
    for path in paths:
        for der in _read_bundle(path):
            digest = hashlib.sha256(der).digest()
            if digest not in seen:
                seen.add(digest)
                roots.append(der)
    material = TrustMaterial(tuple(roots), ())
    with _trust_lock:
        _trust_cache = (key, material)
    return material


def build_chain(leaf: bytes, pool: Iterable[bytes], roots: Iterable[bytes]) -> tuple[tuple[bytes, ...], bool]:
    """Emisores de ``leaf`` hasta una raiz, comprobando cada firma, y si esa raiz es de confianza.

    ``pool`` son otros certificados de autoridad conocidos (los del mismo token o
    almacen); ``roots``, las raices de confianza. Sin red: solo con lo que hay.
    """
    root_digests: set[bytes] = set()
    by_subject: dict[x509.Name, list[tuple[bytes, x509.Certificate, bool]]] = {}
    for items, trusted in ((roots, True), (pool, False)):
        for der in items:
            cert = _parse(der)
            if cert is None:
                continue
            if trusted:
                root_digests.add(hashlib.sha256(der).digest())
            by_subject.setdefault(cert.subject, []).append((der, cert, trusted))
    current = _parse(leaf)
    if current is None:
        return (), False
    chain: list[bytes] = []
    seen = {hashlib.sha256(leaf).digest()}
    for _step in range(MAX_CHAIN):
        if current.issuer == current.subject:
            break  # autofirmado: no hay mas arriba
        candidates = sorted(by_subject.get(current.issuer, []), key=lambda entry: not entry[2])
        issuer = None
        for der, cert, _trusted in candidates:
            digest = hashlib.sha256(der).digest()
            if digest in seen:
                continue
            try:
                current.verify_directly_issued_by(cert)
            except Exception:  # noqa: BLE001 - no es su emisor (o una clave que no se sabe comprobar)
                continue
            issuer = (der, cert, digest)
            break
        if issuer is None:
            break
        der, cert, digest = issuer
        chain.append(der)
        seen.add(digest)
        if digest in root_digests:
            return tuple(chain), True
        current = cert
    return tuple(chain), False


def load_certificate(thumbprint: str) -> LoadedCertificate:
    """El certificado elegido, con su cadena de emisores y si llega a una autoridad de confianza."""
    item = _find(thumbprint)
    chain, trusted = build_chain(item.der, item.related, trust_material().roots)
    return LoadedCertificate(item, chain, not trusted)


# -------------------------------------------------------------------- firmar


def _nss(item: LinuxCertificate) -> bool:
    return item.source.kind in ("firefox", "chrome")


def _pin_error(rv: int, flags: int, item: LinuxCertificate) -> EngineError:
    log.warning("el token no acepto el PIN (0x%08X)", rv)
    if rv == p11.CKR_PIN_LOCKED or flags & p11.CKF_USER_PIN_LOCKED:
        return EngineError("pin_blocked", _("El PIN está bloqueado. Desbloquéalo con el programa de tu tarjeta o dispositivo."))
    if rv == p11.CKR_PIN_EXPIRED:
        return EngineError("pin_expired", _("El PIN ha caducado. Cámbialo con el programa de tu tarjeta o dispositivo."))
    if _nss(item):
        return EngineError("wrong_pin", _("La contraseña principal no es correcta."))
    if flags & p11.CKF_USER_PIN_FINAL_TRY:
        return EngineError(
            "wrong_pin", _("El PIN no es correcto. Te queda un solo intento: si vuelves a fallar, se bloqueará."), pinState="final"
        )
    if flags & p11.CKF_USER_PIN_COUNT_LOW:
        return EngineError("wrong_pin", _("El PIN no es correcto. Te quedan pocos intentos antes de que se bloquee."), pinState="low")
    return EngineError("wrong_pin", _("El PIN no es correcto."))


def _key_error(exc: p11.P11Error) -> EngineError:
    rv = exc.rv
    log.warning("el token no completo la operacion con la clave (%s 0x%08X)", exc.where, rv)
    if rv in (p11.CKR_CANCEL, p11.CKR_FUNCTION_CANCELED, p11.CKR_FUNCTION_REJECTED):
        return EngineError("cancelled", _("Se ha cancelado el uso de la clave del certificado."))
    if rv in (p11.CKR_TOKEN_NOT_PRESENT, p11.CKR_DEVICE_REMOVED, p11.CKR_SLOT_ID_INVALID, p11.CKR_TOKEN_NOT_RECOGNIZED,
              p11.CKR_SESSION_CLOSED, p11.CKR_SESSION_HANDLE_INVALID):
        return EngineError(
            "device_missing", _("No se encuentra la tarjeta o el dispositivo que guarda la clave de este certificado.")
        )
    if rv in (p11.CKR_KEY_FUNCTION_NOT_PERMITTED, p11.CKR_MECHANISM_INVALID, p11.CKR_MECHANISM_PARAM_INVALID,
              p11.CKR_KEY_TYPE_INCONSISTENT, p11.CKR_FUNCTION_NOT_SUPPORTED):
        return unsupported(_("La tarjeta o el dispositivo no permite firmar con la clave de este certificado."))
    if rv in (p11.CKR_USER_NOT_LOGGED_IN, p11.CKR_USER_PIN_NOT_INITIALIZED):
        return EngineError("pin_required", _("Escribe el PIN para firmar con este certificado."))
    return EngineError(
        "sign_failed", _("La tarjeta o el dispositivo no pudo firmar con la clave de este certificado."), status=f"0x{rv:08X}"
    )


def _slot_of(lib: p11.Library, token: tuple[str, str, str, str]) -> int:
    for slot in lib.slots():
        try:
            if lib.token_info(slot).identity == token:
                return slot
        except p11.P11Error:
            continue
    raise EngineError("device_missing", _("No se encuentra la tarjeta o el dispositivo que guarda la clave de este certificado."))


def _private_key(lib: p11.Library, session: int, item: LinuxCertificate) -> int:
    if item.key_id:
        found = lib.find(session, {p11.CKA_CLASS: p11.CKO_PRIVATE_KEY, p11.CKA_ID: item.key_id})
        if found:
            return found[0]
    # Sin identificador que coincida: por la clave publica (RSA), si la hay.
    cert = _parse(item.der)
    public = cert.public_key() if cert is not None else None
    modulus = getattr(public.public_numbers(), "n", None) if public is not None and hasattr(public, "public_numbers") else None
    if isinstance(modulus, int):
        for handle in lib.find(session, {p11.CKA_CLASS: p11.CKO_PRIVATE_KEY}):
            value = lib.attribute(session, handle, p11.CKA_MODULUS)
            if value and int.from_bytes(value, "big") == modulus:
                return handle
    raise EngineError("key_unavailable", _("No se encuentra la clave privada de este certificado."))


def sign_digest(
    item: LinuxCertificate, digest: bytes, *, hash_name: str, key_kind: str, pin: bytearray | None = None
) -> bytes:
    """Firma un resumen ya calculado con la clave del certificado (PKCS#1 v1.5, o ``r || s`` en ECDSA).

    El PIN llega en un ``bytearray`` que borra quien llama. Se inicia la sesion
    del token solo para esta firma y se cierra al terminar, pase lo que pase.
    """
    if hash_name not in _DIGEST_INFO or key_kind not in ("rsa", "ec"):
        raise unsupported(_("Algoritmo de resumen no admitido."))
    if not isinstance(digest, bytes) or len(digest) != _DIGEST_SIZES[hash_name]:
        raise EngineError("internal", _("El resumen que se iba a firmar no tiene el tamaño esperado."))
    if pin is not None and len(pin) > MAX_PIN_BYTES:
        raise invalid(_("Parámetros no válidos."))
    try:
        lib = p11.Library.load(item.source.library)
    except (OSError, p11.P11Error):
        raise EngineError("store_unavailable", _("No se pudo abrir el módulo de las tarjetas o del almacén de certificados.")) from None
    data = _DIGEST_INFO[hash_name] + digest if key_kind == "rsa" else digest
    mechanism = p11.CKM_RSA_PKCS if key_kind == "rsa" else p11.CKM_ECDSA
    try:
        with lib.initialized(item.source.reserved):
            slot = _slot_of(lib, item.token)
            token = lib.token_info(slot)
            pinpad = bool(token.flags & p11.CKF_PROTECTED_AUTHENTICATION_PATH)
            with lib.session(slot) as session:
                logged = False
                try:
                    if pinpad or token.flags & p11.CKF_LOGIN_REQUIRED:
                        if not pinpad and not pin:
                            if _nss(item):
                                raise EngineError("pin_required", _("Escribe la contraseña principal para firmar con este certificado."))
                            raise EngineError("pin_required", _("Escribe el PIN para firmar con este certificado."))
                        if not pinpad and pin is not None and (
                            (token.min_pin and len(pin) < token.min_pin) or (token.max_pin and len(pin) > token.max_pin)
                        ):
                            # Sin gastar un intento: el token lo rechazaria igualmente.
                            raise EngineError(
                                "wrong_pin",
                                _("El PIN debe tener entre {minimum} y {maximum} caracteres.", minimum=token.min_pin or 1,
                                  maximum=token.max_pin or MAX_PIN_BYTES),
                            )
                        try:
                            lib.login(session, None if pinpad else pin)
                        except p11.P11Error as exc:
                            if exc.rv in (p11.CKR_PIN_INCORRECT, p11.CKR_PIN_INVALID, p11.CKR_PIN_LEN_RANGE,
                                          p11.CKR_PIN_LOCKED, p11.CKR_PIN_EXPIRED):
                                raise _pin_error(exc.rv, lib.token_info(slot).flags, item) from None
                            raise
                        logged = True
                    key = _private_key(lib, session, item)
                    again = lib.flag(session, key, p11.CKA_ALWAYS_AUTHENTICATE)
                    lib.sign_init(session, key, mechanism)
                    if again:
                        # La clave pide el PIN otra vez para cada firma.
                        try:
                            lib.login(session, None if pinpad else pin, user=p11.CKU_CONTEXT_SPECIFIC)
                        except p11.P11Error as exc:
                            if exc.rv in (p11.CKR_PIN_INCORRECT, p11.CKR_PIN_INVALID, p11.CKR_PIN_LOCKED):
                                raise _pin_error(exc.rv, lib.token_info(slot).flags, item) from None
                            raise
                    return lib.sign(session, data)
                finally:
                    if logged:
                        lib.logout(session)
    except p11.P11Error as exc:
        raise _key_error(exc) from None
