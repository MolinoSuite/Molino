"""PKCS#11 (Cryptoki 2.40) con ctypes: lo justo para listar certificados y firmar un resumen.

Lo usa ``linuxstore`` para el DNIe y las demas tarjetas (a traves de los
modulos que el sistema registra en p11-kit, OpenSC entre ellos) y para los
almacenes NSS de Firefox y Chrome. Sin dependencias: solo las funciones que
hacen falta, con sus tipos declarados.

Solo para Linux (y macOS mas adelante): alli ``CK_ULONG`` es ``unsigned long``
y las estructuras llevan la alineacion natural. En Windows serian de 1 byte y
``unsigned long`` mide 4; alli firma ``winstore``.

Seguridad:

* Una biblioteca PKCS#11 es codigo que se carga en este proceso. Solo se
  cargan las rutas que decide ``linuxstore`` (carpetas del sistema, archivos de
  root no modificables por otros), nunca una que llegue de fuera (A08:2025).
* Lo que devuelve el modulo se trata como dato no fiable: tamanos acotados,
  numero de objetos acotado y textos limpiados antes de usarlos.
* El PIN se pasa desde un ``bytearray`` que quien llama borra al terminar; no
  se copia a ninguna cadena ni aparece en logs o excepciones.
"""

from __future__ import annotations

import ctypes
import logging
import os
import stat
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Iterator

log = logging.getLogger("molino.engine.sign.p11")

CK_ULONG = ctypes.c_ulong
CK_RV = CK_ULONG
CK_BBOOL = ctypes.c_ubyte
UNAVAILABLE = CK_ULONG(-1).value  # CK_UNAVAILABLE_INFORMATION

# Codigos de retorno (los que se distinguen)
CKR_OK = 0x0
CKR_CANCEL = 0x1
CKR_ATTRIBUTE_SENSITIVE = 0x11
CKR_ATTRIBUTE_TYPE_INVALID = 0x12
CKR_DEVICE_ERROR = 0x30
CKR_DEVICE_MEMORY = 0x31
CKR_DEVICE_REMOVED = 0x32
CKR_FUNCTION_CANCELED = 0x50
CKR_FUNCTION_NOT_SUPPORTED = 0x54
CKR_KEY_HANDLE_INVALID = 0x60
CKR_KEY_TYPE_INCONSISTENT = 0x63
CKR_KEY_FUNCTION_NOT_PERMITTED = 0x68
CKR_MECHANISM_INVALID = 0x70
CKR_MECHANISM_PARAM_INVALID = 0x71
CKR_PIN_INCORRECT = 0xA0
CKR_PIN_INVALID = 0xA1
CKR_PIN_LEN_RANGE = 0xA2
CKR_PIN_EXPIRED = 0xA3
CKR_PIN_LOCKED = 0xA4
CKR_SESSION_CLOSED = 0xB0
CKR_SESSION_HANDLE_INVALID = 0xB3
CKR_TOKEN_NOT_PRESENT = 0xE0
CKR_TOKEN_NOT_RECOGNIZED = 0xE1
CKR_USER_ALREADY_LOGGED_IN = 0x100
CKR_USER_NOT_LOGGED_IN = 0x101
CKR_USER_PIN_NOT_INITIALIZED = 0x102
CKR_BUFFER_TOO_SMALL = 0x150
CKR_CRYPTOKI_ALREADY_INITIALIZED = 0x191
CKR_FUNCTION_REJECTED = 0x200
CKR_SLOT_ID_INVALID = 0x3

# Clases, atributos, tipos y mecanismos
CKO_CERTIFICATE = 1
CKO_PUBLIC_KEY = 2
CKO_PRIVATE_KEY = 3
CKA_CLASS = 0x0
CKA_LABEL = 0x3
CKA_VALUE = 0x11
CKA_CERTIFICATE_TYPE = 0x80
CKA_KEY_TYPE = 0x100
CKA_ID = 0x102
CKA_SIGN = 0x108
CKA_MODULUS = 0x120
CKA_EC_POINT = 0x181
CKA_ALWAYS_AUTHENTICATE = 0x202
CKC_X_509 = 0
CKK_RSA = 0
CKK_EC = 3
CKM_RSA_PKCS = 0x1
CKM_ECDSA = 0x1041
CKU_USER = 1
CKU_CONTEXT_SPECIFIC = 2

