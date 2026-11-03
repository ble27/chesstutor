"""Trusted engine launcher: bounded resources and Linux parent-death cleanup."""

import ctypes
import os
import resource
import signal
import sys


def main() -> None:
    if len(sys.argv) != 2 or not os.path.isabs(sys.argv[1]):
        raise SystemExit("A trusted absolute engine path is required")
    if sys.platform == "linux":
        parent = os.getppid()
        libc = ctypes.CDLL(None, use_errno=True)
        if libc.prctl(1, signal.SIGKILL, 0, 0, 0) != 0:
            raise OSError(ctypes.get_errno(), "Cannot configure engine parent-death cleanup")
        # A container's worker may itself be PID 1; only a changed parent
        # indicates an exit during registration.
        if os.getppid() != parent:
            raise SystemExit("Engine parent exited")
        # The pinned build maps ~652 MiB virtually with 128 MiB Hash (~366 MiB
        # resident). Leave bounded mapping headroom; Compose also caps RSS.
        resource.setrlimit(resource.RLIMIT_AS, (1024 * 1024 * 1024, 1024 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_CPU, (570, 570))
    os.execv(sys.argv[1], [sys.argv[1]])


if __name__ == "__main__":
    main()
