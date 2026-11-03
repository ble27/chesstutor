import argparse
from pathlib import Path

from services.adapters.engine_binary import install_engine, selected_artifact, verify_binary


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Install only repository-pinned Stockfish artifacts"
    )
    parser.add_argument("--platform", choices=["darwin-arm64", "linux-x86_64"])
    parser.add_argument("--destination", type=Path, default=Path("bin/stockfish"))
    arguments = parser.parse_args()
    artifact = selected_artifact(arguments.platform)
    try:
        verify_binary(arguments.destination, artifact)
    except ValueError:
        install_engine(arguments.destination, artifact)
    print(f"Verified Stockfish {artifact.version} ({artifact.platform})")


if __name__ == "__main__":
    main()