# Indicadores
CKF_OS_LOCKING_OK = 0x2
CKF_SERIAL_SESSION = 0x4
CKF_TOKEN_PRESENT = 0x1
CKF_REMOVABLE_DEVICE = 0x2
CKF_HW_SLOT = 0x4
CKF_LOGIN_REQUIRED = 0x4
CKF_USER_PIN_INITIALIZED = 0x8
CKF_PROTECTED_AUTHENTICATION_PATH = 0x100
CKF_USER_PIN_COUNT_LOW = 0x10000
CKF_USER_PIN_FINAL_TRY = 0x20000
CKF_USER_PIN_LOCKED = 0x40000
CKF_USER_PIN_TO_BE_CHANGED = 0x80000

MAX_SLOTS = 64
MAX_OBJECTS = 2000
MAX_ATTRIBUTE_BYTES = 256 * 1024
MAX_SIGNATURE_BYTES = 2048  # una firma RSA de 16384 bits ocupa 2048


class P11Error(Exception):
    """Un codigo de retorno PKCS#11 distinto de CKR_OK (sin mas datos: no deben llegar a los logs)."""

    def __init__(self, rv: int, where: str) -> None:
        super().__init__(f"{where}: 0x{rv:08X}")
        self.rv = rv
        self.where = where


# ------------------------------------------------------------------ estructuras


class CK_VERSION(ctypes.Structure):
    _fields_ = [("major", ctypes.c_ubyte), ("minor", ctypes.c_ubyte)]


class CK_SLOT_INFO(ctypes.Structure):
    _fields_ = [
        ("slotDescription", ctypes.c_ubyte * 64),
        ("manufacturerID", ctypes.c_ubyte * 32),
        ("flags", CK_ULONG),
        ("hardwareVersion", CK_VERSION),
        ("firmwareVersion", CK_VERSION),
    ]


class CK_TOKEN_INFO(ctypes.Structure):
    _fields_ = [
        ("label", ctypes.c_ubyte * 32),
        ("manufacturerID", ctypes.c_ubyte * 32),
        ("model", ctypes.c_ubyte * 16),
        ("serialNumber", ctypes.c_ubyte * 16),
        ("flags", CK_ULONG),
        ("ulMaxSessionCount", CK_ULONG),
        ("ulSessionCount", CK_ULONG),
        ("ulMaxRwSessionCount", CK_ULONG),
        ("ulRwSessionCount", CK_ULONG),
        ("ulMaxPinLen", CK_ULONG),
        ("ulMinPinLen", CK_ULONG),
        ("ulTotalPublicMemory", CK_ULONG),
        ("ulFreePublicMemory", CK_ULONG),
        ("ulTotalPrivateMemory", CK_ULONG),
        ("ulFreePrivateMemory", CK_ULONG),
        ("hardwareVersion", CK_VERSION),
        ("firmwareVersion", CK_VERSION),
        ("utcTime", ctypes.c_ubyte * 16),
    ]


class CK_ATTRIBUTE(ctypes.Structure):
    _fields_ = [("type", CK_ULONG), ("pValue", ctypes.c_void_p), ("ulValueLen", CK_ULONG)]


class CK_MECHANISM(ctypes.Structure):
    _fields_ = [("mechanism", CK_ULONG), ("pParameter", ctypes.c_void_p), ("ulParameterLen", CK_ULONG)]


class CK_C_INITIALIZE_ARGS(ctypes.Structure):
    _fields_ = [
        ("CreateMutex", ctypes.c_void_p),
        ("DestroyMutex", ctypes.c_void_p),
        ("LockMutex", ctypes.c_void_p),
        ("UnlockMutex", ctypes.c_void_p),
        ("flags", CK_ULONG),
        ("pReserved", ctypes.c_void_p),
    ]


