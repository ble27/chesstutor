from unittest.mock import Mock

import pytest

from services.worker import engine_exec


def launcher(monkeypatch, parents):
    monkeypatch.setattr(engine_exec.sys, "argv", ["engine_exec", "/trusted/stockfish"])
    monkeypatch.setattr(engine_exec.sys, "platform", "linux")
    monkeypatch.setattr(engine_exec.os, "getppid", Mock(side_effect=parents))
    monkeypatch.setattr(
        engine_exec.ctypes, "CDLL", Mock(return_value=Mock(prctl=Mock(return_value=0)))
    )
    monkeypatch.setattr(engine_exec.resource, "setrlimit", Mock())
    execute = Mock()
    monkeypatch.setattr(engine_exec.os, "execv", execute)
    return execute


def test_container_pid_one_worker_is_a_valid_engine_parent(monkeypatch):
    execute = launcher(monkeypatch, [1, 1])
    engine_exec.main()
    execute.assert_called_once_with("/trusted/stockfish", ["/trusted/stockfish"])


def test_parent_exit_during_parent_death_registration_prevents_exec(monkeypatch):
    execute = launcher(monkeypatch, [24, 1])
    with pytest.raises(SystemExit, match="Engine parent exited"):
        engine_exec.main()
    execute.assert_not_called()
