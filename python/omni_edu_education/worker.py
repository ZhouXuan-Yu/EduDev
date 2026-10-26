"""Frozen entry for the four fixed education adapters. No arbitrary script input."""
import argparse
import ctypes
import os
from pathlib import Path
import runpy
import socket
import sys
import threading
import time


def no_network(*args, **kwargs):
    raise RuntimeError("network_forbidden")


def watch_parent(pid):
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.OpenProcess.restype = ctypes.c_void_p
    kernel.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_bool, ctypes.c_uint32]
    kernel.GetExitCodeProcess.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_uint32)]
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    handle = kernel.OpenProcess(0x1000, False, pid)
    if not handle:
        os._exit(2)
    try:
        while True:
            status = ctypes.c_uint32()
            if not kernel.GetExitCodeProcess(handle, ctypes.byref(status)) or status.value != 259:
                os._exit(2)
            time.sleep(0.25)
    finally:
        kernel.CloseHandle(handle)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--worker", choices=("reading", "learning", "question", "math"), required=True)
    parser.add_argument("--parent-pid", type=int, required=True)
    args = parser.parse_args()
    if args.parent_pid <= 0 or os.name != "nt" or not getattr(sys, "frozen", False):
        raise SystemExit(2)
    socket.socket.connect = no_network
    socket.socket.connect_ex = no_network
    socket.create_connection = no_network
    threading.Thread(target=watch_parent, args=(args.parent_pid,), daemon=True).start()
    root = Path(sys._MEIPASS) / "education"
    runpy.run_path(str(root / (args.worker + "-worker.py")), run_name="__main__")


if __name__ == "__main__":
    main()