# El orden de la tabla de funciones de PKCS#11 2.x (identico al principio de la de 3.0).
_FUNCTIONS = (
    "C_Initialize", "C_Finalize", "C_GetInfo", "C_GetFunctionList", "C_GetSlotList", "C_GetSlotInfo",
    "C_GetTokenInfo", "C_GetMechanismList", "C_GetMechanismInfo", "C_InitToken", "C_InitPIN", "C_SetPIN",
    "C_OpenSession", "C_CloseSession", "C_CloseAllSessions", "C_GetSessionInfo", "C_GetOperationState",
    "C_SetOperationState", "C_Login", "C_Logout", "C_CreateObject", "C_CopyObject", "C_DestroyObject",
    "C_GetObjectSize", "C_GetAttributeValue", "C_SetAttributeValue", "C_FindObjectsInit", "C_FindObjects",
    "C_FindObjectsFinal", "C_EncryptInit", "C_Encrypt", "C_EncryptUpdate", "C_EncryptFinal", "C_DecryptInit",
    "C_Decrypt", "C_DecryptUpdate", "C_DecryptFinal", "C_DigestInit", "C_Digest", "C_DigestUpdate",
    "C_DigestKey", "C_DigestFinal", "C_SignInit", "C_Sign", "C_SignUpdate", "C_SignFinal", "C_SignRecoverInit",
    "C_SignRecover", "C_VerifyInit", "C_Verify", "C_VerifyUpdate", "C_VerifyFinal", "C_VerifyRecoverInit",
    "C_VerifyRecover", "C_DigestEncryptUpdate", "C_DecryptDigestUpdate", "C_SignEncryptUpdate",
    "C_DecryptVerifyUpdate", "C_GenerateKey", "C_GenerateKeyPair", "C_WrapKey", "C_UnwrapKey", "C_DeriveKey",
    "C_SeedRandom", "C_GenerateRandom", "C_GetFunctionStatus", "C_CancelFunction", "C_WaitForSlotEvent",
)


class CK_FUNCTION_LIST(ctypes.Structure):
    _fields_ = [("version", CK_VERSION), *((name, ctypes.c_void_p) for name in _FUNCTIONS)]


_P = ctypes.POINTER
_ULONG_P = _P(CK_ULONG)
_BYTES_P = _P(ctypes.c_ubyte)
_PROTOTYPES = {
    "C_Initialize": ctypes.CFUNCTYPE(CK_RV, ctypes.c_void_p),
    "C_Finalize": ctypes.CFUNCTYPE(CK_RV, ctypes.c_void_p),
    "C_GetSlotList": ctypes.CFUNCTYPE(CK_RV, CK_BBOOL, _ULONG_P, _ULONG_P),
    "C_GetSlotInfo": ctypes.CFUNCTYPE(CK_RV, CK_ULONG, _P(CK_SLOT_INFO)),
    "C_GetTokenInfo": ctypes.CFUNCTYPE(CK_RV, CK_ULONG, _P(CK_TOKEN_INFO)),
    "C_OpenSession": ctypes.CFUNCTYPE(CK_RV, CK_ULONG, CK_ULONG, ctypes.c_void_p, ctypes.c_void_p, _ULONG_P),
    "C_CloseSession": ctypes.CFUNCTYPE(CK_RV, CK_ULONG),
    "C_Login": ctypes.CFUNCTYPE(CK_RV, CK_ULONG, CK_ULONG, _BYTES_P, CK_ULONG),
    "C_Logout": ctypes.CFUNCTYPE(CK_RV, CK_ULONG),
    "C_GetAttributeValue": ctypes.CFUNCTYPE(CK_RV, CK_ULONG, CK_ULONG, _P(CK_ATTRIBUTE), CK_ULONG),
    "C_FindObjectsInit": ctypes.CFUNCTYPE(CK_RV, CK_ULONG, _P(CK_ATTRIBUTE), CK_ULONG),
    "C_FindObjects": ctypes.CFUNCTYPE(CK_RV, CK_ULONG, _ULONG_P, CK_ULONG, _ULONG_P),
    "C_FindObjectsFinal": ctypes.CFUNCTYPE(CK_RV, CK_ULONG),
    "C_SignInit": ctypes.CFUNCTYPE(CK_RV, CK_ULONG, _P(CK_MECHANISM), CK_ULONG),
    "C_Sign": ctypes.CFUNCTYPE(CK_RV, CK_ULONG, _BYTES_P, CK_ULONG, _BYTES_P, _ULONG_P),
}

