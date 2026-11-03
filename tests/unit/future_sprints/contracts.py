"""Proposed public seams for S4–S7; no production substitute lives here.

Authority: plan.md S4–S7, docs/PRD.md §§6–10, AGENTS.md tests/gates.
Inputs are keyword arguments; implementations own their typed result models.
Import inside each case keeps missing future modules from aborting collection.
"""

from collections.abc import Callable
from importlib import import_module
from typing import cast

import pytest


def policy(module: str, function: str) -> Callable[..., object]:
    """Resolve a proposed callable, failing rather than skipping missing behavior."""
    try:
        implementation = import_module(module)
    except ModuleNotFoundError as error:
        if error.name and (module == error.name or module.startswith(error.name + ".")):
            pytest.fail(f"Unimplemented sprint boundary: {module}.{function}", pytrace=False)
        raise
    candidate = getattr(implementation, function, None)
    assert callable(candidate), f"Missing public callable: {module}.{function}"
    return cast(Callable[..., object], candidate)
