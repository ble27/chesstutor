import hashlib
import json
import os
import platform
import tarfile
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urlsplit

import httpx

from services.core.analysis.values import PRESETS

MAX_ARCHIVE_BYTES = 150 * 1024 * 1024


@dataclass(frozen=True)
class Artifact:
    platform: str
    version: str
    archive_url: str
    archive_sha256: str
    binary_path: str
    binary_sha256: str
    source_url: str


def selected_artifact(name: str | None = None) -> Artifact:
    if name is None:
        name = {("Darwin", "arm64"): "darwin-arm64", ("Linux", "x86_64"): "linux-x86_64"}.get(
            (platform.system(), platform.machine()), "unsupported"
        )
    manifest = json.loads(Path("engines/stockfish.json").read_text())
    if name not in manifest["artifacts"]:
        raise ValueError("No verified Stockfish artifact for this platform")
    item = manifest["artifacts"][name]
    return Artifact(
        name,
        manifest["version"],
        item["archive_url"],
        item["archive_sha256"],
        item["binary_path"],
        item["binary_sha256"],
        manifest["source_url"],
    )


def verify_binary(path: Path, artifact: Artifact) -> dict[str, object]:
    if not path.is_file() or path.is_symlink() or path.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("Install the pinned Stockfish executable first")
    with path.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != artifact.binary_sha256:
            raise ValueError("Stockfish executable checksum mismatch")
    return engine_identity(artifact)


def engine_identity(artifact: Artifact) -> dict[str, object]:
    return {
        **asdict(artifact),
        "nnue": "embedded; covered by binary_sha256",
        "options": {"Threads": 1, "Hash": 128, "UCI_ShowWDL": True},
        "analysis_version": "s3-v1",
        "classification_version": "v3",
        "feature_version": "s4-v1",
        "presets": {
            mode: {
                "search_seconds": preset.search_seconds,
                "multipv": preset.multipv,
                "deadline_seconds": preset.deadline_seconds,
            }
            for mode, preset in PRESETS.items()
        },
    }


def download_archive(artifact: Artifact, destination: Path) -> None:
    allowed = {
        "github.com",
        "release-assets.githubusercontent.com",
        "objects.githubusercontent.com",
    }
    url, deadline = artifact.archive_url, time.monotonic() + 120
    with httpx.Client(timeout=httpx.Timeout(20, connect=5), trust_env=False) as client:
        for _ in range(6):
            parsed = urlsplit(url)
            if parsed.scheme != "https" or parsed.hostname not in allowed or parsed.username:
                raise ValueError("Unsafe engine download redirect")
            with client.stream("GET", url, headers={"Accept-Encoding": "identity"}) as response:
                if response.is_redirect:
                    url = str(response.url.join(response.headers["location"]))
                    continue
                response.raise_for_status()
                size = 0
                with destination.open("wb") as output:
                    for chunk in response.iter_bytes(1024 * 1024):
                        size += len(chunk)
                        if size > MAX_ARCHIVE_BYTES or time.monotonic() >= deadline:
                            raise ValueError("Engine download exceeded its bounds")
                        output.write(chunk)
                return
    raise ValueError("Too many engine download redirects")


def archive_member(archive: tarfile.TarFile, name: str) -> bytes:
    member = archive.getmember(name)
    if not member.isfile() or member.size > MAX_ARCHIVE_BYTES:
        raise ValueError("Unsafe engine archive member")
    source = archive.extractfile(member)
    if source is None:
        raise ValueError("Missing engine archive member")
    with source:
        return source.read(MAX_ARCHIVE_BYTES + 1)


def install_engine(destination: Path, artifact: Artifact, archive_path: Path | None = None) -> None:
    if archive_path is None:
        # Keyed by the pinned digest so an older release is never found after a pin change.
        archive_path = Path(".cache/stockfish") / f"{artifact.platform}-{artifact.archive_sha256}"
        archive_path.parent.mkdir(parents=True, exist_ok=True)
        if not archive_path.is_file():
            download_archive(artifact, archive_path)
    if archive_path.stat().st_size > MAX_ARCHIVE_BYTES:
        raise ValueError("Engine archive is too large")
    with archive_path.open("rb") as stream:
        if hashlib.file_digest(stream, "sha256").hexdigest() != artifact.archive_sha256:
            raise ValueError("Engine archive checksum mismatch")
    with tarfile.open(archive_path) as archive:
        binary = archive_member(archive, artifact.binary_path)
        license_text = archive_member(archive, "stockfish/Copying.txt")
    if hashlib.sha256(binary).hexdigest() != artifact.binary_sha256:
        raise ValueError("Engine binary checksum mismatch")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as output:
        temporary = Path(output.name)
        output.write(binary)
    try:
        temporary.chmod(0o755)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)
    destination.with_name(destination.name + "-LICENSE.txt").write_bytes(license_text)
    destination.with_name(destination.name + "-provenance.json").write_text(
        json.dumps(verify_binary(destination, artifact), indent=2) + "\n"
    )
