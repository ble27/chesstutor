from dataclasses import dataclass


@dataclass(frozen=True)
class Ply:
    """A half-move index; zero denotes the starting position."""

    index: int

    def __post_init__(self) -> None:
        if isinstance(self.index, bool) or not isinstance(self.index, int):
            raise ValueError("Ply index must be an integer")
        if not 0 <= self.index <= 300:
            raise ValueError("Ply index must be between 0 and 300")
