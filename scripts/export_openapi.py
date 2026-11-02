import json
from pathlib import Path

from services.api.app.main import create_app
from services.api.app.settings import Settings


def main() -> None:
    app = create_app(Settings(_env_file=None))
    destination = Path("contracts/openapi.json")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
