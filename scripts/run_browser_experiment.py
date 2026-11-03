"""Run the isolated browser experiment without replacing the Docker stack."""

import os
import subprocess
import sys
from contextlib import suppress
from pathlib import Path

from fastapi import FastAPI

from services.api.app.main import create_app


def create_experiment_app() -> FastAPI:
    # This validation-only instance shares discovery storage with the main app,
    # but must not reschedule its engine jobs in the background.
    return create_app(reconcile_analyses=False)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    environment = {
        **os.environ,
        "API_PROXY_TARGET": "http://127.0.0.1:8001",
        "CHESS_ALLOWED_ORIGINS": '["http://localhost:5175","http://127.0.0.1:5175","http://127.0.0.1:5174"]',
    }
    commands = [
        [
            sys.executable,
            "-m",
            "uvicorn",
            "scripts.run_browser_experiment:create_experiment_app",
            "--factory",
            "--host",
            "127.0.0.1",
            "--port",
            "8001",
        ],
        ["npm", "--prefix", "apps/web", "run", "dev", "--", "--port", "5175"],
    ]
    processes = []
    print(
        "PROTOTYPE: http://127.0.0.1:5175/?engine=browser (server comparison: ?engine=server)",
        flush=True,
    )
    try:
        for command in commands:
            processes.append(subprocess.Popen(command, cwd=root, env=environment))
        while all(process.poll() is None for process in processes):
            with suppress(subprocess.TimeoutExpired):
                processes[0].wait(timeout=1)
    except KeyboardInterrupt:
        pass
    finally:
        for process in processes:
            process.terminate()
        for process in processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    main()
