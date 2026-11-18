"""El aislamiento del motor de cada sistema, con la misma forma.

* Windows: ``winsandbox`` (AppContainer, objeto de trabajo y mitigaciones).
* Linux: ``linuxsandbox`` (bubblewrap, limites).

El resto del motor (``broker``, ``__main__``, la IA) usa solo lo de aqui.
"""

from __future__ import annotations

import sys

if sys.platform == "win32":
    from .winsandbox import (
        PROFILE_PREFIX,
        RUN_MARKER,
        Child,
        Container,
        Job,
        SandboxError,
        clean_stale_dirs,
        clean_stale_runs,
        delete_container,
        ensure_read_access,
        lock_down_dynamic_code,
        open_container,
        other_profiles,
        plain_directory,
        process_memory_limit,
        profile_folder_name,
        running_emulated,
        spawn,
    )
else:
    from .linuxsandbox import (
        PROFILE_PREFIX,
        RUN_MARKER,
        Child,
        Container,
        Job,
        SandboxError,
        clean_stale_dirs,
        clean_stale_runs,
        delete_container,
        ensure_read_access,
        lock_down_dynamic_code,
        open_container,
        other_profiles,
        plain_directory,
        process_memory_limit,
        profile_folder_name,
        running_emulated,
        spawn,
    )

__all__ = [
    "PROFILE_PREFIX",
    "RUN_MARKER",
    "Child",
    "Container",
    "Job",
    "SandboxError",
    "clean_stale_dirs",
    "clean_stale_runs",
    "delete_container",
    "ensure_read_access",
    "lock_down_dynamic_code",
    "open_container",
    "other_profiles",
    "plain_directory",
    "process_memory_limit",
    "profile_folder_name",
    "running_emulated",
    "spawn",
]
