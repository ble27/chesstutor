import ast
from pathlib import Path


def violations(path: Path) -> list[str]:
    source = path.read_text()
    lines = source.splitlines()
    errors = []
    for node in ast.walk(ast.parse(source, filename=str(path))):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        start = min([node.lineno, *(item.lineno for item in node.decorator_list)])
        end = node.end_lineno or node.lineno
        nearby = "\n".join(lines[max(0, start - 3) : start + 1])
        if end - start + 1 > 100 and "length-exception:" not in nearby:
            errors.append(f"{path}:{start}: {node.name} exceeds 100 lines")
    return errors


def main() -> None:
    paths = [
        path
        for directory in ("services", "scripts", "tests", "migrations")
        for path in Path(directory).rglob("*.py")
    ]
    errors = [error for path in paths for error in violations(path)]
    if errors:
        raise SystemExit("\n".join(errors))
    print("Python function lengths passed")


if __name__ == "__main__":
    main()