# Una sola operacion PKCS#11 a la vez en todo el proceso: entre C_Initialize y
# C_Finalize la biblioteca es de quien tiene este cerrojo (NSS, ademas, solo
# admite una base de datos por inicializacion).
LOCK = threading.RLock()


def _text(raw: Any) -> str:
    """Texto de un campo de longitud fija (relleno con espacios, segun PKCS#11)."""
    data = bytes(raw).split(b"\0", 1)[0]
    text = data.decode("utf-8", "replace").strip()
    return "".join(ch for ch in text if ch.isprintable())[:64]


@dataclass(frozen=True)
class SlotInfo:
    description: str
    manufacturer: str
    flags: int


@dataclass(frozen=True)
class TokenInfo:
    label: str
    manufacturer: str
    model: str
    serial: str
    flags: int
    min_pin: int
    max_pin: int

    @property
    def identity(self) -> tuple[str, str, str, str]:
        return (self.label, self.manufacturer, self.model, self.serial)


def trusted_library(path: str) -> bool:
    """Un archivo de biblioteca del sistema: normal, de root y que nadie mas pueda modificar."""
    try:
        info = os.stat(path)
    except OSError:
        return False
    return stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022


class Library:
    """Un modulo PKCS#11 cargado. No se descarga nunca (descargarlo no es seguro)."""

    _loaded: dict[str, "Library"] = {}

    @classmethod
    def load(cls, path: str) -> "Library":
        with LOCK:
            found = cls._loaded.get(path)
            if found is None:
                found = cls._loaded[path] = cls(path)
            return found

    def __init__(self, path: str) -> None:
        if not trusted_library(path):
            raise OSError("biblioteca no fiable")
        self.path = path
        self._dll = ctypes.CDLL(path)
        getter = self._dll.C_GetFunctionList
        getter.restype = CK_RV
        getter.argtypes = [_P(_P(CK_FUNCTION_LIST))]
        table = _P(CK_FUNCTION_LIST)()
        rv = getter(ctypes.byref(table))
        if rv != CKR_OK or not table:
            raise P11Error(rv or CKR_DEVICE_ERROR, "C_GetFunctionList")
        if table.contents.version.major not in (2, 3):
            raise P11Error(CKR_FUNCTION_NOT_SUPPORTED, "version")
        self._table = table  # la tabla es del modulo; se guarda la referencia
        self._fn: dict[str, Any] = {}
        for name, prototype in _PROTOTYPES.items():
            address = getattr(table.contents, name)
            if not address:
                raise P11Error(CKR_FUNCTION_NOT_SUPPORTED, name)
            self._fn[name] = prototype(address)
        self._initialized = False

    def _call(self, name: str, *args: Any) -> int:
        return int(self._fn[name](*args))

    def _check(self, name: str, *args: Any) -> None:
        rv = self._call(name, *args)
        if rv != CKR_OK:
            raise P11Error(rv, name)

    # --------------------------------------------------------------- inicio

    @contextmanager
    def initialized(self, reserved: bytes | None = None) -> Iterator["Library"]:
        """La biblioteca lista para usar mientras dura el bloque (con ``LOCK`` tomado).

        ``reserved`` son los parametros de inicio que necesita el modulo de NSS
        (la carpeta de la base de datos); los demas modulos no llevan ninguno.
        """
        with LOCK:
            args = CK_C_INITIALIZE_ARGS()
            args.flags = CKF_OS_LOCKING_OK
            keep = ctypes.create_string_buffer(reserved) if reserved is not None else None
            args.pReserved = ctypes.cast(keep, ctypes.c_void_p) if keep is not None else None
            rv = self._call("C_Initialize", ctypes.byref(args))
            if rv == CKR_CRYPTOKI_ALREADY_INITIALIZED:
                # Quedo abierta de una vez anterior que no se cerro: se cierra y se
                # vuelve a abrir, para que valgan estos parametros y no aquellos.
                self._call("C_Finalize", None)
                rv = self._call("C_Initialize", ctypes.byref(args))
            if rv != CKR_OK:
                raise P11Error(rv, "C_Initialize")
            try:
                yield self
            finally:
                rv = self._call("C_Finalize", None)
                if rv != CKR_OK:
                    log.warning("el modulo PKCS#11 no se cerro bien (0x%08X)", rv)

    # ------------------------------------------------------- ranuras y tokens

    def slots(self) -> list[int]:
        """Ranuras con un token presente."""
        count = CK_ULONG(0)
        self._check("C_GetSlotList", CK_BBOOL(1), None, ctypes.byref(count))
        if count.value == 0:
            return []
        for _attempt in range(3):
            size = max(1, min(count.value, MAX_SLOTS))
            items = (CK_ULONG * size)()
            count = CK_ULONG(size)
            rv = self._call("C_GetSlotList", CK_BBOOL(1), items, ctypes.byref(count))
            if rv == CKR_BUFFER_TOO_SMALL and size < MAX_SLOTS:
                continue  # aparecio otro token entre las dos llamadas: count trae el nuevo numero
            if rv not in (CKR_OK, CKR_BUFFER_TOO_SMALL):
                raise P11Error(rv, "C_GetSlotList")
            return [int(items[i]) for i in range(min(count.value, size))]
        return []

    def slot_info(self, slot: int) -> SlotInfo:
        info = CK_SLOT_INFO()
        self._check("C_GetSlotInfo", CK_ULONG(slot), ctypes.byref(info))
        return SlotInfo(_text(info.slotDescription), _text(info.manufacturerID), int(info.flags))

    def token_info(self, slot: int) -> TokenInfo:
        info = CK_TOKEN_INFO()
        self._check("C_GetTokenInfo", CK_ULONG(slot), ctypes.byref(info))
        minimum = int(info.ulMinPinLen) if info.ulMinPinLen != UNAVAILABLE else 0
        maximum = int(info.ulMaxPinLen) if info.ulMaxPinLen != UNAVAILABLE else 0
        return TokenInfo(
            _text(info.label), _text(info.manufacturerID), _text(info.model), _text(info.serialNumber),
            int(info.flags), min(minimum, 256), min(maximum, 256),
        )

    # ------------------------------------------------------------- sesiones

    @contextmanager
    def session(self, slot: int) -> Iterator[int]:
        handle = CK_ULONG(0)
        self._check("C_OpenSession", CK_ULONG(slot), CK_ULONG(CKF_SERIAL_SESSION), None, None, ctypes.byref(handle))
        try:
            yield int(handle.value)
        finally:
            self._call("C_CloseSession", handle)

    def login(self, session: int, pin: bytearray | None, *, user: int = CKU_USER) -> None:
        """Inicia la sesion con el PIN, o sin el si el lector tiene teclado propio (``pin=None``)."""
        if pin is None:
            rv = self._call("C_Login", CK_ULONG(session), CK_ULONG(user), None, CK_ULONG(0))
        else:
            buffer = (ctypes.c_ubyte * max(len(pin), 1)).from_buffer(pin) if pin else (ctypes.c_ubyte * 1)()
            try:
                rv = self._call("C_Login", CK_ULONG(session), CK_ULONG(user), buffer, CK_ULONG(len(pin)))
            finally:
                del buffer  # la memoria es la del bytearray, que borra quien llama
        if rv not in (CKR_OK, CKR_USER_ALREADY_LOGGED_IN):
            raise P11Error(rv, "C_Login")

    def logout(self, session: int) -> None:
        self._call("C_Logout", CK_ULONG(session))

    # -------------------------------------------------------------- objetos

    def find(self, session: int, template: dict[int, int | bytes]) -> list[int]:
        """Objetos que cumplen la plantilla (clases y tipos como enteros, el resto como bytes)."""
        keep: list[Any] = []
        attributes = (CK_ATTRIBUTE * max(len(template), 1))()
        for index, (kind, value) in enumerate(template.items()):
            if isinstance(value, int):
                data: Any = CK_ULONG(value)
                size = ctypes.sizeof(CK_ULONG)
            else:
                data = ctypes.create_string_buffer(value, len(value))
                size = len(value)
            keep.append(data)
            attributes[index] = CK_ATTRIBUTE(kind, ctypes.cast(ctypes.byref(data), ctypes.c_void_p), size)
        self._check("C_FindObjectsInit", CK_ULONG(session), attributes, CK_ULONG(len(template)))
        found: list[int] = []
        try:
            batch = (CK_ULONG * 64)()
            while len(found) < MAX_OBJECTS:
                count = CK_ULONG(0)
                self._check("C_FindObjects", CK_ULONG(session), batch, CK_ULONG(64), ctypes.byref(count))
                if count.value == 0:
                    break
                found.extend(int(batch[i]) for i in range(min(count.value, 64)))
        finally:
            self._call("C_FindObjectsFinal", CK_ULONG(session))
        return found[:MAX_OBJECTS]

    def attribute(self, session: int, handle: int, kind: int) -> bytes | None:
        """Valor de un atributo, o ``None`` si el objeto no lo tiene o no se puede leer."""
        query = CK_ATTRIBUTE(kind, None, 0)
        rv = self._call("C_GetAttributeValue", CK_ULONG(session), CK_ULONG(handle), ctypes.byref(query), CK_ULONG(1))
        if rv in (CKR_ATTRIBUTE_SENSITIVE, CKR_ATTRIBUTE_TYPE_INVALID) or query.ulValueLen == UNAVAILABLE:
            return None
        if rv != CKR_OK:
            raise P11Error(rv, "C_GetAttributeValue")
        size = int(query.ulValueLen)
        if size == 0:
            return b""
        if size > MAX_ATTRIBUTE_BYTES:
            return None
        buffer = ctypes.create_string_buffer(size)
        query = CK_ATTRIBUTE(kind, ctypes.cast(buffer, ctypes.c_void_p), size)
        rv = self._call("C_GetAttributeValue", CK_ULONG(session), CK_ULONG(handle), ctypes.byref(query), CK_ULONG(1))
        if rv != CKR_OK or query.ulValueLen == UNAVAILABLE or int(query.ulValueLen) > size:
            return None
        return buffer.raw[: int(query.ulValueLen)]

    def flag(self, session: int, handle: int, kind: int) -> bool:
        value = self.attribute(session, handle, kind)
        return bool(value) and value[0] != 0

    def number(self, session: int, handle: int, kind: int) -> int | None:
        value = self.attribute(session, handle, kind)
        if value is None or len(value) != ctypes.sizeof(CK_ULONG):
            return None
        return int.from_bytes(value, "little" if _LITTLE else "big")

    # ---------------------------------------------------------------- firmar

    def sign_init(self, session: int, key: int, mechanism: int) -> None:
        mech = CK_MECHANISM(mechanism, None, 0)
        self._check("C_SignInit", CK_ULONG(session), ctypes.byref(mech), CK_ULONG(key))

    def sign(self, session: int, data: bytes) -> bytes:
        source = (ctypes.c_ubyte * len(data)).from_buffer_copy(data)
        out = (ctypes.c_ubyte * MAX_SIGNATURE_BYTES)()
        size = CK_ULONG(len(out))
        self._check("C_Sign", CK_ULONG(session), source, CK_ULONG(len(data)), out, ctypes.byref(size))
        if not 0 < size.value <= len(out):
            raise P11Error(CKR_DEVICE_ERROR, "C_Sign")
        return bytes(out[: size.value])


_LITTLE = int.from_bytes(bytes(CK_ULONG(1)), "little") == 1
